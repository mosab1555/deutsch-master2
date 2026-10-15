"use strict";
// Dry-run analyzer: quantify each remediation rule against CURRENT src data.
// No writes. Usage: node audit/scripts/remediate-analyze.js
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
const SDIR = ROOT + "\\client\\content\\src";
function load(kind) {
  const files = fs.readdirSync(SDIR).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8")); for (const r of (j.rows || j)) rows.push({ ...r, _file: f }); }
  return rows;
}
const { TIMES, PLACES } = require(ROOT + "\\tools\\clib\\sentgen.js");
const { BIGTIMES, BIGPLACES } = require(ROOT + "\\tools\\clib\\bigsen.js");
const poolPhrases = new Set([...TIMES, ...BIGTIMES, ...PLACES, ...BIGPLACES].map(x => x[0]));
const sents = load("sent");

// R1: lowercase first alpha
const r1 = sents.filter(r => /^[a-zäöüß]/.test(String(r.de || "").trim()));
console.log("R1 lowercase-candidate=" + r1.length);
const firstTok = {};
r1.forEach(r => { const w = String(r.de).trim().split(" ")[0]; firstTok[w] = (firstTok[w] || 0) + 1; });
const weird = Object.entries(firstTok).filter(([w]) => /[A-Z0-9@#iPhone]|^e-|^ß/.test(w));
console.log("R1 weird-first-tokens=" + JSON.stringify(weird.slice(0, 10)));

// R2: modal-koennen/wollen rows where de ends "<inf> <tail>." with tail in pool
const MODAL_DE = ["kann", "kannst", "können", "will", "willst", "wollen", "muss", "musst", "müssen", "darf", "darfst", "dürfen", "soll", "sollst", "sollen", "möchte", "möchtest", "möchten"];
let r2ok = 0, r2no = 0;
const r2ex = [];
for (const r of sents) {
  if (!((r.gram || []).includes("modal-koennen") || (r.gram || []).includes("modal-wollen"))) continue;
  const de = String(r.de).trim().replace(/[.?!]+$/, "");
  let hit = null;
  for (const ph of poolPhrases) { if (de.endsWith(" " + ph)) { hit = ph; break; } }
  if (!hit) { r2no++; if (r2ex.length < 5) r2ex.push("NOMATCH: " + r.id + " | " + r.de); continue; }
  const pre = de.slice(0, de.length - hit.length).trim().split(" ");
  const inf = pre[pre.length - 1];
  if (!/^[a-zäöüß]+(en|n|eln|ern)$/.test(inf) || inf.length < 4 || MODAL_DE.includes(inf.toLowerCase())) { r2no++; if (r2ex.length < 5) r2ex.push("NOINF: " + r.id + " | " + r.de); continue; }
  r2ok++;
}
console.log("R2 modal-reorder patchable=" + r2ok + " leftover=" + r2no);
r2ex.forEach(s => console.log("   " + s));

// R3: ar with "/"
const r3 = sents.filter(r => String(r.ar || "").includes("/"));
console.log("R3 ar-slash=" + r3.length);
// any ar slash NOT " / " separated? (fractions, dates)
const nospace = r3.filter(r => !String(r.ar).includes(" / "));
console.log("R3 slash-without-spaces=" + nospace.length);
nospace.slice(0, 8).forEach(r => console.log("   " + r.id + " | " + r.ar.slice(0, 120)));

// R4: يريد نحن with Wir wollen
const r4 = sents.filter(r => String(r.ar).includes("يريد نحن"));
console.log("R4 يريد-نحن=" + r4.length + " with-Wir-wollen=" + r4.filter(r => /^Wir wollen/.test(String(r.de))).length);
r4.filter(r => !/^Wir wollen/.test(String(r.de))).slice(0, 5).forEach(r => console.log("   NONWIR: " + r.id + " | " + r.de + " | " + r.ar));

// R5: يحيي with Familie subject
const r5 = sents.filter(r => /العائلة/.test(String(r.ar)) && /يحيي/.test(String(r.ar)));
console.log("R5 family-يحيي=" + r5.length);
r5.slice(0, 6).forEach(r => console.log("   " + r.id + " | " + r.de + " | " + r.ar));

// R6: تتصل/يتصل + name without بـ
const r6 = sents.filter(r => /(تتصل|يتصل|اتصل|تتصلون|يتصلون) (?!ب|بـ|أن|لكي|كي)/.test(String(r.ar)));
console.log("R6 missing-ب-candidate=" + r6.length);
r6.slice(0, 8).forEach(r => console.log("   " + r.id + " [" + (r.gram || []).join("+") + "] " + r.de + " | " + r.ar));

// R7: أن + indicative (ون/ان endings)
let r7 = 0;
const r7ex = [];
for (const r of sents) {
  const m = String(r.ar).match(/أن (\S+)/g);
  if (!m) continue;
  for (const mm of m) {
    const tok = mm.slice(2).trim().replace(/[.؟!،,;:]+$/, "");
    if (/^(ي|ت).*(ون|ان)$/.test(tok) && tok.length > 4 && !/(وا|ا)$/.test(tok.replace(/(ون|ان)$/, ""))) { r7++; if (r7ex.length < 8) r7ex.push(r.id + " | " + tok + " || " + r.ar.slice(0, 90)); break; }
  }
}
console.log("R7 أن+indicative=" + r7);
r7ex.forEach(s => console.log("   " + s));

// R8: superlativ die→هو
const r8 = sents.filter(r => (r.gram || []).includes("superlativ") && /^die \S+ ist am /.test(String(r.de)) && / هو /.test(String(r.ar)));
console.log("R8 superlativ-هو-fem=" + r8.length);
r8.slice(0, 4).forEach(r => console.log("   " + r.id + " | " + r.de + " | " + r.ar));
