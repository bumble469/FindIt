// profile.js – navbar profile icon, profile dialog and logout confirmation (PocketBase)
// Loaded automatically by app.js on every page.
(function () {
  if (typeof pb === 'undefined' || typeof isLoggedIn !== 'function') return;

  const MAX_BYTES = 5 * 1024 * 1024;
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ---------- Avatar helpers ---------- */
  function fileURL(user) {
    if (!user || !user.avatar) return '';
    const files = pb.files;
    const getter = files.getURL || files.getUrl;
    return getter.call(files, user, user.avatar);
  }

  function paintAvatar(el, user) {
    const initial = ((user && (user.name || user.email)) || '?').trim().charAt(0).toUpperCase();
    el.textContent = '';
    const url = fileURL(user);
    if (!url) { el.textContent = initial; return; }
    const img = document.createElement('img');
    img.alt = '';
    img.onerror = () => { el.textContent = initial; };
    img.src = url;
    el.appendChild(img);
  }

  function refreshAvatars() {
    const user = getCurrentUser();
    document.querySelectorAll('.nav-profile').forEach((btn) => paintAvatar(btn, user));
    const big = $('#fi-avatar-lg');
    if (big) paintAvatar(big, user);
  }

  /* ---------- Navbar profile button (placed beside Logout) ---------- */
  document.querySelectorAll('[data-logout]').forEach((logoutBtn) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-profile';
    btn.setAttribute('data-auth', 'in');
    btn.setAttribute('data-profile', '');
    btn.setAttribute('aria-label', 'Open profile');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.hidden = !isLoggedIn();
    logoutBtn.parentNode.insertBefore(btn, logoutBtn);
  });

  /* ---------- Dialogs ---------- */
  const profile = document.createElement('dialog');
  profile.className = 'fi-dialog';
  profile.setAttribute('aria-labelledby', 'fi-profile-title');
  profile.innerHTML = `
    <div class="fi-head">
      <h2 id="fi-profile-title">My profile</h2>
      <button type="button" class="fi-close" data-close aria-label="Close">&times;</button>
    </div>
    <div class="fi-body">
      <div class="fi-photo">
        <div class="fi-avatar-lg" id="fi-avatar-lg" aria-hidden="true"></div>
        <div>
          <label class="fi-btn fi-btn-secondary fi-btn-sm" for="fi-avatar-input">Change photo</label>
          <input type="file" id="fi-avatar-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
          <p class="fi-hint">JPG, PNG or WebP, up to 5 MB.</p>
        </div>
      </div>
      <p class="fi-msg" id="fi-photo-msg" role="alert"></p>

      <div class="fi-field">
        <label for="fi-name">Full name</label>
        <input type="text" id="fi-name" disabled>
      </div>
      <div class="fi-field">
        <label for="fi-email">Email</label>
        <input type="email" id="fi-email" disabled>
      </div>
      <p class="fi-hint">Name and email can't be changed.</p>

      <h3 class="fi-sub">Change password</h3>
      <form id="fi-pw-form" novalidate>
        <div class="fi-field">
          <label for="fi-pw-old">Current password</label>
          <input type="password" id="fi-pw-old" autocomplete="current-password">
        </div>
        <div class="fi-field">
          <label for="fi-pw-new">New password</label>
          <input type="password" id="fi-pw-new" autocomplete="new-password" placeholder="At least 8 characters">
        </div>
        <div class="fi-field">
          <label for="fi-pw-conf">Confirm new password</label>
          <input type="password" id="fi-pw-conf" autocomplete="new-password">
        </div>
        <p class="fi-msg" id="fi-pw-msg" role="alert"></p>
        <div class="fi-actions">
          <button type="submit" class="fi-btn fi-btn-primary" id="fi-pw-submit">Update password</button>
        </div>
      </form>
    </div>`;

  const confirmBox = document.createElement('dialog');
  confirmBox.className = 'fi-dialog fi-dialog--small';
  confirmBox.setAttribute('aria-labelledby', 'fi-logout-title');
  confirmBox.innerHTML = `
    <div class="fi-body">
      <h2 id="fi-logout-title">Log out of FindIt?</h2>
      <p class="fi-text">You will need to log in again to report items or view My Items.</p>
      <div class="fi-actions fi-actions--end">
        <button type="button" class="fi-btn fi-btn-secondary" data-close>Cancel</button>
        <button type="button" class="fi-btn fi-btn-primary" id="fi-logout-ok">Log out</button>
      </div>
    </div>`;

  document.body.append(profile, confirmBox);

  const photoInput = $('#fi-avatar-input', profile);
  const photoMsg = $('#fi-photo-msg', profile);
  const pwForm = $('#fi-pw-form', profile);
  const pwMsg = $('#fi-pw-msg', profile);
  const pwSubmit = $('#fi-pw-submit', profile);

  function setMsg(el, text, type) {
    el.textContent = text || '';
    el.className = 'fi-msg' + (type ? ' fi-msg--' + type : '');
  }

  function openProfile() {
    const user = getCurrentUser();
    if (!user) return;
    $('#fi-name', profile).value = user.name || '';
    $('#fi-email', profile).value = user.email || '';
    refreshAvatars();
    profile.showModal();
  }

  /* ---------- Open / close wiring ---------- */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-profile]')) openProfile();
  });

  // Intercept Logout (capture phase, before app.js's own handler) and ask first
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-logout]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    confirmBox.showModal();
  }, true);

  [profile, confirmBox].forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });

  profile.addEventListener('close', () => {
    pwForm.reset();
    setMsg(pwMsg, '');
    setMsg(photoMsg, '');
    photoInput.value = '';
  });

  $('#fi-logout-ok', confirmBox).addEventListener('click', () => {
    confirmBox.close();
    logout();
  });

  /* ---------- Change photo ---------- */
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    const user = getCurrentUser();
    if (!file || !user) return;

    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      setMsg(photoMsg, 'Please choose a JPG, PNG or WebP image.', 'error');
      photoInput.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      setMsg(photoMsg, 'That image is larger than 5 MB.', 'error');
      photoInput.value = '';
      return;
    }

    setMsg(photoMsg, 'Uploading…');
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await pb.collection('users').update(user.id, fd);
      refreshAvatars();
      setMsg(photoMsg, 'Profile photo updated.', 'success');
    } catch (err) {
      setMsg(photoMsg, pbErrorMessage(err), 'error');
    }
    photoInput.value = '';
  });

  /* ---------- Change password ---------- */
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;

    const oldPw = $('#fi-pw-old', profile).value;
    const newPw = $('#fi-pw-new', profile).value;
    const confPw = $('#fi-pw-conf', profile).value;

    if (!oldPw || !newPw || !confPw) return setMsg(pwMsg, 'Fill in all three password fields.', 'error');
    if (newPw.length < 8) return setMsg(pwMsg, 'New password must be at least 8 characters.', 'error');
    if (newPw !== confPw) return setMsg(pwMsg, 'New password and confirmation do not match.', 'error');
    if (newPw === oldPw) return setMsg(pwMsg, 'New password must be different from the current one.', 'error');

    pwSubmit.disabled = true;
    pwSubmit.textContent = 'Updating…';
    setMsg(pwMsg, '');
    try {
      await pb.collection('users').update(user.id, {
        oldPassword: oldPw,
        password: newPw,
        passwordConfirm: confPw,
      });
      // PocketBase invalidates the old session after a password change, so sign in again silently
      await pb.collection('users').authWithPassword(user.email, newPw);
      pwForm.reset();
      setMsg(pwMsg, 'Password updated successfully.', 'success');
    } catch (err) {
      const data = err.response && err.response.data;
      setMsg(pwMsg, data && data.oldPassword ? 'Your current password is incorrect.' : pbErrorMessage(err), 'error');
    }
    pwSubmit.disabled = false;
    pwSubmit.textContent = 'Update password';
  });

  pb.authStore.onChange(refreshAvatars);
  refreshAvatars();
})();
