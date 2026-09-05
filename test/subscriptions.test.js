// Συνδρομές και ημερομηνίες: μερίδια, κύκλοι χρέωσης, δοκιμαστικές περίοδοι.
// Εδώ ζουν τα λάθη που δεν φαίνονται για μήνες — μια χρέωση που πέφτει μια μέρα
// νωρίτερα ή ένα μερίδιο που δεν αθροίζεται στο σύνολο.
import "./setup.js";
import { setDayStart, iso, dayOffset } from "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  isoLocal, today, daysUntil, dayStartHour, members, shareCount, isShared,
  myShare, shareOf, unpaidMembers, nextDue, monthlyCost, isInTrial, trialDaysLeft
} from "../js/ui.js";
import { sumAmounts } from "../js/money.js";

test("isoLocal: τοπική ημερομηνία με μηδενικά μπροστά", () => {
  assert.equal(isoLocal(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(isoLocal(new Date(2026, 11, 31)), "2026-12-31");
});

test("isoLocal: δεν γλιστράει μέρα λόγω ζώνης ώρας", () => {
  // Αργά το βράδυ, το toISOString() θα έδινε την επόμενη μέρα σε θετική ζώνη
  const late = new Date(2026, 5, 15, 23, 45);
  assert.equal(isoLocal(late), "2026-06-15");
});

test("η μέρα αρχίζει στις 00:00 εξ ορισμού", () => {
  setDayStart(0);
  assert.equal(dayStartHour(), 0);
  assert.equal(isoLocal(today()), dayOffset(0));
});

test("με όριο ημέρας, τα ξημερώματα ανήκουν στη χθεσινή μέρα", () => {
  setDayStart(4);
  assert.equal(dayStartHour(), 4);
  const now = new Date();
  const expected = now.getHours() < 4 ? dayOffset(-1) : dayOffset(0);
  assert.equal(isoLocal(today()), expected);
  setDayStart(0);
});

test("μη έγκυρο όριο ημέρας πέφτει πίσω στο μηδέν", () => {
  localStorage.setItem("pref:daystart", "τυχαίο");
  assert.equal(dayStartHour(), 0);
  localStorage.setItem("pref:daystart", "20");
  assert.equal(dayStartHour(), 0, "πάνω από 12 δεν είναι όριο ημέρας");
  setDayStart(0);
});

test("μέλη: ανέχεται null και λάθος τύπο", () => {
  assert.deepEqual(members({}), []);
  assert.deepEqual(members({ members: null }), []);
  assert.deepEqual(members({ members: "κάτι" }), []);
  assert.equal(shareCount({}), 1, "μόνος μου");
  assert.equal(isShared({}), false);
  assert.equal(shareCount({ members: [{ name: "Νίκος" }] }), 2);
  assert.equal(isShared({ members: [{ name: "Νίκος" }] }), true);
});

test("μερίδιο: στρογγυλοποίηση στο λεπτό", () => {
  assert.equal(myShare({ price: 15, members: [] }), 15);
  assert.equal(myShare({ price: 15, members: [{}, {}] }), 5);
  assert.equal(myShare({ price: 10, members: [{}, {}] }), 3.34, "το περισσεύον λεπτό το παίρνω εγώ");
});

test("μερίδια: αθροίζονται ακριβώς στην τιμή", () => {
  for (const [price, people] of [[10, 3], [17.99, 5], [15, 4], [100, 7]]) {
    const sub = { price, members: Array.from({ length: people - 1 }, () => ({})) };
    const all = shareOf(sub);
    assert.equal(all.length, people);
    assert.equal(sumAmounts(all), price, `${price} στα ${people} πρέπει να ξαναδίνει ${price}`);
    assert.equal(all[0], myShare(sub), "το δικό μου μερίδιο είναι το πρώτο");
  }
});

test("απλήρωτα μέλη: μόνο για τον τρέχοντα κύκλο", () => {
  const sub = { price: 12, next_date: dayOffset(5), cycle: "monthly", members: [
    { name: "Νίκος", paid_for: isoLocal(new Date(dayOffset(5) + "T00:00:00")) },
    { name: "Μαρία", paid_for: null },
    { name: "Λία", paid_for: "2020-01-01" }
  ]};
  const unpaid = unpaidMembers(sub).map(m => m.name);
  assert.deepEqual(unpaid, ["Μαρία", "Λία"], "παλιά πληρωμή δεν μετράει για τον νέο κύκλο");
});

test("επόμενη χρέωση: μελλοντική ημερομηνία μένει ως έχει", () => {
  const d = dayOffset(9);
  assert.equal(isoLocal(nextDue({ next_date: d, cycle: "monthly" })), d);
});

test("επόμενη χρέωση: περασμένη ημερομηνία κυλάει μπροστά", () => {
  const past = new Date();
  past.setHours(0, 0, 0, 0);
  past.setMonth(past.getMonth() - 3);
  const due = nextDue({ next_date: iso(past), cycle: "monthly" });
  assert.ok(due >= today(), "η επόμενη χρέωση δεν είναι ποτέ στο παρελθόν");
  assert.equal(due.getDate(), past.getDate(), "κρατά την ημέρα του μήνα");
});

test("επόμενη χρέωση: εβδομαδιαία και ετήσια", () => {
  const past = new Date();
  past.setHours(0, 0, 0, 0);
  past.setDate(past.getDate() - 30);
  const weekly = nextDue({ next_date: iso(past), cycle: "weekly" });
  assert.ok(weekly >= today());
  assert.ok(daysUntil(weekly) < 7, "εβδομαδιαία: μέσα στην επόμενη εβδομάδα");

  const old = new Date();
  old.setHours(0, 0, 0, 0);
  old.setFullYear(old.getFullYear() - 2);
  const yearly = nextDue({ next_date: iso(old), cycle: "yearly" });
  assert.ok(yearly >= today());
  assert.ok(daysUntil(yearly) <= 366);
});

test("δοκιμαστική περίοδος: η λήξη είναι η πρώτη χρέωση", () => {
  const sub = { price: 9, trial_end: dayOffset(5), next_date: dayOffset(35), cycle: "monthly" };
  assert.equal(isInTrial(sub), true);
  assert.equal(trialDaysLeft(sub), 5);
  assert.equal(isoLocal(nextDue(sub)), dayOffset(5), "χρεώνεται όταν λήγει η δοκιμή");
});

test("δοκιμαστική περίοδος: λήγει σήμερα, ακόμα σε δοκιμή", () => {
  assert.equal(isInTrial({ trial_end: dayOffset(0) }), true);
  assert.equal(isInTrial({ trial_end: dayOffset(-1) }), false);
  assert.equal(isInTrial({ trial_end: null }), false);
  assert.equal(isInTrial({}), false);
});

test("μηνιαίο κόστος ανά κύκλο", () => {
  assert.equal(monthlyCost({ price: 12, cycle: "monthly", members: [] }), 12);
  assert.equal(monthlyCost({ price: 120, cycle: "yearly", members: [] }), 10);
  assert.equal(Math.round(monthlyCost({ price: 3, cycle: "weekly", members: [] }) * 100) / 100, 13);
});

test("μηνιαίο κόστος: μετράει το δικό μου μερίδιο", () => {
  const shared = { price: 20, cycle: "monthly", members: [{}, {}, {}] };
  assert.equal(monthlyCost(shared), 5, "τέσσερα άτομα, δικό μου το ένα τέταρτο");
});
