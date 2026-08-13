// Ειδοποιήσεις push χωρίς εξωτερική υπηρεσία (Web Push, RFC 8291 + VAPID).
//   ?token=<ics token>&mode=preview  -> επιστρέφει το κείμενο χωρίς αποστολή
//   ?token=<ics token>&mode=test     -> στέλνει δοκιμαστική ειδοποίηση στον χρήστη
//   ?secret=<cron_secret>            -> ωριαία εκτέλεση από το cron για όλους
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();

// ---------- helpers ----------
const b64urlToBytes = (s: string) => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - pad.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
const bytesToB64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const isoLocal = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const money = (n: number) => n.toFixed(2).replace(".", ",") + "€";

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

// ---------- VAPID ----------
async function vapidHeaders(endpoint: string, publicKey: string, privateD: string, subject: string) {
  const aud = new URL(endpoint).origin;
  const pub = b64urlToBytes(publicKey);
  const jwk = {
    kty: "EC", crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: privateD, ext: true
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(enc.encode(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject
  })));
  const data = `${header}.${payload}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(data)));
  return { authorization: `vapid t=${data}.${bytesToB64url(sig)}, k=${publicKey}` };
}

// ---------- Κρυπτογράφηση φορτίου (aes128gcm) ----------
async function encryptPayload(payload: string, p256dh: string, authSecret: string) {
  const uaPub = b64urlToBytes(p256dh);
  const authKey = b64urlToBytes(authSecret);

  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));

  const sharedKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveBits"]);
  const keyInfo = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPub, ...asPub]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authKey, info: keyInfo }, sharedKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: aes128gcm\0") }, ikmKey, 128));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: nonce\0") }, ikmKey, 96));

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plain = new Uint8Array([...enc.encode(payload), 2]); // 0x02 = τελευταία εγγραφή
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plain));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return new Uint8Array([...salt, ...rs, asPub.length, ...asPub, ...cipher]);
}

async function sendPush(sub: any, body: object, cfg: Record<string, string>) {
  const payload = JSON.stringify(body);
  const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth);
  const { authorization } = await vapidHeaders(sub.endpoint, cfg.vapid_public, cfg.vapid_private_d, cfg.vapid_subject);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400"
    },
    body: encrypted
  });
  return res.status;
}

// ---------- Σύνθεση μηνύματος ----------
async function buildMessage(admin: any, uid: string, leadDays: number, weekly: boolean) {
  const nowAthens = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Athens" }));
  const today = new Date(nowAthens.getFullYear(), nowAthens.getMonth(), nowAthens.getDate());
  const todayIso = isoLocal(today);
  const horizonDays = weekly ? 7 : leadDays;
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + horizonDays);
  const horizonIso = isoLocal(horizon);
  const days = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86400000);

  const [{ data: subs }, { data: todos }, { data: events }, { data: healthItems }] = await Promise.all([
    admin.from("subscriptions").select("*").eq("user_id", uid),
    admin.from("todos").select("*").eq("user_id", uid).eq("done", false),
    admin.from("events").select("*").eq("user_id", uid),
    admin.from("health_items").select("*").eq("user_id", uid)
  ]);

  const lines: string[] = [];

  // Δοκιμές που λήγουν
  for (const s of subs ?? []) {
    if (!s.trial_end) continue;
    const d = new Date(s.trial_end + "T00:00:00");
    const n = days(d);
    if (n >= 0 && n <= Math.max(2, horizonDays)) {
      lines.push(`Λήγει η δοκιμή ${s.name} ${n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} μέρες`} — μετά ${money(share(s))}`);
    }
  }
  // Χρεώσεις
  for (const s of subs ?? []) {
    const d = nextDue(s, today);
    const n = days(d);
    if (s.trial_end && isoLocal(d) === s.trial_end) continue; // ήδη αναφέρθηκε ως δοκιμή
    if (n >= 0 && n <= horizonDays) {
      lines.push(`${s.name} ${money(share(s))} ${n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} μέρες`}`);
    }
  }
  // Εργασίες
  const dueTasks = (todos ?? []).filter(t => t.due_date && t.due_date <= horizonIso)
    .sort((a: any, b: any) => (a.due_date || "").localeCompare(b.due_date || ""));
  for (const t of dueTasks.slice(0, 4)) {
    const n = days(new Date(t.due_date + "T00:00:00"));
    lines.push(`${t.title} — ${n < 0 ? "εκπρόθεσμη" : n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} μέρες`}`);
  }
  // Υποχρεώσεις
  for (const e of (events ?? []).filter((e: any) => e.event_date >= todayIso && e.event_date <= horizonIso)) {
    const n = days(new Date(e.event_date + "T00:00:00"));
    lines.push(`${e.title}${e.event_time ? " " + e.event_time.slice(0, 5) : ""} — ${n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} μέρες`}`);
  }
  // Υγεία (με κύλιση επανάληψης)
  for (const h of healthItems ?? []) {
    if (!h.item_date) continue;
    let d = new Date(h.item_date + "T00:00:00");
    if (h.repeat_months) while (d < today) d.setMonth(d.getMonth() + h.repeat_months);
    const n = days(d);
    if (n >= 0 && n <= horizonDays) {
      lines.push(`${h.title} — ${n === 0 ? "σήμερα" : n === 1 ? "αύριο" : `σε ${n} μέρες`}`);
    }
  }

  if (!lines.length) return null;
  const title = weekly ? "Η εβδομάδα σου" : lines.length === 1 ? "Μία υπενθύμιση" : `${lines.length} υπενθυμίσεις`;
  return { title, body: lines.slice(0, 6).join("\n"), count: lines.length };
}

// ---------- HTTP ----------
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: cfgRows } = await admin.from("app_config").select("key,value");
  const cfg: Record<string, string> = {};
  for (const r of cfgRows ?? []) cfg[r.key] = r.value;

  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

  const secret = url.searchParams.get("secret");
  const token = url.searchParams.get("token");

  // --- Λειτουργία χρήστη (preview / test) ---
  if (token) {
    const { data: tok } = await admin.from("ics_tokens").select("user_id").eq("token", token).maybeSingle();
    if (!tok) return json({ error: "unauthorized" }, 401);
    const { data: prefs } = await admin.from("notify_prefs").select("*").eq("user_id", tok.user_id).maybeSingle();
    const msg = await buildMessage(admin, tok.user_id, prefs?.lead_days ?? 1, url.searchParams.get("weekly") === "1");
    const mode = url.searchParams.get("mode") || "preview";
    if (mode === "preview") return json(msg ?? { title: null, body: "Δεν υπάρχει κάτι να σου θυμίσω.", count: 0 });

    const payload = msg ?? { title: "Όλα ήσυχα", body: "Δεν έχεις κάτι επείγον σήμερα.", count: 0 };
    const { data: pushSubs } = await admin.from("push_subscriptions").select("*").eq("user_id", tok.user_id);
    const results: number[] = [];
    for (const s of pushSubs ?? []) {
      try {
        const status = await sendPush(s, payload, cfg);
        results.push(status);
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else if (status < 300) await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e) {
        results.push(-1);
      }
    }
    return json({ sent: results.length, statuses: results, payload });
  }

  // --- Λειτουργία cron ---
  if (!secret || secret !== cfg.cron_secret) return json({ error: "unauthorized" }, 401);

  const nowAthens = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Athens" }));
  const hour = nowAthens.getHours();
  const todayIso = isoLocal(new Date(nowAthens.getFullYear(), nowAthens.getMonth(), nowAthens.getDate()));
  const dow = nowAthens.getDay();

  const { data: allPrefs } = await admin.from("notify_prefs").select("*").eq("enabled", true).eq("daily_hour", hour);
  let sent = 0, skipped = 0;

  for (const p of allPrefs ?? []) {
    const isWeekly = p.weekly_dow === dow && p.last_weekly !== todayIso;
    const isDaily = p.last_daily !== todayIso;
    if (!isDaily && !isWeekly) { skipped++; continue; }

    const msg = await buildMessage(admin, p.user_id, p.lead_days ?? 1, isWeekly);
    const update: Record<string, string> = {};
    if (isDaily) update.last_daily = todayIso;
    if (isWeekly) update.last_weekly = todayIso;
    await admin.from("notify_prefs").update(update).eq("user_id", p.user_id);

    if (!msg) { skipped++; continue; }
    const { data: pushSubs } = await admin.from("push_subscriptions").select("*").eq("user_id", p.user_id);
    for (const s of pushSubs ?? []) {
      try {
        const status = await sendPush(s, msg, cfg);
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else if (status < 300) { sent++; await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id); }
      } catch { /* συνεχίζουμε στις υπόλοιπες συσκευές */ }
    }
  }
  return json({ hour, sent, skipped });
});
