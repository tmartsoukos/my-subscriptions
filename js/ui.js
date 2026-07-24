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
export function today() { const d = new Date(); d.setHours(0,0,0,0); return d; }
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
  bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  wallet: svg('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>'),
  apple: svg('<path d="M12 20.94c1.5 0 2.75-.63 3.86-1.89 1.13-1.28 1.64-2.58 1.64-2.63-.03-.01-3.13-1.2-3.13-4.53 0-2.88 2.36-4.16 2.46-4.23-1.35-1.97-3.43-2.02-4-2.02-1.7 0-3.1 1.03-3.9 1.03-.83 0-2.1-1-3.46-.97-1.78.03-3.42 1.03-4.33 2.62-1.85 3.21-.47 7.95 1.33 10.55.88 1.27 1.93 2.7 3.3 2.65 1.32-.05 1.82-.86 3.42-.86 1.59 0 2.04.86 3.43.83Z"/><path d="M15.5 3.5c.73-.88 1.22-2.1 1.08-3.32-1.05.04-2.32.7-3.07 1.58-.68.78-1.27 2.03-1.11 3.22 1.17.09 2.36-.6 3.1-1.48Z"/>')
};

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

// ---- Modal ----
export function openModal({ title, body, saveLabel = "Αποθήκευση", onSave, onOpen, danger = false }) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="overlay open">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="modal-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="icon-btn" data-close aria-label="Κλείσιμο">${icons.x}</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Άκυρο</button>
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
  if (onOpen) onOpen(overlay);
  const first = overlay.querySelector("input, select, textarea");
  if (first) first.focus();
  return { close, el: overlay };
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
