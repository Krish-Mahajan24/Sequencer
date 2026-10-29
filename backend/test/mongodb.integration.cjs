// Run with MONGO_TEST_URI pointing to a dedicated test database.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
if (!process.env.MONGO_TEST_URI) throw new Error('Set MONGO_TEST_URI to a dedicated test database.');
const port = process.env.TEST_PORT || '5059';
const server = spawn(process.execPath, [path.join(__dirname, '../server.js')], {
  env: { ...process.env, MONGO_URI: process.env.MONGO_TEST_URI, PORT: port, NODE_ENV: 'test', JWT_SECRET: 'integration-test-secret-only' }, stdio: 'pipe',
});
let logs = ''; server.stdout.on('data', b => { logs += b; }); server.stderr.on('data', b => { logs += b; });
const tokens = [];
async function api(endpoint, method = 'GET', body, token = tokens[0]) {
  const response = await fetch(`http://127.0.0.1:${port}/api${endpoint}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, ...await response.json() };
}
(async () => {
  try {
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await api('/health')).database === 'Connected') { healthy = true; break; } } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(healthy, logs);
    const email = `mongo-test-${Date.now()}@example.com`;
    const account = { firstName: 'Mongo', lastName: 'Test', email, password: 'test-password-123' };
    const signup = await api('/auth/signup', 'POST', account);
    assert.equal(signup.status, 201); tokens.push(signup.token);
    assert.equal((await api('/auth/login', 'POST', { email, password: account.password })).user.id, signup.user.id);
    assert.equal((await api('/auth/me')).user.email, email);
    assert.equal((await api('/auth/profile', 'PUT', { firstName: 'Updated' })).user.firstName, 'Updated');
    assert.equal((await api('/auth/password', 'PUT', { currentPassword: account.password, newPassword: 'changed-password-123' })).status, 200);
    const fixtures = {
      tracks: [{ id: 'song-one', title: 'Database Song', artist: 'Test Artist', bpm: 100, liked: true }],
      playlists: [{ id: 'playlist-one', name: 'Test playlist', trackIds: ['song-one'] }],
      sequences: [{ id: 'sequence-one', name: 'Test sequence', trackIds: ['song-one'], tempo: 100, smoothness: 88, transitions: [] }],
      history: [{ id: 'history-one', title: 'Database Song', artist: 'Test Artist', trackId: 'song-one', playedAt: new Date().toISOString() }],
    };
    for (const [resource, data] of Object.entries(fixtures)) {
      const body = { [resource]: data };
      assert.equal((await api(`/${resource}/batch`, 'POST', body)).status, 200);
      assert.equal((await api(`/${resource}/batch`, 'POST', body)).status, 200);
      const saved = (await api(`/${resource}`)).data;
      assert.equal(saved.length, 1); assert.equal(saved[0].id, data[0].id);
      if (resource === 'sequences') { assert.deepEqual(saved[0].trackIds, ['song-one']); assert.equal(saved[0].smoothness, 88); }
    }
    const invalid = await api('/tracks/batch', 'POST', { tracks: [{ title: 'Invalid', artist: 'Test', bpm: 999 }] });
    assert.equal(invalid.status, 400); assert.equal((await api('/tracks')).data[0].title, 'Database Song');
    const other = await api('/auth/signup', 'POST', { ...account, email: 'other-' + email });
    assert.equal(other.status, 201); tokens.push(other.token);
    for (const resource of Object.keys(fixtures)) assert.equal((await api('/' + resource, 'GET', undefined, other.token)).data.length, 0);
    for (const resource of Object.keys(fixtures)) {
      assert.equal((await api(`/${resource}/batch`, 'POST', { [resource]: [] })).status, 200);
      assert.deepEqual((await api('/' + resource)).data, []);
    }
    console.log('PASS: MongoDB signup/login, profile, password, all four collections, stable IDs, sequence fields, validation preservation, user isolation and empty collection round trips.');
  } finally {
    for (const token of tokens) await api('/auth/account', 'DELETE', undefined, token).catch(() => {});
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
