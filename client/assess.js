/* ============================================================================
   Deutsch Master — Assessment & Testing Center (مركز الاختبارات والتقييم)
   ----------------------------------------------------------------------------
   ADDITIVE module. Extends the existing Tests page (page-quiz) into a full
   assessment center. Reuses (never duplicates):
     - content: allWords()/VOCAB, GRAMMAR, GLAB_BANK, SENTENCES, SENT_FILL,
       CURR_READING, LISTEN_ITEMS, SPEAK_ITEMS, TALK_SITS, REAL_SITS, KAPITEL
     - progress: S (localStorage deutsch_master_v2), save(), recordMistake(),
       noteMastered(), gramRecord(), addXP(), DMProgress.logAttempt(),
       S.quizHistory / S.testsTaken / S.place / S.journey.final
     - router: showPage() (+ DMPageState.skipRender respect), existing CSS
       classes (panel/glass/quiz-opt/quiz-feedback/progress/btn/row-flex).
   The legacy quiz engine in script.js (quizType/startQuizRun/...) is left
   100% intact: all its DOM ids and buttons keep working (runtime-qa safe).

   Design thresholds (single place to tune, all documented):
     PASS_A1_EXAM      = 70   overall % to pass the A1 comprehensive exam
     STAGE_PASS        = 70   % to advance to the next placement stage
     KAP_READY         = 70   readiness % => Kapitel counts as done
     KAP_MASTERED      = 85   readiness % => Kapitel shown as mastered ✓
     STRONG_SKILL      = 80   skill % => "قوي"
     GOOD_SKILL        = 65   skill % => "جيد"
     WEAK_SKILL        = 40   below => "يحتاج مراجعة"
     MIN_SKILL_N       = 3    min answers in a skill before a verdict is given
     MIN_OVERALL_N     = 8    min answers before an overall verdict is given
     CONF_HIGH_N       = 20   answers needed for high confidence
     CONF_MED_N        = 10   answers needed for medium confidence
     TEST_W_KAP        = 0.65 weight of live-test evidence in Kapitel readiness
     PROG_W_KAP        = 0.35 weight of accumulated progress in readiness
     MIN_KAP_TEST_N    = 4    min test answers in a Kapitel to trust test data
     HISTORY_CAP       = 30   stored assessment results (ring buffer)
     RESUME_TTL_DAYS   = 7    stale in-progress sessions are discarded safely
     EXAM_TIME_SEC     = 1200 default timer for the full A1 exam (20 min)
     LVL_GATE_WORDS    = 40   min words of a level to unlock its level exam
     LVL_GATE_GRAMMAR  = 4    min grammar topics of a level to unlock its exam
   Anti-luck: level/Kapitel/mastery verdicts always carry an evidence count
   and a confidence label; with too little data the UI says so honestly
   ("النتيجة غير حاسمة — نحتاج أسئلة إضافية") instead of guessing.
   ========================================================================== */
"use strict";
var DMAssess = (function () {
  /* ============================ PURE CORE ============================ */
  var CONFIG = {
    PASS_A1_EXAM: 70, STAGE_PASS: 70,
    KAP_READY: 70, KAP_MASTERED: 85,
    STRONG_SKILL: 80, GOOD_SKILL: 65, WEAK_SKILL: 40,
    MIN_SKILL_N: 3, MIN_OVERALL_N: 8,
    CONF_HIGH_N: 20, CONF_MED_N: 10,
    TEST_W_KAP: 0.65, PROG_W_KAP: 0.35, MIN_KAP_TEST_N: 4,
    HISTORY_CAP: 30, RESUME_TTL_DAYS: 7, EXAM_TIME_SEC: 1200,
    LVL_GATE_WORDS: 40, LVL_GATE_GRAMMAR: 4, STORE_V: 1,
    QTIME_SEC: 12, BOSS_UNLOCK_READY: 50, PERFECT_ROUND_N: 5, MASTER_CAP: 120,
    /* Large-test sizing: quick 20 / normal 40 / intensive 60 / advanced 80 /
       master = all valid content up to MASTER_CAP. Counts are targets only:
       every spec slices to real valid content and reports the actual number. */
  };

  /* skill registry: key -> Arabic label + learning route (all real pages) */
  var SKILLS = {
    vocab:     { ar: "الكلمات",   de: "Wortschatz", go: "vocab" },
    grammar:   { ar: "القواعد",   de: "Grammatik", go: "grammar" },
    sentences: { ar: "الجمل",     de: "Sätze",     go: "sentences" },
    reading:   { ar: "القراءة",   de: "Lesen",     go: "sentences" },
    listening: { ar: "الاستماع",  de: "Hören",     go: "listen" },
    writing:   { ar: "الكتابة",   de: "Schreiben", go: "sentex" },
    speaking:  { ar: "التحدث",    de: "Sprechen",  go: "speak" },
    practical: { ar: "المواقف",   de: "Alltag",    go: "real" }
  };
  var SKILL_KEYS = Object.keys(SKILLS);

  function clampPct(x) { x = Math.round(+x || 0); return x < 0 ? 0 : x > 100 ? 100 : x; }
  function shuffled(a, rnd) {
    var x = (a || []).slice(), r = rnd || Math.random, i, j, t;
    for (i = x.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = x[i]; x[i] = x[j]; x[j] = t; }
    return x;
  }
  /* Stratified pick: plan = [{skill, n, kap?, level?}], pool items carry
     .skill/.kap/.level/.id. Never invents coverage: returns {picked, miss}
     where miss lists the slots that had no real content. */
  function stratify(pool, plan, rnd) {
    var used = {}, picked = [], miss = [];
    (plan || []).forEach(function (slot) {
      var cands = shuffled((pool || []).filter(function (q) {
        if (used[q.id]) return false;
        if (slot.skill && q.skill !== slot.skill) return false;
        if (slot.kap && q.kap !== slot.kap) return false;
        if (slot.level && q.level !== slot.level) return false;
        if (slot.types && slot.types.indexOf(q.type) < 0) return false;
        return true;
      }), rnd);
      var want = Math.max(0, slot.n | 0), got = 0;
      for (var i = 0; i < cands.length && got < want; i++) { used[cands[i].id] = 1; picked.push(cands[i]); got++; }
      if (got < want) miss.push({ skill: slot.skill || "*", kap: slot.kap || "*", want: want, got: got });
    });
    return { picked: shuffled(picked, rnd), miss: miss };
  }

  function emptyAgg() { return { n: 0, ok: 0, pct: 0, ev: "none" }; }
  function evOf(n) { return n >= CONFIG.MIN_SKILL_N ? "ok" : (n > 0 ? "thin" : "none"); }
  /* Deterministic RNG (daily test, reproducible practice). mulberry32. */
  function hashSeed(str) {
    var h = 2166136261;
    str = String(str == null ? "" : str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededRng(seedStr) { return mulberry32(hashSeed(seedStr)); }
  /* Content validation: every served question must pass this. Invalid items
     are skipped by buildPool — never crash a session, never fake a score. */
  function validateQ(q) {
    if (!q || typeof q !== "object") return false;
    if (!q.prompt || !String(q.prompt).trim()) return false;
    var t = q.type;
    if (t === "order") {
      if (!q.chips || q.chips.length < 3 || !q.answer || !String(q.answer).trim()) return false;
      return true;
    }
    if (t === "fill" || t === "speak") {
      if (t === "fill" && (!q.accept || !q.accept.length || !q.accept[0])) return false;
      if (t === "speak" && !q.sample) return false;
      return !!String(q.prompt).trim();
    }
    if (t === "match") {
      if (!q.pairs || q.pairs.length < 2) return false;
      for (var i = 0; i < q.pairs.length; i++) {
        if (!q.pairs[i].de || !q.pairs[i].ar) return false;
      }
      return true;
    }
    if (t === "conj") {
      if (!q.rows || q.rows.length < 1 || !q.rows[0].opts || q.rows[0].opts.length < 2) return false;
      return true;
    }
    /* option-based types: need unique non-empty options + valid correct idx */
    if (!q.opts || q.opts.length < 2) return false;
    if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.opts.length) return false;
    var seen = {}, ok = true;
    q.opts.forEach(function (o) {
      var k = String(o == null ? "" : o).trim();
      if (!k || seen[k]) ok = false;
      seen[k] = 1;
    });
    return ok;
  }
  var DIFF_ORDER = { easy: 0, medium: 1, hard: 2 };
  /* Difficulty filter: 'graded' sorts easy->hard; a missing level falls back
     to the closest available (never an empty test when content exists). */
  function filterByDiff(pool, diff) {
    pool = pool || [];
    if (!diff || diff === "mixed") return pool.slice();
    if (diff === "graded") {
      return pool.slice().sort(function (a, b) {
        return (DIFF_ORDER[a.diff] == null ? 1 : DIFF_ORDER[a.diff]) - (DIFF_ORDER[b.diff] == null ? 1 : DIFF_ORDER[b.diff]);
      });
    }
    var exact = pool.filter(function (q) { return q.diff === diff; });
    if (exact.length) return exact;
    var keys = Object.keys(DIFF_ORDER);
    var want = DIFF_ORDER[diff];
    for (var d = 1; d < 3; d++) {
      var lo = keys.filter(function (k) { return DIFF_ORDER[k] === want - d; })[0];
      var hi = keys.filter(function (k) { return DIFF_ORDER[k] === want + d; })[0];
      var fb = pool.filter(function (q) { return q.diff === lo || q.diff === hi; });
      if (fb.length) return fb;
    }
    return pool.slice();
  }
  /* Percent distribution -> integer counts summing exactly to total. */
  function distribute(total, ratios) {
    total = Math.max(0, total | 0);
    ratios = ratios || {};
    var keys = Object.keys(ratios);
    if (!keys.length || total <= 0) return {};
    var sum = 0;
    keys.forEach(function (k) { sum += Math.max(0, +ratios[k] || 0); });
    if (sum <= 0) return {};
    var out = {}, acc = 0;
    keys.forEach(function (k, i) {
      if (i === keys.length - 1) out[k] = total - acc;
      else { out[k] = Math.floor(total * (Math.max(0, +ratios[k] || 0) / sum)); acc += out[k]; }
    });
    return out;
  }
  /* Score one answered session. items: [{skill, topic, kap, ok, w}] */
  function scoreAnswers(items) {
    var sk = {}, kp = {}, tp = {}, tn = 0, tok = 0;
    SKILL_KEYS.forEach(function (s) { sk[s] = { n: 0, ok: 0 }; });
    (items || []).forEach(function (it) {
      var w = (typeof it.w === "number" && it.w > 0) ? it.w : 1;
      tn += w; if (it.ok) tok += w;
      if (sk[it.skill]) { sk[it.skill].n += w; if (it.ok) sk[it.skill].ok += w; }
      var k = it.kap || "?";
      if (!kp[k]) kp[k] = { n: 0, ok: 0 };
      kp[k].n += w; if (it.ok) kp[k].ok += w;
      var t = (it.skill || "?") + "::" + (it.topic || "?");
      if (!tp[t]) tp[t] = { n: 0, ok: 0, skill: it.skill, topic: it.topic };
      tp[t].n += w; if (it.ok) tp[t].ok += w;
    });
    function fin(o) { o.pct = o.n ? clampPct(o.ok / o.n * 100) : 0; o.ev = evOf(Math.round(o.n)); return o; }
    Object.keys(sk).forEach(function (s) { fin(sk[s]); });
    Object.keys(kp).forEach(function (k) { fin(kp[k]); });
    Object.keys(tp).forEach(function (k) { fin(tp[k]); });
    var total = fin({ n: tn, ok: tok });
    var covOk = SKILL_KEYS.filter(function (s) { return sk[s].ev === "ok"; }).length;
    var confidence = "low", why = "";
    if (tn >= CONFIG.CONF_HIGH_N && covOk >= 4) { confidence = "high"; why = "أسئلة كافية وتغطية متوازنة للمهارات"; }
    else if (tn >= CONF_MED_N_SAFE() && covOk >= 2) { confidence = "medium"; why = "عدد أسئلة معقول لكن التغطية جزئية"; }
    else { why = tn < CONFIG.MIN_OVERALL_N ? "أسئلة قليلة جدًا — النتيجة استرشادية" : "تغطية المهارات محدودة"; }
    function CONF_MED_N_SAFE() { return CONFIG.CONF_MED_N; }
    var inconclusive = tn < CONFIG.MIN_OVERALL_N;
    return { skills: sk, kaps: kp, topics: tp, total: total, covOk: covOk, confidence: confidence, confWhy: why, inconclusive: inconclusive };
  }

  /* verdict label for a skill/section score (evidence-aware) */
  function statusOf(pct, ev) {
    if (ev !== "ok") return { k: "nodata", ar: "بيانات غير كافية", ico: "▫️" };
    if (pct >= CONFIG.STRONG_SKILL) return { k: "strong", ar: "قوي", ico: "✅" };
    if (pct >= CONFIG.GOOD_SKILL) return { k: "good", ar: "جيد", ico: "🟢" };
    if (pct >= CONFIG.WEAK_SKILL) return { k: "weak", ar: "يحتاج مراجعة", ico: "⚠️" };
    return { k: "poor", ar: "ضعيف — ابدأ من هنا", ico: "🔴" };
  }

  /* stages: [{id:'A'|'B'|'C', pct, n}] in order. Returns level verdict. */
  function levelFromStages(stages) {
    stages = stages || [];
    var tot = 0; stages.forEach(function (s) { tot += s.n || 0; });
    if (!stages.length || tot < CONFIG.MIN_OVERALL_N)
      return { level: "?", confidence: "low", inconclusive: true, note: "النتيجة غير حاسمة — نحتاج أسئلة إضافية" };
    var passed = stages.filter(function (s) { return (s.pct || 0) >= CONFIG.STAGE_PASS; }).length;
    var last = stages[stages.length - 1];
    var map = { 1: "A1", 2: "A2", 3: "B1" };
    if (!passed) return { level: "A0", confidence: tot >= CONFIG.CONF_MED_N ? "medium" : "low", inconclusive: false, note: "ابدأ من التأسيس (A1 من الصفر)" };
    var lvl = map[passed] || "A1";
    var conf = (tot >= CONFIG.CONF_HIGH_N && (last.pct >= CONFIG.STAGE_PASS + 10 || passed < stages.length)) ? "high" : (tot >= CONFIG.CONF_MED_N ? "medium" : "low");
    return { level: lvl, confidence: conf, inconclusive: false, note: "اجتزت " + passed + " من " + stages.length + " مراحل" };
  }

  /* Kapitel readiness: test = {n,ok,pct}|null, prog = 0..100|null.
     readiness = TEST_W*test + PROG_W*prog (renormalized when one is missing).
     Never trusts a Kapitel verdict on < MIN_KAP_TEST_N live answers alone. */
  function kapitelReadiness(test, prog) {
    var hasT = !!(test && test.n >= CONFIG.MIN_KAP_TEST_N);
    var hasP = (typeof prog === "number" && prog !== null);
    if (!hasT && !hasP) return { pct: 0, conf: "none", why: "لا بيانات" };
    var r, conf;
    if (hasT && hasP) { r = CONFIG.TEST_W_KAP * test.pct + CONFIG.PROG_W_KAP * prog; conf = "high"; }
    else if (hasT) { r = test.pct; conf = test.n >= CONFIG.CONF_MED_N ? "medium" : "low"; }
    else { r = prog; conf = "low"; }
    return { pct: clampPct(r), conf: conf, why: hasT ? ("اختبار: " + test.n + " أسئلة") : "من تقدمك العام فقط" };
  }
  /* order: array of kapitel ids in learning order.
     current = highest kap with readiness >= KAP_READY. */
  function currentKapitel(readinessByKap, order) {
    var cur = null, nxt = null;
    for (var i = 0; i < order.length; i++) {
      var r = readinessByKap[order[i]];
      if (r && r.pct >= CONFIG.KAP_READY) cur = order[i];
      else if (!nxt && r) nxt = order[i];
    }
    var status = !cur ? "start" : (nxt ? "progress" : "advanced");
    return { current: cur, next: nxt, status: status };
  }

  function weakTopics(topics, limit) {
    return Object.keys(topics || {}).map(function (k) { return { key: k, skill: topics[k].skill, topic: topics[k].topic, n: topics[k].n, pct: topics[k].pct }; })
      .filter(function (x) { return x.n >= 2 && x.pct < CONFIG.GOOD_SKILL; })
      .sort(function (a, b) { return a.pct - b.pct; }).slice(0, limit || 6);
  }
  function strongSkills(skills) {
    return SKILL_KEYS.filter(function (s) { return skills[s] && skills[s].ev === "ok" && skills[s].pct >= CONFIG.STRONG_SKILL; });
  }
  function weakSkills(skills) {
    return SKILL_KEYS.filter(function (s) { return skills[s] && skills[s].ev === "ok" && skills[s].pct < CONFIG.GOOD_SKILL; })
      .sort(function (a, b) { return skills[a].pct - skills[b].pct; });
  }

  return { CONFIG: CONFIG, SKILLS: SKILLS, SKILL_KEYS: SKILL_KEYS, shuffled: shuffled, stratify: stratify, scoreAnswers: scoreAnswers, statusOf: statusOf, levelFromStages: levelFromStages, kapitelReadiness: kapitelReadiness, currentKapitel: currentKapitel, weakTopics: weakTopics, strongSkills: strongSkills, weakSkills: weakSkills, clampPct: clampPct, hashSeed: hashSeed, mulberry32: mulberry32, seededRng: seededRng, validateQ: validateQ, filterByDiff: filterByDiff, distribute: distribute };
})();
/* ================= BROWSER LAYER (needs app globals; all lazy) ============ */
DMAssess.ui = (function () {
  "use strict";
  var C = DMAssess;
  /* NOTE: top-level const/let in classic scripts do NOT become window props,
     so window[name] misses banks like KAPITEL/LISTEN_ITEMS. Resolve bare
     identifiers through the global scope instead (cached by reference;
     curriculum merges mutate the same arrays, so caching stays fresh). */
  var __gcache = {};
  function G(name) {
    try {
      if (typeof window !== "undefined" && window[name] !== undefined) return window[name];
      if (__gcache[name] !== undefined) return __gcache[name] === null ? undefined : __gcache[name];
      var v;
      try { v = new Function("return (typeof " + name + " !== 'undefined') ? " + name + " : undefined;")(); } catch (e) { v = undefined; }
      __gcache[name] = (v === undefined ? null : v);
      return v;
    } catch (e) { return undefined; }
  }
  function FN(name) { try { var f = (typeof window !== "undefined" ? window[name] : undefined) || (typeof globalThis !== "undefined" ? globalThis[name] : undefined); return typeof f === "function" ? f : null; } catch (e) { return null; } }
  function esc(s) { try { var f = FN("escapeHtml"); if (f) return f(s); } catch (e) {} return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function say(text) { try { var f = FN("speakGerman") || FN("speak"); if (f) f(text); } catch (e) {} }
  function words() { try { var f = FN("allWords"); return f ? f() : []; } catch (e) { return []; } }
  function shuffle(a) { return C.shuffled(a); }

  /* ---------- content adapters (real project content only) ---------- */
  function kapitelList() {
    try {
      var K = G("KAPITEL") || [];
      return K.filter(function (k) { return k && k.id && k.id !== "KX"; });
    } catch (e) { return []; }
  }
  function kapLabel(id) {
    try { var f = FN("kapName"); if (f) return f(id); } catch (e) {}
    var k = kapitelList().filter(function (x) { return x.id === id; })[0];
    return k ? (k.icon + " " + k.id + " • " + k.name) : (id || "");
  }
  function vocabPool(o) {
    o = o || {};
    return words().filter(function (w) {
      if (!w || !w.de) return false;
      if (o.kap && (w.kap || "") !== o.kap) return false;
      if (o.level && (w.level || "A1") !== o.level) return false;
      return true;
    });
  }
  function grammarPool(o) {
    o = o || {};
    try {
      var Gs = G("GRAMMAR") || [];
      return Gs.filter(function (g) {
        if (!g || !g.quiz) return false;
        if (o.kap && (g.kap || "") !== o.kap) return false;
        if (o.level && (g.level || "A1") !== o.level) return false;
        return true;
      });
    } catch (e) { return []; }
  }
  function glabPool() {
    var out = [];
    try {
      var B = G("GLAB_BANK") || {}, GR = G("GRAMMAR") || [];
      Object.keys(B).forEach(function (gid) {
        var b = B[gid]; if (!b || !b.questions) return;
        var g = null;
        try { g = GR.filter(function (x) { return x.id === gid; })[0]; } catch (e) {}
        b.questions.forEach(function (q, i) {
          if (!q || q.type === "order" || !q.opts || !q.opts.length) return;
          out.push({ gid: gid, kap: g ? g.kap : null, level: g ? (g.level || "A1") : "A1", title: g ? g.title : gid, q: q, i: i });
        });
      });
    } catch (e) {}
    return out;
  }
  function sentPool(o) {
    o = o || {};
    try {
      var Ss = G("SENTENCES") || [];
      return Ss.filter(function (s) {
        if (!s || !s.de) return false;
        if (o.kap && (s.kap || "") !== o.kap) return false;
        if (o.level && ((s.level || s.lvl) || "A1") !== o.level) return false;
        return true;
      });
    } catch (e) { return []; }
  }
  function fillPool(o) {
    o = o || {};
    try {
      var Fs = G("SENT_FILL") || [];
      return Fs.filter(function (f) {
        if (!f || String(f.s || "").indexOf("___") < 0 || !f.o || f.o.length < 3) return false;
        if (o.kap && (f.chapterId || "") !== o.kap) return false;
        if (o.level && (f.lvl || "A1") !== o.level) return false;
        return true;
      });
    } catch (e) { return []; }
  }
  function readingPool(o) {
    o = o || {};
    try {
      var R = G("CURR_READING") || [];
      return R.filter(function (r) {
        if (!r || !r.de) return false;
        if (o.kap && (r.kap || "") !== o.kap) return false;
        if (o.level && (r.level || "A1") !== o.level) return false;
        return true;
      });
    } catch (e) { return []; }
  }
  function listenPool() { try { return G("LISTEN_ITEMS") || []; } catch (e) { return []; } }
  function speakPool() { try { return G("SPEAK_ITEMS") || []; } catch (e) { return []; } }
  function talkPool() { try { return G("TALK_SITS") || []; } catch (e) { return []; } }
  function realPool() { try { return G("REAL_SITS") || []; } catch (e) { return []; } }
  function levelWordCount(lvl) { return vocabPool({ level: lvl }).length; }
  function levelGrammarCount(lvl) { return grammarPool({ level: lvl }).length + glabPool().filter(function (x) { return x.level === lvl; }).length; }
  function levelUnlocked(lvl) {
    if (lvl === "A1") return { ok: true };
    var w = levelWordCount(lvl), g = levelGrammarCount(lvl);
    if (w >= C.CONFIG.LVL_GATE_WORDS && g >= C.CONFIG.LVL_GATE_GRAMMAR) return { ok: true, words: w, grammar: g };
    return { ok: false, words: w, grammar: g };
  }

  var __qid = 0;
  function QID(p) { __qid++; return (p || "q") + "-" + Date.now().toString(36) + "-" + __qid; }
  function fullDe(w) { try { var f = FN("fullDe"); if (f) return f(w); } catch (e) {} return ((w.art && w.art !== "-") ? w.art + " " : "") + w.de; }
  function distractAr(pool, right, n) {
    var out = [], seen = {};
    seen[right] = 1;
    shuffle(pool).forEach(function (w) {
      if (out.length >= n) return;
      if (!w.ar || seen[w.ar]) return;
      seen[w.ar] = 1; out.push(w.ar);
    });
    return out;
  }
  function distractDe(pool, right, n) {
    var out = [], seen = {};
    seen[right] = 1;
    shuffle(pool).forEach(function (w) {
      if (out.length >= n) return;
      var d = fullDe(w);
      if (!d || seen[d]) return;
      seen[d] = 1; out.push(d);
    });
    return out;
  }
  function baseQ(type, skill, src) {
    return {
      id: QID("as"), type: type, skill: skill,
      topic: src.topic || skill, topicAr: src.topicAr || src.topic || skill,
      kap: src.kap || null, level: src.level || "A1",
      diff: src.diff || "medium", why: src.why || "",
      refId: src.refId || null, refKind: src.refKind || null, gid: src.gid || null
    };
  }

  /* ---------- question factories (null = not enough real content) ---------- */
  function mkVocabMean(o) {
    var pool = vocabPool(o);
    if (pool.length < 4) return null;
    var w = shuffle(pool)[0];
    var opts = shuffle([w.ar].concat(distractAr(pool, w.ar, 3)));
    if (opts.length < 4) return null;
    var q = baseQ("mc", "vocab", { topic: "meaning", topicAr: "معاني الكلمات", kap: w.kap, level: w.level || "A1", diff: "easy", refId: w.id, refKind: "word" });
    q.prompt = "ما معنى: " + fullDe(w) + "؟";
    q.de = fullDe(w); q.opts = opts; q.correct = opts.indexOf(w.ar);
    q.why = fullDe(w) + " = " + w.ar;
    return q;
  }
  function mkArticle(o) {
    var pool = vocabPool(o).filter(function (w) { return w.art && w.art !== "-" && /^[A-ZÄÖÜ]/.test(w.de || ""); });
    if (!pool.length) return null;
    var w = shuffle(pool)[0];
    var base = shuffle(["der", "die", "das"]);
    var q = baseQ("mc", "vocab", { topic: "article", topicAr: "الأدوات der/die/das", kap: w.kap, level: w.level || "A1", diff: "easy", refId: w.id, refKind: "word" });
    q.prompt = "اختر الأداة الصحيحة: ___ " + w.de;
    q.de = w.de; q.opts = base; q.correct = base.indexOf(w.art);
    q.why = w.art + " " + w.de + " = " + w.ar + ". تُحفظ الأداة مع الاسم دائمًا.";
    return q;
  }
  function mkPlural(o) {
    var pool = vocabPool(o).filter(function (w) { return w.art && w.art !== "-" && w.plural; });
    if (!pool.length) return null;
    var w = shuffle(pool)[0];
    function pfull(x) { var p = String(x.plural || ""); if (/^(der|die|das)\s/.test(p)) return p; return "die " + p; }
    var right = pfull(w), set = {}, opts = [right];
    set[right] = 1;
    ["die " + w.de, (w.art === "der" ? "die " : "der ") + String(w.plural).replace(/^(der|die|das)\s+/, ""), "das " + w.de].forEach(function (c) { if (opts.length < 4 && !set[c]) { set[c] = 1; opts.push(c); } });
    if (opts.length < 3) return null;
    var q = baseQ("mc", "vocab", { topic: "plural", topicAr: "الجمع Plural", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
    q.prompt = "ما جمع: " + fullDe(w) + "؟";
    q.de = fullDe(w); q.opts = shuffle(opts); q.correct = q.opts.indexOf(right);
    q.why = "الجمع: " + right + " (" + w.ar + ")";
    return q;
  }
  function mkTranslate(o) {
    var pool = vocabPool(o);
    if (pool.length < 4) return null;
    var w = shuffle(pool)[0];
    var opts = shuffle([fullDe(w)].concat(distractDe(pool, fullDe(w), 3)));
    if (opts.length < 4) return null;
    var q = baseQ("mc", "vocab", { topic: "translation", topicAr: "الترجمة عربي ← ألماني", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
    q.prompt = "اختر الكلمة الألمانية الصحيحة: " + w.ar;
    q.opts = opts; q.correct = opts.indexOf(fullDe(w));
    q.why = fullDe(w) + " = " + w.ar;
    return q;
  }
  function mkTF(o) {
    var pool = vocabPool(o);
    if (pool.length < 2) return null;
    var w = shuffle(pool)[0];
    var truth = Math.random() < 0.5;
    var claim = truth ? w.ar : (shuffle(pool.filter(function (x) { return x.id !== w.id && x.ar !== w.ar; }))[0] || {}).ar;
    if (!claim) return null;
    var q = baseQ("tf", "vocab", { topic: "meaning", topicAr: "صح أم خطأ — المفردات", kap: w.kap, level: w.level || "A1", diff: "easy", refId: w.id, refKind: "word" });
    q.prompt = "صح أم خطأ: " + fullDe(w) + " = " + claim + "؟";
    q.de = fullDe(w); q.opts = shuffle(["صح ✅", "خطأ ❌"]); q.correct = q.opts.indexOf(truth ? "صح ✅" : "خطأ ❌");
    q.why = fullDe(w) + " = " + w.ar;
    return q;
  }
  function mkGrammar(o) {
    var gs = grammarPool(o);
    var gl = glabPool().filter(function (x) {
      if (o.kap && x.kap !== o.kap) return false;
      if (o.level && x.level !== o.level) return false;
      return true;
    });
    var useGlab = gl.length && (!gs.length || Math.random() < 0.5);
    if (useGlab) {
      var it = shuffle(gl)[0], gq = it.q;
      var order = shuffle(gq.opts.map(function (_, i) { return i; }));
      var q = baseQ("mc", "grammar", { topic: it.gid, topicAr: it.title || it.gid, kap: it.kap, level: it.level, diff: "medium", gid: it.gid });
      q.prompt = "📐 " + (it.title ? it.title + ": " : "") + gq.t;
      if (gq.ar) q.promptAr = gq.ar;
      q.opts = order.map(function (i) { return gq.opts[i]; }); q.correct = order.indexOf(gq.correct);
      q.why = gq.why || "";
      return q;
    }
    if (!gs.length) return null;
    var g = shuffle(gs)[0];
    var ord = shuffle(g.quiz.opts.map(function (_, i) { return i; }));
    var q2 = baseQ("mc", "grammar", { topic: g.id, topicAr: g.title, kap: g.kap, level: g.level || "A1", diff: "medium", gid: g.id });
    q2.prompt = "📐 " + g.title + ": " + g.quiz.q;
    q2.opts = ord.map(function (i) { return g.quiz.opts[i]; }); q2.correct = ord.indexOf(g.quiz.correct);
    q2.why = g.quiz.explain || "";
    return q2;
  }
  function conjVerbForm(inf) {
    try { var f = FN("conjugateVerb"); if (!f) return null; return f(inf); } catch (e) { return null; }
  }
  function lastTok(s) { var p = String(s || "").trim().split(/\s+/); return p[p.length - 1] || ""; }
  function mkVerb(o) {
    var pool = vocabPool(o).filter(function (w) { return w.type === "فعل"; });
    if (!pool.length) return null;
    var verbs = shuffle(pool), sents = sentPool(o);
    for (var vi = 0; vi < verbs.length; vi++) {
      var w = verbs[vi], conj = conjVerbForm(w.de);
      if (!conj) continue;
      var subs = ["Ich", "Du", "Er", "Wir", "Ihr"], persons = ["ich", "du", "er", "wir", "ihr"];
      var pi = Math.floor(Math.random() * subs.length);
      var form = lastTok(conj[persons[pi]]);
      if (!form) continue;
      var host = null;
      for (var si = 0; si < sents.length; si++) {
        if ((" " + sents[si].de + " ").indexOf(" " + form + " ") >= 0 && sents[si].de.indexOf(subs[pi]) === 0) { host = sents[si]; break; }
      }
      var tail = "";
      if (host) {
        var rest = host.de.slice(subs[pi].length).trim();
        if (rest.indexOf(form) === 0) tail = rest.slice(form.length);
      }
      var distract = [];
      persons.forEach(function (p, i) { if (i !== pi) { var f2 = lastTok(conj[p]); if (f2 && f2 !== form && distract.indexOf(f2) < 0) distract.push(f2); } });
      if (!distract.length) distract.push(w.de);
      while (distract.length < 3) distract.push(w.de);
      var opts = shuffle([form].concat(distract.slice(0, 3)));
      var q = baseQ("mc", "grammar", { topic: "conjugation", topicAr: "تصريف الأفعال", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
      q.prompt = "اختر التصريف الصحيح: " + subs[pi] + " ___" + tail + " (" + w.ar + ")";
      q.de = subs[pi] + " " + form + tail; q.opts = opts; q.correct = opts.indexOf(form);
      q.why = "مع " + subs[pi] + " نقول: " + subs[pi] + " " + form + (host ? " — مثال حقيقي: " + host.de : "");
      return q;
    }
    return null;
  }
  function mkError(o) {
    /* تصحيح الخطأ: wrong sentence shown, pick the fix (verb-based, real). */
    var pool = vocabPool(o).filter(function (w) { return w.type === "فعل"; });
    if (!pool.length) return null;
    var verbs = shuffle(pool), sents = sentPool(o);
    for (var vi = 0; vi < verbs.length; vi++) {
      var w = verbs[vi], conj = conjVerbForm(w.de);
      if (!conj) continue;
      var erF = lastTok(conj.er), ichF = lastTok(conj.ich);
      if (!erF || !ichF || erF === ichF) continue;
      var host = null;
      for (var si = 0; si < sents.length; si++) {
        if (sents[si].de.indexOf("Er " + erF) === 0 || sents[si].de.indexOf("Er " + erF + " ") >= 0) { host = sents[si]; break; }
      }
      if (!host) continue;
      var wrong = host.de.replace("Er " + erF, "Er " + w.de);
      if (wrong === host.de) continue;
      var opts = shuffle([host.de, wrong, host.de.replace("Er " + erF, "Er " + ichF)]);
      var uni = [];
      opts.forEach(function (x) { if (uni.indexOf(x) < 0) uni.push(x); });
      if (uni.length < 2) continue;
      var q = baseQ("mc", "grammar", { topic: "correction", topicAr: "تصحيح الخطأ", kap: w.kap, level: w.level || "A1", diff: "hard", refId: w.id, refKind: "word" });
      q.prompt = "الجملة فيها خطأ: «" + wrong + "» — اختر التصحيح الصحيح:";
      q.de = wrong; q.opts = uni; q.correct = uni.indexOf(host.de);
      q.why = "الصحيح: " + host.de + " — مع Er يأخذ الفعل نهاية خاصة (" + erF + ").";
      return q;
    }
    return null;
  }
  function mkOrder(o) {
    var pool = sentPool(o).filter(function (s) {
      var n = String(s.de || "").replace(/[.?!,]/g, "").split(" ").filter(Boolean).length;
      return n >= 4 && n <= 10;
    });
    if (!pool.length) return null;
    var s = shuffle(pool)[0];
    var parts = shuffle(String(s.de).replace(/[.?!,]/g, "").split(" ").filter(Boolean));
    var q = baseQ("order", "sentences", { topic: "word-order", topicAr: "ترتيب الجملة", kap: s.kap, level: (s.level || s.lvl) || "A1", diff: "medium", refId: s.id, refKind: "sentence" });
    q.prompt = "🔀 رتّب الكلمات لتكوين جملة صحيحة (" + s.ar + "):";
    q.promptAr = s.ar; q.chips = parts; q.answer = String(s.de).replace(/[.?!,]/g, "").trim();
    q.why = "الجملة الصحيحة: " + s.de;
    return q;
  }
  function mkSentenceGap(o) {
    /* إكمال الجملة: real SENT_FILL gap items (mc over the 4 options). */
    var pool = fillPool(o);
    if (!pool.length) return null;
    var f = shuffle(pool)[0];
    var skill = "sentences", topic = "gap", topicAr = "إكمال الجمل";
    var gt = String(f.grammarTarget || f.typ || "");
    if (/article/.test(gt)) { skill = "grammar"; topic = "article"; topicAr = "الأدوات في السياق"; }
    else if (/verb|conjug/.test(gt)) { skill = "grammar"; topic = "conjugation"; topicAr = "الأفعال في السياق"; }
    else if (/meaning|vocab/.test(gt)) { skill = "vocab"; topic = "context"; topicAr = "الكلمة في السياق"; }
    var q = baseQ("mc", skill, { topic: topic, topicAr: topicAr, kap: f.chapterId, level: f.lvl || "A1", diff: "medium", refId: f.id, refKind: "fill" });
    q.prompt = "🧩 أكمل: " + f.s;
    q.de = f.s; q.opts = f.o.slice(); q.correct = f.c;
    q.why = f.why || ("الإجابة: " + f.o[f.c]);
    return q;
  }
  function mkFillWrite(o) {
    /* ✍️ الكتابة: type the missing article/word (writing skill). */
    var pool = fillPool(o).filter(function (f) { return /article/.test(String(f.grammarTarget || f.typ || "")); });
    if (!pool.length) pool = fillPool(o);
    if (!pool.length) return null;
    var f = shuffle(pool)[0];
    var q = baseQ("fill", "writing", { topic: "writing", topicAr: "الكتابة والإملاء", kap: f.chapterId, level: f.lvl || "A1", diff: "medium", refId: f.id, refKind: "fill" });
    q.prompt = "✍️ اكتب الكلمة الناقصة: " + f.s;
    q.de = f.s; q.accept = [String(f.o[f.c])]; q.answer = String(f.o[f.c]);
    q.why = f.why || ("الإجابة: " + f.o[f.c]);
    return q;
  }
  function mkReading(o) {
    var rs = readingPool(o).filter(function (r) { return r.qs && r.qs.length; });
    if (rs.length) {
      var r = shuffle(rs)[0], qq = shuffle(r.qs)[0];
      if (!qq.opts || qq.opts.length < 2) return null;
      var q = baseQ("read", "reading", { topic: "comprehension", topicAr: "فهم المقروء", kap: r.kap, level: r.level || "A1", diff: "medium", refId: r.id, refKind: "reading" });
      q.passage = (r.title ? r.title + "\n" : "") + String(r.de).slice(0, 600);
      q.passageAr = r.ar ? String(r.ar).slice(0, 300) : "";
      q.prompt = "📖 " + qq.q;
      q.opts = qq.opts.slice(); q.correct = qq.correct;
      q.why = "الإجابة من النص: " + (r.title || "") + " — " + q.opts[q.correct];
      return q;
    }
    /* fallback: real sentence as micro-text + meaning question */
    var pool = sentPool(o).filter(function (s) { return String(s.de || "").split(" ").length >= 5; });
    if (pool.length < 4) return null;
    var s = shuffle(pool)[0];
    var opts = shuffle([s.ar].concat(distractAr(words(), s.ar, 3)));
    if (opts.length < 4) return null;
    var q2 = baseQ("read", "reading", { topic: "comprehension", topicAr: "فهم المقروء", kap: s.kap, level: (s.level || s.lvl) || "A1", diff: "easy", refId: s.id, refKind: "sentence" });
    q2.passage = s.de; q2.prompt = "📖 اقرأ ثم اختر المعنى الصحيح:";
    q2.opts = opts; q2.correct = opts.indexOf(s.ar);
    q2.why = s.de + " = " + s.ar;
    return q2;
  }
  function mkListening(o) {
    var pool = listenPool();
    if (pool.length < 4) return null;
    var it = shuffle(pool)[0];
    var others = shuffle(pool.filter(function (x) { return x !== it; })).slice(0, 3).map(function (x) { return x.ar; });
    var opts = shuffle([it.ar].concat(others));
    var q = baseQ("listen", "listening", { topic: "listening", topicAr: "الفهم السمعي", kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q.prompt = "🎧 استمع واختر المعنى الصحيح:";
    q.listenText = it.de; q.opts = opts; q.correct = opts.indexOf(it.ar);
    q.why = it.de + " = " + it.ar;
    return q;
  }
  function mkSpeaking(o) {
    var pool = speakPool();
    if (!pool.length) return null;
    var it = shuffle(pool)[0];
    var q = baseQ("speak", "speaking", { topic: "speaking", topicAr: "التحدث", kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q.prompt = "🎤 أجب بالألمانية: " + it.q;
    q.promptAr = it.ar; q.sample = it.sample;
    q.why = "مثال إجابة: " + it.sample;
    return q;
  }
  function speakKeywords(sample) {
    var stop = {};
    try { var ss = G("SP_STOP"); if (ss && ss.length) ss.forEach(function (w) { stop[w] = 1; }); } catch (e) {}
    ["ich", "du", "er", "sie", "es", "wir", "ihr", "der", "die", "das", "ein", "eine", "und", "ist", "sind", "bin", "nicht", "kein", "keine", "im", "in", "am", "ja", "nein"].forEach(function (w) { stop[w] = 1; });
    return String(sample || "").toLowerCase().replace(/[?!.,;:"„“»«']/g, "").split(/\s+/).filter(function (w) { return w.length > 3 && !stop[w]; });
  }
  function gradeSpeaking(text, sample) {
    try {
      var f = FN("evaluateSpoken");
      if (f) { var ev = f(text, sample); return { pct: ev.vocab || 0, notes: (ev.notes || []).join(" ") + (ev.missing && ev.missing.length ? " — ناقصك: " + ev.missing.join("، ") : "") }; }
    } catch (e) {}
    var tw = String(text || "").toLowerCase().split(/\s+/).filter(Boolean);
    var keys = speakKeywords(sample);
    if (!keys.length) return { pct: tw.length >= 2 ? 70 : 0, notes: "" };
    var hit = keys.filter(function (k) { return tw.indexOf(k) >= 0; });
    return { pct: Math.round(hit.length / keys.length * 100), notes: "" };
  }
  function mkSituation(o) {
    var sits = talkPool();
    if (sits.length) {
      var s = shuffle(sits)[0];
      var steps = (s.steps || []).filter(function (st) { return st[2] && st[2].length >= 3; });
      if (steps.length) {
        var st = shuffle(steps)[0];
        var ord = shuffle(st[2].map(function (_, i) { return i; }));
        var q = baseQ("mc", "practical", { topic: "situation:" + s.id, topicAr: "مواقف: " + s.t, kap: o.kap || null, level: o.level || "A1", diff: "medium" });
        q.prompt = "🌍 " + s.t + " — يقول لك: «" + st[0] + "» (" + st[1] + ") — ما أفضل رد؟";
        q.de = st[0]; q.opts = ord.map(function (i) { return st[2][i]; }); q.correct = ord.indexOf(st[3]);
        q.why = "أفضل رد: " + st[2][st[3]];
        return q;
      }
    }
    var rs = realPool();
    if (!rs.length) return null;
    var r = shuffle(rs)[0];
    var phrs = (r.phr || []).filter(function (p) { return p[0] && p[1]; });
    if (phrs.length < 3) return null;
    var pick = shuffle(phrs)[0];
    var distract = shuffle(phrs.filter(function (p) { return p !== pick; })).slice(0, 3).map(function (p) { return p[0]; });
    var opts = shuffle([pick[0]].concat(distract));
    if (opts.length < 3) return null;
    var q2 = baseQ("mc", "practical", { topic: "situation:" + r.id, topicAr: "مواقف: " + r.t, kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q2.prompt = "🌍 " + r.t + " — «" + pick[1] + "» — ماذا تقول بالألمانية؟";
    q2.opts = opts; q2.correct = opts.indexOf(pick[0]);
    q2.why = pick[0] + " = " + pick[1];
    return q2;
  }
  function mkMatch(o) {
    var pool = vocabPool(o);
    if (pool.length < 6) return null;
    var ws = shuffle(pool).slice(0, 4);
    if (ws.some(function (w) { return !w.ar; })) return null;
    var q = baseQ("match", "vocab", { topic: "match", topicAr: "التوصيل ألماني ↔ عربي", kap: ws[0].kap, level: o.level || "A1", diff: "medium" });
    q.prompt = "🔗 وصّل كل كلمة بمعناها:";
    q.pairs = ws.map(function (w) { return { de: fullDe(w), ar: w.ar, id: w.id }; });
    q.why = ws.map(function (w) { return fullDe(w) + " = " + w.ar; }).join(" • ");
    return q;
  }
  function mkKein(o) {
    /* النفي: kein / keine / nicht — from real nouns + real rule. */
    var pool = vocabPool(o).filter(function (w) { return w.type === "اسم" && w.art && w.art !== "-" && /^[A-ZÄÖÜ]/.test(w.de || ""); });
    if (pool.length < 3) return null;
    var w = shuffle(pool)[0];
    var useNicht = Math.random() < 0.35;
    var right, wrongs, sentence;
    if (useNicht) {
      right = "nicht"; wrongs = ["kein", "keine"];
      sentence = "Ich lerne heute ___ . (" + w.ar + " — الجملة فعلية بدون اسم)";
    } else {
      right = (w.art === "die") ? "keine" : "kein";
      wrongs = [right === "kein" ? "keine" : "kein", "nicht"];
      sentence = "Ich habe ___ " + w.de + ". (" + w.ar + ")";
    }
    var opts = shuffle([right].concat(wrongs));
    var q = baseQ("mc", "grammar", { topic: "negation", topicAr: "النفي kein / nicht", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
    q.prompt = "اختر النفي الصحيح: " + sentence;
    q.de = sentence; q.opts = opts; q.correct = opts.indexOf(right);
    q.why = useNicht
      ? "nicht تنفي الفعل/الجملة: Ich lerne heute nicht."
      : "قبل الأسماء نستخدم kein/keine (وليس nicht): " + (w.art === "die" ? "keine " + w.de : "kein " + w.de) + " — " + w.ar;
    return q;
  }
  function mkConj(o) {
    /* تصريف الأفعال: pronoun rows (ich/du/er...) each with 3 form options. */
    var pool = vocabPool(o).filter(function (w) { return w.type === "فعل"; });
    if (!pool.length) return null;
    var verbs = shuffle(pool);
    var persons = [["ich", "Ich"], ["du", "Du"], ["er", "Er"], ["wir", "Wir"]];
    for (var vi = 0; vi < verbs.length; vi++) {
      var w = verbs[vi], conj = conjVerbForm(w.de);
      if (!conj) continue;
      var forms = {};
      persons.forEach(function (p) { forms[p[0]] = lastTok(conj[p[0]]); });
      if (!forms.ich || !forms.er || forms.ich === forms.er) continue;
      var picks = shuffle(persons).slice(0, 2);
      var rows = [], okAll = true;
      picks.forEach(function (p) {
        var right = forms[p[0]];
        var distract = [];
        persons.forEach(function (q2) { if (q2[0] !== p[0] && forms[q2[0]] && forms[q2[0]] !== right && distract.indexOf(forms[q2[0]]) < 0) distract.push(forms[q2[0]]); });
        if (distract.length < 2) { okAll = false; return; }
        var opts = shuffle([right].concat(distract.slice(0, 2)));
        rows.push({ pron: p[1], key: p[0], opts: opts, correct: opts.indexOf(right) });
      });
      if (!okAll || rows.length < 2) continue;
      var q = baseQ("conj", "grammar", { topic: "conjugation", topicAr: "تصريف الأفعال ich/du/er", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
      q.prompt = "⚡ صرّف الفعل (" + w.de + " — " + w.ar + ") مع كل ضمير:";
      q.rows = rows;
      q.why = picks.map(function (p) { return p[1] + " " + forms[p[0]]; }).join(" • ");
      return q;
    }
    return null;
  }
  function mkWordClass(o) {
    /* أقسام الكلام: Verb / Nomen / Adjektiv from real word types. */
    var pool = vocabPool(o).filter(function (w) { return w.type === "فعل" || w.type === "اسم" || w.type === "صفة"; });
    if (pool.length < 4) return null;
    var w = shuffle(pool)[0];
    var arOf = { "فعل": "فعل Verb", "اسم": "اسم Nomen", "صفة": "صفة Adjektiv" };
    var others = ["فعل", "اسم", "صفة"].filter(function (t) { return t !== w.type; });
    var opts = shuffle([arOf[w.type]].concat(others.map(function (t) { return arOf[t]; })));
    var q = baseQ("mc", "vocab", { topic: "wordclass", topicAr: "أقسام الكلام", kap: w.kap, level: w.level || "A1", diff: "easy", refId: w.id, refKind: "word" });
    q.prompt = "ما نوع الكلمة: " + fullDe(w) + " (" + w.ar + ")؟";
    q.de = fullDe(w); q.opts = opts; q.correct = opts.indexOf(arOf[w.type]);
    q.why = fullDe(w) + " نوعها: " + arOf[w.type];
    return q;
  }
  function mkSentMean(o) {
    /* معنى الجملة: real sentence -> Arabic meaning options. */
    var pool = sentPool(o).filter(function (s) { return String(s.de || "").split(" ").length >= 5; });
    if (pool.length < 4) return null;
    var s = shuffle(pool)[0];
    var opts = shuffle([s.ar].concat(distractAr(words(), s.ar, 3)));
    if (opts.length < 4) return null;
    var q = baseQ("mc", "sentences", { topic: "sentmean", topicAr: "معنى الجملة", kap: s.kap, level: (s.level || s.lvl) || "A1", diff: "easy", refId: s.id, refKind: "sentence" });
    q.prompt = "💬 ما معنى الجملة: «" + s.de + "»؟";
    q.de = s.de; q.opts = opts; q.correct = opts.indexOf(s.ar);
    q.why = s.de + " = " + s.ar;
    return q;
  }
  function mkDialogue(o) {
    /* أكمل الحوار: real TALK_SITS continuation with previous turn as context. */
    var sits = talkPool().filter(function (s) { return s.steps && s.steps.length >= 2; });
    if (!sits.length) return null;
    var s = shuffle(sits)[0];
    var valid = [];
    for (var i = 1; i < s.steps.length; i++) {
      if (s.steps[i][2] && s.steps[i][2].length >= 3) valid.push(i);
    }
    if (!valid.length) return null;
    var i2 = shuffle(valid)[0], prev = s.steps[i2 - 1], st = s.steps[i2];
    var ord = shuffle(st[2].map(function (_, i3) { return i3; }));
    var q = baseQ("mc", "practical", { topic: "dialogue:" + s.id, topicAr: "إكمال الحوار: " + s.t, kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q.prompt = "🗣️ أكمل الحوار (" + s.t + ") — قال: «" + prev[0] + "» فأجبت: «" + prev[2][prev[3]] + "» — ثم قال: «" + st[0] + "» (" + st[1] + ") — ما ردك؟";
    q.de = st[0]; q.opts = ord.map(function (i4) { return st[2][i4]; }); q.correct = ord.indexOf(st[3]);
    q.why = "الرد الطبيعي: " + st[2][st[3]];
    return q;
  }
  function mkListenGap(o) {
    /* استماع بكلمة ناقصة: hear the sentence, pick the missing word. */
    var pool = listenPool().filter(function (x) { return x.de && x.de.split(" ").length >= 4; });
    if (pool.length < 4) return null;
    var it = shuffle(pool)[0];
    var toks = it.de.replace(/[.?!,]/g, "").split(" ").filter(Boolean);
    var cands = toks.map(function (t, i) { return i; }).filter(function (i) { return toks[i].length > 3 && i > 0 && i < toks.length - 1; });
    if (!cands.length) return null;
    var bi = shuffle(cands)[0], missing = toks[bi];
    var others = [];
    shuffle(pool.filter(function (x) { return x !== it; })).forEach(function (x) {
      x.de.replace(/[.?!,]/g, "").split(" ").forEach(function (t) {
        if (others.length < 12 && t.length > 3 && t.toLowerCase() !== missing.toLowerCase() && others.indexOf(t) < 0) others.push(t);
      });
    });
    if (others.length < 3) return null;
    var opts = shuffle([missing].concat(shuffle(others).slice(0, 3)));
    var blanked = toks.slice(); blanked[bi] = "___";
    var q = baseQ("mc", "listening", { topic: "listen-gap", topicAr: "الكلمة الناقصة سمعيًا", kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q.prompt = "🎧 استمع للجملة واختر الكلمة الناقصة: " + blanked.join(" ");
    q.listenText = it.de; q.opts = opts; q.correct = opts.indexOf(missing);
    q.why = "الجملة: " + it.de + " = " + it.ar;
    return q;
  }

  var FACTORIES = {
    vocabMean: mkVocabMean, article: mkArticle, plural: mkPlural, translate: mkTranslate, tf: mkTF,
    grammar: mkGrammar, verb: mkVerb, error: mkError, order: mkOrder, gap: mkSentenceGap,
    fillWrite: mkFillWrite, reading: mkReading, listening: mkListening, speaking: mkSpeaking,
    situation: mkSituation, match: mkMatch,
    kein: mkKein, conj: mkConj, wordClass: mkWordClass, sentMean: mkSentMean,
    dialogue: mkDialogue, listenGap: mkListenGap
  };
  /* build a pool of tagged questions.
     spec = [{factory, skill?, n, kap?, level?, diff?}]
     opts = {cap?, rng?, excludeIds?{refId:1}, validate=true}
     Every question is validated (prompt/options/answer); invalid or
     duplicate items are skipped and reported in notes — the session then
     adapts its size honestly instead of serving broken questions. */
  function buildPool(spec, perFactoryCap, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var excl = opts.excludeIds || null;
    var pool = [], notes = [];
    (spec || []).forEach(function (sl) {
      var fn = FACTORIES[sl.factory];
      if (!fn) return;
      var want = sl.n || 1, tries = 0, got = 0, bad = 0, seen = {};
      while (got < want && tries < want * 12 + 8) {
        tries++;
        var q = null;
        try { q = fn({ kap: sl.kap, level: sl.level, rng: rng }); } catch (e) { q = null; }
        if (!q || seen[q.prompt]) continue;
        if (excl && q.refId && excl[q.refId]) continue;
        if (opts.validate !== false && !C.validateQ(q)) { bad++; continue; }
        seen[q.prompt] = 1;
        if (sl.skill) q.skill = sl.skill;
        if (sl.diff && sl.diff !== "mixed" && sl.diff !== "graded") q.diffLock = sl.diff;
        pool.push(q); got++;
        if (perFactoryCap && got >= perFactoryCap) break;
      }
      if (sl.diff) {
        var before = pool.length;
        var thisSlot = pool.splice(pool.length - got, got);
        var kept = C.filterByDiff(thisSlot, sl.diff);
        kept.forEach(function (q) { pool.push(q); });
        got = kept.length;
      }
      if (got < want) notes.push({ factory: sl.factory, want: want, got: got, bad: bad });
      else if (bad) notes.push({ factory: sl.factory, want: want, got: got, bad: bad });
    });
    return { pool: C.shuffled(pool, rng), notes: notes };
  }
  /* Weakness concepts from real mistake history -> NEW questions on the same
     concept (never the same memorized item). Returns {plan, excludeIds}. */
  var MISTAKE_FACTORIES = {
    artikel: ["article", "wordClass"], plural: ["plural", "wordClass"],
    "ein-kein": ["kein", "article"], "nicht-kein": ["kein", "grammar"],
    pronomen: ["grammar", "gap"], possessiv: ["grammar", "gap"],
    konjugation: ["verb", "conj", "error"], akkusativ: ["grammar", "error", "gap"],
    wortstellung: ["order", "gap"], fragen: ["grammar", "dialogue"],
    praepositionen: ["grammar", "gap", "situation"], allgemein: ["vocabMean", "translate", "match", "sentMean"]
  };
  function mistakePlan(limit) {
    var plan = [], excludeIds = {}, seen = {};
    try {
      var M = (typeof S !== "undefined" && S.mistakes) || {};
      var DM = (typeof DMProgress !== "undefined") ? DMProgress : null;
      Object.keys(M).forEach(function (id) {
        var m = M[id] || {};
        if (m.done) return;
        var skill = "allgemein";
        try {
          if (DM && DM.skillOfMistake) {
            var w = null;
            try { var f = (typeof wordById === "function") ? wordById : null; if (f) w = f(id); } catch (e) {}
            skill = DM.skillOfMistake(m, w) || "allgemein";
          } else if (m.skill) skill = m.skill;
        } catch (e) {}
        var key = skill + "|" + (m.kap || "?");
        if (seen[key]) return;
        seen[key] = 1;
        excludeIds[id] = 1;
        var facs = MISTAKE_FACTORIES[skill] || MISTAKE_FACTORIES.allgemein;
        plan.push({ factory: facs[Object.keys(seen).length % facs.length], skill: null, n: 2, kap: m.kap || null });
      });
    } catch (e) {}
    return { plan: plan.slice(0, limit || 12), excludeIds: excludeIds, concepts: Object.keys(seen).length };
  }

  /*__APPEND__*/
  return {
    kapitelList: kapitelList, kapLabel: kapLabel, levelUnlocked: levelUnlocked,
    levelWordCount: levelWordCount, levelGrammarCount: levelGrammarCount,
    buildPool: buildPool, mistakePlan: mistakePlan, MISTAKE_FACTORIES: MISTAKE_FACTORIES,
    stratify: function (p, s, r) { return C.stratify(p, s, r); },
    gradeSpeaking: gradeSpeaking, esc: esc, say: say, words: words,
    vocabPool: vocabPool, grammarPool: grammarPool, sentPool: sentPool,
    FACTORIES: FACTORIES
  };
})();
/* ============ TEST SPECS (modes) ============ */
DMAssess.specs = (function () {
  "use strict";
  var U = DMAssess.ui;
  function F(factory, n, extra) {
    var o = { factory: factory, n: n };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  /* General mixed tests: stratified by skill, any Kapitel, A1 base. */
  function mixedSpec(count, level) {
    var lv = level || null;
    var per = Math.max(1, Math.floor(count / 8));
    return {
      id: "mixed-" + count, kind: "general", modeTitle: count <= 10 ? "اختبار سريع" : (count <= 25 ? "اختبار متوسط" : "اختبار شامل"),
      minQ: Math.min(count, 6), timed: false,
      build: function () {
        return U.buildPool([
          F("vocabMean", per, { level: lv }), F("article", per, { level: lv }),
          F("translate", per, { level: lv }), F("grammar", per, { level: lv }),
          F("verb", per, { level: lv }), F("order", per, { level: lv }),
          F("gap", per, { level: lv }), F("reading", per, { level: lv }),
          F("listening", per, { level: lv }), F("situation", per, { level: lv })
        ]).pool;
      }
    };
  }
  /* Adaptive placement: A1 -> A2 -> B1 stages. */
  function placementSpec() {
    function stage(level, n) {
      return [
        F("vocabMean", 2, { level: level }), F("article", 1, { level: level }),
        F("grammar", 2, { level: level }), F("verb", 1, { level: level }),
        F("order", 1, { level: level }), F("reading", 1, { level: level }),
        F("listening", 1, { level: level })
      ];
    }
    return {
      id: "placement", kind: "placement", modeTitle: "اختبار تحديد المستوى", minQ: 8, timed: false, adaptive: true,
      stages: [
        { id: "A", level: "A1", plan: stage("A1", 0), need: 8 },
        { id: "B", level: "A2", plan: stage("A2", 0), need: 8 },
        { id: "C", level: "B1", plan: stage("B1", 0), need: 8 }
      ],
      build: function () { return U.buildPool(stage("A1", 0), 3).pool; }
    };
  }
  /* Kapitel test: only that Kapitel's real content. */
  function kapitelSpec(kap) {
    return {
      id: "kap-" + kap, kind: "kapitel", kap: kap, modeTitle: "اختبار " + kap, minQ: 8, timed: false,
      build: function () {
        var o = { kap: kap };
        return U.buildPool([
          F("vocabMean", 2, o), F("article", 2, o), F("plural", 1, o),
          F("grammar", 2, o), F("verb", 1, o), F("order", 1, o),
          F("gap", 2, o), F("reading", 1, o), F("translate", 1, o)
        ]).pool;
      }
    };
  }
  /* Skill test: one skill, 10 questions. */
  var SKILL_FACTORIES = {
    vocab: ["vocabMean", "article", "plural", "translate", "tf", "match"],
    grammar: ["grammar", "verb", "error", "gap"],
    sentences: ["order", "gap", "match"],
    reading: ["reading", "gap"],
    listening: ["listening"],
    writing: ["fillWrite", "order", "gap"],
    speaking: ["speaking"],
    practical: ["situation", "translate"]
  };
  function skillSpec(skill) {
    var facs = SKILL_FACTORIES[skill] || ["vocabMean"];
    return {
      id: "skill-" + skill, kind: "skill", skill: skill,
      modeTitle: "اختبار " + ((DMAssess.SKILLS[skill] || {}).ar || skill), minQ: 6, timed: false,
      build: function () {
        var per = Math.ceil(10 / facs.length), plan = facs.map(function (f) { return F(f, per); });
        return U.buildPool(plan, 4).pool;
      }
    };
  }
  /* Full A1 exam: 6 sections x 4 + 2 speaking, timed. */
  function a1ExamSpec() {
    return {
      id: "exam-a1", kind: "exam", level: "A1", modeTitle: "امتحان A1 الشامل — Deutsch Master",
      minQ: 20, timed: true, secs: DMAssess.CONFIG.EXAM_TIME_SEC, passPct: DMAssess.CONFIG.PASS_A1_EXAM,
      sections: [["Hören — الاستماع", "listening"], ["Lesen — القراءة", "reading"], ["Wortschatz — المفردات", "vocab"], ["Grammatik — القواعد", "grammar"], ["Schreiben — الكتابة", "writing"], ["Sprechen — التحدث", "speaking"]],
      build: function () {
        var L = { level: "A1" };
        return U.buildPool([
          F("listening", 4, L),
          F("reading", 4, L),
          F("vocabMean", 2, L), F("article", 1, L), F("plural", 1, L),
          F("grammar", 2, L), F("verb", 2, L),
          F("order", 2, L), F("fillWrite", 2, L),
          F("speaking", 2, L)
        ], 5).pool;
      }
    };
  }
  function levelExamSpec(level) {
    var L = { level: level };
    return {
      id: "exam-" + level.toLowerCase(), kind: "exam", level: level,
      modeTitle: "امتحان " + level + " الشامل — Deutsch Master",
      minQ: 20, timed: true, secs: DMAssess.CONFIG.EXAM_TIME_SEC, passPct: DMAssess.CONFIG.PASS_A1_EXAM,
      build: function () {
        return U.buildPool([
          F("listening", 4, L), F("reading", 4, L),
          F("vocabMean", 2, L), F("article", 1, L), F("plural", 1, L),
          F("grammar", 3, L), F("verb", 2, L),
          F("order", 2, L), F("fillWrite", 2, L), F("speaking", 2, L)
        ], 5).pool;
      }
    };
  }
  function levelExamSpec(level) {
    var L = { level: level };
    return {
      id: "exam-" + level.toLowerCase(), kind: "exam", level: level,
      modeTitle: "امتحان " + level + " الشامل — Deutsch Master",
      minQ: 20, timed: true, secs: DMAssess.CONFIG.EXAM_TIME_SEC, passPct: DMAssess.CONFIG.PASS_A1_EXAM,
      build: function () {
        return U.buildPool([
          F("listening", 4, L), F("reading", 4, L),
          F("vocabMean", 2, L), F("article", 1, L), F("plural", 1, L),
          F("grammar", 3, L), F("verb", 2, L),
          F("order", 2, L), F("fillWrite", 2, L), F("speaking", 2, L)
        ], 5).pool;
      }
    };
  }
  /* ---- Test Center category registry: id -> label/icon/factories/skill ----
     Single source of truth for picker cards AND builders. Counts shown in the
     UI are probed live from real content (never hardcoded). */
  var CATS = {
    words:     { ar: "الكلمات",      de: "Wörter",      ico: "🟦", facs: ["vocabMean", "match", "wordClass"], skill: "vocab" },
    sentences: { ar: "الجمل",        de: "Sätze",       ico: "🟩", facs: ["gap", "sentMean", "match"], skill: "sentences" },
    ordering:  { ar: "ترتيب الجملة", de: "Satzbau",     ico: "🟨", facs: ["order"], skill: "sentences" },
    grammar:   { ar: "القواعد",      de: "Grammatik",   ico: "🟥", facs: ["grammar", "kein", "gap"], skill: "grammar" },
    verbs:     { ar: "الأفعال",      de: "Verben",      ico: "🟪", facs: ["verb", "conj", "error"], skill: "grammar" },
    articles:  { ar: "المقالات",     de: "Artikel",     ico: "🟧", facs: ["article"], skill: "vocab" },
    plural:    { ar: "الجمع",        de: "Plural",      ico: "🟫", facs: ["plural"], skill: "vocab" },
    translate: { ar: "الترجمة",      de: "Übersetzung", ico: "🔁", facs: ["translate", "sentMean"], skill: "vocab" },
    reading:   { ar: "القراءة",      de: "Lesen",       ico: "📖", facs: ["reading", "sentMean"], skill: "reading" },
    listening: { ar: "الاستماع",     de: "Hören",       ico: "🎧", facs: ["listening", "listenGap"], skill: "listening" },
    reallife:  { ar: "المواقف",      de: "Alltag",      ico: "🌍", facs: ["situation", "dialogue"], skill: "practical" },
    mistakes:  { ar: "أخطائي",       de: "Fehler",      ico: "❌", facs: null, skill: null },
    tfquiz:    { ar: "صح أم خطأ",    de: "Richtig/Falsch", ico: "⚖️", facs: ["tf"], skill: "vocab" },
    writing:   { ar: "الكتابة",      de: "Schreiben",   ico: "✍️", facs: ["fillWrite", "order"], skill: "writing" },
    speaking:  { ar: "التحدث",       de: "Sprechen",    ico: "🎤", facs: ["speaking"], skill: "speaking" }
  };
  var CAT_IDS = Object.keys(CATS);
  var MODES = {
    quick:     { ar: "سريع",  n: 20, de: "20 سؤالًا" },
    normal:    { ar: "عادي",  n: 40, de: "40 سؤالًا" },
    intensive: { ar: "مكثف",  n: 60, de: "60 سؤالًا" },
    advanced:  { ar: "شامل",  n: 80, de: "80 سؤالًا" },
    master:    { ar: "Master", n: 0,  de: "كل المحتوى المتاح" }
  };
  var DIFFS = {
    easy:   { ar: "سهل",   de: "leichte Fragen" },
    medium: { ar: "متوسط", de: "mittlere Fragen" },
    hard:   { ar: "صعب",   de: "schwere Fragen" },
    graded: { ar: "متدرج", de: "سهل ← صعب" }
  };
  /* one category inside one Kapitel, sized by mode + filtered by difficulty.
     mode.n is a TARGET: the pool is sliced to real valid content, and the
     actual count is exposed on pool._actual (never faked upward). Master
     uses MASTER_CAP as the practical upper bound. */
  function kapitelCategorySpec(kap, catId, modeKey, diffKey, level) {
    var cat = CATS[catId];
    var mode = MODES[modeKey] || MODES.quick;
    var diff = DIFFS[diffKey] ? diffKey : "mixed";
    var target = mode.n || DMAssess.CONFIG.MASTER_CAP;
    var o = { kap: kap };
    if (level) o.level = level;
    if (diff !== "mixed" && diff !== "graded") o.diff = diff;
    return {
      id: "kc-" + kap + "-" + catId + "-" + modeKey + "-" + diff,
      kind: "kapitel", cat: catId, kap: kap, level: level || null, target: target,
      modeTitle: (cat ? cat.ar : catId) + " • " + kap + " (" + mode.ar + "، " + (DIFFS[diffKey] || DIFFS.medium).ar + ")",
      minQ: 5, timed: false, diffKey: diff,
      build: function () {
        if (catId === "mistakes") return mistakeSpec(kap).build();
        var per = Math.max(1, Math.ceil(target / (cat.facs.length)));
        /* diff-filtered builds discard non-matching items AFTER collecting,
           so over-collect (bounded) to let the result actually reach the
           target when enough matching content exists. Probe and Start use
           identical parameters, so shown availability stays honest. */
        if (diff !== "mixed" && diff !== "graded") per = Math.min(60, per * 5);
        var plan = cat.facs.map(function (f) { return F(f, per, o); });
        var got = U.buildPool(plan, mode.n ? undefined : 99);
        var pool = got.pool;
        if (diff === "graded") pool = DMAssess.filterByDiff(pool, "graded");
        pool = pool.slice(0, target);
        pool._notes = got.notes;
        pool._actual = pool.length;
        pool._target = target;
        return pool;
      }
    };
  }
  /* full Kapitel exam: balanced mix across all available categories, scaled
     to `total` (default 60). Short categories redistribute automatically:
     buildPool reports real coverage and we slice to what truly exists. */
  function kapitelExamSpec(kap, level, total) {
    total = Math.max(8, Math.min(total || 60, DMAssess.CONFIG.MASTER_CAP));
    return {
      id: "kexam-" + kap, kind: "kapitel", cat: "full", kap: kap, level: level || null, target: total,
      modeTitle: "الامتحان الشامل • " + kap + " (" + total + " سؤالًا)",
      minQ: 8, timed: false,
      build: function () {
        var o = { kap: kap };
        if (level) o.level = level;
        var plan = [];
        /* balanced base: every category contributes; weights mirror the
           recommended 60-question distribution (vocab-heavy, skills mixed) */
        var WEIGHT = { words: 3, sentences: 2, ordering: 2, grammar: 3, verbs: 2, articles: 2, plural: 1, translate: 2, reading: 2, listening: 3, reallife: 2, tfquiz: 1, writing: 1, speaking: 1 };
        var units = 0, wsum = 0;
        CAT_IDS.forEach(function (cid) {
          if (cid === "mistakes") return;
          wsum += (WEIGHT[cid] || 1) * ((CATS[cid].facs || []).length || 1);
        });
        CAT_IDS.forEach(function (cid) {
          if (cid === "mistakes") return;
          var facs = CATS[cid].facs, w = (WEIGHT[cid] || 1);
          facs.forEach(function (f) {
            var n = Math.max(1, Math.round(total * w / Math.max(1, wsum)));
            plan.push(F(f, n, o)); units += n;
          });
        });
        var got = U.buildPool(plan, 99);
        var pool = DMAssess.shuffled(got.pool).slice(0, total);
        pool._notes = got.notes;
        pool._actual = pool.length;
        pool._target = total;
        return pool;
      }
    };
  }
  /* mixed test with explicit percent distribution {vocab:20, grammar:20...} */
  function mixedDistSpec(dist, o) {
    o = o || {};
    var counts = DMAssess.distribute(o.total || 20, dist || { vocab: 20, grammar: 20, sentences: 20, verbs: 10, listening: 10, reading: 10, practical: 10 });
    var DIST_FACS = {
      vocab: ["vocabMean", "article", "translate", "match", "wordClass"],
      grammar: ["grammar", "kein", "gap"], sentences: ["gap", "order", "sentMean"],
      verbs: ["verb", "conj", "error"], listening: ["listening", "listenGap"],
      reading: ["reading", "sentMean"], practical: ["situation", "dialogue"],
      writing: ["fillWrite", "order"], speaking: ["speaking"]
    };
    return {
      id: "dist-" + Date.now().toString(36), kind: "general",
      modeTitle: "اختبار متنوع (" + (o.total || 20) + " سؤالًا)", minQ: 5, timed: false,
      build: function () {
        var plan = [];
        Object.keys(counts).forEach(function (sk) {
          var facs = DIST_FACS[sk] || ["vocabMean"];
          var per = Math.ceil(counts[sk] / facs.length) || 0;
          facs.forEach(function (f) { if (per > 0) plan.push(F(f, per, { kap: o.kap || null, level: o.level || null })); });
        });
        var got = U.buildPool(plan, 99, o.rng ? { rng: o.rng } : null);
        var pool = DMAssess.shuffled(got.pool, o.rng);
        return pool.slice(0, o.total || 20);
      }
    };
  }
  /* custom builder result: levels[], kaps[], cats[], diff, count, mode */
  function customSpec(b) {
    b = b || {};
    var levels = (b.levels && b.levels.length ? b.levels : [null]);
    var kaps = (b.kaps && b.kaps.length ? b.kaps : [null]);
    var cats = (b.cats && b.cats.length ? b.cats : ["words", "grammar", "sentences"]);
    var total = b.count || 10, diff = b.diff || "mixed", mode = b.mode || "test";
    return {
      id: "custom-" + Date.now().toString(36), kind: "general", customMode: mode,
      modeTitle: "اختباري الخاص (" + total + " • " + cats.length + " فئات)",
      minQ: 5, timed: mode === "exam",
      secs: mode === "exam" ? DMAssess.CONFIG.EXAM_TIME_SEC : 0,
      qTimed: mode === "challenge", qSecs: DMAssess.CONFIG.QTIME_SEC,
      passPct: mode === "exam" ? DMAssess.CONFIG.PASS_A1_EXAM : 0,
      build: function () {
        var per = Math.max(1, Math.ceil(total / Math.max(1, cats.length * levels.length * kaps.length)));
        var plan = [];
        cats.forEach(function (cid) {
          if (cid === "mistakes") return;
          var facs = (CATS[cid] || {}).facs || ["vocabMean"];
          levels.forEach(function (lv) {
            kaps.forEach(function (kp) {
              facs.forEach(function (f) {
                var slot = F(f, per, {});
                if (lv) slot.level = lv;
                if (kp) slot.kap = kp;
                if (diff !== "mixed" && diff !== "graded") slot.diff = diff;
                plan.push(slot);
              });
            });
          });
        });
        var got = U.buildPool(plan, 99);
        var pool = got.pool;
        if (diff === "graded") pool = DMAssess.filterByDiff(pool, "graded");
        pool = DMAssess.shuffled(pool).slice(0, total);
        pool._notes = got.notes;
        return pool;
      }
    };
  }
  /* mistake test: same weak concepts, NEW questions (same item excluded) */
  function mistakeSpec(kap) {
    return {
      id: "mist-" + (kap || "all") + "-" + Date.now().toString(36), kind: "skill", skill: "mixed-weak",
      modeTitle: "اختبرني في أخطائي" + (kap ? " • " + kap : ""), minQ: 4, timed: false,
      build: function () {
        var mp = U.mistakePlan(12);
        if (!mp.plan.length) return [];
        var plan = mp.plan.map(function (sl) {
          if (kap) sl.kap = kap;
          sl.n = 2;
          return sl;
        });
        return U.buildPool(plan, 4, { excludeIds: mp.excludeIds }).pool;
      }
    };
  }
  /* daily challenge: fixed composition, date-seeded => same test all day */
  function dailySpec(dateStr) {
    var seed = dateStr || "today";
    return {
      id: "daily-" + seed, kind: "general",
      modeTitle: "تحدي اليوم 🎯", minQ: 8, timed: false, seed: seed,
      build: function () {
        var rng = DMAssess.seededRng(seed);
        var got = U.buildPool([
          F("vocabMean", 3, {}), F("grammar", 2, {}), F("gap", 2, {}),
          F("listening", 2, {}), F("situation", 1, {}), F("article", 2, {})
        ], 4, { rng: rng });
        return DMAssess.shuffled(got.pool, rng).slice(0, 12);
      }
    };
  }
  /* boss test: hard-heavy surprise mix; unlock = readiness>=50 OR 3 tests */
  function bossUnlock(kap, rmap, history) {
    var r = (rmap || {})[kap];
    var tested = 0;
    try {
      (history || []).forEach(function (h) {
        if (h.kapitel === kap || (h.kaps && h.kaps[kap] && h.kaps[kap].n >= 4)) tested++;
      });
    } catch (e) {}
    if (r && r.pct >= DMAssess.CONFIG.BOSS_UNLOCK_READY) return { ok: true, why: "إتقان " + kap + ": " + r.pct + "%" };
    if (tested >= 3) return { ok: true, why: tested + " اختبارات في " + kap };
    return { ok: false, why: "يحتاج إتقان " + DMAssess.CONFIG.BOSS_UNLOCK_READY + "% أو 3 اختبارات في " + kap + " (التعلّم نفسه مفتوح دائمًا)" };
  }
  function bossSpec(kap, total) {
    total = Math.max(10, Math.min(total || 40, DMAssess.CONFIG.MASTER_CAP));
    return {
      id: "boss-" + kap, kind: "kapitel", cat: "boss", kap: kap, target: total,
      modeTitle: "اختبار الزعيم 👑 • " + kap + " (" + total + " سؤالًا)",
      minQ: 8, timed: false, adaptiveDiff: true,
      build: function () {
        var o = { kap: kap };
        var got = U.buildPool([
          F("error", Math.ceil(total * 0.15), o), F("conj", Math.ceil(total * 0.12), o),
          F("kein", Math.ceil(total * 0.10), o), F("order", Math.ceil(total * 0.12), o),
          F("listenGap", Math.ceil(total * 0.12), o), F("dialogue", Math.ceil(total * 0.08), o),
          F("grammar", Math.ceil(total * 0.12), o), F("match", Math.ceil(total * 0.06), o),
          F("reading", Math.ceil(total * 0.06), o), F("situation", Math.ceil(total * 0.07), o)
        ], 99);
        var pool = DMAssess.filterByDiff(got.pool, "graded");
        pool = pool.slice(0, total);
        pool._notes = got.notes;
        pool._actual = pool.length;
        pool._target = total;
        return pool;
      }
    };
  }
  /* cumulative test: Kapitel range (e.g. K1..K3 or whole A1). Stays inside
     the selected kaps only — never leaks other content. Balanced by skill. */
  function cumulSpec(kaps, total, o) {
    o = o || {};
    kaps = (kaps || []).slice();
    total = Math.max(8, Math.min(total || 60, DMAssess.CONFIG.MASTER_CAP));
    return {
      id: "cumul-" + kaps.join("-") + "-" + total, kind: "kapitel", cat: "cumul",
      kap: kaps.length === 1 ? kaps[0] : null, kaps: kaps, level: o.level || null, target: total,
      modeTitle: "اختبار تراكمي 📚 (" + (kaps.join(" + ") || "الكل") + ") • " + total + " سؤالًا)",
      minQ: 8, timed: false,
      build: function () {
        var dist = { vocab: 22, grammar: 18, sentences: 16, verbs: 12, listening: 10, reading: 10, practical: 12 };
        var counts = DMAssess.distribute(total, dist);
        var DIST_FACS = {
          vocab: ["vocabMean", "article", "translate", "match", "wordClass"],
          grammar: ["grammar", "kein", "gap"], sentences: ["gap", "order", "sentMean"],
          verbs: ["verb", "conj", "error"], listening: ["listening", "listenGap"],
          reading: ["reading", "sentMean"], practical: ["situation", "dialogue"]
        };
        var plan = [];
        Object.keys(counts).forEach(function (sk) {
          var facs = DIST_FACS[sk] || ["vocabMean"];
          var perKap = Math.max(1, Math.ceil(counts[sk] / Math.max(1, kaps.length) / facs.length));
          kaps.forEach(function (kp) {
            facs.forEach(function (f) {
              var slot = F(f, perKap, {});
              slot.kap = kp;
              if (o.level) slot.level = o.level;
              plan.push(slot);
            });
          });
          if (!kaps.length) facs.forEach(function (f) {
            var slot = F(f, Math.max(1, Math.ceil(counts[sk] / facs.length)), {});
            if (o.level) slot.level = o.level;
            plan.push(slot);
          });
        });
        var got = U.buildPool(plan, 99);
        var pool = DMAssess.shuffled(got.pool).slice(0, total);
        pool._notes = got.notes;
        pool._actual = pool.length;
        pool._target = total;
        return pool;
      }
    };
  }
  /* smart test-me: weakness-weighted distribution from real history */
  function smartSpec(o) {
    o = o || {};
    var total = Math.max(8, Math.min(o.total || 40, DMAssess.CONFIG.MASTER_CAP));
    return {
      id: "smart-" + Date.now().toString(36), kind: "general", cat: "smart",
      kap: o.kap || null, level: o.level || null, target: total,
      modeTitle: "اختبرني بذكاء 🧠 (" + total + " سؤالًا)", minQ: 6, timed: false,
      build: function () {
        var dist = { vocab: 15, grammar: 15, sentences: 15, verbs: 10, listening: 10, reading: 10, practical: 10, writing: 8, speaking: 7 };
        try {
          if (o.weakSkills && o.weakSkills.length) {
            var boost = {};
            o.weakSkills.forEach(function (s) { boost[s] = 3; });
            Object.keys(dist).forEach(function (k) { dist[k] = dist[k] * (boost[k] || 1); });
          }
        } catch (e) {}
        return mixedDistSpec(dist, { total: total, kap: o.kap || null, level: o.level || null }).build();
      }
    };
  }
  return { mixedSpec: mixedSpec, placementSpec: placementSpec, kapitelSpec: kapitelSpec, skillSpec: skillSpec, a1ExamSpec: a1ExamSpec, levelExamSpec: levelExamSpec, SKILL_FACTORIES: SKILL_FACTORIES, CATS: CATS, CAT_IDS: CAT_IDS, MODES: MODES, DIFFS: DIFFS, kapitelCategorySpec: kapitelCategorySpec, kapitelExamSpec: kapitelExamSpec, mixedDistSpec: mixedDistSpec, customSpec: customSpec, mistakeSpec: mistakeSpec, dailySpec: dailySpec, bossSpec: bossSpec, cumulSpec: cumulSpec, bossUnlock: bossUnlock, smartSpec: smartSpec };
})();
/* ============ SESSION RUNNER + STORE ============ */
DMAssess.app = (function () {
  "use strict";
  var C = DMAssess, U = DMAssess.ui;
  var sess = null, timerInt = null;
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function FN(name) { try { var f = window[name]; return typeof f === "function" ? f : null; } catch (e) { return null; } }
  function esc(s) { return U.esc(s); }
  function toast(m, k) { try { var f = FN("toast"); if (f) f(m, k || "ok"); } catch (e) {} }
  function save() { try { var f = FN("save"); if (f) f(); } catch (e) {} }

  function ensureStore() {
    try {
      if (typeof S === "undefined") return null;
      if (!S.assess || typeof S.assess !== "object") S.assess = {};
      if (S.assess.v !== C.CONFIG.STORE_V) S.assess.v = C.CONFIG.STORE_V;
      if (!Array.isArray(S.assess.history)) S.assess.history = [];
      return S.assess;
    } catch (e) { return null; }
  }
  function normWrite(s) { return String(s || "").trim().toLowerCase().replace(/[.?!،؛:"]+$/g, "").replace(/\s+/g, " ").trim(); }
  function skillAr(s) { return ((C.SKILLS[s] || {}).ar) || s; }

  /* ---------- progress integration (evidence-based, no double count) ---------- */
  function wordById(id) {
    try { var f = FN("wordById"); if (f) { var w = f(id); if (w) return w; } } catch (e) {}
    try { var ws = U.words(); for (var i = 0; i < ws.length; i++) if (ws[i].id === id) return ws[i]; } catch (e2) {}
    return null;
  }
  function logAttempt(q, ok, ms) {
    try {
      if (typeof DMProgress !== "undefined" && DMProgress.logAttempt && typeof S !== "undefined") {
        S.evSeq = (S.evSeq || 0) + 1;
        DMProgress.logAttempt(S, DMProgress.makeAttempt({
          aid: "as" + S.evSeq + "-" + Date.now().toString(36),
          sec: "assess", session: sess ? sess.spec.id : "assess",
          qid: q.refId || q.id, qtype: q.type, ref: q.refId || "",
          lvl: q.level || "", kap: q.kap || "",
          ok: ok === true, ms: ms || 0
        }));
      } else if (typeof S !== "undefined") {
        S.totalAnswered = (S.totalAnswered || 0) + 1;
        if (ok) S.totalCorrect = (S.totalCorrect || 0) + 1;
      }
      save();
    } catch (e) {}
  }
  function progressSideEffects(q, ok, userText) {
    try {
      if (q.gid && FN("gramRecord")) FN("gramRecord")(q.gid, ok === true);
      var w = q.refId ? wordById(q.refId) : null;
      if (w && FN("recordMistake") && !ok) {
        var right = correctTextOf(q);
        FN("recordMistake")(w, userText || "", "assess-" + q.type, { q: q.prompt, ok: right, chapterId: q.kap || w.kap });
      }
      if (w && ok && FN("noteMastered")) { try { FN("noteMastered")(w.id); } catch (e) {} }
      if (ok && FN("addXP")) FN("addXP")(2);
    } catch (e) {}
  }
  function correctTextOf(q) {
    if (q.type === "order") return q.answer;
    if (q.type === "fill") return q.answer;
    if (q.type === "match") return q.why;
    if (q.type === "speak") return q.sample;
    if (q.type === "conj" && q.rows) return q.rows.map(function (r) { return r.pron + " " + r.opts[r.correct]; }).join(" • ");
    if (q.opts && typeof q.correct === "number") return q.opts[q.correct];
    return q.why || "";
  }

  /* ---------- flow ---------- */
  function shortageMsg(pool, minQ, title) {
    var bySkill = {};
    pool.forEach(function (q) { bySkill[q.skill] = (bySkill[q.skill] || 0) + 1; });
    return '<div class="panel glass"><h3>⚠️ ' + esc(title) + '</h3>' +
      '<div class="muted">لا يوجد محتوى كافٍ لهذا الاختبار حاليًا (متاح: ' + pool.length + ' — المطلوب: ' + minQ + '). ' +
      'هذه نتيجة صادقة وليست درجة مخترعة. جرّب اختبارًا آخر أو أكمل الدروس أولًا.</div>' +
      '<div class="muted">التغطية المتاحة: ' + Object.keys(bySkill).map(function (s) { return esc(skillAr(s)) + " (" + bySkill[s] + ")"; }).join(" • ") + '</div>' +
      '<div class="row-flex"><button class="btn btn-ghost sm" data-as="dash">← عودة للمركز</button></div></div>';
  }
  /* Header-aware focus: smooth-scrolls an element into view without hiding
     it under the fixed top header or the mobile bottom nav. Uses CSS
     scroll-margin-top where present; the JS offset is the safety net for
     older WebViews. Never scrolls to page top. */
  function focusBelowHeader(elOrId, opts) {
    try {
      var el = typeof elOrId === "string" ? $(elOrId) : elOrId;
      if (!el) return false;
      var extra = (opts && opts.extra) || 8;
      var hdr = 76;
      try {
        var hb = document.getElementById("dmTopHeader");
        if (hb) hdr = Math.max(hdr, Math.ceil(hb.getBoundingClientRect().height) + 10);
        var cs = getComputedStyle(document.documentElement);
        var vh = parseInt(cs.getPropertyValue("--dm-header-h"), 10);
        if (vh > hdr) hdr = vh + 10;
      } catch (e2) {}
      var y = 0;
      try {
        var r = el.getBoundingClientRect();
        y = (window.pageYOffset || document.documentElement.scrollTop || 0) + r.top - hdr - extra;
      } catch (e3) { return false; }
      if (y < 0) y = 0;
      try { window.scrollTo({ top: y, behavior: "smooth" }); }
      catch (e4) { try { window.scrollTo(0, y); } catch (e5) {} }
      try { if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1"); } catch (e6) {}
      return true;
    } catch (e) { return false; }
  }
  function startFlow(spec, opts) {
    opts = opts || {};
    ensureStore();
    var pool = [];
    try { pool = spec.build() || []; } catch (e) { pool = []; }
    pool = C.shuffled(pool).slice(0, opts.limit || pool.length || 0);
    if (pool.length < (spec.minQ || 6)) {
      var host = $("assessRunner") || $("assessRoot");
      if (host) { host.innerHTML = shortageMsg(pool, spec.minQ || 6, spec.modeTitle); wireDashBtns(host); }
      try { if (typeof showPage === "function") showPage("quiz"); } catch (e) {}
      return false;
    }
    sess = {
      spec: { id: spec.id, kind: spec.kind, modeTitle: spec.modeTitle, timed: !!spec.timed, secs: spec.secs || 0, passPct: spec.passPct || 0, kap: spec.kap || null, kaps: spec.kaps || null, total: spec.target || null, skill: spec.skill || null, level: spec.level || null, cat: spec.cat || null, mode: spec.customMode || (spec.kind === "exam" ? "exam" : "test"), diffKey: spec.diffKey || null, seed: spec.seed || null },
      specRef: spec, qs: pool, ans: pool.map(function () { return null; }),
      idx: 0, startedAt: Date.now(),
      deadline: spec.timed ? Date.now() + (spec.secs || C.CONFIG.EXAM_TIME_SEC) * 1000 : 0,
      stages: spec.adaptive ? [{ id: "A", level: "A1", n: pool.length, ok: 0, done: 0 }] : null,
      stageIdx: 0, t0q: Date.now(), autoSpoke: {},
      combo: 0, bestCombo: 0, perfects: 0,
      qTimed: !!spec.qTimed, qSecs: spec.qSecs || C.CONFIG.QTIME_SEC, qDeadline: 0,
      adaptiveDiff: !!spec.adaptiveDiff
    };
    if (sess.qTimed) sess.qDeadline = Date.now() + sess.qSecs * 1000;
    persistInProgress();
    renderRunner();
    try { if (typeof showPage === "function") showPage("quiz"); } catch (e) {}
    /* Focus the runner workspace (header-aware). showPage() already scrolled
       to top on page switches; this runs after so the runner stays visible
       without hiding under the fixed header. */
    setTimeout(function () { focusBelowHeader("assessRunner"); }, 80);
    return true;
  }
  function persistInProgress() {
    try {
      var st = ensureStore(); if (!st || !sess) return;
      st.inProgress = {
        v: C.CONFIG.STORE_V, specMeta: sess.spec,
        qs: sess.qs, ans: sess.ans, idx: sess.idx,
        startedAt: sess.startedAt, deadline: sess.deadline,
        stages: sess.stages, stageIdx: sess.stageIdx,
        combo: sess.combo || 0, bestCombo: sess.bestCombo || 0, perfects: sess.perfects || 0
      };
      save();
    } catch (e) {}
  }
  function clearInProgress() {
    try { var st = ensureStore(); if (st) { st.inProgress = null; save(); } } catch (e) {}
  }
  function resumeFlow() {
    try {
      var st = ensureStore();
      var ip = st && st.inProgress;
      if (!ip || ip.v !== C.CONFIG.STORE_V || !ip.qs || !ip.qs.length) return false;
      if (Date.now() - (ip.startedAt || 0) > C.CONFIG.RESUME_TTL_DAYS * 86400000) { clearInProgress(); return false; }
      var spec = null;
      try {
        var S2 = DMAssess.specs, m = ip.specMeta || {};
        if (m.id === "placement") spec = S2.placementSpec();
        else if (m.kind === "kapitel" && m.kap && !m.cat) spec = S2.kapitelSpec(m.kap);
        else if (m.kind === "kapitel" && m.kap && m.cat === "full") spec = S2.kapitelExamSpec(m.kap, m.level, m.total);
        else if (m.kind === "kapitel" && m.cat === "cumul") spec = S2.cumulSpec(m.kaps || (m.kap ? [m.kap] : []), m.total, { level: m.level });
        else if (m.kind === "kapitel" && m.kap && m.cat === "boss") spec = S2.bossSpec(m.kap, m.total);
        else if (m.kind === "kapitel" && m.kap && m.cat) spec = S2.kapitelCategorySpec(m.kap, m.cat, "normal", m.diffKey || "mixed", m.level);
        else if (m.kind === "skill" && m.skill && S2.SKILL_FACTORIES[m.skill]) spec = S2.skillSpec(m.skill);
        else if (m.id === "exam-a1") spec = S2.a1ExamSpec();
        else if (m.kind === "exam" && m.level) spec = S2.levelExamSpec(m.level);
        else spec = S2.mixedSpec(ip.qs.length);
        /* carry session behavior flags for rebuilt/new-kind specs */
        if (spec && m) {
          if (m.mode === "challenge") { spec.qTimed = true; spec.qSecs = DMAssess.CONFIG.QTIME_SEC; }
          if (m.mode === "exam" && !spec.timed) { spec.timed = true; spec.secs = DMAssess.CONFIG.EXAM_TIME_SEC; }
          if (m.cat === "boss") spec.adaptiveDiff = true;
        }
      } catch (e) { spec = null; }
      if (!spec) return false;
      sess = {
        spec: ip.specMeta, specRef: spec, qs: ip.qs, ans: ip.ans || ip.qs.map(function () { return null; }),
        idx: Math.min(ip.idx || 0, ip.qs.length - 1), startedAt: ip.startedAt,
        deadline: ip.deadline || 0, stages: ip.stages || null, stageIdx: ip.stageIdx || 0,
        t0q: Date.now(), autoSpoke: {},
        combo: ip.combo || 0, bestCombo: ip.bestCombo || 0, perfects: ip.perfects || 0,
        qTimed: !!(ip.specMeta && ip.specMeta.mode === "challenge"), qSecs: DMAssess.CONFIG.QTIME_SEC,
        qDeadline: 0, adaptiveDiff: !!(ip.specMeta && (ip.specMeta.cat === "boss" || ip.specMeta.adaptiveDiff))
      };
      if (sess.qTimed && !sess.ans[sess.idx]) sess.qDeadline = Date.now() + sess.qSecs * 1000;
      if (sess.deadline && Date.now() >= sess.deadline) { finish(true); return true; }
      renderRunner();
      try { if (typeof showPage === "function") showPage("quiz"); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  function discardFlow() {
    sess = null; stopTimer(); clearInProgress();
    renderCenter();
  }

  /* ---------- runner rendering ---------- */
  function stopTimer() { try { if (timerInt) { clearInterval(timerInt); timerInt = null; } } catch (e) {} }
  function finish(auto) { try { return DMAssess.center.finish(auto); } catch (e) { if (window.console) console.error("assess finish", e); return null; } }
  function renderCenter() { try { return DMAssess.center.renderCenter(); } catch (e) { if (window.console) console.error("assess center", e); } }
  function tickTimer() {
    if (!sess) return;
    if (sess.deadline) {
      var left = Math.max(0, Math.round((sess.deadline - Date.now()) / 1000));
      var el = $("asrTimer");
      if (el) {
        var m = Math.floor(left / 60), s = left % 60;
        el.textContent = "⏱️ " + m + ":" + (s < 10 ? "0" : "") + s;
        el.classList.toggle("asr-danger", left < 180);
      }
      persistThrottleTick(left);
      if (left <= 0) { toast("⏱️ انتهى الوقت — يتم تسليم الاختبار تلقائيًا", "err"); finish(true); return; }
    }
    /* challenge per-question countdown */
    if (sess.qTimed && sess.qDeadline && !sess.ans[sess.idx]) {
      var ql = Math.max(0, Math.ceil((sess.qDeadline - Date.now()) / 1000));
      /* Backgrounded app: freeze the per-question clock instead of failing
         the user for leaving. Each throttled background tick pushes the
         deadline forward so the countdown effectively pauses; the visible
         countdown resumes intact on return. Overall exam deadlines keep
         their honest wall-clock (exam semantics, resumed via inProgress). */
      var hiddenNow = false;
      try { hiddenNow = !!(typeof document !== "undefined" && document.hidden); } catch (e) {}
      if (hiddenNow) {
        try { sess.qDeadline += 500; } catch (e) {}
      } else {
        var qe = $("asrQTimer");
        if (qe) {
          qe.textContent = "⏱️ " + ql + "s";
          qe.classList.toggle("asr-danger", ql <= 4);
        }
        if (ql <= 0) {
          var q = sess.qs[sess.idx];
          toast("⏱️ انتهى وقت السؤال!", "err");
          lockAnswer(q, { ok: false, user: "— (انتهى الوقت)", correct: correctTextOf(q), timeout: true });
        }
      }
    }
  }
  var __lastPersist = 0;
  function persistThrottleTick(left) {
    try {
      var now = Date.now();
      if (now - __lastPersist > 10000 || left <= 0) { __lastPersist = now; persistInProgress(); }
    } catch (e) {}
  }
  function renderRunner() {
    stopTimer();
    if (!sess) { renderCenter(); return; }
    var root = $("assessRoot"); if (!root) return;
    var done = sess.ans.filter(Boolean).length;
    root.innerHTML = '<div id="assessRunner" class="asr-wrap"></div>';
    renderQ();
    if ((sess.spec.timed && sess.deadline) || sess.qTimed) { timerInt = setInterval(tickTimer, 500); }
    try {
      var before = window.onbeforeunload;
      window.onbeforeunload = function (e) {
        if (sess && sess.ans.filter(Boolean).length < sess.qs.length) { e.preventDefault(); e.returnValue = ""; return ""; }
        return null;
      };
      sess._prevUnload = before;
    } catch (e) {}
  }
  function modeBadge() {
    var m = (sess && sess.spec.mode) || "test";
    return m === "training" ? "🟢 تدريب" : m === "challenge" ? "🟡 تحدي" : m === "exam" ? "🔴 امتحان" : "🔵 اختبار";
  }
  function qStatusLine() {
    var done = sess.ans.filter(Boolean).length;
    return '<div class="quiz-top"><span id="asrQNum">' + (sess.idx + 1) + ' / ' + sess.qs.length + '</span>' +
      '<div class="progress"><div class="progress-fill" style="width:' + Math.round(done / sess.qs.length * 100) + '%"></div></div>' +
      '<span class="muted">✅ ' + done + '</span>' +
      (sess.combo >= 2 ? '<span class="asr-combo">🔥x' + sess.combo + '</span>' : '') +
      '<span class="asr-mode">' + modeBadge() + '</span>' +
      (sess.spec.timed ? '<span id="asrTimer" class="asr-timer">⏱️ …</span>' : '') +
      (sess.qTimed && !sess.ans[sess.idx] ? '<span id="asrQTimer" class="asr-timer">⏱️ …</span>' : '') + '</div>';
  }
  function renderQ() {
    var box = $("assessRunner"); if (!box || !sess) return;
    var q = sess.qs[sess.idx], a = sess.ans[sess.idx];
    var stageTag = "";
    if (sess.stages && sess.stages.length > 1) {
      var st = sess.stages[sess.stageIdx];
      stageTag = '<div class="muted">المرحلة ' + esc(st.id) + ' (مستوى ' + esc(st.level) + ')</div>';
    } else if (sess.spec.kind === "placement") {
      stageTag = '<div class="muted">المرحلة A (مستوى A1) — أجب بتركيز، الصعوبة تتكيف مع مستواك</div>';
    }
    var h = '<div class="panel glass"><div class="asr-head"><b>' + esc(sess.spec.modeTitle) + '</b>' +
      '<button class="btn btn-ghost sm" data-as="quit">إنهاء وحفظ ✖</button></div>' +
      stageTag + qStatusLine();
    if (q.passage) h += '<div class="asr-passage" dir="auto"><div class="asr-de" dir="ltr">' + esc(q.passage) + '</div>' + (q.passageAr ? '<div class="muted">' + esc(q.passageAr) + '</div>' : '') + '</div>';
    h += '<h3 class="asr-prompt">' + esc(q.prompt) + '</h3>';
    if (q.promptAr) h += '<div class="muted">' + esc(q.promptAr) + '</div>';
    if (q.type === "listen") h += '<div class="row-flex"><button class="btn btn-gold sm" data-as="hear">🔊 استمع</button></div>';
    h += '<div id="asrBody"></div><div class="quiz-feedback hidden" id="asrFb"></div>';
    h += '<div class="row-flex asr-nav"><button class="btn btn-ghost sm" data-as="prev">⏮ السابق</button>' +
      ((a || q.type === "match") ? "" : '<button class="btn btn-primary sm" data-as="submit">تحقق ✅</button>') +
      '<button class="btn btn-ghost sm" data-as="next">التالي ⏭</button></div>';
    if (!a && q.type === "match") h += '<div class="muted">💡 أكمل التوصيل — يتم التقييم تلقائيًا عند الانتهاء.</div>';
    if (!a) h += '<div class="muted">💡 أجب ثم اضغط «تحقق». الإجابة المثبتة لا يمكن تغييرها — مثل الامتحان الحقيقي.</div>';
    h += '</div>';
    box.innerHTML = h;
    renderBody(q, a);
    if (a) showLockedFeedback(q, a);
    else if (q.type === "listen" && !sess.autoSpoke[q.id]) { sess.autoSpoke[q.id] = 1; setTimeout(function () { U.say(q.listenText); }, 450); }
    wireRunner(q);
    tickTimer();
  }
  function renderBody(q, a) {
    var b = $("asrBody"); if (!b) return;
    if (q.type === "order") {
      b.innerHTML = '<div class="quiz-opts" id="asrPool" dir="ltr"></div>' +
        '<div class="asr-ans" id="asrAns" dir="ltr"></div>' +
        (a ? '' : '<div class="row-flex"><button class="btn btn-ghost sm" data-as="clear">مسح 🗑️</button></div>');
      var pool = $("asrPool");
      var picked = a ? a.pickedArr || [] : [];
      if (a) {
        $("asrAns").innerHTML = picked.map(function (p) { return '<span class="order-chip">' + esc(p) + '</span>'; }).join("");
        try { var pb = document.querySelector('[data-as="clear"]'); if (pb) pb.remove(); } catch (e) {}
      } else {
        sess._picked = [];
        q.chips.forEach(function (c) {
          var btn = document.createElement("button");
          btn.className = "order-chip"; btn.textContent = c; btn.type = "button";
          btn.addEventListener("click", function () {
            if (btn.classList.contains("used")) return;
            btn.classList.add("used"); sess._picked.push(c); drawAns();
          });
          pool.appendChild(btn);
        });
        window.__asrDraw = drawAns;
      }
      function drawAns() {
        var ans = $("asrAns"); if (!ans) return;
        ans.innerHTML = (sess._picked || []).map(function (p, i) { return '<span class="order-chip">' + esc(p) + ' <b data-un="' + i + '" style="cursor:pointer">✖</b></span>'; }).join("");
        ans.querySelectorAll("[data-un]").forEach(function (x) {
          x.addEventListener("click", function () {
            var i = parseInt(x.getAttribute("data-un"), 10);
            var removed = sess._picked.splice(i, 1)[0];
            Array.from(pool.children).forEach(function (c) { if (c.textContent === removed && c.classList.contains("used")) c.classList.remove("used"); });
            drawAns();
          });
        });
      }
      return;
    }
    if (q.type === "fill") {
      b.innerHTML = '<div class="quiz-write"><input type="text" id="asrIn" autocomplete="off" placeholder="اكتب إجابتك..." ' + (a ? 'disabled value="' + esc(a.user) + '"' : '') + '></div>';
      return;
    }
    if (q.type === "speak") {
      var sr = false;
      try { sr = !!(window.SpeechRecognition || window.webkitSpeechRecognition); } catch (e) {}
      b.innerHTML = '<div class="quiz-write"><input type="text" id="asrIn" autocomplete="off" placeholder="Antwort auf Deutsch..." ' + (a ? 'disabled value="' + esc(a.user) + '"' : '') + '>' +
        (!a && sr ? '<button class="btn btn-ghost sm" data-as="mic">🎤 تحدث</button>' : '') + '</div>' +
        '<div class="muted">مثال: ' + esc(q.sample || "") + (sr ? '' : ' (التعرف الصوتي غير مدعوم في متصفحك — اكتب إجابتك ⌨️)') + '</div>';
      return;
    }
    if (q.type === "conj") {
      var cans = a ? a.conjAns || {} : (sess._conj || {});
      b.innerHTML = '<div class="asr-conj">' + q.rows.map(function (r, ri) {
        return '<div class="asr-conjrow"><b>' + esc(r.pron) + ' ___</b><div class="quiz-opts">' + r.opts.map(function (o, oi) {
          var cls = "quiz-opt";
          if (a) {
            if (oi === r.correct) cls += " correct";
            else if (cans[ri] === oi) cls += " wrong";
            if (cans[ri] === oi) cls += " sel";
          } else if (cans[ri] === oi) cls += " sel";
          return '<button class="' + cls + '" data-crow="' + ri + '" data-cpick="' + oi + '" dir="ltr"' + (a ? " disabled" : "") + '>' + esc(o) + '</button>';
        }).join("") + "</div></div>";
      }).join("") + "</div>";
      if (!a) {
        sess._conj = sess._conj || {};
        b.querySelectorAll("[data-crow]").forEach(function (x) {
          x.addEventListener("click", function () {
            var ri = x.getAttribute("data-crow");
            sess._conj[ri] = parseInt(x.getAttribute("data-cpick"), 10);
            b.querySelectorAll('[data-crow="' + ri + '"]').forEach(function (y) { y.classList.remove("sel"); });
            x.classList.add("sel");
          });
        });
      }
      return;
    }
    if (q.type === "match") {
      var locked = a ? a.lockedPairs || [] : [];      b.innerHTML = '<div class="asr-match">' +
        '<div class="asr-mcol" id="asrMDe">' + q.pairs.map(function (p, i) {
          var isL = locked.indexOf(p.de) >= 0;
          return '<button class="quiz-opt asr-mbtn' + (isL ? ' correct' : '') + '" data-mde="' + i + '"' + (isL ? ' disabled' : '') + '>' + esc(p.de) + '</button>';
        }).join("") + '</div>' +
        '<div class="asr-mcol" id="asrMAr">' + C.shuffled(q.pairs.map(function (p) { return p; })).map(function (p) {
          var isL = locked.indexOf(p.de) >= 0;
          return '<button class="quiz-opt asr-mbtn' + (isL ? ' correct' : '') + '" data-mar="' + esc(p.ar) + '" data-mde-ref="' + esc(p.de) + '"' + (isL ? ' disabled' : '') + '>' + esc(p.ar) + '</button>';
        }).join("") + '</div></div>' +
        (a ? '' : '<div class="muted" id="asrMHint">اختر كلمة ألمانية ثم معناها بالعربية.</div>');
      if (!a) {
        sess._msel = null; sess._merr = 0; sess._mlock = [];
        b.querySelectorAll("[data-mde]").forEach(function (x) {
          x.addEventListener("click", function () {
            if (x.disabled) return;
            b.querySelectorAll("[data-mde]").forEach(function (y) { y.classList.remove("sel"); });
            x.classList.add("sel"); sess._msel = x.getAttribute("data-mde");
          });
        });
        b.querySelectorAll("[data-mar]").forEach(function (x) {
          x.addEventListener("click", function () {
            if (x.disabled || sess._msel === null) { toast("اختر الكلمة الألمانية أولًا"); return; }
            var di = parseInt(sess._msel, 10), deBtn = b.querySelector('[data-mde="' + di + '"]');
            var want = q.pairs[di].ar, got = x.getAttribute("data-mar");
            if (want === got) {
              deBtn.classList.add("correct"); deBtn.disabled = true;
              x.classList.add("correct"); x.disabled = true;
              sess._mlock.push(q.pairs[di].de);
              sess._msel = null;
              if (sess._mlock.length >= q.pairs.length) submitAnswer();
            } else {
              sess._merr = (sess._merr || 0) + 1;
              x.classList.add("wrong");
              setTimeout(function () { try { x.classList.remove("wrong"); } catch (e) {} }, 700);
              toast("❌ ليس المعنى الصحيح — حاول مجددًا", "err");
            }
          });
        });
      }
      return;
    }
    /* mc / tf / listen / read / default options */
    var opts = q.opts || [];
    b.innerHTML = '<div class="quiz-opts">' + opts.map(function (o, i) {
      var cls = "quiz-opt";
      if (a) {
        if (i === q.correct) cls += " correct";
        else if (i === a.picked && !a.ok) cls += " wrong";
        if (i === a.picked) cls += " sel";
      } else if (sess._sel === i) cls += " sel";
      return '<button class="' + cls + '" data-pick="' + i + '" dir="auto"' + (a ? ' disabled' : '') + '>' + esc(o) + '</button>';
    }).join("") + '</div>';
    if (!a) b.querySelectorAll("[data-pick]").forEach(function (x) {
      x.addEventListener("click", function () {
        sess._sel = parseInt(x.getAttribute("data-pick"), 10);
        b.querySelectorAll("[data-pick]").forEach(function (y) { y.classList.remove("sel"); });
        x.classList.add("sel");
      });
    });
  }
  function wireRunner(q) {
    var box = $("assessRunner"); if (!box) return;
    box.querySelectorAll("[data-as]").forEach(function (btn) {
      if (btn._asw) return; btn._asw = true;
      btn.addEventListener("click", function () {
        var k = btn.getAttribute("data-as");
        if (k === "prev") { if (sess.idx > 0) { sess.idx--; sess._sel = null; try { persistInProgress(); } catch (e2) {} renderQ(); } }
        else if (k === "next") {
          if (sess.idx < sess.qs.length - 1) { sess.idx++; sess._sel = null; try { persistInProgress(); } catch (e2) {} renderQ(); }
          else finish(false);
        }
        else if (k === "submit") submitAnswer();
        else if (k === "quit") {
          persistInProgress();
          stopTimer();
          try { if (window.onbeforeunload) window.onbeforeunload = null; } catch (e0) {}
          sess = null;
          toast("💾 تم حفظ تقدمك — يمكنك الاستكمال لاحقًا من المركز");
          renderCenter();
          try { if (typeof showPage === "function") showPage("quiz"); } catch (e) {}
        }
        else if (k === "hear") U.say(q.listenText);
        else if (k === "clear") {
          sess._picked = [];
          try {
            document.querySelectorAll("#asrPool .order-chip").forEach(function (c) { c.classList.remove("used"); });
            $("asrAns").innerHTML = "";
          } catch (e) {}
        }
        else if (k === "mic") startAsrMic(q);
      });
    });
    try {
      var inp = $("asrIn");
      if (inp && !sess.ans[sess.idx]) inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submitAnswer(); });
    } catch (e) {}
  }
  function startAsrMic(q) {
    var Ctor = null;
    try { Ctor = window.SpeechRecognition || window.webkitSpeechRecognition; } catch (e) {}
    var inp = $("asrIn");
    if (!Ctor) { toast("التعرف الصوتي غير مدعوم — اكتب إجابتك ⌨️", "err"); return; }
    try {
      var r = new Ctor();
      r.lang = "de-DE"; r.interimResults = false;
      toast("🎤 تحدث الآن...");
      r.onresult = function (e) {
        try {
          var tx = e.results[0][0].transcript;
          if (inp) inp.value = tx;
          toast("سمعتك: " + tx);
        } catch (ex) {}
      };
      r.onerror = function () { toast("تعذر السماع — اكتب إجابتك ⌨️", "err"); };
      r.start();
    } catch (e) { toast("تعذر تشغيل المايك", "err"); }
  }
  function collectAnswer(q) {
    if (q.type === "order") {
      var joined = (sess._picked || []).join(" ");
      if (!joined.trim()) return { empty: true };
      var norm = function (s) { return String(s || "").replace(/[.?!,]/g, "").trim().replace(/\s+/g, " ").toLowerCase(); };
      var ok = norm(joined) === norm(q.answer);
      return { ok: ok, user: joined, correct: q.answer };
    }
    if (q.type === "fill") {
      var v = ($("asrIn") && $("asrIn").value) || "";
      if (!normWrite(v)) return { empty: true };
      var okF = q.accept.some(function (a) { return normWrite(v) === normWrite(a); });
      return { ok: okF, user: v.trim(), correct: q.answer };
    }
    if (q.type === "speak") {
      var t = ($("asrIn") && $("asrIn").value) || "";
      if (t.trim().length < 2) return { empty: true };
      var g = U.gradeSpeaking(t, q.sample);
      var okS = g.pct >= 60;
      return { ok: okS, user: t.trim(), correct: q.sample, extra: "تطابق الكلمات: " + g.pct + "%" + (g.notes ? " — " + g.notes : "") + " (تقييم استرشادي)" };
    }
    if (q.type === "match") return null; /* match submits itself when complete */
    if (q.type === "conj") {
      var cmap = sess._conj || {};
      if (Object.keys(cmap).length < q.rows.length) return { empty: true };
      var okRows = 0;
      var parts = q.rows.map(function (r, ri) {
        var good = cmap[ri] === r.correct;
        if (good) okRows++;
        return r.pron + " " + r.opts[cmap[ri]];
      });
      var okC = okRows >= Math.ceil(q.rows.length * 0.75);
      return { ok: okC, user: parts.join(" • "), correct: correctTextOf(q), conjAns: cmap, extra: "صحيح: " + okRows + "/" + q.rows.length };
    }
    if (sess._sel === null || sess._sel === undefined) return { empty: true };
    var pi = sess._sel;
    return { ok: pi === q.correct, user: (q.opts || [])[pi], correct: (q.opts || [])[q.correct], picked: pi };
  }
  function submitAnswer() {
    if (!sess) return;
    var q = sess.qs[sess.idx];
    if (sess.ans[sess.idx]) return;
    if (q.type === "match") {
      var allOk = (sess._mlock || []).length >= q.pairs.length && (sess._merr || 0) <= 1;
      return lockAnswer(q, { ok: allOk, user: "توصيل (" + (sess._mlock || []).length + "/" + q.pairs.length + ", أخطاء: " + (sess._merr || 0) + ")", correct: q.why, lockedPairs: sess._mlock || [] });
    }
    var r = collectAnswer(q);
    if (!r) return;
    if (r.empty) { toast("أجب أولًا ✍️", "err"); return; }
    lockAnswer(q, r);
  }
  /* adaptive difficulty: after a miss, pull an easier unanswered question
     forward (reinforce); after a streak, pull a harder one (stretch).
     Never changes Kapitel/skill coverage — only the order. */
  var DIFF_RANK = { easy: 0, medium: 1, hard: 2 };
  function adaptQueue(ok) {
    try {
      if (!sess || sess.idx + 1 >= sess.qs.length) return;
      var recent = sess.ans.slice(Math.max(0, sess.idx - 2), sess.idx + 1);
      var streak = recent.length === 3 && recent.every(function (x) { return x && x.ok; });
      var slump = recent.length >= 2 && recent.every(function (x) { return x && !x.ok; });
      if (!streak && !slump) return;
      var want = streak ? 2 : 0, cur = DIFF_RANK[sess.qs[sess.idx].diff] == null ? 1 : DIFF_RANK[sess.qs[sess.idx].diff];
      for (var j = sess.idx + 1; j < sess.qs.length; j++) {
        if (sess.ans[j]) continue;
        var rj = DIFF_RANK[sess.qs[j].diff] == null ? 1 : DIFF_RANK[sess.qs[j].diff];
        if ((streak && rj > cur) || (slump && rj < cur)) {
          var nxt = sess.idx + 1;
          if (j !== nxt && !sess.ans[nxt]) {
            var tq = sess.qs[nxt]; sess.qs[nxt] = sess.qs[j]; sess.qs[j] = tq;
            var ta = sess.ans[nxt]; sess.ans[nxt] = sess.ans[j]; sess.ans[j] = ta;
          }
          return;
        }
      }
    } catch (e) {}
  }
  function lockAnswer(q, r) {
    var ms = Date.now() - (sess.t0q || Date.now());
    sess.t0q = Date.now();
    if (sess.qTimed) sess.qDeadline = Date.now() + sess.qSecs * 1000;
    sess.ans[sess.idx] = { ok: !!r.ok, user: String(r.user == null ? "" : r.user), correct: String(r.correct == null ? "" : r.correct), picked: (r.picked == null ? -1 : r.picked), extra: r.extra || "", lockedPairs: r.lockedPairs || [], pickedArr: (sess._picked || []).slice(), conjAns: r.conjAns || null, timeout: !!r.timeout };
    logAttempt(q, !!r.ok, ms);
    progressSideEffects(q, !!r.ok, String(r.user || ""));
    /* game mechanics: combo + perfect rounds (lightweight, no heavy anim) */
    if (r.ok) {
      sess.combo = (sess.combo || 0) + 1;
      if (sess.combo > (sess.bestCombo || 0)) sess.bestCombo = sess.combo;
      if (sess.combo > 0 && sess.combo % 5 === 0) {
        try { if (FN("addXP")) FN("addXP")(5); } catch (e) {}
        toast("🔥 كومبو x" + sess.combo + " — ⭐+5", "ok");
      }
    } else sess.combo = 0;
    var answeredN = sess.ans.filter(Boolean).length;
    if (answeredN > 0 && answeredN % C.CONFIG.PERFECT_ROUND_N === 0) {
      var round = sess.ans.slice(answeredN - C.CONFIG.PERFECT_ROUND_N, answeredN);
      if (round.length === C.CONFIG.PERFECT_ROUND_N && round.every(function (x) { return x && x.ok; })) {
        sess.perfects = (sess.perfects || 0) + 1;
        try { if (FN("addXP")) FN("addXP")(10); } catch (e2) {}
        toast("🏆 Perfect Round! خمس إجابات صحيحة متتالية ⭐+10", "ok");
      }
    }
    if (sess.stages) {
      var st = sess.stages[sess.stageIdx];
      if (st) { st.done++; if (r.ok) st.ok++; }
    }
    sess._sel = null; sess._conj = null;
    /* adaptive difficulty: reinforce on struggle, stretch on streaks */
    if (sess.adaptiveDiff && !sess.ans[sess.idx + 1]) adaptQueue(!!r.ok);
    persistInProgress();
    /* adaptive placement: stage complete? advance or finish */
    if (sess.specRef.adaptive && sess.stages) {
      var cur = sess.stages[sess.stageIdx];
      var stageQs = sess.qs.length;
      var answered = sess.ans.filter(Boolean).length;
      if (answered >= stageQs) {
        var pct = cur.done ? Math.round(cur.ok / cur.done * 100) : 0;
        cur.pct = pct;
        var next = sess.stageIdx + 1, specRef = sess.specRef;
        if (pct >= C.CONFIG.STAGE_PASS && next < specRef.stages.length) {
          var lvl = specRef.stages[next].level;
          if (U.levelUnlocked(lvl).ok || lvl === "A1") {
            var more = [];
            try { more = U.buildPool(specRef.stages[next].plan, 3).pool || []; } catch (e) { more = []; }
            if (more.length >= 6) {
              sess.qs = sess.qs.concat(more);
              sess.ans = sess.ans.concat(more.map(function () { return null; }));
              sess.stages.push({ id: specRef.stages[next].id, level: lvl, n: more.length, ok: 0, done: 0 });
              sess.stageIdx++;
              sess.idx++;
              persistInProgress();
              toast("🎉 أحسنت! انتقلت للمرحلة " + specRef.stages[next].id + " (مستوى " + lvl + ")");
              renderQ();
              return;
            }
          }
        }
        var _s = sess;
        renderQ();
        setTimeout(function () { try { if (A.getSess() === _s) finish(false); } catch (e) {} }, 1100);
        return;
      }
    }
    renderQ();
    var _s2 = sess;
    var last = sess.ans.filter(Boolean).length;
    if (last >= sess.qs.length) {
      setTimeout(function () { try { if (A.getSess() === _s2) finish(false); } catch (e) {} }, 900);
    }
  }
  function showLockedFeedback(q, a) {
    var fb = $("asrFb"); if (!fb) return;
    fb.classList.remove("hidden");
    fb.classList.add(a.ok ? "ok" : "no");
    fb.innerHTML = (a.ok ? "صحيح ✅ " : "❌ ") + esc(q.why || ("الصحيح: " + a.correct)) + (a.extra ? '<br><span class="muted">' + esc(a.extra) + '</span>' : '');
  }
  /*__APPEND4__*/
  return {
    startFlow: startFlow, resumeFlow: resumeFlow, discardFlow: discardFlow,
    renderRunner: renderRunner, ensureStore: ensureStore, getSess: function () { return sess; },
    setSess: function (s) { sess = s; }, correctTextOf: correctTextOf, modeBadge: modeBadge,
    persistInProgress: persistInProgress, clearInProgress: clearInProgress, stopTimer: stopTimer,
    focusBelowHeader: focusBelowHeader,
    renderCenter: function () { return DMAssess.center.renderCenter(); },
    finish: function (auto) { return DMAssess.center.finish(auto); },
    wireDashBtns: function (root) { return DMAssess.center.wireDashBtns(root); }
  };
})();
/* ============ RESULTS + DASHBOARD + WIRING ============ */
DMAssess.center = (function () {
  "use strict";
  var C = DMAssess, U = DMAssess.ui, A = DMAssess.app;
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function FN(name) { try { var f = window[name]; return typeof f === "function" ? f : null; } catch (e) { return null; } }
  function esc(s) { return U.esc(s); }
  function toast(m, k) { try { var f = FN("toast"); if (f) f(m, k || "ok"); } catch (e) {} }
  function save() { try { var f = FN("save"); if (f) f(); } catch (e) {} }
  function today() { try { var f = FN("todayStr"); if (f) return f(); } catch (e) {} return new Date().toISOString().slice(0, 10); }
  function skillAr(s) { return ((C.SKILLS[s] || {}).ar) || s; }
  function goPage(p) { try { if (typeof showPage === "function") showPage(p); } catch (e) {} }

  function hist() { try { var st = A.ensureStore(); return (st && st.history) || []; } catch (e) { return []; } }

  /* progress signals per Kapitel from accumulated learning (0..100 | null) */
  function progressByKap() {
    var out = {};
    try {
      var gs = FN("getStatus"), GR = (typeof GRAMMAR !== "undefined") ? GRAMMAR : [];
      U.kapitelList().forEach(function (k) {
        var ws = U.vocabPool({ kap: k.id });
        var vr = null, gr = null;
        if (ws.length >= 5 && gs) {
          var kn = ws.filter(function (w) { try { return gs(w.id) === "known"; } catch (e) { return false; } }).length;
          vr = kn / ws.length * 100;
        }
        try {
          var entries = [];
          Object.keys(((typeof S !== "undefined" && S.grammar) || {})).forEach(function (gid) {
            var g = null;
            for (var i = 0; i < GR.length; i++) if (GR[i].id === gid) { g = GR[i]; break; }
            if (g && g.kap === k.id) {
              var m = S.grammar[gid];
              if (m && m.n) entries.push(m.ok / m.n * 100);
            }
          });
          if (entries.length) gr = entries.reduce(function (a, b) { return a + b; }, 0) / entries.length;
        } catch (e) {}
        if (vr !== null && gr !== null) out[k.id] = 0.6 * vr + 0.4 * gr;
        else if (vr !== null) out[k.id] = vr;
        else if (gr !== null) out[k.id] = gr;
        else out[k.id] = null;
      });
    } catch (e) {}
    return out;
  }
  /* aggregate skill/kap evidence from recent history (fresh, never stored) */
  function aggregateEvidence(n) {
    var H = hist().slice(0, n || 5), sk = {}, kp = {}, tot = { n: 0, ok: 0 };
    C.SKILL_KEYS.forEach(function (s) { sk[s] = { n: 0, ok: 0 }; });
    H.forEach(function (h) {
      Object.keys(h.skills || {}).forEach(function (s) {
        if (!sk[s]) return;
        sk[s].n += h.skills[s].n || 0; sk[s].ok += h.skills[s].ok || 0;
      });
      Object.keys(h.kaps || {}).forEach(function (k) {
        if (!kp[k]) kp[k] = { n: 0, ok: 0 };
        kp[k].n += h.kaps[k].n || 0; kp[k].ok += h.kaps[k].ok || 0;
      });
      tot.n += h.total || 0; tot.ok += h.score || 0;
    });
    Object.keys(sk).forEach(function (s) { sk[s].pct = sk[s].n ? Math.round(sk[s].ok / sk[s].n * 100) : 0; sk[s].ev = sk[s].n >= C.CONFIG.MIN_SKILL_N ? "ok" : (sk[s].n ? "thin" : "none"); });
    Object.keys(kp).forEach(function (k) { kp[k].pct = kp[k].n ? Math.round(kp[k].ok / kp[k].n * 100) : 0; });
    return { skills: sk, kaps: kp, total: tot, sessions: H.length };
  }
  function kapitelReadinessMap(testKaps) {
    var prog = progressByKap(), map = {};
    U.kapitelList().forEach(function (k) {
      var t = (testKaps || {})[k.id] || null;
      map[k.id] = C.kapitelReadiness(t && t.n ? t : null, prog[k.id]);
    });
    return map;
  }

  /* ---------------- finish ---------------- */
  function finish(auto) {
    var sess = A.getSess();
    if (!sess) return null;
    A.stopTimer();
    try { if (sess._prevUnload !== undefined) window.onbeforeunload = sess._prevUnload || null; else window.onbeforeunload = null; } catch (e) {}
    sess.qs.forEach(function (q, i) {
      if (!sess.ans[i]) sess.ans[i] = { ok: false, user: "— (بدون إجابة)", correct: A.correctTextOf(q), picked: -1, extra: "", skipped: true };
    });
    var items = sess.qs.map(function (q, i) {
      return { skill: q.skill, topic: q.topicAr || q.topic, kap: q.kap, ok: !!sess.ans[i].ok, w: q.type === "speak" ? 0.5 : 1 };
    });
    var scored = C.scoreAnswers(items);
    var stages = (sess.stages || []).map(function (s) { return { id: s.id, pct: s.done ? Math.round(s.ok / s.done * 100) : 0, n: s.done }; });
    var levelVerdict = null;
    if (sess.spec.kind === "placement") levelVerdict = C.levelFromStages(stages);
    else if (sess.spec.kind === "exam") {
      var pass = scored.total.pct >= (sess.spec.passPct || C.CONFIG.PASS_A1_EXAM);
      levelVerdict = pass
        ? { level: sess.spec.level || "A1", confidence: scored.confidence, inconclusive: false, note: "امتحان شامل بنسبة " + scored.total.pct + "%" }
        : { level: "pre-" + (sess.spec.level || "A1"), confidence: scored.confidence, inconclusive: scored.inconclusive, note: "لم تصل لعتبة النجاح " + (sess.spec.passPct || C.CONFIG.PASS_A1_EXAM) + "% — واصل التدرب" };
    }
    var rmap = kapitelReadinessMap(scored.kaps);
    var order = U.kapitelList().map(function (k) { return k.id; });
    var cur = C.currentKapitel(rmap, order);
    var dur = Math.max(0, Math.round((Date.now() - sess.startedAt) / 1000));
    var status = sess.spec.kind === "exam"
      ? (scored.total.pct >= (sess.spec.passPct || C.CONFIG.PASS_A1_EXAM) ? "ناجح 🎉" : "لم تنجح هذه المرة 💪")
      : (scored.inconclusive ? "غير حاسمة" : "مكتمل ✅");
    var review = [];
    sess.qs.forEach(function (q, i) {
      var a = sess.ans[i];
      if (!a.ok && review.length < 25) {
        review.push({ p: String(q.prompt).slice(0, 160), ps: q.passage ? String(q.passage).slice(0, 200) : "", u: String(a.user).slice(0, 120), c: String(a.correct).slice(0, 120), why: String(q.why || "").slice(0, 220), sk: q.skill, tp: q.topicAr || q.topic, kap: q.kap, gid: q.gid || null, refId: q.refId || null });
      }
    });
    var sessMode = sess.spec.mode || (sess.spec.kind === "exam" ? "exam" : "test");
    var bestKey = sess.spec.kind + ":" + (sess.spec.cat || "") + ":" + (sess.spec.kap || "") + ":" + (sess.spec.level || "") + ":" + sessMode;
    var entry = {
      id: "as" + Date.now().toString(36), ts: Date.now(), date: today(),
      mode: sess.spec.kind, sessMode: sessMode, cat: sess.spec.cat || null,
      title: sess.spec.modeTitle + (sess.spec.kap ? " — " + sess.spec.kap : "") + (sess.spec.skill ? " — " + skillAr(sess.spec.skill) : ""),
      level: levelVerdict ? levelVerdict.level : null, levelConf: levelVerdict ? levelVerdict.confidence : null,
      kapitel: cur.current, kapitelNext: cur.next,
      score: scored.total.ok, total: sess.qs.length, pct: scored.total.pct,
      dur: dur, conf: scored.confidence, confWhy: scored.confWhy, status: status,
      skills: scored.skills, kaps: scored.kaps, rmap: rmap,
      weak: C.weakSkills(scored.skills), strong: C.strongSkills(scored.skills),
      weakTopics: C.weakTopics(scored.topics, 6).map(function (x) { return { sk: x.skill, tp: x.topic, pct: x.pct, n: Math.round(x.n) }; }),
      stages: stages, review: review, specId: sess.spec.id, bestKey: bestKey,
      comboBest: sess.bestCombo || 0, perfects: sess.perfects || 0, newRecord: false
    };
    /* personal records (additive keys only; history stays the source of truth) */
    try {
      var st0 = A.ensureStore();
      if (st0) {
        if (!st0.best || typeof st0.best !== "object") st0.best = {};
        if (!st0.days || typeof st0.days !== "object") st0.days = {};
        if (entry.pct > (st0.best[bestKey] || 0)) { st0.best[bestKey] = entry.pct; entry.newRecord = (st0.history || []).some(function (h) { return h.bestKey === bestKey; }); }
        if ((sess.bestCombo || 0) > (st0.bestCombo || 0)) st0.bestCombo = sess.bestCombo;
        var dk = today();
        st0.days[dk] = (st0.days[dk] || 0) + 1;
        var dks = Object.keys(st0.days).sort();
        while (dks.length > 60) { delete st0.days[dks.shift()]; }
      }
    } catch (e5) {}
    /* persist history (ring buffer) */
    try {
      var st = A.ensureStore();
      st.history.unshift(entry);
      while (st.history.length > C.CONFIG.HISTORY_CAP) st.history.pop();
      save();
    } catch (e) {}
    /* integrate with existing progress (single-counted) */
    try {
      if (typeof S !== "undefined") {
        S.testsTaken = (S.testsTaken || 0) + 1;
        if (entry.pct > (S.bestPct || 0)) S.bestPct = entry.pct;
        var xp = sess.spec.kind === "exam" ? (entry.pct >= (sess.spec.passPct || 70) ? 30 : 10) : (sess.spec.kind === "placement" ? 15 : 8);
        S.lastQuiz = { type: "🎯 " + entry.title, score: entry.score, total: entry.total, pct: entry.pct, xp: xp, date: today() };
        S.quizHistory = S.quizHistory || [];
        S.quizHistory.unshift({ type: "🎯 " + entry.title, score: entry.score, total: entry.total, pct: entry.pct, xp: xp, date: today() + " " + new Date().toLocaleTimeString("ar") });
        S.quizHistory = S.quizHistory.slice(0, 20);
        if (sess.spec.kind === "placement" && levelVerdict && !levelVerdict.inconclusive) {
          var det = C.SKILL_KEYS.filter(function (s) { return entry.skills[s] && entry.skills[s].n; }).map(function (s) { return { k: s, n: Math.round(entry.skills[s].n), ok: Math.round(entry.skills[s].ok), pct: entry.skills[s].pct }; });
          var path = entry.level === "A0" ? "Start A1 🟢" : (entry.level === "A1" ? "أكمل A1 ثم A2 🚀" : "واصل naar " + entry.level);
          S.place = { score: Math.round(entry.pct / 100 * 12), total: 12, pct: entry.pct, lvl: entry.level, path: path, date: today(), skills: det };
          S.placeHistory = S.placeHistory || [];
          S.placeHistory.unshift({ score: Math.round(entry.pct / 100 * 12), lvl: entry.level, date: today(), skills: det });
          S.placeHistory = S.placeHistory.slice(0, 10);
        }
        if (sess.spec.id === "exam-a1" && entry.pct >= (sess.spec.passPct || 70)) {
          try {
            var el = FN("ensureLearn"); if (el) el();
            if (!S.journey) S.journey = { lessons: {}, listen: {}, speak: {}, talk: {}, final: {} };
            if (!S.journey.final) S.journey.final = {};
            S.journey.final.A1 = { pct: entry.pct, date: today() };
          } catch (e2) {}
        }
        if (FN("addXP")) FN("addXP")(xp);
        if (FN("checkAch")) { try { FN("checkAch")(); } catch (e3) {} }
        save();
        try { if (FN("renderAll")) FN("renderAll")(); } catch (e4) {}
      }
    } catch (e) {}
    A.clearInProgress();
    A.setSess(null);
    renderResult(entry);
    return entry;
  }

  function confAr(c) { return c === "high" ? "مرتفع ✅" : c === "medium" ? "متوسط 🟡" : "منخفض ⚠️"; }
  function pracGoFor(entry, r) {
    var sk = r.sk, go = ((C.SKILLS[sk] || {}).go) || "practice";
    if (r.gid) return { go: "labs", gid: r.gid, label: "تدرب على هذا الموضوع 🧪" };
    return { go: go, label: "تدرب على " + skillAr(sk) + " ←" };
  }
  /* ---------------- result page ---------------- */
  function renderResult(entry) {
    var root = $("assessRoot"); if (!root) return;
    var st, h = '<div id="assessResult">';
    h += '<div class="panel glass asd-hero"><div class="muted">' + esc(entry.title) + ' • ' + esc(entry.date) + ' • ⏱️ ' + Math.floor(entry.dur / 60) + ':' + String(entry.dur % 60).padStart(2, "0") + '</div>';
    h += '<div class="asr-big">' + entry.pct + '%</div>';
    h += '<div><b>' + esc(entry.status) + '</b> <span class="muted">(' + entry.score + '/' + entry.total + ')</span></div>';
    if (entry.newRecord) h += '<div class="quiz-feedback ok">🎉 رقم قياسي جديد — أفضل نتيجة لك في هذا النوع!</div>';
    if (entry.comboBest >= 3) h += '<div class="muted">🔥 أطول سلسلة صحيحة: <b>x' + entry.comboBest + '</b>' + (entry.perfects ? ' • 🏆 Perfect Rounds: ' + entry.perfects : '') + '</div>';
    if (entry.level) {
      h += '<div class="asd-lvlrow"><div class="asd-lvl"><span class="muted">مستواك</span><b>' + esc(entry.level) + '</b></div>';
      h += '<div class="asd-lvl"><span class="muted">Kapitel</span><b>' + esc(entry.kapitel || "—") + '</b></div>';
      h += '<div class="asd-lvl"><span class="muted">مستوى الثقة</span><b>' + esc(confAr(entry.levelConf || entry.conf)) + '</b></div></div>';
    } else {
      h += '<div class="asd-lvlrow"><div class="asd-lvl"><span class="muted">Kapitel الحالي</span><b>' + esc(entry.kapitel || "—") + '</b></div>';
      if (entry.kapitelNext) h += '<div class="asd-lvl"><span class="muted">التالي</span><b>' + esc(entry.kapitelNext) + '</b></div>';
      h += '<div class="asd-lvl"><span class="muted">مستوى الثقة</span><b>' + esc(confAr(entry.conf)) + '</b></div></div>';
      if (entry.confWhy) h += '<div class="muted">لماذا؟ ' + esc(entry.confWhy) + '</div>';
    }
    if (entry.stages && entry.stages.length > 1) {
      h += '<div class="muted">المراحل: ' + entry.stages.map(function (s) { return esc(s.id) + " " + s.pct + "%"; }).join(" ← ") + '</div>';
    }
    h += '</div>';
    /* skill table (exam mode uses official section names) */
    var SEC_AR = { listening: "Hören — الاستماع 🎧", reading: "Lesen — القراءة 📖", vocab: "Wortschatz — المفردات 📚", grammar: "Grammatik — القواعد 📐", writing: "Schreiben — الكتابة ✍️", speaking: "Sprechen — التحدث 🎤" };
    h += '<div class="panel glass"><h3>' + (entry.mode === "exam" ? "📊 درجات الأقسام" : "📊 المهارات") + '</h3><div class="asd-skills">';
    C.SKILL_KEYS.forEach(function (s) {
      var m = entry.skills[s];
      if (!m || !m.n) return;
      st = C.statusOf(m.pct, m.ev);
      var lbl = (entry.mode === "exam" && SEC_AR[s]) ? SEC_AR[s] : skillAr(s);
      h += '<div class="asd-skill"><div class="row-flex"><b>' + esc(lbl) + '</b><span>' + m.pct + '%</span></div>' +
        '<div class="progress sm"><div class="progress-fill" style="width:' + m.pct + '%"></div></div>' +
        '<div class="muted">' + st.ico + ' ' + st.ar + (m.ev === "thin" ? ' (إجابات قليلة: ' + Math.round(m.n) + ')' : '') + '</div></div>';
    });
    h += '</div></div>';
    /* strengths / weaknesses */
    h += '<div class="grid-2"><div class="panel glass"><h3>💪 نقاط القوة</h3>' +
      (entry.strong.length ? entry.strong.map(function (s) { return '<div class="muted">✅ ' + esc(skillAr(s)) + ' (' + entry.skills[s].pct + '%)</div>'; }).join("") : '<div class="muted">لا نقاط قوة مؤكدة بعد — واصل التدرب.</div>') + '</div>';
    h += '<div class="panel glass"><h3>⚠️ تحتاج مراجعة</h3>' +
      (entry.weak.length ? entry.weak.map(function (s) { return '<div class="muted">🔴 ' + esc(skillAr(s)) + ' (' + entry.skills[s].pct + '%)</div>'; }).join("") : '<div class="muted">🎉 لا نقاط ضعف مؤكدة!</div>') +
      (entry.weakTopics.length ? '<div class="muted">🎯 بالتفصيل: ' + entry.weakTopics.map(function (t) { return esc(t.tp) + " (" + t.pct + "%)"; }).join(" • ") + '</div>' : '') + '</div></div>';
    /* next steps */
    var recs = [];
    (entry.weak.length ? entry.weak : C.SKILL_KEYS.filter(function (s) { return entry.skills[s] && entry.skills[s].n; }).slice(0, 3)).slice(0, 3).forEach(function (s) {
      recs.push({ label: (entry.weak.length ? "راجع " : "واصل ") + skillAr(s), go: ((C.SKILLS[s] || {}).go) || "practice" });
    });
    recs.push({ label: "❌ مراجعة أخطائي", go: "mistakes" });
    recs.push({ label: "🗺️ الرحلة", go: "journey" });
    h += '<div class="panel glass"><h3>➡️ ماذا تفعل الآن؟</h3><div class="muted">مستواك: <b>' + esc(entry.level || "—") + '</b> • Kapitel: <b>' + esc(entry.kapitel || "—") + '</b></div><div class="row-flex">' +
      recs.map(function (r, i) { return '<button class="btn btn-ghost sm" data-asgo="' + esc(r.go) + '">' + esc(r.label) + '</button>'; }).join("") + '</div></div>';
    /* answer review */
    h += '<div class="panel glass"><h3>🔍 مراجعة الإجابات الخاطئة (' + entry.review.length + ')</h3>';
    if (!entry.review.length) h += '<div class="quiz-feedback ok">ممتاز — بلا أخطاء! 🎉</div>';
    h += entry.review.map(function (r, i) {
      var pg = pracGoFor(entry, r);
      return '<div class="asr-rev"><div><b>' + esc(r.p) + '</b></div>' +
        (r.ps ? '<div class="muted asr-de" dir="ltr">' + esc(r.ps) + '</div>' : '') +
        '<div>إجابتك: <b style="color:var(--red,#e5484d)">' + esc(r.u) + '</b></div>' +
        '<div>الصحيح: <b style="color:var(--green,#30a46c)">' + esc(r.c) + '</b></div>' +
        (r.why ? '<div class="muted">💡 ' + esc(r.why) + '</div>' : '') +
        '<div class="muted">🏷️ ' + esc(skillAr(r.sk)) + ' • ' + esc(r.tp || "") + (r.kap ? ' • ' + esc(r.kap) : '') + '</div>' +
        '<div class="row-flex"><button class="btn btn-ghost sm" data-asgo="' + esc(pg.go) + '"' + (r.gid ? ' data-gid="' + esc(r.gid) + '"' : '') + '>' + esc(pg.label) + '</button></div></div>';
    }).join("") + '</div>';
    h += '<div class="row-flex"><button class="btn btn-primary sm" data-as="retry">🔄 إعادة الاختبار</button><button class="btn btn-ghost sm" data-as="dash">← المركز</button><button class="btn btn-ghost sm" data-asgo="practice">🎯 تدريب ذكي</button></div>';
    h += '</div>';
    root.innerHTML = h;
    wireDashBtns(root);
    root.querySelectorAll("[data-asgo]").forEach(function (b) {      if (b._asg) return; b._asg = true;
      b.addEventListener("click", function () {
        var go = b.getAttribute("data-asgo"), gid = b.getAttribute("data-gid");
        goPage(go);
        if (gid) setTimeout(function () {
          try {
            if (typeof openGLab === "function") openGLab(gid);
            else if (typeof openExplain === "function") openExplain(gid);
          } catch (e) {}
        }, 400);
      });
    });
    /* Single header-aware focus on the result. (Previously this did BOTH
       scrollIntoView AND scrollTo(top:0) — the two fought and the page
       jumped to an unrelated position.) */
    try { A.focusBelowHeader(root.querySelector("#assessResult") || root, { extra: 4 }); } catch (e) {}
  }

/* ---------------- dashboard ---------------- */
  function inProgressValid() {
    try {
      var st = A.ensureStore(), ip = st && st.inProgress;
      if (!ip || ip.v !== C.CONFIG.STORE_V || !ip.qs || !ip.qs.length) return null;
      if (Date.now() - (ip.startedAt || 0) > C.CONFIG.RESUME_TTL_DAYS * 86400000) return null;
      var done = (ip.ans || []).filter(Boolean).length;
      return { title: (ip.specMeta || {}).modeTitle || "اختبار", done: done, total: ip.qs.length };
    } catch (e) { return null; }
  }
  function dashboardData() {
    var H = hist();
    var last = H[0] || null;
    var best = 0;
    H.forEach(function (h) { if (h.pct > best) best = h.pct; });
    var agg = aggregateEvidence(5);
    var mastery = 0, masteryN = 0;
    H.slice(0, 3).forEach(function (h) { mastery += h.pct; masteryN++; });
    mastery = masteryN ? Math.round(mastery / masteryN) : 0;
    var place = null;
    try { place = (typeof S !== "undefined" && S.place) || null; } catch (e) {}
    var rmap = kapitelReadinessMap(agg.kaps);
    var order = U.kapitelList().map(function (k) { return k.id; });
    var cur = C.currentKapitel(rmap, order);
    var lvl = null;
    for (var i = 0; i < H.length; i++) if (H[i].level && H[i].mode === "placement") { lvl = H[i].level; break; }
    if (!lvl && place && place.lvl) lvl = place.lvl;
    return { last: last, best: best, count: H.length, mastery: mastery, masteryN: masteryN, agg: agg, rmap: rmap, cur: cur, lvl: lvl, order: order };
  }
  function kapStateChip(r) {
    if (!r || r.conf === "none") return '<span class="muted">🔒 غير مؤكد</span>';
    if (r.pct >= C.CONFIG.KAP_MASTERED) return '<span class="as-ok">✓ متقن ' + r.pct + '%</span>';
    if (r.pct >= C.CONFIG.KAP_READY) return '<span class="as-ok">✓ جاهز ' + r.pct + '%</span>';
    if (r.pct >= 40) return '<span class="as-warn">🟡 ' + r.pct + '% — يحتاج مراجعة</span>';
    return '<span class="muted">🔒 ' + r.pct + '% — غير جاهز</span>';
  }
  function renderCenter() {
    A.stopTimer();
    var root = $("assessRoot"); if (!root) return;
    var d = dashboardData(), ip = inProgressValid();
    var h = '<div id="assessDash">';
    if (ip) {
      h += '<div class="panel glass as-resume"><b>💾 لديك اختبار غير مكتمل: ' + esc(ip.title) + ' (' + ip.done + '/' + ip.total + ')</b>' +
        '<div class="row-flex"><button class="btn btn-primary sm" data-as="resume">▶️ استكمال الاختبار</button><button class="btn btn-ghost sm" data-as="discard">🗑️ تجاهل</button></div></div>';
    }
    /* guided Test Center flow (testcenter.js, additive; guarded) */
    try { if (typeof DMTestCenter !== "undefined" && DMTestCenter && DMTestCenter.renderSection) h += DMTestCenter.renderSection(d); } catch (e) {}
    /* status */
    var kapTxt = d.cur.current ? d.cur.current : "—";
    var kapSub = !d.cur.current ? "ابدأ أول تقييم" : (d.cur.next ? "قريب من " + d.cur.next : "متقدم 🎉");
    h += '<div class="panel glass"><h3>🎯 مركز الاختبارات والتقييم</h3><div class="muted">هنا تعرف مستواك الحقيقي، والـ Kapitel الذي أنت فيه، ونقاط ضعفك، وماذا تذاكر الآن.</div>';
    h += '<div class="asd-grid">' +
      statCard("📊", "مستواك الحالي", d.lvl || "—", d.lvl ? "" : "حدد مستواك أولًا") +
      statCard("📖", "Kapitel الحالي", kapTxt, kapSub) +
      statCard("🏆", "الإتقان", d.masteryN ? d.mastery + "%" : "—", d.masteryN ? "متوسط آخر " + d.masteryN + " اختبارات" : "لا اختبارات بعد") +
      statCard("🕘", "آخر اختبار", d.last ? d.last.pct + "%" : "—", d.last ? esc(d.last.title) : "ابدأ الآن 🚀") +
      statCard("⭐", "أفضل نتيجة", d.count ? d.best + "%" : "—", d.count ? d.count + " اختبارات محلولة" : "0 اختبارات") +
      statCard("🎯", "دقة الإجابات", d.agg.total.n ? Math.round(d.agg.total.ok / d.agg.total.n * 100) + "%" : "—", d.agg.total.n ? d.agg.total.n + " إجابة مسجلة" : "أجب لتظهر دقتك") +
      '</div>';
    var sk = d.agg.skills;
    var strong = C.SKILL_KEYS.filter(function (s) { return sk[s].ev === "ok" && sk[s].pct >= C.CONFIG.STRONG_SKILL; });
    var weak = C.SKILL_KEYS.filter(function (s) { return sk[s].ev === "ok" && sk[s].pct < C.CONFIG.GOOD_SKILL; });
    h += '<div class="row-flex"><span class="muted">💪 القوية:</span>' + (strong.length ? strong.map(function (s) { return '<span class="tag">' + esc(skillAr(s)) + '</span>'; }).join("") : '<span class="muted">—</span>') + '</div>';
    h += '<div class="row-flex"><span class="muted">⚠️ الضعيفة:</span>' + (weak.length ? weak.map(function (s) { return '<span class="tag">' + esc(skillAr(s)) + ' ' + sk[s].pct + '%</span>'; }).join("") : '<span class="muted">—</span>') + '</div>';
    h += '</div>';
    /* placement hero */
    h += '<div class="panel glass as-hero"><div><h3>🎯 اختبار تحديد المستوى</h3><div class="muted">اختبار شامل تكيّفي (A1 ← A2 ← B1): مفردات، قواعد، جمل، قراءة، استماع، مواقف عملية، وتحدث اختياري. يحدد مستواك والـ Kapitel بدقة.</div></div>' +
      '<button class="btn btn-primary" data-as="start:placement">ابدأ تحديد المستوى 🚀</button></div>';
    /* general modes */
    h += '<div class="panel glass"><h3>⚡ حسب المدة</h3><div class="row-flex">' +
      '<button class="btn btn-ghost sm" data-as="start:mixed-8">اختبار سريع (8)</button>' +
      '<button class="btn btn-ghost sm" data-as="start:mixed-16">اختبار متوسط (16)</button>' +
      '<button class="btn btn-ghost sm" data-as="start:mixed-30">اختبار شامل (30)</button></div></div>';
    /* kapitel tests (dynamic from real KAPITEL) */
    h += '<div class="panel glass"><h3>📖 اختبارات Kapitel</h3><div class="asd-kaps">';
    U.kapitelList().forEach(function (k) {
      h += '<button class="quick-btn" data-as="start:kap-' + esc(k.id) + '">' + esc(k.icon || "📖") + ' ' + esc(k.id) + '<br><small>' + esc(k.name) + '</small></button>';
    });
    h += '</div></div>';
    /* skill tests */
    h += '<div class="panel glass"><h3>🧠 اختبارات المهارات</h3><div class="asd-kaps">';
    C.SKILL_KEYS.forEach(function (s) {
      h += '<button class="quick-btn" data-as="start:skill-' + s + '">' + esc(skillAr(s)) + '<br><small>' + esc((C.SKILLS[s] || {}).de || "") + '</small></button>';
    });
    h += '</div></div>';
    /* exams */
    h += '<div class="panel glass"><h3>🏁 الامتحانات الشاملة</h3><div class="grid-2">';
    h += '<div class="asd-exam"><b>🇩🇪 امتحان A1 الشامل</b><div class="muted">Hören • Lesen • Wortschatz • Grammatik • Schreiben • Sprechen — النجاح من ' + C.CONFIG.PASS_A1_EXAM + '% — بتوقيت ⏱️</div><button class="btn btn-gold sm" data-as="start:exam-a1">ابدأ الامتحان 🏁</button></div>';
    ["A2", "B1"].forEach(function (lv) {
      var g = U.levelUnlocked(lv);
      if (g.ok) h += '<div class="asd-exam"><b>🇩🇪 امتحان ' + lv + ' الشامل</b><div class="muted">محتوى ' + lv + ' متاح (' + g.words + ' كلمة).</div><button class="btn btn-gold sm" data-as="start:exam-' + lv.toLowerCase() + '">ابدأ الامتحان 🏁</button></div>';
      else h += '<div class="asd-exam locked"><b>🔒 امتحان ' + lv + '</b><div class="muted">المحتوى قيد التجهيز (' + (g.words || 0) + ' كلمة، ' + (g.grammar || 0) + ' قواعد) — سيُفتح عند اكتمال المحتوى.</div>' +
        (typeof Curriculum !== "undefined" ? '<button class="btn btn-ghost sm" data-as="load:' + lv + '">⬇️ تحميل محتوى ' + lv + '</button>' : '') + '</div>';
    });
    h += '</div><div class="muted">امتحانات Deutsch Master الداخلية — ليست شهادات رسمية (ليست Goethe).</div></div>';
    /* kapitel map */
    h += '<div class="panel glass"><h3>🗺️ خريطة الـ Kapitel</h3><div class="asd-map">';
    var kl = U.kapitelList();
    kl.forEach(function (k, i) {
      var r = d.rmap[k.id];
      var ico = !r || r.conf === "none" ? "🔒" : r.pct >= C.CONFIG.KAP_MASTERED ? "✓" : r.pct >= C.CONFIG.KAP_READY ? "✓" : r.pct >= 40 ? "🟡" : "🔒";
      h += '<button class="asd-maprow" data-as="start:kap-' + esc(k.id) + '"><span class="asd-mapico">' + ico + '</span><span><b>' + esc(k.id) + ' • ' + esc(k.name) + '</b><br>' + kapStateChip(r) + '</span><span>←</span></button>';
      if (i < kl.length - 1) h += '<div class="asd-mapdown">↓</div>';
    });
    h += '</div><div class="muted">اضغط على أي Kapitel لاختباره أو مراجعته.</div></div>';
    /* trends */
    var H = hist().slice(0, 5).reverse();
    if (H.length) {
      h += '<div class="panel glass"><h3>📈 تقدمك عبر الوقت</h3><div class="asd-bars">' +
        H.map(function (x) { return '<div class="asd-bar"><div class="asd-barfill" style="height:' + Math.max(4, x.pct) + '%"></div><span>' + x.pct + '%</span><small>' + esc(x.date.slice(5)) + '</small></div>'; }).join("") +
        '</div></div>';
    }
    /* history */
    h += '<div class="panel glass"><h3>📜 سجل الاختبارات (' + d.count + ')</h3><div class="history-list">';
    if (!d.count) h += '<div class="muted">لم تحل أي تقييم بعد — ابدأ بتحديد المستوى! 🚀</div>';
    h += hist().slice(0, 8).map(function (x) {
      return '<div class="history-item"><span>🎯 ' + esc(x.title) + ' • ' + esc(x.date) + ' • ⏱️ ' + Math.floor(x.dur / 60) + ':' + String(x.dur % 60).padStart(2, "0") + (x.level ? ' • ' + esc(x.level) : '') + '</span><span><b>' + x.pct + '%</b> <button class="btn btn-ghost sm" data-as="hist:' + x.id + '">فتح ←</button></span></div>';
    }).join("") + '</div></div>';
    /* legacy quick tests anchor */
    h += '<div class="panel glass"><h3>📝 الاختبارات السريعة</h3><div class="muted">تدريب سريع بالنظام السابق (أدوات، معاني، جمع، استماع...).</div><div class="row-flex"><button class="btn btn-ghost sm" data-as="oldquiz">فتح الاختبارات السريعة ↓</button></div></div>';
    h += '</div>';
    root.innerHTML = h;
    wireDashBtns(root);
    try { if (typeof DMTestCenter !== "undefined" && DMTestCenter && DMTestCenter.wire) DMTestCenter.wire(root); } catch (e2) {}
  }
  function statCard(ico, label, val, sub) {
    return '<div class="asd-stat"><div class="asd-ico">' + ico + '</div><b>' + esc(val) + '</b><span class="muted">' + esc(label) + '</span><small class="muted">' + esc(sub || "") + '</small></div>';
  }
  /* ---------------- button delegation ---------------- */
  function startById(id) {
    var Sp = DMAssess.specs;
    if (id === "placement") return A.startFlow(Sp.placementSpec());
    if (id === "exam-a1") return A.startFlow(Sp.a1ExamSpec());
    if (id === "exam-a2") return A.startFlow(Sp.levelExamSpec("A2"));
    if (id === "exam-b1") return A.startFlow(Sp.levelExamSpec("B1"));
    var m = id.match(/^mixed-(\d+)$/);
    if (m) { var n = parseInt(m[1], 10); return A.startFlow(Sp.mixedSpec(n), { limit: n + 6 }); }
    var k = id.match(/^kap-(.+)$/);
    if (k) return A.startFlow(Sp.kapitelSpec(k[1]));
    var s = id.match(/^skill-(.+)$/);
    if (s) return A.startFlow(Sp.skillSpec(s[1]));
    return false;
  }
  function openHistory(id) {
    var H = hist();
    for (var i = 0; i < H.length; i++) if (H[i].id === id) { renderResult(H[i]); return; }
    toast("تعذر فتح النتيجة", "err");
  }
  function wireDashBtns(root) {
    if (!root) return;
    root.querySelectorAll('[data-as]').forEach(function (b) {
      if (b._asw) return; b._asw = true;
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-as");
        if (k === "dash" || k === "center") renderCenter();
        else if (k === "resume") { if (!A.resumeFlow()) { toast("تعذر الاستكمال — بدء جديد أفضل", "err"); renderCenter(); } }
        else if (k === "discard") { A.discardFlow(); toast("تم تجاهل الاختبار غير المكتمل 🗑️"); }
        else if (k === "quit") { A.persistInProgress(); toast("💾 تم حفظ تقدمك"); renderCenter(); }
        else if (k === "retry") {
          var s = A.getSess(), id = null;
          try { var H = hist(); id = H[0] ? H[0].specId : null; } catch (e) {}
          if (id) startById(id); else renderCenter();
        }
        else if (k === "oldquiz") {
          try {
            var q = $("quizSetup");
            if (q) { A.focusBelowHeader(q); try { if (FN("renderQuizHistory")) FN("renderQuizHistory")(); } catch (e) {} }
          } catch (e) {}
        }
        else if (k.indexOf("hist:") === 0) openHistory(k.slice(5));
        else if (k.indexOf("start:") === 0) {
          if (!A.getSess() && inProgressValid()) {
            var okNew = false;
            try { okNew = window.confirm("لديك اختبار غير مكتمل محفوظ. بدء اختبار جديد سيستبدله. متابعة؟"); } catch (e) { okNew = true; }
            if (!okNew) return;
            try { var st0 = A.ensureStore(); if (st0) { st0.inProgress = null; } } catch (e2) {}
          }
          startById(k.slice(6));
        }
        else if (k.indexOf("load:") === 0) {
          var lv = k.slice(5);
          try {
            if (typeof Curriculum !== "undefined" && Curriculum.ensure) {
              toast("⏳ جاري تحميل محتوى " + lv + " ...");
              Curriculum.ensure(lv, function () { try { if (!document.querySelector("#page-quiz.active")) return; } catch (e) {} renderCenter(); });
            }
          } catch (e) {}
        }
      });
    });
  }

  return { finish: finish, renderResult: renderResult, renderCenter: renderCenter, wireDashBtns: wireDashBtns, aggregateEvidence: aggregateEvidence, kapitelReadinessMap: kapitelReadinessMap, progressByKap: progressByKap };
})();
/* ============ CSS + PAGE WIRING (additive, idempotent) ============ */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var CSS = ".asr-wrap,.asd-hero{max-width:100%}"
    + ".asr-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}"
    + ".asr-timer{font-weight:800;background:rgba(255,255,255,.06);border:1px solid var(--border,#333);border-radius:10px;padding:4px 10px}"
    + ".asr-timer.asr-danger{color:#ff6b6b;border-color:#ff6b6b;animation:asrblink 1s infinite}"
    + "@keyframes asrblink{50%{opacity:.55}}"
    + ".asr-prompt{margin:10px 0;line-height:1.9}"
    + ".asr-passage{background:rgba(255,255,255,.04);border:1px solid var(--border,#333);border-radius:12px;padding:10px;margin:8px 0}"
    + ".asr-de{font-weight:700;line-height:2}"
    + ".asr-ans{min-height:52px;border:1px dashed var(--border,#555);border-radius:12px;padding:8px;margin:8px 0;display:flex;gap:6px;flex-wrap:wrap}"
    + ".order-chip{padding:8px 12px;border-radius:10px;border:1px solid var(--border,#444);background:rgba(255,255,255,.05);cursor:pointer;font-size:15px}"
    + ".order-chip.used{opacity:.35}"
    + ".quiz-opt.sel{outline:2px solid var(--gold,#f5b301);outline-offset:1px}"
    + ".asr-match{display:grid;grid-template-columns:1fr 1fr;gap:8px}"
    + ".asr-mcol{display:flex;flex-direction:column;gap:8px}"
    + ".asr-mbtn.sel{outline:2px solid var(--gold,#f5b301)}"
    + ".asr-rev{border-top:1px solid var(--border,#333);padding:10px 0}"
    + ".asr-big{font-size:52px;font-weight:900;line-height:1.2}"
    + ".asd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}"
    + "@media(max-width:640px){.asd-grid{grid-template-columns:repeat(2,1fr)}}"
    + ".asd-stat{background:rgba(255,255,255,.04);border:1px solid var(--border,#333);border-radius:12px;padding:10px;text-align:center;display:flex;flex-direction:column;gap:2px;min-width:0}"
    + ".asd-stat b{font-size:19px}.asd-ico{font-size:20px}"
    + ".asd-stat small{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".asd-lvlrow{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}"
    + ".asd-lvl{background:rgba(255,255,255,.05);border:1px solid var(--border,#333);border-radius:12px;padding:8px 14px;display:flex;flex-direction:column;min-width:110px}"
    + ".asd-lvl b{font-size:20px}"
    + ".asd-skills{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}"
    + "@media(max-width:560px){.asd-skills{grid-template-columns:1fr}}"
    + ".asd-kaps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}"
    + "@media(max-width:560px){.asd-kaps{grid-template-columns:repeat(2,1fr)}}"
    + ".quick-btn small{font-size:11px;opacity:.75}"
    + ".as-hero{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}"
    + ".asd-exam{background:rgba(255,255,255,.04);border:1px solid var(--border,#333);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px}"
    + ".asd-exam.locked{opacity:.75}"
    + ".asd-map{display:flex;flex-direction:column;gap:2px}"
    + ".asd-maprow{display:flex;align-items:center;gap:10px;text-align:start;background:rgba(255,255,255,.04);border:1px solid var(--border,#333);border-radius:12px;padding:8px 10px;cursor:pointer;color:inherit;width:100%}"
    + ".asd-mapico{font-size:20px;min-width:28px;text-align:center}"
    + ".asd-mapdown{text-align:center;opacity:.6;line-height:1}"
    + ".as-ok{color:var(--green,#30a46c);font-weight:700}.as-warn{color:var(--gold,#f5b301);font-weight:700}"
    + ".asd-bars{display:flex;gap:10px;align-items:flex-end;min-height:120px;padding-top:8px}"
    + ".asd-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}"
    + ".asd-barfill{width:100%;max-width:56px;background:linear-gradient(180deg,var(--gold,#f5b301),#b97e00);border-radius:8px 8px 0 0;min-height:4px}"
    + ".as-resume{border-color:var(--gold,#f5b301)}" + ".asr-combo{font-weight:800;color:#ff8c42;background:rgba(255,140,66,.12);border:1px solid rgba(255,140,66,.4);border-radius:10px;padding:2px 8px}" + ".asr-mode{font-weight:700;background:rgba(255,255,255,.06);border:1px solid var(--border,#333);border-radius:10px;padding:2px 8px;font-size:12px}" + ".asr-conj{display:flex;flex-direction:column;gap:10px}" + ".asr-conjrow{background:rgba(255,255,255,.03);border:1px solid var(--border,#333);border-radius:12px;padding:8px}"
    + ".tag{background:rgba(255,255,255,.07);border:1px solid var(--border,#333);border-radius:20px;padding:2px 10px;font-size:12px}"
    /* scroll anchors: keep focused workspace visible below the fixed header
       and above the mobile bottom nav; no absolute/fake-spacing hacks */
    + "html{scroll-padding-top:calc(var(--dm-header-h,68px) + 14px + env(safe-area-inset-top,0px))}"
    + "#assessRoot,#assessRunner,#assessResult,#assessDash{scroll-margin-top:calc(var(--dm-header-h,68px) + 14px + env(safe-area-inset-top,0px))}"
    + "#assessRunner{padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))}"
    + ".asr-nav{position:sticky;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:5;background:inherit;padding:6px 0}";
  function injectCss() {
    try { if (document.getElementById("assessCss")) return; var st = document.createElement("style"); st.id = "assessCss"; st.textContent = CSS; document.head.appendChild(st); } catch (e) {}
  }
  function ensureRoot() {
    try {
      var page = document.getElementById("page-quiz");
      if (!page) return null;
      var root = document.getElementById("assessRoot");
      if (!root) {
        root = document.createElement("div");
        root.id = "assessRoot";
        page.insertBefore(root, page.firstChild.nextSibling);
      }
      return root;
    } catch (e) { return null; }
  }
  function renderQuizPage() {
    try {
      if (!ensureRoot()) return;
      var s = DMAssess.app.getSess();
      if (s && s.qs && s.qs.length) DMAssess.app.renderRunner();
      else DMAssess.center.renderCenter();
    } catch (e) { if (window.console) console.error("assess render", e); }
  }
  function skipRender() {
    try { if (window.DMPageState && DMPageState.skipRender && DMPageState.skipRender("quiz")) return true; } catch (e) {}
    return false;
  }
  function wrap() {
    try {
      if (typeof showPage !== "function") return false;
      if (showPage._asWrapped) return true;
      var prev = showPage;
      var next = function (n) {
        var r = prev(n);
        try { if (n === "quiz" && !skipRender()) renderQuizPage(); } catch (e) { if (window.console) console.error(e); }
        return r;
      };
      next._asWrapped = true;
      showPage = next;
      try { window.showPage = next; } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  injectCss();
  if (!wrap()) {
    try {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { injectCss(); wrap(); ensureRoot(); });
      else setTimeout(function () { wrap(); }, 300);
    } catch (e) {}
  }
})();





try { if (typeof module !== "undefined" && module.exports) module.exports = DMAssess; } catch (e) {}
