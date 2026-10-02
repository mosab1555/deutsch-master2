/* Deutsch Master — Page/section state preservation (ADDITIVE ONLY, central system).
 *
 * Goal: leaving a section and returning later must feel like the user never
 * left it — same scroll position, same search/filters/tabs, same opened
 * topic/lesson/card, same in-progress training view.
 *
 * How it works (single system, no competing mechanisms):
 *  1. This file loads LAST (after home.js) and wraps `showPage` ONCE, outermost.
 *     Every navigation therefore flows through DMPageState.navigate():
 *       capture(outgoing: scroll + fields + tabs + light custom state)
 *       -> run the original showPage chain (all module wrappers/renderers)
 *       -> restore(incoming: re-apply persisted state on first visit after a
 *          refresh, restore scroll position otherwise).
 *  2. Destructive re-renders (reference home, training homes, games, tutor,
 *     listen/speak/...) are SKIPPED on return visits via DMPageState.skipRender(),
 *     guarded by one-line checks in each module wrapper. First visits and
 *     user-initiated actions (buttons, filters) always render normally.
 *  3. Scroll is restored instantly (no smooth-scroll-to-top flicker) only after
 *     the target content exists, clamped to the real content height.
 *  4. Safe state (filters, tabs, topics, flash position, quiz setup) is also
 *     persisted to localStorage (versioned + validated). Active training/quiz
 *     mid-session answers are NEVER persisted — after a refresh the user gets
 *     a clean setup instead of a corrupted session.
 *  5. Browser history is untouched (no pushState/replaceState here), PWA works
 *     through the same code path, no layout/CSS changes.
 *
 * Public API (also exposed as globals for tests):
 *   DMPageState.navigate(name, prev)  — outermost showPage wrapper body
 *   DMPageState.capture(page)         — snapshot live state into memory
 *   DMPageState.restoreScroll(page,y) — clamped instant scroll restore
 *   DMPageState.savePageState()       — flush memory -> localStorage (debounced)
 *   DMPageState.clearPageState(page?)  — drop memory+persisted for page (or all)
 *   DMPageState.skipRender(page)      — true when a nav-return must keep live DOM
 *   DMPageState.willRestore(name)     — true when script.js should skip scroll-to-top
 */
(function () {
"use strict";

var LS_KEY = "deutsch_master_pagestate_v1";
var SCHEMA_V = 1;
var MAX_SCROLL = 20000;
var MAX_FIELD_LEN = 200;
var MAX_FIELDS = 60;

/* Pages whose navigation render must ALWAYS run (fresh summaries / idempotent
   lists). They are never skipped, so progress numbers can never go stale. */
var NEVER_SKIP = {
  dashboard: 1, profile: 1, analytics: 1, stats: 1, mistakes: 1, review: 1,
  favorites: 1, planner: 1, settings: 1, quiz: 1, me: 1, job: 1, ach: 1, roadmap: 1
};

/* Field ids persisted across refresh (search / filter / level drafts).
   Anything else (answers, order chips, write inputs) is session-only. */
function persistableField(id) {
  if (!id) return false;
  var s = String(id);
  if (/^(vocabSearch|sentenceSearch|verbSearch|refSearch|gramSearchIn|tutorIn|globalSearch|howtoSearch)$/.test(s)) return true;
  if (/(filter|Category|Type|Status|Article|Kapitel|Level|Skill|Diff|Kind|Mode|Tab)$/.test(s)) return true;
  if (/^(flashCategory|flashKapitel|flashLevel|flashType|sentenceKapitel|verbKapitel|grammarKapitel|explainKapitel|mistKapitel|mistSkill|quizLevel|quizCount|tutorLevel|planWords|planSentences|planMinutes)$/.test(s)) return true;
  return false;
}

function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function num(n, dflt, max) {
  n = Number(n);
  if (!isFinite(n) || n < 0) return dflt;
  return Math.min(n, max || MAX_SCROLL);
}
function str(v, max) {
  var s = String(v == null ? "" : v);
  return s.length > (max || MAX_FIELD_LEN) ? s.slice(0, max || MAX_FIELD_LEN) : s;
}

var S = {
  VERSION: SCHEMA_V,
  LS_KEY: LS_KEY,
  mem: {},          /* per-page live session state */
  persisted: {},    /* validated localStorage state (first-visit-after-refresh) */
  current: null,    /* currently visible page */
  _navigating: false,
  _busy: false,
  _pending: null,
  _explicit: {},    /* page -> true when an opener (openExplain) already set live state */
  _lastExplainId: null,
  _saveT: null,
  _scrollT: 0,
  _settleT: null
};

/* ---------------- DOM helpers (all guarded) ---------------- */
function $(id) { try { return document.getElementById(id) || null; } catch (e) { return null; } }
function pageEl(name) { try { return document.querySelector("#page-" + name) || null; } catch (e) { return null; } }
function validPage(name) {
  if (!name || typeof name !== "string") return false;
  return !!pageEl(name);
}
function getScroll() {
  try {
    var y = window.pageYOffset || window.scrollY || 0;
    if ((!y || y < 0) && document.documentElement) y = document.documentElement.scrollTop || 0;
    if ((!y || y < 0) && document.body) y = document.body.scrollTop || 0;
    return num(y, 0);
  } catch (e) { return 0; }
}
function maxScroll() {
  try {
    var h = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    );
    var vh = window.innerHeight || 0;
    return Math.max(0, h - vh);
  } catch (e) { return 0; }
}

/* Snapshot every id-bearing input/select/textarea inside a page section. */
function snapFields(name) {
  var out = {};
  try {
    var root = pageEl(name);
    if (!root || !root.querySelectorAll) return out;
    var els = root.querySelectorAll("input, select, textarea");
    for (var i = 0; i < els.length && Object.keys(out).length < MAX_FIELDS; i++) {
      var el = els[i];
      if (!el || !el.id) continue;
      if (el.type === "password" || el.type === "file") continue;
      if (el.type === "checkbox" || el.type === "radio") { out[el.id] = el.checked ? "1" : "0"; continue; }
      if (typeof el.value === "string") out[el.id] = str(el.value);
    }
  } catch (e) {}
  return out;
}
function applyFields(name, fields) {
  if (!isObj(fields)) return;
  try {
    Object.keys(fields).forEach(function (id) {
      var el = $(id);
      if (!el) return;
      /* Never write into a field that belongs to another page section. */
      try {
        var sec = el.closest ? el.closest(".page") : null;
        if (sec && sec.id !== "page-" + name) return;
      } catch (e) {}
      var v = fields[id];
      try {
        if (el.tagName === "SELECT") {
          var vv = String(v);
          var ok = false;
          for (var i = 0; i < el.options.length; i++) {
            if (el.options[i].value === vv || el.options[i].text === vv) { ok = true; break; }
          }
          if (ok) el.value = vv;
        } else if (el.type === "checkbox" || el.type === "radio") {
          el.checked = (v === "1" || v === true);
        } else if (typeof el.value === "string") {
          el.value = str(v);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

/* Level/quiz tab state (visual only — vars are synced separately). */
function snapTabs(name) {
  var out = {};
  try {
    if (name === "sentences") {
      var a = document.querySelector("#page-sentences .level-tab.active");
      if (a) out.sentLevel = str(a.getAttribute("data-level") || "all", 8);
    }
    if (name === "quiz") {
      var q = document.querySelector("#page-quiz .quiz-type.active");
      if (q) out.quizType = str(q.getAttribute("data-type") || "mixed", 16);
    }
  } catch (e) {}
  return out;
}
function applyTabs(name, tabs) {
  if (!isObj(tabs)) return;
  try {
    if (name === "sentences" && tabs.sentLevel) {
      var lv = String(tabs.sentLevel);
      if (!/^(all|A1|A2|B1|B2)$/.test(lv)) return;
      try { if (typeof window !== "undefined" && "currSentLevel" in window) window.currSentLevel = lv; } catch (e) {}
      try { eval("if(typeof currSentLevel!=='undefined'){currSentLevel='" + lv + "';}"); } catch (e) {}
      document.querySelectorAll("#page-sentences .level-tab").forEach(function (b) {
        try { b.classList.toggle("active", b.getAttribute("data-level") === lv); } catch (e) {}
      });
    }
    if (name === "quiz" && tabs.quizType) {
      var t = String(tabs.quizType);
      if (!/^[a-zA-Z-]{2,16}$/.test(t)) return;
      try { eval("if(typeof quizType!=='undefined'){quizType='" + t.replace(/'/g, "") + "';}"); } catch (e) {}
      document.querySelectorAll("#page-quiz .quiz-type").forEach(function (b) {
        try { b.classList.toggle("active", b.getAttribute("data-type") === t); } catch (e) {}
      });
    }
  } catch (e) {}
}

/* ---------------- light custom state per page ---------------- */
function collectCustom(name) {
  var c = {};
  try {
    if (name === "vocab") {
      try { eval("if(typeof vocabLimit==='number'&&isFinite(vocabLimit)){c.vocabLimit=Math.min(600,Math.max(60,Math.round(vocabLimit)));}"); } catch (e) {}
    } else if (name === "sentences") {
      try { eval("if(typeof sentA1Limit==='number'&&isFinite(sentA1Limit)){c.sentA1Limit=Math.min(600,Math.max(20,Math.round(sentA1Limit)));}"); } catch (e) {}
      try { eval("if(typeof currSentLevel==='string'){c.sentLevel=currSentLevel;}"); } catch (e) {}
    } else if (name === "flashcards") {
      try { eval("if(typeof flashIdx==='number'&&isFinite(flashIdx)){c.flashIdx=Math.max(0,Math.round(flashIdx));}"); } catch (e) {}
      try {
        var fc = $("flashcard");
        if (fc) {
          c.flipped = fc.classList.contains("flipped") ? 1 : 0;
          if (fc.dataset && fc.dataset.wid) c.wid = str(fc.dataset.wid, 64);
        }
      } catch (e) {}
    } else if (name === "explain") {
      if (S._lastExplainId) c.openId = str(S._lastExplainId, 16);
      else {
        try {
          var det = $("explainDetail");
          if (det && !det.classList.contains("hidden") && S._lastExplainId) c.openId = str(S._lastExplainId, 16);
        } catch (e) {}
      }
    } else if (name === "reference") {
      try { eval("if(typeof refState!=='undefined'&&refState){if(refState.path)c.refPath=String(refState.path).slice(0,4);if(refState.topic)c.refTopic=String(refState.topic).slice(0,64);}"); } catch (e) {}
    } else if (name === "quiz") {
      try { eval("if(typeof quizType==='string'){c.quizType=quizType.slice(0,16);}"); } catch (e) {}
    } else if (name === "review") {
      try { eval("if(typeof reviewDir==='string'){c.reviewDir=reviewDir.slice(0,8);}"); } catch (e) {}
    } else if (name === "sentex" || name === "practice") {
      try { eval("if(typeof activeSentenceTraining==='string'){c.sentexType=activeSentenceTraining.slice(0,16);}"); } catch (e) {}
      try { eval("if(typeof activePracticeTraining==='string'){c.practiceType=activePracticeTraining.slice(0,16);}"); } catch (e) {}
      try { eval("if(typeof SXUI!=='undefined'&&SXUI){c.sxChapters=Array.isArray(SXUI.chapters)?SXUI.chapters.slice(0,40).map(function(x){return String(x).slice(0,8);}):null;if(SXUI.mode)c.sxMode=String(SXUI.mode).slice(0,8);}"); } catch (e) {}
      try { eval("if(typeof PXUI!=='undefined'&&PXUI){c.pxChapters=Array.isArray(PXUI.chapters)?PXUI.chapters.slice(0,40).map(function(x){return String(x).slice(0,8);}):null;if(PXUI.mode)c.pxMode=String(PXUI.mode).slice(0,8);}"); } catch (e) {}
    } else if (name === "tutor") {
      try {
        var m = document.querySelector("#tutorModes [data-tm].active");
        if (m) c.tutorMode = str(m.getAttribute("data-tm"), 16);
      } catch (e) {}
    } else if (name === "games") {
      try { eval("if(typeof curGame==='string'&&curGame){c.curGame=curGame.slice(0,32);}"); } catch (e) {}
    }
  } catch (e) {}
  return c;
}

/* Vars that must be restored BEFORE the inner render chain (renders read them). */
function applyVars(name, custom) {
  if (!isObj(custom)) return;
  try {
    if (name === "vocab" && typeof custom.vocabLimit === "number") {
      try { eval("if(typeof vocabLimit==='number'){vocabLimit=Math.min(600,Math.max(60,Math.round(" + custom.vocabLimit + ")));}"); } catch (e) {}
    }
    if (name === "sentences") {
      if (typeof custom.sentA1Limit === "number") {
        try { eval("if(typeof sentA1Limit==='number'){sentA1Limit=Math.min(600,Math.max(20,Math.round(" + custom.sentA1Limit + ")));}"); } catch (e) {}
      }
      if (typeof custom.sentLevel === "string" && /^(all|A1|A2|B1|B2)$/.test(custom.sentLevel)) {
        try { eval("currSentLevel='" + custom.sentLevel + "';"); } catch (e) {}
        try { if (typeof window !== "undefined") window.currSentLevel = custom.sentLevel; } catch (e) {}
      }
    }
    if ((name === "sentex" || name === "practice") && isObj(custom)) {
      try {
        if (typeof custom.sentexType === "string") eval("if(typeof activeSentenceTraining!=='undefined'){activeSentenceTraining='" + String(custom.sentexType).replace(/'/g, "").slice(0, 16) + "';}");
      } catch (e) {}
      try {
        if (typeof custom.practiceType === "string") eval("if(typeof activePracticeTraining!=='undefined'){activePracticeTraining='" + String(custom.practiceType).replace(/'/g, "").slice(0, 16) + "';}");
      } catch (e) {}
    }
    if (name === "quiz" && typeof custom.quizType === "string" && /^[a-zA-Z-]{2,16}$/.test(custom.quizType)) {
      try { eval("if(typeof quizType!=='undefined'){quizType='" + custom.quizType + "';}"); } catch (e) {}
    }
    if (name === "review" && (custom.reviewDir === "de-ar" || custom.reviewDir === "ar-de")) {
      try { eval("if(typeof reviewDir!=='undefined'){reviewDir='" + custom.reviewDir + "';}"); } catch (e) {}
    }
  } catch (e) {}
}

/* Post-render opens (need built DOM): reference topic, explain detail, flash deck. */
function postApply(name, saved) {
  if (!isObj(saved)) return;
  var custom = isObj(saved.custom) ? saved.custom : {};
  try {
    if (name === "reference" && (custom.refPath || custom.refTopic)) {
      try {
        if (custom.refPath && typeof openRefPath === "function") {
          var okP = false;
          try { okP = !!(typeof refPathById === "function" && refPathById(custom.refPath)); } catch (e) {}
          if (okP) openRefPath(custom.refPath);
        }
        if (custom.refTopic && typeof openRefTopic === "function") {
          var okT = false;
          try { okT = !!(typeof refTopicById === "function" && refTopicById(custom.refTopic)); } catch (e) {}
          if (okT) openRefTopic(custom.refTopic);
        }
        if (saved.fields && saved.fields.refSearch && typeof runRefSearch === "function") {
          var si = $("refSearch");
          if (si) { si.value = str(saved.fields.refSearch, 120); runRefSearch(); }
        }
      } catch (e) {}
    }
    if (name === "explain" && custom.openId && typeof openExplain === "function") {
      try {
        var okG = false;
        try { okG = !!(typeof GRAMMAR !== "undefined" && GRAMMAR.some(function (g) { return g && g.id === custom.openId; })); } catch (e) {}
        if (okG) {
          S._explicit.explain = true; /* adopt, don't fight the opener */
          S._lastExplainId = custom.openId;
          openExplain(custom.openId);
          delete S._explicit.explain;
        }
      } catch (e) {}
    }
    if (name === "flashcards") {
      try {
        if (typeof buildFlash === "function") {
          /* Rebuild deck with restored filters, then restore position by card id. */
          var wantWid = typeof custom.wid === "string" ? custom.wid : null;
          var wantIdx = num(custom.flashIdx, 0, 5000);
          buildFlash();
          try {
            eval(
              "if(typeof flashList!=='undefined'&&Array.isArray(flashList)&&flashList.length){" +
              "var _wi=-1;" +
              (wantWid ? "for(var _k=0;_k<flashList.length;_k++){if(flashList[_k]&&flashList[_k].id==='" + String(wantWid).replace(/'/g, "") + "'){_wi=_k;break;}}" : "") +
              "if(typeof flashIdx!=='undefined'){flashIdx=_wi>=0?_wi:Math.min(" + wantIdx + ",flashList.length-1);}" +
              "if(typeof renderFlash==='function'){renderFlash();}" +
              "}"
            );
          } catch (e) {}
        }
      } catch (e) {}
    }
    if ((name === "sentex" || name === "practice") && typeof renderVocab === "function") {
      /* runs already re-rendered with restored vars; just re-apply field values */
      applyFields(name, saved.fields);
    }
  } catch (e) {}
}

/* ---------------- capture / persist ---------------- */
S.capture = function (page) {
  if (!validPage(page)) return null;
  var st = {
    v: SCHEMA_V,
    scroll: getScroll(),
    fields: snapFields(page),
    tabs: snapTabs(page),
    custom: collectCustom(page),
    ts: Date.now()
  };
  S.mem[page] = st;
  S.saveSoon();
  return st;
};

function filterPersistable(fields) {
  var out = {};
  if (!isObj(fields)) return out;
  Object.keys(fields).forEach(function (id) {
    if (persistableField(id)) out[id] = str(fields[id]);
  });
  return out;
}
function safeCustom(page, custom) {
  if (!isObj(custom)) return {};
  var out = {};
  var allow = {
    vocab: ["vocabLimit"], sentences: ["sentLevel", "sentA1Limit"],
    flashcards: ["flashIdx", "wid"],
    explain: ["openId"], reference: ["refPath", "refTopic"],
    quiz: ["quizType"], review: ["reviewDir"],
    sentex: ["sentexType", "practiceType"], practice: ["sentexType", "practiceType"],
    tutor: ["tutorMode"], verbs: [], grammar: [], howto: [], mistakes: []
  };
  var keys = allow[page] || [];
  keys.forEach(function (k) {
    var v = custom[k];
    if (typeof v === "number" && isFinite(v)) out[k] = Math.min(6000, Math.max(0, Math.round(v)));
    else if (typeof v === "string" && v) out[k] = v.slice(0, 64);
  });
  /* generic tabs */
  if (custom.sentLevel && page === "sentences" && /^(all|A1|A2|B1|B2)$/.test(custom.sentLevel)) out.sentLevel = custom.sentLevel;
  return out;
}

S.persistNow = function () {
  try {
    if (typeof localStorage === "undefined") return false;
    var pages = {};
    Object.keys(S.mem).forEach(function (p) {
      var m = S.mem[p];
      if (!m) return;
      var tabs = isObj(m.tabs) ? m.tabs : {};
      if (p === "sentences" && m.custom && m.custom.sentLevel) tabs.sentLevel = m.custom.sentLevel;
      if (p === "quiz" && m.custom && m.custom.quizType) tabs.quizType = m.custom.quizType;
      pages[p] = {
        scroll: num(m.scroll, 0),
        fields: filterPersistable(m.fields),
        tabs: tabs,
        custom: safeCustom(p, m.custom)
      };
    });
    var payload = { v: SCHEMA_V, savedAt: Date.now(), pages: pages };
    var s = JSON.stringify(payload);
    if (s.length > 100000) {
      /* Too big: keep scroll+fields only. */
      Object.keys(pages).forEach(function (p) { pages[p].custom = {}; });
      s = JSON.stringify({ v: SCHEMA_V, savedAt: Date.now(), pages: pages });
      if (s.length > 100000) return false;
    }
    localStorage.setItem(LS_KEY, s);
    return true;
  } catch (e) { return false; }
};
S.savePageState = function () { return S.persistNow(); };
S.saveSoon = function () {
  try {
    if (S._saveT) return;
    S._saveT = setTimeout(function () { S._saveT = null; S.persistNow(); }, 800);
  } catch (e) {}
};

function sanitizeLoaded(raw) {
  var out = {};
  if (!isObj(raw) || raw.v !== SCHEMA_V || !isObj(raw.pages)) return out;
  Object.keys(raw.pages).forEach(function (p) {
    if (!/^[a-z0-9-]{2,24}$/.test(p)) return;
    var e = raw.pages[p];
    if (!isObj(e)) return;
    var rec = { scroll: num(e.scroll, 0), fields: {}, tabs: {}, custom: {} };
    if (isObj(e.fields)) {
      Object.keys(e.fields).slice(0, MAX_FIELDS).forEach(function (id) {
        if (/^[A-Za-z0-9_-]{1,48}$/.test(id) && persistableField(id)) rec.fields[id] = str(e.fields[id]);
      });
    }
    if (isObj(e.tabs)) {
      if (e.tabs.sentLevel && /^(all|A1|A2|B1|B2)$/.test(e.tabs.sentLevel)) rec.tabs.sentLevel = e.tabs.sentLevel;
      if (e.tabs.quizType && /^[a-zA-Z-]{2,16}$/.test(e.tabs.quizType)) rec.tabs.quizType = e.tabs.quizType;
    }
    if (isObj(e.custom)) {
      var sc = safeCustom(p, e.custom);
      if (isObj(e.custom) && e.custom.sentLevel && p === "sentences") sc.sentLevel = rec.tabs.sentLevel || sc.sentLevel;
      rec.custom = sc;
    }
    out[p] = rec;
  });
  return out;
}
S.loadPersisted = function () {
  try {
    if (typeof localStorage === "undefined") return {};
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    S.persisted = sanitizeLoaded(parsed);
    return S.persisted;
  } catch (e) { return {}; }
};

S.clearPageState = function (page) {
  try {
    if (page) { delete S.mem[page]; delete S.persisted[page]; }
    else { S.mem = {}; S.persisted = {}; }
    S.persistNow();
  } catch (e) {}
  return true;
};

/* ---------------- navigation core ---------------- */
S.skipRender = function (page) {
  try {
    if (!S._navigating) return false;
    if (NEVER_SKIP[page]) return false;
    return !!S.mem[page];
  } catch (e) { return false; }
};
S.willRestore = function (name) {
  try {
    if (!S._pending || S._pending !== name) return false;
    if (S._explicit[name]) return false;
    if (S.current && S.current === name) return false; /* same-page sub-nav keeps opener scroll */
    return !!(S.mem[name] || S.persisted[name]);
  } catch (e) { return false; }
};

S.restoreScroll = function (page, y) {
  y = num(y, 0);
  if (y <= 0) return;
  try {
    var apply = function () {
      try {
        var mx = maxScroll();
        var target = Math.min(y, mx);
        if (target > 0) {
          try { window.scrollTo(0, target); } catch (e) {
            try { document.documentElement.scrollTop = target; } catch (_) {}
            try { document.body.scrollTop = target; } catch (_) {}
          }
        }
      } catch (e) {}
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () { requestAnimationFrame(apply); });
    } else {
      setTimeout(apply, 60);
    }
    /* Settle check: late dynamic content may extend the page after restore. */
    try {
      if (S._settleT) clearTimeout(S._settleT);
      S._settleT = setTimeout(function () {
        try {
          if (Math.abs(getScroll() - Math.min(y, maxScroll())) > 2 && getScroll() <= 2 && maxScroll() > 0) apply();
        } catch (e) {}
      }, 350);
    } catch (e) {}
  } catch (e) {}
};

S.navigate = function (name, prev) {
  if (S._busy) { try { return prev(name); } catch (e) { return undefined; } }
  S._busy = true;
  var ret;
  try {
    var from = S.current;
    if (from && from !== name) { try { S.capture(from); } catch (e) {} }
    var hadMem = !!S.mem[name];
    var hadPersisted = !hadMem && !!S.persisted[name];
    if (hadPersisted) {
      try { applyFields(name, S.persisted[name].fields); } catch (e) {}
      try { applyTabs(name, S.persisted[name].tabs); } catch (e) {}
      try { applyVars(name, S.persisted[name].custom); } catch (e) {}
    }
    S._pending = name;
    S._navigating = true;
    try { ret = prev(name); }
    finally { S._navigating = false; S._pending = null; }
    S.current = name;
    if (!validPage(name)) return ret;
    if (from && from === name) {
      /* Same-page sub-navigation (e.g. opening a lesson): adopt live, keep scroll. */
      try { S.capture(name); } catch (e) {}
    } else if (S._explicit[name]) {
      try { delete S._explicit[name]; } catch (e) {}
      try { S.capture(name); } catch (e) {}
    } else if (hadMem) {
      /* Return visit: DOM kept as-left by skipRender guards — restore scroll only. */
      try {
        var y = S.mem[name] ? S.mem[name].scroll : 0;
        /* Refresh in-memory fields from live DOM (cheap, keeps persist fresh). */
        try {
          S.mem[name].fields = snapFields(name);
          S.mem[name].tabs = snapTabs(name);
          var cc = collectCustom(name);
          if (isObj(cc)) S.mem[name].custom = cc;
          S.saveSoon();
        } catch (e) {}
        S.restoreScroll(name, y);
      } catch (e) {}
    } else if (hadPersisted) {
      try { postApply(name, S.persisted[name]); } catch (e) {}
      try { S.capture(name); } catch (e) {}
      /* Keep the persisted scroll if the fresh content supports it. */
      try { S.restoreScroll(name, S.persisted[name].scroll || 0); } catch (e) {}
    } else {
      /* Brand-new visit: inner chain already scrolled top; snapshot baseline. */
      try { S.capture(name); } catch (e) {}
      /* Baseline scroll is ~0; nothing to restore. */
    }
    return ret;
  } catch (e) { return ret; }
  finally { S._busy = false; }
};

/* ---------------- boot ---------------- */
S.detectCurrent = function () {
  try {
    var a = document.querySelector(".page.active");
    if (a && a.id && a.id.indexOf("page-") === 0) { S.current = a.id.slice(5); return S.current; }
  } catch (e) {}
  S.current = "dashboard";
  return S.current;
};

/* Keep scroll fresh while the user reads (throttled), persist debounced. */
function onScroll() {
  try {
    var now = Date.now();
    if (now - S._scrollT < 150) return;
    S._scrollT = now;
    if (S.current && validPage(S.current)) {
      if (!S.mem[S.current]) S.mem[S.current] = { v: SCHEMA_V, scroll: 0, fields: {}, tabs: {}, custom: {}, ts: now };
      S.mem[S.current].scroll = getScroll();
      S.saveSoon();
    }
  } catch (e) {}
}

/* Track explicitly opened explain lessons so restore never clobbers them. */
function wrapOpeners() {  try {
    if (typeof openExplain === "function" && !openExplain._dmPS) {
      var _oe = openExplain;
      openExplain = function (id) {
        try {
          S._lastExplainId = String(id).slice(0, 16);
          S._explicit.explain = true;
        } catch (e) {}
        return _oe.apply(this, arguments);
      };
      try { openExplain._dmPS = true; } catch (e) {}
    }
  } catch (e) {}
  try {
    if (typeof openRefTopic === "function" && !openRefTopic._dmPS) {
      var _rt = openRefTopic;
      openRefTopic = function (id) {
        var r = _rt.apply(this, arguments);
        try { S.saveSoon(); } catch (e) {}
        return r;
      };
      try { openRefTopic._dmPS = true; } catch (e) {}
    }
  } catch (e) {}
}

/* Wrap showPage ONCE, outermost (this file loads last). */
function wrapShowPage() {
  try {
    if (typeof showPage !== "function") return false;
    if (showPage._dmPageStateWrapped) return true;
    var _prev = showPage;
    var wrapped = function (name) { return S.navigate(name, _prev); };
    copyFlags(_prev, wrapped);
    showPage = wrapped;
    try { showPage._dmPageStateWrapped = true; } catch (e) {}
    return true;
  } catch (e) { return false; }
}
function copyFlags(from, to) {
  try {
    for (var k in from) {
      try { if (Object.prototype.hasOwnProperty.call(from, k)) to[k] = from[k]; } catch (e) {}
    }
  } catch (e) {}
}
/* Self-healing: a module may wrap showPage AFTER us (e.g. career.js attaches on
   DOMContentLoaded). If our layer is no longer outermost, re-wrap so capture /
   restore and skipRender guards always span the whole chain. navigate() is
   re-entrant safe (_busy), so nested layers pass through harmlessly. */
function ensureOutermost() {
  try {
    if (typeof showPage === "function" && !showPage._dmPageStateWrapped) wrapShowPage();
  } catch (e) {}
}

function boot() {
  try { S.loadPersisted(); } catch (e) {}
  try { S.detectCurrent(); } catch (e) {}
  try { wrapOpeners(); } catch (e) {}
  /* showPage may be defined already (all modules loaded before us). Retry once if not. */
  if (!wrapShowPage()) {
    try {
      setTimeout(function () {
        try { wrapShowPage(); } catch (e) {}
        try { wrapOpeners(); } catch (e) {}
      }, 500);
    } catch (e) {}
  }
  /* Re-assert outermost after deferred module wiring (career.js pattern). */
  try {
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("DOMContentLoaded", function () {
        try { ensureOutermost(); } catch (e) {}
        try { wrapOpeners(); } catch (e) {}
      });
    }
  } catch (e) {}
  try {
    setTimeout(function () { try { ensureOutermost(); } catch (e) {} }, 1500);
    setTimeout(function () { try { ensureOutermost(); } catch (e) {} }, 5000);
  } catch (e) {}
  try {
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  } catch (e) {
    try { if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("scroll", onScroll); } catch (_) {}
  }
  try {
    /* Wiping all app data must also wipe page-state (fresh start stays fresh). */
    var w = $("wipeData");
    if (w && w.addEventListener && !w._dmPS) {
      w.addEventListener("click", function () { try { S.clearPageState(); } catch (e) {} });
      w._dmPS = true;
    }
  } catch (e) {}
  /* Snapshot the landing page so its first return visit restores correctly. */
  try {
    setTimeout(function () {
      try { if (S.current && validPage(S.current) && !S.mem[S.current]) S.capture(S.current); } catch (e) {}
    }, 800);
  } catch (e) {}
}

/* Export */
try {
  if (typeof window !== "undefined") {
    window.DMPageState = S;
    try { S.ensureOutermost = ensureOutermost; } catch (e) {}
    window.capturePageState = function (p) { return S.capture(p || S.current); };
    window.restorePageState = function (p) {
      var m = S.mem[p || S.current];
      if (m) S.restoreScroll(p || S.current, m.scroll);
      return !!m;
    };
    window.savePageState = function () { return S.savePageState(); };
    window.clearPageState = function (p) { return S.clearPageState(p); };
  }
} catch (e) {}
try { if (typeof module !== "undefined" && module.exports) module.exports = S; } catch (e) {}

try { boot(); } catch (e) {}

})();
