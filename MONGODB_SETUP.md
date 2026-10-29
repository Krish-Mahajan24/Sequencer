# Connect Sequencer to MongoDB Atlas

The application uses the Express API for accounts, profiles, passwords, tracks, playlists, sequences, and play history. MongoDB is the persistent source of data. The browser keeps a cache and a retry queue for interrupted saves; a failed database save displays an error rather than silently succeeding locally.

1. Create an Atlas cluster and a database user with read/write access to the `sequencer` database.
2. In Atlas Network Access, allow the IP address of the machine running the backend. For a hosted backend, configure access for that host.
3. Copy the cluster's connection string for a Node.js application.
4. Set `MONGO_URI` in `backend/.env`, replacing the username, password, and cluster hostname. Use `/sequencer` as the database path. If the URI omits a database name, the backend defaults to `sequencer`; `MONGO_DB_NAME` can override it. URL-encode special characters in the password.
5. Set `JWT_SECRET` to a private random value. Keep `.env` out of source control.
6. Restart the backend from the project directory with `npm start`.
7. Open `http://localhost:5050/api/health`. It must return HTTP 200 and `"database":"Connected"`. An unavailable database returns HTTP 503.
8. Open `http://localhost:5050/frontend/signup.html` and create an account. Accounts that existed only in browser storage must be registered in MongoDB; their old data is not automatically imported.
9. Save a track, playlist, or sequence, wait for “Saved to database”, and reload. In Atlas, inspect the `sequencer` database's `users`, `tracks`, `playlists`, `sequences`, and `histories` collections.

For a deployed application, set `MONGO_URI` and `JWT_SECRET` in the backend host's environment and restart/redeploy it. Pages served under `/frontend/` use the same host's `/api`; separately hosted pages use `DEPLOYED_API_URL` in `js/config.js` (and its copy under `frontend/js/`).

## Verification

A real MongoDB integration test is included. Run against a dedicated test database:

```sh
MONGO_TEST_URI=mongodb://127.0.0.1:27017/sequencer_integration_test node backend/test/mongodb.integration.cjs
```

The test creates and removes its own accounts. It checks authentication, profile/password updates, all four music collections, stable IDs, saved sequence fields, user isolation, empty collections, and preservation of existing tracks when a replacement fails validation.
