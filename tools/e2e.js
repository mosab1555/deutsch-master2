/* Deutsch Master - REAL end-to-end harness (node, no browser).
 * Fake DOM from client/index.html + ALL client scripts in page order (vm),
 * then real user journeys with assertions. Run: node tools/e2e.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, ".."), CLIENT = path.join(ROOT, "client");
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? " [" + x + "]" : "")); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- fake DOM (real-DOM move semantics) ---------- */
const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source"]);
function decodeEnt(s) { return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }
class Txt { constructor(t) { this.nodeType = 3; this.text = String(t); this.parent = null; } get textContent() { return this.text; } remove() { if (this.parent) this.parent.removeChild(this); } }
class El {
  constructor(tag, attrs) {
    this.nodeType = 1; this.tagName = String(tag).toUpperCase();
    this.attrs = attrs || {}; this.children = []; this.parent = null;
    this.listeners = {}; this.style = {}; this._value = null;
    this.disabled = false; this.hidden = false;
  }
  get id() { return this.attrs.id || ""; }
  set id(v) { v = String(v); if (this.attrs.id && idReg.get(this.attrs.id) === this) idReg.delete(this.attrs.id); this.attrs.id = v; if (v) idReg.set(v, this); }
  get className() { return this.attrs.class || ""; }
  set className(v) { this.attrs.class = String(v); }
  get classList() {
    const el = this;
    return {
      add: (...c) => { el.attrs.class = ((el.attrs.class || "") + " " + c.join(" ")).split(/\s+/).filter(Boolean).join(" "); },
      remove: (...c) => { const s = new Set((el.attrs.class || "").split(/\s+/).filter(Boolean)); c.forEach(x => s.delete(x)); el.attrs.class = [...s].join(" "); },
      toggle: (c, f) => { const s = new Set((el.attrs.class || "").split(/\s+/).filter(Boolean)); const has = s.has(c); const on = f === undefined ? !has : !!f; if (on) s.add(c); else s.delete(c); el.attrs.class = [...s].join(" "); return on; },
      contains: c => ((el.attrs.class || "").split(/\s+/).includes(c))
    };
  }
  get dataset() {
    const out = {};
    Object.keys(this.attrs).forEach(k => { if (k.indexOf("data-") === 0) out[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = this.attrs[k]; });
    return out;
  }
  getAttribute(n) { return this.attrs[n] !== undefined ? String(this.attrs[n]) : null; }
  setAttribute(n, v) { v = String(v); if (n === "id") { if (this.attrs.id && idReg.get(this.attrs.id) === this) idReg.delete(this.attrs.id); if (v) idReg.set(v, this); } this.attrs[n] = v; }
  removeAttribute(n) { if (n === "id" && this.attrs.id && idReg.get(this.attrs.id) === this) idReg.delete(this.attrs.id); delete this.attrs[n]; }
  get value() {
    if (this.tagName === "SELECT") { const o = this.children.find(c => c.nodeType === 1 && c.tagName === "OPTION"); return this._value !== null ? this._value : (o ? (o.getAttribute("value") !== null ? o.getAttribute("value") : o.textContent) : ""); }
    return this._value !== null ? this._value : (this.attrs.value !== undefined ? this.attrs.value : "");
  }
  set value(v) { this._value = String(v); }
  get options() { return this.tagName === "SELECT" ? this.children.filter(c => c.nodeType === 1 && c.tagName === "OPTION") : []; }
  get textContent() { return this.children.map(c => c.textContent).join(""); }
  set textContent(v) { this.children.slice().forEach(c => unregSubtree(c)); this.children = []; this.appendChild(new Txt(v)); }
  get innerHTML() { return this._html || ""; }
  set innerHTML(h) { this.children.slice().forEach(c => unregSubtree(c)); this._html = String(h); this.children = []; parseFrag(this._html, this); regSubtree(this); if (this.tagName === "SELECT" && this._value === null) { const o = this.children.find(c => c.nodeType === 1 && c.tagName === "OPTION"); if (o) this._value = o.getAttribute("value") !== null ? o.getAttribute("value") : o.textContent; } }
  get childNodes() { return this.children.slice(); }
  get firstChild() { return this.children[0] || null; }
  get parentNode() { return this.parent; }
  get nextSibling() { if (!this.parent) return null; const s = this.parent.children; return s[s.indexOf(this) + 1] || null; }
  get previousSibling() { if (!this.parent) return null; const s = this.parent.children; return s[s.indexOf(this) - 1] || null; }
  get firstElementChild() { return this.children.find(c => c.nodeType === 1) || null; }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return !!(n && n.tagName === "HTML"); }
  contains(o) { let n = o; while (n) { if (n === this) return true; n = n.parent; } return false; }
  matches(sel) { return matchCompound(this, sel); }
  hasAttribute(n) { return this.attrs[n] !== undefined; }
  removeAttribute(n) { delete this.attrs[n]; }
  focus() {}
  blur() {}
  getElementsByClassName(c) { return qsa(this, "." + c); }
  getElementsByTagName(t) { return qsa(this, t); }
  appendChild(c) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); regSubtree(c); return c; }
  insertBefore(c, r) { if (c.parent) c.parent.removeChild(c); c.parent = this; const i = r ? this.children.indexOf(r) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); regSubtree(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; unregSubtree(c); return c; }
  remove() { if (this.parent) this.parent.removeChild(this); }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  click() { const ev = { target: this, preventDefault() {}, stopPropagation() {} }; (this.listeners.click || []).slice().forEach(f => f(ev)); }
  scrollIntoView() { scrollCalls.push(["intoView", this.attrs.id || this.tagName]); }
  closest(sel) { let e = this; while (e) { if (matchCompound(e, sel)) return e; e = e.parent; } return null; }
  querySelectorAll(sel) { return qsa(this, sel); }
  querySelector(sel) { return qsa(this, sel)[0] || null; }
}
function matchCompound(el, sel) {
  if (!el || el.nodeType !== 1) return false;
  let s = sel.trim(), tag = null, m;
  const tm = s.match(/^([a-zA-Z][a-zA-Z0-9]*)/); if (tm) { tag = tm[1].toUpperCase(); s = s.slice(tm[1].length); }
  if (tag && el.tagName !== tag) return false;
  const re = /(\.[\w-]+|#[\w-]+|\[[^\]]+\])/g;
  while ((m = re.exec(s))) {
    const p = m[1];
    if (p[0] === ".") { if (!((el.attrs.class || "").split(/\s+/).includes(p.slice(1)))) return false; }
    else if (p[0] === "#") { if ((el.attrs.id || "") !== p.slice(1)) return false; }
    else {
      const am = p.slice(1, -1).match(/^([\w-]+)(?:="((?:[^"\\]|\\.)*)")?$/);
      if (!am) return false;
      const v = el.attrs[am[1]];
      if (am[2] === undefined) { if (v === undefined) return false; }
      else if (String(v) !== am[2]) return false;
    }
  }
  return true;
}
function eachEl(root, cb) {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    const kids = n.children || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    if (n !== root && n.nodeType === 1) { if (cb(n) === false) return; }
  }
}
function qsa(root, sel) {
  const out = [];
  eachEl(root, el => {
    const groups = String(sel).split(",").map(s => s.trim()).filter(Boolean);
    for (const g of groups) {
      const parts = g.split(/\s+/).filter(Boolean);
      if (!matchCompound(el, parts[parts.length - 1])) continue;
      let cur = el.parent, pi = parts.length - 2, good = true;
      while (pi >= 0) { while (cur && !matchCompound(cur, parts[pi])) cur = cur.parent; if (!cur) { good = false; break; } cur = cur.parent; pi--; }
      if (good && out.indexOf(el) < 0) out.push(el);
    }
  });
  return out;
}
function parseAttrs(str) {
  const attrs = {}; const re = /([\w-]+)(?:\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'=<>`]+)))?/g;
  let m; while ((m = re.exec(str))) { attrs[m[1]] = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : "")); }
  return attrs;
}
function parseFrag(html, parent) {
  const re = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g;
  const stack = [parent]; let m;
  while ((m = re.exec(html))) {
    const tok = m[0];
    if (tok.indexOf("<!--") === 0) continue;
    if (tok[0] !== "<") { const t = decodeEnt(tok); if (t) stack[stack.length - 1].appendChild(new Txt(t)); continue; }
    const close = tok[1] === "/";
    const name = (tok.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/) || [])[1];
    if (!name) continue;
    if (close) { while (stack.length > 1 && stack[stack.length - 1].tagName !== name.toUpperCase()) stack.pop(); if (stack.length > 1) stack.pop(); continue; }
    const el = new El(name, parseAttrs(tok.slice(name.length + 1, tok.endsWith("/>") ? -2 : -1)));
    stack[stack.length - 1].appendChild(el);
    if (!VOID.has(name.toLowerCase()) && !tok.endsWith("/>")) stack.push(el);
  }
}
/* Live id registry (mirrors real browsers: getElementById never traverses).
   Registration hooks cover every mutation path: parse, innerHTML/textContent
   setters (unregister old, register new), append/insert/remove, id setters. */
const idReg = new Map();
function regSubtree(el) {
  if (!el || el.nodeType !== 1) return;
  if (el.attrs.id) idReg.set(el.attrs.id, el);
  (el.children || []).forEach(c => regSubtree(c));
}
function unregSubtree(el) {
  if (!el || el.nodeType !== 1) return;
  if (el.attrs.id && idReg.get(el.attrs.id) === el) idReg.delete(el.attrs.id);
  (el.children || []).forEach(c => unregSubtree(c));
}
function parseHTML(html) {
  const root = new El("HTML", {});
  const head = new El("HEAD", {}), body = new El("BODY", {});
  root.appendChild(head); root.appendChild(body);
  const mBody = html.match(/<body[^>]*>/i);
  parseFrag(mBody ? html.slice(mBody.index + mBody[0].length) : html, body);
  root.body = body; root.documentElement = root;
  regSubtree(root);
  return root;
}

/* ---------- sandbox ---------- */
const errors = [];
const scrollCalls = [];
const store = {};
const intervals = new Set();
const docListeners = {};
const root = parseHTML(fs.readFileSync(path.join(CLIENT, "index.html"), "utf8"));
const document = {
  nodeType: 9, documentElement: root, body: root.body, title: "",
  getElementById(id) {
    const hit = idReg.get(id);
    if (hit && hit.isConnected) return hit;
    if (hit && !hit.isConnected) idReg.delete(id);
    let f = null;
    eachEl(root, e => { if ((e.attrs.id || "") === id) { f = e; return false; } });
    return f;
  },
  querySelectorAll(s) { return qsa(root, s); },
  querySelector(s) { return qsa(root, s)[0] || null; },
  createElement(t) { return new El(t, {}); },
  createTextNode(t) { return new Txt(t); },
  addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); }
};
const sandbox = {
  console: { log() {}, error(...a) { errors.push(a.map(x => (x && x.stack ? String(x.stack).split("\n").slice(0, 3).join(" <- ") : String(x))).join(" ")); }, warn() {} },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  speechSynthesis: { speak() {}, cancel() {}, getVoices: () => [], onvoiceschanged: null },
  Audio: function () { return { play() {}, pause() {}, src: "" }; },
  requestAnimationFrame: fn => setTimeout(fn, 0),
  setInterval: (fn, ms) => { const id = setInterval(fn, ms); intervals.add(id); return id; },
  clearInterval: id => { intervals.delete(id); clearInterval(id); },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
  confirm: () => true, alert: () => {},
  fetch: () => Promise.reject(new Error("offline")),
  Blob: function () {}, FileReader: function () {}, URL: { createObjectURL: () => "" },
  getComputedStyle: () => ({ getPropertyValue: () => "" })
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.scrollTo = (x, y) => { scrollCalls.push([x, y]); };
sandbox.scroll = (x, y) => { scrollCalls.push([x, y]); };
sandbox.document = document;
sandbox.navigator = {};
sandbox.location = { href: "", protocol: "file:" };
sandbox.self = sandbox;
vm.createContext(sandbox);
const ORDER = ["launch.js", "explain.js", "script.js", "learn.js", "play.js", "sentex.js", "world.js", "life.js", "study.js", "mygermany.js", "dlife.js", "glab.js", "curr-a2.js", "curriculum.js", "smart.js", "labsx.js", "adv.js"];
try {
  ORDER.forEach(f => vm.runInContext(fs.readFileSync(path.join(CLIENT, f), "utf8"), sandbox, { filename: f }));
} catch (e) { console.log("LOAD ERROR: " + (e && e.message)); console.log(String((e && e.stack) || e).split("\n").slice(0, 8).join(" | ")); process.exit(1); }
(docListeners.DOMContentLoaded || []).forEach(f => { try { f({}); } catch (e) { errors.push("domready: " + e.message); } });
function js(expr) { return vm.runInContext(expr, sandbox); }
function fireErr(tag, fn) { try { return fn(); } catch (e) { errors.push(tag + ": " + e.message); return null; } }
function byId(id) { const e = document.getElementById(id); if (!e) errors.push("missing-id: " + id); return e; }
function clickNav(page) {
  const b = document.querySelectorAll(".nav-item").find(e => e.dataset.page === page);
  if (!b) { errors.push("missing-nav: " + page); return false; }
  fireErr("nav-" + page, () => b.click());
  return true;
}
function activePage() { const p = document.querySelectorAll(".page").find(e => e.classList.contains("active")); return p ? p.getAttribute("id") : null; }
const txt = e => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

(async () => {
  await sleep(100);
  /* A. sidebar: exactly 1 icon per item, ar/de/en */
  for (const L of ["ar", "de", "en"]) {
    fireErr("lang-" + L, () => js("setHeaderLang('" + L + "')"));
    await sleep(20);
    const items = document.querySelectorAll(".nav-item");
    const bad = items.filter(b => b.querySelectorAll(".nav-ico").length !== 1);
    ok("sidebar: 1 icon per item [" + L + "]", bad.length === 0, bad.map(b => b.dataset.page + "x" + b.querySelectorAll(".nav-ico").length).join(","));
  }
  fireErr("lang-back", () => js("setHeaderLang('ar')"));

  /* B. New Challenge end-to-end (true correct answers via stashed build) */
  ok("chall: nav+page", clickNav("chall") && activePage() === "page-chall" && !!byId("chalStart"));
  js("__stash=null; __origChal=advChalBuild; advChalBuild=function(){var r=__origChal();__stash=r;return r;}");
  fireErr("chall-start", () => byId("chalStart").click());
  await sleep(50);
  let stations = js("__stash") || [];
  ok("chall: 5 stations, all skills", stations.length === 5 && stations.map(s => s.sk).sort().join(",") === "grammar,listening,sentence,speaking,vocab", String(stations.length));
  const rightOf = it => (it.q.correctText !== undefined ? it.q.correctText : (it.q.opts ? it.q.opts[it.q.correct] : null));
  for (let s = 0; s < stations.length; s++) {
    const it = stations[s];
    if (it.sk === "speaking") {
      const inp = byId("chIn"); if (!inp) { errors.push("chall: no chIn @station " + s); break; }
      inp.value = "Ich lerne Deutsch und das ist gut";
      fireErr("chall-speak-" + s, () => byId("chOk").click());
    } else {
      const want = String(rightOf(it)).replace(/\s+/g, " ").trim();
      const b = document.querySelectorAll("#chQ .quiz-opt").find(x => txt(x) === want);
      if (!b) { errors.push("chall: correct option not rendered @station " + s); break; }
      fireErr("chall-answer-" + s, () => b.click());
    }
    await sleep(2100);
  }
  const finTxt = txt(byId("chalBody"));
  const mFin = finTxt.match(/(\d+)\/(\d+)/);
  ok("chall: full-score finish", !!mFin && mFin[1] === mFin[2] && +mFin[2] === stations.length, finTxt.slice(0, 100));
  fireErr("chall-replay", () => byId("chalAgain").click());
  await sleep(100);
  ok("chall: replay renders station 1", !!byId("chalBody") && /محطة 1/.test(txt(byId("chalBody"))));
  // wrong path on the current fresh run (no extra replay click needed)
  const st3 = js("__stash") || [];
  const wi = st3.findIndex(x => x.sk !== "speaking");
  if (wi < 0) { errors.push("chall: no choice station"); }
  else {
    for (let s = 0; s < wi; s++) { const it = st3[s]; if (it.sk === "speaking") { byId("chIn").value = "Ich lerne Deutsch gern"; byId("chOk").click(); await sleep(2100); } }
    const wantW = String(rightOf(st3[wi])).replace(/\s+/g, " ").trim();
    const wrong = document.querySelectorAll("#chQ .quiz-opt").find(x => txt(x) !== wantW);
    if (wrong) {
      fireErr("chall-wrong", () => wrong.click());
      await sleep(300);
      const fb = byId("chFb");
      ok("chall: wrong shows error", !!fb && fb.classList.contains("no"), txt(fb).slice(0, 60));
    } else ok("chall: wrong shows error", false, "no wrong option");
  }
  const ql = byId("quizLevel");
  if (ql) { ql.value = "A1"; const bld = js("advChalBuild()"); ok("chall: A1 builds", bld && bld.length === 5); ql.value = "mixed"; }

  /* C. distribution over 60 builds */
  let counts = null;
  try {
    counts = js("(()=>{const c={};let n=0;for(let r=0;r<60;r++){const items=__origChal();items.forEach(it=>{if(it.q&&it.q.opts&&it.q.opts.length>2){const t=it.q.correctText!==undefined?it.q.correctText:it.q.opts[it.q.correct];const ix=it.q.opts.indexOf(t);c[ix]=(c[ix]||0)+1;n++;}});}return {c:c,n:n};})()");
  } catch (e) { errors.push("chall-dist: " + e.message); }
  if (counts && counts.n > 30) {
    const vals = Object.values(counts.c), exp = counts.n / vals.length;
    const chi = vals.reduce((s, v) => s + (v - exp) * (v - exp) / exp, 0);
    ok("chall: positions uniform", chi < 20, JSON.stringify(counts.c) + " chi=" + chi.toFixed(1));
  } else ok("chall: positions uniform", false, "n=" + (counts && counts.n));

  /* D. games Home/Session */
  const scBefore = scrollCalls.length;
  ok("games: hub renders", clickNav("games") && !!byId("gamesHome"));
  const gBtn = document.querySelectorAll('#gamesHome [data-g="battle"]')[0];
  fireErr("games-start", () => gBtn.click());
  await sleep(100);
  ok("games: session replaces home", byId("gamesHome").classList.contains("hidden") && !byId("gamesSession").classList.contains("hidden"));
  ok("games: no element-scroll", scrollCalls.slice(scBefore).every(c => c[0] !== "intoView"), JSON.stringify(scrollCalls.slice(scBefore)));
  ok("games: back button", !!byId("gamesBack"));
  let answered = 0;
  const hasAgain = () => !!document.getElementById("gAgain");
  for (let q = 0; q < 10; q++) {
    const opts = document.querySelectorAll("#gameBox .quiz-opt");
    if (!opts.length) { if (hasAgain()) break; await sleep(1000); continue; }
    fireErr("games-a" + q, () => opts[0].click());
    answered++;
    await sleep(1200);
    if (hasAgain()) break;
  }
  ok("games: battle completes", hasAgain(), "answered=" + answered);
  const resTxt = txt(byId("gameBox"));
  ok("games: result correct/wrong", /صحيحة/.test(resTxt) && /خاطئة/.test(resTxt));
  fireErr("games-replay", () => byId("gAgain").click());
  await sleep(200);
  ok("games: replay restarts", document.querySelectorAll("#gameBox .quiz-opt").length > 0 && !document.getElementById("gAgain"));
  const ivBefore = intervals.size;
  fireErr("games-back", () => byId("gamesBack").click());
  await sleep(2500);
  ok("games: back home", !byId("gamesHome").classList.contains("hidden") && byId("gamesSession").classList.contains("hidden"));
  ok("games: no interval leak", intervals.size <= ivBefore, ivBefore + "->" + intervals.size);

  /* E. regression spot */
  ok("nav: quiz", clickNav("quiz") && !!byId("startQuiz"));
  ok("nav: review", clickNav("review") && !!byId("dueGrid"));
  ok("nav: mistakes v2", clickNav("mistakes") && !!byId("mistTabs"));
  fireErr("search", () => { byId("globalSearch").value = "haus"; js("runGlobalSearch()"); });
  await sleep(300);
  ok("search: hits render", document.querySelectorAll("#searchResults .search-hit").length > 0);
  ok("console: clean", errors.length === 0, errors.slice(0, 5).join(" || "));

  console.log("\n==== E2E: " + pass + " passed, " + fail + " failed ====");
  if (fail && errors.length) console.log("APP-ERRORS: " + errors.slice(0, 8).join(" || "));
  intervals.forEach(clearInterval);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("HARNESS ERROR: " + e.stack.split("\n").slice(0, 6).join(" | ")); if (errors.length) console.log("APP-ERRORS: " + errors.slice(0, 8).join(" || ")); process.exit(1); });
