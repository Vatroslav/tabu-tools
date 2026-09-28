// Light/dark theme toggle. The initial theme is set by an inline script in <head>
// (before first paint); this file wires up the toggle button and its labels.
(function () {
  const LABELS = {
    hr: ['Uključi tamni način', 'Uključi svijetli način'],
    en: ['Switch to dark mode', 'Switch to light mode'],
  };

  function apply() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const lang = document.documentElement.lang === 'en' ? 'en' : 'hr';
    const label = LABELS[lang][dark ? 1 : 0];
    document.querySelectorAll('.theme-toggle').forEach((b) => {
      b.setAttribute('aria-label', label);
      b.title = label;
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.theme-toggle');
    if (!b) return;
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('tabu-theme', next);
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
    apply();
  });

  window.tabuTheme = { apply };
  apply();
})();
