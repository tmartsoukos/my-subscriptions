// Επιστροφή στην κορυφή: πλωτό κουμπί μετά από κύλιση + πάτημα στην κεφαλίδα κινητού.
const SHOW_AFTER = 420;

export function initScrollTop() {
  if (document.getElementById("scrollTop")) return;

  const btn = document.createElement("button");
  btn.id = "scrollTop";
  btn.className = "scroll-top";
  btn.setAttribute("aria-label", "Επιστροφή στην κορυφή");
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>`;
  document.body.appendChild(btn);

  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  btn.addEventListener("click", toTop);

  // Όπως στο iOS: πάτημα στη μπάρα τίτλου ανεβάζει στην κορυφή
  document.querySelector(".mobile-header")?.addEventListener("click", e => {
    if (e.target.closest("a, button")) return;
    toTop();
  });

  // Απλή εναλλαγή κλάσης — αρκετά φθηνή ώστε να μη χρειάζεται requestAnimationFrame
  const update = () => btn.classList.toggle("show", window.scrollY > SHOW_AFTER);
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
}
