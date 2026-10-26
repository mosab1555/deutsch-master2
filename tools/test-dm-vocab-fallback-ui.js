/* Deutsch Master — vocabulary-page external fallback UI test.
 * Real client/ + real DOM in headless Chrome. MyMemory is fully stubbed:
 * deterministic fixtures, no live API calls. Asserts local search remains
 * intact, the fallback is a labelled sibling (not a saved card), exact query
 * and encoding are correct, de->ar and ar->de work, and loading / empty /
 * network / rate-limit / stale / debounce / offline / i18n states behave.
 * Run: node tools/test-dm-vocab-fallback-ui.js
 * Exit 0 = PASS, 1 = FAIL.
 */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19344;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

let pass = 0, fail = 0;
function ok(n, c, e) {
  if (c) { pass++; console.log("PASS " + n + (e ? "  [" + String(e).slice(0, 240) + "]" : "")); }
  else { fail++; console.log("FAIL " + n + (e ? "  [" + String(e).slice(0, 320) + "]" : "")); }
}

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(req.url.split("?")[0]);
        if (p === "/") p = "/index.html";
        const fp = path.normalize(path.join(CLIENT, p.replace(/^\//, "")));
        if (!fp.startsWith(CLIENT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
          res.writeHead(404); res.end("nf"); return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
        fs.createReadStream(fp).pipe(res);
      } catch (e) { res.writeHead(500); res.end("err"); }
    });
    srv.listen(0, "127.0.0.1", () => resolve({ srv, port: srv.address().port }));
  });
}

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.consoleErrs = []; }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", () => reject(new Error("ws-error")));
      this.ws.addEventListener("message", ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.id && this.pending.has(m.id)) {
          const h = this.pending.get(m.id); this.pending.delete(m.id);
          if (m.error) h.rej(new Error(JSON.stringify(m.error).slice(0, 200))); else h.res(m.result);
        } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
          this.consoleErrs.push("console:" + JSON.stringify(m.params.args).slice(0, 200));
        } else if (m.method === "Runtime.exceptionThrown") {
          this.consoleErrs.push("exc:" + JSON.stringify(m.params.exceptionDetails).slice(0, 200));
        }
      });
    });
  }
  send(method, params, to) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("cdp-timeout:" + method)); } }, to || 25000);
    });
  }
  ev(expr, awaitPromise) {
    return this.send("Runtime.evaluate", { expression: expr, awaitPromise: !!awaitPromise, returnByValue: true })
      .then(r => {
        if (r.exceptionDetails) throw new Error("eval-ex");
        return r.result && r.result.value;
      });
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

function httpJson(url, tries) {
  return new Promise((resolve, reject) => {
    const attempt = n => http.get(url, res => {
      let s = ""; res.on("data", c => s += c);
      res.on("end", () => { try { resolve(JSON.parse(s)); } catch (e) { n > 0 ? setTimeout(() => attempt(n - 1), 200) : reject(e); } });
    }).on("error", () => n > 0 ? setTimeout(() => attempt(n - 1), 200) : reject(new Error("no-endpoint")));
    attempt(tries == null ? 60 : tries);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dmvocab-ui-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  let cdp;
  try {
    cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Runtime.enable"); await cdp.send("Page.enable");
    const E = expr => cdp.ev("try{JSON.stringify(" + expr + ")}catch(e){'EVAL-ERR:'+e.message}");
    async function J(expr) {
      const s = await E(expr);
      if (typeof s !== "string" || s.indexOf("EVAL-ERR:") === 0) throw new Error(s);
      return JSON.parse(s);
    }

    await cdp.send("Page.navigate", { url: base + "/index.html" });
    await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
    await sleep(2200);
    const boot = await J("({dm:typeof DMSearch,search:typeof document.getElementById('vocabSearch'),grid:!!document.getElementById('vocabGrid'),errs:" +
      JSON.stringify(cdp.consoleErrs.length) + "})");
    ok("V0 boot + vocabulary page hooks", boot.dm === "object" && boot.search === "object" && boot.grid === true && boot.errs === 0,
      JSON.stringify(boot));

    /* Deterministic MyMemory fixture. Every other DMSearch request falls
       through to the real fetch (the app's own data loading is untouched). */
    const armed = await cdp.ev(`(()=>{try{
      window.__realFetch=window.fetch.bind(window);
      window.__mmCalls=[];
      window.__limitRetried=false;
      window.__fixFetch=function(url,opts){
        var u=String(url);
        if(u.indexOf('api.mymemory.translated.net')>=0){
          window.__mmCalls.push(u);
          var m=u.match(/[?&]q=([^&]*)/); var q=m?decodeURIComponent(m[1]):'';
          var lp=u.match(/[?&]langpair=([^&]*)/); var pair=lp?decodeURIComponent(lp[1]):'';
          function res(status,body){return Promise.resolve({status:status,json:function(){return Promise.resolve(body);}});}
          if(q==='Limitwort'&&!window.__limitRetried){window.__limitRetried=true;return res(429,{});}
          if(q==='Netzfehler')return Promise.reject(new Error('net-down'));
          if(q==='Xyzqleer42')return res(200,{responseData:{translatedText:''},responseStatus:200});
          if(q==='Langsamwort')return new Promise(function(resolve,reject){
            var t=setTimeout(function(){resolve({status:200,json:function(){return Promise.resolve({responseData:{translatedText:'بطيء'},responseStatus:200});}});},1600);
            try{if(opts&&opts.signal&&opts.signal.addEventListener){opts.signal.addEventListener('abort',function(){
              clearTimeout(t);var e=new Error('ab');e.name='AbortError';reject(e);},{once:true});}}catch(e){}
          });
          var tr;
          if(pair==='ar|de')tr='Fantasiewort';
          else if(q==='Xyzqwort')tr='كلمة خيالية';
          else if(q==='Grüße schön')tr='تحيات جميلة';
          else if(q==='Schnellwort')tr='سريع';
          else if(q==='Xyzqlabel42')tr='EN label translation';
          else if(q==='Xyzqlabel43')tr='DE label translation';
          else tr='ترجمة '+q;
          return res(200,{responseData:{translatedText:tr,match:'0.9'},responseStatus:200});
        }
        return window.__realFetch(url,opts);
      };
      DMSearch.__setFetch(window.__fixFetch);
      DMSearch.__cacheClear();
      showPage('vocab');
      return 'armed';
    }catch(e){return 'arm-err:'+e.message}})()`);
    ok("V1 fixture armed + vocab visible", armed === "armed", armed);
    await sleep(500);

    async function setQuery(q) {
      await cdp.ev("(()=>{var s=document.getElementById('vocabSearch');s.value=" + JSON.stringify(q) +
        ";s.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()");
    }
    async function snapshot(q) {
      return J("(()=>{var p=document.getElementById('dmVocabExt'),g=document.getElementById('vocabGrid');" +
        "var tr=p?p.querySelector('[data-dm-vocab-tr]'):null;" +
        "return {exists:!!p,q:p?p.getAttribute('data-dm-q'):'',loading:p?p.querySelectorAll('.dm-loading').length:0," +
        "tr:tr&&tr.querySelector('.dm-vocab-translation')?tr.querySelector('.dm-vocab-translation').textContent:''," +
        "trDir:tr&&tr.querySelector('.dm-vocab-translation')?tr.querySelector('.dm-vocab-translation').getAttribute('dir'):''," +
        "trLang:tr&&tr.querySelector('.dm-vocab-translation')?tr.querySelector('.dm-vocab-translation').getAttribute('lang'):''," +
        "err:tr&&tr.querySelector('.dm-ext-note')?tr.querySelector('.dm-ext-note').textContent:''," +
        "note:p?p.querySelector('.dm-ext-note')?p.querySelector('.dm-ext-note').textContent:'':''," +
        "links:p?p.querySelectorAll('a.dm-ext-link').length:0," +
        "cards:g?g.querySelectorAll('.word-card').length:0,copy:g?g.querySelectorAll('[data-act=copy]').length:0," +
        "count:document.getElementById('vocabCount').textContent," +
        "sibling:p?p.parentNode===g.parentNode:false,inGrid:g?g.contains(p):false," +
        "wordCards:p?p.querySelectorAll('.word-card').length:0,saveBtns:p?p.querySelectorAll('[data-act=save],.dm-save,.mini-btn').length:0," +
        "title:p&&p.querySelector('.dm-ext-title')?p.querySelector('.dm-ext-title').textContent:''};})()");
    }
    async function waitFor(q, tries) {
      for (let i = 0; i < (tries || 40); i++) {
        await sleep(250);
        const s = await snapshot(q);
        if (s.exists && s.q === q && s.loading === 0 && (s.tr || s.err)) return s;
      }
      return null;
    }

    /* 1. Local hit: cards stay; no fallback. The copy button is optional
       here because it belongs to unrelated local work and may be absent in
       a focused checkout of this fix; report it without requiring it. */
    await setQuery("Haus");
    await sleep(1100);
    const local = await snapshot("Haus");
    ok("V2 local search preserved", local.cards > 0 && !local.exists,
      "cards=" + local.cards + " copy=" + local.copy + " fallback=" + local.exists);

    /* 2. German absent: exact query, Arabic MT, external badge, 5 links. */
    await setQuery("Xyzqwort");
    const de = await waitFor("Xyzqwort");
    ok("V3a fallback appears for local miss", !!de && de.links === 5, de ? "links=" + de.links : "timeout");
    ok("V3b sibling panel, not a card", !!de && de.sibling && !de.inGrid && de.wordCards === 0 && de.saveBtns === 0,
      de ? JSON.stringify({ sibling: de.sibling, inGrid: de.inGrid, cards: de.wordCards, save: de.saveBtns }) : "timeout");
    ok("V3c exact query shown", !!de && de.note.length > 0 && de.title.length > 0, de && de.note);
    ok("V3d machine translation de->ar", !!de && de.tr === "كلمة خيالية" && de.trDir === "rtl" && de.trLang === "ar",
      de && (de.tr + "/" + de.trDir + "/" + de.trLang));
    const deExact = await J("(()=>{var p=document.getElementById('dmVocabExt');" +
      "return {q:p?p.querySelector('.dm-vocab-query').textContent:'',machine:p?!!p.querySelector('.dm-mt'):false," +
      "ext:p&&p.querySelector('.dm-sim')?p.querySelector('.dm-sim').textContent:''," +
      "links:p?[...p.querySelectorAll('a.dm-ext-link')].map(function(a){return {h:a.getAttribute('href'),t:a.target,r:a.rel};}):[]};})()");
    ok("V3e exact query textContent", deExact.q === "Xyzqwort", deExact.q);
    ok("V3f machine + external labels", deExact.machine === true && deExact.ext.length > 0, deExact.ext);
    ok("V3g links safe/new-tab", deExact.links.length === 5 &&
      deExact.links.every(l => /^https:\/\//.test(l.h) && l.t === "_blank" && /noopener/.test(l.r) && /noreferrer/.test(l.r)),
      JSON.stringify(deExact.links.map(l => l.t + ":" + l.r)));
    ok("V3h German link targets", deExact.links.some(l => l.h.indexOf("forvo.com/search/Xyzqwort/de/") >= 0) &&
      deExact.links.some(l => l.h.indexOf("duden.de/suchen/dudenonline/Xyzqwort") >= 0) &&
      deExact.links.some(l => l.h.indexOf("deutsch-arabisch") >= 0) &&
      deExact.links.some(l => l.h.indexOf("german-arabic") >= 0) &&
      deExact.links.some(l => l.h.indexOf("de.wiktionary.org/wiki/Xyzqwort") >= 0),
      JSON.stringify(deExact.links.map(l => l.h.slice(0, 60))));

    /* 3. Encoding: umlaut + ß + space in every link. */
    await setQuery("Grüße schön");
    const um = await waitFor("Grüße schön");
    const enc = await J("(()=>{var p=document.getElementById('dmVocabExt');" +
      "return {tr:p&&p.querySelector('.dm-vocab-translation')?p.querySelector('.dm-vocab-translation').textContent:''," +
      "links:p?[...p.querySelectorAll('a.dm-ext-link')].map(function(a){return a.getAttribute('href');}):[]};})()");
    const expected = encodeURIComponent("Grüße schön");
    ok("V4a umlaut/ß/space encoded", !!um && enc.links.length === 5 && enc.links.every(h => h.indexOf(expected) >= 0),
      enc.links[0]);
    ok("V4b encoded query translated", enc.tr === "تحيات جميلة", enc.tr);

    /* 4. Arabic reverse: ar->de, encoded Arabic, LTR German result. */
    await setQuery("كلمةخيالية");
    const ar = await waitFor("كلمةخيالية");
    const arLinks = await J("(()=>{var p=document.getElementById('dmVocabExt');" +
      "return p?[...p.querySelectorAll('a.dm-ext-link')].map(function(a){return a.getAttribute('href');}):[];})()");
    const arEnc = encodeURIComponent("كلمةخيالية");
    ok("V5a Arabic reverse translation", !!ar && ar.tr === "Fantasiewort" && ar.trDir === "ltr" && ar.trLang === "de",
      ar && (ar.tr + "/" + ar.trDir + "/" + ar.trLang));
    ok("V5b Arabic links encoded + reverse", arLinks.length === 5 && arLinks.every(h => h.indexOf(arEnc) >= 0) &&
      arLinks.some(h => h.indexOf("arabisch-deutsch") >= 0) && arLinks.some(h => h.indexOf("arabic-german") >= 0) &&
      arLinks.some(h => h.indexOf("ar.wiktionary.org/wiki/") >= 0) && arLinks.some(h => h.indexOf("/ar/") >= 0),
      arLinks[0]);

    /* 5. Rate limit: honest error, links remain, retry refetches (cache bypass). */
    await setQuery("Limitwort");
    const lim = await waitFor("Limitwort");
    ok("V6a rate-limit honest + links", !!lim && /حد الاستخدام|limit/i.test(lim.err) && lim.links === 5 && !lim.tr,
      lim && lim.err);
    const clicked = await cdp.ev("(()=>{var p=document.getElementById('dmVocabExt');var b=p&&p.querySelector('[data-dm-vocab-tr] .mini-btn');if(b){b.click();return 'clicked';}return 'no-button';})()");
    ok("V6b retry button present", clicked === "clicked", clicked);
    const lim2 = await waitFor("Limitwort");
    ok("V6c retry succeeds after 429", !!lim2 && lim2.tr === "ترجمة Limitwort", lim2 && lim2.tr);

    /* 6. Network failure: error + links, no fake translation. */
    await setQuery("Netzfehler");
    const net = await waitFor("Netzfehler");
    ok("V7 network failure contained", !!net && net.err.length > 0 && net.links === 5 && !net.tr, net && net.err);

    /* 7. Empty response: honest "no translation", links remain. */
    await setQuery("Xyzqleer42");
    const empty = await waitFor("Xyzqleer42");
    ok("V8 empty translation honest", !!empty && /لم نتمكن|Could not/i.test(empty.err) && empty.links === 5 && !empty.tr,
      empty && empty.err);

    /* 8. Stale: slow A superseded by fast B; late A cannot overwrite B. */
    await setQuery("Langsamwort");
    await sleep(700);
    await setQuery("Schnellwort");
    const fast = await waitFor("Schnellwort");
    await sleep(2000);
    const after = await snapshot("Schnellwort");
    const calls = await J("window.__mmCalls.slice()");
    ok("V9a newest query wins", !!fast && fast.tr === "سريع", fast && fast.tr);
    ok("V9b stale cannot overwrite", after.exists && after.q === "Schnellwort" && after.tr === "سريع" && after.tr !== "بطيء",
      after.q + "/" + after.tr);
    ok("V9c one request per query", calls.filter(u => u.indexOf("q=Langsamwort") >= 0).length === 1 &&
      calls.filter(u => u.indexOf("q=Schnellwort") >= 0).length === 1,
      "slow=" + calls.filter(u => u.indexOf("q=Langsamwort") >= 0).length +
      " fast=" + calls.filter(u => u.indexOf("q=Schnellwort") >= 0).length);

    /* 9. Debounce: three synchronous edits -> one request (last query only). */
    await cdp.ev("(()=>{window.__mmCalls=[];var s=document.getElementById('vocabSearch');" +
      "['Debouncewort','Debouncewort2','Debouncewort3'].forEach(function(v){s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));});return 1;})()");
    await sleep(1400);
    const deb = await J("window.__mmCalls.slice()");
    ok("V10 debounce one request", deb.filter(u => u.indexOf("Debouncewort") >= 0).length === 1,
      "calls=" + deb.filter(u => u.indexOf("Debouncewort") >= 0).length);

    /* 10. Offline: no request, honest offline message, links still usable. */
    await cdp.ev("(()=>{try{Object.defineProperty(navigator,'onLine',{value:false,configurable:true});}catch(e){}return 1;})()");
    await setQuery("Offlinewort");
    const off = await waitFor("Offlinewort");
    ok("V11 offline honest + links", !!off && off.err.length > 0 && off.links === 5 && !off.tr, off && off.err);
    await cdp.ev("(()=>{try{Object.defineProperty(navigator,'onLine',{value:true,configurable:true});}catch(e){}return 1;})()");

    /* 11. Labels in English and German (Arabic is the default already tested). */
    await cdp.ev("(()=>{try{S.uiLang='en';}catch(e){}return 1;})()");
    await setQuery("Xyzqlabel42");
    const en = await waitFor("Xyzqlabel42");
    const enText = await J("(()=>{var p=document.getElementById('dmVocabExt');return {title:p?p.querySelector('.dm-ext-title').textContent:'',badge:p&&p.querySelector('.dm-sim')?p.querySelector('.dm-sim').textContent:'',h:p?p.textContent:''};})()");
    ok("V12a English labels", !!en && /External search result/i.test(enText.title) &&
      /External — not saved/i.test(enText.badge) && /Machine translation/i.test(enText.h),
      enText.title + " | " + enText.badge);
    await cdp.ev("(()=>{try{S.uiLang='de';}catch(e){}return 1;})()");
    await setQuery("Xyzqlabel43");
    const de2 = await waitFor("Xyzqlabel43");
    const deText = await J("(()=>{var p=document.getElementById('dmVocabExt');return {title:p?p.querySelector('.dm-ext-title').textContent:'',badge:p&&p.querySelector('.dm-sim')?p.querySelector('.dm-sim').textContent:'',h:p?p.textContent:''};})()");
    ok("V12b German labels", !!de2 && /Externes Suchergebnis/i.test(deText.title) &&
      /Extern — nicht gespeichert/i.test(deText.badge) && /Maschinelle Übersetzung/i.test(deText.h),
      deText.title + " | " + deText.badge);
    await cdp.ev("(()=>{try{S.uiLang='ar';}catch(e){}return 1;})()");

    /* 12. Clearing the query removes the panel and aborts pending work. */
    await setQuery("");
    await sleep(700);
    const cleared = await J("({panel:!!document.getElementById('dmVocabExt'),cards:document.querySelectorAll('#vocabGrid .word-card').length})");
    ok("V13 clear query removes fallback", cleared.panel === false && cleared.cards > 0,
      JSON.stringify(cleared));

    /* 13. OPTIONAL live browser check (real MyMemory + real CORS).
       Deterministic runs stay offline by default; DM_LIVE=1 enables it. */
    if (process.env.DM_LIVE === "1") {
      await cdp.ev("(()=>{try{if(window.__realFetch)DMSearch.__setFetch(window.__realFetch);DMSearch.__cacheClear();}catch(e){}return 1;})()");
      const liveDeQ = await cdp.ev("(()=>{var c=['Quastenflosser','Blaudruck','Klangfarbe','Xylophon'];for(var i=0;i<c.length;i++){try{if(dmWordHits(dmNorm(c[i]),'mixed').length===0)return c[i];}catch(e){}}return c[0];})()");
      await setQuery(liveDeQ);
      const liveDe = await waitFor(liveDeQ, 80);
      ok("V14a LIVE de->ar browser translation", !!liveDe && !!liveDe.tr && liveDe.tr !== liveDeQ,
        liveDe && (liveDe.tr + " / " + liveDe.err));
      const liveArQ = await cdp.ev("(()=>{var c=['زبرجد أخضر','كلمة زبرجد','أوركسترا نحاسية'];for(var i=0;i<c.length;i++){try{if(dmWordHits(dmNorm(c[i]),'mixed').length===0)return c[i];}catch(e){}}return c[0];})()");
      await setQuery(liveArQ);
      const liveAr = await waitFor(liveArQ, 80);
      ok("V14b LIVE ar->de browser translation", !!liveAr && !!liveAr.tr && liveAr.tr !== liveArQ,
        liveAr && (liveAr.tr + " / " + liveAr.err));
      await cdp.ev("(()=>{try{DMSearch.__setFetch(window.__fixFetch);DMSearch.__cacheClear();}catch(e){}return 1;})()");
    } else {
      console.log("INFO V14 live browser translation skipped (set DM_LIVE=1 to run)");
    }

    const lateErrs = cdp.consoleErrs.filter(x => /dm-search|Uncaught|TypeError/i.test(x));
    ok("V15 no DMSearch JS errors", lateErrs.length === 0, lateErrs.join(" | ").slice(0, 240) || "clean");

    console.log("----");
    console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
    cdp.close(); chrome.kill(); srv.close();
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log("FAIL harness: " + (e && e.stack || e));
    try { cdp && cdp.close(); } catch (x) {}
    try { chrome.kill(); } catch (x) {}
    try { srv.close(); } catch (x) {}
    process.exit(1);
  }
})();
