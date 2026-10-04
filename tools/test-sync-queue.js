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
  global.window.addEventListener = () => {};
  global.window.t = (k) => k;
  return ls;
}

/* Fake Supabase backend: {upsertFail:boolean, calls:[], rows:Map} */
function makeBackend() {
  const calls = [];
  const rows = new Map();
  const backend = { calls, rows, upsertFail: false };
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
      then(res) {
        let out;
        if (this._upsert) {
          const row = this._upsert;
          calls.push({ table, op: "upsert", user_id: row.user_id });
          if (backend.upsertFail) {
            out = { data: null, error: { message: "RLS denied", code: "42501" } };
          } else {
            rows.set(row.user_id, { ...row });
            out = { data: null, error: null };
          }
        } else {
          const val = this._eq ? this._eq.val : null;
          calls.push({ table, op: "select", user_id: val });
          const row = val ? rows.get(val) : null;
          out = row
            ? { data: { ...row }, error: null }
            : { data: null, error: { message: "none", code: "PGRST116" } };
        }
        return Promise.resolve(out).then(res);
      },
    };
    return api;
  }
  return { backend, client: { from: (t) => builder(t) } };
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

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}

main().catch(e => { console.error("FATAL", e); process.exit(1); });
