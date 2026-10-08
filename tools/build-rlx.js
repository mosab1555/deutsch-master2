/* Stage 6 — reading passages (5k), listening scripts (10k), exam configs (10k).
   Deterministic, quality-gated. Reading passages partition the sentence bank
   (no sentence reuse); listening derives from dialogues; exams are generated
   configurations over the validated bank. Rerun-safe via haveIds + max-seq.
   Run: node tools/build-rlx.js */
"use strict";
const fs = require("fs");
const path = require("path");
const { rng, normDE } = require("./clib/util");
const gate = require("./content-quality-gate");

const cache = path.join(__dirname, "clib", ".cache");
const vocab = JSON.parse(fs.readFileSync(path.join(cache, "vocab.json"), "utf8"));
const sentences = JSON.parse(fs.readFileSync(path.join(cache, "sentences.json"), "utf8"));
const dialogues = JSON.parse(fs.readFileSync(path.join(cache, "dialogues.json"), "utf8"));
const R = (f) => { try { return JSON.parse(fs.readFileSync(path.join(cache, f), "utf8")); } catch (e) { return []; } };
const readingOld = R("reading.json"), listeningOld = R("listening.json"), examsOld = R("exams.json");
const rejected = JSON.parse(fs.readFileSync(path.join(cache, "rejected.json"), "utf8"));
function rej(id, reason) { rejected.push({ id, reason }); }

const rr = rng("rlx-v1");
const pickN = (arr) => arr[Math.floor(rr() * arr.length)];
const vById = new Map(vocab.map((w) => [w.id, w]));
const byCatAr = new Map();
vocab.forEach((w) => { if (!byCatAr.has(w.cat)) byCatAr.set(w.cat, []); byCatAr.get(w.cat).push(w); });
function arDistractors(w, n, exclude) {
  const out = [];
  const pool = (byCatAr.get(w.cat) || []).filter((x) => x.id !== w.id);
  for (const c of pool) { if (out.length >= n) break; if (c.ar !== w.ar && !out.includes(c.ar) && !exclude.includes(c.ar)) out.push(c.ar); }
  if (out.length < n) for (const c of vocab) {
    if (out.length >= n) break;
    if (c.id !== w.id && c.ar !== w.ar && !out.includes(c.ar) && !exclude.includes(c.ar)) out.push(c.ar);
  }
  return out;
}

/* topic labels for titles */
const TOPIC_DE = { family: "Familie", people: "Menschen", home: "Zuhause", rooms: "Zimmer", furniture: "Möbel", school: "Schule", university: "Universität", education: "Bildung", work: "Arbeit", jobs: "Berufe", workplace: "Arbeitsplatz", travel: "Reisen", airport: "Flughafen", station: "Bahnhof", transport: "Verkehr", roads: "Straßen", city: "Stadt", neighborhood: "Nachbarschaft", shopping: "Einkaufen", supermarket: "Supermarkt", clothing: "Kleidung", food: "Essen", drinks: "Getränke", restaurant: "Restaurant", hotel: "Hotel", health: "Gesundheit", body: "Körper", doctor: "Arzt", pharmacy: "Apotheke", hospital: "Krankenhaus", emergency: "Notfall", weather: "Wetter", seasons: "Jahreszeiten", nature: "Natur", animals: "Tiere", tech: "Technik", computers: "Computer", internet: "Internet", phones: "Handy", social: "Soziales", banking: "Bank", money: "Geld", services: "Service", documents: "Dokumente", appointments: "Termine", communication: "Kommunikation", routine: "Alltag", hobbies: "Hobbys", sports: "Sport", emotions: "Gefühle", relationships: "Beziehungen", time: "Zeit", dates: "Datum", numbers: "Zahlen", directions: "Wegbeschreibung", location: "Orte", dailylife: "Alltag", germany: "Deutschland", study: "Studium", ausbildung: "Ausbildung", unilife: "Unileben", worktalk: "Beruf", applications: "Bewerbung", interviews: "Interview", profi: "Profis", colloquial: "Umgangssprache", polite: "Höflichkeit", general: "Allgemeines", verbs: "Verben", adjectives: "Adjektive" };
const TOPIC_AR = { family: "العائلة", people: "الناس", home: "البيت", rooms: "الغرف", furniture: "الأثاث", school: "المدرسة", university: "الجامعة", education: "التعليم", work: "العمل", jobs: "المهن", workplace: "مكان العمل", travel: "السفر", airport: "المطار", station: "المحطة", transport: "المواصلات", roads: "الطرق", city: "المدينة", neighborhood: "الحي", shopping: "التسوق", supermarket: "السوبرماركت", clothing: "الملابس", food: "الطعام", drinks: "المشروبات", restaurant: "المطعم", hotel: "الفندق", health: "الصحة", body: "الجسم", doctor: "الطبيب", pharmacy: "الصيدلية", hospital: "المستشفى", emergency: "الطوارئ", weather: "الطقس", seasons: "الفصول", nature: "الطبيعة", animals: "الحيوانات", tech: "التقنية", computers: "الحاسوب", internet: "الإنترنت", phones: "الهاتف", social: "المجتمع", banking: "البنك", money: "النقود", services: "الخدمات", documents: "المستندات", appointments: "المواعيد", communication: "التواصل", routine: "الروتين", hobbies: "الهوايات", sports: "الرياضة", emotions: "المشاعر", relationships: "العلاقات", time: "الوقت", dates: "التاريخ", numbers: "الأرقام", directions: "الاتجاهات", location: "الأماكن", dailylife: "الحياة اليومية", germany: "ألمانيا", study: "الدراسة", ausbildung: "التدريب المهني", unilife: "الحياة الجامعية", worktalk: "لغة العمل", applications: "التقديم", interviews: "المقابلات", profi: "المحترفون", colloquial: "العامية", polite: "الآداب", general: "عام", verbs: "الأفعال", adjectives: "الصفات" };

/* ---------- READING (partition sentence bank, no reuse) ---------- */
const reading = [];
(function () {
  const have = new Set(readingOld.map((r) => r.id));
  let seq = readingOld.reduce((m, r) => Math.max(m, parseInt(r.id.slice(2), 10) || 0), 0);
  const groups = new Map();
  sentences.forEach((s) => {
    const k = s.level + "|" + s.topic;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  });
  const keys = [...groups.keys()].sort();
  // non-overlapping partitions of 6 per group
  const chunks = [];
  keys.forEach((k) => {
    const arr = groups.get(k);
    for (let i = 0; i + 6 <= arr.length; i += 6) chunks.push([k, arr.slice(i, i + 6)]);
  });
  const byLevel = new Map();
  sentences.forEach((s) => {
    if (!byLevel.has(s.level)) byLevel.set(s.level, []);
    byLevel.get(s.level).push(s);
  });
  const seen = new Set(readingOld.map((r) => normDE(r.de)));
  let made = 0;
  for (let round = 0; round < 200 && readingOld.length + reading.length < 5000; round++) {
    for (let ci = round; ci < chunks.length && readingOld.length + reading.length < 5000; ci += 200) {
      const [k, slice] = chunks[ci];
      const [lvl, topic] = k.split("|");
      const de = slice.map((s) => s.de).join(" ");
      const ar = slice.map((s) => s.ar).join(" ");
      const nkey = normDE(de);
      if (seen.has(nkey)) continue;
      seen.add(nkey);
      // questions: detail (which sentence is in the text?) + vocab-in-context
      const others = byLevel.get(lvl).filter((s) => slice.every((x) => x.id !== s.id));
      if (others.length < 2) continue;
      const d0 = slice[Math.floor(rr() * slice.length)];
      const dd = [];
      for (const c of others) { if (dd.length >= 2) break; if (!dd.some((x) => normDE(x.de) === normDE(c.de))) dd.push(c); }
      if (dd.length < 2) continue;
      const dq = { q: "Welche Aussage steht im Text؟", choices: [d0.de, dd[0].de, dd[1].de], answer: 0 };
      // rotate answer position deterministically
      const rot = made % 3;
      const ch = [dq.choices[rot % 3], dq.choices[(rot + 1) % 3], dq.choices[(rot + 2) % 3]];
      dq.choices = ch; dq.answer = ch.indexOf(d0.de);
      let vq = null;
      for (const s of slice) {
        for (const vid of (s.vocab || [])) {
          const w = vById.get(vid);
          if (!w || / /.test(w.de)) continue;
          const dis = arDistractors(w, 2, []);
          if (dis.length < 2) continue;
          const ch2 = [w.ar, dis[0], dis[1]];
          const r2 = (made + 1) % 3;
          const cc = [ch2[r2 % 3], ch2[(r2 + 1) % 3], ch2[(r2 + 2) % 3]];
          vq = { q: "Was bedeutet «" + w.de + "» im Text؟", choices: cc, answer: cc.indexOf(w.ar) };
          break;
        }
        if (vq) break;
      }
      if (!vq) {
        const d1 = slice[(slice.indexOf(d0) + 1) % slice.length];
        vq = { q: "Welche Aussage steht auch im Text؟", choices: [d1.de, dd[0].de, dd[1].de], answer: 0 };
        const r3 = (made + 2) % 3;
        const cc = [vq.choices[r3 % 3], vq.choices[(r3 + 1) % 3], vq.choices[(r3 + 2) % 3]];
        vq.choices = cc; vq.answer = cc.indexOf(d1.de);
      }
      const vids = [...new Set(slice.flatMap((s) => s.vocab || []))].slice(0, 6);
      const gids = [...new Set(slice.flatMap((s) => s.grammar || []))].slice(0, 3);
      seq++;
      const id = "lr" + String(seq).padStart(5, "0");
      if (have.has(id)) { seq--; continue; }
      const tDe = TOPIC_DE[topic] || topic, tAr = TOPIC_AR[topic] || topic;
      reading.push({
        id, title: tDe + " im Alltag (Teil " + (made + 1) + ")", titleAr: tAr + " في الحياة اليومية (جزء " + (made + 1) + ")",
        level: lvl, topic, de, ar, questions: [dq, vq], vocab: vids, grammar: gids,
      });
      made++;
    }
  }
  console.log("reading built: " + reading.length + " new");
})();

/* ---------- LISTENING (one script per dialogue) ---------- */
const listening = [];
(function () {
  const have = new Set(listeningOld.map((l) => l.id));
  let seq = listeningOld.reduce((m, l) => Math.max(m, parseInt(l.id.slice(2), 10) || 0), 0);
  const seen = new Set(listeningOld.map((l) => normDE(l.lines.map((x) => x[1]).join(" | "))));
  let made = 0;
  for (let di = 0; di < dialogues.length; di++) {
    const d = dialogues[di];
    if (listeningOld.length + listening.length >= 10000) break;
    if (d.lines.length < 3) continue;
    for (let wnd = 0; wnd < 2; wnd++) {
      if (listeningOld.length + listening.length >= 10000) break;
      const start = (made * 2 + wnd * 3) % (d.lines.length - 1);
      const lines = d.lines.slice(start, start + 4);
      if (lines.length < 2) continue;
    const nkey = normDE(lines.map((x) => x[1]).join(" | "));
    if (seen.has(nkey)) continue;
    seen.add(nkey);
    const li = made % lines.length;
    const correct = lines[li][2];
    const distract = [];
    for (let k = 1; k <= 4 && distract.length < 2; k++) {
      const other = dialogues[(di + k * 37) % dialogues.length];
      const cand = other.lines[(li + k) % other.lines.length][2];
      if (cand !== correct && !distract.includes(cand)) distract.push(cand);
    }
    if (distract.length < 2) continue;
    const rot = made % 3;
    const ch = [correct, distract[0], distract[1]];
    const cc = [ch[rot % 3], ch[(rot + 1) % 3], ch[(rot + 2) % 3]];
    const q1 = { q: "Was sagt " + lines[li][0] + " (Satz " + (li + 1) + " nach «" + lines[0][1].slice(0, 30) + "…»)؟", choices: cc, answer: cc.indexOf(correct) };
    const li2 = (li + 1) % lines.length;
    const correct2 = lines[li2][1];
    const d2 = [];
    for (let k = 2; k <= 6 && d2.length < 2; k++) {
      const other = dialogues[(di + k * 53) % dialogues.length];
      const cand = other.lines[(li2 + k) % other.lines.length][1];
      if (normDE(cand) !== normDE(correct2) && !d2.some((x) => normDE(x) === normDE(cand))) d2.push(cand);
    }
    if (d2.length < 2) continue;
    const rot2 = (made + 1) % 3;
    const ch2 = [correct2, d2[0], d2[1]];
    const cc2 = [ch2[rot2 % 3], ch2[(rot2 + 1) % 3], ch2[(rot2 + 2) % 3]];
    const q2 = { q: "Welcher Satz kommt im Gespräch «" + lines[0][1].slice(0, 30) + "…» vor؟", choices: cc2, answer: cc2.indexOf(correct2) };
    seq++;
    const id = "ll" + String(seq).padStart(5, "0");
    if (have.has(id)) { seq--; continue; }
    listening.push({
      id, level: d.level, topic: d.topic, titleDe: d.titleDe, titleAr: d.titleAr,
      lines, questions: [q1, q2], vocab: [], grammar: [],
      audio: { tts: true, rate: d.level === "A1" ? 0.9 : 1.0 },
    });
    made++;
    }
  }
  console.log("listening built: " + listening.length + " new");
})();

/* ---------- LISTENING top-up from sentences (if dialogue-derived < 10k) ---------- */
(function () {
  const cur = JSON.parse(fs.readFileSync(path.join(cache, "listening.json"), "utf8"));
  if (cur.length >= 10000) { console.log("listening top-up: not needed"); return; }
  const have = new Set(cur.map((l) => l.id));
  let seq = cur.reduce((m, l) => Math.max(m, parseInt(l.id.slice(2), 10) || 0), 0);
  const seen = new Set(cur.map((l) => normDE(l.lines.map((x) => x[1]).join(" | "))));
  const groups = new Map();
  sentences.forEach((s) => {
    const k = s.level + "|" + s.topic;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  });
  const keys = [...groups.keys()].sort();
  const extra = [];
  outer: for (const k of keys) {
    if (cur.length + extra.length >= 10000) break;
    const [lvl, topic] = k.split("|");
    const arr = groups.get(k);
    for (let i = 0; i + 4 <= arr.length && cur.length + extra.length < 10000; i += 4) {
      const slice = arr.slice(i, i + 4);
      const lines = slice.map((s) => ["Sprecher", s.de, s.ar]);
      const nkey = normDE(lines.map((x) => x[1]).join(" | "));
      if (seen.has(nkey)) continue;
      seen.add(nkey);
      const li = extra.length % lines.length;
      const correct = lines[li][2];
      const distract = [];
      for (let kk = 1; kk <= 6 && distract.length < 2; kk++) {
        const o = arr[(i + kk * 3) % arr.length];
        if (o.ar !== correct && !distract.includes(o.ar)) distract.push(o.ar);
      }
      if (distract.length < 2) continue;
      const rot = extra.length % 3;
      const ch = [correct, distract[0], distract[1]];
      const cc = [ch[rot % 3], ch[(rot + 1) % 3], ch[(rot + 2) % 3]];
      const q1 = { q: "Was hört man (Satz " + (li + 1) + " von " + lines.length + ")؟", choices: cc, answer: cc.indexOf(correct) };
      const li2 = (li + 1) % lines.length;
      const correct2 = lines[li2][1];
      const d2 = [];
      for (let kk = 2; kk <= 8 && d2.length < 2; kk++) {
        const o = arr[(i + kk * 5) % arr.length];
        if (normDE(o.de) !== normDE(correct2) && !d2.some((x) => normDE(x) === normDE(o.de))) d2.push(o.de);
      }
      if (d2.length < 2) continue;
      const rot2 = (extra.length + 1) % 3;
      const ch2 = [correct2, d2[0], d2[1]];
      const cc2 = [ch2[rot2 % 3], ch2[(rot2 + 1) % 3], ch2[(rot2 + 2) % 3]];
      const q2 = { q: "Welcher Satz kommt im Hörtext «" + lines[0][1].slice(0, 30) + "…» vor؟", choices: cc2, answer: cc2.indexOf(correct2) };
      seq++;
      const id = "ll" + String(seq).padStart(5, "0");
      if (have.has(id)) { seq--; continue; }
      const tDe = TOPIC_DE[topic] || topic, tAr = TOPIC_AR[topic] || topic;
      extra.push({
        id, level: lvl, topic, titleDe: "Hören: " + tDe + " (" + (extra.length + 1) + ")", titleAr: "استماع: " + tAr + " (" + (extra.length + 1) + ")",
        lines, questions: [q1, q2], vocab: [], grammar: [],
        audio: { tts: true, rate: lvl === "A1" ? 0.9 : 1.0 },
      });
    }
  }
  void 0;
  const final = cur.concat(extra);
  const ds = { vocab, sentences: [], grammar: R("grammar.json"), exercises: [], dialogues: [], reading: R("reading.json"), listening: final, exams: R("exams.json") };
  const r = gate.validateDataset(ds);
  console.log("listening top-up: +" + extra.length + " errors=" + r.errors.length);
  const bad = new Set(r.errors.map((e) => e.id));
  const kept = extra.filter((x) => !bad.has(x.id));
  const final2 = cur.concat(kept);
  const r2 = gate.validateDataset({ vocab, sentences: [], grammar: R("grammar.json"), exercises: [], dialogues: [], reading: R("reading.json"), listening: final2, exams: R("exams.json") });
  if (r2.errors.length) { console.log("FATAL top-up"); r2.errors.slice(0, 5).forEach((e) => console.log("  ERR " + e.id + " :: " + e.reason)); process.exit(1); }
  fs.writeFileSync(path.join(cache, "listening.json"), JSON.stringify(final2));
  console.log("listening total: " + final2.length);
})();

/* ---------- EXAMS (10k configurations, stride-sampled for balance) ---------- */
const exams = [];
(function () {
  const have = new Set(examsOld.map((x) => x.id));
  const CATS = Object.keys(TOPIC_DE);
  const SKILLS = [["vocab"], ["grammar"], ["sentences"], ["vocab", "grammar"], ["vocab", "sentences"], ["grammar", "sentences"], ["vocab", "grammar", "sentences"], ["listening"], ["reading"], ["mixed"]];
  const SIZES = [10, 15, 20, 30, 50];
  const TIMED = [{ t: true, s: 300 }, { t: true, s: 600 }, { t: false, s: 0 }];
  const all = [];
  for (const lvl of ["A1", "A2", "B1"])
    for (const sk of SKILLS)
      for (const tp of CATS.concat(["mixed"]))
        for (const sz of SIZES)
          for (const tm of TIMED) all.push([lvl, sk, tp, sz, tm]);
  const SKL = { vocab: "Wortschatz", grammar: "Grammatik", sentences: "Sätze", listening: "Hören", reading: "Lesen", mixed: "Mix" };
  let n = 0;
  for (let i = 0; i < all.length && examsOld.length + exams.length < 10000; i += 1) {
    const idx = Math.floor((i * all.length) / 10000) % all.length;
    if (all[idx][4].used) continue;
    all[idx][4] = Object.assign({}, all[idx][4], { used: true });
    const [lvl, sk, tp, sz, tm] = all[idx];
    n++;
    const id = "lx" + String(examsOld.length + n).padStart(5, "0");
    if (have.has(id)) continue;
    const skL = sk.map((s) => SKL[s]).join("+");
    const tpL = tp === "mixed" ? "Mix" : (TOPIC_DE[tp] || tp);
    exams.push({
      id, level: lvl, topic: tp, title: lvl + " " + skL + ": " + tpL + " (" + sz + " Fragen" + (tm.t ? ", mit Zeit" : "") + ")",
      titleAr: lvl + " " + skL + ": " + (TOPIC_AR[tp] || tp) + " (" + sz + " سؤال" + (tm.t ? "، بتوقيت" : "") + ")",
      skills: sk, types: ["choice", "gap", "article", "translate"], count: sz, timed: tm.t, seconds: tm.s,
    });
  }
  console.log("exams built: " + exams.length + " new");
})();

/* ---------- validation + write ---------- */
(function () {
  const grammar = R("grammar.json");
  const ds = {
    vocab, sentences: [], grammar, exercises: [], dialogues: [],
    reading: readingOld.concat(reading), listening: listeningOld.concat(listening), exams: examsOld.concat(exams),
  };
  const r = gate.validateDataset(ds);
  console.log("STAGE6 gate: errors=" + r.errors.length + " warnings=" + r.warnings.length);
  r.errors.slice(0, 20).forEach((e) => console.log("  ERR " + e.id + " :: " + e.reason));
  const bad = new Set(r.errors.map((e) => e.id));
  const kr = reading.filter((x) => !bad.has(x.id));
  const kl = listening.filter((x) => !bad.has(x.id));
  const ke = exams.filter((x) => !bad.has(x.id));
  bad.forEach((id) => rej(id, "rlx rejected"));
  const ds2 = {
    vocab, sentences: [], grammar, exercises: [], dialogues: [],
    reading: readingOld.concat(kr), listening: listeningOld.concat(kl), exams: examsOld.concat(ke),
  };
  const r2 = gate.validateDataset(ds2);
  console.log("STAGE6 after reject: reading=" + ds2.reading.length + " listening=" + ds2.listening.length + " exams=" + ds2.exams.length + " errors=" + r2.errors.length);
  if (r2.errors.length) { console.log("FATAL stage6"); process.exit(1); }
  fs.writeFileSync(path.join(cache, "reading.json"), JSON.stringify(ds2.reading));
  fs.writeFileSync(path.join(cache, "listening.json"), JSON.stringify(ds2.listening));
  fs.writeFileSync(path.join(cache, "exams.json"), JSON.stringify(ds2.exams));
  fs.writeFileSync(path.join(cache, "rejected.json"), JSON.stringify(rejected, null, 1));
  console.log("stage6 ok");
})();
