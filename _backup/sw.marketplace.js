/* Deutsch Master Marketplace - offline support (PWA) */
var DM_CACHE = "dmm-v2";
var DM_FILES = [
  "./", "./index.html", "./academy.html",
  "./css/tokens.css", "./css/app.css",
  "./js/utils.js", "./js/i18n.js", "./js/local.js", "./js/api.js",
  "./js/app.js", "./js/pages-shop.js", "./js/dashboards.js",
  "./style.css", "./script.js", "./explain.js",
  "./launch.css", "./launch.js",
  "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(DM_CACHE).then(function (c) { return c.addAll(DM_FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { if (k !== DM_CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    if (hit) return hit;
    return fetch(e.request).then(function (res) { return res; }).catch(function () {
      if (e.request.mode === "navigate") return caches.match("./index.html");
    });
  }));
});
