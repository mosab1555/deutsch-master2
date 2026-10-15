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
function dist(csv) {
  const lines = fs.readFileSync(ROOT + "\\audit\\" + csv, "utf8").split("\n").slice(1).filter(Boolean);
  const pat = {};
  for (const l of lines) {
    const m = l.match(/^"(ls\d+)"/);
    if (!m) continue;
    const r = byId.get(m[1]);
    if (!r) continue;
    const g = (r.gram || []).join("+");
    pat[g] = (pat[g] || 0) + 1;
  }
  return { n: lines.length, top: Object.entries(pat).sort((a, b) => b[1] - a[1]) };
}
console.log("== wordorder ==");
let d = dist("sentences-wordorder.csv");
console.log("rows=" + d.n);
d.top.slice(0, 20).forEach(([g, n]) => console.log("  " + n + "  " + g));
console.log("== article ==");
d = dist("sentences-article.csv");
console.log("rows=" + d.n);
d.top.slice(0, 20).forEach(([g, n]) => console.log("  " + n + "  " + g));
