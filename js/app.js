// Load the profile dialog (icon, edit photo, change password, logout confirm) on every page
(function () {
  const src = document.currentScript && document.currentScript.src;
  if (!src) return;
  const root = src.replace(/js\/app\.js.*$/, '');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = root + 'css/profile.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = root + 'js/profile.js';
  document.body.appendChild(script);
})();

function getCurrentUser() {
  return pb.authStore.record || pb.authStore.model || null; 
}

function isLoggedIn() {
  return pb.authStore.isValid;
}

function logout() {
  pb.authStore.clear();
  window.location.href = location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
}

function requireAuth() {
  if (!isLoggedIn()) {
    sessionStorage.setItem('findit_next', window.location.href);
    window.location.href = location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
  }
}

function applyAuthState() {
  const loggedIn = isLoggedIn();
  document.querySelectorAll('[data-auth="in"]').forEach((el) => { el.hidden = !loggedIn; });
  document.querySelectorAll('[data-auth="out"]').forEach((el) => { el.hidden = loggedIn; });
}

function highlightActiveLink() {
  const clean = (path) => path.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const section = document.body.dataset.nav;
  const current = clean(location.pathname);

  document.querySelectorAll('.nav-links a').forEach((link) => {
    const target = clean(new URL(link.getAttribute('href'), location.href).pathname);
    const isActive = section
      ? target.endsWith('/' + section)
      : target === current;

    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

highlightActiveLink();

document.querySelectorAll('[data-logout]').forEach((el) => el.addEventListener('click', logout));
pb.authStore.onChange(applyAuthState);   // keeps the navbar in sync

if (document.body.hasAttribute('data-protected')) requireAuth();

if (isLoggedIn()) {
  pb.collection('users').authRefresh().catch((err) => {
    if ([400, 401, 403, 404].includes(err.status)) pb.authStore.clear();
  });
}

applyAuthState();

function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function timeAgo(iso) {
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((start(new Date()) - start(new Date(iso))) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return days + ' days ago';
  const months = Math.floor(days / 30);
  return months + (months === 1 ? ' month ago' : ' months ago');
}

function placeholderImage(emoji, bg) {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>" +
    "<rect width='400' height='300' fill='" + bg + "'/>" +
    "<text x='50%' y='54%' font-size='110' text-anchor='middle' dominant-baseline='middle'>" +
    emoji + "</text></svg>";
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const STATUS_META = {
  open:     { lost: 'Still missing', found: 'Unclaimed',         cls: 'pill-open' },
  office:   { lost: 'At office',     found: 'At campus office',  cls: 'pill-office' },
  pending:  { lost: 'Match found',   found: 'Claim pending',     cls: 'pill-pending' },
  returned: { lost: 'Recovered',     found: 'Returned to owner', cls: 'pill-returned' },
};

function buildItemCard(item, actionsHTML) {
  const status = STATUS_META[item.status] || STATUS_META.open;
  const typeLabel = item.type === 'lost' ? 'Lost' : 'Found';
  const url = 'item-details.html?id=' + encodeURIComponent(item.id);

  const description =
    item.description ||
    typeLabel +
      ' at ' +
      item.location +
      ' on ' +
      formatDate(item.date) +
      ' (' +
      timeAgo(item.date) +
      ').';

  return `
    <article class="item-card">
      <a
        class="item-media"
        href="${url}"
        aria-label="View ${escapeHTML(item.title)}"
      >
        <img
          src="${item.image}"
          alt="${escapeHTML(item.title)}"
          loading="lazy"
        >
      </a>


      <div class="item-body">
        <h3 class="item-title">
          <a href="${url}">
            ${escapeHTML(item.title)}
          </a>
        </h3>

        <p class="item-desc">
          ${escapeHTML(description)}
        </p>

        <div class="item-tags">
          <span class="tag">
            ${escapeHTML(item.category)}
          </span>
          <span class="tag tag-outline">
            ${typeLabel}
          </span>
        </div>

        <p class="item-status">
          <span class="status-dot dot-${item.status}"></span>
          ${escapeHTML(status[item.type] || item.status)}
        </p>

        <div class="item-actions">
          ${actionsHTML || ''}
        </div>

      </div>

    </article>
  `;
}

function buildEmptyState({ icon, title, text, actionsHTML }) {
  return `
    <div class="empty-state">
      <div class="empty-icon" aria-hidden="true">${icon}</div>
      <h3>${title}</h3>
      <p>${text}</p>
      ${actionsHTML ? `<div class="empty-actions">${actionsHTML}</div>` : ''}
    </div>`;
}

/* ---------- Auth helpers (used by login.js / signup.js / report) ---------- */
function showFormMessage(text, type) {
  const box = document.getElementById('form-message');
  if (!box) return;
  box.textContent = text;
  box.className = 'form-message ' + type;
}

function pbErrorMessage(err) {
  if (err.status === 0) return 'Cannot reach the server. Is PocketBase running?';
  const data = err.response && err.response.data;
  if (data && Object.keys(data).length) {
    return Object.values(data).map((v) => v.message).join(' ');
  }
  return (err.response && err.response.message) || 'Something went wrong. Please try again.';
}

function goAfterAuth() {
  const next = sessionStorage.getItem('findit_next');
  sessionStorage.removeItem('findit_next');
  window.location.href = next || '../index.html';
}