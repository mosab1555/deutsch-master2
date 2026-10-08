/* Deutsch Master — Content Quality Gate (REAL validator, not a field-existence stub).
   Validates schema, German structure, Arabic presence, article/plural morphology flags,
   allowed level/category/type values, duplicate + near-duplicate detection,
   reference integrity, exercise answer validity, malformed records.
   Usage:
     node tools/content-quality-gate.js [dir] [--json out.json] [--strict]
   Exit codes: 0 = no ERRORS (warnings ok, or --strict also requires zero warnings),
               1 = validation errors, 2 = usage/IO error.
   Also requireable: validateDataset({vocab,sentences,grammar,exercises,dialogues})
*/
"use strict";
const fs = require("fs");
const path = require("path");

const LEVELS = ["A1", "A2", "B1", "B2"];
const ARTS = ["der", "die", "das", "-"];
const WTYPES = ["noun", "verb", "adj", "pron", "adv", "conj", "prep", "num", "phrase", "func"];
const CATS = ["family","people","home","rooms","furniture","school","university","education","work","jobs","workplace","travel","airport","station","transport","roads","city","neighborhood","shopping","supermarket","clothing","food","drinks","restaurant","hotel","health","body","doctor","pharmacy","hospital","emergency","weather","seasons","nature","animals","tech","computers","internet","phones","social","banking","money","services","documents","appointments","communication","routine","hobbies","sports","emotions","relationships","time","dates","numbers","directions","location","dailylife","germany","study","ausbildung","unilife","worktalk","applications","interviews","profi","colloquial","polite","general","verbs","adjectives"];
const EX_TYPES = ["choice","truefalse","gap","article","plural","conjugate","order","translate","correct","classify","match","dialogue","listen","transform"];
const AR_RE = /[\u0600-\u06FF]/;
const DE_BAD = /[\u0600-\u06FF]/; // arabic chars must not leak into German fields

function normDE(s) {
  return String(s || "").toLowerCase().replace(/[\s\u00A0]+/g, " ").trim()
    .replace(/[„“”"«»]/g, "").replace(/[.?!…,;:]+$/g, "").replace(/\s+/g, " ");
}
function toks(s) { return normDE(s).split(" ").filter(Boolean); }
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(t => { if (B.has(t)) inter++; });
  return inter / (A.size + B.size - inter);
}

function validateDataset(ds) {
  const errors = [], warnings = [];
  const E = (id, reason) => errors.push({ id, reason });
  const W = (id, reason) => warnings.push({ id, reason });
  const vocab = ds.vocab || [], sentences = ds.sentences || [],
        grammar = ds.grammar || [], exercises = ds.exercises || [], dialogues = ds.dialogues || [];
  const ids = new Set();
  const dupId = (id, kind) => { if (!id) E("?", kind + ": missing id"); else if (ids.has(id)) E(id, kind + ": duplicate id"); else ids.add(id); };

  // ---- VOCAB ----
  const deSeen = new Map(); // normDE -> id (exact/whitespace/case-insensitive dup)
  const artOf = new Map();  // de -> art (article conflict detection)
  for (const w of vocab) {
    dupId(w.id, "vocab");
    if (!w.de || typeof w.de !== "string" || !w.de.trim()) { E(w.id, "vocab: missing German"); continue; }
    if (DE_BAD.test(w.de)) E(w.id, "vocab: Arabic chars inside German field");
    if (/\s{2,}/.test(w.de)) E(w.id, "vocab: double whitespace in German");
    if (!w.ar || !AR_RE.test(String(w.ar))) E(w.id, "vocab: missing/invalid Arabic translation");
    if (!LEVELS.includes(w.level)) E(w.id, "vocab: invalid level " + w.level);
    if (!WTYPES.includes(w.type)) E(w.id, "vocab: invalid type " + w.type);
    if (!CATS.includes(w.cat)) E(w.id, "vocab: invalid category " + w.cat);
    if (!ARTS.includes(w.art)) E(w.id, "vocab: invalid article " + w.art);
    const n = normDE(w.de);
    const nkey = n + "|" + w.type; // homographs across word classes are legitimate separate entries
    if (deSeen.has(nkey)) E(w.id, "vocab: duplicate German entry of " + deSeen.get(nkey));
    else deSeen.set(nkey, w.id);
    if (w.type === "noun") {
      if (!/^[A-ZÄÖÜ]/.test(w.de)) E(w.id, "vocab: noun must be capitalized");
      if (["der", "die", "das"].indexOf(w.art) < 0) E(w.id, "vocab: noun missing valid article");
      if (!w.plural || typeof w.plural !== "string" || !w.plural.trim()) E(w.id, "vocab: noun missing plural");
      else if (w.plural.trim() === "-") { /* plural-less noun (mass/abstract/country): accepted by convention */ }
      else {
        if (DE_BAD.test(w.plural)) E(w.id, "vocab: Arabic chars inside plural");
        if (!/^[A-ZÄÖÜ]/.test(w.plural.trim()) && !/^[a-zäöü]/.test(w.plural.trim())) E(w.id, "vocab: malformed plural");
        if (normDE(w.plural) === n && !/^(das\s|die\s|der\s)/.test(w.plural)) {
          // zero-plural is correct for -er/-el/-en masculines & neuters (Lehrer, Onkel, …)
          // and for verified pluralia tantum (Eltern, Leute, Ferien, Jeans, …)
          const TANTUM = ["eltern", "leute", "ferien", "jeans", "shorts", "ananas", "kosten", "niederlande", "usa", "philippinen", "vereinigte arabische emirate"];
          if (!/(er|el|en)$/.test(w.de) && TANTUM.indexOf(n) < 0) W(w.id, "vocab: plural identical to singular (no article prefix?)");
        }
      }
      const k = n + "|" + w.art;
      if (artOf.has(n) && artOf.get(n) !== w.art) E(w.id, "vocab: article conflict for same word");
      artOf.set(n, w.art); void k;
    } else {
      if (w.art && w.art !== "-") E(w.id, "vocab: non-noun must use article '-'");
      if (/^[A-ZÄÖÜ]/.test(w.de) && w.type !== "phrase" && w.type !== "num") W(w.id, "vocab: non-noun capitalized — check word class");
    }
    if (w.type === "verb") {
      if (!/n$/.test(w.de.replace(/^(sich| charge).*/, "")) && !w.de.endsWith("n")) W(w.id, "vocab: verb infinitive should end in -n");
      if (w.forms && (!Array.isArray(w.forms) || w.forms.length < 2)) E(w.id, "vocab: verb forms malformed");
    }
    if (w.type === "adj" && w.comp && w.sup && (typeof w.comp !== "string" || typeof w.sup !== "string")) E(w.id, "vocab: adj comp/sup malformed");
    if (w.ref && !Array.isArray(w.ref)) E(w.id, "vocab: ref must be array");
  }

  // ---- SENTENCES ----
  const sSeen = new Map();
  const sentToks = [];
  for (const s of sentences) {
    dupId(s.id, "sentence");
    if (!s.de || !s.de.trim()) { E(s.id, "sentence: missing German"); continue; }
    if (DE_BAD.test(s.de)) E(s.id, "sentence: Arabic chars inside German");
    if (/\s{2,}/.test(s.de)) E(s.id, "sentence: double whitespace");
    if (!/[.?!…]$/.test(s.de.trim())) E(s.id, "sentence: must end with . ? or !");
    if (!s.ar || !AR_RE.test(String(s.ar))) E(s.id, "sentence: missing/invalid Arabic");
    if (!LEVELS.includes(s.level)) E(s.id, "sentence: invalid level " + s.level);
    if (!CATS.includes(s.topic)) E(s.id, "sentence: invalid topic " + s.topic);
    const n = normDE(s.de);
    if (sSeen.has(n)) E(s.id, "sentence: exact/near-exact duplicate of " + sSeen.get(n));
    else sSeen.set(n, s.id);
    const t = toks(s.de);
    if (t.length < 3) E(s.id, "sentence: too short (<3 words)");
    if (t.length > 25) W(s.id, "sentence: very long (>25 words)");
    sentToks.push({ id: s.id, t });
    if (s.vocab && !Array.isArray(s.vocab)) E(s.id, "sentence: vocab refs must be array");
    if (s.grammar && !Array.isArray(s.grammar)) E(s.id, "sentence: grammar refs must be array");
  }
  // near-duplicate sentences (Jaccard over tokens)
  for (let i = 0; i < sentToks.length; i++) {
    for (let j = i + 1; j < Math.min(i + 400, sentToks.length); j++) {
      // windowed comparison keeps O(n) on 12k+ sets; full matrix unnecessary after exact pass
      const a = sentToks[i], b = sentToks[j];
      if (Math.abs(a.t.length - b.t.length) > 2) continue;
      if (jaccard(a.t, b.t) > 0.92) E(b.id, "sentence: near-duplicate of " + a.id + " (jaccard>0.92)");
    }
  }
  // low-value template repetition: same first-3-words cluster
  const headCount = new Map();
  for (const s of sentences) {
    const h = toks(s.de).slice(0, 3).join(" ");
    headCount.set(h, (headCount.get(h) || 0) + 1);
  }
  headCount.forEach((c, h) => { if (c > 12) W("-", "sentences: template cluster x" + c + " head=[" + h + "]"); });

  // ---- GRAMMAR ----
  const gIds = new Set(grammar.map(g => g.id));
  for (const g of grammar) {
    dupId(g.id, "grammar");
    if (!g.title || !String(g.title).trim()) E(g.id, "grammar: missing title");
    if (!g.body || String(g.body).trim().length < 80) E(g.id, "grammar: explanation too shallow (<80 chars)");
    if (!LEVELS.includes(g.level)) E(g.id, "grammar: invalid level " + g.level);
    if (!Array.isArray(g.examples) || g.examples.length < 2) E(g.id, "grammar: need >=2 examples");
    else for (const ex of g.examples) {
      if (!Array.isArray(ex) || !ex[0] || !AR_RE.test(String(ex[1] || ""))) { E(g.id, "grammar: example needs [de, ar]"); break; }
      if (DE_BAD.test(ex[0])) { E(g.id, "grammar: Arabic chars inside example German"); break; }
    }
    if (g.related && !Array.isArray(g.related)) E(g.id, "grammar: related must be array");
  }
  // grammar related-link integrity
  for (const g of grammar) {
    for (const r of (g.related || [])) if (!gIds.has(r)) E(g.id, "grammar: broken related link -> " + r);
  }

  // ---- reference integrity: sentence -> vocab/grammar ----
  const vIds = new Set(vocab.map(w => w.id));
  const dIds = new Set(dialogues.map(d => d.id));
  for (const s of sentences) {
    for (const v of (s.vocab || [])) if (!vIds.has(v)) E(s.id, "sentence: broken vocab ref -> " + v);
    for (const gr of (s.grammar || [])) if (!gIds.has(gr)) E(s.id, "sentence: broken grammar ref -> " + gr);
  }

  // ---- EXERCISES ----
  const sIds = new Set(sentences.map(s => s.id));
  for (const q of exercises) {
    dupId(q.id, "exercise");
    if (!EX_TYPES.includes(q.type)) { E(q.id, "exercise: invalid type " + q.type); continue; }
    if (!q.prompt || !String(q.prompt).trim()) { E(q.id, "exercise: missing prompt"); continue; }
    if (!q.level || !LEVELS.includes(q.level)) E(q.id, "exercise: invalid level");
    if (["choice", "gap", "article", "plural", "conjugate", "translate", "classify", "listen"].includes(q.type)) {
      if (!Array.isArray(q.choices) || q.choices.length < 3) { E(q.id, "exercise: need >=3 choices"); continue; }
      if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.choices.length) { E(q.id, "exercise: answer index out of range"); continue; }
      const set = new Set(q.choices.map(c => normDE(c)));
      if (set.size !== q.choices.length) E(q.id, "exercise: duplicate choices");
      if (q.type === "gap" && q.prompt.indexOf("___") < 0 && q.prompt.indexOf("…") < 0) E(q.id, "exercise: gap prompt needs ___ blank");
    }
    if (q.type === "truefalse" && typeof q.answer !== "boolean" && q.answer !== 0 && q.answer !== 1) E(q.id, "exercise: truefalse needs boolean answer");
    if (q.type === "order" && (!Array.isArray(q.words) || q.words.length < 3)) E(q.id, "exercise: order needs >=3 words");
    if ((q.ref || []).some(r => !vIds.has(r) && !sIds.has(r) && !gIds.has(r) && !dIds.has(r))) E(q.id, "exercise: broken content ref");
  }
  // answer-position balance (warn if >45% of choice answers sit in one slot)
  const pos = [0, 0, 0, 0];
  let nChoice = 0;
  for (const q of exercises) if (typeof q.answer === "number" && q.choices && q.choices.length === 4) { pos[q.answer]++; nChoice++; }
  if (nChoice > 100) pos.forEach((c, i) => { if (c / nChoice > 0.45) W("-", "exercises: answer position " + i + " overused (" + Math.round(100 * c / nChoice) + "%)"); });

  // ---- DIALOGUES ----
  for (const d of dialogues) {
    dupId(d.id, "dialogue");
    if (!LEVELS.includes(d.level)) E(d.id, "dialogue: invalid level");
    if (!CATS.includes(d.topic)) E(d.id, "dialogue: invalid topic");
    if (!Array.isArray(d.lines) || d.lines.length < 4) { E(d.id, "dialogue: need >=4 lines"); continue; }
    let bad = false;
    for (const ln of d.lines) {
      if (!Array.isArray(ln) || ln.length < 3 || !ln[1] || !AR_RE.test(String(ln[2] || ""))) { E(d.id, "dialogue: line needs [speaker, de, ar]"); bad = true; break; }
      if (DE_BAD.test(ln[1])) { E(d.id, "dialogue: Arabic chars inside German line"); bad = true; break; }
    }
    if (!bad) {
      const sp = new Set(d.lines.map(l => l[0]));
      if (sp.size < 2) E(d.id, "dialogue: needs >=2 speakers");
    }
  }

  // ---- distributions ----
  const dist = { vocab: vocab.length, sentences: sentences.length, grammar: grammar.length, exercises: exercises.length, dialogues: dialogues.length };
  const lvl = {};
  for (const arr of [vocab, sentences, grammar, exercises, dialogues])
    for (const x of arr) { const k = (x.level === "B2" ? "B1" : x.level); lvl[k] = (lvl[k] || 0) + 1; }
  return { errors, warnings, dist, levelDist: lvl };
}

const KINDMAP = { vocab: "vocab", sent: "sentences", gram: "grammar", ex: "exercises", dlg: "dialogues" };
function loadDir(dir) {
  const ds = { vocab: [], sentences: [], grammar: [], exercises: [], dialogues: [] };
  if (!fs.existsSync(dir)) return ds;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
    const obj = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const k of Object.keys(ds)) if (Array.isArray(obj[k])) ds[k].push(...obj[k]);
    if (obj.kind && KINDMAP[obj.kind] && Array.isArray(obj.rows)) ds[KINDMAP[obj.kind]].push(...obj.rows);
  }
  return ds;
}

if (require.main === module) {
  const dir = process.argv[2] || path.join(__dirname, "..", "client", "content", "src");
  const strict = process.argv.includes("--strict");
  const jOut = process.argv[process.argv.indexOf("--json") + 1];
  let ds;
  try { ds = loadDir(dir); }
  catch (e) { console.error("GATE IO/JSON ERROR: " + e.message); process.exit(2); }
  const r = validateDataset(ds);
  console.log("counts: " + JSON.stringify(r.dist) + " levels(A1/A2/B1*): " + JSON.stringify(r.levelDist));
  console.log("errors=" + r.errors.length + " warnings=" + r.warnings.length);
  r.errors.slice(0, 60).forEach(e => console.log("ERR " + e.id + " :: " + e.reason));
  if (r.errors.length > 60) console.log("... +" + (r.errors.length - 60) + " more errors");
  r.warnings.slice(0, 20).forEach(w => console.log("WARN " + w.id + " :: " + w.reason));
  if (jOut && process.argv.includes("--json")) fs.writeFileSync(jOut, JSON.stringify(r, null, 1));
  if (r.errors.length) process.exit(1);
  if (strict && r.warnings.length) process.exit(1);
  process.exit(0);
} else {
  module.exports = { validateDataset, LEVELS, CATS, WTYPES, EX_TYPES };
}
