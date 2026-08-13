import { getOrCreateIcsToken, regenerateIcsToken, migrateLocalData, sb } from "../db.js";
import { FUNCTIONS_URL } from "../config.js";
import { icons, toast, confirmModal } from "../ui.js";
import { pushSupported, isIOS, isStandalone, currentSubscription, enablePush, disablePush, getPrefs, savePrefs } from "../push.js";
import { getTheme, setTheme, getDensity, setDensity } from "../theme.js";

const DOW = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

export async function render(view) {
  const { data: { user } } = await sb.auth.getUser();

  view.innerHTML = `
    <div class="page-head"><h1>Ρυθμίσεις</h1></div>

    <div class="settings-block">
      <h3>${icons.bell} Ειδοποιήσεις</h3>
      <p>Υπενθύμιση στο κινητό για χρεώσεις, προθεσμίες και ραντεβού — χωρίς να ανοίξεις την εφαρμογή.
      ${isIOS() && !isStandalone() ? "<strong>Στο iPhone πρόσθεσε πρώτα την εφαρμογή στην αρχική οθόνη.</strong>" : ""}</p>
      <div id="pushBox">
        <button class="btn btn-primary" id="btnPushToggle">Φόρτωση...</button>
      </div>
      <div id="prefsBox" class="prefs-grid hidden">
        <label class="pref">
          <span>Ώρα ειδοποίησης</span>
          <select id="prefHour">${Array.from({ length: 24 }, (_, h) =>
            `<option value="${h}">${String(h).padStart(2, "0")}:00</option>`).join("")}</select>
        </label>
        <label class="pref">
          <span>Πόσο νωρίτερα</span>
          <select id="prefLead">
            ${[0, 1, 2, 3, 5, 7].map(d =>
              `<option value="${d}">${d === 0 ? "Την ίδια μέρα" : d === 1 ? "1 μέρα πριν" : `${d} μέρες πριν`}</option>`).join("")}
          </select>
        </label>
        <label class="pref">
          <span>Εβδομαδιαία σύνοψη</span>
          <select id="prefWeekly">
            <option value="">Καμία</option>
            ${DOW.map((d, i) => `<option value="${i}">${d}</option>`).join("")}
          </select>
        </label>
        <button class="btn btn-ghost" id="btnPushTest">${icons.bell} Δοκιμαστική ειδοποίηση</button>
      </div>
    </div>

    <div class="settings-block">
      <h3>${icons.image} Εμφάνιση</h3>
      <p>Θέμα και πυκνότητα λίστας. Το «σύστημα» ακολουθεί τη ρύθμιση της συσκευής.</p>
      <div class="seg" id="themeSeg" role="group" aria-label="Θέμα">
        ${[["system", "Σύστημα"], ["light", "Φωτεινό"], ["dark", "Σκούρο"]].map(([v, l]) =>
          `<button class="seg-btn" data-theme="${v}">${l}</button>`).join("")}
      </div>
      <div class="seg" id="densitySeg" role="group" aria-label="Πυκνότητα" style="margin-top:10px">
        ${[["comfortable", "Άνετη"], ["compact", "Συμπαγής"]].map(([v, l]) =>
          `<button class="seg-btn" data-density="${v}">${l}</button>`).join("")}
      </div>
    </div>

    <div class="settings-block">
      <h3>${icons.apple} Apple Calendar</h3>
      <p>Πρόσθεσε τη ροή στο iPhone: Ρυθμίσεις → Εφαρμογές → Ημερολόγιο → Λογαριασμοί → Προσθήκη λογαριασμού →
      Άλλο → Προσθήκη συνδρομητικού ημερολογίου, και επικόλλησε το παρακάτω URL.
      Οι πληρωμές και οι υποχρεώσεις σου θα εμφανίζονται αυτόματα στο Ημερολόγιο και θα ανανεώνονται μόνες τους.</p>
      <div class="url-box">
        <input type="text" id="icsUrl" readonly value="Φόρτωση..." aria-label="URL ροής ημερολογίου">
        <button class="btn btn-ghost" id="btnCopy">${icons.copy} Αντιγραφή</button>
      </div>
      <p style="margin-top:12px;margin-bottom:8px">Αν το URL διαρρεύσει, δημιούργησε νέο (το παλιό σταματά να ισχύει):</p>
      <button class="btn btn-ghost" id="btnRegen">${icons.refresh} Νέο URL</button>
    </div>

    <div class="settings-block">
      <h3>${icons.dots} Widget iPhone (Scriptable)</h3>
      <p>Κατέβασε το <strong>Scriptable</strong> από το App Store, φτιάξε νέο script με το περιεχόμενο του
      <code>scriptable/dashboard-widget.js</code> από το repo, και βάλε το token παρακάτω στη γραμμή TOKEN.
      Μετά πρόσθεσε widget Scriptable στην αρχική ή στην οθόνη κλειδώματος.</p>
      <div class="url-box">
        <input type="text" id="widgetToken" readonly value="Φόρτωση..." aria-label="Token για το widget">
        <button class="btn btn-ghost" id="btnCopyToken">${icons.copy} Αντιγραφή</button>
      </div>
    </div>

    <div class="settings-block">
      <h3>${icons.mic} Siri και Συντομεύσεις</h3>
      <p>Φτιάξε Συντόμευση: <em>Λήψη περιεχομένων URL</em> με ένα από τα παρακάτω, μετά
      <em>Λήψη τιμής λεξικού «text»</em> και <em>Εκφώνηση κειμένου</em>. Δώσε της όνομα και φώναξέ τη με τη Siri.</p>
      <div class="url-box" style="margin-bottom:8px">
        <input type="text" id="siriSummary" readonly value="Φόρτωση..." aria-label="URL σύνοψης">
        <button class="btn btn-ghost" data-copy="siriSummary">${icons.copy}</button>
      </div>
      <div class="url-box" style="margin-bottom:8px">
        <input type="text" id="siriToday" readonly value="Φόρτωση..." aria-label="URL για σήμερα">
        <button class="btn btn-ghost" data-copy="siriToday">${icons.copy}</button>
      </div>
      <div class="url-box">
        <input type="text" id="siriAdd" readonly value="Φόρτωση..." aria-label="URL προσθήκης εργασίας">
        <button class="btn btn-ghost" data-copy="siriAdd">${icons.copy}</button>
      </div>
      <p class="hint">Στο τρίτο, αντικατάστησε το <code>ΚΕΙΜΕΝΟ</code> με μεταβλητή «Υπαγορευμένο κείμενο» ώστε να λες
      «Σιρι, νέα εργασία» και να την υπαγορεύεις.</p>
    </div>

    <div class="settings-block">
      <h3>${icons.card} Εισαγωγή παλιών δεδομένων</h3>
      <p>Αν υπάρχουν συνδρομές αποθηκευμένες τοπικά σε αυτόν τον browser (από την παλιά έκδοση), μπορείς να τις εισάγεις στον λογαριασμό σου.</p>
      <button class="btn btn-ghost" id="btnMigrate">Εισαγωγή από τοπική αποθήκευση</button>
    </div>

    <div class="settings-block">
      <h3>${icons.settings} Λογαριασμός</h3>
      <p>Συνδεδεμένος ως: <strong>${user?.email || "—"}</strong></p>
    </div>
  `;

  const urlInput = view.querySelector("#icsUrl");
  const tokenInput = view.querySelector("#widgetToken");
  try {
    const token = await getOrCreateIcsToken();
    urlInput.value = `webcal://${new URL(FUNCTIONS_URL).host}/functions/v1/ics-feed?token=${token}`;
    tokenInput.value = token;
    view.querySelector("#siriSummary").value = `${FUNCTIONS_URL}/assistant?token=${token}&q=summary`;
    view.querySelector("#siriToday").value = `${FUNCTIONS_URL}/assistant?token=${token}&q=today`;
    view.querySelector("#siriAdd").value = `${FUNCTIONS_URL}/assistant?token=${token}&add=task&text=ΚΕΙΜΕΝΟ`;
  } catch (e) {
    urlInput.value = "Σφάλμα φόρτωσης token";
    tokenInput.value = "—";
  }

  // ---- Ειδοποιήσεις ----
  const pushBox = view.querySelector("#pushBox");
  const prefsBox = view.querySelector("#prefsBox");
  const toggleBtn = view.querySelector("#btnPushToggle");

  async function refreshPushUI() {
    if (!pushSupported()) {
      pushBox.innerHTML = `<p class="hint">Αυτός ο browser δεν υποστηρίζει ειδοποιήσεις push.</p>`;
      prefsBox.classList.add("hidden");
      return;
    }
    const sub = await currentSubscription();
    const btn = view.querySelector("#btnPushToggle");
    if (sub) {
      btn.textContent = "Απενεργοποίηση σε αυτή τη συσκευή";
      btn.className = "btn btn-ghost";
      prefsBox.classList.remove("hidden");
      const p = await getPrefs();
      view.querySelector("#prefHour").value = String(p.daily_hour ?? 8);
      view.querySelector("#prefLead").value = String(p.lead_days ?? 2);
      view.querySelector("#prefWeekly").value = p.weekly_dow == null ? "" : String(p.weekly_dow);
    } else {
      btn.textContent = "Ενεργοποίηση ειδοποιήσεων";
      btn.className = "btn btn-primary";
      prefsBox.classList.add("hidden");
    }
  }

  toggleBtn.addEventListener("click", async () => {
    const btn = view.querySelector("#btnPushToggle");
    btn.disabled = true;
    try {
      const sub = await currentSubscription();
      if (sub) { await disablePush(); toast("Οι ειδοποιήσεις απενεργοποιήθηκαν"); }
      else { await enablePush(); toast("Έτοιμο — θα λαμβάνεις υπενθυμίσεις"); }
      await refreshPushUI();
    } catch (e) {
      toast(e.message || "Δεν ήταν δυνατή η ενεργοποίηση", "error");
    } finally {
      const b = view.querySelector("#btnPushToggle");
      if (b) b.disabled = false;
    }
  });

  const savePref = async patch => {
    try { await savePrefs(patch); toast("Αποθηκεύτηκε"); }
    catch (e) { toast(e.message || "Σφάλμα αποθήκευσης", "error"); }
  };
  view.querySelector("#prefHour").addEventListener("change", e => savePref({ daily_hour: +e.target.value }));
  view.querySelector("#prefLead").addEventListener("change", e => savePref({ lead_days: +e.target.value }));
  view.querySelector("#prefWeekly").addEventListener("change", e =>
    savePref({ weekly_dow: e.target.value === "" ? null : +e.target.value }));

  view.querySelector("#btnPushTest").addEventListener("click", async () => {
    try {
      const token = await getOrCreateIcsToken();
      const res = await fetch(`${FUNCTIONS_URL}/notify?token=${token}&mode=test`).then(r => r.json());
      toast(res.sent ? `Στάλθηκε σε ${res.sent} συσκευή/ές` : "Καμία εγγεγραμμένη συσκευή", res.sent ? "ok" : "error");
    } catch (e) {
      toast("Αποτυχία αποστολής", "error");
    }
  });

  refreshPushUI();

  // ---- Εμφάνιση ----
  const markSeg = () => {
    const t = getTheme(), d = getDensity();
    view.querySelectorAll("[data-theme]").forEach(b => b.classList.toggle("active", b.dataset.theme === t));
    view.querySelectorAll("[data-density]").forEach(b => b.classList.toggle("active", b.dataset.density === d));
  };
  view.querySelector("#themeSeg").addEventListener("click", e => {
    const b = e.target.closest("[data-theme]");
    if (b) { setTheme(b.dataset.theme); markSeg(); }
  });
  view.querySelector("#densitySeg").addEventListener("click", e => {
    const b = e.target.closest("[data-density]");
    if (b) { setDensity(b.dataset.density); markSeg(); }
  });
  markSeg();

  view.querySelectorAll("[data-copy]").forEach(btn =>
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(view.querySelector("#" + btn.dataset.copy).value);
      toast("Αντιγράφηκε");
    }));

  view.querySelector("#btnCopyToken").addEventListener("click", async () => {
    await navigator.clipboard.writeText(tokenInput.value);
    toast("Το token αντιγράφηκε");
  });

  view.querySelector("#btnCopy").addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    toast("Το URL αντιγράφηκε");
  });

  view.querySelector("#btnRegen").addEventListener("click", () => {
    confirmModal("Το παλιό URL θα σταματήσει να λειτουργεί και θα χρειαστεί νέα εγγραφή στο Apple Calendar και νέο token στο widget. Συνέχεια;", async () => {
      const token = await regenerateIcsToken();
      urlInput.value = `webcal://${new URL(FUNCTIONS_URL).host}/functions/v1/ics-feed?token=${token}`;
      tokenInput.value = token;
      toast("Δημιουργήθηκε νέο URL");
    });
  });

  view.querySelector("#btnMigrate").addEventListener("click", async () => {
    try {
      const n = await migrateLocalData();
      toast(n > 0 ? `Εισήχθησαν ${n} συνδρομές` : "Δεν βρέθηκαν δεδομένα για εισαγωγή (ή υπάρχουν ήδη συνδρομές)");
    } catch (e) {
      toast(e.message || "Σφάλμα εισαγωγής", "error");
    }
  });
}
