"use strict";
// Targeted re-emit: src/sent-*.json -> dm-sent-*.js (+ manifest.json bytes +
// dm-lazy.js PACKS bytes for touched packs). Same compact() shape as
// tools/build-emit.js lines 50-92. Does NOT touch .cache, vocab, ex, or UI.
// Run: node audit/scripts/reemit-sent.js
const fs = require("fs"), path = require("path");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
const outDir = ROOT + "\\client\\content", srcDir = outDir + "\\src";
function compactSent(o) {
  return [o.id, o.de, o.ar, o.level, o.topic, o.kap, (o.gram || [])[0] || "", (o.vocab || []).join(",")];
}
const files = fs.readdirSync(srcDir).filter(f => /^sent-\d+\.json$/.test(f)).sort();
const manifest = JSON.parse(fs.readFileSync(outDir + "\\manifest.json", "utf8"));
const manBySrc = new Map(manifest.files.map(f => [f.src, f]));
let touched = 0;
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(srcDir + "\\" + f, "utf8"));
  const num = f.match(/sent-(\d+)\.json/)[1];
  const base = "sent-" + num;
  const rrows = j.rows.map(compactSent);
  const js = "(function(){var C=window.__dmLibChunks=window.__dmLibChunks||{vocab:[],sent:[],gram:[],ex:[],dlg:[],read:[],lis:[],exam:[]};C[" + JSON.stringify("sent") + "].push(" + JSON.stringify(rrows) + ");})();";
  // verify pack registry shape matches existing file (lazy vs sync chunk var)
  const old = fs.readFileSync(outDir + "\\dm-" + base + ".js", "utf8");
  const reg = old.includes("__dmLazyChunks") ? "__dmLazyChunks" : "__dmLibChunks";
  const js2 = js.replace(/__dmLibChunks/g, reg);
  fs.writeFileSync(outDir + "\\dm-" + base + ".js", js2);
  const bytes = fs.statSync(outDir + "\\dm-" + base + ".js").size;
  const entry = manBySrc.get("content/src/" + base + ".json");
  if (entry) { entry.bytes = bytes; entry.count = j.rows.length; }
  touched++;
}
fs.writeFileSync(outDir + "\\manifest.json", JSON.stringify(manifest, null, 1), "utf8");
// refresh dm-lazy PACKS bytes for sent packs (same file-stat mechanism)
let lazy = fs.readFileSync(outDir + "\\dm-lazy.js", "utf8");
const m = lazy.match(/var PACKS = (\[.*?\]);/s);
if (!m) { console.log("PACKS block not found"); process.exit(1); }
const packs = JSON.parse(m[1]);
for (const p of packs) {
  if (!p.file.startsWith("content/dm-sent-")) continue;
  try { p.bytes = fs.statSync(ROOT + "\\client\\" + p.file).size; } catch (e) {}
}
lazy = lazy.replace(m[0], "var PACKS = " + JSON.stringify(packs) + ";");
fs.writeFileSync(outDir + "\\dm-lazy.js", lazy, "utf8");
console.log("re-emitted " + touched + " sent packs + manifest + dm-lazy bytes");
// verify: id alignment src vs dm for 3 packs
for (const n of ["01", "15", "31"]) {
  const src = JSON.parse(fs.readFileSync(srcDir + "\\sent-" + n + ".json", "utf8")).rows.map(r => r.id);
  const dmS = fs.readFileSync(outDir + "\\dm-sent-" + n + ".js", "utf8");
  const dm = [...dmS.matchAll(/"ls\d+"/g)].map(x => x[0].slice(1, -1));
  const ok = src.length === dm.length && src.every((id, i) => id === dm[i]);
  console.log("pack sent-" + n + ": src=" + src.length + " dm=" + dm.length + " aligned=" + ok);
}
