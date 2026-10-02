/* Robustness: error-states, edge cases, integration integrity (Node-runnable).
   Covers: corrupt storage boot, quota failure, malformed records, empty pools,
   extreme strings, HTML id/nav/script integrity, www<->client sync,
   SW precache coverage, dynamic-markup CSS coverage.
   Maps to: PROG-010, DATA-005, UI-005, UI-006, PWA-005, PWA-007,
            ERR-001, ERR-002, ERR-005, ERR-006, NAV-002.
   Run: node tools/test-robustness.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
function noThrow(name, fn) {
  try { fn(); check(name, true); }
  catch (e) { check(name, false, String(e && e.message || e)); }
}

/* ---------- load pure cores ---------- */
const progSrc = RD("client/progress.js");
const _ps = progSrc.indexOf("*/", progSrc.indexOf("PURE ENGINE")) + 2;
const _pe = progSrc.indexOf("/* ====================== RENDERERS (browser)");
const DMProgress = new Function(progSrc.slice(_ps, _pe).replace('"use strict";', "") + "\nreturn DMProgress;")();

/* ---------- ERR-001 / PROG-010: corrupt storage boot ---------- */
noThrow("R1 migrate(null) safe", () => DMProgress.migrate(null));
noThrow("R2 migrate(string) safe", () => DMProgress.migrate("garbage"));
noThrow("R3 migrate(array) safe", () => DMProgress.migrate([1, 2]));
check("R4 migrate(null) not migrated", DMProgress.migrate(null).migrated === false);
const weird = { events: "not-an-array", evSeen: 42, totalAnswered: "x", schemaV: 99 };
const mw = DMProgress.migrate(weird);
check("R5 future schemaV untouched", mw.migrated === false && mw.from === 99);
const malformed = { events: "nope", evSeen: 42, totalAnswered: "x" };
DMProgress.migrate(malformed);
check("R6 malformed store normalized", Array.isArray(malformed.events) && typeof malformed.evSeen === "object" && malformed.totalAnswered === 0);
noThrow("R7 logAttempt on normalized store", () => {
  const s = {};
  DMProgress.migrate({ events: "nope" });
  DMProgress.logAttempt(s, DMProgress.makeAttempt({ aid: "r7", ok: true }));
  if (s.totalAnswered !== 1) throw new Error("totals wrong");
});
check("R8 rebuild on empty store", JSON.stringify(DMProgress.rebuildTotals({})) === JSON.stringify({ totalAnswered: 0, totalCorrect: 0 }));

/* ---------- ERR-002: quota failure ---------- */
const realLS = global.localStorage;
global.localStorage = { setItem() { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } };
try {
  const big = { events: [] };
  for (let i = 0; i < 80; i++) big.events.push({ aid: "q" + i, ok: true });
  const r1 = DMProgress.safeSave(big, "k");
  check("R9 quota failure handled gracefully", r1.saved === false && r1.reason === "storage-error", JSON.stringify(r1));
  const r2 = DMProgress.safeSave(null, "k");
  check("R10 safeSave(null) no crash", r2.saved === false);
} finally { if (realLS === undefined) delete global.localStorage; else global.localStorage = realLS; }
check("R11 no localStorage => no-storage", DMProgress.safeSave({}, "k").saved === false);

/* ---------- DATA-005 / ERR-005: malformed records + empty pools ---------- */
noThrow("R12 classifyError(null/empty)", () => {
  if (DMProgress.classifyError(null) !== "allgemein") throw new Error("null");
  if (DMProgress.classifyError({}) !== "allgemein") throw new Error("empty");
  if (DMProgress.classifyError({ kind: null, q: null }) !== "allgemein") throw new Error("nulls");
});
noThrow("R13 makeAttempt(null) defaults", () => {
  const e = DMProgress.makeAttempt(null);
  if (e.aid !== "" || e.ok !== false || e.max !== 1) throw new Error("defaults");
});
noThrow("R14 nextReview(garbage)", () => {
  const r = DMProgress.nextReview({ ok: "yes", laps: -5, ease: "fast", miss: NaN });
  if (typeof r.dueIn !== "number" || r.laps < 0) throw new Error("bad policy");
});
check("R15 buildQueue([]) empty", DMProgress.buildQueue([]).length === 0);
check("R16 buildQueue(null) empty", DMProgress.buildQueue(null).length === 0);
noThrow("R17 buildQueue missing fields", () => {
  const q = DMProgress.buildQueue([{ id: "a" }, {}, { id: "b", due: "nonsense" }]);
  if (q.length !== 3) throw new Error("len");
});
noThrow("R18 weeklySummary garbage events", () => {
  const s = DMProgress.weeklySummary({ events: [{ ts: "garbage" }, null, {}, { ts: null, ok: true }] });
  if (s.hasData !== false) throw new Error("should be empty");
});
noThrow("R19 weeklySummary(null store)", () => DMProgress.weeklySummary(null));
check("R20 dayDiff garbage safe", DMProgress.dayDiff("xx", null) === 0);

/* ---------- ERR-006: extreme strings ---------- */
noThrow("R21 5k-char inputs", () => {
  const big = "ä".repeat(2500) + "ß Straße " + "كلمة ".repeat(500);
  DMProgress.classifyError({ q: big, de: big, correct: big });
  DMProgress.makeAttempt({ aid: big.slice(0, 50), qid: big.slice(0, 50) });
  DMProgress.skillOfMistake({ kind: "article", q: big }, { de: big });
});
noThrow("R22 mixed-script inputs", () => {
  DMProgress.classifyError({ q: "Der Mann الرجل man!?", correct: "den" });
  DMProgress.classifyError({ q: "🎉✅ mixed |\\/ test", kind: 42 });
});

/* ---------- NAV-002 / UI-005: HTML integrity (both shells) ---------- */
for (const f of ["client/index.html", "client/academy.html"]) {
  const h = RD(f);
  const ids = [...h.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  const seen = new Set(), dups = new Set();
  ids.forEach(i => { if (seen.has(i)) dups.add(i); seen.add(i); });
  check("R23 " + f + " no duplicate ids (" + ids.length + ")", dups.size === 0, [...dups].join(","));
  const navs = [...new Set([...h.matchAll(/data-page="([^"]+)"/g)].map(m => m[1]))];
  const secs = new Set([...h.matchAll(/id="page-([^"]+)"/g)].map(m => m[1]));
  const missing = navs.filter(n => !secs.has(n));
  check("R24 " + f + " nav targets resolve (" + navs.length + ")", missing.length === 0, missing.join(","));
  const scripts = [...h.matchAll(/<script src="([^"]+?)(?:\?[^"]*)?"><\/script>/g)].map(m => m[1]);
  const missF = scripts.filter(s => !fs.existsSync(path.join(root, "client", s)));
  check("R25 " + f + " script files exist (" + scripts.length + ")", missF.length === 0, missF.join(","));
}

/* ---------- PWA-007: www mirrors client ---------- */
(function () {
  const cf = fs.readdirSync(path.join(root, "client")).filter(f => fs.statSync(path.join(root, "client", f)).isFile());
  const wf = fs.readdirSync(path.join(root, "www")).filter(f => fs.statSync(path.join(root, "www", f)).isFile());
  const onlyC = cf.filter(f => !wf.includes(f)), onlyW = wf.filter(f => !cf.includes(f));
  check("R26 www file list matches client", onlyC.length === 0 && onlyW.length === 0, "onlyC=" + onlyC.join(",") + " onlyW=" + onlyW.join(","));
  let diffs = [];
  for (const f of cf) {
    if (!wf.includes(f)) continue;
    let a = RD("client/" + f), b = RD("www/" + f);
    if (/\.html$/.test(f)) { a = a.replace(/\?v=[0-9a-f]+/g, "?v=X"); b = b.replace(/\?v=[0-9a-f]+/g, "?v=X"); }
    if (a !== b) diffs.push(f);
  }
  check("R27 www content identical (mod ?v=)", diffs.length === 0, diffs.join(","));
})();

/* ---------- PWA-005: SW precache coverage ---------- */
(function () {
  const sw = RD("client/sw.js");
  const jsFiles = fs.readdirSync(path.join(root, "client")).filter(f => /\.js$/.test(f) && f !== "sw.js");
  const missing = jsFiles.filter(f => sw.indexOf('"./' + f + '"') < 0);
  check("R28 sw precaches all app scripts (" + jsFiles.length + ")", missing.length === 0, missing.join(","));
  check("R29 sw cache version current", /german-academy-v(3[3-9]|[4-9][0-9])/.test(sw));
})();

/* ---------- UI-006: dynamic markup CSS coverage ---------- */
(function () {
  const css = RD("client/style.css");
  const src = RD("client/career.js") + "\n" + RD("client/progress.js");
  const cls = new Set();
  for (const m of src.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => c && cls.add(c));
  for (const m of src.matchAll(/className="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => c && cls.add(c));
  for (const m of src.matchAll(/classList\.add\("([^"]+)"\)/g)) cls.add(m[1]);
  const missing = [...cls].filter(c => css.indexOf("." + c) < 0);
  check("R30 dynamic classes defined (" + cls.size + ")", missing.length === 0, missing.join(","));
})();

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
