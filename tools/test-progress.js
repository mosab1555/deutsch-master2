/* Tests for the unified learning-progress system (client/progress.js, PURE):
   1. recording a correct answer / 2. recording an incorrect answer
   3. duplicate aids never double-count / 4. rebuildTotals after "refresh"
   5. migrate preserves legacy data / 6. review policy: fail=>early,
      repeated success=>growing intervals, mastered stays finite
   7. buildQueue prioritizes overdue + missed / 8. skill classification
      uses stable ids (not raw text) / 9. weekly summary honesty
   10. quiz choke-point wiring present in script.js
   Run: node tools/test-progress.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(root, "client", "progress.js"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
/* extract PURE ENGINE section */
const _ps = SRC.indexOf("*/", SRC.indexOf("PURE ENGINE")) + 2;
const _pe = SRC.indexOf("/* ====================== RENDERERS (browser)");
const PURE = SRC.slice(_ps, _pe).replace('"use strict";', "");
const DMProgress = new Function(PURE + "\nreturn DMProgress;")();

/* 1+2: record correct + incorrect */
let s = {};
check("T1 correct answer recorded",
  DMProgress.logAttempt(s, DMProgress.makeAttempt({ aid: "a1", sec: "quiz", qid: "q1", ok: true })).recorded === true);
check("T2 totals after correct", s.totalAnswered === 1 && s.totalCorrect === 1, JSON.stringify({ a: s.totalAnswered, c: s.totalCorrect }));
check("T3 incorrect answer recorded",
  DMProgress.logAttempt(s, DMProgress.makeAttempt({ aid: "a2", sec: "quiz", qid: "q2", ok: false })).recorded === true);
check("T4 totals after incorrect", s.totalAnswered === 2 && s.totalCorrect === 1);

/* 3: dedupe */
const dup = DMProgress.logAttempt(s, DMProgress.makeAttempt({ aid: "a1", sec: "quiz", qid: "q1", ok: true }));
check("T5 duplicate aid rejected", dup.recorded === false && dup.reason === "duplicate");
check("T6 no inflation after duplicate", s.totalAnswered === 2 && s.totalCorrect === 1);
check("T7 aid required", DMProgress.logAttempt(s, { sec: "quiz", ok: true }).recorded === false);

/* retention bound */
let big = {};
for (let i = 0; i < 600; i++) DMProgress.logAttempt(big, DMProgress.makeAttempt({ aid: "e" + i, ok: i % 2 === 0 }));
check("T8 retention capped at MAX_EVENTS", big.events.length === DMProgress.MAX_EVENTS, String(big.events.length));
const rb = DMProgress.rebuildTotals(big);
check("T9 rebuild matches log", rb.totalAnswered === DMProgress.MAX_EVENTS && big.totalCorrect === rb.totalCorrect);

/* 4: refresh reconstruction: serialize, parse, rebuild */
let s2 = JSON.parse(JSON.stringify(s));
s2.totalAnswered = 0; s2.totalCorrect = 0; /* simulate lost counters */
const r2 = DMProgress.rebuildTotals(s2);
check("T10 scores reconstructed after refresh", r2.totalAnswered === 2 && r2.totalCorrect === 1);

/* 5: migration preserves data */
let legacy = { customWords: [{ id: "x" }], totalCorrect: 5, totalAnswered: 9, settings: { theme: "dark" }, streak: { count: 3 }, mistakes: { k0w1: { n: 2 } } };
const mg = DMProgress.migrate(legacy);
check("T11 legacy migrated", mg.migrated === true && legacy.schemaV === DMProgress.SCHEMA_V);
check("T12 legacy progress preserved",
  legacy.totalCorrect === 5 && legacy.totalAnswered === 9 && legacy.customWords.length === 1 && legacy.mistakes.k0w1.n === 2);
check("T13 re-migrate is no-op", DMProgress.migrate(legacy).migrated === false);

/* 6: review policy */
let r = DMProgress.nextReview({ ok: false, laps: 5, ease: 2.5, miss: 0 });
check("T14 fail schedules early", r.laps === 0 && r.dueIn === 1 && r.ease < 2.5);
let g1 = DMProgress.nextReview({ ok: true, laps: 0, ease: 2.5, miss: 0 });
let g2 = DMProgress.nextReview({ ok: true, laps: 2, ease: 2.5, miss: 0 });
let g3 = DMProgress.nextReview({ ok: true, laps: 5, ease: 2.5, miss: 0 });
check("T15 intervals grow with success", g1.dueIn < g2.dueIn && g2.dueIn < g3.dueIn, [g1.dueIn, g2.dueIn, g3.dueIn].join(","));
let gm = DMProgress.nextReview({ ok: true, laps: 8, ease: 2.5, miss: 0 });
check("T16 mastered stays finite", gm.dueIn === 90 && gm.laps === 9);
let gc = DMProgress.nextReview({ ok: true, laps: 5, ease: 2.5, miss: 4 });
check("T17 frequently-missed is conservative", gc.dueIn < g3.dueIn, gc.dueIn + " vs " + g3.dueIn);

/* 7: queue ordering */
const q = DMProgress.buildQueue([
  { id: "new", due: DMProgress.todayKey(), laps: 0, miss: 0 },
  { id: "overdue-missed", due: "2000-01-01", laps: 0, miss: 4 },
  { id: "overdue", due: "2000-01-01", laps: 0, miss: 0 }
]);
check("T18 overdue+missed first", q[0].id === "overdue-missed" && q[1].id === "overdue" && q[2].id === "new");

/* 8: skill classification prefers stable ids */
check("T19 kind article => artikel", DMProgress.classifyError({ kind: "article" }) === "artikel");
check("T20 kind plural => plural", DMProgress.classifyError({ kind: "plural" }) === "plural");
check("T21 same text different skills stay separate",
  DMProgress.classifyError({ kind: "article", q: "Der Mann" }) !== DMProgress.classifyError({ kind: "plural", q: "Der Mann" }));
check("T22 skills have Arabic why + example",
  Object.keys(DMProgress.SKILLS).every(k => DMProgress.SKILLS[k].ar && DMProgress.SKILLS[k].why && DMProgress.SKILLS[k].ex));
check("T23 skillOfMistake uses mistake kind", DMProgress.skillOfMistake({ kind: "article" }, null) === "artikel");

/* 9: weekly summary honesty */
const empty = DMProgress.weeklySummary({ events: [] });
check("T24 empty log => hasData false, no fabrication", empty.hasData === false && empty.cur.ans === 0);
let ws = { events: [] };
for (let i = 0; i < 6; i++) DMProgress.logAttempt(ws, DMProgress.makeAttempt({ aid: "w" + i, ok: i < 4, ts: new Date().toISOString() }));
const sum = DMProgress.weeklySummary(ws);
check("T25 weekly summary counts", sum.hasData === true && sum.cur.ans === 6 && sum.cur.ok === 4 && sum.cur.pct === 67, JSON.stringify(sum.cur));

/* continue target */
check("T26 continue defaults to vocab", DMProgress.continueTarget({}).page === "vocab");
check("T27 continue returns last activity",
  DMProgress.continueTarget({ lastActivity: { page: "quiz" } }).page === "quiz");

/* 10: wiring present in app sources */
const script = fs.readFileSync(path.join(root, "client", "script.js"), "utf8");
check("T28 showFeedback choke point intact", script.indexOf("function showFeedback(ok,q,pickedText)") >= 0);
check("T29 skill filter wired in renderMistakes", script.indexOf("mistSkill") >= 0 && script.indexOf("skillOfMistake") >= 0);
const prog = SRC;
check("T30 progress hooks showFeedback once-per-attempt", prog.indexOf("lastAid") >= 0 && prog.indexOf("duplicate") >= 0);
const idx = fs.readFileSync(path.join(root, "client", "index.html"), "utf8");
check("T31 progress.js loaded after app", idx.indexOf("progress.js") > idx.indexOf("script.js"));
const sw = fs.readFileSync(path.join(root, "client", "sw.js"), "utf8");
check("T32 sw precaches progress.js", sw.indexOf("progress.js") >= 0);

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
