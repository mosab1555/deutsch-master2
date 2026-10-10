/* Deep-navigation probe (headless Chrome + CDP, stdlib only).
 * Drives the REAL app through real sidebar controls across 10 sections x N cycles,
 * desktop + mobile viewports. Per transition records:
 *  - wall ms from click dispatch to target .page.active + rAF settle
 *  - longtasks observed during the transition (PerformanceObserver)
 *  - DOM nodes before/after (document-wide + active page container)
 *  - JS heap before/after (performance.memory, Chromium only)
 *  - listener adds during transition (pre-boot addEventListener patch)
 *  - console errors / uncaught exceptions / failed requests during transition
 *  - active-page DOM growth across repeated visits (retained-tree check)
 * Usage: node tools/perf-nav-probe.js [cycles] [overlap]
 *  cycles  = navigation cycles per section (default 5)
 *  overlap = "overlap" to skip the warm-up sleep and use short settles, so
 *    the idle-preload dataset merges land mid-navigation (concurrency mode);
 *    the merge diary + render counters are dumped per viewport.
 * Exit 0 always unless harness itself fails; prints JSON summary + table.
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
const CDP_PORT = 19343;
const CYCLES = Math.max(1, parseInt(process.argv[2] || "5", 10) || 5);
const OVERLAP = String(process.argv[3] || "").toLowerCase() === "overlap";
const SETTLE_MS = OVERLAP ? 120 : 250;
const SECTIONS = [
  ["dashboard", "Home"],
  ["vocab", "Vocabulary"],
  ["sentences", "Sentences"],
  ["explain", "Explanations"],
  ["verbs", "Verbs"],
  ["grammar", "Grammar"],
  ["reference", "Comprehensive German Reference"],
  ["ankidroid", "AnkiDroid"],
  ["quiz", "Tests"],
  ["howto", "German Study Method"],
];
const VIEWPORTS = [
  { w: 1366, h: 768, m: false, label: "desktop" },
  { w: 390, h: 844, m: true, label: "mobile" },
];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

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
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.consoleErrs = []; this.failedReq = []; }
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
          this.consoleErrs.push("console:" + JSON.stringify(m.params.args).slice(0, 220));
        } else if (m.method === "Runtime.exceptionThrown") {
          this.consoleErrs.push("exc:" + JSON.stringify(m.params.exceptionDetails).slice(0, 220));
        } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
          this.consoleErrs.push("log:" + (m.params.entry.text || "").slice(0, 220));
        } else if (m.method === "Network.loadingFailed") {
          this.failedReq.push(String((m.params.errorText || "?") + " " + (m.params.type || "")).slice(0, 160));
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
        if (r.exceptionDetails) throw new Error("eval-ex:" + JSON.stringify(r.exceptionDetails).slice(0, 200));
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

// Pre-boot patch: counts every addEventListener + collects longtasks from t=0.
const PREBOOT = `(() => {
  try {
    window.__dmLisAdded = 0; window.__dmLisByType = {};
    const _add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (t) {
      try { window.__dmLisAdded++; window.__dmLisByType[t] = (window.__dmLisByType[t] || 0) + 1; } catch (e) {}
      return _add.apply(this, arguments);
    };
  } catch (e) {}
  try {
    window.__dmLongTasks = [];
    if ("PerformanceObserver" in window) {
      try {
        const po = new PerformanceObserver(l => {
          try { for (const e of l.getEntries()) window.__dmLongTasks.push({ n: e.name, d: Math.round(e.duration), s: Math.round(e.startTime) }); } catch (x) {}
        });
        po.observe({ entryTypes: ["longtask"] });
      } catch (e) {}
    }
  } catch (e) {}
})();`;

(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dmnav-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  let code = 0;
  try {
    const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Page.enable"); await cdp.send("Network.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PREBOOT });
    const E = expr => cdp.ev("try{JSON.stringify(" + expr + ")}catch(e){'EVAL-ERR:'+e.message}");

    const allRows = [];
    for (const vp of VIEWPORTS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: !!vp.m });
      await cdp.send("Page.navigate", { url: base + "/index.html" });
      await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
      if (OVERLAP) await sleep(400); // concurrency mode: navigate while preload merges are in flight
      else await sleep(3000); // warm-up: boot + idle indexing settle
      const bootErrs = cdp.consoleErrs.length;
      const bootInfo = await E("({sp:typeof showPage,navs:document.querySelectorAll('.nav-item[data-page]').length,heap:(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):-1),dom:document.getElementsByTagName('*').length,lis:window.__dmLisAdded||-1})");
      console.log("BOOT[" + vp.label + "] " + bootInfo + " consoleErrs=" + bootErrs);

      // per-section first-visit timings + repeated cycles
      const visitCounts = {}; // page -> visits (for progressive-slowness check)
      for (let c = 0; c < CYCLES; c++) {
        for (const [page, label] of SECTIONS) {
          const eb = cdp.consoleErrs.length, fb = cdp.failedReq.length;
          const before = JSON.parse(await E("({dom:document.getElementsByTagName('*').length,heap:(performance.memory?performance.memory.usedJSHeapSize:-1),lis:window.__dmLisAdded||0,lt:(window.__dmLongTasks||[]).length,active:(document.querySelector('.page.active')||{}).id||''})"));
          const t0 = Date.now();
          // REAL sidebar control, real production handler path:
          // click the actual .nav-item (opens drawer first on mobile like a user would).
          await cdp.ev("(()=>{const b=document.querySelector('.nav-item[data-page=\"" + page + "\"]');if(!b)return 'missing';b.click();return 'clicked';})()");
          // wait until target active + 2 rAFs (usable) or timeout
          const settled = await cdp.ev("new Promise(res=>{let n=0;const t0=performance.now();function f(){try{if(document.querySelector('#page-" + page + ".active')){requestAnimationFrame(()=>requestAnimationFrame(()=>res(Math.round(performance.now()-t0))));}else if(++n>200){res(-1);}else setTimeout(f,25);}catch(e){res(-2);}}f();})", true);
          const wall = Date.now() - t0;
          await sleep(SETTLE_MS); // let deferred work (setTimeout 100-200ms post-nav) land inside the window
          const after = JSON.parse(await E("({dom:document.getElementsByTagName('*').length,heap:(performance.memory?performance.memory.usedJSHeapSize:-1),lis:window.__dmLisAdded||0,active:(document.querySelector('.page.active')||{}).id||'',pageDom:(document.querySelector('#page-" + page + "')||{getElementsByTagName:()=>[]}).getElementsByTagName('*').length})"));
          const lts = JSON.parse(await E("(window.__dmLongTasks||[]).slice(" + before.lt + ").map(x=>x.d)"));
          const errs = cdp.consoleErrs.slice(eb);
          const freqs = cdp.failedReq.slice(fb);
          visitCounts[page] = (visitCounts[page] || 0) + 1;
          allRows.push({
            vp: vp.label, cycle: c + 1, page, wallMs: wall, usableMs: settled,
            domBefore: before.dom, domAfter: after.dom, domDelta: after.dom - before.dom, pageDom: after.pageDom,
            heapBeforeMB: before.heap < 0 ? -1 : +(before.heap / 1048576).toFixed(1),
            heapAfterMB: after.heap < 0 ? -1 : +(after.heap / 1048576).toFixed(1),
            lisAdded: after.lis - before.lis, longtasks: lts,
            maxLT: lts.length ? Math.max.apply(null, lts) : 0,
            activeOk: after.active === "page-" + page, errs: errs.slice(0, 3), freqs: freqs.slice(0, 2),
          });
          const ltStr = lts.length ? " LT[" + lts.join(",") + "]" : "";
          console.log("NAV[" + vp.label + " c" + (c + 1) + "] " + page + " wall=" + wall + "ms usable=" + settled + "ms dom " + before.dom + "->" + after.dom + " (page:" + after.pageDom + ") heap=" + (before.heap < 0 ? "n/a" : (before.heap / 1048576).toFixed(1) + "->" + (after.heap / 1048576).toFixed(1) + "MB") + " +lis=" + (after.lis - before.lis) + ltStr + (after.active !== "page-" + page ? " !!ACTIVE=" + after.active : "") + (errs.length ? " !!ERR:" + errs[0].slice(0, 120) : ""));
        }
      }
      // summary per section
      console.log("---- SUMMARY[" + vp.label + "] (n=" + CYCLES + " visits each) ----");
      for (const [page] of SECTIONS) {
        const rs = allRows.filter(r => r.vp === vp.label && r.page === page);
        const walls = rs.map(r => r.wallMs).sort((a, b) => a - b);
        const maxLT = Math.max.apply(null, rs.map(r => r.maxLT));
        const totLT = rs.reduce((a, r) => a + r.longtasks.length, 0);
        const domGrowth = rs[rs.length - 1].domAfter - rs[0].domBefore;
        const heapGrowth = (rs[rs.length - 1].heapAfterMB - rs[0].heapBeforeMB).toFixed(1);
        const totLis = rs.reduce((a, r) => a + r.lisAdded, 0);
        const slow = rs[rs.length - 1].wallMs - rs[0].wallMs;
        const errN = rs.reduce((a, r) => a + r.errs.length, 0);
        console.log(page + ": wall med=" + walls[Math.floor(walls.length / 2)] + " max=" + walls[walls.length - 1] + " first=" + rs[0].wallMs + " last=" + rs[rs.length - 1].wallMs + " slowΔ=" + slow +
          " maxLT=" + maxLT + " LTs=" + totLT + " domGrowth=" + domGrowth + " heapΔ=" + heapGrowth + "MB +lis=" + totLis + " errs=" + errN);
      }
      fs.writeFileSync(path.join(ROOT, "tools", "perf-nav-" + vp.label + ".json"), JSON.stringify(allRows.filter(r => r.vp === vp.label), null, 1));
      if (OVERLAP) {
        const diary = await cdp.ev("JSON.stringify((window.__dmMergeLog||[]).map(m=>m.key==='refresh'?{k:'refresh',ms:m.ms,vis:m.vis||null}:{k:m.key,add:m.added,ms:m.ms}))");
        const rstat = await cdp.ev("JSON.stringify(window.__dmRenderStat||{})");
        console.log("MERGE-DIARY[" + vp.label + "]: " + diary);
        console.log("RENDERSTAT[" + vp.label + "]: full-renderAll=" + JSON.parse(rstat).full + " scoped=" + JSON.parse(rstat).scoped);
      }
    }
    fs.writeFileSync(path.join(ROOT, "tools", "perf-nav-all.json"), JSON.stringify(allRows, null, 1));
    console.log("WROTE tools/perf-nav-all.json rows=" + allRows.length);
    const totalErrs = cdp.consoleErrs.length;
    console.log("TOTAL consoleErrs=" + totalErrs + " failedReq=" + cdp.failedReq.length);
    if (totalErrs) console.log("ERRS: " + cdp.consoleErrs.slice(0, 10).join("\n"));
    cdp.close();
  } catch (e) {
    console.log("HARNESS-FAIL " + (e && e.stack || e).slice(0, 500));
    code = 1;
  }
  try { chrome.kill(); } catch (e) {}
  try { srv.close(); } catch (e) {}
  await sleep(800);
  process.exit(code);
})();
