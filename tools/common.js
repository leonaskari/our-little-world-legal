// Our Tiny Planet tools: what the four tools share. The page's words (from its
// <script type="application/json" id="tool-text">, written by tool/site/tools/pages.py from
// i18n/<lang>.json), the city search (an accessible combobox), distances on the globe,
// time zones, the little world map, links and copying. No libraries and no requests.
(() => {
  const OTP = (window.OTP = window.OTP || {});

  // ------------------------------------------------------------------ words
  let T = { ui: {}, countries: {}, countryIn: {}, waters: {}, cities: {}, cityAliases: {} };
  try { T = { ...T, ...JSON.parse(document.getElementById('tool-text').textContent) }; } catch { /* keys show */ }
  const lang = document.documentElement.lang || 'en-GB';
  OTP.lang = lang;
  OTP.english = /^en\b/i.test(lang);
  let locale = lang;
  try { locale = Intl.NumberFormat.supportedLocalesOf(`${lang}-u-nu-latn`)[0] || lang; } catch { /* keep */ }
  OTP.locale = locale; // Latin digits, like the rest of the site
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
  const rules = new Intl.PluralRules(lang);
  OTP.t = (key, vars) => fill(T.ui[key] != null ? T.ui[key] : key, vars);
  // A string with plural forms: {"one": "...", "other": "..."} (and few, many, two, zero where the language has them).
  OTP.tp = (key, n, vars) => {
    const forms = T.ui[key] || {};
    const s = forms[rules.select(n)] || forms.other || key;
    return fill(s, { n: OTP.num(n), ...vars });
  };
  OTP.water = (id, p) => {
    const w = T.waters;
    if (id === 'atlantic' || id === 'pacific') return w[`${id}_${p.lat >= 0 ? 'n' : 's'}`] || id;
    return w[id] || id;
  };
  OTP.list = (items) => { try { return new Intl.ListFormat(lang, { type: 'conjunction' }).format(items); } catch { return items.join(', '); } };

  // ------------------------------------------------------------------ countries
  const ENGLISH = window.OTP_COUNTRIES || {};
  const display = (style) => { try { return new Intl.DisplayNames([lang], { type: 'region', style }); } catch { return null; } };
  const dnLong = display('long'), dnShort = display('short');
  const SHORT = new Set(['HK', 'MO', 'PS']); // "Hong Kong", not "Hong Kong SAR China"
  const countryCache = {};
  OTP.country = (cc) => {
    if (countryCache[cc]) return countryCache[cc];
    let n = T.countries[cc];
    if (!n) { try { n = (SHORT.has(cc) ? dnShort : dnLong).of(cc); } catch { n = ''; } }
    if (!n || n === cc) n = ENGLISH[cc] || cc;
    return (countryCache[cc] = n);
  };
  OTP.countryIn = (cc) => T.countryIn[cc] || OTP.t('place_in', { country: OTP.country(cc) });

  // ------------------------------------------------------------------ the cities
  // Folded for matching: no accents, no case, letters of any script kept.
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/[ʻ'’.]/g, '')
    // Arabic: hamza forms of alif, taa marbuta, alif maqsura and the diacritics (shadda, tashkil) match.
    .replace(/[\u064B-\u0655\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
  OTP.fold = fold;
  const cities = (window.OTP_CITIES || []).map((r) => {
    const [id, english, cc, lat, lon, zone, weight, region, aliases] = r;
    const name = T.cities[id] || english;
    const alias = [...(aliases ? aliases.split(',') : []), ...(T.cityAliases[id] ? T.cityAliases[id].split(',') : [])];
    const country = OTP.country(cc);
    const names = [...new Set([name, english].map(fold))];
    return {
      id, name, english, cc, lat, lon, zone, region, country, hub: (weight & 1) === 1, weight,
      keys: names, aliasKeys: alias.map(fold),
      words: fold([name, english, region, country, ENGLISH[cc] || '', alias.join(' ')].join(' ')).split(' '),
    };
  });
  // Two of a name in one country (Portland, Oregon and Portland, Maine) show their state.
  const seen = {};
  for (const c of cities) seen[c.keys[0] + c.cc] = (seen[c.keys[0] + c.cc] || 0) + 1;
  for (const c of cities) {
    c.twin = seen[c.keys[0] + c.cc] > 1;
    c.label = OTP.t('city_label', { city: c.name, country: c.twin ? c.region : c.country });
    c.short = c.name;
  }
  const byId = new Map(cities.map((c) => [c.id, c]));
  OTP.cities = cities;
  OTP.city = (id) => byId.get(String(id || '').toLowerCase()) || null;

  OTP.search = (query, limit = 8) => {
    const q = fold(query);
    if (!q) return [];
    const tokens = q.split(' ');
    const out = [];
    for (const c of cities) {
      let s = 0;
      if (c.keys.includes(q)) s = 120;
      else if (c.keys.some((k) => k.startsWith(q))) s = 100;
      else if (c.aliasKeys.includes(q)) s = 95;
      else if (c.aliasKeys.some((a) => a.startsWith(q))) s = 85;
      else if (tokens.every((t) => c.words.some((w) => w.startsWith(t)))) s = c.keys.some((k) => k.split(' ').some((w) => w.startsWith(tokens[0]))) ? 60 : 40;
      if (s) out.push([s + c.weight, c]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out.slice(0, limit).map((x) => x[1]);
  };

  // The browser's own time zone, and the best-known city in it (a starting guess, never sent anywhere).
  OTP.homeZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })();
  OTP.cityForZone = (zone) => {
    let best = null;
    for (const c of cities) if (c.zone === zone && (!best || c.weight > best.weight)) best = c;
    return best;
  };

  // ------------------------------------------------------------------ the city field
  // <input role="combobox"> with a listbox under it, as the ARIA authoring practices describe:
  // arrows move, Enter or a tap chooses, Escape closes, and leaving the field keeps the best match.
  let fieldCount = 0;
  OTP.cityField = (input, { onPick } = {}) => {
    const n = ++fieldCount;
    const list = document.getElementById(input.getAttribute('aria-controls'));
    const status = document.createElement('p');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    input.closest('.combo').append(status);
    let results = [], active = -1, picked = null;

    const close = () => {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    };
    const mark = (i) => {
      active = i;
      [...list.children].forEach((li, j) => li.setAttribute('aria-selected', j === i ? 'true' : 'false'));
      if (i >= 0) {
        const li = list.children[i];
        input.setAttribute('aria-activedescendant', li.id);
        li.scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    };
    const render = () => {
      list.textContent = '';
      results.forEach((c, i) => {
        const li = document.createElement('li');
        li.id = `city-${n}-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        const b = document.createElement('span');
        b.className = 'opt-name';
        b.textContent = c.name;
        const s = document.createElement('span');
        s.className = 'opt-where';
        s.textContent = c.region ? `${c.region}, ${c.country}` : c.country;
        li.append(b, s);
        li.addEventListener('mousedown', (e) => e.preventDefault());
        li.addEventListener('click', () => choose(c));
        list.append(li);
      });
      const open = results.length > 0;
      list.hidden = !open;
      input.setAttribute('aria-expanded', String(open));
      status.textContent = input.value.trim() ? (results.length ? OTP.tp('search_found', results.length) : OTP.t('search_none')) : '';
      active = -1;
    };
    const choose = (c, quiet) => {
      picked = c;
      input.value = c ? c.label : '';
      input.setAttribute('aria-invalid', 'false');
      close();
      if (!quiet && onPick) onPick(c);
    };
    input.addEventListener('input', () => {
      picked = null;
      results = OTP.search(input.value);
      render();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (list.hidden) { results = OTP.search(input.value); render(); }
        if (!results.length) return;
        const d = e.key === 'ArrowDown' ? 1 : -1;
        mark((active + d + results.length + (active < 0 && d < 0 ? 1 : 0)) % results.length);
      } else if (e.key === 'Enter') {
        if (!list.hidden && results.length) {
          e.preventDefault();
          choose(results[Math.max(0, active)]);
        }
      } else if (e.key === 'Escape') {
        if (!list.hidden) { e.preventDefault(); close(); }
        else if (input.value) { e.preventDefault(); input.value = ''; picked = null; if (onPick) onPick(null); }
      }
    });
    input.addEventListener('focus', () => { if (picked) input.select(); });
    input.addEventListener('blur', () => {
      // Leaving with a half-typed name keeps the best match, so "london" then Tab just works.
      if (!picked && input.value.trim()) {
        const best = OTP.search(input.value, 1)[0];
        if (best) choose(best);
        else input.setAttribute('aria-invalid', 'true');
      }
      close();
    });
    return {
      get city() { return picked; },
      set(c) { choose(c, true); },
    };
  };

  // ------------------------------------------------------------------ the globe
  const R = 6371.0088; // mean Earth radius, km
  const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
  OTP.KM_PER_MILE = 1.609344;
  OTP.km = (a, b) => {
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  // The point a fraction f of the way along the great circle from a to b.
  OTP.along = (a, b, f) => {
    const p1 = rad(a.lat), l1 = rad(a.lon), p2 = rad(b.lat), l2 = rad(b.lon);
    const d = OTP.km(a, b) / R;
    if (d < 1e-9) return { lat: a.lat, lon: a.lon };
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) };
  };
  OTP.midpoint = (a, b) => OTP.along(a, b, 0.5);

  // ------------------------------------------------------------------ numbers, distances, durations
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  OTP.num = (x) => nf.format(Math.round(x));
  OTP.miles = (km) => km / OTP.KM_PER_MILE;
  // Miles first where people think in miles (a browser set to the UK or the US), kilometres everywhere else.
  const region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
  OTP.milesFirst = ['GB', 'US', 'LR', 'MM'].includes(region) || (!region && /^en$/i.test(navigator.language || '') && OTP.english);
  const unitFmt = (unit, display) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: display, maximumFractionDigits: 0 });
  const miF = unitFmt('mile', 'long'), kmF = unitFmt('kilometer', 'short');
  OTP.mi = (km) => miF.format(Math.round(OTP.miles(km)));
  OTP.kmText = (km) => kmF.format(Math.round(km));
  OTP.dist = (km) => (OTP.milesFirst ? OTP.mi(km) : OTP.kmText(km));
  OTP.distBoth = (km) => (OTP.milesFirst ? `${OTP.mi(km)} (${OTP.kmText(km)})` : `${OTP.kmText(km)} (${OTP.mi(km)})`);
  // The number and its unit apart, for the big result.
  OTP.distParts = (km) => {
    const parts = (OTP.milesFirst ? miF : unitFmt('kilometer', 'long')).formatToParts(Math.round(OTP.milesFirst ? OTP.miles(km) : km));
    return { number: parts.filter((p) => p.type !== 'unit' && p.type !== 'literal').map((p) => p.value).join(''), unit: parts.filter((p) => p.type === 'unit').map((p) => p.value).join(' ') };
  };
  const hourL = unitFmt('hour', 'long'), minL = unitFmt('minute', 'long');
  OTP.hours = (h) => hourL.format(h);
  // "6 h 50 min" (rounded to five minutes).
  OTP.hm = (hours) => {
    let h = Math.floor(hours), m = Math.round((hours - h) * 60 / 5) * 5;
    if (m === 60) { h += 1; m = 0; }
    if (!h) return minL.format(m);
    return m ? OTP.t('dur_hm', { h: OTP.num(h), m: String(m).padStart(2, '0') }) : hourL.format(h);
  };
  // A gap in hours and minutes: "11 hours", "5 hours 30 minutes".
  OTP.gap = (minutes) => {
    const a = Math.abs(minutes), h = Math.floor(a / 60), m = a % 60;
    if (h && m) return OTP.t('dur_h_m', { h: hourL.format(h), m: minL.format(m) });
    return h ? hourL.format(h) : minL.format(m);
  };
  const coordF = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  OTP.coord = (p) => OTP.t('coord', {
    lat: coordF.format(Math.abs(p.lat)), ns: OTP.t(p.lat >= 0 ? 'north' : 'south'),
    lon: coordF.format(Math.abs(p.lon)), ew: OTP.t(p.lon >= 0 ? 'east' : 'west'),
  });
  OTP.el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // ------------------------------------------------------------------ time zones
  // 12 or 24 hour clock: on the English page, whatever this browser uses; otherwise the language's own habit.
  OTP.h12 = (() => {
    try { return !!new Intl.DateTimeFormat(OTP.english ? undefined : lang, { hour: 'numeric' }).resolvedOptions().hour12; } catch { return false; }
  })();
  const dtf = {};
  const partsFmt = (zone) => (dtf[zone] ||= new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short',
  }));
  // The wall clock in a zone at an instant: {y, m, d, h, mi, s, wd}.
  OTP.wall = (zone, date) => {
    const p = {};
    for (const x of partsFmt(zone).formatToParts(date)) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: p.weekday };
  };
  // Minutes ahead of UTC in a zone at an instant (summer time included).
  OTP.offset = (zone, date) => {
    const w = OTP.wall(zone, date);
    return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  };
  // The instant a wall clock in a zone shows y-m-d h:mi (the earlier one if the clocks go back,
  // the moment after the gap if they go forward).
  OTP.instant = (zone, y, m, d, h, mi) => {
    const guess = Date.UTC(y, m - 1, d, h, mi);
    const offsets = new Set([-43200000, 0, 43200000].map((dt) => OTP.offset(zone, new Date(guess + dt))));
    const fits = [];
    for (const o of offsets) {
      const t = guess - o * 60000, w = OTP.wall(zone, new Date(t));
      if (w.d === d && w.h === h && w.mi === mi) fits.push(t);
    }
    if (fits.length) return new Date(Math.min(...fits));
    // In the hour the clocks skip: the same moment as the time before the change.
    return new Date(guess - OTP.offset(zone, new Date(guess - 43200000)) * 60000);
  };
  const timeOpts = () => ({ hour: OTP.h12 ? 'numeric' : '2-digit', minute: '2-digit', hour12: OTP.h12 });
  OTP.time = (zone, date) => new Intl.DateTimeFormat(locale, { timeZone: zone, ...timeOpts() }).format(date);
  OTP.clock = (minutes) => {
    // A time of day from minutes after midnight.
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...timeOpts() }).format(new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60), m % 60)));
  };
  // A short label for an hour on the time-zone bars: "06:00" on a 24-hour clock, the hour alone on a
  // 12-hour one ("6 AM", "上午6時", "오전 6시"), so four of them fit side by side on a phone.
  OTP.hourLabel = (minutes) => {
    if (!OTP.h12) return OTP.clock(minutes);
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: 'numeric', hour12: true }).format(new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60), m % 60)));
  };
  // A date in the page's language ("Sunday 28 March 2027", "Sonntag, 28. März 2027").
  OTP.day = (zone, date, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => {
    const s = new Intl.DateTimeFormat(locale, { timeZone: zone, ...opts }).format(date);
    return OTP.english ? s.replace(/^(\w+day),/, '$1') : s;
  };

  // ------------------------------------------------------------------ links, copying, sharing
  OTP.params = () => new URLSearchParams(location.search);
  OTP.setParams = (obj) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) if (v != null && v !== '') p.set(k, v);
    const q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''));
    return location.href;
  };
  OTP.copy = async (text, button) => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.append(t);
      t.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      t.remove();
    }
    if (button) {
      const was = button.dataset.label || button.textContent;
      button.dataset.label = was;
      button.textContent = ok ? OTP.t('copied') : OTP.t('copy_failed');
      clearTimeout(button._t);
      button._t = setTimeout(() => { button.textContent = was; }, 2200);
    }
    return ok;
  };
  OTP.shareButton = (button, get) => {
    if (!navigator.share) { button.hidden = true; return; }
    button.hidden = false;
    button.addEventListener('click', () => {
      const { title, text, url } = get();
      navigator.share({ title, text, url }).catch(() => {});
    });
  };
  // "Send them this" and the line itself.
  OTP.shareLine = (el, text) => {
    el.textContent = '';
    el.append(OTP.el('span', '', OTP.t('send')), text);
  };

  // ------------------------------------------------------------------ the world map
  // Dots for land every degree (from world.js), the route between two places as a glowing arc.
  let world = null;
  const decode = () => {
    if (world || !window.OTP_WORLD) return world;
    const W = window.OTP_WORLD, cols = 360 / W.step, rows = 180 / W.step;
    const g = new Uint16Array(cols * rows);
    W.rows.forEach((r, ri) => {
      let c = 0;
      for (const t of r.split(' ')) {
        const [v, k] = t.split('.');
        const n2 = k ? parseInt(k, 36) : 1;
        g.fill(parseInt(v, 36), ri * cols + c, ri * cols + c + n2);
        c += n2;
      }
    });
    world = { g, cols, rows, step: W.step, countries: W.countries, waters: W.waters };
    return world;
  };
  // What is at a point: {land: true, cc: 'KZ'} or {land: false, water: 'atlantic'}.
  OTP.at = (p) => {
    const w = decode();
    if (!w) return null;
    const r = Math.min(w.rows - 1, Math.max(0, Math.floor((90 - p.lat) / w.step)));
    const c = Math.min(w.cols - 1, Math.max(0, Math.floor((((p.lon + 180) % 360) + 360) % 360 / w.step)));
    const v = w.g[r * w.cols + c];
    const nC = w.countries.length;
    return v <= nC ? { land: true, cc: w.countries[v - 1] } : { land: false, water: w.waters[v - nC - 1] };
  };

  const TOP = 78, BOTTOM = -58; // the map leaves out the poles
  OTP.drawMap = (canvas, { a, b, mid } = {}) => {
    const w = decode();
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(box.width)), H = Math.round(W * (TOP - BOTTOM) / 360);
    canvas.style.height = `${H}px`;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Centre the map on the route when it would otherwise run off one edge.
    let centre = 0;
    if (a && b) {
      const pts = [];
      for (let i = 0; i <= 64; i++) pts.push(OTP.along(a, b, i / 64));
      let jumps = false;
      for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].lon - pts[i - 1].lon) > 180) jumps = true;
      if (jumps) centre = Math.round(OTP.midpoint(a, b).lon / 10) * 10;
    }
    const X = (lon) => ((((lon - centre + 180) % 360) + 360) % 360) / 360 * W;
    const Y = (lat) => (TOP - lat) / (TOP - BOTTOM) * H;
    if (w) {
      const every = W < 500 ? 3 : 2; // a dot per 1.5 or 1 degree
      const r = Math.max(0.7, W / 360 * every * w.step * 0.36);
      ctx.fillStyle = 'rgba(203, 189, 214, 0.42)';
      ctx.beginPath();
      for (let row = 0; row < w.rows; row += every) {
        const lat = 90 - (row + 0.5) * w.step;
        if (lat > TOP || lat < BOTTOM) continue;
        for (let col = 0; col < w.cols; col += every) {
          if (w.g[row * w.cols + col] > w.countries.length) continue;
          const lon = -180 + (col + 0.5) * w.step;
          const x = X(lon), y = Y(lat);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }
    if (!(a && b)) return;
    // The route.
    const steps = 96;
    let prev = null;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(224, 176, 96, 0.8)';
    ctx.shadowBlur = 8;
    for (let i = 0; i <= steps; i++) {
      const p = OTP.along(a, b, i / steps);
      const pt = [X(p.lon), Y(p.lat)];
      if (prev && Math.abs(pt[0] - prev[0]) < W / 2) {
        const f = i / steps;
        ctx.strokeStyle = `rgb(${Math.round(224 + (228 - 224) * f)}, ${Math.round(176 + (134 - 176) * f)}, ${Math.round(96 + (159 - 96) * f)})`;
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(pt[0], pt[1]);
        ctx.stroke();
      }
      prev = pt;
    }
    ctx.shadowBlur = 0;
    const dot = (p, colour, size) => {
      const x = X(p.lon), y = Y(p.lat);
      ctx.fillStyle = colour;
      ctx.shadowColor = colour;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#110a18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    dot(a, '#e0b060', 5);
    dot(b, '#e4869f', 5);
    if (mid) {
      // A small heart at the halfway point.
      const x = X(mid.lon), y = Y(mid.lat), s = 7;
      ctx.fillStyle = '#f7efe9';
      ctx.shadowColor = '#e4869f';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.9);
      ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.4);
      ctx.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Names by the dots, kept inside the map.
    ctx.font = '700 12px "Nunito Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    for (const [p, colour] of [[a, '#e0b060'], [b, '#e4869f']]) {
      if (!p.short) continue;
      const x = X(p.lon), y = Y(p.lat);
      const tw = ctx.measureText(p.short).width;
      let tx = x + 9;
      if (tx + tw > W - 4) tx = x - 9 - tw;
      const ty = Math.min(H - 8, Math.max(8, y - 10));
      ctx.fillStyle = 'rgba(17, 10, 24, 0.75)';
      ctx.fillRect(tx - 4, ty - 8, tw + 8, 16);
      ctx.fillStyle = colour;
      ctx.fillText(p.short, tx, ty);
    }
  };
  // Redraw a map when its width changes.
  OTP.keepMap = (canvas, get) => {
    let last = 0;
    const draw = () => { last = canvas.getBoundingClientRect().width; OTP.drawMap(canvas, get()); };
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (Math.abs(canvas.getBoundingClientRect().width - last) > 1) draw(); }).observe(canvas);
    else addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    return draw;
  };
})();
