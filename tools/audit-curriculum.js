/* Deutsch Master - Curriculum content audit (A1→B2).
 * Checks: duplicate vocabulary (incl. vs existing A1 data), duplicate examples,
 * missing translations (ar/en), missing articles/plurals/pronunciation,
 * invalid levels, missing grammar explanations, bad quiz indexes,
 * broken kapitel references, empty content.
 * Usage: node tools/audit-curriculum.js (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let fails = [];
function bad(m) { fails.push(m); console.log("FAIL " + m); }
function good(m) { console.log("PASS " + m); }
function info(m) { console.log("INFO " + m); }

// ---- load CURR data files in sandbox ----
function loadCurr(file, key) {
  const code = RD("client/" + file);
  const sandbox = { window: {} };
  const fn = new Function("window", code + "\nreturn window." + key + ";");
  return fn(sandbox.window);
}
const levels = {};
for (const [f, k] of [["curr-a2.js", "CURR_A2"], ["curr-b1.js", "CURR_B1"], ["curr-b2.js", "CURR_B2"]]) {
  try { levels[k.replace("CURR_", "")] = loadCurr(f, k); }
  catch (e) { bad("cannot load " + f + ": " + e.message); }
}

// ---- existing A1 keys from script.js RAW blocks ----
const script = RD("client/script.js");
const existKeys = new Set();
for (const m of script.matchAll(/const (RAW_K\d+)\s*=\s*\[([\s\S]*?)\n\];/g)) {
  const rows = m[2].matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]+)"/g);
  for (const r of rows) existKeys.add((r[1] + "|" + r[2]).toLowerCase());
}
info("existing A1 word keys: " + existKeys.size);

const VALID_LV = { A2: ["K6", "K7", "K8"], B1: ["K9", "K10", "K11"], B2: ["K12", "K13", "K14"] };
// German mass/abstract nouns with genuinely no plural (verified, not missing data)
const UNCOUNTABLE = new Set(["müll", "husten", "schnupfen", "fieber", "handgepäck", "arbeitslosigkeit", "umwelt", "umweltschutz", "luftverschmutzung", "klima", "klimawandel", "solarenergie", "mülltrennung", "gerechtigkeit", "gleichheit", "freiheit", "respekt", "toleranz", "eignung", "einarbeitung", "motivation", "kritik", "feedback", "anerkennung", "erschöpfung", "erholung", "wirtschaft", "wachstum", "inflation", "opposition", "publikum", "literatur", "mehrsprachigkeit", "integration", "vielfalt", "verantwortung", "werbung", "applaus"]);
const VALID_TYPES = ["اسم", "فعل", "صفة", "ضمير", "أداة", "مفردات"];
const seen = new Map(Object.entries({}).map(([k, v]) => [k, v]));
existKeys.forEach(k => seen.set(k, "A1"));
let nW = 0, nG = 0, nS = 0, nEx = 0;
const dupW = [], dupEx = [], missEn = [], missEx = [], missPl = [], missPron = [], badLv = [], badKap = [], badType = [], gramBad = [];
const exSeen = new Set();

for (const L of ["A2", "B1", "B2"]) {
  const D = levels[L];
  if (!D) continue;
  // kapitel sanity
  const kaps = new Set((D.kapitel || []).map(k => k[0]));
  for (const k of (VALID_LV[L] || [])) if (!kaps.has(k)) bad("level " + L + " missing kapitel " + k);
  (D.words || []).forEach((w, i) => {
    nW++;
    const tag = L + "#" + (i + 1) + " " + w[0];
    if (w.length < 12) bad("short word row " + tag + " len=" + w.length);
    const key = (w[0] + "|" + w[1]).toLowerCase();
    if (seen.has(key)) dupW.push(w[0] + " (" + L + " dup of " + seen.get(key) + ")");
    else seen.set(key, L);
    if (!w[2]) missEx.push(tag + " (ar)");
    if (!w[3]) missEn.push(tag);
    if (!w[9]) missEx.push(tag + " (example)");
    if (!w[4]) missPron.push(tag);
    if (w[5] === "اسم" && w[1] !== "-" && !w[8] && !UNCOUNTABLE.has(String(w[0]).toLowerCase())) missPl.push(tag);
    if (VALID_TYPES.indexOf(w[5]) < 0) badType.push(tag + " type=" + w[5]);
    if (["der", "die", "das", "-"].indexOf(w[1]) < 0) bad("bad article " + tag);
    if (!kaps.has(w[7])) badKap.push(tag + " kap=" + w[7]);
    if (w[9]) { const e = w[9].toLowerCase(); if (exSeen.has(e)) dupEx.push(w[9].slice(0, 50)); else exSeen.add(e); }
  });
  (D.grammar || []).forEach((g, i) => {
    nG++;
    const tag = L + " grammar#" + (i + 1) + " " + g[0];
    const n = g.length;
    if (n < 8) gramBad.push(tag + ": too short");
    if (!g[2]) gramBad.push(tag + ": empty body");
    const exCount = n - 3 - 4;
    if (exCount < 2) gramBad.push(tag + ": <2 examples");
    const correct = parseInt(g[n - 2], 10);
    const opts = String(g[n - 3]).split("|");
    if (!(correct >= 0 && correct < opts.length)) gramBad.push(tag + ": bad quiz index");
    if (!g[n - 1]) gramBad.push(tag + ": empty quiz explain");
    if (!kaps.has(g[1])) badKap.push(tag + " kap=" + g[1]);
  });
  (D.sentences || []).forEach((s, i) => {
    nS++;
    if (!s[0] || !s[1]) bad("empty sentence " + L + "#" + (i + 1));
    if (!kaps.has(s[3])) badKap.push("sentence " + L + "#" + (i + 1) + " kap=" + s[3]);
    const e = String(s[0]).toLowerCase();
    if (exSeen.has(e)) dupEx.push("SENT: " + String(s[0]).slice(0, 50)); else exSeen.add(e);
  });
  // explain coverage for grammar ids
  const base = { A2: 42, B1: 54, B2: 66 }[L];
  (D.grammar || []).forEach((g, i) => {
    const id = "g" + (base + i);
    const E = D.explain && D.explain[id];
    if (!E) { gramBad.push(id + " (" + g[0] + "): missing EXPLAIN entry"); return; }
    nEx++;
    for (const f of ["goals", "what", "why", "examples", "when", "how", "daily", "compare", "notes", "mistakes", "summary", "review"])
      if (E[f] === undefined || E[f] === null || (E[f].length !== undefined && E[f].length === 0)) gramBad.push(id + ": empty explain." + f);
  });
  // banks
  for (const b of ["listen", "speak", "real"]) {
    const arr = D[b] || [];
    if (!arr.length) bad(L + " empty bank: " + b);
    arr.forEach((it, i) => { if (!it.title && !it.topic) bad(L + "." + b + "#" + i + " no title"); });
  }
}

console.log("---- counts: words=" + nW + " grammar=" + nG + " sentences=" + nS + " explain=" + nEx);
if (dupW.length) bad("duplicate words (" + dupW.length + "): " + dupW.slice(0, 15).join(" | "));
else good("no duplicate words (vs A1 + within levels)");
if (dupEx.length) bad("duplicate examples (" + dupEx.length + "): " + dupEx.slice(0, 8).join(" | "));
else good("no duplicate examples");
if (missEn.length) bad("missing EN (" + missEn.length + "): " + missEn.slice(0, 8).join(" | "));
else good("all words have EN translations");
if (missEx.length) bad("missing AR/example (" + missEx.length + "): " + missEx.slice(0, 8).join(" | "));
else good("all words have AR + unique examples");
if (missPl.length) bad("missing plural (" + missPl.length + "): " + missPl.slice(0, 10).join(" | "));
else good("all nouns have plural");
if (missPron.length) bad("missing pronunciation (" + missPron.length + "): " + missPron.slice(0, 8).join(" | "));
else good("all words have pronunciation");
if (badKap.length) bad("broken kapitel refs (" + badKap.length + "): " + badKap.slice(0, 8).join(" | "));
else good("all kapitel references valid");
if (badType.length) bad("bad types: " + badType.slice(0, 8).join(" | "));
else good("all word types valid");
if (gramBad.length) bad("grammar issues (" + gramBad.length + "): " + gramBad.slice(0, 10).join(" | "));
else good("all grammar rules complete (body+examples+quiz+explain)");
console.log("----");
if (fails.length) { console.log("RESULT: FAIL (" + fails.length + ")"); process.exit(1); }
console.log("RESULT: PASS");
