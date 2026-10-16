/* Deutsch Master - client/www parity check (Phase 0, READ-ONLY).
 *
 * Verifies that the committed www/ mirror matches client/ (the single source
 * of truth) without modifying anything:
 *  W1 recursive file list identical (relative paths, files only)
 *  W2 byte-identical content (HTML normalized for ?v=<sha> cache-busting only)
 *  W3 required manifests present in both trees
 *  W4 every dm-lazy PACK runtime file exists in both trees
 *  W5 every sw.js DM_FILES precache entry resolves in both trees
 *
 * Usage: node tools/check-www-parity.js   (exit 0 = PASS, 1 = drift found)
 * On drift, the fix is intentional: `npm run www`, review the diff, re-run.
 * This script never writes, deletes, or rewrites any file.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const WWW = path.join(ROOT, "www");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name + (extra ? " | " + extra : "")); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

function walk(dir, base) {
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const rel = base ? base + "/" + n : n;
    if (fs.statSync(p).isDirectory()) out.push(...walk(p, rel));
    else out.push(rel);
  }
  return out.sort();
}

if (!fs.existsSync(CLIENT)) { console.log("FAIL W0 client/ missing"); process.exit(1); }
if (!fs.existsSync(WWW)) { console.log("FAIL W0 www/ missing (run npm run www intentionally)"); process.exit(1); }

const cf = walk(CLIENT, "");
const wf = walk(WWW, "");
const onlyC = cf.filter(f => !wf.includes(f));
const onlyW = wf.filter(f => !cf.includes(f));
ok("W1 recursive file list identical", onlyC.length === 0 && onlyW.length === 0,
  "client=" + cf.length + " www=" + wf.length +
  (onlyC.length ? " onlyC=" + onlyC.slice(0, 10).join(",") : "") +
  (onlyW.length ? " onlyW=" + onlyW.slice(0, 10).join(",") : ""));

let diffs = [];
for (const f of cf) {
  if (!wf.includes(f)) continue;
  let a = fs.readFileSync(path.join(CLIENT, f));
  let b = fs.readFileSync(path.join(WWW, f));
  if (/\.html$/.test(f)) {
    const norm = s => s.toString("utf8").replace(/\?v=[0-9a-f]+/g, "?v=X");
    if (norm(a) !== norm(b)) diffs.push(f);
  } else if (!a.equals(b)) diffs.push(f);
}
ok("W2 content identical (mod ?v= in HTML)", diffs.length === 0, diffs.slice(0, 10).join(",") || ("files=" + cf.length));

for (const m of ["content/manifest.json", "content/curriculum-manifest.json", "content/dm-lazy.js", "sw.js", "manifest.json"]) {
  const c = fs.existsSync(path.join(CLIENT, m)), w = fs.existsSync(path.join(WWW, m));
  ok("W3 " + m + " present in client+www", c && w);
}

try {
  const lazy = fs.readFileSync(path.join(CLIENT, "content", "dm-lazy.js"), "utf8");
  const packs = [...lazy.matchAll(/"(content\/dm-[a-z0-9-]+\.js)"/g)].map(x => x[1]);
  const uniq = [...new Set(packs)];
  const missC = uniq.filter(p => !fs.existsSync(path.join(CLIENT, p)));
  const missW = uniq.filter(p => !fs.existsSync(path.join(WWW, p)));
  ok("W4 dm-lazy PACKS resolve in client (" + uniq.length + ")", missC.length === 0, missC.slice(0, 5).join(","));
  ok("W4 dm-lazy PACKS resolve in www (" + uniq.length + ")", missW.length === 0, missW.slice(0, 5).join(","));
} catch (e) {
  ok("W4 dm-lazy PACKS resolvable", false, e.message);
}

try {
  const sw = fs.readFileSync(path.join(CLIENT, "sw.js"), "utf8");
  const files = [...sw.matchAll(/"\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(x => x[1]);
  const uniq = [...new Set(files)];
  const missC = uniq.filter(p => !fs.existsSync(path.join(CLIENT, p)));
  const missW = uniq.filter(p => !fs.existsSync(path.join(WWW, p)));
  ok("W5 sw DM_FILES resolve in client (" + uniq.length + ")", missC.length === 0, missC.slice(0, 5).join(","));
  ok("W5 sw DM_FILES resolve in www (" + uniq.length + ")", missW.length === 0, missW.slice(0, 5).join(","));
} catch (e) {
  ok("W5 sw DM_FILES resolvable", false, e.message);
}

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
process.exit(fail ? 1 : 0);
