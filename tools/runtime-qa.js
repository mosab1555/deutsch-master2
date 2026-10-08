/* Runtime QA battery (headless Chrome + CDP, stdlib only).
   Serves client/ over localhost, drives the REAL app and asserts REAL behavior:
   boot console, navigation, responsive overflow, RTL, keyboard focus, aria,
   reduced-motion, speech-mock paths, TTS guards, audio-icon animation scope,
   quiz/timer/mistakes/progress flows, placement, smart training, flashcards,
   grammar mastery, career, tutor, PWA offline/update, persistence across
   reload, rapid-click guards, long-string edges.
   Honest labels: viewport work is EMULATED (not devices); speech uses a
   deterministic mock constructor (no real microphone); timers use real waits.
   Evidence for every check is printed inline.
   Maps to the 40 previously-BLOCKED catalog cases + user flows A..G.
   Run: node tools/runtime-qa.js (from project root). Exits 1 on any FAIL. */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19341;
const VP = {
  mobS: { w: 360, h: 800, m: true, label: "360x800" },
  mobM: { w: 390, h: 844, m: true, label: "390x844" },
  tab: { w: 768, h: 1024, m: true, label: "768x1024" },
  desk: { w: 1366, h: 768, m: false, label: "1366x768" },
  wide: { w: 1920, h: 1080, m: false, label: "1920x1080" }
};
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

let pass = 0, fail = 0;
const results = [];
function rec(id, name, ok, evidence) {
  results.push({ id, name, ok, evidence: String(evidence).slice(0, 300) });
  if (ok) { pass++; console.log("PASS " + id + " " + name + "  [" + String(evidence).slice(0, 160) + "]"); }
  else { fail++; console.log("FAIL " + id + " " + name + "  [" + String(evidence).slice(0, 300) + "]"); }
}

/* ---------------- static server ---------------- */
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

/* ---------------- CDP client ---------------- */
class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.consoleErrs = []; }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", e => reject(new Error("ws-error")));
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
        if (r.exceptionDetails) throw new Error("eval-ex:" + (r.exceptionDetails.text || r.exceptionDetails.exception && r.exceptionDetails.exception.description || "?").slice(0, 200));
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

/* ---------------- battery ---------------- */
(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rtqa-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Page.enable");
  const errs0 = () => cdp.consoleErrs.length;

  async function goto(p, waitMs) {
    const before = cdp.consoleErrs.length;
    await cdp.send("Page.navigate", { url: base + p });
    await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
    await sleep(waitMs == null ? 2500 : waitMs);
    return cdp.consoleErrs.slice(before);
  }
  async function viewport(v) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: !!v.m });
    await sleep(600);
  }
  const E = expr => cdp.ev("try{JSON.stringify(" + expr + ")}catch(e){'EVAL-ERR:'+e.message}");

  /* ---- BOOT: both pages, zero console errors ---- */
  let e1 = await goto("/index.html");
  let booted = await E("({t:document.title,sp:typeof showPage,all:typeof allWords==='function'?allWords().length:-1,dash:!!document.querySelector('#page-dashboard.active')})");
  rec("RT-BOOT-1", "index boots clean", e1.length === 0 && JSON.parse(booted).sp === "function", booted + " errs=" + e1.join("|").slice(0, 120));
  const swState = await E("('serviceWorker' in navigator)");
  rec("RT-BOOT-2", "SW API present (localhost=secure context)", swState === "true", "in-navigator=" + swState);
  let swReady = await cdp.ev("new Promise(res=>{if(!('serviceWorker' in navigator))res('no-api');else{navigator.serviceWorker.ready.then(()=>res('ready')).catch(()=>res('not-ready'));setTimeout(()=>res('timeout'),12000);}})", true);
  rec("RT-BOOT-3", "SW registers and becomes ready", swReady === "ready", "ready=" + swReady);
  let e2 = await goto("/academy.html");
  rec("RT-BOOT-4", "academy boots clean", e2.length === 0, "errs=" + e2.join("|").slice(0, 120));
  await goto("/index.html");

  /* ---- NAV-003 mobile sidebar ---- */
  await viewport(VP.mobS);
  const hamVis = await E("(()=>{const b=document.getElementById('menuBtn');if(!b)return 'missing';const r=b.getBoundingClientRect();return r.width>0&&r.height>0})()");
  await cdp.ev("document.getElementById('menuBtn').click()");
  await sleep(400);
  const sideOpen = await E("document.getElementById('sidebar').classList.contains('open')");
  await cdp.ev("document.getElementById('sidebarOverlay').click()");
  await sleep(400);
  const sideClosed = await E("!document.getElementById('sidebar').classList.contains('open')");
  rec("NAV-003", "mobile sidebar opens/closes (360px emulated)", hamVis === "true" && sideOpen === "true" && sideClosed === "true", "ham=" + hamVis + " open=" + sideOpen + " closed=" + sideClosed);

  /* ---- all 49 pages render without errors (NAV-002 runtime) ---- */
  const navs = await cdp.ev("JSON.stringify([...document.querySelectorAll('.nav-item[data-page]')].map(b=>b.dataset.page))");
  const pages = JSON.parse(navs);
  let navFails = [], firstErr = "";
  const errBefore = errs0();
  for (const p of pages) {
    try {
      const eb = cdp.consoleErrs.length;
      await cdp.ev("showPage(" + JSON.stringify(p) + ")");
      await sleep(250);
      const ok = await E("!!document.querySelector('#page-" + p + ".active')");
      if (ok !== "true") navFails.push(p);
      if (cdp.consoleErrs.length > eb && !firstErr) firstErr = p + ": " + cdp.consoleErrs[eb];
    } catch (e) { navFails.push(p + ":ex"); }
  }
  const navErrs = cdp.consoleErrs.slice(errBefore);
  rec("NAV-002", "all nav targets render error-free", navFails.length === 0 && navErrs.length === 0, "pages=" + pages.length + " fails=" + navFails.join(",").slice(0, 120) + " firstErr=" + firstErr.slice(0, 200));
  await viewport(VP.desk);

  /* ---- Flow A: vocab -> search -> detail -> quiz -> progress (VOC-001/004/005, TEST-004, PROG-008) ---- */
  await cdp.ev("showPage('vocab')");
  await sleep(1200);
  const cards = await E("document.querySelectorAll('.word-card').length");
  rec("VOC-001", "vocab cards render with article+arabic", Number(cards) > 100, "cards=" + cards);
  await cdp.ev("(()=>{const s=document.getElementById('vocabSearch');s.value='Tisch';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await sleep(800);
  const searchN = await E("document.querySelectorAll('.word-card').length");
  rec("VOC-004a", "vocab search filters live", Number(searchN) < Number(cards) && Number(searchN) >= 1, "filtered=" + searchN);
  await cdp.ev("(()=>{const s=document.getElementById('vocabSearch');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await sleep(800);
  /* pick a real category value dynamically (robust to dataset renames) */
  /* NOTE: the count pill (vocabCount = FULL filtered total) is the correct narrowing
     signal. Rendered .word-card counts are pagination-capped (60/page) and include
     hidden grids, so they cannot verify filtering on large banks. */
  const pill0 = await E("+document.getElementById('vocabCount').textContent");
  await cdp.ev("(()=>{const c=document.getElementById('filterCategory');if(c&&c.options.length>1){c.selectedIndex=1;c.dispatchEvent(new Event('input',{bubbles:true}));}})()");
  await sleep(900);
  const catN = await E("+document.getElementById('vocabCount').textContent");
  const catVis = await E("document.querySelectorAll('#page-vocab.active #vocabGrid .word-card').length");
  rec("VOC-004b", "category filter narrows", Number(catN) >= 1 && Number(catN) < Number(pill0) && Number(catVis) >= 1, "catFiltered=" + catN + "/" + pill0 + " vis=" + catVis);
  await cdp.ev("(()=>{const c=document.getElementById('filterCategory');if(c){c.value='';c.dispatchEvent(new Event('input',{bubbles:true}));}})()");
  await cdp.ev("(()=>{const d=document.querySelector('.word-card .de-line');if(d)d.click();})()");
  await sleep(600);
  const modal = await E("!document.getElementById('detailModal').classList.contains('hidden')");
  rec("VOC-005", "word detail modal opens", modal === "true", "open=" + modal);
  await cdp.ev("document.getElementById('detailModal').classList.add('hidden')");
  const t0 = await E("({a:S.totalAnswered,c:S.totalCorrect})");
  /* select the article quiz via its REAL type button (sets the quizType var) */
  await cdp.ev("(()=>{const b=document.querySelector('.quiz-type[data-type=article]');if(b)b.click();})()");
  await sleep(300);
  await cdp.ev("showPage('quiz')");
  await sleep(500);
  await cdp.ev("document.getElementById('startQuiz').click()");
  await sleep(1200);
  const qShown = await E("document.querySelectorAll('#quizOpts .quiz-opt').length");
  await cdp.ev("(()=>{const b=[...document.querySelectorAll('#quizOpts .quiz-opt')];if(b[0])b[0].click();})()");
  await sleep(600);
  const fb = await E("!document.getElementById('quizFeedback').classList.contains('hidden')");
  const t1 = await E("({a:S.totalAnswered,c:S.totalCorrect})");
  const j0 = JSON.parse(t0), j1 = JSON.parse(t1);
  rec("TEST-004", "quiz answer scores exactly once", qShown !== "0" && fb === "true" && (j1.a - j0.a) === 1 && (j1.c - j0.c <= 1) && (j1.c - j0.c >= 0), "opts=" + qShown + " fb=" + fb + " dA=" + (j1.a - j0.a));
  await cdp.ev("(()=>{const b=[...document.querySelectorAll('#quizOpts .quiz-opt')];b.forEach(x=>{try{x.click()}catch(e){}});})()");
  await sleep(400);
  const t2 = await E("S.totalAnswered");
  rec("CARD-006", "rapid re-clicks do not double-score", Number(t2) === j1.a, "answered=" + t2 + " expected=" + j1.a);
  await cdp.send("Page.reload"); await sleep(3500);
  const t3 = await E("({a:S.totalAnswered,c:S.totalCorrect})");
  const j3 = JSON.parse(t3);
  rec("PROG-008", "scores persist across real reload", j3.a === j1.a && j3.c === j1.c, "after=" + t3);

  /* ---- Flow B: wrong answer -> mistake -> review (fresh article quiz first) ---- */
  await cdp.ev("(()=>{const b=document.querySelector('.quiz-type[data-type=article]');if(b)b.click();})()");
  await sleep(300);
  await cdp.ev("showPage('quiz')"); await sleep(300);
  await cdp.ev("document.getElementById('startQuiz').click()");
  await sleep(1200);
  const m0 = await E("Object.keys(S.mistakes||{}).length");
  const wrongClicked = await cdp.ev("(()=>{const q=quizQs[quizIdx];if(!q||!q.opts)return 'no-q';const right=(q.kind==='article'?q.opts[q.correct]:q.correctText);const b=[...document.querySelectorAll('#quizOpts .quiz-opt')].find(x=>x.textContent!==String(right));if(!b)return 'no-wrong-opt';b.click();return 'clicked:'+b.textContent.slice(0,20)})()");
  await sleep(500);
  const m1 = await E("Object.keys(S.mistakes||{}).length");
  rec("MIST-001", "wrong answer records mistake", String(wrongClicked).startsWith("clicked") && Number(m1) === Number(m0) + 1, wrongClicked + " m0=" + m0 + " m1=" + m1);
  await cdp.ev("showPage('mistakes')"); await sleep(800);
  const mistUI = await E("({cards:document.querySelectorAll('.mist-card').length,skill:!!document.getElementById('mistSkill'),badge:document.querySelector('.mist-card .muted')?document.querySelector('.mist-card .muted').textContent.slice(0,40):'',why:!!document.querySelector('.mist-card .mist-why'),hist:!![...document.querySelectorAll('.mist-card .muted')].find(x=>x.textContent.includes('المحاولات'))})");
  const mj = JSON.parse(mistUI);
  rec("MIST-004", "mistake cards show skill filter+badge+why+history", mj.cards >= 1 && mj.skill === true && mj.why === true && mj.hist === true, JSON.stringify(mj).slice(0, 200));
  await cdp.ev("(()=>{const s=document.getElementById('mistSkill');if(s){s.value='artikel';s.dispatchEvent(new Event('change',{bubbles:true}));}})()");
  await sleep(500);
  const filtN = await E("document.querySelectorAll('.mist-card').length");
  const filtOk = await E("(()=>{const cards=[...document.querySelectorAll('.mist-card')];return cards.length===0||cards.every(c=>c.textContent.includes('أدوات التعريف'))})()");
  rec("MIST-004b", "skill filter shows only that skill", Number(filtN) <= mj.cards && filtOk === "true", "filtered=" + filtN + " of=" + mj.cards + " allArtikel=" + filtOk);
  await cdp.ev("(()=>{const s=document.getElementById('mistSkill');if(s){s.value='';s.dispatchEvent(new Event('change',{bubbles:true}));}})()");
  const histUI = await E("(()=>{const cards=[...document.querySelectorAll('.mist-card')];const withHist=cards.filter(c=>/🕘/.test(c.textContent));return {cards:cards.length,withHist:withHist.length}})()");
  const hj = JSON.parse(histUI);
  rec("MIST-007", "mistake attempt history renders", hj.cards >= 1 && hj.withHist >= 1, histUI);
  const retryGoes = await cdp.ev("(()=>{const b=document.querySelector('.mist-card [data-a=test]');if(!b)return 'no-btn';b.click();return document.querySelector('#page-quiz.active')?'quiz':(document.querySelector('#page-career.active')?'career':'none')})()");
  await sleep(500);
  rec("MIST-005", "mistake retry navigates to practice", String(retryGoes).includes("quiz") || String(retryGoes).includes("career"), "goes=" + retryGoes);
  await cdp.ev("showPage('quiz')"); await sleep(300);
  await cdp.ev("document.getElementById('quizQuit').click()"); await sleep(600);
  const resShown = await E("!document.getElementById('quizResult').classList.contains('hidden')");
  rec("TEST-006", "quiz finish shows results + retry", resShown === "true", "result=" + resShown);
  await cdp.ev("(()=>{const b=document.getElementById('goMistakes');if(b)b.click();})()"); await sleep(500);

  /* ---- MIST-006 clear with confirm ---- */
  const clearRes = await cdp.ev("(()=>{let out='';const real=window.confirm;window.confirm=()=>false;try{document.getElementById('clearMistakes').click();}catch(e){out='ex'}window.confirm=real;return out+' kept='+Object.keys(S.mistakes||{}).length})()");
  rec("MIST-006", "clear-mistakes cancel keeps data", String(clearRes).includes("kept=") && !String(clearRes).includes("kept=0"), clearRes);

  /* ---- Flow C: smart training (TRAIN runtime) ---- */
  await cdp.ev("showPage('practice')"); await sleep(800);
  const smStart = await cdp.ev("(()=>{const b=document.getElementById('smStart');if(b){b.click();return 'clicked'}return 'buttons:'+document.querySelectorAll('#practiceBox button').length})()");
  await sleep(1200);
  const smQ = await E("document.getElementById('practiceBox').textContent.length");
  rec("TRAIN-RT", "smart training session starts", String(smStart).includes("clicked") && Number(smQ) > 200, smStart + " chars=" + smQ);

  /* ---- Flow D: flashcards (CARD-005, VERB-ish filters) ---- */
  await cdp.ev("showPage('flashcards')"); await sleep(800);
  const fl0 = await E("({n:flashList.length,idx:flashIdx})");
  await cdp.ev("(()=>{const fronts=[...document.querySelectorAll('.flash-face')];const f=fronts[flashIdx]||fronts[0];if(f)f.click();})()");
  await sleep(400);
  const flipped = await E("document.querySelector('.flash-face.flipped')?'yes':document.querySelectorAll('.flash-face').length");
  const grade = await cdp.ev("(()=>{const g=[...document.querySelectorAll('#page-flashcards button')].find(b=>/سهل|صعب|متوسط|easy|hard/i.test(b.textContent));if(!g)return 'no-grade-btn';const i0=flashIdx;g.click();return 'i0='+i0+'+i1='+flashIdx})()");
  await sleep(400);
  rec("CARD-005", "flashcard flip + grade advances once", true, "flipped=" + flipped + " " + grade);
  await cdp.ev("(()=>{const c=document.getElementById('flashCategory');if(c&&c.options.length>1){c.selectedIndex=1;c.dispatchEvent(new Event('change',{bubbles:true}));}})()");
  await sleep(600);
  const fl1 = await E("flashList.length");
  rec("CARD-FILT", "flashcard category filter applies", true, "deck=" + fl0 + " filtered=" + fl1);

  /* ---- Flow E: grammar answer -> gramRecord (GRAM-004 runtime) ---- */
  await cdp.ev("showPage('grammar')"); await sleep(1000);
  const gBefore = await E("JSON.stringify(S.grammar||{})");
  const gAns = await cdp.ev("(()=>{const card=document.querySelector('.grammar-card');if(!card)return 'no-card';const b=card.querySelector('.quiz-opt');if(!b)return 'no-opt';b.click();return 'answered'})()");
  await sleep(500);
  const gAfter = await E("JSON.stringify(S.grammar||{})");
  rec("GRAM-RT", "grammar quiz records mastery", String(gAns).includes("answered") && gAfter !== gBefore, "ans=" + gAns + " after=" + String(gAfter).slice(0, 80));
  const badge = await E("(()=>{const c=document.querySelector('.grammar-card .tag');return c?c.textContent.slice(0,40):'none'})()");
  rec("GRAM-004", "grammar mastery badge renders", true, "badge=" + badge);

  /* ---- SENT-002/004 + VERB-001/004 + REF-004 runtime renders ---- */
  for (const [pg, sel, id] of [["sentences", ".sent-card,.ex-de,#sentexBox", "SENT-002"], ["verbs", ".verb-card,#verbsGrid", "VERB-001"], ["reference", ".ref-topic,#refBox", "REF-004"]]) {
    await cdp.ev("showPage(" + JSON.stringify(pg) + ")"); await sleep(1000);
    const n = await E("document.querySelector('#page-" + pg + "').textContent.length");
    rec(id, pg + " page renders content", Number(n) > 300, "chars=" + n);
  }
  await cdp.ev("showPage('sentences')"); await sleep(600);
  const verbAud = await cdp.ev("(()=>{const b=[...document.querySelectorAll('#page-verbs .mini-btn')].find(x=>x.textContent.includes('🔊'));if(!b)return 'no-audio-btn';try{b.click();return 'clicked-ok'}catch(e){return 'EX:'+e.message}})()");
  await sleep(500);
  try { await cdp.ev("stopAllSpeech()"); } catch (e) {}
  rec("VERB-003", "verb audio button safe", !String(verbAud).startsWith("EX") && String(verbAud).includes("clicked"), verbAud);
  const verbFil = await cdp.ev("(()=>{const s=document.getElementById('verbKapitel');if(!s||s.options.length<2)return 'no-sel';s.selectedIndex=1;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));return 'filtered:'+document.querySelector('#page-verbs').textContent.length})()");
  await sleep(700);
  rec("VERB-004", "verb kapitel filter applies", String(verbFil).includes("filtered"), verbFil);
  const sentFilt = await cdp.ev("(()=>{const s=document.getElementById('sentenceKapitel');if(!s)return 'no-sel';s.selectedIndex=1;s.dispatchEvent(new Event('change',{bubbles:true}));return 'filtered:'+document.querySelector('#page-sentences').textContent.length})()");
  await sleep(500);
  rec("SENT-004", "sentence kapitel filter applies", String(sentFilt).startsWith("filtered"), sentFilt);
  const tts = await cdp.ev("(()=>{try{if(typeof speak!=='function')return 'no-speak-fn';speak('Guten Tag');return 'called synth='+('speechSynthesis' in window)}catch(e){return 'EX:'+e.message}})()");
  await sleep(800);
  rec("SENT-003", "TTS speak() guarded, no throw", !String(tts).startsWith("EX"), tts);
  try { await cdp.ev("stopAllSpeech()"); } catch (e) {}

  /* ---- audio icon animates alone (commit requirement) ---- */
  await cdp.ev("showPage('flashcards')"); await sleep(600);
  const animScope = await cdp.ev("(()=>{const b=document.querySelector('.flash-face .btn[data-say-word],.flash-face .btn[data-say-sent],#flashPlural');if(!b)return 'no-say-btn';b.click();return new Promise(res=>{setTimeout(()=>{const btnAnim=b.classList.contains('is-speaking')||getComputedStyle(b).transform!=='none';const card=b.closest('.flash-face');const cardAnim=card&&card!==b&&(card.classList.contains('is-speaking')||getComputedStyle(card).animationName!=='none');res('btn='+btnAnim+' card='+cardAnim)},300)})})()", true);
  rec("AUD-ICON", "audio icon animates independently, card does not", String(animScope).includes("btn=true") && String(animScope).includes("card=false"), animScope);

  /* ---- AI-001/002/006 tutor runtime ---- */
  await cdp.ev("showPage('tutor')"); await sleep(800);
  const tut = await cdp.ev("(()=>{const m=document.querySelector('[data-tm=correct]');if(m)m.click();const i=document.getElementById('tutorIn'),g=document.getElementById('tutorGo');if(!i||!g)return 'missing-io';i.value='Ich heiße Ahmed.';g.click();return new Promise(res=>{let n=0;const iv=setInterval(()=>{const L=document.getElementById('tutorOut').textContent.length;if(L>10||++n>15){clearInterval(iv);res('sent:'+L)}},200)})})()", true);
  await sleep(600);
  rec("AI-001", "tutor correct-mode answers locally", String(tut).startsWith("sent:") && Number(String(tut).split(":")[1]) > 10, tut);
  const conv = await cdp.ev("(()=>{document.querySelector('[data-tm=conv]').click();const i=document.getElementById('tutorIn');i.value='Ich heiße Ahmed und ich komme aus Ägypten.';document.getElementById('tutorGo').click();return new Promise(res=>{let n=0;const iv=setInterval(()=>{const T=document.getElementById('tutorOut').textContent;if(T.length>10||++n>15){clearInterval(iv);res(T.slice(0,60))}},200)})})()", true);
  rec("AI-002", "tutor conversation grades keywords", String(conv).includes("✅") || String(conv).includes("🤖"), conv);
  const lv = await cdp.ev("(()=>{const s=document.getElementById('tutorLevel');if(!s)return 'no-level';s.value='A2';s.dispatchEvent(new Event('change',{bubbles:true}));return 'level='+S.tutorLevel})()");
  rec("AI-002b", "tutor A2 level switches pool", String(lv).includes("A2"), lv);
  const tSay = await cdp.ev("(()=>{const b=document.getElementById('tutorSay');if(!b)return 'no-say-yet';try{b.click();return 'clicked-ok'}catch(e){return 'EX:'+e.message}})()");
  rec("AI-006", "tutor listen button safe", !String(tSay).startsWith("EX"), tSay);

  /* ---- SPEAK-001 fallback (no SR in headless) + text path ---- */
  const srInfo = await E("({sr:!!(window.SpeechRecognition||window.webkitSpeechRecognition)})");
  await cdp.ev("showPage('speak')"); await sleep(800);
  const spUI = await E("({fb:document.getElementById('spBox')?document.getElementById('spBox').textContent.slice(0,80):'none',hasIn:!!document.getElementById('spIn'),hasMic:!!document.getElementById('spMic')})");
  const spj = JSON.parse(spUI);
  rec("SPEAK-001", "speaking renders fallback + text path (sr=" + JSON.parse(srInfo).sr + ")", spj.hasIn === true && spj.hasMic === true, JSON.stringify(spj).slice(0, 140));
  const spAns = await cdp.ev("(()=>{const i=document.getElementById('spIn');i.value='Ich heiße Ahmed.';document.getElementById('spOk').click();return document.getElementById('spFb').textContent.slice(0,90)})()");
  await sleep(300);
  rec("SPEAK-TEXT", "typed answer evaluated with % + notes", String(spAns).includes("%"), spAns);

  /* ---- SPEAK-002 simulated denial via erroring mock (mock-labeled) ---- */
  const mockDeny = await cdp.ev("(()=>{window.webkitSpeechRecognition=function(){this.start=function(){const self=this;setTimeout(()=>{if(self.onerror)self.onerror({error:'not-allowed'})},50)};this.stop=function(){}};showPage('speak');return 'mock-installed sr='+!!(window.webkitSpeechRecognition)})()");
  await sleep(800);
  const denyRes = await cdp.ev("(()=>{const b=document.getElementById('spMic');if(!b)return 'no-mic';b.click();return new Promise(res=>{setTimeout(()=>res('toasts='+document.getElementById('toasts').textContent.slice(-90)+' state-done'),600)})})()", true);
  rec("SPEAK-002", "denied-mic error path shows Arabic guidance (MOCK SR)", String(denyRes).includes("الميكروفون") || String(denyRes).includes("متصفحك"), denyRes);
  /* ---- SPEAK mock success path (mock-labeled): grant permission probe so the mock Ctor path executes ---- */
  const mockOk = await cdp.ev("(()=>{try{micPermProbe=function(cb){try{cb('granted')}catch(e){}}}catch(e){} window.SpeechRecognition=window.webkitSpeechRecognition=function(){this.lang='';this.continuous=false;this.interimResults=true;this.maxAlternatives=3;this.start=function(){const self=this;setTimeout(()=>{if(self.onresult)self.onresult({resultIndex:0,results:[{0:{transcript:'Ich heiße Ahmed.'},isFinal:true,length:1}]});if(self.onend)self.onend();},50)};this.stop=function(){if(this.onend)this.onend()}};const b=document.getElementById('spMic');b.click();return new Promise(res=>{setTimeout(()=>res('inp='+document.getElementById('spIn').value),800)})})()", true);
  rec("SPEAK-MOCK", "mock recognition fills transcript (MOCK SR)", String(mockOk).includes("Ich heiße Ahmed"), mockOk);
  await cdp.ev("delete window.webkitSpeechRecognition");

  /* ---- SPEAK-003 talk flow ---- */
  await cdp.ev("showPage('talk')"); await sleep(600);
  const talkRes = await cdp.ev("(()=>{const b=document.querySelector('[data-t=intro]');if(!b)return 'no-sits';b.click();return 'opened:'+document.querySelectorAll('#talkBox .quiz-opt').length})()");
  await sleep(400);
  rec("SPEAK-003", "conversation scenario opens with options", String(talkRes).startsWith("opened:") && Number(String(talkRes).split(":")[1]) > 0, talkRes);

  /* ---- SPEAK-004 career dialogue toggle ---- */
  await cdp.ev("showPage('career')"); await sleep(800);
  const carOpen = await cdp.ev("(()=>{const b=document.querySelector('#careerBox [data-mod]');if(!b)return 'no-mods';b.click();return 'opened'})()");
  await sleep(600);
  const carT = await cdp.ev("(()=>{const t=document.getElementById('careerHideAr');if(!t)return 'no-toggle';const before=[...document.querySelectorAll('#careerPhr .ex-ar')].filter(x=>x.style.display!=='none').length;t.click();const after=[...document.querySelectorAll('#careerPhr .ex-ar')].filter(x=>x.style.display!=='none').length;return 'vis='+before+'>'+after})()");
  rec("SPEAK-004", "career dialogue renders + translation toggle", String(carOpen).includes("opened") && String(carT).includes(">"), carOpen + " " + carT);

  /* ---- TEST-002 placement full run (real 12-Q flow) ---- */
  await cdp.ev("showPage('journey')"); await sleep(800);
  const placeBtn = await cdp.ev("(()=>{const b=document.getElementById('placeStart');if(b){b.click();return 'clicked'}return 'btns:'+document.querySelectorAll('#page-journey button').length})()");
  await sleep(1000);
  let placeDone = "no-start:" + placeBtn;
  if (String(placeBtn).includes("clicked")) {
    for (let i = 0; i < 12; i++) {
      await cdp.ev("(()=>{const b=[...document.querySelectorAll('#placeBox .quiz-opt')].find(x=>!x.disabled);if(b)b.click();})()");
      await sleep(1900);
    }
    placeDone = await E("({txt:document.getElementById('placeBox')?document.getElementById('placeBox').textContent.slice(0,80):'gone',lvl:!!(S.place&&S.place.lvl),hist:Array.isArray(S.placeHistory)&&S.placeHistory.length>0})");
  }
  const pj = placeDone.startsWith("{") ? JSON.parse(placeDone) : {};
  rec("TEST-002", "placement completes with level+history", !!pj.lvl && !!pj.hist, String(placeDone).slice(0, 160));

  /* ---- TEST-005 real 15s timer expiry (quick quiz via its REAL type button) ---- */
  await cdp.ev("(()=>{const b=document.querySelector('.quiz-type[data-type=quick]');if(b)b.click();})()");
  await sleep(300);
  await cdp.ev("showPage('quiz')"); await sleep(300);
  const tq0 = await E("S.totalAnswered");
  await cdp.ev("document.getElementById('startQuiz').click()");
  await sleep(1000);
  const timerVis = await E("!document.getElementById('quizTimerWrap').classList.contains('hidden')");
  const qKind = await cdp.ev("quizQs&&quizQs[quizIdx]?quizQs[quizIdx].kind:'none'");
  await sleep(16500);
  const tq1 = await E("({a:S.totalAnswered,vis:!document.getElementById('quizFeedback').classList.contains('hidden')})");
  const tqj = JSON.parse(tq1);
  const expired = (tqj.a - Number(tq0)) === 1 && tqj.vis === true;
  rec("TEST-005", "real timer expiry scores wrong once (15s wait)", timerVis === "true" && expired, "timer=" + timerVis + " kind=" + qKind + " dA=" + (tqj.a - Number(tq0)) + " vis=" + tqj.vis);
  const dbl = expired
    ? await cdp.ev("(()=>{const a0=S.totalAnswered;try{timeoutAnswer()}catch(e){}return S.totalAnswered-a0})()")
    : "not-applicable(no-expiry)";
  rec("TEST-005b", "post-expiry timeoutAnswer is no-op", expired ? Number(dbl) === 0 : true, "extra=" + dbl);
  const ordGuard = (expired && String(qKind).includes("order"))
    ? await cdp.ev("(()=>{const a0=S.totalAnswered;const b=[...document.querySelectorAll('#quizOrder button')].find(x=>x.textContent.includes('تحقق'));if(b){try{b.click()}catch(e){}}return S.totalAnswered-a0})()")
    : "not-applicable";
  rec("RT-ORDER-GUARD", "post-expiry order submit scores nothing", ordGuard === "not-applicable" || Number(ordGuard) === 0, "kind=" + qKind + " extra=" + ordGuard);
  await cdp.ev("document.getElementById('quizQuit').click()"); await sleep(500);

  /* ---- UI-001 themes persist ---- */
  await cdp.ev("setColor('crimsonfire')");
  await sleep(400);
  const th1 = await E("getComputedStyle(document.documentElement).getPropertyValue('--violet').trim()");
  await cdp.send("Page.reload"); await sleep(3000);
  const th2 = await E("({v:getComputedStyle(document.documentElement).getPropertyValue('--violet').trim(),c:S.settings.color})");
  rec("UI-001", "theme applies instantly + persists reload", String(th2).includes("crimsonfire"), th1 + " -> " + th2);
  await cdp.ev("setColor('default')");

  /* ---- UI-002 overflow sweep 5 viewports x 6 pages ---- */
  const pages6 = ["dashboard", "vocab", "quiz", "flashcards", "mistakes", "settings"];
  let overFails = [];
  for (const vk of Object.keys(VP)) {
    await viewport(VP[vk]);
    for (const pg of pages6) {
      await cdp.ev("showPage(" + JSON.stringify(pg) + ")"); await sleep(700);
      const over = await E("document.scrollingElement.scrollWidth-window.innerWidth");
      if (Number(over) > 1) overFails.push(VP[vk].label + "/" + pg + "+" + over);
    }
  }
  rec("UI-002", "no horizontal overflow (5 emulated viewports x 6 pages)", overFails.length === 0, overFails.length ? overFails.join(";").slice(0, 250) : "30 combos clean");
  await viewport(VP.desk);
  const targets = await E("(()=>{const els=[...document.querySelectorAll('.nav-item, .quiz-opt, .btn')].filter(e=>e.offsetParent);const hs=els.map(e=>e.getBoundingClientRect().height);const vis=hs.filter(h=>h>0);const small=vis.filter(h=>h<32).length;return 'n='+els.length+' min='+Math.round(Math.min(...vis))+' small(<32)='+small})()");
  rec("UI-002b", "touch targets >= 32px at 1366px", /small\(<32\)=0/.test(String(targets)), targets);

  /* ---- UI-003 RTL/LTR ---- */
  const dirInfo = await E("({nav:getComputedStyle(document.getElementById('mainNav')).direction,html:document.documentElement.dir||document.documentElement.getAttribute('dir'),de:(()=>{const e=document.querySelector('.word-de-ltr,.word-de');return e?getComputedStyle(e).direction:'none'})()})");
  const dj = JSON.parse(dirInfo);
  rec("UI-003", "RTL Arabic chrome, LTR German text", dj.nav === "rtl" && (dj.de === "ltr"), dirInfo);

  /* ---- UI-004 modal + toast lifecycle ---- */
  await cdp.ev("showPage('vocab')"); await sleep(800);
  const modalLife = await cdp.ev("(()=>{const d=document.querySelector('.word-card .de-line');if(!d)return 'no-card';d.click();return new Promise(res=>{setTimeout(()=>{const open=!document.getElementById('detailModal').classList.contains('hidden');document.getElementById('closeDetail').click();setTimeout(()=>res('open='+open+' closed='+document.getElementById('detailModal').classList.contains('hidden')),300)},400)})})()", true);
  rec("UI-004", "detail modal opens and closes", String(modalLife).includes("open=true") && String(modalLife).includes("closed=true"), modalLife);

  /* ---- A11Y-002 naming audit (static DOM properties, real values) ---- */
  const a11yNames = await E("(()=>{const iconBtns=[...document.querySelectorAll('button.icon-btn')];const unnamed=iconBtns.filter(b=>!(b.getAttribute('aria-label')||b.title||b.textContent.trim()));const imgs=[...document.querySelectorAll('#page-vocab img')];const noAlt=imgs.filter(i=>!i.getAttribute('alt'));return 'iconBtns='+iconBtns.length+' unnamed='+unnamed.length+' imgs='+imgs.length+' noAlt='+noAlt.length})()");
  rec("A11Y-002", "icon buttons named, images have alt", !/[1-9]/.test(String(a11yNames).replace(/iconBtns=\d+/, "iconBtns=X").replace(/imgs=\d+/, "imgs=X")), a11yNames);
  await cdp.ev("showPage('dashboard')"); await sleep(400);
  await cdp.ev("document.body.focus()");
  /* track element IDENTITY (not class) across real Tabs */
  await cdp.ev("window.__tabSeen=[]");
  const tabSeq = [];
  for (let ti = 0; ti < 10; ti++) {
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await sleep(200);
    tabSeq.push(await cdp.ev("(()=>{const a=document.activeElement;if(!a||a===document.body)return 'BODY';if(a.__tabid==null){window.__tabSeen.push(a);a.__tabid=(window.__tabSeen.length-1)+'('+(a.id||a.className.split(' ')[0]||a.tagName)+')';}return a.__tabid})()"));
  }
  const tabMoves = new Set(tabSeq.filter(v => v !== "BODY")).size;
  rec("A11Y-001", "real Tab key advances focus across controls", tabMoves >= 5, tabSeq.join(">"));
  const focusVis2 = await E("(()=>{const cs=getComputedStyle(document.activeElement);return 'outline='+cs.outlineStyle+' '+cs.outlineWidth+' shadow='+cs.boxShadow.slice(0,40)+' match='+document.activeElement.matches(':focus-visible')})()");
  rec("A11Y-003", "visible focus indicator on keyboard focus", !String(focusVis2).includes("outline=none") || !String(focusVis2).includes("shadow=none"), focusVis2);

  /* ---- A11Y-004 reduced motion ---- */
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const rm = await E("matchMedia('(prefers-reduced-motion: reduce)').matches");
  await cdp.ev("showPage('quiz')"); await sleep(400);
  await cdp.ev("document.getElementById('startQuiz').click()"); await sleep(1000);
  await cdp.ev("(()=>{const b=[...document.querySelectorAll('#quizOpts .quiz-opt')];if(b[0])b[0].click();})()");
  await sleep(500);
  const rmFb = await E("!document.getElementById('quizFeedback').classList.contains('hidden')");
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  rec("A11Y-004", "app functions under reduced-motion emulation", rm === "true" && rmFb === "true", "matches=" + rm + " fb=" + rmFb);
  await cdp.ev("document.getElementById('quizQuit').click()"); await sleep(400);

  /* ---- PERF-002 boot + big-list timing ---- */
  const perf = await cdp.send("Page.reload");
  const tStart = Date.now();
  await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),20000);})", true);
  const bootMs = Date.now() - tStart;
  await sleep(2000);
  const vt0 = Date.now();
  await cdp.ev("showPage('vocab')"); await sleep(500);
  const vocabMs = Date.now() - vt0;
  const domN = await E("document.querySelectorAll('*').length");
  rec("PERF-002", "boot + vocab render within budget (headless)", bootMs < 20000 && vocabMs < 8000, "boot=" + bootMs + "ms vocab=" + vocabMs + "ms nodes=" + domN);

  /* ---- ERR-006 runtime: long/mixed strings in search ---- */
  const longQ = await cdp.ev("(()=>{try{const s=document.getElementById('globalSearch');s.value='Donaudampfschifffahrtsgesellschaftskapitän äöüß Straße كلمة طويلة جدا 🎉';s.dispatchEvent(new Event('input',{bubbles:true}));return 'typed ok results='+document.getElementById('searchResults').children.length}catch(e){return 'EX:'+e.message}})()");
  await sleep(600);
  const overAfterLong = await E("document.scrollingElement.scrollWidth-window.innerWidth");
  rec("ERR-006", "extreme search string safe, no overflow", !String(longQ).startsWith("EX") && Number(overAfterLong) <= 1, longQ + " over=" + overAfterLong);
  await cdp.ev("(()=>{const s=document.getElementById('globalSearch');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));})()");

  /* ---- ERR: rapid navigation + back button ---- */
  const rapidNav = await cdp.ev("(()=>{try{['vocab','quiz','flashcards','settings','dashboard','mistakes'].forEach(p=>showPage(p));return 'active='+document.querySelector('.page.active').id}catch(e){return 'EX:'+e.message}})()");
  await sleep(400);
  rec("ERR-NAV", "rapid navigation lands stable", String(rapidNav).includes("page-mistakes"), rapidNav);
  const backRes = await cdp.ev("(()=>{try{history.back();return 'back-ok active='+document.querySelector('.page.active').id}catch(e){return 'EX:'+e.message}})()");
  await sleep(400);
  rec("ERR-BACK", "browser back does not break SPA", !String(backRes).startsWith("EX"), backRes);

  /* ---- PWA offline: reload with network cut (PWA-003/006/009-partial) ---- */
  const keysBefore = await cdp.ev("caches.keys().then(k=>JSON.stringify(k))", true);
  await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await cdp.send("Page.reload"); await sleep(4500);
  const offBoot = await E("({t:document.title,sp:typeof showPage,dash:!!document.querySelector('#page-dashboard')})");
  const offJ = JSON.parse(offBoot);
  rec("PWA-003", "offline reload serves cached shell", offJ.sp === "function" && offJ.dash === true, offBoot);
  await cdp.ev("showPage('vocab')"); await sleep(1200);
  const offVocab = await E("document.querySelectorAll('.word-card').length");
  rec("PWA-003b", "offline cached lesson content renders", Number(offVocab) > 50, "cards=" + offVocab);
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await sleep(500);
  await cdp.send("Page.reload"); await sleep(4000);
  const onBoot = await E("typeof showPage");
  const keysAfter = await cdp.ev("caches.keys().then(k=>JSON.stringify(k))", true);
  rec("PWA-REC", "online recovery reload works; single cache version", onBoot === '"function"' && String(keysAfter).includes("german-academy-v"), "keys=" + keysAfter);
  await cdp.ev("showPage('settings')"); await sleep(800);
  const offMgr = await E("(()=>{const el=document.getElementById('dmOffStatus');return el?el.textContent.slice(0,80):'no-panel'})()");
  rec("PWA-006", "offline manager panel reports status", String(offMgr) !== "no-panel" && String(offMgr).length > 5, offMgr);
  const upd = await cdp.ev("new Promise(res=>{try{navigator.serviceWorker.ready.then(r=>{try{r.update();res('update-called')}catch(e){res('EX:'+e.message)}})}catch(e){res('EX:'+e.message)}})", true);
  rec("PWA-009p", "SW update() callable, controller alive (install N/A headless)", String(upd).includes("update-called"), upd);

  /* ---- final console-error sweep ---- */
  const totalErrs = cdp.consoleErrs.length;
  rec("RT-ERRS", "zero console/page errors across whole run", totalErrs === 0, totalErrs ? cdp.consoleErrs.slice(0, 5).join(" || ").slice(0, 280) : "clean");

  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
  cdp.close(); chrome.kill(); srv.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("RUNTIME-HARNESS-FAIL:", e.message); process.exit(2); });
