/* Deutsch Master - Flashcards restoration regression tests.
 * Proves against the REAL modules in a stubbed-DOM vm context that the normal
 * Flashcards experience is back to its pre-Anki state (b4af954 behavior) and
 * that NO Anki machinery leaks into normal flows:
 *  1. play.js delegates scheduling to DMProgress.nextReview (single engine)
 *  2. fail schedules sooner than success; ease stays within [1.3, 2.8]
 *  3. bumpReview is the original 2-state (ok true/false) behavior
 *  4. legacy {e,due,laps} shape stays readable after unified writes
 *  5. both HTML shells expose ONLY the original 3 flash ratings
 *     (known/review/hard) and no SRS deck panel on the Flashcards page
 *  6. script.js normal flows never call the Anki scheduler (srsGrade) and
 *     carry no review-rating (data-rv-rate) or queue (buildReviewQueue) code
 *  7. i18n: rate_easy/rate_mid/rate_hard + Anki rate_forgot/rate_good each x3,
 *     no srs_* keys, no stray CJK
 * Usage: node tools/test-srs.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");

let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

function makeLS() {
  const m = new Map();
  return { getItem: k => (m.has(String(k)) ? m.get(String(k)) : null), setItem: (k, v) => { m.set(String(k), String(v)); }, removeItem: k => { m.delete(String(k)); } };
}
function mkEl() {
  return {
    _v: "", _h: "", _t: "",
    get value() { return this._v; }, set value(v) { this._v = String(v); },
    get innerHTML() { return this._h; }, set innerHTML(v) { this._h = String(v); },
    get textContent() { return this._t; }, set textContent(v) { this._t = String(v); },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {}, dataset: {}, firstChild: null, options: [],
    addEventListener() {}, removeEventListener() {}, appendChild(c) { return c; },
    insertBefore(c) { return c; }, remove() {}, click() {}, focus() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    getAttribute() { return null; }, setAttribute() {}, removeAttribute() {},
  };
}
function boot() {
  const sb = {
    console: { log() {}, error() {}, warn() {} },
    localStorage: makeLS(),
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0,
    location: { search: "", hash: "", pathname: "/" }, history: { replaceState() {} },
    document: {
      readyState: "complete", getElementById: () => mkEl(), querySelector: () => null,
      querySelectorAll: () => [], addEventListener: () => {}, createElement: () => mkEl(),
      documentElement: { setAttribute() {}, style: { setProperty() {}, removeProperty() {} } }, body: {},
    },
  };
  sb.window = sb; sb.globalThis = sb;
  sb.navigator = { onLine: true, userAgent: "node-test" };
  sb.window.addEventListener = () => {};
  sb.window.AuthModule = { getClient: () => null, getUser: () => null };
  sb.window.CloudSync = { init() {}, setActiveUser() {}, stopAutoSync() {}, refreshPendingCount() { return 0; } };
  sb.window.ProfileModule = { clearCache() {}, initProfilePage() {}, getProfile: async () => null };
  vm.createContext(sb);
  vm.runInContext(RD("client/script.js"), sb, { filename: "script.js" });
  vm.runInContext(RD("client/progress.js"), sb, { filename: "progress.js" });
  vm.runInContext("window.DMProgress = DMProgress;", sb);
  vm.runInContext(RD("client/play.js"), sb, { filename: "play.js" });
  vm.runInContext("window.save = save;", sb);
  return { sb, js: e => vm.runInContext(e, sb) };
}

function main() {
  const { js } = boot();

  /* ---- 1. single normal engine: static proof + behavioral proof ---- */
  const playSrc = RD("client/play.js");
  ok("S1-single-engine", /DMProgress\.nextReview/.test(playSrc), "play.js delegates to DMProgress.nextReview");
  const r1 = js("DMProgress.nextReview({laps:0,ease:2.5,miss:0,ok:false})");
  const r2 = js("DMProgress.nextReview({laps:2,ease:2.5,miss:0,ok:true})");
  ok("S2-fail-sooner", r1.dueIn < r2.dueIn, "fail=" + r1.dueIn + " pass=" + r2.dueIn);
  const ef = js("(()=>{let e=2.5;for(let i=0;i<30;i++){e=DMProgress.nextReview({laps:0,ease:e,miss:9,ok:false}).ease;}return e;})()");
  const ep = js("(()=>{let e=2.5;for(let i=0;i<60;i++){e=DMProgress.nextReview({laps:5,ease:e,miss:0,ok:true}).ease;}return e;})()");
  ok("S3-ease-bounds", ef >= 1.3 && ep <= 2.8, "failFloor=" + ef + " passCap=" + ep);

  /* ---- 2. original 2-state bumpReview through the real function ---- */
  js("S.srs={}; S.review={}; S.mistakes={}; S.status={};");
  ok("S4-fn-arity", js("bumpReview.length") === 2, "arity=" + js("bumpReview.length"));
  js("bumpReview('wK',true); bumpReview('wH',false);");
  const st = js("JSON.stringify({K:S.status.wK,H:S.status.wH})");
  ok("S4-statuses", st === '{"K":"known","H":"hard"}', st);
  ok("S4-review-counts", js("S.review.wK.c===1 && S.review.wH.w===1"), "counts");

  /* ---- 3. unified srsBump keeps legacy shape readable ---- */
  js("S.srs={};");
  js("srsBump('wX',true); srsBump('wX',false);");
  const wx = js("JSON.stringify(S.srs.wX)");
  const W = JSON.parse(wx);
  ok("S5-legacy-shape", typeof W.e === "number" && typeof W.ease === "number" && typeof W.due === "string" && typeof W.laps === "number", wx);
  const tomorrow = js("DMProgress.todayKey(new Date(Date.now()+86400000))");
  ok("S5-fail-due-tomorrow", W.due === tomorrow && W.laps === 0, "due=" + W.due);

  /* ---- 4. Anki scheduler still exists for the AnkiDroid section only ---- */
  ok("S6-srsGrade-present", js("typeof DMProgress.srsGrade")==="function" && js("typeof DMProgress.srsCard")==="function" && js("typeof DMProgress.srsIsDue")==="function", "DMProgress keeps srsGrade/srsCard/srsIsDue");

  /* ---- 5. shells: flashcards 3-state only, no SRS panel, AnkiDroid separate ---- */
  for (const f of ["client/index.html", "client/academy.html"]) {
    const h = RD(f);
    const flashSeg = h.slice(h.indexOf("page-flashcards"), h.indexOf("page-ankidroid"));
    const vals = [...flashSeg.matchAll(/data-flash-rate="([^"]+)"/g)].map(m => m[1]);
    ok(f + " flashcards 3-state", JSON.stringify(vals) === JSON.stringify(["known", "review", "hard"]), vals.join(","));
    ok(f + " no srsPanel", !/srsPanel|id="flashDeck"|id="flashMode"|id="flashCount"|srsNewPerDay|srsMaxReview|srsCounts/.test(flashSeg), "panel leaked");
    ok(f + " no Anki ratings in flashcards", !/forgot|data-rv-rate/.test(flashSeg), "anki leaked");
    ok(f + " has AnkiDroid page", h.includes('id="page-ankidroid"') && h.includes('id="ankiRoot"'), "missing mount");
    ok(f + " nav distinguishes", /data-page="flashcards"[\s\S]*?فلاش كارد/.test(h) && /data-page="ankidroid"[\s\S]*?AnkiDroid/.test(h), "nav");
  }

  /* ---- 6. normal flows never touch the Anki scheduler ---- */
  const sc = RD("client/script.js");
  ok("S7-no-srsGrade-in-script", !/srsGrade|srsCard|srsIsDue|buildReviewQueue|data-rv-rate|__rvAdvance/.test(sc), "anki scheduler in normal flows");
  const fh = sc.slice(sc.indexOf('document.querySelectorAll("[data-flash-rate]")'), sc.indexOf("/* ============ SENTENCES"));
  ok("S7-flash-handler-3state", /r==="known"/.test(fh) && /r==="hard"/.test(fh) && !/forgot|good|easy/.test(fh), fh.slice(0, 120));

  /* ---- 7. i18n separation ---- */
  const dict = RD("client/study.js");
  for (const k of ["rate_forgot", "rate_hard", "rate_good", "rate_easy", "rate_mid"]) {
    const n = (dict.match(new RegExp(k + ':"', "g")) || []).length;
    ok("i18n " + k + " x3", n === 3, "n=" + n);
  }
  ok("i18n no srs keys", !/srs_deck:|srs_mode:|srs_count:|srs_adv:|srs_newperday:|srs_maxreview:/.test(dict), "dead srs keys");
  ok("i18n no CJK", !/[一-鿿]/.test(dict), "stray CJK");
  for (const k of ["title_ankidroid", "anki_study", "anki_add", "anki_browse", "anki_stats", "anki_show_answer"]) {
    const n = (dict.match(new RegExp(k + ':"', "g")) || []).length;
    ok("i18n " + k + " x3", n === 3, "n=" + n);
  }

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}
main();
