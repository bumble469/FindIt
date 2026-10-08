// app.js – shared code for every page
// 1) login-aware UI   2) helpers + item-card builder used by Browse Items & My Items

/* =========================================================
   1. LOGIN STATE
   Placeholder until real auth is connected: a user is "logged in"
   when localStorage has a "findit_user" entry.
   Elements with data-auth="in"  -> shown only when logged in
   Elements with data-auth="out" -> shown only when logged out
   Elements with data-logout     -> click to log out
   ========================================================= */

const AUTH_KEY = 'findit_user';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return getCurrentUser() !== null;
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

// DEV ONLY – remove once real login exists.
// Open any page with ?demo=login or ?demo=logout to switch state quickly.
(function demoSwitch() {
  const demo = new URLSearchParams(window.location.search).get('demo');
  if (demo === 'login') {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ id: 1, name: 'Demo Student', email: 'demo@university.edu' })
    );
  }
  if (demo === 'logout') localStorage.removeItem(AUTH_KEY);
})();

function applyAuthState() {
  const loggedIn = isLoggedIn();
  document.querySelectorAll('[data-auth="in"]').forEach((el) => { el.hidden = !loggedIn; });
  document.querySelectorAll('[data-auth="out"]').forEach((el) => { el.hidden = loggedIn; });
  document.querySelectorAll('[data-logout]').forEach((el) => el.addEventListener('click', logout));
}

applyAuthState();


/* =========================================================
   2. SHARED HELPERS
   ========================================================= */

function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

// ISO date string for "n days ago" (handy for dummy data)
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

// Placeholder picture (emoji on a soft colour) – swap for real image paths later
function placeholderImage(emoji, bg) {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>" +
    "<rect width='400' height='300' fill='" + bg + "'/>" +
    "<text x='50%' y='54%' font-size='110' text-anchor='middle' dominant-baseline='middle'>" +
    emoji + "</text></svg>";
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}


/* =========================================================
   3. ITEM CARD (used by items.js and my-items.js)
   item = { id, type: 'lost'|'found', title, category, location,
            date (ISO), status: 'open'|'office'|'pending'|'returned', image }
   ========================================================= */

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

  return `
    <article class="item-card">
      <a class="item-media" href="${url}" aria-label="View ${escapeHTML(item.title)}">
        <img src="${item.image}" alt="${escapeHTML(item.title)}" loading="lazy">
        <div class="item-pills">
          <span class="pill pill-${item.type}">${typeLabel}</span>
          <span class="pill ${status.cls}">${status[item.type]}</span>
        </div>
      </a>
      <div class="item-body">
        <span class="item-category">${escapeHTML(item.category)}</span>
        <h3 class="item-title"><a href="${url}">${escapeHTML(item.title)}</a></h3>
        <ul class="item-meta">
          <li><span aria-hidden="true">📍</span> ${escapeHTML(item.location)}</li>
          <li><span aria-hidden="true">📅</span> ${formatDate(item.date)} · ${timeAgo(item.date)}</li>
        </ul>
        <div class="item-actions">${actionsHTML || ''}</div>
      </div>
    </article>`;
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
