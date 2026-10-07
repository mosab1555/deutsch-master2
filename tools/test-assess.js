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

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
