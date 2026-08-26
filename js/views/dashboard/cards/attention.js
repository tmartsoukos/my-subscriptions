// Ό,τι θέλει προσοχή μέσα στην εβδομάδα: υποχρεώσεις και επείγουσες εργασίες.
import { escapeHtml, fmtDateShort } from "../../../ui.js";

export const id = "attention";

export function html(m) {
  return `<div class="charts"><div class="chart-card">
    <h3>Θέλουν προσοχή</h3>
    ${m.weekEvents.length || m.urgentTodos.length ? `<div class="list">
      ${m.weekEvents.slice(0, 3).map(e => `
        <div class="card" style="padding:10px 14px;border-left:3px solid ${e.color}">
          <div class="card-main"><div class="name">${escapeHtml(e.title)}</div>
          <div class="meta">${fmtDateShort(new Date(e.event_date + "T00:00:00"))}${
            e.event_time ? " · " + e.event_time.slice(0, 5) : ""}</div></div>
        </div>`).join("")}
      ${m.urgentTodos.map(t => `
        <div class="card todo-item" style="padding:10px 14px">
          <span class="prio prio-${t.priority}"></span>
          <span class="todo-title">${escapeHtml(t.title)}</span>
          ${t.due_date ? `<span class="todo-due ${t.due_date <= m.todayIso ? "overdue" : ""}">${
            t.due_date === m.todayIso ? "Σήμερα" : fmtDateShort(new Date(t.due_date + "T00:00:00"))}</span>` : ""}
        </div>`).join("")}
    </div>` : `<p style="color:var(--muted);font-size:13.5px">Όλα ήσυχα — καμία επείγουσα εκκρεμότητα.</p>`}
    <div style="display:flex;gap:8px;margin-top:12px">
      <a href="#/todos" class="btn btn-ghost">Εργασίες</a>
      <a href="#/calendar" class="btn btn-ghost">Ημερολόγιο</a>
    </div>
  </div>
</div></div>`;
}
