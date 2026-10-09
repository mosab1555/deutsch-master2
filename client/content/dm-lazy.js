"use strict";
/* Deutsch Master — lazy content packs (ADDITIVE ONLY, never throws).
   Merges __dmLazyChunks into live globals, prefetches small packs when idle,
   exposes DM_LIB_MORE (loader + extended search). */
(function () {
  var PACKS = [{"file":"content/dm-vocab-03.js","kind":"vocab","count":5000,"bytes":662859},{"file":"content/dm-vocab-04.js","kind":"vocab","count":5000,"bytes":633024},{"file":"content/dm-vocab-05.js","kind":"vocab","count":5000,"bytes":1195950},{"file":"content/dm-vocab-06.js","kind":"vocab","count":5000,"bytes":930941},{"file":"content/dm-vocab-07.js","kind":"vocab","count":5000,"bytes":801834},{"file":"content/dm-vocab-08.js","kind":"vocab","count":616,"bytes":76932},{"file":"content/dm-sent-04.js","kind":"sent","count":5000,"bytes":876243},{"file":"content/dm-sent-05.js","kind":"sent","count":5000,"bytes":877368},{"file":"content/dm-sent-06.js","kind":"sent","count":5000,"bytes":880436},{"file":"content/dm-sent-07.js","kind":"sent","count":5000,"bytes":881404},{"file":"content/dm-sent-08.js","kind":"sent","count":5000,"bytes":883508},{"file":"content/dm-sent-09.js","kind":"sent","count":5000,"bytes":884174},{"file":"content/dm-sent-10.js","kind":"sent","count":5000,"bytes":884124},{"file":"content/dm-sent-11.js","kind":"sent","count":5000,"bytes":884145},{"file":"content/dm-sent-12.js","kind":"sent","count":5000,"bytes":885031},{"file":"content/dm-sent-13.js","kind":"sent","count":5000,"bytes":886381},{"file":"content/dm-sent-14.js","kind":"sent","count":5000,"bytes":885730},{"file":"content/dm-sent-15.js","kind":"sent","count":5000,"bytes":887350},{"file":"content/dm-sent-16.js","kind":"sent","count":5000,"bytes":885869},{"file":"content/dm-sent-17.js","kind":"sent","count":5000,"bytes":888430},{"file":"content/dm-sent-18.js","kind":"sent","count":5000,"bytes":887423},{"file":"content/dm-sent-19.js","kind":"sent","count":5000,"bytes":889283},{"file":"content/dm-sent-20.js","kind":"sent","count":5000,"bytes":891492},{"file":"content/dm-sent-21.js","kind":"sent","count":5000,"bytes":891232},{"file":"content/dm-sent-22.js","kind":"sent","count":5000,"bytes":892880},{"file":"content/dm-sent-23.js","kind":"sent","count":5000,"bytes":891133},{"file":"content/dm-sent-24.js","kind":"sent","count":5000,"bytes":895171},{"file":"content/dm-sent-25.js","kind":"sent","count":5000,"bytes":893959},{"file":"content/dm-sent-26.js","kind":"sent","count":5000,"bytes":892416},{"file":"content/dm-sent-27.js","kind":"sent","count":5000,"bytes":894681},{"file":"content/dm-sent-28.js","kind":"sent","count":5000,"bytes":893678},{"file":"content/dm-sent-29.js","kind":"sent","count":5000,"bytes":894305},{"file":"content/dm-sent-30.js","kind":"sent","count":5000,"bytes":894589},{"file":"content/dm-sent-31.js","kind":"sent","count":3000,"bytes":536754},{"file":"content/dm-gram-02.js","kind":"gram","count":2169,"bytes":2238246},{"file":"content/dm-ex-05.js","kind":"ex","count":8000,"bytes":1251350},{"file":"content/dm-ex-06.js","kind":"ex","count":8000,"bytes":1233698},{"file":"content/dm-ex-07.js","kind":"ex","count":8000,"bytes":1190618},{"file":"content/dm-ex-08.js","kind":"ex","count":8000,"bytes":1543624},{"file":"content/dm-ex-09.js","kind":"ex","count":8000,"bytes":2042495},{"file":"content/dm-ex-10.js","kind":"ex","count":8000,"bytes":1951095},{"file":"content/dm-ex-11.js","kind":"ex","count":8000,"bytes":2199211},{"file":"content/dm-ex-12.js","kind":"ex","count":8000,"bytes":1973801},{"file":"content/dm-ex-13.js","kind":"ex","count":8000,"bytes":2101893},{"file":"content/dm-ex-14.js","kind":"ex","count":8000,"bytes":1948867},{"file":"content/dm-ex-15.js","kind":"ex","count":8000,"bytes":2290819},{"file":"content/dm-ex-16.js","kind":"ex","count":8000,"bytes":1926468},{"file":"content/dm-ex-17.js","kind":"ex","count":8000,"bytes":2134128},{"file":"content/dm-ex-18.js","kind":"ex","count":8000,"bytes":1960431},{"file":"content/dm-ex-19.js","kind":"ex","count":8000,"bytes":2333440},{"file":"content/dm-ex-20.js","kind":"ex","count":8000,"bytes":1821570},{"file":"content/dm-ex-21.js","kind":"ex","count":8000,"bytes":1610579},{"file":"content/dm-ex-22.js","kind":"ex","count":8000,"bytes":1622540},{"file":"content/dm-ex-23.js","kind":"ex","count":8000,"bytes":1899014},{"file":"content/dm-ex-24.js","kind":"ex","count":8000,"bytes":1901591},{"file":"content/dm-ex-25.js","kind":"ex","count":8000,"bytes":1906300},{"file":"content/dm-ex-26.js","kind":"ex","count":8000,"bytes":1910857},{"file":"content/dm-ex-27.js","kind":"ex","count":8000,"bytes":1911307},{"file":"content/dm-ex-28.js","kind":"ex","count":8000,"bytes":1914173},{"file":"content/dm-ex-29.js","kind":"ex","count":8000,"bytes":1916779},{"file":"content/dm-ex-30.js","kind":"ex","count":8000,"bytes":1914466},{"file":"content/dm-ex-31.js","kind":"ex","count":8000,"bytes":1918242},{"file":"content/dm-ex-32.js","kind":"ex","count":8000,"bytes":1917153},{"file":"content/dm-ex-33.js","kind":"ex","count":8000,"bytes":1920727},{"file":"content/dm-ex-34.js","kind":"ex","count":8000,"bytes":1923164},{"file":"content/dm-ex-35.js","kind":"ex","count":8000,"bytes":1926234},{"file":"content/dm-ex-36.js","kind":"ex","count":8000,"bytes":1927346},{"file":"content/dm-ex-37.js","kind":"ex","count":8000,"bytes":1926689},{"file":"content/dm-ex-38.js","kind":"ex","count":8000,"bytes":1927830},{"file":"content/dm-ex-39.js","kind":"ex","count":8000,"bytes":1927310},{"file":"content/dm-ex-40.js","kind":"ex","count":8000,"bytes":1928376},{"file":"content/dm-ex-41.js","kind":"ex","count":8000,"bytes":1919074},{"file":"content/dm-ex-42.js","kind":"ex","count":8000,"bytes":1923773},{"file":"content/dm-ex-43.js","kind":"ex","count":8000,"bytes":1926139},{"file":"content/dm-ex-44.js","kind":"ex","count":8000,"bytes":1931288},{"file":"content/dm-ex-45.js","kind":"ex","count":8000,"bytes":1936428},{"file":"content/dm-ex-46.js","kind":"ex","count":8000,"bytes":1935237},{"file":"content/dm-ex-47.js","kind":"ex","count":8000,"bytes":1936255},{"file":"content/dm-ex-48.js","kind":"ex","count":8000,"bytes":1938277},{"file":"content/dm-ex-49.js","kind":"ex","count":8000,"bytes":1939731},{"file":"content/dm-ex-50.js","kind":"ex","count":8000,"bytes":1940019},{"file":"content/dm-ex-51.js","kind":"ex","count":8000,"bytes":1939772},{"file":"content/dm-ex-52.js","kind":"ex","count":8000,"bytes":1945717},{"file":"content/dm-ex-53.js","kind":"ex","count":8000,"bytes":1947210},{"file":"content/dm-ex-54.js","kind":"ex","count":8000,"bytes":1947418},{"file":"content/dm-ex-55.js","kind":"ex","count":8000,"bytes":1950793},{"file":"content/dm-ex-56.js","kind":"ex","count":8000,"bytes":1949283},{"file":"content/dm-ex-57.js","kind":"ex","count":8000,"bytes":1951598},{"file":"content/dm-ex-58.js","kind":"ex","count":8000,"bytes":1950073},{"file":"content/dm-ex-59.js","kind":"ex","count":8000,"bytes":2035853},{"file":"content/dm-ex-60.js","kind":"ex","count":8000,"bytes":2145865},{"file":"content/dm-ex-61.js","kind":"ex","count":8000,"bytes":2150782},{"file":"content/dm-ex-62.js","kind":"ex","count":8000,"bytes":2148026},{"file":"content/dm-ex-63.js","kind":"ex","count":8000,"bytes":2153436},{"file":"content/dm-ex-64.js","kind":"ex","count":8000,"bytes":2157327},{"file":"content/dm-ex-65.js","kind":"ex","count":8000,"bytes":2157839},{"file":"content/dm-ex-66.js","kind":"ex","count":8000,"bytes":1938975},{"file":"content/dm-ex-67.js","kind":"ex","count":8000,"bytes":1884344},{"file":"content/dm-ex-68.js","kind":"ex","count":8000,"bytes":1883288},{"file":"content/dm-ex-69.js","kind":"ex","count":8000,"bytes":1886852},{"file":"content/dm-ex-70.js","kind":"ex","count":8000,"bytes":1887674},{"file":"content/dm-ex-71.js","kind":"ex","count":8000,"bytes":1893956},{"file":"content/dm-ex-72.js","kind":"ex","count":8000,"bytes":1896721},{"file":"content/dm-ex-73.js","kind":"ex","count":8000,"bytes":1894397},{"file":"content/dm-ex-74.js","kind":"ex","count":8000,"bytes":3096338},{"file":"content/dm-ex-75.js","kind":"ex","count":8000,"bytes":3564452},{"file":"content/dm-ex-76.js","kind":"ex","count":8000,"bytes":3565789},{"file":"content/dm-ex-77.js","kind":"ex","count":8000,"bytes":3564615},{"file":"content/dm-ex-78.js","kind":"ex","count":8000,"bytes":3564097},{"file":"content/dm-ex-79.js","kind":"ex","count":8000,"bytes":3555662},{"file":"content/dm-ex-80.js","kind":"ex","count":8000,"bytes":3335726},{"file":"content/dm-ex-81.js","kind":"ex","count":8000,"bytes":5910234},{"file":"content/dm-ex-82.js","kind":"ex","count":8000,"bytes":3225282},{"file":"content/dm-ex-83.js","kind":"ex","count":8000,"bytes":1894078},{"file":"content/dm-ex-84.js","kind":"ex","count":8000,"bytes":1942776},{"file":"content/dm-ex-85.js","kind":"ex","count":8000,"bytes":1948307},{"file":"content/dm-ex-86.js","kind":"ex","count":8000,"bytes":1945684},{"file":"content/dm-ex-87.js","kind":"ex","count":8000,"bytes":1945362},{"file":"content/dm-ex-88.js","kind":"ex","count":3130,"bytes":761373},{"file":"content/dm-dlg-02.js","kind":"dlg","count":4500,"bytes":2668170},{"file":"content/dm-dlg-03.js","kind":"dlg","count":4500,"bytes":2888146},{"file":"content/dm-read-01.js","kind":"read","count":5000,"bytes":5726002},{"file":"content/dm-lis-01.js","kind":"lis","count":5000,"bytes":3339401},{"file":"content/dm-lis-02.js","kind":"lis","count":5000,"bytes":3334686},{"file":"content/dm-exam-01.js","kind":"exam","count":5000,"bytes":1405637},{"file":"content/dm-exam-02.js","kind":"exam","count":5000,"bytes":1406941}];
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
  /* Bounded idle prefetch (hardened 2026-10-09 for network usage):
     - honors navigator.connection.saveData (no prefetch when user asked to
       save data);
     - skips prefetch on slow connections (slow-2g/2g): core packs already
       boot the app; extended pools load explicitly via loadPack/loadKind;
     - narrows the default prefetch to ~8MB smallest-first (was ~12MB);
     - NEVER idle-fetches exercise packs ("ex": 176MB across 84 packs);
     - defers while the tab is hidden (no background radio use).
     Core search/flashcards/quiz/Smart Training run on boot packs; prefetch
     only extends their pools opportunistically. */
  function connOK() {
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return true;
      if (c.saveData) return false;
      var t = c.effectiveType || "";
      if (t === "slow-2g" || t === "2g") return false;
    } catch (e) {}
    return true;
  }
  function idlePrefetch() {
    try {
      if (!connOK()) return;
      var cands = PACKS.filter(function (p) { return p.kind !== "ex"; }).sort(function (a, b) { return a.bytes - b.bytes; });
      var budget = 8 * 1024 * 1024, chain = Promise.resolve(true);
      cands.forEach(function (p) {
        if (p.bytes > budget) return;
        budget -= p.bytes;
        chain = chain.then(function () { return window.DM_LIB_MORE.loadPack(p.file); });
      });
    } catch (e) {}
  }
  function schedulePrefetch() {
    try {
      if (typeof document !== "undefined" && document.hidden) {
        var onVis = function () {
          if (!document.hidden) {
            try { document.removeEventListener("visibilitychange", onVis); } catch (e) {}
            setTimeout(idlePrefetch, 4000);
          }
        };
        document.addEventListener("visibilitychange", onVis);
        return;
      }
    } catch (e) {}
    setTimeout(idlePrefetch, 4000);
  }
  try { mergeAll(); } catch (e) {}
  try {
    if (document.readyState === "complete") schedulePrefetch();
    else window.addEventListener("load", function () { schedulePrefetch(); });
  } catch (e) {}
})();
