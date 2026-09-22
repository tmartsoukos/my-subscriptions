// Οδηγίες πρώτης φοράς.
//
// Κάθε σελίδα έχει χειρονομίες που δεν φαίνονται: σύρσιμο σε γραμμή, διπλό
// πάτημα σε ποσό. Ένα στατικό κείμενο βοήθειας το αγνοεί ο καθένας· μια
// φυσαλίδα που δείχνει το ίδιο το στοιχείο τη σωστή στιγμή, όχι.
//
// Κανόνας: μία φυσαλίδα ανά σελίδα, μία φορά στη ζωή της εγκατάστασης. Ό,τι
// είδες δεν ξαναεμφανίζεται — και μπορείς να τα μηδενίσεις από τις Ρυθμίσεις.
import { haptic } from "./ui.js";

const KEY = "pref:coach";

function seen() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

function remember(id) {
  try { localStorage.setItem(KEY, JSON.stringify([...new Set([...seen(), id])])); }
  catch { /* γεμάτος χώρος — δεν είναι κρίσιμο */ }
}

export const coachSeen = id => seen().includes(id);
export const coachCount = () => seen().length;

export function resetCoachMarks() {
  try { localStorage.removeItem(KEY); } catch { /* τίποτα */ }
}

// Δείχνει τη φυσαλίδα μία φορά. Επιστρέφει true αν όντως εμφανίστηκε.
export function coachMark(id, { target, text, delay = 700 } = {}) {
  if (coachSeen(id) || !text) return false;
  // Σε οθόνες με ποντίκι οι χειρονομίες αφής δεν ισχύουν
  if (!window.matchMedia("(hover: none)").matches) return false;

  // Ο στόχος μπορεί να μην υπάρχει σε αυτή τη σχεδίαση — π.χ. η λίστα κινήσεων
  // ζει σε άλλη καρτέλα. Τότε η οδηγία δεν «καίγεται»: περιμένει τη φορά που
  // θα έχει κάτι να δείξει.
  if (!target) return false;

  setTimeout(() => {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el || !el.isConnected) return;
    const box = el.getBoundingClientRect();
    if (!box.width) return;
    remember(id);                     // γράφεται μόλις υπάρχει τι να δειχθεί

    const tip = document.createElement("div");
    tip.className = "coach";
    tip.setAttribute("role", "status");
    tip.innerHTML = `<div class="coach-bubble"><p>${text}</p>
      <button class="btn btn-primary coach-ok" type="button">Κατάλαβα</button></div>`;
    document.body.appendChild(tip);

    // Κάτω από το στοιχείο αν χωράει, αλλιώς από πάνω
    const bubble = tip.querySelector(".coach-bubble");
    const h = bubble.offsetHeight;
    const below = box.bottom + 12 + h < window.innerHeight;
    tip.style.top = (below ? box.bottom + 10 : Math.max(10, box.top - h - 10)) + "px";
    tip.classList.add(below ? "coach-below" : "coach-above");
    tip.style.setProperty("--arrow-x", Math.round(box.left + box.width / 2) + "px");

    el.classList.add("coach-target");
    haptic("tap");
    requestAnimationFrame(() => tip.classList.add("show"));

    const close = () => {
      el.classList.remove("coach-target");
      tip.classList.remove("show");
      setTimeout(() => tip.remove(), 220);
      document.removeEventListener("click", onOutside, true);
    };
    const onOutside = () => close();
    tip.querySelector(".coach-ok").addEventListener("click", e => { e.stopPropagation(); close(); });
    setTimeout(() => document.addEventListener("click", onOutside, true), 50);
    setTimeout(close, 9000);
  }, delay);

  return true;
}
