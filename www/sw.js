/* Deutsch Master Academy - offline support (PWA) */
var DM_CACHE = "german-academy-v29";
var DM_FILES = [
  "./", "./index.html", "./academy.html",
  "./style.css", "./reference.css", "./script.js", "./explain.js", "./learn.js", "./play.js", "./sentex.js", "./world.js", "./study.js",
  "./life.js", "./mygermany.js", "./dlife.js", "./glab.js", "./labsx.js", "./smart.js", "./adv.js",
  "./reference.js", "./reference-data-am.js", "./reference-data-bc.js", "./reference-data-d.js",
  "./reference-data-ef.js", "./reference-data-fw.js", "./reference-data-fx.js", "./reference-data-gj.js",
  "./reference-data-h.js", "./reference-data-hw.js", "./reference-data-i.js", "./reference-data-iw.js",
  "./reference-data-kl.js", "./reference-data-misc.js", "./reference-data-no.js", "./reference-data-p.js",
  "./life.js", "./mygermany.js", "./dlife.js", "./glab.js", "./labsx.js", "./smart.js", "./adv.js",
  "./curr-a2.js", "./curr-a1x.js", "./curr-a2b.js",
  "./curr-b1.js", "./curr-b1b.js", "./curr-b2.js", "./curr-b2b.js",
  "./curriculum.js",
  "./push.js",
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
  /* Navigations (HTML pages): network-first so users always get the latest
     release; fall back to cache when offline (PWA still works offline). */
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(function (res) {
      try {
        var copy = res.clone();
        caches.open(DM_CACHE).then(function (c) { try { c.put(e.request, copy); } catch (err) {} });
      } catch (err) {}
      return res;
    }).catch(function () {
      return caches.match("./index.html");
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (hit) {
    if (hit) return hit;
    return fetch(e.request).then(function (res) { return res; }).catch(function () {
      if (e.request.mode === "navigate") return caches.match("./index.html");
    });
  }));
});
/* ---------- Web Push (study reminders) ---------- */
self.addEventListener("push", function (e) {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (err) { try { d = { body: e.data.text() }; } catch (e2) {} }
  const title = d.title || "Deutsch Master";
  const body = d.body || "🇩🇪 وقت المذاكرة!";
  const url = d.url || "./index.html?utm=push";
  e.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: d.tag || "dm-study",
    data: { url: url }
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./index.html?utm=push";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if ("focus" in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
