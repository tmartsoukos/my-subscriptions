const CACHE = "dash-v2";
const ASSETS = [
  "./", "index.html", "manifest.json", "icon-192.png", "icon-512.png",
  "css/app.css",
  "js/main.js", "js/config.js", "js/db.js", "js/ui.js", "js/router.js", "js/charts.js",
  "js/views/dashboard.js", "js/views/subscriptions.js", "js/views/todos.js",
  "js/views/calendar.js", "js/views/notes.js", "js/views/settings.js",
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
