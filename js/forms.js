/* =========================================================
   forms.js — one form for LOST and FOUND reports
   Saves to the PocketBase "items" collection.
   ========================================================= */

/* ---------- 0. SETTINGS (change these if needed) ---------- */

const PB_URL = "http://127.0.0.1:8090";   // address of your PocketBase (see the dashboard URL)
const CUSTODY_FIELD = "custody";          // exact name of the custody field in PocketBase
const REQUIRE_LOGIN = false;              // set to true once real user login works

// TEMPORARY, for development only (same login that items.js uses).
// Anyone who opens this file can read the password, so remove this
// and use real user login before the site is shared or deployed.
const USE_DEV_ADMIN = true;
const DEV_ADMIN_EMAIL = "findit@admin.com";
const DEV_ADMIN_PASSWORD = "Admin@123";

// (for example lowercase "lost"), change the right-hand side here.
const DEPOSIT_TYPE_FIELD = "deposit_type";
const DEPOSIT_TYPE_VALUES = { LOST: "LOST", FOUND: "FOUND" };

 
// If the PocketBase library failed to load, `PocketBase` does not exist
const sdkLoaded = typeof PocketBase !== "undefined";
const pb = sdkLoaded ? new PocketBase(PB_URL) : null;
// Logs in once (if not already logged in) so PocketBase accepts our requests
// If two parts of the page ask to log in at the same moment, PocketBase
// cancels the first request. So we keep ONE login in progress and let
// everyone wait for that same one.
let loginInProgress = null;
 
function ensureAuth() {
  if (pb.authStore.isValid || !USE_DEV_ADMIN) return Promise.resolve();
 
  if (!loginInProgress) {
    loginInProgress = loginWithFetch()
      .finally(function () { loginInProgress = null; });
  }
  return loginInProgress;
}
 
// Same kind of login request that items.js already uses successfully.
// Afterwards we give the token to the PocketBase library (authStore.save)
// so that all later requests are sent as the logged-in user.
async function loginWithFetch() {
  const response = await fetch(
    PB_URL + "/api/collections/_superusers/auth-with-password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: DEV_ADMIN_EMAIL,
        password: DEV_ADMIN_PASSWORD
      })
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error("Login failed: " + response.status + " - " + data.message);
  }
  pb.authStore.save(data.token, data.record);
}
 
let categoriesFromDb = false;             // becomes true if categories load from PocketBase
 
 
/* ---------- 1. MESSAGES (always visible) ---------- */
 
// Shows a message in the banner above the buttons AND as a pop-up
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
  form.querySelectorAll(".field").forEach(function (f) {
    f.classList.remove("has-error");
  });
  form.querySelectorAll(".error-msg").forEach(function (m) {
    m.textContent = "";
  });
}
 
 
/* ---------- 2. CATEGORIES (dropdown) ---------- */
/* Tries to load categories from PocketBase. If the "categories"
   collection doesn't exist yet, it falls back to a fixed list
   (and then category is NOT saved, because the database needs a
   real category ID). */
 
async function loadCategories() {
  const select = document.getElementById("item-category");
  try {
    const list = await pb.collection("categories").getFullList();
    console.log("Categories from PocketBase:", list);
    if (list.length === 0) {
      throw new Error("The categories collection has no records yet");
    }
    list.forEach(function (c) {
      // text shown to the user, and the record ID that gets saved
      select.add(new Option(c.name || c.title || c.label || c.id, c.id));
    });
    categoriesFromDb = true;
  } catch (err) {
    console.warn("Could not load categories from PocketBase:", err);
    // No categories in the database yet, so hide the field completely.
    // It will appear by itself once the "categories" collection has records.
    select.closest(".field").hidden = true;
  }
}
 
 
/* ---------- 3. SHOW / HIDE LOST-ONLY AND FOUND-ONLY PARTS ---------- */
 
function updateFormForType() {
  const chosen = document.querySelector('input[name="type"]:checked').value;
  document.querySelectorAll("[data-only]").forEach(function (block) {
    block.hidden = block.dataset.only !== chosen;
  });
}
 
 
/* ---------- 4. PHOTO PREVIEW WITH A SMALL CROSS ---------- */
 
function clearPhoto() {
  document.getElementById("item-photo").value = "";        // forget the chosen file
  document.getElementById("photo-preview").innerHTML = ""; // remove thumbnail + cross
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
 
    // a wrapper holding the picture and the little × button
    const chip = document.createElement("div");
    chip.className = "photo-chip";
 
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "preview-thumb";
    img.alt = "Selected photo";
 
    const cross = document.createElement("button");
    cross.type = "button";                 // "button" so it does not submit the form
    cross.className = "photo-remove";
    cross.setAttribute("aria-label", "Remove photo");
    cross.textContent = "×";
    cross.addEventListener("click", clearPhoto);
 
    chip.appendChild(img);
    chip.appendChild(cross);
    preview.appendChild(chip);
  });
}
 
 
/* ---------- 5. THE FORM ---------- */
 
async function handleSubmit(form) {
  clearAllErrors(form);
  hideStatus();
 
  /* --- read the inputs --- */
  const type        = form.querySelector('input[name="type"]:checked').value;
  const nameEl      = document.getElementById("item-name");
  const categoryEl  = document.getElementById("item-category");
  const descEl      = document.getElementById("item-description");
  const dateEl      = document.getElementById("item-date");
  const timeEl      = document.getElementById("item-time");
  const locationEl  = document.getElementById("item-location");
  const photoEl     = document.getElementById("item-photo");
  const identEl     = document.getElementById("item-identifying");
  const custodyEl   = form.querySelector('input[name="custody"]:checked');
 
  /* --- validate --- */
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
 
  // category is only required once categories really exist in the database
  if (categoriesFromDb && !categoryEl.value) {
    showError(categoryEl, "Please select a category");
    ok = false;
  }
 
  // combine date + time into one value (time is optional, defaults to 00:00)
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
 
  // found items must say where the item is now
  if (type === "FOUND" && !custodyEl) {
    showError(form.querySelector('input[name="custody"]'),
              "Please say where the item is now");
    ok = false;
  }
 
  if (!ok) {
    notify("Please fix the highlighted fields.", "error");
    return;
  }
 
  if (!pb) {
    notify("The PocketBase library did not load. Check your internet and the script tag order.", "error");
    return;
  }
  if (REQUIRE_LOGIN && !pb.authStore.isValid && !USE_DEV_ADMIN) {
    notify("Please log in before reporting an item.", "error");
    return;
  }
 
  try {
    await ensureAuth();
  } catch (err) {
    console.error("Login to PocketBase failed:", err);
    notify("Could not log in to PocketBase. Check the email and password in forms.js.", "error");
    return;
  }
 
  /* --- build the data to send --- */
  // FormData is used because we may be uploading a file
  const body = new FormData();
  body.append("item_name",   nameEl.value.trim());
  body.append("description", descEl.value.trim());
  body.append("location",    locationEl.value.trim());
  body.append("type",        type);        // "LOST" or "FOUND"
  body.append("status",      "OPEN");      // every new report starts open
  // PocketBase stores dates in UTC, so we convert the local time to UTC text
  body.append("datetime",    when.toISOString().replace("T", " "));
 
  if (categoriesFromDb) {
    body.append("category", categoryEl.value);   // a category record ID
  }
  if (type === "LOST") {
    // the JSON field wants text, so we convert the object to text
    body.append("item_specs", JSON.stringify({
      identifying: identEl.value.trim()
    }));
  }
  if (type === "FOUND") {
    body.append(CUSTODY_FIELD, custodyEl.value);
  }
  // reported_by points to the "users" collection, so only a real user
  // can go here (the superuser is not in that collection)
  const loggedIn = pb.authStore.record;
  if (loggedIn && loggedIn.collectionName === "users") {
    body.append("reported_by", loggedIn.id);
  }
  if (photoEl.files[0]) {
    body.append("image", photoEl.files[0]);
  }
 
  /* --- send it --- */
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;                       // prevent double clicks
 
  try {
    const record = await pb.collection("items").create(body);
    console.log("Saved record:", record);
    notify("Report submitted! Saved for " + when.toLocaleString() + " (ID: " + record.id + ")");
    form.reset();
    clearPhoto();
    updateFormForType();
  } catch (err) {
    console.error("PocketBase error:", err);
 
    let detail = err.message;
    if (err.status === 0) {
      detail = "Cannot reach PocketBase at " + PB_URL + ". Is it running, and is the address right?";
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
    e.preventDefault();          // stop the browser's normal page reload
    try {
      await handleSubmit(form);
    } catch (err) {              // any unexpected bug is shown on the page too
      console.error(err);
      notify("Unexpected error: " + err.message, "error");
      form.querySelector('button[type="submit"]').disabled = false;
    }
  });
 
  form.addEventListener("reset", function () {
    clearAllErrors(form);
    hideStatus();
    clearPhoto();
    setTimeout(updateFormForType, 0);          // run after the reset finishes
  });
 
  document.querySelectorAll('input[name="type"]').forEach(function (radio) {
    radio.addEventListener("change", updateFormForType);
  });
}
 
 
/* ---------- 6. START EVERYTHING ---------- */
 
document.addEventListener("DOMContentLoaded", async function () {
  console.log("forms.js loaded. PocketBase address:", PB_URL);
  console.log("This page is open at:", window.location.href);
 
  // ?type=FOUND in the page address preselects "found"
  const wanted = (new URLSearchParams(window.location.search).get("type") || "").toUpperCase();
  const radio = document.querySelector('input[name="type"][value="' + wanted + '"]');
  if (radio) radio.checked = true;
 
  updateFormForType();
  setupPhotoPreview();
  setupForm();
 
  if (!pb) {
    notify("The PocketBase library did not load. Check your internet and the script tag order.", "error");
    return;
  }
 
  // 1. does PocketBase answer at PB_URL?
  try {
    await pb.health.check();
  } catch (err) {
    notify("Cannot reach PocketBase at " + PB_URL + ". Open your PocketBase dashboard and use its address in forms.js.", "error");
    return;
  }
 
  // 2. log in (needed because the collections are not public)
  try {
    await ensureAuth();
  } catch (err) {
    console.error("Login to PocketBase failed:", err);
    notify("Could not log in to PocketBase. Check the email and password in forms.js.", "error");
  }
 
  // 3. fill the category dropdown
  loadCategories();
});
