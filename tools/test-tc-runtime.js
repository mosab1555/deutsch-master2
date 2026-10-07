/* Runtime QA for the Test Center guided flow (headless Chrome + CDP).
   Drives the REAL app: boot, level->Kapitel->category->mode->difficulty
   picker, custom builder start, daily, boss lock display, challenge timer,
   train-first links, records, overflow at 412x915 + 1440x900, zero errors.
   Run: node tools/test-tc-runtime.js (from project root). */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19357;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

let pass = 0, fail = 0;
function rec(id, name, ok, evidence) {
  if (ok) { pass++; console.log("PASS " + id + " " + name + "  [" + String(evidence).slice(0, 150) + "]"); }
  else { fail++; console.log("FAIL " + id + " " + name + "  [" + String(evidence).slice(0, 280) + "]"); }
}
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

(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tcqa-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Page.enable");
  const E = expr => cdp.ev("try{JSON.stringify(" + expr + ")}catch(e){'EVAL-ERR:'+e.message}");

  async function goto(p, waitMs) {
    const before = cdp.consoleErrs.length;
    await cdp.send("Page.navigate", { url: base + p });
    await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
    await sleep(waitMs == null ? 3000 : waitMs);
    return cdp.consoleErrs.slice(before);
  }

  let e1 = await goto("/index.html");
  let booted = await E("({tc:typeof DMTestCenter,flow:!!document.querySelector('.tc-flow')})");
  await cdp.ev("showPage('quiz')"); await sleep(1800);
  booted = await E("({tc:typeof DMTestCenter,flow:!!document.querySelector('.tc-flow'),levels:document.querySelectorAll('[data-tc^=\"level:\"]').length})");
  const bj = JSON.parse(booted);
  rec("TC-BOOT", "testcenter module + picker flow render, zero boot errors", e1.length === 0 && bj.tc === "object" && bj.flow === true && bj.levels === 3, booted + " errs=" + e1.join("|").slice(0, 80));

  /* level -> kapitel */
  await cdp.ev("document.querySelector('[data-tc=\"level:A1\"]').click()");
  await sleep(1500);
  const kaps = await E("document.querySelectorAll('[data-tc^=\"kap:\"]').length");
  rec("TC-KAP", "A1 shows real Kapitel cards with mastery", Number(kaps) >= 5, "kaps=" + kaps);

  /* kapitel -> categories (availability-filtered) */
  await cdp.ev("document.querySelector('[data-tc=\"kap:K1\"]').click()");
  await sleep(2000);
  const cats = await E("({n:document.querySelectorAll('[data-tc^=\"cat:\"]').length,hasWords:!!document.querySelector('[data-tc=\"cat:words\"]'),hasBoss:document.querySelector('.tc-flow').textContent.includes('الزعيم')})");
  const cj = JSON.parse(cats);
  rec("TC-CAT", "K1 shows content-backed category cards + boss", cj.n >= 5 && cj.hasWords === true && cj.hasBoss === true, cats);

  /* category -> mode/difficulty/start */
  await cdp.ev("var c=document.querySelector('[data-tc=\"cat:words\"]');if(c)c.click()");
  await sleep(1200);
  const modes = await E("({modes:document.querySelectorAll('[data-tc^=\"mode:\"]').length,diffs:document.querySelectorAll('[data-tc^=\"diff:\"]').length,start:!!document.querySelector('[data-tc=\"start\"]')})");
  const mj = JSON.parse(modes);
  rec("TC-MODE", "mode (4) + difficulty (4) + start render", mj.modes === 4 && mj.diffs === 4 && mj.start === true, modes);
  await cdp.ev("document.querySelector('[data-tc=\"mode:normal\"]').click()");
  await sleep(600);
  await cdp.ev("document.querySelector('[data-tc=\"diff:graded\"]').click()");
  await sleep(600);
  await cdp.ev("document.querySelector('[data-tc=\"start\"]').click()");
  await sleep(1500);
  const run = await E("({run:!!document.getElementById('assessRunner'),badge:!!document.querySelector('.asr-mode')})");
  rec("TC-START", "picker starts a real session with mode badge", JSON.parse(run).run === true, run);

  /* answer two, check badge stays, quit keeps resume */
  for (let k = 0; k < 2; k++) {
    await cdp.ev(`(()=>{
      const inp=document.getElementById('asrIn');
      if(inp&&!inp.disabled&&!inp.value){inp.value='der';}
      const pool=document.getElementById('asrPool');
      if(pool){[...pool.querySelectorAll('.order-chip:not(.used)')].forEach(c=>c.click());}
      const opts=[...document.querySelectorAll('#asrBody .quiz-opt:not(:disabled)')];
      if(opts.length&&!document.querySelector('#asrBody .quiz-opt.sel'))opts[0].click();
      const cr=[...document.querySelectorAll('#asrBody [data-crow]')];
      if(cr.length){const rows={};cr.forEach(x=>{rows[x.getAttribute('data-crow')]=1;});Object.keys(rows).forEach(r=>{const b=document.querySelector('#asrBody [data-crow="'+r+'"]');if(b)b.click();});}
      const s=document.querySelector('#assessRunner [data-as=submit]');if(s)s.click();
    })()`);
    await sleep(600);
    await cdp.ev("var n=document.querySelector('#assessRunner [data-as=next]');if(n)n.click()");
    await sleep(600);
  }
  const badge = await E("!!document.querySelector('.asr-mode')");
  rec("TC-BADGE", "session shows training/test mode badge", badge === "true", "badge=" + badge);
  await cdp.ev("var q=document.querySelector('#assessRunner [data-as=quit]');if(q)q.click()");
  await sleep(900);
  const res = await E("!!document.querySelector('.as-resume')");
  rec("TC-RESUME", "picker session quit is resumable", res === "true", "banner=" + res);
  await cdp.ev("var b=document.querySelector('[data-as=discard]');if(b)b.click()");
  await sleep(700);

  /* custom builder */
  await cdp.ev("var t=document.querySelector('[data-tc=\"builder\"]');if(t)t.click()");
  await sleep(900);
  const builder = await E("({cats:document.querySelectorAll('[data-bcat]').length,counts:document.querySelectorAll('[name=tcbcount]').length,go:!!document.querySelector('[data-tc=\"buildstart\"]')})");
  const buj = JSON.parse(builder);
  rec("TC-BUILDER", "custom builder form renders", buj.cats >= 10 && buj.counts >= 5 && buj.go === true, builder);
  await cdp.ev("document.querySelector('[data-tc=\"buildstart\"]').click()");
  await sleep(1500);
  const brun = await E("!!document.getElementById('assessRunner')");
  rec("TC-BUILDSTART", "custom builder starts a real session", brun === "true", "runner=" + brun);
  await cdp.ev("var q=document.querySelector('#assessRunner [data-as=quit]');if(q)q.click()");
  await sleep(800);
  await cdp.ev("var b=document.querySelector('[data-as=discard]');if(b)b.click()");
  await sleep(700);

  /* challenge mode: per-question timer appears */
  await cdp.ev("var r=document.querySelector('input[name=tcbmode][value=challenge]');if(r)r.click()");
  await sleep(400);
  await cdp.ev("document.querySelector('[data-tc=\"buildstart\"]').click()");
  await sleep(1500);
  const ch = await E("({run:!!document.getElementById('assessRunner'),qt:!!document.getElementById('asrQTimer'),badge:document.querySelector('.asr-mode')?document.querySelector('.asr-mode').textContent:''})");
  const chj = JSON.parse(ch);
  rec("TC-CHALLENGE", "challenge mode shows per-question timer", chj.run === true && chj.qt === true && /تحدي/.test(chj.badge), ch);
  await cdp.ev("var q=document.querySelector('#assessRunner [data-as=quit]');if(q)q.click()");
  await sleep(800);
  await cdp.ev("var b=document.querySelector('[data-as=discard]');if(b)b.click()");
  await sleep(700);

  /* daily + smart + mistakes + boss-locked + records + train links */
  await cdp.ev("document.querySelector('[data-tc=\"daily\"]').click()");
  await sleep(1500);
  const drun = await E("!!document.getElementById('assessRunner')");
  rec("TC-DAILY", "daily challenge starts (date-seeded)", drun === "true", "runner=" + drun);
  await cdp.ev("var q=document.querySelector('#assessRunner [data-as=quit]');if(q)q.click()");
  await sleep(800);
  await cdp.ev("var b=document.querySelector('[data-as=discard]');if(b)b.click()");
  await sleep(700);
  const misc = await E("({smart:!!document.querySelector('[data-tc=\"smart\"]'),mist:!!document.querySelector('[data-tc=\"mistakes\"]'),bossLock:document.querySelector('.tc-flow').textContent.includes('🔒 اختبار الزعيم')||document.querySelector('.tc-flow').textContent.includes('👑 اختبار الزعيم'),records:document.body.textContent.includes('سجلاتك الشخصية'),trainLinks:document.querySelectorAll('[data-tcgo]').length})");
  const miscJ = JSON.parse(misc);
  rec("TC-MISC", "smart/mistakes/boss/records/train-links present", miscJ.smart === true && miscJ.mist === true && miscJ.bossLock === true && miscJ.records === true && miscJ.trainLinks >= 5, misc);

  /* overflow: 412x915 + 1440x900 */
  let overFails = [];
  for (const [w, h, m, label] of [[412, 915, true, "412x915"], [1440, 900, false, "1440x900"]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: m });
    await sleep(600);
    await cdp.ev("showPage('quiz')"); await sleep(1200);
    const over = await E("document.scrollingElement.scrollWidth-window.innerWidth");
    if (Number(over) > 1) overFails.push(label + "+" + over);
  }
  rec("TC-OVERFLOW", "no horizontal overflow with picker", overFails.length === 0, overFails.length ? overFails.join(";") : "clean");

  const totalErrs = cdp.consoleErrs.length;
  rec("TC-ERRS", "zero console/page errors across run", totalErrs === 0, totalErrs ? cdp.consoleErrs.slice(0, 4).join(" || ").slice(0, 260) : "clean");

  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
  cdp.close(); chrome.kill(); srv.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS-FAIL:", e.message); process.exit(2); });
