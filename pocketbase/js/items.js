// items.js – Browse Items page (PocketBase)

(function () {
  const grid = document.getElementById('items-grid');
  if (!grid) return;

  let ITEMS = [];

  /* ---------------- Settings ---------------- */

  const PILL_CLASS = {
    open: 'br-pill--open',
    office: 'br-pill--office',
    pending: 'br-pill--pending',
    returned: 'br-pill--done',
  };

  const STATUS_LABEL = {
    lost:  { open: 'Still missing', office: 'Still missing',    pending: 'Match found',   returned: 'Recovered' },
    found: { open: 'Unclaimed',     office: 'At campus office', pending: 'Claim pending', returned: 'Returned' },
  };

  /* ---------------- Elements ---------------- */

  const tabs           = document.querySelectorAll('#type-tabs .br-tab');
  const searchInput    = document.getElementById('search');
  const statusSelect   = document.getElementById('filter-status');
  const dateSelect     = document.getElementById('filter-date');
  const categorySelect = document.getElementById('filter-category');
  const sortSelect     = document.getElementById('filter-sort');
  const clearBtn       = document.getElementById('clear-filters');
  const resultCount    = document.getElementById('result-count');
  const viewButtons    = document.querySelectorAll('.br-view button');

  /* ---------------- State ---------------- */

  const params = new URLSearchParams(window.location.search);
  const initialType = ['lost', 'found'].includes(params.get('type')) ? params.get('type') : 'all';

  const state = { type: initialType, status: 'all', date: 'all', category: 'all', sort: 'newest', q: '', loading: true };

  /* ---------------- Load items ---------------- */

  // OPEN -> open (or office when the finder handed it in), CLAIMED -> pending, RESOLVED -> returned
  function mapStatus(rec) {
    if (rec.status === 'CLAIMED') return 'pending';
    if (rec.status === 'RESOLVED') return 'returned';
    return rec.custody === 'AT_OFFICE' ? 'office' : 'open';
  }

  async function loadItems() {
    state.loading = true;
    render();

    try {
      const records = await pb.collection('items').getFullList({
        expand: 'category',
        sort: '-datetime',
      });

      ITEMS = records.map((rec) => ({
        id: rec.id,
        type: rec.type ? rec.type.toLowerCase() : 'lost',
        title: rec.item_name || 'Untitled item',
        description: rec.description || '',
        category: rec.expand?.category?.name || 'Other',
        location: rec.location || 'Campus',
        date: String(rec.datetime || rec.created).replace(' ', 'T'),
        status: mapStatus(rec),
        image: rec.image
          ? pb.files.getURL(rec, rec.image)
          : placeholderImage(rec.type === 'FOUND' ? '📦' : '🔍', rec.type === 'FOUND' ? '#E6F0E9' : '#F3EBDD'),
      }));

      state.loading = false;
      updateCounts();
      render();
    } catch (error) {
      console.error('Failed to load items from PocketBase:', error);
      state.loading = false;
      grid.innerHTML = stateHTML({
        icon: '⚠️',
        title: 'Unable to load items',
        text: escapeHTML(pbErrorMessage(error)),
        actions: '<button type="button" class="btn btn-primary" id="retry">Try again</button>',
      });
      resultCount.textContent = '';
      document.getElementById('retry').addEventListener('click', loadItems);
    }
  }

  /* ---------------- Filtering ---------------- */

  function daysOld(iso) {
    const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((start(new Date()) - start(new Date(iso))) / 86400000);
  }

  function matchesDate(item) {
    if (state.date === 'all') return true;
    const age = daysOld(item.date);
    return state.date === 'today' ? age <= 0 : age <= Number(state.date);
  }

  function getVisibleItems() {
    const q = state.q.trim().toLowerCase();

    return ITEMS
      .filter((i) => state.type === 'all' || i.type === state.type)
      .filter((i) => state.status === 'all' || i.status === state.status)
      .filter((i) => state.category === 'all' || i.category === state.category)
      .filter(matchesDate)
      .filter((i) => !q || (i.title + ' ' + i.location + ' ' + i.category + ' ' + i.description).toLowerCase().includes(q))
      .sort((a, b) => state.sort === 'newest'
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date));
  }

  function hasActiveFilters() {
    return state.type !== 'all' || state.status !== 'all' || state.date !== 'all' ||
      state.category !== 'all' || state.q.trim() !== '';
  }

  /* ---------------- Rendering ---------------- */

  function actionsFor(item) {
    const id = encodeURIComponent(item.id);
    const details = `<a class="btn btn-outline" href="item-details.html?id=${id}">Details</a>`;
    const disabled = (label) =>
      `<button type="button" class="btn btn-outline" disabled>${label}</button>${details}`;

    if (item.type === 'found') {
      if (item.status === 'pending') return disabled('Claim pending');
      if (item.status === 'returned') return disabled('Claimed');
      return `<a class="btn btn-primary" href="item-details.html?id=${id}&claim=1">Claim</a>${details}`;
    }

    if (item.status === 'returned') return disabled('Recovered');
    return `<a class="btn btn-primary" href="report.html?type=FOUND&match=${id}">I found this</a>${details}`;
  }

  function cardHTML(item) {
    const url = 'item-details.html?id=' + encodeURIComponent(item.id);

    return `
      <article class="br-card">
        <a class="br-media" href="${url}" aria-label="View ${escapeHTML(item.title)}">
          <img src="${item.image}" alt="${escapeHTML(item.title)}" loading="lazy">
          <div class="br-pills">
            <span class="br-pill br-pill--${item.type}">${item.type === 'lost' ? 'Lost' : 'Found'}</span>
            <span class="br-pill ${PILL_CLASS[item.status]}">${STATUS_LABEL[item.type][item.status]}</span>
          </div>
        </a>
        <div class="br-body">
          <h3 class="br-title"><a href="${url}">${escapeHTML(item.title)}</a></h3>
          ${item.description ? `<p class="br-desc">${escapeHTML(item.description)}</p>` : ''}
          <ul class="br-meta">
            <li><span aria-hidden="true">📍</span> ${escapeHTML(item.location)}</li>
            <li><span aria-hidden="true">📅</span> ${formatDate(item.date)} · ${timeAgo(item.date)}</li>
            <li><span aria-hidden="true">🏷️</span> ${escapeHTML(item.category)}</li>
          </ul>
          <div class="br-actions">${actionsFor(item)}</div>
        </div>
      </article>`;
  }

  function stateHTML({ icon, title, text, actions }) {
    return `
      <div class="br-state">
        ${icon === 'spinner'
          ? '<div class="br-spinner" aria-hidden="true"></div>'
          : `<div class="br-state-icon" aria-hidden="true">${icon}</div>`}
        <h3>${title}</h3>
        ${text ? `<p>${text}</p>` : ''}
        ${actions ? `<div class="br-state-actions">${actions}</div>` : ''}
      </div>`;
  }

  function updateCounts() {
    const set = (id, n) => { document.getElementById(id).textContent = n; };
    set('count-all', ITEMS.length);
    set('count-lost', ITEMS.filter((i) => i.type === 'lost').length);
    set('count-found', ITEMS.filter((i) => i.type === 'found').length);
  }

  function render() {
    clearBtn.hidden = !hasActiveFilters();

    if (state.loading) {
      resultCount.textContent = '';
      grid.innerHTML = stateHTML({ icon: 'spinner', title: 'Loading items' });
      return;
    }

    const items = getVisibleItems();
    resultCount.textContent = items.length === 1 ? '1 item found' : items.length + ' items found';

    if (!items.length) {
      grid.innerHTML = stateHTML({
        icon: '<img src="../assets/icons/magnifying-glass.gif" alt="">',
        title: 'No items found',
        text: 'Nothing matches your search or filters. Try clearing them, or report the item yourself.',
        actions:
          '<button type="button" class="btn btn-outline" id="empty-clear">Clear filters</button>' +
          '<a href="report.html?type=LOST" class="btn btn-primary">Report a lost item</a>',
      });
      document.getElementById('empty-clear').addEventListener('click', resetFilters);
      return;
    }

    grid.innerHTML = items.map(cardHTML).join('');
  }

  /* ---------------- Events ---------------- */

  function setActiveTab() {
    tabs.forEach((tab) => {
      const active = tab.dataset.type === state.type;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active);
    });
  }

  function resetFilters() {
    Object.assign(state, { type: 'all', status: 'all', date: 'all', category: 'all', sort: 'newest', q: '' });
    searchInput.value = '';
    statusSelect.value = dateSelect.value = categorySelect.value = 'all';
    sortSelect.value = 'newest';
    setActiveTab();
    render();
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    state.type = tab.dataset.type;
    setActiveTab();
    render();
  }));

  searchInput.addEventListener('input', () => { state.q = searchInput.value; render(); });
  statusSelect.addEventListener('change', () => { state.status = statusSelect.value; render(); });
  dateSelect.addEventListener('change', () => { state.date = dateSelect.value; render(); });
  categorySelect.addEventListener('change', () => { state.category = categorySelect.value; render(); });
  sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; render(); });
  clearBtn.addEventListener('click', resetFilters);

  viewButtons.forEach((btn) => btn.addEventListener('click', () => {
    viewButtons.forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', b === btn);
    });
    grid.classList.toggle('list-view', btn.dataset.view === 'list');
  }));

  /* ---------------- Init ---------------- */

  setActiveTab();
  loadItems();
})();