import { json, redirect } from '@sveltejs/kit';
import { TastytradeAuth } from '$lib/server/tastytrade';
import { MarketDataManager } from '$lib/server/market-data';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const auth = new TastytradeAuth(cookies);

	if (!auth.isAuthenticated()) {
		throw redirect(302, '/login');
	}

	try {
		const marketDataManager = new MarketDataManager(auth);
		const quoteToken = await marketDataManager.getQuoteToken();

		if (!quoteToken) {
			return json({ error: 'Failed to fetch quote token' }, { status: 500 });
		}

		return json({
			success: true,
			data: quoteToken
		});
	} catch (error) {
		console.error('Error fetching quote token:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
