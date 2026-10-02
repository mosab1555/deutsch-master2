/* Deutsch Master - Study methodology guide (howto.js) test suite.
 * Covers: sidebar integration (order/icon/once), page wiring in both shells,
 * module data integrity, internal-link resolution, search behavior, i18n
 * parity, CSS fluidity, sw precache, no id/global collisions.
 * Usage: node tools/test-howto.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");
let pass = 0, fail = 0;
function check(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

/* ---------- 1. sidebar + shells ---------- */
const EXPECT_HEAD = ["dashboard", "vocab", "sentences", "explain", "verbs", "reference", "flashcards", "howto"];
for (const f of ["client/index.html", "client/academy.html"]) {
  const h = RD(f);
  const navCount = (h.match(/data-page="howto"/g) || []).length;
  check(f + " nav howto exactly once", navCount === 1, "n=" + navCount);
  const ico = h.match(/data-page="howto"><span class="nav-ico">([^<]*)</);
  check(f + " nav howto has single icon", !!ico && ico[1].trim().length > 0, ico ? ico[1] : "none");
  const navs = [...h.matchAll(/<button class="nav-item[^"]*" data-page="([^"]+)"/g)].map(m => m[1]);
  const head = navs.slice(0, 8);
  check(f + " sidebar order keeps howto 8th", head.join(",") === EXPECT_HEAD.join(","), head.join(","));
  check(f + " section page-howto", h.indexOf('id="page-howto"') >= 0);
  check(f + " container howtoBox", h.indexOf('id="howtoBox"') >= 0);
  check(f + " loads howto.js", /<script src="howto\.js(\?[^"]*)?"><\/script>/.test(h));
  const dups = (h.match(/id="howtoBox"/g) || []).length;
  check(f + " howtoBox unique", dups === 1, "n=" + dups);
}

/* ---------- 2. load howto.js logic in sandbox ---------- */
const src = RD("client/howto.js");
const sandbox = { I18N: { ar: {}, en: {}, de: {} }, console: { log() {}, error() {}, warn() {} } };
sandbox.globalThis = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: "howto.js" });
  check("howto.js loads without errors", true);
} catch (e) { check("howto.js loads without errors", false, e.message); }
function js(expr) { return vm.runInContext(expr, sandbox); }
const MODS = js("DM_HOWTO") || [];
check("modules count >= 25", MODS.length >= 25, "n=" + MODS.length);
const ids = MODS.map(m => m.id);
check("module ids unique", new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i).join(","));
check("module ids prefixed hw-", ids.every(id => /^hw-[a-z]+$/.test(id)), ids.filter(id => !/^hw-[a-z]+$/.test(id)).join(","));
const CATS = js("DM_HOWTO_CATS.map(function(c){return c.id;})") || [];
const badMod = MODS.filter(m => !m.id || !m.icon || !m.cat || !m.kw || !m.t || !m.t.ar || !m.t.en || !m.t.de || !m.body || !Array.isArray(m.go) || !m.go.length);
check("modules have all required fields", badMod.length === 0, badMod.map(m => m.id).join(","));
check("module cats valid", MODS.every(m => CATS.indexOf(m.cat) >= 0));
check("module bodies substantive", MODS.every(m => String(m.body).length > 200), MODS.filter(m => String(m.body).length <= 200).map(m => m.id).join(","));

/* required topic coverage (spec modules) */
const need = ["hw-plan", "hw-order", "hw-lesson", "hw-daily", "hw-week", "hw-fixnow", "hw-words", "hw-art", "hw-plural", "hw-verbs", "hw-forget", "hw-srs", "hw-sent", "hw-wordorder", "hw-neg", "hw-questions", "hw-akk", "hw-dat", "hw-prep", "hw-tense", "hw-gram", "hw-pron", "hw-listen", "hw-speak", "hw-conv", "hw-write", "hw-think", "hw-notrans", "hw-fromsent", "hw-review", "hw-mistakes", "hw-weak", "hw-mastery", "hw-road", "hw-exam", "hw-common"];
check("all required topics present", need.every(id => ids.indexOf(id) >= 0), need.filter(id => ids.indexOf(id) < 0).join(","));

/* ---------- 3. internal links resolve to real pages ---------- */
const htmlNavs = new Set([...RD("client/index.html").matchAll(/data-page="([^"]+)"/g)].map(m => m[1]));
let badGo = [];
MODS.forEach(m => (m.go || []).forEach(g => { if (!htmlNavs.has(g[1])) badGo.push(m.id + "->" + g[1]); }));
const FIX = js("DM_HOWTO_FIX") || [];
FIX.forEach(f => { if (!js("DM_HOWTO").some(m => m.id === f.mod)) badGo.push("fix->" + f.mod); if (!htmlNavs.has(f.go)) badGo.push("fix->" + f.go); });
check("guide links resolve to existing pages", badGo.length === 0, badGo.slice(0, 5).join(","));
check("fix-now covers >= 12 situations", FIX.length >= 12, "n=" + FIX.length);

/* ---------- 4. search behavior ---------- */
check("search empty returns all", js("howtoSearch('').length") === MODS.length);
check("search 'der' finds article guide", js("howtoSearch('der')").indexOf("hw-art") >= 0);
check("search 'akkusativ' finds akk", js("howtoSearch('Akkusativ')").indexOf("hw-akk") >= 0);
check("search 'plural' finds plural", js("howtoSearch('plural')").indexOf("hw-plural") >= 0);
check("search 'srs' finds srs", js("howtoSearch('SRS')").indexOf("hw-srs") >= 0);
check("search arabic 'النطق' finds pron", js("howtoSearch('النطق')").indexOf("hw-pron") >= 0);
check("search umlaut-tolerant 'horen'", js("howtoSearch('horen')").indexOf("hw-listen") >= 0, js("howtoSearch('horen')").slice(0, 4).join(","));
check("search gibberish empty", js("howtoSearch('zzzqqq')").length === 0);
check("search 'der die das' finds art+plural", (function () { const r = js("howtoSearch('der die das')"); return r.indexOf("hw-art") >= 0; })());

/* ---------- 5. i18n parity of howto keys ---------- */
(function () {
  const dict = {};
  for (const L of ["ar", "en", "de"]) {
    const m = src.match(new RegExp("Object\\.assign\\(I18N\\." + L + "\\s*,\\s*\\{([\\s\\S]*?)\\}\\)"));
    dict[L] = m ? [...m[1].matchAll(/([A-Za-z0-9_]+)\s*:\s*"/g)].map(x => x[1]) : [];
  }
  check("howto i18n keys ar==en==de", dict.ar.length > 0 && dict.ar.length === dict.en.length && dict.en.length === dict.de.length
    && dict.ar.every(k => dict.en.indexOf(k) >= 0 && dict.de.indexOf(k) >= 0), "ar=" + dict.ar.length + " en=" + dict.en.length + " de=" + dict.de.length);
  check("howto i18n has page keys", ["howto", "title_howto", "hw_search_ph"].every(k => dict.ar.indexOf(k) >= 0));
})();

/* ---------- 6. CSS + sw + collisions ---------- */
(function () {
  const css = RD("client/style.css");
  check("css has howto block", css.indexOf("howto.js") >= 0);
  const tail = css.split("Study methodology guide")[1] || "";
  const big = (tail.match(/(?<![\w-])(?:min-width|width)\s*:\s*(\d+)px/g) || []).filter(x => parseInt(x.match(/(\d+)px/)[1], 10) > 340);
  check("css howto block has no fixed widths >340px", big.length === 0, big.slice(0, 3).join(","));
  ["hw-mod", "hw-de", "hw-head", "hw-cats", "hw-fix-grid"].forEach(c => check("css defines ." + c, css.indexOf("." + c) >= 0));
  const sw = RD("client/sw.js");
  check("sw precaches howto.js", sw.indexOf('"./howto.js"') >= 0);
  const others = ["script.js", "study.js", "labsx.js", "adv.js"].map(f => RD("client/" + f));
  const mine = ["howtoBox", "hwSearch", "howtoSearch", "renderHowto", "ensureHowto", "DM_HOWTO"];
  check("no howto id/fn collision elsewhere", mine.every(id => others.every(o => o.indexOf(id) < 0)));
})();

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
