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
// R1 exception hunt: camelCase / ß-start / digit-quote starts
const r1 = sents.filter(r => /^[a-zäöüß]/.test(String(r.de || "").trim()));
const camel = r1.filter(r => /^[a-zäöüß]+[A-ZÄÖÜ]/.test(String(r.de).trim()));
console.log("R1 total=" + r1.length + " camelCase-first-token=" + camel.length);
camel.slice(0, 10).forEach(r => console.log("  " + r.id + " | " + String(r.de).slice(0, 60)));
const ess = r1.filter(r => /^ß/.test(String(r.de).trim()));
console.log("R1 eszett-start=" + ess.length);
// full NAMES ar set for R6
// full NAMES ar set for R6 (parsed from source; requiring build-sentences would run generation)
const bsrc = fs.readFileSync(ROOT + "\\tools\\build-sentences.js", "utf8");
const mN = bsrc.match(/const NAMES = (\[.*?\]);/s);
const localNames = mN ? eval(mN[1]) : [];
const bigsen = require(ROOT + "\\tools\\clib\\bigsen.js");
const allNames = localNames.concat(bigsen.BIGNAMES || []);
console.log("names de=" + allNames.length);
const arNames = new Set(allNames.map(n => n[1]));
const r6r = sents.filter(r => (r.gram || []).includes("ruft-an") && /(تتصل|يتصل|تتصلون|يتصلون) (?!ب)/.test(String(r.ar)));
let okn = 0;
const bad = [];
for (const r of r6r) {
  const m = String(r.ar).match(/(تتصل|يتصل|تتصلون|يتصلون) (\S+)/);
  const tok = m[2].replace(/[.؟!،,;:]+$/, "");
  if (arNames.has(tok)) okn++; else if (bad.length < 10) bad.push(r.id + " tok=" + tok + " | " + r.ar.slice(0, 70));
}
console.log("R6 ruft-an name-mapped=" + okn + " unmapped=" + (r6r.length - okn));
bad.forEach(s => console.log("  " + s));
// anrufen gram with person object?
const r6a = sents.filter(r => (r.gram || []).includes("anrufen") && /(تتصل|يتصل|تتصلون|يتصلون) (?!ب|أن)/.test(String(r.ar)));
console.log("R6 anrufen-gram missing-ب=" + r6a.length);
r6a.slice(0, 6).forEach(r => console.log("  " + r.id + " | " + r.de.slice(0, 80) + " | " + r.ar.slice(0, 70)));
