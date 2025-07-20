import { redirect, fail, error } from '@sveltejs/kit';
import { TastytradeAuth } from '$lib/server/tastytrade';
import { WatchlistManager } from '$lib/server/watchlists';
import { MarketDataManager } from '$lib/server/market-data';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const auth = new TastytradeAuth(cookies);

	if (!auth.isAuthenticated()) {
		throw redirect(302, '/login');
	}

	const watchlistName = params.name;
	const watchlistManager = new WatchlistManager(auth);
	const marketDataManager = new MarketDataManager(auth);
	const tokens = auth.getTokens();

	try {
		const watchlist = await watchlistManager.getWatchlist(watchlistName);

		if (!watchlist) {
			throw error(404, 'Watchlist not found');
		}

		// Get market data for all symbols in this watchlist
		const entries = watchlist['watchlist-entries'] || [];
		const symbols = entries.map((entry) => ({
			symbol: entry.symbol,
			instrumentType: entry['instrument-type'] || 'Equity'
		}));

		const quotes = await marketDataManager.getQuotes(symbols);

		// Create a map for quick lookup
		const quotesMap = new Map(
			quotes.map((quote) => [`${quote.symbol}-${quote['instrument-type']}`, quote])
		);

		return {
			user: tokens.user,
			watchlist,
			watchlistName,
			quotes: quotesMap,
			marketStatus: marketDataManager.getMarketStatusMessage()
		};
	} catch (err) {
		if (err instanceof Response) {
			throw err;
		}
		console.error('Error loading watchlist:', err);
		throw error(500, 'Failed to load watchlist');
	}
};

export const actions: Actions = {
	// Update watchlist metadata
	update: async ({ params, request, cookies }) => {
		const auth = new TastytradeAuth(cookies);

		if (!auth.isAuthenticated()) {
			throw redirect(302, '/login');
		}

		const watchlistName = params.name;
		const data = await request.formData();
		const newName = data.get('name') as string;
		const groupName = (data.get('groupName') as string) || 'main';

		if (!newName || newName.trim().length === 0) {
			return fail(400, {
				error: 'Watchlist name is required'
			});
		}

		const watchlistManager = new WatchlistManager(auth);

		try {
			// Get current watchlist
			const currentWatchlist = await watchlistManager.getWatchlist(watchlistName);
			if (!currentWatchlist) {
				return fail(404, {
					error: 'Watchlist not found'
				});
			}

			// If name changed, need to delete old and create new
			if (newName.trim() !== watchlistName) {
				const createResult = await watchlistManager.createWatchlist(
					newName.trim(),
					currentWatchlist['watchlist-entries'] || [],
					groupName,
					currentWatchlist['order-index']
				);

				if (createResult) {
					await watchlistManager.deleteWatchlist(watchlistName);
					throw redirect(302, `/watchlists/${encodeURIComponent(newName.trim())}`);
				} else {
					return fail(500, {
						error: 'Failed to update watchlist'
					});
				}
			} else {
				// Just update group
				const result = await watchlistManager.updateWatchlist(
					watchlistName,
					currentWatchlist['watchlist-entries'] || [],
					groupName,
					currentWatchlist['order-index']
				);

				if (result) {
					return {
						success: true,
						message: 'Watchlist updated successfully'
					};
				} else {
					return fail(500, {
						error: 'Failed to update watchlist'
					});
				}
			}
		} catch (error) {
			if (error instanceof Response) {
				throw error;
			}
			console.error('Error updating watchlist:', error);
			return fail(500, {
				error: 'Failed to update watchlist'
			});
		}
	},

	// Add symbol to watchlist
	addSymbol: async ({ params, request, cookies }) => {
		const auth = new TastytradeAuth(cookies);

		if (!auth.isAuthenticated()) {
			throw redirect(302, '/login');
		}

		const watchlistName = params.name;
		const data = await request.formData();
		const symbol = data.get('symbol') as string;
		const instrumentType = (data.get('instrumentType') as string) || 'Equity';

		if (!symbol) {
			return fail(400, {
				error: 'Symbol is required'
			});
		}

		const watchlistManager = new WatchlistManager(auth);

		try {
			const result = await watchlistManager.addSymbolToWatchlist(
				watchlistName,
				symbol.toUpperCase().trim(),
				instrumentType
			);

			if (result) {
				return {
					success: true,
					message: `Symbol "${symbol.toUpperCase()}" added successfully`
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
	removeSymbol: async ({ params, request, cookies }) => {
		const auth = new TastytradeAuth(cookies);

		if (!auth.isAuthenticated()) {
			throw redirect(302, '/login');
		}

		const watchlistName = params.name;
		const data = await request.formData();
		const symbol = data.get('symbol') as string;
		const instrumentType = (data.get('instrumentType') as string) || 'Equity';

		if (!symbol) {
			return fail(400, {
				error: 'Symbol is required'
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
					message: `Symbol "${symbol}" removed successfully`
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
	},

	// Delete entire watchlist
	delete: async ({ params, cookies }) => {
		const auth = new TastytradeAuth(cookies);

		if (!auth.isAuthenticated()) {
			throw redirect(302, '/login');
		}

		const watchlistName = params.name;
		const watchlistManager = new WatchlistManager(auth);

		try {
			const result = await watchlistManager.deleteWatchlist(watchlistName);

			if (result) {
				throw redirect(302, '/watchlists');
			} else {
				return fail(500, {
					error: 'Failed to delete watchlist'
				});
			}
		} catch (error) {
			if (error instanceof Response) {
				throw error;
			}
			console.error('Error deleting watchlist:', error);
			return fail(500, {
				error: 'Failed to delete watchlist'
			});
		}
	}
};
