(function () {
  'use strict';
  const assetRoot = new URL('../assets/audio/', document.currentScript.src);
  const demos = new Map([
    ['low tide|nightbound', 'low-tide'], ['slow static|nightbound', 'slow-static'],
    ['half light|reverie', 'half-light'], ['wire & wave|reverie', 'wire-and-wave'],
    ['redline|kilo sun', 'redline'],
  ]);
  const primed = new WeakMap();
  const searches = new Map();
  const key = track => `${String(track.title || '').trim().toLowerCase()}|${String(track.artist || '').trim().toLowerCase()}`;
  function demoUrl(track) {
    const name = demos.get(key(track));
    return name ? new URL(name + '.wav', assetRoot).href : '';
  }
  function status(message) {
    let node = document.getElementById('playbackStatus');
    if (!node) {
      node = document.createElement('div');
      node.id = 'playbackStatus';
      node.setAttribute('role', 'status');
      node.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:10001;max-width:380px;padding:12px 16px;background:#21141b;color:#fff;border:1px solid #ff3d81;border-radius:10px;font:14px/1.5 system-ui';
      document.body.appendChild(node);
    }
    node.textContent = message;
  }
  // Called synchronously from the click handler, before any metadata request.
  // Reuse this media element after its user-initiated first play on Safari/iOS.
  function prime(audio) {
    if (primed.has(audio)) return primed.get(audio);
    const silence = new URL('silence.wav', assetRoot).href;
    audio.src = silence;
    let attempt;
    try { attempt = audio.play(); } catch (error) { attempt = Promise.reject(error); }
    const ready = Promise.resolve(attempt).then(() => {
      if (audio.src === silence) audio.pause();
    }).catch(() => { primed.delete(audio); });
    primed.set(audio, ready);
    return ready;
  }
  async function play(audio, url) {
    const ready = primed.get(audio);
    if (ready) await ready;
    audio.pause();
    audio.src = url;
    audio.load();
    let timeout;
    try {
      await Promise.race([
        audio.play(),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('The preview could not load. Please try again.')), 15000); }),
      ]);
    } catch (error) {
      if (audio.src === url) audio.pause();
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function errorMessage(error) {
    return error.name === 'NotAllowedError'
      ? 'Your browser blocked audio. Tap Play again, and check this site’s sound permission.'
      : 'This preview could not play. Please try another song or search for it again.';
  }
  async function search(term, limit = 10) {
    const query = String(term || '').trim();
    const cacheKey = query.toLowerCase() + ':' + limit;
    if (!searches.has(cacheKey)) {
      const request = fetch(window.SequencerAPI.getBaseUrl() + '/catalog/search?' + new URLSearchParams({ term: query, limit }), { signal: AbortSignal.timeout(12000) })
        .then(async response => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Song search is temporarily unavailable.');
          return data;
        }).catch(error => { searches.delete(cacheKey); throw error; });
      if (searches.size >= 100) searches.delete(searches.keys().next().value);
      searches.set(cacheKey, request);
    }
    return searches.get(cacheKey);
  }
  window.SequencerMedia = { demoUrl, prime, play, status, errorMessage, search };
})();
