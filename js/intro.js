// Σήμα ανοίγματος «Διάφραγμα»: δύο τόξα κλείνουν πάνω σε ένα στρογγυλεμένο
// τετράγωνο, το οποίο στη συνέχεια ανεβαίνει στο header σαν μικρό λογότυπο.
// Παίζει σε κάθε άνοιγμα, όχι σε κάθε αλλαγή σελίδας.
const MIN_MS = 950;    // ελάχιστος χρόνος στην οθόνη — όσο διαρκεί η κίνηση
const MAX_MS = 5000;   // δίχτυ ασφαλείας αν το φόρτωμα κολλήσει

// Το σήμα ταξιδεύει προς το λογότυπο του header (κινητό) ή της πλαϊνής μπάρας.
// Διαλέγουμε όποιο από τα δύο είναι όντως ορατό: σε desktop το .mobile-header
// είναι display:none και θα έδινε μηδενικές διαστάσεις.
function aimAtLogo(mark) {
  const target = [...document.querySelectorAll(".mobile-header [data-avatar], .sidebar [data-avatar]")]
    .find(el => el.getBoundingClientRect().width > 0);
  if (!target) return null;
  const t = target.getBoundingClientRect();
  const m = mark.getBoundingClientRect();
  if (!t.width || !m.width) return null;
  mark.style.setProperty("--ix", Math.round(t.left + t.width / 2 - (m.left + m.width / 2)) + "px");
  mark.style.setProperty("--iy", Math.round(t.top + t.height / 2 - (m.top + m.height / 2)) + "px");
  mark.style.setProperty("--is", (t.width / m.width).toFixed(3));
  return target;
}

// Επιστρέφει συνάρτηση που κλείνει το σήμα (σεβόμενη τον ελάχιστο χρόνο)
export function playIntro() {
  const el = document.createElement("div");
  el.className = "intro";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="intro-mark"><i></i><i></i><b></b></div>`;
  document.body.appendChild(el);

  const mark = el.firstElementChild;
  const startedAt = performance.now();
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(guard);
    const target = aimAtLogo(mark);
    const host = target && target.closest(".mobile-header, .sidebar");
    if (host) {
      host.classList.add("intro-landing");
      setTimeout(() => host.classList.remove("intro-landing"), 700);
    }
    el.classList.add("out");
    setTimeout(() => el.remove(), 450);
  };
  const guard = setTimeout(close, MAX_MS);

  return () => setTimeout(close, Math.max(0, MIN_MS - (performance.now() - startedAt)));
}
