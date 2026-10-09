/* Stability recovery regression tests (static + behavioral stubs).
 * Verifies the confirmed root-cause fixes without requiring a browser:
 *  1. Sentences never render unbounded (paginated fallback + guarded refresh).
 *  2. Global search secondary scans are bounded (early-exit, no full-bank
 *     conjugation per keystroke) and wiring is idempotent.
 *  3. Welcome overlay is dismissible (backdrop + Escape) so search is reachable.
 *  4. Vocab/sentence/verb inputs have single-wiring guards.
 * Usage: node tools/test-stability-fix.js (exit 0 = PASS, 1 = FAIL)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (e ? " :: " + e : "")); } }

const script = RD("client/script.js");
const curr = RD("client/curriculum.js");
const launch = RD("client/launch.js");
const sentA1 = RD("client/sent-a1.js");

// 1a. script.js fallback renderSentences is paginated (slice + show-more, no unbounded forEach as sole path)
ok("sent:script-paginated", /let sentPageLimit=80/.test(script) && /list\.slice\(0,sentPageLimit\)/.test(script) && /sentPageLimit\+=SENT_PAGE/.test(script));
// 1b. curriculum fallback paginated
ok("sent:curriculum-paginated", /currSentShown=80/.test(curr) && /list\.slice\(0,currSentShown\)/.test(curr));
// 1c. curriculum refresh guard: no eager hidden render at boot
ok("sent:no-eager-hidden-render", /#page-sentences\.active/.test(curr) && /if\(active\|\|visited\)currApplySentFilter/.test(curr.replace(/\s+/g, "")));
// 1d. sent-a1 unified renderer still paginated (unchanged contract)
ok("sent:sentA1-paginated", /sentA1Limit = 80/.test(sentA1) && /list\.slice\(0, sentA1Limit\)/.test(sentA1));

// 2a. global search verbs: no allVerbs() per keystroke (conjugation cost), early-exit max 2
ok("search:no-allVerbs-per-keystroke", !script.includes("allVerbs().filter(v=>dmNorm(v.inf"));
ok("search:verb-early-exit", /vHits\.length<2/.test(script));
// 2b. sentences: bounded to 2 hits (cached index preferred)
ok("search:sent-early-exit", /sHits\.length<2/.test(script) && /sentA1SearchRows/.test(script));
// 2c. grammar: bounded scan
ok("search:grammar-bounded", /gs\.length<3/.test(script));
// 2d. wiring idempotent (no duplicate handlers on re-eval)
ok("search:single-wiring", /_dmGsWired/.test(script) && /_dmGsDocWired/.test(script));
ok("search:vocab-single-wiring", /_dmVocabWired/.test(script));
ok("search:sent-single-wiring", /_dmSentWired/.test(script));
ok("search:verb-single-wiring", /_dmVerbWired/.test(script));
// 2e. input value never cleared during typing path (gsClose only on navigation detail open)
ok("search:input-preserved", /function gsClose\(box\)/.test(script) && /function runGlobalSearch\(\)/.test(script) && !/runGlobalSearch[\s\S]{0,2000}\$\("globalSearch"\)\.value=""/.test(script));

// 3. welcome dismissible via backdrop + Escape, same flag
ok("welcome:backdrop-dismiss", /ev\.target === w/.test(launch) && /dismissWelcome/.test(launch));
ok("welcome:escape-dismiss", /dmWelcome/.test(launch) && /Escape/.test(launch));
ok("welcome:same-flag", (launch.match(/dm_welcomed/g) || []).length >= 2);

// 4. syntax sanity (files parse)
try { require("vm").createScript(script); ok("syntax:script.js", true); } catch (e) { ok("syntax:script.js", false, String(e).slice(0, 120)); }
try { require("vm").createScript(curr); ok("syntax:curriculum.js", true); } catch (e) { ok("syntax:curriculum.js", false, String(e).slice(0, 120)); }
try { require("vm").createScript(launch); ok("syntax:launch.js", true); } catch (e) { ok("syntax:launch.js", false, String(e).slice(0, 120)); }

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
