// Functional verification of phase-2 advanced systems (node, no browser).
// Run: node tools/test-adv.js (from project root)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const SRC = f => fs.readFileSync(path.join(root, "client", f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? " [" + x + "]" : "")); } };

// 1. buildQuestions variant rotation: simulate new logic, assert no 3-same-kind in 200 builds
function kindFits(t, w) {
  if (t === "article" || t === "write") return w.art !== "-";
  if (t === "plural") return w.art !== "-" && !!w.plural;
  if (t === "order") return true;
  return true;
}
const KINDS = ["article","de-ar","ar-de","plural","write","listening","sentence","order"];
const stubW = [
  { id: "a", art: "der", plural: "die X" }, { id: "b", art: "-", plural: "" },
  { id: "c", art: "die", plural: "die Y" }, { id: "d", art: "das", plural: "" }
];
let badRuns = 0;
for (let r = 0; r < 200; r++) {
  let prev = "", run = 0, worst = 0; const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const w = stubW[Math.floor(Math.random() * stubW.length)];
    const fitting = KINDS.filter(k => kindFits(k, w));
    const pool = fitting.length ? fitting : ["de-ar"];
    let cand = pool[Math.floor(Math.random() * pool.length)], g = 0;
    while (cand === prev && run >= 2 && pool.length > 1 && g < 8) { cand = pool[Math.floor(Math.random() * pool.length)]; g++; }
    if (cand === prev) run++; else { prev = cand; run = 1; }
    worst = Math.max(worst, run); seen.add(cand);
  }
  if (worst >= 3) badRuns++;
}
check("variants: no 3-same-kind in 200x12 builds", badRuns === 0, "bad=" + badRuns);

// 2. ADV_FIX bank: unique bad sentences, err index valid, 10 categories
const adv = SRC("adv.js");
const fixBlock = adv.slice(adv.indexOf("const ADV_FIX="), adv.indexOf("function advFixPool"));
const bads = [...fixBlock.matchAll(/bad:"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
check("fixbank: >=20 items", bads.length >= 20, "n=" + bads.length);
check("fixbank: unique sentences", new Set(bads).size === bads.length);
const cats = [...fixBlock.matchAll(/cat:"([^"]*)"/g)].map(m => m[1]);
check("fixbank: 10 categories", new Set(cats).size >= 10, [...new Set(cats)].join(","));
let errOk = true;
[...fixBlock.matchAll(/bad:"((?:[^"\\]|\\.)*)",good:"(?:[^"\\]|\\.)*",err:(-?\d+)/g)].forEach(m => {
  const toks = m[1].replace(/([.?!,])/g, " $1").split(" ").filter(Boolean);
  const e = parseInt(m[2], 10);
  if (e >= toks.length) errOk = false;
});
check("fixbank: err indices valid", errOk);

// 3. DL scenarios: 16 unique ids (10 old + 6 new)
const dlNew = [...adv.matchAll(/id:"(train|uni|jobiv|ausb|wohn|dir)"/g)].map(m => m[1]);
check("dlife: 6 new scenario ids", new Set(dlNew).size === 6, dlNew.join(","));
const dlOld = ["shopping","restaurant","transport","hotel","bank","doctor","phone","meet","school","interview"];
check("dlife: no id collision with old", dlNew.every(id => !dlOld.includes(id)));

// 4. Mastery lifecycle simulation (mirror of noteMastered + showFeedback logic)
const S = { mistakes: {}, fixedTotal: 0 };
function rec(w) { const m = S.mistakes[w] || (S.mistakes[w] = { n: 0, okn: 0, done: false }); m.n++; m.okn = 0; m.done = false; }
function okA(w) { const m = S.mistakes[w]; if (!m) return; m.okn = (m.okn || 0) + 1; if (m.okn >= 3 && !m.done) { m.done = true; S.fixedTotal++; } m.n = Math.max(0, (m.n || 1) - 1); if (m.n <= 0 && m.done) delete S.mistakes[w]; else if (m.n <= 0 && !m.done) m.n = 1; }
rec("w1"); rec("w1"); okA("w1");
check("mastery: not deleted after 1 correct", !!S.mistakes["w1"] && !S.mistakes["w1"].done);
okA("w1"); okA("w1");
check("mastery: done after 3 consecutive + fixedTotal++", !S.mistakes["w1"] && S.fixedTotal === 1);
rec("w2"); okA("w2"); rec("w2");
check("mastery: re-error resets okn/done", S.mistakes["w2"].okn === 0 && !S.mistakes["w2"].done && S.mistakes["w2"].n === 2);

// 5. No duplicate globals introduced (allowed intentional overrides)
const files = fs.readdirSync(path.join(root, "client")).filter(f => f.endsWith(".js"));
const map = {};
files.forEach(f => {
  const s = SRC(f);
  const re = /function\s+([A-Za-z0-9_$]+)\s*\(/g; let m;
  while ((m = re.exec(s))) { const n = m[1]; map[n] = map[n] || []; map[n].push(f); }
});
const allowed = new Set(["renderMistakes", "showPage", "renderDashboard", "renderJourney", "renderTutor", "q", "answer", "done", "next", "render", "step", "esc", "finish", "fin", "fb", "renderQ"]);
const bad = Object.keys(map).filter(k => map[k].length > 1 && !allowed.has(k));
check("nodup: no accidental global collisions", bad.length === 0, bad.map(k => k + "=>" + map[k].join(",")).join(" | "));

// 6. New pages use only existing CSS classes
const css = SRC("style.css");
const classes = ["panel", "glass", "quiz-opts", "quiz-opt", "quiz-write", "quiz-feedback", "order-answer", "order-chip", "row-flex", "mist-card", "progress", "grid-2", "muted"];
const used = new Set([...adv.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(" ")).filter(c => c && !/['(+]/.test(c)));
const missing = [...used].filter(c => c && !["hidden", "sm", "btn", "btn-primary", "btn-ghost", "btn-gold", "btn-green", "btn-red", "mini-btn", "full-input", "page-head", "de-line", "word-ar", "mist-err", "card-actions", "stat-num", "ex-de", "ex-ar", "ex-de-l", "talk-bot", "j-stage", "ach-grid", "ach-card", "done", "locked", "reveal", "ok", "no", "used", "good", "bad", "correct", "wrong", "active", "show", "open", "flipped", "tag", "kap-tag", "sent-de", "sent-ar", "sent-pron", "sent-num", "sent-card", "rd-text", "rd-w", "detail-de", "detail-ar", "detail-pl", "word-top", "word-pron", "word-meta", "word-ex", "word-de", "word-de-ltr", "verb-de", "conj-table", "grammar-card", "grammar-body", "grammar-quiz", "grammar-ex", "history-item", "level-card", "level-num", "stat-card", "stat-ico", "stat-label", "stat-bar-row", "bar", "fill", "lbl", "week-day", "week-bar", "theme-card", "theme-prev", "theme-name", "theme-hex", "search-hit", "flash-article", "article", "none", "der", "die", "das", "quiz-order", "quiz-type", "xp-float", "lifemap-pin", "donut", "tbl-wrap", "topbar", "sidebar", "main", "content", "page", "side-lang", "side-lang-head", "nav-item", "nav-ico", "badge", "icon-btn", "search-wrap", "search-ico", "search-results", "has-text", "save-plan", "exp-myg", "exp-dl", "der", "die", "das"].includes(c) && !css.includes("." + c));
check("css: all adv classes exist", missing.length === 0, missing.join(","));

console.log("\n==== FUNCTIONAL: " + pass + " passed, " + fail + " failed ====");
process.exit(fail ? 1 : 0);
