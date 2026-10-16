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
const EXCLUDED = ["academy.html", "academy-core.js", "academy-portal.js"];
const MIRRORED = ["academy-core.js", "academy-portal.js"];

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
  function setWindowState(learnerUrl, academyUrl, academyClient, calls) {
    var w = {};
    w.SUPABASE_CONFIG = { url: learnerUrl };
    w.ACADEMY_SUPABASE_CONFIG = academyUrl ? { url: academyUrl } : undefined;
    w.academySupabaseClient = academyClient;
    w.supabaseClient = learnerExplodingClient(calls);
    w.AuthModule = learnerAuth(calls);
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
  ok("D2D inconsistent Academy client target stays blocked", resD.every(function (r) { return r && (r.code === "TARGET_DISABLED" || r.reason === "supabase_not_configured"); }));
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
  setWindowState(PROD_URL, STAGING_URL, stagingAcademyClient(), learnerCallsE);
  var CE = freshCore();
  var okSetup = await CE.checkSetup();
  ok("D2E matching Staging Academy target/client passes gate",
    okSetup && (okSetup.configured === true || okSetup.reason === "ok") && academyCallsE.length === 1 && academyCallsE[0] === "academies");
  ok("D2E learner client untouched on Academy pass", learnerCallsE.length === 0, "calls=" + learnerCallsE.length);

  restoreGlobals(saved);
  runArtifactChecks();
})().catch(function (e) {
  console.log("FAIL D2 harness threw: " + (e && e.message ? e.message : e));
  fail++;
  runArtifactChecks();
});

// ---------- D3 + D4 ----------
function runArtifactChecks() {
  var srcSwBefore = null;
  try { srcSwBefore = fs.readFileSync(path.join(ROOT, "client", "sw.js"), "utf8"); }
  catch (e) { srcSwBefore = null; }
  ok("D3 source sw.js readable", !!srcSwBefore);
  ok("D3 source sw.js still lists Academy entries (source untouched expectation)",
    !!srcSwBefore && srcSwBefore.indexOf('"./academy.html"') >= 0 &&
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
  ok("D4 portal never claims staging-connected when disabled", portal.indexOf("targetDisabled") >= 0 && !/متصلة بـ Staging|connected to Staging/i.test(portal));

  console.log("====");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
}
