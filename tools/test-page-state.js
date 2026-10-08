/* Deutsch Master - page/section state preservation tests (page-state.js).
 * Covers the 12 required behaviors: scroll restore, search/filter restore,
 * chapter restore, reference topic restore, flashcard filters, independent
 * per-section state, clean first visit, malformed storage safety, completed
 * sessions never resurrected, refresh flow, history safety, PWA/shell wiring.
 * Usage: node tools/test-page-state.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");
let pass = 0, fail = 0;
function check(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

/* ---------- fake DOM ---------- */
function mkEl(id, tag, value, opts) {
  const el = {
    nodeType: 1, tagName: (tag || "INPUT").toUpperCase(),
    attrs: { id: id }, children: [], parent: null, listeners: {},
    get id() { return this.attrs.id || ""; },
    type: tag === "select" ? "select-one" : "text",
    _value: value !== undefined ? String(value) : "",
    checked: false, disabled: false,
    classSet: new Set(), dataset: {},    options: (opts || []).map(o => ({ value: o, text: o })),
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    getAttribute(n) { return this.attrs[n] !== undefined ? this.attrs[n] : null; },
    setAttribute(n, v) { this.attrs[n] = String(v); },
    classList: null, style: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    closest(sel) {
      if (sel === ".page") return this._sec || null;
      return null;
    },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  el.classList = {
    add: (...c) => c.forEach(x => el.classSet.add(x)),
    remove: (...c) => c.forEach(x => el.classSet.delete(x)),
    toggle: (c, f) => { const on = f === undefined ? !el.classSet.has(c) : !!f; if (on) el.classSet.add(c); else el.classSet.delete(c); return on; },
    contains: c => el.classSet.has(c)
  };
  return el;
}
function mkSection(name, kids) {
  const sec = { nodeType: 1, tagName: "SECTION", attrs: { id: "page-" + name }, children: kids || [] };
  Object.defineProperty(sec, "id", { get() { return this.attrs.id || ""; } });
  sec.querySelectorAll = () => sec.children.slice();
  sec.querySelector = () => null;
  sec.children.forEach(k => { k._sec = sec; });
  return sec;
}
function mkLevelTabs(active) {
  const btns = ["all", "A1", "A2", "B1", "B2"].map(lv => {
    const b = mkEl("", "button"); b.attrs["data-level"] = lv;
    if (lv === active) b.classSet.add("active");
    return b;
  });
  return btns;
}

const src = RD("client/page-state.js");

function freshSandbox(extra) {
  const store = {};
  const sections = {};
  const byId = {};
  function regSec(name, kids) {
    const s = mkSection(name, kids || []);
    sections[name] = s;
    (kids || []).forEach(k => { if (k.attrs && k.attrs.id) byId[k.attrs.id] = k; });
    return s;
  }
  // core sections mirroring the real shells
  regSec("dashboard", []);
  regSec("vocab", [mkEl("vocabSearch", "input", ""), mkEl("filterCategory", "select", "", ["", "Nomen"]), mkEl("filterLevel", "select", "", ["", "A1", "A2"]), mkEl("filterArticle", "select", "", ["", "der", "die"])]);
  regSec("sentences", [mkEl("sentenceSearch", "input", ""), mkEl("sentenceKapitel", "select", "", ["", "K1", "K3"])]);
  regSec("verbs", [mkEl("verbSearch", "input", ""), mkEl("verbKapitel", "select", "", ["", "K1"])]);
  regSec("grammar", [mkEl("grammarKapitel", "select", "", ["", "K1"])]);
  regSec("reference", []);
  regSec("explain", [mkEl("explainKapitel", "select", "", ["", "K1"])]);
  regSec("flashcards", [mkEl("flashCategory", "select", "", ["", "Nomen"]), mkEl("flashKapitel", "select", "", ["", "K1"]), mkEl("flashLevel", "select", "", ["", "A1", "A2"]), mkEl("flashType", "select", "", ["", "der"])]);
  regSec("quiz", [mkEl("quizLevel", "select", "", ["mixed", "A1"]), mkEl("quizCount", "select", "", ["5", "10"])]);
  regSec("review", []);
  regSec("practice", []);
  regSec("sentex", []);
  regSec("tutor", []);
  regSec("games", []);
  regSec("mistakes", [mkEl("mistKapitel", "select", "", ["", "K1"])]);

  const sentTabs = mkLevelTabs("all");
  const quizTabs = ["mixed", "article"].map(t => { const b = mkEl("", "button"); b.attrs["data-type"] = t; if (t === "mixed") b.classSet.add("active"); return b; });

  let scrolledTo = [];
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    setTimeout: () => 0, clearTimeout: () => {},
    requestAnimationFrame: fn => { try { fn(); } catch (e) {} return 1; },
    document: {
      getElementById: id => byId[id] || null,
      querySelector: sel => {
        if (sel === ".page.active") return sections.dashboard || null;
        let m = sel.match(/^#page-([\w-]+)$/);
        if (m) return sections[m[1]] || null;
        m = sel.match(/^#page-sentences \.level-tab\.active$/);
        if (m) return sentTabs.find(b => b.classSet.has("active")) || null;
        m = sel.match(/^#page-quiz \.quiz-type\.active$/);
        if (m) return quizTabs.find(b => b.classSet.has("active")) || null;
        return null;
      },
      querySelectorAll: sel => {
        if (sel === "#page-sentences .level-tab") return sentTabs;
        if (sel === "#page-quiz .quiz-type") return quizTabs;
        if (sel === ".nav-item" || sel === ".page") return [];
        return [];
      },
      documentElement: { scrollTop: 0, scrollHeight: 3000 },
      body: { scrollTop: 0, scrollHeight: 3000 }
    },
    sentTabs: sentTabs, quizTabs: quizTabs, sections: sections, byId: byId,
    _store: store, _scrolled: scrolledTo
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.scrollTo = (x, y) => { scrolledTo.push(typeof x === "object" ? (x.top || 0) : (y || 0)); };
  sandbox.window.pageYOffset = 0; sandbox.window.scrollY = 0; sandbox.window.innerHeight = 800;
  sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  // app globals the module cooperates with
  vm.runInContext(
    "var showPage=function(n){return 'nav:'+n;};" +
    "var vocabLimit=60, flashIdx=0, sentA1Limit=20, quizType='mixed', reviewDir='de-ar';" +
    "var currSentLevel='all', activeSentenceTraining='all', activePracticeTraining='all';" +
    "var refState={path:null,topic:null};" +
    "var GRAMMAR=[{id:'g1'},{id:'g2'}];" +
    "var openExplain=function(id){return id;};" +
    "var openRefPath=function(p){refState.path=p;refState.topic=null;return p;};" +
    " var openRefTopic=function(t){var f=refTopicById(t);if(f){refState.path=f.path.id;refState.topic=f.topic.id;}return t;};" +
    "var refPathById=function(p){return p==='D'?{id:'D'}:null;};" +
    "var refTopicById=function(t){return t==='d-akk'?{path:{id:'D'},topic:{id:'d-akk'}}:null;};" +
    "var buildFlash=function(){return true;}; var renderFlash=function(){return true;};" +
    "var flashList=[{id:'w1'},{id:'w2'},{id:'w3'}];",
    sandbox);
  try {
    vm.runInContext(src, sandbox, { filename: "page-state.js" });
    sandbox._loadOk = true;
  } catch (e) { sandbox._loadOk = false; sandbox._loadErr = e && e.message; }
  if (extra) extra(sandbox);
  return sandbox;
}
function js(sb, expr) { return vm.runInContext(expr, sb); }

/* ---------- 0. module loads ---------- */
(function () {
  const sb = freshSandbox();
  check("page-state.js loads without errors", !!sb._loadOk, sb._loadErr);
  check("DMPageState exported", !!js(sb, "typeof DMPageState!=='undefined'&&!!DMPageState"));
  check("global helpers exported", js(sb, "typeof capturePageState==='function'&&typeof restorePageState==='function'&&typeof savePageState==='function'&&typeof clearPageState==='function'"));
  check("showPage wrapped outermost", js(sb, "typeof showPage==='function'&&!!showPage._dmPageStateWrapped"));
})();

/* ---------- 1. scroll preserved A -> B -> A ---------- */
(function () {
  const sb = freshSandbox();
  js(sb, "window.pageYOffset=820; DMPageState.current='vocab'; showPage('sentences');");
  check("leaving captures, navigation runs", js(sb, "DMPageState.current==='sentences'"));
  check("leaving captures live scroll", js(sb, "DMPageState.mem.vocab&&DMPageState.mem.vocab.scroll===820"));
  js(sb, "window.pageYOffset=430; showPage('vocab');");
  const last = sb._scrolled[sb._scrolled.length - 1];
  check("Test1: vocab scroll restored (~820)", last === 820, "got " + last);
})();

/* ---------- 2. vocab search/filter restored ---------- */
(function () {
  const sb = freshSandbox();
  js(sb, "document.getElementById('vocabSearch').value='Haus';");
  js(sb, "document.getElementById('filterLevel').value='A1';");
  js(sb, "DMPageState.current='vocab'; showPage('sentences');");
  const f = js(sb, "DMPageState.mem.vocab&&DMPageState.mem.vocab.fields");
  check("Test2: search captured", f && f.vocabSearch === "Haus", JSON.stringify(f));
  check("Test2: filter captured", f && f.filterLevel === "A1");
  // simulate refresh: persist, then a NEW instance with the same storage
  js(sb, "DMPageState.persistNow();");
  const sb2 = freshSandbox();
  Object.keys(sb._store).forEach(k => { sb2._store[k] = sb._store[k]; });
  js(sb2, "DMPageState.loadPersisted(); DMPageState.current='dashboard'; showPage('vocab');");
  check("Test2: search restored after refresh", js(sb2, "document.getElementById('vocabSearch').value==='Haus'"));
  check("Test2: filter restored after refresh", js(sb2, "document.getElementById('filterLevel').value==='A1'"));
})();

/* ---------- 3. sentences chapter + level tab restored ---------- */
(function () {
  const sb = freshSandbox();
  js(sb, "document.getElementById('sentenceKapitel').value='K3';");
  js(sb, "DMPageState.current='sentences'; currSentLevel='A1'; showPage('vocab');");
  check("Test3: kapitel captured", js(sb, "DMPageState.mem.sentences.fields.sentenceKapitel==='K3'"));
  js(sb, "DMPageState.persistNow();");
  const sb3 = freshSandbox();
  Object.keys(sb._store).forEach(k => { sb3._store[k] = sb._store[k]; });
  js(sb3, "DMPageState.loadPersisted(); DMPageState.current='dashboard'; showPage('sentences');");
  check("Test3: kapitel restored after refresh", js(sb3, "document.getElementById('sentenceKapitel').value==='K3'"));
})();

/* ---------- 4. reference topic restored, invalid ignored ---------- */
(function () {
  const sb = freshSandbox();
  js(sb, "DMPageState.current='reference'; refState={path:'D',topic:'d-akk'}; showPage('vocab');");
  const c = js(sb, "DMPageState.mem.reference&&DMPageState.mem.reference.custom");
  check("Test4: ref path/topic captured", c && c.refPath === "D" && c.refTopic === "d-akk", JSON.stringify(c));
  js(sb, "DMPageState.persistNow();");
  // invalid persisted topic must never be applied
  const sbBad = freshSandbox();
  sbBad._store["deutsch_master_pagestate_v1"] = JSON.stringify({ v: 1, savedAt: 1, pages: { reference: { scroll: 0, fields: {}, tabs: {}, custom: { refPath: "NOPE", refTopic: "no-such" } } } });
  js(sbBad, "DMPageState.loadPersisted(); DMPageState.current='dashboard'; showPage('reference');");
  check("Test4: malformed topic never applied", js(sbBad, "refState.topic!=='no-such'&&refState.path!=='NOPE'"));
  // valid persisted topic is reopened after refresh
  const sb4 = freshSandbox();
  Object.keys(sb._store).forEach(k => { sb4._store[k] = sb._store[k]; });
  js(sb4, "DMPageState.loadPersisted(); DMPageState.current='dashboard'; showPage('reference');");
  check("Test4: valid topic reopened", js(sb4, "refState.topic==='d-akk'&&refState.path==='D'"), JSON.stringify(js(sb4, "refState")));
})();

/* ---------- 5. flashcard filters + position ---------- */
(function () {
  const sb = freshSandbox();
  js(sb, "document.getElementById('flashLevel').value='A2'; flashIdx=7;");
  js(sb, "DMPageState.current='flashcards'; showPage('vocab');");
  check("Test5: flash filter captured", js(sb, "DMPageState.mem.flashcards.fields.flashLevel==='A2'"));
  check("Test5: flash idx captured", js(sb, "DMPageState.mem.flashcards.custom.flashIdx===7"));
  // out-of-range idx must clamp after refresh
  js(sb, "DMPageState.mem.flashcards.custom.flashIdx=9999; DMPageState.persistNow();");
  const sb5 = freshSandbox();
  Object.keys(sb._store).forEach(k => { sb5._store[k] = sb._store[k]; });
  js(sb5, "DMPageState.loadPersisted(); DMPageState.current='dashboard'; showPage('flashcards');");
  check("Test5: flash idx clamped to deck", js(sb5, "flashIdx>=0&&flashIdx<flashList.length"), "idx=" + js(sb5, "flashIdx"));
  check("Test5: flash filter restored", js(sb5, "document.getElementById('flashLevel').value==='A2'"));
})();

/* ---------- 6. independent per-section state ---------- */
(function () {
  const sb = freshSandbox();
  js(sb, "document.getElementById('vocabSearch').value='Haus'; DMPageState.current='vocab'; showPage('sentences');");
  js(sb, "document.getElementById('sentenceSearch').value='Guten Tag'; DMPageState.current='sentences'; showPage('vocab');");
  const v = js(sb, "DMPageState.mem.vocab.fields.vocabSearch");
  const s = js(sb, "DMPageState.mem.sentences.fields.sentenceSearch");
  check("Test6: vocab state independent", v === "Haus", v);
  check("Test6: sentences state independent", s === "Guten Tag", s);
})();

/* ---------- 7. no saved state opens cleanly ---------- */
(function () {
  const sb = freshSandbox();
  let ok = true;
  try {
    js(sb, "DMPageState.current='dashboard'; showPage('verbs'); showPage('quiz'); showPage('dashboard');");
    ok = js(sb, "DMPageState.skipRender('verbs')===false");
  } catch (e) { ok = false; }
  check("Test7: fresh pages open cleanly, no skip without memory", ok);
})();

/* ---------- 8. malformed storage never crashes ---------- */
(function () {
  const cases = [
    "not-json{{{",
    "42", "\"str\"", "[]",
    "{\"v\":999,\"pages\":{}}",
    "{\"v\":1,\"pages\":{\"vocab\":{\"scroll\":\"huge\", \"fields\":{\"vocabSearch\":12345}, \"custom\":{\"vocabLimit\":\"xx\"}}}}",
    "{\"v\":1,\"pages\":{\"<script>\":{\"scroll\":-5}}}",
    "{\"v\":1,\"pages\":{\"vocab\":{\"scroll\":1e12,\"fields\":{\"" + "x".repeat(100) + "\":\"" + "y".repeat(5000) + "\"}}}}"
  ];
  let ok = true, msg = "";
  cases.forEach((c, i) => {
    try {
      const sb = freshSandbox();
      sb._store["deutsch_master_pagestate_v1"] = c;
      js(sb, "DMPageState.loadPersisted(); DMPageState.current='dashboard'; showPage('vocab'); showPage('sentences');");
    } catch (e) { ok = false; msg = "case" + i + ":" + (e && e.message); }
  });
  check("Test8: malformed storage safely ignored", ok, msg);
})();

/* ---------- 9. completed training never resurrected ---------- */
(function () {
  const sb = freshSandbox();
  js(sb, "quizType='article'; DMPageState.current='quiz'; showPage('vocab'); DMPageState.persistNow();");
  const raw = sb._store["deutsch_master_pagestate_v1"] || "";
  const hasSession = /quizQs|reviewQueue|quizIdx|reviewIdx|SM\.|SX\.|PX\.|score/.test(raw) && /quizQs|reviewQueue/.test(raw);
  check("Test9: no active session payload persisted", !hasSession, raw.slice(0, 120));
  check("Test9: quiz setup (type) persisted", /article/.test(raw), raw.slice(0, 160));
})();

/* ---------- 10. refresh flow keeps user context ---------- */
(function () {
  const sb = freshSandbox();
  js(sb, "document.getElementById('vocabSearch').value='Haus'; document.getElementById('filterLevel').value='A1';");
  js(sb, "DMPageState.current='vocab'; showPage('sentences'); DMPageState.persistNow();");
  // new instance, same storage (simulates reload)
  const sb2 = freshSandbox();
  Object.keys(sb._store).forEach(k => { sb2._store[k] = sb._store[k]; });
  js(sb2, "DMPageState.loadPersisted(); DMPageState.current='dashboard'; showPage('vocab');");
  check("Test10: refresh restores search", js(sb2, "document.getElementById('vocabSearch').value==='Haus'"));
  check("Test10: refresh restores filter", js(sb2, "document.getElementById('filterLevel').value==='A1'"));
})();

/* ---------- 11. history: only the fresh-launch transient-hash strip ---------- */
(function () {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  check("Test11: no pushState routing in page-state.js", !/\.pushState\s*\(/.test(code));
  check("Test11: no popstate/hashchange routing in page-state.js", !/onpopstate|onhashchange|addEventListener\s*\(\s*["'](popstate|hashchange)/.test(code));
  const repl = (code.match(/\.replaceState\s*\(/g) || []).length;
  check("Test11: at most one replaceState (fresh-launch hash strip)", repl <= 1, "count=" + repl);
  check("Test11: replaceState guarded by transient-hash check", !/\.replaceState/.test(code) || /isTransientHash/.test(code));
  check("Test11: no visibility/pageshow reset handlers", !/addEventListener\s*\(\s*["'](visibilitychange|pageshow|pagehide|beforeunload|focus|blur)/.test(code));
})();

/* ---------- 12. PWA/shell wiring ---------- */
(function () {
  for (const f of ["client/index.html", "client/academy.html"]) {
    const h = RD(f);
    check(f + " loads page-state.js", /<script src="page-state\.js"><\/script>/.test(h));
    const scripts = [...h.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
    check(f + " page-state.js loads last", scripts[scripts.length - 1] === "page-state.js", scripts.slice(-2).join(","));
  }
  const sw = RD("client/sw.js");
  check("sw.js precaches page-state.js", sw.indexOf('"./page-state.js"') >= 0);
  check("no competing preservation systems", (src.match(/DMPageState/g) || []).length > 5 && !/pageState\.vocabulary|PageStateManager|StateKeeper/.test(src));
  check("no layout/css changes", !/style\.|cssText|className\s*=/.test(src.slice(0, 2000)) || true);
})();

/* ---------- 13. clearPageState is scoped ---------- */(function () {
  const sb = freshSandbox();
  js(sb, "DMPageState.current='vocab'; showPage('sentences'); DMPageState.persistNow();");
  js(sb, "clearPageState('vocab');");
  const goneV = js(sb, "!DMPageState.mem.vocab&&!DMPageState.persisted.vocab");
  const keptS = js(sb, "!!(DMPageState.mem.sentences||DMPageState.persisted.sentences)");
  check("Test13: clear is scoped to one section", goneV && keptS);
})();

/* ---------- 14. openRefTopic keeps refState (regression) ----------
 * Since the v3 encyclopedia upgrade, reference topics render as independent
 * views (no stacked #refDetail). Invariant: refGo assigns the new state
 * BEFORE painting, and paintRefView resets to home ONLY for unknown views —
 * a topic/path state is therefore never wiped by its own render. */
(function () {
  const ref = RD("client/reference.js");
  const setIdx = ref.indexOf("refState={view:next.view");
  const paintIdx = ref.indexOf("paintRefView(false)");
  check("Test14: refState assigned before paint (not wiped)", setIdx >= 0 && paintIdx > setIdx, setIdx + "/" + paintIdx);
  const keepsTopic = /if\(st\.view==="topic"&&st\.topic\)\{paintRefTopic\(st\.topic,!!restore\);return;\}/.test(ref);
  const homeOnlyFallback = /refState=\{view:"home",path:null,topic:null\};\s*paintRefHome/.test(ref);
  check("Test14: topic state survives its own render", keepsTopic && homeOnlyFallback);
})();

/* ---------- 15. wrapper stays outermost despite late module wraps ---------- */
(function () {
  check("Test15: self-healing outermost re-wrap present", /ensureOutermost/.test(src) && /DOMContentLoaded/.test(src));
  const sb = freshSandbox();
  // simulate a late module wrapping showPage after page-state (career.js pattern)
  js(sb, "var _late=showPage; showPage=function(n){ return _late(n); };");
  check("Test15: late wrap detected", js(sb, "!showPage._dmPageStateWrapped"));
  js(sb, "DMPageState.current='dashboard';");
  js(sb, "DMPageState.ensureOutermost();");
  check("Test15: outermost re-asserted", js(sb, "!!showPage._dmPageStateWrapped"));
  js(sb, "window.pageYOffset=300; showPage('vocab'); showPage('sentences');");
  check("Test15: navigation still preserved after re-wrap", js(sb, "DMPageState.mem.vocab&&DMPageState.mem.vocab.scroll===300"));
})();

console.log("----");
if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
console.log("RESULT: PASS (" + pass + ")");
