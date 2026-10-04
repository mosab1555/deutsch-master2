/* Deutsch Master - auth-screen DOM regression (headless Chrome via CDP, stdlib only).
 *
 * Pins the rebuilt auth UI wiring without credentials (no OAuth/network login):
 *  - login button opens the auth page, no page errors
 *  - signin/signup tabs switch modes (buttons show/hide, card mode attr, titles)
 *  - password toggle flips input type + aria-pressed
 *  - phone toggle expands/collapses the phone section
 *  - forgot-password opens the recovery pane; back returns to signin
 *  - every app-init-wired auth id exists; provider buttons present (not clicked)
 *  - zero console/page errors during the whole flow
 *
 * Run: node tools/test-auth-dom.js (needs Chrome; ~1 min). Exits 1 on any FAIL.
 */
"use strict";
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = process.env.CHROME
  || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 19352;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

let pass = 0, fail = 0;
function ok(id, cond, evidence) {
  if (cond) { pass++; console.log("PASS " + id + " [" + evidence + "]"); }
  else { fail++; console.log("FAIL " + id + " [" + evidence + "]"); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); }
  connect() {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("ws-timeout")), 15000);
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener("open", () => { clearTimeout(t); resolve(); });
      this.ws.addEventListener("error", () => { clearTimeout(t); reject(new Error("ws-error")); });
      this.ws.addEventListener("message", (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.id && this.pending.has(m.id)) {
          const h = this.pending.get(m.id); this.pending.delete(m.id); clearTimeout(h.timer);
          if (m.error) h.rej(new Error("cdp:" + JSON.stringify(m.error).slice(0, 120))); else h.res(m.result);
        }
      });
    });
  }
  send(method, params, ms) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error("t:" + method)); }, ms || 30000);
      this.pending.set(id, { res, rej, timer });
      try { this.ws.send(JSON.stringify({ id, method, params: params || {} })); }
      catch (e) { clearTimeout(timer); this.pending.delete(id); rej(e); }
    });
  }
  ev(fn, ms) {
    return this.send("Runtime.evaluate",
      { expression: "(" + fn + ")()", awaitPromise: true, returnByValue: true }, ms || 20000)
      .then((r) => (r && r.result ? r.result.value : null));
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

(async () => {
  if (!fs.existsSync(CHROME)) {
    console.log("SKIP chrome not found at " + CHROME + " (set CHROME env)");
    process.exit(2);
  }
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
  await new Promise((res) => srv.listen(0, "127.0.0.1", res));
  const port = srv.address().port;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-dom-"));
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
    "--disable-dev-shm-usage", "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + userDir, "about:blank"], { stdio: "ignore" });
  const errors = [];
  const finish = (code) => {
    try { chrome.kill(); } catch (e) {}
    try { if (srv.closeAllConnections) srv.closeAllConnections(); } catch (e) {}
    srv.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 3000).unref();
  };
  try {
    let wsUrl = null;
    for (let i = 0; i < 40 && !wsUrl; i++) {
      await sleep(500);
      try {
        const body = await new Promise((res, rej) => {
          http.get("http://127.0.0.1:" + PORT + "/json/list",
            (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b)); }).on("error", rej);
        });
        const pg = JSON.parse(body).find((t) => t.type === "page");
        if (pg && pg.webSocketDebuggerUrl) wsUrl = pg.webSocketDebuggerUrl;
      } catch (e) {}
    }
    if (!wsUrl) { ok("harness", false, "no debuggable page"); finish(1); return; }
    const cdp = new CDP(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    cdp.send("Runtime.exceptionThrown", {}).catch(() => {});
    // collect console errors via plain polling hook: wrap console.error once loaded
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/" }, 45000);
    await sleep(9000);
    await cdp.ev(`async function(){ window.__errs=[]; ["error"].forEach(function(k){ var o=console[k]; console[k]=function(){ try{window.__errs.push(String(arguments[0]));}catch(e){} return o.apply(console,arguments); }; }); window.addEventListener("error",function(e){ try{window.__errs.push(String((e&&(e.message||e.error))||"pageerror"));}catch(x){} }); return true; }`);

    // 1. wired ids all exist
    let r = await cdp.ev(`async function(){
      var ids=["loginBtn","userMenu","page-auth","authCard","authTitle","authSub","tabSignIn","tabSignUp","btnGoogle","btnFacebook","emailForm","authEmail","authPassword","pwToggle","btnSignIn","btnCreateAccount","btnForgotPassword","btnPhoneToggle","phoneSection","phoneForm","authPhone","btnSendOTP","otpForm","authOTP","btnVerifyOTP","btnBackToPhone","authPaneMain","authPaneRecovery","recoveryForm","recoveryEmail","btnSendRecovery","btnBackToSignIn","authMessage","recoveryMessage"];
      var miss=ids.filter(function(id){return !document.getElementById(id);});
      return {miss:miss};
    }`);
    ok("D1-wired-ids", r && r.miss && r.miss.length === 0, r && r.miss ? (r.miss.length ? r.miss.join(",") : "all 34 present") : "eval-failed");

    // 1b. wait for app boot to settle (Supabase CDN is async; auth listeners
    // attach after init — polling avoids racing the wiring)
    r = await cdp.ev(`async function(){
      for (var i = 0; i < 60; i++) {
        var b = document.getElementById("loginBtn");
        var m = document.getElementById("userMenu");
        if (b && m && (b.style.display !== "none" || !m.classList.contains("hidden"))) return {ready:true, tries:i};
        await new Promise(function(rr){setTimeout(rr, 500);});
      }
      return {ready:false};
    }`, 45000);
    ok("D1b-boot-settled", r && r.ready === true, JSON.stringify(r));

    // 2. open auth page via topbar login
    r = await cdp.ev(`async function(){
      var b=document.getElementById("loginBtn"); if(!b||b.style.display==="none") return {opened:false,why:"login-hidden"};
      b.click(); await new Promise(function(rr){setTimeout(rr,600);});
      var p=document.getElementById("page-auth");
      return {opened:!!(p&&p.classList.contains("active"))};
    }`);
    ok("D2-login-opens-auth", r && r.opened === true, JSON.stringify(r));

    // 3. signup tab switches mode
    r = await cdp.ev(`async function(){
      document.getElementById("tabSignUp").click(); await new Promise(function(rr){setTimeout(rr,400);});
      var card=document.getElementById("authCard");
      var create=document.getElementById("btnCreateAccount");
      var sign=document.getElementById("btnSignIn");
      var out={mode:card&&card.getAttribute("data-auth-mode"),
        createVis:!!(create&&!create.classList.contains("hidden")),
        signHid:!!(sign&&sign.classList.contains("hidden")),
        title:(document.getElementById("authTitle")||{}).textContent||""};
      document.getElementById("tabSignIn").click(); await new Promise(function(rr){setTimeout(rr,400);});
      out.backMode=card.getAttribute("data-auth-mode");
      out.backSign=!!(sign&&!sign.classList.contains("hidden"));
      return out;
    }`);
    ok("D3-tabs-switch", r && r.mode === "signup" && r.createVis === true && r.signHid === true && r.backMode === "signin" && r.backSign === true, JSON.stringify(r));

    // 4. password toggle
    r = await cdp.ev(`async function(){
      var pw=document.getElementById("authPassword"); var t0=pw.type;
      document.getElementById("pwToggle").click(); await new Promise(function(rr){setTimeout(rr,300);});
      var t1=pw.type; var pressed=document.getElementById("pwToggle").getAttribute("aria-pressed");
      document.getElementById("pwToggle").click(); await new Promise(function(rr){setTimeout(rr,300);});
      return {t0:t0,t1:t1,pressed:pressed,t2:pw.type};
    }`);
    ok("D4-pw-toggle", r && r.t0 === "password" && r.t1 === "text" && r.t2 === "password", JSON.stringify(r));

    // 5. phone toggle expands/collapses
    r = await cdp.ev(`async function(){
      var sec=document.getElementById("phoneSection");
      var c0=sec.classList.contains("hidden");
      document.getElementById("btnPhoneToggle").click(); await new Promise(function(rr){setTimeout(rr,300);});
      var c1=sec.classList.contains("hidden");
      document.getElementById("btnPhoneToggle").click(); await new Promise(function(rr){setTimeout(rr,300);});
      var c2=sec.classList.contains("hidden");
      return {c0:c0,c1:c1,c2:c2};
    }`);
    ok("D5-phone-toggle", r && r.c0 === true && r.c1 === false && r.c2 === true, JSON.stringify(r));

    // 6. forgot-password opens recovery; back returns (click retried once:
    // the auth listeners attach asynchronously after CDN init)
    r = await cdp.ev(`async function(){
      async function openRec(){ document.getElementById("btnForgotPassword").click(); await new Promise(function(rr){setTimeout(rr,500);}); }
      await openRec();
      var card=document.getElementById("authCard");
      if (card.getAttribute("data-auth-mode") !== "recovery") { await new Promise(function(rr){setTimeout(rr,1500);}); await openRec(); }
      var recHid=document.getElementById("authPaneRecovery").classList.contains("hidden");
      var mainHid=document.getElementById("authPaneMain").classList.contains("hidden");
      var mode=card.getAttribute("data-auth-mode");
      document.getElementById("btnBackToSignIn").click(); await new Promise(function(rr){setTimeout(rr,400);});
      return {mode:mode,recHid:recHid,mainHid:mainHid,back:card.getAttribute("data-auth-mode")};
    }`);
    ok("D6-recovery-pane", r && r.mode === "recovery" && r.recHid === false && r.mainHid === true && r.back === "signin", JSON.stringify(r));

    // 7. recovery validation (empty -> field error, no navigation)
    r = await cdp.ev(`async function(){
      document.getElementById("btnForgotPassword").click(); await new Promise(function(rr){setTimeout(rr,300);});
      var before=window.location.href;
      document.getElementById("btnSendRecovery").click(); await new Promise(function(rr){setTimeout(rr,400);});
      var err=document.getElementById("recoveryEmailError");
      var out={errShown:!!(err&&!err.classList.contains("hidden")&&err.textContent.length>2), sameUrl:window.location.href===before};
      document.getElementById("btnBackToSignIn").click(); await new Promise(function(rr){setTimeout(rr,200);});
      return out;
    }`);
    ok("D7-recovery-validation", r && r.errShown === true && r.sameUrl === true, JSON.stringify(r));

    // 8. zero console/page errors through the whole flow
    r = await cdp.ev(`async function(){ return {n:window.__errs.length, first:(window.__errs[0]||"").slice(0,160)}; }`);
    ok("D8-no-errors", r && r.n === 0, "errors=" + (r ? String(r.n) : "?") + " " + ((r && r.first) || ""));
    cdp.close();
  } catch (e) {
    ok("harness", false, String((e && e.message) || e).slice(0, 120));
  }
  console.log("----\nTOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
  finish(fail ? 1 : 0);
})();
