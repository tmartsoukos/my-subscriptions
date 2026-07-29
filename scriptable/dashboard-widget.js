// Widget «Το Dashboard μου» για Scriptable (iOS)
// Αρχική οθόνη: μικρό / μεσαίο. Οθόνη κλειδώματος: γραμμή, κύκλος, ορθογώνιο.
//
// Εγκατάσταση:
// 1. Κατέβασε το Scriptable από το App Store.
// 2. Νέο script (+), επικόλλησε όλο αυτό το αρχείο, ονόμασέ το «Dashboard».
// 3. Βάλε το δικό σου token στη γραμμή TOKEN (Ρυθμίσεις της εφαρμογής -> Apple Calendar,
//    είναι το κομμάτι μετά το token= στο URL).
// 4. Στην αρχική οθόνη: παρατεταμένο πάτημα -> + -> Scriptable -> διάλεξε μέγεθος ->
//    στο widget πάτα «Script: Dashboard».

const TOKEN = "ΒΑΛΕ_ΕΔΩ_ΤΟ_TOKEN_ΣΟΥ";
const ENDPOINT = "https://lopgzutatnmhfwpaatpr.supabase.co/functions/v1/widget-data";

// ---- Χρώματα ----
const ACCENT = new Color("#3b82f6");
const VIOLET = new Color("#7c6cf6");
const WARN = new Color("#e3b341");
const DANGER = new Color("#f85149");
const TEXT = new Color("#e8eefc");
const MUTED = new Color("#8b9bc0");
const BG_TOP = new Color("#0b1329");
const BG_BOTTOM = new Color("#070d1f");

// ---- Δεδομένα (με τοπική εφεδρεία αν δεν υπάρχει δίκτυο) ----
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "dashboard-widget.json");

async function loadData() {
  try {
    const req = new Request(`${ENDPOINT}?token=${TOKEN}`);
    req.timeoutInterval = 15;
    const json = await req.loadJSON();
    if (json.error) throw new Error(json.error);
    fm.writeString(cachePath, JSON.stringify(json));
    return { data: json, stale: false };
  } catch (e) {
    if (fm.fileExists(cachePath)) {
      return { data: JSON.parse(fm.readString(cachePath)), stale: true };
    }
    return { data: null, stale: false, error: e.message };
  }
}

// ---- Μορφοποίηση ----
const euro = n => Number(n).toFixed(2).replace(".", ",") + " €";
const euroShort = n => (Number(n) % 1 === 0 ? Number(n).toFixed(0) : Number(n).toFixed(2).replace(".", ",")) + "€";

function whenText(days) {
  if (days === 0) return "σήμερα";
  if (days === 1) return "αύριο";
  if (days < 0) return "πέρασε";
  return `σε ${days} μέρες`;
}
function daysColor(days) {
  if (days <= 0) return DANGER;
  if (days <= 3) return WARN;
  return MUTED;
}

// ---- Κατασκευή widget ----
const { data, stale, error } = await loadData();
const family = config.widgetFamily || "medium";
const widget = new ListWidget();
widget.url = "https://tmartsoukos.github.io/my-subscriptions/";
widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

const lockScreen = family.startsWith("accessory");
if (!lockScreen) {
  const g = new LinearGradient();
  g.colors = [BG_TOP, BG_BOTTOM];
  g.locations = [0, 1];
  widget.backgroundGradient = g;
  widget.setPadding(14, 14, 14, 14);
}

if (!data) {
  const t = widget.addText("Χωρίς δεδομένα");
  t.font = Font.mediumSystemFont(13);
  t.textColor = lockScreen ? Color.white() : TEXT;
  if (error) {
    const e = widget.addText(String(error).slice(0, 40));
    e.font = Font.systemFont(10);
    e.textColor = MUTED;
  }
} else {
  const next = data.next;
  switch (family) {
    case "accessoryInline":
      buildInline(); break;
    case "accessoryCircular":
      buildCircular(); break;
    case "accessoryRectangular":
      buildRectangular(); break;
    case "small":
      buildSmall(); break;
    default:
      buildMedium();
  }

  // --- Οθόνη κλειδώματος: μία γραμμή ---
  function buildInline() {
    const txt = next
      ? `${next.name} ${euroShort(next.amount)} ${whenText(next.days)}`
      : `Καμία πληρωμή · ${data.todos.pending} εργασίες`;
    widget.addText(txt);
  }

  // --- Οθόνη κλειδώματος: κύκλος με τις μέρες ---
  function buildCircular() {
    const stack = widget.addStack();
    stack.layoutVertically();
    stack.centerAlignContent();
    const big = stack.addText(next ? String(Math.max(next.days, 0)) : String(data.todos.pending));
    big.font = Font.boldSystemFont(20);
    big.centerAlignText();
    const small = stack.addText(next ? "μέρες" : "εργασ.");
    small.font = Font.systemFont(9);
    small.centerAlignText();
  }

  // --- Οθόνη κλειδώματος: ορθογώνιο ---
  function buildRectangular() {
    widget.spacing = 1;
    if (next) {
      const l1 = widget.addText(`${next.trial ? "Λήγει δοκιμή: " : ""}${next.name}`);
      l1.font = Font.semiboldSystemFont(13);
      l1.lineLimit = 1;
      const l2 = widget.addText(`${euro(next.amount)} · ${whenText(next.days)}`);
      l2.font = Font.systemFont(12);
    } else {
      const l1 = widget.addText("Καμία πληρωμή");
      l1.font = Font.semiboldSystemFont(13);
    }
    const bits = [];
    if (data.todos.pending) bits.push(`${data.todos.pending} εργασίες`);
    if (data.event) bits.push(`${data.event.title}: ${whenText(data.event.days)}`);
    if (bits.length) {
      const l3 = widget.addText(bits.join(" · "));
      l3.font = Font.systemFont(11);
      l3.lineLimit = 1;
    }
  }

  // --- Αρχική οθόνη: μικρό ---
  function buildSmall() {
    const label = widget.addText("ΕΠΟΜΕΝΗ ΠΛΗΡΩΜΗ");
    label.font = Font.semiboldSystemFont(9);
    label.textColor = MUTED;
    widget.addSpacer(6);

    if (next) {
      const name = widget.addText(next.name);
      name.font = Font.boldSystemFont(16);
      name.textColor = TEXT;
      name.lineLimit = 1;

      const amount = widget.addText(euro(next.amount));
      amount.font = Font.boldSystemFont(22);
      amount.textColor = next.trial ? WARN : ACCENT;

      const when = widget.addText(whenText(next.days) + (next.trial ? " (δοκιμή)" : ""));
      when.font = Font.mediumSystemFont(12);
      when.textColor = daysColor(next.days);
    } else {
      const none = widget.addText("Καμία πληρωμή");
      none.font = Font.boldSystemFont(15);
      none.textColor = TEXT;
    }

    widget.addSpacer();
    const foot = widget.addText(`${euro(data.monthly)} τον μήνα`);
    foot.font = Font.systemFont(11);
    foot.textColor = MUTED;
    if (data.todos.pending) {
      const t = widget.addText(`${data.todos.pending} εργασίες${data.todos.overdue ? ` · ${data.todos.overdue} σήμερα` : ""}`);
      t.font = Font.systemFont(11);
      t.textColor = data.todos.overdue ? WARN : MUTED;
    }
  }

  // --- Αρχική οθόνη: μεσαίο ---
  function buildMedium() {
    const row = widget.addStack();
    row.layoutHorizontally();

    // Αριστερά: σύνολα
    const left = row.addStack();
    left.layoutVertically();
    left.size = new Size(120, 0);

    const l1 = left.addText("ΤΟΝ ΜΗΝΑ");
    l1.font = Font.semiboldSystemFont(9);
    l1.textColor = MUTED;
    const l2 = left.addText(euro(data.monthly));
    l2.font = Font.boldSystemFont(20);
    l2.textColor = TEXT;

    left.addSpacer(8);
    if (data.owed > 0) {
      const o1 = left.addText("ΜΟΥ ΧΡΩΣΤΑΝΕ");
      o1.font = Font.semiboldSystemFont(9);
      o1.textColor = MUTED;
      const o2 = left.addText(euro(data.owed));
      o2.font = Font.semiboldSystemFont(14);
      o2.textColor = VIOLET;
      left.addSpacer(6);
    }
    const t1 = left.addText(`${data.todos.pending} εργασίες`);
    t1.font = Font.mediumSystemFont(12);
    t1.textColor = data.todos.overdue ? WARN : MUTED;
    if (data.event) {
      const e1 = left.addText(`${data.event.title}`);
      e1.font = Font.systemFont(11);
      e1.textColor = MUTED;
      e1.lineLimit = 1;
      const e2 = left.addText(whenText(data.event.days));
      e2.font = Font.systemFont(10);
      e2.textColor = daysColor(data.event.days);
    }

    row.addSpacer(10);

    // Δεξιά: επερχόμενες πληρωμές
    const right = row.addStack();
    right.layoutVertically();
    const h = right.addText("ΕΠΕΡΧΟΜΕΝΕΣ");
    h.font = Font.semiboldSystemFont(9);
    h.textColor = MUTED;
    right.addSpacer(4);

    const items = (data.upcoming || []).slice(0, 3);
    if (!items.length) {
      const n = right.addText("Καμία πληρωμή");
      n.font = Font.systemFont(12);
      n.textColor = MUTED;
    }
    for (const s of items) {
      const line = right.addStack();
      line.layoutHorizontally();
      line.centerAlignContent();

      const dot = line.addText("●");
      dot.font = Font.systemFont(9);
      dot.textColor = new Color(s.color || "#3b82f6");
      line.addSpacer(5);

      const nm = line.addText(s.name);
      nm.font = Font.mediumSystemFont(12);
      nm.textColor = TEXT;
      nm.lineLimit = 1;

      line.addSpacer();

      const am = line.addText(euroShort(s.amount));
      am.font = Font.semiboldSystemFont(12);
      am.textColor = TEXT;
      line.addSpacer(6);

      const wh = line.addText(whenText(s.days).replace("σε ", "").replace(" μέρες", "μ"));
      wh.font = Font.systemFont(11);
      wh.textColor = daysColor(s.days);

      right.addSpacer(5);
    }
  }
}

if (stale && !lockScreen) {
  const s = widget.addText("εκτός σύνδεσης");
  s.font = Font.systemFont(8);
  s.textColor = MUTED;
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (family === "small") {
  widget.presentSmall();
} else {
  widget.presentMedium();
}
Script.complete();
