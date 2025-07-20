import type { TastytradeAuth } from './tastytrade';

export interface WatchlistEntry {
	symbol: string;
	'instrument-type'?: string;
	'order-index'?: number;
}

export interface Watchlist {
	name: string;
	'order-index'?: number;
	'group-name'?: string;
	'watchlist-entries'?: WatchlistEntry[];
}

export interface WatchlistResponse {
	data: {
		items: Watchlist[];
	};
	context: string;
}

export interface SingleWatchlistResponse {
	data: Watchlist;
	context: string;
}

export class WatchlistManager {
	private auth: TastytradeAuth;

	constructor(auth: TastytradeAuth) {
		this.auth = auth;
	}

	// GET /watchlists - Fetch all watchlists for an account
	async getAllWatchlists(): Promise<Watchlist[]> {
		try {
			const response = await this.auth.makeAuthenticatedRequest('/watchlists');

			if (!response.ok) {
				console.error('Failed to fetch watchlists:', response.status);
				return [];
			}

			const data: WatchlistResponse = await response.json();
			return data.data.items || [];
		} catch (error) {
			console.error('Error fetching watchlists:', error);
			return [];
		}
	}

	// GET /watchlists/{watchlist_name} - Retrieve a specific account watchlist
	async getWatchlist(name: string): Promise<Watchlist | null> {
		try {
			const response = await this.auth.makeAuthenticatedRequest(
				`/watchlists/${encodeURIComponent(name)}`
			);

			if (!response.ok) {
				console.error('Failed to fetch watchlist:', response.status);
				return null;
			}

			const data: SingleWatchlistResponse = await response.json();
			return data.data;
		} catch (error) {
			console.error('Error fetching watchlist:', error);
			return null;
		}
	}

	// POST /watchlists - Create a new account watchlist
	async createWatchlist(
		name: string,
		entries: WatchlistEntry[] = [],
		groupName = 'main',
		orderIndex?: number
	): Promise<Watchlist | null> {
		try {
			const watchlistData: Partial<Watchlist> = {
				name,
				'watchlist-entries': entries,
				'group-name': groupName
			};

			if (orderIndex !== undefined) {
				watchlistData['order-index'] = orderIndex;
			}

			const response = await this.auth.makeAuthenticatedRequest('/watchlists', {
				method: 'POST',
				body: JSON.stringify(watchlistData)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('Failed to create watchlist:', response.status, errorData);
				return null;
			}

			const data: SingleWatchlistResponse = await response.json();
			return data.data;
		} catch (error) {
			console.error('Error creating watchlist:', error);
			return null;
		}
	}

	// PUT /watchlists/{watchlist_name} - Replace entire watchlist properties
	async updateWatchlist(
		name: string,
		entries: WatchlistEntry[],
		groupName = 'main',
		orderIndex?: number
	): Promise<Watchlist | null> {
		try {
			const watchlistData: Partial<Watchlist> = {
				name,
				'watchlist-entries': entries,
				'group-name': groupName
			};

			if (orderIndex !== undefined) {
				watchlistData['order-index'] = orderIndex;
			}

			const response = await this.auth.makeAuthenticatedRequest(
				`/watchlists/${encodeURIComponent(name)}`,
				{
					method: 'PUT',
					body: JSON.stringify(watchlistData)
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('Failed to update watchlist:', response.status, errorData);
				return null;
			}

			const data: SingleWatchlistResponse = await response.json();
			return data.data;
		} catch (error) {
			console.error('Error updating watchlist:', error);
			return null;
		}
	}

	// DELETE /watchlists/{watchlist_name} - Remove a specific watchlist
	async deleteWatchlist(name: string): Promise<boolean> {
		try {
			const response = await this.auth.makeAuthenticatedRequest(
				`/watchlists/${encodeURIComponent(name)}`,
				{
					method: 'DELETE'
				}
			);

			if (!response.ok) {
				console.error('Failed to delete watchlist:', response.status);
				return false;
			}

			return true;
		} catch (error) {
			console.error('Error deleting watchlist:', error);
			return false;
		}
	}

	// Helper method to add a symbol to an existing watchlist
	async addSymbolToWatchlist(
		watchlistName: string,
		symbol: string,
		instrumentType = 'Equity'
	): Promise<boolean> {
		try {
			const watchlist = await this.getWatchlist(watchlistName);
			if (!watchlist) {
				return false;
			}

			// Initialize watchlist-entries if it doesn't exist
			const entries = watchlist['watchlist-entries'] || [];

			// Check if symbol already exists
			const existingEntry = entries.find(
				(entry) => entry.symbol === symbol && entry['instrument-type'] === instrumentType
			);

			if (existingEntry) {
				return true; // Already exists
			}

			// Add new entry
			const newEntry: WatchlistEntry = {
				symbol,
				'instrument-type': instrumentType,
				'order-index': entries.length
			};

			const updatedEntries = [...entries, newEntry];
			const result = await this.updateWatchlist(
				watchlistName,
				updatedEntries,
				watchlist['group-name'],
				watchlist['order-index']
			);

			return result !== null;
		} catch (error) {
			console.error('Error adding symbol to watchlist:', error);
			return false;
		}
	}

	// Helper method to remove a symbol from an existing watchlist
	async removeSymbolFromWatchlist(
		watchlistName: string,
		symbol: string,
		instrumentType = 'Equity'
	): Promise<boolean> {
		try {
			const watchlist = await this.getWatchlist(watchlistName);
			if (!watchlist) {
				return false;
			}

			// Initialize watchlist-entries if it doesn't exist
			const entries = watchlist['watchlist-entries'] || [];

			const updatedEntries = entries.filter(
				(entry) => !(entry.symbol === symbol && entry['instrument-type'] === instrumentType)
			);

			const result = await this.updateWatchlist(
				watchlistName,
				updatedEntries,
				watchlist['group-name'],
				watchlist['order-index']
			);

			return result !== null;
		} catch (error) {
			console.error('Error removing symbol from watchlist:', error);
			return false;
		}
	}
}
