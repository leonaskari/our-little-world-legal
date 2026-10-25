// Our Tiny Planet: the home page's movement. Everything here is extra: the page
// reads complete without it.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ the sky
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, stars = [], shooting = null, mx = 0, my = 0, scrollY = 0;
  const colours = ['#ffffff', '#fff4dd', '#dfe6ff', '#ffe2ec'];
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    const n = Math.round((innerWidth * innerHeight) / 5200);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() ** 2 * 1.6 + 0.35) * dpr,
      depth: Math.random() * 0.8 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.8,
      c: colours[(Math.random() * colours.length) | 0],
    }));
  }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      // Nearer stars drift more as you scroll and move the mouse.
      const x = (s.x + mx * 14 * s.depth * dpr) % w;
      const y = ((s.y - scrollY * 0.08 * s.depth * dpr) % h + h) % h;
      const a = still ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.speed + s.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.5 * dpr && a > 0.85) {
        ctx.globalAlpha = (a - 0.85) * 3;
        ctx.fillRect(x - s.r * 3, y - 0.4 * dpr, s.r * 6, 0.8 * dpr);
        ctx.fillRect(x - 0.4 * dpr, y - s.r * 3, 0.8 * dpr, s.r * 6);
      }
    }
    // Now and then, a shooting star.
    if (!still) {
      if (!shooting && Math.random() < 0.004) {
        shooting = { x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.4, life: 0 };
      }
      if (shooting) {
        shooting.life += 1;
        const p = shooting.life / 50;
        const x = shooting.x - p * 360 * dpr, y = shooting.y + p * 200 * dpr;
        const g = ctx.createLinearGradient(x, y, x + 120 * dpr, y - 66 * dpr);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = Math.sin(p * Math.PI);
        ctx.strokeStyle = g;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 120 * dpr, y - 66 * dpr);
        ctx.stroke();
        if (p >= 1) shooting = null;
      }
    }
    ctx.globalAlpha = 1;
    if (!still) requestAnimationFrame(draw);
  }
  size();
  addEventListener('resize', size);
  requestAnimationFrame(draw);

  // ------------------------------------------------------------ the top bar, the mouse
  const top = document.querySelector('.top');
  const timeline = document.querySelector('.timeline');
  addEventListener('scroll', () => {
    scrollY = window.scrollY;
    top.classList.toggle('scrolled', scrollY > 20);
    if (timeline) {
      const r = timeline.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (innerHeight * 0.65 - r.top) / r.height));
      timeline.style.setProperty('--fill', f.toFixed(3));
    }
  }, { passive: true });
  const mid = document.querySelector('.p-mid');
  addEventListener('pointermove', (e) => {
    mx = e.clientX / innerWidth - 0.5;
    my = e.clientY / innerHeight - 0.5;
    if (!still && mid) {
      document.querySelectorAll('.phones .phone').forEach((p) => {
        p.style.setProperty('--ry', `${(mx * 14).toFixed(2)}deg`);
        p.style.setProperty('--rx', `${(-my * 10).toFixed(2)}deg`);
      });
    }
  }, { passive: true });

  // ------------------------------------------------------------ things coming into view
  const counted = new WeakSet();
  function count(el) {
    if (counted.has(el)) return;
    counted.add(el);
    const end = Number(el.dataset.count), plus = el.hasAttribute('data-plus');
    if (still) return;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1600);
      const v = Math.round(end * (1 - Math.pow(1 - p, 3)));
      el.textContent = v.toLocaleString('en-GB') + (plus && p === 1 ? '+' : '');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      e.target.querySelectorAll?.('[data-count]').forEach(count);
      if (e.target.matches('[data-count]')) count(e.target);
      seen.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal, .phones').forEach((el) => seen.observe(el));

  // ------------------------------------------------------------ the tour: the phone follows the story
  const shots = document.querySelectorAll('.tour-phone img');
  const stories = document.querySelectorAll('.story');
  const show = (name) => shots.forEach((img) => img.classList.toggle('on', img.dataset.shot === name));
  const reading = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      stories.forEach((s) => s.classList.toggle('active', s === e.target));
      show(e.target.dataset.shot);
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  stories.forEach((s) => reading.observe(s));

  // ------------------------------------------------------------ the lands
  document.querySelectorAll('.carousel-nav button').forEach((b) =>
    b.addEventListener('click', () => {
      const carousel = b.closest('section').querySelector('.carousel');
      const step = carousel.querySelector('figure').getBoundingClientRect().width + 18;
      carousel.scrollBy({ left: step * Number(b.dataset.dir), behavior: still ? 'auto' : 'smooth' });
    }));

  // ------------------------------------------------------------ hearts rising at the end
  const rise = document.querySelector('.rise');
  if (rise && !still) {
    let on = false;
    new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(rise);
    setInterval(() => {
      if (!on) return;
      const i = document.createElement('i');
      i.textContent = Math.random() < 0.8 ? '♥' : '✦';
      i.style.left = `${Math.random() * 100}%`;
      i.style.fontSize = `${12 + Math.random() * 18}px`;
      i.style.animationDuration = `${5 + Math.random() * 4}s`;
      if (i.textContent === '✦') i.style.color = '#e0b060';
      rise.appendChild(i);
      setTimeout(() => i.remove(), 9500);
    }, 420);
  }
})();
