// Απαντήσεις σε απλές ελληνικές ερωτήσεις, από τα δεδομένα που έχει ήδη η εφαρμογή.
// Τρέχει τοπικά — καμία κλήση σε server, δουλεύει και εκτός σύνδεσης.
import {
  fmt, fmtDate, fmtDateShort, isoLocal, today, daysUntil,
  nextDue, myShare, monthlyCost, isInTrial, unpaidMembers
} from "./ui.js";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "./views/finance.js";
import { mergedCategories } from "./prefs.js";

const strip = s => s.normalize("NFD").split("").filter(c => { const n = c.charCodeAt(0); return n < 0x300 || n > 0x36f; }).join("").toLowerCase();

const MONTHS = [
  ["ιανουαρ", 0], ["φεβρουαρ", 1], ["μαρτ", 2], ["απριλ", 3], ["μαι", 4], ["ιουν", 5],
  ["ιουλ", 6], ["αυγουστ", 7], ["σεπτεμβρ", 8], ["οκτωβρ", 9], ["νοεμβρ", 10], ["δεκεμβρ", 11]
];
const MONTH_NAMES = ["Ιανουάριο", "Φεβρουάριο", "Μάρτιο", "Απρίλιο", "Μάιο", "Ιούνιο",
  "Ιούλιο", "Αύγουστο", "Σεπτέμβριο", "Οκτώβριο", "Νοέμβριο", "Δεκέμβριο"];

// Ποια περίοδο αφορά η ερώτηση
export function parsePeriod(q) {
  const t = today();
  const day = n => { const d = new Date(t); d.setDate(d.getDate() + n); return d; };
  if (/\bσημερα\b/.test(q)) return { from: t, to: t, label: "σήμερα" };
  if (/\bχθες\b/.test(q)) return { from: day(-1), to: day(-1), label: "χθες" };
  if (/εβδομαδα/.test(q)) return { from: day(-6), to: t, label: "τις τελευταίες 7 ημέρες" };
  if (/(περασμενο|προηγουμενο) μηνα/.test(q)) {
    const from = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const to = new Date(t.getFullYear(), t.getMonth(), 0);
    return { from, to, label: "τον " + MONTH_NAMES[from.getMonth()] };
  }
  for (const [stem, idx] of MONTHS) {
    if (new RegExp("\\b" + stem).test(q)) {
      let year = t.getFullYear();
      if (idx > t.getMonth()) year--;                       // μήνας που δεν έχει έρθει ακόμα = πέρσι
      return {
        from: new Date(year, idx, 1), to: new Date(year, idx + 1, 0),
        label: "τον " + MONTH_NAMES[idx] + (year !== t.getFullYear() ? " " + year : "")
      };
    }
  }
  if (/\bφετος\b/.test(q)) return { from: new Date(t.getFullYear(), 0, 1), to: t, label: "φέτος" };
  return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: t, label: "αυτόν τον μήνα" };
}

// Ποια κατηγορία εξόδου/εσόδου αναφέρει η ερώτηση
function findCategory(q, kind) {
  const map = mergedCategories(kind, kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);
  for (const [key, label] of Object.entries(map)) {
    const norm = strip(label);
    if (norm.length < 3) continue;
    const stem = norm.length > 5 ? norm.slice(0, norm.length - 2) : norm;
    if (q.includes(norm) || q.includes(stem)) return { key, label };
  }
  return null;
}

const sum = list => list.reduce((s, e) => s + Number(e.amount), 0);
const inPeriod = (e, p) => e.entry_date >= isoLocal(p.from) && e.entry_date <= isoLocal(p.to);

function entryRows(list, catMap) {
  return [...list]
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    .slice(0, 12)
    .map(e => ({
      label: catMap[e.category] || "Άλλο",
      meta: `${e.note ? e.note + " · " : ""}${fmtDateShort(new Date(e.entry_date + "T00:00:00"))}`,
      value: (e.kind === "income" ? "+" : "−") + fmt(e.amount),
      cls: e.kind === "income" ? "amount-in" : "amount-out"
    }));
}

// ---- Πρόσφατες ερωτήσεις ----
// Οι τρεις τελευταίες γίνονται κουμπιά, ώστε να μη γράφεις ξανά ό,τι ρωτάς συχνά.
const RECENT_KEY = "ask:recent";
const RECENT_MAX = 3;

export function recentQuestions() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(list) ? list.filter(x => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

export function rememberQuestion(question) {
  const q = (question || "").trim();
  if (!q) return;
  const norm = q.toLowerCase();
  const list = [q, ...recentQuestions().filter(x => x.toLowerCase() !== norm)].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export const EXAMPLES = [
  "πόσα ξόδεψα σε φαγητό αυτόν τον μήνα;",
  "πόσα έβγαλα τον περασμένο μήνα;",
  "πόσο πληρώνω σε συνδρομές;",
  "τι έχω σήμερα;",
  "τι μου χρωστάνε;",
  "ποιος είναι ο μέσος όρος μου;"
];

// Επιστρέφει { text, rows, title }
export function answer(question, data = {}) {
  const q = strip(question || "").replace(/[;?.!]/g, " ").replace(/\s+/g, " ").trim();
  const subs = data.subs || [], todos = data.todos || [], events = data.events || [];
  const finance = data.finance || [], courses = data.courses || [];
  const expCats = mergedCategories("expense", EXPENSE_CATEGORIES);
  const incCats = mergedCategories("income", INCOME_CATEGORIES);
  const t = today(), todayIso = isoLocal(t);

  if (!q) return { text: "Ρώτησέ με κάτι — για παράδειγμα «πόσα ξόδεψα σε φαγητό αυτόν τον μήνα;»." };

  // ---- Οφειλές ----
  if (/χρωστ/.test(q)) {
    const debts = {};
    for (const s of subs) for (const m of unpaidMembers(s)) debts[m.name] = (debts[m.name] || 0) + myShare(s);
    const list = Object.entries(debts).sort((a, b) => b[1] - a[1]);
    if (!list.length) return { text: "Δεν σου χρωστάει κανείς — όλοι έχουν πληρώσει." };
    const total = list.reduce((s, [, v]) => s + v, 0);
    return {
      title: "Μου χρωστάνε",
      text: `Σου χρωστάνε συνολικά ${fmt(total)}.`,
      rows: list.map(([name, v]) => ({
        label: name, value: fmt(v),
        meta: subs.filter(s => unpaidMembers(s).some(m => m.name === name)).map(s => s.name).join(", ")
      }))
    };
  }

  // ---- Μέσος όρος / βαθμοί ----
  if (/μεσο ορο|μεσος ορος|βαθμ/.test(q)) {
    const graded = courses.filter(c => c.grade != null && c.status === "passed");
    if (!graded.length) return { text: "Δεν έχεις περασμένα μαθήματα με βαθμό ακόμα." };
    const withEcts = graded.filter(c => c.ects);
    const ectsSum = withEcts.reduce((s, c) => s + Number(c.ects), 0);
    const avg = withEcts.length === graded.length && ectsSum > 0
      ? graded.reduce((s, c) => s + Number(c.grade) * Number(c.ects), 0) / ectsSum
      : graded.reduce((s, c) => s + Number(c.grade), 0) / graded.length;
    return {
      title: "Μέσος όρος",
      text: `Ο μέσος όρος σου είναι ${avg.toFixed(2).replace(".", ",")} από ${graded.length} μαθήματα.`,
      rows: graded.sort((a, b) => b.grade - a.grade).map(c => ({
        label: c.name, color: c.color, value: String(c.grade).replace(".", ","),
        meta: c.ects ? `${c.ects} ECTS` : "χωρίς ECTS"
      }))
    };
  }

  // ---- Πότε πληρώνω το X ----
  if (/ποτε|πληρωνω το|χρεωνεται/.test(q)) {
    const hit = subs.find(s => q.includes(strip(s.name)));
    if (hit) {
      const d = nextDue(hit), n = daysUntil(d);
      const when = n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`;
      return {
        title: hit.name,
        text: `Το ${hit.name} χρεώνεται ${when}, στις ${fmtDate(d)}, ${fmt(myShare(hit))}.`
      };
    }
  }

  // ---- Συνδρομές ----
  if (/συνδρομ/.test(q)) {
    const active = subs.filter(s => !isInTrial(s));
    const monthly = active.reduce((s, x) => s + monthlyCost(x), 0);
    return {
      title: "Συνδρομές",
      text: `Πληρώνεις ${fmt(monthly)} τον μήνα για ${active.length} συνδρομές — ${fmt(monthly * 12)} τον χρόνο.`,
      rows: [...active].sort((a, b) => monthlyCost(b) - monthlyCost(a)).map(s => ({
        label: s.name, color: s.color, value: fmt(monthlyCost(s)),
        meta: `επόμενη χρέωση ${fmtDateShort(nextDue(s))}`
      }))
    };
  }

  // ---- Τι έχω σήμερα / αύριο ----
  // «τι έχω να κάνω» είναι ερώτηση για εργασίες, όχι για το πρόγραμμα της ημέρας
  if (/τι εχω|προγραμμα|υποχρεωσεις/.test(q) && !/να κανω/.test(q)) {
    const isTomorrow = /αυριο/.test(q);
    const target = new Date(t);
    if (isTomorrow) target.setDate(target.getDate() + 1);
    const iso = isoLocal(target);
    const rows = [
      ...events.filter(e => e.event_date === iso).map(e => ({
        label: e.title, color: e.color, value: e.event_time ? e.event_time.slice(0, 5) : "", meta: "υποχρέωση"
      })),
      ...todos.filter(x => !x.done && x.due_date === iso).map(x => ({ label: x.title, meta: "εργασία" })),
      ...subs.filter(s => isoLocal(nextDue(s)) === iso).map(s => ({
        label: s.name, color: s.color, value: fmt(myShare(s)), meta: "χρέωση"
      }))
    ];
    const when = isTomorrow ? "αύριο" : "σήμερα";
    return {
      title: isTomorrow ? "Αύριο" : "Σήμερα",
      text: rows.length ? `${when.charAt(0).toUpperCase() + when.slice(1)} έχεις ${rows.length} ${rows.length === 1 ? "πράγμα" : "πράγματα"}.`
        : `${when.charAt(0).toUpperCase() + when.slice(1)} δεν έχεις τίποτα προγραμματισμένο.`,
      rows
    };
  }

  // ---- Εκκρεμείς εργασίες ----
  if (/εργασι|να κανω|εκκρεμ/.test(q)) {
    const open = todos.filter(x => !x.done);
    if (!open.length) return { text: "Δεν έχεις εκκρεμείς εργασίες." };
    const late = open.filter(x => x.due_date && x.due_date < todayIso).length;
    return {
      title: "Εκκρεμείς εργασίες",
      text: `Έχεις ${open.length} εκκρεμείς${late ? `, από τις οποίες ${late === 1 ? "μία εκπρόθεσμη" : `${late} εκπρόθεσμες`}` : ""}.`,
      rows: [...open]
        .sort((a, b) => a.priority - b.priority || (a.due_date || "9999").localeCompare(b.due_date || "9999"))
        .map(x => ({
          label: x.title,
          meta: x.due_date ? fmtDateShort(new Date(x.due_date + "T00:00:00")) : "χωρίς προθεσμία",
          value: x.due_date && x.due_date < todayIso ? "εκπρόθεσμη" : "",
          cls: "amount-out"
        }))
    };
  }

  // ---- Έσοδα ----
  if (/εβγαλα|εσοδ|μπηκαν|κερδισα/.test(q)) {
    const p = parsePeriod(q);
    const list = finance.filter(e => e.kind === "income" && inPeriod(e, p));
    const cat = findCategory(q, "income");
    const shown = cat ? list.filter(e => e.category === cat.key) : list;
    return {
      title: "Έσοδα",
      text: shown.length
        ? `Έβγαλες ${fmt(sum(shown))}${cat ? ` από ${cat.label}` : ""} ${p.label}.`
        : `Δεν έχεις καταγράψει έσοδα${cat ? ` από ${cat.label}` : ""} ${p.label}.`,
      rows: entryRows(shown, incCats)
    };
  }

  // ---- Υπόλοιπο ----
  if (/υπολοιπ|εμειναν|μενουν/.test(q)) {
    const p = parsePeriod(q);
    const list = finance.filter(e => inPeriod(e, p));
    const income = sum(list.filter(e => e.kind === "income"));
    const expense = sum(list.filter(e => e.kind === "expense"));
    const fixed = subs.filter(s => !isInTrial(s)).reduce((s, x) => s + monthlyCost(x), 0);
    const balance = income - expense - fixed;
    return {
      title: "Υπόλοιπο",
      text: `${p.label.charAt(0).toUpperCase() + p.label.slice(1)}: έσοδα ${fmt(income)}, έξοδα ${fmt(expense + fixed)} μαζί με τις συνδρομές. Απομένουν ${fmt(balance)}.`,
      rows: [
        { label: "Έσοδα", value: "+" + fmt(income), cls: "amount-in" },
        { label: "Έξοδα", value: "−" + fmt(expense), cls: "amount-out" },
        { label: "Συνδρομές", value: "−" + fmt(fixed), cls: "amount-out" }
      ]
    };
  }

  // ---- Έξοδα (και η προεπιλογή για ό,τι μοιάζει με οικονομικό ερώτημα) ----
  if (/ξοδεψα|εδωσα|εξοδ|πληρωσα|ποσα|κοστ/.test(q)) {
    const p = parsePeriod(q);
    const cat = findCategory(q, "expense");
    const list = finance.filter(e => e.kind === "expense" && inPeriod(e, p));
    const shown = cat ? list.filter(e => e.category === cat.key) : list;
    if (!shown.length) {
      return { text: `Δεν βρήκα έξοδα${cat ? ` σε ${cat.label}` : ""} ${p.label}.` };
    }
    const total = sum(shown);
    const days = Math.max(1, Math.round((Math.min(p.to, t) - p.from) / 86400000) + 1);
    return {
      title: cat ? cat.label : "Έξοδα",
      text: `Ξόδεψες ${fmt(total)}${cat ? ` σε ${cat.label}` : ""} ${p.label} — ${fmt(total / days)} τη μέρα κατά μέσο όρο.`,
      rows: cat ? entryRows(shown, expCats) : (() => {
        const byCat = {};
        for (const e of shown) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
        return Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({
          label: expCats[c] || "Άλλο", value: fmt(v), cls: "amount-out"
        }));
      })()
    };
  }

  return {
    unknown: true,
    text: "Δεν το κατάλαβα. Δοκίμασε κάτι σαν: " + EXAMPLES.slice(0, 3).map(x => `«${x}»`).join(", ")
  };
}
