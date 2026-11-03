// Countdown until I see you: a date, a time and a city in; days, hours, minutes and seconds out.
(() => {
  const $ = (id) => document.getElementById(id);
  const { el, t } = OTP;
  let city = null, target = null, current = null, timer = 0;
  const viewerZone = OTP.homeZone || 'UTC';
  const baseTitle = t('c_share_title');

  const fc = OTP.cityField($('c'), { onPick: (c) => { city = c; update(); } });
  ['when-date', 'when-time'].forEach((id) => $(id).addEventListener('change', update));
  ['name-a', 'name-b'].forEach((id) => $(id).addEventListener('input', () => { clearTimeout($(id)._t); $(id)._t = setTimeout(update, 300); }));

  const clean = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
  const names = () => [clean($('name-a').value), clean($('name-b').value)];
  const pair = () => {
    const n = names().filter(Boolean);
    return n.length ? OTP.list(n) : '';
  };

  // Calendar days between two wall-clock dates.
  const days = (from, to) => Math.round((Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d)) / 86400000);

  function render() {
    if (!target) return;
    const left = target.getTime() - Date.now();
    const done = left <= 0;
    $('count').hidden = done;
    $('together').hidden = !done;
    if (done) {
      clearInterval(timer);
      document.title = t('c_doc_done', { title: baseTitle });
      return;
    }
    const s = Math.floor(left / 1000);
    const parts = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
    ['d', 'h', 'm', 's'].forEach((k, i) => {
      const n = parts[i];
      $(`cd-${k}`).textContent = k === 'd' ? OTP.num(n) : String(n).padStart(2, '0');
      $(`cd-${k}l`).textContent = OTP.tp(`c_unit_${k}`, n);
    });
    document.title = OTP.tp('c_doc_title', parts[0], { title: baseTitle });
  }

  function update() {
    const result = $('result'), empty = $('empty');
    clearInterval(timer);
    const v = $('when-date').value;
    const [y, m, d] = (v || '').split('-').map(Number);
    if (!y || !m || !d || !city) {
      target = null;
      result.hidden = true;
      empty.hidden = false;
      empty.textContent = t(city ? 'c_empty_date' : 'c_empty_city');
      return;
    }
    const tm = /^(\d{1,2}):(\d{2})/.exec($('when-time').value || '') || [0, 12, 0];
    target = OTP.instant(city.zone, y, m, d, +tm[1] % 24, +tm[2]);
    empty.hidden = true;
    result.hidden = false;
    const future = target.getTime() > Date.now();

    const who = pair();
    $('headline').textContent = future
      ? (who ? t('c_head_names', { names: who }) : t('c_head'))
      : (who ? t('c_done_names', { names: who }) : t('c_done'));

    // When, in their city and here.
    const when = $('when');
    when.textContent = '';
    const fmt = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    when.append(el('strong', '', t('c_when', { date: OTP.day(city.zone, target, fmt), time: OTP.time(city.zone, target), city: city.name })));
    if (OTP.offset(viewerZone, target) !== OTP.offset(city.zone, target)) {
      when.append(' ', t('c_here', { time: OTP.time(viewerZone, target), date: OTP.day(viewerZone, target, { weekday: 'long', day: 'numeric', month: 'long' }) }));
    }
    const sleeps = days(OTP.wall(viewerZone, new Date()), OTP.wall(viewerZone, target));
    if (future) when.append(' ', sleeps > 0 ? OTP.tp('c_sleeps', sleeps) : t('c_today'));
    else when.append(' ', t('c_past'));

    // The link and the line to send.
    const [na, nb] = names();
    const url = OTP.setParams({ d: `${v}T${String(+tm[1] % 24).padStart(2, '0')}:${tm[2]}`, in: city.id, a: na, b: nb });
    const left = Math.max(0, days(OTP.wall(city.zone, new Date()), OTP.wall(city.zone, target)));
    const date = OTP.day(city.zone, target, { weekday: 'long', day: 'numeric', month: 'long' });
    let text = !future ? t('c_share_done') : left ? OTP.tp('c_share', left, { date }) : t('c_share_today');
    if (who) text = t('c_share_names', { names: who, text });
    OTP.shareLine($('line'), text);
    current = { title: baseTitle, text, url };

    render();
    timer = setInterval(render, 1000);
  }

  // ------------------------------------------------------------------ the calendar file
  const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  // Lines longer than 75 bytes are folded, as the calendar format asks.
  const enc = new TextEncoder();
  const fold = (line) => {
    const out = [];
    let cur = '', bytes = 0;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch;
      bytes += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  };
  $('ics').addEventListener('click', () => {
    if (!target) return;
    const who = pair();
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Our Tiny Planet//Countdown//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@ourtinyplanet.com`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(target)}`,
      `DTEND:${icsDate(new Date(target.getTime() + 3600000))}`,
      `SUMMARY:${icsText(who ? t('c_ics_summary_names', { names: who }) : t('c_ics_summary'))}`,
      `LOCATION:${icsText(t('city_label', { city: city.name, country: city.country }))}`,
      `DESCRIPTION:${icsText(t('c_ics_desc', { url: current ? current.url : location.href }))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', `DESCRIPTION:${icsText(t('c_ics_alarm'))}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ];
    const blob = new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = t('c_ics_file');
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  });

  $('copy').addEventListener('click', () => OTP.copy(current ? current.url : location.href, $('copy').querySelector('span')));
  OTP.shareButton($('share'), () => current);

  // ------------------------------------------------------------------ start
  const p = OTP.params();
  const dm = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(p.get('d') || '');
  if (dm) {
    $('when-date').value = dm[1];
    if (dm[2]) $('when-time').value = dm[2];
  }
  city = OTP.city(p.get('in')) || OTP.cityForZone(viewerZone);
  if (city) fc.set(city);
  $('name-a').value = clean(p.get('a'));
  $('name-b').value = clean(p.get('b'));
  // The earliest day you can choose is today.
  const w = OTP.wall(viewerZone, new Date());
  $('when-date').min = `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
  update();
})();
