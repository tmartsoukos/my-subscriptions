// Σήμα ανοίγματος: το σήμα της εφαρμογής συναρμολογείται ενώ φορτώνουν τα δεδομένα,
// και φεύγει μόλις η πρώτη σελίδα είναι έτοιμη. Παίζει σε κάθε άνοιγμα, όχι σε κάθε
// αλλαγή σελίδας — ο σκελετός φόρτωσης μένει από κάτω και δεν προλαβαίνει να φανεί.
const MIN_MS = 780;     // ελάχιστος χρόνος στην οθόνη, ώστε να μην τρεμοπαίζει
const MAX_MS = 5000;    // δίχτυ ασφαλείας αν το φόρτωμα κολλήσει

function initials() {
  const n = (localStorage.getItem("pref:name") || "").trim();
  if (!n) return "";
  const parts = n.split(/\s+/);
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

// Επιστρέφει συνάρτηση που κλείνει το σήμα (σεβόμενη τον ελάχιστο χρόνο)
export function playIntro() {
  const el = document.createElement("div");
  el.className = "intro";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="intro-mark"><span>${initials()}</span><i></i><i></i></div>
    <p class="intro-word">Το Dashboard μου</p>`;
  document.body.appendChild(el);

  const startedAt = performance.now();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(guard);
    el.classList.add("out");
    setTimeout(() => el.remove(), 400);
  };
  const guard = setTimeout(close, MAX_MS);

  return () => setTimeout(close, Math.max(0, MIN_MS - (performance.now() - startedAt)));
}
