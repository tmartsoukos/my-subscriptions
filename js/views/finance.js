import { finance, subscriptions } from "../db.js";
import {
  escapeHtml, fmt, fmtDate, fmtDateShort, isoLocal, today, icons, toast, toastAction,
  openModal, confirmModal, bindSwipe, haptic, monthlyCost, isInTrial, micButtonHtml,
  bindMicButtons, collapseRow, bindDrills, nextDue
} from "../ui.js";
import { param } from "../router.js";
import { barChart, donutChart } from "../charts.js";
import { heatmap } from "../heatmap.js";
import { monthCalendar } from "../moneycal.js";
import { median, isFlow, withoutAccount, ACCOUNT_KINDS, balances, totalBalance } from "../money.js";
import {
  prefs, mergedCategories, categoryColors, categoryOptionsHtml, rootCategory, childrenOf,
  accountList, accountById, defaultAccountId, rememberAccount
} from "../prefs.js";

export const INCOME_CATEGORIES = {
  salary: "Μισθός", freelance: "Ελεύθερος επαγγελματίας", scholarship: "Υποτροφία/επίδομα",
  gift: "Δώρο", sale: "Πώληση", refund: "Επιστροφή", settle: "Εξόφληση οφειλής", other_in: "Άλλο"
};
export const EXPENSE_CATEGORIES = {
  food: "Φαγητό", groceries: "Σούπερ μάρκετ", transport: "Μεταφορές", fun: "Διασκέδαση",
  bills: "Λογαριασμοί", rent: "Ενοίκιο", health: "Υγεία", studies: "Σπουδές",
  shopping: "Ψώνια", other_out: "Άλλο"
};
const CAT_COLOR = {
  food: "#bb8130", groceries: "#31a35f", transport: "#4c8dff", fun: "#d963a0",
  bills: "#9a7cf6", rent: "#7b8fd6", health: "#1ba3ba", studies: "#4c8dff",
  shopping: "#d963a0", other_out: "#7b8fd6", subs: "#9a7cf6"
};
const TRANSFER_COLOR = "#8592ad";

// Το σήμα ανέπαφης πληρωμής — τρία τόξα, όπως πάνω σε κάθε κάρτα
const CONTACTLESS = `<svg class="acct-wave" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <path d="M8 7a7 7 0 0 1 0 10"/><path d="M12 4.5a11 11 0 0 1 0 15"/><path d="M4.5 9.5a3.5 3.5 0 0 1 0 5"/>
</svg>`;

// Η σελίδα είχε γίνει έντεκα κάρτες στη σειρά. Τέσσερις καρτέλες με σκοπό
// η καθεμιά· η ενεργή γράφεται στη διαδρομή (#/finance/list) ώστε να επιβιώνει
// σε ανανέωση και να μοιράζεται ως σύνδεσμος.
const TABS = {
  overview: "Επισκόπηση",
  list: "Κινήσεις",
  analysis: "Ανάλυση",
  calendar: "Ημερολόγιο"
};

let items = [];
let subs = [];
let range = "month";       // today | week | month
let tableMissing = false;
let calMonth = null;       // ποιον μήνα δείχνει το ημερολόγιο χρημάτων
let tab = "overview";
let calView = "month";     // month = ο μήνας αναλυτικά, year = οι τελευταίοι 6 μήνες
let sort = "date";         // date | amount
let filters = { text: "", cat: "", account: "", min: "", max: "" };
let filtersOpen = false;

// Αναζήτηση χωρίς τόνους: «καφες» βρίσκει «Καφές»
const strip = s => String(s).normalize("NFD")
  .split("").filter(c => { const n = c.charCodeAt(0); return n < 0x300 || n > 0x36f; })
  .join("").toLowerCase();

// Οι δικές μου κατηγορίες προστίθενται στις προεπιλεγμένες
const cats = kind => mergedCategories(kind, kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);
const colors = () => categoryColors("expense", CAT_COLOR);
const label = e => e.kind === "transfer" ? "Μεταφορά" : (cats(e.kind)[e.category] || "Άλλο");
// Το χρώμα ακολουθεί τη ρίζα: οι υποκατηγορίες ανήκουν οπτικά στον γονέα τους
const catColor = key => colors()[key] || colors()[rootCategory("expense", key)] || "#7b8fd6";
const entryColor = e =>
  e.kind === "transfer" ? TRANSFER_COLOR : e.kind === "income" ? "#31a35f" : catColor(e.category);

const acctName = id => accountById(id)?.name || "χωρίς λογαριασμό";
// Η διαδρομή μιας μεταφοράς. Αν έχουν διαγραφεί και οι δύο λογαριασμοί δεν
// υπάρχει τίποτα χρήσιμο να πούμε — μένει σκέτο «Μεταφορά».
function transferPath(e) {
  const a = accountById(e.account_id)?.name;
  const b = accountById(e.to_account_id)?.name;
  return a || b ? `${a || "—"} → ${b || "—"}` : "";
}

// Επιλογές κατηγορίας για το φίλτρο. Ένα μόνο επίπεδο <optgroup> επιτρέπεται,
// οπότε το κρατάμε για τον διαχωρισμό εξόδων/εσόδων και οι υποκατηγορίες
// δηλώνονται με εσοχή.
function filterCatOptions() {
  const opt = (v, l) => `<option value="${escapeHtml(v)}" ${filters.cat === v ? "selected" : ""}>${escapeHtml(l)}</option>`;
  const scopeOptions = scope => Object.entries(cats(scope))
    .filter(([key]) => rootCategory(scope, key) === key)
    .map(([key, l]) => opt(key, l) +
      childrenOf(scope, key).map(c => opt(c.key, "  " + c.label)).join(""))
    .join("");
  return `<optgroup label="Έξοδα">${scopeOptions("expense")}</optgroup>
    <optgroup label="Έσοδα">${scopeOptions("income")}</optgroup>`;
}

function rangeStart() {
  const t = today();
  if (range === "today") return t;
  const d = new Date(t);
  if (range === "week") d.setDate(d.getDate() - 6);
  else d.setDate(1);
  return d;
}

function inRange(e) {
  return e.entry_date >= isoLocal(rangeStart()) && e.entry_date <= isoLocal(today());
}

// Σταθερά έξοδα συνδρομών, ανηγμένα στην περίοδο που βλέπουμε
function subsCost() {
  const monthly = subs.filter(s => !isInTrial(s)).reduce((sum, s) => sum + monthlyCost(s), 0);
  if (range === "today") return monthly / 30;
  if (range === "week") return monthly * 7 / 30;
  return monthly;
}

// Επιλογή λογαριασμού — εμφανίζεται μόνο αν έχεις ορίσει λογαριασμούς.
// Σε μεταφορά και οι δύο άκρες είναι υποχρεωτικές, οπότε δεν προσφέρουμε κενό.
function accountFieldHtml(selected, id = "fAccount", labelText = "Λογαριασμός", allowNone = true) {
  const list = accountList();
  if (!list.length) return "";
  return `<div class="field">
    <label for="${id}">${labelText}</label>
    <select id="${id}">
      ${allowNone ? `<option value="">— δεν το ξεχωρίζω —</option>` : ""}
      ${list.map(a => `<option value="${a.id}" ${selected === a.id ? "selected" : ""}>
        ${escapeHtml(a.name)}</option>`).join("")}
    </select>
  </div>`;
}

function formHtml(e, kind) {
  return `
    <div class="row2">
      <div class="field">
        <label for="fAmount">Ποσό (€)</label>
        <input type="text" id="fAmount" inputmode="decimal" placeholder="12,50" value="${e ? String(e.amount).replace(".", ",") : ""}">
      </div>
      <div class="field">
        <label for="fDate">Ημερομηνία</label>
        <input type="date" id="fDate" value="${e?.entry_date || isoLocal(today())}">
      </div>
    </div>
    <div class="field">
      <label for="fCat">Κατηγορία</label>
      <select id="fCat">${categoryOptionsHtml(kind, cats(kind), e?.category)}</select>
    </div>
    ${accountFieldHtml(e ? e.account_id : defaultAccountId())}
    <div class="field">
      <label for="fNote">Σημείωση (προαιρετικό)</label>
      <div class="input-with-mic">
        <input type="text" id="fNote" placeholder="π.χ. σουβλάκι με Νίκο" value="${e?.note ? escapeHtml(e.note) : ""}">
        ${micButtonHtml("fNote")}
      </div>
    </div>`;
}

// Μεταφορά: τα λεφτά αλλάζουν θέση, δεν μπαίνουν ούτε βγαίνουν
function transferFormHtml(e) {
  return `
    <div class="row2">
      <div class="field">
        <label for="fAmount">Ποσό (€)</label>
        <input type="text" id="fAmount" inputmode="decimal" placeholder="50,00" value="${e ? String(e.amount).replace(".", ",") : ""}">
      </div>
      <div class="field">
        <label for="fDate">Ημερομηνία</label>
        <input type="date" id="fDate" value="${e?.entry_date || isoLocal(today())}">
      </div>
    </div>
    ${accountFieldHtml(e ? e.account_id : defaultAccountId(), "fFrom", "Από", false)}
    ${accountFieldHtml(e ? e.to_account_id : accountList().find(a => a.id !== defaultAccountId())?.id, "fTo", "Προς", false)}
    <div class="field">
      <label for="fNote">Σημείωση (προαιρετικό)</label>
      <input type="text" id="fNote" placeholder="π.χ. ανάληψη από ΑΤΜ" value="${e?.note ? escapeHtml(e.note) : ""}">
    </div>`;
}

function openForm(entry, kind, rerender, from) {
  const k = entry?.kind || kind;
  const isTransferForm = k === "transfer";
  openModal({
    from,
    title: entry ? "Επεξεργασία"
      : isTransferForm ? "Μεταφορά" : k === "income" ? "Νέο έσοδο" : "Νέο έξοδο",
    body: isTransferForm ? transferFormHtml(entry) : formHtml(entry, k),
    onOpen: overlay => bindMicButtons(overlay),
    onSave: async overlay => {
      const amount = parseFloat(overlay.querySelector("#fAmount").value.replace(",", "."));
      if (isNaN(amount) || amount < 0) { toast("Συμπλήρωσε έγκυρο ποσό.", "error"); return false; }
      const entry_date = overlay.querySelector("#fDate").value || isoLocal(today());
      const note = overlay.querySelector("#fNote").value.trim() || null;

      let row;
      if (isTransferForm) {
        const fromId = overlay.querySelector("#fFrom")?.value || null;
        const toId = overlay.querySelector("#fTo")?.value || null;
        if (!fromId || !toId) { toast("Διάλεξε από πού και πού πάνε τα λεφτά.", "error"); return false; }
        if (fromId === toId) { toast("Οι δύο λογαριασμοί πρέπει να είναι διαφορετικοί.", "error"); return false; }
        row = { kind: "transfer", amount, category: "transfer", entry_date, note, account_id: fromId, to_account_id: toId };
        rememberAccount(fromId);
      } else {
        const account_id = overlay.querySelector("#fAccount")?.value || null;
        row = {
          kind: k, amount, category: overlay.querySelector("#fCat").value,
          entry_date, note, account_id, to_account_id: null
        };
        rememberAccount(account_id);
      }

      if (entry) await finance.update(entry.id, row);
      else await finance.insert(row);
      haptic("ok");
      toast(entry ? "Ενημερώθηκε"
        : isTransferForm ? "Η μεταφορά καταγράφηκε"
        : k === "income" ? "Έσοδο καταχωρήθηκε" : "Έξοδο καταχωρήθηκε");
      await rerender();
    }
  });
}

function entryHtml(e) {
  const income = e.kind === "income";
  const transfer = e.kind === "transfer";
  const color = entryColor(e);
  const bits = [
    e.note ? escapeHtml(e.note) : "",
    transfer ? escapeHtml(transferPath(e))
      : (accountList().length && e.account_id ? escapeHtml(acctName(e.account_id)) : ""),
    fmtDateShort(new Date(e.entry_date + "T00:00:00"))
  ].filter(Boolean);
  return `<div class="swipe-wrap">
    <div class="swipe-bg" aria-hidden="true">
      <span class="sw-delete">${icons.trash} Διαγραφή</span>
      <span class="sw-done">${icons.edit} Επεξεργασία</span>
    </div>
    <div class="card fin-item" data-swipe="${e.id}">
      <div class="logo logo-sm" style="--logo:${color};background:${color}">
        ${transfer ? icons.refresh : income ? icons.chart : icons.wallet}
      </div>
      <div class="card-main">
        <div class="name">${escapeHtml(label(e))}</div>
        <div class="meta">${bits.join(" · ")}</div>
      </div>
      <div class="card-right">
        <div class="price ${transfer ? "amount-move" : income ? "amount-in" : "amount-out"}">${
          transfer ? "" : income ? "+" : "−"}${fmt(e.amount)}</div>
      </div>
      <div class="card-actions">
        <button class="icon-btn" data-edit="${e.id}" aria-label="Επεξεργασία">${icons.edit}</button>
        <button class="icon-btn" data-del="${e.id}" aria-label="Διαγραφή">${icons.trash}</button>
      </div>
    </div>
  </div>`;
}

// Σύνολο εξόδων ανά ημέρα, για τον χάρτη θερμότητας
function expenseByDay() {
  const out = {};
  for (const e of items) {
    if (e.kind === "expense") out[e.entry_date] = (out[e.entry_date] || 0) + Number(e.amount);
  }
  return out;
}

// Ημερήσια έξοδα των τελευταίων 14 ημερών, για το ραβδόγραμμα
function dailySeries() {
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today()); d.setDate(d.getDate() - i);
    const iso = isoLocal(d);
    const sum = items.filter(e => e.kind === "expense" && e.entry_date === iso)
      .reduce((s, e) => s + Number(e.amount), 0);
    out.push({ label: d.toLocaleDateString("el-GR", { day: "numeric" }), value: sum });
  }
  return out;
}

export async function render(view, { cached = false } = {}) {
  try {
    if (!cached) [items, subs] = await Promise.all([finance.list(), subscriptions.list()]);
    tableMissing = false;
  } catch (e) {
    // Ο πίνακας μπορεί να μην έχει δημιουργηθεί ακόμα
    if (/finance_entries/.test(e.message || "") || e.code === "PGRST205" || e.code === "42P01") {
      tableMissing = true;
      items = [];
      subs = await subscriptions.list().catch(() => []);
    } else throw e;
  }

  if (tableMissing) {
    view.innerHTML = `
      <div class="page-head"><h1>Οικονομικά</h1></div>
      <div class="settings-block">
        <h3>${icons.wallet} Χρειάζεται ένα βήμα</h3>
        <p>Ο πίνακας των εγγραφών δεν υπάρχει ακόμα στη βάση. Τρέξε αυτό στο SQL Editor του Supabase:</p>
        <pre class="sql-box">create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  amount numeric(10,2) not null check (amount >= 0),
  category text not null default 'other',
  note text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.finance_entries enable row level security;
create policy "own finance" on public.finance_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);</pre>
      </div>`;
    return;
  }

  const quick = (prefs().quick || []).filter(q => q.kind !== "todo");
  const accts = accountList();
  if (!calMonth) calMonth = new Date(today().getFullYear(), today().getMonth(), 1);
  // Η διαδρομή ορίζει την καρτέλα· το «expense»/«income» το χειρίζεται η συντόμευση πιο κάτω
  const routed = param();
  if (TABS[routed]) tab = routed;

  const shown = items.filter(inRange).sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at));
  const flow = shown.filter(isFlow);
  const income = flow.filter(e => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expense = flow.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const fixed = subsCost();
  const periodFlow = income - expense - fixed;

  // Πραγματικό υπόλοιπο: το αρχικό κάθε λογαριασμού συν όλη η ροή, όχι μόνο η περίοδος
  const acctBalances = balances(accts, items);
  const available = totalBalance(accts, items);
  const orphans = withoutAccount(items);

  const todayIso = isoLocal(today());
  const todayIn = items.filter(e => e.entry_date === todayIso && e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const todayOut = items.filter(e => e.entry_date === todayIso && e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);

  const days = Math.max(1, Math.round((today() - rangeStart()) / 86400000) + 1);
  const perDay = (expense + fixed) / days;

  // ---- Έξοδα ανά ημέρα της περιόδου, για τη διάμεσο ----
  // Στη διάμεσο μετράνε και οι μέρες χωρίς έξοδο: αλλιώς θα έδειχνε τη συνηθισμένη
  // μέρα «όταν ξοδεύεις», που είναι άλλο πράγμα από τη συνηθισμένη σου μέρα.
  const byDay = {};
  for (const e of flow.filter(e => e.kind === "expense")) {
    byDay[e.entry_date] = (byDay[e.entry_date] || 0) + Number(e.amount);
  }
  const dayTotals = [];
  for (const d = new Date(rangeStart()); isoLocal(d) <= todayIso; d.setDate(d.getDate() + 1)) {
    dayTotals.push(byDay[isoLocal(d)] || 0);
  }
  const medianDay = median(dayTotals);

  // ---- Κατανομή εξόδων: οι υποκατηγορίες αθροίζονται στη ρίζα τους ----
  const byCat = {};      // ανά ρίζα, για γράφημα και σύνολα
  const byLeaf = {};     // ανά ακριβή κατηγορία, για την ανάλυση
  for (const e of flow.filter(e => e.kind === "expense")) {
    const root = rootCategory("expense", e.category);
    byCat[root] = (byCat[root] || 0) + Number(e.amount);
    byLeaf[e.category] = (byLeaf[e.category] || 0) + Number(e.amount);
  }
  const donutItems = Object.entries(byCat)
    .map(([c, v]) => ({ label: cats("expense")[c] || "Άλλο", value: v, color: catColor(c) }))
    .concat(fixed > 0 ? [{ label: "Συνδρομές", value: fixed, color: CAT_COLOR.subs }] : [])
    .sort((a, b) => b.value - a.value);

  // ---- Κινήσεις: φιλτράρισμα και ταξινόμηση ----
  // Τα φίλτρα αγγίζουν μόνο τη λίστα. Τα σύνολα, τα γραφήματα και το ημερολόγιο
  // δείχνουν πάντα ολόκληρη την περίοδο — αλλιώς οι αριθμοί θα έλεγαν ψέματα.
  const q = strip(filters.text.trim());
  const min = parseFloat(String(filters.min).replace(",", "."));
  const max = parseFloat(String(filters.max).replace(",", "."));
  const rootOf = e => rootCategory(e.kind === "income" ? "income" : "expense", e.category);
  const filtered = shown.filter(e => {
    // Η επιλογή γονικής κατηγορίας πιάνει και τις υποκατηγορίες της
    if (filters.cat && filters.cat !== e.category && filters.cat !== rootOf(e)) return false;
    if (filters.account && filters.account !== e.account_id && filters.account !== e.to_account_id) return false;
    if (!isNaN(min) && Number(e.amount) < min) return false;
    if (!isNaN(max) && Number(e.amount) > max) return false;
    if (q && !strip(`${e.note || ""} ${label(e)}`).includes(q)) return false;
    return true;
  });
  const byAmount = sort === "amount";
  const listRows = byAmount ? [...filtered].sort((a, b) => Number(b.amount) - Number(a.amount)) : filtered;
  const filterOn = !!(filters.cat || filters.account || filters.text.trim() || filters.min || filters.max);
  const listNet = listRows.filter(isFlow)
    .reduce((s, e) => s + (e.kind === "income" ? 1 : -1) * Number(e.amount), 0);

  // Ομαδοποίηση ανά ημέρα
  const groups = {};
  for (const e of filtered) (groups[e.entry_date] = groups[e.entry_date] || []).push(e);

  const accountsBlock = accts.length ? `
    <div class="accounts">
      ${acctBalances.map(({ account: a, balance }) => {
        // Το είδος μπαίνει μόνο όταν λέει κάτι παραπάνω από το όνομα —
        // «Μετρητά / Μετρητά» είναι θόρυβος
        const kind = ACCOUNT_KINDS[a.kind] || "";
        const showKind = kind && kind.toLowerCase() !== (a.name || "").trim().toLowerCase();
        // Τσιπ και ανέπαφη πληρωμή μόνο όπου βγάζουν νόημα: τα μετρητά δεν είναι πλαστικό
        const plastic = a.kind === "card" || a.kind === "bank";
        return `<button class="acct-card ${plastic ? "plastic" : "acct-" + a.kind}"
          data-drill="acct:${a.id}" style="--c:${escapeHtml(a.color || "#4c8dff")}">
          <span class="acct-card-top" aria-hidden="true">
            ${plastic ? `<span class="acct-chip"></span>${CONTACTLESS}` : `<span class="acct-mark">${icons.wallet}</span>`}
          </span>
          <strong class="acct-balance ${balance < 0 ? "negative" : ""}">${fmt(balance)}</strong>
          <span class="acct-card-foot">
            <span class="acct-name">${escapeHtml(a.name)}</span>
            ${showKind ? `<span class="acct-kind">${escapeHtml(kind)}</span>` : ""}
          </span>
        </button>`;
      }).join("")}
    </div>
    ${orphans.length ? `<p class="hint orphan-hint" data-drill="noacct">
      ${orphans.length === 1 ? "Μία κίνηση δεν έχει" : `${orphans.length} κινήσεις δεν έχουν`} λογαριασμό —
      τα υπόλοιπα δεν τις μετράνε.</p>` : ""}` : "";

  // ---- Τα περιεχόμενα κάθε καρτέλας ----

  const statsBlock = `<div class="stats">
    ${accts.length ? `<div class="stat" data-drill="available"><div class="label">Διαθέσιμα</div>
      <div class="value ${available < 0 ? "amount-out" : ""}">${fmt(available)}</div></div>` : ""}
    <div class="stat" data-drill="today"><div class="label">Σήμερα</div>
      <div class="value today-value">
        <span class="${todayIn ? "amount-in" : ""}">+${fmt(todayIn)}</span>
        <span class="${todayOut ? "amount-out" : ""}">−${fmt(todayOut)}</span>
      </div>
    </div>
    <div class="stat" data-drill="income"><div class="label">Έσοδα περιόδου</div><div class="value amount-in">${fmt(income)}</div></div>
    <div class="stat" data-drill="expense"><div class="label">Έξοδα περιόδου</div><div class="value amount-out">${fmt(expense + fixed)}</div></div>
    <div class="stat" data-drill="balance"><div class="label">Ροή περιόδου</div>
      <div class="value ${periodFlow >= 0 ? "amount-in" : "amount-out"}">${periodFlow >= 0 ? "+" : "−"}${fmt(Math.abs(periodFlow))}</div>
    </div>
    <div class="stat" data-drill="perday"><div class="label">Μέσο ημερήσιο έξοδο</div>
      <div class="value">${fmt(perDay)}</div>
      <div class="stat-sub">διάμεσος ${fmt(medianDay)}</div>
    </div>
  </div>`;

  // Η ανάλυση χρησιμοποιείται και ως καρτέλα και ως φύλλο που ανοίγει από την
  // επισκόπηση — μέσα στο φύλλο ο σύνδεσμος προς τις συνδρομές θα άφηνε
  // ορφανό ανοιχτό modal, οπότε λείπει.
  const analysisBlock = ({ withLink = true } = {}) => `
    ${shown.length || fixed > 0 ? `<div class="charts">
      <div class="chart-card">
        <h3>Έξοδα ανά ημέρα (14 ημέρες)</h3>
        ${barChart(dailySeries())}
      </div>
      <div class="chart-card">
        <h3>Πού πάνε τα λεφτά</h3>
        ${donutItems.length ? donutChart(donutItems, Math.round(expense + fixed) + "€")
          : `<p class="hint">Καμία δαπάνη στην περίοδο.</p>`}
      </div>
    </div>` : `<p class="hint">Καμία δαπάνη στην περίοδο.</p>`}

    <div class="chart-card fixed-card">
      <h3>Σταθερά έξοδα</h3>
      <div class="fixed-row">
        <span>${subs.filter(s => !isInTrial(s)).length} συνδρομές</span>
        <strong class="amount-out">${fmt(fixed)}</strong>
      </div>
      ${withLink ? `<a href="#/subs" class="btn btn-ghost" style="margin-top:10px">${icons.card} Διαχείριση συνδρομών</a>` : ""}
    </div>`;

  // Ημερολόγιο και χάρτης θερμότητας απαντούσαν στην ίδια ερώτηση σε δύο
  // κάρτες. Ίδια θέση, διακόπτης: ο μήνας αναλυτικά ή το εξάμηνο συνολικά.
  const calendarBlock = `<div class="chart-card">
    <div class="card-head-row">
      <h3>${calView === "month" ? "Ημερολόγιο χρημάτων" : "Ημέρες με έξοδα"}</h3>
      <div class="seg seg-sm" role="group" aria-label="Προβολή ημερολογίου">
        <button class="seg-btn ${calView === "month" ? "active" : ""}" data-calview="month">Μήνας</button>
        <button class="seg-btn ${calView === "year" ? "active" : ""}" data-calview="year">6 μήνες</button>
      </div>
    </div>
    ${calView === "month"
      ? monthCalendar({ month: calMonth, entries: items, subs })
      : items.some(e => e.kind === "expense")
        ? heatmap(expenseByDay(), { format: fmt, empty: "χωρίς έξοδα" })
        : `<p class="hint">Καμία δαπάνη ακόμα.</p>`}
  </div>`;

  // Η αναζήτηση και η ταξινόμηση είναι πάντα εδώ· τα υπόλοιπα φίλτρα ανοίγουν
  // όταν τα ζητήσεις, ώστε η λίστα να μη σπρώχνεται εκτός οθόνης.
  const activeFilters = [filters.cat, filters.account, filters.min, filters.max].filter(Boolean).length;
  const filterBar = `<div class="filter-bar">
    <input type="search" id="fq" class="filter-search" placeholder="Αναζήτηση σε σημειώσεις και κατηγορίες"
      value="${escapeHtml(filters.text)}" aria-label="Αναζήτηση κινήσεων">
    <div class="filter-bar-row">
      <button class="btn btn-ghost btn-sm" id="btnToggleFilters" aria-expanded="${filtersOpen}">
        ${icons.dots} Φίλτρα${activeFilters ? ` · ${activeFilters}` : ""}
      </button>
      <select id="fSort" aria-label="Ταξινόμηση">
        <option value="date" ${sort === "date" ? "selected" : ""}>Νεότερα πρώτα</option>
        <option value="amount" ${sort === "amount" ? "selected" : ""}>Μεγαλύτερο ποσό</option>
      </select>
    </div>
    ${filtersOpen ? `<div class="filter-bar-row">
      <select id="fCatFilter" aria-label="Κατηγορία">
        <option value="">Όλες οι κατηγορίες</option>
        ${filterCatOptions()}
      </select>
      ${accts.length ? `<select id="fAcctFilter" aria-label="Λογαριασμός">
        <option value="">Όλοι οι λογαριασμοί</option>
        ${accts.map(a => `<option value="${a.id}" ${filters.account === a.id ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("")}
      </select>` : ""}
      <div class="filter-amounts">
        <input type="text" id="fMin" class="filter-num" inputmode="decimal" placeholder="από €"
          value="${escapeHtml(filters.min)}" aria-label="Ελάχιστο ποσό">
        <input type="text" id="fMax" class="filter-num" inputmode="decimal" placeholder="έως €"
          value="${escapeHtml(filters.max)}" aria-label="Μέγιστο ποσό">
      </div>
      ${filterOn ? `<button class="btn btn-ghost btn-sm" id="btnClearFilters">${icons.x} Καθαρισμός</button>` : ""}
    </div>` : ""}
    ${listRows.length ? `<p class="hint filter-count">${listRows.length} ${listRows.length === 1 ? "κίνηση" : "κινήσεις"} ·
      καθαρό <span class="${listNet >= 0 ? "amount-in" : "amount-out"}">${listNet >= 0 ? "+" : "−"}${fmt(Math.abs(listNet))}</span></p>` : ""}
  </div>`;

  const listBody = listRows.length
    ? (byAmount
      ? `<div class="section-title day-head"><span>Κατά ποσό</span></div>
         <div class="list">${listRows.map(entryHtml).join("")}</div>`
      : Object.entries(groups).map(([date, list]) => {
          const dayIn = list.filter(e => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
          const dayOut = list.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
          return `<div class="section-title day-head">
              <span>${date === todayIso ? "Σήμερα" : fmtDate(new Date(date + "T00:00:00"))}</span>
              <span class="day-sum">${dayIn ? `<span class="amount-in">+${fmt(dayIn)}</span>` : ""} ${dayOut ? `<span class="amount-out">−${fmt(dayOut)}</span>` : ""}</span>
            </div>
            <div class="list">${list.map(entryHtml).join("")}</div>`;
        }).join(""))
    : filterOn
      ? `<div class="empty">${icons.wallet}<p>Καμία κίνηση με αυτά τα φίλτρα.</p>
         <button class="btn btn-ghost" id="btnClearFiltersEmpty">${icons.x} Καθαρισμός φίλτρων</button></div>`
      : `<div class="empty">${icons.wallet}<p>Καμία εγγραφή σε αυτή την περίοδο.</p>
         <button class="btn btn-primary" id="btnExpenseEmpty">${icons.plus} Πρώτο έξοδο</button></div>`;

  const overviewBlock = `
    ${accountsBlock}
    ${statsBlock}
    ${quick.length ? `<div class="quick-row">
      ${quick.map(q => `<button class="quick-chip ${q.kind === "income" ? "in" : "out"}" data-quick="${q.id}">
        <span>${escapeHtml(q.label)}</span>${q.amount != null ? `<strong>${q.kind === "income" ? "+" : "−"}${fmt(q.amount)}</strong>` : ""}
      </button>`).join("")}
    </div>` : ""}
    <button class="btn btn-ghost" id="btnAnalysis">${icons.chart} Πού πάνε τα λεφτά</button>`;

  view.innerHTML = `
    <div class="page-head">
      <h1>Οικονομικά</h1>
      <div class="head-actions">
        ${accts.length > 1 ? `<button class="btn btn-ghost" id="btnTransfer" aria-label="Μεταφορά μεταξύ λογαριασμών">
          ${icons.refresh}<span class="btn-label">Μεταφορά</span></button>` : ""}
        <button class="btn btn-ghost" id="btnIncome">${icons.plus} Έσοδο</button>
        <button class="btn btn-primary" id="btnExpense">${icons.plus} Έξοδο</button>
      </div>
    </div>

    <div class="seg fin-tabs" role="tablist" aria-label="Ενότητες οικονομικών">
      ${Object.entries(TABS).map(([id, l]) =>
        `<button class="seg-btn ${tab === id ? "active" : ""}" data-tab="${id}"
          role="tab" aria-selected="${tab === id}">${l}</button>`).join("")}
    </div>

    ${tab === "calendar" ? "" : `<div class="filters">
      ${[["today", "Σήμερα"], ["week", "7 ημέρες"], ["month", "Αυτόν τον μήνα"]].map(([v, l]) =>
        `<button class="filter-chip ${range === v ? "active" : ""}" data-range="${v}">${l}</button>`).join("")}
    </div>`}

    ${tab === "overview" ? overviewBlock
      : tab === "list" ? filterBar + listBody
      : tab === "analysis" ? analysisBlock()
      : calendarBlock}
  `;

  const rerender = (cached = false) => render(view, { cached });

  // Ανάλυση των αριθμών της περιόδου
  const entryRow = e => ({
    label: label(e), color: entryColor(e),
    meta: [
      e.note || "",
      e.kind === "transfer" ? transferPath(e) : "",
      fmtDateShort(new Date(e.entry_date + "T00:00:00"))
    ].filter(Boolean).join(" · "),
    value: (e.kind === "income" ? "+" : e.kind === "expense" ? "−" : "") + fmt(e.amount),
    cls: e.kind === "income" ? "amount-in" : e.kind === "expense" ? "amount-out" : ""
  });

  const drills = {
    today: () => ({
      title: "Σήμερα",
      rows: items.filter(e => e.entry_date === todayIso).map(entryRow),
      total: fmt(todayIn - todayOut), totalLabel: "Καθαρό σήμερα"
    }),
    income: () => ({
      title: "Έσοδα περιόδου",
      total: fmt(income), totalLabel: "Σύνολο",
      rows: flow.filter(e => e.kind === "income").map(entryRow)
    }),
    expense: () => ({
      title: "Έξοδα περιόδου",
      total: fmt(expense + fixed), totalLabel: "Σύνολο",
      rows: Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .map(([c, v]) => {
          const kids = childrenOf("expense", c)
            .map(k => [k.label, byLeaf[k.key] || 0]).filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1]);
          const n = flow.filter(e => e.kind === "expense" && rootCategory("expense", e.category) === c).length;
          return {
            label: cats("expense")[c] || "Άλλο", color: catColor(c),
            meta: kids.length
              ? kids.map(([l, v2]) => `${l} ${fmt(v2)}`).join(" · ")
              : `${n} ${n === 1 ? "εγγραφή" : "εγγραφές"}`,
            value: fmt(v), cls: "amount-out"
          };
        })
        .concat(fixed > 0 ? [{
          label: "Συνδρομές", color: CAT_COLOR.subs,
          meta: `${subs.filter(s => !isInTrial(s)).length} ενεργές, ανηγμένες στην περίοδο`,
          value: fmt(fixed), cls: "amount-out"
        }] : [])
    }),
    balance: () => ({
      title: "Ροή περιόδου",
      total: (periodFlow >= 0 ? "+" : "−") + fmt(Math.abs(periodFlow)), totalLabel: "Απομένουν",
      rows: [
        { label: "Έσοδα", value: "+" + fmt(income), cls: "amount-in" },
        { label: "Έξοδα", value: "−" + fmt(expense), cls: "amount-out" },
        { label: "Συνδρομές", value: "−" + fmt(fixed), cls: "amount-out" }
      ],
      note: "Πόσα μπήκαν και βγήκαν μέσα στην περίοδο. Πόσα έχεις συνολικά το λέει το «Διαθέσιμα»."
    }),
    perday: () => ({
      title: "Μέσο ημερήσιο έξοδο",
      total: fmt(perDay), totalLabel: `${fmt(expense + fixed)} σε ${days} ${days === 1 ? "ημέρα" : "ημέρες"}`,
      rows: [
        { label: "Διάμεσος ημέρας", value: fmt(medianDay) },
        ...Object.entries(byDay).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([d, v]) => ({
          label: d === todayIso ? "Σήμερα" : fmtDate(new Date(d + "T00:00:00")),
          value: fmt(v), cls: "amount-out"
        }))
      ],
      note: "Στον μέσο όρο μετράνε και οι συνδρομές. Η διάμεσος μετράει μόνο τις εγγραφές σου και δείχνει τη συνηθισμένη μέρα — ένα ακριβό ψώνιο δεν την παρασύρει."
    })
  };

  if (accts.length) {
    drills.available = () => ({
      title: "Διαθέσιμα",
      total: fmt(available), totalLabel: "Σε όλους τους λογαριασμούς",
      rows: acctBalances.map(({ account: a, balance }) => ({
        label: a.name, color: a.color,
        meta: `${ACCOUNT_KINDS[a.kind] || "Λογαριασμός"} · αρχικό ${fmt(a.start_balance)}`,
        value: fmt(balance), cls: balance < 0 ? "amount-out" : ""
      })),
      note: orphans.length ? `${orphans.length} κινήσεις δεν έχουν λογαριασμό και δεν μετράνε εδώ.` : ""
    });
    drills.noacct = () => ({
      title: "Κινήσεις χωρίς λογαριασμό",
      rows: orphans.slice(0, 30).map(entryRow),
      note: "Άνοιξε την καθεμιά και διάλεξε λογαριασμό για να συμφωνήσουν τα υπόλοιπα."
    });
    for (const { account: a, balance } of acctBalances) {
      drills["acct:" + a.id] = () => ({
        title: a.name,
        total: fmt(balance), totalLabel: "Τρέχον υπόλοιπο",
        rows: [
          { label: "Αρχικό υπόλοιπο", value: fmt(a.start_balance) },
          ...items.filter(e => e.account_id === a.id || e.to_account_id === a.id)
            .slice(0, 20)
            .map(e => ({
              ...entryRow(e),
              // Σε μεταφορά, το πρόσημο εξαρτάται από ποια άκρη είναι αυτός ο λογαριασμός
              value: e.kind === "transfer"
                ? (e.to_account_id === a.id ? "+" : "−") + fmt(e.amount)
                : entryRow(e).value,
              cls: e.kind === "transfer"
                ? (e.to_account_id === a.id ? "amount-in" : "amount-out")
                : entryRow(e).cls
            }))
        ]
      });
    }
  }

  // Οι μέρες του ημερολογίου φτιάχνουν τα κλειδιά τους δυναμικά
  view.querySelectorAll("[data-drill^='day:']").forEach(el => {
    const iso = el.dataset.drill.slice(4);
    drills[el.dataset.drill] = () => {
      const list = items.filter(e => e.entry_date === iso);
      const planned = subs.filter(s => isoLocal(nextDue(s)) === iso);
      const out = list.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
      return {
        title: fmtDate(new Date(iso + "T00:00:00")),
        total: fmt(out), totalLabel: "Έξοδα ημέρας",
        rows: [
          ...list.map(entryRow),
          ...planned.map(s => ({
            label: s.name, color: s.color, meta: "προγραμματισμένη χρέωση",
            value: fmt(s.price), cls: "amount-out"
          }))
        ]
      };
    };
  });

  bindDrills(view, drills);

  view.querySelector("#btnIncome")?.addEventListener("click", () => openForm(null, "income", rerender));
  view.querySelector("#btnExpense")?.addEventListener("click", () => openForm(null, "expense", rerender));
  view.querySelector("#btnExpenseEmpty")?.addEventListener("click", () => openForm(null, "expense", rerender));
  view.querySelector("#btnTransfer")?.addEventListener("click", () => openForm(null, "transfer", rerender));
  view.querySelectorAll("[data-range]").forEach(b =>
    b.addEventListener("click", () => { range = b.dataset.range; rerender(true); }));

  // Αλλαγή καρτέλας: τα δεδομένα είναι ήδη εδώ, οπότε μόνο επανασχεδίαση.
  // Το replaceState γράφει την καρτέλα στη διαδρομή χωρίς να πυροδοτήσει hashchange.
  view.querySelectorAll("[data-tab]").forEach(b =>
    b.addEventListener("click", () => {
      tab = b.dataset.tab;
      history.replaceState(null, "", "#/finance" + (tab === "overview" ? "" : "/" + tab));
      rerender(true);
      view.scrollIntoView?.({ block: "start" });
    }));

  view.querySelectorAll("[data-calview]").forEach(b =>
    b.addEventListener("click", () => { calView = b.dataset.calview; rerender(true); }));

  view.querySelector("#btnAnalysis")?.addEventListener("click", () => {
    openModal({ title: "Πού πάνε τα λεφτά", closeLabel: "Κλείσιμο", body: analysisBlock({ withLink: false }) });
  });

  // ---- Φίλτρα και ταξινόμηση ----
  // Η αναζήτηση δεν ξανασχεδιάζει σε κάθε πλήκτρο: περιμένει να σταματήσεις.
  const searchInput = view.querySelector("#fq");
  if (searchInput) {
    let timer = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        filters.text = searchInput.value;
        const at = searchInput.selectionStart;
        rerender(true).then(() => {
          // Μετά την επανασχεδίαση το πεδίο είναι καινούργιο — του δίνουμε πίσω
          // την εστίαση και τη θέση του δρομέα, αλλιώς χάνεται η πληκτρολόγηση
          const next = view.querySelector("#fq");
          if (next) { next.focus(); next.setSelectionRange(at, at); }
        });
      }, 260);
    });
  }
  const bindFilter = (sel, apply) => view.querySelector(sel)?.addEventListener("change", e => {
    apply(e.target.value);
    rerender(true);
  });
  bindFilter("#fCatFilter", v => { filters.cat = v; });
  bindFilter("#fAcctFilter", v => { filters.account = v; });
  bindFilter("#fSort", v => { sort = v; });
  bindFilter("#fMin", v => { filters.min = v; });
  bindFilter("#fMax", v => { filters.max = v; });

  view.querySelector("#btnToggleFilters")?.addEventListener("click", () => {
    filtersOpen = !filtersOpen;
    rerender(true);
  });

  const clearFilters = () => { filters = { text: "", cat: "", account: "", min: "", max: "" }; rerender(true); };
  view.querySelector("#btnClearFilters")?.addEventListener("click", clearFilters);
  view.querySelector("#btnClearFiltersEmpty")?.addEventListener("click", clearFilters);
  view.querySelectorAll("[data-cal]").forEach(b =>
    b.addEventListener("click", () => {
      calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(b.dataset.cal), 1);
      rerender(true);   // τα δεδομένα είναι ήδη εδώ, αλλάζει μόνο ο μήνας
    }));

  async function removeEntry(e) {
    haptic("warn");
    const backup = [...items];
    await collapseRow(document.querySelector(`[data-swipe="${e.id}"]`)?.closest(".swipe-wrap"));
    items = items.filter(x => x.id !== e.id);   // αισιόδοξη ενημέρωση
    await rerender(true);
    try {
      await finance.remove(e.id);
      toastAction("Η εγγραφή διαγράφηκε", "Αναίρεση", async () => {
        await finance.insert({
          id: e.id, kind: e.kind, amount: e.amount, category: e.category,
          note: e.note, entry_date: e.entry_date,
          account_id: e.account_id || null, to_account_id: e.to_account_id || null
        });
        await rerender();
      });
    } catch (err) {
      items = backup;
      await rerender(true);
      toast("Δεν διαγράφηκε", "error");
    }
  }

  view.querySelectorAll("[data-swipe]").forEach(card => {
    const e = items.find(x => x.id === card.dataset.swipe);
    bindSwipe(card, {
      onLeft: () => openForm(e, e.kind, rerender, card),
      onRight: () => removeEntry(e)
    });
  });

  view.querySelectorAll("[data-quick]").forEach(btn => btn.addEventListener("click", async () => {
    const q = quick.find(x => x.id === btn.dataset.quick);
    if (!q) return;
    haptic("ok");
    try {
      await finance.insert({
        kind: q.kind, amount: Number(q.amount || 0),
        category: q.category || (q.kind === "income" ? "other_in" : "other_out"),
        note: q.label, entry_date: isoLocal(today()),
        account_id: defaultAccountId()
      });
      toast(`${q.label} — καταχωρήθηκε`);
      await rerender();
    } catch {
      toast("Δεν καταχωρήθηκε", "error");
    }
  }));

  view.onclick = async ev => {
    const editBtn = ev.target.closest("[data-edit]");
    const delBtn = ev.target.closest("[data-del]");
    if (editBtn) {
      const e = items.find(x => x.id === editBtn.dataset.edit);
      openForm(e, e.kind, rerender, editBtn.closest(".card"));
    }
    if (delBtn) {
      const e = items.find(x => x.id === delBtn.dataset.del);
      confirmModal(`Διαγραφή εγγραφής ${fmt(e.amount)};`, () => removeEntry(e));
    }
  };

  // Συντόμευση από την αρχική οθόνη του κινητού: #/finance/expense ή #/finance/income.
  // Καθαρίζουμε τη διαδρομή πρώτα, ώστε μια ανανέωση ή μια επιστροφή πίσω
  // να μην ξανανοίγει τη φόρμα. Το replaceState δεν πυροδοτεί hashchange.
  const shortcut = param();
  if (shortcut === "income" || shortcut === "expense") {
    history.replaceState(null, "", "#/finance");
    // Ο router εστιάζει το #view μόλις τελειώσει το render. Αν ανοίγαμε τη φόρμα
    // εδώ, θα του έπαιρνε την εστίαση από το πεδίο του ποσού και δεν θα άνοιγε
    // το πληκτρολόγιο — γι' αυτό περιμένουμε να ολοκληρωθεί πρώτα εκείνος.
    setTimeout(() => openForm(null, shortcut, rerender), 0);
  }
}
