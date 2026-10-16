/* Deutsch Master — learner-only GitHub Pages artifact builder (deterministic).
 *
 * Copies the public learner app from client/ into dist/pages/ while
 * excluding the Academy portal entry-point files until Academy is safely
 * configured for Staging:
 *   EXCLUDED = academy.html, academy-core.js, academy-auth.js, academy-portal.js
 *
 * The generated artifact's Service Worker precache list (DM_FILES) is
 * patched to drop the same excluded resources so installation never fails
 * for missing files. Source client/sw.js is NEVER mutated.
 *
 * Deterministic: same client/ bytes => same dist/pages/ bytes (file copies
 * are byte-identical; the sw.js patch is a fixed string rewrite).
 * Output lives under dist/ (gitignored) and stays out of tracked source.
 *
 * Usage: node tools/build-pages-artifact.js [--out <dir>] [--src <dir>]
 *   defaults: --src client --out dist/pages
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EXCLUDED = ["academy.html", "academy-core.js", "academy-auth.js", "academy-portal.js"];

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
  if (!fs.existsSync(dir)) return;
  if (fs.rmSync) fs.rmSync(dir, { recursive: true, force: true });
  else fs.rmdirSync(dir, { recursive: true });
}

function copyTree(srcDir, outDir) {
  var copied = [];
  function walk(rel) {
    var s = rel ? path.join(srcDir, rel) : srcDir;
    var entries = fs.readdirSync(s);
    entries.forEach(function (name) {
      var relPath = rel ? rel + "/" + name : name;
      if (EXCLUDED.indexOf(relPath) >= 0) return;
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

function patchServiceWorker(outDir) {
  var swPath = path.join(outDir, "sw.js");
  if (!fs.existsSync(swPath)) throw new Error("generated sw.js missing: " + swPath);
  var s = fs.readFileSync(swPath, "utf8");
  var before = s;
  // Drop the three excluded precache entries deterministically.
  // Handles `"./x",` with trailing comma/whitespace/newlines.
  EXCLUDED.forEach(function (f) {
    var quoted = '"./' + f + '"';
    // Remove `"<file>",` plus one run of following whitespace (covers
    // both inline `"a", "b",` and line-break layouts).
    var re = new RegExp(quoted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*,\\s*", "g");
    s = s.replace(re, "");
  });
  // Safety: collapse any accidental `,,` left by edge layouts.
  s = s.replace(/,\s*,/g, ",");
  // Safety: `[,` after `[` (if first entry was removed) -> `[`.
  s = s.replace(/\[\s*,/g, "[");
  if (s === before) throw new Error("sw.js patch produced no change (expected to remove Academy entries)");
  EXCLUDED.forEach(function (f) {
    if (s.indexOf('"./' + f + '"') >= 0) throw new Error("sw.js still precaches excluded file: " + f);
  });
  fs.writeFileSync(swPath, s);
  return s;
}

function main() {
  var args = parseArgs(process.argv);
  if (!fs.existsSync(args.src)) {
    console.log("FAIL pages-artifact: src missing: " + args.src);
    process.exit(1);
  }
  rmrf(args.out);
  var copied = copyTree(args.src, args.out);
  EXCLUDED.forEach(function (f) {
    if (fs.existsSync(path.join(args.out, f))) {
      console.log("FAIL pages-artifact: excluded file present in output: " + f);
      process.exit(1);
    }
  });
  ["index.html", "privacy.html", "terms.html", "sw.js"].forEach(function (f) {
    if (!fs.existsSync(path.join(args.out, f))) {
      console.log("FAIL pages-artifact: required learner file missing in output: " + f);
      process.exit(1);
    }
  });
  patchServiceWorker(args.out);
  console.log("pages-artifact: copied=" + copied.length + " excluded=" + EXCLUDED.join(",") + " out=" + path.relative(ROOT, args.out));
  console.log("RESULT: PASS");
}

main();
