import "./theme.js";
import {
  getSession, onAuthChange, signIn, signUp, signOut, onOfflineChange, migrateLocalData,
  onQueueChange, queuedCount, flushQueue
} from "./db.js";
import { icons, toast } from "./ui.js";
import { refreshBadge } from "./badge.js";
import { loadPrefs, getStartRoute, paintTabs } from "./prefs.js";
import { initScrollTop } from "./scrolltop.js";
import { playIntro } from "./intro.js";
import * as router from "./router.js";
import * as dashboard from "./views/dashboard/index.js";
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
window.__icons = icons;   // τα χρειάζεται η δυναμική κάτω μπάρα
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
    const introDone = playIntro();   // μένει στην οθόνη όσο φορτώνει η πρώτη σελίδα
    await loadPrefs();
    paintTabs(icons);
    if (!location.hash) location.hash = "#/" + getStartRoute();
    await router.start();
    initScrollTop();
    introDone();
  } else {
    router.render();
  }
  refreshBadge();
  paintOfflineBanner();
  syncPending();
  // Μία φορά: εισαγωγή παλιών τοπικών δεδομένων
  try {
    const n = await migrateLocalData();
    if (n > 0) {
      toast(`Εισήχθησαν ${n} συνδρομές από την παλιά έκδοση`);
      router.render();
    }
  } catch { /* όχι κρίσιμο — υπάρχει και κουμπί στις Ρυθμίσεις */ }
}

// Μπάρα κατάστασης: εκτός σύνδεσης και αλλαγές που περιμένουν να σταλούν
let offlineNow = false;
function paintOfflineBanner() {
  const n = queuedCount();
  const banner = document.getElementById("offlineBanner");
  const text = document.getElementById("offlineText");
  banner.classList.toggle("hidden", !offlineNow && n === 0);
  if (offlineNow) {
    text.textContent = n
      ? `Εκτός σύνδεσης — ${n === 1 ? "μία αλλαγή περιμένει" : `${n} αλλαγές περιμένουν`} να σταλεί`
      : "Εκτός σύνδεσης — ό,τι αλλάζεις αποθηκεύεται και θα σταλεί μόλις γυρίσει το δίκτυο";
  } else {
    text.textContent = `Αποστολή ${n === 1 ? "μίας αλλαγής" : `${n} αλλαγών`}...`;
  }
}
onOfflineChange(off => { offlineNow = off; paintOfflineBanner(); });
onQueueChange(paintOfflineBanner);

// Μόλις γυρίσει η σύνδεση, φεύγει ό,τι έχει μαζευτεί
async function syncPending() {
  if (!queuedCount()) return;
  const { done, dropped } = await flushQueue();
  paintOfflineBanner();
  if (done) {
    toast(done === 1 ? "Η αλλαγή στάλθηκε" : `Στάλθηκαν ${done} αλλαγές`);
    router.render();
    refreshBadge();
  }
  if (dropped) toast(`${dropped === 1 ? "Μία αλλαγή" : `${dropped} αλλαγές`} δεν στάλθηκαν`, "error");
}
window.addEventListener("online", syncPending);

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
  // Πάτημα σε ειδοποίηση: η ανοιχτή καρτέλα πηγαίνει στο σημείο που αφορά
  navigator.serviceWorker.addEventListener("message", e => {
    const hash = e.data?.type === "navigate" ? e.data.hash : null;
    if (typeof hash === "string" && /^#\/[a-z/-]*$/i.test(hash)) location.hash = hash;
  });
}
