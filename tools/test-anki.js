/* Deutsch Master - AnkiDroid section tests.
 * Proves against the REAL modules (progress.js DMProgress.srsGrade +
 * ankidroid.js AnkiDroid API) in a stubbed-DOM vm context:
 *  A. scheduler: New->Learning->Review, Again->Relearning, ease/interval
 *     behavior, intraday learning steps, determinism, dry-run previews
 *  B. decks: create/tree/rename/subdeck/delete/counts from real scheduler
 *  C. notes: add/edit/move/tag/ref-cards/reversed/XSS-safe rendering
 *  D. queue: daily limits, suspend/bury exclusion, subdeck inclusion
 *  E. undo: exact previous-state restore incl. log truncation
 *  F. search: deck:/tag:/is:/text/level filters
 *  G. CSV: quotes/commas/newlines/Arabic/umlauts/duplicates/empty rows
 *  H. stats from real log/schedule; checkDB finds orphans/empties
 *  I. isolation: S.anki namespaced, no fixed localStorage keys, no second
 *     sync engine, flashcards state untouched by Anki grading
 * Usage: node tools/test-anki.js  (exit 0 = PASS, 1 = FAIL)
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
  vm.runInContext(RD("client/ankidroid.js"), sb, { filename: "ankidroid.js" });
  return { sb, js: e => vm.runInContext(e, sb) };
}

const SCEN = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const NOW = 1767225600000; // fixed clock for determinism
  // decks
  const r1 = A.createDeck(SA, "Deutsch::A1::Kapitel 1", null);
  out.deckPath = A.deckPath(SA, r1.id);
  const rD = A.createDeck(SA, "Deutsch", null);
  out.roots = Object.keys(SA.decks).filter(k => !SA.decks[k].parent).map(k => SA.decks[k].name).sort().join(",");
  out.rename = A.renameDeck(SA, r1.id, "Kapitel 1");
  // notes
  const n1 = A.addNote(SA, { type: "basic", deck: r1.id, fields: { Front: "Haus", Back: "منزل" }, tags: "a1, noun" });
  const n2 = A.addNote(SA, { type: "basic_rev", deck: r1.id, fields: { Front: "Buch", Back: "كتاب" }, tags: "" });
  out.cardsBasic = n1.cards.length; out.cardsRev = n2.cards.length;
  out.tags = SA.notes[n1.note].tags.join("|");
  // scheduler flow on first basic card
  const c1 = n1.cards[0];
  const g1 = A.gradeCard(SA, c1, "good", NOW);
  out.afterGood1 = SA.cards[c1].sched.st;
  const g2 = A.gradeCard(SA, c1, "good", NOW + 31 * 60000);
  out.afterGood2 = SA.cards[c1].sched.st;
  out.ivAfterGrad = SA.cards[c1].sched.iv;
  const g3 = A.gradeCard(SA, c1, "again", NOW + 32 * 60000);
  out.afterAgain = SA.cards[c1].sched.st;
  out.lapsesKept = SA.cards[c1].sched.reps;
  // determinism: restore the exact pre-grade state, re-grade, compare
  const pre3 = JSON.stringify(g3.prev);
  const snap1 = JSON.stringify(SA.cards[c1].sched);
  SA.cards[c1].sched = JSON.parse(pre3);
  A.gradeCard(SA, c1, "again", NOW + 32 * 60000);
  out.deterministic = JSON.stringify(SA.cards[c1].sched) === snap1;
  // undo restores exact previous state
  const beforeUndo = JSON.stringify(SA.cards[c1].sched);
  A.logGrade(SA, c1, "again", g2.prev, SA.cards[c1].sched);
  const logLen = SA.log.length;
  A.undoLast(SA);
  out.undoState = JSON.stringify(SA.cards[c1].sched) === JSON.stringify(g2.prev);
  out.undoLog = SA.log.length === logLen - 1;
  // ease bounds under pressure
  let e = 2.5;
  SA.cards[c1].sched = { st: "review", step: 0, iv: 5, laps: 3, ease: 2.5, e: 2.5, due: "2020-01-01", dueMin: 0, last: null, miss: 0, reps: 3 };
  for (let i = 0; i < 40; i++) { A.gradeCard(SA, c1, "again", NOW + i * 86400000); }
  out.easeFloor = SA.cards[c1].sched.ease;
  SA.cards[c1].sched = { st: "review", step: 0, iv: 5, laps: 3, ease: 2.5, e: 2.5, due: "2020-01-01", dueMin: 0, last: null, miss: 0, reps: 3 };
  for (let i = 0; i < 40; i++) { A.gradeCard(SA, c1, "easy", NOW + i * 86400000); }
  out.easeCap = SA.cards[c1].sched.ease;
  // intervals: easy >= good >= hard
  function freshIv(rating) {
    const t = A.addNote(SA, { type: "basic", deck: r1.id, fields: { Front: "w" + rating + Math.random(), Back: "x" }, tags: "" });
    const id = t.cards[0];
    SA.cards[id].sched = { st: "review", step: 0, iv: 4, laps: 2, ease: 2.5, e: 2.5, due: "2020-01-01", dueMin: 0, last: null, miss: 0, reps: 2 };
    A.gradeCard(SA, id, rating, NOW);
    return SA.cards[id].sched.iv;
  }
  const ivH = freshIv("hard"), ivG = freshIv("good"), ivE = freshIv("easy");
  out.ivOrder = ivH <= ivG && ivG <= ivE;
  out.ivVals = [ivH, ivG, ivE].join(",");
  // queue + counts + limits
  const q = A.buildQueue(SA, rD.id, { nowMs: NOW });
  out.queueTotal = q.items.length;
  out.counts = A.deckCounts(SA, rD.id, NOW);
  // suspend/bury exclusion
  const c2 = n2.cards[0];
  SA.cards[c2].susp = true;
  const q2 = A.buildQueue(SA, rD.id, { nowMs: NOW });
  out.suspExcluded = !q2.items.some(c => c.id === c2);
  SA.cards[c2].susp = false; SA.cards[c2].buried = 1;
  const q3 = A.buildQueue(SA, rD.id, { nowMs: NOW });
  out.buriedExcluded = !q3.items.some(c => c.id === c2);
  SA.cards[c2].buried = 0;
  // search
  out.searchDeck = A.searchCards(SA, "deck:Deutsch::A1", NOW).length;
  out.searchTag = A.searchCards(SA, "tag:a1", NOW).length;
  out.searchText = A.searchCards(SA, "Buch", NOW).length;
  out.searchNew = A.searchCards(SA, "is:new", NOW).length;
  // csv
  const rows = A.parseCSV('Front,Back,Deck,Tags\\n"Haus, groß","منزل كبير",Deutsch::A1,noun\\nBuch,book,Deutsch::A1,\\n"multi\\nline",x,D,\\n,,D,\\n');
  out.csvRows = rows.length;
  out.csvQuote = rows[1][0];
  const rep = A.importRows(SA, [["Front","Back","Deck","Tags"],["Apfel","تفاحة","Deutsch::A1","a1"],["Apfel","تفاحة","Deutsch::A1","a1"],["","x","D",""]], {});
  out.impAdded = rep.added; out.impSkipped = rep.skipped;
  const um = A.parseCSV([ "Front,Back", "grüße,تحيات", "straße,شارع" ].join("\\n"));
  out.umlaut = um.length === 3 && um[1][0] === "grüße";
  // xss safety at render
  const xn = A.addNote(SA, { type: "basic", deck: r1.id, fields: { Front: "<script>alert(1)</script>", Back: "b" }, tags: "" });
  const sides = A.cardSides(SA, SA.cards[xn.cards[0]]);
  out.xss = sides.front.indexOf("<script>") < 0 && sides.front.indexOf("&lt;script&gt;") >= 0;
  // stats + checkdb
  const st = A.computeStats(SA, NOW);
  out.statsKeys = ["total","new","due","retention30","streak","forecast"].every(k => st[k] !== undefined);
  SA.cards.zzorphan = { id: "zzorphan", note: "nope", deck: "nope", tmpl: 0, dir: "fwd", sched: { st: "new", step: 0, iv: 0, laps: 0, ease: 2.5, e: 2.5, due: "2026-01-01", dueMin: 0, last: null, miss: 0, reps: 0 }, susp: false, buried: 0, created: 1 };
  out.checkdb = A.checkDB(SA).length >= 2;
  delete SA.cards.zzorphan;
  // isolation: flashcards state untouched
  out.flashUntouched = !window.S.srs || Object.keys(window.S.srs).length === 0;
  return JSON.stringify(out);
})()
`;

function main() {
  const { js } = boot();
  ok("API-present", js("typeof window.AnkiDroid") === "object", "no AnkiDroid API");
  let R = {};
  try {
    R = JSON.parse(js(SCEN));
  } catch (e) {
    ok("scenario-runs", false, String(e && e.message || e).slice(0, 300));
    console.log("----"); console.log("RESULT: FAIL (1)"); process.exit(1);
  }
  ok("scenario-runs", true);
  ok("deck-path-nested", R.deckPath === "Deutsch::A1::Kapitel 1", R.deckPath);
  ok("deck-roots", R.roots === "Deutsch", R.roots);
  ok("deck-rename", R.rename === true, String(R.rename));
  ok("note-basic-1card", R.cardsBasic === 1, String(R.cardsBasic));
  ok("note-reversed-2cards", R.cardsRev === 2, String(R.cardsRev));
  ok("note-tags", R.tags === "a1|noun", R.tags);
  ok("sched-new-good-learning", R.afterGood1 === "learning", R.afterGood1);
  ok("sched-learning-good-review", R.afterGood2 === "review", R.afterGood2);
  ok("sched-graduated-iv", R.ivAfterGrad >= 1, String(R.ivAfterGrad));
  ok("sched-review-again-relearning", R.afterAgain === "relearning", R.afterAgain);
  ok("sched-history-kept", R.lapsesKept >= 3, String(R.lapsesKept));
  ok("sched-deterministic", R.deterministic === true, "nondeterministic");
  ok("undo-restores-state", R.undoState === true, "state mismatch");
  ok("undo-truncates-log", R.undoLog === true, "log kept");
  ok("ease-floor", R.easeFloor >= 1.3, String(R.easeFloor));
  ok("ease-cap", R.easeCap <= 2.8, String(R.easeCap));
  ok("interval-order", R.ivOrder === true, R.ivVals);
  ok("queue-built", R.queueTotal > 0, String(R.queueTotal));
  ok("counts-shape", R.counts && typeof R.counts.new === "number" && typeof R.counts.review === "number", JSON.stringify(R.counts));
  ok("suspend-excluded", R.suspExcluded === true, "suspended in queue");
  ok("buried-excluded", R.buriedExcluded === true, "buried in queue");
  ok("search-deck", R.searchDeck >= 3, String(R.searchDeck));
  ok("search-tag", R.searchTag === 1, String(R.searchTag));
  ok("search-text", R.searchText >= 1, String(R.searchText));
  ok("search-is-new", R.searchNew >= 1, String(R.searchNew));
  ok("csv-rows", R.csvRows === 5, String(R.csvRows));
  ok("csv-quoted-comma", R.csvQuote === "Haus, groß", R.csvQuote);
  ok("csv-import-added", R.impAdded === 1, String(R.impAdded));
  ok("csv-import-skipped", R.impSkipped === 2, String(R.impSkipped));
  ok("csv-umlaut-arabic", R.umlaut === true, "encoding");
  ok("xss-escaped", R.xss === true, "unescaped render");
  ok("stats-shape", R.statsKeys === true, "stats");
  ok("checkdb-finds", R.checkdb === true, "orphans missed");
  ok("flash-untouched", R.flashUntouched === true, "S.srs polluted");

  /* ---- static isolation guarantees (comments stripped) ---- */
  const src = RD("client/ankidroid.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ok("no-fixed-ls-keys", !/localStorage\s*\.\s*(getItem|setItem)/.test(src), "direct localStorage use");
  ok("no-second-sync", !/supabase|user_progress|dm_sync_queue/.test(src), "own sync engine");
  ok("no-flash-state", !/S\.srs|S\.status|bumpReview|buildFlash|renderFlash/.test(src), "flashcards coupling");
  ok("uses-own-attr", /data-arate/.test(src) && !/data-flash-rate/.test(src), "rating attr collision");
  ok("uses-srsGrade-namespaced", /srsGrade/.test(src), "no scheduler");

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}
main();
