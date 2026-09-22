/* Full DOM-simulation test for client/labsx.js: evals the REAL file with a fake
   DOM + stubs, then drives every lab: open, answer right/wrong, next, retry,
   progress persistence, fallbacks. No browser needed.
   Run: node tools/test-labsx-dom.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let SRC = fs.readFileSync(path.join(root, "client", "labsx.js"), "utf8");
SRC = SRC.replace('"use strict";', ""); // direct eval shares scope

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

/* ---------- fake DOM ---------- */
function parseAttrs(s) {
  const a = {};
  const re = /([\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(s))) a[m[1]] = m[3] !== undefined ? m[3] : m[4];
  return a;
}
function parseHTML(html) {
  const nodes = [];
  const btn = /<(button)\b([^>]*)>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = btn.exec(html))) {
    const n = mkNode("button", parseAttrs(m[2]));
    n.innerHTML = m[3]; nodes.push(n);
  }
  const inp = /<(input|textarea|select)\b([^>]*?)(\/>|>|>([\s\S]*?)<\/\1>)/g;
  while ((m = inp.exec(html))) {
    const n = mkNode(m[1], parseAttrs(m[2]));
    if (m[4] !== undefined) n.value = m[4];
    nodes.push(n);
  }
  return nodes;
}
function matchSel(n, sel) {
  sel = sel.trim();
  if (!sel) return false;
  if (sel[0] === ".") {
    const cls = " " + (n.attrs.class || n.className || "") + " ";
    return cls.indexOf(" " + sel.slice(1) + " ") >= 0;
  }
  if (sel[0] === "#") return (n.attrs.id || n._id) === sel.slice(1);
  let m = sel.match(/^\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'))?\]$/);
  if (m) {
    const v = n.attrs[m[1]];
    if (m[2] !== undefined || m[3] !== undefined) return v === (m[2] !== undefined ? m[2] : m[3]);
    return v !== undefined;
  }
  return false;
}
function findAll(n, sel, out) {
  const parts = sel.split(",");
  (n._parsed || []).concat(n.children).forEach(c => {
    if (parts.some(p => matchSel(c, p))) out.push(c);
    findAll(c, sel, out);
  });
  return out;
}
const bodyStub = { children: [],
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
  insertBefore(c) { this.children.push(c); c.parentNode = this; return c; }
};
const registry = {};
function mkNode(tag, attrs) {
  const n = { tagName: tag, attrs: attrs || {}, children: [], _parsed: [],
    _html: "", textContent: "", value: "", disabled: false, className: "",
    style: {}, dataset: {}, handlers: {}, parentNode: bodyStub, _id: null,
    addEventListener(ev, fn) { (n.handlers[ev] = n.handlers[ev] || []).push(fn); },
    appendChild(c) { n.children.push(c); c.parentNode = n; return c; },
    removeChild(c) { const i = n.children.indexOf(c); if (i >= 0) n.children.splice(i, 1); return c; },
    querySelectorAll(sel) { return findAll(n, sel, []); },
    querySelector(sel) { const r = findAll(n, sel, []); return r[0] || null; },
    classList: { add() {}, remove() {}, toggle() {} },
    scrollIntoView() {},
    setAttribute(k, v) { n.attrs[k] = v; },
    getAttribute(k) { return n.attrs[k]; }
  };
  Object.defineProperty(n, "innerHTML", {
    get() { return n._html; },
    set(h) { n._html = String(h); n._parsed = parseHTML(n._html); }
  });
  return n;
}
const document = {
  getElementById(id) {
    if (!registry[id]) { const n = mkNode("div"); n._id = id; registry[id] = n; bodyStub.appendChild(n); }
    return registry[id];
  },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  createElement(tag) { return mkNode(tag); },
  addEventListener() {}
};
const window = {};
function click(n) {
  if (!n) return false;
  (n.handlers.click || []).forEach(fn => fn({ stopPropagation() {}, target: n, preventDefault() {} }));
  return true;
}
function change(n) { (n.handlers.change || []).forEach(fn => fn({ target: n })); }
function keydown(n, key) { (n.handlers.keydown || []).forEach(fn => fn({ key: key, target: n })); }

/* ---------- app stubs ---------- */
function $(id) { return document.getElementById(id); }
// faithful getElementById: resolves ids rendered inside innerHTML like a real browser
document.getElementById = function (id) {
  for (const k in registry) {
    const stack = (registry[k]._parsed || []).concat(registry[k].children);
    while (stack.length) {
      const n = stack.pop();
      if ((n.attrs && n.attrs.id) === id || n._id === id) return n;
      stack.push.apply(stack, (n._parsed || []).concat(n.children));
    }
    if (registry[k]._id === id) return registry[k];
  }
  const n = mkNode("div"); n._id = id; registry[id] = n; bodyStub.appendChild(n);
  return n;
};
const S = { xp: 0, totalCorrect: 0, totalAnswered: 0, mistakes: {}, gweak: {},
  labsx: null, settings: { speed: 1 }, studyDays: {}, streak: { count: 0 } };
const spoken = [], toasts = [], shownPages = [];
function save() {}
function todayStr() { return "2026-09-21"; }
function toast(m) { toasts.push(String(m)); }
function escapeHtml(s) { return String(s == null ? "" : s); }
function t(k) { return k; }
function speakGerman(x) { spoken.push(String(x)); }
function currentRate() { return 1; }
function addXP(n) { S.xp = (S.xp || 0) + n; return n; }
function markStudyDay() { S.studyDays[todayStr()] = true; }
function recordMistake(w, picked, kind) {
  if (!w || !w.id) return;
  const m = S.mistakes[w.id] || { n: 0 };
  m.n++; m.last = picked; m.kind = kind; S.mistakes[w.id] = m;
}
const STUB_WORDS = [
  { id: "n1", de: "Hund", art: "der", ar: "كلب", type: "اسم", plural: "die Hunde", level: "A1" },
  { id: "n2", de: "Tasche", art: "die", ar: "حقيبة", type: "اسم", plural: "die Taschen", level: "A1" },
  { id: "n3", de: "Buch", art: "das", ar: "كتاب", type: "اسم", plural: "die Bücher", level: "A1" },
  { id: "n4", de: "Apfel", art: "der", ar: "تفاحة", type: "اسم", plural: "die Äpfel", level: "A1" },
  { id: "v1", de: "lernen", art: "-", ar: "يتعلم", type: "فعل", level: "A1" },
  { id: "v2", de: "wohnen", art: "-", ar: "يسكن", type: "فعل", level: "A1" }
];
function allWords() { return STUB_WORDS; }
function conjugateVerb(inf) {
  const m = { lernen: { ich: "lerne", du: "lernst", er: "lernt" }, wohnen: { ich: "wohne", du: "wohnst", er: "wohnt" } };
  return m[inf] || null;
}
function dmLev(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a === b) return 0;
  if (!a.length) return b.length; if (!b.length) return a.length;
  let p = [], c = [];
  for (let j = 0; j <= b.length; j++) p[j] = j;
  for (let i = 1; i <= a.length; i++) {
    c[0] = i;
    for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    const t = p; p = c; c = t;
  }
  return p[b.length];
}
var TutorLocal = { correct: function (text) {
  const issues = []; let out = String(text).trim();
  if (out && /[a-zäöü]/.test(out[0])) { issues.push("الجملة الألمانية تبدأ بحرف كبير."); out = out[0].toUpperCase() + out.slice(1); }
  if (out && !/[.?!]$/.test(out)) { issues.push("الجملة بدون علامة نهاية."); out = out + "."; }
  return { ok: issues.length === 0, corrected: out, issues: issues, fixes: [] };
} };
var SENTENCES = [
  { id: "s1", de: "Ich lerne jeden Tag Deutsch.", ar: "أتعلم الألمانية كل يوم." },
  { id: "s2", de: "Meine Mutter kocht heute.", ar: "أمي تطبخ اليوم." }
];
var showPage = function (n) { shownPages.push(n); };
var renderDashboard = function () {};
function renderAll() {}
function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; } return x; }

/* ---------- load the real file ---------- */
eval(SRC);
check("labsx loads without throwing", typeof renderShadow === "function" && typeof renderWrite === "function" && typeof renderDict === "function" && typeof renderSit === "function" && typeof renderEr === "function");

function btns(id, sel) { return document.getElementById(id).querySelectorAll(sel); }
function first(id, sel) { return btns(id, sel)[0]; }
const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  /* ===== SHADOWING (no-mic fallback: window has no SR) ===== */
  renderShadow();
  check("shadow opens with content", document.getElementById("shadowBox").innerHTML.indexOf("shBody") >= 0, "");
  await wait(30);
  check("shadow shows item + hear + typed fallback", document.getElementById("shBody").innerHTML.indexOf("shTyped") >= 0, "");
  // typed answer: perfect
  SH.idx = 0; SH.list = SHADOW_LIST(); const item0 = SH.list[0];
  function SHADOW_LIST() { return shPool(); }
  document.getElementById("shTyped").value = item0.de;
  click(first("shBody", "#shTypedGo") || document.getElementById("shTypedGo"));
  await wait(10);
  const shFb = document.getElementById("shFb").textContent;
  check("shadow typed perfect scores high", /100%/.test(shFb), shFb.slice(0, 80));
  check("shadow attempt persisted", S.labsx.shadow.att >= 1, "att=" + S.labsx.shadow.att);
  // typed wrong
  document.getElementById("shTyped").value = "blabla";
  click(document.getElementById("shTypedGo"));
  await wait(10);
  check("shadow wrong gives low score + missing", /🔁/.test(document.getElementById("shFb").textContent), document.getElementById("shFb").textContent.slice(0, 60));
  // level switch re-renders
  document.getElementById("shLvl").value = "hard"; change(document.getElementById("shLvl"));
  check("shadow level switch works", document.getElementById("shBody").innerHTML.length > 100, "");

  /* ===== SHADOWING with mic (fake SR) ===== */
  window.SpeechRecognition = function FakeRec() {};
  window.SpeechRecognition.prototype.start = function () {
    const self = this;
    setTimeout(() => { try { self.onresult({ results: [[{ transcript: FakeRec.next }]] }); } catch (e) {} }, 5);
  };
  window.SpeechRecognition.next = "Guten Morgen";
  SH.lvl = "medium"; SH.kind = "short"; SH.list = shPool(); SH.idx = 0; // sh-m1 "Guten Morgen!"
  shShow();
  click(document.getElementById("shGo"));
  await wait(60);
  check("shadow mic path grades transcript", /%/.test(document.getElementById("shFb").textContent), document.getElementById("shFb").textContent.slice(0, 70));
  delete window.SpeechRecognition;

  /* ===== WRITING ===== */
  renderWrite();
  check("writing opens with 4 type buttons", btns("writeBox", "[data-wt]").length === 4, "");
  click(btns("writeBox", "[data-wt]")[3]); // rebuild
  check("writing rebuild task shown", document.getElementById("wrBody").innerHTML.indexOf("wrIn") >= 0, "");
  document.getElementById("wrIn").value = "Ich lerne Deutsch.";
  click(document.getElementById("wrGo"));
  await wait(10);
  const wrOut = document.getElementById("wrOut").innerHTML;
  check("writing perfect shows all sections", wrOut.indexOf("إجابتك") >= 0 && wrOut.indexOf("التصحيح") >= 0 && wrOut.indexOf("الأخطاء") >= 0 && wrOut.indexOf("لماذا") >= 0 && wrOut.indexOf("بديلة") >= 0, "");
  check("writing progress saved", S.labsx.write.done >= 1, "done=" + S.labsx.write.done);
  // wrong answer
  document.getElementById("wrIn").value = "ich spiele";
  click(document.getElementById("wrGo"));
  await wait(10);
  check("writing wrong shows categorized errors", document.getElementById("wrOut").innerHTML.indexOf("الأخطاء") >= 0, "");
  // draft
  document.getElementById("wrIn").value = "draft text";
  (document.getElementById("wrIn").handlers.input || []).forEach(fn => fn({}));
  check("writing draft autosaved", Object.keys(S.labsx.write.drafts).length > 0, "");
  const taskIds = Object.keys(S.labsx.write.drafts);
  // next advances
  const before = document.getElementById("wrBody").innerHTML;
  click(document.getElementById("wrNext"));
  check("writing next advances", document.getElementById("wrBody").innerHTML !== before, "");
  void taskIds;

  /* ===== DICTATION ===== */
  renderDict();
  check("dictation opens with play controls", document.getElementById("dcBody").innerHTML.indexOf("dcPlay") >= 0, "");
  await wait(450);
  check("dictation autoplays audio", spoken.length > 0, "plays=" + spoken.length);
  document.getElementById("dcIn").value = DC.cur.de;
  click(document.getElementById("dcGo"));
  await wait(10);
  check("dictation perfect shows correct sentence", document.getElementById("dcDiff").innerHTML.indexOf("الجملة الصحيحة") >= 0, "");
  check("dictation mastered counted", S.labsx.dict.mastered >= 1, "m=" + S.labsx.dict.mastered);
  document.getElementById("dcIn").value = "falsch";
  click(document.getElementById("dcGo"));
  await wait(10);
  check("dictation wrong shows missing words", document.getElementById("dcDiff").innerHTML.indexOf("ناقصة") >= 0, "");
  click(document.getElementById("dcHint"));
  check("dictation hint reveals first word", document.getElementById("dcHintOut").textContent.indexOf(DC.cur.de.split(" ")[0]) >= 0, document.getElementById("dcHintOut").textContent);
  const playsBefore = spoken.length;
  click(document.getElementById("dcSlow"));
  check("dictation slow replay works", spoken.length === playsBefore + 1, "");
  click(document.getElementById("dcNext"));
  check("dictation next works", document.getElementById("dcBody").innerHTML.indexOf("dcIn") >= 0, "");

  /* ===== SITUATIONS: full restaurant run to good ending ===== */
  renderSit();
  const sitBtns = btns("gsitBox", "[data-gsit]");
  check("situations list all scenarios", sitBtns.length >= 8, "n=" + sitBtns.length);
  // walk: s -> m -> e-good (first choices)
  click(sitBtns[0]);
  await wait(30);
  let step = 0;
  while (step++ < 6) {
    const opts = document.getElementById("gsitPlay").querySelectorAll(".quiz-opt");
    if (!opts.length) break;
    click(opts[0]);
    await wait(5);
  }
  const endHtml = document.getElementById("gsitPlay").innerHTML;
  check("situation reaches ending with score+vocab+phrases", endHtml.indexOf("كلمات جديدة") >= 0 && endHtml.indexOf("جمل مفيدة") >= 0, "");
  check("situation completion persisted", !!(S.labsx.sit.done.rest || S.labsx.sit.done.train), JSON.stringify(Object.keys(S.labsx.sit.done)));
  click(document.getElementById("gsitAgain"));
  check("situation retry restarts", document.getElementById("gsitPlay").innerHTML.indexOf("اختر ردك") >= 0, "");
  // bad path records error
  click(document.getElementById("gsitPlay").querySelectorAll(".quiz-opt")[1]);
  await wait(5);
  check("situation bad choice continues branch", document.getElementById("gsitPlay").innerHTML.length > 50, "");

  /* ===== ERROR REPLAY ===== */
  S.mistakes = { n1: { n: 5, last: "die", kind: "quiz" }, v9: { n: 3, last: "kein", kind: "quiz" } };
  renderEr();
  check("er detects weak skills", document.getElementById("erBox").innerHTML.indexOf("يحتاج مراجعة") >= 0, "");
  click(document.getElementById("erAuto"));
  await wait(10);
  const erQ = document.getElementById("erBody").querySelectorAll(".quiz-opt");
  check("er auto-drill generates question", erQ.length >= 2, "opts=" + erQ.length);
  click(erQ[0]);
  await wait(10);
  check("er feedback + next offered", document.getElementById("erFb").innerHTML.length > 20, "");
  const nxBtn = document.getElementById("erFb").querySelectorAll(".btn")[0];
  click(nxBtn);
  await wait(10);
  check("er next generates fresh question", document.getElementById("erBody").querySelectorAll(".quiz-opt").length >= 2, "");
  // order skill
  erDrill("wordorder");
  await wait(10);
  check("er wordorder drill renders chips", document.getElementById("erBody").innerHTML.indexOf("erAns") >= 0, "");
  // finish flow
  const fbBtns = document.getElementById("erFb").querySelectorAll(".btn");
  // answer current then finish
  const cur2 = document.getElementById("erBody").querySelectorAll(".quiz-opt");
  if (cur2.length) { click(cur2[0]); await wait(10); }
  const finBtns = document.getElementById("erFb").querySelectorAll(".btn");
  click(finBtns[1]); // إنهاء
  await wait(10);
  check("er finish persists + XP", S.labsx.er.done >= 1 && S.xp > 0, "done=" + S.labsx.er.done + " xp=" + S.xp);
  void fbBtns;

  /* ===== CONFUSION ===== */
  cfTrain("cf-nk");
  await wait(10);
  check("confusion pair drill renders", document.getElementById("cfBody").querySelectorAll(".quiz-opt").length >= 2, "");
  const cfOpts = document.getElementById("cfBody").querySelectorAll(".quiz-opt");
  click(cfOpts[0]);
  await wait(10);
  const cfFbBtns = document.getElementById("cfFb").querySelectorAll(".btn");
  click(cfFbBtns[0]); // next
  await wait(10);
  check("confusion next works", document.getElementById("cfBody").querySelectorAll(".quiz-opt").length >= 2, "");
  cfTrain("cf-art");
  await wait(10);
  check("confusion skill-based pair works", document.getElementById("cfBody").querySelectorAll(".quiz-opt").length >= 2, "");

  /* ===== DASHBOARD ===== */
  renderLabsxDash();
  const dashHtml = document.getElementById("dashLabsx").innerHTML;
  check("dashboard has 5 lab rows", (dashHtml.match(/data-lxgo/g) || []).length === 5, "");
  check("dashboard shows live stats", dashHtml.indexOf("محاولات") >= 0 && dashHtml.indexOf("مكتمل") >= 0, "");
  click(document.getElementById("dashLabsx").querySelectorAll("[data-lxgo]")[0]);
  check("dashboard opens lab page", shownPages.length > 0, shownPages.join(","));

  /* ===== persistence across refresh (same S object re-render) ===== */
  const attBefore = S.labsx.shadow.att;
  renderShadow();
  check("progress survives re-render", S.labsx.shadow.att === attBefore, "att=" + S.labsx.shadow.att);

  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.log("HARNESS ERROR: " + (e && e.stack || e)); process.exit(1); });
