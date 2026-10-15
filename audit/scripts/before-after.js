"use strict";
// Before/after: recompute audit headline categories on CURRENT (patched) data.
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
const SDIR = ROOT + "\\client\\content\\src";
function load(kind) {
  const files = fs.readdirSync(SDIR).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8")); for (const r of (j.rows || j)) rows.push(r); }
  return rows;
}
const { TIMES, PLACES } = require(ROOT + "\\tools\\clib\\sentgen.js");
const { BIGTIMES, BIGPLACES } = require(ROOT + "\\tools\\clib\\bigsen.js");
const tails = new Set([...TIMES, ...BIGTIMES, ...PLACES, ...BIGPLACES].map(x => x[0]));
const sents = load("sent");
const lower = sents.filter(r => /^[a-zäöüß]/.test(String(r.de || "").trim())).length;
const slash = sents.filter(r => String(r.ar || "").includes("/")).length;
let modal = 0;
for (const r of sents) {
  if (!((r.gram || []).includes("modal-koennen") || (r.gram || []).includes("modal-wollen"))) continue;
  const body = String(r.de).trim().replace(/[.?!]+$/, "");
  for (const t of tails) if (body.endsWith(" " + t)) { modal++; break; }
}
let an = 0;
for (const r of sents) {
  const ms = [...String(r.ar || "").matchAll(/أن (\S+)/g)];
  for (const mm of ms) {
    const tok = mm[1].replace(/[.؟!،,;:()]+$/, "");
    if (!/^[يت].*(ون|ان)$/.test(tok) || tok.length <= 4) continue;
    const t2 = tok.replace(/وو/g, "و");
    if (/ون$/.test(t2)) { const stem = t2.replace(/^[يت]/, "").replace(/ون$/, ""); if (/و$/.test(stem)) continue; an++; break; }
    else if (/ان$/.test(t2)) { an++; break; }
  }
}
const femModal = sents.filter(r => /^(يريد|يستطيع|يود) /.test(String(r.ar || "").trim())).length;
const baMiss = sents.filter(r => ((r.gram || []).join("+") === "ruft-an") && /(تتصل|يتصل|تتصلون|يتصلون) (?!ب)/.test(String(r.ar))).length;
console.log("total=" + sents.length);
console.log("lowercase: before=5953 after=" + lower);
console.log("ar-slash: before=4619 after=" + slash);
console.log("modal-tail(koennen/wollen): before=1088 after=" + modal);
console.log("an-mood violations: before~2208 after=" + an);
console.log("initial-masc-modal remaining=" + femModal + " ruft-an-missing-ba=" + baMiss);
