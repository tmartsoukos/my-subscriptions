// Όλοι οι υπολογισμοί της αρχικής σε ένα σημείο. Καθαρή συνάρτηση: παίρνει τα δεδομένα,
// επιστρέφει το μοντέλο που διαβάζουν οι κάρτες. Καμία κάρτα δεν ξαναϋπολογίζει τα ίδια.
import {
  fmt, isoLocal, today, daysUntil, nextDue, monthlyCost,
  isInTrial, trialDaysLeft, myShare, unpaidMembers, CATEGORIES
} from "../../ui.js";
import { CATEGORY_COLORS } from "../../charts.js";
import { prefs, getLayout } from "../../prefs.js";

const clamp = v => Math.max(-1, Math.min(1, v));

export function buildModel({ subs, todoItems, evItems, finItems, noteItems, courseItems }) {
  const t = today();
  const todayIso = isoLocal(t);

  // ---- Οικονομικά τρέχοντος μήνα ----
  const monthStart = isoLocal(new Date(t.getFullYear(), t.getMonth(), 1));
  const monthEntries = finItems.filter(e => e.entry_date >= monthStart);
  const monthIn = monthEntries.filter(e => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const monthOut = monthEntries.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);

  // ---- Προηγούμενος μήνας, για τη σύγκριση του κύριου αριθμού ----
  // Και στους δύο μήνες αφαιρείται το ίδιο κόστος συνδρομών, οπότε η διαφορά
  // εκφράζει καθαρά το τι μπήκε και τι βγήκε.
  const prevFrom = isoLocal(new Date(t.getFullYear(), t.getMonth() - 1, 1));
  const prevTo = isoLocal(new Date(t.getFullYear(), t.getMonth(), 0));
  const prevEntries = finItems.filter(e => e.entry_date >= prevFrom && e.entry_date <= prevTo);
  const prevIn = prevEntries.filter(e => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const prevOut = prevEntries.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);

  const trials = subs.filter(isInTrial);
  const active = subs.filter(s => !isInTrial(s));
  const monthly = active.reduce((s, x) => s + monthlyCost(x), 0);
  const pendingTodos = todoItems.filter(x => !x.done);

  // ---- Οφειλές ανά πρόσωπο (μοιρασμένες συνδρομές που δεν πληρώθηκαν) ----
  const debts = {};
  for (const s of subs) {
    for (const m of unpaidMembers(s)) debts[m.name] = (debts[m.name] || 0) + myShare(s);
  }
  const debtList = Object.entries(debts).sort((a, b) => b[1] - a[1]);
  const owedTotal = debtList.reduce((sum, [, v]) => sum + v, 0);
  const subsOf = name => subs.filter(s => unpaidMembers(s).some(m => m.name === name));

  // ---- Δοκιμές που λήγουν σύντομα — η πιο επείγουσα πληροφορία ----
  const endingTrials = trials.filter(s => trialDaysLeft(s) <= 7)
    .sort((a, b) => trialDaysLeft(a) - trialDaysLeft(b));

  const in7 = isoLocal(new Date(t.getTime() + 7 * 86400000));
  const weekEvents = evItems.filter(e => e.event_date >= todayIso && e.event_date <= in7);

  const sortedSubs = [...subs].sort((a, b) => nextDue(a) - nextDue(b));
  const upcoming = sortedSubs.filter(s => daysUntil(nextDue(s)) <= 30).slice(0, 5);
  const next = sortedSubs[0];

  // ---- Donut ανά κατηγορία (χωρίς τις δοκιμές — δεν κοστίζουν ακόμα) ----
  const byCat = {};
  for (const s of active) byCat[s.category] = (byCat[s.category] || 0) + monthlyCost(s);
  const donutItems = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, v]) => ({ label: CATEGORIES[cat] || "Άλλο", value: v, color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other }));

  const urgentTodos = pendingTodos
    .filter(x => x.due_date && x.due_date <= todayIso || x.priority === 1)
    .slice(0, 4);

  // ---- Στόχοι: πρόοδος με βάση τα πραγματικά δεδομένα του μήνα ----
  const doneThisWeek = todoItems.filter(x => x.done).length;
  const goalRows = (prefs().goals || []).map(g => {
    const current =
      g.metric === "subs_monthly" ? monthly :
      g.metric === "expense_monthly" ? monthOut + monthly :
      g.metric === "save_monthly" ? Math.max(monthIn - monthOut - monthly, 0) :
      doneThisWeek;
    const target = Number(g.target);
    const pct = target > 0 ? Math.min(current / target * 100, 100) : 0;
    // Σε όρια δαπάνης θέλουμε να μένουμε κάτω· σε αποταμίευση/εργασίες να φτάνουμε πάνω
    const isCap = g.metric === "subs_monthly" || g.metric === "expense_monthly";
    const good = isCap ? current <= target : current >= target;
    const fmtVal = v => g.metric === "tasks_weekly" ? String(Math.round(v)) : fmt(v);
    return { g, pct, good, isCap, current, target, fmtVal };
  });

  // ---- Ζωντανό φως: γέρνει προς πράσινο όσο είσαι άνετα, προς κεχριμπάρι στα όρια.
  // Μετράει ο χειρότερος στόχος· χωρίς στόχους, το υπόλοιπο του μήνα.
  const moods = goalRows.filter(r => r.target > 0).map(({ isCap, current, target }) => {
    const ratio = current / target;
    return isCap ? clamp((0.8 - ratio) / 0.4) : clamp((ratio - 0.5) / 0.5);
  });
  const balance = monthIn - monthOut - monthly;
  const mood = moods.length ? Math.min(...moods)
    : (finItems.length && monthIn > 0 ? clamp((balance / monthIn - 0.15) / 0.35) : 0);

  const daysLeft = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate() - t.getDate();

  return {
    // ακατέργαστα
    subs, todoItems, evItems, finItems, noteItems, courseItems,
    // παράγωγα
    todayIso, monthEntries, monthIn, monthOut, prevEntries, prevIn, prevOut,
    trials, active, monthly, pendingTodos, urgentTodos,
    debtList, owedTotal, subsOf, endingTrials, weekEvents,
    sortedSubs, upcoming, next, donutItems, goalRows, mood,
    balance, prevBalance: prevIn - prevOut - monthly,
    daysLeft, hasFinance: finItems.length > 0,
    heroOn: getLayout().some(x => x.id === "hero" && x.on),
    pins: prefs().pins || []
  };
}
