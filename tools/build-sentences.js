/* Stage 2 — sentence builder. Deterministic, pool-driven, overrides for special patterns.
   Run: node tools/build-sentences.js  (reads clib/.cache/vocab.json) */
"use strict";
const fs = require("fs");
const path = require("path");
const { rng, pick, shuffle, normDE } = require("./clib/util");
const { SUBJ, TIMES, PLACES, VG_TRAN, VG_INTRAN, VG_DITRAN, VG_MODAL, PATS, STEMS } = require("./clib/sentgen");
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
  const eln = /(el|er)n$/.test(inf);
  if (eln) {
    const full = inf.slice(0, -1), short = full.replace(/e([lr])$/, "$1");
    if (person === "ich") return short + "e";
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
  if (/^(gehen|kommen|fahren|laufen|fliegen|bleiben|sein|werden|aufstehen|ankommen|abfahren|einsteigen|aussteigen|umsteigen|mitkommen|zurückkommen|einschlafen|aufwachen|umziehen|einziehen|ausziehen|scheinen|wachsen|fallen|fliehen|schwimmen|wandern|passieren|reisen)$/.test(c)) return "sein";
  return "haben";
}
function arVerb(base, cperson, fem) {
  const stem = base.replace(/^ي/, "");
  if (cperson === "ich") return "أ" + stem;
  if (cperson === "wir") return "ن" + stem;
  if (cperson === "du" || cperson === "ihr") return "ت" + stem + (cperson === "ihr" ? "ون" : "");
  if (cperson === "sie") return fem === "pl" ? "ي" + stem + "ون" : "ت" + stem;
  return (fem ? "ت" + stem : "ي" + stem);
}
function arPast(base, fem) {
  if (!fem) return base;
  if (/ت$/.test(base)) return base;
  return base + "ت";
}
function arAdj(base, fem) {
  if (!fem || /ة$/.test(base) || /ى$|اء$/.test(base)) return base;
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
function subjFem(S) { return /Schwester|Freundin|Mutter|Ärztin|Nachbarin|Chefin|^Sie$/.test(S[0]) && S[2] !== "siepl" ? true : false; }
function cpersonOf(S) {
  const k = S[2];
  if (k === "ich" || k === "du" || k === "wir" || k === "ihr") return k;
  return "er"; // er/sie/es/Sie -> 3sg stem; siepl -> sie
}
function cpersonFull(S) {
  const k = S[2];
  if (k === "siepl") return "sie";
  if (k === "ich" || k === "du" || k === "wir" || k === "ihr") return k;
  return "er";
}
const CKEY = { ich: "ich", du: "du", er: "er", wir: "wir", ihr: "ihr", sie: "sie" };
const PERSON_NOUNS = nouns.filter((w) => ["family", "people", "relationships"].includes(w.cat));
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
/* ---------- subject-aware helpers ---------- */
function C2(inf, who) { const c = conjPresent(inf, CKEY[cpersonFull(who)]); return c.core + c.tail; }
function AR2(inf, who) { return arVerb(verbArOf(inf), CKEY[cpersonFull(who)], subjFem(who)); }
const REFLPRON = { ich: "mich", du: "dich", er: "sich", wir: "uns", ihr: "euch", sie: "sich" };
function reflConj(inf, who) {
  // present reflexive full form: "freue mich", "interessiert euch"...
  const c = conjPresent(inf, CKEY[cpersonFull(who)]);
  const tail = c.tail ? " " + c.tail.trim() : "";
  return c.core + " " + REFLPRON[CKEY[cpersonFull(who)]] + tail;
}
function AR2refl(arInf, who) {
  // arabic reflexive approx: base verb + reflexive pronoun
  const cp = CKEY[cpersonFull(who)];
  const v = arVerb(arInf, cp, subjFem(who));
  const pro = { ich: "نفسي", du: "نفسك", er: "نفسه", wir: "أنفسنا", ihr: "أنفسكم", sie: "أنفسهم" }[cp];
  return v + " " + pro;
}
function arPastFull(base, who) {
  // arabic past-tense agreement for sound verbs + كان/لدي maps
  const cp = CKEY[cpersonFull(who)], fem = subjFem(who);
  const pl = who[2] === "siepl";
  if (base === "كان") {
    if (cp === "ich" || cp === "du") return "كنت";
    if (cp === "wir") return "كنا";
    if (cp === "ihr") return "كنتم";
    if (pl) return "كانوا";
    return fem ? "كانت" : "كان";
  }
  if (cp === "ich" || cp === "du") return base + "ت";
  if (cp === "wir") return base + "نا";
  if (cp === "ihr") return base + "تم";
  if (pl) return base + "وا";
  return fem ? (/ت$/.test(base) ? base : base + "ت") : base;
}
function hatteAr(who) {
  const cp = CKEY[cpersonFull(who)], fem = subjFem(who), pl = who[2] === "siepl";
  if (cp === "ich") return "كان لديّ";
  if (cp === "du") return "كان لديك";
  if (cp === "wir") return "كان لدينا";
  if (cp === "ihr") return "كان لديكم";
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
    return { de: "die " + plDe, ar: w.ar, w, plural: true };
  }
  return { de: declArt(w.art, "A", false) + " " + w.de, ar: w.ar, w, plural: false };
}
function datPhrase(rr, pool, pluralOk) {
  const w = pickN(rr, pool.length ? pool : THING_NOUNS);
  if (pluralOk && rr() < 0.2 && w.plural !== "-") return { de: "den " + pluralDat(w), ar: w.ar, w, plural: true };
  return { de: declArt(w.art, "D", false) + " " + w.de, ar: w.ar, w, plural: false };
}
function nomPhrase(rr, pool) {
  const w = pickN(rr, pool.length ? pool : THING_NOUNS);
  return { de: declArt(w.art, "N", false) + " " + w.de, ar: w.ar, w };
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
  return arVerb(verbArOf(inf), cp, subjFem(S));
}

function fillGeneric(rr, deTpl, arTpl, S) {
  // generic slot fill for straightforward patterns
  const S2 = pickN(rr, SUBJ);
  let V = pickN(rr, poolOf(0)), V2 = pickN(rr, poolOf(1));
  const O = akkPhrase(rr, THING_NOUNS, true), O1 = nomPhrase(rr, THING_NOUNS), O2 = nomPhrase(rr, THING_NOUNS);
  const O2d = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
  const O3 = datPhrase(rr, THING_NOUNS, false), O4 = akkPhrase(rr, THING_NOUNS, false), O5 = datPhrase(rr, THING_NOUNS, false);
  const O6 = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
  const O7 = akkPhrase(rr, THING_NOUNS, false);
  const O8 = pickN(rr, NAMES);
  const Og = genForm(pickN(rr, THING_NOUNS));
  const T = pickN(rr, TIMES), P = pickN(rr, PLACES);
  const A = pickN(rr, adjs.length ? adjs : [{ de: "gut", ar: "جيد" }]);
  const fem = subjFem(S), fem2 = subjFem(S2);
  const map = {
    "{S}": S[0], "{Sa}": S[1],
    "{S2}": S2[0], "{S2a}": S2[1],
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
    "{A}": A.de, "{Aa}": arAdj(A.ar, fem),
  };
  let de = deTpl, ar = arTpl;
  Object.keys(map).forEach((k) => { de = de.split(k).join(map[k]); ar = ar.split(k).join(map[k]); });
  return { de, ar, refs: { v: [V[0]], w: [O.w.id, O1.w.id], fem } };
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
  const O = () => akkPhrase(rr, THING_NOUNS, true);
  const P = () => pickN(rr, PLACES);
  const T = () => pickN(rr, TIMES);
  const A = () => pickN(rr, adjs);
  let de = deTpl, ar = arTpl, vocabRefs = [], gramRefs = [gram];

  const OV_GONE = 0;
  void OV_GONE;

  /* modal reorder */
  if (/modal|konjunktiv/.test(gram) && deTpl.includes("{Vm}")) {
    const Vm = pickN(rr, Object.keys(MODAL_AR));
    const Vi = pickN(rr, poolInf(3).concat(poolInf(1)));
    const o = O(), t = T(), p = P();
    de = deTpl.split("{S}").join(S[0]).split("{Vm}").join(conjSubj(Vm, S)).split("{Vi}").join(Vi[0]).split("{O}").join(o.de).split("{T}").join(t[0]).split("{P}").join(p[0]);
    ar = MODAL_AR[Vm] + " " + S[1] + " أن " + Vi[1] + (arTpl.includes("{Oa}") ? " " + o.ar : "") + (arTpl.includes("{Ta}") ? " " + t[1] : "") + (arTpl.includes("{Pa}") ? " " + p[1] : "") + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "wehtun") {
    const person = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const part = pickN(rr, BODY.length ? BODY : THING_NOUNS);
    de = person.de + " tut " + declArt(part.art, "N", false) + " " + part.de + " weh.";
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
    de = "Leider " + Vconj(V[0]) + " " + S[0] + " " + t[0] + " nicht.";
    ar = "للأسف لا " + Var(V[0]) + " " + S[1] + " " + t[1] + ".";
  } else if (gram === "um-zu" || gram === "statt-zu" || gram === "ohne-zu" || gram === "um-zu-zweck") {
    const Vi = pickN(rr, poolInf(3).concat(poolInf(1)));
    const sp = splitSep(Vi[0]);
    const zu = sp ? sp.pref + "zu" + sp.stem : "zu " + Vi[0];
    const V = pickN(rr, poolOf(0)); const o = O(); const t = T();
    if (gram === "um-zu-zweck") { de = S[0] + " " + C2("lernen", S) + " Deutsch, um in Deutschland zu arbeiten."; ar = S[1] + " يتعلم الألمانية ليعمل في ألمانيا."; }
    else if (gram === "um-zu") { de = "Um " + zu + ", " + Vconj(V[0]) + " " + S[0] + " " + t[0] + "."; ar = "لكي " + Vi[1] + " " + Var(V[0]) + " " + S[1] + " " + t[1] + "."; vocabRefs.push(o.w.id); }
    else if (gram === "statt-zu") { de = S[0] + " " + Vconj(V[0]) + " " + o.de + ", statt " + zu + "."; ar = S[1] + " " + Var(V[0]) + " " + o.ar + " بدل أن " + Vi[1] + "."; vocabRefs.push(o.w.id); }
    else { de = "Ohne " + zu + " " + Vconj(V[0]) + " " + S[0] + " " + o.de + "."; ar = "بدون أن " + Vi[1] + " " + Var(V[0]) + " " + S[1] + " " + o.ar + "."; vocabRefs.push(o.w.id); }
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
    de = "Falls " + S[0] + " " + Vconj(V[0]) + ", " + C2("sagen", S) + " " + S[0] + " mir Bescheid.";
    ar = "إن " + Var(V[0]) + " " + S[1] + " فليخبرني.";
  } else if (gram === "sobald") {
    const V = pickN(rr, poolOf(1));
    const per = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    const c = conjPresent("anrufen", CKEY[cpersonFull(S)]);
    de = "Sobald " + S[0] + " " + Vconj(V[0]) + ", " + c.core + " " + S[0] + " " + per.w.de + " " + c.tail.trim() + ".";
    ar = "حالما " + Var(V[0]) + " " + S[1] + " يتصل بـ" + per.ar + ".";
    vocabRefs.push(per.w.id);
  } else if (gram === "wenn") {
    const V = pickN(rr, poolOf(1));
    de = "Wenn " + S[0] + " " + Vconj(V[0]) + ", " + reflConj("freuen", S) + ".";
    ar = "إذا " + Var(V[0]) + " " + S[1] + " يفرح.";
  } else if (gram === "reihung") {
    const V = pickN(rr, poolOf(0)); const o = O(); const p = P();
    de = S[0] + " " + Vconj(V[0]) + " " + o.de + " und danach " + C2("gehen", S) + " " + S[0] + " " + p[0] + ".";
    ar = S[1] + " " + Var(V[0]) + " " + o.ar + " وبعدها " + AR2("gehen", S) + " " + p[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "lassen-passiv-sinn") {
    const V = pickN(rr, [["machen", "يفعل"], ["reparieren", "يصلح"], ["lösen", "يحل"], ["ändern", "يغير"]]);
    const o = O();
    de = o.de.charAt(0).toUpperCase() + o.de.slice(1) + " lässt sich nicht " + V[0] + ".";
    ar = o.ar + " لا يمكن " + V[1] + ".";
    vocabRefs.push(o.w.id);
  } else if (gram === "lassen") {
    const pair = pickN(rr, LASSEN_PAIRS);
    de = S[0] + " lässt " + pair[0][1] + " " + pair[1][0] + ".";
    ar = S[1] + " يُصلح " + pair[0][2] + " عند مختص.";
  } else if (gram === "w-frage" || gram === "w-frage-wie" || gram === "w-frage-wo" || gram === "w-frage-wann" || gram === "w-frage-warum") {
    const t = T();
    if (gram === "w-frage") {
      const qs = [["Wer kommt " + t[0] + "?", "من يأتي " + t[1] + "؟"], ["Was passiert " + t[0] + "?", "ماذا يحدث " + t[1] + "؟"], ["Wo wohnst du?", "أين تسكن؟"], ["Wo wohnt " + S[0] + "?", "أين يسكن " + S[1] + "؟"], ["Wann kommt " + S[0] + "?", "متى يأتي " + S[1] + "؟"], ["Warum weint " + S[0] + "?", "لماذا يبكي " + S[1] + "؟"], ["Wie geht es dir?", "كيف حالك؟"], ["Woher kommst du?", "من أين أنت؟"], ["Wohin gehst du?", "إلى أين تذهب؟"]];
      const q = pickN(rr, qs); de = q[0]; ar = q[1];
    } else if (gram === "w-frage-wie") { const w = pickN(rr, WIE_POOL); de = "Wie ist " + w[0] + "?"; ar = "كيف " + w[1] + "؟"; }
    else if (gram === "w-frage-wo") { const w = pickN(rr, WO_POOL); de = "Wo ist " + w[0] + "?"; ar = "أين " + w[1] + "؟"; }
    else if (gram === "w-frage-wann") { const V = pickN(rr, poolOf(1)); de = "Wann " + Vconj(V[0]) + " " + S[0] + "?"; ar = "متى " + Var(V[0]) + " " + S[1] + "؟"; }
    else { const V = pickN(rr, poolOf(0)); const o = O(); de = "Warum " + Vconj(V[0]) + " " + S[0] + " " + o.de + "?"; ar = "لماذا " + Var(V[0]) + " " + S[1] + " " + o.ar + "؟"; vocabRefs.push(o.w.id); }
  } else if (gram === "was-fuer" || gram === "welch-akk") {
    const V = pickN(rr, poolOf(0));
    if (gram === "was-fuer") {
      const mode = rr();
      if (mode < 0.4) { const w = pickN(rr, MASC.length ? MASC : THING_NOUNS); de = "Was für " + declArt(w.art, "A", false) + " " + w.de + " " + Vconj(V[0]) + " " + S[0] + "?"; ar = "أي " + w.ar + " " + Var(V[0]) + " " + S[1] + "؟"; vocabRefs.push(w.id); }
      else if (mode < 0.7) { const w = pickN(rr, nouns.filter((x) => x.art === "die")); de = "Was für eine " + w.de + " " + Vconj(V[0]) + " " + S[0] + "?"; ar = "أي " + w.ar + " " + Var(V[0]) + " " + S[1] + "؟"; vocabRefs.push(w.id); }
      else { const w = pickN(rr, nouns.filter((x) => x.plural && x.plural !== "-")); const pl = /^(der|die|das)\s/.test(w.plural) ? w.plural.replace(/^(der|die|das)\s/, "") : w.plural; de = "Was für " + pl + " " + Vconj(V[0]) + " " + S[0] + "?"; ar = "أي " + w.ar + " (جمع) " + Var(V[0]) + " " + S[1] + "؟"; vocabRefs.push(w.id); }
    }
    else {
      const pick = rr();
      const w = pick < 0.5 ? pickN(rr, MASC.length ? MASC : THING_NOUNS) : pickN(rr, nouns.filter((x) => x.art !== "der"));
      const det = w.art === "der" ? "Welchen" : w.art === "die" ? "Welche" : "Welches";
      de = det + " " + w.de + " " + Vconj(V[0]) + " " + S[0] + "?"; ar = "أي " + w.ar + " " + Var(V[0]) + " " + S[1] + "؟";
      vocabRefs.push(w.id);
    }
  } else if (gram === "obwohl-voran") {
    const S2 = pickN(rr, SUBJ);
    const V = pickN(rr, poolOf(1)); const p = P();
    const mode = rr();
    if (mode < 0.5) { de = "Obwohl " + S2[0] + " müde " + C2("sein", S2) + ", " + Vconj(V[0]) + " " + S[0] + " " + p[0] + "."; ar = "رغم أن " + S2[1] + " متعب " + Var(V[0]) + " " + S[0] + " " + p[1] + "."; }
    else { const opens = [["Obwohl es regnet", "رغم المطر"], ["Obwohl es kalt ist", "رغم البرد"], ["Obwohl es spät ist", "رغم التأخر"], ["Obwohl es dunkel ist", "رغم الظلام"]]; const op = pickN(rr, opens); de = op[0] + ", " + Vconj(V[0]) + " " + S[0] + " " + p[0] + "."; ar = op[1] + " " + Var(V[0]) + " " + S[1] + " " + p[1] + "."; }
  } else if (gram === "perfekt" || gram === "nachdem-satz" || gram === "bevor-satz" || gram === "perfekt-inversion") {
    const pv = pickN(rr, PERFV);
    const aux = auxOf(pv[0]);
    const auxC = conjCore(aux, cp);
    const past = arPast(pv[2], fem);
    if (gram === "perfekt") { de = S[0] + " " + auxC + " " + pv[1] + "."; ar = S[1] + " " + arPastFull(pv[2], S) + "."; }
    else if (gram === "perfekt-inversion") { const t = T(); de = t[0].charAt(0).toUpperCase() + t[0].slice(1) + " " + auxC + " " + S[0] + " " + pv[1] + "."; ar = t[1] + " " + arPastFull(pv[2], S) + " " + S[1] + "."; }
    else if (gram === "nachdem-satz") { const S2 = pickN(rr, SUBJ); const auxPast = aux === "sein" ? (cp === "ich" ? "war" : (cp === "wir" || S[2] === "siepl") ? "waren" : "war") : (cp === "ich" ? "hatte" : (cp === "wir" || S[2] === "siepl") ? "hatten" : "hatte"); const rc = conjPresent("ausruhen", CKEY[cpersonFull(S2)]); de = "Nachdem " + S[0] + " " + pv[1] + " " + auxPast + ", " + rc.core + " " + S2[0] + " sich " + rc.tail.trim() + "."; ar = "بعد أن " + arPastFull(pv[2], S) + " " + S[1] + " يرتاح " + S2[1] + "."; }
    else { const S2 = pickN(rr, SUBJ); const V = pickN(rr, poolOf(0)); de = "Bevor " + S[0] + " " + Vconj(V[0]) + ", " + C2("trinken", S2) + " " + S2[0] + " einen Kaffee."; ar = "قبل أن " + Var(V[0]) + " " + S[1] + " يشرب " + S2[1] + " قهوة."; }
  } else if (gram === "passiv" || gram === "passiv-modal") {
    const pv = pickN(rr, PASSV);
    const o = O();
    if (gram === "passiv") { de = o.de.charAt(0).toUpperCase() + o.de.slice(1) + " wird " + pv[1] + "."; ar = o.ar + " " + pv[2] + "."; }
    else { de = o.de.charAt(0).toUpperCase() + o.de.slice(1) + " kann " + pv[1] + " werden."; ar = "يمكن " + pv[2] + " " + o.ar + "."; }
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
    ar = S[1] + " " + arVerb(sv.ar, cp, fem) + " " + t[1] + ".";
    vocabRefs.push(sv.id);
  } else if (gram === "sein-adj" || gram === "werden" || gram === "praeteritum-sein") {
    const a = A();
    const isPl = (cp === "wir" || S[2] === "siepl");
    const verb = gram === "werden" ? conjCore("werden", cp) : gram === "praeteritum-sein" ? (cp === "ich" ? "war" : cp === "du" ? "warst" : isPl ? "waren" : cp === "ihr" ? "wart" : "war") : conjCore("sein", cp);
    de = S[0] + " " + verb + " " + a.de + ".";
    ar = (gram === "praeteritum-sein" ? arPastFull("كان", S) + " " + S[1] + " " : S[1] + " ") + arAdj(a.ar, fem) + ".";
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
    else { de = "Je mehr " + S[0] + " übt, desto besser wird es."; ar = "كلما تدرب " + S[1] + " أكثر صار أفضل."; }
    vocabRefs.push(o1.w.id, o2.w.id);
  } else if (gram === "futur") {
    const Vi = pickN(rr, poolInf(3).concat(poolInf(1))); const t = T();
    de = S[0] + " " + conjCore("werden", cp) + " " + t[0] + " " + Vi[0] + ".";
    ar = S[1] + " سوف " + Vi[1] + " " + t[1] + ".";
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
    const o = akkPhrase(rr, THING_NOUNS, true); const p = P();
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
    if (gram === "vorstellen") { de = S[0] + " " + v.core + " " + o.de + " " + per.de + " " + v.tail.trim() + "."; ar = S[1] + " " + AR2("vorstellen", S) + " " + o.ar + " لـ" + per.ar + "."; }
    else if (gram === "erklaeren") { de = S[0] + " " + Vconj("erklären") + " " + per.de + " " + o.de + "."; ar = S[1] + " " + AR2("erklären", S) + " لـ" + per.ar + " " + o.ar + "."; }
    else if (gram === "zeigen") { de = S[0] + " " + Vconj("zeigen") + " " + per.de + " " + o.de + "."; ar = S[1] + " " + AR2("zeigen", S) + " " + per.ar + " " + o.ar + "."; }
    else if (gram === "helfen-bei") { const n = pickN(rr, N_ACT); de = S[0] + " " + C2("helfen", S) + " " + per.de + " beim " + n[0] + "."; ar = S[1] + " " + AR2("helfen", S) + " " + per.ar + " في " + n[1] + "."; }
    else { de = S[0] + " " + C2("helfen", S) + " " + per.de + " bei " + o.de + "."; ar = S[1] + " " + AR2("helfen", S) + " " + per.ar + " في " + o.ar + "."; }
    vocabRefs.push(per.w.id, o.w.id);
  } else if (gram === "wuenschen" || gram === "einkaufen-fuer" || gram === "kochen-fuer" || gram === "sparen-fuer") {
    const per = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
    if (gram === "wuenschen") { const n = pickN(rr, N_WUNSCH); de = S[0] + " " + C2("wünschen", S) + " " + per.de + " viel " + n[0] + "."; ar = S[1] + " " + AR2("wünschen", S) + " لـ" + per.ar + " الكثير من " + n[1] + "."; }
    else if (gram === "sparen-fuer") { const o = O(); de = S[0] + " " + Vconj("sparen") + " für " + o.de + "."; ar = S[1] + " " + AR2("sparen", S) + " لـ" + o.ar + "."; vocabRefs.push(o.w.id); }
    else { const o = O(); const v = gram === "einkaufen-fuer" ? conjPresent("einkaufen", cp) : { core: Vconj("kochen"), tail: "" }; de = S[0] + " " + v.core + " für " + per.de + " " + o.de + (v.tail ? " " + v.tail.trim() : "") + "."; ar = S[1] + " " + AR2(gram === "einkaufen-fuer" ? "einkaufen" : "kochen", S) + " لـ" + per.ar + " " + o.ar + "."; vocabRefs.push(o.w.id); }
    vocabRefs.push(per.w.id);
  } else if (gram === "zahlen-mit" || gram === "bar-zahlen" || gram === "kosten") {
    const o = O();
    if (gram === "kosten") { const pr = pickN(rr, O_PREIS); de = o.de.charAt(0).toUpperCase() + o.de.slice(1) + " kostet " + pr[0] + "."; ar = o.ar + " يكلف " + pr[1] + "."; }
    else if (gram === "bar-zahlen") { de = S[0] + " " + Vconj("bezahlen") + " " + o.de + " bar."; ar = S[1] + " " + AR2("bezahlen", S) + " " + o.ar + " نقدًا."; }
    else { const z = pickN(rr, O_ZAHL); de = S[0] + " " + Vconj("zahlen") + " " + o.de + " " + z[0] + "."; ar = S[1] + " " + AR2("zahlen", S) + " " + o.ar + " " + z[1] + "."; }
    vocabRefs.push(o.w.id);
  } else if (gram === "sein-fuer" || gram === "sein-von" || gram === "lust-auf" || gram === "angst-vor" || gram === "stolz-auf" || gram === "zufrieden-mit" || gram === "beginnen-mit" || gram === "aufhoeren-mit" || gram === "warten-auf-seit" || gram === "kuemmern-um" || gram === "bewerben-um" || gram === "beschweren-ueber" || gram === "informieren-ueber" || gram === "freuen-auf" || gram === "danken-fuer" || gram === "gratulieren-zu" || gram === "verb-praep-auf" || gram === "verb-praep-an" || gram === "verb-praep-nach" || gram === "sprechen-ueber" || gram === "praeposition-mit" || gram === "praeposition-fuer" || gram === "reflexiv-freuen" || gram === "reflexiv-interesse" || gram === "reflexiv-beeilen" || gram === "reflexiv-aergern" || gram === "denn-kausal" || gram === "weil-kausal" || gram === "damit-final" || gram === "trotz" || gram === "trotz-nominal" || gram === "waehrend" || gram === "bevor" || gram === "nachdem" || gram === "bevor-satz" || gram === "waehrend-satz" || gram === "sobald" || gram === "seit-dauer" || gram === "bis-zeit" || gram === "von-bis" || gram === "herkunft-wohnen" || gram === "seit-lernen" || gram === "te-ka-mo-lo" || gram === "adverb-voran" || gram === "lokal-voran" || gram === "lokal-voran-2" || gram === "inversion" || gram === "praesens" || gram === "negation" || gram === "kein" || gram === "ja-nein-frage" || gram === "akk-doppelt" || gram === "finden-adj" || gram === "und-koordination" || gram === "dativ" || gram === "genitiv-praep" || gram === "obwohl" || gram === "zwar-aber" || gram === "nicht-nur-sondern" || gram === "sowohl-als-auch" || gram === "entweder-oder" || gram === "dativ" || gram === "possessiv-sein") {
    const r = fillGeneric(rr, deTpl, arTpl, S);
    de = r.de; ar = r.ar; vocabRefs.push(...r.refs.w);
    // fix verb slot for ditransitive/dativ patterns needing specific verbs
    if (gram === "dativ") {
      const V = pickN(rr, poolOf(2)); const o1 = akkPhrase(rr, THING_NOUNS, false); const o2 = datPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false);
      de = S[0] + " " + Vconj(V[0]) + " " + o2.de + " " + o1.de + ".";
      ar = S[1] + " " + AR2(V[0], S) + " " + o2.ar + " " + o1.ar + ".";
      vocabRefs.push(o1.w.id, o2.w.id);
    }
    if (gram === "akk-doppelt") {
      const o1 = akkPhrase(rr, PERSON_NOUNS.length ? PERSON_NOUNS : THING_NOUNS, false); const n = pickN(rr, NAMES);
      de = S[0] + " " + C2("nennen", S) + " " + o1.de + " " + n[0] + ".";
      ar = S[1] + " يسمي " + o1.ar + " " + n[1] + ".";
      vocabRefs.push(o1.w.id);
    }
    if (gram === "finden-adj") {
      const o = O(); const a = A();
      de = S[0] + " " + C2("finden", S) + " " + o.de + " " + a.de + ".";
      ar = S[1] + " يجد " + o.ar + " " + a.ar + ".";
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
      ar = S[1] + " قادم من " + p1[1] + " ويسكن الآن " + p2[1] + ".";
    }
    if (gram === "seit-lernen") {
      const tg = pickN(rr, T_DAUER);
      de = S[0] + " " + C2("lernen", S) + " seit " + tg[0] + " Deutsch.";
      ar = S[1] + " يتعلم الألمانية منذ " + tg[1] + ".";
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
      ar = S[1] + " يبقى حتى " + tg[1] + ".";
    }
    if (gram === "je-desto" || gram === "je-desto-2") { de = "Je öfter " + S[0] + " " + C2("üben", S) + ", desto besser wird es."; ar = "كلما تدرب " + S[1] + " أكثر صار أفضل."; }
    if (gram === "possessiv-sein") { de = de.replace("für seine Familie", "für " + (fem ? "ihre" : "seine") + " Familie"); }
    if (gram === "verb-praep-auf" || gram === "lust-auf" || gram === "stolz-auf" || gram === "freuen-auf" || gram === "reflexiv-freuen") {
      const o = akkPhrase(rr, THING_NOUNS, false);
      if (gram === "verb-praep-auf") { de = S[0] + " " + Vconj("warten") + " auf " + o.de + "."; ar = S[1] + " ينتظر " + o.ar + "."; }
      else if (gram === "lust-auf") { de = S[0] + " " + C2("haben", S) + " Lust auf " + o.de + "."; ar = "لدى " + S[1] + " رغبة في " + o.ar + "."; }
      else if (gram === "stolz-auf") { de = S[0] + " " + conjCore("sein", cp) + " stolz auf " + o.de + "."; ar = S[1] + " فخور بـ" + o.ar + "."; }
      else if (gram === "freuen-auf") { de = S[0] + " " + reflConj("freuen", S) + " auf " + o.de + "."; ar = S[1] + " متشوق لـ" + o.ar + "."; }
      else { de = S[0] + " " + reflConj("freuen", S) + " über " + o.de + "."; ar = S[1] + " سعيد بـ" + o.ar + "."; }
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
        de = S[0] + " " + reflConj("beeilen", S) + ", weil " + S2[0] + " spät dran ist.";
        ar = S[1] + " مستعجل لأن " + S2[1] + " متأخر.";
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
    if (gram === "denn-kausal") { const S2 = pickN(rr, SUBJ); de = S[0] + " bleibt zu Hause, denn " + S2[0] + " " + C2("sein", S2) + " krank."; ar = S[1] + " يبقى في البيت لأن " + S2[1] + " مريض."; }
    if (gram === "weil-kausal") { const S2 = pickN(rr, SUBJ); de = S[0] + " hat keine Zeit, weil " + S2[0] + " viel " + C2("arbeiten", S2) + "."; ar = "ليس لدى " + S[1] + " وقت لأن " + S2[1] + " يعمل كثيرًا."; }
    if (gram === "damit-final") { const S2 = pickN(rr, SUBJ); de = S[0] + " spart Geld, damit " + S2[0] + " " + C2("reisen", S2) + " kann."; ar = S[1] + " يدخر المال لكي يستطيع " + S2[1] + " السفر."; }
    if (gram === "trotz" || gram === "trotz-nominal") { const g = genForm(pickN(rr, THING_NOUNS)); const p = P(); const V = pickN(rr, poolOf(1)); de = S[0] + " " + Vconj(V[0]) + " trotz " + g.de + " " + p[0] + "."; ar = S[1] + " " + Var(V[0]) + " رغم " + g.ar + " " + p[1] + "."; }
    if (gram === "waehrend") { const g = genForm(pickN(rr, THING_NOUNS)); const o = O(); const V = pickN(rr, poolOf(0)); de = "Während " + g.de + " " + Vconj(V[0]) + " " + S[0] + " " + o.de + "."; ar = "خلال " + g.ar + " " + Var(V[0]) + " " + S[1] + " " + o.ar + "."; vocabRefs.push(o.w.id); }
    if (gram === "genitiv-praep") { const g = genForm(pickN(rr, THING_NOUNS)); const o = O(); const t = T(); const V = pickN(rr, poolOf(0)); de = S[0] + " " + Vconj(V[0]) + " " + t[0] + " wegen " + g.de + "."; ar = S[1] + " " + Var(V[0]) + " " + t[1] + " بسبب " + g.ar + "."; vocabRefs.push(o.w.id); }
    if (gram === "bevor") { const V = pickN(rr, poolOf(0)); de = "Bevor " + S[0] + " " + Vconj(V[0]) + ", " + reflConj("freuen", S) + "."; ar = "قبل أن " + Var(V[0]) + " " + S[1] + " يفرح."; }
    if (gram === "nachdem") { const V = pickN(rr, poolOf(0)); de = "Nachdem " + S[0] + " " + Vconj(V[0]) + ", " + reflConj("freuen", S) + "."; ar = "بعد أن " + Var(V[0]) + " " + S[1] + " يفرح."; }
    if (gram === "obwohl") { const S2 = pickN(rr, SUBJ); de = de.replace("müde ist", C2("sein", S2) + " müde"); }
  } else {
    const r = fillGeneric(rr, deTpl, arTpl, S);
    de = r.de; ar = r.ar; vocabRefs.push(...r.refs.w);
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
outer: for (let round = 0; round < 120; round++) {
  for (const pat of PATS) {
    if (sentences.length >= 12150) break outer;
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
