/* Deutsch Master - no-op sync-merge render regression tests.
 * Proves, against the REAL client/cloud-sync.js with a fake backend, the
 * partial-restart fix: a sync merge that leaves observable state identical
 * must persist WITHOUT a blanket renderAll (which clears and rebuilds every
 * visited section — the confirmed disappear/reappear mechanism), while a
 * merge that really changes data must still refresh the UI exactly once.
 *  R1 identical fullSync (login/retry/no-change syncNow) -> 0 renders, still saves
 *  R2 cloud-newer uploadChanges -> 1 render, live state updated
 *  R3 identical downloadState -> 0 renders, still saves
 *  R4 differing fullSync -> 1 render
 *  R5 merge differing only in preserved local-only fields -> 0 renders, fields kept
 *  R6 unserializable merged state -> falls through to render (freshness never lost)
 *  R7 www/ generated copy carries the same guard (client + www stay consistent)
 * Usage: node tools/test-sync-render.js  (exit 0 = PASS, 1 = FAIL)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
function installGlobals() {
  const ls = makeLocalStorage();
  global.window = {};
  global.localStorage = ls;
  global.window.localStorage = ls;
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true, userAgent: "node-test" }, configurable: true, writable: true,
    });
  } catch (e) {}
  global.document = { getElementById: () => null, addEventListener: () => {} };
  global.window.addEventListener = () => {};
  global.window.t = (k) => k;
  return ls;
}
/* Fake Supabase backend: rows map user_id -> {state, version}. */
function makeBackend() {
  const rows = new Map();
  const backend = { rows, session: { user: { id: "user-A" } } };
  function builder() {
    const api = {
      _eq: null, _upsert: null,
      select() { return this; },
      eq(col, val) { this._eq = { col, val }; return this; },
      single() { return this; },
      upsert(obj) { this._upsert = obj; return this; },
      then(res, rej) {
        let out;
        if (this._upsert) {
          rows.set(this._upsert.user_id, { ...this._upsert });
          out = { data: null, error: null };
        } else {
          const row = this._eq ? rows.get(this._eq.val) : null;
          out = row
            ? { data: { state: row.state, version: row.version }, error: null }
            : { data: null, error: { message: "none", code: "PGRST116" } };
        }
        return Promise.resolve(out).then(res, rej);
      },
    };
    return api;
  }
  const client = {
    from: () => builder(),
    auth: { getSession: async () => ({ data: { session: backend.session }, error: null }) },
  };
  return { backend, client };
}
/* Production-shaped state: live S always carries the full normalized shape
 * (script.js defaultState/normalizeState), so counters exist on both sides. */
function fullState(over) {
  return {
    xp: 5, totalAnswered: 10, totalCorrect: 8, testsTaken: 2,
    fixedTotal: 1, bestPct: 80, maxCombo: 4, evSeq: 3,
    ...(over || {}),
  };
}

async function main() {
  const ls = installGlobals();
  try { delete require.cache[require.resolve(path.join(CLIENT, "cloud-sync.js"))]; } catch (e) {}
  const CloudSync = require(path.join(CLIENT, "cloud-sync.js"));
  const currentUser = { id: "user-A" };
  global.window.AuthModule = { getUser: () => currentUser, getDeviceId: () => "dev-test" };
  let live = fullState();
  Object.defineProperty(global.window, "S", { configurable: true, get: () => live, set: (v) => { live = v; } });
  let renders = 0, saves = 0;
  global.window.renderAll = () => { renders++; };
  global.window.save = () => { saves++; return true; };

  const { backend, client } = makeBackend();
  CloudSync.init(client);
  CloudSync.setActiveUser("user-A");

  /* R1: identical fullSync -> success, saved, version advanced, ZERO renders */
  ls.setItem("deutsch_master_v2", JSON.stringify({ ...fullState(), _syncVersion: 3 }));
  backend.rows.set("user-A", { state: { ...fullState() }, version: 3 });
  renders = 0; saves = 0;
  const r1 = await CloudSync.fullSync("user-A", { ...fullState() });
  ok("R1-identical-fullSync-success", !!(r1 && r1.success), JSON.stringify(r1));
  ok("R1-identical-fullSync-still-saves", saves >= 1, "saves=" + saves);
  ok("R1-identical-fullSync-no-render", renders === 0, "renders=" + renders);

  /* R2: cloud-newer upload -> renders once, live state updated */
  ls.setItem("deutsch_master_v2", JSON.stringify({ ...fullState(), _syncVersion: 4 }));
  backend.rows.set("user-A", { state: { ...fullState({ xp: 99 }) }, version: 5 });
  renders = 0; saves = 0;
  const r2 = await CloudSync.uploadChanges("user-A", { ...fullState() });
  ok("R2-cloud-newer-upload-success", !!(r2 && r2.success), JSON.stringify(r2));
  ok("R2-cloud-newer-upload-renders-once", renders === 1, "renders=" + renders);
  ok("R2-cloud-newer-live-updated", live.xp === 99, "live.xp=" + live.xp);

  /* R3: identical downloadState -> ZERO renders, still saves */
  live = { ...fullState({ xp: 99 }) };
  renders = 0; saves = 0;
  const r3 = await CloudSync.downloadState("user-A");
  ok("R3-identical-download-success", !!(r3 && r3.success), JSON.stringify(r3));
  ok("R3-identical-download-no-render", renders === 0, "renders=" + renders);
  ok("R3-identical-download-still-saves", saves >= 1, "saves=" + saves);

  /* R4: differing fullSync -> renders once */
  ls.setItem("deutsch_master_v2", JSON.stringify({ ...fullState({ xp: 99 }), _syncVersion: 6 }));
  backend.rows.set("user-A", { state: { ...fullState({ xp: 100 }) }, version: 6 });
  live = { ...fullState({ xp: 99 }) };
  renders = 0; saves = 0;
  const r4 = await CloudSync.fullSync("user-A", { ...fullState({ xp: 99 }) });
  ok("R4-differing-fullSync-success", !!(r4 && r4.success), JSON.stringify(r4));
  ok("R4-differing-fullSync-renders-once", renders === 1, "renders=" + renders);

  /* R5: cloud differs ONLY in preserved local-only fields -> no render, kept */
  live = { ...fullState({ xp: 100 }), uiLang: "de", flashDir: "ar-de", notifRead: 7 };
  ls.setItem("deutsch_master_v2", JSON.stringify({ ...live, _syncVersion: 7 }));
  backend.rows.set("user-A", { state: { ...fullState({ xp: 100 }), uiLang: "ar", flashDir: "de-ar" }, version: 7 });
  renders = 0;
  const r5 = await CloudSync.fullSync("user-A", { ...live });
  ok("R5-preserved-only-success", !!(r5 && r5.success), JSON.stringify(r5));
  ok("R5-preserved-only-no-render", renders === 0, "renders=" + renders);
  ok("R5-preserved-fields-kept", live.uiLang === "de" && live.flashDir === "ar-de" && live.notifRead === 7,
    "uiLang=" + live.uiLang + " flashDir=" + live.flashDir);

  /* R6: unserializable merged state -> safe fallback renders (never stale) */
  const circ = { ...fullState({ xp: 101 }) };
  circ.self = circ;
  backend.rows.set("user-A", { state: circ, version: 9 });
  live = { ...fullState({ xp: 100 }) };
  renders = 0;
  const r6 = await CloudSync.downloadState("user-A");
  ok("R6-circular-download-success", !!(r6 && r6.success), JSON.stringify(r6 && { success: r6.success }));
  ok("R6-circular-falls-through-to-render", renders === 1, "renders=" + renders);

  /* R7: www/ generated copy carries the same guard */
  let cSrc = "", wSrc = "";
  try { cSrc = fs.readFileSync(path.join(ROOT, "client", "cloud-sync.js"), "utf8"); } catch (e) {}
  try { wSrc = fs.readFileSync(path.join(ROOT, "www", "cloud-sync.js"), "utf8"); } catch (e) {}
  ok("R7-client-has-noop-guard", cSrc.indexOf("Merge left state unchanged") >= 0);
  ok("R7-www-has-noop-guard", wSrc.indexOf("Merge left state unchanged") >= 0);
  ok("R7-client-www-in-sync", cSrc === wSrc, "client=" + cSrc.length + " www=" + wSrc.length);

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
}
main().catch((e) => { console.log("FAIL harness: " + (e && (e.stack || e.message) || e)); process.exit(1); });
