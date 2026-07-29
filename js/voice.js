// Φωνητική καταχώριση με το Web Speech API (ελληνικά) + αναγνώριση ημερομηνίας από τη φράση.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = () => !!SR;

// Ξεκινά υπαγόρευση. Επιστρέφει συνάρτηση διακοπής.
export function startDictation({ onInterim, onFinal, onError, onEnd }) {
  const rec = new SR();
  rec.lang = "el-GR";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = "";
  rec.onresult = e => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim && onInterim) onInterim(interim);
  };
  rec.onerror = e => onError?.(e.error === "not-allowed"
    ? "Δεν δόθηκε άδεια για το μικρόφωνο."
    : "Δεν κατάλαβα — δοκίμασε ξανά.");
  rec.onend = () => {
    if (finalText.trim()) onFinal?.(finalText.trim());
    onEnd?.();
  };
  rec.start();
  return () => rec.stop();
}

// ---- Αναγνώριση ημερομηνίας και προτεραιότητας από ελληνική φράση ----
const WEEKDAYS = {
  "δευτέρα": 1, "δευτερα": 1, "τρίτη": 2, "τριτη": 2, "τετάρτη": 3, "τεταρτη": 3,
  "πέμπτη": 4, "πεμπτη": 4, "παρασκευή": 5, "παρασκευη": 5,
  "σάββατο": 6, "σαββατο": 6, "κυριακή": 0, "κυριακη": 0
};
const MONTHS = {
  "ιανουαρίου": 0, "ιανουαριου": 0, "φεβρουαρίου": 1, "φεβρουαριου": 1,
  "μαρτίου": 2, "μαρτιου": 2, "απριλίου": 3, "απριλιου": 3, "μαΐου": 4, "μαιου": 4,
  "ιουνίου": 5, "ιουνιου": 5, "ιουλίου": 6, "ιουλιου": 6, "αυγούστου": 7, "αυγουστου": 7,
  "σεπτεμβρίου": 8, "σεπτεμβριου": 8, "οκτωβρίου": 9, "οκτωβριου": 9,
  "νοεμβρίου": 10, "νοεμβριου": 10, "δεκεμβρίου": 11, "δεκεμβριου": 11
};

function iso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayLocal() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function plusDays(n) { const d = todayLocal(); d.setDate(d.getDate() + n); return d; }

// Επιστρέφει { title, due_date, priority } αφαιρώντας τις φράσεις που καταναλώθηκαν
export function parseGreekTask(text) {
  let rest = " " + text.trim() + " ";
  const low = () => rest.toLowerCase();
  let due = null, priority = null;

  const consume = re => {
    const m = low().match(re);
    if (!m) return null;
    rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
    return m;
  };

  // Προτεραιότητα
  if (consume(/\s(επεῖγον|επείγον|επειγον|σημαντικό|σημαντικο)\s/)) priority = 1;
  else if (consume(/\s(χαμηλή προτεραιότητα|χαμηλη προτεραιοτητα|κάποια στιγμή|καποια στιγμη)\s/)) priority = 3;

  // Σχετικές ημερομηνίες
  if (consume(/\s(σήμερα|σημερα)\s/)) due = todayLocal();
  else if (consume(/\s(μεθαύριο|μεθαυριο)\s/)) due = plusDays(2);
  else if (consume(/\s(αύριο|αυριο)\s/)) due = plusDays(1);
  else {
    const inDays = consume(/\sσε (\d{1,2}) (μέρες|μερες|ημέρες|ημερες)\s/);
    if (inDays) due = plusDays(parseInt(inDays[1]));
  }

  // «την επόμενη εβδομάδα»
  if (!due && consume(/\s(την )?(επόμενη|επομενη) (εβδομάδα|εβδομαδα)\s/)) due = plusDays(7);

  // Ημέρα εβδομάδας: «τη Δευτέρα», «την Παρασκευή»
  if (!due) {
    const names = Object.keys(WEEKDAYS).join("|");
    const m = consume(new RegExp(`\\s(την |τη |το )?(${names})\\s`));
    if (m) {
      const target = WEEKDAYS[m[2]];
      const d = todayLocal();
      let diff = (target - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7; // «τη Δευτέρα» σημαίνει την επόμενη Δευτέρα
      d.setDate(d.getDate() + diff);
      due = d;
    }
  }

  // «στις 5 Αυγούστου»
  if (!due) {
    const names = Object.keys(MONTHS).join("|");
    const m = consume(new RegExp(`\\s(στις |την )?(\\d{1,2}) (${names})\\s`));
    if (m) {
      const day = parseInt(m[2]), month = MONTHS[m[3]];
      const now = todayLocal();
      let year = now.getFullYear();
      const d = new Date(year, month, day);
      if (d < now) d.setFullYear(year + 1);
      due = d;
    }
  }

  // «στις 5/8» ή «5/8/2026»
  if (!due) {
    const m = consume(/\s(στις )?(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?\s/);
    if (m) {
      const day = parseInt(m[2]), month = parseInt(m[3]) - 1;
      let year = m[5] ? parseInt(m[5]) : todayLocal().getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!m[5] && d < todayLocal()) d.setFullYear(year + 1);
      due = d;
    }
  }

  // Καθάρισμα υπολειμμάτων
  let title = rest.replace(/\s+/g, " ").trim()
    .replace(/^(να |θέλω να |θελω να |πρέπει να |πρεπει να )/i, "")
    .replace(/[.,·]+$/, "")
    .trim();
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, due_date: due ? iso(due) : null, priority };
}
