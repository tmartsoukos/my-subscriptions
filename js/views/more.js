import { icons } from "../ui.js";

// Σελίδα «Περισσότερα» για το κινητό — στο desktop όλα φαίνονται στο πλαϊνό μενού
const LINKS = [
  { href: "#/notes", ico: "note", title: "Σημειώσεις", desc: "Γρήγορες σημειώσεις" },
  { href: "#/watchlist", ico: "bookmark", title: "Λίστα", desc: "Ταινίες, σειρές, βιβλία" },
  { href: "#/settings", ico: "settings", title: "Ρυθμίσεις", desc: "Ημερολόγιο Apple, λογαριασμός" }
];

export async function render(view) {
  view.innerHTML = `
    <div class="page-head"><h1>Περισσότερα</h1></div>
    <div class="more-list">
      ${LINKS.map(l => `
        <a class="card more-item" href="${l.href}">
          <div class="logo logo-sm more-ico">${icons[l.ico]}</div>
          <div class="card-main">
            <div class="name">${l.title}</div>
            <div class="meta">${l.desc}</div>
          </div>
          <span class="more-arrow">${icons.chevronR}</span>
        </a>`).join("")}
    </div>`;
}
