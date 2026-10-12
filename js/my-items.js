// my-items.js – My Items: profile + items I reported (lost / found) + found items I claimed (PocketBase)

(function () {
  const grid = document.getElementById('mi-grid');
  if (!grid) return;

  const user = getCurrentUser();
  if (!user) return;                         // data-protected sends visitors to the login page

  /* ---------------- Settings ---------------- */

  const STAGE = { OPEN: 0, CLAIMED: 1, RESOLVED: 2 };
  const STATUS_FILTER = { open: 'OPEN', progress: 'CLAIMED', resolved: 'RESOLVED' };
  const PILL_CLASS = ['mi-pill--open', 'mi-pill--pending', 'mi-pill--done'];

  const LABELS = {
    lost: {
      steps: ['Reported', 'Match found', 'Recovered'],
      pill: ['Still missing', 'Match found', 'Recovered'],
      resolve: 'Mark as recovered',
    },
    found: {
      steps: ['Reported', 'Claim pending', 'Returned'],
      pill: ['Unclaimed', 'Claim pending', 'Returned'],
      resolve: 'Mark as returned',
    },
    claimed: {
      steps: ['Found', 'You claimed it', 'Returned to you'],
      pill: ['Unclaimed', 'Claim pending', 'Returned to you'],
    },
  };

  const IN_TAB = {
    lost: (i) => i.isOwner && i.type === 'lost',
    found: (i) => i.isOwner && i.type === 'found',
    claimed: (i) => i.claimedByMe && !i.isOwner,
  };

  const state = { items: [], tab: 'lost', status: 'all', q: '', loading: true, error: '' };

  const tabs = document.querySelectorAll('.mi-tab');
  const searchInput = document.getElementById('mi-search');
  const statusSelect = document.getElementById('mi-status');

  const labelsFor = (item) => (item.claimedByMe && !item.isOwner ? LABELS.claimed : LABELS[item.type]);

  /* ---------------- People helpers ---------------- */

  function userName(u) {
    if (!u) return '';
    return u.name || (u.email ? u.email.split('@')[0] : '');
  }

  function userAvatar(u) {
    const initial = escapeHTML((userName(u) || '?').charAt(0).toUpperCase());
    let photo = '';
    if (u && u.avatar && u.collectionId) {
      photo = '<img src="' + escapeHTML(pb.files.getURL(u, u.avatar)) + '" alt="" loading="lazy" onerror="this.remove()">';
    }
    return '<span class="fi-avatar" aria-hidden="true">' + initial + photo + '</span>';
  }

  /* ---------------- Profile ---------------- */

  function initials(name) {
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  function renderProfile() {
    const name = user.name || (user.email || 'You').split('@')[0];
    document.getElementById('mi-name').textContent = name;
    document.getElementById('mi-email').textContent = user.email || '';

    const since = user.created ? new Date(String(user.created).replace(' ', 'T')) : null;
    document.getElementById('mi-since').textContent = since && !isNaN(since)
      ? 'Member since ' + since.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : 'FindIt member';

    const avatar = document.getElementById('mi-avatar');
    if (user.avatar) {
      const img = document.createElement('img');
      img.src = pb.files.getURL(user, user.avatar);
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(name);
    }
  }

  /* ---------------- Data ---------------- */

  function mapItem(rec) {
    const type = (rec.type || 'lost').toLowerCase();
    return {
      id: rec.id,
      type,
      title: rec.item_name || 'Untitled item',
      description: rec.description || '',
      category: rec.expand?.category?.name || '',
      location: rec.location || 'Campus',
      date: String(rec.datetime || rec.created).replace(' ', 'T'),
      status: rec.status || 'OPEN',
      custody: rec.custody || '',
      isOwner: rec.reported_by === user.id,
      claimedByMe: rec.claimed_by === user.id,
      claimedById: rec.claimed_by || '',
      reporter: rec.expand?.reported_by || null,
      claimer: rec.expand?.claimed_by || null,
      image: rec.image
        ? pb.files.getURL(rec, rec.image)
        : placeholderImage(type === 'lost' ? '🔍' : '📦', type === 'lost' ? '#F3EBDD' : '#E6F0E9'),
    };
  }

  async function loadItems() {
    state.loading = true;
    state.error = '';
    render();

    try {
      const records = await pb.collection('items').getFullList({
        filter: pb.filter('reported_by = {:uid} || claimed_by = {:uid}', { uid: user.id }),
        expand: 'category,reported_by,claimed_by',
        sort: '-datetime',
      });
      state.items = records.map(mapItem);
    } catch (err) {
      console.error('Could not load your items:', err);
      state.error = pbErrorMessage(err);
    }

    state.loading = false;
    render();
  }

  function visibleItems() {
    const q = state.q.trim().toLowerCase();

    return state.items
      .filter(IN_TAB[state.tab])
      .filter((i) => state.status === 'all' || i.status === STATUS_FILTER[state.status])
      .filter((i) => !q ||
        (i.title + ' ' + i.location + ' ' + i.category + ' ' + i.description).toLowerCase().includes(q));
  }

  /* ---------------- Rendering ---------------- */

  function noteFor(item) {
    if (item.claimedByMe && !item.isOwner) {
      return item.status === 'RESOLVED'
        ? 'Good news! This item was returned to you.'
        : 'You claimed this item. Visit the campus office with a photo ID to confirm it is yours.';
    }

    if (item.type === 'lost') {
      return [
        'Still searching. We will flag it here if a match is reported.',
        'A possible match was reported. Open the details to check it.',
        'Great news! You marked this item as recovered.',
      ][STAGE[item.status] ?? 0];
    }

    const claimer = item.claimedById ? (userName(item.claimer) || 'Someone') : '';
    if (item.status === 'CLAIMED') return claimer + ' has claimed this item. Verify them at the campus office, then mark it returned.';
    if (item.status === 'RESOLVED') return 'Returned to ' + (claimer || 'its owner') + '. Thank you for helping!';
    if (item.custody === 'AT_OFFICE') return 'This item is at the campus office, waiting for its owner.';
    if (item.custody === 'WITH_FINDER') return 'You are holding this item. Hand it to the campus office when you can.';
    return 'Waiting for its owner to claim it.';
  }

  function trackerHTML(item) {
    const stage = STAGE[item.status] ?? 0;

    return '<ol class="mi-track" aria-label="Status progress">' +
      labelsFor(item).steps.map((label, i) => {
        const cls = (i < stage || stage === 2) ? 'done' : (i === stage ? 'current' : '');
        return `<li class="${cls}"${cls === 'current' ? ' aria-current="step"' : ''}>${label}</li>`;
      }).join('') +
      '</ol>';
  }

  // Who claimed my item / who found the item I claimed
  function personHTML(item) {
    let label;
    let person;

    if (item.claimedByMe && !item.isOwner) {
      label = 'Found by';
      person = item.reporter;
    } else if (item.isOwner && item.claimedById) {
      label = item.type === 'found' ? 'Claimed by' : 'Matched by';
      person = item.claimer;
    } else {
      return '';
    }

    if (!person) {
      return `<div class="mi-person"><div class="mi-person-text"><span class="mi-person-label">${label}</span><span class="mi-muted">Details not available</span></div></div>`;
    }

    const email = person.email
      ? `<a href="mailto:${escapeHTML(person.email)}">${escapeHTML(person.email)}</a>`
      : '<span class="mi-muted">Email not shared</span>';

    return `
      <div class="mi-person">
        ${userAvatar(person)}
        <div class="mi-person-text">
          <span class="mi-person-label">${label}</span>
          <strong>${escapeHTML(userName(person) || 'FindIt user')}</strong>
          ${email}
        </div>
      </div>`;
  }

  function actionsHTML(item) {
    const id = escapeHTML(item.id);
    const buttons = [
      `<a class="btn btn-outline" href="item-details.html?id=${encodeURIComponent(item.id)}">View</a>`,
    ];

    // Item I claimed: no edit buttons, only a way to contact the finder
    if (item.claimedByMe && !item.isOwner) {
      const email = item.reporter && item.reporter.email;
      if (email && item.status !== 'RESOLVED') {
        const subject = encodeURIComponent('FindIt: ' + item.title);
        buttons.push(`<a class="btn btn-primary" href="mailto:${escapeHTML(email)}?subject=${subject}">Email finder</a>`);
      }
      return buttons.join('');
    }

    if (item.status !== 'RESOLVED') {
      if (item.type === 'found' && item.custody === 'WITH_FINDER') {
        buttons.push(`<button type="button" class="btn btn-outline" data-action="office" data-id="${id}">Handed to office</button>`);
      }
      buttons.push(`<button type="button" class="btn btn-primary" data-action="resolve" data-id="${id}">${LABELS[item.type].resolve}</button>`);
    }

    buttons.push(`<button type="button" class="btn btn-ghost mi-danger" data-action="delete" data-id="${id}">Delete</button>`);
    return buttons.join('');
  }

  function cardHTML(item) {
    const stage = STAGE[item.status] ?? 0;
    const labels = labelsFor(item);
    const typeLabel = item.type === 'lost' ? 'Lost' : 'Found';
    const url = 'item-details.html?id=' + encodeURIComponent(item.id);

    return `
      <article class="mi-card">
        <a class="mi-media" href="${url}" aria-label="View ${escapeHTML(item.title)}">
          <img src="${item.image}" alt="${escapeHTML(item.title)}" loading="lazy">
          <div class="mi-pills">
            <span class="mi-pill mi-pill--${item.type}">${typeLabel}</span>
            <span class="mi-pill ${PILL_CLASS[stage]}">${labels.pill[stage]}</span>
          </div>
        </a>
        <div class="mi-body">
          <h3 class="mi-title"><a href="${url}">${escapeHTML(item.title)}</a></h3>
          <p class="mi-desc">${escapeHTML(item.description)}</p>
          <ul class="mi-meta">
            <li><span aria-hidden="true">📍</span> ${escapeHTML(item.location)}</li>
            <li><span aria-hidden="true">🗓️</span> ${formatDate(item.date)} · ${timeAgo(item.date)}</li>
            ${item.category ? `<li><span aria-hidden="true">🏷️</span> ${escapeHTML(item.category)}</li>` : ''}
          </ul>
          ${personHTML(item)}
          ${trackerHTML(item)}
          <p class="mi-note">${escapeHTML(noteFor(item))}</p>
          <div class="mi-actions">${actionsHTML(item)}</div>
        </div>
      </article>`;
  }

  function stateHTML({ icon, title, text, actions }) {
    return `
      <div class="mi-state">
        ${icon === 'spinner'
          ? '<div class="mi-spinner" aria-hidden="true"></div>'
          : `<div class="mi-state-icon" aria-hidden="true">${icon}</div>`}
        <h3>${title}</h3>
        ${text ? `<p>${text}</p>` : ''}
        ${actions ? `<div class="mi-state-actions">${actions}</div>` : ''}
      </div>`;
  }

  function emptyHTML() {
    const total = state.items.filter(IN_TAB[state.tab]).length;

    if (total === 0) {
      const empty = {
        lost: {
          icon: '📭',
          title: 'No lost items yet',
          text: 'You have not reported anything lost. If you lose something, report it and we will help you track it down.',
          actions: '<a href="report.html?type=LOST" class="btn btn-primary">Report a lost item</a>',
        },
        found: {
          icon: '📭',
          title: 'No found items yet',
          text: 'You have not reported anything found. Found something on campus? Report it so the owner can claim it.',
          actions: '<a href="report.html?type=FOUND" class="btn btn-primary">Report a found item</a>',
        },
        claimed: {
          icon: '🤝',
          title: 'Nothing claimed yet',
          text: 'Found items you claim will appear here, with their status. Once the finder marks one as returned, you will see it here too.',
          actions: '<a href="items.html?type=found" class="btn btn-primary">Browse found items</a>',
        },
      };
      return stateHTML(empty[state.tab]);
    }

    return stateHTML({
      icon: '🔎',
      title: 'No items match',
      text: 'Try a different search or status, or clear the filters.',
      actions: '<button type="button" class="btn btn-outline" data-action="clear">Clear filters</button>',
    });
  }

  function render() {
    const counts = {
      lost: state.items.filter(IN_TAB.lost).length,
      found: state.items.filter(IN_TAB.found).length,
      claimed: state.items.filter(IN_TAB.claimed).length,
    };
    const resolved = state.items.filter((i) => i.status === 'RESOLVED').length;

    document.getElementById('count-lost').textContent = counts.lost;
    document.getElementById('count-found').textContent = counts.found;
    document.getElementById('count-claimed').textContent = counts.claimed;
    document.getElementById('stat-lost').textContent = counts.lost;
    document.getElementById('stat-found').textContent = counts.found;
    document.getElementById('stat-resolved').textContent = resolved;

    if (state.loading) {
      grid.innerHTML = stateHTML({ icon: 'spinner', title: 'Loading your items' });
      return;
    }

    if (state.error) {
      grid.innerHTML = stateHTML({
        icon: '⚠️',
        title: 'Could not load your items',
        text: escapeHTML(state.error),
        actions: '<button type="button" class="btn btn-primary" data-action="retry">Try again</button>',
      });
      return;
    }

    const list = visibleItems();
    grid.innerHTML = list.length ? list.map(cardHTML).join('') : emptyHTML();
  }

  /* ---------------- Actions ---------------- */

  let toastTimer;

  function toast(message, type) {
    let el = document.getElementById('mi-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mi-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'mi-toast visible' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
  }

  async function patchItem(id, data, message, btn) {
    btn.disabled = true;
    try {
      const rec = await pb.collection('items').update(id, data, { expand: 'category,reported_by,claimed_by' });
      const index = state.items.findIndex((i) => i.id === id);
      if (index !== -1) state.items[index] = mapItem(rec);
      render();
      toast(message);
    } catch (err) {
      console.error(err);
      toast(pbErrorMessage(err), 'error');
      btn.disabled = false;
    }
  }

  async function removeItem(id, btn) {
    if (!confirm('Delete this report? This cannot be undone.')) return;

    btn.disabled = true;
    try {
      await pb.collection('items').delete(id);
      state.items = state.items.filter((i) => i.id !== id);
      render();
      toast('Report deleted.');
    } catch (err) {
      console.error(err);
      toast(pbErrorMessage(err), 'error');
      btn.disabled = false;
    }
  }

  function setTab(tab) {
    state.tab = tab;
    tabs.forEach((t) => {
      const active = t.dataset.tab === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active);
    });
    render();
  }

  /* ---------------- Events ---------------- */

  tabs.forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.tab)));

  searchInput.addEventListener('input', () => { state.q = searchInput.value; render(); });
  statusSelect.addEventListener('change', () => { state.status = statusSelect.value; render(); });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'resolve':
        patchItem(id, { status: 'RESOLVED' }, 'Marked as resolved.', btn);
        break;
      case 'office':
        patchItem(id, { custody: 'AT_OFFICE' }, 'Updated: item is at the campus office.', btn);
        break;
      case 'delete':
        removeItem(id, btn);
        break;
      case 'retry':
        loadItems();
        break;
      case 'clear':
        state.q = '';
        state.status = 'all';
        searchInput.value = '';
        statusSelect.value = 'all';
        render();
        break;
    }
  });

  // Coming back with the Back button: refresh so statuses are current
  window.addEventListener('pageshow', (e) => { if (e.persisted) loadItems(); });

  /* ---------------- Init ---------------- */

  const startTab = new URLSearchParams(window.location.search).get('tab');
  renderProfile();
  setTab(['found', 'claimed'].includes(startTab) ? startTab : 'lost');
  loadItems();
})();