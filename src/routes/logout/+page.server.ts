import { redirect } from '@sveltejs/kit';
import { TastytradeAuth } from '$lib/server/tastytrade';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies }) => {
		const auth = new TastytradeAuth(cookies);
		auth.logout();
		throw redirect(302, '/login');
	}
};
