/* Deutsch Master - Translation Key Validator.
 * Compares I18N dictionaries (ar/en/de) in client/study.js and verifies
 * static UI chrome coverage in client/*.html.
 * Fails on: missing/extra/duplicate/empty keys, untranslated German values,
 * unknown data-i18n keys, uncovered Arabic chrome, broken lang wiring.
 * Educational content (German words/sentences, Arabic meanings in JS data)
 * is intentionally out of scope and reported as INFO only.
 * Usage: node tools/check-translations.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
const AR = /[\u0600-\u06FF]/;
let fails = [];
function bad(m) { fails.push(m); console.log("FAIL " + m); }
function good(m) { console.log("PASS " + m); }

/* ---------- 1. parse I18N dicts ---------- */
const study = RD("client/study.js");
const dict = {};
for (const L of ["ar", "en", "de"]) {
  const line = study.split("\n").find(l => l.startsWith(L + ":{"));
  if (!line) { bad("dict block missing for " + L); continue; }
  const pairs = [...line.matchAll(/([A-Za-z0-9_]+):"((?:[^"\\]|\\.)*)"/g)];
  dict[L] = { keys: pairs.map(p => p[1]), vals: Object.fromEntries(pairs.map(p => [p[1], p[2]])) };
  const dupes = pairs.map(p => p[1]).filter((k, i, a) => a.indexOf(k) !== i);
  if (dupes.length) bad("duplicate keys in " + L + ": " + [...new Set(dupes)].join(","));
}
const ka = dict.ar ? dict.ar.keys : [], ke = dict.en ? dict.en.keys : [], kd = dict.de ? dict.de.keys : [];
console.log("Translation Check");
console.log("Arabic keys: " + ka.length + " | English keys: " + ke.length + " | German keys: " + kd.length);
const miss = (a, b) => a.filter(k => !b.includes(k));
const mEn = miss(ka, ke), mDe = miss(ka, kd), mArE = miss(ke, ka), mArD = miss(kd, ka);
if (mEn.length) bad("EN missing: " + mEn.join(","));
if (mDe.length) bad("DE missing: " + mDe.join(","));
if (mArE.length) bad("EN extra: " + mArE.join(","));
if (mArD.length) bad("DE extra: " + mArD.join(","));
if (!mEn.length && !mDe.length && !mArE.length && !mArD.length) good("key parity AR==EN==DE (" + ka.length + " keys)");
let empty = 0;
for (const L of ["ar", "en", "de"]) {
  if (!dict[L]) continue;
  for (const k of dict[L].keys) {
    const v = dict[L].vals[k];
    if (v === undefined || v === null || v === "" || v === "undefined" || v === "null") { bad("empty " + L + "." + k); empty++; }
  }
}
if (!empty) good("no empty/undefined/null translations");
// German must differ from Arabic (unless Arabic value is already Latin/emoji)
let same = 0;
for (const k of ka) {
  if (!dict.de || dict.de.vals[k] === undefined) continue;
  if (dict.de.vals[k] === dict.ar.vals[k] && AR.test(dict.ar.vals[k] || "")) { bad("DE==AR (untranslated): " + k); same++; }
}
if (!same) good("all German values translated");

/* ---------- 2. language wiring ---------- */
for (const f of ["client/index.html", "client/academy.html"]) {
  const h = RD(f);
  const sel = h.match(/<select id="langSel"[^<>]*>([\s\S]*?)<\/select>/);
  const opts = sel ? [...sel[1].matchAll(/value="(ar|en|de)"/g)].map(m => m[1]).sort().join(",") : "";
  if (opts !== "ar,de,en") bad(f + " langSel options: [" + opts + "]");
  else good(f + " langSel has ar/en/de");
  if (!/data-i18n="lang_de">[^<>]*Deutsch/.test(h)) bad(f + " missing Deutsch option label");
}
if (!/setAttribute\("dir",L==="ar"\?"rtl":"ltr"\)/.test(study)) bad("study.js dir wiring missing");
else good("RTL/LTR wiring present");
if (!/setAttribute\("lang",L==="ar"\?"ar":\(L==="de"\?"de":"en"\)\)/.test(study)) bad("study.js lang wiring missing");
else good("lang=ar/en/de wiring present");
if (!/S\.uiLang=ls\.value;Store\.save\(\)/.test(study)) bad("language persistence wiring missing");
else good("language persistence via S.uiLang+Store");
if (!/ls\.value=S\.uiLang\|\|"ar"/.test(study)) bad("langSel boot sync missing");
else good("langSel boot sync present");

/* ---------- 3. data-i18n key existence ---------- */
const usedKeys = new Set();
for (const f of ["client/index.html", "client/academy.html"]) {
  const h = RD(f);
  for (const m of h.matchAll(/data-i18n(?:-ph|-title|-aria)?="([A-Za-z0-9_]+)"/g)) usedKeys.add(m[1]);
}
let unknown = 0;
for (const k of usedKeys) if (!ka.includes(k)) { bad("data-i18n key not in dict: " + k); unknown++; }
if (!unknown) good("all " + usedKeys.size + " data-i18n keys exist in dict");

/* ---------- 4. static chrome coverage ---------- */
// allowlisted Arabic: demo/educational content + dynamic values + JS-driven nav
const ALLOW_HTML = [
  "الطاولة", "دير تيش", "بيت", "هاوس", "البيت كبير", "Haus", // add-word/flashcard demo placeholders
  "مستوى", "مبتدئ", // gamer badge (dynamic number/name from JS)
  "🔥 0 يوم", "لم تحل أي اختبار بعد", // dynamic JS values (streak counter, last-quiz line)
];
function checkChrome(f) {
  let h = RD(f);
  h = h.replace(/<title>[\s\S]*?<\/title>/, ""); // document title handled at runtime via app_title
  // walk tags with a stack; text under data-i18n* or data-page is covered
  const tagRe = /<\/?([a-zA-Z0-9]+)((?:[^<>\"']|"[^"]*"|'[^']*')*)>/g;
  const stack = [];
  let last = 0, uncovered = [];
  let m;
  function covered() { return stack.some(s => s.i18n || s.page); }
  while ((m = tagRe.exec(h))) {
    const text = h.slice(last, m.index);
    if (AR.test(text) && !covered()) {
      const t = text.replace(/\s+/g, " ").trim();
      if (t && !ALLOW_HTML.some(a => t.includes(a))) uncovered.push(t.slice(0, 70));
    }
    last = tagRe.lastIndex;
    const closing = m[0][1] === "/";
    const attrs = m[2] || "";
    if (!closing) {
      stack.push({ i18n: /data-i18n/.test(attrs), page: /data-page=/.test(attrs) });
      if (/\/>$/.test(m[0])) stack.pop();
    } else if (stack.length) stack.pop();
  }
  // attributes with Arabic must be keyed (demo/educational placeholders excluded)
  for (const am of h.matchAll(/(placeholder|title|aria-label)="([^"]*[\u0600-\u06FF][^"]*)"/g)) {
    if (ALLOW_HTML.some(a => am[2].includes(a))) continue;
    const tagStart = h.lastIndexOf("<", am.index);
    const tag = h.slice(tagStart, am.index + am[0].length);
    if (!/data-i18n-(ph|title|aria)=/.test(tag)) uncovered.push("[" + am[1] + "] " + am[2].slice(0, 50));
  }
  const uniq = [...new Set(uncovered)];
  if (uniq.length) { bad(f + " uncovered Arabic chrome (" + uniq.length + "): " + uniq.slice(0, 8).join(" | ")); }
  else good(f + " static chrome fully keyed");
}
checkChrome("client/index.html");
checkChrome("client/academy.html");

/* ---------- 5. INFO: dynamic JS render (out of scope) ---------- */
let dyn = 0;
for (const f of ["script.js", "learn.js", "play.js", "world.js", "life.js", "mygermany.js", "dlife.js", "study.js"]) {
  const t = RD("client/" + f);
  dyn += t.split("\n").filter(l => AR.test(l)).length;
}
console.log("INFO dynamic JS Arabic lines (data+render, phase-2): " + dyn);
console.log("INFO sentex engine uses t() keys: " + ((RD("client/sentex.js").match(/t\("sx_[a-z]+"\)/g) || []).length) + " call sites");

console.log("----");
if (fails.length) { console.log("RESULT: FAIL (" + fails.length + ")"); process.exit(1); }
console.log("RESULT: PASS");
