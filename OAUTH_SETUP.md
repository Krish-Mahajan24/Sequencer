# Google and GitHub sign-in

Set these values in `backend/.env` (never in browser JavaScript):

```dotenv
APP_URL=http://localhost:5050/frontend
BACKEND_URL=http://localhost:5050
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

Register these exact redirect URLs with the providers:

- Google authorized redirect URI: `http://localhost:5050/api/auth/google/callback`
- GitHub authorization callback URL: `http://localhost:5050/api/auth/github/callback`
- GitHub homepage URL: `http://localhost:5050/frontend/index.html`

Open `http://localhost:5050/frontend/auth.html` (or signup.html) and click Google or GitHub. Use this frontend address consistently: the callback must return to the same browser origin where sign-in began. If you host the frontend separately, set APP_URL to that frontend's base URL and configure its API URL accordingly. Production APP_URL and BACKEND_URL must use HTTPS. Update registered callbacks to match BACKEND_URL.

Restart the backend after changing `.env`. If Google consent is in testing mode, your account must be in its test-user list.

The backend exchanges authorization codes with PKCE, validates a signed HttpOnly state cookie, requires a verified provider email, and stores the provider's stable user ID on the MongoDB user. Provider access tokens and client secrets are never saved in browser storage. A one-use, one-minute, browser-bound MongoDB ticket completes the existing application login session. Local email/password sign-in continues to work.

Existing accounts with the same verified provider email are automatically reused. Only the provider ID is attached to the existing user document; its ID, name, password, and music collections remain unchanged. Email/password sign-in continues to work. Social-only accounts use their provider for sign-in; the password-change form requires an existing local password.

Provider references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) and [GitHub OAuth authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
