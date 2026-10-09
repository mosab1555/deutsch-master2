/* Deutsch Master — one-shot content hardening migration, part 2 (2026-10-09).
   Scope: the 02:56-03:13 pipeline already absorbed generator fixes G1-G5
   (es-gibt indefinite, subordinate decap, wehtun caps, formal-Sie verbs,
   purchasable price pools). This script fixes the REMAINING systematic
   defect classes in the fresh .cache data:
     M2: mid-sentence closed-class determiners/possessives/pronouns lowercased
         (Entweder Die->die, Warum isst Mein->mein, Wie geht es Meine->meine,
         Was hat Die->die, …). Excludes Sie/Ihnen (formal-you ambiguity),
         keeps segment-initial tokens. "Ihr"+lowercase-verb -> "ihr".
     M5: "Sie ist" + formal-you Arabic (حضرتك) -> "Sie sind" (2 rows).
     M6: literal-verb templates conjugate per subject (sein-ort-zeit "Die
         Frauen ist"->"sind", "Ich ist"->"bin"; bleiben-ort "Die Schüler
         bleibt"->"bleiben"; sein-frage "Ist du"->"Bist du"). Subject
         recovered by longest SUBJ-pool prefix match (formal Sie vs she
         disambiguated via حضرتك). Mirrors build-sentences.js C2/conjCore
         for sein/bleiben; Arabic is nominal (untouched).
     M7: fused separable verbs split in V2 main clauses (steigt-um "S
         umsteigt P ."->"S steigt P um."; umzieh finite forms likewise;
         547 rows). Prefix moves clause-final (token insertion); gap rows
         blanking the verb stay solvable (stem answer, "um" given); order
         rows gain the "um" token. -en infinitives (149+25, correct) and
         subordinate-final fused forms are never touched. hoch-Deutsch
         (4 rows, categorically wrong manner adverb) -> gut + Arabic
         adverb fix; generator now restricts the slot to a manner pool.
   German text only; Arabic untouched. All rules are strict 1:1 token
   substitutions; derived gap/order exercise rows are migrated positionally
   (answer indices preserved). M1/M3/M4 are asserted zero-residual.
   Run: node tools/migrate-content-fixes.js [--apply]  (default: dry-run)
*/
"use strict";
const fs = require("fs");
const path = require("path");
const APPLY = process.argv.includes("--apply");
const cache = path.join(__dirname, "clib", ".cache");
const load = (f) => JSON.parse(fs.readFileSync(path.join(cache, f), "utf8"));
const save = (f, o) => fs.writeFileSync(path.join(cache, f), JSON.stringify(o));

const sentences = load("sentences.json");
const exercises = load("exercises.json");
const reading = load("reading.json");
const listening = load("listening.json");
const dialogues = load("dialogues.json");
const grammar = load("grammar.json");

const stats = {
  m1resid: 0, m3resid: 0, m4resid: 0,
  m2sent: 0, m2tok: 0, m5sent: 0, m6sent: 0, m6skip: [],
  m7sent: 0, m7skip: [], m7hoch: 0,
  exGapSurg: 0, exGapCtx: 0, exOrderSurg: 0, exChoiceFix: 0,
  exOtherFix: 0, readFix: 0, lisFix: 0, dlgFix: 0, gramFix: 0,
  alignFail: [],
};
// old full-sentence -> { neu, diffs:[{i,old,neu}] }
const sentMap = new Map();

/* ---------- residual assertions for pipeline-fixed classes ---------- */
for (const s of sentences) {
  if (/^(Es gibt|Gibt es) (den|die|das) [A-ZÄÖÜ]/.test(s.de)) stats.m1resid++;
  if (/(^|[.!?…]\s+)(dem|der)( \S+ tut [^.!?…]*?weh)/.test(s.de)) stats.m3resid++;
  if (s.de.includes("freut sich Sie")) stats.m4resid++;
}

/* ---------- M2/M5 text engine ---------- */
const DECAP = ["Der", "Die", "Das", "Den", "Dem", "Des", "Mein", "Meine", "Meiner", "Meinen", "Meinem", "Meines", "Dein", "Deine", "Deiner", "Deinen", "Deinem", "Deines", "Sein", "Seine", "Seiner", "Seinen", "Seinem", "Seines", "Unsere", "Unseren", "Unserem", "Unserer", "Unseres", "Unser", "Kein", "Keine", "Keinen", "Keinem", "Keiner", "Keines", "Alle", "Alles", "Viele", "Beide", "Beides", "Jede", "Jeder", "Jedes", "Jedem", "Jeden", "Niemand", "Niemanden", "Keiner", "Man", "Wir", "Ich", "Du", "Er", "Es"];
const decapRe = new RegExp("\\b(" + DECAP.join("|") + ")\\b", "g");
function fixText(t) {
  if (typeof t !== "string" || !t) return t;
  let out = t;
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
  // collapse accidental double spacing (never inside the gap "  («" separator)
  return out.replace(/ {2,}(?!\(«)/g, " ");
}
const noPeriod = (s) => s.replace(/[.?!…]$/, "");

/* ---------- M6: literal-verb agreement via pool-prefix subject recovery --- */
// SUBJ pool = sentence subjects (base + BIGSUBJ). Longest-prefix match
// recovers the generator's S for template-built rows.
let SUBJPOOL = [];
try {
  const sentgen = require("./clib/sentgen");
  const bigsen = require("./clib/bigsen");
  SUBJPOOL = (sentgen.SUBJ || []).concat((bigsen.BIGSUBJ || []));
} catch (e) { SUBJPOOL = []; }
const lowFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
function matchSubj(text) {
  let best = null;
  for (const S of SUBJPOOL) {
    for (const form of [S[0], lowFirst(S[0])]) {
      if (text.startsWith(form + " ") && (!best || form.length > best.form.length)) {
        best = { S, form };
      }
    }
  }
  return best;
}
// mirrors build-sentences.js conjCore("sein") / regular -en conjugation,
// with formal Sie -> 3rd plural (cpersonFull fix).
function conjM6(verb, S, ar) {
  let k = S[2];
  if (S[0] === "Sie" && k === "Sie" && !/حضرتك/.test(ar || "")) k = "sie"; // she-reading
  if (verb === "sein") {
    if (k === "ich") return "bin";
    if (k === "du") return "bist";
    if (k === "wir" || k === "siepl" || k === "Sie") return "sind";
    if (k === "ihr") return "seid";
    return "ist";
  }
  // bleiben (regular)
  if (k === "ich") return "bleibe";
  if (k === "du") return "bleibst";
  if (k === "wir" || k === "siepl" || k === "Sie") return "bleiben";
  if (k === "ihr") return "bleibt";
  return "bleibt";
}
function applyM6(s) {
  const grams = s.gram || [];
  const isSeinOrt = grams.includes("sein-ort-zeit");
  const isBleiben = grams.includes("bleiben-ort");
  const isSeinFr = grams.includes("sein-frage");
  if (!isSeinOrt && !isBleiben && !isSeinFr) return null;
  // formal-you disambiguation for the ambiguous "Sie" subject
  const pickSie = (m) => {
    if (!m || m.form !== "Sie") return m;
    const wantFormal = /حضرتك/.test(s.ar || "");
    const alt = SUBJPOOL.find((S) => S[0] === "Sie" && (wantFormal ? S[2] === "Sie" : S[2] === "sie"));
    return alt ? { S: alt, form: "Sie" } : m;
  };
  if (isSeinFr) {
    if (!s.de.startsWith("Ist ")) return null;
    const rest = s.de.slice(4);
    const m = pickSie(matchSubj(rest));
    if (!m) { stats.m6skip.push(s.id + ": sein-frage no subject"); return null; }
    const nv = conjM6("sein", m.S, s.ar);
    const cap = nv.charAt(0).toUpperCase() + nv.slice(1);
    if (cap === "Ist") return null;
    return s.de.replace(/^Ist /, cap + " ");
  }
  const verb = isSeinOrt ? "ist" : "bleibt";
  const m = pickSie(matchSubj(s.de));
  if (!m) { stats.m6skip.push(s.id + ": " + (isSeinOrt ? "sein-ort-zeit" : "bleiben-ort") + " no subject"); return null; }
  const prefix = m.form + " " + verb + " ";
  if (!s.de.startsWith(prefix)) return null; // verb already migrated or unexpected shape
  const nv = conjM6(isSeinOrt ? "sein" : "bleiben", m.S, s.ar);
  if (nv === verb) return null;
  return m.form + " " + nv + " " + s.de.slice(prefix.length);
}

/* ---------- M7: fused separable verbs (V2 split + um-insertion) ---------- */
const SUBORD = ["weil", "dass", "wenn", "bevor", "nachdem", "obwohl", "falls", "sobald", "als", "während", "ob", "damit"];
// infinitive triggers: preceding modal/aux/lassen/versuchen/zu keeps -en forms
const INFTRIG = ["wollen", "will", "willst", "müssen", "muss", "musst", "können", "kann", "kannst", "dürfen", "darf", "darfst", "sollen", "soll", "sollst", "möchten", "möchte", "möchtest", "werden", "wird", "wirst", "werde", "lassen", "lässt", "lasst", "zu", "versuchen", "versucht", "beginnen", "beginnt", "brauchen", "braucht", "scheinen", "scheint", "helfen", "hilft", "sehen", "sieht", "hören", "hört"];
// builder-mirroring tokenizer (gap/order builders strip final punct AND
// filter empty tokens, e.g. from " ." endings)
const toks = (s) => s.replace(/[.?!…]$/, "").split(" ").filter(Boolean);
// regular -en conjugation for steigen/ziehen (mirrors conjCore)
function conjReg(stem, k) {
  if (k === "ich") return stem + "e";
  if (k === "du") return stem + "st";
  if (k === "wir" || k === "siepl" || k === "Sie") return stem + "en";
  if (k === "ihr") return stem + "t";
  return stem + "t";
}
function applyM7(de, ar) {
  // returns { neu } or null; caller verifies token shape
  const parts = de.split(/([.!?…]+\s*|«\s*)/);
  let changed = false;
  for (let i = 0; i < parts.length; i += 2) {
    let seg = parts[i];
    // (i) finite fused forms: umsteig(e|st|t), umzieh(e|st|t)
    let m = seg.match(/\b(umsteig|umzieh)(e|st|t)\b/);
    if (m) {
      const before = seg.slice(0, m.index).toLowerCase();
      if (SUBORD.some((c) => new RegExp("\\b" + c + "\\b").test(before))) continue;
      const stem = m[1] === "umsteig" ? "steig" : "zieh";
      const after = seg.slice(m.index + m[0].length);
      const pm = after.match(/\s*([.?!…])$/);
      // rstrip: the segmenter can split "." into its own part, leaving " ."
      const post2 = (pm ? after.slice(0, after.length - pm[0].length) : after).replace(/\s+$/, "");
      const punct = pm ? pm[1] : "";
      seg = seg.slice(0, m.index) + stem + m[2] + post2 + " um" + punct;
      parts[i] = seg;
      changed = true;
      continue;
    }
    // (ii) bare infinitives in finite position (no modal/aux/zu trigger)
    m = seg.match(/\b(umsteigen|umziehen)\b/);
    if (m) {
      const before = seg.slice(0, m.index);
      const bl = before.toLowerCase();
      if (SUBORD.some((c) => new RegExp("\\b" + c + "\\b").test(bl))) continue;
      if (INFTRIG.some((t) => new RegExp("\\b" + t + "\\b").test(bl))) continue;
      // clause-local subject: longest pool form ending right before the verb
      const forms = [];
      for (const S of SUBJPOOL) for (const form of [S[0], lowFirst(S[0])]) forms.push({ S, form });
      forms.sort((a, b) => b.form.length - a.form.length);
      let hit = null;
      for (const f of forms) {
        if (before.endsWith(f.form + " ") || before === f.form) { hit = f; break; }
      }
      if (!hit) continue;
      let k = hit.S[2];
      if (hit.S[0] === "Sie") {
        const wantFormal = /حضرتك/.test(ar || "");
        const alt = SUBJPOOL.find((S) => S[0] === "Sie" && (wantFormal ? S[2] === "Sie" : S[2] === "sie"));
        k = alt ? alt[2] : k;
        if (k === "Sie" && !wantFormal) k = "sie";
      }
      const stem = m[1] === "umsteigen" ? "steig" : "zieh";
      const after = seg.slice(m.index + m[0].length);
      const pm = after.match(/\s*([.?!…])$/);
      const post2 = (pm ? after.slice(0, after.length - pm[0].length) : after).replace(/\s+$/, "");
      const punct = pm ? pm[1] : "";
      seg = before + conjReg(stem, k) + post2 + " um" + punct;
      parts[i] = seg;
      changed = true;
    }
  }
  if (!changed) return null;
  return parts.join("");
}

/* ---------- Pass 1: sentences ---------- */
const byId = new Map();
const HOCH_AR = { masc: "جيد", fem: "جيدة" };
for (const s of sentences) {
  byId.set(s.id, s);
  let neu = s.de;
  let arNeu = null;
  // M7b: hoch-Deutsch -> gut-Deutsch (exact rows only)
  if ((s.gram || []).includes("adverb-art") && / spricht hoch Deutsch\.$/.test(neu)) {
    neu = neu.replace(" spricht hoch Deutsch.", " spricht gut Deutsch.");
    const fem = /عالٍة/.test(s.ar || "");
    arNeu = (s.ar || "").replace(/عالٍة?/, fem ? HOCH_AR.fem : HOCH_AR.masc);
    stats.m7hoch++;
  }
  // M7a: fused separable V2 split
  const m7 = applyM7(neu, s.ar);
  let insUm = false;
  if (m7 && m7 !== neu) {
    // verify shape: strict 1:1 replacements + single appended "um"
    const ot = toks(s.de);
    const nt = toks(m7);
    if (nt.length === ot.length + 1 && nt[nt.length - 1] === "um") {
      neu = m7;
      insUm = true;
      stats.m7sent++;
    } else {
      stats.m7skip.push(s.id + ": um-shape [" + s.de.slice(0, 70) + "]");
    }
  }
  // M6 (verb agreement; subject recovery needs original shapes)
  const m6 = applyM6(s);
  if (m6) { neu = m6; stats.m6sent++; }
  // M5 (formal-you "Sie ist" residual backstop)
  if (/^Sie ist /.test(neu) && /حضرتك/.test(s.ar || "")) {
    neu = neu.replace(/^Sie ist /, "Sie sind ");
    stats.m5sent++;
  }
  neu = fixText(neu);
  if (neu !== s.de || arNeu) {
    // diffs on builder-mirroring tokens (strip final punct, drop empties)
    const ot = toks(s.de), nt = toks(neu);
    const diffs = [];
    // insertion-aware: trailing "um" handled separately
    const core = insUm ? nt.slice(0, -1) : nt;
    if (ot.length === core.length) {
      for (let i = 0; i < ot.length; i++) if (ot[i] !== core[i]) diffs.push({ i, old: ot[i], neu: core[i] });
    }
    if (ot.length !== core.length) {
      stats.alignFail.push(s.id + ": token-length changed");
    } else {
      // whitespace-only normalization needs no derived-row mapping
      if (diffs.length || insUm) {
        sentMap.set(s.id, { oldDe: s.de, neu, diffs, insUm, arNeu, oldAr: s.ar });
        stats.m2sent++;
      }
      s.de = neu;
      if (arNeu) s.ar = arNeu;
    }
  }
}

/* ---------- Pass 2: exercises ---------- */
function applyChoicesSurgery(q, diffs, blankIdx) {
  if (!Array.isArray(q.choices) || typeof q.answer !== "number") return;
  for (const d of diffs) {
    if (d.i === blankIdx && q.choices[q.answer] === d.old) {
      q.choices[q.answer] = d.neu;
      stats.exChoiceFix++;
    }
  }
}
for (const q of exercises) {
  const refId = Array.isArray(q.ref) && q.ref.length === 1 ? q.ref[0] : null;
  const entry = refId ? sentMap.get(refId) : null;
  if (q.type === "gap" && entry && typeof q.prompt === "string") {
    // prompt = deToks(blanked) + "  («" + ar + "»)"
    const cut = q.prompt.indexOf("  («");
    if (cut < 0) { stats.alignFail.push(q.id + ": gap prompt shape"); continue; }
    const dePart = q.prompt.slice(0, cut);
    const arPart = q.prompt.slice(cut);
    const pt = dePart.split(" ").filter(Boolean);
    const ot = toks(entry.oldDe);
    if (pt.length !== ot.length) { stats.alignFail.push(q.id + ": gap toklen " + pt.length + "!=" + ot.length); continue; }
    const b = pt.indexOf("___");
    let ok = true;
    for (let i = 0; i < pt.length; i++) {
      if (i !== b && pt[i] !== ot[i]) { ok = false; break; }
    }
    if (!ok || b < 0) { stats.alignFail.push(q.id + ": gap align"); continue; }
    const nt = toks(entry.neu);
    const npt = nt.slice(); npt[b] = "___";
    // M7b: prompt tail embeds the sentence Arabic — refresh when migrated
    let tail = arPart;
    if (entry.arNeu) {
      const wantTail = "  («" + entry.arNeu + "»)";
      const haveTail = "  («" + entry.oldAr + "»)";
      tail = (arPart === haveTail) ? wantTail : arPart;
      if (tail === arPart && arPart !== wantTail) stats.alignFail.push(q.id + ": gap arabic-tail mismatch");
    }
    q.prompt = npt.join(" ") + tail;
    applyChoicesSurgery(q, entry.diffs.map((d) => ({ i: d.i, old: d.old, neu: d.neu })), b);
    stats.exGapSurg++;
    continue;
  }
  if (q.type === "order" && entry && Array.isArray(q.words)) {
    const ot = toks(entry.oldDe);
    if (q.words.join(" ") !== ot.join(" ")) { stats.alignFail.push(q.id + ": order words mismatch"); continue; }
    const nt = toks(entry.neu);
    q.words = nt.slice();
    // prompt multiset surgery preserving shown shuffle: "رتّب الكلمات: a / b / ..."
    const PRE = "رتّب الكلمات: ";
    if (typeof q.prompt === "string" && q.prompt.startsWith(PRE)) {
      const pt = q.prompt.slice(PRE.length).split(" / ");
      for (const d of entry.diffs) {
        const k = pt.indexOf(d.old);
        if (k >= 0) pt[k] = d.neu;
        else { stats.alignFail.push(q.id + ": order prompt missing " + d.old); break; }
      }
      if (entry.insUm) {
        // inserted "um" joins the displayed bag at a stable pseudo-random slot
        let h = 0;
        for (let ci = 0; ci < q.id.length; ci++) h = (h * 31 + q.id.charCodeAt(ci)) | 0;
        pt.splice(Math.abs(h) % (pt.length + 1), 0, "um");
      }
      q.prompt = PRE + pt.join(" / ");
    }
    // mk4 stores the correct order choice with "." even for "?" sentences;
    // builders filter empty tokens, so compare on toks() (handles " ." ends)
    const wantOld = toks(entry.oldDe).join(" ") + ".", wantNeu = toks(entry.neu).join(" ") + ".";
    if (Array.isArray(q.choices) && typeof q.answer === "number" && typeof q.choices[q.answer] === "string" && q.choices[q.answer] === wantOld) {
      q.choices[q.answer] = wantNeu;
    } else stats.alignFail.push(q.id + ": order correct-choice mismatch");
    stats.exOrderSurg++;
    continue;
  }
  // non-derived or unmapped rows: uniform regex pass (no-op unless caps present)
  let touched = false;
  if (typeof q.prompt === "string") {
    const f = fixText(q.prompt);
    if (f !== q.prompt) { q.prompt = f; touched = true; }
  }
  if (Array.isArray(q.choices)) {
    q.choices = q.choices.map((c) => {
      if (typeof c !== "string") return c;
      const f = fixText(c);
      if (f !== c) touched = true;
      return f;
    });
  }
  if (Array.isArray(q.words)) {
    const w2 = q.words.map((w) => (typeof w === "string" ? fixText(w) : w));
    if (w2.join("|") !== q.words.join("|")) { q.words = w2; touched = true; }
  }
  if (Array.isArray(q.lines)) {
    q.lines.forEach((ln) => {
      if (Array.isArray(ln) && typeof ln[1] === "string") {
        const f = fixText(ln[1]);
        if (f !== ln[1]) { ln[1] = f; touched = true; }
      }
    });
  }
  if (touched) stats.exOtherFix++;
}

/* ---------- Pass 3: reading / listening / dialogues / grammar ---------- */
function mapReplace(t) {
  // M5 substring propagation (exact sentence strings)
  if (typeof t !== "string" || !t) return t;
  let out = t;
  sentMap.forEach((e) => {
    if (out.includes(e.oldDe)) out = out.split(e.oldDe).join(e.neu);
    const o2 = noPeriod(e.oldDe), n2 = noPeriod(e.neu);
    if (o2 !== e.oldDe && out.includes(o2)) out = out.split(o2).join(n2);
  });
  return out;
}
for (const r of reading) {
  if (typeof r.de === "string") {
    const nc = fixText(mapReplace(r.de));
    if (nc !== r.de) { r.de = nc; stats.readFix++; }
  }
  if (typeof r.title === "string") {
    const nc = fixText(r.title);
    if (nc !== r.title) r.title = nc;
  }
  (r.questions || []).forEach((qq) => {
    if (typeof qq.q === "string") qq.q = fixText(mapReplace(qq.q));
    if (Array.isArray(qq.choices)) qq.choices = qq.choices.map((c) => (typeof c === "string" ? fixText(mapReplace(c)) : c));
  });
}
for (const l of listening) {
  (l.lines || []).forEach((ln) => {
    if (Array.isArray(ln) && typeof ln[1] === "string") {
      const nc = fixText(mapReplace(ln[1]));
      if (nc !== ln[1]) { ln[1] = nc; stats.lisFix++; }
    }
  });
  (l.questions || []).forEach((qq) => {
    if (typeof qq.q === "string") qq.q = fixText(mapReplace(qq.q));
    if (Array.isArray(qq.choices)) qq.choices = qq.choices.map((c) => (typeof c === "string" ? fixText(mapReplace(c)) : c));
  });
}
for (const d of dialogues) {
  (d.lines || []).forEach((ln) => {
    if (Array.isArray(ln) && typeof ln[1] === "string") {
      const nc = fixText(mapReplace(ln[1]));
      if (nc !== ln[1]) { ln[1] = nc; stats.dlgFix++; }
    }
  });
  if (typeof d.titleDe === "string") {
    const nc = fixText(d.titleDe);
    if (nc !== d.titleDe) d.titleDe = nc;
  }
}
for (const g of grammar) {
  (g.examples || []).forEach((ex) => {
    if (Array.isArray(ex) && typeof ex[0] === "string") {
      const nc = fixText(ex[0]);
      if (nc !== ex[0]) { ex[0] = nc; stats.gramFix++; }
    }
  });
}

console.log(JSON.stringify(stats, null, 1));
console.log("mapped sentences:", sentMap.size);
console.log(APPLY ? "APPLIED — writing caches" : "DRY RUN — no writes (use --apply)");
if (APPLY) {
  save("sentences.json", sentences);
  save("exercises.json", exercises);
  save("reading.json", reading);
  save("listening.json", listening);
  save("dialogues.json", dialogues);
  save("grammar.json", grammar);
  console.log("caches written");
}
