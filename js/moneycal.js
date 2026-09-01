// Ημερολόγιο χρημάτων: ένας μήνας με τα ποσά πάνω στις μέρες.
// Πίσω από σήμερα δείχνει τι έγινε, μπροστά τι έρχεται από τις συνδρομές.
import { escapeHtml, fmt, isoLocal, today, nextDue } from "./ui.js";
import { isFlow } from "./money.js";

const WEEKDAYS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];
const MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

// Οι χρεώσεις μιας συνδρομής μέσα σε ένα διάστημα. Ξεκινάμε από την επόμενη
// και κυλάμε μπροστά όσο χωράει — έτσι φαίνονται και οι δύο χρεώσεις ενός
// εβδομαδιαίου κύκλου μέσα στον ίδιο μήνα.
export function chargeDates(sub, fromIso, toIso) {
  const out = [];
  const d = nextDue(sub);
  for (let i = 0; i < 40; i++) {
    const iso = isoLocal(d);
    if (iso > toIso) break;
    if (iso >= fromIso) out.push(iso);
    if (sub.cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
    else if (sub.cycle === "weekly") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  }
  return out;
}

// month: Date οποιασδήποτε ημέρας του μήνα που δείχνουμε
export function monthCalendar({ month, entries, subs = [] }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const fromIso = isoLocal(first);
  const toIso = isoLocal(last);
  const todayIso = isoLocal(today());

  const out = {}, inc = {};
  for (const e of entries) {
    if (!isFlow(e) || e.entry_date < fromIso || e.entry_date > toIso) continue;
    const bag = e.kind === "income" ? inc : out;
    bag[e.entry_date] = (bag[e.entry_date] || 0) + Number(e.amount);
  }

  // Προγραμματισμένες χρεώσεις — μόνο από σήμερα και μπροστά
  const planned = {};
  for (const s of subs) {
    for (const iso of chargeDates(s, fromIso > todayIso ? fromIso : todayIso, toIso)) {
      (planned[iso] = planned[iso] || []).push(s);
    }
  }

  // Η εβδομάδα ξεκινά Δευτέρα: η Κυριακή (0) πηγαίνει στο τέλος
  const lead = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<div class="cal-cell empty"></div>`);

  for (let day = 1; day <= last.getDate(); day++) {
    const iso = isoLocal(new Date(month.getFullYear(), month.getMonth(), day));
    const o = out[iso] || 0, i2 = inc[iso] || 0, p = planned[iso] || [];
    const has = o || i2;
    const cls = [
      "cal-cell",
      iso === todayIso ? "today" : "",
      has ? "has" : "",
      p.length ? "planned" : ""
    ].filter(Boolean).join(" ");
    const title = p.length
      ? `Προγραμματισμένα: ${p.map(s => s.name).join(", ")}`
      : has ? `Έξοδα ${fmt(o)}` : "";
    cells.push(`<div class="${cls}" ${has || p.length ? `data-drill="day:${iso}"` : ""}
      ${title ? `title="${escapeHtml(title)}"` : ""}>
      <span class="cal-day">${day}</span>
      ${o ? `<span class="cal-out">${Math.round(o)}</span>` : ""}
      ${i2 ? `<span class="cal-in">+${Math.round(i2)}</span>` : ""}
      ${p.length ? `<span class="cal-dots">${p.slice(0, 3).map(s =>
        `<i style="background:${escapeHtml(s.color || "#7b8fd6")}"></i>`).join("")}</span>` : ""}
    </div>`);
  }

  return `<div class="cal">
    <div class="cal-head">
      <button class="icon-btn" data-cal="-1" aria-label="Προηγούμενος μήνας">‹</button>
      <strong>${MONTHS[month.getMonth()]} ${month.getFullYear()}</strong>
      <button class="icon-btn" data-cal="1" aria-label="Επόμενος μήνας">›</button>
    </div>
    <div class="cal-grid">
      ${WEEKDAYS.map(d => `<div class="cal-wd">${d}</div>`).join("")}
      ${cells.join("")}
    </div>
    <p class="hint cal-legend">Οι κουκκίδες δείχνουν συνδρομές που χρεώνονται εκείνη τη μέρα.</p>
  </div>`;
}
