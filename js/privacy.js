// Κρύψιμο υπολοίπων: ένα πάτημα και θολώνουν μόνο τα διαθέσιμα — το υπόλοιπο
// του μήνα, τα διαθέσιμα των Οικονομικών, τα υπόλοιπα των λογαριασμών.
// Οι επιμέρους κινήσεις και τα κόστη μένουν ορατά: κανείς δεν μαθαίνει πόσα
// έχεις βλέποντας ότι έδωσες 4€ για καφέ, ενώ το να θολώνουν τα πάντα έκανε
// την οθόνη αδιάβαστη. Για όταν δείχνεις το κινητό σε κάποιον ή είσαι σε
// λεωφορείο — ξεχωριστό από το κλείδωμα της εφαρμογής, και γυρνάει αμέσως.
//
// Μένει τοπικά στη συσκευή και δεν συγχρονίζεται: το ότι το κινητό σου κρύβει
// τα ποσά δεν σημαίνει ότι το ίδιο θέλεις και στον υπολογιστή του σπιτιού.
import { icons } from "./ui.js";

const KEY = "pref:private";

export const isPrivate = () => localStorage.getItem(KEY) === "1";

export function setPrivate(on) {
  localStorage.setItem(KEY, on ? "1" : "0");
  applyPrivacy();
}

export const togglePrivate = () => setPrivate(!isPrivate());

export function applyPrivacy() {
  const on = isPrivate();
  document.documentElement.classList.toggle("private", on);
  document.querySelectorAll("[data-privacy]").forEach(btn => {
    const label = on ? "Εμφάνιση υπολοίπων" : "Κρύψιμο υπολοίπων";
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", label);
    btn.title = label;
    const ico = btn.querySelector("[data-priv-ico]");
    if (ico) ico.innerHTML = on ? icons.eyeOff : icons.eye;
    const text = btn.querySelector("[data-priv-label]");
    if (text) text.textContent = label;
  });
  // Οι Ρυθμίσεις μπορεί να είναι ανοιχτές την ώρα που πατιέται το κουμπί
  const check = document.getElementById("fPrivate");
  if (check) check.checked = on;
}

export function initPrivacy() {
  document.querySelectorAll("[data-privacy]").forEach(btn =>
    btn.addEventListener("click", togglePrivate));
  applyPrivacy();
}
