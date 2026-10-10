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
  var probeCache = {};

  /* Test-method (طريقة الاختبار) options: affect session behavior only,
     never the question pool. Applied onto the spec before startFlow. */
  var TMODES = {
    training:  { ar: "تدريب 🟢",  de: "mit Erklärung" },
    test:      { ar: "اختبار 🔵", de: "Prüfung" },
    challenge: { ar: "تحدي 🟡 ⏱️", de: "Zeit-Challenge" }
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
     counts valid questions. Cached per level|kap|cat. Never faked. */
  function probeCount(kap, catId, level) {
    var key = (level || "*") + "|" + (kap || "*") + "|" + catId + "|" + sel.diff;
    if (probeCache[key] != null) return probeCache[key];
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
    if (cid === "__full__") return { ar: "الاختبار الشامل", ico: "⭐" };
    if (cid === "__smart__") return { ar: "اختبرني بذكاء", ico: "🧠" };
    if (cid === "__cumul__") return { ar: "اختبار تراكمي", ico: "📚" };
    if (cid === "__boss__") return { ar: "اختبار الزعيم", ico: "👑" };
    var c = SP.CATS[cid] || {};
    return { ar: c.ar || cid, ico: c.ico || "📝" };
  }
  function actualFor(avail) {
    var t = modeTarget();
    return Math.min(t, avail);
  }

  /* ---------------- section ---------------- */
  function renderSection(d) {
    var h = '<div class="panel glass tc-flow"><h3>🧭 مركز الاختبارات — اختر خطوتك</h3>';
    /* step 1: level */
    h += '<div class="tc-step" id="tcLevels"><b>1. اختر المستوى</b><div class="row-flex">';
    ["A1", "A2", "B1"].forEach(function (lv) {
      var g = U.levelUnlocked(lv);
      var on = sel.level === lv;
      h += '<button class="btn ' + (on ? "btn-primary" : "btn-ghost") + ' sm" data-tc="level:' + lv + '"' + (g.ok ? "" : ' title="المحتوى قيد التجهيز"') + '>' + (g.ok ? "🇩🇪 " + lv : "🔒 " + lv) + '</button>';
    });
    h += '</div>';
    var lk = U.levelUnlocked(sel.level);
    if (!lk.ok) {
      h += '<div class="muted">محتوى ' + esc(sel.level) + ' قيد التجهيز (' + (lk.words || 0) + ' كلمة). يمكنك التدرب على A1 أو تحميل المحتوى.</div>';
      h += '<div class="row-flex">' + (typeof Curriculum !== "undefined" ? '<button class="btn btn-ghost sm" data-tc="loadlevel">⬇️ تحميل محتوى ' + esc(sel.level) + '</button>' : '') + '</div>';
    }
    h += '</div>';
    /* step 2: kapitel cards */
    var kaps = kapsOfLevel(sel.level);
    h += '<div class="tc-step" id="tcKaps"><b>2. اختر Kapitel (' + kaps.length + ')</b>';
    if (!kaps.length) h += '<div class="muted">لا توجد Kapitel لهذا المستوى بعد.</div>';
    h += '<div class="asd-kaps">';
    var rm = rmapNow();
    kaps.forEach(function (k) {
      var r = rm[k.id], last = lastKapResult(k.id), cnt = kapTestCount(k.id);
      var pct = r && r.conf !== "none" ? r.pct + "%" : "—";
      var chip = !r || r.conf === "none" ? "🔒 جديد" : r.pct >= C.CONFIG.KAP_MASTERED ? "🟢 متقن" : r.pct >= C.CONFIG.KAP_READY ? "🟢 جاهز" : r.pct >= 40 ? "🟡 مراجعة" : "🔴 تدريب";
      h += '<button class="quick-btn tc-kap' + (sel.kap === k.id ? " tc-on" : "") + '" data-tc="kap:' + esc(k.id) + '">' +
        esc(k.icon || "📖") + ' ' + esc(k.id) + '<br><small>' + esc(k.name) + '</small><br>' +
        '<small>' + pct + ' إتقان • ' + chip + '</small><br>' +
        '<small>' + (last ? ('آخر نتيجة: ' + last.pct + '%') : 'لم يُختبر') + (cnt ? ' • ' + cnt + ' اختبارات' : '') + '</small></button>';
    });
    h += '</div></div>';
    /* step 3: categories (only with real content) — stable anchor #tcCats */
    if (sel.kap) {
      h += '<div class="tc-step" id="tcCats"><b>3. ماذا تريد أن تختبر في ' + esc(sel.kap) + '؟</b><div class="asd-kaps">';
      var shown = 0;
      SP.CAT_IDS.forEach(function (cid) {
        if (cid === "mistakes") return; /* mistakes card rendered separately below */
        var cat = SP.CATS[cid], n = probeCount(sel.kap, cid, null);
        if (n < 5) return;
        shown++;
        var lbl = n >= C.CONFIG.MASTER_CAP ? C.CONFIG.MASTER_CAP + "+ متاح" : n + " متاح";
        h += '<button class="quick-btn tc-cat' + (sel.cat === cid ? " tc-on" : "") + '" data-tc="cat:' + cid + '">' + cat.ico + ' ' + esc(cat.ar) + '<br><small>' + lbl + '</small></button>';
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
        var n = probeCount(sel.kap, sp.id, null);
        if (n < sp.min) {
          if (sp.id === "__boss__") {
            var un0 = SP.bossUnlock(sel.kap, rm, histAll());
            shown++;
            h += '<button class="quick-btn tc-cat tc-locked' + (sel.cat === "__boss__" ? " tc-on" : "") + '" data-tc="cat:__boss__" title="' + esc(un0.why) + '">🔒 اختبار الزعيم<br><small>' + esc(un0.why) + '</small></button>';
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
        var sub = n >= C.CONFIG.MASTER_CAP ? C.CONFIG.MASTER_CAP + "+ متاح" : n + " متاح";
        if (sp.id === "mistakes") sub = openMistakes() + " مفتوحة";
        h += '<button class="quick-btn tc-cat' + (sel.cat === sp.id ? " tc-on" : "") + '" data-tc="cat:' + sp.id + '"' + lock + '>' + L.ico + ' ' + esc(L.ar) + '<br><small>' + sub + '</small></button>';
      });
      if (!shown) h += '<div class="muted">لا يوجد محتوى كافٍ في ' + esc(sel.kap) + ' بعد — أكمل الدروس أولًا.</div>';
      h += '</div></div>';
    }
    /* step 4: dedicated config workspace — stable anchor #tcWorkspace */
    if (sel.kap && sel.cat) {
      h += workspaceHtml();
    }
    h += '</div>';
    /* daily + builder shortcuts */
    h += '<div class="panel glass"><h3>⚡ اختبارات جاهزة</h3><div class="row-flex">';
    h += '<button class="btn btn-gold sm" data-tc="daily">🎯 تحدي اليوم' + (dailyDone() ? " ✅" : "") + '</button>';
    h += '<button class="btn btn-ghost sm" data-tc="builder">' + (sel.showBuilder ? "▲ إخفاء" : "🛠️ إنشاء اختبار خاص") + '</button>';
    h += '</div>';
    if (sel.showBuilder) h += builderHtml();
    h += '</div>';
    /* records */
    h += recordsHtml();
    /* train-first links to existing sections (§42) */
    h += '<div class="panel glass"><h3>🎧 تدرب أولًا ثم اختبر</h3><div class="muted">أقسام التدريب الموجودة — الاختبار يقيس ما تعلمته هنا.</div><div class="row-flex">' +
      '<button class="btn btn-ghost sm" data-tcgo="listen">🎧 استماع</button>' +
      '<button class="btn btn-ghost sm" data-tcgo="speak">🎤 تحدث</button>' +
      '<button class="btn btn-ghost sm" data-tcgo="talk">🗣️ محادثة</button>' +
      '<button class="btn btn-ghost sm" data-tcgo="real">🌍 مواقف</button>' +
      '<button class="btn btn-ghost sm" data-tcgo="journey">🗺️ الرحلة</button></div></div>';
    return h;
  }
  /* Dedicated test workspace: compact header + back + counts + diff + method */
  function workspaceHtml() {
    var L = catLabel(sel.cat);
    var avail = probeCount(sel.kap, sel.cat, null);
    var scopeTxt = sel.cat === "__cumul__"
      ? cumulKaps().join(" + ")
      : sel.kap;
    var h = '<div class="tc-step tc-workspace" id="tcWorkspace">';
    h += '<div class="tc-crumb"><b>' + esc(scopeTxt) + ' · ' + esc(L.ar) + '</b>' +
      '<button class="btn btn-ghost sm" data-tc="backcats">← العودة لاختيار الاختبار</button></div>';
    /* cumulative range picker */
    if (sel.cat === "__cumul__") {
      var all = kapsOfLevel(sel.level);
      h += '<div class="tc-sub"><b>النطاق التراكمي:</b></div><div class="row-flex">' +
        all.map(function (k) {
          var on = cumulKaps().indexOf(k.id) >= 0;
          return '<button class="btn ' + (on ? "btn-primary" : "btn-ghost") + ' sm" data-tc="cumul:' + esc(k.id) + '">' + esc(k.id) + '</button>';
        }).join("") + '</div>';
      avail = probeCount(sel.kap, sel.cat, null);
      /* range-aware availability: rebuild probe for the chosen range */
      try {
        var ck = "*|" + cumulKaps().join("+") + "|__cumul__";
        if (probeCache[ck] != null) avail = probeCache[ck];
        else {
          avail = SP.cumulSpec(cumulKaps(), C.CONFIG.MASTER_CAP, { level: lvlOrNull() }).build().length;
          probeCache[ck] = avail;
        }
      } catch (e) {}
      h += '<div class="muted">النطاق: ' + esc(cumulKaps().join(" + ") || "—") + '</div>';
    }
    /* counts */
    h += '<div class="tc-sub"><b>عدد الأسئلة</b> <span class="muted">(المتاح: ' + avail + ')</span></div><div class="row-flex">';
    Object.keys(SP.MODES).forEach(function (mk) {
      var md = SP.MODES[mk];
      var isMaster = !md.n;
      var actual = isMaster ? avail : Math.min(md.n, avail);
      var dis = (!isMaster && avail < 5) || (isMaster && avail < 5);
      var lbl = isMaster ? ("Master — " + avail + " متاح") : (md.n + (avail < md.n ? " ← " + avail + " متاح" : ""));
      h += '<button class="btn ' + (sel.mode === mk ? "btn-primary" : "btn-ghost") + ' sm" data-tc="mode:' + mk + '"' +
        (dis ? ' disabled title="لا يوجد محتوى كافٍ"' : ' title="' + esc(md.de) + '"') + '>' + esc(lbl) + '</button>';
    });
    h += '</div>';
    var willGet = actualFor(avail);
    if (willGet < modeTarget()) {
      h += '<div class="muted">⚠️ المحتوى المتاح (' + avail + ') أقل من العدد المطلوب — سيتم استخدام كل الأسئلة الصحيحة (' + willGet + ').</div>';
    } else {
      h += '<div class="muted">سيتم إنشاء ' + willGet + ' سؤالًا متنوعًا من المحتوى الحقيقي.</div>';
    }
    /* difficulty */
    h += '<div class="tc-sub"><b>الصعوبة</b></div><div class="row-flex">';
    Object.keys(SP.DIFFS).forEach(function (dk) {
      h += '<button class="btn ' + (sel.diff === dk ? "btn-gold" : "btn-ghost") + ' sm" data-tc="diff:' + dk + '">' + esc(SP.DIFFS[dk].ar) + '</button>';
    });
    h += '</div>';
    /* method */
    h += '<div class="tc-sub"><b>طريقة الاختبار</b></div><div class="row-flex">';
    Object.keys(TMODES).forEach(function (tk) {
      h += '<button class="btn ' + (sel.tmode === tk ? "btn-primary" : "btn-ghost") + ' sm" data-tc="tmode:' + tk + '">' + esc(TMODES[tk].ar) + ' <small>(' + esc(TMODES[tk].de) + ')</small></button>';
    });
    h += '</div>';
    h += '<div class="row-flex"><button class="btn btn-primary tc-start" data-tc="start">ابدأ الاختبار (' + willGet + ' سؤالًا) 🚀</button></div>';
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
    var h = '<div class="tc-builder"><h4>🛠️ إنشاء اختبار خاص</h4>';
    h += '<div class="tc-brow"><b>المستوى:</b> ' + ["A1", "A2", "B1"].map(function (lv) {
      var g = U.levelUnlocked(lv);
      return '<label class="tc-check' + (g.ok ? "" : " tc-dis") + '"><input type="checkbox" data-blvl="' + lv + '"' + (sel.level === lv ? " checked" : "") + (g.ok ? "" : " disabled") + '> ' + lv + '</label>';
    }).join("") + '</div>';
    h += '<div class="tc-brow"><b>Kapitel:</b> <label class="tc-check"><input type="checkbox" data-bkap="*" checked> الكل</label> ' +
      U.kapitelList().map(function (k) {
        return '<label class="tc-check"><input type="checkbox" data-bkap="' + esc(k.id) + '"' + (sel.kap === k.id ? " checked" : "") + '> ' + esc(k.id) + '</label>';
      }).join("") + '</div>';
    h += '<div class="tc-brow"><b>الفئات:</b><br>' + SP.CAT_IDS.filter(function (c) { return c !== "mistakes"; }).map(function (cid) {
      var cat = SP.CATS[cid];
      return '<label class="tc-check"><input type="checkbox" data-bcat="' + cid + '"' + (sel.cat === cid ? " checked" : "") + '> ' + cat.ico + ' ' + esc(cat.ar) + '</label>';
    }).join("") + ' <label class="tc-check"><input type="checkbox" data-bcat="mistakes"> ❌ أخطائي</label></div>';
    h += '<div class="tc-brow"><b>الصعوبة:</b> ' + Object.keys(SP.DIFFS).map(function (dk) {
      return '<label class="tc-check"><input type="radio" name="tcbdiff" value="' + dk + '"' + (sel.diff === dk ? " checked" : "") + '> ' + esc(SP.DIFFS[dk].ar) + '</label>';
    }).join("") + '</div>';
    h += '<div class="tc-brow"><b>عدد الأسئلة:</b> ' + [20, 40, 60, 80].map(function (n) {
      return '<label class="tc-check"><input type="radio" name="tcbcount" value="' + n + '"' + (n === 40 ? " checked" : "") + '> ' + n + '</label>';
    }).join("") + ' <label class="tc-check"><input type="radio" name="tcbcount" value="max"> Master (الأقصى)</label></div>';
    h += '<div class="tc-brow"><b>الوضع:</b> ' +
      '<label class="tc-check"><input type="radio" name="tcbmode" value="training" checked> 🟢 تدريب</label>' +
      '<label class="tc-check"><input type="radio" name="tcbmode" value="test"> 🔵 اختبار</label>' +
      '<label class="tc-check"><input type="radio" name="tcbmode" value="challenge"> 🟡 تحدي ⏱️</label>' +
      '<label class="tc-check"><input type="radio" name="tcbmode" value="exam"> 🔴 امتحان</label></div>';
    h += '<div class="row-flex"><button class="btn btn-primary sm" data-tc="buildstart">ابدأ الاختبار المخصص 🚀</button></div></div>';
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
    var skName = function (s) { return ((C.SKILLS[s] || {}).ar) || s; };
    return '<div class="panel glass"><h3>🏅 سجلاتك الشخصية</h3><div class="asd-grid">' +
      card("⭐", "أفضل نتيجة", H.length ? best + "%" : "—", H.length ? "من " + H.length + " اختبارات" : "لا اختبارات بعد") +
      card("🔥", "أطول سلسلة صحيحة", (st && st.bestCombo) || 0, "كومبو x") +
      card("📖", "أكثر Kapitel تم اختباره", topKap || "—", topKap ? Math.round(topN) + " إجابات" : "—") +
      card("📈", "أكثر مهارة تحسنت", imp ? skName(imp) : "—", imp ? "+" + impD + "%" : "تحتاج اختبارين+") +
      card("📝", "عدد الاختبارات", H.length, "محفوظة") +
      card("📅", "ستريك الأيام", dayStreak() + " يوم", "أيام فيها اختبارات") +
      '</div></div>';
  }
  /* ---------------- actions ---------------- */
  function startPickerTest() {
    if (!sel.kap || !sel.cat) { toast("اختر Kapitel والفئة أولًا", "err"); return false; }
    var target = modeTarget(), lv = lvlOrNull();
    if (sel.cat === "__full__") return A.startFlow(applyTMode(SP.kapitelExamSpec(sel.kap, lv, target)));
    if (sel.cat === "__smart__") return A.startFlow(applyTMode(startSmartSpec(target)));
    if (sel.cat === "__cumul__") return A.startFlow(applyTMode(SP.cumulSpec(cumulKaps(), target, { level: lv })));
    if (sel.cat === "__boss__") {
      var un = SP.bossUnlock(sel.kap, rmapNow(), histAll());
      if (!un.ok) { toast("🔒 " + un.why, "err"); return false; }
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
    var dk = dailyKey(), done = dailyDone();
    if (done) { toast("أنجزت تحدي اليوم بنتيجة " + done.pct + "% 🎉 — يمكنك إعادته للتدريب"); }
    return A.startFlow(SP.dailySpec(dk));
  }
  function startSmart() {
    return A.startFlow(applyTMode(startSmartSpec(40)));
  }
  function startMistakes() {
    var mp = U.mistakePlan(12);
    if (!mp.plan.length || !openMistakes()) { toast("لا أخطاء مفتوحة — أحسنت! 🎉", "ok"); return false; }
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
          var o = builderOpts(root);
          var cats = o.cats.length ? o.cats : ["words", "grammar", "sentences"];
          if (cats.indexOf("mistakes") >= 0 && !openMistakes()) { toast("لا أخطاء مفتوحة — أزلت فئة الأخطاء", "err"); cats = cats.filter(function (c) { return c !== "mistakes"; }); }
          if (!cats.length) { toast("اختر فئة واحدة على الأقل", "err"); return; }
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
  }
  function goPage(p) { try { if (typeof showPage === "function") showPage(p); } catch (e) {} }
  /* Same-page re-render: never leaves the quiz page (avoids showPage's
     scroll-to-top), so the viewport stays where the user is; callers then
     focus the exact anchor that changed. */
  function rerender() {
    try {
      if (A.getSess()) return;
      C.center.renderCenter();
      goQuizIfNeeded();
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
  return { renderSection: renderSection, wire: wire, sel: sel, probeCount: probeCount, kapLevel: kapLevel, dailyKey: dailyKey, dailyDone: dailyDone, clearCache: function () { probeCache = {}; } };
})();
