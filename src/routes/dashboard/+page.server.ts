import { redirect } from '@sveltejs/kit';
import { TastytradeAuth } from '$lib/server/tastytrade';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const auth = new TastytradeAuth(cookies);

	if (!auth.isAuthenticated()) {
		throw redirect(302, '/login');
	}

	const tokens = auth.getTokens();

	try {
		// Test API call to get user's accounts
		const response = await auth.makeAuthenticatedRequest('/customers/me/accounts');

		if (response.ok) {
			const accountsData = await response.json();
			return {
				user: tokens.user,
				accounts: accountsData.data?.items || [],
				authenticated: true
			};
		} else {
			console.error('Failed to fetch accounts:', response.status);
			return {
				user: tokens.user,
				accounts: [],
				authenticated: true,
				error: 'Failed to fetch account data'
			};
		}
	} catch (error) {
		console.error('Error fetching accounts:', error);
		return {
			user: tokens.user,
			accounts: [],
			authenticated: true,
			error: 'Failed to connect to Tastytrade API'
		};
	}
};
