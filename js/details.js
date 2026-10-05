document.addEventListener("DOMContentLoaded", function () {
  const root = document.getElementById("item-details");
  if (!root || !window.FindIt) return;

  const id = new URLSearchParams(window.location.search).get("id");
  const item = window.FindIt.getItemById(id);

  if (!item) {
    root.innerHTML =
      '<div class="details-empty">' +
        "<h1>Item not found</h1>" +
        "<p>This report may have been removed or the link is invalid.</p>" +
        '<a class="btn btn-primary" href="../index.html">Back to home</a>' +
      "</div>";
    return;
  }

  const kind = item.status === "returned"
    ? "Resolved"
    : item.type === "found"
      ? "Found item"
      : "Lost item";

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

  const reported = item.reportedAt
    ? new Date(item.reportedAt).toLocaleString()
    : "Unknown";

  root.innerHTML =
    '<article class="details-card">' +
      '<p class="details-kicker">' + kind + "</p>" +
      "<h1>" + escapeHtml(item.title) + "</h1>" +
      '<span class="status-pill ' + statusClass + '">' + statusLabel + "</span>" +
      '<dl class="details-meta">' +
        "<div><dt>Category</dt><dd>" + escapeHtml(item.category || "General") + "</dd></div>" +
        "<div><dt>Location</dt><dd>" + escapeHtml(item.location || "Campus") + "</dd></div>" +
        "<div><dt>Reported</dt><dd>" + escapeHtml(reported) + "</dd></div>" +
      "</dl>" +
      "<p class=\"details-copy\">" + escapeHtml(item.description || "") + "</p>" +
      '<a class="btn btn-primary" href="../index.html">Back to home</a>' +
    "</article>";
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
