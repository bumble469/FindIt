// dashboard.js – Home page: recent items + live stats (PocketBase)

document.addEventListener("DOMContentLoaded", () => {
  loadRecent();
  loadStats();
});

const POCKETBASE_URL = "http://127.0.0.1:8090";
const ITEMS_API = `${POCKETBASE_URL}/api/collections/items/records`;


async function loadRecent() {
  const list = document.getElementById("recent-items-list");
  if (!list) return;

  try {
    const response = await fetch(
      `${ITEMS_API}?sort=-datetime&perPage=8`
    );

    if (!response.ok) {
      throw new Error(`PocketBase request failed: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];

    list.innerHTML = items.length
      ? items.map(renderRow).join("")
      : '<p class="recent-empty">No items have been reported yet.</p>';

  } catch (error) {
    console.error("Failed to load recent items:", error);
    list.innerHTML =
      '<p class="recent-empty">Unable to load recent items.</p>';
  }
}

function renderRow(rec) {
  const isFound = rec.type === "FOUND";
  const isResolved = rec.status === "RESOLVED";
  const isClaimed = rec.status === "CLAIMED";

  let kind;
  let label;
  let pill;
  let iconClass;

  if (isResolved) {
    kind = "RESOLVED";
    label = "Resolved";
    pill = "status-returned";
    iconClass = "recent-icon--resolved";
  } else if (isClaimed) {
    kind = isFound ? "FOUND ITEM" : "LOST ITEM";
    label = "Pending";
    pill = "status-pending";
    iconClass = isFound
      ? "recent-icon--found"
      : "recent-icon--lost";
  } else if (isFound) {
    kind = "FOUND ITEM";
    label = "Found";
    pill = "status-found";
    iconClass = "recent-icon--found";
  } else {
    kind = "LOST ITEM";
    label = "Lost";
    pill = "status-lost";
    iconClass = "recent-icon--lost";
  }

  const title = escapeHTML(rec.item_name || "Untitled item");
  const location = escapeHTML(rec.location || "Campus");

  const detailsHref =
    "pages/item-details.html?id=" + encodeURIComponent(rec.id);

  const image = Array.isArray(rec.image)
    ? rec.image[0]
    : rec.image;

  const thumb = image
    ? `<img src="${POCKETBASE_URL}/api/files/items/${encodeURIComponent(rec.id)}/${encodeURIComponent(image)}" alt="" loading="lazy">`
    : "";

  const dateValue = rec.datetime || rec.created;
  const when = dateValue ? timeAgo(dateValue) : "";

  return `
    <article class="recent-row">
      <div class="recent-icon ${iconClass}" aria-hidden="true">
        ${thumb}
      </div>
      <div class="recent-meta">
        <span class="recent-kind">${kind}</span>
        <h4>${title}</h4>
        <p class="recent-location">
          ${location}${when ? ` · ${when}` : ""}
        </p>
      </div>
      <div class="recent-side">
        <span class="status-pill ${pill}">${label}</span>
        <a class="btn btn-view-details" href="${detailsHref}">
          View details
        </a>
      </div>
    </article>`;
}

/* ---------------- Live stats ---------------- */

async function loadStats() {
  const totalEl = document.getElementById("stat-total");
  if (!totalEl) return;

  const count = async (filter) => {
    const params = new URLSearchParams({
      page: "1",
      perPage: "1",
      fields: "id",
    });

    if (filter) params.set("filter", filter);

    const response = await fetch(`${ITEMS_API}?${params}`);

    if (!response.ok) {
      throw new Error(`PocketBase request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.totalItems;
  };

  try {
    const [total, resolved] = await Promise.all([
      count(""),
      count('status = "RESOLVED"'),
    ]);

    const rate = total
      ? Math.round((resolved / total) * 100)
      : 0;

    countUp(totalEl, total);
    countUp(document.getElementById("stat-resolved"), resolved);
    countUp(document.getElementById("stat-active"), total - resolved);
    countUp(document.getElementById("stat-rate"), rate, "%");

  } catch (error) {
    console.error("Failed to load stats:", error);
  }
}

/* ---------------- Helpers ---------------- */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function timeAgo(dateValue) {
  const date = new Date(
    String(dateValue).includes("T")
      ? dateValue
      : dateValue.replace(" ", "T")
  );

  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

function countUp(el, target, suffix = "") {
  if (!el) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = target + suffix;
    return;
  }

  const start = performance.now();
  const duration = 900;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent =
      Math.round(target * (1 - Math.pow(1 - progress, 3))) + suffix;

    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

