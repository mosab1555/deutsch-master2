/* Validates tests/test-cases.json: valid JSON, unique IDs, required fields,
   valid priorities/statuses/types, no duplicated scenarios, refs resolve.
   Run: node tools/check-testplan.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
let doc = null;
try {
  doc = JSON.parse(fs.readFileSync(path.join(root, "tests", "test-cases.json"), "utf8"));
  check("P0 valid JSON", true);
} catch (e) { check("P0 valid JSON", false, e.message); }
if (doc) {
  const cases = doc.cases || [];
  check("P1 cases non-empty", cases.length >= 50, "n=" + cases.length);
  const ids = cases.map(c => c.id);
  check("P2 unique test IDs", new Set(ids).size === ids.length,
    ids.filter((x, i) => ids.indexOf(x) !== i).join(","));
  check("P3 ID format PREFIX-nnn", cases.every(c => /^[A-Z0-9]+-[0-9]{3}$/.test(c.id || "")),
    cases.filter(c => !/^[A-Z0-9]+-[0-9]{3}$/.test(c.id || "")).map(c => c.id).join(","));
  const REQ = ["id", "module", "feature", "requirement", "priority", "preconditions", "data", "steps", "expected", "postconditions", "dependencies", "type", "automation", "status"];
  const missing = [];
  cases.forEach(c => REQ.forEach(k => { if (c[k] === undefined) missing.push(c.id + ":" + k); }));
  check("P4 required fields present", missing.length === 0, missing.slice(0, 5).join(";"));
  check("P5 valid priorities", cases.every(c => ["P0", "P1", "P2", "P3"].includes(c.priority)));
  check("P6 valid statuses", cases.every(c => (doc.meta.statuses || []).includes(c.status)));
  check("P7 non-empty steps+expected", cases.every(c => Array.isArray(c.steps) && c.steps.length > 0 && String(c.expected).length > 5),
    cases.filter(c => !(Array.isArray(c.steps) && c.steps.length)).map(c => c.id).join(","));
  const sig = c => (c.module + "|" + c.feature + "|" + c.steps.join(">")).toLowerCase();
  const sigs = cases.map(sig);
  check("P8 no duplicated scenarios", new Set(sigs).size === sigs.length);
  const idSet = new Set(ids);
  const badDeps = [];
  cases.forEach(c => (c.dependencies || []).forEach(d => { if (!idSet.has(d)) badDeps.push(c.id + "->" + d); }));
  check("P9 dependency refs resolve", badDeps.length === 0, badDeps.join(","));
  const autoTools = [];
  cases.forEach(c => {
    const m = String(c.automation || "").match(/automated:(tools\/[a-z0-9-]+\.js)/);
    if (m) autoTools.push({ id: c.id, tool: m[1] });
  });
  const missingTools = [...new Set(autoTools.map(t => t.tool))].filter(t => !fs.existsSync(path.join(root, t)));
  check("P10 automation tool refs exist", missingTools.length === 0, missingTools.join(","));
  const famCount = {};
  ids.forEach(id => { const f = id.split("-")[0]; famCount[f] = (famCount[f] || 0) + 1; });
  const fams = Object.keys(famCount);
  check("P11 coverage families >= 15", fams.length >= 15, fams.length + ": " + fams.join(","));
  const passCases = cases.filter(c => c.status === "PASS");
  const unproven = passCases.filter(c => !/automated:/.test(String(c.automation || "")));
  check("P12 no false PASS (PASS requires automation ref)", unproven.length === 0, unproven.map(c => c.id).join(","));
}
console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
