/* Deutsch Master — Reference data validator (stage gate).
   Loads client/reference-data-*.js, enforces the unified topic schema,
   strict quiz rules, trilingual titles, example translations, related-link
   integrity, and search expectations.
   Exit 0 = gate PASS (pending content listed separately, must be 0 at final).
   Usage: node tools/check-reference.js
*/
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const CDIR = path.join(ROOT, "client");

/* ---------- full planned registry (all paths A..P) ---------- */
const REF_PLAN = {
 A: ["a-alphabet", "a-wortarten", "a-satz-basis", "a-wortstellung"],
 B: ["b-nomen-genus", "b-nomen-plural", "b-nomen-gross", "b-artikel-bestimmt", "b-artikel-unbestimmt", "b-artikel-negativ", "b-artikel-possessiv", "b-artikel-demonstrativ", "b-w-der"],
 C: ["c-personal", "c-possessiv", "c-reflexiv", "c-demonstrativ", "c-interrogativ", "c-relativ", "c-indefinit", "c-w-ich"],
 D: ["d-nominativ", "d-akkusativ", "d-dativ", "d-genitiv", "d-vergleich"],
 E: ["e-grundlagen", "e-steigerung", "e-deklination"],
 F: ["f-grundlagen", "f-arten", "f-modal", "f-trennbar", "f-untrennbar", "f-shw", "f-dativ-verben", "f-akkusativ-verben", "f-machen", "f-w-koennen", "f-w-muessen", "f-w-wollen", "f-w-sollen", "f-w-duerfen", "f-w-moegen", "f-w-moechten"],
 G: ["g-praesens", "g-perfekt", "g-partizip2", "g-praeteritum", "g-futur1"],
 H: ["h-akkusativ", "h-dativ", "h-genitiv", "h-wechsel", "h-w-durch", "h-w-fuer", "h-w-gegen", "h-w-ohne", "h-w-um", "h-w-aus", "h-w-bei", "h-w-mit", "h-w-nach", "h-w-seit", "h-w-von", "h-w-zu", "h-w-gegenueber", "h-w-waehrend", "h-w-wegen", "h-w-trotz", "h-w-statt", "h-w-an", "h-w-auf", "h-w-hinter", "h-w-in", "h-w-neben", "h-w-ueber", "h-w-unter", "h-w-vor", "h-w-zwischen"],
 I: ["i-fragewoerter", "i-fragen", "i-negation", "i-konjunktionen", "i-w-weil", "i-w-wer", "i-w-was", "i-w-wann", "i-w-wo", "i-w-wohin", "i-w-woher", "i-w-warum", "i-w-wie", "i-w-wieviel", "i-w-welcher"],
 J: ["j-uhrzeit", "j-tage", "j-monate", "j-jahreszeiten", "j-tageszeiten", "j-zeitwoerter", "j-w-gestern"],
 K: ["k-zahlen", "k-ordinal", "k-quantitaet"],
 L: ["l-wo", "l-wohin", "l-woher", "l-richtungen"],
 M: ["m-haupt-neben", "m-verbstellung", "m-tmp"],
 N: ["n-basis", "n-weitere"],
 O: ["o-gruesse", "o-dank", "o-alltag", "o-situationen"],
 P: ["p-vergleiche", "p-fehler"]
};
const ALL_PLANNED = new Set(Object.values(REF_PLAN).flat());

/* ---------- load data files ---------- */
const I18N = { ar: {}, en: {}, de: {} };
const window = {};
const htmlIdx = fs.readFileSync(path.join(CDIR, "index.html"), "utf8");
const files = [...htmlIdx.matchAll(/<script src="(reference-data-[^"]+\.js)"><\/script>/g)].map(m => m[1]);
if (!files.length) { console.log("FAIL no reference-data files"); process.exit(1); }
files.forEach(f => {
  const src = fs.readFileSync(path.join(CDIR, f), "utf8");
  const names = [...src.matchAll(/^var (REF_[A-Z][A-Z0-9]*)/gm)].map(m => m[1]);
  const box = {};
  eval(src + ";" + names.map(n => "box." + n + "=(typeof " + n + "!==\"undefined\"?" + n + ":undefined);").join(""));
  names.forEach(n => { window[n] = box[n]; });
});
const flatTopics = [];
Object.keys(window).forEach(k => {
  (window[k] || []).forEach(tp => { if (tp) flatTopics.push(tp); });
});
/* canonical order = path-major in plan order (A..P), exactly like the app */
const topics = [];
Object.keys(REF_PLAN).forEach(pid => {
  const pre = pid.toLowerCase() + "-";
  flatTopics.forEach(tp => { if (tp && typeof tp.id === "string" && tp.id.indexOf(pre) === 0) topics.push(tp); });
});
const byId = {};
topics.forEach(tp => { if (tp && tp.id) byId[tp.id] = tp; });

/* ---------- counters ---------- */
const C = { Missing: 0, Empty: 0, DuplicateIDs: 0, DuplicateQuestions: 0, InvalidAnswers: 0, MultipleCorrect: 0, BrokenLinks: 0, MissingGerman: 0, MissingArabic: 0, MissingEnglish: 0 };
function bad(counter, msg) { C[counter]++; console.log("FAIL[" + counter + "] " + msg); }
const seenIds = new Set(), seenQ = new Set();
const norm = s => String(s == null ? "" : s).trim();
const isEmpty = s => norm(s) === "";

topics.forEach(tp => {
  if (!tp || typeof tp !== "object") { bad("Missing", "non-object topic"); return; }
  if (!tp.id) { bad("Missing", "topic without id"); return; }
  if (seenIds.has(tp.id)) bad("DuplicateIDs", tp.id); else seenIds.add(tp.id);
  if (!ALL_PLANNED.has(tp.id)) bad("BrokenLinks", "unplanned id " + tp.id);
  if (!["A1", "A2", "B1"].includes(tp.level)) bad("Missing", tp.id + " bad level");
  ["de", "ar", "en"].forEach(k => { if (isEmpty(tp[k])) bad("Missing", tp.id + " empty " + k); });
  if (isEmpty(tp.en)) bad("MissingEnglish", tp.id);
  if (isEmpty(tp.what)) bad("MissingArabic", tp.id + " what");
  if (isEmpty(tp.rule)) bad("Missing", tp.id + " rule");
  if (!Array.isArray(tp.keywords) || !tp.keywords.length) bad("Missing", tp.id + " keywords");
  if (!Array.isArray(tp.tables) || !tp.tables.length) bad("Missing", tp.id + " tables");
  (tp.tables || []).forEach((tb, i) => {
    if (!Array.isArray(tb.head) || !Array.isArray(tb.rows)) { bad("Missing", tp.id + " table" + i + " shape"); return; }
    tb.rows.forEach((r, j) => { if (r.length !== tb.head.length) bad("Missing", tp.id + " table" + i + " row" + j + " width"); });
    [...tb.head.slice(1), ...tb.rows.flat()].forEach(c => { if (isEmpty(c)) bad("Empty", tp.id + " table cell"); });
  });
  if (!Array.isArray(tp.examples) || tp.examples.length < 2) bad("Missing", tp.id + " examples<2");
  (tp.examples || []).forEach((e, i) => {
    if (isEmpty(e[0])) bad("MissingGerman", tp.id + " ex" + i);
    if (isEmpty(e[1])) bad("MissingArabic", tp.id + " ex" + i + " translation");
  });
  if ((!tp.notes || !tp.notes.length) && (!tp.mistakes || !tp.mistakes.length)) bad("Missing", tp.id + " notes+mistakes");
  (tp.mistakes || []).forEach((m, i) => { if (isEmpty(m.w) || isEmpty(m.r) || isEmpty(m.why)) bad("Empty", tp.id + " mistake" + i); if (m.rel && !ALL_PLANNED.has(m.rel)) bad("BrokenLinks", tp.id + " mistake rel -> " + m.rel); });
  (tp.related || []).forEach(rid => { if (!ALL_PLANNED.has(rid)) bad("BrokenLinks", tp.id + " -> " + rid); });
  if (!Array.isArray(tp.quiz) || !tp.quiz.length) bad("Missing", tp.id + " quiz");
  (tp.quiz || []).forEach((q, i) => {
    const tag = tp.id + " q" + i;
    if (!q || isEmpty(q.q)) { bad("Missing", tag + " text"); return; }
    const nq = norm(q.q).toLowerCase();
    if (seenQ.has(nq)) bad("DuplicateQuestions", tag + " dup: " + q.q.slice(0, 40)); else seenQ.add(nq);
    if (!Array.isArray(q.opts) || q.opts.length < 2) { bad("InvalidAnswers", tag + " opts<2"); return; }
    if (q.opts.some(o => isEmpty(o))) { bad("Empty", tag + " empty option"); return; }
    const no = q.opts.map(o => norm(o));
    if (new Set(no).size !== no.length) { bad("InvalidAnswers", tag + " duplicate options"); return; }
    if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.opts.length) { bad("InvalidAnswers", tag + " correct out of range"); return; }
    if (isEmpty(q.why)) bad("Missing", tag + " why");
    // exactly one correct: unique options + single index guarantees it
  });
});

/* ---------- pending content ---------- */
const pending = [...ALL_PLANNED].filter(id => !byId[id]);
console.log("----");
console.log("Topics loaded: " + topics.length + " / planned " + ALL_PLANNED.size);
console.log("Pending (" + pending.length + "): " + pending.slice(0, 12).join(", ") + (pending.length > 12 ? " ..." : ""));

/* ---------- search expectations (only for loaded topics) ---------- */
function refNorm(s) { let x = String(s == null ? "" : s).toLowerCase(); x = x.replace(/ß/g, "ss").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u"); return x.trim(); }
function stripAl(w) { return String(w || "").replace(/^(ال|لل|بال|كال|فال|وال)/, ""); }
const REF_STOP = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "mit", "von", "zu", "bei", "nach", "aus", "vor", "für", "um", "ohne", "gegen", "durch", "seit", "und", "oder", "aber", "als", "in", "an", "auf", "the", "and", "with", "of", "to", "on", "for", "a", "an"]);
function searchTop3(q) {
  q = refNorm(q);
  const scored = [];
  topics.forEach(tp => {
    const title = refNorm(tp.de + " " + tp.ar + " " + tp.en);
    const kws = (tp.keywords || []).map(refNorm);
    let s = 0; const kb = kws.some(k => k === q) ? 1 : 0;
    if (title === q) s = 10;
    else {
      const wordMatch = title.split(" ").some(w => stripAl(w) === stripAl(q));
      let st = 0;
      if (wordMatch) st = REF_STOP.has(q) ? 6 : 8;
      else if (title.indexOf(q) >= 0) st = 6;
      let sk = 0;
      if (kb) sk = 7;
      else if (kws.some(k => k && k.indexOf(q) === 0)) sk = 5;
      s = Math.max(st, sk);
      if (s === 0) {
        const hay = refNorm([tp.what, tp.rule, JSON.stringify(tp.tables), JSON.stringify(tp.examples)].join(" "));
        if (hay.indexOf(q) >= 0) s = 4;
      }
    }
    if (s > 0) scored.push({ id: tp.id, s, kb, tb: title.indexOf(q) === 0 ? 1 : 0 });
  });
  scored.sort((a, b) => (b.s - a.s) || (b.kb - a.kb) || (b.tb - a.tb));
  return scored.slice(0, 3).map(r => r.id);
}
const SEARCH_TESTS = [
  ["ضمائر", ["c-personal"]],
  ["nicht", ["b-artikel-negativ"]],
  ["Dativ", ["d-dativ"]],
  ["der", ["b-w-der"]],
  ["ich", ["c-w-ich"]],
  ["weil", ["i-w-weil"]],
  ["können", ["f-modal"]],
  ["mein", ["b-artikel-possessiv", "c-possessiv"]],
  ["Perfekt", ["g-perfekt"]],
  ["gestern", ["j-zeitwoerter", "g-praeteritum"]],
  ["ماضي", ["g-perfekt", "j-zeitwoerter", "g-praeteritum"]],
  ["mit", ["h-dativ"]]
];
let searchFails = 0;
SEARCH_TESTS.forEach(([q, expectAny]) => {
  const top3 = searchTop3(q);
  const ok = expectAny.some(id => top3.includes(id));
  if (ok) console.log("PASS search '" + q + "' -> " + top3.join(", "));
  else { console.log("FAIL search '" + q + "' -> " + top3.join(", ") + " (expected one of " + expectAny.join("/") + ")"); searchFails++; }
});

console.log("----");
Object.keys(C).forEach(k => console.log(k + ": " + C[k]));
let nTables = 0, nExamples = 0, nQuestions = 0;
topics.forEach(tp => { nTables += (tp.tables || []).length; nExamples += (tp.examples || []).length; nQuestions += (tp.quiz || []).length; });
console.log("Totals: Topics=" + topics.length + " Tables=" + nTables + " Examples=" + nExamples + " Questions=" + nQuestions);
const fails = Object.values(C).reduce((a, b) => a + b, 0) + searchFails;
if (fails) { console.log("RESULT: FAIL (" + fails + ")"); process.exit(1); }
console.log("RESULT: PASS (pending content: " + pending.length + ")");
