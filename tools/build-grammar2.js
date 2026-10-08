/* Stage 3b — grammar micro-unit expansion (deterministic, quality-gated).
   Generates meaningful teachable units (prefix verbs, verb-prepositions, cases,
   mistakes, paradigms, connectors, transformations, registers...) with IDs lgSSNNN,
   validates with the Quality Gate, appends to clib/.cache/grammar.json.
   Run: node tools/build-grammar2.js   (after stage 1+2; rerun-safe via checkpoint)
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { rng, pick, shuffle, normDE } = require("./clib/util");
const { STEMS } = require("./clib/sentgen");
const BIGS = require("./clib/bigsen");
const G1 = require("./clib/biggram1");
const G2 = require("./clib/biggram2");
const G3 = require("./clib/biggram3");
const { VPREP } = require("./clib/more");
const gate = require("./content-quality-gate");

Object.assign(STEMS, BIGS.BIGSTEMS);
const cache = path.join(__dirname, "clib", ".cache");
const vocab = JSON.parse(fs.readFileSync(path.join(cache, "vocab.json"), "utf8"));
const grammar = JSON.parse(fs.readFileSync(path.join(cache, "grammar.json"), "utf8"));
const rejected = JSON.parse(fs.readFileSync(path.join(cache, "rejected.json"), "utf8"));
function rej(id, reason) { rejected.push({ id, reason }); }

const rr = rng("grammar2-v1");
const pickN = (arr) => arr[Math.floor(rr() * arr.length)];
const nouns = vocab.filter((w) => w.type === "noun" && ["der", "die", "das"].indexOf(w.art) >= 0);
const verbs = vocab.filter((w) => w.type === "verb");
const adjs = vocab.filter((w) => w.type === "adj");
const nounByDe = new Map();
nouns.forEach((w) => { if (!nounByDe.has(normDE(w.de))) nounByDe.set(normDE(w.de), w); });

/* ---------- mini conjugation/declension (sentence-tested rules) ---------- */
const SEPPREF = ["zurück", "zusammen", "vorbei", "weiter", "herunter", "wieder", "voll", "fern", "statt", "teil", "heim", "raus", "rein", "runter", "rauf", "los", "fest", "ab", "an", "auf", "aus", "bei", "ein", "mit", "nach", "vor", "zu", "weg"];
function splitSep(inf) {
  const low = inf.toLowerCase();
  for (const p of SEPPREF) if (low.startsWith(p) && low.length > p.length + 2) return { stem: inf.slice(p.length), pref: inf.slice(0, p.length) };
  return null;
}
const MODALS = { "können": ["kann", "kannst", "kann"], "müssen": ["muss", "musst", "muss"], "dürfen": ["darf", "darfst", "darf"], "sollen": ["soll", "sollst", "soll"], "wollen": ["will", "willst", "will"], "möchten": ["möchte", "möchtest", "möchte"] };
function conjCore(inf, person) {
  if (inf === "sein") return { ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind" }[person];
  if (inf === "haben") return { ich: "habe", du: "hast", er: "hat", wir: "haben", ihr: "habt", sie: "haben" }[person];
  if (inf === "werden") return { ich: "werde", du: "wirst", er: "wird", wir: "werden", ihr: "werdet", sie: "werden" }[person];
  if (inf === "wissen") return { ich: "weiß", du: "weißt", er: "weiß", wir: "wissen", ihr: "wisst", sie: "wissen" }[person];
  if (MODALS[inf]) { const m = MODALS[inf]; return { ich: m[0], du: m[1], er: m[2], wir: inf, ihr: inf + "t", sie: inf }[person]; }
  const stem = inf.replace(/en$/, "");
  const eln = /(el|er)n$/.test(inf) || /(ch|[bcdfgjkpqtvwxzß])[mn]en$/.test(inf);
  if (eln) {
    const full = inf.slice(0, -1), short = full.replace(/e([lr])$/, "$1");
    if (person === "ich") return short === full ? full : short + "e";
    if (person === "du") return full + "st";
    if (person === "er") return full + "t";
    if (person === "wir" || person === "sie") return inf;
    return full + "t";
  }
  if ((person === "du" || person === "er") && STEMS[inf]) return STEMS[inf][person === "du" ? 0 : 1];
  const td = /[td]$/.test(stem), sib = /[sßzx]$/.test(stem);
  if (person === "ich") return stem + "e";
  if (person === "du") return stem + (td ? "est" : sib ? "t" : "st");
  if (person === "er") return stem + (td ? "et" : "t");
  if (person === "wir" || person === "sie") return inf;
  return stem + (td ? "et" : "t");
}
function conjPresent(inf, cperson) {
  const sp = splitSep(inf.replace(/^sich /, ""));
  if (sp) return { core: conjCore(sp.stem, cperson), tail: " " + sp.pref };
  return { core: conjCore(inf.replace(/^sich /, ""), cperson), tail: "" };
}
function declArt(art, kase, plural) {
  if (plural) return kase === "N" ? "die" : kase === "A" ? "die" : kase === "D" ? "den" : "der";
  switch (art) {
    case "der": return kase === "N" ? "der" : kase === "A" ? "den" : kase === "D" ? "dem" : "des";
    case "die": return kase === "N" ? "die" : kase === "A" ? "die" : kase === "D" ? "der" : "der";
    case "das": return kase === "N" ? "das" : kase === "A" ? "das" : kase === "D" ? "dem" : "des";
    default: return art;
  }
}
function arVerb(base, cperson, fem) {
  const stem = base.replace(/^ي/, "");
  if (cperson === "ich") return "أ" + stem;
  if (cperson === "wir") return "ن" + stem;
  if (cperson === "du" || cperson === "ihr") return "ت" + stem + (cperson === "ihr" ? "ون" : "");
  if (cperson === "sie") return "ت" + stem;
  return (fem ? "ت" + stem : "ي" + stem);
}
function genNoun(w) {
  if (w.art === "die") return { de: "der " + w.de, ar: w.ar };
  const suf = /[sßxz]$|sch$|ch$/.test(w.de) ? "es" : "s";
  return { de: "des " + w.de + suf, ar: w.ar };
}
/* example subjects: [de, ar, person, fem] */
const ESUBJ = [["Ich", "أنا", "ich", false], ["Er", "هو", "er", false], ["Sie", "هي", "sie", true]];
function conjEx(inf, subj) {
  const c = conjPresent(inf, subj[2]);
  return (c.core + c.tail).trim();
}
function arEx(base, subj) { return arVerb(base, subj[2], subj[3]); }

/* ---------- unit assembly ---------- */
const units = [];
const seqBySeries = {};
const haveIds = new Set(grammar.map((g) => g.id));
function nid(series) {
  seqBySeries[series] = (seqBySeries[series] || 0) + 1;
  return "lg" + series + String(seqBySeries[series]).padStart(3, "0");
}
function kapFor(level, i) { return level === "A1" ? "K" + (1 + (i % 5)) : "KX"; }
function quizRot(seq, q, correct, distract, explain) {
  const slot = seq % 3;
  const opts = [null, null, null];
  opts[slot] = correct;
  let j = 0;
  for (let i = 0; i < 3; i++) if (opts[i] === null) opts[i] = distract[j++];
  return { q, opts, correct: slot, explain };
}
function push(u) {
  if (!u.id) return;
  if (haveIds.has(u.id)) return; // rerun-safe: already in grammar.json
  if (units.some((x) => x.id === u.id)) { rej(u.id, "grammar2: duplicate id"); return; }
  units.push(u);
}
function nounOf(art, cat) {
  const pool = nouns.filter((w) => w.art === art && (!cat || w.cat === cat) && w.de.length <= 12 && !/\s/.test(String(w.ar).split("/")[0]));
  return pool.length ? pool[Math.floor(rr() * pool.length)] : nouns[Math.floor(rr() * nouns.length)];
}

/* ---------- 51: prefix verbs (separable/inseparable behavior) ---------- */
(function () {
  const pvs = verbs.filter((w) => w.sep && !/^sich /.test(w.de) && w.parts && w.parts.indexOf(",") >= 0);
  pvs.forEach((w, ix) => {
    const id = nid("51");
    const o1 = nounOf("der"), o2 = nounOf("die");
    const cEr = conjPresent(w.de, "er");
    const de1 = "Er " + cEr.core + " " + declArt(o1.art, "A", false) + " " + o1.de + cEr.tail + ".";
    const ar1 = "هو " + w.ar + " " + o1.ar + ".";
    const de2 = "Sie " + conjPresent(w.de, "sie").core + " " + declArt(o2.art, "A", false) + " " + o2.de + conjPresent(w.de, "sie").tail + ".";
    const ar2 = "هي " + w.ar + " " + o2.ar + ".";
    const body = "【القاعدة】 الفعل " + w.de + " فعل منفصل: البادئة تذهب إلى آخر الجملة في الزمن الحاضر. 【التصريف】 er " + cEr.core + cEr.tail + ". 【الماضي】 " + w.parts + ". 【مثال】 " + de1 + " = " + ar1 + " 【خطأ شائع】 لا تضع البادئة بجانب الفعل في جملة عادية. 【تلميح】 في المصدر والتصريف الماضي تبقى الكلمة واحدة.";
    push({
      id, title: "الأفعال المنفصلة: " + w.de, deTitle: "Trennbare Verben: " + w.de,
      kap: kapFor(w.level, ix), level: w.level, cat: "verben", topicId: "g51", unit: ix + 1, kind: "classify",
      body, examples: [[de1, ar1], [de2, ar2]],
      mistakes: [{ w: "Er " + cEr.core + cEr.tail + " " + declArt(o1.art, "A", false) + " " + o1.de + ".", r: de1, why: "البادئة المنفصلة تأتي في آخر الجملة." }],
      related: [],
      quiz: quizRot(ix, "أين تقف البادئة في جملة " + w.de + "؟", "في آخر الجملة", ["بجانب الفعل", "في أول الجملة"], "البادئة المنفصلة تذهب آخرًا."),
    });
  });
})();
/* ---------- 52: verb + preposition units ---------- */
(function () {
  const PREPS = ["auf", "an", "über", "um", "für", "in", "zu", "von", "aus", "mit", "bei", "nach", "vor", "gegen", "durch", "ohne"];
  const prepNoun = { auf: "Bus", an: "Urlaub", über: "Film", um: "Geld", für: "Familie", in: "Liebe", zu: "Arzt", von: "Urlaub", aus: "Glas", mit: "Bus", bei: "Arzt", nach: "Plan", vor: "Hund", gegen: "Plan", durch: "Stadt", ohne: "Geld" };
  const rows = [];
  VPREP.forEach((r) => {
    const p = r.split("|");
    const ip = p[0].split(" ");
    rows.push([ip.slice(0, -1).join(" "), ip[ip.length - 1], G1.VPREP_CASES[p[0]] || "A", p[1]]);
  });
  G1.BIGVPREP.forEach(([inf, prep, kase, ar]) => rows.push([inf, prep, kase, ar]));
  const seenVP = new Set();
  rows.forEach(([inf, prep, kase, ar], ix) => {
    const key = inf + " " + prep;
    if (seenVP.has(key)) return;
    seenVP.add(key);
    const id = nid("52");
    const w0 = verbs.find((v) => v.de.replace(/^sich /, "") === inf.replace(/^sich /, ""));
    const lvl = (w0 && w0.level) || "A2";
    const isRefl = /^sich /.test(inf);
    const o1 = nounByDe.get(normDE(prepNoun[prep] || "Bus")) || nouns[0];
    const o2 = nounByDe.get(normDE(prep === "auf" ? "Zug" : "Brief")) || nouns[1];
    const mk = (subj, o) => {
      const vc = conjPresent(w0 ? w0.de : inf, subj[2]);
      const pron = isRefl ? (subj[2] === "ich" ? "mich " : "sich ") : "";
      const art = kase === "A" ? declArt(o.art, "A", false) : declArt(o.art, "D", false);
      return subj[0] + " " + vc.core + " " + pron + prep + " " + art + " " + o.de + vc.tail + ".";
    };
    const de1 = mk(ESUBJ[1], o1), de2 = mk(ESUBJ[2], o2);
    const ar1 = "هو " + ar + " " + o1.ar + ".", ar2 = "هي " + ar + " " + o2.ar + ".";
    const body = "【القاعدة】 الفعل " + inf + " يأتي دائمًا مع حرف الجر " + prep + " ويأخذ " + (kase === "A" ? "الأكوزاتيف" : "الداتيف") + ". 【المعنى】 " + ar + ". 【مثال】 " + de1 + " = " + ar1 + " 【خطأ شائع】 لا تستخدم حرف جر آخر مع هذا الفعل. 【تلميح】 احفظ الفعل مع حرفه كوحدة واحدة.";
    const others = shuffle(rr, PREPS.filter((x) => x !== prep)).slice(0, 2);
    push({
      id, title: "الفعل مع حرف الجر: " + inf + " + " + prep, deTitle: "Verb + Präposition: " + inf + " + " + prep,
      kap: kapFor(lvl, ix), level: lvl, cat: "verben", topicId: "g52", unit: ix + 1, kind: "classify",
      body, examples: [[de1, ar1], [de2, ar2]],
      mistakes: [{ w: "Er " + inf + " den Bus.", r: de1, why: "الفعل " + inf + " يحتاج حرف الجر " + prep + "." }],
      related: [], quiz: quizRot(ix, "Welche Präposition passt zu " + inf + "؟", prep, others, "الفعل " + inf + " يأتي مع " + prep + "."),
    });
  });
})();
(function () {
  /* inseparable prefix verbs */
  const insep = verbs.filter((w) => w.sep === false && !/^sich /.test(w.de) && w.parts && w.parts.indexOf(",") >= 0 && /^(be|ver|er|ent|emp|miss|zer|ge|über|unter|um|durch|wider|hinter)(.+)/.test(w.de.replace(/^sich /, "")));
  insep.forEach((w, ix) => {
    const id = nid("51");
    const cEr = conjPresent(w.de, "er");
    const cSie = conjPresent(w.de, "sie");
    const o1 = nounOf("der"), o2 = nounOf("die");
    const de1 = "Er " + cEr.core + " " + declArt(o1.art, "A", false) + " " + o1.de + ".";
    const ar1 = "هو " + w.ar + " " + o1.ar + ".";
    const de2 = "Sie " + cSie.core + " " + declArt(o2.art, "A", false) + " " + o2.de + ".";
    const ar2 = "هي " + w.ar + " " + o2.ar + ".";
    const body = "【القاعدة】 الفعل " + w.de + " فعل غير منفصل: البادئة تبقى ملتصقة دائمًا ولا تأخذ ge في التصريف. 【التصريف】 er " + cEr.core + ". 【الماضي】 " + w.parts + ". 【مثال】 " + de1 + " = " + ar1 + " 【خطأ شائع】 لا تفصل البادئة ولا تضف ge زائدة. 【تلميح】 البادئات be ver er ent emp miss zer ge لا تنفصل أبدًا.";
    push({
      id, title: "الأفعال غير المنفصلة: " + w.de, deTitle: "Untrennbare Verben: " + w.de,
      kap: kapFor("B1", ix), level: "B1", cat: "verben", topicId: "g51", unit: 500 + ix + 1, kind: "classify",
      body, examples: [[de1, ar1], [de2, ar2]],
      mistakes: [{ w: "Er ruft ge" + w.de + " an.", r: de1, why: "الفعل غير المنفصل لا ينقسم." }],
      related: [],
      quiz: quizRot(ix, "هل تنفصل بادئة " + w.de + "؟", "لا تنفصل أبدًا", ["نعم تنفصل", "أحيانًا"], "البادئات غير المنفصلة تلتصق دائمًا."),
    });
  });
})();

/* ---------- 53: dative verbs ---------- */
(function () {
  const seen = new Set();
  G1.DATVERBS.forEach(([inf, ar], ix) => {
    if (seen.has(inf)) return;
    seen.add(inf);
    const id = nid("53");
    const per = (function () { const w = nounOf("die"); return { de: declArt(w.art, "D", false) + " " + w.de, ar: w.ar, w }; })();
    const vc = conjPresent(inf, "er");
    const de1 = "Er " + vc.core + " " + per.de + ".";
    const ar1 = "هو " + arVerb(ar, "er", false, null) + " " + per.ar + ".";
    const vc2 = conjPresent(inf, "sie");
    const per2 = (function () { const w = nounOf("der"); return { de: declArt(w.art, "D", false) + " " + w.de, ar: w.ar, w }; })();
    const de2 = "Sie " + vc2.core + " " + per2.de + ".";
    const ar2 = "هي " + arVerb(ar, "sie", true, null) + " " + per2.ar + ".";
    const deWrong = "Er " + vc.core + " " + declArt(per.w.art, "A", false) + " " + per.w.de + ".";
    const body = "【القاعدة】 الفعل " + inf + " يأخذ مفعولًا داتيفًا (لشخص). 【المعنى】 " + ar + ". 【مثال】 " + de1 + " = " + ar1 + " 【خطأ شائع】 لا تستخدم الأكوزاتيف مع هذا الفعل. 【تلميح】 احفظ: " + inf + " + Dativ.";
    push({
      id, title: "أفعال الداتيف: " + inf, deTitle: "Dativ-Verben: " + inf,
      kap: kapFor("A2", ix), level: "A2", cat: "verben", topicId: "g53", unit: ix + 1, kind: "contrast",
      body, examples: [[de1, ar1], [de2, ar2]],
      mistakes: [{ w: deWrong, r: de1, why: "الفعل " + inf + " يحتاج داتيفًا لا أكوزاتيفًا." }],
      related: [], quiz: quizRot(ix, "أي جملة صحيحة؟", de1, [deWrong, "Er " + per.w.de + "."], "الداتيف مع " + inf + "."),
    });
  });
})();

/* ---------- 54: ditransitive verbs ---------- */
(function () {
  const seen = new Set();
  G1.DITRANVERBS.forEach(([inf, ar], ix) => {
    if (seen.has(inf)) return;
    seen.add(inf);
    const id = nid("54");
    const per = (function () { const w = nounOf("die"); return { de: declArt(w.art, "D", false) + " " + w.de, ar: w.ar, w }; })();
    const opool = nouns.filter((w) => ["family", "people", "relationships", "jobs", "profi"].indexOf(w.cat) < 0 && w.de.length <= 12);
    const o = opool.length ? opool[Math.floor(rr() * opool.length)] : nounOf("der");
    const vc = conjPresent(inf, "er");
    const ode = declArt(o.art, "A", false) + " " + o.de;
    const de1 = "Er " + vc.core + " " + per.de + " " + ode + ".";
    const ar1 = "هو " + arVerb(ar, "er", false, null) + " " + per.ar + " " + o.ar + ".";
    const vc2 = conjPresent(inf, "sie");
    const per2 = (function () { const w = nounOf("der"); return { de: declArt(w.art, "D", false) + " " + w.de, ar: w.ar, w }; })();
    const o2 = opool.length ? opool[Math.floor(rr() * opool.length)] : nounOf("die");
    const ode2 = declArt(o2.art, "A", false) + " " + o2.de;
    const de2 = "Sie " + vc2.core + " " + per2.de + " " + ode2 + ".";
    const ar2 = "هي " + arVerb(ar, "sie", true, null) + " " + per2.ar + " " + o2.ar + ".";
    const deWrong = "Er " + vc.core + " " + declArt(per.w.art, "A", false) + " " + per.w.de + " " + ode + ".";
    const body = "【القاعدة】 الفعل " + inf + " يأخذ مفعولين: شخص بالداتيف وشيء بالأكوزاتيف. 【المعنى】 " + ar + ". 【مثال】 " + de1 + " = " + ar1 + " 【خطأ شائع】 الشخص دائمًا داتيف. 【تلميح】 الترتيب: فعل + شخص + شيء.";
    push({
      id, title: "أفعال المفعولين: " + inf, deTitle: "Verben mit zwei Objekten: " + inf,
      kap: kapFor("A2", ix), level: "A2", cat: "verben", topicId: "g54", unit: ix + 1, kind: "contrast",
      body, examples: [[de1, ar1], [de2, ar2]],
      mistakes: [{ w: deWrong, r: de1, why: "الشخص بالداتيف مع " + inf + "." }],
      related: [], quiz: quizRot(ix, "أي جملة صحيحة؟", de1, [deWrong, "Er " + ode + "."], "الشخص داتيف والشيء أكوزاتيف."),
    });
  });
})();

/* ---------- 55: reflexive verbs ---------- */
(function () {
  G1.REFLVERBS.forEach(([inf, ar], ix) => {
    const id = nid("55");
    const base = inf.replace(/^sich /, "");
    const cEr = conjPresent(base, "er"), cIch = conjPresent(base, "ich");
    const de1 = "Er " + cEr.core + " sich" + cEr.tail + ".";
    const ar1 = "هو " + arVerb(ar, "er", false, null) + " نفسه.";
    const de2 = "Ich " + cIch.core + " mich" + cIch.tail + ".";
    const ar2 = "أنا " + arVerb(ar, "ich", false, null) + " نفسي.";
    const deWrong = "Er " + cEr.core + cEr.tail + ".";
    const body = "【القاعدة】 الفعل " + inf + " فعل منعكس: يحتاج الضمير المنعكس sich. 【المعنى】 " + ar + ". 【مثال】 " + de1 + " = " + ar1 + " 【خطأ شائع】 لا تنس الضمير المنعكس. 【تلميح】 الضمير يتغير مع الفاعل: mich dich sich uns euch sich.";
    push({
      id, title: "الأفعال المنعكسة: " + inf, deTitle: "Reflexive Verben: " + inf,
      kap: kapFor("A2", ix), level: "A2", cat: "verben", topicId: "g55", unit: ix + 1, kind: "contrast",
      body, examples: [[de1, ar1], [de2, ar2]],
      mistakes: [{ w: deWrong, r: de1, why: "الفعل " + inf + " يحتاج sich." }],
      related: [], quiz: quizRot(ix, "أي جملة صحيحة؟", de1, [deWrong, "Er " + base + "."], "الضمير المنعكس إجباري."),
    });
  });
})();

/* ---------- 56: base-verb spotlights (conjugation + valency + prep-link) ---------- */
(function () {
  const VP_AR = {};
  VPREP.forEach((r) => {
    const p = r.split("|");
    const ip = p[0].split(" ");
    const im = ip.slice(0, -1).join(" ");
    if (!VP_AR[im]) VP_AR[im] = [];
    VP_AR[im].push(ip[ip.length - 1]);
  });
  G1.BIGVPREP.forEach(([inf, prep]) => {
    if (!VP_AR[inf]) VP_AR[inf] = [];
    if (VP_AR[inf].indexOf(prep) < 0) VP_AR[inf].push(prep);
  });
  const spots = verbs.filter((w) => !/^sich /.test(w.de) && w.parts && w.parts.indexOf(",") >= 0);
  spots.forEach((w, ix) => {
    const id = nid("56");
    const irr = w.reg === "irr";
    const cEr = conjPresent(w.de, "er"), cIch = conjPresent(w.de, "ich");
    const note = irr ? "فعل شاذ: er " + cEr.core + cEr.tail + " والماضي " + w.parts + "." : "فعل منتظم على النمط القياسي.";
    const preps = VP_AR[w.de] || VP_AR[w.de.replace(/^(be|ver|er|ent|emp|miss|zer|ge)/, "")] || [];
    const o = nounOf("der");
    const de1 = "Er " + cEr.core + " " + declArt(o.art, "A", false) + " " + o.de + cEr.tail + ".";
    const ar1 = "هو " + w.ar + " " + o.ar + ".";
    const o2 = nounOf("die");
    const de2 = "Ich " + cIch.core + " " + declArt(o2.art, "A", false) + " " + o2.de + cIch.tail + ".";
    const ar2 = "أنا " + w.ar + " " + o2.ar + ".";
    const deWrong = "Er " + o.de + " " + cEr.core + cEr.tail + ".";
    const body = "【الفعل】 " + w.de + " (" + w.ar + "). 【التصريف】 " + note + " 【مثال】 " + de1 + " = " + ar1 + (preps.length ? " 【حرف الجر】 يأتي مع: " + preps.join("، ") + "." : "") + " 【خطأ شائع】 الفعل المصرف يأتي ثانيًا دائمًا. 【تلميح】 احفظ الماضي مع المصدر.";
    push({
      id, title: "بطاقة الفعل: " + w.de, deTitle: "Verb-Steckbrief: " + w.de,
      kap: kapFor(w.level, ix), level: w.level, cat: "verben", topicId: "g56", unit: ix + 1, kind: "classify",
      body, examples: [[de1, ar1], [de2, ar2]],
      mistakes: [{ w: deWrong, r: de1, why: "الفعل ثانيًا لا ثالثًا." }],
      related: [], quiz: quizRot(ix, "أي جملة صحيحة؟", de1, [deWrong, "Er " + w.de + "."], "ترتيب الجملة الصحيح."),
    });
  });
})();

/* ---------- 57: mistake contrasts ---------- */
(function () {
  G1.MISTAKES.forEach(([wrong, right, rule, lvl], ix) => {
    const ar = G1.MISTAKE_AR[right];
    if (!ar) { rej("lg57" + ix, "grammar2: mistake without Arabic, skipped"); return; }
    const id = nid("57");
    const body = "【خطأ شائع】 لا تقل «" + wrong + "» بل قل «" + right + "». 【القاعدة】 " + rule + " 【مثال صحيح】 " + right + " = " + ar + " 【تلميح】 راجع القاعدة المرتبطة ثم أعد المحاولة.";
    push({
      id, title: "خطأ شائع: " + right.slice(0, 40), deTitle: "Häufiger Fehler",
      kap: kapFor(lvl, ix), level: lvl, cat: "fehler", topicId: "g57", unit: ix + 1, kind: "contrast",
      body, examples: [[right, ar], [wrong, "⚠ " + ar]],
      mistakes: [{ w: wrong, r: right, why: rule }],
      related: [], quiz: quizRot(ix, "أي جملة صحيحة؟", right, [wrong, "كلتاهما صحيحتان"], rule),
    });
  });
})();

/* ---------- 58: declension cells ---------- */
(function () {
  const END = {
    def: { N: ["der", "die", "das", "die"], A: ["den", "die", "das", "die"], D: ["dem", "der", "dem", "den"], G: ["des", "der", "des", "der"] },
    indef: { N: ["ein", "eine", "ein", null], A: ["einen", "eine", "ein", null], D: ["einem", "einer", "einem", null], G: ["eines", "einer", "eines", null] },
    kein: { N: ["kein", "keine", "kein", "keine"], A: ["keinen", "keine", "kein", "keine"], D: ["keinem", "keiner", "keinem", "keinen"], G: ["keines", "keiner", "keines", "keiner"] },
    mein: { N: ["mein", "meine", "mein", "meine"], A: ["meinen", "meine", "mein", "meine"], D: ["meinem", "meiner", "meinem", "meinen"], G: ["meines", "meiner", "meines", "meiner"] },
    dieser: { N: ["dieser", "diese", "dieses", "diese"], A: ["diesen", "diese", "dieses", "diese"], D: ["diesem", "dieser", "diesem", "diesen"], G: ["dieses", "dieser", "dieses", "dieser"] },
  };
  const CN = { der: "المذكر", die: "المؤنث", das: "المحايد", pl: "الجمع" };
  const KN = { N: "الرفع", A: "النصب", D: "الجر (داتيف)", G: "الإضافة" };
  const arts = ["der", "die", "das", "pl"];
  const VBYK = { N: ["ist", "يكون"], A: ["sieht", "يرى"], D: ["hilft", "يساعد"], G: ["trotz", "رغم"] };
  ["def", "indef", "kein", "mein", "dieser"].forEach((series) => {
    ["N", "A", "D", "G"].forEach((kase) => {
      arts.forEach((art, gi) => {
        const form = END[series][kase][gi];
        if (!form) return;
        const id = nid("58");
        const lvl = kase === "G" || series === "dieser" ? "B1" : kase === "D" ? "A2" : "A1";
        const o = art === "pl" ? nounOf("der") : nounOf(art);
        let de1, ar1, de2, ar2;
        if (kase === "G") {
          const g1 = art === "pl" ? { de: "der " + (o.plural === "-" ? o.de : o.plural.replace(/^(der|die|das)\s/, "")), ar: o.ar } : genNoun(art === "pl" ? o : Object.assign({}, o, { art }));
          const g2o = art === "pl" ? nounOf("die") : nounOf(art);
          const g2 = art === "pl" ? { de: "der " + (g2o.plural === "-" ? g2o.de : g2o.plural.replace(/^(der|die|das)\s/, "")), ar: g2o.ar } : genNoun(g2o);
          de1 = "Er lernt trotz " + g1.de + ".";
          ar1 = "هو يتعلم رغم " + g1.ar + ".";
          de2 = "Sie bleibt wegen " + g2.de + " zu Hause.";
          ar2 = "هي تبقى بسبب " + g2.ar + " في البيت.";
        } else {
          const v = VBYK[kase][0], va = VBYK[kase][1];
          const ph1 = form + " " + o.de;
          de1 = "Er " + (kase === "N" ? "ist" : v) + " " + ph1 + ".";
          ar1 = "هو " + (kase === "N" ? "يكون" : va) + " " + o.ar + ".";
          const o2 = art === "pl" ? nounOf("die") : nounOf(art);
          const ph2 = form + " " + o2.de;
          de2 = "Sie " + (kase === "N" ? "ist" : v) + " " + ph2 + ".";
          ar2 = "هي " + (kase === "N" ? "تكون" : va) + " " + o2.ar + ".";
        }
        const body = "【القاعدة】 أداة " + series + " في حالة " + KN[kase] + " مع " + CN[art] + " هي «" + form + "». 【مثال】 " + de1 + " = " + ar1 + " 【خطأ شائع】 لا تخلط بين نهايات الحالات. 【تلميح】 احفظ الجدول كاملًا لا الخلية وحدها.";
        push({
          id, title: "التصريف: " + series + " + " + KN[kase] + " + " + CN[art], deTitle: "Deklination: " + series + " " + kase + " " + art,
          kap: kapFor(lvl, 0), level: lvl, cat: "kasus", topicId: "g58", unit: 1, kind: "classify",
          body, examples: [[de1, ar1], [de2, ar2]],
          mistakes: [{ w: de1.replace(form + " ", "der "), r: de1, why: "الصيغة الصحيحة هنا «" + form + "»." }],
          related: [], quiz: quizRot(0, "ما الصيغة الصحيحة؟", form, ["der", "die"], "أداة " + series + " في " + KN[kase] + "."),
        });
      });
    });
  });
})();

/* ---------- 59: pronoun tables ---------- */
(function () {
  const TABLES = [
    ["الضمائر الشخصية (رفع)", "A1", [["ich", "أنا"], ["du", "أنت"], ["er", "هو"], ["sie", "هي"], ["es", "هو/هي"], ["wir", "نحن"], ["ihr", "أنتم"], ["sie", "هم"], ["Sie", "حضرتك"]]],
    ["الضمائر الشخصية (نصب)", "A1", [["mich", "ني"], ["dich", "ك"], ["ihn", "ه"], ["sie", "ها"], ["es", "ه"], ["uns", "نا"], ["euch", "كم"], ["sie", "هم"], ["Sie", "حضرتك"]]],
    ["الضمائر الشخصية (جر)", "A2", [["mir", "لي"], ["dir", "لك"], ["ihm", "له"], ["ihr", "لها"], ["ihm", "له"], ["uns", "لنا"], ["euch", "لكم"], ["ihnen", "لهم"], ["Ihnen", "لكم"]]],
    ["الضمائر المنعكسة", "A2", [["mich", "نفسي"], ["dich", "نفسك"], ["sich", "نفسه"], ["sich", "نفسها"], ["sich", "نفسه"], ["uns", "أنفسنا"], ["euch", "أنفسكم"], ["sich", "أنفسهم"], ["sich", "نفسكم"]]],
    ["ضمائر الملكية", "A2", [["mein", "لي"], ["dein", "لك"], ["sein", "له"], ["ihr", "لها"], ["sein", "له"], ["unser", "لنا"], ["euer", "لكم"], ["ihr", "لهم"], ["Ihr", "لكم"]]],
    ["ضمائر الإشارة", "A2", [["dieser", "هذا"], ["diese", "هذه"], ["dieses", "هذا"], ["jene", "تلك"], ["solcher", "مثل هذا"], ["derjenige", "الذي"], ["dieselben", "نفس"], ["jede", "كل"]]],
    ["ضمائر الاستفهام", "A1", [["wer", "من"], ["wen", "من"], ["wem", "لمن"], ["wessen", "لمن"], ["was", "ماذا"], ["welcher", "أي"], ["was für", "أي نوع"]]],
  ];
  TABLES.forEach(([title, lvl, rows], ix) => {
    const id = nid("59");
    const ex = rows.slice(0, 2).map(([d, a]) => ["Beispiel: " + d + ".", "مثال: " + a + "."]);
    const body = "【القاعدة】 جدول " + title + ": " + rows.map(([d, a]) => d + " = " + a).join("، ") + ". 【مثال】 " + ex[0][0] + " 【خطأ شائع】 لا تخلط بين حالات الضمائر. 【تلميح】 احفظ الجدول كاملًا.";
    push({
      id, title: "جدول: " + title, deTitle: "Pronomen-Tabelle",
      kap: kapFor(lvl, ix), level: lvl, cat: "pronomen", topicId: "g59", unit: ix + 1, kind: "classify",
      body, examples: ex,
      mistakes: [{ w: "Beispiel falsch.", r: ex[0][0], why: "راجع الجدول." }],
      related: [], quiz: quizRot(ix, "أي ضمير صحيح؟", rows[0][0], [rows[1][0], "keins"], title + "."),
    });
  });
})();

/* ---------- 60: sentence-transformation families (statement/question/negation/command) ---------- */
(function () {
  const TIMPV = {};
  BIGS.BIGIMPV.forEach(([inf, imp, ar]) => { TIMPV[inf] = [imp, ar]; });
  const statIMPV = [["trinken", "Trink", "اشرب"], ["kommen", "Komm", "تعال"], ["gehen", "Geh", "اذهب"], ["essen", "Iss", "كُل"], ["nehmen", "Nimm", "خُذ"], ["machen", "Mach", "افعل"], ["lesen", "Lies", "اقرأ"], ["schreiben", "Schreib", "اكتب"], ["öffnen", "Öffne", "افتح"], ["schließen", "Schließ", "أغلق"], ["warten", "Warte", "انتظر"], ["hören", "Hör", "اسمع"], ["schauen", "Schau", "انظر"], ["helfen", "Hilf", "ساعد"], ["bleiben", "Bleib", "ابقَ"], ["geben", "Gib", "أعطِ"], ["sehen", "Sieh", "انظر"], ["sprechen", "Sprich", "تحدث"], ["fragen", "Frag", "اسأل"], ["antworten", "Antworte", "أجب"], ["fahren", "Fahr", "سِر"], ["laufen", "Lauf", "اركض"], ["schlafen", "Schlaf", "نَم"], ["arbeiten", "Arbeite", "اعمل"], ["lernen", "Lerne", "تعلم"], ["üben", "Übe", "تدرب"], ["putzen", "Putze", "نظف"], ["kochen", "Koche", "اطبخ"], ["probieren", "Probiere", "جرب"]];
  statIMPV.forEach(([inf, imp, ar]) => { if (!TIMPV[inf]) TIMPV[inf] = [imp, ar]; });
  const OP = BIGS.OBJCATS;
  const tpool = (inf) => {
    const rule = OP[inf];
    if (!rule) return nouns.filter((w) => w.cat !== "germany");
    let pool = [];
    if (rule.cats) pool = pool.concat(nouns.filter((w) => rule.cats.indexOf(w.cat) >= 0));
    if (rule.allow) pool = pool.concat(nouns.filter((w) => rule.allow.indexOf(w.de) >= 0));
    if (rule.person) pool = pool.concat(nouns.filter((w) => ["family", "people", "relationships"].indexOf(w.cat) >= 0));
    if (rule.nopeople) pool = pool.filter((w) => ["family", "people", "relationships", "jobs", "profi"].indexOf(w.cat) < 0);
    const ded = [...new Map(pool.map((w) => [w.id, w])).values()];
    return ded.length ? ded : nouns;
  };
  Object.keys(TIMPV).forEach((inf, vix) => {
    const [imp] = TIMPV[inf];
    const pool = tpool(inf);
    for (let k = 0; k < 5; k++) {
      const o = pool[Math.floor(rr() * pool.length)];
      const id = nid("60");
      const S = ESUBJ[1 + (vix + k) % 2];
      const vc = conjPresent(inf, S[2]);
      const ode = declArt(o.art, "A", false) + " " + o.de;
      const st = S[0] + " " + vc.core + vc.tail + " " + ode + ".";
      const vArBase = (verbs.find((w) => w.de.replace(/^sich /, "") === inf) || { ar: "يفعل" }).ar;
      const varb = arVerb(vArBase, S[2], S[3]);
      const stA = S[1] + " " + varb + " " + o.ar + ".";
      const qc = conjPresent(inf, S[2]);
      const q = qc.core.charAt(0).toUpperCase() + qc.core.slice(1) + qc.tail + " " + (S[2] === "Sie" ? S[0] : S[0].charAt(0).toLowerCase() + S[0].slice(1)) + " " + ode + "?";
      const qA = "هل " + varb + " " + S[1] + " " + o.ar + "؟";
      const ng = S[0] + " " + vc.core + vc.tail + " " + ode + " nicht.";
      const cm = imp + " " + ode + "!";
      const body = "【العائلة】 الجملة «" + st + "» تتحول لأربعة أشكال. 【خبرية】 " + st + " 【استفهام】 " + q + " 【نفي】 " + ng + " 【أمر】 " + cm + " 【القاعدة】 الفعل ثانيًا في الخبرية، أولًا في السؤال والأمر، وnicht آخر النفي. 【تلميح】 تدرب على التحويل ذهنيًا.";
      push({
        id, title: "عائلة الجملة: " + inf + " + " + o.de, deTitle: "Satzfamilie: " + inf,
        kap: kapFor("A1", vix + k), level: "A1", cat: "syntax", topicId: "g60", unit: vix * 3 + k + 1, kind: "classify",
        body, examples: [[st, stA], [q, qA]],
        mistakes: [{ w: S[0] + " " + ode + " " + vc.core + vc.tail + ".", r: st, why: "الفعل ثانيًا لا ثالثًا." }],
        related: [], quiz: quizRot(vix + k, "أي جملة صحيحة؟", st, [S[0] + " " + ode + " " + vc.core + vc.tail + ".", imp + " " + S[0] + "."], "ترتيب الجملة الصحيح."),
      });
    }
  });
})();

/* ---------- generic hand-row driver ---------- */
function rowUnit(series, topicId, cat, lvl, ix, title, deTitle, body, ex1, ex2, wrong, quizQ, quizD, explain) {
  const id = nid(series);
  push({
    id, title, deTitle,
    kap: kapFor(lvl, ix), level: lvl, cat, topicId, unit: ix + 1, kind: wrong ? "contrast" : "classify",
    body, examples: [ex1, ex2],
    mistakes: wrong ? [{ w: wrong, r: ex1[0], why: explain }] : [{ w: "Beispiel falsch.", r: ex1[0], why: explain }],
    related: [], quiz: quizRot(ix, quizQ, ex1[0], quizD, explain),
  });
}

/* ---------- 61: connectors ---------- */
(function () {
  G2.CONN.forEach(([c, arM, type, exDe, exAr], ix) => {
    const lvl = type === "S" ? "B1" : "A2";
    const rule = type === "S" ? "جملة فرعية: الفعل في الآخر." : "جملة رئيسية: الفعل ثانيًا.";
    rowUnit("61", "g61", "konjunktion", lvl, ix,
      "الرابط: " + c, "Konnektor: " + c,
      "【القاعدة】 الرابط " + c + " بمعنى " + arM + ". " + rule + " 【مثال】 " + exDe + " = " + exAr + " 【خطأ شائع】 انتبه لموضع الفعل. 【تلميح】 احفظ كل رابط مع نوع جملته.",
      [exDe, exAr], [exDe, exAr], null,
      "ما نوع جملة " + c + "؟", [type === "S" ? "فرعية" : "رئيسية", type === "S" ? "رئيسية" : "فرعية"], rule);
  });
})();

/* ---------- 62: preposition + case ---------- */
(function () {
  G2.PREPCASE.forEach(([prep, kase, arM, e1de, e1ar, e2de, e2ar], ix) => {
    rowUnit("62", "g62", "praeposition", "A2", ix,
      "حرف الجر: " + prep + " + " + (kase === "A" ? "أكوزاتيف" : kase === "D" ? "داتيف" : "حسب الاتجاه"),
      "Präposition: " + prep,
      "【القاعدة】 حرف الجر " + prep + " بمعنى " + arM + " ويأخذ " + kase + ". 【مثال】 " + e1de + " = " + e1ar + " 【مثال آخر】 " + e2de + " = " + e2ar + " 【خطأ شائع】 لا تخلط بين الحالات. 【تلميح】 احفظ الحرف مع حالته.",
      [e1de, e1ar], [e2de, e2ar], null,
      "أي حالة يأخذها " + prep + "؟", [kase, kase === "A" ? "D" : "A"], "الحرف " + prep + " يأخذ " + kase + ".");
  });
})();

/* ---------- 63: two-way contrasts ---------- */
(function () {
  G2.TWOWAY.forEach(([prep, accDe, accAr, datDe, datAr], ix) => {
    rowUnit("63", "g63", "praeposition", "A2", ix,
      "الفرق: " + prep + " مع الحركة والموقع", "Wechselpräposition: " + prep,
      "【القاعدة】 مع الحركة والاتجاه نستخدم الأكوزاتيف: " + accDe + " = " + accAr + " ومع الموقع والسكون نستخدم الداتيف: " + datDe + " = " + datAr + " 【خطأ شائع】 الخلط بين wohin (أكوزاتيف) و wo (داتيف). 【تلميح】 اسأل: wohin أم wo؟",
      [accDe, accAr], [datDe, datAr], datDe.replace(/^Das|^Der|^Die/, "Den"),
      "أي جملة فيها حركة؟", [accDe, datDe], "الحركة تأخذ أكوزاتيفًا.");
  });
})();

/* ---------- 64: temporal ---------- */
(function () {
  G2.TEMPORAL.forEach(([prep, use, exDe, exAr], ix) => {
    rowUnit("64", "g64", "praeposition", "A1", ix,
      "الوقت: " + prep, "Temporal: " + prep,
      "【القاعدة】 " + prep + " للدلالة على " + use + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 احفظ عبارات الوقت جاهزة.",
      [exDe, exAr], [exDe, exAr], null,
      "ماذا تعني " + prep + "؟", [use, "المكان"], prep + " تدل على " + use + ".");
  });
})();

/* ---------- 65: modal meanings ---------- */
(function () {
  G2.MODALMEAN.forEach(([modal, meaning, exDe, exAr], ix) => {
    rowUnit("65", "g65", "verben", "A2", ix,
      "الفعل الناقص " + modal + ": " + meaning, "Modalverb: " + modal,
      "【القاعدة】 الفعل " + modal + " هنا بمعنى " + meaning + ". 【مثال】 " + exDe + " = " + exAr + " 【خطأ شائع】 المصدر يأتي في آخر الجملة. 【تلميح】 الأفعال الناقصة تغير المعنى حسب السياق.",
      [exDe, exAr], [exDe, exAr], null,
      "ما معنى " + modal + " هنا؟", [meaning, "الماضي"], modal + " بمعنى " + meaning + ".");
  });
})();

/* ---------- 66: tenses ---------- */
(function () {
  G2.TENSE.forEach(([tense, use, form, exDe, exAr], ix) => {
    const lvl = tense === "Präsens" ? "A1" : tense === "Perfekt" || tense === "Futur I" ? "A2" : "B1";
    rowUnit("66", "g66", "zeiten", lvl, ix,
      "الزمن: " + tense + " (" + use + ")", "Tempus: " + tense,
      "【القاعدة】 زمن " + tense + " يُستخدم لـ " + use + ". 【التكوين】 " + form + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 قارن الأزمنة ببعضها.",
      [exDe, exAr], [exDe, exAr], null,
      "متى نستخدم " + tense + "؟", [use, "للأمر"], tense + " لـ " + use + ".");
  });
})();

/* ---------- 67-71: negation/comparison/particles/questions/time ---------- */
(function () {
  G2.NEGATION.forEach(([p, r, ed, ea], ix) => rowUnit("67", "g67", "negation", "A2", ix, "النفي: " + p, "Negation", "【القاعدة】 " + r + ". 【مثال】 " + ed + " = " + ea + " 【تلميح】 موضع النفي يغير المعنى.", [ed, ea], [ed, ea], null, "ما معنى " + p + "؟", [r, "الإثبات"], r + "."));
  G2.COMPARISON.forEach(([p, r, ed, ea], ix) => rowUnit("68", "g68", "adjektiv", "A2", ix, "المقارنة: " + p, "Komparation", "【القاعدة】 " + r + ". 【مثال】 " + ed + " = " + ea + " 【تلميح】 als للتفضيل وwie للتساوي.", [ed, ea], [ed, ea], null, "أي أداة للمقارنة؟", ["als", "wie"], r + "."));
  G2.PARTICLES.forEach(([p, r, ed, ea], ix) => rowUnit("69", "g69", "partikel", "B1", ix, "الأداة: " + p, "Partikel", "【القاعدة】 الأداة " + p + " تعني " + r + ". 【مثال】 " + ed + " = " + ea + " 【تلميح】 الأدوات تعطي نكهة للجملة.", [ed, ea], [ed, ea], null, "ما وظيفة " + p + "؟", [r, "النفي"], p + ": " + r + "."));
  G2.QWORDS.forEach(([p, r, ed, ea], ix) => rowUnit("70", "g70", "fragen", "A1", ix, "أداة الاستفهام: " + p, "Fragewort", "【القاعدة】 " + p + " بمعنى " + r + ". 【مثال】 " + ed + " = " + ea + " 【تلميح】 أداة الاستفهام أولًا ثم الفعل.", [ed, ea], [ed, ea], null, "ما معنى " + p + "؟", [r, "متى"], p + " = " + r + "."));
  G2.TIMEEXPR.forEach(([p, r, ed, ea], ix) => rowUnit("71", "g71", "time", "A1", ix, "الوقت: " + p, "Zeit", "【القاعدة】 " + p + " بمعنى " + r + ". 【مثال】 " + ed + " = " + ea + " 【تلميح】 ضع الظرف أولًا مع عكس الفاعل والفعل.", [ed, ea], [ed, ea], null, "ما معنى " + p + "؟", [r, "المكان"], p + " = " + r + "."));
})();

/* ---------- 72: situational spotlights ---------- */
(function () {
  G2.SITU.forEach(([topic, lvl, focus, exDe, exAr], ix) => {
    rowUnit("72", "g72", topic, lvl, ix,
      "في موقف: " + topic + " (" + focus + ")", "Situation: " + topic,
      "【الموقف】 في موضوع " + topic + " ركز على: " + focus + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 تعلم القواعد داخل المواقف الحقيقية.",
      [exDe, exAr], [exDe, exAr], null,
      "ما التركيز هنا؟", [focus, "الماضي"], focus + ".");
  });
})();

/* ---------- 72: situational spotlights ---------- */
(function () {
  G2.SITU.forEach(([topic, lvl, focus, exDe, exAr], ix) => {
    rowUnit("72", "g72", topic, lvl, ix,
      "في موقف: " + topic + " (" + focus + ")", "Situation: " + topic,
      "【الموقف】 في موضوع " + topic + " ركز على: " + focus + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 تعلم القواعد داخل المواقف الحقيقية.",
      [exDe, exAr], [exDe, exAr], null,
      "ما التركيز هنا؟", [focus, "الماضي"], focus + ".");
  });
})();

/* ---------- 73: word formation ---------- */
(function () {
  G3.WORDFORM.forEach(([affix, type, meaning, exs], ix) => {
    const lvl = type === "FUG" || type === "NOM" ? "B1" : "A2";
    const exPairs = exs.slice(0, 2).map(([d, a]) => [d, a]);
    while (exPairs.length < 2) exPairs.push(exPairs[0]);
    rowUnit("73", "g73", "wortbildung", lvl, ix,
      "تكوين الكلمات: " + affix, "Wortbildung: " + affix,
      "【القاعدة】 " + (type === "PRE" ? "البادئة " : type === "SUF" ? "اللاحقة " : type === "FUG" ? "حرف الوصل " : "الظاهرة ") + affix + " بمعنى " + meaning + ". 【مثال】 " + exPairs[0][0] + " = " + exPairs[0][1] + " 【تلميح】 فكك الكلمات الطويلة لأجزائها.",
      exPairs[0], exPairs[1], null,
      "ما معنى " + affix + "؟", [meaning, "النفي دائمًا"], affix + ": " + meaning + ".");
  });
})();

/* ---------- 74: Nomen-Verb-Verbindungen ---------- */
(function () {
  G3.NVV.forEach(([nomen, verb, ar, exDe, exAr], ix) => {
    rowUnit("74", "g74", "verben", "A2", ix,
      "تركيب: " + nomen + " + " + verb, "Nomen-Verb: " + nomen,
      "【القاعدة】 التركيب " + nomen + " + " + verb + " بمعنى " + ar + " ويُحفظ كوحدة. 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 هذه التراكيب ثابتة لا تترجم حرفيًا.",
      [exDe, exAr], [exDe, exAr], null,
      "ما معنى التركيب؟", [ar, "العكس"], nomen + " + " + verb + " = " + ar + ".");
  });
})();

/* ---------- 75: Funktionsverbgefüge ---------- */
(function () {
  G3.FVG.forEach(([phrase, ar, exDe, exAr], ix) => {
    rowUnit("75", "g75", "verben", "B1", ix,
      "تركيب رسمي: " + phrase, "Funktionsverbgefüge",
      "【القاعدة】 التركيب الرسمي " + phrase + " بمعنى " + ar + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 شائع في اللغة الرسمية والإدارية.",
      [exDe, exAr], [exDe, exAr], null,
      "ما معنى " + phrase + "؟", [ar, "العكس"], phrase + " = " + ar + ".");
  });
})();

/* ---------- 76-80: B2 connectors, Konjunktiv I, genitive preps, pronominal adverbs, quantifiers ---------- */
(function () {
  G3.B2CONN.forEach(([c, arM, exDe, exAr], ix) => rowUnit("76", "g76", "konjunktion", "B1", ix, "الرابط المتقدم: " + c, "Konnektor: " + c, "【القاعدة】 الرابط " + c + " بمعنى " + arM + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 روابط المستوى المتقدم للدقة.", [exDe, exAr], [exDe, exAr], null, "ما معنى " + c + "؟", [arM, "ضد"], c + " = " + arM + "."));
  G3.KONJ1.forEach(([f, use, exDe, exAr], ix) => rowUnit("77", "g77", "verben", "B1", ix, "صيغة نقل الكلام: " + f, "Konjunktiv I", "【القاعدة】 الصيغة " + f + " تُستخدم لـ " + use + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 خاصة في الأخبار والتقارير.", [exDe, exAr], [exDe, exAr], null, "متى نستخدم " + f + "؟", [use, "للأمر"], f + " لـ " + use + "."));
  G3.GENPREP.forEach(([p, arM, exDe, exAr], ix) => rowUnit("78", "g78", "praeposition", "B1", ix, "حرف الإضافة: " + p, "Genitiv-Präposition", "【القاعدة】 الحرف " + p + " بمعنى " + arM + " ويأخذ الإضافة. 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 لغة رسمية.", [exDe, exAr], [exDe, exAr], null, "أي حالة بعد " + p + "؟", ["الإضافة", "النصب"], p + " يأخذ الإضافة."));
  G3.PRONOMADV.forEach(([a, vl, arM, exDe, exAr], ix) => rowUnit("79", "g79", "praeposition", "B1", ix, "الظرف الضميري: " + a, "Pronominaladverb", "【القاعدة】 " + a + " مع الفعل " + vl + " بمعنى " + arM + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 للأشياء لا الأشخاص.", [exDe, exAr], [exDe, exAr], null, "مع أي فعل يأتي " + a + "؟", [vl, "يأكل"], a + " مع " + vl + "."));
  G3.ZAHLADJ.forEach(([w, arM, exDe, exAr], ix) => rowUnit("80", "g80", "numbers", "A1", ix, "العدد والصفة: " + w, "Zahladjektiv", "【القاعدة】 " + w + " بمعنى " + arM + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 تُصرف كالصفة.", [exDe, exAr], [exDe, exAr], null, "ما معنى " + w + "؟", [arM, "الماضي"], w + " = " + arM + "."));
})();

/* ---------- 81: formal registers ---------- */
(function () {
  G3.FORMAL.forEach(([sit, point, exDe, exAr], ix) => {
    rowUnit("81", "g81", "polite", "B1", ix,
      sit + ": " + point, "Register: " + sit,
      "【الموقف】 في سياق " + sit + ": " + point + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 اللغة الرسمية تفتح الأبواب.",
      [exDe, exAr], [exDe, exAr], null,
      "ما العبارة المناسبة؟", [exDe.slice(0, 30), "عبارة عامية"], point + ".");
  });
})();

/* ---------- 82: genus/plural/compound rules ---------- */
(function () {
  const GENUS = [
    ["der-ung-falsch", "A1", "لاحقة ung مؤنثة", "die", "die Wohnung", "الشقة", "الكلمات بـ ung مؤنثة دائمًا."],
    ["der-heit", "A2", "لاحقة heit مؤنثة", "die", "die Krankheit", "المرض", "الكلمات بـ heit مؤنثة."],
    ["der-keit", "A2", "لاحقة keit مؤنثة", "die", "die Möglichkeit", "الإمكانية", "الكلمات بـ keit مؤنثة."],
    ["der-chen", "A1", "التصغير محايد", "das", "das Mädchen", "الفتاة", "التصغير بـ chen محايد حتى للبنات."],
    ["der-er", "A2", "الفاعل مذكر", "der", "der Lehrer", "المعلم", "الفاعل بـ er مذكر."],
    ["der-in", "A1", "المؤنث بـ in", "die", "die Lehrerin", "المعلمة", "المؤنث بإضافة in."],
    ["der-ei", "B1", "المكان مؤنث", "die", "die Bäckerei", "المخبز", "الأماكن بـ ei مؤنثة."],
    ["der-ik", "B1", "العلوم مؤنثة", "die", "die Musik", "الموسيقى", "أسماء العلوم مؤنثة."],
    ["der-or", "B1", "الفاعل اللاتيني", "der", "der Doktor", "الدكتور", "الفاعل بـ or مذكر."],
    ["der-ismus", "B1", "المذاهب مذكرة", "der", "der Tourismus", "السياحة", "المذاهب بـ ismus مذكرة."],
  ];
  GENUS.forEach(([key, lvl, rule, art, exDe, exAr, why], ix) => {
    rowUnit("82", "g82", "nomen", lvl, ix, "جنس الاسم: " + rule, "Genusregel",
      "【القاعدة】 " + rule + ": " + exDe + " = " + exAr + " 【لماذا】 " + why + " 【تلميح】 تعلم اللواحق تختصر الحفظ.",
      [exDe, exAr], [exDe, exAr], null,
      "ما جنس هذه الكلمة؟", [art, art === "die" ? "der" : "die"], rule + ".");
  });
  const PLUR = [
    ["-e جمع", "A1", "der Tag → die Tage", "اليوم → الأيام", "معظم المذكر يأخذ e."],
    ["-er جمع", "A1", "das Kind → die Kinder", "الطفل → الأطفال", "المحايد غالبًا er مع umlaut."],
    ["-en جمع", "A1", "die Frau → die Frauen", "المرأة → النساء", "المؤنث غالبًا n/en."],
    ["-s جمع", "A2", "das Auto → die Autos", "السيارة → السيارات", "الكلمات الأجنبية تأخذ s."],
    ["umlaut جمع", "A2", "der Vater → die Väter", "الأب → الآباء", "بعض المذكر umlaut فقط."],
    ["بدون تغيير", "A2", "der Lehrer → die Lehrer", "المعلم → المعلمون", "er/el/en غالبًا بلا تغيير."],
  ];
  PLUR.forEach(([t, lvl, exDe, exAr, why], ix) => {
    rowUnit("82", "g82", "nomen", lvl, ix + 20, "الجمع: " + t, "Pluralregel",
      "【القاعدة】 " + why + " 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 احفظ الجمع مع المفرد دائمًا.",
      [exDe, exAr], [exDe, exAr], null,
      "ما جمع هذه الكلمة؟", [exDe.split("→")[1].trim(), exDe.split("→")[0].trim()], why);
  });
})();

/* ---------- 83: advanced verb grammar (imperative/Konjunktiv/participle/aux/past/passive/lassen) ---------- */
(function () {
  const ADV = [
    ["الأمر مع du", "A1", "الفعل + e محذوفة غالبًا: Mach! Komm! Geh!", "Mach deine Hausaufgaben!", "اعمل واجبك!"],
    ["الأمر مع ihr", "A1", "الفعل + t: Macht! Kommt! Geht!", "Macht bitte Platz!", "افسحوا مكانًا!"],
    ["الأمر الرسمي", "A2", "المصدر + Sie: Kommen Sie! Nehmen Sie!", "Nehmen Sie bitte Platz!", "تفضل بالجلوس!"],
    ["الأمر الشاذ", "A2", "iss lies nimm sprich sieh gib", "Lies das Buch!", "اقرأ الكتاب!"],
    ["التمني würde", "B1", "würde + المصدر للتمني", "Ich würde gern reisen.", "أتمنى السفر."],
    ["النصيحة sollte", "B1", "sollte للنصيحة اللطيفة", "Du solltest zum Arzt gehen.", "ينبغي أن تذهب للطبيب."],
    ["الاحتمال könnte", "B1", "könnte للاحتمال المهذب", "Könntest du mir helfen?", "هل يمكنك مساعدتي؟"],
    ["الشرط wäre", "B1", "wäre للشرط غير الواقعي", "Wenn ich reich wäre, würde ich reisen.", "لو كنت غنيًا لسافرت."],
    ["التصريف ge-t", "A2", "الأفعال الضعيفة: ge + جذر + t", "Er hat gearbeitet.", "لقد عمل."],
    ["التصريف ge-en", "A2", "الأفعال القوية: ge + تغيير", "Er hat geschlafen.", "لقد نام."],
    ["بلا ge", "B1", "البادئات be ver er ent: verkauft verstanden", "Er hat es verkauft.", "لقد باعه."],
    ["sein للأفعال", "A2", "الحركة والتغير مع sein", "Er ist nach Berlin gefahren.", "سافر إلى برلين."],
    ["haben للباقي", "A2", "بقية الأفعال مع haben", "Ich habe viel gelernt.", "تعلمت كثيرًا."],
    ["الماضي السردي", "B1", "war hatte kam ging sah gab", "Es war einmal.", "كان يا ما كان."],
    ["المبني للمجهول", "B1", "werden + التصريف", "Das Haus wird gebaut.", "يُبنى البيت."],
    ["المبني للمجهول التام", "B1", "Zustand: sein + التصريف", "Die Tür ist geschlossen.", "الباب مغلق."],
    ["lassen + مصدر", "B1", "الترك/السماح", "Lass mich in Ruhe!", "اتركني وشأني!"],
    ["sich lassen", "B1", "الإمكانية", "Das lässt sich machen.", "هذا ممكن."],
  ];
  ADV.forEach(([t, lvl, rule, exDe, exAr], ix) => {
    rowUnit("83", "g83", "verben", lvl, ix, t, "Verb-Grammatik",
      "【القاعدة】 " + rule + ". 【مثال】 " + exDe + " = " + exAr + " 【تلميح】 قارن الأشكال ببعضها.",
      [exDe, exAr], [exDe, exAr], null,
      "ما القاعدة؟", [rule.slice(0, 25), "العكس"], rule + ".");
  });
})();

/* ---------- validation + append ---------- */
(function () {
  console.log("grammar2 built: " + units.length + " new units");
  /* chain related links within the new series (prev/next) */
  for (let i = 0; i < units.length; i++) {
    const rel = [];
    if (i > 0) rel.push(units[i - 1].id);
    if (i < units.length - 1) rel.push(units[i + 1].id);
    units[i].related = rel;
  }
  const all = grammar.concat(units);
  const r = gate.validateDataset({ vocab: [], sentences: [], grammar: all, exercises: [], dialogues: [] });
  console.log("STAGE3b gate: errors=" + r.errors.length + " warnings=" + r.warnings.length);
  r.errors.slice(0, 30).forEach((e) => console.log("  ERR " + e.id + " :: " + e.reason));
  const badIds = new Map();
  r.errors.forEach((e) => { if (!badIds.has(e.id)) badIds.set(e.id, e.reason); });
  const kept = units.filter((u) => !badIds.has(u.id));
  badIds.forEach((reason, id) => {
    const u = units.find((x) => x.id === id);
    if (u && grammar.some((x) => x.id === id)) return; // pre-existing, never drop
    rej(id, reason);
  });
  /* re-chain related links among kept units only (dropped neighbors break refs) */
  const keptIds = new Set(kept.map((u) => u.id));
  for (let i = 0; i < kept.length; i++) {
    const rel = [];
    if (i > 0) rel.push(kept[i - 1].id);
    if (i < kept.length - 1) rel.push(kept[i + 1].id);
    kept[i].related = rel;
  }
  void keptIds;
  const final = grammar.concat(kept);
  const r2 = gate.validateDataset({ vocab: [], sentences: [], grammar: final, exercises: [], dialogues: [] });
  console.log("STAGE3b after reject: grammar=" + final.length + " errors=" + r2.errors.length);
  if (r2.errors.length) { console.log("FATAL stage3b"); process.exit(1); }
  fs.writeFileSync(path.join(cache, "grammar.json"), JSON.stringify(final));
  fs.writeFileSync(path.join(cache, "rejected.json"), JSON.stringify(rejected, null, 1));
  console.log("stage3b ok, new kept: " + kept.length);
})();