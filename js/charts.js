// Χειροποίητα SVG γραφήματα — χρώματα επικυρωμένα (dataviz validator, dark surface #0d1630)
import { escapeHtml, fmt } from "./ui.js";

// Σταθερή αντιστοίχιση κατηγορίας -> χρώμα (το χρώμα ακολουθεί την οντότητα)
export const CATEGORY_COLORS = {
  streaming: "#4c8dff", utilities: "#bb8130", software: "#9a7cf6",
  fitness: "#31a35f", gaming: "#d963a0", music: "#1ba3ba", other: "#7b8fd6"
};

// Ράβδοι: προβλεπόμενες χρεώσεις ανά μήνα (ένα μέγεθος, ένα χρώμα)
export function barChart(points) {
  const W = 560, H = 220, padL = 44, padB = 26, padT = 16, padR = 8;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(...points.map(p => p.value), 1);
  const step = plotW / points.length;
  const barW = Math.min(step * 0.55, 34);
  const maxIdx = points.findIndex(p => p.value === max);

  // Γραμμές πλέγματος (διακριτικές)
  const ticks = [0, 0.5, 1].map(f => {
    const y = padT + plotH * (1 - f);
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(148,178,255,.1)" stroke-width="1"/>
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#8b9bc0">${Math.round(max * f)}€</text>`;
  }).join("");

  const bars = points.map((p, i) => {
    const h = Math.max(p.value / max * plotH, p.value > 0 ? 3 : 0);
    const x = padL + step * i + (step - barW) / 2;
    const y = padT + plotH - h;
    return `<g>
      <title>${escapeHtml(p.label)}: ${fmt(p.value)}</title>
      <rect x="${x - 4}" y="${padT}" width="${barW + 8}" height="${plotH}" fill="transparent"/>
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="#4c8dff"/>
      ${i === maxIdx && p.value > 0 ? `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#e8eefc">${Math.round(p.value)}€</text>` : ""}
      <text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#8b9bc0">${escapeHtml(p.label)}</text>
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Προβλεπόμενες χρεώσεις ανά μήνα">
    ${ticks}${bars}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="rgba(148,178,255,.25)" stroke-width="1"/>
  </svg>`;
}

// Donut: κατανομή μηνιαίου κόστους ανά κατηγορία (κενό 2px μεταξύ τμημάτων)
export function donutChart(items, centerLabel) {
  const size = 190, cx = size / 2, cy = size / 2, r = 70, rIn = 46;
  const total = items.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return "";
  let angle = -Math.PI / 2;
  const segs = items.map(x => {
    const frac = x.value / total;
    const a0 = angle, a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rr) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    return `<path d="M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${p(a1, rIn)} A ${rIn} ${rIn} 0 ${large} 0 ${p(a0, rIn)} Z"
      fill="${x.color}" stroke="#0d1630" stroke-width="2">
      <title>${escapeHtml(x.label)}: ${fmt(x.value)} (${Math.round(frac * 100)}%)</title>
    </path>`;
  }).join("");

  const legend = items.map(x =>
    `<span><i style="background:${x.color}"></i>${escapeHtml(x.label)} · ${fmt(x.value)}</span>`).join("");

  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <svg viewBox="0 0 ${size} ${size}" style="max-width:190px" role="img" aria-label="Κατανομή κόστους ανά κατηγορία">
      ${segs}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="17" font-weight="700" fill="#e8eefc">${escapeHtml(centerLabel)}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" fill="#8b9bc0">/ μήνα</text>
    </svg>
    <div class="legend" style="flex-direction:column;align-items:flex-start;gap:7px">${legend}</div>
  </div>`;
}
