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
const sents = load("sent"), vocab = load("vocab");
const byDe = new Map(vocab.map(v => [String(v.de).toLowerCase(), v]));
const PCATS = new Set(["family", "people", "relationships", "jobs", "profi"]);
const r6a = sents.filter(r => (r.gram || []).includes("anrufen") && /(تتصل|يتصل|تتصلون|يتصلون) (?!ب|أن)/.test(String(r.ar)));
let person = 0, thing = 0, unk = 0;
const exT = [], exU = [];
for (const r of r6a) {
  const m = String(r.de).match(/ruft (?:den|die|das|einen|eine) ([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ-]+)/);
  if (!m) { unk++; continue; }
  const v = byDe.get(m[1].toLowerCase());
  if (v && PCATS.has(v.cat)) { person++; continue; }
  if (/in$/.test(m[1]) && v && v.type === "noun") { person++; continue; } // -in feminine persons (Klientin, Fahrerin)
  if (v && !PCATS.has(v.cat)) { thing++; if (exT.length < 5) exT.push(r.id + " obj=" + m[1] + "(" + v.cat + ") | " + String(r.de).slice(0, 70)); continue; }
  unk++; if (exU.length < 5) exU.push(r.id + " obj=" + m[1] + " | " + String(r.de).slice(0, 70));
}
console.log("anrufen: person=" + person + " thing=" + thing + " unk=" + unk + " total=" + r6a.length);
exT.forEach(s => console.log("  THING: " + s));
exU.forEach(s => console.log("  UNK: " + s));
