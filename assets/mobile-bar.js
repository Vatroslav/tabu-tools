// Hides the fixed mobile result bar once the user has scrolled down to the
// result tile; it comes back only when scrolling up above the tile again.
(function () {
  const bar = document.querySelector('.mobile-bar');
  const tile = document.querySelector('.tile');
  if (!bar || !tile) return;
  const update = () => {
    // 110px keeps the tile from counting as visible while the bar still covers it.
    const reached = tile.getBoundingClientRect().top < window.innerHeight - 110;
    bar.classList.toggle('is-hidden', reached);
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  // Re-check when the page height changes (inputs render after this script runs).
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(document.body);
  update();
})();
