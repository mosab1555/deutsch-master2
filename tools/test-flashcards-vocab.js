/* Focused flashcards + vocabulary-category tests.
 * Verifies the redesigned vocabulary trainer end to end against the REAL
 * client/script.js in a stubbed-DOM VM:
 *   - six category chips (All/der/die/das/Verbs/Mixed) with live counts
 *   - conservative classification (explicit type/article only, never -en)
 *   - All keeps bank order, Mixed shuffles without mutating data/progress
 *   - empty categories show the empty state, never a fallback card
 *   - legacy "-" filter state normalizes to All
 *   - 3D flip CSS contract + keyboard flip
 *   - add-word: confirmed save, stay open, clear only word fields, retain
 *     category/type/level/article, rollback + preserve input on failure,
 *     duplicate and double-submit guards, consecutive saves
 * Run: node tools/test-flashcards-vocab.js (from project root)
 */
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

/* ---------- A. Markup + CSS contract (both shells) ---------- */
const MODES = ["", "der", "die", "das", "verbs", "mixed"];
for (const page of ["client/index.html", "client/academy.html"]) {
  const html = RD(page);
  const seg = (html.split('id="page-flashcards"')[1] || "").split("</section>")[0];
  const chips = [...seg.matchAll(/data-flash-mode="([^"]*)"/g)].map(m => m[1]);
  check(page + " has six mode chips in order", JSON.stringify(chips) === JSON.stringify(MODES), chips.join(","));
  const counts = [...seg.matchAll(/data-flash-count="([^"]*)"/g)].map(m => m[1]);
  check(page + " chip count slots match modes", JSON.stringify(counts) === JSON.stringify(MODES), counts.join(","));
  check(page + " filter bar precedes card", seg.indexOf('id="flashModeChips"') >= 0 && seg.indexOf('id="flashModeChips"') < seg.indexOf('id="flashcard"'));
  check(page + " persisted mode store is hidden", /id="flashType"[^>]*class="flash-mode-store"/.test(seg) && /\.flash-mode-store\{display:none/.test(RD("client/style.css")));
  check(page + " empty state exists", seg.indexOf('id="flashEmpty"') >= 0);
  check(page + " progress + prev/next controls", /id="flashCounter"/.test(seg) && /id="flashPrev"/.test(seg) && /id="flashNext"/.test(seg));
  check(page + " add-word status live region", /id="addWordStatus"[^>]*aria-live="polite"/.test(html));
  check(page + " add-word keeps all existing fields", ["nwDe", "nwAr", "nwArt", "nwType", "nwCat", "nwPron", "nwEx", "nwExAr", "nwLevel"].every(id => html.indexOf('id="' + id + '"') >= 0));
}
const css = RD("client/style.css");
check("CSS: card perspective", /#page-flashcards \.flashcard\{[^}]*perspective:1600px/.test(css));
check("CSS: preserve-3d", /#page-flashcards \.flash-inner\{[^}]*transform-style:preserve-3d/.test(css));
check("CSS: backface hidden", /#page-flashcards \.flash-face\{[^}]*backface-visibility:hidden/.test(css));
check("CSS: smooth transform transition", /#page-flashcards \.flash-inner\{[^}]*transition:transform \.65s/.test(css));
check("CSS: flipped rotates 180deg", /#page-flashcards \.flashcard\.flipped \.flash-inner\{transform:rotateY\(180deg\)\}/.test(css));
check("CSS: reduced motion disables flip animation", /prefers-reduced-motion:reduce[\s\S]*#page-flashcards \.flash-inner\{transition:none/.test(css));
check("CSS: inactive face not clickable", /\.flashcard:not\(\.flipped\) \.flash-back[^{]*\{pointer-events:none\}/.test(css));
check("CSS: mobile controls remain wrapped/grid", /#page-flashcards \.flash-controls\{display:flex[^}]*flex-wrap:wrap/.test(css));

/* ---------- B. Stubbed-DOM VM (same shape as test-flashdir) ---------- */
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
const chips = {};
MODES.forEach(m => { const n = mkNode("button", { "data-flash-mode": m }); n.closest = () => n; chips[m] = n; });
const countEls = {};
MODES.forEach(m => { countEls[m] = mkNode("b", { "data-flash-count": m }); });
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
    querySelector: (s) => (s === "#page-flashcards .flash-controls" ? $("__flashControls") : mkNode("div", {})),
    querySelectorAll: (s) => {
      if (s === "[data-flash-count]") return Object.keys(countEls).map(k => countEls[k]);
      if (s === "[data-flash-mode]") return Object.keys(chips).map(k => chips[k]);
      return [];
    },
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
const js = (expr) => vm.runInContext(expr, ctx);
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

/* ---------- C. Classification + deck behavior ---------- */
try {
  act(`
    Object.keys(S).forEach(function(k){ delete S[k]; });
    Object.assign(S, defaultState());
    if (typeof ensureStudy === "function") ensureStudy();
    S.customWords = []; S.status = {}; S.srs = {}; S.review = {}; S.mistakes = {};
    VOCAB.length = 0;
    VOCAB.push(
      {id:"w1",de:"Tisch",art:"der",ar:"الطاولة",pron:"تيش",type:"اسم",cat:"Home",ex:"Der Tisch ist neu.",exAr:"الطاولة جديدة.",kap:"K5",level:"A1",plural:"die Tische"},
      {id:"w2",de:"die Katze",art:"-",ar:"القطة",pron:"كاتسه",type:"اسم",cat:"Animals",ex:"Die Katze schläft.",exAr:"القطة نائمة.",kap:"K2",level:"A1",plural:"die Katzen"},
      {id:"w3",de:"das Haus",art:"-",ar:"البيت",pron:"هاوس",type:"اسم",cat:"Home",ex:"Das Haus ist groß.",exAr:"البيت كبير.",kap:"K3",level:"A1",plural:"die Häuser"},
      {id:"w4",de:"laufen",art:"-",ar:"يجري",pron:"لاوفن",type:"فعل",cat:"Common Verbs",ex:"Wir laufen.",exAr:"نحن نجري.",kap:"K1",level:"A1",plural:""},
      {id:"w5",de:"gehen",art:"der",ar:"يذهب",pron:"جيهن",type:"verb",cat:"Common Verbs",ex:"Wir gehen.",exAr:"نحن نذهب.",kap:"K1",level:"A1",plural:""},
      {id:"w6",de:"wohnen",art:"-",ar:"يسكن",pron:"فونن",type:"اسم",cat:"Home",ex:"Sie wohnen hier.",exAr:"هم يسكنون هنا.",kap:"K3",level:"A1",plural:""},
      {id:"w7",de:"Wasser",art:"-",ar:"ماء",pron:"فاسر",type:"اسم",cat:"Food",ex:"Wasser ist wichtig.",exAr:"الماء مهم.",kap:"K4",level:"A1",plural:""},
      {id:"w8",de:"schnell",art:"-",ar:"سريع",pron:"شنيل",type:"صفة",cat:"Adjectives",ex:"Er ist schnell.",exAr:"هو سريع.",kap:"K1",level:"A1",plural:""}
    );
    /* These fixtures stand in for the image bank; the deck now deliberately
       excludes rows without this explicit source marker. */
    VOCAB.forEach(function(w){ w.flashSource="image"; });
    document.getElementById("flashCategory").value="";
    document.getElementById("flashKapitel").value="";
    document.getElementById("flashLevel").value="";
    document.getElementById("flashType").value="";
  `);

  check("classification: explicit article", js(`flashArticle(VOCAB[0])`) === "der");
  check("classification: leading die in de", js(`flashArticle(VOCAB[1])`) === "die");
  check("classification: leading das in de", js(`flashArticle(VOCAB[2])`) === "das");
  check("classification: verbs never article-bearing", js(`flashArticle(VOCAB[4])`) === "" && js(`flashArticle(VOCAB[3])`) === "");
  check("classification: Arabic type فعل is a verb", js(`isFlashVerb(VOCAB[3])`) === true);
  check("classification: raw English type verb is a verb", js(`isFlashVerb(VOCAB[4])`) === true);
  check("classification: -en alone is NOT a verb", js(`isFlashVerb(VOCAB[5])`) === false);
  check("classification: bare noun stays unclassified", js(`flashArticle(VOCAB[6])`) === "");

  const counts = json("flashCounts()");
  check("counts: All includes unclassified", counts[""] === 8, JSON.stringify(counts));
  check("counts: der/die/das", counts.der === 1 && counts.die === 1 && counts.das === 1, JSON.stringify(counts));
  check("counts: verbs explicit only", counts.verbs === 2, JSON.stringify(counts));
  check("counts: Mixed equals All", counts.mixed === 8, JSON.stringify(counts));

  act(`document.getElementById("flashType").value=""; buildFlash();`);
  check("All deck preserves bank order", JSON.stringify(json("flashList.map(function(w){return w.id;})")) === JSON.stringify(["w1","w2","w3","w4","w5","w6","w7","w8"]));
  check("All chip marked active", chips[""].classList.contains("active") === true && chips.der.classList.contains("active") === false);
  check("count badges updated", countEls[""].textContent === "8" && countEls.verbs.textContent === "2" && countEls.die.textContent === "1", countEls[""].textContent + "/" + countEls.verbs.textContent + "/" + countEls.die.textContent);

  act(`document.getElementById("flashType").value="der"; buildFlash();`);
  check("der deck only reliable der words", JSON.stringify(json("flashList.map(function(w){return w.id;})")) === JSON.stringify(["w1"]));
  check("die deck only reliable die words", (act(`document.getElementById("flashType").value="die"; buildFlash(); flashList.map(function(w){return w.id;}).join(",")`)) === "w2");
  check("das deck only reliable das words", (act(`document.getElementById("flashType").value="das"; buildFlash(); flashList.map(function(w){return w.id;}).join(",")`)) === "w3");
  check("verbs deck excludes -en noun lookalike", (act(`document.getElementById("flashType").value="verbs"; buildFlash(); flashList.map(function(w){return w.id;}).join(",")`)) === "w4,w5");

  act(`document.getElementById("flashType").value="der"; document.getElementById("flashCategory").value="Common Verbs"; buildFlash();`);
  check("empty category has no fallback card", json("flashList.length") === 0);
  check("empty category shows empty state", $("flashEmpty").classList.contains("hidden") === false && $("flashcard").style.display === "none");
  check("empty category counter is 0 / 0", $("flashCounter").textContent === "0 / 0", $("flashCounter").textContent);
  act(`document.getElementById("flashCategory").value=""; buildFlash();`);

  const beforeS = act(`JSON.stringify(S)`);
  const beforeVocab = act(`VOCAB.map(function(w){return w.id;}).join(",")`);
  act(`var _mr=Math.random; Math.random=function(){return 0;}; document.getElementById("flashType").value="mixed"; buildFlash(); Math.random=_mr;`);
  const mixedIds = json("flashList.map(function(w){return w.id;})");
  check("Mixed deck contains every card", mixedIds.length === 8 && new Set(mixedIds).size === 8);
  check("Mixed deck is shuffled", mixedIds.join(",") !== beforeVocab, mixedIds.join(","));
  check("Mixed does not mutate bank order", act(`VOCAB.map(function(w){return w.id;}).join(",")`) === beforeVocab);
  check("Mixed does not mutate saved data/progress", act(`JSON.stringify(S)`) === beforeS);

  act(`document.getElementById("flashType").value="-"; buildFlash();`);
  check("legacy '-' normalizes to All", act(`document.getElementById("flashType").value`) === "" && json("flashList.length") === 8);

  /* Regression: unrelated/generated rows and user-added rows are not silently
     mixed into the image deck. They stay in the full bank (and S.customWords). */
  act(`
    VOCAB.push({id:"lv999999",de:"generiert",art:"der",ar:"مولّد",pron:"",type:"اسم",cat:"Home",ex:"",exAr:"",kap:"K1",level:"A1"});
    S.customWords=[{id:"c999999",de:"MeinWort",art:"das",ar:"كلمتي",pron:"",type:"اسم",cat:"Home",ex:"",exAr:"",kap:"KX",level:"A1"}];
    document.getElementById("flashType").value=""; buildFlash();
  `);
  check("default deck excludes generated vocabulary", json("flashList.every(function(w){return w.id!=='lv999999';})"));
  check("default deck excludes user-added words", json("flashList.every(function(w){return w.id!=='c999999';})"));
  check("default deck stays at the 8 image fixtures", json("flashList.length") === 8 && json("flashCounts()")[""] === 8);
  check("generated/user rows remain in the full bank", json("VOCAB.some(function(w){return w.id==='lv999999';}) && S.customWords.some(function(w){return w.id==='c999999';})"));
  act(`VOCAB.pop(); S.customWords=[]; buildFlash();`);

  act(`document.getElementById("flashType").value=""; buildFlash();`);
  chips["die"]._listeners.click = [];
  $("flashModeChips")._listeners.click[0]({ target: chips["die"] });
  check("chip click switches deck instantly", act(`document.getElementById("flashType").value`) === "die" && json("flashList.length") === 1 && chips.die.classList.contains("active") === true);

  act(`document.getElementById("flashType").value=""; buildFlash(); flashIdx=0;`);
  const flippedBefore = $("flashcard").classList.contains("flipped");
  $("flashcard")._listeners.keydown[0]({ key: " ", target: $("flashcard"), currentTarget: $("flashcard"), preventDefault() {} });
  check("keyboard Space flips the card", $("flashcard").classList.contains("flipped") !== flippedBefore);
  const idxBefore = json("flashIdx");
  $("flashcard")._listeners.keydown[0]({ key: "ArrowRight", target: $("flashcard"), currentTarget: $("flashcard"), preventDefault() {} });
  check("keyboard ArrowRight advances", json("flashIdx") === idxBefore + 1);
} catch (e) {
  check("classification/deck behavior", false, (e && e.message) + " @ " + ((e && e.stack || "").split("\n")[1] || ""));
}

/* ---------- D. Add-word flow ---------- */
function setFields(obj) {
  act(Object.keys(obj).map(k => `document.getElementById(${JSON.stringify(k)}).value=${JSON.stringify(String(obj[k]))};`).join(""));
}
try {
  act(`
    document.getElementById("flashType").value="";
    document.getElementById("flashCategory").value="";
    document.getElementById("flashKapitel").value="";
    document.getElementById("flashLevel").value="";
    S.customWords=[]; buildFlash();
    document.getElementById("wordModal").classList.add("hidden");
    document.getElementById("openAddWord")._listeners.click[0]({});
  `);
  check("add-word opens modal", $("wordModal").classList.contains("hidden") === false);

  setFields({ nwDe: "der Schrank", nwAr: "خزانة", nwArt: "die", nwType: "اسم", nwCat: "Home", nwLevel: "A2", nwPron: "شرانك", nwEx: "Der Schrank ist alt.", nwExAr: "الخزانة قديمة." });
  $("addWordBtn")._listeners.click[0]({});
  const w1 = json("S.customWords[0] || null");
  check("save succeeds and appends word", !!w1 && w1.de === "Schrank", JSON.stringify(w1));
  check("typed article overrides selector + is stored", w1 && w1.art === "der" && act(`document.getElementById("nwArt").value`) === "der", w1 && w1.art);
  check("modal stays open after save", $("wordModal").classList.contains("hidden") === false);
  check("word-specific inputs cleared", ["nwDe", "nwAr", "nwPron", "nwEx", "nwExAr"].every(id => $("" + id).value === ""));
  check("category/type/level retained", act(`document.getElementById("nwCat").value`) === "Home" && act(`document.getElementById("nwType").value`) === "اسم" && act(`document.getElementById("nwLevel").value`) === "A2");
  check("inline success shown", /(^|\s)ok(\s|$)/.test($("addWordStatus").className) && $("addWordStatus").textContent.indexOf("✅") >= 0, $("addWordStatus").textContent);
  check("success is durable in storage", /Schrank/.test(store[Object.keys(store)[0]] || ""));

  setFields({ nwDe: "die Blume", nwAr: "زهرة", nwArt: "der", nwType: "اسم", nwCat: "Nature", nwLevel: "A1" });
  $("addWordBtn")._listeners.click[0]({});
  check("second consecutive save stays on screen", json("S.customWords.length") === 2 && $("wordModal").classList.contains("hidden") === false && /(^|\s)ok(\s|$)/.test($("addWordStatus").className));
  check("second word keeps typed article", json("S.customWords[1].art") === "die");

  setFields({ nwDe: "rennen", nwAr: "يركض", nwArt: "der", nwType: "فعل", nwCat: "Common Verbs", nwLevel: "A1" });
  $("addWordBtn")._listeners.click[0]({});
  check("verb marking saves art '-'", json("S.customWords[2].art") === "-" && json("S.customWords[2].type") === "فعل");
  check("saved user words stay out of the default image deck", json("flashList.every(function(w){return w.de!=='Schrank'&&w.de!=='Blume'&&w.de!=='rennen';})"));
  check("default verb count stays at 2", json("flashCounts().verbs") === 2 && countEls.verbs.textContent === "2", json("flashCounts().verbs") + "/" + countEls.verbs.textContent);
  act(`document.getElementById("flashKapitel").value="KX"; buildFlash();`);
  check("KX separate deck contains all three saved words", json("flashList.length") === 3, String(json("flashList.length")));
  check("KX deck verb count is 1", json("flashCounts().verbs") === 1 && countEls.verbs.textContent === "1", json("flashCounts().verbs") + "/" + countEls.verbs.textContent);
  act(`document.getElementById("flashKapitel").value=""; buildFlash();`);

  /* Regression: non-noun types must never inherit the preserved article
     selector. The default image deck excludes all user words, so the rule is
     verified in the explicit KX user-words deck. */
  act(`document.getElementById("flashKapitel").value="KX"; buildFlash();`);
  const beforeAdj = json("flashCounts()");
  setFields({ nwDe: "schnelltest", nwAr: "اختبار سريع", nwArt: "die", nwType: "صفة", nwCat: "Adjectives", nwLevel: "A1" });
  $("addWordBtn")._listeners.click[0]({});
  act(`document.getElementById("flashKapitel").value="KX"; buildFlash();`);
  const adj = json("S.customWords[S.customWords.length-1] || null");
  check("non-noun marking saves art '-'", !!adj && adj.de === "schnelltest" && adj.art === "-" && adj.type === "صفة", JSON.stringify(adj));
  check("non-noun keeps article selector for the next word", act(`document.getElementById("nwArt").value`) === "die");
  check("non-noun is not article-bearing", js(`flashArticle(S.customWords[S.customWords.length-1])`) === "");
  const afterAdj = json("flashCounts()");
  check("non-noun leaves der/die/das counts unchanged", afterAdj.der === beforeAdj.der && afterAdj.die === beforeAdj.die && afterAdj.das === beforeAdj.das, JSON.stringify({ before: beforeAdj, after: afterAdj }));
  check("non-noun increments KX All and Mixed only", afterAdj[""] === beforeAdj[""] + 1 && afterAdj.mixed === beforeAdj.mixed + 1, JSON.stringify({ before: beforeAdj, after: afterAdj }));
  const adjDecks = json(`(function(){var w=S.customWords[S.customWords.length-1];var out={};["der","die","das","verbs","","mixed"].forEach(function(m){out[m||"all"]=flashPool().filter(function(x){return flashModeMatch(x,m)&&x.id===w.id;}).length;});return out;})()`);
  check("non-noun enters KX All and Mixed exactly once", adjDecks.all === 1 && adjDecks.mixed === 1, JSON.stringify(adjDecks));
  check("non-noun never enters article/verb decks", adjDecks.der === 0 && adjDecks.die === 0 && adjDecks.das === 0 && adjDecks.verbs === 0, JSON.stringify(adjDecks));
  check("non-noun is not duplicated into the bank", json("VOCAB.some(function(w){return w.de==='schnelltest';})") === false && json("flashPool().filter(function(w){return w.de==='schnelltest';}).length") === 1);
  check("non-noun chip counts match classification", countEls.die.textContent === String(afterAdj.die) && countEls[""].textContent === String(afterAdj[""]) && countEls.mixed.textContent === String(afterAdj.mixed), countEls.die.textContent + "/" + countEls[""].textContent + "/" + countEls.mixed.textContent);
  const storedAdj = (function () {
    for (const k of Object.keys(store)) {
      try {
        const p = JSON.parse(store[k]);
        if (p && Array.isArray(p.customWords)) {
          const hit = p.customWords.filter(w => w.de === "schnelltest");
          if (hit.length) return hit[hit.length - 1];
        }
      } catch (e) {}
    }
    return null;
  })();
  check("non-noun persisted with art '-'", !!storedAdj && storedAdj.art === "-" && storedAdj.type === "صفة", JSON.stringify(storedAdj));

  /* Same rule for another non-noun category (pronoun). */
  const beforePron = json("flashCounts()");
  setFields({ nwDe: "meinwort", nwAr: "كلمتي", nwArt: "der", nwType: "ضمير", nwCat: "General", nwLevel: "A1" });
  $("addWordBtn")._listeners.click[0]({});
  act(`document.getElementById("flashKapitel").value="KX"; buildFlash();`);
  const pron = json("S.customWords[S.customWords.length-1] || null");
  check("pronoun marking saves art '-'", !!pron && pron.art === "-" && pron.type === "ضمير", JSON.stringify(pron));
  const afterPron = json("flashCounts()");
  check("pronoun leaves article counts unchanged", afterPron.der === beforePron.der && afterPron.die === beforePron.die && afterPron.das === beforePron.das, JSON.stringify({ before: beforePron, after: afterPron }));
  check("pronoun never enters der deck", json("flashPool().filter(function(w){return flashModeMatch(w,'der')&&w.de==='meinwort';}).length") === 0);

  /* Nouns still classify by article, including a typed article override. */
  const beforeDas = json("flashCounts()");
  setFields({ nwDe: "das Testkissen", nwAr: "وسادة اختبار", nwArt: "der", nwType: "اسم", nwCat: "Home", nwLevel: "A1" });
  $("addWordBtn")._listeners.click[0]({});
  act(`document.getElementById("flashKapitel").value="KX"; buildFlash();`);
  const dasWord = json("S.customWords[S.customWords.length-1] || null");
  check("typed neuter article is stored", !!dasWord && dasWord.de === "Testkissen" && dasWord.art === "das", JSON.stringify(dasWord));
  const afterDas = json("flashCounts()");
  check("neuter noun increments das count", afterDas.das === beforeDas.das + 1 && afterDas.der === beforeDas.der && afterDas.die === beforeDas.die, JSON.stringify({ before: beforeDas, after: afterDas }));
  check("neuter noun enters das deck exactly once", json("flashPool().filter(function(w){return flashModeMatch(w,'das')&&w.de==='Testkissen';}).length") === 1);

  /* An article-less noun stays unclassified: not a verb, not an article deck. */
  const beforeBare = json("flashCounts()");
  setFields({ nwDe: "Testwasser", nwAr: "ماء اختبار", nwArt: "-", nwType: "اسم", nwCat: "Food", nwLevel: "A1" });
  $("addWordBtn")._listeners.click[0]({});
  act(`document.getElementById("flashKapitel").value="KX"; buildFlash();`);
  const bare = json("S.customWords[S.customWords.length-1] || null");
  check("article-less noun stays unclassified", !!bare && bare.art === "-" && js(`flashArticle(S.customWords[S.customWords.length-1])`) === "", JSON.stringify(bare));
  const afterBare = json("flashCounts()");
  check("article-less noun is not counted as a verb", afterBare.verbs === beforeBare.verbs && afterBare.der === beforeBare.der && afterBare.die === beforeBare.die && afterBare.das === beforeBare.das, JSON.stringify({ before: beforeBare, after: afterBare }));
  const bareDecks = json(`(function(){var w=S.customWords[S.customWords.length-1];var out={};["der","die","das","verbs","","mixed"].forEach(function(m){out[m||"all"]=flashPool().filter(function(x){return flashModeMatch(x,m)&&x.id===w.id;}).length;});return out;})()`);
  check("article-less noun only enters KX All/Mixed", bareDecks.all === 1 && bareDecks.mixed === 1 && bareDecks.der === 0 && bareDecks.die === 0 && bareDecks.das === 0 && bareDecks.verbs === 0, JSON.stringify(bareDecks));

  act(`document.getElementById("flashKapitel").value=""; buildFlash();`);
  check("default image deck still excludes adapted non-nouns", json("flashList.every(function(w){return ['schnelltest','meinwort','Testkissen','Testwasser'].indexOf(w.de)<0;})"));

  const beforeDup = json("S.customWords.length");
  setFields({ nwDe: "der Schrank", nwAr: "خزانة", nwArt: "der", nwType: "اسم" });
  $("addWordBtn")._listeners.click[0]({});
  check("duplicate word rejected", json("S.customWords.length") === beforeDup);
  check("duplicate status is an error", /(^|\s)err(\s|$)/.test($("addWordStatus").className), $("addWordStatus").textContent);
  check("duplicate keeps input for correction", act(`document.getElementById("nwDe").value`) === "der Schrank");

  act(`globalThis.__realSaveFlushed=saveFlushed; saveFlushed=function(){return false;};`);
  const beforeFail = json("S.customWords.length");
  setFields({ nwDe: "Regal", nwAr: "رف", nwArt: "das", nwType: "اسم" });
  $("addWordBtn")._listeners.click[0]({});
  check("failed save rolls back list", json("S.customWords.length") === beforeFail, json("S.customWords.length"));
  check("failed save preserves word input", act(`document.getElementById("nwDe").value`) === "Regal" && act(`document.getElementById("nwAr").value`) === "رف");
  check("failed save shows error, not success", /(^|\s)err(\s|$)/.test($("addWordStatus").className) && !/(^|\s)ok(\s|$)/.test($("addWordStatus").className));
  check("failed save re-enables button", $("addWordBtn").disabled === false && !$("addWordBtn").getAttribute("aria-busy"));
  act(`saveFlushed=globalThis.__realSaveFlushed;`);

  const beforeDouble = json("S.customWords.length");
  setFields({ nwDe: "Lampe", nwAr: "مصباح", nwArt: "die", nwType: "اسم" });
  $("addWordBtn")._listeners.click[0]({});
  $("addWordBtn")._listeners.click[0]({});
  check("double submit adds only one word", json("S.customWords.length") === beforeDouble + 1, json("S.customWords.length"));

  check("new words are NOT mixed into the image All deck", json("flashList.some(function(w){return w.de==='Schrank';})") === false);
  act(`document.getElementById("flashKapitel").value="KX"; buildFlash();`);
  check("new words are in the separate KX deck", json("flashList.some(function(w){return w.de==='Schrank';})") === true);
  act(`document.getElementById("flashKapitel").value=""; buildFlash();`);
  check("add-word does not auto-close modal", $("wordModal").classList.contains("hidden") === false);
} catch (e) {
  check("add-word behavior", false, (e && e.message) + " @ " + ((e && e.stack || "").split("\n")[1] || ""));
}

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
process.exit(fail ? 1 : 0);
