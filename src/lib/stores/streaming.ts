import { writable, derived, get } from 'svelte/store';
import { StreamingMarketDataService, type StreamingQuote } from '$lib/streaming-market-data';
import type { Quote } from '$lib/server/market-data';

export interface StreamingState {
	connected: boolean;
	error: string | null;
	mode: 'polling' | 'streaming';
	quotes: Map<string, StreamingQuote>;
	lastUpdate: number;
}

// Create the streaming state store
function createStreamingStore() {
	const initialState: StreamingState = {
		connected: false,
		error: null,
		mode: 'polling',
		quotes: new Map(),
		lastUpdate: 0
	};

	const { subscribe, update } = writable(initialState);

	let streamingService: StreamingMarketDataService | null = null;

	const store = {
		subscribe,

		// Initialize streaming service
		init: () => {
			if (typeof window === 'undefined') return; // Server-side guard

			streamingService = new StreamingMarketDataService();

			// Handle incoming data
			streamingService.onData((quote: StreamingQuote) => {
				update((state) => {
					const key = `${quote.symbol}-${quote['instrument-type']}`;
					state.quotes.set(key, quote);
					state.lastUpdate = Date.now();
					return state;
				});
			});

			// Handle status changes
			streamingService.onStatusChange((connected: boolean, error?: string) => {
				update((state) => ({
					...state,
					connected,
					error: error || null
				}));
			});
		},

		// Set mode to streaming or polling
		setMode: (mode: 'polling' | 'streaming') => {
			update((state) => ({ ...state, mode }));
		},

		// Connect to streaming service
		connect: async () => {
			if (!streamingService) {
				update((state) => ({ ...state, error: 'Streaming service not initialized' }));
				return false;
			}

			try {
				// Fetch quote token from API
				const response = await fetch('/api/quote-token');
				const result = await response.json();

				if (!result.success) {
					update((state) => ({ ...state, error: result.error }));
					return false;
				}

				const { 'api-quote-token': token, 'dxlink-url': url } = result.data;
				const success = await streamingService.connect(token, url);

				if (!success) {
					update((state) => ({ ...state, error: 'Failed to connect to streaming service' }));
				}

				return success;
			} catch (error) {
				update((state) => ({
					...state,
					error: `Connection failed: ${error instanceof Error ? error.message : String(error)}`
				}));
				return false;
			}
		},

		// Subscribe to symbols
		subscribeToSymbols: (symbols: string[]) => {
			if (streamingService) {
				streamingService.subscribeToSymbols(symbols);
			}
		},

		// Unsubscribe from symbols
		unsubscribeFromSymbols: (symbols: string[]) => {
			if (streamingService) {
				streamingService.unsubscribeFromSymbols(symbols);
			}
		},

		// Disconnect
		disconnect: () => {
			if (streamingService) {
				streamingService.disconnect();
			}
			update((state) => ({
				...state,
				connected: false,
				quotes: new Map()
			}));
		},

		// Clear error
		clearError: () => {
			update((state) => ({ ...state, error: null }));
		},

		// Get quote by symbol
		getQuote: (symbol: string, instrumentType: string = 'Equity'): StreamingQuote | null => {
			const state = get({ subscribe });
			const key = `${symbol}-${instrumentType}`;
			return state.quotes.get(key) || null;
		},

		// Merge streaming quotes with polling quotes
		mergeQuotes: (pollingQuotes: Map<string, Quote>): Map<string, Quote> => {
			const state = get({ subscribe });
			const merged = new Map(pollingQuotes);

			// If in streaming mode and connected, prefer streaming data
			if (state.mode === 'streaming' && state.connected) {
				state.quotes.forEach((streamingQuote, key) => {
					const existingQuote = merged.get(key);
					if (existingQuote) {
						// Merge streaming data with existing quote data
						merged.set(key, {
							...existingQuote,
							...streamingQuote,
							'updated-at': new Date(streamingQuote.timestamp || Date.now()).toISOString()
						});
					} else {
						// Add new streaming quote
						merged.set(key, {
							...streamingQuote,
							'updated-at': new Date(streamingQuote.timestamp || Date.now()).toISOString()
						});
					}
				});
			}

			return merged;
		}
	};

	return store;
}

export const streamingStore = createStreamingStore();

// Derived store for connection status
export const connectionStatus = derived(streamingStore, ($streaming) => ({
	connected: $streaming.connected,
	error: $streaming.error,
	mode: $streaming.mode
}));

// Derived store for quote count
export const quoteCount = derived(streamingStore, ($streaming) => $streaming.quotes.size);
