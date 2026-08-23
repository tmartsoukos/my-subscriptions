import { courses, todos, events } from "../db.js";
import {
  escapeHtml, icons, toast, toastAction, openModal, confirmModal,
  fmtDateShort, isoLocal, daysUntil, today, colorPickerHtml, bindColorPicker, pickedColor, bindDrills
} from "../ui.js";
import { prefs, pins } from "../prefs.js";

const STATUS = { active: "Τρέχον", passed: "Περασμένο", failed: "Κόπηκα", planned: "Μελλοντικό" };
let items = [], allTodos = [], allEvents = [];
let filter = "active";

function formHtml(c) {
  return `
    <div class="field">
      <label for="fName">Μάθημα</label>
      <input type="text" id="fName" placeholder="π.χ. Βάσεις Δεδομένων" value="${c ? escapeHtml(c.name) : ""}">
    </div>
    <div class="row2">
      <div class="field">
        <label for="fCode">Κωδικός</label>
        <input type="text" id="fCode" placeholder="π.χ. ΠΛΗ301" value="${c?.code ? escapeHtml(c.code) : ""}">
      </div>
      <div class="field">
        <label for="fSemester">Εξάμηνο</label>
        <input type="number" id="fSemester" min="1" max="12" inputmode="numeric" value="${c?.semester ?? ""}">
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="fEcts">ECTS</label>
        <input type="text" id="fEcts" inputmode="decimal" placeholder="6" value="${c?.ects ?? ""}">
      </div>
      <div class="field">
        <label for="fGrade">Βαθμός</label>
        <input type="text" id="fGrade" inputmode="decimal" placeholder="8,5" value="${c?.grade != null ? String(c.grade).replace(".", ",") : ""}">
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="fStatus">Κατάσταση</label>
        <select id="fStatus">
          ${Object.entries(STATUS).map(([v, l]) =>
            `<option value="${v}" ${c?.status === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="fProf">Διδάσκων</label>
        <input type="text" id="fProf" value="${c?.professor ? escapeHtml(c.professor) : ""}">
      </div>
    </div>
    <div class="field">
      <label>Χρώμα</label>
      ${colorPickerHtml(c ? c.color : "#3b82f6")}
    </div>`;
}

function openForm(c, rerender) {
  openModal({
    title: c ? "Επεξεργασία μαθήματος" : "Νέο μάθημα",
    body: formHtml(c),
    onOpen: bindColorPicker,
    onSave: async overlay => {
      const name = overlay.querySelector("#fName").value.trim();
      if (!name) { toast("Συμπλήρωσε όνομα μαθήματος.", "error"); return false; }
      const num = id => {
        const v = overlay.querySelector(id).value.trim().replace(",", ".");
        return v === "" ? null : parseFloat(v);
      };
      const grade = num("#fGrade");
      if (grade != null && (isNaN(grade) || grade < 0 || grade > 10)) {
        toast("Ο βαθμός πρέπει να είναι 0–10.", "error"); return false;
      }
      const row = {
        name,
        code: overlay.querySelector("#fCode").value.trim() || null,
        semester: num("#fSemester"),
        ects: num("#fEcts"),
        grade,
        status: overlay.querySelector("#fStatus").value,
        professor: overlay.querySelector("#fProf").value.trim() || null,
        color: pickedColor(overlay)
      };
      if (c) await courses.update(c.id, row);
      else await courses.insert(row);
      toast(c ? "Ενημερώθηκε" : "Το μάθημα προστέθηκε");
      await rerender();
    }
  });
}

// Σταθμισμένος μέσος όρος με ECTS· αν λείπουν ECTS, μετράει απλός μέσος
function average(list) {
  const graded = list.filter(c => c.grade != null && c.status === "passed");
  if (!graded.length) return { avg: null, ects: 0, count: 0 };
  const withEcts = graded.filter(c => c.ects);
  const ectsSum = withEcts.reduce((s, c) => s + Number(c.ects), 0);
  const avg = withEcts.length === graded.length && ectsSum > 0
    ? graded.reduce((s, c) => s + Number(c.grade) * Number(c.ects), 0) / ectsSum
    : graded.reduce((s, c) => s + Number(c.grade), 0) / graded.length;
  return { avg, ects: ectsSum, count: graded.length };
}

function courseHtml(c) {
  const pending = allTodos.filter(t => t.course_id === c.id && !t.done);
  const upcoming = allEvents
    .filter(e => e.course_id === c.id && e.event_date >= isoLocal(today()))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
  return `<div class="card">
    <div class="logo" style="--logo:${c.color};background:${c.color}">${icons.book}</div>
    <div class="card-main">
      <div class="name">${escapeHtml(c.name)}
        ${c.code ? `<span class="chip">${escapeHtml(c.code)}</span>` : ""}
        <span class="chip chip-${c.status === "passed" ? "done" : c.status === "failed" ? "planned" : "active"}">${STATUS[c.status]}</span>
      </div>
      <div class="meta">
        ${[c.semester ? `${c.semester}ο εξάμηνο` : "", c.ects ? `${c.ects} ECTS` : "", c.professor ? escapeHtml(c.professor) : ""]
          .filter(Boolean).join(" · ") || "&nbsp;"}
      </div>
      ${pending.length || upcoming ? `<div class="acct-row">
        ${pending.length ? `<span class="acct">${icons.check}${pending.length} εργασίες</span>` : ""}
        ${upcoming ? `<span class="acct">${icons.calendar}${escapeHtml(upcoming.title)} · ${fmtDateShort(new Date(upcoming.event_date + "T00:00:00"))}</span>` : ""}
      </div>` : ""}
    </div>
    <div class="card-right">
      ${c.grade != null ? `<div class="price">${String(c.grade).replace(".", ",")}</div><div class="cycle">βαθμός</div>` : ""}
    </div>
    <div class="card-actions">
      <button class="icon-btn ${(prefs().pins || []).some(p => p.kind === "course" && p.ref_id === c.id) ? "pinned" : ""}"
        data-pin="${c.id}" aria-label="Καρφίτσωμα στην αρχική">${icons.bookmark}</button>
      <button class="icon-btn" data-edit="${c.id}" aria-label="Επεξεργασία">${icons.edit}</button>
      <button class="icon-btn" data-del="${c.id}" aria-label="Διαγραφή">${icons.trash}</button>
    </div>
  </div>`;
}

export async function render(view) {
  [items, allTodos, allEvents] = await Promise.all([courses.list(), todos.list(), events.list()]);
  const counts = {
    all: items.length,
    active: items.filter(c => c.status === "active").length,
    passed: items.filter(c => c.status === "passed").length,
    planned: items.filter(c => c.status === "planned" || c.status === "failed").length
  };
  const shown = filter === "all" ? items
    : filter === "planned" ? items.filter(c => c.status === "planned" || c.status === "failed")
    : items.filter(c => c.status === filter);

  const { avg, ects, count } = average(items);
  const courseIds = new Set(items.map(c => c.id));
  const openTasks = allTodos.filter(t => !t.done && courseIds.has(t.course_id));
  const nextDeadline = allEvents
    .filter(e => courseIds.has(e.course_id) && e.event_date >= isoLocal(today()))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];

  view.innerHTML = `
    <div class="page-head">
      <h1>Σπουδές</h1>
      <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέο μάθημα</button>
    </div>
    <div class="stats">
      <div class="stat" data-drill="avg"><div class="label">Μέσος όρος</div><div class="value">${avg != null ? avg.toFixed(2).replace(".", ",") : "—"}</div></div>
      <div class="stat" data-drill="passed"><div class="label">Περασμένα</div><div class="value">${count} <small>${ects ? `· ${ects} ECTS` : ""}</small></div></div>
      <div class="stat" data-drill="tasks"><div class="label">Εργασίες μαθημάτων</div><div class="value">${openTasks.length}</div></div>
      <div class="stat" data-drill="deadlines"><div class="label">Επόμενη προθεσμία</div><div class="value" style="font-size:15px">${
        nextDeadline ? `${escapeHtml(nextDeadline.title)} · ${fmtDateShort(new Date(nextDeadline.event_date + "T00:00:00"))}` : "—"}</div></div>
    </div>
    <div class="filters">
      ${[["active", "Τρέχοντα"], ["passed", "Περασμένα"], ["planned", "Εκκρεμή"], ["all", "Όλα"]].map(([v, l]) =>
        `<button class="filter-chip ${filter === v ? "active" : ""}" data-filter="${v}">${l} <span>${counts[v]}</span></button>`).join("")}
    </div>
    ${shown.length ? `<div class="list">${shown.map(courseHtml).join("")}</div>`
      : `<div class="empty">${icons.book}<p>${items.length ? "Κανένα μάθημα σε αυτή την κατηγορία." : "Πρόσθεσε τα μαθήματά σου για να βλέπεις προθεσμίες και μέσο όρο."}</p>
        ${items.length ? "" : `<button class="btn btn-primary" id="btnAddEmpty">${icons.plus} Νέο μάθημα</button>`}</div>`}
  `;

  const rerender = () => render(view);

  // Ανάλυση των αριθμών της κορυφής
  const graded = items.filter(c => c.grade != null && c.status === "passed");
  const courseName = id => items.find(c => c.id === id)?.name || "";
  bindDrills(view, {
    avg: () => ({
      title: "Μέσος όρος",
      total: avg != null ? avg.toFixed(2).replace(".", ",") : "—", totalLabel: "Σταθμισμένος με ECTS",
      rows: [...graded].sort((a, b) => b.grade - a.grade).map(c => ({
        label: c.name, color: c.color,
        meta: [c.code, c.ects ? `${c.ects} ECTS` : "χωρίς ECTS"].filter(Boolean).join(" · "),
        value: String(c.grade).replace(".", ",")
      })),
      note: graded.every(c => c.ects)
        ? "Κάθε βαθμός μετράει ανάλογα με τα ECTS του μαθήματος."
        : "Κάποια μαθήματα δεν έχουν ECTS, οπότε ο μέσος όρος είναι απλός."
    }),
    passed: () => ({
      title: "Περασμένα μαθήματα",
      total: `${count} μαθήματα${ects ? ` · ${ects} ECTS` : ""}`, totalLabel: "Σύνολο",
      rows: [...graded].sort((a, b) => (a.semester || 0) - (b.semester || 0)).map(c => ({
        label: c.name, color: c.color,
        meta: c.semester ? `${c.semester}ο εξάμηνο` : "χωρίς εξάμηνο",
        value: String(c.grade).replace(".", ",")
      }))
    }),
    tasks: () => ({
      title: "Εργασίες μαθημάτων",
      total: String(openTasks.length), totalLabel: "Εκκρεμείς",
      rows: [...openTasks]
        .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
        .map(t => ({
          label: t.title,
          meta: [courseName(t.course_id), t.due_date ? fmtDateShort(new Date(t.due_date + "T00:00:00")) : "χωρίς προθεσμία"]
            .filter(Boolean).join(" · "),
          value: t.due_date && t.due_date < isoLocal(today()) ? "εκπρόθεσμη" : "",
          cls: "amount-out"
        }))
    }),
    deadlines: () => ({
      title: "Επόμενες προθεσμίες",
      rows: allEvents
        .filter(e => courseIds.has(e.course_id) && e.event_date >= isoLocal(today()))
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
        .slice(0, 12)
        .map(e => {
          const n = daysUntil(new Date(e.event_date + "T00:00:00"));
          return {
            label: e.title, color: e.color,
            meta: [courseName(e.course_id), fmtDateShort(new Date(e.event_date + "T00:00:00"))].filter(Boolean).join(" · "),
            value: n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`
          };
        })
    })
  });

  view.querySelector("#btnAdd")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelector("#btnAddEmpty")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelectorAll("[data-filter]").forEach(b =>
    b.addEventListener("click", () => { filter = b.dataset.filter; rerender(); }));

  view.onclick = async e => {
    const pinBtn = e.target.closest("[data-pin]");
    if (pinBtn) {
      const id = pinBtn.dataset.pin;
      const existing = (prefs().pins || []).find(p => p.kind === "course" && p.ref_id === id);
      try {
        if (existing) { await pins.remove(existing.id); prefs().pins = prefs().pins.filter(p => p.id !== existing.id); }
        else {
          const created = await pins.insert({ kind: "course", ref_id: id, sort: (prefs().pins || []).length });
          prefs().pins = [...(prefs().pins || []), created];
        }
        pinBtn.classList.toggle("pinned");
        toast(existing ? "Ξεκαρφιτσώθηκε" : "Καρφιτσώθηκε στην αρχική");
      } catch { toast("Δεν αποθηκεύτηκε", "error"); }
      return;
    }
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (editBtn) openForm(items.find(c => c.id === editBtn.dataset.edit), rerender);
    if (delBtn) {
      const c = items.find(x => x.id === delBtn.dataset.del);
      confirmModal(`Διαγραφή του μαθήματος «${c.name}»; Οι εργασίες του παραμένουν.`, async () => {
        await courses.remove(c.id);
        await rerender();
        toastAction("Το μάθημα διαγράφηκε", "Αναίρεση", async () => {
          await courses.insert({
            id: c.id, name: c.name, code: c.code, semester: c.semester, ects: c.ects,
            grade: c.grade, status: c.status, color: c.color, professor: c.professor
          });
          await rerender();
        });
      });
    }
  };
}
