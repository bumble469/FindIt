// details.js – Item details page (PocketBase). Login required (data-protected).

(function () {
  const root = document.getElementById('item-details');
  if (!root) return;

  const user = getCurrentUser();
  if (!user) return;                         // data-protected sends visitors to the login page

  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');
  const wantsClaim = params.get('claim') === '1';

  /* ---------------- Settings ---------------- */

  const STAGE = { OPEN: 0, CLAIMED: 1, RESOLVED: 2 };

  const PILL = {
    open: 'dt-pill--open',
    office: 'dt-pill--office',
    pending: 'dt-pill--pending',
    returned: 'dt-pill--done',
  };

  const PILL_LABEL = {
    lost:  { open: 'Still missing', office: 'Still missing',    pending: 'Match found',   returned: 'Recovered' },
    found: { open: 'Unclaimed',     office: 'At campus office', pending: 'Claim pending', returned: 'Returned' },
  };

  const LABELS = {
    lost:  { steps: ['Reported', 'Match found', 'Recovered'],    resolve: 'Mark as recovered' },
    found: { steps: ['Reported', 'Claim pending', 'Returned'],   resolve: 'Mark as returned' },
  };

  const CUSTODY_TEXT = { WITH_FINDER: 'With the finder', AT_OFFICE: 'At the campus office' };

  let item = null;
  let busy = false;

  /* ---------------- Back link (remembers where you came from) ---------------- */

  (function setBackLink() {
    const link = document.getElementById('dt-back');
    if (!link || !document.referrer) return;

    try {
      const ref = new URL(document.referrer);
      if (ref.origin !== window.location.origin) return;

      if (/my-items\.html$/.test(ref.pathname)) {
        link.href = 'my-items.html';
        link.querySelector('span').textContent = 'Back to My Items';
      } else if (/\/(index\.html)?$/.test(ref.pathname)) {
        link.href = '../index.html';
        link.querySelector('span').textContent = 'Back to Home';
      }
    } catch (e) { /* keep the default link */ }
  })();

  /* ---------------- Data ---------------- */

  function identifyingText(specs) {
    try {
      const data = typeof specs === 'string' ? JSON.parse(specs) : specs;
      return data && data.identifying ? String(data.identifying).trim() : '';
    } catch (e) {
      return '';
    }
  }

  function mapItem(rec) {
    const type = (rec.type || 'lost').toLowerCase();

    return {
      id: rec.id,
      type,
      title: rec.item_name || 'Untitled item',
      description: rec.description || '',
      category: rec.expand?.category?.name || 'Other',
      location: rec.location || 'Campus',
      date: String(rec.datetime || rec.created).replace(' ', 'T'),
      reportedAt: String(rec.created).replace(' ', 'T'),
      status: rec.status === 'RETURNED' ? 'RESOLVED' : (rec.status || 'OPEN'),
      custody: rec.custody || '',
      isOwner: rec.reported_by === user.id,
      claimedByMe: rec.claimed_by === user.id,
      identifying: identifyingText(rec.item_specs),
      image: rec.image
        ? pb.files.getURL(rec, rec.image)
        : placeholderImage(type === 'lost' ? '🔍' : '📦', type === 'lost' ? '#F3EBDD' : '#E6F0E9'),
    };
  }

  async function loadItem() {
    if (!itemId) return renderState('notfound');

    renderState('loading');

    try {
      const rec = await pb.collection('items').getOne(itemId, { expand: 'category' });
      item = mapItem(rec);
      render();
    } catch (err) {
      console.error('Could not load item:', err);
      if (err.status === 404) renderState('notfound');
      else renderState('error', pbErrorMessage(err));
    }
  }

  /* ---------------- Helpers ---------------- */

  function stageKey(it) {
    if (it.status === 'RESOLVED') return 'returned';
    if (it.status === 'CLAIMED') return 'pending';
    return it.type === 'found' && it.custody === 'AT_OFFICE' ? 'office' : 'open';
  }

  function whenText(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return 'Unknown';
    const date = formatDate(iso);
    return (d.getHours() || d.getMinutes())
      ? date + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : date;
  }

  function noteFor(it) {
    const s = it.status;

    if (it.isOwner) {
      if (it.type === 'lost') {
        return [
          'Still searching. We will flag it in My Items if a match is reported.',
          'A possible match was reported. Check with the campus office.',
          'Great news! You marked this item as recovered.',
        ][STAGE[s] ?? 0];
      }
      if (s === 'CLAIMED') return 'Someone has claimed this item. Verify them at the campus office, then mark it returned.';
      if (s === 'RESOLVED') return 'Returned to its owner. Thank you for helping!';
      if (it.custody === 'AT_OFFICE') return 'This item is at the campus office, waiting for its owner.';
      if (it.custody === 'WITH_FINDER') return 'You are holding this item. Hand it to the campus office when you can.';
      return 'Waiting for its owner to claim it.';
    }

    if (it.type === 'found') {
      if (s === 'RESOLVED') return 'This item has been returned to its owner.';
      if (s === 'CLAIMED') {
        return it.claimedByMe
          ? 'You have claimed this item. Visit the campus office with a photo ID to confirm it is yours.'
          : 'Someone has already claimed this item and is being verified.';
      }
      return it.custody === 'AT_OFFICE'
        ? 'This item is at the campus office. Claim it, then confirm ownership there with a photo ID.'
        : 'The finder is holding this item. Claim it to start the verification process.';
    }

    if (s === 'RESOLVED') return 'This item has been recovered by its owner.';
    if (s === 'CLAIMED') return 'A possible match has been reported for this item.';
    return 'The owner is still looking for this item. If you have it, report it as found.';
  }

  /* ---------------- Rendering ---------------- */

  function trackerHTML(it) {
    const stage = STAGE[it.status] ?? 0;

    return '<ol class="dt-track" aria-label="Status progress">' +
      LABELS[it.type].steps.map((label, i) => {
        const cls = (i < stage || stage === 2) ? 'done' : (i === stage ? 'current' : '');
        return `<li class="${cls}"${cls === 'current' ? ' aria-current="step"' : ''}>${label}</li>`;
      }).join('') +
      '</ol>';
  }

  function actionsHTML(it) {
    const id = escapeHTML(it.id);
    const resolved = it.status === 'RESOLVED';
    const out = [];
    const disabled = (label) => `<button type="button" class="btn btn-outline" disabled>${label}</button>`;

    if (it.isOwner) {
      if (!resolved) {
        if (it.type === 'found' && it.custody === 'WITH_FINDER') {
          out.push(`<button type="button" class="btn btn-outline" data-action="office">Handed to office</button>`);
        }
        out.push(`<button type="button" class="btn btn-primary" data-action="resolve">${LABELS[it.type].resolve}</button>`);
      }
    } else if (it.type === 'found') {
      if (resolved) out.push(disabled('Returned'));
      else if (it.status === 'CLAIMED') out.push(disabled(it.claimedByMe ? 'You claimed this' : 'Claim pending'));
      else out.push(`<button type="button" class="btn btn-primary" data-action="claim" id="claim-btn">Claim this item</button>`);
    } else if (resolved) {
      out.push(disabled('Recovered'));
    } else {
      out.push(`<a class="btn btn-primary" href="report.html?type=FOUND&match=${encodeURIComponent(it.id)}">I found this</a>`);
    }

    if (typeof CAMPUS_OFFICE !== 'undefined' && CAMPUS_OFFICE.contact) {
      const subject = encodeURIComponent('FindIt: ' + it.title + ' (' + it.id + ')');
      out.push(`<a class="btn btn-outline" href="mailto:${escapeHTML(CAMPUS_OFFICE.contact)}?subject=${subject}">Email the office</a>`);
    }

    out.push(`<button type="button" class="btn btn-ghost" data-action="copy">Copy link</button>`);

    if (it.isOwner) {
      out.push(`<button type="button" class="btn btn-ghost dt-danger" data-action="delete">Delete</button>`);
    }

    return out.join('');
  }

  function officeHTML(it) {
    if (typeof CAMPUS_OFFICE === 'undefined') return '';

    const icon = (path) =>
      `<span class="dt-office-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;

    const intro = it.type === 'found'
      ? 'Bring a photo ID and be ready to describe the item. The office confirms every claim before anything is handed over.'
      : 'If you find this item, hand it in at the campus office so its owner can collect it.';

    return `
      <section class="dt-office" aria-label="Campus office">
        <h2>Campus office</h2>
        <p>${intro}</p>
        <ul>
          <li>${icon('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>')}
            <div><strong>Location</strong><span>${escapeHTML(CAMPUS_OFFICE.location)}</span></div></li>
          <li>${icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}
            <div><strong>Opening hours</strong><span>${escapeHTML(CAMPUS_OFFICE.hours)}</span></div></li>
          <li>${icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>')}
            <div><strong>Contact</strong><span>${escapeHTML(CAMPUS_OFFICE.contact)}</span></div></li>
        </ul>
      </section>`;
  }

  function detailHTML(it) {
    const key = stageKey(it);

    const facts = [
      ['Type', it.type === 'lost' ? 'Lost item' : 'Found item'],
      ['Category', it.category],
      ['Location', it.location],
      [it.type === 'lost' ? 'Date lost' : 'Date found', whenText(it.date)],
      ['Reported', timeAgo(it.reportedAt)],
      ['Status', PILL_LABEL[it.type][key]],
    ];
    if (it.type === 'found' && CUSTODY_TEXT[it.custody]) {
      facts.push(['Where it is now', CUSTODY_TEXT[it.custody]]);
    }

    // Identifying details are private: only the person who reported the item sees them here
    const privateBlock = it.isOwner && it.type === 'lost' && it.identifying
      ? `<div class="dt-private">
           <strong>🔒 Your identifying details</strong>
           <p>${escapeHTML(it.identifying)}</p>
           <small>Not shown to other users on this page. Use them to verify the item.</small>
         </div>`
      : '';

    return `
      <article class="dt-card">
        <div class="dt-media">
          <img src="${it.image}" alt="${escapeHTML(it.title)}">
          <div class="dt-pills">
            <span class="dt-pill dt-pill--${it.type}">${it.type === 'lost' ? 'Lost' : 'Found'}</span>
            <span class="dt-pill ${PILL[key]}">${PILL_LABEL[it.type][key]}</span>
          </div>
        </div>

        <div class="dt-info">
          <div class="dt-top">
            <span class="dt-category">${escapeHTML(it.category)}</span>
            ${it.isOwner ? '<span class="dt-owner">Your report</span>' : ''}
          </div>

          <h1 class="dt-title">${escapeHTML(it.title)}</h1>

          <ul class="dt-meta">
            <li><span aria-hidden="true">📍</span> ${escapeHTML(it.location)}</li>
            <li><span aria-hidden="true">📅</span> ${formatDate(it.date)} · ${timeAgo(it.date)}</li>
          </ul>

          ${it.description
            ? `<p class="dt-desc">${escapeHTML(it.description)}</p>`
            : '<p class="dt-desc dt-desc--empty">No description was added.</p>'}

          ${trackerHTML(it)}
          <p class="dt-note">${escapeHTML(noteFor(it))}</p>

          <div class="dt-actions">${actionsHTML(it)}</div>
        </div>
      </article>

      <div class="dt-lower">
        <section class="dt-panel">
          <h2>Item details</h2>
          <dl class="dt-facts">
            ${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}
          </dl>
          ${privateBlock}
        </section>
        ${officeHTML(it)}
      </div>`;
  }

  function renderState(kind, text) {
    const states = {
      loading:  { icon: 'spinner', title: 'Loading item…' },
      notfound: {
        icon: '🔎',
        title: 'Item not found',
        text: 'This report may have been removed or the link is invalid.',
        actions: '<a class="btn btn-primary" href="items.html">Browse items</a>',
      },
      error: {
        icon: '⚠️',
        title: 'Could not load this item',
        text: escapeHTML(text || ''),
        actions: '<button type="button" class="btn btn-primary" data-action="retry">Try again</button>' +
                 '<a class="btn btn-outline" href="items.html">Browse items</a>',
      },
    };
    const s = states[kind];

    root.innerHTML = `
      <div class="dt-state">
        ${s.icon === 'spinner'
          ? '<div class="dt-spinner" aria-hidden="true"></div>'
          : `<div class="dt-state-icon" aria-hidden="true">${s.icon}</div>`}
        <h1>${s.title}</h1>
        ${s.text ? `<p>${s.text}</p>` : ''}
        ${s.actions ? `<div class="dt-state-actions">${s.actions}</div>` : ''}
      </div>`;
  }

  function render() {
    document.title = item.title + ' | FindIt';
    root.innerHTML = detailHTML(item);

    // Coming from the "Claim" button on Browse: draw attention to the claim button
    const claimBtn = document.getElementById('claim-btn');
    if (wantsClaim && claimBtn) {
      claimBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      claimBtn.focus({ preventScroll: true });
      claimBtn.classList.add('dt-pulse');
    }
  }

  /* ---------------- Actions ---------------- */

  let toastTimer;

  function toast(message, type) {
    let el = document.getElementById('dt-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dt-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'dt-toast visible' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
  }

  async function patchItem(data, message, errorOverride) {
    if (busy) return;
    busy = true;

    try {
      const rec = await pb.collection('items').update(item.id, data, { expand: 'category' });
      item = mapItem(rec);
      render();
      toast(message);
    } catch (err) {
      console.error(err);
      const denied = err.status === 403 || err.status === 404;
      toast(denied && errorOverride ? errorOverride : pbErrorMessage(err), 'error');
    }

    busy = false;
  }

  async function removeItem() {
    if (busy) return;
    if (!confirm('Delete this report? This cannot be undone.')) return;
    busy = true;

    try {
      await pb.collection('items').delete(item.id);
      toast('Report deleted.');
      setTimeout(() => { window.location.href = 'my-items.html'; }, 800);
    } catch (err) {
      console.error(err);
      toast(pbErrorMessage(err), 'error');
      busy = false;
    }
  }

  async function copyLink() {
    const url = window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(item.id);
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied.');
    } catch (e) {
      toast('Could not copy the link.', 'error');
    }
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    switch (btn.dataset.action) {
      case 'claim':
        if (confirm('Claim this item? You will need to confirm ownership at the campus office with a photo ID.')) {
          patchItem(
            { status: 'CLAIMED', claimed_by: user.id },
            'Claim sent. Visit the campus office to confirm.',
            'Claiming is not available for this item right now. Please contact the campus office.'
          );
        }
        break;
      case 'resolve':
        patchItem({ status: 'RESOLVED' }, item.type === 'lost' ? 'Marked as recovered.' : 'Marked as returned.');
        break;
      case 'office':
        patchItem({ custody: 'AT_OFFICE' }, 'Updated: item is at the campus office.');
        break;
      case 'delete':
        removeItem();
        break;
      case 'copy':
        copyLink();
        break;
      case 'retry':
        loadItem();
        break;
    }
  });

  /* ---------------- Init ---------------- */

  loadItem();
})();