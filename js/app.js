// ---------- Sequencer: shared page interactions ----------

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nav: add a "scrolled" state once the page moves under it
  const nav = document.getElementById('siteNav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Reveal-on-scroll for anything marked .reveal / .reveal-left / .reveal-right / .reveal-scale / .word-reveal
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .word-reveal');
  if (revealEls.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(el => el.classList.add('in-view'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          // Toggle both ways (not just add + unobserve) so the animation replays
          // every time an element crosses back into view, not just the first time.
          entry.target.classList.toggle('in-view', entry.isIntersecting);
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

      revealEls.forEach(el => io.observe(el));
    }
  }

  // The homepage's fictional tracks have local, original audio demos.
  const playerRows = [...document.querySelectorAll('.player-row')];
  if (playerRows.length) {
    const audio = new Audio();
    audio.id = 'homeDemoAudio';
    document.body.appendChild(audio);
    let active = null;
    let request = 0;
    const reset = () => playerRows.forEach(row => {
      row.classList.remove('playing');
      row.querySelector('button').setAttribute('aria-pressed', 'false');
    });
    for (const row of playerRows) {
      row.querySelector('button').setAttribute('aria-pressed', 'false');
      row.addEventListener('click', async () => {
        const current = ++request;
        if (active === row && !audio.paused) { audio.pause(); active = null; reset(); window.SequencerMedia.status('Demo paused.'); return; }
        audio.pause(); reset(); active = null;
        const title = row.querySelector('.player-title').textContent;
        const artist = row.querySelector('.player-artist').textContent.split('·')[0].trim();
        window.SequencerMedia.prime(audio);
        try {
          await window.SequencerMedia.play(audio, window.SequencerMedia.demoUrl({ title, artist }));
          if (current !== request) return;
          active = row; row.classList.add('playing');
          row.querySelector('button').setAttribute('aria-pressed', 'true');
          window.SequencerMedia.status('Playing original generated demo: ' + title);
        } catch (error) { if (current === request) { reset(); window.SequencerMedia.status(window.SequencerMedia.errorMessage(error)); } }
      });
    }
    audio.addEventListener('ended', () => { active = null; reset(); window.SequencerMedia.status('Demo finished.'); });
    window.addEventListener('pagehide', () => audio.pause());
  }

  // Back-to-top button
  const toTop = document.getElementById('toTop');
  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
});
