// How far apart are we? Two cities in, the distance along the Earth out.
(() => {
  const $ = (id) => document.getElementById(id);
  const { el, t } = OTP;
  let a = null, b = null, current = null;

  const fa = OTP.cityField($('a'), { onPick: (c) => { a = c; update(); } });
  const fb = OTP.cityField($('b'), { onPick: (c) => { b = c; update(); } });
  const draw = OTP.keepMap($('map'), () => ({ a, b }));
  $('swap').addEventListener('click', () => { [a, b] = [b, a]; fa.set(a); fb.set(b); update(); });

  const flight = (km) => {
    const time = OTP.hm(km / 830 + 0.5); // cruising speed, plus take-off and landing
    if (km < 300) return [t('d_fly_short_title'), t('d_fly_short', { time })];
    if (km > 15500) return [t('d_fly_long_title', { time }), t('d_fly_long')];
    return [t('d_fly_title', { time }), t('d_fly')];
  };

  function update() {
    const result = $('result'), empty = $('empty');
    draw();
    if (!(a && b) || a.id === b.id) {
      result.hidden = true;
      empty.hidden = false;
      empty.textContent = a && b ? t('same_city') : $('empty').dataset.text;
      if (!(a && b)) {
        $('map-caption').textContent = $('map-caption').dataset.text;
        OTP.setParams({ a: a && a.id, b: b && b.id });
      }
      return;
    }
    empty.hidden = true;
    result.hidden = false;
    const km = OTP.km(a, b);
    const parts = OTP.distParts(km);
    const big = $('big');
    big.textContent = `${parts.number} `;
    big.append(el('small', '', parts.unit));
    $('sub').textContent = t('d_sub', { other: OTP.milesFirst ? OTP.kmText(km) : OTP.mi(km), a: a.name, b: b.name });

    const facts = $('facts');
    facts.textContent = '';
    const fact = (title, body) => {
      const li = el('li');
      li.append(el('b', '', title), body);
      facts.append(li);
    };
    const [ft, fs] = flight(km);
    fact(ft, fs);
    // The time difference right now.
    const now = new Date();
    const diff = OTP.offset(b.zone, now) - OTP.offset(a.zone, now);
    if (diff === 0) fact(t('d_same_time_title'), t('d_same_time', { a: a.name, b: b.name }));
    else {
      const body = el('span');
      body.append(`${t(diff > 0 ? 'd_ahead' : 'd_behind', { a: a.name, b: b.name })} `);
      const go = el('a', '', t('d_plan'));
      go.href = `time-zones.html?a=${a.id}&b=${b.id}`;
      body.append(go);
      fact(t(diff > 0 ? 'd_ahead_title' : 'd_behind_title', { gap: OTP.gap(diff) }), body);
    }
    const days = km / 40; // 5 km an hour, 8 hours a day
    if (days < 1) fact(t('d_walk_title_time', { time: OTP.hm(km / 5) }), t('d_walk_short'));
    else fact(OTP.tp('d_walk_title_days', Math.round(days)), t('d_walk'));

    const first = OTP.milesFirst ? OTP.mi(km) : OTP.kmText(km), second = OTP.milesFirst ? OTP.kmText(km) : OTP.mi(km);
    const line = t('d_line', { a: a.name, b: b.name, first, second });
    OTP.shareLine($('line'), line);
    $('to-halfway').href = `halfway.html?a=${a.id}&b=${b.id}`;
    $('map-caption').textContent = t('d_caption', { a: a.name, b: b.name });
    const url = OTP.setParams({ a: a.id, b: b.id });
    current = { title: t('d_share_title'), text: `${line} ${t('d_share_more')}`, url };
  }

  $('copy').addEventListener('click', () => OTP.copy(current ? current.url : location.href, $('copy').querySelector('span')));
  OTP.shareButton($('share'), () => current);

  const p = OTP.params();
  a = OTP.city(p.get('a'));
  b = OTP.city(p.get('b'));
  if (a) fa.set(a);
  if (b) fb.set(b);
  update();
})();
