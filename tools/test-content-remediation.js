/* Deutsch Master - Content Remediation Phase 1 regression tests.
 * Defensible automated checks over the SHIPPED source of truth
 * (client/content/src/*.json). Static screening only: a PASS never claims
 * linguistic correctness; fails are deterministic corruption classes with
 * evidence-anchored rules (see audit/REMEDIATION_REPORT.md).
 *
 * Queue-aware: residual known defects listed in
 * audit/remediation-review-queue.csv are pinned as EXPECTED-QUEUED (they must
 * be queue members, never silently present). New occurrences FAIL.
 *
 * Usage: node tools/test-content-remediation.js
 * Exit 0 = PASS, 1 = FAIL.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SDIR = path.join(ROOT, "client", "content", "src");
function load(kind) {
  const files = fs.readdirSync(SDIR).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(path.join(SDIR, f), "utf8")); for (const r of (j.rows || j)) rows.push(r); }
  return rows;
}
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL " + name + (detail ? " :: " + detail : "")); }
}
function queuedIds() {
  try {
    const q = fs.readFileSync(path.join(ROOT, "audit", "remediation-review-queue.csv"), "utf8").split("\n").slice(1);
    const s = new Set();
    for (const l of q) { const m = l.match(/^"(ls\d+)"/); if (m) s.add(m[1]); }
    return s;
  } catch (e) { return new Set(); }
}

const sents = load("sent");
const QUEUE = queuedIds();

// T1 sentence-initial capitalization (German has no valid lowercase start)
{
  const bad = sents.filter(r => /^[a-zäöüß]/.test(String(r.de || "").trim()));
  check("T1 no lowercase sentence starts", bad.length === 0, bad.slice(0, 3).map(r => r.id + ":" + String(r.de).slice(0, 50)).join(" | "));
}
// T2 modal adjunct order: modal-koennen/wollen rows must not end with a known adjunct tail
{
  const { TIMES, PLACES } = require("./clib/sentgen.js");
  const { BIGTIMES, BIGPLACES } = require("./clib/bigsen.js");
  const tails = new Set([...TIMES, ...BIGTIMES, ...PLACES, ...BIGPLACES].map(x => x[0]));
  const bad = [];
  for (const r of sents) {
    if (!((r.gram || []).includes("modal-koennen") || (r.gram || []).includes("modal-wollen"))) continue;
    const body = String(r.de).trim().replace(/[.?!]+$/, "");
    for (const t of tails) if (body.endsWith(" " + t)) { bad.push(r.id); break; }
  }
  check("T2 no modal rows ending in adjunct tail", bad.length === 0, bad.slice(0, 5).join(","));
}
// T3 wehtun dative-fronted rows are VALID (audit-correction pin): fronted dative
// experiencer + nominative body part + weh must NOT be flagged as article errors
{
  const weh = sents.filter(r => (r.gram || []).includes("wehtun"));
  const shape = weh.filter(r => /^(Der|Dem|Den) \S+ tut (der|die|das) \S+ weh\.$/.test(String(r.de).trim()));
  check("T3 wehtun rows keep dative-fronted shape", shape.length === weh.length, "weh=" + weh.length + " shaped=" + shape.length);
}
// T4 no unfilled template placeholders in learner strings
{
  const bad = sents.filter(r => /{[A-Za-z0-9}]+}/.test(String(r.de) + String(r.ar)));
  check("T4 no {placeholder} leftovers", bad.length === 0, bad.slice(0, 3).map(r => r.id).join(","));
}
// T5 CEFR/chapter metadata from allowed sets (KX explicitly allowed: unmapped pool)
{
  const kaps = new Set(["KX", ...Array.from({ length: 26 }, (_, i) => "K" + i)]);
  const badK = sents.filter(r => !kaps.has(r.kap));
  const badL = sents.filter(r => ["A1", "A2", "B1", "B2"].indexOf(r.level) < 0);
  check("T5 kap values valid", badK.length === 0, badK.slice(0, 3).map(r => r.id + ":" + r.kap).join(","));
  check("T5 level values valid", badL.length === 0, badL.slice(0, 3).map(r => r.id + ":" + r.level).join(","));
}
// T6 exact-duplicate German sentences
{
  const seen = new Map(), dups = [];
  for (const r of sents) { const k = String(r.de).trim(); if (seen.has(k)) dups.push(r.id); else seen.set(k, r.id); }
  check("T6 no exact-duplicate sentences", dups.length === 0, dups.slice(0, 5).join(","));
}
// T7 residual Arabic slashes must be queue members (known, triaged) — never new
{
  const slash = sents.filter(r => String(r.ar || "").includes("/"));
  const unqueued = slash.filter(r => !QUEUE.has(r.id));
  check("T7 slash rows all triaged in review queue", unqueued.length === 0, unqueued.slice(0, 5).map(r => r.id).join(",") + " (slashed=" + slash.length + " queued=" + QUEUE.size + ")");
}
// T8 أن + indicative mood (masc ون/dual ان) with hollow-singular guard
{
  const bad = [];
  for (const r of sents) {
    const ms = [...String(r.ar || "").matchAll(/أن (\S+)/g)];
    for (const mm of ms) {
      const tok = mm[1].replace(/[.؟!،,;:()]+$/, "");
      if (!/^[يت].*(ون|ان)$/.test(tok) || tok.length <= 4) continue;
      const t2 = tok.replace(/وو/g, "و");
      if (/ون$/.test(t2)) {
        const stem = t2.replace(/^[يت]/, "").replace(/ون$/, "");
        if (/و$/.test(stem)) continue; // hollow singular (يكون): correct as-is
        bad.push(r.id + ":" + tok); break;
      } else if (/ان$/.test(t2)) { bad.push(r.id + ":" + tok); break; }
    }
  }
  const unqueued = bad.filter(s => !QUEUE.has(s.split(":")[0]));
  check("T8 أن-mood violations all triaged", unqueued.length === 0, unqueued.slice(0, 5).join(",") + " (flagged=" + bad.length + ")");
}
// T9 template-reuse stats (report-only, never fails: screening, not verdict)
{
  const tm = new Map();
  for (const r of sents) {
    const t = String(r.de || "").replace(/[.,?!;:()"„“«»]/g, "").replace(/\b\d+\b/g, "{NUM}").replace(/\b[A-ZÄÖÜ][a-zäöüßA-ZÄÖÜäöü-]*\b/g, "{N}").replace(/\s+/g, " ").trim();
    if (!tm.has(t)) tm.set(t, 0);
    tm.set(t, tm.get(t) + 1);
  }
  let big = 0;
  for (const n of tm.values()) if (n >= 5) big += n;
  console.log("INFO T9 templates distinct=" + tm.size + " rows-in-templates(>=5)=" + big);
  pass++;
}
// T10 reading minimums (report-only)
{
  const read = load("read");
  const lens = read.map(t => String(t.de || "").length);
  const avg = Math.round(lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length));
  const tiny = lens.filter(l => l < 120).length;
  console.log("INFO T10 reading avg-chars=" + avg + " rows<120chars=" + tiny + "/" + read.length);
  pass++;
}
// T11 exam shells (report-only: rows carry configs, question assembly verified separately)
{
  const exam = load("exam");
  const shellOnly = exam.filter(t => !t.questions && !t.items).length;
  console.log("INFO T11 exam shell-only=" + shellOnly + "/" + exam.length);
  pass++;
}
console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
process.exit(fail ? 1 : 0);
