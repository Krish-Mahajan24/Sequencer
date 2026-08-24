// ============================================================================
// SEQUENCER — SEQUENCE PAGE
// ============================================================================
// Handles:
// - Track CRUD
// - Track artwork
// - iTunes song search
// - Audio previews
// - Generated demo audio for tracks without preview URLs
// - Energy × Mood map
// - Playlist creation
// - Sequence creation
// - Nearest-neighbour + 2-opt sequencing
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // STORAGE
  // ==========================================================================

  const STORAGE_KEY = window.SequencerStore
    ? window.SequencerStore.key('library')
    : 'sequencer_library';

  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  // ==========================================================================
  // MOOD
  // ==========================================================================

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

  const moodLabel = (value) => {

    const number =
      Math.max(
        0,
        Math.min(
          10,
          Math.round(Number(value) || 0)
        )
      );

    return MOOD_STEPS[number];
  };


  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const escapeHtml = (value) => {

    return String(value ?? '').replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character])
    );
  };

  const escapeAttr = escapeHtml;


  // ==========================================================================
  // SEED TRACKS
  // ==========================================================================

  /*
   * These are your original demo tracks.
   *
   * They don't necessarily exist on iTunes, therefore they may not have
   * a real previewUrl.
   *
   * The new audio system below creates a small generated demo preview
   * for these tracks so the play button actually works.
   */

  const SEED_TRACKS = [
    {
      id: 't1',
      title: 'Low Tide',
      artist: 'Nightbound',
      bpm: 68,
      energy: 2,
      mood: 1,
      genre: 'Ambient'
    },

    {
      id: 't2',
      title: 'Slow Static',
      artist: 'Nightbound',
      bpm: 78,
      energy: 3,
      mood: 3,
      genre: 'Electronic'
    },

    {
      id: 't3',
      title: 'Half Light',
      artist: 'Reverie',
      bpm: 96,
      energy: 5,
      mood: 5,
      genre: 'Electronic'
    },

    {
      id: 't4',
      title: 'Wire & Wave',
      artist: 'Reverie',
      bpm: 112,
      energy: 7,
      mood: 7,
      genre: 'R&B/Soul'
    },

    {
      id: 't5',
      title: 'Redline',
      artist: 'Kilo Sun',
      bpm: 128,
      energy: 9,
      mood: 9,
      genre: 'Electronic'
    }
  ];


  // ==========================================================================
  // LOAD TRACKS
  // ==========================================================================

  const loadTracks = () => {

    try {

      const raw =
        localStorage.getItem(STORAGE_KEY);

      if (raw === null) {
        return SEED_TRACKS.map(track => ({
          ...track
        }));
      }

      const parsed =
        JSON.parse(raw);

      return Array.isArray(parsed)
        ? parsed
        : [];

    } catch {

      return SEED_TRACKS.map(track => ({
        ...track
      }));
    }
  };


  let tracks = loadTracks();

  let activeSequence = null;

  let activePlaylist = null;


  // ==========================================================================
  // SAVE TRACKS
  // ==========================================================================

  const saveTracks = () => {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tracks)
      );

    } catch {

      console.warn(
        'Could not save tracks.'
      );

    }
  };


  // ==========================================================================
  // PERSONAL STORAGE
  // ==========================================================================

  const loadPersonal = (name) => {

    return window.SequencerStore
      ? window.SequencerStore.get(name, [])
      : [];
  };

  const savePersonal = (name, value) => {

    if (window.SequencerStore) {

      return window.SequencerStore.set(
        name,
        value
      );

    }

    return null;
  };


  // ==========================================================================
  // DOM ELEMENTS
  // ==========================================================================

  const form =
    document.getElementById('trackForm');

  const titleInput =
    document.getElementById('fTitle');

  const artistInput =
    document.getElementById('fArtist');

  const bpmInput =
    document.getElementById('fBpm');

  const bpmVal =
    document.getElementById('fBpmVal');

  const energyInput =
    document.getElementById('fEnergy');

  const energyVal =
    document.getElementById('fEnergyVal');

  const moodInput =
    document.getElementById('fMood');

  const moodVal =
    document.getElementById('fMoodVal');

  const guessBtn =
    document.getElementById('guessBtn');

  const songList =
    document.getElementById('songList');

  const listCount =
    document.getElementById('listCount');

  const scatterPlot =
    document.getElementById('scatterPlot');

  const scatterEmpty =
    document.getElementById('scatterEmpty');

  const scatterEdges =
    document.getElementById('scatterEdges');

  const scatterHint =
    document.getElementById('scatterHint');

  const statCount =
    document.getElementById('statCount');

  const statBpm =
    document.getElementById('statBpm');

  const statEnergy =
    document.getElementById('statEnergy');

  const statSpread =
    document.getElementById('statSpread');


  // ==========================================================================
  // SEARCH ELEMENTS
  // ==========================================================================

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


  // ==========================================================================
  // PLAYLIST / SEQUENCE ELEMENTS
  // ==========================================================================

  const playlistName =
    document.getElementById('playlistName');

  const createPlaylist =
    document.getElementById('createPlaylist');

  const playlistList =
    document.getElementById('playlistList');

  const sequenceName =
    document.getElementById('sequenceName');

  const createSequence =
    document.getElementById('createSequence');

  const sequenceHint =
    document.getElementById('sequenceHint');

  const sequenceList =
    document.getElementById('sequenceList');

  const targetBpm =
    document.getElementById('targetBpm');

  const targetBpmVal =
    document.getElementById('targetBpmVal');

  const sequenceResult =
    document.getElementById('sequenceResult');

  const sequenceResultName =
    document.getElementById('sequenceResultName');

  const sequenceResultCount =
    document.getElementById('sequenceResultCount');

  const scoreNumber =
    document.getElementById('scoreNumber');

  const routeList =
    document.getElementById('routeList');

  const sequenceCta =
    document.getElementById('sequenceCta');


  // ==========================================================================
  // PLAYLIST WIZARD
  // ==========================================================================

  const playlistStep =
    document.getElementById('playlistStep');

  const addTrackStep =
    document.getElementById('addTrackStep');

  const wizStep1Tab =
    document.getElementById('wizStep1Tab');

  const wizStep2Tab =
    document.getElementById('wizStep2Tab');

  const activePlaylistNameEl =
    document.getElementById('activePlaylistName');

  const backToPlaylistsBtn =
    document.getElementById('backToPlaylists');

  const finishPlaylistBtn =
    document.getElementById('finishPlaylist');

  const existingPlaylistsHead =
    document.getElementById('existingPlaylistsHead');


  // ==========================================================================
  // FORM LABELS
  // ==========================================================================

  const syncFieldLabels = () => {

    if (bpmVal && bpmInput) {
      bpmVal.textContent =
        `${bpmInput.value} bpm`;
    }

    if (energyVal && energyInput) {
      energyVal.textContent =
        `${energyInput.value} / 10`;
    }

    if (moodVal && moodInput) {
      moodVal.textContent =
        moodLabel(moodInput.value);
    }
  };


  // ==========================================================================
  // ESTIMATE FEATURES
  // ==========================================================================

  const hashString = (value) => {

    let hash = 0;

    const string =
      String(value || '');

    for (
      let i = 0;
      i < string.length;
      i++
    ) {

      hash =
        ((hash << 5) -
          hash +
          string.charCodeAt(i)) |
        0;
    }

    return Math.abs(hash);
  };


  const estimateFeatures = (
    title,
    genre = ''
  ) => {

    const text =
      `${title} ${genre}`.toLowerCase();

    const h =
      hashString(text);

    let profile = {
      bpm: [80, 125],
      energy: [3, 7],
      mood: [3, 7]
    };


    if (
      /ambient|chill|acoustic|folk|classical/.test(
        text
      )
    ) {

      profile = {
        bpm: [65, 105],
        energy: [1, 5],
        mood: [0, 5]
      };

    } else if (
      /rock|metal|punk/.test(text)
    ) {

      profile = {
        bpm: [90, 155],
        energy: [6, 10],
        mood: [5, 10]
      };

    } else if (
      /dance|electronic|house|techno/.test(text)
    ) {

      profile = {
        bpm: [110, 145],
        energy: [6, 10],
        mood: [5, 10]
      };

    } else if (
      /hip hop|rap|r&b|soul/.test(text)
    ) {

      profile = {
        bpm: [75, 120],
        energy: [3, 9],
        mood: [3, 9]
      };
    }


    const bpmSpan =
      profile.bpm[1] -
      profile.bpm[0];

    const energySpan =
      profile.energy[1] -
      profile.energy[0];

    const moodSpan =
      profile.mood[1] -
      profile.mood[0];


    return {

      bpm:
        Math.round(
          profile.bpm[0] +
          (h % (bpmSpan + 1))
        ),

      energy:
        Math.round(
          profile.energy[0] +
          ((h >> 3) %
            (energySpan + 1))
        ),

      mood:
        Math.round(
          profile.mood[0] +
          ((h >> 7) %
            (moodSpan + 1))
        )
    };
  };


  // ==========================================================================
  // SONG COVER GENERATOR
  // ==========================================================================
  //
  // No gradient.
  //
  // For tracks that don't have real artwork, we create a small SVG poster
  // containing the track initials and artist initials.
  //
  // This also means Low Tide / Slow Static / Redline will ALWAYS have
  // something visible in the poster area.
  // ==========================================================================

  const createGeneratedCover = (track) => {

    const title =
      String(track.title || 'Track');

    const artist =
      String(track.artist || 'Unknown');

    const titleWords =
      title
        .split(/\s+/)
        .filter(Boolean);

    const artistWords =
      artist
        .split(/\s+/)
        .filter(Boolean);


    let initials =
      titleWords
        .map(word =>
          word.charAt(0)
        )
        .join('')
        .slice(0, 2)
        .toUpperCase();


    if (!initials) {
      initials = '♪';
    }


    const artistInitials =
      artistWords
        .map(word =>
          word.charAt(0)
        )
        .join('')
        .slice(0, 3)
        .toUpperCase();


    const svg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="300"
        height="300"
        viewBox="0 0 300 300"
      >

        <rect
          width="300"
          height="300"
          fill="#191017"
        />

        <rect
          x="18"
          y="18"
          width="264"
          height="264"
          rx="20"
          fill="none"
          stroke="#ff3d81"
          stroke-opacity=".55"
          stroke-width="2"
        />

        <circle
          cx="245"
          cy="55"
          r="26"
          fill="#ff3d81"
          fill-opacity=".12"
        />

        <circle
          cx="55"
          cy="245"
          r="38"
          fill="#ff3d81"
          fill-opacity=".08"
        />

        <text
          x="150"
          y="155"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="#f7f1f4"
          font-family="Arial, Helvetica, sans-serif"
          font-size="76"
          font-weight="700"
        >
          ${escapeHtml(initials)}
        </text>

        <text
          x="150"
          y="220"
          text-anchor="middle"
          fill="#b6a7ae"
          font-family="Arial, Helvetica, sans-serif"
          font-size="16"
          letter-spacing="3"
        >
          ${escapeHtml(artistInitials)}
        </text>

      </svg>
    `;


    return (
      'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(svg)
    );
  };


  // ==========================================================================
  // GET COVER
  // ==========================================================================

  const getTrackArtwork = (track) => {

    if (track.artwork) {
      return track.artwork;
    }

    return createGeneratedCover(track);
  };


  // ==========================================================================
  // RENDER COVER HTML
  // ==========================================================================

  const renderTrackCover = (track) => {

    const artwork =
      getTrackArtwork(track);

    return `
      <div class="song-cover">

        <img
          src="${escapeAttr(artwork)}"
          alt="${escapeAttr(track.title || 'Track')}"
          loading="lazy"
          onerror="
            this.onerror=null;
            this.src='${escapeAttr(
              createGeneratedCover(track)
            )}';
          "
        >

      </div>
    `;
  };


  // ==========================================================================
  // SONG SEARCH STATE
  // ==========================================================================

  let selectedMeta = null;

  let searchTimer = null;

  let searchSeq = 0;


  const clearMatch = () => {

    selectedMeta = null;

    if (matchedPreview) {
      matchedPreview.style.display =
        'none';
    }

    if (matchedArt) {
      matchedArt.src = '';
    }
  };


  const renderMatchedPreview = (item) => {

    if (!selectedMeta) {
      return;
    }

    if (matchedArt) {

      matchedArt.src =
        selectedMeta.artwork || '';
    }

    if (matchedTitle) {

      matchedTitle.textContent =
        item.trackName ||
        titleInput.value;
    }

    if (matchedSub) {

      matchedSub.textContent =
        [
          item.artistName,
          selectedMeta.genre
        ]
          .filter(Boolean)
          .join(' · ') ||
        'Matched via iTunes';
    }

    if (matchedPreview) {

      matchedPreview.style.display =
        'flex';
    }
  };


  // ==========================================================================
  // SEARCH RESULTS
  // ==========================================================================

  const renderSearchResults = (items) => {

    if (!searchResultsEl) {
      return;
    }

    if (!items.length) {

      searchResultsEl.innerHTML = `
        <div class="search-empty">
          No matches — try a different search,
          or tag the track by hand below.
        </div>
      `;

      searchResultsEl.hidden =
        false;

      return;
    }


    searchResultsEl.innerHTML =
      items.map(
        (result, index) => `

          <button
            type="button"
            class="search-result-item"
            data-idx="${index}"
          >

            <img
              class="search-result-thumb"
              src="${escapeAttr(
                result.artworkUrl60 || ''
              )}"
              alt=""
              loading="lazy"
              onerror="
                this.style.visibility='hidden'
              "
            >

            <span class="search-result-meta">

              <span class="search-result-title">
                ${escapeHtml(
                  result.trackName ||
                  'Untitled'
                )}
              </span>

              <span class="search-result-artist">
                ${escapeHtml(
                  result.artistName || ''
                )}

                ${
                  result.primaryGenreName
                    ? ` · ${escapeHtml(
                        result.primaryGenreName
                      )}`
                    : ''
                }

              </span>

            </span>

          </button>

        `
      ).join('');


    searchResultsEl._items =
      items;

    searchResultsEl.hidden =
      false;
  };


  // ==========================================================================
  // SONG SEARCH
  // ==========================================================================

  if (
    searchInput &&
    searchResultsEl
  ) {

    searchInput.addEventListener(
      'input',
      () => {

        const query =
          searchInput.value.trim();

        clearTimeout(
          searchTimer
        );


        if (!query) {

          searchResultsEl.hidden =
            true;

          if (searchStatus) {
            searchStatus.textContent =
              '';
          }

          return;
        }


        if (searchStatus) {
          searchStatus.textContent =
            'Searching…';
        }


        const currentSearch =
          ++searchSeq;


        searchTimer =
          setTimeout(
            async () => {

              try {

                const response =
                  await fetch(
                    `https://itunes.apple.com/search?term=${encodeURIComponent(
                      query
                    )}&media=music&entity=song&limit=6`
                  );


                if (
                  currentSearch !==
                  searchSeq
                ) {
                  return;
                }


                if (!response.ok) {
                  throw new Error(
                    'Search failed'
                  );
                }


                const data =
                  await response.json();


                if (
                  currentSearch !==
                  searchSeq
                ) {
                  return;
                }


                renderSearchResults(
                  data.results || []
                );


                if (searchStatus) {
                  searchStatus.textContent =
                    '';
                }

              } catch {

                if (
                  currentSearch !==
                  searchSeq
                ) {
                  return;
                }


                searchResultsEl.innerHTML = `
                  <div class="search-empty">
                    Couldn't reach the music API
                    right now — you can still
                    tag the track manually.
                  </div>
                `;

                searchResultsEl.hidden =
                  false;

                if (searchStatus) {
                  searchStatus.textContent =
                    '';
                }
              }

            },
            350
          );
      }
    );


    searchResultsEl.addEventListener(
      'click',
      event => {

        const button =
          event.target.closest(
            '.search-result-item'
          );

        if (!button) {
          return;
        }


        const item =
          searchResultsEl._items[
            Number(button.dataset.idx)
          ];


        if (!item) {
          return;
        }


        if (titleInput) {
          titleInput.value =
            item.trackName || '';
        }

        if (artistInput) {
          artistInput.value =
            item.artistName || '';
        }


        selectedMeta = {

          artwork:
            (
              item.artworkUrl100 ||
              item.artworkUrl60 ||
              ''
            )
              .replace(
                '100x100',
                '300x300'
              )
              .replace(
                '60x60',
                '300x300'
              ),

          previewUrl:
            item.previewUrl || '',

          genre:
            item.primaryGenreName || ''
        };


        const estimate =
          estimateFeatures(
            item.trackName || '',
            selectedMeta.genre
          );


        if (bpmInput) {
          bpmInput.value =
            estimate.bpm;
        }

        if (energyInput) {
          energyInput.value =
            estimate.energy;
        }

        if (moodInput) {
          moodInput.value =
            estimate.mood;
        }


        syncFieldLabels();

        renderMatchedPreview(
          item
        );


        searchResultsEl.hidden =
          true;

        searchInput.value =
          '';
      }
    );
  }


  if (matchedClear) {

    matchedClear.addEventListener(
      'click',
      clearMatch
    );
  }


  document.addEventListener(
    'click',
    event => {

      if (
        !searchResultsEl ||
        searchResultsEl.hidden
      ) {
        return;
      }


      if (
        !searchResultsEl.contains(
          event.target
        ) &&
        event.target !== searchInput
      ) {

        searchResultsEl.hidden =
          true;
      }
    }
  );


  // ==========================================================================
  // ADD TRACK
  // ==========================================================================

  if (form) {

    form.addEventListener(
      'submit',
      event => {

        event.preventDefault();


        const title =
          titleInput
            ? titleInput.value.trim()
            : '';


        if (!title) {

          if (titleInput) {
            titleInput.focus();
          }

          return;
        }


        const newTrack = {
              id: `t${Date.now()}${Math.floor(Math.random() * 1000)}`,
              title,
              artist: artistInput.value.trim(),
              bpm: Number(bpmInput.value),
              energy: Number(energyInput.value),
              mood: Number(moodInput.value),

              artwork: selectedMeta ? selectedMeta.artwork : '',
              previewUrl: selectedMeta ? selectedMeta.previewUrl : '',
              genre: selectedMeta ? selectedMeta.genre : '',
              source: selectedMeta ? 'iTunes' : 'Tagged',

              // NEW
              liked: false
        };


        tracks.push(
          newTrack
        );

        saveTracks();


        // --------------------------------------------------------------
        // Add to active playlist
        // --------------------------------------------------------------

        if (activePlaylist) {

          const playlists =
            loadPersonal(
              'playlists'
            );


          const match =
            playlists.find(
              playlist =>
                String(playlist.id) ===
                String(activePlaylist.id)
            );


          if (match) {

            if (
              !Array.isArray(
                match.trackIds
              )
            ) {
              match.trackIds = [];
            }


            if (
              !match.trackIds.some(
                id =>
                  String(id) ===
                  String(newTrack.id)
              )
            ) {

              match.trackIds.push(
                newTrack.id
              );
            }


            savePersonal(
              'playlists',
              playlists
            );


            activePlaylist =
              match;
          }
        }


        renderAll();

        renderCollections();


        // Reset form

        form.reset();


        if (bpmInput) {
          bpmInput.value =
            100;
        }

        if (energyInput) {
          energyInput.value =
            5;
        }

        if (moodInput) {
          moodInput.value =
            5;
        }


        syncFieldLabels();

        clearMatch();


        if (titleInput) {
          titleInput.focus();
        }
      }
    );
  }


  // ==========================================================================
  // AUDIO SYSTEM
  // ==========================================================================

  const previewAudio =
    new Audio();

  previewAudio.preload =
    'none';

  let previewingId =
    null;


  // ==========================================================================
  // GENERATED DEMO AUDIO
  // ==========================================================================

  let demoAudioContext =
    null;

  let demoMasterGain =
    null;

  let demoOscillators =
    [];

  let demoTimeout =
    null;


  const stopDemoAudio = () => {

    if (demoTimeout) {

      clearTimeout(
        demoTimeout
      );

      demoTimeout =
        null;
    }


    demoOscillators.forEach(
      oscillator => {

        try {
          oscillator.stop();
        } catch {}

      }
    );


    demoOscillators =
      [];


    if (demoMasterGain) {

      try {
        demoMasterGain.disconnect();
      } catch {}

      demoMasterGain =
        null;
    }
  };


  // ==========================================================================
  // UPDATE PLAY BUTTONS
  // ==========================================================================

  const setPlayingUI = (id) => {

    if (!songList) {
      return;
    }


    songList
      .querySelectorAll(
        '.play-btn'
      )
      .forEach(button => {

        const row =
          button.closest(
            '.song-row'
          );

        const rowId =
          row
            ? String(row.dataset.id)
            : '';


        const isPlaying =
          id !== null &&
          id !== undefined &&
          rowId === String(id);


        button.classList.toggle(
          'playing',
          isPlaying
        );


        button.textContent =
          isPlaying
            ? '❚❚'
            : '▶';

      });
  };


  // ==========================================================================
  // STOP PREVIEW
  // ==========================================================================

  const stopPreview = () => {

    try {

      previewAudio.pause();

      previewAudio.currentTime =
        0;

    } catch {}


    stopDemoAudio();


    previewingId =
      null;


    setPlayingUI(
      null
    );
  };


  // ==========================================================================
  // DEMO AUDIO
  // ==========================================================================
  //
  // Used when a track has no real previewUrl.
  //
  // This makes Low Tide / Slow Static / Redline actually produce sound.
  // It is a generated demo and NOT the original recording.
  // ==========================================================================

  const playDemoAudio =
    async (track) => {

      stopDemoAudio();


      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;


      if (!AudioContext) {

        throw new Error(
          'Web Audio API unavailable'
        );
      }


      if (!demoAudioContext) {

        demoAudioContext =
          new AudioContext();
      }


      if (
        demoAudioContext.state ===
        'suspended'
      ) {

        await demoAudioContext.resume();
      }


      const bpm =
        Number(track.bpm) || 100;

      const beat =
        60 / bpm;


      demoMasterGain =
        demoAudioContext.createGain();


      demoMasterGain.gain.value =
        0.16;


      demoMasterGain.connect(
        demoAudioContext.destination
      );


      const baseFrequency =
        180 +
        (
          (Number(track.energy) || 5) *
          18
        );


      /*
       * Small melodic sequence.
       */

      const notes = [
        1,
        1.25,
        1.5,
        1.25,
        1.125,
        1.5,
        1.75,
        1.5
      ];


      const startTime =
        demoAudioContext.currentTime +
        0.03;


      notes.forEach(
        (multiplier, index) => {

          const oscillator =
            demoAudioContext.createOscillator();

          const gain =
            demoAudioContext.createGain();


          oscillator.type =
            track.energy >= 7
              ? 'sawtooth'
              : 'sine';


          oscillator.frequency.value =
            baseFrequency *
            multiplier;


          const start =
            startTime +
            index * beat;


          const end =
            start +
            beat * 0.82;


          gain.gain.setValueAtTime(
            0.0001,
            start
          );


          gain.gain.exponentialRampToValueAtTime(
            0.16,
            start + 0.025
          );


          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            end
          );


          oscillator.connect(
            gain
          );

          gain.connect(
            demoMasterGain
          );


          oscillator.start(
            start
          );

          oscillator.stop(
            end
          );


          demoOscillators.push(
            oscillator
          );
        }
      );


      previewingId =
        String(track.id);


      setPlayingUI(
        previewingId
      );


      demoTimeout =
        setTimeout(
          () => {

            if (
              previewingId ===
              String(track.id)
            ) {

              stopPreview();
            }

          },
          beat * 8 * 1000
        );
    };


  // ==========================================================================
  // REAL / DEMO PLAYBACK
  // ==========================================================================

  const playTrack =
    async (id) => {

      const track =
        tracks.find(
          item =>
            String(item.id) ===
            String(id)
        );


      if (!track) {
        return;
      }


      // Clicking current track pauses it.

      if (
        previewingId ===
        String(track.id)
      ) {

        stopPreview();

        return;
      }


      stopPreview();


      // --------------------------------------------------------------
      // REAL PREVIEW
      // --------------------------------------------------------------

      if (track.previewUrl) {

        try {

          previewAudio.src =
            track.previewUrl;

          previewAudio.load();

          await previewAudio.play();


          previewingId =
            String(track.id);


          setPlayingUI(
            previewingId
          );


          return;

        } catch (error) {

          console.warn(
            'Real preview failed:',
            error
          );

        }
      }


      // --------------------------------------------------------------
      // Try to repair metadata once more
      // --------------------------------------------------------------

      try {

        const result =
          await findTrackOnITunes(
            track
          );


        if (
          result &&
          result.previewUrl
        ) {

          track.previewUrl =
            result.previewUrl;


          if (
            !track.artwork &&
            (
              result.artworkUrl100 ||
              result.artworkUrl60
            )
          ) {

            track.artwork =
              (
                result.artworkUrl100 ||
                result.artworkUrl60
              )
                .replace(
                  '100x100',
                  '600x600'
                )
                .replace(
                  '60x60',
                  '600x600'
                );
          }


          if (
            !track.genre &&
            result.primaryGenreName
          ) {

            track.genre =
              result.primaryGenreName;
          }


          saveTracks();

          renderList();


          previewAudio.src =
            track.previewUrl;

          previewAudio.load();

          await previewAudio.play();


          previewingId =
            String(track.id);


          setPlayingUI(
            previewingId
          );


          return;
        }

      } catch (error) {

        console.warn(
          'Metadata repair failed:',
          error
        );
      }


      // --------------------------------------------------------------
      // GENERATED DEMO
      // --------------------------------------------------------------

      try {

        await playDemoAudio(
          track
        );

      } catch (error) {

        console.warn(
          'Demo audio failed:',
          error
        );

        stopPreview();
      }
    };


  previewAudio.addEventListener(
    'ended',
    () => {

      previewingId =
        null;

      setPlayingUI(
        null
      );
    }
  );


  // ==========================================================================
  // PLAY BUTTON EVENTS
  // ==========================================================================

 if (songList) {

  songList.addEventListener(
    'click',
    async event => {

      const button =
        event.target.closest(
          'button[data-action]'
        );

      if (!button) {
        return;
      }

      const row =
        button.closest(
          '.song-row'
        );

      const id =
        row
          ? row.dataset.id
          : null;

      if (!id) {
        return;
      }


      // --------------------------------------------------------------
      // ❤️ LIKE / UNLIKE
      // --------------------------------------------------------------

      if (button.dataset.action === 'like') {

        const track = tracks.find(
          t => String(t.id) === String(id)
        );

        if (!track) {
          return;
        }

        // Toggle liked state
        track.liked = !track.liked;

        // Save to localStorage
        saveTracks();

        // Refresh the track list
        renderAll();

        return;
      }


      // --------------------------------------------------------------
      // REMOVE
      // --------------------------------------------------------------

      if (
        button.dataset.action ===
        'remove'
      ) {

        if (
          previewingId ===
          String(id)
        ) {

          stopPreview();
        }

        tracks =
          tracks.filter(
            track =>
              String(track.id) !==
              String(id)
          );

        saveTracks();

        renderAll();

        return;
      }


      // --------------------------------------------------------------
      // PLAY
      // --------------------------------------------------------------

      if (
        button.dataset.action ===
        'play'
      ) {

        event.preventDefault();

        await playTrack(id);

      }

    }
  );

}
  // ==========================================================================
  // STATS
  // ==========================================================================

  const renderStats = () => {

    if (statCount) {
      statCount.textContent =
        tracks.length;
    }


    if (!tracks.length) {

      if (statBpm) {
        statBpm.textContent =
          '—';
      }

      if (statEnergy) {
        statEnergy.textContent =
          '—';
      }

      if (statSpread) {
        statSpread.textContent =
          '—';
      }

      return;
    }


    const bpms =
      tracks.map(
        track =>
          Number(track.bpm) || 0
      );


    const energies =
      tracks.map(
        track =>
          Number(track.energy) || 0
      );


    const moods =
      tracks.map(
        track =>
          Number(track.mood) || 0
      );


    if (statBpm) {

      statBpm.textContent =
        `${Math.min(...bpms)}–${Math.max(...bpms)}`;
    }


    if (statEnergy) {

      statEnergy.textContent =
        (
          energies.reduce(
            (a, b) => a + b,
            0
          ) /
          energies.length
        ).toFixed(1);
    }


    if (statSpread) {

      statSpread.textContent =
        `${
          Math.max(...moods) -
          Math.min(...moods)
        } / 10`;
    }
  };


  // ==========================================================================
  // SCATTER MAP
  // ==========================================================================

  const dotPos = (track) => {

    return {

      x:
        (
          (Number(track.mood) || 0) /
          10
        ) *
        100,

      y:
        100 -
        (
          (Number(track.energy) || 0) /
          10
        ) *
        100
    };
  };


  const renderScatter = () => {

    if (!scatterPlot) {
      return;
    }


    scatterPlot
      .querySelectorAll(
        '.scatter-dot'
      )
      .forEach(
        element =>
          element.remove()
      );


    if (!tracks.length) {

      if (scatterEmpty) {
        scatterEmpty.style.display =
          'flex';
      }

      renderEdges(
        null
      );

      return;
    }


    if (scatterEmpty) {
      scatterEmpty.style.display =
        'none';
    }


    tracks.forEach(
      (track, index) => {

        const dot =
          document.createElement(
            'div'
          );


        dot.className =
          'scatter-dot';


        const position =
          dotPos(track);


        dot.style.left =
          `${position.x}%`;

        dot.style.top =
          `${position.y}%`;


        dot.style.background =
          MOOD_COLOR[
            moodLabel(track.mood)
          ];


        dot.dataset.label =
          `${track.title} · ${track.bpm} bpm · ${moodLabel(
            track.mood
          )}`;


        if (!reduceMotion) {

          dot.style.animationDelay =
            `${
              Math.min(
                index,
                12
              ) *
              0.03
            }s`;
        }


        scatterPlot.appendChild(
          dot
        );
      }
    );


    renderEdges(
      activeSequence
    );
  };


  // ==========================================================================
  // SEQUENCE GRAPH EDGES
  // ==========================================================================

  const renderEdges =
    (sequence) => {

      if (!scatterEdges) {
        return;
      }


      scatterEdges.innerHTML =
        '';


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


      const byId =
        new Map(
          tracks.map(
            track => [
              String(track.id),
              track
            ]
          )
        );


      const points =
        sequence.trackIds
          .map(
            id =>
              byId.get(
                String(id)
              )
          )
          .filter(Boolean)
          .map(dotPos);


      if (
        points.length < 2
      ) {
        return;
      }


      if (scatterHint) {

        scatterHint.textContent =
          `Showing "${sequence.name}" — start to finish`;
      }


      const SVG_NS =
        'http://www.w3.org/2000/svg';


      for (
        let i = 0;
        i < points.length - 1;
        i++
      ) {

        const a =
          points[i];

        const b =
          points[i + 1];


        const line =
          document.createElementNS(
            SVG_NS,
            'line'
          );


        line.setAttribute(
          'x1',
          a.x.toFixed(2)
        );

        line.setAttribute(
          'y1',
          a.y.toFixed(2)
        );

        line.setAttribute(
          'x2',
          b.x.toFixed(2)
        );

        line.setAttribute(
          'y2',
          b.y.toFixed(2)
        );


        line.setAttribute(
          'class',
          'edge-line'
        );


        line.style.animationDelay =
          `${
            Math.min(
              i,
              20
            ) *
            0.04
          }s`;


        scatterEdges.appendChild(
          line
        );
      }
    };


  // ==========================================================================
  // SONG LIST
  // ==========================================================================
const renderList = () => {

  if (!songList) {
    return;
  }

  if (listCount) {
    listCount.textContent =
      `${tracks.length} track${tracks.length === 1 ? '' : 's'}`;
  }

  if (!tracks.length) {

    songList.innerHTML = `
      <div class="empty-state">

        <div class="eyebrow">
          Nothing tagged yet
        </div>

        <h3>
          Your library is empty
        </h3>

        <p>
          Add a track on the left —
          title, tempo, energy,
          and mood — and it'll show
          up here and on the map above.
        </p>

      </div>
    `;

    return;
  }

  songList.innerHTML =
    tracks.map(
      track => `

        <div
          class="song-row"
          data-id="${escapeAttr(track.id)}"
        >

          <!-- SONG INFORMATION -->
          <div class="song-main">

            <button
              class="play-btn"
              aria-label="Play ${escapeAttr(track.title)}"
              data-action="play"
              title="${
                track.previewUrl
                  ? 'Play preview'
                  : 'Play demo preview'
              }"
            >
              ▶
            </button>

            ${renderTrackCover(track)}

            <div class="song-info">

              <div class="song-title">
                ${escapeHtml(track.title)}
              </div>

              <div class="song-artist">
                ${escapeHtml(
                  track.artist || 'Unknown artist'
                )}
              </div>

            </div>

          </div>


          <!-- BPM -->
          <div class="stat">

            <div class="stat-val">
              ${escapeHtml(track.bpm)}
            </div>

            <div class="stat-label">
              bpm
            </div>

          </div>


          <!-- ENERGY -->
          <div class="stat">

            <div class="stat-val">
              ${escapeHtml(track.energy)}/10
            </div>

            <div class="stat-label">
              energy
            </div>

          </div>


          <!-- MOOD -->
          <span class="mood-chip">
            ${moodLabel(track.mood)}
          </span>


          <!-- GENRE -->
          ${
            track.genre
              ? `
                <span class="genre-chip">
                  ${escapeHtml(track.genre)}
                </span>
              `
              : `
                <span class="genre-chip">
                  —
                </span>
              `
          }


          <!-- LIKE / FAVOURITE -->
          <button
            class="like-btn ${track.liked ? 'liked' : ''}"
            data-action="like"
            aria-label="${
              track.liked
                ? 'Unlike'
                : 'Like'
            } ${escapeAttr(track.title)}"
            title="${
              track.liked
                ? 'Remove from Liked Songs'
                : 'Add to Liked Songs'
            }"
          >
            ${track.liked ? '♥' : '♡'}
          </button>


          <!-- DELETE -->
          <button
            class="row-remove"
            aria-label="Remove ${escapeAttr(
              track.title
            )}"
            data-action="remove"
            title="Remove track"
          >
            ×
          </button>

        </div>

      `
    ).join('');
};


  // ==========================================================================
  // SEQUENCE ALGORITHM
  // ==========================================================================

  const normalizeTracks =
    (list) => {

      const bpms =
        list.map(
          track =>
            Number(track.bpm) || 0
        );


      const minBpm =
        Math.min(...bpms);

      const maxBpm =
        Math.max(...bpms);

      const bpmRange =
        (maxBpm - minBpm) ||
        1;


      return list.map(
        track => ({

          ...track,

          _ntempo:
            (
              (
                Number(track.bpm) || 0
              ) -
              minBpm
            ) /
            bpmRange,

          _nenergy:
            (
              Number(track.energy) || 0
            ) /
            10,

          _nmood:
            (
              Number(track.mood) || 0
            ) /
            10

        })
      );
    };


  const nodeDistance =
    (a, b) => {

      return Math.sqrt(

        (
          a._ntempo -
          b._ntempo
        ) ** 2 +

        (
          a._nenergy -
          b._nenergy
        ) ** 2 +

        (
          a._nmood -
          b._nmood
        ) ** 2

      );
    };


  const MAX_POSSIBLE_DISTANCE =
    Math.sqrt(3);


  const MAX_2OPT_PASSES =
    40;


  const twoOptImprove =
    (order) => {

      if (order.length < 4) {
        return order;
      }


      let route =
        order.slice();


      let improved =
        true;


      let pass =
        0;


      while (
        improved &&
        pass <
          MAX_2OPT_PASSES
      ) {

        improved =
          false;

        pass++;


        for (
          let i = 0;
          i < route.length - 2;
          i++
        ) {

          for (
            let j = i + 2;
            j < route.length;
            j++
          ) {

            const a =
              route[i];

            const b =
              route[i + 1];

            const c =
              route[j];

            const d =
              route[j + 1];


            const before =
              nodeDistance(a, b) +
              (
                d
                  ? nodeDistance(c, d)
                  : 0
              );


            const after =
              nodeDistance(a, c) +
              (
                d
                  ? nodeDistance(b, d)
                  : 0
              );


            if (
              after <
              before - 1e-9
            ) {

              const segment =
                route
                  .slice(
                    i + 1,
                    j + 1
                  )
                  .reverse();


              route =
                route
                  .slice(
                    0,
                    i + 1
                  )
                  .concat(
                    segment,
                    route.slice(
                      j + 1
                    )
                  );


              improved =
                true;
            }
          }
        }
      }


      return route;
    };


  const buildSequence =
    (
      rawTracks,
      requestedBpm
    ) => {

      if (
        rawTracks.length <
        2
      ) {
        return null;
      }


      const nodes =
        normalizeTracks(
          rawTracks
        );


      const remaining =
        nodes.slice();


      // --------------------------------------------------------------
      // Start closest to requested BPM
      // --------------------------------------------------------------

      let startIndex =
        0;

      let bestGap =
        Infinity;


      remaining.forEach(
        (node, index) => {

          const gap =
            Math.abs(
              Number(node.bpm) -
              Number(requestedBpm)
            );


          if (
            gap <
            bestGap
          ) {

            bestGap =
              gap;

            startIndex =
              index;
          }
        }
      );


      let current =
        remaining.splice(
          startIndex,
          1
        )[0];


      let order = [
        current
      ];


      // --------------------------------------------------------------
      // Nearest neighbour
      // --------------------------------------------------------------

      while (
        remaining.length
      ) {

        let bestIndex =
          0;

        let bestDistance =
          Infinity;


        remaining.forEach(
          (candidate, index) => {

            const distance =
              nodeDistance(
                current,
                candidate
              );


            if (
              distance <
              bestDistance
            ) {

              bestDistance =
                distance;

              bestIndex =
                index;
            }
          }
        );


        current =
          remaining.splice(
            bestIndex,
            1
          )[0];


        order.push(
          current
        );
      }


      // --------------------------------------------------------------
      // 2-opt
      // --------------------------------------------------------------

      order =
        twoOptImprove(
          order
        );


      // --------------------------------------------------------------
      // Transitions
      // --------------------------------------------------------------

      const transitions =
        [];


      for (
        let i = 0;
        i < order.length - 1;
        i++
      ) {

        const from =
          order[i];

        const to =
          order[i + 1];


        transitions.push({

          fromId:
            from.id,

          toId:
            to.id,

          distance:
            nodeDistance(
              from,
              to
            ),

          deltaBpm:
            Math.abs(
              Number(to.bpm) -
              Number(from.bpm)
            ),

          deltaEnergy:
            Math.abs(
              Number(to.energy) -
              Number(from.energy)
            ),

          deltaMood:
            Math.abs(
              Number(to.mood) -
              Number(from.mood)
            )
        });
      }


      const totalDistance =
        transitions.reduce(
          (sum, transition) =>
            sum +
            transition.distance,
          0
        );


      const averageDistance =
        transitions.length
          ? totalDistance /
            transitions.length
          : 0;


      const smoothness =
        transitions.length
          ? Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  100 *
                  (
                    1 -
                    (
                      averageDistance /
                      MAX_POSSIBLE_DISTANCE
                    )
                  )
                )
              )
            )
          : 100;


      return {

        order,

        transitions,

        smoothness,

        avgDistance:
          averageDistance,

        totalDistance

      };
    };


  // ==========================================================================
  // SCORE QUALITY
  // ==========================================================================

  const scoreQuality =
    score => {

      if (score >= 85) {
        return 'Buttery smooth';
      }

      if (score >= 65) {
        return 'Solid flow';
      }

      if (score >= 40) {
        return 'A few noticeable jumps';
      }

      return 'Choppy — try a wider tempo start';
    };


  // ==========================================================================
  // SEQUENCE RESULT
  // ==========================================================================

  const renderSequenceResult =
    sequence => {

      if (!sequence) {

        if (sequenceResult) {
          sequenceResult.style.display =
            'none';
        }

        return;
      }


      if (!sequenceResult) {
        return;
      }


      const byId =
        new Map(
          tracks.map(
            track => [
              String(track.id),
              track
            ]
          )
        );


      const orderedTracks =
        (sequence.trackIds || [])
          .map(
            id =>
              byId.get(
                String(id)
              )
          )
          .filter(Boolean);


      sequenceResult.style.display =
        'block';


      if (sequenceResultName) {

        sequenceResultName.textContent =
          sequence.name;
      }


      if (sequenceResultCount) {

        sequenceResultCount.textContent =
          `${orderedTracks.length} track${
            orderedTracks.length === 1
              ? ''
              : 's'
          }`;
      }


      if (scoreNumber) {

        scoreNumber.textContent =
          orderedTracks.length
            ? sequence.smoothness
            : '—';
      }


      const scoreExplain =
        document.getElementById(
          'scoreExplain'
        );


      if (scoreExplain) {

        scoreExplain.innerHTML =
          `
            <strong
              style="color:var(--chalk)"
            >
              ${escapeHtml(
                scoreQuality(
                  sequence.smoothness || 0
                )
              )}.
            </strong>

            Every consecutive pair's
            distance across normalized
            tempo, energy, and mood is
            averaged, then converted to
            a 0–100 score.
          `;
      }


      if (!orderedTracks.length) {

        if (routeList) {

          routeList.innerHTML =
            `
              <p class="form-sub">
                Some tracks in this sequence
                have been removed from your library.
              </p>
            `;
        }


        if (sequenceCta) {
          sequenceCta.style.display =
            'none';
        }


        return;
      }


      const transitionsById =
        new Map(
          (
            sequence.transitions ||
            []
          ).map(
            transition => [
              `${
                transition.fromId
              }->${
                transition.toId
              }`,
              transition
            ]
          )
        );


      if (routeList) {

        routeList.innerHTML =
          orderedTracks
            .map(
              (track, index) => {

                const previous =
                  orderedTracks[
                    index - 1
                  ];


                const transition =
                  previous
                    ? transitionsById.get(
                        `${
                          previous.id
                        }->${
                          track.id
                        }`
                      )
                    : null;


                const jumpPct =
                  transition
                    ? Math.round(
                        (
                          1 -
                          (
                            transition.distance /
                            MAX_POSSIBLE_DISTANCE
                          )
                        ) *
                        100
                      )
                    : null;


                const deltaText =
                  transition
                    ? `Δ${
                        transition.deltaBpm
                      } bpm · Δ${
                        transition.deltaEnergy
                      } energy · Δ${
                        transition.deltaMood
                      } mood`
                    : 'Start';


                return `

                  <div class="route-item">

                    <span class="route-index">
                      ${String(
                        index + 1
                      ).padStart(
                        2,
                        '0'
                      )}
                    </span>

                    <div class="route-track">

                      <div class="song-title">
                        ${escapeHtml(
                          track.title
                        )}
                      </div>

                      <div class="song-artist">
                        ${escapeHtml(
                          track.artist ||
                          'Unknown artist'
                        )}
                        ·
                        ${track.bpm}
                        bpm ·
                        ${moodLabel(
                          track.mood
                        )}
                      </div>

                    </div>

                    <div class="route-transition">

                      ${
                        transition
                          ? `
                            <span
                              class="route-jump-chip"
                            >
                              ${jumpPct}% smooth
                            </span>
                          `
                          : `
                            <span
                              class="route-start-chip"
                            >
                              Start
                            </span>
                          `
                      }

                      <span class="route-delta">
                        ${deltaText}
                      </span>

                    </div>

                  </div>

                `;
              }
            )
            .join('');
      }


      if (sequenceCta) {

        sequenceCta.style.display =
          'flex';
      }
    };


  // ==========================================================================
  // PLAYLIST WIZARD
  // ==========================================================================

  const enterAddTrackStep =
    playlist => {

      activePlaylist =
        playlist;


      if (activePlaylistNameEl) {

        activePlaylistNameEl.textContent =
          playlist.name;
      }


      if (playlistStep) {

        playlistStep.style.display =
          'none';
      }


      if (addTrackStep) {

        addTrackStep.style.display =
          'block';
      }


      if (wizStep1Tab) {

        wizStep1Tab.classList.remove(
          'is-active'
        );
      }


      if (wizStep2Tab) {

        wizStep2Tab.classList.add(
          'is-active'
        );
      }


      if (titleInput) {

        titleInput.focus();
      }
    };


  const enterPlaylistStep =
    () => {

      activePlaylist =
        null;


      if (addTrackStep) {

        addTrackStep.style.display =
          'none';
      }


      if (playlistStep) {

        playlistStep.style.display =
          'block';
      }


      if (wizStep2Tab) {

        wizStep2Tab.classList.remove(
          'is-active'
        );
      }


      if (wizStep1Tab) {

        wizStep1Tab.classList.add(
          'is-active'
        );
      }


      if (playlistName) {

        playlistName.value =
          '';
      }


      renderCollections();
    };


  if (backToPlaylistsBtn) {

    backToPlaylistsBtn.addEventListener(
      'click',
      enterPlaylistStep
    );
  }


  if (finishPlaylistBtn) {

    finishPlaylistBtn.addEventListener(
      'click',
      enterPlaylistStep
    );
  }


  // ==========================================================================
  // COLLECTION RENDERING
  // ==========================================================================

  const renderCollections =
    () => {

      const playlists =
        loadPersonal(
          'playlists'
        );


      const sequences =
        loadPersonal(
          'sequences'
        );


      if (
        existingPlaylistsHead
      ) {

        existingPlaylistsHead.style.display =
          playlists.length
            ? 'block'
            : 'none';
      }


      // --------------------------------------------------------------
      // PLAYLISTS
      // --------------------------------------------------------------

      if (playlistList) {

        playlistList.innerHTML =
          playlists.length

            ? playlists
                .slice()
                .reverse()
                .map(
                  playlist => {

                    const ids =
                      Array.isArray(
                        playlist.trackIds
                      )
                        ? playlist.trackIds
                        : [];


                    return `

                      <div
                        class="song-row"
                        data-playlist-id="${escapeAttr(
                          playlist.id
                        )}"
                      >

                        <div class="song-main">

                          <div>

                            <div class="song-title">
                              ${escapeHtml(
                                playlist.name
                              )}
                            </div>

                            <div class="song-artist">
                              ${ids.length}
                              track${
                                ids.length === 1
                                  ? ''
                                  : 's'
                              }
                            </div>

                          </div>

                        </div>


                        <button
                          class="btn btn-secondary btn-sm playlist-continue-btn"
                          data-action="continue-playlist"
                          data-id="${escapeAttr(
                            playlist.id
                          )}"
                        >
                          Add tracks
                        </button>


                        <button
                          class="row-remove"
                          data-action="remove-playlist"
                          data-id="${escapeAttr(
                            playlist.id
                          )}"
                          aria-label="Delete ${escapeAttr(
                            playlist.name
                          )}"
                        >
                          ×
                        </button>

                      </div>

                    `;
                  }
                )
                .join('')

            : `
              <p class="form-sub">
                No playlists yet.
              </p>
            `;
      }


      // --------------------------------------------------------------
      // SEQUENCES
      // --------------------------------------------------------------

      if (sequenceList) {

        sequenceList.innerHTML =
          sequences.length

            ? sequences
                .slice()
                .reverse()
                .map(
                  sequence => `

                    <div
                      class="song-row"
                      data-sequence-id="${escapeAttr(
                        sequence.id
                      )}"
                    >

                      <div class="song-main">

                        <div>

                          <div class="song-title">
                            ${escapeHtml(
                              sequence.name
                            )}
                          </div>

                          <div class="song-artist">
                            ${sequence.tempo}
                            bpm start ·
                            ${
                              (
                                sequence.trackIds ||
                                []
                              ).length
                            }
                            tracks ·
                            ${
                              sequence.smoothness ??
                              '—'
                            }%
                            smooth
                          </div>

                        </div>

                      </div>


                      <button
                        class="btn btn-secondary btn-sm"
                        data-action="view-sequence"
                        data-id="${escapeAttr(
                          sequence.id
                        )}"
                      >
                        View
                      </button>


                      <button
                        class="row-remove"
                        data-action="remove-sequence"
                        data-id="${escapeAttr(
                          sequence.id
                        )}"
                        aria-label="Delete ${escapeAttr(
                          sequence.name
                        )}"
                      >
                        ×
                      </button>

                    </div>

                  `
                )
                .join('')

            : `
              <p class="form-sub">
                No sequences yet.
              </p>
            `;
      }
    };


  // ==========================================================================
  // SEQUENCE CONTROLS
  // ==========================================================================

  const syncSequenceControls =
    () => {

      if (!createSequence) {
        return;
      }


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
            `${targetBpm.value} bpm`;
        }
      }
    );
  }


  // ==========================================================================
  // CREATE PLAYLIST
  // ==========================================================================

  if (createPlaylist) {

    createPlaylist.addEventListener(
      'click',
      () => {

        const playlists =
          loadPersonal(
            'playlists'
          );


        const name =
          (
            playlistName?.value ||
            `Playlist ${
              playlists.length + 1
            }`
          ).trim();


        const newPlaylist = {

          id:
            `pl_${Date.now()}`,

          name,

          trackIds: [],

          createdAt:
            new Date().toISOString()
        };


        playlists.push(
          newPlaylist
        );


        savePersonal(
          'playlists',
          playlists
        );


        renderCollections();

        enterAddTrackStep(
          newPlaylist
        );
      }
    );
  }


  // ==========================================================================
  // CREATE SEQUENCE
  // ==========================================================================

  if (createSequence) {

    createSequence.addEventListener(
      'click',
      () => {

        if (
          tracks.length < 2
        ) {
          return;
        }


        const result =
          buildSequence(
            tracks,
            Number(
              targetBpm?.value || 100
            )
          );


        if (!result) {
          return;
        }


        const sequences =
          loadPersonal(
            'sequences'
          );


        const seqObj = {

          id:
            `seq_${Date.now()}`,

          name:
            (
              sequenceName?.value ||
              `Flow ${
                sequences.length + 1
              }`
            ).trim(),

          tempo:
            Number(
              targetBpm?.value || 100
            ),

          trackIds:
            result.order.map(
              track =>
                track.id
            ),

          transitions:
            result.transitions,

          smoothness:
            result.smoothness,

          createdAt:
            new Date().toISOString()
        };


        sequences.push(
          seqObj
        );


        savePersonal(
          'sequences',
          sequences
        );


        if (sequenceName) {
          sequenceName.value =
            '';
        }


        activeSequence =
          seqObj;


        renderCollections();

        renderSequenceResult(
          seqObj
        );

        renderEdges(
          seqObj
        );


        if (sequenceResult) {

          sequenceResult.scrollIntoView({
            behavior:
              reduceMotion
                ? 'auto'
                : 'smooth',
            block:
              'start'
          });
        }
      }
    );
  }


  // ==========================================================================
  // SEQUENCE LIST EVENTS
  // ==========================================================================

  if (sequenceList) {

    sequenceList.addEventListener(
      'click',
      event => {

        const button =
          event.target.closest(
            'button[data-action]'
          );


        if (!button) {
          return;
        }


        const id =
          button.dataset.id;


        // --------------------------------------------------------------
        // VIEW
        // --------------------------------------------------------------

        if (
          button.dataset.action ===
          'view-sequence'
        ) {

          const sequences =
            loadPersonal(
              'sequences'
            );


          const sequence =
            sequences.find(
              item =>
                String(item.id) ===
                String(id)
            );


          if (!sequence) {
            return;
          }


          activeSequence =
            sequence;


          renderSequenceResult(
            sequence
          );

          renderEdges(
            sequence
          );


          if (sequenceResult) {

            sequenceResult.scrollIntoView({
              behavior:
                reduceMotion
                  ? 'auto'
                  : 'smooth',
              block:
                'start'
            });
          }
        }


        // --------------------------------------------------------------
        // DELETE
        // --------------------------------------------------------------

        if (
          button.dataset.action ===
          'remove-sequence'
        ) {

          let sequences =
            loadPersonal(
              'sequences'
            );


          sequences =
            sequences.filter(
              sequence =>
                String(
                  sequence.id
                ) !==
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
            ) ===
            String(id)
          ) {

            activeSequence =
              null;


            renderSequenceResult(
              null
            );

            renderEdges(
              null
            );
          }


          renderCollections();
        }
      }
    );
  }


  // ==========================================================================
  // PLAYLIST EVENTS
  // ==========================================================================

  if (playlistList) {

    playlistList.addEventListener(
      'click',
      event => {

        const button =
          event.target.closest(
            'button[data-action]'
          );


        if (!button) {
          return;
        }


        const id =
          button.dataset.id;


        // --------------------------------------------------------------
        // CONTINUE
        // --------------------------------------------------------------

        if (
          button.dataset.action ===
          'continue-playlist'
        ) {

          const playlists =
            loadPersonal(
              'playlists'
            );


          const playlist =
            playlists.find(
              item =>
                String(item.id) ===
                String(id)
            );


          if (playlist) {

            enterAddTrackStep(
              playlist
            );
          }


          return;
        }


        // --------------------------------------------------------------
        // DELETE
        // --------------------------------------------------------------

        if (
          button.dataset.action ===
          'remove-playlist'
        ) {

          let playlists =
            loadPersonal(
              'playlists'
            );


          playlists =
            playlists.filter(
              playlist =>
                String(
                  playlist.id
                ) !==
                String(id)
            );


          savePersonal(
            'playlists',
            playlists
          );


          if (
            activePlaylist &&
            String(
              activePlaylist.id
            ) ===
            String(id)
          ) {

            enterPlaylistStep();
          }


          renderCollections();
        }
      }
    );
  }


  // ==========================================================================
  // FORM CONTROLS
  // ==========================================================================

  [
    bpmInput,
    energyInput,
    moodInput
  ]
    .filter(Boolean)
    .forEach(
      element => {

        element.addEventListener(
          'input',
          syncFieldLabels
        );
      }
    );


  if (guessBtn) {

    guessBtn.addEventListener(
      'click',
      () => {

        if (
          !titleInput ||
          !titleInput.value.trim()
        ) {

          if (titleInput) {

            titleInput.focus();

            titleInput.classList.add(
              'shake'
            );


            setTimeout(
              () =>
                titleInput.classList.remove(
                  'shake'
                ),
              400
            );
          }

          return;
        }


        const guess =
          estimateFeatures(
            titleInput.value,
            selectedMeta
              ? selectedMeta.genre
              : ''
          );


        if (bpmInput) {
          bpmInput.value =
            guess.bpm;
        }

        if (energyInput) {
          energyInput.value =
            guess.energy;
        }

        if (moodInput) {
          moodInput.value =
            guess.mood;
        }


        syncFieldLabels();
      }
    );
  }


  // ==========================================================================
  // FIND TRACK ON ITUNES
  // ==========================================================================

  const findTrackOnITunes =
    async track => {

      const title =
        String(
          track.title || ''
        ).trim();


      const artist =
        String(
          track.artist || ''
        ).trim();


      if (!title) {
        return null;
      }


      const query =
        `${title} ${artist}`.trim();


      try {

        const response =
          await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              query
            )}&media=music&entity=song&limit=10`
          );


        if (!response.ok) {
          return null;
        }


        const data =
          await response.json();


        const results =
          Array.isArray(
            data.results
          )
            ? data.results
            : [];


        if (!results.length) {
          return null;
        }


        const normalize =
          value =>
            String(
              value || ''
            )
              .toLowerCase()
              .replace(
                /[^\w\s]/g,
                ''
              )
              .trim();


        const wantedTitle =
          normalize(title);


        const wantedArtist =
          normalize(artist);


        // --------------------------------------------------------------
        // Exact title + artist
        // --------------------------------------------------------------

        let match =
          results.find(
            result => {

              const resultTitle =
                normalize(
                  result.trackName
                );


              const resultArtist =
                normalize(
                  result.artistName
                );


              return (
                resultTitle ===
                  wantedTitle &&
                (
                  !wantedArtist ||
                  resultArtist ===
                    wantedArtist
                )
              );
            }
          );


        // --------------------------------------------------------------
        // Exact title
        // --------------------------------------------------------------

        if (!match) {

          match =
            results.find(
              result =>
                normalize(
                  result.trackName
                ) ===
                wantedTitle
            );
        }


        /*
         * IMPORTANT:
         *
         * We no longer blindly use results[0].
         *
         * That old behaviour could attach completely unrelated
         * artwork/audio to Low Tide / Slow Static / Redline.
         */

        return match || null;

      } catch (error) {

        console.warn(
          'iTunes lookup failed:',
          error
        );

        return null;
      }
    };


  // ==========================================================================
  // REPAIR OLD TRACKS
  // ==========================================================================

  const hydrateOldTracks =
    async () => {

      let changed =
        false;


      for (
        const track of tracks
      ) {

        if (
          track.artwork &&
          track.previewUrl
        ) {
          continue;
        }


        const result =
          await findTrackOnITunes(
            track
          );


        if (!result) {

          /*
           * Keep generated cover.
           *
           * Don't attach unrelated iTunes results.
           */

          continue;
        }


        if (
          !track.artwork &&
          (
            result.artworkUrl100 ||
            result.artworkUrl60
          )
        ) {

          track.artwork =
            (
              result.artworkUrl100 ||
              result.artworkUrl60
            )
              .replace(
                '100x100',
                '600x600'
              )
              .replace(
                '60x60',
                '600x600'
              );


          changed =
            true;
        }


        if (
          !track.previewUrl &&
          result.previewUrl
        ) {

          track.previewUrl =
            result.previewUrl;


          changed =
            true;
        }


        if (
          !track.genre &&
          result.primaryGenreName
        ) {

          track.genre =
            result.primaryGenreName;


          changed =
            true;
        }


        if (
          !track.album &&
          result.collectionName
        ) {

          track.album =
            result.collectionName;


          changed =
            true;
        }


        if (
          track.artwork ||
          track.previewUrl
        ) {

          if (!track.source) {

            track.source =
              'iTunes';
          }

          changed =
            true;
        }
      }


      if (changed) {

        saveTracks();

        renderAll();
      }
    };


  // ==========================================================================
  // RENDER EVERYTHING
  // ==========================================================================

  const renderAll =
    () => {

      renderStats();

      renderScatter();

      renderList();

      syncSequenceControls();
    };


  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  syncFieldLabels();

  renderAll();

  renderCollections();


  /*
   * Repair old tracks after the first render.
   *
   * The page appears immediately and metadata is filled in
   * when iTunes responds.
   */

  hydrateOldTracks()
    .catch(
      error => {

        console.warn(
          'Track metadata repair failed:',
          error
        );
      }
    );

});