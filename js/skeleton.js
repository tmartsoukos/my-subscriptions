// Σκελετοί φόρτωσης: δίνουν το σχήμα του περιεχομένου αντί για σπίναρ στο κενό.
const bar = (w, h = 14, extra = "") =>
  `<span class="sk sk-bar" style="width:${w};height:${h}px;${extra}"></span>`;

const head = () => `
  <div class="sk-head">
    ${bar("180px", 26)}
    ${bar("140px", 44, "border-radius:10px")}
  </div>`;

const stats = (n = 4) => `
  <div class="stats">${Array.from({ length: n }, () => `
    <div class="stat sk-card">${bar("60%", 10)}${bar("80%", 22, "margin-top:10px")}</div>`).join("")}</div>`;

const rows = (n = 4) => `
  <div class="list">${Array.from({ length: n }, () => `
    <div class="card sk-card">
      <span class="sk sk-logo"></span>
      <div class="card-main">${bar("45%", 14)}${bar("70%", 11, "margin-top:8px")}</div>
      <div class="card-right">${bar("60px", 14)}</div>
    </div>`).join("")}</div>`;

const filters = () => `
  <div class="filters">${Array.from({ length: 4 }, () => bar("90px", 40, "border-radius:20px")).join("")}</div>`;

const charts = () => `
  <div class="charts">
    <div class="chart-card sk-card">${bar("55%", 12)}<span class="sk sk-block" style="height:190px"></span></div>
    <div class="chart-card sk-card">${bar("45%", 12)}<span class="sk sk-block" style="height:190px"></span></div>
  </div>`;

const grid = (n = 4) => `
  <div class="notes-grid">${Array.from({ length: n }, () => `
    <div class="sk-card sk-note">${bar("70%", 15)}${bar("90%", 11, "margin-top:10px")}${bar("60%", 11, "margin-top:6px")}</div>`).join("")}</div>`;

const calendarGrid = () => `
  <div class="cal-head">${bar("40px", 40, "border-radius:10px")}${bar("160px", 20)}${bar("40px", 40, "border-radius:10px")}</div>
  <div class="cal-grid">${Array.from({ length: 42 }, () => `<span class="sk sk-cell"></span>`).join("")}</div>`;

const blocks = (n = 3) => Array.from({ length: n }, () => `
  <div class="settings-block sk-card">${bar("35%", 16)}${bar("85%", 11, "margin-top:12px")}${bar("60%", 11, "margin-top:6px")}</div>`).join("");

const LAYOUTS = {
  dashboard: () => head() + stats(4) + charts(),
  finance: () => head() + stats(5) + filters() + charts() + rows(3),
  subs: () => head() + stats(3) + rows(4),
  todos: () => head() + stats(2) + rows(4),
  calendar: () => head() + calendarGrid(),
  notes: () => head() + grid(4),
  watchlist: () => head() + filters() + rows(3),
  studies: () => head() + stats(4) + filters() + rows(3),
  health: () => head() + stats(3) + filters() + rows(3),
  more: () => head() + rows(5),
  settings: () => head() + blocks(4)
};

export function skeletonFor(route) {
  return `<div class="skeleton" aria-hidden="true">${(LAYOUTS[route] || LAYOUTS.subs)()}</div>`;
}
