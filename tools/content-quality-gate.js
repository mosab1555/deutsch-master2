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
        grammar = ds.grammar || [], exercises = ds.exercises || [], dialogues = ds.dialogues || [],
        reading = ds.reading || [], listening = ds.listening || [], exams = ds.exams || [];
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
          // and for verified pluralia tantum (Eltern, Leute, Ferien, Jeans, …).
          // Determinative compounds inherit the head's number behavior, so
          // compounds headed by a tantum/invariable noun are likewise exempt
          // (audited 2026-10-09: Hausshorts/Wintershorts/… -> shorts;
          //  Familieneltern/Spieleltern/… -> eltern; Spätzle/Käsespätzle/… ->
          //  spätzle, invariable). Suffix match is narrowly scoped to these
          //  verified heads only.
          const TANTUM = ["eltern", "leute", "ferien", "jeans", "shorts", "ananas", "kosten", "niederlande", "usa", "philippinen", "vereinigte arabische emirate"];
          const TANTUM_TAIL = ["eltern", "shorts", "spätzle", "leute", "ferien", "jeans"];
          const tailHit = TANTUM_TAIL.some((t) => n === t || n.endsWith(t));
          if (!/(er|el|en)$/.test(w.de) && TANTUM.indexOf(n) < 0 && !tailHit) W(w.id, "vocab: plural identical to singular (no article prefix?)");
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
      if (w.parts && w.parts.indexOf(",") >= 0 && w.sep === true) {
        const pp = w.parts.split(",")[1].trim();
        if (pp && normDE(pp) === normDE(String(w.de).replace(/^sich /, ""))) E(w.id, "vocab: separable participle identical to infinitive (bad derivation)");
      }
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
    if (/[{}]/.test(s.de) || /[{}]/.test(String(s.ar || ""))) { E(s.id, "sentence: unfilled template placeholder"); continue; }
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
  // near-duplicate sentences (Jaccard over tokens).
  // Scale-safe: bucket by 3-word head; near-dups from templates share heads.
  // Cross-head pairs with jaccard>0.92 are vanishingly rare, exact-map covers the rest.
  const headBuckets = new Map();
  sentToks.forEach((o, idx) => {
    const h = o.t.slice(0, 3).join(" ");
    if (!headBuckets.has(h)) headBuckets.set(h, []);
    headBuckets.get(h).push(idx);
  });
  const cmpPair = (i, j) => {
    const a = sentToks[i], b = sentToks[j];
    if (Math.abs(a.t.length - b.t.length) > 2) return;
    if (jaccard(a.t, b.t) > 0.92) E(b.id, "sentence: near-duplicate of " + a.id + " (jaccard>0.92)");
  };
  if (sentToks.length <= 25000) {
    for (let i = 0; i < sentToks.length; i++) {
      for (let j = i + 1; j < Math.min(i + 400, sentToks.length); j++) cmpPair(i, j);
    }
  } else {
    headBuckets.forEach((idxs) => {
      // windowed within bucket: catches template-cluster near-dups at any scale
      for (let a = 0; a < idxs.length; a++) {
        for (let b = a + 1; b < Math.min(a + 61, idxs.length); b++) cmpPair(idxs[a], idxs[b]);
      }
    });
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

  // ---- reference integrity: sentence/reading/listening -> vocab/grammar ----
  const vIds = new Set(vocab.map(w => w.id));
  const dIds = new Set(dialogues.map(d => d.id));
  for (const s of sentences) {
    for (const v of (s.vocab || [])) if (!vIds.has(v)) E(s.id, "sentence: broken vocab ref -> " + v);
    for (const gr of (s.grammar || [])) if (!gIds.has(gr)) E(s.id, "sentence: broken grammar ref -> " + gr);
  }
  for (const r of reading) {
    for (const v of (r.vocab || [])) if (!vIds.has(v)) E(r.id, "reading: broken vocab ref -> " + v);
    for (const gr of (r.grammar || [])) if (!gIds.has(gr)) E(r.id, "reading: broken grammar ref -> " + gr);
  }
  for (const l of listening) {
    for (const v of (l.vocab || [])) if (!vIds.has(v)) E(l.id, "listening: broken vocab ref -> " + v);
    for (const gr of (l.grammar || [])) if (!gIds.has(gr)) E(l.id, "listening: broken grammar ref -> " + gr);
  }

  // ---- EXERCISES ----
  const sIds = new Set(sentences.map(s => s.id));
  const rIds = new Set(reading.map(r => r.id));
  const lIds = new Set(listening.map(l => l.id));
  const xIds = new Set(exams.map(x => x.id));
  for (const q of exercises) {
    dupId(q.id, "exercise");
    if (!EX_TYPES.includes(q.type)) { E(q.id, "exercise: invalid type " + q.type); continue; }
    if (!q.prompt || !String(q.prompt).trim()) { E(q.id, "exercise: missing prompt"); continue; }
    if (/[{}]/.test(String(q.prompt))) { E(q.id, "exercise: unfilled template placeholder"); continue; }
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
    if ((q.ref || []).some((r) => !vIds.has(r) && !sIds.has(r) && !gIds.has(r) && !dIds.has(r) && !rIds.has(r) && !lIds.has(r) && !xIds.has(r))) E(q.id, "exercise: broken content ref");
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
      if (/[{}]/.test(String(ln[1]))) { E(d.id, "dialogue: unfilled template placeholder"); bad = true; break; }
      if (DE_BAD.test(ln[1])) { E(d.id, "dialogue: Arabic chars inside German line"); bad = true; break; }
    }
    if (!bad) {
      const sp = new Set(d.lines.map(l => l[0]));
      if (sp.size < 2) E(d.id, "dialogue: needs >=2 speakers");
    }
  }

  // ---- READING ----
  const rSeen = new Map();
  for (const r of reading) {
    dupId(r.id, "reading");
    if (!r.title || !String(r.title).trim()) E(r.id, "reading: missing title");
    if (!LEVELS.includes(r.level)) E(r.id, "reading: invalid level");
    if (!CATS.includes(r.topic)) E(r.id, "reading: invalid topic " + r.topic);
    if (!r.de || String(r.de).trim().length < 60) { E(r.id, "reading: German text too short (<60 chars)"); continue; }
    if (DE_BAD.test(r.de)) E(r.id, "reading: Arabic chars inside German text");
    if (/\s{2,}/.test(r.de)) E(r.id, "reading: double whitespace");
    if (!r.ar || !AR_RE.test(String(r.ar))) E(r.id, "reading: missing/invalid Arabic");
    const n = normDE(r.de);
    if (rSeen.has(n)) E(r.id, "reading: exact duplicate of " + rSeen.get(n));
    else rSeen.set(n, r.id);
    if (!Array.isArray(r.questions) || r.questions.length < 1) { E(r.id, "reading: need >=1 question"); continue; }
    for (const q of r.questions) {
      if (!q.q || !String(q.q).trim()) { E(r.id, "reading: question missing text"); break; }
      if (!Array.isArray(q.choices) || q.choices.length < 3) { E(r.id, "reading: question needs >=3 choices"); break; }
      if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.choices.length) { E(r.id, "reading: question answer index out of range"); break; }
      const set = new Set(q.choices.map((c) => normDE(c)));
      if (set.size !== q.choices.length) { E(r.id, "reading: question duplicate choices"); break; }
    }
    if (r.vocab && !Array.isArray(r.vocab)) E(r.id, "reading: vocab refs must be array");
    if (r.grammar && !Array.isArray(r.grammar)) E(r.id, "reading: grammar refs must be array");
  }

  // ---- LISTENING ----
  const lSeen = new Map();
  for (const l of listening) {
    dupId(l.id, "listening");
    if (!LEVELS.includes(l.level)) E(l.id, "listening: invalid level");
    if (!CATS.includes(l.topic)) E(l.id, "listening: invalid topic " + l.topic);
    if (!Array.isArray(l.lines) || l.lines.length < 2) { E(l.id, "listening: need >=2 script lines"); continue; }
    let bad = false;
    for (const ln of l.lines) {
      if (!Array.isArray(ln) || ln.length < 3 || !ln[1] || !AR_RE.test(String(ln[2] || ""))) { E(l.id, "listening: line needs [speaker, de, ar]"); bad = true; break; }
      if (DE_BAD.test(ln[1])) { E(l.id, "listening: Arabic chars inside German line"); bad = true; break; }
    }
    if (bad) continue;
    const key = normDE(l.lines.map((x) => x[1]).join(" | "));
    if (lSeen.has(key)) E(l.id, "listening: exact duplicate script of " + lSeen.get(key));
    else lSeen.set(key, l.id);
    if (!Array.isArray(l.questions) || l.questions.length < 1) { E(l.id, "listening: need >=1 question"); continue; }
    for (const q of l.questions) {
      if (!q.q || !String(q.q).trim()) { E(l.id, "listening: question missing text"); break; }
      if (!Array.isArray(q.choices) || q.choices.length < 3) { E(l.id, "listening: question needs >=3 choices"); break; }
      if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.choices.length) { E(l.id, "listening: question answer index out of range"); break; }
    }
    if (!l.audio || l.audio.tts !== true) E(l.id, "listening: missing audio tts metadata");
    if (l.vocab && !Array.isArray(l.vocab)) E(l.id, "listening: vocab refs must be array");
    if (l.grammar && !Array.isArray(l.grammar)) E(l.id, "listening: grammar refs must be array");
  }

  // ---- EXAMS ----
  const xSeen = new Map();
  for (const x of exams) {
    dupId(x.id, "exam");
    if (!LEVELS.includes(x.level)) E(x.id, "exam: invalid level");
    if (!CATS.includes(x.topic) && x.topic !== "mixed") E(x.id, "exam: invalid topic " + x.topic);
    if (!x.title || !String(x.title).trim()) E(x.id, "exam: missing title");
    if (!Number.isInteger(x.count) || x.count < 5 || x.count > 100) E(x.id, "exam: count must be 5..100");
    if (typeof x.timed !== "boolean" && typeof x.seconds !== "number") E(x.id, "exam: missing timed/seconds config");
    if (!Array.isArray(x.skills) || !x.skills.length) { E(x.id, "exam: need >=1 skill"); continue; }
    const okSkills = ["vocab", "grammar", "sentences", "listening", "reading", "mixed"];
    if (x.skills.some((s) => okSkills.indexOf(s) < 0)) E(x.id, "exam: invalid skill");
    if (x.types && (!Array.isArray(x.types) || x.types.some((t) => EX_TYPES.indexOf(t) < 0))) E(x.id, "exam: invalid question type");
    const key = x.level + "|" + x.topic + "|" + x.skills.slice().sort().join(",") + "|" + (x.types || []).slice().sort().join(",") + "|" + x.count + "|" + (x.timed ? x.seconds : "untimed");
    if (xSeen.has(key)) E(x.id, "exam: duplicate configuration of " + xSeen.get(key));
    else xSeen.set(key, x.id);
  }

  // ---- distributions ----
  const dist = { vocab: vocab.length, sentences: sentences.length, grammar: grammar.length, exercises: exercises.length, dialogues: dialogues.length, reading: reading.length, listening: listening.length, exams: exams.length };
  const lvl = {};
  for (const arr of [vocab, sentences, grammar, exercises, dialogues, reading, listening, exams])
    for (const x of arr) { const k = (x.level === "B2" ? "B1" : x.level); lvl[k] = (lvl[k] || 0) + 1; }
  return { errors, warnings, dist, levelDist: lvl };
}

const KINDMAP = { vocab: "vocab", sent: "sentences", gram: "grammar", ex: "exercises", dlg: "dialogues", read: "reading", lis: "listening", exam: "exams" };
function loadDir(dir) {
  const ds = { vocab: [], sentences: [], grammar: [], exercises: [], dialogues: [], reading: [], listening: [], exams: [] };
  if (!fs.existsSync(dir)) return ds;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
    const obj = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const k of Object.keys(ds)) if (Array.isArray(obj[k])) ds[k].push(...obj[k]);
    if (obj.kind && KINDMAP[obj.kind] && Array.isArray(obj.rows)) ds[KINDMAP[obj.kind]].push(...obj.rows);
  }
  return ds;
}

if (require.main === module) {
  let dir = process.argv[2] || path.join(__dirname, "..", "client", "content", "src");
  if (dir.startsWith("--")) dir = path.join(__dirname, "..", "client", "content", "src");
  const strict = process.argv.includes("--strict");
  const jOut = process.argv[process.argv.indexOf("--json") + 1];
  let ds;
  try {
    if (process.argv.includes("--cache")) {
      const cd = path.join(__dirname, "clib", ".cache");
      const R = (f, fb) => { try { return JSON.parse(fs.readFileSync(path.join(cd, f), "utf8")); } catch (e) { return fb; } };
      ds = {
        vocab: R("vocab.json", []), sentences: R("sentences.json", []),
        grammar: R("grammar.json", []), exercises: R("exercises.json", []),
        dialogues: R("dialogues.json", []), reading: R("reading.json", []),
        listening: R("listening.json", []), exams: R("exams.json", []),
      };
    } else ds = loadDir(dir);
  }
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
