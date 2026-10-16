/* Deutsch Master — Academy deployment safety tests (Node, stdlib-only, hardened).
 *
 * Hardened fail-closed gates (no network, no database, no credentials):
 *   D1 staging allowlist explicit + default-deny + Academy/learner decoupling
 *      (pure target logic; Academy ignores learner SUPABASE_CONFIG).
 *   D2 hardened integration:
 *      A. prod learner URL + missing Academy config/client => blocked, zero .from().
 *      B. learner URL changed to Staging ONLY (no Academy target) => still blocked.
 *      C. Academy Staging URL WITHOUT Academy client => blocked.
 *      D. Academy Staging URL + inconsistent client target => blocked.
 *      E. ONLY matching Staging Academy config + client passes in harness.
 *   D3 learner-only Pages artifact excludes Academy entry files + SW precache
 *      rewritten in GENERATED artifact only (source client/sw.js kept).
 *   D4 client/www parity, learner config/client untouched, portal disabled UI.
 *   D5 dedicated Academy auth (Staging-only): config validation, distinct
 *      client/session storage, password sign-in/out isolated from learner
 *      auth, no self-signup, no privileged credentials, no Prod fallback.
 *
 * Usage: node tools/test-academy-deploy-safety.js   (exit 0 = PASS)
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const STAGING_REF = "uafwvkgaijmcofistjum";
const PROD_REF = "bhdgpscedjowchldsjnd";
const STAGING_URL = "https://" + STAGING_REF + ".supabase.co";
const PROD_URL = "https://" + PROD_REF + ".supabase.co";
const EXCLUDED = ["academy.html", "academy-core.js", "academy-auth.js", "academy-portal.js"];
const MIRRORED = ["academy-core.js", "academy-auth.js", "academy-portal.js", "academy.html", "sw.js"];

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name + (extra ? " | " + extra : "")); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

function freshCore() {
  var p = path.join(ROOT, "client", "academy-core.js");
  delete require.cache[require.resolve(p)];
  return require(p);
}

function freshAuth() {
  var p = path.join(ROOT, "client", "academy-auth.js");
  delete require.cache[require.resolve(p)];
  return require(p);
}

function stripComments(src) {
  try {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  } catch (e) { return src; }
}

function saveGlobals() {
  return {
    window: (typeof global.window !== "undefined") ? global.window : undefined,
    academyCfg: (typeof globalThis.ACADEMY_SUPABASE_CONFIG !== "undefined") ? globalThis.ACADEMY_SUPABASE_CONFIG : undefined,
    academyClient: (typeof globalThis.academySupabaseClient !== "undefined") ? globalThis.academySupabaseClient : undefined,
    learnerCfg: (typeof globalThis.SUPABASE_CONFIG !== "undefined") ? globalThis.SUPABASE_CONFIG : undefined
  };
}
function restoreGlobals(s) {
  try {
    if (s.window === undefined) { try { delete global.window; } catch (e) {} }
    else global.window = s.window;
  } catch (e) {}
  try {
    if (s.academyCfg === undefined) { try { delete globalThis.ACADEMY_SUPABASE_CONFIG; } catch (e) {} }
    else globalThis.ACADEMY_SUPABASE_CONFIG = s.academyCfg;
  } catch (e) {}
  try {
    if (s.academyClient === undefined) { try { delete globalThis.academySupabaseClient; } catch (e) {} }
    else globalThis.academySupabaseClient = s.academyClient;
  } catch (e) {}
  try {
    if (s.learnerCfg === undefined) { try { delete globalThis.SUPABASE_CONFIG; } catch (e) {} }
    else globalThis.SUPABASE_CONFIG = s.learnerCfg;
  } catch (e) {}
}

// ---------- D1: allowlist + decoupling (pure) ----------
(function () {
  var C = freshCore();
  ok("D1 staging ref constant explicit", C.ACADEMY_STAGING_REF === STAGING_REF, String(C.ACADEMY_STAGING_REF));
  ok("D1 allowlist contains staging only (no prod)",
    Array.isArray(C.ACADEMY_ALLOWED_REFS) && C.ACADEMY_ALLOWED_REFS.indexOf(STAGING_REF) >= 0 &&
    C.ACADEMY_ALLOWED_REFS.indexOf(PROD_REF) < 0, JSON.stringify(C.ACADEMY_ALLOWED_REFS));
  ok("D1 extract prod ref", C.extractProjectRef(PROD_URL) === PROD_REF);
  ok("D1 extract staging ref", C.extractProjectRef(STAGING_URL) === STAGING_REF);
  ok("D1 extract rejects garbage", C.extractProjectRef("") === null && C.extractProjectRef(null) === null &&
    C.extractProjectRef("not-a-url") === null && C.extractProjectRef("https://example.com") === null);
  var prodT = C.resolveAcademyTarget(PROD_URL);
  ok("D1 pure prod URL disabled", prodT.allowed === false && prodT.reason === "target_disabled");
  var stagT = C.resolveAcademyTarget(STAGING_URL);
  ok("D1 pure staging URL allowed (URL check only)", stagT.allowed === true && stagT.reason === "staging_allowed");

  // Deployment resolver requires BOTH config + client.
  function fakeAcademyClient(url) {
    return { supabaseUrl: url, from: function () { throw new Error("must not be called in pure checks"); } };
  }
  var missCfg = C.resolveAcademyDeployment(null, fakeAcademyClient(STAGING_URL));
  ok("D1 deployment missing config denies", missCfg.allowed === false && missCfg.reason === "missing_config");
  var missCli = C.resolveAcademyDeployment(STAGING_URL, null);
  ok("D1 deployment missing client denies", missCli.allowed === false && missCli.reason === "missing_client");
  var incon = C.resolveAcademyDeployment(STAGING_URL, fakeAcademyClient(PROD_URL));
  ok("D1 deployment inconsistent targets denies", incon.allowed === false && incon.reason === "inconsistent_target");
  var unver = C.resolveAcademyDeployment(STAGING_URL, { from: function () {} });
  ok("D1 deployment unverifiable client denies", unver.allowed === false && unver.reason === "inconsistent_target");
  var prodBoth = C.resolveAcademyDeployment(PROD_URL, fakeAcademyClient(PROD_URL));
  ok("D1 deployment prod config+client still disabled", prodBoth.allowed === false && prodBoth.reason === "target_disabled");
  var good = C.resolveAcademyDeployment(STAGING_URL, fakeAcademyClient(STAGING_URL));
  ok("D1 deployment matching staging config+client allows", good.allowed === true && good.reason === "staging_allowed" && !!good.client);

  // Academy config accessor ignores learner config by design.
  var g = saveGlobals();
  try { delete global.window; } catch (e) {}
  try { delete globalThis.ACADEMY_SUPABASE_CONFIG; } catch (e) {}
  try { delete globalThis.academySupabaseClient; } catch (e) {}
  global.window = {
    SUPABASE_CONFIG: { url: STAGING_URL },
    ACADEMY_SUPABASE_CONFIG: undefined,
    academySupabaseClient: undefined,
    supabaseClient: { from: function () { throw new Error("learner fallback forbidden"); } },
    AuthModule: { getClient: function () { throw new Error("learner fallback forbidden"); }, getUser: function () { return null; } }
  };
  var C2 = freshCore();
  ok("D1 learner staging URL alone does NOT enable Academy", C2.isAcademyTargetAllowed() === false);
  ok("D1 Academy config URL is null when only learner set", C2.configuredAcademyUrl() === null);
  ok("D1 Academy client is null when only learner client set", C2.getAcademyClient() === null);
  restoreGlobals(g);
})();

// ---------- D2: hardened integration ----------
(async function () {
  var FAKE_USER = "11111111-1111-4111-8111-111111111111";
  var CLASS_ID = "a0000000-0000-4000-8000-aaaaaaaaaaa1";
  var saved = saveGlobals();

  function explodingFrom(table) {
    throw new Error("Academy table access while disabled: " + table);
  }
  function learnerExplodingClient(calls) {
    function onFrom(t) {
      calls.push("learner:" + t);
      return explodingFrom(t);
    }
    return { from: onFrom };
  }
  function learnerAuth(calls) {
    function onGetClient() {
      calls.push("learner:getClient");
      return learnerExplodingClient(calls);
    }
    function onGetUser() { return { id: FAKE_USER }; }
    return { getClient: onGetClient, getUser: onGetUser };
  }
  function academyAuthMock(user) {
    function onGetUser() { return user || null; }
    function onGetSession() { return user ? { user: user } : null; }
    return { getUser: onGetUser, getSession: onGetSession };
  }
  function setWindowState(learnerUrl, academyUrl, academyClient, calls, academyUser) {
    var w = {};
    w.SUPABASE_CONFIG = { url: learnerUrl };
    w.ACADEMY_SUPABASE_CONFIG = academyUrl ? { url: academyUrl, publishableKey: "test-publishable-key" } : undefined;
    w.academySupabaseClient = academyClient;
    w.supabaseClient = learnerExplodingClient(calls);
    w.AuthModule = learnerAuth(calls);
    w.AcademyAuth = academyAuthMock(academyUser === undefined ? null : academyUser);
    global.window = w;
  }
  async function allOps(C) {
    var out = [];
    out.push(await C.checkSetup());
    out.push(await C.listAcademies({}));
    out.push(await C.myMemberships());
    out.push(await C.createAcademy({ name: "X" }));
    out.push(await C.updateAcademy(CLASS_ID, {}));
    out.push(await C.listMembers(CLASS_ID, {}));
    out.push(await C.addMember(CLASS_ID, FAKE_USER, "student"));
    out.push(await C.updateMemberRole(CLASS_ID, FAKE_USER, "student"));
    out.push(await C.listClasses(CLASS_ID, {}));
    out.push(await C.createClass(CLASS_ID, { name: "X" }));
    out.push(await C.updateClass(CLASS_ID, { name: "X" }));
    out.push(await C.listClassTeachers(CLASS_ID));
    out.push(await C.assignTeacher(CLASS_ID, FAKE_USER));
    out.push(await C.unassignTeacher(CLASS_ID, FAKE_USER));
    out.push(await C.myTeachingClasses({}));
    out.push(await C.listEnrollments(CLASS_ID, {}));
    out.push(await C.enrollStudent(CLASS_ID, FAKE_USER));
    out.push(await C.removeEnrollment(CLASS_ID, FAKE_USER));
    out.push(await C.getStudentProgress(FAKE_USER));
    out.push(await C.getProfiles([FAKE_USER]));
    out.push(await C.logAudit(CLASS_ID, "test", "t", "e", {}));
    return out;
  }

  // Case A: prod learner URL + missing Academy target => blocked, learner client never touched.
  var learnerCallsA = [];
  setWindowState(PROD_URL, null, undefined, learnerCallsA);
  try { delete globalThis.ACADEMY_SUPABASE_CONFIG; } catch (e) {}
  try { delete globalThis.academySupabaseClient; } catch (e) {}
  var CA = freshCore();
  var resA = await allOps(CA);
  ok("D2A prod learner + missing Academy => all blocked", resA.every(function (r) { return r && (r.code === "TARGET_DISABLED" || r.reason === "target_disabled" || r.reason === "supabase_not_configured"); }), "ops=" + resA.length);
  ok("D2A checkSetup reports disabled (not ok)", resA[0] && resA[0].configured === false && resA[0].reason !== "ok");
  ok("D2A zero Academy table calls + zero learner fallback calls", learnerCallsA.length === 0, "calls=" + learnerCallsA.length);

  // Case B: learner URL flipped to staging ONLY => still blocked.
  var learnerCallsB = [];
  setWindowState(STAGING_URL, null, undefined, learnerCallsB);
  var CB = freshCore();
  var resB = await allOps(CB);
  ok("D2B learner-only staging flip does NOT enable Academy", resB.every(function (r) { return r && (r.code === "TARGET_DISABLED" || r.reason === "supabase_not_configured"); }));
  ok("D2B still zero fallback calls", learnerCallsB.length === 0, "calls=" + learnerCallsB.length);

  // Case C: Academy staging URL WITHOUT Academy client => blocked.
  var learnerCallsC = [];
  setWindowState(PROD_URL, STAGING_URL, undefined, learnerCallsC);
  var CC = freshCore();
  var resC = await allOps(CC);
  ok("D2C Academy URL without client does NOT enable queries", resC.every(function (r) { return r && (r.code === "TARGET_DISABLED" || r.reason === "supabase_not_configured"); }));
  ok("D2C still zero fallback calls", learnerCallsC.length === 0, "calls=" + learnerCallsC.length);

  // Case D: Academy staging URL + inconsistent (prod) client => blocked.
  var learnerCallsD = [];
  var inconsistentCalls = [];
  function inconsistentAcademyClient() {
    function onFrom(t) {
      inconsistentCalls.push(t);
      return explodingFrom(t);
    }
    return { supabaseUrl: PROD_URL, from: onFrom };
  }
  setWindowState(PROD_URL, STAGING_URL, inconsistentAcademyClient(), learnerCallsD);
  var CD = freshCore();
  var resD = await allOps(CD);
  ok("D2D inconsistent Academy client target stays blocked", resD.every(function (r) { return r && (r.code === "TARGET_DISABLED" || r.code === "INCONSISTENT_TARGET" || r.reason === "inconsistent_target" || r.reason === "supabase_not_configured"); }));
  ok("D2D inconsistent client made zero table calls", inconsistentCalls.length === 0, "calls=" + inconsistentCalls.length);
  ok("D2D learner fallback still untouched", learnerCallsD.length === 0, "calls=" + learnerCallsD.length);

  // Case E: ONLY matching staging Academy config + client passes (positive control).
  var academyCallsE = [];
  var learnerCallsE = [];
  function academySelectStub() {
    function onSelect() { return Promise.resolve({ error: null, data: [], count: 0 }); }
    return { select: onSelect };
  }
  function stagingAcademyClient() {
    function onFrom(t) {
      academyCallsE.push(t);
      return academySelectStub();
    }
    return { supabaseUrl: STAGING_URL, from: onFrom };
  }
  setWindowState(PROD_URL, STAGING_URL, stagingAcademyClient(), learnerCallsE, { id: FAKE_USER, email: "op@example.com" });
  var CE = freshCore();
  var okSetup = await CE.checkSetup();
  ok("D2E matching Staging Academy target/client+session passes gate",
    okSetup && (okSetup.configured === true || okSetup.reason === "ok") && academyCallsE.length === 1 && academyCallsE[0] === "academies");
  ok("D2E learner client untouched on Academy pass", learnerCallsE.length === 0, "calls=" + learnerCallsE.length);

  // Case F: Staging config+client WITHOUT an authenticated session => SIGNIN_REQUIRED, zero table calls.
  var academyCallsF = [];
  var learnerCallsF = [];
  function stagingAcademyClientF() {
    function onFrom(t) {
      academyCallsF.push(t);
      return explodingFrom(t);
    }
    return { supabaseUrl: STAGING_URL, from: onFrom };
  }
  setWindowState(PROD_URL, STAGING_URL, stagingAcademyClientF(), learnerCallsF, null);
  var CF = freshCore();
  var setupF = await CF.checkSetup();
  ok("D2F staging target without session requires sign-in",
    setupF && setupF.configured === false && setupF.reason === "signin_required" && setupF.code === "SIGNIN_REQUIRED");
  var resF = await allOps(CF);
  ok("D2F all ops SIGNIN_REQUIRED without session",
    resF.every(function (r) { return r && (r.code === "SIGNIN_REQUIRED" || r.reason === "signin_required"); }), "ops=" + resF.length);
  ok("D2F zero Academy table calls without session", academyCallsF.length === 0, "calls=" + academyCallsF.length);
  ok("D2F learner fallback untouched without session", learnerCallsF.length === 0, "calls=" + learnerCallsF.length);

  await runAuthModuleChecks();
  await runLifecycleRegressionChecks();

  restoreGlobals(saved);
  runArtifactChecks();
})().catch(function (e) {
  console.log("FAIL D2 harness threw: " + (e && e.message ? e.message : e));
  fail++;
  runArtifactChecks();
});

// ---------- D5: dedicated Academy auth (Staging-only, offline mocks) ----------
async function runAuthModuleChecks() {
  var SESS_USER = { id: "33333333-3333-4333-8333-333333333333", email: "operator@example.com" };
  function cleanGlobals() {
    try { delete global.window; } catch (e) {}
    try { delete globalThis.ACADEMY_SUPABASE_CONFIG; } catch (e) {}
    try { delete globalThis.academySupabaseClient; } catch (e) {}
    try { delete globalThis.SUPABASE_CONFIG; } catch (e) {}
  }
  function learnerSpies() {
    var calls = [];
    function onGetUser() { calls.push("getUser"); return { id: "learner-user" }; }
    function onGetClient() { calls.push("getClient"); return { __learnerClient: true }; }
    function onSignOut() { calls.push("signOut"); return Promise.resolve({}); }
    return { calls: calls, mod: { getUser: onGetUser, getClient: onGetClient, signOut: onSignOut } };
  }
  function storageMock(calls) {
    var store = {};
    function onGet(k) { calls.push("get:" + k); return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }
    function onSet(k, v) { calls.push("set:" + k); store[k] = String(v); }
    function onRemove(k) { calls.push("del:" + k); delete store[k]; }
    return { getItem: onGet, setItem: onSet, removeItem: onRemove };
  }
  // Mock Supabase JS SDK: createClient spy + controllable auth backend.
  function mockSdk(capture, sessionObj, rogueUrl) {
    var listeners = [];
    function fakeClient(url, key, opts) {
      capture.push({ url: url, key: key, opts: opts });
      var liveSession = sessionObj === undefined ? null : sessionObj;
      function onGetSession() { return Promise.resolve({ data: { session: liveSession } }); }
      function onChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe: function () {} } } }; }
      function onSignIn(creds) {
        liveSession = { user: SESS_USER };
        return Promise.resolve({ data: { session: liveSession, user: SESS_USER }, error: null, creds: creds });
      }
      function onSignOut() { liveSession = null; return Promise.resolve({ error: null }); }
      return {
        supabaseUrl: rogueUrl || url,
        auth: { getSession: onGetSession, onAuthStateChange: onChange, signInWithPassword: onSignIn, signOut: onSignOut }
      };
    }
    return { createClient: fakeClient, _listeners: listeners };
  }
  function setAuthWindow(o) {
    o = o || {};
    cleanGlobals();
    var w = {};
    if (o.academyCfg !== undefined) w.ACADEMY_SUPABASE_CONFIG = o.academyCfg;
    w.supabase = o.sdk;
    w.sessionStorage = o.sessionStorage;
    w.localStorage = o.localStorage;
    w.supabaseClient = o.learnerClient;
    w.AuthModule = o.learnerAuth;
    w.SUPABASE_CONFIG = { url: PROD_URL };
    global.window = w;
  }

  // 1-6: fail-closed configuration matrix (no client created).
  var matrix = [
    { name: "missing config", cfg: undefined, sdk: true, want: "missing_config" },
    { name: "malformed URL", cfg: { url: "not-a-url", publishableKey: "k" }, sdk: true, want: "malformed_config" },
    { name: "production URL", cfg: { url: PROD_URL, publishableKey: "k" }, sdk: true, want: "target_disabled" },
    { name: "empty key", cfg: { url: STAGING_URL, publishableKey: "  " }, sdk: true, want: "malformed_config" },
    { name: "JWT-shaped key", cfg: { url: STAGING_URL, publishableKey: "eyJmYWtlLXRlc3Q" }, sdk: true, want: "malformed_config" }
  ];
  for (var i = 0; i < matrix.length; i++) {
    var m = matrix[i];
    var capture = [];
    var w = { supabase: mockSdk(capture, null), sessionStorage: storageMock([]), localStorage: storageMock([]),
      learnerClient: { __learner: true }, learnerAuth: learnerSpies().mod };
    if (m.cfg !== undefined) w.academyCfg = m.cfg;
    setAuthWindow(w);
    var A = freshAuth();
    var st = await A.initialize();
    ok("D5 auth rejects: " + m.name, st && st.configured === false && st.reason === m.want, String(st && st.reason));
    ok("D5 no client created: " + m.name, A.getClient() === null && capture.length === 0);
  }
  // 6b: SDK missing.
  await (function () {
    var w = { sdk: undefined, sessionStorage: storageMock([]), localStorage: storageMock([]),
      learnerClient: { __learner: true }, learnerAuth: learnerSpies().mod,
      academyCfg: { url: STAGING_URL, publishableKey: "test-publishable-key" } };
    setAuthWindow(w);
    var A = freshAuth();
    return A.initialize().then(function (st) {
      ok("D5 auth reports sdk_missing without SDK", st && st.configured === false && st.reason === "sdk_missing");
      ok("D5 no client without SDK", A.getClient() === null);
    });
  })();

  // 7: happy path — distinct client, storage key, no learner contact.
  var happy = await (function () {
    var capture = [];
    var sessCalls = [];
    var localCalls = [];
    var learner = learnerSpies();
    var sdk = mockSdk(capture, { user: SESS_USER });
    var w = { sdk: sdk, sessionStorage: storageMock(sessCalls), localStorage: storageMock(localCalls),
      learnerClient: { __learner: true }, learnerAuth: learner.mod,
      academyCfg: { url: STAGING_URL, publishableKey: "test-publishable-key" } };
    setAuthWindow(w);
    var A = freshAuth();
    return A.initialize().then(function (st) {
      var created = capture[0];
      ok("D5 staging config+key+SDK configures Academy auth", st && st.configured === true && st.reason === "ok");
      ok("D5 client created against Staging URL", capture.length === 1 && created && created.url === STAGING_URL);
      ok("D5 distinct Academy storage key", created && created.opts && created.opts.auth && created.opts.auth.storageKey === "dm-academy-auth-v1");
      ok("D5 Academy storage is session storage, not learner default",
        created && created.opts && created.opts.auth && created.opts.auth.storage === global.window.sessionStorage);
      ok("D5 Academy ignores OAuth callback URLs", created && created.opts && created.opts.auth && created.opts.auth.detectSessionInUrl === false);
      ok("D5 window.academySupabaseClient set", global.window.academySupabaseClient === A.getClient() && !!A.getClient());
      ok("D5 learner client object untouched", global.window.supabaseClient && global.window.supabaseClient.__learner === true);
      ok("D5 learner AuthModule untouched by init", learner.calls.length === 0, learner.calls.join(","));
      ok("D5 session loaded from Staging", A.getUser() && A.getUser().id === SESS_USER.id);
      ok("D5 localStorage never touched", localCalls.length === 0, localCalls.slice(0, 3).join(","));
      return { A: A, learner: learner, localCalls: localCalls };
    });
  })();

  // 8: narrow API surface.
  ok("D5 no public self-signup", typeof happy.A.signUp === "undefined" && typeof happy.A.signUpWithEmail === "undefined");
  ok("D5 no account deletion API", typeof happy.A.deleteUser === "undefined" && typeof happy.A.updateUser === "undefined");
  ok("D5 no OAuth entrypoint", typeof happy.A.signInWithOAuth === "undefined");

  // 9-10: sign-in/out isolated from learner auth.
  var after = await (function () {
    var capture = [];
    var localCalls = [];
    var learner = learnerSpies();
    var sdk = mockSdk(capture, null);
    var w = { sdk: sdk, sessionStorage: storageMock([]), localStorage: storageMock(localCalls),
      learnerClient: { __learner: true }, learnerAuth: learner.mod,
      academyCfg: { url: STAGING_URL, publishableKey: "test-publishable-key" } };
    setAuthWindow(w);
    var A = freshAuth();
    return A.initialize().then(function () {
      return A.signInWithPassword("Operator@Example.com", "pw").then(function (r) {
        ok("D5 Academy password sign-in works", !r.error && A.getUser() && A.getUser().id === SESS_USER.id);
        ok("D5 learner AuthModule untouched by Academy sign-in", learner.calls.length === 0, learner.calls.join(","));
        ok("D5 localStorage untouched by Academy sign-in", localCalls.length === 0);
        return A.signOut().then(function (s) {
          ok("D5 Academy sign-out clears session", s && !s.error && A.getUser() === null && A.getSession() === null);
          ok("D5 learner sign-out never called", learner.calls.indexOf("signOut") < 0, learner.calls.join(","));
          return { localCalls: localCalls };
        });
      });
    });
  })();
  ok("D5 localStorage untouched by Academy sign-out", after.localCalls.length === 0);

  // 11: rogue client URL vs config → inconsistent, client cleared.
  await (function () {
    var capture = [];
    var w = { sdk: mockSdk(capture, null, PROD_URL), sessionStorage: storageMock([]), localStorage: storageMock([]),
      learnerClient: { __learner: true }, learnerAuth: learnerSpies().mod,
      academyCfg: { url: STAGING_URL, publishableKey: "test-publishable-key" } };
    setAuthWindow(w);
    var A = freshAuth();
    return A.initialize().then(function (st) {
      ok("D5 inconsistent client target fails closed", st && st.configured === false && st.reason === "inconsistent_target");
      ok("D5 inconsistent client cleared", A.getClient() === null);
    });
  })();

  // 12: static scans of the auth module.
  var authSrc = "";
  try { authSrc = fs.readFileSync(path.join(ROOT, "client", "academy-auth.js"), "utf8"); } catch (e) {}
  var authCode = stripComments(authSrc);
  ok("D5 auth reads only ACADEMY_SUPABASE_CONFIG",
    authCode.indexOf("ACADEMY_SUPABASE_CONFIG") >= 0 && authCode.indexOf("window.SUPABASE_CONFIG") < 0);
  ok("D5 auth never touches learner client/session",
    authCode.indexOf("window.supabaseClient") < 0 && authCode.indexOf("AuthModule") < 0 && authCode.indexOf("localStorage") < 0);
  ok("D5 auth has no privileged credential literals",
    !/sb_secret/i.test(authCode) && !/service_role/i.test(authCode) && !/eyJ[A-Za-z0-9_\-]{20,}/.test(authCode));
  ok("D5 auth exposes no signup/deletion", authCode.indexOf("signUp") < 0 && authCode.indexOf("deleteUser") < 0);
  cleanGlobals();
}

// ---------- D6-D9: lifecycle + stale-state behavioral regressions (offline mocks, temp dirs) ----------
async function runLifecycleRegressionChecks() {
  var SESS = { id: "44444444-4444-4444-8444-444444444444", email: "operator@example.com" };
  function clean() {
    try { delete global.window; } catch (e) {}
    try { delete global.document; } catch (e) {}
    try { delete global.uilang; } catch (e) {}
    try { delete globalThis.ACADEMY_SUPABASE_CONFIG; } catch (e) {}
    try { delete globalThis.academySupabaseClient; } catch (e) {}
    try { delete globalThis.SUPABASE_CONFIG; } catch (e) {}
    try { delete global.navigator; } catch (e) {}
  }
  function sessStore() {
    var s = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
      setItem: function (k, v) { s[k] = String(v); },
      removeItem: function (k) { delete s[k]; }
    };
  }
  function sdkWith(opts) {
    opts = opts || {};
    var listeners = [];
    var live = opts.session === undefined ? null : opts.session;
    function fakeClient(url, key, copts) {
      (opts.capture || []).push({ url: url, key: key, opts: copts });
      return {
        supabaseUrl: opts.rogueUrl || url,
        auth: {
          getSession: opts.getSessionFn || (function () { return Promise.resolve({ data: { session: live } }); }),
          onAuthStateChange: function (cb) { listeners.push(cb); return { data: { subscription: { unsubscribe: function () {} } } }; },
          signInWithPassword: opts.signInFn || (function () {
            live = { user: SESS };
            return Promise.resolve({ data: { session: live, user: SESS }, error: null });
          }),
          signOut: opts.signOutFn || (function () { live = null; return Promise.resolve({ error: null }); })
        }
      };
    }
    var sdk = { createClient: fakeClient, _listeners: listeners };
    return sdk;
  }
  function setW(o) {
    o = o || {};
    clean();
    var w = {};
    if (o.cfg !== undefined) w.ACADEMY_SUPABASE_CONFIG = o.cfg;
    w.supabase = o.sdk;
    w.sessionStorage = o.storage || sessStore();
    w.SUPABASE_CONFIG = { url: PROD_URL };
    global.window = w;
  }

  // D6.1: every invalid-init path clears cached session + user.
  await (async function () {
    var cap = [];
    var sdk = sdkWith({ capture: cap, session: { user: SESS } });
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdk });
    var A = freshAuth();
    await A.initialize();
    ok("D6 invalid-init precondition has session", A.getUser() && A.getUser().id === SESS.id);
    var badCfgs = [
      { name: "missing", cfg: undefined },
      { name: "malformed", cfg: { url: "not-a-url", publishableKey: "k" } },
      { name: "prod", cfg: { url: PROD_URL, publishableKey: "k" } },
      { name: "empty-key", cfg: { url: STAGING_URL, publishableKey: " " } },
      { name: "jwt-key", cfg: { url: STAGING_URL, publishableKey: "eyJmYWtlLXRlc3Q" } },
      { name: "inconsistent", cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, rogue: true }
    ];
    for (var i = 0; i < badCfgs.length; i++) {
      var b = badCfgs[i];
      // Re-seed stale session first via happy init, then switch to bad config.
      var cap2 = [];
      var sdk2 = sdkWith({ capture: cap2, session: { user: SESS }, rogueUrl: b.rogue ? PROD_URL : undefined });
      // Fresh module instance per iteration would lose stale; instead reuse A
      // by re-initializing after swapping globals (A retains stale internally).
      // To simulate stale, directly seed via successful sign-in on a fresh instance,
      // then reuse same instance for the invalid path.
      var seedCap = [];
      var seedSdk = sdkWith({ capture: seedCap, session: { user: SESS } });
      setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: seedSdk });
      var AA = freshAuth();
      await AA.initialize();
      ok("D6 seed has session for " + b.name, AA.getSession() !== null && AA.getUser() !== null);
      // Now swap to invalid without clearing module state: reuse same AA by
      // swapping window config/sdk and calling initialize again.
      if (b.cfg === undefined) {
        clean();
        global.window = { supabase: sdkWith({ session: null }), sessionStorage: sessStore(), SUPABASE_CONFIG: { url: PROD_URL } };
      } else if (b.rogue) {
        // Inconsistent via replaced global object (same Staging URL, different instance).
        setW({ cfg: b.cfg, sdk: sdk2 });
        var fakeRogue = { supabaseUrl: STAGING_URL, from: function () { throw new Error("must not be called"); } };
        try { global.window.academySupabaseClient = fakeRogue; } catch (e2) {}
        try { globalThis.academySupabaseClient = fakeRogue; } catch (e3) {}
        // AA still holds the seeded trusted internally; globals now hold a
        // different object with a plausible URL, so next initialize must fail
        // closed as inconsistent_target and clear stale identity.
      } else if (b.name === "empty-key" || b.name === "jwt-key" || b.name === "malformed" || b.name === "prod") {
        setW({ cfg: b.cfg, sdk: sdkWith({ session: null }) });
      }
      // Reuse AA (stale holder) — need to keep same object, so do not freshAuth.
      // But setW replaced global.window; AA reads new globals on initialize.
      var st = await AA.initialize();
      ok("D6 invalid-init clears session+user: " + b.name,
        AA.getSession() === null && AA.getUser() === null && st && st.configured === false,
        String(st && st.reason));
      ok("D6 invalid-init nulls global client: " + b.name,
        (function () {
          try { return global.window.academySupabaseClient === null; } catch (e) { return false; }
        })());
    }
    // SDK-missing path also clears.
    var seedCap2 = [];
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdkWith({ capture: seedCap2, session: { user: SESS } }) });
    var AB = freshAuth();
    await AB.initialize();
    clean();
    global.window = { ACADEMY_SUPABASE_CONFIG: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sessionStorage: sessStore(), SUPABASE_CONFIG: { url: PROD_URL } };
    var st2 = await AB.initialize();
    ok("D6 sdk-missing clears session+user", AB.getSession() === null && AB.getUser() === null && st2.reason === "sdk_missing");
  })();

  // D6.2: getSession null + error clear identity (initialize + validateSession).
  await (async function () {
    // Null via direct mutation of the trusted client's getSession, then re-init/validate on SAME instance.
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdkWith({ session: { user: SESS } }) });
    var B = freshAuth();
    await B.initialize();
    ok("D6 getSession precondition", B.getUser() !== null);
    try {
      var tc = B.trustedClient();
      if (tc && tc.auth) tc.auth.getSession = function () { return Promise.resolve({ data: { session: null } }); };
    } catch (e) {}
    var stNull = await B.validateSession();
    ok("D6 getSession-null clears identity", stNull === null && B.getSession() === null && B.getUser() === null);
    // Initialize with null session on same mutated client also clears.
    var stNull2 = await B.initialize();
    ok("D6 getSession-null on init clears", B.getSession() === null && B.getUser() === null);
    // Error path: mutate to reject.
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdkWith({ session: { user: SESS } }) });
    var C = freshAuth();
    await C.initialize();
    try {
      var tc2 = C.trustedClient();
      if (tc2 && tc2.auth) tc2.auth.getSession = function () { return Promise.reject(new Error("boom")); };
    } catch (e) {}
    var v = null;
    try { v = await C.validateSession(); } catch (e) { v = null; }
    ok("D6 getSession-error clears identity", v === null && C.getSession() === null && C.getUser() === null);
    // validateSession null-result also clears (fresh null-session instance stays cleared).
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdkWith({ session: null }) });
    var E = freshAuth();
    await E.initialize();
    var v3 = await E.validateSession();
    ok("D6 validateSession-null clears", v3 === null && E.getSession() === null && E.getUser() === null);
  })();

  // D6.3: failed password sign-in clears stale cached identity.
  await (async function () {
    var okSdk = sdkWith({ session: { user: SESS } });
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: okSdk });
    var A = freshAuth();
    await A.initialize();
    ok("D6 signin-fail precondition", A.getUser() !== null);
    // Swap signIn to fail.
    var failSdk = sdkWith({
      session: { user: SESS },
      signInFn: function () { return Promise.resolve({ data: { session: null, user: null }, error: { message: "Invalid login credentials" } }); }
    });
    // Need same A instance but new SDK: re-point window supabase then call sign-in.
    // A already holds trusted client from okSdk; to test stale clearing, keep A
    // and make its own client fail: easiest is fresh instance with fail SDK seeded stale first.
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdkWith({ session: { user: SESS } }) });
    var B = freshAuth();
    await B.initialize();
    // Replace B's client auth signIn with failing stub via global swap is not enough
    // (B holds old client). Instead directly test via a fresh instance whose SDK fails
    // after seeding stale through a successful sign-in then a failed one on same instance.
    var mixedCalls = [];
    var liveSession = { user: SESS };
    var mixedSdk = {
      createClient: function (url, key, opts) {
        mixedCalls.push(url);
        return {
          supabaseUrl: url,
          auth: {
            getSession: function () { return Promise.resolve({ data: { session: liveSession } }); },
            onAuthStateChange: function () { return { data: {} }; },
            signInWithPassword: function () {
              liveSession = null;
              return Promise.resolve({ data: { session: null }, error: { message: "Invalid login credentials" } });
            },
            signOut: function () { liveSession = null; return Promise.resolve({ error: null }); }
          }
        };
      }
    };
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: mixedSdk });
    var Cc = freshAuth();
    await Cc.initialize();
    ok("D6 signin-fail seeded", Cc.getUser() !== null);
    var r = await Cc.signInWithPassword("op@example.com", "wrong");
    ok("D6 failed sign-in clears stale identity", !!r.error && Cc.getSession() === null && Cc.getUser() === null, String(r.error).slice(0, 40));
  })();

  // D6.4 + D9: SIGNED_OUT clears auth state; portal reset + immediate sign-out; target invalidation.
  await (async function () {
    var cap = [];
    var sdk = sdkWith({ capture: cap, session: { user: SESS } });
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdk });
    var A = freshAuth();
    await A.initialize();
    var gotCb = null;
    // Capture internal auth-state subscriber via SDK listeners.
    ok("D6 SIGNED_OUT precondition", A.getUser() !== null && sdk._listeners.length === 1);
    gotCb = sdk._listeners[0];
    gotCb("SIGNED_OUT", null);
    ok("D6 SIGNED_OUT clears auth state", A.getSession() === null && A.getUser() === null);
    // Other null-session events also clear.
    var sdk2 = sdkWith({ session: { user: SESS } });
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdk2 });
    var B = freshAuth();
    await B.initialize();
    var cb2 = sdk2._listeners[0];
    cb2("TOKEN_REFRESHED", null);
    ok("D6 null-session event clears", B.getSession() === null && B.getUser() === null);
    // Non-null events update before notifying (no async API inside callback).
    var sdk3 = sdkWith({ session: null });
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdk3 });
    var Cc = freshAuth();
    await Cc.initialize();
    var cb3 = sdk3._listeners[0];
    var notified = [];
    Cc.onAuthStateChange(function (ev, sess) { notified.push(ev); });
    var freshSess = { user: SESS };
    cb3("SIGNED_IN", freshSess);
    ok("D6 SIGNED_IN updates then notifies", Cc.getSession() === freshSess && notified.join(",") === "SIGNED_IN");
    var authSrc = fs.readFileSync(path.join(ROOT, "client", "academy-auth.js"), "utf8");
    var authCode = authSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    ok("D6 auth callback never calls async APIs",
      (function () {
        try {
          var i0 = authCode.indexOf("onAuthStateChange(function");
          if (i0 < 0) return false;
          // Callback body ends at the first "authCallback(event" notify call's closing;
          // extract only up to the notify to avoid matching later awaits.
          var iNotify = authCode.indexOf("authCallback(event", i0);
          if (iNotify < 0) return false;
          var body = authCode.slice(i0, iNotify);
          return body.indexOf("await") < 0 && body.indexOf("getSession") < 0 &&
            body.indexOf("signInWithPassword") < 0 && body.indexOf("signOut") < 0;
        } catch (e) { return false; }
      })());
  })();

  // D7: replaced global + malformed URL consistency.
  await (async function () {
    // Replaced global object rejected even with Staging URL.
    var cap = [];
    var sdk = sdkWith({ capture: cap, session: { user: SESS } });
    setW({ cfg: { url: STAGING_URL, publishableKey: "test-publishable-key" }, sdk: sdk });
    var A = freshAuth();
    await A.initialize();
    var trusted = A.trustedClient();
    ok("D7 trusted precondition", !!trusted && trusted.supabaseUrl === STAGING_URL);
    // Publish trusted to globals for core gate.
    try { global.window.AcademyAuth = A; } catch (e) {}
    try { globalThis.AcademyAuth = A; } catch (e) {}
    try { global.window.ACADEMY_SUPABASE_CONFIG = { url: STAGING_URL, publishableKey: "test-publishable-key" }; } catch (e) {}
    try { globalThis.ACADEMY_SUPABASE_CONFIG = { url: STAGING_URL, publishableKey: "test-publishable-key" }; } catch (e) {}
    try { global.window.academySupabaseClient = trusted; } catch (e) {}
    try { globalThis.academySupabaseClient = trusted; } catch (e) {}
    try { global.window.SUPABASE_CONFIG = { url: PROD_URL }; } catch (e) {}
    var C = freshCore();
    var stOk = C.getAcademyTargetStatus();
    ok("D7 trusted global passes", stOk.allowed === true && stOk.client === trusted);
    var fake = { supabaseUrl: STAGING_URL, from: function () { throw new Error("must not be called"); } };
    try { global.window.academySupabaseClient = fake; } catch (e) {}
    try { globalThis.academySupabaseClient = fake; } catch (e) {}
    var C2 = freshCore();
    var stFake = C2.getAcademyTargetStatus();
    ok("D7 replaced global rejected even with Staging URL",
      stFake.allowed === false && stFake.reason === "inconsistent_target" && !stFake.client);
    // Malformed/unrecognized URLs rejected consistently by both modules.
    var badUrls = ["", "not-a-url", "https://example.com", "https://.supabase.co", "https://foo.supabase.com", null, undefined, 123];
    var authConsistent = true, coreConsistent = true;
    var A2 = freshAuth();
    var C3 = freshCore();
    badUrls.forEach(function (u) {
      var ar = null, cr = null;
      try { ar = A2.extractRef(u); } catch (e) { ar = "throw"; }
      try { cr = C3.extractProjectRef(u); } catch (e) { cr = "throw"; }
      if (ar !== cr) authConsistent = false;
      if (ar !== null) coreConsistent = false;
      var au = null, cu = null;
      try { au = A2.clientUrlOf({ supabaseUrl: u }); } catch (e) {}
      try { cu = C3.getAcademyClientUrl({ supabaseUrl: u }); } catch (e) {}
      if (au !== cu) authConsistent = false;
      if (au !== null || cu !== null) {
        // Both must be null for malformed.
        if (!(au === null && cu === null)) authConsistent = false;
      }
    });
    ok("D7 malformed URLs rejected consistently by both modules", authConsistent && coreConsistent);
    // Unknown shape with extra fields also rejected (strict canonical).
    var spoof = { url: STAGING_URL, __academyTargetUrl: STAGING_URL, supabase_url: STAGING_URL };
    ok("D7 permissive shapes rejected (strict canonical)",
      A2.clientUrlOf(spoof) === null && C3.getAcademyClientUrl(spoof) === null);
    ok("D7 canonical impl shared",
      (function () {
        try {
          var s = fs.readFileSync(path.join(ROOT, "client", "academy-auth.js"), "utf8");
          var c = fs.readFileSync(path.join(ROOT, "client", "academy-core.js"), "utf8");
          return s.indexOf("clientUrlOf") >= 0 && c.indexOf("getAcademyClientUrl") >= 0 &&
            c.indexOf("AcademyAuth.clientUrlOf") >= 0 && c.indexOf("AcademyAuth.extractRef") >= 0;
        } catch (e) { return false; }
      })());
    clean();
  })();

  // D8: every DB method blocked with zero .from() when session validation fails;
  // allowed-path uses trusted Staging client, never learner; RLS remains boundary.
  await (async function () {
    var FAKE_USER = "11111111-1111-4111-8111-111111111111";
    var CLASS_ID = "a0000000-0000-4000-8000-aaaaaaaaaaa1";
    function exploding() { throw new Error("must not be called when blocked"); }
    // Blocked: staging config + trusted client but validateSession fails.
    var trustedCalls = [];
    var learnerCalls = [];
    var trustedBlocked = {
      supabaseUrl: STAGING_URL,
      from: function (t) { trustedCalls.push(t); return exploding(t); }
    };
    var learnerClient = { from: function (t) { learnerCalls.push("learner:" + t); return exploding(t); } };
    // Build an AcademyAuth stub whose validateSession fails (null) to force SIGNIN_REQUIRED.
    var failingAuth = {
      validateSession: function () { return Promise.resolve(null); },
      getSession: function () { return null; },
      getUser: function () { return { id: FAKE_USER }; },
      trustedClient: function () { return trustedBlocked; },
      getStatus: function () { return { configured: true, reason: "ok" }; }
    };
    clean();
    global.window = {
      SUPABASE_CONFIG: { url: PROD_URL },
      ACADEMY_SUPABASE_CONFIG: { url: STAGING_URL, publishableKey: "test-publishable-key" },
      academySupabaseClient: trustedBlocked,
      supabaseClient: learnerClient,
      AuthModule: { getClient: function () { learnerCalls.push("learner:getClient"); return learnerClient; }, getUser: function () { return { id: "learner" }; } },
      AcademyAuth: failingAuth
    };
    try { globalThis.ACADEMY_SUPABASE_CONFIG = global.window.ACADEMY_SUPABASE_CONFIG; } catch (e) {}
    try { globalThis.academySupabaseClient = trustedBlocked; } catch (e) {}
    try { globalThis.AcademyAuth = failingAuth; } catch (e) {}
    var C = freshCore();
    var results = [];
    results.push(await C.checkSetup());
    results.push(await C.listAcademies({}));
    results.push(await C.myMemberships());
    results.push(await C.createAcademy({ name: "X" }));
    results.push(await C.updateAcademy(CLASS_ID, {}));
    results.push(await C.listMembers(CLASS_ID, {}));
    results.push(await C.addMember(CLASS_ID, FAKE_USER, "student"));
    results.push(await C.updateMemberRole(CLASS_ID, FAKE_USER, "student"));
    results.push(await C.removeMember(CLASS_ID, FAKE_USER));
    results.push(await C.listClasses(CLASS_ID, {}));
    results.push(await C.createClass(CLASS_ID, { name: "X" }));
    results.push(await C.updateClass(CLASS_ID, { name: "X" }));
    results.push(await C.listClassTeachers(CLASS_ID));
    results.push(await C.assignTeacher(CLASS_ID, FAKE_USER));
    results.push(await C.unassignTeacher(CLASS_ID, FAKE_USER));
    results.push(await C.myTeachingClasses({}));
    results.push(await C.listEnrollments(CLASS_ID, {}));
    results.push(await C.enrollStudent(CLASS_ID, FAKE_USER));
    results.push(await C.removeEnrollment(CLASS_ID, FAKE_USER));
    results.push(await C.getStudentProgress(FAKE_USER));
    results.push(await C.getProfiles([FAKE_USER]));
    results.push(await C.logAudit(CLASS_ID, "test", "t", "e", {}));
    var allBlocked = results.every(function (r) { return r && (r.code === "SIGNIN_REQUIRED" || r.reason === "signin_required"); });
    ok("D8 all DB methods blocked with SIGNIN_REQUIRED when session validation fails", allBlocked, "ops=" + results.length);
    ok("D8 zero trusted .from() when session fails", trustedCalls.length === 0, "calls=" + trustedCalls.length);
    ok("D8 zero learner fallback when session fails", learnerCalls.length === 0, "calls=" + learnerCalls.length);
    // Allowed-path: trusted client + passing validateSession uses trusted, never learner.
    var allowedTrustedCalls = [];
    var allowedLearnerCalls = [];
    function allowedStub() { return { select: function () { return Promise.resolve({ error: null, data: [], count: 0 }); } }; }
    var allowedTrusted = {
      supabaseUrl: STAGING_URL,
      auth: { getSession: function () { return Promise.resolve({ data: { session: { user: { id: FAKE_USER } } } }); } },
      from: function (t) { allowedTrustedCalls.push(t); return allowedStub(); }
    };
    var passingAuth = {
      validateSession: function () { return Promise.resolve({ user: { id: FAKE_USER } }); },
      getSession: function () { return { user: { id: FAKE_USER } }; },
      getUser: function () { return { id: FAKE_USER }; },
      trustedClient: function () { return allowedTrusted; },
      getStatus: function () { return { configured: true, reason: "ok" }; }
    };
    clean();
    global.window = {
      SUPABASE_CONFIG: { url: PROD_URL },
      ACADEMY_SUPABASE_CONFIG: { url: STAGING_URL, publishableKey: "test-publishable-key" },
      academySupabaseClient: allowedTrusted,
      supabaseClient: { from: function (t) { allowedLearnerCalls.push(t); return exploding(t); } },
      AuthModule: { getClient: function () { allowedLearnerCalls.push("getClient"); return null; } },
      AcademyAuth: passingAuth
    };
    try { globalThis.ACADEMY_SUPABASE_CONFIG = global.window.ACADEMY_SUPABASE_CONFIG; } catch (e) {}
    try { globalThis.academySupabaseClient = allowedTrusted; } catch (e) {}
    try { globalThis.AcademyAuth = passingAuth; } catch (e) {}
    var C2 = freshCore();
    var s2 = await C2.checkSetup();
    ok("D8 allowed-path uses trusted Staging client",
      (s2.configured === true || s2.reason === "ok") && allowedTrustedCalls.length === 1 && allowedTrustedCalls[0] === "academies");
    ok("D8 allowed-path never touches learner client", allowedLearnerCalls.length === 0, allowedLearnerCalls.join(","));
    // RLS remains the required server-side boundary: DENIED (RLS) propagates, gate does not grant.
    var rlsCalls = [];
    var rlsClient = {
      supabaseUrl: STAGING_URL,
      auth: { getSession: function () { return Promise.resolve({ data: { session: { user: { id: FAKE_USER } } } }); } },
      from: function (t) {
        rlsCalls.push(t);
        return {
          select: function () { return Promise.resolve({ error: { message: "new row violates row-level security policy", code: "42501" }, data: null }); },
          insert: function () { return { select: function () { return { single: function () { return Promise.resolve({ error: { message: "new row violates row-level security policy", code: "42501" }, data: null }); } }; } }; },
          update: function () { return { eq: function () { return { eq: function () { return { select: function () { return { single: function () { return Promise.resolve({ error: { message: "new row violates row-level security policy", code: "42501" }, data: null }); } }; } }; } }; } }; },
          delete: function () { return { eq: function () { return { eq: function () { return Promise.resolve({ error: { message: "new row violates row-level security policy", code: "42501" }, data: null }); } }; } }; },
          eq: function () { return this; }, order: function () { return this; }, range: function () { return Promise.resolve({ error: { message: "new row violates row-level security policy", code: "42501" }, data: null }); },
          in: function () { return Promise.resolve({ error: { message: "new row violates row-level security policy", code: "42501" }, data: null }); },
          is: function () { return this; }, ilike: function () { return this; }
        };
      }
    };
    var rlsAuth = {
      validateSession: function () { return Promise.resolve({ user: { id: FAKE_USER } }); },
      getSession: function () { return { user: { id: FAKE_USER } }; },
      getUser: function () { return { id: FAKE_USER }; },
      trustedClient: function () { return rlsClient; },
      getStatus: function () { return { configured: true, reason: "ok" }; }
    };
    clean();
    global.window = {
      SUPABASE_CONFIG: { url: PROD_URL },
      ACADEMY_SUPABASE_CONFIG: { url: STAGING_URL, publishableKey: "test-publishable-key" },
      academySupabaseClient: rlsClient,
      AcademyAuth: rlsAuth
    };
    try { globalThis.ACADEMY_SUPABASE_CONFIG = global.window.ACADEMY_SUPABASE_CONFIG; } catch (e) {}
    try { globalThis.academySupabaseClient = rlsClient; } catch (e) {}
    try { globalThis.AcademyAuth = rlsAuth; } catch (e) {}
    var C3 = freshCore();
    var m = await C3.listMembers(CLASS_ID, {});
    ok("D8 RLS denial propagates as DENIED (gate is not a substitute)",
      m && m.code === "DENIED" && rlsCalls.length >= 1, (m && m.code) + " calls=" + rlsCalls.length);
    var coreSrc = fs.readFileSync(path.join(ROOT, "client", "academy-core.js"), "utf8");
    ok("D8 RLS remains documented as required boundary",
      /RLS remains/.test(coreSrc) && /never a substitute for RLS/.test(coreSrc));
    clean();
  })();

  // D8b: missing progress row is empty/no-progress, never DENIED; real RLS denial still DENIED.
  await (async function () {
    var FAKE_USER = "11111111-1111-4111-8111-111111111111";
    function passingAuthFor(trusted) {
      return {
        validateSession: function () { return Promise.resolve({ user: { id: FAKE_USER } }); },
        getSession: function () { return { user: { id: FAKE_USER } }; },
        getUser: function () { return { id: FAKE_USER }; },
        trustedClient: function () { return trusted; },
        getStatus: function () { return { configured: true, reason: "ok" }; }
      };
    }
    function wireStaging(auth, trusted) {
      clean();
      global.window = {
        SUPABASE_CONFIG: { url: PROD_URL },
        ACADEMY_SUPABASE_CONFIG: { url: STAGING_URL, publishableKey: "test-publishable-key" },
        academySupabaseClient: trusted,
        AcademyAuth: auth
      };
      try { globalThis.ACADEMY_SUPABASE_CONFIG = global.window.ACADEMY_SUPABASE_CONFIG; } catch (e) {}
      try { globalThis.academySupabaseClient = trusted; } catch (e) {}
      try { globalThis.AcademyAuth = auth; } catch (e) {}
    }
    // Case 1: legacy .single() path returning PGRST116 (no maybeSingle on builder).
    var singleCalls = [];
    var singleClient = {
      supabaseUrl: STAGING_URL,
      from: function (t) {
        singleCalls.push(t);
        return {
          select: function () {
            return {
              eq: function () {
                return { single: function () { return Promise.resolve({ data: null, error: { code: "PGRST116", message: "No rows" } }); } };
              }
            };
          }
        };
      }
    };
    wireStaging(passingAuthFor(singleClient), singleClient);
    var C1 = freshCore();
    var r1 = await C1.getStudentProgress(FAKE_USER);
    ok("D8b PGRST116 missing row is empty, not DENIED",
      r1 && r1.error === null && r1.data === null && r1.summary && r1.summary.hasData === false,
      "code=" + (r1 && r1.code));
    // Case 2: .maybeSingle() path returning null row.
    var maybeCalls = [];
    var maybeClient = {
      supabaseUrl: STAGING_URL,
      from: function (t) {
        maybeCalls.push(t);
        return {
          select: function () {
            return {
              eq: function () {
                return { maybeSingle: function () { return Promise.resolve({ data: null, error: null }); } };
              }
            };
          }
        };
      }
    };
    wireStaging(passingAuthFor(maybeClient), maybeClient);
    var C2 = freshCore();
    var r2 = await C2.getStudentProgress(FAKE_USER);
    ok("D8b maybeSingle null row is empty, not DENIED",
      r2 && r2.error === null && r2.data === null && r2.summary && r2.summary.hasData === false,
      "code=" + (r2 && r2.code));
    // Case 3: real RLS denial (42501) still surfaces as DENIED, never empty.
    var deniedClient = {
      supabaseUrl: STAGING_URL,
      from: function () {
        return {
          select: function () {
            return {
              eq: function () {
                return { maybeSingle: function () { return Promise.resolve({ data: null, error: { code: "42501", message: "permission denied" } }); } };
              }
            };
          }
        };
      }
    };
    wireStaging(passingAuthFor(deniedClient), deniedClient);
    var C3b = freshCore();
    var r3 = await C3b.getStudentProgress(FAKE_USER);
    ok("D8b RLS 42501 still DENIED (not masked as empty)",
      r3 && r3.code === "DENIED" && !!r3.error);
    clean();
  })();

  // D9: portal stale-state reset (static + behavioral with isolated temp dir).
  await (async function () {
    var portalSrc = fs.readFileSync(path.join(ROOT, "client", "academy-portal.js"), "utf8");
    var portalCode = portalSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    ok("D9 portal has single reset function", portalCode.indexOf("resetPortalState") >= 0);
    ok("D9 reset clears user/memberships/selection/role",
      /S\.user\s*=\s*null/.test(portalCode) && /S\.memberships\s*=\s*\[\]/.test(portalCode) &&
      /S\.currentAcademy\s*=\s*null/.test(portalCode) && /S\.role\s*=\s*null/.test(portalCode));
    ok("D9 reset clears cached view state",
      portalCode.indexOf("S.teachers") >= 0 && portalCode.indexOf("S.classes") >= 0 &&
      portalCode.indexOf("S.enroll") >= 0 && portalCode.indexOf("teacherDash") >= 0);
    ok("D9 reset clears DOM containers", /acadOverviewBody/.test(portalCode) && /acadMyUid/.test(portalCode) && /innerHTML/.test(portalCode));
    ok("D9 reset on disabled/inconsistent/init-fail/no-session",
      portalCode.indexOf('resetPortalState("init_failed")') >= 0 &&
      portalCode.indexOf('resetPortalState("no_session")') >= 0 &&
      portalCode.indexOf('resetPortalState("target_invalid")') >= 0);
    ok("D9 reset on sign-out immediate (before await)",
      (function () {
        var iReset = portalCode.indexOf('resetPortalState("signout")');
        var iSign = portalCode.indexOf("signOut(");
        return iReset >= 0 && iSign >= 0 && iReset < iSign;
      })());
    ok("D9 reset on auth-no-session event",
      portalCode.indexOf('resetPortalState("auth_no_session")') >= 0);
    ok("D9 failed sign-in clears + revalidates",
      portalCode.indexOf('resetPortalState("signin_failed")') >= 0 && portalCode.indexOf("refreshAll()") >= 0);
    // Distinct ar/en/de messages for 4 states.
    var hasInvalid = portalSrc.indexOf("acadInvalidCredentials") >= 0;
    var hasDenied = portalSrc.indexOf("acadDenied") >= 0;
    ok("D9 portal has invalid-credentials + denied keys", hasInvalid && hasDenied);
    ok("D9 portal ar/en/de distinct for 4 states",
      (function () {
        try {
          var need = ["targetDisabled", "acadSigninRequired", "acadInvalidCredentials", "acadDenied"];
          var langs = ["ar:", "en:", "de:"];
          // Crude: each key appears at least 3 times (once per lang block).
          for (var i = 0; i < need.length; i++) {
            var c = portalSrc.split(need[i]).length - 1;
            if (c < 3) return false;
          }
          return true;
        } catch (e) { return false; }
      })());
    ok("D9 portal never shows prior UID when session unavailable",
      /S\.user\s*=\s*null/.test(portalCode) && /acadMyUid/.test(portalCode));
    // Behavioral: load portal with mocked DOM in isolated temp dir, verify reset clears.
    await (async function () {
      var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dm-portal-"));
      function mockDom() {
        var ids = ["acadSetupBanner", "acadMyUid", "acadAuthBox", "acadSelector", "acadOverviewBody", "acadSettingsBody", "acadTeachersBody", "acadClassesBody", "acadEnrollBody", "acadTeacherBody"];
        var els = {};
        ids.forEach(function (id) { els[id] = { innerHTML: "<stale>" + id + ":old-uid old-academy</stale>" }; });
        els["acadSetupBanner"] = { innerHTML: "banner" };
        return {
          els: els,
          readyState: "complete",
          getElementById: function (id) { return els[id] || null; },
          querySelectorAll: function () { return []; },
          querySelector: function () { return null; },
          addEventListener: function () {}
        };
      }
      var dom = mockDom();
      clean();
      global.document = dom;
      global.window = {
        AcademyAuth: {
          initialize: function () { return Promise.resolve({ configured: false, reason: "target_disabled" }); },
          validateSession: function () { return Promise.resolve(null); },
          getUser: function () { return null; },
          getStatus: function () { return { configured: false, reason: "target_disabled" }; },
          onAuthStateChange: function (cb) { try { this._cb = cb; } catch (e) {} },
          signOut: function () { return Promise.resolve({ error: null }); },
          signInWithPassword: function () { return Promise.resolve({ data: null, error: "Invalid" }); }
        },
        AcademyCore: {
          checkSetup: function () { return Promise.resolve({ configured: false, reason: "target_disabled", code: "TARGET_DISABLED" }); },
          myMemberships: function () { return Promise.resolve({ data: [] }); },
          listClasses: function () { return Promise.resolve({ data: [], code: "TARGET_DISABLED" }); },
          listMembers: function () { return Promise.resolve({ data: [], code: "TARGET_DISABLED" }); },
          canManageAcademy: function () { return false; }
        },
        S: { uiLang: "ar" }
      };
      global.uilang = function () { return "ar"; };
      var portalPath = path.join(ROOT, "client", "academy-portal.js");
      try { delete require.cache[require.resolve(portalPath)]; } catch (e) {}
      var beforeFile = path.join(tmp, "before.json");
      try { fs.writeFileSync(beforeFile, JSON.stringify({ dom: dom.els.acadMyUid.innerHTML })); } catch (e) {}
      try { require(portalPath); } catch (e) {}
      await new Promise(function (res) { setTimeout(res, 80); });
      var hook = null;
      try { hook = global.window.__AcademyPortalTest || null; } catch (e) {}
      ok("D9 portal test hook exposed (isolated)", !!hook && typeof hook.reset === "function");
      if (hook) {
        var S = hook.getState();
        // Seed stale state.
        try { S.user = { id: "stale-uid-999" }; } catch (e) {}
        try { S.memberships = [{ academy_id: "stale-academy-1", role: "teacher" }]; } catch (e) {}
        try { S.currentAcademy = "stale-academy-1"; } catch (e) {}
        try { S.role = "teacher"; } catch (e) {}
        try { S.enroll = { classId: "stale-class", page: 2 }; } catch (e) {}
        try { S.teacherDash = { classId: "stale-class", page: 2, detail: "stale-student" }; } catch (e) {}
        try { dom.els.acadMyUid.innerHTML = "<code>stale-uid-999</code>"; } catch (e) {}
        try { dom.els.acadSelector.innerHTML = "stale-academy-1"; } catch (e) {}
        try { dom.els.acadOverviewBody.innerHTML = "old class list + progress"; } catch (e) {}
        try { dom.els.acadTeacherBody.innerHTML = "old progress"; } catch (e) {}
        var snapBefore = path.join(tmp, "snap-before.json");
        try {
          fs.writeFileSync(snapBefore, JSON.stringify({
            user: S.user, sel: S.currentAcademy, role: S.role, uidDom: dom.els.acadMyUid.innerHTML
          }));
        } catch (e) {}
        hook.reset("target_invalid");
        var snapAfter = path.join(tmp, "snap-after.json");
        try {
          fs.writeFileSync(snapAfter, JSON.stringify({
            user: S.user, sel: S.currentAcademy, role: S.role, uidDom: dom.els.acadMyUid.innerHTML
          }));
        } catch (e) {}
        ok("D9 target invalidation clears selection/role/UID (behavioral)",
          S.user === null && S.memberships.length === 0 && S.currentAcademy === null && S.role === null);
        ok("D9 target invalidation clears rendered UID/data (behavioral)",
          dom.els.acadMyUid.innerHTML.indexOf("stale-uid-999") < 0 &&
          dom.els.acadSelector.innerHTML.indexOf("stale-academy") < 0 &&
          dom.els.acadOverviewBody.innerHTML.indexOf("old class") < 0);
        // Sign-out immediate: reset before await signOut — verify hook reset is sync.
        try { S.user = { id: "u2" }; } catch (e) {}
        try { dom.els.acadMyUid.innerHTML = "u2"; } catch (e) {}
        hook.reset("signout");
        ok("D9 sign-out clears immediately (behavioral)",
          S.user === null && dom.els.acadMyUid.innerHTML.indexOf("u2") < 0);
        // SIGNED_OUT via auth callback also clears (simulate).
        try { S.user = { id: "u3" }; } catch (e) {}
        var cb = null;
        try { cb = global.window.AcademyAuth._cb || null; } catch (e) {}
        if (cb) {
          try { cb("SIGNED_OUT", null); } catch (e) {}
          await new Promise(function (res) { setTimeout(res, 350); });
          var S2 = hook.getState();
          ok("D9 SIGNED_OUT clears portal UI/data (behavioral)", S2.user === null);
        } else {
          ok("D9 SIGNED_OUT clears portal UI/data (behavioral)", S.user === null);
        }
      }
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
      clean();
    })();
  })();
  clean();
}

// ---------- D3 + D4 ----------
function runArtifactChecks() {
  var srcSwBefore = null;
  try { srcSwBefore = fs.readFileSync(path.join(ROOT, "client", "sw.js"), "utf8"); }
  catch (e) { srcSwBefore = null; }
  ok("D3 source sw.js readable", !!srcSwBefore);
  ok("D3 source sw.js still lists Academy entries (source untouched expectation)",
    !!srcSwBefore && srcSwBefore.indexOf('"./academy.html"') >= 0 &&
    srcSwBefore.indexOf('"./academy-auth.js"') >= 0 &&
    srcSwBefore.indexOf('"./academy-core.js"') >= 0 && srcSwBefore.indexOf('"./academy-portal.js"') >= 0);

  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dm-pages-"));
  var out = path.join(tmp, "pages");
  var r = spawnSync(process.execPath, [path.join(ROOT, "tools", "build-pages-artifact.js"), "--out", out],
    { cwd: ROOT, encoding: "utf8", timeout: 120000 });
  ok("D3 artifact build exits 0", r.status === 0, (r.stdout || "").trim().split("\n").slice(-2).join(" | ") + (r.status !== 0 ? " STDERR=" + (r.stderr || "").slice(0, 300) : ""));
  EXCLUDED.forEach(function (f) {
    ok("D3 artifact excludes " + f, !fs.existsSync(path.join(out, f)));
  });
  ["index.html", "privacy.html", "terms.html", "sw.js"].forEach(function (f) {
    ok("D3 artifact retains " + f, fs.existsSync(path.join(out, f)));
  });
  var genSw = null;
  try { genSw = fs.readFileSync(path.join(out, "sw.js"), "utf8"); } catch (e) {}
  ok("D3 generated sw.js readable", !!genSw);
  if (genSw) {
    EXCLUDED.forEach(function (f) {
      ok("D3 generated SW drops " + f, genSw.indexOf('"./' + f + '"') < 0);
    });
    var files = Array.from(genSw.matchAll(/"\.\/([^"?]+)(?:\?[^"]*)?"/g)).map(function (m) { return m[1]; });
    var uniq = Array.from(new Set(files));
    var missing = uniq.filter(function (p) { return !fs.existsSync(path.join(out, p)); });
    ok("D3 generated SW precache all resolve (" + uniq.length + ")", missing.length === 0, missing.slice(0, 5).join(","));
  }
  var srcSwAfter = null;
  try { srcSwAfter = fs.readFileSync(path.join(ROOT, "client", "sw.js"), "utf8"); } catch (e) {}
  ok("D3 source client/sw.js unchanged by build", srcSwAfter === srcSwBefore);

  MIRRORED.forEach(function (f) {
    var a = null, b = null;
    try { a = fs.readFileSync(path.join(ROOT, "client", f)); } catch (e) {}
    try { b = fs.readFileSync(path.join(ROOT, "www", f)); } catch (e) {}
    ok("D4 parity " + f + " client==www", !!a && !!b && a.equals(b));
  });
  var cfg = "";
  try { cfg = fs.readFileSync(path.join(ROOT, "client", "supabase-config.js"), "utf8"); } catch (e) {}
  ok("D4 learner config still Production (untouched)", cfg.indexOf(PROD_REF) >= 0 && cfg.indexOf(STAGING_REF) < 0);

  // Hardened decoupling: Academy code must not read learner config/client.
  var coreSrc = "";
  try { coreSrc = fs.readFileSync(path.join(ROOT, "client", "academy-core.js"), "utf8"); } catch (e) {}
  var codeOnly = stripComments(coreSrc);
  ok("D4 Academy never reads learner SUPABASE_CONFIG.url in code",
    codeOnly.indexOf("window.SUPABASE_CONFIG") < 0 && codeOnly.indexOf("globalThis.SUPABASE_CONFIG") < 0);
  ok("D4 Academy never uses learner supabaseClient/AuthModule.getClient in code",
    codeOnly.indexOf("window.supabaseClient") < 0 && codeOnly.indexOf("AuthModule.getClient") < 0 && codeOnly.indexOf("getClient") < 0);
  ok("D4 Academy reads distinct ACADEMY_SUPABASE_CONFIG + academySupabaseClient",
    codeOnly.indexOf("ACADEMY_SUPABASE_CONFIG") >= 0 && codeOnly.indexOf("academySupabaseClient") >= 0);

  var portal = "";
  try { portal = fs.readFileSync(path.join(ROOT, "client", "academy-portal.js"), "utf8"); } catch (e) {}
  ok("D4 portal has Arabic disabled state", portal.indexOf("targetDisabled") >= 0 && portal.indexOf("بوابة الأكاديمية معطلة") >= 0);
  ok("D4 portal maps TARGET_DISABLED", portal.indexOf('TARGET_DISABLED') >= 0);
  ok("D4 portal maps SIGNIN_REQUIRED+INCONSISTENT_TARGET",
    portal.indexOf('SIGNIN_REQUIRED') >= 0 && portal.indexOf('INCONSISTENT_TARGET') >= 0);
  ok("D4 portal has Academy sign-in UI", portal.indexOf("acadAuthBox") >= 0 && portal.indexOf("signInWithPassword") >= 0 &&
    portal.indexOf("بوابة الأكاديمية معطلة") >= 0 && portal.indexOf("تسجيل دخول الأكاديمية") >= 0);
  ok("D4 portal never claims staging-connected when disabled", portal.indexOf("targetDisabled") >= 0 && !/متصلة بـ Staging|connected to Staging/i.test(portal));
  var portalCode = stripComments(portal);
  ok("D4 portal never uses Production AuthModule in code", portalCode.indexOf("AuthModule") < 0);
  ok("D4 portal uses AcademyAuth identity", portalCode.indexOf("AcademyAuth") >= 0);

  var acadHtml = "";
  try { acadHtml = fs.readFileSync(path.join(ROOT, "client", "academy.html"), "utf8"); } catch (e) {}
  ok("D4 academy.html loads academy-auth before academy-core",
    acadHtml.indexOf("academy-auth.js") >= 0 && acadHtml.indexOf("academy-auth.js") < acadHtml.indexOf("academy-core.js"));
  ok("D4 academy.html has Academy auth box", acadHtml.indexOf("acadAuthBox") >= 0);

  // Learner files stay Academy-free and Production-configured.
  ["client/auth.js", "client/app-init.js", "client/cloud-sync.js"].forEach(function (f) {
    var s = "";
    try { s = fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) {}
    ok("D4 learner file untouched by Academy: " + f,
      s.indexOf("academySupabaseClient") < 0 && s.indexOf("ACADEMY_SUPABASE_CONFIG") < 0 && s.indexOf("AcademyAuth") < 0);
  });

  console.log("====");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
}
