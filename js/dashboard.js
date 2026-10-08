document.addEventListener("DOMContentLoaded", async function () {
  const list = document.getElementById("recent-items-list");

  if (!list) return;

  const POCKETBASE_URL = "http://127.0.0.1:8090";
  const ITEMS_API =
    `${POCKETBASE_URL}/api/collections/items/records`;

  try {
    const response = await fetch(
      `${ITEMS_API}?sort=-datetime&perPage=50`
    );

    if (!response.ok) {
      throw new Error(
        `PocketBase request failed: ${response.status}`
      );
    }

    const data = await response.json();

    const items = data.items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.item_name,
      location: item.location,
      status: item.status,
      date: item.datetime,
    }));

    if (!items.length) {
      list.innerHTML =
        '<p class="recent-empty">No items have been reported yet.</p>';
      return;
    }

    list.innerHTML = items.map(renderRow).join("");

  } catch (error) {
    console.error("Failed to load recent items:", error);

    list.innerHTML =
      '<p class="recent-empty">Unable to load recent items.</p>';
  }
});


function renderRow(item) {

  const isResolved = item.status === "RESOLVED";
  const isFound = item.type === "FOUND";

  let kind;
  let statusLabel;
  let statusClass;
  let iconClass;

  if (isResolved) {
    kind = "RESOLVED";
    statusLabel = "Resolved";
    statusClass = "status-returned";
    iconClass = "recent-icon--resolved";

  } else if (isFound) {
    kind = "FOUND ITEM";
    statusLabel = "Found";
    statusClass = "status-found";
    iconClass = "recent-icon--found";

  } else {
    kind = "LOST ITEM";
    statusLabel = "Lost";
    statusClass = "status-lost";
    iconClass = "recent-icon--lost";
  }

  const detailsHref =
    "pages/item-details.html?id=" +
    encodeURIComponent(item.id);

  const safeTitle =
    escapeHtml(item.title);

  const safeLocation =
    escapeHtml(item.location || "Campus");

  return (
    '<article class="recent-row">' +

      '<div class="recent-icon ' +
        iconClass +
        '" aria-hidden="true"></div>' +

      '<div class="recent-meta">' +

        '<span class="recent-kind">' +
          kind +
        "</span>" +

        "<h4>" +
          safeTitle +
        "</h4>" +

        '<p class="recent-location">' +
          safeLocation +
        "</p>" +

      "</div>" +

      '<div class="recent-side">' +

        '<span class="status-pill ' +
          statusClass +
          '">' +
          statusLabel +
        "</span>" +

        '<a class="btn btn-view-details" href="' +
          detailsHref +
        '">' +
          "View details" +
        "</a>" +

      "</div>" +

    "</article>"
  );
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}