"use strict";
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
const SDIR = ROOT + "\\client\\content\\src";
function load(kind) {
  const d = SDIR;
  const files = fs.readdirSync(d).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(d + "\\" + f, "utf8")); for (const r of (j.rows || j)) rows.push({ ...r, _file: f }); }
  return rows;
}
const sents = load("sent");
const byId = new Map(sents.map(r => [r.id, r]));
// R3b shape check
const r3 = sents.filter(r => String(r.ar || "").includes("/"));
const nospace = r3.filter(r => !String(r.ar).includes(" / "));
console.log("nospace=" + nospace.length + " all-(شخص/مكان)=" + nospace.filter(r => String(r.ar).includes("(شخص/مكان)")).length);
const other = nospace.filter(r => !String(r.ar).includes("(شخص/مكان)"));
other.slice(0, 8).forEach(r => console.log("  OTHER: " + r.id + " | " + r.ar.slice(0, 130)));
// R5 subject check
const r5 = sents.filter(r => /العائلة/.test(String(r.ar)) && /يحيي/.test(String(r.ar)));
console.log("R5 startswith-العائلة=" + r5.filter(r => /^العائلة/.test(String(r.ar).trim())).length + " total=" + r5.length);
r5.filter(r => !/^العائلة/.test(String(r.ar).trim())).forEach(r => console.log("  NONSUBJ: " + r.id + " | " + r.ar.slice(0, 80)));
// R6 ruft-an only
const r6r = sents.filter(r => (r.gram || []).includes("ruft-an") && /(تتصل|يتصل|تتصلون|يتصلون) (?!ب)/.test(String(r.ar)));
console.log("R6 ruft-an missing-ب=" + r6r.length);
r6r.slice(0, 6).forEach(r => console.log("  " + r.id + " | " + r.de + " | " + r.ar));
const NAMES = { Ahmed: 1, Mona: 1, Jonas: 1, Sara: 1, Omar: 1, Anna: 1, Layla: 1, Lena: 1, Emma: 1, Marie: 1, Nour: 1, Fatima: 1, Dina: 1, Heba: 1, Tarek: 1, Felix: 1, Dina: 1 };
console.log("R6 ruft-an de-has-known-name=" + r6r.filter(r => /\b(Ahmed|Mona|Jonas|Sara|Omar|Anna|Layla|Lena|Emma|Marie|Nour|Fatima|Dina|Heba|Tarek|Felix)\b/.test(String(r.de))).length);
// R2 extra 137: modal rows ending pool phrase whose last word ends n (D1 false-negatives)
const { TIMES, PLACES } = require(ROOT + "\\tools\\clib\\sentgen.js");
const { BIGTIMES, BIGPLACES } = require(ROOT + "\\tools\\clib\\bigsen.js");
const poolPhrases = new Set([...TIMES, ...BIGTIMES, ...PLACES, ...BIGPLACES].map(x => x[0]));
let extra = 0;
for (const r of sents) {
  if (!((r.gram || []).includes("modal-koennen") || (r.gram || []).includes("modal-wollen"))) continue;
  const de = String(r.de).trim().replace(/[.?!]+$/, "");
  const last = de.split(" ").pop().toLowerCase();
  let pool = false;
  for (const ph of poolPhrases) if (de.endsWith(" " + ph)) { pool = true; break; }
  if (pool && /(en|n)$/.test(last)) { extra++; if (extra <= 5) console.log("  D1-FN: " + r.id + " | " + r.de); }
}
console.log("R2 D1-false-negatives=" + extra);
// R7 refined: hollow-singular guard
let r7keep = 0, r7fix = 0;
const hollowEx = [];
for (const r of sents) {
  const m = String(r.ar).match(/أن (\S+)/g);
  if (!m) continue;
  for (const mm of m) {
    const tok = mm.slice(2).trim().replace(/[.؟!،,;:]+$/, "");
    if (/^[يت].*ون$/.test(tok) && tok.length > 3) {
      const stem = tok.replace(/^[يت]/, "").replace(/ون$/, "");
      if (/و$/.test(stem)) { r7keep++; if (hollowEx.length < 6) hollowEx.push(r.id + " KEEP " + tok + " || " + String(r.ar).slice(0, 70)); }
      else { r7fix++; }
      break;
    } else if (/^[يت].*ان$/.test(tok) && tok.length > 4) { r7fix++; break; }
  }
}
console.log("R7 fix=" + r7fix + " hollow-kept=" + r7keep);
hollowEx.forEach(s => console.log("  " + s));
