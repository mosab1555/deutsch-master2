/* Deutsch Master - curriculum integration smoke test (node + vm stubs).
 * Loads the REAL curr-*.js + curriculum.js with stubbed browser/app globals,
 * runs the real merger, and asserts counts/ids/audit. No browser needed.
 * Usage: node tools/smoke-curriculum.js (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }

const appendedScripts = [];
const sb = {
  console,
  setTimeout: (fn) => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  window: {},
};
sb.window = sb;
sb.document = {
  createElement: () => ({ set src(v) {}, addEventListener: () => {}, dataset: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } }),
  body: { appendChild: (el) => appendedScripts.push(el && el.src) },
  querySelectorAll: () => [],
};
sb.localStorage = { getItem: () => null, setItem: () => {} };
const ctx = vm.createContext(sb);
function run(file) { vm.runInContext(RD("client/" + file), ctx, { filename: file }); }

// ---- stub app globals (as defined by script.js/learn.js) ----
vm.runInContext(`
var KAPITEL=[{id:"K0",name:"Einführung",icon:"🌟"},{id:"K1",name:"K1",icon:"👋"},{id:"K2",name:"K2",icon:"👥"},{id:"K3",name:"K3",icon:"🏙"},{id:"K4",name:"K4",icon:"🍽"},{id:"K5",name:"K5",icon:"🏠"}];
var CATEGORIES=["General"];
var CAT_AR={General:"عام"};
var VOCAB=[{id:"k0w1",de:"Alltag",art:"der",ar:"الروتين",pron:"x",type:"اسم",cat:"General",ex:"ex",exAr:"y",kap:"K0",level:"A1",plural:"die Alltage",img:""}];
var GRAMMAR=[];var EXPLAIN={};var EXPLAIN_ORDER=[];var SENTENCES=[];
function fillCategories(){} function fillKapitels(){}
function allWords(){return VOCAB;} function getStatus(){return "new";}
function kapName(k){return k;} function escapeHtml(s){return String(s);}
function speak(){} function speakGerman(){} function markStudyDay(){}
function toast(){} function renderAll(){} function showPage(){}
function pickWeighted(a,n){return a.slice(0,n);}
function buildQuestions(t,c,f){return [];}
function $(id){return null;}
`, ctx);

run("curr-a2.js");
run("curriculum.js");
const C = vm.runInContext(`({
  a2: Curriculum.loaded.A2, vocab: VOCAB.length, kap: KAPITEL.length,
  gids: GRAMMAR.map(g=>g.id).join(","),
  exKeys: Object.keys(EXPLAIN).length, eoLen: EXPLAIN_ORDER.length,
  sent: SENTENCES.length, cats: CATEGORIES.length,
  w0: JSON.stringify(VOCAB[1]),
  audit: CurrAudit()
})`, ctx);

ok("S1 A2 merged eagerly", C.a2 === true);
ok("S2 vocab = 1 A1 + 109 A2", C.vocab === 110, "got " + C.vocab);
ok("S3 kapitel = 6 + 3", C.kap === 9, "got " + C.kap);
ok("S4 grammar ids g42..g53", C.gids === "g42,g43,g44,g45,g46,g47,g48,g49,g50,g51,g52,g53", "got " + C.gids);
ok("S5 explain 12 + order 12", C.exKeys === 12 && C.eoLen === 12);
ok("S6 sentences 36", C.sent === 36);
ok("S7 word shape has en/pos/level", C.w0.includes('"en"') && C.w0.includes('"level":"A2"') && C.w0.includes('"pos"'));
ok("S8 no dup words in audit", C.audit.dupWords.length === 0, JSON.stringify(C.audit.dupWords.slice(0, 3)));
ok("S9 no dup examples", C.audit.dupExamples.length === 0);
ok("S10 grammar complete", C.audit.gramIssues.length === 0, JSON.stringify(C.audit.gramIssues.slice(0, 3)));

// ---- simulate lazy B1/B2 arrival ----
run("curr-b1.js");
run("curr-b2.js");
const C2 = vm.runInContext(`(function(){currMerge("B1");currMerge("B2");return {
  b1: Curriculum.loaded.B1, b2: Curriculum.loaded.B2,
  vocab: VOCAB.length, kap: KAPITEL.length,
  gids: GRAMMAR.map(g=>g.id),
  sent: SENTENCES.length,
  audit: CurrAudit()
};})()`, ctx);
ok("S11 B1+B2 merged on demand", C2.b1 && C2.b2);
ok("S12 vocab total 1+312", C2.vocab === 313, "got " + C2.vocab);
ok("S13 kapitel total 15", C2.kap === 15, "got " + C2.kap);
ok("S14 grammar 34, ids g42..g75", C2.gids.length === 34 && C2.gids[12] === "g54" && C2.gids[24] === "g66");
ok("S15 sentences 102", C2.sent === 102, "got " + C2.sent);
ok("S16 full audit clean", C2.audit.dupWords.length === 0 && C2.audit.dupExamples.length === 0 && C2.audit.gramIssues.length === 0 && C2.audit.missingEn === 0 && C2.audit.missingEx === 0,
  "dups=" + C2.audit.dupWords.length + " ex=" + C2.audit.dupExamples.length);
// merge twice = idempotent (no dup accumulation)
vm.runInContext(`(function(){currMerge("A2");currMerge("B1");})()`, ctx);
const C3 = vm.runInContext(`VOCAB.length`, ctx);
ok("S17 re-merge idempotent", C3 === 313, "got " + C3);
console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
