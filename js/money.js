// Καθαροί υπολογισμοί χρημάτων: υπόλοιπα λογαριασμών και διάμεσος.
// Καμία εξάρτηση από DOM ή βάση — ό,τι μπαίνει εδώ δοκιμάζεται εύκολα.

export const ACCOUNT_KINDS = {
  cash: "Μετρητά",
  card: "Κάρτα",
  bank: "Τράπεζα",
  other: "Άλλο"
};

// Μια μεταφορά δεν είναι ούτε έσοδο ούτε έξοδο: μετακινεί, δεν δημιουργεί.
// Όπου μετράμε ροή (σύνολα, γραφήματα, μέσους όρους) την αφήνουμε απ' έξω.
export const isFlow = e => e.kind === "income" || e.kind === "expense";
export const isTransfer = e => e.kind === "transfer";

// Υπόλοιπο λογαριασμού: το αρχικό ποσό συν ό,τι μπήκε, μείον ό,τι βγήκε.
// Οι μεταφορές μετράνε δύο φορές — αρνητικά στην αφετηρία, θετικά στον προορισμό.
export function accountBalance(account, entries) {
  let sum = Number(account.start_balance) || 0;
  for (const e of entries) {
    const amount = Number(e.amount) || 0;
    if (e.kind === "transfer") {
      if (e.account_id === account.id) sum -= amount;
      if (e.to_account_id === account.id) sum += amount;
    } else if (e.account_id === account.id) {
      sum += e.kind === "income" ? amount : -amount;
    }
  }
  return sum;
}

export function balances(accountList, entries) {
  return accountList.map(a => ({ account: a, balance: accountBalance(a, entries) }));
}

export const totalBalance = (accountList, entries) =>
  balances(accountList, entries).reduce((s, b) => s + b.balance, 0);

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
