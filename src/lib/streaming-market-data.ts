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

	constructor() {
		this.setupEventHandlers();
	}

	async connect(quoteToken: string, dxlinkUrl: string): Promise<boolean> {
		this.quoteToken = quoteToken;
		// Use the API-provided dxlink-url for market data streaming
		this.dxlinkUrl = dxlinkUrl;
		console.log('Connecting to WebSocket URL:', this.dxlinkUrl);

		try {
			this.ws = new WebSocket(this.dxlinkUrl);
			this.setupWebSocketHandlers();

			return new Promise((resolve) => {
				const timeout = setTimeout(() => {
					this.onStatusCallback?.(false, 'Connection timeout');
					resolve(false);
				}, 10000);

				this.ws!.onopen = () => {
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

		this.ws.onmessage = (event) => {
			try {
				const message: DXLinkMessage = JSON.parse(event.data);
				this.handleMessage(message);
			} catch (error) {
				console.error('Error parsing WebSocket message:', error);
			}
		};

		this.ws.onclose = () => {
			this.onStatusCallback?.(false, 'Connection closed');
			this.cleanup();
		};

		this.ws.onerror = (error) => {
			this.onStatusCallback?.(false, 'WebSocket error');
			console.error('WebSocket error:', error);
		};
	}

	private async setupConnection(): Promise<void> {
		// For DXLink protocol, wait for server SETUP first, then respond
		// The server will send SETUP first, and we respond in handleMessage
	}

	private handleMessage(message: DXLinkMessage): void {
		console.log('Received message:', message);

		switch (message.type) {
			case 'SETUP':
				// Respond to server SETUP with our own SETUP, then AUTHORIZE
				this.sendMessage({
					type: 'SETUP',
					channel: 0,
					keepaliveTimeout: 60,
					acceptKeepaliveTimeout: 60
				});
				this.isSetupComplete = true;
				this.sendMessage({
					type: 'AUTHORIZE',
					channel: 0,
					token: this.quoteToken
				});
				break;

			case 'AUTHORIZE':
				// After AUTHORIZE, request channel
				this.isAuthorized = true;
				this.sendMessage({
					type: 'CHANNEL_REQUEST',
					channel: this.channel,
					service: 'FEED'
				});
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
				this.handleMarketData(message.data);
				break;

			case 'KEEPALIVE':
				// Respond to keepalive
				this.sendMessage({ type: 'KEEPALIVE' });
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

		data.forEach((event: Record<string, unknown>) => {
			if (!event.eventSymbol || typeof event.eventSymbol !== 'string') return;

			const symbol = event.eventSymbol;
			const quote: StreamingQuote = {
				symbol,
				'instrument-type': 'Equity', // Default, could be enhanced
				timestamp: Date.now()
			};

			// Map DXLink fields to our Quote interface with type guards
			if (event.eventType === 'Quote') {
				quote['bid-price'] = typeof event.bidPrice === 'number' ? event.bidPrice : undefined;
				quote['ask-price'] = typeof event.askPrice === 'number' ? event.askPrice : undefined;
				quote['bid-size'] = typeof event.bidSize === 'number' ? event.bidSize : undefined;
				quote['ask-size'] = typeof event.askSize === 'number' ? event.askSize : undefined;
			} else if (event.eventType === 'Trade') {
				quote['last-price'] = typeof event.price === 'number' ? event.price : undefined;
				quote['last-size'] = typeof event.size === 'number' ? event.size : undefined;
				quote.volume = typeof event.dayVolume === 'number' ? event.dayVolume : undefined;
				quote['net-change'] = typeof event.change === 'number' ? event.change : undefined;
				quote['net-change-percent'] =
					typeof event.changePercent === 'number' ? event.changePercent : undefined;
			}

			this.onDataCallback?.(quote);
		});
	}

	private startKeepalive(): void {
		this.keepaliveInterval = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.sendMessage({ type: 'KEEPALIVE' });
			}
		}, 30000); // Send keepalive every 30 seconds
	}

	private sendMessage(message: Record<string, unknown>): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			console.log('Sending message:', message);
			this.ws.send(JSON.stringify(message));
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
