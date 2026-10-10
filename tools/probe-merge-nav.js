/* Merge-vs-navigation overlap probe (headless Chrome + CDP, stdlib only).
 * Measures the REAL merge path on the REAL app (reads the production merge
 * diary window.__dmMergeLog + render counters window.__dmRenderStat):
 *  Phase A (overlap): fresh boot, navigate IMMEDIATELY (no warm-up) so the
 *    idle-preload chain lands mid-navigation. Reports every merge (key,
 *    added rows, ms), every post-merge refresh (ms, visible section), and
 *    which landed inside a navigation window, plus longtasks.
 *  Phase B (warmed cost): visits all sections, awaits preload completion,
 *    then times window.afterMergeRefresh() 3x with per-sub-render
 *    attribution (DM_LAZY entries repointed to timed wrappers, test-only).
 * Usage: node tools/probe-merge-nav.js
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
const CDP_PORT = 19351;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const SECTIONS = ["dashboard", "vocab", "sentences", "explain", "verbs", "grammar", "reference", "ankidroid", "quiz", "howto"];
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
    window.__dmLT = [];
    if ("PerformanceObserver" in window) {
      try {
        const po = new PerformanceObserver(l => {
          try { for (const e of l.getEntries()) window.__dmLT.push({ d: Math.round(e.duration), s: Math.round(e.startTime) }); } catch (x) {}
        });
        po.observe({ entryTypes: ["longtask"] });
      } catch (e) {}
    }
    window.__dmRej = [];
    window.addEventListener("unhandledrejection", e => { try { window.__dmRej.push(String((e.reason && e.reason.message) || e.reason).slice(0, 160)); } catch (x) {} });
    window.__dmNavWin = []; window.__dmNavOpen = 0;
  } catch (e) {}
})();`;
(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dmmerge-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  let code = 0;
  try {
    const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Runtime.enable"); await cdp.send("Page.enable"); await cdp.send("Network.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PREBOOT });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const E = e => cdp.ev(e);
    await cdp.send("Page.navigate", { url: base + "/index.html" });
    await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
    console.log("HOOKS: rev=" + await E("JSON.stringify(!!window.DMDataRev)") + " amr=" + await E("JSON.stringify(typeof window.afterMergeRefresh)"));
    // ---- Phase A: navigate immediately (overlap with preload chain) ----
    console.log("---- Phase A: 3 nav cycles with NO warm-up (force merge overlap) ----");
    for (let c = 0; c < 3; c++) {
      for (const p of SECTIONS) {
        const t0 = await E("Math.round(performance.now())");
        await E("(()=>{window.__dmNavOpen=1;window.__dmNavWin.push({p:'" + p + "',t0:Math.round(performance.now())});document.querySelector('.nav-item[data-page=\"" + p + "\"]').click();})()");
        await cdp.ev("new Promise(res=>{function f(){if(document.querySelector('#page-" + p + ".active')){requestAnimationFrame(()=>requestAnimationFrame(()=>res(1)));}else setTimeout(f,20);}f();})", true);
        await sleep(120);
        await E("(()=>{window.__dmNavOpen=0;var w=window.__dmNavWin[window.__dmNavWin.length-1];if(w)w.t1=Math.round(performance.now());})()");
        await sleep(60);
      }
    }
    const diaryA = JSON.parse(await E("JSON.stringify(window.__dmMergeLog||[])"));
    const winsA = JSON.parse(await E("JSON.stringify(window.__dmNavWin||[])"));
    const statA = JSON.parse(await E("JSON.stringify(window.__dmRenderStat||{})"));
    function inNav(t) { return winsA.some(w => t >= w.t0 - 50 && t <= (w.t1 || w.t0 + 500) + 300); }
    console.log("DIARY-A(" + diaryA.length + "):");
    for (const m of diaryA) {
      if (m.key === "refresh") console.log("  refresh ms=" + m.ms + " vis=" + m.vis + (m.deferred ? " [DEFERRED-hidden]" : "") + (inNav(m.pt) ? " [NAV-OVERLAP]" : ""));
      else console.log("  merge " + m.key + " +" + m.added + "w " + m.ms + "ms" + (inNav(m.pt) ? " [NAV-OVERLAP]" : ""));
    }
    console.log("RENDERSTAT-A: " + JSON.stringify(statA));
    const ltA = JSON.parse(await E("JSON.stringify((window.__dmLT||[]).map(x=>({s:x.s,d:x.d})))"));
    const mergePts = diaryA.filter(m => m.key !== "refresh").map(m => m.pt);
    console.log("LONGTASKS-A(" + ltA.length + "): " + ltA.map(lt => {
      const nearMerge = mergePts.some(pt => Math.abs(lt.s - pt) < 60 || (lt.s <= pt && pt <= lt.s + lt.d));
      return lt.d + "ms@" + lt.s + (nearMerge ? "[NEAR-MERGE]" : "");
    }).join(" "));
    // ---- Phase B: warmed scoped-refresh cost with attribution ----
    console.log("---- Phase B: visit all, await preload done, time afterMergeRefresh x3 ----");
    for (const p of SECTIONS) { await E("showPage('" + p + "')"); await sleep(150); }
    await cdp.ev("new Promise(res=>{function f(){try{if(['B1','B2','B1B','B2B','A1X','A2B','A2'].every(k=>window.Curriculum&&window.Curriculum.ds[k]))res(1);else setTimeout(f,300);}catch(e){setTimeout(f,300);}}f();setTimeout(()=>res(0),30000);})", true);
    await sleep(1000);
    const attr = JSON.parse(await E(`(() => {
      const fns = ["renderStreak","renderDashboard","renderReview","renderMistakes","renderQuizHistory","renderStats","renderPlanner","renderFavs","refreshFlashList","currRefreshHooks","observeReveals"];
      window.__dmT = {};
      for (const n of fns) {
        try {
          const f = window[n];
          if (typeof f !== "function") continue;
          window.__dmT[n] = 0;
          window[n] = (function (fn, nm) { return function () { const t0 = performance.now(); try { return fn.apply(this, arguments); } finally { window.__dmT[nm] += performance.now() - t0; } }; })(f, n);
        } catch (e) {}
      }
      try {
        for (const k of Object.keys(DM_LAZY)) {
          const f = DM_LAZY[k];
          if (typeof f !== "function") continue;
          window.__dmT["lazy:" + k] = 0;
          DM_LAZY[k] = (function (fn, nm) { return function () { const t0 = performance.now(); try { return fn.apply(this, arguments); } finally { window.__dmT[nm] += performance.now() - t0; } }; })(f, "lazy:" + k);
        }
      } catch (e) {}
      const costs = [];
      for (let i = 0; i < 3; i++) {
        for (const k of Object.keys(window.__dmT)) window.__dmT[k] = 0;
        const t0 = performance.now();
        window.afterMergeRefresh();
        costs.push(Math.round((performance.now() - t0) * 10) / 10);
      }
      const per = {};
      for (const k of Object.keys(window.__dmT)) per[k] = Math.round(window.__dmT[k] * 10) / 10;
      return JSON.stringify({ costs: costs, perCall: per, rev: window.DMDataRev, stat: window.__dmRenderStat });
    })()`));
    console.log("WARMED afterMergeRefresh x3: [" + attr.costs.join(",") + "]ms");
    console.log("SUB-RENDER (last call ms): " + JSON.stringify(attr.perCall));
    console.log("REVS: " + JSON.stringify(attr.rev) + " STAT: " + JSON.stringify(attr.stat));
    console.log("ERRORS(pageexc): " + cdp.errs.length + " UNHANDLED-REJECTIONS: " + JSON.parse(await E("JSON.stringify(window.__dmRej)")).length);
    if (cdp.errs.length) console.log(cdp.errs.slice(0, 5).join("\n"));
    cdp.close();
  } catch (e) { console.log("HARNESS-FAIL " + (e && e.stack || e).slice(0, 600)); code = 1; }
  try { chrome.kill(); } catch (e) {}
  try { srv.close(); } catch (e) {}
  await sleep(800);
  process.exit(code);
})();
