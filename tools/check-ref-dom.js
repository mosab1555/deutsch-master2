/* Deutsch Master — Reference DOM smoke test (opens every path + topic for real).
   Stubs a minimal DOM, executes the REAL engine + data, asserts rendered content:
   independent home/path/topic views, breadcrumb, explanation sections, tables,
   examples+speak, mistakes-or-notes, related, quiz, invalid-topic fallback,
   inner back-navigation, and the REAL search ranking (incl. Arabic aliases).
   Exit 0 = PASS. Usage: node tools/check-ref-dom.js
*/
const fs = require("fs");
const path = require("path");
const CDIR = path.join(__dirname, "..", "client");

/* ---------- minimal DOM stubs ---------- */
function makeEl(id) {
  return {
    _id: id, innerHTML: "", textContent: "", value: "", disabled: false,
    addEventListener() {}, scrollIntoView() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getAttribute() { return null; },
    setAttribute() {}, appendChild() {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
  };
}
const els = {};
global.document = {
  getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  querySelectorAll() { return []; },
  createElement() { return makeEl("dyn"); }
};
global.window = global;
global.window.scrollTo = function () {};
global.S = { uiLang: "ar" };
global.I18N = { ar: {}, en: {}, de: {} };

/* ---------- load data files in index.html tag order + encyclopedia overlay ---------- */
const html = fs.readFileSync(path.join(CDIR, "index.html"), "utf8");
const dataFiles = [...html.matchAll(/<script src="(reference-data-[^"]+\.js)"><\/script>/g)].map(m => m[1]);
if (!dataFiles.length) { console.log("FAIL no data tags"); process.exit(1); }
if (!/<script src="reference-ency\.js"><\/script>/.test(html)) { console.log("FAIL reference-ency.js not registered in index.html"); process.exit(1); }
dataFiles.forEach(f => {
  const src = fs.readFileSync(path.join(CDIR, f), "utf8");
  const names = [...src.matchAll(/^var (REF_[A-Z][A-Z0-9]*)/gm)].map(m => m[1]);
  const box = {};
  eval(src + ";" + names.map(n => "box." + n + "=(typeof " + n + "!==\"undefined\"?" + n + ":undefined);").join(""));
  names.forEach(n => { global[n] = box[n]; });
});
/* overlay (pure data, no REF_* globals — must not throw here) */
try {
  const ency = fs.readFileSync(path.join(CDIR, "reference-ency.js"), "utf8");
  eval(ency);
  if (!global.DMRefEncy || !global.DMRefEncy.overlays) { console.log("FAIL DMRefEncy missing"); process.exit(1); }
} catch (e) { console.log("FAIL ency load: " + e.message); process.exit(1); }
/* ---------- load engine ---------- */
const engSrc = fs.readFileSync(path.join(CDIR, "reference.js"), "utf8");
eval(engSrc + ";globalThis.T={renderReference,openRefPath,openRefTopic,runRefSearch,refPathTopics,refTopicById,REF_PATHS};");
const T = globalThis.T;

let fails = 0;
function bad(m) { fails++; console.log("FAIL " + m); }
function good(m) { console.log("PASS " + m); }

/* ---------- 1. home: 16 independent path cards ---------- */
T.renderReference();
const homeHtml = els["refBox"].innerHTML;
const cards = (homeHtml.match(/data-path="/g) || []).length;
if (cards === 16) good("home renders 16 path cards");
else bad("home cards=" + cards);
const PLACEHOLDER_RE = /ref_coming|Coming Soon|TODO|FIXME|LOREM|سيتم بناؤه|المرحلة القادمة|تحت الإنشاء|سيضاف لاحق/i;
if (PLACEHOLDER_RE.test(homeHtml)) bad("placeholder text in home");
if (!homeHtml.includes("ref-crumb") && homeHtml.includes("data-topic")) good("home has featured/topics entry points");
if (!/refDetail/.test(homeHtml)) good("home has no stacked detail area (independent views)");

/* ---------- 2. every path (list only) + every topic (independent page) ---------- */
let nTopics = 0, nQuiz = 0, nEx = 0;
T.REF_PATHS.forEach(p => {
  T.openRefPath(p.id);
  const pathHtml = els["refBox"].innerHTML;
  if (!pathHtml.includes("ref-crumb")) bad("path " + p.id + " no breadcrumb");
  /* path view must NOT render topic detail inline */
  if (pathHtml.includes("ref-ex-de")) bad("path " + p.id + " leaks topic detail (must be independent view)");
  const topics = T.refPathTopics(p.id);
  if (!topics.length) { bad("path " + p.id + " empty"); return; }
  topics.forEach(tp => {
    nTopics++;
    T.openRefTopic(tp.id);
    const h = els["refBox"].innerHTML;
    const tag = p.id + "/" + tp.id;
    if (!h || h.length < 500) { bad(tag + " tiny/empty render (" + (h || "").length + ")"); return; }
    if (!h.includes("ref-crumb")) bad(tag + " no breadcrumb");
    if (!h.includes("ref-ex-de")) bad(tag + " no examples");
    else nEx++;
    if (!h.includes("quiz-opt")) bad(tag + " no quiz");
    else nQuiz++;
    if (!h.includes("ex-table")) bad(tag + " no table");
    if (!h.includes("data-spk")) bad(tag + " no speak button");
    if (tp.mistakes && tp.mistakes.length) { if (!h.includes("ex-mist")) bad(tag + " mistakes missing"); }
    else if (!h.includes("ex-ul")) bad(tag + " notes missing");
    if (tp.related && tp.related.length && !h.includes("data-rel")) bad(tag + " related missing");
    if (PLACEHOLDER_RE.test(h)) bad(tag + " placeholder text");
  });
});
good("opened " + nTopics + " topics with examples(" + nEx + ") + quiz(" + nQuiz + ")");
/* encyclopedia overlay sections on flagship topics */
T.openRefTopic("d-akkusativ");
{
  const h = els["refBox"].innerHTML;
  if (h.includes("حالة المفعول المباشر") && h.includes("Den Hund beißt der Mann") && h.includes("ref-trickbox") && h.includes("ref-quick")) good("d-akkusativ encyclopedia sections render");
  else bad("d-akkusativ overlay sections missing");
}
/* order-type renders */
T.openRefTopic("m-verbstellung");
if (els["refBox"].innerHTML.includes("ref-order-bank")) good("order-type quiz renders");
else bad("order-type quiz missing");
/* table cells link to word cards */
T.openRefTopic("h-akkusativ");
if (els["refBox"].innerHTML.includes('data-rel="h-w-durch"')) good("table cell links to word card");
else bad("table cell links missing");
/* invalid topic fallback (must never crash) */
try {
  T.openRefTopic("nope-xyz-invalid");
  const h = els["refBox"].innerHTML;
  if (h.includes("refNfBack") || h.includes("غير موجود") || h.includes("not found") || h.includes("nicht gefunden")) good("invalid topic fallback renders");
  else bad("invalid topic fallback missing");
} catch (e) { bad("invalid topic threw: " + e.message); }

/* ---------- 3. inner back-navigation: topic -> path -> home ---------- */
T.renderReference();
T.openRefPath("D");
T.openRefTopic("d-akkusativ");
if (!global.DMRef || typeof global.DMRef.back !== "function") bad("DMRef.back missing");
else {
  if (!global.DMRef.canBack()) bad("DMRef.canBack false on topic");
  global.DMRef.back();
  const backHtml = els["refBox"].innerHTML;
  if (backHtml.includes("data-topic") && !backHtml.includes("ref-ex-de")) good("back: topic -> path list");
  else bad("back: topic did not return to path list");
  global.DMRef.back();
  const homeHtml2 = els["refBox"].innerHTML;
  if ((homeHtml2.match(/data-path="/g) || []).length === 16) good("back: path -> home (16 cards)");
  else bad("back: path did not return home");
  if (!global.DMRef.canBack()) good("DMRef.canBack false at home (page back resumes)");
  else bad("DMRef.canBack stuck true at home");
}

/* ---------- 4. real search ranking ---------- */
global.S.uiLang = "de";
const SEARCH = [
  ["mit", "mit"], ["Dativ", "Dativ"], ["gestern", "gestern"], ["weil", "weil"],
  ["können", "können"],   ["der", "📄 der <"], ["nicht", "Negation"], ["Perfekt", "Perfekt"],
  ["ضمائر", "Personalpronomen"], ["ماضي", "Perfekt"], ["liegen", "Lageverben"], ["ich", "ich"]
];
SEARCH.forEach(([q, expectDe]) => {
  els["refSearch"].value = q;
  T.runRefSearch();
  const h = els["refResults"].innerHTML;
  if (h.includes(expectDe)) good("search '" + q + "' shows '" + expectDe + "'");
  else bad("search '" + q + "' missing '" + expectDe + "' -> " + h.slice(0, 120));
});
/* Arabic alias search (encyclopedia requirement) */
global.S.uiLang = "ar";
[["المفعول به", "Akkusativ"], ["النفي", "kein"], ["الفاعل", "Nominativ"]].forEach(([q, expectAr]) => {
  els["refSearch"].value = q;
  T.runRefSearch();
  const h = els["refResults"].innerHTML;
  if (h.includes(expectAr)) good("alias search '" + q + "' shows '" + expectAr + "'");
  else bad("alias search '" + q + "' missing '" + expectAr + "' -> " + h.slice(0, 160));
});

console.log("----");
if (fails) { console.log("RESULT: FAIL (" + fails + ")"); process.exit(1); }
console.log("RESULT: PASS");
