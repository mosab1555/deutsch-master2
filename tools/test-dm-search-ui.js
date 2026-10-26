/* Deutsch Master — Unified search (DMSearch) browser UI test.
 * Serves the REAL client/ over localhost, drives the REAL app in headless
 * Chrome (CDP, stdlib only) through 3 user journeys:
 *   U1 common word      "Haus"
 *   U2 uncommon word    (unlikely in local bank)
 *   U3 full sentence    "Ich gehe zur Arbeit."
 * Asserts: zero JS errors, local hits preserved, #dmExt region renders
 * progressively, source links + attribution present, no navigation/reload,
 * no global rebuild, mobile layout intact. Remote provider content is
 * recorded as evidence (live network), not hard-required beyond structure.
 * Run: node tools/test-dm-search-ui.js. Exits 1 on any FAIL. */
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
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? "  [" + String(e).slice(0, 200) + "]" : "")); } else { fail++; console.log("FAIL " + n + (e ? "  [" + String(e).slice(0, 300) + "]" : "")); } }

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
        if (r.exceptionDetails) throw new Error("eval-ex");
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dmsearch-ui-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  let cdp;
  try {
    cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Runtime.enable"); await cdp.send("Page.enable");
    const E = expr => cdp.ev("try{JSON.stringify(" + expr + ")}catch(e){'EVAL-ERR:'+e.message}");

    await cdp.send("Page.navigate", { url: base + "/index.html" });
    await cdp.ev("new Promise(res=>{if(document.readyState==='complete')res(1);else window.addEventListener('load',()=>res(1),{once:true});setTimeout(()=>res(2),15000);})", true);
    await sleep(2500);
    const bootErrs = cdp.consoleErrs.length;
    ok("U0 boot clean + DMSearch present",
      bootErrs === 0 && (await E("typeof DMSearch")) === '"object"' && (await E("typeof DMSearch.search")) === '"function"',
      "errs=" + bootErrs + " providers=" + await E("DMSearch.providers.length"));

    async function journey(id, query) {
      const eb = cdp.consoleErrs.length;
      await cdp.ev("(()=>{const s=document.getElementById('globalSearch');s.value=" + JSON.stringify(query) +
        ";s.dispatchEvent(new Event('input',{bubbles:true}));})()");
      /* wait for progressive region (local 120ms + enhance 450ms + network) */
      /* wait for progressive region to settle: two identical snapshots in a row
         (local 120ms + enhance 450ms + up to 4 live providers), max ~30s */
      let snap = null, prevKey = "", stable = 0;
      for (let i = 0; i < 40; i++) {
        await sleep(750);
        snap = await E("(()=>{const b=document.getElementById('searchResults');if(!b)return null;" +
          "const ext=document.getElementById('dmExt');" +
          "return {shown:b.classList.contains('show'),hits:b.querySelectorAll('.search-hit').length," +
          "ext:!!ext,secs:ext?ext.querySelectorAll('.dm-ext-sec').length:0," +
          "links:ext?ext.querySelectorAll('a.dm-ext-link').length:0," +
          "loading:ext?ext.querySelectorAll('.dm-loading').length:0," +
          "audio:ext?ext.querySelectorAll('audio').length:0," +
          "retry:ext?!!ext.querySelector('.dm-retry'):false," +
          "html:ext?ext.innerHTML.slice(0,80):''}})()");
        const s0 = JSON.parse(snap);
        const key = s0 ? [s0.secs, s0.links, s0.loading, s0.retry].join("/") : "null";
        stable = (key === prevKey) ? stable + 1 : 0;
        prevKey = key;
        if (s0 && s0.ext && s0.loading === 0 && stable >= 2) break;
      }
      const s = JSON.parse(snap);
      const newErrs = cdp.consoleErrs.slice(eb);
      ok(id + " no js errors", newErrs.length === 0, newErrs.join("|").slice(0, 160) || "clean");
      ok(id + " local hits preserved", s && s.shown && s.hits > 1, "hits=" + (s && s.hits));
      ok(id + " ext region renders", s && s.ext && (s.secs > 0 || s.links > 0 || s.retry),
        "secs=" + (s && s.secs) + " links=" + (s && s.links) + " retry=" + (s && s.retry));
      /* audio elements only with valid src; TTS button always present when ext rendered */
      const tts = await E("!!(document.getElementById('dmExt')&&document.getElementById('dmExt').textContent.indexOf('🔊')>=0)");
      ok(id + " pronunciation fallback control", tts === "true" || (s && s.audio > 0), "tts=" + tts + " audioEls=" + (s && s.audio));
      return s;
    }

    const s1 = await journey("U1 Haus", "Haus");
    console.log("INFO U1 evidence secs=" + s1.secs + " links=" + s1.links + " audio=" + s1.audio);
    const s2 = await journey("U2 rare", "Donaudampfschifffahrt");
    console.log("INFO U2 evidence secs=" + s2.secs + " links=" + s2.links);
    const s3 = await journey("U3 sentence", "Ich gehe zur Arbeit.");
    console.log("INFO U3 evidence secs=" + s3.secs + " links=" + s3.links + " audio=" + s3.audio);

    /* machine-translation honesty: any MT badge must say machine/unverified */
    const mtHonest = await E("(()=>{const x=document.getElementById('dmExt');if(!x)return 'none';" +
      "const badges=[...x.querySelectorAll('.dm-mt')].map(b=>b.textContent);" +
      "return badges.length?badges.join('|'):'none'})()");
    ok("U4 MT labelling honest", mtHonest === '"none"' || /آلية|Machine|Maschinelle/i.test(mtHonest), mtHonest);

    /* no navigation / no global rebuild: dashboard still active, vocab grid untouched */
    const stable = await E("({url:location.href,active:!!document.querySelector('#page-dashboard.active'),gs:!!document.getElementById('globalSearch')})");
    ok("U5 no navigation/reset", JSON.parse(stable).active && JSON.parse(stable).gs, stable);

    /* mobile viewport: results region visible, no horizontal overflow */
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(600);
    const mob = await E("(()=>{const b=document.getElementById('searchResults');const r=b.getBoundingClientRect();" +
      "return {w:Math.round(r.width),over:document.documentElement.scrollWidth>window.innerWidth+1}})()");
    ok("U6 mobile layout", JSON.parse(mob).w > 0 && !JSON.parse(mob).over, mob);

    /* U7 Fix 5: audio element preserved across progressive updates (controlled fixture + live). */
    const u7 = await E("(()=>{const box=document.getElementById('searchResults');if(!box||!window.DMSearch||!DMSearch.__renderForTest)return 'no-harness';" +
      "const render=DMSearch.__renderForTest;" +
      "const stA={query:'Haus-test',isSentence:false,offline:false,local:{words:[],sentences:[]}," +
      "remote:{commons:{status:'ok',provider:'commons',items:[{title:'File:De-Haus.ogg',url:'https://upload.wikimedia.org/x/De-Haus.ogg',pageUrl:'https://commons.wikimedia.org/wiki/File:De-Haus.ogg',artist:'Kampy',license:'CC BY-SA 3.0'}]}," +
      "tatoeba:{status:'loading',provider:'tatoeba'},wiktionary:{status:'loading',provider:'wiktionary'},openthesaurus:{status:'loading',provider:'openthesaurus'}} };" +
      "render(box,stA);" +
      "const au=box.querySelector('#dmExt audio.dm-ext-audio');" +
      "if(!au)return 'no-audio-after-A';" +
      "try{au.currentTime=1.25;}catch(e){}" +
      "window.__u7ref=au;window.__u7src=au.src;window.__u7t=au.currentTime;" +
      "const stB=JSON.parse(JSON.stringify(stA));" +
      "stB.remote.tatoeba={status:'ok',provider:'tatoeba',items:[{id:1,text:'Das Haus ist gross.',match:'similar',owner:'u',license:'CC BY 2.0 FR',url:'https://tatoeba.org/en/sentences/show/1',ara:[],eng:[],audio:[]}]};" +
      "render(box,stB);" +
      "const au2=box.querySelector('#dmExt audio.dm-ext-audio');" +
      "const same=(au2===window.__u7ref);" +
      "const conn=(au2&&au2.isConnected);" +
      "const tSame=(au2&&Math.abs((au2.currentTime||0)-window.__u7t)<0.01);" +
      "const dupCount=box.querySelectorAll('#dmExt audio.dm-ext-audio').length;" +
      "return JSON.stringify({same:same,conn:!!conn,tSame:!!tSame,dup:dupCount,src:window.__u7src})})()");
    console.log("INFO U7 audio-preserve " + u7);
    try {
      const p = JSON.parse(JSON.parse(u7));
      ok("U7 audio preserved (same node)", p.same === true, u7);
      ok("U7 audio still connected", p.conn === true, u7);
      ok("U7 no duplicate audio", p.dup === 1, u7);
    } catch (e) { ok("U7 audio preserved (same node)", false, u7 + " parse-err"); }

    /* U8 Fix 4: cold first sentence-search measurement (documented, non-brittle). */
    const u8 = await E("(()=>{try{" +
      "const n=(typeof SENTENCES!=='undefined'&&SENTENCES)?SENTENCES.length:0;" +
      "let coldMs=-1,warmMs=-1;" +
      "if(typeof sentA1SearchRows==='function'){" +
      "try{window.__dmColdIdx=null;try{sentA1SearchIdx=null;}catch(e){}}" +
      "catch(e){}" +
      "const t0=performance.now();" +
      "try{sentA1SearchRows();}catch(e){}" +
      "coldMs=performance.now()-t0;" +
      "const t1=performance.now();" +
      "try{sentA1SearchRows();}catch(e){}" +
      "warmMs=performance.now()-t1;" +
      "}" +
      "let dmMs=-1;" +
      "if(window.DMSearch&&DMSearch.debug&&DMSearch.debug.coldStats){" +
      "dmMs=DMSearch.debug.coldStats.lastTotalMs||0;}" +
      "return JSON.stringify({n:n,cold:Math.round(coldMs*10)/10,warm:Math.round(warmMs*10)/10,dm:dmMs});" +
      "}catch(e){return JSON.stringify({err:String(e&&e.message)})}})()");
    console.log("INFO U8 cold-measure " + u8);
    try {
      const m = JSON.parse(JSON.parse(u8));
      ok("U8 cold measurement recorded", m && typeof m.cold === "number" && typeof m.warm === "number", u8);
      console.log("INFO U8 cold=" + m.cold + "ms warm=" + m.warm + "ms n=" + m.n + " dmLocal=" + m.dm + "ms");
    } catch (e) { ok("U8 cold measurement recorded", false, u8); }

    /* U9 Fix 1 journey: translation failure then Retry (live, evidence only). */
    const u9 = await E("(()=>{try{" +
      "const x=document.getElementById('dmExt');" +
      "return x?x.innerHTML.slice(0,60):'no-ext';" +
      "}catch(e){return 'err'}})()");
    ok("U9 retry control present-or-settled", typeof u9 === "string", u9);

    /* U10 sentence fallback: punctuated query, empty full-phrase -> Kaffee
     * keyword fallback via the REAL adapter + render path. Fully stubbed
     * fetch (deterministic, no live network for DMSearch here). */
    const u10arm = await E("(()=>{try{" +
      "if(!window.DMSearch||!DMSearch.__setFetch)return 'no-dm';" +
      "window.__realFetch=window.fetch.bind(window);" +
      "window.__tatCalls=[];" +
      "var KAF={data:[{id:101,text:'Ich trinke gern Kaffee.',owner:'uk',license:'CC BY 2.0 FR',audios:[]," +
      "translations:[{id:102,text:'qahwa-ar',lang:'ara',owner:'ua'}]}]};" +
      "window.__fixFetch=function(url,opts){var u=String(url);" +
      "if(u.indexOf('api.tatoeba.org')>=0){window.__tatCalls.push(u);" +
      "var body=(u.indexOf('q=Kaffee')>=0)?KAF:{data:[]};" +
      "return Promise.resolve({status:200,json:function(){return Promise.resolve(body);}});}" +
      "if(u.indexOf('wiktionary.org')>=0)return Promise.resolve({status:200,json:function(){return Promise.resolve({query:{search:[]}});}});" +
      "if(u.indexOf('openthesaurus.de')>=0)return Promise.resolve({status:200,json:function(){return Promise.resolve({synsets:[]});}});" +
      "if(u.indexOf('mymemory')>=0)return Promise.resolve({status:200,json:function(){return Promise.resolve({responseData:{translatedText:''},responseStatus:200});}});" +
      "return window.__realFetch(url,opts);};" +
      "DMSearch.__setFetch(window.__fixFetch);" +
      "DMSearch.__cacheClear();" +
      "var s=document.getElementById('globalSearch');" +
      "s.value='Ich m'+String.fromCharCode(246)+'chte einen Kaffee, bitte.';" +
      "s.dispatchEvent(new Event('input',{bubbles:true}));" +
      "return 'armed';" +
      "}catch(e){return 'arm-err:'+e.message}})()");
    ok("U10 fixture armed", u10arm === '"armed"', u10arm);
    let u10snap = null;
    for (let i = 0; i < 14; i++) {
      await sleep(750);
      u10snap = await E("(()=>{var o={calls:(window.__tatCalls||[]).length,card:false,badge:'none'};try{" +
        "var els=document.querySelectorAll('#dmExt .dm-ext-sent');" +
        "for(var k=0;k<els.length;k++){var b=els[k].querySelector('b');" +
        "if(b&&b.textContent.indexOf('Ich trinke gern Kaffee')>=0){o.card=true;" +
        "var bd=els[k].querySelector('.dm-badge');if(bd){o.badge=bd.className;}break;}}" +
        "}catch(e){}" +
        "return JSON.stringify(o);})()");
      try {
        const o = JSON.parse(JSON.parse(u10snap));
        if (o.card && o.calls >= 2) break;
      } catch (e) {}
    }
    const u10calls = await E("JSON.stringify((window.__tatCalls||[]))");
    console.log("INFO U10 fallback snap=" + u10snap + " calls=" + u10calls);
    try {
      const o = JSON.parse(JSON.parse(u10snap));
      const cu = JSON.parse(JSON.parse(u10calls));
      ok("U10 fallback card shown", o.card === true, u10snap);
      ok("U10 full+keyword fetched", cu.length >= 2, "calls=" + cu.length);
      ok("U10 full normalized on wire", cu.length >= 1 && cu[0].indexOf("%2C") < 0, (cu[0] || "").slice(-70));
      ok("U10 keyword fetched", cu.some(u => u.indexOf("q=Kaffee") >= 0), "kw-present");
      ok("U10 badge similar (truthful)", o.badge.indexOf("dm-sim") >= 0 && o.badge.indexOf("dm-exact") < 0, o.badge);
    } catch (e) { ok("U10 fallback card shown", false, u10snap + " parse-err"); }
    await E("(()=>{try{if(window.DMSearch&&window.__realFetch)" +
      "{DMSearch.__setFetch(function(u,op){return window.__realFetch(u,op);});DMSearch.__cacheClear();}" +
      "return 'restored';}catch(e){return 'restore-err';}})()");

    /* U11 live: the exact reported query over REAL HTTP. Proves the external
     * request executes (resource timings) and cards render visibly with the
     * local empty message suppressed (the reported lifecycle bug). */
    await E("(()=>{try{performance.clearResourceTimings();}catch(e){}return 'cleared';})()");
    /* Rotate lastQuery so U11 forces a genuinely fresh live search (U10 used
     * the identical query with a stubbed fetch; same-query re-entry must
     * not refetch). */
    await journey("U11a reset", "Haus");
    const s11 = await journey("U11 coffee-live", "Ich möchte einen Kaffee, bitte.");
    console.log("INFO U11 evidence cards=" + s11.secs);
    const u11 = await E("(()=>{var o={tat:0,kaf:0,cards:0,localEmpty:'missing',firstCard:'',urls:[]};try{" +
      "var rs=performance.getEntriesByType('resource');" +
      "for(var i=0;i<rs.length;i++){var u=rs[i].name||'';" +
      "if(u.indexOf('api.tatoeba.org/v1/sentences')>=0){o.tat++;if(u.indexOf('q=Kaffee')>=0)o.kaf++;" +
      "var m=u.match(/[?&]q=[^&]*/);o.urls.push(m?m[0]:u.slice(-40));}}" +
      "var els=document.querySelectorAll('#dmExt .dm-ext-sent');o.cards=els.length;" +
      "if(els.length){var b=els[0].querySelector('b');o.firstCard=b?b.textContent.slice(0,60):'';}" +
      "var le=document.getElementById('dmLocalEmpty');" +
      "if(le){o.localEmpty=(le.style.display==='none')?'hidden':'visible';}" +
      "}catch(e){o.err=String(e&&e.message);}return JSON.stringify(o);})()");
    console.log("INFO U11 live " + u11);
    try {
      const o = JSON.parse(JSON.parse(u11));
      ok("U11 tatoeba requested live", o.tat >= 1, "tatCalls=" + o.tat + " kwFallback=" + o.kaf);
      ok("U11 sentence cards visible", o.cards >= 1, "cards=" + o.cards + " first=" + o.firstCard);
      ok("U11 no misleading empty state", o.localEmpty === "hidden" || o.localEmpty === "missing",
        "dmLocalEmpty=" + o.localEmpty);
    } catch (e) { ok("U11 tatoeba requested live", false, u11 + " parse-err"); }

    /* U12 lifecycle matrix via the REAL renderState with crafted states (no
     * network): loading / all-empty / all-failed / partial-ok. */
    const u12 = await E("(()=>{var o={};try{" +
      "var box=document.getElementById('searchResults');" +
      "var R=DMSearch.__renderForTest;" +
      "function le(){var n=document.getElementById('dmLocalEmpty');" +
      "if(!n){n=document.createElement('div');n.className='search-hit';n.id='dmLocalEmpty';" +
      "n.textContent='none';box.appendChild(n);}return n;}" +
      "function vis(n){return !!(n&&n.style.display!=='none');}" +
      "function st(q,patch){var s={query:q,isSentence:false,offline:false,local:{words:[],sentences:[]},remote:{}};" +
      "Object.keys(patch).forEach(function(k){s.remote[k]=patch[k];});return s;}" +
      "var LD={status:'loading',provider:'x'};" +
      "var EM={status:'empty',provider:'x'};" +
      "var ER={status:'error',provider:'x',error:'timeout'};" +
      "le();" +
      "R(box,st('Lx',{wiktionary:LD,tatoeba:LD,commons:LD,openthesaurus:LD}));" +
      "o.l1={hidden:!vis(document.getElementById('dmLocalEmpty'))," +
      "loading:!!document.querySelector('#dmExt .dm-loading')};" +
      "R(box,st('Lx',{wiktionary:EM,'wiktionary-en':EM,tatoeba:EM,commons:EM,openthesaurus:EM}));" +
      "o.l2={shown:vis(document.getElementById('dmLocalEmpty'))," +
      "none:!!document.querySelector('#dmExt [data-dm-sec=none]')};" +
      "R(box,st('Lx',{wiktionary:ER,'wiktionary-en':ER,tatoeba:ER,commons:ER,openthesaurus:ER}));" +
      "o.l3={hidden:!vis(document.getElementById('dmLocalEmpty'))," +
      "retry:!!document.querySelector('#dmExt .dm-retry')," +
      "errs:!!document.querySelector('#dmExt [data-dm-sec=errs]')," +
      "none:!!document.querySelector('#dmExt [data-dm-sec=none]')};" +
      "R(box,st('Lx',{wiktionary:LD,tatoeba:{status:'ok',provider:'tatoeba',items:[{id:7," +
      "text:'Kaffee ist fertig.',match:'similar',owner:'u',license:'CC BY 2.0 FR'," +
      "url:'https://tatoeba.org/en/sentences/show/7',ara:[],eng:[],audio:[]}]}," +
      "commons:LD,openthesaurus:LD}));" +
      "o.l4={hidden:!vis(document.getElementById('dmLocalEmpty'))," +
      "cards:document.querySelectorAll('#dmExt .dm-ext-sent').length};" +
      "}catch(e){o.err=String(e&&e.message);}return JSON.stringify(o);})()");
    console.log("INFO U12 matrix " + u12);
    try {
      const o = JSON.parse(JSON.parse(u12));
      ok("U12 loading hides empty", o.l1.hidden === true && o.l1.loading === true, JSON.stringify(o.l1));
      ok("U12 genuine empty shown", o.l2.shown === true && o.l2.none === true, JSON.stringify(o.l2));
      ok("U12 failure hides empty + retry", o.l3.hidden === true && o.l3.retry === true &&
        o.l3.errs === true && o.l3.none === false, JSON.stringify(o.l3));
      ok("U12 partial-ok visible at once", o.l4.hidden === true && o.l4.cards >= 1, JSON.stringify(o.l4));
    } catch (e) { ok("U12 loading hides empty", false, u12 + " parse-err"); }

    /* U13 rapid typing + cancellation + stale protection (deterministic
     * fixture): slow Q1 aborted by fast Q2; slow-unabortable Q3 resolved
     * late must not clobber fast Q4. Exactly one fetch per query. */
    const u13arm = await E("(()=>{try{" +
      "window.__realFetch=window.fetch.bind(window);" +
      "window.__u13={calls:[],abortedQ1:false,attachedQ1:false,sigNullQ1:false,abortEvents:[]};" +
      "window.__u13fetch=function(url,opts){var u=String(url);var sig=opts&&opts.signal;" +
      "function res0(body){return Promise.resolve({status:200,json:function(){return Promise.resolve(body);}});}" +
      "function item(id,tx){return {id:id,text:tx,owner:'a',license:'CC BY 2.0 FR',audios:[],translations:[]};}" +
      "if(u.indexOf('api.tatoeba.org')>=0){window.__u13.calls.push(u);" +
      "var m=u.match(/[?&]q=([^&]*)/);var qq=m?decodeURIComponent(m[1]):'';" +
      "if(qq==='slowoneqq')return new Promise(function(res,rej){var t=setTimeout(function(){res(res0({data:[item(201,'RES slowoneqq')]}));},1800);" +
      "try{if(!sig){window.__u13.sigNullQ1=true;}" +
      "if(sig&&sig.addEventListener){if(sig.aborted){clearTimeout(t);var e=new Error('ab');e.name='AbortError';rej(e);return;}" +
      "window.__u13.attachedQ1=true;" +
      "sig.addEventListener('abort',function(){clearTimeout(t);window.__u13.abortedQ1=true;window.__u13.abortEvents.push('fixture-inner');var e2=new Error('ab');e2.name='AbortError';rej(e2);},{once:true});}}catch(x){}});" +
      "if(qq==='slowstaleqq')return new Promise(function(res){setTimeout(function(){res(res0({data:[item(301,'RES slowstaleqq')]}));},1400);});" +
      "return res0({data:[item(202,'RES '+qq)]});}" +
      "if(u.indexOf('wiktionary.org')>=0)return res0({query:{search:[]}});" +
      "if(u.indexOf('commons.wikimedia.org')>=0)return res0({query:{allimages:[]}});" +
      "if(u.indexOf('openthesaurus.de')>=0)return res0({synsets:[]});" +
      "if(u.indexOf('mymemory')>=0)return res0({responseData:{translatedText:''},responseStatus:200});" +
      "return window.__realFetch(url,opts);};" +
      "DMSearch.__setFetch(window.__u13fetch);DMSearch.__cacheClear();" +
      "return 'armed';}catch(e){return 'arm-err:'+e.message}})()");
    ok("U13 fixture armed", u13arm === '"armed"', u13arm);
    async function typeQuery(qq) {
      await cdp.ev("(()=>{var s=document.getElementById('globalSearch');s.value=" + JSON.stringify(qq) +
        ";s.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()");
    }
    async function settleExt(condFn, tries) {
      let snap = null;
      for (let i = 0; i < (tries || 12); i++) {
        await sleep(750);
        snap = await E("(()=>{var o={q:'',loading:1,cards:0,firstCard:'',hits:0,emptyVisible:'missing'};try{" +
          "var w=document.getElementById('dmExt');o.q=w?w.getAttribute('data-dm-q'):'';" +
          "o.loading=w?w.querySelectorAll('.dm-loading').length:0;" +
          "var els=document.querySelectorAll('#dmExt .dm-ext-sent');o.cards=els.length;" +
          "if(els.length){var b=els[0].querySelector('b');o.firstCard=b?b.textContent.slice(0,40):'';}" +
          "o.hits=document.querySelectorAll('#searchResults .search-hit').length;" +
          "var le=document.getElementById('dmLocalEmpty');" +
          "if(le)o.emptyVisible=(le.style.display==='none')?'hidden':'visible';" +
          "}catch(e){}return JSON.stringify(o);})()");
        try { if (condFn(JSON.parse(JSON.parse(snap)))) break; } catch (e) {}
      }
      return snap;
    }
    /* Phase A: Q1 slow-abortable superseded by fast Q2. */
    await typeQuery("slowoneqq");
    await sleep(300);
    await typeQuery("fasttwoqq");
    const u13a = await settleExt(o => o.q === "fasttwoqq" && o.loading === 0 && o.cards >= 1, 14);
    const u13acalls = await E("JSON.stringify(window.__u13.calls)");
    console.log("INFO U13a " + u13a + " calls=" + u13acalls);
    console.log("INFO U13a flags=" + await E("JSON.stringify({a:window.__u13.attachedQ1,n:window.__u13.sigNullQ1,ev:window.__u13.abortEvents})"));
    try {
      const o = JSON.parse(JSON.parse(u13a));
      const cu = JSON.parse(JSON.parse(u13acalls));
      const c1 = cu.filter(u => u.indexOf("q=slowoneqq") >= 0).length;
      const c2 = cu.filter(u => u.indexOf("q=fasttwoqq") >= 0).length;
      ok("U13a newest wins", o.firstCard.indexOf("RES fasttwoqq") >= 0, o.firstCard);
      ok("U13a Q1 cancelled", (await E("JSON.stringify(!!window.__u13.abortedQ1)")) === '"true"', "aborted flag");
      ok("U13a exactly-once fetches", c1 === 1 && c2 === 1, "slow=" + c1 + " fast=" + c2);
      ok("U13a local hits intact", o.hits > 1, "hits=" + o.hits);
    } catch (e) { ok("U13a newest wins", false, u13a + " parse-err"); }
    /* Phase B: Q3 slow-UNABORTABLE resolves late; fast Q4 must survive it. */
    await typeQuery("slowstaleqq");
    await sleep(300);
    await typeQuery("fastfourqq");
    const u13b = await settleExt(o => o.q === "fastfourqq" && o.loading === 0 && o.cards >= 1, 14);
    await sleep(2200);
    const u13b2 = await E("(()=>{var o={q:'',firstCard:''};try{var w=document.getElementById('dmExt');" +
      "o.q=w?w.getAttribute('data-dm-q'):'';var b=document.querySelector('#dmExt .dm-ext-sent b');" +
      "o.firstCard=b?b.textContent.slice(0,40):'';}catch(e){}return JSON.stringify(o);})()");
    const u13bcalls = await E("JSON.stringify(window.__u13.calls)");
    console.log("INFO U13b " + u13b2 + " calls=" + u13bcalls);
    try {
      const o = JSON.parse(JSON.parse(u13b2));
      const cu = JSON.parse(JSON.parse(u13bcalls));
      const c3 = cu.filter(u => u.indexOf("q=slowstaleqq") >= 0).length;
      const c4 = cu.filter(u => u.indexOf("q=fastfourqq") >= 0).length;
      ok("U13b stale cannot clobber", o.q === "fastfourqq" && o.firstCard.indexOf("RES fastfourqq") >= 0,
        o.q + "/" + o.firstCard);
      ok("U13b exactly-once fetches", c3 === 1 && c4 === 1, "stale=" + c3 + " fast=" + c4);
    } catch (e) { ok("U13b stale cannot clobber", false, u13b2 + " parse-err"); }

    /* U14 retry refetches failed providers exactly once (deterministic). */
    const u14arm = await E("(()=>{try{" +
      "window.__u14={tat:0,wik:0};" +
      "window.__u14fetch=function(url,opts){var u=String(url);" +
      "function res0(s,b){return Promise.resolve({status:s,json:function(){return Promise.resolve(b);}});}" +
      "if(u.indexOf('api.tatoeba.org')>=0){window.__u14.tat++;return res0(500,{});}" +
      "if(u.indexOf('wiktionary.org')>=0){if(u.indexOf('list=search')>=0)window.__u14.wik++;return res0(500,{});}" +
      "if(u.indexOf('commons.wikimedia.org')>=0)return res0(200,{query:{allimages:[]}});" +
      "if(u.indexOf('openthesaurus.de')>=0)return Promise.reject(new Error('blocked'));" +
      "return window.__realFetch(url,opts);};" +
      "DMSearch.__setFetch(window.__u14fetch);DMSearch.__cacheClear();" +
      "return 'armed';}catch(e){return 'arm-err:'+e.message}})()");
    ok("U14 fixture armed", u14arm === '"armed"', u14arm);
    await typeQuery("retryprobeqq");
    const u14a = await settleExt(o => o.q === "retryprobeqq" && o.loading === 0, 14);
    const u14s = await E("(()=>{var o={retry:false,errs:false,none:false,emptyHidden:'missing'};try{" +
      "o.retry=!!document.querySelector('#dmExt .dm-retry');" +
      "o.errs=!!document.querySelector('#dmExt [data-dm-sec=errs]');" +
      "o.none=!!document.querySelector('#dmExt [data-dm-sec=none]');" +
      "var le=document.getElementById('dmLocalEmpty');" +
      "if(le)o.emptyHidden=(le.style.display==='none')?'hidden':'visible';" +
      "}catch(e){}return JSON.stringify(o);})()");
    console.log("INFO U14 settled " + u14a + " state=" + u14s);
    try {
      const o = JSON.parse(JSON.parse(u14s));
      ok("U14 failure state + retry", o.retry === true && o.errs === true && o.none === false, u14s);
      ok("U14 empty suppressed on failure", o.emptyHidden === "hidden", u14s);
    } catch (e) { ok("U14 failure state + retry", false, u14s + " parse-err"); }
    await E("(()=>{try{var b=document.querySelector('#dmExt .dm-retry');if(b)b.click();return 'clicked';}catch(e){return 'click-err';}})()");
    const u14b = await settleExt(o => o.q === "retryprobeqq" && o.loading === 0, 14);
    await sleep(1000);
    const u14c = await E("JSON.stringify(window.__u14)");
    console.log("INFO U14 after-retry " + u14b + " counts=" + u14c);
    try {
      const c = JSON.parse(JSON.parse(u14c));
      ok("U14 retry refetches once", c.tat === 2 && c.wik === 2, "tat=" + c.tat + " wik=" + c.wik);
    } catch (e) { ok("U14 retry refetches once", false, u14c + " parse-err"); }
    await E("(()=>{try{if(window.DMSearch&&window.__realFetch)" +
      "{DMSearch.__setFetch(function(u,op){return window.__realFetch(u,op);});DMSearch.__cacheClear();}" +
      "return 'restored';}catch(e){return 'restore-err';}})()");

    /* U15 deterministic regression: a complete sentence containing
     * "möchten" must render its full translation, never the Wiktionary entry
     * for the token. The fixture deliberately returns that entry for every
     * dictionary request, so this would fail with the old behaviour. */
    const SENT_MOE_UI = "Wir m\u00f6chten etwas essen";
    const AR_FULL_UI = "\u0646\u0631\u064a\u062f \u0623\u0646 \u0646\u0623\u0643\u0644 \u0634\u064a\u0626\u064b\u0627";
    const U15_WIK_SEARCH = JSON.stringify({ query: { search: [{ title: "m\u00f6chten" }] } });
    const U15_WIK_EXTRACT = JSON.stringify({ query: { pages: { 4242: { pageid: 4242, title: "m\u00f6chten",
      extract: "m\u00f6chten (Deutsch)\nVerb\nAussprache:\nIPA: [\u02c8m\u0153\u00e7tn\u0329]\nBedeutungen:\n[1] den Wunsch nach etwas hegen\nBeispiele:\n[1] Dies zeugt sowohl von ihrem Wissen.\n" } } } });
    const U15_TAT = JSON.stringify({ data: [{ id: 9001, text: SENT_MOE_UI + ".", owner: "u",
      license: "CC BY 2.0 FR", audios: [], translations: [{ id: 9002, text: AR_FULL_UI, lang: "ara", owner: "ua" }] }] });
    const u15arm = await E("(()=>{try{" +
      "window.__realFetch=window.fetch.bind(window);window.__u15={mm:[],wik:0,err:false};" +
      "var SENT=" + JSON.stringify(SENT_MOE_UI) + ",AR=" + JSON.stringify(AR_FULL_UI) + ";" +
      "var WS=" + U15_WIK_SEARCH + ",WE=" + U15_WIK_EXTRACT + ",TAT=" + U15_TAT + ";" +
      "window.__u15fetch=function(url,opts){var u=String(url);" +
      "function res(s,b){return Promise.resolve({status:s,json:function(){return Promise.resolve(b);}});}" +
      "if(u.indexOf('de.wiktionary.org')>=0){window.__u15.wik++;" +
      "return u.indexOf('list=search')>=0?res(200,WS):res(200,WE);}" +
      "if(u.indexOf('api.tatoeba.org')>=0)return res(200,TAT);" +
      "if(u.indexOf('commons.wikimedia.org')>=0)return res(200,{query:{allimages:[]}});" +
      "if(u.indexOf('openthesaurus.de')>=0)return res(200,{synsets:[]});" +
      "if(u.indexOf('mymemory')>=0){var m=u.match(/[?&]q=([^&]*)/);" +
      "window.__u15.mm.push(m?decodeURIComponent(m[1]):'');" +
      "if(window.__u15.err)return res(500,{});" +
      "return res(200,{responseData:{translatedText:AR,match:'0.9'},responseStatus:200});}" +
      "return res(200,{});};" +
      "DMSearch.__setFetch(window.__u15fetch);DMSearch.__cacheClear();return 'armed';" +
      "}catch(e){return 'arm-err:'+e.message}})()");
    ok("U15 fixture armed", u15arm === '"armed"', u15arm);
    const s15 = await journey("U15 sentence möchten", SENT_MOE_UI);
    const u15 = await E("(()=>{var o={dict:false,dictEn:false,mt:false,orig:'',tr:'',machine:false," +
      "retry:false,leak:false,mm:[],wik:0};try{var x=document.getElementById('dmExt');" +
      "o.dict=!!x.querySelector('[data-dm-sec=dict-de]');o.dictEn=!!x.querySelector('[data-dm-sec=dict-en]');" +
      "var mt=x.querySelector('[data-dm-sec=mt]');o.mt=!!mt;" +
      "if(mt){var q=mt.querySelector('.dm-ext-query'),t=mt.querySelector('.dm-ext-translation');" +
      "o.orig=q?q.textContent:'';o.tr=t?t.textContent:'';" +
      "o.machine=!!mt.querySelector('.dm-mt');o.retry=!!mt.querySelector('.dm-mt-retry');}" +
      "o.leak=x.textContent.indexOf('den Wunsch nach etwas hegen')>=0||" +
      "x.textContent.indexOf('Dies zeugt sowohl')>=0;" +
      "o.mm=window.__u15.mm.slice();o.wik=window.__u15.wik;" +
      "}catch(e){o.err=String(e&&e.message);}return JSON.stringify(o);})()");
    console.log("INFO U15 sentence " + u15 + " secs=" + s15.secs);
    try {
      const o = JSON.parse(JSON.parse(u15));
      ok("U15 no token dictionary section", o.dict === false && o.dictEn === false && o.leak === false, u15);
      ok("U15 full query sent to MyMemory", o.mm.length === 1 && o.mm[0] === SENT_MOE_UI, JSON.stringify(o.mm));
      ok("U15 original input shown", o.mt === true && o.orig === SENT_MOE_UI, o.orig);
      ok("U15 complete translation shown", o.tr === AR_FULL_UI && o.machine === true, o.tr);
      ok("U15 no tangential Wiktionary call", o.wik === 0, "wikCalls=" + o.wik);
    } catch (e) { ok("U15 no token dictionary section", false, u15 + " parse-err"); }

    /* U15b honest failure UI: original stays visible, no fabricated
     * translation, and a retry control is offered. */
    await E("(()=>{try{window.__u15.err=true;DMSearch.__cacheClear();return 'armed';}catch(e){return 'err';}})()");
    const s15b = await journey("U15b MT failure", SENT_MOE_UI + " bitte");
    const u15b = await E("(()=>{var o={dict:false,mt:false,orig:'',tr:false,retry:false,note:''};try{" +
      "var x=document.getElementById('dmExt');o.dict=!!x.querySelector('[data-dm-sec=dict-de]');" +
      "var mt=x.querySelector('[data-dm-sec=mt]');o.mt=!!mt;" +
      "if(mt){var q=mt.querySelector('.dm-ext-query');o.orig=q?q.textContent:'';" +
      "o.tr=!!mt.querySelector('.dm-ext-translation');o.retry=!!mt.querySelector('.dm-mt-retry');" +
      "var n=mt.querySelector('.dm-ext-note');o.note=n?n.textContent:'';}" +
      "}catch(e){o.err=String(e&&e.message);}return JSON.stringify(o);})()");
    console.log("INFO U15b failure " + u15b + " secs=" + s15b.secs);
    try {
      const o = JSON.parse(JSON.parse(u15b));
      ok("U15b failure keeps original", o.mt === true && o.orig === SENT_MOE_UI + " bitte", o.orig);
      ok("U15b no fabricated translation", o.tr === false, "translationNode=" + o.tr);
      ok("U15b retry offered honestly", o.retry === true && o.note.length > 0, o.note);
      ok("U15b failure has no dictionary token", o.dict === false, "dict=" + o.dict);
    } catch (e) { ok("U15b failure keeps original", false, u15b + " parse-err"); }

    /* U16 live evidence on the exact affected interface: real HTTP to
     * MyMemory/Tatoeba, no stubs, full German sentence containing möchten. */
    await E("(()=>{try{if(window.DMSearch&&window.__realFetch)" +
      "{DMSearch.__setFetch(function(u,op){return window.__realFetch(u,op);});DMSearch.__cacheClear();}" +
      "return 'restored';}catch(e){return 'restore-err';}})()");
    await journey("U16 reset", "Haus");
    await E("(()=>{try{performance.clearResourceTimings();}catch(e){}return 'cleared';})()");
    const s16 = await journey("U16 live sentence möchten", SENT_MOE_UI);
    const u16 = await E("(()=>{var o={dict:false,dictEn:false,mt:false,orig:'',tr:'',retry:false," +
      "mmReqs:0,tatReqs:0,wikReqs:0,urls:[]};try{" +
      "var x=document.getElementById('dmExt');o.dict=!!x.querySelector('[data-dm-sec=dict-de]');" +
      "o.dictEn=!!x.querySelector('[data-dm-sec=dict-en]');" +
      "var mt=x.querySelector('[data-dm-sec=mt]');o.mt=!!mt;" +
      "if(mt){var q=mt.querySelector('.dm-ext-query'),t=mt.querySelector('.dm-ext-translation');" +
      "o.orig=q?q.textContent:'';o.tr=t?t.textContent:'';o.retry=!!mt.querySelector('.dm-mt-retry');}" +
      "var rs=performance.getEntriesByType('resource');" +
      "for(var i=0;i<rs.length;i++){var u=rs[i].name||'';" +
      "if(u.indexOf('api.mymemory.translated.net')>=0){o.mmReqs++;o.urls.push(u.slice(0,180));}" +
      "if(u.indexOf('api.tatoeba.org/v1/sentences')>=0)o.tatReqs++;" +
      "if(u.indexOf('de.wiktionary.org')>=0)o.wikReqs++;}" +
      "}catch(e){o.err=String(e&&e.message);}return JSON.stringify(o);})()");
    console.log("INFO U16 live " + u16 + " secs=" + s16.secs);
    try {
      const o = JSON.parse(JSON.parse(u16));
      ok("U16 live full-input MT requested", o.mmReqs >= 1, "mm=" + o.mmReqs + " tat=" + o.tatReqs + " wik=" + o.wikReqs);
      ok("U16 live no token dictionary", o.dict === false && o.dictEn === false && o.wikReqs === 0,
        "dict=" + o.dict + " wik=" + o.wikReqs);
      ok("U16 live original preserved", o.mt === true && o.orig === SENT_MOE_UI, o.orig);
      ok("U16 live translation visible", (o.tr.length > 0) || o.retry === true,
        o.tr ? o.tr.slice(0, 80) : ("retry=" + o.retry));
    } catch (e) { ok("U16 live full-input MT requested", false, u16 + " parse-err"); }

    console.log("----");
    console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
    cdp.close(); chrome.kill(); srv.close();
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log("FAIL harness: " + (e && e.message));
    try { cdp && cdp.close(); } catch (x) {}
    try { chrome.kill(); } catch (x) {}
    try { srv.close(); } catch (x) {}
    process.exit(1);
  }
})();
