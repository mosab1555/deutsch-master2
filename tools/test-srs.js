/* Deutsch Master - SRS/confidence regression tests.
 * Proves against the REAL modules (progress.js DMProgress, script.js
 * bumpReview, play.js srsBump) in a stubbed-DOM vm context:
 *  1. single scheduling engine (play.js delegates to DMProgress.nextReview)
 *  2. fail schedules sooner than success; ease stays within [1.3, 2.8]
 *  3. flash confidence mapping: forgot/hard fail, good/easy pass,
 *     forgot penalizes ease harder, easy rewards ease
 *  4. legacy {e,due,laps} shape stays readable after unified writes
 *  5. both HTML shells expose exactly the 4 rating buttons with i18n keys
 *     present in ar/en/de dictionaries
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

  /* ---- 1. single engine: static proof + behavioral proof ---- */
  const playSrc = RD("client/play.js");
  ok("S1-single-engine", /DMProgress\s*&&\s*DMProgress\s*&&\s*typeof DMProgress\.nextReview/.test(playSrc) ||
    /DMProgress\.nextReview/.test(playSrc), "play.js delegates to DMProgress.nextReview");
  const r1 = js("DMProgress.nextReview({laps:0,ease:2.5,miss:0,ok:false})");
  const r2 = js("DMProgress.nextReview({laps:2,ease:2.5,miss:0,ok:true})");
  ok("S2-fail-sooner", r1.dueIn < r2.dueIn, "fail=" + r1.dueIn + " pass=" + r2.dueIn);
  const ef = js("(()=>{let e=2.5;for(let i=0;i<30;i++){e=DMProgress.nextReview({laps:0,ease:e,miss:9,ok:false}).ease;}return e;})()");
  const ep = js("(()=>{let e=2.5;for(let i=0;i<60;i++){e=DMProgress.nextReview({laps:5,ease:e,miss:0,ok:true}).ease;}return e;})()");
  ok("S3-ease-bounds", ef >= 1.3 && ep <= 2.8, "failFloor=" + ef + " passCap=" + ep);

  /* ---- 2. confidence mapping through the real bumpReview ---- */
  js("S.srs={}; S.review={}; S.mistakes={}; S.status={};");
  js("bumpReview('wF',false,-0.15); bumpReview('wH',false); bumpReview('wG',true); bumpReview('wE',true,0.15);");
  const states = js("JSON.stringify({F:S.srs.wF,H:S.srs.wH,G:S.srs.wG,E:S.srs.wE})");
  const P = JSON.parse(states);
  ok("S4-forgot-fails", P.F.laps === 0, "laps=" + P.F.laps);
  ok("S4-hard-fails", P.H.laps === 0, "laps=" + P.H.laps);
  ok("S4-good-passes", P.G.laps >= 1, "laps=" + P.G.laps);
  ok("S4-easy-passes", P.E.laps >= 1, "laps=" + P.E.laps);
  ok("S5-forgot-harsher-than-hard", P.F.ease < P.H.ease, "forgot=" + P.F.ease + " hard=" + P.H.ease);
  ok("S5-easy-kinder-than-good", P.E.ease > P.G.ease, "easy=" + P.E.ease + " good=" + P.G.ease);
  ok("S5-due-order", P.F.due <= P.H.due && P.H.due <= P.G.due && P.G.due <= P.E.due,
    [P.F.due, P.H.due, P.G.due, P.E.due].join(","));
  const st = js("JSON.stringify({F:S.status.wF,H:S.status.wH,G:S.status.wG,E:S.status.wE})");
  ok("S6-statuses", st === '{"F":"hard","H":"hard","G":"known","E":"known"}', st);

  /* ---- 3. unified srsBump keeps legacy shape readable ---- */
  js("S.srs={};");
  js("srsBump('wX',true); srsBump('wX',false);");
  const wx = js("JSON.stringify(S.srs.wX)");
  const W = JSON.parse(wx);
  ok("S7-legacy-shape", typeof W.e === "number" && typeof W.ease === "number" && typeof W.due === "string" && typeof W.laps === "number", wx);
  const tomorrow = js("DMProgress.todayKey(new Date(Date.now()+86400000))");
  ok("S7-fail-due-tomorrow", W.due === tomorrow && W.laps === 0, "due=" + W.due);

  /* ---- 4. shells expose exactly the 4 rating buttons ---- */
  for (const f of ["client/index.html", "client/academy.html"]) {
    const h = RD(f);
    const vals = [...h.matchAll(/data-flash-rate="([^"]+)"/g)].map(m => m[1]);
    ok(f + " four ratings", JSON.stringify(vals) === JSON.stringify(["forgot", "hard", "good", "easy"]), vals.join(","));
  }
  const dict = RD("client/study.js");
  for (const k of ["rate_forgot", "rate_hard", "rate_good", "rate_easy"]) {
    const n = (dict.match(new RegExp(k + ":", "g")) || []).length;
    ok("i18n " + k + " x3", n === 3, "n=" + n);
  }
  ok("i18n no stale rating keys", !/rate_mid/.test(dict), "rate_mid removed");

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}
main();
