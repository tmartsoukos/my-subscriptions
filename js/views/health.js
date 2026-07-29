import { health } from "../db.js";
import {
  escapeHtml, icons, toast, toastAction, openModal, confirmModal,
  fmtDate, fmtDateShort, isoLocal, daysUntil, today, micButtonHtml, bindMicButtons
} from "../ui.js";

const KINDS = {
  appointment: "Ραντεβού", exam: "Εξέταση", vaccine: "Εμβόλιο",
  medication: "Φάρμακο", measurement: "Μέτρηση"
};
const KIND_ICON = {
  appointment: "calendar", exam: "heart", vaccine: "heart",
  medication: "heart", measurement: "chart"
};
let items = [];
let filter = "upcoming";

function formHtml(h) {
  return `
    <div class="field">
      <label for="fTitle">Τι είναι</label>
      <div class="input-with-mic">
        <input type="text" id="fTitle" placeholder="π.χ. Οδοντίατρος, Αιματολογικές" value="${h ? escapeHtml(h.title) : ""}">
        ${micButtonHtml("fTitle")}
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="fKind">Κατηγορία</label>
        <select id="fKind">
          ${Object.entries(KINDS).map(([v, l]) =>
            `<option value="${v}" ${h?.kind === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="fRepeat">Επανάληψη (μήνες)</label>
        <input type="number" id="fRepeat" min="0" max="120" inputmode="numeric" placeholder="π.χ. 12" value="${h?.repeat_months ?? ""}">
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="fDate">Ημερομηνία</label>
        <input type="date" id="fDate" value="${h?.item_date || isoLocal(new Date())}">
      </div>
      <div class="field">
        <label for="fTime">Ώρα (προαιρετικό)</label>
        <input type="time" id="fTime" value="${h?.item_time ? h.item_time.slice(0, 5) : ""}">
      </div>
    </div>
    <div class="field">
      <label for="fProvider">Γιατρός / κέντρο</label>
      <input type="text" id="fProvider" value="${h?.provider ? escapeHtml(h.provider) : ""}">
    </div>
    <div class="field">
      <label for="fResult">Αποτέλεσμα / δοσολογία</label>
      <input type="text" id="fResult" placeholder="π.χ. όλα φυσιολογικά, 1 χάπι το πρωί" value="${h?.result ? escapeHtml(h.result) : ""}">
    </div>`;
}

function openForm(h, rerender) {
  openModal({
    title: h ? "Επεξεργασία" : "Νέα καταχώριση",
    body: formHtml(h),
    onOpen: overlay => bindMicButtons(overlay),
    onSave: async overlay => {
      const title = overlay.querySelector("#fTitle").value.trim();
      if (!title) { toast("Συμπλήρωσε τίτλο.", "error"); return false; }
      const repeat = overlay.querySelector("#fRepeat").value.trim();
      const row = {
        title,
        kind: overlay.querySelector("#fKind").value,
        item_date: overlay.querySelector("#fDate").value || null,
        item_time: overlay.querySelector("#fTime").value || null,
        repeat_months: repeat === "" ? null : parseInt(repeat) || null,
        provider: overlay.querySelector("#fProvider").value.trim() || null,
        result: overlay.querySelector("#fResult").value.trim() || null
      };
      if (h) await health.update(h.id, row);
      else await health.insert(row);
      toast(h ? "Ενημερώθηκε" : "Προστέθηκε");
      await rerender();
    }
  });
}

// Επόμενη εμφάνιση: κυλάει με βάση την επανάληψη
function nextOccurrence(h) {
  if (!h.item_date) return null;
  let d = new Date(h.item_date + "T00:00:00");
  if (!h.repeat_months) return d;
  const t = today();
  while (d < t) d.setMonth(d.getMonth() + h.repeat_months);
  return d;
}

function itemHtml(h) {
  const d = nextOccurrence(h);
  const days = d ? daysUntil(d) : null;
  let when = "—", cls = "ok";
  if (d) {
    if (days === 0) { when = "Σήμερα"; cls = "today"; }
    else if (days === 1) { when = "Αύριο"; cls = "soon"; }
    else if (days > 0 && days <= 14) { when = `Σε ${days} ημέρες`; cls = "soon"; }
    else if (days < 0) { when = fmtDate(d); cls = "ok"; }
    else when = fmtDate(d);
  }
  const meta = [
    h.provider ? escapeHtml(h.provider) : "",
    h.repeat_months ? `κάθε ${h.repeat_months} μήνες` : "",
    h.item_time ? h.item_time.slice(0, 5) : ""
  ].filter(Boolean).join(" · ");

  return `<div class="card ${days === 0 ? "due-today" : days > 0 && days <= 7 ? "due-soon" : ""}">
    <div class="logo logo-sm wl-kind" title="${KINDS[h.kind]}">${icons[KIND_ICON[h.kind]] || icons.heart}</div>
    <div class="card-main">
      <div class="name">${escapeHtml(h.title)}<span class="chip">${KINDS[h.kind]}</span></div>
      <div class="meta">${meta || "&nbsp;"}</div>
      ${h.result ? `<div class="acct-row"><span class="acct">${icons.note}${escapeHtml(h.result)}</span></div>` : ""}
    </div>
    <div class="card-right">
      <div class="due ${cls}">${when}</div>
    </div>
    <div class="card-actions">
      <button class="icon-btn" data-edit="${h.id}" aria-label="Επεξεργασία">${icons.edit}</button>
      <button class="icon-btn" data-del="${h.id}" aria-label="Διαγραφή">${icons.trash}</button>
    </div>
  </div>`;
}

export async function render(view) {
  items = await health.list();
  const t = isoLocal(today());
  const withNext = items.map(h => ({ h, d: nextOccurrence(h) }));
  const upcoming = withNext.filter(x => x.d && isoLocal(x.d) >= t).sort((a, b) => a.d - b.d).map(x => x.h);
  const past = withNext.filter(x => !x.d || isoLocal(x.d) < t).map(x => x.h);
  const meds = items.filter(h => h.kind === "medication");

  const counts = { upcoming: upcoming.length, past: past.length, medication: meds.length, all: items.length };
  const shown = filter === "upcoming" ? upcoming
    : filter === "past" ? past
    : filter === "medication" ? meds
    : items;

  const next = upcoming[0];
  const nextDate = next ? nextOccurrence(next) : null;

  view.innerHTML = `
    <div class="page-head">
      <h1>Υγεία</h1>
      <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέα καταχώριση</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Επόμενο</div><div class="value" style="font-size:15px">${
        next ? `${escapeHtml(next.title)} · ${fmtDateShort(nextDate)}` : "—"}</div></div>
      <div class="stat"><div class="label">Επερχόμενα</div><div class="value">${upcoming.length}</div></div>
      <div class="stat"><div class="label">Φάρμακα</div><div class="value">${meds.length}</div></div>
    </div>
    <div class="filters">
      ${[["upcoming", "Επερχόμενα"], ["medication", "Φάρμακα"], ["past", "Ιστορικό"], ["all", "Όλα"]].map(([v, l]) =>
        `<button class="filter-chip ${filter === v ? "active" : ""}" data-filter="${v}">${l} <span>${counts[v]}</span></button>`).join("")}
    </div>
    ${shown.length ? `<div class="list">${shown.map(itemHtml).join("")}</div>`
      : `<div class="empty">${icons.heart}<p>${items.length ? "Τίποτα εδώ." : "Ραντεβού, εξετάσεις, εμβόλια και φάρμακα σε ένα μέρος."}</p>
        ${items.length ? "" : `<button class="btn btn-primary" id="btnAddEmpty">${icons.plus} Νέα καταχώριση</button>`}</div>`}
    <p class="hint">Οι καταχωρίσεις με ημερομηνία εμφανίζονται και στο Ημερολόγιο Apple μέσω της ροής.</p>
  `;

  const rerender = () => render(view);
  view.querySelector("#btnAdd")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelector("#btnAddEmpty")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelectorAll("[data-filter]").forEach(b =>
    b.addEventListener("click", () => { filter = b.dataset.filter; rerender(); }));

  view.onclick = async e => {
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (editBtn) openForm(items.find(h => h.id === editBtn.dataset.edit), rerender);
    if (delBtn) {
      const h = items.find(x => x.id === delBtn.dataset.del);
      confirmModal(`Διαγραφή «${h.title}»;`, async () => {
        await health.remove(h.id);
        await rerender();
        toastAction("Διαγράφηκε", "Αναίρεση", async () => {
          await health.insert({
            id: h.id, kind: h.kind, title: h.title, item_date: h.item_date, item_time: h.item_time,
            repeat_months: h.repeat_months, provider: h.provider, result: h.result, note: h.note
          });
          await rerender();
        });
      });
    }
  };
}
