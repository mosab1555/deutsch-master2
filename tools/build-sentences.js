/* Stage 2 — sentence builder. Deterministic, pool-driven, overrides for special patterns.
   Run: node tools/build-sentences.js  (reads clib/.cache/vocab.json) */
"use strict";
const fs = require("fs");
const path = require("path");
const { rng, pick, shuffle, normDE } = require("./clib/util");
const { SUBJ, TIMES, PLACES, VG_TRAN, VG_INTRAN, VG_DITRAN, VG_MODAL, PATS, STEMS } = require("./clib/sentgen");
const BIGS = require("./clib/bigsen");
const BIGP = require("./clib/bigsenp");
const gate = require("./content-quality-gate");

const vocab = JSON.parse(fs.readFileSync(path.join(__dirname, "clib", ".cache", "vocab.json"), "utf8"));
const byId = new Map(vocab.map((w) => [w.id, w]));
const rejected = JSON.parse(fs.readFileSync(path.join(__dirname, "clib", ".cache", "rejected.json"), "utf8")).filter((x) => x.id !== "sent-gen");
function rej(id, reason) { rejected.push({ id, reason }); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------- conjugation (same rules as stage 1) ---------- */
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
  if (MODALS[inf]) { const m = MODALS[inf]; const r = { ich: m[0], du: m[1], er: m[2], wir: inf, ihr: inf + "t", sie: inf }; return r[person]; }
  const stem = inf.replace(/en$/, "");
  /* -eln/-ern keep e (bummelt); -Cnen/-Cmen after obstruents keeps e (öffnet, atmet),
     but -rnen/-lnen/-hnen/-enen drop it (lernt, wohnt, gähnt, dient) */
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
  // returns {core, tail} — core conjugated stem, tail separable prefix with leading space
  const sp = splitSep(inf);
  if (sp) return { core: conjCore(sp.stem, cperson), tail: " " + sp.pref };
  return { core: conjCore(inf, cperson), tail: "" };
}
function participleOf(inf) {
  const c = inf.startsWith("sich ") ? inf.slice(5) : inf;
  const vw = vocab.find((w) => w.type === "verb" && w.de.replace(/^sich /, "") === c);
  if (vw && vw.parts && vw.parts.includes(",")) return vw.parts.split(",")[1];
  const sp = splitSep(c);
  const mk = (s) => "ge" + s.replace(/en$/, "") + "t";
  if (sp) return sp.pref + mk(sp.stem).replace(/^ge/, "");
  if (/^(be|ver|er|ent|emp|miss|zer|ge)/.test(c)) return c.replace(/en$/, "") + "t";
  return mk(c);
}
function auxOf(inf) {
  const c = inf.replace(/^sich /, "");
  // inseparable sein-verbs (no prefix stripping applies to them)
  if (c === "entkommen" || c === "verschwinden" || c === "verreisen") return "sein";
  const sp = splitSep(c);
  const base = sp ? c.slice(sp.pref.length) : c;
  if (/^(gehen|kommen|fahren|laufen|fliegen|reisen|verreisen|steigen|schwimmen|wandern|fallen|fliehen|eilen|rennen|klettern|stolpern|reiten|segeln|tauchen|joggen|spazieren|bummeln|bleiben|sein|werden|passieren|gelingen|scheinen|wachsen|aufblühen|aufwachsen)$/.test(base)) return "sein";
  // full prefixed forms whose base alone takes haben
  if (/^(aufstehen|einschlafen|aufwachen|ankommen|abfahren|einsteigen|aussteigen|umsteigen|mitkommen|zurückkommen|zurückkehren|zurückfliegen|heimfahren|losfahren|fortfahren|weiterfahren|weiterfliegen|wegfliegen|anreisen|abreisen|durchreisen|weiterreisen|auswandern|einwandern|zuwandern|abwandern|umziehen|einziehen|ausziehen|vergehen|einbrechen|ausbrechen|zusammenbrechen|aufbrechen|durchbrechen)$/.test(c)) return "sein";
  return "haben";
}
function arVerb(base, cperson, fem, pl) {
  const rawStem = base.replace(/^ي/, "");
  const stem = rawStem;
  const defective = /ى$/.test(rawStem);
  const dstem = defective ? rawStem.slice(0, -1) : rawStem;
  if (cperson === "ich") return "أ" + stem;
  if (cperson === "wir") return "ن" + stem;
  if (cperson === "du" || cperson === "ihr") return "ت" + stem + (cperson === "ihr" ? "ون" : "");
  if (cperson === "sie") {
    if (pl === "dual") return (fem ? "ت" + stem + "ان" : "ي" + stem + "ان");
    if (pl === "pl") return "ي" + dstem + "ون";
    return fem === "pl" ? "ي" + stem + "ون" : "ت" + stem;
  }
  return (fem ? "ت" + stem : "ي" + stem);
}
/* name gender heuristic for adjective agreement (fem names end ة/ى or in list) */
const FEMNAMES = new Set(["Mona", "Sara", "Layla", "Fatima", "Dina", "Heba", "Lena", "Emma", "Marie", "Nour", "Anna"]);
function nameFem(n) { return FEMNAMES.has(n[0]) || /[ةى]$/.test(n[1]) ? true : false; }
/* dative-person Arabic suffixes for wehtun */
const DATSUF = { "mir": "ني", "dir": "ك", "ihm": "ه", "ihr": "ها", "uns": "نا", "Ihnen": "كم" };
const DUAL_SUBJ = new Set(["Meine Eltern", "Meine Großeltern", "Die Zwillinge", "Beide", "Das Paar"]);
function plurality(S) { if (!S) return null; if (S[2] === "siepl" || S[2] === "wir" || S[2] === "ihr") return S[2] === "siepl" && DUAL_SUBJ.has(S[0]) ? "dual" : "pl"; return null; }
/* infinitive Arabic with full subject agreement (أن يعملوا / أن تعمل / أن أعمل) */
function arInfPl(base, S) {
  const stem = base.replace(/^[يأت]/, "");
  const defective = /ى$/.test(stem);
  const dstem = defective ? stem.slice(0, -1) : stem;
  const cp = CKEY[cpersonFull(S)], fem = subjFem(S), pl = plurality(S);
  if (cp === "ich") return "أ" + stem;
  if (cp === "wir") return "ن" + stem;
  if (cp === "du" || cp === "ihr") return "ت" + stem + (cp === "ihr" ? "ون" : "");
  if (pl === "pl") return "ي" + dstem + "ون";
  if (pl === "dual") return (fem ? "ت" + stem + "ان" : "ي" + stem + "ان");
  if (cp === "sie" || fem) return "ت" + stem;
  return base;
}
/* mid-sentence subject: lowercase first letter (formal Sie stays capitalized) */
function lowS(S) { if (!S) return ""; if (S[2] === "Sie") return S[0]; return S[0].charAt(0).toLowerCase() + S[0].slice(1); }
/* predicative adjective agreement with a German-gendered object (heuristic:
   der/das -> base masculine, die -> feminine; plural -> sound plural) */
function adjAgr(base, art, isPl) {
  if (isPl) {
    if (/ة$/.test(base)) return base.replace(/ة$/, "ات");
    if (/ى$|اء$|ين$|ون$/.test(base)) return base;
    return art === "die" ? base + "ات" : base + "ون";
  }
  if (art !== "die" || /ة$/.test(base) || /ى$|اء$|ين$|ون$/.test(base)) return base;
  return base + "ة";
}
/* plural Arabic gloss for plural German objects (regular feminine only; else singular) */
function arPlObj(ar) {
  const base = String(ar).split("/")[0].trim();
  if (/ة$/.test(base)) return base.replace(/ة$/, "ات");
  return ar;
}
/* قادم agreement with subject */
function qadmAr(S) {
  const fem = subjFem(S), pl = plurality(S);
  if (pl === "pl") return "قادمون";
  if (pl === "dual") return fem ? "قادمتان" : "قادمان";
  return fem ? "قادمة" : "قادم";
}
/* راض agreement with subject (defective morphology, explicit) */
function zufriedenAr(S) {
  const fem = subjFem(S), pl = plurality(S);
  if (pl === "pl") return "راضون";
  if (pl === "dual") return fem ? "راضيتان" : "راضيان";
  return fem ? "راضية" : "راضٍ";
}
/* sick/tired adjective agreement for subordinate subjects */
function sickAr(S) {
  const fem = subjFem(S), pl = plurality(S);
  if (pl === "pl") return "مرضى";
  if (pl === "dual") return fem ? "مريضتان" : "مريضان";
  return fem ? "مريضة" : "مريض";
}
function muedeAr(S) {
  const fem = subjFem(S), pl = plurality(S);
  if (pl === "pl") return "متعبون";
  if (pl === "dual") return fem ? "متعبتان" : "متعبان";
  return fem ? "متعبة" : "متعب";
}
function arPast(base, fem) {
  if (!fem) return base;
  if (/ت$/.test(base)) return base;
  return base + "ت";
}
function arAdj(base, fem, pl) {
  if (!fem || /ة$/.test(base) || /ى$|اء$/.test(base)) {
    if (pl === "pl" && !/ة$/.test(base) && !/ى$|اء$/.test(base)) return base + "ون";
    if (pl === "dual") return base + "ان";
    return base;
  }
  if (pl === "pl") return base.replace(/ة$/, "") + "ات";
  if (pl === "dual") return base.replace(/ة$/, "") + "تان";
  return base + "ة";
}
/* articles */
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
function genForm(w) {
  if (w.art === "die") return { de: "der " + w.de, ar: w.ar };
  const suf = /[sßxz]$|sch$|ch$/.test(w.de) ? "es" : "s";
  return { de: "des " + w.de + suf, ar: w.ar };
}
function pluralDat(w) {
  const pl = w.plural === "-" ? w.de : /^(der|die|das)\s/.test(w.plural) ? w.plural.replace(/^(der|die|das)\s/, "") : w.plural;
  const withN = /[ns]$/.test(pl) ? pl : pl + "n";
  return withN;
}

/* ---------- pools ---------- */
const nouns = vocab.filter((w) => w.type === "noun" && ["der", "die", "das"].includes(w.art));
const verbs = vocab.filter((w) => w.type === "verb");
const adjs = vocab.filter((w) => w.type === "adj");
const FEMSUB = { "Meine Schwester": 1, "Meine Freundin": 1, "Meine Mutter": 1, "Die Ärztin": 1, "Die Nachbarin": 1, "Die Chefin": 1, "Sie|she": 1 };
function subjFem(S) { return /Schwester|Freundin|Mutter|Ärztin|Nachbarin|Chefin|Tante|Cousine|Enkelin|Schwiegertochter|Braut|Verkäuferin|Polizistin|Studentin|Schülerin|Kellnerin|Köchin|Friseurin|Kundin|Touristin|Rentnerin|Lehrerin|Sekretärin|Apothekerin|Hebamme|Krankenschwester|Dame|Katze|^Sie$/.test(S[0]) && S[2] !== "siepl" ? true : false; }
function cpersonOf(S) {
  const k = S[2];
  if (k === "ich" || k === "du" || k === "wir" || k === "ihr") return k;
  return "er"; // er/sie/es/Sie -> 3sg stem; siepl -> sie
}
function cpersonFull(S) {
  const k = S[2];
  if (k === "siepl") return "sie";
  if (k === "ich" || k === "du" || k === "wir" || k === "ihr") return k;
  // hardening 2026-10-09: formal Sie governs 3rd-plural verbs (Sie sagen),
  // not 3rd-singular (she says). Arabic agreement paths are unaffected
  // (verified: identical output for cp sie vs er given fem/siepl flags).
  if (k === "Sie") return "sie";
  return "er";
}
const CKEY = { ich: "ich", du: "du", er: "er", wir: "wir", ihr: "ihr", sie: "sie" };
const PERSON_CATS = ["family", "people", "relationships", "jobs", "profi"];
const PERSON_NOUNS = nouns.filter((w) => PERSON_CATS.includes(w.cat));
const THING_NOUNS = nouns.filter((w) => !["family", "people", "relationships"].includes(w.cat));
const BODY = nouns.filter((w) => w.cat === "body");
const MASC = nouns.filter((w) => w.art === "der");

const PERFV = [["lernen", "gelernt", "تعلم"], ["essen", "gegessen", "أكل"], ["trinken", "getrunken", "شرب"], ["sehen", "gesehen", "رأى"], ["lesen", "gelesen", "قرأ"], ["schreiben", "geschrieben", "كتب"], ["kommen", "gekommen", "أتى"], ["gehen", "gegangen", "ذهب"], ["fahren", "gefahren", "سافر"], ["kaufen", "gekauft", "اشترى"], ["machen", "gemacht", "فعل"], ["spielen", "gespielt", "لعب"], ["arbeiten", "gearbeitet", "عمل"], ["schlafen", "geschlafen", "نام"], ["aufstehen", "aufgestanden", "نهض"], ["anrufen", "angerufen", "اتصل"], ["einkaufen", "eingekauft", "تسوق"], ["bleiben", "geblieben", "بقي"], ["werden", "geworden", "أصبح"], ["haben", "gehabt", "امتلك"], ["sein", "gewesen", "كان"], ["treffen", "getroffen", "قابل"], ["finden", "gefunden", "وجد"], ["verlieren", "verloren", "فقد"], ["gewinnen", "gewonnen", "فاز"], ["beginnen", "begonnen", "بدأ"], ["empfehlen", "empfohlen", "أوصى"], ["vergessen", "vergessen", "نسي"], ["verstehen", "verstanden", "فهم"], ["versprechen", "versprochen", "وعد"], ["entscheiden", "entschieden", "قرر"], ["erklären", "erklärt", "شرح"], ["fragen", "gefragt", "سأل"], ["antworten", "geantwortet", "أجاب"], ["sagen", "gesagt", "قال"], ["erzählen", "erzählt", "روى"], ["bestellen", "bestellt", "طلب"], ["bezahlen", "bezahlt", "دفع"], ["verkaufen", "verkauft", "باع"], ["reparieren", "repariert", "أصلح"], ["öffnen", "geöffnet", "فتح"], ["schließen", "geschlossen", "أغلق"], ["waschen", "gewaschen", "غسل"], ["kochen", "gekocht", "طبخ"], ["backen", "gebacken", "خبز"], ["schneiden", "geschnitten", "قطع"], ["probieren", "probiert", "جرب"], ["reservieren", "reserviert", "حجز"], ["buchen", "gebucht", "حجز"], ["reisen", "gereist", "سافر"], ["warten", "gewartet", "انتظر"], ["lachen", "gelacht", "ضحك"], ["weinen", "geweint", "بكى"], ["helfen", "geholfen", "ساعد"], ["geben", "gegeben", "أعطى"], ["nehmen", "genommen", "أخذ"], ["bringen", "gebracht", "أحضر"], ["denken", "gedacht", "فكر"], ["kennen", "gekannt", "عرف"], ["wissen", "gewusst", "علم"]];
const PASSV = [["bauen", "gebaut", "يُبنى", "بُني"], ["machen", "gemacht", "يُفعَل", "فُعِل"], ["lesen", "gelesen", "يُقرأ", "قُرئ"], ["schreiben", "geschrieben", "يُكتَب", "كُتِب"], ["verkaufen", "verkauft", "يُباع", "بيع"], ["kaufen", "gekauft", "يُشترى", "اشتُري"], ["öffnen", "geöffnet", "يُفتَح", "فُتِح"], ["schließen", "geschlossen", "يُغلَق", "أُغلِق"], ["reparieren", "repariert", "يُصلَّح", "أُصلِح"], ["kochen", "gekocht", "يُطبَخ", "طُبِخ"], ["bestellen", "bestellt", "يُطلَب", "طُلِب"], ["bezahlen", "bezahlt", "يُدفَع", "دُفِع"], ["finden", "gefunden", "يُوجَد", "وُجِد"], ["verlieren", "verloren", "يُفقَد", "فُقِد"], ["benutzen", "benutzt", "يُستخدَم", "استُخدِم"], ["sprechen", "gesprochen", "يُتحَدَّث", "تُحُدِّث"], ["einladen", "eingeladen", "يُدعَى", "دُعِي"], ["untersuchen", "untersucht", "يُفحَص", "فُحِص"], ["fragen", "gefragt", "يُسأَل", "سُئِل"], ["sagen", "gesagt", "يُقال", "قيل"], ["zeigen", "gezeigt", "يُعرَض", "عُرِض"], ["erklären", "erklärt", "يُشرَح", "شُرِح"], ["putzen", "geputzt", "يُنظَّف", "نُظِّف"], ["waschen", "gewaschen", "يُغسَل", "غُسِل"], ["liefern", "geliefert", "يُوصَل", "أُوصِل"]];
const IMPV = [["trinken", "Trink", "اشرب"], ["kommen", "Komm", "تعال"], ["gehen", "Geh", "اذهب"], ["essen", "Iss", "كُل"], ["nehmen", "Nimm", "خُذ"], ["machen", "Mach", "افعل"], ["lesen", "Lies", "اقرأ"], ["schreiben", "Schreib", "اكتب"], ["öffnen", "Öffne", "افتح"], ["schließen", "Schließ", "أغلق"], ["warten", "Warte", "انتظر"], ["hören", "Hör", "اسمع"], ["schauen", "Schau", "انظر"], ["helfen", "Hilf", "ساعد"], ["bleiben", "Bleib", "ابقَ"], ["geben", "Gib", "أعطِ"], ["sehen", "Sieh", "انظر"], ["sprechen", "Sprich", "تحدث"], ["fragen", "Frag", "اسأل"], ["antworten", "Antworte", "أجب"], ["fahren", "Fahr", "سِر"], ["laufen", "Lauf", "اركض"], ["schlafen", "Schlaf", "نَم"], ["arbeiten", "Arbeite", "اعمل"], ["lernen", "Lerne", "تعلم"], ["üben", "Übe", "تدرب"], ["putzen", "Putze", "نظف"], ["kochen", "Koche", "اطبخ"], ["probieren", "Probiere", "جرب"]];
const MODAL_AR = { "können": "يستطيع", "müssen": "يجب على", "dürfen": "يُسمح لـ", "sollen": "ينبغي على", "wollen": "يريد", "möchten": "يود" };
const COMP_AR = { "gut": "أفضل", "schlecht": "أسوأ", "groß": "أكبر", "klein": "أصغر", "neu": "أحدث", "alt": "أقدم", "jung": "أصغر سنًا", "schnell": "أسرع", "langsam": "أبطأ", "lang": "أطول", "kurz": "أقصر", "hoch": "أعلى", "teuer": "أغلى", "billig": "أرخص", "reich": "أغنى", "arm": "أفقر", "schön": "أجمل", "nett": "ألطف", "freundlich": "ألطف", "höflich": "أكثر تهذيبًا", "pünktlich": "أدق", "fleißig": "أكثر اجتهادًا", "klug": "أذكى", "wichtig": "أهم", "richtig": "أصح", "einfach": "أبسط", "modern": "أحدث", "bekannt": "أشهر", "zufrieden": "أكثر رضا", "glücklich": "أسعد", "traurig": "أحزن", "lustig": "أضحك", "ruhig": "أهدأ", "laut": "أعلى صوتًا", "leise": "أخفض", "hell": "أفتح", "dunkel": "أدكن", "warm": "أدفأ", "kalt": "أبرد", "sauber": "أنظف", "schmutzig": "أقذر", "leer": "أفرغ", "offen": "أكثر انفتاحًا", "frei": "أحر", "normal": "أكثر اعتيادًا", "interessant": "أكثر إثارة", "langweilig": "أكثر مللًا", "spannend": "أكثر تشويقًا", "müde": "أكثر تعبًا", "krank": "أكثر مرضًا", "gesund": "أكثر صحة", "hungrig": "أكثر جوعًا", "sicher": "أكثر أمانًا", "stark": "أقوى", "schwach": "أضعف", "schwer": "أثقل", "leicht": "أخف" };
const N_ACT = [["Lernen", "التعلم"], ["Kochen", "الطبخ"], ["Einkaufen", "التسوق"], ["Aufräumen", "الترتيب"], ["Umzug", "الانتقال"], ["Putzen", "التنظيف"]];
const N_ANLASS = [["Geburtstag", "عيد الميلاد"], ["Erfolg", "النجاح"], ["Umzug", "الانتقال"], ["Job", "الوظيفة"]];
const N_WUNSCH = [["Glück", "الحظ"], ["Erfolg", "النجاح"], ["Spaß", "المتعة"], ["Geld", "المال"], ["Zeit", "الوقت"]];
const P_AB = [["Bahnhof", "المحطة"], ["Arzt", "الطبيب"], ["Markt", "السوق"], ["Flughafen", "المطار"]];
const P_CITY = [["Berlin", "برلين"], ["Hamburg", "هامبورغ"], ["München", "ميونخ"], ["Kairo", "القاهرة"], ["Paris", "باريس"], ["Wien", "فيينا"], ["Istanbul", "إسطنبول"], ["Alexandria", "الإسكندرية"]];
const T_DAUER = [["einem Jahr", "سنة"], ["einer Woche", "أسبوع"], ["drei Tagen", "3 أيام"], ["einem Monat", "شهر"], ["zwei Stunden", "ساعتين"]];
const ZU_INF = [["Deutsch zu lernen", "أن يتعلم الألمانية"], ["pünktlich zu sein", "أن يكون دقيقًا"], ["viel zu üben", "أن يتدرب كثيرًا"], ["früh aufzustehen", "أن ينهض مبكرًا"], ["anderen zu helfen", "أن يساعد الآخرين"], ["jeden Tag zu lesen", "أن يقرأ يوميًا"], ["Sport zu machen", "أن يمارس الرياضة"], ["gesund zu essen", "أن يأكل صحيًا"]];
const WIE_POOL = [["das Wetter", "الطقس"], ["das Essen", "الطعام"], ["der Film", "الفيلم"], ["das Hotel", "الفندق"], ["der Kurs", "الدورة"]];
const WO_POOL = [["der Bahnhof", "المحطة"], ["der Supermarkt", "السوبرماركت"], ["der Arzt", "الطبيب"], ["die Toilette", "الحمام"], ["der Markt", "السوق"]];
const S3_POOL = [["dich", "عليك"], ["euch", "عليكم"], ["Sie", "عليكم"], ["ihn", "عليه"], ["sie", "عليها"]];
const S3_DAT = [["mir", "لي"], ["dir", "لك"], ["ihm", "له"], ["ihr", "لها"], ["uns", "لنا"], ["Ihnen", "لك"]];
const NAMES = [["Ahmed", "أحمد"], ["Mona", "منى"], ["Jonas", "يونس"], ["Sara", "سارة"], ["Omar", "عمر"], ["Anna", "آنا"]];
const O_PREIS = [["3 Euro", "3 يورو"], ["5 Euro", "5 يورو"], ["10 Euro", "10 يورو"], ["2 Euro", "2 يورو"]];
const O_ZAHL = [["mit Karte", "بالبطاقة"], ["bar", "نقدًا"], ["mit dem Handy", "بالهاتف"]];
const ADV_DE = [["gut", "جيدًا"], ["schnell", "بسرعة"], ["langsam", "ببطء"], ["fließend", "بطلاقة"], ["deutlich", "بوضوح"], ["ein bisschen", "قليلًا"]];
const LASSEN_PAIRS = [[["Auto", "das Auto", "السيارة"], ["reparieren", "يصلحه"]], [[ "Fahrrad", "das Fahrrad", "الدراجة"], ["reparieren", "يصلحها"]], [["Handy", "das Handy", "الهاتف"], ["reparieren", "يصلحه"]], [["Wohnung", "die Wohnung", "الشقة"], ["reinigen", "ينظفها"]], [["Anzug", "der Anzug", "البدلة"], ["reinigen", "ينظفها"]]];
/* arabic fallback for verbs used in overrides but absent from vocab/VG pools */
const AR_FB = { "besuchen": "يزور", "nennen": "يسمي", "danken": "يشكر", "vorstellen": "يقدم", "begleiten": "يرافق", "gehen": "يذهب", "zahlen": "يدفع", "informieren": "يستعلم", "beschweren": "يشتكي", "zeigen": "يُري", "kümmern": "يعتني", "bewerben": "يتقدم", "wünschen": "يتمنى", "fahren": "يسافر" };

/* extra present stems (e->i / a->ä classes missing from base table) */
Object.assign(STEMS, {
  "bewerben": ["bewirbst", "bewirbt"], "werben": ["wirbst", "wirbt"], "laden": ["lädst", "lädt"],
  "raten": ["rätst", "rät"], "braten": ["brätst", "brät"], "wachsen": ["wächst", "wächst"],
  "empfehlen": ["empfiehlst", "empfiehlt"], "empfangen": ["empfängst", "empfängt"],
  "stehlen": ["stiehlt", "stiehlt"], "befehlen": ["befiehlst", "befiehlt"], "gebären": ["gebierst", "gebiert"],
});
function isSepInf(inf) { return !!splitSep(inf.replace(/^sich /, "")); }
/* pool expansion (additive; deterministic order preserved) */
SUBJ.push(...BIGS.BIGSUBJ);
TIMES.push(...BIGS.BIGTIMES);
PLACES.push(...BIGS.BIGPLACES);
VG_TRAN[0].push(...BIGS.BIGTRAN1);
VG_TRAN[1].push(...BIGS.BIGTRAN2);
VG_INTRAN[0].push(...BIGS.BIGINTRAN1);
VG_INTRAN[1].push(...BIGS.BIGINTRAN2);
VG_DITRAN[0].push(...BIGS.BIGDITRAN);
Object.assign(STEMS, BIGS.BIGSTEMS);
NAMES.push(...BIGS.BIGNAMES);
ADV_DE.push(...BIGS.BIGADV);
ZU_INF.push(...BIGS.BIGZU);
WIE_POOL.push(...BIGS.BIGWIE);
WO_POOL.push(...BIGS.BIGWO);
IMPV.push(...BIGS.BIGIMPV);
PATS.push(...BIGP.BIGPATS);
/* tripwire: stem-changing verbs MUST have STEMS coverage (else du/er forms break).
   Separable verbs are safe (filtered from conjugated slots; trennbar uses stems). */
(function () {
  const NEED_STEM = new Set(["messen", "lassen", "verlassen", "fressen", "saufen", "geschehen", "verderben", "gebären"]);
  const stemOK = new Set(Object.keys(STEMS));
  [VG_TRAN[0], VG_TRAN[1], VG_INTRAN[0], VG_INTRAN[1], VG_DITRAN[0]].forEach((g) => {
    for (let i = g.length - 1; i >= 0; i--) {
      const inf = g[i][0];
      if (isSepInf(inf)) continue;
      if (NEED_STEM.has(inf) && !stemOK.has(inf)) { rej("pool:" + inf, "stem-changing verb without STEMS cover, dropped"); g.splice(i, 1); }
    }
  });
})();
/* PERFV auto-extension: verified participles (curated parts) + hand-checked past Arabic */
(function () {
  const pmap = new Map();
  verbs.forEach((w) => {
    const inf = w.de.replace(/^sich /, "");
    if (/^sich /.test(w.de)) return; // reflexive needs pronoun handling
    if (!w.parts || w.parts.indexOf(",") < 0) return;
    const pp = w.parts.split(",")[1].trim();
    if (!pp || pp === "-") return;
    pmap.set(inf, pp);
  });
  Object.keys(BIGS.BIGPERFV_AR).forEach((inf) => {
    if (pmap.has(inf) && !PERFV.some(([i]) => i === inf)) PERFV.push([inf, pmap.get(inf), BIGS.BIGPERFV_AR[inf]]);
  });
})();
/* verb pools by valency (infinitive + ar base) */
function poolRaw(group) {
  if (group === 0) return VG_TRAN[0].concat(VG_TRAN[1]);
  if (group === 1) return VG_INTRAN[0].concat(VG_INTRAN[1]);
  if (group === 2) return VG_DITRAN[0];
  return VG_MODAL[0];
}
/* conjugated slots must never use separable verbs (word-order breakage) */
function poolOf(group) { return poolRaw(group).filter(([i]) => !isSepInf(i)); }
function poolInf(group) { return poolRaw(group); } // infinitive slots may use any verb
/* transitive-only PERFV picker for object patterns (intransitive PPs + object = broken).
   Built lazily so expanded pools are included. */
let TRANS_OK = null;
function transOk() {
  if (!TRANS_OK) TRANS_OK = new Set(VG_TRAN[0].concat(VG_TRAN[1]).map(([i]) => i).concat(["essen", "trinken", "sehen", "lesen", "schreiben", "kaufen", "haben", "finden", "verlieren", "gewinnen", "vergessen", "empfehlen", "geben", "nehmen", "bringen", "bestellen", "bezahlen", "verkaufen", "reparieren", "öffnen", "schließen", "waschen", "kochen", "backen", "schneiden", "probieren", "reservieren", "buchen"]));
  return TRANS_OK;
}
function pickTransPv(rr) {
  const ok = transOk();
  for (let k = 0; k < 20; k++) { const pv = pickN(rr, PERFV); if (ok.has(pv[0])) return pv; }
  return pickN(rr, PERFV);
}
/* verb-aware object pools: person-verbs take persons, picky verbs take fitted
   categories/allowlists, everything else takes any non-country thing */
const PERSON_SET = new Set(BIGS.PERSON_V.map(([i]) => i));
function thingPoolFor(inf) {
  const base = () => THING_NOUNS.filter((w) => w.cat !== "germany");
  const nopeople = (arr) => arr.filter((w) => PERSON_CATS.indexOf(w.cat) < 0);
  if (!inf) return base();
  if (PERSON_SET.has(inf)) return PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS;
  const rule = BIGS.OBJCATS[inf];
  if (!rule) return base();
  if (rule.person) return PERSON_NOUNS.length ? PERSON_NOUNS : base();
  let pool = [];
  if (rule.cats) pool = pool.concat(THING_NOUNS.filter((w) => rule.cats.indexOf(w.cat) >= 0));
  if (rule.allow) pool = pool.concat(nouns.filter((w) => rule.allow.indexOf(w.de) >= 0));
  if (rule.nopeople) pool = nopeople(pool.length ? pool : base());
  const ded = [...new Map(pool.map((w) => [w.id, w])).values()];
  return ded.length ? ded : THING_NOUNS;
}
/* ---------- subject-aware helpers ---------- */
function C2(inf, who) { const c = conjPresent(inf, CKEY[cpersonFull(who)]); return c.core + c.tail; }
function AR2(inf, who) { return arVerb(verbArOf(inf), CKEY[cpersonFull(who)], subjFem(who), plurality(who)); }
const REFLPRON = { ich: "mich", du: "dich", er: "sich", wir: "uns", ihr: "euch", sie: "sich" };
function reflConj(inf, who) {
  // present reflexive full form: "freue mich", "interessiert euch"...
  const c = conjPresent(inf, CKEY[cpersonFull(who)]);
  const tail = c.tail ? " " + c.tail.trim() : "";
  return c.core + " " + REFLPRON[CKEY[cpersonFull(who)]] + tail;
}
function AR2refl(arInf, who) {
  // arabic reflexive approx: base verb + reflexive pronoun (number/gender aware)
  const cp = CKEY[cpersonFull(who)];
  const fem = subjFem(who), pl = plurality(who);
  const v = arVerb(arInf, cp, fem, pl);
  let pro;
  if (cp === "ich") pro = "نفسي";
  else if (cp === "du") pro = "نفسك";
  else if (cp === "wir") pro = "أنفسنا";
  else if (cp === "ihr") pro = "أنفسكم";
  else if (pl === "dual") pro = "أنفسهما";
  else if (pl === "pl") pro = "أنفسهم";
  else pro = fem ? "نفسها" : "نفسه";
  return v + " " + pro;
}
function arPastFull(base, who) {
  // arabic past-tense agreement (sound + defective ى-verbs) for all persons/numbers
  const cp = CKEY[cpersonFull(who)], fem = subjFem(who);
  const pl = plurality(who);
  const siepl = who[2] === "siepl";
  const defective = /ى$/.test(base);
  const stem = defective ? base.slice(0, -1) : base;
  if (base === "كان") {
    if (cp === "ich" || cp === "du") return "كنت";
    if (cp === "wir") return "كنا";
    if (cp === "ihr") return "كنتم";
    if (pl === "dual") return fem ? "كانتا" : "كانا";
    if (siepl) return "كانوا";
    return fem ? "كانت" : "كان";
  }
  if (cp === "ich" || cp === "du") return base + "ت";
  if (cp === "wir") return base + "نا";
  if (cp === "ihr") return base + "تم";
  if (pl === "dual") return base + (fem ? "تا" : "ا");
  if (siepl) return stem + "وا";
  if (fem) return /ت$/.test(base) ? base : stem + "ت";
  return base;
}
function hatteAr(who) {
  const cp = CKEY[cpersonFull(who)], fem = subjFem(who), pl = who[2] === "siepl";
  if (cp === "ich") return "كان لديّ";
  if (cp === "du") return "كان لديك";
  if (cp === "wir") return "كان لدينا";
  if (cp === "ihr") return "كان لديكم";
  if (plurality(who) === "dual") return "كان لديهما";
  if (pl) return "كان لديهم";
  return fem ? "كان لديها" : "كان لديه";
}
function warAr(who, adjAr) {
  void adjAr;
  return arPastFull("كان", who);
}
const SEPV = verbs.filter((w) => w.sep && !w.de.startsWith("sich ") && splitSep(w.de.replace(/^sich /, "")));
const SEP_AR = {};
verbs.forEach((w) => { SEP_AR[w.de.replace(/^sich /, "")] = w.ar; });

/* ---------- per-pattern fill ---------- */
let seqS = 0;
function kapFor(level, i) {
  if (level === "A1") return "K" + (1 + (i % 5));
  return "KX";
}
function pickN(rr, arr) { return arr[Math.floor(rr() * arr.length)]; }
function akkPhrase(rr, pool, pluralOk) {
  const w = pickN(rr, pool.length ? pool : THING_NOUNS);
  const pl = pluralOk && rr() < 0.25 && w.plural !== "-";
  if (pl) {
    const plDe = /^(der|die|das)\s/.test(w.plural) ? w.plural.replace(/^(der|die|das)\s/, "") : w.plural;
    return { de: "die " + plDe, ar: arPlObj(w.ar), w, plural: true };
  }
  return { de: declArt(w.art, "A", false) + " " + w.de, ar: w.ar, w, plural: false };
}
function datPhrase(rr, pool, pluralOk) {
  const w = pickN(rr, pool.length ? pool : THING_NOUNS);
  if (pluralOk && rr() < 0.2 && w.plural !== "-") return { de: "den " + pluralDat(w), ar: arPlObj(w.ar), w, plural: true };
  return { de: declArt(w.art, "D", false) + " " + w.de, ar: w.ar, w, plural: false };
}
function nomPhrase(rr, pool) {
  const w = pickN(rr, pool.length ? pool : THING_NOUNS);
  return { de: declArt(w.art, "N", false) + " " + w.de, ar: w.ar, w };
}
/* indefinite singular object for existential "Es gibt / Gibt es" (hardening
   2026-10-09: definite articles are ungrammatical after "es gibt"; Arabic is
   left as-is — definite Arabic existentials are grammatical). */
function indefPhrase(rr, pool) {
  const w = pickN(rr, pool.length ? pool : THING_NOUNS);
  const art = w.art === "die" ? "eine" : w.art === "der" ? "einen" : "ein";
  return { de: art + " " + w.de, ar: w.ar, w, plural: false };
}
/* purchasable goods for price questions (hardening 2026-10-09: asking the
   price of stations/events/abstracts is semantically anomalous). Mirrors the
   schreibt-zeit/plant allowlist precedent; falls back to any thing-noun. */
const PURCHASE_CATS = ["food", "drinks", "clothing", "supermarket", "tech", "phones", "computers", "shopping", "furniture", "sports", "school", "restaurant", "hotel"];
function purchasePool() {
  const p = THING_NOUNS.filter((w) => PURCHASE_CATS.indexOf(w.cat) >= 0 && !/ /.test(w.de));
  return p.length ? p : THING_NOUNS;
}
function verbArOf(inf) {
  if (AR_FB[inf]) return AR_FB[inf];
  const v = verbs.find((x) => x.de.replace(/^sich /, "") === inf);
  if (v) return v.ar;
  for (const g of [VG_TRAN[0], VG_TRAN[1], VG_INTRAN[0], VG_INTRAN[1], VG_DITRAN[0], VG_MODAL[0]])
    for (const [i, a] of g) if (i === inf) return a;
  return "يفعل";
}
function conjSubj(inf, S) {
  const cp = CKEY[cpersonFull(S)];
  const r = conjPresent(inf, cp);
  return r.core + r.tail;
}
function arSubj(inf, S) {
  const cp = CKEY[cpersonFull(S)];
  return arVerb(verbArOf(inf), cp, subjFem(S), plurality(S));
}

function fillGeneric(rr, deTpl, arTpl, S) {
  // generic slot fill for straightforward patterns
  const S2 = pickN(rr, SUBJ);
  let V = pickN(rr, poolOf(0)), V2 = pickN(rr, poolOf(1));
  // existential templates take indefinite objects (G1); price questions take
  // purchasable goods (G5)
  const esGibt = /^(Es gibt|Gibt es)\b/.test(deTpl);
  const preisFr = /wie viel kostet/.test(deTpl);
  const O = esGibt ? indefPhrase(rr, thingPoolFor(V[0])) : akkPhrase(rr, thingPoolFor(V[0]), true);
  const O1 = preisFr ? nomPhrase(rr, purchasePool()) : nomPhrase(rr, THING_NOUNS);
  const O2 = nomPhrase(rr, THING_NOUNS);
  const O2d = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
  const O3 = datPhrase(rr, thingPoolFor(null), false), O4 = akkPhrase(rr, thingPoolFor(V[0]), false), O5 = datPhrase(rr, thingPoolFor(null), false);
  const O6 = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
  const O7 = akkPhrase(rr, thingPoolFor(V[0]), false);
  const O8 = pickN(rr, NAMES);
  const Og = genForm(pickN(rr, THING_NOUNS));
  const T = pickN(rr, TIMES), P = pickN(rr, PLACES);
  const A = pickN(rr, adjs.length ? adjs : [{ de: "gut", ar: "جيد" }]);
  const fem = subjFem(S), fem2 = subjFem(S2);
  const map = {
    "{S}": S[0], "{Sa}": S[1], "{Sl}": lowS(S),
    "{S2}": lowS(S2), "{S2a}": S2[1],
    "{V}": conjSubj(V[0], S), "{Va}": arSubj(V[0], S),
    "{V2}": conjSubj(V2[0], S2), "{V2a}": arSubj(V2[0], S2),
    "{V3}": conjSubj(V[0], S), "{Va3}": arSubj(V[0], S),
    "{Vq}": cap(conjSubj(V[0], S)),
    "{O}": O.de, "{Oa}": O.ar,
    "{On}": O.w.de, "{Ona}": O.w.ar.replace(/^ال/, ""),
    "{O1}": O1.de, "{O1a}": O1.ar, "{O2}": O2.de, "{O2a}": O2.ar,
    "{O2d}": O2d.de, "{O2da}": O2d.ar,
    "{O3}": O3.de, "{O3a}": O3.ar, "{O4}": O4.de, "{O4a}": O4.ar,
    "{O5}": O5.de, "{O5a}": O5.ar, "{O6}": O6.de, "{O6a}": O6.ar,
    "{O7}": O7.de, "{O7a}": O7.ar, "{O8}": O8[0], "{O8a}": O8[1],
    "{Og}": Og.de, "{Oga}": Og.ar,
    "{T}": T[0], "{Ta}": T[1], "{P}": P[0], "{Pa}": P[1],
    "{A}": A.de, "{Aa}": arAdj(A.ar, fem, plurality(S)),
  };
  let de = deTpl, ar = arTpl;
  Object.keys(map).forEach((k) => { de = de.split(k).join(map[k]); ar = ar.split(k).join(map[k]); });
  return { de, ar, refs: { v: [V[0]], w: [O.w.id, O1.w.id], fem, s2: S2 } };
}

function buildOne(rr, pat, idx) {
  const [deTpl, arTpl, patLvl, topic, gram] = pat;
  const B1GRAMS = new Set(("weil dass wenn genitiv-praep trotz trotz-nominal waehrend waehrend-satz obwohl obwohl-voran bevor bevor-satz nachdem nachdem-satz um-zu um-zu-zweck statt-zu ohne-zu es-ist-wichtig-zu es-ist-schwer-zu infinitiv-floskel infinitiv-floskel-2 subjekt-satz passiv passiv-modal lassen-passiv-sinn man-passiv-sinn je-desto je-desto-2 entweder-oder sowohl-als-auch nicht-nur-sondern zwar-aber konjunktiv-hoeflich konjunktiv-bitte futur damit-final weil-kausal sobald falls lassen finden-adj akk-doppelt modal-sollen modal-duerfen").split(" "));
  const lvl = B1GRAMS.has(gram) ? "B1" : patLvl;
  const S = pickN(rr, SUBJ);
  const fem = subjFem(S);
  const cp = CKEY[cpersonFull(S)];
  function Vconj(inf) { return conjSubj(inf, S); }
  function Var(inf) { return arSubj(inf, S); }
  const O = () => akkPhrase(rr, thingPoolFor(null), true);
  const P = () => pickN(rr, PLACES);
  const T = () => pickN(rr, TIMES);
  const A = () => pickN(rr, adjs);
  let de = deTpl, ar = arTpl, vocabRefs = [], gramRefs = [gram];

  const OV_GONE = 0;
  void OV_GONE;

  /* modal reorder (fixed: transitive infinitive LAST, object before it) */
  if (/modal|konjunktiv/.test(gram) && deTpl.includes("{Vm}")) {
    const Vm = pickN(rr, Object.keys(MODAL_AR));
    const Vi = pickN(rr, poolInf(0));
    const o = akkPhrase(rr, thingPoolFor(Vi[0]), true), t = T(), p = P();
    de = S[0] + " " + conjSubj(Vm, S) + " " + o.de + " " + Vi[0] + ".";
    ar = MODAL_AR[Vm] + " " + S[1] + " أن " + arInfPl(Vi[1], S) + " " + o.ar + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "modal-muessen" || gram === "modal-koennen" || gram === "modal-wollen" || gram === "modal-sollen") {
    const Vm = { "modal-muessen": "müssen", "modal-koennen": "können", "modal-wollen": "wollen", "modal-sollen": "sollen" }[gram];
    const Vi = pickN(rr, poolInf(0));
    const o = akkPhrase(rr, thingPoolFor(Vi[0]), true), t = T(), p = P();
    const tail = gram === "modal-koennen" ? " " + t[0] : gram === "modal-wollen" ? " " + p[0] : "";
    const tailA = gram === "modal-koennen" ? " " + t[1] : gram === "modal-wollen" ? " " + p[1] : "";
    de = S[0] + " " + conjSubj(Vm, S) + " " + o.de + " " + Vi[0] + tail + ".";
    ar = MODAL_AR[Vm] + " " + S[1] + " أن " + arInfPl(Vi[1], S) + " " + o.ar + tailA + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "modal-duerfen") {
    const Vi = pickN(rr, poolInf(1));
    de = S[0] + " " + conjSubj("dürfen", S) + " hier nicht " + Vi[0] + ".";
    ar = "لا يجوز لـ" + S[1] + " أن " + arInfPl(Vi[1], S) + " هنا.";
  } else if (gram === "konjunktiv-hoeflich") {
    const o = O();
    de = S[0] + " " + conjSubj("möchten", S) + " " + o.de + ".";
    ar = S[1] + " " + AR2("möchten", S) + " " + o.ar + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "konjunktiv-bitte") {
    if (rr() < 0.5) { de = "Könnten Sie mir bitte helfen?"; ar = "هل يمكنكم مساعدتي من فضلك؟"; }
    else { de = "Könntest du mir bitte helfen?"; ar = "هل يمكنك مساعدتي من فضلك؟"; }
  } else if (gram === "wehtun") {
    const person = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const part = pickN(rr, BODY.length ? BODY : THING_NOUNS);
    // hardening 2026-10-09: sentence-initial dative phrase is capitalized
    const perDe = person.de.charAt(0).toUpperCase() + person.de.slice(1);
    de = perDe + " tut " + declArt(part.art, "N", false) + " " + part.de + " weh.";
    ar = part.ar + " يؤلم " + person.ar + ".";
    vocabRefs.push(part.id);
  } else if (gram === "man-passiv-sinn") {
    const V = pickN(rr, poolOf(1));
    de = "Man " + conjCore(V[0], "er") + " hier nicht.";
    ar = "لا " + Var(V[0]) + " هنا.";
  } else if (gram === "partikel-mal" || gram === "partikel-doch") {
    const V = pickN(rr, poolOf(0)); const o = O();
    de = deTpl.split("{S}").join(S[0]).split("{V}").join(Vconj(V[0])).split("{O}").join(o.de);
    ar = arTpl.split("{Sa}").join(S[1]).split("{Va}").join(Var(V[0])).split("{Oa}").join(o.ar);
    vocabRefs.push(o.w.id);
  } else if (gram === "modal-partikel") {
    const V = pickN(rr, poolOf(1)); const t = T();
    de = "Leider " + Vconj(V[0]) + " " + lowS(S) + " " + t[0] + " nicht.";
    ar = "للأسف لا " + Var(V[0]) + " " + S[1] + " " + t[1] + ".";
  } else if (gram === "um-zu" || gram === "statt-zu" || gram === "ohne-zu" || gram === "um-zu-zweck") {
    const Vi = pickN(rr, poolInf(3).concat(poolInf(1)));
    const sp = splitSep(Vi[0]);
    const zu = sp ? sp.pref + "zu" + sp.stem : "zu " + Vi[0];
    const V = pickN(rr, poolOf(0)); const o = O(); const t = T();
    if (gram === "um-zu-zweck") { de = S[0] + " " + C2("lernen", S) + " Deutsch, um in Deutschland zu arbeiten."; ar = S[1] + " " + AR2("lernen", S) + " الألمانية ليعمل في ألمانيا."; }
    else if (gram === "um-zu") { de = "Um " + zu + ", " + Vconj(V[0]) + " " + lowS(S) + " " + t[0] + "."; ar = "لكي " + Vi[1] + " " + Var(V[0]) + " " + S[1] + " " + t[1] + "."; vocabRefs.push(o.w.id); }
    else if (gram === "statt-zu") { de = S[0] + " " + Vconj(V[0]) + " " + o.de + ", statt " + zu + "."; ar = S[1] + " " + Var(V[0]) + " " + o.ar + " بدل أن " + Vi[1] + "."; vocabRefs.push(o.w.id); }
    else { de = "Ohne " + zu + " " + Vconj(V[0]) + " " + lowS(S) + " " + o.de + "."; ar = "بدون أن " + Vi[1] + " " + Var(V[0]) + " " + S[1] + " " + o.ar + "."; vocabRefs.push(o.w.id); }
  } else if (gram === "es-ist-wichtig-zu" || gram === "es-ist-schwer-zu") {
    const z = pickN(rr, ZU_INF);
    de = gram === "es-ist-wichtig-zu" ? "Es ist wichtig, " + z[0] + "." : "Es ist schwer, " + z[0] + ".";
    ar = (gram === "es-ist-wichtig-zu" ? "من المهم " : "من الصعب ") + z[1] + ".";
  } else if (gram === "infinitiv-floskel" || gram === "infinitiv-floskel-2") {
    const s3 = pickN(rr, S3_POOL);
    if (gram === "infinitiv-floskel") { de = "Ich freue mich, " + s3[0] + " kennenzulernen."; ar = "سعيد بالتعرف " + s3[1] + "."; }
    else { de = "Schön, " + s3[0] + " zu sehen."; ar = "جميل أن أراك".replace("أراك", s3[0] === "dich" ? "أراك" : "أراكم") + "."; if (s3[0] === "ihn" || s3[0] === "sie") ar = "جميل أن " + (s3[0] === "ihn" ? "أراه" : "أراها") + "."; }
  } else if (gram === "subjekt-satz") {
    const s3 = pickN(rr, S3_DAT);
    de = "Deutschlernen macht " + s3[0] + " Spaß.";
    ar = "تعلم الألمانية يمتع " + s3[1] + ".";
  } else if (gram === "falls") {
    const V = pickN(rr, poolOf(0));
    de = "Falls " + lowS(S) + " " + Vconj(V[0]) + ", " + C2("sagen", S) + " " + lowS(S) + " mir Bescheid.";
    ar = "إن " + Var(V[0]) + " " + S[1] + " فليخبرني.";
  } else if (gram === "sobald") {
    const V = pickN(rr, poolOf(1));
    const per = akkPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const c = conjPresent("anrufen", CKEY[cpersonFull(S)]);
    de = "Sobald " + lowS(S) + " " + Vconj(V[0]) + ", " + c.core + " " + lowS(S) + " " + per.de + " " + c.tail.trim() + ".";
    ar = "حالما " + Var(V[0]) + " " + S[1] + " يتصل بـ" + per.ar + ".";
    vocabRefs.push(per.w.id);
  } else if (gram === "wenn") {
    const V = pickN(rr, poolOf(1));
    de = "Wenn " + lowS(S) + " " + Vconj(V[0]) + ", " + reflConj("freuen", S) + " " + lowS(S) + ".";
    ar = "إذا " + Var(V[0]) + " " + S[1] + " " + AR2("freuen", S) + " " + S[1] + ".";
  } else if (gram === "bevor" || gram === "nachdem") {
    // verb-final subordinate (intransitive, or transitive + object), full main clause
    const o = O();
    const useTrans = rr() < 0.5;
    const V = pickN(rr, useTrans ? poolOf(0) : poolOf(1));
    const sub = useTrans ? lowS(S) + " " + o.de + " " + Vconj(V[0]) : lowS(S) + " " + Vconj(V[0]);
    const subA = useTrans ? Var(V[0]) + " " + S[1] + " " + o.ar : Var(V[0]) + " " + S[1];
    const main = reflConj("freuen", S) + " " + lowS(S);
    const mainA = AR2("freuen", S) + " " + S[1];
    if (gram === "bevor") { de = "Bevor " + sub + ", " + main + "."; ar = "قبل أن " + subA + " " + mainA + "."; }
    else { de = "Nachdem " + sub + ", " + main + "."; ar = "بعد أن " + subA + " " + mainA + "."; }
    if (useTrans) vocabRefs.push(o.w.id);
  } else if (gram === "reihung") {
    const V = pickN(rr, poolOf(0)); const o = akkPhrase(rr, thingPoolFor(V[0]), false); const p = P();
    de = S[0] + " " + Vconj(V[0]) + " " + o.de + " und danach " + C2("gehen", S) + " " + lowS(S) + " " + p[0] + ".";
    ar = S[1] + " " + Var(V[0]) + " " + o.ar + " وبعدها " + AR2("gehen", S) + " " + p[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "lassen-passiv-sinn") {
    const V = pickN(rr, [["machen", "يفعل"], ["reparieren", "يصلح"], ["lösen", "يحل"], ["ändern", "يغير"]]);
    const o = nomPhrase(rr, THING_NOUNS);
    de = o.de.charAt(0).toUpperCase() + o.de.slice(1) + " lässt sich nicht " + V[0] + ".";
    ar = o.ar + " لا يمكن " + V[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "lassen") {
    const pair = pickN(rr, LASSEN_PAIRS);
    de = S[0] + " lässt " + pair[0][1] + " " + pair[1][0] + ".";
    ar = S[1] + " يُصلح " + pair[0][2] + " عند مختص.";
  } else if (gram === "w-frage" || gram === "w-frage-wie" || gram === "w-frage-wo" || gram === "w-frage-wann" || gram === "w-frage-warum") {
    const t = T();
    const Ssg = S[2] === "siepl" ? pickN(rr, SUBJ.filter((s) => s[2] !== "siepl")) : S;
    if (gram === "w-frage") {
      const qs = [["Wer kommt " + t[0] + "?", "من يأتي " + t[1] + "؟"], ["Was passiert " + t[0] + "?", "ماذا يحدث " + t[1] + "؟"], ["Wo wohnst du?", "أين تسكن؟"], ["Wo " + C2("wohnen", Ssg) + " " + lowS(Ssg) + "?", "أين " + AR2("wohnen", Ssg) + " " + Ssg[1] + "؟"], ["Wann " + C2("kommen", Ssg) + " " + lowS(Ssg) + "?", "متى " + AR2("kommen", Ssg) + " " + Ssg[1] + "؟"], ["Warum " + C2("weinen", Ssg) + " " + lowS(Ssg) + "?", "لماذا " + AR2("weinen", Ssg) + " " + Ssg[1] + "؟"], ["Wie geht es dir?", "كيف حالك؟"], ["Woher kommst du?", "من أين أنت؟"], ["Wohin gehst du?", "إلى أين تذهب؟"]];
      const q = pickN(rr, qs); de = q[0]; ar = q[1];
    } else if (gram === "w-frage-wie") { const w = pickN(rr, WIE_POOL); de = "Wie ist " + w[0] + "?"; ar = "كيف " + w[1] + "؟"; }
    else if (gram === "w-frage-wo") { const w = pickN(rr, WO_POOL); de = "Wo ist " + w[0] + "?"; ar = "أين " + w[1] + "؟"; }
    else if (gram === "w-frage-wann") { const V = pickN(rr, poolOf(1)); de = "Wann " + Vconj(V[0]) + " " + lowS(S) + "?"; ar = "متى " + Var(V[0]) + " " + S[1] + "؟"; }
    else { const V = pickN(rr, poolOf(0)); const o = akkPhrase(rr, thingPoolFor(V[0]), false); de = "Warum " + Vconj(V[0]) + " " + lowS(S) + " " + o.de + "?"; ar = "لماذا " + Var(V[0]) + " " + S[1] + " " + o.ar + "؟"; vocabRefs.push(o.w.id); }
  } else if (gram === "was-fuer" || gram === "welch-akk") {
    const V = pickN(rr, poolOf(0));
    if (gram === "was-fuer") {
      const mode = rr();
      if (mode < 0.4) { const w = pickN(rr, MASC.length ? MASC : THING_NOUNS); de = "Was für " + declArt(w.art, "A", false) + " " + w.de + " " + Vconj(V[0]) + " " + lowS(S) + "?"; ar = "أي " + w.ar + " " + Var(V[0]) + " " + S[1] + "؟"; vocabRefs.push(w.id); }
      else if (mode < 0.7) { const w = pickN(rr, nouns.filter((x) => x.art === "die")); de = "Was für eine " + w.de + " " + Vconj(V[0]) + " " + lowS(S) + "?"; ar = "أي " + w.ar + " " + Var(V[0]) + " " + S[1] + "؟"; vocabRefs.push(w.id); }
      else { const w = pickN(rr, nouns.filter((x) => x.plural && x.plural !== "-")); const pl = /^(der|die|das)\s/.test(w.plural) ? w.plural.replace(/^(der|die|das)\s/, "") : w.plural; de = "Was für " + pl + " " + Vconj(V[0]) + " " + lowS(S) + "?"; ar = "أي " + w.ar + " (جمع) " + Var(V[0]) + " " + S[1] + "؟"; vocabRefs.push(w.id); }
    }
    else {
      const pick = rr();
      const w = pick < 0.5 ? pickN(rr, MASC.length ? MASC : THING_NOUNS) : pickN(rr, nouns.filter((x) => x.art !== "der"));
      const det = w.art === "der" ? "Welchen" : w.art === "die" ? "Welche" : "Welches";
      de = det + " " + w.de + " " + Vconj(V[0]) + " " + lowS(S) + "?"; ar = "أي " + w.ar + " " + Var(V[0]) + " " + S[1] + "؟";
      vocabRefs.push(w.id);
    }
  } else if (gram === "obwohl-voran") {
    const S2 = pickN(rr, SUBJ);
    const V = pickN(rr, poolOf(1)); const p = P();
    const mode = rr();
    if (mode < 0.5) { de = "Obwohl " + lowS(S2) + " müde " + C2("sein", S2) + ", " + Vconj(V[0]) + " " + lowS(S) + " " + p[0] + "."; ar = "رغم أن " + S2[1] + " " + muedeAr(S2) + " " + Var(V[0]) + " " + S[1] + " " + p[1] + "."; }
    else { const opens = [["Obwohl es regnet", "رغم المطر"], ["Obwohl es kalt ist", "رغم البرد"], ["Obwohl es spät ist", "رغم التأخر"], ["Obwohl es dunkel ist", "رغم الظلام"]]; const op = pickN(rr, opens); de = op[0] + ", " + Vconj(V[0]) + " " + lowS(S) + " " + p[0] + "."; ar = op[1] + " " + Var(V[0]) + " " + S[1] + " " + p[1] + "."; }
  } else if (gram === "perfekt" || gram === "nachdem-satz" || gram === "bevor-satz" || gram === "perfekt-inversion") {
    const pv = pickN(rr, PERFV);
    const aux = auxOf(pv[0]);
    const auxC = conjCore(aux, cp);
    const past = arPast(pv[2], fem);
    if (gram === "perfekt") { de = S[0] + " " + auxC + " " + pv[1] + "."; ar = S[1] + " " + arPastFull(pv[2], S) + "."; }
    else if (gram === "perfekt-inversion") { const t = T(); de = t[0].charAt(0).toUpperCase() + t[0].slice(1) + " " + auxC + " " + lowS(S) + " " + pv[1] + "."; ar = t[1] + " " + arPastFull(pv[2], S) + " " + S[1] + "."; }
    else if (gram === "nachdem-satz") { const S2 = pickN(rr, SUBJ); const auxPast = aux === "sein" ? (cp === "ich" ? "war" : (cp === "wir" || S[2] === "siepl") ? "waren" : "war") : (cp === "ich" ? "hatte" : (cp === "wir" || S[2] === "siepl") ? "hatten" : "hatte"); const rc = conjPresent("ausruhen", CKEY[cpersonFull(S2)]); de = "Nachdem " + lowS(S) + " " + pv[1] + " " + auxPast + ", " + rc.core + " " + lowS(S2) + " sich " + rc.tail.trim() + "."; ar = "بعد أن " + arPastFull(pv[2], S) + " " + S[1] + " " + arSubj("ausruhen", S2) + " " + S2[1] + "."; }
    else { const S2 = pickN(rr, SUBJ); const V = pickN(rr, poolOf(0)); de = "Bevor " + lowS(S) + " " + Vconj(V[0]) + ", " + C2("trinken", S2) + " " + lowS(S2) + " einen Kaffee."; ar = "قبل أن " + Var(V[0]) + " " + S[1] + " يشرب " + S2[1] + " قهوة."; }
  } else if (gram === "passiv" || gram === "passiv-modal") {
    const pv = pickN(rr, PASSV);
    const o = nomPhrase(rr, thingPoolFor(null));
    const wird = "wird", kann = "kann";
    if (gram === "passiv") { de = o.de.charAt(0).toUpperCase() + o.de.slice(1) + " " + wird + " " + pv[1] + "."; ar = o.ar + " " + pv[2] + "."; }
    else { de = o.de.charAt(0).toUpperCase() + o.de.slice(1) + " " + kann + " " + pv[1] + " werden."; ar = "يمكن " + pv[2] + " " + o.ar + "."; }
    vocabRefs.push(o.w.id);
  } else if (gram === "imperativ" || gram === "imperativ-pl") {
    const iv = pickN(rr, IMPV);
    const o = O(); const p = P();
    if (gram === "imperativ") { de = "Bitte " + iv[1].toLowerCase() + " " + o.de + "!"; ar = "من فضلك " + iv[2] + " " + o.ar + "!"; }
    else { de = iv[1] + "t " + S[0] + " " + p[0] + "!"; de = iv[1] + "t " + p[0] + "!"; ar = iv[2] + "وا " + p[1] + "!"; }
    vocabRefs.push(o.w.id);
  } else if (gram === "trennbar") {
    const sv = pickN(rr, SEPV.length ? SEPV : [{ de: "anrufen", ar: "يتصل" }]);
    const inf = sv.de.replace(/^sich /, "");
    const sp = splitSep(inf);
    const stem = sp ? sp.stem : inf, pref = sp ? sp.pref : "";
    const core = conjCore(stem, cp);
    const t = T();
    de = S[0] + " " + core + " " + t[0] + " " + pref + ".";
    de = (S[0] + " " + core + " " + (t[0] ? t[0] + " " : "") + pref + ".").replace(/\s+/g, " ");
    ar = S[1] + " " + arVerb(sv.ar, cp, fem, plurality(S)) + " " + t[1] + ".";
    vocabRefs.push(sv.id);
  } else if (gram === "sein-adj" || gram === "werden" || gram === "praeteritum-sein") {
    const a = A();
    const isPl = (cp === "wir" || S[2] === "siepl");
    const verb = gram === "werden" ? conjCore("werden", cp) : gram === "praeteritum-sein" ? (cp === "ich" ? "war" : cp === "du" ? "warst" : isPl ? "waren" : cp === "ihr" ? "wart" : "war") : conjCore("sein", cp);
    de = S[0] + " " + verb + " " + a.de + ".";
    ar = (gram === "praeteritum-sein" ? arPastFull("كان", S) + " " + S[1] + " " : S[1] + " ") + arAdj(a.ar, fem, plurality(S)) + ".";
    vocabRefs.push(a.id);
  } else if (gram === "haben" || gram === "praeteritum-haben") {
    const o = O();
    const isPl = (cp === "wir" || S[2] === "siepl");
    const verb = gram === "haben" ? conjCore("haben", cp) : (cp === "ich" ? "hatte" : cp === "du" ? "hattest" : isPl ? "hatten" : cp === "ihr" ? "hattet" : "hatte");
    de = S[0] + " " + verb + " " + o.de + (gram === "praeteritum-haben" ? " " + T()[0] : "") + ".";
    ar = gram === "praeteritum-haben" ? S[1] + " " + hatteAr(S) + " " + o.ar + "." : "لدى " + S[1] + " " + o.ar + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "komparativ" || gram === "superlativ" || gram === "komparativ-adv" || gram === "superlativ-adv" || gram === "je-desto" || gram === "je-desto-2") {
    const keys = Object.keys(COMP_AR);
    const k = pickN(rr, keys);
    const adjDe = k;
    let compDe = adjDe + "er";
    if (adjDe === "gut") compDe = "besser"; if (adjDe === "hoch") compDe = "höher"; if (adjDe === "teuer") compDe = "teurer";
    const o1 = nomPhrase(rr, THING_NOUNS), o2 = nomPhrase(rr, THING_NOUNS);
    if (gram === "komparativ") { de = o1.de + " ist " + compDe + " als " + o2.de + "."; ar = o1.ar + " " + COMP_AR[k] + " من " + o2.ar + "."; }
    else if (gram === "superlativ") { de = o1.de + " ist am " + compDe + "sten."; ar = o1.ar + " هو " + "ال" + COMP_AR[k] + "."; }
    else if (gram === "komparativ-adv") { const p = P(); const vv = pickN(rr, poolOf(1)); de = S[0] + " " + Vconj(vv[0]) + " lieber " + p[0] + "."; ar = S[1] + " " + ({ ich: "أفضل", du: "تفضل", er: "يفضل", wir: "نفضل", ihr: "تفضلون", sie: "يفضلون" })[cp] + " " + p[1] + "."; }
    else if (gram === "superlativ-adv") { const t = T(); const vv = pickN(rr, poolOf(1)); de = S[0] + " " + Vconj(vv[0]) + " am liebsten " + t[0] + "."; ar = S[1] + " " + ({ ich: "أفضل", du: "تفضل", er: "يفضل", wir: "نفضل", ihr: "تفضلون", sie: "يفضلون" })[cp] + " " + t[1] + "."; }
    else { de = "Je mehr " + S[0] + " " + C2("üben", S) + ", desto besser wird es."; ar = "كلما " + AR2("üben", S) + " " + S[1] + " أكثر صار أفضل."; }
    vocabRefs.push(o1.w.id, o2.w.id);
  } else if (gram === "futur") {
    const Vi = pickN(rr, poolInf(3).concat(poolInf(1))); const t = T();
    de = S[0] + " " + conjCore("werden", cp) + " " + t[0] + " " + Vi[0] + ".";
    ar = S[1] + " سوف " + arInfPl(Vi[1], S) + " " + t[1] + ".";
  } else if (gram === "futur-tr" || gram === "futur-frage") {
    const Vi = pickN(rr, poolInf(0)); const o = akkPhrase(rr, thingPoolFor(Vi[0]), true); const t = T();
    if (gram === "futur-tr") { de = S[0] + " " + conjCore("werden", cp) + " " + t[0] + " " + o.de + " " + Vi[0] + "."; ar = S[1] + " سوف " + arInfPl(Vi[1], S) + " " + o.ar + " " + t[1] + "."; }
    else { de = conjCore("werden", cp).charAt(0).toUpperCase() + conjCore("werden", cp).slice(1) + " " + lowS(S) + " " + t[0] + " " + o.de + " " + Vi[0] + "?"; ar = "هل سوف " + arInfPl(Vi[1], S) + " " + S[1] + " " + o.ar + " " + t[1] + "؟"; }
    vocabRefs.push(o.w.id);
  } else if (gram === "wer-frage") {
    const V = pickN(rr, poolOf(0)); const o = akkPhrase(rr, thingPoolFor(V[0]), true);
    const c = conjPresent(V[0], "er");
    de = "Wer " + c.core + c.tail + " " + o.de + "?";
    ar = "من " + arVerb(verbArOf(V[0]), "er", false, null) + " " + o.ar + "؟";
    vocabRefs.push(o.w.id);
  } else if (gram === "findet-neu" || gram === "findet-einfach") {
    const o = akkPhrase(rr, thingPoolFor("finden"), true);
    const fev = adjs.filter((a) => BIGS.FINDEVAL.indexOf(a.de) >= 0);
    const a = pickN(rr, fev.length ? fev : adjs);
    de = S[0] + " " + C2("finden", S) + " " + o.de + " " + a.de + ".";
    ar = S[1] + " " + AR2("finden", S) + " " + o.ar + " " + adjAgr(a.ar, o.w.art, o.plural) + ".";
    vocabRefs.push(o.w.id, a.id);
  } else if (gram === "macht-adj") {
    const o = akkPhrase(rr, thingPoolFor(null), true);
    const mev = adjs.filter((a) => BIGS.MACHEVAL.indexOf(a.de) >= 0);
    const a = pickN(rr, mev.length ? mev : adjs);
    de = S[0] + " " + C2("machen", S) + " " + o.de + " " + a.de + ".";
    ar = S[1] + " " + AR2("machen", S) + " " + o.ar + " " + adjAgr(a.ar, o.w.art, o.plural) + ".";
    vocabRefs.push(o.w.id, a.id);
  } else if (gram === "macht-name") {
    const per = pickN(rr, NAMES); const a = A();
    de = S[0] + " " + C2("machen", S) + " " + per[0] + " " + a.de + ".";
    ar = S[1] + " " + AR2("machen", S) + " " + per[1] + " " + arAdj(a.ar, nameFem(per), null) + ".";
  } else if (gram === "macht-name") {
    const per = pickN(rr, NAMES); const a = A();
    de = S[0] + " " + C2("machen", S) + " " + per[0] + " " + a.de + ".";
    ar = S[1] + " " + AR2("machen", S) + " " + per[1] + " " + arAdj(a.ar, nameFem(per), null) + ".";
  } else if (gram === "imperativ-neu") {
    const iv = pickN(rr, IMPV); const o = akkPhrase(rr, thingPoolFor(iv[0]), true);
    if (rr() < 0.5) { de = iv[1] + " " + o.de + "!"; ar = iv[2] + " " + o.ar + "!"; }
    else { de = "Bitte " + iv[1].toLowerCase() + " " + o.de + "!"; ar = "من فضلك " + iv[2] + " " + o.ar + "!"; }
    vocabRefs.push(o.w.id);
  } else if (gram === "koennten-bitte" || gram === "wuerden-bitte") {
    const Vi = pickN(rr, poolInf(1));
    const aux = gram === "koennten-bitte" ? "Könnten Sie bitte " : "Würden Sie bitte ";
    de = aux + Vi[0] + "?";
    ar = "هل يمكنكم " + Vi[1] + "وا من فضلك؟";
  } else if (gram === "man-satz") {
    const V = pickN(rr, poolOf(1)); const t = T();
    de = "Man " + conjCore(V[0], "er") + " " + t[0] + " nicht.";
    ar = "لا " + arVerb(verbArOf(V[0]), "er", false, null) + " " + t[1] + ".";
  } else if (gram === "entschuldigung-wo") {
    const w = pickN(rr, WO_POOL);
    de = "Entschuldigung, wo ist " + w[0] + "?";
    ar = "عذرا، أين " + w[1] + "؟";
  } else if (gram === "muss-voll" || gram === "kann-voll" || gram === "will-voll" || gram === "soll-voll") {
    const Vm = { "muss-voll": "müssen", "kann-voll": "können", "will-voll": "wollen", "soll-voll": "sollen" }[gram];
    const Vi = pickN(rr, poolInf(0)); const o = O(); const t = T();
    de = S[0] + " " + conjSubj(Vm, S) + " " + t[0] + " " + o.de + " " + Vi[0] + ".";
    ar = MODAL_AR[Vm] + " " + S[1] + " أن " + arInfPl(Vi[1], S) + " " + o.ar + " " + t[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "darf-hier") {
    const Vi = pickN(rr, poolInf(1));
    de = S[0] + " " + conjSubj("dürfen", S) + " hier nicht " + Vi[0] + ".";
    ar = "لا يجوز لـ" + S[1] + " أن " + arInfPl(Vi[1], S) + " هنا.";
  } else if (gram === "perfekt-tr" || gram === "perfekt-frage") {
    const pv = pickTransPv(rr); const aux = auxOf(pv[0]); const auxC = conjCore(aux, cp);
    const o = akkPhrase(rr, thingPoolFor(pv[0]), true); const t = T();
    if (gram === "perfekt-tr") { de = S[0] + " " + auxC + " " + t[0] + " " + o.de + " " + pv[1] + "."; ar = arPastFull(pv[2], S) + " " + S[1] + " " + o.ar + " " + t[1] + "."; }
    else { de = auxC.charAt(0).toUpperCase() + auxC.slice(1) + " " + S[0] + " " + t[0] + " " + o.de + " " + pv[1] + "?"; ar = "ماذا " + arPastFull(pv[2], S) + " " + S[1] + " " + o.ar + " " + t[1] + "؟"; }
    vocabRefs.push(o.w.id);
  } else if (gram === "perfekt-sein") {
    const seinPv = PERFV.filter(([i]) => auxOf(i) === "sein");
    const pv = pickN(rr, seinPv.length ? seinPv : PERFV); const auxC = conjCore("sein", cp);
    const p = P(); const t = T();
    de = S[0] + " " + auxC + " " + t[0] + " " + p[0] + " " + pv[1] + ".";
    ar = arPastFull(pv[2], S) + " " + S[1] + " " + p[1] + " " + t[1] + ".";
  } else if (gram === "perfekt-inv-neu") {
    const pv = pickTransPv(rr); const aux = auxOf(pv[0]); const auxC = conjCore(aux, cp);
    const o = akkPhrase(rr, thingPoolFor(pv[0]), true); const t = T();
    de = t[0].charAt(0).toUpperCase() + t[0].slice(1) + " " + auxC + " " + lowS(S) + " " + o.de + " " + pv[1] + ".";
    ar = t[1] + " " + arPastFull(pv[2], S) + " " + S[1] + " " + o.ar + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "will-zukunft" || gram === "moechte-zukunft") {
    const Vm = gram === "will-zukunft" ? "wollen" : "möchten";
    const Vi = pickN(rr, poolInf(0)); const o = akkPhrase(rr, thingPoolFor(Vi[0]), true); const t = T();
    de = S[0] + " " + conjSubj(Vm, S) + " " + t[0] + " " + o.de + " " + Vi[0] + ".";
    ar = MODAL_AR[Vm] + " " + S[1] + " أن " + arInfPl(Vi[1], S) + " " + o.ar + " " + t[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "gibt-es-kein") {
    const o = O(); const p = P();
    const kein = o.w.art === "die" ? "keine" : o.w.art === "der" ? "keinen" : "kein";
    const oIndef = String(o.w.ar).split("/")[0].trim().replace(/^ال/, "");
    de = "Es gibt " + kein + " " + o.w.de + " " + p[0] + ".";
    ar = "لا يوجد أي " + oIndef + " " + p[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "riecht-nach") {
    const pool = nouns.filter((w) => w.cat === "food" || w.cat === "drinks");
    const w = pickN(rr, pool.length ? pool : THING_NOUNS);
    de = "Es riecht hier nach " + w.de + ".";
    ar = "تفوح هنا رائحة " + w.ar + ".";
    vocabRefs.push(w.id);
  } else if (gram === "wehtut-neu") {
    const d = pickN(rr, S3_DAT); const o1 = nomPhrase(rr, THING_NOUNS);
    const verb = o1.w.art === "die" ? "تؤلم" : "يؤلم";
    de = o1.de.charAt(0).toUpperCase() + o1.de.slice(1) + " tut " + d[0] + " weh.";
    ar = o1.ar + " " + verb + DATSUF[d[0]] + ".";
    vocabRefs.push(o1.w.id);
  } else if (gram === "kommt-an") {
    const c = conjPresent("ankommen", CKEY[cpersonFull(S)]); const t = T(); const p = P();
    de = S[0] + " " + c.core + " " + t[0] + " " + p[0] + " " + c.tail.trim() + ".";
    ar = S[1] + " " + AR2("ankommen", S) + " " + t[1] + " " + p[1] + ".";
  } else if (gram === "steigt-um") {
    const c = conjPresent("umsteigen", CKEY[cpersonFull(S)]); const p = P();
    de = S[0] + " " + c.core + " " + p[0] + " " + c.tail.trim() + ".";
    ar = S[1] + " " + AR2("umsteigen", S) + " " + p[1] + ".";
  } else if (gram === "holt-ab") {
    const c = conjPresent("abholen", CKEY[cpersonFull(S)]); const per = pickN(rr, NAMES); const p = P();
    de = S[0] + " " + c.core + " " + per[0] + " " + p[0] + " " + c.tail.trim() + ".";
    ar = S[1] + " " + AR2("abholen", S) + " " + per[1] + " " + p[1] + ".";
  } else if (gram === "ruft-an") {
    const c = conjPresent("anrufen", CKEY[cpersonFull(S)]); const per = pickN(rr, NAMES); const t = T();
    de = S[0] + " " + c.core + " " + per[0] + " " + t[0] + " " + c.tail.trim() + ".";
    ar = S[1] + " " + AR2("anrufen", S) + " " + per[1] + " " + t[1] + ".";
  } else if (gram === "bringt-name") {
    const per = pickN(rr, NAMES); const o = O();
    de = S[0] + " " + Vconj("bringen") + " " + per[0] + " " + o.de + ".";
    ar = S[1] + " " + AR2("bringen", S) + " لـ" + per[1] + " " + o.ar + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "gruesst" || gram === "dankt" || gram === "gratuliert" || gram === "besucht-name") {
    const inf = gram === "gruesst" ? "grüßen" : gram === "dankt" ? "danken" : gram === "gratuliert" ? "gratulieren" : "besuchen";
    const per = pickN(rr, NAMES); const t = T();
    const tail = gram === "besucht-name" ? " " + t[0] : "";
    const tailA = gram === "besucht-name" ? " " + t[1] : "";
    de = S[0] + " " + C2(inf, S) + " " + per[0] + tail + ".";
    ar = S[1] + " " + AR2(inf, S) + " " + per[1] + tailA + ".";
  } else if (gram === "werden-adj") {
    const a = A(); const t = T();
    de = S[0] + " " + conjCore("werden", cp) + " " + t[0] + " " + a.de + ".";
    ar = S[1] + " سوف " + AR2("werden", S) + " " + t[1] + " " + arAdj(a.ar, subjFem(S), plurality(S)) + ".";
    vocabRefs.push(a.id);
  } else if (gram === "uebt-obj" || gram === "wiederholt") {
    const pool = nouns.filter((w) => ["school", "study", "education", "university"].includes(w.cat));
    const w = pickN(rr, pool.length ? pool : THING_NOUNS); const t = T();
    const inf = gram === "uebt-obj" ? "üben" : "wiederholen";
    de = S[0] + " " + C2(inf, S) + " " + t[0] + " " + declArt(w.art, "A", false) + " " + w.de + ".";
    ar = S[1] + " " + AR2(inf, S) + " " + t[1] + (gram === "uebt-obj" ? " على " : " ") + w.ar + ".";
    vocabRefs.push(w.id);
  } else if (gram === "schreibt-zeit") {
    const allow = new Set(["Brief", "E-Mail", "Hausaufgabe", "Geschichte", "Liste", "Nachricht"]);
    const pool = nouns.filter((w) => allow.has(w.de));
    const w = pickN(rr, pool.length ? pool : THING_NOUNS); const t = T();
    de = S[0] + " " + C2("schreiben", S) + " " + t[0] + " " + declArt(w.art, "A", false) + " " + w.de + ".";
    ar = S[1] + " " + AR2("schreiben", S) + " " + t[1] + " " + w.ar + ".";
    vocabRefs.push(w.id);
  } else if (gram === "plant") {
    const allow = new Set(["Urlaub", "Reise", "Party", "Fest", "Hochzeit", "Ausflug", "Wochenende", "Picknick", "Geburtstag"]);
    const pool = nouns.filter((w) => allow.has(w.de));
    const w = pickN(rr, pool.length ? pool : THING_NOUNS); const t = T();
    de = S[0] + " " + C2("planen", S) + " " + t[0] + " " + declArt(w.art, "A", false) + " " + w.de + ".";
    ar = S[1] + " " + AR2("planen", S) + " " + t[1] + " " + w.ar + ".";
    vocabRefs.push(w.id);
  } else if (gram === "praeteritum-gehen") {
    const p = P(); const t = T();
    const isPl = (cp === "wir" || S[2] === "siepl");
    const verb = cp === "ich" ? "ging" : cp === "du" ? "gingst" : isPl ? "gingen" : cp === "ihr" ? "gingt" : "ging";
    de = S[0] + " " + verb + " " + p[0] + " " + t[0] + ".";
    ar = arPastFull("ذهب", S) + " " + S[1] + " " + p[1] + " " + t[1] + ".";
  } else if (gram === "wetter-es" || gram === "wetter-verb") {
    const t = T();
    if (gram === "wetter-es") { const a = pickN(rr, [["schön", "جميل"], ["kalt", "بارد"], ["warm", "دافئ"], ["gut", "جيد"], ["schlecht", "سيئ"], ["windig", "عاصف"], ["neblig", "ضبابي"], ["sonnig", "مشمس"], ["regnerisch", "ماطر"], ["wolkig", "غائم"], ["heiß", "حار"], ["kühl", "منعش"]]); de = "Es ist " + a[0] + " " + t[0] + "."; ar = "الجو " + a[1] + " " + t[1] + "."; }
    else { const v = pickN(rr, [["regnet", "تمطر"], ["schneit", "تثلج"]]); de = "Es " + v[0] + " " + t[0] + "."; ar = "إنها " + v[1] + " " + t[1] + "."; }
  } else if (gram === "es-gibt") {
    const o = indefPhrase(rr, thingPoolFor(null)); const p = P();
    de = "Es gibt " + o.de + " " + p[0] + ".";
    ar = "يوجد " + o.ar + " " + p[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "gefallen-dativ" || gram === "schmecken-dativ" || gram === "passen-dativ" || gram === "gehoeren") {
    const per = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const thing = nomPhrase(rr, THING_NOUNS);
    const v = gram === "schmecken-dativ" ? "schmeckt" : gram === "passen-dativ" ? "passt" : gram === "gehoeren" ? "gehört" : "gefällt";
    const va = gram === "schmecken-dativ" ? "يعجب طعمه" : gram === "passen-dativ" ? "يناسب" : gram === "gehoeren" ? "يخص" : "يعجب";
    de = thing.de.charAt(0).toUpperCase() + thing.de.slice(1) + " " + v + " " + per.de + ".";
    ar = thing.ar + " " + va + " " + per.ar + ".";
    vocabRefs.push(thing.w.id);
  } else if (gram === "treffen-akk" || gram === "besuchen" || gram === "anrufen") {
    const per = akkPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const t = T(); const p = P();
    if (gram === "treffen-akk") { const c = conjPresent("treffen", cp); de = S[0] + " " + c.core + " " + per.de + " " + t[0] + " " + p[0] + "."; ar = S[1] + " " + AR2("treffen", S) + " " + per.ar + " " + t[1] + " " + p[1] + "."; }
    else if (gram === "besuchen") { de = S[0] + " " + Vconj("besuchen") + " " + per.de + " " + t[0] + "."; ar = S[1] + " " + AR2("besuchen", S) + " " + per.ar + " " + t[1] + "."; }
    else { const c = conjPresent("anrufen", cp); de = S[0] + " " + c.core + " " + per.de + " " + t[0] + " " + c.tail.trim() + "."; ar = S[1] + " " + AR2("anrufen", S) + " " + per.ar + " " + t[1] + "."; }
    vocabRefs.push(per.w.id);
  } else if (gram === "person-akk") {
    const PV = BIGS.PERSON_V.filter(([i]) => !isSepInf(i));
    const V = pickN(rr, PV.length ? PV : poolOf(0));
    const per = akkPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const t = T(); const p = P();
    const mode = rr();
    if (mode < 0.5) { de = S[0] + " " + Vconj(V[0]) + " " + per.de + " " + t[0] + " " + p[0] + "."; ar = S[1] + " " + AR2(V[0], S) + " " + per.ar + " " + t[1] + " " + p[1] + "."; }
    else if (mode < 0.8) { const q = cap(conjSubj(V[0], S)); de = q + " " + S[0] + " " + per.de + " " + t[0] + "?"; ar = "هل " + AR2(V[0], S) + " " + S[1] + " " + per.ar + " " + t[1] + "؟"; }
    else { de = S[0] + " " + Vconj(V[0]) + " " + per.de + " nicht."; ar = S[1] + " لا " + AR2(V[0], S) + " " + per.ar + "."; }
    vocabRefs.push(per.w.id);
  } else if (gram === "relativ-subjekt") {
    const RELATIV_BLOCK = new Set(["Stelle", "Ausbildung", "Prüfung", "Arbeit", "Beruf", "Job", "Praktikum", "Gehalt", "Urlaub", "Schicht", "Lehrstelle", "Ausbildungsplatz", "Arbeitsplatz"]);
    const np = nouns.filter((w) => PERSON_CATS.indexOf(w.cat) >= 0 && !RELATIV_BLOCK.has(w.de));
    const n = nomPhrase(rr, np.length ? np : THING_NOUNS);
    const rel = n.w.art === "die" ? "die" : n.w.art === "das" ? "das" : "der";
    const femN = n.w.art === "die";
    const Vs = pickN(rr, poolOf(1)); const t = T();
    const Vm = pickN(rr, poolOf(0)); const o = akkPhrase(rr, thingPoolFor(Vm[0]), false);
    const cs = conjPresent(Vs[0], "er"), cm = conjPresent(Vm[0], "er");
    de = cap(n.de) + ", " + rel + " " + t[0] + " " + cs.core + cs.tail + ", " + cm.core + " " + o.de + ".";
    ar = n.ar + " " + (femN ? "التي" : "الذي") + " " + arVerb(verbArOf(Vs[0]), "er", femN, null) + " " + t[1] + " " + arVerb(verbArOf(Vm[0]), "er", femN, null) + " " + o.ar + ".";
    vocabRefs.push(n.w.id, o.w.id);
  } else if (gram === "indirekt-frage") {
    const frames = [["Weißt du, wo", "هل تعرف أين"], ["Weißt du, wann", "هل تعرف متى"], ["Sag mir, wo", "قل لي أين"], ["Sag mir, wann", "قل لي متى"], ["Ich weiß nicht, wo", "لا أعرف أين"], ["Ich weiß nicht, wann", "لا أعرف متى"]];
    const f = pickN(rr, frames);
    const o = akkPhrase(rr, THING_NOUNS, false);
    const useTrans = rr() < 0.5;
    const V = pickN(rr, useTrans ? poolOf(0) : poolOf(1));
    const sub = useTrans ? lowS(S) + " " + o.de + " " + Vconj(V[0]) : lowS(S) + " " + Vconj(V[0]);
    const subA = useTrans ? Var(V[0]) + " " + S[1] + " " + o.ar : Var(V[0]) + " " + S[1];
    de = f[0] + " " + sub + "?";
    ar = f[1] + " " + subA + "؟";
    if (useTrans) vocabRefs.push(o.w.id);
  } else if (gram === "seit-praesens") {
    const vinfo = pickN(rr, [["wohnen", "يسكن"], ["arbeiten", "يعمل"], ["lernen", "يتعلم"], ["leben", "يعيش"]]);
    const tg = pickN(rr, T_DAUER); const p = P();
    de = S[0] + " " + C2(vinfo[0], S) + " seit " + tg[0] + " " + p[0] + ".";
    ar = S[1] + " " + AR2(vinfo[0], S) + " منذ " + tg[1] + " " + p[1] + ".";
  } else if (gram === "praet-modal") {
    const MT = { "müssen": ["musste", "musstest", "musste", "mussten", "musstet", "mussten", "اضطر"], "können": ["konnte", "konntest", "konnte", "konnten", "konntet", "konnten", "استطاع"], "wollen": ["wollte", "wolltest", "wollte", "wollten", "wolltet", "wollten", "أراد"], "sollen": ["sollte", "solltest", "sollte", "sollten", "solltet", "sollten", "كان ينبغي"], "dürfen": ["durfte", "durftest", "durfte", "durften", "durftet", "durften", "سُمح له"] };
    const Vm = pickN(rr, Object.keys(MT));
    const Vi = pickN(rr, poolInf(0)); const o = akkPhrase(rr, thingPoolFor(Vi[0]), true); const t = T();
    const mc = { ich: 0, du: 1, er: 2, wir: 3, ihr: 4, sie: 5 }[cp];
    let mAr;
    if (Vm === "dürfen") { const dpl = plurality(S), dfem = subjFem(S); mAr = dpl === "dual" ? "سُمح لهما" : dpl === "pl" ? "سُمح لهم" : dfem ? "سُمح لها" : "سُمح له"; }
    else mAr = arPastFull(MT[Vm][6], S);
    de = S[0] + " " + MT[Vm][mc] + " " + t[0] + " " + o.de + " " + Vi[0] + ".";
    ar = mAr + " " + S[1] + " أن " + arInfPl(Vi[1], S) + " " + o.ar + " " + t[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "praet-ankommen") {
    const KT = { ich: "kam", du: "kamst", er: "kam", wir: "kamen", ihr: "kamt", sie: "kamen" };
    const t = T(); const p = P();
    de = S[0] + " " + KT[cp] + " " + t[0] + " " + p[0] + " an.";
    ar = arPastFull("أتى", S) + " " + S[1] + " " + t[1] + " " + p[1] + ".";
  } else if (gram === "praet-geben") {
    const GT = { ich: "gab", du: "gabst", er: "gab", wir: "gaben", ihr: "gabt", sie: "gaben" };
    const o1 = akkPhrase(rr, thingPoolFor(null), false); const o2 = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    de = S[0] + " " + GT[cp] + " " + o2.de + " " + o1.de + ".";
    ar = arPastFull("أعطى", S) + " " + S[1] + " " + o2.ar + " " + o1.ar + ".";
    vocabRefs.push(o1.w.id, o2.w.id);
  } else if (gram === "praet-sehen") {
    const ST = { ich: "sah", du: "sahst", er: "sah", wir: "sahen", ihr: "saht", sie: "sahen" };
    const o = akkPhrase(rr, thingPoolFor(null), true); const t = T();
    de = S[0] + " " + ST[cp] + " " + o.de + " " + t[0] + ".";
    ar = arPastFull("رأى", S) + " " + S[1] + " " + o.ar + " " + t[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "formell-transitiv") {
    const INFS = [["ausfüllen", "يملأ", "documents"], ["unterschreiben", "يوقع", "documents"], ["abgeben", "يسلم", "documents"], ["erklären", "يشرح", null], ["vorlesen", "يقرأ", null], ["zeigen", "يري", null]];
    const fi = pickN(rr, INFS);
    const pool = fi[2] ? THING_NOUNS.filter((w) => w.cat === fi[2]) : thingPoolFor(null);
    const o = akkPhrase(rr, pool.length ? pool : THING_NOUNS, false);
    de = "Könnten Sie " + o.de + " " + fi[0] + "?";
    ar = "هل يمكنكم أن " + fi[1] + "وا " + o.ar + "؟";
    vocabRefs.push(o.w.id);
  } else if (gram === "vor-angst") {
    const o5 = datPhrase(rr, thingPoolFor(null), false);
    de = "Vor " + o5.de + " " + C2("haben", S) + " " + lowS(S) + " Angst.";
    ar = "أمام " + o5.ar + " " + arVerb("يخاف", CKEY[cpersonFull(S)], subjFem(S), plurality(S)) + " " + S[1] + ".";
    vocabRefs.push(o5.w.id);
  } else if (gram === "bei-wetter") {
    const WETTERADJ = [["schön", "جميل"], ["kalt", "بارد"], ["warm", "دافئ"], ["gut", "جيد"], ["schlecht", "سيئ"], ["windig", "عاصف"], ["neblig", "ضبابي"], ["sonnig", "مشمس"], ["regnerisch", "ماطر"], ["wolkig", "غائم"], ["heiß", "حار"], ["kühl", "منعش"], ["schwül", "رطب"], ["heiter", "صحو"], ["trüb", "غائم"], ["mild", "معتدل"], ["frostig", "متجمد"], ["stürmisch", "عاصف"], ["bedeckt", "مغطى"], ["klar", "صاف"]];
    const o5 = datPhrase(rr, thingPoolFor(null), false); const a = pickN(rr, WETTERADJ);
    de = "Bei " + o5.de + " ist es " + a[0] + ".";
    ar = "عند " + o5.ar + " الجو " + a[1] + ".";
    vocabRefs.push(o5.w.id);
  } else if (gram === "nach-zeit") {
    const o5 = datPhrase(rr, thingPoolFor(null), false);
    const V = pickN(rr, poolOf(1)); const p = P();
    de = "Nach " + o5.de + " " + Vconj(V[0]) + " " + lowS(S) + " " + p[0] + ".";
    ar = "بعد " + o5.ar + " " + Var(V[0]) + " " + S[1] + " " + p[1] + ".";
    vocabRefs.push(o5.w.id);
  } else if (gram === "abholen" || gram === "bringen-zu" || gram === "begleiten") {
    const per = akkPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const p3 = pickN(rr, P_AB);
    if (gram === "abholen") { const c = conjPresent("abholen", cp); de = S[0] + " " + c.core + " " + per.de + " vom " + p3[0] + " " + c.tail.trim() + "."; ar = S[1] + " " + AR2("abholen", S) + " " + per.ar + " من " + p3[1] + "."; }
    else if (gram === "bringen-zu") { de = S[0] + " " + Vconj("bringen") + " " + per.de + " zum " + p3[0] + "."; ar = S[1] + " " + AR2("bringen", S) + " " + per.ar + " إلى " + p3[1] + "."; }
    else { de = S[0] + " " + Vconj("begleiten") + " " + per.de + " zum " + p3[0] + "."; ar = S[1] + " " + AR2("begleiten", S) + " " + per.ar + " إلى " + p3[1] + "."; }
    vocabRefs.push(per.w.id);
  } else if (gram === "vorstellen" || gram === "erklaeren" || gram === "zeigen" || gram === "helfen-dativ" || gram === "helfen-bei") {
    const per = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const o = akkPhrase(rr, THING_NOUNS, false);
    const v = gram === "vorstellen" ? conjPresent("vorstellen", cp) : null;
    if (gram === "vorstellen") { const po = akkPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false); de = S[0] + " " + v.core + " " + po.de + " " + per.de + " " + v.tail.trim() + "."; ar = S[1] + " " + AR2("vorstellen", S) + " " + po.ar + " لـ" + per.ar + "."; vocabRefs.push(po.w.id); }
    else if (gram === "erklaeren") { de = S[0] + " " + Vconj("erklären") + " " + per.de + " " + o.de + "."; ar = S[1] + " " + AR2("erklären", S) + " لـ" + per.ar + " " + o.ar + "."; }
    else if (gram === "zeigen") { de = S[0] + " " + Vconj("zeigen") + " " + per.de + " " + o.de + "."; ar = S[1] + " " + AR2("zeigen", S) + " " + per.ar + " " + o.ar + "."; }
    else if (gram === "helfen-bei") { const n = pickN(rr, N_ACT); de = S[0] + " " + C2("helfen", S) + " " + per.de + " beim " + n[0] + "."; ar = S[1] + " " + AR2("helfen", S) + " " + per.ar + " في " + n[1] + "."; }
    else { de = S[0] + " " + C2("helfen", S) + " " + per.de + " bei " + o.de + "."; ar = S[1] + " " + AR2("helfen", S) + " " + per.ar + " في " + o.ar + "."; }
    vocabRefs.push(per.w.id, o.w.id);
  } else if (gram === "wuenschen" || gram === "einkaufen-fuer" || gram === "kochen-fuer" || gram === "sparen-fuer") {
    const per = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    if (gram === "wuenschen") { const n = pickN(rr, N_WUNSCH); de = S[0] + " " + C2("wünschen", S) + " " + per.de + " viel " + n[0] + "."; ar = S[1] + " " + AR2("wünschen", S) + " لـ" + per.ar + " الكثير من " + n[1] + "."; }
    else if (gram === "sparen-fuer") { const o = akkPhrase(rr, thingPoolFor("sparen"), true); de = S[0] + " " + Vconj("sparen") + " für " + o.de + "."; ar = S[1] + " " + AR2("sparen", S) + " لـ" + o.ar + "."; vocabRefs.push(o.w.id); }
    else { const o = O(); const v = gram === "einkaufen-fuer" ? conjPresent("einkaufen", cp) : { core: Vconj("kochen"), tail: "" }; de = S[0] + " " + v.core + " für " + per.de + " " + o.de + (v.tail ? " " + v.tail.trim() : "") + "."; ar = S[1] + " " + AR2(gram === "einkaufen-fuer" ? "einkaufen" : "kochen", S) + " لـ" + per.ar + " " + o.ar + "."; vocabRefs.push(o.w.id); }
    vocabRefs.push(per.w.id);
  } else if (gram === "zahlen-mit" || gram === "bar-zahlen" || gram === "kosten") {
    if (gram === "kosten") { const pr = pickN(rr, O_PREIS); const ok = nomPhrase(rr, purchasePool()); de = ok.de.charAt(0).toUpperCase() + ok.de.slice(1) + " kostet " + pr[0] + "."; ar = ok.ar + " يكلف " + pr[1] + "."; vocabRefs.push(ok.w.id); }
    else { const o = akkPhrase(rr, thingPoolFor(null), true);
      if (gram === "bar-zahlen") { de = S[0] + " " + Vconj("bezahlen") + " " + o.de + " bar."; ar = S[1] + " " + AR2("bezahlen", S) + " " + o.ar + " نقدًا."; }
      else { const z = pickN(rr, O_ZAHL); de = S[0] + " " + Vconj("zahlen") + " " + o.de + " " + z[0] + "."; ar = S[1] + " " + AR2("zahlen", S) + " " + o.ar + " " + z[1] + "."; }
      vocabRefs.push(o.w.id);
    }
  } else if (gram === "sein-fuer" || gram === "sein-von" || gram === "lust-auf" || gram === "angst-vor" || gram === "stolz-auf" || gram === "zufrieden-mit" || gram === "beginnen-mit" || gram === "aufhoeren-mit" || gram === "warten-auf-seit" || gram === "kuemmern-um" || gram === "bewerben-um" || gram === "beschweren-ueber" || gram === "informieren-ueber" || gram === "freuen-auf" || gram === "danken-fuer" || gram === "gratulieren-zu" || gram === "verb-praep-auf" || gram === "verb-praep-an" || gram === "verb-praep-nach" || gram === "sprechen-ueber" || gram === "praeposition-mit" || gram === "praeposition-fuer" || gram === "reflexiv-freuen" || gram === "reflexiv-interesse" || gram === "reflexiv-beeilen" || gram === "reflexiv-aergern" || gram === "denn-kausal" || gram === "weil-kausal" || gram === "damit-final" || gram === "trotz" || gram === "trotz-nominal" || gram === "waehrend" || gram === "bevor" || gram === "nachdem" || gram === "bevor-satz" || gram === "waehrend-satz" || gram === "sobald" || gram === "seit-dauer" || gram === "bis-zeit" || gram === "von-bis" || gram === "herkunft-wohnen" || gram === "seit-lernen" || gram === "te-ka-mo-lo" || gram === "adverb-voran" || gram === "lokal-voran" || gram === "lokal-voran-2" || gram === "inversion" || gram === "praesens" || gram === "negation" || gram === "kein" || gram === "ja-nein-frage" || gram === "akk-doppelt" || gram === "finden-adj" || gram === "und-koordination" || gram === "dativ" || gram === "genitiv-praep" || gram === "obwohl" || gram === "zwar-aber" || gram === "nicht-nur-sondern" || gram === "sowohl-als-auch" || gram === "entweder-oder" || gram === "dativ" || gram === "possessiv-sein" || gram === "kauft-ort" || gram === "bestellt-ort" || gram === "kocht-zeit" || gram === "trinkt-ort" || gram === "isst-zeit" || gram === "bezahlt-zeit" || gram === "arbeitet-ort" || gram === "lernt-obj" || gram === "braucht-neu" || gram === "faehrt-ort" || gram === "fliegt-ort" || gram === "bucht-zeit" || gram === "reserviert-ort" || gram === "nennt-name" || gram === "bleibt-haus" || gram === "bleibt-haus-t" || gram === "ist-krank" || gram === "ist-krank-2" || gram === "keine-zeit-t" || gram === "viel-zeit-t" || gram === "haben-zeit" || gram === "haben-inversion" || gram === "haben-koerper" || gram === "nimmt-med" || gram === "glaubt-dass" || gram === "hofft-dass" || gram === "weiss-dass" || gram === "denkt-dass" || gram === "sagt-dass" || gram === "moechte-voll") {
    const r = fillGeneric(rr, deTpl, arTpl, S);
    de = r.de; ar = r.ar; vocabRefs.push(...r.refs.w);
    // obwohl: agree subordinate verb + Arabic with the SAME S2 fillGeneric used
    if (gram === "obwohl") {
      const S2o = r.refs.s2;
      de = de.replace("müde ist", C2("sein", S2o) + " müde");
      ar = ar.replace("تعبان", muedeAr(S2o));
    }
    // kein: gender/case-correct negation (keinen/keine/kein) + indefinite Arabic
    if (gram === "kein") {
      const V = pickN(rr, poolOf(0)); const o = akkPhrase(rr, thingPoolFor(V[0]), true); const t = T();
      const kein = o.w.art === "die" ? "keine" : o.w.art === "der" ? "keinen" : "kein";
      const oIndef = String(o.w.ar).split("/")[0].trim().replace(/^ال/, "");
      de = S[0] + " " + Vconj(V[0]) + " " + t[0] + " " + kein + " " + o.w.de + ".";
      ar = S[1] + " لا " + Var(V[0]) + " أي " + oIndef + " " + t[1] + ".";
      vocabRefs.push(o.w.id);
    }
    // LITVERBS: template literal verbs -> subject-conjugated + Arabic agreement
    const LITVERBS = {
      "kauft-ort": ["kauft", "kaufen", "يشتري"], "bestellt-ort": ["bestellt", "bestellen", "يطلب"],
      "kocht-zeit": ["kocht", "kochen", "يطبخ"], "trinkt-ort": ["trinkt", "trinken", "يشرب"],
      "isst-zeit": ["isst", "essen", "يأكل"], "bezahlt-zeit": ["bezahlt", "bezahlen", "يدفع"],
      "arbeitet-ort": ["arbeitet", "arbeiten", "يعمل"], "lernt-obj": ["lernt", "lernen", "يتعلم"],
      "braucht-neu": ["braucht", "brauchen", "يحتاج"], "faehrt-ort": ["fährt", "fahren", "يسافر"],
      "fliegt-ort": ["fliegt", "fliegen", "يطير"], "bucht-zeit": ["bucht", "buchen", "يحجز"],
      "reserviert-ort": ["reserviert", "reservieren", "يحجز"], "nennt-name": ["nennt", "nennen", "يسمي"],
      "bleibt-haus": ["bleibt", "bleiben", "يبقى"], "bleibt-haus-t": ["bleibt", "bleiben", "يبقى"],
      "keine-zeit-t": ["hat", "haben", null], "viel-zeit-t": ["hat", "haben", null],
      "haben-zeit": ["hat", "haben", null], "haben-inversion": ["hat", "haben", null],
      "haben-koerper": ["hat", "haben", null], "nimmt-med": ["nimmt", "nehmen", "يأخذ"],
      "glaubt-dass": ["glaubt", "glauben", "يعتقد"], "hofft-dass": ["hofft", "hoffen", "يأمل"],
      "weiss-dass": ["weiß", "wissen", "يعرف"], "denkt-dass": ["denkt", "denken", "يظن"],
      "sagt-dass": ["sagt", "sagen", "يقول"], "moechte-voll": ["möchte", "möchten", "يود"],
    };
    if (LITVERBS[gram]) {
      const lb = LITVERBS[gram];
      de = de.split(" " + lb[0] + " ").join(" " + conjSubj(lb[1], S) + " ").split(lb[0] + ",").join(conjSubj(lb[1], S) + ",");
      if (lb[2]) ar = ar.split(" " + lb[2] + " ").join(" " + AR2(lb[1], S) + " ");
    }
    if (gram === "ist-krank") { de = de.split(" ist ").join(" " + C2("sein", S) + " "); ar = ar.split("مريض").join(sickAr(S)); }
    if (gram === "ist-krank-2") { const S2o = r.refs.s2; de = de.split(" ist ").join(" " + C2("sein", S2o) + " "); ar = ar.split("مريض").join(sickAr(S2o)); }
    if (gram === "dativ") {
      const V = pickN(rr, poolOf(2));
      const o1pool = thingPoolFor(V[0]).filter((w) => PERSON_CATS.indexOf(w.cat) < 0);
      const o1 = akkPhrase(rr, o1pool.length ? o1pool : thingPoolFor(null), false); const o2 = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
      de = S[0] + " " + Vconj(V[0]) + " " + o2.de + " " + o1.de + ".";
      ar = S[1] + " " + AR2(V[0], S) + " " + o2.ar + " " + o1.ar + ".";
      vocabRefs.push(o1.w.id, o2.w.id);
    }
    if (gram === "akk-doppelt") {
      const o1 = akkPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false); const n = pickN(rr, NAMES);
      de = S[0] + " " + C2("nennen", S) + " " + o1.de + " " + n[0] + ".";
      ar = S[1] + " " + AR2("nennen", S) + " " + o1.ar + " " + n[1] + ".";
      vocabRefs.push(o1.w.id);
    }
    if (gram === "finden-adj") {
      const o = O(); const a = A();
      de = S[0] + " " + C2("finden", S) + " " + o.de + " " + a.de + ".";
      ar = S[1] + " " + AR2("finden", S) + " " + o.ar + " " + adjAgr(a.ar, o.w.art) + ".";
      vocabRefs.push(o.w.id, a.id);
    }
    if (gram === "von-bis") {
      const p1 = pickN(rr, P_CITY), p2 = pickN(rr, P_CITY);
      de = "Von " + p1[0] + " bis " + p2[0] + " dauert es eine Stunde.";
      ar = "من " + p1[1] + " إلى " + p2[1] + " يستغرق ساعة.";
    }
    if (gram === "herkunft-wohnen") {
      const p1 = pickN(rr, P_CITY), p2 = pickN(rr, PLACES);
      de = S[0] + " " + C2("kommen", S) + " aus " + p1[0] + " und " + C2("wohnen", S) + " jetzt " + p2[0] + ".";
      ar = S[1] + " " + qadmAr(S) + " من " + p1[1] + " و" + AR2("wohnen", S) + " الآن " + p2[1] + ".";
    }
    if (gram === "seit-lernen") {
      const tg = pickN(rr, T_DAUER);
      de = S[0] + " " + C2("lernen", S) + " seit " + tg[0] + " Deutsch.";
      ar = S[1] + " " + AR2("lernen", S) + " الألمانية منذ " + tg[1] + ".";
    }
    if (gram === "seit-dauer") {
      const tg = pickN(rr, T_DAUER); const V = pickN(rr, poolOf(0)); const o = O();
      de = S[0] + " " + Vconj(V[0]) + " " + o.de + " seit " + tg[0] + ".";
      ar = S[1] + " " + Var(V[0]) + " " + o.ar + " منذ " + tg[1] + ".";
      vocabRefs.push(o.w.id);
    }
    if (gram === "bis-zeit") {
      const tg = pickN(rr, T_DAUER);
      de = S[0] + " " + C2("bleiben", S) + " bis " + tg[0] + ".";
      ar = S[1] + " " + AR2("bleiben", S) + " حتى " + tg[1] + ".";
    }
    if (gram === "je-desto" || gram === "je-desto-2") { de = "Je öfter " + S[0] + " " + C2("üben", S) + ", desto besser wird es."; ar = "كلما " + AR2("üben", S) + " " + S[1] + " أكثر صار أفضل."; }
    if (gram === "possessiv-sein") { de = de.replace("für seine Familie", "für " + (fem ? "ihre" : "seine") + " Familie"); }
    if (gram === "verb-praep-auf" || gram === "lust-auf" || gram === "stolz-auf" || gram === "freuen-auf" || gram === "reflexiv-freuen") {
      const o = akkPhrase(rr, THING_NOUNS, false);
      if (gram === "verb-praep-auf") { de = S[0] + " " + Vconj("warten") + " auf " + o.de + "."; ar = S[1] + " " + AR2("warten", S) + " " + o.ar + "."; }
      else if (gram === "lust-auf") { de = S[0] + " " + C2("haben", S) + " Lust auf " + o.de + "."; ar = "لدى " + S[1] + " رغبة في " + o.ar + "."; }
      else if (gram === "stolz-auf") { de = S[0] + " " + conjCore("sein", cp) + " stolz auf " + o.de + "."; ar = S[1] + " " + arAdj("فخور", subjFem(S), plurality(S)) + " بـ" + o.ar + "."; }
      else if (gram === "freuen-auf") { de = S[0] + " " + reflConj("freuen", S) + " auf " + o.de + "."; ar = S[1] + " " + arAdj("متشوق", subjFem(S), plurality(S)) + " لـ" + o.ar + "."; }
      else { de = S[0] + " " + reflConj("freuen", S) + " über " + o.de + "."; ar = S[1] + " " + arAdj("سعيد", subjFem(S), plurality(S)) + " بـ" + o.ar + "."; }
      vocabRefs.push(o.w.id);
    }
    if (gram === "verb-praep-an" || gram === "denken" || gram === "verb-praep-nach" || gram === "sprechen-ueber" || gram === "praeposition-mit" || gram === "praeposition-fuer" || gram === "beschweren-ueber" || gram === "informieren-ueber" || gram === "reflexiv-interesse" || gram === "reflexiv-beeilen" || gram === "reflexiv-aergern" || gram === "angst-vor" || gram === "zufrieden-mit" || gram === "beginnen-mit" || gram === "aufhoeren-mit" || gram === "warten-auf-seit" || gram === "kuemmern-um" || gram === "bewerben-um" || gram === "danken-fuer" || gram === "gratulieren-zu") {
      const fixes = {
        "verb-praep-an": [C2("denken", S) + " an", "يفكر في", "akk"], "verb-praep-nach": [C2("fragen", S) + " nach", "يسأل عن", "dat"],
        "sprechen-ueber": null, "praeposition-mit": null, "praeposition-fuer": null,
        "beschweren-ueber": [reflConj("beschweren", S) + " über", "يشتكي من", "akk"], "informieren-ueber": [reflConj("informieren", S) + " über", "يستعلم عن", "akk"],
        "reflexiv-interesse": [reflConj("interessieren", S) + " für", "مهتم بـ", "akk"], "reflexiv-beeilen": null, "reflexiv-aergern": [C2("haben", S) + " sich über", "انزعج من", "akk"],
        "angst-vor": [C2("haben", S) + " Angst vor", "خائف من", "dat"], "zufrieden-mit": [conjCore("sein", cp) + " zufrieden mit", "راضٍ عن", "dat"],
        "beginnen-mit": [Vconj("beginnen") + " mit", "يبدأ بـ", "dat"], "aufhoeren-mit": null,
        "warten-auf-seit": null, "kuemmern-um": [reflConj("kümmern", S) + " um", "يعتني بـ", "akk"], "bewerben-um": [reflConj("bewerben", S) + " um", "يتقدم لـ", "akk"],
        "danken-fuer": [C2("danken", S), "يشكر", "mix"], "gratulieren-zu": [C2("gratulieren", S), "يهنئ", "mix2"],
      };
       if (gram === "sprechen-ueber") {
        const per = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false); const o = akkPhrase(rr, THING_NOUNS, false);
        de = S[0] + " " + Vconj("sprechen") + " mit " + per.de + " über " + o.de + ".";
        ar = S[1] + " " + AR2("sprechen", S) + " مع " + per.ar + " عن " + o.ar + ".";
        vocabRefs.push(per.w.id, o.w.id);
      } else if (gram === "reflexiv-beeilen") {
        const S2 = pickN(rr, SUBJ);
        de = S[0] + " " + reflConj("beeilen", S) + ", weil " + lowS(S2) + " " + C2("sein", S2) + " spät dran ist.";
        ar = S[1] + " " + arAdj("مستعجل", subjFem(S), plurality(S)) + " لأن " + S2[1] + " " + AR2("sein", S2) + " متأخر.";
      } else if (gram === "reflexiv-aergern") {
        const o = akkPhrase(rr, THING_NOUNS, false);
        de = S[0] + " " + C2("haben", S) + " " + REFLPRON[CKEY[cpersonFull(S)]] + " über " + o.de + " geärgert.";
        ar = S[1] + " " + arPastFull("انزعج", S) + " من " + o.ar + ".";
        vocabRefs.push(o.w.id);
      } else if (gram === "aufhoeren-mit") {
        const o = datPhrase(rr, THING_NOUNS, false);
        const c = conjPresent("aufhören", CKEY[cpersonFull(S)]);
        de = S[0] + " " + c.core + " mit " + o.de + " " + c.tail.trim() + ".";
        ar = S[1] + " " + AR2("aufhören", S) + " عن " + o.ar + ".";
        vocabRefs.push(o.w.id);
      } else if (gram === "praeposition-mit" || gram === "praeposition-fuer") {
        const V = pickN(rr, poolOf(0));
        const o = gram === "praeposition-mit" ? datPhrase(rr, THING_NOUNS, false) : akkPhrase(rr, THING_NOUNS, false);
        de = S[0] + " " + Vconj(V[0]) + (gram === "praeposition-mit" ? " mit " : " für ") + o.de + ".";
        ar = S[1] + " " + Var(V[0]) + " " + o.ar + ".";
        vocabRefs.push(o.w.id);
      } else if (gram === "warten-auf-seit") {
        const tg = pickN(rr, T_DAUER); const o = akkPhrase(rr, THING_NOUNS, false);
        de = S[0] + " " + Vconj("warten") + " seit " + tg[0] + " auf " + o.de + ".";
        ar = S[1] + " " + AR2("warten", S) + " " + o.ar + " منذ " + tg[1] + ".";
        vocabRefs.push(o.w.id);
      } else if (gram === "danken-fuer") {
        const per = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false); const o = akkPhrase(rr, THING_NOUNS, false);
        de = S[0] + " " + C2("danken", S) + " " + per.de + " für " + o.de + "."; ar = S[1] + " " + AR2("danken", S) + " " + per.ar + " على " + o.ar + ".";
        vocabRefs.push(per.w.id, o.w.id);
      } else if (gram === "gratulieren-zu") {
        const per = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false); const n = pickN(rr, N_ANLASS);
        de = S[0] + " " + C2("gratulieren", S) + " " + per.de + " zum " + n[0] + "."; ar = S[1] + " " + AR2("gratulieren", S) + " " + per.ar + " بـ" + n[1] + ".";
        vocabRefs.push(per.w.id);
      } else {
        const f = fixes[gram];
        const o = f[2] === "dat" ? datPhrase(rr, THING_NOUNS, false) : akkPhrase(rr, THING_NOUNS, false);
        const INF_OF = { "verb-praep-an": "denken", "verb-praep-nach": "fragen", "beschweren-ueber": "beschweren", "informieren-ueber": "informieren", "beginnen-mit": "beginnen", "kuemmern-um": "kümmern", "bewerben-um": "bewerben" };
        let vd = f[0], va = f[1];
        /* subject agreement for fixed Arabic verbs/adjectives */
        if (gram === "verb-praep-an") va = AR2("denken", S) + " في";
        else if (gram === "reflexiv-interesse") va = arAdj("مهتم", subjFem(S), plurality(S)) + " بـ";
        else if (gram === "angst-vor") va = arAdj("خائف", subjFem(S), plurality(S)) + " من";
        else if (gram === "zufrieden-mit") va = zufriedenAr(S) + " عن";
        else if (gram === "danken-fuer") va = AR2("danken", S);
        else if (gram === "gratulieren-zu") va = AR2("gratulieren", S);
        if (gram === "praeposition-mit" || gram === "praeposition-fuer") { const V = pickN(rr, poolOf(0)); vd = Vconj(V[0]) + (gram === "praeposition-mit" ? " mit" : " für"); va = Var(V[0]); }
        else if (INF_OF[gram]) va = AR2(INF_OF[gram], S);
        de = S[0] + " " + vd + " " + o.de + ".";
        ar = S[1] + " " + va + " " + o.ar + ".";
        vocabRefs.push(o.w.id);
      }
    }
    if (gram === "adverb-art" || gram === "praesens" || gram === "inversion" || gram === "adverb-voran" || gram === "lokal-voran" || gram === "lokal-voran-2" || gram === "te-ka-mo-lo") {
      if (gram === "adverb-art") { const a = pickN(rr, ADV_DE); de = S[0] + " " + C2("sprechen", S) + " " + a[0] + " Deutsch."; ar = S[1] + " يتحدث الألمانية " + a[1] + "."; }
    }
    if (gram === "denn-kausal") { const S2 = pickN(rr, SUBJ); de = S[0] + " " + C2("bleiben", S) + " zu Hause, denn " + lowS(S2) + " " + C2("sein", S2) + " krank."; ar = S[1] + " " + AR2("bleiben", S) + " في البيت لأن " + S2[1] + " " + sickAr(S2) + "."; }
    if (gram === "weil-kausal") { const S2 = pickN(rr, SUBJ); de = S[0] + " " + C2("haben", S) + " keine Zeit, weil " + lowS(S2) + " viel " + C2("arbeiten", S2) + "."; ar = "ليس لدى " + S[1] + " وقت لأن " + S2[1] + " " + arSubj("arbeiten", S2) + " كثيرًا."; }
    if (gram === "damit-final") { const S2 = pickN(rr, SUBJ); de = S[0] + " " + C2("sparen", S) + " Geld, damit " + lowS(S2) + " reisen " + C2("können", S2) + "."; ar = S[1] + " " + AR2("sparen", S) + " المال لكي " + AR2("können", S2) + " السفر."; }
    if (gram === "trotz" || gram === "trotz-nominal") { const g = genForm(pickN(rr, THING_NOUNS)); const p = P(); const V = pickN(rr, poolOf(1)); de = S[0] + " " + Vconj(V[0]) + " trotz " + g.de + " " + p[0] + "."; ar = S[1] + " " + Var(V[0]) + " رغم " + g.ar + " " + p[1] + "."; }
    if (gram === "waehrend") { const g = genForm(pickN(rr, THING_NOUNS)); const o = O(); const V = pickN(rr, poolOf(0)); de = "Während " + g.de + " " + Vconj(V[0]) + " " + lowS(S) + " " + o.de + "."; ar = "خلال " + g.ar + " " + Var(V[0]) + " " + S[1] + " " + o.ar + "."; vocabRefs.push(o.w.id); }
    if (gram === "genitiv-praep") { const g = genForm(pickN(rr, THING_NOUNS)); const o = O(); const t = T(); const V = pickN(rr, poolOf(0)); de = S[0] + " " + Vconj(V[0]) + " " + t[0] + " wegen " + g.de + "."; ar = S[1] + " " + Var(V[0]) + " " + t[1] + " بسبب " + g.ar + "."; vocabRefs.push(o.w.id); }
    if (gram === "bevor" || gram === "nachdem" || gram === "obwohl") { /* handled in main chain */ }
  } else {
    const r2 = fillGeneric(rr, deTpl, arTpl, S);
    de = r2.de; ar = r2.ar; vocabRefs.push(...r2.refs.w);
  }

  // final sanity + packaging
  de = de.replace(/\s+/g, " ").trim();
  ar = ar.replace(/\s+/g, " ").trim();
  if (!/[.?!…]$/.test(de)) de += ".";
  seqS++;
  return { id: "ls" + String(seqS).padStart(5, "0"), de, ar, level: lvl, topic, gram: [gram], vocab: [...new Set(vocabRefs)].slice(0, 4) };
}

/* ---------- generate: ~80 per pattern ---------- */
const sentences = [];
const seen = new Set();
const rr = rng("sentences-v1");
let target = 0;
PATS.forEach((p) => { target += 80; });
console.log("patterns:", PATS.length, "target~", target);
let guard = 0;
outer: for (let round = 0; round < 1600; round++) {
  for (const pat of PATS) {
    if (sentences.length >= 150000) break outer;
    guard++;
    try {
      const s = buildOne(rr, pat, guard);
      const n = normDE(s.de);
      if (seen.has(n)) continue;
      seen.add(n);
      s.kap = s.level === "A1" ? "K" + (1 + (sentences.length % 5)) : "KX";
      sentences.push(s);
    } catch (e) { rej("sent-gen", "generator exception: " + e.message); }
  }
}
console.log("sentences built:", sentences.length);

/* vocab refs must resolve: drop unknown */
const vIds = new Set(vocab.map((w) => w.id));
sentences.forEach((s) => { s.vocab = s.vocab.filter((v) => vIds.has(v)); });

/* stage gate */
(function () {
  const r = gate.validateDataset({ vocab, sentences, grammar: [], exercises: [], dialogues: [] });
  console.log("STAGE2 gate: errors=" + r.errors.length + " warnings=" + r.warnings.length);
  r.errors.slice(0, 30).forEach((e) => console.log("  ERR " + e.id + " :: " + e.reason));
  const bad = new Map();
  r.errors.forEach((e) => { if (!bad.has(e.id)) bad.set(e.id, e.reason); });
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (bad.has(sentences[i].id)) { rej(sentences[i].id + " [" + sentences[i].de.slice(0, 40) + "]", bad.get(sentences[i].id)); sentences.splice(i, 1); }
  }
  // re-resolve refs after removals (grammar refs assigned in stage 3)
  const r2 = gate.validateDataset({ vocab, sentences, grammar: [], exercises: [], dialogues: [] });
  console.log("STAGE2 after reject: sentences=" + sentences.length + " errors=" + r2.errors.length);
  r2.errors.slice(0, 10).forEach((e) => console.log("  ERR2 " + e.id + " :: " + e.reason));
  if (r2.errors.length) { console.log("FATAL stage2"); process.exit(1); }
})();
fs.writeFileSync(path.join(__dirname, "clib", ".cache", "sentences.json"), JSON.stringify(sentences));
fs.writeFileSync(path.join(__dirname, "clib", ".cache", "rejected.json"), JSON.stringify(rejected, null, 1));
console.log("stage2 ok");
