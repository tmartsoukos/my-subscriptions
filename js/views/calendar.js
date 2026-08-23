import { events, subscriptions, courses } from "../db.js";
import { escapeHtml, isoLocal, fmt, icons, toast, openModal, confirmModal, nextDue, today } from "../ui.js";
import { logoFor } from "../logos.js";

const DOW = ["Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ", "Κυρ"];
const EVENT_COLORS = ["#58a6ff", "#7c6cf6", "#3fb950", "#e3b341", "#f06292", "#f85149"];

let shown = new Date(); // εμφανιζόμενος μήνας
let evItems = [], subItems = [], courseList = [];

// Πληρωμές συνδρομών μέσα στον εμφανιζόμενο μήνα (κύλιση ανά κύκλο)
function paymentsInMonth(year, month) {
  const out = {};
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  for (const s of subItems) {
    let d = nextDue(s);
    while (d <= monthEnd) {
      if (d >= monthStart) {
        const key = isoLocal(d);
        (out[key] = out[key] || []).push(s);
      }
      const nd = new Date(d);
      if (s.cycle === "weekly") nd.setDate(nd.getDate() + 7);
      else if (s.cycle === "monthly") nd.setMonth(nd.getMonth() + 1);
      else nd.setFullYear(nd.getFullYear() + 1);
      d = nd;
    }
  }
  return out;
}

function eventsByDay() {
  const out = {};
  for (const e of evItems) (out[e.event_date] = out[e.event_date] || []).push(e);
  return out;
}

function formHtml(ev, dateIso) {
  const sel = ev?.color || EVENT_COLORS[0];
  return `
    <div class="field">
      <label for="fTitle">Τίτλος</label>
      <input type="text" id="fTitle" placeholder="π.χ. Ραντεβού οδοντίατρο" value="${ev ? escapeHtml(ev.title) : ""}">
    </div>
    <div class="row2">
      <div class="field">
        <label for="fDate">Ημερομηνία</label>
        <input type="date" id="fDate" value="${ev?.event_date || dateIso || isoLocal(today())}">
      </div>
      <div class="field">
        <label for="fTime">Ώρα (προαιρετικό)</label>
        <input type="time" id="fTime" value="${ev?.event_time ? ev.event_time.slice(0,5) : ""}">
      </div>
    </div>
    <div class="field">
      <label for="fNotes">Σημειώσεις (προαιρετικό)</label>
      <textarea id="fNotes" style="min-height:70px">${ev?.notes ? escapeHtml(ev.notes) : ""}</textarea>
    </div>
    ${courseList.length ? `<div class="field">
      <label for="fCourse">Μάθημα (προαιρετικό)</label>
      <select id="fCourse">
        <option value="">—</option>
        ${courseList.map(c => `<option value="${c.id}" ${ev?.course_id === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
      </select>
    </div>` : ""}
    <div class="field">
      <label>Χρώμα</label>
      <div class="colors" data-colorpicker>
        ${EVENT_COLORS.map(c => `<button type="button" class="color-dot ${c === sel ? "selected" : ""}" style="background:${c}" data-color="${c}" aria-label="Χρώμα"></button>`).join("")}
      </div>
    </div>`;
}

function openForm(ev, dateIso, rerender) {
  openModal({
    title: ev ? "Επεξεργασία υποχρέωσης" : "Νέα υποχρέωση",
    body: formHtml(ev, dateIso),
    onOpen: overlay => {
      overlay.querySelector("[data-colorpicker]").addEventListener("click", e => {
        const btn = e.target.closest("[data-color]");
        if (!btn) return;
        overlay.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
        btn.classList.add("selected");
      });
    },
    onSave: async overlay => {
      const title = overlay.querySelector("#fTitle").value.trim();
      const event_date = overlay.querySelector("#fDate").value;
      if (!title) { toast("Συμπλήρωσε τίτλο.", "error"); return false; }
      if (!event_date) { toast("Συμπλήρωσε ημερομηνία.", "error"); return false; }
      const row = {
        title, event_date,
        event_time: overlay.querySelector("#fTime").value || null,
        notes: overlay.querySelector("#fNotes").value.trim() || null,
        course_id: overlay.querySelector("#fCourse")?.value || null,
        color: overlay.querySelector("[data-colorpicker] .selected")?.dataset.color || EVENT_COLORS[0]
      };
      if (ev) await events.update(ev.id, row);
      else await events.insert(row);
      toast(ev ? "Η υποχρέωση ενημερώθηκε" : "Η υποχρέωση προστέθηκε");
      await rerender();
    }
  });
}

// Λίστα ημέρας: υποχρεώσεις + πληρωμές
function openDay(dateIso, payments, rerender) {
  const dayEvents = evItems.filter(e => e.event_date === dateIso);
  const pays = payments[dateIso] || [];
  const d = new Date(dateIso + "T00:00:00");
  const body = `
    ${pays.length ? `<div class="section-title" style="margin-top:0">Πληρωμές</div>
      <div class="list">${pays.map(s => `
        <div class="card" style="padding:10px 14px">
          <div class="logo logo-sm" style="--logo:${s.color};background:${s.color}">${logoFor(s)}</div>
          <div class="card-main"><div class="name">${escapeHtml(s.name)}</div></div>
          <div class="price">${fmt(s.price)}</div>
        </div>`).join("")}</div>` : ""}
    <div class="section-title" ${!pays.length ? 'style="margin-top:0"' : ""}>Υποχρεώσεις</div>
    ${dayEvents.length ? `<div class="list">${dayEvents.map(e => `
      <div class="card" style="padding:10px 14px;border-left:3px solid ${e.color}">
        <div class="card-main">
          <div class="name">${escapeHtml(e.title)}${e.event_time ? ` <span class="chip">${e.event_time.slice(0,5)}</span>` : ""}</div>
          ${e.notes ? `<div class="meta">${escapeHtml(e.notes)}</div>` : ""}
        </div>
        <div class="card-actions">
          <button class="icon-btn" data-ev-edit="${e.id}" aria-label="Επεξεργασία">${icons.edit}</button>
          <button class="icon-btn" data-ev-del="${e.id}" aria-label="Διαγραφή">${icons.trash}</button>
        </div>
      </div>`).join("")}</div>` : `<p style="color:var(--muted);font-size:14px">Καμία υποχρέωση.</p>`}
    <button class="btn btn-ghost btn-block" id="btnAddDay" style="margin-top:16px">${icons.plus} Νέα υποχρέωση</button>`;

  const m = openModal({
    title: d.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" }),
    body
  });
  m.el.querySelector("#btnAddDay").addEventListener("click", () => { m.close(); openForm(null, dateIso, rerender); });
  m.el.addEventListener("click", e => {
    const eb = e.target.closest("[data-ev-edit]");
    const db = e.target.closest("[data-ev-del]");
    if (eb) { m.close(); openForm(evItems.find(x => x.id === eb.dataset.evEdit), null, rerender); }
    if (db) {
      m.close();
      confirmModal("Διαγραφή αυτής της υποχρέωσης;", async () => {
        await events.remove(db.dataset.evDel);
        toast("Η υποχρέωση διαγράφηκε");
        await rerender();
      });
    }
  });
}

export async function render(view) {
  [evItems, subItems, courseList] = await Promise.all([
    events.list(), subscriptions.list(), courses.list().catch(() => [])
  ]);
  const year = shown.getFullYear(), month = shown.getMonth();
  const payments = paymentsInMonth(year, month);
  const byDay = eventsByDay();
  const todayIso = isoLocal(today());

  // Πλέγμα: Δευτέρα πρώτη μέρα
  const first = new Date(year, month, 1);
  let startOffset = (first.getDay() + 6) % 7;
  const cells = [];
  const start = new Date(year, month, 1 - startOffset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push(d);
  }

  view.innerHTML = `
    <div class="page-head">
      <h1>Ημερολόγιο</h1>
      <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέα υποχρέωση</button>
    </div>
    <div class="cal-head">
      <button class="icon-btn" id="calPrev" aria-label="Προηγούμενος μήνας">${icons.chevronL}</button>
      <h2>${shown.toLocaleDateString("el-GR", { month: "long", year: "numeric" })}</h2>
      <button class="icon-btn" id="calNext" aria-label="Επόμενος μήνας">${icons.chevronR}</button>
    </div>
    <div class="cal-grid">
      ${DOW.map(d => `<div class="cal-dow">${d}</div>`).join("")}
      ${cells.map(d => {
        const iso = isoLocal(d);
        const inMonth = d.getMonth() === month;
        const dayEvents = byDay[iso] || [];
        const pays = payments[iso] || [];
        const pills = [
          ...pays.map(s => `<span class="cal-pill" style="background:${s.color}">${escapeHtml(s.name)}</span>`),
          ...dayEvents.map(e => `<span class="cal-pill" style="background:${e.color}">${escapeHtml(e.title)}</span>`)
        ];
        const dots = [
          ...pays.map(s => `<span class="cal-dot" style="background:${s.color}"></span>`),
          ...dayEvents.map(e => `<span class="cal-dot" style="background:${e.color}"></span>`)
        ];
        return `<button class="cal-cell ${inMonth ? "" : "other-month"} ${iso === todayIso ? "today-cell" : ""}" data-day="${iso}">
          <span class="cal-daynum">${d.getDate()}</span>
          ${pills.slice(0, 3).join("")}
          ${pills.length > 3 ? `<span class="cal-more">+${pills.length - 3} ακόμα</span>` : ""}
          <span class="cal-dot-row">${dots.slice(0, 4).join("")}</span>
        </button>`;
      }).join("")}
    </div>`;

  const rerender = () => render(view);
  view.querySelector("#btnAdd").addEventListener("click", () => openForm(null, null, rerender));
  view.querySelector("#calPrev").addEventListener("click", () => { shown = new Date(year, month - 1, 1); rerender(); });
  view.querySelector("#calNext").addEventListener("click", () => { shown = new Date(year, month + 1, 1); rerender(); });
  view.querySelectorAll("[data-day]").forEach(c =>
    c.addEventListener("click", () => openDay(c.dataset.day, payments, rerender)));
}
