/* Deutsch Master - fresh-launch vs same-session regression tests.
 * Fresh launch (new document after previous instance ended) must start at
 * the home page with default transient UI; the live session must keep
 * working normally (navigation, background/visibility, no data loss).
 * Usage: node tools/test-fresh-launch.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");
let pass = 0, fail = 0;
function check(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

const src = RD("client/page-state.js");

function mkEl(id, tag, value, opts) {
  const el = {
    nodeType: 1, tagName: (tag || "INPUT").toUpperCase(),
    attrs: { id: id }, children: [], parent: null, listeners: {},
    get id() { return this.attrs.id || ""; },
    type: tag === "select" ? "select-one" : "text",
    _value: value !== undefined ? String(value) : "",
    checked: false, disabled: false,
    classSet: new Set(), dataset: {}, options: (opts || []).map(o => ({ value: o, text: o })),
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    getAttribute(n) { return n === "data-page" ? this.attrs["data-page"] : (this.attrs[n] !== undefined ? this.attrs[n] : null); },
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

/* Sandbox emulating ONE document load. preStore/preHash simulate the state
 * left behind by the previous app instance on disk/URL. */
function bootSandbox(preStore, preHash, preUserData) {
  const store = Object.assign({}, preUserData || {});
  if (preStore) store["deutsch_master_pagestate_v1"] = preStore;
  const sections = {};
  const byId = {};
  function regSec(name, kids, active) {
    const s = mkSection(name, kids || [], active);
    sections[name] = s;
    (kids || []).forEach(k => { if (k.attrs && k.attrs.id) byId[k.attrs.id] = k; });
    return s;
  }
  regSec("dashboard", [], true);
  regSec("vocab", [mkEl("vocabSearch", "input", ""), mkEl("filterLevel", "select", "", ["", "A1"])]);
  regSec("sentences", [mkEl("sentenceSearch", "input", "")]);
  const navDash = mkEl("", "button"); navDash.attrs["data-page"] = "dashboard";
  navDash.classSet.add("active");
  const navVocab = mkEl("", "button"); navVocab.attrs["data-page"] = "vocab";
  const navItems = [navDash, navVocab];
  let replacedTo = null;
  let scrolled = [];
  const listeners = {};
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    setTimeout: (fn) => 0, clearTimeout: () => {},
    requestAnimationFrame: fn => { try { fn(); } catch (e) {} return 1; },
    location: { hash: preHash || "", pathname: "/index.html", search: "" },
    history: {
      replaceState: (a, b, url) => { replacedTo = url; },
      scrollRestoration: "auto"
    },
    HW: { q: "", cat: "all", open: "hw-words", _force: 0 },
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
        if (sel === ".nav-item") return navItems;
        return [];
      },
      documentElement: { scrollTop: 0, scrollHeight: 3000 },
      body: { scrollTop: 0, scrollHeight: 3000 },
      addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }
    },
    _store: store, _nav: navItems, _sections: sections, _byId: byId,
    _listeners: listeners,
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
  try {
    vm.runInContext(src, sandbox, { filename: "page-state.js" });
    sandbox._loadOk = true;
  } catch (e) { sandbox._loadOk = false; sandbox._loadErr = e && e.message; }
  return sandbox;
}
function js(sb, expr) { return vm.runInContext(expr, sb); }

/* ---------- F1: fresh load clears transient store, keeps user data ---------- */
(function () {
  const userRaw = JSON.stringify({ favs: ["w1"], xp: 42, settings: { theme: "dark" } });
  const stale = JSON.stringify({ v: 1, savedAt: 1, pages: { vocab: { scroll: 900, fields: { vocabSearch: "Haus" }, tabs: {}, custom: {} } } });
  const sb = bootSandbox(stale, "#howto-hw-words", { "deutsch_master_v2": userRaw, "dm_welcomed": "1", "dm_device_id": "d1" });
  check("F1: module loads", !!sb._loadOk, sb._loadErr);
  check("F1: transient pagestate cleared on fresh launch", sb._store["deutsch_master_pagestate_v1"] == null, sb._store["deutsch_master_pagestate_v1"]);
  check("F1: mem empty after fresh launch", js(sb, "!DMPageState.mem.vocab"));
  check("F1: persisted empty after fresh launch", js(sb, "!DMPageState.persisted.vocab"));
  check("F1: user learning data untouched", sb._store["deutsch_master_v2"] === userRaw);
  check("F1: welcome/device flags untouched", sb._store["dm_welcomed"] === "1" && sb._store["dm_device_id"] === "d1");
  check("F1: transient topic hash stripped", sb._replacedTo !== null && sb._replacedTo.indexOf("#") < 0, sb._replacedTo);
  check("F1: topic opener reset", js(sb, "HW.open===null"));
  check("F1: lands on dashboard", js(sb, "DMPageState.current==='dashboard'"));
  check("F1: dashboard shell active", sb._sections.dashboard.classSet.has("active") && !sb._sections.vocab.classSet.has("active"));
  check("F1: scroll reset to top", sb._scrolled.length > 0 && sb._scrolled[0] === 0, JSON.stringify(sb._scrolled));
})();

/* ---------- F2: same-session navigation still preserves state ---------- */
(function () {
  const sb = bootSandbox(null, "");
  js(sb, "document.getElementById('vocabSearch').value='Haus';");
  js(sb, "DMPageState.current='vocab'; window.pageYOffset=500; showPage('sentences');");
  js(sb, "document.getElementById('sentenceSearch').value='Guten Tag'; DMPageState.current='sentences'; showPage('vocab');");
  check("F2: vocab search kept in-session", js(sb, "DMPageState.mem.vocab.fields.vocabSearch==='Haus'"));
  check("F2: sentences search kept in-session", js(sb, "DMPageState.mem.sentences.fields.sentenceSearch==='Guten Tag'"));
})();

/* ---------- F3: backgrounding never resets (no such handlers, mem intact) ---------- */
(function () {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  check("F3: no visibilitychange reset", !/visibilitychange/.test(code));
  check("F3: no pageshow/pagehide reset", !/pageshow|pagehide/.test(code));
  check("F3: no focus/blur reset", !/addEventListener\s*\(\s*["'](focus|blur)/.test(code));
  check("F3: no beforeunload wipe", !/beforeunload/.test(code));
  const sb = bootSandbox(null, "");
  js(sb, "document.getElementById('vocabSearch').value='Haus'; DMPageState.current='vocab'; showPage('sentences');");
  const before = js(sb, "DMPageState.mem.vocab.fields.vocabSearch");
  try {
    (sb._listeners["visibilitychange"] || []).forEach(f => f());
    (sb._listeners["win:visibilitychange"] || []).forEach(f => f());
    (sb._listeners["pageshow"] || []).forEach(f => f());
  } catch (e) {}
  check("F3: session mem survives background events", js(sb, "DMPageState.mem.vocab.fields.vocabSearch==='Haus'"), before);
})();

/* ---------- F4: no durable-data wipe anywhere in the reset ---------- */
(function () {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  check("F4: never clears all localStorage", !/localStorage\s*\.\s*clear\s*\(/.test(code));
  check("F4: never clears all sessionStorage", !/sessionStorage\s*\.\s*clear\s*\(/.test(code));
  check("F4: never touches main store key", !/deutsch_master_v2/.test(code));
  check("F4: never touches sync/auth keys", !/dm_sync_queue|dm_device_id|dm_welcomed|supabase/i.test(code));
  check("F4: only transient key removed", /deutsch_master_pagestate_v1/.test(code) && /removeItem/.test(code));
})();

/* ---------- F5: non-transient hashes left alone ---------- */
(function () {
  const sb = bootSandbox(null, "#some-future-route");
  check("F5: unknown hash preserved", sb._replacedTo === null, sb._replacedTo);
})();

console.log("----");
if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
console.log("RESULT: PASS (" + pass + ")");
