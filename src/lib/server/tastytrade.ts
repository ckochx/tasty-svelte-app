import type { Cookies } from '@sveltejs/kit';

const TASTYTRADE_API_BASE = 'https://api.cert.tastyworks.com';

export interface TastytradeUser {
	email: string;
	username: string;
	'external-id': string;
}

export interface TastytradeTokens {
	accessToken?: string;
	refreshToken?: string;
	sessionToken?: string;
	user?: TastytradeUser;
}

export class TastytradeAuth {
	private cookies: Cookies;

	constructor(cookies: Cookies) {
		this.cookies = cookies;
	}

	getTokens(): TastytradeTokens {
		const accessToken = this.cookies.get('tastytrade_access_token');
		const refreshToken = this.cookies.get('tastytrade_refresh_token');
		const sessionToken = this.cookies.get('tastytrade_session');
		const userJson = this.cookies.get('tastytrade_user');

		let user: TastytradeUser | undefined;
		if (userJson) {
			try {
				user = JSON.parse(userJson);
			} catch (e) {
				console.error('Failed to parse user data:', e);
			}
		}

		return {
			accessToken,
			refreshToken,
			sessionToken,
			user
		};
	}

	async refreshAccessToken(): Promise<string | null> {
		const { refreshToken } = this.getTokens();

		if (!refreshToken) {
			return null;
		}

		try {
			const response = await fetch(`${TASTYTRADE_API_BASE}/oauth/token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'User-Agent': 'tasty-app/1.0'
				},
				body: JSON.stringify({
					grant_type: 'refresh_token',
					refresh_token: refreshToken
				})
			});

			if (!response.ok) {
				console.error('Failed to refresh token:', response.status);
				return null;
			}

			const data = await response.json();

			// Update cookies with new tokens
			this.cookies.set('tastytrade_access_token', data.access_token, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'strict',
				maxAge: data.expires_in
			});

			if (data.refresh_token) {
				this.cookies.set('tastytrade_refresh_token', data.refresh_token, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'strict',
					maxAge: 60 * 60 * 24 * 30 // 30 days
				});
			}

			return data.access_token;
		} catch (error) {
			console.error('Error refreshing token:', error);
			return null;
		}
	}

	async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
		const { accessToken, sessionToken } = this.getTokens();

		let authHeader = '';
		if (accessToken) {
			authHeader = `Bearer ${accessToken}`;
		} else if (sessionToken) {
			authHeader = sessionToken;
		} else {
			throw new Error('No authentication token available');
		}

		const response = await fetch(`${TASTYTRADE_API_BASE}${endpoint}`, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'User-Agent': 'tasty-app/1.0',
				Authorization: authHeader,
				...options.headers
			}
		});

		// If we get a 401 and have a refresh token, try to refresh
		if (response.status === 401 && accessToken) {
			const newToken = await this.refreshAccessToken();
			if (newToken) {
				// Retry the request with the new token
				return fetch(`${TASTYTRADE_API_BASE}${endpoint}`, {
					...options,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						'User-Agent': 'tasty-app/1.0',
						Authorization: `Bearer ${newToken}`,
						...options.headers
					}
				});
			}
		}

		return response;
	}

	logout(): void {
		this.cookies.delete('tastytrade_access_token', { path: '/' });
		this.cookies.delete('tastytrade_refresh_token', { path: '/' });
		this.cookies.delete('tastytrade_session', { path: '/' });
		this.cookies.delete('tastytrade_user', { path: '/' });
	}

	isAuthenticated(): boolean {
		const { accessToken, sessionToken } = this.getTokens();
		return !!(accessToken || sessionToken);
	}
}
