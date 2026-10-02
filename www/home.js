/* Deutsch Master — Home Command Center engine (additive only).
   Powers the premium opening experience from REAL stored state:
   S, allWords/getStatus, dueWords/srsDue, weakWords/weakGrammar,
   gramMastery, journeyStages, DMProgress, Curriculum, S.daily/planner.
   Never fabricates numbers: empty states show onboarding copy.
   Navigation always reuses showPage; text always via t(). */
(function () {
  "use strict";
  function cmdById(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function tt(k) { try { if (typeof t === "function") return t(k); } catch (e) {} return k; }
  function esc(s) {
    if (typeof escapeHtml === "function") { try { return escapeHtml(s); } catch (e) {} }
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function go(page) { try { if (typeof showPage === "function") showPage(page); } catch (e) {} }
  function cmdWords() { try { if (typeof allWords === "function") return allWords(); } catch (e) {} return []; }
  function cmdStatus(id) { try { if (typeof getStatus === "function") return getStatus(id); } catch (e) {} return "new"; }
  function cmdDue() { try { if (typeof dueWords === "function") return dueWords(); } catch (e) {} return []; }
  function cmdToday() { try { if (typeof todayStr === "function") return todayStr(); } catch (e) {} var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function cmdOpenMistakes() {
    try {
      var m = (typeof S !== "undefined" && S.mistakes) || {};
      return Object.keys(m).filter(function (id) { try { return !m[id].done; } catch (e) { return true; } }).length;
    } catch (e) { return 0; }
  }
  function cmdFixedTotal() { try { return (typeof S !== "undefined" && S.fixedTotal) || 0; } catch (e) { return 0; } }
  function cmdActiveDays() {
    /* studyDays values are boolean flags; return last-7-day activity + total. */
    var out = [], total = 0;
    try {
      var sd = (typeof S !== "undefined" && S.studyDays) || {};
      total = Object.keys(sd).length;
      var now = new Date();
      for (var i = 6; i >= 0; i--) {
        var d = new Date(now.getTime() - i * 86400000);
        var k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        out.push(!!sd[k]);
      }
    } catch (e) {}
    return { week: out, total: total };
  }

  function cmdStats() {
    var st = { total: 0, known: 0, due: 0, mistakes: 0, fixed: 0, days: 0, week: [], tests: 0, streak: 0, placed: false, hasProgress: false, dailyDone: false, lok: 0, sok: 0, pct: 0, gramAvg: -1, gramN: 0 };
    try {
      var w = cmdWords();
      st.total = w.length;
      st.known = w.filter(function (x) { return cmdStatus(x.id) === "known"; }).length;
      st.due = cmdDue().length;
      st.mistakes = cmdOpenMistakes();
      st.fixed = cmdFixedTotal();
      var ad = cmdActiveDays();
      st.week = ad.week; st.days = ad.total;
      st.tests = (typeof S !== "undefined" && S.testsTaken) || 0;
      st.streak = (typeof S !== "undefined" && S.streak && S.streak.count) || 0;
      st.placed = !!(typeof S !== "undefined" && S.place && S.place.lvl);
      st.hasProgress = st.known > 0 || st.tests > 0 || st.days > 0 || st.streak > 0;
      try { st.dailyDone = !!(S.daily && S.daily[cmdToday()]); } catch (e) {}
      try { st.lok = (S.lstats && S.lstats.lok) || 0; st.sok = (S.lstats && S.lstats.sok) || 0; } catch (e) {}
      try {
        if (typeof gramMastery === "function") {
          var sum = 0, n = 0;
          var ids = (typeof GRAMMAR !== "undefined" && GRAMMAR.map) ? GRAMMAR.map(function (g) { return g.id; }) : Object.keys((S.grammar) || {});
          ids.forEach(function (id) { try { var m = gramMastery(id); if (m) { sum += m.pct; n++; } } catch (e) {} });
          if (n > 0) { st.gramAvg = Math.round(sum / n); st.gramN = n; }
        }
      } catch (e) {}
    } catch (e) {}
    st.pct = st.total ? Math.round(st.known / st.total * 100) : 0;
    return st;
  }

  function cmdContinuePage(st) {
    var page = "vocab";
    try {
      if (!st.hasProgress) return "vocab";
      if (typeof DMProgress !== "undefined" && DMProgress.continueTarget && typeof S !== "undefined") {
        var ct = DMProgress.continueTarget(S);
        if (ct && ct.page) page = ct.page;
      } else if (typeof S !== "undefined" && S.lastActivity && S.lastActivity.page) page = S.lastActivity.page;
    } catch (e) {}
    return page;
  }

  function cmdPlanner() {
    var have = 0, need = 20;
    try {
      var p = (typeof S !== "undefined" && S.planner) || {};
      need = p.words || 20;
      have = (p.day === cmdToday() ? (p.dw || 0) : 0);
    } catch (e) {}
    return { have: have, need: need, pct: need ? Math.min(100, Math.round(have / need * 100)) : 0 };
  }

  function cmdWeakGrammar() {
    var out = [];
    try {
      if (typeof weakGrammar === "function") {
        out = weakGrammar(3) || [];
      } else {
        var gw = (typeof S !== "undefined" && S.gweak) || {};
        out = Object.keys(gw).sort(function (a, b) { return gw[b] - gw[a]; }).slice(0, 3);
      }
    } catch (e) {}
    return out;
  }

  function cmdWeakCats() {
    try { if (typeof weakAreas === "function") return weakAreas() || []; } catch (e) {}
    return [];
  }

  /* ================= HERO ================= */
  function cmdHero(st) {
    try {
      var primary = cmdById("hmPrimary"), secondary = cmdById("hmSecondary");
      var back = cmdById("cmdWelcome"), onb = cmdById("cmdOnboard");
      var cont = cmdContinuePage(st);
      if (!st.hasProgress) {
        if (primary) { primary.setAttribute("data-goto", "vocab"); primary.innerHTML = esc(tt("cmd_start")); }
        if (secondary) { secondary.setAttribute("data-goto", "journey"); secondary.innerHTML = esc(tt("cmd_place")); }
        if (back) back.style.display = "none";
        if (onb) onb.style.display = "";
      } else {
        if (primary) { primary.setAttribute("data-goto", cont); primary.innerHTML = esc(tt("cmd_continue")); }
        if (secondary) {
          if (!st.placed) { secondary.setAttribute("data-goto", "journey"); secondary.innerHTML = esc(tt("cmd_place")); }
          else { secondary.setAttribute("data-goto", "review"); secondary.innerHTML = esc(tt("home_review")); }
        }
        if (back) { back.style.display = ""; }
        if (onb) { onb.style.display = "none"; }
        try {
          var bt = cmdById("cmdBackTxt");
          if (bt) bt.textContent = tt("cmd_welcome_back") + " • 🔥" + st.streak + " • " + st.known + "/" + st.total;
        } catch (e) {}
      }
      var tw = cmdById("cmdTrustWords");
      if (tw) tw.innerHTML = "<b>" + st.total + "</b>&nbsp;" + esc(tt("cmd_words"));
    } catch (e) {}
  }

  /* ================= ORBIT ================= */
  var ORBIT = [
    { id: "vocab", icon: "📚", page: "vocab", desc: "skd_vocab" },
    { id: "grammar", icon: "📐", page: "grammar", desc: "skd_grammar" },
    { id: "sent", icon: "💬", page: "sentences", desc: "skd_sent" },
    { id: "speak", icon: "🎤", page: "speak", desc: "skd_speak" },
    { id: "listen", icon: "🎧", page: "listen", desc: "skd_listen" },
    { id: "review", icon: "🧠", page: "review", desc: "skd_review" }
  ];
  var orbitSel = "vocab";
  function cmdBankCount() { try { if (typeof SENTENCES !== "undefined" && SENTENCES.length) return SENTENCES.length; } catch (e) {} return 0; }
  function cmdSkillMetric(id, st) {
    try {
      if (id === "vocab") return { txt: st.known + "/" + st.total, pct: st.pct };
      if (id === "grammar") return st.gramAvg >= 0 ? { txt: st.gramAvg + "% • " + st.gramN, pct: st.gramAvg } : { txt: "—", pct: -1 };
      if (id === "sent") { var n = cmdBankCount(); return { txt: n ? (n + " " + tt("cmd_sents")) : "—", pct: -1 }; }
      if (id === "speak") return { txt: st.sok + " " + tt("cmd_sessions"), pct: -1 };
      if (id === "listen") return { txt: st.lok + " " + tt("cmd_sessions"), pct: -1 };
      if (id === "review") return { txt: st.due + "", pct: -1 };
    } catch (e) {}
    return { txt: "—", pct: -1 };
  }
  function cmdOrbit(st) {
    try {
      var ring = cmdById("hmRing");
      if (ring) {
        ring.style.setProperty("--p", String(st.pct));
        ring.setAttribute("aria-valuenow", String(st.pct));
        var pc = ring.querySelector(".orbit-pct"); if (pc) pc.textContent = st.pct + "%";
        var hp = cmdById("heroProgressPct"); if (hp) hp.textContent = st.pct + "%";
        var hf = cmdById("heroProgressFill"); if (hf) setTimeout(function () { try { hf.style.width = st.pct + "%"; } catch (e) {} }, 120);
        var os = cmdById("orbitStreak"); if (os) os.textContent = "🔥 " + st.streak;
      }
      var host = cmdById("orbitNodes");
      if (host && !host._built) {
        host._built = true;
        host.innerHTML = ORBIT.map(function (s, i) {
          return '<button type="button" class="orbit-node n' + i + '" data-sk="' + s.id + '" aria-label="' + esc(tt(s.id === "sent" ? "sentences" : s.id)) + '"><span class="ico">' + s.icon + '</span><span class="v"></span></button>';
        }).join("");
        host.querySelectorAll("[data-sk]").forEach(function (b) {
          b.addEventListener("click", function () { orbitSel = b.getAttribute("data-sk"); try { cmdOrbit(cmdStats()); } catch (e) {} });
        });
      }
      if (host) {
        host.querySelectorAll("[data-sk]").forEach(function (b) {
          var id = b.getAttribute("data-sk");
          var m = cmdSkillMetric(id, st);
          var v = b.querySelector(".v"); if (v) v.textContent = m.txt;
          b.classList.toggle("active", id === orbitSel);
        });
      }
      var cur = null;
      ORBIT.forEach(function (s) { if (s.id === orbitSel) cur = s; });
      if (!cur) { cur = ORBIT[0]; orbitSel = cur.id; }
      var m = cmdSkillMetric(cur.id, st);
      var t = cmdById("orbitName"), d = cmdById("orbitDesc"), mm = cmdById("orbitMetric"), cta = cmdById("orbitGo");
      if (t) t.textContent = tt(cur.id === "sent" ? "sentences" : cur.id);
      if (d) d.textContent = tt(cur.desc);
      if (mm) mm.textContent = m.txt;
      if (cta) { cta.setAttribute("data-goto", cur.page); cta.textContent = tt("home_open"); }
    } catch (e) {}
  }

  /* ================= NEXT STEP ================= */
  function cmdNext(st) {
    try {
      var box = cmdById("cmdNextBody");
      if (!box) return;
      var rec = null;
      var gp = cmdPlanner();
      if (!st.hasProgress) {
        rec = { icon: "🎯", title: tt("cmd_next_new_t"), why: tt("cmd_next_new_d"), page: "journey", cta: tt("cmd_place") };
      } else if (st.due > 0) {
        rec = { icon: "🧠", title: "<b>" + st.due + "</b> " + esc(tt("cmd_next_due")), why: tt("cmd_why_step") + " " + esc(tt("stat_due")) + ".", page: "review", cta: tt("home_review") };
      } else if (st.mistakes > 0) {
        rec = { icon: "❌", title: tt("cmd_next_mist_t") + " — <b>" + st.mistakes + "</b> " + esc(tt("cmd_next_mist")), why: tt("cmd_pipe_sub"), page: "mistakes", cta: tt("cmd_pipe_cta") };
      } else if (!st.dailyDone) {
        rec = { icon: "⚡", title: tt("cmd_next_chal_t"), why: tt("cmd_next_chal_d"), page: "challenge", cta: tt("cmd_go") };
      } else {
        var wg = cmdWeakGrammar();
        if (wg.length) {
          var gname = wg[0];
          try { if (typeof GRAMMAR !== "undefined") { var g = GRAMMAR.find(function (x) { return x.id === wg[0]; }); if (g) gname = g.title; } } catch (e) {}
          rec = { icon: "📐", title: tt("cmd_next_weak_t") + ": <b>" + esc(gname) + "</b>", why: tt("cmd_smart_sub"), page: "grammar", cta: tt("cmd_go") };
        } else {
          var cp = cmdContinuePage(st);
          rec = { icon: "▶️", title: tt("cmd_next_go_t"), why: esc(tt(cp)) + (st.placed ? " • <b>" + esc(S.place.lvl) + "</b>" : ""), page: cp, cta: tt("cmd_continue") };
        }
      }
      if (gp.need && gp.have < gp.need && st.hasProgress && !st.dailyDone) { /* mission hint stays in mission card */ }
      box.innerHTML = '<div class="cmd-next-ico">' + rec.icon + '</div>'
        + '<div><h3>' + rec.title + '</h3><div class="why">' + rec.why + '</div></div>'
        + '<button type="button" class="btn btn-gold" data-nextgo="' + esc(rec.page) + '">' + esc(rec.cta) + '</button>';
      var b = box.querySelector("[data-nextgo]");
      if (b) b.addEventListener("click", function () { go(b.getAttribute("data-nextgo")); });
    } catch (e) {}
  }

  /* ================= MISSION ================= */
  function cmdMission(st) {
    try {
      var gp = cmdPlanner();
      var arc = cmdById("cmdArc"), num = cmdById("cmdArcNum");
      var parts = [gp.have >= gp.need, st.dailyDone, st.due === 0];
      var done = parts.filter(Boolean).length;
      var p = Math.round(done / 3 * 100);
      if (arc) { arc.style.setProperty("--p", String(p)); arc.setAttribute("aria-valuenow", String(p)); }
      if (num) num.textContent = done + "/3";
      var g = cmdById("cmdMGoal"); if (g) g.textContent = gp.have + " / " + gp.need;
      var c = cmdById("cmdMChal"); if (c) c.textContent = st.dailyDone ? tt("home_done") : tt("home_open");
      var r = cmdById("cmdMRev"); if (r) r.textContent = String(st.due);
      var btn = cmdById("cmdMissionGo");
      if (btn) {
        var target = gp.have < gp.need ? "vocab" : (!st.dailyDone ? "challenge" : (st.due > 0 ? "review" : "planner"));
        btn.setAttribute("data-goto", target);
        btn.innerHTML = esc(p >= 100 ? tt("cmd_m_done") : tt("cmd_m_cta"));
      }
    } catch (e) {}
  }

  /* ================= JOURNEY ================= */
  function cmdJourney(st) {
    try {
      var host = cmdById("cmdRail");
      if (!host || host._built) return;
      host._built = true;
      var stages = [];
      try { if (typeof journeyStages === "function") stages = journeyStages() || []; } catch (e) {}
      var lockedLvls = {};
      try { if (typeof ROADMAP !== "undefined" && ROADMAP.forEach) ROADMAP.forEach(function (R) { if (R.locked) lockedLvls[R.lvl] = true; }); } catch (e) {}
      var firstOpen = -1;
      stages.forEach(function (s, i) { if (firstOpen < 0 && (s.p || 0) < 1) firstOpen = i; });
      if (firstOpen < 0) firstOpen = stages.length - 1;
      var h = stages.map(function (s, i) {
        var cls = (s.p >= 1) ? "is-done" : (i === firstOpen ? "is-current" : (i < firstOpen ? "is-done" : ""));
        var pill = (s.p >= 1) ? tt("home_done") : (i === firstOpen ? tt("cmd_now") : Math.round((s.p || 0) * 100) + "%");
        return '<div class="cmd-stop ' + cls + '"><div class="cmd-stop-card glass"><div class="cmd-stop-body"><b>' + esc(s.t) + '</b>'
          + '<div class="muted">' + esc(s.d) + '</div><div class="progress sm"><div class="progress-fill" style="width:' + Math.round((s.p || 0) * 100) + '%"></div></div></div>'
          + '<span class="cmd-pill">' + esc(pill) + '</span><button type="button" class="btn btn-ghost sm" data-jgo="' + esc(s.go) + '">' + esc(tt("home_open")) + '</button></div></div>';
      }).join("");
      ["A2", "B1"].forEach(function (L) {
        var tot = 0, kn = 0;
        try {
          if (typeof lvlWords === "function" && typeof lvlKnown === "function") { tot = lvlWords(L).length; kn = lvlKnown(L).length; }
          else { var w = cmdWords().filter(function (x) { return (x.level || "A1") === L; }); tot = w.length; kn = w.filter(function (x) { return cmdStatus(x.id) === "known"; }).length; }
        } catch (e) {}
        var locked = !!lockedLvls[L];
        var pct = tot ? Math.round(kn / tot * 100) : 0;
        h += '<div class="cmd-stop ' + (locked ? "is-locked" : (pct >= 100 ? "is-done" : "")) + '"><div class="cmd-stop-card glass"><div class="cmd-stop-body"><b>' + L + '</b>'
          + '<div class="muted">' + (tot ? (kn + " / " + tot + " " + esc(tt("cmd_words"))) : "—") + '</div><div class="progress sm"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>'
          + '<span class="cmd-pill">' + esc(locked ? tt("cmd_locked") : (pct + "%")) + '</span>'
          + (locked ? "" : '<button type="button" class="btn btn-ghost sm" data-lvl="' + L + '">' + esc(tt("home_open")) + '</button>') + '</div></div>';
      });
      host.innerHTML = h;
      host.querySelectorAll("[data-jgo]").forEach(function (b) { b.addEventListener("click", function () { go(b.getAttribute("data-jgo")); }); });
      host.querySelectorAll("[data-lvl]").forEach(function (b) {
        b.addEventListener("click", function () {
          var L = b.getAttribute("data-lvl");
          function cmdLvlNav() {
            try { var fl = cmdById("filterLevel"); if (fl) fl.value = L; } catch (e) {}
            go("vocab");
            try { if (typeof renderAll === "function") renderAll(); } catch (e) {}
          }
          try {
            if (typeof Curriculum !== "undefined" && Curriculum && !Curriculum.loaded[L] && typeof Curriculum.ensure === "function") { Curriculum.ensure(L, cmdLvlNav); return; }
          } catch (e) {}
          cmdLvlNav();
        });
      });
    } catch (e) {}
  }

  /* ================= SPOTLIGHT ================= */
  var cmdFocus = "";
  function cmdSpot(st) {
    try {
      var host = cmdById("cmdFocusRow");
      if (!host) return;
      var opts = [];
      try {
        var ww = (typeof weakWords === "function") ? (weakWords(8) || []) : [];
        if (ww.length) opts.push({ id: "words", icon: "📚", t: tt("vocab") + " • " + ww.length });
      } catch (e) {}
      cmdWeakGrammar().forEach(function (id) {
        var t = id;
        try { if (typeof GRAMMAR !== "undefined") { var g = GRAMMAR.find(function (x) { return x.id === id; }); if (g) t = g.title; } } catch (e) {}
        opts.push({ id: "g:" + id, icon: "📐", t: String(t).slice(0, 26) });
      });
      cmdWeakCats().forEach(function (c) { opts.push({ id: "c:" + c.k, icon: "🎯", t: String(c.k).slice(0, 22) + " • " + c.n }); });
      if (!cmdFocus && opts.length) cmdFocus = opts[0].id;
      if (!opts.length) {
        host.innerHTML = '<div class="muted">' + esc(tt("cmd_smart_empty")) + '</div>';
      } else {
        host.innerHTML = opts.slice(0, 5).map(function (o) {
          return '<button type="button" class="cmd-chipbtn' + (o.id === cmdFocus ? " active" : "") + '" data-f="' + esc(o.id) + '">' + o.icon + " " + esc(o.t) + '</button>';
        }).join("");
        host.querySelectorAll("[data-f]").forEach(function (b) {
          b.addEventListener("click", function () { cmdFocus = b.getAttribute("data-f"); try { cmdSpot(cmdStats()); } catch (e) {} });
        });
      }
      var cta = cmdById("cmdSpotGo");
      if (cta) { cta.setAttribute("data-goto", "practice"); cta.innerHTML = esc(tt("cmd_smart_cta")); }
    } catch (e) {}
  }

  /* ================= MINI LESSON ================= */
  function cmdMini() {
    try {
      var host = cmdById("cmdMiniQ");
      if (!host || host._built) return;
      host._built = true;
      var opts = ["يتعلم / to learn / lernen", "يلعب / to play / spielen", "يأكل / to eat / essen"];
      var order = [0, 1, 2];
      host.innerHTML = '<div class="cmd-mini-q">' + esc(tt("cmd_mini_q")) + '</div>'
        + order.map(function (oi) { return '<button type="button" class="cmd-mini-opt" data-o="' + oi + '">' + esc(opts[oi]) + '</button>'; }).join("")
        + '<div class="cmd-mini-fb" id="cmdMiniFb" aria-live="polite"></div>';
      host.querySelectorAll("[data-o]").forEach(function (b) {
        b.addEventListener("click", function () {
          var ok = b.getAttribute("data-o") === "0";
          host.querySelectorAll("[data-o]").forEach(function (x) { x.disabled = true; if (x.getAttribute("data-o") === "0") x.classList.add("good"); });
          if (!ok) b.classList.add("bad");
          var fb = cmdById("cmdMiniFb");
          if (fb) { fb.className = "cmd-mini-fb " + (ok ? "ok" : "no"); fb.textContent = (ok ? tt("cmd_mini_ok") : tt("cmd_mini_no")) + " " + tt("cmd_mini_ex"); }
          if (ok && !host._xp) {
            host._xp = true;
            try { if (typeof addXP === "function") addXP(3, "mini"); } catch (e) {}
            try { if (typeof toast === "function") toast("+3 XP", "ok"); } catch (e) {}
          }
          try { if (typeof markStudyDay === "function") markStudyDay(); } catch (e) {}
        });
      });
      var listen = cmdById("cmdMiniHear");
      if (listen && !listen._wired) {
        listen._wired = true;
        listen.addEventListener("click", function () { try { if (typeof speak === "function") speak("Ich lerne Deutsch."); } catch (e) {} });
      }
    } catch (e) {}
  }

  /* ================= EXPLORE counts ================= */
  function cmdExplore(st) {
    try {
      function cmdSetEx(id, v) { try { var el = cmdById(id); if (el) el.textContent = v; } catch (e) {} }
      cmdSetEx("cntWords", st.known + "/" + st.total);
      try { cmdSetEx("cntSents", typeof SENTENCES !== "undefined" ? String(SENTENCES.length) : "—"); } catch (e) { cmdSetEx("cntSents", "—"); }
      try { cmdSetEx("cntGram", typeof GRAMMAR !== "undefined" ? String(GRAMMAR.length) : "—"); } catch (e) { cmdSetEx("cntGram", "—"); }
      try {
        var verbs = 0;
        cmdWords().forEach(function (w) { if (w.type === "فعل") verbs++; });
        cmdSetEx("cntVerbs", verbs ? String(verbs) : "—");
      } catch (e) {}
      cmdSetEx("cntMist", String(st.mistakes));
      cmdSetEx("cntRev", String(st.due));
      cmdSetEx("cntTests", String(st.tests));
    } catch (e) {}
  }

  /* ================= PROGRESS CENTER ================= */
  function cmdProgress(st) {
    try {
      var ring = cmdById("cmdBigRing"), num = cmdById("cmdBigNum");
      if (ring) { ring.style.setProperty("--p", String(st.pct)); ring.setAttribute("aria-valuenow", String(st.pct)); }
      if (num) num.textContent = st.pct + "%";
      function cmdSetPr(id, v) { try { var el = cmdById(id); if (el) el.textContent = v; } catch (e) {} }
      cmdSetPr("cmdPKnown", st.known + "/" + st.total);
      cmdSetPr("cmdPStreak", String(st.streak));
      cmdSetPr("cmdPDue", String(st.due));
      cmdSetPr("cmdPMist", String(st.mistakes));
      cmdSetPr("cmdPTests", String(st.tests));
      cmdSetPr("cmdPFixed", String(st.fixed));
      var dots = cmdById("cmdDots");
      if (dots && !dots._built) {
        dots._built = true;
        dots.innerHTML = st.week.map(function (on) { return "<i class=\"" + (on ? "on" : "") + "\"></i>"; }).join("");
      }
      var tr = cmdById("cmdTrend");
      if (tr) {
        var w = null;
        try { if (typeof DMProgress !== "undefined" && DMProgress.weeklySummary) w = DMProgress.weeklySummary(S); } catch (e) {}
        if (w && w.hasData) {
          var d = w.deltaAns;
          tr.className = "cmd-trend " + (d > 0 ? "up" : (d < 0 ? "down" : ""));
          tr.textContent = (d > 0 ? "+" : "") + d + " • " + tt("cmd_vs");
        } else { tr.textContent = ""; }
      }
    } catch (e) {}
  }

  /* ================= PIPELINE ================= */
  function cmdPipe(st) {
    try {
      function cmdSetPipe(id, v) { try { var el = cmdById(id); if (el) el.textContent = v; } catch (e) {} }
      cmdSetPipe("cmdPipeOpen", String(st.mistakes));
      cmdSetPipe("cmdPipeDue", String(st.due));
      cmdSetPipe("cmdPipeTests", String(st.tests));
      cmdSetPipe("cmdPipeFixed", String(st.fixed));
      var msg = cmdById("cmdPipeMsg");
      if (msg) msg.textContent = st.mistakes > 0 ? (st.mistakes + " " + tt("cmd_pipe_open") + " — " + tt("cmd_pipe_cta")) : tt("cmd_pipe_clean");
    } catch (e) {}
  }

  /* ================= METHOD CTA ================= */
  function cmdMethod() {
    try {
      var btn = cmdById("cmdMethodGo");
      if (!btn || btn._wired) return;
      btn._wired = true;
      btn.addEventListener("click", function () {
        var target = "explain";
        try {
          var box = cmdById("howtoBox");
          var hasRenderer = (typeof renderHowto === "function");
          if ((box && box.children && box.children.length) || hasRenderer) target = "howto";
          else { var pg = cmdById("page-howto"); if (pg && hasRenderer) target = "howto"; }
        } catch (e) {}
        go(target);
      });
    } catch (e) {}
  }

  /* ================= FINAL CTA ================= */
  function cmdFinal(st) {
    try {
      var btn = cmdById("cmdFinalGo");
      if (!btn) return;
      var cont = cmdContinuePage(st);
      if (!st.hasProgress) { btn.setAttribute("data-goto", "vocab"); btn.innerHTML = esc(tt("cmd_start")); }
      else { btn.setAttribute("data-goto", cont); btn.innerHTML = esc(tt("cmd_continue")); }
    } catch (e) {}
  }

  function cmdRender() {
    try {
      if (!cmdById("page-dashboard")) return;
      var st = cmdStats();
      cmdHero(st);
      cmdOrbit(st);
      cmdNext(st);
      cmdMission(st);
      cmdJourney(st);
      cmdSpot(st);
      cmdMini();
      cmdExplore(st);
      cmdProgress(st);
      cmdPipe(st);
      cmdMethod();
      cmdFinal(st);
    } catch (e) {}
  }

  function cmdHook() {
    try {
      if (typeof renderDashboard === "function" && !renderDashboard._cmd) {
        var orig = renderDashboard;
        var wrapped = function () { var r = orig.apply(this, arguments); try { cmdRender(); } catch (e) {} return r; };
        wrapped._cmd = true;
        renderDashboard = wrapped;
      }
    } catch (e) {}
    function cmdRerender(full) {
      try { if (full) { var h = cmdById("cmdRail"); if (h) h._built = false; var m = cmdById("cmdMiniQ"); if (m) { /* keep answered state */ } var d = cmdById("cmdDots"); if (d) d._built = false; var o = cmdById("orbitNodes"); if (o) o._built = true; } } catch (e) {}
      try { cmdRender(); } catch (e) {}
    }
    try {
      if (typeof applyLang === "function" && !applyLang._cmd) {
        var oa = applyLang;
        var wa = function () { var r = oa.apply(this, arguments); try { cmdRerender(false); } catch (e) {} return r; };
        wa._cmd = true;
        applyLang = wa;
      }
    } catch (e) {}
    try {
      if (typeof setHeaderLang === "function" && !setHeaderLang._cmd) {
        var os = setHeaderLang;
        var ws = function () { var r = os.apply(this, arguments); try { setTimeout(function () { cmdRerender(false); }, 30); } catch (e) {} return r; };
        ws._cmd = true;
        setHeaderLang = ws;
      }
    } catch (e) {}
    try {
      document.addEventListener("click", function (e) {
        var b = e.target && e.target.closest ? e.target.closest("[data-setlang]") : null;
        if (b) setTimeout(function () { cmdRerender(false); }, 60);
      });
    } catch (e) {}
  }

  function cmdReady(fn) {
    try {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
      else fn();
    } catch (e) { try { fn(); } catch (x) {} }
  }

  try { window.DMHome = { render: cmdRender, stats: cmdStats }; } catch (e) {}
  cmdReady(function () { try { cmdHook(); } catch (e) {} try { cmdRender(); } catch (e) {} setTimeout(function () { try { cmdRender(); } catch (e) {} }, 600); });
})();
