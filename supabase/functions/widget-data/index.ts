// Συμπαγές JSON για το widget (Scriptable). Πρόσβαση με ?token=<uuid> από τον πίνακα ics_tokens.
import { createClient } from "npm:@supabase/supabase-js@2";

function addCycle(d: Date, cycle: string): Date {
  const nd = new Date(d);
  if (cycle === "weekly") nd.setDate(nd.getDate() + 7);
  else if (cycle === "monthly") nd.setMonth(nd.getMonth() + 1);
  else nd.setFullYear(nd.getFullYear() + 1);
  return nd;
}

// Ίδια λογική με το frontend: σε δοκιμή, πρώτη χρέωση = λήξη δοκιμής
function nextDue(s: any, today: Date): Date {
  if (s.trial_end && new Date(s.trial_end + "T00:00:00") >= today) {
    return new Date(s.trial_end + "T00:00:00");
  }
  let d = new Date(s.next_date + "T00:00:00");
  while (d < today) d = addCycle(d, s.cycle);
  return d;
}

const share = (s: any) => {
  const n = 1 + (Array.isArray(s.members) ? s.members.length : 0);
  return Math.round((Number(s.price) / n) * 100) / 100;
};

const monthly = (s: any) => {
  const p = share(s);
  if (s.cycle === "weekly") return p * 52 / 12;
  if (s.cycle === "yearly") return p / 12;
  return p;
};

const isoLocal = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" }
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tok } = await admin.from("ics_tokens").select("user_id").eq("token", token).maybeSingle();
  if (!tok) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" }
    });
  }

  const [{ data: subs }, { data: todos }, { data: events }] = await Promise.all([
    admin.from("subscriptions").select("*").eq("user_id", tok.user_id),
    admin.from("todos").select("*").eq("user_id", tok.user_id).eq("done", false),
    admin.from("events").select("*").eq("user_id", tok.user_id)
  ]);

  // Η "σήμερα" υπολογίζεται σε ώρα Ελλάδας, ανεξάρτητα από τον server
  const nowAthens = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Athens" }));
  const today = new Date(nowAthens.getFullYear(), nowAthens.getMonth(), nowAthens.getDate());
  const todayIso = isoLocal(today);
  const days = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86400000);

  const list = (subs ?? []).map(s => {
    const d = nextDue(s, today);
    return {
      name: s.name,
      amount: share(s),
      color: s.color,
      date: isoLocal(d),
      days: days(d),
      trial: !!(s.trial_end && new Date(s.trial_end + "T00:00:00") >= today)
    };
  }).sort((a, b) => a.days - b.days);

  const monthlyTotal = (subs ?? [])
    .filter(s => !(s.trial_end && new Date(s.trial_end + "T00:00:00") >= today))
    .reduce((sum, s) => sum + monthly(s), 0);

  // Απλήρωτα μερίδια από μοιρασμένες συνδρομές
  let owed = 0;
  for (const s of subs ?? []) {
    const cycleIso = isoLocal(nextDue(s, today));
    const mem = Array.isArray(s.members) ? s.members : [];
    owed += mem.filter((m: any) => m.paid_for !== cycleIso).length * share(s);
  }

  const pendingTodos = (todos ?? []).sort((a, b) =>
    a.priority - b.priority || (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const dueToday = pendingTodos.filter(t => t.due_date && t.due_date <= todayIso);

  const upcomingEvents = (events ?? [])
    .filter(e => e.event_date >= todayIso)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const nextEvent = upcomingEvents[0];

  return new Response(JSON.stringify({
    monthly: Math.round(monthlyTotal * 100) / 100,
    owed: Math.round(owed * 100) / 100,
    next: list[0] || null,
    upcoming: list.slice(0, 4),
    todos: {
      pending: pendingTodos.length,
      overdue: dueToday.length,
      next: pendingTodos[0]?.title || null
    },
    event: nextEvent ? {
      title: nextEvent.title,
      date: nextEvent.event_date,
      time: nextEvent.event_time ? nextEvent.event_time.slice(0, 5) : null,
      days: days(new Date(nextEvent.event_date + "T00:00:00"))
    } : null,
    updated: new Date().toISOString()
  }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" }
  });
});
