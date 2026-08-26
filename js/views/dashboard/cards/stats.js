// Τα μικρά στατιστικά. Κάθε ένα ανοίγει την ανάλυσή του (βλ. drills.js).
import { escapeHtml, fmt, fmtDateShort, nextDue } from "../../../ui.js";

export const id = "stats";

export function html(m) {
  return `<div class="stats">
    <div class="stat" data-drill="monthly"><div class="label">Μηνιαίο κόστος</div><div class="value">${fmt(m.monthly)} <small>/ μήνα</small></div></div>
    <div class="stat" data-drill="next"><div class="label">Επόμενη πληρωμή</div><div class="value" style="font-size:16px">${
      m.next ? escapeHtml(m.next.name) + " · " + fmtDateShort(nextDue(m.next)) : "—"}</div></div>
    <div class="stat" data-drill="todos"><div class="label">Εκκρεμείς εργασίες</div><div class="value">${m.pendingTodos.length}</div></div>
    <div class="stat" data-drill="events"><div class="label">Υποχρεώσεις 7 ημερών</div><div class="value">${m.weekEvents.length}</div></div>
    ${m.owedTotal > 0 ? `<div class="stat" data-drill="owed"><div class="label">Μου χρωστάνε</div><div class="value">${fmt(m.owedTotal)}</div></div>` : ""}
    ${m.trials.length ? `<div class="stat" data-drill="trials"><div class="label">Σε δοκιμή</div><div class="value">${m.trials.length}</div></div>` : ""}
    ${m.hasFinance && !m.heroOn ? `<div class="stat" data-drill="balance"><div class="label">Υπόλοιπο μήνα</div>
      <div class="value ${m.balance >= 0 ? "amount-in" : "amount-out"}">${fmt(m.balance)}</div></div>` : ""}
  </div>`;
}
