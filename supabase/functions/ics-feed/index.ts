// Ροή ICS για Apple Calendar: πληρωμές συνδρομών + υποχρεώσεις.
// Πρόσβαση με ?token=<uuid> (πίνακας ics_tokens) — χωρίς JWT.
import { createClient } from "npm:@supabase/supabase-js@2";

const CRLF = "\r\n";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Δίπλωμα γραμμών ICS στους 74 χαρακτήρες
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join(CRLF);
}

function dateStr(d: Date): string {
  return d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
}

function addCycle(d: Date, cycle: string): Date {
  const nd = new Date(d);
  if (cycle === "weekly") nd.setDate(nd.getDate() + 7);
  else if (cycle === "monthly") nd.setMonth(nd.getMonth() + 1);
  else nd.setFullYear(nd.getFullYear() + 1);
  return nd;
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Athens",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0300",
  "TZNAME:EEST",
  "DTSTART:19700329T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0200",
  "TZNAME:EET",
  "DTSTART:19701025T040000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE"
];

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tok } = await admin.from("ics_tokens").select("user_id").eq("token", token).maybeSingle();
  if (!tok) return new Response("Unauthorized", { status: 401 });

  const [{ data: subs }, { data: events }] = await Promise.all([
    admin.from("subscriptions").select("*").eq("user_id", tok.user_id),
    admin.from("events").select("*").eq("user_id", tok.user_id)
  ]);

  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//My Dashboard//EL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Το Dashboard μου",
    "X-WR-TIMEZONE:Europe/Athens",
    ...VTIMEZONE
  ];

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setFullYear(horizon.getFullYear() + 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  // Πληρωμές συνδρομών: επόμενες 6 εμφανίσεις ανά συνδρομή (all-day)
  for (const s of subs ?? []) {
    let d = new Date(s.next_date + "T00:00:00");
    while (d < today) d = addCycle(d, s.cycle);
    for (let i = 0; i < 6 && d <= horizon; i++) {
      const dEnd = new Date(d); dEnd.setDate(dEnd.getDate() + 1);
      const price = Number(s.price).toFixed(2).replace(".", ",");
      lines.push(
        "BEGIN:VEVENT",
        `UID:sub-${s.id}-${dateStr(d)}@my-dashboard`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dateStr(d)}`,
        `DTEND;VALUE=DATE:${dateStr(dEnd)}`,
        fold(`SUMMARY:${esc(`Πληρωμή: ${s.name} (${price} €)`)}`),
        fold(`DESCRIPTION:${esc(`Συνδρομή ${s.name} — ${price} €`)}`),
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      );
      d = addCycle(d, s.cycle);
    }
  }

  // Υποχρεώσεις: από -7 ημέρες έως +1 έτος
  for (const e of events ?? []) {
    const ed = new Date(e.event_date + "T00:00:00");
    if (ed < weekAgo || ed > horizon) continue;
    lines.push("BEGIN:VEVENT",
      `UID:ev-${e.id}@my-dashboard`,
      `DTSTAMP:${stamp}`);
    if (e.event_time) {
      const t = e.event_time.slice(0, 5).replace(":", "") + "00";
      const endD = new Date(ed);
      const [hh, mm] = e.event_time.split(":").map(Number);
      endD.setHours(hh + 1, mm);
      const endT = String(endD.getHours()).padStart(2, "0") + String(endD.getMinutes()).padStart(2, "0") + "00";
      lines.push(
        `DTSTART;TZID=Europe/Athens:${dateStr(ed)}T${t}`,
        `DTEND;TZID=Europe/Athens:${dateStr(endD)}T${endT}`
      );
    } else {
      const dEnd = new Date(ed); dEnd.setDate(dEnd.getDate() + 1);
      lines.push(
        `DTSTART;VALUE=DATE:${dateStr(ed)}`,
        `DTEND;VALUE=DATE:${dateStr(dEnd)}`
      );
    }
    lines.push(fold(`SUMMARY:${esc(e.title)}`));
    if (e.notes) lines.push(fold(`DESCRIPTION:${esc(e.notes)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join(CRLF) + CRLF, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
});
