/* =========================================================
   item-actions.js
   Shared logic for Report Lost + Report Found pages.
   - Item creation (with userId tagging for future auth)
   - "My items" filter (per type)
   - Status transitions + history
   ========================================================= */

/* ---------- 1. USER (temporary until auth is built) ---------- */
/* When login/signup is implemented, replace the line below with:
     const CURRENT_USER_ID = getCurrentUser().id;
   Nothing else in this file needs to change. */
const CURRENT_USER_ID = "guest";


/* ---------- 2. STATUS CONSTANTS ---------- */

const ITEM_STATUS = {
  LOST_ACTIVE:          "LOST_ACTIVE",
  LOST_RESOLVED:        "LOST_RESOLVED",
  FOUND_HELD_BY_FINDER: "FOUND_HELD_BY_FINDER",
  FOUND_AT_OFFICE:      "FOUND_AT_OFFICE",
  FOUND_CLAIMED:        "FOUND_CLAIMED"
};

const STATUS_LABEL = {
  LOST_ACTIVE:          "LOST — ACTIVE",
  LOST_RESOLVED:        "LOST — RECOVERED",
  FOUND_HELD_BY_FINDER: "FOUND — HELD BY FINDER",
  FOUND_AT_OFFICE:      "FOUND — AT CAMPUS OFFICE",
  FOUND_CLAIMED:        "FOUND — CLAIMED / RETURNED"
};


/* ---------- 3. THE SINGLE OFFICIAL CAMPUS OFFICE ---------- */

const CAMPUS_OFFICE = {
  name:    "Campus Lost & Found Office",
  address: "Student Services Building, Ground Floor, Room 12",
  hours:   "Mon–Fri, 9:00 AM – 5:00 PM",
  contact: "lostfound@campus.edu"
};


/* =========================================================
   4. STORE HELPERS (read / write localStorage)
   ========================================================= */

const Items = (() => {
  const KEY = "findit_items";

  function _read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function _write(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  function _id() {
    return "ITM-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  }

  return {
    all() { return _read(); },

    byId(id) { return _read().find(i => i.id === id); },

    /* Only THIS user's items, filtered by type ("lost" | "found") */
    myItems(type) {
      return _read()
        .filter(i => i.userId === CURRENT_USER_ID && i.type === type)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    /* Create a new item with all required default fields */
    create(partial) {
      const list = _read();
      const item = {
        id:        _id(),
        userId:    CURRENT_USER_ID,
        visible:   true,
        createdAt: new Date().toISOString(),
        history:   [],
        ...partial
      };
      list.push(item);
      _write(list);
      return item;
    },

    update(id, patch) {
      const list = _read();
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch };
      _write(list);
      return list[idx];
    },

    /* Append a timestamped event to the item's history */
    logHistory(id, { status, note }) {
      const list = _read();
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) return null;
      list[idx].history.push({
        when: new Date().toISOString(),
        status,
        note
      });
      _write(list);
      return list[idx];
    }
  };
})();


/* =========================================================
   5. STATUS TRANSITIONS
   Each one: updates status, logs history, soft-hides if resolved.
   ========================================================= */

const StatusChange = {

  /* FOUND: finder → office */
  submitToOffice(itemId) {
    const item = Items.byId(itemId);
    if (!item || item.status !== ITEM_STATUS.FOUND_HELD_BY_FINDER) return;

    Items.update(itemId, {
      status:   ITEM_STATUS.FOUND_AT_OFFICE,
      office:   { ...CAMPUS_OFFICE },
      possession: "office",
      updatedAt: new Date().toISOString()
    });
    Items.logHistory(itemId, {
      status: ITEM_STATUS.FOUND_AT_OFFICE,
      note:   "Submitted to " + CAMPUS_OFFICE.name
    });
    return true;
  },

  /* FOUND: office → owner claimed → soft-hide */
  markFoundClaimed(itemId) {
    const item = Items.byId(itemId);
    if (!item || item.status !== ITEM_STATUS.FOUND_AT_OFFICE) return;

    Items.update(itemId, {
      status:     ITEM_STATUS.FOUND_CLAIMED,
      visible:    false,
      resolvedAt: new Date().toISOString()
    });
    Items.logHistory(itemId, {
      status: ITEM_STATUS.FOUND_CLAIMED,
      note:   "Returned to rightful owner — hidden from public listings"
    });
    return true;
  },

  /* LOST: owner recovered → soft-hide */
  markLostRecovered(itemId) {
    const item = Items.byId(itemId);
    if (!item || item.status !== ITEM_STATUS.LOST_ACTIVE) return;

    Items.update(itemId, {
      status:     ITEM_STATUS.LOST_RESOLVED,
      visible:    false,
      resolvedAt: new Date().toISOString()
    });
    Items.logHistory(itemId, {
      status: ITEM_STATUS.LOST_RESOLVED,
      note:   "Recovered by owner — hidden from public listings"
    });
    return true;
  }
};


/* =========================================================
   6. RENDER HELPERS (shared by both pages)
   ========================================================= */

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric"
  });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit"
  });
}

function statusBadge(status) {
  const cls =
    status === ITEM_STATUS.LOST_ACTIVE            ? "badge badge-lost"   :
    status === ITEM_STATUS.LOST_RESOLVED          ? "badge badge-done"   :
    status === ITEM_STATUS.FOUND_HELD_BY_FINDER   ? "badge badge-held"   :
    status === ITEM_STATUS.FOUND_AT_OFFICE        ? "badge badge-office" :
    status === ITEM_STATUS.FOUND_CLAIMED          ? "badge badge-done"   :
                                                    "badge";
  return `<span class="${cls}">${STATUS_LABEL[status] || status}</span>`;
}

function renderHistory(item) {
  if (!item.history || !item.history.length) {
    return `<p class="muted small">No history yet.</p>`;
  }
  const rows = item.history
    .slice()
    .sort((a, b) => new Date(a.when) - new Date(b.when))
    .map(h => `
      <li>
        <span class="hist-date">${fmtDateTime(h.when)}</span>
        <span class="hist-note">${h.note || STATUS_LABEL[h.status] || h.status}</span>
      </li>`).join("");
  return `<ol class="history">${rows}</ol>`;
}
/* =========================================================
   STATUS DROPDOWN — replaces the action buttons
   ========================================================= */

/* What status options can this item move to, from where it is now? */
function allowedStatusOptions(item) {
  const s = item.status;

  if (s === ITEM_STATUS.LOST_ACTIVE) {
    return [
      { value: ITEM_STATUS.LOST_ACTIVE,   label: STATUS_LABEL.LOST_ACTIVE },
      { value: ITEM_STATUS.LOST_RESOLVED, label: "Mark as recovered (hide from public)" }
    ];
  }

  if (s === ITEM_STATUS.FOUND_HELD_BY_FINDER) {
    return [
      { value: ITEM_STATUS.FOUND_HELD_BY_FINDER, label: STATUS_LABEL.FOUND_HELD_BY_FINDER },
      { value: ITEM_STATUS.FOUND_AT_OFFICE,      label: "I submitted it to the office" }
    ];
  }

  if (s === ITEM_STATUS.FOUND_AT_OFFICE) {
    return [
      { value: ITEM_STATUS.FOUND_AT_OFFICE,  label: STATUS_LABEL.FOUND_AT_OFFICE },
      { value: ITEM_STATUS.FOUND_CLAIMED,    label: "Owner claimed it (hide from public)" }
    ];
  }

  /* LOST_RESOLVED / FOUND_CLAIMED — terminal, no more options */
  return [{ value: s, label: STATUS_LABEL[s] || s }];
}

/* Render the dropdown for a card */
function statusDropdown(item) {
  const options = allowedStatusOptions(item);
  const terminal = options.length === 1;

  const optsHTML = options.map(o =>
    `<option value="${o.value}" ${o.value === item.status ? "selected" : ""}>
      ${o.label}
    </option>`
  ).join("");

  return `
    <div class="status-update">
      <label class="status-update-label">Update status:</label>
      <select class="status-select"
              data-status-for="${item.id}"
              ${terminal ? "disabled" : ""}>
        ${optsHTML}
      </select>
    </div>`;
}

/* Card template — same as before, but uses statusDropdown */
function reportCard(item, _unusedActionHTML) {
  const icon  = item.type === "lost" ? "🔍" : "📦";
  const when  = item.type === "lost"
    ? `Lost on ${fmtDate(item.dateLost)} · ${item.location || "—"}`
    : `Found on ${fmtDate(item.dateFound)} · ${item.location || "—"}`;

  const locationLine = item.type === "found"
    ? `<p class="muted small">Currently: ${
        item.possession === "office" ? CAMPUS_OFFICE.name : "With finder"
      }</p>`
    : "";

  return `
    <article class="status-card ${item.visible ? "" : "is-hidden"}">
      <div class="status-card-head">
        <h3>${icon} ${item.name}</h3>
        ${statusBadge(item.status)}
      </div>
      <p class="muted">${item.category} · ${when}</p>
      ${locationLine}
      <p class="muted small">ID: ${item.id} · Reported ${fmtDate(item.createdAt)}</p>

      <details>
        <summary>History</summary>
        ${renderHistory(item)}
      </details>

      ${statusDropdown(item)}
    </article>`;
}