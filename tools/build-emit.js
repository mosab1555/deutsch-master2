/* Stage 7 — EMIT: validated caches -> client/content/src/*.json (source of truth),
   client/content/dm-*.js (runtime packs: CORE sync/defer + LAZY on-demand),
   client/content/dm-lazy.js (lazy loader + pack index), manifest.json.
   Core packs preserve baseline boot (same names/order); lazy packs push to
   __dmLazyChunks and merge via dm-lazy. Run: node tools/build-emit.js */
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const cache = path.join(__dirname, "clib", ".cache");
const outDir = path.join(root, "client", "content");
const srcDir = path.join(outDir, "src");
fs.mkdirSync(srcDir, { recursive: true });

const vocab = JSON.parse(fs.readFileSync(path.join(cache, "vocab.json"), "utf8"));
const sentences = JSON.parse(fs.readFileSync(path.join(cache, "sentences.json"), "utf8"));
const grammar = JSON.parse(fs.readFileSync(path.join(cache, "grammar.json"), "utf8"));
const exercises = JSON.parse(fs.readFileSync(path.join(cache, "exercises.json"), "utf8"));
const dialogues = JSON.parse(fs.readFileSync(path.join(cache, "dialogues.json"), "utf8"));
const R = (f) => { try { return JSON.parse(fs.readFileSync(path.join(cache, f), "utf8")); } catch (e) { return []; } };
const reading = R("reading.json"), listening = R("listening.json"), exams = R("exams.json");

/* sentence examples for vocab cards: invert sentence->vocab refs */
const sentByVocab = new Map();
sentences.forEach((s) => {
  (s.vocab || []).forEach((vid) => {
    if (!sentByVocab.has(vid)) sentByVocab.set(vid, s);
  });
});
vocab.forEach((w) => {
  const s = sentByVocab.get(w.id);
  w.ex = s ? s.de : "";
  w.exAr = s ? s.ar : "";
});

/* [kind, array, coreSizes[], lazyRows, prefix] — core shards keep baseline
   names/order/registry (boot path identical); rest lazy via __dmLazyChunks */
const CORE_LOAD = { vocab: "sync", sent: "sync", gram: "sync", dlg: "sync", ex: "defer" };
const plan = [
  ["vocab", vocab, [2500, 2500], 5000, "vocab"],
  ["sent", sentences, [4000, 4000, 4000], 5000, "sent"],
  ["gram", grammar, [900], 2500, "gram"],
  ["ex", exercises, [7550, 7550, 7550, 7550], 8000, "ex"],
  ["dlg", dialogues, [1000], 4500, "dlg"],
  ["read", reading, [], 5000, "read"],
  ["lis", listening, [], 5000, "lis"],
  ["exam", exams, [], 5000, "exam"],
];
function compact(kind, o) {
  if (kind === "vocab") return [o.id, o.de, o.art, o.ar, o.en || "", o.level, o.cat, o.type, o.plural || "", o.head || "", o.ex || "", o.exAr || ""];
  if (kind === "sent") return [o.id, o.de, o.ar, o.level, o.topic, o.kap, (o.gram || [])[0] || "", (o.vocab || []).join(",")];
  if (kind === "ex") return [o.id, o.type, o.prompt, o.choices, o.answer, o.level, (o.ref || []).join(","), o.kind || "fill", o.kap || "", o.words || o.lines || 0, o.why || ""];
  if (kind === "dlg") return [o.id, o.level, o.topic, o.titleDe, o.titleAr, o.lines];
  if (kind === "read") return [o.id, o.level, o.topic, o.titleDe, o.titleAr, o.de, o.ar, o.questions, (o.vocab || []).join(","), (o.grammar || []).join(",")];
  if (kind === "lis") return [o.id, o.level, o.topic, o.titleDe, o.titleAr, o.lines, o.questions, (o.audio && o.audio.rate) || 1];
  if (kind === "exam") return o;
  return o;
}
const manifest = { version: 2, seed: "deutsch-master-library-v2", generated: new Date().toISOString(), files: [], counts: {}, lazyIndex: [] };
const counters = {};
plan.forEach(([kind, arr, coreSizes, lazyN, prefix]) => {
  manifest.counts[kind] = arr.length;
  let idx = 0, pos = 0;
  const chunks = [];
  coreSizes.forEach((nCore) => {
    if (pos >= arr.length) return;
    const n = Math.min(nCore, arr.length - pos);
    chunks.push({ rows: arr.slice(pos, pos + n), load: CORE_LOAD[kind] || "sync" });
    pos += n;
  });
  while (pos < arr.length) {
    const n = Math.min(lazyN, arr.length - pos);
    chunks.push({ rows: arr.slice(pos, pos + n), load: "lazy" });
    pos += n;
  }
  chunks.forEach((ch, i) => {
    idx++;
    const base = prefix + "-" + String(idx).padStart(2, "0");
    fs.writeFileSync(path.join(srcDir, base + ".json"), JSON.stringify({ kind, rows: ch.rows }));
    const rrows = ch.rows.map((o) => compact(kind, o));
    const reg = ch.load === "lazy" ? "__dmLazyChunks" : "__dmLibChunks";
    const js = "(function(){var C=window." + reg + "=window." + reg + "||{vocab:[],sent:[],gram:[],ex:[],dlg:[],read:[],lis:[],exam:[]};" +
      "C[" + JSON.stringify(kind) + "].push(" + JSON.stringify(rrows) + ");})();";
    const runtime = "content/dm-" + base + ".js";
    fs.writeFileSync(path.join(outDir, "dm-" + base + ".js"), js);
    const bytes = fs.statSync(path.join(outDir, "dm-" + base + ".js")).size;
    const entry = { src: "content/src/" + base + ".json", runtime, kind, count: ch.rows.length, load: ch.load, bytes };
    manifest.files.push(entry);
    if (ch.load === "lazy") manifest.lazyIndex.push({ file: runtime, kind, count: ch.rows.length, bytes });
    counters[kind] = (counters[kind] || 0) + ch.rows.length;
  });
});
/* dm-lazy.js: loader + late merger + extended search + bounded idle prefetch */
const lazyJs = `"use strict";
/* Deutsch Master — lazy content packs (ADDITIVE ONLY, never throws).
   Merges __dmLazyChunks into live globals, prefetches small packs when idle,
   exposes DM_LIB_MORE (loader + extended search). */
(function () {
  var PACKS = __DM_LAZY_INDEX__;
  var mergedIds = {};
  function mark(kind, id) {
    var k = kind + ":" + id;
    if (mergedIds[k]) return false;
    mergedIds[k] = 1;
    return true;
  }
  function flat(a) { var o = []; for (var i = 0; i < a.length; i++) for (var j = 0; j < a[i].length; j++) o.push(a[i][j]); return o; }
  function kapForLevel(level, id) {
    if (level === "A1") { var n = 0; for (var i = 0; i < id.length; i++) n += id.charCodeAt(i); return "K" + (1 + (n % 5)); }
    return "KX";
  }
  window.DM_LIB_MORE = window.DM_LIB_MORE || { loadedPacks: [], lazyTotal: PACKS.length };
  function mergeAll() {
    try {
      var S = window.__dmLazyChunks || {};
      var V = flat(S.vocab || []), SR = flat(S.sent || []), G = flat(S.gram || []),
          E = flat(S.ex || []), D = flat(S.dlg || []), RD = flat(S.read || []),
          L = flat(S.lis || []), X = flat(S.exam || []);
      var i, r;
      if (typeof VOCAB !== "undefined" && VOCAB && VOCAB.push) {
        var have = {}; try { VOCAB.forEach(function (w) { have[w.id] = 1; }); } catch (e) {}
        for (i = 0; i < V.length; i++) { r = V[i];
          if (have[r[0]] || !mark("v", r[0])) continue;
          VOCAB.push({ id: r[0], de: r[1], art: r[2], ar: r[3], en: r[4] || "", level: r[5] || "A1", cat: r[6], type: r[7], plural: r[8] || "", pron: "", ex: r[10] || "", exAr: r[11] || "", kap: kapForLevel(r[5] || "A1", r[0]), libHead: r[9] || "", libType: r[7] });
        }
      }
      if (typeof SENTENCES !== "undefined" && SENTENCES && SENTENCES.push) {
        var sh = {}; try { SENTENCES.forEach(function (x) { sh[x.id] = 1; }); } catch (e) {}
        for (i = 0; i < SR.length; i++) { r = SR[i];
          if (sh[r[0]] || !mark("s", r[0])) continue;
          SENTENCES.push({ id: r[0], de: r[1], ar: r[2], pron: "", kap: r[5] || kapForLevel(r[3], r[0]), level: r[3], topic: r[4], gram: "", wid: "", w: "", src: "lib", libGram: r[6] || "", libVocab: r[7] ? String(r[7]).split(",") : [] });
        }
      }
      if (typeof GRAMMAR !== "undefined" && GRAMMAR && GRAMMAR.push) {
        var gh = {}; try { GRAMMAR.forEach(function (x) { gh[x.id] = 1; }); } catch (e) {}
        for (i = 0; i < G.length; i++) { var g = G[i];
          if (!g || !g.id || gh[g.id] || !mark("g", g.id)) continue;
          GRAMMAR.push({ id: g.id, title: g.title, kap: g.kap, body: g.body, ex: g.examples, quiz: g.quiz, level: g.level, libTopic: g.topicId, libCat: g.cat, libKind: g.kind, src: "lib" });
        }
      }
      if (typeof SENT_FILL !== "undefined" && SENT_FILL && SENT_FILL.push) {
        var fh = {}; try { SENT_FILL.forEach(function (x) { fh[x.id] = 1; }); } catch (e) {}
        for (i = 0; i < E.length; i++) { var q = E[i];
          if (!q || !q[0] || fh[q[0]] || !mark("e", q[0])) continue;
          var ekind = q[7] === "order" ? "order" : "fill";
          var F = { id: q[0], s: q[2], o: q[3], c: q[4], why: q[10] || "", lvl: q[5] || "A1", pos: "mid", typ: q[1], kind: ekind, ctx: "lib", start: String(q[2] || "").split(" ")[0], w: "", chapterId: q[8] || "KX", chapterName: "Library", chapterSrc: "lib", lessonId: null, lessonName: "Library " + (q[5] || "A1"), structureType: ekind === "order" ? "order" : "gap", subjectType: "-", grammarTarget: q[1], sentenceStarter: String(q[2] || "").split(" ")[0], answerType: q[1], blankPosition: "mid", libType: q[1], libRefIds: String(q[6] || "").split(",").filter(Boolean), libWords: null, libLines: null };
          var wl = q[9];
          if (wl && typeof wl !== "number") { if (ekind === "order") F.libWords = wl; else F.libLines = wl; }
          SENT_FILL.push(F);
        }
        try { window.dispatchEvent(new Event("dm-lib-ex-ready")); } catch (e) {}
      }
      var DROWS = [];
      for (i = 0; i < D.length; i++) { var dr = D[i];
        if (!dr || !dr[0] || !mark("d", dr[0])) continue;
        DROWS.push({ id: dr[0], level: dr[1], topic: dr[2], titleDe: dr[3], titleAr: dr[4], lines: dr[5] });
      }
      if (DROWS.length) {
        window.DM_DIALOGS = (window.DM_DIALOGS || []).concat(DROWS);
        try { window.dispatchEvent(new Event("dm-lib-dlg-ready")); } catch (e) {}
      }
      var RROWS = [];
      for (i = 0; i < RD.length; i++) { var rd = RD[i];
        if (!rd || !rd[0] || !mark("r", rd[0])) continue;
        RROWS.push(rd);
      }
      if (typeof CURR_READING !== "undefined" && CURR_READING && CURR_READING.push) {
        var rh = {}; try { CURR_READING.forEach(function (x) { rh[x.id] = 1; }); } catch (e) {}
        RROWS.forEach(function (rd) {
          if (rh[rd[0]]) return;
          CURR_READING.push({ id: rd[0], level: rd[1], kap: "", title: rd[4], de: rd[5], ar: rd[6],
            qs: (rd[7] || []).map(function (qq) { return { q: qq.q, opts: qq.choices, correct: qq.answer }; }) });
        });
      }
      window.DM_READING = (window.DM_READING || []).concat(RROWS);
      var LROWS = [];
      for (i = 0; i < L.length; i++) { var lr = L[i];
        if (!lr || !lr[0] || !mark("l", lr[0])) continue;
        LROWS.push({ id: lr[0], level: lr[1], topic: lr[2], titleDe: lr[3], titleAr: lr[4], lines: lr[5],
          qs: (lr[6] || []).map(function (qq) { return { q: qq.q, opts: qq.choices, correct: qq.answer }; }), rate: lr[7] || 1 });
      }
      window.DM_LISTENING = (window.DM_LISTENING || []).concat(LROWS);
      var XROWS = [];
      for (i = 0; i < X.length; i++) { var xr = X[i];
        if (!xr || !xr.id || !mark("x", xr.id)) continue;
        XROWS.push(xr);
      }
      window.DM_EXAMS = (window.DM_EXAMS || []).concat(XROWS);
      try { window.dispatchEvent(new Event("dm-lib-lazy-ready")); } catch (e) {}
    } catch (e) {}
  }
  window.DM_LIB_MORE.merge = mergeAll;
  window.DM_LIB_MORE.loadPack = function (file) {
    return new Promise(function (resolve) {
      try {
        if (window.DM_LIB_MORE.loadedPacks.indexOf(file) >= 0) return resolve(true);
        var sc = document.createElement("script");
        sc.src = file;
        sc.onload = function () {
          try { window.DM_LIB_MORE.loadedPacks.push(file); } catch (e) {}
          try { mergeAll(); } catch (e) {}
          resolve(true);
        };
        sc.onerror = function () { resolve(false); };
        (document.head || document.documentElement).appendChild(sc);
      } catch (e) { resolve(false); }
    });
  };
  window.DM_LIB_MORE.loadKind = function (kind) {
    var files = PACKS.filter(function (p) { return p.kind === kind; }).map(function (p) { return p.file; });
    var chain = Promise.resolve(true);
    files.forEach(function (f) { chain = chain.then(function () { return window.DM_LIB_MORE.loadPack(f); }); });
    return chain;
  };
  /* extended search across lazy rows (own index; merged with DM_LIB.search) */
  var lzIndex = null, lzRows = { v: {}, s: {}, g: {}, r: {}, l: {} };
  function normQ(s) { return String(s || "").toLowerCase().replace(/[؟?!.,;:«»"„“]/g, " ").replace(/\\s+/g, " ").trim(); }
  function buildLz() {
    lzIndex = { tok: {} };
    function addTok(key, id, score) {
      var ks = key.split(" ").filter(Boolean).slice(0, 8);
      for (var i = 0; i < ks.length; i++) {
        var t = ks[i].slice(0, 12);
        if (t.length < 2) continue;
        (lzIndex.tok[t] = lzIndex.tok[t] || []).push([id, score]);
      }
    }
    var S = window.__dmLazyChunks || {};
    function flat(a) { var o = []; for (var i = 0; i < a.length; i++) for (var j = 0; j < a[i].length; j++) o.push(a[i][j]); return o; }
    flat(S.vocab || []).forEach(function (r) { lzRows.v[r[0]] = r; addTok(normQ(r[1]) + " " + normQ(r[3]), "v:" + r[0], 3); });
    flat(S.sent || []).forEach(function (r) { lzRows.s[r[0]] = r; addTok(normQ(r[1]), "s:" + r[0], 2); });
    flat(S.gram || []).forEach(function (g) { if (g && g.id) { lzRows.g[g.id] = g; addTok(normQ(g.title), "g:" + g.id, 2); } });
    flat(S.read || []).forEach(function (r) { lzRows.r[r[0]] = r; addTok(normQ(r[3]) + " " + normQ(r[5]), "r:" + r[0], 2); });
    flat(S.lis || []).forEach(function (r) { lzRows.l[r[0]] = r; addTok(normQ(r[3]), "l:" + r[0], 2); });
  }
  window.DM_LIB_MORE.searchAll = function (q, opt) {
    opt = opt || {};
    var base = [];
    try { if (window.DM_LIB) base = window.DM_LIB.search(q, opt) || []; } catch (e) {}
    try {
      if (!lzIndex) buildLz();
      var nq = normQ(q);
      if (!nq) return base;
      var toks = nq.split(" ").filter(Boolean).slice(0, 4);
      var hits = {}, first = lzIndex.tok[toks[0].slice(0, 12)] || [];
      for (var i = 0; i < first.length; i++) hits[first[i][0]] = (hits[first[i][0]] || 0) + first[i][1];
      for (var t2 = 1; t2 < toks.length; t2++) {
        var arr = lzIndex.tok[toks[t2].slice(0, 12)] || [];
        for (var j = 0; j < arr.length; j++) if (hits[arr[j][0]]) hits[arr[j][0]] += arr[j][1];
      }
      var have = {};
      base.forEach(function (b) { have[b.kind + ":" + b.id] = 1; });
      Object.keys(hits).forEach(function (id) {
        var kind = id.slice(0, 2), rid = id.slice(2);
        var map = kind === "v:" ? lzRows.v : kind === "s:" ? lzRows.s : kind === "g:" ? lzRows.g : kind === "r:" ? lzRows.r : lzRows.l;
        var rec = map[rid];
        if (!rec || have[(kind === "v:" ? "vocab" : kind === "s:" ? "sentence" : kind === "g:" ? "grammar" : kind === "r:" ? "reading" : "listening") + ":" + rid]) return;
        base.push({ id: rid, kind: kind === "v:" ? "vocab" : kind === "s:" ? "sentence" : kind === "g:" ? "grammar" : kind === "r:" ? "reading" : "listening", score: hits[id], rec: rec });
      });
      base.sort(function (a, b) { return b.score - a.score; });
      return base.slice(0, opt.limit || 60);
    } catch (e) { return base; }
  };
  /* bounded idle prefetch: smallest lazy packs first (never exercises), cap ~12MB */
  function idlePrefetch() {
    try {
      var cands = PACKS.filter(function (p) { return p.kind !== "ex"; }).sort(function (a, b) { return a.bytes - b.bytes; });
      var budget = 12 * 1024 * 1024, chain = Promise.resolve(true);
      cands.forEach(function (p) {
        if (p.bytes > budget) return;
        budget -= p.bytes;
        chain = chain.then(function () { return window.DM_LIB_MORE.loadPack(p.file); });
      });
    } catch (e) {}
  }
  try { mergeAll(); } catch (e) {}
  try {
    if (document.readyState === "complete") setTimeout(idlePrefetch, 4000);
    else window.addEventListener("load", function () { setTimeout(idlePrefetch, 4000); });
  } catch (e) {}
})();
`;
fs.writeFileSync(path.join(outDir, "dm-lazy.js"), lazyJs.replace("__DM_LAZY_INDEX__", JSON.stringify(manifest.lazyIndex)));
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log("shards:", manifest.files.map((f) => f.runtime + "=" + f.count + ":" + f.load).join(" "));
console.log("counts:", JSON.stringify(manifest.counts));
let bytes = 0, lazyBytes = 0;
manifest.files.forEach((f) => {
  const s = fs.statSync(path.join(root, "client", f.runtime)).size;
  bytes += s;
  if (f.load === "lazy") lazyBytes += s;
});
console.log("runtime bytes:", bytes, "lazy bytes:", lazyBytes);
