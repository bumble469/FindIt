// items.js – Browse Items page
// PocketBase data + search / filters / sort
// Shared helpers live in app.js.

(function () {
  const grid = document.getElementById('items-grid');
  if (!grid) return;

  /* ---------------- PocketBase ---------------- */

  const POCKETBASE_URL = 'http://127.0.0.1:8090';

  const ADMIN_EMAIL = 'findit@admin.com';
  const ADMIN_PASSWORD = 'Admin@123';

  const AUTH_API =
    `${POCKETBASE_URL}/api/collections/_superusers/auth-with-password`;

  const ITEMS_API =
    `${POCKETBASE_URL}/api/collections/items/records`;

  let ITEMS = [];
  let authToken = null;

  /* ---------------- PocketBase Authentication ---------------- */

  async function authenticateAdmin() {
    const response = await fetch(AUTH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Authentication failed: ${response.status} - ${data.message}`
      );
    }

    console.log('PocketBase superuser authentication successful.');

    return data.token;
  }

  /* ---------------- Load Items ---------------- */

  async function loadItems() {
    try {
      /* 1. Authenticate */
      authToken = await authenticateAdmin();

      /* 2. Fetch items + category relation */
      const response = await fetch(
        `${ITEMS_API}?expand=category`,
        {
          headers: {
            Authorization: authToken,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('PocketBase error:', data);

        throw new Error(
          `PocketBase request failed: ${response.status} - ${data.message}`
        );
      }

      /* 3. Convert PocketBase records to frontend format */
      ITEMS = data.items.map((item) => ({
        id: item.id,

        type: item.type
          ? item.type.toLowerCase()
          : 'lost',

        title: item.item_name || 'Untitled item',

        category:
          item.expand?.category?.name || 'Other',

        location:
          item.location || 'Campus',

        date:
          item.datetime,

        /*
         * PocketBase:
         * OPEN     -> frontend open
         * CLAIMED  -> frontend pending
         * RESOLVED -> frontend returned
         */
        status: mapStatus(item.status),

        image: item.image
          ? `${POCKETBASE_URL}/api/files/items/${item.id}/${item.image}`
          : placeholderImage('📦', '#EEF0EE'),
      }));

      console.log('Items loaded:', ITEMS);

      updateCounts();
      render();

    } catch (error) {
      console.error(
        'Failed to load items from PocketBase:',
        error
      );

      grid.innerHTML = buildEmptyState({
        icon: '⚠️',
        title: 'Unable to load items',
        text: error.message,
      });

      resultCount.textContent = 'Unable to load items';
    }
  }

  /* ---------------- Status Mapping ---------------- */

  function mapStatus(status) {
    switch (status) {
      case 'OPEN':
        return 'open';

      case 'CLAIMED':
        return 'pending';

      case 'RESOLVED':
        return 'returned';

      default:
        return 'open';
    }
  }

  /* ---------------- State ---------------- */

  const params = new URLSearchParams(window.location.search);

  const initialType =
    ['lost', 'found'].includes(params.get('type'))
      ? params.get('type')
      : 'all';

  const state = {
    type: initialType,
    status: 'all',
    date: 'all',
    category: 'all',
    sort: 'newest',
    q: '',
  };

  /* ---------------- Elements ---------------- */

  const tabs =
    document.querySelectorAll('#type-tabs .tab');

  const searchInput =
    document.getElementById('search');

  const statusSelect =
    document.getElementById('filter-status');

  const dateSelect =
    document.getElementById('filter-date');

  const categorySelect =
    document.getElementById('filter-category');

  const sortSelect =
    document.getElementById('filter-sort');

  const clearBtn =
    document.getElementById('clear-filters');

  const filtersPanel =
    document.getElementById('filters');

  const filtersToggle =
    document.getElementById('filters-toggle');

  const resultCount =
    document.getElementById('result-count');

  /* ---------------- Filtering ---------------- */

  function daysOld(iso) {
    const start = (d) =>
      new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate()
      );

    return Math.round(
      (
        start(new Date()) -
        start(new Date(iso))
      ) / 86400000
    );
  }

  function matchesDate(item) {
    if (state.date === 'all') {
      return true;
    }

    const age = daysOld(item.date);

    if (state.date === 'today') {
      return age <= 0;
    }

    return age <= Number(state.date);
  }

  function getVisibleItems() {
    const q = state.q.trim().toLowerCase();

    return ITEMS
      .filter(
        (item) =>
          state.type === 'all' ||
          item.type === state.type
      )

      .filter(
        (item) =>
          state.status === 'all' ||
          item.status === state.status
      )

      .filter(
        (item) =>
          state.category === 'all' ||
          item.category === state.category
      )

      .filter(matchesDate)

      .filter(
        (item) =>
          !q ||
          (
            item.title +
            ' ' +
            item.location +
            ' ' +
            item.category
          )
            .toLowerCase()
            .includes(q)
      )

      .sort((a, b) =>
        state.sort === 'newest'
          ? new Date(b.date) - new Date(a.date)
          : new Date(a.date) - new Date(b.date)
      );
  }

  /* ---------------- Rendering ---------------- */

  function actionsFor(item) {
    const details =
      `<a class="btn btn-ghost btn-sm" href="item-details.html?id=${encodeURIComponent(item.id)}">Details</a>`;

    /* ---------- Found item ---------- */

    if (item.type === 'found') {

      if (item.status === 'pending') {
        return (
          `<button type="button" class="btn btn-outline btn-sm" disabled>` +
          `Claim pending` +
          `</button>` +
          details
        );
      }

      if (item.status === 'returned') {
        return (
          `<button type="button" class="btn btn-outline btn-sm" disabled>` +
          `Claimed` +
          `</button>` +
          details
        );
      }

      return (
        `<a class="btn btn-primary btn-sm" ` +
        `href="item-details.html?id=${encodeURIComponent(item.id)}&claim=1">` +
        `Claim` +
        `</a>` +
        details
      );
    }

    /* ---------- Lost item ---------- */

    if (item.status === 'returned') {
      return (
        `<button type="button" class="btn btn-outline btn-sm" disabled>` +
        `Recovered` +
        `</button>` +
        details
      );
    }

    return (
      `<a class="btn btn-outline btn-sm" ` +
      `href="report.html?match=${encodeURIComponent(item.id)}">` +
      `I found this` +
      `</a>` +
      details
    );
  }

  function updateCounts() {
    const countAll =
      document.getElementById('count-all');

    const countLost =
      document.getElementById('count-lost');

    const countFound =
      document.getElementById('count-found');

    if (countAll) {
      countAll.textContent = ITEMS.length;
    }

    if (countLost) {
      countLost.textContent =
        ITEMS.filter(
          (item) => item.type === 'lost'
        ).length;
    }

    if (countFound) {
      countFound.textContent =
        ITEMS.filter(
          (item) => item.type === 'found'
        ).length;
    }
  }

  function render() {
    const items = getVisibleItems();

    resultCount.textContent =
      items.length === 1
        ? '1 item found'
        : `${items.length} items found`;

    if (!items.length) {
      grid.innerHTML = buildEmptyState({
        icon:
          '<img src="../assets/icons/magnifying-glass.gif" alt="No items found">',

        title: 'No items found',

        text:
          'Nothing matches your search or filters. Try clearing them, or report the item yourself.',

        actionsHTML:
          '<button type="button" class="btn btn-outline" id="empty-clear">' +
          'Clear filters' +
          '</button>' +

          '<a href="report.html" class="btn btn-primary">' +
          'Report Lost Item' +
          '</a>',
      });

      const emptyClear =
        document.getElementById('empty-clear');

      if (emptyClear) {
        emptyClear.addEventListener(
          'click',
          resetFilters
        );
      }

      return;
    }

    grid.innerHTML = items
      .map((item) =>
        buildItemCard(
          item,
          actionsFor(item)
        )
      )
      .join('');
  }

  /* ---------------- Events ---------------- */

  function setActiveTab() {
    tabs.forEach((tab) => {
      const active =
        tab.dataset.type === state.type;

      tab.classList.toggle(
        'active',
        active
      );

      tab.setAttribute(
        'aria-selected',
        active
      );
    });
  }

  function resetFilters() {
    Object.assign(state, {
      type: 'all',
      status: 'all',
      date: 'all',
      category: 'all',
      sort: 'newest',
      q: '',
    });

    searchInput.value = '';

    statusSelect.value =
      'all';

    dateSelect.value =
      'all';

    categorySelect.value =
      'all';

    sortSelect.value =
      'newest';

    setActiveTab();
    render();
  }

  /* ---------- Type tabs ---------- */

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.type =
        tab.dataset.type;

      setActiveTab();
      render();
    });
  });

  /* ---------- Search ---------- */

  searchInput.addEventListener(
    'input',
    () => {
      state.q =
        searchInput.value;

      render();
    }
  );

  /* ---------- Status ---------- */

  statusSelect.addEventListener(
    'change',
    () => {
      state.status =
        statusSelect.value;

      render();
    }
  );

  /* ---------- Date ---------- */

  dateSelect.addEventListener(
    'change',
    () => {
      state.date =
        dateSelect.value;

      render();
    }
  );

  /* ---------- Category ---------- */

  categorySelect.addEventListener(
    'change',
    () => {
      state.category =
        categorySelect.value;

      render();
    }
  );

  /* ---------- Sort ---------- */

  sortSelect.addEventListener(
    'change',
    () => {
      state.sort =
        sortSelect.value;

      render();
    }
  );

  /* ---------- Clear filters ---------- */

  clearBtn.addEventListener(
    'click',
    resetFilters
  );

  /* ---------- Filter panel ---------- */

  filtersToggle.addEventListener(
    'click',
    () => {
      const open =
        filtersPanel.classList.toggle(
          'open'
        );

      filtersToggle.setAttribute(
        'aria-expanded',
        open
      );
    }
  );

  /* ---------------- Grid / List Toggle ---------------- */

  const viewButtons =
    document.querySelectorAll(
      '.view-toggle button'
    );

  viewButtons.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {

        viewButtons.forEach((button) => {
          button.classList.toggle(
            'active',
            button === btn
          );

          button.setAttribute(
            'aria-pressed',
            button === btn
          );
        });

        grid.classList.toggle(
          'list-view',
          btn.dataset.view === 'list'
        );
      }
    );
  });

  /* ---------------- Init ---------------- */

  setActiveTab();

  loadItems();

})();