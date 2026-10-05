document.addEventListener("DOMContentLoaded", function () {
  const list = document.getElementById("recent-items-list");
  if (!list || !window.FindIt) return;

  const items = window.FindIt.getRecentItems(4);

  if (!items.length) {
    list.innerHTML = '<p class="recent-empty">No items have been reported yet.</p>';
    return;
  }

  list.innerHTML = items.map(renderRow).join("");
});

function renderRow(item) {
  const kind = item.status === "returned"
    ? "RESOLVED"
    : item.type === "found"
      ? "FOUND ITEM"
      : "LOST ITEM";

  const statusLabel = item.status === "returned"
    ? "Returned"
    : item.type === "found"
      ? "Found"
      : "Lost";

  const statusClass = item.status === "returned"
    ? "status-returned"
    : item.type === "found"
      ? "status-found"
      : "status-lost";

  const iconClass = item.status === "returned"
    ? "recent-icon--resolved"
    : item.type === "found"
      ? "recent-icon--found"
      : "recent-icon--lost";

  const detailsHref = "pages/item-details.html?id=" + encodeURIComponent(item.id);
  const safeTitle = escapeHtml(item.title);
  const safeLocation = escapeHtml(item.location || "Campus");

  return (
    '<article class="recent-row">' +
      '<div class="recent-icon ' + iconClass + '" aria-hidden="true"></div>' +
      '<div class="recent-meta">' +
        '<span class="recent-kind">' + kind + "</span>" +
        "<h4>" + safeTitle + "</h4>" +
        '<p class="recent-location">' + safeLocation + "</p>" +
      "</div>" +
      '<div class="recent-side">' +
        '<span class="status-pill ' + statusClass + '">' + statusLabel + "</span>" +
        '<a class="btn btn-view-details" href="' + detailsHref + '">View details</a>' +
      "</div>" +
    "</article>"
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
