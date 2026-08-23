// Χάρτης θερμότητας: μία κουκκίδα ανά ημέρα, όσο πιο σκούρα τόσο μεγαλύτερο το ποσό.
// Δείχνει μοτίβα που ο μέσος όρος κρύβει.
import { isoLocal, today, escapeHtml } from "./ui.js";

const CELL = 12, GAP = 3, PITCH = CELL + GAP;
const DOW = ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"];
const MONTH = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];
const LEVEL_OPACITY = [0, 0.28, 0.5, 0.72, 1];

// valueByDate: { "2026-08-24": 12.5, ... }
export function heatmap(valueByDate, { weeks = 26, format = v => String(v), empty = "τίποτα" } = {}) {
  const t = today();
  const dow = (t.getDay() + 6) % 7;                  // 0 = Δευτέρα
  const start = new Date(t);
  start.setDate(start.getDate() - dow - (weeks - 1) * 7);

  const values = Object.values(valueByDate).filter(v => v > 0);
  const max = values.length ? Math.max(...values) : 0;
  const level = v => {
    if (!v || max <= 0) return 0;
    return Math.min(4, Math.ceil(v / max * 4));
  };

  const padL = 18, padT = 16;
  const width = padL + weeks * PITCH;
  const height = padT + 7 * PITCH + 4;

  let cells = "", months = "";
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7 + d);
      const iso = isoLocal(date);
      const future = date > t;
      const v = valueByDate[iso] || 0;
      const lv = level(v);
      const x = padL + w * PITCH, y = padT + d * PITCH;
      const label = date.toLocaleDateString("el-GR", { day: "numeric", month: "long" });
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3"
        fill="var(--accent)" fill-opacity="${future ? 0.04 : lv ? LEVEL_OPACITY[lv] : 0.09}"
        stroke="var(--border)" stroke-width=".5">
        <title>${escapeHtml(label)}: ${escapeHtml(future ? "—" : v ? format(v) : empty)}</title></rect>`;
      // Ετικέτα μήνα στην πρώτη εβδομάδα που τον περιέχει
      if (d === 0 && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth();
        months += `<text x="${x}" y="${padT - 5}" class="hm-month">${MONTH[lastMonth]}</text>`;
      }
    }
  }
  const rows = DOW.map((l, i) => i % 2 === 0
    ? `<text x="0" y="${padT + i * PITCH + CELL - 2}" class="hm-dow">${l}</text>` : "").join("");

  return `<div class="heatmap-wrap">
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="heatmap" role="img"
      aria-label="Χάρτης ημερών των τελευταίων ${weeks} εβδομάδων">
      ${months}${rows}${cells}
    </svg>
    <div class="hm-legend">
      <span>λιγότερα</span>
      ${LEVEL_OPACITY.map(o => `<i style="background:var(--accent);opacity:${o || 0.09}"></i>`).join("")}
      <span>περισσότερα${max ? ` · ώς ${escapeHtml(format(max))}` : ""}</span>
    </div>
  </div>`;
}
