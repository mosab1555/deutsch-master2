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
check("renderFlash branches on direction", /flashDir\(\)!=="ar-de"/.test(script));
check("flashDir listener wired", /\$\("flashDir"\)\.addEventListener/.test(script));
check("deck builders untouched by direction", !/flashDir/.test((script.match(/function buildFlash\(\)\{[\s\S]*?\n\}/) || [""])[0]) && !/flashDir/.test((script.match(/function refreshFlashList\(\)\{[\s\S]*?\n\} catch/) || [""])[0]));
check("rating path untouched", /data-flash-rate/.test(script) && /bumpReview\(w\.id/.test(script));

/* ---------- D. behavioral test with stub DOM ---------- */
function mkNode(tag, attrs) {
  const n = {
    tag, attrs: attrs || {}, children: [], _listeners: {},
    textContent: "", _html: "", value: "", className: "",
    style: {}, dataset: {}, hidden: false, disabled: false,
    _cls: {},
    classList: { add(c) { this._s = this._s || {}; this._s[c] = 1; }, remove(c) { if (this._s) delete this._s[c]; }, toggle(c) { this._s = this._s || {}; if (this._s[c]) delete this._s[c]; else this._s[c] = 1; return !!this._s[c]; }, contains(c) { return !!(this._s && this._s[c]); } },
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
    check(pg + " front example element", h.indexOf('id="flashExFront"') >= 0);
    for (const bid of ["flashSayWFront", "flashSaySFront", "flashSayWBack", "flashSaySBack"]) {
      check(pg + " button #" + bid, h.indexOf('id="' + bid + '"') >= 0);
    }
  }
  check("unified flashcard click handles audio", /flashSayFace\(.*sw\?"word":"sent"\)/.test(script));
  check("flashFaceLang/flashSayFace/speakAr defined", /function flashFaceLang\(/.test(script) && /function flashSayFace\(/.test(script) && /function speakAr\(/.test(script));
  check("no per-button audio bindings", !/querySelectorAll\("\[data-say-/.test(script));
  check("no stale say helpers", !/flashSayWord|flashSaySent/.test(script));
  for (const L of ["ar", "en", "de"]) {
    const dm = study.match(new RegExp(L + ":\\{((?:[^{}]|\\{[^{}]*\\})*)\\}"));
    const body = dm ? dm[1] : "";
    check("i18n." + L + " has flash_say_word", body.indexOf("flash_say_word") >= 0);
    check("i18n." + L + " has flash_say_sent", body.indexOf("flash_say_sent") >= 0);
  }
  // behavioral with REAL TTS path: capture utterances incl. voice language
  act(`globalThis.__utt=[];
    function SpeechSynthesisUtterance(t){ this.text=t; this.lang=""; this.rate=1; this.voice=null; }
    window.speechSynthesis={ cancel:function(){}, getVoices:function(){return [];}, speak:function(u){ globalThis.__utt.push({text:u.text,lang:u.lang}); } };`);
  act(`VOCAB.push({id:"w3",de:"wohnen",art:"-",ar:"يسكن",pron:"فونِن",type:"فعل",cat:"Common Verbs",ex:"Sie wohnt in Tanta.",exAr:"هي تسكن في طنطا.",kap:"K1",level:"A1",plural:"",img:""});`);
  act(`VOCAB.push({id:"w4",de:"Licht",art:"das",ar:"ضوء",pron:"لِشت",type:"اسم",cat:"Home",ex:"Das Licht ist an.",exAr:"",kap:"K4",level:"A1",plural:"die Lichter",img:""});`);
  act(`flashList=[VOCAB[2]]; flashIdx=0; renderFlash();`);
  const utt = () => vm.runInContext(`globalThis.__utt.slice()`, ctx);
  const frontTxt = () => vm.runInContext(`document.getElementById("flashWord").textContent`, ctx);
  const say = (face, kind) => act(`globalThis.__utt=[]; flashSayFace(${JSON.stringify(face)},${JSON.stringify(kind)});`);
  // de-ar: front=German, back=Arabic
  act(`if(flashDir()!=="de-ar")toggleFlashDir(); renderFlash();`);
  check("G de front shows German word", frontTxt() === "wohnen", frontTxt());
  check("G de front shows German example", vm.runInContext(`document.getElementById("flashExFront").textContent`, ctx) === "Sie wohnt in Tanta.");
  say("front", "word");
  check("G de-front word: de-DE + word only", JSON.stringify(utt()) === JSON.stringify([{ text: "wohnen", lang: "de-DE" }]), JSON.stringify(utt()));
  say("front", "sent");
  check("G de-front sent: de-DE + example only", JSON.stringify(utt()) === JSON.stringify([{ text: "Sie wohnt in Tanta.", lang: "de-DE" }]), JSON.stringify(utt()));
  say("back", "word");
  check("G de-back word: ar voice + Arabic word", JSON.stringify(utt()) === JSON.stringify([{ text: "يسكن", lang: "ar" }]), JSON.stringify(utt()));
  say("back", "sent");
  check("G de-back sent: ar voice + Arabic example", JSON.stringify(utt()) === JSON.stringify([{ text: "هي تسكن في طنطا.", lang: "ar" }]), JSON.stringify(utt()));
  // ar-de: front=Arabic, back=German
  act(`toggleFlashDir();`);
  check("G ar front shows Arabic word", frontTxt() === "يسكن", frontTxt());
  check("G ar front shows Arabic example", vm.runInContext(`document.getElementById("flashExFront").textContent`, ctx) === "هي تسكن في طنطا.");
  check("G ar back shows German word", vm.runInContext(`document.getElementById("flashAr").textContent`, ctx) === "wohnen");
  check("G ar back shows German example", vm.runInContext(`document.getElementById("flashEx").textContent`, ctx) === "Sie wohnt in Tanta.");
  say("front", "word");
  check("G ar-front word: ar voice", JSON.stringify(utt()) === JSON.stringify([{ text: "يسكن", lang: "ar" }]), JSON.stringify(utt()));
  say("front", "sent");
  check("G ar-front sent: ar voice", JSON.stringify(utt()) === JSON.stringify([{ text: "هي تسكن في طنطا.", lang: "ar" }]), JSON.stringify(utt()));
  say("back", "word");
  check("G ar-back word: de-DE voice", JSON.stringify(utt()) === JSON.stringify([{ text: "wohnen", lang: "de-DE" }]), JSON.stringify(utt()));
  say("back", "sent");
  check("G ar-back sent: de-DE voice", JSON.stringify(utt()) === JSON.stringify([{ text: "Sie wohnt in Tanta.", lang: "de-DE" }]), JSON.stringify(utt()));
  // flip x3 across directions: mapping stays fresh
  for (let r = 0; r < 3; r++) {
    act(`toggleFlashDir(); document.getElementById("flashcard").classList.toggle("flipped"); renderFlash();`);
    const d = act(`flashDir();`);
    say("front", "word");
    const u = utt()[0];
    const expectLang = d === "de-ar" ? "de-DE" : "ar";
    const expectTxt = d === "de-ar" ? "wohnen" : "يسكن";
    check("G flip round " + (r + 1) + " (" + d + ")", u && u.lang === expectLang && u.text === expectTxt, JSON.stringify(u));
  }
  // missing Arabic example: safe (hidden button, no speech)
  act(`if(flashDir()!=="ar-de")toggleFlashDir(); flashList=[VOCAB[3]]; flashIdx=0; renderFlash();`);
  check("G missing exAr hides ar sent button", vm.runInContext(`document.getElementById("flashSaySFront").style.display||""`, ctx) === "none");
  const nUtt = utt().length;
  const okMiss = act(`flashSayFace("front","sent");`);
  check("G missing exAr speaks nothing", okMiss === false && utt().length === nUtt, String(okMiss));
  // delegation: audio clicks stop + never flip; plain clicks flip; one listener
  const nLis = act(`document.getElementById("flashcard")._listeners.click.length`);
  check("G single card click listener", nLis === 1, String(nLis));
  const simRes = act(`(function(){
    var out={stopped:0,flipped0:document.getElementById("flashcard").classList.contains("flipped")};
    function fakeBtn(face,kind){return {closest:function(s){ if(s==="[data-say-word]"&&kind==="word")return {}; if(s==="[data-say-sent]"&&kind==="sent")return {}; if(s===".flash-back")return face==="back"?{}:null; return null; }};}
    function fire(target){var e={target:target,stopPropagation:function(){out.stopped++;}};var l=document.getElementById("flashcard")._listeners.click;for(var i=0;i<l.length;i++)l[i](e);}
    globalThis.__utt=[];
    fire(fakeBtn("front","word"));
    out.wordUtt=globalThis.__utt.slice();
    fire(fakeBtn("front","sent"));
    out.sentUtt=globalThis.__utt.slice();
    out.flippedAfterAudio=document.getElementById("flashcard").classList.contains("flipped")!==out.flipped0?"CHANGED":"same";
    fire({closest:function(){return null;}});
    out.flippedAfterPlain=document.getElementById("flashcard").classList.contains("flipped")!==out.flipped0?"CHANGED":"same";
    return JSON.stringify(out);
  })()`);
  const sim = JSON.parse(simRes);
  check("G audio clicks stopPropagation", sim.stopped === 2, JSON.stringify(sim));
  check("G audio clicks never flip", sim.flippedAfterAudio === "same", JSON.stringify(sim));
  check("G plain click flips", sim.flippedAfterPlain === "CHANGED", JSON.stringify(sim));
  check("G delegated word speaks face word (ar-de front)", JSON.stringify(sim.wordUtt) === JSON.stringify([{ text: "ضوء", lang: "ar" }]), JSON.stringify(sim.wordUtt));
} catch (e) { check("audio setup", false, e.message); }
const css = RD("client/style.css");
check("row-flex wraps (no h-scroll)", /\.row-flex\{[^}]*flex-wrap:\s*wrap/.test(css));
check("flash-controls wraps", /\.flash-controls\{[^}]*flex-wrap:\s*wrap/.test(css));
check("no new fixed-width flash CSS", !/flashDir/.test(css));

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
