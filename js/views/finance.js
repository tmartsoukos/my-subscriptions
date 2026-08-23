import { finance, subscriptions } from "../db.js";
import {
  escapeHtml, fmt, fmtDate, fmtDateShort, isoLocal, today, icons, toast, toastAction,
  openModal, confirmModal, bindSwipe, haptic, monthlyCost, isInTrial, micButtonHtml, bindMicButtons, collapseRow
} from "../ui.js";
import { barChart, donutChart } from "../charts.js";
import { prefs, mergedCategories, categoryColors } from "../prefs.js";

export const INCOME_CATEGORIES = {
  salary: "Μισθός", freelance: "Ελεύθερος επαγγελματίας", scholarship: "Υποτροφία/επίδομα",
  gift: "Δώρο", sale: "Πώληση", refund: "Επιστροφή", other_in: "Άλλο"
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

let items = [];
let subs = [];
let range = "month";       // today | week | month
let tableMissing = false;

// Οι δικές μου κατηγορίες προστίθενται στις προεπιλεγμένες
const cats = kind => mergedCategories(kind, kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);
const colors = () => categoryColors("expense", CAT_COLOR);
const label = e => cats(e.kind)[e.category] || "Άλλο";

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

function formHtml(e, kind) {
  const list = cats(kind);
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
      <select id="fCat">
        ${Object.entries(list).map(([v, l]) =>
          `<option value="${v}" ${e?.category === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label for="fNote">Σημείωση (προαιρετικό)</label>
      <div class="input-with-mic">
        <input type="text" id="fNote" placeholder="π.χ. σουβλάκι με Νίκο" value="${e?.note ? escapeHtml(e.note) : ""}">
        ${micButtonHtml("fNote")}
      </div>
    </div>`;
}

function openForm(entry, kind, rerender, from) {
  const k = entry?.kind || kind;
  openModal({
    from,
    title: entry ? "Επεξεργασία" : k === "income" ? "Νέο έσοδο" : "Νέο έξοδο",
    body: formHtml(entry, k),
    onOpen: overlay => bindMicButtons(overlay),
    onSave: async overlay => {
      const amount = parseFloat(overlay.querySelector("#fAmount").value.replace(",", "."));
      if (isNaN(amount) || amount < 0) { toast("Συμπλήρωσε έγκυρο ποσό.", "error"); return false; }
      const row = {
        kind: k,
        amount,
        category: overlay.querySelector("#fCat").value,
        entry_date: overlay.querySelector("#fDate").value || isoLocal(today()),
        note: overlay.querySelector("#fNote").value.trim() || null
      };
      if (entry) await finance.update(entry.id, row);
      else await finance.insert(row);
      haptic("ok");
      toast(entry ? "Ενημερώθηκε" : k === "income" ? "Έσοδο καταχωρήθηκε" : "Έξοδο καταχωρήθηκε");
      await rerender();
    }
  });
}

function entryHtml(e) {
  const income = e.kind === "income";
  return `<div class="swipe-wrap">
    <div class="swipe-bg" aria-hidden="true">
      <span class="sw-delete">${icons.trash} Διαγραφή</span>
      <span class="sw-done">${icons.edit} Επεξεργασία</span>
    </div>
    <div class="card fin-item" data-swipe="${e.id}">
      <div class="logo logo-sm" style="--logo:${income ? "#31a35f" : colors()[e.category] || "#7b8fd6"};background:${income ? "#31a35f" : colors()[e.category] || "#7b8fd6"}">
        ${income ? icons.chart : icons.wallet}
      </div>
      <div class="card-main">
        <div class="name">${escapeHtml(label(e))}</div>
        <div class="meta">${e.note ? escapeHtml(e.note) + " · " : ""}${fmtDateShort(new Date(e.entry_date + "T00:00:00"))}</div>
      </div>
      <div class="card-right">
        <div class="price ${income ? "amount-in" : "amount-out"}">${income ? "+" : "−"}${fmt(e.amount)}</div>
      </div>
      <div class="card-actions">
        <button class="icon-btn" data-edit="${e.id}" aria-label="Επεξεργασία">${icons.edit}</button>
        <button class="icon-btn" data-del="${e.id}" aria-label="Διαγραφή">${icons.trash}</button>
      </div>
    </div>
  </div>`;
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
  const shown = items.filter(inRange).sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at));
  const income = shown.filter(e => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expense = shown.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const fixed = subsCost();
  const balance = income - expense - fixed;

  const todayIso = isoLocal(today());
  const todayIn = items.filter(e => e.entry_date === todayIso && e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const todayOut = items.filter(e => e.entry_date === todayIso && e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);

  const days = Math.max(1, Math.round((today() - rangeStart()) / 86400000) + 1);
  const perDay = (expense + fixed) / days;

  // Κατανομή εξόδων ανά κατηγορία, με τις συνδρομές ως δική τους φέτα
  const byCat = {};
  for (const e of shown.filter(e => e.kind === "expense")) {
    byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
  }
  const donutItems = Object.entries(byCat)
    .map(([c, v]) => ({ label: cats("expense")[c] || "Άλλο", value: v, color: colors()[c] || "#7b8fd6" }))
    .concat(fixed > 0 ? [{ label: "Συνδρομές", value: fixed, color: CAT_COLOR.subs }] : [])
    .sort((a, b) => b.value - a.value);

  // Ομαδοποίηση ανά ημέρα
  const groups = {};
  for (const e of shown) (groups[e.entry_date] = groups[e.entry_date] || []).push(e);

  view.innerHTML = `
    <div class="page-head">
      <h1>Οικονομικά</h1>
      <div class="head-actions">
        <button class="btn btn-ghost" id="btnIncome">${icons.plus} Έσοδο</button>
        <button class="btn btn-primary" id="btnExpense">${icons.plus} Έξοδο</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="label">Σήμερα</div>
        <div class="value" style="font-size:var(--fs-md)">
          <span class="amount-in">+${fmt(todayIn)}</span> <span class="amount-out">−${fmt(todayOut)}</span>
        </div>
      </div>
      <div class="stat"><div class="label">Έσοδα περιόδου</div><div class="value amount-in">${fmt(income)}</div></div>
      <div class="stat"><div class="label">Έξοδα περιόδου</div><div class="value amount-out">${fmt(expense + fixed)}</div></div>
      <div class="stat"><div class="label">Υπόλοιπο</div>
        <div class="value ${balance >= 0 ? "amount-in" : "amount-out"}">${balance >= 0 ? "+" : "−"}${fmt(Math.abs(balance))}</div>
      </div>
      <div class="stat"><div class="label">Μέσο ημερήσιο έξοδο</div><div class="value">${fmt(perDay)}</div></div>
    </div>

    ${quick.length ? `<div class="quick-row">
      ${quick.map(q => `<button class="quick-chip ${q.kind === "income" ? "in" : "out"}" data-quick="${q.id}">
        <span>${escapeHtml(q.label)}</span>${q.amount != null ? `<strong>${q.kind === "income" ? "+" : "−"}${fmt(q.amount)}</strong>` : ""}
      </button>`).join("")}
    </div>` : ""}

    <div class="filters">
      ${[["today", "Σήμερα"], ["week", "7 ημέρες"], ["month", "Αυτόν τον μήνα"]].map(([v, l]) =>
        `<button class="filter-chip ${range === v ? "active" : ""}" data-range="${v}">${l}</button>`).join("")}
    </div>

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
    </div>` : ""}

    <div class="chart-card fixed-card">
      <h3>Σταθερά έξοδα</h3>
      <div class="fixed-row">
        <span>${subs.filter(s => !isInTrial(s)).length} συνδρομές</span>
        <strong class="amount-out">${fmt(fixed)}</strong>
      </div>
      <a href="#/subs" class="btn btn-ghost" style="margin-top:10px">${icons.card} Διαχείριση συνδρομών</a>
    </div>

    ${shown.length ? Object.entries(groups).map(([date, list]) => {
      const dayIn = list.filter(e => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
      const dayOut = list.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
      return `<div class="section-title day-head">
          <span>${date === todayIso ? "Σήμερα" : fmtDate(new Date(date + "T00:00:00"))}</span>
          <span class="day-sum">${dayIn ? `<span class="amount-in">+${fmt(dayIn)}</span>` : ""} ${dayOut ? `<span class="amount-out">−${fmt(dayOut)}</span>` : ""}</span>
        </div>
        <div class="list">${list.map(entryHtml).join("")}</div>`;
    }).join("")
      : `<div class="empty">${icons.wallet}<p>Καμία εγγραφή σε αυτή την περίοδο.</p>
         <button class="btn btn-primary" id="btnExpenseEmpty">${icons.plus} Πρώτο έξοδο</button></div>`}
  `;

  const rerender = (cached = false) => render(view, { cached });

  view.querySelector("#btnIncome")?.addEventListener("click", () => openForm(null, "income", rerender));
  view.querySelector("#btnExpense")?.addEventListener("click", () => openForm(null, "expense", rerender));
  view.querySelector("#btnExpenseEmpty")?.addEventListener("click", () => openForm(null, "expense", rerender));
  view.querySelectorAll("[data-range]").forEach(b =>
    b.addEventListener("click", () => { range = b.dataset.range; rerender(); }));

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
          note: e.note, entry_date: e.entry_date
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
        note: q.label, entry_date: isoLocal(today())
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
}
