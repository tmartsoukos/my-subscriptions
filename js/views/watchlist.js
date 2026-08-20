import { watchlist } from "../db.js";
import {
  escapeHtml, icons, toast, toastAction, openModal, confirmModal,
  micButtonHtml, bindMicButtons, bindSwipe, haptic
} from "../ui.js";

const KINDS = { movie: "Ταινία", series: "Σειρά", book: "Βιβλίο", game: "Παιχνίδι", other: "Άλλο" };
const KIND_ICON = { movie: "card", series: "card", book: "note", game: "card", other: "bookmark" };
const STATUS = { planned: "Θέλω να δω", active: "Το ξεκίνησα", done: "Το τελείωσα" };

let items = [];
let filter = "all";

function stars(rating, forId) {
  return `<span class="stars" ${forId ? `data-rate="${forId}"` : ""}>` +
    [1, 2, 3, 4, 5].map(n =>
      `<button type="button" class="star ${rating >= n ? "on" : ""}" data-star="${n}"
        aria-label="Βαθμολογία ${n}">${icons.star}</button>`).join("") +
    `</span>`;
}

function formHtml(w) {
  return `
    <div class="field">
      <label for="fTitle">Τίτλος</label>
      <div class="input-with-mic">
        <input type="text" id="fTitle" placeholder="π.χ. Dune: Part Two" value="${w ? escapeHtml(w.title) : ""}">
        ${micButtonHtml("fTitle")}
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="fKind">Είδος</label>
        <select id="fKind">
          ${Object.entries(KINDS).map(([v, l]) =>
            `<option value="${v}" ${w?.kind === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="fStatus">Κατάσταση</label>
        <select id="fStatus">
          ${Object.entries(STATUS).map(([v, l]) =>
            `<option value="${v}" ${w?.status === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="field">
      <label for="fService">Πού (προαιρετικό)</label>
      <input type="text" id="fService" placeholder="π.χ. Netflix, βιβλιοθήκη" value="${w?.service ? escapeHtml(w.service) : ""}">
    </div>
    <div class="field">
      <label for="fNote">Σημείωση (προαιρετικό)</label>
      <input type="text" id="fNote" placeholder="π.χ. το πρότεινε ο Νίκος" value="${w?.note ? escapeHtml(w.note) : ""}">
    </div>
    <div class="field">
      <label>Βαθμολογία</label>
      ${stars(w?.rating || 0)}
    </div>`;
}

function openForm(w, rerender) {
  openModal({
    title: w ? "Επεξεργασία" : "Νέα καταχώριση",
    body: formHtml(w),
    onOpen: overlay => {
      bindMicButtons(overlay);
      const box = overlay.querySelector(".stars");
      box.addEventListener("click", e => {
        const b = e.target.closest("[data-star]");
        if (!b) return;
        const n = +b.dataset.star;
        const current = box.dataset.value ? +box.dataset.value : 0;
        box.dataset.value = current === n ? 0 : n;   // δεύτερο πάτημα μηδενίζει
        box.querySelectorAll(".star").forEach((s, i) => s.classList.toggle("on", i < +box.dataset.value));
      });
      if (w?.rating) box.dataset.value = String(w.rating);
    },
    onSave: async overlay => {
      const title = overlay.querySelector("#fTitle").value.trim();
      if (!title) { toast("Συμπλήρωσε τίτλο.", "error"); return false; }
      const ratingRaw = overlay.querySelector(".stars").dataset.value;
      const row = {
        title,
        kind: overlay.querySelector("#fKind").value,
        status: overlay.querySelector("#fStatus").value,
        service: overlay.querySelector("#fService").value.trim() || null,
        note: overlay.querySelector("#fNote").value.trim() || null,
        rating: ratingRaw && +ratingRaw > 0 ? +ratingRaw : null
      };
      if (w) await watchlist.update(w.id, row);
      else await watchlist.insert(row);
      toast(w ? "Ενημερώθηκε" : "Προστέθηκε στη λίστα");
      await rerender();
    }
  });
}

function cardHtml(w) {
  const nextStatus = w.status === "planned" ? "active" : w.status === "active" ? "done" : "planned";
  return `<div class="swipe-wrap">
    <div class="swipe-bg" aria-hidden="true">
      <span class="sw-delete">${icons.trash} Διαγραφή</span>
      <span class="sw-done">${STATUS[nextStatus]} ${icons.check}</span>
    </div>
    <div class="card wl-item" data-swipe="${w.id}">
      <div class="logo logo-sm wl-kind" title="${KINDS[w.kind]}">${icons[KIND_ICON[w.kind]] || icons.bookmark}</div>
      <div class="card-main">
        <div class="name">${escapeHtml(w.title)}
          <span class="chip">${KINDS[w.kind]}</span>
          <span class="chip chip-${w.status}">${STATUS[w.status]}</span>
        </div>
        <div class="meta">${[w.service, w.note].filter(Boolean).map(escapeHtml).join(" · ") || "&nbsp;"}</div>
        ${w.rating ? `<div class="stars static">${[1,2,3,4,5].map(n =>
          `<span class="star ${w.rating >= n ? "on" : ""}">${icons.star}</span>`).join("")}</div>` : ""}
      </div>
      <div class="card-actions">
        <button class="icon-btn" data-next="${w.id}" aria-label="Επόμενη κατάσταση: ${STATUS[nextStatus]}">${icons.check}</button>
        <button class="icon-btn" data-edit="${w.id}" aria-label="Επεξεργασία">${icons.edit}</button>
        <button class="icon-btn" data-del="${w.id}" aria-label="Διαγραφή">${icons.trash}</button>
      </div>
    </div>
  </div>`;
}

export async function render(view, { cached = false } = {}) {
  if (!cached) items = await watchlist.list();
  const counts = {
    all: items.length,
    planned: items.filter(w => w.status === "planned").length,
    active: items.filter(w => w.status === "active").length,
    done: items.filter(w => w.status === "done").length
  };
  const shown = filter === "all" ? items : items.filter(w => w.status === filter);

  view.innerHTML = `
    <div class="page-head">
      <h1>Λίστα</h1>
      <button class="btn btn-primary" id="btnAdd">${icons.plus} Νέα καταχώριση</button>
    </div>
    <div class="filters">
      ${[["all", "Όλα"], ["planned", "Θέλω να δω"], ["active", "Το ξεκίνησα"], ["done", "Τελείωσαν"]].map(([v, l]) =>
        `<button class="filter-chip ${filter === v ? "active" : ""}" data-filter="${v}">${l} <span>${counts[v]}</span></button>`).join("")}
    </div>
    ${items.length ? `<p class="hint swipe-hint">Σύρε αριστερά για αλλαγή κατάστασης, δεξιά για διαγραφή.</p>` : ""}
    ${shown.length ? `<div class="list">${shown.map(cardHtml).join("")}</div>`
      : `<div class="empty">${icons.bookmark}<p>${items.length ? "Τίποτα σε αυτή την κατηγορία." : "Κράτα εδώ ταινίες, σειρές και βιβλία που θέλεις να δεις."}</p>
         ${items.length ? "" : `<button class="btn btn-primary" id="btnAddEmpty">${icons.plus} Νέα καταχώριση</button>`}</div>`}
  `;

  const rerender = (cached = false) => render(view, { cached });

  async function cycleStatus(w) {
    haptic("ok");
    const next = w.status === "planned" ? "active" : w.status === "active" ? "done" : "planned";
    const previous = w.status;
    w.status = next;                 // αισιόδοξη ενημέρωση
    await rerender(true);
    try {
      await watchlist.update(w.id, { status: next });
    } catch {
      w.status = previous;
      await rerender(true);
      toast("Δεν αποθηκεύτηκε", "error");
    }
  }
  async function removeItem(w) {
    await watchlist.remove(w.id);
    await rerender();
    toastAction("Διαγράφηκε", "Αναίρεση", async () => {
      await watchlist.insert({
        id: w.id, title: w.title, kind: w.kind, status: w.status,
        rating: w.rating, service: w.service, note: w.note
      });
      await rerender();
      toast("Επαναφέρθηκε");
    });
  }

  view.querySelector("#btnAdd")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelector("#btnAddEmpty")?.addEventListener("click", () => openForm(null, rerender));
  view.querySelectorAll("[data-filter]").forEach(b =>
    b.addEventListener("click", () => { filter = b.dataset.filter; rerender(); }));

  view.querySelectorAll("[data-swipe]").forEach(card => {
    const w = items.find(x => x.id === card.dataset.swipe);
    bindSwipe(card, { onLeft: () => cycleStatus(w), onRight: () => removeItem(w) });
  });

  // onclick (όχι addEventListener): το #view επιβιώνει κάθε render, οπότε ο listener
  // θα συσσωρευόταν και κάθε κλικ θα εκτελούνταν πολλές φορές.
  view.onclick = async e => {
    const nextBtn = e.target.closest("[data-next]");
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (nextBtn) await cycleStatus(items.find(x => x.id === nextBtn.dataset.next));
    if (editBtn) openForm(items.find(x => x.id === editBtn.dataset.edit), rerender);
    if (delBtn) {
      const w = items.find(x => x.id === delBtn.dataset.del);
      confirmModal(`Διαγραφή «${w.title}»;`, () => removeItem(w));
    }
  };
}
