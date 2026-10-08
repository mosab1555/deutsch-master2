/* Stage 5 — dialogue expansion to 10,000 (deterministic, quality-gated).
   Crosses situation x twist x level x length x pool-rotation with exact-dup
   rejection. Appends to clib/.cache/dialogues.json (rerun-safe via haveIds).
   Run: node tools/build-dialogs2.js */
"use strict";
const fs = require("fs");
const path = require("path");
const { rng, normDE } = require("./clib/util");
const { SHARED, SITS } = require("./clib/bigdlg");
const gate = require("./content-quality-gate");

const cache = path.join(__dirname, "clib", ".cache");
const dialogues = JSON.parse(fs.readFileSync(path.join(cache, "dialogues.json"), "utf8"));
const rejected = JSON.parse(fs.readFileSync(path.join(cache, "rejected.json"), "utf8"));
function rej(id, reason) { rejected.push({ id, reason }); }
const haveIds = new Set(dialogues.map((d) => d.id));

const TWISTS = [
  ["am Abend", "في المساء"], ["am Wochenende", "في عطلة الأسبوع"],
  ["mit Freunden", "مع الأصدقاء"], ["mit der Familie", "مع العائلة"],
  ["geschäftlich", "في عمل"], ["zum Geburtstag", "لعيد ميلاد"],
  ["im Urlaub", "في الإجازة"], ["zum ersten Mal", "لأول مرة"],
  ["wieder einmal", "مرة أخرى"], ["ganz spontan", "بعفوية"],
];
const LEVELS = ["A1", "A2", "B1"];
const rr = rng("dialogs2-v1");
let seq = dialogues.reduce((m, d) => Math.max(m, parseInt(d.id.slice(2), 10) || 0), 1000);
const seen = new Set();
dialogues.forEach((d) => seen.add(normDE(d.lines.map((l) => l[1]).join(" | "))));

function filt(pool, lvl) {
  const lv = lvl === "A1" ? 1 : lvl === "A2" ? 2 : 3;
  const ok = pool.filter((e) => (e[2] || 1) <= lv);
  return ok.length ? ok : pool;
}
/* mixed-radix: variant v -> one combo per slot-pool (bijective for v < product) */
function combo(pools, v) {
  const out = [];
  let n = v;
  for (const pool of pools) {
    out.push(pool[n % pool.length]);
    n = Math.floor(n / pool.length);
  }
  return out;
}

const fresh = [];
const TOTAL_TARGET = 10000;
const PER_SIT_LEVEL = 160;
outer: for (let si = 0; si < SITS.length; si++) {
  const [key, topic, tDe, tAr, speakers, open, req, res, close] = SITS[si];
  const A = speakers[0], B = speakers[1];
  for (const lvl of LEVELS) {
    const fo = filt(open, lvl), fr = filt(req, lvl), fs = filt(res, lvl), fc = filt(close, lvl);
    const sg = filt(SHARED.greet, lvl), st = filt(SHARED.thanks, lvl), sb = filt(SHARED.bye, lvl);
    const so = filt(SHARED.ok, lvl);
    const talkPairs = SHARED.smalltalk;
    for (let v = 0; v < PER_SIT_LEVEL; v++) {
      if (dialogues.length + fresh.length >= TOTAL_TARGET) break outer;
      const lines = [];
      const pushL = (sp, e) => lines.push([sp, e[0], e[1]]);
      if (lvl === "A1") {
        // short: open, req, res, [thanks + response], close, bye
        const c = combo([fo, fr, fs, st, so, fc, sb], v * 7 + si);
        pushL(A, c[0]); pushL(B, c[1]); pushL(A, c[2]);
        if ((v + si) % 2 === 0) { pushL(B, c[3]); pushL(A, c[4]); }
        pushL(A, c[5]); pushL(B, c[6]);
      } else {
        // long: open, [greet], req, res, req, res, [thanks + response], [smalltalk], close, bye
        const c = combo([fo, sg, fr, fs, fr, fs, st, so, fc, sb], v * 13 + si * 3);
        pushL(A, c[0]);
        if ((v + si) % 3 !== 0) pushL(B, c[1]);
        pushL(B, c[2]); pushL(A, c[3]); pushL(B, c[4]); pushL(A, c[5]);
        if ((v + si) % 4 === 0) { pushL(B, c[6]); pushL(A, c[7]); }
        if ((v + si) % 5 === 0) { const talk = talkPairs[(si + v) % talkPairs.length]; pushL(A, talk[0]); pushL(B, talk[1]); }
        pushL(A, c[8]); pushL(B, c[9]);
      }
      if (lines.length < 4) continue;
      const spk = new Set(lines.map((l) => l[0]));
      if (spk.size < 2) continue;
      const nkey = normDE(lines.map((l) => l[1]).join(" | "));
      if (seen.has(nkey)) continue;
      seen.add(nkey);
      seq++;
      const id = "ld" + String(seq).padStart(4, "0");
      if (haveIds.has(id)) { seq--; continue; }
      const twist = TWISTS[(si + v) % TWISTS.length];
      fresh.push({
        id, level: lvl, topic,
        titleDe: tDe + " (" + twist[0] + ")",
        titleAr: tAr + " (" + twist[1] + ")",
        lines,
      });
    }
  }
}
console.log("dialogues2 built: " + fresh.length + " new");

(function () {
  const all = dialogues.concat(fresh);
  const r = gate.validateDataset({ vocab: [], sentences: [], grammar: [], exercises: [], dialogues: all });
  console.log("STAGE5 gate: errors=" + r.errors.length + " warnings=" + r.warnings.length);
  r.errors.slice(0, 20).forEach((e) => console.log("  ERR " + e.id + " :: " + e.reason));
  const bad = new Set(r.errors.map((e) => e.id));
  const kept = fresh.filter((d) => !bad.has(d.id));
  bad.forEach((id) => { if (!dialogues.some((x) => x.id === id)) rej(id, "dialogue rejected"); });
  const final = dialogues.concat(kept);
  const r2 = gate.validateDataset({ vocab: [], sentences: [], grammar: [], exercises: [], dialogues: final });
  console.log("STAGE5 after reject: dialogues=" + final.length + " errors=" + r2.errors.length);
  if (r2.errors.length) { console.log("FATAL stage5"); process.exit(1); }
  fs.writeFileSync(path.join(cache, "dialogues.json"), JSON.stringify(final));
  fs.writeFileSync(path.join(cache, "rejected.json"), JSON.stringify(rejected, null, 1));
  console.log("stage5 ok, new kept: " + kept.length);
})();
