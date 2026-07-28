import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Auth ----
export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
export function onAuthChange(cb) {
  sb.auth.onAuthStateChange((_event, session) => cb(session));
}
export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: location.origin + location.pathname }
  });
  if (error) throw error;
  return data;
}
export async function signOut() { await sb.auth.signOut(); }

// ---- Offline κατάσταση ----
let offline = false;
const offlineListeners = [];
export function isOffline() { return offline; }
export function onOfflineChange(cb) { offlineListeners.push(cb); }
function setOffline(v) {
  if (offline === v) return;
  offline = v;
  offlineListeners.forEach(cb => cb(v));
}

function isNetworkError(e) {
  return e instanceof TypeError || /fetch|network|Failed to/i.test(e.message || "");
}

// Αν λείπει στήλη από τη βάση (δεν έχει τρέξει ακόμα το migration), αφαίρεσέ την
// και ξαναδοκίμασε, ώστε να μη σπάει η αποθήκευση.
async function withMissingColumnRetry(payload, run) {
  let body = { ...payload };
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await run(body);
    if (!error) return data;
    const missing = error.code === "PGRST204" && /'([^']+)' column/.exec(error.message)?.[1];
    if (!missing || !(missing in body)) throw error;
    delete body[missing];
  }
  throw new Error("Η βάση δεν έχει ενημερωθεί με τα νέα πεδία.");
}

// ---- Data layer: CRUD ανά πίνακα με cache για offline ανάγνωση ----
export function store(table, orderColumn, ascending = true) {
  const cacheKey = "cache:" + table;
  return {
    async list() {
      try {
        let q = sb.from(table).select("*");
        if (orderColumn) q = q.order(orderColumn, { ascending });
        const { data, error } = await q;
        if (error) throw error;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        setOffline(false);
        return data;
      } catch (e) {
        const cached = localStorage.getItem(cacheKey);
        if (cached && isNetworkError(e)) {
          setOffline(true);
          return JSON.parse(cached);
        }
        throw e;
      }
    },
    async insert(row) {
      return withMissingColumnRetry(row, r => sb.from(table).insert(r).select().single());
    },
    async update(id, patch) {
      return withMissingColumnRetry(patch, p => sb.from(table).update(p).eq("id", id).select().single());
    },
    async remove(id) {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) throw error;
    }
  };
}

export const subscriptions = store("subscriptions", "next_date");
export const todos = store("todos", "created_at", false);
export const events = store("events", "event_date");
export const notes = store("notes", "created_at", false);

// ---- ICS token: δημιουργείται μία φορά ανά χρήστη ----
export async function getOrCreateIcsToken() {
  const { data, error } = await sb.from("ics_tokens").select("token").maybeSingle();
  if (error) throw error;
  if (data) return data.token;
  const { data: created, error: e2 } = await sb.from("ics_tokens").insert({}).select().single();
  if (e2) throw e2;
  return created.token;
}
export async function regenerateIcsToken() {
  await sb.from("ics_tokens").delete().neq("token", "00000000-0000-0000-0000-000000000000");
  return getOrCreateIcsToken();
}

// ---- Μετανάστευση παλιών δεδομένων localStorage (μία φορά) ----
export async function migrateLocalData() {
  const raw = localStorage.getItem("my-subscriptions");
  if (!raw) return 0;
  let old;
  try { old = JSON.parse(raw) || []; } catch { old = []; }
  if (!old.length) { localStorage.removeItem("my-subscriptions"); return 0; }
  const existing = await subscriptions.list();
  if (existing.length > 0) return 0; // ήδη υπάρχουν δεδομένα, μην διπλογράψεις
  const rows = old.map(s => ({
    name: s.name, price: s.price, cycle: s.cycle,
    next_date: s.nextDate, color: s.color || "#7c6cf6", category: "other"
  }));
  const { error } = await sb.from("subscriptions").insert(rows);
  if (error) throw error;
  localStorage.setItem("my-subscriptions.imported", raw); // backup
  localStorage.removeItem("my-subscriptions");
  return rows.length;
}
