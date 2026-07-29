import { notes } from "../db.js";
import { escapeHtml, icons, toast, openModal, confirmModal, micButtonHtml, bindMicButtons } from "../ui.js";

const NOTE_COLORS = ["#f5d76e", "#f5b06e", "#8ed99a", "#8ec9f5", "#d99ee8", "#f0f0f0"];
let items = [];

function formHtml(n) {
  const sel = n?.color || NOTE_COLORS[0];
  return `
    <div class="field">
      <label for="fContent">Σημείωση</label>
      <div class="input-with-mic">
        <textarea id="fContent" placeholder="Γράψε κάτι...">${n ? escapeHtml(n.content) : ""}</textarea>
        ${micButtonHtml("fContent")}
      </div>
    </div>
    <div class="field">
      <label>Χρώμα</label>
      <div class="colors" data-colorpicker>
        ${NOTE_COLORS.map(c => `<button type="button" class="color-dot ${c === sel ? "selected" : ""}" style="background:${c}" data-color="${c}" aria-label="Χρώμα"></button>`).join("")}
      </div>
    </div>`;
}

function openForm(n, rerender) {
  openModal({
    title: n ? "Επεξεργασία σημείωσης" : "Νέα σημείωση",
    body: formHtml(n),
    onOpen: overlay => {
      bindMicButtons(overlay);
      overlay.querySelector("[data-colorpicker]").addEventListener("click", e => {
        const btn = e.target.closest("[data-color]");
        if (!btn) return;
        overlay.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
        btn.classList.add("selected");
      });
    },
    onSave: async overlay => {
      const content = overlay.querySelector("#fContent").value.trim();
      if (!content) { toast("Η σημείωση είναι κενή.", "error"); return false; }
      const color = overlay.querySelector("[data-colorpicker] .selected")?.dataset.color || NOTE_COLORS[0];
      if (n) await notes.update(n.id, { content, color });
      else await notes.insert({ content, color });
      toast(n ? "Η σημείωση ενημερώθηκε" : "Η σημείωση προστέθηκε");
      await rerender();
    }
  });
}

export async function render(view) {
  items = await notes.list();
  view.innerHTML = `
    <div class="page-head">
      <h1>Σημειώσεις</h1>
      <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέα σημείωση</button>
    </div>
    ${items.length ? `<div class="notes-grid">${items.map(n => `
      <div class="note-card" style="background:${n.color}" data-note="${n.id}" role="button" tabindex="0" aria-label="Επεξεργασία σημείωσης">
        <div class="note-text">${escapeHtml(n.content)}</div>
        <div class="note-foot">
          <span>${new Date(n.created_at).toLocaleDateString("el-GR", { day: "numeric", month: "short" })}</span>
          <button class="icon-btn" data-del="${n.id}" aria-label="Διαγραφή σημείωσης">${icons.trash}</button>
        </div>
      </div>`).join("")}</div>`
      : `<div class="empty">${icons.note}<p>Καμία σημείωση ακόμα.</p><button class="btn btn-primary" id="btnAddEmpty">${icons.plus} Νέα σημείωση</button></div>`}
  `;

  const rerender = () => render(view);
  view.querySelector("#btnAdd")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelector("#btnAddEmpty")?.addEventListener("click", () => openForm(null, rerender));
  // onclick αντί για addEventListener: το #view δεν αντικαθίσταται μεταξύ renders
  view.onclick = e => {
    const delBtn = e.target.closest("[data-del]");
    if (delBtn) {
      e.stopPropagation();
      confirmModal("Διαγραφή αυτής της σημείωσης;", async () => {
        await notes.remove(delBtn.dataset.del);
        toast("Η σημείωση διαγράφηκε");
        await rerender();
      });
      return;
    }
    const card = e.target.closest("[data-note]");
    if (card) openForm(items.find(n => n.id === card.dataset.note), rerender);
  };
}
