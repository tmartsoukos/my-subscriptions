// Εγγραφή και διαχείριση ειδοποιήσεων push.
import { sb } from "./db.js";
import { VAPID_PUBLIC_KEY } from "./config.js";

const b64urlToBytes = s => {
  const pad = (s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
};
const bytesToB64url = buf =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// Σε iPhone δουλεύει μόνο όταν η εφαρμογή έχει προστεθεί στην αρχική οθόνη
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? await reg.pushManager.getSubscription() : null;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("Η συσκευή δεν υποστηρίζει ειδοποιήσεις.");
  if (isIOS() && !isStandalone()) {
    throw new Error("Στο iPhone πρόσθεσε πρώτα την εφαρμογή στην αρχική οθόνη.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Δεν δόθηκε άδεια για ειδοποιήσεις.");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlToBytes(VAPID_PUBLIC_KEY)
    });
  }
  const json = sub.toJSON();
  const { error } = await sb.from("push_subscriptions").upsert({
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    label: navigator.userAgent.slice(0, 60)
  }, { onConflict: "endpoint" });
  if (error) throw error;

  // Εξασφάλισε ότι υπάρχει γραμμή προτιμήσεων
  await sb.from("notify_prefs").upsert({ enabled: true }, { onConflict: "user_id" });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

export async function getPrefs() {
  const { data } = await sb.from("notify_prefs").select("*").maybeSingle();
  return data || { enabled: false, daily_hour: 8, weekly_dow: 0, lead_days: 2 };
}

export async function savePrefs(patch) {
  const { error } = await sb.from("notify_prefs").upsert(patch, { onConflict: "user_id" });
  if (error) throw error;
}
