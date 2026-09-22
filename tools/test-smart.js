/* Tests for the Smart Training engine (client/smart.js, PURE section only):
   - 20 types generate valid questions
   - grading right/wrong for every type
   - session diversity (20 Qs: max 2 same-type in a row, no dup qid, multi skill/type)
   - difficulty engine, adaptive weights, anti-repeat history, per-skill feedback
   - kapitel filtering, empty-pool safety, renderer coverage (static)
   Run: node tools/test-smart.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(root, "client", "smart.js"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
/* extract PURE ENGINE section (code between the two banner comments) */
const _ps = SRC.indexOf("*/", SRC.indexOf("PURE ENGINE")) + 2;
const _pe = SRC.lastIndexOf("/*", SRC.indexOf("RENDERERS (browser)"));
const PURE = SRC.slice(_ps, _pe).replace('"use strict";', "");

/* ---------- stubs ---------- */
const WORDS = [
  { id: "w01", de: "Hund", art: "der", ar: "كلب", type: "اسم", plural: "die Hunde", level: "A1", kap: "K0", cat: "Animals" },
  { id: "w02", de: "Tasche", art: "die", ar: "حقيبة", type: "اسم", plural: "die Taschen", level: "A1", kap: "K0", cat: "Travel" },
  { id: "w03", de: "Buch", art: "das", ar: "كتاب", type: "اسم", plural: "die Bücher", level: "A1", kap: "K0", cat: "School" },
  { id: "w04", de: "Apfel", art: "der", ar: "تفاحة", type: "اسم", plural: "die Äpfel", level: "A1", kap: "K1", cat: "Food" },
  { id: "w05", de: "Banane", art: "die", ar: "موزة", type: "اسم", plural: "die Bananen", level: "A1", kap: "K1", cat: "Food" },
  { id: "w06", de: "Brot", art: "das", ar: "خبز", type: "اسم", plural: "die Brote", level: "A1", kap: "K1", cat: "Food" },
  { id: "w07", de: "Tisch", art: "der", ar: "طاولة", type: "اسم", plural: "die Tische", level: "A1", kap: "K0", cat: "Home" },
  { id: "w08", de: "Schule", art: "die", ar: "مدرسة", type: "اسم", plural: "die Schulen", level: "A1", kap: "K0", cat: "School" },
  { id: "w09", de: "Kind", art: "das", ar: "طفل", type: "اسم", plural: "die Kinder", level: "A1", kap: "K2", cat: "Family" },
  { id: "w10", de: "Taxi", art: "das", ar: "تاكسي", type: "اسم", plural: "die Taxis", level: "A1", kap: "K2", cat: "Travel" },
  { id: "v01", de: "lernen", art: "-", ar: "يتعلم", type: "فعل", level: "A1", kap: "K0", cat: "Common Verbs" },
  { id: "v02", de: "wohnen", art: "-", ar: "يسكن", type: "فعل", level: "A1", kap: "K1", cat: "Common Verbs" },
  { id: "v03", de: "kommen", art: "-", ar: "يأتي", type: "فعل", level: "A1", kap: "K1", cat: "Common Verbs" },
  { id: "a01", de: "groß", art: "-", ar: "كبير", type: "صفة", level: "A1", kap: "K0", cat: "Adjectives" },
  { id: "a02", de: "klein", art: "-", ar: "صغير", type: "صفة", level: "A1", kap: "K0", cat: "Adjectives" },
  { id: "a03", de: "schnell", art: "-", ar: "سريع", type: "صفة", level: "A1", kap: "K0", cat: "Adjectives" }
];
function allWords() { return WORDS; }
var SENTENCES = [
  { id: "s1", de: "Ich lerne jeden Tag Deutsch.", ar: "أتعلم الألمانية كل يوم.", kap: "K0", level: "A1" },
  { id: "s2", de: "Meine Mutter kocht heute gut.", ar: "أمي تطبخ جيدًا اليوم.", kap: "K2", level: "A1" },
  { id: "s3", de: "Der Hund spielt im Garten.", ar: "الكلب يلعب في الحديقة.", kap: "K1", level: "A1" }
];
var SENT_FILL = [
  { id: "f1", s: "Ich ___ Deutsch.", o: ["lerne", "lernen", "lernt", "lernst"], c: 0, why: "ich + lerne.", lvl: "A1", chapterId: "K0", grammarTarget: "conjugation" },
  { id: "f2", s: "Ich komme ___ Ägypten.", o: ["aus", "nach", "in", "bei"], c: 0, why: "الموطن مع aus.", lvl: "A1", chapterId: "K1", grammarTarget: "prepositions" },
  { id: "f3", s: "Ich sehe ___ Mann.", o: ["den", "der", "dem", "die"], c: 0, why: "مفعول مذكر.", lvl: "A1", chapterId: "K2", grammarTarget: "akkusativ" },
  { id: "o1", kind: "order", q: "رتّب:", words: ["Ich", "esse", "einen", "Apfel"], s: "Ich esse einen Apfel.", o: [], c: 0, why: "ترتيب.", lvl: "A1", chapterId: "K1", structureType: "svo_core" },
  { id: "e1", kind: "error", q: "❌ Ich sehe der Mann.", s: "Ich sehe den Mann.", o: ["Ich sehe den Mann.", "Ich sehe der Mann.", "Ich sehe dem Mann."], c: 0, why: "den للمفعول.", lvl: "A1", chapterId: "K2" }
];
var WORD_IMG = { "Hund|der": "img/words/9.jpeg" };
function conjugateVerb(inf) {
  const m = { lernen: { ich: "lerne", du: "lernst", er: "lernt" }, wohnen: { ich: "wohne", du: "wohnst", er: "wohnt" }, kommen: { ich: "komme", du: "kommst", er: "kommt" } };
  return m[inf] || null;
}

eval(PURE + "\n;globalThis.__SMT={SM_TF:SM_TF,SM_ODD:SM_ODD,SM_BUILD:SM_BUILD,SM_DLG:SM_DLG,SM_CTX:SM_CTX,SM_TYPES:SM_TYPES,SM_SKILLS:SM_SKILLS,SM_GEN:SM_GEN,SM_TYPE_SKILL:SM_TYPE_SKILL};");
const SM_TYPES = __SMT.SM_TYPES, SM_SKILLS = __SMT.SM_SKILLS, SM_GEN = __SMT.SM_GEN;

/* pools helper */
function mkPools(kaps) {
  return { words: smAllWords(kaps, "A1"), fills: smFills(kaps),
    fills0: SENT_FILL.filter(f => !kaps || !kaps.length || kaps.indexOf(f.chapterId) >= 0),
    orders: smOrders(kaps), nouns: smNouns(kaps), sents: smSents("A1"),
    tf: __SMT.SM_TF.slice(), odd: __SMT.SM_ODD.slice(), build: __SMT.SM_BUILD.slice(), kaps: kaps || [] };
}
function rightAns(q) {
  switch (q.type) {
    case "order": case "build": return q.words.map((_, k) => k);
    case "write": case "translate": case "listen_write": return q.accepts[0];
    case "chips": return q.correct;
    case "error": return { step: 1, ix: q.badIx };
    case "match": { const m = {}; q.pairs.forEach((p, i) => { m[i] = i; }); return m; }
    default: return q.correct;
  }
}
function wrongAns(q) {
  switch (q.type) {
    case "order": case "build": return q.words.map((_, k) => k).reverse();
    case "write": case "translate": case "listen_write": return "zzzqqq";
    case "chips": return "zzzqqq";
    case "error": return { step: 1, ix: (q.badIx + 1) % q.wrongTokens.length };
    case "match": { const m = {}; q.pairs.forEach((p, i) => { m[i] = (i + 1) % q.pairs.length; }); return m; }
    default: return (q.correct + 1) % q.opts.length;
  }
}

/* ---------- 1. all 20 types generate valid questions ---------- */
(function () {
  const P = mkPools([]);
  const missing = [];
  SM_TYPES.forEach(t => {
    let q = null;
    for (let i = 0; i < 30 && !q; i++) {
      try { const c = SM_GEN[t](P); if (c && smValidateQ(c)) q = c; } catch (e) {}
    }
    if (!q) missing.push(t);
  });
  check("all 20 types generate valid questions", missing.length === 0, missing.join(","));
})();

/* ---------- 2. grading right/wrong per type ---------- */
(function () {
  const P = mkPools([]);
  const bad = [];
  SM_TYPES.forEach(t => {
    let q = null;
    for (let i = 0; i < 30 && !q; i++) {
      try { const c = SM_GEN[t](P); if (c && smValidateQ(c)) q = c; } catch (e) {}
    }
    if (!q) { bad.push(t + ":nogen"); return; }
    let r1, r2;
    try { r1 = smCheck(q, rightAns(q)); } catch (e) { bad.push(t + ":check-throw"); return; }
    try { r2 = smCheck(q, wrongAns(q)); } catch (e) { bad.push(t + ":check-throw"); return; }
    if (r1.ok !== true) bad.push(t + ":right-rejected");
    if (r2.ok !== false) bad.push(t + ":wrong-accepted");
  });
  check("grading accepts right + rejects wrong (20 types)", bad.length === 0, bad.slice(0, 5).join(" | "));
})();

/* ---------- 3. session diversity: 20 questions ---------- */
(function () {
  const P = mkPools([]);
  const adapt = { acc: {}, mistSkills: {}, recent: [], difficulty: "adaptive" };
  const s = smBuildSession(20, P, adapt);
  check("20-Q session builds full", s.qs.length === 20, "n=" + s.qs.length);
  let maxRun = 1, run = 1;
  for (let i = 1; i < s.qs.length; i++) {
    if (s.qs[i].type === s.qs[i - 1].type) { run++; maxRun = Math.max(maxRun, run); }
    else run = 1;
  }
  check("no 3 consecutive same type", maxRun <= 2, "maxRun=" + maxRun);
  const ids = s.qs.map(q => q.id);
  check("no duplicate question", new Set(ids).size === ids.length, "");
  let tplRun = 1, tplMax = 1;
  for (let i = 1; i < s.qs.length; i++) {
    if (s.qs[i].tpl === s.qs[i - 1].tpl) { tplRun++; tplMax = Math.max(tplMax, tplRun); }
    else tplRun = 1;
  }
  check("no repeated template in a row", tplMax === 1, "tplMax=" + tplMax);
  const types = new Set(s.qs.map(q => q.type)), skills = new Set(s.qs.map(q => q.skill));
  check("session spans 6+ types", types.size >= 6, [...types].join(","));
  check("session spans 5+ skills", skills.size >= 5, [...skills].join(","));
  check("all session Qs valid", s.qs.every(smValidateQ), "");
})();

/* ---------- 4. difficulty engine ---------- */
(function () {
  const P = mkPools([]);
  let mq = null;
  for (let i = 0; i < 30 && !mq; i++) { try { const c = gMcq(P); if (c) mq = c; } catch (e) {} }
  const easy = smApplyDifficulty(JSON.parse(JSON.stringify(mq)), "easy");
  check("easy caps options at 3", easy.opts.length <= 3 && smValidateQ(easy), "n=" + easy.opts.length);
  const hard = smApplyDifficulty(JSON.parse(JSON.stringify(mq)), "hard");
  check("hard converts choice to writing", hard.type === "write" && hard.ui === "write" && smValidateQ(hard), hard.type + "/" + hard.ui);
  check("hard write accepts correct answer", smCheck(hard, mq.o ? undefined : hard.accepts[0]).ok === true, "");
})();

/* ---------- 5. adaptive weights ---------- */
(function () {
  const wBad = smSkillWeight("article", { article: { n: 10, ok: 2 } }, 0);
  const wGood = smSkillWeight("article", { article: { n: 10, ok: 10 } }, 0);
  check("weak skill outweighs mastered", wBad > wGood * 2, wBad.toFixed(2) + " vs " + wGood.toFixed(2));
  const P = mkPools([]);
  const adapt = { acc: { article: { n: 10, ok: 1 } }, mistSkills: {}, recent: [], difficulty: "adaptive" };
  const s = smBuildSession(10, P, adapt);
  check("adaptive session targets weak skill", s.qs.some(q => q.skill === "article"), s.qs.map(q => q.skill).join(","));
})();

/* ---------- 6. anti-repeat history ---------- */
(function () {
  const P = mkPools([]);
  const first = smBuildSession(10, P, { acc: {}, mistSkills: {}, recent: [], difficulty: "medium" });
  const recent = first.qs.map(q => ({ qid: q.id, tpl: q.tpl }));
  const second = smBuildSession(10, P, { acc: {}, mistSkills: {}, recent: recent, difficulty: "medium" });
  const overlap = second.qs.filter(q => recent.some(r => r.qid === q.id));
  check("history avoids recent qids", overlap.length === 0, overlap.map(q => q.id).slice(0, 3).join(","));
})();

/* ---------- 7. per-skill feedback ---------- */
(function () {
  const P = mkPools([]);
  const aq = gArticle(P);
  check("article feedback shows answer", smFeedback("article", aq, false, "").indexOf(aq.word.art) >= 0, "");
  const oq = gOrder(P);
  check("order feedback mentions verb position", smFeedback("order", oq, false, "").indexOf("الثاني") >= 0, "");
  const pq = gPlural(P);
  check("plural feedback shows plural", smFeedback("plural", pq, false, "").indexOf(pq.word.plural) >= 0, "");
  const rq = (function () { for (let i = 0; i < 30; i++) { try { const c = gReply(P); if (c && c.natural) return c; } catch (e) {} } return null; })();
  check("context-natural feedback is gentle", rq && smFeedback("context", rq, false, "").indexOf("الطبيعي") >= 0, "");
  const tq = gTranslate(P);
  check("translation feedback mentions order", smFeedback("translation", tq, false, "").indexOf("ترتيب") >= 0, "");
  check("correct feedback is positive", smFeedback("verb", aq, true, "").indexOf("صحيح") >= 0, "");
})();

/* ---------- 8. kapitel filter + empty safety ---------- */
(function () {
  const P = mkPools(["K9"]);
  check("unknown kapitel: no throw, fills empty", P.fills.length === 0 && P.words.length === 0, "");
  let threw = false;
  try {
    SM_TYPES.forEach(t => { try { SM_GEN[t](P); } catch (e) { threw = true; } });
    smBuildSession(10, P, { acc: {}, mistSkills: {}, recent: [], difficulty: "medium" });
  } catch (e) { threw = true; }
  check("empty pools never throw", threw === false, "");
  const P2 = mkPools(["K1"]);
  check("kapitel filter respected", P2.words.every(w => (w.kap || "KX") === "K1"), "");
})();

/* ---------- 9. renderer coverage (static) ---------- */
(function () {
  const need = ["smUiChoice", "smUiChips", "smUiOrder", "smUiWrite", "smUiMatch", "smUiError"];
  const missing = need.filter(f => SRC.indexOf("function " + f + "(") < 0);
  check("all UI renderers defined", missing.length === 0, missing.join(","));
  ["choice", "chips", "order", "write", "match", "error", "listen", "listenwrite"].forEach(ui => {
    check("smQ routes ui=" + ui, SRC.indexOf('q.ui==="' + ui + '"') >= 0, "");
  });
  check("practice page repointed", SRC.indexOf("PLAY_PAGES") >= 0 && SRC.indexOf("renderSmartNew") >= 0, "");
})();

/* ---------- 10. prompt HTML builds for every generated question ---------- */
(function () {
  function grab(name) {
    const si = SRC.indexOf("function " + name + "(");
    if (si < 0) throw new Error("missing " + name);
    const sub = SRC.slice(si);
    const bi = sub.indexOf("{");
    let depth = 0, q = null, i;
    for (i = bi; i < sub.length; i++) {
      const ch = sub[i];
      if (q) {
        if (ch === "\\") { i++; continue; }
        if (ch === q) q = null;
        continue;
      }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) break; }
    }
    return sub.slice(0, i + 1);
  }
  function escapeHtml(s) { return String(s == null ? "" : s); }
  eval(grab("smSkillAr") + "\n" + grab("smTypeAr") + "\n" + grab("smPromptHtml"));
  const P = mkPools([]);
  const s = smBuildSession(30, P, { acc: {}, mistSkills: {}, recent: [], difficulty: "adaptive" });
  let bad = 0, why = "";
  s.qs.forEach(q => {
    try {
      const h = smPromptHtml(q);
      const hasHead = q.type === "img_word" ? h.indexOf("sm-img-big") >= 0 : (h.indexOf("<h3") >= 0 || h.indexOf("sm-scene") >= 0);
      if (!h || h.length < 10 || !hasHead || h.indexOf("undefined") >= 0) { bad++; why = q.type + ":bad-html"; }
      if ((q.ui === "order" || q.type === "build") && q.words.length < 2) { bad++; why = q.type + ":words"; }
      if (q.ui === "write" && (!q.accepts || !q.accepts.length)) { bad++; why = q.type + ":accepts"; }
    } catch (e) { bad++; why = q.type + ":" + e.message; }
  });
  check("prompt HTML valid for 30Qs", bad === 0, why);
})();

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
