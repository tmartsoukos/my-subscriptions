// Απλός hash router: #/dashboard, #/subs, ...
const routes = {};
let defaultRoute = "dashboard";

export function register(name, renderFn) {
  routes[name] = renderFn;
}

export function current() {
  return (location.hash.replace(/^#\/?/, "") || defaultRoute).split("?")[0];
}

export async function render() {
  const name = routes[current()] ? current() : defaultRoute;
  const view = document.getElementById("view");
  document.querySelectorAll("[data-route]").forEach(a => {
    a.classList.toggle("active", a.dataset.route === name);
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
