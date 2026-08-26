// Τα δύο γραφήματα των συνδρομών: πρόβλεψη 12μήνου και κατανομή ανά κατηγορία.
import { today, nextDue, myShare } from "../../../ui.js";
import { barChart, donutChart } from "../../../charts.js";

export const id = "charts";

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

export function html(m) {
  if (!m.subs.length) return "";
  return `<div class="charts">
    <div class="chart-card">
      <h3>Προβλεπόμενες χρεώσεις — επόμενο 12μηνο</h3>
      ${barChart(monthlyProjection(m.subs))}
    </div>
    <div class="chart-card">
      <h3>Κατανομή ανά κατηγορία</h3>
      ${donutChart(m.donutItems, Math.round(m.monthly) + "€")}
    </div>
  </div>`;
}
