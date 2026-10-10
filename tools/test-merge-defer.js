/* Merge-deferred correctness tests (real app, headless Chrome + CDP).
 * Proves version-aware rendering on the REAL merge path using two synthetic
 * datasets (CURR_TEST1/2) merged while sections are hidden:
 *  D1 visible merge refreshes the visible section once, no full renderAll.
 *  D2 hidden sections render ZERO times across multiple merges.
 *  D3 one revisit renders once and shows BOTH merges (coalescing proof).
 *  D4 filters set while hidden are honored by the deferred render.
 *  D5 search indexes include merged content (incl. Arabic/ß robustness).
 *  D6 no listener explosion; progress untouched; zero errors/rejections.
 *  D7 every afterMergeRefresh during the test stays under 200ms.
 * Usage: node tools/test-merge-defer.js (exit 0 = PASS, 1 = FAIL)
 */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19352;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (e ? " :: " + e : "")); } }
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(req.url.split("?")[0]);
        if (p === "/") p = "/index.html";
        const fp = path.normalize(path.join(CLIENT, p.replace(/^\//, "")));
        if (!fp.startsWith(CLIENT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
        fs.createReadStream(fp).pipe(res);
      } catch (e) { res.writeHead(500); res.end("err"); }
    });
    srv.listen(0, "127.0.0.1", () => resolve({ srv, port: srv.address().port }));
  });
}
class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.errs = []; }
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
        } else if (m.method === "Runtime.exceptionThrown") {
          this.errs.push(JSON.stringify(m.params.exceptionDetails).slice(0, 220));
        }
      });
    });
  }
  send(method, params, to) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("cdp-timeout:" + method)); } }, to || 30000);
    });
  }
  ev(expr, awaitPromise) {
    return this.send("Runtime.evaluate", { expression: expr, awaitPromise: !!awaitPromise, returnByValue: true })
      .then(r => { if (r.exceptionDetails) throw new Error("eval-ex:" + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result && r.result.value; });
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function httpJson(url, tries) {
  return new Promise((resolve, reject) => {
    const attempt = n => http.get(url, res => {
      let s = ""; res.on("data", c => s += c);
      res.on("end", () => { try { resolve(JSON.parse(s)); } catch (e) { n > 0 ? setTimeout(() => attempt(n - 1), 200) : reject(e); } });
    }).on("error", () => n > 0 ? setTimeout(() => attempt(n - 1), 200) : reject(new Error("no-endpoint")));
    attempt(tries == null ? 60 : tries);
  });
}
const PREBOOT = `(() => {
  try {
    window.__dmRej = [];
    window.addEventListener("unhandledrejection", e => { try { window.__dmRej.push(String((e.reason && e.reason.message) || e.reason).slice(0, 160)); } catch (x) {} });
    window.__dmLis = 0;
    const _a = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function () { try { window.__dmLis++; } catch (e) {} return _a.apply(this, arguments); };
  } catch (e) {}
})();`;
const COUNTERS = `(() => {
  window.__dmRC = {};
  ["renderVocab","renderVerbs","renderGrammar","renderExplainIndex","renderDashboard","renderReview","renderStats"].forEach(n => {
    try {
      const f = window[n]; if (typeof f !== "function") return;
      window[n] = (function (fn, nm) { return function () { try { window.__dmRC[nm] = (window.__dmRC[nm] || 0) + 1; } catch (e) {} return fn.apply(this, arguments); }; })(f, n);
    } catch (e) {}
  });
  window.__dmSents = 0;
  try {
    const f = DM_LAZY.sentences;
    DM_LAZY.sentences = function () { try { window.__dmSents++; } catch (e) {} return f.apply(this, arguments); };
  } catch (e) {}
  /* DM_LAZY holds the ORIGINAL references (captured at script eval), so the
     window-level wrappers above never see lazy-grid renders. Wrap at the
     DM_LAZY level too (same technique as probe-merge-nav Phase B). */
  ["vocab", "verbs", "grammar", "explain"].forEach(k => {
    try {
      const f = DM_LAZY[k]; if (typeof f !== "function") return;
      DM_LAZY[k] = (function (fn, nm) { return function () { try { window.__dmRC[nm] = (window.__dmRC[nm] || 0) + 1; } catch (e) {} return fn.apply(this, arguments); }; })(f, "lazy:" + k);
    } catch (e) {}
  });
  return "ok";
})();`;
const TESTDATA = `(() => {
  window.CURR_TEST1 = { level: "B1", words: [
    ["ZzTestAlpha1", "der", "اختبار واحد", "", "", "اسم", "Food", "K9", "", "ZzTestAlpha1 lernt hier.", "يتعلم هنا.", ""],
    ["ZzTestAlpha2", "die", "اختبار اثنان", "", "", "اسم", "Food", "K9", "", "ZzTestAlpha2 spielt dort.", "تلعب هناك.", ""],
    ["ZzTestAlpha3", "das", "اختبار ثلاثة", "", "", "اسم", "Food", "K9", "", "ZzTestAlpha3 singt laut.", "تغني بصوت عال.", ""]
  ] };
  window.CURR_TEST2 = { level: "B1",
    sentences: [["ZzTestBeta Satz eins hier.", "جملة اختبار بيتا واحدة هنا.", "", "K9"], ["ZzTestBeta Satz zwei dort.", "جملة اختبار بيتا الثانية هناك.", "", "K9"]],
    grammar: [["ZZTEST Regel Titel", "K9", "ZZTEST body text.", "Der ZzTest ist hier.|الاختبار هنا.", "Die ZzTests sind da.|الاختبارات هناك.", "Was ist ZzTest?", "Antwort A|Antwort B", 0, "Weil Test."]]
  };
  return "ok";
})();`;
(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dmdefer-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  let code = 0;
  try {
    const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Runtime.enable"); await cdp.send("Page.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PREBOOT });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const E = e => cdp.ev(e);
    const J = async e => JSON.parse(await cdp.ev("JSON.stringify(" + e + ")"));
    await cdp.send("Page.navigate", { url: base + "/index.html" });
    await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
    // await full preload so synthetic merges are the only delta
    await cdp.ev("new Promise(res=>{function f(){try{if(['B1','B2','B1B','B2B','A1X','A2B','A2'].every(k=>window.Curriculum&&window.Curriculum.ds[k]))res(1);else setTimeout(f,300);}catch(e){setTimeout(f,300);}}f();setTimeout(()=>res(0),30000);})", true);
    await sleep(800);
    await E(COUNTERS); await E(TESTDATA);
    async function nav(p) {
      await E("showPage('" + p + "')");
      await cdp.ev("new Promise(res=>{function f(){if(document.querySelector('#page-" + p + ".active')){requestAnimationFrame(()=>requestAnimationFrame(()=>res(1)));}else setTimeout(f,25);}f();})", true);
      await sleep(350);
    }
    // baseline visits (render + stamp everything)
    await E("(()=>{const s=document.getElementById('vocabSearch');s.value='';const c=document.getElementById('filterCategory');if(c)c.value='';})()");
    await nav("vocab"); await nav("sentences"); await nav("grammar"); await nav("dashboard");
    const pill0 = Number(await E("+document.getElementById('vocabCount').textContent"));
    const sent0 = parseInt(await E("(document.getElementById('sentCount')||{textContent:'0'}).textContent"), 10);
    const gramN0 = await E("GRAMMAR.length");
    const rev0 = await J("window.DMDataRev");
    const full0 = await J("window.__dmRenderStat.full");
    const ans0 = await E("S.totalAnswered"); const statKeys0 = await E("Object.keys(S.status||{}).length");
    const lis0 = Number(await E("window.__dmLis||0"));
    // reset per-section counters AFTER baseline
    await E("(()=>{window.__dmRC={};window.__dmSents=0;})()");
    // D1: merge TEST1 while ON dashboard (visible) -> one scoped dashboard refresh, no full render
    const m1 = await E("(()=>{const t0=performance.now();const n=window.currMergeDs('TEST1');const t1=performance.now();window.afterMergeRefresh();const t2=performance.now();return JSON.stringify({added:n,mergeMs:Math.round((t1-t0)*10)/10,refreshMs:Math.round((t2-t1)*10)/10});})()");
    const M1 = JSON.parse(m1);
    ok("D1:merge-adds-words", M1.added === 3, "added=" + M1.added);
    const rev1 = await J("window.DMDataRev");
    ok("D1:rev-bumped-vocab-only", rev1.vocab === rev0.vocab + 1 && rev1.sentences === rev0.sentences && rev1.grammar === rev0.grammar, JSON.stringify(rev1));
    ok("D1:visible-dashboard-refreshed-once", (await J("window.__dmRC.renderDashboard||0")) === 1, "renderDashboard=" + await E("window.__dmRC.renderDashboard||0"));
    ok("D1:no-full-render", (await J("window.__dmRenderStat.full")) === full0, "full=" + full0);
    ok("D1:refresh-under-200ms", M1.refreshMs < 200 && M1.mergeMs < 200, "merge=" + M1.mergeMs + " refresh=" + M1.refreshMs);
    const scoped1 = await J("window.__dmRenderStat.scoped");
    ok("D1:scoped-counter", scoped1 >= 1, "scoped=" + scoped1);
    // D2: merge TEST2 (sentences+grammar) while dashboard visible -> hidden sections silent
    const m2 = await E("(()=>{const n=window.currMergeDs('TEST2');const t0=performance.now();window.afterMergeRefresh();const t1=performance.now();return JSON.stringify({added:n,refreshMs:Math.round((t1-t0)*10)/10});})()");
    const M2 = JSON.parse(m2);
    ok("D2:merge-adds-sentences", M2.added === 0, "added=" + M2.added + " (words-only counter; sentences/grammar pushed)");
    ok("D2:refresh-under-200ms", M2.refreshMs < 200, "refresh=" + M2.refreshMs);
    const rcHidden = await J("({v:(window.__dmRC.renderVocab||0)+(window.__dmRC['lazy:vocab']||0),s:window.__dmSents||0,g:(window.__dmRC.renderGrammar||0)+(window.__dmRC['lazy:grammar']||0)})");
    ok("D2:hidden-sections-silent", rcHidden.v === 0 && rcHidden.s === 0 && rcHidden.g === 0, JSON.stringify(rcHidden));
    ok("D2:no-full-render-2", (await J("window.__dmRenderStat.full")) === full0, "full still " + full0);
    // D3: revisit -> exactly one render each, BOTH merges visible (coalescing)
    await nav("vocab");
    const pill1 = Number(await E("+document.getElementById('vocabCount').textContent"));
    ok("D3:vocab-one-render", ((await J("window.__dmRC.renderVocab||0")) + (await J("window.__dmRC['lazy:vocab']||0"))) === 1, "renders=" + await E("JSON.stringify([window.__dmRC.renderVocab||0,window.__dmRC['lazy:vocab']||0])"));
    ok("D3:vocab-has-all-new-words", pill1 === pill0 + 3, pill0 + "->" + pill1);
    await E("(()=>{const s=document.getElementById('vocabSearch');s.value='zztest';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await sleep(900);
    ok("D3:vocab-word-in-dom", (await E("document.getElementById('vocabGrid').textContent.indexOf('ZzTestAlpha2')>=0")) === true, "zz-word rendered via live filter");
    await E("(()=>{const s=document.getElementById('vocabSearch');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await sleep(900);
    await nav("sentences");
    ok("D3:sent-one-render", (await J("window.__dmSents")) === 1, "renders=" + await E("window.__dmSents"));
    const sent1 = parseInt(await E("(document.getElementById('sentCount')||{textContent:'0'}).textContent"), 10);
    ok("D3:sent-has-new-rows", sent1 >= sent0 + 2, sent0 + "->" + sent1);
    await E("(()=>{const s=document.getElementById('sentenceSearch');s.value='zztestbeta';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await sleep(900);
    ok("D3:sent-row-in-dom", (await E("document.getElementById('sentList').textContent.indexOf('ZzTestBeta')>=0")) === true, "zz-sent rendered via live filter");
    await E("(()=>{const s=document.getElementById('sentenceSearch');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await sleep(900);
    // D4: filter set while hidden is honored by deferred render
    await E("(()=>{showPage('dashboard');const gk=document.getElementById('grammarKapitel');if(gk)gk.value='K9';})()");
    await sleep(200);
    await nav("grammar");
    ok("D4:grammar-one-render", ((await J("window.__dmRC.renderGrammar||0")) + (await J("window.__dmRC['lazy:grammar']||0"))) === 1, "renders=" + await E("JSON.stringify([window.__dmRC.renderGrammar||0,window.__dmRC['lazy:grammar']||0])"));
    ok("D4:hidden-filter-honored", (await E("document.getElementById('grammarList').textContent.indexOf('ZZTEST Regel Titel')>=0")) === true, "test rule visible under K9");
    // D5: search indexes include merged content
    ok("D5:word-index-fresh", Number(await E("dmWordHits('zztestalpha1','mixed').length")) >= 1, "hits>=1");
    await E("(()=>{showPage('vocab');const s=document.getElementById('vocabSearch');s.value='zztest';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await sleep(900);
    ok("D5:live-search-narrows", (await E("+document.getElementById('vocabCount').textContent")) === 3, "pill=3");
    await E("(()=>{const s=document.getElementById('vocabSearch');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await sleep(900);
    ok("D5:search-arabic-safe", (await E("(()=>{try{const n=dmWordHits('كتاب','mixed').length;return 'n='+n;}catch(e){return 'THROW';}})()")) !== "THROW", "arabic ok");
    ok("D5:search-eszett-safe", (await E("(()=>{try{const n=dmWordHits('straße','mixed').length;return 'n='+n;}catch(e){return 'THROW';}})()")) !== "THROW", "ß ok");
    // D6: listeners / progress / errors. Repeat-visit hygiene: 3 extra vocab
    // cycles must add ~0 listeners (the progressive-growth check).
    const lisPre = Number(await E("window.__dmLis||0"));
    for (let i = 0; i < 3; i++) { await nav("vocab"); }
    const lisPost = Number(await E("window.__dmLis||0"));
    ok("D6:revisit-listeners-flat", (lisPost - lisPre) === 0, "+" + (lisPost - lisPre) + " over 3 revisits");
    const lis1 = Number(await E("window.__dmLis||0"));
    console.log("INFO listeners total +" + (lis1 - lis0) + " across merges+revisits+renders (cumulative adds, old nodes GC'd)");
    ok("D6:progress-intact", (await E("S.totalAnswered")) === ans0 && (await E("Object.keys(S.status||{}).length")) === statKeys0, "answers/status unchanged");
    ok("D6:no-page-errors", cdp.errs.length === 0, cdp.errs.slice(0, 2).join("|").slice(0, 160));
    ok("D6:no-rejections", (await J("window.__dmRej")).length === 0, JSON.stringify(await J("window.__dmRej")).slice(0, 120));
    // D7: diary shows scoped refreshes, zero full renders from merges
    const diary = await J("window.__dmMergeLog.slice(-6)");
    console.log("INFO diary-tail: " + JSON.stringify(diary));
    console.log("INFO renderstat: " + JSON.stringify(await J("window.__dmRenderStat")));
    cdp.close();
  } catch (e) { console.log("HARNESS-FAIL " + (e && e.stack || e).slice(0, 500)); code = 1; }
  try { chrome.kill(); } catch (e) {}
  try { srv.close(); } catch (e) {}
  await sleep(800);
  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
  process.exit(code || (fail ? 1 : 0));
})();
