import { subscriptions } from "../db.js";
import {
  escapeHtml, fmt, fmtDate, isoLocal, daysUntil, nextDue, monthlyCost,
  CYCLES, CYCLE_LABEL, CATEGORIES, icons, toast, openModal, confirmModal,
  colorPickerHtml, bindColorPicker, pickedColor
} from "../ui.js";

let items = [];

function formHtml(sub) {
  return `
    <div class="field">
      <label for="fName">Όνομα υπηρεσίας</label>
      <input type="text" id="fName" placeholder="π.χ. Netflix, Spotify..." value="${sub ? escapeHtml(sub.name) : ""}">
    </div>
    <div class="row2">
      <div class="field">
        <label for="fPrice">Κόστος (€)</label>
        <input type="number" id="fPrice" min="0" step="0.01" inputmode="decimal" placeholder="9.99" value="${sub ? sub.price : ""}">
      </div>
      <div class="field">
        <label for="fCycle">Συχνότητα</label>
        <select id="fCycle">
          ${Object.entries(CYCLE_LABEL).map(([v, l]) =>
            `<option value="${v}" ${sub?.cycle === v || (!sub && v === "monthly") ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="fDate">Επόμενη χρέωση</label>
        <input type="date" id="fDate" value="${sub ? sub.next_date : isoLocal(new Date())}">
      </div>
      <div class="field">
        <label for="fCat">Κατηγορία</label>
        <select id="fCat">
          ${Object.entries(CATEGORIES).map(([v, l]) =>
            `<option value="${v}" ${sub?.category === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="field">
      <label>Χρώμα</label>
      ${colorPickerHtml(sub ? sub.color : "#7c6cf6")}
    </div>`;
}

function readForm(overlay) {
  const name = overlay.querySelector("#fName").value.trim();
  const price = parseFloat(overlay.querySelector("#fPrice").value);
  const next_date = overlay.querySelector("#fDate").value;
  if (!name) { toast("Συμπλήρωσε το όνομα.", "error"); return null; }
  if (isNaN(price) || price < 0) { toast("Συμπλήρωσε έγκυρο κόστος.", "error"); return null; }
  if (!next_date) { toast("Συμπλήρωσε ημερομηνία χρέωσης.", "error"); return null; }
  return {
    name, price, next_date,
    cycle: overlay.querySelector("#fCycle").value,
    category: overlay.querySelector("#fCat").value,
    color: pickedColor(overlay)
  };
}

function openForm(sub, rerender) {
  openModal({
    title: sub ? "Επεξεργασία συνδρομής" : "Νέα συνδρομή",
    body: formHtml(sub),
    onOpen: bindColorPicker,
    onSave: async overlay => {
      const row = readForm(overlay);
      if (!row) return false;
      if (sub) await subscriptions.update(sub.id, row);
      else await subscriptions.insert(row);
      toast(sub ? "Η συνδρομή ενημερώθηκε" : "Η συνδρομή προστέθηκε");
      await rerender();
    }
  });
}

function cardHtml(s) {
  const d = nextDue(s);
  const days = daysUntil(d);
  let dueClass = "ok", cardClass = "", dueText;
  if (days === 0) { dueClass = "today"; cardClass = "due-today"; dueText = "Πληρώνεται σήμερα!"; }
  else if (days === 1) { dueClass = "soon"; cardClass = "due-soon"; dueText = "Αύριο"; }
  else if (days <= 7) { dueClass = "soon"; cardClass = "due-soon"; dueText = `Σε ${days} ημέρες`; }
  else dueText = fmtDate(d);
  return `<div class="card ${cardClass}">
    <div class="logo" style="background:${s.color}">${escapeHtml(s.name.charAt(0).toUpperCase())}</div>
    <div class="card-main">
      <div class="name">${escapeHtml(s.name)}<span class="chip">${CATEGORIES[s.category] || "Άλλο"}</span></div>
      <div class="meta">${CYCLE_LABEL[s.cycle]} · ${fmt(monthlyCost(s))}/μήνα</div>
    </div>
    <div class="card-right">
      <div class="price">${fmt(s.price)}</div>
      <div class="cycle">ανά ${CYCLES[s.cycle]}</div>
      <div class="due ${dueClass}">${dueText}</div>
    </div>
    <div class="card-actions">
      <button class="icon-btn" data-edit="${s.id}" aria-label="Επεξεργασία ${escapeHtml(s.name)}">${icons.edit}</button>
      <button class="icon-btn" data-del="${s.id}" aria-label="Διαγραφή ${escapeHtml(s.name)}">${icons.trash}</button>
    </div>
  </div>`;
}

export async function render(view) {
  items = await subscriptions.list();
  const sorted = [...items].sort((a, b) => nextDue(a) - nextDue(b));
  const monthly = items.reduce((sum, s) => sum + monthlyCost(s), 0);

  view.innerHTML = `
    <div class="page-head">
      <h1>Συνδρομές</h1>
      <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέα συνδρομή</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Μηνιαίο κόστος</div><div class="value">${fmt(monthly)} <small>/ μήνα</small></div></div>
      <div class="stat"><div class="label">Ετήσιο κόστος</div><div class="value">${fmt(monthly * 12)} <small>/ έτος</small></div></div>
      <div class="stat"><div class="label">Ενεργές</div><div class="value">${items.length}</div></div>
    </div>
    ${sorted.length ? `<div class="section-title">Επερχόμενες πληρωμές</div><div class="list">${sorted.map(cardHtml).join("")}</div>`
      : `<div class="empty">${icons.card}<p>Δεν έχεις προσθέσει καμία συνδρομή ακόμα.</p><button class="btn btn-primary" id="btnAddEmpty">${icons.plus} Νέα συνδρομή</button></div>`}
  `;

  const rerender = () => render(view);
  view.querySelector("#btnAdd")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelector("#btnAddEmpty")?.addEventListener("click", () => openForm(null, rerender));
  view.addEventListener("click", e => {
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (editBtn) openForm(items.find(s => s.id === editBtn.dataset.edit), rerender);
    if (delBtn) {
      const sub = items.find(s => s.id === delBtn.dataset.del);
      confirmModal(`Διαγραφή της συνδρομής «${sub.name}»;`, async () => {
        await subscriptions.remove(sub.id);
        toast("Η συνδρομή διαγράφηκε");
        await rerender();
      });
    }
  });
}
