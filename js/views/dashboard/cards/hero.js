// Κύριος αριθμός: ένα νούμερο με βάρος, αντί για επτά ισοδύναμα.
import { escapeHtml, fmt, fmtDateShort, nextDue, isInTrial, icons, countUp } from "../../../ui.js";

export const id = "hero";

// Ο μετρητής τρέχει μία φορά ανά φόρτωση, όχι σε κάθε επανασχεδίαση της αρχικής
// (αλλιώς θα ξανάπαιζε σε κάθε καρφίτσωμα ή αλλαγή δεδομένων).
let counted = false;

export function html(m) {
  const daysLeftText = m.daysLeft === 0
    ? "τελευταία μέρα του μήνα"
    : `απομένουν ${m.daysLeft} ${m.daysLeft === 1 ? "ημέρα" : "ημέρες"}`;

  let deltaHtml = "";
  if (m.hasFinance && m.prevEntries.length && Math.abs(m.prevBalance) > 0.5) {
    const pct = Math.round((m.balance - m.prevBalance) / Math.abs(m.prevBalance) * 100);
    if (Math.abs(pct) >= 1) {
      deltaHtml = `<span class="hero-delta ${pct >= 0 ? "up" : "down"}">${icons.chevronUp}${Math.abs(pct)}%</span>
        <span class="hero-sub-text">από τον προηγούμενο μήνα</span>`;
    }
  }

  if (m.hasFinance) {
    return `<div class="hero hero-${m.balance >= 0 ? "up" : "down"}" data-drill="balance">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-top"><span class="hero-icon">${icons.wallet}</span><span class="hero-label">Υπόλοιπο μήνα</span></div>
      <div class="hero-value ${m.balance >= 0 ? "amount-in" : "amount-out"}" data-count="${m.balance}">${fmt(m.balance)}</div>
      <div class="hero-sub">${deltaHtml}<span class="hero-sub-text">${daysLeftText}</span></div>
    </div>`;
  }

  const n = m.active.length;
  return `<div class="hero" data-drill="monthly">
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="hero-top"><span class="hero-icon">${icons.card}</span><span class="hero-label">Μηνιαίο κόστος</span></div>
    <div class="hero-value" data-count="${m.monthly}">${fmt(m.monthly)}</div>
    <div class="hero-sub"><span class="hero-sub-text">${n} ${n === 1 ? "συνδρομή" : "συνδρομές"}${
      m.next ? ` · επόμενη ${escapeHtml(m.next.name)} ${fmtDateShort(nextDue(m.next))}` : ""}</span></div>
  </div>`;
}

export function bind(view) {
  if (counted) return;
  const el = view.querySelector(".hero-value[data-count]");
  if (!el) return;
  counted = true;
  countUp(el, Number(el.dataset.count), fmt);
}
