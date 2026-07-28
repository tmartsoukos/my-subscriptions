// Εικονίδια υπηρεσιών: απλά, τοπικά SVG (χωρίς εξωτερικά αιτήματα, δουλεύουν offline).
// Αν το όνομα δεν ταιριάζει με γνωστή υπηρεσία, χρησιμοποιείται εικονίδιο κατηγορίας.

const w = (inner, opts = "") =>
  `<svg viewBox="0 0 24 24" ${opts} aria-hidden="true">${inner}</svg>`;
const stroked = inner =>
  w(inner, `fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`);
const filled = inner => w(inner, `fill="#fff"`);

// --- Γνωστές υπηρεσίες (απλοποιημένα σχήματα) ---
const BRANDS = [
  { re: /netflix/i, svg: filled('<path d="M6 2h3.4l8.6 20H14.6z" opacity=".5"/><rect x="6" y="2" width="3.6" height="20" rx=".4"/><rect x="14.4" y="2" width="3.6" height="20" rx=".4"/>') },
  { re: /spotify/i, svg: stroked('<circle cx="12" cy="12" r="9.5" stroke-opacity=".4"/><path d="M7.2 9.4c3.3-1 6.9-.7 9.7 1"/><path d="M7.8 12.8c2.7-.8 5.6-.5 7.9.9"/><path d="M8.4 16c2-.6 4.2-.4 6 .6"/>') },
  { re: /apple|icloud|itunes|appstore|app store/i, svg: filled('<path d="M16.4 12.7c0-2.4 1.9-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.9-1.5-.1-2.8.8-3.6.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.7 2.5 3 2.4 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3.1.7 1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.6-1-2.6-3.7Z"/><path d="M14.3 5.6c.7-.8 1.1-2 1-3.1-.9 0-2.1.6-2.8 1.5-.6.7-1.2 1.9-1 3 1 .1 2.1-.5 2.8-1.4Z"/>') },
  { re: /youtube|yt premium/i, svg: w('<rect x="2.5" y="5" width="19" height="14" rx="4.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M10.3 8.9l5.6 3.1-5.6 3.1z" fill="#fff"/>') },
  { re: /amazon|prime/i, svg: stroked('<path d="M3.5 15.5c4.2 3 12.8 3 17-.2"/><path d="M18.2 15.8l2.3-.5-.6 2.4"/><path d="M8 11.5c0-1.7 1.3-2.6 3-2.6 1.4 0 2.4.6 2.4 2.1v3.2" stroke-opacity=".85"/>') },
  { re: /microsoft|office|xbox|onedrive/i, svg: filled('<rect x="3" y="3" width="8" height="8" rx=".6"/><rect x="13" y="3" width="8" height="8" rx=".6" opacity=".75"/><rect x="3" y="13" width="8" height="8" rx=".6" opacity=".75"/><rect x="13" y="13" width="8" height="8" rx=".6" opacity=".55"/>') },
  { re: /adobe|photoshop|creative cloud/i, svg: filled('<path d="M9.4 3H3v18zM14.6 3H21v18zM12 8.8l5.2 12.2h-3.4l-1.5-3.9H9.3z"/>') },
  { re: /dropbox/i, svg: filled('<path d="M7 3l5 3.2L7 9.4 2 6.2zM17 3l5 3.2-5 3.2-5-3.2zM2 12.6l5-3.2 5 3.2-5 3.2zM17 9.4l5 3.2-5 3.2-5-3.2z" opacity=".9"/><path d="M7 17.4l5-3.2 5 3.2-5 3.2z"/>') },
  { re: /claude|anthropic/i, svg: stroked('<path d="M12 3.5v17M5.2 7.5l13.6 9M18.8 7.5l-13.6 9" stroke-width="2.4"/>') },
  { re: /chatgpt|openai/i, svg: stroked('<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><circle cx="12" cy="12" r="3.2" stroke-opacity=".8"/>') },
  { re: /steam|epic games|gaming|playstation|nintendo/i, svg: stroked('<rect x="2.5" y="7" width="19" height="10" rx="4"/><path d="M7 10.5v3M5.5 12h3M15.5 11.2h.01M18 13.2h.01" stroke-width="2.4"/>') },
  { re: /figma/i, svg: filled('<path d="M9 2h3v6H9a3 3 0 1 1 0-6z"/><path d="M12 2h3a3 3 0 1 1 0 6h-3z" opacity=".8"/><path d="M9 8h3v6H9a3 3 0 1 1 0-6z" opacity=".65"/><circle cx="15" cy="11" r="3" opacity=".8"/><path d="M9 14h3v3a3 3 0 1 1-3-3z" opacity=".5"/>') },
  { re: /twitch/i, svg: stroked('<path d="M4 3.5h16v10l-4.5 4.5H12l-3 3v-3H4z"/><path d="M11 8v4M15.5 8v4" stroke-width="2.4"/>') },
  { re: /notion/i, svg: stroked('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M9 16.5v-9l6 9v-9" stroke-width="2.2"/>') },
  { re: /vodafone|cosmote|nova|wind|telekom/i, svg: stroked('<path d="M12 21c-4.4 0-8-3.6-8-8 0-5.5 5.2-9.4 9.6-10-.9.9-1.6 2-1.6 3.6 0 3.4 3 4.3 3 7.4 0 4-2.2 7-3 7Z"/>') },
  { re: /\bδεη\b|ενέργει|ρεύμα|electricity|ehe|protergia|elpedison/i, svg: filled('<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z"/>') },
  { re: /νερ[όο]|eyath|eydap|water/i, svg: filled('<path d="M12 2.5c4 5 6.5 8 6.5 11a6.5 6.5 0 0 1-13 0c0-3 2.5-6 6.5-11z"/>') }
];

// --- Εφεδρικά εικονίδια ανά κατηγορία ---
const CATEGORY_ICONS = {
  streaming: stroked('<rect x="2.5" y="4.5" width="19" height="13" rx="2.5"/><path d="M10 9l4.5 2.5L10 14z" fill="#fff" stroke="none"/><path d="M8 21h8"/>'),
  music: stroked('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.8"/><circle cx="17.5" cy="16" r="2.8"/>'),
  software: stroked('<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="M2.5 9h19"/><path d="M6 6.5h.01M9 6.5h.01"/>'),
  fitness: stroked('<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>'),
  utilities: filled('<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z"/>'),
  gaming: stroked('<rect x="2.5" y="7" width="19" height="10" rx="4"/><path d="M7 10.5v3M5.5 12h3M15.5 11.2h.01M18 13.2h.01" stroke-width="2.4"/>'),
  other: stroked('<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/>')
};

// Αφαίρεση τόνων για πιο ανεκτικό ταίριασμα
function stripMarks(s) {
  // Αφαίρεση συνδυαστικών τόνων (U+0300–U+036F) χωρίς literal χαρακτήρες στο regex
  return (s || "").normalize("NFD").split("")
    .filter(c => { const n = c.charCodeAt(0); return n < 0x300 || n > 0x36f; })
    .join("");
}

function normalize(s) {
  return stripMarks(s).toLowerCase();
}

export function logoFor(sub) {
  const name = sub.name || "";
  for (const b of BRANDS) {
    if (b.re.test(name) || b.re.test(normalize(name))) return b.svg;
  }
  return CATEGORY_ICONS[sub.category] || CATEGORY_ICONS.other;
}
