/* =========================================================
   forms.js
   Handles Report Lost + Report Found forms AND
   re-renders the user's own past submissions inline.
   Requires: item-actions.js loaded first.
   ========================================================= */

/* ---------- Small UI helpers ---------- */

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

function clearError(inputEl) {
  const wrap = inputEl.closest(".field");
  if (!wrap) return;
  wrap.classList.remove("has-error");
  const msg = wrap.querySelector(".error-msg");
  if (msg) msg.textContent = "";
}

function clearAllErrors(form) {
  form.querySelectorAll(".field").forEach(f => f.classList.remove("has-error"));
  form.querySelectorAll(".error-msg").forEach(m => m.textContent = "");
}

function showToast(message, type = "success") {
  let toast = document.getElementById("findit-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "findit-toast";
    document.body.appendChild(toast);
  }
  toast.className = "findit-toast " + type;
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 3500);
}

function attachImagePreview(inputId, previewContainerId, multiple = false) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewContainerId);
  if (!input || !preview) return;

  input.addEventListener("change", () => {
    preview.innerHTML = "";
    const files = Array.from(input.files).slice(0, multiple ? 5 : 1);

    files.forEach(file => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image too large (max 5 MB): " + file.name, "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.className = "preview-thumb";
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });
}

function filesToDataURLs(inputEl, max = 5) {
  const files = Array.from(inputEl.files).slice(0, max);
  return Promise.all(files.map(f => new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsDataURL(f);
  })));
}

/* ---------- Validation primitives ---------- */

const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = v => /^[0-9+\-\s()]{7,15}$/.test(v);
const isFutureOrToday = v => {
  const d = new Date(v);
  return !isNaN(d) && d <= new Date();
};

/* =========================================================
   RENDER "MY PAST REPORTS"
   ========================================================= */
function renderMyLostReports() {
  const host = document.getElementById("my-lost-reports");
  if (!host) return;
  const items = Items.myItems("lost");

  if (!items.length) {
    host.innerHTML = `<p class="muted">You haven't reported any lost items yet.</p>`;
    return;
  }
  host.innerHTML = items.map(it => reportCard(it)).join("");
}

function renderMyFoundReports() {
  const host = document.getElementById("my-found-reports");
  if (!host) return;
  const items = Items.myItems("found");

  if (!items.length) {
    host.innerHTML = `<p class="muted">You haven't reported any found items yet.</p>`;
    return;
  }
  host.innerHTML = items.map(it => reportCard(it)).join("");
}
/* =========================================================
   REPORT LOST FORM
   ========================================================= */

function initReportLostForm() {
  const form = document.getElementById("form-lost");
  if (!form) return;

  attachImagePreview("lost-photos", "lost-photos-preview", true);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors(form);

    const f = form.elements;
    let ok = true;

    const required = [
      ["lost-name",     "Item name is required"],
      ["lost-category", "Please select a category"],
      ["lost-desc",     "Description is required"],
      ["lost-date",     "Date lost is required"],
      ["lost-location", "Location is required"],
      ["lost-student",  "Your name is required"],
      ["lost-email",    "Email is required"],
      ["lost-phone",    "Phone number is required"]
    ];
    required.forEach(([id, msg]) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) { showError(el, msg); ok = false; }
    });

    const emailEl = document.getElementById("lost-email");
    if (emailEl.value && !isEmail(emailEl.value)) {
      showError(emailEl, "Enter a valid email"); ok = false;
    }
    const phoneEl = document.getElementById("lost-phone");
    if (phoneEl.value && !isPhone(phoneEl.value)) {
      showError(phoneEl, "Enter a valid phone number"); ok = false;
    }
    const dateEl = document.getElementById("lost-date");
    if (dateEl.value && !isFutureOrToday(dateEl.value)) {
      showError(dateEl, "Date cannot be in the future"); ok = false;
    }

    if (!ok) {
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    const photos = await filesToDataURLs(f["lost-photos"]);

    const item = Items.create({
      type: "lost",
      status: ITEM_STATUS.LOST_ACTIVE,
      name:     f["lost-name"].value.trim(),
      category: f["lost-category"].value,
      description: f["lost-desc"].value.trim(),
      dateLost: f["lost-date"].value,
      timeLost: f["lost-time"].value,
      location: f["lost-location"].value.trim(),
      additional: f["lost-additional"].value.trim(),
      identifying: f["lost-identifying"].value.trim(),
      photos,
      contact: {
        name:  f["lost-student"].value.trim(),
        email: f["lost-email"].value.trim(),
        phone: f["lost-phone"].value.trim()
      },
      publicSummary: {
        name:     f["lost-name"].value.trim(),
        category: f["lost-category"].value,
        location: f["lost-location"].value.trim(),
        date:     f["lost-date"].value
      }
    });

    Items.logHistory(item.id, {
      status: ITEM_STATUS.LOST_ACTIVE,
      note:   "Reported as lost"
    });

    showToast("Lost item reported! ID: " + item.id);

    form.reset();
    document.getElementById("lost-photos-preview").innerHTML = "";
    renderMyLostReports();          // <-- no redirect; show it below
  });

  form.addEventListener("reset", () => {
    clearAllErrors(form);
    document.getElementById("lost-photos-preview").innerHTML = "";
  });
}

/* =========================================================
   REPORT FOUND FORM
   ========================================================= */

function initReportFoundForm() {
  const form = document.getElementById("form-found");
  if (!form) return;

  attachImagePreview("found-photo", "found-photo-preview", false);

  const possessionRadios = form.querySelectorAll('input[name="found-possession"]');
  const finderBlock  = document.getElementById("finder-contact-block");
  const officeBlock  = document.getElementById("office-info-block");

  function refreshPossessionUI() {
    const val = form.querySelector('input[name="found-possession"]:checked')?.value;
    if (val === "finder") {
      finderBlock.style.display = "block";
      officeBlock.style.display = "none";
    } else if (val === "office") {
      finderBlock.style.display = "none";
      officeBlock.style.display = "block";
      document.getElementById("office-name").textContent    = CAMPUS_OFFICE.name;
      document.getElementById("office-address").textContent = CAMPUS_OFFICE.address;
      document.getElementById("office-hours").textContent   = CAMPUS_OFFICE.hours;
      document.getElementById("office-contact").textContent = CAMPUS_OFFICE.contact;
    } else {
      finderBlock.style.display = "none";
      officeBlock.style.display = "none";
    }
  }
  possessionRadios.forEach(r => r.addEventListener("change", refreshPossessionUI));
  refreshPossessionUI();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors(form);

    const f = form.elements;
    let ok = true;

    const required = [
      ["found-name",     "Item name is required"],
      ["found-category", "Please select a category"],
      ["found-desc",     "Description is required"],
      ["found-date",     "Date found is required"],
      ["found-location", "Location is required"]
    ];
    required.forEach(([id, msg]) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) { showError(el, msg); ok = false; }
    });

    const dateEl = document.getElementById("found-date");
    if (dateEl.value && !isFutureOrToday(dateEl.value)) {
      showError(dateEl, "Date cannot be in the future"); ok = false;
    }

    const possession = form.querySelector('input[name="found-possession"]:checked');
    if (!possession) {
      showToast("Please select where the item is currently.", "error");
      ok = false;
    }

    if (possession?.value === "finder") {
      const fn = document.getElementById("found-finder-name");
      const fe = document.getElementById("found-finder-email");
      const fp = document.getElementById("found-finder-phone");
      if (!fn.value.trim()) { showError(fn, "Your name is required"); ok = false; }
      if (!fe.value.trim() || !isEmail(fe.value)) { showError(fe, "Valid email required"); ok = false; }
      if (!fp.value.trim() || !isPhone(fp.value)) { showError(fp, "Valid phone required"); ok = false; }
    }

    if (!ok) {
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    const photo = await filesToDataURLs(f["found-photo"], 1);

    const initialStatus = possession.value === "finder"
      ? ITEM_STATUS.FOUND_HELD_BY_FINDER
      : ITEM_STATUS.FOUND_AT_OFFICE;

    const item = Items.create({
      type: "found",
      status: initialStatus,
      name:     f["found-name"].value.trim(),
      category: f["found-category"].value,
      description: f["found-desc"].value.trim(),
      dateFound: f["found-date"].value,
      timeFound: f["found-time"].value,
      location: f["found-location"].value.trim(),
      additional: f["found-additional"].value.trim(),
      photo: photo[0] || null,
      possession: possession.value,
      finderContact: possession.value === "finder" ? {
        name:  document.getElementById("found-finder-name").value.trim(),
        email: document.getElementById("found-finder-email").value.trim(),
        phone: document.getElementById("found-finder-phone").value.trim()
      } : null,
      office: possession.value === "office" ? { ...CAMPUS_OFFICE } : null,
      publicSummary: {
        name:     f["found-name"].value.trim(),
        category: f["found-category"].value,
        location: f["found-location"].value.trim(),
        date:     f["found-date"].value
      }
    });

    Items.logHistory(item.id, {
      status: initialStatus,
      note: initialStatus === ITEM_STATUS.FOUND_HELD_BY_FINDER
              ? "Reported as found — held by finder"
              : "Reported as found — submitted to Campus Office"
    });

    showToast("Found item reported! ID: " + item.id);

    form.reset();
    document.getElementById("found-photo-preview").innerHTML = "";
    document.getElementById("finder-contact-block").style.display = "none";
    document.getElementById("office-info-block").style.display = "none";
    renderMyFoundReports();         // <-- no redirect; show it below
  });

  form.addEventListener("reset", () => {
    clearAllErrors(form);
    document.getElementById("found-photo-preview").innerHTML = "";
    document.getElementById("finder-contact-block").style.display = "none";
    document.getElementById("office-info-block").style.display = "none";
  });
}

/* =========================================================
   INLINE STATUS DROPDOWN
   When the user picks a new value, apply the transition
   and re-render.
   ========================================================= */

function initStatusDropdowns() {
  document.addEventListener("change", (e) => {
    const sel = e.target.closest(".status-select");
    if (!sel) return;

    const itemId    = sel.dataset.statusFor;
    const newStatus = sel.value;

    const item = Items.byId(itemId);
    if (!item || item.status === newStatus) return;

    // Route to the right transition
    if (newStatus === ITEM_STATUS.LOST_RESOLVED) {
      StatusChange.markLostRecovered(itemId);
    } else if (newStatus === ITEM_STATUS.FOUND_AT_OFFICE) {
      StatusChange.submitToOffice(itemId);
    } else if (newStatus === ITEM_STATUS.FOUND_CLAIMED) {
      StatusChange.markFoundClaimed(itemId);
    }

    renderMyLostReports();
    renderMyFoundReports();
  });
}

/* =========================================================
   BOOTSTRAP
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initReportLostForm();
  initReportFoundForm();
    initStatusDropdowns();

  // Render any existing items on page load
  renderMyLostReports();
  renderMyFoundReports();
});