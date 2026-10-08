/* Stage 3 — grammar micro-units (900) + dialogues (1000). Validated with gate.
   Run: node tools/build-grammar-dialog.js */
"use strict";
const fs = require("fs");
const path = require("path");
const { rng, pick, shuffle } = require("./clib/util");
const { GT1 } = require("./clib/grammar1");
const { GT2 } = require("./clib/grammar2");
const { SITS, POOLS } = require("./clib/dialogs");
const { EXTRA } = require("./clib/dialogs2");
const gate = require("./content-quality-gate");

const cache = path.join(__dirname, "clib", ".cache");
const vocab = JSON.parse(fs.readFileSync(path.join(cache, "vocab.json"), "utf8"));
const sentences = JSON.parse(fs.readFileSync(path.join(cache, "sentences.json"), "utf8"));
const rejected = JSON.parse(fs.readFileSync(path.join(cache, "rejected.json"), "utf8")).filter((x) => x.id !== "sent-gen");
function rej(id, reason) { rejected.push({ id, reason }); }

/* ---------- GRAMMAR ---------- */
const TOPICS = GT1.concat(GT2);
console.log("grammar topics:", TOPICS.length);
const grammar = [];
const rr = rng("grammar-v1");
const AR_RE = /[\u0600-\u06FF]/;
function isAr(s) { return /[\u0600-\u06FF]/.test(s); }
function isDe(s) { return /[A-Za-zÄÖÜäöüß]/.test(s) && !/[\u0600-\u06FF]/.test(s); }
/* Flexible unit normalization (documents data drift between GT1/GT2 authoring passes):
   - German-only fields -> example/wrong/right slots; Arabic-only -> translations/notes.
   - Mixed fields -> notes (never used as German examples: quality rule).
   - Units with <2 valid examples borrow a sibling example from the SAME topic
     (real, validated, topically coherent; recorded as borrowed:true).
   - Units with a wrong/right German pair -> "contrast" quiz; others -> "classify" quiz
     (which example belongs to this rule?). No fabricated German anywhere. */
function normUnit(u) {
  const focus = String(u[0] || "").trim();
  const des = [], ars = [], notes = [];
  const AR = /[-ۿ]/;
  for (let i = 1; i < u.length; i++) {
    let s = String(u[i] || "").trim();
    if (!s) continue;
    // extract parenthetical Arabic glosses: "Was ist das? (مفتوح)" -> de + note
    const gl = [];
    s = s.replace(/\(([^()]*[-ۿ][^()]*)\)/g, (m, g) => { gl.push(g.trim()); return " "; });
    const eq = s.match(/^([^=]*[A-Za-zÄÖÜäöüß][^=]*)=([^=]*[-ۿ][^=]*)$/);
    if (eq) { gl.push(eq[2].trim()); s = eq[1]; }
    s = s.replace(/\s+/g, " ").trim();
    if (isDe(s)) { des.push(s); gl.forEach((g) => notes.push(g)); }
    else if (isAr(s)) ars.push(s);
    else notes.push(s);
  }
  return { focus, des, ars, notes };
}
/* first pass: collect validated example pools per topic for sibling borrowing */
const topicExPool = TOPICS.map((t) => {
  const pool = [];
  t[6].forEach((u) => {
    const n = normUnit(u);
    if (n.des[0] && n.ars[0]) pool.push([n.des[0], n.ars[0]]);
    if (n.des[1] && n.ars[1]) pool.push([n.des[1], n.ars[1]]);
  });
  return pool;
});
TOPICS.forEach((t, ti) => {
  const [gid, deTitle, arTitle, lvl, cat, related, units] = t;
  const tnum = String(ti + 1).padStart(2, "0");
  units.forEach((u, ui) => {
    const unum = String(ui + 1).padStart(2, "0");
    const id = "lg" + tnum + unum;
    const n = normUnit(u);
    const focus = n.focus;
    if (!n.focus) { rej(id, "grammar: missing focus"); return; }
    let ex1 = n.des[0], ar1 = n.ars[0], ex2 = n.des[1], ar2 = n.ars[1], borrowed = false;
    if ((!ex1 || !ar1) && topicExPool[ti].length) {
      // primary borrowing: unit's own fields were gloss-fragments; use two sibling examples
      const a = topicExPool[ti][0], b = topicExPool[ti].find(([d]) => d !== a[0]) || a;
      ex1 = a[0]; ar1 = a[1]; ex2 = b[0]; ar2 = b[1]; borrowed = "primary";
    }
    if (!ex1 || !ar1) { rej(id, "grammar: no valid primary example"); return; }
    if (!ex2 || !ar2) {
      // borrow a DIFFERENT sibling example from the same topic
      const sib = topicExPool[ti].find(([d]) => d !== ex1);
      if (!sib) { rej(id, "grammar: no second example available"); return; }
      ex2 = sib[0]; ar2 = sib[1]; borrowed = borrowed || true;
    }
    let kind = "classify", wrong = null, right = null, why = "";
    if (n.des.length >= 4) {
      // contrast pair present: des[2]=wrong, des[3]=right (GT1 canonical form)
      wrong = n.des[2]; right = n.des[3]; why = n.ars[2] || n.ars[1] || "";
      kind = "contrast";
    } else {
      why = n.ars[2] || "إتقان هذه القاعدة يمنع أخطاء شائعة في هذا الباب.";
    }
    const kap = lvl === "A1" ? "K" + (1 + (ti % 5)) : "KX";
    const exPart = "مثال: «" + ex1 + "» = " + ar1 + "؛ ومثال آخر: «" + ex2 + "» = " + ar2 + (borrowed ? " (مثال إضافي من نفس الباب)" : "") + ".";
    const errPart = kind === "contrast" ? " 【خطأ شائع】 لا تقل «" + wrong + "» بل قل «" + right + "»." : "";
    const body = "【ما هو؟】 " + focus + " 【لماذا يُستخدم؟】 " + why + " 【كيف يُستخدم؟】 طبّق القاعدة في جمل قصيرة أولًا ثم ركّب جملًا أطول بنفس النمط. " + exPart + errPart + " 【تلميح】 قارن هذه الوحدة بالوحدات المرتبطة لتثبيت الفرق.";
    const rel = [];
    (related || []).forEach((r) => {
      const ri = TOPICS.findIndex((x) => x[0] === r);
      if (ri >= 0) rel.push("lg" + String(ri + 1).padStart(2, "0") + "01");
    });
    if (ui > 0) rel.push("lg" + tnum + String(ui).padStart(2, "0"));
    if (ui < units.length - 1) rel.push("lg" + tnum + String(ui + 2).padStart(2, "0"));
    let quiz, mistakes = [];
    if (kind === "contrast") {
      const opts = shuffle(rr, [right, wrong, "كلتا الجملتين صحيحتان"]);
      quiz = { q: "أي جملة صحيحة؟", opts, correct: opts.indexOf(right), explain: why };
      mistakes = [{ w: wrong, r: right, why }];
    } else {
      // classify: which example illustrates this rule? distractors are real examples from OTHER topics
      const other = [];
      for (let k = 0; k < TOPICS.length && other.length < 2; k++) {
        if (k === ti || !topicExPool[k].length) continue;
        const cand = topicExPool[k][(ui * 2 + other.length) % topicExPool[k].length][0];
        if (cand !== ex1 && cand !== ex2) other.push(cand);
      }
      while (other.length < 2) other.push("Das Wetter ist schön.");
      const opts = shuffle(rr, [ex1].concat(other));
      quiz = { q: "أي مثال يوضّح هذه القاعدة؟ «" + focus.slice(0, 60) + "»", opts, correct: opts.indexOf(ex1), explain: "المثال الأول من نفس الدرس؛ الباقي من أبواب أخرى." };
    }
    grammar.push({
      id, title: arTitle + " (" + (ui + 1) + "/15): " + focus.slice(0, 70), deTitle,
      kap, level: lvl, cat, topicId: gid, unit: ui + 1, kind,
      body, examples: [[ex1, ar1], [ex2, ar2]],
      mistakes,
      related: [...new Set(rel)].filter((x) => x !== id),
      quiz,
    });
  });
});
console.log("grammar units:", grammar.length);

/* ---------- DIALOGUES ---------- */
const ALL_SITS = SITS.concat(EXTRA);
console.log("dialogue situations:", ALL_SITS.length);
const B1DTOPICS = new Set(["interviews", "services", "university", "worktalk", "banking", "documents"]);
const dialogues = [];
let seqD = 0;
ALL_SITS.forEach((sit, si) => {
  const [topic, sitLvl, titleDe, titleAr, lines] = sit;
  const lvl = B1DTOPICS.has(topic) ? "B1" : sitLvl;
  for (let v = 0; v < 8; v++) {
    seqD++;
    const sub = (s) => s.split("{N}").join(POOLS.N[v % POOLS.N.length][0])
      .split("{P}").join(POOLS.P[(v + si) % POOLS.P.length][0])
      .split("{T}").join(POOLS.T[(v + si * 3) % POOLS.T.length][0])
      .split("{I}").join(POOLS.I[(v + si * 5) % POOLS.I.length][0])
      .split("{N2}").join(POOLS.N2[(v + si * 7) % POOLS.N2.length][0]);
    const subAr = (s) => s.split("{N}").join(POOLS.N[v % POOLS.N.length][1])
      .split("{P}").join(POOLS.P[(v + si) % POOLS.P.length][1])
      .split("{T}").join(POOLS.T[(v + si * 3) % POOLS.T.length][1])
      .split("{I}").join(POOLS.I[(v + si * 5) % POOLS.I.length][1])
      .split("{N2}").join(POOLS.N2[(v + si * 7) % POOLS.N2.length][1]);
    dialogues.push({
      id: "ld" + String(seqD).padStart(4, "0"),
      level: lvl, topic, titleDe: titleDe + " " + (v + 1), titleAr: titleAr + " " + (v + 1),
      lines: lines.map(([sp, de, ar]) => [sp, sub(de), subAr(ar)]),
    });
  }
});
console.log("dialogues:", dialogues.length);

/* ---------- stage gate (iterative: prune dangling links, never cascade) ---------- */
(function () {
  const gAlive = () => new Set(grammar.map((g) => g.id));
  function prune() {
    const alive = gAlive();
    grammar.forEach((g) => {
      const kept = g.related.filter((r) => alive.has(r));
      if (kept.length !== g.related.length) {
        const sib = grammar.find((x) => x.topicId === g.topicId && x.id !== g.id && kept.indexOf(x.id) < 0);
        if (sib) kept.push(sib.id);
        g.related = kept;
      }
    });
  }
  for (let round = 0; round < 6; round++) {
    const r = gate.validateDataset({ vocab, sentences, grammar, exercises: [], dialogues });
    const removable = r.errors.filter((e) => !/broken related link/.test(e.reason));
    console.log("STAGE3 gate round " + round + ": errors=" + r.errors.length + " (removable=" + removable.length + ")");
    if (!r.errors.length) break;
    const bad = new Map();
    removable.forEach((e) => { if (!bad.has(e.id)) bad.set(e.id, e.reason); });
    for (let i = grammar.length - 1; i >= 0; i--) if (bad.has(grammar[i].id)) { rej(grammar[i].id, bad.get(grammar[i].id)); grammar.splice(i, 1); }
    for (let i = dialogues.length - 1; i >= 0; i--) if (bad.has(dialogues[i].id)) { rej(dialogues[i].id, bad.get(dialogues[i].id)); dialogues.splice(i, 1); }
    prune();
    if (!removable.length) {
      const r2 = gate.validateDataset({ vocab, sentences, grammar, exercises: [], dialogues });
      if (!r2.errors.length) break;
    }
  }
  prune();
  const r2 = gate.validateDataset({ vocab, sentences, grammar, exercises: [], dialogues });
  console.log("STAGE3 after reject: grammar=" + grammar.length + " dialogues=" + dialogues.length + " errors=" + r2.errors.length);
  r2.errors.slice(0, 10).forEach((e) => console.log("  ERR2 " + e.id + " :: " + e.reason));
  if (r2.errors.length) { console.log("FATAL stage3"); process.exit(1); }
})();
fs.writeFileSync(path.join(cache, "grammar.json"), JSON.stringify(grammar));
fs.writeFileSync(path.join(cache, "dialogues.json"), JSON.stringify(dialogues));
fs.writeFileSync(path.join(cache, "rejected.json"), JSON.stringify(rejected, null, 1));
console.log("stage3 ok");
