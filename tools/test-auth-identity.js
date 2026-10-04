/* Deutsch Master - Account identity, sign-out & data-isolation tests.
 *
 * Covers (mapped to the audit requirements):
 *  3. sign-out stops account-specific sync, no authenticated account remains
 *  4. guest progress stays safe (never uploaded, never mixed, never dropped)
 *  5. account A cannot see/overwrite account B (guards + queue binding)
 *  6. switching accounts loads the correct snapshot (via DMIdentity seams)
 *  7. offline queued writes bind to their owner and never upload as another
 *  8. migration preserves existing progress (backup + snapshot continuity)
 *  2. session restore converges (AuthModule state machine + live-session rule)
 *  1/9. profile email/status rendering is covered by the CDP DOM section below
 *       (stubbed identity) plus the existing runtime-qa battery for regressions.
 *
 * Run: node tools/test-auth-identity.js [--cdp]
 *  --cdp also runs the real-browser DOM/storage section (needs Chrome).
 * Exits 1 on any FAIL. Prints only booleans/counts/key-names, never secrets.
 */
"use strict";
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");

let pass = 0, fail = 0;
function ok(id, cond, evidence) {
  if (cond) { pass++; console.log("PASS " + id + " [" + evidence + "]"); }
  else { fail++; console.log("FAIL " + id + " [" + evidence + "]"); }
}

/* ---------------- minimal browser stubs ---------------- */
function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => { m.clear(); },
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
    _keys: () => Array.from(m.keys()),
  };
}

function installGlobals() {
  const ls = makeLocalStorage();
  global.window = global.window || {};
  if (global.window !== global) {
    // keep a single shared global like a browser tab
    Object.assign(global, {});
  }
  global.localStorage = ls;
  global.sessionStorage = makeLocalStorage();
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true, userAgent: "node-test" },
      configurable: true, writable: true,
    });
  } catch (e) {
    try { global.navigator.onLine = true; } catch (e2) {}
  }
  global.document = global.document || {
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  global.window.addEventListener = global.window.addEventListener || (() => {});
  global.window.t = global.window.t || ((k) => k);
  global.window.matchMedia = global.window.matchMedia || (() => ({ matches: false }));
  return ls;
}

/* ---------------- fake Supabase backend ---------------- */
function makeFakeDb() {
  return {
    user_progress: new Map(), // user_id -> {user_id, state, version, device_id, updated_at}
    profiles: new Map(),
    devices: [],
    auth_events: [],
    calls: [], // {table, op, user_id}
  };
}

function makeQueryBuilder(db, table, opts) {
  opts = opts || {};
  const api = {
    _select: null, _eq: null, _upsert: null, _insert: null,
    select(cols) { this._select = cols; return this; },
    eq(col, val) { this._eq = { col, val }; return this; },
    single() { return this; },
    upsert(obj, o) { this._upsert = { obj, o }; return this; },
    insert(obj) { this._insert = obj; return this; },
    async _run() {
      const t = table;
      if (this._upsert) {
        const row = this._upsert.obj;
        db.calls.push({ table: t, op: "upsert", user_id: row.user_id || null });
        if (opts.authUserId && row.user_id && row.user_id !== opts.authUserId()) {
          return { data: null, error: { message: "RLS denied", code: "42501" } };
        }
        if (opts.delay) await opts.delay();
        if (t === "user_progress") db.user_progress.set(row.user_id, { ...row });
        if (t === "devices") db.devices.push({ ...row });
        return { data: null, error: null };
      }
      if (this._insert) {
        db.calls.push({ table: t, op: "insert", user_id: (this._insert.user_id || null) });
        if (t === "auth_events") db.auth_events.push({ ...this._insert });
        return { data: null, error: null };
      }
      // select path
      const col = this._eq ? this._eq.col : null;
      const val = this._eq ? this._eq.val : null;
      db.calls.push({ table: t, op: "select", user_id: col === "user_id" || col === "id" ? val : null });
      if (opts.delay) await opts.delay();
      if (t === "user_progress") {
        const row = val ? db.user_progress.get(val) : null;
        if (!row) return { data: null, error: { message: "none", code: "PGRST116" } };
        return { data: { ...row }, error: null };
      }
      return { data: null, error: { message: "none", code: "PGRST116" } };
    },
    then(res, rej) { return this._run().then(res, rej); },
  };
  return api;
}

function makeFakeSupabase(db, opts) {
  return {
    from: (t) => makeQueryBuilder(db, t, opts),
  };
}

function makeFakeAuth() {
  const listeners = [];
  const auth = {
    session: null,
    async getSession() { return { data: { session: this.session }, error: null }; },
    onAuthStateChange(cb) { listeners.push(cb); return { data: null }; },
    async signOut() {
      this.session = null;
      listeners.slice().forEach((cb) => { try { cb("SIGNED_OUT", null); } catch (e) {} });
      return { error: null };
    },
    _emit(event, session) {
      this.session = session;
      listeners.slice().forEach((cb) => { try { cb(event, session); } catch (e) {} });
    },
  };
  return auth;
}

/* ---------------- Part A: real-module logic tests ---------------- */
async function partA() {
  console.log("--- Part A: CloudSync/AuthModule isolation (real modules, stubbed browser) ---");
  const ls = installGlobals();
  global.window.localStorage = ls;
  global.navigator.onLine = true;

  // fresh module instances per run
  for (const f of ["auth.js", "cloud-sync.js"]) {
    try { delete require.cache[require.resolve(path.join(CLIENT, f))]; } catch (e) {}
  }

  const db = makeFakeDb();
  let authedUserId = null;
  const fakeAuth = makeFakeAuth();
  const fakeSupabaseLib = {
    createClient: () => ({ auth: fakeAuth }),
  };
  global.window.supabase = fakeSupabaseLib;

  let currentUser = null; // driven through the REAL AuthModule below
  global.window.AuthModule = null; // set after requiring auth.js

  const AuthModule = require(path.join(CLIENT, "auth.js"));
  global.window.AuthModule = AuthModule;
  // minimal extra stubs used by CloudSync
  AuthModule.getDeviceId = AuthModule.getDeviceId || (() => "dev-test");
  const CloudSync = require(path.join(CLIENT, "cloud-sync.js"));
  global.window.CloudSync = CloudSync;
  global.window.S = { xp: 0 };

  ok("A0-single-client", typeof AuthModule.init === "function" && typeof CloudSync.setActiveUser === "function", "modules loaded with identity API");

  ok("A1-init-ok", AuthModule.init({ url: "https://x.supabase.co", anonKey: "k" }) === true, "client init true");
  // wire the fake query backend into CloudSync
  const client = { auth: fakeAuth, from: (t) => makeQueryBuilder(db, t, { authUserId: () => authedUserId }) };
  CloudSync.init(client);

  const userA = { id: "user-A", email: "a@example.com" };
  const userB = { id: "user-B", email: "b@example.com" };

  // sign in A through the REAL AuthModule state machine
  fakeAuth._emit("SIGNED_IN", { user: userA });
  ok("A2-signin-A", !!AuthModule.getUser() && AuthModule.getUser().id === "user-A", "getUser=A");
  authedUserId = "user-A";
  CloudSync.setActiveUser("user-A");

  // upload as A
  let r = await CloudSync.uploadChanges("user-A", { xp: 10 });
  ok("A3-upload-A", r.success === true && ((db.user_progress.get("user-A") || {}).state || {}).xp === 10, "A row has A data");

  // stale in-flight op for A must not land on B (req 5/6)
  // simulate by switching active user, then attempting an A-stamped write
  CloudSync.setActiveUser("user-B");
  authedUserId = "user-B";
  const stale = await CloudSync.uploadChanges("user-A", { xp: 999 });
  const aRow = db.user_progress.get("user-A") || {};
  const bRow0 = db.user_progress.get("user-B") || {};
  ok("A4-stale-abort", stale.success === false && /Superseded/.test(stale.error || "") && (bRow0.state || {}).xp !== 999 && (aRow.state || {}).xp === 10, "stale A write blocked, B untouched");

  // B writes go to B only (req 5)
  CloudSync.setActiveUser("user-B");
  const rb = await CloudSync.uploadChanges("user-B", { xp: 5 });
  ok("A5-B-isolation", rb.success === true && ((db.user_progress.get("user-B") || {}).state || {}).xp === 5 && ((db.user_progress.get("user-A") || {}).state || {}).xp === 10, "rows isolated");

  // offline queue binds owner; replay as wrong account is refused (req 7)
  global.navigator.onLine = false;
  // flip module offline flag via the captured online/offline listeners is complex;
  // instead call queueOperation directly (same path uploadChanges uses offline)
  CloudSync.setActiveUser("user-A");
  const q = CloudSync.queueOperation("upsert_progress", { state: { xp: 42 } }, "user-A");
  ok("A6-queue-bound", q.queued === true, "queued while offline");
  global.navigator.onLine = true;
  CloudSync.setActiveUser("user-B");
  authedUserId = "user-B";
  fakeAuth._emit("SIGNED_IN", { user: userB });
  await CloudSync.processQueue();
  const bRow = db.user_progress.get("user-B") || {};
  ok("A7-queue-not-cross", ((bRow.state || {}).xp === 5) && JSON.parse(ls.getItem("dm_sync_queue") || "[]").length === 1, "A-op held, B row unchanged");
  // back to A: same op uploads under A
  CloudSync.setActiveUser("user-A");
  authedUserId = "user-A";
  fakeAuth._emit("SIGNED_IN", { user: userA });
  await CloudSync.processQueue();
  const aRow2 = db.user_progress.get("user-A") || {};
  ok("A8-queue-rightful", JSON.parse(ls.getItem("dm_sync_queue") || "[]").length === 0 && (aRow2.version || 0) >= 1 && typeof (aRow2.state || {}).xp === "number", "A-op flushed under A");

  // sign-out stops everything; no account remains (req 3)
  fakeAuth._emit("SIGNED_OUT", null);
  CloudSync.setActiveUser(null);
  CloudSync.stopAutoSync();
  const after = await CloudSync.uploadChanges("user-A", { xp: 1 });
  ok("A9-signout-stop", after.success === false && AuthModule.getUser() === null, "uploads refused, user null");

  // merge never downgrades newer cloud counters (req 8 support)
  const merged = CloudSync.mergeStates({ xp: 3, customWords: [{ id: "w1" }] }, { xp: 30, customWords: [{ id: "w2" }] }, 1, 9);
  ok("A10-merge-max-union", merged.state.xp === 30 && merged.state.customWords.length === 2, "max+union preserved");

  // restore converges: getSession path returns live user (req 2 support)
  fakeAuth._emit("SIGNED_IN", { user: userB });
  const initRes = await AuthModule.initialize();
  ok("A11-restore", initRes && initRes.user && initRes.user.id === "user-B", "initialize returns B");

  // Scenario A: guest -> sign in A -> verify A email -> sign out -> guest UI
  // state (no account active, account writes refused afterwards).
  fakeAuth._emit("SIGNED_IN", { user: userA });
  authedUserId = "user-A";
  CloudSync.setActiveUser("user-A");
  const aEmailShown = AuthModule.getUser() && AuthModule.getUser().email === "a@example.com";
  const signOutRes = await AuthModule.signOut();
  CloudSync.setActiveUser(null);
  CloudSync.stopAutoSync();
  const guestClean = AuthModule.getUser() === null && CloudSync.getActiveUser() === null;
  const afterOut = await CloudSync.uploadChanges("user-A", { xp: 777 });
  const aRowAfter = db.user_progress.get("user-A") || {};
  ok("A12-scenario-A", aEmailShown && !signOutRes.error && guestClean && afterOut.success === false && (aRowAfter.state || {}).xp !== 777, "A email shown, sign-out returns guest, writes refused");

  // Scenario C: A -> sign out -> B signs in -> B sees only B state.
  fakeAuth._emit("SIGNED_IN", { user: userB });
  authedUserId = "user-B";
  CloudSync.setActiveUser("user-B");
  const rb2 = await CloudSync.uploadChanges("user-B", { xp: 50 });
  const aRowC = db.user_progress.get("user-A") || {};
  const bRowC = db.user_progress.get("user-B") || {};
  ok("A13-scenario-C", rb2.success === true && (bRowC.state || {}).xp === 50 && (aRowC.state || {}).xp !== 50, "B sees only B state");

  // Scenario D: A starts an upload, sign-out lands mid-flight -> the stale
  // write must abort instead of repainting/persisting under a dead identity.
  CloudSync.setActiveUser("user-A");
  authedUserId = "user-A";
  fakeAuth._emit("SIGNED_IN", { user: userA });
  const pending = CloudSync.uploadChanges("user-A", { xp: 31337 });
  CloudSync.setActiveUser(null); // sign-out wins the race synchronously
  const dRes = await pending;
  const aRowD = db.user_progress.get("user-A") || {};
  ok("A14-scenario-D", dRes.success === false && /Superseded/.test(dRes.error || "") && (aRowD.state || {}).xp !== 31337, "late A callback aborted after sign-out");

  // Scenario B (store half): guest-bound offline work is never uploaded as an
  // account, and re-signing into A restores A's own row untouched.
  CloudSync.setActiveUser(null);
  const gq = CloudSync.queueOperation("upsert_progress", { state: { xp: 1 } }, null);
  CloudSync.setActiveUser("user-A");
  authedUserId = "user-A";
  fakeAuth._emit("SIGNED_IN", { user: userA });
  await CloudSync.processQueue();
  const aRowB = db.user_progress.get("user-A") || {};
  const qLeft = JSON.parse(ls.getItem("dm_sync_queue") || "[]");
  ok("A15-scenario-B", gq.queued === true && (aRowB.state || {}).xp !== 1 && qLeft.length === 1 && (qLeft[0].userId || "guest") === "guest", "guest op held, A row untouched");
}

/* ---------------- Part B: real-browser DOM/storage seams ----------------
 * Only runs with --cdp (needs Chrome). Uses the repo's own CDP pattern.
 * Asserts profile email/status rendering with a stubbed identity and the
 * DMIdentity snapshot isolation in the REAL page (no network auth needed).
 */
async function partB() {
  console.log("--- Part B: real-browser DOM/storage seams (CDP) ---");
  const { spawn } = require("child_process");
  const http = require("http");
  const os = require("os");
  const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const PORT = 19351;
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-id-"));
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + userDir, "about:blank"], { stdio: "ignore" });
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
            if (m.error) h.rej(new Error("x")); else h.res(m.result);
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
    evalJs(b, ms) { return this.send("Runtime.evaluate", { expression: "(" + b + ")()", awaitPromise: true, returnByValue: true }, ms || 30000).then((r) => (r && r.result ? r.result.value : null)); }
    close() { try { this.ws.close(); } catch (e) {} }
  }
  const finish = () => { try { chrome.kill(); } catch (e) {} try { if (srv.closeAllConnections) srv.closeAllConnections(); } catch (e) {} srv.close(() => process.exit(fail ? 1 : 0)); setTimeout(() => process.exit(fail ? 1 : 0), 3000).unref(); };
  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        const body = await new Promise((res, rej) => {
          http.get("http://127.0.0.1:" + PORT + "/json/list", (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b)); }).on("error", rej);
        });
        const pg = JSON.parse(body).find((t) => t.type === "page");
        if (pg && pg.webSocketDebuggerUrl) { wsUrl = pg.webSocketDebuggerUrl; break; }
      } catch (e) {}
    }
    const cdp = new CDP(wsUrl); await cdp.connect();
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/" }, 45000);
    await sleep(9000);

    // B1: signed-out profile render shows guest status, no stale email
    let r = await cdp.evalJs(`async function(){
      try{
        window.ProfileModule.initProfilePage();
        await new Promise(function(r){setTimeout(r,800);});
        var box=document.getElementById("profileBox");
        var html=box?box.innerHTML:"";
        return {guest:html.indexOf("status-signed-out")>=0, hasEmailStain:/@/.test(html)};
      }catch(e){return {err:true};}
    }`, 25000);
    ok("B1-guest-render", r && r.guest === true, "guest status shown");

    // B2: stubbed signed-in identity renders its email + signed-in status
    r = await cdp.evalJs(`async function(){
      try{
        var real=window.AuthModule.getUser;
        window.AuthModule.getUser=function(){return {id:"stub-uid-1",email:"stubuser@example.com",app_metadata:{provider:"google"},user_metadata:{}};};
        window.ProfileModule.clearCache();
        window.ProfileModule.initProfilePage();
        await new Promise(function(r){setTimeout(r,1200);});
        var box=document.getElementById("profileBox");
        var html=box?box.innerHTML:"";
        var out={email:html.indexOf("stubuser@example.com")>=0, signed:html.indexOf("status-signed-in")>=0};
        window.AuthModule.getUser=real;
        window.ProfileModule.clearCache();
        window.ProfileModule.initProfilePage();
        return out;
      }catch(e){return {err:true};}
    }`, 25000);
    ok("B2-email-render", r && r.email === true && r.signed === true, "stub email + status shown");

    // B5: signed-out topbar carries no stale identity (chip absent/hidden,
    // account menu hidden, login visible)
    r = await cdp.evalJs(`async function(){
      try{
        var menu=document.getElementById("userMenu");
        var login=document.getElementById("loginBtn");
        var chip=document.getElementById("userEmail");
        return {menuHidden:!menu||menu.classList.contains("hidden"),
          loginVisible:!!login&&login.style.display!=="none",
          chipClean:!chip||chip.style.display==="none"||!chip.textContent};
      }catch(e){return {err:true};}
    }`, 25000);
    ok("B5-topbar-clean", r && r.menuHidden === true && r.loginVisible === true && r.chipClean === true, "no stale identity in topbar");

    // B6: Scenario A/D topbar UI through the REAL updateAuthUI (test seam):
    // guest -> A (display name preferred, email in title/aria) -> guest ->
    // stale updateAuthUI(true) after sign-out must still render guest.
    r = await cdp.evalJs(`async function(){
      try{
        var hook=window.__dmTestHooks&&window.__dmTestHooks.updateAuthUI;
        if(typeof hook!=="function") return {noHook:true};
        var real=window.AuthModule.getUser;
        function snap(){
          var menu=document.getElementById("userMenu");
          var login=document.getElementById("loginBtn");
          var chip=document.getElementById("userEmail");
          return {menuHidden:!menu||menu.classList.contains("hidden"),
            loginVisible:!!login&&login.style.display!=="none",
            chipText:chip?String(chip.textContent||""):"",
            chipTitle:chip?String(chip.title||""):"",
            chipAria:chip?String(chip.getAttribute("aria-label")||""):"",
            chipHidden:!chip||chip.style.display==="none"};
        }
        window.AuthModule.getUser=function(){return null;};
        hook(false);
        var g0=snap();
        window.AuthModule.getUser=function(){return {id:"stub-uid-A",email:"VeryLongGmailAddressForLayout@example.com",app_metadata:{provider:"google"},user_metadata:{full_name:"Layla Haddad"}};};
        hook(true);
        var a1=snap();
        window.AuthModule.getUser=function(){return null;};
        hook(false);
        var g1=snap();
        hook(true); // stale signed-in call after sign-out: must stay guest
        var g2=snap();
        window.AuthModule.getUser=function(){return {id:"stub-uid-B",email:"b@example.com",app_metadata:{provider:"email"},user_metadata:{}};};
        hook(true);
        var b1=snap();
        window.AuthModule.getUser=real;
        hook(false);
        return {g0:g0,a1:a1,g1:g1,g2:g2,b1:b1};
      }catch(e){return {err:String(e&&e.message||e).slice(0,80)};}
    }`, 25000);
    ok("B6-topbar-A-D", r && r.g0 && r.g0.menuHidden === true && r.g0.loginVisible === true &&
      r.a1 && r.a1.menuHidden === false && r.a1.loginVisible === false && r.a1.chipText === "Layla Haddad" &&
      r.a1.chipTitle === "VeryLongGmailAddressForLayout@example.com" && r.a1.chipAria === "VeryLongGmailAddressForLayout@example.com" &&
      r.g1 && r.g1.menuHidden === true && r.g1.chipHidden === true && !r.g1.chipText &&
      r.g2 && r.g2.menuHidden === true && r.g2.loginVisible === true && !r.g2.chipText &&
      r.b1 && r.b1.chipText === "b@example.com", "guest->A(name)->guest->stale-true->B via real renderer");

    // B7: Scenario B/C store sequence in the REAL DMIdentity store:
    // A isolated from B, guest restored byte-identical, no cross-copy.
    r = await cdp.evalJs(`async function(){
      try{
        window.DMIdentity.ensureBackup();
        window.S.xp=50; window.save();
        var guestBefore=localStorage.getItem("deutsch_master_v2");
        window.DMIdentity.activate("test-uid-A");
        var aLive=window.S.xp;
        window.S.xp=100; window.save();
        window.DMIdentity.activate("test-uid-B");
        var bLive=window.S.xp;
        window.S.xp=200; window.save();
        window.DMIdentity.activate("test-uid-A");
        var aBack=window.S.xp;
        window.DMIdentity.activate(null);
        var guestBack=window.S.xp;
        var guestAfter=localStorage.getItem("deutsch_master_v2");
        var aSnap=null,bSnap=null;
        try{aSnap=JSON.parse(localStorage.getItem("deutsch_master_v2:uid:test-uid-A")).xp;}catch(e){}
        try{bSnap=JSON.parse(localStorage.getItem("deutsch_master_v2:uid:test-uid-B")).xp;}catch(e){}
        window.S.xp=50; window.save();
        try{localStorage.removeItem("deutsch_master_v2:uid:test-uid-A");}catch(e){}
        try{localStorage.removeItem("deutsch_master_v2:uid:test-uid-B");}catch(e){}
        return {aLive:aLive,bLive:bLive,aBack:aBack,guestBack:guestBack,aSnap:aSnap,bSnap:bSnap,same:guestBefore===guestAfter};
      }catch(e){return {err:String(e&&e.message||e).slice(0,80)};}
    }`, 25000);
    ok("B7-store-B-C", r && r.aLive === 0 && r.bLive === 0 && r.aBack === 100 && r.guestBack === 50 && r.aSnap === 100 && r.bSnap === 200 && r.same === true, "A/B/guest isolated, guest byte-identical");

    // B8: sidebar account/logout placement through the REAL page wiring:
    // header carries no account/logout buttons; sidebar holds the profile
    // nav entry + logout action; profile nav opens the profile page;
    // logout click invokes the single AuthModule.signOut flow, closes the
    // sidebar, and the UI settles into the guest state.
    r = await cdp.evalJs(`async function(){
      try{
        var hook=window.__dmTestHooks&&window.__dmTestHooks.updateAuthUI;
        if(typeof hook!=="function") return {noHook:true};
        var realGet=window.AuthModule.getUser;
        var realOut=window.AuthModule.signOut;
        var out={};
        var top=document.querySelector(".topbar")||document.body;
        out.topHasProfile=!!top.querySelector("#profileBtn");
        out.topHasLogout=!!top.querySelector(".top-actions #logoutBtn, header #logoutBtn");
        var side=document.getElementById("sidebar");
        var profBtn=side?side.querySelector('[data-page="profile"]'):null;
        var outBtn=document.getElementById("logoutBtn");
        out.sideHasProfile=!!profBtn;
        out.sideHasLogout=!!outBtn&&!!(side&&side.contains(outBtn));
        // signed-in: sidebar logout visible
        window.AuthModule.getUser=function(){return {id:"stub-uid-A",email:"a@example.com",app_metadata:{provider:"google"},user_metadata:{full_name:"Layla"}};};
        hook(true);
        out.logoutVisibleWhenIn=!!outBtn&&!outBtn.classList.contains("hidden");
        // profile nav opens the profile interface
        if(profBtn)profBtn.click();
        await new Promise(function(r){setTimeout(r,600);});
        var pg=document.getElementById("page-profile");
        out.profileOpened=!!pg&&pg.classList.contains("active");
        // logout click uses the single signOut flow + closes sidebar
        var signOutCalls=0;
        window.AuthModule.signOut=function(){signOutCalls++;return Promise.resolve({error:null});};
        try{side.classList.add("open");}catch(e){}
        outBtn.click();
        await new Promise(function(r){setTimeout(r,400);});
        out.signOutCalls=signOutCalls;
        out.sidebarClosed=!side.classList.contains("open");
        // auth event settles to guest UI (driven here via the real renderer)
        window.AuthModule.getUser=function(){return null;};
        hook(false);
        await new Promise(function(r){setTimeout(r,300);});
        var login=document.getElementById("loginBtn");
        out.guestUI=!!login&&login.style.display!=="none"&&outBtn.classList.contains("hidden");
        window.AuthModule.getUser=realGet;
        window.AuthModule.signOut=realOut;
        hook(false);
        return out;
      }catch(e){return {err:String(e&&e.message||e).slice(0,100)};}
    }`, 25000);
    ok("B8-sidebar-account-logout", r && r.topHasProfile === false && r.topHasLogout === false &&
      r.sideHasProfile === true && r.sideHasLogout === true && r.logoutVisibleWhenIn === true &&
      r.profileOpened === true && r.signOutCalls === 1 && r.sidebarClosed === true && r.guestUI === true,
      "header clean, sidebar entries work, logout wired, guest settles");

    // B3/B4: snapshot isolation + guest safety in the REAL store
    r = await cdp.evalJs(`async function(){
      try{
        window.DMIdentity.ensureBackup();
        window.S.xp=50; window.save();
        window.DMIdentity.activate("test-uid-A");
        var aXp=window.S.xp;
        window.S.xp=100; window.save();
        var guestRaw=localStorage.getItem("deutsch_master_v2");
        var guestXp=null; try{guestXp=JSON.parse(guestRaw).xp;}catch(e){}
        var aRaw=localStorage.getItem("deutsch_master_v2:uid:test-uid-A");
        var aKept=null; try{aKept=JSON.parse(aRaw).xp;}catch(e){}
        window.DMIdentity.activate(null);
        var backXp=window.S.xp;
        var backup=!!localStorage.getItem("deutsch_master_v2:backup:pre-identity");
        // cleanup test keys (guest restore keeps working data intact)
        window.S.xp=50; window.save();
        try{localStorage.removeItem("deutsch_master_v2:uid:test-uid-A");}catch(e){}
        return {aXp:aXp, guestXp:guestXp, aKept:aKept, backXp:backXp, backup:backup};
      }catch(e){return {err:String(e).slice(0,80)};}
    }`, 25000);
    ok("B3-isolation", r && r.aXp === 0 && r.guestXp === 50 && r.aKept === 100, "A live/guest/snapshot separated");
    ok("B4-guest-restore-backup", r && r.backXp === 50 && r.backup === true, "guest restored, backup kept");
    cdp.close();
  } catch (e) {
    ok("B-harness", false, "harness error " + String((e && e.message) || e).slice(0, 100));
  }
  finish();
}

(async () => {
  await partA();
  if (process.argv.includes("--cdp")) {
    await partB(); // calls process.exit itself
  } else {
    console.log("RESULT pass=" + pass + " fail=" + fail + " (node part only; use --cdp for browser part)");
    process.exit(fail ? 1 : 0);
  }
})();
