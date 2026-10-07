/* Tests for the Assessment Center (client/assess.js, PURE CORE + wiring):
   1-3.   per-skill scoring + evidence labels (thin vs ok)
   4.     insufficient data => inconclusive (anti-luck honesty)
   5-6.   confidence high/medium rules
   7-10.  adaptive level verdicts A0/A1/A2/B1 + inconclusive
   11-13. Kapitel readiness weighting + current-Kapitel rule
   14-15. stratified selection balance + shortage honesty
   16.     status labels are evidence-aware
   17-19. wiring: script tags, SW cache, labels, legacy quiz ids intact
   Run: node tools/test-assess.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(root, "client", "assess.js"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
/* extract PURE CORE (everything before the browser layer marker) */
const cutRaw = SRC.indexOf("BROWSER LAYER");
const cut = SRC.lastIndexOf("/*", cutRaw);
const PURE = SRC.slice(0, cut).replace('"use strict";', "");
const DMAssess = new Function(PURE + "\nreturn DMAssess;")();
const C = DMAssess.CONFIG;

function items(skill, okN, totalN, kap, topic) {
  const out = [];
  for (let i = 0; i < totalN; i++) out.push({ skill, topic: topic || skill, kap: kap || "K1", ok: i < okN });
  return out;
}

/* 1-3: skill scoring + evidence */
let r = DMAssess.scoreAnswers(items("vocab", 4, 5).concat(items("grammar", 1, 4)));
check("A1 vocab pct", r.skills.vocab.pct === 80 && r.skills.vocab.ev === "ok", JSON.stringify(r.skills.vocab));
check("A2 grammar pct", r.skills.grammar.pct === 25 && r.skills.grammar.ev === "ok", JSON.stringify(r.skills.grammar));
check("A3 untouched skill = none", r.skills.listening.ev === "none" && r.skills.listening.pct === 0);

/* thin evidence: 2 answers => thin, verdict nodata */
let r2 = DMAssess.scoreAnswers(items("vocab", 2, 2));
check("A4 thin evidence flagged", r2.skills.vocab.ev === "thin");
check("A5 thin => nodata status", DMAssess.statusOf(r2.skills.vocab.pct, "thin").k === "nodata");

/* 4: anti-luck — too few answers overall => inconclusive */
let r3 = DMAssess.scoreAnswers(items("vocab", 3, 4));
check("A6 inconclusive under MIN_OVERALL_N", r3.inconclusive === true && r3.total.n < C.MIN_OVERALL_N);

/* 5-6: confidence rules */
let big = [];
["vocab", "grammar", "sentences", "reading", "listening"].forEach(s => { big = big.concat(items(s, 4, 5)); });
let r4 = DMAssess.scoreAnswers(big);
check("A7 high confidence (25 answers, 5 skills)", r4.confidence === "high" && !r4.inconclusive, r4.confidence);
let mid = items("vocab", 7, 10).concat(items("grammar", 2, 3));
let r5 = DMAssess.scoreAnswers(mid);
check("A8 medium confidence (13 answers, 2 skills)", r5.confidence === "medium", r5.confidence);

/* 7-10: level verdicts */
check("A9 empty => inconclusive", DMAssess.levelFromStages([]).inconclusive === true);
check("A10 fail A => A0", DMAssess.levelFromStages([{ id: "A", pct: 40, n: 9 }]).level === "A0");
check("A11 pass A only => A1", DMAssess.levelFromStages([{ id: "A", pct: 80, n: 9 }]).level === "A1");
check("A12 pass A+B => A2", DMAssess.levelFromStages([{ id: "A", pct: 80, n: 9 }, { id: "B", pct: 75, n: 8 }]).level === "A2");
check("A13 pass all => B1", DMAssess.levelFromStages([{ id: "A", pct: 85, n: 9 }, { id: "B", pct: 80, n: 8 }, { id: "C", pct: 72, n: 8 }]).level === "B1");

/* 11-13: Kapitel readiness */
let kr0 = DMAssess.kapitelReadiness(null, null);
check("A14 no data => conf none", kr0.conf === "none" && kr0.pct === 0);
let kr1 = DMAssess.kapitelReadiness({ n: 6, ok: 5, pct: 83 }, 70);
const exp1 = Math.round(C.TEST_W_KAP * 83 + C.PROG_W_KAP * 70);
check("A15 weighted readiness math", kr1.pct === exp1 && kr1.conf === "high", kr1.pct + " vs " + exp1);
let kr2 = DMAssess.kapitelReadiness({ n: 2, ok: 2, pct: 100 }, null);
check("A16 tiny test sample distrusted", kr2.conf === "none", JSON.stringify(kr2));
let cur = DMAssess.currentKapitel({ K1: { pct: 92 }, K2: { pct: 86 }, K3: { pct: 73 }, K4: { pct: 41 } }, ["K1", "K2", "K3", "K4"]);
check("A17 current = highest above KAP_READY", cur.current === "K3" && cur.next === "K4", JSON.stringify(cur));

/* 14-15: stratified selection */
const pool = [];
for (let i = 0; i < 10; i++) pool.push({ id: "v" + i, skill: "vocab" });
for (let i = 0; i < 10; i++) pool.push({ id: "g" + i, skill: "grammar" });
let st = DMAssess.stratify(pool, [{ skill: "vocab", n: 3 }, { skill: "grammar", n: 3 }], Math.random);
const ids = st.picked.map(q => q.id);
check("A18 stratified balance", st.picked.length === 6 && new Set(ids).size === 6 && st.miss.length === 0);
let st2 = DMAssess.stratify(pool.slice(0, 10), [{ skill: "vocab", n: 3 }, { skill: "listening", n: 3 }], Math.random);
check("A19 shortage honestly reported", st2.picked.length === 3 && st2.miss.length === 1 && st2.miss[0].skill === "listening", JSON.stringify(st2.miss));

/* 16: status thresholds */
check("A20 status bands", DMAssess.statusOf(85, "ok").k === "strong" && DMAssess.statusOf(70, "ok").k === "good" && DMAssess.statusOf(50, "ok").k === "weak" && DMAssess.statusOf(20, "ok").k === "poor");

/* 17-19: wiring + no-regression static checks */
const IDX = fs.readFileSync(path.join(root, "client", "index.html"), "utf8");
const ACA = fs.readFileSync(path.join(root, "client", "academy.html"), "utf8");
const SW = fs.readFileSync(path.join(root, "client", "sw.js"), "utf8");
const STUDY = fs.readFileSync(path.join(root, "client", "study.js"), "utf8");
const SCRIPT = fs.readFileSync(path.join(root, "client", "script.js"), "utf8");
const LEARN = fs.readFileSync(path.join(root, "client", "learn.js"), "utf8");
check("A21 index.html loads assess.js", IDX.includes('<script src="assess.js">'));
check("A22 academy.html loads assess.js", ACA.includes('<script src="assess.js">'));
check("A23 sw precaches assess.js", SW.includes('"./assess.js"'));
check("A24 sidebar renamed to assessment center", STUDY.includes('quiz:"مركز الاختبارات"') && IDX.includes("مركز الاختبارات والتقييم"));
const legacyIds = ["quizSetup", "quizPlay", "quizResult", "quizHistory", "startQuiz", "quizOpts", "quizFeedback", "quizQuit", "quizNext", "quiz-type"];
const journeyIds = ["placeStart", "placeBox", "finalStart"];
const missingLegacy = legacyIds.filter(id => !(IDX.includes(id) && SCRIPT.includes(id)));
const missingJourney = journeyIds.filter(id => !LEARN.includes(id));
check("A25 legacy quiz/journey hooks intact", missingLegacy.length === 0 && missingJourney.length === 0, missingLegacy.concat(missingJourney).join(","));
check("A26 learn.js placement+final untouched", LEARN.includes("placeStart") && LEARN.includes("startFinal"));
check("A27 assess respects page-state preservation", SRC.includes("skipRender"));
check("A28 thresholds documented in CONFIG", ["KAP_READY", "PASS_A1_EXAM", "MIN_SKILL_N", "RESUME_TTL_DAYS"].every(k => SRC.includes(k)));

/* ===== B: Test Center engine (pure core + spec shapes, no DOM) ===== */
const V = DMAssess.validateQ;
check("B1 valid mc passes", V({ type: "mc", prompt: "Q?", opts: ["a", "b"], correct: 0 }) === true);
check("B2 rejects empty/short opts", V({ type: "mc", prompt: "Q?", opts: ["a"], correct: 0 }) === false);
check("B3 rejects duplicate opts", V({ type: "mc", prompt: "Q?", opts: ["x", "x"], correct: 0 }) === false);
check("B4 rejects bad correct index", V({ type: "mc", prompt: "Q?", opts: ["a", "b"], correct: 5 }) === false);
check("B5 rejects empty prompt", V({ type: "mc", prompt: "  ", opts: ["a", "b"], correct: 0 }) === false);
check("B6 order needs chips+answer", V({ type: "order", prompt: "Q?", chips: ["a", "b"], answer: "a b" }) === false && V({ type: "order", prompt: "Q?", chips: ["a", "b", "c"], answer: "a b c" }) === true);
check("B7 fill needs accept", V({ type: "fill", prompt: "Q? ___", accept: [] }) === false && V({ type: "fill", prompt: "Q? ___", accept: ["der"], answer: "der" }) === true);
check("B8 speak needs sample", V({ type: "speak", prompt: "Q?", sample: "" }) === false);
check("B9 match needs 2+ pairs", V({ type: "match", prompt: "Q?", pairs: [{ de: "a", ar: "ب" }] }) === false && V({ type: "match", prompt: "Q?", pairs: [{ de: "a", ar: "ب" }, { de: "c", ar: "د" }] }) === true);
check("B10 conj rows validated", V({ type: "conj", prompt: "Q?", rows: [{ opts: ["a"] }] }) === false && V({ type: "conj", prompt: "Q?", rows: [{ opts: ["a", "b"], correct: 0 }] }) === true);

const dist = DMAssess.distribute(20, { vocab: 20, grammar: 20, sentences: 20, verbs: 10, listening: 10, reading: 10, practical: 10 });
const dsum = Object.keys(dist).reduce((a, k) => a + dist[k], 0);
check("B11 distribute sums exactly", dsum === 20, JSON.stringify(dist));
check("B12 distribute empty ratios", JSON.stringify(DMAssess.distribute(10, {})) === "{}");

const rng1 = DMAssess.seededRng("daily-2026-01-01"), rng2 = DMAssess.seededRng("daily-2026-01-01");
const seq1 = [rng1(), rng1(), rng1()].join(","), seq2 = [rng2(), rng2(), rng2()].join(",");
const rng3 = DMAssess.seededRng("daily-2026-01-02");
check("B13 seeded rng deterministic", seq1 === seq2 && seq1 !== [rng3(), rng3(), rng3()].join(","));

const dpool = [{ id: "1", diff: "hard" }, { id: "2", diff: "easy" }, { id: "3", diff: "medium" }];
check("B14 easy filter", DMAssess.filterByDiff(dpool, "easy").length === 1);
const graded = DMAssess.filterByDiff(dpool, "graded").map(q => q.id).join("");
check("B15 graded sorts easy->hard", graded === "231", graded);
check("B16 missing level falls back", DMAssess.filterByDiff([{ id: "1", diff: "easy" }], "hard").length === 1);

/* full-file require (Node-safe, no window) for registry + spec shapes */
const FULL = require(path.join(root, "client", "assess.js"));
const FKEYS = Object.keys(FULL.ui.FACTORIES);
["kein", "conj", "wordClass", "sentMean", "dialogue", "listenGap"].forEach(f => {
  check("B17 factory registered: " + f, FKEYS.includes(f));
});
const CATS = FULL.specs.CATS;
check("B18 CATS registry complete", FULL.specs.CAT_IDS.length >= 13 && CATS.words && CATS.words.facs.length >= 2 && CATS.mistakes.facs === null, FULL.specs.CAT_IDS.length);
check("B19 MODES sizes", FULL.specs.MODES.quick.n === 20 && FULL.specs.MODES.normal.n === 40 && FULL.specs.MODES.intensive.n === 60 && FULL.specs.MODES.advanced.n === 80 && FULL.specs.MODES.master.n === 0);
check("B20 DIFFS four levels", Object.keys(FULL.specs.DIFFS).join(",") === "easy,medium,hard,graded");
const kc = FULL.specs.kapitelCategorySpec("K3", "grammar", "normal", "medium", null);
check("B21 kapitelCategorySpec shape", kc.id.includes("K3") && kc.id.includes("grammar") && kc.diffKey === "medium" && kc.minQ === 5 && typeof kc.build === "function", kc.id);
const cu = FULL.specs.customSpec({ levels: ["A1"], kaps: ["K1"], cats: ["words"], diff: "easy", count: 10, mode: "challenge" });
check("B22 customSpec challenge flags", cu.qTimed === true && cu.timed === false && cu.minQ === 5, JSON.stringify({ q: cu.qTimed, t: cu.timed }));
const cue = FULL.specs.customSpec({ cats: ["grammar"], count: 20, mode: "exam" });
check("B23 customSpec exam flags", cue.timed === true && cue.passPct === FULL.CONFIG.PASS_A1_EXAM);
const dl = FULL.specs.dailySpec("2026-05-01");
check("B24 dailySpec shape", dl.id === "daily-2026-05-01" && dl.minQ === 8 && !!dl.seed);
const bs = FULL.specs.bossSpec("K3");
check("B25 bossSpec shape", bs.adaptiveDiff === true && bs.minQ === 8 && typeof bs.build === "function");
check("B26 boss locked when weak", FULL.specs.bossUnlock("K3", { K3: { pct: 30 } }, []).ok === false);
check("B27 boss unlocked by readiness", FULL.specs.bossUnlock("K3", { K3: { pct: 80 } }, []).ok === true);
check("B28 boss unlocked by 3 tests", FULL.specs.bossUnlock("K3", {}, [{ kaps: { K3: { n: 5 } } }, { kaps: { K3: { n: 5 } } }, { kaps: { K3: { n: 5 } } }]).ok === true);
const ms = FULL.specs.mistakeSpec("K1");
check("B29 mistakeSpec shape", ms.minQ === 4 && typeof ms.build === "function");
const sm = FULL.specs.smartSpec({ weakSkills: ["grammar"], total: 15 });
check("B30 smartSpec shape", sm.minQ === 6 && typeof sm.build === "function");
check("B31 new thresholds documented", ["QTIME_SEC", "BOSS_UNLOCK_READY", "PERFECT_ROUND_N", "MASTER_CAP"].every(k => SRC.includes(k)));
const TC = fs.readFileSync(path.join(root, "client", "testcenter.js"), "utf8");
check("B32 testcenter module present", TC.includes("DMTestCenter") && TC.includes("renderSection") && TC.includes("builderHtml") && TC.includes("recordsHtml"));
check("B33 testcenter wired in pages", IDX.includes('<script src="testcenter.js">') && fs.readFileSync(path.join(root, "client", "academy.html"), "utf8").includes('<script src="testcenter.js">'));
check("B34 sw precaches testcenter", SW.includes('"./testcenter.js"'));
check("B35 picker hooked in dashboard", SRC.includes("DMTestCenter.renderSection") && SRC.includes("DMTestCenter.wire"));

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
