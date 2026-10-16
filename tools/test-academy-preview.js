/* Deutsch Master — optional Staging Academy preview offline tests (stdlib-only).
 *
 * Covers the isolated preview builder without network, Supabase, or real
 * credentials. All builds go to isolated temporary directories; source
 * files are never modified. Fake test-only values are used for the
 * positive path and are never printed in logs or assertions.
 *
 * Usage: node tools/test-academy-preview.js   (exit 0 = PASS)
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const STAGING_REF = "uafwvkgaijmcofistjum";
const PROD_REF = "bhdgpscedjowchldsjnd";
const STAGING_URL = "https://" + STAGING_REF + ".supabase.co";
const PROD_URL = "https://" + PROD_REF + ".supabase.co";
const FAKE_KEY = "sb_publishable_TESTONLY_FAKE_0123456789abcdef";
const BUILDER = path.join(ROOT, "tools", "build-academy-preview.js");
const PAGES_BUILDER = path.join(ROOT, "tools", "build-pages-artifact.js");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name + (extra ? " | " + extra : "")); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

function shaFile(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function rmrf(dir) {
  try {
    if (!fs.existsSync(dir)) return;
    if (fs.rmSync) fs.rmSync(dir, { recursive: true, force: true });
    else fs.rmdirSync(dir, { recursive: true });
  } catch (e) {}
}

function runPreview(outDir, envExtra) {
  var env = Object.assign({}, process.env, envExtra || {});
  delete env.ACADEMY_STAGING_URL;
  delete env.ACADEMY_STAGING_PUBLISHABLE_KEY;
  if (envExtra) {
    Object.keys(envExtra).forEach(function (k) {
      if (envExtra[k] === undefined) delete env[k];
      else env[k] = envExtra[k];
    });
  }
  return spawnSync(process.execPath, [BUILDER, "--out", outDir],
    { cwd: ROOT, encoding: "utf8", timeout: 120000, env: env });
}

function runPages(outDir) {
  return spawnSync(process.execPath, [PAGES_BUILDER, "--out", outDir],
    { cwd: ROOT, encoding: "utf8", timeout: 120000 });
}

function listRel(dir) {
  var out = [];
  function walk(rel) {
    var cur = rel ? path.join(dir, rel) : dir;
    var entries = fs.readdirSync(cur);
    entries.forEach(function (n) {
      var rp = rel ? rel + "/" + n : n;
      var p = path.join(dir, rp);
      var st = fs.statSync(p);
      if (st.isDirectory()) walk(rp);
      else out.push(rp);
    });
  }
  walk("");
  return out.sort();
}

(function main() {
  ok("preview builder exists", fs.existsSync(BUILDER));
  ok("pages builder exists", fs.existsSync(PAGES_BUILDER));

  var srcCfgBefore = "", srcSwBefore = "", srcIndexBefore = "";
  try { srcCfgBefore = shaFile(path.join(ROOT, "client", "supabase-config.js")); } catch (e) {}
  try { srcSwBefore = shaFile(path.join(ROOT, "client", "sw.js")); } catch (e) {}
  try { srcIndexBefore = shaFile(path.join(ROOT, "client", "index.html")); } catch (e) {}
  ok("source config readable", !!srcCfgBefore);
  ok("source sw readable", !!srcSwBefore);
  ok("source index readable", !!srcIndexBefore);

  // 1. Both absent -> skip, no preview, learner-only root still builds.
  (function () {
    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dm-prev-absent-"));
    var out = path.join(tmp, "pages");
    var rPages = runPages(out);
    ok("absent: learner-only build exits 0", rPages.status === 0);
    ok("absent: root excludes academy.html", !fs.existsSync(path.join(out, "academy.html")));
    ok("absent: root retains index.html", fs.existsSync(path.join(out, "index.html")));
    var rPrev = runPreview(out, {});
    ok("absent: preview skip exits 0", rPrev.status === 0);
    var combined = (rPrev.stdout || "") + (rPrev.stderr || "");
    ok("absent: skip leaves no preview dir", !fs.existsSync(path.join(out, "academy-preview")));
    ok("absent: root still learner-only after skip",
      !fs.existsSync(path.join(out, "academy.html")) && fs.existsSync(path.join(out, "index.html")));
    ok("absent: no secret in skip output",
      combined.indexOf("sb_publishable_") < 0 && combined.indexOf("sb_secret") < 0 && /eyJ[A-Za-z0-9_\-]{20,}/.test(combined) === false);
    rmrf(tmp);
  })();

  // 2. Only one var -> safe failure, no partial preview.
  (function () {
    [ { ACADEMY_STAGING_URL: STAGING_URL }, { ACADEMY_STAGING_PUBLISHABLE_KEY: FAKE_KEY } ].forEach(function (envOne, idx) {
      var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dm-prev-one-"));
      var out = path.join(tmp, "pages");
      fs.mkdirSync(out, { recursive: true });
      var r = runPreview(out, envOne);
      var combined = (r.stdout || "") + (r.stderr || "");
      ok("single-var fails safely [" + idx + "]", r.status !== 0);
      ok("single-var no partial preview [" + idx + "]", !fs.existsSync(path.join(out, "academy-preview")));
      ok("single-var never prints value [" + idx + "]",
        combined.indexOf(FAKE_KEY) < 0 && combined.indexOf(STAGING_URL) < 0 || combined.indexOf("FAIL academy-preview") >= 0);
      // Ensure the failure message does not embed the supplied material.
      var leaksKey = combined.indexOf(FAKE_KEY) >= 0;
      ok("single-var output hides key [" + idx + "]", !leaksKey);
      rmrf(tmp);
    });
  })();

  // 3. Wrong/production/path/query/credentials/malformed/JWT -> rejected.
  (function () {
    var badUrls = [
      PROD_URL,
      "https://xxxxxxxxxxxxxxxx.supabase.co",
      STAGING_URL + "/foo",
      STAGING_URL + "?x=1",
      STAGING_URL + "#frag",
      "https://user:pass@" + STAGING_REF + ".supabase.co",
      "not-a-url",
      "http://" + STAGING_REF + ".supabase.co",
      "",
      STAGING_URL + "\n"
    ];
    var badKeys = [
      "",
      "not-a-key",
      "eyJmYWtlLXRlc3QtdG9rZW4",
      "sb_secret_FAKE_TEST_0123456789abcdef",
      "sb_publishable_short",
      "sb_publishable_abc def",
      "sb_publishable_abc\ndef"
    ];
    badUrls.forEach(function (u, i) {
      var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dm-prev-badurl-"));
      var out = path.join(tmp, "pages");
      fs.mkdirSync(out, { recursive: true });
      var r = runPreview(out, { ACADEMY_STAGING_URL: u, ACADEMY_STAGING_PUBLISHABLE_KEY: FAKE_KEY });
      ok("bad URL rejected [" + i + "]", r.status !== 0 && !fs.existsSync(path.join(out, "academy-preview")));
      rmrf(tmp);
    });
    badKeys.forEach(function (k, i) {
      var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dm-prev-badkey-"));
      var out = path.join(tmp, "pages");
      fs.mkdirSync(out, { recursive: true });
      var r = runPreview(out, { ACADEMY_STAGING_URL: STAGING_URL, ACADEMY_STAGING_PUBLISHABLE_KEY: k });
      var combined = (r.stdout || "") + (r.stderr || "");
      ok("bad key rejected [" + i + "]", r.status !== 0 && !fs.existsSync(path.join(out, "academy-preview")));
      ok("bad key output hides material [" + i + "]", combined.indexOf(k) < 0 || k === "");
      rmrf(tmp);
    });
  })();

  // 4-9. Fake valid pair -> builds to temp; verify preview-only Staging, root intact, SW resolves, no secrets, deterministic + stale cleanup.
  (function () {
    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dm-prev-good-"));
    var out = path.join(tmp, "pages");
    var rPages = runPages(out);
    ok("good: learner root builds first", rPages.status === 0);
    var rootIndexBefore = "";
    try { rootIndexBefore = shaFile(path.join(out, "index.html")); } catch (e) {}
    var r = runPreview(out, { ACADEMY_STAGING_URL: STAGING_URL, ACADEMY_STAGING_PUBLISHABLE_KEY: FAKE_KEY });
    var combined = (r.stdout || "") + (r.stderr || "");
    ok("good: preview builds with fake Staging pair", r.status === 0 && fs.existsSync(path.join(out, "academy-preview", "academy.html")));
    ok("good: builder hides key material", combined.indexOf(FAKE_KEY) < 0);
    var prev = path.join(out, "academy-preview");
    var html = "";
    try { html = fs.readFileSync(path.join(prev, "academy.html"), "utf8"); } catch (e) {}
    var cfg = "";
    try { cfg = fs.readFileSync(path.join(prev, "supabase-config.js"), "utf8"); } catch (e) {}
    ok("good: academy.html injects Academy config before auth",
      html.indexOf("window.ACADEMY_SUPABASE_CONFIG") >= 0 &&
      html.indexOf("window.ACADEMY_SUPABASE_CONFIG") < html.indexOf("academy-auth.js"));
    ok("good: preview academy.html points to Staging only",
      html.indexOf(STAGING_URL) >= 0 && html.indexOf(PROD_REF) < 0);
    ok("good: preview config uses Staging, no Production",
      cfg.indexOf(STAGING_URL) >= 0 && cfg.indexOf(PROD_REF) < 0);
    ok("good: preview config carries supplied key (hidden check)",
      cfg.indexOf(FAKE_KEY) >= 0);
    ok("good: preview points both clients to Staging",
      cfg.indexOf(STAGING_URL) >= 0 && html.indexOf(STAGING_URL) >= 0 && cfg.indexOf(PROD_REF) < 0 && html.indexOf(PROD_REF) < 0);
    ok("good: root remains learner-only",
      !fs.existsSync(path.join(out, "academy.html")) && fs.existsSync(path.join(out, "index.html")));
    var rootIndexAfter = "";
    try { rootIndexAfter = shaFile(path.join(out, "index.html")); } catch (e) {}
    ok("good: root index.html unchanged", rootIndexBefore === rootIndexAfter);
    var srcCfgAfter = "", srcSwAfter = "", srcIndexAfter = "";
    try { srcCfgAfter = shaFile(path.join(ROOT, "client", "supabase-config.js")); } catch (e) {}
    try { srcSwAfter = shaFile(path.join(ROOT, "client", "sw.js")); } catch (e) {}
    try { srcIndexAfter = shaFile(path.join(ROOT, "client", "index.html")); } catch (e) {}
    ok("good: source config unmodified", srcCfgBefore === srcCfgAfter);
    ok("good: source sw unmodified", srcSwBefore === srcSwAfter);
    ok("good: source index unmodified", srcIndexBefore === srcIndexAfter);
    // Preview index isolation: redirect only, cannot start learner app or load learner Supabase client.
    var prevIndex = "";
    try { prevIndex = fs.readFileSync(path.join(prev, "index.html"), "utf8"); } catch (e) {}
    ok("good: preview index redirects to public learner root",
      prevIndex.indexOf("../index.html") >= 0);
    ok("good: preview index cannot load learner Supabase client",
      prevIndex.indexOf("supabase-config") < 0 && prevIndex.indexOf("SUPABASE_CONFIG") < 0 &&
      prevIndex.indexOf(STAGING_URL) < 0 && prevIndex.indexOf(PROD_REF) < 0 &&
      prevIndex.indexOf(FAKE_KEY) < 0);
    ok("good: preview index cannot start learner app",
      prevIndex.indexOf("academy-auth.js") < 0 && prevIndex.indexOf("script.js") < 0 &&
      prevIndex.indexOf("study.js") < 0 && prevIndex.indexOf("auth.js") < 0);
    ok("good: academy links target public root, not Staging learner",
      html.indexOf('href="index.html"') < 0 && html.indexOf('href="../index.html"') >= 0);
    // SW precache resolves in preview.
    var sw = "";
    try { sw = fs.readFileSync(path.join(prev, "sw.js"), "utf8"); } catch (e) {}
    var files = Array.from(sw.matchAll(/"\.\/([^"?]+)(?:\?[^"]*)?"/g)).map(function (m) { return m[1]; });
    var uniq = Array.from(new Set(files));
    var missing = uniq.filter(function (p) { return !fs.existsSync(path.join(prev, p)); });
    ok("good: preview SW precache resolves (" + uniq.length + ")", uniq.length > 0 && missing.length === 0, missing.slice(0, 3).join(","));
    // No service-role / secret.
    var allPrev = listRel(prev);
    var leak = false;
    allPrev.forEach(function (rel) {
      if (/\.(png|jpg|jpeg|woff2?|ttf|ico)$/i.test(rel)) return;
      var p = path.join(prev, rel);
      try {
        var t = fs.readFileSync(p, "utf8");
        if (/sb_secret_[A-Za-z0-9_\-]{10,}/.test(t)) leak = true;
        if (/eyJ[A-Za-z0-9_\-]{20,}/.test(t)) leak = true;
      } catch (e) {}
    });
    ok("good: no service-role or legacy secret introduced", !leak);
    // Deterministic re-run.
    function hashTree(dir) {
      var h = crypto.createHash("sha256");
      listRel(dir).forEach(function (rel) {
        var b = fs.readFileSync(path.join(dir, rel));
        h.update(rel + "\0" + String(b.length) + "\0");
        h.update(b);
      });
      return h.digest("hex");
    }
    var h1 = hashTree(prev);
    var r2 = runPreview(out, { ACADEMY_STAGING_URL: STAGING_URL, ACADEMY_STAGING_PUBLISHABLE_KEY: FAKE_KEY });
    var h2 = hashTree(path.join(out, "academy-preview"));
    ok("good: re-run deterministic", r2.status === 0 && h1 === h2);
    // Removal cleans stale preview.
    var r3 = runPreview(out, {});
    ok("good: removal leaves no stale preview", r3.status === 0 && !fs.existsSync(path.join(out, "academy-preview")));
    ok("good: root still intact after removal", fs.existsSync(path.join(out, "index.html")));
    rmrf(tmp);
  })();

  // Workflow wiring (static, no secrets).
  (function () {
    var yml = "";
    try { yml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "deploy.yml"), "utf8"); } catch (e) {}
    ok("workflow runs preview builder", yml.indexOf("build-academy-preview.js") >= 0);
    var iLearner = yml.indexOf("build-pages-artifact.js");
    var iPrev = yml.indexOf("build-academy-preview.js");
    var iUpload = yml.indexOf("upload-pages-artifact");
    ok("workflow order learner -> preview -> upload", iLearner >= 0 && iPrev > iLearner && iUpload > iPrev);
    ok("workflow binds vars via env only",
      yml.indexOf("ACADEMY_STAGING_URL") >= 0 && yml.indexOf("ACADEMY_STAGING_PUBLISHABLE_KEY") >= 0 &&
      yml.indexOf("vars.ACADEMY_STAGING_URL") >= 0 && yml.indexOf("vars.ACADEMY_STAGING_PUBLISHABLE_KEY") >= 0);
    ok("workflow never echoes values", !/echo.*ACADEMY_STAGING/i.test(yml));
  })();

  console.log("====");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
})();
