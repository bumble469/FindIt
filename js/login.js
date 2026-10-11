// login.js – Login page (PocketBase)
(function () {
  const form = document.getElementById('login-form');
  if (!form) return;

  // Already logged in? No need to see this page
  if (isLoggedIn()) { goAfterAuth(); return; }

  // Show / hide password buttons
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

  const emailInput = form.querySelector('#email');
  const passInput = form.querySelector('#password');

  function markInvalid(...inputs) {
    [emailInput, passInput].forEach((i) => i.removeAttribute('aria-invalid'));
    inputs.forEach((i) => i.setAttribute('aria-invalid', 'true'));
  }
  [emailInput, passInput].forEach((i) => i.addEventListener('input', () => {
    i.removeAttribute('aria-invalid');
    document.getElementById('form-message').className = 'form-message';
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');

    if (!email) { markInvalid(emailInput); emailInput.focus(); return showFormMessage('Please enter your email address.', 'error'); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { markInvalid(emailInput); emailInput.focus(); return showFormMessage('Please enter a valid email address.', 'error'); }
    if (!password) { markInvalid(passInput); passInput.focus(); return showFormMessage('Please enter your password.', 'error'); }

    markInvalid();
    document.getElementById('form-message').className = 'form-message';
    btn.disabled = true;
    btn.textContent = 'Logging in…';

    try {
      await pb.collection('users').authWithPassword(email, password);
      goAfterAuth();
    } catch (err) {
      let message;
      if (err.status === 400) {
        markInvalid(emailInput, passInput);
        message = 'Incorrect email or password. Please check your details and try again.';
      } else if (err.status === 429) {
        message = 'Too many login attempts. Please wait a minute and try again.';
      } else {
        message = pbErrorMessage(err);
      }
      showFormMessage(message, 'error');
      passInput.value = '';
      passInput.focus();
      btn.disabled = false;
      btn.textContent = 'Log In';
    }
  });
})();