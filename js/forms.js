// forms.js – one form for LOST and FOUND reports (saves to PocketBase "items")

const CUSTODY_FIELD = "custody";   // exact name of the custody field in PocketBase
const PB_URL = pb.baseURL;         // pb comes from pb.js
let categoriesFromDb = false;      // true once categories load from PocketBase


/* ---------- Messages ---------- */

function notify(message, type) {
  type = type || "success";

  const banner = document.getElementById("form-status");
  if (banner) {
    banner.textContent = message;
    banner.className = "form-status " + type;
    banner.hidden = false;
  }

  let toast = document.getElementById("findit-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "findit-toast";
    document.body.appendChild(toast);
  }
  toast.className = "findit-toast " + type;
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(function () { toast.classList.remove("visible"); }, 4000);
}

function hideStatus() {
  const banner = document.getElementById("form-status");
  if (banner) banner.hidden = true;
}

function showError(inputEl, message) {
  const wrap = inputEl.closest(".field");
  if (!wrap) return;
  wrap.classList.add("has-error");
  let msg = wrap.querySelector(".error-msg");
  if (!msg) {
    msg = document.createElement("div");
    msg.className = "error-msg";
    wrap.appendChild(msg);
  }
  msg.textContent = message;
}

function clearAllErrors(form) {
  form.querySelectorAll(".field").forEach(function (f) { f.classList.remove("has-error"); });
  form.querySelectorAll(".error-msg").forEach(function (m) { m.textContent = ""; });
}


/* ---------- Categories ---------- */

// If the categories collection is empty or missing, the field is hidden
// and the category is not saved (the database needs a real category ID).
async function loadCategories() {
  const select = document.getElementById("item-category");
  try {
    const list = await pb.collection("categories").getFullList();
    if (list.length === 0) throw new Error("The categories collection has no records yet");

    list.forEach(function (c) {
      select.add(new Option(c.name || c.title || c.label || c.id, c.id));
    });
    categoriesFromDb = true;
  } catch (err) {
    console.warn("Could not load categories from PocketBase:", err);
    select.closest(".field").hidden = true;
  }
}


/* ---------- Lost-only / found-only fields ---------- */

function updateFormForType() {
  const chosen = document.querySelector('input[name="type"]:checked').value;
  document.querySelectorAll("[data-only]").forEach(function (block) {
    block.hidden = block.dataset.only !== chosen;
  });
}


/* ---------- Photo preview ---------- */

function clearPhoto() {
  document.getElementById("item-photo").value = "";
  document.getElementById("photo-preview").innerHTML = "";
}

function setupPhotoPreview() {
  const input = document.getElementById("item-photo");
  const preview = document.getElementById("photo-preview");

  input.addEventListener("change", function () {
    preview.innerHTML = "";
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      notify("Please choose an image under 5 MB.", "error");
      input.value = "";
      return;
    }

    const chip = document.createElement("div");
    chip.className = "photo-chip";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "preview-thumb";
    img.alt = "Selected photo";

    const cross = document.createElement("button");
    cross.type = "button";
    cross.className = "photo-remove";
    cross.setAttribute("aria-label", "Remove photo");
    cross.textContent = "×";
    cross.addEventListener("click", clearPhoto);

    chip.appendChild(img);
    chip.appendChild(cross);
    preview.appendChild(chip);
  });
}


/* ---------- Submit ---------- */

async function handleSubmit(form) {
  clearAllErrors(form);
  hideStatus();

  const type       = form.querySelector('input[name="type"]:checked').value;
  const nameEl     = document.getElementById("item-name");
  const categoryEl = document.getElementById("item-category");
  const descEl     = document.getElementById("item-description");
  const dateEl     = document.getElementById("item-date");
  const timeEl     = document.getElementById("item-time");
  const locationEl = document.getElementById("item-location");
  const photoEl    = document.getElementById("item-photo");
  const identEl    = document.getElementById("item-identifying");
  const custodyEl  = form.querySelector('input[name="custody"]:checked');

  let ok = true;

  [
    [nameEl,     "Item name is required"],
    [descEl,     "Description is required"],
    [dateEl,     "Date is required"],
    [locationEl, "Location is required"]
  ].forEach(function (pair) {
    if (!pair[0].value.trim()) {
      showError(pair[0], pair[1]);
      ok = false;
    }
  });

  if (categoriesFromDb && !categoryEl.value) {
    showError(categoryEl, "Please select a category");
    ok = false;
  }

  // date + optional time -> one value (time defaults to 00:00)
  let when = null;
  if (dateEl.value) {
    when = new Date(dateEl.value + "T" + (timeEl.value || "00:00"));
    if (isNaN(when.getTime())) {
      showError(dateEl, "That date/time is not valid");
      ok = false;
    } else if (when > new Date()) {
      showError(dateEl, "Date/time cannot be in the future");
      ok = false;
    }
  }

  if (type === "FOUND" && !custodyEl) {
    showError(form.querySelector('input[name="custody"]'), "Please say where the item is now");
    ok = false;
  }

  if (!ok) {
    notify("Please fix the highlighted fields.", "error");
    return;
  }

  if (!isLoggedIn()) {
    notify("Please log in before reporting an item.", "error");
    return;
  }

  // FormData because a file may be uploaded
  const body = new FormData();
  body.append("item_name",   nameEl.value.trim());
  body.append("description", descEl.value.trim());
  body.append("location",    locationEl.value.trim());
  body.append("type",        type);                                     // "LOST" or "FOUND"
  body.append("status",      "OPEN");
  body.append("datetime",    when.toISOString().replace("T", " "));     // PocketBase stores UTC
  body.append("reported_by", getCurrentUser().id);

  if (categoriesFromDb) body.append("category", categoryEl.value);
  if (type === "LOST") {
    body.append("item_specs", JSON.stringify({ identifying: identEl.value.trim() }));
  }
  if (type === "FOUND") body.append(CUSTODY_FIELD, custodyEl.value);
  if (photoEl.files[0]) body.append("image", photoEl.files[0]);

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    const record = await pb.collection("items").create(body);
    notify("Report submitted! Saved for " + when.toLocaleString() + " (ID: " + record.id + ")");
    form.reset();
    clearPhoto();
    updateFormForType();
  } catch (err) {
    console.error("PocketBase error:", err);

    let detail = err.message;
    if (err.status === 0) {
      detail = "Cannot reach PocketBase at " + PB_URL + ". Is it running?";
    } else if (err.response && err.response.data && Object.keys(err.response.data).length) {
      const fields = err.response.data;
      detail = Object.keys(fields).map(function (k) {
        return k + ": " + fields[k].message;
      }).join(" | ");
    } else if (err.response && err.response.message) {
      detail = err.response.message;
    }
    notify("Could not save. " + detail, "error");
  } finally {
    btn.disabled = false;
  }
}

function setupForm() {
  const form = document.getElementById("form-report");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      await handleSubmit(form);
    } catch (err) {
      console.error(err);
      notify("Unexpected error: " + err.message, "error");
      form.querySelector('button[type="submit"]').disabled = false;
    }
  });

  form.addEventListener("reset", function () {
    clearAllErrors(form);
    hideStatus();
    clearPhoto();
    setTimeout(updateFormForType, 0);   // run after the reset finishes
  });

  document.querySelectorAll('input[name="type"]').forEach(function (radio) {
    radio.addEventListener("change", updateFormForType);
  });
}


/* ---------- Start ---------- */

document.addEventListener("DOMContentLoaded", async function () {
  // ?type=FOUND or ?type=LOST in the address preselects the type
  const wanted = (new URLSearchParams(window.location.search).get("type") || "").toUpperCase();
  const radio = document.querySelector('input[name="type"][value="' + wanted + '"]');
  if (radio) radio.checked = true;

  updateFormForType();
  setupPhotoPreview();
  setupForm();

  try {
    await pb.health.check();
  } catch (err) {
    notify("Cannot reach PocketBase at " + PB_URL + ". Is it running?", "error");
    return;
  }

  loadCategories();
});