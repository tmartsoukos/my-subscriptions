import "./theme.js";
import { getSession, onAuthChange, signIn, signUp, signOut, onOfflineChange, migrateLocalData } from "./db.js";
import { icons, toast } from "./ui.js";
import { refreshBadge } from "./badge.js";
import { loadPrefs, getStartRoute } from "./prefs.js";
import { initScrollTop } from "./scrolltop.js";
import * as router from "./router.js";
import * as dashboard from "./views/dashboard.js";
import * as subs from "./views/subscriptions.js";
import * as todosView from "./views/todos.js";
import * as calendarView from "./views/calendar.js";
import * as notesView from "./views/notes.js";
import * as watchlistView from "./views/watchlist.js";
import * as studiesView from "./views/studies.js";
import * as healthView from "./views/health.js";
import * as financeView from "./views/finance.js";
import * as moreView from "./views/more.js";
import * as settingsView from "./views/settings.js";

router.register("dashboard", dashboard.render);
router.register("subs", subs.render);
router.register("todos", todosView.render);
router.register("calendar", calendarView.render);
router.register("notes", notesView.render);
router.register("watchlist", watchlistView.render);
router.register("studies", studiesView.render);
router.register("health", healthView.render);
router.register("finance", financeView.render);
router.register("more", moreView.render);
router.register("settings", settingsView.render);

// Εικονίδια πλοήγησης
const eye = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`;
document.querySelectorAll(".nav-ico").forEach(el => { el.innerHTML = icons[el.dataset.ico] || ""; });
document.getElementById("togglePass").innerHTML = eye;

const authScreen = document.getElementById("authScreen");
const app = document.getElementById("app");
let appStarted = false;

function showAuth() {
  authScreen.classList.remove("hidden");
  app.classList.add("hidden");
}

async function showApp() {
  authScreen.classList.add("hidden");
  app.classList.remove("hidden");
  if (!appStarted) {
    appStarted = true;
    await loadPrefs();
    if (!location.hash) location.hash = "#/" + getStartRoute();
    router.start();
    initScrollTop();
  } else {
    router.render();
  }
  refreshBadge();
  // Μία φορά: εισαγωγή παλιών τοπικών δεδομένων
  try {
    const n = await migrateLocalData();
    if (n > 0) {
      toast(`Εισήχθησαν ${n} συνδρομές από την παλιά έκδοση`);
      router.render();
    }
  } catch { /* όχι κρίσιμο — υπάρχει και κουμπί στις Ρυθμίσεις */ }
}

// Offline banner
onOfflineChange(off => {
  document.getElementById("offlineBanner").classList.toggle("hidden", !off);
});

// Auth φόρμα
const authError = document.getElementById("authError");
const emailInput = document.getElementById("authEmail");
const passInput = document.getElementById("authPass");

document.getElementById("togglePass").addEventListener("click", () => {
  passInput.type = passInput.type === "password" ? "text" : "password";
});

document.getElementById("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  authError.textContent = "";
  const btn = document.getElementById("btnLogin");
  btn.disabled = true;
  try {
    await signIn(emailInput.value.trim(), passInput.value);
  } catch (err) {
    authError.textContent = /invalid/i.test(err.message)
      ? "Λάθος email ή κωδικός." : (err.message || "Σφάλμα σύνδεσης.");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btnSignup").addEventListener("click", async () => {
  authError.textContent = "";
  if (!emailInput.value.trim() || passInput.value.length < 6) {
    authError.textContent = "Συμπλήρωσε email και κωδικό τουλάχιστον 6 χαρακτήρων.";
    return;
  }
  const btn = document.getElementById("btnSignup");
  btn.disabled = true;
  try {
    const data = await signUp(emailInput.value.trim(), passInput.value);
    if (data.session) {
      toast("Ο λογαριασμός δημιουργήθηκε!");
    } else {
      authError.textContent = "";
      toast("Στάλθηκε email επιβεβαίωσης — έλεγξε τα εισερχόμενά σου.");
    }
  } catch (err) {
    authError.textContent = err.message || "Σφάλμα εγγραφής.";
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut();
});

// Εκκίνηση
onAuthChange(session => {
  if (session) showApp();
  else showAuth();
});
getSession().then(session => {
  if (session) showApp();
  else showAuth();
});

// Service worker
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}
