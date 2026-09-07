// Απλός hash router: #/dashboard, #/subs, ...
import { skeletonFor } from "./skeleton.js";
import { getTabs } from "./prefs.js";
import { logError } from "./errors.js";
import { refreshSession } from "./db.js";

const routes = {};
let defaultRoute = "dashboard";
const ORDER = ["dashboard", "finance", "subs", "todos", "calendar", "notes", "studies", "health", "watchlist", "more", "settings"];
let lastRoute = null;
// Σφάλματα token που περνούν από μόνα τους: αξίζει μία σιωπηλή επανάληψη
const TRANSIENT_AUTH = /issued at future|token is expired|JWT expired|PGRST301/i;

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
  // Ό,τι δεν υπάρχει στην κάτω μπάρα ζει κάτω από το tab «Περισσότερα»
  const tabs = getTabs();
  const UNDER_MORE = ["dashboard", "finance", "subs", "todos", "calendar", "notes",
    "studies", "health", "watchlist", "settings", "more"].filter(r => !tabs.includes(r));
  document.querySelectorAll("[data-route]").forEach(a => {
    const active = a.dataset.route === name ||
      (a.dataset.route === "more" && UNDER_MORE.includes(name));
    a.classList.toggle("active", active);
  });
  // Κατεύθυνση μετάβασης ανάλογα με τη θέση της ενότητας στο μενού
  const dir = lastRoute && ORDER.indexOf(name) < ORDER.indexOf(lastRoute) ? "back" : "fwd";
  lastRoute = name;

  // Σκελετός με το σχήμα του περιεχομένου αντί για σπίναρ στο κενό
  view.innerHTML = skeletonFor(name);

  try {
    // Κάθε view γράφει το δικό του innerHTML μόλις έρθουν τα δεδομένα —
    // μέχρι τότε μένει ορατός ο σκελετός.
    await routes[name](view);
  } catch (e) {
    let failed = e;
    // Παροδικό σφάλμα διαπιστευτηρίων: το φρέσκο token έχει iat λίγα
    // δευτερόλεπτα μπροστά από το ρολόι του server που το ελέγχει, οπότε η
    // πρώτη κλήση απορρίπτεται και η ίδια περνά αμέσως μετά. Μία επανάληψη με
    // ανανεωμένο token το καλύπτει χωρίς να δει ο χρήστης κενή οθόνη.
    if (TRANSIENT_AUTH.test(failed?.message || String(failed))) {
      try {
        await new Promise(r => setTimeout(r, 1200));
        await refreshSession();
        await routes[name](view);
        logError("route:" + name + ":ανακτήθηκε", e);
        failed = null;
      } catch (again) {
        failed = again;
      }
    }
    if (failed) {
      logError("route:" + name, failed);
      view.innerHTML = `<div class="empty"><p>Σφάλμα φόρτωσης: ${failed.message || failed}</p>
        <button class="btn btn-primary" onclick="location.reload()">Δοκίμασε ξανά</button></div>`;
    }
  }

  view.classList.remove("enter-fwd", "enter-back");
  void view.offsetWidth; // επανεκκίνηση της κίνησης
  view.classList.add(dir === "back" ? "enter-back" : "enter-fwd");
  view.focus({ preventScroll: true });
}

export function start() {
  window.addEventListener("hashchange", render);
  return render();
}
