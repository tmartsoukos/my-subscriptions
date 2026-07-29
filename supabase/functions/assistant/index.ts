// Endpoint για Συντομεύσεις / Siri. Απαντά σε απλά ελληνικά και δέχεται καταχωρίσεις.
//   GET ?token=..&q=summary   -> τι πληρώνω αυτόν τον μήνα
//   GET ?token=..&q=today     -> τι έχω σήμερα
//   GET ?token=..&add=task&text=πληρωμή ΔΕΗ την Παρασκευή
//   GET ?token=..&add=note&text=...
import { createClient } from "npm:@supabase/supabase-js@2";

const isoLocal = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

function addCycle(d: Date, cycle: string): Date {
  const nd = new Date(d);
  if (cycle === "weekly") nd.setDate(nd.getDate() + 7);
  else if (cycle === "monthly") nd.setMonth(nd.getMonth() + 1);
  else nd.setFullYear(nd.getFullYear() + 1);
  return nd;
}
function nextDue(s: any, today: Date): Date {
  if (s.trial_end && new Date(s.trial_end + "T00:00:00") >= today) return new Date(s.trial_end + "T00:00:00");
  let d = new Date(s.next_date + "T00:00:00");
  while (d < today) d = addCycle(d, s.cycle);
  return d;
}
const share = (s: any) => {
  const n = 1 + (Array.isArray(s.members) ? s.members.length : 0);
  return Math.round((Number(s.price) / n) * 100) / 100;
};
const monthlyOf = (s: any) => {
  const p = share(s);
  if (s.cycle === "weekly") return p * 52 / 12;
  if (s.cycle === "yearly") return p / 12;
  return p;
};
const euro = (n: number) => n.toFixed(2).replace(".", ",") + " ευρώ";

// --- Ελαφριά αναγνώριση ημερομηνίας από ελληνική φράση (ίδια λογική με το frontend) ---
const WEEKDAYS: Record<string, number> = {
  "δευτερα": 1, "τριτη": 2, "τεταρτη": 3, "πεμπτη": 4, "παρασκευη": 5, "σαββατο": 6, "κυριακη": 0
};
const MONTHS: Record<string, number> = {
  "ιανουαριου": 0, "φεβρουαριου": 1, "μαρτιου": 2, "απριλιου": 3, "μαιου": 4, "ιουνιου": 5,
  "ιουλιου": 6, "αυγουστου": 7, "σεπτεμβριου": 8, "οκτωβριου": 9, "νοεμβριου": 10, "δεκεμβριου": 11
};
const stripAccents = (s: string) =>
  s.normalize("NFD").split("").filter(c => { const n = c.charCodeAt(0); return n < 0x300 || n > 0x36f; }).join("");

function parseTask(text: string, today: Date) {
  let rest = " " + text.trim() + " ";
  let due: Date | null = null, priority: number | null = null;
  const plus = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
  const consume = (re: RegExp) => {
    const m = stripAccents(rest.toLowerCase()).match(re);
    if (!m || m.index === undefined) return null;
    rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
    return m;
  };

  if (consume(/\s(επειγον|σημαντικο)\s/)) priority = 1;
  if (consume(/\s(σημερα)\s/)) due = new Date(today);
  else if (consume(/\s(μεθαυριο)\s/)) due = plus(2);
  else if (consume(/\s(αυριο)\s/)) due = plus(1);
  else {
    const m = consume(/\sσε (\d{1,2}) (μερες|ημερες)\s/);
    if (m) due = plus(parseInt(m[1]));
  }
  if (!due) {
    const m = consume(new RegExp(`\\s(την |τη |το )?(${Object.keys(WEEKDAYS).join("|")})\\s`));
    if (m) {
      const target = WEEKDAYS[m[2]];
      const d = new Date(today);
      let diff = (target - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      due = d;
    }
  }
  if (!due) {
    const m = consume(new RegExp(`\\s(στις |την )?(\\d{1,2}) (${Object.keys(MONTHS).join("|")})\\s`));
    if (m) {
      const d = new Date(today.getFullYear(), MONTHS[m[3]], parseInt(m[2]));
      if (d < today) d.setFullYear(d.getFullYear() + 1);
      due = d;
    }
  }
  let title = rest.replace(/\s+/g, " ").trim().replace(/^(να |θελω να |θέλω να )/i, "").replace(/[.,·]+$/, "");
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title, due_date: due ? isoLocal(due) : null, priority: priority ?? 2 };
}

const reply = (text: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ text, ...extra }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" }
  });

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response(JSON.stringify({ text: "Δεν έχω πρόσβαση." }), {
      status: 401, headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await admin.from("ics_tokens").select("user_id").eq("token", token).maybeSingle();
  if (!tok) {
    return new Response(JSON.stringify({ text: "Δεν έχω πρόσβαση." }), {
      status: 401, headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  const uid = tok.user_id;

  const nowAthens = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Athens" }));
  const today = new Date(nowAthens.getFullYear(), nowAthens.getMonth(), nowAthens.getDate());
  const todayIso = isoLocal(today);

  // ---- Καταχώριση ----
  const add = url.searchParams.get("add");
  const text = (url.searchParams.get("text") || "").trim();
  if (add) {
    if (!text) return reply("Δεν κατάλαβα τι να προσθέσω.");
    if (add === "task") {
      const p = parseTask(text, today);
      const { error } = await admin.from("todos").insert({
        user_id: uid, title: p.title || text, due_date: p.due_date, priority: p.priority
      });
      if (error) return reply("Δεν μπόρεσα να την αποθηκεύσω.");
      const when = p.due_date === todayIso ? " για σήμερα"
        : p.due_date ? ` για τις ${new Date(p.due_date + "T00:00:00").toLocaleDateString("el-GR", { day: "numeric", month: "long" })}`
        : "";
      return reply(`Πρόσθεσα «${p.title || text}»${when}.`);
    }
    if (add === "note") {
      const { error } = await admin.from("notes").insert({ user_id: uid, content: text, color: "#f5d76e" });
      if (error) return reply("Δεν μπόρεσα να αποθηκεύσω τη σημείωση.");
      return reply("Η σημείωση αποθηκεύτηκε.");
    }
    return reply("Δεν ξέρω τι να κάνω με αυτό.");
  }

  // ---- Ερωτήσεις ----
  const q = url.searchParams.get("q") || "summary";
  const [{ data: subs }, { data: todos }, { data: events }, { data: healthItems }] = await Promise.all([
    admin.from("subscriptions").select("*").eq("user_id", uid),
    admin.from("todos").select("*").eq("user_id", uid).eq("done", false),
    admin.from("events").select("*").eq("user_id", uid),
    admin.from("health_items").select("*").eq("user_id", uid)
  ]);

  if (q === "today") {
    const parts: string[] = [];
    const todayTasks = (todos ?? []).filter(t => t.due_date && t.due_date <= todayIso);
    const todayEvents = (events ?? []).filter(e => e.event_date === todayIso);
    const todayPays = (subs ?? []).filter(s => isoLocal(nextDue(s, today)) === todayIso);
    const todayHealth = (healthItems ?? []).filter(h => h.item_date === todayIso);

    if (todayEvents.length) parts.push(`έχεις ${todayEvents.map(e => e.title + (e.event_time ? ` στις ${e.event_time.slice(0, 5)}` : "")).join(", ")}`);
    if (todayHealth.length) parts.push(`για την υγεία: ${todayHealth.map(h => h.title).join(", ")}`);
    if (todayPays.length) parts.push(`πληρώνεις ${todayPays.map(s => `${s.name} ${euro(share(s))}`).join(" και ")}`);
    if (todayTasks.length) parts.push(`${todayTasks.length === 1 ? "μία εργασία" : `${todayTasks.length} εργασίες`}: ${todayTasks.slice(0, 3).map(t => t.title).join(", ")}`);

    return reply(parts.length ? `Σήμερα ${parts.join(". Επίσης ")}.` : "Σήμερα δεν έχεις τίποτα προγραμματισμένο.");
  }

  if (q === "tasks") {
    const list = (todos ?? []).sort((a, b) => a.priority - b.priority || (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    if (!list.length) return reply("Δεν έχεις εκκρεμείς εργασίες.");
    return reply(`Έχεις ${list.length} εκκρεμείς. Οι πιο σημαντικές: ${list.slice(0, 3).map(t => t.title).join(", ")}.`);
  }

  // summary (προεπιλογή)
  const monthlyTotal = (subs ?? [])
    .filter(s => !(s.trial_end && new Date(s.trial_end + "T00:00:00") >= today))
    .reduce((sum, s) => sum + monthlyOf(s), 0);
  const list = (subs ?? []).map(s => ({ s, d: nextDue(s, today) })).sort((a, b) => a.d.getTime() - b.d.getTime());
  const next = list[0];
  const days = next ? Math.round((next.d.getTime() - today.getTime()) / 86400000) : null;
  const whenTxt = days === 0 ? "σήμερα" : days === 1 ? "αύριο" : `σε ${days} μέρες`;

  return reply(
    `Αυτόν τον μήνα πληρώνεις ${euro(monthlyTotal)}.` +
    (next ? ` Επόμενη χρέωση: ${next.s.name}, ${euro(share(next.s))}, ${whenTxt}.` : "") +
    ((todos ?? []).length ? ` Έχεις και ${(todos ?? []).length} εκκρεμείς εργασίες.` : ""),
    { monthly: Math.round(monthlyTotal * 100) / 100 }
  );
});
