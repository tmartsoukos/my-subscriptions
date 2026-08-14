import { subscriptions } from "../db.js";
import {
  escapeHtml, fmt, fmtDate, isoLocal, daysUntil, nextDue, monthlyCost,
  isInTrial, trialDaysLeft, members, shareCount, isShared, myShare, unpaidMembers,
  CYCLES, CYCLE_LABEL, CATEGORIES, icons, toast, openModal, confirmModal,
  colorPickerHtml, bindColorPicker, pickedColor
} from "../ui.js";
import { logoFor } from "../logos.js";

let items = [];

function formHtml(sub) {
  const trial = sub ? isInTrial(sub) : false;
  return `
    <div class="field">
      <label for="fName">Όνομα υπηρεσίας</label>
      <input type="text" id="fName" placeholder="π.χ. Netflix, Spotify..." value="${sub ? escapeHtml(sub.name) : ""}">
    </div>
    <div class="row2">
      <div class="field">
        <label for="fPrice">Κόστος (€)</label>
        <input type="text" id="fPrice" inputmode="decimal" placeholder="9,99" value="${sub ? String(sub.price).replace(".", ",") : ""}">
      </div>
      <div class="field">
        <label for="fCycle">Συχνότητα</label>
        <select id="fCycle">
          ${Object.entries(CYCLE_LABEL).map(([v, l]) =>
            `<option value="${v}" ${sub?.cycle === v || (!sub && v === "monthly") ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
    </div>

    <label class="check-row">
      <input type="checkbox" id="fTrial" ${trial ? "checked" : ""}>
      <span>Είμαι σε δωρεάν δοκιμή</span>
    </label>

    <div class="row2">
      <div class="field">
        <label for="fDate" id="fDateLabel">${trial ? "Λήξη δοκιμής (πρώτη χρέωση)" : "Επόμενη χρέωση"}</label>
        <input type="date" id="fDate" value="${sub ? (trial ? sub.trial_end : sub.next_date) : isoLocal(new Date())}">
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
      <label>Μοιρασμένη με άλλους</label>
      <div class="members-edit" id="membersList"></div>
      <button type="button" class="btn btn-ghost btn-sm" id="btnAddMember">${icons.plus} Πρόσωπο</button>
      <p class="hint" id="shareHint"></p>
    </div>

    <div class="field">
      <label>Χρώμα</label>
      ${colorPickerHtml(sub ? sub.color : "#7c6cf6")}
    </div>

    <details class="form-section" ${sub?.cancel_url || sub?.payment_method || sub?.account_note ? "open" : ""}>
      <summary>Στοιχεία λογαριασμού (προαιρετικά)</summary>
      <div class="field">
        <label for="fPay">Τρόπος πληρωμής</label>
        <input type="text" id="fPay" placeholder="π.χ. Visa ****4321" value="${sub?.payment_method ? escapeHtml(sub.payment_method) : ""}">
      </div>
      <div class="field">
        <label for="fAccount">Λογαριασμός / email</label>
        <input type="text" id="fAccount" inputmode="email" placeholder="π.χ. themis@gmail.com" value="${sub?.account_note ? escapeHtml(sub.account_note) : ""}">
      </div>
      <div class="field">
        <label for="fCancel">Σύνδεσμος ακύρωσης</label>
        <input type="url" id="fCancel" inputmode="url" placeholder="netflix.com/cancelplan" value="${sub?.cancel_url ? escapeHtml(sub.cancel_url) : ""}">
      </div>
    </details>`;
}

// Διαχείριση της λίστας προσώπων μέσα στο modal (κρατά το paid_for των υπαρχόντων)
function bindForm(overlay, sub) {
  bindColorPicker(overlay);
  const state = members(sub || {}).map(m => ({ name: m.name, paid_for: m.paid_for || null }));
  const list = overlay.querySelector("#membersList");
  const hint = overlay.querySelector("#shareHint");
  const priceInput = overlay.querySelector("#fPrice");

  function updateHint() {
    const price = parseFloat(priceInput.value.replace(",", ".")) || 0;
    const n = 1 + state.length;
    hint.textContent = n > 1
      ? `Μοιράζεται σε ${n} άτομα — το μερίδιό σου: ${fmt(price / n)} από ${fmt(price)}`
      : "Πλήρωσε μόνο εσύ.";
  }

  function draw() {
    list.innerHTML = state.map((m, i) => `
      <div class="member-row">
        <input type="text" data-mname="${i}" value="${escapeHtml(m.name)}" placeholder="Όνομα" aria-label="Όνομα προσώπου">
        <button type="button" class="icon-btn" data-mremove="${i}" aria-label="Αφαίρεση προσώπου">${icons.x}</button>
      </div>`).join("");
    updateHint();
  }

  list.addEventListener("input", e => {
    const inp = e.target.closest("[data-mname]");
    if (inp) state[+inp.dataset.mname].name = inp.value;
  });
  list.addEventListener("click", e => {
    const btn = e.target.closest("[data-mremove]");
    if (!btn) return;
    state.splice(+btn.dataset.mremove, 1);
    draw();
  });
  overlay.querySelector("#btnAddMember").addEventListener("click", () => {
    state.push({ name: "", paid_for: null });
    draw();
    list.querySelector(`[data-mname="${state.length - 1}"]`)?.focus();
  });
  priceInput.addEventListener("input", updateHint);

  // Η ετικέτα της ημερομηνίας αλλάζει ανάλογα με τη δοκιμή
  const trialBox = overlay.querySelector("#fTrial");
  trialBox.addEventListener("change", () => {
    overlay.querySelector("#fDateLabel").textContent =
      trialBox.checked ? "Λήξη δοκιμής (πρώτη χρέωση)" : "Επόμενη χρέωση";
  });

  draw();
  overlay._memberState = state;
}

function readForm(overlay) {
  const name = overlay.querySelector("#fName").value.trim();
  // Δεκτό και κόμμα και τελεία ως δεκαδικό (ελληνικό πληκτρολόγιο κινητού)
  const price = parseFloat(overlay.querySelector("#fPrice").value.replace(",", "."));
  const date = overlay.querySelector("#fDate").value;
  const isTrial = overlay.querySelector("#fTrial").checked;
  if (!name) { toast("Συμπλήρωσε το όνομα.", "error"); return null; }
  if (isNaN(price) || price < 0) { toast("Συμπλήρωσε έγκυρο κόστος.", "error"); return null; }
  if (!date) { toast("Συμπλήρωσε ημερομηνία.", "error"); return null; }
  const mem = (overlay._memberState || [])
    .map(m => ({ name: m.name.trim(), paid_for: m.paid_for || null }))
    .filter(m => m.name);
  // Σύνδεσμος χωρίς πρωτόκολλο -> https://
  let cancel = overlay.querySelector("#fCancel").value.trim();
  if (cancel && !/^https?:\/\//i.test(cancel)) cancel = "https://" + cancel;

  return {
    name, price, next_date: date,
    trial_end: isTrial ? date : null,
    members: mem,
    cycle: overlay.querySelector("#fCycle").value,
    category: overlay.querySelector("#fCat").value,
    color: pickedColor(overlay),
    payment_method: overlay.querySelector("#fPay").value.trim() || null,
    account_note: overlay.querySelector("#fAccount").value.trim() || null,
    cancel_url: cancel || null
  };
}

function openForm(sub, rerender) {
  openModal({
    title: sub ? "Επεξεργασία συνδρομής" : "Νέα συνδρομή",
    body: formHtml(sub),
    onOpen: overlay => bindForm(overlay, sub),
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
  const trial = isInTrial(s);
  let dueClass = "ok", cardClass = "", dueText;

  if (trial) {
    dueClass = days <= 3 ? "today" : "soon";
    cardClass = days <= 3 ? "due-today" : "due-soon";
    dueText = days === 0 ? "Λήγει σήμερα!" : days === 1 ? "Λήγει αύριο" : `Λήγει σε ${days} ημέρες`;
  } else if (days === 0) { dueClass = "today"; cardClass = "due-today"; dueText = "Πληρώνεται σήμερα!"; }
  else if (days === 1) { dueClass = "soon"; cardClass = "due-soon"; dueText = "Αύριο"; }
  else if (days <= 7) { dueClass = "soon"; cardClass = "due-soon"; dueText = `Σε ${days} ημέρες`; }
  else dueText = fmtDate(d);

  const shared = isShared(s);
  const unpaid = unpaidMembers(s);
  const cycleIso = isoLocal(d);

  const membersRow = shared ? `<div class="members-row">
    ${members(s).map((m, i) => {
      const paid = m.paid_for === cycleIso;
      return `<button class="member-chip ${paid ? "paid" : "unpaid"}" data-paid="${s.id}:${i}"
        aria-label="${paid ? "Πληρώθηκε" : "Δεν πλήρωσε"}: ${escapeHtml(m.name)}">
        ${paid ? "✓" : "•"} ${escapeHtml(m.name)} ${fmt(myShare(s))}</button>`;
    }).join("")}
  </div>` : "";

  const accountBits = [
    s.payment_method ? `<span class="acct">${icons.card2}${escapeHtml(s.payment_method)}</span>` : "",
    s.account_note ? `<span class="acct">${icons.user}${escapeHtml(s.account_note)}</span>` : ""
  ].filter(Boolean).join("");

  return `<div class="card ${cardClass}">
    <div class="logo" style="--logo:${s.color};background:${s.color}">${logoFor(s)}</div>
    <div class="card-main">
      <div class="name">${escapeHtml(s.name)}
        ${trial ? `<span class="badge badge-trial">ΔΟΚΙΜΗ</span>` : ""}
        <span class="chip">${CATEGORIES[s.category] || "Άλλο"}</span>
        ${shared ? `<span class="chip">${shareCount(s)} άτομα</span>` : ""}
      </div>
      <div class="meta">${CYCLE_LABEL[s.cycle]} · ${trial ? "δωρεάν τώρα, μετά " : ""}${fmt(monthlyCost(s))}/μήνα${shared ? " (μερίδιό σου)" : ""}</div>
      ${accountBits ? `<div class="acct-row">${accountBits}</div>` : ""}
      ${membersRow}
    </div>
    <div class="card-right">
      <div class="price">${shared ? fmt(myShare(s)) : fmt(s.price)}</div>
      <div class="cycle">ανά ${CYCLES[s.cycle]}${shared ? ` · σύνολο ${fmt(s.price)}` : ""}</div>
      <div class="due ${dueClass}">${dueText}</div>
    </div>
    <div class="card-actions">
      ${s.cancel_url ? `<a class="icon-btn" href="${escapeHtml(s.cancel_url)}" target="_blank" rel="noopener noreferrer"
        title="Ακύρωση συνδρομής" aria-label="Άνοιγμα σελίδας ακύρωσης για ${escapeHtml(s.name)}">${icons.external}</a>` : ""}
      <button class="icon-btn" data-edit="${s.id}" aria-label="Επεξεργασία ${escapeHtml(s.name)}">${icons.edit}</button>
      <button class="icon-btn" data-del="${s.id}" aria-label="Διαγραφή ${escapeHtml(s.name)}">${icons.trash}</button>
    </div>
  </div>`;
}

export async function render(view) {
  items = await subscriptions.list();
  const sorted = [...items].sort((a, b) => nextDue(a) - nextDue(b));
  const active = items.filter(s => !isInTrial(s));
  const trials = items.filter(isInTrial);
  const monthly = active.reduce((sum, s) => sum + monthlyCost(s), 0);
  const trialsMonthly = trials.reduce((sum, s) => sum + monthlyCost(s), 0);
  const owed = items.reduce((sum, s) => sum + unpaidMembers(s).length * myShare(s), 0);

  view.innerHTML = `
    <div class="page-head">
      <h1>Συνδρομές</h1>
      <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέα συνδρομή</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Μηνιαίο κόστος</div><div class="value">${fmt(monthly)} <small>/ μήνα</small></div></div>
      <div class="stat"><div class="label">Ετήσιο κόστος</div><div class="value">${fmt(monthly * 12)} <small>/ έτος</small></div></div>
      <div class="stat"><div class="label">Ενεργές</div><div class="value">${active.length}</div></div>
      ${trials.length ? `<div class="stat"><div class="label">Σε δοκιμή</div><div class="value">${trials.length} <small>(+${fmt(trialsMonthly)}/μήνα)</small></div></div>` : ""}
      ${owed > 0 ? `<div class="stat"><div class="label">Μου χρωστάνε</div><div class="value">${fmt(owed)}</div></div>` : ""}
    </div>
    ${sorted.length ? `<div class="section-title">Επερχόμενες πληρωμές</div><div class="list">${sorted.map(cardHtml).join("")}</div>`
      : `<div class="empty">${icons.card}<p>Δεν έχεις προσθέσει καμία συνδρομή ακόμα.</p><button class="btn btn-primary" id="btnAddEmpty">${icons.plus} Νέα συνδρομή</button></div>`}
  `;

  const rerender = () => render(view);
  view.querySelector("#btnAdd")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelector("#btnAddEmpty")?.addEventListener("click", () => openForm(null, rerender));
  // onclick αντί για addEventListener: το #view δεν αντικαθίσταται μεταξύ renders
  view.onclick = async e => {
    const paidBtn = e.target.closest("[data-paid]");
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");

    if (paidBtn) {
      const [id, idx] = paidBtn.dataset.paid.split(":");
      const sub = items.find(s => s.id === id);
      const cycleIso = isoLocal(nextDue(sub));
      const mem = members(sub).map((m, i) =>
        i === +idx ? { ...m, paid_for: m.paid_for === cycleIso ? null : cycleIso } : m);
      await subscriptions.update(sub.id, { members: mem });
      await rerender();
      return;
    }
    if (editBtn) openForm(items.find(s => s.id === editBtn.dataset.edit), rerender);
    if (delBtn) {
      const sub = items.find(s => s.id === delBtn.dataset.del);
      confirmModal(`Διαγραφή της συνδρομής «${sub.name}»;`, async () => {
        await subscriptions.remove(sub.id);
        toast("Η συνδρομή διαγράφηκε");
        await rerender();
      });
    }
  };
}
