"use strict";
// Post-write verification: counts, IDs, shape, spot rows. No writes.
const fs = require("fs");
const SDIR = "C:\\Users\\mosab\\Desktop\\deutsch-master2\\client\\content\\src";
const files = fs.readdirSync(SDIR).filter(f => f.startsWith("sent-") && f.endsWith(".json")).sort();
let total = 0;
const ids = new Set();
let dup = 0;
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8"));
  if (!j.rows || j.kind !== "sent") console.log("SHAPE-ISSUE " + f);
  for (const r of j.rows) {
    total++;
    if (ids.has(r.id)) dup++;
    ids.add(r.id);
    if (!r.id || !r.de || !r.ar || !r.level || !("kap" in r) || !Array.isArray(r.gram) || !Array.isArray(r.vocab)) console.log("FIELD-ISSUE " + r.id);
  }
}
console.log("total=" + total + " dupIds=" + dup);
// spot rows
function show(id) {
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8"));
    const r = j.rows.find(x => x.id === id);
    if (r) { console.log(id + " | " + r.de + " | " + r.ar); return; }
  }
}
["ls00001", "ls00003", "ls00028", "ls13279", "ls01163", "ls00263", "ls00020", "ls00031", "ls153479", "ls149440"].forEach(show);
