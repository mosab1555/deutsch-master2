/* Deutsch Master — one-shot content hardening migration (2026-10-09).
   Applies the generator fixes from build-sentences.js (G1–G4) to the already
   generated .cache data, so shipped content matches what future builds emit.
   Rules (German text only; Arabic untouched):
     M1: "Es gibt / Gibt es" + definite article -> indefinite (einen/eine/ein,
         plural die+X -> einige+X). Object resolved via the row's vocab ref,
         so plural-vs-singular "die" is exact (pronoun "das" in
         "Gibt es das in Fisch?" is never touched).
     M2: mid-sentence closed-class determiners/possessives/pronouns are
         lowercased (Der->der after Wenn/Bevor/Nachdem/…, Mein->mein after
         verbs, …). Excludes Sie/Ihnen (formal-you ambiguity) and keeps
         segment-initial tokens. "Ihr"+lowercase-verb -> "ihr" (pronoun).
     M3: sentence-initial dative experiencer of wehtun capitalized
         (dem X tut … weh -> Dem X tut … weh).
     M4: "freut sich Sie" (formal-you, حضرتك) -> "freuen sich Sie".
   All four rules are strict 1:1 token substitutions, so derived exercise
   rows (gap/order prompts, choices, words) are migrated positionally and
   stay consistent (answer indices preserved).
   Run: node tools/migrate-content-fixes.js [--apply]  (default: dry-run)
*/
"use strict";
const fs = require("fs");
const path = require("path");
const APPLY = process.argv.includes("--apply");
const cache = path.join(__dirname, "clib", ".cache");
const load = (f) => JSON.parse(fs.readFileSync(path.join(cache, f), "utf8"));
const save = (f, o) => fs.writeFileSync(path.join(cache, f), JSON.stringify(o));

const vocab = load("vocab.json");
const vById = new Map(vocab.map((w) => [w.id, w]));
const sentences = load("sentences.json");
const exercises = load("exercises.json");
const reading = load("reading.json");
const listening = load("listening.json");
const dialogues = load("dialogues.json");

const stats = { m1: 0, m1skip: 0, m3: 0, m4: 0, m2tok: 0, exGap: 0, exOrder: 0, exChoiceFix: 0, readHits: 0, lisHits: 0, dlgHits: 0, skipped: [] };
// old full-sentence -> new full-sentence (M1/M3/M4), plus period-less variants
const sentMap = new Map();

function normPl(w) {
  if (!w || !w.plural || w.plural === "-") return null;
  return w.plural.replace(/^(der|die|das)\s/, "");
}
/* Global noun indexes. The Quality Gate guarantees duplicate-free German
   lemmas (0 duplicate-German errors), so lemma lookup is exact. Row vocab
   refs proved unreliable for these patterns (stale ids), hence global. */
const nouns = vocab.filter((w) => w.type === "noun");
const byLemma = new Map();
nouns.forEach((w) => { if (!byLemma.has(w.de)) byLemma.set(w.de, w); });
const byPlural = new Map();
nouns.forEach((w) => {
  const p = normPl(w);
  if (!p || p === w.de) return;
  if (!byPlural.has(p)) byPlural.set(p, []);
  byPlural.get(p).push(w);
});
/* Zero-plural lemmas (der Richter -> die Richter): invisible to byPlural. */
const zeroPl = new Set(nouns.filter((w) => normPl(w) === w.de).map((w) => w.de));
/* Compound-head index (longest suffix wins). German compounds inherit head
   gender/number: Museum+Ort(der)->der, Hunde+WC(das)->das,
   Kranken+haus+ärztinnen->plural. Needed because .cache/vocab.json is a
   newer snapshot than sentences.json (stage-1 rerun dropped some compounds;
   pre-existing pipeline drift): ~190 gibt-objects are ghost nouns. */
const headsByLen = nouns.slice().sort((a, b) => b.de.length - a.de.length);
function findHead(X) {
  const low = X.toLowerCase();
  for (const h of headsByLen) {
    if (h.de.length < 3) continue;
    if (X.length > h.de.length && (X.endsWith(h.de) || low.endsWith(h.de.toLowerCase()))) return h;
  }
  return null;
}

/* ---------- M1: es-gibt indefinite ---------- */
for (const s of sentences) {
  const m = s.de.match(/^(Es gibt|Gibt es) (den|die|das) ([A-ZÄÖÜ][\wäöüß-]*)(.*)$/);
  if (!m) continue;
  const [, head, art, noun, tail] = m;
  const lem = byLemma.get(noun) || null;
  const plurals = byPlural.get(noun) || [];
  let rep = null;
  if (art === "den") {
    // accusative-masculine slot by construction (akkPhrase declArt der->den)
    rep = "einen " + noun;
    if (lem && lem.art !== "der") stats.skipped.push(s.id + ": ANOMALY den+" + lem.art + " [" + noun + "]");
  } else if (art === "das") {
    // neuter slot by construction (nom/akk das)
    rep = "ein " + noun;
    if (lem && lem.art !== "das") stats.skipped.push(s.id + ": ANOMALY das+" + lem.art + " [" + noun + "]");
  } else if (art === "die") {
    const singFem = lem && lem.art === "die";
    if (singFem && normPl(lem) === lem.de) rep = "einige " + noun; // zero-plural (Spätzle)
    else if (singFem && plurals.length === 0) rep = "eine " + noun;
    else if (!singFem && plurals.length >= 1) rep = "einige " + noun;
    else if (lem && lem.art !== "die" && zeroPl.has(lem.de) && lem.de === noun) rep = "einige " + noun; // der Richter
    else if (singFem && plurals.length >= 1) {
      // genuinely ambiguous: break tie via row refs, else skip honestly
      const refSet = new Set(s.vocab || []);
      if (refSet.has(lem.id)) rep = "eine " + noun;
      else if (plurals.some((w) => refSet.has(w.id))) rep = "einige " + noun;
    } else if (!lem) {
      // ghost noun: resolve via compound head morphology
      const H = findHead(noun);
      if (H) {
        const pH = normPl(H);
        const endsPl = pH && pH !== H.de && noun.endsWith(pH);
        const endsSg = noun.endsWith(H.de);
        if (endsPl || (endsSg && pH === H.de)) rep = "einige " + noun;
        else if (endsSg && H.art === "die") rep = "eine " + noun;
      }
    }
  }
  if (!rep) { stats.m1skip++; stats.skipped.push(s.id + ": unresolvable [" + s.de.slice(0, 70) + "]"); continue; }
  const neu = head + " " + rep + tail;
  sentMap.set(s.de, neu);
  sentMap.set(s.de.replace(/[.?!…]$/, ""), neu.replace(/[.?!…]$/, ""));
  s.de = neu;
  stats.m1++;
}

/* ---------- helpers for M2/M3/M4 (regex, all German fields) ---------- */
const DECAP = ["Der", "Die", "Das", "Den", "Dem", "Des", "Mein", "Meine", "Meiner", "Meinen", "Meinem", "Meines", "Dein", "Deine", "Deiner", "Deinen", "Deinem", "Deines", "Sein", "Seine", "Seiner", "Seinen", "Seinem", "Seines", "Unsere", "Unseren", "Unserem", "Unserer", "Unseres", "Unser", "Kein", "Keine", "Keinen", "Keinem", "Keiner", "Keines", "Alle", "Alles", "Viele", "Beide", "Beides", "Jede", "Jeder", "Jedes", "Jedem", "Jeden", "Niemand", "Niemanden", "Keiner", "Man", "Wir", "Ich", "Du", "Er", "Es"];
const decapRe = new RegExp("\\b(" + DECAP.join("|") + ")\\b", "g");
// NOTE: fixText is applied per German field; segmentation splits on [.?!…«]
// boundaries so only segment-initial tokens keep their capitalization.
function fixText(t) {
  if (typeof t !== "string" || !t) return t;
  let out = t;
  // M3: segment-initial wehtun dative experiencer -> capitalize
  out = out.replace(/(^|[.!?…]\s+|«\s*)(dem|der)( \S+ tut [^.!?…]*?weh)/g, (m, pre, art, rest) => {
    stats.m3++;
    return pre + art.charAt(0).toUpperCase() + art.slice(1) + rest;
  });
  // M4: formal-you reflexive -> plural verb
  if (out.includes("freut sich Sie")) {
    const n = out.split("freut sich Sie").length - 1;
    stats.m4 += n;
    out = out.split("freut sich Sie").join("freuen sich Sie");
  }
  // M2: generalized decap per segment (segment-initial token keeps caps).
  // "Ihr" pronoun before a lowercase verb -> "ihr" (formal possessive Ihr +
  // noun is untouched; segment-initial Ihr is kept).
  const parts = out.split(/([.!?…]+\s*|«\s*)/);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(decapRe, (tok, p, off, str) => {
      if (/^\s*$/.test(str.slice(0, off))) return tok; // segment-initial: keep
      stats.m2tok++;
      return tok.charAt(0).toLowerCase() + tok.slice(1);
    });
    parts[i] = parts[i].replace(/(^|\s)Ihr (?=[a-zäöüß])/g, (m, pre) => {
      if (/^\s*$/.test(pre)) return m; // segment-initial: keep
      stats.m2tok++;
      return pre + "ihr ";
    });
  }
  out = parts.join("");
  return out;
}

/* ---------- apply M1 map to derived fields ---------- */
function applyMap(t) {
  if (typeof t !== "string" || !t) return t;
  let out = t;
  sentMap.forEach((neu, old) => {
    if (out.includes(old)) out = out.split(old).join(neu);
  });
  return out;
}

/* sentences: M1 already applied above; now M2/M3/M4 */
for (const s of sentences) s.de = fixText(s.de);

/* exercises */
for (const q of exercises) {
  if (typeof q.prompt === "string") {
    const mapped = applyMap(q.prompt);
    if (mapped !== q.prompt) { q.prompt = fixText(mapped); stats.exGap++; }
    else {
      const fixed = fixText(q.prompt);
      if (fixed !== q.prompt) { q.prompt = fixed; stats.exGap++; }
    }
  }
  if (Array.isArray(q.choices)) {
    q.choices = q.choices.map((c, ci) => {
      if (typeof c !== "string") return c;
      // answer-token surgery: keep stored answer index valid
      let nc = applyMap(c);
      nc = fixText(nc);
      if (nc !== c && ci === q.answer) stats.exChoiceFix++;
      return nc;
    });
  }
  if (Array.isArray(q.words)) {
    const mapped = q.words.map((w) => {
      const m2 = applyMap(w);
      return fixText(m2);
    });
    if (mapped.join("|") !== q.words.join("|")) { q.words = mapped; stats.exOrder++; }
  }
  if (Array.isArray(q.lines)) {
    q.lines.forEach((ln) => {
      if (Array.isArray(ln) && typeof ln[1] === "string") {
        const nc = fixText(applyMap(ln[1]));
        if (nc !== ln[1]) { ln[1] = nc; stats.exOrder++; }
      }
    });
  }
}

/* reading / listening / dialogues */
for (const r of reading) {
  if (typeof r.de === "string") {
    const nc = fixText(applyMap(r.de));
    if (nc !== r.de) { r.de = nc; stats.readHits++; }
  }
  if (typeof r.title === "string") {
    const nc = fixText(r.title);
    if (nc !== r.title) r.title = nc;
  }
  (r.questions || []).forEach((qq) => {
    if (typeof qq.q === "string") qq.q = fixText(applyMap(qq.q));
    if (Array.isArray(qq.choices)) qq.choices = qq.choices.map((c) => typeof c === "string" ? fixText(applyMap(c)) : c);
  });
}
for (const l of listening) {
  (l.lines || []).forEach((ln) => {
    if (Array.isArray(ln) && typeof ln[1] === "string") {
      const nc = fixText(applyMap(ln[1]));
      if (nc !== ln[1]) { ln[1] = nc; stats.lisHits++; }
    }
  });
  (l.questions || []).forEach((qq) => {
    if (typeof qq.q === "string") qq.q = fixText(applyMap(qq.q));
    if (Array.isArray(qq.choices)) qq.choices = qq.choices.map((c) => typeof c === "string" ? fixText(applyMap(c)) : c);
  });
}
for (const d of dialogues) {
  (d.lines || []).forEach((ln) => {
    if (Array.isArray(ln) && typeof ln[1] === "string") {
      const nc = fixText(applyMap(ln[1]));
      if (nc !== ln[1]) { ln[1] = nc; stats.dlgHits++; }
    }
  });
  if (typeof d.titleDe === "string") {
    const nc = fixText(d.titleDe);
    if (nc !== d.titleDe) d.titleDe = nc;
  }
}

console.log(JSON.stringify(stats, null, 1));
console.log("sentMap size:", sentMap.size / 2, "sentences (full+periodless keys)");
console.log(APPLY ? "APPLIED — writing caches" : "DRY RUN — no writes (use --apply)");
if (APPLY) {
  save("sentences.json", sentences);
  save("exercises.json", exercises);
  save("reading.json", reading);
  save("listening.json", listening);
  save("dialogues.json", dialogues);
  console.log("caches written");
}
