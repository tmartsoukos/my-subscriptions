// Ποιος μου χρωστάει, με υπενθύμιση ανά άτομο ή σε όλους μαζί.
import {
  escapeHtml, fmt, fmtDate, nextDue, myShare, icons, haptic,
  sendReminder, sendGroupReminder
} from "../../../ui.js";

export const id = "debts";

export function html(m) {
  if (!m.debtList.length) return "";
  return `<div class="chart-card" style="margin-top:12px">
    <h3>Μου χρωστάνε · σύνολο ${fmt(m.owedTotal)}
      ${m.debtList.length > 1 ? `<button class="btn btn-ghost btn-sm" id="btnRemindAll" style="margin-left:auto">
        ${icons.send} Σε όλους</button>` : ""}
    </h3>
    <div class="list">
      ${m.debtList.map(([name, amount]) => `
        <div class="card" style="padding:10px 14px">
          <div class="logo" style="background:var(--surface2);width:34px;height:34px;font-size:15px;color:var(--text)">${
            escapeHtml(name.charAt(0).toUpperCase())}</div>
          <div class="card-main">
            <div class="name">${escapeHtml(name)}</div>
            <div class="meta">${escapeHtml(m.subsOf(name).map(s => s.name).join(", "))}</div>
          </div>
          <div class="price">${fmt(amount)}</div>
          <button class="icon-btn subtle" data-remind-person="${escapeHtml(name)}"
            aria-label="Υπενθύμιση σε ${escapeHtml(name)}">${icons.send}</button>
        </div>`).join("")}
    </div>
    <p class="hint" style="margin-top:10px">Σημείωσε ποιος πλήρωσε από τη σελίδα «Συνδρομές», πατώντας το όνομά του.</p>
  </div>`;
}

// Επιστρέφει true αν χειρίστηκε το πάτημα
export async function click(e, m) {
  // Ένα μήνυμα για όλους μαζί, π.χ. στην ομαδική συνομιλία
  if (e.target.closest("#btnRemindAll")) {
    haptic("tap");
    await sendGroupReminder(m.debtList.map(([name, amount]) => ({
      name, amount, detail: m.subsOf(name).map(s => s.name).join(", ")
    })));
    return true;
  }
  const btn = e.target.closest("[data-remind-person]");
  if (!btn) return false;
  e.preventDefault();
  haptic("tap");
  const name = btn.dataset.remindPerson;
  await sendReminder(
    m.subsOf(name).map(s => ({ name: s.name, amount: myShare(s), date: fmtDate(nextDue(s)) })),
    name
  );
  return true;
}
