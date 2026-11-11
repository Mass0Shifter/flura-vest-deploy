// Minimal service worker: caches static assets for an installable, fast-loading shell.
// API calls (anything under /api) are never cached and never queued offline: money actions need a live connection.
const CACHE = "fv-static-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/favicon.svg", "/icon-192.png", "/brand/fluravest-horizontal-no-tagline-color.svg"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api")) return;
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/brand") || /\.(png|svg|ico|ttf|woff2)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })));
  }
});
