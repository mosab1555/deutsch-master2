/* Deutsch Master — Android back-button manager (SINGLE authoritative handler).
 *
 * Double-back-to-exit behavior for the Android/Capacitor app:
 *   Priority 1 — a visible overlay (lightbox / preview / menu / modal /
 *                search dropdown / sidebar drawer) is open: close that single
 *                top-most element. Never exit, never navigate.
 *   Priority 2 — meaningful in-app history exists: navigate to the previous
 *                internal page via the existing showPage() system (scroll
 *                restoration, page-state and rendering all flow through the
 *                untouched existing chain). Never exit, never reload.
 *   Priority 3 — already at the home/root page: first Back shows a brief
 *                toast ("اضغط رجوع مرة أخرى للخروج" / "Press back again to
 *                exit"); a second Back within ~2000ms performs the normal
 *                application exit. After the window expires a Back press
 *                only shows the toast again.
 *
 * Routing safety: this file only WRAPS showPage() (once) to observe page
 * names into a small in-memory stack. It never touches route names, URLs,
 * page ids, content, storage schemas, auth, sync, XP/streak/progress/SRS,
 * audio, PWA caching or the service worker. No history.pushState /
 * replaceState here, no popstate interception — browser/PWA back behavior
 * is left completely native.
 *
 * Capacitor integration: when the official App plugin is present at runtime
 * its `backButton` event is used as the native Back source (no competing
 * manager, no new dependency). A legacy Cordova-style `backbutton` listener
 * is also registered once (fires only inside native wrappers). Escape closes
 * an open overlay on desktop for parity and never navigates.
 *
 * Public API: window.DMBack.handleBack() -> "overlay-closed" | "navigated" |
 * "exit-toast" | "exit". window.DMBack.isAtRoot(), .resetExit(),
 * .stackSnapshot(), .EXIT_WINDOW_MS.
 */
(function () {
"use strict";

/* Already installed (double script include / HMR): keep ONE manager. */
if (typeof window !== "undefined" && window.__dmBackInit) return;
try { if (typeof window !== "undefined") window.__dmBackInit = true; } catch (e) {}

var HOME = "dashboard";
var EXIT_WINDOW_MS = 2000;
var MAX_STACK = 50;

var stack = [HOME];      /* in-app page history, oldest -> newest */
var _suppress = false;   /* true while handleBack drives showPage itself */
var _lastBackAt = 0;     /* timestamp of the last root-level Back press */
var _exitTimer = null;   /* expiry timer for the double-back window */
var _capWired = false;   /* Capacitor backButton listener registered */
var _cordWired = false;  /* legacy backbutton listener registered */
var _escWired = false;   /* desktop Escape listener registered */
var _wrapTried = false;

/* ---------------- small helpers (all guarded) ---------------- */
function $(id) { try { return document.getElementById(id) || null; } catch (e) { return null; } }
function validPage(name) {
  if (!name || typeof name !== "string") return false;
  if (!/^[a-z0-9-]{2,24}$/.test(name)) return false;
  try { return !!document.querySelector("#page-" + name); } catch (e) { return false; }
}
function activePage() {
  try {
    var a = document.querySelector(".page.active");
    if (a && a.id && a.id.indexOf("page-") === 0) {
      var n = a.id.slice(5);
      if (validPage(n)) return n;
    }
  } catch (e) {}
  try {
    if (window.DMPageState && typeof window.DMPageState.current === "string" && validPage(window.DMPageState.current))
      return window.DMPageState.current;
  } catch (e2) {}
  return null;
}
function currentPage() {
  var p = activePage();
  if (p) return p;
  try { if (stack.length && validPage(stack[stack.length - 1])) return stack[stack.length - 1]; } catch (e) {}
  return HOME;
}
function pushPage(name) {
  if (!validPage(name)) return;
  if (stack[stack.length - 1] === name) return;
  stack.push(name);
  if (stack.length > MAX_STACK) stack.splice(1, stack.length - MAX_STACK); /* keep root at [0] */
}
/* Reconcile out-of-band navigation (auth flow, direct class toggles): the
   visible page wins — truncate to it when known, otherwise adopt it. */
function syncStack() {
  var cur = currentPage();
  var idx = stack.lastIndexOf(cur);
  if (idx >= 0) { try { stack.length = idx + 1; } catch (e) {} }
  else pushPage(cur);
}

/* ---------------- Priority 1: top-most overlay ----------------
 * Highest-z first; exactly ONE element is closed per Back press. */
function closeTopOverlay() {
  var el, btn;
  /* 1. AnkiDroid image lightbox (z-index 9999, body-level). */
  try {
    el = $("ankiLightbox") || document.querySelector("[data-amedialightbox]");
    if (el) { el.remove(); return true; }
  } catch (e) {}
  /* 2. AnkiDroid card preview sheet (z-index 9000). */
  try {
    if ($("ankiPreview") || document.querySelector(".anki-preview-ov")) {
      if (window.AnkiDroid && typeof window.AnkiDroid.closeCardPreview === "function") {
        try { window.AnkiDroid.closeCardPreview(); } catch (e2) { var p = $("ankiPreview"); if (p) p.remove(); }
      } else {
        var pv = $("ankiPreview") || document.querySelector(".anki-preview-ov");
        if (pv) pv.remove();
      }
      return true;
    }
  } catch (e) {}
  /* 3. AnkiDroid deck ⋮ menu: toggle-close through its own button so the
     internal menu state (anchor/cleanup/aria) is released correctly. */
  try {
    if ($("ankiMenu") || document.querySelector(".anki-menu")) {
      btn = document.querySelector('.anki-menu-btn[aria-expanded="true"]');
      if (btn && typeof btn.click === "function") { try { btn.click(); } catch (e2) {} }
      else {
        var m = $("ankiMenu") || document.querySelector(".anki-menu");
        if (m) m.remove();
        try {
          var bs = document.querySelectorAll('.anki-menu-btn[aria-expanded="true"]');
          for (var i = 0; i < bs.length; i++) bs[i].setAttribute("aria-expanded", "false");
        } catch (e3) {}
      }
      return true;
    }
  } catch (e) {}
  /* 4. App modals (detail above add-word: one per press). */
  try {
    var det = $("detailModal"), word = $("wordModal");
    if (det && !det.classList.contains("hidden")) { det.classList.add("hidden"); return true; }
    if (word && !word.classList.contains("hidden")) { word.classList.add("hidden"); return true; }
  } catch (e) {}
  /* 5. Global search dropdown (hide only — keep the user's query). */
  try {
    var sr = $("searchResults");
    if (sr && sr.classList.contains("show")) { sr.classList.remove("show"); return true; }
  } catch (e) {}
  /* 6. Sidebar drawer — single authority is window.DMDrawer (script.js). */
  try {
    var isOpen = false;
    if (window.DMDrawer && typeof window.DMDrawer.isOpen === "function") {
      try { isOpen = !!window.DMDrawer.isOpen(); } catch (e2) { isOpen = false; }
    } else {
      var sb = $("sidebar");
      isOpen = !!(sb && sb.classList.contains("open"));
    }
    if (isOpen) {
      if (window.DMDrawer && typeof window.DMDrawer.close === "function") {
        try { window.DMDrawer.close(); } catch (e2) {}
      } else {
        try { $("sidebar") && $("sidebar").classList.remove("open"); } catch (e3) {}
        try { $("sidebarOverlay") && $("sidebarOverlay").classList.remove("show"); } catch (e4) {}
        try { document.body.classList.remove("drawer-open"); } catch (e5) {}
      }
      return true;
    }
  } catch (e) {}
  return false;
}

/* ---------------- toast (existing system only) ---------------- */
function exitMessage() {
  try {
    var lang = "";
    if (window.S && window.S.uiLang) lang = String(window.S.uiLang);
    else if (document.documentElement) lang = document.documentElement.getAttribute("lang") || "";
    if (lang.toLowerCase().indexOf("en") === 0) return "Press back again to exit";
  } catch (e) {}
  return "اضغط رجوع مرة أخرى للخروج";
}
function toastOnce(msg) {
  /* Refresh semantics: an identical stale toast is replaced so every
     first-press visibly re-shows the confirmation for a full duration,
     while never stacking duplicates. */
  try {
    var box = $("toasts");
    if (box && box.children) {
      for (var i = box.children.length - 1; i >= 0; i--) {
        try { if (box.children[i].textContent === msg) box.children[i].remove(); } catch (e) {}
      }
    }
  } catch (e) {}
  try {
    if (typeof window.toast === "function") { window.toast(msg); return; }
    if (typeof toast === "function") { toast(msg); return; }
  } catch (e) {}
}

/* ---------------- exit ---------------- */
function clearExitWindow() {
  _lastBackAt = 0;
  if (_exitTimer) { try { clearTimeout(_exitTimer); } catch (e) {} _exitTimer = null; }
}
function armExitWindow() {
  if (_exitTimer) { try { clearTimeout(_exitTimer); } catch (e) {} _exitTimer = null; }
  try {
    _exitTimer = setTimeout(function () { _lastBackAt = 0; _exitTimer = null; }, EXIT_WINDOW_MS + 50);
  } catch (e) { _exitTimer = null; }
}
/* Best-effort native exit. In a plain browser tab there is no exit API on
   purpose — the return value still reports the user's intent ("exit"). */
function doNativeExit() {
  try {
    var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && typeof App.exitApp === "function") { try { App.exitApp(); } catch (e) {} return true; }
  } catch (e) {}
  try {
    if (window.navigator && window.navigator.app && typeof window.navigator.app.exitApp === "function") {
      try { window.navigator.app.exitApp(); } catch (e2) {}
      return true;
    }
  } catch (e) {}
  return false;
}

/* ---------------- core: ONE decision point ---------------- */
function handleBack(/* source: "capacitor" | "backbutton" | "escape" | "manual" */) {
  /* Priority 1 — close the open overlay, nothing else. */
  try { if (closeTopOverlay()) { clearExitWindow(); return "overlay-closed"; } } catch (e) {}
  /* Priority 2 — meaningful in-app history: go back inside the app. */
  try {
    syncStack();
    if (stack.length > 1) {
      stack.pop();
      var target = stack[stack.length - 1];
      clearExitWindow();
      _suppress = true;
      try {
        if (typeof window.showPage === "function") window.showPage(target);
        else if (typeof showPage === "function") showPage(target);
      } catch (e2) {}
      _suppress = false;
      return "navigated";
    }
  } catch (e) {}
  /* Priority 3 — at root/home: double-back-to-exit. */
  try {
    var now = Date.now();
    if (_lastBackAt && (now - _lastBackAt) <= EXIT_WINDOW_MS) {
      clearExitWindow();
      doNativeExit();
      return "exit";
    }
    _lastBackAt = now;
    toastOnce(exitMessage());
    armExitWindow();
    return "exit-toast";
  } catch (e) {}
  return "exit-toast";
}
function isAtRoot() {
  try {
    syncStack();
    return currentPage() === HOME && stack.length <= 1;
  } catch (e) { return false; }
}

/* ---------------- observe navigation (wrap showPage ONCE) ---------------- */
function copyFlags(from, to) {
  try {
    for (var k in from) {
      try { if (Object.prototype.hasOwnProperty.call(from, k)) to[k] = from[k]; } catch (e) {}
    }
  } catch (e) {}
}
function wrapShowPage() {
  try {
    var prev = (typeof window !== "undefined" && typeof window.showPage === "function")
      ? window.showPage
      : (typeof showPage === "function" ? showPage : null);
    if (typeof prev !== "function") return false;
    if (prev.__dmBackWrapped) return true;
    var wrapped = function (name) {
      if (!_suppress) { try { pushPage(name); } catch (e) {} }
      return prev.apply(this, arguments);
    };
    copyFlags(prev, wrapped);
    try { wrapped.__dmBackWrapped = true; } catch (e) {}
    try {
      if (typeof window !== "undefined") window.showPage = wrapped;
      else showPage = wrapped;
    } catch (e) { return false; }
    try { showPage = wrapped; } catch (e2) {}
    return true;
  } catch (e) { return false; }
}

/* ---------------- wiring (native sources only) ---------------- */
function onNativeBack(ev) {
  var r = "exit-toast";
  try { r = handleBack("capacitor"); } catch (e) {}
  /* Swallow the system default once we handled it (prevents a racing
     instant exit while the toast / bridge exit is in charge). */
  try { if (ev && typeof ev.preventDefault === "function") ev.preventDefault(); } catch (e2) {}
  return r;
}
function wireCapacitor() {
  if (_capWired) return true;
  try {
    var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && typeof App.addListener === "function") {
      _capWired = true;
      try {
        var p = App.addListener("backButton", function () { onNativeBack(null); });
        if (p && typeof p.catch === "function") p.catch(function () { _capWired = false; });
      } catch (e) { _capWired = false; return false; }
      return true;
    }
  } catch (e) {}
  return false;
}
function wireCordova() {
  if (_cordWired) return;
  try {
    document.addEventListener("backbutton", onNativeBack, false);
    _cordWired = true;
  } catch (e) {}
}
function wireEscape() {
  if (_escWired) return;
  try {
    document.addEventListener("keydown", function (e) {
      try {
        var k = e && (e.key || e.keyCode);
        if (k === "Escape" || k === "Esc" || k === 27) {
          if (closeTopOverlay()) { try { e.preventDefault(); } catch (e2) {} }
        }
      } catch (e3) {}
    });
    _escWired = true;
  } catch (e) {}
}
function boot() {
  try { syncStack(); } catch (e) {}
  if (!wrapShowPage() && !_wrapTried) {
    _wrapTried = true;
    try {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          try { wrapShowPage(); } catch (e) {}
          try { wireCapacitor(); } catch (e2) {}
        });
      } else {
        setTimeout(function () { try { wrapShowPage(); } catch (e) {} }, 300);
      }
    } catch (e) {}
  }
  wireCordova();
  wireEscape();
  wireCapacitor();
  /* One deferred retry: the Capacitor bridge can appear after web content
     starts (cold start). Single shot, self-clearing — no polling. */
  if (!_capWired) {
    try {
      setTimeout(function () { try { wireCapacitor(); } catch (e) {} }, 2500);
    } catch (e) {}
  }
}

/* ---------------- public API + test seams ---------------- */
var API = {
  handleBack: handleBack,
  closeTopOverlay: closeTopOverlay,
  currentPage: currentPage,
  isAtRoot: isAtRoot,
  resetExit: clearExitWindow,
  exitMessage: exitMessage,
  stackSnapshot: function () { try { return stack.slice(); } catch (e) { return [HOME]; } },
  EXIT_WINDOW_MS: EXIT_WINDOW_MS,
  HOME: HOME,
  __resetForTests: function () {
    try { stack.length = 0; stack.push(HOME); } catch (e) {}
    clearExitWindow();
  }
};
try {
  if (typeof window !== "undefined") window.DMBack = API;
} catch (e) {}
try { if (typeof module !== "undefined" && module.exports) module.exports = API; } catch (e) {}

try { boot(); } catch (e) {}
try {
  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { try { boot(); } catch (e) {} });
  }
} catch (e) {}

})();
