/* Deutsch Master — sentence-training balance test (node, no browser).
 * Guards the CONTENT_BALANCE_REPORT fixes against drift:
 *  T1 static SENT_FILL baseline (play.js): 137 items, kinds 98/9/7/7/6/6/4.
 *  T2 SENTEX_ORDER_PACKS (sentex.js) covers EXACTLY the src ex files that
 *      contain kind=order rows (library rebuilds fail loudly, never silently).
 *  T3 sentx-a2/b1/b2.js starter sets: counts, id uniqueness + prefix, level +
 *      chapter mapping, option/key correspondence (o[c]===s), no dup texts
 *      vs static bank (no count inflation), error/transform/qa shape rules.
 *  T4 currBuildOrders (curriculum.js) on REAL curr data: minimum yields per
 *      level, chapter mapping, uniqueness, words.join===s, token rules.
 *  T5 sentex.js honesty wiring present (sentexCounts2, sxIsLib, order loader).
 * Run: node tools/test-sentex-balance.js  (exit 1 on failure)
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }

function extractArrayLiteral(src, marker) {
  const st = src.indexOf(marker);
  if (st < 0) throw new Error("marker not found: " + marker);
  let i = src.indexOf("[", st), d = 0, ins = false, esc = false, q = null, e = -1;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (ins) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === q) ins = false; continue; }
    if (c === '"' || c === "'") { ins = true; q = c; }
    else if (c === "[") d++;
    else if (c === "]") { d--; if (d === 0) { e = j + 1; break; } }
  }
  return vm.runInNewContext(src.slice(i, e));
}
function typeOf(f) {
  if (f && f.kind === "order") return "order";
  if (f && f.kind === "qa") return "qa";
  if (f && f.kind === "correct") return "correct";
  if (f && f.kind === "error") return "error";
  if (f && f.kind === "transform") return "transform";
  if (f && f.kind === "sit") return "sit";
  return "fill";
}
function norm(s) { return String(s || "").toLowerCase().replace(/[\s\u00a0]+/g, " ").trim(); }

/* ---------- T1: static baseline ---------- */
const staticBank = extractArrayLiteral(RD("client/play.js"), "const SENT_FILL=");
(function () {
  const by = {};
  staticBank.forEach(f => { const k = typeOf(f); by[k] = (by[k] || 0) + 1; });
  ok("T1 total static = 137", staticBank.length === 137, "got " + staticBank.length);
  ok("T1 kinds 98/9/7/7/6/6/4", by.fill === 98 && by.order === 9 && by.qa === 7 && by.correct === 7 && by.error === 6 && by.transform === 6 && by.sit === 4, JSON.stringify(by));
  const ids = new Set(staticBank.map(f => f.id));
  ok("T1 static ids unique", ids.size === staticBank.length);
  const chaps = new Set(staticBank.map(f => f.chapterId));
  ok("T1 static chapters K0-K5 only", [...chaps].every(c => ["K0", "K1", "K2", "K3", "K4", "K5"].includes(c)), [...chaps].join(","));
})();

/* ---------- T2: order-pack list vs src ---------- */
(function () {
  const sentex = RD("client/sentex.js");
  const m = sentex.match(/var SENTEX_ORDER_PACKS=\[(.*?)\];/);
  ok("T2 pack list present", !!m);
  const listed = m ? JSON.parse("[" + m[1].replace(/'/g, '"') + "]") : [];
  const dir = path.join(ROOT, "client", "content", "src");
  const withOrder = fs.readdirSync(dir).filter(f => /^ex-\d+\.json$/.test(f)).filter(f => {
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    return a.rows.some(r => r.kind === "order");
  }).map(f => "content/dm-" + f.replace(/\.json$/, ".js"));
  const a = listed.slice().sort().join(","), b = withOrder.slice().sort().join(",");
  ok("T2 pack list == src order files", a === b, "listed=" + a + " src=" + b);
})();

/* ---------- T3: sentx starter sets ---------- */
function loadSentx(file, lvl, kaps) {
  const sb = { SENT_FILL: [], window: {} };
  sb.window = sb;
  sb.window.dispatchEvent = () => {};
  vm.createContext(sb);
  vm.runInContext(RD("client/" + file), sb, { filename: file });
  const rows = sb.SENT_FILL;
  const by = {};
  rows.forEach(f => { const k = typeOf(f); by[k] = (by[k] || 0) + 1; });
  ok("T3 " + file + " 60 rows (12x5)", rows.length === 60, "got " + rows.length + " " + JSON.stringify(by));
  const want = { qa: 12, correct: 12, error: 12, transform: 12, sit: 12 };
  ok("T3 " + file + " per-type 12", Object.keys(want).every(k => by[k] === 12), JSON.stringify(by));
  const ids = new Set();
  let badId = 0, badLvl = 0, badKap = 0, badOpts = 0, badKey = 0, badWhy = 0, badShape = 0;
  const seenS = new Set();
  let dupS = 0;
  rows.forEach(f => {
    if (!f.id || !/^sx2/.test(f.id) || ids.has(f.id)) badId++;
    ids.add(f.id);
    if (f.lvl !== lvl) badLvl++;
    if (kaps.indexOf(f.chapterId) < 0) badKap++;
    if (!Array.isArray(f.o) || f.o.length < 3 || f.c < 0 || f.c >= f.o.length) badOpts++;
    else if (f.o[f.c] !== f.s) badKey++;
    if (!f.why || String(f.why).length < 8) badWhy++;
    if (f.kind === "error" && (!f.q || f.q.indexOf("❌") < 0)) badShape++;
    if ((f.kind === "transform") && (!f.disp || f.disp === f.s)) badShape++;
    if ((f.kind === "qa" || f.kind === "sit") && !f.q) badShape++;
    if (!f.s || norm(f.s).split(" ").length < 2) badShape++;
    const ns = norm(f.s);
    if (seenS.has(ns)) dupS++; else seenS.add(ns);
  });
  ok("T3 " + file + " ids unique+prefixed", badId === 0, "bad=" + badId);
  ok("T3 " + file + " lvl=" + lvl, badLvl === 0, "bad=" + badLvl);
  ok("T3 " + file + " kaps " + kaps.join("/"), badKap === 0, "bad=" + badKap);
  ok("T3 " + file + " opts>=3", badOpts === 0, "bad=" + badOpts);
  ok("T3 " + file + " o[c]===s (key correspondence)", badKey === 0, "bad=" + badKey);
  ok("T3 " + file + " why present", badWhy === 0, "bad=" + badWhy);
  ok("T3 " + file + " shape rules", badShape === 0, "bad=" + badShape);
  ok("T3 " + file + " no dup texts inside file", dupS === 0, "dups=" + dupS);
  return { rows, seenS };
}
const staticS = new Set(staticBank.map(f => norm(f.s)));
const A2 = loadSentx("sentx-a2.js", "A2", ["K6", "K7", "K8"]);
const B1 = loadSentx("sentx-b1.js", "B1", ["K9", "K10", "K11"]);
const B2 = loadSentx("sentx-b2.js", "B2", ["K12", "K13", "K14", "K15", "K16", "K17"]);
(function () {
  let overlap = 0;
  [A2, B1, B2].forEach(B => B.rows.forEach(f => { if (staticS.has(norm(f.s))) overlap++; }));
  ok("T3 no dup texts vs static bank (no inflation)", overlap === 0, "overlap=" + overlap);
  const all = {};
  let dupId = 0;
  [A2, B1, B2].forEach(B => B.rows.forEach(f => { if (all[f.id]) dupId++; all[f.id] = 1; }));
  ok("T3 ids unique across all sentx files", dupId === 0, "dups=" + dupId);
})();

/* ---------- T4: currBuildOrders on real data ---------- */
(function () {
  const sb = { console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, window: {} };
  sb.window = sb;
  sb.document = { createElement: () => ({ set src(v) {}, addEventListener: () => {}, dataset: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } }), body: { appendChild: () => {} }, querySelectorAll: () => [], addEventListener: () => {} };
  sb.localStorage = { getItem: () => null, setItem: () => {} };
  const ctx = vm.createContext(sb);
  const run = f => vm.runInContext(RD("client/" + f), ctx, { filename: f });
  vm.runInContext('var KAPITEL=[{id:"K0"},{id:"K1"},{id:"K2"},{id:"K3"},{id:"K4"},{id:"K5"},{id:"K6"},{id:"K7"},{id:"K8"},{id:"K9"},{id:"K10"},{id:"K11"},{id:"K12"},{id:"K13"},{id:"K14"}];var CATEGORIES=["General"];var CAT_AR={General:"x"};var VOCAB=[];var GRAMMAR=[];var EXPLAIN={};var EXPLAIN_ORDER=[];var SENTENCES=[];var SENT_FILL=[];function conjugateVerb(inf){return null;}function fillCategories(){} function fillKapitels(){} function allWords(){return VOCAB;} function kapName(k){return k;} function escapeHtml(s){return String(s);} function speak(){} function speakGerman(){} function markStudyDay(){} function toast(){} function renderAll(){} function showPage(){} var S={mistakes:{},review:{},status:{}}; function $(id){return null;}', ctx);
  ["curr-a2.js", "curr-b1.js", "curr-b2.js", "curriculum.js", "curr-a1x.js", "curr-a2b.js", "curr-b1b.js", "curr-b2b.js", "curr-b2c.js", "curr-b2d.js", "curr-b2e.js"].forEach(run);
  const R = vm.runInContext('(function(){["A2","B1","B2","A1X","A2B","B1B","B2B","B2C","B2D","B2E"].forEach(function(k){currMergeDs(k);}); var cos=SENT_FILL.filter(function(f){return f.kind==="order";}); var byLvl={},byKap={},bad=0,seen={},dups=0; cos.forEach(function(f){ byLvl[f.lvl]=(byLvl[f.lvl]||0)+1; byKap[f.chapterId]=(byKap[f.chapterId]||0)+1; var w=f.words||[]; if(!(w.length>=3&&w.length<=8))bad++; var u={},du=false; w.forEach(function(t){var n=String(t).toLowerCase().replace(/[.,?!;:…]/g,""); if(!n||u[n])du=true; u[n]=1;}); if(du)bad++; if(w.join(" ")!==f.s)bad++; var key=w.join(" ").toLowerCase(); if(seen[key])dups++; seen[key]=1; if(!/^K\\d+$/.test(f.chapterId||""))bad++; }); return {n:cos.length,byLvl:byLvl,byKap:byKap,bad:bad,dups:dups};})()', ctx);
  ok("T4 generated orders total>=300", R.n >= 300, "got " + R.n);
  ok("T4 A2>=15 B1>=15 B2>=80", (R.byLvl.A2 || 0) >= 15 && (R.byLvl.B1 || 0) >= 15 && (R.byLvl.B2 || 0) >= 80, JSON.stringify(R.byLvl));
  ok("T4 token/key/chapter rules", R.bad === 0 && R.dups === 0, "bad=" + R.bad + " dups=" + R.dups);
  const kapCount = Object.keys(R.byKap).length;
  ok("T4 chapter spread >=20 kaps", kapCount >= 20, "kaps=" + kapCount);
})();

/* ---------- T5: honesty wiring ---------- */
(function () {
  const sx = RD("client/sentex.js");
  ["function sentexCounts2", "function sxIsLib", "function sxEnsureOrderPacks", "function sxOrderPacksReady", "sx_curated", "sx_libdrills", "مكتبة A2/B1 (KX)"].forEach(m => ok("T5 sentex.js has " + m.slice(0, 28), sx.indexOf(m) >= 0));
  const cu = RD("client/curriculum.js");
  ok("T5 curriculum has currBuildOrders+hook", cu.indexOf("function currBuildOrders") >= 0 && cu.indexOf("currBuildOrders(key)") >= 0);
  const ix = RD("client/index.html");
  ["sentx-a2.js", "sentx-b1.js", "sentx-b2.js"].forEach(f => ok("T5 index.html loads " + f, ix.indexOf(f) >= 0));
  const tc = RD("client/testcenter.js");
  ok("T5 testcenter offers B2", tc.indexOf('"B1", "B2"') >= 0);
  const as = RD("client/assess.js");
  ok("T5 assess exam-b2 dispatch", as.indexOf('exam-b2') >= 0);
})();

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
