"use strict";
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
function load(kind) {
  const d = ROOT + "\\client\\content\\src";
  const files = fs.readdirSync(d).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(d + "\\" + f, "utf8")); for (const r of (j.rows || j)) rows.push(r); }
  return rows;
}
const sents = load("sent");
const byId = new Map(sents.map(r => [r.id, r]));
const lines = fs.readFileSync(ROOT + "\\audit\\sentences-article.csv", "utf8").split("\n").slice(1).filter(Boolean);
for (const l of lines) {
  const m = l.match(/^"(ls\d+)"/);
  const r = byId.get(m[1]);
  if ((r.gram || []).join("+") !== "wehtun") console.log(r.id + " [" + (r.gram || []).join("+") + "] " + r.de + " | " + r.ar);
}
// wehtun sample: verify dative-fronted shape
let n = 0;
for (const l of lines) {
  const m = l.match(/^"(ls\d+)"/);
  const r = byId.get(m[1]);
  if ((r.gram || []).join("+") === "wehtun") { if (n < 4) console.log("WEH: " + r.de); n++; }
}
console.log("wehtun count=" + n);
