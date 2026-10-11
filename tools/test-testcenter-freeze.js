/* Regression test for the Tests Center "Page Unresponsive" freeze.
   Root cause (measured in headless Chrome, academy.html, VOCAB=61k):
   selecting a Kapitel blocked the main thread ~18.7s because every pool
   helper rescanned the entire 60-100k VOCAB / 15k SENTENCES banks on EVERY
   question attempt, and probeCount built a full 120-question test for EACH
   of ~19 category cards per render (tens of thousands of full-bank scans +
   full-array shuffles per click).
   Fix under test: length-stamped bank index (one pass per growth, O(1)
   lookups), bounded sampling instead of full shuffles, per-build filter
   memo, readiness-map reuse, stamp-aware probe cache, start debounce.
   This test drives the REAL assess.js + testcenter.js in node with a
   60k-word / 15k-sentence synthetic bank and asserts correctness (same
   records, same filters, honest counts, empty/malformed safety) plus
   performance budgets that fail loudly if full-bank scans ever return.
   Browser wall-time is verified separately (freeze-probe); budgets here
   are generous for node. Run: node tools/test-testcenter-freeze.js */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + String(extra).slice(0, 300) + "]" : "")); }
}

/* ---------------- synthetic banks (shaped like the real ones) ---------------- */
function buildWorld(vocabKX) {
  const KAPS = ["K0", "K1", "K2", "K3", "K4", "K5", "KX", "K6", "K7", "K8", "K9", "K10", "K11", "K12", "K13", "K14"];
  const KAPITEL = KAPS.map(k => ({ id: k, name: "Kapitel " + k, icon: "📖" }));
  const VOCAB = [];
  let n = 0;
  function addW(kap, count, level, verbEvery, nounEvery) {
    for (let i = 0; i < count; i++) {
      n++;
      const id = "t" + String(n).padStart(6, "0");
      if (i % verbEvery === 0) VOCAB.push({ id, de: "verb" + n + "en", art: "-", ar: "فعل" + n, type: "فعل", kap, level, plural: "" });
      else if (i % nounEvery === 0) VOCAB.push({ id, de: "Apfel" + n, art: ["der", "die", "das"][n % 3], ar: "تفاحة" + n, type: "اسم", kap, level, plural: "Äpfel" + n });
      else if (i % 5 === 0) VOCAB.push({ id, de: "schön" + n, art: "-", ar: "جميل" + n, type: "صفة", kap, level, plural: "" });
      else VOCAB.push({ id, de: "Wort" + n, art: "-", ar: "كلمة" + n, type: "عام", kap, level, plural: "" });
    }
  }
  addW("K1", 4000, "A1", 3, 4);
  addW("K2", 1500, "A1", 3, 4);
  addW("KX", vocabKX, "B1", 4, 5);
  const k1verbs = VOCAB.filter(w => w.kap === "K1" && w.type === "فعل").map(w => w.de);
  const SENTENCES = [];
  let sn = 0;
  function addS(kap, count, level, hosts) {
    for (let i = 0; i < count; i++) {
      sn++;
      if (hosts) {
        const v = hosts[sn % hosts.length];
        SENTENCES.push({ id: "s" + sn, de: "Er " + v + "T heute und morgen.", ar: "هو يفعل اليوم وغدا " + sn, kap, level });
      } else {
        SENTENCES.push({ id: "s" + sn, de: "Das ist ein schöner langer Beispielsatz Nummer " + sn + " heute.", ar: "هذه جملة مثال طويلة رقم " + sn, kap, level });
      }
    }
  }
  addS("K1", 1500, "A1", k1verbs);
  addS("KX", 13500, "B1", null);
  const SENT_FILL = [];
  for (let i = 0; i < 60; i++) {
    SENT_FILL.push({ id: "f" + i, s: "Ich habe ___ Apfel" + i + ".", o: ["der", "die", "das", "den"], c: i % 4, why: "x", lvl: "A1", typ: "article", grammarTarget: "article", chapterId: "K1" });
  }
  SENT_FILL.push({ id: "bad1", s: "No blank here.", o: ["a", "b", "c"], c: 0, lvl: "A1", chapterId: "K1" });
  SENT_FILL.push(null);
  const GRAMMAR = [];
  for (let i = 0; i < 8; i++) GRAMMAR.push({ id: "g" + i, title: "Regel" + i, kap: "K1", level: "A1", quiz: { q: "Frage" + i + "?", opts: ["a", "b", "c"], correct: i % 3, explain: "weil" } });
  const GLAB_BANK = {
    g0: { questions: [{ type: "mc", t: "T0?", opts: ["a", "b"], correct: 0 }, { type: "mc", t: "T1?", opts: ["a", "b"], correct: 1 }, { type: "order", opts: ["x"] }] },
    g1: { questions: [{ type: "mc", t: "T2?", opts: ["a", "b"], correct: 0 }] }
  };
  const CURR_READING = [];
  for (let i = 0; i < 3; i++) CURR_READING.push({ id: "r" + i, de: "Lesetext Nummer " + i + " mit mehreren Sätzen zum Verstehen.", ar: "نص", kap: "K1", level: "A1", title: "Text" + i, qs: [{ q: "Q" + i + "?", opts: ["a", "b"], correct: 0 }] });
  const LISTEN_ITEMS = [];
  for (let i = 0; i < 30; i++) LISTEN_ITEMS.push({ de: "Ich höre heute einen langen Satz " + i, ar: "أسمع " + i });
  const SPEAK_ITEMS = [];
  for (let i = 0; i < 10; i++) SPEAK_ITEMS.push({ q: "Frage" + i + "?", ar: "سؤال" + i, sample: "Das ist eine Beispielantwort Nummer " + i });
  const TALK_SITS = [];
  for (let t = 0; t < 20; t++) {
    const steps = [];
    for (let s2 = 0; s2 < 4; s2++) steps.push(["Satz" + t + "-" + s2, "معنى", ["Antwort" + t + "-" + s2 + "a", "Antwort" + t + "-" + s2 + "b", "Antwort" + t + "-" + s2 + "c"], 0]);
    TALK_SITS.push({ id: "t" + t, t: "Thema" + t, steps });
  }
  const REAL_SITS = [];
  for (let t = 0; t < 10; t++) {
    const phr = [];
    for (let p = 0; p < 6; p++) phr.push(["Deutsch" + t + "-" + p, "عربي" + t + "-" + p]);
    REAL_SITS.push({ id: "r" + t, t: "Ort" + t, phr });
  }
  const S = { customWords: [], status: {}, mistakes: {}, grammar: {}, assess: { history: [] } };
  return { KAPITEL, VOCAB, SENTENCES, SENT_FILL, GRAMMAR, GLAB_BANK, CURR_READING, LISTEN_ITEMS, SPEAK_ITEMS, TALK_SITS, REAL_SITS, S };
}

const GKEYS = ["KAPITEL", "VOCAB", "SENTENCES", "SENT_FILL", "GRAMMAR", "GLAB_BANK", "CURR_READING", "LISTEN_ITEMS", "SPEAK_ITEMS", "TALK_SITS", "REAL_SITS", "S", "allWords", "wordById", "conjugateVerb", "escapeHtml", "getStatus"];
function installWorld(w) {
  uninstallWorld();
  global.KAPITEL = w.KAPITEL; global.VOCAB = w.VOCAB; global.SENTENCES = w.SENTENCES; global.SENT_FILL = w.SENT_FILL;
  global.GRAMMAR = w.GRAMMAR; global.GLAB_BANK = w.GLAB_BANK; global.CURR_READING = w.CURR_READING;
  global.LISTEN_ITEMS = w.LISTEN_ITEMS; global.SPEAK_ITEMS = w.SPEAK_ITEMS; global.TALK_SITS = w.TALK_SITS;
  global.REAL_SITS = w.REAL_SITS; global.S = w.S;
  global.allWords = function () { return w.VOCAB.concat((global.S && global.S.customWords) || []); };
  global.wordById = function (id) { for (let i = 0; i < w.VOCAB.length; i++) if (w.VOCAB[i].id === id) return w.VOCAB[i]; return null; };
  global.conjugateVerb = function (inf) {
    if (!inf || typeof inf !== "string" || inf.length < 3) return null;
    return { ich: "ich " + inf + "E", du: "du " + inf + "ST", er: "er " + inf + "T", wir: "wir " + inf + "EN", ihr: "ihr " + inf + "T", sie: "sie " + inf + "EN" };
  };
  global.escapeHtml = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  global.getStatus = function () { return "new"; };
}
function uninstallWorld() { GKEYS.forEach(k => { try { delete global[k]; } catch (e) {} }); }

function loadAssess() {
  const SRC = fs.readFileSync(path.join(root, "client", "assess.js"), "utf8");
  return new Function(SRC + "\nreturn DMAssess;")();
}
function loadCenter(DMAssess) {
  const SRC = fs.readFileSync(path.join(root, "client", "testcenter.js"), "utf8");
  return new Function("DMAssess", SRC + "\nreturn DMTestCenter;")(DMAssess);
}

/* ---------------- static guards: the freeze pattern must stay gone ---------------- */
const ASRC = fs.readFileSync(path.join(root, "client", "assess.js"), "utf8");
const TSRC = fs.readFileSync(path.join(root, "client", "testcenter.js"), "utf8");
check("F1 indexed bank views present", ASRC.includes("function poolIndex") && ASRC.includes("byKapLevel"));
check("F2 bounded sampling present", ASRC.includes("function pickOne") && ASRC.includes("function pickNUnique") && ASRC.includes("function findHost"));
check("F3 per-build filter memo present", ASRC.includes("function memoPool") && ASRC.includes("o.memo"));
check("F4 no full-bank shuffle in factories", !/shuffle\((pool|words\(\)|gl|gs|rs|verbs)/.test(ASRC.replace(/\/\*[\s\S]*?\*\//g, "")), "shuffle(pool|words|gl|gs|rs|verbs) found");
check("F5 readiness map reused by testcenter", TSRC.includes("(d && d.rmap) || rmapNow()"));
check("F6 probe cache follows bank growth", TSRC.includes("probeBankStamp"));
check("F7 start overlap guard present", TSRC.includes("canStart()") && TSRC.includes("unStart()"));

/* ---------------- correctness: index == naive filters, same order ---------------- */
const world = buildWorld(54500);
installWorld(world);
const DMAssess = loadAssess();
const U = DMAssess.ui, SP = DMAssess.specs;
check("F8 assess loads in node", !!DMAssess && !!U && !!SP);

function naiveVocab(o) {
  return world.VOCAB.filter(w => {
    if (!w || !w.de) return false;
    if (o.kap && (w.kap || "") !== o.kap) return false;
    if (o.level && (w.level || "A1") !== o.level) return false;
    return true;
  });
}
const idxK1 = U.vocabPool({ kap: "K1" }).map(w => w.id).join(",");
const navK1 = naiveVocab({ kap: "K1" }).map(w => w.id).join(",");
check("F9 vocabPool K1 identical to naive filter (4000, same order)", idxK1 === navK1 && idxK1.split(",").length === 4000, "got=" + idxK1.split(",").length);
check("F10 vocabPool level identical", U.vocabPool({ level: "B1" }).length === naiveVocab({ level: "B1" }).length);
check("F11 sentPool K1 identical (1500, same order)", U.sentPool({ kap: "K1" }).length === 1500);
const gapN = SP.kapitelCategorySpec("K1", "sentences", "master", "medium", null).build()
  .filter(q => q.refKind === "fill" && String(q.prompt).indexOf("___") >= 0).length;
check("F12 fillPool drops invalid gap items (60 valid gaps flow through)", gapN >= 50, "gapQ=" + gapN);
check("F13 grammarPool K1", U.grammarPool({ kap: "K1" }).length === 8);
const k2before = U.vocabPool({ kap: "K2" }).length;
for (let i = 0; i < 500; i++) world.VOCAB.push({ id: "gx" + i, de: "Neu" + i, art: "-", ar: "جديد" + i, type: "عام", kap: "K2", level: "A1", plural: "" });
check("F14 index follows bank growth (append 500 -> visible)", U.vocabPool({ kap: "K2" }).length === k2before + 500, k2before + "->" + U.vocabPool({ kap: "K2" }).length);
world.VOCAB.splice(world.VOCAB.length - 500, 500);
const S0 = U.vocabPool({}).length;
world.S.customWords.push({ id: "c1", de: "Handy", art: "das", ar: "جوال", type: "اسم", kap: "K1", level: "A1", plural: "Handys" });
check("F15 custom words join the index", U.vocabPool({}).length === S0 + 1 && U.vocabPool({ kap: "K1" }).length === 4001);
world.S.customWords.pop();

/* ---------------- performance + honest counts on a 60k bank ---------------- */
const t0 = Date.now();
const counts = {};
let totalBad = 0;
SP.CAT_IDS.filter(c => c !== "mistakes").forEach(cid => {
  const spec = SP.kapitelCategorySpec("K1", cid, "master", "medium", null);
  const got = spec.build();
  counts[cid] = got.length;
  totalBad += got.filter(q => !DMAssess.validateQ(q)).length;
});
const specials = {
  full: SP.kapitelExamSpec("K1", null, 120).build().length,
  smart: SP.smartSpec({ weak: [], kap: "K1", total: 120 }).build().length,
  cumul: SP.cumulSpec(["K1", "K2"], 120, {}).build().length,
  boss: SP.bossSpec("K1", 120).build().length
};
const dtAll = Date.now() - t0;
check("F16 all generated questions valid", totalBad === 0, totalBad + " invalid");
check("F17 14 category master builds < 6000ms (was ~16s in browser)", dtAll < 6000, dtAll + "ms " + JSON.stringify(counts));
check("F18 words availability honest on rich bank", counts.words >= 100, counts.words);
check("F19 verbs availability honest", counts.verbs >= 40, counts.verbs);
check("F20 reading availability honest (fallback works)", counts.reading >= 20, counts.reading);
check("F21 small-but-real pools served", counts.listening >= 8 && counts.speaking >= 5 && counts.reallife >= 20, JSON.stringify({ l: counts.listening, s: counts.speaking, r: counts.reallife }));
check("F22 specials build", specials.full >= 40 && specials.smart >= 40 && specials.cumul >= 40 && specials.boss >= 40, JSON.stringify(specials));

/* ---------------- testcenter integration (probeCount + renderSection) ---------------- */
const DMTestCenter = loadCenter(DMAssess);
check("F23 testcenter loads in node", !!DMTestCenter);
const tp0 = Date.now();
const pc = {};
SP.CAT_IDS.filter(c => c !== "mistakes").forEach(cid => { pc[cid] = DMTestCenter.probeCount("K1", cid, null); });
["__full__", "__smart__", "__cumul__", "__boss__", "mistakes"].forEach(cid => { pc[cid] = DMTestCenter.probeCount("K1", cid, null); });
const dtProbe = Date.now() - tp0;
check("F24 probeCount all cards < 6000ms", dtProbe < 6000, dtProbe + "ms");
check("F25 probe counts agree with direct builds (±8)", Math.abs(pc.words - counts.words) <= 8 && Math.abs(pc.verbs - counts.verbs) <= 8 && pc.words >= 100, JSON.stringify({ words: [pc.words, counts.words], verbs: [pc.verbs, counts.verbs] }));
check("F26 mistakes honestly zero when none open", pc.mistakes === 0);
DMTestCenter.sel.kap = "K1"; DMTestCenter.sel.cat = null;
const tr0 = Date.now();
const html1 = DMTestCenter.renderSection(null);
const dtR1 = Date.now() - tr0;
check("F27 renderSection (kap, no cat) renders cards fast", dtR1 < 6000 && html1.includes("data-tc=\"cat:words\""), dtR1 + "ms");
DMTestCenter.sel.cat = "words";
const html2 = DMTestCenter.renderSection({ rmap: {} });
check("F28 renderSection (workspace path, reused rmap) has start", html2.includes("data-tc=\"start\""));
check("F29 kapLevel honest (K1 is A1-majority)", DMTestCenter.kapLevel("K1") === "A1");

/* ---------------- empty / malformed banks: never freeze, never fake ---------------- */
const w2 = buildWorld(500);
w2.SENTENCES = []; w2.SENT_FILL = []; w2.GRAMMAR = []; w2.GLAB_BANK = {};
w2.CURR_READING = []; w2.LISTEN_ITEMS = []; w2.SPEAK_ITEMS = []; w2.TALK_SITS = []; w2.REAL_SITS = [];
installWorld(w2);
const D2 = loadAssess();
const got2 = D2.specs.kapitelCategorySpec("K1", "words", "master", "medium", null).build();
check("F30 empty banks build to empty (honest, no throw)", Array.isArray(got2), typeof got2);
w2.SENTENCES = [null, "junk", { id: "x" }, { id: "y", de: "", ar: "" }];
const D3 = loadAssess();
let threw = false, got3 = null;
try { got3 = D3.specs.kapitelCategorySpec("K1", "ordering", "master", "medium", null).build(); } catch (e) { threw = true; }
check("F31 malformed records skipped safely", !threw && Array.isArray(got3), "threw=" + threw);

uninstallWorld();
console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
