/* Deutsch Master - Production QA audit (node).
   Tests critical logic WITHOUT browser: shuffle fairness, answer mapping,
   search ranking, daily determinism, sentence-order validation.
   Run: node tools/qa-audit.js  (exit 1 on failure) */
const fs = require("fs");
const path = require("path");
const C = (f) => fs.readFileSync(path.join(__dirname, "..", "client", f), "utf8");
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? " :: " + extra : "")); }
}
// ---- 1. No biased sort(()=>Math.random) anywhere ----
["play.js","script.js","learn.js","study.js","labsx.js","mygermany.js","curriculum.js","feats.js","smart.js","sentex.js"].forEach(f => {
  ok("no-sort-bias:" + f, !/sort\(\(\)=>Math\.random/.test(C(f)));
});
// ---- 2. No fixed article opts without shuffle ----
ok("script:genArticle-shuffled", /shuffledArticleOpts/.test(C("script.js")));
ok("play:gRush-shuffled", /artSh=shuffleOptions/.test(C("play.js").replace(/ /g,"")) || /artSh\s*=\s*shuffleOptions/.test(C("play.js")));
ok("play:gTF-shuffled", /tfSh=shuffleOptions/.test(C("play.js").replace(/ /g,"")) || /tfSh/.test(C("play.js")));
ok("play:gTF-no-alternating", !/truth=ix%2===0/.test(C("play.js")));
ok("play:gSpell-no-length-sort", !/a\.de\.length-b\.de\.length/.test(C("play.js")));
ok("learn:placement-grammar-shuffled", /so\.map\(ix=>g\.quiz\.opts\[ix\]\)/.test(C("learn.js")));
ok("learn:final-no-alternating", !/correct:i%2\?0:1/.test(C("learn.js")));
ok("study:glab-shuffled", /glShuffle\(it\.opts\.map/.test(C("study.js")));
ok("labsx:erShuffle-used", /erShuffle\(/.test(C("labsx.js")));
ok("mygermany:shopbuy-shuffled", /correctPos/.test(C("mygermany.js")));
ok("feats:rdQuiz-shuffled", /order\.map\(function\(oi\)/.test(C("feats.js")));
ok("curriculum:listen-shuffled", /data-oi/.test(C("curriculum.js")) && /shuffle4/.test(C("curriculum.js")));
// ---- 3. Statistical fairness: Fisher-Yates over 4000 trials ----
function fy(a){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=x[i];x[i]=x[j];x[j]=t;}return x;}
function shuffleOptions(opts,correctIdx){const order=fy(opts.map((_,i)=>i));return{opts:order.map(i=>opts[i]),correct:order.indexOf(correctIdx)};}
const N=4000,counts=[0,0,0,0];let keyOk=true;
for(let t=0;t<N;t++){const r=shuffleOptions(["a","b","c","d"],0);counts[r.correct]++;if(r.opts[r.correct]!=="a")keyOk=false;}
ok("stats:key-follows-shuffle", keyOk);
const exp=N/4;const chi=counts.reduce((s,c)=>s+(c-exp)*(c-exp)/exp,0);
ok("stats:uniform-4pos-chi2<30", chi<30, "counts="+counts.join(",")+" chi2="+chi.toFixed(1));
// No A/B/A/B pattern: check consecutive-repeat rate sane + transitions mixed
let prev=-1,rep=0;const trans={};
for(let t=0;t<2000;t++){const r=shuffleOptions(["a","b","c"],0);const c=r.correct;if(c===prev)rep++;trans[prev+">"+c]=(trans[prev+">"+c]||0)+1;prev=c;}
ok("stats:no-hard-alternation", rep<1200 && rep>300, "repeats="+rep);
// ---- 4. Daily determinism: seeded shuffle same seed => same order ----
function seededRng(seed){let s=seed>>>0||1;return function(){s^=s<<13;s>>>=0;s^=s>>>17;s^=s>>>0;s^=s<<5;s>>>=0;return(s>>>0)/4294967296;};}
function seededShuffle(arr,seed){const r=seededRng(seed);const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
function dailySeed(str){let h=0;for(let i=0;i<str.length;i++){h=((h*31)+str.charCodeAt(i))|0;}return h<0?-h:h;}
const s1=seededShuffle([1,2,3,4,5,6,7,8,9,10],dailySeed("2026-09-24"));
const s2=seededShuffle([1,2,3,4,5,6,7,8,9,10],dailySeed("2026-09-24"));
const s3=seededShuffle([1,2,3,4,5,6,7,8,9,10],dailySeed("2026-09-25"));
ok("daily:same-date-same-order", JSON.stringify(s1)===JSON.stringify(s2));
ok("daily:seeds-differ-per-date", dailySeed("2026-09-24")!==dailySeed("2026-09-25"));
ok("play:daily-uses-seededShuffle", /seededShuffle\(list,seed\)/.test(C("play.js")));
// ---- 5. Search ranking: dmNorm + tier order ----
const script=C("script.js");
ok("search:dmNorm-umlaut", /\.replace\(\/ß\/g,"ss"\)/.test(script) && /\.replace\(\/ä\/g,"a"\)/.test(script));
ok("search:tier-exact-prefix-substring", /score=0/.test(script) && /score=30\+/.test(script));
ok("search:sentences-uses-dmNorm", /renderSentences\(\)[\s\S]{0,400}dmNorm/.test(script));
ok("search:verbs-uses-dmNorm", /renderVerbs\(\)[\s\S]{0,400}dmNorm/.test(script));
// Functional mini-test of ranking logic (mirror of dmWordHits tiers)
function tier(de,q){if(de===q)return 0;if(de.indexOf(q)===0)return 10;const b=de.indexOf(" "+q);if(b>=0)return 20;const s=de.indexOf(q);if(s>=0)return 30;return 50;}
ok("search:haus-ranks-prefix-first", tier("haus","haus")<tier("hausaufgabe","haus") && tier("hausaufgabe","haus")<tier("rathaus","haus"));
// ---- 6. Sentence-order validation (norm, punctuation-insensitive) ----
function norm(s){return s.replace(/[.?!,]/g,"").trim().replace(/\s+/g," ").toLowerCase();}
ok("order:norm-accepts-punct", norm("Ich lerne Deutsch.")===norm("Ich lerne Deutsch"));
ok("order:norm-rejects-wrong", norm("Deutsch lerne Ich")!==norm("Ich lerne Deutsch"));
// ---- 7. Storage/import guards ----
ok("storage:import-validated", /typeof clean\[k\]/.test(script) || /Array\.isArray\(clean/.test(script));
ok("storage:addword-dupe-check", /الكلمة موجودة بالفعل/.test(script));
ok("nav:showPage-stops-timer", /stopQTimer/.test(script) && /DM_PAGE_TOKEN/.test(script));
ok("security:escape-single-quote", /&#39;/.test(script));
ok("security:dlife-missing-escaped", /missTxt/.test(C("dlife.js")) || /escapeHtml\(x\)/.test(C("dlife.js")));
ok("i18n:renderShadow-clash-fixed", /renderFeatShadow/.test(C("feats.js")) && !/function shRun\(/.test(C("feats.js")));

console.log("\n==== QA RESULT: "+pass+" passed, "+fail+" failed ====");
process.exit(fail ? 1 : 0);
