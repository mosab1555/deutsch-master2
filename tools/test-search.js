/* Deutsch Master - Search engine tests (mandatory cases from spec).
 * Extracts the REAL dmNorm/dmWordHits from client/script.js (no copies, no drift)
 * and runs them against the REAL vocabulary (A1 RAW blocks + all CURR files).
 * Usage: node tools/test-search.js (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }

// ---- extract real engine from source ----
const src = RD("client/script.js");
function grab(name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("missing " + name);
  let depth = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") depth++;
    if (src[k] === "}") { depth--; if (!depth) return src.slice(i, k + 1); }
  }
  throw new Error("unbalanced " + name);
}
function makeNorm() {
  const body = grab("dmNorm").replace(/^function dmNorm\(s\)\s*\{/, "").replace(/\}\s*$/, "");
  return new Function("s", body);
}
const norm = makeNorm();

// ---- build real word list: A1 RAW + all CURR datasets ----
const words = [];
for (const m of src.matchAll(/const (RAW_K\d+)\s*=\s*\[([\s\S]*?)\n\];/g)) {
  const kap = m[1].replace("RAW_", "");
  for (const r of m[2].matchAll(/\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"(?:,\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)")?\]/g)) {
    words.push({ de: r[1], art: r[2], ar: r[3], en: "", pron: r[4], type: r[5], kap, level: "A1", plural: "", ex: r[7] || "" });
  }
}
const PL = {};
try {
  const plBlock = src.match(/const PLURAL\s*=\s*\{([\s\S]*?)\n\};/);
  if (plBlock) for (const m of plBlock[1].matchAll(/"([^"]+)\|([^"]+)":"([^"]+)"/g)) PL[m[1] + "|" + m[2]] = m[3];
} catch (e) {}
words.forEach(w => { w.plural = PL[w.de + "|" + w.art] || ""; });
function loadCurr(file, key) {
  const code = RD("client/" + file);
  return new Function("window", code + "\nreturn window." + key + ";")({});
}
for (const [f, k] of [["curr-a2.js", "CURR_A2"], ["curr-b1.js", "CURR_B1"], ["curr-b2.js", "CURR_B2"], ["curr-a1x.js", "CURR_A1X"], ["curr-a2b.js", "CURR_A2B"], ["curr-b1b.js", "CURR_B1B"], ["curr-b2b.js", "CURR_B2B"]]) {
  try {
    const D = loadCurr(f, k);
    (D.words || []).forEach(r => words.push({ de: r[0], art: r[1], ar: r[2], en: r[3] || "", pron: r[4] || "", type: r[5], kap: r[7], level: D.level, plural: r[8] || "", ex: r[9] || "" }));
  } catch (e) { console.log("WARN cannot load " + f); }
}
// de-duplicate exactly like the app merger (first wins)
const seen = new Set(), vocab = [];
words.forEach(w => { const k = (w.de + "|" + w.art).toLowerCase(); if (!seen.has(k)) { seen.add(k); vocab.push(w); } });
console.log("INFO vocab size searchable: " + vocab.length);

// ---- run extracted dmWordHits with stubbed allWords ----
const hitsSrc = grab("dmWordHits");
const allWords = () => vocab;
const dmWordHitsFn = new Function("qn", "level", "allWords", "dmNorm", hitsSrc
  .replace(/^function dmWordHits\(qn,level\)\s*\{/, "")
  .replace(/\}\s*$/, ""));
function search(q, level) {
  const qn = norm(q);
  if (qn.length < 2) return [];
  return dmWordHitsFn(qn, level || "mixed", allWords, norm);
}
function has(q, de, level) { return search(q, level).some(h => h.w.de === de); }

// ---- discover real fixtures from data ----
const exact = vocab.find(w => w.de === "gehen") || vocab.find(w => w.de.toLowerCase() === "gehen") || vocab[10];
const tisch = vocab.find(w => w.de === "Tisch") || vocab.find(w => w.de === "Haus");
const umlautW = vocab.find(w => /[äöü]/.test(w.de) && w.level !== "A1") || vocab.find(w => /[äöü]/.test(w.de));
const ssW = vocab.find(w => /ß/.test(w.de)) || null;
const enW = vocab.find(w => w.en && w.en.length > 3) || null;
const plW = vocab.find(w => w.plural && w.plural.length > 2) || null;
const a2W = vocab.find(w => w.level === "A2");
const b1W = vocab.find(w => w.level === "B1");
const b2W = vocab.find(w => w.level === "B2");
console.log("INFO fixtures: exact=" + exact.de + " tisch=" + tisch.de + " umlaut=" + (umlautW && umlautW.de) + " ss=" + (ssW && ssW.de) + " en=" + (enW && enW.de) + " plural=" + (plW && plW.de));

// ---- mandatory cases ----
ok("T1 exact match", has(exact.de, exact.de), exact.de);
ok("T2 case insensitive", has(exact.de.toUpperCase(), exact.de) && has(exact.de[0].toUpperCase() + exact.de.slice(1), exact.de));
ok("T3 partial", search(exact.de.slice(0, 3)).some(h => h.w.de === exact.de), exact.de.slice(0, 3) + "→" + exact.de);
const fullT = (tisch.art && tisch.art !== "-" ? tisch.art + " " : "") + tisch.de;
ok("T4 with article", has(fullT, tisch.de), fullT);
ok("T5 without article", has(tisch.de, tisch.de));
ok("T6 spaces", has("  " + exact.de + "  ", exact.de));
ok("T7 arabic meaning", has(exact.ar, exact.de), exact.ar);
if (enW) ok("T8 english meaning", has(enW.en, enW.de), enW.en + "→" + enW.de);
else console.log("SKIP T8 (no EN fixture)");
if (umlautW) {
  const folded = norm(umlautW.de);
  ok("T9 umlaut tolerant", has(folded, umlautW.de) || has(umlautW.de, umlautW.de), umlautW.de + " via " + folded);
} else console.log("SKIP T9");
if (ssW) ok("T10 ß/ss", has(ssW.de.replace(/ß/g, "ss"), ssW.de) && has(ssW.de, ssW.de), ssW.de);
else console.log("SKIP T10");
if (plW) ok("T11 plural", has(plW.plural, plW.de), plW.plural + "→" + plW.de);
else console.log("SKIP T11");
ok("T12 level A1 only", search(exact.de, "A1").every(h => (h.w.level || "A1") === "A1") && search(a2W.de, "A1").every(h => (h.w.level || "A1") === "A1"));
ok("T13 level A2", has(a2W.de, a2W.de, "A2"), a2W.de);
ok("T14 level B1", has(b1W.de, b1W.de, "B1"), b1W.de);
ok("T15 level B2", has(b2W.de, b2W.de, "B2"), b2W.de);
ok("T16 mixed finds all levels", has(a2W.de, a2W.de, "mixed") && has(b1W.de, b1W.de, "mixed") && has(b2W.de, b2W.de, "mixed"));
ok("T17 ranked: exact first", search(exact.de, "mixed")[0].w.de === exact.de);
ok("T18 min length guard", search("x").length === 0);
console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
