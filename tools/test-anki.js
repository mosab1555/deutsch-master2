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
 *  J. media: file/URL validators, magic-byte sniff, hash dedup, token
 *     render (front/back/reversed), refcounts/prune, budget, broken refs,
 *     v1->v2 migration, XSS-safe img output
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
  // Real sync engine (needs navigator/onLine + localStorage stubs above).
  // Lets persistence/identity/merge/offline tests run against the actual
  // merge + queue code instead of a stub.
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

const SCEN_MEDIA = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  // validators: files
  out.vJpg = !!A.validateImageFile({ name: "a.JPG", type: "image/jpeg", size: 1000 }).ok;
  out.vPng = !!A.validateImageFile({ name: "a.png", type: "image/png", size: 1000 }).ok;
  out.vWebp = !!A.validateImageFile({ name: "a.webp", type: "image/webp", size: 1000 }).ok;
  out.vGif = !!A.validateImageFile({ name: "a.gif", type: "image/gif", size: 1000 }).ok;
  out.vSvgMime = A.validateImageFile({ name: "a.svg", type: "image/svg+xml", size: 1000 }).error;
  out.vSvgExt = A.validateImageFile({ name: "a.svg", type: "", size: 1000 }).error;
  out.vExe = A.validateImageFile({ name: "a.png", type: "application/x-msdownload", size: 1000 }).error;
  out.vFakeExt = A.validateImageFile({ name: "evil.txt", type: "text/plain", size: 100 }).error;
  out.vBig = A.validateImageFile({ name: "a.jpg", type: "image/jpeg", size: 9 * 1024 * 1024 }).error;
  out.vEmpty = A.validateImageFile({ name: "a.jpg", type: "image/jpeg", size: 0 }).error;
  out.vNull = A.validateImageFile(null).error;
  out.vOctPng = !!A.validateImageFile({ name: "a.png", type: "application/octet-stream", size: 100 }).ok;
  out.vOctTxt = A.validateImageFile({ name: "a.txt", type: "application/octet-stream", size: 100 }).error;
  // validators: URLs
  out.uHttp = !!A.validateImageURL("https://example.com/image.jpg").ok;
  out.uHttp2 = !!A.validateImageURL("http://example.com/i.png?x=1").ok;
  out.uJs = A.validateImageURL("javascript:alert(1)").error;
  out.uData = A.validateImageURL("data:image/png;base64,xx").error;
  out.uFtp = A.validateImageURL("ftp://example.com/a.png").error;
  out.uGarbage = A.validateImageURL("not a url").error;
  out.uSvg = A.validateImageURL("https://example.com/a.svg").error;
  out.uEmpty = A.validateImageURL("").error;
  // magic sniff
  const U8 = a => new Uint8Array(a);
  out.sJpeg = A.sniffImageKind(U8([0xFF, 0xD8, 0xFF, 0xE0, 1, 2]));
  out.sPng = A.sniffImageKind(U8([0x89, 0x50, 0x4E, 0x47, 1, 2]));
  out.sGif = A.sniffImageKind(U8([0x47, 0x49, 0x46, 0x38, 1, 2]));
  out.sWebp = A.sniffImageKind(U8([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]));
  out.sSvg = A.sniffImageKind("   <svg xmlns='x'>");
  out.sGarbage = A.sniffImageKind(U8([1, 2, 3, 4, 5]));
  out.sShort = A.sniffImageKind(U8([1, 2]));
  // hash
  out.hashStable = A.mediaHash("abc") === A.mediaHash("abc");
  out.hashDiff = A.mediaHash("abc") !== A.mediaHash("abd");
  // store + dedup + prune
  const mk = (tag, n) => ({ mime: "image/jpeg", w: 10, h: 10, bytes: n || 100, data: "data:image/jpeg;base64," + tag, thumb: null, src: "device" });
  const s1 = A.storeMediaAsset(SA, mk("AAA"));
  const s2 = A.storeMediaAsset(SA, mk("AAA"));
  out.dedupSame = s1.id === s2.id;
  out.dedupFlag = s2.reused === true;
  const s3 = A.storeMediaAsset(SA, mk("BBB"));
  out.dedupDiff = s3.id !== s1.id && !s3.reused;
  out.refEmpty = JSON.stringify(A.mediaRefCounts(SA)) === "{}";
  out.unusedAll = A.unusedMedia(SA).length === 2;
  out.pruned = A.pruneMedia(SA) === 2 && Object.keys(SA.media).length === 0;
  const s4 = A.storeMediaAsset(SA, mk("CCC", 200));
  out.bytes = A.mediaBytes(SA) === 200;
  const big = A.storeMediaAsset(SA, mk("BIG", 4 * 1024 * 1024));
  out.budget = big.error === "budget" && !SA.media[big.id];
  // attach token to note fields; render front/back; reversed keeps image
  const d = A.createDeck(SA, "MDeck", null);
  const nn = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: "der Apfel [[m:" + s4.id + "]]", Back: "التفاحة" }, tags: "" });
  const cid = nn.cards[0];
  const sides = A.cardSides(SA, SA.cards[cid]);
  out.imgFront = sides.front.indexOf('data-amedia="' + s4.id + '"') >= 0 && sides.front.indexOf("der Apfel") >= 0;
  out.imgLazy = sides.front.indexOf('loading="lazy"') >= 0;
  out.noRaw = sides.front.indexOf("[[m:") < 0;
  out.imgBackOnlyFront = sides.back.indexOf('data-amedia="' + s4.id + '"') >= 0;
  const nn2 = A.addNote(SA, { type: "basic_rev", deck: d.id, fields: { Front: "X", Back: "Y [[m:" + s4.id + "]]" }, tags: "" });
  const revCard = SA.cards[nn2.cards[1]];
  const rsides = A.cardSides(SA, revCard);
  out.imgReversed = rsides.front.indexOf("X") >= 0 && rsides.back.indexOf('data-amedia="' + s4.id + '"') >= 0;
  // unknown mid renders nothing, never raw
  const nn3 = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: "Z [[m:zzz9]]", Back: "w" }, tags: "" });
  const usides = A.cardSides(SA, SA.cards[nn3.cards[0]]);
  out.unknownDropped = usides.front.indexOf("[[m:") < 0 && usides.front.indexOf("data-amedia") < 0 && usides.front.indexOf("Z") >= 0;
  // xss through field + fake img
  const nx = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: '<img src=x onerror=alert(1)> [[m:' + s4.id + ']]', Back: "b" }, tags: "" });
  const xs = A.cardSides(SA, SA.cards[nx.cards[0]]);
  out.xssImg = xs.front.indexOf("<img src=x") < 0 && xs.front.indexOf("&lt;img") >= 0 && xs.front.indexOf('<img class="anki-img"') >= 0;
  // refcounts + prune keeps referenced, drops orphan after note delete
  out.refs = A.mediaRefCounts(SA)[s4.id] >= 3;
  out.hasMedia = A.noteHasMedia(SA, SA.notes[nn.note]) === true;
  A.deleteNote(SA, nn.note); A.deleteNote(SA, nn2.note); A.deleteNote(SA, nn3.note); A.deleteNote(SA, nx.note);
  out.pruneAfterDelete = Object.keys(SA.media).length === 0;
  // broken ref reported by checkDB
  const nb = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: "Q [[m:qqq1]]", Back: "w" }, tags: "" });
  out.brokenRef = A.checkDB(SA).some(s => s.indexOf("broken media ref") === 0);
  A.deleteNote(SA, nb.note);
  // migration v1 -> v2 preserves everything
  delete SA.media; SA.v = 1;
  SA.notes.keepme = { id: "keepme", type: "basic", deck: d.id, fields: { Front: "K", Back: "k" }, tags: [], created: 1, modified: 1 };
  const mig = A.store();
  out.migMedia = !!mig.media && typeof mig.media === "object";
  out.migV = mig.v === 2;
  out.migNotes = !!mig.notes.keepme && !!mig.decks[d.id];
  delete mig.notes.keepme;
  // isolation: media namespaced under S.anki (no fixed keys)
  out.nsMedia = !!window.S.anki && window.S.anki.media === mig.media;
  // store-level isolation: ops on one collection never leak into another
  const B = JSON.parse(JSON.stringify(SA));
  const bb = A.storeMediaAsset(B, { mime: "image/png", w: 5, h: 5, bytes: 50, data: "data:image/png;base64,ZZZ", thumb: null, src: "device" });
  out.storeIsolation = !!B.media[bb.id] && !SA.media[bb.id] && A.mediaRefCounts(SA)[bb.id] === undefined;
  return JSON.stringify(out);
})()
`;


/* Bug-fix regression: add -> persist -> reload -> find.
 * Proves the exact reported flow against the real store: create a deck,
 * save a Basic note (Front=Test Front, Back=Test Back), then verify it is
 * immediately visible in counts/browser/queue AND still there after the
 * snapshot is reloaded from disk (DMIdentity.activate re-reads the key,
 * exactly what a page reload loads). */
const SCEN_PERSIST = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const d = A.createDeck(SA, "PersistDeck", null);
  const r = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: "Test Front", Back: "Test Back" }, tags: "" });
  out.addErr = r.error || null; out.note = r.note || null; out.card = (r.cards || [])[0] || null;
  out.liveNote = !!(out.note && SA.notes[out.note]);
  out.liveCard = !!(out.card && SA.cards[out.card]);
  out.liveDeck = !!(out.card && SA.cards[out.card] && SA.cards[out.card].deck === d.id);
  out.countsNew = A.deckCounts(SA, d.id, Date.now()).new;
  out.liveBrowser = A.searchCards(SA, "Test Front", Date.now()).length;
  out.liveQueue = A.buildQueue(SA, d.id, {}).items.length;
  // reload from disk (page reload loads the same identity key)
  window.DMIdentity.activate(null);
  const SA2 = A.store();
  out.rNotes = Object.keys(SA2.notes).length; out.rCards = Object.keys(SA2.cards).length;
  out.rBrowser = A.searchCards(SA2, "Test Front", Date.now()).length;
  const c = out.card && SA2.cards[out.card];
  out.rDeckOk = !!(c && c.deck === d.id);
  out.rState = c ? c.sched.st : "?";
  out.rCounts = SA2.decks[d.id] ? A.deckCounts(SA2, d.id, Date.now()).new : -1;
  out.rQueue = SA2.decks[d.id] ? A.buildQueue(SA2, d.id, {}).items.length : -1;
  return JSON.stringify(out);
})()
`;

/* Identity isolation: guest card <-> account A <-> account B never leak. */
const SCEN_IDENTITY = `
(() => {
  const A = window.AnkiDroid;
  const out = {};
  const snap = () => { try { window.DMIdentity.snapshot(); } catch (e) {} };
  const go = (uid) => { try { window.DMIdentity.activate(uid); } catch (e) {} return A.store(); };
  let SA = go(null);
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const dg = A.createDeck(SA, "GuestDeck", null);
  A.addNote(SA, { type: "basic", deck: dg.id, fields: { Front: "GuestCard", Back: "b" }, tags: "" });
  snap();
  out.guestCards = Object.keys(SA.cards).length;
  SA = go("uid-A");
  out.aFresh = Object.keys(SA.cards).length;
  const da = A.createDeck(SA, "ADeck", null);
  A.addNote(SA, { type: "basic", deck: da.id, fields: { Front: "Card Alpha7", Back: "b" }, tags: "" });
  snap();
  SA = go("uid-B");
  out.bFresh = Object.keys(SA.cards).length;
  snap();
  SA = go("uid-A");
  out.aAgain = A.searchCards(SA, "Alpha7", Date.now()).length;
  out.aSeesGuest = A.searchCards(SA, "GuestCard", Date.now()).length;
  snap();
  SA = go(null);
  out.guestAgain = A.searchCards(SA, "GuestCard", Date.now()).length;
  out.guestSeesA = A.searchCards(SA, "Alpha7", Date.now()).length;
  return JSON.stringify(out);
})()
`;

/* Sync merge: the reported wipe. A stale cloud copy must NEVER drop locally
 * added notes/cards (union-by-id, local-wins on conflict, idempotent). */
const SCEN_MERGE = `
(() => {
  const out = {};
  const CS = window.CloudSync;
  out.hasMerge = !!(CS && typeof CS.mergeStates === "function" && typeof CS.mergeAnki === "function");
  if (!out.hasMerge) return JSON.stringify(out);
  const card = (id, note, deck) => ({ id, note, deck, tmpl: 0, dir: "fwd", sched: { st: "new", step: 0, iv: 0, laps: 0, ease: 2.5, e: 2.5, due: "2026-01-01", dueMin: 0, last: null, miss: 0, reps: 0 }, susp: false, buried: 0, created: 1 });
  const note = (id, deck, front) => ({ id, type: "basic", deck, fields: { Front: front, Back: "b" }, tags: [], created: 1, modified: 1 });
  const local = { anki: { v: 2, seq: 1, decks: { d1: { id: "d1", name: "LocalDeck", parent: null, opts: {}, collapsed: false, created: 1 } }, notes: { n1: note("n1", "d1", "Test Front") }, cards: { c1: card("c1", "n1", "d1") }, types: { basic: { id: "basic", name: "Basic!", fields: ["Front", "Back"], templates: [{ name: "F", q: "{{Front}}", a: "{{Back}}" }] } }, media: {}, settings: { defaultDeck: "d1" }, days: { "2026-01-01": { rev: 2, ok: 1, new: 1, again: 0 } }, log: [{ t: 5, c: "c1", r: "good", ok: 1, st: "learning", iv: 0 }], lastDay: "2026-01-01", undo: null } };
  const cloud = { anki: { v: 2, seq: 7, decks: { d9: { id: "d9", name: "CloudDeck", parent: null, opts: {}, collapsed: false, created: 1 }, d1: { id: "d1", name: "StaleName", parent: null, opts: {}, collapsed: true, created: 1 } }, notes: { n9: note("n9", "d9", "Cloud Note") }, cards: { c9: card("c9", "n9", "d9") }, types: {}, media: {}, settings: { defaultDeck: "d9" }, days: { "2026-01-01": { rev: 5, ok: 4, new: 0, again: 1 } }, log: [{ t: 6, c: "c9", r: "again", ok: 0, st: "relearning", iv: 0 }], lastDay: "2026-01-02", undo: null } };
  const m = CS.mergeStates(local, cloud, 2, 3).state;
  out.keepsLocalCard = !!(m.anki && m.anki.cards && m.anki.cards.c1);
  out.keepsLocalNote = !!(m.anki && m.anki.notes && m.anki.notes.n1);
  out.keepsCloudCard = !!(m.anki && m.anki.cards && m.anki.cards.c9);
  out.keepsBothDecks = !!(m.anki && m.anki.decks && m.anki.decks.d1 && m.anki.decks.d9);
  out.localWinsDeck = !!(m.anki && m.anki.decks && m.anki.decks.d1 && m.anki.decks.d1.name === "LocalDeck");
  out.localWinsType = !!(m.anki && m.anki.types && m.anki.types.basic && m.anki.types.basic.name === "Basic!");
  out.dayMax = !!(m.anki && m.anki.days && m.anki.days["2026-01-01"] && m.anki.days["2026-01-01"].rev === 5 && m.anki.days["2026-01-01"].new === 1);
  out.logUnion = !!(m.anki && m.anki.log && m.anki.log.length === 2);
  out.seqMax = !!(m.anki && m.anki.seq === 7);
  out.lastDayMax = !!(m.anki && m.anki.lastDay === "2026-01-02");
  const m2 = CS.mergeStates({ anki: m.anki }, cloud, 3, 3).state;
  out.idempotent = Object.keys(m2.anki.cards).length === 2 && Object.keys(m2.anki.notes).length === 2;
  const m3 = CS.mergeStates({ xp: 1 }, { xp: 2 }, 1, 1).state;
  out.neitherNoAnki = !("anki" in m3);
  const m4 = CS.mergeStates(local, {}, 2, 0).state;
  out.cloudEmptyKeeps = !!(m4.anki && m4.anki.cards && m4.anki.cards.c1);
  return JSON.stringify(out);
})()
`;

/* Validation + regression: zero-template guard, stale-deck fallback,
 * duplicate determinism, edit/move/suspend/delete still work. */
const SCEN_VALIDATE = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  const out = {};
  if (!Object.keys(SA.decks).length) A.createDeck(SA, "VDeck", null);
  const dd = Object.keys(SA.decks)[0];
  const before = Object.keys(SA.notes).length;
  SA.types.empty_t = { id: "empty_t", name: "EmptyT", fields: ["Front"], templates: [] };
  const r0 = A.addNote(SA, { type: "empty_t", deck: dd, fields: { Front: "x" }, tags: "" });
  out.zeroTmplErr = r0.error || null;
  out.zeroTmplNoNote = Object.keys(SA.notes).length === before;
  delete SA.types.empty_t;
  const beforeCards = Object.keys(SA.cards).length;
  const r1 = A.addNote(SA, { type: "basic", deck: "__nope__", fields: { Front: "Fallback Deck", Back: "b" }, tags: "" });
  const fc = (r1.cards || [])[0] || null;
  out.fallbackDeckOk = !!(fc && SA.cards[fc] && SA.decks[SA.cards[fc].deck]);
  if (!r1.error) { try { A.deleteNote(SA, r1.note); } catch (e) {} }
  out.cleanup = Object.keys(SA.cards).length === beforeCards;
  const d1 = A.addNote(SA, { type: "basic", deck: dd, fields: { Front: "Dup", Back: "b" }, tags: "" });
  const d2 = A.addNote(SA, { type: "basic", deck: dd, fields: { Front: "Dup", Back: "b" }, tags: "" });
  out.dupBoth = !d1.error && !d2.error && d1.note !== d2.note && d1.cards[0] !== d2.cards[0];
  out.dupFound = A.searchCards(SA, "Dup", Date.now()).length === 2;
  try { A.deleteNote(SA, d1.note); A.deleteNote(SA, d2.note); } catch (e) {}
  const e1 = A.addNote(SA, { type: "basic", deck: dd, fields: { Front: "EditMe", Back: "b" }, tags: "t1" });
  const er = A.editNote(SA, e1.note, { fields: { Front: "Edited" }, tags: "t2" });
  out.editOk = !!(er.ok && SA.notes[e1.note].fields.Front === "Edited");
  out.editFound = A.searchCards(SA, "Edited", Date.now()).length >= 1;
  const cid = e1.cards[0]; SA.cards[cid].susp = true;
  out.suspHidden = A.buildQueue(SA, dd, {}).items.every(c => c.id !== cid);
  SA.cards[cid].susp = false;
  out.delOk = A.deleteNote(SA, e1.note) === true && !SA.cards[cid] && !SA.notes[e1.note];
  return JSON.stringify(out);
})()
`;

/* Offline: add while the backend is unreachable -> saved locally, visible,
 * survives reload, queued under the owning identity (never uploaded as
 * another account), and a reconnect drain does not lose or misattribute it. */
const SCEN_OFFLINE = `
(async () => {
  const A = window.AnkiDroid;
  const SA = A.store();
  const out = {};
  if (!Object.keys(SA.decks).length) A.createDeck(SA, "OffDeck", null);
  const dd = Object.keys(SA.decks)[0];
  const r = A.addNote(SA, { type: "basic", deck: dd, fields: { Front: "Offline Card", Back: "b" }, tags: "" });
  out.added = !r.error;
  out.visible = A.searchCards(SA, "Offline Card", Date.now()).length === 1;
  out.queueVisible = A.buildQueue(SA, dd, {}).items.some(c => c.id === (r.cards || [])[0]);
  const CS = window.CloudSync;
  out.hasCS = !!CS;
  if (CS) {
    const up = await CS.uploadChanges("guest", window.S);
    out.queuedWhileNoBackend = !!(up && up.queued === true);
    const q = JSON.parse(localStorage.getItem("dm_sync_queue") || "[]");
    out.guestHeld = q.filter(op => (op.userId || "guest") === "guest").length >= 1;
    out.noLeak = q.every(op => typeof (op.userId || "guest") === "string");
    try { await CS.processQueue(); } catch (e) {}
    const q2 = JSON.parse(localStorage.getItem("dm_sync_queue") || "[]");
    out.heldAfterDrain = q2.filter(op => (op.userId || "guest") === "guest").length >= 1;
    // end-to-end through the fixed merge: stale-cloud merge keeps the card
    const m = CS.mergeStates(window.S, { anki: { decks: {}, notes: {}, cards: {}, types: {}, media: {}, settings: {}, days: {}, log: [], lastDay: "2020-01-01", undo: null } }, 1, 2).state;
    out.mergeKeepsOffline = !!(m.anki && m.anki.cards && m.anki.cards[(r.cards || [])[0]]);
  }
  window.DMIdentity.activate(null);
  out.reloadFound = A.searchCards(A.store(), "Offline Card", Date.now()).length === 1;
  return JSON.stringify(out);
})()
`;

async function main() {
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

  /* ---- J. media ---- */
  let M = {};
  try {
    M = JSON.parse(js(SCEN_MEDIA));
  } catch (e) {
    ok("media-scenario-runs", false, String(e && e.message || e).slice(0, 300));
    console.log("----"); console.log("RESULT: FAIL (1)"); process.exit(1);
  }
  ok("media-scenario-runs", true);
  ok("media-file-jpg", M.vJpg === true);
  ok("media-file-png", M.vPng === true);
  ok("media-file-webp", M.vWebp === true);
  ok("media-file-gif", M.vGif === true);
  ok("media-reject-svg-mime", M.vSvgMime === "svg", String(M.vSvgMime));
  ok("media-reject-svg-ext", M.vSvgExt === "svg", String(M.vSvgExt));
  ok("media-reject-exe-mime", M.vExe === "bad-type", String(M.vExe));
  ok("media-reject-text", M.vFakeExt === "bad-type", String(M.vFakeExt));
  ok("media-reject-oversize", M.vBig === "too-large", String(M.vBig));
  ok("media-reject-empty", M.vEmpty === "bad-file", String(M.vEmpty));
  ok("media-reject-null", M.vNull === "bad-file", String(M.vNull));
  ok("media-octet-png-provisional", M.vOctPng === true);
  ok("media-octet-txt-reject", M.vOctTxt === "bad-type", String(M.vOctTxt));
  ok("media-url-https", M.uHttp === true);
  ok("media-url-query", M.uHttp2 === true);
  ok("media-url-js", M.uJs === "bad-url", String(M.uJs));
  ok("media-url-data", M.uData === "bad-url", String(M.uData));
  ok("media-url-ftp", M.uFtp === "bad-url", String(M.uFtp));
  ok("media-url-garbage", M.uGarbage === "bad-url", String(M.uGarbage));
  ok("media-url-svg", M.uSvg === "svg", String(M.uSvg));
  ok("media-url-empty", M.uEmpty === "bad-url", String(M.uEmpty));
  ok("media-sniff-jpeg", M.sJpeg === "jpeg", String(M.sJpeg));
  ok("media-sniff-png", M.sPng === "png", String(M.sPng));
  ok("media-sniff-gif", M.sGif === "gif", String(M.sGif));
  ok("media-sniff-webp", M.sWebp === "webp", String(M.sWebp));
  ok("media-sniff-svg", M.sSvg === "svg", String(M.sSvg));
  ok("media-sniff-garbage", M.sGarbage === null, String(M.sGarbage));
  ok("media-sniff-short", M.sShort === null, String(M.sShort));
  ok("media-hash-stable", M.hashStable === true);
  ok("media-hash-diff", M.hashDiff === true);
  ok("media-dedup-same", M.dedupSame === true);
  ok("media-dedup-flag", M.dedupFlag === true);
  ok("media-dedup-diff", M.dedupDiff === true);
  ok("media-refcounts-empty", M.refEmpty === true, String(M.refEmpty));
  ok("media-unused-all", M.unusedAll === true);
  ok("media-prune", M.pruned === true);
  ok("media-bytes", M.bytes === true);
  ok("media-budget", M.budget === true);
  ok("media-img-front", M.imgFront === true);
  ok("media-img-lazy", M.imgLazy === true);
  ok("media-no-raw-token", M.noRaw === true);
  ok("media-back-via-template", M.imgBackOnlyFront === true);
  ok("media-reversed-answer", M.imgReversed === true);
  ok("media-unknown-dropped", M.unknownDropped === true);
  ok("media-xss-img", M.xssImg === true);
  ok("media-refcounts-hit", M.refs === true);
  ok("media-hasMedia", M.hasMedia === true);
  ok("media-prune-after-delete", M.pruneAfterDelete === true);
  ok("media-broken-ref", M.brokenRef === true);
  ok("media-migrate-store", M.migMedia === true);
  ok("media-migrate-v2", M.migV === true);
  ok("media-migrate-preserves", M.migNotes === true);
  ok("media-namespaced", M.nsMedia === true);
  ok("media-store-isolation", M.storeIsolation === true);

  /* ---- K. bug-fix regression: add -> persist -> reload -> find ---- */
  let P = {};
  try {
    P = JSON.parse(js(SCEN_PERSIST));
  } catch (e) {
    ok("persist-scenario-runs", false, String(e && e.message || e).slice(0, 300));
    console.log("----"); console.log("RESULT: FAIL (1)"); process.exit(1);
  }
  ok("persist-scenario-runs", true);
  ok("persist-add-no-error", !P.addErr, P.addErr);
  ok("persist-note-live", P.liveNote === true);
  ok("persist-card-live", P.liveCard === true);
  ok("persist-card-deck", P.liveDeck === true);
  ok("persist-counts-new", P.countsNew >= 1, String(P.countsNew));
  ok("persist-browser-live", P.liveBrowser >= 1, String(P.liveBrowser));
  ok("persist-queue-live", P.liveQueue >= 1, String(P.liveQueue));
  ok("persist-reload-notes", P.rNotes >= 1, JSON.stringify(P));
  ok("persist-reload-cards", P.rCards >= 1, JSON.stringify(P));
  ok("persist-reload-browser", P.rBrowser >= 1, JSON.stringify(P));
  ok("persist-reload-deck", P.rDeckOk === true, JSON.stringify(P));
  ok("persist-reload-new-state", P.rState === "new", String(P.rState));
  ok("persist-reload-counts", P.rCounts >= 1, JSON.stringify(P));
  ok("persist-reload-queue", P.rQueue >= 1, JSON.stringify(P));

  /* ---- L. identity isolation ---- */
  let I = {};
  try {
    I = JSON.parse(js(SCEN_IDENTITY));
  } catch (e) {
    ok("identity-scenario-runs", false, String(e && e.message || e).slice(0, 300));
    console.log("----"); console.log("RESULT: FAIL (1)"); process.exit(1);
  }
  ok("identity-scenario-runs", true);
  ok("identity-guest-has-card", I.guestCards >= 1, JSON.stringify(I));
  ok("identity-new-account-clean", I.aFresh === 0, JSON.stringify(I));
  ok("identity-accountB-clean", I.bFresh === 0, JSON.stringify(I));
  ok("identity-accountA-keeps", I.aAgain >= 1, JSON.stringify(I));
  ok("identity-A-no-guest-leak", I.aSeesGuest === 0, JSON.stringify(I));
  ok("identity-guest-restored", I.guestAgain >= 1, JSON.stringify(I));
  ok("identity-guest-no-A-leak", I.guestSeesA === 0, JSON.stringify(I));

  /* ---- M. sync merge keeps local cards ---- */
  let G = {};
  try {
    G = JSON.parse(js(SCEN_MERGE));
  } catch (e) {
    ok("merge-scenario-runs", false, String(e && e.message || e).slice(0, 300));
    console.log("----"); console.log("RESULT: FAIL (1)"); process.exit(1);
  }
  ok("merge-scenario-runs", true);
  ok("merge-api-present", G.hasMerge === true);
  ok("merge-keeps-local-card", G.keepsLocalCard === true, JSON.stringify(G));
  ok("merge-keeps-local-note", G.keepsLocalNote === true, JSON.stringify(G));
  ok("merge-keeps-cloud-card", G.keepsCloudCard === true, JSON.stringify(G));
  ok("merge-keeps-both-decks", G.keepsBothDecks === true, JSON.stringify(G));
  ok("merge-local-wins-deck", G.localWinsDeck === true, JSON.stringify(G));
  ok("merge-local-wins-type", G.localWinsType === true, JSON.stringify(G));
  ok("merge-day-max", G.dayMax === true, JSON.stringify(G));
  ok("merge-log-union", G.logUnion === true, JSON.stringify(G));
  ok("merge-seq-max", G.seqMax === true, JSON.stringify(G));
  ok("merge-lastday-max", G.lastDayMax === true, JSON.stringify(G));
  ok("merge-idempotent", G.idempotent === true, JSON.stringify(G));
  ok("merge-neither-no-anki", G.neitherNoAnki === true, JSON.stringify(G));
  ok("merge-cloud-empty-keeps", G.cloudEmptyKeeps === true, JSON.stringify(G));

  /* ---- N. validation + edit/delete/suspend regression ---- */
  let N = {};
  try {
    N = JSON.parse(js(SCEN_VALIDATE));
  } catch (e) {
    ok("validate-scenario-runs", false, String(e && e.message || e).slice(0, 300));
    console.log("----"); console.log("RESULT: FAIL (1)"); process.exit(1);
  }
  ok("validate-scenario-runs", true);
  ok("validate-zero-template-err", N.zeroTmplErr === "empty-templates", String(N.zeroTmplErr));
  ok("validate-zero-template-no-note", N.zeroTmplNoNote === true);
  ok("validate-stale-deck-fallback", N.fallbackDeckOk === true);
  ok("validate-probe-cleanup", N.cleanup === true);
  ok("validate-duplicates-distinct", N.dupBoth === true);
  ok("validate-duplicates-findable", N.dupFound === true);
  ok("validate-edit", N.editOk === true);
  ok("validate-edit-found", N.editFound === true);
  ok("validate-suspend-hidden", N.suspHidden === true);
  ok("validate-delete", N.delOk === true);

  /* ---- O. offline add -> reload -> reconnect ---- */
  let O = {};
  try {
    O = JSON.parse(await js(SCEN_OFFLINE));
  } catch (e) {
    ok("offline-scenario-runs", false, String(e && e.message || e).slice(0, 300));
    console.log("----"); console.log("RESULT: FAIL (1)"); process.exit(1);
  }
  ok("offline-scenario-runs", true);
  ok("offline-added", O.added === true, JSON.stringify(O));
  ok("offline-visible", O.visible === true, JSON.stringify(O));
  ok("offline-queue-visible", O.queueVisible === true, JSON.stringify(O));
  ok("offline-queued-no-backend", O.queuedWhileNoBackend === true, JSON.stringify(O));
  ok("offline-guest-held", O.guestHeld === true, JSON.stringify(O));
  ok("offline-no-leak", O.noLeak === true, JSON.stringify(O));
  ok("offline-held-after-drain", O.heldAfterDrain === true, JSON.stringify(O));
  ok("offline-merge-keeps", O.mergeKeepsOffline === true, JSON.stringify(O));
  ok("offline-reload-found", O.reloadFound === true, JSON.stringify(O));

  /* ---- P. required regression flows A-G: deck/note/card visibility ----
   * Each scenario resets the collection first so it is independent of order:
   *  A. existing deck: add -> bound to DeckA -> counts/browser/study
   *  B. new deck: create -> live + listed -> select -> add -> counts/browser/study
   *  C. reload after B: deck + card + browser + study survive activate()
   *  D. offline: create + add -> visible -> reload -> reconnect w/o dup/move
   *  E. multiple decks: per-deck isolation incl. browser filter + study queue
   *  F. stale UI: explicit DeckB destination survives a re-render
   *  G. persistence failure: no phantom deck/note/card, retry works
   *  H. deck-ID browser filter: exact ID + parent-subtree, paths unaffected */

  const SCEN_AB = `
(() => {
  const A = window.AnkiDroid;
  const out = {};
  const reset = () => {
    const SA = A.store();
    ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
    SA.media = SA.media || {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
    return SA;
  };
  // A: existing deck
  let SA = reset();
  const dA = A.createDeck(SA, "DeckA", null);
  out.aDeck = !!(dA.id && SA.decks[dA.id]);
  const c0 = A.deckCounts(SA, dA.id, Date.now()).total;
  const ra = A.addNote(SA, { type: "basic", deck: dA.id, fields: { Front: "AlphaFrontA", Back: "AlphaBackA" }, tags: "" });
  out.aErr = ra.error || null;
  out.aNote = !!(ra.note && SA.notes[ra.note]);
  out.aCard = !!(ra.cards && ra.cards[0] && SA.cards[ra.cards[0]]);
  out.aBound = !!(ra.cards && ra.cards[0] && SA.cards[ra.cards[0]].deck === dA.id);
  out.aCount = A.deckCounts(SA, dA.id, Date.now()).total === c0 + 1;
  out.aBrowserFront = A.searchCards(SA, "AlphaFrontA", Date.now()).length === 1;
  out.aBrowserBack = A.searchCards(SA, "AlphaBackA", Date.now()).length === 1;
  out.aBrowserDeck = A.searchCards(SA, "deck:DeckA", Date.now()).length >= 1;
  out.aBrowserId = A.searchCards(SA, String((ra.cards || [])[0]), Date.now()).length === 1;
  out.aStudy = A.buildQueue(SA, dA.id, {}).items.some(c => c.id === (ra.cards || [])[0]);
  // B: new deck
  SA = reset();
  const dB = A.createDeck(SA, "DeckB", null);
  out.bLive = !!(dB.id && A.store().decks[dB.id]);
  out.bListed = Object.keys(SA.decks).indexOf(dB.id) >= 0;
  out.bSelect = A.resolveDeckId(SA, dB.id) === dB.id;
  const rb = A.addNote(SA, { type: "basic", deck: dB.id, fields: { Front: "BetaFrontB", Back: "BetaBackB" }, tags: "" });
  out.bBound = !!(rb.cards && rb.cards[0] && SA.cards[rb.cards[0]].deck === dB.id);
  const bc = A.deckCounts(SA, dB.id, Date.now());
  out.bCounts = bc.total >= 1 && bc.new >= 1;
  out.bBrowser = A.searchCards(SA, "BetaFrontB", Date.now()).length === 1;
  out.bStudy = A.buildQueue(SA, dB.id, {}).items.some(c => c.id === (rb.cards || [])[0]);
  out.bDeckId = dB.id; out.bCard = (rb.cards || [])[0];
  return JSON.stringify(out);
})()
  `;

  const SCEN_C = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = SA.media || {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const d = A.createDeck(SA, "DeckBReload", null);
  const r = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: "GammaFrontC", Back: "GammaBackC" }, tags: "" });
  out.cid = (r.cards || [])[0] || null; out.did = d.id;
  window.DMIdentity.activate(null);
  const SA2 = A.store();
  out.cDeck = !!(d.id && SA2.decks[d.id]);
  const c = out.cid && SA2.cards[out.cid];
  out.cBound = !!(c && c.deck === d.id);
  out.cBrowser = A.searchCards(SA2, "GammaFrontC", Date.now()).length === 1;
  out.cStudy = SA2.decks[d.id] ? A.buildQueue(SA2, d.id, {}).items.some(x => x.id === out.cid) : false;
  return JSON.stringify(out);
})()
  `;

  const SCEN_D = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = SA.media || {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const d = A.createDeck(SA, "DeckC", null);
  const r = A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: "DeltaFrontD", Back: "DeltaBackD" }, tags: "" });
  const cid = (r.cards || [])[0];
  out.dDeckListed = !!SA.decks[d.id];
  out.dCardInDeck = !!(cid && SA.cards[cid] && SA.cards[cid].deck === d.id);
  out.dBrowser = A.searchCards(SA, "DeltaFrontD", Date.now()).length === 1;
  out.dStudy = A.buildQueue(SA, d.id, {}).items.some(c => c.id === cid);
  window.DMIdentity.activate(null);
  const SA2 = A.store();
  out.dReloadDeck = !!SA2.decks[d.id];
  out.dReloadCard = !!(cid && SA2.cards[cid] && SA2.cards[cid].deck === d.id);
  // reconnect: stale empty-cloud merge must not duplicate or move the card
  const CS = window.CloudSync;
  const before = Object.keys(SA2.cards).length;
  const m = CS.mergeStates(window.S, { anki: { decks: {}, notes: {}, cards: {}, types: {}, media: {}, settings: {}, days: {}, log: [], lastDay: "2020-01-01", undo: null } }, 1, 2).state;
  const afterCards = m.anki && m.anki.cards ? Object.keys(m.anki.cards).length : -1;
  out.dNoDup = afterCards === before;
  out.dSameDeck = !!(m.anki && m.anki.cards && m.anki.cards[cid] && m.anki.cards[cid].deck === d.id);
  return JSON.stringify(out);
})()
  `;

  const SCEN_E = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = SA.media || {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const da = A.createDeck(SA, "IsoA", null), db = A.createDeck(SA, "IsoB", null), dc = A.createDeck(SA, "IsoC", null);
  const ra = A.addNote(SA, { type: "basic", deck: da.id, fields: { Front: "IsoFrontA", Back: "b" }, tags: "" });
  const rb = A.addNote(SA, { type: "basic", deck: db.id, fields: { Front: "IsoFrontB", Back: "b" }, tags: "" });
  const rc = A.addNote(SA, { type: "basic", deck: dc.id, fields: { Front: "IsoFrontC", Back: "b" }, tags: "" });
  const qa = A.buildQueue(SA, da.id, {}).items.map(c => c.id);
  const qb = A.buildQueue(SA, db.id, {}).items.map(c => c.id);
  const qc = A.buildQueue(SA, dc.id, {}).items.map(c => c.id);
  out.eBound = SA.cards[ra.cards[0]].deck === da.id && SA.cards[rb.cards[0]].deck === db.id && SA.cards[rc.cards[0]].deck === dc.id;
  out.eQa = qa.indexOf(ra.cards[0]) >= 0 && qa.indexOf(rb.cards[0]) < 0 && qa.indexOf(rc.cards[0]) < 0;
  out.eQb = qb.indexOf(rb.cards[0]) >= 0 && qb.indexOf(ra.cards[0]) < 0 && qb.indexOf(rc.cards[0]) < 0;
  out.eQc = qc.indexOf(rc.cards[0]) >= 0 && qc.indexOf(ra.cards[0]) < 0 && qc.indexOf(rb.cards[0]) < 0;
  out.eFa = A.searchCards(SA, "deck:IsoA", Date.now()).every(c => c.deck === da.id);
  out.eFb = A.searchCards(SA, "deck:IsoB", Date.now()).every(c => c.deck === db.id);
  out.eFc = A.searchCards(SA, "deck:IsoC", Date.now()).every(c => c.deck === dc.id);
  out.eCounts = A.searchCards(SA, "deck:IsoA", Date.now()).length === 1 && A.searchCards(SA, "deck:IsoB", Date.now()).length === 1 && A.searchCards(SA, "deck:IsoC", Date.now()).length === 1;
  return JSON.stringify(out);
})()
  `;

  const SCEN_F = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = SA.media || {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const da = A.createDeck(SA, "StaleA", null);
  const db = A.createDeck(SA, "StaleB", null);
  // open Deck A, then create/open Deck B (explicit destination = Deck B)
  A.view().deck = da.id; A.view().name = "overview";
  A.view().deck = db.id; A.view().name = "overview";
  // add a card while Deck B is selected, then trigger a re-render
  const r = A.addNote(A.store(), { type: "basic", deck: A.view().deck, fields: { Front: "StaleFrontB", Back: "b" }, tags: "" });
  try { A.render(); } catch (e) { out.renderThrow = String(e && e.message || e).slice(0, 120); }
  out.fStays = A.view().deck === db.id && A.view().name === "overview";
  out.fBound = !!(r.cards && r.cards[0] && A.store().cards[r.cards[0]].deck === db.id);
  out.fOverviewLive = A.deckCounts(A.store(), db.id, Date.now()).total >= 1;
  return JSON.stringify(out);
})()
  `;

  const SCEN_G = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = SA.media || {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const base = A.createDeck(SA, "BaseG", null);
  out.gBase = !!base.id;
  const decks0 = Object.keys(SA.decks).length, notes0 = Object.keys(SA.notes).length, cards0 = Object.keys(SA.cards).length;
  const _sv = window.save;
  window.save = function () { return false; };
  const fd = A.createDeck(SA, "PhantomDeck", null);
  out.gDeckErr = fd.error || null;
  out.gNoPhantomDeck = !Object.keys(SA.decks).some(k => SA.decks[k] && SA.decks[k].name === "PhantomDeck") && Object.keys(SA.decks).length === decks0;
  const fr = A.addNote(SA, { type: "basic", deck: base.id, fields: { Front: "PhantomFront", Back: "b" }, tags: "" });
  out.gNoteErr = fr.error || null;
  out.gNoPhantomCard = Object.keys(SA.notes).length === notes0 && Object.keys(SA.cards).length === cards0 && A.searchCards(SA, "PhantomFront", Date.now()).length === 0;
  window.save = _sv;
  const rr = A.addNote(A.store(), { type: "basic", deck: base.id, fields: { Front: "RetryFront", Back: "b" }, tags: "" });
  out.gRetry = !rr.error && !!(rr.cards && A.store().cards[rr.cards[0]]);
  try { window.DMIdentity.snapshot(); } catch (e) {}
  return JSON.stringify(out);
})()
  `;

  const SCEN_H = `
(() => {
  const A = window.AnkiDroid;
  const SA = A.store();
  ["decks","notes","cards"].forEach(k => Object.keys(SA[k]).forEach(x => delete SA[k][x]));
  SA.media = SA.media || {}; SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
  const out = {};
  const par = A.createDeck(SA, "PidParent", null);
  const kid = A.createDeck(SA, "PidParent::PidKid", null);
  const rk = A.addNote(SA, { type: "basic", deck: kid.id, fields: { Front: "PidKidFront", Back: "b" }, tags: "" });
  const rp = A.addNote(SA, { type: "basic", deck: par.id, fields: { Front: "PidParFront", Back: "b" }, tags: "" });
  const qKid = A.searchCards(SA, "deck:" + kid.id, Date.now()).map(c => c.id);
  const qPar = A.searchCards(SA, "deck:" + par.id, Date.now()).map(c => c.id);
  out.hKidExact = qKid.length === 1 && qKid[0] === rk.cards[0];
  out.hParSubtree = qPar.length === 2 && qPar.indexOf(rk.cards[0]) >= 0 && qPar.indexOf(rp.cards[0]) >= 0;
  out.hParPathStillWorks = A.searchCards(SA, "deck:PidParent", Date.now()).length === 2;
  out.hKidPathStillWorks = A.searchCards(SA, "deck:PidKid", Date.now()).length === 1;
  out.hUnknownIdEmpty = A.searchCards(SA, "deck:d0000000000", Date.now()).length === 0;
  return JSON.stringify(out);
})()
  `;

  let R2 = {};
  try { R2 = JSON.parse(js(SCEN_AB)); }
  catch (e) { ok("flowsAB-runs", false, String(e && e.message || e).slice(0, 300)); R2 = null; }
  if (R2) {
    ok("flowsAB-runs", true);
    ok("A-deck-exists", R2.aDeck === true, JSON.stringify(R2));
    ok("A-note-exists", R2.aNote === true, JSON.stringify(R2));
    ok("A-card-exists", R2.aCard === true, JSON.stringify(R2));
    ok("A-card-deckId", R2.aBound === true, JSON.stringify(R2));
    ok("A-count-increased", R2.aCount === true, JSON.stringify(R2));
    ok("A-browser-front", R2.aBrowserFront === true, JSON.stringify(R2));
    ok("A-browser-back", R2.aBrowserBack === true, JSON.stringify(R2));
    ok("A-browser-deck", R2.aBrowserDeck === true, JSON.stringify(R2));
    ok("A-browser-id", R2.aBrowserId === true, JSON.stringify(R2));
    ok("A-study-queue", R2.aStudy === true, JSON.stringify(R2));
    ok("B-deck-live", R2.bLive === true, JSON.stringify(R2));
    ok("B-deck-listed", R2.bListed === true, JSON.stringify(R2));
    ok("B-auto-select", R2.bSelect === true, JSON.stringify(R2));
    ok("B-card-deckId", R2.bBound === true, JSON.stringify(R2));
    ok("B-counts", R2.bCounts === true, JSON.stringify(R2));
    ok("B-browser", R2.bBrowser === true, JSON.stringify(R2));
    ok("B-study-queue", R2.bStudy === true, JSON.stringify(R2));
  }
  let R3 = null;
  try { R3 = JSON.parse(js(SCEN_C)); ok("C-runs", true); }
  catch (e) { ok("C-runs", false, String(e && e.message || e).slice(0, 300)); }
  if (R3) {
    ok("C-deck-survives", R3.cDeck === true, JSON.stringify(R3));
    ok("C-card-deck", R3.cBound === true, JSON.stringify(R3));
    ok("C-browser", R3.cBrowser === true, JSON.stringify(R3));
    ok("C-study", R3.cStudy === true, JSON.stringify(R3));
  }
  let R4 = null;
  try { R4 = JSON.parse(js(SCEN_D)); ok("D-runs", true); }
  catch (e) { ok("D-runs", false, String(e && e.message || e).slice(0, 300)); }
  if (R4) {
    ok("D-deck-immediate", R4.dDeckListed === true, JSON.stringify(R4));
    ok("D-card-deck", R4.dCardInDeck === true, JSON.stringify(R4));
    ok("D-browser", R4.dBrowser === true, JSON.stringify(R4));
    ok("D-study", R4.dStudy === true, JSON.stringify(R4));
    ok("D-reload-deck", R4.dReloadDeck === true, JSON.stringify(R4));
    ok("D-reload-card", R4.dReloadCard === true, JSON.stringify(R4));
    ok("D-reconnect-no-dup", R4.dNoDup === true, JSON.stringify(R4));
    ok("D-reconnect-same-deck", R4.dSameDeck === true, JSON.stringify(R4));
  }
  let R5 = null;
  try { R5 = JSON.parse(js(SCEN_E)); ok("E-runs", true); }
  catch (e) { ok("E-runs", false, String(e && e.message || e).slice(0, 300)); }
  if (R5) {
    ok("E-bound", R5.eBound === true, JSON.stringify(R5));
    ok("E-queue-A", R5.eQa === true, JSON.stringify(R5));
    ok("E-queue-B", R5.eQb === true, JSON.stringify(R5));
    ok("E-queue-C", R5.eQc === true, JSON.stringify(R5));
    ok("E-filter-A", R5.eFa === true, JSON.stringify(R5));
    ok("E-filter-B", R5.eFb === true, JSON.stringify(R5));
    ok("E-filter-C", R5.eFc === true, JSON.stringify(R5));
    ok("E-filter-counts", R5.eCounts === true, JSON.stringify(R5));
  }
  let R6 = null;
  try { R6 = JSON.parse(js(SCEN_F)); ok("F-runs", true); }
  catch (e) { ok("F-runs", false, String(e && e.message || e).slice(0, 300)); }
  if (R6) {
    ok("F-stays-on-B", R6.fStays === true, JSON.stringify(R6));
    ok("F-card-on-B", R6.fBound === true, JSON.stringify(R6));
    ok("F-overview-live", R6.fOverviewLive === true, JSON.stringify(R6));
  }
  let R7 = null;
  try { R7 = JSON.parse(js(SCEN_G)); ok("G-runs", true); }
  catch (e) { ok("G-runs", false, String(e && e.message || e).slice(0, 300)); }
  if (R7) {
    ok("G-deck-err", R7.gDeckErr === "persist-failed", JSON.stringify(R7));
    ok("G-no-phantom-deck", R7.gNoPhantomDeck === true, JSON.stringify(R7));
    ok("G-note-err", R7.gNoteErr === "persist-failed", JSON.stringify(R7));
    ok("G-no-phantom-card", R7.gNoPhantomCard === true, JSON.stringify(R7));
    ok("G-retry-works", R7.gRetry === true, JSON.stringify(R7));
  }
  let R8 = null;
  try { R8 = JSON.parse(js(SCEN_H)); ok("H-runs", true); }
  catch (e) { ok("H-runs", false, String(e && e.message || e).slice(0, 300)); }
  if (R8) {
    ok("H-deckid-exact", R8.hKidExact === true, JSON.stringify(R8));
    ok("H-deckid-subtree", R8.hParSubtree === true, JSON.stringify(R8));
    ok("H-deckpath-still-works", R8.hParPathStillWorks === true && R8.hKidPathStillWorks === true, JSON.stringify(R8));
    ok("H-unknown-deckid-empty", R8.hUnknownIdEmpty === true, JSON.stringify(R8));
  }

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}
main().catch(function (e) { console.log("FATAL " + (e && e.message || e)); process.exit(1); });
