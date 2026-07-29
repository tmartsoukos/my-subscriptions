// Μικρός markdown renderer (χωρίς εξαρτήσεις, δουλεύει offline).
// Υποστηρίζει: τίτλους, έντονα/πλάγια, λίστες, checkboxes, παράθεση, κώδικα, σύνδεσμο, εικόνα.
import { escapeHtml } from "./ui.js";

function inline(s) {
  let out = escapeHtml(s);
  // Εικόνες: ![alt](url) — οι αποθηκευμένες γράφονται ως storage:<path>
  out = out.replace(/!\[([^\]]*)\]\(storage:([^)\s]+)\)/g,
    (_, alt, path) => `<img class="md-img" data-storage="${escapeHtml(path)}" alt="${alt}" loading="lazy">`);
  out = out.replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g,
    (_, alt, url) => `<img class="md-img" src="${escapeHtml(url)}" alt="${alt}" loading="lazy">`);
  // Σύνδεσμοι
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    (_, text, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  // Κώδικας, έντονα, πλάγια, διαγραμμένα
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return out;
}

export function renderMarkdown(src) {
  const lines = (src || "").split("\n");
  const html = [];
  let list = null;      // "ul" | "ol" | null
  let inCode = false;
  let codeBuf = [];

  const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (line.trim().startsWith("```")) {
      if (inCode) { html.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`); codeBuf = []; inCode = false; }
      else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { closeList(); const lvl = h[1].length + 1; html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { closeList(); html.push(`<blockquote>${inline(quote[1])}</blockquote>`); continue; }

    // Λίστα με checkbox
    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (task) {
      if (list !== "ul") { closeList(); html.push('<ul class="md-tasks">'); list = "ul"; }
      const done = task[1].toLowerCase() === "x";
      html.push(`<li class="md-task ${done ? "done" : ""}"><span class="md-box">${done ? "✓" : ""}</span>${inline(task[2])}</li>`);
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      if (list !== "ul") { closeList(); html.push("<ul>"); list = "ul"; }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (list !== "ol") { closeList(); html.push("<ol>"); list = "ol"; }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { closeList(); html.push("<hr>"); continue; }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  if (inCode && codeBuf.length) html.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  closeList();
  return html.join("\n");
}

// Απλό κείμενο για προεπισκόπηση στη λίστα
export function plainPreview(src, max = 120) {
  const t = (src || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "🖼 εικόνα")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*]\s*\[[ xX]\]\s*/gm, "")   // δείκτες checkbox
    .replace(/[#>*`~_-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}
