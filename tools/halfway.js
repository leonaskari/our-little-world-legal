// Find your halfway point: the midpoint on the globe, what is there, and the fairest city to meet.
(() => {
  const $ = (id) => document.getElementById(id);
  const { el, t } = OTP;
  let a = null, b = null, mid = null, current = null;

  const fa = OTP.cityField($('a'), { onPick: (c) => { a = c; update(); } });
  const fb = OTP.cityField($('b'), { onPick: (c) => { b = c; update(); } });
  const draw = OTP.keepMap($('map'), () => ({ a, b, mid }));
  $('swap').addEventListener('click', () => { [a, b] = [b, a]; fa.set(a); fb.set(b); update(); });

  function place(list, items) {
    list.textContent = '';
    items.forEach(([name, detail, best]) => {
      const li = el('li', best ? 'best' : '');
      li.append(el('b', '', name), el('span', '', detail));
      list.append(li);
    });
  }
  const label = (c) => t('city_label', { city: c.name, country: c.country });

  function update() {
    const result = $('result'), empty = $('empty');
    mid = null;
    if (!(a && b) || a.id === b.id) {
      result.hidden = true;
      empty.hidden = false;
      empty.textContent = a && b ? t('same_city') : empty.dataset.text;
      if (!(a && b)) OTP.setParams({ a: a && a.id, b: b && b.id });
      $('map-caption').textContent = $('map-caption').dataset.text;
      draw();
      return;
    }
    empty.hidden = true;
    result.hidden = false;
    const total = OTP.km(a, b), half = total / 2;
    const url = OTP.setParams({ a: a.id, b: b.id });
    const d = OTP.dist(half);
    let share;

    if (total > 19800) {
      // Nearly opposite sides of the world: every way round is about as long.
      $('headline').textContent = t('h_opposite');
      $('where').textContent = t('h_opposite_where', { a: a.name, b: b.name, d });
      $('near-title').hidden = true;
      $('near').textContent = '';
      share = t('h_opposite_share');
    } else {
      mid = OTP.midpoint(a, b);
      const here = OTP.at(mid) || { land: true, cc: '' };
      const near = OTP.cities.map((c) => [OTP.km(mid, c), c]).sort((x, y) => x[0] - y[0]).slice(0, 3);
      const [nd, nc] = near[0];
      let headline;
      if (!here.land) {
        const water = OTP.water(here.water, mid);
        if (nd < 150) {
          headline = t('h_coast', { water });
          share = t('h_coast_share', { city: nc.name, d });
        } else {
          headline = t('h_sea', { water });
          share = t('h_sea_share', { water, d });
        }
      } else if (nd < 60) {
        headline = t('h_land_near', { in: OTP.countryIn(here.cc), city: nc.name });
        share = t('h_land_near_share', { city: label(nc), d });
      } else {
        headline = t('h_land', { in: OTP.countryIn(here.cc) });
        share = t('h_land_share', { in: OTP.countryIn(here.cc), d });
      }
      $('headline').textContent = headline;
      $('where').textContent = t('h_where', { d: OTP.distBoth(half), coord: OTP.coord(mid) });
      if (nd >= 60) $('where').append(` ${t('h_nearest', { city: label(nc), d: OTP.dist(nd) })}`);
      $('near-title').hidden = false;
      place($('near'), near.map(([dd, c]) => [label(c), t('h_from_mid', { d: OTP.dist(dd) })]));
    }

    // The fairest city: the shortest longer journey. Big airport cities for long distances.
    const pool = total > 1500 ? OTP.cities.filter((c) => c.hub) : OTP.cities;
    const ranked = pool.map((c) => {
      const da = OTP.km(a, c), db = OTP.km(b, c);
      return { c, da, db, worst: Math.max(da, db), sum: da + db };
    }).sort((x, y) => x.worst - y.worst || x.sum - y.sum).slice(0, 3);
    $('fair-why').textContent = t(total > 1500 ? 'h_fair_hubs' : 'h_fair_all');
    place($('fair'), ranked.map((r, i) => [
      label(r.c),
      t('h_fair_detail', { da: OTP.dist(r.da), a: a.name, db: OTP.dist(r.db), b: b.name }),
      i === 0,
    ]));
    const text = `${share} ${t('h_fair_share', { city: ranked[0].c.name })}`;
    OTP.shareLine($('line'), text);
    current = { title: t('h_share_title'), text, url };
    $('map-caption').textContent = mid ? t('h_caption', { a: a.name, b: b.name }) : t('h_caption_opposite', { a: a.name, b: b.name });
    draw();
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
