const assert = require('node:assert/strict');
const base = process.env.API_TEST_BASE || 'http://localhost:5050/api';
const results = [];
let token;
async function request(method, route, body, expected = 200) {
  const response = await fetch(base + route, { method, signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  results.push({ method, route, status: response.status });
  assert.equal(response.status, expected, method + ' ' + route + ': ' + data.message);
  return data;
}
(async () => {
  const email = `crud-check-${Date.now()}@example.com`;
  try {
    const health = await request('GET', '/health'); assert.equal(health.database, 'Connected');
    await request('GET', '/auth/me', undefined, 401);
    const user = await request('POST', '/auth/signup', { firstName: 'CRUD', lastName: 'Check', email, password: 'test-password-123' }, 201); token = user.token;
    token = (await request('POST', '/auth/login', { email, password: 'test-password-123' })).token;
    assert.equal((await request('GET', '/auth/me')).user.id, user.user.id);
    assert.equal((await request('PUT', '/auth/profile', { firstName: 'Updated CRUD' })).user.firstName, 'Updated CRUD');
    await request('PUT', '/auth/password', { currentPassword: 'test-password-123', newPassword: 'new-password-123' });
    await request('POST', '/auth/login', { email, password: 'new-password-123' });
    await request('POST', '/tracks', { id: 'crud-first', title: 'First Track', artist: 'Test Artist', bpm: 100 }, 201);
    await request('POST', '/tracks', { id: 'crud-second', title: 'Second Track', artist: 'Test Artist', bpm: 110 }, 201);
    assert.equal((await request('PUT', '/tracks/crud-second', { title: 'Updated Second', bpm: 125 })).data.title, 'Updated Second');
    const tracks = (await request('GET', '/tracks')).data;
    assert.equal(tracks.find(t => t.id === 'crud-first').title, 'First Track'); assert.equal(tracks.find(t => t.id === 'crud-second').bpm, 125);
    await request('PATCH', '/tracks/crud-second/like', {});
    assert.equal((await request('GET', '/tracks')).data.find(t => t.id === 'crud-second').liked, true);
    const playlist = (await request('POST', '/playlists', { name: 'CRUD Playlist', trackIds: ['crud-first'] }, 201)).data;
    const pid = playlist._id;
    await request('PUT', '/playlists/' + pid, { name: 'Updated Playlist', trackIds: ['crud-first', 'crud-second'] });
    assert.equal((await request('GET', '/playlists')).data.find(p => p._id === pid).name, 'Updated Playlist');
    const sequence = (await request('POST', '/sequences', { name: 'CRUD Sequence', tracks: [{ id: 'crud-first' }], settings: { tempo: 100 } }, 201)).data;
    assert.ok((await request('GET', '/sequences')).data.some(s => s._id === sequence._id));
    await request('POST', '/history', { title: 'First Track', artist: 'Test Artist', trackId: 'crud-first' }, 201);
    assert.equal((await request('GET', '/history')).data.length, 1);
    await request('DELETE', '/tracks/crud-second');
    assert.deepEqual((await request('GET', '/tracks')).data.map(t => t.id), ['crud-first']);
    await request('DELETE', '/tracks/does-not-exist', undefined, 404);
    await request('DELETE', '/playlists/' + pid); assert.deepEqual((await request('GET', '/playlists')).data, []);
    await request('DELETE', '/sequences/' + sequence._id); assert.deepEqual((await request('GET', '/sequences')).data, []);
    await request('DELETE', '/history'); assert.deepEqual((await request('GET', '/history')).data, []);
    await request('DELETE', '/auth/account'); token = undefined;
    await request('POST', '/auth/login', { email, password: 'new-password-123' }, 401);
    console.log(JSON.stringify({ passed: true, requests: results.length, results }, null, 2));
  } finally {
    if (token) await request('DELETE', '/auth/account').catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
