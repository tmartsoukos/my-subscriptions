// Στόχοι με μπάρα προόδου.
import { escapeHtml } from "../../../ui.js";

export const id = "goals";

const GOAL_LABELS = {
  subs_monthly: "Όριο συνδρομών",
  expense_monthly: "Όριο εξόδων μήνα",
  save_monthly: "Αποταμίευση μήνα",
  tasks_weekly: "Ολοκληρωμένες εργασίες"
};

export function html(m) {
  if (!m.goalRows.length) return "";
  return `<div class="chart-card goals-card">
    <h3>Στόχοι</h3>
    ${m.goalRows.map(({ g, pct, good, isCap, current, target, fmtVal }) => `
      <div class="goal">
        <div class="goal-head">
          <span>${escapeHtml(g.label || GOAL_LABELS[g.metric])}</span>
          <strong class="${good ? "amount-in" : "amount-out"}">${fmtVal(current)} / ${fmtVal(target)}</strong>
        </div>
        <div class="goal-bar"><span style="width:${pct}%;background:${good ? "var(--ok)" : "var(--warn)"}"></span></div>
        <div class="goal-note">${isCap
          ? (good ? "Μένεις εντός ορίου" : `Ξεπέρασες το όριο κατά ${fmtVal(current - target)}`)
          : (good ? "Το έπιασες" : `Λείπουν ${fmtVal(target - current)}`)}</div>
      </div>`).join("")}
  </div>`;
}
