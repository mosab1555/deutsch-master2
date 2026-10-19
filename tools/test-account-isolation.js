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
 * R23-R29b additionally gate (deterministically defer) matching backend
 * queries with makeGate(), so stale async completions from a superseded
 * session/identity can never re-activate an account, apply a stale snapshot
 * or version, write after sign-out, or burn queue retries. No timing sleeps.
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
/* Deterministic async gate: queries matching an armed predicate resolve only
   when the test releases them. Selects capture their result at request start,
   upserts execute at completion (release) - mirroring real in-flight
   semantics without timing sleeps. arm() predicates are one-shot. */
function makeGate() {
  const armed = [], held = [];
  return {
    arm(pred) { armed.push(pred); return this; },
    matches(info) {
      for (let i = 0; i < armed.length; i++) {
        if (armed[i](info)) { armed.splice(i, 1); return true; }
      }
      return false;
    },
    hold(finish) {
      let release;
      const p = new Promise(r => { release = () => r(finish()); });
      held.push(release);
      return p;
    },
    heldCount() { return held.length; },
    release() { const r = held.shift(); if (r) r(); return held.length; },
    releaseAll() { while (held.length) held.shift()(); },
  };
}
function makeClient(db, gate) {
  function runSelect(table, eqVal) {
    db.calls.push(["select", table, eqVal]);
    if (db.mode !== "ok") {
      const e = dbError(db);
      return (db.mode === "network" ? Promise.reject(new TypeError("Failed to fetch"))
        : Promise.resolve({ data: null, error: e }));
    }
    const row = db.rows.get(table + ":" + eqVal);
    return Promise.resolve(row
      ? { data: JSON.parse(JSON.stringify(row)), error: null }
      : { data: null, error: { message: "none", code: "PGRST116" } });
  }
  function runUpsert(table, payload) {
    db.calls.push(["upsert", table, payload.user_id]);
    if (db.mode !== "ok") {
      const e = dbError(db);
      return (db.mode === "network" ? Promise.reject(new TypeError("Failed to fetch"))
        : Promise.resolve({ data: null, error: e }));
    }
    db.rows.set(table + ":" + payload.user_id, JSON.parse(JSON.stringify(payload)));
    return Promise.resolve({ data: null, error: null });
  }
  function builder(table) {
    return {
      _eq: null, _up: null,
      select() { return this; },
      eq(c, v) { this._eq = { col: c, val: v }; return this; },
      single() { return this; },
      upsert(o) { this._up = o; return this; },
      then(res, rej) {
        const isUp = !!this._up;
        const userId = isUp ? this._up.user_id : (this._eq && this._eq.val);
        if (gate && gate.matches({ table, op: isUp ? "upsert" : "select", userId })) {
          if (!isUp) {
            const captured = runSelect(table, userId);
            return gate.hold(() => captured).then(res, rej);
          }
          const payload = this._up;
          return gate.hold(() => runUpsert(table, payload)).then(res, rej);
        }
        return (isUp ? runUpsert(table, this._up) : runSelect(table, userId)).then(res, rej);
      },
    };
  }
  return { from: t => builder(t) };
}

function bootContext(sharedMap, db, opts) {
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
  const client = (opts && opts.client) || makeClient(db);
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

/* Fresh gated race context: unique storage + gated fake backend over the
   real VM harness. Guest fixture is written with saveNow() (synchronous,
   never coalesced) so byte-comparisons are deterministic. */
function raceSetup(db) {
  const gate = makeGate();
  const ctx = bootContext(new Map(), db, { client: makeClient(db, gate) });
  ctx.js("S.xp=50; S.totalAnswered=60; S.quizHistory=[{id:'gq1'}]; S.customWords=[{id:'gw1',de:'Gast'}]; S.streak={count:7,last:'2026-10-01',longest:7}; saveNow();");
  return { gate: gate, ctx: ctx };
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

  /* ================= deterministic stale-identity races =================
     Each test gates one matching query, changes identity/session while the
     query is in flight, then releases it. Production code must treat the
     completion as superseded: no re-activation, no stale apply/version, no
     writes after sign-out, no retry burn, no queue loss. */

  /* ---- 23. Stale switchToAccount activation after sign-out (restore path) ---- */
  {
    const db23 = makeDb();
    db23.rows.set("user_progress:uid-A", { user_id: "uid-A", state: { xp: 9000, quizHistory: [{ id: "cq1" }] }, version: 3 });
    const r23 = raceSetup(db23);
    const guestBytes23 = key(r23.ctx, "deutsch_master_v2");
    r23.gate.arm(i => i.table === "user_progress" && i.op === "select" && i.userId === "uid-A");
    r23.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r23.ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')");
    await r23.ctx.tick(2);
    const held23 = r23.gate.heldCount();
    r23.ctx.setUser(null);
    r23.ctx.js("window.__dmTestHooks.handleSession(null,'SIGNED_OUT')");
    await r23.ctx.tick(2);
    r23.gate.release();
    await r23.ctx.tick();
    ok("R23-stale-signout-activation", held23 === 1 &&
      live(r23.ctx, "window.DMIdentity.activeUid()") === null &&
      live(r23.ctx, "S.xp") === 50 &&
      key(r23.ctx, "deutsch_master_v2") === guestBytes23 &&
      key(r23.ctx, "deutsch_master_v2:uid:uid-A") === null,
      "held=" + held23 + " uid=" + live(r23.ctx, "window.DMIdentity.activeUid()") +
      " xp=" + live(r23.ctx, "S.xp") + " aKey=" + (key(r23.ctx, "deutsch_master_v2:uid:uid-A") ? "yes" : "no"));
    r23.ctx.stop();
  }

  /* ---- 24. Stale first-time migration after sign-out (cloud empty path) ---- */
  {
    const db24 = makeDb();
    const r24 = raceSetup(db24);
    const guestBytes24 = key(r24.ctx, "deutsch_master_v2");
    r24.gate.arm(i => i.table === "user_progress" && i.op === "select" && i.userId === "uid-A");
    r24.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r24.ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')");
    await r24.ctx.tick(2);
    const held24 = r24.gate.heldCount();
    r24.ctx.setUser(null);
    r24.ctx.js("window.__dmTestHooks.handleSession(null,'SIGNED_OUT')");
    await r24.ctx.tick(2);
    r24.gate.release();
    await r24.ctx.tick();
    const ups24 = db24.calls.filter(c => c[0] === "upsert" && c[2] === "uid-A").length;
    ok("R24-stale-signout-migration", held24 === 1 && ups24 === 0 &&
      live(r24.ctx, "window.DMIdentity.activeUid()") === null &&
      key(r24.ctx, "deutsch_master_v2") === guestBytes24 &&
      key(r24.ctx, "deutsch_master_v2:uid:uid-A") === null,
      "held=" + held24 + " upserts=" + ups24 + " uid=" + live(r24.ctx, "window.DMIdentity.activeUid()"));
    r24.ctx.stop();
  }

  /* ---- 25. A-to-B: delayed A completion must not override B ---- */
  {
    const db25 = makeDb();
    db25.rows.set("user_progress:uid-A", { user_id: "uid-A", state: { xp: 9000, quizHistory: [] }, version: 3 });
    const r25 = raceSetup(db25);
    const guestBytes25 = key(r25.ctx, "deutsch_master_v2");
    r25.gate.arm(i => i.table === "user_progress" && i.op === "select" && i.userId === "uid-A");
    r25.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r25.ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')");
    await r25.ctx.tick(2);
    const held25 = r25.gate.heldCount();
    r25.ctx.setUser({ id: "uid-B", email: "b@gmail.com" });
    r25.ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-B'}},'SIGNED_IN')");
    await r25.ctx.tick();
    r25.gate.release();
    await r25.ctx.tick();
    ok("R25-stale-a-to-b", held25 === 1 &&
      live(r25.ctx, "window.DMIdentity.activeUid()") === "uid-B" &&
      live(r25.ctx, "S.xp") === 0 &&
      key(r25.ctx, "deutsch_master_v2") === guestBytes25 &&
      key(r25.ctx, "deutsch_master_v2:uid:uid-A") === null,
      "held=" + held25 + " uid=" + live(r25.ctx, "window.DMIdentity.activeUid()") +
      " xp=" + live(r25.ctx, "S.xp") + " aKey=" + (key(r25.ctx, "deutsch_master_v2:uid:uid-A") ? "yes" : "no"));
    r25.ctx.stop();
  }

  /* ---- 26. downloadState must not apply a stale snapshot after sign-out ---- */
  {
    const db26 = makeDb();
    db26.rows.set("user_progress:uid-A", { user_id: "uid-A", state: { xp: 4242, quizHistory: [] }, version: 5 });
    const r26 = raceSetup(db26);
    const guestBytes26 = key(r26.ctx, "deutsch_master_v2");
    r26.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r26.ctx.js("window.CloudSync.setActiveUser('uid-A')");
    r26.gate.arm(i => i.table === "user_progress" && i.op === "select" && i.userId === "uid-A");
    const p26 = r26.ctx.js("window.CloudSync.downloadState('uid-A')");
    await r26.ctx.tick(2);
    const held26 = r26.gate.heldCount();
    r26.ctx.setUser(null);
    r26.ctx.js("window.CloudSync.setActiveUser(null)");
    r26.gate.release();
    const res26 = await p26;
    await r26.ctx.tick();
    ok("R26-downloadState-stale", held26 === 1 &&
      res26 && res26.success === false && /Superseded/.test(res26.error || "") &&
      live(r26.ctx, "S.xp") === 50 &&
      key(r26.ctx, "deutsch_master_v2") === guestBytes26,
      "held=" + held26 + " res=" + JSON.stringify(res26) + " xp=" + live(r26.ctx, "S.xp"));
    r26.ctx.stop();
  }

  /* ---- 27a. Queued op superseded after its version pre-check must not write ---- */
  {
    const db27 = makeDb();
    db27.rows.set("user_progress:uid-A", { user_id: "uid-A", state: { xp: 9000, quizHistory: [] }, version: 999 });
    const r27 = raceSetup(db27);
    const guestBytes27 = key(r27.ctx, "deutsch_master_v2");
    r27.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r27.ctx.js("window.CloudSync.setActiveUser('uid-A')");
    r27.ctx.js("window.CloudSync.queueOperation('upsert_progress', { state: { xp: 777, quizHistory: [] } }, 'uid-A')");
    r27.gate.arm(i => i.table === "user_progress" && i.op === "select" && i.userId === "uid-A");
    const pq27 = r27.ctx.js("window.CloudSync.processQueue()");
    await r27.ctx.tick(2);
    const held27 = r27.gate.heldCount();
    r27.ctx.setUser(null);
    r27.ctx.js("window.CloudSync.setActiveUser(null)");
    r27.gate.release();
    await pq27;
    await r27.ctx.tick();
    const ups27 = db27.calls.filter(c => c[0] === "upsert" && c[2] === "uid-A").length;
    const q27 = JSON.parse(key(r27.ctx, "dm_sync_queue") || "[]");
    ok("R27a-executeOperation-stale-select", held27 === 1 && ups27 === 0 &&
      live(r27.ctx, "S.xp") === 50 &&
      key(r27.ctx, "deutsch_master_v2") === guestBytes27 &&
      q27.length === 1 && q27[0].userId === "uid-A" && (q27[0].retries || 0) === 0,
      "held=" + held27 + " ups=" + ups27 + " xp=" + live(r27.ctx, "S.xp") +
      " q=" + q27.length + " retries=" + (q27[0] && q27[0].retries));
    r27.ctx.stop();
  }

  /* ---- 27b. Queued op superseded during its in-flight write: no local apply,
       no version stamp, op held for its rightful owner, no retry burn ---- */
  {
    const db27b = makeDb();
    const r27b = raceSetup(db27b);
    const guestBytes27b = key(r27b.ctx, "deutsch_master_v2");
    r27b.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r27b.ctx.js("window.CloudSync.setActiveUser('uid-A')");
    r27b.ctx.js("window.CloudSync.queueOperation('upsert_progress', { state: { xp: 888, quizHistory: [] } }, 'uid-A')");
    r27b.gate.arm(i => i.table === "user_progress" && i.op === "upsert" && i.userId === "uid-A");
    const pq27b = r27b.ctx.js("window.CloudSync.processQueue()");
    await r27b.ctx.tick(2);
    const held27b = r27b.gate.heldCount();
    r27b.ctx.setUser(null);
    r27b.ctx.js("window.CloudSync.setActiveUser(null)");
    r27b.gate.release();
    await pq27b;
    await r27b.ctx.tick();
    const q27b = JSON.parse(key(r27b.ctx, "dm_sync_queue") || "[]");
    ok("R27b-executeOperation-stale-write", held27b === 1 &&
      live(r27b.ctx, "S.xp") === 50 &&
      key(r27b.ctx, "deutsch_master_v2") === guestBytes27b &&
      q27b.length === 1 && q27b[0].userId === "uid-A" && (q27b[0].retries || 0) === 0,
      "held=" + held27b + " xp=" + live(r27b.ctx, "S.xp") +
      " q=" + q27b.length + " retries=" + (q27b[0] && q27b[0].retries));
    r27b.ctx.stop();
  }

  /* ---- 28/28b. Direct migration: stale write refused; entry guard after sign-out ---- */
  {
    const db28 = makeDb();
    const r28 = raceSetup(db28);
    const guestBytes28 = key(r28.ctx, "deutsch_master_v2");
    r28.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r28.ctx.js("window.CloudSync.setActiveUser('uid-A')");
    r28.gate.arm(i => i.table === "user_progress" && i.op === "select" && i.userId === "uid-A");
    const p28 = r28.ctx.js("window.CloudSync.migrateLocalToCloud('uid-A', window.S)");
    await r28.ctx.tick(2);
    const held28 = r28.gate.heldCount();
    r28.ctx.setUser(null);
    r28.ctx.js("window.CloudSync.setActiveUser(null)");
    r28.gate.release();
    const res28 = await p28;
    await r28.ctx.tick();
    const ups28 = db28.calls.filter(c => c[0] === "upsert" && c[2] === "uid-A").length;
    ok("R28-migrate-stale", held28 === 1 &&
      res28 && res28.success === false && /Superseded/.test(res28.error || "") &&
      ups28 === 0 &&
      key(r28.ctx, "deutsch_master_v2") === guestBytes28,
      "held=" + held28 + " res=" + JSON.stringify(res28) + " ups=" + ups28);
    const calls28b = db28.calls.length;
    const res28b = await r28.ctx.js("window.CloudSync.migrateLocalToCloud('uid-A', window.S)");
    await r28.ctx.tick();
    ok("R28b-migrate-entry-guard",
      res28b && res28b.success === false && /Superseded/.test(res28b.error || "") &&
      db28.calls.length === calls28b,
      "res=" + JSON.stringify(res28b) + " extraCalls=" + (db28.calls.length - calls28b));
    r28.ctx.stop();
  }

  /* ---- 29. Same user, new generation: stale read must still be rejected ---- */
  {
    const db29 = makeDb();
    db29.rows.set("user_progress:uid-A", { user_id: "uid-A", state: { xp: 9000, quizHistory: [] }, version: 5 });
    const r29 = raceSetup(db29);
    const guestBytes29 = key(r29.ctx, "deutsch_master_v2");
    r29.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r29.ctx.js("window.CloudSync.setActiveUser('uid-A')");
    r29.gate.arm(i => i.table === "user_progress" && i.op === "select" && i.userId === "uid-A");
    const p29 = r29.ctx.js("window.CloudSync.downloadState('uid-A')");
    await r29.ctx.tick(2);
    const held29 = r29.gate.heldCount();
    r29.ctx.js("window.CloudSync.setActiveUser(null)");
    r29.ctx.js("window.CloudSync.setActiveUser('uid-A')"); // same uid, NEW generation
    r29.gate.release();
    const res29 = await p29;
    await r29.ctx.tick();
    ok("R29-same-uid-generation", held29 === 1 &&
      res29 && res29.success === false && /Superseded/.test(res29.error || "") &&
      live(r29.ctx, "S.xp") === 50 &&
      key(r29.ctx, "deutsch_master_v2") === guestBytes29,
      "held=" + held29 + " res=" + JSON.stringify(res29) + " xp=" + live(r29.ctx, "S.xp"));
    r29.ctx.stop();
  }

  /* ---- 29b. Same uid across sessions: stale PREVIOUS-generation switch must
       do no extra work even though the uid is active again ---- */
  {
    const db29b = makeDb();
    const r29b = raceSetup(db29b);
    r29b.gate.arm(i => i.table === "user_progress" && i.op === "select" && i.userId === "uid-A");
    r29b.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r29b.ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')");
    await r29b.ctx.tick(2);
    const held29b = r29b.gate.heldCount();
    r29b.ctx.setUser(null);
    r29b.ctx.js("window.__dmTestHooks.handleSession(null,'SIGNED_OUT')");
    await r29b.ctx.tick(2);
    // Sign back in as the SAME user: fresh session generation completes fully.
    r29b.ctx.setUser({ id: "uid-A", email: "a@gmail.com" });
    r29b.ctx.js("window.__dmTestHooks.handleSession({user:{id:'uid-A'}},'SIGNED_IN')");
    await r29b.ctx.tick();
    // Cloud advanced meanwhile (another device).
    db29b.rows.set("user_progress:uid-A", { user_id: "uid-A", state: { xp: 9500, quizHistory: [] }, version: 6 });
    const sel0 = db29b.calls.filter(c => c[0] === "select" && c[2] === "uid-A").length;
    const ups0 = db29b.calls.filter(c => c[0] === "upsert" && c[2] === "uid-A").length;
    const aKeyBefore = key(r29b.ctx, "deutsch_master_v2:uid:uid-A");
    r29b.gate.release(); // delivers the PREVIOUS session's captured (empty) result
    await r29b.ctx.tick();
    const sel1 = db29b.calls.filter(c => c[0] === "select" && c[2] === "uid-A").length;
    const ups1 = db29b.calls.filter(c => c[0] === "upsert" && c[2] === "uid-A").length;
    const aKeyAfter = key(r29b.ctx, "deutsch_master_v2:uid:uid-A");
    ok("R29b-same-uid-session-generation", held29b === 1 &&
      live(r29b.ctx, "window.DMIdentity.activeUid()") === "uid-A" &&
      sel1 === sel0 && ups1 === ups0 &&
      !!aKeyAfter && aKeyAfter === aKeyBefore,
      "held=" + held29b + " sels=" + sel0 + "->" + sel1 + " ups=" + ups0 + "->" + ups1 +
      " aKeyStable=" + (aKeyAfter === aKeyBefore));
    r29b.ctx.stop();
  }

  ctx.stop(); ctx2.stop();
  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}

main().catch(e => { console.error("FATAL", e && e.stack ? e.stack.split("\n").slice(0, 5).join(" | ") : e); process.exit(1); });
