/* Merge version-awareness regression tests (static, no browser required).
 * Verifies the dataset-version-aware rendering design:
 *  M1. DMDataRev domain tracker exists + mergeDataset bumps only domains it
 *      grew (length-compare) + bounded merge diary + afterMergeRefresh hook.
 *  M2. afterMergeRefresh performs a SCOPED visible-section refresh (no
 *      blanket renderAll); hidden-tab deferral kept with foreground flush.
 *  M3. currRefreshHooks refreshes sentences only when visible (hidden lists
 *      defer to the revision-checked revisit).
 *  M4. script.js deferred core: dep map, snap/stamp/stale, section refresh
 *      (visit+merge), visible-after-merge, showPage hook, render counters.
 *  M5. Every merge-dependent renderer stamps its section (both empty and
 *      full paths); custom-word add bumps revisions.
 *  M6. Stale-async guards: ensure() page-render callbacks run only when
 *      their target page is still active (sentences x3, quiz x2, flashcards).
 *  M7. renderAll itself unchanged (all data-action callers keep full
 *      refresh); quiz/anki/reference/howto correctly need no revision map.
 * Usage: node tools/test-merge-fix.js (exit 0 = PASS, 1 = FAIL)
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
const sentA1 = RD("client/sent-a1.js");
const assess = RD("client/assess.js");
const tc = RD("client/testcenter.js");

// M1: revision tracker + exact per-domain bumps + bounded diary
ok("merge:rev-store", /window\.DMDataRev=window\.DMDataRev\|\|\{vocab:0,sentences:0,grammar:0,explain:0,filters:0,reading:0\}/.test(curr));
ok("merge:rev-bump-vocab", /if\(VOCAB\.length!==_lens\.v\)dmBumpRev\("vocab"\)/.test(curr));
ok("merge:rev-bump-sentences", /if\(SENTENCES\.length!==_lens\.s\)dmBumpRev\("sentences"\)/.test(curr));
ok("merge:rev-bump-grammar", /if\(GRAMMAR\.length!==_lens\.g\)dmBumpRev\("grammar"\)/.test(curr));
ok("merge:rev-bump-explain", /EXPLAIN_ORDER\.length!==_lens\.e\)dmBumpRev\("explain"\)/.test(curr));
ok("merge:rev-bump-filters", /KAPITEL\.length!==_lens\.k\|\|CATEGORIES\.length!==_lens\.c\)dmBumpRev\("filters"\)/.test(curr));
ok("merge:diary-bounded", /window\.__dmMergeLog=window\.__dmMergeLog\|\|\[\]/.test(curr) && /while\(window\.__dmMergeLog\.length>30\)window\.__dmMergeLog\.shift\(\)/.test(curr));
ok("merge:diary-merge-entry", /dmLogMerge\(\{t:Date\.now\(\),pt:_pt,key:String\(key\),added:added,ms:_mms\}\)/.test(curr));
ok("merge:amr-exposed", /window\.afterMergeRefresh=afterMergeRefresh;/.test(curr));

// M2: scoped refresh, no blanket renderAll in the merge path
ok("merge:no-renderAll-in-amr", !/function afterMergeRefresh\(\)\{[\s\S]{0,2200}\brenderAll\(\)/.test(curr));
ok("merge:scoped-visible", /dmRefreshVisibleAfterMerge/.test(curr));
ok("merge:hidden-defer-kept", /document\.hidden/.test(curr) && /window\.__dmMergeDirty=true/.test(curr));
ok("merge:flush-once", /__dmMergeFlushWired/.test(curr));
ok("merge:flash-incremental-kept", /typeof refreshFlashList==="function"\)refreshFlashList\(\)/.test(curr));
ok("merge:index-warm-kept", /requestIdleCallback\(_warm/.test(curr));

// M3: sentences refresh visible-only
ok("merge:hooks-visible-only", /if\(active\)currApplySentFilter\(false\)/.test(curr));
ok("merge:hooks-no-visited-branch", !/visited=!!\(window\.DMPageState&&window\.DMPageState\.mem&&window\.DMPageState\.mem\.sentences\)/.test(curr));

// M4: deferred core in script.js
ok("defer:dep-map", /DM_MERGE_DEPS=\{vocab:\["vocab","filters"\],sentences:\["sentences"\],verbs:\["vocab"\],grammar:\["grammar"\],explain:\["explain","grammar"\],dashboard:\["vocab"\],review:\["vocab"\],stats:\["vocab"\]\}/.test(script));
ok("defer:stale-fn", /function dmSectionStale\(sec\)/.test(script));
ok("defer:refresh-fn", /function dmRefreshSectionIfStale\(n,why\)/.test(script));
ok("defer:visible-fn", /function dmRefreshVisibleAfterMerge\(\)/.test(script));
ok("defer:showpage-hook", /dmRefreshSectionIfStale\(name,"visit"\)/.test(script));
ok("defer:counters", /window\.__dmRenderStat=window\.__dmRenderStat\|\|\{full:0,scoped:0\}/.test(script) && /window\.__dmRenderStat\.full\+\+/.test(script));
// unmapped sections correctly absent (no merge dependency by design)
ok("defer:unmapped-excluded", !/DM_MERGE_DEPS=\{[^}]*\b(quiz|anki|reference|howto|streak)\b/.test(script));

// M5: stamps in every dependent renderer (full + empty paths)
for (const [sec, fn] of [["vocab", "renderVocab"], ["sentences", "renderSentences"], ["verbs", "renderVerbs"], ["grammar", "renderGrammar"], ["explain", "renderExplainIndex"], ["dashboard", "renderDashboard"], ["review", "renderReview"], ["stats", "renderStats"]]) {
  ok("defer:stamp-" + sec, new RegExp('dmStampRev\\("' + sec + '"\\)').test(script));
}
ok("defer:stamp-sent-unified", /dmStampRev\("sentences"\)/.test(sentA1));
ok("defer:customword-bump", /S\.customWords\.push\(w\);save\(\);\s*\n?\s*try\{if\(window\.DMDataRev\)\{window\.DMDataRev\.vocab\+\+;window\.DMDataRev\.sentences\+\+;\}\}catch\(e\)\{\}/.test(script));

// M6: stale-async page guards
ok("async:sent-level-guard", /Curriculum\.ensure\(lv, function \(\) \{ sentA1Render\(\); \}\)/.test(sentA1) === false && /#page-sentences\.active/.test(sentA1));
ok("async:curr-fallback-guards", (curr.match(/#page-sentences\.active/g) || []).length >= 3);
ok("async:quiz-guards", /#page-quiz\.active/.test(assess) && /#page-quiz\.active/.test(tc));
ok("async:flash-guard", /#page-flashcards\.active/.test(script));

// M7: renderAll unchanged (still the full refresh for data actions)
ok("merge:renderAll-intact", /function renderAll\(\)\{\s*\n?\s*try\{if\(window\.__dmRenderStat\)window\.__dmRenderStat\.full\+\+;\}catch\(e\)\{\}\s*\n?\s*safeRender\(renderStreak\);safeRender\(renderDashboard\);safeRender\(renderReview\);safeRender\(renderMistakes\);safeRender\(renderQuizHistory\);safeRender\(renderStats\);safeRender\(renderPlanner\);safeRender\(renderFavs\);/.test(script));

// syntax sanity
for (const f of ["client/script.js", "client/curriculum.js", "client/sent-a1.js", "client/assess.js", "client/testcenter.js"]) {
  try { require("vm").createScript(RD(f)); ok("syntax:" + f, true); }
  catch (e) { ok("syntax:" + f, false, String(e).slice(0, 140)); }
}

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
