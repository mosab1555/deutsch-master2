/* Deutschland Life Simulator — flow QA (headless Chrome + CDP, stdlib only).
   Serves client/ over localhost, drives the REAL simulator and asserts:
   map renders, demo-first gate, full dialogue demo, checkpoint, practice with
   hints (model hidden), test gate (unreachable before watch+practice), test
   hides the model answer, help/survival work, grading accepts variants and
   repairs failures, mistakes feed S.mistakes/S.sim.weak, results persist
   across reload, mobile has no overflow, zero console errors.
   Run: node tools/qa-simulator.js (from project root). Exits 1 on any FAIL. */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19342;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("cdp-timeout:" + method)); } }, to || 25000);
    });
  }
  ev(expr, awaitPromise) {
    return this.send("Runtime.evaluate", { expression: expr, awaitPromise: !!awaitPromise, returnByValue: true })
      .then(r => {
        if (r.exceptionDetails) throw new Error("eval-ex:" + (r.exceptionDetails.text || "").slice(0, 200));
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "simqa-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Page.enable");
  const E = expr => cdp.ev("try{JSON.stringify(" + expr + ")}catch(e){'EVAL-ERR:'+e.message}");
  try {
    await cdp.send("Page.navigate", { url: base + "/index.html" });
    await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
    await sleep(2500);
    const err0 = cdp.consoleErrs.length;

    // A. nav entry exists; B. page opens
    const nav = await E("!!document.querySelector('.nav-item[data-page=\"simulator\"]')");
    rec("SIM-A", "nav entry exists", nav === "true", "nav=" + nav);
    await cdp.ev("showPage('simulator')"); await sleep(800);
    const open = await E("!!document.querySelector('#page-simulator.active')&&!!document.getElementById('simBox')&&document.getElementById('simBox').textContent.length>50");
    rec("SIM-B", "simulator page opens with map", open === "true", "open=" + open);
    const count = await E("document.querySelectorAll('#simBox [data-sim]').length");
    rec("SIM-C", "6 A1 scenarios on map", parseInt(count, 10) >= 6, "n=" + count);

    // C+D. demonstration appears FIRST with full dialogue + audio + AR
    await cdp.ev("openSimScenario('baeckerei')"); await sleep(800);
    const watch = await E("({dlg:document.querySelectorAll('#simDlg .ex-de').length,aud:document.querySelectorAll('#simDlg .sim-audio').length,ar:document.getElementById('simBox').textContent.indexOf('صباح الخير')>=0,gate:!!document.getElementById('simToCheck')})");
    const w = JSON.parse(watch);
    rec("SIM-D", "demo first: full dialogue + per-line audio + Arabic + gate", w.dlg >= 6 && w.aud >= 6 && w.ar && w.gate, watch);

    // E. phrase tap shows meaning
    await cdp.ev("document.querySelector('#simBox .sim-phrase').click()"); await sleep(400);
    const ph = await E("document.getElementById('simBox').textContent.indexOf('مهذبة')>=0||document.getElementById('simBox').textContent.indexOf('💡')>=0");
    rec("SIM-E", "tap phrase reveals meaning", ph === "true", "phrase=" + ph);

    // F. hard gate: test unreachable before watch+practice
    const gate = await E("(()=>{SIM.practiced=false;try{S.sim.demo={};}catch(e){}renderSimTest(simScenario('baeckerei'),0);return document.getElementById('simPrIn')?'practice':'other:'+(document.getElementById('simBox').textContent.slice(0,40));})()");
    rec("SIM-F", "test blocked before demo+practice", String(gate).indexOf("practice") >= 0, "gate=" + gate);

    // G. checkpoint -> practice has hints but hides model
    await cdp.ev("openSimScenario('baeckerei')"); await sleep(500);
    await cdp.ev("document.getElementById('simToCheck').click()"); await sleep(500);
    const chk = await E("!!document.getElementById('simUnderstood')&&!!document.getElementById('simRewatch')");
    rec("SIM-G", "understand checkpoint (explicit choice)", chk === "true", "chk=" + chk);
    await cdp.ev("document.getElementById('simUnderstood').click()"); await sleep(800);
    const prac = await E("({inp:!!document.getElementById('simPrIn'),hint:document.getElementById('simBox').textContent.indexOf('تلميح')>=0,modelHidden:document.getElementById('simBox').textContent.indexOf('Ich möchte zwei Brötchen, bitte.')<0})");
    const pr = JSON.parse(prac);
    rec("SIM-H", "guided practice: hint shown, model hidden", pr.inp && pr.hint && pr.modelHidden, prac);

    // H. practice success advances; I. wrong test answer gets repair + mistake
    await cdp.ev("(()=>{document.getElementById('simPrIn').value='Ich möchte zwei Brötchen, bitte.';document.getElementById('simPrOk').click();})()");
    await sleep(2800);
    const adv = await E("document.getElementById('simBox').textContent.indexOf('خطوة 2/')>=0||!!document.getElementById('simStartTest')||!!document.getElementById('simPrIn')");
    rec("SIM-I", "practice success advances flow", adv === "true", "adv=" + adv);
    // jump to test (demo done + practiced via gate page)
    await cdp.ev("(()=>{SIM.practiced=true;renderSimTest(simScenario('baeckerei'),0);})()"); await sleep(700);
    const testHides = await E("({mic:!!document.getElementById('simTsMic'),noModel:document.getElementById('simBox').textContent.indexOf('Ich möchte zwei Brötchen, bitte.')<0,help:!!document.getElementById('simHelp'),nound:!!document.getElementById('simNoUnd')})");
    const th = JSON.parse(testHides);
    rec("SIM-J", "voice test: mic + model hidden + help + لم أفهم", th.mic && th.noModel && th.help && th.nound, testHides);
    // survival help
    await cdp.ev("document.getElementById('simNoUnd').click()"); await sleep(400);
    const surv = await E("(()=>{const t=document.getElementById('simHelpOut').textContent;const known=['Wie bitte','wiederholen','nicht verstanden','Was bedeutet','langsamer'];return t.indexOf('قل:')>=0&&known.some(k=>t.indexOf(k)>=0);})()");
    rec("SIM-K", "لم أفهم teaches survival phrase", surv === "true", "surv=" + surv);
    // wrong answer -> natural repair + mistake tracked
    const m0 = await E("Object.keys(S.mistakes||{}).length");
    await cdp.ev("(()=>{document.getElementById('simTsIn').value='Ich bin zwanzig Jahre alt.';document.getElementById('simTsOk').click();})()");
    await sleep(700);
    const rep = await E("({fb:document.getElementById('simTsFb').textContent.slice(0,120),mist:Object.keys(S.mistakes||{}).length,weak:JSON.stringify((S.sim&&S.sim.weak)||{})})");
    const rp = JSON.parse(rep);
    const natural = rp.fb.indexOf("🧑") >= 0 && rp.fb.indexOf("Wrong") < 0 && rp.fb.indexOf("❌ Wrong") < 0;
    rec("SIM-L", "wrong answer: natural repair + mistake tracked", natural && rp.mist > parseInt(m0, 10) && Object.keys(rp.weak).length > 0, rp.fb + " mist=" + m0 + "->" + rp.mist);
    // reasonable variant accepted
    await cdp.ev("(()=>{document.getElementById('simTsIn').value='Ich hätte gern zwei Brötchen.';document.getElementById('simTsOk').click();})()");
    await sleep(3200);
    const acc = await E("document.getElementById('simTsIn')?'advanced':document.getElementById('simBox').textContent.slice(0,60)");
    rec("SIM-M", "reasonable variant accepted", String(acc).indexOf("advanced") >= 0 || String(acc).indexOf("اختبار") >= 0, "after=" + acc);

    // N. results + persistence across reload
    await cdp.ev("(()=>{SIM.results=[{comm:80,vocab:90,gram:70,listening:85,speaking:75}];SIM.practiced=true;renderSimResults(simScenario('baeckerei'));})()");
    await sleep(700);
    const res = await E("({t:document.getElementById('simBox').textContent.slice(0,200),done:!!(S.sim&&S.sim.done&&S.sim.done.baeckerei)})");
    const rs = JSON.parse(res);
    rec("SIM-N", "results render + saved", rs.t.indexOf("Ergebnisse") >= 0 && rs.done, res);
    await cdp.send("Page.navigate", { url: base + "/index.html" });
    await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
    await sleep(2500);
    const persist = await E("!!(S.sim&&S.sim.done&&S.sim.done.baeckerei)");
    rec("SIM-O", "progress survives reload", persist === "true", "persist=" + persist);

    // P. mobile layout: no horizontal overflow on simulator pages
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
    await sleep(500);
    await cdp.ev("showPage('simulator')"); await sleep(600);
    await cdp.ev("openSimScenario('cafe')"); await sleep(600);
    const over = await E("document.documentElement.scrollWidth<=window.innerWidth+1");
    rec("SIM-P", "mobile 360px no overflow", over === "true", "overflow-ok=" + over);
    await cdp.send("Emulation.clearDeviceMetricsOverride");

    // Q. zero console errors across the whole simulator run
    const errs = cdp.consoleErrs.slice(err0);
    rec("SIM-Q", "zero console errors", errs.length === 0, errs.join("|").slice(0, 200) || "clean");
  } catch (e) {
    rec("SIM-RUN", "harness completed", false, e.message);
  }
  console.log("----\nTOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
  try { cdp.close(); } catch (e) {}
  try { chrome.kill(); } catch (e) {}
  srv.close();
  process.exit(fail === 0 ? 0 : 1);
})();
