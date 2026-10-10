/* Navigation-lag regression tests (static, no browser required).
 * Verifies the evidence-backed fixes from the deep-navigation investigation:
 *  N1. study.js showPage wrapper must NOT call applyLang() unconditionally on
 *      every navigation (it walks the whole document + rebuilds the hidden
 *      dashboard command center via home.js wa on every sidebar click).
 *      Language propagation happens only when uiLang changed since the last
 *      stamp (__dmAppliedLang, stamped inside applyLang itself).
 *  N2. sent-a1.js showPage wrapper must NOT render the sentence list twice on
 *      first visit (ensureSection via DM_LAZY already rendered it: 2x bank
 *      merge + 2x 80-card DOM build ≈200ms long task).
 *  N3. reference.js topic lookups must use a memoized index (refTopicIndex):
 *      the old refTopicById rescanned Object.keys(window)+all topics once per
 *      path per lookup (~4ms/lookup, ~40ms/home-paint, 3-5x on phones).
 *  N4. curriculum.js sentence-input wiring must stay quiet when sent-a1 owns
 *      the inputs (else 2x full render per keystroke).
 *  N5. afterMergeRefresh must defer the full renderAll while the document is
 *      hidden (background-tab jank), flushed once on return to foreground.
 * Usage: node tools/test-nav-fix.js (exit 0 = PASS, 1 = FAIL)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (e ? " :: " + e : "")); } }

const study = RD("client/study.js");
const sentA1 = RD("client/sent-a1.js");
const ref = RD("client/reference.js");
const curr = RD("client/curriculum.js");

// N1: no unconditional applyLang() directly after _sp(n) in the showPage wrapper
ok("nav:study-gated-languav",
  /__dmAppliedLang!==_nl/.test(study) && /__dmAppliedLang!==_tl/.test(study));
ok("nav:study-no-bare-applylang",
  !/showPage=function\(n\)\{\s*\n?\s*_sp\(n\);\s*\n?\s*try\{applyLang\(\);\}catch\(e\)\{\}/.test(study));
ok("nav:study-applied-stamp",
  /window\.__dmAppliedLang=\(typeof S!=="undefined"&&S&&S\.uiLang\)\|\|"ar"/.test(study));
ok("nav:study-dashboard-still-refreshes",
  /if\(n==="dashboard"\)\{renderStudyDash\(\);renderNotifBell\(\);applyLang\(\);/.test(study));
ok("nav:study-settings-still-refreshes",
  /if\(n==="settings"\)applyLang\(\);/.test(study));

// N2: sent-a1 wrapper skips the duplicate render when DM_LAZY already rendered
ok("nav:sent-single-render",
  /DM_LAZY\.sentences\s*===\s*sentA1Render/.test(sentA1));
ok("nav:sent-skipRender-kept",
  /DMPageState\s*&&\s*DMPageState\.skipRender\s*&&\s*DMPageState\.skipRender\("sentences"\)/.test(sentA1));

// N3: memoized reference index used by both lookup paths
ok("nav:ref-index-memo", /var _refTopicIdx=null/.test(ref) && /function refTopicIndex\(\)/.test(ref));
ok("nav:ref-pathTopics-uses-index", /function refPathTopics\(pid\)\{\s*\n?\s*try\{const idx=refTopicIndex\(\);if\(idx\.byPath\[pid\]\)return idx\.byPath\[pid\]\.slice\(\);\}catch\(e\)\{\}/.test(ref));
ok("nav:ref-topicById-uses-index", /function refTopicById\(id\)\{\s*\n?\s*try\{const idx=refTopicIndex\(\);if\(idx\.byId\[id\]\)return idx\.byId\[id\];\}catch\(e\)\{\}/.test(ref));
ok("nav:ref-index-first-match-order", /if\(tp&&tp\.id&&!byId\[tp\.id\]\)byId\[tp\.id\]=\{path:p,topic:tp\}/.test(ref));

// N4: curriculum sentence-input handlers yield to the unified renderer
ok("nav:curr-sent-guard-input",
  /\$\("sentenceSearch"\)[\s\S]{0,120}dataset\.sentA1/.test(curr));
ok("nav:curr-refresh-visible-only",
  /if\(active\)currApplySentFilter\(false\)/.test(curr.replace(/\s+/g, "")));
ok("nav:curr-refresh-no-hidden-branch",
  !/visited=!!\(window\.DMPageState/.test(curr));

// N5: hidden-tab merge gate + single foreground flush
ok("nav:merge-hidden-gate", /document\.hidden/.test(curr) && /window\.__dmMergeDirty=true/.test(curr));
ok("nav:merge-flush-once", /__dmMergeFlushWired/.test(curr) && /visibilitychange/.test(curr));
ok("nav:merge-flag-cleared", /window\.__dmMergeDirty=false/.test(curr));

// syntax sanity of every touched file
for (const f of ["client/study.js", "client/sent-a1.js", "client/reference.js", "client/curriculum.js"]) {
  try { require("vm").createScript(RD(f)); ok("syntax:" + f, true); }
  catch (e) { ok("syntax:" + f, false, String(e).slice(0, 140)); }
}

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
