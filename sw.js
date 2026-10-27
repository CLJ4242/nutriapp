// Service worker : cache de l'app shell + données, stratégie cache-first.
const CACHE = "nutriapp-v10";
const ASSETS = [
  ".",
  "index.html",
  "app.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/ui.js",
  "js/store.js",
  "js/parse.js",
  "js/saison.js",
  "js/planner.js",
  "js/courses.js",
  "js/regimes/index.js",
  "js/regimes/samaras.js",
  "data/aliments.json",
  "data/recettes.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(cles =>
      Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(resp => {
        const copie = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copie)).catch(() => {});
        return resp;
      }).catch(() => caches.match("index.html"));
    })
  );
});
