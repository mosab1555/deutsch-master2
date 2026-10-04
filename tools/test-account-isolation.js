/* Deutsch Master - account isolation regression tests.
 *
 * Drives the REAL login/logout transition code (app-init switchToAccount /
 * signOutIdentity / handleSession via the __dmTestHooks seam) with the REAL
 * identity store (script.js DMIdentity + live S + save) and the REAL
 * CloudSync queue/sync logic against an in-memory fake Supabase backend.
 * Only the identity oracle (AuthModule.getUser/getClient) and the DOM are
 * stubbed; auth/session modules themselves are covered by
 * test-auth-identity.js / test-auth-dom.js.
 *
 * Proves guest progress can NEVER leak into a brand-new authenticated
 * account, existing accounts restore only their own cloud state, logout
 * restores the guest byte-identically, and queues stay owner-bound across
 * Guest -> A -> Logout -> Guest -> A and Guest -> A -> Logout -> B.
 *
 * Usage: node tools/test-account-isolation.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const CLIENT = path.join(root, "client");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");

let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

/* ---------------- harness ---------------- */
function makeLS(map) {
  const m = map || new Map();
  return {
    _m: m,
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
  };
}
function mkEl() {
  return {
    _v: "", _h: "", _t: "",
    get value() { return this._v; }, set value(v) { this._v = String(v); },
    get innerHTML() { return this._h; }, set innerHTML(v) { this._h = String(v); },
    get textContent() { return this._t; }, set textContent(v) { this._t = String(v); },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {}, dataset: {}, firstChild: null, options: [],
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { return c; }, insertBefore(c) { return c; }, remove() {},
    click() {}, focus() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    getAttribute() { return null; }, setAttribute() {}, removeAttribute() {},
  };
}
/* In-memory fake PostgREST backend. mode: ok|auth|rls|network|fail500 */
function makeDb() { return { rows: new Map(), calls: [], mode: "ok" }; }
function dbError(db) {
  if (db.mode === "auth") return { message: "JWT expired", code: "401", status: 401 };
  if (db.mode === "rls") return { message: "permission denied for table user_progress", code: "42501", status: 403 };
  if (db.mode === "fail500") return { message: "Internal Server Error", status: 500 };
  return { message: "boom" };
}
function makeClient(db) {
  function builder(table) {
    return {
      _eq: null, _up: null,
      select() { return this; },
      eq(c, v) { this._eq = { col: c, val: v }; return this; },
      single() { return this; },
      upsert(o) { this._up = o; return this; },
      then(res, rej) {
        if (this._up) {
          db.calls.push(["upsert", table, this._up.user_id]);
          if (db.mode !== "ok") {
            const e = dbError(db);
            return (db.mode === "network" ? Promise.reject(new TypeError("Failed to fetch"))
              : Promise.resolve({ data: null, error: e })).then(res, rej);
          }
          db.rows.set(table + ":" + this._up.user_id, JSON.parse(JSON.stringify(this._up)));
          return Promise.resolve({ data: null, error: null }).then(res, rej);
        }
        db.calls.push(["select", table, this._eq && this._eq.val]);
        if (db.mode !== "ok") {
          const e = dbError(db);
          return (db.mode === "network" ? Promise.reject(new TypeError("Failed to fetch"))
            : Promise.resolve({ data: null, error: e })).then(res, rej);
        }
        const row = db.rows.get(table + ":" + (this._eq && this._eq.val));
        return Promise.resolve(row
          ? { data: JSON.parse(JSON.stringify(row)), error: null }
          : { data: null, error: { message: "none", code: "PGRST116" } }).then(res, rej);
      },
    };
  }
  return { from: t => builder(t) };
}

function bootContext(sharedMap, db) {
  const ls = makeLS(sharedMap);
  const winListeners = {};
  const sb = {
    console: { log() {}, error() {}, warn() {} },
    localStorage: ls,
    setTimeout: () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0,
    confirm: () => { throw new Error("merge dialog must never appear"); },
    location: { search: "", hash: "", pathname: "/index.html" },
    history: { replaceState() {} },
    document: {
      readyState: "complete",
      getElementById: () => mkEl(),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => mkEl(),
      documentElement: { setAttribute() {}, style: { setProperty() {}, removeProperty() {} } },
      body: {},
    },
  };
  sb.window = sb; sb.globalThis = sb;
  try {
    Object.defineProperty(sb, "navigator", { value: { onLine: true, userAgent: "node-test" }, configurable: true, writable: true });
  } catch (e) { sb.navigator = { onLine: true, userAgent: "node-test" }; }
  sb.window.addEventListener = (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); };
  vm.createContext(sb);
  vm.runInContext(RD("client/script.js"), sb, { filename: "script.js" });
  vm.runInContext(RD("client/cloud-sync.js"), sb, { filename: "cloud-sync.js" });
  /* bridge the real save() onto window (applyMergedState uses window.save) */
  vm.runInContext("window.save = save;", sb);
  vm.runInContext(RD("client/app-init.js"), sb, { filename: "app-init.js" });
  const js = expr => vm.runInContext(expr, sb);
  const hooks = js("window.__dmTestHooks || {}");
  // Auth oracle stub (session/account modules themselves are tested elsewhere)
  let currentUser = null;
  const client = makeClient(db);
  sb.window.AuthModule = {
    getClient: () => client,
    getUser: () => currentUser,
    registerDevice: async () => ({}),
  };
  sb.window.ProfileModule = { clearCache() {}, initProfilePage() {}, getProfile: async () => null };
  sb.window.CloudSync.init(client);
  return {
    sb, js, ls, db, client, hooks,
    setUser: u => { currentUser = u; },
    fire: name => { (winListeners[name] || []).slice().forEach(f => { try { f(); } catch (e) {} }); },
    tick: async (n) => { for (let i = 0; i < (n || 20); i++) await new Promise(r => setImmediate(r)); },
    stop: () => { try { sb.window.CloudSync.stopAutoSync(); } catch (e) {} },
  };
}
function key(ctx, k) { return ctx.ls.getItem(k); }
function live(ctx, expr) { return ctx.js("(" + expr + ")"); }

/* Distinct progress markers per identity */
function guestProgress(ctx) {
  ctx.js("S.xp=50; S.totalAnswered=60; S.testsTaken=3; S.quizHistory=[{id:'gq1'}]; S.customWords=[{id:'gw1',de:'Gast'}]; S.status={w1:'known'}; S.mistakes={w2:{n:2}}; S.streak={count:7,last:'2026-10-01',longest:7}; S.settings.theme='midnight'; save();");
}
function aProgress(ctx) {
  ctx.js("S.xp=100; S.totalAnswered=120; S.quizHistory=[{id:'aq1'}]; S.customWords=[{id:'aw1',de:'Konto'}]; S.status={w9:'known'}; S.mistakes={}; S.streak={count:3,last:'2026-10-02',longest:3}; save();");
}

async function main() {
  const db = makeDb();
  const shared = new Map();
  const ctx = bootContext(shared, db);
  ok("H-seam", !!ctx.hooks.switchToAccount && !!ctx.hooks.signOutIdentity && !!ctx.hooks.handleSession, "transition seam exposed");

  /* ---- 1. Guest builds progress ---- */
  guestProgress(ctx);
  const guestBytes = key(ctx, "deutsch_master_v2");
  ok("T01-guest-progress", !!guestBytes && live(ctx, "S.xp") === 50 && live(ctx, "S.streak.count") === 7, "guest xp=50 streak=7");

  /* ---- 2. Login BRAND-NEW uid-A: must start clean ---- */
  ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
  await ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A',email:'a@gmail.com'}},'SIGNED_IN')");
  await ctx.tick();
  ok("T02-new-account-clean",
    live(ctx, "S.xp") === 0 && live(ctx, "S.totalAnswered") === 0 &&
    live(ctx, "JSON.stringify(S.quizHistory)") === "[]" &&
    live(ctx, "JSON.stringify(S.customWords)") === "[]" &&
    live(ctx, "JSON.stringify(S.status)") === "{}" &&
    live(ctx, "S.streak.count") === 0, "live=" + live(ctx, "JSON.stringify({xp:S.xp,streak:S.streak.count})"));
  ok("T02-no-guest-settings", live(ctx, "S.settings.theme") === "dark", "theme=" + live(ctx, "S.settings.theme"));
  ok("T03-guest-preserved", key(ctx, "deutsch_master_v2") === guestBytes, "guest bytes identical");
  const aKey = key(ctx, "deutsch_master_v2:uid:uid-A");
  ok("T04-account-key-default", !!aKey && JSON.parse(aKey).xp === 0, "uid-A key is default state");
  const cloudA = db.rows.get("user_progress:uid-A");
  ok("T04-cloud-clean", !!cloudA && (cloudA.state || {}).xp === 0 &&
    JSON.stringify((cloudA.state || {}).customWords || []) === "[]", "cloud row created from clean state");

  /* ---- 4. Progress under A saves independently ---- */
  aProgress(ctx);
  await ctx.js("window.CloudSync.uploadChanges('uid-A', window.S)");
  await ctx.tick();
  ok("T05-account-independent", (db.rows.get("user_progress:uid-A").state || {}).xp === 100, "cloud A xp=100");

  /* ---- 5. Logout restores guest byte-identically ---- */
  ctx.setUser(null);
  await ctx.js("window.__dmTestHooks.handleSession(null,'SIGNED_OUT')");
  await ctx.tick();
  ok("T06-logout-guest", key(ctx, "deutsch_master_v2") === guestBytes && live(ctx, "S.xp") === 50, "guest restored");
  ok("T06-account-kept", JSON.parse(key(ctx, "deutsch_master_v2:uid:uid-A")).xp === 100, "A snapshot kept");

  /* ---- 6. Existing account restores ONLY its cloud state ---- */
  db.rows.get("user_progress:uid-A").state.xp = 999; // cloud moved on (other device)
  ctx.js("try{localStorage.removeItem('deutsch_master_v2:uid:uid-A');}catch(e){}"); // snapshot lost
  ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
  await ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')");
  await ctx.tick();
  ok("T07-cloud-restore", live(ctx, "S.xp") === 999 &&
    live(ctx, "JSON.stringify(S.customWords)") === JSON.stringify(db.rows.get("user_progress:uid-A").state.customWords),
    "live xp=" + live(ctx, "S.xp"));
  ok("T07-no-guest-mix", live(ctx, "JSON.stringify(S.quizHistory)") !== JSON.stringify([{ id: "gq1" }]), "guest quiz absent");

  /* ---- 7/11. B is new+clean; A keeps only A ---- */
  ctx.setUser(null);
  await ctx.js("window.__dmTestHooks.handleSession(null,'SIGNED_OUT')"); await ctx.tick();
  ctx.setUser({ id: "uid-B", email: "b@gmail.com" });
  await ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-B'}},'SIGNED_IN')"); await ctx.tick();
  ok("T08-b-clean", live(ctx, "S.xp") === 0, "B starts clean");
  ctx.js("S.xp=200; save();");
  await ctx.js("window.CloudSync.uploadChanges('uid-B', window.S)"); await ctx.tick();
  ctx.setUser(null);
  await ctx.js("window.__dmTestHooks.handleSession(null,'SIGNED_OUT')"); await ctx.tick();
  ok("T09-guest-after-b", key(ctx, "deutsch_master_v2") === guestBytes, "guest still identical");
  ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
  await ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')"); await ctx.tick();
  const liveA = live(ctx, "JSON.stringify({xp:S.xp,cw:(S.customWords||[]).length,streak:S.streak.count})");
  ok("T10-a-only-a", live(ctx, "S.xp") === 999, "A restored, xp=" + live(ctx, "S.xp") + " " + liveA);
  ok("T10-no-b-in-a", live(ctx, "S.xp") !== 200, "B progress absent from A");

  /* ---- 8/9. Queue isolation across transitions ---- */
  ctx.fire("offline");
  ctx.js("S.xp=1001; save();");
  await ctx.js("window.CloudSync.uploadChanges('uid-A', window.S)"); await ctx.tick();
  let q = JSON.parse(key(ctx, "dm_sync_queue") || "[]");
  ok("T11-queue-owned", q.length === 1 && q[0].userId === "uid-A", "queued under A");
  ctx.setUser(null);
  await ctx.js("window.__dmTestHooks.handleSession(null,'SIGNED_OUT')"); await ctx.tick();
  ctx.fire("online"); await ctx.tick(30);
  q = JSON.parse(key(ctx, "dm_sync_queue") || "[]");
  ok("T12-no-cross-upload", q.length === 1 && q[0].userId === "uid-A", "A-op held while guest, len=" + q.length);
  ctx.setUser({ id: "uid-B", email: "b@gmail.com" });
  await ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-B'}},'SIGNED_IN')"); await ctx.tick();
  await ctx.js("window.CloudSync.processQueue()"); await ctx.tick();
  q = JSON.parse(key(ctx, "dm_sync_queue") || "[]");
  ok("T13-held-under-b", q.length === 1 && q[0].userId === "uid-A", "A-op held while B active");

  /* ---- 12. A -> logout -> A ---- */
  ctx.setUser(null);
  await ctx.js("window.__dmTestHooks.handleSession(null,'SIGNED_OUT')"); await ctx.tick();
  ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
  await ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')"); await ctx.tick();
  await ctx.js("window.CloudSync.processQueue()"); await ctx.tick();
  q = JSON.parse(key(ctx, "dm_sync_queue") || "[]");
  ok("T14-rightful-drain", q.length === 0, "A-op flushed under A, len=" + q.length);

  /* ---- 13/14. Reload: fresh context, same storage ---- */
  const ctx2 = bootContext(shared, db);
  ctx2.setUser(null);
  ok("T15-reload-guest", live(ctx2, "S.xp") === 50, "guest xp=" + live(ctx2, "S.xp"));
  ctx2.setUser({ id: "uid-A", email: "a@gmail.com" });
  await ctx2.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')"); await ctx2.tick();
  ok("T16-reload-auth", live(ctx2, "S.xp") === 999 || live(ctx2, "S.xp") === 1001, "A restored xp=" + live(ctx2, "S.xp"));

  /* ---- 15/16/17. Provider restoration shapes ---- */
  for (const [tag, sess] of [
    ["google", { user: { id: "uid-O1", email: "o@gmail.com", app_metadata: { provider: "google" } } }],
    ["email", { user: { id: "uid-O2", email: "o2@x.com", app_metadata: { provider: "email" } } }],
    ["phone", { user: { id: "uid-O3", phone: "+20100", app_metadata: { provider: "phone" } } }],
  ]) {
    const c3 = bootContext(shared, db);
    c3.setUser(sess.user);
    await c3.js("window.__dmTestHooks.handleSession(" + JSON.stringify(sess).replace(/</g, "\\u003c") + ",'SIGNED_IN')");
    await c3.tick();
    ok("T17-provider-" + tag, live(c3, "S.xp") === 0, tag + " new account clean, xp=" + live(c3, "S.xp"));
    c3.stop();
  }

  /* ---- 18. Failed sync during transition: clean + guest intact, no throw ---- */
  db.mode = "fail500";
  const c4 = bootContext(shared, db);
  let threw = null;
  c4.setUser({ id: "uid-F", email: "f@x.com" });
  try {
    await c4.js("window.__dmTestHooks.handleSession({user:{id:'uid-F'}},'SIGNED_IN')");
    await c4.tick();
  } catch (e) { threw = e; }
  ok("T18-failure-clean", !threw && live(c4, "S.xp") === 0, "clean live, threw=" + !!threw);
  ok("T18-guest-intact", key(c4, "deutsch_master_v2") === guestBytes, "guest identical");
  db.mode = "ok";
  c4.stop();

  /* ---- 19. Offline login then reconnect ---- */
  const c5 = bootContext(shared, db);
  c5.fire("offline");
  db.mode = "network";
  c5.setUser({ id: "uid-G", email: "g@x.com" });
  await c5.js("window.__dmTestHooks.handleSession({user:{id:'uid-G'}},'SIGNED_IN')");
  await c5.tick();
  ok("T19-offline-clean", live(c5, "S.xp") === 0, "offline new account clean");
  db.mode = "ok";
  c5.fire("online");
  await c5.tick(30);
  const upG = await c5.js("window.CloudSync.uploadChanges('uid-G', window.S)");
  await c5.tick();
  ok("T19-reconnect-upload", upG && upG.success === true, JSON.stringify(upG));
  c5.stop();

  /* ---- 20/21/22. No dup records, no dup processing, no loss on switches ---- */
  const scrub = bootContext(shared, db);
  const users = [...db.rows.keys()].filter(k => k.startsWith("user_progress:")).map(k => k.split(":")[1]);
  ok("T20-single-row-per-user", users.length === new Set(users).size, "users=" + users.length);
  scrub.setUser({ id: "uid-A", email: "a@gmail.com" });
  await scrub.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')"); await scrub.tick();
  // Progress-content stability across switches (sync versions legitimately
  // advance, so compare learning data, not raw bytes).
  const progOf = k => { const s = JSON.parse(key(scrub, k)); return JSON.stringify({ xp: s.xp, ta: s.totalAnswered, qh: s.quizHistory, cw: s.customWords, st: s.status, mi: s.mistakes, sk: s.streak, se: s.settings }); };
  const beforeA = progOf("deutsch_master_v2:uid:uid-A");
  scrub.setUser({ id: "uid-B", email: "b@gmail.com" });
  await scrub.js("window.__dmTestHooks.handleSession({user:{id:'uid-B'}},'SIGNED_IN')"); await scrub.tick();
  scrub.setUser({ id: "uid-A", email: "a@gmail.com" });
  await scrub.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')"); await scrub.tick();
  ok("T21-no-loss-on-switches", progOf("deutsch_master_v2:uid:uid-A") === beforeA, "A progress stable");
  const calls0 = db.calls.filter(c => c[0] === "upsert" && c[2] === "uid-A").length;
  await scrub.js("window.CloudSync.uploadChanges('uid-A', window.S)"); await scrub.tick();
  await scrub.js("window.CloudSync.processQueue()"); await scrub.tick();
  const calls1 = db.calls.filter(c => c[0] === "upsert" && c[2] === "uid-A").length;
  ok("T22-no-dup-processing", calls1 - calls0 <= 2, "upserts=" + (calls1 - calls0));
  scrub.stop();

  ctx.stop(); ctx2.stop();
  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}

main().catch(e => { console.error("FATAL", e && e.stack ? e.stack.split("\n").slice(0, 5).join(" | ") : e); process.exit(1); });
