// Θέμα (σύστημα / φωτεινό / σκούρο) και πυκνότητα λίστας.
// Εφαρμόζεται στο <html> ώστε να ισχύει πριν καν φορτώσει η εφαρμογή.
const THEME_KEY = "pref:theme";
const DENSITY_KEY = "pref:density";

export const getTheme = () => localStorage.getItem(THEME_KEY) || "system";
export const getDensity = () => localStorage.getItem(DENSITY_KEY) || "comfortable";

function effectiveTheme(mode) {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

export function applyTheme() {
  const mode = getTheme();
  const eff = effectiveTheme(mode);
  const root = document.documentElement;
  root.dataset.theme = eff;
  root.dataset.density = getDensity();
  root.style.colorScheme = eff;
  // Η μπάρα του κινητού ακολουθεί το φόντο
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", eff === "light" ? "#f4f6fb" : "#070d1f");
}

export function setTheme(mode) {
  localStorage.setItem(THEME_KEY, mode);
  applyTheme();
}
export function setDensity(value) {
  localStorage.setItem(DENSITY_KEY, value);
  applyTheme();
}

// Αλλαγή ρύθμισης συστήματος όσο η εφαρμογή είναι ανοιχτή
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (getTheme() === "system") applyTheme();
});

applyTheme();
