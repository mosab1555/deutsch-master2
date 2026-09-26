/* Deutsch Master - curriculum integration smoke test (node + vm stubs).
 * Loads ALL real curr-*.js + curriculum.js, runs the real merger incl. fills,
 * asserts counts/ids/audit. Usage: node tools/smoke-curriculum.js
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }

const sb = { console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, window: {} };
sb.window = sb;
sb.document = {
  createElement: () => ({ set src(v) {}, addEventListener: () => {}, dataset: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } }),
  body: { appendChild: () => {} },
  querySelectorAll: () => [],
  addEventListener: () => {},
};
sb.localStorage = { getItem: () => null, setItem: () => {} };
const ctx = vm.createContext(sb);
function run(file) { vm.runInContext(RD("client/" + file), ctx, { filename: file }); }

vm.runInContext(`
var KAPITEL=[{id:"K0"},{id:"K1"},{id:"K2"},{id:"K3"},{id:"K4"},{id:"K5"},{id:"K6"},{id:"K7"},{id:"K8"},{id:"K9"},{id:"K10"},{id:"K11"},{id:"K12"},{id:"K13"},{id:"K14"}];
var CATEGORIES=["General"];var CAT_AR={General:"عام"};
var VOCAB=[{id:"a1",de:"Haus",art:"das",ar:"بيت",pron:"x",type:"اسم",cat:"General",ex:"Das Haus.",exAr:"y",kap:"K0",level:"A1",plural:"die Häuser",img:""}];
var GRAMMAR=[];var EXPLAIN={};var EXPLAIN_ORDER=[];var SENTENCES=[];var SENT_FILL=[];
function conjugateVerb(inf){var b=inf.replace(/en$/,"");return{ich:"ich "+b+"e",du:"du "+b+"st",er:"er "+b+"t",wir:inf,ihr:"ihr "+b+"t"};}
function fillCategories(){} function fillKapitels(){}
function allWords(){return VOCAB;} function getStatus(){return "new";}
function kapName(k){return k;} function escapeHtml(s){return String(s);}
function speak(){} function speakGerman(){} function markStudyDay(){}
function toast(){} function renderAll(){} function showPage(){}
function pickWeighted(a,n){return a.slice(0,n);}
function buildQuestions(t,c,f){return [];}
function wordById(id){return VOCAB.find(function(w){return w.id===id;})||null;}
function quizTypeName(t){return t;}
function renderGrammar(){}
var S={mistakes:{},review:{},status:{}};
function $(id){return null;}
`, ctx);

for (const f of ["curr-a2.js", "curr-b1.js", "curr-b2.js", "curriculum.js"]) run(f);
// simulate lazy arrival of expansion packs in queue order
for (const f of ["curr-a1x.js", "curr-a2b.js", "curr-b1b.js", "curr-b2b.js"]) run(f);
const C = vm.runInContext(`(function(){
  ["B1","B2","B1B","B2B","A1X","A2B"].forEach(function(k){currMergeDs(k);});
  var gids=GRAMMAR.map(function(g){return g.id;});
  var uniq={};gids.forEach(function(id){uniq[id]=(uniq[id]||0)+1;});
  var dupG=Object.keys(uniq).filter(function(k){return uniq[k]>1;});
  return {
    vocab: VOCAB.length, gram: GRAMMAR.length, sent: SENTENCES.length,
    fills: SENT_FILL.length, reading: CURR_READING.length,
    eoLen: EXPLAIN_ORDER.length, exKeys: Object.keys(EXPLAIN).length,
    dupG: dupG, gmax: Math.max.apply(null,gids.map(function(g){return parseInt(g.slice(1),10);})),
    audit: CurrAudit()
  };
})()`, ctx);

ok("S1 vocab = 1 + 1883 (957 + 926 A1 PDF import)", C.vocab === 1884, "got " + C.vocab);
ok("S2 grammar = 58", C.gram === 58, "got " + C.gram);
ok("S3 grammar ids unique", C.dupG.length === 0, JSON.stringify(C.dupG));
ok("S4 explain entries = 58", C.exKeys === 58 && C.eoLen === 58, C.exKeys + "/" + C.eoLen);
ok("S5 sentences = 218", C.sent === 218, "got " + C.sent);
ok("S6 reading texts = 11", C.reading === 11, "got " + C.reading);
ok("S7 generated fills > 500", C.fills > 500, "got " + C.fills);
ok("S8 audit clean", C.audit.dupWords.length === 0 && C.audit.dupExamples.length === 0 && C.audit.gramIssues.length === 0,
  "dups=" + C.audit.dupWords.length + " ex=" + C.audit.dupExamples.length + " g=" + C.audit.gramIssues.length);
const R = vm.runInContext(`(function(){
  var g = GRAMMAR.find(function(x){return x.id==="g42";});
  var qs = currRuleQs(g, 5);
  var gq = currGrammarQuizQs("A2", 10);
  var rq = currReadingQuizQs("B1", 6);
  return { n: qs.length, ok: qs.every(function(q){return q.prompt && q.opts && q.opts.length>=2 && q.correctText && q.explain;}), gq: gq.length, rq: rq.length };
})()`, ctx);
ok("S9 rule-drill Qs test the rule", R.n >= 2 && R.ok, "n=" + R.n);
ok("S10 grammar/reading quiz sets", R.gq === 10 && R.rq >= 3, "g=" + R.gq + " r=" + R.rq);
console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
