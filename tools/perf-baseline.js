/* Perf baseline: startup + navigation + storage/DOM counters (headless Chrome CDP).
 * Run: node tools/perf-baseline.js [--label X]
 * Prints JSON measurements only. No app code changes; wraps counters via
 * evaluateOnNewDocument so boot itself is observed. */
"use strict";
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");
const { spawn } = require("child_process");
const CLIENT = path.join(__dirname, "..", "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 19360 + Math.floor(Math.random() * 20);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const label = (process.argv.includes("--label") ? process.argv[process.argv.indexOf("--label") + 1] : "base");

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

(async () => {
  await new Promise((res) => srv.listen(0, "127.0.0.1", res));
  const port = srv.address().port;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-"));
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + userDir, "about:blank"], { stdio: "ignore" });
  class CDP {
    constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); }
    connect() {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("ws-timeout")), 15000);
        this.ws = new WebSocket(this.url);
        this.ws.addEventListener("open", () => { clearTimeout(t); resolve(); });
        this.ws.addEventListener("error", () => { clearTimeout(t); reject(new Error("ws-error")); });
        this.ws.addEventListener("message", (ev) => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.id && this.pending.has(m.id)) { const h = this.pending.get(m.id); this.pending.delete(m.id); clearTimeout(h.timer); if (m.error) h.rej(new Error(JSON.stringify(m.error).slice(0, 120))); else h.res(m.result); }
        });
      });
    }
    send(method, params, ms) {
      return new Promise((res, rej) => {
        const id = ++this.id;
        const timer = setTimeout(() => { this.pending.delete(id); rej(new Error("t:" + method)); }, ms || 45000);
        this.pending.set(id, { res, rej, timer });
        try { this.ws.send(JSON.stringify({ id, method, params: params || {} })); }
        catch (e) { clearTimeout(timer); this.pending.delete(id); rej(e); }
      });
    }
    evalJs(b, ms) { return this.send("Runtime.evaluate", { expression: "(" + b + ")()", awaitPromise: true, returnByValue: true }, ms || 45000).then((r) => (r && r.result ? r.result.value : null)); }
  }
  const finish = (code) => { try { chrome.kill(); } catch (e) {} try { if (srv.closeAllConnections) srv.closeAllConnections(); } catch (e) {} srv.close(() => process.exit(code)); setTimeout(() => process.exit(code), 3000).unref(); };
  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        const body = await new Promise((res, rej) => {
          http.get("http://127.0.0.1:" + PORT + "/json/list", (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b)); }).on("error", rej);
        });
        const pg = JSON.parse(body).find((t) => t.type === "page");
        if (pg && pg.webSocketDebuggerUrl) { wsUrl = pg.webSocketDebuggerUrl; break; }
      } catch (e) {}
    }
    const cdp = new CDP(wsUrl); await cdp.connect();
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    // Install counters BEFORE any page script runs.
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source:
      "window.__perf={lsGet:0,lsSet:0,saveCalls:0,renderAll:0,longtasks:[]," +
      "navMarks:{}};" +
      "try{(function(){var g=localStorage.getItem.bind(localStorage);var s=localStorage.setItem.bind(localStorage);" +
      "localStorage.getItem=function(k){try{window.__perf.lsGet++;}catch(e){}return g(k);};" +
      "localStorage.setItem=function(k,v){try{window.__perf.lsSet++;}catch(e){}return s(k,v);};})();}catch(e){}" +
      "try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__perf.longtasks.push(Math.round(e.duration));});}).observe({entryTypes:['longtask']});}catch(e){}" +
      "try{var _po=new PerformanceObserver(function(l){});}catch(e){}" }, 15000);
    const t0 = Date.now();
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/" }, 45000);
    await sleep(11000);
    const boot = await cdp.evalJs(`async function(){
      try{
        try{var sb=document.getElementById("dmStartBtn");if(sb)sb.click();}catch(e){}
        await new Promise(function(r){setTimeout(r,1200);});
        var nav={}; try{var es=performance.getEntriesByType("navigation"); if(es&&es[0]){var n=es[0]; nav={domContent:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),transfer:Math.round(n.transferSize||0),decoded:Math.round(n.decodedBodySize||0)};}}catch(e){}
        var res=[]; try{res=performance.getEntriesByType("resource").filter(function(r){return /\\.js($|\\?)/.test(r.name);}).map(function(r){return {n:r.name.split("/").pop().split("?")[0],ms:Math.round(r.duration),kb:Math.round((r.transferSize||r.decodedBodySize||0)/1024)};});}catch(e){}
        res.sort(function(a,b){return b.ms-a.ms;});
        var heap=null; try{if(performance.memory)heap=Math.round(performance.memory.usedJSHeapSize/1048576);}catch(e){}
        return {wallMs:Date.now()-BOOT_T0, nav:nav, heapMB:heap, domNodes:document.getElementsByTagName("*").length,
          counters:{lsGet:window.__perf.lsGet,lsSet:window.__perf.lsSet,longtasks:window.__perf.longtasks.slice()},
          topJs:res.slice(0,8), jsCount:res.length, errors:(window.__bootErrs||[]).length};
      }catch(e){return {err:String(e&&e.message||e).slice(0,100)};}
    }`.replace("BOOT_T0", String(t0)), 30000);
    // Wrap save/renderAll for the navigation phase (functions exist post-boot).
    await cdp.evalJs(`async function(){
      try{
        if(typeof window.save==="function"&&!window.save.__perfWrapped){
          var _s=window.save; var w=function(){try{window.__perf.saveCalls++;}catch(e){} return _s.apply(this,arguments);};
          w.__perfWrapped=true; window.save=w; try{save=w;}catch(e){}
        }
        if(typeof window.renderAll==="function"&&!window.renderAll.__perfWrapped){
          var _r=window.renderAll; var w2=function(){try{window.__perf.renderAll++;}catch(e){} return _r.apply(this,arguments);};
          w2.__perfWrapped=true; window.renderAll=w2; try{renderAll=w2;}catch(e){}
        }
        window.__perf.lsGet=0; window.__perf.lsSet=0; window.__perf.saveCalls=0; window.__perf.renderAll=0;
        window.__perf.longtasks=[];
        return true;
      }catch(e){return false;}
    }`, 20000);
    // Navigation sweep across heavy pages.
    const pages = ["vocab", "sentences", "flashcards", "quiz", "reference", "grammar", "review", "dashboard"];
    const navRes = await cdp.evalJs(`async function(){
      var out={};
      var pages=${JSON.stringify(pages)};
      for(var i=0;i<pages.length;i++){
        var p=pages[i];
        var t=performance.now();
        try{window.showPage(p);}catch(e){out[p]={err:true};continue;}
        await new Promise(function(r){setTimeout(r,1400);});
        out[p]={ms:Math.round(performance.now()-t),nodes:document.getElementsByTagName("*").length};
      }
      var heap2=null; try{if(performance.memory)heap2=Math.round(performance.memory.usedJSHeapSize/1048576);}catch(e){}
      return {pages:out, heapAfterMB:heap2,
        counters:{lsGet:window.__perf.lsGet,lsSet:window.__perf.lsSet,save:window.__perf.saveCalls,renderAll:window.__perf.renderAll,longtasks:window.__perf.longtasks.slice()}};
    }`, 120000);
    console.log(JSON.stringify({ label: label, boot: boot, nav: navRes }));
  } catch (e) { console.log(JSON.stringify({ label: label, harnessErr: String((e && e.message) || e).slice(0, 150) })); finish(1); return; }
  finish(0);
})();
