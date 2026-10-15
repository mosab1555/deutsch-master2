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
const lines = fs.readFileSync(ROOT + "\\audit\\sentences-lowercase.csv", "utf8").split("\n").slice(1).filter(Boolean);
const pat = {};
for (const l of lines) {
  const id = l.slice(1, l.indexOf('","') > 0 ? 8 : 8);
  const m = l.match(/^"(ls\d+)"/);
  if (!m) continue;
  const r = byId.get(m[1]);
  if (!r) continue;
  const g = (r.gram || []).join("+");
  pat[g] = (pat[g] || 0) + 1;
}
const top = Object.entries(pat).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log("lowercase rows in csv=" + lines.length);
top.forEach(([g, n]) => console.log("  " + n + "  " + g));
// first tokens
const tok = {};
for (const l of lines.slice(0, 5953)) {
  const m = l.match(/^"ls\d+","([^"]*?) /);
  if (m) { const w = m[1].split(" ")[0]; tok[w] = (tok[w] || 0) + 1; }
}
console.log("top first-tokens:");
Object.entries(tok).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([w, n]) => console.log("  " + n + "  " + w));
