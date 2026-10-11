"use strict";
/* Deutsch Master — Authoritative Content Inventory (Phase 2).
 * Counts REAL records across every layer, never manifest declarations:
 *  - tools/clib/.cache/*.json (generator output)
 *  - client/content/src/*.json (source of truth for packs)
 *  - client/content/dm-*.js runtime packs (what the browser executes)
 *  - client/content/manifest.json declarations (for parity check only)
 *  - base banks in client/script.js (RAW_K*, RAW_SENT) merged at boot
 * Reports: physical/valid/unique vocab, headwords, dups, by level/cat/type/pack,
 * sentence valid/unique by level/chapter, source->output parity, missing packs.
 * Usage: node tools/content-inventory-audit.js [--json out.json]
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const AR_RE = /[\u0600-\u06FF]/;

function normDE(s) {
  return String(s || "").toLowerCase().replace(/[\s\u00A0]+/g, " ").trim()
    .replace(/[„“”"«»]/g, "").replace(/[.?!…,;:]+$/g, "").replace(/\s+/g, " ");
}
function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; }
}
function countRuntimeRows(file) {
  // Runtime packs push compact rows: __dmLibPush/__dmLazyPush/C["vocab"].push etc.
  // Count rows robustly: for vocab/sent packs each row starts with ["lv or ["ls
  try {
    const s = fs.readFileSync(file, "utf8");
    const mVoc = s.match(/\["lv\d+/g) || [];
    const mSent = s.match(/\["ls\d+/g) || [];
    const mEx = s.match(/\["le\d+/g) || [];
    const mDlg = s.match(/\["ld\d+/g) || [];
    return { lv: mVoc.length, ls: mSent.length, le: mEx.length, ld: mDlg.length, bytes: s.length };
  } catch (e) { return { lv: 0, ls: 0, le: 0, ld: 0, bytes: 0, error: String(e.message) }; }
}

const out = { generated: new Date().toISOString(), layers: {}, vocab: {}, sentences: {}, parity: {}, packs: {} };

// ---- 1. cache layer ----
const cacheDir = path.join(ROOT, "tools", "clib", ".cache");
const cacheFiles = { vocab: "vocab.json", sentences: "sentences.json", grammar: "grammar.json", exercises: "exercises.json", dialogues: "dialogues.json", reading: "reading.json", listening: "listening.json", exams: "exams.json" };
out.layers.cache = {};
for (const [k, f] of Object.entries(cacheFiles)) {
  const p = path.join(cacheDir, f);
  if (!fs.existsSync(p)) { out.layers.cache[k] = { missing: true }; continue; }
  try {
    const j = readJSON(p);
    const arr = Array.isArray(j) ? j : (j.rows || j.vocab || j.sentences || j.exercises || []);
    out.layers.cache[k] = { file: f, physical: arr.length, bytes: fs.statSync(p).size };
    if (k === "vocab") out._cacheVocab = arr;
    if (k === "sentences") out._cacheSent = arr;
  } catch (e) { out.layers.cache[k] = { error: String(e.message) }; }
}

// ---- 2. src layer ----
const srcDir = path.join(ROOT, "client", "content", "src");
out.layers.src = { vocab: 0, sent: 0, files: {} };
out._srcVocab = []; out._srcSent = [];
if (fs.existsSync(srcDir)) {
  for (const f of fs.readdirSync(srcDir).filter(x => x.endsWith(".json"))) {
    try {
      const j = readJSON(path.join(srcDir, f));
      const rows = (j && j.rows) || [];
      out.layers.src.files[f] = { kind: j.kind, physical: rows.length };
      if (j.kind === "vocab") { out.layers.src.vocab += rows.length; out._srcVocab.push(...rows); }
      if (j.kind === "sent") { out.layers.src.sent += rows.length; out._srcSent.push(...rows); }
    } catch (e) { out.layers.src.files[f] = { error: String(e.message) }; }
  }
}

// ---- 3. runtime layer ----
const contentDir = path.join(ROOT, "client", "content");
out.layers.runtime = { vocab: 0, sent: 0, byPack: {} };
for (const f of fs.readdirSync(contentDir).filter(x => /^dm-(vocab|sent)-.*\.js$/.test(x))) {
  const c = countRuntimeRows(path.join(contentDir, f));
  const kind = f.includes("vocab") ? "vocab" : "sent";
  const n = kind === "vocab" ? c.lv : c.ls;
  out.layers.runtime.byPack[f] = n;
  out.layers.runtime[kind] += n;
}

// ---- 4. manifest declarations (parity only) ----
const manifest = readJSON(path.join(contentDir, "manifest.json")) || {};
out.layers.manifest = manifest.counts || {};
const sumByKind = {};
(manifest.files || []).forEach(f => { sumByKind[f.kind] = (sumByKind[f.kind] || 0) + f.count; });
out.parity.manifestFileSum = sumByKind;

// ---- 5. base banks in script.js ----
try {
  const s = fs.readFileSync(path.join(ROOT, "client", "script.js"), "utf8");
  const countTopRows = (name) => {
    const re = new RegExp("(?:const|var|let)\\s+" + name + "\\s*=\\s*\\[");
    const m = s.match(re);
    if (!m) return -1;
    const start = s.indexOf(m[0]) + m[0].length - 1;
    let depth = 0, inStr = null, esc = false, rows = 0;
    for (let i = start; i < s.length && i < start + 8000000; i++) {
      const c = s[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "[") { depth++; if (depth === 2) rows++; }
      else if (c === "]") { depth--; if (depth === 0) break; }
    }
    return rows;
  };
  out.layers.base = { RAW_SENT: countTopRows("RAW_SENT"), RAW_GRAM: countTopRows("RAW_GRAM") };
  ["RAW_K0", "RAW_K1", "RAW_K2", "RAW_K3", "RAW_K4", "RAW_K5"].forEach(k => { out.layers.base[k] = countTopRows(k); });
  out.layers.base.baseVocabTotal = ["RAW_K0", "RAW_K1", "RAW_K2", "RAW_K3", "RAW_K4", "RAW_K5"].reduce((a, k) => a + Math.max(0, out.layers.base[k] || 0), 0);
} catch (e) { out.layers.base = { error: String(e.message) }; }

// ---- 6. vocab analysis on src (source of truth) ----
(function analyzeVocab(rows) {
  const physical = rows.length;
  const valid = rows.filter(w => w.de && String(w.de).trim() && w.ar && AR_RE.test(String(w.ar)) && w.id);
  const keyCount = new Map(), headCount = new Map(), dups = [];
  const byLevel = {}, byCat = {}, byType = {}, byPack = {};
  rows.forEach((w, ix) => {
    const key = normDE(w.de) + "|" + (w.type || "");
    keyCount.set(key, (keyCount.get(key) || 0) + 1);
    if (keyCount.get(key) === 2) dups.push(key);
    const head = normDE(w.de);
    headCount.set(head, (headCount.get(head) || 0) + 1);
    byLevel[w.level || "?"] = (byLevel[w.level || "?"] || 0) + 1;
    byCat[w.cat || "?"] = (byCat[w.cat || "?"] || 0) + 1;
    byType[w.type || "?"] = (byType[w.type || "?"] || 0) + 1;
  });
  // pack attribution via src files
  for (const [f, info] of Object.entries(out.layers.src.files)) {
    if (info.kind === undefined) continue;
    const j = readJSON(path.join(srcDir, f));
    if (j && j.kind === "vocab") byPack[f] = (j.rows || []).length;
  }
  // missing ids / malformed
  const ids = new Set(), dupIds = [];
  let missingAr = 0, missingDe = 0;
  rows.forEach(w => {
    if (!w.de || !String(w.de).trim()) missingDe++;
    if (!w.ar || !AR_RE.test(String(w.ar))) missingAr++;
    if (ids.has(w.id)) dupIds.push(w.id); else ids.add(w.id);
  });
  out.vocab = { physical, valid: valid.length, uniqueEntries: keyCount.size, uniqueHeadwords: headCount.size, exactDupKeys: dups.length, dupIdCount: dupIds.length, missingDe, missingAr, byLevel, byCat, byType, byPack, sampleDupKeys: dups.slice(0, 10) };
})(out._srcVocab || []);

// ---- 7. sentence analysis ----
(function analyzeSent(rows) {
  const physical = rows.length;
  const valid = rows.filter(s => s.de && String(s.de).trim().split(/\s+/).length >= 3 && s.ar && AR_RE.test(String(s.ar)) && s.id);
  const seen = new Map(), dups = [];
  const byLevel = {}, byKap = {};
  const ids = new Set(), dupIds = [];
  rows.forEach(s => {
    const n = normDE(s.de);
    seen.set(n, (seen.get(n) || 0) + 1);
    if (seen.get(n) === 2) dups.push(n.slice(0, 60));
    byLevel[s.level || "?"] = (byLevel[s.level || "?"] || 0) + 1;
    byKap[s.kap || "?"] = (byKap[s.kap || "?"] || 0) + 1;
    if (ids.has(s.id)) dupIds.push(s.id); else ids.add(s.id);
  });
  out.sentences = { physical, valid: valid.length, uniqueTexts: seen.size, exactDupTexts: dups.length, dupIdCount: dupIds.length, byLevel, byKap, sampleDupTexts: dups.slice(0, 5) };
})(out._srcSent || []);

// ---- 8. parity ----
out.parity.srcVsManifest = {
  vocab: { src: out.layers.src.vocab, manifest: (manifest.counts || {}).vocab, match: out.layers.src.vocab === (manifest.counts || {}).vocab },
  sent: { src: out.layers.src.sent, manifest: (manifest.counts || {}).sent, match: out.layers.src.sent === (manifest.counts || {}).sent }
};
out.parity.runtimeVsSrc = {
  vocab: { runtime: out.layers.runtime.vocab, src: out.layers.src.vocab, match: out.layers.runtime.vocab === out.layers.src.vocab },
  sent: { runtime: out.layers.runtime.sent, src: out.layers.src.sent, match: out.layers.runtime.sent === out.layers.src.sent }
};
out.parity.cacheVsSrc = {
  vocab: { cache: (out.layers.cache.vocab || {}).physical, src: out.layers.src.vocab },
  sent: { cache: (out.layers.cache.sentences || {}).physical, src: out.layers.src.sent }
};
// missing runtime packs vs manifest
const missingPacks = [];
(manifest.files || []).forEach(f => {
  if (!fs.existsSync(path.join(ROOT, "client", f.runtime))) missingPacks.push(f.runtime);
});
out.parity.missingRuntimePacks = missingPacks;
// boot-visible subset (sync packs only per index.html)
let bootVocab = 0, bootSent = 0;
(manifest.files || []).forEach(f => { if (f.load === "sync" && f.kind === "vocab") bootVocab += f.count; if (f.load === "sync" && f.kind === "sent") bootSent += f.count; });
out.parity.bootSyncSubset = { vocab: bootVocab, sent: bootSent };

delete out._srcVocab; delete out._srcSent; delete out._cacheVocab; delete out._cacheSent;

const arg = process.argv.find(a => a.startsWith("--json"));
if (arg) {
  const p = arg.includes("=") ? arg.split("=")[1] : process.argv[process.argv.indexOf(arg) + 1];
  if (p) fs.writeFileSync(p, JSON.stringify(out, null, 2));
}
console.log(JSON.stringify(out, null, 2));
