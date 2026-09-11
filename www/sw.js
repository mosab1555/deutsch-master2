/* Deutsch Master Academy - offline support (PWA) */
var DM_CACHE = "german-academy-v14";
var DM_FILES = [
  "./", "./index.html", "./academy.html",
  "./style.css", "./script.js", "./explain.js", "./learn.js", "./play.js", "./world.js", "./study.js",
  "./life.js", "./mygermany.js", "./dlife.js", "./glab.js",
  "./launch.css", "./launch.js",
  "./manifest.json",
  "./img/words/6.jpeg", "./img/words/7.jpeg", "./img/words/9.jpeg", "./img/words/10.jpeg",
  "./img/words/11.jpeg", "./img/words/12.jpeg", "./img/words/25.jpeg",
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
