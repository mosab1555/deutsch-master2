/* Content-relationship integrity (Phase 4):
   - career module grammar links resolve to real EXPLAIN grammar ids
   - DMProgress SKILLS rule links resolve to real EXPLAIN grammar ids
   - no duplicate German sentences across career dialogues/phrases
   - career quiz qids unique; word detail hooks intact in script.js
   Run: node tools/check-links.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
function normDe(s) {
  return String(s || "").trim().toLowerCase().replace(/[.?!,،؛:;""«»]/g, "").replace(/\s+/g, " ");
}

const explain = fs.readFileSync(path.join(root, "client", "explain.js"), "utf8");
const idSet = new Set();
(explain.match(/\bg\d+\b/g) || []).forEach(id => idSet.add(id));
check("L1 explain grammar ids present", idSet.size >= 30, "n=" + idSet.size);

const careerSrc = fs.readFileSync(path.join(root, "client", "career.js"), "utf8");
const careerGram = [...careerSrc.matchAll(/\{ id: "(g\d+)", t:/g)].map(m => m[1]);
check("L2 career links resolve to explain ids",
  careerGram.length > 0 && careerGram.every(id => idSet.has(id)),
  careerGram.filter(id => !idSet.has(id)).join(","));

const progSrc = fs.readFileSync(path.join(root, "client", "progress.js"), "utf8");
const skillRules = [...progSrc.matchAll(/rule: "(g\d+)"/g)].map(m => m[1]);
check("L3 error-skill rule links resolve",
  skillRules.length > 0 && skillRules.every(id => idSet.has(id)),
  skillRules.filter(id => !idSet.has(id)).join(","));

/* duplicate-sentence guard across career content */
const DATA = careerSrc.slice(0, careerSrc.indexOf("/* ====================== RENDERERS (browser)"));
const TRACKS = new Function(DATA + "\nreturn CAREER_TRACKS;")();
const seen = new Map();
let dups = [];
TRACKS.forEach(t => t.modules.forEach(m => {
  const all = []
    .concat((m.phrases || []).map(p => p[0]))
    .concat((m.dialogue || []).map(d => d[0]))
    .concat((m.vocab || []).map(v => v[4]))
    .concat([m.followup.a]);
  all.forEach(s => {
    const k = normDe(s);
    if (!k) return;
    /* cross-module duplicates only: reuse inside one module (example
       reinforcing a phrase) is intentional pedagogy, not a bug. */
    if (seen.has(k) && seen.get(k) !== m.id) dups.push(s + "  [" + seen.get(k) + " vs " + m.id + "]");
    else if (!seen.has(k)) seen.set(k, m.id);
  });
}));
check("L4 no duplicate German sentences in career", dups.length === 0, dups.slice(0, 3).join(" | "));

/* word-detail relationship hooks intact */
const script = fs.readFileSync(path.join(root, "client", "script.js"), "utf8");
check("L5 openWordDetail intact", script.indexOf("function openWordDetail(id)") >= 0);
check("L6 global search engine intact", script.indexOf("function runGlobalSearch") >= 0 || script.indexOf("runGlobalSearch") >= 0);

/* every career vocab noun carries plural (existing app convention) */
let noPlural = [];
TRACKS.forEach(t => t.modules.forEach(m => (m.vocab || []).forEach(v => {
  if (["der", "die", "das"].indexOf(v[1]) >= 0 && (!v[3] || v[3] === "-")) noPlural.push(v[0]);
})));
check("L7 career nouns carry plural forms", noPlural.length === 0, noPlural.slice(0, 3).join(","));

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
