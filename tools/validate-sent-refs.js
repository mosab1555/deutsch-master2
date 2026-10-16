/* Deutsch Master — sentence-to-vocabulary reference validator (REPORT ONLY).
 * Never deletes or rewrites references. Emits JSON report + human summary.
 * Distinguishes structural errors (missing/invalid IDs) from possible
 * semantic mismatches (valid ID, no token evidence).
 * Run: node tools/validate-sent-refs.js [--sample N] [--out path]
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "client", "content", "src");

const STOP = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "einer", "eines", "und", "oder", "aber", "denn", "mit", "von", "zu", "zum",
  "zur", "im", "am", "an", "auf", "aus", "bei", "nach", "vor", "für", "ohne",
  "gegen", "durch", "über", "unter", "hinter", "neben", "zwischen", "ist",
  "sind", "war", "waren", "wird", "werden", "hat", "haben", "hatte", "hatten",
  "ich", "du", "er", "sie", "es", "wir", "ihr", "nicht", "kein", "keine",
  "auch", "nur", "schon", "noch", "mal", "doch", "sehr", "sich", "sich",
]);

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[ä]/g, "a").replace(/[ö]/g, "o").replace(/[ü]/g, "u").replace(/ß/g, "ss")
    .replace(/[^a-z0-9äöüß\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokens(de) {
  return norm(de).split(" ").filter((t) => t && t.length >= 2 && !STOP.has(t));
}
function variantsFor(w) {
  // Returns { strong: Set(normalized whole-word forms), head: normalized head noun }
  const out = new Set();
  const raw = String(w.de || "").trim();
  const type = w.type || "";
  const add = (s) => { const n = norm(s); if (n && n.length >= 3 && !STOP.has(n)) out.add(n); };
  if (type === "phrase" || /\s/.test(raw)) {
    // multiword: whole normalized phrase is the strong form
    add(raw);
    // also add content tokens of the phrase (len>=4, non-stop)
    norm(raw).split(" ").forEach((t) => { if (t.length >= 4 && !STOP.has(t)) out.add(t); });
    return { strong: out, head: "" };
  }
  if (type === "verb") {
    const inf = raw.replace(/^sich\s+/, "").split(/[\s/]/)[0];
    add(inf);
    const stemEn = inf.replace(/en$/, "");
    const stemN = inf.replace(/n$/, "");
    add(stemEn); add(stemN);
    // common 3sg/2sg stems: stem+e/t/st (arbeit->arbeitet)
    if (stemEn.length >= 4) { add(stemEn + "e"); add(stemEn + "t"); add(stemEn + "st"); add(stemEn + "et"); }
    return { strong: out, head: norm(inf) };
  }
  // noun / adj / default: headword + plural + stem
  let head = raw.split(/\s+/).pop().replace(/^.*\//, "");
  add(raw); add(head);
  if (w.plural && w.plural !== "-") {
    const pl = String(w.plural).replace(/^(der|die|das)\s+/, "");
    add(pl);
  }
  // crude stem: strip common noun endings for inflection tolerance
  const h = norm(head);
  if (h.length >= 5) {
    ["en", "ern", "er", "e", "n", "s", "es"].forEach((suf) => {
      if (h.endsWith(suf) && h.length - suf.length >= 4) out.add(h.slice(0, -suf.length));
    });
  }
  return { strong: out, head: h };
}

function loadAll() {
  const vocab = new Map();
  const files = fs.readdirSync(SRC).filter((f) => /^vocab-.*\.json$/.test(f)).sort();
  files.forEach((f) => {
    const o = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
    o.rows.forEach((r) => vocab.set(r.id, r));
  });
  const sfiles = fs.readdirSync(SRC).filter((f) => /^sent-.*\.json$/.test(f)).sort();
  const sents = [];
  sfiles.forEach((f) => {
    const o = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
    o.rows.forEach((r) => sents.push(r));
  });
  return { vocab, sents };
}

function evidence(sentDe, w) {
  const toks = new Set(tokens(sentDe));
  const { strong, head } = variantsFor(w);
  // 1) strong: whole-word match of any variant
  for (const v of strong) {
    if (v.indexOf(" ") >= 0) {
      // phrase: substring of normalized sentence
      if ((" " + norm(sentDe) + " ").indexOf(" " + v + " ") >= 0 || norm(sentDe).indexOf(v) >= 0) {
        // require at least one content token of phrase present to avoid trivial hits
        return { level: "strong", via: "phrase:" + v.slice(0, 40) };
      }
      continue;
    }
    if (toks.has(v)) return { level: "strong", via: "token:" + v };
  }
  // 2) compound: head appears inside a longer sentence token (German compounds)
  if (head && head.length >= 5) {
    for (const t of toks) {
      if (t.length >= head.length + 2 && t.indexOf(head) >= 0) {
        return { level: "weak-compound", via: t + "~" + head };
      }
    }
  }
  // 3) no evidence
  return { level: "mismatch", via: "" };
}

function main() {
  const args = process.argv.slice(2);
  let sampleN = 0, outPath = path.join(__dirname, "sent-ref-report.json");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sample") sampleN = parseInt(args[++i], 10) || 0;
    if (args[i] === "--out") outPath = args[++i];
  }
  const { vocab, sents } = loadAll();
  let list = sents;
  if (sampleN > 0) {
    // deterministic sample: every k-th sentence
    const step = Math.max(1, Math.floor(sents.length / sampleN));
    list = sents.filter((_, i) => i % step === 0).slice(0, sampleN);
  }
  const report = {
    generated: new Date().toISOString(),
    vocabTotal: vocab.size,
    sentencesScanned: list.length,
    sentencesTotal: sents.length,
    structuralErrors: [],   // missing/invalid IDs
    mismatches: [],         // valid ID, no token evidence (REVIEW, not proof)
    weakCompounds: 0,
    strong: 0,
    sentencesWithAnyMismatch: 0,
  };
  list.forEach((s) => {
    const refs = s.vocab || [];
    let anyMismatch = false;
    refs.forEach((vid) => {
      const w = vocab.get(vid);
      if (!w) {
        report.structuralErrors.push({ sent: s.id, ref: vid, kind: "invalid-id" });
        anyMismatch = true;
        return;
      }
      const ev = evidence(s.de, w);
      if (ev.level === "strong") report.strong++;
      else if (ev.level === "weak-compound") { report.weakCompounds++; }
      else {
        anyMismatch = true;
        report.mismatches.push({ sent: s.id, ref: vid, headword: w.de, type: w.type || "", sentDe: String(s.de).slice(0, 120) });
      }
    });
    if (anyMismatch) report.sentencesWithAnyMismatch++;
  });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 1));
  // human summary (ASCII-safe: counts only + sampled ids)
  console.log("sentences scanned: " + report.sentencesScanned + "/" + report.sentencesTotal);
  console.log("vocab entries: " + report.vocabTotal);
  console.log("structural errors (invalid IDs): " + report.structuralErrors.length);
  console.log("refs with strong token evidence: " + report.strong);
  console.log("refs weak-compound only: " + report.weakCompounds);
  console.log("refs without token evidence (review candidates): " + report.mismatches.length);
  console.log("sentences with >=1 review-candidate ref: " + report.sentencesWithAnyMismatch);
  console.log("report: " + outPath);
}
main();
