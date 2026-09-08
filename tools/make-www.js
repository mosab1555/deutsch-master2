/* Copies the single-source web files into www/ for Capacitor (technical step only). */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const out = path.join(root, "www");
const FILES = ["index.html", "style.css", "script.js", "launch.js", "launch.css", "manifest.json", "sw.js"];
function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
fs.mkdirSync(out, { recursive: true });
FILES.forEach(f => copy(path.join(root, f), path.join(out, f)));
(function copyDir(rel) {
  const s = path.join(root, rel), d = path.join(out, rel);
  fs.mkdirSync(d, { recursive: true });
  fs.readdirSync(s).forEach(n => {
    const p = path.join(s, n);
    if (fs.statSync(p).isFile() && /\.(png|ico|svg|json)$/i.test(n)) copy(p, path.join(d, n));
  });
})("icons");
console.log("www/ ready:", fs.readdirSync(out).join(", "));
