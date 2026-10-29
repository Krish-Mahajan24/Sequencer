const assert = require('node:assert/strict');
const express = require('express');
const originalFetch = global.fetch;
let upstreamCalls = 0;
let failOnce = false;
global.fetch = async (url, options) => {
  if (!String(url).startsWith('https://itunes.apple.com/search?')) return originalFetch(url, options);
  upstreamCalls++;
  if (failOnce) { failOnce = false; return new Response('{}', { status: 503 }); }
  const params = new URL(url).searchParams;
  assert.equal(params.get('entity'), 'song');
  assert.ok(Number(params.get('limit')) <= 25);
  return new Response(JSON.stringify({ results: [{ trackName: params.get('term'), previewUrl: 'https://audio-ssl.itunes.apple.com/test.m4a' }] }), { headers: { 'Content-Type': 'application/json' } });
};
const app = express();
app.use('/api/catalog', require('../routes/catalogRoutes'));
const server = app.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + server.address().port + '/api/catalog/search';
  try {
    assert.equal((await originalFetch(base)).status, 400);
    assert.equal((await originalFetch(base + '?term=' + 'x'.repeat(201))).status, 400);
    assert.equal(upstreamCalls, 0);
    const responses = await Promise.all([originalFetch(base + '?term=Track&limit=10'), originalFetch(base + '?term=Track&limit=10')]);
    assert.ok(responses.every(response => response.ok));
    assert.equal(upstreamCalls, 1, 'Concurrent identical searches share one upstream request');
    assert.equal((await (await originalFetch(base + '?term=track&limit=10')).json()).resultCount, 1);
    assert.equal(upstreamCalls, 1, 'Equivalent repeated searches use the cache');
    assert.equal((await originalFetch(base + '?term=Limited&limit=10000')).status, 200);
    failOnce = true;
    assert.equal((await originalFetch(base + '?term=Retry')).status, 502);
    assert.equal((await originalFetch(base + '?term=Retry')).status, 200, 'Failed requests are retryable');
    console.log('PASS: public catalog validation, bounded limits, concurrent request deduplication, cached results and upstream-failure recovery.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { global.fetch = originalFetch; server.close(); }
});
