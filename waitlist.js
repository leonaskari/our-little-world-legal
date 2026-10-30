// Our Tiny Planet: the "Be the first to know" forms. They post to the waitlist
// edge function of the project named in <body data-waitlist="...">, so the
// page can point at the test project while testing and live when published.
// No third-party scripts: one fetch, nothing stored in the browser.
//
// Languages: the messages below are the English ones. A translated page gives
// its own in <script type="application/json" id="wl-text">{...}</script>
// (same keys), and its language in <html data-lang="..."> (the app's tag:
// "de", "es-419", "pt-BR", "zh-Hans"...), which goes with the signup so the
// welcome email comes in that language.
(() => {
  const ref = document.body.dataset.waitlist;
  const forms = document.querySelectorAll('form.waitlist');
  if (!ref || !forms.length) return;
  const endpoint = `https://${ref}.supabase.co/functions/v1/waitlist`;
  const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const lang = document.documentElement.dataset.lang || 'en';
  const english = lang === 'en';
  const t = {
    invalid: "That doesn't look like an email address. Could you check it?",
    sending: 'Sending…',
    already_lead: "You're already on the list.",
    already: "We'll email you the day it's out.",
    added_lead: "You're on the list!",
    added: "We'll email you the day it's out.",
    later: "That's a lot of tries. Please wait a little while and try again.",
    error: 'Something went wrong. Please try again in a minute.',
    offline: "We couldn't reach our server. Please check your connection and try again.",
  };
  try {
    const own = document.getElementById('wl-text');
    if (own) Object.assign(t, JSON.parse(own.textContent));
  } catch { /* keep English */ }

  forms.forEach((form) => {
    const input = form.querySelector('input[type=email]');
    const button = form.querySelector('button');
    const msg = form.querySelector('.wl-msg');
    // A message, with an optional bold first part.
    const say = (text, kind, lead = '') => {
      msg.textContent = '';
      if (lead) msg.append(Object.assign(document.createElement('strong'), { textContent: lead }), ' ');
      msg.append(text);
      form.dataset.state = kind;
      input.setAttribute('aria-invalid', kind === 'error' ? 'true' : 'false');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!looksLikeEmail(email)) {
        say(t.invalid, 'error');
        input.focus();
        return;
      }
      button.disabled = true;
      say(t.sending, 'busy');
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            source: form.dataset.source || 'site',
            website: form.querySelector('.wl-hp')?.value || '',
            lang,
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (res.ok && out.status === 'on') {
          say(t.already, 'done', t.already_lead);
        } else if (res.ok) {
          say(t.added, 'done', t.added_lead);
        } else if (english && out.error) {
          // The server's own words are English: only English pages show them.
          say(out.error, 'error');
        } else if (res.status === 400) {
          say(t.invalid, 'error');
        } else if (res.status === 429) {
          say(t.later, 'error');
        } else {
          say(t.error, 'error');
        }
      } catch {
        say(t.offline, 'error');
      } finally {
        button.disabled = false;
      }
    });
    input.addEventListener('input', () => {
      if (form.dataset.state === 'error') say('', '');
    });
  });

  // The "Coming soon" badges lead to their form and put the cursor in it.
  document.querySelectorAll('a.badge[href^="#waitlist"]').forEach((a) =>
    a.addEventListener('click', () => {
      const input = document.querySelector(`${a.getAttribute('href')} input[type=email]`);
      if (input) setTimeout(() => input.focus({ preventScroll: true }), 450);
    }));
})();
