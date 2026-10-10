// my-items.js – My Items page (dummy data, tabs + search)
// Shows only for logged-in users. Replace the dummy arrays with real data later.
// Tip: open the page with ?empty=1 to preview the "no items" state.

(function () {
  const content = document.getElementById('my-items-content');
  const gate = document.getElementById('auth-gate');
  if (!content) return;

  // Not logged in -> show the centred "log in" message and stop
  if (!isLoggedIn()) {
    gate.hidden = false;
    return;
  }
  content.hidden = false;

  const user = getCurrentUser();
  if (user && user.name) {
    document.getElementById('welcome-text').textContent =
      'Hi ' + user.name.split(' ')[0] + ', here is everything you have reported lost or found.';
  }

  /* ---------------- Dummy data ---------------- */
  const useEmpty = new URLSearchParams(window.location.search).get('empty') === '1';

  const data = useEmpty ? { lost: [], found: [] } : {
    lost: [
      { id: 101, type: 'lost', title: 'Navy blue backpack',     category: 'Bags',        location: 'Sports Complex',         date: daysAgo(4),  status: 'open',     image: placeholderImage('🎒', '#F3EBDD') },
      { id: 102, type: 'lost', title: 'Prescription glasses',   category: 'Accessories', location: 'Science Lab 2',          date: daysAgo(15), status: 'pending',  image: placeholderImage('👓', '#E6F0E9') },
      { id: 103, type: 'lost', title: 'Blue iPhone 13',         category: 'Electronics', location: 'Engineering Block',      date: daysAgo(2),  status: 'open',     image: placeholderImage('📱', '#E4EEF5') },
      { id: 104, type: 'lost', title: 'Brown leather wallet',   category: 'Accessories', location: 'Bus stop near Gate 2',   date: daysAgo(20), status: 'returned', image: placeholderImage('👛', '#E6F0E9') },
    ],
    found: [
      { id: 201, type: 'found', title: 'Black earbuds case',    category: 'Electronics', location: 'Central Library',        date: daysAgo(1),  status: 'open',     image: placeholderImage('🎧', '#E4EEF5') },
      { id: 202, type: 'found', title: 'Keys with blue tag',    category: 'Other',       location: 'Visitor Parking',        date: daysAgo(12), status: 'returned', image: placeholderImage('🔑', '#EEF0EE') },
      { id: 203, type: 'found', title: 'Student ID card',       category: 'Documents',   location: 'Main Cafeteria',         date: daysAgo(0),  status: 'office',   image: placeholderImage('🪪', '#EDE9F6') },
    ],
  };

  /* ---------------- State ---------------- */
  const state = { tab: 'lost', q: '' };

  const grid = document.getElementById('my-grid');
  const tabs = document.querySelectorAll('#my-tabs .tab');
  const search = document.getElementById('my-search');

  /* ---------------- Rendering ---------------- */
  function actionsFor(item) {
    const details = `<a class="btn btn-ghost btn-sm" href="item-details.html?id=${item.id}">Details</a>`;

    if (item.status === 'returned') {
      const label = item.type === 'lost' ? 'Recovered' : 'Returned';
      return `<button type="button" class="btn btn-outline btn-sm" disabled>${label}</button>${details}`;
    }

    const label = item.type === 'lost' ? 'Mark as recovered' : 'Mark as returned';
    return `<button type="button" class="btn btn-primary btn-sm" data-resolve="${item.id}">${label}</button>${details}`;
  }

  function updateCounts() {
    document.getElementById('count-lost').textContent = data.lost.length;
    document.getElementById('count-found').textContent = data.found.length;
  }

  function emptyFor(total) {
    const isLost = state.tab === 'lost';

    // The tab has no items at all
    if (total === 0) {
      return buildEmptyState({
        icon: '📭',
        title: 'No items',
        text: isLost
          ? 'You have not reported anything lost yet. If you lose something, report it and we will help you track it down.'
          : 'You have not reported anything found yet. Found something on campus? Report it so the owner can claim it.',
        actionsHTML: isLost
          ? '<a href="report.html" class="btn btn-primary">Report Lost Item</a>'
          : '<a href="report.html" class="btn btn-primary">Report Found Item</a>',
      });
    }

    // Items exist, but the search found none
    return buildEmptyState({
      icon: '🔎',
      title: 'No items match your search',
      text: 'Try a different keyword, or clear the search to see all your items.',
      actionsHTML: '<button type="button" class="btn btn-outline" id="clear-search">Clear search</button>',
    });
  }

  function render() {
    const list = data[state.tab];
    const q = state.q.trim().toLowerCase();

    const items = list
      .filter((i) => !q || (i.title + ' ' + i.location + ' ' + i.category).toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!items.length) {
      grid.innerHTML = emptyFor(list.length);
      const clear = document.getElementById('clear-search');
      if (clear) clear.addEventListener('click', () => { search.value = ''; state.q = ''; render(); });
      return;
    }

    grid.innerHTML = items.map((item) => buildItemCard(item, actionsFor(item))).join('');
  }

  /* ---------------- Events ---------------- */
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    state.tab = tab.dataset.tab;
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active);
    });
    render();
  }));

  search.addEventListener('input', () => { state.q = search.value; render(); });

  // "Mark as recovered / returned" buttons (dummy: only updates this page)
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-resolve]');
    if (!btn) return;
    const item = data[state.tab].find((i) => String(i.id) === btn.dataset.resolve);
    if (item) {
      item.status = 'returned';
      render();
    }
  });

  /* ---------------- Init ---------------- */
  updateCounts();
  render();
})();
