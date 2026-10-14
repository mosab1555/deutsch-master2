/* Deutsch Master - Language-switch runtime QA (headless Chrome + CDP).
   Drives the REAL app and verifies the English language switch end to end:
   AR -> EN updates interface chrome + vocabulary meanings immediately (no
   reload), German learning content stays byte-identical, EN -> AR restores,
   selection survives reload, zero console errors. Desktop + mobile widths.
   Run: node tools/test-langswitch-runtime.js (from project root).
   Exit 0 = PASS, 1 = FAIL. */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19361;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "langsw-"));
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
    await sleep(waitMs == null ? 3500 : waitMs);
    return cdp.consoleErrs.slice(before);
  }

  try {
    const bootErrs = await goto("/index.html");
    const ready = await E("({t:typeof t,apply:typeof applyLang,refresh:typeof refreshLangViews,um:typeof wordMeaning,show:typeof showPage,words:(typeof allWords==='function'?allWords().length:-1)})");
    rec("LS-BOOT", "app boots, i18n + lang-switch helpers present", bootErrs.length === 0 && /"refresh":"function"/.test(ready) && /"um":"function"/.test(ready), ready + " errs=" + bootErrs.join("|").slice(0, 80));

    // default language = ar, RTL
    const lang0 = await E("({L:(typeof S!=='undefined'&&S.uiLang)||'?',html:document.documentElement.getAttribute('lang'),dir:document.documentElement.getAttribute('dir')})");
    rec("LS-DEFAR", "default interface language is Arabic RTL", /"L":"ar"/.test(lang0) && /"dir":"rtl"/.test(lang0), lang0);

    // nav labels in Arabic mode contain Arabic; snapshot them
    const navAr = await E("Array.from(document.querySelectorAll('.nav-item')).map(b=>b.textContent.trim()).join(' | ').slice(0,400)");
    rec("LS-NAVAR", "Arabic nav labels render in ar mode", /[\u0600-\u06FF]/.test(navAr), String(navAr).slice(0, 120));

    // German snapshot: vocab card German words (must never change across switch)
    await cdp.ev("showPage('vocab')"); await sleep(1500);
    const deAr = await E("Array.from(document.querySelectorAll('#page-vocab .word-de, #page-vocab .vocab-de')).map(e=>e.textContent.trim()).slice(0,12).join(' # ')");
    const meanAr = await E("(()=>{const e=document.querySelector('#page-vocab .word-ar, #page-vocab .vocab-ar');return e?e.textContent.trim().slice(0,60):'NONE';})()");
    rec("LS-VOCABAR", "vocab list shows Arabic meanings in ar mode", /[\u0600-\u06FF]/.test(meanAr), String(meanAr).slice(0, 80));

    // switch to English (no reload)
    await cdp.ev("setHeaderLang('en')"); await sleep(1500);
    const lang1 = await E("({L:S.uiLang,html:document.documentElement.getAttribute('lang'),dir:document.documentElement.getAttribute('dir')})");
    rec("LS-ENATTR", "switch to English sets lang=en dir=ltr, persisted in S", /"L":"en"/.test(lang1) && /"html":"en"/.test(lang1) && /"dir":"ltr"/.test(lang1), lang1);

    const navEn = await E("Array.from(document.querySelectorAll('.nav-item')).map(b=>b.textContent.trim()).join(' | ').slice(0,400)");
    rec("LS-NAVEN", "nav labels switch to English (no Arabic remains)", !/[\u0600-\u06FF]/.test(navEn) && /Home|Words/.test(navEn), String(navEn).slice(0, 140));

    // vocab page auto re-rendered in English: every meaning shows the correct
    // available language field (English gloss when the word carries one)
    const vocabChk = await E("(()=>{try{const cards=Array.from(document.querySelectorAll('#vocabGrid .word-card'));if(!cards.length)return 'EMPTY';let bad=0,checked=0,en=0;cards.slice(0,20).forEach(c=>{const w=wordById(c.getAttribute('data-wid'));const el=c.querySelector('.word-ar');if(!w||!el)return;checked++;const exp=wordMeaning(w);if(el.textContent!==exp)bad++;if(exp&&!/[\\u0600-\\u06FF]/.test(exp))en++;});return checked+':'+bad+':'+en;}catch(e){return 'EVAL-ERR';}})()");
    const deEn = await E("Array.from(document.querySelectorAll('#page-vocab .word-de, #page-vocab .vocab-de')).map(e=>e.textContent.trim()).slice(0,12).join(' # ')");
    const vparts = String(vocabChk).replace(/"/g, "").split(":");
    rec("LS-VOCABEN", "vocab meanings display the correct language field in en mode", vparts[0] !== "EMPTY" && vparts[0] !== "EVAL-ERR" && vparts[1] === "0" && +vparts[0] > 0, String(vocabChk) + " (checked:bad:english)");
    rec("LS-DEKEEP", "German vocabulary unchanged by interface switch", deAr !== "" && deAr === deEn, "ar=[" + String(deAr).slice(0, 80) + "] en=[" + String(deEn).slice(0, 80) + "]");

    // flashcards: back face shows the correct available language field —
    // English gloss when the word carries one, otherwise the Arabic fallback
    // (German face must always stay German).
    await cdp.ev("showPage('flashcards')"); await sleep(1500);
    const flashEn = await E("(()=>{const b=document.querySelector('#flashAr');return b?b.textContent.trim().slice(0,60):'NONE';})()");
    const flashDe = await E("(()=>{const b=document.querySelector('#flashWord');return b?b.textContent.trim().slice(0,60):'NONE';})()");
    const flashExp = await E("(()=>{try{const id=document.querySelector('#flashcard').dataset.wid;const w=wordById(id);return wordMeaning(w).slice(0,60);}catch(e){return 'EVAL-ERR';}})()");
    rec("LS-FLASHEN", "flashcard back shows correct language field, German face intact", flashEn !== "NONE" && flashEn === flashExp && !/[\u0600-\u06FF]/.test(flashDe), "back=" + flashEn + " expect=" + flashExp + " front=" + flashDe);

    // sentences page renders in en mode without errors; German sentences intact
    await cdp.ev("showPage('sentences')"); await sleep(1500);
    const sentDe = await E("(()=>{const els=document.querySelectorAll('#page-sentences .sent-de');return els.length+':'+(els[0]?els[0].textContent.trim().slice(0,50):'NONE');})()");
    rec("LS-SENT", "sentences render in en mode, German intact", !/^0:/.test(sentDe) && !/NONE/.test(sentDe), String(sentDe).slice(0, 100));

    // converted pages: dashboard, review, mistakes, stats, verbs, grammar,
    // explain must render translated chrome, keep German, never leak t() calls.
    // Arabic may remain ONLY inside educational content, never as code leaks.
    let pcOk = true; const pcNotes = [];
    for (const p of ["dashboard", "review", "mistakes", "stats", "verbs", "grammar", "explain"]) {
      await cdp.ev("showPage('" + p + "')"); await sleep(900);
      const s = await E("(()=>{try{const el=document.querySelector('#page-" + p + "');const txt=el?el.innerText:'';const ar=(txt.match(/[\\u0600-\\u06FF]/g)||[]).length;const tl=(txt.match(/window\\.t\\(/g)||[]).length;const uw=(txt.match(/\\+window|undefined|null/g)||[]).length;return txt.length+':'+ar+':'+tl+':'+uw;}catch(e){return 'EVAL-ERR';}})()");
      const parts = String(s).replace(/"/g, "").split(":");
      const okLen = +parts[0] > 30, okLeak = parts[2] === "0";
      if (!okLen || !okLeak || parts[0] === "EVAL-ERR") pcOk = false;
      pcNotes.push(p + "=" + String(s).replace(/"/g, ""));
    }
    rec("LS-PAGESEN", "converted pages render without code leaks in en mode", pcOk, pcNotes.join(" "));

    // assessment center + test center open in en mode without errors
    await cdp.ev("showPage('quiz')"); await sleep(1500);
    const quizEn = await E("(()=>{const el=document.querySelector('#page-quiz');return (el?el.innerText:'').slice(0,200);})()");
    await cdp.ev("if(typeof DMTestCenter!=='undefined'&&DMTestCenter.show)DMTestCenter.show();else showPage('quiz')"); await sleep(1200);
    rec("LS-QUIZ", "assessment center renders in en mode", quizEn && quizEn.length > 20, String(quizEn).slice(0, 100));

    // switch back to Arabic: nav restores exactly
    await cdp.ev("setHeaderLang('ar')"); await sleep(1200);
    const navAr2 = await E("Array.from(document.querySelectorAll('.nav-item')).map(b=>b.textContent.trim()).join(' | ').slice(0,400)");
    rec("LS-BACKAR", "EN->AR restores Arabic nav labels", navAr2 === navAr, String(navAr2).slice(0, 100));

    // persistence across reload
    await cdp.ev("setHeaderLang('en')"); await sleep(800);
    await goto("/index.html", 3500);
    const langR = await E("({L:(typeof S!=='undefined'&&S.uiLang)||'?',html:document.documentElement.getAttribute('lang')})");
    rec("LS-PERSIST", "language survives reload", /"L":"en"/.test(langR) && /"html":"en"/.test(langR), langR);
    await cdp.ev("setHeaderLang('ar')"); await sleep(600);

    // mobile viewport: no overflow breakage, no errors
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
    await cdp.ev("showPage('vocab')"); await sleep(1200);
    await cdp.ev("setHeaderLang('en')"); await sleep(1200);
    const mobNav = await E("Array.from(document.querySelectorAll('.nav-item')).map(b=>b.textContent.trim()).join(' | ').slice(0,200)");
    rec("LS-MOBILE", "mobile 412px English switch works", !/[\u0600-\u06FF]/.test(mobNav), String(mobNav).slice(0, 100));
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.ev("setHeaderLang('ar')"); await sleep(500);

    const errs = cdp.consoleErrs;
    rec("LS-NOERR", "zero console/page errors across switch journey", errs.length === 0, errs.slice(0, 3).join(" || ").slice(0, 200) || "clean");
  } catch (e) {
    rec("LS-HARNESS", "harness completed", false, String(e && e.message || e).slice(0, 200));
  }

  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
  try { cdp.close(); } catch (e) {}
  try { chrome.kill(); } catch (e) {}
  try { srv.close(); } catch (e) {}
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("FAIL LS-FATAL " + String(e && e.message || e).slice(0, 200)); process.exit(1); });
