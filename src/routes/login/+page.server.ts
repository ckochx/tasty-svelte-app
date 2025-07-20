import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const TASTYTRADE_API_BASE = 'https://api.cert.tastyworks.com';

interface TastytradeSessionResponse {
	data: {
		'session-token': string;
		'streamer-token': string;
		user: {
			email: string;
			username: string;
			'external-id': string;
		};
	};
	context: string;
}

// interface TastytradeOAuthResponse {
// 	access_token: string;
// 	refresh_token: string;
// 	token_type: string;
// 	expires_in: number;
// }

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username') as string;
		const password = data.get('password') as string;

		if (!username || !password) {
			return fail(400, {
				message: 'Username and password are required'
			});
		}

		try {
			// Step 1: Authenticate with Tastytrade to get session
			const sessionResponse = await fetch(`${TASTYTRADE_API_BASE}/sessions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'User-Agent': 'tasty-app/1.0'
				},
				body: JSON.stringify({
					login: username,
					password: password,
					'remember-me': false
				})
			});

			if (!sessionResponse.ok) {
				const errorData = await sessionResponse.json().catch(() => ({}));
				return fail(401, {
					message: errorData.error?.message || 'Invalid username or password'
				});
			}

			const sessionData: TastytradeSessionResponse = await sessionResponse.json();
			const sessionToken = sessionData.data['session-token'];

			// Step 2: Skip OAuth for now - requires client registration
			// Use session token directly (works immediately)

			// Set session cookie
			cookies.set('tastytrade_session', sessionToken, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 // 24 hours
			});

			// Store user info
			cookies.set('tastytrade_user', JSON.stringify(sessionData.data.user), {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'strict',
				maxAge: 60 * 60 * 24
			});
		} catch (error) {
			console.error('Authentication error:', error);
			return fail(500, {
				message: 'Authentication failed. Please try again.'
			});
		}

		// Redirect after successful authentication (outside try-catch)
		throw redirect(302, '/dashboard');
	}
};
