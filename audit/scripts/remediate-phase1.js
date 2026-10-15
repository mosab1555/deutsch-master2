"use strict";
// Remediation Phase 1 — surgical, evidence-anchored patches to client/content/src/*.json.
// IDs, counts, levels, chapters, vocab refs: NEVER changed. Only `de`/`ar` strings.
// Rules compose sequentially on working copies (a row may match several rules).
// Default = dry run (report only). --write = apply + write per-file + verification.
// Run: node audit/scripts/remediate-phase1.js [--write]
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
const SDIR = ROOT + "\\client\\content\\src";
const WRITE = process.argv.includes("--write");
function load(kind) {
  const files = fs.readdirSync(SDIR).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8")); for (const r of (j.rows || j)) rows.push({ ...r, _file: f }); }
  return rows;
}
const { TIMES, PLACES } = require(ROOT + "\\tools\\clib\\sentgen.js");
const { BIGTIMES, BIGPLACES } = require(ROOT + "\\tools\\clib\\bigsen.js");
const poolPhrases = new Set([...TIMES, ...BIGTIMES, ...PLACES, ...BIGPLACES].map(x => x[0]));
const MODAL_DE = new Set(["kann", "kannst", "können", "will", "willst", "wollen", "muss", "musst", "müssen", "darf", "darfst", "dürfen", "soll", "sollst", "sollen", "möchte", "möchtest", "möchten"]);
const bsrc = fs.readFileSync(ROOT + "\\tools\\build-sentences.js", "utf8");
const mN = bsrc.match(/const NAMES = (\[.*?\]);/s);
const localNames = mN ? eval(mN[1]) : [];
const bigsen = require(ROOT + "\\tools\\clib\\bigsen.js");
const arNames = new Set(localNames.concat(bigsen.BIGNAMES || []).map(n => n[1]));

const sents = load("sent"), vocab = load("vocab");
const byDe = new Map(vocab.map(v => [String(v.de).toLowerCase(), v]));
const PCATS = new Set(["family", "people", "relationships", "jobs", "profi"]);

// working copies
const work = new Map(sents.map(r => [r.id, { de: String(r.de), ar: String(r.ar) }]));
const meta = new Map(sents.map(r => [r.id, r]));
const patches = [];
const queue = [];
function setPatch(id, field, newV, rule) {
  const w = work.get(id);
  if (newV === w[field]) return;
  patches.push({ id, file: meta.get(id)._file, field, oldV: w[field], newV, rule });
  w[field] = newV;
}

// R8 (before R1, which capitalizes "die"→"Die")
for (const r of sents) {
  if (!(r.gram || []).includes("superlativ")) continue;
  if (!/^[Dd]ie \S+ ist am /.test(work.get(r.id).de)) continue;
  const w = work.get(r.id);
  if (/ هو /.test(w.ar)) setPatch(r.id, "ar", w.ar.replace(" هو ", " هي "), "R8-superlativ-gender");
}
// R1
for (const r of sents) {
  const t = work.get(r.id).de.trim();
  if (/^[a-zäöüß]/.test(t)) setPatch(r.id, "de", t.charAt(0).toUpperCase() + t.slice(1), "R1-capitalize");
}
// R2
for (const r of sents) {
  if (!((r.gram || []).includes("modal-koennen") || (r.gram || []).includes("modal-wollen"))) continue;
  const de = work.get(r.id).de.trim();
  const body = de.replace(/[.?!]+$/, "");
  let hit = null;
  for (const ph of poolPhrases) if (body.endsWith(" " + ph)) { hit = ph; break; }
  if (!hit) { queue.push({ id: r.id, de: work.get(r.id).de, ar: work.get(r.id).ar, level: r.level, chapter: r.kap, reason: "R2-no-pool-tail; teacher review" }); continue; }
  const pre = body.slice(0, body.length - hit.length).trim().split(" ");
  const inf = pre[pre.length - 1];
  if (!/^[a-zäöüß]+(en|n|eln|ern)$/.test(inf) || inf.length < 4 || MODAL_DE.has(inf.toLowerCase())) { queue.push({ id: r.id, de: work.get(r.id).de, ar: work.get(r.id).ar, level: r.level, chapter: r.kap, reason: "R2-no-clear-infinitive; teacher review" }); continue; }
  setPatch(r.id, "de", pre.slice(0, -1).join(" ") + " " + hit + " " + inf + ".", "R2-modal-tail");
}
// R3
for (const r of sents) {
  let ar = work.get(r.id).ar;
  if (!ar.includes("/")) continue;
  let n2 = ar.replace(/\s*\([^()]*\/[^()]*\)(\S*)/g, "$1");
  // R3a: drop each " / ALTERNATIVE" segment. Mid-sentence alternatives are
  // single verb-shaped tokens (generator gloss markup); a non-verb-shaped
  // continuation means the alternative boundary is ambiguous -> queue.
  // Alternative running to sentence end (possibly multi-token) -> keep first + end.
  let guard = 0, ambiguous = false;
  while (n2.includes(" / ") && guard++ < 10) {
    const i = n2.indexOf(" / ");
    const before = n2.slice(0, i), after = n2.slice(i + 3);
    const mTok = after.match(/^(\S+)([\s\S]*)$/);
    const firstTok = mTok[1], rest = mTok[2];
    if (!rest.trim()) {
      const endP = after.trim().match(/[.؟!]$/);
      n2 = before.trim() + (endP && !/[.؟!]$/.test(before.trim()) ? endP[0] : "");
    } else if (/^[أيتن]/.test(firstTok) && /^[\u0600-\u06FF]+$/.test(firstTok)) {
      n2 = before + " " + rest.trim();
    } else { ambiguous = true; break; }
  }
  n2 = n2.replace(/\s+/g, " ").trim();
  if (ambiguous || n2.includes("/")) queue.push({ id: r.id, de: work.get(r.id).de, ar, level: r.level, chapter: r.kap, reason: "R3 ambiguous alternative boundary; teacher review" });
  else setPatch(r.id, "ar", n2, "R3-slash-first-gloss");
}
// R4
for (const r of sents) {
  const w = work.get(r.id);
  if (!w.ar.includes("يريد نحن")) continue;
  if (/^Wir wollen/.test(w.de)) setPatch(r.id, "ar", w.ar.replace("يريد نحن", "نحن نريد"), "R4-modal-agreement");
  else queue.push({ id: r.id, de: w.de, ar: w.ar, level: r.level, chapter: r.kap, reason: "R4 non-Wir subject; teacher review" });
}
// R5
for (const r of sents) {
  const w = work.get(r.id);
  const m = w.ar.trim().match(/^العائلة( الكبيرة)? يحيي/);
  if (m) setPatch(r.id, "ar", w.ar.trim().replace(/^العائلة( الكبيرة)? يحيي/, "العائلة$1 تحيي"), "R5-familie-agreement");
}
// R6
for (const r of sents) {
  const g = (r.gram || []).join("+");
  if (g !== "ruft-an" && g !== "anrufen") continue;
  const w = work.get(r.id);
  const m = w.ar.match(/(تتصل|يتصل|تتصلون|يتصلون) (\S+)/);
  if (!m || /^(ب|أن)/.test(m[2])) continue;
  const tok = m[2].replace(/[.؟!،,;:]+$/, "");
  let ok = false;
  if (g === "ruft-an") ok = arNames.has(tok);
  else {
    const dm = w.de.match(/(?:ruft|rufen) (?:den|die|das|einen|eine) ([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ-]+)/);
    const v = dm ? byDe.get(dm[1].toLowerCase()) : null;
    ok = !!(v && (PCATS.has(v.cat) || (/in$/.test(dm[1]) && v.type === "noun")));
  }
  if (ok) setPatch(r.id, "ar", w.ar.replace(m[1] + " " + m[2], m[1] + " بـ" + m[2]), "R6-anrufen-ba");
  else queue.push({ id: r.id, de: w.de, ar: w.ar, level: r.level, chapter: r.kap, reason: "R6 object not verifiably a person; teacher review" });
}
// R7
for (const r of sents) {
  const w = work.get(r.id);
  const matches = [...w.ar.matchAll(/أن (\S+)/g)];
  if (!matches.length) continue;
  let n2 = w.ar, changed = false;
  for (const mm of matches) {
    let tok = mm[1].replace(/[.؟!،,;:()]+$/, "");
    if (!/^[يت].*(ون|ان)$/.test(tok) || tok.length <= 4) continue;
    let t2 = tok.replace(/وو/g, "و");
    if (/ون$/.test(t2)) {
      const stem = t2.replace(/^[يت]/, "").replace(/ون$/, "");
      if (/و$/.test(stem)) continue;
      t2 = t2.replace(/ون$/, "وا");
    } else if (/ان$/.test(t2)) t2 = t2.replace(/ان$/, "ا");
    else continue;
    if (t2 !== tok) { n2 = n2.replace(mm[1], mm[1].replace(tok, t2)); changed = true; }
  }
  if (changed) setPatch(r.id, "ar", n2, "R7-an-mood");
}

console.log("patches=" + patches.length + " queued=" + queue.length);
const byRule = {};
patches.forEach(p => { byRule[p.rule] = (byRule[p.rule] || 0) + 1; });
console.log(JSON.stringify(byRule, null, 1));

// residual verification on working copies
let simLower = 0, simSlash = 0, simModal = 0;
for (const [id, w] of work) {
  if (/^[a-zäöüß]/.test(w.de.trim())) simLower++;
  if (w.ar.includes("/")) simSlash++;
}
for (const r of sents) {
  if (!((r.gram || []).includes("modal-koennen") || (r.gram || []).includes("modal-wollen"))) continue;
  const body = work.get(r.id).de.trim().replace(/[.?!]+$/, "");
  for (const ph of poolPhrases) if (body.endsWith(" " + ph)) { simModal++; break; }
}
console.log("sim residual: lowercase=" + simLower + " slash=" + simSlash + " modal-tail=" + simModal);
// per-row multi-patch sanity: show 3 composed examples
const multi = {};
patches.forEach(p => { multi[p.id] = (multi[p.id] || []).concat(p.rule); });
const multiIds = Object.keys(multi).filter(id => multi[id].length > 1);
console.log("rows with >1 rule=" + multiIds.length);
multiIds.slice(0, 3).forEach(id => {
  const o = meta.get(id);
  console.log("  " + id + " [" + multi[id].join(",") + "]\n    DE: " + o.de + "\n    ->  " + work.get(id).de + "\n    AR: " + o.ar + "\n    ->  " + work.get(id).ar);
});

if (WRITE) {
  const byFile = new Map();
  for (const [id, w] of work) {
    const o = meta.get(id);
    if (w.de !== o.de || w.ar !== o.ar) {
      if (!byFile.has(o._file)) byFile.set(o._file, []);
      byFile.get(o._file).push(id);
    }
  }
  for (const [f, ids] of byFile) {
    const fp = SDIR + "\\" + f;
    const j = JSON.parse(fs.readFileSync(fp, "utf8"));
    const wm = new Map(ids.map(id => [id, work.get(id)]));
    for (const row of j.rows) if (wm.has(row.id)) { row.de = wm.get(row.id).de; row.ar = wm.get(row.id).ar; }
    fs.writeFileSync(fp, JSON.stringify(j), "utf8");
    console.log("wrote " + f + " (" + ids.length + " rows)");
  }
  const qcols = ["id", "de", "ar", "level", "chapter", "reason"];
  const esc = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
  const qrows = queue.map(q => ({ ...q, chapter: q.chapter }));
  fs.writeFileSync(ROOT + "\\audit\\remediation-review-queue.csv", "id,German,Arabic,level,chapter,reason\n" + qrows.map(q => [q.id, q.de, q.ar, q.level, q.chapter, q.reason].map(esc).join(",")).join("\n") + "\n", "utf8");
  fs.writeFileSync(ROOT + "\\audit\\remediation-patches.json", JSON.stringify({ generated: new Date().toISOString(), count: patches.length, byRule, patches }, null, 1), "utf8");
  console.log("wrote audit/remediation-review-queue.csv (" + queue.length + ") + audit/remediation-patches.json");
} else console.log("DRY RUN (no writes). Re-run with --write to apply.");
