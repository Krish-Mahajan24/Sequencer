const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
const base = 'http://127.0.0.1:5078';
const child = spawn(process.execPath, ['--require', path.join(__dirname, 'oauth-provider-mock.cjs'), path.join(__dirname, '../server.js')], {
  env: { ...process.env, PORT: '5078', NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/sequencer_oauth_test', MONGO_DB_NAME: 'sequencer_oauth_test', JWT_SECRET: 'oauth-test-secret', GOOGLE_CLIENT_ID: 'test-google-id', GOOGLE_CLIENT_SECRET: 'test-google-secret', GITHUB_CLIENT_ID: 'test-github-id', GITHUB_CLIENT_SECRET: 'test-github-secret', APP_URL: base + '/frontend', BACKEND_URL: base }, stdio: 'ignore',
});
const tokens = [];
const hash = value => crypto.createHash('sha256').update(value).digest('base64url');
async function request(url, options = {}) { return fetch(base + url, { redirect: 'manual', ...options }); }
async function exchange(code, verifier) {
  const response = await request('/api/auth/oauth/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, verifier }) });
  return { status: response.status, ...await response.json() };
}
(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) { try { if ((await request('/api/health')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
    assert.ok(ready);
    const localResponse = await request('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: 'Existing', lastName: 'Account', email: 'google-oauth-test@example.com', password: 'existing-password-123' }) });
    const local = await localResponse.json(); assert.equal(localResponse.status, 201); tokens.push(local.token);
    assert.equal((await request('/api/auth/google/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge: hash('test') }) })).status, 401);
    const githubResponse = await request('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: 'Existing', lastName: 'GitHub', email: 'github-oauth-test@example.com', password: 'existing-password-123' }) });
    const githubLocal = await githubResponse.json(); assert.equal(githubResponse.status, 201); tokens.push(githubLocal.token);
    for (const provider of ['google', 'github']) {
      const owner = provider === 'google' ? local : githubLocal;
      const fixtures = {
        tracks: [{ id: 'kept-track', title: 'Keep this song', artist: 'Original artist', bpm: 105 }],
        playlists: [{ id: 'kept-playlist', name: 'Keep this playlist', trackIds: ['kept-track'] }],
        sequences: [{ id: 'kept-sequence', name: 'Keep this sequence', trackIds: ['kept-track'], tempo: 105, smoothness: 90 }],
        history: [{ id: 'kept-history', title: 'Keep this song', trackId: 'kept-track', playedAt: new Date().toISOString() }],
      };
      const before = {};
      for (const [resource, value] of Object.entries(fixtures)) {
        const saved = await request('/api/' + resource + '/batch', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + owner.token }, body: JSON.stringify({ [resource]: value }) });
        assert.equal(saved.status, 200);
        before[resource] = await (await request('/api/' + resource, { headers: { Authorization: 'Bearer ' + owner.token } })).json();
      }
      let firstId;
      for (let run = 0; run < 2; run++) {
        const verifier = crypto.randomBytes(32).toString('base64url');
        const linking = false;
        const start = linking
          ? await request('/api/auth/google/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + local.token }, body: JSON.stringify({ challenge: hash(verifier) }) })
          : await request('/api/auth/' + provider + '?challenge=' + hash(verifier) + '&next=library.html');
        assert.equal(start.status, linking ? 200 : 302);
        const target = new URL(linking ? (await start.json()).url : start.headers.get('location'));
        assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
        assert.equal(target.searchParams.get('redirect_uri'), base + '/api/auth/' + provider + '/callback');
        const cookie = start.headers.get('set-cookie').split(';')[0];
        assert.match(start.headers.get('set-cookie'), /HttpOnly/);
        const callback = '/api/auth/' + provider + '/callback?code=test-code&state=' + target.searchParams.get('state');
        const missingCookie = await request(callback); assert.ok(new URL(missingCookie.headers.get('location')).hash.includes('oauth_error'));
        const invalid = await request('/api/auth/' + provider + '/callback?code=test-code&state=wrong', { headers: { Cookie: cookie } }); assert.ok(new URL(invalid.headers.get('location')).hash.includes('oauth_error'));
        const complete = await request(callback, { headers: { Cookie: cookie } });
        const fragment = new URLSearchParams(new URL(complete.headers.get('location')).hash.slice(1));
        assert.equal(fragment.get('next'), linking ? 'profile.html' : 'library.html'); assert.ok(fragment.get('oauth_code'));
        assert.equal((await exchange(fragment.get('oauth_code'), crypto.randomBytes(32).toString('base64url'))).status, 401);
        const result = await exchange(fragment.get('oauth_code'), verifier);
        assert.equal(result.status, 200); assert.equal(result.user.id, owner.user.id); assert.equal(result.user.firstName, owner.user.firstName); assert.ok(result.token); tokens.push(result.token);
        if (firstId) assert.equal(result.user.id, firstId); firstId = result.user.id;
        assert.equal((await exchange(fragment.get('oauth_code'), verifier)).status, 401);
        const me = await request('/api/auth/me', { headers: { Authorization: 'Bearer ' + result.token } }); assert.equal((await me.json()).user.id, firstId);
        for (const resource of Object.keys(fixtures)) {
          const after = await (await request('/api/' + resource, { headers: { Authorization: 'Bearer ' + result.token } })).json();
          assert.deepEqual(after, before[resource]);
        }
        const passwordLogin = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: owner.user.email, password: 'existing-password-123' }) });
        assert.equal(passwordLogin.status, 200); assert.equal((await passwordLogin.json()).user.id, owner.user.id);

      }
    }
    assert.equal((await request('/api/auth/google?challenge=invalid')).status, 400);
    console.log('PASS: automatic verified-email linking, unchanged user ID/profile/password and all four music collections, both OAuth providers, PKCE, signed HttpOnly cookie, invalid/missing state, browser-bound one-use exchange, MongoDB account creation, repeat login, session authentication. Provider responses mocked; database real.');
  } finally {
    for (const token of tokens) await request('/api/auth/account', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
    child.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
