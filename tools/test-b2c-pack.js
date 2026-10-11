/* Deutsch Master - B2C pack validator (Batch 1: K15-K17).
 * Validates client/curr-b2c.js schema, Arabic presence, chapter mapping,
 * uniqueness vs library bank + all CURR overlays, grammar quiz integrity,
 * sentence/listening/reading shape. Exit 0 = PASS, 1 = FAIL.
 * Usage: node tools/test-b2c-pack.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }
function norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }

global.window = {};
require(path.join(root, "client", "curr-b2c.js"));
const B = global.window.CURR_B2C;
ok("B1 pack loads with level B2", B && B.level === "B2");
ok("B2 chapters K15-K17 declared", B && Array.isArray(B.kapitel) && ["K15", "K16", "K17"].every(k => B.kapitel.some(x => x[0] === k)), JSON.stringify((B.kapitel || []).map(k => k[0])));

const AR = /[\u0600-\u06FF]/;
const TYPES = ["اسم", "فعل", "صفة", "ضمير", "أداة", "مفردات"];
const KAPS = ["K15", "K16", "K17"];
let wErr = [];
const seenW = new Set();
(B.words || []).forEach((r, i) => {
  const tag = "w" + i + ":" + r[0];
  if (!Array.isArray(r) || r.length !== 12) { wErr.push(tag + ":badlen"); return; }
  const [de, art, ar, en, pron, type, cat, kap, plural, ex, exAr] = r;
  if (!de || !de.trim()) wErr.push(tag + ":node");
  if (/[\u0600-\u06FF]/.test(de) || /[\u0600-\u06FF]/.test(ex || "")) wErr.push(tag + ":ar-in-de");
  if (!ar || !AR.test(ar)) wErr.push(tag + ":noar");
  if (!TYPES.includes(type)) wErr.push(tag + ":badtype");
  if (!KAPS.includes(kap)) wErr.push(tag + ":badkap");
  if (type === "اسم") {
    if (!/^[A-ZÄÖÜ]/.test(de)) wErr.push(tag + ":nocap");
    if (!["der", "die", "das"].includes(art)) wErr.push(tag + ":noart");
    if (!String(plural || "").trim()) wErr.push(tag + ":noplural");
  } else if (art !== "-") wErr.push(tag + ":art");
  if (!ex || ex.split(" ").length < 3) wErr.push(tag + ":noex");
  if (!exAr || !AR.test(exAr)) wErr.push(tag + ":noexar");
  const k = norm(de) + "|" + art;
  if (seenW.has(k)) wErr.push(tag + ":selfdup");
  seenW.add(k);
});
ok("B3 words valid (120, 40 per chapter)", B.words.length === 120 && wErr.length === 0, "n=" + B.words.length + " err=" + wErr.slice(0, 5).join(";"));
const perKap = {};
(B.words || []).forEach(r => { perKap[r[7]] = (perKap[r[7]] || 0) + 1; });
ok("B4 words 40/40/40 per K15/K16/K17", perKap.K15 === 40 && perKap.K16 === 40 && perKap.K17 === 40, JSON.stringify(perKap));

// uniqueness vs banks
const vocab = JSON.parse(fs.readFileSync(path.join(root, "tools/clib/.cache/vocab.json"), "utf8"));
const tmap = { "اسم": "noun", "فعل": "verb", "صفة": "adj", "ضمير": "pron", "أداة": "func", "مفردات": "adv" };
const vkeys = new Set(vocab.map(w => norm(w.de) + "|" + w.type));
function loadCurr(f) {
  global.window = {};
  delete require.cache[require.resolve(path.join(root, "client", f))];
  require(path.join(root, "client", f));
  const k = Object.keys(global.window).find(x => x.startsWith("CURR_"));
  return global.window[k];
}
const ckeys = new Set();
["curr-a1x.js", "curr-a2.js", "curr-a2b.js", "curr-b1.js", "curr-b1b.js", "curr-b2.js", "curr-b2b.js"].forEach(f => {
  const D = loadCurr(f);
  (D.words || []).forEach(r => ckeys.add(norm(r[0]) + "|" + r[1]));
});
const dupL = B.words.filter(r => vkeys.has(norm(r[0]) + "|" + (tmap[r[5]] || "?")));
const dupC = B.words.filter(r => ckeys.has(norm(r[0]) + "|" + r[1]));
ok("B5 zero duplicates vs 104k library bank", dupL.length === 0, dupL.slice(0, 3).map(r => r[0]).join(","));
ok("B6 zero duplicates vs CURR overlays", dupC.length === 0, dupC.slice(0, 3).map(r => r[0]).join(","));

// grammar
let gErr = [];
(B.grammar || []).forEach((g, i) => {
  const tag = "g" + i + ":" + g[0];
  const n = g.length;
  if (n < 8) { gErr.push(tag + ":len"); return; }
  const body = g[2], q = g[n - 4], opts = String(g[n - 3]).split("|"), ci = parseInt(g[n - 2], 10);
  if (!body || body.length < 80) gErr.push(tag + ":body");
  if (!AR.test(body || "")) gErr.push(tag + ":bodynoar");
  if (g.slice(3, n - 4).length < 2) gErr.push(tag + ":ex");
  if (!KAPS.includes(g[1])) gErr.push(tag + ":kap");
  if (opts.length < 3 || !(ci >= 0 && ci < opts.length)) gErr.push(tag + ":quiz");
});
ok("B7 grammar units valid (12, 4 per chapter)", B.grammar.length === 12 && gErr.length === 0, "n=" + B.grammar.length + " err=" + gErr.slice(0, 3).join(";"));

// sentences
const sents = JSON.parse(fs.readFileSync(path.join(root, "tools/clib/.cache/sentences.json"), "utf8"));
const sset = new Set(sents.map(s => norm(s.de)));
let sErr = [], sDup = 0;
const sseen = new Set();
(B.sentences || []).forEach((s, i) => {
  if (!Array.isArray(s) || s.length !== 4) { sErr.push("s" + i + ":len"); return; }
  const [de, ar, , kap] = s;
  if (!de || de.split(" ").length < 3 || !/[.?!]$/.test(de)) sErr.push("s" + i + ":de");
  if (!ar || !AR.test(ar)) sErr.push("s" + i + ":ar");
  if (!KAPS.includes(kap)) sErr.push("s" + i + ":kap");
  if (sset.has(norm(de))) sDup++;
  if (sseen.has(norm(de))) sErr.push("s" + i + ":selfdup");
  sseen.add(norm(de));
});
ok("B8 sentences valid + unique (48)", B.sentences.length === 48 && sErr.length === 0 && sDup === 0, "n=" + B.sentences.length + " err=" + sErr.slice(0, 3).join(";") + " libdup=" + sDup);

// skills
ok("B9 reading 6 + listening 6 + speaking 6 + real 3", (B.reading || []).length === 6 && (B.listen || []).length === 6 && (B.speak || []).length === 6 && (B.real || []).length === 3,
  "r=" + (B.reading || []).length + " l=" + (B.listen || []).length + " s=" + (B.speak || []).length + " real=" + (B.real || []).length);
let skErr = 0;
(B.reading || []).forEach(r => { if (!r.kap || !r.title || !r.de || !r.ar || !Array.isArray(r.qs) || !r.qs.length) skErr++; });
(B.listen || []).forEach(l => { if (l.level !== "B2" || !KAPS.includes(l.kap) || !Array.isArray(l.lines) || l.lines.length < 4) skErr++; });
(B.speak || []).forEach(s => { if (s.level !== "B2" || !Array.isArray(s.hints) || s.hints.length < 2) skErr++; });
(B.real || []).forEach(r => { if (!r.id || (r.phrases || []).length < 3 || (r.dialogue || []).length < 3) skErr++; });
ok("B10 skill blocks well-formed", skErr === 0);

// explain encyclopedia map (gx0-gx11 -> 12 grammar units, renderer-required fields)
const EX = B.explain || {};
const gxKeys = Object.keys(EX).filter(k => /^gx\d+$/.test(k));
ok("B11 explain map has gx0-gx11", gxKeys.length === 12 && Array.from({ length: 12 }, (_, i) => "gx" + i).every(k => EX[k]),
  "keys=" + gxKeys.length);
let xErr = [];
Object.keys(EX).forEach(k => {
  const e = EX[k], tag = "x" + k;
  if (e.level !== "B2") xErr.push(tag + ":level");
  ["goals", "when", "how", "examples", "daily", "notes", "mistakes"].forEach(f => {
    if (!Array.isArray(e[f]) || !e[f].length) xErr.push(tag + ":" + f);
  });
  ["what", "why", "compare", "summary"].forEach(f => {
    if (!e[f] || typeof e[f] !== "string") xErr.push(tag + ":" + f);
  });
  (e.examples || []).forEach(x => { if (!x[0] || !AR.test(x[1] || "")) xErr.push(tag + ":ex"); });
  (e.mistakes || []).forEach(m => { if (!m.w || !m.r || !m.why) xErr.push(tag + ":mist"); });
  const d = (e.drill || [])[0];
  if (!d || !d.t || !Array.isArray(d.opts) || d.opts.length < 3 || !(d.correct >= 0 && d.correct < d.opts.length) || !d.why) xErr.push(tag + ":drill");
  const rv = e.review || {};
  if (!rv.rule || !rv.words || !rv.example || !rv.mistake || !rv.q) xErr.push(tag + ":review");
});
ok("B12 explain entries encyclopedia-complete", xErr.length === 0, xErr.slice(0, 5).join(";"));

// B13: German-dominant explain fields must not leak Arabic script (e.g. U+061F ؟
// instead of ?). Covers examples[*][0], daily[*][0], review.example, mistakes r.
// mistakes.w is excluded: Arabic parenthetical glosses there (e.g. "(رسمي)",
// "(فاعلان)") are an established convention across older packs (a2 g51, b1 g64,
// b1b gx2/gx3/gx5, b2 g67/g69/g75) and B2C follows it.
// Drill titles/opts are excluded: Arabic prompts and the gx4 meta-question with
// Arabic options are by design (mirrors the compact grammar-row quiz convention).
let deErr = [];
Object.keys(EX).forEach(k => {
  const e = EX[k], tag = "x" + k;
  (e.examples || []).forEach((x, i) => { if (AR.test(x[0] || "")) deErr.push(tag + ":ex" + i); });
  (e.daily || []).forEach((x, i) => { if (AR.test(x[0] || "")) deErr.push(tag + ":daily" + i); });
  if (AR.test((e.review || {}).example || "")) deErr.push(tag + ":review.example");
  (e.mistakes || []).forEach((m, i) => {
    if (AR.test(m.r || "")) deErr.push(tag + ":mist.r" + i);
  });
});
ok("B13 no Arabic script in German explain fields (examples/daily/review/mistakes.r)", deErr.length === 0, deErr.slice(0, 5).join(";"));

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
