// Οι προγραμματισμένες χρεώσεις μέσα σε ένα διάστημα.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { chargeDates } from "../js/moneycal.js";

// Σταθερό παράθυρο στο μέλλον, ώστε η δοκιμή να μην εξαρτάται από τη σημερινή μέρα
const YEAR = new Date().getFullYear() + 2;
const from = `${YEAR}-03-01`;
const to = `${YEAR}-03-31`;

test("μηνιαία συνδρομή: μία χρέωση στον μήνα", () => {
  const dates = chargeDates({ next_date: `${YEAR}-03-12`, cycle: "monthly" }, from, to);
  assert.deepEqual(dates, [`${YEAR}-03-12`]);
});

test("εβδομαδιαία συνδρομή: πολλές χρεώσεις στον ίδιο μήνα", () => {
  const dates = chargeDates({ next_date: `${YEAR}-03-03`, cycle: "weekly" }, from, to);
  assert.deepEqual(dates, [`${YEAR}-03-03`, `${YEAR}-03-10`, `${YEAR}-03-17`, `${YEAR}-03-24`, `${YEAR}-03-31`]);
});

test("ετήσια συνδρομή εκτός διαστήματος: καμία χρέωση", () => {
  const dates = chargeDates({ next_date: `${YEAR}-07-04`, cycle: "yearly" }, from, to);
  assert.deepEqual(dates, []);
});

test("χρέωση πριν την αρχή του διαστήματος δεν μετράει", () => {
  const dates = chargeDates({ next_date: `${YEAR}-02-10`, cycle: "monthly" }, from, to);
  assert.deepEqual(dates, [`${YEAR}-03-10`], "κυλάει μπροστά, δεν επιστρέφει τον Φεβρουάριο");
});

test("δοκιμαστική περίοδος: πρώτη χρέωση όταν λήγει η δοκιμή", () => {
  const sub = { next_date: `${YEAR}-03-25`, trial_end: `${YEAR}-03-08`, cycle: "monthly" };
  assert.equal(chargeDates(sub, from, to)[0], `${YEAR}-03-08`);
});

test("το διάστημα δεν γίνεται ποτέ ατέρμονο", () => {
  const dates = chargeDates({ next_date: `${YEAR}-01-01`, cycle: "weekly" }, `${YEAR}-01-01`, `${YEAR + 5}-01-01`);
  assert.ok(dates.length <= 40, "υπάρχει όριο επαναλήψεων");
});
