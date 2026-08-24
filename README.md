# Sequencer

A mood-transition playlist ordering tool. Tag each track's tempo, energy, and
mood and Sequencer maps the distance between every pair of songs and threads
the smoothest possible route through your library.

This is a **fully static, frontend-only** project — plain HTML, CSS, and
vanilla JavaScript. There is no backend, no build step, and no server to run.
It can be deployed as-is to GitHub Pages, Vercel, or any static host.

## Project structure

```
Sequencer/
├── index.html          Home page
├── about.html           About page
├── library.html         Your saved tracks, playlists & sequences
├── sequence.html        The sequencing engine (tag tracks, build a flow)
├── auth.html             Sign in
├── signup.html           Create an account
├── profile.html         Account details, security, playlists, history
│
├── assets/
│   ├── img/                     photos used across the site
│   ├── home-songs-bg.svg        background artwork
│   └── about-bg.mp4             hero background video (About page)
│
├── css/
│   ├── style.css        shared site styles (home, library, nav, footer…)
│   ├── about.css         About page styles
│   ├── auth.css           sign in / sign up styles
│   └── profile.css       profile page styles
│
├── js/
│   ├── app.js            shared interactions (scroll reveal, nav, back-to-top)
│   ├── about.js           About page hero video + mobile menu
│   ├── auth.js             sign in / sign up logic (localStorage)
│   ├── site-auth.js       nav auth state, profile menu, route guarding
│   ├── user-store.js     small helper for reading/writing per-user data
│   ├── profile.js         profile page logic (details, password, danger zone)
│   ├── library.js         library page (liked songs, playlists, sequences)
│   └── sequence.js        the sequencing engine + track tagging UI
│
└── README.md
```

## Data storage

There is no backend and no database. Everything the app needs to remember is
kept in the browser's `localStorage`:

| Data                                   | Key pattern                          | Managed by                          |
|-----------------------------------------|----------------------------------------|----------------------------------------|
| Registered accounts (name, email, salted/hashed password) | `sequencer_users_v1` | `js/auth.js`, `js/profile.js` |
| Current signed-in session                | `sequencer_current_user_v1`           | `js/auth.js`, `js/site-auth.js`, `js/profile.js` |
| Per-user library data (tracks, playlists, sequences, liked songs, history) | `sequencer_<name>_<userId>` | `js/user-store.js`, `js/library.js`, `js/sequence.js`, `js/profile.js` |

Passwords are never stored in plain text — they're salted and hashed in the
browser with PBKDF2 (Web Crypto `SubtleCrypto`) before being written to
`localStorage`.

`library.html` and `sequence.html` are treated as protected pages: if there's
no active session, `js/site-auth.js` redirects visitors to `auth.html` and
returns them to the page they wanted after signing in.

Note: because this is `localStorage`-based, accounts and library data are
local to a single browser and device — there's no sync between browsers or
devices, and clearing site data will remove them.

## External APIs

A couple of features call **public, third-party APIs directly from the
browser** — these are not part of this project's backend (there isn't one)
and require no configuration:

- `library.js` looks up artist photos via the public Wikipedia API.
- `sequence.js` looks up song metadata/artwork via the public iTunes Search API.

## Running locally

No build step or install is required. Any static file server works, for
example:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed local URL in your browser. Opening `index.html`
directly via `file://` also works for most pages, though a local server is
recommended for consistent behavior.

## Deploying

### GitHub Pages

1. Push this repository (with `index.html` at the repo root) to GitHub.
2. In the repo settings, enable GitHub Pages for the branch/folder containing
   these files (e.g. `main` / root, or a `docs/` folder if you prefer).
3. That's it — no build step, no Node.js, no server process required.

All internal links and asset paths use relative URLs (`./css/...`,
`./js/...`, `./assets/...`, and page-to-page links like `library.html`), so
the site works correctly whether it's served from a domain root
(`https://username.github.io/`) or a repository sub-path
(`https://username.github.io/Sequencer/`).

### Vercel

1. Import this repository into Vercel.
2. Framework preset: **Other** (no build command, no output directory
   override needed — the project is already static).
3. Deploy. No environment variables or serverless functions are needed.

## What changed from the original project

- Removed the Node.js/Express backend (`server/` folder, `server/server.js`,
  `server/package.json`, `server/data/users.json`) — none of it was actually
  in use, since authentication already ran entirely on the client using
  `localStorage`.
- Removed the root-level `package.json`, whose only script (`node
  server/server.js`) pointed at the now-removed backend. The project needs no
  dependencies and no `npm install`/`npm start` to run.
- Moved all pages out of `templates/` into the project root so `index.html`
  sits at the root, as required by GitHub Pages/Vercel.
- Rewrote every page's CSS/JS/image reference from `../css/...`,
  `../js/...`, `../assets/...` to `./css/...`, `./js/...`, `./assets/...` to
  match the new flat root layout.
- Removed unused files: `assets/file.mp4` (not referenced anywhere) and
  stray `.DS_Store` files.
- No UI, styling, animations, or functionality were changed — only file
  locations, paths, and the removal of the unused backend.
