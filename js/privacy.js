// Κρύψιμο ποσών: ένα πάτημα και κάθε νούμερο θολώνει, χωρίς να αλλάξει τίποτα
// στη διάταξη. Για όταν δείχνεις την οθόνη σε κάποιον ή είσαι σε λεωφορείο —
// είναι ξεχωριστό από το κλείδωμα της εφαρμογής: εδώ βλέπεις τα πάντα εκτός
// από τα ποσά, και το γυρνάς πίσω αμέσως.
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
    const label = on ? "Εμφάνιση ποσών" : "Κρύψιμο ποσών";
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
