// Κινηματογραφική απάντηση: η ερώτηση φεύγει από την κάρτα και απαντιέται σε πλήρη οθόνη,
// γραμμένη γράμμα-γράμμα. Είναι η μόνη στιγμή που η εφαρμογή «μιλάει», οπότε παίρνει δικό της σκηνικό.
import { escapeHtml, drillRowsHtml, micButtonHtml, bindMicButtons, haptic } from "./ui.js";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let stage = null;      // το ενεργό σκηνικό
let timer = null;      // ο χρονομετρητής της γραφομηχανής
let lastFocus = null;

function typeOut(el, text, done) {
  clearTimeout(timer);
  if (reduced() || text.length < 3) { el.textContent = text; done(); return; }
  el.classList.add("typing");
  const step_ = Math.max(1, Math.round(text.length / 70));
  let i = 0;
  const tick = () => {
    i = Math.min(text.length, i + step_);
    el.textContent = text.slice(0, i);
    if (i < text.length) timer = setTimeout(tick, 18);
    else { el.classList.remove("typing"); done(); }
  };
  tick();
}

function paint(question, a) {
  stage.querySelector(".ask-q").textContent = `«${question}»`;
  const rows = stage.querySelector(".ask-rows");
  rows.innerHTML = "";
  rows.classList.remove("in");
  typeOut(stage.querySelector(".ask-a"), a.text || "", () => {
    if (!a.rows?.length) return;
    rows.innerHTML = drillRowsHtml(a.rows);
    requestAnimationFrame(() => rows.classList.add("in"));
  });
}

export function closeAskStage() {
  clearTimeout(timer);
  if (!stage) return;
  const el = stage;
  stage = null;
  el.classList.remove("open");
  document.removeEventListener("keydown", onKey);
  document.body.style.overflow = "";
  setTimeout(() => el.remove(), 220);
  lastFocus?.focus?.();
}

function onKey(e) {
  if (e.key === "Escape") closeAskStage();
}

// ask(question) -> { text, rows } για τις επόμενες ερωτήσεις μέσα στο σκηνικό
export function openAskStage(question, a, ask) {
  closeAskStage();
  lastFocus = document.activeElement;
  const el = document.createElement("div");
  el.className = "ask-stage";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Απάντηση");
  el.innerHTML = `
    <button class="icon-btn ask-stage-close" aria-label="Κλείσιμο">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="ask-stage-scroll">
      <div class="ask-stage-inner">
        <p class="ask-q"></p>
        <p class="ask-a" aria-live="polite"></p>
        <div class="ask-rows"></div>
      </div>
    </div>
    <div class="ask-stage-bar">
      <input type="text" id="askAgain" autocomplete="off" placeholder="Ρώτα κάτι άλλο…">
      ${micButtonHtml("askAgain")}
      <button class="btn btn-primary" id="askAgainGo">Ρώτα</button>
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  stage = el;
  requestAnimationFrame(() => el.classList.add("open"));
  document.addEventListener("keydown", onKey);

  el.querySelector(".ask-stage-close").addEventListener("click", closeAskStage);
  el.querySelector(".ask-stage-close").focus({ preventScroll: true });

  const input = el.querySelector("#askAgain");
  const again = () => {
    const q = input.value.trim();
    if (!q) return;
    haptic("tap");
    paint(q, ask(q));
    input.value = "";
    input.blur();
  };
  el.querySelector("#askAgainGo").addEventListener("click", again);
  input.addEventListener("keydown", e => { if (e.key === "Enter") again(); });
  bindMicButtons(el, () => again());

  paint(question, a);
}
