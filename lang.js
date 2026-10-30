// Our Tiny Planet: the website's languages. Two small jobs, both extra (the
// pages and the language menu work without scripts):
//  1. On the English home page only, a first visit from a browser set to one
//     of our other languages goes to that language's home page.
//  2. Choosing a language in the menu remembers it (one localStorage key,
//     "otp-lang"), so the English home page never sends you away again.
// No third-party scripts; nothing else is stored.
(() => {
  const KEY = 'otp-lang';
  // Folder per language ("" is English, at the root).
  const FOLDERS = ['ja', 'de', 'fr', 'es', 'pt', 'ar', 'ko', 'zh-hant', 'it', 'zh-hans', 'tr', 'id',
    'ru', 'pl', 'th', 'vi', 'nl', 'sv', 'da', 'nb', 'fi', 'uk'];
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private mode: fine */ } };

  // The folder for one browser language tag, "en" for English, or null.
  function folderFor(tag) {
    const p = String(tag || '').toLowerCase().split(/[-_]/);
    const l = p[0];
    if (l === 'en') return 'en';
    if (l === 'zh') {
      if (p.includes('hant')) return 'zh-hant';
      if (p.includes('hans')) return 'zh-hans';
      return p.some((x) => x === 'tw' || x === 'hk' || x === 'mo') ? 'zh-hant' : 'zh-hans';
    }
    if (l === 'no' || l === 'nn' || l === 'nb') return 'nb';
    if (l === 'in') return 'id';
    return FOLDERS.includes(l) ? l : null;
  }

  // ------------------------------------------------------------ 1. the first visit
  const root = document.documentElement;
  const home = root.dataset.lang === 'en' && root.dataset.page === 'index';
  const bot = navigator.webdriver || /bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(navigator.userAgent);
  // Coming from one of our own pages (for example the English link in the
  // menu) means the visitor is already where they want to be.
  const fromHere = document.referrer && document.referrer.indexOf(location.origin + '/') === 0;
  if (home && !bot && !fromHere && !location.search && !location.hash) {
    const chosen = read();
    let target = chosen && (chosen === 'en' || FOLDERS.includes(chosen)) ? chosen : null;
    if (!target) {
      const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
      for (const t of langs) {
        target = folderFor(t);
        if (target) break;
      }
    }
    if (target && target !== 'en') {
      location.replace(target + (location.protocol === 'file:' ? '/index.html' : '/'));
      return;
    }
  }

  // ------------------------------------------------------------ 2. the menu
  const enhance = () => {
    document.querySelectorAll('details.lang').forEach((menu) => {
      menu.querySelectorAll('a[data-l]').forEach((a) => a.addEventListener('click', () => save(a.dataset.l)));
      menu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.open) {
          menu.open = false;
          menu.querySelector('summary').focus();
        }
      });
    });
    // A tap anywhere else closes an open menu.
    document.addEventListener('click', (e) => {
      document.querySelectorAll('details.lang[open]').forEach((menu) => {
        if (!menu.contains(e.target)) menu.open = false;
      });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
})();
