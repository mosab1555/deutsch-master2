"use strict";
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
const SDIR = ROOT + "\\client\\content\\src";
function load(kind) {
  const files = fs.readdirSync(SDIR).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8")); for (const r of (j.rows || j)) rows.push({ ...r, _file: f }); }
  return rows;
}
const sents = load("sent");
const r6a = sents.filter(r => (r.gram || []).includes("anrufen") && /(تتصل|يتصل|تتصلون|يتصلون) (?!ب|أن)/.test(String(r.ar)));
r6a.filter(r => !/ruft (?:den|die|das|einen|eine) [A-ZÄÖÜ]/.test(String(r.de))).slice(0, 12).forEach(r => console.log(r.id + " | " + r.de + " | " + r.ar.slice(0, 80)));
