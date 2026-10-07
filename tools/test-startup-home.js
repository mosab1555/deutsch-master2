/* Deutsch Master - always-start-on-Home regression tests.
 * Contract: every fresh app/site launch MUST open the main Home page
 * (dashboard / الرئيسية), while ALL user data and auth state stay intact.
 *  1. Fresh launch opens Home.
 *  2. Previous page is NOT restored on fresh launch.
 *  3. Navigation during the current session still works.
 *  4. User progress remains intact.
 *  5. Authentication remains intact.
 *  6. deutsch_master_v2 remains intact.
 *  7. Supabase session remains intact.
 *  8. PWA launch opens Home.
 *  9. Capacitor/Android launch opens Home.
 * 10. Back navigation still works.
 * 11. Bottom navigation still works.
 * 12. Sidebar navigation still works.
 * 13. No localStorage.clear() is introduced.
 * 14. No learning data is deleted.
 * 15. No logout occurs during startup.
 * Usage: node tools/test-startup-home.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");
let pass = 0, fail = 0;
function check(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

const psSrc = RD("client/page-state.js");
const bhSrc = RD("client/back-handler.js");
const scriptSrc = RD("client/script.js");
const appInitSrc = RD("client/app-init.js");
const authSrc = RD("client/auth.js");
const indexHtml = RD("client/index.html");

/* ---------- sandbox for page-state.js (mirrors test-fresh-launch.js) ---------- */
function mkEl(id, tag, value) {
  const el = {
    nodeType: 1, tagName: (tag || "INPUT").toUpperCase(),
    attrs: { id: id }, children: [], parent: null, listeners: {},
    get id() { return this.attrs.id || ""; },
    type: "text", _value: value !== undefined ? String(value) : "",
    checked: false, disabled: false, classSet: new Set(), dataset: {},
    options: [], get value() { return this._value; }, set value(v) { this._value = String(v); },
    getAttribute(n) { return this.attrs[n] !== undefined ? this.attrs[n] : null; },
    setAttribute(n, v) { this.attrs[n] = String(v); },
    classList: null, style: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    closest(sel) { if (sel === ".page") return this._sec || null; return null; },
    querySelectorAll() { return []; }, querySelector() { return null; }
  };
  el.classList = {
    add: (...c) => c.forEach(x => el.classSet.add(x)),
    remove: (...c) => c.forEach(x => el.classSet.delete(x)),
    toggle: (c, f) => { const on = f === undefined ? !el.classSet.has(c) : !!f; if (on) el.classSet.add(c); else el.classSet.delete(c); return on; },
    contains: c => el.classSet.has(c)
  };
  return el;
}
function mkSection(name, kids, active) {
  const sec = { nodeType: 1, tagName: "SECTION", attrs: { id: "page-" + name }, children: kids || [], classSet: new Set(active ? ["active"] : []) };
  Object.defineProperty(sec, "id", { get() { return this.attrs.id || ""; } });
  sec.classList = {
    add: (...c) => c.forEach(x => sec.classSet.add(x)),
    remove: (...c) => c.forEach(x => sec.classSet.delete(x)),
    toggle: (c, f) => { const on = f === undefined ? !sec.classSet.has(c) : !!f; if (on) sec.classSet.add(c); else sec.classSet.delete(c); return on; },
    contains: c => sec.classSet.has(c)
  };
  sec.querySelectorAll = () => sec.children.slice();
  sec.querySelector = () => null;
  sec.children.forEach(k => { k._sec = sec; });
  return sec;
}
/* One sandbox = one fresh document load. `disk` simulates everything the
 * previous app instance left behind (navigation state + user data + auth). */
function bootPS(disk, preHash, extraEnv) {
  const store = Object.assign({}, disk || {});
  const sections = {}, byId = {};
  function regSec(name, kids, active) {
    const s = mkSection(name, kids || [], active);
    sections[name] = s;
    (kids || []).forEach(k => { if (k.attrs && k.attrs.id) byId[k.attrs.id] = k; });
    return s;
  }
  ["dashboard", "vocab", "sentences", "flashcards", "verbs", "grammar",
   "explain", "reference", "quiz", "review", "auth"].forEach(n =>
    regSec(n, n === "vocab" ? [mkEl("vocabSearch", "input", "")] : [], n === "dashboard"));
  const listeners = {};
  let replacedTo = null;
  const scrolled = [];
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    setTimeout: () => 0, clearTimeout: () => {},
    requestAnimationFrame: fn => { try { fn(); } catch (e) {} return 1; },
    location: { hash: preHash || "", pathname: "/index.html", search: "" },
    history: { replaceState: (a, b, url) => { replacedTo = url; }, scrollRestoration: "auto" },
    HW: { q: "", cat: "all", open: null, _force: 0 },
    document: {
      getElementById: id => byId[id] || null,
      querySelector: sel => {
        if (sel === ".page.active") return Object.values(sections).find(s => s.classSet.has("active")) || null;
        const m = sel.match(/^#page-([\w-]+)$/);
        if (m) return sections[m[1]] || null;
        return null;
      },
      querySelectorAll: sel => {
        if (sel === ".page") return Object.values(sections);
        if (sel === ".nav-item") return [];
        return [];
      },
      documentElement: { scrollTop: 0, scrollHeight: 3000 },
      body: { scrollTop: 0, scrollHeight: 3000 },
      addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }
    },
    _store: store, _sections: sections,
    get _replacedTo() { return replacedTo; },
    _scrolled: scrolled
  };
  Object.assign(sandbox, extraEnv || {});
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.scrollTo = (x, y) => { scrolled.push(typeof x === "object" ? (x.top || 0) : (y === undefined ? x : y)); };
  sandbox.window.pageYOffset = 0; sandbox.window.scrollY = 0; sandbox.window.innerHeight = 800;
  sandbox.window.addEventListener = (t, f) => { (listeners["win:" + t] = listeners["win:" + t] || []).push(f); };
  vm.createContext(sandbox);
  vm.runInContext(
    "var showPage=function(n){return 'nav:'+n;};" +
    "var vocabLimit=60, flashIdx=0, sentA1Limit=20, quizType='mixed', reviewDir='de-ar';" +
    "var currSentLevel='all', activeSentenceTraining='all', activePracticeTraining='all';" +
    "var refState={path:null,topic:null};",
    sandbox);
  try { vm.runInContext(psSrc, sandbox, { filename: "page-state.js" }); sandbox._loadOk = true; }
  catch (e) { sandbox._loadOk = false; sandbox._loadErr = e && e.message; }
  return sandbox;
}
function js(sb, expr) { return vm.runInContext(expr, sb); }

/* Durable records a previous instance may have left on disk. */
function priorDisk() {
  return {
    "deutsch_master_v2": JSON.stringify({ xp: 1234, favs: ["w1"], streak: { count: 7, last: "2026-10-06", longest: 9 }, settings: { theme: "dark" } }),
    "deutsch_master_v2:uid:USER-1": JSON.stringify({ xp: 999, favs: ["w9"] }),
    "deutsch_master_v2:backup:pre-identity": JSON.stringify({ xp: 5 }),
    "deutsch_master_pagestate_v1": JSON.stringify({ v: 1, savedAt: 1, pages: { grammar: { scroll: 800, fields: {}, tabs: {}, custom: {} } } }),
    "dm_lastview_v1": JSON.stringify({ v: 1, page: "grammar", scroll: 800, ts: Date.now() }),
    "dm_device_id": "dev-1",
    "dm_welcomed": "1",
    "dm_sync_queue": JSON.stringify([{ op: "save" }]),
    "dm_push_claim": "1728000000000",
    "sb-ref-auth-token": JSON.stringify({ access_token: "tok", user: { id: "USER-1" } })
  };
}

/* ---------- 1: fresh launch opens Home ---------- */
(function () {
  const sb = bootPS(priorDisk(), "");
  check("1: module loads", !!sb._loadOk, sb._loadErr);
  check("1: fresh launch opens Home", js(sb, "DMPageState.current==='dashboard'"));
  check("1: dashboard shell active", sb._sections.dashboard.classSet.has("active"));
  check("1: no other section active",
    ["vocab", "grammar", "flashcards", "quiz"].every(n => !sb._sections[n].classSet.has("active")));
})();

/* ---------- 2: previous page is NOT restored ---------- */
(function () {
  const sb = bootPS(priorDisk(), "");
  const calls = [];
  sb.__calls = calls;
  vm.runInContext("window.showPage=function(n){__calls.push(n);return 'nav:'+n;};", sb);
  check("2: stale last-view purged", !("dm_lastview_v1" in sb._store));
  check("2: transient pagestate purged", !("deutsch_master_pagestate_v1" in sb._store));
  check("2: restore hook never navigates",
    js(sb, "DMPageState.tryRestoreLastView('early')") === false &&
    js(sb, "DMPageState.tryRestoreLastView('late')") === false && calls.length === 0);
  check("2: still on Home after restore window", js(sb, "DMPageState.current==='dashboard'"));
})();

/* ---------- 3: in-session navigation still works ---------- */
(function () {
  const sb = bootPS(priorDisk(), "");
  js(sb, "DMPageState.current='dashboard'; showPage('vocab');");
  js(sb, "document.getElementById('vocabSearch').value='Haus'; DMPageState.current='vocab'; showPage('grammar');");
  js(sb, "DMPageState.current='grammar'; showPage('flashcards');");
  js(sb, "DMPageState.current='flashcards'; showPage('vocab');");
  check("3: session navigates across pages", js(sb, "DMPageState.current==='vocab'"));
  check("3: in-session page state preserved", js(sb, "DMPageState.mem.vocab.fields.vocabSearch==='Haus'"));
  check("3: no last-view written while navigating", !("dm_lastview_v1" in sb._store));
})();

/* ---------- 4/6/14: progress + main store + learning data intact ---------- */
(function () {
  const disk = priorDisk();
  const sb = bootPS(disk, "");
  js(sb, "DMPageState.current='dashboard'; showPage('vocab'); showPage('grammar');");
  check("4: user progress remains intact", sb._store["deutsch_master_v2"] === disk["deutsch_master_v2"]);
  check("6: deutsch_master_v2 remains intact", sb._store["deutsch_master_v2"] === disk["deutsch_master_v2"]);
  check("14: per-account snapshot untouched", sb._store["deutsch_master_v2:uid:USER-1"] === disk["deutsch_master_v2:uid:USER-1"]);
  check("14: pre-identity backup untouched", sb._store["deutsch_master_v2:backup:pre-identity"] === disk["deutsch_master_v2:backup:pre-identity"]);
  check("14: sync queue untouched", sb._store["dm_sync_queue"] === disk["dm_sync_queue"]);
  check("14: device/welcome flags untouched",
    sb._store["dm_device_id"] === "dev-1" && sb._store["dm_welcomed"] === "1");
})();

/* ---------- 5/7/15: auth + Supabase session intact, no logout ---------- */
(function () {
  const disk = priorDisk();
  const sb = bootPS(disk, "");
  check("5: authentication record intact", sb._store["sb-ref-auth-token"] === disk["sb-ref-auth-token"]);
  check("7: Supabase session intact", sb._store["sb-ref-auth-token"] === disk["sb-ref-auth-token"]);
  const bootFiles = [psSrc, bhSrc];
  const stripped = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  check("15: navigation layer never signs out",
    !bootFiles.some(s => /signOut|sign-out|logout/i.test(stripped(s).replace(/clearPageState|closeTopOverlay/g, ""))));
  const hsIdx = appInitSrc.indexOf("function handleSession");
  const hs = hsIdx >= 0 ? appInitSrc.slice(hsIdx, hsIdx + 2600) : "";
  check("15: startup never logs out (identity-gated session handler)",
    /if\s*\(\s*uid\s*===\s*lastUid\s*\)/.test(hs) && /\.signOut\s*\(/.test(hs) === false);
  check("5: auth module owns sign-out only via user action",
    /logoutBtn/.test(appInitSrc) && /AuthModule\.signOut|AuthModule\.init/.test(authSrc + appInitSrc));
})();

/* ---------- 8: PWA launch opens Home ---------- */
(function () {
  // Installed-PWA launch = a fresh document load through the same central
  // handler (service worker serves the shell; no navigation state survives).
  const sb = bootPS(priorDisk(), "", { navigator: { serviceWorker: { ready: {} } } });
  check("8: PWA launch opens Home", !!sb._loadOk && js(sb, "DMPageState.current==='dashboard'"));
  check("8: PWA launch restores no page", !("dm_lastview_v1" in sb._store) && !("deutsch_master_pagestate_v1" in sb._store));
})();

/* ---------- 9: Capacitor/Android launch opens Home ---------- */
(function () {
  const sb = bootPS(priorDisk(), "", {
    Capacitor: { Plugins: { App: { addListener: function () {}, exitApp: function () {} } } }
  });
  check("9: Capacitor launch opens Home", !!sb._loadOk && js(sb, "DMPageState.current==='dashboard'"));
  check("9: Capacitor launch restores no page", !("dm_lastview_v1" in sb._store));
})();

/* ---------- 9b/10: Android back stack starts at Home, back still navigates ---------- */
function bootBack() {
  const sections = {};
  ["dashboard", "vocab", "grammar"].forEach(n => {
    sections[n] = { attrs: { id: "page-" + n }, classSet: new Set(n === "dashboard" ? ["active"] : []) };
    Object.defineProperty(sections[n], "id", { get() { return this.attrs.id || ""; } });
    sections[n].classList = {
      add: (...c) => c.forEach(x => sections[n].classSet.add(x)),
      remove: (...c) => c.forEach(x => sections[n].classSet.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !sections[n].classSet.has(c) : !!f; if (on) sections[n].classSet.add(c); else sections[n].classSet.delete(c); return on; },
      contains: c => sections[n].classSet.has(c)
    };
  });
  const listeners = {};
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn) => 0, clearTimeout: () => {},
    Capacitor: { Plugins: { App: { addListener: function () { return Promise.resolve(); }, exitApp: function () {} } } },
    navigator: {},
    document: {
      hidden: false,
      getElementById: () => null,
      querySelector: sel => {
        if (sel === ".page.active") return Object.values(sections).find(s => s.classSet.has("active")) || null;
        const m = sel.match(/^#page-([\w-]+)$/);
        if (m) return sections[m[1]] || null;
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }
    },
    _sections: sections
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.showPage = function (n) {
    Object.values(sections).forEach(s => s.classSet.delete("active"));
    if (sections[n]) sections[n].classSet.add("active");
    return "nav:" + n;
  };
  sandbox.showPage = sandbox.window.showPage;
  sandbox.window.addEventListener = (t, f) => { (listeners["win:" + t] = listeners["win:" + t] || []).push(f); };
  vm.createContext(sandbox);
  try { vm.runInContext(bhSrc, sandbox, { filename: "back-handler.js" }); sandbox._loadOk = true; }
  catch (e) { sandbox._loadOk = false; sandbox._loadErr = e && e.message; }
  return sandbox;
}
(function () {
  const sb = bootBack();
  check("9b: back-handler loads", !!sb._loadOk, sb._loadErr);
  check("9b: Android stack starts at Home", JSON.stringify(js(sb, "DMBack.stackSnapshot()")) === JSON.stringify(["dashboard"]));
  check("9b: fresh launch is at root", js(sb, "DMBack.isAtRoot()") === true);
  js(sb, "window.showPage('vocab'); window.showPage('grammar');");
  check("10: in-app history observed", JSON.stringify(js(sb, "DMBack.stackSnapshot()")) === JSON.stringify(["dashboard", "vocab", "grammar"]));
  check("10: back navigates to previous page", js(sb, "DMBack.handleBack()") === "navigated");
  check("10: back lands on vocab", sb._sections.vocab.classSet.has("active"));
  check("10: back at root asks for exit, never navigates away",
    js(sb, "DMBack.handleBack()") === "navigated" && js(sb, "DMBack.handleBack()") === "exit-toast");
})();

/* ---------- 11: bottom navigation still works ---------- */
(function () {
  check("11: bottom-nav items exist for Home", /dm-bnav-item[^>]*data-page="dashboard"/.test(indexHtml));
  check("11: bottom-nav covers core sections",
    ["vocab", "flashcards", "quiz"].every(p => indexHtml.indexOf('data-page="' + p + '"') >= 0));
  check("11: nav items drive showPage",
    /querySelectorAll\(["']\.nav-item["']\)/.test(scriptSrc) && /\.dataset\.page/.test(scriptSrc));
  check("11: showPage syncs bottom-nav highlight", /dm-bnav-item/.test(RD("client/dm-ultimate.js")));
})();

/* ---------- 12: sidebar navigation still works ---------- */
(function () {
  check("12: sidebar hosts nav items", /id="sidebar"[\s\S]{0,2000}data-page="dashboard"/.test(indexHtml));
  check("12: single drawer authority present",
    /window\.DMDrawer=\{open,close,toggle,isOpen\}/.test(scriptSrc));
  check("12: showPage closes drawer (no nav trap)", /DMDrawer&&typeof window\.DMDrawer\.close/.test(scriptSrc));
})();

/* ---------- 13: no localStorage.clear() introduced ---------- */
(function () {
  const files = ["client/page-state.js", "client/script.js", "client/app-init.js",
    "client/back-handler.js", "client/launch.js", "client/auth.js", "client/cloud-sync.js"];
  const bad = files.filter(f => {
    const code = RD(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    return /localStorage\s*\.\s*clear\s*\(/.test(code) || /sessionStorage\s*\.\s*clear\s*\(/.test(code);
  });
  check("13: no storage.clear() anywhere in startup path", bad.length === 0, bad.join(","));
})();

console.log("----");
if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
console.log("RESULT: PASS (" + pass + ")");
