// Επερχόμενες πληρωμές του επόμενου 30ημέρου.
import { escapeHtml, fmt, fmtDateShort, daysUntil, nextDue, myShare, isInTrial } from "../../../ui.js";
import { logoFor, dnaAttrs } from "../../../logos.js";

export const id = "upcoming";

export function html(m) {
  return `<div class="charts"><div class="chart-card">
    <h3>Επερχόμενες πληρωμές (30 ημέρες)</h3>
    ${m.upcoming.length ? `<div class="list">${m.upcoming.map(s => {
      const d = nextDue(s), days = daysUntil(d);
      const cls = days === 0 ? "today" : days <= 7 ? "soon" : "ok";
      const txt = days === 0 ? "Σήμερα" : days === 1 ? "Αύριο" : fmtDateShort(d);
      return `<div class="card" style="padding:10px 14px">
        <div class="logo logo-sm" ${dnaAttrs(s, `--logo:${s.color};background:${s.color};`)}>${logoFor(s)}</div>
        <div class="card-main"><div class="name">${escapeHtml(s.name)}${
          isInTrial(s) ? ` <span class="badge badge-trial">ΛΗΞΗ ΔΟΚΙΜΗΣ</span>` : ""}</div></div>
        <div class="card-right" style="width:auto;order:0;display:block;text-align:right">
          <div class="price money" style="font-size:14px">${fmt(myShare(s))}</div>
          <div class="due ${cls}" style="margin-top:0">${txt}</div>
        </div>
      </div>`;
    }).join("")}</div>` : `<p style="color:var(--muted);font-size:13.5px">Καμία πληρωμή το επόμενο 30ήμερο.</p>`}
    <a href="#/subs" class="btn btn-ghost" style="margin-top:12px">Όλες οι συνδρομές</a>
  </div>
  <div class="chart-card"></div>`;
}
