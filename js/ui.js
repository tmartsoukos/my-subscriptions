// Βοηθητικά UI: μορφοποίηση, modal, toast, εικονίδια SVG

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

export function fmt(n) {
  return Number(n).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
export function fmtDate(d) {
  return d.toLocaleDateString("el-GR", { day: "numeric", month: "long", year: "numeric" });
}
export function fmtDateShort(d) {
  return d.toLocaleDateString("el-GR", { day: "numeric", month: "short" });
}
// Τοπική ημερομηνία σε YYYY-MM-DD (όχι toISOString — αλλάζει μέρα λόγω UTC)
export function isoLocal(d) {
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
// ---- Πότε αρχίζει η μέρα ----
// Για όποιον ξενυχτάει: με όριο 4 π.μ., μια καταχώριση στη 1:30 π.μ. ανήκει στη χθεσινή μέρα.
const DAY_START_KEY = "pref:daystart";
export function dayStartHour() {
  const h = Number(localStorage.getItem(DAY_START_KEY));
  return Number.isFinite(h) && h > 0 && h < 12 ? Math.floor(h) : 0;
}
export function today() {
  const d = new Date();
  if (d.getHours() < dayStartHour()) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function daysUntil(d) { return Math.round((d - today()) / 86400000); }

// ---- Δωρεάν δοκιμαστική περίοδος ----
// Σε δοκιμή όσο η trial_end δεν έχει περάσει· η trial_end είναι και η πρώτη χρέωση.
export function isInTrial(sub) {
  return !!sub.trial_end && new Date(sub.trial_end + "T00:00:00") >= today();
}
export function trialDaysLeft(sub) {
  return daysUntil(new Date(sub.trial_end + "T00:00:00"));
}

// ---- Μοιρασμένες συνδρομές ----
export function members(sub) {
  return Array.isArray(sub.members) ? sub.members : [];
}
export function shareCount(sub) { return 1 + members(sub).length; }   // εγώ + οι υπόλοιποι
export function isShared(sub) { return shareCount(sub) > 1; }
// Στρογγυλοποίηση στο λεπτό ώστε τα εμφανιζόμενα ποσά να αθροίζονται σωστά
export function myShare(sub) {
  return Math.round((Number(sub.price) / shareCount(sub)) * 100) / 100;
}
// Όσοι δεν έχουν πληρώσει για την τρέχουσα χρέωση
export function unpaidMembers(sub) {
  const cycleIso = isoLocal(nextDue(sub));
  return members(sub).filter(m => m.paid_for !== cycleIso);
}

// Επόμενη χρέωση συνδρομής: κύλιση μπροστά αν πέρασε
export function nextDue(sub) {
  const t = today();
  if (isInTrial(sub)) return new Date(sub.trial_end + "T00:00:00"); // πρώτη χρέωση = λήξη δοκιμής
  let d = new Date(sub.next_date + "T00:00:00");
  while (d < t) {
    if (sub.cycle === "weekly") d.setDate(d.getDate() + 7);
    else if (sub.cycle === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}
// Το δικό μου μηνιαίο κόστος (μερίδιο, ανηγμένο σε μήνα)
export function monthlyCost(sub) {
  const p = myShare(sub);
  if (sub.cycle === "weekly") return p * 52 / 12;
  if (sub.cycle === "yearly") return p / 12;
  return p;
}

export const CYCLES = { weekly: "εβδομάδα", monthly: "μήνα", yearly: "έτος" };
export const CYCLE_LABEL = { weekly: "Εβδομαδιαία", monthly: "Μηνιαία", yearly: "Ετήσια" };
export const CATEGORIES = {
  streaming: "Streaming", music: "Μουσική", software: "Λογισμικό",
  fitness: "Γυμναστήριο", utilities: "Λογαριασμοί", gaming: "Gaming", other: "Άλλο"
};
export const COLORS = ["#e50914","#1db954","#7c6cf6","#3b82f6","#ff9900","#e3b341","#3fb950","#f06292","#00bcd4","#8d6e63"];

// ---- Εικονίδια (Lucide-style inline SVG) ----
const svg = (paths, viewBox = "0 0 24 24") =>
  `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  home: svg('<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>'),
  card: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
  check: svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
  note: svg('<path d="M14 3v5h5"/><path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7Z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
  plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  edit: svg('<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  refresh: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><polyline points="21 3 21 8 16 8"/>'),
  x: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  chevronL: svg('<polyline points="15 18 9 12 15 6"/>'),
  chevronR: svg('<polyline points="9 18 15 12 9 6"/>'),
  chevronUp: svg('<polyline points="18 15 12 9 6 15"/>'),
  bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  wallet: svg('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>'),
  chart: svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  heart: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/>'),
  mic: svg('<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/>'),
  bookmark: svg('<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
  star: svg('<path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z"/>'),
  dots: svg('<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>'),
  external: svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  card2: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
  user: svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  share: svg('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>'),
  send: svg('<path d="M21.5 2.5 2.5 10.2l7.4 2.9 2.9 7.4Z"/><line x1="21.5" y1="2.5" x2="9.9" y2="13.1"/>'),
  chat: svg('<path d="M21 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="12.5" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r=".9" fill="currentColor" stroke="none"/>'),
  apple: svg('<path d="M12 20.94c1.5 0 2.75-.63 3.86-1.89 1.13-1.28 1.64-2.58 1.64-2.63-.03-.01-3.13-1.2-3.13-4.53 0-2.88 2.36-4.16 2.46-4.23-1.35-1.97-3.43-2.02-4-2.02-1.7 0-3.1 1.03-3.9 1.03-.83 0-2.1-1-3.46-.97-1.78.03-3.42 1.03-4.33 2.62-1.85 3.21-.47 7.95 1.33 10.55.88 1.27 1.93 2.7 3.3 2.65 1.32-.05 1.82-.86 3.42-.86 1.59 0 2.04.86 3.43.83Z"/><path d="M15.5 3.5c.73-.88 1.22-2.1 1.08-3.32-1.05.04-2.32.7-3.07 1.58-.68.78-1.27 2.03-1.11 3.22 1.17.09 2.36-.6 3.1-1.48Z"/>')
};

// Μαζεύει τη γραμμή σε ύψος πριν φύγει, ώστε η λίστα να μη «πηδάει»
export function collapseRow(el) {
  if (!el) return Promise.resolve();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  const h = el.getBoundingClientRect().height;
  el.style.height = h + "px";
  el.style.overflow = "hidden";
  void el.offsetHeight;                       // εξαναγκασμός reflow
  el.style.transition = "height var(--dur) var(--ease-out), opacity var(--dur-fast) var(--ease-out), margin var(--dur) var(--ease-out)";
  el.style.height = "0px";
  el.style.opacity = "0";
  el.style.marginBottom = "-" + getComputedStyle(el.parentElement).gap;
  return new Promise(res => setTimeout(res, 220));
}

// ---- Απτική ανάδραση ----
// Υποστηρίζεται σε Android/Chrome. Σε iOS το Safari δεν έχει Vibration API,
// οπότε η κλήση απλώς δεν κάνει τίποτα.
const HAPTIC = { tap: 8, ok: [10, 30, 12], warn: 22 };
export function haptic(kind = "tap") {
  // Η προτίμηση «λιγότερη κίνηση» αφορά την οπτική κίνηση, όχι την απτική ανάδραση
  if (!navigator.vibrate) return;
  navigator.vibrate(HAPTIC[kind] ?? HAPTIC.tap);
}

// ---- Toast ----
export function toast(msg, type = "ok") {
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = "toast toast-" + type;
  el.setAttribute("role", "status");
  el.textContent = msg;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// Toast με κουμπί ενέργειας (π.χ. «Αναίρεση»)
export function toastAction(msg, actionLabel, onAction, ms = 6000) {
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = "toast toast-ok toast-with-action";
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${escapeHtml(msg)}</span><button class="toast-btn">${escapeHtml(actionLabel)}</button>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  const close = () => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  };
  const timer = setTimeout(close, ms);
  el.querySelector(".toast-btn").addEventListener("click", async () => {
    clearTimeout(timer);
    close();
    await onAction();
  });
}

// ---- Κουμπί μικροφώνου για υπαγόρευση σε πεδίο ----
// Χρήση: micButtonHtml("fTitle") μέσα στη φόρμα + bindMicButtons(overlay, onFinal?)
export function micButtonHtml(targetId) {
  return `<button type="button" class="mic-btn" data-mic="${targetId}" aria-label="Υπαγόρευση">${icons.mic}</button>`;
}

// append: true -> η υπαγόρευση προστίθεται στο υπάρχον κείμενο αντί να το αντικαθιστά
export async function bindMicButtons(root, onFinal, { append = false } = {}) {
  const { speechSupported, startDictation } = await import("./voice.js");
  root.querySelectorAll("[data-mic]").forEach(btn => {
    if (!speechSupported()) { btn.remove(); return; }
    let stop = null;
    btn.addEventListener("click", () => {
      const input = root.querySelector("#" + btn.dataset.mic);
      if (stop) { stop(); return; }
      const base = append ? input.value : "";
      const sep = append && base && !base.endsWith("\n") ? "\n" : "";
      const placeholder = input.placeholder;
      btn.classList.add("listening");
      input.placeholder = "Ακούω...";
      stop = startDictation({
        onInterim: txt => { input.value = base + sep + txt; },
        onFinal: txt => {
          input.value = base + sep + txt;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          onFinal?.(txt, input);
        },
        onError: msg => toast(msg, "error"),
        onEnd: () => { btn.classList.remove("listening"); input.placeholder = placeholder; stop = null; }
      });
    });
  });
}

// ---- Χειρονομίες σύρσιμο (μόνο σε οθόνες αφής) ----
// Σύρσιμο αριστερά -> onLeft, δεξιά -> onRight. Δεν εμποδίζει την κάθετη κύλιση
// ούτε τη χειρονομία επιστροφής του iOS (αγνοεί αγγίγματα στα 24px της αριστερής άκρης).
export function bindSwipe(el, { onLeft, onRight }) {
  const THRESHOLD = 72;
  let startX = 0, startY = 0, dx = 0, active = false, decided = false;
  const wrap = el.parentElement;

  el.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (t.clientX < 24) return;
    startX = t.clientX; startY = t.clientY;
    dx = 0; active = true; decided = false;
    el.style.transition = "none";
  }, { passive: true });

  el.addEventListener("touchmove", e => {
    if (!active) return;
    const t = e.touches[0];
    const ddx = t.clientX - startX, ddy = t.clientY - startY;
    if (!decided) {
      if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return;
      if (Math.abs(ddy) >= Math.abs(ddx)) { active = false; return; } // κάθετη κύλιση
      decided = true;
    }
    dx = ddx;
    el.style.transform = `translateX(${dx}px)`;
    wrap.classList.toggle("swiping-left", dx < -20);
    wrap.classList.toggle("swiping-right", dx > 20);
    wrap.classList.toggle("swipe-armed", Math.abs(dx) >= THRESHOLD);
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  const finish = () => {
    if (!active) return;
    active = false;
    el.style.transition = "transform .2s ease-out";
    el.style.transform = "";
    wrap.classList.remove("swiping-left", "swiping-right", "swipe-armed");
    const moved = dx;
    dx = 0;
    if (moved <= -THRESHOLD) { haptic("ok"); onLeft?.(); }
    else if (moved >= THRESHOLD) { haptic("warn"); onRight?.(); }
  };
  el.addEventListener("touchend", finish);
  el.addEventListener("touchcancel", finish);
}

// Σε κινητό το modal είναι φύλλο που ανεβαίνει από κάτω: σύρσιμο προς τα κάτω το κλείνει.
// Η χειρονομία πιάνει μόνο από τη λαβή και την κεφαλίδα, ώστε να μη χαλάει η κύλιση του περιεχομένου.
function bindSheetDrag(overlay, close) {
  if (!window.matchMedia("(max-width: 899px)").matches) return;
  const modal = overlay.querySelector(".modal");
  const grip = overlay.querySelector(".sheet-handle");
  const head = overlay.querySelector(".modal-head");
  const CLOSE_AT = 110;
  const FLING = 0.9;         // px ανά ms προς τα κάτω που αρκούν για κλείσιμο (πραγματικό πέταγμα)
  const OVERSHOOT = 5;       // πόσο επιτρέπεται να περάσει το φύλλο πάνω από τη θέση ισορροπίας
  let startY = 0, dy = 0, dragging = false;
  let lastY = 0, lastT = 0, velocity = 0, raf = 0;

  const scrim = d => `rgba(2, 6, 18, ${Math.max(0.62 - d / 500, 0.2)})`;

  const onStart = e => {
    if (e.touches.length !== 1) return;
    cancelAnimationFrame(raf);
    startY = lastY = e.touches[0].clientY;
    lastT = performance.now();
    dy = 0; velocity = 0; dragging = true;
    modal.style.transition = "none";
  };
  const onMove = e => {
    if (!dragging) return;
    const y = e.touches[0].clientY;
    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) velocity = (y - lastY) / dt;       // ταχύτητα δαχτύλου, px ανά ms
    lastY = y; lastT = now;
    dy = y - startY;
    if (dy < 0) dy = dy / 4;                       // αντίσταση προς τα πάνω
    modal.style.transform = `translateY(${dy}px)`;
    overlay.style.background = scrim(dy);
    if (e.cancelable) e.preventDefault();
  };

  // Επιστροφή με ελατήριο: το φύλλο κρατάει την ορμή του και σταθεροποιείται,
  // αντί να κόβεται σε σταθερό χρόνο. Έτσι νιώθεται σαν αντικείμενο με μάζα.
  const settle = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      modal.style.transform = "";
      overlay.style.background = "";
      return;
    }
    let x = dy, v = velocity * 16;                 // από px/ms σε px ανά καρέ
    const step = () => {
      if (!modal.isConnected) return;              // το φύλλο έκλεισε στο μεταξύ
      v = (v - x * 0.15) * 0.80;                   // δύναμη επαναφοράς και απόσβεση
      x = Math.max(x + v, -OVERSHOOT);
      if (Math.abs(x) < 0.5 && Math.abs(v) < 0.5) {
        modal.style.transform = "";
        overlay.style.background = "";
        return;
      }
      modal.style.transform = `translateY(${x}px)`;
      overlay.style.background = scrim(Math.max(x, 0));
      raf = requestAnimationFrame(step);
    };
    step();
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    if (dy > CLOSE_AT || velocity > FLING) {
      haptic("tap");
      // Όσο πιο δυνατά το πέταξες, τόσο πιο γρήγορα φεύγει
      const ms = Math.round(Math.max(120, Math.min(260, 230 - velocity * 130)));
      modal.style.transition = `transform ${ms}ms cubic-bezier(.32,.72,0,1)`;
      modal.style.transform = "translateY(100%)";
      overlay.style.background = "rgba(2, 6, 18, 0)";
      setTimeout(close, ms - 20);
    } else {
      settle();
    }
  };

  for (const el of [grip, head]) {
    if (!el) continue;
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
  }
}

// ---- Modal ----
export function openModal(opts) {
  // Αν υποστηρίζεται, η κάρτα προέλευσης μετασχηματίζεται στο φύλλο (View Transitions)
  const from = opts.from;
  if (from && document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let result;
    from.style.viewTransitionName = "sheet-morph";
    const vt = document.startViewTransition(() => {
      // Το όνομα πρέπει να ανήκει σε ένα μόνο στοιχείο κάθε στιγμή:
      // το στιγμιότυπο της κάρτας έχει ήδη ληφθεί, οπότε το μεταφέρουμε στο φύλλο.
      from.style.viewTransitionName = "";
      result = buildModal(opts);
      result.el.querySelector(".modal").style.viewTransitionName = "sheet-morph";
    });
    // Η μετάβαση μπορεί να ματαιωθεί (π.χ. κρυφή καρτέλα)· καθαρίζουμε και στις δύο περιπτώσεις
    const cleanup = () => {
      from.style.viewTransitionName = "";
      const m = document.querySelector("#modalRoot .modal");
      if (m) m.style.viewTransitionName = "";
    };
    vt.finished.then(cleanup, cleanup);
    return { close: () => result?.close(), get el() { return result?.el; } };
  }
  return buildModal(opts);
}

function buildModal({ title, body, saveLabel = "Αποθήκευση", onSave, onOpen, danger = false, closeLabel = "Άκυρο" }) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="overlay open">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="modal-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="icon-btn" data-close aria-label="Κλείσιμο">${icons.x}</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>${escapeHtml(closeLabel)}</button>
          ${onSave ? `<button class="btn ${danger ? "btn-danger-solid" : "btn-primary"}" data-save>${escapeHtml(saveLabel)}</button>` : ""}
        </div>
      </div>
    </div>`;
  const overlay = root.querySelector(".overlay");
  const close = () => { root.innerHTML = ""; document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", close));
  const saveBtn = root.querySelector("[data-save]");
  if (saveBtn && onSave) {
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        const ok = await onSave(overlay);
        if (ok !== false) close();
      } catch (e) {
        toast(e.message || "Κάτι πήγε στραβά", "error");
      } finally {
        saveBtn.disabled = false;
      }
    });
  }
  bindSheetDrag(overlay, close);
  if (onOpen) onOpen(overlay);
  const first = overlay.querySelector("input, select, textarea");
  if (first) first.focus();
  return { close, el: overlay };
}

// ---- Κοινοποίηση κειμένου ----
// Ανοίγει το φύλλο κοινοποίησης του συστήματος· όπου δεν υπάρχει, αντιγράφει.
// Ο παραλήπτης επιλέγεται πάντα από τον χρήστη — δεν στέλνεται τίποτα μόνο του.
export async function shareText(text, title = "Υπενθύμιση") {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return "shared"; }
    catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  try { await navigator.clipboard.writeText(text); return "copied"; }
  catch { return "failed"; }
}

// Ένα μήνυμα υπενθύμισης για όσα οφείλει ένα πρόσωπο.
// items = [{ name, amount, date }] — το ποσό είναι το μερίδιό του.
export function reminderMessage(items) {
  const money = n => fmt(n);
  if (items.length === 1) {
    const { name, amount, date } = items[0];
    return `Μια υπενθύμιση: το «${name}» χρεώνεται ${date}. Το μερίδιό σου είναι ${money(amount)}.`;
  }
  const total = items.reduce((s, x) => s + x.amount, 0);
  return "Μια υπενθύμιση για τις κοινές μας συνδρομές:\n"
    + items.map(x => `• ${x.name} — ${money(x.amount)} (${x.date})`).join("\n")
    + `\nΣύνολο: ${money(total)}.`;
}

// Ένα μήνυμα για όλους μαζί (π.χ. σε ομαδική συνομιλία): ποιος χρωστάει και πόσο.
// people = [{ name, amount, detail }]
export function groupReminderMessage(people, intro = "Υπενθύμιση για τις κοινές μας συνδρομές:") {
  const total = people.reduce((s, p) => s + Number(p.amount), 0);
  return `${intro}\n`
    + people.map(p => `• ${p.name} — ${fmt(p.amount)}${p.detail ? ` (${p.detail})` : ""}`).join("\n")
    + `\nΣύνολο: ${fmt(total)}.`;
}

export async function sendGroupReminder(people, { intro, title = "Υπενθύμιση σε όλους" } = {}) {
  if (!people.length) { toast("Δεν σου χρωστάει κανείς", "error"); return; }
  const res = await shareText(groupReminderMessage(people, intro), title);
  if (res === "shared") toast(`Το μήνυμα στάλθηκε — ${people.length} άτομα`);
  else if (res === "copied") toast("Το μήνυμα αντιγράφηκε — επικόλλησέ το στην ομάδα");
  else if (res === "failed") toast("Δεν μπόρεσα να ετοιμάσω το μήνυμα", "error");
}

// Στέλνει το μήνυμα και ενημερώνει με toast
export async function sendReminder(items, who) {
  const res = await shareText(reminderMessage(items), `Υπενθύμιση${who ? " — " + who : ""}`);
  if (res === "shared") toast("Το μήνυμα στάλθηκε");
  else if (res === "copied") toast("Το μήνυμα αντιγράφηκε — επικόλλησέ το όπου θες");
  else if (res === "failed") toast("Δεν μπόρεσα να ετοιμάσω το μήνυμα", "error");
}

// ---- Ανάλυση αριθμού ----
// Κάθε στατιστικό εξηγεί από τι φτιάχτηκε: rows = [{ label, value, meta, color, cls }]
export function drillRowsHtml(rows) {
  if (!rows.length) return `<p class="hint">Δεν υπάρχει κάτι πίσω από αυτόν τον αριθμό ακόμα.</p>`;
  return `<div class="drill-list">${rows.map(r => `
    <div class="drill-row">
      ${r.color ? `<i class="drill-dot" style="background:${r.color}"></i>` : ""}
      <div class="drill-main">
        <div class="drill-label">${escapeHtml(r.label)}</div>
        ${r.meta ? `<div class="drill-meta">${escapeHtml(r.meta)}</div>` : ""}
      </div>
      ${r.value != null ? `<div class="drill-value ${r.cls || ""}">${escapeHtml(String(r.value))}</div>` : ""}
    </div>`).join("")}</div>`;
}

export function openDrill({ title, rows = [], note = "", total = null, totalLabel = "" }, from) {
  openModal({
    from,
    title,
    closeLabel: "Κλείσιμο",
    body: `
      ${total != null ? `<div class="drill-total">
        <span>${escapeHtml(totalLabel || "Σύνολο")}</span><strong>${escapeHtml(String(total))}</strong></div>` : ""}
      ${drillRowsHtml(rows)}
      ${note ? `<p class="hint">${escapeHtml(note)}</p>` : ""}`
  });
}

// Κάνει πατητά τα [data-drill] μιας σελίδας. Το map δίνει τι θα δείξει το καθένα.
export function bindDrills(view, map) {
  view.querySelectorAll("[data-drill]").forEach(el => {
    const source = map[el.dataset.drill];
    if (!source) return;
    el.classList.add("drillable");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    const open = () => {
      haptic("tap");
      openDrill(typeof source === "function" ? source() : source, el);
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
}

export function confirmModal(message, onConfirm) {
  openModal({
    title: "Επιβεβαίωση",
    body: `<p class="confirm-text">${escapeHtml(message)}</p>`,
    saveLabel: "Διαγραφή",
    danger: true,
    onSave: onConfirm
  });
}

// Επιλογέας χρώματος μέσα σε φόρμες modal
export function colorPickerHtml(selected) {
  return `<div class="colors" data-colorpicker>` + COLORS.map(c =>
    `<button type="button" class="color-dot ${c === selected ? "selected" : ""}" style="background:${c}" data-color="${c}" aria-label="Χρώμα ${c}"></button>`
  ).join("") + `</div>`;
}
export function bindColorPicker(overlay) {
  const picker = overlay.querySelector("[data-colorpicker]");
  picker.addEventListener("click", e => {
    const btn = e.target.closest("[data-color]");
    if (!btn) return;
    picker.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
    btn.classList.add("selected");
  });
}
export function pickedColor(overlay) {
  return overlay.querySelector("[data-colorpicker] .selected")?.dataset.color || COLORS[2];
}
