/* Regression test: Tests Center selection must never freeze the main thread.
   Reproduces the reported Chrome "Page Unresponsive" incident
   (Tests Center -> A1 -> Kapitel -> category) on the REAL app in headless
   Chrome, on academy.html, under the WORST-CASE condition: immediately after
   boot while the content bank is still small/sparse (lazy packs merging).
   Sparse kapitel pools make full master-target availability builds burn
   their entire retry budget (measured 14-37s main-thread block before the
   fix), while a settled full bank probes in milliseconds and would hide it.
   Selection therefore renders instantly with honest computing placeholders
   and fills in the EXACT same counts in background chunks.
   Asserts (fail loudly on regression):
     S1 kapitel click wall-time < 5s (was ~37s) with VOCAB still small
     S2 no longtask > 5s during the whole selection sequence
     S3 every visible category count converges to the exact sync-built value
     S4 Start generates a real session; answering + navigation stay fast
     S5 warm re-selection < 2s; zero console/page errors
   Complements tools/test-testcenter-freeze.js (node correctness budgets).
   Run: node tools/test-tc-selection-freeze.js (from project root). */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19351;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

let pass = 0, fail = 0;
function rec(id, name, ok, evidence) {
  if (ok) { pass++; console.log("PASS " + id + " " + name + "  [" + String(evidence).slice(0, 160) + "]"); }
  else { fail++; console.log("FAIL " + id + " " + name + "  [" + String(evidence).slice(0, 300) + "]"); }
}
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(req.url.split("?")[0]);
        if (p === "/") p = "/academy.html";
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
        } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
          this.consoleErrs.push("log:" + (m.params.entry.text || "").slice(0, 200));
        }
      });
    });
  }
  send(method, params, to) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("cdp-timeout:" + method)); } }, to || 120000);
    });
  }
  ev(expr, awaitPromise, to) {
    return this.send("Runtime.evaluate", { expression: expr, awaitPromise: !!awaitPromise, returnByValue: true }, to || 120000)
      .then(r => {
        if (r.exceptionDetails) throw new Error("eval-ex:" + JSON.stringify(r.exceptionDetails).slice(0, 300));
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
    }).on("error", () => n > 0 ? setTimeout(() => attempt(n - 1), 300) : reject(new Error("no-endpoint")));
    attempt(tries == null ? 60 : tries);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tcfreeze-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  await sleep(1200);
  const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Page.enable");
  const E = expr => cdp.ev("try{JSON.stringify(" + expr + ")}catch(e){'EVAL-ERR:'+e.message}");

  await cdp.send("Page.navigate", { url: base + "/academy.html" });
  await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),20000);})", true);
  await sleep(800);
  // longtask observer (worst case: bank still sparse right after boot)
  await cdp.ev("window.__lt=[]; try{new PerformanceObserver(l=>{l.getEntries().forEach(e=>window.__lt.push(e.duration));}).observe({entryTypes:['longtask']});}catch(e){} 1");
  // exact reported sequence, timed synchronously (click handler must return fast)
  await cdp.ev("showPage('quiz')"); await sleep(700);
  const tCap = await cdp.ev(`(function(){
    var o={};
    var t0=performance.now();
    document.querySelector('[data-tc="level:A1"]').click();
    o.levelMs=Math.round((performance.now()-t0)*10)/10;
    t0=performance.now();
    document.querySelector('[data-tc="kap:K0"]').click();
    o.kapMs=Math.round((performance.now()-t0)*10)/10;
    o.vocab=VOCAB.length;
    o.cats=document.querySelectorAll('[data-tc^="cat:"]').length;
    o.hasWs=!!document.getElementById('tcWorkspace');
    return JSON.stringify(o);
  })()`, true, 120000);
  const tc = JSON.parse(tCap);
  rec("S1", "sparse-bank kapitel click returns fast (no freeze)", tc.kapMs < 5000, "kapClick=" + tc.kapMs + "ms levelClick=" + tc.levelMs + "ms vocab=" + tc.vocab + " cats=" + tc.cats);
  const lt1 = await E("window.__lt.length?Math.round(Math.max.apply(null,window.__lt)*10)/10:0");
  rec("S2", "no longtask > 5s during selection", Number(lt1) < 5000, "ltMax=" + lt1 + "ms");

  // convergence: wait until no computing placeholders, then compare labels to exact sync builds (all inside the page)
  const conv = await cdp.ev(`(async ()=>{
    for(let i=0;i<180;i++){
      var pend=document.querySelectorAll('[data-tcpend]').length;
      var qp=-1;
      try{ qp=(typeof DMTestCenter!=='undefined'&&DMTestCenter.probePending)?DMTestCenter.probePending():-1; }catch(e){}
      if(pend===0&&(qp===0||qp===-1)) break;
      await new Promise(r=>setTimeout(r,500));
    }
    var bad=[];
    try{
      if(typeof DMTestCenter!=='undefined'&&DMTestCenter.probeCount){
        Array.from(document.querySelectorAll('#tcCats [data-tc^="cat:"]')).filter(b=>b.style.display!=='none').forEach(function(b){
          var cid=b.getAttribute('data-tc').slice(4);
          if(cid==='mistakes')return;
          var shown=(b.querySelector('small')||{}).textContent||'';
          var exact=DMTestCenter.probeCount(DMTestCenter.sel.kap,cid,null);
          var want=exact>=DMAssess.CONFIG.MASTER_CAP?DMAssess.CONFIG.MASTER_CAP+'+ متاح':exact+' متاح';
          if(shown!==want)bad.push(cid+':shown='+shown+'/exact='+want);
        });
      }
    }catch(e){ bad.push('compare-err:'+e.message); }
    var cards=Array.from(document.querySelectorAll('#tcCats [data-tc^="cat:"]')).filter(b=>b.style.display!=='none').length;
    return JSON.stringify({pend:document.querySelectorAll('[data-tcpend]').length, bad:bad, cards:cards, vocab:(typeof VOCAB!=='undefined'?VOCAB.length:-1)});
  })()`, true, 150000);
  const cv = JSON.parse(conv);
  rec("S3", "counts converge to exact sync-built values", cv.pend === 0 && cv.bad.length === 0, "pend=" + cv.pend + " cards=" + cv.cards + " vocab=" + cv.vocab + (cv.bad.length ? " MISMATCH:" + cv.bad.slice(0, 3).join(";") : " all-exact"));

  // category -> workspace -> start -> answer -> navigate (real session)
  await cdp.ev(`var c=document.querySelector('[data-tc="cat:words"]')||document.querySelector('#tcCats [data-tc^="cat:"]');if(c)c.click()`);
  await sleep(1500);
  const ws = await E("({ws:!!document.getElementById('tcWorkspace'),start:!!document.querySelector('[data-tc=\"start\"]')})");
  const wsj = JSON.parse(ws);
  rec("S4a", "workspace + start render from category", wsj.ws === true && wsj.start === true, ws);
  const tStart = await cdp.ev(`(function(){var t0=performance.now();document.querySelector('[data-tc="start"]').click();return JSON.stringify({ms:Math.round((performance.now()-t0)*10)/10,run:!!document.getElementById('assessRunner'),nq:(DMAssess.app.getSess()?DMAssess.app.getSess().qs.length:-1)});})()`, true, 120000);
  const ts = JSON.parse(tStart);
  rec("S4b", "start generates a real session", ts.run === true && ts.nq >= 5, tStart);
  await cdp.ev(`(()=>{const inp=document.getElementById('asrIn');if(inp&&!inp.disabled&&!inp.value){inp.value='der';}
    const opts=[...document.querySelectorAll('#asrBody .quiz-opt:not(:disabled)')];if(opts.length)opts[0].click();
    const s=document.querySelector('#assessRunner [data-as=submit]');if(s)s.click();})()`);
  await sleep(700);
  await cdp.ev("var n=document.querySelector('#assessRunner [data-as=next]');if(n)n.click()");
  await sleep(700);
  const nav = await E("!!document.getElementById('assessRunner')");
  rec("S4c", "answer + navigate inside session", nav === "true", "runner=" + nav);
  await cdp.ev("var q=document.querySelector('#assessRunner [data-as=quit]');if(q)q.click()");
  await sleep(900);
  await cdp.ev("var b=document.querySelector('[data-as=discard]');if(b)b.click()");
  await sleep(1200);

  // warm re-selection must stay fast
  const tWarm = await cdp.ev(`(function(){var t0=performance.now();var k=document.querySelector('[data-tc="kap:K1"]');if(k)k.click();return JSON.stringify({ms:Math.round((performance.now()-t0)*10)/10});})()`, true, 60000);
  rec("S5a", "warm re-selection stays fast", JSON.parse(tWarm).ms < 2000, tWarm);
  const lt2 = await E("window.__lt.length?Math.round(Math.max.apply(null,window.__lt)*10)/10:0");
  rec("S5b", "no longtask > 5s across full run", Number(lt2) < 5000, "ltMax=" + lt2 + "ms");

  // repeated generation: 3x kap->cat->start->answer->quit->discard, DOM must not accumulate
  const dom0 = await E("document.getElementsByTagName('*').length");
  const rep = await cdp.ev(`(async ()=>{
    var errs=[];
    for(var r=0;r<3;r++){
      try{
        var ks=document.querySelectorAll('[data-tc^="kap:"]');
        if(ks.length>1)ks[(r+1)%ks.length].click(); else if(ks.length)ks[0].click();
        await new Promise(x=>setTimeout(x,400));
        var c=document.querySelector('[data-tc="cat:words"]')||document.querySelector('#tcCats [data-tc^="cat:"]');
        if(c)c.click();
        await new Promise(x=>setTimeout(x,400));
        var st=document.querySelector('[data-tc="start"]');
        if(st)st.click();
        await new Promise(x=>setTimeout(x,900));
        if(!document.getElementById('assessRunner')){errs.push('r'+r+':no-runner');break;}
        var o=[...document.querySelectorAll('#asrBody .quiz-opt:not(:disabled)')];
        if(o.length)o[0].click();
        var s=document.querySelector('#assessRunner [data-as=submit]');if(s)s.click();
        await new Promise(x=>setTimeout(x,300));
        var q=document.querySelector('#assessRunner [data-as=quit]');if(q)q.click();
        await new Promise(x=>setTimeout(x,500));
        var d=document.querySelector('[data-as=discard]');if(d)d.click();
        await new Promise(x=>setTimeout(x,700));
      }catch(e){errs.push('r'+r+':'+e.message);}
    }
    // let background probes settle, then measure retained DOM
    await new Promise(x=>setTimeout(x,3000));
    return JSON.stringify({errs:errs, dom:document.getElementsByTagName('*').length,
      tcw:document.querySelectorAll('[data-tc]').length,
      heap:(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):-1)});
  })()`, true, 120000);
  const rp = JSON.parse(rep);
  rec("S7a", "3x repeated generation completes without errors", rp.errs.length === 0, rp.errs.length ? rp.errs.join(";") : "3 cycles ok heap=" + rp.heap + "MB");
  const domGrowth = rp.dom - Number(dom0);
  rec("S7b", "no DOM accumulation across repeated navigation", Math.abs(domGrowth) < 600, "dom " + dom0 + "->" + rp.dom + " (Δ=" + domGrowth + ")");

  const totalErrs = cdp.consoleErrs.length;
  rec("S6", "zero console/page errors across run", totalErrs === 0, totalErrs ? cdp.consoleErrs.slice(0, 4).join(" || ").slice(0, 280) : "clean");

  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
  cdp.close(); chrome.kill(); srv.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS-FAIL:", e.message); process.exit(2); });
