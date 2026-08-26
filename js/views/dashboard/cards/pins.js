// Καρφιτσωμένα: ό,τι έχεις σημαδέψει, με σύνδεσμο στη σελίδα του.
import { escapeHtml, fmt, fmtDateShort, nextDue, myShare, icons } from "../../../ui.js";
import { logoFor, dnaAttrs } from "../../../logos.js";

export const id = "pins";

function resolve(p, m) {
  if (p.kind === "subscription") {
    const x = m.subs.find(s => s.id === p.ref_id);
    return x && { icon: logoFor(x), color: x.color, title: x.name,
      meta: `${fmt(myShare(x))} · ${fmtDateShort(nextDue(x))}`, href: "#/subs" };
  }
  if (p.kind === "note") {
    const x = m.noteItems.find(n => n.id === p.ref_id);
    return x && { icon: icons.note, color: x.color, title: x.title?.trim() || "Σημείωση",
      meta: (x.content || "").replace(/\s+/g, " ").slice(0, 60), href: `#/notes/${x.id}` };
  }
  if (p.kind === "course") {
    const x = m.courseItems.find(c => c.id === p.ref_id);
    return x && { icon: icons.book, color: x.color, title: x.name,
      meta: [x.code, x.ects ? `${x.ects} ECTS` : ""].filter(Boolean).join(" · "), href: "#/studies" };
  }
  return null;
}

export function html(m) {
  const pinned = m.pins.map(p => resolve(p, m)).filter(Boolean);
  if (!pinned.length) return "";
  return `<div class="chart-card pins-card">
    <h3>${icons.bookmark} Καρφιτσωμένα</h3>
    <div class="list">
      ${pinned.map(x => `<a class="card" href="${x.href}" style="padding:10px 14px">
        <div class="logo logo-sm" ${dnaAttrs({ name: x.title }, `--logo:${x.color};background:${x.color};`)}>${x.icon}</div>
        <div class="card-main">
          <div class="name">${escapeHtml(x.title)}</div>
          <div class="meta">${escapeHtml(x.meta || "")}</div>
        </div>
      </a>`).join("")}
    </div>
  </div>`;
}
