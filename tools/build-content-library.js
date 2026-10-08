/* Deutsch Master — Content Library Builder (deterministic, quality-gated).
   Reads tools/clib/*.js, builds vocab/sentences/grammar/exercises/dialogues,
   validates EVERY batch with the Quality Gate (reject + log, never silently insert),
   emits: client/content/src/*.json (source of truth) + client/content/dm-*.js (runtime packs).
   Run: node tools/build-content-library.js   (exit 1 if gate errors remain)
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { rng, pick, shuffle, normDE } = require("./clib/util");
const { NOUNS } = require("./clib/nouns");
const { HEADS } = require("./clib/heads");
const { NOUNS2, COUNTRIES, VPREP, UNADJ } = require("./clib/more");
const { VERBS, PREFIXVERBS } = require("./clib/verbs");
const { ADJ, FUNC, PHRASES } = require("./clib/adjfunc");
const { COMP } = require("./clib/compounds");
const { TRANSP } = require("./clib/transparent");
const { IDIOMS } = require("./clib/idioms");
const { STEMS, SUBJ, TIMES, PLACES, VG_TRAN, VG_INTRAN, VG_DITRAN, VG_MODAL, PATS } = require("./clib/sentgen");
const { GT1 } = require("./clib/grammar1");
const { GT2 } = require("./clib/grammar2");
const BIG = require("./clib/bigvocab");
const { SITS, POOLS } = require("./clib/dialogs");
const { EXTRA } = require("./clib/dialogs2");
const gate = require("./content-quality-gate");

const R = rng("deutsch-master-library-v1");
const rejected = [];
const mergedLog = [];
const stats = {};
function rej(id, reason) { rejected.push({ id, reason }); }

/* ---------- helpers ---------- */
const stripDigits = (s) => String(s).replace(/[0-9_]+$/, "").replace(/_[a-z]+$/, (m) => m); // keep _suffix for func (handled separately)
const stripNum = (s) => String(s).replace(/[0-9]+$/, "");
function stripAl(ar) { return String(ar).replace(/^ال/, ""); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function bumpLvl(l) { return l === "A1" ? "A2" : l; }
let seq = { v: 0, s: 0, g: 0, e: 0, d: 0 };
const nid = (p) => p + String(++seq[p === "lv" ? "v" : p === "ls" ? "s" : p === "lg" ? "g" : p === "le" ? "e" : "d"]).padStart(5, "0");

/* article declension for building phrases */
function declArt(art, kase, plural) {
  if (plural) return kase === "N" ? "die" : kase === "A" ? "die" : kase === "D" ? "den" : "der";
  switch (art) {
    case "der": return kase === "N" ? "der" : kase === "A" ? "den" : kase === "D" ? "dem" : "des";
    case "die": return kase === "N" ? "die" : kase === "A" ? "die" : kase === "D" ? "der" : "der";
    case "das": return kase === "N" ? "das" : kase === "A" ? "das" : kase === "D" ? "dem" : "des";
    case "ein": return kase === "N" ? "ein" : kase === "A" ? "einen" : kase === "D" ? "einem" : "eines";
    case "eine": return kase === "N" ? "eine" : kase === "A" ? "eine" : kase === "D" ? "einer" : "einer";
    default: return art;
  }
}
function pluralN(noun, plural) {
  if (!plural || plural === "-") return noun;
  if (/^(der|die|das)\s/.test(plural)) return plural;
  return plural;
}
/* shared compounding guards: heads that must never compound (calendar words,
   directions, units, proper-noun-like entries, attested bad outputs) */
const BLOCKHEADS = new Set(["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag", "frühling", "sommer", "herbst", "winter", "norden", "süden", "osten", "westen", "kilometer", "meter", "zentimeter", "gramm", "kilogramm", "liter", "prozent", "grad", "euro", "cent", "bohrer", "streichholz", "aufzug", "größe", "vorname", "tochter", "münze", "glühlampe", "schufa", "fernseher", "feuerzeug", "belag", "heim", "sohn", "sonne", "mond", "party", "eimer", "husten", "kamm", "strand", "insel", "lärm", "bäcker", "bäckerin", "croissant", "schraube", "feier", "vitamin", "problem", "gürtel", "müsli", "steuer", "massage", "schloss", "heizung", "ring", "dichter", "schirm", "wand", "tafel", "fenster", "visum", "meer", "sprache", "scheidung", "licht", "messe", "klavier", "lieferung", "baby", "schule", "fischer"]);
function badHead(h, maxLen) {
  if (h.de.length > (maxLen || 9)) return true;
  if (BLOCKHEADS.has(normDE(h.de))) return true;
  if (h.de.toLowerCase().startsWith("sich ")) return true;
  const har = String(h.ar).split("/")[0].trim();
  if (/\s/.test(har)) return true; // multi-word Arabic -> compositional translation breaks
  return false;
}
/* exact-output denylist: grammatical but nonsensical qualifier combos (audited) */
const DENY_DE = new Set(["kleinvater", "kleinmutter", "neuvater", "neumutter", "altvater", "altmutter", "großkind", "neukind", "altkind", "wollschuh", "kleinplatz", "großplatz", "neuplatz", "altplatz", "passreise"]);
/* verb conjugation */
const SEPPREF = ["zurück", "zusammen", "vorbei", "weiter", "herunter", "wieder", "voll", "fern", "statt", "teil", "heim", "raus", "rein", "runter", "rauf", "los", "fest", "ab", "an", "auf", "aus", "bei", "ein", "mit", "nach", "vor", "zu", "weg"];
function splitSep(inf) {
  const low = inf.toLowerCase();
  for (const p of SEPPREF) if (low.startsWith(p) && low.length > p.length + 2) return { stem: inf.slice(p.length), pref: inf.slice(0, p.length) };
  return null;
}
const MODALS = { "können": ["kann", "kannst", "kann"], "müssen": ["muss", "musst", "muss"], "dürfen": ["darf", "darfst", "darf"], "sollen": ["soll", "sollst", "soll"], "wollen": ["will", "willst", "will"], "möchten": ["möchte", "möchtest", "möchte"] };
function conjCore(stemInf, person) {
  // person: ich du er wir ihr sie
  let inf = stemInf;
  if (inf === "sein") return { ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind" }[person];
  if (inf === "haben") return { ich: "habe", du: "hast", er: "hat", wir: "haben", ihr: "habt", sie: "haben" }[person];
  if (inf === "werden") return { ich: "werde", du: "wirst", er: "wird", wir: "werden", ihr: "werdet", sie: "werden" }[person];
  if (inf === "wissen") return { ich: "weiß", du: "weißt", er: "weiß", wir: "wissen", ihr: "wisst", sie: "wissen" }[person];
  if (MODALS[inf]) { const m = MODALS[inf]; return { ich: m[0], du: m[1], er: m[2], wir: inf, ihr: inf + "t", sie: inf }[person]; }
  let stem = inf.replace(/en$/, "");
  /* -eln/-ern keep e (bummelt); -Cnen/-Cmen after obstruents keeps e (öffnet, atmet),
     but -rnen/-lnen/-hnen/-enen drop it (lernt, wohnt, gähnt, dient) */
  const eln = (/([lr])$/.test(stem) && /(el|er)n$/.test(inf)) || /(ch|[bcdfgjkpqtvwxzß])[mn]en$/.test(inf);
  if (eln) {
    const full = inf.slice(0, -1), short = full.replace(/e([lr])$/, "$1");
    if (person === "ich") return short === full ? full : short + "e";
    if (person === "du") return full + "st";
    if (person === "er") return full + "t";
    if (person === "wir" || person === "sie") return inf;
    return full + "t";
  }
  const key = inf;
  if ((person === "du" || person === "er") && STEMS[key]) return STEMS[key][person === "du" ? 0 : 1];
  const t_d = /[td]$/.test(stem), sibil = /[sßzx]$/.test(stem);
  switch (person) {
    case "ich": return stem + "e";
    case "du": return stem + (t_d ? "est" : sibil ? "t" : "st");
    case "er": return stem + (t_d ? "et" : "t");
    case "wir": case "sie": return inf;
    case "ihr": return stem + (t_d ? "et" : "t");
  }
  return stem;
}
function conj(inf, person) {
  const reflexive = inf.startsWith("sich ");
  const base = reflexive ? inf.slice(5) : inf;
  const sp = splitSep(base);
  if (sp) return { core: conjCore(sp.stem, person), tail: " " + sp.pref, full: conjCore(sp.stem, person) + " " + sp.pref };
  return { core: conjCore(base, person), tail: "", full: conjCore(base, person) };
}
/* past participle */
const PARTS = {};
VERBS.forEach((row) => {
  const p = row.split("|"); const inf = stripNum(p[0]).trim();
  if (p[7] && p[7] !== "-") PARTS[inf] = p[7].split(",");
});
function participle(inf) {
  const clean = inf.startsWith("sich ") ? inf.slice(5) : inf;
  if (PARTS[clean]) return PARTS[clean][1] || PARTS[clean][0];
  const sp = splitSep(clean);
  const mk = (s) => "ge" + s.replace(/en$/, "") + "t";
  if (sp) {
    if (PARTS[sp.stem]) { const b = PARTS[sp.stem]; return sp.pref + (b[1] || b[0]).replace(/^ge/, ""); }
    return sp.pref + mk(sp.stem).replace(/^ge/, "");
  }
  if (/^(be|ver|er|ent|emp|miss|zer|ge)/.test(clean)) return clean.replace(/en$/, "") + "t";
  return mk(clean);
}
function auxOf(inf) {
  const c = inf.startsWith("sich ") ? inf.slice(5) : inf;
  if (/^(gehen|kommen|fahren|laufen|fliegen|bleiben|sein|werden|aufstehen|ankommen|abfahren|einsteigen|aussteigen|umsteigen|mitkommen|zurückkommen|einschlafen|aufwachen|umziehen|einziehen|ausziehen|scheinen|wachsen|fallen|fliehen|schwimmen|wandern|passieren|gelingen|reisen)$/.test(c)) return "sein";
  return "haben";
}
/* arabic verb agreement: base like يشتري/يتعلم (3sg masc) */
function arVerb(base, person, fem) {
  let stem = base.replace(/^ي/, "");
  if (person === "ich") return "أ" + stem;
  if (person === "wir") return "ن" + stem;
  if (person === "du" || person === "ihr") return "ت" + stem + (person === "ihr" ? "ون" : "");
  if (person === "sie") { // they formal/plural
    if (base === "__pl") return base;
    return fem === "pl" ? "ي" + stem + "ون" : "ت" + stem;
  }
  return (fem ? "ت" + stem : "ي" + stem);
}
function arAdj(base, fem) {
  if (!fem || /ة$/.test(base)) return base;
  if (/ى$|اء$|ين$|ون$/.test(base)) return base;
  return base + "ة";
}

/* ================= VOCAB ================= */
const vocab = [];
const vSeen = new Map(); // norm|type -> id
function addVocab(o) {
  const key = normDE(o.de) + "|" + o.type;
  if (vSeen.has(key)) { mergedLog.push({ kept: vSeen.get(key), dropped: o.de }); return null; }
  if (!o.id) o.id = nid("lv");
  vSeen.set(key, o.id);
  vocab.push(o);
  return o;
}
const RENAME_DE = { Decke2: "Bettdecke" };
const REPL = { Bettdecke: { plural: "Bettdecken", ar: "غطاء السرير", en: "duvet", cat: "furniture", lvl: "A1" } };
function parseNounRow(row, extraType) {
  const p = row.split("|");
  if (p.length < 7) { rej(row.slice(0, 30), "vocab: malformed noun row"); return; }
  let [de, art, plural, ar, en, cat, lvl] = p.map((x) => x.trim());
  if (RENAME_DE[de]) { const r = REPL[RENAME_DE[de]]; de = RENAME_DE[de]; plural = r.plural; ar = r.ar; en = r.en; cat = r.cat; lvl = r.lvl; }
  else de = stripNum(de);
  addVocab({ de, art, plural, ar, en, level: lvl, cat, type: "noun" });
}
NOUNS.forEach((r) => parseNounRow(r));
HEADS.forEach((r) => parseNounRow(r));
NOUNS2.forEach((r) => parseNounRow(r));
BIG.BIGBASE.forEach((r) => parseNounRow(r));
stats.nounsBase = vocab.length;

/* noun lookup for compounds */
const nounByDe = new Map();
vocab.forEach((w) => { if (w.type === "noun" && !nounByDe.has(normDE(w.de))) nounByDe.set(normDE(w.de), w); });
function addCompound(headRaw, pairStr) {
  const headKey = stripNum(headRaw.trim());
  const head = nounByDe.get(normDE(headKey)) || nounByDe.get(normDE(headKey.replace(/^die |^der |^das /, "")));
  if (!head) { rej(headRaw, "compound: unknown head " + headKey); return; }
  pairStr.split(",").forEach((pair) => {
    const parts = pair.split(":");
    if (parts.length < 3 || parts.some((x) => !x.trim())) { rej(head.de + "/" + pair, "compound: malformed pair"); return; }
    const [modRaw, ar, en] = parts.map((x) => x.trim());
    const mod = stripNum(modRaw);
    const lc1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
    let de, pl;
    if (mod.toLowerCase().endsWith(head.de.toLowerCase())) { de = cap(mod); pl = head.plural; }
    else { de = cap(mod) + lc1(head.de); pl = head.plural === "-" ? "-" : (/^(der|die|das)\s/.test(head.plural) ? head.plural : cap(mod) + lc1(head.plural)); }
    if (!/^[A-ZÄÖÜ]/.test(de)) { rej(de, "compound: bad capitalization"); return; }
    addVocab({ de, art: head.art, plural: pl, ar, en, level: bumpLvl(head.level), cat: head.cat, type: "noun", head: head.id });
  });
}
COMP.forEach(function ([h, pairs]) { addCompound(h, pairs); });
TRANSP.forEach(function ([h, pairs]) { addCompound(h, pairs); });
BIG.BIGCOMP.forEach(function ([h, pairs]) { addCompound(h, pairs); });
stats.afterCompounds = vocab.length;
/* MODGEN: category-constrained productive compounding (deterministic order).
   Arabic: "<headAr> <modAr>"; English: "<modEn> <headEn>". */
(function () {
  const mg = rng("modgen-v1");
  /* adjectival modifiers: Arabic without ال (مدينة كبيرة not مدينة الكبير) */
  const MODADJ = new Set(["Sommer", "Winter", "Woll", "Leder", "Holz", "Glas", "Metall", "Stein", "Stoff", "Seiden", "Baumwoll", "Bio", "Öko", "Super", "Mini", "Groß", "Klein", "Neu", "Alt", "Ober", "Unter", "Neben", "Hinter", "Vorder", "Morgen", "Abend", "Nacht", "Wochen", "Jahres", "Tages"]);
  let made = 0, skipped = 0;
  BIG.MODGEN.forEach(function ([mod, modAr, modEn, cats, cap]) {
    const heads = vocab.filter((w) => w.type === "noun" && !w.head && cats.indexOf(w.cat) >= 0 && ["der", "die", "das"].indexOf(w.art) >= 0);
    const order = shuffle(mg, heads);
    let n = 0;
    for (const h of order) {
      if (n >= cap) break;
      if (mg() < 0.30) continue; // deterministic variety spread
      if (h.de.toLowerCase().startsWith(mod.toLowerCase())) continue; // Schul+Schule -> nonsense
      if (badHead(h)) { skipped++; continue; }
      const headBase = h.de.replace(/^[A-ZÄÖÜ]/, (c) => c.toLowerCase());
      const de = mod.charAt(0).toUpperCase() + mod.slice(1) + headBase;
      if (de.length > 30) { skipped++; continue; }
      if (vSeen.has(normDE(de) + "|verb")) { rej(de, "compound: collides with verb infinitive"); skipped++; continue; }
      if (DENY_DE.has(normDE(de))) { rej(de, "compound: denied output"); skipped++; continue; }
      const har = String(h.ar).split("/")[0].trim().replace(/^ال/, "");
      const ar = har + " " + (MODADJ.has(mod) ? modAr.replace(/^ال/, "") : modAr);
      const en = modEn + " " + String(h.en || h.de).toLowerCase();
      const before = vocab.length;
      addCompound(h.de, mod + ":" + ar + ":" + en);
      // addCompound rebuilds de from mod+head itself; count success:
      if (vocab.length > before) { made++; n++; }
    }
  });
  /* QMOD second pass over BASE nouns (flagged via absence of .head link) */
  const qg = rng("qmod-v1");
  BIG.QMOD.forEach(function ([mod, modAr, modEn, cats, cap]) {
    const heads = vocab.filter((w) => w.type === "noun" && !w.head && cats.indexOf(w.cat) >= 0 && ["der", "die", "das"].indexOf(w.art) >= 0);
    const order = shuffle(qg, heads);
    let n = 0;
    for (const h of order) {
      if (n >= cap) break;
      if (qg() < 0.45) continue;
      if (h.de.toLowerCase().startsWith(mod.toLowerCase())) continue;
      if (badHead(h)) { skipped++; continue; }
      const har = String(h.ar).split("/")[0].trim().replace(/^ال/, "");
      const before = vocab.length;
      addCompound(h.de, mod + ":" + har + " " + modAr.replace(/^ال/, "") + ":" + modEn + " " + String(h.en || h.de).toLowerCase());
      if (vocab.length > before) { made++; n++; }
    }
  });
  stats.modgen = made; stats.modgenSkipped = skipped;
  /* MODHEADS: food modifiers with curated head allowlists (genitive Arabic).
     Curated heads bypass BLOCKHEADS (explicit human choice); length + single-word
     Arabic still enforced. */
  let mhMade = 0;
  BIG.MODHEADS.forEach(function ([mod, modAr, modEn, heads]) {
    heads.forEach(function (hn) {
      const h = nounByDe.get(normDE(hn));
      if (!h) { rej(mod + "+" + hn, "modheads: unknown head " + hn); return; }
      if (h.de.length > 12) return;
      const har0 = String(h.ar).split("/")[0].trim();
      if (/\s/.test(har0)) return;
      const har = har0.replace(/^ال/, "");
      const before = vocab.length;
      addCompound(h.de, mod + ":" + har + " " + modAr + ":" + modEn + " " + String(h.en || h.de).toLowerCase());
      if (vocab.length > before) mhMade++;
    });
  });
  stats.modheads = mhMade;
  /* honest B1 marking: abstract-domain modifiers live at B1 (CEFR: work/study/admin domains) */
  const MODB1 = new Set(["Berufs", "Betriebs", "Versicherungs", "Bewerbungs", "Prüfungs", "Ausbildungs", "Studien", "Vorlesungs", "Kunden", "Antrags", "Steuer", "Kredit", "Not", "Patienten", "Krankenhaus"]);
  let b1marked = 0;
  vocab.forEach((w) => {
    if (w.type === "noun" && w.head && w.level !== "B1") {
      for (const m of MODB1) if (w.de.startsWith(m)) { w.level = "B1"; b1marked++; break; }
    }
  });
  stats.modgenB1 = b1marked;
})();

/* verbs */
const verbByInf = new Map();
function parseVerbRow(row) {
  const p = row.split("|");
  if (p.length < 7) { rej(row.slice(0, 30), "vocab: malformed verb row"); return; }
  let [inf, sep, reg, ar, en, cat, lvl] = p.map((x) => (x || "").trim());
  inf = stripNum(inf);
  const parts = (p[7] || "").trim();
  const o = addVocab({ de: inf, art: "-", ar, en, level: lvl, cat, type: "verb", sep: sep === "1", reg: reg === "I" ? "irr" : "reg", parts });
  if (o) verbByInf.set(normDE(inf.replace(/^sich /, "")), o);
}
VERBS.concat(BIG.BIGVERBS).forEach(parseVerbRow);
const PREFLIST = ["zurück", "zusammen", "vorbei", "weiter", "herunter", "wieder", "voll", "fern", "statt", "teil", "heim", "raus", "rein", "runter", "rauf", "hoch", "los", "ab", "an", "auf", "aus", "bei", "ein", "mit", "nach", "vor", "zu", "weg", "be", "ver", "er", "ent", "emp", "miss", "zer", "ge", "über", "unter", "um", "durch", "wider", "hinter", "dahinter"];
PREFIXVERBS.forEach((row) => {
  const p = row.split("|");
  let [inf, sep, reg, ar] = [stripNum((p[0] || "").trim()), p[1], p[2], (p[3] || "").trim()];
  if (!inf || !ar) { rej(row.slice(0, 30), "verb: malformed prefix row"); return; }
  if (vSeen.has(normDE(inf) + "|verb")) return; // already have base
  // derive principal parts from base verb
  let parts = "-";
  const low = inf.replace(/^sich /, "").toLowerCase();
  const prefs = PREFLIST.slice().sort((a, b) => b.length - a.length);
  for (const pr of prefs) {
    if (low.startsWith(pr) && low.length > pr.length + 2) {
      const base = low.slice(pr.length);
      const b = verbByInf.get(base);
      if (b && b.parts && b.parts.includes(",")) {
        const [prät, pp] = b.parts.split(",");
        /* separable: ge stays after the prefix (an+gerufen=angerufen);
           inseparable: no ge after prefix (be+kommen=bekommen) */
        if (sep === "1") parts = prät + " " + pr + "," + pr + pp;
        else parts = prät + "," + pr + pp.replace(/^ge/, "");
        break;
      } else if (b) { parts = "-"; break; }
    }
  }
  addVocab({ de: inf, art: "-", ar, en: "", level: "A2", cat: "verbs", type: "verb", sep: sep === "1", reg: reg === "I" ? "irr" : "reg", parts });
});
/* BIG prefix verbs: inseparable (abstract) ones level B1, everyday separable A2 */
BIG.BIGPREFIX.forEach((row) => {
  const p = row.split("|");
  let [inf, sep, reg, ar] = [stripNum((p[0] || "").trim()), p[1], p[2], (p[3] || "").trim()];
  if (!inf || !ar) { rej(row.slice(0, 30), "verb: malformed bigprefix row"); return; }
  if (vSeen.has(normDE(inf) + "|verb")) return;
  let parts = "-";
  const low = inf.replace(/^sich /, "").toLowerCase();
  const prefs = PREFLIST.slice().sort((a, b) => b.length - a.length);
  for (const pr of prefs) {
    if (low.startsWith(pr) && low.length > pr.length + 2) {
      const base = low.slice(pr.length);
      const b = verbByInf.get(base);
      if (b && b.parts && b.parts.includes(",")) {
        const [prät, pp] = b.parts.split(",");
        if (sep === "1") parts = prät + " " + pr + "," + pr + pp;
        else parts = prät + "," + pr + pp.replace(/^ge/, "");
        break;
      } else if (b) { parts = "-"; break; }
    }
  }
  addVocab({ de: inf, art: "-", ar, en: "", level: sep === "1" ? "A2" : "B1", cat: "verbs", type: "verb", sep: sep === "1", reg: reg === "I" ? "irr" : "reg", parts });
});
stats.afterVerbs = vocab.length;

/* adjectives */
const adjByBase = new Map();
ADJ.concat(BIG.BIGADJ).forEach((row) => {
  const p = row.split("|");
  if (p.length < 4) { rej(row.slice(0, 30), "vocab: malformed adj row"); return; }
  let [base, ar, en, lvl] = p.map((x) => (x || "").trim());
  base = stripNum(base);
  const comp = (p[4] || "").trim(), sup = (p[5] || "").trim();
  const o = addVocab({ de: base, art: "-", ar, en, level: lvl || "A1", cat: "adjectives", type: "adj", comp: comp && comp !== "-" ? comp : undefined, sup: sup && sup !== "-" ? sup : undefined });
  if (o) adjByBase.set(normDE(base), o);
});
UNADJ.forEach((row) => {
  const p = row.split("|");
  const [base, full, ar, en] = p.map((x) => (x || "").trim());
  if (!full || !ar) { rej(row.slice(0, 30), "adj: malformed un-row"); return; }
  addVocab({ de: full, art: "-", ar, en, level: "A2", cat: "adjectives", type: "adj", comp: full + "er", sup: full + "st" });
});
/* auto feminine professions: single-token Arabic masc -er/-or/-ent/-ist/-eur/-ian professions */
(function () {
  const list = vocab.filter((w) => w.type === "noun" && /^(der)$/.test(w.art) && /(er|or|ent|ist|eur|oge|ier|ant)$/.test(w.de) && !/ /.test(w.ar) && !/ة$/.test(w.ar) && /^(jobs|profi)$/.test(w.cat));
  list.forEach((m) => {
    const f = m.de + "in";
    if (vSeen.has(normDE(f) + "|noun")) return;
    addVocab({ de: f, art: "die", plural: f + "nen", ar: m.ar + "ة", en: (m.en || "") + " (f)", level: m.level, cat: m.cat, type: "noun", femOf: m.id });
  });
})();
stats.afterAdj = vocab.length;

/* func words */
const WTMAP = { pron: "pron", adv: "adv", conj: "conj", prep: "prep", num: "num", quest: "func", det: "func" };
const FUNC_FIX = { seit_conj: "seitdem" };
FUNC.forEach((row) => {
  const p = row.split("|");
  if (p.length < 6) { rej(row.slice(0, 30), "vocab: malformed func row"); return; }
  let [de, wt, ar, en, cat, lvl] = p.map((x) => (x || "").trim());
  const m = de.match(/_([a-z]+)$/);
  const suf = m ? m[1] : "";
  let bare = suf ? de.slice(0, -(suf.length + 1)) : de;
  if (FUNC_FIX[bare + "_" + wt] || FUNC_FIX[bare]) bare = FUNC_FIX[bare + "_" + wt] || FUNC_FIX[bare];
  if (bare === "wieviel") bare = "wie viel";
  const type = WTMAP[wt] || "func";
  const key = normDE(bare) + "|" + type;
  if (vSeen.has(key)) {
    const prev = vocab.find((w) => normDE(w.de) + "|" + w.type === key);
    if (prev && !prev.ar.includes(ar)) { prev.ar += " / " + ar; if (en && !prev.en.includes(en)) prev.en += " / " + en; }
    return;
  }
  addVocab({ de: bare, art: "-", ar, en, level: lvl, cat, type });
});
/* phrases + idioms + vprep */
function addPhraseRow(row) {
  const p = row.split("|");
  if (p.length < 5) { rej(row.slice(0, 40), "vocab: malformed phrase row"); return; }
  let [de, ar, en, cat, lvl] = p.map((x) => (x || "").trim());
  de = stripNum(de);
  addVocab({ de, art: "-", ar, en, level: lvl || "A1", cat: cat || "general", type: "phrase" });
}
PHRASES.concat(BIG.BIGPHR).forEach(addPhraseRow);
IDIOMS.forEach(addPhraseRow);
VPREP.forEach((row) => {
  const p = row.split("|");
  addVocab({ de: p[0].trim(), art: "-", ar: p[1].trim(), en: p[2].trim(), level: "A2", cat: "general", type: "phrase" });
});
/* countries */
const LAND_DIE = { "Türkei": 1, "Schweiz": 1, "Slowakei": 1, "Ukraine": 1 };
const LAND_PL = { "Niederlande": 1, "USA": 1, "Philippinen": 1, "Vereinigte Arabische Emirate": 1 };
const PLUR_OV = { Deutscher: "Deutschen", Ungar: "Ungarn" };
function mascPl(m) {
  if (PLUR_OV[m]) return PLUR_OV[m];
  if (/er$/.test(m)) return m;
  if (/e$/.test(m)) return m + "n";
  if (/i$/.test(m)) return m + "s";
  if (/ar$/.test(m)) return m + "n";
  if (/[tn]$/.test(m)) return m + "en";
  return m + "e";
}
COUNTRIES.forEach((row) => {
  const [land, ar, adjDe, adjAr, pm, pf] = row.split("|").map((x) => x.trim());
  if (!land || !ar || !pm || !pf) { rej(land, "country: malformed"); return; }
  if (LAND_PL[land]) addVocab({ de: land, art: "die", plural: land, ar, en: land, level: "A2", cat: "germany", type: "noun" });
  else addVocab({ de: land, art: LAND_DIE[land] ? "die" : "das", plural: "-", ar, en: land, level: "A2", cat: "germany", type: "noun" });
  addVocab({ de: adjDe, art: "-", ar: adjAr, en: adjDe, level: "A2", cat: "people", type: "adj" });
  addVocab({ de: pm, art: "der", plural: mascPl(pm), ar: adjAr, en: pm, level: "A2", cat: "people", type: "noun" });
  const pfPl = /in$/.test(pf) ? pf + "nen" : pf + "n";
  addVocab({ de: pf, art: "die", plural: pfPl, ar: adjAr, en: pf, level: "A2", cat: "people", type: "noun" });
});
/* numbers 21-99 */
const ONES = { 1: ["ein", "واحد"], 2: ["zwei", "اثنان"], 3: ["drei", "ثلاثة"], 4: ["vier", "أربعة"], 5: ["fünf", "خمسة"], 6: ["sechs", "ستة"], 7: ["sieben", "سبعة"], 8: ["acht", "ثمانية"], 9: ["neun", "تسعة"] };
const TENS = { 2: ["zwanzig", "عشرون"], 3: ["dreißig", "ثلاثون"], 4: ["vierzig", "أربعون"], 5: ["fünfzig", "خمسون"], 6: ["sechzig", "ستون"], 7: ["siebzig", "سبعون"], 8: ["achtzig", "ثمانون"], 9: ["neunzig", "تسعون"] };
for (let t = 2; t <= 9; t++) for (let o = 1; o <= 9; o++) {
  addVocab({ de: ONES[o][0] + "und" + TENS[t][0], art: "-", ar: ONES[o][1] + " و" + TENS[t][1], en: ONES[o][0] + "-" + TENS[t][0], level: "A1", cat: "numbers", type: "num" });
}
const ORD1 = { 4: "الرابع", 5: "الخامس", 6: "السادس", 7: "السابع", 8: "الثامن", 9: "التاسع", 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر", 13: "الثالث عشر", 14: "الرابع عشر", 15: "الخامس عشر", 16: "السادس عشر", 17: "السابع عشر", 18: "الثامن عشر", 19: "التاسع عشر", 20: "العشرون" };
const ORDDE = { 4: "vierte", 5: "fünfte", 6: "sechste", 7: "siebte", 8: "achte", 9: "neunte", 10: "zehnte", 11: "elfte", 12: "zwölfte", 13: "dreizehnte", 14: "vierzehnte", 15: "fünfzehnte", 16: "sechzehnte", 17: "siebzehnte", 18: "achtzehnte", 19: "neunzehnte", 20: "zwanzigste" };
for (let n = 4; n <= 20; n++) addVocab({ de: ORDDE[n], art: "-", ar: ORD1[n], en: ORDDE[n], level: "A1", cat: "numbers", type: "num" });
const ORDONES = { 1: ["einundzwanzigste", "الحادي والعشرون"], 2: ["zweiundzwanzigste", "الثاني والعشرون"], 3: ["dreiundzwanzigste", "الثالث والعشرون"] };
Object.values(ORDONES).forEach(function ([de, ar]) { addVocab({ de, art: "-", ar, en: de, level: "A2", cat: "numbers", type: "num" }); });
/* time/date phrases (compositional, safe) */
const DAYAR = { Montag: "الاثنين", Dienstag: "الثلاثاء", Mittwoch: "الأربعاء", Donnerstag: "الخميس", Freitag: "الجمعة", Samstag: "السبت", Sonntag: "الأحد" };
Object.keys(DAYAR).forEach((d) => addVocab({ de: "am " + d, art: "-", ar: "يوم " + DAYAR[d], en: "on " + d, level: "A1", cat: "dates", type: "phrase" }));
const MONAR = { Januar: "يناير", Februar: "فبراير", März: "مارس", April: "أبريل", Mai: "مايو", Juni: "يونيو", Juli: "يوليو", August: "أغسطس", September: "سبتمبر", Oktober: "أكتوبر", November: "نوفمبر", Dezember: "ديسمبر" };
Object.keys(MONAR).forEach((m) => addVocab({ de: "im " + m, art: "-", ar: "في " + MONAR[m], en: "in " + m, level: "A1", cat: "dates", type: "phrase" }));
[["morgens früh", "في الصباح الباكر"], ["abends spät", "في المساء المتأخر"], ["jede Woche", "كل أسبوع"], ["jedes Jahr", "كل سنة"], ["nächsten Montag", "الاثنين القادم"], ["letzten Freitag", "الجمعة الماضية"], ["heute Morgen", "صباح اليوم"], ["heute Abend", "مساء اليوم"], ["morgen früh", "غدًا صباحًا"], ["gestern Abend", "مساء أمس"], ["am Wochenende", "في عطلة الأسبوع"], ["unter der Woche", "خلال الأسبوع"], ["im Sommer", "في الصيف"], ["im Winter", "في الشتاء"], ["pünktlich um acht", "تمام الثامنة"], ["gegen Abend", "نحو المساء"], ["vor einer Woche", "قبل أسبوع"], ["in einer Woche", "بعد أسبوع"], ["seit einem Jahr", "منذ سنة"], ["bis morgen", "حتى الغد"]].forEach(([de, ar]) => addVocab({ de, art: "-", ar, en: de, level: "A1", cat: "time", type: "phrase" }));
/* collocations verb + accusative object, verbs grouped by category */
const COLLOC = [
  ["kaufen", "shopping", 12], ["bestellen", "restaurant", 8], ["brauchen", "general", 8], ["suchen", "general", 8], ["finden", "general", 8],
  ["kochen", "food", 10], ["putzen", "home", 6], ["reparieren", "services", 6], ["öffnen", "general", 6], ["schließen", "general", 6],
  ["bezahlen", "money", 6], ["reservieren", "hotel", 6], ["waschen", "routine", 6], ["lesen", "study", 8], ["schreiben", "study", 8],
  ["sehen", "general", 8], ["hören", "general", 6], ["lernen", "study", 6], ["vergessen", "general", 6], ["verlieren", "general", 6],
  ["gewinnen", "sports", 4], ["empfehlen", "general", 6], ["erklären", "study", 6], ["zeigen", "general", 6], ["bringen", "general", 6],
  ["schicken", "communication", 6], ["leihen", "general", 4], ["verkaufen", "shopping", 6], ["mieten", "home", 4], ["buchen", "travel", 6],
  ["besuchen", "family", 6], ["treffen", "relationships", 6], ["anrufen", "phones", 4], ["abholen", "travel", 4], ["putzen", "routine", 4]
];
COLLOC.push(...BIG.BIGCOLL);
(function () {
  const vmap = new Map();
  vocab.filter((w) => w.type === "verb").forEach((w) => { const b = w.de.replace(/^sich /, ""); if (!vmap.has(b)) vmap.set(b, w); });
  const byCat = new Map();
  vocab.filter((w) => w.type === "noun").forEach((w) => { if (!byCat.has(w.cat)) byCat.set(w.cat, []); byCat.get(w.cat).push(w); });
  const rr = rng("colloc");
  COLLOC.forEach(([inf, cat, n]) => {
    const v = vmap.get(inf);
    if (!v) return;
    const pool = shuffle(rr, byCat.get(cat) || []).slice(0, n * 2);
    let made = 0;
    for (const o of pool) {
      if (made >= n) break;
      const art = declArt(o.art === "-" ? "der" : o.art, "A", false);
      const de = v.de.replace(/^sich /, "") + " " + art + " " + o.de;
      void 0;
      const key = normDE(de) + "|phrase";
      if (vSeen.has(key)) continue;
      // german infinitive clause with accusative object
      const gde = (v.de.startsWith("sich ") ? "sich " : "") + inf + " " + art + " " + o.de;
      if (vSeen.has(normDE(gde) + "|phrase")) continue;
      const oar = o.ar;
      addVocab({ de: gde, art: "-", ar: v.ar + " " + oar, en: inf + " " + (o.en || ""), level: v.level, cat: o.cat, type: "phrase" });
      made++;
    }
  });
})();
/* attr adj+noun phrases: der/die/das + adj-e + noun */
(function () {
  const rr = rng("adjphr");
  const adjs = vocab.filter((w) => w.type === "adj" && /^[a-zäöü]/.test(w.de) && w.de.length > 3).slice(0, 220);
  const nouns = shuffle(rr, vocab.filter((w) => w.type === "noun" && ["der", "die", "das"].includes(w.art))).slice(0, 1600);
  let made = 0;
  outer: for (const a of adjs) {
    for (const o of nouns) {
      if (made >= 6000) break outer;
      if (R() < 0.55) continue;
      const de = declArt(o.art, "N", false) + " " + a.de + "e " + o.de;
      if (vSeen.has(normDE(de) + "|phrase")) continue;
      const adjDef = /^(ال|غير|أكثر|أقل|ذو|ذات)/.test(a.ar) ? a.ar : "ال" + a.ar;
      addVocab({ de, art: "-", ar: o.ar + " " + adjDef, en: a.en + " " + (o.en || ""), level: "A1", cat: o.cat, type: "phrase" });
      made++;
    }
  }
  stats.adjPhrases = made;
})();
/* prep phrases from templates */
const PREPPHR = BIG.BIGPREP.concat([
  ["mit dem Bus", "بالحافلة", "transport"], ["mit dem Auto", "بالسيارة", "transport"], ["mit dem Fahrrad", "بالدراجة", "transport"],
  ["mit dem Zug", "بالقطار", "transport"], ["zu Fuß", "سيرًا على الأقدام", "transport"], ["mit Freunden", "مع الأصدقاء", "relationships"],
  ["bei meinen Eltern", "عند والديّ", "family"], ["beim Arzt", "عند الطبيب", "doctor"], ["in der Schule", "في المدرسة", "school"],
  ["in der Stadt", "في المدينة", "city"], ["auf dem Markt", "في السوق", "shopping"], ["im Supermarkt", "في السوبرماركت", "supermarket"],
  ["im Büro", "في المكتب", "work"], ["im Restaurant", "في المطعم", "restaurant"], ["im Hotel", "في الفندق", "hotel"],
  ["am Bahnhof", "في المحطة", "station"], ["im Krankenhaus", "في المستشفى", "hospital"], ["in der Apotheke", "في الصيدلية", "pharmacy"],
  ["im Park", "في المنتزه", "city"], ["in Berlin", "في برلين", "germany"], ["in Deutschland", "في ألمانيا", "germany"],
  ["nach Berlin", "إلى برلين", "travel"], ["nach Hause", "إلى البيت", "home"], ["zu Hause", "في البيت", "home"],
  ["zum Arzt", "إلى الطبيب", "doctor"], ["zur Schule", "إلى المدرسة", "school"], ["zur Arbeit", "إلى العمل", "work"],
  ["für die Familie", "للعائلة", "family"], ["ohne Zucker", "بدون سكر", "food"], ["gegen den Regen", "ضد المطر", "weather"],
  ["wegen des Wetters", "بسبب الطقس", "weather"], ["trotz des Regens", "رغم المطر", "weather"], ["während des Films", "أثناء الفيلم", "time"],
  ["seit einer Woche", "منذ أسبوع", "time"], ["vor dem Essen", "قبل الأكل", "food"], ["nach dem Essen", "بعد الأكل", "food"],
  ["zwischen den Stühlen", "بين الكراسي", "general"], ["neben der Tür", "بجانب الباب", "home"], ["hinter dem Haus", "خلف البيت", "home"],
  ["vor dem Haus", "أمام البيت", "home"], ["über der Stadt", "فوق المدينة", "city"],   ["unter dem Tisch", "تحت الطاولة", "home"]
]);
PREPPHR.forEach(([de, ar, cat]) => addVocab({ de, art: "-", ar, en: de, level: "A1", cat, type: "phrase" }));
/* PREPGEN: compositional prep + declined-article + noun phrases (case-safe via declArt).
   [prepDe, prepAr, prepEn, kase, cats, cap] — deterministic, deduped by addVocab. */
(function () {
  const pg = rng("prepgen-v1");
  const PREPGEN = [
    ["mit", "مع", "with", "D", ["family", "people", "relationships", "work", "school"], 500],
    ["bei", "عند", "at", "D", ["family", "doctor", "work", "school"], 400],
    ["für", "لـ", "for", "A", ["family", "people", "health", "school", "work"], 500],
    ["ohne", "بدون", "without", "A", ["food", "drinks", "health", "general"], 300],
    ["gegen", "ضد", "against", "A", ["health", "weather", "sports"], 200],
    ["durch", "عبر", "through", "A", ["city", "travel", "nature"], 250],
    ["um", "حول", "around", "A", ["city", "home", "time"], 250],
    ["entlang", "على طول", "along", "A", ["roads", "city", "nature"], 150],
    ["aus", "من", "from", "D", ["city", "germany", "food", "general"], 300],
    ["von", "من", "from", "D", ["people", "family", "city", "work"], 400],
    ["zu", "إلى", "to", "D", ["doctor", "school", "work", "family"], 350],
    ["nach", "إلى / بعد", "to/after", "D", ["travel", "city", "time", "food"], 300],
    ["vor", "قبل / أمام", "before/in front of", "D", ["time", "home", "school"], 300],
    ["hinter", "خلف", "behind", "D", ["home", "city"], 200],
    ["neben", "بجانب", "next to", "D", ["home", "people", "school"], 250],
    ["zwischen", "بين", "between", "D", ["people", "family", "general"], 200],
  ];
  let made = 0;
  PREPGEN.forEach(function ([prep, prepAr, prepEn, kase, cats, cap]) {
    const heads = vocab.filter((w) => w.type === "noun" && !w.head && !badHead(w, 12) && cats.indexOf(w.cat) >= 0 && ["der", "die", "das"].indexOf(w.art) >= 0 && !/ /.test(w.de));
    const order = shuffle(pg, heads);
    let n = 0;
    for (const h of order) {
      if (n >= cap) break;
      if (pg() < 0.35) continue;
      const art = kase === "G" ? declArt(h.art, "G", false) : declArt(h.art, kase, false);
      const de = prep + " " + art + " " + h.de;
      if (de.length > 42) continue;
      const before = vocab.length;
      addVocab({ de, art: "-", ar: prepAr + " " + h.ar, en: prepEn + " " + (h.en || h.de), level: h.level, cat: h.cat, type: "phrase" });
      if (vocab.length > before) { made++; n++; }
    }
  });
  stats.prepgen = made;
  /* PREPGEN-ACC: direction/motion (Wechselpräpositionen + Akkusativ) — core A1 contrast.
     in die Schule vs in der Schule. Always grammatical via declArt. */
  let madeA = 0;
  const PREPGENA = [
    ["in", "إلى", "into", ["school", "work", "city", "hotel", "restaurant", "hospital", "university"], 400],
    ["auf", "إلى / على", "onto", ["city", "travel", "nature", "sports"], 300],
    ["an", "إلى", "to", ["travel", "nature", "city", "station"], 300],
    ["über", "عبر / فوق", "over", ["city", "roads", "nature"], 200],
    ["unter", "تحت", "under", ["home", "city"], 150],
    ["vor", "أمام", "in front of", ["home", "school", "city"], 200],
    ["hinter", "خلف", "behind", ["home", "city"], 150],
    ["neben", "بجانب", "next to", ["home", "school"], 150],
    ["zwischen", "بين", "between", ["people", "home"], 120],
    ["um", "حول", "around", ["city", "home"], 150],
  ];
  PREPGENA.forEach(function ([prep, prepAr, prepEn, cats, cap]) {
    const heads = vocab.filter((w) => w.type === "noun" && !w.head && !badHead(w, 12) && cats.indexOf(w.cat) >= 0 && ["der", "die", "das"].indexOf(w.art) >= 0 && !/ /.test(w.de));
    const order = shuffle(pg, heads);
    let n = 0;
    for (const h of order) {
      if (n >= cap) break;
      if (pg() < 0.35) continue;
      const de = prep + " " + declArt(h.art, "A", false) + " " + h.de;
      if (de.length > 42) continue;
      const before = vocab.length;
      addVocab({ de, art: "-", ar: prepAr + " " + h.ar, en: prepEn + " " + (h.en || h.de), level: h.level, cat: h.cat, type: "phrase" });
      if (vocab.length > before) { madeA++; n++; }
    }
  });
  stats.prepgenAcc = madeA;
})();
/* XB-APPEND */
/* honest B1 leveling: professional/academic A2 items move to B1 (workplace,
   applications, university, formal services = B1 domains in the CEFR) */
(function () {
  const B1CATS = new Set(["profi", "applications", "interviews", "services", "university", "ausbildung", "worktalk", "banking", "documents"]);
  vocab.forEach((w) => { if (w.level === "A2" && B1CATS.has(w.cat)) w.level = "B1"; });
})();
stats.vocabTotal = vocab.length;
console.log("vocab built:", vocab.length, "(nounsBase=" + stats.nounsBase + " compounds→" + stats.afterCompounds + " verbs→" + stats.afterVerbs + " adj→" + stats.afterAdj + ")");
/* ---- stage-1 gate: vocab only ---- */
(function () {
  const gate = require("./content-quality-gate");
  const r = gate.validateDataset({ vocab, sentences: [], grammar: [], exercises: [], dialogues: [] });
  console.log("STAGE1 vocab gate: errors=" + r.errors.length + " warnings=" + r.warnings.length);
  r.errors.slice(0, 30).forEach((e) => console.log("  ERR " + e.id + " :: " + e.reason));
  const badIds = new Map();
  r.errors.forEach((e) => { if (!badIds.has(e.id)) badIds.set(e.id, e.reason); });
  for (let i = vocab.length - 1; i >= 0; i--) if (badIds.has(vocab[i].id)) { rej(vocab[i].id + " [" + vocab[i].de + "]", badIds.get(vocab[i].id)); vocab.splice(i, 1); }
  vSeen.clear(); vocab.forEach((w) => vSeen.set(normDE(w.de) + "|" + w.type, w.id));
  const r2 = gate.validateDataset({ vocab, sentences: [], grammar: [], exercises: [], dialogues: [] });
  console.log("STAGE1 after reject: vocab=" + vocab.length + " errors=" + r2.errors.length);
  if (r2.errors.length) { console.log("FATAL stage1"); process.exit(1); }
})();
fs.mkdirSync(path.join(__dirname, "clib", ".cache"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "clib", ".cache", "vocab.json"), JSON.stringify(vocab));
fs.writeFileSync(path.join(__dirname, "clib", ".cache", "rejected.json"), JSON.stringify(rejected, null, 1));
fs.writeFileSync(path.join(__dirname, "clib", ".cache", "merged.json"), JSON.stringify({ count: mergedLog.length, sample: mergedLog.slice(0, 50) }, null, 1));
console.log("stage1 ok, rejected-so-far:", rejected.length);
