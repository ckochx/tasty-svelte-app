# Tastytrade OAuth2 Setup Guide

## Current Status

The app currently uses **session tokens** which work immediately with your Tastytrade sandbox credentials. Session tokens are valid for 24 hours.

## To Enable OAuth2 (Future)

### 1. Register OAuth Client

- Visit [Tastytrade Developer Portal](https://developer.tastytrade.com)
- Register your application to get:
  - `client_id`
  - `client_secret`
  - OAuth scopes

### 2. Update Environment Variables

Add to your `.env` file:

```bash
TASTYTRADE_CLIENT_ID=your_client_id
TASTYTRADE_CLIENT_SECRET=your_client_secret
```

### 3. Enable OAuth in Code

In `src/routes/login/+page.server.ts`:

- Change `useOAuth = false` to `useOAuth = true`
- Update OAuth request to include client credentials

### 4. Update OAuth Request

```typescript
body: JSON.stringify({
	grant_type: 'authorization_code', // or 'client_credentials'
	client_id: process.env.TASTYTRADE_CLIENT_ID,
	client_secret: process.env.TASTYTRADE_CLIENT_SECRET
	// ... other required fields
});
```

## Benefits of OAuth2

- **Shorter token lifetime** (15 minutes) with automatic refresh
- **Better security** with refresh tokens
- **Standard OAuth2 flow**
- **Future-proof** (session tokens will be deprecated)

## Current Benefits of Session Tokens

- **Works immediately** without registration
- **Simple implementation**
- **24-hour token lifetime**
- **Full API access** with sandbox account
