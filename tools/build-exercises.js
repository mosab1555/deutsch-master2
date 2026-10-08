/* Stage 4 — exercise engine expansion (30k+) + FULL dataset gate.
   Every exercise is engine-compatible (s/o/c + kind) and validated.
   Run: node tools/build-exercises.js */
"use strict";
const fs = require("fs");
const path = require("path");
const { rng, pick, shuffle, normDE } = require("./clib/util");
const gate = require("./content-quality-gate");

const cache = path.join(__dirname, "clib", ".cache");
const vocab = JSON.parse(fs.readFileSync(path.join(cache, "vocab.json"), "utf8"));
const sentences = JSON.parse(fs.readFileSync(path.join(cache, "sentences.json"), "utf8"));
const grammar = JSON.parse(fs.readFileSync(path.join(cache, "grammar.json"), "utf8"));
const dialogues = JSON.parse(fs.readFileSync(path.join(cache, "dialogues.json"), "utf8"));
const rejected = JSON.parse(fs.readFileSync(path.join(cache, "rejected.json"), "utf8"));
function rej(id, reason) { rejected.push({ id, reason }); }

const rr = rng("exercises-v1");
const exercises = [];
const seenPrompt = new Set();
let seqE = 0, posRot = 0;
function kapFor(level, i) { return level === "A1" ? "K" + (1 + (i % 5)) : "KX"; }
function push(q) {
  if (!q.prompt || seenPrompt.has(normDE(q.prompt))) return false;
  seenPrompt.add(normDE(q.prompt));
  seqE++;
  q.id = "le" + String(seqE).padStart(5, "0");
  q.kap = kapFor(q.level, seqE);
  exercises.push(q);
  return true;
}
/* rotate 4-choice answer uniformly: correct lands in each slot 25% */
function mk4(correct, distractors) {
  const d = distractors.filter((x) => normDE(x) !== normDE(correct)).slice(0, 3);
  if (d.length < 3) return null;
  const slot = posRot++ % 4;
  const o = [null, null, null, null];
  o[slot] = correct;
  let j = 0;
  for (let i = 0; i < 4; i++) if (o[i] === null) o[i] = d[j++];
  return { choices: o, answer: slot };
}
const nouns = vocab.filter((w) => w.type === "noun" && ["der", "die", "das"].includes(w.art));
const verbs = vocab.filter((w) => w.type === "verb");
const adjs = vocab.filter((w) => w.type === "adj" && w.comp);
const byCatAr = new Map();
vocab.forEach((w) => { if (!byCatAr.has(w.cat)) byCatAr.set(w.cat, []); byCatAr.get(w.cat).push(w); });
function distractAr(w, n) {
  const pool = shuffle(rr, (byCatAr.get(w.cat) || []).filter((x) => x.id !== w.id && x.ar !== w.ar));
  const out = [];
  for (const c of pool) { if (out.length >= n) break; if (!out.some((x) => normDE(x) === normDE(c.ar))) out.push(c.ar); }
  const rest = shuffle(rr, vocab.filter((x) => x.id !== w.id));
  for (const c of rest) {
    if (out.length >= n) break;
    const dup = out.some((x) => normDE(x) === normDE(c.ar));
    if (!dup && normDE(c.ar) !== normDE(w.ar)) out.push(c.ar);
  }
  return out;
}
function distractDe(w, n) {
  const pool = shuffle(rr, vocab.filter((x) => x.id !== w.id && x.type === w.type));
  const out = [];
  for (const c of pool) {
    if (out.length >= n) break;
    const dup = out.some((x) => normDE(x) === normDE(c.de));
    if (!dup && normDE(c.de) !== normDE(w.de)) out.push(c.de);
  }
  return out;
}

/* 1) article selection */
nouns.forEach((w) => {
  const o = ["der", "die", "das"];
  const opts = shuffle(rr, o);
  push({ type: "article", prompt: "___ " + w.de + " (" + w.ar + ")", choices: opts, answer: opts.indexOf(w.art), level: w.level, ref: [w.id], kind: "fill", why: "أداة «" + w.de + "» هي " + w.art + "." });
});
/* 2) plural selection */
nouns.filter((w) => w.plural && w.plural !== "-").forEach((w) => {
  const pl = /^(der|die|das)\s/.test(w.plural) ? w.plural : w.plural;
  const pool = shuffle(rr, nouns.filter((x) => x.id !== w.id && x.plural && x.plural !== "-"));
  const d = [];
  for (const c of pool) { if (d.length >= 3) break; const p = c.plural; if (normDE(p) !== normDE(pl) && !d.some((x) => normDE(x) === normDE(p))) d.push(p); }
  const m = mk4(pl, d);
  if (!m) return;
  push({ type: "plural", prompt: "جمع «" + w.art + " " + w.de + "» هو ___؟", choices: m.choices, answer: m.answer, level: w.level, ref: [w.id], kind: "fill", why: "الجمع محفوظ مع الكلمة." });
});
/* 3) meaning de->ar (all vocab) */
vocab.forEach((w) => {
  const m = mk4(w.ar, distractAr(w, 3));
  if (!m) return;
  push({ type: "choice", prompt: "«" + w.de + "» تعني ___؟", choices: m.choices, answer: m.answer, level: w.level, ref: [w.id], kind: "fill", why: "المعنى: " + w.de + "." });
});
/* 4) reverse ar->de (nouns+verbs+adj sample) */
nouns.concat(verbs.slice(0, 300), adjs.slice(0, 200)).forEach((w) => {
  const m = mk4(w.de, distractDe(w, 3));
  if (!m) return;
  push({ type: "translate", prompt: "«" + w.ar + "» بالألمانية ___؟", choices: m.choices, answer: m.answer, level: w.level, ref: [w.id], kind: "fill", why: "الكلمة الألمانية المطلوبة." });
});
/* 5) conjugation */
const CONJ_FORMS = { ich: 0, du: 1, er: 2, wir: 3 };
verbs.slice(0, 420).forEach((w) => {
  const inf = w.de.replace(/^sich /, "");
  if (/ /.test(inf)) return;
  // compute 4 person forms via shared rules (duplicated minimal conjugator)
  const forms = {};
  ["ich", "du", "er", "wir"].forEach((p) => { forms[p] = conjMini(inf, p); });
  if (new Set(Object.values(forms)).size < 4) return;
  ["du", "er"].forEach((target) => {
    const m = mk4(forms[target], [forms.ich, forms.du, forms.er, forms.wir].filter((f) => f !== forms[target]));
    if (!m) return;
    const pron = target === "du" ? "Du" : "Er";
    push({ type: "conjugate", prompt: pron + " ___ (" + inf + ")", choices: m.choices, answer: m.answer, level: w.level, ref: [w.id], kind: "fill", why: "تصريف الفعل مع الضمير." });
  });
});
function conjMini(inf, person) {
  if (inf === "sein") return { ich: "bin", du: "bist", er: "ist", wir: "sind" }[person];
  if (inf === "haben") return { ich: "habe", du: "hast", er: "hat", wir: "haben" }[person];
  const STEMS_MIN = { sprechen: ["sprichst", "spricht"], sehen: ["siehst", "sieht"], lesen: ["liest", "liest"], geben: ["gibst", "gibt"], nehmen: ["nimmst", "nimmt"], fahren: ["fährst", "fährt"], laufen: ["läufst", "läuft"], schlafen: ["schläfst", "schläft"], essen: ["isst", "isst"], helfen: ["hilfst", "hilft"], treffen: ["triffst", "trifft"], waschen: ["wäschst", "wäscht"], bewerben: ["bewirbst", "bewirbt"], laden: ["lädst", "lädt"] };
  const sp = splitMini(inf);
  const stemInf = sp ? sp[0] : inf, tail = sp ? " " + sp[1] : "";
  let core;
  const stem = stemInf.replace(/en$/, "");
  if ((person === "du" || person === "er") && STEMS_MIN[stemInf]) core = STEMS_MIN[stemInf][person === "du" ? 0 : 1];
  else if (person === "ich") core = stem + "e";
  else if (person === "du") core = stem + (/[td]$/.test(stem) ? "est" : "st");
  else if (person === "er") core = stem + (/[td]$/.test(stem) ? "et" : "t");
  else core = stemInf;
  return core + tail;
}
function splitMini(inf) {
  const prefs = ["zurück", "zusammen", "vorbei", "weiter", "heim", "ab", "an", "auf", "aus", "bei", "ein", "mit", "nach", "vor", "zu", "weg"];
  for (const p of prefs) if (inf.startsWith(p) && inf.length > p.length + 2) return [inf.slice(p.length), p];
  return null;
}
/* 6) participle */
verbs.slice(0, 300).forEach((w) => {
  if (!w.parts || !w.parts.includes(",")) return;
  const pp = w.parts.split(",")[1];
  const pool = shuffle(rr, verbs.filter((x) => x.id !== w.id && x.parts && x.parts.includes(",")));
  const d = [];
  for (const c of pool) { if (d.length >= 3) break; const p = c.parts.split(",")[1]; if (normDE(p) !== normDE(pp) && !d.some((x) => normDE(x) === normDE(p))) d.push(p); }
  const m = mk4(pp, d);
  if (!m) return;
  push({ type: "choice", prompt: "التصريف الثالث لـ«" + w.de + "» هو ___؟", choices: m.choices, answer: m.answer, level: w.level, ref: [w.id], kind: "fill", why: "التصريف الثالث محفوظ." });
});
/* 7) comparative */
adjs.forEach((w) => {
  const pool = shuffle(rr, adjs.filter((x) => x.id !== w.id && x.comp));
  const d = [];
  for (const c of pool) { if (d.length >= 3) break; if (normDE(c.comp) !== normDE(w.comp) && !d.some((x) => normDE(x) === normDE(c.comp))) d.push(c.comp); }
  const m = mk4(w.comp, d);
  if (!m) return;
  push({ type: "choice", prompt: "مقارنة «" + w.de + "» هي ___؟", choices: m.choices, answer: m.answer, level: w.level, ref: [w.id], kind: "fill", why: "صيغة المقارنة." });
});
console.log("after vocab-derived:", exercises.length);

/* 8) sentence gap (one per sentence) */
const wordPoolByLen = new Map();
sentences.forEach((s) => {
  const toks = s.de.replace(/[.?!…]$/, "").split(" ").filter(Boolean);
  if (toks.length < 4) return;
  const cands = toks.map((t, i) => ({ t, i })).filter(({ t, i }) => i > 0 && t.length > 3 && /^[A-Za-zÄÖÜäöüß]/.test(t));
  if (!cands.length) return;
  const { t: word, i } = cands[Math.floor(rr() * cands.length)];
  const isNoun = /^[A-ZÄÖÜ]/.test(word);
  const pool = shuffle(rr, vocab.filter((x) => x.type === (isNoun ? "noun" : x.type) && x.de.length > 3));
  void pool;
  // distractors: same-class words of similar length, clean single tokens
  const sameClass = shuffle(rr, vocab.filter((x) => (isNoun ? x.type === "noun" && /^[A-ZÄÖÜ]/.test(x.de) : x.type !== "noun") && !/ /.test(x.de) && x.de.length > 2));
  const d = [];
  for (const c of sameClass) { if (d.length >= 3) break; if (normDE(c.de) !== normDE(word) && !d.some((x) => normDE(x) === normDE(c.de))) d.push(c.de); }
  const m = mk4(word, d);
  if (!m) return;
  const sent2 = toks.slice(); sent2[i] = "___";
  push({ type: "gap", prompt: sent2.join(" ") + "  («" + s.ar + "»)", choices: m.choices, answer: m.answer, level: s.level, ref: [s.id], kind: "fill", why: "الكلمة في السياق." });
});
console.log("after gap:", exercises.length);

/* 9) order (scrambled sentence choice) */
shuffle(rr, sentences).slice(0, 2200).forEach((s) => {
  const toks = s.de.replace(/[.?!…]$/, "").split(" ").filter(Boolean);
  if (toks.length < 4 || toks.length > 10) return;
  const scr = [];
  for (let k = 0; k < 3; k++) {
    const sh = shuffle(rr, toks);
    if (sh.join(" ") !== toks.join(" ")) scr.push(sh.join(" ") + ".");
  }
  if (scr.length < 3) return;
  const m = mk4(toks.join(" ") + ".", scr);
  if (!m) return;
  push({ type: "order", prompt: "رتّب الكلمات: " + shuffle(rr, toks).join(" / "), choices: m.choices, answer: m.answer, level: s.level, ref: [s.id], kind: "order", words: toks, why: "الترتيب الصحيح للجملة." });
});
console.log("after order:", exercises.length);

/* 10) grammar contrast/classify (3-option as authored: correct + 2 distractors) */
grammar.forEach((g) => {
  const set = new Set(g.quiz.opts.map((o) => normDE(o)));
  if (set.size !== g.quiz.opts.length || g.quiz.opts.length < 3) { rej("grammar-ex", "bad quiz opts " + g.id); return; }
  const prompt = g.kind === "contrast" ? g.quiz.q + " [" + g.deTitle + " " + g.unit + "/15]" : g.quiz.q + " [" + g.id + "]";
  push({ type: g.kind === "contrast" ? "correct" : "classify", prompt, choices: g.quiz.opts.slice(), answer: g.quiz.correct, level: g.level, ref: [g.id], kind: "fill", why: "راجع القاعدة." });
});
console.log("after grammar:", exercises.length);

/* 11) dialogue completion */
dialogues.forEach((d) => {
  if (d.lines.length < 2) return;
  const last = d.lines[d.lines.length - 1];
  const prev = d.lines.slice(0, -1).map(([sp, de]) => sp + ": " + de).join(" / ");
  const pool = shuffle(rr, dialogues.filter((x) => x.id !== d.id));
  const dd = [];
  for (const c of pool) { if (dd.length >= 3) break; const l = c.lines[c.lines.length - 1][1]; if (normDE(l) !== normDE(last[1]) && !dd.some((x) => normDE(x) === normDE(l))) dd.push(l); }
  const m = mk4(last[1], dd);
  if (!m) return;
  push({ type: "dialogue", prompt: prev + " / " + last[0] + ": ___", choices: m.choices, answer: m.answer, level: d.level, ref: [d.id], kind: "fill", lines: d.lines, why: "إتمام الحوار." });
});
console.log("after dialogue:", exercises.length);

/* 12) true/false (correct pair vs swapped translation) */
shuffle(rr, sentences).slice(0, 2600).forEach((s) => {
  const other = sentences[Math.floor(rr() * sentences.length)];
  if (!other || other.id === s.id) return;
  const truth = rr() < 0.5;
  push({
    type: "truefalse",
    prompt: "«" + s.de + "» = «" + (truth ? s.ar : other.ar) + "»؟",
    choices: ["صحيح", "خطأ"], answer: truth ? 0 : 1, boolean: truth,
    level: s.level, ref: [s.id], kind: "fill", why: "الترجمة " + (truth ? "صحيحة." : "ليست لهذه الجملة."),
  });
});
console.log("after truefalse:", exercises.length);

/* top-up: second gap round for long sentences until 30000 */
if (exercises.length < 30000) {
  outer: for (const s of shuffle(rr, sentences)) {
    if (exercises.length >= 30200) break;
    const toks = s.de.replace(/[.?!…]$/, "").split(" ").filter(Boolean);
    const cands = toks.map((t, i) => ({ t, i })).filter(({ t, i }) => i > 1 && t.length > 4 && /^[A-Za-zÄÖÜäöüß]/.test(t));
    if (cands.length < 2) continue;
    const { t: word, i } = cands[Math.floor(rr() * cands.length)];
    const isNoun = /^[A-ZÄÖÜ]/.test(word);
    const sameClass = shuffle(rr, vocab.filter((x) => (isNoun ? x.type === "noun" && /^[A-ZÄÖÜ]/.test(x.de) : x.type !== "noun") && !/ /.test(x.de) && x.de.length > 2));
    const d = [];
    for (const c of sameClass) { if (d.length >= 3) break; if (normDE(c.de) !== normDE(word) && !d.some((x) => normDE(x) === normDE(c.de))) d.push(c.de); }
    const m = mk4(word, d);
    if (!m) continue;
    const sent2 = toks.slice(); sent2[i] = "___";
    push({ type: "gap", prompt: sent2.join(" ") + "  («" + s.ar + "»)", choices: m.choices, answer: m.answer, level: s.level, ref: [s.id], kind: "fill", why: "الكلمة في السياق." });
  }
}
console.log("TOTAL exercises:", exercises.length);

/* ---------- full gate ---------- */
(function () {
  const r = gate.validateDataset({ vocab, sentences, grammar, exercises, dialogues });
  console.log("STAGE4 gate: errors=" + r.errors.length + " warnings=" + r.warnings.length);
  r.errors.slice(0, 30).forEach((e) => console.log("  ERR " + e.id + " :: " + e.reason));
  const bad = new Map();
  r.errors.forEach((e) => { if (!bad.has(e.id)) bad.set(e.id, e.reason); });
  for (let i = exercises.length - 1; i >= 0; i--) if (bad.has(exercises[i].id)) { rej(exercises[i].id, bad.get(exercises[i].id)); exercises.splice(i, 1); }
  // ids shift after removal? ids are stable (assigned at push, never reused) — but sequence gaps are fine.
  const r2 = gate.validateDataset({ vocab, sentences, grammar, exercises, dialogues });
  console.log("STAGE4 after reject: exercises=" + exercises.length + " errors=" + r2.errors.length);
  r2.errors.slice(0, 10).forEach((e) => console.log("  ERR2 " + e.id + " :: " + e.reason));
  if (r2.errors.length) { console.log("FATAL stage4"); process.exit(1); }
  if (exercises.length < 20000) { console.log("FATAL: exercise volume too low"); process.exit(1); }
})();
fs.writeFileSync(path.join(cache, "exercises.json"), JSON.stringify(exercises));
fs.writeFileSync(path.join(cache, "rejected.json"), JSON.stringify(rejected, null, 1));
console.log("stage4 ok");
