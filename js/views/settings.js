import { getOrCreateIcsToken, regenerateIcsToken, migrateLocalData, sb } from "../db.js";
import { FUNCTIONS_URL } from "../config.js";
import { icons, toast, confirmModal, openModal, escapeHtml, fmt, haptic } from "../ui.js";
import { pushSupported, isIOS, isStandalone, currentSubscription, enablePush, disablePush, getPrefs, savePrefs } from "../push.js";
import { getTheme, setTheme, getDensity, setDensity } from "../theme.js";
import {
  ACCENTS, getAccent, setAccent, getName, setName, getStartRoute, setStartRoute,
  uploadAvatar, removeAvatar, initials, prefs, loadPrefs, paintAvatar, quickActions, goals, customCategories,
  SECTIONS, getTabs, setTabs, DASH_CARDS, getLayout, setLayout, pins, getDayStart, setDayStart,
  moodEnabled, setMoodEnabled
} from "../prefs.js";

const ROUTES = {
  dashboard: "Επισκόπηση", finance: "Οικονομικά", subs: "Συνδρομές", todos: "Εργασίες",
  calendar: "Ημερολόγιο", notes: "Σημειώσεις", studies: "Σπουδές", health: "Υγεία", watchlist: "Λίστα"
};
const GOAL_METRICS = {
  subs_monthly: "Όριο συνδρομών (€/μήνα)",
  expense_monthly: "Όριο εξόδων (€/μήνα)",
  save_monthly: "Αποταμίευση (€/μήνα)",
  tasks_weekly: "Ολοκληρωμένες εργασίες"
};

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
      <h3>${icons.user} Προφίλ</h3>
      <div class="profile-row">
        <span class="avatar avatar-lg" data-avatar></span>
        <div class="profile-fields">
          <div class="field" style="margin-bottom:8px">
            <label for="fName">Πώς σε λένε</label>
            <input type="text" id="fName" placeholder="π.χ. Θέμης" value="${escapeHtml(getName())}">
          </div>
          <div class="profile-actions">
            <label class="btn btn-ghost btn-sm" for="avatarInput">${icons.image} Φωτογραφία
              <input type="file" id="avatarInput" accept="image/*" hidden>
            </label>
            <button class="btn btn-ghost btn-sm" id="btnAvatarClear">${icons.x} Αφαίρεση</button>
          </div>
        </div>
      </div>
      <p class="hint">Ο χαιρετισμός στην αρχική αλλάζει ανάλογα με την ώρα.</p>

      <div class="field" style="margin-top:14px">
        <label for="fStart">Αρχική σελίδα</label>
        <select id="fStart">
          ${Object.entries(ROUTES).map(([v, l]) =>
            `<option value="${v}" ${getStartRoute() === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="settings-block">
      <h3>${icons.image} Εμφάνιση</h3>
      <p>Χρώμα τόνου:</p>
      <div class="accents" id="accentRow">
        ${Object.entries(ACCENTS).map(([k, a]) =>
          `<button class="accent-dot ${getAccent() === k ? "active" : ""}" data-accent="${k}"
            style="background:linear-gradient(135deg, ${a.c1}, ${a.c2})" title="${a.label}" aria-label="${a.label}"></button>`).join("")}
      </div>
      <label class="check-row" style="margin-top:10px">
        <input type="checkbox" id="fMood" ${moodEnabled() ? "checked" : ""}>
        <span>Ζωντανό φως — το φόντο δροσίζει όταν είσαι εντός στόχων και ζεσταίνει όταν πλησιάζεις τα όρια</span>
      </label>

      <p>Θέμα και πυκνότητα λίστας. Το «σύστημα» ακολουθεί τη ρύθμιση της συσκευής.</p>
      <div class="seg" id="themeSeg" role="group" aria-label="Θέμα">
        ${[["system", "Σύστημα"], ["light", "Φωτεινό"], ["dark", "Σκούρο"]].map(([v, l]) =>
          `<button class="seg-btn" data-theme="${v}">${l}</button>`).join("")}
      </div>
      <div class="seg" id="densitySeg" role="group" aria-label="Πυκνότητα" style="margin-top:10px">
        ${[["comfortable", "Άνετη"], ["compact", "Συμπαγής"]].map(([v, l]) =>
          `<button class="seg-btn" data-density="${v}">${l}</button>`).join("")}
      </div>

      <div class="field" style="margin-top:14px">
        <label for="fDayStart">Η μέρα αρχίζει στις</label>
        <select id="fDayStart">
          ${[0, 3, 4, 5, 6].map(h =>
            `<option value="${h}" ${getDayStart() === h ? "selected" : ""}>${
              h === 0 ? "00:00 — τα μεσάνυχτα" : String(h).padStart(2, "0") + ":00"}</option>`).join("")}
        </select>
      </div>
      <p class="hint">Αν ξενυχτάς: με όριο 04:00, ένα έξοδο που καταχωρείς στη 1:30 π.μ. μετράει στη χθεσινή μέρα.</p>
    </div>

    <div class="settings-block">
      <h3>${icons.dots} Κάτω μπάρα</h3>
      <p>Διάλεξε έως πέντε ενότητες για το κινητό. Οι υπόλοιπες πάνε στο «Περισσότερα».</p>
      <div class="pick-grid" id="tabsPicker">
        ${Object.entries(SECTIONS).map(([id, sec]) =>
          `<button class="pick ${getTabs().includes(id) ? "on" : ""}" data-tab="${id}">
            <span class="pick-ico">${icons[sec.icon]}</span>${sec.label}
          </button>`).join("")}
      </div>
      <p class="hint" id="tabsHint"></p>
    </div>

    <div class="settings-block">
      <h3>${icons.home} Διάταξη αρχικής</h3>
      <p>Ποιες κάρτες βλέπεις και με ποια σειρά.</p>
      <div class="mini-list" id="layoutList"></div>
    </div>

    <div class="settings-block">
      <h3>${icons.wallet} Γρήγορες ενέργειες</h3>
      <p>Κουμπιά ενός πατήματος στα Οικονομικά — π.χ. «καφές 3€».</p>
      <div class="mini-list" id="quickList"></div>
      <button class="btn btn-ghost btn-sm" id="btnAddQuick">${icons.plus} Νέα ενέργεια</button>
    </div>

    <div class="settings-block">
      <h3>${icons.chart} Στόχοι</h3>
      <p>Εμφανίζονται με μπάρα προόδου στην αρχική.</p>
      <div class="mini-list" id="goalList"></div>
      <button class="btn btn-ghost btn-sm" id="btnAddGoal">${icons.plus} Νέος στόχος</button>
    </div>

    <div class="settings-block">
      <h3>${icons.bookmark} Δικές μου κατηγορίες</h3>
      <p>Προστίθενται στις προεπιλεγμένες, σε έξοδα και συνδρομές.</p>
      <div class="mini-list" id="catList"></div>
      <button class="btn btn-ghost btn-sm" id="btnAddCat">${icons.plus} Νέα κατηγορία</button>
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


  // ---- Προφίλ ----
  const nameInput = view.querySelector("#fName");
  let nameTimer = null;
  nameInput.addEventListener("input", () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => { setName(nameInput.value.trim()); paintAvatar(); }, 500);
  });
  view.querySelector("#avatarInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { await uploadAvatar(file); toast("Η φωτογραφία ενημερώθηκε"); }
    catch (err) { toast(err.message || "Αποτυχία ανεβάσματος", "error"); }
  });
  view.querySelector("#btnAvatarClear").addEventListener("click", async () => {
    await removeAvatar();
    toast("Η φωτογραφία αφαιρέθηκε");
  });
  view.querySelector("#fStart").addEventListener("change", e => {
    setStartRoute(e.target.value);
    toast("Η αρχική σελίδα αποθηκεύτηκε");
  });
  view.querySelector("#fMood").addEventListener("change", e => {
    setMoodEnabled(e.target.checked);
    toast(e.target.checked ? "Το φως ακολουθεί τους στόχους σου" : "Σταθερό φόντο");
  });
  view.querySelector("#fDayStart").addEventListener("change", e => {
    setDayStart(Number(e.target.value));
    toast(Number(e.target.value) === 0 ? "Η μέρα αλλάζει τα μεσάνυχτα" : `Η μέρα αλλάζει στις ${e.target.value}:00`);
  });

  // ---- Χρώμα τόνου ----
  view.querySelector("#accentRow").addEventListener("click", e => {
    const b = e.target.closest("[data-accent]");
    if (!b) return;
    setAccent(b.dataset.accent);
    view.querySelectorAll("[data-accent]").forEach(x => x.classList.toggle("active", x === b));
    haptic("tap");
  });


  // ---- Κάτω μπάρα ----
  const tabsHint = view.querySelector("#tabsHint");
  const updateTabsHint = () => {
    const n = getTabs().length;
    tabsHint.textContent = `${n} από 5 επιλεγμένες${n < 2 ? " — διάλεξε τουλάχιστον δύο" : ""}`;
  };
  updateTabsHint();
  view.querySelector("#tabsPicker").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    const id = b.dataset.tab;
    let tabs = [...getTabs()];
    if (tabs.includes(id)) {
      if (tabs.length <= 2) { toast("Χρειάζονται τουλάχιστον δύο.", "error"); return; }
      tabs = tabs.filter(x => x !== id);
    } else {
      if (tabs.length >= 5) { toast("Μέχρι πέντε — βγάλε πρώτα κάποια.", "error"); return; }
      tabs.push(id);
    }
    setTabs(tabs);
    b.classList.toggle("on");
    updateTabsHint();
    haptic("tap");
  });

  // ---- Διάταξη αρχικής ----
  const drawLayout = () => {
    const layout = getLayout();
    view.querySelector("#layoutList").innerHTML = layout.map((x, i) => `
      <div class="mini-row layout-row ${x.on ? "" : "off"}">
        <label class="layout-label">
          <input type="checkbox" data-card="${x.id}" ${x.on ? "checked" : ""}>
          <span>${DASH_CARDS[x.id]}</span>
        </label>
        <span class="layout-actions">
          <button class="icon-btn" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Πάνω">${icons.chevronL}</button>
          <button class="icon-btn" data-down="${i}" ${i === layout.length - 1 ? "disabled" : ""} aria-label="Κάτω">${icons.chevronR}</button>
        </span>
      </div>`).join("");
  };
  drawLayout();

  view.querySelector("#layoutList").addEventListener("click", e => {
    const up = e.target.closest("[data-up]");
    const down = e.target.closest("[data-down]");
    if (!up && !down) return;
    const layout = getLayout();
    const i = Number((up || down).dataset.up ?? (up || down).dataset.down);
    const j = up ? i - 1 : i + 1;
    if (j < 0 || j >= layout.length) return;
    [layout[i], layout[j]] = [layout[j], layout[i]];
    setLayout(layout);
    drawLayout();
    haptic("tap");
  });
  view.querySelector("#layoutList").addEventListener("change", e => {
    const box = e.target.closest("[data-card]");
    if (!box) return;
    const layout = getLayout().map(x => x.id === box.dataset.card ? { ...x, on: box.checked } : x);
    setLayout(layout);
    drawLayout();
  });

  // ---- Γρήγορες ενέργειες / στόχοι / κατηγορίες ----
  const drawMini = () => {
    const p = prefs();
    view.querySelector("#quickList").innerHTML = (p.quick || []).length
      ? p.quick.map(q => `<div class="mini-row">
          <span><b>${escapeHtml(q.label)}</b>${q.amount != null ? ` · ${q.kind === "income" ? "+" : "−"}${fmt(q.amount)}` : ""}</span>
          <button class="icon-btn" data-delquick="${q.id}" aria-label="Διαγραφή">${icons.trash}</button>
        </div>`).join("")
      : `<p class="hint">Καμία ακόμα.</p>`;

    view.querySelector("#goalList").innerHTML = (p.goals || []).length
      ? p.goals.map(g => `<div class="mini-row">
          <span><b>${escapeHtml(g.label || GOAL_METRICS[g.metric])}</b> · ${g.metric === "tasks_weekly" ? g.target : fmt(g.target)}</span>
          <button class="icon-btn" data-delgoal="${g.id}" aria-label="Διαγραφή">${icons.trash}</button>
        </div>`).join("")
      : `<p class="hint">Κανένας ακόμα.</p>`;

    view.querySelector("#catList").innerHTML = (p.categories || []).length
      ? p.categories.map(c => `<div class="mini-row">
          <span><i class="cat-dot" style="background:${c.color}"></i><b>${escapeHtml(c.label)}</b> · ${
            c.scope === "subscription" ? "συνδρομές" : c.scope === "income" ? "έσοδα" : "έξοδα"}</span>
          <button class="icon-btn" data-delcat="${c.id}" aria-label="Διαγραφή">${icons.trash}</button>
        </div>`).join("")
      : `<p class="hint">Καμία ακόμα.</p>`;
  };
  drawMini();

  const refresh = async () => { await loadPrefs(); drawMini(); };

  view.querySelector("#btnAddQuick").addEventListener("click", () => {
    openModal({
      title: "Νέα γρήγορη ενέργεια",
      body: `
        <div class="field"><label for="qLabel">Ετικέτα</label>
          <input type="text" id="qLabel" placeholder="π.χ. Καφές"></div>
        <div class="row2">
          <div class="field"><label for="qAmount">Ποσό (€)</label>
            <input type="text" id="qAmount" inputmode="decimal" placeholder="3,00"></div>
          <div class="field"><label for="qKind">Τύπος</label>
            <select id="qKind"><option value="expense">Έξοδο</option><option value="income">Έσοδο</option></select></div>
        </div>`,
      onSave: async ov => {
        const label = ov.querySelector("#qLabel").value.trim();
        const amount = parseFloat(ov.querySelector("#qAmount").value.replace(",", "."));
        if (!label || isNaN(amount)) { toast("Συμπλήρωσε ετικέτα και ποσό.", "error"); return false; }
        await quickActions.insert({ label, amount, kind: ov.querySelector("#qKind").value, sort: (prefs().quick || []).length });
        await refresh();
        toast("Προστέθηκε");
      }
    });
  });

  view.querySelector("#btnAddGoal").addEventListener("click", () => {
    openModal({
      title: "Νέος στόχος",
      body: `
        <div class="field"><label for="gMetric">Τι μετράμε</label>
          <select id="gMetric">${Object.entries(GOAL_METRICS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
        <div class="field"><label for="gTarget">Στόχος</label>
          <input type="text" id="gTarget" inputmode="decimal" placeholder="π.χ. 40"></div>
        <div class="field"><label for="gLabel">Ετικέτα (προαιρετικό)</label>
          <input type="text" id="gLabel" placeholder="π.χ. Λιγότερες συνδρομές"></div>`,
      onSave: async ov => {
        const target = parseFloat(ov.querySelector("#gTarget").value.replace(",", "."));
        if (isNaN(target) || target < 0) { toast("Συμπλήρωσε έγκυρο στόχο.", "error"); return false; }
        await goals.insert({
          metric: ov.querySelector("#gMetric").value, target,
          label: ov.querySelector("#gLabel").value.trim() || null
        });
        await refresh();
        toast("Ο στόχος προστέθηκε");
      }
    });
  });

  view.querySelector("#btnAddCat").addEventListener("click", () => {
    openModal({
      title: "Νέα κατηγορία",
      body: `
        <div class="field"><label for="cLabel">Όνομα</label>
          <input type="text" id="cLabel" placeholder="π.χ. Ταξίδια"></div>
        <div class="row2">
          <div class="field"><label for="cScope">Πού</label>
            <select id="cScope">
              <option value="expense">Έξοδα</option>
              <option value="income">Έσοδα</option>
              <option value="subscription">Συνδρομές</option>
            </select></div>
          <div class="field"><label for="cColor">Χρώμα</label>
            <input type="color" id="cColor" value="#7b8fd6"></div>
        </div>`,
      onSave: async ov => {
        const label = ov.querySelector("#cLabel").value.trim();
        if (!label) { toast("Συμπλήρωσε όνομα.", "error"); return false; }
        const key = "u_" + label.toLowerCase().replace(/\s+/g, "_").slice(0, 20) + "_" + Math.random().toString(36).slice(2, 5);
        await customCategories.insert({
          scope: ov.querySelector("#cScope").value, key, label,
          color: ov.querySelector("#cColor").value
        });
        await refresh();
        toast("Η κατηγορία προστέθηκε");
      }
    });
  });

  view.addEventListener("click", async e => {
    const q = e.target.closest("[data-delquick]");
    const g = e.target.closest("[data-delgoal]");
    const c = e.target.closest("[data-delcat]");
    if (q) { await quickActions.remove(q.dataset.delquick); await refresh(); }
    if (g) { await goals.remove(g.dataset.delgoal); await refresh(); }
    if (c) { await customCategories.remove(c.dataset.delcat); await refresh(); }
  });

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
