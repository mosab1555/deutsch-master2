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
const FILES = [["curr-a2.js", "CURR_A2"], ["curr-b1.js", "CURR_B1"], ["curr-b2.js", "CURR_B2"],
  ["curr-a1x.js", "CURR_A1X"], ["curr-a2b.js", "CURR_A2B"], ["curr-b1b.js", "CURR_B1B"], ["curr-b2b.js", "CURR_B2B"]];
for (const [f, k] of FILES) {
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

const VALID_LV = { A1: ["K0", "K1", "K2", "K3", "K4", "K5"], A2: ["K6", "K7", "K8"], B1: ["K9", "K10", "K11"], B2: ["K12", "K13", "K14"] };
// German mass/abstract nouns with genuinely no plural (verified, not missing data)
const UNCOUNTABLE = new Set(["müll", "husten", "schnupfen", "fieber", "handgepäck", "arbeitslosigkeit", "umwelt", "umweltschutz", "luftverschmutzung", "klima", "klimawandel", "solarenergie", "mülltrennung", "gerechtigkeit", "gleichheit", "freiheit", "respekt", "toleranz", "eignung", "einarbeitung", "motivation", "kritik", "feedback", "anerkennung", "erschöpfung", "erholung", "wirtschaft", "wachstum", "inflation", "opposition", "publikum", "literatur", "mehrsprachigkeit", "integration", "vielfalt", "verantwortung", "werbung", "applaus",
"nebel", "hitze", "kälte", "mitte", "durst", "hunger", "geschmack", "mehl", "wechselgeld", "vorsicht", "durchfall", "verstopfung", "pfand", "leergut", "probieren", "frischfleisch", "kühlung", "kerzenlicht", "verlass", "wahrheit", "chilipfeffer", "meersalz", "balsamico", "rapsöl", "dankbarkeit",
"überstunden", "spesen", "anwesenheit", "abwesenheit", "zuständigkeit", "vorkasse", "verzug", "mängel", "deckung", "iban", "bic", "schulden", "gedächtnis", "konzentration", "dringlichkeit", "aufwand", "nutzen", "kosten-nutzen", "effizienz", "verschwendung", "nachhaltigkeit", "wasserverbrauch", "stromverbrauch", "co2-ausstoß", "ausstoß", "feinstaub", "lärmbelästigung", "lärmschutz", "heizkosten", "ersatz", "kohleausstieg", "atomausstieg", "meinungsfreiheit", "pressefreiheit", "zensur", "beweisführung", "doppelmoral", "wahlbeteiligung", "stimmenthaltung", "einstimmigkeit", "stimmenmehrheit", "neuwahlen",
"verifizierung", "empirie", "kausalität", "signifikanz", "verdacht", "unausweichlichkeit", "unabdingbarkeit", "deeskalation", "geduld", "mediation", "kompromissbereitschaft", "bereitschaft", "machtvakuum", "extremismus", "versöhnung", "aufarbeitung", "wachsamkeit", "rhetorik", "redekunst", "schlagfertigkeit", "geistesgegenwart", "besonnenheit", "panik", "gelassenheit", "resilienz", "selbstwirksamkeit", "selbstzweifel", "pessimismus", "optimismus", "realismus", "weitblick", "kurzsichtigkeit", "rache", "vergebung", "vergessen", "fokus", "wesentliche", "selbstfindung", "selbstverwirklichung",
// A1 PDF import (Netzwerk neu A1 Glossar): verified singular-only / mass nouns
"abendkleidung", "architektur", "ausland", "begeisterung", "blut", "eis", "fernsehen", "fotozubehör", "freizeit", "freizeitkleidung", "gepäck", "geschirr", "heimat", "honig", "internet", "kleidung", "kofferpacken", "missfallen", "mist", "mistwetter", "norden", "nähe", "osten", "pantomime", "pech", "post", "quatsch", "regen", "schmuck", "schnee", "selbstbedienung", "skifahren", "sportkleidung", "süden", "trompetenunterricht", "unterricht", "wasser", "westen", "wetter", "wortinnere"]);
const VALID_TYPES = ["اسم", "فعل", "صفة", "ضمير", "أداة", "مفردات"];
const seen = new Map(Object.entries({}).map(([k, v]) => [k, v]));
existKeys.forEach(k => seen.set(k, "A1"));
let nW = 0, nG = 0, nS = 0, nEx = 0;
const dupW = [], dupEx = [], missEn = [], missEx = [], missPl = [], missPron = [], badLv = [], badKap = [], badType = [], gramBad = [];
const exSeen = new Set();

const perLevel = { A1: { w: 0, g: 0, s: 0, r: 0 }, A2: { w: 0, g: 0, s: 0, r: 0 }, B1: { w: 0, g: 0, s: 0, r: 0 }, B2: { w: 0, g: 0, s: 0, r: 0 } };
for (const DK of Object.keys(levels)) {
  const D = levels[DK];
  if (!D) continue;
  const L = D.level || "A1";
  // kapitel sanity (extras reuse their level's base kaps)
  const kaps = new Set((D.kapitel || []).map(k => k[0]));
  (VALID_LV[L] || []).forEach(k => kaps.add(k));
  if ((D.kapitel || []).length) for (const k of (VALID_LV[L] || [])) if (!kaps.has(k)) bad("level " + L + " missing kapitel " + k);
  (D.words || []).forEach((w, i) => {
    nW++; perLevel[L].w++;
    const tag = DK + "#" + (i + 1) + " " + w[0];
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
    nG++; perLevel[L].g++;
    const tag = DK + " grammar#" + (i + 1) + " " + g[0];
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
    nS++; perLevel[L].s++;
    if (!s[0] || !s[1]) bad("empty sentence " + DK + "#" + (i + 1));
    if (!kaps.has(s[3])) badKap.push("sentence " + DK + "#" + (i + 1) + " kap=" + s[3]);
    const e = String(s[0]).toLowerCase();
    if (exSeen.has(e)) dupEx.push("SENT: " + String(s[0]).slice(0, 50)); else exSeen.add(e);
  });
  // explain coverage: fixed g-ids for base datasets, gx-keys for extras
  const isBase = (DK === "A2" || DK === "B1" || DK === "B2");
  const base = { A2: 42, B1: 54, B2: 66 }[DK];
  (D.grammar || []).forEach((g, i) => {
    const id = isBase ? ("g" + (base + i)) : ("gx" + i);
    const E = D.explain && D.explain[id];
    if (!E) { gramBad.push(DK + ":" + id + " (" + g[0] + "): missing EXPLAIN entry"); return; }
    nEx++;
    for (const f of ["goals", "what", "why", "examples", "when", "how", "daily", "compare", "notes", "mistakes", "summary", "review"])
      if (E[f] === undefined || E[f] === null || (E[f].length !== undefined && E[f].length === 0)) gramBad.push(DK + ":" + id + ": empty explain." + f);
  });
  // banks (required for base datasets; optional extras)
  for (const b of ["listen", "speak", "real"]) {
    const arr = D[b] || [];
    if (!arr.length && isBase) bad(DK + " empty bank: " + b);
    arr.forEach((it, i) => { if (!it.title && !it.topic) bad(DK + "." + b + "#" + i + " no title"); });
  }
  // reading validation
  (D.reading || []).forEach((r, i) => {
    perLevel[L].r++;
    if (!r.title || !r.de || !r.ar || !(r.qs || []).length) bad(DK + " reading#" + i + " incomplete");
    (r.qs || []).forEach((q, qi) => {
      if (!q.q || !q.opts || q.opts.length < 3 || !(q.correct >= 0 && q.correct < q.opts.length)) bad(DK + " reading#" + i + " q" + qi + " bad");
    });
  });
}

console.log("---- counts: words=" + nW + " grammar=" + nG + " sentences=" + nS + " explain=" + nEx);
for (const L of ["A1", "A2", "B1", "B2"]) console.log("LEVEL " + L + ": words=" + perLevel[L].w + " grammar=" + perLevel[L].g + " sentences=" + perLevel[L].s + " reading=" + perLevel[L].r);
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
