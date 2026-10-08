"use strict";
/* Deutsch Master — lazy content packs (ADDITIVE ONLY, never throws).
   Merges __dmLazyChunks into live globals, prefetches small packs when idle,
   exposes DM_LIB_MORE (loader + extended search). */
(function () {
  var PACKS = [{"file":"content/dm-vocab-03.js","kind":"vocab","count":5000,"bytes":661063},{"file":"content/dm-vocab-04.js","kind":"vocab","count":4901,"bytes":608780},{"file":"content/dm-sent-04.js","kind":"sent","count":5000,"bytes":864501},{"file":"content/dm-sent-05.js","kind":"sent","count":5000,"bytes":866545},{"file":"content/dm-sent-06.js","kind":"sent","count":5000,"bytes":866825},{"file":"content/dm-sent-07.js","kind":"sent","count":5000,"bytes":867610},{"file":"content/dm-sent-08.js","kind":"sent","count":5000,"bytes":869219},{"file":"content/dm-sent-09.js","kind":"sent","count":5000,"bytes":872488},{"file":"content/dm-sent-10.js","kind":"sent","count":5000,"bytes":869830},{"file":"content/dm-sent-11.js","kind":"sent","count":5000,"bytes":871020},{"file":"content/dm-sent-12.js","kind":"sent","count":5000,"bytes":872031},{"file":"content/dm-sent-13.js","kind":"sent","count":5000,"bytes":871796},{"file":"content/dm-sent-14.js","kind":"sent","count":5000,"bytes":874375},{"file":"content/dm-sent-15.js","kind":"sent","count":5000,"bytes":872627},{"file":"content/dm-sent-16.js","kind":"sent","count":5000,"bytes":871900},{"file":"content/dm-sent-17.js","kind":"sent","count":5000,"bytes":873538},{"file":"content/dm-sent-18.js","kind":"sent","count":5000,"bytes":873101},{"file":"content/dm-sent-19.js","kind":"sent","count":5000,"bytes":876319},{"file":"content/dm-sent-20.js","kind":"sent","count":5000,"bytes":881116},{"file":"content/dm-sent-21.js","kind":"sent","count":5000,"bytes":878357},{"file":"content/dm-sent-22.js","kind":"sent","count":5000,"bytes":882366},{"file":"content/dm-sent-23.js","kind":"sent","count":5000,"bytes":880515},{"file":"content/dm-sent-24.js","kind":"sent","count":5000,"bytes":879706},{"file":"content/dm-sent-25.js","kind":"sent","count":5000,"bytes":878532},{"file":"content/dm-sent-26.js","kind":"sent","count":5000,"bytes":881325},{"file":"content/dm-sent-27.js","kind":"sent","count":5000,"bytes":881099},{"file":"content/dm-sent-28.js","kind":"sent","count":5000,"bytes":879910},{"file":"content/dm-sent-29.js","kind":"sent","count":5000,"bytes":879183},{"file":"content/dm-sent-30.js","kind":"sent","count":5000,"bytes":880685},{"file":"content/dm-sent-31.js","kind":"sent","count":3000,"bytes":528516},{"file":"content/dm-gram-02.js","kind":"gram","count":2169,"bytes":2238246},{"file":"content/dm-ex-05.js","kind":"ex","count":8000,"bytes":1991791},{"file":"content/dm-ex-06.js","kind":"ex","count":8000,"bytes":1864919},{"file":"content/dm-ex-07.js","kind":"ex","count":8000,"bytes":1963735},{"file":"content/dm-ex-08.js","kind":"ex","count":8000,"bytes":1925359},{"file":"content/dm-ex-09.js","kind":"ex","count":8000,"bytes":1923874},{"file":"content/dm-ex-10.js","kind":"ex","count":8000,"bytes":1493366},{"file":"content/dm-ex-11.js","kind":"ex","count":8000,"bytes":1822257},{"file":"content/dm-ex-12.js","kind":"ex","count":8000,"bytes":1874756},{"file":"content/dm-ex-13.js","kind":"ex","count":8000,"bytes":1878507},{"file":"content/dm-ex-14.js","kind":"ex","count":8000,"bytes":1886839},{"file":"content/dm-ex-15.js","kind":"ex","count":8000,"bytes":1890719},{"file":"content/dm-ex-16.js","kind":"ex","count":8000,"bytes":1892380},{"file":"content/dm-ex-17.js","kind":"ex","count":8000,"bytes":1891254},{"file":"content/dm-ex-18.js","kind":"ex","count":8000,"bytes":1893575},{"file":"content/dm-ex-19.js","kind":"ex","count":8000,"bytes":1896516},{"file":"content/dm-ex-20.js","kind":"ex","count":8000,"bytes":1893065},{"file":"content/dm-ex-21.js","kind":"ex","count":8000,"bytes":1895489},{"file":"content/dm-ex-22.js","kind":"ex","count":8000,"bytes":1903070},{"file":"content/dm-ex-23.js","kind":"ex","count":8000,"bytes":1904363},{"file":"content/dm-ex-24.js","kind":"ex","count":8000,"bytes":1908681},{"file":"content/dm-ex-25.js","kind":"ex","count":8000,"bytes":1904057},{"file":"content/dm-ex-26.js","kind":"ex","count":8000,"bytes":1905786},{"file":"content/dm-ex-27.js","kind":"ex","count":8000,"bytes":1906290},{"file":"content/dm-ex-28.js","kind":"ex","count":8000,"bytes":1903067},{"file":"content/dm-ex-29.js","kind":"ex","count":8000,"bytes":1904989},{"file":"content/dm-ex-30.js","kind":"ex","count":8000,"bytes":1900342},{"file":"content/dm-ex-31.js","kind":"ex","count":8000,"bytes":1906841},{"file":"content/dm-ex-32.js","kind":"ex","count":8000,"bytes":1908714},{"file":"content/dm-ex-33.js","kind":"ex","count":8000,"bytes":1911482},{"file":"content/dm-ex-34.js","kind":"ex","count":8000,"bytes":1914913},{"file":"content/dm-ex-35.js","kind":"ex","count":8000,"bytes":1913901},{"file":"content/dm-ex-36.js","kind":"ex","count":8000,"bytes":1915565},{"file":"content/dm-ex-37.js","kind":"ex","count":8000,"bytes":1917871},{"file":"content/dm-ex-38.js","kind":"ex","count":8000,"bytes":1915779},{"file":"content/dm-ex-39.js","kind":"ex","count":8000,"bytes":1918309},{"file":"content/dm-ex-40.js","kind":"ex","count":8000,"bytes":1921784},{"file":"content/dm-ex-41.js","kind":"ex","count":8000,"bytes":1926889},{"file":"content/dm-ex-42.js","kind":"ex","count":8000,"bytes":1930481},{"file":"content/dm-ex-43.js","kind":"ex","count":8000,"bytes":1928102},{"file":"content/dm-ex-44.js","kind":"ex","count":8000,"bytes":1927333},{"file":"content/dm-ex-45.js","kind":"ex","count":8000,"bytes":1929767},{"file":"content/dm-ex-46.js","kind":"ex","count":8000,"bytes":1927726},{"file":"content/dm-ex-47.js","kind":"ex","count":8000,"bytes":1928991},{"file":"content/dm-ex-48.js","kind":"ex","count":8000,"bytes":2119379},{"file":"content/dm-ex-49.js","kind":"ex","count":8000,"bytes":2126963},{"file":"content/dm-ex-50.js","kind":"ex","count":8000,"bytes":2130267},{"file":"content/dm-ex-51.js","kind":"ex","count":8000,"bytes":2126087},{"file":"content/dm-ex-52.js","kind":"ex","count":8000,"bytes":2137389},{"file":"content/dm-ex-53.js","kind":"ex","count":8000,"bytes":2134753},{"file":"content/dm-ex-54.js","kind":"ex","count":8000,"bytes":2062020},{"file":"content/dm-ex-55.js","kind":"ex","count":8000,"bytes":1863981},{"file":"content/dm-ex-56.js","kind":"ex","count":8000,"bytes":1864045},{"file":"content/dm-ex-57.js","kind":"ex","count":8000,"bytes":1862973},{"file":"content/dm-ex-58.js","kind":"ex","count":8000,"bytes":1863683},{"file":"content/dm-ex-59.js","kind":"ex","count":8000,"bytes":1869626},{"file":"content/dm-ex-60.js","kind":"ex","count":8000,"bytes":1873177},{"file":"content/dm-ex-61.js","kind":"ex","count":8000,"bytes":1874607},{"file":"content/dm-ex-62.js","kind":"ex","count":8000,"bytes":2315094},{"file":"content/dm-ex-63.js","kind":"ex","count":8000,"bytes":3504912},{"file":"content/dm-ex-64.js","kind":"ex","count":8000,"bytes":3499532},{"file":"content/dm-ex-65.js","kind":"ex","count":8000,"bytes":3513061},{"file":"content/dm-ex-66.js","kind":"ex","count":8000,"bytes":3503002},{"file":"content/dm-ex-67.js","kind":"ex","count":8000,"bytes":3511637},{"file":"content/dm-ex-68.js","kind":"ex","count":8000,"bytes":3507225},{"file":"content/dm-ex-69.js","kind":"ex","count":8000,"bytes":3917779},{"file":"content/dm-ex-70.js","kind":"ex","count":8000,"bytes":5621954},{"file":"content/dm-ex-71.js","kind":"ex","count":8000,"bytes":2019252},{"file":"content/dm-ex-72.js","kind":"ex","count":8000,"bytes":1858136},{"file":"content/dm-ex-73.js","kind":"ex","count":8000,"bytes":1925701},{"file":"content/dm-ex-74.js","kind":"ex","count":8000,"bytes":1922558},{"file":"content/dm-ex-75.js","kind":"ex","count":8000,"bytes":1928523},{"file":"content/dm-ex-76.js","kind":"ex","count":6673,"bytes":1605887},{"file":"content/dm-dlg-02.js","kind":"dlg","count":4500,"bytes":2668170},{"file":"content/dm-dlg-03.js","kind":"dlg","count":4500,"bytes":2888146},{"file":"content/dm-read-01.js","kind":"read","count":5000,"bytes":5725999},{"file":"content/dm-lis-01.js","kind":"lis","count":5000,"bytes":3339401},{"file":"content/dm-lis-02.js","kind":"lis","count":5000,"bytes":3334686},{"file":"content/dm-exam-01.js","kind":"exam","count":5000,"bytes":1405637},{"file":"content/dm-exam-02.js","kind":"exam","count":5000,"bytes":1406941}];
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
  function normQ(s) { return String(s || "").toLowerCase().replace(/[؟?!.,;:«»"„“]/g, " ").replace(/\s+/g, " ").trim(); }
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
