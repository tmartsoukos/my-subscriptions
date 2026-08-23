import { subscriptions, todos, events, finance } from "../db.js";
import {
  escapeHtml, fmt, fmtDateShort, isoLocal, daysUntil, nextDue, monthlyCost,
  isInTrial, trialDaysLeft, members, myShare, unpaidMembers, CATEGORIES, CYCLES,
  icons, today, bindDrills
} from "../ui.js";
import { barChart, donutChart, CATEGORY_COLORS } from "../charts.js";
import { logoFor } from "../logos.js";
import { greeting, prefs, getLayout, pins as pinStore } from "../prefs.js";
import { notes, courses } from "../db.js";

const GOAL_LABELS = {
  subs_monthly: "Όριο συνδρομών",
  expense_monthly: "Όριο εξόδων μήνα",
  save_monthly: "Αποταμίευση μήνα",
  tasks_weekly: "Ολοκληρωμένες εργασίες"
};

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
        if (d >= start) sum += myShare(s); // το δικό μου μερίδιο σε μοιρασμένες
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
  const pinList = prefs().pins || [];
  const [subs, todoItems, evItems, finItems, noteItems, courseItems] = await Promise.all([
    subscriptions.list(), todos.list(), events.list(), finance.list().catch(() => []),
    pinList.some(p => p.kind === "note") ? notes.list().catch(() => []) : [],
    pinList.some(p => p.kind === "course") ? courses.list().catch(() => []) : []
  ]);

  // Οικονομικά τρέχοντος μήνα (αν υπάρχουν εγγραφές)
  const monthStart = isoLocal(new Date(today().getFullYear(), today().getMonth(), 1));
  const monthEntries = finItems.filter(e => e.entry_date >= monthStart);
  const monthIn = monthEntries.filter(e => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const monthOut = monthEntries.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);

  const trials = subs.filter(isInTrial);
  const monthly = subs.filter(s => !isInTrial(s)).reduce((s, x) => s + monthlyCost(x), 0);
  const pendingTodos = todoItems.filter(t => !t.done);

  // Οφειλές ανά πρόσωπο (μοιρασμένες συνδρομές που δεν έχουν πληρωθεί)
  const debts = {};
  for (const s of subs) {
    for (const m of unpaidMembers(s)) {
      debts[m.name] = (debts[m.name] || 0) + myShare(s);
    }
  }
  const debtList = Object.entries(debts).sort((a, b) => b[1] - a[1]);
  const owedTotal = debtList.reduce((sum, [, v]) => sum + v, 0);

  // Δοκιμές που λήγουν σύντομα — η πιο επείγουσα πληροφορία
  const endingTrials = trials.filter(s => trialDaysLeft(s) <= 7).sort((a, b) => trialDaysLeft(a) - trialDaysLeft(b));
  const todayIso = isoLocal(today());
  const in7 = isoLocal(new Date(today().getTime() + 7 * 86400000));
  const weekEvents = evItems.filter(e => e.event_date >= todayIso && e.event_date <= in7);

  const sortedSubs = [...subs].sort((a, b) => nextDue(a) - nextDue(b));
  const upcoming = sortedSubs.filter(s => daysUntil(nextDue(s)) <= 30).slice(0, 5);
  const next = sortedSubs[0];

  // Donut ανά κατηγορία (χωρίς τις δοκιμές — δεν κοστίζουν ακόμα)
  const byCat = {};
  for (const s of subs.filter(x => !isInTrial(x))) byCat[s.category] = (byCat[s.category] || 0) + monthlyCost(s);
  const donutItems = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, v]) => ({ label: CATEGORIES[cat] || "Άλλο", value: v, color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other }));

  const urgentTodos = pendingTodos
    .filter(t => t.due_date && t.due_date <= todayIso || t.priority === 1)
    .slice(0, 4);

  // Στόχοι: πρόοδος με βάση τα πραγματικά δεδομένα του μήνα
  const doneThisWeek = todoItems.filter(t => t.done).length;
  const goalRows = (prefs().goals || []).map(g => {
    const current =
      g.metric === "subs_monthly" ? monthly :
      g.metric === "expense_monthly" ? monthOut + monthly :
      g.metric === "save_monthly" ? Math.max(monthIn - monthOut - monthly, 0) :
      doneThisWeek;
    const target = Number(g.target);
    const pct = target > 0 ? Math.min(current / target * 100, 100) : 0;
    // Σε όρια δαπάνης θέλουμε να μένουμε κάτω· σε αποταμίευση/εργασίες να φτάνουμε πάνω
    const isCap = g.metric === "subs_monthly" || g.metric === "expense_monthly";
    const good = isCap ? current <= target : current >= target;
    const unit = g.metric === "tasks_weekly" ? "" : "€";
    const fmtVal = v => g.metric === "tasks_weekly" ? String(Math.round(v)) : fmt(v);
    return { g, pct, good, isCap, current, target, unit, fmtVal };
  });

  // Καρφιτσωμένα: ό,τι έχεις σημαδέψει, με σύνδεσμο στη σελίδα του
  const pinned = pinList.map(p => {
    if (p.kind === "subscription") {
      const x = subs.find(s => s.id === p.ref_id);
      return x && { icon: logoFor(x), color: x.color, title: x.name,
        meta: `${fmt(myShare(x))} · ${fmtDateShort(nextDue(x))}`, href: "#/subs" };
    }
    if (p.kind === "note") {
      const x = noteItems.find(n => n.id === p.ref_id);
      return x && { icon: icons.note, color: x.color, title: x.title?.trim() || "Σημείωση",
        meta: (x.content || "").replace(/\s+/g, " ").slice(0, 60), href: `#/notes/${x.id}` };
    }
    if (p.kind === "course") {
      const x = courseItems.find(c => c.id === p.ref_id);
      return x && { icon: icons.book, color: x.color, title: x.name,
        meta: [x.code, x.ects ? `${x.ects} ECTS` : ""].filter(Boolean).join(" · "), href: "#/studies" };
    }
    return null;
  }).filter(Boolean);

  const pinsBlock = pinned.length ? `<div class="chart-card pins-card">
    <h3>${icons.bookmark} Καρφιτσωμένα</h3>
    <div class="list">
      ${pinned.map(x => `<a class="card" href="${x.href}" style="padding:10px 14px">
        <div class="logo logo-sm" style="--logo:${x.color};background:${x.color}">${x.icon}</div>
        <div class="card-main">
          <div class="name">${escapeHtml(x.title)}</div>
          <div class="meta">${escapeHtml(x.meta || "")}</div>
        </div>
      </a>`).join("")}
    </div>
  </div>` : "";

  const blocks = {
    stats: `<div class="stats">
      <div class="stat" data-drill="monthly"><div class="label">Μηνιαίο κόστος</div><div class="value">${fmt(monthly)} <small>/ μήνα</small></div></div>
      <div class="stat" data-drill="next"><div class="label">Επόμενη πληρωμή</div><div class="value" style="font-size:16px">${next ? escapeHtml(next.name) + " · " + fmtDateShort(nextDue(next)) : "—"}</div></div>
      <div class="stat" data-drill="todos"><div class="label">Εκκρεμείς εργασίες</div><div class="value">${pendingTodos.length}</div></div>
      <div class="stat" data-drill="events"><div class="label">Υποχρεώσεις 7 ημερών</div><div class="value">${weekEvents.length}</div></div>
      ${owedTotal > 0 ? `<div class="stat" data-drill="owed"><div class="label">Μου χρωστάνε</div><div class="value">${fmt(owedTotal)}</div></div>` : ""}
      ${trials.length ? `<div class="stat" data-drill="trials"><div class="label">Σε δοκιμή</div><div class="value">${trials.length}</div></div>` : ""}
      ${finItems.length ? `<div class="stat" data-drill="balance"><div class="label">Υπόλοιπο μήνα</div>
        <div class="value ${monthIn - monthOut - monthly >= 0 ? "amount-in" : "amount-out"}">${fmt(monthIn - monthOut - monthly)}</div></div>` : ""}
    </div>`,
    goals: `${goalRows.length ? `<div class="chart-card goals-card">
      <h3>Στόχοι</h3>
      ${goalRows.map(({ g, pct, good, isCap, current, target, fmtVal }) => `
        <div class="goal">
          <div class="goal-head">
            <span>${escapeHtml(g.label || GOAL_LABELS[g.metric])}</span>
            <strong class="${good ? "amount-in" : "amount-out"}">${fmtVal(current)} / ${fmtVal(target)}</strong>
          </div>
          <div class="goal-bar"><span style="width:${pct}%;background:${good ? "var(--ok)" : "var(--warn)"}"></span></div>
          <div class="goal-note">${isCap
            ? (good ? `Μένεις εντός ορίου` : `Ξεπέρασες το όριο κατά ${fmtVal(current - target)}`)
            : (good ? `Το έπιασες` : `Λείπουν ${fmtVal(target - current)}`)}</div>
        </div>`).join("")}
    </div>` : ""}`,
    charts: `${subs.length ? `<div class="charts">
      <div class="chart-card">
        <h3>Προβλεπόμενες χρεώσεις — επόμενο 12μηνο</h3>
        ${barChart(monthlyProjection(subs))}
      </div>
      <div class="chart-card">
        <h3>Κατανομή ανά κατηγορία</h3>
        ${donutChart(donutItems, Math.round(monthly) + "€")}
      </div>
    </div>` : ""}`,
    upcoming: `<div class="charts"><div class="chart-card">
        <h3>Επερχόμενες πληρωμές (30 ημέρες)</h3>
        ${upcoming.length ? `<div class="list">${upcoming.map(s => {
          const d = nextDue(s), days = daysUntil(d);
          const cls = days === 0 ? "today" : days <= 7 ? "soon" : "ok";
          const txt = days === 0 ? "Σήμερα" : days === 1 ? "Αύριο" : fmtDateShort(d);
          return `<div class="card" style="padding:10px 14px">
            <div class="logo logo-sm" style="--logo:${s.color};background:${s.color}">${logoFor(s)}</div>
            <div class="card-main"><div class="name">${escapeHtml(s.name)}${isInTrial(s) ? ` <span class="badge badge-trial">ΛΗΞΗ ΔΟΚΙΜΗΣ</span>` : ""}</div></div>
            <div class="card-right" style="width:auto;order:0;display:block;text-align:right">
              <div class="price" style="font-size:14px">${fmt(myShare(s))}</div>
              <div class="due ${cls}" style="margin-top:0">${txt}</div>
            </div>
          </div>`;
        }).join("")}</div>` : `<p style="color:var(--muted);font-size:13.5px">Καμία πληρωμή το επόμενο 30ήμερο.</p>`}
        <a href="#/subs" class="btn btn-ghost" style="margin-top:12px">Όλες οι συνδρομές</a>
      </div>
      <div class="chart-card"></div>`,
    attention: `<div class="charts"><div class="chart-card">
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
    </div></div>`,
    debts: `${debtList.length ? `<div class="chart-card" style="margin-top:12px">
      <h3>Μου χρωστάνε · σύνολο ${fmt(owedTotal)}</h3>
      <div class="list">
        ${debtList.map(([name, amount]) => {
          const forSubs = subs.filter(s => unpaidMembers(s).some(m => m.name === name)).map(s => s.name);
          return `<div class="card" style="padding:10px 14px">
            <div class="logo" style="background:var(--surface2);width:34px;height:34px;font-size:15px;color:var(--text)">${escapeHtml(name.charAt(0).toUpperCase())}</div>
            <div class="card-main">
              <div class="name">${escapeHtml(name)}</div>
              <div class="meta">${escapeHtml(forSubs.join(", "))}</div>
            </div>
            <div class="price">${fmt(amount)}</div>
          </div>`;
        }).join("")}
      </div>
      <p class="hint" style="margin-top:10px">Σημείωσε ποιος πλήρωσε από τη σελίδα «Συνδρομές», πατώντας το όνομά του.</p>
    </div>` : ""}`,
    pins: pinsBlock
  };

  view.innerHTML = `<div class="page-head"><h1>${escapeHtml(greeting())}</h1></div>
    ${endingTrials.length ? `<div class="alert-trial">
      ${icons.bell}
      <div>
        <strong>Δωρεάν δοκιμή λήγει σύντομα</strong>
        <ul>${endingTrials.map(s => {
          const days = trialDaysLeft(s);
          const when = days === 0 ? "σήμερα" : days === 1 ? "αύριο" : `σε ${days} ημέρες`;
          return `<li><b>${escapeHtml(s.name)}</b> — ${when}, μετά ${fmt(myShare(s))} ανά ${s.cycle === "yearly" ? "έτος" : s.cycle === "weekly" ? "εβδομάδα" : "μήνα"}. Ακύρωσε αν δεν το θες.</li>`;
        }).join("")}</ul>
      </div>
    </div>` : ""}
    ${getLayout().filter(x => x.on).map(x => blocks[x.id] || "").join("")}
  `;

  // Κάθε αριθμός εξηγεί από τι φτιάχτηκε
  const whenText = iso => {
    const n = daysUntil(new Date(iso + "T00:00:00"));
    return n < 0 ? "εκπρόθεσμη" : n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`;
  };
  bindDrills(view, {
    monthly: () => ({
      title: "Μηνιαίο κόστος",
      total: fmt(monthly), totalLabel: "Σύνολο ανά μήνα",
      rows: subs.filter(s => !isInTrial(s))
        .sort((a, b) => monthlyCost(b) - monthlyCost(a))
        .map(s => ({
          label: s.name, color: s.color,
          meta: `${fmt(myShare(s))} ανά ${CYCLES[s.cycle]}${members(s).length ? ` · μερίδιο ${1}/${1 + members(s).length}` : ""}`,
          value: fmt(monthlyCost(s))
        })),
      note: "Οι εβδομαδιαίες και οι ετήσιες συνδρομές είναι ανηγμένες σε μήνα. Οι δοκιμές δεν μετράνε ακόμα."
    }),
    next: () => ({
      title: "Επόμενες πληρωμές",
      rows: sortedSubs.slice(0, 10).map(s => {
        const d = nextDue(s), n = daysUntil(d);
        return {
          label: s.name, color: s.color,
          meta: `${fmtDateShort(d)} · ${n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`}${isInTrial(s) ? " · λήξη δοκιμής" : ""}`,
          value: fmt(myShare(s))
        };
      })
    }),
    todos: () => ({
      title: "Εκκρεμείς εργασίες",
      total: String(pendingTodos.length), totalLabel: "Σύνολο",
      rows: [...pendingTodos]
        .sort((a, b) => a.priority - b.priority || (a.due_date || "9999").localeCompare(b.due_date || "9999"))
        .slice(0, 15)
        .map(t => ({
          label: t.title,
          meta: t.due_date ? whenText(t.due_date) : "χωρίς προθεσμία",
          value: t.priority === 1 ? "επείγον" : "",
          cls: t.due_date && t.due_date < todayIso ? "amount-out" : ""
        }))
    }),
    events: () => ({
      title: "Υποχρεώσεις 7 ημερών",
      rows: weekEvents.map(e => ({
        label: e.title, color: e.color,
        meta: `${fmtDateShort(new Date(e.event_date + "T00:00:00"))}${e.event_time ? " · " + e.event_time.slice(0, 5) : ""}`,
        value: whenText(e.event_date)
      }))
    }),
    owed: () => ({
      title: "Μου χρωστάνε",
      total: fmt(owedTotal), totalLabel: "Σύνολο",
      rows: debtList.map(([name, amount]) => ({
        label: name,
        meta: subs.filter(s => unpaidMembers(s).some(m => m.name === name)).map(s => s.name).join(", "),
        value: fmt(amount)
      }))
    }),
    trials: () => ({
      title: "Δωρεάν δοκιμές",
      rows: trials.sort((a, b) => trialDaysLeft(a) - trialDaysLeft(b)).map(s => {
        const n = trialDaysLeft(s);
        return {
          label: s.name, color: s.color,
          meta: `λήγει ${n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`} · μετά ${fmt(myShare(s))} ανά ${CYCLES[s.cycle]}`,
          value: fmt(monthlyCost(s)) + "/μήνα"
        };
      }),
      note: "Δεν προσμετρώνται στο μηνιαίο κόστος όσο διαρκεί η δοκιμή."
    }),
    balance: () => ({
      title: "Υπόλοιπο μήνα",
      total: fmt(monthIn - monthOut - monthly), totalLabel: "Απομένουν",
      rows: [
        { label: "Έσοδα", value: "+" + fmt(monthIn), cls: "amount-in", meta: (n => `${n} ${n === 1 ? "εγγραφή" : "εγγραφές"}`)(monthEntries.filter(e => e.kind === "income").length) },
        { label: "Έξοδα", value: "−" + fmt(monthOut), cls: "amount-out", meta: (n => `${n} ${n === 1 ? "εγγραφή" : "εγγραφές"}`)(monthEntries.filter(e => e.kind === "expense").length) },
        { label: "Συνδρομές", value: "−" + fmt(monthly), cls: "amount-out", meta: `${subs.filter(s => !isInTrial(s)).length} ενεργές` }
      ],
      note: "Από την 1η του μήνα μέχρι σήμερα."
    })
  });
}

