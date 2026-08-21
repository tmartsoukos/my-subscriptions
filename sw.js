const CACHE = "dash-v12";
const ASSETS = [
  "./", "index.html", "manifest.json", "icon-192.png", "icon-512.png",
  "css/app.css",
  "js/main.js", "js/config.js", "js/db.js", "js/ui.js", "js/router.js", "js/charts.js",
  "js/logos.js", "js/voice.js", "js/markdown.js", "js/theme.js", "js/push.js", "js/skeleton.js",
  "js/badge.js", "js/scrolltop.js", "js/prefs.js",
  "js/views/dashboard.js", "js/views/subscriptions.js", "js/views/todos.js",
  "js/views/calendar.js", "js/views/notes.js", "js/views/settings.js",
  "js/views/watchlist.js", "js/views/more.js", "js/views/studies.js", "js/views/health.js",
  "js/views/finance.js",
  "js/vendor/supabase.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- Ειδοποιήσεις push ----
self.addEventListener("push", e => {
  let data = { title: "Το Dashboard μου", body: "" };
  try { if (e.data) data = e.data.json(); } catch { if (e.data) data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title || "Το Dashboard μου", {
    body: data.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: "dashboard-digest",
    renotify: true,
    data: { url: data.url || "./" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "./", self.location.href).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); return; }
    }
    await self.clients.openWindow(target);
  })());
});

// Network first, cache fallback — μόνο για same-origin GET (τα Supabase requests περνούν κατευθείαν)
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
