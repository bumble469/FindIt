/* =========================================================
   items.js
   Simple localStorage-backed store for all Lost/Found items.
   ========================================================= */

const FindItStore = (() => {
  const KEY = "findit_items";

  function _read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function _write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function generateId() {
    return "ITM-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  }

  return {
    all() { return _read(); },

    byId(id) { return _read().find(i => i.id === id); },

    add(item) {
      const items = _read();
      item.id = item.id || generateId();
      item.createdAt = new Date().toISOString();
      item.history = item.history || [];
      items.push(item);
      _write(items);
      return item;
    },

    update(id, patch) {
      const items = _read();
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return null;
      items[idx] = { ...items[idx], ...patch };
      _write(items);
      return items[idx];
    },

    // Append a history event (used when status changes)
    addHistory(id, event) {
      const items = _read();
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return null;
      items[idx].history.push({
        when: new Date().toISOString(),
        ...event
      });
      _write(items);
      return items[idx];
    },

    remove(id) {
      _write(_read().filter(i => i.id !== id));
    }
  };
})();