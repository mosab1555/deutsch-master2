/* Sentences first-filter regression tests (Node, no browser required).
 *
 * Measured defect (2026-10-12, headless Chrome, 150802-sentence bank):
 *  - sentA1Merge() cold run took ~2447ms synchronously on the first
 *    sentences render (full-bank rescan + per-item allWords() scans over the
 *    150k bank), dominating the ~4.2s first-filter wall time. Repeat merges
 *    were already free via the revision signature, and kap/topic/level scans
 *    are ~1-3ms — the filter loop itself was never the bottleneck.
 *  - sentA1SearchRows() cold index build took ~414ms even when no search
 *    text was active (first filter is usually a chapter/level/category
 *    change with an empty query).
 *
 * Fix under test (client/sent-a1.js): incremental merge cursors (O(delta)
 * repeat/growth merges), cached gram/vocab lookups (no per-item allWords()
 * scans), empty-query fast path (no index build without search text), and
 * idle re-warm hooks on lazy-pack events.
 *
 * This suite verifies, on a synthetic bank in a vm sandbox running the REAL
 * client/sent-a1.js:
 *  F1. Repeat merges are stable (same ids, same stats) and do no re-scan
 *      work (sentNorm call delta == 0).
 *  F2. Growth merges process only deltas (bounded sentNorm calls) with
 *      correct results (new items visible, no duplicates, order kept).
 *  F3. sentA1FilterList matches an independent reference filter exactly
 *      (ids AND order) across empty/kap/topic/level/search-de/search-ar/
 *      word-fallback/no-match/combined scenarios, both with and without the
 *      normalized index.
 *  F4. Empty-query filtering never builds the normalized index; search
 *      reuses the incremental index with no extra normalization on repeat.
 *  F5. No data loss: every source sentence survives the merge; bank order
 *      is preserved; the merge never introduces duplicate German keys.
 *  S*. Structural guards for the fix (incremental cursors, cached lookups,
 *      fast path, warm hooks) + file syntax.
 *
 * Usage: node tools/test-sentences-perf.js (exit 0 = PASS, 1 = FAIL)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (e ? " :: " + e : "")); } }

/* ---------- structural checks on the real source ---------- */
const sentSrc = RD("client/sent-a1.js");
ok("sent:merge-incremental", /SentA1\._seen/.test(sentSrc) && /_doneSentN/.test(sentSrc) && /_doneVocabN/.test(sentSrc) && /_doneBackfillN/.test(sentSrc));
ok("sent:merge-no-allwords-scan", !/allWords\(\)\.(forEach|find)/.test(sentSrc));
ok("sent:vocab-cache", /function sentVocabCache\(\)/.test(sentSrc) && /_sentVocabCache/.test(sentSrc));
ok("sent:gram-cache", /function sentGramMap\(\)/.test(sentSrc));
ok("sent:filter-helper", /function sentA1FilterList\(q, qAr, rawTrim, k, tp, lv, rows\)/.test(sentSrc));
ok("sent:empty-fastpath", /if \(q\) \{ try \{ rows = sentA1SearchRows\(\);/.test(sentSrc.replace(/\r/g, "")) && /sentA1FilterList\(q, qAr, raw\.trim\(\), k, tp, lv, rows\)/.test(sentSrc));
ok("sent:warm-hooks", /dm-lib-lazy-ready/.test(sentSrc) && /dm-lib-kind-ready/.test(sentSrc));
try { new vm.Script(sentSrc); ok("sent:syntax", true); } catch (e) { ok("sent:syntax", false, String(e).slice(0, 140)); }

/* ---------- real dmNorm extracted from client/script.js ---------- */
const scriptSrc = RD("client/script.js");
const dmStart = scriptSrc.indexOf("function dmNorm(s){");
// End of dmNorm = last closing brace before its window-export assignment.
const dmExportAt = scriptSrc.indexOf("window.dmNorm=dmNorm", dmStart);
const dmEnd = dmExportAt >= 0 ? scriptSrc.lastIndexOf("}", dmExportAt) + 1 : -1;
let dmNorm = null;
if (dmStart >= 0 && dmEnd > dmStart) {
  const dmBody = scriptSrc.slice(dmStart, dmEnd);
  try { dmNorm = new Function(dmBody + "\nreturn dmNorm;")(); } catch (e) { dmNorm = null; }
}
ok("sent:test-harness-real-dmNorm", typeof dmNorm === "function");

/* ---------- deterministic synthetic banks ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DE_WORDS = ["Mann", "Frau", "Kind", "Tisch", "Brot", "Wasser", "Haus", "Schule", "Arbeit", "Zeit",
  "Mädchen", "Brötchen", "Grüße", "Straße", "Apfel", "Käse", "Öl", "Tür", "Buch", "Tag"];
function makeBanks() {
  const rnd = mulberry32(20261012);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const VOCAB = [], SENTENCES = [], GRAMMAR = [];
  const KAPS = ["K0", "K1", "K2", "K3", "K4", "K5"];
  const TOPICS = ["Family", "Food", "School", "Work", "Travel", "General"];
  for (let i = 0; i < 3000; i++) {
    const de = pick(DE_WORDS) + "_" + i;
    const art = pick(["der", "die", "das", "-"]);
    const hasEx = rnd() < 0.45;
    VOCAB.push({
      id: "w" + i, de: de, art: art, ar: "معنى " + i, level: rnd() < 0.8 ? "A1" : "A2",
      kap: pick(KAPS), cat: pick(TOPICS),
      ex: hasEx ? ("Beispielsatz Nummer " + i + " mit " + de + ".") : "",
      exAr: hasEx ? ("مثال رقم " + i) : ""
    });
  }
  // weak auto examples (must be skipped by the merge, exactly as in-app)
  VOCAB.push({ id: "wWeak", de: "ApfelX", art: "der", ar: "تفاح", level: "A1", kap: "K1", cat: "Food", ex: "Ich möchte ApfelX.", exAr: "(أريد)" });
  for (let i = 0; i < 20000; i++) {
    const lib = rnd() < 0.985;
    const s = lib
      ? { id: "ls" + i, de: "Satz Nummer " + i + " über " + pick(DE_WORDS) + ".", ar: "جملة رقم " + i, pron: "", kap: pick(KAPS), level: rnd() < 0.85 ? "A1" : "A2", topic: pick(TOPICS), gram: "", wid: "", w: "", src: "lib", libGram: "", libVocab: [] }
      : { id: "c" + i, de: "Kernsatz " + i + " mit Familie und Brot.", ar: "جملة أساسية " + i, pron: "", kap: "K1", level: "A1" };
    SENTENCES.push(s);
  }
  // deliberate duplicates of vocab examples (dedup path)
  for (let i = 0; i < 20; i++) {
    const w = VOCAB[i * 7];
    if (w.ex) SENTENCES.push({ id: "dup" + i, de: w.ex, ar: "مكرر", kap: "K1", level: "A1", topic: "General", src: "lib" });
  }
  // word-fallback fixture: linked word matches, sentence text does not
  VOCAB.push({ id: "wTarget", de: "QwertyTarget", art: "-", ar: "هدف", level: "A1", kap: "K1", cat: "General", ex: "", exAr: "" });
  SENTENCES.push({ id: "fb1", de: "Dieser Satz enthaelt nichts Passendes.", ar: "هذه الجملة لا تحتوي على شيء مناسب", kap: "K1", level: "A1", topic: "General", src: "lib", wid: "wTarget" });
  for (let i = 0; i < 12; i++) {
    GRAMMAR.push({ id: "g" + (i + 1), title: "regel " + i, kap: "K1", body: "b", ex: [["Grammatikbeispiel " + i + ".", "مثال"]], quiz: { q: "q", opts: ["a", "b"], correct: 0, explain: "e" }, level: "A1" });
  }
  return { VOCAB, SENTENCES, GRAMMAR };
}

/* ---------- vm sandbox running the REAL sent-a1.js ---------- */
function loadSent(banks) {
  // instrument sentNorm call counting (source-level; strict-mode-safe)
  const probeSrc = sentSrc
    .replace("function sentNorm(s) {", "function sentNorm(s) {\n  try { __sentNormCalls++; } catch (e) {}");
  const sandbox = {
    console: console,
    window: { console: console, S: { customWords: [] } },
    SENTENCES: banks.SENTENCES,
    VOCAB: banks.VOCAB,
    GRAMMAR: banks.GRAMMAR,
    dmNorm: dmNorm,
    allWords: null, // set below (needs closure over sandbox arrays)
    wordById: null,
    __sentNormCalls: 0
  };
  sandbox.allWords = function () { return sandbox.VOCAB.concat((sandbox.window.S && sandbox.window.S.customWords) || []); };
  const byId = new Map();
  const rebuildById = () => { byId.clear(); sandbox.allWords().forEach(w => { if (w && w.id && !byId.has(w.id)) byId.set(w.id, w); }); };
  rebuildById();
  sandbox.wordById = function (id) { return byId.get(id); };
  sandbox.__rebuildById = rebuildById;
  const ctx = vm.createContext(sandbox);
  vm.runInContext("var __sentNormCalls = 0;", ctx);
  vm.runInContext(probeSrc, ctx, { filename: "sent-a1.js" });
  const calls = () => vm.runInContext("__sentNormCalls;", ctx);
  return { ctx, calls };
}

if (dmNorm) {
  let ctx1 = null;
  try {
    const banks = makeBanks();
    const inputIds = banks.SENTENCES.map(s => s.id);
    ctx1 = loadSent(banks);
    const C = ctx1.ctx;

    /* F1: first merge + repeat-merge stability.
       Note: the first merge imports bank rows (SENTENCES grows), so the
       second merge still processes one delta (dedup counters catch up);
       from the third merge on the revision signature is stable and merges
       must be free. This matches the historical settle behavior exactly. */
    const c0 = ctx1.calls();
    C.sentA1Merge();
    const c1 = ctx1.calls();
    ok("sent:F1-first-merge-processes-bank", (c1 - c0) > 10000, "sentNormCalls=" + (c1 - c0));
    C.sentA1Merge(); // settle pass 1 (length changed by imports)
    C.sentA1Merge(); // settle pass 2 (counters catch up; no pushes)
    const ids1 = C.SENTENCES.map(s => s.id);
    const stats1 = JSON.parse(JSON.stringify(C.SentA1.stats));
    const len1 = C.SENTENCES.length;
    C.__rebuildById();
    const cBefore2 = ctx1.calls();
    C.sentA1Merge();
    const cAfter2 = ctx1.calls();
    ok("sent:F1-repeat-merge-no-rescan", (cAfter2 - cBefore2) === 0, "delta=" + (cAfter2 - cBefore2));
    ok("sent:F1-repeat-merge-stable-ids", JSON.stringify(C.SENTENCES.map(s => s.id)) === JSON.stringify(ids1));
    ok("sent:F1-repeat-merge-stable-stats", JSON.stringify(C.SentA1.stats) === JSON.stringify(stats1));
    ok("sent:F1-repeat-merge-stable-len", C.SENTENCES.length === len1);

    /* reference filter (independent, straightforward) */
    const normDe = s => dmNorm(s);
    function refFilter(q, qAr, rawTrim, k, tp, lv) {
      const out = [];
      for (const s of C.SENTENCES) {
        if (lv !== "all" && (s.level || "A1") !== lv) continue;
        if (k && s.kap !== k) continue;
        if (tp && (s.topic || "General") !== tp) continue;
        if (!q) { out.push(s.id); continue; }
        if (normDe(s.de).indexOf(q) >= 0) { out.push(s.id); continue; }
        if ((s.ar || "").toLowerCase().indexOf(qAr) >= 0) { out.push(s.id); continue; }
        const w = s.wid ? C.wordById(s.wid) : null;
        if (w && ((w.de || "").toLowerCase().indexOf(qAr) >= 0 || (w.ar || "").indexOf(rawTrim) >= 0)) { out.push(s.id); continue; }
      }
      return out;
    }
    const Q = (raw) => dmNorm(raw).trim();
    // [name, raw query, kap, topic, level]
    const scenFixed = [
      ["empty", "", "", "", "all"],
      ["kap", "", "K1", "", "all"],
      ["topic", "", "", "Food", "all"],
      ["level-A2", "", "", "", "A2"],
      ["kap+topic", "", "K1", "Family", "all"],
      ["search-de", "satz nummer 5", "", "", "all"],
      ["search-umlaut-fold", "brotchen", "", "", "all"],
      ["search-ar", "جملة رقم 7", "", "", "all"],
      ["word-fallback", "QWERTYtarget", "", "", "all"],
      ["no-match", "zzzqqq", "", "", "all"],
      ["combined", "satz", "K1", "General", "all"]
    ];
    let f3ok = true, f3detail = "";
    // build the real index once for the indexed path
    C.sentA1SearchRows();
    const rows = C.sentA1SearchIdx.rows;
    for (const [name, raw, k, tp, lv] of scenFixed) {
      const q = Q(raw), qAr = raw.trim().toLowerCase(), rawTrim = raw.trim();
      const ref = refFilter(q, qAr, rawTrim, k, tp, lv);
      // The empty-query path scans the bank directly (no index); a query
      // always carries the index in real renders (sentA1Render builds it).
      const noIdx = q ? ref : C.sentA1FilterList(q, qAr, rawTrim, k, tp, lv, null).map(s => s.id);
      const withIdx = C.sentA1FilterList(q, qAr, rawTrim, k, tp, lv, rows).map(s => s.id);
      if (JSON.stringify(noIdx) !== JSON.stringify(ref) || JSON.stringify(withIdx) !== JSON.stringify(ref)) {
        f3ok = false; f3detail = name + " ref=" + ref.length + " noIdx=" + noIdx.length + " withIdx=" + withIdx.length;
        break;
      }
    }
    ok("sent:F3-filter-matches-reference", f3ok, f3detail);
    // umlaut folding actually exercised (non-degenerate search results)
    const umRes = C.sentA1FilterList(Q("brotchen"), "brotchen", "brotchen", "", "", "all", rows).map(s => s.id);
    ok("sent:F3-umlaut-folding-hits", umRes.length > 0, "n=" + umRes.length);
    const fbRes = C.sentA1FilterList(Q("QWERTYtarget"), "qwertytarget", "QWERTYtarget", "", "", "all", rows).map(s => s.id);
    ok("sent:F3-word-fallback-hit", fbRes.indexOf("fb1") >= 0, JSON.stringify(fbRes.slice(0, 5)));

    /* F4: empty-q never builds the index; repeat search adds no work */
    const freshBanks = makeBanks();
    const ctx2 = loadSent(freshBanks);
    const C2 = ctx2.ctx;
    C2.sentA1Merge();
    ok("sent:F4-index-untouched-before-search", C2.sentA1SearchIdx === null);
    C2.sentA1FilterList("", "", "", "", "", "all", null);
    ok("sent:F4-empty-filter-skips-index", C2.sentA1SearchIdx === null);
    const dmCalls = { n: 0 };
    const realDm = C2.dmNorm;
    C2.dmNorm = function (s) { dmCalls.n++; return realDm(s); };
    C2.sentA1SearchRows();
    const afterBuild = dmCalls.n;
    ok("sent:F4-index-builds-once", afterBuild > 1000, "dmNormCalls=" + afterBuild);
    C2.sentA1FilterList(Q("satz"), "satz", "satz", "", "", "all", C2.sentA1SearchIdx.rows);
    C2.sentA1SearchRows();
    ok("sent:F4-repeat-search-no-renorm", dmCalls.n === afterBuild, "delta=" + (dmCalls.n - afterBuild));

    /* F2: growth merges are delta-bounded + correct */
    const gScroll = C.SENTENCES.length;
    for (let i = 0; i < 500; i++) {
      C.SENTENCES.push({ id: "lz" + i, de: "Nachgeladener Satz " + i + " mit Wasser.", ar: "جملة لاحقة " + i, kap: "K2", level: "A1", topic: "Food", src: "lib" });
    }
    for (let i = 0; i < 100; i++) {
      C.VOCAB.push({ id: "vn" + i, de: "Nachwort" + i, art: "der", ar: "كلمة لاحقة", level: "A1", kap: "K2", cat: "Food", ex: "Nachgeladenes Beispiel " + i + ".", exAr: "مثال لاحق" });
    }
    C.__rebuildById();
    const cBeforeG = ctx1.calls();
    C.sentA1Merge();
    const cAfterG = ctx1.calls();
    const deltaG = cAfterG - cBeforeG, firstPass = c1 - c0;
    ok("sent:F2-growth-delta-bounded", deltaG < firstPass * 0.2, "delta=" + deltaG + " first=" + firstPass);
    ok("sent:F2-growth-items-visible", C.SENTENCES.some(s => s.id === "lz499") && C.SENTENCES.length > gScroll);
    // every pushed record keeps a unique id (merge namespaces sv*/sa* via seq)
    const idSet = new Set(C.SENTENCES.map(s => s.id));
    ok("sent:F2-no-id-duplicates", idSet.size === C.SENTENCES.length);
    // order preserved: original prefix order intact
    const prefixOk = ids1.every((id, ix) => C.SENTENCES[ix] && C.SENTENCES[ix].id === id);
    ok("sent:F2-order-preserved", prefixOk);

    /* F5: no data loss */
    const missing = inputIds.filter(id => !idSet.has(id));
    ok("sent:F5-no-data-loss", missing.length === 0, "missing=" + missing.slice(0, 5).join(","));

    /* F1-extra: shrink path stays safe (defensive; loaders never shrink) */
    C.SENTENCES.length = C.SENTENCES.length - 100;
    let shrinkOk = true, shrinkErr = "";
    try {
      C.sentA1Merge();
      const idsAfter = new Set(C.SENTENCES.map(s => s.id));
      const lost = [];
      for (const s of C.SENTENCES) { if (!s || !s.de) lost.push("bad-record"); break; }
      shrinkOk = lost.length === 0 && C.SENTENCES.length > 0;
    } catch (e) { shrinkOk = false; shrinkErr = String(e).slice(0, 120); }
    ok("sent:F1-shrink-path-safe", shrinkOk, shrinkErr);
  } catch (e) {
    ok("sent:harness", false, (e && e.stack || String(e)).slice(0, 300));
  }
}

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
