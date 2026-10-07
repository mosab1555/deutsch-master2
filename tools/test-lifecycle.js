/* Deutsch Master - lifecycle / resume / crash-recovery regression tests.
 * Covers the background-resume contract:
 *  - backgrounding never resets the live session (no destructive handlers)
 *  - same-account auth refreshes never navigate (no dashboard yank)
 *  - last logical view is recorded, validated and restored after process death
 *  - stale/invalid/OAuth/auth-flow views are never restored
 *  - challenge per-question clock freezes while hidden (no unfair timeout)
 *  - test navigation position is persisted (no counter loss)
 *  - bottom-nav poll reads live state (no stale highlight, no bg work)
 *  - diagnostics capture errors without UI, storage or user data
 * Usage: node tools/test-lifecycle.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");
let pass = 0, fail = 0;
function check(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

const psSrc = RD("client/page-state.js");
const appInitSrc = RD("client/app-init.js");
const assessSrc = RD("client/assess.js");
const ultSrc = RD("client/dm-ultimate.js");

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
function bootPS(preStore, preHash, preSearch) {
  const store = {};
  if (preStore) store["deutsch_master_pagestate_v1"] = preStore;
  Object.keys(preStore && preStore._extra || {}).forEach(k => { store[k] = preStore._extra[k]; });
  const sections = {}, byId = {};
  function regSec(name, kids, active) {
    const s = mkSection(name, kids || [], active);
    sections[name] = s;
    (kids || []).forEach(k => { if (k.attrs && k.attrs.id) byId[k.attrs.id] = k; });
    return s;
  }
  regSec("dashboard", [], true);
  regSec("vocab", [mkEl("vocabSearch", "input", "")]);
  regSec("quiz", []);
  regSec("auth", []);
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
    location: { hash: preHash || "", pathname: "/index.html", search: preSearch || "" },
    history: { replaceState: (a, b, url) => { replacedTo = url; }, scrollRestoration: "auto" },
    HW: { open: null, _force: 0 },
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

/* ---------- L1: last view recorded on navigation ---------- */
(function () {
  const sb = bootPS();
  check("L1: module loads", !!sb._loadOk, sb._loadErr);
  js(sb, "DMPageState.current='dashboard'; showPage('quiz');");
  let raw = sb._store["dm_lastview_v1"];
  let ok = false;
  try { const o = JSON.parse(raw); ok = o.v === 1 && o.page === "quiz" && typeof o.ts === "number"; } catch (e) {}
  check("L1: navigating records last view", ok, raw);
  js(sb, "showPage('dashboard');");
  check("L1: dashboard never recorded", (function () {
    try { return JSON.parse(sb._store["dm_lastview_v1"]).page === "quiz"; } catch (e) { return false; }
  })());
  js(sb, "showPage('auth');");
  check("L1: auth screen never recorded", (function () {
    try { return JSON.parse(sb._store["dm_lastview_v1"]).page === "quiz"; } catch (e) { return false; }
  })());
  js(sb, "showPage('no-such-page');");
  check("L1: invalid page never recorded", (function () {
    try { return JSON.parse(sb._store["dm_lastview_v1"]).page === "quiz"; } catch (e) { return false; }
  })());
})();

/* ---------- L2: malformed / stale records rejected ---------- */
(function () {
  function readWith(raw) {
    const sb = bootPS();
    if (raw === null) delete sb._store["dm_lastview_v1"];
    else sb._store["dm_lastview_v1"] = raw;
    return js(sb, "DMPageState.readLastView()");
  }
  check("L2: garbage rejected", readWith("{{{nope") === null);
  check("L2: wrong version rejected", readWith(JSON.stringify({ v: 99, page: "quiz", ts: Date.now() })) === null);
  check("L2: unknown page rejected", readWith(JSON.stringify({ v: 1, page: "quiz", _x: 1, ts: Date.now() })) !== null); // sanity: known page ok
  const sbU = bootPS();
  sbU._store["dm_lastview_v1"] = JSON.stringify({ v: 1, page: "no-such-page", ts: Date.now() });
  check("L2: nonexistent section rejected", js(sbU, "DMPageState.readLastView()") === null);
  const sbD = bootPS();
  sbD._store["dm_lastview_v1"] = JSON.stringify({ v: 1, page: "dashboard", ts: Date.now() });
  check("L2: dashboard never restored", js(sbD, "DMPageState.readLastView()") === null);
  const sbS = bootPS();
  sbS._store["dm_lastview_v1"] = JSON.stringify({ v: 1, page: "quiz", scroll: 500, ts: Date.now() - 31 * 86400000 });
  check("L2: stale record rejected", js(sbS, "DMPageState.readLastView()") === null);
  const sbM = bootPS();
  delete sbM._store["dm_lastview_v1"];
  check("L2: absent record is null", js(sbM, "DMPageState.readLastView()") === null);
})();

/* ---------- L3: fresh boot restores the recorded view ---------- */
(function () {
  const sbA = bootPS();
  js(sbA, "DMPageState.current='dashboard'; showPage('quiz');");
  const saved = sbA._store["dm_lastview_v1"];
  const sbB = bootPS();
  sbB._store["dm_lastview_v1"] = saved;
  const calls = [];
  // NOTE: window === globalThis in the sandbox, so window.showPage alone is
  // the hook tryRestoreLastView reads. Do NOT reassign bare showPage here:
  // that would clobber the capture with a self-recursive relay.
  vm.runInContext("window.showPage=function(n){__restored.push(n);return 'nav:'+n;};", sbB);
  sbB.__restored = calls;
  const r = js(sbB, "DMPageState.tryRestoreLastView('late')");
  check("L3: recorded view restored on fresh boot", r === true && calls.indexOf("quiz") >= 0, JSON.stringify(calls));
  check("L3: restore is single-shot", js(sbB, "DMPageState.tryRestoreLastView('late')") === false && calls.length === 1);
})();

/* ---------- L4: restore never fights explicit flows ---------- */
(function () {
  const sb = bootPS(null, "", "?code=abc123");
  sb._store["dm_lastview_v1"] = JSON.stringify({ v: 1, page: "quiz", ts: Date.now() });
  const calls = [];
  sb.__restored = calls;
  vm.runInContext("window.showPage=function(n){__restored.push(n);return 'nav:'+n;};", sb);
  check("L4: OAuth callback blocks restore", js(sb, "DMPageState.tryRestoreLastView('late')") === false && calls.length === 0);
  const sb2 = bootPS();
  sb2._store["dm_lastview_v1"] = JSON.stringify({ v: 1, page: "quiz", ts: Date.now() });
  // simulate recovery/auth screen active instead of dashboard
  sb2._sections.dashboard.classSet.delete("active");
  sb2._sections.auth.classSet.add("active");
  const calls2 = [];
  sb2.__restored = calls2;
  vm.runInContext("window.showPage=function(n){__restored.push(n);return 'nav:'+n;};", sb2);
  check("L4: non-dashboard foreground blocks restore", js(sb2, "DMPageState.tryRestoreLastView('late')") === false && calls2.length === 0);
})();

/* ---------- L5: wipe clears the last view ---------- */
(function () {
  const sb = bootPS();
  js(sb, "DMPageState.current='dashboard'; showPage('quiz');");
  const had = !!sb._store["dm_lastview_v1"];
  js(sb, "DMPageState.clearPageState();");
  check("L5: full wipe clears last view", had && !sb._store["dm_lastview_v1"]);
})();

/* ---------- L6: same-account refresh never navigates ---------- */
(function () {
  const h = appInitSrc;
  const hsIdx = h.indexOf("function handleSession");
  const hs = hsIdx >= 0 ? h.slice(hsIdx, hsIdx + 2600) : "";
  check("L6: handleSession gates navigation on identity transition", /if\s*\(\s*uid\s*===\s*lastUid\s*\)/.test(hs));
  const early = hs.split("if (uid === lastUid)")[0] || "";
  check("L6: no navigation before the transition gate", early.indexOf("showMainApp") < 0);
  const gateBlock = (hs.split("if (uid === lastUid)")[1] || "").split("}")[0];
  check("L6: same-account path only refreshes topbar", gateBlock.indexOf("updateAuthUI(true)") >= 0 && gateBlock.indexOf("showMainApp") < 0);
  check("L6: transition path still shows main app", hs.indexOf("Genuine sign-in") >= 0 && hs.indexOf("showMainApp();") >= 0);
})();

/* ---------- L7: challenge clock freezes while hidden ---------- */
(function () {
  const m = assessSrc.match(/challenge per-question countdown[\s\S]{0,2200}?\n    \}/);
  const blk = m ? m[0] : "";
  check("L7: per-question branch detects hidden state", /document\.hidden/.test(blk), blk.slice(0, 80));
  check("L7: hidden tick shifts deadline instead of failing", /qDeadline\s*\+=\s*500/.test(blk));
  check("L7: timeout lock only runs when visible", /else\s*\{[\s\S]*lockAnswer\(q, \{ ok: false/.test(blk));
  check("L7b: question navigation persists position", /sess\.idx\+\+; sess\._sel = null; try \{ persistInProgress\(\);/.test(assessSrc) &&
    /sess\.idx--; sess\._sel = null; try \{ persistInProgress\(\);/.test(assessSrc));
})();

/* ---------- L8: bottom-nav poll is live + background-quiet ---------- */
(function () {
  check("L8: no stale boot-time snapshot binding", ultSrc.indexOf("syncBnav.bind(null") < 0);
  check("L8: poll reads live page each tick", ultSrc.indexOf("DMPageState.current") >= 0);
  check("L8: poll skips work while hidden", /setInterval\(function \(\) \{\s*try \{\s*if \(typeof document !== "undefined" && document\.hidden\) return;/.test(ultSrc));
  check("L8: poll validates against known items", ultSrc.indexOf('.dm-bnav-item[data-page="') >= 0);
})();

/* ---------- L9: diagnostics are quiet and data-free ---------- */
(function () {
  const d = appInitSrc;
  check("L9: error ring buffer exists", d.indexOf("window.__dmErrors") >= 0);
  check("L9: uncaught errors captured", /window\.addEventListener\("error"/.test(d));
  check("L9: rejections still captured", d.indexOf("unhandledrejection") >= 0);
  check("L9: lifecycle transitions noted", d.indexOf('"hidden"') >= 0 || d.indexOf("'hidden'") >= 0 || d.indexOf("? \"hidden\"") >= 0 || /document\.hidden \? "hidden" : "visible"/.test(d));
  const diagStart = d.indexOf("Lightweight lifecycle/error diagnostics");
  const diag = diagStart >= 0 ? d.slice(diagStart, diagStart + 2600) : "";
  check("L9: buffer capped (no unbounded growth)", /length > 50/.test(diag));
  check("L9: diagnostics never persist user data", diag.indexOf("localStorage") < 0 && diag.indexOf("sessionStorage") < 0);
})();

/* ---------- L10: no destructive background handlers anywhere new ---------- */
(function () {
  function strip(src) { return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""); }
  const ps = strip(psSrc);
  check("L10: page-state still has no destructive bg handlers",
    !/visibilitychange/.test(ps) && !/pageshow|pagehide/.test(ps) && !/beforeunload/.test(ps));
  check("L10: restore is attempt-capped (early+late only)", (psSrc.match(/tryRestoreLastView\("/g) || []).length <= 3);
  check("L10: single last-view key, versioned", /dm_lastview_v1/.test(psSrc) && /o\.v !== 1/.test(psSrc));
})();

console.log("----");
if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
console.log("RESULT: PASS (" + pass + ")");
