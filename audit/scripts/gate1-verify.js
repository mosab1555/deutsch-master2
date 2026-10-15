"use strict";
// Gate 1 verification: recompute headline defect counts from CURRENT working-tree
// src/*.json and compare with audit/sentences-summary.json. No writes.
const fs = require("fs");
const path = require("path");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
function load(kind) {
  const d = path.join(ROOT, "client", "content", "src");
  const files = fs.readdirSync(d).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); for (const r of (j.rows || j)) rows.push(r); }
  return rows;
}
const sents = load("sent");
const sum = JSON.parse(fs.readFileSync(path.join(ROOT, "audit", "sentences-summary.json"), "utf8"));
const lower = sents.filter(r => { const t = String(r.de || "").trim(); return t && t[0] === t[0].toLowerCase() && /[a-zäöü]/.test(t[0]); }).length;
const kx = sents.filter(r => !r.kap || r.kap === "KX").length;
const slash = sents.filter(r => String(r.ar || "").includes("/")).length;
console.log("total=" + sents.length + " (audit " + sum.total + ") " + (sents.length === sum.total ? "MATCH" : "MISMATCH"));
console.log("lowercase=" + lower + " (audit " + sum.categories.lowercase.count + ") " + (lower === sum.categories.lowercase.count ? "MATCH" : "MISMATCH"));
console.log("kx=" + kx + " (audit " + sum.categories.kx.count + ") " + (kx === sum.categories.kx.count ? "MATCH" : "MISMATCH"));
console.log("arabic-slash=" + slash + " (audit F4b 4619)");
const vocab = load("vocab");
console.log("vocab=" + vocab.length + " (audit " + sum.vocabSize + ")");
