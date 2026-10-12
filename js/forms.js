// forms.js – one form for LOST and FOUND reports (saves to PocketBase "items")

const CUSTODY_FIELD = "custody";   // exact name of the custody field in PocketBase
const PB_URL = pb.baseURL;         // pb comes from pb.js
let categoriesFromDb = false;      // true once categories load from PocketBase
let matchItem = null;              // the lost item being matched via "I found this"


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

  /* ---------- Camera ---------- */

// Put a File into the normal photo input so the rest of the form works unchanged
function setPhotoFile(file) {
  const input = document.getElementById("item-photo");
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change"));
}

// Phone photos are often over the 5 MB limit, so shrink them first
async function shrinkImage(file, maxSide, quality) {
  maxSide = maxSide || 1600;
  quality = quality || 0.85;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(function (res) { canvas.toBlob(res, "image/jpeg", quality); });
  return new File([blob], "camera-" + Date.now() + ".jpg", { type: "image/jpeg" });
}

async function openWebcam() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch (err) {
    notify("Could not open the camera. Allow camera access, or choose a file instead.", "error");
    return;
  }

  const dlg = document.createElement("dialog");
  dlg.className = "fi-dialog";
  dlg.innerHTML =
    '<div class="fi-head"><h2>Take a photo</h2>' +
    '<button type="button" class="fi-close" data-cancel aria-label="Close">&times;</button></div>' +
    '<div class="fi-body"><video class="cam-video" autoplay playsinline muted></video>' +
    '<div class="fi-actions fi-actions--end">' +
    '<button type="button" class="fi-btn fi-btn-secondary" data-cancel>Cancel</button>' +
    '<button type="button" class="fi-btn fi-btn-primary" data-shoot>Capture</button></div></div>';
  document.body.appendChild(dlg);

  const video = dlg.querySelector("video");
  video.srcObject = stream;

  dlg.addEventListener("close", function () {
    stream.getTracks().forEach(function (t) { t.stop(); });
    dlg.remove();
  });

  dlg.addEventListener("click", function (e) {
    if (e.target.closest("[data-cancel]")) { dlg.close(); return; }
    if (!e.target.closest("[data-shoot]") || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(function (blob) {
      if (blob) setPhotoFile(new File([blob], "camera-" + Date.now() + ".jpg", { type: "image/jpeg" }));
      dlg.close();
    }, "image/jpeg", 0.9);
  });

  dlg.showModal();
}

function setupCamera() {
  const btn = document.getElementById("btn-camera");
  const camInput = document.getElementById("item-photo-camera");

  camInput.addEventListener("change", async function () {
    const file = camInput.files[0];
    camInput.value = "";
    if (!file) return;
    try {
      setPhotoFile(await shrinkImage(file));
    } catch (err) {
      notify("Could not read that photo. Please try again.", "error");
    }
  });

  document.getElementById("btn-gallery").addEventListener("click", function () {
    document.getElementById("item-photo").click();
  });
  
  btn.addEventListener("click", function () {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const hasWebcam = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (isTouch || !hasWebcam) camInput.click();
    else openWebcam();
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
    let note = "";
    if (matchItem && type === "FOUND") note = await updateMatchedItem(record);
    notify("Report submitted! Saved for " + when.toLocaleString() + " (ID: " + record.id + ")." + note);
    if (matchItem) {
      matchItem = null;
      setTimeout(function () { window.location.href = "items.html"; }, 3000);
    }
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


/* ---------- Block "I found this" on your own lost item ---------- */

async function checkMatch() {
  const matchId = new URLSearchParams(window.location.search).get("match");
  if (!matchId || !isLoggedIn()) return;
  try {
    const rec = await pb.collection("items").getOne(matchId);
    if (rec.reported_by === getCurrentUser().id) {
      notify("You can't report your own lost item as found.", "error");
      document.querySelector('#form-report button[type="submit"]').disabled = true;
      setTimeout(function () { window.location.href = "items.html"; }, 2500);
    }
  } catch (err) { /* form still works */ }
}


/* ---------- "I found this": prefill from the lost item + update its record ---------- */

async function prefillFromMatch() {
  const matchId = new URLSearchParams(window.location.search).get("match");
  if (!matchId || !isLoggedIn()) return;

  try {
    const rec = await pb.collection("items").getOne(matchId);
    const me = getCurrentUser();

    if (rec.type !== "LOST") {
      notify("That report is not a lost item, so it can't be matched.", "error");
      return;
    }
    if (rec.reported_by === me.id) {
      notify("You can't report your own lost item as found.", "error");
      document.querySelector('#form-report button[type="submit"]').disabled = true;
      setTimeout(function () { window.location.href = "items.html"; }, 2500);
      return;
    }
    if (rec.status === "RESOLVED") {
      notify("This lost item has already been recovered.", "error");
      return;
    }

    matchItem = rec;

    document.querySelector('input[name="type"][value="FOUND"]').checked = true;
    updateFormForType();

    document.getElementById("item-name").value = rec.item_name || "";
    document.getElementById("item-description").value = rec.description || "";
    if (categoriesFromDb && rec.category) {
      document.getElementById("item-category").value = rec.category;
    }

    notify("Details filled in from the lost report \"" + (rec.item_name || "item") + "\". Check them, then add where and when you found it.", "success");
  } catch (err) {
    console.error("Could not load the lost item to match:", err);
    notify("Could not load the lost item details. You can still fill the form in yourself.", "error");
  }
}

// After the FOUND report is saved: confirm it exists, mark the lost item as matched, then re-read it to verify
async function updateMatchedItem(found) {
  const me = getCurrentUser();

  try {
    const saved = await pb.collection("items").getOne(found.id);
    if (saved.type !== "FOUND" || saved.reported_by !== me.id) {
      return " Warning: the new found report could not be verified.";
    }

    await pb.collection("items").update(matchItem.id, { status: "CLAIMED", claimed_by: me.id });

    const check = await pb.collection("items").getOne(matchItem.id);
    if (check.status === "CLAIMED" && check.claimed_by === me.id) {
      return " The lost item is now marked as 'Match found'.";
    }
    return " Warning: the lost item was not updated (its status is still " + check.status + ").";
  } catch (err) {
    console.error("Could not update the matched lost item:", err);
    const reason = (err.response && err.response.message) || err.message;
    return " The report was saved, but the lost item could not be updated: " + reason;
  }
}

/* ---------- Start ---------- */

document.addEventListener("DOMContentLoaded", async function () {
  const wanted = (new URLSearchParams(window.location.search).get("type") || "").toUpperCase();
  const radio = document.querySelector('input[name="type"][value="' + wanted + '"]');
  if (radio) radio.checked = true;

  updateFormForType();
  setupPhotoPreview();
  setupCamera();
  setupForm();

  try {
    await pb.health.check();
  } catch (err) {
    notify("Cannot reach PocketBase at " + PB_URL + ". Is it running?", "error");
    return;
  }
  await loadCategories();
  await prefillFromMatch();
  checkMatch();
});