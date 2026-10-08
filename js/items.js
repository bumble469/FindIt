// items.js – Browse Items page (dummy data + search / filters / sort)
// Replace ITEMS with real data later. Shared helpers live in app.js.

(function () {
  const grid = document.getElementById('items-grid');
  if (!grid) return;

  /* ---------------- Dummy data ---------------- */
  // status: 'open' | 'office' | 'pending' | 'returned'   (type: 'lost' | 'found')
  const ITEMS = [
    { id: 1,  type: 'found', title: 'Black wireless earbuds case', category: 'Electronics', location: 'Central Library, 1st floor', date: daysAgo(1),  status: 'open',     image: placeholderImage('🎧', '#E4EEF5') },
    { id: 2,  type: 'lost',  title: 'Blue iPhone 13',              category: 'Electronics', location: 'Engineering Block, Room 12', date: daysAgo(2),  status: 'open',     image: placeholderImage('📱', '#E4EEF5') },
    { id: 3,  type: 'found', title: 'Student ID card',             category: 'Documents',   location: 'Main Cafeteria',             date: daysAgo(0),  status: 'office',   image: placeholderImage('🪪', '#EDE9F6') },
    { id: 4,  type: 'lost',  title: 'Navy blue backpack',          category: 'Bags',        location: 'Sports Complex',             date: daysAgo(4),  status: 'open',     image: placeholderImage('🎒', '#F3EBDD') },
    { id: 5,  type: 'found', title: 'Casio silver wrist watch',    category: 'Accessories', location: 'Campus Gym',                 date: daysAgo(6),  status: 'pending',  image: placeholderImage('⌚', '#E6F0E9') },
    { id: 6,  type: 'lost',  title: 'Calculus textbook (8th ed.)', category: 'Books',       location: 'Lecture Hall B',             date: daysAgo(9),  status: 'open',     image: placeholderImage('📚', '#F5E6E0') },
    { id: 7,  type: 'found', title: 'Keys with blue tag',          category: 'Other',       location: 'Visitor Parking',            date: daysAgo(12), status: 'returned', image: placeholderImage('🔑', '#EEF0EE') },
    { id: 8,  type: 'lost',  title: 'Prescription glasses',        category: 'Accessories', location: 'Science Lab 2',              date: daysAgo(15), status: 'pending',  image: placeholderImage('👓', '#E6F0E9') },
    { id: 9,  type: 'found', title: 'Laptop charger (65W)',        category: 'Electronics', location: 'Library, 2nd floor',         date: daysAgo(3),  status: 'open',     image: placeholderImage('🔌', '#E4EEF5') },
    { id: 10, type: 'lost',  title: 'Brown leather wallet',        category: 'Accessories', location: 'Bus stop near Gate 2',       date: daysAgo(20), status: 'returned', image: placeholderImage('👛', '#E6F0E9') },
    { id: 11, type: 'found', title: 'Red umbrella',                category: 'Other',       location: 'Admin Building lobby',       date: daysAgo(25), status: 'open',     image: placeholderImage('☂️', '#EEF0EE') },
    { id: 12, type: 'lost',  title: 'Steel water bottle',          category: 'Other',       location: 'Basketball court',           date: daysAgo(40), status: 'open',     image: placeholderImage('🍶', '#EEF0EE') },
    { id: 13, type: 'found', title: 'Notebook with star stickers', category: 'Books',       location: 'Room 204, Arts Block',       date: daysAgo(7),  status: 'office',   image: placeholderImage('📓', '#F5E6E0') },
    { id: 14, type: 'lost',  title: 'Grey laptop sleeve',          category: 'Bags',        location: 'Computer Lab 1',             date: daysAgo(5),  status: 'open',     image: placeholderImage('💼', '#F3EBDD') },
  ];

  /* ---------------- State ---------------- */
  const params = new URLSearchParams(window.location.search);
  const initialType = ['lost', 'found'].includes(params.get('type')) ? params.get('type') : 'all';

  const state = { type: initialType, status: 'all', date: 'all', category: 'all', sort: 'newest', q: '' };

  /* ---------------- Elements ---------------- */
  const tabs = document.querySelectorAll('#type-tabs .tab');
  const searchInput = document.getElementById('search');
  const statusSelect = document.getElementById('filter-status');
  const dateSelect = document.getElementById('filter-date');
  const categorySelect = document.getElementById('filter-category');
  const sortSelect = document.getElementById('filter-sort');
  const clearBtn = document.getElementById('clear-filters');
  const filtersPanel = document.getElementById('filters');
  const filtersToggle = document.getElementById('filters-toggle');
  const resultCount = document.getElementById('result-count');

  /* ---------------- Filtering ---------------- */
  function daysOld(iso) {
    const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((start(new Date()) - start(new Date(iso))) / 86400000);
  }

  function matchesDate(item) {
    if (state.date === 'all') return true;
    const age = daysOld(item.date);
    if (state.date === 'today') return age <= 0;
    return age <= Number(state.date);
  }

  function getVisibleItems() {
    const q = state.q.trim().toLowerCase();

    return ITEMS
      .filter((i) => state.type === 'all' || i.type === state.type)
      .filter((i) => state.status === 'all' || i.status === state.status)
      .filter((i) => state.category === 'all' || i.category === state.category)
      .filter(matchesDate)
      .filter((i) => !q || (i.title + ' ' + i.location + ' ' + i.category).toLowerCase().includes(q))
      .sort((a, b) => state.sort === 'newest'
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date));
  }

  /* ---------------- Rendering ---------------- */
  function actionsFor(item) {
    const details = `<a class="btn btn-ghost btn-sm" href="item-details.html?id=${item.id}">Details</a>`;

    if (item.type === 'found') {
      if (item.status === 'pending') return `<button type="button" class="btn btn-outline btn-sm" disabled>Claim pending</button>${details}`;
      if (item.status === 'returned') return `<button type="button" class="btn btn-outline btn-sm" disabled>Claimed</button>${details}`;
      return `<a class="btn btn-primary btn-sm" href="item-details.html?id=${item.id}&claim=1">Claim</a>${details}`;
    }

    // lost item
    if (item.status === 'returned') return `<button type="button" class="btn btn-outline btn-sm" disabled>Recovered</button>${details}`;
    return `<a class="btn btn-outline btn-sm" href="report-found.html?match=${item.id}">I found this</a>${details}`;
  }

  function updateCounts() {
    document.getElementById('count-all').textContent = ITEMS.length;
    document.getElementById('count-lost').textContent = ITEMS.filter((i) => i.type === 'lost').length;
    document.getElementById('count-found').textContent = ITEMS.filter((i) => i.type === 'found').length;
  }

  function render() {
    const items = getVisibleItems();
    resultCount.textContent = items.length === 1 ? '1 item found' : items.length + ' items found';

    if (!items.length) {
      grid.innerHTML = buildEmptyState({
        icon: '🔎',
        title: 'No items found',
        text: 'Nothing matches your search or filters. Try clearing them, or report the item yourself.',
        actionsHTML:
          '<button type="button" class="btn btn-outline" id="empty-clear">Clear filters</button>' +
          '<a href="report-lost.html" class="btn btn-primary">Report Lost Item</a>',
      });
      document.getElementById('empty-clear').addEventListener('click', resetFilters);
      return;
    }

    grid.innerHTML = items.map((item) => buildItemCard(item, actionsFor(item))).join('');
  }

  /* ---------------- Events ---------------- */
  function setActiveTab() {
    tabs.forEach((t) => {
      const active = t.dataset.type === state.type;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active);
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

  filtersToggle.addEventListener('click', () => {
    const open = filtersPanel.classList.toggle('open');
    filtersToggle.setAttribute('aria-expanded', open);
  });

  /* ---------------- Init ---------------- */
  updateCounts();
  setActiveTab();
  render();
})();
