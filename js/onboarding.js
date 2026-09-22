// Πρώτη επαφή.
//
// Μέχρι τώρα ο καινούριος χρήστης έβλεπε άδεια επισκόπηση με εννιά κενές κάρτες
// και δεκατρείς καρτέλες, χωρίς καμία ένδειξη από πού αρχίζει. Αυτό το κενό
// αποφασίζει αν θα ξαναμπεί.
//
// Τέσσερα βήματα, όλα παραλείψιμα: όνομα, τι θέλει να παρακολουθεί, πρώτος
// λογαριασμός (μόνο αν διάλεξε οικονομικά), τέλος. Ό,τι διαλέξει ρυθμίζει την
// κάτω μπάρα και την αρχική σελίδα — δεν είναι διακοσμητικές ερωτήσεις.
import { icons, toast, haptic, escapeHtml } from "./ui.js";
import { setName, setTabs, setStartRoute, SECTIONS } from "./prefs.js";
import { accounts, subscriptions, finance, todos } from "./db.js";
import { ACCOUNT_KINDS } from "./money.js";
import { logError } from "./errors.js";

const KEY = "pref:onboarded";

export const isOnboarded = () => localStorage.getItem(KEY) === "1";
function markOnboarded() {
  try { localStorage.setItem(KEY, "1"); } catch { /* δεν είναι κρίσιμο */ }
}

// Ενότητες που μπορεί να διαλέξει. Η «Αρχική» είναι πάντα μέσα, δεν ρωτιέται.
const CHOICES = ["finance", "subs", "todos", "calendar", "studies", "health", "notes", "watchlist"];

// Τρέχει μόνο σε ολοκαίνουριο λογαριασμό. Αν υπάρχουν ήδη δεδομένα, ο χρήστης
// δεν είναι καινούριος — σημειώνεται ως περασμένος και δεν ενοχλείται ποτέ.
export async function maybeOnboard() {
  if (isOnboarded()) return false;
  try {
    const [subs, fin, tds] = await Promise.all([
      subscriptions.list().catch(() => []),
      finance.list().catch(() => []),
      todos.list().catch(() => [])
    ]);
    if (subs.length || fin.length || tds.length) { markOnboarded(); return false; }
  } catch (e) {
    logError("onboarding.check", e);
    return false;                        // με σπασμένο δίκτυο δεν μπλοκάρουμε την είσοδο
  }
  return new Promise(resolve => runOnboarding(resolve));
}

function runOnboarding(done) {
  const picked = new Set(["finance"]);
  let step = 0;
  let name = "";

  const root = document.createElement("div");
  root.className = "onb";
  root.innerHTML = `<div class="onb-card" role="dialog" aria-modal="true" aria-label="Καλωσόρισμα">
    <div class="onb-dots"></div>
    <div class="onb-body"></div>
    <div class="onb-foot">
      <button type="button" class="btn btn-ghost onb-skip">Παράλειψη</button>
      <button type="button" class="btn btn-primary onb-next">Συνέχεια</button>
    </div>
  </div>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add("show"));

  const body = root.querySelector(".onb-body");
  const dots = root.querySelector(".onb-dots");
  const nextBtn = root.querySelector(".onb-next");
  const skipBtn = root.querySelector(".onb-skip");

  const steps = [
    // 0 — καλωσόρισμα και όνομα
    () => `
      <div class="onb-mark">${icons.wallet}</div>
      <h2>Καλώς ήρθες</h2>
      <p>Συνδρομές, έξοδα, εργασίες και υποχρεώσεις σε ένα μέρος. Τρεις ερωτήσεις
      και είσαι μέσα — μπορείς να τα αλλάξεις όλα αργότερα από τις Ρυθμίσεις.</p>
      <div class="field">
        <label for="onbName">Πώς να σε λέω;</label>
        <input type="text" id="onbName" placeholder="Το όνομά σου" value="${escapeHtml(name)}" autocomplete="given-name">
      </div>`,

    // 1 — τι παρακολουθεί
    () => `
      <h2>Τι θέλεις να παρακολουθείς;</h2>
      <p>Διάλεξε ό,τι σε αφορά. Αυτά μπαίνουν στην κάτω μπάρα — τα υπόλοιπα
      μένουν διαθέσιμα κάτω από το «Περισσότερα».</p>
      <div class="onb-chips">
        ${CHOICES.map(id => `<button type="button" class="onb-chip ${picked.has(id) ? "on" : ""}" data-pick="${id}">
          ${icons[SECTIONS[id].icon] || ""}<span>${SECTIONS[id].label}</span></button>`).join("")}
      </div>`,

    // 2 — πρώτος λογαριασμός (μόνο αν παρακολουθεί οικονομικά)
    () => `
      <h2>Πού βρίσκονται τα λεφτά σου;</h2>
      <p>Ένας λογαριασμός φτάνει για αρχή — μετρητά, κάρτα ή τράπεζα. Το αρχικό
      υπόλοιπο είναι όσα έχεις εκεί σήμερα· από κει και πέρα το ενημερώνουν οι
      κινήσεις σου.</p>
      <div class="field">
        <label for="onbAcct">Όνομα</label>
        <input type="text" id="onbAcct" placeholder="π.χ. Πειραιώς, Μετρητά" value="Μετρητά">
      </div>
      <div class="row2">
        <div class="field">
          <label for="onbKind">Τύπος</label>
          <select id="onbKind">
            ${Object.entries(ACCOUNT_KINDS).map(([v, l]) =>
              `<option value="${v}" ${v === "cash" ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="onbBalance">Αρχικό υπόλοιπο</label>
          <input type="text" id="onbBalance" inputmode="decimal" placeholder="0" value="">
        </div>
      </div>`,

    // 3 — τέλος
    () => `
      <div class="onb-mark onb-done">${icons.check}</div>
      <h2>Έτοιμο${name ? `, ${escapeHtml(name)}` : ""}</h2>
      <p>Δύο πράγματα που αξίζει να ξέρεις από την αρχή:</p>
      <ul class="onb-list">
        <li><strong>Σύρε μια γραμμή</strong> αριστερά για επεξεργασία, δεξιά για διαγραφή.</li>
        <li><strong>Διπλό πάτημα</strong> σε ποσό ή τίτλο το αλλάζει επί τόπου.</li>
      </ul>
      <p class="hint">Κάθε διαγραφή έχει «Αναίρεση» — μην φοβάσαι να πατήσεις.</p>`
  ];

  // Το βήμα του λογαριασμού παραλείπεται όταν δεν παρακολουθεί οικονομικά
  const visible = () => steps.map((_, i) => i).filter(i => i !== 2 || picked.has("finance"));

  function paint() {
    const order = visible();
    body.innerHTML = steps[order[step]]();
    dots.innerHTML = order.map((_, i) =>
      `<span class="onb-dot ${i === step ? "on" : ""}"></span>`).join("");
    nextBtn.textContent = step === order.length - 1 ? "Ξεκίνα" : "Συνέχεια";
    skipBtn.classList.toggle("hidden", step === order.length - 1);

    body.querySelectorAll("[data-pick]").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.dataset.pick;
      picked.has(id) ? picked.delete(id) : picked.add(id);
      btn.classList.toggle("on", picked.has(id));
      haptic("tap");
    }));
    body.querySelector("#onbName")?.focus();
  }

  function finish() {
    // Οι τρεις πρώτες επιλογές γίνονται κάτω μπάρα· η αρχική και το «Περισσότερα» πάντα μέσα
    const chosen = CHOICES.filter(id => picked.has(id)).slice(0, 3);
    try {
      if (name) setName(name);
      setTabs(["dashboard", ...chosen, "more"]);
      setStartRoute("dashboard");
    } catch (e) {
      logError("onboarding.prefs", e);
    }
    markOnboarded();
    root.classList.remove("show");
    setTimeout(() => root.remove(), 240);
    haptic("ok");
    done(true);
  }

  nextBtn.addEventListener("click", async () => {
    const order = visible();
    const current = order[step];

    if (current === 0) name = body.querySelector("#onbName")?.value.trim() || "";
    if (current === 1 && !picked.size) { toast("Διάλεξε τουλάχιστον ένα", "error"); return; }
    if (current === 2) {
      const acctName = body.querySelector("#onbAcct").value.trim();
      const raw = body.querySelector("#onbBalance").value.trim().replace(",", ".");
      if (acctName) {
        try {
          await accounts.insert({
            name: acctName,
            kind: body.querySelector("#onbKind").value,
            start_balance: Number(raw) || 0
          });
        } catch (e) {
          logError("onboarding.account", e);
          toast("Ο λογαριασμός δεν αποθηκεύτηκε — φτιάξ' τον από τις Ρυθμίσεις", "error");
        }
      }
    }

    haptic("tap");
    if (step === order.length - 1) { finish(); return; }
    step++;
    paint();
  });

  skipBtn.addEventListener("click", () => { markOnboarded(); root.remove(); done(false); });

  paint();
}
