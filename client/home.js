/* Deutsch Master — Premium Home engine (additive only).
   Renders the landing/dashboard dynamic blocks from REAL stored state:
   Sierra/global S, allWords/getStatus, dueWords, DMProgress, Curriculum,
   journeyStages. Reuses showPage navigation and t() localization.
   Never fabricates numbers: empty state shows onboarding copy instead. */
(function () {
  "use strict";
  function hmById(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function tt(k) { try { if (typeof t === "function") return t(k); } catch (e) {} return k; }
  function esc(s) {
    if (typeof escapeHtml === "function") { try { return escapeHtml(s); } catch (e) {} }
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function go(page) { try { if (typeof showPage === "function") showPage(page); } catch (e) {} }
  function words() { try { if (typeof allWords === "function") return allWords(); } catch (e) {} return []; }
  function statusOf(id) { try { if (typeof getStatus === "function") return getStatus(id); } catch (e) {} return "new"; }
  function dueList() { try { if (typeof dueWords === "function") return dueWords(); } catch (e) {} return []; }
  function today() { try { if (typeof todayStr === "function") return todayStr(); } catch (e) {} var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function stats() {
    var st = { total: 0, known: 0, due: 0, mistakes: 0, days: 0, tests: 0, streak: 0, hasProgress: false, placed: false };
    try {
      var w = words();
      st.total = w.length;
      st.known = w.filter(function (x) { return statusOf(x.id) === "known"; }).length;
      st.due = dueList().length;
      var m = (typeof S !== "undefined" && S.mistakes) || {};
      st.mistakes = Object.keys(m).filter(function (id) { try { return !m[id].done; } catch (e) { return true; } }).length;
      st.days = (typeof S !== "undefined" && S.studyDays) ? Object.keys(S.studyDays).length : 0;
      st.tests = (typeof S !== "undefined" && S.testsTaken) || 0;
      st.streak = (typeof S !== "undefined" && S.streak && S.streak.count) || 0;
      st.placed = !!(typeof S !== "undefined" && S.place && S.place.lvl);
      st.hasProgress = st.known > 0 || st.tests > 0 || st.days > 0 || st.streak > 0;
    } catch (e) {}
    st.pct = st.total ? Math.round(st.known / st.total * 100) : 0;
    return st;
  }

  function continueInfo(st) {
    var page = "vocab", label = "", sub = "";
    try {
      if (typeof DMProgress !== "undefined" && DMProgress.continueTarget && typeof S !== "undefined") {
        var ct = DMProgress.continueTarget(S);
        if (ct && ct.page) { page = ct.page; label = ct.label || ""; }
      } else if (typeof S !== "undefined" && S.lastActivity && S.lastActivity.page) {
        page = S.lastActivity.page;
      }
    } catch (e) {}
    var pageName = tt(page);
    if (!st.hasProgress) { page = "vocab"; }
    try {
      if (page === "vocab" || page === "review" || page === "flashcards") {
        var w = words();
        var lvl = "A1";
        try { if (typeof kapLevel === "function" && w.length) { lvl = "A1"; } } catch (e) {}
        sub = "A1 • " + st.due + " " + tt("home_due");
        if (st.known > 0) sub = "A1 • " + st.known + " / " + w.length;
      } else if (page === "quiz" || page === "practice" || page === "challenge" || page === "chall") {
        sub = st.tests ? (st.tests + " ✓") : "";
      } else if (page === "mistakes" || page === "erreplay") {
        sub = st.mistakes ? (st.mistakes + " • " + tt("home_due")) : "";
      } else if (page === "explain" || page === "grammar") {
        sub = lvlWordCount("A1", st);
      }
    } catch (e) {}
    return { page: page, name: pageName, extra: label, sub: sub };
  }

  function lvlWordCount(L, st) {
    try {
      if (typeof lvlWords === "function" && typeof lvlKnown === "function") {
        var tot = lvlWords(L).length, kn = lvlKnown(L).length;
        if (tot) return L + " • " + kn + " / " + tot;
      }
    } catch (e) {}
    return L;
  }

  function levelRows() {
    var order = ["A1", "A2", "B1", "B2"], rows = [], firstOpen = -1;
    order.forEach(function (L, i) {
      var tot = 0, kn = 0;
      try {
        if (typeof lvlWords === "function" && typeof lvlKnown === "function") {
          tot = lvlWords(L).length; kn = lvlKnown(L).length;
        } else {
          var w = words().filter(function (x) { return (x.level || "A1") === L; });
          tot = w.length; kn = w.filter(function (x) { return statusOf(x.id) === "known"; }).length;
        }
      } catch (e) {}
      var pct = tot ? Math.round(kn / tot * 100) : 0;
      rows.push({ L: L, tot: tot, kn: kn, pct: pct, i: i });
      if (firstOpen < 0 && pct < 100) firstOpen = i;
    });
    if (firstOpen < 0) firstOpen = rows.length - 1;
    rows.forEach(function (r) {
      r.state = r.pct >= 100 ? "done" : (r.i === firstOpen ? "current" : (r.i < firstOpen ? "done" : "next"));
      if (r.i < firstOpen && r.pct < 100) r.state = "current";
    });
    return rows;
  }

  function navLevel(L, dest) {
    dest = dest || "vocab";
    function hmNavGo() {
      try {
        if (dest === "vocab") { var fl = hmById("filterLevel"); if (fl) fl.value = L; }
        if (dest === "quiz") { var ql = hmById("quizLevel"); if (ql) ql.value = L; }
      } catch (e) {}
      go(dest);
      try { if (typeof renderAll === "function") renderAll(); } catch (e) {}
    }
    try {
      if (typeof Curriculum !== "undefined" && Curriculum && !Curriculum.loaded[L] && L !== "A1" && typeof Curriculum.ensure === "function") { Curriculum.ensure(L, hmNavGo); return; }
    } catch (e) {}
    hmNavGo();
  }

  /* ---------- renderers ---------- */
  function renderCTA(st, ci) {
    try {
      var primary = hmById("hmPrimary"), secondary = hmById("hmSecondary");
      if (!primary || !secondary) return;
      if (!st.hasProgress) {
        primary.setAttribute("data-goto", "vocab");
        primary.innerHTML = esc(tt("home_start"));
        primary.setAttribute("aria-label", tt("home_start"));
        secondary.setAttribute("data-goto", "journey");
        secondary.innerHTML = esc(tt("home_placement"));
        secondary.setAttribute("aria-label", tt("home_placement"));
      } else if (!st.placed) {
        primary.setAttribute("data-goto", ci.page);
        primary.innerHTML = esc(tt("home_continue"));
        primary.setAttribute("aria-label", tt("home_continue"));
        secondary.setAttribute("data-goto", "journey");
        secondary.innerHTML = esc(tt("home_placement"));
        secondary.setAttribute("aria-label", tt("home_placement"));
      } else {
        primary.setAttribute("data-goto", ci.page);
        primary.innerHTML = esc(tt("home_continue"));
        primary.setAttribute("aria-label", tt("home_continue"));
        secondary.setAttribute("data-goto", "review");
        secondary.innerHTML = esc(tt("home_review"));
        secondary.setAttribute("aria-label", tt("home_review"));
      }
    } catch (e) {}
  }

  function renderHeroVisual(st) {
    try {
      var ring = hmById("hmRing");
      if (ring) { ring.style.setProperty("--p", String(st.pct)); var b = ring.querySelector("b"); if (b) b.textContent = st.pct + "%"; ring.setAttribute("aria-label", st.pct + "%"); }
      var tw = hmById("hmTrustWords"); if (tw) tw.innerHTML = "<b>" + st.total + "</b> " + esc(tt("home_trust_words"));
      var hs = hmById("hmHeroStreak"); if (hs) hs.innerHTML = "<b>" + st.streak + "</b><span>🔥</span>";
      var hd = hmById("hmHeroDue"); if (hd) hd.innerHTML = "<b>" + st.due + "</b><span>" + esc(tt("home_t_review")) + "</span>";
      var chips = hmById("hmChips");
      if (chips && !chips._filled) {
        chips._filled = true;
        var w = words().filter(function (x) { return x && x.de && x.art && x.art !== "-"; });
        var pick = w.length >= 3 ? [w[0], w[Math.floor(w.length / 2)], w[w.length - 1]] : null;
        var fb = [
          { art: "der", de: "Tisch", ar: "الطاولة" },
          { art: "die", de: "Sprache", ar: "اللغة" },
          { art: "das", de: "Haus", ar: "البيت" }
        ];
        var list = pick || fb;
        chips.innerHTML = list.map(function (x, i) {
          return '<span class="hm-chip c' + (i + 1) + '">' + esc(x.art + " " + x.de) + "<small>" + esc(x.ar || "") + "</small></span>";
        }).join("");
      }
    } catch (e) {}
  }

  function renderContinue(st, ci) {
    try {
      var sub = hmById("hmContSub"), btn = hmById("hmContBtn"), bar = hmById("hmContFill"), pct = hmById("hmContPct");
      if (!sub || !btn) return;
      if (!st.hasProgress) {
        sub.textContent = tt("home_cont_empty");
        btn.setAttribute("data-goto", "vocab");
        btn.innerHTML = esc(tt("home_start"));
        if (bar) bar.style.width = "0%";
        if (pct) pct.textContent = "0%";
        return;
      }
      var line = ci.name;
      if (ci.sub) line += " • " + ci.sub;
      if (ci.extra) line += " (" + ci.extra + ")";
      sub.textContent = line;
      btn.setAttribute("data-goto", ci.page);
      btn.innerHTML = esc(tt("home_cont_btn"));
      btn.setAttribute("aria-label", tt("home_cont_btn") + ": " + line);
      var p = st.pct;
      if (bar) setTimeout(function () { try { bar.style.width = p + "%"; } catch (e) {} }, 120);
      if (pct) pct.textContent = p + "%";
    } catch (e) {}
  }

  function renderToday(st) {
    try {
      var g = hmById("hmGoalNum"), r = hmById("hmReviewNum"), m = hmById("hmMistNum"), c = hmById("hmChallState");
      var gd = hmById("hmGoalDet");
      if (g) {
        var have = 0, need = 20;
        try {
          var p = (typeof S !== "undefined" && S.planner) || {};
          need = p.words || 20;
          have = (p.day === today() ? (p.dw || 0) : 0);
        } catch (e) {}
        g.textContent = have + " / " + need;
        if (gd) { var gp = need ? Math.min(100, Math.round(have / need * 100)) : 0; gd.innerHTML = '<div class="progress sm"><div class="progress-fill" style="width:' + gp + '%"></div></div>'; }
      }
      if (r) r.textContent = String(st.due);
      if (m) m.textContent = String(st.mistakes);
      if (c) {
        var done = false, score = "";
        try { var d = (typeof S !== "undefined" && S.daily) || {}; var t = d[today()]; if (t) { done = true; score = t.score + "/" + t.total; } } catch (e) {}
        c.textContent = done ? (tt("home_done") + (score ? " • " + score : "")) : tt("home_open");
      }
    } catch (e) {}
  }

  function renderRoad() {
    try {
      var host = hmById("hmRoad");
      if (!host || host._wired) return;
      host._wired = true;
      var rows = levelRows();
      host.innerHTML = rows.map(function (r, i) {
        var pill = r.state === "done" ? tt("home_done") : (r.state === "current" ? tt("home_current") : ("A" + (i + 1)));
        var sub = r.tot ? (r.kn + " / " + r.tot) : "—";
        return '<button type="button" class="hm-step glass is-' + r.state + '" data-lvl="' + r.L + '" aria-label="' + esc(r.L + " • " + r.pct + "%") + '">'
          + '<span class="hm-step-top"><span class="hm-step-lvl">' + esc(r.L) + '</span><span class="hm-pill">' + esc(pill) + "</span></span>"
          + '<span class="muted">' + esc(sub) + "</span>"
          + '<span class="progress sm"><span class="progress-fill" style="width:' + r.pct + '%"></span></span></button>';
      }).join("");
      host.querySelectorAll("[data-lvl]").forEach(function (b) {
        b.addEventListener("click", function () { navLevel(b.getAttribute("data-lvl"), "vocab"); });
      });
    } catch (e) {}
  }

  function renderMotiv(st) {
    try {
      var el = hmById("hmMotivTxt");
      if (!el) return;
      if (!st.hasProgress) el.textContent = tt("home_mot_new");
      else if ((st.streak || 0) > 0) el.textContent = tt("home_mot_streak");
      else el.textContent = tt("home_mot_mid");
    } catch (e) {}
  }

  function renderHome() {
    try {
      if (!hmById("page-dashboard")) return;
      var st = stats();
      var ci = continueInfo(st);
      renderCTA(st, ci);
      renderHeroVisual(st);
      renderContinue(st, ci);
      renderToday(st);
      renderRoad();
      renderMotiv(st);
    } catch (e) {}
  }

  /* Hook into the existing render cycle + language switches (all guarded). */
  function hook() {
    try {
      if (typeof renderDashboard === "function" && !renderDashboard._hm) {
        var orig = renderDashboard;
        var wrapped = function () { var r = orig.apply(this, arguments); try { renderHome(); } catch (e) {} return r; };
        wrapped._hm = true;
        renderDashboard = wrapped;
      }
    } catch (e) {}
    function rerender() { try { var h = hmById("hmRoad"); if (h) h._wired = false; } catch (e) {} try { var c = hmById("hmChips"); if (c) c._filled = true; } catch (e) {} try { renderHome(); } catch (e) {} }
    try {
      if (typeof applyLang === "function" && !applyLang._hm) {
        var oa = applyLang;
        var wa = function () { var r = oa.apply(this, arguments); try { rerender(); } catch (e) {} return r; };
        wa._hm = true;
        applyLang = wa;
      }
    } catch (e) {}
    try {
      if (typeof setHeaderLang === "function" && !setHeaderLang._hm) {
        var os = setHeaderLang;
        var ws = function () { var r = os.apply(this, arguments); try { setTimeout(rerender, 30); } catch (e) {} return r; };
        ws._hm = true;
        setHeaderLang = ws;
      }
    } catch (e) {}
    try {
      document.addEventListener("click", function (e) {
        var b = e.target && e.target.closest ? e.target.closest("[data-setlang]") : null;
        if (b) setTimeout(rerender, 60);
      });
    } catch (e) {}
  }

  function hmReady(fn) {
    try {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
      else fn();
    } catch (e) { try { fn(); } catch (x) {} }
  }

  try { window.DMHome = { render: renderHome, stats: stats, goLevel: navLevel }; } catch (e) {}
  hmReady(function () { try { hook(); } catch (e) {} try { renderHome(); } catch (e) {} setTimeout(function () { try { renderHome(); } catch (e) {} }, 600); });
})();
