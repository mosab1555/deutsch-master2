/* Deutsch Master — ULTIMATE behavior (dm-ultimate.js)
   Additive only. Never replaces router/storage/audio/auth/sync.
   1) bottom-nav active sync (wraps showPage, flag-guarded)
   2) hide-on-scroll-down / show-on-up (rAF, transform only)
   3) orbit progress var (--dm-orbit-p) mirror
   4) audio local playing state (no card animation)
   5) reveal on scroll (IntersectionObserver, transform/opacity only) */
(function () {
  "use strict";
  if (window.__dmUltimateInit) return;
  window.__dmUltimateInit = true;

  /* ---------- 1 · bottom nav sync ---------- */
  function syncBnav(name) {
    try {
      document.querySelectorAll(".dm-bnav-item").forEach(function (b) {
        b.classList.toggle("active", b.dataset.page === name);
        b.setAttribute("aria-current", b.dataset.page === name ? "page" : "false");
      });
      // mirror badge counts from sidebar badges
      var map = { review: "navReviewBadge", mistakes: "navMistBadge", favorites: "navFavBadge" };
      Object.keys(map).forEach(function (k) {
        var src = document.getElementById(map[k]);
        var dst = document.querySelector('.dm-bnav-item[data-page="' + k + '"] .dm-bnav-badge');
        if (src && dst) {
          var v = (src.textContent || "0").trim();
          dst.textContent = v;
          dst.classList.toggle("zero", v === "0" || v === "");
        }
      });
    } catch (e) {}
  }
  function bindBnav() {
    document.querySelectorAll(".dm-bnav-item").forEach(function (b) {
      if (b.__dmWired) return;
      b.__dmWired = true;
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-page");
        try {
          if (typeof window.showPage === "function") window.showPage(name);
          else {
            document.querySelectorAll(".page").forEach(function (p) {
              p.classList.toggle("active", p.id === "page-" + name);
            });
            syncBnav(name);
          }
        } catch (e) {}
      });
    });
  }
  function wrapShowPage() {
    try {
      if (typeof window.showPage === "function" && !window.showPage.__dmUltimateWrapped) {
        var prev = window.showPage;
        var next = function (name) {
          var r = prev.apply(this, arguments);
          syncBnav(name);
          return r;
        };
        next.__dmUltimateWrapped = true;
        // copy prior flags so outermost wrappers keep working
        for (var k in prev) { try { next[k] = prev[k]; } catch (e) {} }
        window.showPage = next;
      }
    } catch (e) {}
  }

  /* ---------- 2 · hide on scroll down ----------
     Smooth slide via CSS transform (see .dm-bnav in dm-ultimate.css).
     Scroll direction decides the state; near-top always forces visible.
     Small delta threshold + hide-after offset prevent flickering on tiny
     or rapid direction changes. Passive listener + rAF throttle: no work
     per raw scroll event, vertical only, element stays in DOM. */
  var bnav = null, lastY = 0, ticking = false;
  var DM_HIDE_AFTER = 80; /* meaningful downward travel before hiding */
  var DM_HIDE_DELTA = 6;  /* ignore sub-threshold jitter */
  function showBnav() {
    try {
      if (!bnav) return;
      bnav.classList.remove("hide");
      bnav.classList.remove("is-hidden");
    } catch (e) {}
  }
  function hideBnav() {
    try {
      if (bnav && !bnav.classList.contains("hide") && !bnav.classList.contains("is-hidden")) bnav.classList.add("hide");
    } catch (e) {}
  }
  function onScroll() {
    ticking = false;
    if (!bnav) return;
    var y = 0;
    try { y = window.scrollY || document.documentElement.scrollTop || 0; }
    catch (e) { y = 0; }
    /* Top of page: always visible (covers overscroll bounce y <= 0). */
    if (y < DM_HIDE_AFTER) { showBnav(); lastY = y; return; }
    var dy = y - lastY;
    if (dy > DM_HIDE_DELTA) hideBnav();
    else if (dy < -DM_HIDE_DELTA) showBnav();
    /* Advance the baseline only on meaningful moves so rapid direction
       flips around the threshold cannot flutter the bar. */
    if (Math.abs(dy) >= DM_HIDE_DELTA) lastY = y;
  }
  function requestTick() {
    if (ticking) return;
    ticking = true;
    try {
      if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(onScroll);
      else window.setTimeout(onScroll, 16);
    } catch (e) { ticking = false; }
  }
  function bindScroll() {
    bnav = document.getElementById("dmBnav");
    if (!bnav) return;
    try { lastY = window.scrollY || document.documentElement.scrollTop || 0; }
    catch (e) { lastY = 0; }
    /* Test seam (no behavior change): DMBottomNav.show/hide/isHidden. */
    try {
      window.DMBottomNav = window.DMBottomNav || {};
      window.DMBottomNav.show = showBnav;
      window.DMBottomNav.hide = hideBnav;
      window.DMBottomNav.isHidden = function () {
        try { return !!(bnav && (bnav.classList.contains("hide") || bnav.classList.contains("is-hidden"))); }
        catch (e2) { return false; }
      };
    } catch (e) {}
    try {
      window.addEventListener("scroll", requestTick, { passive: true });
    } catch (e) {
      try { window.addEventListener("scroll", requestTick); } catch (_) {}
    }
  }

  /* ---------- 3 · orbit progress mirror ---------- */
  function mirrorOrbit() {
    try {
      var pct = document.getElementById("heroProgressPct");
      var core = document.getElementById("hmRing");
      if (pct && core) {
        var v = parseFloat((pct.textContent || "0").replace("%", "")) || 0;
        core.style.setProperty("--dm-orbit-p", (v / 100).toFixed(3) + "turn");
        core.setAttribute("aria-valuenow", String(Math.round(v)));
        var label = core.querySelector(".orbit-pct");
        if (label) label.textContent = Math.round(v) + "%";
      }
    } catch (e) {}
  }

  /* ---------- 4 · audio local state ---------- */
  function bindAudio() {
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-say-word],[data-say-sent],.say-btn,.audio-btn");
      if (!t) return;
      t.classList.add("playing");
      window.setTimeout(function () { t.classList.remove("playing"); }, 950);
    }, { passive: true });
    // speech end -> clear all playing states
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.addEventListener
          ? window.speechSynthesis.addEventListener("end", clearPlaying)
          : null;
      }
    } catch (e) {}
  }
  function clearPlaying() {
    document.querySelectorAll(".playing").forEach(function (el) {
      if (el.matches("[data-say-word],[data-say-sent],.say-btn,.audio-btn,.btn")) el.classList.remove("playing");
    });
  }

  /* ---------- 5 · reveal ---------- */
  function bindReveal() {
    try {
      if (!("IntersectionObserver" in window)) return;
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.08 });
      document.querySelectorAll(".reveal:not(.in)").forEach(function (el) { io.observe(el); });
    } catch (e) {}
  }

  /* ---------- 6 · header height sync ----------
     The fixed topbar wraps to one or two rows depending on viewport width,
     auth/sync UI state and font size, so no static --dm-header-h token can be
     exact everywhere. Measure the real box and publish it: .main padding-top
     and sticky offsets (e.g. .anki-toolbar) follow automatically. Cheap by
     design: one read + one write per trigger, writes only on >=1px change,
     no observers, no loops. */
  var _lastHeaderH = -1;
  function syncHeaderH() {
    try {
      var h = document.getElementById("dmTopHeader");
      if (!h) return;
      var v = Math.ceil(h.getBoundingClientRect().height) || 0;
      if (v <= 0 || v > 400) return;
      if (v === _lastHeaderH) return;
      _lastHeaderH = v;
      document.documentElement.style.setProperty("--dm-header-h", v + "px");
    } catch (e) {}
  }
  var _hhT = null;
  function syncHeaderSoon() {
    try {
      if (_hhT) return;
      _hhT = window.setTimeout(function () { _hhT = null; syncHeaderH(); }, 150);
    } catch (e) { syncHeaderH(); }
  }

  function init() {
    bindBnav();
    wrapShowPage();
    bindScroll();
    bindAudio();
    bindReveal();
    syncHeaderH();
    // auth/sync UI settles async after boot; re-sync a few times, then stop.
    window.setTimeout(syncHeaderH, 800);
    window.setTimeout(syncHeaderH, 2500);
    try {
      window.addEventListener("resize", syncHeaderSoon, { passive: true });
    } catch (e) {
      try { window.addEventListener("resize", syncHeaderSoon); } catch (_) {}
    }
    // initial sync from current active page
    var active = document.querySelector(".nav-item.active");
    syncBnav(active ? active.dataset.page : "dashboard");
    mirrorOrbit();
    window.setTimeout(mirrorOrbit, 1500);
    window.setTimeout(function () { wrapShowPage(); bindBnav(); mirrorOrbit(); }, 2500);
    // keep badges fresh (cheap 5s poll, no storage reads — DOM only)
    window.setInterval(syncBnav.bind(null, (document.querySelector(".dm-bnav-item.active") || {}).dataset
      ? document.querySelector(".dm-bnav-item.active").dataset.page : "dashboard"), 5000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
