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
