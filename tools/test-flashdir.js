/* Flash Cards direction test (AR<->DE toggle).
 * Verifies: button exists in both pages, i18n keys in ar/en/de,
 * front/back swap both ways, toggle, persistence round-trip,
 * deck integrity (no dup/no loss), rating path intact, mobile-safe markup.
 * Run: node tools/test-flashdir.js (from project root) */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

/* ---------- A. HTML markup (both pages) ---------- */
for (const page of ["client/index.html", "client/academy.html"]) {
  const html = RD(page);
  const sec = html.split('id="page-flashcards"')[1] || "";
  const secHtml = sec.split("</section>")[0];
  const hasBtn = /<button[^>]*id="flashDir"[^>]*>/.test(secHtml);
  check(page + " has #flashDir in flashcards section", hasBtn);
  const m = secHtml.match(/<button[^>]*id="flashDir"[^>]*>/);
  const tag = m ? m[0] : "";
  check(page + " button uses btn classes", /btn-ghost/.test(tag) && /\bsm\b/.test(tag), tag);
  check(page + " button has no inline width", !/style\s*=/.test(tag) && !/width/.test(tag), tag);
  check(page + " button label non-empty", />[^<]{2,}</.test(secHtml.slice(secHtml.indexOf('id="flashDir"'), secHtml.indexOf('id="flashDir"') + 200)));
  check(page + " no duplicate flashDir ids", (secHtml.match(/id="flashDir"/g) || []).length === 1);
}

/* ---------- B. i18n keys ---------- */
const study = RD("client/study.js");
for (const L of ["ar", "en", "de"]) {
  const dm = study.match(new RegExp(L + ":\\{((?:[^{}]|\\{[^{}]*\\})*)\\}"));
  const body = dm ? dm[1] : "";
  check("i18n." + L + " has flash_dir_ar_de", body.indexOf("flash_dir_ar_de") >= 0);
  check("i18n." + L + " has flash_dir_de_ar", body.indexOf("flash_dir_de_ar") >= 0);
}
check("ensureStudy defaults flashDir", /S\.flashDir\s*=\s*"de-ar"/.test(study));
check("applyLang refreshes dir button", study.indexOf("updateFlashDirBtn") >= 0);

/* ---------- C. script.js wiring (text) ---------- */
const script = RD("client/script.js");
check("flashDir() defined", /function flashDir\(\)/.test(script));
check("toggleFlashDir() defined", /function toggleFlashDir\(\)/.test(script));
check("updateFlashDirBtn() defined", /function updateFlashDirBtn\(\)/.test(script));
check("renderFlash branches on direction", /flashDir\(\)==="ar-de"/.test(script));
check("flashDir listener wired", /\$\("flashDir"\)\.addEventListener/.test(script));
check("deck builders untouched by direction", !/flashDir/.test((script.match(/function buildFlash\(\)\{[\s\S]*?\n\}/) || [""])[0]) && !/flashDir/.test((script.match(/function refreshFlashList\(\)\{[\s\S]*?\n\} catch/) || [""])[0]));
check("rating path untouched", /data-flash-rate/.test(script) && /bumpReview\(w\.id/.test(script));

/* ---------- D. behavioral test with stub DOM ---------- */
function mkNode(tag, attrs) {
  return {
    tag, attrs: attrs || {}, children: [], _listeners: {},
    textContent: "", innerHTML: "", value: "", className: "",
    style: {}, dataset: {}, hidden: false, disabled: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; },
    addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return mkNode("div", {}); },
    querySelectorAll() { return []; },
    closest() { return null; },
    remove() {}, click() {}, focus() {},
    contains() { return false; }
  };
}
const ids = {};
function $(id) { if (!ids[id]) ids[id] = mkNode("div", { id }); return ids[id]; }
const store = {};
const timers = [];
const sb = {
  console,
  setTimeout: (f) => { timers.push(f); return timers.length; },
  clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  navigator: {}, location: {},
  document: {
    getElementById: (id) => $(id),
    querySelector: (s) => {
      if (s === "[data-speak-flash]") return $("__spkF");
      if (s === "[data-speak-flash-ex]") return $("__spkB");
      return mkNode("div", {});
    },
    querySelectorAll: () => [],
    createElement: (t) => mkNode(t, {}),
    addEventListener: () => {},
    documentElement: mkNode("html", {}),
    body: mkNode("body", {}),
    title: ""
  }
};
sb.window = sb;
sb.globalThis = sb;
const ctx = vm.createContext(sb);
function flush() { let n = 0; while (timers.length && n++ < 50) timers.shift()(); timers.length = 0; }
function act(js) { timers.length = 0; const r = vm.runInContext(js, ctx); flush(); return r; }
try {
  vm.runInContext(RD("client/script.js"), ctx, { filename: "script.js" });
  check("script.js loads under stubs", true);
} catch (e) { check("script.js loads under stubs", false, e.message); }
try {
  act(`
    Object.keys(S).forEach(function(k){ delete S[k]; });
    VOCAB.length = 0;
    VOCAB.push(
      {id:"w1",de:"Tisch",art:"der",ar:"الطاولة",pron:"تيش",type:"اسم",cat:"Home",ex:"Der Tisch ist neu.",exAr:"الطاولة جديدة.",kap:"K5",level:"A1",plural:"die Tische",img:""},
      {id:"w2",de:"gehen",art:"-",ar:"يذهب",pron:"جيهِن",type:"فعل",cat:"Common Verbs",ex:"Wir gehen.",exAr:"نحن نذهب.",kap:"K1",level:"A1",plural:"",img:""}
    );
    if (typeof ensureStudy === "function") ensureStudy();
  `, ctx);
  // need $ accessible; script.js defined it globally in ctx
  act(`buildFlash(); flashList.sort(function(a,b){return a.id<b.id?-1:1;}); flashIdx=0; renderFlash();`);
  const g = (id) => act(`document.getElementById("${id}").textContent`, ctx);
  const disp = (id) => act(`document.getElementById("${id}").style.display||""`, ctx);
  // D1 default de-ar
  check("D1 default front is German", g("flashWord") === "der Tisch", g("flashWord"));
  check("D1 default back is Arabic", g("flashAr") === "الطاولة", g("flashAr"));
  check("D1 default plural shown", g("flashPlural") === "die Tische", g("flashPlural"));
  // D2 toggle to ar-de
  act(`toggleFlashDir();`);
  check("D2 ar-de front is Arabic", g("flashWord") === "الطاولة", g("flashWord"));
  check("D2 ar-de article hidden", disp("flashArticle") === "none", disp("flashArticle"));
  check("D2 ar-de plural cleared", g("flashPlural") === "", g("flashPlural"));
  check("D2 ar-de back is German", g("flashAr") === "der Tisch", g("flashAr"));
  check("D2 S.flashDir persisted", /"flashDir":"ar-de"/.test(store[Object.keys(store)[0]] || ""), JSON.stringify(store).slice(0,120));
  const dirLabel = act(`document.getElementById("flashDir").textContent`, ctx);
  check("D2 button label switches", dirLabel.indexOf("عربي") >= 0 && dirLabel.indexOf("ألماني") >= 0, dirLabel);
  // D3 toggle back
  act(`toggleFlashDir();`);
  check("D3 back to German front", g("flashWord") === "der Tisch", g("flashWord"));
  check("D3 article restored", disp("flashArticle") === "", disp("flashArticle") || "(visible)");
  check("D3 plural restored", g("flashPlural") === "die Tische", g("flashPlural"));
  // D4 reload persistence: fresh S from storage
  const savedKey = Object.keys(store)[0];
  const savedVal = store[savedKey];
  act(`Object.keys(S).forEach(function(k){ delete S[k]; });`, ctx);
  act(`Object.assign(S, JSON.parse(${JSON.stringify(savedVal)})); renderFlash();`);
  check("D4 reload keeps saved direction key", /"flashDir":"de-ar"/.test(savedVal || ""), "info");
  act(`toggleFlashDir();`);
  const saved2 = store[Object.keys(store)[0]];
  act(`Object.keys(S).forEach(function(k){ delete S[k]; }); Object.assign(S, JSON.parse(${JSON.stringify(saved2)})); renderFlash();`);
  check("D4 reload restores saved direction", g("flashWord") === "الطاولة", g("flashWord"));
  // D5 deck integrity: same ids, no dup, counter stable
  const deckInfo = act(`JSON.stringify({n:flashList.length, ids:flashList.map(w=>w.id), counter: document.getElementById("flashCounter").textContent})`, ctx);
  const di = JSON.parse(deckInfo);
  check("D5 deck size intact (2)", di.n === 2, deckInfo);
  check("D5 no duplicate cards", new Set(di.ids).size === di.ids.length, deckInfo);
  check("D5 counter valid", /1 \/ 2/.test(di.counter), di.counter);
  // D6 i18n labels via injected t()
  act(`globalThis.t = function(k){ var M={"flash_dir_ar_de":"L-AR-DE","flash_dir_de_ar":"L-DE-AR"}; return M[k]||k; }; updateFlashDirBtn();`, ctx);
  const lb1 = act(`document.getElementById("flashDir").textContent`, ctx);
  check("D6 label via t() (ar-de active)", lb1 === "L-AR-DE", lb1);
  act(`toggleFlashDir();`);
  const lb2 = act(`document.getElementById("flashDir").textContent`, ctx);
  check("D6 label via t() (de-ar active)", lb2 === "L-DE-AR", lb2);
} catch (e) { check("behavioral run", false, (e && e.message) + " @ " + (e && e.stack || "").split("\n")[1]); }

/* ---------- G. separate word/sentence audio (both directions) ---------- */
try {
  // structural: exactly one word+sentence pair per face, both pages
  for (const pg of ["client/index.html", "client/academy.html"]) {
    const h = RD(pg).split('id="page-flashcards"')[1].split("</section>")[0];
    check(pg + " 2x data-say-word (one per face)", (h.match(/data-say-word/g) || []).length === 2, String((h.match(/data-say-word/g) || []).length));
    check(pg + " 2x data-say-sent (one per face)", (h.match(/data-say-sent/g) || []).length === 2, String((h.match(/data-say-sent/g) || []).length));
  }
  check("script binds all say buttons", /querySelectorAll\("\[data-say-word\]"\)/.test(script) && /querySelectorAll\("\[data-say-sent\]"\)/.test(script));
  check("renderFlash never rebuilds say buttons", (script.match(/sayrow/g) || []).length === 0);
  for (const L of ["ar", "en", "de"]) {
    const dm = study.match(new RegExp(L + ":\\{((?:[^{}]|\\{[^{}]*\\})*)\\}"));
    const body = dm ? dm[1] : "";
    check("i18n." + L + " has flash_say_word", body.indexOf("flash_say_word") >= 0);
    check("i18n." + L + " has flash_say_sent", body.indexOf("flash_say_sent") >= 0);
  }
  // behavioral: wohnen card (mirrors the requirement example)
  act(`VOCAB.push({id:"w3",de:"wohnen",art:"-",ar:"يسكن",pron:"فونِن",type:"فعل",cat:"Common Verbs",ex:"Sie wohnt in Tanta.",exAr:"هي تسكن في طنطا.",kap:"K1",level:"A1",plural:"",img:""}); flashList=[VOCAB[2]]; flashIdx=0; renderFlash();`);
  act(`globalThis.__spoken=[]; speak=function(t){ globalThis.__spoken.push(String(t)); };`);
  const said = () => vm.runInContext(`globalThis.__spoken.slice()`, ctx);
  const frontTxt = () => vm.runInContext(`document.getElementById("flashWord").textContent`, ctx);
  act(`if(flashDir()!=="de-ar")toggleFlashDir(); renderFlash();`);
  check("G de-ar front shows German word", frontTxt() === "wohnen", frontTxt());
  act(`flashSayWord();`);
  check("G de-ar word button speaks German word", JSON.stringify(said()) === JSON.stringify(["wohnen"]), JSON.stringify(said()));
  act(`flashSaySent();`);
  check("G de-ar sentence button speaks example only", JSON.stringify(said()) === JSON.stringify(["wohnen", "Sie wohnt in Tanta."]), JSON.stringify(said()));
  act(`toggleFlashDir();`);
  check("G ar-de front shows Arabic", frontTxt() === "يسكن", frontTxt());
  act(`globalThis.__spoken=[]; flashSayWord();`);
  check("G ar-de word button speaks German (not face text)", JSON.stringify(said()) === JSON.stringify(["wohnen"]), JSON.stringify(said()));
  act(`flashSaySent();`);
  check("G ar-de sentence button speaks example", JSON.stringify(said()) === JSON.stringify(["wohnen", "Sie wohnt in Tanta."]), JSON.stringify(said()));
  act(`flashList=[VOCAB[0],VOCAB[1]]; flashIdx=1; renderFlash(); document.getElementById("flashcard").classList.toggle("flipped");`);
  act(`flashSayWord();`);
  const said2 = said();
  check("G after flip+next, word audio follows card", said2[said2.length - 1] === "gehen", JSON.stringify(said2));
  // click path: stub buttons + real binding lines (stopPropagation, independence)
  act(`(function(){
    globalThis.__bw=[{h:[],addEventListener:function(t,f){this.h.push(f);},click:function(e){e=e||{stopPropagation:function(){}};this.h.forEach(function(f){f(e);});}}];
    globalThis.__bs=[{h:[],addEventListener:function(t,f){this.h.push(f);},click:function(e){e=e||{stopPropagation:function(){}};this.h.forEach(function(f){f(e);});}}];
    globalThis.__realQSA=document.querySelectorAll;
    document.querySelectorAll=function(s){ if(s==="[data-say-word]")return globalThis.__bw; if(s==="[data-say-sent]")return globalThis.__bs; return globalThis.__realQSA(s); };
  })();`);
  act(`document.querySelectorAll("[data-say-word]").forEach(function(b){b.addEventListener("click",function(e){e.stopPropagation();flashSayWord();});});
       document.querySelectorAll("[data-say-sent]").forEach(function(b){b.addEventListener("click",function(e){e.stopPropagation();flashSaySent();});});`);
  act(`globalThis.__spoken=[]; globalThis.__bw[0].click();`);
  check("G click word speaks only word", JSON.stringify(said()) === JSON.stringify(["gehen"]), JSON.stringify(said()));
  act(`globalThis.__bs[0].click();`);
  check("G click sentence speaks only example", JSON.stringify(said()) === JSON.stringify(["gehen", "Wir gehen."]), JSON.stringify(said()));
  act(`document.querySelectorAll=globalThis.__realQSA;`);
} catch (e) { check("audio setup", false, e.message); }
const css = RD("client/style.css");
check("row-flex wraps (no h-scroll)", /\.row-flex\{[^}]*flex-wrap:\s*wrap/.test(css));
check("flash-controls wraps", /\.flash-controls\{[^}]*flex-wrap:\s*wrap/.test(css));
check("no new fixed-width flash CSS", !/flashDir/.test(css));

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
