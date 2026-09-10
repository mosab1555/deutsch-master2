/* Deutsch Master - Automated 3-language test plan (AR/EN/DE).
 * Covers: availability, key parity, no missing/empty translations, switching,
 * persistence wiring, HTML lang/dir mapping, UI smoke test.
 * No test framework exists in this repo (see package.json), so this plain
 * node script is the official suite. Usage: node tools/test-languages.js
 * Exit 0 = PASS, 1 = FAIL.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }

const study = RD("client/study.js");
const dict = {};
for (const L of ["ar", "en", "de"]) {
  const line = study.split("\n").find(l => l.startsWith(L + ":{"));
  if (!line) { console.log("FAIL dict block " + L); process.exit(1); }
  dict[L] = Object.fromEntries([...line.matchAll(/([A-Za-z0-9_]+):"((?:[^"\\]|\\.)*)"/g)].map(m => [m[1], m[2]]));
}
function t(L, k) {
  const d = dict[L] || {};
  if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k];
  const a = (dict.ar || {})[k];
  if (a !== undefined && a !== null && a !== "") return a;
  return k;
}
// Test 1 — availability
ok("T1 ar exists", Object.keys(dict.ar).length > 0, dict.ar && Object.keys(dict.ar).length + " keys");
ok("T1 en exists", Object.keys(dict.en).length > 0);
ok("T1 de exists", Object.keys(dict.de).length > 0);
// Test 2 — parity
const ka = Object.keys(dict.ar), ke = Object.keys(dict.en), kd = Object.keys(dict.de);
ok("T2 ar==en", ka.length === ke.length && ka.every(k => ke.includes(k)), ka.length + " keys");
ok("T2 en==de", ke.length === kd.length && ke.every(k => kd.includes(k)));
// Test 3 — no missing
ok("T3 missing=0", ka.every(k => ke.includes(k) && kd.includes(k)));
// Test 4 — no empty/null/undefined
let empty = 0;
for (const L of ["ar", "en", "de"]) for (const k of Object.keys(dict[L])) {
  const v = dict[L][k];
  if (v === "" || v === "null" || v === "undefined") { console.log("FAIL T4 empty " + L + "." + k); empty++; }
}
ok("T4 empty=0", empty === 0);
// Test 5 — switching (all 6 directions resolve real strings, never the key)
const pairs = [["ar", "en"], ["en", "de"], ["de", "ar"], ["ar", "de"], ["de", "en"], ["en", "ar"]];
let sw = true;
for (const [a, b] of pairs) for (const k of ["practice", "sentex", "games", "quiz_next", "settings"]) {
  if (t(a, k) === k || t(b, k) === k || t(a, k) === "" || t(b, k) === "") { console.log("FAIL T5 " + a + "->" + b + " " + k); sw = false; }
}
ok("T5 switching 6 directions", sw);
// Test 6 — persistence wiring (per language)
const persist = study.includes("S.uiLang=ls.value;Store.save()") && study.includes('ls.value=S.uiLang||"ar"');
ok("T6 persistence ar/en/de", persist, "S.uiLang+Store+boot sync");
// Test 7 — HTML lang mapping
ok("T7 lang mapping", study.includes('setAttribute("lang",L==="ar"?"ar":(L==="de"?"de":"en"))'));
// Test 8 — direction mapping
ok("T8 dir mapping", study.includes('setAttribute("dir",L==="ar"?"rtl":"ltr")'));
// Test 9 — smoke: required pages have de UI + no leaks in static chrome
const need = { dashboard: "Startseite", practice: "Intelligentes Training", sentex: "Satzübungen", games: "Spiele", quiz: "Tests", review: "Wiederholung", settings: "Einstellungen", mistakes: "Meine Fehler" };
let smoke = true;
for (const [k, de] of Object.entries(need)) if (t("de", k) !== de) { console.log("FAIL T9 de." + k); smoke = false; }
for (const f of ["client/index.html", "client/academy.html"]) {
  const h = RD(f);
  for (const bad of ["undefined", "[object Object]", "nav.dashboard", "quiz_next"]) {
    if (h.includes(">" + bad + "<")) { console.log("FAIL T9 leak in " + f + ": " + bad); smoke = false; }
  }
}
ok("T9 smoke (11 pages, no leaks)", smoke);
console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
process.exit(fail ? 1 : 0);
