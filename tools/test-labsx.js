/* Tests for the New Training Labs (client/labsx.js):
   - pure diff engine (lxNorm/lxTok/lxLcs/lxDiff)
   - content banks: counts, required fields, no empty German/Arabic
   - situation graphs: every next resolves, ends have score/text, repair paths exist
   - error-replay generators with stub data (fresh, valid, never verbatim-only)
   - writing analyzer with stub TutorLocal/dmLev
   - HTML wiring (both pages), CSS guards, sw.js precache
   Run: node tools/test-labsx.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(root, "client", "labsx.js"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
/* bracket-aware extractor that skips string literals */
function extractFrom(src, marker, open, close) {
  const si = src.indexOf(marker);
  if (si < 0) throw new Error("marker not found: " + marker);
  let i = src.indexOf(open, si);
  const start = i;
  let depth = 0, q = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === "\\") { i++; continue; }
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced in " + marker);
}
function extractFn(name) {
  const marker = "function " + name + "(";
  const si = SRC.indexOf(marker);
  if (si < 0) throw new Error("fn not found: " + name);
  const fromMarker = SRC.slice(si);
  const bi = fromMarker.indexOf("{");
  let depth = 0, q = null, i;
  for (i = bi; i < fromMarker.length; i++) {
    const ch = fromMarker[i];
    if (q) {
      if (ch === "\\") { i++; continue; }
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) throw new Error("unbalanced fn: " + name);
  return fromMarker.slice(0, i + 1);
}

/* ---------- 1. diff engine ---------- */
eval(extractFn("lxNorm") + "\n" + extractFn("lxTok") + "\n" + extractFn("lxLcs") + "\n" + extractFn("lxDiff"));
(function () {
  check("lxNorm case/punct/umlaut", lxNorm("  Ich Wohne in Berlin. ") === "ich wohne in berlin" && lxNorm("Tür") === "tur" && lxNorm("Straße") === "strasse");
  let d = lxDiff("Ich wohne in Berlin.", "Ich wohne in Berlin.");
  check("diff perfect = 100", d.score === 100 && d.missing.length === 0 && d.extra.length === 0, "score=" + d.score);
  d = lxDiff("Ich wohne in Berlin.", "Ich wohne Berlin.");
  check("diff detects missing 'in'", d.score < 100 && d.missing.indexOf("in") >= 0, "score=" + d.score + " missing=" + d.missing.join(","));
  d = lxDiff("Ich wohne in Berlin.", "Ich wohne in Paris.");
  check("diff detects wrong word", d.missing.indexOf("berlin") >= 0 && d.extra.indexOf("paris") >= 0, "missing=" + d.missing + " extra=" + d.extra);
  d = lxDiff("Guten Morgen!", "");
  check("diff empty answer = 0", d.score === 0 && d.missing.length === 2, "score=" + d.score);
  d = lxDiff("Ich lerne Deutsch.", "Deutsch lerne ich.");
  check("diff reorder still aligns tokens", d.correct.length === 3, "correct=" + d.correct.join(","));
})();

/* ---------- 2. content banks ---------- */
function evalConst(name) {
  const marker = "const " + name + "=";
  const arr = extractFrom(SRC, marker, "[", "]");
  return eval(arr);
}
const SHADOW = evalConst("LX_SHADOW"), WRITE = evalConst("LX_WRITE"),
  DICT = evalConst("LX_DICT"), SIT = evalConst("LX_SIT"), CONF = evalConst("LX_CONF");
(function () {
  check("shadow bank >= 18 items", SHADOW.length >= 18, "n=" + SHADOW.length);
  const lvls = {}, kinds = {};
  SHADOW.forEach(x => { lvls[x.lvl] = 1; kinds[x.kind] = 1; });
  check("shadow has easy+medium+hard", lvls.easy && lvls.medium && lvls.hard, Object.keys(lvls).join(","));
  check("shadow has word+short+long+daily", kinds.word && kinds.short && kinds.long && kinds.daily, Object.keys(kinds).join(","));
  check("shadow fields complete", SHADOW.every(x => x.id && x.de && x.de.trim() && x.ar && x.ar.trim()), "");
  check("write bank >= 12 tasks / 4 types", WRITE.length >= 12 && ["situation", "message", "describe", "rebuild"].every(t => WRITE.some(x => x.type === t)), "n=" + WRITE.length);
  check("write tasks have keywords+accepts+model", WRITE.every(x => x.keywords && x.keywords.length && x.accepts && x.accepts.length && x.model && x.focus), "");
  check("dict bank >= 20 (A1 strong)", DICT.length >= 20 && DICT.filter(x => x.lvl === "A1").length >= 12, "n=" + DICT.length + " A1=" + DICT.filter(x => x.lvl === "A1").length);
  check("dict has A1+A2+B1", ["A1", "A2", "B1"].every(l => DICT.some(x => x.lvl === l)), "");
  check("dict fields complete", DICT.every(x => x.id && x.de && x.ar), "");
  check("situations >= 8", SIT.length >= 8, "n=" + SIT.length);
  check("confusion pairs >= 8", CONF.length >= 8, "n=" + CONF.length);
  check("conf pairs have training source", CONF.every(p => (p.items && p.items.length >= 4) || p.skill), "");
})();

/* ---------- 3. situation graphs ---------- */
(function () {
  let bad = [];
  SIT.forEach(s => {
    if (!s.nodes[s.start]) bad.push(s.id + ":missing-start");
    Object.keys(s.nodes).forEach(nid => {
      const n = s.nodes[nid];
      if (n.end) {
        if (typeof n.score !== "number" || !n.text) bad.push(s.id + "." + nid + ":bad-end");
        return;
      }
      if (!n.say || !n.choices || !n.choices.length) { bad.push(s.id + "." + nid + ":no-content"); return; }
      n.choices.forEach((c, j) => {
        if (!c.t || !c.next) { bad.push(s.id + "." + nid + ".c" + j + ":no-next"); return; }
        if (!s.nodes[c.next]) bad.push(s.id + "." + nid + ":dangling->" + c.next);
      });
    });
    const hasGood = Object.keys(s.nodes).some(k => s.nodes[k].end && s.nodes[k].score >= 70);
    const hasRepair = Object.keys(s.nodes).some(k => { const n = s.nodes[k]; return !n.end && n.choices.some(c => c.bad); });
    if (!hasGood) bad.push(s.id + ":no-good-ending");
    if (!hasRepair) bad.push(s.id + ":no-repair-path");
    // endings carry vocab + phrases
    Object.keys(s.nodes).forEach(k => {
      const n = s.nodes[k];
      if (n.end && (!n.vocab || !n.phrases)) bad.push(s.id + "." + k + ":end-missing-vocab/phrases");
    });
  });
  check("situation graphs valid (resolve+ends+repair)", bad.length === 0, bad.slice(0, 4).join(" | "));
})();

/* ---------- 4. error-replay generators (stub data) ---------- */
const STUB_WORDS = [
  { id: "n1", de: "Hund", art: "der", ar: "كلب", type: "اسم", plural: "die Hunde", level: "A1" },
  { id: "n2", de: "Tasche", art: "die", ar: "حقيبة", type: "اسم", plural: "die Taschen", level: "A1" },
  { id: "n3", de: "Buch", art: "das", ar: "كتاب", type: "اسم", plural: "die Bücher", level: "A1" },
  { id: "n4", de: "Tisch", art: "der", ar: "طاولة", type: "اسم", plural: "die Tische", level: "A1" },
  { id: "v1", de: "lernen", art: "-", ar: "يتعلم", type: "فعل", level: "A1" },
  { id: "v2", de: "kommen", art: "-", ar: "يأتي", type: "فعل", level: "A1" }
];
function allWords() { return STUB_WORDS; }
function conjugateVerb(inf) {
  const m = { lernen: { ich: "lerne", du: "lernst", er: "lernt" }, kommen: { ich: "komme", du: "kommst", er: "kommt" } };
  return m[inf] || null;
}
var SENTENCES = [
  { id: "s1", de: "Ich lerne jeden Tag Deutsch.", ar: "أتعلم الألمانية كل يوم." },
  { id: "s2", de: "Meine Mutter kocht heute.", ar: "أمي تطبخ اليوم." }
];
eval(extractFn("erPick") + "\n" + extractFn("erNouns") + "\n" + extractFn("erGen"));
(function () {
  const skills = ["article", "ein", "plural", "verb", "nichtkein", "prep", "wordorder"];
  let bad = [], fresh = true;
  skills.forEach(sk => {
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      const q = erGen(sk, []);
      if (!q) { bad.push(sk + ":null"); break; }
      if (q.words) {
        if (!q.words.length || !q.correct) { bad.push(sk + ":bad-order"); break; }
        seen.add(q.correct);
      } else {
        if (!q.q || !q.opts || q.opts.length < 2 || q.correct < 0 || q.correct >= q.opts.length || !q.explain) { bad.push(sk + ":bad-choice"); break; }
        if (q.opts[q.correct] === undefined) { bad.push(sk + ":correct-oob"); break; }
        seen.add(q.q + "|" + q.opts[q.correct]);
      }
    }
    if (sk === "wordorder" && seen.size < 1) fresh = false;
  });
  check("er generators valid (all 7 skills)", bad.length === 0, bad.slice(0, 3).join(" | "));
  // fallback path with no SENTENCES
  const keep = SENTENCES; SENTENCES = [];
  const qf = erGen("wordorder", []);
  check("er wordorder fallback works", !!(qf && qf.words && qf.words.length >= 3), "");
  SENTENCES = keep;
  // article correctness: correct option must match noun gender
  let okArt = true;
  for (let i = 0; i < 10; i++) {
    const q = erGen("article", []);
    const w = STUB_WORDS.find(x => q.q.indexOf(x.de) >= 0);
    if (w && q.opts[q.correct] !== w.art) { okArt = false; break; }
  }
  check("er article answers match gender", okArt, "");
})();

/* ---------- 5. writing analyzer (stub TutorLocal/dmLev) ---------- */
var TutorLocal = {
  correct: function (text) {
    const issues = [], fixes = [];
    let out = String(text).trim();
    if (out && /[a-zäöü]/.test(out[0])) { issues.push("الجملة الألمانية تبدأ بحرف كبير."); out = out[0].toUpperCase() + out.slice(1); }
    if (out && !/[.?!]$/.test(out)) { issues.push("الجملة بدون علامة نهاية."); out = out + "."; }
    return { ok: issues.length === 0, corrected: out, issues: issues, fixes: fixes };
  }
};
function dmLev(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a === b) return 0;
  if (!a.length) return b.length; if (!b.length) return a.length;
  let p = [], c = [];
  for (let j = 0; j <= b.length; j++) p[j] = j;
  for (let i = 1; i <= a.length; i++) {
    c[0] = i;
    for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    const t = p; p = c; c = t;
  }
  return p[b.length];
}
eval(extractFn("wrAnalyze"));
(function () {
  const task = WRITE.find(x => x.id === "wr-r1");
  let r = wrAnalyze(task, "Ich lerne Deutsch.");
  check("write exact accept = 100", r.ok === true && r.score === 100, "score=" + r.score);
  r = wrAnalyze(task, "ich lerne deutsch");
  check("write accepts normalized variant", r.ok === true, "score=" + r.score);
  r = wrAnalyze(task, "Ich spiele Fußball.");
  check("write missing keywords flagged", r.ok === false && r.missing.length > 0, "missing=" + r.missing.join(","));
  r = wrAnalyze(task, "Ich lerne Deutcsh.");
  check("write spelling hint", r.issues.some(x => x.cat === "Spelling"), r.issues.map(x => x.cat + ":" + x.t).join(" | "));
  r = wrAnalyze(task, "Deutsch lerne Ich.");
  const hasOrder = r.issues.some(x => x.cat === "Word Order") || r.score < 100;
  check("write imperfect order not full marks", hasOrder, "score=" + r.score);
  r = wrAnalyze(task, "");
  check("write empty = 0 + issue", r.score === 0 && r.issues.length > 0, "score=" + r.score);
  check("write always has model alternative", WRITE.every(x => wrAnalyze(x, " bla bla ").alt === x.model), "");
})();

/* ---------- 6. wiring: HTML + CSS + sw ---------- */
(function () {
  ["index.html", "academy.html"].forEach(f => {
    const h = fs.readFileSync(path.join(root, "client", f), "utf8");
    ["shadowing", "writing", "dictation", "situations", "erreplay"].forEach(p => {
      check(f + " nav " + p, h.indexOf('data-page="' + p + '"') >= 0, "");
      check(f + " section page-" + p, h.indexOf('id="page-' + p + '"') >= 0, "");
    });
    ["shadowBox", "writeBox", "dictBox", "gsitBox", "erBox"].forEach(id => {
      check(f + " container " + id, h.indexOf('id="' + id + '"') >= 0, "");
    });
    check(f + " loads labsx.js", h.indexOf('<script src="labsx.js"></script>') >= 0, "");
  });
  const css = fs.readFileSync(path.join(root, "client", "style.css"), "utf8");
  check("css has labsx block", css.indexOf("labsx.js") >= 0, "");
  const tail = css.split("New Training Labs")[1] || "";
  const big = (tail.match(/(?<![\w-])(?:min-width|width)\s*:\s*(\d+)px/g) || []).filter(x => parseInt(x.match(/(\d+)px/)[1], 10) > 340);
  check("css labsx block has no fixed widths >340px", big.length === 0, big.slice(0, 3).join(","));
  const sw = fs.readFileSync(path.join(root, "client", "sw.js"), "utf8");
  check("sw precaches labsx.js", sw.indexOf('"./labsx.js"') >= 0, "");
  check("sw precaches smart.js", sw.indexOf('"./smart.js"') >= 0, "");
  check("sw cache bumped v18", sw.indexOf("german-academy-v18") >= 0, "");
  ["play.js", "script.js", "study.js"].forEach(f => {
    const other = fs.readFileSync(path.join(root, "client", f), "utf8");
    check("no labsx id collision in " + f, ["shadowBox", "writeBox", "dictBox", "gsitBox", "erBox", "dashLabsx"].every(id => other.indexOf('id="' + id + '"') < 0 && other.indexOf("$(\"" + id + "\")") < 0), "");
  });
})();

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
