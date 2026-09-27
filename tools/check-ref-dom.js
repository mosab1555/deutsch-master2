/* Deutsch Master — Reference DOM smoke test (opens every path + topic for real).
   Stubs a minimal DOM, executes the REAL engine + data, asserts rendered content:
   Opened / explanation / tables / examples+speak / mistakes-or-notes / related / quiz.
   Also runs the REAL search ranking for every query.
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
    classList: { add() {}, remove() {}, toggle() {} }
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

/* ---------- load data files in index.html tag order ---------- */
const html = fs.readFileSync(path.join(CDIR, "index.html"), "utf8");
const dataFiles = [...html.matchAll(/<script src="(reference-data-[^"]+\.js)"><\/script>/g)].map(m => m[1]);
if (!dataFiles.length) { console.log("FAIL no data tags"); process.exit(1); }
dataFiles.forEach(f => {
  const src = fs.readFileSync(path.join(CDIR, f), "utf8");
  const names = [...src.matchAll(/^var (REF_[A-Z][A-Z0-9]*)/gm)].map(m => m[1]);
  const box = {};
  eval(src + ";" + names.map(n => "box." + n + "=(typeof " + n + "!==\"undefined\"?" + n + ":undefined);").join(""));
  names.forEach(n => { global[n] = box[n]; });
});
/* ---------- load engine ---------- */
const engSrc = fs.readFileSync(path.join(CDIR, "reference.js"), "utf8");
eval(engSrc + ";globalThis.T={renderReference,openRefPath,openRefTopic,runRefSearch,refPathTopics,refTopicById,REF_PATHS};");
const T = globalThis.T;

let fails = 0;
function bad(m) { fails++; console.log("FAIL " + m); }
function good(m) { console.log("PASS " + m); }

/* ---------- 1. home: 16 path cards ---------- */
T.renderReference();
const homeHtml = els["refBox"].innerHTML;
const cards = (homeHtml.match(/data-path="/g) || []).length;
if (cards === 16) good("home renders 16 path cards");
else bad("home cards=" + cards);
const PLACEHOLDER_RE = /ref_coming|Coming Soon|TODO|FIXME|LOREM|سيتم بناؤه|المرحلة القادمة|تحت الإنشاء|سيضاف لاحق/i;
if (PLACEHOLDER_RE.test(homeHtml)) bad("placeholder text in home");

/* ---------- 2. every path + every topic ---------- */
let nTopics = 0, nQuiz = 0, nEx = 0;
T.REF_PATHS.forEach(p => {
  T.openRefPath(p.id);
  const topics = T.refPathTopics(p.id);
  if (!topics.length) { bad("path " + p.id + " empty"); return; }
  topics.forEach(tp => {
    nTopics++;
    T.openRefTopic(tp.id);
    const h = els["refDetail"].innerHTML;
    const tag = p.id + "/" + tp.id;
    if (!h || h.length < 500) { bad(tag + " tiny/empty render (" + (h || "").length + ")"); return; }
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
/* order-type renders */
T.openRefTopic("m-verbstellung");
if (els["refDetail"].innerHTML.includes("ref-order-bank")) good("order-type quiz renders");
else bad("order-type quiz missing");
/* table cells link to word cards */
T.openRefTopic("h-akkusativ");
if (els["refDetail"].innerHTML.includes('data-rel="h-w-durch"')) good("table cell links to word card");
else bad("table cell links missing");

/* ---------- 3. real search ranking ---------- */
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

console.log("----");
if (fails) { console.log("RESULT: FAIL (" + fails + ")"); process.exit(1); }
console.log("RESULT: PASS");
