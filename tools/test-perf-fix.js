/* Perf-fix regression tests (static, no browser required).
 * Verifies the measured root-cause fixes from the lag/freeze/search task:
 *  1. Grammar renders paginated (998 rules rendered unbounded = 22k nodes,
 *     ~1.4s main-thread freeze, mobile OOM kills).
 *  2. Verbs render paginated (conjugation-table DOM bounded per keystroke).
 *  3. Word-bank views cached (no 22k concat / re-conjugation per keystroke).
 *  4. Global search scans use cached rows; level prefetch is quiet + once
 *     per level (no toast spam / ensure pile-up while typing).
 *  5. Merges warm the search index while idle (no mega-build mid-typing).
 * Usage: node tools/test-perf-fix.js (exit 0 = PASS, 1 = FAIL)
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

// 1. grammar paginated: page const + slice + show-more + single batched insert + wiring guard
ok("gram:paginated", /let gramPageLimit=60/.test(script) && /const GRAM_PAGE=60/.test(script));
ok("gram:slice", /list\.slice\(0,gramPageLimit\)/.test(script) && /gramPageLimit\+=GRAM_PAGE/.test(script));
ok("gram:fragment", /gfrag\.appendChild\(d\)/.test(script));
ok("gram:single-wiring", /_dmGramWired/.test(script));
// no unbounded full-bank grammar render remains as the sole path
ok("gram:no-unbounded", !/list\.forEach\(\(g,gi\)=>\{\s*\n\s*const d=document\.createElement\("div"\);d\.className="grammar-card glass";[\s\S]{0,400}box\.appendChild\(d\)/.test(script));

// 2. verbs paginated + cached source
ok("verb:paginated", /let verbPageLimit=60/.test(script) && /const VERB_PAGE=60/.test(script));
ok("verb:slice", /list\.slice\(0,verbPageLimit\)/.test(script) && /verbPageLimit\+=VERB_PAGE/.test(script));
ok("verb:cached-source", /scored=dmVerbs\(\)\.filter/.test(script.replace(/\s+/g, "")));

// 3. cached bank views
ok("cache:dmWords", /function dmWords\(\)/.test(script) && /_dmWordsCacheN===n&&_dmWordsCacheC===c/.test(script.replace(/\s+/g, "")));
ok("cache:dmVerbs", /function dmVerbs\(\)/.test(script) && /_dmVerbCacheN===n/.test(script.replace(/\s+/g, "")));
ok("cache:verb-rows", /function dmVerbRows\(\)/.test(script) && /_dmVerbRowsN/.test(script));
ok("cache:gram-rows", /function dmGramRows\(\)/.test(script) && /_dmGramRowsN/.test(script));
ok("cache:dmWordHits-uses-cache", /words=dmWords\(\)/.test(script.replace(/\s+/g, "")));

// 4. global search: cached scans + quiet once-per-level prefetch
ok("search:verb-rows-used", /_vr=dmVerbRows\(\)/.test(script.replace(/\s+/g, "")));
ok("search:gram-rows-used", /_gr=dmGramRows\(\)/.test(script.replace(/\s+/g, "")));
ok("search:no-per-item-dmNorm-verbs", !/if\(dmNorm\(\(_w\.de/.test(script));
ok("search:quiet-prefetch", /_dmGsBgPull/.test(script) && /if\(window\._dmGsBgPull\[L\]\)return/.test(script.replace(/\s+/g, "")));
ok("search:prefetch-retry-reset", /_dmGsBgPull\[L\]=0/.test(script.replace(/\s+/g, "")));

// 5. idle index warm after merges
ok("merge:idle-warm", /requestIdleCallback\(_warm/.test(curr) && /dmWordHits\("der","mixed"\)/.test(curr) && /sentA1SearchRows\(\)/.test(curr));

// 6. syntax sanity
try { require("vm").createScript(script); ok("syntax:script.js", true); } catch (e) { ok("syntax:script.js", false, String(e).slice(0, 120)); }
try { require("vm").createScript(curr); ok("syntax:curriculum.js", true); } catch (e) { ok("syntax:curriculum.js", false, String(e).slice(0, 120)); }

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
