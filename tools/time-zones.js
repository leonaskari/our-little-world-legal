// When are we both awake? Two cities, two sets of waking hours, one day lined up in real time.
(() => {
  const $ = (id) => document.getElementById(id);
  const { el, t } = OTP;
  const SLOT = 15; // minutes
  const SLOTS = 24 * 60 / SLOT;
  let a = null, b = null, current = null;

  const fa = OTP.cityField($('a'), { onPick: (c) => { a = c; if (!dateTouched) setToday(); update(); } });
  const fb = OTP.cityField($('b'), { onPick: (c) => { b = c; update(); } });
  $('swap').addEventListener('click', () => {
    [a, b] = [b, a];
    fa.set(a); fb.set(b);
    const [u, d] = [$('a-up').value, $('a-down').value];
    $('a-up').value = $('b-up').value; $('a-down').value = $('b-down').value;
    $('b-up').value = u; $('b-down').value = d;
    update();
  });

  // ------------------------------------------------------------------ inputs
  const mins = (v, fallback) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(v || '');
    return m ? (+m[1] % 24) * 60 + +m[2] : fallback;
  };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;
  const fromHhmm = (s) => (/^\d{4}$/.test(s || '') ? (+s.slice(0, 2) % 24) * 60 + (+s.slice(2) % 60) : null);
  let dateTouched = false;
  const setToday = () => {
    const w = OTP.wall(a ? a.zone : (OTP.homeZone || 'UTC'), new Date());
    $('date').value = `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
  };
  ['a-up', 'a-down', 'b-up', 'b-down', 'conv-a', 'conv-b'].forEach((id) => $(id).addEventListener('change', update));
  $('date').addEventListener('change', () => { dateTouched = true; update(); });

  const inWin = (m, [s, e]) => (s === e ? true : s < e ? m >= s && m < e : m >= s || m < e);
  const minutesOf = (w) => w.h * 60 + w.mi;

  // ------------------------------------------------------------------ the day, slot by slot
  // Both clocks for every quarter hour of your day (worked out once per day and pair).
  let cache = { key: '', base: [] };
  function base() {
    const key = `${a.zone}|${b.zone}|${$('date').value}`;
    if (cache.key === key) return cache.base;
    const [y, m, d] = ($('date').value || '').split('-').map(Number);
    const start = OTP.instant(a.zone, y, m, d, 0, 0);
    const out = [];
    for (let i = 0; i < SLOTS; i++) {
      const tt = new Date(start.getTime() + i * SLOT * 60000);
      const wa = OTP.wall(a.zone, tt), wb = OTP.wall(b.zone, tt);
      out.push({ t: tt, wa, wb, ma: minutesOf(wa), mb: minutesOf(wb) });
    }
    cache = { key, base: out };
    return out;
  }
  const day = (aw, bw) => base().map((x) => ({ ...x, A: inWin(x.ma, aw), B: inWin(x.mb, bw) }));
  const runs = (slots, test) => {
    const out = [];
    let s = -1;
    slots.forEach((x, i) => {
      if (test(x) && s < 0) s = i;
      if ((!test(x) || i === slots.length - 1) && s >= 0) { out.push([s, test(x) ? i + 1 : i]); s = -1; }
    });
    return out;
  };

  // How good a time of day is for a call (0 = the middle of a working day), and what to call it.
  const comfort = (m) => (m >= 1080 && m < 1320 ? 3 : (m >= 420 && m < 540) || (m >= 720 && m < 840) ? 2 : m >= 540 && m < 1020 ? 0 : 1);
  const partOfDay = (m) => (m >= 1080 && m < 1320 ? 'evening' : m >= 420 && m < 540 ? 'early_morning' : m >= 720 && m < 840 ? 'lunch' : m >= 540 && m < 1020 ? 'work' : m < 420 ? 'early' : 'late');

  // " the next day" / " the day before" between two wall clocks.
  const dayWord = (from, to) => {
    const f = Date.UTC(from.y, from.m - 1, from.d), tt = Date.UTC(to.y, to.m - 1, to.d);
    return tt > f ? t('next_day') : tt < f ? t('day_before') : '';
  };

  // ------------------------------------------------------------------ bars
  function bar(label, place, slots, mine, both, ticksOf) {
    const row = el('div', 'bar-row');
    const who = el('p', 'who');
    who.append(el('b', '', label), el('span', '', place));
    const track = el('div', 'bar');
    track.setAttribute('aria-hidden', 'true');
    const seg = (cls, [s, e]) => {
      const i = el('i', cls);
      i.style.left = `${(s / SLOTS) * 100}%`;
      i.style.width = `${((e - s) / SLOTS) * 100}%`;
      track.append(i);
    };
    runs(slots, mine).forEach((r) => seg('awake', r));
    runs(slots, both).forEach((r) => seg('both', r));
    const now = Date.now(), t0 = slots[0].t.getTime();
    if (now >= t0 && now < t0 + SLOTS * SLOT * 60000) {
      const i = el('i', 'now');
      i.style.left = `${((now - t0) / (SLOTS * SLOT * 60000)) * 100}%`;
      track.append(i);
    }
    const ticks = el('div', 'ticks');
    ticks.setAttribute('aria-hidden', 'true');
    ticksOf(slots).forEach(([pos, text]) => {
      const s = el('span', '', text);
      s.style.left = `${pos * 100}%`;
      s.style.transform = pos < 0.04 ? 'none' : pos > 0.96 ? 'translateX(-100%)' : 'translateX(-50%)';
      ticks.append(s);
    });
    row.append(who, track, ticks);
    return row;
  }
  // Labels every six hours of a person's own clock, wherever those fall on the shared day.
  const ticksFor = (key) => (slots) => {
    const out = [];
    slots.forEach((x, i) => {
      const m = x[key];
      if (m % 360 < SLOT) out.push([(i - (m % 360) / SLOT) / SLOTS, OTP.hourLabel(m - (m % 360))]);
    });
    if (key === 'ma') out.push([1, OTP.hourLabel(0)]);
    return out.filter(([p]) => p >= 0 && p <= 1);
  };

  // ------------------------------------------------------------------ the next change in the gap
  function nextChange(from) {
    const gapAt = (tt) => OTP.offset(b.zone, tt) - OTP.offset(a.zone, tt);
    const g0 = gapAt(from);
    let lo = from.getTime();
    for (let k = 1; k <= 400; k++) {
      const hi = from.getTime() + k * 86400000;
      if (gapAt(new Date(hi)) !== g0) {
        let l = lo, h = hi;
        while (h - l > 60000) { const m = Math.floor((l + h) / 2); if (gapAt(new Date(m)) === g0) l = m; else h = m; }
        const tt = new Date(h);
        const before = new Date(h - 3 * 3600000);
        const who = OTP.offset(a.zone, tt) !== OTP.offset(a.zone, before) ? a : b;
        const forward = OTP.offset(who.zone, tt) > OTP.offset(who.zone, before);
        return { t: tt, gap: gapAt(tt), who, forward };
      }
      lo = hi;
    }
    return null;
  }
  const gapWords = (g) => (g === 0 ? t('t_gap_same', { a: a.name, b: b.name }) : t(g > 0 ? 't_gap_ahead' : 't_gap_behind', { a: a.name, b: b.name, gap: OTP.gap(g) }));

  // ------------------------------------------------------------------ update
  let timer = 0;
  function update() {
    const result = $('result'), empty = $('empty');
    clearInterval(timer);
    if (!(a && b)) {
      result.hidden = true;
      empty.hidden = false;
      OTP.setParams({ a: a && a.id, b: b && b.id });
      return;
    }
    empty.hidden = true;
    result.hidden = false;
    if (!$('date').value) setToday();
    const aw = [mins($('a-up').value, 480), mins($('a-down').value, 1380)];
    const bw = [mins($('b-up').value, 480), mins($('b-down').value, 1380)];
    const slots = day(aw, bw);
    const both = runs(slots, (x) => x.A && x.B);
    const total = both.reduce((n, [s, e]) => n + (e - s) * SLOT, 0);
    const youThem = (r) => {
      const s = slots[r[0]], last = slots[r[1] - 1];
      return t('t_run', { a1: OTP.clock(s.ma), a2: OTP.clock(last.ma + SLOT), b1: OTP.clock(s.mb), b2: OTP.clock(last.mb + SLOT) });
    };
    const runsText = both.map(youThem).join(t('t_join'));

    // The headline.
    const h = $('headline');
    if (a.zone === b.zone || slots.every((x) => x.ma === x.mb)) h.textContent = total ? t('t_same_clock', { gap: OTP.gap(total) }) : t('t_same_clock_none');
    else if (total >= 23 * 60) h.textContent = t('t_all_day');
    else if (total) h.textContent = t('t_overlap', { gap: OTP.gap(total), runs: runsText });
    else h.textContent = t('t_none');

    const tick = () => {
      const now = new Date();
      $('now').textContent = t('t_now', {
        ta: OTP.time(a.zone, now), da: OTP.day(a.zone, now, { weekday: 'long' }), a: a.name,
        tb: OTP.time(b.zone, now), db: OTP.day(b.zone, now, { weekday: 'long' }), b: b.name,
        gap: gapWords(OTP.offset(b.zone, now) - OTP.offset(a.zone, now)),
      });
    };
    tick();
    timer = setInterval(tick, 30000);

    // The bars.
    const bars = $('bars');
    bars.textContent = '';
    bars.append(
      bar(t('t_you'), a.name, slots, (x) => x.A, (x) => x.A && x.B, ticksFor('ma')),
      bar(t('t_them'), b.name, slots, (x) => x.B, (x) => x.A && x.B, ticksFor('mb')),
    );
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', total ? t('t_aria', { a: a.name, b: b.name, runs: runsText }) : t('t_aria_none', { a: a.name, b: b.name }));

    // The best time to call: the best hour (or the whole overlap if it is shorter) inside the overlap.
    const best = $('best');
    best.textContent = '';
    let bestText = '';
    if (total) {
      let top = null;
      for (const [s, e] of both) {
        const len = Math.min(4, e - s);
        for (let i = s; i + len <= e; i++) {
          let score = 0;
          for (let j = i; j < i + len; j++) score += comfort(slots[j].ma) + comfort(slots[j].mb);
          score = score / len + len * 0.01;
          if (!top || score > top.score) top = { i, len, score };
        }
      }
      const s = slots[top.i];
      bestText = t('t_best', { ta: OTP.clock(s.ma), tb: OTP.clock(s.mb), day: dayWord(s.wa, s.wb) });
      const la = t(`t_tod_${partOfDay(s.ma)}`), lb = t(`t_tod_${partOfDay(s.mb)}`);
      best.append(el('strong', '', bestText), t('t_best_sep'), top.len < 4 ? t('t_reason_short', { la, lb, gap: OTP.gap(top.len * SLOT) }) : t('t_reason', { la, lb }));
      if (partOfDay(s.ma) === 'work' || partOfDay(s.mb) === 'work') best.append(' ', t('t_work'));
    } else {
      // How far one of you would have to move to share half an hour.
      let tip = '';
      for (let k = 1; k <= 48 && !tip; k++) {
        const d = k * SLOT;
        const opts = [
          ['t_try_you_late', [aw[0], (aw[1] + d) % 1440], bw],
          ['t_try_them_late', aw, [bw[0], (bw[1] + d) % 1440]],
          ['t_try_you_early', [(aw[0] - d + 1440) % 1440, aw[1]], bw],
          ['t_try_them_early', aw, [(bw[0] - d + 1440) % 1440, bw[1]]],
        ];
        for (const [key, aw2, bw2] of opts) {
          if (base().filter((x) => inWin(x.ma, aw2) && inWin(x.mb, bw2)).length * SLOT >= 30) { tip = t(key, { d: OTP.gap(d) }); break; }
        }
      }
      best.textContent = tip ? `${t('t_no_best')} ${tip}` : t('t_no_best');
    }

    // The converter.
    const [y, m, d] = $('date').value.split('-').map(Number);
    const convert = (from, to, input, out) => {
      const mm = mins(input.value, 1260);
      let tt;
      if (from === a) tt = OTP.instant(a.zone, y, m, d, Math.floor(mm / 60), mm % 60);
      else {
        // Their time on the day that overlaps yours the most.
        const noon = OTP.instant(a.zone, y, m, d, 12, 0);
        const wb = OTP.wall(b.zone, noon);
        tt = OTP.instant(b.zone, wb.y, wb.m, wb.d, Math.floor(mm / 60), mm % 60);
      }
      out.value = t(to === a ? 't_conv_you' : 't_conv_them', { time: OTP.time(to.zone, tt), day: dayWord(OTP.wall(from.zone, tt), OTP.wall(to.zone, tt)), city: to.name });
    };
    $('conv-a-who').textContent = t('t_conv_who_you', { city: a.name });
    $('conv-b-who').textContent = t('t_conv_who_them', { city: b.name });
    convert(a, b, $('conv-a'), $('conv-a-out'));
    convert(b, a, $('conv-b'), $('conv-b-out'));

    // The next time the gap changes.
    const ch = nextChange(OTP.instant(a.zone, y, m, d, 0, 0));
    $('change').textContent = ch
      ? t(ch.forward ? 't_change_forward' : 't_change_back', { date: OTP.day(ch.who.zone, ch.t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), city: ch.who.name, gap: gapWords(ch.gap) })
      : t('t_steady', { gap: gapWords(OTP.offset(b.zone, slots[0].t) - OTP.offset(a.zone, slots[0].t)) });

    // Share.
    const params = { a: a.id, b: b.id };
    if (aw[0] !== 480 || aw[1] !== 1380) params.aw = `${hhmm(aw[0])}-${hhmm(aw[1])}`;
    if (bw[0] !== 480 || bw[1] !== 1380) params.bw = `${hhmm(bw[0])}-${hhmm(bw[1])}`;
    const url = OTP.setParams(params);
    const text = total ? t('t_share', { a: a.name, b: b.name, gap: OTP.gap(total), best: bestText }) : t('t_share_none', { a: a.name, b: b.name });
    OTP.shareLine($('line'), text);
    current = { title: t('t_share_title'), text, url };
  }

  $('copy').addEventListener('click', () => OTP.copy(current ? current.url : location.href, $('copy').querySelector('span')));
  OTP.shareButton($('share'), () => current);

  // ------------------------------------------------------------------ start
  const p = OTP.params();
  a = OTP.city(p.get('a'));
  b = OTP.city(p.get('b'));
  for (const [key, up, down] of [['aw', 'a-up', 'a-down'], ['bw', 'b-up', 'b-down']]) {
    const [s, e] = (p.get(key) || '').split('-').map(fromHhmm);
    if (s != null && e != null) {
      $(up).value = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      $(down).value = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
    }
  }
  // Without a link, start from the city for this browser's own time zone.
  if (!a && !p.get('a')) a = OTP.cityForZone(OTP.homeZone);
  if (a) fa.set(a);
  if (b) fb.set(b);
  setToday();
  update();
})();
