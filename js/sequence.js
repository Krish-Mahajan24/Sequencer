// ---------- Sequencer: Sequence page ----------
// Handles track CRUD, persistence, the energy x mood scatter map, the stats bar,
// playlist/sequence creation (the "Flow Lab"), and the actual sequencing algorithm.

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = window.SequencerStore
    ? window.SequencerStore.key('library')
    : 'sequencer_library';

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  const MOOD_STEPS = [
    'chill',
    'chill',
    'mellow',
    'mellow',
    'mellow',
    'groove',
    'groove',
    'lift',
    'lift',
    'peak',
    'peak'
  ];

  const MOOD_COLOR = {
    chill: 'var(--signal)',
    mellow: 'var(--signal)',
    groove: 'var(--current)',
    lift: 'var(--current)',
    peak: 'var(--ember)'
  };

  const SEED_TRACKS = [
    { id: 't1', title: 'Low Tide', artist: 'Nightbound', bpm: 68, energy: 2, mood: 1 },
    { id: 't2', title: 'Slow Static', artist: 'Nightbound', bpm: 78, energy: 3, mood: 3 },
    { id: 't3', title: 'Half Light', artist: 'Reverie', bpm: 96, energy: 5, mood: 5 },
    { id: 't4', title: 'Wire & Wave', artist: 'Reverie', bpm: 112, energy: 7, mood: 7 },
    { id: 't5', title: 'Redline', artist: 'Kilo Sun', bpm: 128, energy: 9, mood: 9 }
  ];

  // ---------- State ----------

  const loadTracks = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) {
        return SEED_TRACKS.slice();
      }

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return SEED_TRACKS.slice();
    }
  };

  let tracks = loadTracks();
  let activeSequence = null;

  const saveTracks = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    } catch {
      // Storage unavailable.
    }
  };

  // ---------- Elements ----------

  const form = document.getElementById('trackForm');

  const titleInput = document.getElementById('fTitle');
  const artistInput = document.getElementById('fArtist');

  const bpmInput = document.getElementById('fBpm');
  const bpmVal = document.getElementById('fBpmVal');

  const energyInput = document.getElementById('fEnergy');
  const energyVal = document.getElementById('fEnergyVal');

  const moodInput = document.getElementById('fMood');
  const moodVal = document.getElementById('fMoodVal');

  const guessBtn = document.getElementById('guessBtn');

  const songList = document.getElementById('songList');
  const listCount = document.getElementById('listCount');

  const scatterPlot = document.getElementById('scatterPlot');
  const scatterEmpty = document.getElementById('scatterEmpty');
  const scatterEdges = document.getElementById('scatterEdges');
  const scatterHint = document.getElementById('scatterHint');

  const statCount = document.getElementById('statCount');
  const statBpm = document.getElementById('statBpm');
  const statEnergy = document.getElementById('statEnergy');
  const statSpread = document.getElementById('statSpread');

  // ---------- Helpers ----------

  const moodLabel = (v) =>
    MOOD_STEPS[Math.max(0, Math.min(10, Math.round(v)))];

  const hashString = (str) => {
    let h = 0;

    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }

    return Math.abs(h);
  };

  const GENRE_PROFILES = {
    dance: { bpm: [118, 132], energy: [7, 10], mood: [6, 10] },
    electronic: { bpm: [110, 140], energy: [6, 10], mood: [5, 10] },
    house: { bpm: [118, 128], energy: [7, 10], mood: [6, 9] },
    'hip-hop/rap': { bpm: [80, 105], energy: [5, 9], mood: [3, 8] },
    rock: { bpm: [100, 150], energy: [6, 10], mood: [4, 9] },
    alternative: { bpm: [95, 140], energy: [5, 9], mood: [3, 8] },
    pop: { bpm: [95, 128], energy: [5, 9], mood: [5, 9] },
    'r&b/soul': { bpm: [70, 105], energy: [3, 7], mood: [3, 7] },
    jazz: { bpm: [70, 130], energy: [2, 6], mood: [3, 7] },
    classical: { bpm: [50, 100], energy: [1, 4], mood: [2, 6] },
    ambient: { bpm: [50, 90], energy: [0, 3], mood: [1, 5] },
    'singer/songwriter': { bpm: [70, 110], energy: [2, 5], mood: [2, 6] },
    country: { bpm: [80, 130], energy: [4, 8], mood: [4, 8] },
    reggae: { bpm: [70, 100], energy: [4, 7], mood: [5, 9] },
    metal: { bpm: [110, 180], energy: [8, 10], mood: [2, 6] },
    folk: { bpm: [70, 110], energy: [2, 5], mood: [3, 7] },
    latin: { bpm: [95, 130], energy: [6, 10], mood: [6, 10] },
    soundtrack: { bpm: [60, 120], energy: [1, 7], mood: [1, 7] }
  };

  const DEFAULT_PROFILE = {
    bpm: [70, 180],
    energy: [0, 10],
    mood: [0, 10]
  };

  const estimateFeatures = (title, genre) => {
    const h = hashString(
      (title || '').trim().toLowerCase() || 'untitled'
    );

    const profile =
      GENRE_PROFILES[(genre || '').toLowerCase()] ||
      DEFAULT_PROFILE;

    const bpmSpan = profile.bpm[1] - profile.bpm[0];
    const energySpan = profile.energy[1] - profile.energy[0];
    const moodSpan = profile.mood[1] - profile.mood[0];

    const bpm =
      profile.bpm[0] + (h % (bpmSpan + 1));

    const energy =
      profile.energy[0] +
      ((h >> 3) % (energySpan + 1));

    const mood =
      profile.mood[0] +
      ((h >> 7) % (moodSpan + 1));

    return {
      bpm: Math.round(bpm),
      energy: Math.round(energy),
      mood: Math.round(mood)
    };
  };

  const syncFieldLabels = () => {
    bpmVal.textContent = `${bpmInput.value} bpm`;
    energyVal.textContent = `${energyInput.value} / 10`;
    moodVal.textContent = moodLabel(moodInput.value);
  };

  const escapeHtml = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  // ==========================================================
  // ---------- THE SEQUENCING ALGORITHM ----------
  // ==========================================================

  const normalizeTracks = (list) => {
    const bpms = list.map((t) => t.bpm);

    const minBpm = Math.min(...bpms);
    const maxBpm = Math.max(...bpms);

    const bpmRange = maxBpm - minBpm || 1;

    return list.map((t) => ({
      ...t,
      _ntempo: (t.bpm - minBpm) / bpmRange,
      _nenergy: t.energy / 10,
      _nmood: t.mood / 10
    }));
  };

  const nodeDistance = (a, b) =>
    Math.sqrt(
      (a._ntempo - b._ntempo) ** 2 +
      (a._nenergy - b._nenergy) ** 2 +
      (a._nmood - b._nmood) ** 2
    );

  const MAX_POSSIBLE_DISTANCE = Math.sqrt(3);

  const MAX_2OPT_PASSES = 40;

  const twoOptImprove = (order) => {
    if (order.length < 4) {
      return order;
    }

    let route = order.slice();
    let improved = true;
    let pass = 0;

    while (improved && pass < MAX_2OPT_PASSES) {
      improved = false;
      pass++;

      for (let i = 0; i < route.length - 2; i++) {
        for (let j = i + 2; j < route.length; j++) {
          const a = route[i];
          const b = route[i + 1];
          const c = route[j];
          const d = route[j + 1];

          const before =
            nodeDistance(a, b) +
            (d ? nodeDistance(c, d) : 0);

          const after =
            nodeDistance(a, c) +
            (d ? nodeDistance(b, d) : 0);

          if (after < before - 1e-9) {
            const segment = route
              .slice(i + 1, j + 1)
              .reverse();

            route = route
              .slice(0, i + 1)
              .concat(segment, route.slice(j + 1));

            improved = true;
          }
        }
      }
    }

    return route;
  };

  const buildSequence = (rawTracks, targetBpm) => {
    if (rawTracks.length < 2) {
      return null;
    }

    const nodes = normalizeTracks(rawTracks);
    const remaining = nodes.slice();

    let startIdx = 0;
    let bestGap = Infinity;

    remaining.forEach((n, i) => {
      const gap = Math.abs(n.bpm - targetBpm);

      if (gap < bestGap) {
        bestGap = gap;
        startIdx = i;
      }
    });

    let order = [
      remaining.splice(startIdx, 1)[0]
    ];

    while (remaining.length) {
      const current = order[order.length - 1];

      let nearestIdx = 0;
      let nearestDist = Infinity;

      remaining.forEach((n, i) => {
        const d = nodeDistance(current, n);

        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      });

      order.push(
        remaining.splice(nearestIdx, 1)[0]
      );
    }

    order = twoOptImprove(order);

    const transitions = [];

    for (let i = 0; i < order.length - 1; i++) {
      const current = order[i];
      const next = order[i + 1];

      transitions.push({
        fromId: current.id,
        toId: next.id,
        distance: nodeDistance(current, next),
        deltaBpm: Math.abs(next.bpm - current.bpm),
        deltaEnergy: Math.abs(
          next.energy - current.energy
        ),
        deltaMood: Math.abs(
          next.mood - current.mood
        )
      });
    }

    const totalDistance = transitions.reduce(
      (sum, t) => sum + t.distance,
      0
    );

    const avgDistance = transitions.length
      ? totalDistance / transitions.length
      : 0;

    const smoothness = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 *
          (1 - avgDistance / MAX_POSSIBLE_DISTANCE)
        )
      )
    );

    return {
      order,
      transitions,
      smoothness,
      avgDistance,
      totalDistance
    };
  };

  // ---------- Rendering ----------

  const renderStats = () => {
    statCount.textContent = tracks.length;

    if (!tracks.length) {
      statBpm.textContent = '—';
      statEnergy.textContent = '—';
      statSpread.textContent = '—';
      return;
    }

    const bpms = tracks.map((t) => t.bpm);
    const energies = tracks.map((t) => t.energy);
    const moods = tracks.map((t) => t.mood);

    statBpm.textContent =
      `${Math.min(...bpms)}–${Math.max(...bpms)}`;

    statEnergy.textContent =
      (
        energies.reduce((a, b) => a + b, 0) /
        energies.length
      ).toFixed(1);

    statSpread.textContent =
      `${Math.max(...moods) - Math.min(...moods)} / 10`;
  };

  const dotPos = (t) => ({
    x: (t.mood / 10) * 100,
    y: 100 - (t.energy / 10) * 100
  });

  const renderEdges = (sequence) => {
    if (!scatterEdges) return;

    scatterEdges.innerHTML = '';

    if (
      !sequence ||
      !sequence.trackIds ||
      sequence.trackIds.length < 2
    ) {
      if (scatterHint) {
        scatterHint.textContent =
          'Hover a point for the track';
      }

      return;
    }

    const byId = new Map(
      tracks.map((t) => [String(t.id), t])
    );

    const pts = sequence.trackIds
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map(dotPos);

    if (pts.length < 2) return;

    if (scatterHint) {
      scatterHint.textContent =
        `Showing "${sequence.name}" — start to finish`;
    }

    const ns = 'http://www.w3.org/2000/svg';

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];

      const line = document.createElementNS(
        ns,
        'line'
      );

      line.setAttribute('x1', a.x.toFixed(2));
      line.setAttribute('y1', a.y.toFixed(2));
      line.setAttribute('x2', b.x.toFixed(2));
      line.setAttribute('y2', b.y.toFixed(2));

      line.setAttribute(
        'class',
        'edge-line'
      );

      line.style.animationDelay =
        `${Math.min(i, 20) * 0.04}s`;

      scatterEdges.appendChild(line);
    }
  };

  const renderScatter = () => {
    scatterPlot
      .querySelectorAll('.scatter-dot')
      .forEach((el) => el.remove());

    if (!tracks.length) {
      scatterEmpty.style.display = 'flex';
      renderEdges(null);
      return;
    }

    scatterEmpty.style.display = 'none';

    tracks.forEach((t, i) => {
      const dot = document.createElement('div');

      dot.className = 'scatter-dot';

      const pos = dotPos(t);

      dot.style.left = `${pos.x}%`;
      dot.style.top = `${pos.y}%`;

      dot.style.background =
        MOOD_COLOR[moodLabel(t.mood)];

      dot.dataset.label =
        `${t.title} · ${t.bpm} bpm · ${moodLabel(t.mood)}`;

      if (!reduceMotion) {
        dot.style.animationDelay =
          `${Math.min(i, 12) * 0.03}s`;
      }

      scatterPlot.appendChild(dot);
    });

    renderEdges(activeSequence);
  };

  const renderList = () => {
    listCount.textContent =
      `${tracks.length} track${tracks.length === 1 ? '' : 's'}`;

    if (!tracks.length) {
      songList.innerHTML = `
        <div class="empty-state">
          <div class="eyebrow">Nothing tagged yet</div>
          <h3>Your library is empty</h3>
          <p>Add a track on the left — title, tempo, energy, and mood — and it'll show up here and on the map above.</p>
        </div>
      `;

      return;
    }

    songList.innerHTML = tracks
      .map(
        (t) => `
        <div class="song-row" data-id="${t.id}">
          <div class="song-main">
            <button
              class="play-btn"
              aria-label="Preview ${escapeHtml(t.title)}"
              data-action="play"
              ${t.previewUrl ? '' : 'title="No preview available"'}
            >
              ▶
            </button>

            ${
              t.artwork
                ? `<div class="song-cover" style="background-image:url('${escapeHtml(t.artwork)}')"></div>`
                : ''
            }

            <div>
              <div class="song-title">
                ${escapeHtml(t.title)}
              </div>

              <div class="song-artist">
                ${escapeHtml(
                  t.artist || 'Unknown artist'
                )}
              </div>
            </div>
          </div>

          <div class="stat">
            <div class="stat-val">${t.bpm}</div>
            <div class="stat-label">bpm</div>
          </div>

          <div class="stat">
            <div class="stat-val">
              ${t.energy}/10
            </div>
            <div class="stat-label">energy</div>
          </div>

          <span class="mood-chip">
            ${moodLabel(t.mood)}
          </span>

          ${
            t.genre
              ? `<span class="genre-chip">${escapeHtml(t.genre)}</span>`
              : ''
          }

          <button
            class="row-edit"
            aria-label="Edit ${escapeHtml(t.title)}"
            data-action="edit"
            title="Edit tags"
          >
            ✎
          </button>

          <button
            class="row-remove"
            aria-label="Remove ${escapeHtml(t.title)}"
            data-action="remove"
          >
            ×
          </button>
        </div>
      `
      )
      .join('');
  };

  const renderAll = () => {
    renderStats();
    renderScatter();
    renderList();
    syncSequenceControls();
  };

  // ---------- Track form ----------

  [bpmInput, energyInput, moodInput].forEach(
    (el) =>
      el.addEventListener(
        'input',
        syncFieldLabels
      )
  );

  // ---------- Music search ----------

  const searchInput =
    document.getElementById('fSearch');

  const searchResultsEl =
    document.getElementById('searchResults');

  const searchStatus =
    document.getElementById('searchStatus');

  const matchedPreview =
    document.getElementById('matchedPreview');

  const matchedArt =
    document.getElementById('matchedArt');

  const matchedTitle =
    document.getElementById('matchedTitle');

  const matchedSub =
    document.getElementById('matchedSub');

  const matchedClear =
    document.getElementById('matchedClear');

  let selectedMeta = null;
  let searchTimer = null;
  let searchSeq = 0;

  const clearMatch = () => {
    selectedMeta = null;

    if (matchedPreview) {
      matchedPreview.style.display = 'none';
    }

    if (matchedArt) {
      matchedArt.src = '';
    }
  };

  const renderMatchedPreview = (item) => {
    if (!matchedPreview) return;

    matchedArt.src =
      selectedMeta?.artwork || '';

    matchedTitle.textContent =
      item.trackName || titleInput.value;

    matchedSub.textContent =
      [
        item.artistName,
        selectedMeta?.genre
      ]
        .filter(Boolean)
        .join(' · ') || 'Matched via iTunes';

    matchedPreview.style.display = 'flex';
  };

  const renderSearchResults = (items) => {
    if (!items.length) {
      searchResultsEl.innerHTML =
        '<div class="search-empty">No matches — try a different search, or tag it by hand below.</div>';

      searchResultsEl.hidden = false;

      return;
    }

    searchResultsEl.innerHTML = items
      .map(
        (r, i) => `
        <button
          type="button"
          class="search-result-item"
          data-idx="${i}"
        >
          <img
            class="search-result-thumb"
            src="${escapeHtml(r.artworkUrl60 || '')}"
            alt=""
            loading="lazy"
            onerror="this.style.visibility='hidden'"
          >

          <span class="search-result-meta">
            <span class="search-result-title">
              ${escapeHtml(
                r.trackName || 'Untitled'
              )}
            </span>

            <span class="search-result-artist">
              ${escapeHtml(
                r.artistName || ''
              )}
              ${
                r.primaryGenreName
                  ? ' · ' +
                    escapeHtml(
                      r.primaryGenreName
                    )
                  : ''
              }
            </span>
          </span>
        </button>
      `
      )
      .join('');

    searchResultsEl._items = items;
    searchResultsEl.hidden = false;
  };

  if (guessBtn) {
    guessBtn.addEventListener('click', () => {
      if (!titleInput.value.trim()) {
        titleInput.focus();
        titleInput.classList.add('shake');

        setTimeout(() => {
          titleInput.classList.remove('shake');
        }, 400);

        return;
      }

      const guess = estimateFeatures(
        titleInput.value,
        selectedMeta?.genre
      );

      bpmInput.value = guess.bpm;
      energyInput.value = guess.energy;
      moodInput.value = guess.mood;

      syncFieldLabels();
    });
  }

  if (searchInput && searchResultsEl) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();

      clearTimeout(searchTimer);

      if (!q) {
        searchResultsEl.hidden = true;

        if (searchStatus) {
          searchStatus.textContent = '';
        }

        return;
      }

      if (searchStatus) {
        searchStatus.textContent = 'Searching…';
      }

      const thisSeq = ++searchSeq;

      searchTimer = setTimeout(async () => {
        try {
          const res = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              q
            )}&media=music&entity=song&limit=6`
          );

          if (thisSeq !== searchSeq) return;

          if (!res.ok) {
            throw new Error('Bad response');
          }

          const data = await res.json();

          if (thisSeq !== searchSeq) return;

          renderSearchResults(
            data.results || []
          );

          if (searchStatus) {
            searchStatus.textContent = '';
          }
        } catch {
          if (thisSeq !== searchSeq) return;

          searchResultsEl.innerHTML =
            '<div class="search-empty">Couldn’t reach the music API right now — you can still tag the track manually below.</div>';

          searchResultsEl.hidden = false;

          if (searchStatus) {
            searchStatus.textContent = '';
          }
        }
      }, 350);
    });

    searchResultsEl.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest(
          '.search-result-item'
        );

        if (!btn) return;

        const item =
          searchResultsEl._items[
            Number(btn.dataset.idx)
          ];

        if (!item) return;

        titleInput.value =
          item.trackName || '';

        artistInput.value =
          item.artistName || '';

        selectedMeta = {
          artwork: (
            item.artworkUrl100 ||
            item.artworkUrl60 ||
            ''
          ).replace('100x100', '300x300'),

          previewUrl: item.previewUrl || '',

          genre:
            item.primaryGenreName || ''
        };

        const estimate = estimateFeatures(
          item.trackName || '',
          selectedMeta.genre
        );

        bpmInput.value = estimate.bpm;
        energyInput.value = estimate.energy;
        moodInput.value = estimate.mood;

        syncFieldLabels();

        renderMatchedPreview(item);

        searchResultsEl.hidden = true;
        searchInput.value = '';
      }
    );

    if (matchedClear) {
      matchedClear.addEventListener(
        'click',
        clearMatch
      );
    }

    [titleInput, artistInput].forEach(
      (el) =>
        el.addEventListener('input', () => {
          if (selectedMeta) {
            clearMatch();
          }
        })
    );

    document.addEventListener('click', (e) => {
      if (searchResultsEl.hidden) return;

      if (
        !searchResultsEl.contains(e.target) &&
        e.target !== searchInput
      ) {
        searchResultsEl.hidden = true;
      }
    });
  }

  // ==========================================================
  // ---------- EDIT MODE ----------
  // ==========================================================

  let editingId = null;

  const submitBtn =
    form?.querySelector(
      'button[type="submit"]'
    );

  const editBanner =
    document.createElement('p');

  editBanner.className = 'form-sub';
  editBanner.id = 'editBanner';

  editBanner.style.cssText =
    'color:var(--current);display:none;margin:-8px 0 12px';

  if (submitBtn) {
    submitBtn.insertAdjacentElement(
      'beforebegin',
      editBanner
    );
  }

  const trackFormCardEl =
    document.getElementById('trackFormCard');

  const enterEditMode = (track) => {
    editingId = track.id;

    titleInput.value = track.title;
    artistInput.value =
      track.artist || '';

    bpmInput.value = track.bpm;
    energyInput.value = track.energy;
    moodInput.value = track.mood;

    syncFieldLabels();

    selectedMeta =
      track.artwork ||
      track.previewUrl ||
      track.genre
        ? {
            artwork: track.artwork || '',
            previewUrl:
              track.previewUrl || '',
            genre: track.genre || ''
          }
        : null;

    if (selectedMeta) {
      renderMatchedPreview({
        trackName: track.title,
        artistName: track.artist
      });
    } else {
      clearMatch();
    }

    if (submitBtn) {
      submitBtn.innerHTML =
        'Save changes <span class="arrow">→</span>';
    }

    editBanner.textContent =
      `Editing "${track.title}" — changes save back to this track.`;

    editBanner.style.display = 'block';

    if (trackFormCardEl) {
      trackFormCardEl.scrollIntoView({
        behavior: reduceMotion
          ? 'auto'
          : 'smooth',

        block: 'start'
      });
    }

    titleInput.focus();
  };

  const exitEditMode = () => {
    editingId = null;

    if (submitBtn) {
      submitBtn.innerHTML =
        'Add to library <span class="arrow">→</span>';
    }

    editBanner.style.display = 'none';
  };

  // ---------- Add / Save track ----------

  if (form) {
    form.addEventListener(
      'submit',
      (e) => {
        e.preventDefault();

        const title =
          titleInput.value.trim();

        if (!title) {
          titleInput.focus();
          return;
        }

        const artist =
          artistInput.value.trim();

        const isDupe = tracks.some(
          (t) =>
            t.id !== editingId &&
            t.title
              .trim()
              .toLowerCase() ===
              title.toLowerCase() &&
            (t.artist || '')
              .trim()
              .toLowerCase() ===
              artist.toLowerCase()
        );

        if (
          isDupe &&
          !confirm(
            `"${title}"${
              artist
                ? ' by ' + artist
                : ''
            } is already in your library. Add it again anyway?`
          )
        ) {
          return;
        }

        const payload = {
          title,
          artist,
          bpm: Number(bpmInput.value),
          energy: Number(
            energyInput.value
          ),
          mood: Number(moodInput.value),

          artwork: selectedMeta
            ? selectedMeta.artwork
            : undefined,

          previewUrl: selectedMeta
            ? selectedMeta.previewUrl
            : undefined,

          genre: selectedMeta
            ? selectedMeta.genre
            : undefined,

          source: selectedMeta
            ? 'iTunes'
            : 'Tagged'
        };

        if (editingId) {
          tracks = tracks.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  ...payload
                }
              : t
          );

          exitEditMode();
        } else {
          tracks.push({
            id:
              `t${Date.now()}${Math.floor(
                Math.random() * 1000
              )}`,

            ...payload
          });
        }

        saveTracks();
        renderAll();

        form.reset();

        bpmInput.value = 100;
        energyInput.value = 5;
        moodInput.value = 5;

        syncFieldLabels();
        clearMatch();

        titleInput.focus();
      }
    );
  }

  // ---------- Audio preview ----------

  const previewAudio = new Audio();

  let previewingId = null;

  const stopPreview = () => {
    previewAudio.pause();
    previewingId = null;

    songList
      .querySelectorAll(
        '.play-btn.playing'
      )
      .forEach((b) => {
        b.classList.remove('playing');
        b.textContent = '▶';
      });
  };

  previewAudio.addEventListener(
    'ended',
    stopPreview
  );

  if (songList) {
    songList.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest(
          'button[data-action]'
        );

        if (!btn) return;

        const row =
          btn.closest('.song-row');

        const id =
          row?.dataset.id;

        if (!id) return;

        // Remove
        if (
          btn.dataset.action ===
          'remove'
        ) {
          if (previewingId === id) {
            stopPreview();
          }

          if (editingId === id) {
            exitEditMode();
          }

          tracks = tracks.filter(
            (t) => String(t.id) !== String(id)
          );

          saveTracks();
          renderAll();

          return;
        }

        // Edit
        if (
          btn.dataset.action === 'edit'
        ) {
          const track = tracks.find(
            (t) =>
              String(t.id) === String(id)
          );

          if (track) {
            enterEditMode(track);
          }

          return;
        }

        // Play
        if (
          btn.dataset.action === 'play'
        ) {
          const track = tracks.find(
            (t) =>
              String(t.id) === String(id)
          );

          const wasPlaying =
            btn.classList.contains(
              'playing'
            );

          stopPreview();

          if (wasPlaying) return;

          if (
            track &&
            track.previewUrl
          ) {
            previewAudio.src =
              track.previewUrl;

            previewAudio
              .play()
              .then(() => {
                previewingId = id;

                btn.classList.add(
                  'playing'
                );

                btn.textContent = '❚❚';
              })
              .catch(() => {});
          } else {
            btn.classList.add(
              'playing'
            );

            btn.textContent = '❚❚';

            setTimeout(() => {
              if (!previewingId) {
                btn.classList.remove(
                  'playing'
                );

                btn.textContent = '▶';
              }
            }, 700);
          }
        }
      }
    );
  }

  // ==========================================================
  // ---------- PLAYLISTS & SEQUENCES ----------
  // ==========================================================

  const playlistName =
    document.getElementById(
      'playlistName'
    );

  const createPlaylist =
    document.getElementById(
      'createPlaylist'
    );

  const playlistList =
    document.getElementById(
      'playlistList'
    );

  const sequenceName =
    document.getElementById(
      'sequenceName'
    );

  const createSequence =
    document.getElementById(
      'createSequence'
    );

  const sequenceHint =
    document.getElementById(
      'sequenceHint'
    );

  const sequenceList =
    document.getElementById(
      'sequenceList'
    );

  const targetBpm =
    document.getElementById(
      'targetBpm'
    );

  const targetBpmVal =
    document.getElementById(
      'targetBpmVal'
    );

  const sequenceResult =
    document.getElementById(
      'sequenceResult'
    );

  const sequenceResultName =
    document.getElementById(
      'sequenceResultName'
    );

  const sequenceResultCount =
    document.getElementById(
      'sequenceResultCount'
    );

  const scoreNumber =
    document.getElementById(
      'scoreNumber'
    );

  const routeList =
    document.getElementById(
      'routeList'
    );

  const sequenceCta =
    document.getElementById(
      'sequenceCta'
    );

  const loadPersonal = (name) =>
    window.SequencerStore
      ? window.SequencerStore.get(
          name,
          []
        )
      : [];

  const savePersonal = (
    name,
    value
  ) =>
    window.SequencerStore
      ? window.SequencerStore.set(
          name,
          value
        )
      : null;

  const scoreQuality = (score) => {
    if (score >= 85) {
      return {
        label: 'Buttery smooth'
      };
    }

    if (score >= 65) {
      return {
        label: 'Solid flow'
      };
    }

    if (score >= 40) {
      return {
        label:
          'A few noticeable jumps'
      };
    }

    return {
      label:
        'Choppy — try a wider tempo start'
    };
  };

  const renderSequenceResult = (
    sequence
  ) => {
    if (!sequence) {
      if (sequenceResult) {
        sequenceResult.style.display =
          'none';
      }

      return;
    }

    const byId = new Map(
      tracks.map((t) => [
        String(t.id),
        t
      ])
    );

    const orderedTracks =
      sequence.trackIds
        .map((id) =>
          byId.get(String(id))
        )
        .filter(Boolean);

    sequenceResult.style.display =
      'block';

    sequenceResultName.textContent =
      sequence.name;

    sequenceResultCount.textContent =
      `${orderedTracks.length} track${
        orderedTracks.length === 1
          ? ''
          : 's'
      }`;

    scoreNumber.textContent =
      orderedTracks.length
        ? sequence.smoothness
        : '—';

    const quality = scoreQuality(
      sequence.smoothness || 0
    );

    const scoreExplain =
      document.getElementById(
        'scoreExplain'
      );

    if (scoreExplain) {
      scoreExplain.innerHTML = `
        <strong style="color:var(--chalk)">
          ${quality.label}.
        </strong>
        Every consecutive pair's distance across normalized tempo,
        energy, and mood is averaged, then converted to a 0-100 score.
      `;
    }

    if (!orderedTracks.length) {
      routeList.innerHTML =
        '<p class="form-sub">Some tracks in this sequence have been removed from your library.</p>';

      sequenceCta.style.display =
        'none';

      return;
    }

    const transitionsById =
      new Map(
        (sequence.transitions || []).map(
          (t) => [
            `${t.fromId}->${t.toId}`,
            t
          ]
        )
      );

    routeList.innerHTML =
      orderedTracks
        .map((t, i) => {
          const prev =
            orderedTracks[i - 1];

          const trans = prev
            ? transitionsById.get(
                `${prev.id}->${t.id}`
              )
            : null;

          const deltaText = trans
            ? `Δ${trans.deltaBpm} bpm · Δ${trans.deltaEnergy} energy · Δ${trans.deltaMood} mood`
            : '';

          const jumpPct = trans
            ? Math.round(
                (1 -
                  trans.distance /
                    MAX_POSSIBLE_DISTANCE) *
                  100
              )
            : null;

          const jumpChip = trans
            ? `<span class="route-jump-chip ${
                jumpPct < 55
                  ? 'jump-warm'
                  : ''
              }">${jumpPct}% smooth</span>`
            : `<span class="route-start-chip">Start</span>`;

          return `
            <div class="route-item">
              <span class="route-index">
                ${String(i + 1).padStart(
                  2,
                  '0'
                )}
              </span>

              <div class="route-track">
                <div class="song-title">
                  ${escapeHtml(t.title)}
                </div>

                <div class="song-artist">
                  ${escapeHtml(
                    t.artist ||
                    'Unknown artist'
                  )}
                  · ${t.bpm} bpm
                  · ${moodLabel(t.mood)}
                </div>
              </div>

              <div class="route-transition">
                ${jumpChip}

                ${
                  deltaText
                    ? `<span class="route-delta">${deltaText}</span>`
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

    sequenceCta.style.display =
      'flex';
  };

  const renderCollections = () => {
    const playlists =
      loadPersonal('playlists');

    const sequences =
      loadPersonal('sequences');

    if (playlistList) {
      playlistList.innerHTML =
        playlists.length
          ? playlists
              .map(
                (p) => `
                <div class="song-row" data-playlist-id="${escapeHtml(p.id)}">
                  <div class="song-main">
                    <div>
                      <div class="song-title">
                        ${escapeHtml(p.name)}
                      </div>

                      <div class="song-artist">
                        ${p.trackIds.length} track${
                          p.trackIds.length === 1
                            ? ''
                            : 's'
                        }
                      </div>
                    </div>
                  </div>

                  <button
                    class="row-remove"
                    data-action="remove-playlist"
                    data-id="${escapeHtml(p.id)}"
                    aria-label="Delete ${escapeHtml(p.name)}"
                  >
                    ×
                  </button>
                </div>
              `
              )
              .join('')
          : '<p class="form-sub">No playlists yet.</p>';
    }

    if (sequenceList) {
      sequenceList.innerHTML =
        sequences.length
          ? sequences
              .slice()
              .reverse()
              .map(
                (q) => `
                <div class="song-row" data-sequence-id="${escapeHtml(q.id)}">
                  <div class="song-main">
                    <div>
                      <div class="song-title">
                        ${escapeHtml(q.name)}
                      </div>

                      <div class="song-artist">
                        ${q.tempo} bpm start
                        · ${q.trackIds.length} tracks
                        · ${q.smoothness ?? '—'}% smooth
                      </div>
                    </div>
                  </div>

                  <button
                    class="btn btn-secondary btn-sm"
                    data-action="view-sequence"
                    data-id="${escapeHtml(q.id)}"
                  >
                    View
                  </button>

                  <button
                    class="row-remove"
                    data-action="remove-sequence"
                    data-id="${escapeHtml(q.id)}"
                    aria-label="Delete ${escapeHtml(q.name)}"
                  >
                    ×
                  </button>
                </div>
              `
              )
              .join('')
          : '<p class="form-sub">No sequences yet.</p>';
    }
  };

  const syncSequenceControls = () => {
    if (!createSequence) return;

    const canSequence =
      tracks.length >= 2;

    createSequence.disabled =
      !canSequence;

    if (sequenceHint) {
      sequenceHint.textContent =
        canSequence
          ? 'Sequencer walks the nearest unplayed track each step, starting near your target tempo, then refines the route with 2-opt.'
          : 'Tag at least 2 tracks to build a sequence.';
    }
  };

  if (targetBpm) {
    targetBpm.addEventListener(
      'input',
      () => {
        if (targetBpmVal) {
          targetBpmVal.textContent =
            targetBpm.value + ' bpm';
        }
      }
    );
  }

  // ---------- Create playlist ----------

  if (createPlaylist) {
    createPlaylist.addEventListener(
      'click',
      () => {
        if (!tracks.length) return;

        const playlists =
          loadPersonal('playlists');

        const name =
          (
            playlistName?.value ||
            `Playlist ${
              playlists.length + 1
            }`
          ).trim();

        playlists.push({
          id:
            'pl_' + Date.now(),

          name,

          trackIds:
            tracks.map((t) => t.id),

          createdAt:
            new Date().toISOString()
        });

        savePersonal(
          'playlists',
          playlists
        );

        if (playlistName) {
          playlistName.value = '';
        }

        renderCollections();
      }
    );
  }

  // ---------- Create sequence ----------

  if (createSequence) {
    createSequence.addEventListener(
      'click',
      () => {
        if (tracks.length < 2) return;

        const result =
          buildSequence(
            tracks,
            Number(targetBpm.value)
          );

        if (!result) return;

        const sequences =
          loadPersonal('sequences');

        const seqObj = {
          id:
            'seq_' + Date.now(),

          name:
            (
              sequenceName?.value ||
              `Flow ${
                sequences.length + 1
              }`
            ).trim(),

          tempo:
            Number(targetBpm.value),

          trackIds:
            result.order.map(
              (t) => t.id
            ),

          transitions:
            result.transitions,

          smoothness:
            result.smoothness,

          createdAt:
            new Date().toISOString()
        };

        sequences.push(seqObj);

        savePersonal(
          'sequences',
          sequences
        );

        if (sequenceName) {
          sequenceName.value = '';
        }

        activeSequence = seqObj;

        renderCollections();
        renderSequenceResult(seqObj);
        renderEdges(seqObj);

        if (sequenceResult) {
          sequenceResult.scrollIntoView({
            behavior: reduceMotion
              ? 'auto'
              : 'smooth',

            block: 'start'
          });
        }
      }
    );
  }

  // ---------- Sequence actions ----------

  if (sequenceList) {
    sequenceList.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest(
          'button[data-action]'
        );

        if (!btn) return;

        const id =
          btn.dataset.id;

        if (
          btn.dataset.action ===
          'view-sequence'
        ) {
          const seq =
            loadPersonal(
              'sequences'
            ).find(
              (s) =>
                String(s.id) ===
                String(id)
            );

          if (!seq) return;

          activeSequence = seq;

          renderSequenceResult(seq);
          renderEdges(seq);

          if (sequenceResult) {
            sequenceResult.scrollIntoView({
              behavior: reduceMotion
                ? 'auto'
                : 'smooth',

              block: 'start'
            });
          }
        }

        if (
          btn.dataset.action ===
          'remove-sequence'
        ) {
          let sequences =
            loadPersonal('sequences');

          sequences =
            sequences.filter(
              (s) =>
                String(s.id) !==
                String(id)
            );

          savePersonal(
            'sequences',
            sequences
          );

          if (
            activeSequence &&
            String(
              activeSequence.id
            ) === String(id)
          ) {
            activeSequence = null;

            renderSequenceResult(null);
            renderEdges(null);
          }

          renderCollections();
        }
      }
    );
  }

  // ---------- Playlist actions ----------

  if (playlistList) {
    playlistList.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest(
          'button[data-action="remove-playlist"]'
        );

        if (!btn) return;

        let playlists =
          loadPersonal('playlists');

        playlists =
          playlists.filter(
            (p) =>
              String(p.id) !==
              String(btn.dataset.id)
          );

        savePersonal(
          'playlists',
          playlists
        );

        renderCollections();
      }
    );
  }

  // ---------- Init ----------

  syncFieldLabels();
  renderAll();
  renderCollections();
});