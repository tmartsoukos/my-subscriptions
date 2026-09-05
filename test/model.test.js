// Το μοντέλο της αρχικής: 109 γραμμές που υπολογίζουν κάθε αριθμό της πρώτης
// οθόνης. Καθαρή συνάρτηση — άρα δοκιμάζεται ολόκληρη χωρίς DOM και χωρίς βάση.
import "./setup.js";
import { iso, dayOffset } from "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { buildModel } from "../js/views/dashboard/model.js";
import { prefs } from "../js/prefs.js";
import { today, isoLocal } from "../js/ui.js";

const t = today();
const monthDay = n => iso(new Date(t.getFullYear(), t.getMonth(), n));
const prevMonthDay = n => iso(new Date(t.getFullYear(), t.getMonth() - 1, n));

// Ό,τι δεν δίνει η δοκιμή είναι άδειο — έτσι κάθε έλεγχος αφορά ένα πράγμα
const model = (over = {}) => buildModel({
  subs: [], todoItems: [], evItems: [], finItems: [], noteItems: [], courseItems: [], ...over
});

const entry = (kind, amount, date) => ({ kind, amount, entry_date: date });
const sub = (over = {}) => ({
  id: "s", name: "Netflix", price: 12, cycle: "monthly", category: "streaming",
  next_date: dayOffset(10), trial_end: null, members: [], ...over
});

test("άδεια δεδομένα δεν σπάνε τίποτα", () => {
  const m = model();
  assert.equal(m.monthIn, 0);
  assert.equal(m.monthOut, 0);
  assert.equal(m.monthly, 0);
  assert.equal(m.balance, 0);
  assert.equal(m.hasFinance, false);
  assert.deepEqual(m.debtList, []);
  assert.deepEqual(m.donutItems, []);
  assert.equal(m.mood, 0);
});

test("τα οικονομικά του μήνα κόβονται στην 1η", () => {
  const m = model({ finItems: [
    entry("income", 500, monthDay(2)),
    entry("expense", 20.5, monthDay(3)),
    entry("expense", 999, prevMonthDay(15))   // περασμένος μήνας: δεν μετράει
  ]});
  assert.equal(m.monthIn, 500);
  assert.equal(m.monthOut, 20.5);
  assert.equal(m.monthEntries.length, 2);
  assert.equal(m.hasFinance, true);
});

test("ο προηγούμενος μήνας μετριέται χωριστά", () => {
  const m = model({ finItems: [
    entry("income", 100, monthDay(1)),
    entry("income", 300, prevMonthDay(5)),
    entry("expense", 80, prevMonthDay(20))
  ]});
  assert.equal(m.prevIn, 300);
  assert.equal(m.prevOut, 80);
  assert.equal(m.prevEntries.length, 2);
});

test("αθροίσματα μήνα με ακρίβεια λεπτού", () => {
  const m = model({ finItems: Array.from({ length: 10 }, () => entry("expense", 0.1, monthDay(1))) });
  assert.equal(m.monthOut, 1, "δέκα φορές 0,10 κάνουν ακριβώς 1,00");
});

test("δοκιμές και ενεργές συνδρομές χωρίζονται", () => {
  const m = model({ subs: [
    sub({ id: "a" }),
    sub({ id: "b", trial_end: dayOffset(3) }),
    sub({ id: "c", trial_end: dayOffset(-3) })   // η δοκιμή έληξε: ενεργή
  ]});
  assert.deepEqual(m.trials.map(s => s.id), ["b"]);
  assert.deepEqual(m.active.map(s => s.id), ["a", "c"]);
  assert.equal(m.monthly, 24, "στο μηνιαίο κόστος δεν μετράνε οι δοκιμές");
});

test("δοκιμές που λήγουν: μόνο εντός επτά ημερών, με τη σειρά", () => {
  const m = model({ subs: [
    sub({ id: "far", trial_end: dayOffset(20) }),
    sub({ id: "soon", trial_end: dayOffset(6) }),
    sub({ id: "today", trial_end: dayOffset(0) })
  ]});
  assert.deepEqual(m.endingTrials.map(s => s.id), ["today", "soon"]);
});

test("οφειλές: ανά πρόσωπο, ταξινομημένες, με ακριβές σύνολο", () => {
  const cycle = dayOffset(10);
  const m = model({ subs: [
    sub({ id: "n", price: 10, next_date: cycle, members: [{ name: "Νίκος" }, { name: "Μαρία" }] }),
    sub({ id: "s", price: 9, next_date: cycle, members: [{ name: "Νίκος", paid_for: cycle }] })
  ]});
  // 10 στα τρία: εγώ 3,34 — Νίκος και Μαρία από 3,33
  assert.deepEqual(m.debtList, [["Νίκος", 3.33], ["Μαρία", 3.33]]);
  assert.equal(m.owedTotal, 6.66);
  assert.deepEqual(m.subsOf("Νίκος").map(s => s.id), ["n"], "η πληρωμένη δεν εμφανίζεται");
});

test("επερχόμενες: έως 30 ημέρες, το πολύ πέντε, κατά ημερομηνία", () => {
  const m = model({ subs: [
    sub({ id: "d40", next_date: dayOffset(40) }),
    sub({ id: "d5", next_date: dayOffset(5) }),
    sub({ id: "d20", next_date: dayOffset(20) }),
    sub({ id: "d1", next_date: dayOffset(1) })
  ]});
  assert.deepEqual(m.upcoming.map(s => s.id), ["d1", "d5", "d20"]);
  assert.equal(m.next.id, "d1");
});

test("γεγονότα της εβδομάδας: από σήμερα έως επτά ημέρες", () => {
  const m = model({ evItems: [
    { id: "χθες", event_date: dayOffset(-1) },
    { id: "σήμερα", event_date: dayOffset(0) },
    { id: "εντός", event_date: dayOffset(7) },
    { id: "εκτός", event_date: dayOffset(8) }
  ]});
  assert.deepEqual(m.weekEvents.map(e => e.id), ["σήμερα", "εντός"]);
});

test("κατανομή κατηγοριών: αθροίζει ανά κατηγορία και ταξινομεί", () => {
  const m = model({ subs: [
    sub({ id: "a", price: 10, category: "streaming" }),
    sub({ id: "b", price: 5, category: "streaming" }),
    sub({ id: "c", price: 20, category: "music" })
  ]});
  assert.deepEqual(m.donutItems.map(d => [d.label, d.value]), [["Μουσική", 20], ["Streaming", 15]]);
  assert.ok(m.donutItems.every(d => d.color), "κάθε φέτα έχει χρώμα");
});

test("επείγουσες εργασίες: ληγμένες ή πρώτης προτεραιότητας", () => {
  const m = model({ todoItems: [
    { id: "ok", done: false, due_date: dayOffset(9), priority: 3 },
    { id: "αργεί", done: false, due_date: dayOffset(-1), priority: 3 },
    { id: "σημαντικό", done: false, due_date: null, priority: 1 },
    { id: "έγινε", done: true, due_date: dayOffset(-5), priority: 1 }
  ]});
  assert.equal(m.pendingTodos.length, 3);
  assert.deepEqual(m.urgentTodos.map(x => x.id), ["αργεί", "σημαντικό"]);
});

test("υπόλοιπο μήνα: έσοδα μείον έξοδα μείον συνδρομές", () => {
  const m = model({
    subs: [sub({ price: 10 })],
    finItems: [entry("income", 500, monthDay(1)), entry("expense", 90, monthDay(2))]
  });
  assert.equal(m.balance, 400);
});

test("απομένουν ημέρες μέχρι το τέλος του μήνα", () => {
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  assert.equal(model().daysLeft, last - t.getDate());
});

test("στόχος ορίου: καλός όσο μένεις κάτω", () => {
  prefs().goals = [{ metric: "expense_monthly", target: 500, label: "Όριο" }];
  const under = model({ finItems: [entry("expense", 100, monthDay(1))] });
  assert.equal(under.goalRows[0].isCap, true);
  assert.equal(under.goalRows[0].good, true);
  assert.equal(under.goalRows[0].current, 100);

  const over = model({ finItems: [entry("expense", 700, monthDay(1))] });
  assert.equal(over.goalRows[0].good, false);
  assert.equal(over.goalRows[0].pct, 100, "η μπάρα δεν ξεπερνά το 100%");
  prefs().goals = [];
});

test("στόχος αποταμίευσης: καλός όσο φτάνεις πάνω", () => {
  prefs().goals = [{ metric: "save_monthly", target: 200 }];
  const m = model({ finItems: [entry("income", 500, monthDay(1)), entry("expense", 100, monthDay(2))] });
  assert.equal(m.goalRows[0].isCap, false);
  assert.equal(m.goalRows[0].current, 400);
  assert.equal(m.goalRows[0].good, true);
  prefs().goals = [];
});

test("διάθεση: μέσα στα όρια θετική, εκτός αρνητική, πάντα στο [-1, 1]", () => {
  prefs().goals = [{ metric: "expense_monthly", target: 500 }];
  const calm = model({ finItems: [entry("expense", 50, monthDay(1))] });
  const tight = model({ finItems: [entry("expense", 900, monthDay(1))] });
  assert.ok(calm.mood > 0, "λίγα έξοδα σε σχέση με το όριο");
  assert.ok(tight.mood < 0, "ξεπερασμένο όριο");
  for (const m of [calm, tight]) assert.ok(m.mood >= -1 && m.mood <= 1);
  prefs().goals = [];
});

test("χωρίς στόχους, η διάθεση βγαίνει από το υπόλοιπο", () => {
  const m = model({ finItems: [entry("income", 1000, monthDay(1)), entry("expense", 100, monthDay(2))] });
  assert.ok(m.mood > 0);
  assert.equal(model().mood, 0, "χωρίς οικονομικά, ουδέτερη");
});

test("το μοντέλο επιστρέφει και τα ακατέργαστα δεδομένα", () => {
  const notes = [{ id: "n1" }];
  const m = model({ noteItems: notes });
  assert.equal(m.noteItems, notes);
  assert.equal(m.todayIso, isoLocal(t));
  assert.equal(typeof m.heroOn, "boolean");
  assert.ok(Array.isArray(m.pins));
});
