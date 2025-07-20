import type { TastytradeAuth } from './tastytrade';

export interface Quote {
	symbol: string;
	'instrument-type': string;
	'bid-price'?: number;
	'ask-price'?: number;
	'last-price'?: number;
	'bid-size'?: number;
	'ask-size'?: number;
	'day-high'?: number;
	'day-low'?: number;
	volume?: number;
	'net-change'?: number;
	'net-change-percent'?: number;
	'close-price'?: number;
	'open-price'?: number;
	'mark-price'?: number;
	'exchange-name'?: string;
	'last-size'?: number;
	'updated-at'?: string;
}

export interface MarketDataResponse {
	data: {
		items: Quote[];
	};
	context: string;
}

export interface QuoteToken {
	'api-quote-token': string;
	'dxlink-url': string;
	level: string;
	'token-type': string;
}

export interface QuoteTokenResponse {
	data: QuoteToken;
	context: string;
}

export class MarketDataManager {
	private auth: TastytradeAuth;

	constructor(auth: TastytradeAuth) {
		this.auth = auth;
	}

	// GET /api-quote-tokens - Get API quote token for streaming (24-hour validity)
	async getQuoteToken(): Promise<QuoteToken | null> {
		try {
			const response = await this.auth.makeAuthenticatedRequest('/api-quote-tokens');

			if (!response.ok) {
				console.error('Failed to fetch quote token:', response.status);
				return null;
			}

			const data: QuoteTokenResponse = await response.json();
			return data.data;
		} catch (error) {
			console.error('Error fetching quote token:', error);
			return null;
		}
	}

	// GET /market-data/by-type - Get market data for multiple symbols
	async getQuotes(
		symbolsWithTypes: Array<{ symbol: string; instrumentType: string }>
	): Promise<Quote[]> {
		if (symbolsWithTypes.length === 0) {
			return [];
		}

		// Limit to 100 symbols per API call
		const limitedSymbols = symbolsWithTypes.slice(0, 100);

		try {
			// Group symbols by instrument type for the API call
			const symbolsByType: Record<string, string[]> = {};

			limitedSymbols.forEach(({ symbol, instrumentType }) => {
				const apiType = this.mapInstrumentType(instrumentType);
				if (!symbolsByType[apiType]) {
					symbolsByType[apiType] = [];
				}
				symbolsByType[apiType].push(symbol);
			});

			// Build query parameters
			const params = new URLSearchParams();

			Object.entries(symbolsByType).forEach(([type, symbols]) => {
				symbols.forEach((symbol) => {
					params.append(type, symbol);
				});
			});

			const response = await this.auth.makeAuthenticatedRequest(
				`/market-data/by-type?${params.toString()}`
			);

			if (!response.ok) {
				console.error('Failed to fetch market data:', response.status);
				return [];
			}

			const data: MarketDataResponse = await response.json();

			return data.data.items || [];
		} catch (error) {
			console.error('Error fetching market data:', error);
			return [];
		}
	}

	// Helper method to get quotes for a single symbol
	async getQuote(symbol: string, instrumentType = 'Equity'): Promise<Quote | null> {
		const quotes = await this.getQuotes([{ symbol, instrumentType }]);
		return quotes.length > 0 ? quotes[0] : null;
	}

	// Map our instrument types to API parameter names
	private mapInstrumentType(instrumentType: string): string {
		switch (instrumentType) {
			case 'Equity':
				return 'equity';
			case 'Equity Option':
				return 'equity-option';
			case 'Future':
				return 'future';
			case 'Future Option':
				return 'future-option';
			case 'Cryptocurrency':
				return 'cryptocurrency';
			default:
				return 'equity'; // Default fallback
		}
	}

	// Helper to format price for display
	formatPrice(price: number | undefined): string {
		if (price === undefined || price === null || isNaN(price)) {
			return '--';
		}
		return price.toFixed(2);
	}

	// Helper to format price change with color coding
	formatPriceChange(
		change: number | undefined,
		changePercent: number | undefined
	): {
		value: string;
		colorClass: string;
	} {
		if (change === undefined || change === null) {
			return { value: '--', colorClass: 'text-gray-500' };
		}

		const formattedChange = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
		const formattedPercent =
			changePercent !== undefined
				? ` (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
				: '';

		return {
			value: `${formattedChange}${formattedPercent}`,
			colorClass: change >= 0 ? 'text-green-600' : 'text-red-600'
		};
	}

	// Helper to get bid-ask spread
	getBidAskSpread(
		bidPrice: number | undefined,
		askPrice: number | undefined
	): {
		spread: string;
		midPoint: string;
	} {
		if (bidPrice === undefined || askPrice === undefined) {
			return { spread: '--', midPoint: '--' };
		}

		const spread = askPrice - bidPrice;
		const midPoint = (askPrice + bidPrice) / 2;

		return {
			spread: spread.toFixed(2),
			midPoint: midPoint.toFixed(2)
		};
	}

	// Check if market is open (enhanced check with proper market hours)
	isMarketOpen(): boolean {
		const now = new Date();

		// Convert to Eastern Time (market timezone)
		const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
		const day = easternTime.getDay(); // 0 = Sunday, 6 = Saturday
		const hour = easternTime.getHours();
		const minute = easternTime.getMinutes();

		// Weekend check
		if (day === 0 || day === 6) {
			return false;
		}

		// Market hours: 9:30 AM - 4:00 PM ET (Monday-Friday)
		const marketOpen = hour > 9 || (hour === 9 && minute >= 30);
		const marketClosed = hour >= 16;

		return marketOpen && !marketClosed;
	}

	// Get market status message
	getMarketStatusMessage(): string {
		const now = new Date();
		const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
		const day = easternTime.getDay();
		const hour = easternTime.getHours();
		const minute = easternTime.getMinutes();

		if (this.isMarketOpen()) {
			return 'Market Open';
		} else {
			// Weekend
			if (day === 0 || day === 6) {
				return 'Market Closed - Weekend';
			}
			// Before market open
			if (hour < 9 || (hour === 9 && minute < 30)) {
				return 'Market Closed - Pre-Market';
			}
			// After market close
			if (hour >= 16) {
				return 'Market Closed - After Hours';
			}
			return 'Market Closed';
		}
	}

	// Get last update timestamp for quotes
	getLastUpdateMessage(updatedAt: string | undefined): string {
		if (!updatedAt) {
			return '';
		}

		const updateTime = new Date(updatedAt);
		const now = new Date();
		const diffMs = now.getTime() - updateTime.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));

		if (diffMins < 1) {
			return 'Updated just now';
		} else if (diffMins < 60) {
			return `Updated ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
		} else {
			return `Last updated: ${updateTime.toLocaleTimeString()}`;
		}
	}
}
