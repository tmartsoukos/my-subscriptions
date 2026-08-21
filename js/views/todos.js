import { todos, courses } from "../db.js";
import {
  escapeHtml, isoLocal, daysUntil, fmtDateShort, icons, toast, toastAction,
  openModal, confirmModal, bindSwipe, micButtonHtml, bindMicButtons, haptic, collapseRow
} from "../ui.js";
import { parseGreekTask, speechSupported } from "../voice.js";
import { refreshBadge } from "../badge.js";

const PRIO_LABEL = { 1: "Υψηλή", 2: "Μεσαία", 3: "Χαμηλή" };
let items = [];
let courseList = [];

function coursePickerHtml(selectedId) {
  if (!courseList.length) return "";
  return `<div class="field">
    <label for="fCourse">Μάθημα (προαιρετικό)</label>
    <select id="fCourse">
      <option value="">—</option>
      ${courseList.map(c => `<option value="${c.id}" ${selectedId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
    </select>
  </div>`;
}

function formHtml(t) {
  return `
    <div class="field">
      <label for="fTitle">Τίτλος</label>
      <div class="input-with-mic">
        <input type="text" id="fTitle" placeholder="π.χ. Πληρωμή ενοικίου" value="${t ? escapeHtml(t.title) : ""}">
        ${micButtonHtml("fTitle")}
      </div>
      <p class="hint mic-hint">Πες κάτι σαν «πληρωμή ΔΕΗ την Παρασκευή» — η ημερομηνία μπαίνει μόνη της.</p>
    </div>
    <div class="row2">
      <div class="field">
        <label for="fPrio">Προτεραιότητα</label>
        <select id="fPrio">
          ${Object.entries(PRIO_LABEL).map(([v, l]) =>
            `<option value="${v}" ${t?.priority == v || (!t && v == 2) ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="fDue">Προθεσμία (προαιρετικό)</label>
        <input type="date" id="fDue" value="${t?.due_date || ""}">
      </div>
    </div>
    ${coursePickerHtml(t?.course_id)}`;
}

function openForm(t, rerender, { startListening = false, from } = {}) {
  openModal({
    from,
    title: t ? "Επεξεργασία εργασίας" : "Νέα εργασία",
    body: formHtml(t),
    onOpen: async overlay => {
      // Η υπαγόρευση συμπληρώνει τίτλο, ημερομηνία και προτεραιότητα από τη φράση
      await bindMicButtons(overlay, txt => {
        const parsed = parseGreekTask(txt);
        if (parsed.title) overlay.querySelector("#fTitle").value = parsed.title;
        if (parsed.due_date) overlay.querySelector("#fDue").value = parsed.due_date;
        if (parsed.priority) overlay.querySelector("#fPrio").value = String(parsed.priority);
      });
      if (startListening) overlay.querySelector("[data-mic]")?.click();
    },
    onSave: async overlay => {
      const title = overlay.querySelector("#fTitle").value.trim();
      if (!title) { toast("Συμπλήρωσε τίτλο.", "error"); return false; }
      const row = {
        title,
        priority: parseInt(overlay.querySelector("#fPrio").value),
        due_date: overlay.querySelector("#fDue").value || null,
        course_id: overlay.querySelector("#fCourse")?.value || null
      };
      if (t) await todos.update(t.id, row);
      else await todos.insert(row);
      toast(t ? "Η εργασία ενημερώθηκε" : "Η εργασία προστέθηκε");
      await rerender();
    }
  });
}

function itemHtml(t) {
  let dueHtml = "";
  if (t.due_date && !t.done) {
    const days = daysUntil(new Date(t.due_date + "T00:00:00"));
    const label = days < 0 ? "Εκπρόθεσμη" : days === 0 ? "Σήμερα" : days === 1 ? "Αύριο" : fmtDateShort(new Date(t.due_date + "T00:00:00"));
    dueHtml = `<span class="todo-due ${days <= 0 ? "overdue" : ""}">${label}</span>`;
  }
  // Το φόντο αποκαλύπτεται κατά το σύρσιμο: δεξιά άκρη = ολοκλήρωση, αριστερή = διαγραφή
  return `<div class="swipe-wrap">
    <div class="swipe-bg" aria-hidden="true">
      <span class="sw-delete">${icons.trash} Διαγραφή</span>
      <span class="sw-done">${t.done ? "Αναίρεση" : "Ολοκλήρωση"} ${icons.check}</span>
    </div>
    <div class="card todo-item" data-swipe="${t.id}">
      <button class="todo-check ${t.done ? "done" : ""}" data-toggle="${t.id}" aria-label="${t.done ? "Αναίρεση ολοκλήρωσης" : "Ολοκλήρωση"}: ${escapeHtml(t.title)}">${icons.check}</button>
      <span class="prio prio-${t.priority}" title="Προτεραιότητα: ${PRIO_LABEL[t.priority]}"></span>
      <span class="todo-title ${t.done ? "done" : ""}">${escapeHtml(t.title)}</span>
      ${dueHtml}
      <div class="card-actions">
        <button class="icon-btn" data-edit="${t.id}" aria-label="Επεξεργασία">${icons.edit}</button>
        <button class="icon-btn" data-del="${t.id}" aria-label="Διαγραφή">${icons.trash}</button>
      </div>
    </div>
  </div>`;
}

// cached: true -> σχεδίαση από την τοπική κατάσταση, χωρίς νέο αίτημα (αισιόδοξη ενημέρωση)
export async function render(view, { cached = false } = {}) {
  if (!cached) [items, courseList] = await Promise.all([todos.list(), courses.list().catch(() => [])]);
  const pending = items.filter(t => !t.done)
    .sort((a, b) => a.priority - b.priority || (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const done = items.filter(t => t.done);

  view.innerHTML = `
    <div class="page-head">
      <h1>Εργασίες</h1>
      <div class="head-actions">
        ${speechSupported() ? `<button class="btn btn-ghost" id="btnVoice">${icons.mic} Με φωνή</button>` : ""}
        <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέα εργασία</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Εκκρεμείς</div><div class="value">${pending.length}</div></div>
      <div class="stat"><div class="label">Ολοκληρωμένες</div><div class="value">${done.length}</div></div>
    </div>
    ${items.length ? `<p class="hint swipe-hint">Σύρε μια εργασία αριστερά για ολοκλήρωση, δεξιά για διαγραφή.</p>` : ""}
    ${pending.length ? `<div class="section-title">Εκκρεμείς</div><div class="list">${pending.map(itemHtml).join("")}</div>` : ""}
    ${done.length ? `<div class="section-title">Ολοκληρωμένες</div><div class="list">${done.map(itemHtml).join("")}</div>` : ""}
    ${!items.length ? `<div class="empty">${icons.check}<p>Καμία εργασία ακόμα. Πρόσθεσε την πρώτη σου!</p><button class="btn btn-primary" id="btnAddEmpty">${icons.plus} Νέα εργασία</button></div>` : ""}
  `;

  const rerender = (cached = false) => render(view, { cached });

  async function toggleDone(t) {
    haptic(t.done ? "tap" : "ok");
    // Αισιόδοξη ενημέρωση: η οθόνη αλλάζει αμέσως, ο server ακολουθεί
    const previous = t.done;
    t.done = !t.done;
    await rerender(true);              // άμεση σχεδίαση από την τοπική κατάσταση
    try {
      await todos.update(t.id, { done: t.done });
      refreshBadge();
    } catch (e) {
      t.done = previous;
      await rerender(true);
      toast("Δεν αποθηκεύτηκε — δοκίμασε ξανά", "error");
    }
  }
  async function removeTodo(t) {
    const backup = [...items];
    await collapseRow(document.querySelector(`[data-swipe="${t.id}"]`)?.closest(".swipe-wrap"));
    items = items.filter(x => x.id !== t.id);   // αισιόδοξη αφαίρεση
    await rerender(true);
    try {
      await todos.remove(t.id);
      refreshBadge();
    } catch {
      items = backup;
      await rerender(true);
      toast("Δεν διαγράφηκε", "error");
      return;
    }
    toastAction("Η εργασία διαγράφηκε", "Αναίρεση", async () => {
      // Επαναφορά με το ίδιο id ώστε να μη χαθεί η σειρά/αναφορά
      await todos.insert({
        id: t.id, title: t.title, done: t.done,
        priority: t.priority, due_date: t.due_date
      });
      await rerender();
      toast("Επαναφέρθηκε");
    });
  }

  view.querySelector("#btnAdd")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelector("#btnAddEmpty")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelector("#btnVoice")?.addEventListener("click", () => openForm(null, rerender, { startListening: true }));

  // Χειρονομίες σε κάθε κάρτα
  view.querySelectorAll("[data-swipe]").forEach(card => {
    const t = items.find(x => x.id === card.dataset.swipe);
    bindSwipe(card, {
      onLeft: () => toggleDone(t),
      onRight: () => removeTodo(t)
    });
  });

  // onclick αντί για addEventListener: το #view δεν αντικαθίσταται μεταξύ renders
  view.onclick = async e => {
    const toggleBtn = e.target.closest("[data-toggle]");
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (toggleBtn) await toggleDone(items.find(x => x.id === toggleBtn.dataset.toggle));
    if (editBtn) openForm(items.find(x => x.id === editBtn.dataset.edit), rerender, { from: editBtn.closest(".card") });
    if (delBtn) {
      const t = items.find(x => x.id === delBtn.dataset.del);
      confirmModal(`Διαγραφή της εργασίας «${t.title}»;`, () => removeTodo(t));
    }
  };
}
