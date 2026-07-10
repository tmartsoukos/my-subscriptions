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
  try {
    const token = await getOrCreateIcsToken();
    urlInput.value = `webcal://${new URL(FUNCTIONS_URL).host}/functions/v1/ics-feed?token=${token}`;
  } catch (e) {
    urlInput.value = "Σφάλμα φόρτωσης token";
  }

  view.querySelector("#btnCopy").addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    toast("Το URL αντιγράφηκε");
  });

  view.querySelector("#btnRegen").addEventListener("click", () => {
    confirmModal("Το παλιό URL θα σταματήσει να λειτουργεί και θα χρειαστεί νέα εγγραφή στο Apple Calendar. Συνέχεια;", async () => {
      const token = await regenerateIcsToken();
      urlInput.value = `webcal://${new URL(FUNCTIONS_URL).host}/functions/v1/ics-feed?token=${token}`;
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
