import { subscriptions, todos, events } from "../db.js";
import { escapeHtml, fmt, fmtDateShort, isoLocal, daysUntil, nextDue, monthlyCost, CATEGORIES, icons, today } from "../ui.js";
import { barChart, donutChart, CATEGORY_COLORS } from "../charts.js";

// Χρεώσεις που πέφτουν σε κάθε έναν από τους επόμενους 12 μήνες
function monthlyProjection(subs) {
  const out = [];
  const t = today();
  for (let m = 0; m < 12; m++) {
    const start = new Date(t.getFullYear(), t.getMonth() + m, 1);
    const end = new Date(t.getFullYear(), t.getMonth() + m + 1, 0);
    let sum = 0;
    for (const s of subs) {
      let d = nextDue(s);
      while (d <= end) {
        if (d >= start) sum += Number(s.price);
        const nd = new Date(d);
        if (s.cycle === "weekly") nd.setDate(nd.getDate() + 7);
        else if (s.cycle === "monthly") nd.setMonth(nd.getMonth() + 1);
        else nd.setFullYear(nd.getFullYear() + 1);
        d = nd;
      }
    }
    out.push({ label: start.toLocaleDateString("el-GR", { month: "short" }), value: sum });
  }
  return out;
}

export async function render(view) {
  const [subs, todoItems, evItems] = await Promise.all([
    subscriptions.list(), todos.list(), events.list()
  ]);

  const monthly = subs.reduce((s, x) => s + monthlyCost(x), 0);
  const pendingTodos = todoItems.filter(t => !t.done);
  const todayIso = isoLocal(today());
  const in7 = isoLocal(new Date(Date.now() + 7 * 86400000));
  const weekEvents = evItems.filter(e => e.event_date >= todayIso && e.event_date <= in7);

  const sortedSubs = [...subs].sort((a, b) => nextDue(a) - nextDue(b));
  const upcoming = sortedSubs.filter(s => daysUntil(nextDue(s)) <= 30).slice(0, 5);
  const next = sortedSubs[0];

  // Donut ανά κατηγορία
  const byCat = {};
  for (const s of subs) byCat[s.category] = (byCat[s.category] || 0) + monthlyCost(s);
  const donutItems = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, v]) => ({ label: CATEGORIES[cat] || "Άλλο", value: v, color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other }));

  const urgentTodos = pendingTodos
    .filter(t => t.due_date && t.due_date <= todayIso || t.priority === 1)
    .slice(0, 4);

  view.innerHTML = `
    <div class="page-head"><h1>Επισκόπηση</h1></div>
    <div class="stats">
      <div class="stat"><div class="label">Μηνιαίο κόστος</div><div class="value">${fmt(monthly)} <small>/ μήνα</small></div></div>
      <div class="stat"><div class="label">Επόμενη πληρωμή</div><div class="value" style="font-size:16px">${next ? escapeHtml(next.name) + " · " + fmtDateShort(nextDue(next)) : "—"}</div></div>
      <div class="stat"><div class="label">Εκκρεμείς εργασίες</div><div class="value">${pendingTodos.length}</div></div>
      <div class="stat"><div class="label">Υποχρεώσεις 7 ημερών</div><div class="value">${weekEvents.length}</div></div>
    </div>

    ${subs.length ? `<div class="charts">
      <div class="chart-card">
        <h3>Προβλεπόμενες χρεώσεις — επόμενο 12μηνο</h3>
        ${barChart(monthlyProjection(subs))}
      </div>
      <div class="chart-card">
        <h3>Κατανομή ανά κατηγορία</h3>
        ${donutChart(donutItems, Math.round(monthly) + "€")}
      </div>
    </div>` : ""}

    <div class="charts" style="margin-top:4px">
      <div class="chart-card">
        <h3>Επερχόμενες πληρωμές (30 ημέρες)</h3>
        ${upcoming.length ? `<div class="list">${upcoming.map(s => {
          const d = nextDue(s), days = daysUntil(d);
          const cls = days === 0 ? "today" : days <= 7 ? "soon" : "ok";
          const txt = days === 0 ? "Σήμερα" : days === 1 ? "Αύριο" : fmtDateShort(d);
          return `<div class="card" style="padding:10px 14px">
            <div class="logo" style="background:${s.color};width:34px;height:34px;font-size:15px">${escapeHtml(s.name[0].toUpperCase())}</div>
            <div class="card-main"><div class="name">${escapeHtml(s.name)}</div></div>
            <div class="card-right" style="width:auto;order:0;display:block;text-align:right">
              <div class="price" style="font-size:14px">${fmt(s.price)}</div>
              <div class="due ${cls}" style="margin-top:0">${txt}</div>
            </div>
          </div>`;
        }).join("")}</div>` : `<p style="color:var(--muted);font-size:13.5px">Καμία πληρωμή το επόμενο 30ήμερο.</p>`}
        <a href="#/subs" class="btn btn-ghost" style="margin-top:12px">Όλες οι συνδρομές</a>
      </div>
      <div class="chart-card">
        <h3>Θέλουν προσοχή</h3>
        ${weekEvents.length || urgentTodos.length ? `<div class="list">
          ${weekEvents.slice(0, 3).map(e => `
            <div class="card" style="padding:10px 14px;border-left:3px solid ${e.color}">
              <div class="card-main"><div class="name">${escapeHtml(e.title)}</div>
              <div class="meta">${fmtDateShort(new Date(e.event_date + "T00:00:00"))}${e.event_time ? " · " + e.event_time.slice(0, 5) : ""}</div></div>
            </div>`).join("")}
          ${urgentTodos.map(t => `
            <div class="card todo-item" style="padding:10px 14px">
              <span class="prio prio-${t.priority}"></span>
              <span class="todo-title">${escapeHtml(t.title)}</span>
              ${t.due_date ? `<span class="todo-due ${t.due_date <= todayIso ? "overdue" : ""}">${t.due_date === todayIso ? "Σήμερα" : fmtDateShort(new Date(t.due_date + "T00:00:00"))}</span>` : ""}
            </div>`).join("")}
        </div>` : `<p style="color:var(--muted);font-size:13.5px">Όλα ήσυχα — καμία επείγουσα εκκρεμότητα.</p>`}
        <div style="display:flex;gap:8px;margin-top:12px">
          <a href="#/todos" class="btn btn-ghost">Εργασίες</a>
          <a href="#/calendar" class="btn btn-ghost">Ημερολόγιο</a>
        </div>
      </div>
    </div>`;
}
