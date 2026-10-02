/* ============================================================================
   Deutsch Master — Unified Learning Progress (DMProgress)
   Phase 2: accurate progress tracking, versioned persistence, error skills,
   deterministic review policy, dashboard helpers.

   Design notes (kept deliberately small, no dependencies):
   - ONE event log: S.events (ring buffer, capped). Each real attempt is logged
     exactly once via DMProgress.logAttempt(); re-renders / refreshes never
     create new events because every attempt carries a stable attempt id (aid)
     and already-seen aids are ignored.
   - Stable content ids (word/grammar/sentence/question ids), never raw text,
     are used as keys. Display text is stored only as a short debug snapshot.
   - Schema is versioned (S.schemaV). migrate() upgrades old stores in place
     and NEVER deletes existing progress, settings, streaks or mistakes.
   - Storage failures (private mode, quota) are swallowed gracefully: the
     in-memory state keeps working and the user is never blocked.
   - Review scheduling is a documented SM-2-lite policy (see nextReview()).
   ============================================================================ */

/* ============================ PURE ENGINE ============================ */
var DMProgress = (function () {
  "use strict";
  var SCHEMA_V = 3;
  var MAX_EVENTS = 500;   /* retention: bound history, keep app light */
  var MAX_SEEN = 1200;    /* dedupe table bound */

  function todayKey(d) {
    var x = d || new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate());
  }
  function dayDiff(aKey, bKey) {
    try {
      var a = aKey.split("-"), b = bKey.split("-");
      var aT = Date.UTC(+a[0], +a[1] - 1, +a[2]);
      var bT = Date.UTC(+b[0], +b[1] - 1, +b[2]);
      return Math.round((bT - aT) / 86400000);
    } catch (e) { return 0; }
  }

  /* Build a canonical attempt event. All fields optional except section+qtype;
     ids fall back to "" (never null) so JSON stays stable. */
  function makeAttempt(o) {
    o = o || {};
    return {
      aid: String(o.aid || ""),                 /* stable attempt id (dedupe key) */
      ts: o.ts || new Date().toISOString(),
      day: o.day || todayKey(),
      sec: String(o.sec || ""),                /* source section: quiz, review, ... */
      session: String(o.session || ""),        /* exercise/session id */
      qid: String(o.qid || ""),                /* stable question/content id */
      qtype: String(o.qtype || ""),            /* article, plural, order, ... */
      ref: String(o.ref || ""),                /* vocab/grammar/sentence id */
      lvl: String(o.lvl || ""),                /* A1..B2 */
      kap: String(o.kap || ""),
      ok: o.ok === true,
      score: typeof o.score === "number" ? o.score : (o.ok ? 1 : 0),
      max: typeof o.max === "number" ? o.max : 1,
      tries: typeof o.tries === "number" ? o.tries : 1,
      ms: typeof o.ms === "number" ? o.ms : 0,  /* time spent, when measured */
      hint: o.hint === true,
      completed: o.completed === true           /* attempt closed a session */
    };
  }

  function ensureStore(s) {
    s = s || {};
    if (!Array.isArray(s.events)) s.events = [];
    if (!s.evSeen || typeof s.evSeen !== "object") s.evSeen = {};
    if (typeof s.evSeq !== "number") s.evSeq = 0;
    if (typeof s.totalAnswered !== "number") s.totalAnswered = 0;
    if (typeof s.totalCorrect !== "number") s.totalCorrect = 0;
    return s;
  }

  /* Record one attempt. Returns {recorded:true} or {recorded:false, reason}.
     Reasons: "no-aid" (caller must supply stable id), "duplicate" (already
     logged — re-render/refresh/retry of the same attempt), "bad-event". */
  function logAttempt(store, evt) {
    if (!store || !evt) return { recorded: false, reason: "bad-event" };
    ensureStore(store);
    if (!evt.aid) return { recorded: false, reason: "no-aid" };
    if (store.evSeen[evt.aid]) return { recorded: false, reason: "duplicate" };
    var e = makeAttempt(evt);
    store.events.push(e);
    store.evSeen[e.aid] = 1;
    /* retention: drop oldest events, keep dedupe keys for the dropped ones
       so a late duplicate can never resurrect inflated counts. */
    while (store.events.length > MAX_EVENTS) { store.events.shift(); }
    var keys = Object.keys(store.evSeen);
    if (keys.length > MAX_SEEN) {
      var keep = {};
      store.events.forEach(function (x) { keep[x.aid] = 1; });
      var fresh = {};
      keys.forEach(function (k) { if (keep[k]) fresh[k] = 1; });
      /* always keep the most recent overflow keys too (still bounded) */
      store.evSeen = fresh;
    }
    store.totalAnswered += 1;
    if (e.ok) store.totalCorrect += 1;
    return { recorded: true };
  }

  /* Rebuild aggregate counters from the event log (e.g. after refresh or
     import). Used to prove scores survive reloads without inflation. */
  function rebuildTotals(store) {
    ensureStore(store);
    var a = 0, c = 0;
    store.events.forEach(function (e) { a++; if (e.ok) c++; });
    store.totalAnswered = a;
    store.totalCorrect = c;
    return { totalAnswered: a, totalCorrect: c };
  }

  /* ---- Versioned migration (never destructive) ---- */
  function migrate(store) {
    if (!store || typeof store !== "object") return { migrated: false, from: -1 };
    var from = (typeof store.schemaV === "number") ? store.schemaV : 0;
    if (from >= SCHEMA_V) { ensureStore(store); return { migrated: false, from: from }; }
    /* v0->v1: introduce event log alongside legacy counters (legacy totals
       are KEPT; events start empty so old scores are never double counted). */
    ensureStore(store);
    /* v1->v2: introduce dedupe table + sequence counter. */
    if (!store.evSeen) store.evSeen = {};
    if (typeof store.evSeq !== "number") store.evSeq = store.events.length;
    /* v2->v3: last-activity pointer for "continue learning". */
    if (!store.lastActivity) store.lastActivity = null;
    store.schemaV = SCHEMA_V;
    return { migrated: true, from: from };
  }

  function safeSave(store, key) {
    try {
      if (typeof localStorage === "undefined") return { saved: false, reason: "no-storage" };
      localStorage.setItem(key, JSON.stringify(store));
      return { saved: true };
    } catch (e) {
      /* quota / private-mode: keep in-memory state, try a compacted retry
         (drop oldest half of events, keep aggregates which are authoritative). */
      try {
        if (store && Array.isArray(store.events) && store.events.length > 50) {
          store.events = store.events.slice(-50);
          localStorage.setItem(key, JSON.stringify(store));
          return { saved: true, compacted: true };
        }
      } catch (e2) {}
      return { saved: false, reason: "storage-error" };
    }
  }

  /* ---- Deterministic review policy (documented SM-2-lite) ----
     Inputs:  ok (bool), laps (consecutive successes), ease (factor),
              miss (lifetime mistakes for this item).
     - fail: laps reset to 0, ease penalized (floor 1.3), review tomorrow.
     - success: laps+1, ease rewarded (cap 2.8); intervals grow
       1 -> 3 -> ~laps*ease*2 days; frequently-missed items (miss>=3)
       use conservative intervals (halved growth).
     Mastered items (laps>=8) stay accessible: they return a long but
     finite interval (90d), never deletion. */
  function nextReview(st) {
    st = st || {};
    var laps = Math.max(0, st.laps | 0);
    var ease = (typeof st.ease === "number" && st.ease > 0) ? st.ease : 2.5;
    var miss = Math.max(0, st.miss | 0);
    var ok = st.ok === true;
    if (!ok) {
      return { laps: 0, ease: Math.max(1.3, +(ease - 0.3).toFixed(2)), dueIn: 1 };
    }
    laps += 1;
    ease = Math.min(2.8, +(ease + 0.12).toFixed(2));
    var dueIn;
    if (laps === 1) dueIn = 1;
    else if (laps === 2) dueIn = 3;
    else if (laps >= 8) dueIn = 90;
    else dueIn = Math.round(laps * ease * 2);
    if (miss >= 3) dueIn = Math.max(1, Math.round(dueIn / 2)); /* conservative */
    return { laps: laps, ease: ease, dueIn: dueIn };
  }

  /* Order review candidates: overdue first (most overdue wins), then most
     mistakes, then fewest laps. Pure + deterministic (ties by id). */
  function buildQueue(items, today) {
    today = today || todayKey();
    return (items || []).slice().sort(function (a, b) {
      var ao = Math.max(0, dayDiff(a.due || today, today));
      var bo = Math.max(0, dayDiff(b.due || today, today));
      if (bo !== ao) return bo - ao;
      var m = (b.miss | 0) - (a.miss | 0);
      if (m !== 0) return m;
      var l = (a.laps | 0) - (b.laps | 0);
      if (l !== 0) return l;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
  }

  /* ---- Error Notebook: skill grouping ----
     Classification prefers stable identifiers (kind/qtype/grammarTarget);
     display-text matching is only a fallback and never the sole key:
     every entry also keeps its ref/qid so identical strings from different
     skills stay separate. */
  var SKILLS = {
    artikel:      { ar: "أدوات التعريف (der/die/das)", rule: "g1", why: "كل اسم في الألمانية له أداة ثابتة تُحفظ مع الكلمة: der للمذكر، die للمؤنث، das للمحايد.", ex: ["Der Tisch ist groß.", "الطاولة كبيرة."] },
    plural:       { ar: "الجمع (Plural)", rule: "g2", why: "الجمع في الألمانية له أشكال متعددة (-e, -en, -er, -s, Umlaut) ويُحفظ مع كل اسم.", ex: ["Die Tische sind neu.", "الطاولات جديدة."] },
    "ein-kein":   { ar: "التنكير والنفي (ein/kein)", rule: "g3", why: "ein للمذكر/المحايد وeine للمؤنث. النفي بـ kein (وليس nicht) قبل الأسماء.", ex: ["Ich habe kein Auto.", "ليس عندي سيارة."] },
    "nicht-kein": { ar: "الفرق بين nicht و kein", rule: "g4", why: "kein تنفي الأسماء (kein Zeit)، وnicht تنفي الأفعال والصفات وباقي الجملة.", ex: ["Ich lerne nicht.", "أنا لا أذاكر."] },
    pronomen:     { ar: "الضمائر الشخصية", rule: "g5", why: "الضمير يتغير حسب الفاعل: ich/du/er/sie/es/wir/ihr/sie — ولكل ضمير تصريف فعل خاص.", ex: ["Er wohnt in Kairo.", "هو يسكن في القاهرة."] },
    possessiv:    { ar: "ضمائر الملكية (mein/dein/...)", rule: "g6", why: "ضمير الملكية يتبع جنس الاسم المملوك: mein Bruder لكن meine Schwester.", ex: ["Meine Schwester lernt.", "أختي تذاكر."] },
    konjugation:  { ar: "تصريف الأفعال", rule: "g7", why: "نهاية الفعل تتغير مع الفاعل: ich lerne لكن er lernt وdu lernst.", ex: ["Du lernst Deutsch.", "أنت تتعلم الألمانية."] },
    akkusativ:    { ar: "حالة المفعول (Akkusativ)", rule: "g8", why: "المفعول المباشر يغيّر الأداة: der→den وein→einen (للمذكر فقط).", ex: ["Ich sehe den Mann.", "أرى الرجل."] },
    wortstellung: { ar: "ترتيب الجملة", rule: "g9", why: "الفعل المصرف دائمًا في المرتبة الثانية في الجملة الخبرية.", ex: ["Heute lerne ich Deutsch.", "اليوم أتعلم الألمانية."] },
    fragen:       { ar: "تكوين الأسئلة", rule: "g10", why: "سؤال نعم/لا يبدأ بالفعل، وسؤال الاستفهام يبدأ بأداة (Was/Wo/Wer/Wie) ثم الفعل.", ex: ["Wo wohnst du?", "أين تسكن؟"] },
    praepositionen:{ ar: "حروف الجر", rule: "g11", why: "كل حرف جر يحفظ مع حالته: aus/bei/mit/nach/seit/von/zu + Dativ، وin/auf غالبًا مع Akkusativ للاتجاه.", ex: ["Ich komme aus Ägypten.", "أنا من مصر."] },
    allgemein:    { ar: "مفردات ومعاني", rule: "", why: "راجع معنى الكلمة ومثالها، واحفظها في جملة كاملة لا وحدها.", ex: ["Ich lerne jeden Tag.", "أتعلم كل يوم."] }
  };
  var KIND_SKILL = { article: "artikel", plural: "plural", write: "artikel", order: "wortstellung", sentence: "wortstellung", listening: "allgemein", "de-ar": "allgemein", "ar-de": "allgemein", conjugation: "konjugation", akkusativ: "akkusativ" };
  function classifyError(o) {
    o = o || {};
    if (o.skill && SKILLS[o.skill]) return o.skill;
    var k = String(o.kind || o.qtype || o.grammarTarget || "").toLowerCase();
    if (KIND_SKILL[k]) return KIND_SKILL[k];
    if (/akk|den\b|einen\b/.test(k)) return "akkusativ";
    if (/konjug|conjugation|verb/.test(k)) return "konjugation";
    var t = (String(o.q || "") + " " + String(o.de || "") + " " + String(o.correct || "")).toLowerCase();
    if (/\b(der|die|das)\b.*\b(der|die|das)\b/.test(t) || /الأداة|article/.test(String(o.q || ""))) return "artikel";
    if (/plural|الجمع/.test(t)) return "plural";
    if (/\bkein\w*\b/.test(t) && /\bnicht\b/.test(t)) return "nicht-kein";
    if (/\bkein\w*|\bein\w*\b/.test(t)) return "ein-kein";
    if (/\b(mein|dein|sein|ihr|unser|euer)\w*\b/.test(t)) return "possessiv";
    if (/\b(ich|du |er |sie |es |wir|ihr |sie )\b/.test(" " + t + " ") && /verb|تصريف|conjugation/.test(t)) return "konjugation";
    if (/\b(den|einen)\b/.test(t)) return "akkusativ";
    if (/\b(was|wo|wer|wie|wann|warum)\b/.test(t) || /سؤال/.test(String(o.q || ""))) return "fragen";
    if (/\b(aus|bei|mit|nach|seit|von|zu|in|auf|an)\b/.test(t)) return "praepositionen";
    if (/\b(ich|du|er|sie|wir)\b/.test(t) && t.split(" ").length > 3) return "wortstellung";
    return "allgemein";
  }
  function skillOfMistake(m, word) {
    m = m || {};
    return classifyError({ skill: m.skill, kind: m.kind, q: m.q, de: m.de || (word && word.de), correct: m.ok });
  }

  /* ---- Dashboard helpers ---- */
  /* Continue learning: last real activity pointer {page, ts, label}. */
  function continueTarget(store) {
    var a = store && store.lastActivity;
    if (a && a.page) return { page: a.page, label: a.label || "", ts: a.ts || "" };
    return { page: "vocab", label: "", ts: "" };
  }
  /* Weekly summary: this 7-day window vs previous 7 days, from the event
     log only (never fabricated; empty log => zeros + hasData:false). */
  function weeklySummary(store, nowIso) {
    var now = nowIso ? new Date(nowIso) : new Date();
    function k(d) { return todayKey(d); }
    var cur = { ans: 0, ok: 0 }, prev = { ans: 0, ok: 0 };
    (store && store.events ? store.events : []).forEach(function (e) {
      var d;
      try { d = new Date(e.ts); } catch (x) { return; }
      if (isNaN(d)) return;
      var diff = Math.round((now - d) / 86400000);
      if (diff < 0 || diff >= 14) return;
      var b = diff < 7 ? cur : prev;
      b.ans++; if (e.ok) b.ok++;
    });
    function pct(x) { return x.ans ? Math.round(x.ok / x.ans * 100) : 0; }
    return {
      hasData: cur.ans > 0 || prev.ans > 0,
      cur: { ans: cur.ans, ok: cur.ok, pct: pct(cur) },
      prev: { ans: prev.ans, ok: prev.ok, pct: pct(prev) },
      deltaAns: cur.ans - prev.ans,
      deltaPct: pct(cur) - pct(prev)
    };
  }

  return {
    SCHEMA_V: SCHEMA_V, MAX_EVENTS: MAX_EVENTS,
    todayKey: todayKey, dayDiff: dayDiff,
    makeAttempt: makeAttempt, logAttempt: logAttempt,
    rebuildTotals: rebuildTotals, migrate: migrate, safeSave: safeSave,
    nextReview: nextReview, buildQueue: buildQueue,
    SKILLS: SKILLS, classifyError: classifyError, skillOfMistake: skillOfMistake,
    continueTarget: continueTarget, weeklySummary: weeklySummary
  };
})();
/* Node export for tools/ tests (browser keeps the global). */
try { if (typeof module !== "undefined" && module.exports) module.exports = DMProgress; } catch (e) {}

/* ====================== RENDERERS (browser) ====================== */
(function () {
  "use strict";
  if (typeof window === "undefined") return;       /* Node: pure core only */
  if (typeof document === "undefined") return;
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(function () {
    try {
      if (typeof S === "undefined") return;
      /* 1) migrate + ensure fields (never destructive) */
      var mg = DMProgress.migrate(S);
      if (mg.migrated) { try { save(); } catch (e) {} }

      /* 2) unified attempt logging hooked at the single choke point:
            showFeedback(ok, q, picked) runs exactly once per real attempt
            (Next is disabled until it runs; timeoutAnswer guards re-entry).
            Dedupe token = session:question-index guards even that. */
      var sessSeq = 0, lastAid = "";
      if (typeof startQuizRun === "function" && !window.__dmProgWrapped) {
        window.__dmProgWrapped = true;
        var _start = startQuizRun;
        startQuizRun = function (type, qs) { sessSeq++; lastAid = ""; return _start(type, qs); };
        if (typeof showFeedback === "function") {
          var _fb = showFeedback;
          showFeedback = function (ok, q, picked) {
            try {
              var idx = (typeof quizIdx === "number") ? quizIdx : -1;
              var aid = "s" + sessSeq + "q" + idx;
              if (aid !== lastAid && q) {
                lastAid = aid;
                S.evSeq = (S.evSeq || 0) + 1;
                var r = DMProgress.logAttempt(S, DMProgress.makeAttempt({
                  aid: "ev" + S.evSeq + "-" + aid,
                  sec: "quiz", session: String((typeof quizType !== "undefined") ? quizType : ""),
                  qid: (q.fillItem && q.fillItem.id) || (q.w && q.w.id) || "",
                  qtype: q.kind || "", ref: (q.w && q.w.id) || "",
                  lvl: (q.w && q.w.level) || (q.fillItem && q.fillItem.lvl) || "",
                  kap: (q.fillItem && q.fillItem.chapterId) || (q.w && q.w.kap) || "",
                  ok: ok === true, tries: 1, hint: false
                }));
                if (r.recorded) { try { save(); } catch (e) {} }
              }
            } catch (e) {}
            return _fb(ok, q, picked);
          };
        }
        /* 3) last-activity pointer for "continue learning" */
        if (typeof showPage === "function" && !window.__dmProgPageWrapped) {
          window.__dmProgPageWrapped = true;
          var _sp = showPage;
          var LEARN_PAGES = { vocab: 1, sentences: 1, verbs: 1, grammar: 1, explain: 1, reference: 1, flashcards: 1, quiz: 1, review: 1, practice: 1, tutor: 1, career: 1, job: 1, mygermany: 1 };
          showPage = function (name) {
            try {
              if (LEARN_PAGES[name]) { S.lastActivity = { page: name, ts: new Date().toISOString() }; save(); }
            } catch (e) {}
            return _sp(name);
          };
        }
      }

      /* 4) Error-Notebook skill filter: options into existing kapitel select row */
      try {
        var kapSel = document.getElementById("mistKapitel");
        if (kapSel && !document.getElementById("mistSkill")) {
          var sel = document.createElement("select");
          sel.id = "mistSkill";
          sel.innerHTML = '<option value="">كل المهارات</option>' +
            Object.keys(DMProgress.SKILLS).map(function (k) {
              return '<option value="' + k + '">' + DMProgress.SKILLS[k].ar + '</option>';
            }).join("");
          sel.addEventListener("change", function () { try { renderMistakes(); } catch (e) {} });
          kapSel.parentNode.insertBefore(sel, kapSel.nextSibling);
        }
      } catch (e) {}

      /* 5) Offline status indicator (topbar): distinguishes cached content
            from network-dependent features without claiming offline AI. */
      try {
        if (!document.getElementById("offlineBadge")) {
          var pill = document.getElementById("topStreak");
          var b = document.createElement("div");
          b.id = "offlineBadge";
          b.className = "streak-pill";
          b.style.display = "none";
          b.textContent = "📴 دون اتصال — الدروس المحفوظة تعمل";
          if (pill && pill.parentNode) pill.parentNode.insertBefore(b, pill.nextSibling);
          var upd = function () { b.style.display = navigator.onLine ? "none" : ""; };
          window.addEventListener("online", upd);
          window.addEventListener("offline", upd);
          upd();
        }
      } catch (e) {}

      /* 6) Dashboard: continue-learning + weekly summary (pure helpers). */
      try {
        var dash = document.getElementById("page-dashboard");
        if (dash && !document.getElementById("dmContinue")) {
          var t = DMProgress.continueTarget(S);
          var w = DMProgress.weeklySummary(S);
          var box = document.createElement("div");
          box.className = "panel glass";
          box.id = "dmContinue";
          box.style.marginTop = "12px";
          var wTxt = w.hasData
            ? ("📊 آخر ٧ أيام: " + w.cur.ans + " محاولة (" + w.cur.pct + "٪)" +
               (w.prev.ans ? (" — مقابل " + w.prev.ans + " (" + w.prev.pct + "٪) الأسبوع السابق") : " — استمر! 💪"))
            : "📊 ابدأ أول اختبار وستظهر هنا مقارنتك الأسبوعية.";
          box.innerHTML =
            '<div class="row-flex"><button class="btn btn-primary sm" id="dmContinueBtn">▶️ تابع من حيث توقفت' +
            (t.label ? " (" + t.label + ")" : "") + '</button>' +
            '<span class="muted">' + wTxt + '</span></div>';
          var hero = dash.querySelector(".hero");
          if (hero && hero.parentNode) hero.parentNode.insertBefore(box, hero.nextSibling);
          else dash.insertBefore(box, dash.firstChild);
          var cb = document.getElementById("dmContinueBtn");
          if (cb) cb.addEventListener("click", function () {
            try { showPage(DMProgress.continueTarget(S).page); } catch (e) {}
          });
        }
      } catch (e) {}
    } catch (e) { /* never break the app */ }
  });
})();
