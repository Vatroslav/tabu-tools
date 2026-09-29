// Page language. Order: ?lang=hr|en in the URL (incoming links only), the choice saved from the toggle,
// then the browser language (Croatian, Serbian, Bosnian -> HR; Montenegro and anything else -> EN).
(function () {
  const KEY = 'tabu-lang';
  const valid = (v) => v === 'hr' || v === 'en';

  function initial() {
    const p = new URLSearchParams(location.search).get('lang');
    if (valid(p)) return p;
    try {
      const s = localStorage.getItem(KEY);
      if (valid(s)) return s;
    } catch {
      /* storage unavailable: fall through to the browser language */
    }
    const parts = (navigator.language || '').toLowerCase().split('-');
    return ['hr', 'sr', 'bs', 'sh'].includes(parts[0]) && !parts.includes('me') ? 'hr' : 'en';
  }

  function save(lang) {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
    // Drop ?lang= from the address so it cannot override the saved choice on reload
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) {
      u.searchParams.delete('lang');
      history.replaceState(null, '', u);
    }
  }

  window.tabuLang = { initial, save };
})();
