// Page language comes from the URL: /en/... is English, everything else is Croatian.
// Each language has its own address (linked with hreflang), so search engines index both
// and nothing switches the language in place. The HR/EN toggle moves to the other address
// and keeps the query string (calculator state).
//
// A visitor whose preferred language differs from the page gets a one-line offer of the other
// version, never an automatic redirect. Preferred language: the toggle choice saved earlier,
// otherwise the browser language (Croatian, Serbian, Bosnian -> HR; Montenegro and anything
// else -> EN).
(function () {
  const KEY = 'tabu-lang';
  const valid = (v) => v === 'hr' || v === 'en';
  const page = /^\/en(\/|$)/.test(location.pathname) ? 'en' : 'hr';

  const OFFER = {
    en: { text: 'This page is also available in English.', link: 'English version →', close: 'Close' },
    hr: { text: 'Ova stranica postoji i na hrvatskom.', link: 'Hrvatska verzija →', close: 'Zatvori' },
  };

  function urlFor(lang) {
    const u = new URL(location.href);
    const path = u.pathname.replace(/^\/en(\/|$)/, '/');
    u.pathname = lang === 'en' ? '/en' + path : path;
    u.searchParams.delete('lang');
    return u.href;
  }

  function save(lang) {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* storage unavailable: nothing to remember */
    }
  }

  function preferred() {
    try {
      const s = localStorage.getItem(KEY);
      if (valid(s)) return s;
    } catch {
      /* storage unavailable: fall through to the browser language */
    }
    const parts = (navigator.language || '').toLowerCase().split('-');
    return ['hr', 'sr', 'bs', 'sh'].includes(parts[0]) && !parts.includes('me') ? 'hr' : 'en';
  }

  function go(lang) {
    save(lang);
    if (lang !== page) location.href = urlFor(lang);
  }

  function offer() {
    const want = preferred();
    if (want === page) return;
    const o = OFFER[want];
    const bar = document.createElement('div');
    bar.className = 'lang-offer';
    bar.lang = want;
    const text = document.createElement('span');
    text.textContent = o.text;
    const link = document.createElement('a');
    link.href = urlFor(want);
    link.textContent = o.link;
    link.addEventListener('click', () => {
      link.href = urlFor(want); // the calculator may have changed the query string since load
      save(want);
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lang-offer__close';
    close.setAttribute('aria-label', o.close);
    close.textContent = '×';
    close.addEventListener('click', () => {
      save(page);
      bar.remove();
    });
    bar.append(text, link, close);
    (document.querySelector('.page') || document.body).prepend(bar);
  }

  window.tabuLang = { initial: () => page, urlFor, go };

  // Older links carried ?lang=hr|en on a single address; send them to the matching page.
  const asked = new URLSearchParams(location.search).get('lang');
  if (valid(asked) && asked !== page) {
    location.replace(urlFor(asked));
    return;
  }

  document.querySelectorAll('.lang-toggle button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === page));
    b.addEventListener('click', () => go(b.dataset.lang));
  });
  offer();
})();
