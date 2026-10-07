/* ==========================================================================
   Deutsch Master — SOVEREIGN engine (sovereign.js)
   Additive only. Loads LAST. No content/logic/storage/routing changes.
   - Distinct inline-SVG icon language for every nav section
   - Mobile bottom navigation (5 primary destinations)
   - Editorial hero kicker (Latin micro-copy, dir=ltr)
   - Orbit pause when offscreen (IntersectionObserver)
   - prefers-reduced-motion -> html.sv-reduced
   ========================================================================== */
(function () {
  "use strict";
  if (window.__svInit) return;
  window.__svInit = true;
  var doc = document;

  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) { reduced = false; }
  if (reduced) { try { doc.documentElement.classList.add("sv-reduced"); } catch (e) {} }

  function svgWrap(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + inner + "</svg>";
  }

  /* Distinct silhouette per section. Flagged five are maximally different:
     howto=compass · career=briefcase · life=broadcast tower ·
     simulator=monitor-play · survive=shield. */
  var ICONS = {
    dashboard: '<path d="M3 11.2 12 3l9 8.2"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5.5h4V20"/>',
    vocab: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5V5.5"/><path d="M20 18H6.5A2.5 2.5 0 0 0 4 20.5"/><path d="M9 8h7M9 11.5h5"/>',
    sentences: '<path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6a3.5 3.5 0 0 1-3.5 3.5H9l-5 4Z"/><path d="M8.5 8.5h7M8.5 11.5h4"/>',
    flashcards: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    explain: '<path d="M9.5 18h5"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.2 1.3 2.2h4.6c.2-1 .6-1.6 1.3-2.2A6 6 0 0 0 12 3Z"/>',
    verbs: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12Z"/>',
    grammar: '<rect x="3.5" y="3.5" width="8" height="8" rx="1.5"/><circle cx="16.5" cy="16.5" r="4.5"/><path d="M16.5 14v2.5l1.7 1.2"/>',
    reference: '<path d="M3 9.5 12 5l9 4.5"/><path d="M5 10.5V16M9.5 12v4.5M14.5 12v4.5M19 10.5V16"/><path d="M3.5 18.5h17"/>',
    howto: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
    career: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
    life: '<circle cx="12" cy="12" r="2"/><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M6 18a9 9 0 0 1 0-12M18 6a9 9 0 0 1 0 12"/><path d="M12 14v7"/>',
    simulator: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="m10.5 8.5 5 3-5 3Z"/><path d="M9 20.5h6"/>',
    survive: '<path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8 7.5 10 4.3-2 7.5-5.4 7.5-10v-6Z"/><path d="m9 11.5 2.2 2.2L15.5 9.5"/>',
    listen: '<path d="M4 15v-2.5a8 8 0 0 1 16 0V15"/><rect x="3" y="14" width="4" height="7" rx="1.8"/><rect x="17" y="14" width="4" height="7" rx="1.8"/>',
    speak: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M8.5 21h7"/>',
    talk: '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h5A3.5 3.5 0 0 1 16 5.5v5a3.5 3.5 0 0 1-3.5 3.5H8l-4 3.2Z"/><path d="M16 10h1.5A3.5 3.5 0 0 1 21 13.5v4a3.5 3.5 0 0 1-3.5 3.5H15l-2.6 2"/>',
    real: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    job: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><circle cx="12" cy="10" r="2.6"/><path d="M7.5 17a4.5 4.5 0 0 1 9 0"/><path d="m16.5 7.5 1 1 1.8-2"/>',
    sentex: '<path d="m14.5 5.5 4 4L8 20l-5 1 1-5Z"/><path d="m13 7 4 4"/>',
    exp: '<path d="M9.5 3h5"/><path d="M10 3v5.5L4.8 18a2.4 2.4 0 0 0 2.1 3.5h10.2a2.4 2.4 0 0 0 2.1-3.5L14 8.5V3"/><path d="M7.5 14.5h9"/>',
    mygermany: '<path d="M5 21V4"/><path d="M5 4.5h12.5l-2.7 3.8 2.7 3.7H5"/>',
    dlife: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/>',
    stories: '<path d="M12 6.5C10 4.8 7.2 4.5 4 5v13.5c3.2-.5 6-.2 8 1.5 2-1.7 4.8-2 8-1.5V5c-3.2-.5-6-.2-8 1.5Z"/><path d="M12 6.5V20"/>',
    situations: '<path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2Z"/><path d="M9 4v14M15 6v14"/>',
    shadowing: '<path d="M3 12h2.5l2-6 3 12 2.5-8 1.5 2H21"/>',
    writing: '<path d="m14.5 5.5 4 4L8 20l-5 1 1-5Z"/><path d="M4 20l1-1"/>',
    dictation: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10.5h.01M11 10.5h.01M15 10.5h.01M17.5 10.5h.01M7 14h10"/>',
    lislab: '<path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="9" r="2.2"/><circle cx="12" cy="15" r="2.2"/><circle cx="19" cy="8" r="2.2"/>',
    quiz: '<rect x="5.5" y="4.5" width="13" height="17" rx="2"/><path d="M9.5 4.5V3h5v1.5"/><path d="m10 13.5 2.3 2.3 4.2-4.8"/>',
    practice: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/>',
    journey: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    roadmap: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 3.5L17 11.5H6"/><path d="M6 12v9"/>',
    world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 2.6 4.2 5.6 4.2 9S14.8 18.4 12 21c-2.8-2.6-4.2-5.6-4.2-9S9.2 5.6 12 3Z"/>',
    games: '<rect x="2.5" y="7.5" width="19" height="10.5" rx="5"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="17.5" cy="14" r=".9"/>',
    challenge: '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5H4.5a3.5 3.5 0 0 0 3.6 4M16 5h3.5a3.5 3.5 0 0 1-3.6 4"/><path d="M12 13v4M8.5 20.5h7M10 17h4"/>',
    chall: '<circle cx="12" cy="14" r="5"/><path d="m9.2 8.5-3-4M14.8 8.5l3-4"/><path d="M8.5 4.5h7"/><path d="m10.5 14 1.2 1.2 2.3-2.7"/>',
    tutor: '<rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V4.5"/><circle cx="12" cy="3.5" r="1"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/><path d="M9.8 16h4.4"/>',
    labs: '<path d="M10 3h4"/><path d="M10.5 3v5L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L13.5 8V3"/><path d="M8 15h8"/>',
    fixsent: '<path d="M14.5 6.5a4 4 0 0 0-5.6 4.9L3.5 16.8 7.2 20.5l5.4-5.4a4 4 0 0 0 4.9-5.6l-2.7 2.7-2.5-2.5Z"/>',
    finderr: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/><path d="m8.8 8.8 4.4 4.4M13.2 8.8l-4.4 4.4"/>',
    erreplay: '<path d="M4 12a8 8 0 1 1 2.3 5.7"/><path d="M4 18v-5h5"/>',
    review: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 3.5V8h-4.5"/>',
    mistakes: '<path d="M12 3.5 2.5 20h19Z"/><path d="M12 9.5V14"/><path d="M12 17h.01"/>',
    ach: '<circle cx="12" cy="9.5" r="5.5"/><path d="m9 14-2 7 5-2.5L17 21l-2-7"/><path d="m10.2 9.5 1.3 1.3 2.3-2.8"/>',
    me: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.5" r="3"/><path d="M6 19.5a6.5 6.5 0 0 1 12 0"/>',
    stats: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8.5 16v-5M13 16V8M17.5 16v-3"/>',
    analytics: '<path d="M3 12h4l2.5-6.5 4 13L16.5 12H21"/>',
    planner: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/><path d="m10.5 14 1.5 1.5 3-3.5"/>',
    favorites: '<path d="M12 20.5s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3c0 5.8-8 10.5-8 10.5Z"/>',
    ankidroid: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    profile: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.7" cy="11" r="2"/><path d="M5.5 16a3.5 3.5 0 0 1 6.4 0"/><path d="M14 9.5h5M14 13h5"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M2.8 12h3M18.2 12h3M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5"/>',
    logout: '<path d="M14 4H6v16h8"/><path d="m10 12h11M18 8.5 21.5 12 18 15.5"/>'
  };

  function iconFor(key) {
    var inner = ICONS[key] || ICONS.dashboard;
    return svgWrap(inner);
  }

  /* ---- 1. Sidebar: replace emoji tiles with distinct SVG tiles ---- */
  function upgradeSidebar() {
    var items;
    try { items = doc.querySelectorAll("#mainNav .nav-item"); } catch (e) { return; }
    for (var i = 0; i < items.length; i++) {
      (function (btn) {
        var key = btn.getAttribute("data-page") || btn.id || "dashboard";
        var old;
        try { old = btn.querySelector(".nav-ico"); } catch (e) { old = null; }
        if (old) {
          var tile = doc.createElement("span");
          tile.className = "sv-ico";
          tile.setAttribute("aria-hidden", "true");
          tile.innerHTML = iconFor(key);
          try { btn.replaceChild(tile, old); } catch (e) {}
        }
        /* German micro-label for screen readers stays intact (text kept). */
      })(items[i]);
    }
  }

  /* ---- 2. Dashboard tiles: same icon language (.cmd-feat, loop, pipe) ---- */
  function upgradeFeatureTiles() {
    upgradeTileSet(".cmd-feat", ".fi", true);
    upgradeTileSet(".cmd-loop-step", ".li", true);
    upgradeTileSet(".cmd-pipe-step", ".pi", false);
  }
  var PIPE_KEY = ["mistakes", "review", "practice", "ach"];
  function upgradeTileSet(scopeSel, emoSel, useGoto) {
    var feats;
    try { feats = doc.querySelectorAll(scopeSel); } catch (e) { return; }
    for (var i = 0; i < feats.length; i++) {
      (function (f) {
        if (f.querySelector(".sv-fi")) return;
        var old = null;
        try { old = f.querySelector(emoSel); } catch (e) {}
        if (!old) return;
        var key = (useGoto && f.getAttribute("data-goto")) || PIPE_KEY[i % PIPE_KEY.length] || "dashboard";
        var tile = doc.createElement("span");
        tile.className = "sv-fi";
        tile.setAttribute("aria-hidden", "true");
        tile.innerHTML = iconFor(key);
        if (old) { try { f.replaceChild(tile, old); } catch (e) {} }
        else { try { f.insertBefore(tile, f.firstChild); } catch (e) {} }
      })(feats[i]);
    }
  }

  /* ---- 3. Hero kicker: DISABLED (was a duplicate marketing heading) ----
     The static markup already has the brand row + Arabic eyebrow; injecting
     another English kicker + German micro-line duplicated the top heading
     and broke homepage spacing. Kept as a no-op so boot order is untouched. */
  function addHeroKicker() {
    return;
    try {
      var hero = doc.querySelector(".cmd-hero h1");
      if (!hero || doc.querySelector(".sv-kicker")) return;
      var k = doc.createElement("div");
      k.className = "sv-kicker";
      var latin = doc.createElement("span");
      latin.className = "sv-kicker-latin";
      latin.setAttribute("dir", "ltr");
      latin.setAttribute("lang", "en");
      latin.textContent = "Master German \u00B7 Build Your Future";
      k.appendChild(latin);
      hero.parentNode.insertBefore(k, hero);
      /* German editorial micro-line under CTAs (visual only, no i18n churn). */
      var sub = doc.querySelector(".cmd-hero .cmd-sub");
      if (sub && !doc.querySelector(".sv-de-line")) {
        var de = doc.createElement("div");
        de.className = "sv-de-line sv-de";
        de.setAttribute("dir", "ltr");
        de.setAttribute("lang", "de");
        de.textContent = "Deutsch lernen. Zukunft bauen.";
        sub.parentNode.insertBefore(de, sub.nextSibling);
      }
    } catch (e) {}
  }

  /* ---- 4. Mobile bottom navigation ----
     Single persistent bar with exactly the 5 primary destinations, in order:
     dashboard (الرئيسية) -> explain (الشرح) -> ankidroid (أنكي درويد) ->
     quiz (الاختبارات) -> review (مراجعة). Uses the existing showPage routing,
     registered once; active state syncs via MutationObserver (no polling,
     no duplicate handlers, no DOM rebuilds, no Back interference). */
  var BOTTOM = [
    { page: "dashboard", ar: "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629" },
    { page: "explain", ar: "\u0627\u0644\u0634\u0631\u062d" },
    { page: "ankidroid", ar: "\u0623\u0646\u0643\u064a \u062f\u0631\u0648\u064a\u062f" },
    { page: "quiz", ar: "\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a" },
    { page: "review", ar: "\u0645\u0631\u0627\u062c\u0639\u0629" }
  ];
  function currentPage() {
    try {
      var act = doc.querySelector("section.page.active");
      if (act && act.id.indexOf("page-") === 0) return act.id.slice(5);
    } catch (e) {}
    return "dashboard";
  }
  function go(page) {
    try {
      if (typeof window.showPage === "function") { window.showPage(page); return; }
    } catch (e) {}
    try {
      var btn = doc.querySelector('#mainNav .nav-item[data-page="' + page + '"]');
      if (btn) btn.click();
    } catch (e) {}
  }
  function buildBottomNav() {
    try {
      if (doc.querySelector(".sv-bottomnav")) return;
      /* Single-bar rule: index/academy ship the static .dm-bnav (#dmBnav).
         Do not create a second navigation layer on top of it. */
      if (doc.querySelector(".dm-bnav")) return;
      var bar = doc.createElement("nav");
      bar.className = "sv-bottomnav";
      bar.setAttribute("aria-label", "bottom");
      for (var i = 0; i < BOTTOM.length; i++) {
        (function (def) {
          var b = doc.createElement("button");
          b.type = "button";
          b.setAttribute("data-svpage", def.page);
          b.innerHTML = iconFor(def.page);
          var lb = doc.createElement("span");
          lb.textContent = def.ar;
          b.appendChild(lb);
          b.addEventListener("click", function () { go(def.page); });
          bar.appendChild(b);
        })(BOTTOM[i]);
      }
      doc.body.appendChild(bar);
      syncBottomNav();
      /* Zero-interference sync: observe page activation, never wrap showPage. */
      if ("MutationObserver" in window) {
        try {
          var mo = new MutationObserver(function () { syncBottomNav(); });
          var content = doc.querySelector(".content") || doc.body;
          mo.observe(content, { attributes: true, subtree: true, attributeFilter: ["class"] });
        } catch (e) {}
      }
    } catch (e) {}
  }
  function syncBottomNav() {
    try {
      var cur = currentPage();
      var btns = doc.querySelectorAll(".sv-bottomnav button");
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute("data-svpage") === cur;
        if (on) btns[i].classList.add("on");
        else btns[i].classList.remove("on");
        if (on) btns[i].setAttribute("aria-current", "page");
        else btns[i].removeAttribute("aria-current");
      }
    } catch (e) {}
  }

  /* ---- 4b. Bottom navigation auto-hide on scroll ----
     Visible state = normal fixed position. Hidden state = .sv-hidden
     (transform:translateY(110%) in CSS: fully below the viewport, no gap
     since the bar is position:fixed). Scroll direction decides the state;
     scrollY === 0 always forces visible. A small delta threshold plus a
     hide-after offset prevents flickering on tiny/rapid direction changes.
     Passive listener + rAF throttle: no work per raw scroll event, no touch
     interference, vertical only. Registered once; never wraps showPage so
     routing, active states and back-button behavior are untouched. */
  var SV_HIDE_AFTER = 120; /* meaningful downward travel before hiding */
  var SV_HIDE_DELTA = 10;  /* ignore sub-threshold jitter */
  function bottomBar() {
    try { return doc.querySelector(".sv-bottomnav"); } catch (e) { return null; }
  }
  function showBottomBar() {
    try {
      var bar = bottomBar();
      if (bar && bar.classList.contains("sv-hidden")) bar.classList.remove("sv-hidden");
    } catch (e) {}
  }
  function hideBottomBar() {
    try {
      var bar = bottomBar();
      if (bar && !bar.classList.contains("sv-hidden")) bar.classList.add("sv-hidden");
    } catch (e) {}
  }
  function wireBottomNavAutoHide() {
    try {
      if (window.__svBottomNavScrollWired) return;
      window.__svBottomNavScrollWired = true;
      /* Single-listener rule: the canonical .dm-bnav (#dmBnav) is managed by
         dm-ultimate.js. When it exists there is no .sv-bottomnav to manage,
         so register nothing here — one scroll listener total. */
      try { if (doc.querySelector(".dm-bnav")) return; } catch (e) {}
      var lastY = 0;
      var ticking = false;
      try {
        lastY = window.pageYOffset || doc.documentElement.scrollTop || 0;
      } catch (e) { lastY = 0; }
      /* Test seam: do not clobber the canonical .dm-bnav seam when it
         exists (dm-ultimate.js loads last and owns #dmBnav). Only provide
         fallback controls for the legacy .sv-bottomnav. */
      try {
        if (!window.DMBottomNav || !window.DMBottomNav.show) {
          window.DMBottomNav = window.DMBottomNav || {};
          window.DMBottomNav.show = showBottomBar;
          window.DMBottomNav.hide = hideBottomBar;
          window.DMBottomNav.isHidden = function () {
            try {
              var b = bottomBar();
              return !!(b && b.classList.contains("sv-hidden"));
            } catch (e2) { return false; }
          };
        }
      } catch (e) {}
      function update() {
        ticking = false;
        var y = 0;
        try { y = window.pageYOffset || doc.documentElement.scrollTop || 0; }
        catch (e) { y = 0; }
        /* Top of page: always visible (covers overscroll bounce y <= 0). */
        if (y <= 0) { showBottomBar(); lastY = y; return; }
        var dy = y - lastY;
        if (dy > SV_HIDE_DELTA && y > SV_HIDE_AFTER) hideBottomBar();
        else if (dy < -SV_HIDE_DELTA) showBottomBar();
        /* Advance the baseline only on meaningful moves so rapid direction
           flips around the threshold cannot flutter the bar. */
        if (Math.abs(dy) >= SV_HIDE_DELTA) lastY = y;
      }
      function onScroll() {
        if (ticking) return;
        ticking = true;
        try {
          if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(update);
          else setTimeout(update, 16);
        } catch (e) { ticking = false; }
      }
      try {
        window.addEventListener("scroll", onScroll, { passive: true });
      } catch (e) {
        try { window.addEventListener("scroll", onScroll); } catch (e2) {}
      }
    } catch (e) {}
  }

  /* ---- 5. Orbit: pause animation work while offscreen ---- */
  function guardOrbit() {
    try {
      var hero = doc.querySelector(".cmd-hero");
      var orbit = doc.getElementById("cmdOrbit");
      if (!hero || !orbit || !("IntersectionObserver" in window) || reduced) return;
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) hero.classList.remove("sv-paused");
          else hero.classList.add("sv-paused");
        }
      }, { threshold: 0.05 });
      io.observe(orbit);
    } catch (e) {}
  }

  /* ---- boot (idle, never blocks first paint) ---- */
  function boot() {
    upgradeSidebar();
    upgradeFeatureTiles();
    addHeroKicker();
    buildBottomNav();
    wireBottomNavAutoHide();
    guardOrbit();
    try { doc.documentElement.classList.add("sv-on"); } catch (e) {}
  }
  if ("requestIdleCallback" in window) {
    try { window.requestIdleCallback(boot, { timeout: 1500 }); }
    catch (e) { setTimeout(boot, 80); }
  } else {
    setTimeout(boot, 80);
  }
})();
