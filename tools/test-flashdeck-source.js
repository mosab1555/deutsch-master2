/* Flashcard deck source restriction regression test.
 *
 * Contract: the default flashcard deck is the explicit image-sourced bank
 * (RAW_K0..RAW_K7 => buildVocab's flashSource==="image" rows) and nothing else.
 * Generated lazy/library/curriculum vocabulary must never appear in All,
 * article, verb, Mixed, category or Kapitel decks. The user's own words stay
 * safe and are available only through the explicit KX deck.
 *
 * Run: node tools/test-flashdeck-source.js (from project root)
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}

/* ---------- Stubbed-DOM VM (same shape as the other flashcard suites) ---------- */
const __arDict = (() => {
  try {
    const line = RD("client/study.js").split("\n").find(l => l.startsWith("ar:{"));
    const o = {}; const re = /([A-Za-z0-9_]+):"((?:[^"\\]|\\.)*)"/g;
    let m; while ((m = re.exec(line))) o[m[1]] = m[2];
    return o;
  } catch (e) { return {}; }
})();
function mkNode(tag, attrs) {
  const n = {
    tag, attrs: attrs || {}, children: [], _listeners: {},
    textContent: "", _html: "", value: "", className: "",
    options: [], selectedIndex: 0,
    style: {}, dataset: {}, hidden: false, disabled: false,
    classList: {
      add(c) { this._s = this._s || {}; this._s[c] = 1; },
      remove(c) { if (this._s) delete this._s[c]; },
      toggle(c, force) { this._s = this._s || {}; if (force !== undefined) { if (force) this._s[c] = 1; else delete this._s[c]; return !!force; } if (this._s[c]) delete this._s[c]; else this._s[c] = 1; return !!this._s[c]; },
      contains(c) { return !!(this._s && this._s[c]); }
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return mkNode("div", {}); },
    querySelectorAll() { return []; },
    closest() { return null; },
    remove() {}, click() {}, focus() {},
    contains() { return false; }
  };
  Object.defineProperty(n, "innerHTML", {
    get() { return this._html; },
    set(v) { this._html = String(v); this.textContent = String(v).replace(/<[^>]*>/g, ""); }
  });
  return n;
}
const ids = {};
function $(id) { if (!ids[id]) ids[id] = mkNode("div", { id }); return ids[id]; }
const store = {};
const timers = [];
const docListeners = {};
const sb = {
  console,
  setTimeout: (f) => { timers.push(f); return timers.length; },
  clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  navigator: {}, location: {},
  document: {
    readyState: "loading",
    getElementById: (id) => $(id),
    querySelector: () => mkNode("div", {}),
    querySelectorAll: () => [],
    createElement: (t) => mkNode(t, {}),
    addEventListener: (t, f) => { (docListeners[t] = docListeners[t] || []).push(f); },
    documentElement: mkNode("html", {}),
    body: mkNode("body", {}),
    title: ""
  }
};
sb.window = sb; sb.globalThis = sb;
const ctx = vm.createContext(sb);
function flush() { let n = 0; while (timers.length && n++ < 50) timers.shift()(); timers.length = 0; }
function act(js) { timers.length = 0; const r = vm.runInContext(js, ctx); flush(); return r; }
const json = (expr) => JSON.parse(vm.runInContext("JSON.stringify(" + expr + ")", ctx));

try {
  vm.runInContext(RD("client/script.js"), ctx, { filename: "script.js" });
  check("script.js loads under stubs", true);
  ctx.__T_DICT = __arDict;
  vm.runInContext(
    'globalThis.t=function(k){try{var d=globalThis.__T_DICT||{};return d[k]!==undefined?d[k]:k;}catch(e){return k;}};' +
    'globalThis.wordMeaning=function(w){try{return (w&&(w.ar||w.en))||"";}catch(e){return "";}};' +
    'globalThis.wordExMeaning=function(w){try{return (w&&(w.exAr||w.exEn))||"";}catch(e){return "";}};',
    ctx
  );
  for (const f of (docListeners.DOMContentLoaded || [])) { try { f({}); } catch (e) { console.error("domready: " + (e && e.message)); } }
} catch (e) { check("script.js loads under stubs", false, e.message); }

/* ---------- A. The base bank itself is explicitly image-sourced ---------- */
try {
  const base = json("VOCAB.map(function(w){return {id:w.id,de:w.de,art:w.art,kap:w.kap,level:w.level,flashSource:w.flashSource};})");
  check("base bank has exactly 1116 unique image words", base.length === 1116, String(base.length));
  check("every base row is tagged flashSource=image", base.every(w => w.flashSource === "image"));
  check("base IDs are buildVocab image IDs", base.every(w => /^kk[0-7]w\d+$/.test(w.id)));
  check("base IDs are unique", new Set(base.map(w => w.id)).size === base.length);
  check("base bank keeps every chapter K0..K7", ["K0", "K1", "K2", "K3", "K4", "K5", "K6", "K7"].every(k => base.some(w => w.kap === k)));
  const mapped = json("Object.keys(WORD_IMG).map(function(k){var p=k.split('|');return VOCAB.some(function(w){return w.de===p[0]&&w.art===p[1]&&w.flashSource==='image';});})");
  check("all 26 words explicitly mapped to image files are in the image deck", mapped.every(Boolean), JSON.stringify(mapped));
} catch (e) { check("base bank audit", false, e.message); }

/* ---------- B. Unrelated vocabulary is excluded; data stays intact ---------- */
try {
  act(`
    Object.keys(S).forEach(function(k){ delete S[k]; });
    Object.assign(S, defaultState());
    if (typeof ensureStudy === "function") ensureStudy();
    S.customWords = [
      {id:"c-user-1",de:"Schrank",art:"der",ar:"خزانة",pron:"شرانك",type:"اسم",cat:"Home",ex:"Der Schrank ist alt.",exAr:"الخزانة قديمة.",kap:"KX",level:"A1"}
    ];
    VOCAB.push(
      {id:"lv999990",de:"generiert",art:"der",ar:"مُولَّد",pron:"",type:"اسم",cat:"Home",ex:"",exAr:"",kap:"K1",level:"A1"},
      {id:"c999991",de:"curriculum",art:"die",ar:"منهج",pron:"",type:"اسم",cat:"Family",ex:"",exAr:"",kap:"K2",level:"A2"},
      {id:"lv999992",de:"kxgeneriert",art:"das",ar:"مولّد كي إكس",pron:"",type:"اسم",cat:"General",ex:"",exAr:"",kap:"KX",level:"A2"}
    );
    document.getElementById("flashCategory").value="";
    document.getElementById("flashKapitel").value="";
    document.getElementById("flashLevel").value="";
    document.getElementById("flashType").value="";
    buildFlash();
  `);
  const all = json("flashList.map(function(w){return w.id;})");
  check("default All deck has exactly the 1,116 image words", all.length === 1116, String(all.length));
  check("All deck excludes generated/curriculum/custom IDs", ["lv999990", "c999991", "lv999992", "c-user-1"].every(id => all.indexOf(id) < 0), all.slice(-5).join(","));
  check("All deck rows all carry flashSource=image", json("flashList.every(function(w){return w.flashSource==='image';})"));
  const counts = json("flashCounts()");
  check("All count is 1,116", counts[""] === 1116 && counts.mixed === 1116, JSON.stringify(counts));
  check("der count is 216", counts.der === 216, String(counts.der));
  check("die count is 237", counts.die === 237, String(counts.die));
  check("das count is 149", counts.das === 149, String(counts.das));
  check("verbs count is 182", counts.verbs === 182, String(counts.verbs));
  check("deck total UI shows 1,116", $("flashDeckTotal").textContent === "1116", $("flashDeckTotal").textContent);
  check("counter shows 1 / 1,116", $("flashCounter").textContent === "1 / 1116", $("flashCounter").textContent);
  check("unrelated rows are still in the full bank", json("VOCAB.some(function(w){return w.id==='lv999990';})") && json("VOCAB.some(function(w){return w.id==='c999991';})") && json("VOCAB.some(function(w){return w.id==='lv999992';})"));
  check("user words are still saved", json("S.customWords.length===1 && S.customWords[0].de==='Schrank'"));
  check("allWords still exposes every row", json("allWords().length") === 1120, String(json("allWords().length")));
} catch (e) { check("default deck source restriction", false, e.message); }

/* ---------- C. Secondary filters count only the image deck ---------- */
try {
  act(`document.getElementById("flashCategory").value="Home"; document.getElementById("flashKapitel").value=""; document.getElementById("flashLevel").value=""; document.getElementById("flashType").value=""; buildFlash();`);
  const homeExpected = json("VOCAB.filter(function(w){return w.flashSource==='image'&&w.cat==='Home';}).length");
  const home = json("flashList.map(function(w){return w.id;})");
  check("Home category uses only image words", home.length === homeExpected && home.every(id => id.indexOf("lv") !== 0 && id.indexOf("c-user") !== 0), homeExpected + "/" + home.length);
  check("Home category excludes the generated Home row", home.indexOf("lv999990") < 0);

  act(`document.getElementById("flashCategory").value=""; document.getElementById("flashKapitel").value="K1"; buildFlash();`);
  check("K1 Kapitel deck has exactly 179 image words", json("flashList.length") === 179, String(json("flashList.length")));
  check("K1 deck excludes generated K1 row", json("flashList.every(function(w){return w.id!=='lv999990';})"));

  act(`document.getElementById("flashKapitel").value=""; document.getElementById("flashLevel").value="A2"; buildFlash();`);
  check("A2 deck is empty (image bank is A1)", json("flashList.length") === 0);
  check("A2 empty state is shown", $("flashEmpty").classList.contains("hidden") === false && $("flashcard").style.display === "none");
  check("A2 counter is 0 / 0", $("flashCounter").textContent === "0 / 0", $("flashCounter").textContent);

  act(`document.getElementById("flashLevel").value=""; document.getElementById("flashType").value="der"; buildFlash();`);
  check("der deck has exactly 216 image words", json("flashList.length") === 216, String(json("flashList.length")));
  check("der deck total label follows the active article filter", $("flashDeckTotal").textContent === "216", $("flashDeckTotal").textContent);
  check("der deck contains no generated/custom IDs", json("flashList.every(function(w){return w.flashSource==='image';})"));
} catch (e) { check("secondary filters", false, e.message); }

/* ---------- D. KX is an explicit, separate user-words deck ---------- */
try {
  act(`document.getElementById("flashType").value=""; document.getElementById("flashCategory").value=""; document.getElementById("flashLevel").value=""; document.getElementById("flashKapitel").value="KX"; buildFlash();`);
  const kx = json("flashList.map(function(w){return w.id;})");
  check("KX deck contains the user's word", kx.length === 1 && kx[0] === "c-user-1", JSON.stringify(kx));
  check("KX deck excludes generated KX rows", kx.indexOf("lv999992") < 0);
  check("KX counts are the user's words only", json("flashCounts()")[""] === 1);
  act(`document.getElementById("flashKapitel").value=""; document.getElementById("flashType").value=""; buildFlash();`);
} catch (e) { check("KX separate deck", false, e.message); }

/* ---------- E. Mixed/refresh never re-admit unrelated rows ---------- */
try {
  act(`document.getElementById("flashType").value="mixed"; buildFlash();`);
  const mixed = json("flashList.map(function(w){return w.id;})");
  check("Mixed deck has exactly 1,116 image words", mixed.length === 1116, String(mixed.length));
  check("Mixed deck has no unrelated rows", ["lv999990", "c999991", "lv999992", "c-user-1"].every(id => mixed.indexOf(id) < 0));
  check("Mixed deck has no duplicates", new Set(mixed).size === mixed.length);

  const beforeVocab = json("VOCAB.map(function(w){return w.id;})");
  const beforeS = json("S");
  act(`VOCAB.push({id:"lv999993",de:"nochgeneriert",art:"die",ar:"مولّد",pron:"",type:"اسم",cat:"Home",ex:"",exAr:"",kap:"K1",level:"A1"}); refreshFlashList();`);
  check("refresh keeps the image deck at 1,116", json("flashList.length") === 1116, String(json("flashList.length")));
  check("refresh does not admit the new generated row", json("flashList.every(function(w){return w.id!=='lv999993';})"));
  check("refresh keeps bank order/rows intact", JSON.stringify(json("VOCAB.map(function(w){return w.id;})")) === JSON.stringify(beforeVocab.concat(["lv999993"])));
  check("Mixed/refresh did not mutate saved data", JSON.stringify(json("S")) === JSON.stringify(beforeS));
} catch (e) { check("Mixed/refresh", false, e.message); }

/* ---------- F. Chapter options use the image-only deck, not the full bank ---------- */
function flashChapterOptions() {
  const html = $("flashKapitel")._html || "";
  const out = [];
  const re = /<option value="([^"]*)">([^<]*)<\/option>/g;
  let m;
  while ((m = re.exec(html))) {
    const count = /\((\d+)\)\s*$/.exec(m[2]);
    out.push({ value: m[1], text: m[2], count: count ? Number(count[1]) : null });
  }
  return out;
}
try {
  act(`
    document.getElementById("flashCategory").value="";
    document.getElementById("flashLevel").value="";
    document.getElementById("flashType").value="";
    document.getElementById("flashKapitel").value="";
    KAPITEL.push({id:"K8",name:"Generated",icon:""});
    VOCAB.push({id:"lv999996",de:"generiert8",art:"der",ar:"مولّد",pron:"",type:"اسم",cat:"Home",ex:"",exAr:"",kap:"K8",level:"A2"});
    buildFlash();
  `);
  const opts = flashChapterOptions();
  check("chapter option 1 is All chapters", opts[0] && opts[0].value === "" && /كل الكيبات/.test(opts[0].text), JSON.stringify(opts[0]));
  const byChapter = {};
  opts.slice(1).forEach(o => { byChapter[o.value] = o.count; });
  check("chapter options list K0..K7 plus the separate KX deck",
    JSON.stringify(Object.keys(byChapter)) === JSON.stringify(["K0", "K1", "K2", "K3", "K4", "K5", "K6", "K7", "KX"]),
    JSON.stringify(Object.keys(byChapter)));
  check("K6 option shows 138 image words", byChapter.K6 === 138, String(byChapter.K6));
  check("K7 option shows 133 image words", byChapter.K7 === 133, String(byChapter.K7));
  check("generated K8/KX chapters never appear", !byChapter.K8, JSON.stringify(byChapter));
  const expectedChapters = json("(function(){var c={};VOCAB.forEach(function(w){if(w.flashSource==='image'){c[w.kap]=(c[w.kap]||0)+1;}});return c;})()");
  check("chapter counts match eligible image rows, not the general bank",
    ["K0", "K1", "K2", "K3", "K4", "K5", "K6", "K7"].every(k => byChapter[k] === expectedChapters[k]),
    JSON.stringify({ shown: byChapter, expected: expectedChapters }));
  check("K2 option shows 211 image words (not 534 general words)", byChapter.K2 === 211, String(byChapter.K2));
  check("KX option counts only the user's saved word", byChapter.KX === 1, String(byChapter.KX));

  act(`document.getElementById("flashKapitel").value="K2"; buildFlash();`);
  check("selecting K2 yields exactly its 211 image words", json("flashList.length") === 211, String(json("flashList.length")));
  check("K2 deck count and All chip agree", json("flashCounts()")[""] === 211 && $("flashDeckTotal").textContent === "211", $("flashDeckTotal").textContent);
  check("intentional K2 choice is remembered for a reload", store.dm_flash_chapter_v1 === "K2", store.dm_flash_chapter_v1);

  act(`document.getElementById("flashKapitel").value="K6"; buildFlash();`);
  const k6deck = json("flashList.map(function(w){return {de:w.de,ar:w.ar,type:w.type,art:w.art,kap:w.kap};})");
  check("K6 chapter deck has exactly 138 words", k6deck.length === 138, String(k6deck.length));
  check("K6 chapter deck is chapter-scoped", k6deck.every(w => w.kap === "K6"));
  check("K6 verbs deck has exactly 34 verbs and no non-verbs",
    (function(){var r=json(`(function(){var rows=flashList.filter(function(w){return isFlashVerb(w);});return {n:rows.length,all:rows.every(function(w){return w.type==="فعل";})};})()`);return r.n===34&&r.all;})(),
    "K6 verbs");
  check("K6 keeps all 138 printed image words, including the final 27 image-5 rows",
    (function(){
      const raw = (function(){const m=/const RAW_K6 = \[([\s\S]*?)\n\];/.exec(RD("client/script.js"));return m?eval("["+m[1]+"]"):[];})();
      const tail = raw.slice(-27);
      return raw.length === 138 && raw.every(r => k6deck.some(w => w.de === r[0] && w.ar === r[2])) &&
        tail.every(r => k6deck.some(w => w.de === r[0] && w.ar === r[2]));
    })(),
    "K6 image-5 rows");

  act(`document.getElementById("flashKapitel").value="K7"; buildFlash();`);
  const k7deck = json("flashList.map(function(w){return {de:w.de,ar:w.ar,type:w.type,art:w.art,kap:w.kap};})");
  check("K7 chapter deck has exactly 133 words", k7deck.length === 133, String(k7deck.length));
  check("K7 chapter deck is chapter-scoped", k7deck.every(w => w.kap === "K7"));
  check("K7 verbs deck has exactly 27 verbs and no non-verbs",
    json(`(function(){var rows=flashList.filter(function(w){return isFlashVerb(w);});return {n:rows.length,all:rows.every(function(w){return w.type==="فعل";})};})()`).n === 27 &&
      json(`(function(){var rows=flashList.filter(function(w){return isFlashVerb(w);});return rows.every(function(w){return w.type==="فعل";});})()`) === true,
    "K7 verbs");
  check("K7 keeps all 133 printed image words, including the final 35 image-6 rows",
    (function(){
      const raw = (function(){const m=/const RAW_K7 = \[([\s\S]*?)\n\];/.exec(RD("client/script.js"));return m?eval("["+m[1]+"]"):[];})();
      const tail = raw.slice(-35);
      return raw.length === 133 && raw.every(r => k7deck.some(w => w.de === r[0] && w.ar === r[2])) &&
        tail.every(r => k7deck.some(w => w.de === r[0] && w.ar === r[2]));
    })(),
    "K7 image-6 rows");

  act(`document.getElementById("flashKapitel").value="K6"; setFlashMode("verbs"); buildFlash();`);
  check("K6 Verbs filter shows only the 34 actual verbs", json("flashList.length") === 34 && json("flashList.every(function(w){return w.type==='فعل';})") === true);
  act(`document.getElementById("flashKapitel").value="K7"; setFlashMode("verbs"); buildFlash();`);
  check("K7 Verbs filter shows only the 27 actual verbs", json("flashList.length") === 27 && json("flashList.every(function(w){return w.type==='فعل';})") === true);
  act(`document.getElementById("flashKapitel").value=""; setFlashMode(""); buildFlash();`);

  act(`document.getElementById("flashKapitel").value=""; buildFlash();`);
  check("returning to All chapters restores all 1,116 words", json("flashList.length") === 1116, String(json("flashList.length")));
  check("All chapters clears the remembered choice", !store.dm_flash_chapter_v1);

  act(`document.getElementById("flashKapitel").value="K2"; buildFlash(); resetFlashFilters();`);
  check("reset filters returns to All chapters and 1,116 words",
    json("flashList.length") === 1116 &&
    act(`document.getElementById("flashKapitel").value`) === "" &&
    act(`document.getElementById("flashType").value`) === "",
    json("flashList.length") + "/" + act(`document.getElementById("flashKapitel").value`));
  check("reset filters clears the remembered chapter", !store.dm_flash_chapter_v1);

  act(`document.getElementById("flashKapitel").value="K8"; buildFlash();`);
  check("stale K8 selection falls back to All chapters",
    act(`document.getElementById("flashKapitel").value`) === "" && json("flashList.length") === 1116,
    act(`document.getElementById("flashKapitel").value`) + "/" + json("flashList.length"));

  store.dm_flash_chapter_v1 = "K8";
  act(`document.getElementById("flashKapitel")._dmFlashChapterReady=false; document.getElementById("flashKapitel").value="K2"; fillFlashKapitels();`);
  check("stale saved chapter cannot hide the deck on reload",
    act(`document.getElementById("flashKapitel").value`) === "" && !store.dm_flash_chapter_v1,
    act(`document.getElementById("flashKapitel").value`));

  store.dm_flash_chapter_v1 = "K2";
  act(`document.getElementById("flashKapitel")._dmFlashChapterReady=false; document.getElementById("flashKapitel").value=""; fillFlashKapitels(); buildFlash();`);
  check("valid saved K2 choice survives a reload",
    act(`document.getElementById("flashKapitel").value`) === "K2" && json("flashList.length") === 211,
    act(`document.getElementById("flashKapitel").value`) + "/" + json("flashList.length"));

  act(`document.getElementById("flashKapitel").value=""; document.getElementById("flashCategory").value="Home"; buildFlash();`);
  const homeCounts = json("flashChapterCounts()");
  const homeOpts = flashChapterOptions();
  const homeByChapter = {};
  homeOpts.slice(1).forEach(o => { homeByChapter[o.value] = o.count; });
  check("chapter counts follow the active category filter with image-only rows",
    ["K0", "K1", "K2", "K3", "K4", "K5", "K6", "K7"].every(k => homeByChapter[k] === homeCounts[k]) &&
    homeByChapter.K2 === json("VOCAB.filter(function(w){return w.flashSource==='image'&&w.cat==='Home'&&w.kap==='K2';}).length"),
    JSON.stringify({ shown: homeByChapter, expected: homeCounts }));
  act(`document.getElementById("flashCategory").value=""; document.getElementById("flashKapitel").value=""; buildFlash();`);
} catch (e) { check("chapter options / All reset", false, (e && e.message) + " @ " + ((e && e.stack || "").split("\n")[1] || "")); }

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
