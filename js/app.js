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

  // Hero player card — click a row to toggle its "playing" state (one at a time)
  const playerRows = document.querySelectorAll('.player-row');
  if (playerRows.length) {
    playerRows.forEach((row) => {
      row.addEventListener('click', () => {
        const wasPlaying = row.classList.contains('playing');
        playerRows.forEach((r) => r.classList.remove('playing'));
        if (!wasPlaying) row.classList.add('playing');
      });
    });
  }

  // Back-to-top button
  const toTop = document.getElementById('toTop');
  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
});
