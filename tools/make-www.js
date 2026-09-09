/* Copies the single-source client files into www/ for Capacitor (technical step only). */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "client");
const out = path.join(__dirname, "..", "www");
function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
function copyDirRecursive(rel) {
  const s = path.join(root, rel), d = path.join(out, rel);
  if (!fs.existsSync(s)) return;
  fs.mkdirSync(d, { recursive: true });
  fs.readdirSync(s).forEach((n) => {
    const p = path.join(s, n), q = path.join(d, n);
    if (p === out) return;
    if (fs.statSync(p).isDirectory()) copyDirRecursive(path.join(rel, n));
    else copy(p, q);
  });
}
fs.mkdirSync(out, { recursive: true });
copyDirRecursive("");
console.log("www/ ready:", fs.readdirSync(out).join(", "));
