// Σήμα ανοίγματος: μία φορά την ημέρα, το σήμα της εφαρμογής συναρμολογείται πριν
// φανεί το περιεχόμενο. Όχι σε κάθε αλλαγή σελίδας — θα κούραζε μέσα στην ίδια μέρα.
const KEY = "intro:last";

function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Επιστρέφει true μόνο την πρώτη φορά κάθε ημέρα (και το σημειώνει αμέσως)
export function shouldPlayIntro() {
  const iso = todayIso();
  if (localStorage.getItem(KEY) === iso) return false;
  localStorage.setItem(KEY, iso);
  return true;
}

function initials() {
  const n = (localStorage.getItem("pref:name") || "").trim();
  if (!n) return "";
  const parts = n.split(/\s+/);
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

export function playIntro() {
  if (!shouldPlayIntro()) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const el = document.createElement("div");
  el.className = "intro";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="intro-mark"><span>${initials()}</span><i></i><i></i></div>
    <p class="intro-word">Το Dashboard μου</p>`;
  document.body.appendChild(el);

  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 400);
  }, 820);
}
