// Καταγραφή σφαλμάτων.
//
// Η εφαρμογή έχει δεκάδες σημεία που πιάνουν σφάλμα για να μη σπάσει η οθόνη.
// Χωρίς καταγραφή, ένα σφάλμα στο κινητό εξαφανίζεται: βλέπεις μια κενή κάρτα
// και δεν μαθαίνει ποτέ κανείς τι έγινε. Εδώ μένει το ίχνος.
//
// Κανόνες: η καταγραφή δεν σκάει ποτέ η ίδια, δεν μπλοκάρει τίποτα, και δεν
// στέλνει το ίδιο σφάλμα δεύτερη φορά μέσα στην ίδια συνεδρία.
import { sb } from "./db.js";

const seen = new Set();
const MAX_PER_SESSION = 20;
let sent = 0;

const short = (s, n) => (s == null ? null : String(s).slice(0, n));

export function logError(where, err, extra = {}) {
  try {
    const message = short(err?.message || err, 500) || "άγνωστο σφάλμα";
    const key = where + "|" + message;
    if (seen.has(key) || sent >= MAX_PER_SESSION) return;
    seen.add(key);
    sent++;

    // Fire-and-forget: αν αποτύχει και η ίδια η καταγραφή, σιωπά.
    sb.from("error_log").insert({
      message,
      where_at: short(where, 120),
      stack: short(err?.stack, 2000),
      route: short(location.hash || "#/", 120),
      agent: short(navigator.userAgent, 300),
      ...extra
    }).then(null, () => {});
  } catch { /* η καταγραφή δεν επιτρέπεται να προκαλέσει σφάλμα */ }
}

// Πιάνει ό,τι δεν έπιασε κανείς άλλος
export function initErrorLog() {
  window.addEventListener("error", e => {
    // Τα σφάλματα φόρτωσης πόρων δεν έχουν .error· δεν μας λένε κάτι χρήσιμο
    if (!e.error) return;
    logError("window.error", e.error);
  });
  window.addEventListener("unhandledrejection", e => {
    logError("unhandledrejection", e.reason instanceof Error ? e.reason : { message: String(e.reason) });
  });
}

// Τα τελευταία σφάλματα, για τη σελίδα των Ρυθμίσεων
export async function recentErrors(limit = 20) {
  const { data, error } = await sb.from("error_log")
    .select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function clearErrors() {
  const { error } = await sb.from("error_log").delete().not("id", "is", null);
  if (error) throw error;
}
