"use strict";
// App-compat check: load sync packs in a window stub, verify merge shape + patched rows.
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
global.window = {};
function loadPack(f) {
  const code = fs.readFileSync(ROOT + "\\client\\" + f, "utf8");
  eval(code);
}
["content/dm-sent-01.js", "content/dm-sent-02.js", "content/dm-sent-03.js", "content/dm-vocab-01.js"].forEach(loadPack);
const sents = [];
(global.window.__dmLibChunks.sent || []).forEach(chunk => chunk.forEach(r => sents.push(r)));
console.log("loaded sent rows=" + sents.length);
const byId = new Map(sents.map(r => [r[0], r]));
for (const id of ["ls00001", "ls00003", "ls00028", "ls01163"]) {
  const r = byId.get(id);
  console.log(id + " | " + r[1] + " | " + r[2] + " | lvl=" + r[3] + " kap=" + r[5] + " gram=" + r[6]);
}
// shape: [id,de,ar,level,topic,kap,gram,vocabCsv]
const badShape = sents.filter(r => !(Array.isArray(r) && r.length === 8 && typeof r[0] === "string"));
console.log("bad-shape rows=" + badShape.length);
const man = JSON.parse(fs.readFileSync(ROOT + "\\client\\content\\manifest.json", "utf8"));
console.log("manifest sent total=" + man.files.filter(f => f.kind === "sent").reduce((a, f) => a + f.count, 0));
