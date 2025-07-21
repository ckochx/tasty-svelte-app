import type { Quote } from '$lib/server/market-data';

export interface StreamingQuote extends Quote {
	timestamp?: number;
}

export interface DXLinkMessage {
	type: string;
	channel?: number;
	data?: unknown;
}

export interface StreamingDataStore {
	quotes: Map<string, StreamingQuote>;
	connected: boolean;
	error: string | null;
	lastUpdate: number;
}

export class StreamingMarketDataService {
	private ws: WebSocket | null = null;
	private quoteToken: string | null = null;
	private dxlinkUrl: string | null = null;
	private channel = 1;
	private keepaliveInterval: ReturnType<typeof setInterval> | null = null;
	private subscribedSymbols: Set<string> = new Set();
	private onDataCallback: ((quote: StreamingQuote) => void) | null = null;
	private onStatusCallback: ((connected: boolean, error?: string) => void) | null = null;
	private isSetupComplete = false;
	private isAuthorized = false;
	private isFeedConfigured = false;
	private pendingSymbols: string[] = [];
	private instanceId: string;
	private connectionToken: string | null = null; // Backup token storage

	constructor() {
		this.instanceId = Math.random().toString(36).substring(7);
		console.log(`StreamingMarketDataService constructor called - instance ${this.instanceId}`);
		this.setupEventHandlers();
	}

	async connect(quoteToken: string, dxlinkUrl: string): Promise<boolean> {
		console.log(
			`[${this.instanceId}] connect() called with token:`,
			quoteToken ? `${quoteToken.substring(0, 20)}...` : 'NULL/UNDEFINED'
		);
		this.quoteToken = quoteToken;
		this.connectionToken = quoteToken; // Store backup copy
		console.log(`[${this.instanceId}] Stored token in both locations`);

		// Use the API-provided dxlink-url for market data streaming
		this.dxlinkUrl = dxlinkUrl;
		console.log(`[${this.instanceId}] Connecting to WebSocket URL:`, this.dxlinkUrl);

		try {
			this.ws = new WebSocket(this.dxlinkUrl);
			this.setupWebSocketHandlers();

			return new Promise((resolve) => {
				const timeout = setTimeout(() => {
					this.onStatusCallback?.(false, 'Connection timeout');
					resolve(false);
				}, 10000);

				this.ws!.onopen = () => {
					console.log(
						`[${this.instanceId}] WebSocket opened, token check:`,
						this.quoteToken ? 'PRESENT' : 'MISSING'
					);
					clearTimeout(timeout);
					this.setupConnection();
					resolve(true);
				};

				this.ws!.onerror = () => {
					clearTimeout(timeout);
					this.onStatusCallback?.(false, 'WebSocket connection failed');
					resolve(false);
				};
			});
		} catch (error) {
			this.onStatusCallback?.(false, `Connection error: ${error}`);
			return false;
		}
	}

	private setupWebSocketHandlers(): void {
		if (!this.ws) return;
		console.log('Setting up WebSocket handlers');

		this.ws.onmessage = (event) => {
			try {
				const message: DXLinkMessage = JSON.parse(event.data);
				this.handleMessage(message);
			} catch (error) {
				console.error('Error parsing WebSocket message:', error);
			}
		};

		this.ws.onclose = () => {
			console.log('WebSocket connection closed');
			this.onStatusCallback?.(false, 'Connection closed');
			this.cleanup();
		};

		this.ws.onerror = (error) => {
			console.log('WebSocket error occurred');
			this.onStatusCallback?.(false, 'WebSocket error');
			console.error('WebSocket error:', error);
		};
	}

	private async setupConnection(): Promise<void> {
		// For DXLink protocol, initiate SETUP handshake
		console.log(`[${this.instanceId}] Initiating SETUP handshake`);
		this.sendMessage({
			type: 'SETUP',
			version: '0.1-1.0.0',
			channel: 0,
			keepaliveTimeout: 60,
			acceptKeepaliveTimeout: 60
		});
	}

	private handleMessage(message: DXLinkMessage): void {
		console.log('RECEIVED:', message.type, message);

		switch (message.type) {
			case 'SETUP': {
				// Server responded to our SETUP, now send AUTH
				console.log(`[${this.instanceId}] Server acknowledged SETUP, sending AUTH`);
				this.isSetupComplete = true;

				if (!this.quoteToken) {
					console.error(`[${this.instanceId}] ERROR: No quote token available for AUTH`);
					this.onStatusCallback?.(false, 'No quote token available');
					return;
				}

				const authMessage = {
					type: 'AUTH',
					channel: 0,
					token: this.quoteToken
				};
				console.log(`[${this.instanceId}] Sending AUTH with token`);
				this.sendMessage(authMessage);
				break;
			}

			case 'AUTH':
			case 'AUTH_STATE':
				// Check AUTH state
				if (message.state === 'AUTHORIZED') {
					console.log('Authentication successful');
					this.isAuthorized = true;
					this.sendMessage({
						type: 'CHANNEL_REQUEST',
						channel: this.channel,
						service: 'FEED',
						parameters: {
							contract: 'AUTO'
						}
					});
				} else if (message.state === 'UNAUTHORIZED') {
					console.error('Authentication failed - invalid token');
					this.onStatusCallback?.(false, 'Authentication failed');
				} else {
					console.log('Auth state:', message.state);
				}
				break;

			case 'CHANNEL_OPENED':
				// Channel opened, setup feed
				this.setupFeed();
				break;

			case 'FEED_CONFIG':
				// Feed configured, we can now subscribe to symbols
				this.isFeedConfigured = true;
				this.onStatusCallback?.(true);
				this.startKeepalive();

				// Subscribe to any pending symbols
				if (this.pendingSymbols.length > 0) {
					console.log('Subscribing to pending symbols:', this.pendingSymbols);
					this.subscribeToSymbols(this.pendingSymbols);
					this.pendingSymbols = [];
				}
				break;

			case 'FEED_DATA':
				// Handle market data
				console.log(`[${this.instanceId}] Received FEED_DATA:`, message.data);
				this.handleMarketData(message.data);
				break;

			case 'KEEPALIVE':
				// Respond to keepalive
				this.sendMessage({ type: 'KEEPALIVE', channel: 0 });
				break;

			case 'ERROR':
				// Handle error messages
				console.error('DXLink Error:', message);
				this.onStatusCallback?.(false, `${message.error}: ${message.message}`);
				break;

			default:
				console.log('Unhandled message type:', message.type);
		}
	}

	private setupFeed(): void {
		// Configure feed to receive Quote and Trade events
		this.sendMessage({
			type: 'FEED_SETUP',
			channel: this.channel,
			acceptAggregationPeriod: 10,
			acceptDataFormat: 'COMPACT',
			acceptEventFields: {
				Quote: ['eventSymbol', 'bidPrice', 'askPrice', 'bidSize', 'askSize'],
				Trade: ['eventSymbol', 'price', 'size', 'dayVolume', 'change', 'changePercent']
			}
		});
	}

	subscribeToSymbols(symbols: string[]): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn('WebSocket not connected, cannot subscribe to symbols');
			return;
		}

		if (!this.isFeedConfigured) {
			console.log('Feed not configured yet, storing symbols for later subscription:', symbols);
			this.pendingSymbols = [...new Set([...this.pendingSymbols, ...symbols])];
			return;
		}

		const newSymbols = symbols.filter((symbol) => !this.subscribedSymbols.has(symbol));

		if (newSymbols.length === 0) {
			return;
		}

		// Subscribe to Quote and Trade events for each symbol
		// DXLink expects an array of subscription objects
		const subscriptions: Array<{ type: string; symbol: string }> = [];

		// Add Quote subscriptions
		newSymbols.forEach((symbol) => {
			subscriptions.push({
				type: 'Quote',
				symbol: symbol
			});
			subscriptions.push({
				type: 'Trade',
				symbol: symbol
			});
		});

		const subscription = {
			type: 'FEED_SUBSCRIPTION',
			channel: this.channel,
			add: subscriptions
		};

		this.sendMessage(subscription);
		newSymbols.forEach((symbol) => this.subscribedSymbols.add(symbol));
	}

	unsubscribeFromSymbols(symbols: string[]): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return;
		}

		// DXLink expects an array of subscription objects
		const subscriptions: Array<{ type: string; symbol: string }> = [];

		symbols.forEach((symbol) => {
			subscriptions.push({
				type: 'Quote',
				symbol: symbol
			});
			subscriptions.push({
				type: 'Trade',
				symbol: symbol
			});
		});

		const subscription = {
			type: 'FEED_SUBSCRIPTION',
			channel: this.channel,
			remove: subscriptions
		};

		this.sendMessage(subscription);
		symbols.forEach((symbol) => this.subscribedSymbols.delete(symbol));
	}

	private handleMarketData(data: unknown): void {
		if (!data || !Array.isArray(data)) {
			return;
		}

		// DXLink compact format: [eventType, [symbol1, field1, field2, ..., symbol2, field1, field2, ...]]
		const eventType = data[0];
		const eventData = data[1];

		if (!Array.isArray(eventData)) {
			return;
		}

		// Parse compact format based on event type
		if (eventType === 'Trade') {
			// Trade format: [symbol, price, size, volume, change, symbol2, price2, ...]
			for (let i = 0; i < eventData.length; i += 5) {
				const symbol = eventData[i];
				const price = eventData[i + 1];
				const size = eventData[i + 2];
				const volume = eventData[i + 3];
				const change = eventData[i + 4];

				if (typeof symbol === 'string') {
					const quote: StreamingQuote = {
						symbol,
						'instrument-type': 'Equity',
						'last-price': typeof price === 'number' ? price : undefined,
						'last-size': typeof size === 'number' ? size : undefined,
						volume: typeof volume === 'number' ? volume : undefined,
						'net-change': typeof change === 'number' ? change : undefined,
						timestamp: Date.now()
					};

					console.log(`[${this.instanceId}] Streaming update for ${symbol}:`, quote);
					this.onDataCallback?.(quote);
				}
			}
		} else if (eventType === 'Quote') {
			// Quote format: [symbol, bidPrice, askPrice, bidSize, askSize, symbol2, ...]
			for (let i = 0; i < eventData.length; i += 5) {
				const symbol = eventData[i];
				const bidPrice = eventData[i + 1];
				const askPrice = eventData[i + 2];
				const bidSize = eventData[i + 3];
				const askSize = eventData[i + 4];

				if (typeof symbol === 'string') {
					const quote: StreamingQuote = {
						symbol,
						'instrument-type': 'Equity',
						'bid-price': typeof bidPrice === 'number' ? bidPrice : undefined,
						'ask-price': typeof askPrice === 'number' ? askPrice : undefined,
						'bid-size': typeof bidSize === 'number' ? bidSize : undefined,
						'ask-size': typeof askSize === 'number' ? askSize : undefined,
						timestamp: Date.now()
					};

					console.log(`[${this.instanceId}] Streaming update for ${symbol}:`, quote);
					this.onDataCallback?.(quote);
				}
			}
		}
	}

	private startKeepalive(): void {
		this.keepaliveInterval = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.sendMessage({ type: 'KEEPALIVE', channel: 0 });
			}
		}, 30000); // Send keepalive every 30 seconds
	}

	private sendMessage(message: Record<string, unknown>): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			console.log('SENDING:', message.type, message);
			this.ws.send(JSON.stringify(message));
		} else {
			console.error('Cannot send message, WebSocket not open:', this.ws?.readyState);
		}
	}

	onData(callback: (quote: StreamingQuote) => void): void {
		this.onDataCallback = callback;
	}

	onStatusChange(callback: (connected: boolean, error?: string) => void): void {
		this.onStatusCallback = callback;
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN && this.isFeedConfigured;
	}

	disconnect(): void {
		this.cleanup();
	}

	private cleanup(): void {
		console.log(`[${this.instanceId}] cleanup() called - clearing token and connection state`);
		if (this.keepaliveInterval) {
			clearInterval(this.keepaliveInterval);
			this.keepaliveInterval = null;
		}

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.subscribedSymbols.clear();
		this.pendingSymbols = [];
		this.isSetupComplete = false;
		this.isAuthorized = false;
		this.isFeedConfigured = false;
		this.quoteToken = null; // Clear the token
		this.dxlinkUrl = null;
		this.onStatusCallback?.(false);
	}

	private setupEventHandlers(): void {
		// Clean up on page unload
		if (typeof window !== 'undefined') {
			window.addEventListener('beforeunload', () => {
				this.disconnect();
			});
		}
	}
}
