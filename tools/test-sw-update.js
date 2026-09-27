/* Deutsch Master — SW update/caching simulation test.
   Simulates the acceptance scenario with stubbed Cache Storage + network:
   OLD app cached -> NEW release published -> NORMAL reload (no hard refresh)
   -> new content must be served; offline must still work (PWA preserved).
   Exit 0 = PASS. Usage: node tools/test-sw-update.js
*/
const fs = require("fs");
const path = require("path");
const CDIR = path.join(__dirname, "..", "client");
let fails = 0;
function bad(m) { fails++; console.log("FAIL " + m); }
function good(m) { console.log("PASS " + m); }

/* ---------- stubs ---------- */
const listeners = {};
const store = {};
let claimed = false, skipped = false;
function mkRes(body) { return { body: body, clone() { return mkRes(body); } }; }
const netFiles = {}; // url-suffix -> body (the "server": NEW release)
let offline = false;
function N(u) { // browser-like URL resolution against fake origin
  u = String(u);
  if (u.startsWith("./")) return "https://app/" + u.slice(2);
  if (u.startsWith("/")) return "https://app" + u;
  return u;
}
function stubFetch(input) {
  let url = N(typeof input === "string" ? input : input.url);
  if (url === "https://app/") url = "https://app/index.html"; // scope root resolves like a browser
  return new Promise((resolve, reject) => {
    if (offline) return reject(new Error("offline"));
    const key = Object.keys(netFiles).find(k => url === N(k) || url.endsWith("/" + k.replace(/^\.\//, "")));
    if (key !== undefined) return resolve(mkRes(netFiles[key]));
    return resolve(mkRes("NET:" + url)); // server hosts every app file
  });
}
function fakeCache(name) {
  if (!store[name]) store[name] = new Map();
  const m = store[name];
  return {
    put(req, res) { const u = N(typeof req === "string" ? req : req.url); m.set(u, res && res.body !== undefined ? res.body : res); return Promise.resolve(); },
    match(req) {
      const u = N(typeof req === "string" ? req : req.url);
      for (const [k, v] of m) if (k === u) return Promise.resolve(mkRes(v));
      return Promise.resolve(undefined);
    },
    addAll(list) { return Promise.all(list.map(u => stubFetch(u).then(r => m.set(u, r.body)))); }
  };
}
global.self = {
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  skipWaiting() { skipped = true; return Promise.resolve(); },
  location: { href: "https://app/sw.js" },
  clients: { claim() { claimed = true; return Promise.resolve(); } }
};
global.caches = {
  open(name) { return Promise.resolve(fakeCache(name)); },
  keys() { return Promise.resolve(Object.keys(store)); },
  delete(name) { delete store[name]; return Promise.resolve(true); },
  match(req) {
    const u = N(typeof req === "string" ? req : req.url);
    for (const n of Object.keys(store)) {
      const m = store[n];
      if (m.has(u)) return Promise.resolve(mkRes(m.get(u)));
    }
    return Promise.resolve(undefined);
  }
};
global.fetch = stubFetch;

/* ---------- load REAL sw.js ---------- */
const swSrc = fs.readFileSync(path.join(CDIR, "sw.js"), "utf8");
try {
  new Function("self", "caches", "fetch", swSrc)(global.self, global.caches, stubFetch);
  good("sw.js loads with stubs");
} catch (e) { bad("sw load: " + e.message); process.exit(1); }
function fire(type, ev) {
  let waited = null, responded = null;
  const e = Object.assign({
    waitUntil(p) { waited = p; },
    respondWith(p) { responded = p; }
  }, ev);
  (listeners[type] || []).forEach(fn => fn(e));
  return { waited, responded };
}

(async () => {
  /* server hosts the NEW release */
  netFiles["./index.html"] = "<html>NEW-INDEX</html>";
  netFiles["sw.js"] = "vNEW";
  netFiles["script.js"] = "NEW-SCRIPT";
  netFiles["style.css"] = "NEW-STYLE";
  netFiles["icons/icon-192.png"] = "IMG";

  /* 1. install populates cache (offline completeness) */
  await fire("install", {}).waited;
  const names = [...(store[Object.keys(store).find(k => k.startsWith("german-academy-"))] || new Map()).keys()];
  ["./index.html", "script.js", "style.css"].forEach(f => {
    const tail = f.startsWith("./") ? f.slice(1) : "/" + f;
    if (names.some(k => k === f || k.endsWith(tail))) good("install caches " + f);
    else bad("install missing " + f);
  });
  if (!skipped) bad("skipWaiting not called"); else good("skipWaiting called");

  /* 2. old cache exists -> activate must delete it + claim */
  store["german-academy-vOLD"] = new Map([["./index.html", "<html>OLD</html>"]]);
  await fire("activate", {}).waited;
  if (store["german-academy-vOLD"]) bad("old cache NOT deleted");
  else good("old cache deleted on activate");
  if (!claimed) bad("clients.claim missing"); else good("clients.claim called");

  const cur = Object.keys(store).find(k => k.startsWith("german-academy-"));
  /* 3. acceptance: STALE cache + NEW deploy + NORMAL reload -> NEW served */
  store[cur].set("script.js", "OLD-SCRIPT");
  store[cur].set("./index.html", "<html>OLD-INDEX</html>");
  async function load(mode, dest, url) {
    const r = fire("fetch", { request: { method: "GET", mode, destination: dest, url } });
    const res = await r.responded;
    return res && res.body;
  }
  const navBody = await load("navigate", "document", "https://app/index.html");
  if (navBody === "<html>NEW-INDEX</html>") good("normal reload serves NEW index.html (no hard refresh)");
  else bad("navigate served stale: " + navBody);
  const jsBody = await load("no-cors", "script", "https://app/script.js");
  if (jsBody === "NEW-SCRIPT") good("normal reload serves NEW script.js (no hard refresh)");
  else bad("script served stale: " + jsBody);
  const cssBody = await load("no-cors", "style", "https://app/style.css");
  if (cssBody === "NEW-STYLE") good("normal reload serves NEW style.css");
  else bad("css served stale: " + cssBody);
  const imgBody = await load("no-cors", "image", "https://app/icons/icon-192.png");
  if (imgBody === "IMG") good("images still served (cache-first)");
  else bad("image broken: " + imgBody);

  /* 4. offline: PWA fallback intact */
  offline = true;
  const offNav = await load("navigate", "document", "https://app/index.html");
  if (offNav && offNav.includes("INDEX")) good("offline navigation falls back to cache (PWA preserved)");
  else bad("offline navigation broken");
  const offJs = await load("no-cors", "script", "https://app/script.js");
  if (offJs) good("offline script falls back to cache");
  else bad("offline script broken");
  const offVer = await load("no-cors", "script", "https://app/script.js?v=abc1234");
  if (offVer === offJs && offVer) good("offline versioned URL falls back to precached copy");
  else bad("offline versioned fallback broken: " + offVer);
  offline = false;

  console.log("----");
  if (fails) { console.log("RESULT: FAIL (" + fails + ")"); process.exit(1); }
  console.log("RESULT: PASS");
})().catch(e => { console.log("FAIL harness: " + (e && e.message)); process.exit(1); });
