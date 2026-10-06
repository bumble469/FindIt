/* =========================================================
   status.js
   Central place for every status used by Lost/Found items.
   ========================================================= */

const ITEM_STATUS = {
  // Lost item
  LOST_ACTIVE:      "LOST_ACTIVE",
  LOST_RESOLVED:    "LOST_RESOLVED",

  // Found item
  FOUND_HELD_BY_FINDER: "FOUND_HELD_BY_FINDER",
  FOUND_AT_OFFICE:      "FOUND_AT_OFFICE",
  FOUND_CLAIMED:        "FOUND_CLAIMED"
};

const STATUS_LABEL = {
  LOST_ACTIVE:          "LOST — ACTIVE",
  LOST_RESOLVED:        "LOST — RESOLVED",
  FOUND_HELD_BY_FINDER: "FOUND — HELD BY FINDER",
  FOUND_AT_OFFICE:      "FOUND — SUBMITTED TO CAMPUS OFFICE",
  FOUND_CLAIMED:        "FOUND — CLAIMED / RETURNED"
};

// The single official campus office (auto-populated, never typed by user)
const CAMPUS_OFFICE = {
  name:    "Campus Lost & Found Office",
  address: "Student Services Building, Ground Floor, Room 12",
  hours:   "Mon–Fri, 9:00 AM – 5:00 PM",
  contact: "lostfound@campus.edu"
};