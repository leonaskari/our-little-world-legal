// Our Tiny Planet: the "Be the first to know" forms. They post to the waitlist
// edge function of the project named in <body data-waitlist="...">, so the
// page can point at the test project while testing and live when published.
// No third-party scripts: one fetch, nothing stored in the browser.
(() => {
  const ref = document.body.dataset.waitlist;
  const forms = document.querySelectorAll('form.waitlist');
  if (!ref || !forms.length) return;
  const endpoint = `https://${ref}.supabase.co/functions/v1/waitlist`;
  const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

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
        say("That doesn't look like an email address. Could you check it?", 'error');
        input.focus();
        return;
      }
      button.disabled = true;
      say('Sending…', 'busy');
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            source: form.dataset.source || 'site',
            website: form.querySelector('.wl-hp')?.value || '',
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (res.ok && out.status === 'on') {
          say("We'll email you the day it's out.", 'done', "You're already on the list.");
        } else if (res.ok) {
          say("We'll email you the day it's out.", 'done', "You're on the list!");
        } else {
          say(out.error || 'Something went wrong. Please try again in a minute.', 'error');
        }
      } catch {
        say("We couldn't reach our server. Please check your connection and try again.", 'error');
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
