/* Deutsch Master — optional isolated Staging Academy preview builder (deterministic, fail-closed).
 *
 * Adds a nested `/academy-preview/` build inside the existing `dist/pages/`
 * artifact ONLY when both environment variables are provided:
 *   ACADEMY_STAGING_URL
 *   ACADEMY_STAGING_PUBLISHABLE_KEY
 *
 * Safety:
 *   - Both absent => skip successfully, remove any stale preview dir, leave
 *     the normal learner-only artifact unchanged (exit 0).
 *   - Only one set => fail with a safe message that never prints the
 *     supplied value; remove any partial preview (exit 1).
 *   - URL must be exactly `https://uafwvkgaijmcofistjum.supabase.co`
 *     (optional single trailing slash normalized away). Rejects unknown /
 *     production refs, path/query/credentials, newlines, malformed values.
 *   - Key must match `sb_publishable_` + base material; rejects JWT-shaped
 *     legacy keys, service-role material, newlines, malformed values.
 *   - Builds from source `client/` into `<out>/academy-preview/` without
 *     modifying source files. In the generated copy only, rewrites
 *     `supabase-config.js` to Staging, injects `ACADEMY_SUPABASE_CONFIG`
 *     before `academy-auth.js`, rewrites Academy-page `href="index.html"`
 *     links to the public `../index.html`, and replaces the copied Staging
 *     learner `index.html` with a minimal safe redirect to `../index.html`
 *     (no learner scripts, no Supabase client). Learner `AuthModule` and
 *     `AcademyAuth` stay on separate storage keys; only the supplied
 *     publishable key is used (never service-role).
 *   - If injection cannot be completed safely, fails closed with no partial
 *     preview. Generated preview is scanned for the Production ref; any hit
 *     removes the preview and fails. Nothing is printed that reveals key
 *     material. Root `index.html`, source config, and root SW are untouched.
 *
 * Usage: node tools/build-academy-preview.js [--out <pagesDir>] [--src <clientDir>]
 *   defaults: --src client --out dist/pages
 *   env: ACADEMY_STAGING_URL, ACADEMY_STAGING_PUBLISHABLE_KEY
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const STAGING_REF = "uafwvkgaijmcofistjum";
const STAGING_ORIGIN = "https://" + STAGING_REF + ".supabase.co";
const PROD_REF = "bhdgpscedjowchldsjnd";
const PREVIEW_SUBDIR = "academy-preview";
const AUTH_SCRIPT_TAG = '<script src="academy-auth.js"></script>';
const PREVIEW_INDEX_REDIRECT = '<!DOCTYPE html>\n' +
  '<html lang="en">\n' +
  '<head>\n' +
  '<meta charset="UTF-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
  '<meta http-equiv="refresh" content="0; url=../index.html">\n' +
  '<title>Academy preview</title>\n' +
  '</head>\n' +
  '<body>\n' +
  '<p>Academy preview only. The learner app is served from the public root.</p>\n' +
  '<p><a href="../index.html">Open the learner app</a></p>\n' +
  '<p><a href="academy.html">Open the Academy preview</a></p>\n' +
  '<script>try{location.replace("../index.html");}catch(e){}</script>\n' +
  '</body>\n' +
  '</html>\n';

function parseArgs(argv) {
  var src = path.join(ROOT, "client");
  var out = path.join(ROOT, "dist", "pages");
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === "--src" && argv[i + 1]) { src = path.resolve(ROOT, argv[i + 1]); i++; }
    else if (argv[i] === "--out" && argv[i + 1]) { out = path.resolve(argv[i + 1]); i++; }
  }
  return { src: src, out: out };
}

function rmrf(dir) {
  try {
    if (!fs.existsSync(dir)) return;
    if (fs.rmSync) fs.rmSync(dir, { recursive: true, force: true });
    else fs.rmdirSync(dir, { recursive: true });
  } catch (e) {}
}

function fail(msg, previewDir) {
  try { if (previewDir) rmrf(previewDir); } catch (e) {}
  console.log("FAIL academy-preview: " + msg);
  process.exit(1);
}

function hasNewline(s) {
  try { return /[\r\n]/.test(s); } catch (e) { return true; }
}

function validateUrl(raw) {
  if (typeof raw !== "string") return null;
  if (hasNewline(raw)) return null;
  var s = raw.trim();
  if (!s) return null;
  if (hasNewline(s)) return null;
  if (s.length > 200) return null;
  var m = s.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  if (!m) return null;
  var ref = String(m[1]).toLowerCase();
  if (ref !== STAGING_REF) return null;
  return STAGING_ORIGIN;
}

function validateKey(raw) {
  if (typeof raw !== "string") return null;
  if (hasNewline(raw)) return null;
  var s = raw.trim();
  if (!s) return null;
  if (hasNewline(s)) return null;
  if (s.length > 500) return null;
  if (/^eyJ/i.test(s)) return null;
  if (/sb_secret_/i.test(s)) return null;
  if (/service_role/i.test(s)) return null;
  if (!/^sb_publishable_[A-Za-z0-9_\-]{10,200}$/.test(s)) return null;
  return s;
}

function copyTreeFull(srcDir, outDir) {
  var copied = [];
  function walk(rel) {
    var s = rel ? path.join(srcDir, rel) : srcDir;
    var entries = fs.readdirSync(s);
    entries.sort();
    entries.forEach(function (name) {
      var relPath = rel ? rel + "/" + name : name;
      var sp = path.join(srcDir, relPath);
      var dp = path.join(outDir, relPath);
      var st = fs.statSync(sp);
      if (st.isDirectory()) {
        fs.mkdirSync(dp, { recursive: true });
        walk(relPath);
      } else if (st.isFile()) {
        fs.mkdirSync(path.dirname(dp), { recursive: true });
        fs.copyFileSync(sp, dp);
        copied.push(relPath);
      }
    });
  }
  fs.mkdirSync(outDir, { recursive: true });
  walk("");
  return copied.sort();
}

function listFilesRecursive(dir) {
  var out = [];
  function walk(rel) {
    var cur = rel ? path.join(dir, rel) : dir;
    var entries = fs.readdirSync(cur);
    entries.forEach(function (name) {
      var relPath = rel ? rel + "/" + name : name;
      var p = path.join(dir, relPath);
      var st = fs.statSync(p);
      if (st.isDirectory()) walk(relPath);
      else if (st.isFile()) out.push(relPath);
    });
  }
  if (!fs.existsSync(dir)) return out;
  walk("");
  return out.sort();
}

function main() {
  var args = parseArgs(process.argv);
  var previewDir = path.join(args.out, PREVIEW_SUBDIR);
  var rawUrl = process.env.ACADEMY_STAGING_URL;
  var rawKey = process.env.ACADEMY_STAGING_PUBLISHABLE_KEY;
  var urlPresent = typeof rawUrl === "string" && rawUrl.trim() !== "";
  var keyPresent = typeof rawKey === "string" && rawKey.trim() !== "";

  if (!urlPresent && !keyPresent) {
    rmrf(previewDir);
    console.log("academy-preview: skipped (preview variables not set); learner-only artifact unchanged.");
    console.log("RESULT: PASS");
    return;
  }
  if (urlPresent !== keyPresent) {
    fail("both preview variables must be set together; refusing partial preview.", previewDir);
  }
  var url = validateUrl(rawUrl);
  if (!url) {
    fail("invalid Staging URL (expected exact Staging origin).", previewDir);
  }
  var key = validateKey(rawKey);
  if (!key) {
    fail("invalid publishable key (expected sb_publishable_ material).", previewDir);
  }

  if (!fs.existsSync(args.src) || !fs.statSync(args.src).isDirectory()) {
    fail("source tree missing.", previewDir);
  }
  try { fs.mkdirSync(args.out, { recursive: true }); } catch (e) {}

  rmrf(previewDir);
  var copied;
  try {
    copied = copyTreeFull(args.src, previewDir);
  } catch (e) {
    fail("source copy failed; no preview emitted.", previewDir);
  }

  try {
    var required = ["academy.html", "academy-auth.js", "academy-core.js", "academy-portal.js", "supabase-config.js", "sw.js", "index.html"];
    required.forEach(function (f) {
      if (!fs.existsSync(path.join(previewDir, f))) throw new Error("missing required preview file");
    });

    var srcCfgPath = path.join(args.src, "supabase-config.js");
    var prevCfgPath = path.join(previewDir, "supabase-config.js");
    var srcCfg = fs.readFileSync(srcCfgPath, "utf8");
    if (srcCfg.indexOf(PROD_REF) < 0) throw new Error("unexpected source config baseline");
    var prevCfg = srcCfg;
    var prodUrlLit = "https://" + PROD_REF + ".supabase.co";
    if (prevCfg.indexOf(prodUrlLit) < 0) throw new Error("source config URL shape changed");
    prevCfg = prevCfg.split(prodUrlLit).join(url);
    var anonRe = /anonKey:\s*"[^"]*"/;
    if (!anonRe.test(prevCfg)) throw new Error("source config key shape changed");
    prevCfg = prevCfg.replace(anonRe, "anonKey: " + JSON.stringify(key));
    fs.writeFileSync(prevCfgPath, prevCfg);
    var checkCfg = fs.readFileSync(prevCfgPath, "utf8");
    if (checkCfg.indexOf(PROD_REF) >= 0) throw new Error("preview config still references Production");
    if (checkCfg.indexOf(url) < 0) throw new Error("preview config missing Staging target");

    var srcHtmlPath = path.join(args.src, "academy.html");
    var prevHtmlPath = path.join(previewDir, "academy.html");
    var srcHtml = fs.readFileSync(srcHtmlPath, "utf8");
    if (srcHtml.indexOf(AUTH_SCRIPT_TAG) < 0) throw new Error("academy-auth script tag not found");
    var inject = "<script>window.ACADEMY_SUPABASE_CONFIG=" +
      JSON.stringify({ url: url, publishableKey: key }) + ";</script>";
    var prevHtml = srcHtml.replace(AUTH_SCRIPT_TAG, inject + AUTH_SCRIPT_TAG);
    if (prevHtml === srcHtml) throw new Error("preview injection produced no change");
    if (prevHtml.indexOf("window.ACADEMY_SUPABASE_CONFIG") < 0) throw new Error("preview injection missing");
    var iCfg = prevHtml.indexOf("window.ACADEMY_SUPABASE_CONFIG");
    var iAuth = prevHtml.indexOf(AUTH_SCRIPT_TAG);
    if (!(iCfg >= 0 && iAuth >= 0 && iCfg < iAuth)) throw new Error("preview injection order invalid");
    var srcLearnerLinks = srcHtml.split('href="index.html"').length - 1;
    if (srcLearnerLinks > 0) {
      prevHtml = prevHtml.split('href="index.html"').join('href="../index.html"');
      if (prevHtml.indexOf('href="index.html"') >= 0) throw new Error("preview learner links not isolated");
      if (prevHtml.indexOf('href="../index.html"') < 0) throw new Error("preview learner links missing");
    }
    fs.writeFileSync(prevHtmlPath, prevHtml);

    var prevIndexPath = path.join(previewDir, "index.html");
    fs.writeFileSync(prevIndexPath, PREVIEW_INDEX_REDIRECT);
    var checkIndex = fs.readFileSync(prevIndexPath, "utf8");
    if (checkIndex.indexOf("../index.html") < 0) throw new Error("preview index redirect missing");
    if (checkIndex.indexOf("supabase-config") >= 0) throw new Error("preview index loads learner client");
    if (checkIndex.indexOf("SUPABASE_CONFIG") >= 0) throw new Error("preview index exposes Supabase config");
    if (checkIndex.indexOf(PROD_REF) >= 0 || checkIndex.indexOf(STAGING_REF) >= 0) throw new Error("preview index leaks project ref");

    var allPrev = listFilesRecursive(previewDir);
    for (var i = 0; i < allPrev.length; i++) {
      var p = path.join(previewDir, allPrev[i]);
      var st = fs.statSync(p);
      if (!st.isFile()) continue;
      var buf = fs.readFileSync(p);
      if (buf.length > 5 * 1024 * 1024) continue;
      var txt = buf.toString("utf8");
      if (txt.indexOf("\uFFFD") >= 0 && allPrev[i].slice(-3) !== ".js") continue;
      if (txt.indexOf(PROD_REF) >= 0) throw new Error("preview contains unexpected Production reference");
    }
    var secretRe = /sb_secret_[A-Za-z0-9_\-]{10,}|SUPABASE_SERVICE_ROLE_KEY/i;
    var cfgText = fs.readFileSync(prevCfgPath, "utf8");
    var htmlText = fs.readFileSync(prevHtmlPath, "utf8");
    if (secretRe.test(cfgText) && /sb_secret_[A-Za-z0-9_\-]{10,}/.test(cfgText)) throw new Error("preview introduces privileged credential");
    if (/eyJ[A-Za-z0-9_\-]{20,}/.test(cfgText)) throw new Error("preview introduces legacy key material");

    var h = crypto.createHash("sha256");
    allPrev.forEach(function (rel) {
      var b = fs.readFileSync(path.join(previewDir, rel));
      h.update(rel + "\0" + String(b.length) + "\0");
      h.update(b);
    });
    console.log("academy-preview: built isolated Staging preview files=" + copied.length);
    console.log("RESULT: PASS");
  } catch (e) {
    fail("safe injection failed; no preview emitted.", previewDir);
  }
}

main();
