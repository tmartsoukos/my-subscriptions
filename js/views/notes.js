import { notes, uploadNoteImage, signedImageUrl } from "../db.js";
import { escapeHtml, icons, toast, toastAction, confirmModal, micButtonHtml, bindMicButtons } from "../ui.js";
import { renderMarkdown, plainPreview } from "../markdown.js";
import { param } from "../router.js";

const NOTE_COLORS = ["#f5d76e", "#f5b06e", "#8ed99a", "#8ec9f5", "#d99ee8", "#f0f0f0"];
let items = [];

// Αντικαθιστά τις αποθηκευμένες εικόνες με προσωρινούς υπογεγραμμένους συνδέσμους
async function hydrateImages(root) {
  for (const img of root.querySelectorAll("img[data-storage]")) {
    try { img.src = await signedImageUrl(img.dataset.storage); }
    catch { img.replaceWith(Object.assign(document.createElement("span"), { className: "md-img-missing", textContent: "εικόνα μη διαθέσιμη" })); }
  }
}

// Αν δεν υπάρχει τίτλος, χρησιμοποιείται η πρώτη γραμμή (όπως στις Σημειώσεις της Apple)
function noteTitle(n) {
  if (n.title?.trim()) return n.title.trim();
  const firstLine = (n.content || "").split("\n").find(l => l.trim());
  return firstLine ? plainPreview(firstLine, 40) : "Χωρίς τίτλο";
}

// Το σώμα της προεπισκόπησης χωρίς τη γραμμή που έγινε τίτλος
function notePreviewText(n) {
  const lines = (n.content || "").split("\n");
  const body = n.title?.trim() ? lines : lines.slice(lines.findIndex(l => l.trim()) + 1);
  return plainPreview(body.join("\n"), 90);
}

// ---------- Λίστα σημειώσεων ----------
export async function render(view) {
  const id = param();
  if (id) return renderEditor(view, id);

  items = await notes.list();
  const pinned = items.filter(n => n.pinned);
  const rest = items.filter(n => !n.pinned);

  const cardHtml = n => `
    <a class="note-card" href="#/notes/${n.id}" style="background:${n.color}">
      ${n.pinned ? `<span class="note-pin" aria-label="Καρφιτσωμένη">${icons.bookmark}</span>` : ""}
      <div class="note-title">${escapeHtml(noteTitle(n))}</div>
      <div class="note-text">${escapeHtml(notePreviewText(n)) || "<em>κενή</em>"}</div>
      <div class="note-foot">
        <span>${new Date(n.updated_at || n.created_at).toLocaleDateString("el-GR", { day: "numeric", month: "short" })}</span>
      </div>
    </a>`;

  view.innerHTML = `
    <div class="page-head">
      <h1>Σημειώσεις</h1>
      <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέα σημείωση</button>
    </div>
    ${pinned.length ? `<div class="section-title">Καρφιτσωμένες</div>
      <div class="notes-grid">${pinned.map(cardHtml).join("")}</div>` : ""}
    ${rest.length ? `${pinned.length ? `<div class="section-title">Όλες</div>` : ""}
      <div class="notes-grid">${rest.map(cardHtml).join("")}</div>` : ""}
    ${!items.length ? `<div class="empty">${icons.note}<p>Καμία σημείωση ακόμα.</p>
      <button class="btn btn-primary" id="btnAddEmpty">${icons.plus} Νέα σημείωση</button></div>` : ""}
  `;

  const create = async () => {
    const n = await notes.insert({ title: "", content: "", color: NOTE_COLORS[0] });
    location.hash = `#/notes/${n.id}`;
  };
  view.querySelector("#btnAdd")?.addEventListener("click", create);
  view.querySelector("#btnAddEmpty")?.addEventListener("click", create);
}

// ---------- Επεξεργασία σε πλήρη οθόνη ----------
async function renderEditor(view, id) {
  if (!items.length) items = await notes.list();
  const n = items.find(x => x.id === id) || (await notes.list()).find(x => x.id === id);
  if (!n) { location.hash = "#/notes"; return; }

  view.innerHTML = `
    <div class="note-editor">
      <div class="note-bar">
        <a href="#/notes" class="icon-btn" aria-label="Πίσω">${icons.chevronL}</a>
        <div class="note-bar-actions">
          <button class="icon-btn ${n.pinned ? "active" : ""}" id="btnPin" aria-label="Καρφίτσωμα">${icons.bookmark}</button>
          <button class="icon-btn" id="btnPreview" aria-label="Προεπισκόπηση">${icons.check}</button>
          <label class="icon-btn" for="imgInput" aria-label="Εισαγωγή εικόνας">${icons.image}
            <input type="file" id="imgInput" accept="image/*" hidden>
          </label>
          ${micButtonHtml("noteBody")}
          <button class="icon-btn" id="btnDelete" aria-label="Διαγραφή">${icons.trash}</button>
        </div>
      </div>

      <input type="text" id="noteTitle" class="note-title-input" placeholder="Τίτλος" value="${escapeHtml(n.title || "")}">
      <div class="colors note-colors" data-colorpicker>
        ${NOTE_COLORS.map(c => `<button type="button" class="color-dot ${c === n.color ? "selected" : ""}" style="background:${c}" data-color="${c}" aria-label="Χρώμα"></button>`).join("")}
      </div>

      <textarea id="noteBody" class="note-body" placeholder="Γράψε εδώ... Υποστηρίζονται **έντονα**, - λίστες, - [ ] εργασίες, # τίτλοι.">${escapeHtml(n.content || "")}</textarea>
      <div id="notePreview" class="note-preview markdown hidden"></div>

      <div class="note-status"><span id="saveState">Αποθηκευμένο</span></div>
    </div>`;

  const titleEl = view.querySelector("#noteTitle");
  const bodyEl = view.querySelector("#noteBody");
  const previewEl = view.querySelector("#notePreview");
  const stateEl = view.querySelector("#saveState");
  let timer = null, color = n.color;

  const save = async () => {
    stateEl.textContent = "Αποθήκευση...";
    try {
      await notes.update(n.id, {
        title: titleEl.value.trim() || null,
        content: bodyEl.value,
        color,
        updated_at: new Date().toISOString()
      });
      n.title = titleEl.value; n.content = bodyEl.value; n.color = color;
      stateEl.textContent = "Αποθηκευμένο";
    } catch (e) {
      stateEl.textContent = "Δεν αποθηκεύτηκε";
      toast(e.message || "Σφάλμα αποθήκευσης", "error");
    }
  };
  const scheduleSave = () => {
    stateEl.textContent = "…";
    clearTimeout(timer);
    timer = setTimeout(save, 900);
  };

  titleEl.addEventListener("input", scheduleSave);
  bodyEl.addEventListener("input", scheduleSave);
  window.addEventListener("hashchange", () => { clearTimeout(timer); save(); }, { once: true });

  // Χρώμα
  view.querySelector("[data-colorpicker]").addEventListener("click", e => {
    const b = e.target.closest("[data-color]");
    if (!b) return;
    view.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
    b.classList.add("selected");
    color = b.dataset.color;
    scheduleSave();
  });

  // Καρφίτσωμα
  view.querySelector("#btnPin").addEventListener("click", async e => {
    n.pinned = !n.pinned;
    e.currentTarget.classList.toggle("active", n.pinned);
    await notes.update(n.id, { pinned: n.pinned });
    toast(n.pinned ? "Καρφιτσώθηκε" : "Ξεκαρφιτσώθηκε");
  });

  // Προεπισκόπηση
  view.querySelector("#btnPreview").addEventListener("click", async () => {
    const showing = !previewEl.classList.contains("hidden");
    if (showing) {
      previewEl.classList.add("hidden");
      bodyEl.classList.remove("hidden");
    } else {
      previewEl.innerHTML = renderMarkdown(bodyEl.value);
      previewEl.classList.remove("hidden");
      bodyEl.classList.add("hidden");
      await hydrateImages(previewEl);
    }
  });

  // Εισαγωγή εικόνας από αρχείο ή κάμερα
  const insertImage = async file => {
    if (!file) return;
    toast("Ανέβασμα εικόνας...");
    try {
      const path = await uploadNoteImage(file);
      const snippet = `\n![εικόνα](storage:${path})\n`;
      const pos = bodyEl.selectionStart ?? bodyEl.value.length;
      bodyEl.value = bodyEl.value.slice(0, pos) + snippet + bodyEl.value.slice(pos);
      await save();
      toast("Η εικόνα προστέθηκε");
    } catch (e) {
      toast(e.message || "Αποτυχία ανεβάσματος", "error");
    }
  };
  view.querySelector("#imgInput").addEventListener("change", e => insertImage(e.target.files[0]));

  // Επικόλληση εικόνας από το πρόχειρο
  bodyEl.addEventListener("paste", e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); insertImage(item.getAsFile()); }
  });

  // Διαγραφή
  view.querySelector("#btnDelete").addEventListener("click", () => {
    confirmModal("Διαγραφή αυτής της σημείωσης;", async () => {
      clearTimeout(timer);
      const copy = { ...n };
      await notes.remove(n.id);
      items = items.filter(x => x.id !== n.id);
      location.hash = "#/notes";
      toastAction("Η σημείωση διαγράφηκε", "Αναίρεση", async () => {
        await notes.insert({
          id: copy.id, title: copy.title, content: copy.content,
          color: copy.color, pinned: copy.pinned
        });
        items = await notes.list();
        toast("Επαναφέρθηκε");
        if (location.hash === "#/notes") render(document.getElementById("view"));
      });
    });
  });

  // Η υπαγόρευση προστίθεται στο τέλος του κειμένου
  bindMicButtons(view, () => scheduleSave(), { append: true });
}
