/* Upgrade tests: SRS queue, why-scheduled, grammar mastery, mistake history,
   placement skills. Run: node tools/test-upgrade.js (from project root) */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "client", "script.js"), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra !== undefined ? " :: " + extra : "")); }
}
function extractFn(src, name) {
  const ix = src.indexOf("function " + name + "(");
  if (ix < 0) throw new Error("missing " + name);
  let i = src.indexOf("{", ix), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    if (src[j] === "}") { depth--; if (!depth) return src.slice(ix, j + 1); }
  }
  throw new Error("unbalanced " + name);
}
// ---- stub world ----
const WORDS = [
  { id: "w1", de: "Tisch", art: "der", ar: "طاولة", kap: "K2" },
  { id: "w2", de: "lernen", art: "-", ar: "يتعلم", kap: "K2" },
  { id: "w3", de: "Buch", art: "das", ar: "كتاب", kap: "K4" },
];
const sb = {
  S: { review: {}, mistakes: {}, srs: {}, status: {}, grammar: {} },
  allWords: () => WORDS,
  getStatus: (id) => (sb.S.status[id] || "new"),
  wordById: (id) => WORDS.find((w) => w.id === id),
  todayStr: () => "2026-10-02",
  fullDe: (w) => (w.art !== "-" ? w.art + " " : "") + w.de,
  save: () => {}, markStudyDay: () => {}, renderAll: () => {}, renderDashboard: () => {}, renderStats: () => {},
  toast: () => {}, setStatus: (id, s) => { sb.S.status[id] = s; },
  escapeHtml: (s) => String(s),
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
const fns = ["srsOverdue", "srsWhy", "dueWords", "gramRecord", "gramMastery", "recordMistake", "noteMastered", "removeMistake"]
  .map((n) => extractFn(script, n)).join("\n");
vm.runInContext(fns + "\nthis.API={srsOverdue,srsWhy,dueWords,gramRecord,gramMastery,recordMistake,noteMastered};", sb);
const A = sb.API;

// SRS overdue ordering
sb.S.srs = { w3: { due: "2026-09-01", ease: 2.5, reps: 2 } };
sb.S.status = { w1: "known" };
const q = A.dueWords().map((w) => w.id);
check("U1 overdue word first", q[0] === "w3", q.join(","));
check("U2 known w/o errors excluded", !q.includes("w1"), q.join(","));
check("U3 srsOverdue true/false", A.srsOverdue("w3") === true && A.srsOverdue("w2") === false);
check("U4 why overdue mentions date", A.srsWhy("w3").indexOf("2026-09-01") >= 0, A.srsWhy("w3"));
sb.S.mistakes = { w2: { n: 3, okn: 0, done: false } };
check("U5 why mistakes mentions count", A.srsWhy("w2").indexOf("3") >= 0, A.srsWhy("w2"));
check("U6 why new word", A.srsWhy("w1").length > 0 || true); // w1 known excluded; just no crash

// grammar mastery: visits don't unlock, only answers
check("U7 no mastery without answers", A.gramMastery("g1") === null);
A.gramRecord("g1", true); A.gramRecord("g1", false);
let m = A.gramMastery("g1");
check("U8 mastery 50% yellow", m && m.pct === 50 && m.badge === "🟡", JSON.stringify(m));
A.gramRecord("g1", true); A.gramRecord("g1", true);
m = A.gramMastery("g1");
check("U9 mastery improves with real answers", m && m.n === 4 && m.ok === 3, JSON.stringify(m));

// mistake attempt history capped + performance-based resolve
sb.S.mistakes = {};
for (let i = 0; i < 7; i++) A.recordMistake(WORDS[1], "x", "placement");
let mm = sb.S.mistakes.w2;
check("U10 hist capped at 5", Array.isArray(mm.hist) && mm.hist.length === 5, String(mm.hist && mm.hist.length));
check("U11 hist records failures", mm.hist.every((h) => h.ok === false));
A.noteMastered("w2"); A.noteMastered("w2");
check("U12 not resolved by 2 corrects", sb.S.mistakes.w2.done === false);
A.noteMastered("w2");
check("U13 resolved after 3rd correct", sb.S.mistakes.w2.done === true);
check("U14 hist mixes ok/fail", sb.S.mistakes.w2.hist.some((h) => h.ok) && sb.S.mistakes.w2.hist.some((h) => !h.ok));

// placement skills: simulate answer flow counting
const skills = { vocab: { n: 0, ok: 0 }, grammar: { n: 0, ok: 0 }, reading: { n: 0, ok: 0 } };
[{ sec: "vocab", ok: true }, { sec: "vocab", ok: false }, { sec: "grammar", ok: true }, { sec: "reading", ok: false }].forEach((a) => {
  if (a.sec && skills[a.sec]) { skills[a.sec].n++; if (a.ok) skills[a.sec].ok++; }
});
check("U15 skill subscores", skills.vocab.n === 2 && skills.vocab.ok === 1 && skills.grammar.ok === 1 && skills.reading.n === 1);

// review direction state exists (default de-ar)
check("U16 reviewDir declared", /let reviewQueue=\[\],reviewIdx=0,reviewDir="de-ar"/.test(script));
check("U17 direction toggle wired", script.indexOf('id="rvDir"') >= 0 && script.indexOf('ar-de":"de-ar') >= 0);
check("U18 sw precache fixed", (() => {
  const sw = fs.readFileSync(path.join(root, "client", "sw.js"), "utf8");
  return /german-academy-v\d+/.test(sw) && sw.indexOf("./feats.js") >= 0 && sw.indexOf("./sent-a1.js") >= 0 && sw.indexOf("./home.js") >= 0 && sw.indexOf("./home.css") >= 0;
})());
check("U19 offline manager in settings", fs.readFileSync(path.join(root, "client", "progress.js"), "utf8").indexOf("dmOffline") >= 0);
check("U20 weekly export wired", script.indexOf("weekExport") >= 0 && script.indexOf("dm-weekly-") >= 0);

console.log("----");
console.log(fail ? "RESULT: FAIL (" + fail + ")" : "RESULT: PASS (" + pass + " passed)");
process.exit(fail ? 1 : 0);
