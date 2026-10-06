/* ==========================================================================
   Deutsch Master — LUX engine (perf + motion, additive only)
   - ONE IntersectionObserver for luxury reveals (transform/opacity only)
   - ONE rAF-throttled passive scroll listener (header depth only)
   - Idle-time boot, cached refs, zero intervals, zero innerHTML,
     no behavior/content/storage changes. Safe to load last.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__lxInit) return;
  window.__lxInit = true;

  var doc = document;
  var reduced = false;
  try {
    reduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { reduced = false; }

  /* ---------- idle boot: hero choreography + reveal tagging ---------- */
  function boot() {
    try { doc.body.classList.add("lx-ready"); } catch (e) {}
    tagReveals();
    lazyImages();
  }
  if ("requestIdleCallback" in window) {
    try { window.requestIdleCallback(boot, { timeout: 1200 }); }
    catch (e) { setTimeout(boot, 60); }
  } else {
    setTimeout(boot, 60);
  }

  /* Tag a small curated set of static blocks for staggered reveal.
     Dynamic lists are animated CSS-only (page-activation choreography),
     so we never need MutationObservers or re-scans. */
  var RV_SEL = ".cmd-sec-head,.cmd-next,.cmd-mission,.cmd-spot,.cmd-mini," +
    ".cmd-pgrid,.cmd-method,.cmd-final,.orbit-detail,.page-head";
  function tagReveals() {
    if (reduced) return;
    var nodes;
    try { nodes = doc.querySelectorAll(RV_SEL); } catch (e) { return; }
    if (!nodes || !nodes.length) return;
    if (!("IntersectionObserver" in window)) return; /* CSS keeps them visible */
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.hasAttribute("data-lx-rv")) continue;
      n.setAttribute("data-lx-rv", "");
      lxObserver.observe(n);
    }
  }

  /* Single shared observer: reveal once, then unobserve (no re-work). */
  var lxObserver = null;
  try {
    lxObserver = ("IntersectionObserver" in window) ? new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var en = entries[i];
          if (en.isIntersecting) {
            try { en.target.classList.add("lx-in"); } catch (e) {}
            try { lxObserver.unobserve(en.target); } catch (e) {}
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px 8% 0px" }
    ) : null;
  } catch (e) { lxObserver = null; }

  /* ---------- header depth: 1 passive scroll listener, rAF-throttled ---------- */
  var topbar = null, ticking = false, scrolled = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 32); };
    raf(function () {
      ticking = false;
      if (!topbar) {
        try { topbar = doc.querySelector(".topbar"); } catch (e) {}
        if (!topbar) return;
      }
      var y = 0;
      try {
        y = window.pageYOffset || doc.documentElement.scrollTop || doc.body.scrollTop || 0;
      } catch (e) {}
      var s = y > 8;
      if (s !== scrolled) {
        scrolled = s;
        try { topbar.classList.toggle("is-scrolled", s); } catch (e) {}
      }
    });
  }
  try {
    window.addEventListener("scroll", onScroll, { passive: true, capture: false });
  } catch (e) {
    window.addEventListener("scroll", onScroll);
  }

  /* ---------- images: native lazy path (no JS carousel, no layout shift) ---------- */
  function lazyImages() {
    var imgs;
    try { imgs = doc.querySelectorAll('img[src*="img/words/"]'); } catch (e) { return; }
    for (var i = 0; i < imgs.length; i++) {
      try {
        if (!imgs[i].hasAttribute("loading")) imgs[i].setAttribute("loading", "lazy");
        if (!imgs[i].hasAttribute("decoding")) imgs[i].setAttribute("decoding", "async");
      } catch (e) {}
    }
  }

  /* Note: sidebar drawer + overlay are already handled in script.js
     (transform-based CSS drawer). Nothing duplicated here by design. */
})();
