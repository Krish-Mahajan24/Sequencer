const express = require('express');
const router = express.Router();
const cache = new Map();
router.get('/search', async (req, res) => {
  const term = typeof req.query.term === 'string' ? req.query.term.trim() : '';
  if (!term || term.length > 200) return res.status(400).json({ message: 'Enter a song or artist name (up to 200 characters).' });
  const limit = Math.min(25, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const key = term.toLowerCase() + ':' + limit;
  let entry = cache.get(key);
  if (!entry || entry.expires < Date.now()) {
    const result = fetch('https://itunes.apple.com/search?' + new URLSearchParams({ term, media: 'music', entity: 'song', limit }), { signal: AbortSignal.timeout(8000) })
      .then(async response => {
        if (!response.ok) throw new Error('Song provider unavailable');
        const data = await response.json();
        if (!Array.isArray(data.results)) throw new Error('Invalid song provider response');
        return { resultCount: data.results.length, results: data.results };
      });
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    entry = { result, expires: Date.now() + 60 * 60 * 1000 };
    cache.set(key, entry);
  }
  try { res.json(await entry.result); }
  catch { if (cache.get(key) === entry) cache.delete(key); res.status(502).json({ message: 'Song previews are temporarily unavailable. Please try again shortly.' }); }
});
module.exports = router;
