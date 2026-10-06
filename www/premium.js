/* Deutsch Master — premium interaction layer (additive only).
   - Command palette (Ctrl+K) over the EXISTING sidebar pages (source of truth).
   - Reveal choreography (idempotent; respects prefers-reduced-motion).
   - Subtle magnetic feedback on primary CTAs (fine pointers only).
   - aria-current sync for the active nav item.
   Reads DOM + calls existing showPage(). Never touches storage, data, audio. */
(function () {
  "use strict";
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function go(page) { try { if (typeof showPage === "function") { showPage(page); return; } } catch (e) {}
    try { var b = document.querySelector('.nav-item[data-page="' + page + '"]'); if (b) b.click(); } catch (e2) {} }

  /* ---------- reveal choreography (idempotent) ---------- */
  try {
    var els = document.querySelectorAll(".reveal:not(.visible)");
    if ("IntersectionObserver" in window && !reduceMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
      els.forEach(function (el) { io.observe(el); });
    } else { els.forEach(function (el) { el.classList.add("visible"); }); }
  } catch (e) {}

  /* ---------- aria-current sync ---------- */
  try {
    var nav = $("mainNav");
    var sync = function () {
      try {
        nav.querySelectorAll(".nav-item").forEach(function (b) {
          if (b.classList.contains("active")) b.setAttribute("aria-current", "page");
          else b.removeAttribute("aria-current");
        });
      } catch (e) {}
    };
    sync();
    if ("MutationObserver" in window && nav) {
      var mo = new MutationObserver(sync);
      mo.observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  } catch (e) {}

  /* ---------- magnetic primary CTAs (subtle, fine pointers) ---------- */
  try {
    if (!reduceMotion && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
      document.querySelectorAll(".cmd-cta .btn-primary, .cmd-final .btn-primary").forEach(function (btn) {
        var raf = 0;
        btn.addEventListener("pointermove", function (ev) {
          if (raf) return;
          raf = requestAnimationFrame(function () {
            raf = 0;
            try {
              var r = btn.getBoundingClientRect();
              var dx = (ev.clientX - (r.left + r.width / 2)) / r.width;
              var dy = (ev.clientY - (r.top + r.height / 2)) / r.height;
              btn.style.transform = "translate(" + (dx * 5).toFixed(1) + "px," + (dy * 4 - 2).toFixed(1) + "px)";
            } catch (e2) {}
          });
        });
        btn.addEventListener("pointerleave", function () { btn.style.transform = ""; });
      });
    }
  } catch (e) {}

  /* ---------- command palette ---------- */
  var pal = $("dmPal"), input = $("dmPalInput"), list = $("dmPalList"), openBtn = $("paletteBtn");
  if (!pal || !input || !list) return;
  var items = [], sel = 0, lastFocus = null;

  function collect() {
    items = [];
    try {
      document.querySelectorAll('#mainNav .nav-item[data-page]').forEach(function (b) {
        var page = b.getAttribute("data-page");
        var label = (b.textContent || page).replace(/\s+/g, " ").trim();
        var ico = "";
        try { var s = b.querySelector(".nav-ico"); if (s) ico = s.innerHTML; } catch (e) {}
        items.push({ page: page, label: label, ico: ico });
      });
    } catch (e) {}
  }
  function render(q) {
    q = (q || "").trim();
    var shown = items.filter(function (it) {
      if (!q) return true;
      return it.label.indexOf(q) !== -1 || it.page.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }).slice(0, 12);
    if (sel >= shown.length) sel = 0;
    list.innerHTML = shown.map(function (it, i) {
      var safe = it.label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return '<button type="button" role="option" aria-selected="' + (i === sel) + '" class="dm-pal-item' +
        (i === sel ? " sel" : "") + '" data-i="' + i + '"><span class="nav-ico" aria-hidden="true">' +
        it.ico + '</span><span>' + safe + '</span><small>' + it.page + '</small></button>';
    }).join("") || '<div class="empty-state"><b>لا نتائج</b><span>جرّب كلمة أخرى</span></div>';
    list.querySelectorAll(".dm-pal-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var it = shown[+b.getAttribute("data-i")];
        close(); if (it) go(it.page);
      });
      b.addEventListener("mousemove", function () {
        list.querySelectorAll(".dm-pal-item").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel"); sel = +b.getAttribute("data-i");
      });
    });
    list._shown = shown;
  }
  function open() {
    collect(); sel = 0;
    try { lastFocus = document.activeElement; } catch (e) {}
    pal.classList.remove("hidden"); input.value = ""; render("");
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
  }
  function close() {
    pal.classList.add("hidden");
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  function isOpen() { return !pal.classList.contains("hidden"); }
  try { if (openBtn) openBtn.addEventListener("click", open); } catch (e) {}
  try {
    document.addEventListener("keydown", function (ev) {
      var k = (ev.key || "").toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === "k") { ev.preventDefault(); isOpen() ? close() : open(); return; }
      if (!isOpen()) return;
      if (ev.key === "Escape") { close(); }
      else if (ev.key === "ArrowDown") { ev.preventDefault(); sel = Math.min(sel + 1, (list._shown || []).length - 1); render(input.value); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); sel = Math.max(sel - 1, 0); render(input.value); }
      else if (ev.key === "Enter") {
        var it = (list._shown || [])[sel];
        close(); if (it) go(it.page);
      }
    });
    input.addEventListener("input", function () { sel = 0; render(input.value); });
    pal.addEventListener("click", function (ev) { if (ev.target === pal) close(); });
  } catch (e) {}
})();

/* Deutsch Master — domain flag (additive): mirrors the active page into
   body[data-dmpage] so CSS can color-code each section. Read-only;
   never calls showPage, never touches storage. */
(function () {
  "use strict";
  function sync() {
    try {
      var active = document.querySelector(".page.active");
      var page = active ? (active.id || "").replace(/^page-/, "") : "dashboard";
      if (document.body.getAttribute("data-dmpage") !== page) {
        document.body.setAttribute("data-dmpage", page);
      }
    } catch (e) {}
  }
  try {
    sync();
    var content = document.querySelector(".content");
    if ("MutationObserver" in window && content) {
      new MutationObserver(sync).observe(content, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }
    document.addEventListener("click", function () { setTimeout(sync, 60); }, true);
  } catch (e) {}
})();
