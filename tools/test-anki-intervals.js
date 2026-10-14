/* Deutsch Master - AnkiDroid fixed-interval scheduling tests.
 * Proves the exact requested review intervals against the REAL modules
 * (ankidroid.js gradeCard/previewInterval + DMProgress.todayKey convention):
 *   Again -> 10 minutes, Hard -> 1 day, Good -> 3 days, Easy -> 7 days.
 * Covers: exact due dates, repeated reviews, existing cards with prior
 * ease/iv/laps, persistence across reload (DMIdentity.activate), sync-merge
 * survival, and date-boundary handling via todayKey.
 * Usage: node tools/test-anki-intervals.js (exit 0 = PASS, 1 = FAIL)
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
  try { sb.URL = URL; sb.Blob = Blob; } catch (e) {}
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
  vm.runInContext(RD("client/ankidroid.js"), sb, { filename: "ankidroid.js" });
  vm.runInContext(RD("client/cloud-sync.js"), sb, { filename: "cloud-sync.js" });
  return { sb, js: e => vm.runInContext(e, sb) };
}

const SCEN = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const NOW = Date.UTC(2026, 4, 15, 12, 0, 0); // 2026-05-15 12:00 UTC, fixed
  const tk = (ms) => window.DMProgress.todayKey(new Date(ms));
  const d = A.createDeck(SA, "Intervals", null);
  const mk = (front) => {
    const r = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: front, Back: "x" }, tags: "" });
    return r.cards[0];
  };
  // 1-4: exact intervals from a fresh new card
  const cA = mk("c-again");
  A.gradeCard(SA, cA, "again", NOW);
  out.againDueMin = SA.cards[cA].sched.dueMin - NOW;
  out.againDue = SA.cards[cA].sched.due;
  out.againDueExpect = tk(NOW);
  out.againIv = SA.cards[cA].sched.iv;
  const cH = mk("c-hard");
  A.gradeCard(SA, cH, "hard", NOW);
  out.hardDue = SA.cards[cH].sched.due;
  out.hardExpect = tk(NOW + 1 * 86400000);
  out.hardIv = SA.cards[cH].sched.iv;
  out.hardDueMin = SA.cards[cH].sched.dueMin;
  const cG = mk("c-good");
  A.gradeCard(SA, cG, "good", NOW);
  out.goodDue = SA.cards[cG].sched.due;
  out.goodExpect = tk(NOW + 3 * 86400000);
  out.goodIv = SA.cards[cG].sched.iv;
  out.goodDueMin = SA.cards[cG].sched.dueMin;
  const cE = mk("c-easy");
  A.gradeCard(SA, cE, "easy", NOW);
  out.easyDue = SA.cards[cE].sched.due;
  out.easyExpect = tk(NOW + 7 * 86400000);
  out.easyIv = SA.cards[cE].sched.iv;
  out.easyDueMin = SA.cards[cE].sched.dueMin;
  // 5: repeated reviews + existing cards with prior ease/iv/laps still exact
  const cR = mk("c-repeat");
  SA.cards[cR].sched = { st: "review", step: 0, iv: 30, laps: 10, ease: 2.8, e: 2.8, due: "2020-01-01", dueMin: 0, last: null, miss: 0, reps: 20 };
  A.gradeCard(SA, cR, "hard", NOW);
  out.repeatHardDue = SA.cards[cR].sched.due;
  out.repeatHardIv = SA.cards[cR].sched.iv;
  A.gradeCard(SA, cR, "good", NOW);
  out.repeatGoodDue = SA.cards[cR].sched.due;
  out.repeatGoodIv = SA.cards[cR].sched.iv;
  A.gradeCard(SA, cR, "easy", NOW);
  out.repeatEasyDue = SA.cards[cR].sched.due;
  out.repeatEasyIv = SA.cards[cR].sched.iv;
  A.gradeCard(SA, cR, "again", NOW);
  out.repeatAgainGap = SA.cards[cR].sched.dueMin - NOW;
  // low-ease existing card must still get exact intervals (ease must not shrink them)
  const cL = mk("c-lowease");
  SA.cards[cL].sched = { st: "review", step: 0, iv: 1, laps: 1, ease: 1.3, e: 1.3, due: "2020-01-01", dueMin: 0, last: null, miss: 0, reps: 1 };
  A.gradeCard(SA, cL, "good", NOW);
  out.lowEaseGoodDue = SA.cards[cL].sched.due;
  out.lowEaseGoodIv = SA.cards[cL].sched.iv;
  // 6: persistence across reload (grade + logGrade commits, then re-activate)
  const cP = mk("c-persist-good");
  A.gradeCard(SA, cP, "good", NOW);
  A.logGrade(SA, cP, "good", { st: "new", step: 0, iv: 0, laps: 0, ease: 2.5, e: 2.5, due: tk(NOW), dueMin: 0, last: null, miss: 0, reps: 0 }, SA.cards[cP].sched);
  const wantDue = SA.cards[cP].sched.due;
  const wantIv = SA.cards[cP].sched.iv;
  try { window.DMIdentity.snapshot(); } catch (e) {}
  window.DMIdentity.activate(null);
  const SA2 = A.store();
  out.persistDue = SA2.cards[cP] ? SA2.cards[cP].sched.due : null;
  out.persistIv = SA2.cards[cP] ? SA2.cards[cP].sched.iv : null;
  out.persistWantDue = wantDue;
  out.persistWantIv = wantIv;
  // sync merge (stale empty cloud) must keep the persisted due date
  const CS = window.CloudSync;
  const m = CS.mergeStates(window.S, { anki: { decks: {}, notes: {}, cards: {}, types: {}, media: {}, settings: {}, days: {}, log: [], lastDay: "2020-01-01", undo: null } }, 1, 2).state;
  out.mergeDue = m.anki && m.anki.cards && m.anki.cards[cP] ? m.anki.cards[cP].sched.due : null;
  // 7: date boundaries via todayKey (23:50 + 1d crosses midnight; year boundary)
  const late = Date.UTC(2026, 11, 31, 23, 50, 0);
  const deckId2 = (Object.keys(SA2.decks)[0]);
  const mk2 = (front) => {
    const r = A.addNote(SA2, { type: "basic", deck: deckId2, fields: { Front: front, Back: "x" }, tags: "" });
    return r.cards[0];
  };
  const cB = mk2("c-boundary");
  A.gradeCard(SA2, cB, "hard", late);
  out.boundaryDue = SA2.cards[cB].sched.due;
  out.boundaryExpect = tk(late + 86400000);
  const cB2 = mk2("c-boundary-good");
  A.gradeCard(SA2, cB2, "good", late);
  out.boundaryGoodDue = SA2.cards[cB2].sched.due;
  out.boundaryGoodExpect = tk(late + 3 * 86400000);
  // previews match actual scheduled dates (stub i18n so vm has templates)
  window.t = function (k) { return k === "anki_inmin" ? "in {n} Min." : k === "anki_indays" ? "in {n} d" : k; };
  out.pvAgain = A.previewInterval(SA2, cB2, "again");
  out.pvHard = A.previewInterval(SA2, cB2, "hard");
  out.pvGood = A.previewInterval(SA2, cB2, "good");
  out.pvEasy = A.previewInterval(SA2, cB2, "easy");
  // determinism: same input twice -> identical output
  const cD = mk2("c-determ");
  A.gradeCard(SA2, cD, "easy", NOW);
  const s1 = JSON.stringify(SA2.cards[cD].sched);
  SA2.cards[cD].sched = { st: "new", step: 0, iv: 0, laps: 0, ease: 2.5, e: 2.5, due: tk(NOW), dueMin: 0, last: null, miss: 0, reps: 0 };
  A.gradeCard(SA2, cD, "easy", NOW);
  out.determ = JSON.stringify(SA2.cards[cD].sched) === s1;
  return JSON.stringify(out);
})()
`;

function main() {
  const { js } = boot();
  let R = {};
  try { R = JSON.parse(js(SCEN)); }
  catch (e) { ok("scenario-runs", false, String(e && e.message || e).slice(0, 400)); console.log("----"); console.log("RESULT: FAIL (1)"); process.exit(1); }
  ok("scenario-runs", true);
  ok("again-10min", R.againDueMin === 10 * 60000, String(R.againDueMin));
  ok("again-due-today", R.againDue === R.againDueExpect, R.againDue + " vs " + R.againDueExpect);
  ok("again-iv-zero", R.againIv === 0, String(R.againIv));
  ok("hard-1d", R.hardDue === R.hardExpect && R.hardIv === 1 && R.hardDueMin === 0, JSON.stringify({ due: R.hardDue, exp: R.hardExpect, iv: R.hardIv }));
  ok("good-3d", R.goodDue === R.goodExpect && R.goodIv === 3 && R.goodDueMin === 0, JSON.stringify({ due: R.goodDue, exp: R.goodExpect, iv: R.goodIv }));
  ok("easy-7d", R.easyDue === R.easyExpect && R.easyIv === 7 && R.easyDueMin === 0, JSON.stringify({ due: R.easyDue, exp: R.easyExpect, iv: R.easyIv }));
  ok("repeat-hard-exact", R.repeatHardDue === R.hardExpect && R.repeatHardIv === 1, JSON.stringify({ due: R.repeatHardDue, iv: R.repeatHardIv }));
  ok("repeat-good-exact", R.repeatGoodDue === R.goodExpect && R.repeatGoodIv === 3, JSON.stringify({ due: R.repeatGoodDue, iv: R.repeatGoodIv }));
  ok("repeat-easy-exact", R.repeatEasyDue === R.easyExpect && R.repeatEasyIv === 7, JSON.stringify({ due: R.repeatEasyDue, iv: R.repeatEasyIv }));
  ok("repeat-again-exact", R.repeatAgainGap === 10 * 60000, String(R.repeatAgainGap));
  ok("lowease-still-exact", R.lowEaseGoodDue === R.goodExpect && R.lowEaseGoodIv === 3, JSON.stringify({ due: R.lowEaseGoodDue, iv: R.lowEaseGoodIv }));
  ok("persist-due", R.persistDue === R.persistWantDue && R.persistIv === R.persistWantIv, JSON.stringify({ due: R.persistDue, want: R.persistWantDue, iv: R.persistIv }));
  ok("merge-keeps-due", R.mergeDue === R.persistWantDue, JSON.stringify({ merge: R.mergeDue, want: R.persistWantDue }));
  ok("boundary-hard", R.boundaryDue === R.boundaryExpect, R.boundaryDue + " vs " + R.boundaryExpect);
  ok("boundary-good", R.boundaryGoodDue === R.boundaryGoodExpect, R.boundaryGoodDue + " vs " + R.boundaryGoodExpect);
  ok("preview-again-10", /10/.test(R.pvAgain), R.pvAgain);
  ok("preview-hard-1", /(^|[^0-9])1([^0-9]|$)/.test(R.pvHard), R.pvHard);
  ok("preview-good-3", /3/.test(R.pvGood), R.pvGood);
  ok("preview-easy-7", /7/.test(R.pvEasy), R.pvEasy);
  ok("deterministic", R.determ === true, "nondeterministic");
  // static: scheduler uses todayKey + epoch conventions, fixed constants only
  const src = RD("client/ankidroid.js");
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ok("fixed-constants", /ANKI_FIXED_AGAIN_MIN\s*=\s*10/.test(clean) && /ANKI_FIXED_HARD_D\s*=\s*1/.test(clean) && /ANKI_FIXED_GOOD_D\s*=\s*3/.test(clean) && /ANKI_FIXED_EASY_D\s*=\s*7/.test(clean), "constants");
  ok("uses-todayKey", /todayKey\(new Date\(now/.test(clean), "date convention");
  ok("uses-dueMin-epoch", /dueMin\s*=\s*now\s*\+/.test(clean), "timestamp convention");
  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}
main();
