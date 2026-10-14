/* ============================================================================
   Deutsch Master — Test Center guided flow (التدفق الموجّه للاختبارات)
   ----------------------------------------------------------------------------
   ADDITIVE UI layer over the DMAssess engine (client/assess.js). No new
   content banks, no new progress schema, no router changes.
   Flow: اختر المستوى -> اختر Kapitel -> اختر الفئة -> workspace (العدد +
   الصعوبة + الطريقة) -> ابدأ
   Plus: custom builder, smart mixed presets, daily, boss, cumulative,
   personal records.
   All counts/availability are probed live from real content; empty
   categories are hidden, never faked. Rendered inside #assessRoot by
   DMAssess.center (loose coupling, fully guarded).

   SCROLL CONTRACT (UX fix): the selector never moves the viewport to the
   page top. Selecting a Kapitel focuses #tcCats; selecting a category
   focuses #tcWorkspace — both via header-aware smooth scrolling
   (DMAssess.app.focusBelowHeader). No window.scrollTo(0,0), no hacks.
   ========================================================================== */
"use strict";
/* ---------- interface language keys (same I18N system; merged additively) ---------- */
try{
Object.assign(I18N.ar,{tc_full:"الاختبار الشامل",tc_smart:"اختبرني بذكاء",tc_cumul:"اختبار تراكمي",tc_boss:"اختبار الزعيم",tc_sec_h:"🧭 مركز الاختبارات — اختر خطوتك",tc_s1:"1. اختر المستوى",tc_locked_tip:"المحتوى قيد التجهيز",tc_prep:"محتوى ",tc_prep_mid:" قيد التجهيز (",tc_words:" كلمة). يمكنك التدرب على A1 أو تحميل المحتوى.",tc_load:"⬇️ تحميل محتوى ",tc_s2:"2. اختر Kapitel (",tc_s2_close:")",tc_nokap:"لا توجد Kapitel لهذا المستوى بعد.",tc_chip_new:"🔒 جديد",tc_chip_done:"🟢 متقن",tc_chip_ready:"🟢 جاهز",tc_chip_rev:"🟡 مراجعة",tc_chip_train:"🔴 تدريب",tc_mastery_w:" إتقان • ",tc_last_r:"آخر نتيجة: ",tc_never:"لم يُختبر",tc_tests_n:" اختبارات",tc_s3:"3. ماذا تريد أن تختبر في ",tc_avail:" متاح",tc_mist_open:" مفتوحة",tc_no_content:"لا يوجد محتوى كافٍ في ",tc_no_content2:" بعد — أكمل الدروس أولًا.",tc_ready_h:"⚡ اختبارات جاهزة",tc_daily:"🎯 تحدي اليوم",tc_builder_show:"▲ إخفاء",tc_builder_make:"🛠️ إنشاء اختبار خاص",tc_train_first:"🎧 تدرب أولًا ثم اختبر",tc_train_sub:"أقسام التدريب الموجودة — الاختبار يقيس ما تعلمته هنا.",tc_go_listen:"🎧 استماع",tc_go_speak:"🎤 تحدث",tc_go_talk:"🗣️ محادثة",tc_go_real:"🌍 مواقف",tc_go_journey:"🗺️ الرحلة"});
Object.assign(I18N.en,{tc_full:"Comprehensive quiz",tc_smart:"Quiz me smart",tc_cumul:"Cumulative quiz",tc_boss:"Boss test",tc_sec_h:"🧭 Test center — pick your step",tc_s1:"1. Pick a level",tc_locked_tip:"Content in preparation",tc_prep:"Content ",tc_prep_mid:" in preparation (",tc_words:" words). Practice A1 or load content.",tc_load:"⬇️ Load content ",tc_s2:"2. Pick a Kapitel (",tc_s2_close:")",tc_nokap:"No Kapitel for this level yet.",tc_chip_new:"🔒 New",tc_chip_done:"🟢 Mastered",tc_chip_ready:"🟢 Ready",tc_chip_rev:"🟡 Review",tc_chip_train:"🔴 Train",tc_mastery_w:" mastery • ",tc_last_r:"Last result: ",tc_never:"Not tested",tc_tests_n:" quizzes",tc_s3:"3. What do you want to be tested on in ",tc_avail:" available",tc_mist_open:" open",tc_no_content:"Not enough content in ",tc_no_content2:" yet — finish lessons first.",tc_ready_h:"⚡ Ready quizzes",tc_daily:"🎯 Today's challenge",tc_builder_show:"▲ Hide",tc_builder_make:"🛠️ Build custom quiz",tc_train_first:"🎧 Train first, then test",tc_train_sub:"Existing training sections — the quiz measures what you learned here.",tc_go_listen:"🎧 Listening",tc_go_speak:"🎤 Speaking",tc_go_talk:"🗣️ Chat",tc_go_real:"🌍 Situations",tc_go_journey:"🗺️ Journey"});
Object.assign(I18N.de,{tc_full:"Umfassender Test",tc_smart:"Teste mich smart",tc_cumul:"Kumulativer Test",tc_boss:"Bosstest",tc_sec_h:"🧭 Testcenter — wähle deinen Schritt",tc_s1:"1. Niveau wählen",tc_locked_tip:"Inhalt in Vorbereitung",tc_prep:"Inhalt ",tc_prep_mid:" in Vorbereitung (",tc_words:" Wörter). Übe A1 oder lade Inhalt.",tc_load:"⬇️ Inhalt laden ",tc_s2:"2. Kapitel wählen (",tc_s2_close:")",tc_nokap:"Noch keine Kapitel für dieses Niveau.",tc_chip_new:"🔒 Neu",tc_chip_done:"🟢 Gemeistert",tc_chip_ready:"🟢 Bereit",tc_chip_rev:"🟡 Wiederholen",tc_chip_train:"🔴 Üben",tc_mastery_w:" Beherrschung • ",tc_last_r:"Letztes Ergebnis: ",tc_never:"Nicht getestet",tc_tests_n:" Tests",tc_s3:"3. Worüber willst du in ",tc_avail:" verfügbar",tc_mist_open:" offen",tc_no_content:"Noch nicht genug Inhalt in ",tc_no_content2:" — beende zuerst Lektionen.",tc_ready_h:"⚡ Fertige Tests",tc_daily:"🎯 Tages-Challenge",tc_builder_show:"▲ Ausblenden",tc_builder_make:"🛠️ Eigenen Test bauen",tc_train_first:"🎧 Erst trainieren, dann testen",tc_train_sub:"Vorhandene Trainingsbereiche — der Test misst, was du hier gelernt hast.",tc_go_listen:"🎧 Hören",tc_go_speak:"🎤 Sprechen",tc_go_talk:"🗣️ Chat",tc_go_real:"🌍 Situationen",tc_go_journey:"🗺️ Reise"});
}catch(__tc_i18n_e){}
/* ---------- interface language keys 2 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{tc_back:"← العودة لاختيار الاختبار",tc_cumul_scope:"النطاق التراكمي:",tc_range:"النطاق: ",tc_counts:"عدد الأسئلة",tc_avail_short:"المتاح: ",tc_pend:"⏳",tc_warn_low_a:"⚠️ المحتوى المتاح (",tc_warn_low_b:") أقل من العدد المطلوب — سيتم استخدام كل الأسئلة الصحيحة (",tc_warn_low_c:").",tc_will_make_a:"سيتم إنشاء ",tc_will_make_b:" سؤالًا متنوعًا من المحتوى الحقيقي.",tc_diff_h:"الصعوبة",tc_mode_h:"طريقة الاختبار",tc_start:"ابدأ الاختبار",tc_q:" سؤالًا",tc_builder_h:"🛠️ إنشاء اختبار خاص",tc_level_row:"المستوى:",tc_kap_row:"Kapitel:",tc_all:"الكل",tc_cats_row:"الفئات:",tc_diff_row:"الصعوبة:",tc_counts_row:"عدد الأسئلة:",tc_master_max:"Master (الأقصى)",tc_mode_row:"الوضع:",tc_rec_h:"🏅 سجلاتك الشخصية",tc_rec_best:"أفضل نتيجة",tc_rec_best_n:"من ",tc_rec_best_n2:" اختبارات",tc_rec_none:"لا اختبارات بعد",tc_rec_combo:"أطول سلسلة صحيحة",tc_rec_combo_x:"كومبو x",tc_rec_topkap:"أكثر Kapitel تم اختباره",tc_rec_topkap_n:" إجابات",tc_rec_topskill:"أكثر مهارة تحسنت",tc_rec_topskill_n:"تحتاج اختبارين+",tc_rec_count:"عدد الاختبارات",tc_rec_count_saved:"محفوظة",tc_rec_streak:"ستريك الأيام",tc_rec_streak_d:" يوم",tc_rec_streak_days:"أيام فيها اختبارات",tc_pick_first:"اختر Kapitel والفئة أولًا",tc_done_pct:"أنجزت تحدي اليوم بنتيجة ",tc_done_again:"% 🎉 — يمكنك إعادته للتدريب",tc_no_open:"لا أخطاء مفتوحة — أحسنت! 🎉",tc_no_open_cat:"لا أخطاء مفتوحة — أزلت فئة الأخطاء",tc_pick_one:"اختر فئة واحدة على الأقل",tc_loading:"⏳ جاري تحميل محتوى "});
Object.assign(I18N.en,{tc_back:"← Back to quiz picker",tc_cumul_scope:"Cumulative scope:",tc_range:"Range: ",tc_counts:"Question count",tc_avail_short:"Available: ",tc_pend:"⏳",tc_warn_low_a:"⚠️ Available content (",tc_warn_low_b:") is less than requested — all valid questions will be used (",tc_warn_low_c:").",tc_will_make_a:"Will create ",tc_will_make_b:" varied questions from real content.",tc_diff_h:"Difficulty",tc_mode_h:"Quiz method",tc_start:"Start quiz",tc_q:" questions",tc_builder_h:"🛠️ Build custom quiz",tc_level_row:"Level:",tc_kap_row:"Kapitel:",tc_all:"All",tc_cats_row:"Categories:",tc_diff_row:"Difficulty:",tc_counts_row:"Question count:",tc_master_max:"Master (max)",tc_mode_row:"Mode:",tc_rec_h:"🏅 Personal records",tc_rec_best:"Best score",tc_rec_best_n:"from ",tc_rec_best_n2:" quizzes",tc_rec_none:"No quizzes yet",tc_rec_combo:"Longest correct streak",tc_rec_combo_x:"combo x",tc_rec_topkap:"Most tested Kapitel",tc_rec_topkap_n:" answers",tc_rec_topskill:"Most improved skill",tc_rec_topskill_n:"needs 2+ quizzes",tc_rec_count:"Quiz count",tc_rec_count_saved:"saved",tc_rec_streak:"Day streak",tc_rec_streak_d:" days",tc_rec_streak_days:"days with quizzes",tc_pick_first:"Pick a Kapitel and category first",tc_done_pct:"Finished today's challenge at ",tc_done_again:"% 🎉 — replay it for training",tc_no_open:"No open mistakes — well done! 🎉",tc_no_open_cat:"No open mistakes — removed mistakes category",tc_pick_one:"Pick at least one category",tc_loading:"⏳ Loading content "});
Object.assign(I18N.de,{tc_back:"← Zurück zur Testauswahl",tc_cumul_scope:"Kumulativer Bereich:",tc_range:"Bereich: ",tc_counts:"Fragenanzahl",tc_avail_short:"Verfügbar: ",tc_pend:"⏳",tc_warn_low_a:"⚠️ Verfügbarer Inhalt (",tc_warn_low_b:") ist weniger als gewünscht — alle gültigen Fragen werden verwendet (",tc_warn_low_c:").",tc_will_make_a:"Erstellt ",tc_will_make_b:" gemischte Fragen aus echten Inhalten.",tc_diff_h:"Schwierigkeit",tc_mode_h:"Testmethode",tc_start:"Test starten",tc_q:" Fragen",tc_builder_h:"🛠️ Eigenen Test bauen",tc_level_row:"Niveau:",tc_kap_row:"Kapitel:",tc_all:"Alle",tc_cats_row:"Kategorien:",tc_diff_row:"Schwierigkeit:",tc_counts_row:"Fragenanzahl:",tc_master_max:"Master (max)",tc_mode_row:"Modus:",tc_rec_h:"🏅 Persönliche Rekorde",tc_rec_best:"Bestleistung",tc_rec_best_n:"aus ",tc_rec_best_n2:" Tests",tc_rec_none:"Noch keine Tests",tc_rec_combo:"Längste richtige Serie",tc_rec_combo_x:"Kombo x",tc_rec_topkap:"Meistgetestetes Kapitel",tc_rec_topkap_n:" Antworten",tc_rec_topskill:"Meistverbesserter Skill",tc_rec_topskill_n:"braucht 2+ Tests",tc_rec_count:"Testanzahl",tc_rec_count_saved:"gespeichert",tc_rec_streak:"Tagesserie",tc_rec_streak_d:" Tage",tc_rec_streak_days:"Tage mit Tests",tc_pick_first:"Wähle zuerst Kapitel und Kategorie",tc_done_pct:"Tages-Challenge geschafft mit ",tc_done_again:"% 🎉 — zum Training wiederholen",tc_no_open:"Keine offenen Fehler — gut gemacht! 🎉",tc_no_open_cat:"Keine offenen Fehler — Fehlerkategorie entfernt",tc_pick_one:"Wähle mindestens eine Kategorie",tc_loading:"⏳ Inhalt wird geladen "});
}catch(__tc_i18n_e2){}
/* ---------- interface language keys 3 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{tc_no_short:"لا يوجد محتوى كافٍ"});
Object.assign(I18N.en,{tc_no_short:"Not enough content"});
Object.assign(I18N.de,{tc_no_short:"Nicht genug Inhalt"});
}catch(__tc_i18n_e3){}
/* ---------- interface language keys 4 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{tc_buildstart:"ابدأ الاختبار المخصص 🚀"});
Object.assign(I18N.en,{tc_buildstart:"Start custom quiz 🚀"});
Object.assign(I18N.de,{tc_buildstart:"Eigenen Test starten 🚀"});
}catch(__tc_i18n_e4){}
function tcT(k,fb){try{if(typeof window!=="undefined"&&typeof window.t==="function"){var v=window.t(k);if(v!==null&&v!==undefined&&v!==""&&v!==k)return v;}}catch(e){}return (fb===undefined||fb===null)?k:fb;}
function tcLang(){try{if(typeof uilang==="function")return uilang();var L=(typeof S!=="undefined"&&S&&S.uiLang)||"ar";return L==="en"?"en":(L==="de"?"de":"ar");}catch(e){return "ar";}}
function tcModeDesc(md){try{var L=tcLang();if(L!=="ar")return (md&&(md.end||md.de))||"";return (md&&md.de)||"";}catch(e){try{return (md&&md.de)||"";}catch(e2){return "";}}}
function tcCatName(cid){try{var C=(typeof DMAssess!=="undefined"&&DMAssess.specs&&DMAssess.specs.CATS)||{};var c=C[cid]||{};if(typeof askSkillEntry==="function"){var v=askSkillEntry(c);if(v)return v;}}catch(e){}try{var C2=(typeof DMAssess!=="undefined"&&DMAssess.specs&&DMAssess.specs.CATS)||{};var c2=C2[cid]||{};return c2.ar||cid;}catch(e){return cid;}}
var DMTestCenter = (function () {
  if (typeof DMAssess === "undefined") return null;
  var C = DMAssess, U = DMAssess.ui, A = DMAssess.app, SP = DMAssess.specs;
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function esc(s) { return U.esc(s); }
  function toast(m, k) { try { var f = window.toast; if (typeof f === "function") f(m, k || "ok"); } catch (e) {} }
  function onQuizPage() {
    try { var p = document.getElementById("page-quiz"); return !!(p && p.classList.contains("active")); }
    catch (e) { return false; }
  }
  function goQuizIfNeeded() {
    try {
      if (!onQuizPage() && typeof showPage === "function") showPage("quiz");
    } catch (e) {}
  }
  /* Header-aware smooth focus on a Test Center anchor. Never jumps to top. */
  function focusTc(id, extra) {
    try {
      if (A && typeof A.focusBelowHeader === "function") {
        setTimeout(function () { try { A.focusBelowHeader(id, { extra: extra || 6 }); } catch (e) {} }, 60);
        return;
      }
      setTimeout(function () {
        try { var el = $(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
      }, 60);
    } catch (e) {}
  }

  var sel = { level: "A1", kap: null, cat: null, mode: "quick", diff: "medium", tmode: "test", cumul: null, showBuilder: false };
  var probeCache = {}, probeBankStamp = "\0";
  /* Probe cache must follow bank growth: idle/lazy merges append thousands
     of words, so a count probed at boot is stale after a merge. The stamp
     is just bank lengths (merges only ever append, same pattern as the
     dmWords cache in script.js) — exact and O(1). */
  function probeBank() {
    try {
      var v = (typeof VOCAB !== "undefined" && VOCAB) ? VOCAB.length : -1;
      var s = (typeof SENTENCES !== "undefined" && SENTENCES) ? SENTENCES.length : -1;
      var g = (typeof GRAMMAR !== "undefined" && GRAMMAR) ? GRAMMAR.length : -1;
      return v + "/" + s + "/" + g;
    } catch (e) { return "?"; }
  }
  /* Overlap guard: question generation is synchronous, but rapid double-taps
     queue a second full build that replaces the just-started session. One
     shared 600ms debounce across all start paths; legitimate retries work. */
  var lastStartAt = 0;
  function canStart() {
    var now = Date.now();
    if (now - lastStartAt < 600) return false;
    lastStartAt = now;
    return true;
  }
  /* A refused start (locked boss, no mistakes, no category) must not consume
     the debounce slot — the user didn't get a session. */
  function unStart() { lastStartAt = 0; }

  /* Test-method (طريقة الاختبار) options: affect session behavior only,
     never the question pool. Applied onto the spec before startFlow. */
  var TMODES = {
    training:  { ar: "تدريب 🟢",  de: "mit Erklärung", en: "Training 🟢" },
    test:      { ar: "اختبار 🔵", de: "Prüfung", en: "Test 🔵" },
    challenge: { ar: "تحدي 🟡 ⏱️", de: "Zeit-Challenge", en: "Challenge 🟡 ⏱️" }
  };
  function applyTMode(spec) {
    try {
      spec.customMode = sel.tmode || "test";
      if (sel.tmode === "challenge") { spec.qTimed = true; spec.qSecs = C.CONFIG.QTIME_SEC; }
    } catch (e) {}
    return spec;
  }
  function modeTarget() {
    try {
      var m = SP.MODES[sel.mode];
      if (m && m.n) return m.n;
    } catch (e) {}
    return C.CONFIG.MASTER_CAP;
  }
  function lvlOrNull() { return sel.level === "A1" ? null : sel.level; }

  function openMistakes() {
    try {
      var M = (typeof S !== "undefined" && S.mistakes) || {};
      return Object.keys(M).filter(function (id) { return !M[id].done; }).length;
    } catch (e) { return 0; }
  }
  /* Honest availability probe: builds the REAL spec (master-sized) and
     counts valid questions. Cached per level|kap|cat. Never faked.
     Synchronous form is kept for exact on-demand use (tests, Start-time
     checks); the interactive selector below uses probeAvail so a Kapitel
     click never blocks the main thread on full test-generation builds. */
  function probeKey(kap, catId, level) {
    /* The mistakes probe depends on live user state (open mistake count), not just
       bank content: without this, probeCache serves a stale count after the learner
       records or clears mistakes, and the hub card wrongly lingers or stays hidden
       until an unrelated bank merge busts the cache. The count suffix keeps the
       cache exact (same count = same result) at zero perf cost. */
    var mist = "";
    if (catId === "mistakes") { try { mist = "|m" + openMistakes(); } catch (e) {} }
    return (level || "*") + "|" + (kap || "*") + "|" + catId + "|" + sel.diff + mist;
  }
  function probeBuild(kap, catId, level) {
    var key = probeKey(kap, catId, level);
    var n = 0;
    try {
      if (catId === "mistakes") {
        n = openMistakes() > 0 ? U.mistakePlan(12).plan.length * 2 : 0;
      } else if (catId === "__smart__") {
        n = SP.smartSpec({ weak: [], kap: kap, total: C.CONFIG.MASTER_CAP }).build().length;
      } else if (catId === "__cumul__") {
        n = SP.cumulSpec(defaultCumulKaps(kap), C.CONFIG.MASTER_CAP, { level: level }).build().length;
      } else if (catId === "__full__") {
        n = SP.kapitelExamSpec(kap, level, C.CONFIG.MASTER_CAP).build().length;
      } else if (catId === "__boss__") {
        n = SP.bossSpec(kap, C.CONFIG.MASTER_CAP).build().length;
      } else {
        var cat = SP.CATS[catId];
        if (cat && cat.facs) {
          /* diff-aware: same difficulty filter the real build will use,
             so the shown availability matches what Start will generate */
          n = SP.kapitelCategorySpec(kap, catId, "master", sel.diff, level).build().length;
        }
      }
    } catch (e) { n = 0; }
    probeCache[key] = n;
    return n;
  }
  function probeCount(kap, catId, level) {
    try {
      var st = probeBank();
      if (st !== probeBankStamp) { probeCache = {}; probeBankStamp = st; }
    } catch (e) {}
    var key = probeKey(kap, catId, level);
    if (probeCache[key] != null) return probeCache[key];
    return probeBuild(kap, catId, level);
  }
  /* Selection-path availability: NEVER builds synchronously. Returns the
     cached exact count, computes cheap mistake counts inline, and otherwise
     queues the exact same build for a background chunk (returns PENDING).
     Cards render instantly with an honest computing placeholder; the queued
     build fills in the identical number probeCount would have returned. */
  var PENDING = -1;
  var probeGen = 0, probeQueue = [], probePumping = false;
  function enqueueProbe(kap, catId, level, ck, kaps) {
    try {
      for (var i = 0; i < probeQueue.length; i++) {
        var q = probeQueue[i];
        if (q.ck ? q.ck === ck : (!ck && q.kap === kap && q.cat === catId && (q.level || "*") === (level || "*"))) return;
      }
      probeQueue.push({ kap: kap, cat: catId, level: level, ck: ck || null, kaps: kaps || null, gen: probeGen, diff: sel.diff });
      if (probeQueue.length > 60) probeQueue.splice(0, probeQueue.length - 60);
    } catch (e) {}
  }
  function probeAvail(kap, catId, level) {
    try {
      var st = probeBank();
      if (st !== probeBankStamp) { probeCache = {}; probeBankStamp = st; probeGen++; probeQueue.length = 0; }
    } catch (e) {}
    var key = probeKey(kap, catId, level);
    if (probeCache[key] != null) return probeCache[key];
    if (catId === "mistakes") return probeBuild(kap, catId, level);
    enqueueProbe(kap, catId, level, null, null);
    return PENDING;
  }
  /* Range-aware cumulative availability (workspace only). Same pending
     contract as probeAvail; the queued build uses the frozen range. */
  function cumulAvail() {
    try {
      var ck = "*|" + cumulKaps().join("+") + "|__cumul__";
      if (probeCache[ck] != null) return probeCache[ck];
      enqueueProbe(sel.kap, "__cumul__", lvlOrNull(), ck, cumulKaps());
      return PENDING;
    } catch (e) { return PENDING; }
  }
  function kickProbes() {
    try {
      if (probePumping || !probeQueue.length) return;
      try { if (A.getSess()) return; } catch (e) {}
      probePumping = true;
      setTimeout(pumpStep, 0);
    } catch (e) { probePumping = false; }
  }
  /* One exact probe build per macrotask: the UI stays responsive between
     chunks, so selection never produces a "Page Unresponsive" dialog even
     when a sparse bank makes a single category build expensive. Stale items
     (selection moved on) are dropped, never built: no overlapping work. */
  function pumpStep() {
    probePumping = false;
    try {
      try { if (A.getSess()) return; } catch (e) {}
      var item = null;
      while (probeQueue.length) {
        var head = probeQueue[0];
        if (head.gen !== probeGen || head.diff !== sel.diff) { probeQueue.shift(); continue; }
        item = head; break;
      }
      if (!item) return;
      probeQueue.shift();
      /* bank grew mid-queue (lazy merge landed between chunks): resync the
         cache stamp first so this build — and its paint — use the fresh bank */
      try {
        var bst = probeBank();
        if (bst !== probeBankStamp) { probeCache = {}; probeBankStamp = bst; }
      } catch (e0) {}
      var n;
      if (item.ck) {
        if (probeCache[item.ck] != null) n = probeCache[item.ck];
        else {
          try { n = SP.cumulSpec(item.kaps && item.kaps.length ? item.kaps : [item.kap], C.CONFIG.MASTER_CAP, { level: item.level }).build().length; }
          catch (e) { n = 0; }
          probeCache[item.ck] = n;
        }
      } else {
        var key = probeKey(item.kap, item.cat, item.level);
        if (probeCache[key] != null) n = probeCache[key];
        else n = probeBuild(item.kap, item.cat, item.level);
      }
      probePainted(item, n);
    } catch (e) {}
    try {
      if (probeQueue.length) {
        var live = false;
        try { live = !A.getSess(); } catch (e2) { live = true; }
        if (live) { probePumping = true; setTimeout(pumpStep, 0); }
      }
    } catch (e3) {}
  }
  function minFor(catId) {
    if (catId === "__full__") return 8;
    if (catId === "__smart__") return 6;
    if (catId === "__cumul__") return 8;
    if (catId === "mistakes") return 1;
    if (catId === "__boss__") return 8;
    return 5;
  }
  function countLabel(n, catId) {
    if (catId === "mistakes") { try { return openMistakes() + tcT("tc_mist_open", " مفتوحة"); } catch (e) { return ""; } }
    return n >= C.CONFIG.MASTER_CAP ? C.CONFIG.MASTER_CAP + "+" + tcT("tc_avail", " متاح") : n + tcT("tc_avail", " متاح");
  }
  /* Targeted fill-in for one finished probe: updates only that card's count
     (or hides it when honestly empty) and refreshes the workspace when it
     shows the probed category. No full-page rerender, no listener rewiring
     for untouched cards, no scroll jumps. */
  function probePainted(item, n) {
    try {
      if (item.gen !== probeGen) return;
      /* no bank-stamp check here: pumpStep resyncs the stamp immediately
         before each build in the same synchronous task, so a painted count
         is always built from the current bank (merges can only land
         between macrotasks, never between build and paint) */
      try { if (A.getSess()) return; } catch (e2) {}
      if (typeof document === "undefined") return;
      if (!sel.kap || sel.kap !== item.kap) return;
      if (item.ck) {
        if (sel.cat === "__cumul__") refreshWorkspace();
        return;
      }
      var root = $("assessRoot") || document;
      var btn = null;
      try { btn = root.querySelector('[data-tc="cat:' + item.cat + '"]'); } catch (e3) { btn = null; }
      if (item.cat === "__boss__" && n < minFor(item.cat)) {
        /* became honestly empty: swap to the locked-why card (same markup
           the full render uses) and wire only the new node */
        if (btn) {
          var un0 = null;
          try { un0 = SP.bossUnlock(sel.kap, rmapNow(), histAll()); } catch (e4) {}
          var why = un0 ? un0.why : "";
          var tmp = document.createElement("div");
          tmp.innerHTML = '<button class="quick-btn tc-cat tc-locked' + (sel.cat === "__boss__" ? " tc-on" : "") + '" data-tc="cat:__boss__" title="' + esc(why) + '">🔒 ' + tcT("tc_boss", "اختبار الزعيم") + '<br><small>' + esc(why) + '</small></button>';
          var fresh = tmp.firstChild;
          btn.parentNode.replaceChild(fresh, btn);
          try { wire(root); } catch (e5) {}
        }
      } else if (btn) {
        var sm = null;
        try { sm = btn.querySelector("small"); } catch (e6) { sm = null; }
        if (n < minFor(item.cat)) { btn.style.display = "none"; }
        else {
          btn.style.display = "";
          if (sm) sm.textContent = countLabel(n, item.cat);
        }
        /* resolved either way: no longer a computing placeholder */
        try { if (sm) sm.removeAttribute("data-tcpend"); } catch (e8) {}
      }
      if (sel.cat === item.cat) refreshWorkspace();
      tcCheckEmpty();
    } catch (e7) {}
  }
  /* If every card resolved honestly-empty, show the empty-state hint that
     the full render would have shown (pending cards count as visible). */
  function tcCheckEmpty() {
    try {
      if (typeof document === "undefined" || !sel.kap) return;
      var root = $("assessRoot"); if (!root) return;
      var box = document.getElementById("tcCats"); if (!box) return;
      if (box.querySelector(".tc-empty")) return;
      var anyVisible = false, anyPending = false;
      var btns = box.querySelectorAll('[data-tc^="cat:"]');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].style.display === "none") continue;
        anyVisible = true;
        try {
          var sm = btns[i].querySelector("small");
          if (sm && sm.getAttribute("data-tcpend") === "1") anyPending = true;
        } catch (e) {}
      }
      if (!anyVisible && !anyPending) {
        var d = document.createElement("div");
        d.className = "muted tc-empty";
        d.textContent = tcT("tc_no_content", "لا يوجد محتوى كافٍ في ") + sel.kap + tcT("tc_no_content2", " بعد — أكمل الدروس أولًا.");
        box.appendChild(d);
      }
    } catch (e2) {}
  }
  function refreshWorkspace() {
    try {
      if (typeof document === "undefined") return;
      try { if (A.getSess()) return; } catch (e) {}
      var ws = document.getElementById("tcWorkspace"); if (!ws) return;
      var tmp = document.createElement("div");
      tmp.innerHTML = workspaceHtml();
      var fresh = tmp.firstChild;
      if (!fresh) return;
      ws.parentNode.replaceChild(fresh, ws);
      var root = $("assessRoot");
      try { wire(root || fresh.parentNode); } catch (e2) {}
    } catch (e3) {}
  }
  function kapLevel(kap) {
    try {
      var ws = U.vocabPool({ kap: kap });
      if (!ws.length) return "A1";
      var c = {};
      ws.forEach(function (w) { var l = w.level || "A1"; c[l] = (c[l] || 0) + 1; });
      var best = "A1", bn = -1;
      Object.keys(c).forEach(function (l) { if (c[l] > bn) { bn = c[l]; best = l; } });
      return best;
    } catch (e) { return "A1"; }
  }
  function kapsOfLevel(level) {
    return U.kapitelList().filter(function (k) { return kapLevel(k.id) === level; });
  }
  /* cumulative default range: first Kapitel of the level .. selected kap */
  function defaultCumulKaps(uptoKap) {
    try {
      var all = kapsOfLevel(sel.level).map(function (k) { return k.id; });
      if (!uptoKap || all.indexOf(uptoKap) < 0) return all.slice();
      return all.slice(0, all.indexOf(uptoKap) + 1);
    } catch (e) { return uptoKap ? [uptoKap] : []; }
  }
  function cumulKaps() {
    if (sel.cumul && sel.cumul.length) return sel.cumul.slice();
    return defaultCumulKaps(sel.kap);
  }
  function lastKapResult(kap) {
    try {
      var H = (A.ensureStore() || {}).history || [];
      for (var i = 0; i < H.length; i++) {
        var h = H[i];
        if (h.kapitel === kap) return h;
        if (h.kaps && h.kaps[kap] && h.kaps[kap].n >= 4) return { pct: h.kaps[kap].pct, specKap: true };
      }
    } catch (e) {}
    return null;
  }
  function kapTestCount(kap) {
    var n = 0;
    try {
      ((A.ensureStore() || {}).history || []).forEach(function (h) {
        if ((h.kaps && h.kaps[kap] && h.kaps[kap].n >= 4) || h.kapitel === kap) n++;
      });
    } catch (e) {}
    return n;
  }
  function rmapNow() {
    try { return C.center.kapitelReadinessMap(C.center.aggregateEvidence(5).kaps); }
    catch (e) { return {}; }
  }
  function histAll() { try { return (A.ensureStore() || {}).history || []; } catch (e) { return []; } }

  function catLabel(cid) {
    if (cid === "__full__") return { ar: tcT("tc_full", "الاختبار الشامل"), en: "Comprehensive quiz", ico: "⭐" };
    if (cid === "__smart__") return { ar: tcT("tc_smart", "اختبرني بذكاء"), en: "Quiz me smart", ico: "🧠" };
    if (cid === "__cumul__") return { ar: tcT("tc_cumul", "اختبار تراكمي"), en: "Cumulative quiz", ico: "📚" };
    if (cid === "__boss__") return { ar: tcT("tc_boss", "اختبار الزعيم"), en: "Boss test", ico: "👑" };
    return { ar: tcCatName(cid), ico: ((SP.CATS[cid] || {}).ico || "📝") };
  }
  function actualFor(avail) {
    var t = modeTarget();
    return Math.min(t, avail);
  }

  /* ---------------- section ---------------- */
  function renderSection(d) {
    var h = '<div class="panel glass tc-flow"><h3>' + tcT("tc_sec_h", "🧭 مركز الاختبارات — اختر خطوتك") + '</h3>';
    /* step 1: level */
    h += '<div class="tc-step" id="tcLevels"><b>' + tcT("tc_s1", "1. اختر المستوى") + '</b><div class="row-flex">';
    ["A1", "A2", "B1", "B2"].forEach(function (lv) {
      var g = U.levelUnlocked(lv);
      var on = sel.level === lv;
      h += '<button class="btn ' + (on ? "btn-primary" : "btn-ghost") + ' sm" data-tc="level:' + lv + '"' + (g.ok ? "" : ' title="' + tcT("tc_locked_tip", "المحتوى قيد التجهيز") + '"') + '>' + (g.ok ? "🇩🇪 " + lv : "🔒 " + lv) + '</button>';
    });
    h += '</div>';
    var lk = U.levelUnlocked(sel.level);
    if (!lk.ok) {
      h += '<div class="muted">' + tcT("tc_prep", "محتوى ") + esc(sel.level) + tcT("tc_prep_mid", " قيد التجهيز (") + (lk.words || 0) + tcT("tc_words", " كلمة). يمكنك التدرب على A1 أو تحميل المحتوى.") + '</div>';
      h += '<div class="row-flex">' + (typeof Curriculum !== "undefined" ? '<button class="btn btn-ghost sm" data-tc="loadlevel">' + tcT("tc_load", "⬇️ تحميل محتوى ") + esc(sel.level) + '</button>' : '') + '</div>';
    }
    h += '</div>';
    /* step 2: kapitel cards */
    var kaps = kapsOfLevel(sel.level);
    h += '<div class="tc-step" id="tcKaps"><b>' + tcT("tc_s2", "2. اختر Kapitel (") + kaps.length + tcT("tc_s2_close", ")") + '</b>';
    if (!kaps.length) h += '<div class="muted">' + tcT("tc_nokap", "لا توجد Kapitel لهذا المستوى بعد.") + '</div>';
    h += '<div class="asd-kaps">';
    /* dashboardData() already computed this render's readiness map; reuse it
       instead of re-scanning every bank a second time per render. */
    var rm = (d && d.rmap) || rmapNow();
    kaps.forEach(function (k) {
      var r = rm[k.id], last = lastKapResult(k.id), cnt = kapTestCount(k.id);
      var pct = r && r.conf !== "none" ? r.pct + "%" : "—";
      var chip = !r || r.conf === "none" ? tcT("tc_chip_new", "🔒 جديد") : r.pct >= C.CONFIG.KAP_MASTERED ? tcT("tc_chip_done", "🟢 متقن") : r.pct >= C.CONFIG.KAP_READY ? tcT("tc_chip_ready", "🟢 جاهز") : r.pct >= 40 ? tcT("tc_chip_rev", "🟡 مراجعة") : tcT("tc_chip_train", "🔴 تدريب");
      h += '<button class="quick-btn tc-kap' + (sel.kap === k.id ? " tc-on" : "") + '" data-tc="kap:' + esc(k.id) + '">' +
        esc(k.icon || "📖") + ' ' + esc(k.id) + '<br><small>' + esc(k.name) + '</small><br>' +
        '<small>' + pct + tcT("tc_mastery_w", " إتقان • ") + chip + '</small><br>' +
        '<small>' + (last ? (tcT("tc_last_r", "آخر نتيجة: ") + last.pct + '%') : tcT("tc_never", "لم يُختبر")) + (cnt ? ' • ' + cnt + tcT("tc_tests_n", " اختبارات") : '') + '</small></button>';
    });
    h += '</div></div>';
    /* step 3: categories (only with real content) — stable anchor #tcCats */
    if (sel.kap) {
      h += '<div class="tc-step" id="tcCats"><b>' + tcT("tc_s3", "3. ماذا تريد أن تختبر في ") + esc(sel.kap) + (tcLang()!=="ar"?"?":"؟") + '</b><div class="asd-kaps">';
      var shown = 0;
      SP.CAT_IDS.forEach(function (cid) {
        if (cid === "mistakes") return; /* mistakes card rendered separately below */
        var cat = SP.CATS[cid], n = probeAvail(sel.kap, cid, null);
        if (n !== PENDING && n < 5) return;
        shown++;
        var lbl = n === PENDING ? null : (n >= C.CONFIG.MASTER_CAP ? C.CONFIG.MASTER_CAP + "+" + tcT("tc_avail", " متاح") : n + tcT("tc_avail", " متاح"));
        h += '<button class="quick-btn tc-cat' + (sel.cat === cid ? " tc-on" : "") + '" data-tc="cat:' + cid + '">' + cat.ico + ' ' + esc(cat.ar) + '<br><small' + (n === PENDING ? ' data-tcpend="1">⏳' : '>' + lbl) + '</small></button>';
      });
      /* special cards */
      var specials = [
        { id: "__full__", min: 8 },
        { id: "__smart__", min: 6 },
        { id: "__cumul__", min: 8 },
        { id: "mistakes", min: 1 },
        { id: "__boss__", min: 8 }
      ];
      specials.forEach(function (sp) {
        var n = probeAvail(sel.kap, sp.id, null);
        if (n !== PENDING && n < sp.min) {
          if (sp.id === "__boss__") {
            var un0 = SP.bossUnlock(sel.kap, rm, histAll());
            shown++;
            h += '<button class="quick-btn tc-cat tc-locked' + (sel.cat === "__boss__" ? " tc-on" : "") + '" data-tc="cat:__boss__" title="' + esc(un0.why) + '">🔒 ' + tcT("tc_boss", "اختبار الزعيم") + '<br><small>' + esc(un0.why) + '</small></button>';
          } else if (sp.id === "mistakes") {
            /* hidden entirely when no open mistakes */
          }
          return;
        }
        shown++;
        var L = catLabel(sp.id);
        var lock = "";
        if (sp.id === "__boss__") {
          var un = SP.bossUnlock(sel.kap, rm, histAll());
          if (!un.ok) lock = ' title="' + esc(un.why) + '"';
          L.ico = un.ok ? "👑" : "🔒";
        }
        var sub = n === PENDING ? null : (n >= C.CONFIG.MASTER_CAP ? C.CONFIG.MASTER_CAP + "+" + tcT("tc_avail", " متاح") : n + tcT("tc_avail", " متاح"));
        if (sp.id === "mistakes") sub = openMistakes() + tcT("tc_mist_open", " مفتوحة");
        h += '<button class="quick-btn tc-cat' + (sel.cat === sp.id ? " tc-on" : "") + '" data-tc="cat:' + sp.id + '"' + lock + '>' + L.ico + ' ' + esc(L.ar) + '<br><small' + (n === PENDING ? ' data-tcpend="1">⏳' : '>' + sub) + '</small></button>';
      });
      if (!shown) h += '<div class="muted">' + tcT("tc_no_content", "لا يوجد محتوى كافٍ في ") + esc(sel.kap) + tcT("tc_no_content2", " بعد — أكمل الدروس أولًا.") + '</div>';
      h += '</div></div>';
    }
    /* step 4: dedicated config workspace — stable anchor #tcWorkspace */
    if (sel.kap && sel.cat) {
      h += workspaceHtml();
    }
    h += '</div>';
    /* daily + builder shortcuts */
    h += '<div class="panel glass"><h3>' + tcT("tc_ready_h", "⚡ اختبارات جاهزة") + '</h3><div class="row-flex">';
    h += '<button class="btn btn-gold sm" data-tc="daily">' + tcT("tc_daily", "🎯 تحدي اليوم") + (dailyDone() ? " ✅" : "") + '</button>';
    h += '<button class="btn btn-ghost sm" data-tc="builder">' + (sel.showBuilder ? tcT("tc_builder_show", "▲ إخفاء") : tcT("tc_builder_make", "🛠️ إنشاء اختبار خاص")) + '</button>';
    h += '</div>';
    if (sel.showBuilder) h += builderHtml();
    h += '</div>';
    /* records */
    h += recordsHtml();
    /* train-first links to existing sections (§42) */
    h += '<div class="panel glass"><h3>' + tcT("tc_train_first", "🎧 تدرب أولًا ثم اختبر") + '</h3><div class="muted">' + tcT("tc_train_sub", "أقسام التدريب الموجودة — الاختبار يقيس ما تعلمته هنا.") + '</div><div class="row-flex">' +
      '<button class="btn btn-ghost sm" data-tcgo="listen">' + tcT("tc_go_listen", "🎧 استماع") + '</button>' +
      '<button class="btn btn-ghost sm" data-tcgo="speak">' + tcT("tc_go_speak", "🎤 تحدث") + '</button>' +
      '<button class="btn btn-ghost sm" data-tcgo="talk">' + tcT("tc_go_talk", "🗣️ محادثة") + '</button>' +
      '<button class="btn btn-ghost sm" data-tcgo="real">' + tcT("tc_go_real", "🌍 مواقف") + '</button>' +
      '<button class="btn btn-ghost sm" data-tcgo="journey">' + tcT("tc_go_journey", "🗺️ الرحلة") + '</button></div></div>';
    return h;
  }
  /* Dedicated test workspace: compact header + back + counts + diff + method */
  function workspaceHtml() {
    var L = catLabel(sel.cat);
    var avail = probeAvail(sel.kap, sel.cat, null);
    var scopeTxt = sel.cat === "__cumul__"
      ? cumulKaps().join(" + ")
      : sel.kap;
    var h = '<div class="tc-step tc-workspace" id="tcWorkspace">';
    h += '<div class="tc-crumb"><b>' + esc(scopeTxt) + ' · ' + esc(L.ar) + '</b>' +
      '<button class="btn btn-ghost sm" data-tc="backcats">' + tcT("tc_back", "← العودة لاختيار الاختبار") + '</button></div>';
    /* cumulative range picker */
    if (sel.cat === "__cumul__") {
      var all = kapsOfLevel(sel.level);
      h += '<div class="tc-sub"><b>' + tcT("tc_cumul_scope", "النطاق التراكمي:") + '</b></div><div class="row-flex">' +
        all.map(function (k) {
          var on = cumulKaps().indexOf(k.id) >= 0;
          return '<button class="btn ' + (on ? "btn-primary" : "btn-ghost") + ' sm" data-tc="cumul:' + esc(k.id) + '">' + esc(k.id) + '</button>';
        }).join("") + '</div>';
      /* range-aware availability: exact queued build for the chosen range */
      avail = cumulAvail();
      h += '<div class="muted">' + tcT("tc_range", "النطاق: ") + esc(cumulKaps().join(" + ") || "—") + '</div>';
    }
    var pend = (avail === PENDING);
    /* counts */
    h += '<div class="tc-sub"><b>' + tcT("tc_counts", "عدد الأسئلة") + '</b> <span class="muted">(' + tcT("tc_avail_short", "المتاح: ") + (pend ? tcT("tc_pend", "⏳") : avail) + ')</span></div><div class="row-flex">';
    Object.keys(SP.MODES).forEach(function (mk) {
      var md = SP.MODES[mk];
      var isMaster = !md.n;
      var actual = pend ? 0 : (isMaster ? avail : Math.min(md.n, avail));
      var dis = pend ? false : ((!isMaster && avail < 5) || (isMaster && avail < 5));
      var lbl = pend ? (isMaster ? "Master" : String(md.n)) : (isMaster ? ("Master — " + avail + tcT("tc_avail", " متاح")) : (md.n + (avail < md.n ? " ← " + avail + tcT("tc_avail", " متاح") : "")));
      h += '<button class="btn ' + (sel.mode === mk ? "btn-primary" : "btn-ghost") + ' sm" data-tc="mode:' + mk + '"' +
        (dis ? ' disabled title="' + tcT("tc_no_short", "لا يوجد محتوى كافٍ") : ' title="' + esc(tcModeDesc(md)) + '"') + '>' + esc(lbl) + '</button>';
    });
    h += '</div>';
    if (pend) {
      h += '<div class="muted">⏳ جاري حساب الأسئلة المتاحة من المحتوى الحقيقي…</div>';
    } else {
      var willGetP = actualFor(avail);
      if (willGetP < modeTarget()) {
        h += '<div class="muted">⚠️ المحتوى المتاح (' + avail + ') أقل من العدد المطلوب — سيتم استخدام كل الأسئلة الصحيحة (' + willGetP + ').</div>';
      } else {
        h += '<div class="muted">سيتم إنشاء ' + willGetP + ' سؤالًا متنوعًا من المحتوى الحقيقي.</div>';
      }
    }
    /* difficulty */
    h += '<div class="tc-sub"><b>الصعوبة</b></div><div class="row-flex">';
    Object.keys(SP.DIFFS).forEach(function (dk) {
      h += '<button class="btn ' + (sel.diff === dk ? "btn-gold" : "btn-ghost") + ' sm" data-tc="diff:' + dk + '">' + esc(typeof askDiffEntry==="function"?askDiffEntry(SP.DIFFS[dk]):SP.DIFFS[dk].ar) + '</button>';
    });
    h += '</div>';
    /* method */
    h += '<div class="tc-sub"><b>طريقة الاختبار</b></div><div class="row-flex">';
    Object.keys(TMODES).forEach(function (tk) {
      h += '<button class="btn ' + (sel.tmode === tk ? "btn-primary" : "btn-ghost") + ' sm" data-tc="tmode:' + tk + '">' + esc(tcLang()!=="ar"?(TMODES[tk].en||TMODES[tk].ar):TMODES[tk].ar) + ' <small>(' + esc(TMODES[tk].de) + ')</small></button>';
    });
    h += '</div>';
    h += '<div class="row-flex"><button class="btn btn-primary tc-start" data-tc="start">' + tcT("tc_start", "ابدأ الاختبار") + (pend ? '' : ' (' + actualFor(avail) + tcT("tc_q", " سؤالًا") + ")") + ' 🚀</button></div>';
    h += '</div>';
    return h;
  }
  function dailyKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dailyDone() {
    try {
      var H = histAll(), dk = dailyKey();
      for (var i = 0; i < H.length; i++) {
        if (H[i].specId && H[i].specId.indexOf("daily-") === 0 && H[i].date === dk) return H[i];
      }
    } catch (e) {}
    return null;
  }
  /* ---------------- custom builder ---------------- */
  function builderHtml() {
    var h = '<div class="tc-builder"><h4>' + tcT("tc_builder_h", "🛠️ إنشاء اختبار خاص") + '</h4>';
    h += '<div class="tc-brow"><b>' + tcT("tc_level_row", "المستوى:") + '</b> ' + ["A1", "A2", "B1", "B2"].map(function (lv) {
      var g = U.levelUnlocked(lv);
      return '<label class="tc-check' + (g.ok ? "" : " tc-dis") + '"><input type="checkbox" data-blvl="' + lv + '"' + (sel.level === lv ? " checked" : "") + (g.ok ? "" : " disabled") + '> ' + lv + '</label>';
    }).join("") + '</div>';
    h += '<div class="tc-brow"><b>' + tcT("tc_kap_row", "Kapitel:") + '</b> <label class="tc-check"><input type="checkbox" data-bkap="*" checked> ' + tcT("tc_all", "الكل") + '</label> ' +
      U.kapitelList().map(function (k) {
        return '<label class="tc-check"><input type="checkbox" data-bkap="' + esc(k.id) + '"' + (sel.kap === k.id ? " checked" : "") + '> ' + esc(k.id) + '</label>';
      }).join("") + '</div>';
    h += '<div class="tc-brow"><b>' + tcT("tc_cats_row", "الفئات:") + '</b><br>' + SP.CAT_IDS.filter(function (c) { return c !== "mistakes"; }).map(function (cid) {
      var cat = SP.CATS[cid];
      return '<label class="tc-check"><input type="checkbox" data-bcat="' + cid + '"' + (sel.cat === cid ? " checked" : "") + '> ' + cat.ico + ' ' + esc(tcCatName(cid)) + '</label>';
    }).join("") + ' <label class="tc-check"><input type="checkbox" data-bcat="mistakes"> ❌ ' + tcT("as_sk_mistakes", "أخطائي") + '</label></div>';
    h += '<div class="tc-brow"><b>' + tcT("tc_diff_row", "الصعوبة:") + '</b> ' + Object.keys(SP.DIFFS).map(function (dk) {
      return '<label class="tc-check"><input type="radio" name="tcbdiff" value="' + dk + '"' + (sel.diff === dk ? " checked" : "") + '> ' + esc(typeof askDiffEntry==="function"?askDiffEntry(SP.DIFFS[dk]):SP.DIFFS[dk].ar) + '</label>';
    }).join("") + '</div>';
    h += '<div class="tc-brow"><b>' + tcT("tc_counts_row", "عدد الأسئلة:") + '</b> ' + [20, 40, 60, 80].map(function (n) {
      return '<label class="tc-check"><input type="radio" name="tcbcount" value="' + n + '"' + (n === 40 ? " checked" : "") + '> ' + n + '</label>';
    }).join("") + ' <label class="tc-check"><input type="radio" name="tcbcount" value="max"> ' + tcT("tc_master_max", "Master (الأقصى)") + '</label></div>';
    h += '<div class="tc-brow"><b>' + tcT("tc_mode_row", "الوضع:") + '</b> ' +
      '<label class="tc-check"><input type="radio" name="tcbmode" value="training" checked> ' + tcT("as_q_mode_train", "🟢 تدريب") + '</label>' +
      '<label class="tc-check"><input type="radio" name="tcbmode" value="test"> ' + tcT("as_q_mode_test", "🔵 اختبار") + '</label>' +
      '<label class="tc-check"><input type="radio" name="tcbmode" value="challenge"> ' + tcT("as_q_mode_chal", "🟡 تحدي ⏱️") + '</label>' +
      '<label class="tc-check"><input type="radio" name="tcbmode" value="exam"> ' + tcT("as_q_mode_exam", "🔴 امتحان") + '</label></div>';
    h += '<div class="row-flex"><button class="btn btn-primary sm" data-tc="buildstart">' + tcT("tc_buildstart", "ابدأ الاختبار المخصص 🚀") + '</button></div></div>';
    return h;
  }
  function builderOpts(root) {
    function vals(selAttr) {
      var out = [];
      root.querySelectorAll("[" + selAttr + "]:checked").forEach(function (x) { out.push(x.getAttribute(selAttr)); });
      return out;
    }
    function radio(name, fb) {
      var x = root.querySelector('input[name="' + name + '"]:checked');
      return x ? x.value : fb;
    }
    var kaps = vals("data-bkap");
    if (kaps.indexOf("*") >= 0) kaps = [];
    var count = radio("tcbcount", "40");
    return {
      levels: vals("data-blvl"), kaps: kaps,
      cats: vals("data-bcat"), diff: radio("tcbdiff", "medium"),
      count: count === "max" ? 100 : parseInt(count, 10) || 40,
      mode: radio("tcbmode", "test")
    };
  }
  /* ---------------- records ---------------- */
  function dayStreak() {
    try {
      var days = (A.ensureStore() || {}).days || {}, n = 0;
      var d = new Date();
      function key(dt) { return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); }
      if (!days[key(d)]) { d = new Date(d.getTime() - 86400000); if (!days[key(d)]) return 0; }
      while (days[key(d)]) { n++; d = new Date(d.getTime() - 86400000); }
      return n;
    } catch (e) { return 0; }
  }
  function recordsHtml() {
    var H = histAll(), st = null;
    try { st = A.ensureStore(); } catch (e) {}
    var best = 0;
    H.forEach(function (h) { if (h.pct > best) best = h.pct; });
    var byKap = {};
    H.forEach(function (h) {
      Object.keys(h.kaps || {}).forEach(function (k) {
        if (k === "?") return;
        if (!byKap[k]) byKap[k] = 0;
        byKap[k] += h.kaps[k].n || 0;
      });
    });
    var topKap = null, topN = 0;
    Object.keys(byKap).forEach(function (k) { if (byKap[k] > topN) { topN = byKap[k]; topKap = k; } });
    /* most improved skill: last pct - first pct with real evidence */
    var first = {}, last = {};
    H.slice().reverse().forEach(function (h) {
      Object.keys(h.skills || {}).forEach(function (s) {
        if (h.skills[s].n >= 2 && first[s] == null) first[s] = h.skills[s].pct;
      });
    });
    H.forEach(function (h) {
      Object.keys(h.skills || {}).forEach(function (s) {
        if (h.skills[s].n >= 2) last[s] = h.skills[s].pct;
      });
    });
    var imp = null, impD = 0;
    Object.keys(last).forEach(function (s) {
      if (first[s] != null) {
        var dlt = last[s] - first[s];
        if (dlt > impD) { impD = dlt; imp = s; }
      }
    });
    function card(ico, label, val, sub) {
      return '<div class="asd-stat"><div class="asd-ico">' + ico + '</div><b>' + esc(val) + '</b><span class="muted">' + esc(label) + '</span><small class="muted">' + esc(sub || "") + '</small></div>';
    }
    var skName = function (s) { try { if (typeof askSkillEntry === "function") { var v = askSkillEntry(C.SKILLS[s] || {}); if (v) return v; } } catch (e) {} try { return ((C.SKILLS[s] || {}).ar) || s; } catch (e2) { return s; } };
    return '<div class="panel glass"><h3>' + tcT("tc_rec_h", "🏅 سجلاتك الشخصية") + '</h3><div class="asd-grid">' +
      card("⭐", tcT("tc_rec_best", "أفضل نتيجة"), H.length ? best + "%" : "—", H.length ? tcT("tc_rec_best_n", "من ") + H.length + tcT("tc_rec_best_n2", " اختبارات") : tcT("tc_rec_none", "لا اختبارات بعد")) +
      card("🔥", tcT("tc_rec_combo", "أطول سلسلة صحيحة"), (st && st.bestCombo) || 0, tcT("tc_rec_combo_x", "كومبو x")) +
      card("📖", tcT("tc_rec_topkap", "أكثر Kapitel تم اختباره"), topKap || "—", topKap ? Math.round(topN) + tcT("tc_rec_topkap_n", " إجابات") : "—") +
      card("📈", tcT("tc_rec_topskill", "أكثر مهارة تحسنت"), imp ? skName(imp) : "—", imp ? "+" + impD + "%" : tcT("tc_rec_topskill_n", "تحتاج اختبارين+")) +
      card("📝", tcT("tc_rec_count", "عدد الاختبارات"), H.length, tcT("tc_rec_count_saved", "محفوظة")) +
      card("📅", tcT("tc_rec_streak", "ستريك الأيام"), dayStreak() + tcT("tc_rec_streak_d", " يوم"), tcT("tc_rec_streak_days", "أيام فيها اختبارات")) +
      '</div></div>';
  }
  /* ---------------- actions ---------------- */
  function startPickerTest() {
    if (!sel.kap || !sel.cat) { toast("اختر Kapitel والفئة أولًا", "err"); return false; }
    if (!canStart()) return false;
    var target = modeTarget(), lv = lvlOrNull();
    if (sel.cat === "__full__") return A.startFlow(applyTMode(SP.kapitelExamSpec(sel.kap, lv, target)));
    if (sel.cat === "__smart__") return A.startFlow(applyTMode(startSmartSpec(target)));
    if (sel.cat === "__cumul__") return A.startFlow(applyTMode(SP.cumulSpec(cumulKaps(), target, { level: lv })));
    if (sel.cat === "__boss__") {
      var un = SP.bossUnlock(sel.kap, rmapNow(), histAll());
      if (!un.ok) { unStart(); toast("🔒 " + un.why, "err"); return false; }
      return A.startFlow(applyTMode(SP.bossSpec(sel.kap, target)));
    }
    return A.startFlow(applyTMode(SP.kapitelCategorySpec(sel.kap, sel.cat, sel.mode, sel.diff, lv)));
  }
  function startSmartSpec(total) {
    var weak = [];
    try {
      var agg = C.center.aggregateEvidence(5).skills;
      weak = C.SKILL_KEYS.filter(function (s) { return agg[s] && agg[s].ev === "ok" && agg[s].pct < C.CONFIG.GOOD_SKILL; });
    } catch (e) {}
    return SP.smartSpec({ weakSkills: weak, kap: sel.kap, total: total || 40 });
  }
  function startDaily() {
    if (!canStart()) return false;
    var dk = dailyKey(), done = dailyDone();
    if (done) { toast("أنجزت تحدي اليوم بنتيجة " + done.pct + "% 🎉 — يمكنك إعادته للتدريب"); }
    return A.startFlow(SP.dailySpec(dk));
  }
  function startSmart() {
    if (!canStart()) return false;
    return A.startFlow(applyTMode(startSmartSpec(40)));
  }
  function startMistakes() {
    if (!canStart()) return false;
    var mp = U.mistakePlan(12);
    if (!mp.plan.length || !openMistakes()) { unStart(); toast("لا أخطاء مفتوحة — أحسنت! 🎉", "ok"); return false; }
    return A.startFlow(applyTMode(SP.mistakeSpec(sel.kap)));
  }
  function wire(root) {
    if (!root) return;
    root.querySelectorAll('[data-tc]').forEach(function (b) {
      if (b._tcw) return; b._tcw = true;
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-tc");
        if (k.indexOf("level:") === 0) { sel.level = k.slice(6); sel.kap = null; sel.cat = null; sel.cumul = null; probeCache = {}; rerender(false); }
        else if (k.indexOf("kap:") === 0) { sel.kap = k.slice(4); sel.cat = null; sel.cumul = null; rerender(false); focusTc("tcCats"); }
        else if (k.indexOf("cat:") === 0) { sel.cat = k.slice(4); rerender(false); focusTc("tcWorkspace"); }
        else if (k === "backcats") { sel.cat = null; rerender(false); focusTc("tcCats"); }
        else if (k.indexOf("cumul:") === 0) {
          var id = k.slice(6), cur = cumulKaps(), ix = cur.indexOf(id);
          if (ix >= 0) cur.splice(ix, 1); else cur.push(id);
          sel.cumul = cur;
          rerender(false); focusTc("tcWorkspace");
        }
        else if (k.indexOf("mode:") === 0) { sel.mode = k.slice(5); rerender(false); focusTc("tcWorkspace"); }
        else if (k.indexOf("diff:") === 0) { sel.diff = k.slice(5); probeCache = {}; rerender(false); focusTc("tcWorkspace"); }
        else if (k.indexOf("tmode:") === 0) { sel.tmode = k.slice(6); rerender(false); focusTc("tcWorkspace"); }
        else if (k === "start") startPickerTest();
        else if (k === "daily") startDaily();
        else if (k === "smart") startSmart();
        else if (k === "mistakes") startMistakes();
        else if (k === "builder") { sel.showBuilder = !sel.showBuilder; rerender(false); }
        else if (k === "buildstart") {
          if (!canStart()) return;
          var o = builderOpts(root);
          var cats = o.cats.length ? o.cats : ["words", "grammar", "sentences"];
          if (cats.indexOf("mistakes") >= 0 && !openMistakes()) { toast("لا أخطاء مفتوحة — أزلت فئة الأخطاء", "err"); cats = cats.filter(function (c) { return c !== "mistakes"; }); }
          if (!cats.length) { unStart(); toast("اختر فئة واحدة على الأقل", "err"); return; }
          o.cats = cats;
          A.startFlow(SP.customSpec(o));
        }
        else if (k === "loadlevel") {
          try {
            if (typeof Curriculum !== "undefined" && Curriculum.ensure) {
              toast("⏳ جاري تحميل محتوى " + sel.level + " ...");
              Curriculum.ensure(sel.level, function () { try { if (!document.querySelector("#page-quiz.active")) return; } catch (e) {} probeCache = {}; rerender(false); });
            }
          } catch (e) {}
        }
      });
    });
    root.querySelectorAll('[data-tcgo]').forEach(function (b) {
      if (b._tcg) return; b._tcg = true;
      b.addEventListener("click", function () { goPage(b.getAttribute("data-tcgo")); });
    });
    kickProbes();
  }
  function goPage(p) { try { if (typeof showPage === "function") showPage(p); } catch (e) {} }
  /* Same-page re-render: never leaves the quiz page (avoids showPage's
     scroll-to-top), so the viewport stays where the user is; callers then
     focus the exact anchor that changed. */
  function rerender() {
    try {
      if (A.getSess()) return;
      /* every selector change cancels queued background probes: only the
         fresh selection's probes may build or paint (no overlapping work) */
      probeGen++;
      C.center.renderCenter();
      goQuizIfNeeded();
      kickProbes();
    } catch (e) {}
  }
  /* ---------------- styling (namespaced tc-*) ---------------- */
  var TC_CSS = ".tc-step{margin:10px 0;display:flex;flex-direction:column;gap:8px}"
    + ".tc-kap.tc-on,.tc-cat.tc-on{outline:2px solid var(--gold,#f5b301);outline-offset:1px}"
    + ".tc-cat.tc-locked{opacity:.75}"
    + ".tc-builder{background:rgba(255,255,255,.03);border:1px dashed var(--border,#555);border-radius:12px;padding:10px;margin-top:8px;display:flex;flex-direction:column;gap:8px}"
    + ".tc-brow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}"
    + ".tc-check{display:inline-flex;gap:4px;align-items:center;background:rgba(255,255,255,.05);border:1px solid var(--border,#444);border-radius:10px;padding:4px 8px;font-size:13px;cursor:pointer}"
    + ".tc-check input{width:18px;height:18px}"
    + ".tc-check.tc-dis{opacity:.5}"
    + ".tc-flow h3{margin-bottom:4px}"
    /* workspace + anchors: predictable location, header-safe scrolling */
    + ".tc-workspace{border:1px solid var(--gold,#f5b301);border-radius:14px;padding:12px;background:rgba(245,179,1,.05)}"
    + ".tc-crumb{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;background:rgba(255,255,255,.05);border-radius:10px;padding:8px 10px}"
    + ".tc-sub{margin-top:4px}"
    + ".tc-start{min-height:48px;font-size:16px}"
    + "#tcCats,#tcWorkspace,#tcKaps,#tcLevels{scroll-margin-top:calc(var(--dm-header-h,68px) + 14px + env(safe-area-inset-top,0px))}"
    + ".tc-workspace{scroll-margin-bottom:calc(84px + env(safe-area-inset-bottom,0px))}"
    + ".tc-workspace .row-flex:last-child{padding-bottom:calc(4px + env(safe-area-inset-bottom,0px))}";
  function injectCss() {
    try { if (document.getElementById("tcCss")) return; var st = document.createElement("style"); st.id = "tcCss"; st.textContent = TC_CSS; document.head.appendChild(st); } catch (e) {}
  }
  try {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectCss);
      else injectCss();
    }
  } catch (e) {}
  return { renderSection: renderSection, wire: wire, sel: sel, probeCount: probeCount, probeAvail: probeAvail, probePending: function () { return probeQueue.length + (probePumping ? 1 : 0); }, kapLevel: kapLevel, dailyKey: dailyKey, dailyDone: dailyDone, clearCache: function () { probeCache = {}; probeGen++; } };
})();
