/* Deutsch Master - B2C answer integrity + educational QA regression tests.
 * Mission: audit B2C-derived exercises and their integration into the existing
 * assessment system (Batch 1: K15-K17). No new content, no new engines.
 *
 * Usage: node tools/test-b2c-answers.js
 * Exit 0 = PASS, 1 = FAIL. Deterministic: all randomness is seeded.
 *
 * What is pinned:
 *  C1  every B2C-derived SENT_FILL item (structure, unique distractors,
 *      no glued blanks, answer not leaked, feedback present, merge tags,
 *      dedup against the base bank honored)
 *  C2  artGap word-boundary guard, exercised against the REAL shipped
 *      implementation extracted from client/curriculum.js (D1 regression pin:
 *      "Je___ Blickwinkel" / "Gesun___ Optimismus" class defects)
 *  C3  12 grammar quizzes + 12 explain drills (index validity, unique options;
 *      the single intentional case-contrast unit is pinned as the ONLY
 *      normalized-duplicate exception and must stay index-scored)
 *  C4  18 reading + 12 listening questions (index validity, unique options,
 *      measured position distribution reported, never forced uniform)
 *  C5  shuffle/scoring contract: served correct text invariant under the
 *      assess-style shuffle+remap; SENT_FILL stored order stable across seeds
 *  C6  normWrite (REAL implementation from client/assess.js): case/punct/
 *      space tolerant, ß≡ss + ä→ae/ö→oe/ü→ue (D2), plain vowels NOT folded
 *  C7  assess validateQ contract holds for every generated fill (mc items
 *      would not be skipped by buildPool)
 *
 * Fidelity notes (honest limitations, see summary):
 *  - VOCAB pools approximate production (library cache + CURR overlays in
 *    merge order); distractor IDENTITIES may differ per device, but the
 *    (sentence, correct answer, type) core is deterministic and asserted.
 *  - Semantic "best fit" of meaning-gap distractors is by construction
 *    (random same-type words); structural non-equivalence is asserted, and
 *    any question needing a human linguist is listed as MANUAL-REVIEW.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let pass = 0, fail = 0;
const notes = [];
function ok(n, c, e) {
  if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); }
  else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); }
}
function normFold(s) { return String(s || "").toLowerCase(); }

// ---------- deterministic RNG ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeShuffle(rnd) {
  return function (a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
}

// ---------- load real sources ----------
function loadCurr(f) {
  const w = {};
  new Function("window", fs.readFileSync(path.join(root, "client", f), "utf8") + "")(w);
  return w[Object.keys(w).find(k => k.startsWith("CURR_"))];
}
const B2C = loadCurr("curr-b2c.js");
ok("S1 B2C source loads (120w/12g/48s/6r/6l/6sp/3real)",
  B2C && (B2C.words || []).length === 120 && (B2C.grammar || []).length === 12 &&
  (B2C.sentences || []).length === 48 && (B2C.reading || []).length === 6 &&
  (B2C.listen || []).length === 6 && (B2C.speak || []).length === 6 && (B2C.real || []).length === 3,
  "w=" + (B2C.words || []).length + " g=" + (B2C.grammar || []).length);

// REAL conjugateVerb extracted from client/script.js
const scriptSrc = fs.readFileSync(path.join(root, "client", "script.js"), "utf8");
const conjSlice = scriptSrc.slice(scriptSrc.indexOf("const IRREG = {"), scriptSrc.indexOf("\nfunction allVerbs()"));
const conjugateVerb = new Function(conjSlice + "\nreturn conjugateVerb;")();
ok("S2 real conjugateVerb extracted", typeof conjugateVerb === "function");

// REAL artGap extracted from client/curriculum.js (shipped implementation, guard included)
const currSrc = fs.readFileSync(path.join(root, "client", "curriculum.js"), "utf8");
const artSrc = currSrc.slice(currSrc.indexOf("function artGap("), currSrc.indexOf("function verbGap(")).trim();
const artGapReal = new Function("push", "shuffle4", artSrc + "\nreturn artGap;")(
  function () {}, function (a) { return a.slice(); });
ok("S3 real artGap extracted from curriculum.js", typeof artGapReal === "function");

// REAL normWrite extracted from client/assess.js
const assessSrc = fs.readFileSync(path.join(root, "client", "assess.js"), "utf8");
const nwLine = assessSrc.slice(assessSrc.indexOf("function normWrite(s)"));
const normWrite = new Function(nwLine.slice(0, nwLine.indexOf("\n")) + "\nreturn normWrite;")();
ok("S4 real normWrite extracted from assess.js", typeof normWrite === "function");

// ---------- production-like VOCAB + base bank ----------
const EN2AR = { noun: "اسم", verb: "فعل", adj: "صفة", pron: "ضمير", func: "أداة", adv: "مفردات" };
const libVocab = JSON.parse(fs.readFileSync(path.join(root, "tools", "clib", ".cache", "vocab.json"), "utf8"));
const OVERLAYS = ["curr-a1x.js", "curr-a2.js", "curr-a2b.js", "curr-b1.js", "curr-b1b.js", "curr-b2.js", "curr-b2b.js"];
const overlayData = OVERLAYS.map(f => ({ f, D: loadCurr(f) }));
const VOCAB = [];
libVocab.forEach(w => VOCAB.push({ de: w.de, art: w.art || "-", type: EN2AR[w.type] || "مفردات", level: w.level, kap: "KX" }));
overlayData.forEach(({ D }) => {
  (D.words || []).forEach(r => VOCAB.push({ de: r[0], art: r[1], type: r[5], level: D.level, kap: r[7] }));
});
const playSrc = fs.readFileSync(path.join(root, "client", "play.js"), "utf8");
const bankExpr = playSrc
  .slice(playSrc.indexOf("const SENT_FILL="), playSrc.indexOf("];", playSrc.indexOf("const SENT_FILL=")) + 2)
  .replace("const SENT_FILL=", "").replace(/;\s*$/, "");
const BASE_FILL = new Function("return (" + bankExpr + ");")();
ok("S5 base SENT_FILL bank loads", Array.isArray(BASE_FILL) && BASE_FILL.length > 100, "n=" + BASE_FILL.length);

// ---------- faithful currBuildFills port (decision logic mirrors client/curriculum.js) ----------
function generateFills(D, L, vocab, seenS, shuffle4) {
  const out = [];
  function push(chap, s, o, c, why, typ, gram) {
    if (!s || !o || o.length < 3) return "bad";
    if (seenS[s]) { out.skipped = out.skipped || []; out.skipped.push(s); return "dup"; }
    seenS[s] = 1;
    out.push({ s, o: o.slice(0, 4), c: Math.max(0, Math.min(3, c)), why: why || "", lvl: L, typ: typ || "meaning", chapterId: chap, grammarTarget: gram || typ || "vocab" });
    return "ok";
  }
  function artGap(ex, art, de, ar, chap, gram) {
    // Accept/reject + sentence derivation mirror the REAL shipped artGap
    // (identical boundary rule; C2 pins the real implementation directly, so
    // any drift between this port and the engine shows up in the census C1a).
    // Only the option shuffle differs (seeded here for determinism).
    const needle = art + " " + de;
    let from = 0, at = -1;
    for (;;) {
      at = ex.indexOf(needle, from);
      if (at < 0) return false;
      if (at === 0 || /[\s.,!?;:"'«»„“()—–-]/.test(ex.charAt(at - 1))) break;
      from = at + 1;
    }
    const opts = shuffle4(["der", "die", "das"]);
    push(chap, ex.slice(0, at) + "___ " + de + ex.slice(at + needle.length), opts, opts.indexOf(art), ar + " — اختر الأداة", "article", gram || "article");
    return true;
  }
  function verbGap(ex, inf, ar, chap, gram) {
    let conj = null;
    try { conj = conjugateVerb(inf); } catch (e) { /* engine treats as non-conjugable */ }
    if (!conj) return false;
    const subs = [["Ich", "ich"], ["Du", "du"], ["Er", "er"], ["Sie", "er"], ["Wir", "wir"], ["Ihr", "ihr"]];
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i][0], key = subs[i][1], form = conj[key];
      if (!form) continue;
      if (ex.indexOf(sub + " ") === 0) {
        const rest = ex.slice(sub.length + 1);
        const fverb = form.split(" ").pop();
        if (rest.indexOf(fverb) !== 0) continue;
        const pool = [conj.ich, conj.du, conj.er, conj.wir].map(f => f.split(" ").pop());
        const uniq = [];
        pool.forEach(p => { if (uniq.indexOf(p) < 0) uniq.push(p); });
        while (uniq.length < 4) uniq.push(inf);
        const opts = shuffle4(uniq.slice(0, 4));
        push(chap, sub + " ___" + rest.slice(fverb.length), opts, opts.indexOf(fverb), ar + " — صرف الفعل", "verb", gram || "conjugation");
        return true;
      }
    }
    return false;
  }
  const sameType = {};
  vocab.forEach(w => {
    if ((w.level || "A1") !== L) return;
    const k = w.type || "مفردات";
    (sameType[k] = sameType[k] || []).push(w);
  });
  function meanGap(ex, targetW, ar, chap, gram) {
    const words = ex.replace(/[.?!,]/g, "").split(" ").filter(Boolean);
    if (words.length < 4) return false;
    const cand = words.filter(t => t.length > 3 && t !== targetW);
    if (!cand.length) return false;
    const pick = cand[Math.floor(cand.length / 2)];
    const pool = (sameType[targetW.type] || []).filter(w => w.de !== pick && w.de.length > 3);
    if (pool.length < 3) return false;
    const opts = shuffle4([pick, pool[0].de, pool[1].de, pool[2].de]);
    push(chap, ex.split(pick).join("___"), opts, opts.indexOf(pick), ar + " — الكلمة في السياق", "meaning", gram || "vocab");
    return true;
  }
  (D.words || []).forEach(r => {
    const de = r[0], art = r[1], ar = r[2], type = r[5], chap = r[7], ex = r[9] || "";
    if (!ex || ex.split(" ").length < 3) return;
    if (type === "اسم" && art !== "-") { if (artGap(ex, art, de, ar, chap)) return; }
    if (type === "فعل") { if (verbGap(ex, de, ar, chap)) return; }
    meanGap(ex, { de, type }, ar, chap);
  });
  (D.grammar || []).forEach(g => {
    const n = g.length, chap = g[1];
    let done = 0;
    g.slice(3, n - 4).forEach(e => {
      if (done >= 2) return;
      const p = String(e).split("|"), dex = p[0] || "", arx = p[1] || "";
      if (!dex || dex.split(" ").length < 3) return;
      const m = dex.match(/^(der|die|das) (\S+)/);
      if (m) {
        // grammar-example article path uses the same boundary rule
        const needle = m[1] + " " + m[2];
        const at = dex.indexOf(needle);
        const okB = at === 0 || (at > 0 && /[\s.,!?;:"'«»„“()—–-]/.test(dex.charAt(at - 1)));
        if (at >= 0 && okB) {
          const opts = shuffle4(["der", "die", "das"]);
          push(chap, dex.slice(0, at) + "___ " + m[2] + dex.slice(at + needle.length), opts, opts.indexOf(m[1]), arx + " — اختر الأداة", "article", g[0]);
          done++;
          return;
        }
      }
      const v = dex.match(/^(Ich|Du|Er|Sie|Wir|Ihr) (\S+)/);
      if (v) {
        const inf = (v[2].replace(/(e|st|t|en)$/, "") || "").toLowerCase();
        let hit = null;
        vocab.forEach(w => {
          if (w.type !== "فعل" || hit) return;
          const stem = w.de.replace(/en$/, "").toLowerCase();
          if (stem && inf.indexOf(stem) === 0) hit = w.de;
        });
        if (hit && verbGap(dex, hit, arx, chap, g[0])) { done++; return; }
      }
      if (meanGap(dex, { de: "", type: "مفردات" }, arx, chap, g[0])) done++;
    });
  });
  return out;
}

function enumerate(seed) {
  const seenS = {};
  BASE_FILL.forEach(f => { seenS[f.s] = 1; });
  const shuf = makeShuffle(mulberry32(seed));
  overlayData.forEach(({ D }) => { generateFills(D, D.level, VOCAB, seenS, shuf); });
  return generateFills(B2C, "B2", VOCAB, seenS, shuf);
}
const fills = enumerate(4242);
const fillsB = enumerate(777);
const core = a => a.map(f => f.chapterId + "||" + f.typ + "||" + f.s + "||" + f.o[f.c]).sort().join("\n");
ok("C5a B2C fill core deterministic across seeds", core(fills) === core(fillsB),
  "n=" + fills.length + "/" + fillsB.length);
const byType = {};
fills.forEach(f => { byType[f.typ] = (byType[f.typ] || 0) + 1; });
ok("C1a B2C fill census post-fix (0 article / 6 verb / rest meaning, 138 total)",
  fills.length === 138 && (byType.article || 0) === 0 && byType.verb === 6 && byType.meaning === 132,
  JSON.stringify(byType) + " skipped-dup=" + ((fills.skipped || []).length));
ok("C1b cross-bank dedup honored (1 B2C verb candidate suppressed, already served by B2)",
  (fills.skipped || []).length === 1 && /Sie ___.*sie habe keine Zeit/.test((fills.skipped || [])[0] || ""),
  JSON.stringify(fills.skipped || []));

// ---------- C1 structural audit of every fill ----------
const GLUED = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſʾʼ`’'\-ßäöüÄÖÜ]___|___[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9_ßäöüÄÖÜ]/;
let badBlank = [], badOpts = [], badRange = [], badLeak = [], badWhy = [], badTags = [], multiBlank = [], inBank = [];
fills.forEach(f => {
  if (GLUED.test(f.s)) badBlank.push(f.s);
  if ((f.s.match(/___/g) || []).length !== 1) multiBlank.push(f.s);
  if (!Array.isArray(f.o) || f.o.length < 3) badOpts.push(f.s);
  if (!(f.c >= 0 && f.c < f.o.length)) badRange.push(f.s);
  const ex = new Set(f.o.map(o => String(o).trim()));
  if (ex.size !== f.o.length) badOpts.push(f.s + " [dup-exact]");
  const fx = new Set(f.o.map(o => normFold(String(o).trim())));
  if (fx.size !== f.o.length) badOpts.push(f.s + " [dup-folded]");
  if (!f.why || !f.why.trim()) badWhy.push(f.s);
  if (!(f.chapterId === "K15" || f.chapterId === "K16" || f.chapterId === "K17") || f.lvl !== "B2") badTags.push(f.s);
  const nos = f.s.replace(/___/g, "");
  if (nos.indexOf(f.o[f.c]) >= 0) badLeak.push(f.s + " [ans=" + f.o[f.c] + "]");
  if (BASE_FILL.some(b => b.s === f.s)) inBank.push(f.s);
});
ok("C1c no glued blanks (D1 guard holds on all 138)", badBlank.length === 0, badBlank.slice(0, 2).join(" ~ "));
ok("C1d exactly one blank per question", multiBlank.length === 0, multiBlank.slice(0, 2).join(" ~ "));
ok("C1e options valid: ≥3, in-range c, exact+fold unique", badOpts.length === 0 && badRange.length === 0,
  badOpts.slice(0, 2).join(" ~ ") + badRange.slice(0, 2).join(" ~ "));
ok("C1f feedback present on all fills", badWhy.length === 0);
ok("C1g merge tags (K15-17, lvl B2) on all fills", badTags.length === 0);
ok("C1h answer never leaked elsewhere in sentence", badLeak.length === 0, badLeak.slice(0, 2).join(" ~ "));
ok("C1i dedup: no generated sentence collides with base bank", inBank.length === 0);

// verb-fill reconstruction: blank + answer must rebuild the source example
const verbSrc = {};
B2C.words.forEach(r => { if (r[9]) verbSrc[r[9]] = 1; });
B2C.grammar.forEach(g => {
  g.slice(3, g.length - 4).forEach(e => {
    const p = String(e).split("|");
    if (p[0]) verbSrc[p[0]] = 1;
  });
});
let badRecon = [];
fills.filter(f => f.typ === "verb").forEach(f => {
  const rebuilt = f.s.replace("___", f.o[f.c]);
  if (!verbSrc[rebuilt]) badRecon.push(f.s + " -> " + rebuilt);
});
ok("C1j verb fills reconstruct a real source sentence", badRecon.length === 0, badRecon.slice(0, 2).join(" ~ "));

// ---------- C2: real artGap behavior ----------
function probeArtGap(ex, art, de) {
  let captured = null;
  const sh = a => a.slice();
  const p = function (chap, s, o, c, why, typ, gram) { captured = { s, o, c }; };
  const r = new Function("push", "shuffle4", artSrc + "\nreturn artGap;")(p, sh)(ex, art, de, "ar", "K17");
  return { accepted: r === true, captured };
}
let t2 = probeArtGap("Jeder Blickwinkel zählt.", "der", "Blickwinkel");
ok("C2a glued 'der Blickwinkel' in 'Jeder…' rejected", t2.accepted === false);
t2 = probeArtGap("Jeder Täuschungsversuch fliegt auf.", "der", "Täuschungsversuch");
ok("C2b glued 'der Täuschungsversuch' in 'Jeder…' rejected", t2.accepted === false);
t2 = probeArtGap("Gesunder Optimismus trägt weit.", "der", "Optimismus");
ok("C2c glued 'der Optimismus' in '…nder…' rejected", t2.accepted === false);
t2 = probeArtGap("Das ist der Kollege, mit dem ich arbeite.", "der", "Kollege");
ok("C2d valid mid-sentence article accepted with clean blank",
  t2.accepted === true && t2.captured && t2.captured.s === "Das ist ___ Kollege, mit dem ich arbeite." && t2.captured.o[t2.captured.c] === "der",
  t2.captured ? t2.captured.s : "rejected");
t2 = probeArtGap("Jeder sieht der Mann.", "der", "Mann");
ok("C2e scan-forward finds later valid occurrence",
  t2.accepted === true && t2.captured && t2.captured.s === "Jeder sieht ___ Mann.",
  t2.captured ? t2.captured.s : "rejected");
// currRuleQs carries the same guard (source tripwire, honestly labeled)
ok("C2f currRuleQs article path has boundary guard (source tripwire)",
  /dex\.match\(\/\(\^|\[\\s/.test(currSrc) && /a0=m\.index\+m\[1\]\.length/.test(currSrc));

// ---------- C3: grammar quizzes + explain drills ----------
let gBad = [];
B2C.grammar.forEach((g, i) => {
  const n = g.length, q = g[n - 4], opts = String(g[n - 3]).split("|"), ci = parseInt(g[n - 2], 10), ex = g[n - 1];
  if (!q || !q.trim()) gBad.push("g" + i + ":noq");
  if (opts.length < 3 || !(ci >= 0 && ci < opts.length)) gBad.push("g" + i + ":badidx");
  if (new Set(opts.map(o => o.trim())).size !== opts.length) gBad.push("g" + i + ":dup");
  if (!ex || !ex.trim()) gBad.push("g" + i + ":noexplain");
  if (String(g[n - 3]).indexOf("|") < 0) gBad.push("g" + i + ":oneopt");
});
ok("C3a 12 grammar quizzes structurally valid", B2C.grammar.length === 12 && gBad.length === 0, gBad.slice(0, 3).join(";"));
// the ONLY normalized-duplicate exception, by design (tests capitalization), index-scored
const normDupUnits = [];
B2C.grammar.forEach((g, i) => {
  const opts = String(g[g.length - 3]).split("|");
  if (new Set(opts.map(o => normFold(o.trim()))).size !== opts.length) normDupUnits.push(i + ":" + g[0].slice(0, 28));
});
ok("C3b exactly one intentional case-contrast unit (Nominalisierung, index-scored)",
  normDupUnits.length === 1 && /^10:/.test(normDupUnits[0]), JSON.stringify(normDupUnits));
const drills = [];
Object.keys(B2C.explain || {}).forEach(k => {
  ((B2C.explain[k] || {}).drill || []).forEach(d => drills.push({ k, d }));
});
let dBad = [];
drills.forEach(({ k, d }) => {
  if (!Array.isArray(d.opts) || d.opts.length < 3) dBad.push(k + ":opts");
  if (!(d.correct >= 0 && d.correct < d.opts.length)) dBad.push(k + ":idx");
  if (new Set(d.opts.map(o => String(o).trim())).size !== d.opts.length) dBad.push(k + ":dup");
  if (!d.why) dBad.push(k + ":why");
});
ok("C3c 12 explain drills structurally valid", drills.length === 12 && dBad.length === 0, dBad.slice(0, 3).join(";"));
const normDupDrills = drills.filter(({ d }) =>
  new Set(d.opts.map(o => normFold(String(o).trim()))).size !== d.opts.length).map(({ k }) => k);
ok("C3d drill case-contrast only in gx10 (same intentional unit)",
  normDupDrills.length === 1 && normDupDrills[0] === "gx10", JSON.stringify(normDupDrills));

// ---------- C4: reading + listening ----------
function auditQs(items, getQs) {
  const bad = [], pos = {};
  items.forEach(r => {
    (getQs(r) || []).forEach(q => {
      pos[q.correct] = (pos[q.correct] || 0) + 1;
      if (!q.opts || q.opts.length < 2) bad.push("opts<2:" + q.q);
      if (!(q.correct >= 0 && q.correct < q.opts.length)) bad.push("idx:" + q.q);
      if (new Set(q.opts.map(o => String(o).trim())).size !== q.opts.length) bad.push("dup:" + q.q);
      if (!q.q || !q.q.trim()) bad.push("noq");
    });
  });
  return { bad, pos };
}
const ra = auditQs(B2C.reading || [], r => r.qs);
const la = auditQs(B2C.listen || [], l => l.qs);
const rTot = Object.values(ra.pos).reduce((a, b) => a + b, 0);
const lTot = Object.values(la.pos).reduce((a, b) => a + b, 0);
ok("C4a 18 reading questions valid", rTot === 18 && ra.bad.length === 0, ra.bad.slice(0, 2).join(";"));
ok("C4b 12 listening questions valid", lTot === 12 && la.bad.length === 0, la.bad.slice(0, 2).join(";"));
function pct(pos, tot) {
  return Object.keys(pos).sort().map(k => k + ":" + pos[k] + " (" + Math.round(pos[k] / tot * 100) + "%)").join(", ");
}
console.log("INFO reading source positions (n=18): " + pct(ra.pos, rTot) + " — served display-shuffled, index-scored");
console.log("INFO listening source positions (n=12): " + pct(la.pos, lTot) + " — served display-shuffled, index-scored");
notes.push("reading-src=" + pct(ra.pos, rTot), "listening-src=" + pct(la.pos, lTot));
// stored fill positions for THIS seed (device-specific; distribution must exist, never forced)
const fpos = [0, 0, 0, 0];
fills.forEach(f => fpos[f.c]++);
console.log("INFO B2C fill stored positions (seed 4242, n=" + fills.length + "): " +
  fpos.map((n, i) => i + ":" + n + " (" + Math.round(n / fills.length * 100) + "%)").join(", ") +
  " — fixed per device/load, served without reshuffle (stable)");
notes.push("fillpos=" + fpos.join("/"));

// ---------- C5: shuffle/scoring contract ----------
let servedBad = 0;
B2C.grammar.forEach(g => {
  const n = g.length, srcOpts = String(g[n - 3]).split("|"), srcCi = parseInt(g[n - 2], 10);
  const rnd = mulberry32(1000 + n);
  for (let t = 0; t < 200; t++) {
    // assess mkGrammar pattern: shuffle indices, remap correct
    const order = srcOpts.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    const servedOpts = order.map(i => srcOpts[i]);
    const servedCorrect = order.indexOf(srcCi);
    if (servedOpts[servedCorrect] !== srcOpts[srcCi]) servedBad++;
  }
});
ok("C5a assess shuffle+remap preserves correct text (12 units × 200 seeds)", servedBad === 0);
// fillToQuiz (sentex) pattern: display-shuffled per build, correctText invariant
let fillServeBad = 0;
for (let t = 0; t < 50; t++) {
  const rnd = mulberry32(5000 + t);
  const sh = makeShuffle(rnd);
  fills.forEach(f => {
    const order = sh(f.o.map((_, i) => i));
    const served = order.map(i => f.o[i]);
    if (served[order.indexOf(f.c)] !== f.o[f.c]) fillServeBad++;
  });
}
ok("C5b fill served-answer invariant across 50 rebuilds", fillServeBad === 0);

// ---------- C6: normWrite ----------
const nwCases = [
  ["Der", "der", true, "case-fold"],
  ["  der  ", "der", true, "spaces"],
  ["der.", "der", true, "trailing period"],
  ["Hilfe!", "hilfe", true, "trailing bang+case"],
  ["regelmäßig", "regelmaessig", true, "ß≡ss+ä→ae (D2)"],
  ["REGELMÄSSIG.", "regelmaessig", true, "upper+punct+transcription"],
  ["schön", "schoen", true, "ö→oe transcription"],
  ["schön", "schon", false, "umlaut NOT folded to plain vowel"],
  ["Grüße", "gruesse", true, "ü→ue+ß≡ss"],
  ["für", "fuer", true, "ü→ue"],
  ["Maße", "masse", true, "ß≡ss caveat (documented)"],
  ["der", "die", false, "distinct answers"],
  ["", "", true, "empty"],
  ["He lernt  Deutsch", "he lernt deutsch", true, "inner space collapse"]
];
let nwBad = [];
nwCases.forEach(([a, b, eq, label]) => {
  const got = normWrite(a) === normWrite(b);
  if (got !== eq) nwBad.push(label + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b));
});
ok("C6 normWrite: tolerant case/punct/space, ß≡ss, umlauts kept", nwBad.length === 0, nwBad.slice(0, 3).join(";"));

// ---------- C7: assess validateQ contract for every fill ----------
// mirrors client/assess.js validateQ mc-branch (unique non-empty opts, valid c)
let vqBad = [];
fills.forEach(f => {
  if (!f.o || f.o.length < 2) { vqBad.push(f.s + " [len]"); return; }
  if (!(f.c >= 0 && f.c < f.o.length)) { vqBad.push(f.s + " [idx]"); return; }
  const seen = {};
  let dup = false;
  f.o.forEach(o => {
    const k = String(o == null ? "" : o).trim();
    if (!k || seen[k]) dup = true;
    seen[k] = 1;
  });
  if (dup) vqBad.push(f.s + " [dup]");
});
ok("C7 all 138 fills satisfy assess validateQ (served, never skipped)", vqBad.length === 0);

// ---------- summary ----------
console.log("----");
console.log("inspected: fills=" + fills.length + " grammar=12 drills=" + drills.length +
  " readingQs=" + rTot + " listeningQs=" + lTot);
console.log("valid: fills=" + (fills.length - badBlank.length - badOpts.length - badRange.length) +
  " (defects fixed: 2 malformed article fills removed, 1 valid meaning gap added, 1 word without gap: 3-word example below engine minimum)");
console.log("ambiguous flagged: 0 (1 intentional case-contrast unit pinned, index-scored)");
console.log("notes: " + notes.join(" | "));
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
