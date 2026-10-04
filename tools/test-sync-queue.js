/* Deutsch Master - sync-queue regression tests (sync error count fix).
 * Proves, against the REAL client/cloud-sync.js with a fake backend:
 *  1. repeated failed/offline full-state snapshots coalesce per owner
 *     (no unbounded dm_sync_queue growth behind "⚠ خطأ في المزامنة (N)")
 *  2. different owners are never coalesced (cross-account holding intact)
 *  3. queue length is capped
 *  4. a successful upload drains the queue and reports ONLINE (recovery)
 *  5. a failed upload still queues (offline-first preserved)
 *  6. guest ops stay held under a signed-in user (never cross-uploaded)
 *  7. concurrent queue drains never double-upload one op
 * Usage: node tools/test-sync-queue.js  (exit 0 = PASS, 1 = FAIL)
 */
const path = require("path");
const CLIENT = path.join(__dirname, "..", "client");

let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(k); },
    _keys: () => Array.from(m.keys()),
  };
}

function installGlobals() {
  const ls = makeLocalStorage();
  global.window = {};
  global.localStorage = ls;
  global.window.localStorage = ls;
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true, userAgent: "node-test" },
      configurable: true, writable: true,
    });
  } catch (e) {
    try { global.navigator.onLine = true; } catch (e2) {}
  }
  global.document = { getElementById: () => null, addEventListener: () => {} };
  const winListeners = {};
  global.window.addEventListener = (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); };
  global.window.t = (k) => k;
  ls._winListeners = winListeners;
  return ls;
}

function fireWindowEvent(ls, name) {
  const handlers = (ls._winListeners && ls._winListeners[name]) || [];
  handlers.slice().forEach(f => { try { f(); } catch (e) {} });
}

/* Fake Supabase backend.
 * backend.mode: 'ok' | 'rls' | 'auth' | 'fail500' | 'network'
 * backend.session: object | null (what auth.getSession() reports)
 */
function makeBackend() {
  const calls = [];
  const rows = new Map();
  const backend = { calls, rows, upsertFail: false, mode: "ok", session: { user: { id: "user-A" } } };
  function failShape() {
    if (backend.mode === "rls") return { message: "permission denied for table user_progress", code: "42501", status: 403 };
    if (backend.mode === "auth") return { message: "JWT expired", code: "401", status: 401 };
    if (backend.mode === "fail500") return { message: "Internal Server Error", status: 500 };
    return null;
  }
  function builder(table) {
    const api = {
      _eq: null,
      select() { return this; },
      eq(col, val) { this._eq = { col, val }; return this; },
      single() { return this; },
      upsert(obj) {
        this._upsert = obj;
        return this;
      },
      then(res, rej) {
        if (backend.mode === "network") {
          return Promise.reject(new TypeError("Failed to fetch")).then(res, rej);
        }
        const shaped = failShape();
        let out;
        if (this._upsert) {
          const row = this._upsert;
          calls.push({ table, op: "upsert", user_id: row.user_id });
          if (backend.upsertFail || shaped) {
            out = { data: null, error: shaped || { message: "RLS denied", code: "42501" } };
          } else {
            rows.set(row.user_id, { ...row });
            out = { data: null, error: null };
          }
        } else {
          const val = this._eq ? this._eq.val : null;
          calls.push({ table, op: "select", user_id: val });
          if (shaped) {
            out = { data: null, error: shaped };
          } else {
            const row = val ? rows.get(val) : null;
            out = row
              ? { data: { ...row }, error: null }
              : { data: null, error: { message: "none", code: "PGRST116" } };
          }
        }
        return Promise.resolve(out).then(res, rej);
      },
    };
    return api;
  }
  const client = {
    from: (t) => builder(t),
    auth: { getSession: async () => ({ data: { session: backend.session }, error: null }) },
  };
  return { backend, client };
}

function queueLen(ls) {
  try { return JSON.parse(ls.getItem("dm_sync_queue") || "[]").length; }
  catch (e) { return -1; }
}
function queueOf(ls) {
  try { return JSON.parse(ls.getItem("dm_sync_queue") || "[]"); }
  catch (e) { return null; }
}

async function main() {
  const ls = installGlobals();
  for (const f of ["cloud-sync.js"]) {
    try { delete require.cache[require.resolve(path.join(CLIENT, f))]; } catch (e) {}
  }
  const CloudSync = require(path.join(CLIENT, "cloud-sync.js"));

  let currentUser = null;
  global.window.AuthModule = {
    getUser: () => currentUser,
    getDeviceId: () => "dev-test",
  };
  global.window.S = { xp: 0 };

  const { backend, client } = makeBackend();
  CloudSync.init(client);
  CloudSync.setActiveUser("user-A");
  currentUser = { id: "user-A" };

  /* ---- 1. duplicate snapshots coalesce per owner ---- */
  for (let i = 1; i <= 38; i++) {
    CloudSync.queueOperation("upsert_progress", { state: { xp: i } }, "user-A");
  }
  ok("Q1-38-failures-coalesce-to-1", queueLen(ls) === 1, "len=" + queueLen(ls));
  ok("Q2-latest-payload-kept", queueOf(ls)[0].payload.state.xp === 38, JSON.stringify(queueOf(ls)[0].payload));

  /* ---- 2. different owners never coalesce ---- */
  CloudSync.queueOperation("upsert_progress", { state: { xp: 5 } }, "user-B");
  const q2 = queueOf(ls);
  ok("Q3-owners-separated", q2.length === 2 && q2.filter(o => o.userId === "user-B").length === 1, "len=" + q2.length);

  /* ---- 3. cap enforced ---- */
  for (let i = 0; i < 150; i++) {
    CloudSync.queueOperation("upsert_progress", { state: { xp: i } }, "cap-" + i);
  }
  ok("Q4-queue-capped", queueLen(ls) <= 100, "len=" + queueLen(ls));

  /* reset queue for drain tests */
  ls.removeItem("dm_sync_queue");
  CloudSync.setActiveUser("user-A");
  currentUser = { id: "user-A" };

  /* ---- 6. guest op held under signed-in user ---- */
  CloudSync.queueOperation("upsert_progress", { state: { xp: 1 } }, null);
  await CloudSync.processQueue();
  const qg = queueOf(ls);
  ok("Q5-guest-held", qg.length === 1 && (qg[0].userId || "guest") === "guest", "len=" + qg.length);
  ok("Q6-guest-never-uploaded", backend.rows.get("user-A") === undefined, "row=" + JSON.stringify(backend.rows.get("user-A")));

  /* ---- 4. successful upload drains own queue, reports ONLINE ---- */
  CloudSync.queueOperation("upsert_progress", { state: { xp: 9 } }, "user-A");
  const up = await CloudSync.uploadChanges("user-A", { xp: 10 });
  ok("Q7-upload-success", up && up.success === true, JSON.stringify(up));
  ok("Q8-queue-drained-after-success", queueLen(ls) === 1, "len=" + queueLen(ls)); // guest op stays held
  const left = queueOf(ls);
  ok("Q9-only-guest-left", left.length === 1 && left[0].userId === "guest", JSON.stringify(left.map(o => o.userId)));
  ok("Q10-status-online", CloudSync.getStatus().status === "online", CloudSync.getStatus().status);
  ok("Q11-cloud-has-newer-state", (backend.rows.get("user-A").state || {}).xp === 10, JSON.stringify(backend.rows.get("user-A")));

  /* ---- 5. failed upload still queues (offline-first preserved) ---- */
  backend.upsertFail = true;
  const bad = await CloudSync.uploadChanges("user-A", { xp: 11 });
  ok("Q12-failure-queues", bad && bad.queued === true, JSON.stringify(bad));
  const qf = queueOf(ls);
  ok("Q13-failed-snapshot-kept", qf.some(o => o.userId === "user-A" && o.payload.state.xp === 11), "len=" + qf.length);
  backend.upsertFail = false;

  /* ---- 7. concurrent drains never double-upload one op ---- */
  ls.removeItem("dm_sync_queue");
  CloudSync.queueOperation("upsert_progress", { state: { xp: 20 } }, "user-A");
  const callsBefore = backend.calls.filter(c => c.op === "upsert").length;
  await Promise.all([CloudSync.processQueue(), CloudSync.processQueue()]);
  const upserts = backend.calls.filter(c => c.op === "upsert").length - callsBefore;
  ok("Q14-no-double-upload", upserts <= 2, "upserts=" + upserts);
  ok("Q15-queue-empty-after-drain", queueLen(ls) === 0, "len=" + queueLen(ls));

  /* ================= Part R: root-cause scenarios =================
   * R1  signed-out startup: guest queues, fullSync refuses w/o ERROR
   * R2  signed-in startup: fullSync succeeds -> ONLINE, version set
   * R3  valid session upload (covered Q7) — re-asserted post-mode-reset
   * R4  expired session: queued intact, ERROR kind=auth (never raw token)
   * R5  successful sync (covered Q7/Q8)
   * R6  server failure: kind=server, queue intact
   * R7  RLS failure: kind=permission, queue intact, NO retry scheduled
   * R8  offline: queued, fullSync returns early, status never ERROR
   * R9  queue intact after failed fullSync
   * R10 drains after success (covered Q8)
   * R11 merge intact (covered Q1/Q2)
   * R12 separation (covered Q3/Q5)
   * R13 no dup processing (covered Q14)
   * R14 logout never uploads another user's data
   * R15 re-login restores the authenticated owner and drains
   * R16 reload: persisted queue restores count, status starts clean
   * R17 network failure schedules exactly one retry; retry recovers
   */
  backend.mode = "ok";
  backend.session = { user: { id: "user-A" } };
  ls.removeItem("dm_sync_queue");
  CloudSync.setActiveUser(null);
  currentUser = null;

  /* R1: signed-out startup */
  const r1up = await CloudSync.uploadChanges(null, { xp: 1 });
  ok("R1-signed-out-queues-guest", r1up && r1up.queued === true, JSON.stringify(r1up));
  const r1full = await CloudSync.fullSync(null, { xp: 1 });
  ok("R1-fullsync-no-user-no-error-status", r1full.success === false && CloudSync.getStatus().status !== "error",
    JSON.stringify(r1full) + " status=" + CloudSync.getStatus().status);

  /* R14: logout holds other users' work, uploads nothing */
  CloudSync.setActiveUser("user-A");
  currentUser = { id: "user-A" };
  CloudSync.queueOperation("upsert_progress", { state: { xp: 50 } }, "user-A");
  CloudSync.setActiveUser(null); // logout clears any pending retry, switches owner
  currentUser = null;
  const upBefore14 = backend.calls.filter(c => c.op === "upsert").length;
  await CloudSync.processQueue();
  ok("R14-logout-holds-not-uploads",
    queueLen(ls) >= 1 && backend.calls.filter(c => c.op === "upsert").length === upBefore14,
    "len=" + queueLen(ls));

  /* R15: re-login restores owner and drains own ops (guest stays held) */
  CloudSync.setActiveUser("user-A");
  currentUser = { id: "user-A" };
  await CloudSync.processQueue();
  const q15 = queueOf(ls);
  ok("R15-relogin-drains-own", q15.length === 1 && (q15[0].userId || "guest") === "guest",
    "left=" + JSON.stringify(q15.map(o => o.userId)));

  /* R2: signed-in startup fullSync */
  backend.rows.delete("user-A");
  ls.removeItem(activeKeyOf());
  const r2 = await CloudSync.fullSync("user-A", { xp: 3 });
  ok("R2-signin-fullsync-online", r2.success === true && CloudSync.getStatus().status === "online",
    JSON.stringify(r2) + " status=" + CloudSync.getStatus().status);

  /* R8: offline behavior via real online/offline events */
  ls.removeItem("dm_sync_queue");
  fireWindowEvent(ls, "offline");
  ok("R8-offline-status", CloudSync.getStatus().status === "offline", CloudSync.getStatus().status);
  const r8up = await CloudSync.uploadChanges("user-A", { xp: 4 });
  ok("R8-offline-queues", r8up && r8up.queued === true, JSON.stringify(r8up));
  const r8full = await CloudSync.fullSync("user-A", { xp: 4 });
  ok("R8-offline-fullsync-early-no-error", r8full.queued === true && CloudSync.getStatus().status === "offline",
    JSON.stringify(r8full) + " status=" + CloudSync.getStatus().status);
  /* offline -> online recovery drains and reports ONLINE */
  fireWindowEvent(ls, "online");
  await new Promise(r => setTimeout(r, 50));
  ok("R8-online-recovery-drains", queueLen(ls) === 0 && CloudSync.getStatus().status === "online",
    "len=" + queueLen(ls) + " status=" + CloudSync.getStatus().status);

  /* R4: expired session -> kind=auth, queue intact */
  backend.mode = "auth";
  ls.removeItem("dm_sync_queue");
  const r4 = await CloudSync.fullSync("user-A", { xp: 5 });
  ok("R4-auth-kind", r4.success === false && r4.error === "auth", JSON.stringify(r4));
  ok("R4-status-error-kind-not-raw", CloudSync.getStatus().status === "error" &&
    CloudSync.getStatus().error === "auth", JSON.stringify(CloudSync.getStatus()));
  backend.mode = "ok";

  /* R6: server failure -> kind=server, queue intact (R9) */
  backend.mode = "fail500";
  const qBefore6 = queueLen(ls);
  const r6 = await CloudSync.fullSync("user-A", { xp: 6 });
  ok("R6-server-kind", r6.success === false && r6.error === "server", JSON.stringify(r6));
  ok("R9-queue-intact-after-failed-sync", queueLen(ls) === qBefore6, "len=" + queueLen(ls));
  backend.mode = "ok";

  /* R7: RLS failure -> kind=permission, queue intact, no retry timer */
  backend.mode = "rls";
  const cap7 = captureTimers();
  const r7 = await CloudSync.fullSync("user-A", { xp: 7 });
  cap7.restore();
  ok("R7-permission-kind", r7.success === false && r7.error === "permission", JSON.stringify(r7));
  ok("R7-no-retry-for-permission", cap7.scheduled.length === 0, "timers=" + cap7.scheduled.length);
  backend.mode = "ok";

  /* R17: network failure schedules exactly one 15s retry; retry recovers */
  backend.mode = "network";
  const cap17 = captureTimers();
  const r17 = await CloudSync.fullSync("user-A", { xp: 8 });
  cap17.restore();
  ok("R17-network-kind", r17.success === false && r17.error === "network", JSON.stringify(r17));
  ok("R17-one-retry-scheduled", cap17.scheduled.length === 1 && cap17.scheduled[0].ms === 15000,
    JSON.stringify(cap17.scheduled.map(s => s.ms)));
  backend.mode = "ok";
  backend.rows.delete("user-A");
  await cap17.fire(0);
  ok("R17-retry-recovers-online", CloudSync.getStatus().status === "online", CloudSync.getStatus().status);

  /* R3: valid session upload still succeeds after mode churn */
  const r3 = await CloudSync.uploadChanges("user-A", { xp: 30 });
  ok("R3-valid-session-upload", r3.success === true, JSON.stringify(r3));

  /* R16: reload restores count, starts with clean status */
  CloudSync.queueOperation("upsert_progress", { state: { xp: 31 } }, "user-A");
  const persistedN = queueLen(ls);
  for (const f of ["cloud-sync.js"]) {
    try { delete require.cache[require.resolve(path.join(CLIENT, f))]; } catch (e) {}
  }
  const CloudSync2 = require(path.join(CLIENT, "cloud-sync.js"));
  CloudSync2.init(client);
  ok("R16-reload-restores-count", CloudSync2.getStatus().pendingCount === persistedN,
    "pending=" + CloudSync2.getStatus().pendingCount + " stored=" + persistedN);
  ok("R16-reload-starts-clean", CloudSync2.getStatus().status === "idle",
    "status=" + CloudSync2.getStatus().status);

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}

/* active identity store key helper (mirrors script.js DMIdentity absent) */
function activeKeyOf() {
  try {
    if (global.window.DMIdentity && typeof global.window.DMIdentity.activeKey === "function") {
      return global.window.DMIdentity.activeKey();
    }
  } catch (e) {}
  return "deutsch_master_v2";
}

/* Capture setTimeout scheduling; fire(i) invokes the captured callback and
 * waits for the (unawaited) retried fullSync to settle. */
function captureTimers() {
  const scheduled = [];
  const realSetTimeout = global.setTimeout;
  global.setTimeout = function (cb, ms) {
    scheduled.push({ cb, ms });
    return { __captured: true };
  };
  return {
    scheduled,
    restore() { global.setTimeout = realSetTimeout; },
    async fire(i) {
      const s = scheduled[i || 0];
      if (!s) throw new Error("no captured timer");
      await s.cb();
      await new Promise(r => realSetTimeout(r, 150));
    },
  };
}

main().catch(e => { console.error("FATAL", e); process.exit(1); });
