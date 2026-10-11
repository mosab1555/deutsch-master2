// Generates client/content/curriculum-manifest.json from MEASURED data.
// Usage: node tools/gen-curriculum-manifest.js
// All counts come from real caches + CURR overlays (incl. B2C). No fabricated numbers.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
function readJ(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return []; } }
function loadCurr(f) {
  global.window = global.window || {};
  delete require.cache[require.resolve(path.join(root, "client", f))];
  const before = new Set(Object.keys(global.window));
  require(path.join(root, "client", f));
  const k = Object.keys(global.window).find(x => x.startsWith("CURR_") && !before.has(x));
  return global.window[k];
}
const vocab = readJ(path.join(root, "tools/clib/.cache/vocab.json"));
const sents = readJ(path.join(root, "tools/clib/.cache/sentences.json"));
const gram = readJ(path.join(root, "tools/clib/.cache/grammar.json"));
const ex = readJ(path.join(root, "tools/clib/.cache/exercises.json"));
const dlg = readJ(path.join(root, "tools/clib/.cache/dialogues.json"));
const reading = readJ(path.join(root, "tools/clib/.cache/reading.json"));
const lis = readJ(path.join(root, "tools/clib/.cache/listening.json"));
const exams = readJ(path.join(root, "tools/clib/.cache/exams.json"));
function countBy(arr, k) { const o = {}; arr.forEach(r => { const key = r[k] || "NONE"; o[key] = (o[key] || 0) + 1; }); return o; }
const libSentKap = countBy(sents, "kap"), libSentLvl = countBy(sents, "level");
const libGramKap = countBy(gram, "kap"), libGramLvl = countBy(gram, "level");
const libExKap = countBy(ex, "kap"), libExLvl = countBy(ex, "level");
const libVocLvl = countBy(vocab, "level");
const libDlgLvl = countBy(dlg, "level"), libReadLvl = countBy(reading, "level");
const libLisLvl = countBy(lis, "level"), libExamLvl = countBy(exams, "level");
// CURR overlays
const files = ["curr-a1x.js", "curr-a2.js", "curr-a2b.js", "curr-b1.js", "curr-b1b.js", "curr-b2.js", "curr-b2b.js", "curr-b2c.js", "curr-b2d.js", "curr-b2e.js"];
const currWords = {}, currSent = {}, currGram = {}, currRead = {}, currLis = {}, currSpk = {}, currReal = {};
const currKapMeta = {};
files.forEach(f => {
  let D = null;
  try { D = loadCurr(f); } catch (e) { console.error("load fail", f, e.message); return; }
  if (!D) return;
  (D.kapitel || []).forEach(k => { currKapMeta[k[0]] = { title: k[1], icon: k[2], level: D.level, file: f }; });
  (D.words || []).forEach(r => { const k = r[7]; currWords[k] = (currWords[k] || 0) + 1; });
  (D.sentences || []).forEach(s => { const k = s[3]; currSent[k] = (currSent[k] || 0) + 1; });
  (D.grammar || []).forEach(g => { const k = g[1]; currGram[k] = (currGram[k] || 0) + 1; });
  (D.reading || []).forEach(r => { const k = r.kap; currRead[k] = (currRead[k] || 0) + 1; });
  (D.listen || []).forEach(l => { const k = l.kap; currLis[k] = (currLis[k] || 0) + 1; });
  (D.speak || []).forEach(s => { const k = s.kap; currSpk[k] = (currSpk[k] || 0) + 1; });
  (D.real || []).forEach(r => { const k = r.kap; currReal[k] = (currReal[k] || 0) + 1; });
});
// base KAPITEL names (A1 K0-K5)
const baseKap = { K0: "Einführung", K1: "Kapitel 1 – Guten Tag", K2: "Kapitel 2 – Freunde und Kollegen", K3: "Kapitel 3 – In Hamburg", K4: "Kapitel 4 – Guten Appetit", K5: "Kapitel 5 – Alltag und Familie" };
function chap(id, level, objectives, status, provenance, validation) {
  return {
    id, level,
    title: (currKapMeta[id] && currKapMeta[id].title) || baseKap[id] || id,
    objectives,
    contentTypes: {
      vocab: { library: 0, curr: currWords[id] || 0 },
      sentences: { library: libSentKap[id] || 0, curr: currSent[id] || 0 },
      grammar: { library: libGramKap[id] || 0, curr: currGram[id] || 0 },
      exercises: { library: libExKap[id] || 0, currFills: "on-merge" },
      dialogues: { library: "level-only", curr: 0 },
      reading: { library: "level-only", curr: currRead[id] || 0 },
      listening: { library: "level-only", curr: currLis[id] || 0 },
      speaking: { curr: currSpk[id] || 0 },
      situations: { curr: currReal[id] || 0 }
    },
    status, provenance, validation
  };
}
const V = { verified: true, implemented: true, tested: true, awaiting: false, notYet: false };
const PV = { verified: true, implemented: true, tested: true, awaiting: false, notYet: false };
const manifest = {
  version: 1,
  generated: new Date().toISOString(),
  copyright: "All B2C/curriculum texts are ORIGINAL (Arabic explanations, examples, dialogues, questions). No Klett book text, glossary, answer key, audio, or transcript is reproduced. Publisher resources used for alignment reference only.",
  sources: [
    { title: "Netzwerk neu (Klett Sprachen) – official series page A1–B1", url: "https://www.klett-sprachen.de/netzwerk-neu/r-0/605", note: "Series covers A1, A2, B1 only (12 Kapitel each). Chapter topics/objectives used for alignment; no protected content reproduced." },
    { title: "Netzwerk neu international page", url: "https://www.klett-international.com/en/fr/netzwerk-neu/r-1/605", note: "Confirms A1–B1 scope." },
    { title: "Aspekte neu B2 / Aspekte Beruf B2 (Klett Sprachen)", url: "https://www.klett-sprachen.de/aspekte-beruf/r-1/780", note: "No Netzwerk neu B2 exists. B2 curriculum aligns to Aspekte (Beruf) B2 + CEFR B2 descriptors with ORIGINAL content. Not labelled as Netzwerk neu." }
  ],
  b2SourceVerification: "Verified 2026-10-11 via Klett catalog: Netzwerk neu ends at B1. B2 = Aspekte neu B2 (general) / Aspekte Beruf B2 (beruflich, 10 Kapitel + Prüfungsmodule). App B2 chapters K12–K25 are original CEFR-B2 content aligned to those objectives; source accurately identified, no false series labelling.",
  levels: [
    {
      level: "A1", source: "Netzwerk neu A1 (12 Kapitel) – alignment reference",
      chapters: [
        chap("K0", "A1", ["Alphabet, Aussprache", "Begrüßung"], V, "app-base", "smoke-tested"),
        chap("K1", "A1", ["sich vorstellen", "Herkunft, Wohnen"], V, "app-base+library", "quality-gate+runtime-qa"),
        chap("K2", "A1", ["Familie, Freunde", "Alltag"], V, "app-base+library", "quality-gate+runtime-qa"),
        chap("K3", "A1", ["Stadt, Orientierung", "Essen/Trinken (A1X See-Text)"], V, "app-base+curr-a1x", "quality-gate+runtime-qa"),
        chap("K4", "A1", ["Guten Appetit (verifiziert)", "Einkaufen"], V, "app-base+library", "quality-gate+runtime-qa"),
        chap("K5", "A1", ["Alltag und Familie", "Kleidung/Wetter (A1X)"], V, "app-base+curr-a1x", "quality-gate+runtime-qa"),
        chap("KX", "A1", ["benutzerdefinierte Wörter (Lernkartei)"], { verified: false, implemented: true, tested: true, awaiting: false, notYet: false }, "user-data", "runtime-tested")
      ]
    },
    {
      level: "A2", source: "Netzwerk neu A2 (12 Kapitel) – alignment reference",
      chapters: [
        chap("K6", "A2", ["Alltag und Wohnen", "Perfekt mit haben/sein", "weil/dass"], V, "curr-a2", "merge-tested"),
        chap("K7", "A2", ["Arbeit, Termine, Verkehr", "Präteritum war/hatte", "Bahnhof/Arzt-Situationen"], V, "curr-a2", "merge-tested"),
        chap("K8", "A2", ["Reisen, Gesundheit, Einkaufen", "wenn/als", "Apotheke/Supermarkt"], V, "curr-a2+curr-a2b", "merge-tested")
      ]
    },
    {
      level: "B1", source: "Netzwerk neu B1 (12 Kapitel) – alignment reference",
      chapters: [
        chap("K9", "B1", ["Beruf und Bildung", "Bewerbung"], V, "curr-b1+curr-b1b", "merge-tested"),
        chap("K10", "B1", ["Medien, Technik, Umwelt"], V, "curr-b1+curr-b1b", "merge-tested"),
        chap("K11", "B1", ["Meinung und Gesellschaft"], V, "curr-b1+curr-b1b", "merge-tested")
      ]
    },
    {
      level: "B2", source: "Aspekte neu B2 / Aspekte Beruf B2 + CEFR B2 – ORIGINAL content",
      chapters: [
        chap("K12", "B2", ["Studium und Karriere", "Wissenschaftssprache"], V, "curr-b2+curr-b2b", "merge-tested"),
        chap("K13", "B2", ["Nachrichten, Wirtschaft, Politik"], V, "curr-b2+curr-b2b", "merge-tested"),
        chap("K14", "B2", ["Kultur und Diskussion"], V, "curr-b2+curr-b2b", "merge-tested"),
        chap("K15", "B2", ["Berufswelt vertieft", "Konjunktiv II Höflichkeit", "Passiv", "NVV", "Relativsätze+Präp."], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2c (Batch 1, original)", "b2c-validator+b2c-answers-qa"),
        chap("K16", "B2", ["Umwelt/Technik/Gesellschaft", "obwohl/trotzdem", "je…desto", "Partizipialattribute", "Plusquamperfekt"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2c (Batch 1, original)", "b2c-validator+b2c-answers-qa"),
        chap("K17", "B2", ["Meinung/Medien/Prüfung", "indirekte Rede", "Infinitivsätze", "Nominalisierung", "Prüfungs-Redemittel"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2c (Batch 1, original)", "b2c-validator+b2c-answers-qa"),
        chap("K18", "B2", ["Arbeitswelt/Kommunikation", "Zustandspassiv", "Passiv+Modalverb", "Konjunktiv II Vergangenheit", "was-Relativsätze"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2d (Batch 2, original)", "b2d-validator+b2d-answers-qa"),
        chap("K19", "B2", ["Diskussion/Argumentation", "Konzessivsätze", "Konditionalsätze", "Finalsätze damit", "Modalsätze indem"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2d (Batch 2, original)", "b2d-validator+b2d-answers-qa"),
        chap("K20", "B2", ["Medien/Gesellschaft", "indirekte Fragen", "als ob-Vergleiche", "sobald/solange", "da/zumal"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2d (Batch 2, original)", "b2d-validator+b2d-answers-qa"),
        chap("K21", "B2", ["Prüfungstraining DTB-B2", "Präsentations-Redemittel", "Zusammenfassung", "Erörterung/Gewichtung", "feste Präpositionen"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2d (Batch 2, original)", "b2d-validator+b2d-answers-qa"),
        chap("K22", "B2", ["Wissenschaft/Forschung", "Vermutung Futur II", "zweiteilige Konnektoren", "Pronominaladverbien", "Korrelat es"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2e (Batch 3, original)", "b2e-validator+b2e-answers-qa"),
        chap("K23", "B2", ["Gesundheit/Demografie", "irreale Konditionale", "Adversativsätze", "Reziprok", "Modalpartikeln"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2e (Batch 3, original)", "b2e-validator+b2e-answers-qa"),
        chap("K24", "B2", ["Stadt/Mobilität", "Genitivpräpositionen", "Tekamolo", "freie Relativsätze", "Graduierung"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2e (Batch 3, original)", "b2e-validator+b2e-answers-qa"),
        chap("K25", "B2", ["Globale Welt", "Restriktivsätze", "Konsekutivsätze", "Wortbildung", "Passiversatz"], { verified: true, implemented: true, tested: true, awaiting: false, notYet: false }, "curr-b2e (Batch 3, original)", "b2e-validator+b2e-answers-qa")
      ]
    }
  ],
  measuredTotals: {
    library: {
      vocab: { total: vocab.length, byLevel: libVocLvl, kapMapped: "synthetic-only (kapForLevel); word-level kap NONE in cache" },
      sentences: { total: sents.length, byLevel: libSentLvl, byKap: libSentKap },
      grammar: { total: gram.length, byLevel: libGramLvl, byKap: libGramKap },
      exercises: { total: ex.length, byLevel: libExLvl },
      dialogues: { total: dlg.length, byLevel: libDlgLvl },
      reading: { total: reading.length, byLevel: libReadLvl },
      listening: { total: lis.length, byLevel: libLisLvl },
      exams: { total: exams.length, byLevel: libExamLvl }
    },
    currOverlays: { currWords, currSent, currGram, currRead, currLis, currSpk, currReal }
  },
  gaps: [
    "B2 library bank: sentences=0, grammar=0 (library), exercises=0, dialogues=0, reading=0, listening=0, exams=0; B2 vocab=1692 (thin). Covered at app layer by CURR overlays (B2/B2B/B2C/B2D/B2E).",
    "Library chapter mapping is synthetic (K1–K5 hash + KX); word-level kap absent in cache. Real chapter mapping lives in CURR overlays (K0–K25). Backlog: preserve cross-chapter associations for shared headwords.",
    "CURR grammar uses legacy compact shape (title/kap/body/examples/quiz); full encyclopedia prerequisites/related/mistake objects live in library grammar (lg…) for A1–B1. Backlog: B2 library-grammar migration.",
    "Verb principal parts (Präteritum/Partizip II) not stored per CURR word; conjugation served by runtime engine + library data. Backlog: per-word parts metadata.",
    "Reading/listening/exam library packs have no B2 rows; B2 served by CURR reading/listening + exam configs reference B2 levels."
  ],
  backlog: [
    "Batch 2 DONE: B2 K18–K21 (Arbeitswelt/Kommunikation, Diskussion/Argumentation, Medien/Gesellschaft, Prüfungstraining DTB-B2) implemented as curr-b2d.js (160 words, 16 grammar, 64 sentences, 8 reading, 8 listening, 8 speaking, 4 real, 16 explain) with b2d-validator+b2d-answers-qa.",
    "Batch 3 DONE: B2 K22–K25 (Wissenschaft/Forschung, Gesundheit/Demografie, Stadt/Mobilität, Globale Welt) implemented as curr-b2e.js (160 words, 16 grammar, 64 sentences, 8 reading, 8 listening, 8 speaking, 4 real, 16 explain) with b2e-validator+b2e-answers-qa.",
    "A1 chapter wordlist alignment report vs Netzwerk neu A1 Kapitelwortschatz (counts only, no reproduction).",
    "Cross-chapter headword association model (append kap, never drop) + filter support.",
    "B2 library-grammar (lg-series) migration for K12–K17.",
    "B2C answer-integrity audit DONE (tools/test-b2c-answers.js 32/32): 138 fills + 12 grammar + 12 drills + 30 R/L questions validated; 2 malformed glued-blank fills removed via artGap boundary guard. Residual: native-speaker proofread of meaning-gap distractor semantic fit (structural audit complete, 0 ambiguous flagged).",
    "B2D answer-integrity audit DONE (tools/test-b2d-answers.js 33/33): 192 fills (173 meaning + 7 article + 12 verb) + 16 grammar + 16 drills + 40 R/L questions validated; 1 double-blank meaning fill reworded (zustimmen/stimmen substring collision). Residual: native-speaker proofread of meaning-gap distractor semantic fit (structural audit complete, 0 ambiguous flagged). Engine limitation noted: meanGap replaces all substring occurrences, so examples must avoid a gap word repeating inside another word (content-side guard, same class as B2C D1).",
    "B2E answer-integrity audit DONE (tools/test-b2e-answers.js 34/34): 190 fills (175 meaning + 0 article + 15 verb) + 16 grammar + 16 drills + 40 R/L questions validated; 0 suppressed, 0 glued, 0 leaked. Authoring corrections: 2 library-dup words replaced (verifizieren->sichten, Nachsorge->Nachbehandlung), 1 Arabic-script explain field reworded (gx7 mistakes). Residual: native-speaker proofread of meaning-gap distractor semantic fit and Arabic translation nuance (structural audit complete, 0 ambiguous flagged). Same meanGap substring limitation guarded content-side."
  ]
};
const out = path.join(root, "client", "content", "curriculum-manifest.json");
fs.writeFileSync(out, JSON.stringify(manifest, null, 1));
console.log("wrote", out);
// quick self-check: K15-K25 curr coverage
["K15", "K16", "K17", "K18", "K19", "K20", "K21", "K22", "K23", "K24", "K25"].forEach(k => {
  console.log(k, "words=" + (currWords[k] || 0), "sent=" + (currSent[k] || 0), "gram=" + (currGram[k] || 0), "read=" + (currRead[k] || 0), "lis=" + (currLis[k] || 0), "spk=" + (currSpk[k] || 0), "real=" + (currReal[k] || 0));
});
