// Οι υπολογισμοί χρημάτων: υπόλοιπα λογαριασμών, διάμεσος, ακέραια λεπτά.
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  median, accountBalance, totalBalance, withoutAccount, isFlow, isTransfer,
  toCents, fromCents, sumAmounts, splitAmount
} from "../js/money.js";

test("διάμεσος: κενή σειρά, μονά, ζυγά, αταξινόμητα", () => {
  assert.equal(median([]), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([3, 1, 2]), 2, "δεν προϋποθέτει ταξινομημένη είσοδο");
  assert.equal(median([0, 0, 2.6, 3.2, 12.5, 18, 46.2]), 3.2);
});

test("διάμεσος: αγνοεί ό,τι δεν είναι αριθμός", () => {
  assert.equal(median([1, NaN, 3, undefined, 5]), 3);
});

test("υπόλοιπο λογαριασμού: έσοδα, έξοδα, μεταφορές και στις δύο άκρες", () => {
  const a = { id: "a", start_balance: 100 };
  const b = { id: "b", start_balance: 0 };
  const rows = [
    { kind: "income", amount: 50, account_id: "a" },
    { kind: "expense", amount: 20, account_id: "a" },
    { kind: "transfer", amount: 30, account_id: "a", to_account_id: "b" },
    { kind: "expense", amount: 999, account_id: null }   // χωρίς λογαριασμό: δεν μετράει
  ];
  assert.equal(accountBalance(a, rows), 100);
  assert.equal(accountBalance(b, rows), 30);
});

test("το σύνολο δεν αλλάζει από μεταφορά", () => {
  const a = { id: "a", start_balance: 100 };
  const b = { id: "b", start_balance: 40 };
  const before = totalBalance([a, b], []);
  const after = totalBalance([a, b], [{ kind: "transfer", amount: 25, account_id: "a", to_account_id: "b" }]);
  assert.equal(before, 140);
  assert.equal(after, 140, "η μεταφορά μετακινεί, δεν δημιουργεί");
});

test("υπόλοιπο: δεκαδικά που θα έσπαγαν με floats", () => {
  const a = { id: "a", start_balance: 0 };
  const rows = Array.from({ length: 10 }, () => ({ kind: "expense", amount: 0.1, account_id: "a" }));
  assert.equal(accountBalance(a, rows), -1, "δέκα φορές 0,10 κάνουν ακριβώς 1,00");
});

test("κινήσεις χωρίς λογαριασμό", () => {
  const rows = [
    { kind: "expense", amount: 5, account_id: null },
    { kind: "income", amount: 5, account_id: "a" },
    { kind: "transfer", amount: 5, account_id: null, to_account_id: null }
  ];
  assert.equal(withoutAccount(rows).length, 1, "η μεταφορά δεν είναι ροή");
  assert.equal(rows.filter(isFlow).length, 2);
  assert.equal(rows.filter(isTransfer).length, 1);
});

test("λεπτά: μετατροπή χωρίς απώλεια", () => {
  assert.equal(toCents(12.5), 1250);
  assert.equal(toCents("12,50".replace(",", ".")), 1250);
  assert.equal(toCents(0.1) + toCents(0.2), 30, "0,1 + 0,2 σε λεπτά είναι ακριβώς 30");
  assert.equal(fromCents(30), 0.3);
  assert.equal(toCents(null), 0);
  assert.equal(toCents(undefined), 0);
});

test("άθροισμα ποσών: ακριβές σε πολλές εγγραφές", () => {
  const many = Array.from({ length: 1000 }, () => 0.07);
  assert.equal(sumAmounts(many), 70, "χίλια εφτάλεπτα κάνουν ακριβώς 70");
  assert.equal(sumAmounts([]), 0);
  assert.equal(sumAmounts([{ amount: 1.1 }, { amount: 2.2 }], x => x.amount), 3.3);
});

test("μοιρασμα ποσού: τα μέρη αθροίζονται στο σύνολο", () => {
  for (const [total, parts] of [[10, 3], [17.99, 5], [0.05, 4], [100, 7]]) {
    const shares = splitAmount(total, parts);
    assert.equal(shares.length, parts);
    assert.equal(sumAmounts(shares), total, `${total} στα ${parts} πρέπει να ξαναδίνει ${total}`);
  }
});
