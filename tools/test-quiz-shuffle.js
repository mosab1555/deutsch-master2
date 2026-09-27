/* Deutsch Master — Quiz fairness test (answer-position randomization).
   Tests the REAL helpers extracted from client/script.js + client/reference.js:
   1. Permutation validity (every shuffle is a true permutation).
   2. Distribution balance (correct answer not stuck at position 0).
   3. Correctness preservation (shuffled position still marks the right answer).
   4. Root-cause data audit (where stored correct indices cluster).
   5. Static wiring (render sites use shuffle + index remap, no position-0 assumption).
   6. Runtime distribution of the reference renderer via DOM stubs.
   Exit 0 = PASS. Usage: node tools/test-quiz-shuffle.js
*/
const fs = require("fs");
const path = require("path");
const CDIR = path.join(__dirname, "..", "client");
const RD = f => fs.readFileSync(path.join(CDIR, f), "utf8");
let fails = 0;
function bad(m) { fails++; console.log("FAIL " + m); }
function good(m) { console.log("PASS " + m); }

/* ---------- extract real functions by brace matching ---------- */
function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) return null;
  const bi = src.indexOf("{", start);
  let depth = 0;
  for (let k = bi; k < src.length; k++) {
    if (src[k] === "{") depth++;
    else if (src[k] === "}") { depth--; if (depth === 0) return src.slice(start, k + 1); }
  }
  return null;
}
const scriptSrc = RD("script.js");
const refSrc = RD("reference.js");
const shuffleSrc = extractFn(scriptSrc, "shuffle");
const dmOrderSrc = extractFn(scriptSrc, "dmQuizOrder");
const refShufSrc = extractFn(refSrc, "refShuffleIdx");
if (!shuffleSrc) bad("shuffle() not found in script.js");
if (!dmOrderSrc) bad("dmQuizOrder() not found in script.js");
if (!refShufSrc) bad("refShuffleIdx() not found in reference.js");
let shuffle = null, dmQuizOrder = null, refShuffleIdx = null;
try {
  const H = new Function(shuffleSrc + ";" + dmOrderSrc + ";" + refShufSrc + ";return {a:shuffle,b:dmQuizOrder,c:refShuffleIdx};")();
  shuffle = H.a; dmQuizOrder = H.b; refShuffleIdx = H.c;
  good("extracted real helpers from app sources");
} catch (e) { bad("helper eval failed: " + e.message); }

/* ---------- 1. permutation validity ---------- */
if (shuffle && dmQuizOrder && refShuffleIdx) {
  [2, 3, 4, 5].forEach(n => {
    for (let t = 0; t < 500; t++) {
      [dmQuizOrder(n), refShuffleIdx(n), shuffle([0, 1, 2, 3, 4].slice(0, n))].forEach(perm => {
        const s = perm.slice().sort((a, b) => a - b).join(",");
        const exp = Array.from({ length: n }, (_, i) => i).join(",");
        if (s !== exp || new Set(perm).size !== n) { bad("non-permutation n=" + n + ": " + perm); t = 9999; return; }
      });
    }
  });
  good("all shuffles return true permutations (n=2..5 x500)");
}

/* ---------- 2+3. distribution balance + correctness preservation ---------- */
function distReport(label, fn, n, runs) {
  const counts = new Array(n).fill(0);
  for (let t = 0; t < runs; t++) {
    const correct = Math.floor(Math.random() * n);
    const order = fn(n);
    const pos = order.indexOf(correct);
    if (pos < 0) { bad(label + " lost correct answer"); return; }
    const opts = Array.from({ length: n }, (_, i) => "opt" + i);
    if (opts[order[pos]] !== opts[correct]) { bad(label + " remap mismatch"); return; }
    counts[pos]++;
  }
  const pcts = counts.map(c => Math.round(c / runs * 100));
  const lo = n === 4 ? 17 : 24, hi = n === 4 ? 33 : 43;
  const ok = pcts.every(p => p >= lo && p <= hi);
  if (ok) good(label + " n=" + n + " balanced [" + pcts.join("/") + "%]");
  else bad(label + " n=" + n + " skewed [" + pcts.join("/") + "%]");
}
if (shuffle && dmQuizOrder && refShuffleIdx) {
  distReport("dmQuizOrder", dmQuizOrder, 4, 6000);
  distReport("dmQuizOrder", dmQuizOrder, 3, 6000);
  distReport("refShuffleIdx", refShuffleIdx, 4, 6000);
  distReport("refShuffleIdx", refShuffleIdx, 3, 6000);
}

/* ---------- 4. root-cause data audit (stored correct indices) ---------- */
function countCorrect(src, from, to) {
  const seg = to ? src.slice(src.indexOf(from), src.indexOf(to)) : src.slice(src.indexOf(from));
  const m = [...seg.matchAll(/correct\s*:\s*(\d+)/g)].map(x => parseInt(x[1], 10));
  const dist = {};
  m.forEach(v => { dist[v] = (dist[v] || 0) + 1; });
  return { n: m.length, dist };
}
try {
  const exSrc = RD("explain.js");
  const r1 = countCorrect(exSrc, "const EXPLAIN");
  console.log("INFO explain drills stored correct: n=" + r1.n + " " + JSON.stringify(r1.dist));
  const gStart = scriptSrc.indexOf("const RAW_GRAM");
  const gEnd = scriptSrc.indexOf("function buildGram");
  let r2 = { n: 0, dist: {} };
  if (gStart >= 0 && gEnd > gStart) {
    const RAW = new Function(scriptSrc.slice(gStart, gEnd) + ";return RAW_GRAM;")();
    RAW.forEach(g => { const v = parseInt(g[g.length - 2], 10); if (!isNaN(v)) r2.dist[v] = (r2.dist[v] || 0) + 1; });
    r2.n = RAW.length;
  }
  console.log("INFO grammar bank stored correct: n=" + r2.n + " " + JSON.stringify(r2.dist));
  good("data audit done (bias at rest is OK only because render shuffles)");
} catch (e) { bad("data audit failed: " + e.message); }

/* ---------- 5. static wiring: shuffle used + no position-0 assumption ---------- */
function has(f, s) { return RD(f).includes(s); }
function lacks(f, s) { return !RD(f).includes(s); }
[
  ["script.js", "dmQuizOrder(E.drill[0].opts.length)", "exDrill render shuffles"],
  ["script.js", "dmQuizOrder(g.quiz.opts.length)", "exQuiz render shuffles"],
  ["script.js", 'getAttribute("data-i"),10)===dr.correct', "exDrill correct remapped by original index"],
  ["script.js", 'getAttribute("data-i"),10)===g.quiz.correct', "exQuiz correct remapped by original index"],
  ["reference.js", "refShuffleIdx(q.opts.length)", "reference choice render shuffles"],
  ["reference.js", "refShuffleIdx(q.words.length)", "reference order bank shuffles"],
  ["reference.js", 'getAttribute("data-oi"),10)===q.correct', "reference correct remapped by original index"]
].forEach(([f, s, label]) => { if (has(f, s)) good(label); else bad(label + " MISSING"); });
[
  ["script.js", 'querySelectorAll("#exDrillOpts .quiz-opt")[dr.correct]', "old exDrill position-0 highlight removed"],
  ["script.js", 'querySelectorAll("#exQuizOpts .quiz-opt")[g.quiz.correct]', "old exQuiz position-0 highlight removed"],
  ["reference.js", 'querySelectorAll(".quiz-opt")[q.correct]', "old reference position-0 highlight removed"]
].forEach(([f, s, label]) => { if (lacks(f, s)) good(label); else bad(label + " STILL PRESENT"); });

/* ---------- 6. runtime distribution of reference renderer (DOM stubs) ---------- */
try {
  function makeEl(id) {
    return {
      _id: id, innerHTML: "", textContent: "", value: "", disabled: false,
      addEventListener() {}, scrollIntoView() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      getAttribute() { return null; }, setAttribute() {}, appendChild() {},
      classList: { add() {}, remove() {}, toggle() {} }
    };
  }
  const els = {};
  const docStub = {
    getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
    querySelectorAll() { return []; }, createElement() { return makeEl("dyn"); }
  };
  const html = RD("index.html");
  const dataFiles = [...html.matchAll(/<script src="(reference-data-[^"]+\.js)"><\/script>/g)].map(m => m[1]);
  const g = { document: docStub, window: {}, I18N: { ar: {}, en: {}, de: {} }, S: { uiLang: "ar" } };
  const gkeys = Object.keys(g);
  const prelude = gkeys.map(k => "var " + k + "=__G." + k + ";").join("");
  dataFiles.forEach(f => {
    const src = RD(f);
    const names = [...src.matchAll(/^var (REF_[A-Z][A-Z0-9]*)/gm)].map(m => m[1]);
    const exp = new Function("__G", prelude + src + ";return {" + names.map(n => n + ":(typeof " + n + "!==\"undefined\"?" + n + ":undefined)").join(",") + "};")(g);
    names.forEach(n => { g.window[n] = exp[n]; });
  });
  const mkEng = () => new Function("__G", prelude + "var document=__G.document,window=__G.window,I18N=__G.I18N,S=__G.S;" + refSrc + ";return {openRefTopic:openRefTopic,refTopicById:refTopicById,refPathTopics:refPathTopics,REF_PATHS:REF_PATHS,refValidQuiz:refValidQuiz};")(g);
  const engBox = mkEng();
  // per-question display-position tally across repeated renders
  const tally = { 2: [0, 0], 3: [0, 0, 0], 4: [0, 0, 0, 0] };
  let blocks = 0, missing = 0;
  const allTids = [];
  engBox.REF_PATHS.forEach(p => engBox.refPathTopics(p.id).forEach(tp => {
    if ((tp.quiz || []).some(q => !q.type)) allTids.push(tp.id);
  }));
  allTids.forEach(tid => {
    for (let t = 0; t < 20; t++) {
      engBox.openRefTopic(tid);
      const h = docStub.getElementById("refDetail").innerHTML;
      const found = engBox.refTopicById(tid);
      const validQ = found.topic.quiz.filter(engBox.refValidQuiz);
      h.split('<div class="ref-q"').slice(1).forEach(part => {
        const mQi = part.match(/data-qi="(\d+)" data-qtype="choice"/);
        if (!mQi) return;
        const q = validQ[parseInt(mQi[1], 10)];
        if (!q || q.type) return;
        const seg = part.split("ex-nav bottom")[0];
        const seq = [...seg.matchAll(/data-oi="(\d)"/g)].map(m => parseInt(m[1], 10));
        if (!seq.includes(q.correct)) { missing++; return; }
        if (seq.length !== q.opts.length) { missing++; return; }
        blocks++;
        if (tally[seq.length]) tally[seq.length][seq.indexOf(q.correct)]++;
      });
    }
  });
  if (missing) bad("correct option missing/misplaced in " + missing + " rendered blocks");
  else good("correct option present in every rendered block (" + blocks + " blocks)");
  Object.keys(tally).forEach(n => {
    const tot = tally[n].reduce((a, b) => a + b, 0);
    if (!tot) return;
    const pcts = tally[n].map(c => Math.round(c / tot * 100));
    const ok = n === "4" ? pcts.every(p => p >= 10 && p <= 40) : (n === "3" ? pcts.every(p => p >= 15 && p <= 55) : pcts.every(p => p >= 35 && p <= 65));
    if (ok) good("runtime n=" + n + " display positions balanced [" + pcts.join("/") + "%] over " + tot + " renders");
    else bad("runtime n=" + n + " skewed [" + pcts.join("/") + "%]");
  });
} catch (e) { bad("runtime distribution failed: " + e.message); }

console.log("----");
if (fails) { console.log("RESULT: FAIL (" + fails + ")"); process.exit(1); }
console.log("RESULT: PASS");
