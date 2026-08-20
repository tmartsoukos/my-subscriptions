// Σήμανση στο εικονίδιο της εφαρμογής (Badging API).
// Δουλεύει σε εγκατεστημένο PWA — iOS 16.4+, Android/Chrome, desktop Chrome/Edge.
import { todos, subscriptions } from "./db.js";
import { isoLocal, today, nextDue } from "./ui.js";

const supported = () => "setAppBadge" in navigator;

// Εκπρόθεσμες ή σημερινές εργασίες + χρεώσεις που πέφτουν σήμερα
export function badgeCount(todoList, subList) {
  const t = isoLocal(today());
  const tasks = (todoList || []).filter(x => !x.done && x.due_date && x.due_date <= t).length;
  const pays = (subList || []).filter(s => isoLocal(nextDue(s)) === t).length;
  return tasks + pays;
}

export async function setBadge(count) {
  if (!supported()) return;
  try {
    if (count > 0) await navigator.setAppBadge(count);
    else await navigator.clearAppBadge();
  } catch { /* η άδεια μπορεί να λείπει — αγνοείται */ }
}

// Υπολογισμός από τη βάση (ή από το cache όταν είμαστε offline)
export async function refreshBadge() {
  if (!supported()) return;
  try {
    const [todoList, subList] = await Promise.all([todos.list(), subscriptions.list()]);
    await setBadge(badgeCount(todoList, subList));
  } catch { /* χωρίς δίκτυο δεν πειράζουμε τη σήμανση */ }
}
