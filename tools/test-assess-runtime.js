/* Focused runtime QA for the Assessment Center (headless Chrome + CDP).
   Serves client/ over localhost and drives the REAL app:
   boot clean, dashboard renders, quick assessment end-to-end (all question
   types incl. match/order/fill), result + history + legacy progress updated,
   Kapitel test starts, legacy quiz engine still works, no horizontal
   overflow at 390x844 + 1366x768, zero console errors.
   Run: node tools/test-assess-runtime.js (from project root). */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19355;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "asqa-"));
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

  /* BOOT */
  let e1 = await goto("/index.html");
  let booted = await E("({t:document.title,assess:typeof DMAssess,center:!!(DMAssess&&DMAssess.center),quiz:typeof showPage})");
  rec("AS-BOOT", "app boots with assess module, zero errors", e1.length === 0 && JSON.parse(booted).center === true, booted + " errs=" + e1.join("|").slice(0, 100));

  /* DASHBOARD */
  await cdp.ev("showPage('quiz')");
  await sleep(1500);
  const dash = await E("({dash:!!document.getElementById('assessDash'),runner:!!document.getElementById('assessRunner'),kaps:document.querySelectorAll('[data-as^=\"start:kap-\"]').length,skills:document.querySelectorAll('[data-as^=\"start:skill-\"]').length,exam:!!document.querySelector('[data-as=\"start:exam-a1\"]'),place:!!document.querySelector('[data-as=\"start:placement\"]'),legacy:!!document.getElementById('quizSetup')})");
  const dj = JSON.parse(dash);
  rec("AS-DASH", "assessment dashboard renders with all sections", dj.dash === true && dj.kaps >= 5 && dj.skills === 8 && dj.exam === true && dj.place === true && dj.legacy === true, dash);

  /* run ONE quick assessment end-to-end (answer everything programmatically) */
  const t0 = await E("({t:S.testsTaken,h:(S.assess&&S.assess.history||[]).length,q:(S.quizHistory||[]).length})");
  await cdp.ev("document.querySelector('[data-as=\"start:mixed-8\"]').click()");
  await sleep(1200);
  const started = await E("!!document.getElementById('assessRunner')");
  rec("AS-START", "quick assessment session starts", started === "true", "runner=" + started);
  const runRes = await cdp.ev(`(async ()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    for(let step=0;step<45;step++){
      if(document.getElementById('assessResult')) return 'done:'+step;
      const run=document.getElementById('assessRunner');
      if(!run) return 'no-runner:'+step;
      const matchCols=document.getElementById('asrMDe');
      if(matchCols && !document.querySelector('#assessRunner [data-as=submit]')){
        // match: pair each de with its ar
        const des=[...document.querySelectorAll('#asrMDe [data-mde]')].filter(b=>!b.disabled);
        if(!des.length){ await sleep(300); continue; }
        for(const d of des){
          d.click(); await sleep(80);
          const idx=d.getAttribute('data-mde');
          const want=d.textContent;
          const ars=[...document.querySelectorAll('#asrMAr [data-mar]')];
          // find ar whose data-mde-ref matches this de text via pairs order is unknown; use index mapping from question is unavailable, so try each
          let hit=null;
          for(const a of ars){ if(a.disabled) continue; }
          // click candidates until this de locks
          for(const a of ars){
            if(a.disabled) continue;
            a.click(); await sleep(80);
            if(d.disabled) break;
          }
          if(!d.disabled){ return 'match-stuck:'+step; }
        }
        await sleep(400); continue;
      }
      const orderPool=document.getElementById('asrPool');
      if(orderPool && !document.querySelector('#asrBody .quiz-opt.sel')){
        [...orderPool.querySelectorAll('.order-chip:not(.used)')].forEach(c=>c.click());
        await sleep(150);
      }
      const inp=document.getElementById('asrIn');
      if(inp && !inp.disabled && !inp.value){ inp.value = inp.placeholder.includes('Deutsch') ? 'Ich lerne Deutsch.' : 'der'; inp.dispatchEvent(new Event('input',{bubbles:true})); }
      const opts=[...document.querySelectorAll('#asrBody .quiz-opt:not(:disabled)')];
      if(opts.length && !document.querySelector('#asrBody .quiz-opt.sel')) opts[0].click();
      const sub=document.querySelector('#assessRunner [data-as=submit]');
      if(sub){ sub.click(); await sleep(350); continue; }
      const next=document.querySelector('#assessRunner [data-as=next]');
      if(next){ next.click(); await sleep(350); continue; }
      await sleep(400);
    }
    return 'timeout:res='+!!document.getElementById('assessResult')
      +' html='+(document.getElementById('assessRunner')?document.getElementById('assessRunner').textContent.slice(0,220):'gone')
      +' sess='+(typeof DMAssess!=='undefined'&&DMAssess.app.getSess()?DMAssess.app.getSess().qs.length+'q/'+DMAssess.app.getSess().ans.filter(Boolean).length+'a':'none');
  })()`, true);
  rec("AS-RUN", "quick assessment completes to result screen", String(runRes).startsWith("done:"), String(runRes));
  await sleep(800);
  const res = await E("({pct:document.querySelector('.asr-big')?document.querySelector('.asr-big').textContent:'none',skills:document.querySelectorAll('.asd-skill').length,rev:document.querySelectorAll('.asr-rev').length,hist:(S.assess&&S.assess.history||[]).length})");
  const rj = JSON.parse(res);
  const j0 = JSON.parse(t0);
  rec("AS-RESULT", "result shows score+skills, history persisted", rj.pct !== "none" && rj.skills >= 2 && rj.hist === j0.h + 1, res);
  const integ = await E("({t:S.testsTaken,q0:(S.quizHistory||[])[0]?S.quizHistory[0].type:'none',ta:S.totalAnswered})");
  const ij = JSON.parse(integ);
  rec("AS-INTEG", "legacy progress updated (testsTaken/quizHistory/answers)", ij.t === j0.t + 1 && /🎯/.test(ij.q0) && ij.ta > 0, integ);

  /* open history entry */
  await cdp.ev("showPage('quiz')"); await sleep(1200);
  const histBtn = await E("document.querySelectorAll('[data-as^=\"hist:\"]').length");
  rec("AS-HIST", "history entry re-opens", Number(histBtn) >= 1, "entries=" + histBtn);
  if (Number(histBtn) >= 1) {
    await cdp.ev("document.querySelector('[data-as^=\"hist:\"]').click()");
    await sleep(800);
    const reopened = await E("!!document.getElementById('assessResult')");
    rec("AS-REOPEN", "old result re-renders", reopened === "true", "result=" + reopened);
    await cdp.ev("showPage('quiz')"); await sleep(1000);
  }

  /* Kapitel test starts */
  const kapBtn = await E("!!document.querySelector('[data-as=\"start:kap-K1\"]')");
  let kapRun = "skipped-no-btn";
  if (kapBtn === "true") {
    await cdp.ev("document.querySelector('[data-as=\"start:kap-K1\"]').click()");
    await sleep(1200);
    kapRun = await E("!!document.getElementById('assessRunner')");
  }
  rec("AS-KAP", "Kapitel test starts from real content", kapRun === "true", "runner=" + kapRun);
  await cdp.ev("var q=document.querySelector('#assessRunner [data-as=quit]');if(q)q.click()");
  await sleep(800);
  const resumeBanner = await E("!!document.querySelector('.as-resume')");
  rec("AS-RESUME", "quit preserves session with resume banner", resumeBanner === "true", "banner=" + resumeBanner);
  await cdp.ev("var b=document.querySelector('[data-as=discard]');if(b)b.click()");
  await sleep(600);

  /* legacy quiz engine regression */
  await cdp.ev("(()=>{const b=document.querySelector('.quiz-type[data-type=article]');if(b)b.click();})()");
  await sleep(300);
  await cdp.ev("document.getElementById('startQuiz').click()");
  await sleep(1200);
  const legQ = await E("document.querySelectorAll('#quizOpts .quiz-opt').length");
  await cdp.ev("(()=>{const b=[...document.querySelectorAll('#quizOpts .quiz-opt')];if(b[0])b[0].click();})()");
  await sleep(500);
  const legFb = await E("!document.getElementById('quizFeedback').classList.contains('hidden')");
  rec("AS-LEGACY", "legacy quiz engine untouched", Number(legQ) > 0 && legFb === "true", "opts=" + legQ + " fb=" + legFb);
  await cdp.ev("document.getElementById('quizQuit').click()"); await sleep(500);

  /* overflow sweep */
  let overFails = [];
  for (const [w, h, m, label] of [[390, 844, true, "390x844"], [1366, 768, false, "1366x768"]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: m });
    await sleep(600);
    await cdp.ev("showPage('quiz')"); await sleep(900);
    const over = await E("document.scrollingElement.scrollWidth-window.innerWidth");
    if (Number(over) > 1) overFails.push(label + "+" + over);
  }
  rec("AS-OVERFLOW", "no horizontal overflow on quiz page", overFails.length === 0, overFails.length ? overFails.join(";") : "clean");

  const totalErrs = cdp.consoleErrs.length;
  rec("AS-ERRS", "zero console/page errors across run", totalErrs === 0, totalErrs ? cdp.consoleErrs.slice(0, 4).join(" || ").slice(0, 260) : "clean");

  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
  cdp.close(); chrome.kill(); srv.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS-FAIL:", e.message); process.exit(2); });
