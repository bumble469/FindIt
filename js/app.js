(function () {
  const STORAGE_KEY = "findit_items";

  const seedItems = [
    {
      id: "fi-1",
      type: "lost",
      status: "open",
      title: "Samsung Galaxy S23",
      category: "Electronics",
      location: "Library, 2nd floor",
      description: "Black Samsung Galaxy S23 with a cracked screen protector. Last seen near the quiet study desks.",
      reportedAt: "2026-10-05T09:20:00Z"
    },
    {
      id: "fi-2",
      type: "found",
      status: "open",
      title: "Brown Leather Wallet",
      category: "Personal",
      location: "Cafeteria",
      description: "Brown leather wallet found under a table near the coffee counter. No cash inside; student ID visible.",
      reportedAt: "2026-10-05T08:05:00Z"
    },
    {
      id: "fi-3",
      type: "lost",
      status: "returned",
      title: "Student ID Card",
      category: "Documents",
      location: "Main Gate",
      description: "University student ID card. Returned to the campus office and collected by the owner.",
      reportedAt: "2026-10-04T16:40:00Z"
    },
    {
      id: "fi-4",
      type: "found",
      status: "open",
      title: "Blue Milton Flask",
      category: "Accessories",
      location: "Computer Science Lab",
      description: "Blue insulated flask with a university sticker. Left on a lab bench after the afternoon session.",
      reportedAt: "2026-10-04T14:10:00Z"
    }
  ];

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (err) {
      console.warn("FindIt: could not read saved items", err);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedItems));
    return seedItems.slice();
  }

  function getRecentItems(limit) {
    const count = typeof limit === "number" ? limit : 4;
    return loadItems()
      .slice()
      .sort(function (a, b) {
        return new Date(b.reportedAt) - new Date(a.reportedAt);
      })
      .slice(0, count);
  }

  function getItemById(id) {
    if (!id) return null;
    return loadItems().find(function (item) {
      return String(item.id) === String(id);
    }) || null;
  }

  window.FindIt = {
    getRecentItems: getRecentItems,
    getItemById: getItemById,
    getAllItems: loadItems
  };
})();
