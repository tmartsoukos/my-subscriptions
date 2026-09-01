// Ποιος μου χρωστάει, με υπενθύμιση ανά άτομο ή σε όλους μαζί,
// και εξόφληση με μία κίνηση: σημειώνεται πληρωμένο και μπαίνει το έσοδο.
import {
  escapeHtml, fmt, fmtDate, nextDue, myShare, icons, haptic, toast,
  sendReminder, sendGroupReminder, openModal, isoLocal, today, members
} from "../../../ui.js";
import { subscriptions, finance } from "../../../db.js";
import { defaultAccountId } from "../../../prefs.js";
import { render as renderRoute } from "../../../router.js";

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
          <button class="icon-btn subtle" data-settle="${escapeHtml(name)}"
            aria-label="Εξόφληση από ${escapeHtml(name)}">${icons.check}</button>
          <button class="icon-btn subtle" data-remind-person="${escapeHtml(name)}"
            aria-label="Υπενθύμιση σε ${escapeHtml(name)}">${icons.send}</button>
        </div>`).join("")}
    </div>
    <p class="hint" style="margin-top:10px">Το ✓ σημειώνει ότι πληρώθηκε και καταχωρεί το έσοδο με μία κίνηση.</p>
  </div>`;
}

// Πληρώθηκε: σημειώνουμε όλες τις συνδρομές του ατόμου και γράφουμε ένα έσοδο.
// Οι δύο ενέργειες ήταν πάντα η ίδια πράξη — τις κάνουμε μαζί.
function askSettle(name, m) {
  const owed = m.debtList.find(([n]) => n === name)?.[1] || 0;
  const list = m.subsOf(name);
  openModal({
    title: `Εξόφληση — ${name}`,
    saveLabel: "Πληρώθηκε",
    body: `<p class="confirm-text">Ο/Η ${escapeHtml(name)} πλήρωσε ${fmt(owed)} για
      ${escapeHtml(list.map(s => s.name).join(", "))}.</p>
      <p class="hint">Θα σημειωθούν ως πληρωμένες για τον τρέχοντα κύκλο και θα καταχωρηθεί
      έσοδο ${fmt(owed)} στην κατηγορία «Εξόφληση οφειλής».</p>`,
    onSave: async () => {
      haptic("ok");
      for (const s of list) {
        const cycleIso = isoLocal(nextDue(s));
        const mem = members(s).map(mm => mm.name === name ? { ...mm, paid_for: cycleIso } : mm);
        await subscriptions.update(s.id, { members: mem });
      }
      try {
        await finance.insert({
          kind: "income", amount: owed, category: "settle",
          note: `Εξόφληση — ${name}`, entry_date: isoLocal(today()),
          account_id: defaultAccountId()
        });
        toast(`${name}: εξοφλήθηκε και καταχωρήθηκε ${fmt(owed)}`);
      } catch {
        // Το χρέος έκλεισε ούτως ή άλλως· μόνο το έσοδο δεν γράφτηκε
        toast("Σημειώθηκε ως πληρωμένο, αλλά το έσοδο δεν καταχωρήθηκε", "error");
      }
      await renderRoute();
    }
  });
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
  const settleBtn = e.target.closest("[data-settle]");
  if (settleBtn) {
    e.preventDefault();
    haptic("tap");
    askSettle(settleBtn.dataset.settle, m);
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
