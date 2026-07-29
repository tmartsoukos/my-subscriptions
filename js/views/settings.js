import { getOrCreateIcsToken, regenerateIcsToken, migrateLocalData, sb } from "../db.js";
import { FUNCTIONS_URL } from "../config.js";
import { icons, toast, confirmModal } from "../ui.js";

export async function render(view) {
  const { data: { user } } = await sb.auth.getUser();

  view.innerHTML = `
    <div class="page-head"><h1>Ρυθμίσεις</h1></div>

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
