// Καθαροί υπολογισμοί χρημάτων: υπόλοιπα λογαριασμών, διάμεσος, ακέραια λεπτά.
// Καμία εξάρτηση από DOM ή βάση — ό,τι μπαίνει εδώ δοκιμάζεται εύκολα.

export const ACCOUNT_KINDS = {
  cash: "Μετρητά",
  card: "Κάρτα",
  bank: "Τράπεζα",
  other: "Άλλο"
};

// ---- Ακέραια λεπτά ----
// Τα χρήματα δεν αθροίζονται σε δεκαδικούς JavaScript: το 0.1 + 0.2 δεν κάνει 0.3
// και το λάθος μεγαλώνει με κάθε εγγραφή. Κάθε πράξη γίνεται σε λεπτά και η
// μετατροπή πίσω σε ευρώ γίνεται μία φορά, στο τέλος.
export const toCents = n => Math.round((Number(n) || 0) * 100);
export const fromCents = c => c / 100;

// Άθροισμα ποσών με ακρίβεια λεπτού. Το pick λέει πού βρίσκεται το ποσό.
export function sumAmounts(list, pick = x => x) {
  let cents = 0;
  for (const item of list) cents += toCents(pick(item));
  return fromCents(cents);
}

// Μοιρασιά ποσού σε ίσα μέρη, με τα περισσευούμενα λεπτά στα πρώτα μέρη.
// Έτσι τα εμφανιζόμενα μερίδια αθροίζονται πάντα στο αρχικό ποσό.
export function splitAmount(total, parts) {
  const n = Math.max(1, Math.round(parts));
  const cents = toCents(total);
  const base = Math.trunc(cents / n);
  let rest = cents - base * n;
  return Array.from({ length: n }, () => fromCents(base + (rest-- > 0 ? 1 : 0)));
}

// Μια μεταφορά δεν είναι ούτε έσοδο ούτε έξοδο: μετακινεί, δεν δημιουργεί.
// Όπου μετράμε ροή (σύνολα, γραφήματα, μέσους όρους) την αφήνουμε απ' έξω.
export const isFlow = e => e.kind === "income" || e.kind === "expense";
export const isTransfer = e => e.kind === "transfer";

// Υπόλοιπο λογαριασμού: το αρχικό ποσό συν ό,τι μπήκε, μείον ό,τι βγήκε.
// Οι μεταφορές μετράνε δύο φορές — αρνητικά στην αφετηρία, θετικά στον προορισμό.
export function accountBalance(account, entries) {
  let cents = toCents(account.start_balance);
  for (const e of entries) {
    const amount = toCents(e.amount);
    if (e.kind === "transfer") {
      if (e.account_id === account.id) cents -= amount;
      if (e.to_account_id === account.id) cents += amount;
    } else if (e.account_id === account.id) {
      cents += e.kind === "income" ? amount : -amount;
    }
  }
  return fromCents(cents);
}

export function balances(accountList, entries) {
  return accountList.map(a => ({ account: a, balance: accountBalance(a, entries) }));
}

export const totalBalance = (accountList, entries) =>
  sumAmounts(balances(accountList, entries), b => b.balance);

// Κινήσεις που δεν έχουν δηλώσει λογαριασμό. Όσο υπάρχουν, το άθροισμα των
// υπολοίπων δεν συμφωνεί με τη ροή — γι' αυτό τις δείχνουμε ξεχωριστά.
export const withoutAccount = entries => entries.filter(e => isFlow(e) && !e.account_id);

// Η τυπική τιμή μιας σειράς. Ο μέσος όρος παρασύρεται από ένα ακραίο ποσό·
// η διάμεσος δείχνει τη συνηθισμένη μέρα ή το συνηθισμένο έξοδο.
export function median(values) {
  const v = values.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
