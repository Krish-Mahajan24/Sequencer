# Vercel deployment

The `sequencer` project in `krish-mahajan24` deploys the repository root using
the Express preset. `server.js` exports the API. The build copies only
`frontend/` into `public/` so Vercel can serve the site through its CDN.
Both `/` and `/frontend/` expose the web app; API calls use the same origin.

`vercel.json` installs the locked backend dependencies and runs the static build.
MongoDB connections are shared across concurrent requests and reused within
each warm function instance. Local development still uses `npm start`.

## Production environment

Save these values in the Vercel project's Production environment. Never put
database passwords, client secrets, or JWT secrets in Git or frontend files.

- `MONGODB_URI` (or `MONGO_URI`): existing MongoDB Atlas connection string.
- `MONGO_DB_NAME`: optional; defaults to the URI database or `sequencer`.
- `JWT_SECRET`: strong server-only signing secret.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- `NODE_ENV=production`.
- `APP_URL=https://sequencer-sable.vercel.app`.
- `BACKEND_URL=https://sequencer-sable.vercel.app`.

Allow the deployment to reach Atlas using the database's network settings.
The health endpoint `/api/health` must return `200` and `database: Connected`.

## Provider callbacks

Keep local callbacks when using the same Google OAuth app for development.
Add this authorized redirect URI to its Google Cloud OAuth web client:

`https://sequencer-sable.vercel.app/api/auth/google/callback`

Set the GitHub OAuth app's homepage URL to the production origin and its
authorization callback URL to:

`https://sequencer-sable.vercel.app/api/auth/github/callback`

GitHub OAuth apps have one callback setting; use a separate app for local
development if necessary. Changing Vercel variables requires a new deployment.

## Verification

Run the database and OAuth integration tests locally. To exercise the deployed
CRUD API with a temporary test account that the script cleans up:

```sh
API_TEST_BASE=https://sequencer-sable.vercel.app/api node backend/test/crud-live.cjs
```

Also verify both social sign-in flows through the deployed site's sign-in
buttons, including the final return to the authenticated web app. Provider
redirects alone do not verify successful OAuth login.
