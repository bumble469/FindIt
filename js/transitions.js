/* =========================================================
   transitions.js
   Every status change a Lost/Found item can go through.
   All changes are soft-hide (visible:false) — never hard delete.
   ========================================================= */

const ItemTransitions = (() => {

  /* Internal: apply a status change + log history + soft-hide */
  function _apply(itemId, newStatus, note, { hide = false } = {}) {
    const item = FindItStore.byId(itemId);
    if (!item) {
      showToast("Item not found.", "error");
      return null;
    }
    if (item.status === newStatus) {
      showToast("Item is already in that state.", "error");
      return null;
    }

    const patch = {
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    if (hide) {
      patch.visible = false;
      patch.resolvedAt = patch.updatedAt;
    }

    const updated = FindItStore.update(itemId, patch);
    FindItStore.addHistory(itemId, { status: newStatus, note });
    return updated;
  }

  return {

    /* ---------- FOUND item transitions ---------- */

    // Finder had it → handed it to the Campus Office
    submitToOffice(itemId) {
      const item = FindItStore.byId(itemId);
      if (!item || item.status !== ITEM_STATUS.FOUND_HELD_BY_FINDER) return;
      _apply(
        itemId,
        ITEM_STATUS.FOUND_AT_OFFICE,
        "Submitted to " + CAMPUS_OFFICE.name,
        { hide: false }
      );
      // Stamp the office snapshot at the moment of submission
      FindItStore.update(itemId, { office: { ...CAMPUS_OFFICE } });
      showToast("Updated: Submitted to Campus Office");
    },

    // Office (or finder) confirms the owner got it back → soft-hide
    markFoundClaimed(itemId) {
      _apply(
        itemId,
        ITEM_STATUS.FOUND_CLAIMED,
        "Returned to rightful owner — item hidden from public listings",
        { hide: true }
      );
      showToast("Marked as returned. Item hidden from Browse.");
    },

    /* ---------- LOST item transitions ---------- */

    // Owner recovered their item → soft-hide
    markLostResolved(itemId) {
      _apply(
        itemId,
        ITEM_STATUS.LOST_RESOLVED,
        "Recovered by owner — item hidden from public listings",
        { hide: true }
      );
      showToast("Marked as recovered. Item hidden from Browse.");
    },

    /* ---------- Read-only helpers ---------- */

    // Which action buttons should appear for this item?
    availableActions(item) {
      if (!item || !item.visible) return [];
      const s = item.status;

      if (s === ITEM_STATUS.LOST_ACTIVE) {
        return [{
          label: "I got it back",
          cls:   "btn-primary",
          fn:    "markLostResolved"
        }];
      }
      if (s === ITEM_STATUS.FOUND_HELD_BY_FINDER) {
        return [{
          label: "I submitted it to the office",
          cls:   "btn-primary",
          fn:    "submitToOffice"
        }];
      }
      if (s === ITEM_STATUS.FOUND_AT_OFFICE) {
        return [{
          label: "Owner claimed it",
          cls:   "btn-primary",
          fn:    "markFoundClaimed"
        }];
      }
      return [];
    }
  };
})();