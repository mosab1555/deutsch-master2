/* Deutsch Master - reference progress identity-isolation regression tests.
 *
 * Drives the REAL client/reference.js progress/bookmark engine (refProg /
 * refProgSave / refRecordOpen / refRecordQuiz / refToggleSave / refIsSaved /
 * refMastery) inside a vm sandbox with a Map-backed localStorage and the REAL
 * identity contract (window.DMIdentity.activeUid(), the API script.js
 * exposes). No DOM, no browser, no network, no timing sleeps.
 *
 * Proves C4: guest and per-account reference progress never cross namespaces,
 * identity switches reload the in-memory cache, and the pre-C4 global key
 * (deutsch_master_ref_v1) migrates once into the guest namespace only - never
 * into an authenticated account and never overwriting newer namespaced data.
 *
 * Usage: node tools/test-ref-identity.js  (exit 0 = PASS, 1 = FAIL)
 */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
/* DM_REF_SRC lets the same suite run against a pre-fix baseline copy
   (e.g. `git show HEAD:client/reference.js`) without touching the repo;
   default is the real client/reference.js under test. */
const SRC = fs.readFileSync(process.env.DM_REF_SRC ? path.resolve(process.env.DM_REF_SRC) : path.join(root, "client", "reference.js"), "utf8");

let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

/* storage contract under test (mirrors dmStateKey conventions in script.js) */
const LEGACY = "deutsch_master_ref_v1";
const GUEST = LEGACY + ":guest";
const acc = u => LEGACY + ":uid:" + u;

function makeLS(map) {
  const m = map || new Map();
  return {
    _m: m,
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
  };
}
function payload(over) {
  return JSON.stringify(Object.assign({ v: 1, opened: {}, best: {}, saved: [], recent: [] }, over || {}));
}
/* One page load: fresh vm context + reference.js, shared localStorage.
   __setUid() simulates an identity switch in the same page (what
   DMIdentity.activate does to window.DMIdentity.activeUid()).
   identity: undefined = working DMIdentity; null = DMIdentity absent;
   object = replacement oracle (e.g. activeUid() throws, returns ""). */
function boot(store, uid, identity) {
  let _uid = uid || null;
  const sb = {
    console, Date, Math, JSON, setTimeout, clearTimeout,
    I18N: { ar: {}, en: {}, de: {} },
    localStorage: store,
    document: { getElementById() { return null; }, querySelectorAll() { return []; }, addEventListener() {} },
    DMIdentity: identity === undefined ? { activeUid: () => _uid, stateKey: u => (u ? ("deutsch_master_v2:uid:" + u) : "deutsch_master_v2") } : identity,
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(SRC, sb, { filename: "client/reference.js" });
  sb.__setUid = u => { _uid = u || null; };
  sb.__setIdentity = obj => { sb.DMIdentity = obj; };
  return sb;
}
/* localStorage whose setItem fails until recover() - quota/read-only storage. */
function makeFlakyLS(map) {
  const m = map || new Map(), back = makeLS(m);
  const w = {
    _m: m, _fail: true,
    getItem: k => back.getItem(k),
    setItem: (k, v) => { if (w._fail) throw new Error("QuotaExceededError"); back.setItem(k, v); },
    removeItem: k => back.removeItem(k),
  };
  return w;
}
function savedIds(sb) { try { return sb.refProg().saved.join(",") || "(none)"; } catch (e) { return "ERR:" + e.message; } }
function openIds(sb) { try { return Object.keys(sb.refProg().opened).join(",") || "(none)"; } catch (e) { return "ERR:" + e.message; } }

/* H0: harness sanity - engine loads and exposes the progress API */
{
  let sb = null, err = "";
  try { sb = boot(makeLS(), null); } catch (e) { err = e.message; }
  ok("H0 engine-loads-with-progress-api",
    !err && sb && ["refProg", "refProgSave", "refRecordOpen", "refRecordQuiz", "refToggleSave", "refIsSaved", "refMastery"].every(f => typeof sb[f] === "function"),
    err || "missing function");
}

/* G1: guest progress uses the guest key and survives reload */
{
  const s = makeLS(), sb = boot(s, null);
  sb.refRecordQuiz("a-alphabet", 4, 5);
  sb.refToggleSave("a-alphabet");
  sb.refRecordOpen("a-wortarten");
  ok("G1a guest-writes-guest-key-legacy-untouched",
    s.getItem(GUEST) !== null && s.getItem(LEGACY) === null,
    "guest=" + (s.getItem(GUEST) !== null) + " legacy=" + (s.getItem(LEGACY) !== null));
  const sb2 = boot(s, null); // reload, same device
  ok("G1b guest-progress-survives-reload",
    sb2.refIsSaved("a-alphabet") && sb2.refMastery("a-alphabet") === 80 && !!sb2.refProg().opened["a-wortarten"],
    "saved=" + savedIds(sb2) + " m=" + sb2.refMastery("a-alphabet") + " opened=" + openIds(sb2));
}

/* G2: account A writes only to its own key; B cannot see it */
{
  const s = makeLS(), sb = boot(s, null);
  sb.__setUid("uid-A");
  sb.refRecordQuiz("b-nomen-genus", 5, 5);
  sb.refToggleSave("b-nomen-genus");
  ok("G2a account-writes-own-key-only",
    s.getItem(acc("uid-A")) !== null && s.getItem(LEGACY) === null && s.getItem(GUEST) === null,
    "A=" + (s.getItem(acc("uid-A")) !== null) + " legacy=" + (s.getItem(LEGACY) !== null) + " guest=" + (s.getItem(GUEST) !== null));
  sb.__setUid("uid-B");
  ok("G2b B-cannot-see-A",
    !sb.refIsSaved("b-nomen-genus") && sb.refMastery("b-nomen-genus") === -1 && sb.refProg().saved.length === 0 && sb.refProg().best["b-nomen-genus"] === undefined,
    "saved=" + savedIds(sb) + " m=" + sb.refMastery("b-nomen-genus"));
  ok("G2c B-key-absent-until-B-writes", s.getItem(acc("uid-B")) === null);
}

/* G3: B writing its own progress cannot change A's stored data */
{
  const s = makeLS(), sb = boot(s, null);
  sb.__setUid("uid-A"); sb.refRecordQuiz("c-personal", 3, 3); sb.refToggleSave("c-personal");
  const aBytes = s.getItem(acc("uid-A"));
  sb.__setUid("uid-B"); sb.refRecordQuiz("d-dativ", 2, 4); sb.refToggleSave("d-dativ");
  const bBytes = s.getItem(acc("uid-B"));
  sb.__setUid("uid-A");
  ok("G3a A-restored-after-B-session",
    sb.refIsSaved("c-personal") && sb.refMastery("c-personal") === 100, "saved=" + savedIds(sb));
  ok("G3b B-progress-invisible-in-A",
    !sb.refIsSaved("d-dativ") && sb.refMastery("d-dativ") === -1, "saved=" + savedIds(sb));
  ok("G3c A-key-bytes-unchanged-by-B-writes", aBytes !== null && s.getItem(acc("uid-A")) === aBytes);
  ok("G3d B-key-bytes-intact", bBytes !== null && s.getItem(acc("uid-B")) === bBytes);
}

/* G4: logout restores guest progress, never A's */
{
  const s = makeLS(), sb = boot(s, null);
  sb.refRecordQuiz("e-grundlagen", 4, 4); sb.refToggleSave("e-grundlagen");
  const guestBytes = s.getItem(GUEST);
  sb.__setUid("uid-A"); sb.refRecordQuiz("f-grundlagen", 1, 1); sb.refToggleSave("f-grundlagen");
  sb.__setUid(null); // sign out
  ok("G4a logout-restores-guest-progress",
    sb.refIsSaved("e-grundlagen") && sb.refMastery("e-grundlagen") === 100, "saved=" + savedIds(sb));
  ok("G4b A-progress-not-visible-in-guest",
    !sb.refIsSaved("f-grundlagen") && sb.refMastery("f-grundlagen") === -1, "saved=" + savedIds(sb));
  ok("G4c guest-key-bytes-unchanged-by-account-session", guestBytes !== null && s.getItem(GUEST) === guestBytes);
}

/* G5: returning to an identity restores exactly its own saved progress */
{
  const s = makeLS(), sb = boot(s, null);
  sb.refRecordQuiz("e-grundlagen", 4, 4); sb.refToggleSave("e-grundlagen");
  sb.__setUid("uid-A"); sb.refToggleSave("f-grundlagen");
  sb.__setUid("uid-B"); sb.refToggleSave("g-praesens");
  sb.__setUid("uid-A");
  ok("G5a returning-to-A-restores-only-A",
    sb.refIsSaved("f-grundlagen") && !sb.refIsSaved("e-grundlagen") && !sb.refIsSaved("g-praesens"),
    "saved=" + savedIds(sb));
  sb.__setUid(null);
  ok("G5b returning-to-guest-restores-only-guest",
    sb.refIsSaved("e-grundlagen") && !sb.refIsSaved("f-grundlagen") && !sb.refIsSaved("g-praesens"),
    "saved=" + savedIds(sb));
}

/* G6: legacy global key migrates once into the guest namespace */
{
  const legacyBytes = payload({ opened: { "a-alphabet": 111 }, saved: ["a-alphabet"], recent: ["a-alphabet"] });
  const s = makeLS(); s.setItem(LEGACY, legacyBytes);
  const sb = boot(s, null);
  const P = sb.refProg();
  ok("G6a guest-sees-legacy-progress-after-migration",
    sb.refIsSaved("a-alphabet") && P.opened["a-alphabet"] === 111, "saved=" + savedIds(sb));
  ok("G6b legacy-bytes-copied-verbatim-to-guest-key", s.getItem(GUEST) === legacyBytes,
    "guest=" + (s.getItem(GUEST) !== null));
  ok("G6c legacy-key-removed-after-preservation", s.getItem(LEGACY) === null);
  const sb2 = boot(s, null); // next visit / reload
  ok("G6d migration-repeat-safe", sb2.refIsSaved("a-alphabet") && s.getItem(LEGACY) === null && s.getItem(GUEST) === legacyBytes);
}

/* G7: migration never overwrites newer data and never reaches an account */
{
  const s = makeLS();
  s.setItem(GUEST, payload({ saved: ["guest-new"] }));
  s.setItem(LEGACY, payload({ saved: ["legacy-old"] }));
  const sb = boot(s, null);
  ok("G7a legacy-never-overwrites-newer-guest-data",
    sb.refIsSaved("guest-new") && !sb.refIsSaved("legacy-old"), "saved=" + savedIds(sb));
  ok("G7b guest-key-bytes-unchanged", JSON.parse(s.getItem(GUEST)).saved.join(",") === "guest-new");
}
{
  const s = makeLS();
  s.setItem(LEGACY, payload({ saved: ["legacy-topic"] }));
  s.setItem(acc("uid-A"), payload({ saved: ["a-topic"] }));
  const aBytes = s.getItem(acc("uid-A"));
  const sb = boot(s, "uid-A");
  ok("G7c active-account-sees-only-its-own-state",
    sb.refIsSaved("a-topic") && !sb.refIsSaved("legacy-topic"), "saved=" + savedIds(sb));
  ok("G7d account-key-bytes-intact-during-legacy-presence", s.getItem(acc("uid-A")) === aBytes);
  sb.__setUid(null); // sign out
  ok("G7e signout-guest-gets-legacy-account-stays-untouched",
    sb.refIsSaved("legacy-topic") && !sb.refIsSaved("a-topic") && s.getItem(acc("uid-A")) === aBytes,
    "saved=" + savedIds(sb));
}
{
  const s = makeLS();
  s.setItem(LEGACY, payload({ saved: ["legacy-topic"] }));
  const sb = boot(s, "uid-B");
  ok("G7f brand-new-account-never-sees-legacy",
    !sb.refIsSaved("legacy-topic") && sb.refProg().saved.length === 0, "saved=" + savedIds(sb));
  ok("G7g no-account-key-created-for-legacy", s.getItem(acc("uid-B")) === null);
}

/* G8: the in-memory cache is invalidated/reloaded on identity change */
{
  const s = makeLS(), sb = boot(s, null);
  sb.__setUid("uid-A"); sb.refToggleSave("h-akkusativ");
  const c1 = sb.refProg();
  ok("G8a stable-identity-keeps-one-cache-object", sb.refProg() === c1);
  sb.__setUid(null);
  const c2 = sb.refProg();
  ok("G8b identity-switch-invalidates-cache",
    c2 !== c1 && !sb.refIsSaved("h-akkusativ"), "sameObj=" + (c2 === c1) + " saved=" + savedIds(sb));
  sb.__setUid("uid-A");
  const c3 = sb.refProg();
  ok("G8c returning-identity-reloads-from-own-key",
    c3 !== c2 && sb.refIsSaved("h-akkusativ"), "sameObj=" + (c3 === c2) + " saved=" + savedIds(sb));
}

/* M1: legacy migrates into the guest namespace even while an account is
   active at startup; the active account is never touched by the migration. */
{
  const legacyBytes = payload({ saved: ["legacy-topic"], recent: ["legacy-topic"] });
  const s = makeLS();
  s.setItem(LEGACY, legacyBytes);
  s.setItem(acc("uid-A"), payload({ saved: ["a-topic"] }));
  const aBytes = s.getItem(acc("uid-A"));
  const sb = boot(s, "uid-A");
  const P = sb.refProg(); // migration must run on first access, signed in or not
  ok("M1a active-account-unaffected-by-legacy-migration",
    sb.refIsSaved("a-topic") && !sb.refIsSaved("legacy-topic"), "saved=" + savedIds(sb));
  ok("M1b legacy-copied-to-guest-while-signed-in", s.getItem(GUEST) === legacyBytes,
    "guest=" + (s.getItem(GUEST) !== null));
  ok("M1c legacy-key-removed-while-signed-in", s.getItem(LEGACY) === null);
  ok("M1d account-key-bytes-untouched", s.getItem(acc("uid-A")) === aBytes);
  ok("M1e no-second-account-namespace-created",
    s.getItem(acc("uid-B")) === null && Array.from(s._m.keys()).filter(k => String(k).indexOf(":uid:") >= 0).length === 1,
    Array.from(s._m.keys()).join(","));
  sb.__setUid(null); // sign out: migrated legacy must now appear as guest
  ok("M1f signout-exposes-migrated-legacy-to-guest-only",
    sb.refIsSaved("legacy-topic") && !sb.refIsSaved("a-topic"), "saved=" + savedIds(sb));
  ok("M1g same-identity-cache-stable-across-migration", sb.refProg() === sb.refProg());
}

/* M2: failed migration (quota/read-only) keeps the only copy AND keeps it
   visible to the guest; a later successful run finishes the migration. */
{
  const legacyBytes = payload({ saved: ["legacy-topic"] });
  const s = makeLS();
  s.setItem(LEGACY, legacyBytes);
  const flaky = makeFlakyLS(s._m);
  const sb = boot(flaky, null);
  const P = sb.refProg(); // copy to guest throws -> fail safe
  ok("M2a failed-migration-still-exposes-recoverable-legacy-data",
    sb.refIsSaved("legacy-topic") && P.saved.join(",") === "legacy-topic", "saved=" + savedIds(sb));
  ok("M2b failed-migration-preserves-legacy-bytes", s.getItem(LEGACY) === legacyBytes);
  ok("M2c failed-migration-does-not-create-partial-guest-key", s.getItem(GUEST) === null);
  let threw = false;
  try { sb.refRecordOpen("a-alphabet"); sb.refToggleSave("a-alphabet"); } catch (e) { threw = true; }
  ok("M2d failed-migration-writes-do-not-throw", !threw);
  flaky._fail = false; // storage recovers
  const sb2 = boot(flaky, null);
  sb2.refProg();
  ok("M2e recovery-completes-migration-idempotently",
    s.getItem(GUEST) === legacyBytes && s.getItem(LEGACY) === null && sb2.refIsSaved("legacy-topic"),
    "guest=" + (s.getItem(GUEST) !== null) + " legacy=" + (s.getItem(LEGACY) !== null));
}

/* M3: interrupted migration (copy done, delete not) self-heals next run. */
{
  const bytes = payload({ opened: { "a-alphabet": 42 }, saved: ["a-alphabet"] });
  const s = makeLS();
  s.setItem(GUEST, bytes);
  s.setItem(LEGACY, bytes); // crash between setItem(guest) and removeItem(legacy)
  const sb = boot(s, null);
  sb.refProg();
  ok("M3a interrupted-migration-self-heals",
    s.getItem(LEGACY) === null && s.getItem(GUEST) === bytes && sb.refIsSaved("a-alphabet"),
    "legacy=" + (s.getItem(LEGACY) !== null));
  const sb2 = boot(s, null);
  sb2.refProg();
  ok("M3b self-heal-is-repeatable", s.getItem(LEGACY) === null && sb2.refIsSaved("a-alphabet"));
}

/* I1: invalid/guest/signed-in identity transitions follow DMIdentity. */
{
  const s = makeLS(), sb = boot(s, null, null); // DMIdentity missing entirely
  sb.refToggleSave("a-alphabet");
  ok("I1a missing-DMIdentity-uses-guest-namespace",
    s.getItem(GUEST) !== null && s.getItem(LEGACY) === null && sb.refIsSaved("a-alphabet"),
    "guest=" + (s.getItem(GUEST) !== null));
}
{
  const s = makeLS();
  const sb = boot(s, null, { activeUid() { throw new Error("identity store unavailable"); } });
  sb.refToggleSave("b-nomen-genus");
  ok("I1b throwing-DMIdentity-fails-safe-to-guest",
    s.getItem(GUEST) !== null && sb.refIsSaved("b-nomen-genus"), "keys=" + Object.keys(s._m).join(","));
}
{
  const s = makeLS(), sb = boot(s, null);
  sb.__setUid("uid-A"); sb.refToggleSave("c-personal");
  const aBytes = s.getItem(acc("uid-A"));
  sb.__setIdentity({ activeUid() { throw new Error("identity store unavailable"); } });
  ok("I1c broken-oracle-during-session-invalidates-to-guest",
    !sb.refIsSaved("c-personal") && s.getItem(acc("uid-A")) === aBytes,
    "saved=" + savedIds(sb));
  sb.__setIdentity({ activeUid: () => null }); // oracle repaired, still signed out
  ok("I1d back-to-guest-works-after-oracle-repair",
    !sb.refIsSaved("c-personal") && sb.refProg().saved.length === 0, "saved=" + savedIds(sb));
}
{
  const s = makeLS();
  const sb = boot(s, null, { activeUid: () => "" }); // empty-string identity = guest
  sb.refToggleSave("d-dativ");
  ok("I1e empty-string-identity-treated-as-guest",
    s.getItem(GUEST) !== null && sb.refIsSaved("d-dativ"));
}

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
