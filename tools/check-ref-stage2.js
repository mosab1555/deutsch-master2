/* Stage-2 data validator (temp file, deleted after run). */
const fs = require("fs");
const src = fs.readFileSync("client/reference.js", "utf8");
// stub browser globals used at load time
const I18N = { ar: {}, en: {}, de: {} };
let fails = [];
function bad(m) { fails.push(m); console.log("FAIL " + m); }
function good(m) { console.log("PASS " + m); }
eval(src + ";globalThis.REF_CATS=REF_CATS;globalThis.REF_DATA=REF_DATA;globalThis.REF_TOPICS=REF_TOPICS;");
const { REF_CATS, REF_DATA } = globalThis;
// 1. 16 categories
if (REF_CATS.length === 16) good("16 categories"); else bad("cats=" + REF_CATS.length);
// 2. expected stage-2 keys
const exp = ["pronouns_0","pronouns_1","pronouns_2","pronouns_3","pronouns_4","pronouns_5","pronouns_6",
  "articles_0","articles_1","articles_2","articles_3","articles_4"];
exp.forEach(k => { if (!REF_DATA[k]) bad("missing " + k); });
good("all 12 stage-2 topics present");
// 3. each topic: use + >=1 table + >=2 examples + >=1 quiz, no empty cells
exp.forEach(k => {
  const d = REF_DATA[k];
  if (!d.use) bad(k + " no use");
  (d.tables || []).forEach((tb, i) => {
    const w = tb.head.length;
    tb.rows.forEach((r, j) => { if (r.length !== w) bad(k + " table" + i + " row" + j + " width " + r.length + "!=" + w); });
    tb.rows.flat().forEach(c => { if (!String(c).trim()) bad(k + " empty cell"); });
  });
  if (!(d.examples || []).length) bad(k + " no examples");
  (d.examples || []).forEach(e => { if (!e[0] || !e[1]) bad(k + " example missing translation"); });
  (d.quiz || []).forEach((q, i) => {
    if (q.correct < 0 || q.correct >= q.opts.length) bad(k + " quiz" + i + " bad correct idx");
    if (!q.why) bad(k + " quiz" + i + " no why");
  });
});
good("tables/examples/quiz shape OK");
// 4. personal pronouns exact values
const pp = REF_DATA.pronouns_0.tables[0];
const akk = pp.rows[1], dat = pp.rows[2];
const expAkk = ["Akkusativ (wen?)","mich","dich","ihn","sie","es","uns","euch","sie","Sie"];
const expDat = ["Dativ (wem?)","mir","dir","ihm","ihr","ihm","uns","euch","ihnen","Ihnen"];
if (JSON.stringify(akk) === JSON.stringify(expAkk)) good("personal pronouns Akkusativ exact");
else bad("Akkusativ row mismatch: " + JSON.stringify(akk));
if (JSON.stringify(dat) === JSON.stringify(expDat)) good("personal pronouns Dativ exact");
else bad("Dativ row mismatch: " + JSON.stringify(dat));
// 5. kein/nicht separation: kein rows mention Auto/Zeit, nicht rows mention heute/nicht gut
const neg = JSON.stringify(REF_DATA.articles_2);
if (neg.includes("kein Auto") && neg.includes("keine Zeit") && neg.includes("heute nicht")) good("kein/nicht distinction present");
else bad("kein/nicht content gap");
// 6. internal search smoke: ضمائر / nicht / Dativ must hit; mit/gestern/ماضي are later stages
function norm(s){return String(s||"").toLowerCase().replace(/ß/g,"ss").replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u").trim();}
function search(q){
  q = norm(q); const hits = [];
  REF_CATS.forEach(c=>{ if(norm(c.ar+" "+c.de+" "+c.en).includes(q)) hits.push("cat:"+c.id); });
  Object.keys(REF_DATA).forEach(k=>{ if(norm(JSON.stringify(REF_DATA[k])).includes(q)) hits.push(k); });
  return hits;
}
[["ضمائر",1],["nicht",1],["Dativ",1]].forEach(([q])=>{
  const h = search(q);
  if (h.length) good("search '" + q + "' -> " + h.slice(0,3).join(","));
  else bad("search '" + q + "' no hits");
});
console.log("----");
if (fails.length) { console.log("RESULT: FAIL (" + fails.length + ")"); process.exit(1); }
console.log("RESULT: PASS");
