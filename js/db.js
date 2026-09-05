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
  if (navigator.onLine === false) return true;
  return e instanceof TypeError || /fetch|network|Failed to/i.test(e.message || "");
}

// Ο πίνακας δεν υπάρχει στη βάση — λείπει το αντίστοιχο migration.
// Δεν είναι σφάλμα δικτύου: η εφαρμογή απλώς προχωράει χωρίς τη λειτουργία.
export function isMissingTable(e) {
  return e?.code === "PGRST205" || e?.code === "42P01" ||
    /Could not find the table|does not exist/i.test(e?.message || "");
}

// ---- Ουρά αλλαγών εκτός σύνδεσης ----
// Ό,τι γράφεται χωρίς δίκτυο μπαίνει σε ουρά, εφαρμόζεται τοπικά στο cache,
// και στέλνεται με τη σειρά μόλις επιστρέψει η σύνδεση.
const QUEUE_KEY = "queue:ops";
const queueListeners = [];

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
}
function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  queueListeners.forEach(cb => cb(q.length));
}
export function onQueueChange(cb) { queueListeners.push(cb); }
export function queuedCount() { return readQueue().length; }

function enqueue(op) {
  writeQueue([...readQueue(), { ...op, at: Date.now() }]);
  requestBackgroundSync();
}

// Ζητάμε από το λειτουργικό να μας ξυπνήσει όταν γυρίσει το δίκτυο. Χωρίς αυτό,
// η ουρά φεύγει μόνο όταν ανοίξεις ξανά την εφαρμογή.
export function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then(reg => reg.sync?.register("flush-queue"))
    .catch(() => { /* το Background Sync δεν υπάρχει παντού — δεν πειράζει */ });
}

const cacheOf = table => {
  try { return JSON.parse(localStorage.getItem("cache:" + table)) || []; } catch { return []; }
};
const putCache = (table, rows) => localStorage.setItem("cache:" + table, JSON.stringify(rows));

const newId = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    }));

function runOp(op) {
  if (op.op === "insert") return withMissingColumnRetry(op.row, r => sb.from(op.table).insert(r).select().single());
  if (op.op === "update") return withMissingColumnRetry(op.patch, p => sb.from(op.table).update(p).eq("id", op.id).select().single());
  return sb.from(op.table).delete().eq("id", op.id).then(({ error }) => { if (error) throw error; });
}

let flushing = false;
// Επιστρέφει { done, dropped, reasons }. Οι πράξεις φεύγουν με τη σειρά που έγιναν·
// αν πέσει πάλι το δίκτυο, ό,τι μένει περιμένει την επόμενη φορά.
export async function flushQueue() {
  if (flushing) return { done: 0, dropped: 0, reasons: [] };
  flushing = true;
  let done = 0, dropped = 0;
  const reasons = [];
  try {
    let q = readQueue();
    while (q.length) {
      const op = q[0];
      try {
        await runOp(op);
        done++;
      } catch (e) {
        if (isNetworkError(e)) { setOffline(true); return { done, dropped, reasons }; }
        dropped++;   // μόνιμο σφάλμα (π.χ. η εγγραφή δεν υπάρχει πια) — δεν ξαναδοκιμάζεται
        reasons.push(`${op.op} ${op.table}: ${e.message || e}`);
      }
      q.shift();
      writeQueue(q);
    }
    if (done) setOffline(false);
  } finally {
    flushing = false;
  }
  return { done, dropped, reasons };
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
        // Πρώτα φεύγουν οι αλλαγές που έγιναν εκτός σύνδεσης, μετά διαβάζουμε
        if (readQueue().length) await flushQueue();
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
      try {
        const data = await withMissingColumnRetry(row, r => sb.from(table).insert(r).select().single());
        setOffline(false);
        return data;
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        setOffline(true);
        // Το id δίνεται εδώ ώστε οι επόμενες αλλαγές στην ίδια εγγραφή να το βρίσκουν
        const local = { created_at: new Date().toISOString(), ...row, id: row.id || newId() };
        putCache(table, [...cacheOf(table), local]);
        enqueue({ op: "insert", table, row: local });
        return local;
      }
    },
    async update(id, patch) {
      try {
        const data = await withMissingColumnRetry(patch, p => sb.from(table).update(p).eq("id", id).select().single());
        setOffline(false);
        return data;
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        setOffline(true);
        const rows = cacheOf(table).map(r => r.id === id ? { ...r, ...patch } : r);
        putCache(table, rows);
        enqueue({ op: "update", table, id, patch });
        return rows.find(r => r.id === id) || { id, ...patch };
      }
    },
    // Μόνο ό,τι πέφτει μέσα σε ένα διάστημα ημερομηνιών. Έτσι η σελίδα κατεβάζει
    // την περίοδο που βλέπεις, όχι όλη την ιστορία σου.
    async between(column, from, to, { limit } = {}) {
      const inRange = r => r[column] >= from && r[column] <= to;
      try {
        if (readQueue().length) await flushQueue();
        let q = sb.from(table).select("*").gte(column, from).lte(column, to);
        if (orderColumn) q = q.order(orderColumn, { ascending });
        if (limit) q = q.limit(limit);
        const { data, error } = await q;
        if (error) throw error;
        setOffline(false);
        return data;
      } catch (e) {
        if (isNetworkError(e)) {
          setOffline(true);
          return cacheOf(table).filter(inRange);
        }
        throw e;
      }
    },
    // Ελεύθερο ερώτημα, για τις περιπτώσεις που δεν καλύπτει το between
    async query(build) {
      const { data, error } = await build(sb.from(table).select("*"));
      if (error) throw error;
      return data || [];
    },
    // Πόσες εγγραφές ταιριάζουν, χωρίς να κατέβει καμία
    async count(build = q => q) {
      const { count, error } = await build(sb.from(table).select("id", { count: "exact", head: true }));
      if (error) throw error;
      return count || 0;
    },
    async remove(id) {
      try {
        const { error } = await sb.from(table).delete().eq("id", id);
        if (error) throw error;
        setOffline(false);
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        setOffline(true);
        putCache(table, cacheOf(table).filter(r => r.id !== id));
        enqueue({ op: "remove", table, id });
      }
    }
  };
}

export const subscriptions = store("subscriptions", "next_date");
export const todos = store("todos", "created_at", false);
export const events = store("events", "event_date");
export const notes = store("notes", "updated_at", false);
export const watchlist = store("watchlist", "created_at", false);
export const courses = store("courses", "semester");
export const health = store("health_items", "item_date");
export const finance = store("finance_entries", "entry_date", false);
export const accounts = store("accounts", "sort");

// ---- Όψεις μόνο για ανάγνωση ----
// Τα αθροίσματα τα κάνει η βάση· εδώ μόνο τα διαβάζουμε.
export function view(name) {
  return {
    async list(build = q => q) {
      const { data, error } = await build(sb.from(name).select("*"));
      if (error) throw error;
      return data || [];
    }
  };
}

export const accountBalancesView = view("account_balances");
export const financeDailyView = view("finance_daily");
export const financeStatsView = view("finance_stats");

// ---- Εικόνες σημειώσεων (ιδιωτικός κάδος, πρόσβαση με signed URL) ----
const BUCKET = "note-images";

export async function uploadNoteImage(file) {
  const { data: { user } } = await sb.auth.getUser();
  const ext = (file.name?.split(".").pop() || "png").toLowerCase().slice(0, 5);
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/png", upsert: false
  });
  if (error) throw error;
  return path;
}

const signedCache = new Map();
export async function signedImageUrl(path) {
  const hit = signedCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  signedCache.set(path, { url: data.signedUrl, expires: Date.now() + 3000 * 1000 });
  return data.signedUrl;
}

export async function deleteNoteImage(path) {
  await sb.storage.from(BUCKET).remove([path]);
  signedCache.delete(path);
}

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
