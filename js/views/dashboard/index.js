// Η αρχική: φορτώνει τα δεδομένα, χτίζει το μοντέλο και συναρμολογεί τις κάρτες
// με τη σειρά που έχει ορίσει ο χρήστης. Κάθε κάρτα ζει στο δικό της αρχείο —
// για να προσθέσεις νέα, φτιάξε ένα module στο cards/ και βάλ' το στη λίστα CARDS
// (και μια ετικέτα στο DASH_CARDS του prefs.js).
import { subscriptions, todos, events, finance, notes, courses } from "../../db.js";
import { escapeHtml, fmt, myShare, trialDaysLeft, icons, bindDrills } from "../../ui.js";
import { greeting, prefs, getLayout, setMood } from "../../prefs.js";
import { buildModel } from "./model.js";
import { drillMap } from "./drills.js";

import * as hero from "./cards/hero.js";
import * as pins from "./cards/pins.js";
import * as stats from "./cards/stats.js";
import * as ask from "./cards/ask.js";
import * as goals from "./cards/goals.js";
import * as charts from "./cards/charts.js";
import * as upcoming from "./cards/upcoming.js";
import * as attention from "./cards/attention.js";
import * as debts from "./cards/debts.js";

const CARDS = Object.fromEntries(
  [hero, pins, stats, ask, goals, charts, upcoming, attention, debts].map(c => [c.id, c])
);

// Οι δοκιμές που λήγουν είναι η πιο επείγουσα πληροφορία — πάνω από κάθε κάρτα
function trialAlert(m) {
  if (!m.endingTrials.length) return "";
  return `<div class="alert-trial">
    ${icons.bell}
    <div>
      <strong>Δωρεάν δοκιμή λήγει σύντομα</strong>
      <ul>${m.endingTrials.map(s => {
        const days = trialDaysLeft(s);
        const when = days === 0 ? "σήμερα" : days === 1 ? "αύριο" : `σε ${days} ημέρες`;
        const cycle = s.cycle === "yearly" ? "έτος" : s.cycle === "weekly" ? "εβδομάδα" : "μήνα";
        return `<li><b>${escapeHtml(s.name)}</b> — ${when}, μετά ${fmt(myShare(s))} ανά ${cycle}. Ακύρωσε αν δεν το θες.</li>`;
      }).join("")}</ul>
    </div>
  </div>`;
}

export async function render(view) {
  const pinList = prefs().pins || [];
  const [subs, todoItems, evItems, finItems, noteItems, courseItems] = await Promise.all([
    subscriptions.list(), todos.list(), events.list(), finance.list().catch(() => []),
    pinList.some(p => p.kind === "note") ? notes.list().catch(() => []) : [],
    pinList.some(p => p.kind === "course") ? courses.list().catch(() => []) : []
  ]);

  const m = buildModel({ subs, todoItems, evItems, finItems, noteItems, courseItems });
  setMood(m.mood);

  const layout = getLayout().filter(x => x.on);
  const active = layout.map(x => CARDS[x.id]).filter(Boolean);

  view.innerHTML = `<div class="page-head"><h1>${escapeHtml(greeting())}</h1></div>
    ${trialAlert(m)}
    ${active.map(c => c.html(m)).join("")}`;

  // Ένας μόνο χειριστής πατήματος για όλη τη σελίδα: το #view δεν αντικαθίσταται
  // μεταξύ renders, οπότε addEventListener θα στοίβαζε αντίγραφα σε κάθε επανασχεδίαση.
  const clickers = active.filter(c => c.click);
  view.onclick = async e => {
    for (const c of clickers) if (await c.click(e, m) === true) return;
  };

  for (const c of active) c.bind?.(view, m);
  bindDrills(view, drillMap(m));
}
