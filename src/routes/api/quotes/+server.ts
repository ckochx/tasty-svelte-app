import { json, redirect } from '@sveltejs/kit';
import { TastytradeAuth } from '$lib/server/tastytrade';
import { MarketDataManager } from '$lib/server/market-data';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const auth = new TastytradeAuth(cookies);

	if (!auth.isAuthenticated()) {
		throw redirect(302, '/login');
	}

	try {
		const body = await request.json();
		const { symbols } = body;

		if (!Array.isArray(symbols)) {
			return json({ error: 'Invalid symbols format' }, { status: 400 });
		}

		const marketDataManager = new MarketDataManager(auth);
		const quotes = await marketDataManager.getQuotes(symbols);

		return json({
			success: true,
			quotes
		});
	} catch (error) {
		console.error('Error fetching quotes:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
