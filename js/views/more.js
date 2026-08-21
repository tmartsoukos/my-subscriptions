import { icons } from "../ui.js";
import { SECTIONS, getTabs } from "../prefs.js";

const DESC = {
  dashboard: "Σύνοψη της ημέρας",
  finance: "Έσοδα, έξοδα, υπόλοιπο",
  subs: "Σταθερές χρεώσεις και δοκιμές",
  todos: "Εργασίες και προθεσμίες",
  calendar: "Υποχρεώσεις και πληρωμές",
  notes: "Κείμενο, εικόνες, λίστες",
  studies: "Μαθήματα, βαθμοί, προθεσμίες",
  health: "Ραντεβού, εξετάσεις, φάρμακα",
  watchlist: "Ταινίες, σειρές, βιβλία",
  settings: "Προφίλ, ειδοποιήσεις, widget"
};

// Σελίδα «Περισσότερα»: ό,τι δεν χωράει στην κάτω μπάρα
export async function render(view) {
  const tabs = getTabs();
  const links = Object.keys(SECTIONS)
    .filter(id => id !== "more" && id !== "dashboard" && !tabs.includes(id))
    .concat("settings");

  view.innerHTML = `
    <div class="page-head"><h1>Περισσότερα</h1></div>
    <div class="more-list">
      ${links.map(id => {
        const sec = SECTIONS[id] || { label: "Ρυθμίσεις", icon: "settings" };
        return `<a class="card more-item" href="#/${id}">
          <div class="logo logo-sm more-ico">${icons[sec.icon]}</div>
          <div class="card-main">
            <div class="name">${id === "settings" ? "Ρυθμίσεις" : sec.label}</div>
            <div class="meta">${DESC[id] || ""}</div>
          </div>
          <span class="more-arrow">${icons.chevronR}</span>
        </a>`;
      }).join("")}
    </div>`;
}
