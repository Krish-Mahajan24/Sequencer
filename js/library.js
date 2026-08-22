// ---------- Sequencer: Library page (browse & collect) ----------
// A Spotify/Apple-Music-style browser over the data the Sequence page writes to:
// 'library' (tagged tracks), 'playlists' (unordered collections), 'sequences'
// (algorithm-ordered flows with a smoothness score). This page is read + light
// organize only — tagging tracks and building sequences happens on the Sequence page.

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const store = (name, fallback) => window.SequencerStore ? window.SequencerStore.get(name, fallback) : fallback;
  const save = (name, value) => { if (window.SequencerStore) window.SequencerStore.set(name, value); };

  const MOOD_STEPS = ['chill', 'chill', 'mellow', 'mellow', 'mellow', 'groove', 'groove', 'lift', 'lift', 'peak', 'peak'];
  const moodLabel = (v) => MOOD_STEPS[Math.max(0, Math.min(10, Math.round(Number(v) || 0)))];

  const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const hashString = (str) => {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  };

  // Deterministic pink-family gradient for anything without real cover art.
  const gradientFor = (seed) => {
    const h = hashString(seed);
    const hue1 = 330 + (h % 30) - 15;      // around pink/magenta
    const hue2 = (hue1 + 30 + (h % 20)) % 360;
    return `linear-gradient(135deg, hsl(${hue1},85%,58%), hsl(${hue2},60%,22%))`;
  };

  // ---------- State ----------
  let library = store('library', []);
  let playlists = store('playlists', []);
  let sequences = store('sequences', []);

  let railFilter = 'all';
  let railQuery = '';
  let artistFilter = null; // when set, Liked Songs panel is filtered to this artist

  // ---------- Track resolution ----------
  const libraryById = () => {
    const m = new Map();
    library.forEach(t => m.set(String(t.id), t));
    return m;
  };

  const resolveTracks = (item) => {
    const m = libraryById();
    const ids = item.trackIds || [];
    const inline = new Map((item.tracks || []).map(t => [String(t.id), t]));
    return ids.map(id => m.get(String(id)) || inline.get(String(id))).filter(Boolean);
  };

  // ---------- Small renderers ----------
  const trackCover = (t, sizeClass) => {
    if (t.artwork) return `<img class="${sizeClass}" src="${escapeHtml(t.artwork)}" alt="">`;
    return `<div class="${sizeClass}" style="background:${gradientFor(t.title + (t.artist||''))}"></div>`;
  };

  const collectionCard = (item, kind) => {
    const tracks = resolveTracks(item);
    const count = item.trackIds ? item.trackIds.length : tracks.length;
    const sub = kind === 'Sequence'
      ? `${item.tempo || tracks[0]?.bpm || '—'} bpm start · ${count} track${count === 1 ? '' : 's'}`
      : `${count} track${count === 1 ? '' : 's'}`;
    const cover = tracks[0] && tracks[0].artwork
      ? `background-image:url('${escapeHtml(tracks[0].artwork)}');background-size:cover;background-position:center;`
      : `background:${gradientFor(item.name + item.id)};`;
    const smoothnessBadge = (kind === 'Sequence' && typeof item.smoothness === 'number')
      ? `<span class="lib-card-kind" style="position:absolute;left:10px;top:10px;background:rgba(0,0,0,.55);padding:2px 8px;border-radius:999px;">${item.smoothness}% smooth</span>`
      : '';
    return `
      <button class="lib-card" data-open="${kind.toLowerCase()}" data-id="${escapeHtml(item.id)}">
        <div class="lib-card-art" style="${cover}">
          <span class="lib-card-kind">${kind}</span>
          ${smoothnessBadge}
          <span class="lib-card-play" data-play-collection="${escapeHtml(item.id)}" data-kind="${kind.toLowerCase()}" aria-label="Play ${escapeHtml(item.name)}">▶</span>
        </div>
        <span class="lib-card-title">${escapeHtml(item.name)}</span>
        <span class="lib-card-sub">${sub}</span>
      </button>`;
  };

  const artistCard = (name, tracks) => `
    <button class="lib-card" data-open="artist" data-artist="${escapeHtml(name)}">
      <div class="lib-card-art" style="background:${gradientFor(name)}"></div>
      <span class="lib-card-title">${escapeHtml(name)}</span>
      <span class="lib-card-sub">${tracks.length} track${tracks.length === 1 ? '' : 's'}</span>
    </button>`;

  // ---------- Rail ----------
  const renderRail = () => {
    const rail = $('railList');
    let items = [
      ...playlists.map(p => ({ ...p, __kind: 'Playlist' })),
      ...sequences.map(s => ({ ...s, __kind: 'Sequence' })),
    ];
    if (railFilter === 'playlists') items = items.filter(i => i.__kind === 'Playlist');
    if (railFilter === 'sequences') items = items.filter(i => i.__kind === 'Sequence');
    if (railQuery.trim()) {
      const q = railQuery.trim().toLowerCase();
      items = items.filter(i => (i.name || '').toLowerCase().includes(q));
    }
    items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (!items.length) {
      rail.innerHTML = `<div class="lib-rail-empty">Nothing here yet. Tag a few tracks and build a playlist or sequence on <a href="sequence.html">Sequence</a>.</div>`;
      return;
    }

    rail.innerHTML = items.map(i => {
      const tracks = resolveTracks(i);
      const count = i.trackIds ? i.trackIds.length : tracks.length;
      const icon = i.__kind === 'Sequence' ? '〽' : '☰';
      const sub = i.__kind === 'Sequence' ? `Sequence · ${count} tracks` : `Playlist · ${count} tracks`;
      return `
        <button class="lib-rail-item" data-open="${i.__kind.toLowerCase()}" data-id="${escapeHtml(i.id)}">
          <div class="lib-rail-thumb" style="background:${gradientFor(i.name + i.id)}">${icon}</div>
          <div class="lib-rail-meta">
            <strong>${escapeHtml(i.name)}</strong>
            <span>${sub}</span>
          </div>
        </button>`;
    }).join('');
  };

  // ---------- Overview ----------
  const renderOverview = () => {
    $('likedCount').textContent = `${library.length} song${library.length === 1 ? '' : 's'}`;

    const recent = library.slice(-8).reverse();
    $('recentRow').innerHTML = recent.length
      ? recent.map(t => `
        <button class="lib-card" data-play-track="${escapeHtml(t.id)}">
          <div class="lib-card-art" style="${t.artwork ? `background-image:url('${escapeHtml(t.artwork)}');background-size:cover;background-position:center;` : `background:${gradientFor(t.title + t.artist)}`}">
            <span class="lib-card-kind">${escapeHtml(t.source || 'Tagged')}</span>
            <span class="lib-card-play" data-play-track="${escapeHtml(t.id)}" aria-label="Play ${escapeHtml(t.title)}">▶</span>
          </div>
          <span class="lib-card-title">${escapeHtml(t.title)}</span>
          <span class="lib-card-sub">${escapeHtml(t.artist || 'Unknown artist')}</span>
        </button>`).join('')
      : `<div class="lib-rail-empty" style="padding-left:0">No tracks tagged yet — <a href="sequence.html">add some on Sequence</a>.</div>`;

    $('overviewPlaylists').innerHTML = playlists.length
      ? playlists.slice(0, 6).map(p => collectionCard(p, 'Playlist')).join('')
      : emptyBlock('No playlists yet', 'Create one on the Sequence page once you\u2019ve tagged a few tracks.', 'sequence.html', 'Go to Sequence');

    $('overviewSequences').innerHTML = sequences.length
      ? sequences.slice(0, 6).map(s => collectionCard(s, 'Sequence')).join('')
      : emptyBlock('No sequences yet', 'Set a target tempo in Flow Lab and thread your first sequence.', 'sequence.html', 'Open Flow Lab');

    const artists = artistMap();
    $('artistRow').innerHTML = artists.size
      ? Array.from(artists.entries()).slice(0, 10).map(([name, tracks]) => artistCard(name, tracks)).join('')
      : `<div class="lib-rail-empty" style="padding-left:0">Artists show up here once you've saved a few tracks.</div>`;
  };

  const emptyBlock = (title, body, href, cta) => `
    <div class="lib-empty" style="grid-column:1/-1">
      <strong>${title}</strong>
      <p>${body}</p>
      <a class="btn btn-secondary btn-sm" href="${href}">${cta} <span class="arrow">→</span></a>
    </div>`;

  const artistMap = () => {
    const m = new Map();
    library.forEach(t => {
      const name = t.artist && t.artist.trim() ? t.artist.trim() : 'Unknown artist';
      if (!m.has(name)) m.set(name, []);
      m.get(name).push(t);
    });
    return m;
  };

  // ---------- Liked Songs panel ----------
  const renderLiked = () => {
    let tracks = library.slice().reverse();
    if (artistFilter) tracks = tracks.filter(t => (t.artist || 'Unknown artist') === artistFilter);

    const el = $('likedList');
    if (!tracks.length) {
      el.innerHTML = artistFilter
        ? `<div class="lib-empty"><strong>No tracks from ${escapeHtml(artistFilter)}</strong><p>Try clearing the filter.</p><button class="btn btn-secondary btn-sm" id="clearArtistFilter">Clear filter</button></div>`
        : `<div class="lib-empty"><strong>Your tagged tracks will show up here</strong><p>Add a track\u2019s title, tempo, energy and mood on Sequence to get started.</p><a class="btn btn-secondary btn-sm" href="sequence.html">Go to Sequence <span class="arrow">→</span></a></div>`;
      const clearBtn = $('clearArtistFilter');
      if (clearBtn) clearBtn.addEventListener('click', () => { artistFilter = null; renderLiked(); });
      return;
    }

    const filterNote = artistFilter
      ? `<div class="lib-row-head" style="margin-top:0"><span class="lib-see-all">Filtered by <strong style="color:var(--chalk)">${escapeHtml(artistFilter)}</strong></span><span class="lib-see-all" id="clearArtistFilter">Clear ×</span></div>`
      : '';

    el.innerHTML = filterNote + tracks.map((t, i) => `
      <div class="lib-track-row" data-id="${escapeHtml(t.id)}">
        <span class="lib-track-num">${i + 1}</span>
        <div class="lib-track-title-cell">
          ${trackCover(t, 'lib-track-art')}
          <div>
            <div class="lib-track-title">${escapeHtml(t.title)}</div>
            <div class="lib-track-artist">${escapeHtml(t.artist || 'Unknown artist')}</div>
          </div>
        </div>
        <span class="lib-track-meta">${escapeHtml(t.album || t.source || 'Tagged track')}</span>
        <span class="lib-track-meta">${t.bpm ? t.bpm + ' bpm' : '—'} · ${moodLabel(t.mood)}</span>
        <div class="lib-track-actions">
          <button class="lib-mini-btn" data-play-track="${escapeHtml(t.id)}" title="Play">▶</button>
          <button class="lib-mini-btn" data-remove-track="${escapeHtml(t.id)}" title="Remove from Library">×</button>
        </div>
      </div>`).join('');

    const clearBtn = $('clearArtistFilter');
    if (clearBtn) clearBtn.addEventListener('click', () => { artistFilter = null; renderLiked(); });
  };

  // ---------- Full grids ----------
  const renderAllPlaylists = () => {
    $('allPlaylists').innerHTML = playlists.length
      ? playlists.map(p => collectionCard(p, 'Playlist')).join('')
      : emptyBlock('No playlists yet', 'Build your first one on the Sequence page.', 'sequence.html', 'Go to Sequence');
  };
  const renderAllSequences = () => {
    $('allSequences').innerHTML = sequences.length
      ? sequences.map(s => collectionCard(s, 'Sequence')).join('')
      : emptyBlock('No sequences yet', 'Thread your first flow in the Flow Lab.', 'sequence.html', 'Open Flow Lab');
  };
  const renderAllArtists = () => {
    const artists = artistMap();
    $('allArtists').innerHTML = artists.size
      ? Array.from(artists.entries()).map(([name, tracks]) => artistCard(name, tracks)).join('')
      : emptyBlock('No artists yet', 'Tag a few tracks and they\u2019ll be grouped by artist here.', 'sequence.html', 'Go to Sequence');
  };

  const renderAll = () => {
    renderRail();
    renderOverview();
    renderLiked();
    renderAllPlaylists();
    renderAllSequences();
    renderAllArtists();
  };

  // ---------- Tabs ----------
  const setTab = (tab) => {
    document.querySelectorAll('.lib-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.lib-panel').forEach(p => { p.hidden = p.id !== `panel-${tab}`; });
  };

  $('libTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.lib-tab');
    if (btn) setTab(btn.dataset.tab);
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-tab-link]');
    if (link) { e.preventDefault(); setTab(link.dataset.tabLink); window.scrollTo({ top: document.querySelector('.lib-tabs').offsetTop - 90, behavior: 'smooth' }); }
  });

  // ---------- Rail filters + search ----------
  document.querySelectorAll('.lib-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.lib-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      railFilter = chip.dataset.filter;
      renderRail();
    });
  });
  $('railSearch').addEventListener('input', (e) => { railQuery = e.target.value; renderRail(); });

  // ---------- New playlist from rail ----------
  $('railNewPlaylist').addEventListener('click', () => {
    const name = (prompt('Playlist name') || '').trim();
    if (!name) return;
    playlists.push({ id: 'pl_' + Date.now(), name, trackIds: [], tracks: [], createdAt: new Date().toISOString() });
    save('playlists', playlists);
    renderAll();
  });

  // ---------- Detail overlay ----------
const detail = $('libDetail');
let currentDetail = null; // { kind, id } for the open overlay, used by rename/remove-track

// Recomputes per-transition distance + overall smoothness for a sequence
// after a track is removed, without re-running the full nearest-neighbor +
// 2-opt solve — the remaining tracks just keep their existing relative
// order and the consecutive gaps are recalculated.
const MAX_DIST = Math.sqrt(3);
const recomputeSequenceMetrics = (orderedTracks) => {
  if (orderedTracks.length < 2) return { transitions: [], smoothness: orderedTracks.length ? 100 : 0 };
  const bpms = orderedTracks.map(t => t.bpm);
  const minBpm = Math.min(...bpms), maxBpm = Math.max(...bpms);
  const bpmRange = (maxBpm - minBpm) || 1;
  const nodes = orderedTracks.map(t => ({
    ...t, _nt: (t.bpm - minBpm) / bpmRange, _ne: t.energy / 10, _nm: t.mood / 10,
  }));
  const dist = (a, b) => Math.sqrt((a._nt - b._nt) ** 2 + (a._ne - b._ne) ** 2 + (a._nm - b._nm) ** 2);
  const transitions = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    transitions.push({
      fromId: a.id, toId: b.id, distance: dist(a, b),
      deltaBpm: Math.abs(b.bpm - a.bpm), deltaEnergy: Math.abs(b.energy - a.energy), deltaMood: Math.abs(b.mood - a.mood),
    });
  }
  const total = transitions.reduce((s, t) => s + t.distance, 0);
  const smoothness = Math.max(0, Math.min(100, Math.round(100 * (1 - (total / transitions.length) / MAX_DIST))));
  return { transitions, smoothness };
};

const openDetail = (kind, id) => {
  currentDetail = { kind, id };
  const source = kind === 'sequence' ? sequences : playlists;
  const item = source.find(i => String(i.id) === String(id));
  if (!item) return;
  const tracks = resolveTracks(item);

  const isSequence = kind === 'sequence';
  const transitionsById = isSequence
    ? new Map((item.transitions || []).map(t => [`${t.fromId}->${t.toId}`, t]))
    : null;

  $('detailKind').textContent = isSequence ? 'Sequence' : 'Playlist';
  $('detailName').textContent = item.name;
  $('detailMeta').textContent = isSequence
    ? `${item.tempo || '—'} bpm start · ${tracks.length} track${tracks.length === 1 ? '' : 's'}${typeof item.smoothness === 'number' ? ` · ${item.smoothness}% smooth` : ''}`
    : `${tracks.length} track${tracks.length === 1 ? '' : 's'}`;
  $('detailArt').style.background = gradientFor(item.name + item.id);
  $('detailArt').textContent = isSequence ? '〽' : '♪';

  $('detailList').innerHTML = tracks.length
    ? tracks.map((t, i) => {
        const prev = tracks[i - 1];
        const trans = isSequence && prev ? transitionsById.get(`${prev.id}->${t.id}`) : null;
        const jumpPct = trans ? Math.round((1 - trans.distance / MAX_DIST) * 100) : null;
        const jumpNote = isSequence
          ? (trans
              ? `<span class="lib-track-meta" style="font-size:11px;color:${jumpPct < 55 ? 'var(--ember)' : 'var(--current)'}">${jumpPct}% smooth transition</span>`
              : `<span class="lib-track-meta" style="font-size:11px;color:var(--signal)">Start</span>`)
          : '';
        return `
      <div class="lib-track-row" style="grid-template-columns:34px 1fr 90px 110px" data-id="${escapeHtml(t.id)}">
        <span class="lib-track-num">${isSequence ? i + 1 : '▸'}</span>
        <div class="lib-track-title-cell">
          ${trackCover(t, 'lib-track-art')}
          <div>
            <div class="lib-track-title">${escapeHtml(t.title)}</div>
            <div class="lib-track-artist">${escapeHtml(t.artist || 'Unknown artist')}${jumpNote ? ' · ' : ''}${jumpNote}</div>
          </div>
        </div>
        <span class="lib-track-meta">${t.bpm ? t.bpm + ' bpm' : '—'}</span>
        <div class="lib-track-actions">
          <button class="lib-mini-btn" data-play-track="${escapeHtml(t.id)}" title="Play">▶</button>
          <button class="lib-mini-btn" data-remove-from-collection="${escapeHtml(t.id)}" title="Remove from this ${kind}">×</button>
        </div>
      </div>`;
      }).join('')
    : `<p class="form-sub" style="padding:10px 4px">No tracks in this ${kind} yet.</p>`;

  detail.hidden = false;
};
$('detailClose').addEventListener('click', () => { detail.hidden = true; currentDetail = null; });
detail.addEventListener('click', (e) => { if (e.target === detail) { detail.hidden = true; currentDetail = null; } });

// ---------- Rename & remove-track (detail overlay) ----------
$('detailRename').addEventListener('click', () => {
  if (!currentDetail) return;
  const source = currentDetail.kind === 'sequence' ? sequences : playlists;
  const item = source.find(i => String(i.id) === String(currentDetail.id));
  if (!item) return;
  const next = (prompt('Rename to:', item.name) || '').trim();
  if (!next || next === item.name) return;
  item.name = next;
  save(currentDetail.kind === 'sequence' ? 'sequences' : 'playlists', source);
  renderAll();
  openDetail(currentDetail.kind, currentDetail.id);
});

detail.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('[data-remove-from-collection]');
  if (!removeBtn || !currentDetail) return;
  const trackId = removeBtn.dataset.removeFromCollection;
  const isSequence = currentDetail.kind === 'sequence';
  const source = isSequence ? sequences : playlists;
  const item = source.find(i => String(i.id) === String(currentDetail.id));
  if (!item) return;

  item.trackIds = (item.trackIds || []).filter(id => String(id) !== String(trackId));

  if (isSequence) {
    const remaining = resolveTracks(item);
    const { transitions, smoothness } = recomputeSequenceMetrics(remaining);
    item.transitions = transitions;
    item.smoothness = smoothness;
  }

  save(isSequence ? 'sequences' : 'playlists', source);
  renderAll();
  openDetail(currentDetail.kind, currentDetail.id);
});

  
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      const kind = opener.dataset.open;
      if (kind === 'artist') {
        artistFilter = opener.dataset.artist;
        setTab('liked');
        renderLiked();
        window.scrollTo({ top: document.querySelector('.lib-tabs').offsetTop - 90, behavior: 'smooth' });
      } else {
        openDetail(kind, opener.dataset.id);
      }
      return;
    }

    const removeBtn = e.target.closest('[data-remove-track]');
    if (removeBtn) {
      const id = removeBtn.dataset.removeTrack;
      library = library.filter(t => String(t.id) !== String(id));
      save('library', library);
      renderAll();
      return;
    }
  });

 
  const audio = $('libAudio');
  let playingId = null;

  const findTrack = (id) => library.find(t => String(t.id) === String(id));

  const setPlayingUI = (id) => {
    document.querySelectorAll('[data-play-track]').forEach(btn => {
      btn.classList.toggle('is-playing', btn.dataset.playTrack === String(id));
      if (btn.classList.contains('lib-mini-btn')) btn.textContent = btn.dataset.playTrack === String(id) ? '❚❚' : '▶';
    });
  };

  const playTrack = (id) => {
    const t = findTrack(id);
    if (!t) return;
    if (playingId === id && !audio.paused) { audio.pause(); playingId = null; setPlayingUI(null); return; }
    if (!t.previewUrl) {
      
      playingId = id; setPlayingUI(id);
      setTimeout(() => { if (playingId === id) { playingId = null; setPlayingUI(null); } }, 900);
      return;
    }
    audio.src = t.previewUrl;
    audio.play().then(() => { playingId = id; setPlayingUI(id); }).catch(() => {});
  };
  audio.addEventListener('ended', () => { playingId = null; setPlayingUI(null); });

  document.addEventListener('click', (e) => {
    const playBtn = e.target.closest('[data-play-track]');
    if (playBtn) { playTrack(playBtn.dataset.playTrack); return; }

    const playCollection = e.target.closest('[data-play-collection]');
    if (playCollection) {
      e.stopPropagation();
      const kind = playCollection.dataset.kind;
      const source = kind === 'sequence' ? sequences : playlists;
      const item = source.find(i => String(i.id) === String(playCollection.dataset.playCollection));
      if (!item) return;
      const tracks = resolveTracks(item);
      const playable = tracks.find(t => t.previewUrl) || tracks[0];
      if (playable) playTrack(playable.id);
    }
  });

 
  renderAll();
});
