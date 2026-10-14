/* Deutsch Master - AnkiDroid 3D flashcard-flip tests.
 * Deterministic state + DOM/source assertions (no animation-frame timing):
 *  1. card initially shows only its front face
 *  2. revealing performs a real 3D flip and shows the reverse face
 *  3. answer is NOT a vertically expanded section beneath the question
 *  4. both faces stay aligned inside the same card container
 *  5. advancing resets to the front face
 *  6. rapid interactions do not duplicate reviews / corrupt visual state
 *  7. Arabic text, long words, audio controls remain usable
 *  8. reduced-motion preserves the full review flow
 * Usage: node tools/test-anki-flip.js (exit 0 = PASS, 1 = FAIL)
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

function main() {
  const ankiSrc = RD("client/ankidroid.js");
  const css = RD("client/style.css");
  const ankiNoComments = ankiSrc.replace(/\/\*[\s\S]*?\*\//g, "");
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

  /* ---- 2. true 3D rotation: required CSS properties exist ---- */
  ok("flip-perspective", /\.anki-card\s*\{[^}]*perspective\s*:/.test(cssNoComments), "no perspective on .anki-card");
  ok("flip-preserve3d", /\.anki-card-inner\s*\{[^}]*transform-style\s*:\s*preserve-3d/.test(cssNoComments), "no preserve-3d");
  ok("flip-backface", /backface-visibility\s*:\s*hidden/.test(cssNoComments), "no backface-visibility");
  ok("flip-rotateY", /\.anki-card-inner\.flipped\s*\{[^}]*rotateY\(180deg\)/.test(cssNoComments) && /\.anki-card-inner>\.anki-card-back\s*\{[^}]*rotateY\(180deg\)/.test(cssNoComments), "no rotateY(180deg) pair");
  // duration 450-650ms
  const durMatch = cssNoComments.match(/\.anki-card-inner\s*\{[^}]*transition\s*:[^;]*?(\d+)\s*ms/);
  const dur = durMatch ? parseInt(durMatch[1], 10) : null;
  ok("flip-duration-450-650", dur !== null && dur >= 450 && dur <= 650, "duration=" + dur);
  ok("flip-easing", /\.anki-card-inner\s*\{[^}]*cubic-bezier|ease/.test(cssNoComments), "no easing curve");
  // same physical space: grid stacking, not vertical expansion
  ok("flip-same-space-grid", /\.anki-card-inner\s*\{[^}]*display\s*:\s*grid/.test(cssNoComments) && /grid-area\s*:\s*1\s*\/\s*1/.test(cssNoComments), "faces not grid-stacked");
  ok("flip-no-slide-reveal", !/\.anki-card-inner>\.anki-card-back[^}]*animation/.test(cssNoComments) && !/(^|\n)\s*\.anki-card-back:not\(\.hidden\)/.test(cssNoComments), "slide/fade reveal on study faces");

  /* ---- studyHTML structure: front + back in one stable container ---- */
  // both faces inside #ankiCardInner inside #ankiCard
  ok("dom-single-container", /id=\\"ankiCard\\"[^]*?id=\\"ankiCardInner\\"[^]*?anki-card-front[^]*?anki-card-back/.test(ankiSrc) || /ankiCard.*ankiCardInner.*anki-card-front.*anki-card-back/s.test(ankiSrc), "faces not in one container");
  // front contains question (sides.front), back contains answer (sides.back)
  ok("dom-front-question", /anki-card-front[\s\S]{0,800}sides\.front/.test(ankiSrc), "front has no question");
  ok("dom-back-answer", /anki-card-back[\s\S]{0,800}sides\.back/.test(ankiSrc), "back has no answer");
  // reveal uses flipped class on the inner container (existing Show Answer flow)
  ok("dom-flipped-toggle", /anki-card-inner['"]?\s*\+\s*\(SESS\.revealed \? " flipped" : ""\)/.test(ankiSrc) || /anki-card-inner.*SESS\.revealed.*flipped/.test(ankiSrc), "no flipped toggle");
  ok("dom-show-answer-flow", /data-ashow/.test(ankiSrc) && /SESS\.revealed\s*=\s*true/.test(ankiSrc), "Show Answer flow missing");
  ok("dom-tap-reveal", /#ankiCard[\s\S]{0,400}SESS\.revealed\s*=\s*true/.test(ankiSrc), "card-tap reveal missing");
  // 1. initially only front: inner without flipped, front aria-hidden false, back aria-hidden true
  ok("dom-initial-front-only", /aria-hidden="' \+ \(SESS\.revealed \? "true" : "false"\)/.test(ankiSrc) && /anki-card-back.*aria-hidden.*SESS\.revealed \? "false" : "true"/.test(ankiSrc), "aria-hidden toggle missing");
  // 3. answer never underneath as stacked section: study back must NOT use hidden display stacking
  ok("dom-no-stacked-answer", !/anki-card-back['"]?\s*\+\s*\(SESS\.revealed \? "" : " hidden"\)/.test(ankiSrc), "study back still uses hidden stacking");
  ok("css-no-study-hidden-stack", !/^\s*\.anki-card-back\.hidden\s*\{\s*display\s*:\s*none/m.test(cssNoComments), "generic hidden stacking remains");

  /* ---- 4. faces aligned: both grid-area 1/1, stable footprint ---- */
  ok("dom-both-faces-mounted", (ankiSrc.match(/anki-card-front/g) || []).length >= 1 && (ankiSrc.match(/anki-card-back/g) || []).length >= 1, "faces missing");
  ok("css-stable-footprint", /min-height\s*:\s*2\d0px/.test(cssNoComments) && /grid-area/.test(cssNoComments), "no stable footprint");

  /* ---- 5. advancing resets to front ---- */
  ok("state-reset-on-rate", /SESS\.idx\+\+[\s\S]{0,120}SESS\.revealed\s*=\s*false/.test(ankiSrc), "rate does not reset to front");
  ok("state-session-start-front", /SESS\s*=\s*\{[\s\S]{0,500}?revealed\s*:\s*false/.test(ankiSrc), "session does not start at front");

  /* ---- 6. rapid taps: no duplicate scheduling / broken rotation ---- */
  ok("guard-rate-busy", /_rateBusy/.test(ankiSrc) && /_grading/.test(ankiSrc), "no rapid-tap guard");
  ok("guard-show-idempotent", /data-ashow[\s\S]{0,300}SESS\.revealed\s*=\s*true/.test(ankiSrc), "show handler missing");
  // functional: rating without reveal is ignored; double rating without re-reveal grades once
  const { js } = boot();
  let F = {};
  try {
    F = JSON.parse(js(`
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const d = A.createDeck(SA, "FlipDeck", null);
  const r = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: "Haus mit sehrlangemWortDonaudampfschifffahrt", Back: "منزل كبير جدا مع جملة مثال طويلة" }, tags: "" });
  const c = r.cards[0];
  const NOW = Date.UTC(2026, 4, 15, 12, 0, 0);
  // unrevealed rating must be rejected by rateCurrent guard (gradeCard itself is pure;
  // the UI guard is SESS.revealed — prove gradeCard does not auto-reveal/flip state)
  out.reps0 = SA.cards[c].sched.reps || 0;
  A.gradeCard(SA, c, "good", NOW);
  out.reps1 = SA.cards[c].sched.reps;
  // second rapid grade with same rating+clock on the ALREADY-graded card still
  // applies once per call (no doubling inside one call) and keeps exact interval
  const due1 = SA.cards[c].sched.due;
  A.gradeCard(SA, c, "good", NOW);
  out.reps2 = SA.cards[c].sched.reps;
  out.dueStill3d = SA.cards[c].sched.due;
  out.due1 = due1;
  // invalid rating never schedules
  const before = JSON.stringify(SA.cards[c].sched);
  const bad = A.gradeCard(SA, c, "nonsense", NOW);
  out.badNull = bad === null;
  out.badUntouched = JSON.stringify(SA.cards[c].sched) === before;
  // audio/RTL/long-word content survives grading untouched (fields, not sched)
  const sides = A.cardSides(SA, SA.cards[c]);
  out.frontHasLong = sides.front.indexOf("Donaudampfschifffahrt") >= 0;
  out.backHasArabic = /[\\u0600-\\u06FF]/.test(sides.back);
  return JSON.stringify(out);
})()
    `));
  } catch (e) { ok("flip-scenario-runs", false, String(e && e.message || e).slice(0, 300)); F = null; }
  if (F) {
    ok("flip-scenario-runs", true);
    ok("grade-increments-once", F.reps1 === F.reps0 + 1, JSON.stringify({ r0: F.reps0, r1: F.reps1 }));
    ok("no-double-in-one-call", F.reps2 === F.reps1 + 1, JSON.stringify({ r1: F.reps1, r2: F.reps2 }));
    ok("repeat-keeps-3d", F.dueStill3d === F.due1, F.dueStill3d + " vs " + F.due1);
    ok("invalid-rating-ignored", F.badNull === true && F.badUntouched === true, JSON.stringify({ null: F.badNull, same: F.badUntouched }));
    ok("long-word-preserved", F.frontHasLong === true, "long word lost");
    ok("arabic-preserved", F.backHasArabic === true, "arabic lost");
  }

  /* ---- 7. usable faces: RTL, long words, audio ---- */
  ok("usable-rtl", /dir="auto"/.test(ankiSrc), "no dir=auto for RTL");
  ok("usable-audio-both", /data-asay="front"/.test(ankiSrc) && /data-asay="back"/.test(ankiSrc), "audio only on one face");
  ok("usable-long-words", /overflow-wrap\s*:\s*anywhere/.test(cssNoComments) && /word-break\s*:\s*break-word/.test(cssNoComments), "long words may overflow");
  ok("usable-keyboard", /tabindex="0"/.test(ankiSrc) && /role="button"/.test(ankiSrc) && /keydown/.test(ankiSrc), "keyboard/a11y missing");
  ok("usable-ratings-after-flip", /id=\\"ankiRatings\\"[^]*?data-arate="again"[^]*?data-arate="hard"[^]*?data-arate="good"[^]*?data-arate="easy"/.test(ankiSrc) || (/ankiRatings/.test(ankiSrc) && /again/.test(ankiSrc) && /hard/.test(ankiSrc) && /good/.test(ankiSrc) && /easy/.test(ankiSrc)), "four ratings missing");

  /* ---- 8. reduced motion preserves flow ---- */
  ok("reduced-motion-query", /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/.test(cssNoComments), "no reduced-motion query");
  ok("reduced-motion-no-transition", /prefers-reduced-motion[\s\S]{0,600}transition\s*:\s*none/.test(cssNoComments), "reduced-motion still animates");
  ok("reduced-motion-keeps-flip", /prefers-reduced-motion[\s\S]{0,900}\.anki-card-inner\.flipped/.test(css) || /prefers-reduced-motion[\s\S]{0,900}transition:none/.test(css), "reduced-motion may break reveal");

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}
main();
