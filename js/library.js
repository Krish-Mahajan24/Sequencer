// ================================================================
// SEQUENCER — LIBRARY PAGE
// ================================================================
// Displays:
//   - Recent songs
//   - Playlists
//   - Sequences
//   - Artists
//   - Liked songs
//
// FIXES:
//   - Artist cards no longer open the Liked Songs tab.
//   - Liked Songs only shows tracks where liked === true.
//   - Liked songs can be toggled from the Library page.
//   - Artist images remain supported.
//   - Old track metadata repair remains supported.
// ================================================================

document.addEventListener('DOMContentLoaded', () => {

  // ================================================================
  // BASIC HELPERS
  // ================================================================

  const $ = (id) => document.getElementById(id);

  const store = (name, fallback) =>
    window.SequencerStore
      ? window.SequencerStore.get(name, fallback)
      : fallback;

  const save = (name, value) => {
    if (window.SequencerStore) {
      window.SequencerStore.set(name, value);
    }
  };

  const escapeHtml = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  const escapeAttr = escapeHtml;

  // ================================================================
  // MOOD
  // ================================================================

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

  const moodLabel = (value) =>
    MOOD_STEPS[
      Math.max(
        0,
        Math.min(
          10,
          Math.round(Number(value) || 0)
        )
      )
    ];

  // ================================================================
  // GRADIENT FALLBACK
  // ================================================================

  const hashString = (str) => {

    let h = 0;

    const s =
      String(str || '');

    for (
      let i = 0;
      i < s.length;
      i++
    ) {

      h =
        (h << 5) -
        h +
        s.charCodeAt(i);

      h |= 0;
    }

    return Math.abs(h);
  };

  const gradientFor = (seed) => {

    const h =
      hashString(seed);

    const hue1 =
      330 +
      (h % 30) -
      15;

    const hue2 =
      (
        hue1 +
        30 +
        (h % 20)
      ) % 360;

    return `linear-gradient(
      135deg,
      hsl(${hue1},85%,58%),
      hsl(${hue2},60%,22%)
    )`;
  };

  // ================================================================
  // STATE
  // ================================================================

  let library =
    store(
      'library',
      []
    );

  let playlists =
    store(
      'playlists',
      []
    );

  let sequences =
    store(
      'sequences',
      []
    );

  let railFilter =
    'all';

  let railQuery =
    '';

  // IMPORTANT:
  // This is no longer used to make artists open Liked Songs.
  let artistFilter =
    null;

  // ================================================================
  // ARTIST IMAGE CACHE
  // ================================================================

  const artistImageCache =
    new Map();

  // ================================================================
  // ARTIST MAP
  // ================================================================

  const artistMap = () => {

    const map =
      new Map();

    library.forEach(track => {

      const name =
        track.artist &&
        String(track.artist).trim()
          ? String(track.artist).trim()
          : 'Unknown artist';

      if (!map.has(name)) {
        map.set(
          name,
          []
        );
      }

      map
        .get(name)
        .push(track);

    });

    return map;
  };

  // ================================================================
  // FIND EXISTING ARTIST IMAGE
  // ================================================================

  const getExistingArtistImage =
    (artist, tracks) => {

      const savedImage =
        tracks.find(
          track =>
            track.artistImage
        )?.artistImage;

      if (savedImage) {
        return savedImage;
      }

      const artwork =
        tracks.find(
          track =>
            track.artwork
        )?.artwork;

      return artwork || '';
    };

  // ================================================================
  // WIKIPEDIA ARTIST IMAGE
  // ================================================================

  const fetchWikipediaArtistImage =
    async (artistName) => {

      const cleanName =
        String(
          artistName || ''
        ).trim();

      if (
        !cleanName ||
        cleanName ===
          'Unknown artist'
      ) {
        return '';
      }

      const cacheKey =
        cleanName.toLowerCase();

      if (
        artistImageCache.has(
          cacheKey
        )
      ) {

        return artistImageCache.get(
          cacheKey
        );
      }

      try {

        const searchUrl =
          `https://en.wikipedia.org/w/api.php` +
          `?action=query` +
          `&list=search` +
          `&srsearch=${encodeURIComponent(cleanName)}` +
          `&format=json` +
          `&origin=*` +
          `&srlimit=5`;

        const response =
          await fetch(
            searchUrl
          );

        if (!response.ok) {
          throw new Error(
            'Wikipedia search failed'
          );
        }

        const data =
          await response.json();

        const results =
          data?.query?.search ||
          [];

        if (!results.length) {

          artistImageCache.set(
            cacheKey,
            ''
          );

          return '';
        }

        for (
          const result of results
        ) {

          const pageTitle =
            result.title;

          const summaryUrl =
            `https://en.wikipedia.org/api/rest_v1/page/summary/` +
            encodeURIComponent(
              pageTitle
            );

          try {

            const summaryResponse =
              await fetch(
                summaryUrl
              );

            if (
              !summaryResponse.ok
            ) {
              continue;
            }

            const summary =
              await summaryResponse.json();

            const image =
              summary?.thumbnail?.source ||
              summary?.originalimage?.source ||
              '';

            if (image) {

              artistImageCache.set(
                cacheKey,
                image
              );

              return image;
            }

          } catch {
            // Try next result.
          }
        }

      } catch {
        // Wikipedia unavailable.
      }

      artistImageCache.set(
        cacheKey,
        ''
      );

      return '';
    };

  // ================================================================
  // LOAD MISSING ARTIST IMAGES
  // ================================================================

  const loadMissingArtistImages =
    async () => {

      const artists =
        artistMap();

      for (
        const [
          artistName,
          tracks
        ] of artists.entries()
      ) {

        if (
          !artistName ||
          artistName ===
            'Unknown artist'
        ) {
          continue;
        }

        const existingImage =
          getExistingArtistImage(
            artistName,
            tracks
          );

        const hasArtistImage =
          tracks.some(
            track =>
              track.artistImage
          );

        if (hasArtistImage) {
          continue;
        }

        const wikipediaImage =
          await fetchWikipediaArtistImage(
            artistName
          );

        const finalImage =
          wikipediaImage ||
          existingImage ||
          '';

        if (!finalImage) {
          continue;
        }

        let changed =
          false;

        library.forEach(track => {

          const trackArtist =
            String(
              track.artist || ''
            ).trim();

          if (
            trackArtist.toLowerCase() ===
            artistName.toLowerCase()
          ) {

            if (
              track.artistImage !==
              finalImage
            ) {

              track.artistImage =
                finalImage;

              changed = true;
            }
          }
        });

        if (changed) {

          save(
            'library',
            library
          );
        }

        renderOverview();
        renderAllArtists();
      }
    };

  // ================================================================
  // ITUNES SEARCH
  // ================================================================

  const findTrackOnITunes =
    async (track) => {

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

      const searchTerm =
        `${title} ${artist}`.trim();

      try {

        const url =
          `https://itunes.apple.com/search` +
          `?term=${encodeURIComponent(searchTerm)}` +
          `&media=music` +
          `&entity=song` +
          `&limit=10`;

        const response =
          await fetch(url);

        if (!response.ok) {
          return null;
        }

        const data =
          await response.json();

        const results =
          data?.results || [];

        if (!results.length) {
          return null;
        }

        const normalize =
          (value) =>
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

        if (!match) {

          match =
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

                const titleMatches =
                  resultTitle ===
                    wantedTitle ||
                  resultTitle.includes(
                    wantedTitle
                  ) ||
                  wantedTitle.includes(
                    resultTitle
                  );

                const artistMatches =
                  !wantedArtist ||
                  resultArtist.includes(
                    wantedArtist
                  ) ||
                  wantedArtist.includes(
                    resultArtist
                  );

                return (
                  titleMatches &&
                  artistMatches
                );
              }
            );
        }

        if (!match) {
          match =
            results[0];
        }

        return match || null;

      } catch (error) {

        console.warn(
          'iTunes lookup failed:',
          track.title,
          error
        );

        return null;
      }
    };

  // ================================================================
  // REPAIR OLD TRACKS
  // ================================================================

  const repairMissingTrackMetadata =
    async () => {

      let changed =
        false;

      const tracksToRepair =
        library.filter(
          track =>
            track.title &&
            (
              !track.artwork ||
              !track.previewUrl
            )
        );

      if (
        !tracksToRepair.length
      ) {
        return;
      }

      for (
        const track
        of tracksToRepair
      ) {

        const result =
          await findTrackOnITunes(
            track
          );

        if (!result) {
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

          changed = true;
        }

        if (
          !track.previewUrl &&
          result.previewUrl
        ) {

          track.previewUrl =
            result.previewUrl;

          changed = true;
        }

        if (
          !track.artist &&
          result.artistName
        ) {

          track.artist =
            result.artistName;

          changed = true;
        }

        if (
          !track.genre &&
          result.primaryGenreName
        ) {

          track.genre =
            result.primaryGenreName;

          changed = true;
        }

        if (
          !track.album &&
          result.collectionName
        ) {

          track.album =
            result.collectionName;

          changed = true;
        }

        if (
          track.artwork ||
          track.previewUrl
        ) {

          track.source =
            track.source ||
            'iTunes';
        }
      }

      if (changed) {

        save(
          'library',
          library
        );

        renderAll();
      }
    };

  // ================================================================
  // TRACK RESOLUTION
  // ================================================================

  const libraryById =
    () => {

      const map =
        new Map();

      library.forEach(
        track => {

          map.set(
            String(track.id),
            track
          );

        }
      );

      return map;
    };

  const resolveTracks =
    (item) => {

      const map =
        libraryById();

      const ids =
        item.trackIds || [];

      const inline =
        new Map(
          (
            item.tracks ||
            []
          ).map(
            track => [
              String(track.id),
              track
            ]
          )
        );

      return ids
        .map(
          id =>
            map.get(
              String(id)
            ) ||
            inline.get(
              String(id)
            )
        )
        .filter(Boolean);
    };

  // ================================================================
  // TRACK COVER
  // ================================================================

  const trackCover =
    (track, sizeClass) => {

      if (track.artwork) {

        return `
          <img
            class="${sizeClass}"
            src="${escapeAttr(track.artwork)}"
            alt=""
            loading="lazy"
            onerror="this.style.display='none'"
          >
        `;
      }

      return `
        <div
          class="${sizeClass}"
          style="background:${gradientFor(
            track.title +
            (track.artist || '')
          )}"
        ></div>
      `;
    };

  // ================================================================
  // COLLECTION CARD
  // ================================================================

  const collectionCard =
    (item, kind) => {

      const tracks =
        resolveTracks(item);

      const count =
        item.trackIds
          ? item.trackIds.length
          : tracks.length;

      const sub =
        kind === 'Sequence'
          ? `${item.tempo ||
              tracks[0]?.bpm ||
              '—'} bpm start · ${count} track${
                count === 1 ? '' : 's'
              }`
          : `${count} track${
              count === 1 ? '' : 's'
            }`;

      const cover =
        tracks[0]?.artwork
          ? `
            background-image:url(
              '${escapeAttr(
                tracks[0].artwork
              )}'
            );
            background-size:cover;
            background-position:center;
          `
          : `
            background:${gradientFor(
              item.name +
              item.id
            )};
          `;

      const smoothnessBadge =
        (
          kind === 'Sequence' &&
          typeof item.smoothness ===
            'number'
        )
          ? `
            <span
              class="lib-card-kind"
              style="
                position:absolute;
                left:10px;
                top:10px;
                background:rgba(0,0,0,.55);
                padding:2px 8px;
                border-radius:999px;
              "
            >
              ${item.smoothness}% smooth
            </span>
          `
          : '';

      return `
        <button
          class="lib-card"
          data-open="${kind.toLowerCase()}"
          data-id="${escapeAttr(item.id)}"
        >

          <div
            class="lib-card-art"
            style="${cover}"
          >

            ${smoothnessBadge}

            <span
              class="lib-card-play"
              data-play-collection="${escapeAttr(item.id)}"
              data-kind="${kind.toLowerCase()}"
              aria-label="Play ${escapeAttr(item.name)}"
            >
              ▶
            </span>

          </div>

          <span
            class="lib-card-title"
          >
            ${escapeHtml(item.name)}
          </span>

          <span
            class="lib-card-sub"
          >
            ${sub}
          </span>

        </button>
      `;
    };

  // ================================================================
  // ARTIST CARD
  // ================================================================
  //
  // IMPORTANT:
  // Artist cards are intentionally NOT buttons with data-open.
  // Clicking an artist therefore does not open Liked Songs.
  // ================================================================

  const artistCard =
    (name, tracks) => {

      const image =
        tracks.find(
          track =>
            track.artistImage
        )?.artistImage ||
        tracks.find(
          track =>
            track.artwork
        )?.artwork ||
        '';

      const artworkStyle =
        image
          ? `
            background-image:url(
              '${escapeAttr(image)}'
            );
            background-size:cover;
            background-position:center;
            background-repeat:no-repeat;
          `
          : `
            background:${gradientFor(name)};
          `;

      return `
        <div
          class="lib-card artist-card"
          data-artist-card="${escapeAttr(name)}"
          title="${escapeAttr(name)}"
        >

          <div
            class="lib-card-art"
            style="${artworkStyle}"
          ></div>

          <span
            class="lib-card-title"
          >
            ${escapeHtml(name)}
          </span>

          <span
            class="lib-card-sub"
          >
            ${tracks.length}
            track${tracks.length === 1 ? '' : 's'}
          </span>

        </div>
      `;
    };

  // ================================================================
  // RAIL
  // ================================================================

  const renderRail =
    () => {

      const rail =
        $('railList');

      if (!rail) return;

      let items = [
        ...playlists.map(
          p => ({
            ...p,
            __kind:
              'Playlist'
          })
        ),

        ...sequences.map(
          s => ({
            ...s,
            __kind:
              'Sequence'
          })
        )
      ];

      if (
        railFilter ===
        'playlists'
      ) {

        items =
          items.filter(
            item =>
              item.__kind ===
              'Playlist'
          );
      }

      if (
        railFilter ===
        'sequences'
      ) {

        items =
          items.filter(
            item =>
              item.__kind ===
              'Sequence'
          );
      }

      if (
        railQuery.trim()
      ) {

        const q =
          railQuery
            .trim()
            .toLowerCase();

        items =
          items.filter(
            item =>
              (
                item.name ||
                ''
              )
                .toLowerCase()
                .includes(q)
          );
      }

      items.sort(
        (a, b) =>
          new Date(
            b.createdAt || 0
          ) -
          new Date(
            a.createdAt || 0
          )
      );

      if (!items.length) {

        rail.innerHTML = `
          <div class="lib-rail-empty">
            Nothing here yet.
            Tag a few tracks and build a playlist
            or sequence on
            <a href="sequence.html">
              Sequence
            </a>.
          </div>
        `;

        return;
      }

      rail.innerHTML =
        items.map(
          item => {

            const tracks =
              resolveTracks(item);

            const count =
              item.trackIds
                ? item.trackIds.length
                : tracks.length;

            const icon =
              item.__kind ===
              'Sequence'
                ? '〽'
                : '☰';

            const sub =
              item.__kind ===
              'Sequence'
                ? `Sequence · ${count} tracks`
                : `Playlist · ${count} tracks`;

            return `
              <button
                class="lib-rail-item"
                data-open="${item.__kind.toLowerCase()}"
                data-id="${escapeAttr(item.id)}"
              >

                <div
                  class="lib-rail-thumb"
                  style="background:${gradientFor(
                    item.name +
                    item.id
                  )}"
                >
                  ${icon}
                </div>

                <div
                  class="lib-rail-meta"
                >

                  <strong>
                    ${escapeHtml(item.name)}
                  </strong>

                  <span>
                    ${sub}
                  </span>

                </div>

              </button>
            `;
          }
        ).join('');
    };

  // ================================================================
  // OVERVIEW
  // ================================================================

  const renderOverview =
    () => {

      const likedCount =
        $('likedCount');

      if (likedCount) {

        const count =
          library.filter(
            track =>
              track.liked === true
          ).length;

        likedCount.textContent =
          `${count} liked song${
            count === 1
              ? ''
              : 's'
          }`;
      }

      const recent =
        library
          .slice(-8)
          .reverse();

      const recentRow =
        $('recentRow');

      if (recentRow) {

        recentRow.innerHTML =
          recent.length
            ? recent.map(
                track => `
                  <button
                    class="lib-card"
                    data-play-track="${escapeAttr(track.id)}"
                  >

                    <div
                      class="lib-card-art"
                      style="${
                        track.artwork
                          ? `
                            background-image:url(
                              '${escapeAttr(
                                track.artwork
                              )}'
                            );
                            background-size:cover;
                            background-position:center;
                          `
                          : `
                            background:${gradientFor(
                              track.title +
                              track.artist
                            )}
                          `
                      }"
                    >

                      <span
                        class="lib-card-kind"
                      >
                        ${escapeHtml(
                          track.source ||
                          'Tagged'
                        )}
                      </span>

                      <span
                        class="lib-card-play"
                        data-play-track="${escapeAttr(track.id)}"
                        aria-label="Play ${escapeAttr(track.title)}"
                      >
                        ▶
                      </span>

                    </div>

                    <span
                      class="lib-card-title"
                    >
                      ${escapeHtml(
                        track.title
                      )}
                    </span>

                    <span
                      class="lib-card-sub"
                    >
                      ${escapeHtml(
                        track.artist ||
                        'Unknown artist'
                      )}
                    </span>

                  </button>
                `
              ).join('')
            : `
              <div
                class="lib-rail-empty"
                style="padding-left:0"
              >
                No tracks tagged yet —
                <a href="sequence.html">
                  add some on Sequence
                </a>.
              </div>
            `;
      }

      const overviewPlaylists =
        $('overviewPlaylists');

      if (overviewPlaylists) {

        overviewPlaylists.innerHTML =
          playlists.length
            ? playlists
                .slice(0, 6)
                .map(
                  playlist =>
                    collectionCard(
                      playlist,
                      'Playlist'
                    )
                )
                .join('')
            : emptyBlock(
                'No playlists yet',
                'Create one on the Sequence page once you have tagged a few tracks.',
                'sequence.html',
                'Go to Sequence'
              );
      }

      const overviewSequences =
        $('overviewSequences');

      if (overviewSequences) {

        overviewSequences.innerHTML =
          sequences.length
            ? sequences
                .slice(0, 6)
                .map(
                  sequence =>
                    collectionCard(
                      sequence,
                      'Sequence'
                    )
                )
                .join('')
            : emptyBlock(
                'No sequences yet',
                'Set a target tempo in Flow Lab and thread your first sequence.',
                'sequence.html',
                'Open Flow Lab'
              );
      }

      const artistRow =
        $('artistRow');

      if (artistRow) {

        const artists =
          artistMap();

        artistRow.innerHTML =
          artists.size
            ? Array.from(
                artists.entries()
              )
                .slice(0, 10)
                .map(
                  ([name, tracks]) =>
                    artistCard(
                      name,
                      tracks
                    )
                )
                .join('')
            : `
              <div
                class="lib-rail-empty"
                style="padding-left:0"
              >
                Artists show up here once
                you've saved a few tracks.
              </div>
            `;
      }
    };

  // ================================================================
  // EMPTY BLOCK
  // ================================================================

  const emptyBlock =
    (
      title,
      body,
      href,
      cta
    ) => `
      <div
        class="lib-empty"
        style="grid-column:1/-1"
      >

        <strong>
          ${escapeHtml(title)}
        </strong>

        <p>
          ${escapeHtml(body)}
        </p>

        <a
          class="btn btn-secondary btn-sm"
          href="${escapeAttr(href)}"
        >
          ${escapeHtml(cta)}
          <span class="arrow">
            →
          </span>
        </a>

      </div>
    `;

  // ================================================================
  // LIKED SONGSracks
  // ================================================================
  //
  // IMPORTANT:
  // Only explicitly liked tracks appear here.
  // ================================================================

  const renderLiked =
    () => {

      let likedTracks =
        library
          .filter(
            track =>
              track.liked === true
          )
          .slice()
          .reverse();

      // Artist filtering is no longer automatically triggered.
      // This remains only for compatibility with the existing UI.
      if (artistFilter) {

        likedTracks =
          likedTracks.filter(
            track =>
              (
                track.artist ||
                'Unknown artist'
              ) === artistFilter
          );
      }

      const el =
        $('likedList');

      if (!el) return;

      if (!likedTracks.length) {

        el.innerHTML =
          artistFilter
            ? `
              <div
                class="lib-empty"
              >

                <strong>
                  No liked songs from
                  ${escapeHtml(
                    artistFilter
                  )}
                </strong>

                <p>
                  Try clearing the filter.
                </p>

                <button
                  class="btn btn-secondary btn-sm"
                  id="clearArtistFilter"
                >
                  Clear filter
                </button>

              </div>
            `
            : `
              <div
                class="lib-empty"
              >

                <strong>
                  No liked songs yet
                </strong>

                <p>
                  Press the heart button on a
                  track to add it to Liked Songs.
                </p>

                <a
                  class="btn btn-secondary btn-sm"
                  href="sequence.html"
                >
                  Go to Sequence
                  <span class="arrow">
                    →
                  </span>
                </a>

              </div>
            `;

        const clearBtn =
          $('clearArtistFilter');

        if (clearBtn) {

          clearBtn.addEventListener(
            'click',
            () => {

              artistFilter =
                null;

              renderLiked();
            }
          );
        }

        return;
      }

      const filterNote =
        artistFilter
          ? `
            <div
              class="lib-row-head"
              style="margin-top:0"
            >

              <span
                class="lib-see-all"
              >
                Filtered by
                <strong
                  style="color:var(--chalk)"
                >
                  ${escapeHtml(
                    artistFilter
                  )}
                </strong>
              </span>

              <button
                class="lib-see-all"
                id="clearArtistFilter"
                type="button"
                style="
                  background:none;
                  border:none;
                  cursor:pointer;
                  color:inherit;
                "
              >
                Clear ×
              </button>

            </div>
          `
          : '';

      el.innerHTML =
        filterNote +
        likedTracks
          .map(
            (track, index) => `
              <div
                class="lib-track-row"
                data-id="${escapeAttr(track.id)}"
              >

                <span
                  class="lib-track-num"
                >
                  ${index + 1}
                </span>

                <div
                  class="lib-track-title-cell"
                >

                  ${trackCover(
                    track,
                    'lib-track-art'
                  )}

                  <div>

                    <div
                      class="lib-track-title"
                    >
                      ${escapeHtml(
                        track.title
                      )}
                    </div>

                    <div
                      class="lib-track-artist"
                    >
                      ${escapeHtml(
                        track.artist ||
                        'Unknown artist'
                      )}
                    </div>

                  </div>

                </div>

                <span
                  class="lib-track-meta"
                >
                  ${escapeHtml(
                    track.album ||
                    track.source ||
                    'Tagged track'
                  )}
                </span>

                <span
                  class="lib-track-meta"
                >
                  ${
                    track.bpm
                      ? track.bpm +
                        ' bpm'
                      : '—'
                  }
                  ·
                  ${moodLabel(
                    track.mood
                  )}
                </span>

                <div
                  class="lib-track-actions"
                >

                  <button
                    class="lib-mini-btn"
                    data-play-track="${escapeAttr(track.id)}"
                    title="Play"
                  >
                    ▶
                  </button>

                  <button
                    class="lib-mini-btn liked-btn"
                    data-toggle-like="${escapeAttr(track.id)}"
                    title="Remove from Liked Songs"
                    aria-label="Remove from Liked Songs"
                  >
                    ♥
                  </button>

                  <button
                    class="lib-mini-btn"
                    data-remove-track="${escapeAttr(track.id)}"
                    title="Remove from Library"
                  >
                    ×
                  </button>

                </div>

              </div>
            `
          )
          .join('');

      const clearBtn =
        $('clearArtistFilter');

      if (clearBtn) {

        clearBtn.addEventListener(
          'click',
          () => {

            artistFilter =
              null;

            renderLiked();
          }
        );
      }
    };

  // ================================================================
  // FULL PLAYLIST GRID
  // ================================================================

  const renderAllPlaylists =
    () => {

      const el =
        $('allPlaylists');

      if (!el) return;

      el.innerHTML =
        playlists.length
          ? playlists
              .map(
                playlist =>
                  collectionCard(
                    playlist,
                    'Playlist'
                  )
              )
              .join('')
          : emptyBlock(
              'No playlists yet',
              'Build your first one on the Sequence page.',
              'sequence.html',
              'Go to Sequence'
            );
    };

  // ================================================================
  // FULL SEQUENCE GRID
  // ================================================================

  const renderAllSequences =
    () => {

      const el =
        $('allSequences');

      if (!el) return;

      el.innerHTML =
        sequences.length
          ? sequences
              .map(
                sequence =>
                  collectionCard(
                    sequence,
                    'Sequence'
                  )
              )
              .join('')
          : emptyBlock(
              'No sequences yet',
              'Thread your first one in the Flow Lab.',
              'sequence.html',
              'Open Flow Lab'
            );
    };

  // ================================================================
  // FULL ARTIST GRID
  // ================================================================

  const renderAllArtists =
    () => {

      const el =
        $('allArtists');

      if (!el) return;

      const artists =
        artistMap();

      el.innerHTML =
        artists.size
          ? Array.from(
              artists.entries()
            )
              .map(
                ([name, tracks]) =>
                  artistCard(
                    name,
                    tracks
                  )
              )
              .join('')
          : emptyBlock(
              'No artists yet',
              'Tag a few tracks and they will be grouped by artist here.',
              'sequence.html',
              'Go to Sequence'
            );
    };

  // ================================================================
  // RENDER EVERYTHING
  // ================================================================

  const renderAll =
    () => {

      renderRail();
      renderOverview();
      renderLiked();
      renderAllPlaylists();
      renderAllSequences();
      renderAllArtists();

    };

  // ================================================================
  // TABS
  // ================================================================

  const setTab =
    (tab) => {

      document
        .querySelectorAll(
          '.lib-tab'
        )
        .forEach(
          button => {

            button.classList.toggle(
              'active',
              button.dataset.tab ===
                tab
            );

          }
        );

      document
        .querySelectorAll(
          '.lib-panel'
        )
        .forEach(
          panel => {

            panel.hidden =
              panel.id !==
              `panel-${tab}`;

          }
        );
    };

  const libTabs =
    $('libTabs');

  if (libTabs) {

    libTabs.addEventListener(
      'click',
      (e) => {

        const btn =
          e.target.closest(
            '.lib-tab'
          );

        if (btn) {

          setTab(
            btn.dataset.tab
          );
        }
      }
    );
  }

  document.addEventListener(
    'click',
    (e) => {

      const link =
        e.target.closest(
          '[data-tab-link]'
        );

      if (!link) {
        return;
      }

      e.preventDefault();

      setTab(
        link.dataset.tabLink
      );

      const tabs =
        document.querySelector(
          '.lib-tabs'
        );

      if (tabs) {

        window.scrollTo({
          top:
            tabs.offsetTop - 90,
          behavior:
            'smooth'
        });
      }
    }
  );

  // ================================================================
  // RAIL FILTERS
  // ================================================================

  document
    .querySelectorAll(
      '.lib-chip'
    )
    .forEach(
      chip => {

        chip.addEventListener(
          'click',
          () => {

            document
              .querySelectorAll(
                '.lib-chip'
              )
              .forEach(
                c =>
                  c.classList.remove(
                    'active'
                  )
              );

            chip.classList.add(
              'active'
            );

            railFilter =
              chip.dataset.filter;

            renderRail();
          }
        );
      }
    );

  const railSearch =
    $('railSearch');

  if (railSearch) {

    railSearch.addEventListener(
      'input',
      (e) => {

        railQuery =
          e.target.value;

        renderRail();
      }
    );
  }

  // ================================================================
  // NEW PLAYLIST
  // ================================================================

  const railNewPlaylist =
    $('railNewPlaylist');

  if (railNewPlaylist) {

    railNewPlaylist.addEventListener(
      'click',
      () => {

        const name =
          (
            prompt(
              'Playlist name'
            ) || ''
          ).trim();

        if (!name) {
          return;
        }

        playlists.push({
          id:
            'pl_' +
            Date.now(),

          name,

          trackIds: [],

          tracks: [],

          createdAt:
            new Date()
              .toISOString()
        });

        save(
          'playlists',
          playlists
        );

        renderAll();
      }
    );
  }

  // ================================================================
  // DETAIL OVERLAY
  // ================================================================

  const detail =
    $('libDetail');

  let currentDetail =
    null;

  // ================================================================
  // SEQUENCE METRICS
  // ================================================================

  const MAX_DIST =
    Math.sqrt(3);

  const recomputeSequenceMetrics =
    (orderedTracks) => {

      if (
        orderedTracks.length < 2
      ) {

        return {
          transitions: [],
          smoothness:
            orderedTracks.length
              ? 100
              : 0
        };
      }

      const bpms =
        orderedTracks.map(
          t => t.bpm
        );

      const minBpm =
        Math.min(...bpms);

      const maxBpm =
        Math.max(...bpms);

      const bpmRange =
        (
          maxBpm -
          minBpm
        ) || 1;

      const nodes =
        orderedTracks.map(
          t => ({
            ...t,

            _nt:
              (
                t.bpm -
                minBpm
              ) /
              bpmRange,

            _ne:
              t.energy / 10,

            _nm:
              t.mood / 10
          })
        );

      const dist =
        (a, b) =>
          Math.sqrt(
            (a._nt - b._nt) ** 2 +
            (a._ne - b._ne) ** 2 +
            (a._nm - b._nm) ** 2
          );

      const transitions =
        [];

      for (
        let i = 0;
        i <
        nodes.length - 1;
        i++
      ) {

        const a =
          nodes[i];

        const b =
          nodes[i + 1];

        transitions.push({
          fromId:
            a.id,

          toId:
            b.id,

          distance:
            dist(a, b),

          deltaBpm:
            Math.abs(
              b.bpm -
              a.bpm
            ),

          deltaEnergy:
            Math.abs(
              b.energy -
              a.energy
            ),

          deltaMood:
            Math.abs(
              b.mood -
              a.mood
            )
        });
      }

      const total =
        transitions.reduce(
          (
            sum,
            t
          ) =>
            sum +
            t.distance,
          0
        );

      const smoothness =
        Math.max(
          0,
          Math.min(
            100,
            Math.round(
              100 *
              (
                1 -
                (
                  total /
                  transitions.length
                ) /
                MAX_DIST
              )
            )
          )
        );

      return {
        transitions,
        smoothness
      };
    };

  // ================================================================
  // OPEN DETAIL
  // ================================================================

  const openDetail =
    (kind, id) => {

      currentDetail = {
        kind,
        id
      };

      const source =
        kind === 'sequence'
          ? sequences
          : playlists;

      const item =
        source.find(
          i =>
            String(i.id) ===
            String(id)
        );

      if (!item) {
        return;
      }

      const tracks =
        resolveTracks(item);

      const isSequence =
        kind ===
        'sequence';

      const transitionsById =
        isSequence
          ? new Map(
              (
                item.transitions ||
                []
              ).map(
                t => [
                  `${t.fromId}->${t.toId}`,
                  t
                ]
              )
            )
          : null;

      const detailKind =
        $('detailKind');

      const detailName =
        $('detailName');

      const detailMeta =
        $('detailMeta');

      const detailArt =
        $('detailArt');

      const detailList =
        $('detailList');

      if (
        detailKind
      ) {

        detailKind.textContent =
          isSequence
            ? 'Sequence'
            : 'Playlist';
      }

      if (
        detailName
      ) {

        detailName.textContent =
          item.name;
      }

      if (
        detailMeta
      ) {

        detailMeta.textContent =
          isSequence
            ? `${
                item.tempo ||
                '—'
              } bpm start · ${
                tracks.length
              } track${
                tracks.length === 1
                  ? ''
                  : 's'
              }${
                typeof item.smoothness ===
                'number'
                  ? ` · ${item.smoothness}% smooth`
                  : ''
              }`
            : `${tracks.length} track${
                tracks.length === 1
                  ? ''
                  : 's'
              }`;
      }

      if (detailArt) {

        detailArt.style.background =
          gradientFor(
            item.name +
            item.id
          );

        detailArt.textContent =
          isSequence
            ? '〽'
            : '♪';
      }

      if (detailList) {

        detailList.innerHTML =
          tracks.length
            ? tracks.map(
                (t, i) => {

                  const prev =
                    tracks[i - 1];

                  const trans =
                    isSequence &&
                    prev
                      ? transitionsById.get(
                          `${prev.id}->${t.id}`
                        )
                      : null;

                  const jumpPct =
                    trans
                      ? Math.round(
                          (
                            1 -
                            trans.distance /
                              MAX_DIST
                          ) *
                          100
                        )
                      : null;

                  const jumpNote =
                    isSequence
                      ? (
                          trans
                            ? `
                              <span
                                class="lib-track-meta"
                                style="
                                  font-size:11px;
                                  color:${
                                    jumpPct < 55
                                      ? 'var(--ember)'
                                      : 'var(--current)'
                                  };
                                "
                              >
                                ${jumpPct}% smooth transition
                              </span>
                            `
                            : `
                              <span
                                class="lib-track-meta"
                                style="
                                  font-size:11px;
                                  color:var(--signal)
                                "
                              >
                                Start
                              </span>
                            `
                        )
                      : '';

                  return `
                    <div
                      class="lib-track-row"
                      style="
                        grid-template-columns:
                          34px
                          1fr
                          90px
                          110px
                      "
                      data-id="${escapeAttr(t.id)}"
                    >

                      <span
                        class="lib-track-num"
                      >
                        ${
                          isSequence
                            ? i + 1
                            : '▸'
                        }
                      </span>

                      <div
                        class="lib-track-title-cell"
                      >

                        ${trackCover(
                          t,
                          'lib-track-art'
                        )}

                        <div>

                          <div
                            class="lib-track-title"
                          >
                            ${escapeHtml(
                              t.title
                            )}
                          </div>

                          <div
                            class="lib-track-artist"
                          >
                            ${escapeHtml(
                              t.artist ||
                              'Unknown artist'
                            )}

                            ${
                              jumpNote
                                ? ' · '
                                : ''
                            }

                            ${jumpNote}
                          </div>

                        </div>

                      </div>

                      <span
                        class="lib-track-meta"
                      >
                        ${
                          t.bpm
                            ? t.bpm +
                              ' bpm'
                            : '—'
                        }
                      </span>

                      <div
                        class="lib-track-actions"
                      >

                        <button
                          class="lib-mini-btn"
                          data-play-track="${escapeAttr(t.id)}"
                          title="Play"
                        >
                          ▶
                        </button>

                        <button
                          class="lib-mini-btn"
                          data-remove-from-collection="${escapeAttr(t.id)}"
                          title="Remove from this ${kind}"
                        >
                          ×
                        </button>

                      </div>

                    </div>
                  `;
                }
              ).join('')
            : `
              <p
                class="form-sub"
                style="padding:10px 4px"
              >
                No tracks in this
                ${kind} yet.
              </p>
            `;
      }

      if (detail) {
        detail.hidden = false;
      }
    };

  // ================================================================
  // DETAIL CLOSE
  // ================================================================

  if (detail) {

    const closeButton =
      $('detailClose');

    if (closeButton) {

      closeButton.addEventListener(
        'click',
        () => {

          detail.hidden =
            true;

          currentDetail =
            null;
        }
      );
    }

    detail.addEventListener(
      'click',
      (e) => {

        if (
          e.target ===
          detail
        ) {

          detail.hidden =
            true;

          currentDetail =
            null;
        }
      }
    );
  }

  // ================================================================
  // RENAME
  // ================================================================

  const detailRename =
    $('detailRename');

  if (detailRename) {

    detailRename.addEventListener(
      'click',
      () => {

        if (!currentDetail) {
          return;
        }

        const source =
          currentDetail.kind ===
          'sequence'
            ? sequences
            : playlists;

        const item =
          source.find(
            i =>
              String(i.id) ===
              String(
                currentDetail.id
              )
          );

        if (!item) {
          return;
        }

        const next =
          (
            prompt(
              'Rename to:',
              item.name
            ) || ''
          ).trim();

        if (
          !next ||
          next ===
            item.name
        ) {
          return;
        }

        item.name =
          next;

        save(
          currentDetail.kind ===
          'sequence'
            ? 'sequences'
            : 'playlists',
          source
        );

        renderAll();

        openDetail(
          currentDetail.kind,
          currentDetail.id
        );
      }
    );
  }

  // ================================================================
  // ARTIST CLICKS / REMOVE SONG
  // ================================================================
  //
  // IMPORTANT:
  // There is NO artist -> liked redirect anymore.
  //
  // Artists are display-only cards.
  // ================================================================

  document.addEventListener(
    'click',
    (e) => {

      // ------------------------------------------------------------
      // Toggle liked state
      // ------------------------------------------------------------

      const likeButton =
        e.target.closest(
          '[data-toggle-like]'
        );

      if (likeButton) {

        e.preventDefault();
        e.stopPropagation();

        const id =
          likeButton.dataset
            .toggleLike;

        const track =
          library.find(
            item =>
              String(item.id) ===
              String(id)
          );

        if (!track) {
          return;
        }

        track.liked =
          track.liked !== true;

        save(
          'library',
          library
        );

        renderAll();

        return;
      }

      // ------------------------------------------------------------
      // Collection cards only
      // ------------------------------------------------------------

      const opener =
        e.target.closest(
          '[data-open]'
        );

      if (opener) {

        const kind =
          opener.dataset.open;

        // Artist cards do NOT have data-open anymore.
        // Therefore only playlist/sequence cards reach here.

        if (
          kind ===
            'playlist' ||
          kind ===
            'sequence'
        ) {

          openDetail(
            kind,
            opener.dataset.id
          );
        }

        return;
      }

      // ------------------------------------------------------------
      // Remove track from library
      // ------------------------------------------------------------

      const removeBtn =
        e.target.closest(
          '[data-remove-track]'
        );

      if (removeBtn) {

        e.preventDefault();
        e.stopPropagation();

        const id =
          removeBtn.dataset
            .removeTrack;

        library =
          library.filter(
            track =>
              String(track.id) !==
              String(id)
          );

        save(
          'library',
          library
        );

        renderAll();

        return;
      }
    }
  );

  // ================================================================
  // REMOVE TRACK FROM PLAYLIST / SEQUENCE
  // ================================================================

  if (detail) {

    detail.addEventListener(
      'click',
      (e) => {

        const removeBtn =
          e.target.closest(
            '[data-remove-from-collection]'
          );

        if (
          !removeBtn ||
          !currentDetail
        ) {
          return;
        }

        const trackId =
          removeBtn.dataset
            .removeFromCollection;

        const isSequence =
          currentDetail.kind ===
          'sequence';

        const source =
          isSequence
            ? sequences
            : playlists;

        const item =
          source.find(
            entry =>
              String(entry.id) ===
              String(
                currentDetail.id
              )
          );

        if (!item) {
          return;
        }

        item.trackIds =
          (
            item.trackIds ||
            []
          ).filter(
            id =>
              String(id) !==
              String(trackId)
          );

        if (isSequence) {

          const remaining =
            resolveTracks(item);

          const result =
            recomputeSequenceMetrics(
              remaining
            );

          item.transitions =
            result.transitions;

          item.smoothness =
            result.smoothness;
        }

        save(
          isSequence
            ? 'sequences'
            : 'playlists',
          source
        );

        renderAll();

        openDetail(
          currentDetail.kind,
          currentDetail.id
        );
      }
    );
  }

  // ================================================================
  // AUDIO PLAYER
  // ================================================================

  const audio =
    $('libAudio');

  let playingId =
    null;

  const findTrack =
    (id) =>
      library.find(
        track =>
          String(track.id) ===
          String(id)
      );

  const recordPlayHistory = (track) => {
    if (!window.SequencerStore || !track) return;
    const history = window.SequencerStore.get('history', []);
    const entry = {
      id: track.id,
      title: track.title || 'Unknown track',
      artist: track.artist || 'Unknown artist',
      artwork: track.artwork || '',
      playedAt: new Date().toISOString()
    };
    const filtered = Array.isArray(history)
      ? history.filter(item => !(String(item.id) === String(entry.id) && Date.now() - new Date(item.playedAt || 0).getTime() < 60000))
      : [];
    window.SequencerStore.set('history', [entry, ...filtered].slice(0, 100));
  };

  const setPlayingUI =
    (id) => {

      document
        .querySelectorAll(
          '[data-play-track]'
        )
        .forEach(
          button => {

            button.classList.toggle(
              'is-playing',
              button.dataset.playTrack ===
                String(id)
            );

            if (
              button.classList.contains(
                'lib-mini-btn'
              )
            ) {

              button.textContent =
                button.dataset.playTrack ===
                String(id)
                  ? '❚❚'
                  : '▶';
            }
          }
        );
    };

  // ================================================================
  // PLAY TRACK
  // ================================================================

  const playTrack =
    async (id) => {

      if (!audio) {
        return;
      }

      const track =
        findTrack(id);

      if (!track) {
        return;
      }

      if (
        playingId ===
          String(id) &&
        !audio.paused
      ) {

        audio.pause();

        playingId =
          null;

        setPlayingUI(
          null
        );

        return;
      }

      if (!track.previewUrl) {

        const result =
          await findTrackOnITunes(
            track
          );

        if (
          result?.previewUrl
        ) {

          track.previewUrl =
            result.previewUrl;

          if (
            !track.artwork &&
            result.artworkUrl100
          ) {

            track.artwork =
              result.artworkUrl100
                .replace(
                  '100x100',
                  '600x600'
                );
          }

          save(
            'library',
            library
          );

          renderAll();
        }
      }

      if (!track.previewUrl) {

        alert(
          `No preview is available for "${track.title}".`
        );

        return;
      }

      try {

        audio.pause();

        audio.src =
          track.previewUrl;

        audio.load();

        await audio.play();

        recordPlayHistory(track);

        playingId =
          String(id);

        setPlayingUI(
          String(id)
        );

      } catch (error) {

        console.warn(
          'Audio playback failed:',
          error
        );

        playingId =
          null;

        setPlayingUI(
          null
        );
      }
    };

  if (audio) {

    audio.addEventListener(
      'ended',
      () => {

        playingId =
          null;

        setPlayingUI(
          null
        );
      }
    );
  }

  // ================================================================
  // PLAY BUTTONS
  // ================================================================

  document.addEventListener(
    'click',
    (e) => {

      const playButton =
        e.target.closest(
          '[data-play-track]'
        );

      if (playButton) {

        e.preventDefault();
        e.stopPropagation();

        playTrack(
          playButton.dataset
            .playTrack
        );

        return;
      }

      const collectionButton =
        e.target.closest(
          '[data-play-collection]'
        );

      if (!collectionButton) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const kind =
        collectionButton.dataset.kind;

      const source =
        kind === 'sequence'
          ? sequences
          : playlists;

      const item =
        source.find(
          entry =>
            String(entry.id) ===
            String(
              collectionButton
                .dataset
                .playCollection
            )
        );

      if (!item) {
        return;
      }

      const tracks =
        resolveTracks(item);

      const playable =
        tracks.find(
          track =>
            track.previewUrl
        ) ||
        tracks[0];

      if (playable) {

        playTrack(
          playable.id
        );
      }
    }
  );

  // ================================================================
  // INITIAL RENDER
  // ================================================================

  renderAll();

  // Repair old metadata first.
  repairMissingTrackMetadata()
    .then(
      () =>
        loadMissingArtistImages()
    )
    .catch(
      error => {

        console.warn(
          'Library metadata repair failed:',
          error
        );
      }
    );

});