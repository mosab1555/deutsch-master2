/* Temp: find duplicate German example sentences across reference data. */
const fs = require("fs");
const path = require("path");
const CDIR = path.join(__dirname, "..", "client");
const html = fs.readFileSync(path.join(CDIR, "index.html"), "utf8");
const files = [...html.matchAll(/<script src="(reference-data-[^"]+\.js)"><\/script>/g)].map(m => m[1]);
const window = {};
files.forEach(f => {
  const src = fs.readFileSync(path.join(CDIR, f), "utf8");
  const names = [...src.matchAll(/^var (REF_[A-Z][A-Z0-9]*)/gm)].map(m => m[1]);
  const box = {};
  eval(src + ";" + names.map(n => "box." + n + "=(typeof " + n + "!==\"undefined\"?" + n + ":undefined);").join(""));
  names.forEach(n => { window[n] = box[n]; });
});
const seen = {};
let dups = 0;
Object.keys(window).forEach(k => {
  (window[k] || []).forEach(tp => {
    (tp.examples || []).forEach(e => {
      const de = String(e[0] || "").trim();
      if (!de) return;
      if (seen[de]) { console.log("DUP in " + tp.id + " (first in " + seen[de] + "): " + de.slice(0, 60)); dups++; }
      else seen[de] = tp.id;
    });
  });
});
console.log("examples=" + Object.keys(seen).length + " dups=" + dups);
process.exit(dups ? 1 : 0);
