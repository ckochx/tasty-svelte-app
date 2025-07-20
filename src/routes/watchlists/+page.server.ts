import { redirect, fail } from '@sveltejs/kit';
import { TastytradeAuth } from '$lib/server/tastytrade';
import { WatchlistManager } from '$lib/server/watchlists';
import { MarketDataManager } from '$lib/server/market-data';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const auth = new TastytradeAuth(cookies);

	if (!auth.isAuthenticated()) {
		throw redirect(302, '/login');
	}

	const watchlistManager = new WatchlistManager(auth);
	const marketDataManager = new MarketDataManager(auth);
	const tokens = auth.getTokens();

	try {
		const watchlists = await watchlistManager.getAllWatchlists();

		// Collect all unique symbols from all watchlists
		const allSymbols: Array<{ symbol: string; instrumentType: string }> = [];
		const symbolSet = new Set<string>();

		watchlists.forEach((watchlist) => {
			const entries = watchlist['watchlist-entries'] || [];
			entries.forEach((entry) => {
				const key = `${entry.symbol}-${entry['instrument-type']}`;
				if (!symbolSet.has(key)) {
					symbolSet.add(key);
					allSymbols.push({
						symbol: entry.symbol,
						instrumentType: entry['instrument-type'] || 'Equity'
					});
				}
			});
		});

		// Fetch market data for all symbols
		const quotes = await marketDataManager.getQuotes(allSymbols);

		// Create a map for quick lookup
		const quotesMap = new Map(
			quotes.map((quote) => [`${quote.symbol}-${quote['instrument-type']}`, quote])
		);

		return {
			user: tokens.user,
			watchlists,
			quotes: quotesMap,
			marketStatus: marketDataManager.getMarketStatusMessage(),
			success: true
		};
	} catch (error) {
		console.error('Error loading watchlists:', error);
		return {
			user: tokens.user,
			watchlists: [],
			quotes: new Map(),
			marketStatus: 'Unknown',
			error: 'Failed to load watchlists'
		};
	}
};

export const actions: Actions = {
	// Create new watchlist
	create: async ({ request, cookies }) => {
		const auth = new TastytradeAuth(cookies);

		if (!auth.isAuthenticated()) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const name = data.get('name') as string;
		const groupName = (data.get('groupName') as string) || 'main';

		if (!name || name.trim().length === 0) {
			return fail(400, {
				error: 'Watchlist name is required'
			});
		}

		const watchlistManager = new WatchlistManager(auth);

		try {
			const result = await watchlistManager.createWatchlist(name.trim(), [], groupName);

			if (result) {
				return {
					success: true,
					message: `Watchlist "${name}" created successfully`
				};
			} else {
				return fail(500, {
					error: 'Failed to create watchlist'
				});
			}
		} catch (error) {
			console.error('Error creating watchlist:', error);
			return fail(500, {
				error: 'Failed to create watchlist'
			});
		}
	},

	// Delete watchlist
	delete: async ({ request, cookies }) => {
		const auth = new TastytradeAuth(cookies);

		if (!auth.isAuthenticated()) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const name = data.get('name') as string;

		if (!name) {
			return fail(400, {
				error: 'Watchlist name is required'
			});
		}

		const watchlistManager = new WatchlistManager(auth);

		try {
			const result = await watchlistManager.deleteWatchlist(name);

			if (result) {
				return {
					success: true,
					message: `Watchlist "${name}" deleted successfully`
				};
			} else {
				return fail(500, {
					error: 'Failed to delete watchlist'
				});
			}
		} catch (error) {
			console.error('Error deleting watchlist:', error);
			return fail(500, {
				error: 'Failed to delete watchlist'
			});
		}
	},

	// Add symbol to watchlist
	addSymbol: async ({ request, cookies }) => {
		const auth = new TastytradeAuth(cookies);

		if (!auth.isAuthenticated()) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const watchlistName = data.get('watchlistName') as string;
		const symbol = data.get('symbol') as string;
		const instrumentType = (data.get('instrumentType') as string) || 'Equity';

		if (!watchlistName || !symbol) {
			return fail(400, {
				error: 'Watchlist name and symbol are required'
			});
		}

		const watchlistManager = new WatchlistManager(auth);

		try {
			const result = await watchlistManager.addSymbolToWatchlist(
				watchlistName,
				symbol.toUpperCase(),
				instrumentType
			);

			if (result) {
				return {
					success: true,
					message: `Symbol "${symbol.toUpperCase()}" added to watchlist "${watchlistName}"`
				};
			} else {
				return fail(500, {
					error: 'Failed to add symbol to watchlist'
				});
			}
		} catch (error) {
			console.error('Error adding symbol to watchlist:', error);
			return fail(500, {
				error: 'Failed to add symbol to watchlist'
			});
		}
	},

	// Remove symbol from watchlist
	removeSymbol: async ({ request, cookies }) => {
		const auth = new TastytradeAuth(cookies);

		if (!auth.isAuthenticated()) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const watchlistName = data.get('watchlistName') as string;
		const symbol = data.get('symbol') as string;
		const instrumentType = (data.get('instrumentType') as string) || 'Equity';

		if (!watchlistName || !symbol) {
			return fail(400, {
				error: 'Watchlist name and symbol are required'
			});
		}

		const watchlistManager = new WatchlistManager(auth);

		try {
			const result = await watchlistManager.removeSymbolFromWatchlist(
				watchlistName,
				symbol,
				instrumentType
			);

			if (result) {
				return {
					success: true,
					message: `Symbol "${symbol}" removed from watchlist "${watchlistName}"`
				};
			} else {
				return fail(500, {
					error: 'Failed to remove symbol from watchlist'
				});
			}
		} catch (error) {
			console.error('Error removing symbol from watchlist:', error);
			return fail(500, {
				error: 'Failed to remove symbol from watchlist'
			});
		}
	}
};
