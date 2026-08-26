// Τι δείχνει κάθε αριθμός όταν τον πατήσεις. Ένα σημείο για όλες τις αναλύσεις.
import {
  fmt, fmtDateShort, daysUntil, nextDue, monthlyCost,
  isInTrial, trialDaysLeft, members, myShare, CYCLES
} from "../../ui.js";

export function drillMap(m) {
  const whenText = iso => {
    const n = daysUntil(new Date(iso + "T00:00:00"));
    return n < 0 ? "εκπρόθεσμη" : n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`;
  };
  const countLabel = n => `${n} ${n === 1 ? "εγγραφή" : "εγγραφές"}`;

  return {
    monthly: () => ({
      title: "Μηνιαίο κόστος",
      total: fmt(m.monthly), totalLabel: "Σύνολο ανά μήνα",
      rows: [...m.active]
        .sort((a, b) => monthlyCost(b) - monthlyCost(a))
        .map(s => ({
          label: s.name, color: s.color,
          meta: `${fmt(myShare(s))} ανά ${CYCLES[s.cycle]}${members(s).length ? ` · μερίδιο 1/${1 + members(s).length}` : ""}`,
          value: fmt(monthlyCost(s))
        })),
      note: "Οι εβδομαδιαίες και οι ετήσιες συνδρομές είναι ανηγμένες σε μήνα. Οι δοκιμές δεν μετράνε ακόμα."
    }),
    next: () => ({
      title: "Επόμενες πληρωμές",
      rows: m.sortedSubs.slice(0, 10).map(s => {
        const d = nextDue(s), n = daysUntil(d);
        return {
          label: s.name, color: s.color,
          meta: `${fmtDateShort(d)} · ${n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`}${isInTrial(s) ? " · λήξη δοκιμής" : ""}`,
          value: fmt(myShare(s))
        };
      })
    }),
    todos: () => ({
      title: "Εκκρεμείς εργασίες",
      total: String(m.pendingTodos.length), totalLabel: "Σύνολο",
      rows: [...m.pendingTodos]
        .sort((a, b) => a.priority - b.priority || (a.due_date || "9999").localeCompare(b.due_date || "9999"))
        .slice(0, 15)
        .map(t => ({
          label: t.title,
          meta: t.due_date ? whenText(t.due_date) : "χωρίς προθεσμία",
          value: t.priority === 1 ? "επείγον" : "",
          cls: t.due_date && t.due_date < m.todayIso ? "amount-out" : ""
        }))
    }),
    events: () => ({
      title: "Υποχρεώσεις 7 ημερών",
      rows: m.weekEvents.map(e => ({
        label: e.title, color: e.color,
        meta: `${fmtDateShort(new Date(e.event_date + "T00:00:00"))}${e.event_time ? " · " + e.event_time.slice(0, 5) : ""}`,
        value: whenText(e.event_date)
      }))
    }),
    owed: () => ({
      title: "Μου χρωστάνε",
      total: fmt(m.owedTotal), totalLabel: "Σύνολο",
      rows: m.debtList.map(([name, amount]) => ({
        label: name,
        meta: m.subsOf(name).map(s => s.name).join(", "),
        value: fmt(amount)
      }))
    }),
    trials: () => ({
      title: "Δωρεάν δοκιμές",
      rows: [...m.trials].sort((a, b) => trialDaysLeft(a) - trialDaysLeft(b)).map(s => {
        const n = trialDaysLeft(s);
        return {
          label: s.name, color: s.color,
          meta: `λήγει ${n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} ημέρες`} · μετά ${fmt(myShare(s))} ανά ${CYCLES[s.cycle]}`,
          value: fmt(monthlyCost(s)) + "/μήνα"
        };
      }),
      note: "Δεν προσμετρώνται στο μηνιαίο κόστος όσο διαρκεί η δοκιμή."
    }),
    balance: () => ({
      title: "Υπόλοιπο μήνα",
      total: fmt(m.balance), totalLabel: "Απομένουν",
      rows: [
        { label: "Έσοδα", value: "+" + fmt(m.monthIn), cls: "amount-in",
          meta: countLabel(m.monthEntries.filter(e => e.kind === "income").length) },
        { label: "Έξοδα", value: "−" + fmt(m.monthOut), cls: "amount-out",
          meta: countLabel(m.monthEntries.filter(e => e.kind === "expense").length) },
        { label: "Συνδρομές", value: "−" + fmt(m.monthly), cls: "amount-out",
          meta: `${m.active.length} ενεργές` }
      ],
      note: "Από την 1η του μήνα μέχρι σήμερα."
    })
  };
}
