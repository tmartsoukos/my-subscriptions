// Προσωποποίηση: προφίλ, χρώμα τόνου, αρχική σελίδα, δικές μου κατηγορίες,
// γρήγορες ενέργειες και στόχοι. Φορτώνονται μία φορά και κρατιούνται στη μνήμη.
import { sb, store, uploadNoteImage, signedImageUrl, accounts, isMissingTable } from "./db.js";
import { escapeHtml } from "./ui.js";

export const ACCENTS = {
  blue:   { label: "Μπλε",      c1: "#3b82f6", c2: "#7c6cf6", light1: "#2563eb", light2: "#6d5cf0" },
  violet: { label: "Μωβ",       c1: "#8b5cf6", c2: "#d946a6", light1: "#7c3aed", light2: "#c026a3" },
  green:  { label: "Πράσινο",   c1: "#22b07d", c2: "#4c8dff", light1: "#0f9d63", light2: "#2563eb" },
  amber:  { label: "Πορτοκαλί", c1: "#e08b2f", c2: "#e2585c", light1: "#c2710f", light2: "#d1373c" },
  rose:   { label: "Ροζ",       c1: "#e0518f", c2: "#8b5cf6", light1: "#d02b73", light2: "#7c3aed" },
  teal:   { label: "Τιρκουάζ",  c1: "#14a3b8", c2: "#3b82f6", light1: "#0e8ba0", light2: "#2563eb" }
};

const ACCENT_KEY = "pref:accent";
const START_KEY = "pref:start";
const NAME_KEY = "pref:name";

// Ενότητες: ετικέτα και εικονίδιο σε ένα σημείο
export const SECTIONS = {
  dashboard: { label: "Αρχική", icon: "home" },
  finance:   { label: "Οικονομικά", icon: "wallet" },
  subs:      { label: "Συνδρομές", icon: "card" },
  todos:     { label: "Εργασίες", icon: "check" },
  calendar:  { label: "Ημ/γιο", icon: "calendar" },
  notes:     { label: "Σημειώσεις", icon: "note" },
  studies:   { label: "Σπουδές", icon: "book" },
  health:    { label: "Υγεία", icon: "heart" },
  watchlist: { label: "Λίστα", icon: "bookmark" },
  more:      { label: "Περισσότερα", icon: "dots" }
};
export const DEFAULT_TABS = ["dashboard", "finance", "todos", "calendar", "more"];

// Κάρτες της αρχικής, με τη σειρά που εμφανίζονται εξ ορισμού
export const DASH_CARDS = {
  hero:      "Κύριος αριθμός",
  pins:      "Καρφιτσωμένα",
  stats:     "Στατιστικά",
  ask:       "Ρώτα με",
  goals:     "Στόχοι",
  charts:    "Γραφήματα συνδρομών",
  upcoming:  "Επερχόμενες πληρωμές",
  attention: "Θέλουν προσοχή",
  debts:     "Μου χρωστάνε"
};
export const DEFAULT_LAYOUT = Object.keys(DASH_CARDS).map(id => ({ id, on: true }));
// Κάρτες που, όταν προστίθενται σε παλιά διάταξη, ανήκουν στην κορυφή και όχι στο τέλος
const NEW_AT_TOP = new Set(["hero"]);

export const customCategories = store("custom_categories", "created_at");
export const pins = store("pins", "sort");
export const quickActions = store("quick_actions", "sort");
export const goals = store("goals", "created_at");

let state = {
  profile: null,
  categories: [],
  quick: [],
  goals: [],
  pins: [],
  accounts: [],
  accountsMissing: false,
  avatarUrl: null,
  loaded: false
};

const TABS_KEY = "pref:tabs";
const LAYOUT_KEY = "pref:layout";

// ---- Κάτω μπάρα ----
export function getTabs() {
  try {
    const t = JSON.parse(localStorage.getItem(TABS_KEY));
    if (Array.isArray(t) && t.length) return t.filter(x => SECTIONS[x]);
  } catch { /* πέφτουμε στις προεπιλογές */ }
  return DEFAULT_TABS;
}
export function setTabs(tabs) {
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  saveProfile({ tabs });
  paintTabs();
}

// ---- Διάταξη αρχικής ----
export function getLayout() {
  try {
    const l = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (Array.isArray(l) && l.length) {
      const known = l.filter(x => DASH_CARDS[x.id]);
      // Νέες κάρτες που δεν υπάρχουν στην αποθηκευμένη διάταξη μπαίνουν στο τέλος
      for (const id of Object.keys(DASH_CARDS)) {
        if (known.some(x => x.id === id)) continue;
        if (NEW_AT_TOP.has(id)) known.unshift({ id, on: true });
        else known.push({ id, on: true });
      }
      return known;
    }
  } catch { /* προεπιλογή */ }
  return DEFAULT_LAYOUT;
}
export function setLayout(layout) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  saveProfile({ dash_layout: layout });
}

export const prefs = () => state;

// ---- Ζωντανό φως: το φόντο ακολουθεί το πώς πας στους στόχους ----
// mood: +1 άνετα (ψυχρό πράσινο φως), 0 ουδέτερο, -1 ξεπερασμένο όριο (ζεστό κεχριμπάρι).
// Ο τόνος που διάλεξες μένει άθικτος — αλλάζει το φως του χώρου, όχι το χρώμα σου.
// (Ανάμειξη του τόνου με το χρώμα διάθεσης θα περνούσε από γκρι όταν τα δύο
//  είναι συμπληρωματικά, π.χ. μπλε με κεχριμπάρι.)
const MOOD_KEY = "pref:mood";
const MOOD_ON_KEY = "pref:moodon";
const MOOD_GOOD = "34, 176, 125";
const MOOD_WARN = "224, 145, 47";

export const moodEnabled = () => localStorage.getItem(MOOD_ON_KEY) !== "0";
export function setMoodEnabled(on) {
  localStorage.setItem(MOOD_ON_KEY, on ? "1" : "0");
  applyMood();
  saveProfile({ mood_accent: on });
}
export const getMood = () => Number(localStorage.getItem(MOOD_KEY)) || 0;
export function setMood(value) {
  const v = Math.max(-1, Math.min(1, Number(value) || 0));
  const changed = Math.abs(v - getMood()) > 0.02;
  localStorage.setItem(MOOD_KEY, v.toFixed(3));
  if (changed) applyMood();
}

export function applyMood() {
  const mood = moodEnabled() ? getMood() : 0;
  const light = document.documentElement.dataset.theme === "light";
  const rgb = mood >= 0 ? MOOD_GOOD : MOOD_WARN;
  const a = Math.min(Math.abs(mood), 1) * (light ? 0.13 : 0.17);
  const root = document.documentElement.style;
  root.setProperty("--mood-a", `rgba(${rgb}, ${a.toFixed(3)})`);
  root.setProperty("--mood-b", `rgba(${rgb}, ${(a * 0.65).toFixed(3)})`);
}

// ---- Χρώμα τόνου ----
export function applyAccent(key = localStorage.getItem(ACCENT_KEY) || "blue") {
  const a = ACCENTS[key] || ACCENTS.blue;
  const light = document.documentElement.dataset.theme === "light";
  const c1 = light ? a.light1 : a.c1;
  const c2 = light ? a.light2 : a.c2;
  applyMood();
  const root = document.documentElement.style;
  root.setProperty("--accent", c1);
  root.setProperty("--accent2", c2);
  root.setProperty("--accent-grad", `linear-gradient(135deg, ${c1}, ${c2})`);
  root.setProperty("--glow", light ? `0 2px 12px ${c1}33` : `0 0 24px ${c1}59`);
}

export function setAccent(key) {
  localStorage.setItem(ACCENT_KEY, key);
  applyAccent(key);
  saveProfile({ accent: key });
}
export const getAccent = () => localStorage.getItem(ACCENT_KEY) || "blue";

// ---- Αρχική σελίδα ----
export const getStartRoute = () => localStorage.getItem(START_KEY) || "dashboard";
export function setStartRoute(route) {
  localStorage.setItem(START_KEY, route);
  saveProfile({ start_route: route });
}

// ---- Πότε αρχίζει η μέρα ----
// 0 = τα μεσάνυχτα. Με 4, ό,τι καταχωρείς πριν τις 4 π.μ. μετράει στη χθεσινή μέρα.
const DAY_START_KEY = "pref:daystart";
export const getDayStart = () => Number(localStorage.getItem(DAY_START_KEY)) || 0;
export function setDayStart(hour) {
  localStorage.setItem(DAY_START_KEY, String(hour));
  saveProfile({ day_start_hour: hour });
}

// ---- Όνομα ----
export const getName = () => localStorage.getItem(NAME_KEY) || "";
export function setName(name) {
  localStorage.setItem(NAME_KEY, name);
  saveProfile({ display_name: name || null });
}

// Χαιρετισμός ανάλογα με την ώρα
export function greeting() {
  const h = new Date().getHours();
  const name = getName().trim();
  const base = h < 5 ? "Καλό ξημέρωμα" : h < 12 ? "Καλημέρα" : h < 18 ? "Καλησπέρα" : h < 22 ? "Καλό βράδυ" : "Καληνύχτα";
  return name ? `${base}, ${name}` : base;
}

// ---- Αποθήκευση προφίλ ----
export async function saveProfile(patch) {
  try {
    const { error } = await sb.from("profile").upsert(
      { ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    state.profile = { ...(state.profile || {}), ...patch };
  } catch { /* τοπικά έχει ήδη αποθηκευτεί· ο συγχρονισμός θα γίνει την επόμενη φορά */ }
}

// ---- Avatar ----
export async function uploadAvatar(file) {
  const path = await uploadNoteImage(file);           // ίδιος ιδιωτικός κάδος, φάκελος χρήστη
  await saveProfile({ avatar_path: path });
  state.avatarUrl = await signedImageUrl(path);
  paintAvatar();
  return state.avatarUrl;
}
export async function removeAvatar() {
  await saveProfile({ avatar_path: null });
  state.avatarUrl = null;
  paintAvatar();
}

export function initials() {
  const n = getName().trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

// Σχεδιάζει την κάτω μπάρα από τις επιλογές του χρήστη
export function paintTabs(iconsMap) {
  const bar = document.querySelector(".tabbar");
  if (!bar) return;
  const icons = iconsMap || window.__icons || {};
  bar.innerHTML = getTabs().map(id => {
    const sec = SECTIONS[id];
    return `<a href="#/${id}" data-route="${id}">
      <span class="nav-ico">${icons[sec.icon] || ""}</span><span>${sec.label}</span>
    </a>`;
  }).join("");
}

// Ζωγραφίζει avatar και όνομα στο κέλυφος (πλαϊνό μενού + μπάρα κινητού)
export function paintAvatar() {
  document.querySelectorAll("[data-avatar]").forEach(el => {
    el.innerHTML = state.avatarUrl
      ? `<img src="${state.avatarUrl}" alt="">`
      : `<span>${initials()}</span>`;
  });
  document.querySelectorAll("[data-username]").forEach(el => {
    el.textContent = getName().trim() || "Dashboard";
  });
}

// ---- Φόρτωση όλων ----
export async function loadPrefs() {
  try {
    const [{ data: profile }, cats, quick, gs, pn, acc] = await Promise.all([
      sb.from("profile").select("*").maybeSingle(),
      customCategories.list().catch(() => []),
      quickActions.list().catch(() => []),
      goals.list().catch(() => []),
      pins.list().catch(() => []),
      // Ο πίνακας των λογαριασμών μπορεί να μην έχει δημιουργηθεί ακόμα —
      // τότε η εφαρμογή δουλεύει ακριβώς όπως πριν, χωρίς λογαριασμούς.
      accounts.list().then(rows => ({ rows })).catch(e => ({ rows: [], missing: isMissingTable(e) }))
    ]);
    state = {
      profile, categories: cats, quick, goals: gs, pins: pn,
      accounts: acc.rows, accountsMissing: !!acc.missing,
      avatarUrl: null, loaded: true
    };

    if (profile) {
      // Ο server είναι η πηγή αλήθειας όταν υπάρχει εγγραφή
      if (profile.display_name != null) localStorage.setItem(NAME_KEY, profile.display_name);
      if (profile.accent) localStorage.setItem(ACCENT_KEY, profile.accent);
      if (profile.start_route) localStorage.setItem(START_KEY, profile.start_route);
      if (profile.day_start_hour != null) localStorage.setItem(DAY_START_KEY, String(profile.day_start_hour));
      if (profile.mood_accent != null) localStorage.setItem(MOOD_ON_KEY, profile.mood_accent ? "1" : "0");
      if (Array.isArray(profile.tabs) && profile.tabs.length) localStorage.setItem(TABS_KEY, JSON.stringify(profile.tabs));
      if (Array.isArray(profile.dash_layout) && profile.dash_layout.length) {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(profile.dash_layout));
      }
      if (profile.avatar_path) {
        try { state.avatarUrl = await signedImageUrl(profile.avatar_path); } catch { /* χωρίς εικόνα */ }
      }
    }
  } catch {
    state.loaded = true;      // offline: μένουν οι τοπικές τιμές
  }
  applyAccent();
  paintAvatar();
  paintTabs();
  return state;
}

// Κατηγορίες: οι δικές μου προστίθενται στις προεπιλεγμένες
export function mergedCategories(scope, base) {
  const mine = {};
  for (const c of state.categories.filter(c => c.scope === scope)) mine[c.key] = c.label;
  return { ...base, ...mine };
}
export function categoryColors(scope, base) {
  const mine = {};
  for (const c of state.categories.filter(c => c.scope === scope)) mine[c.key] = c.color;
  return { ...base, ...mine };
}

// ---- Ιεραρχία κατηγοριών ----
// Μία στάθμη βάθους: «Καφές» κρέμεται από το «Φαγητό». Τα σύνολα και τα
// γραφήματα αθροίζουν στη ρίζα· η λίστα δείχνει την ακριβή υποκατηγορία.
export function childrenOf(scope, key) {
  return state.categories.filter(c => c.scope === scope && c.parent === key);
}
export function rootCategory(scope, key) {
  const c = state.categories.find(x => x.scope === scope && x.key === key);
  return c?.parent || key;
}
export const hasSubcategories = scope => state.categories.some(c => c.scope === scope && c.parent);

// Επιλογές <select> με τις υποκατηγορίες φωλιασμένες κάτω από τον γονέα τους
export function categoryOptionsHtml(scope, list, selected) {
  const kids = {};
  for (const c of state.categories.filter(c => c.scope === scope && c.parent)) {
    (kids[c.parent] = kids[c.parent] || []).push(c);
  }
  const option = (v, l) =>
    `<option value="${escapeHtml(v)}" ${selected === v ? "selected" : ""}>${escapeHtml(l)}</option>`;
  return Object.entries(list)
    .filter(([key]) => rootCategory(scope, key) === key)   // οι υποκατηγορίες μπαίνουν μέσα στον γονέα
    .map(([key, label]) => {
      const children = kids[key] || [];
      if (!children.length) return option(key, label);
      return `<optgroup label="${escapeHtml(label)}">
        ${option(key, label)}
        ${children.map(c => option(c.key, c.label)).join("")}
      </optgroup>`;
    }).join("");
}

// ---- Λογαριασμοί ----
export const accountList = () => state.accounts || [];
export const accountById = id => accountList().find(a => a.id === id) || null;

// Ο λογαριασμός που προτείνεται στις φόρμες: ο τελευταίος που χρησιμοποιήθηκε
const ACCOUNT_KEY = "pref:account";
export function defaultAccountId() {
  const saved = localStorage.getItem(ACCOUNT_KEY);
  if (saved && accountById(saved)) return saved;
  return accountList()[0]?.id || null;
}
export function rememberAccount(id) {
  if (id) localStorage.setItem(ACCOUNT_KEY, id);
}
