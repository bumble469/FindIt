(function () {
  const form = document.getElementById('signup-form');
  if (!form) return;

  if (isLoggedIn()) { goAfterAuth(); return; }

  /* ---------------- show/hide password ---------------- */
  document.querySelectorAll('[data-toggle-password]').forEach((toggle) => {
    const input = toggle.parentElement.querySelector('input');
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.classList.toggle('is-on', show);
      toggle.setAttribute('aria-pressed', show);
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  /* ---------------- validation ---------------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const fields = {
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    confirm: document.getElementById('confirm'),
  };

  const rules = {
    name(value) {
      const v = value.trim();
      if (!v) return 'Please enter your full name.';
      if (v.length < 2) return 'Name must be at least 2 characters.';
      return '';
    },
    email(value) {
      const v = value.trim();
      if (!v) return 'Please enter your email.';
      if (!EMAIL_RE.test(v)) return 'Enter a valid email, like you@example.com.';
      return '';
    },
    password(value) {
      if (!value) return 'Please choose a password.';
      if (value.length < 8) return 'Use at least 8 characters.';
      return '';
    },
    confirm(value) {
      if (!value) return 'Please repeat your password.';
      if (value !== fields.password.value) return 'Passwords do not match.';
      return '';
    },
  };

  const touched = new Set();   

  function setError(input, message) {
    const errorEl = document.getElementById(input.id + '-error');
    errorEl.textContent = message;
    errorEl.hidden = !message;
    input.closest('.form-group').classList.toggle('has-error', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate(input) {
    const message = rules[input.id](input.value);
    setError(input, message);
    return !message;
  }

  form.addEventListener('focusout', (e) => {
    if (!fields[e.target.id]) return;
    touched.add(e.target.id);
    validate(e.target);
  });

  form.addEventListener('input', (e) => {
    const id = e.target.id;
    if (!fields[id]) return;

    if (touched.has(id)) validate(e.target);

    if (id === 'password' && touched.has('confirm')) validate(fields.confirm);
  });


  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('form-message').className = 'form-message';

    let firstInvalid = null;
    Object.values(fields).forEach((input) => {
      touched.add(input.id);
      if (!validate(input) && !firstInvalid) firstInvalid = input;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const name = fields.name.value.trim();
    const email = fields.email.value.trim();
    const password = fields.password.value;
    const confirm = fields.confirm.value;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      await pb.collection('users').create({ name, email, password, passwordConfirm: confirm });
      await pb.collection('users').authWithPassword(email, password);   // log in straight away
      goAfterAuth();
    } catch (err) {
      const data = err.response && err.response.data;
      let shown = false;

      if (data) {
        ['name', 'email', 'password'].forEach((key) => {
          if (data[key] && data[key].message) {
            setError(fields[key], data[key].message);
            if (!shown) fields[key].focus();
            shown = true;
          }
        });
      }

      if (!shown) showFormMessage(pbErrorMessage(err), 'error');

      btn.disabled = false;
      btn.textContent = 'Sign Up';
    }
  });
})();