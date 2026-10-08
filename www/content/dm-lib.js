/* Deutsch Master — Content Library runtime registry (ADDITIVE ONLY).
   Packs (dm-vocab-*.js ...) push compact rows via __dmLibPush; this file merges them
   into the live globals (VOCAB / SENTENCES / GRAMMAR / SENT_FILL / CURR_READING),
   registers reference overlays, and exposes a fast DM_LIB search index.
   - Never throws: every merge step is guarded so boot can never break.
   - No localStorage keys added/renamed; no existing globals replaced (only .push).
   - Index builds lazily on first search (perf-safe on low-end phones). */
"use strict";
(function () {
  window.__dmLibChunks = window.__dmLibChunks || { vocab: [], sent: [], gram: [], ex: [], dlg: [] };
  window.__dmLibPush = function (kind, rows) {
    try {
      window.__dmLibChunks[kind] = window.__dmLibChunks[kind] || [];
      window.__dmLibChunks[kind].push(rows);
    } catch (e) {}
  };
})();
"use strict";
(function () {
  var S = window.__dmLibChunks || { vocab: [], sent: [], gram: [], ex: [], dlg: [] };
  function flat(a) { var o = []; for (var i = 0; i < a.length; i++) for (var j = 0; j < a[i].length; j++) o.push(a[i][j]); return o; }
  var VROWS = flat(S.vocab || []), SROWS = flat(S.sent || []), GROWS = flat(S.gram || []),
      EROWS = flat(S.ex || []), DROWS = flat(S.dlg || []);
  var TYPE_AR = { noun: "اسم", verb: "فعل", adj: "صفة", pron: "ضمير", adv: "مفردات", conj: "أداة", prep: "أداة", num: "مفردات", phrase: "مفردات", func: "أداة" };
  var CAT_MAP = { family: "Family", food: "Food", drinks: "Drinks", home: "Home", school: "School", university: "University", work: "Work", travel: "Travel", shopping: "Shopping", body: "Body", time: "Time", numbers: "Numbers", animals: "Animals", clothing: "Clothes", verbs: "Common Verbs", adjectives: "Adjectives", general: "General" };
  function kapForLevel(level, id) {
    if (level === "A1") { var n = 0; for (var i = 0; i < id.length; i++) n += id.charCodeAt(i); return "K" + (1 + (n % 5)); }
    return "KX";
  }
  var merged = { vocab: 0, sent: 0, gram: 0, ex: 0, dlg: 0, readings: 0, overlays: 0 };
  var VOCAB_ROWS = [], SENT_ROWS = [], GRAM_ROWS = [], FILL_ROWS = [], DLG_ROWS = [];
  /* ---- vocab ---- */
  try {
    for (var i = 0; i < VROWS.length; i++) {
      var r = VROWS[i];
      VOCAB_ROWS.push({
        id: r[0], de: r[1], art: r[2], ar: r[3], en: r[4] || "", level: r[5] || "A1",
        cat: CAT_MAP[r[6]] || r[6], type: TYPE_AR[r[7]] || "مفردات",
        plural: r[8] || "", pron: "", ex: r[10] || "", exAr: r[11] || "",
        kap: kapForLevel(r[5] || "A1", r[0]), libHead: r[9] || "", libType: r[7]
      });
    }
    if (typeof VOCAB !== "undefined" && VOCAB && VOCAB.push) {
      var have = {};
      try { VOCAB.forEach(function (w) { have[w.id] = 1; }); } catch (e) {}
      VOCAB_ROWS.forEach(function (w) { if (!have[w.id]) { VOCAB.push(w); merged.vocab++; } });
    }
  } catch (e) {}
  /* ---- sentences ---- */
  try {
    for (var j = 0; j < SROWS.length; j++) {
      var s = SROWS[j];
      SENT_ROWS.push({
        id: s[0], de: s[1], ar: s[2], pron: "", kap: s[5] || kapForLevel(s[3], s[0]),
        level: s[3], topic: s[4], gram: "", wid: "", w: "", src: "lib",
        libGram: s[6] || "", libVocab: s[7] ? String(s[7]).split(",") : []
      });
    }
    if (typeof SENTENCES !== "undefined" && SENTENCES && SENTENCES.push) {
      var shave = {};
      try { SENTENCES.forEach(function (x) { shave[x.id] = 1; }); } catch (e) {}
      SENT_ROWS.forEach(function (x) { if (!shave[x.id]) { SENTENCES.push(x); merged.sent++; } });
    }
  } catch (e) {}
  /* ---- grammar ---- */
  try {
    for (var k = 0; k < GROWS.length; k++) {
      var g = GROWS[k];
      GRAM_ROWS.push({
        id: g.id, title: g.title, kap: g.kap, body: g.body, ex: g.examples,
        quiz: g.quiz, level: g.level, libTopic: g.topicId, libCat: g.cat, libKind: g.kind, src: "lib"
      });
    }
    if (typeof GRAMMAR !== "undefined" && GRAMMAR && GRAMMAR.push) {
      var gave = {};
      try { GRAMMAR.forEach(function (x) { gave[x.id] = 1; }); } catch (e) {}
      GRAM_ROWS.forEach(function (x) { if (!gave[x.id]) { GRAMMAR.push(x); merged.gram++; } });
    }
  } catch (e) {}
  /* ---- exercises -> SENT_FILL (deferred: ex packs load with defer;
     merged on DOMContentLoaded so first paint is never blocked) ---- */
  function mergeEx() {
    try {
      var E2 = [];
      for (var i = 0; i < (S.ex || []).length; i++) for (var j = 0; j < S.ex[i].length; j++) E2.push(S.ex[i][j]);
      if (!E2.length || FILL_ROWS.length) return;
      E2.forEach(function (q) {
      /* compact ex row: [id,type,prompt,choices,answer,level,ref,kind,kap,wordsOrLines,why] */
      var ekind = q[7] === "order" ? "order" : "fill";
      FILL_ROWS.push({
        id: q[0], s: q[2], o: q[3], c: q[4], why: q[10] || "", lvl: q[5] || "A1",
        pos: "mid", typ: q[1], kind: ekind, ctx: "lib",
        start: String(q[2] || "").split(" ")[0], w: "", chapterId: q[8] || "KX",
        chapterName: "Library", chapterSrc: "lib", lessonId: null, lessonName: "Library " + (q[5] || "A1"),
        structureType: ekind === "order" ? "order" : "gap", subjectType: "-",
        grammarTarget: q[1], sentenceStarter: String(q[2] || "").split(" ")[0],
        answerType: q[1], blankPosition: "mid", libType: q[1],
        libRefIds: String(q[6] || "").split(",").filter(Boolean),
        libWords: null, libLines: null
      });
      var wl = q[9];
      if (wl && typeof wl !== "number") {
        if (ekind === "order") FILL_ROWS[FILL_ROWS.length - 1].libWords = wl;
        else FILL_ROWS[FILL_ROWS.length - 1].libLines = wl;
      }
      });
      if (typeof SENT_FILL !== "undefined" && SENT_FILL && SENT_FILL.push) {
        var fave = {};
        try { SENT_FILL.forEach(function (x) { fave[x.id] = 1; }); } catch (e) {}
        FILL_ROWS.forEach(function (x) { if (!fave[x.id]) { SENT_FILL.push(x); merged.ex++; } });
      }
      try { if (window.DM_LIB) window.DM_LIB.stats.exercises = FILL_ROWS.length; } catch (e) {}
      try { window.dispatchEvent(new Event("dm-lib-ex-ready")); } catch (e) {}
    } catch (e) {}
  }
  try {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mergeEx);
    else mergeEx();
  } catch (e) { try { mergeEx(); } catch (e2) {} }
  /* ---- dialogues -> DM_DIALOGS + CURR_READING ---- */
  try {
    for (var d = 0; d < DROWS.length; d++) {
      var dr = DROWS[d];
      DLG_ROWS.push({ id: dr[0], level: dr[1], topic: dr[2], titleDe: dr[3], titleAr: dr[4], lines: dr[5] });
    }
    window.DM_DIALOGS = (window.DM_DIALOGS || []).concat(DLG_ROWS);
    merged.dlg = DLG_ROWS.length;
    if (typeof CURR_READING !== "undefined" && CURR_READING && CURR_READING.push) {
      var rave = {};
      try { CURR_READING.forEach(function (x) { rave[x.id] = 1; }); } catch (e) {}
      DLG_ROWS.forEach(function (x, ix) {
        var rid = "lr" + x.id.slice(2);
        if (rave[rid]) return;
        var de = x.lines.map(function (l) { return l[0] + ": " + l[1]; }).join("\n");
        var ar = x.lines.map(function (l) { return l[0] + ": " + l[2]; }).join("\n");
        /* deterministic comprehension question: who said what? */
        var li = ix % x.lines.length;
        var correctAr = x.lines[li][2];
        var distract = [];
        for (var k2 = 1; k2 <= 2; k2++) {
          var other = DLG_ROWS[(ix + k2 * 37) % DLG_ROWS.length];
          distract.push(other.lines[(li + k2) % other.lines.length][2]);
        }
        var opts = [correctAr].concat(distract);
        /* deterministic rotate by index */
        var rot = ix % 3, opts2 = [opts[rot % 3], opts[(rot + 1) % 3], opts[(rot + 2) % 3]];
        CURR_READING.push({
          id: rid, level: x.level, kap: "", title: x.titleAr, de: de, ar: ar,
          qs: [{ q: "ماذا قال «" + x.lines[li][0] + "»؟", opts: opts2, correct: opts2.indexOf(correctAr) }]
        });
        merged.readings++;
      });
    }
  } catch (e) {}
  /* ---- reference overlays (topic-level, no aliases -> no broken links) ---- */
  try {
    var CAT_WHY = {
      syntax: "الترتيب الصحيح للكلمات هو أساس الجملة الألمانية المفهومة.",
      artikel: "اختيار الأداة الصحيحة يحدد معنى الجملة وإعرابها.",
      nomen: "الأسماء وجموعها من أكثر ما يُسأل عنه في الامتحانات.",
      kasus: "الحالات الإعرابية تحدد وظيفة كل كلمة في الجملة.",
      pronomen: "الضمائر الصحيحة تجعل الكلام طبيعيًا ودقيقًا.",
      verben: "الأفعال قلب الجملة: تصريفها وموقعها يحددان المعنى.",
      zeiten: "الزمن الصحيح يضع الأحداث في ترتيبها الحقيقي.",
      adjektiv: "الصفات وإعرابها ومقارنتها تصف العالم بدقة.",
      praeposition: "حروف الجر تحدد المكان والزمان والعلاقات.",
      konjunktion: "الروابط تبني الجمل المركبة والأفكار المتصلة.",
      infinitiv: "المصدر مع zu يفتح أبواب التعبير عن الأهداف.",
      relativ: "جمل الوصل تصف الأشخاص والأشياء بدقة.",
      imperativ: "صيغة الأمر للطلبات والتعليمات اليومية.",
      konjunktiv: "الشرطي للتمني والافتراض والتهذيب.",
      passiv: "المبني للمجهول للتركيز على الحدث لا الفاعل.",
      adverb: "الظروف تضبط المعنى: الزمن والمكان والكيفية.",
      wortbildung: "اشتقاق الكلمات يضاعف مفرداتك بسرعة.",
      stil: "الجسيمات والأسلوب يجعلان كلامك طبيعيًا.",
      kommunikation: "هذه التعابير تُستعمل يوميًا في ألمانيا.",
      fehler: "تجنّب هذا الخطأ الشائع يرفع مستواك فورًا.",
      kontrast: "الفرق بين المتشابهات يمنع الخلط الدائم.",
      zahlen: "الأرقام والتواريخ والساعة لغة الحياة اليومية."
    };
    if (window.DMRefEncy && window.DMRefEncy.overlays) {
      var seen = {};
      GRAM_ROWS.forEach(function (x) {
        if (seen[x.libTopic]) return;
        seen[x.libTopic] = 1;
        try {
          window.DMRefEncy.overlays[x.libTopic] = {
            quick: x.title, why: CAT_WHY[x.libCat] || CAT_WHY.syntax,
            when: ["عند بناء الجمل في هذا الباب", "في الامتحانات الكتابية والشفوية"],
            how: ["اقرأ القاعدة ثم الأمثلة", "قارن مع الوحدات المرتبطة", "اختبر نفسك بالسؤال المرفق"],
            trick: "ابدأ بالأمثلة قبل حفظ القاعدة.",
            reallife: x.ex ? x.ex.slice(0, 2).map(function (e) { return e[0]; }) : [],
            breaks: ["الخلط مع القواعد المجاورة — راجع الوحدات المرتبطة"]
          };
          merged.overlays++;
        } catch (e) {}
      });
    }
  } catch (e) {}
  /* ---- registry + lazy search index ---- */
  var index = null;
  function normQ(s) {
    return String(s || "").toLowerCase().replace(/[؟?!.,;:«»"„“]/g, " ").replace(/\s+/g, " ").trim();
  }
  function buildIndex() {
    if (index) return index;
    index = { tok: {} };
    function addTok(key, id, score) {
      var ks = key.split(" ").filter(Boolean).slice(0, 8);
      for (var i = 0; i < ks.length; i++) {
        var t = ks[i].slice(0, 12);
        if (t.length < 2) continue;
        (index.tok[t] = index.tok[t] || []).push([id, score]);
      }
    }
    VOCAB_ROWS.forEach(function (w) { addTok(normQ(w.de) + " " + normQ(w.ar) + " " + normQ(w.en), "v:" + w.id, 3); });
    SENT_ROWS.forEach(function (s) { addTok(normQ(s.de), "s:" + s.id, 2); });
    GRAM_ROWS.forEach(function (g) { addTok(normQ(g.title), "g:" + g.id, 2); });
    return index;
  }
  var vById = {}, sById = {}, gById = {};
  VOCAB_ROWS.forEach(function (w) { vById[w.id] = w; });
  SENT_ROWS.forEach(function (s) { sById[s.id] = s; });
  GRAM_ROWS.forEach(function (g) { gById[g.id] = g; });
  window.DM_LIB = {
    stats: { vocab: VOCAB_ROWS.length, sentences: SENT_ROWS.length, grammar: GRAM_ROWS.length, exercises: FILL_ROWS.length, dialogues: DLG_ROWS.length, merged: merged },
    vocabById: vById, sentById: sById, gramById: gById,
    dialogs: DLG_ROWS,
    gramForSentence: function (sid) {
      var s = sById[sid];
      if (!s || !s.libGram) return null;
      return gById[s.libGram] || null;
    },
    sentsForWord: function (wid) {
      var out = [];
      for (var i = 0; i < SENT_ROWS.length && out.length < 20; i++) {
        if (SENT_ROWS[i].libVocab.indexOf(wid) >= 0) out.push(SENT_ROWS[i]);
      }
      return out;
    },
    search: function (q, opt) {
      opt = opt || {};
      buildIndex();
      var nq = normQ(q);
      if (!nq) return [];
      var toks = nq.split(" ").filter(Boolean).slice(0, 4);
      var hits = {}, first = index.tok[toks[0].slice(0, 12)] || [];
      /* prefix fallback: scan token keys (bounded) */
      if (!first.length) {
        var keys = Object.keys(index.tok);
        for (var ki = 0; ki < keys.length; ki++) {
          if (keys[ki].indexOf(toks[0].slice(0, 12)) === 0 || toks[0].indexOf(keys[ki]) === 0) {
            first = first.concat(index.tok[keys[ki]]);
            if (first.length > 400) break;
          }
        }
      }
      for (var i = 0; i < first.length; i++) hits[first[i][0]] = (hits[first[i][0]] || 0) + first[i][1];
      for (var t2 = 1; t2 < toks.length; t2++) {
        var arr = index.tok[toks[t2].slice(0, 12)] || [];
        for (var j = 0; j < arr.length; j++) if (hits[arr[j][0]]) hits[arr[j][0]] += arr[j][1];
      }
      var out = [];
      Object.keys(hits).forEach(function (id) {
        var kind = id.slice(0, 2), rid = id.slice(2), rec =
          kind === "v:" ? vById[rid] : kind === "s:" ? sById[rid] : gById[rid];
        if (!rec) return;
        if (opt.level && rec.level !== opt.level) return;
        if (opt.cat && (rec.cat || rec.topic) !== opt.cat) return;
        if (opt.type && rec.libType !== opt.type && rec.type !== opt.type) return;
        out.push({ id: rid, kind: kind === "v:" ? "vocab" : kind === "s:" ? "sentence" : "grammar", score: hits[id], rec: rec });
      });
      out.sort(function (a, b) { return b.score - a.score; });
      return out.slice(0, opt.limit || 60);
    }
  };
})();
