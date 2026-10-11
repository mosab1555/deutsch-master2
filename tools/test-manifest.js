/* Deutsch Master - curriculum manifest validator.
 * Checks client/content/curriculum-manifest.json: valid JSON, 4 levels,
 * chapters with measured coverage, B2 source verification note, gap/backlog honesty.
 * Exit 0 = PASS, 1 = FAIL. Usage: node tools/test-manifest.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }
const fp = path.join(root, "client", "content", "curriculum-manifest.json");
ok("M1 manifest exists", fs.existsSync(fp));
let m = null;
try { m = JSON.parse(fs.readFileSync(fp, "utf8")); ok("M2 manifest valid JSON", true); }
catch (e) { ok("M2 manifest valid JSON", false, e.message); }
if (!m) { console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: FAIL"); process.exit(1); }
const lvls = (m.levels || []).map(l => l.level);
ok("M3 four levels A1/A2/B1/B2", ["A1", "A2", "B1", "B2"].every(l => lvls.includes(l)), lvls.join(","));
const allCh = [];
(m.levels || []).forEach(l => (l.chapters || []).forEach(c => allCh.push(c)));
ok("M4 chapters carry objectives + status + provenance", allCh.length >= 15 && allCh.every(c => c.id && c.objectives && c.objectives.length && c.status && c.provenance),
  "chapters=" + allCh.length);
["K15", "K16", "K17"].forEach(k => {
  const c = allCh.find(x => x.id === k);
  ok("M5 " + k + " present with curr coverage", !!c && c.contentTypes && c.contentTypes.vocab.curr >= 40 && c.contentTypes.sentences.curr >= 10 && c.contentTypes.grammar.curr >= 4,
    c ? JSON.stringify({ w: c.contentTypes.vocab.curr, s: c.contentTypes.sentences.curr, g: c.contentTypes.grammar.curr }) : "missing");
});
ok("M6 B2 source verification (no invented Netzwerk-B2)", typeof m.b2SourceVerification === "string" && m.b2SourceVerification.includes("Aspekte") && /kein|no|ends at B1/i.test(m.b2SourceVerification), (m.b2SourceVerification || "").slice(0, 80));
ok("M7 measured totals present (library + overlays)", !!m.measuredTotals && !!m.measuredTotals.library && !!m.measuredTotals.currOverlays,
  "vocab=" + (((m.measuredTotals || {}).library || {}).vocab || {}).total);
ok("M8 gaps + backlog recorded (no false-complete claim)", Array.isArray(m.gaps) && m.gaps.length >= 3 && Array.isArray(m.backlog) && m.backlog.length >= 3,
  "gaps=" + (m.gaps || []).length + " backlog=" + (m.backlog || []).length);
ok("M9 copyright boundary declared", typeof m.copyright === "string" && /ORIGINAL/i.test(m.copyright));
ok("M10 sources reference official publisher URLs", Array.isArray(m.sources) && m.sources.some(s => /klett-sprachen\.de\/netzwerk-neu/.test(s.url || "")) && m.sources.some(s => /aspekte/i.test(s.title || "")),
  "sources=" + (m.sources || []).length);
console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
