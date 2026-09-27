/* Deutsch Master — deterministic per-deployment asset versioning.
   Rewrites local relative JS/CSS refs in client/*.html to `file?v=VERSION`
   so every deployment has stable, unique asset URLs (no stale caches anywhere:
   browser HTTP cache, CDN, proxies, Service Worker).
   Deterministic: same VERSION + same source = byte-identical output.
   Idempotent: existing ?v= is stripped first, then re-applied.
   Usage: node tools/inject-version.js [VERSION]
     VERSION defaults to `git rev-parse --short HEAD`, then "dev".
   Normally invoked ONLY by .github/workflows/deploy.yml with ${{ github.sha }}.
*/
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const FILES = ["client/index.html", "client/academy.html"];
function resolveVersion(arg) {
  if (arg && /^[0-9a-f]{4,40}$/i.test(arg)) return arg.slice(0, 7);
  try {
    const sha = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
    if (/^[0-9a-f]{4,40}$/i.test(sha)) return sha.slice(0, 7);
  } catch (e) {}
  return "dev";
}
function versionFile(relPath, ver) {
  const abs = path.join(ROOT, relPath);
  let s = fs.readFileSync(abs, "utf8");
  const before = s;
  // strip any previous ?v= (idempotency), then apply to local .js/.css refs only
  s = s.replace(/((?:src|href)=")([^"]+?)\?v=[^"]*(")/g, "$1$2$3");
  s = s.replace(/((?:src|href)=")((?!(?:https?:|data:|#))[A-Za-z0-9_.\-\/]+\.(?:js|css))(")/g, "$1$2?v=" + ver + "$3");
  if (s !== before) fs.writeFileSync(abs, s);
  const n = (s.match(/\?v=/g) || []).length;
  console.log(relPath + ": " + n + " asset refs versioned (v=" + ver + ")");
  return n;
}
const ver = resolveVersion(process.argv[2]);
let total = 0;
FILES.forEach(f => { total += versionFile(f, ver); });
if (!total) { console.log("FAIL no refs versioned"); process.exit(1); }
console.log("RESULT: PASS version=" + ver);
