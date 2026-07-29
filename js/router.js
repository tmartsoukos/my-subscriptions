// Απλός hash router: #/dashboard, #/subs, ...
const routes = {};
let defaultRoute = "dashboard";

export function register(name, renderFn) {
  routes[name] = renderFn;
}

export function current() {
  return path().split("/")[0];
}

// Ολόκληρη η διαδρομή χωρίς το «#/»
function path() {
  return (location.hash.replace(/^#\/?/, "") || defaultRoute).split("?")[0];
}

// Δεύτερο τμήμα διαδρομής, π.χ. #/note/<id>
export function param() {
  return path().split("/")[1] || null;
}

export async function render() {
  const name = routes[current()] ? current() : defaultRoute;
  const view = document.getElementById("view");
  // Στο κινητό οι σελίδες Σημειώσεις/Λίστα/Ρυθμίσεις ζουν κάτω από το tab «Περισσότερα»
  const UNDER_MORE = ["notes", "watchlist", "studies", "health", "settings", "more"];
  document.querySelectorAll("[data-route]").forEach(a => {
    const active = a.dataset.route === name ||
      (a.dataset.route === "more" && UNDER_MORE.includes(name));
    a.classList.toggle("active", active);
  });
  view.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    await routes[name](view);
  } catch (e) {
    view.innerHTML = `<div class="empty"><p>Σφάλμα φόρτωσης: ${e.message || e}</p>
      <button class="btn btn-primary" onclick="location.reload()">Δοκίμασε ξανά</button></div>`;
  }
  view.focus({ preventScroll: true });
}

export function start() {
  window.addEventListener("hashchange", render);
  render();
}
