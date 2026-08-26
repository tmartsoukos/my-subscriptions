// «Ρώτα με»: ερωτήσεις στα ελληνικά, απαντημένες τοπικά από τα δεδομένα της αρχικής.
import { escapeHtml, icons, micButtonHtml, bindMicButtons, drillRowsHtml } from "../../../ui.js";
import { answer, EXAMPLES, recentQuestions, rememberQuestion } from "../../../ask.js";
import { openAskStage } from "../../../askstage.js";
import { courses } from "../../../db.js";

export const id = "ask";

// Πρώτα οι δικές σου πρόσφατες ερωτήσεις, μετά παραδείγματα για να γεμίσει η σειρά
function chipsHtml() {
  const recent = recentQuestions();
  const list = [...recent, ...EXAMPLES.filter(x => !recent.includes(x))].slice(0, 4);
  return list.map(x => {
    const mine = recent.includes(x);
    return `<button class="filter-chip ${mine ? "chip-recent" : ""}" data-ask="${escapeHtml(x)}">${
      mine ? icons.clock : ""}${escapeHtml(x)}</button>`;
  }).join("");
}

export function html() {
  return `<div class="chart-card ask-card">
    <h3>${icons.chat} Ρώτα με</h3>
    <div class="ask-row">
      <input type="text" id="askInput" autocomplete="off" placeholder="π.χ. πόσα ξόδεψα σε φαγητό αυτόν τον μήνα;">
      ${micButtonHtml("askInput")}
      <button class="btn btn-primary" id="askGo">Ρώτα</button>
    </div>
    <div class="ask-chips">${chipsHtml()}</div>
    <div id="askOut" class="ask-out hidden"></div>
  </div>`;
}

export function bind(view, m) {
  const input = view.querySelector("#askInput");
  if (!input) return;
  const out = view.querySelector("#askOut");
  const chips = view.querySelector(".ask-chips");
  let courseCache = m.courseItems;

  const paintChips = () => {
    chips.innerHTML = chipsHtml();
    chips.querySelectorAll("[data-ask]").forEach(b =>
      b.addEventListener("click", () => { input.value = b.dataset.ask; run(); }));
  };

  const run = async () => {
    const question = input.value.trim();
    if (!question) return;
    // Τα μαθήματα φορτώνονται μόνο αν η ερώτηση τα αφορά
    if (/βαθμ|μέσο|μεσο|μαθημ/i.test(question) && !courseCache.length) {
      courseCache = await courses.list().catch(() => []);
    }
    const ask = q => {
      const a = answer(q, {
        subs: m.subs, todos: m.todoItems, events: m.evItems,
        finance: m.finItems, courses: courseCache
      });
      if (!a.unknown) rememberQuestion(q);   // ό,τι δεν καταλάβαμε δεν αξίζει κουμπί
      return a;
    };
    const a = ask(question);
    // Η απάντηση παίρνει πλήρη οθόνη· η κάρτα κρατάει το κείμενο για μετά
    openAskStage(question, a, ask);
    out.classList.remove("hidden");
    out.innerHTML = `<p class="ask-text">${escapeHtml(a.text)}</p>${a.rows?.length ? drillRowsHtml(a.rows) : ""}`;
    input.value = "";
    paintChips();
  };

  view.querySelector("#askGo").addEventListener("click", run);
  input.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
  paintChips();
  bindMicButtons(view, () => run());
}
