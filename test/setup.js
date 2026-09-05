// Ό,τι χρειάζεται ο browser και δεν υπάρχει στο Node.
// Εισάγεται πρώτο σε κάθε δοκιμή, ώστε να έχει τρέξει πριν φορτωθούν τα modules.
const store = new Map();

globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};

// Το db.js φτιάχνει πελάτη Supabase τη στιγμή που φορτώνεται. Στις δοκιμές δεν
// μιλάμε με τη βάση — χρειάζεται μόνο να μη σκάσει το import.
const noop = () => noop;
globalThis.window = globalThis.window || {};
globalThis.window.supabase = {
  createClient: () => ({
    from: () => new Proxy({}, { get: () => noop }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    storage: { from: () => ({}) }
  })
};
// Το navigator του Node είναι read-only: το συμπληρώνουμε με defineProperty
if (!("onLine" in globalThis.navigator)) {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "node" }, configurable: true
  });
}

// Βοηθός δοκιμών: ορίζει την ώρα που αρχίζει η μέρα
export function setDayStart(hour) {
  if (hour) localStorage.setItem("pref:daystart", String(hour));
  else localStorage.removeItem("pref:daystart");
}

// Ημερομηνία σε τοπική μορφή ISO, για να φτιάχνουμε δεδομένα δοκιμών
export function iso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function dayOffset(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return iso(d);
}
