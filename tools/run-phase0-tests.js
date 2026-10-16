/* Deutsch Master - Phase 0 deterministic test orchestrator (READ-ONLY).
 *
 * Runs the critical regression suites by EXPLICIT list (never globs tools/).
 * All suites are stdlib-only Node scripts: no npm install, no browser, no
 * network, no writes to production content, generated assets, or audit files.
 * The single exception is validate-sent-refs.js, which is forced to write its
 * report into the OS temp dir (never into the repo).
 *
 * Content-quality gate runs in DEFAULT mode: errors fail the run, the 1,913
 * documented warnings are preserved and never suppressed (no --strict).
 *
 * test-smart has one documented flaky tail (adaptive targeting, ~1/6 runs)
 * and e2e has a statistical shuffle-uniformity assertion that flakes rarely:
 * on FAIL either is rerun exactly once and the rerun is logged.
 *
 * Chrome-gated suites are intentionally NOT run here (they need a real
 * browser): test-auth-identity.js --cdp, test-auth-dom.js, runtime-qa.js,
 * test-pack-cache.js, test-labsx-dom.js, check-ref-dom.js,
 * test-langswitch-runtime.js, test-tc-selection-freeze.js,
 * test-testcenter-freeze.js, test-tts-voices.js, qa-simulator.js,
 * test-stability-fix.js. See docs/academy/PHASE0_IMPLEMENTATION_REPORT.md.
 *
 * Usage: node tools/run-phase0-tests.js   (exit 0 = all PASS, 1 = any FAIL)
 *        npm test  (alias)
 */
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const node = process.execPath;

const SUITES = [
  { id: "audit-curriculum", args: ["tools/audit-curriculum.js"] },
  { id: "smoke-curriculum", args: ["tools/smoke-curriculum.js"] },
  { id: "test-progress", args: ["tools/test-progress.js"] },
  { id: "test-upgrade", args: ["tools/test-upgrade.js"] },
  { id: "test-robustness", args: ["tools/test-robustness.js"] },
  { id: "check-links", args: ["tools/check-links.js"] },
  { id: "test-career", args: ["tools/test-career.js"] },
  { id: "test-sw-update", args: ["tools/test-sw-update.js"] },
  { id: "check-testplan", args: ["tools/check-testplan.js"] },
  { id: "test-howto", args: ["tools/test-howto.js"] },
  { id: "test-auth-identity(node)", args: ["tools/test-auth-identity.js"] },
  { id: "test-content-remediation", args: ["tools/test-content-remediation.js"] },
  // DEFAULT mode: errors fail, warnings preserved (never --strict).
  { id: "content-quality-gate", args: ["tools/content-quality-gate.js"] },
  { id: "test-assess", args: ["tools/test-assess.js"] },
  { id: "test-content-merge", args: ["tools/test-content-merge.js"] },
  { id: "test-manifest", args: ["tools/test-manifest.js"] },
  { id: "test-lazy-packs", args: ["tools/test-lazy-packs.js"] },
  { id: "test-full-load", args: ["tools/test-full-load.js"] },
  {
    id: "validate-sent-refs(sample500)",
    args: ["tools/validate-sent-refs.js", "--sample", "500", "--out",
      path.join(fs.mkdtempSync(path.join(os.tmpdir(), "dm-sentref-")), "sent-ref-report.json")],
  },
  { id: "check-www-parity", args: ["tools/check-www-parity.js"] },
  { id: "qa-audit", args: ["tools/qa-audit.js"] },
  { id: "test-smart", args: ["tools/test-smart.js"], rerunOnce: true },
  { id: "test-search", args: ["tools/test-search.js"] },
  { id: "test-quiz-shuffle", args: ["tools/test-quiz-shuffle.js"] },
  { id: "test-adv", args: ["tools/test-adv.js"] },
  { id: "test-push", args: ["tools/test-push.js"] },
  { id: "test-labsx", args: ["tools/test-labsx.js"] },
  { id: "test-flashdir", args: ["tools/test-flashdir.js"] },
  { id: "test-languages", args: ["tools/test-languages.js"] },
  { id: "check-translations", args: ["tools/check-translations.js"] },
  { id: "check-reference", args: ["tools/check-reference.js"] },
  { id: "check-ref-dups", args: ["tools/check-ref-dups.js"] },
  // Statistical assertion (chi-square over shuffle positions) flakes
  // occasionally; same rerun-once-and-log rule as test-smart.
  { id: "e2e", args: ["tools/e2e.js"], rerunOnce: true },
];

function runOne(suite) {
  const r = spawnSync(node, suite.args, { cwd: ROOT, encoding: "utf8", timeout: 600000 });
  const out = (r.stdout || "") + (r.stderr || "");
  // Print only the tail to keep logs readable; full detail stays per-suite.
  const lines = out.trim().split("\n");
  const tail = lines.slice(-8).join("\n");
  const code = r.status === null ? "TIMEOUT/SIGNAL" : r.status;
  console.log("### " + suite.id + " -> exit " + code);
  if (tail) console.log(tail);
  return r.status === 0;
}

const results = [];
for (const s of SUITES) {
  let okPass = runOne(s);
  if (!okPass && s.rerunOnce) {
    console.log("--- " + s.id + " FAILED once; documented flaky tail: rerunning exactly once ---");
    okPass = runOne({ id: s.id + " (rerun)", args: s.args });
    console.log("--- " + s.id + " rerun logged: " + (okPass ? "PASS" : "FAIL") + " ---");
  }
  results.push({ id: s.id, pass: okPass });
}

console.log("====");
const failed = results.filter(r => !r.pass);
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.id);
console.log("TOTAL suites=" + results.length + " failed=" + failed.length +
  " RESULT: " + (failed.length ? "FAIL" : "PASS"));
process.exit(failed.length ? 1 : 0);
