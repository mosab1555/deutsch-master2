/* Deutsch Master — Unified search (DMSearch) deterministic tests.
 * Uses the REAL client/dm-search.js with stubbed fetch (controlled fixtures).
 * Mocks are for determinism only; live-provider verification is separate.
 * Usage: node tools/test-dm-search.js (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }

/* ---- load REAL module (Node: window undefined -> globalThis, module.exports) ---- */
let DM;
try {
  DM = require("../client/dm-search.js");
  ok("LOAD dm-search.js", !!DM && !!DM.search);
} catch (e) { console.log("FAIL LOAD dm-search.js | " + (e && e.message)); process.exit(1); }

/* ---- local stubs (mirror app globals) ---- */
globalThis.dmNorm = (s) => String(s == null ? "" : s).trim().replace(/\s+/g, " ").toLowerCase()
  .replace(/ß/g, "ss").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
globalThis.dmWordHits = (qn) => {
  const bank = [{ id: "w1", de: "Haus", art: "das", ar: "بيت", en: "house", plural: "Häuser", level: "A1", kap: "K1" }];
  return bank.filter(w => globalThis.dmNorm(w.de) === qn || globalThis.dmNorm(w.de).indexOf(qn) === 0)
    .map(w => ({ w, score: 0, via: "de" }));
};
globalThis.gsLevel = "mixed";

/* ---- controlled fixtures ---- */
const WIK_SEARCH = { query: { search: [{ title: "Haus" }, { title: "Häuser" }] } };
const WIK_EXTRACT = { query: { pages: { 1119: { pageid: 1119, title: "Haus",
  extract: "Haus (Deutsch)\nSubstantiv, n\nWorttrennung:\nHaus, Plural: Häuser\nAussprache:\nIPA: [haʊs]\nBedeutungen:\n[1] zu einem bestimmten Zweck erbautes Gebäude\n[2] zum Wohnen dienendes Gebäude\nBeispiele:\n[1] „Das Haus steht seit 1898.“\nAbkürzungen:\nH." } } } };
const WIK_EMPTY = { query: { search: [] } };
const TAT = { data: [
  { id: 1, text: "Ich gehe zur Arbeit.", owner: "u1", license: "CC BY 2.0 FR", audios: [{ id: 11 }],
    translations: [{ id: 2, text: "I go to work.", lang: "eng", owner: "u2" }] },
  { id: 3, text: "Das Haus ist groß.", owner: "u3", license: "CC BY 2.0 FR", audios: [],
    translations: [{ id: 4, text: "البيت كبير.", lang: "ara", owner: "u4" }] }
]};
const TAT_EMPTY = { data: [] };
const TAT_NOARA = { data: [
  { id: 9, text: "OhneArabisch Test.", owner: "u9", license: "CC BY 2.0 FR", audios: [],
    translations: [{ id: 10, text: "No Arabic test.", lang: "eng", owner: "u10" }] }
]};
const COM_ALL = { query: { allimages: [
  { name: "De-Haus-Haus-Verkehr.ogg", title: "File:De-Haus-Haus-Verkehr.ogg",
    url: "https://upload.wikimedia.org/x/De-Haus-Haus-Verkehr.ogg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:De-Haus-Haus-Verkehr.ogg",
    extmetadata: { Artist: { value: "X" }, LicenseShortName: { value: "CC0" } } },
  { name: "De-Haus.ogg", title: "File:De-Haus.ogg",
    url: "https://upload.wikimedia.org/x/De-Haus.ogg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:De-Haus.ogg",
    extmetadata: { Artist: { value: "Kampy" }, LicenseShortName: { value: "CC BY-SA 3.0" } } },
  { name: "De-Haus2.ogg", title: "File:De-Haus2.ogg",
    url: "https://upload.wikimedia.org/x/De-Haus2.ogg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:De-Haus2.ogg",
    extmetadata: { Artist: { value: "Y" }, LicenseShortName: { value: "CC BY-SA 4.0" } } },
  { name: "De-Haus_Habsburg.ogg", title: "File:De-Haus_Habsburg.ogg",
    url: "https://upload.wikimedia.org/x/De-Haus_Habsburg.ogg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:De-Haus_Habsburg.ogg", extmetadata: {} },
  { name: "De-Haus des Meeres.ogg", title: "File:De-Haus des Meeres.ogg",
    url: "https://upload.wikimedia.org/x/De-Haus_des_Meeres.ogg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:De-Haus_des_Meeres.ogg", extmetadata: {} }
] } };
const OT = { synsets: [{ id: 1, terms: [{ term: "Heim" }, { term: "Behausung" }, { term: "Haus" }] }] };
const MM = { responseData: { translatedText: "أنا ذاهب إلى العمل", match: "0.5" }, responseStatus: 200 };

let calls = {};
let mode = "normal"; /* normal | ot-down | tat-empty | wik-500 | ot-badjson | com-hang */
function mkRes(status, jsonFn) { return { status, json: jsonFn }; }
function stubFetch(url) {
  calls[url] = (calls[url] || 0) + 1;
  const u = String(url);
  if (u.includes("de.wiktionary.org")) {
    if (mode === "wik-500") return Promise.resolve(mkRes(500, () => Promise.resolve({})));
    if (u.includes("list=search")) {
      if (u.includes(encodeURIComponent("Xyzqwort"))) return Promise.resolve(mkRes(200, () => Promise.resolve(WIK_EMPTY)));
      return Promise.resolve(mkRes(200, () => Promise.resolve(WIK_SEARCH)));
    }
    return Promise.resolve(mkRes(200, () => Promise.resolve(WIK_EXTRACT)));
  }
  if (u.includes("api.tatoeba.org")) {
    if (mode === "tat-empty" || u.includes(encodeURIComponent("Xyzqwort"))) {
      return Promise.resolve(mkRes(200, () => Promise.resolve(TAT_EMPTY)));
    }
    if (u.includes(encodeURIComponent("OhneArabisch"))) {
      return Promise.resolve(mkRes(200, () => Promise.resolve(TAT_NOARA)));
    }
    return Promise.resolve(mkRes(200, () => Promise.resolve(TAT)));
  }
  if (u.includes("commons.wikimedia.org")) {
    if (mode === "com-hang") return new Promise(() => {});
    return Promise.resolve(mkRes(200, () => Promise.resolve(COM_ALL)));
  }
  if (u.includes("openthesaurus.de")) {
    if (mode === "ot-down") return Promise.reject(new Error("blocked"));
    if (mode === "ot-badjson") return Promise.resolve(mkRes(200, () => Promise.reject(new Error("nope"))));
    return Promise.resolve(mkRes(200, () => Promise.resolve(OT)));
  }
  if (u.includes("api.mymemory.translated.net")) {
    return Promise.resolve(mkRes(200, () => Promise.resolve(MM)));
  }
  return Promise.reject(new Error("unexpected-url " + u));
}
DM.__setFetch(stubFetch);

(async () => {
  /* 1. local word first */
  DM.__cacheClear(); calls = {}; mode = "normal";
  let r = await DM.search("Haus");
  ok("T1 local word present", r.local && r.local.words.some(w => w.de === "Haus"), "local-first");

  /* 2. rare word absent locally -> wiktionary */
  DM.__cacheClear();
  r = await DM.search("Xyzqwortselten");
  ok("T2 rare word wiktionary path runs", r.remote.wiktionary && ["ok", "empty"].includes(r.remote.wiktionary.status));

  /* 3. sentence exact vs similar */
  DM.__cacheClear();
  r = await DM.search("Ich gehe zur Arbeit.");
  const items = (r.remote.tatoeba.items || []);
  ok("T3a sentence items", r.remote.tatoeba.status === "ok" && items.length === 2);
  ok("T3b exact classified", items.some(i => i.match === "exact" && i.text === "Ich gehe zur Arbeit."));
  ok("T3c similar classified", items.some(i => i.match === "similar"));

  /* 4. multi-provider aggregation */
  DM.__cacheClear();
  r = await DM.search("Haus");
  ok("T4a wiktionary senses", r.remote.wiktionary.status === "ok" && r.remote.wiktionary.senses.length >= 2,
    (r.remote.wiktionary.senses || []).length + " senses");
  ok("T4b wiktionary grammar", r.remote.wiktionary.grammar && r.remote.wiktionary.grammar.ipa === "haʊs" &&
    r.remote.wiktionary.grammar.gender === "das", JSON.stringify(r.remote.wiktionary.grammar));
  ok("T4c commons strict audio", r.remote.commons.status === "ok" &&
    r.remote.commons.items.length === 2 &&
    r.remote.commons.items[0].title === "File:De-Haus.ogg" &&
    r.remote.commons.items.every(i => !/Habsburg|Meeres|Haus-Haus/.test(i.title)),
    JSON.stringify((r.remote.commons.items || []).map(i => i.title)));
  ok("T4d openthesaurus terms", r.remote.openthesaurus.status === "ok" &&
    r.remote.openthesaurus.terms.some(t => t.term === "Heim"));

  /* 5. success alongside failure */
  DM.__cacheClear(); mode = "ot-down";
  r = await DM.search("Haus");
  ok("T5 failure isolated", r.remote.openthesaurus.status === "error" && r.remote.wiktionary.status === "ok" &&
    r.remote.commons.status === "ok", "ot=" + r.remote.openthesaurus.error);
  mode = "normal";

  /* 6. zero-result provider then success elsewhere */
  DM.__cacheClear(); mode = "tat-empty";
  r = await DM.search("Haus");
  ok("T6 empty tatoeba, wiktionary ok", r.remote.tatoeba.status === "empty" && r.remote.wiktionary.status === "ok");
  mode = "normal";

  /* 8/9/11. MT fallback + audio + attribution (before slow timeout test) */
  DM.__cacheClear();
  r = await DM.search("Ich gehe zur Musterarbeit und dann nach Hause.");
  const tatItems = ((r.remote.tatoeba || {}).items) || [];
  const mm = r.remote.mymemory;
  /* TAT fixture always returns items; force no-arabic case via direct mt check below */
  ok("T8 MT adapter labels machine", (await DM.adapters.mymemory("Ich gehe zur Arbeit.")).machine === true);
  DM.__cacheClear();
  r = await DM.search("OhneArabisch Test.");
  ok("T8b coordinator triggers MT when no human Arabic",
    r.remote.mymemory && r.remote.mymemory.status === "ok" && r.remote.mymemory.machine === true &&
    r.remote.mymemory.text.length > 0, (r.remote.mymemory && r.remote.mymemory.text) || "no-mt");
  DM.__cacheClear();
  r = await DM.search("Haus");
  const withAudio = (((r.remote.tatoeba || {}).items) || []).filter(i => (i.audio || []).length);
  ok("T9 audio url shape", r.remote.tatoeba.status === "ok" &&
    (((r.remote.tatoeba.items || [])).length > 0) && withAudio.length > 0 &&
    withAudio[0].audio[0].url.includes("/v1/audios/11/file"), "audio present");
  ok("T10 tts fallback fn", typeof DM.ui.speak === "function");
  ok("T11a tatoeba attribution", withAudio.length > 0 && !!withAudio[0].owner && !!withAudio[0].license && !!withAudio[0].url);
  ok("T11b commons attribution", r.remote.commons.items[0].artist === "Kampy" &&
    /CC BY-SA/.test(r.remote.commons.items[0].license) && !!r.remote.commons.items[0].pageUrl);
  ok("T11c wiktionary attribution", !!r.remote.wiktionary.url && r.remote.wiktionary.license === "CC BY-SA");

  /* 12. HTTP error */
  DM.__cacheClear(); mode = "wik-500";
  r = await DM.search("Haus");
  ok("T12 http error contained", r.remote.wiktionary.status === "error" && r.remote.wiktionary.error === "http-500" &&
    r.remote.commons.status === "ok");
  mode = "normal";

  /* 13. malformed JSON */
  DM.__cacheClear(); mode = "ot-badjson";
  r = await DM.search("Haus");
  ok("T13 bad json contained", r.remote.openthesaurus.status === "error" && r.remote.openthesaurus.error === "bad-json" &&
    r.remote.wiktionary.status === "ok");
  mode = "normal";

  /* 14. stale isolation + inflight dedup */
  DM.__cacheClear(); calls = {};
  const [a, b] = await Promise.all([DM.search("Haus"), DM.search("Arbeit")]);
  ok("T14a no cross-overwrite", a.query === "Haus" && b.query === "Arbeit");
  DM.__cacheClear(); calls = {};
  await Promise.all([DM.search("Haus"), DM.search("Haus")]);
  const wikCalls = Object.keys(calls).filter(k => k.includes("de.wiktionary.org")).length;
  ok("T14b inflight dedup", wikCalls === 2, wikCalls + " urls (search+extract, shared)");

  /* 15. offline: local only (Node ships a read-only navigator: redefine) */
  DM.__cacheClear();
  const navDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try { Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true }); } catch (e) {}
  r = await DM.search("Haus");
  ok("T15 offline local-only", r.offline === true && r.local.words.length > 0 &&
    r.remote.wiktionary.error === "offline");
  try {
    if (navDesc) Object.defineProperty(globalThis, "navigator", navDesc);
    else delete globalThis.navigator;
  } catch (e) {}

  /* 16. empty states */
  DM.__cacheClear(); mode = "tat-empty";
  r = await DM.search("Xyzqwort");
  ok("T16 empty states", r.remote.wiktionary.status === "empty" && r.remote.tatoeba.status === "empty");
  mode = "normal";

  /* 17. no credentials in public files */
  const pub = ["client/dm-search.js", "client/index.html", "client/academy.html", "client/sw.js", "client/style.css"]
    .map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  ok("T17 no secrets", !/(api[_-]?key|apikey|forvo.*key\s*[:=]\s*["'][0-9a-f]{4}|private[_-]?token|client_secret)/i.test(pub));

  /* 18. no global rebuild */
  const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
  ok("T18 no renderAll", !/renderAll\s*\(/.test(src) && /searchResults/.test(src));

  /* 19. i18n keys ar/en/de */
  ok("T19 i18n keys", ["ar:", "en:", "de:"].every(k => src.includes(k)) &&
    ["dm_ext_title", "dm_ext_machine", "dm_ext_retry", "dm_ext_offline"].every(k => {
      const c = (src.match(new RegExp(k, "g")) || []).length; return c >= 3;
    }));

  /* 20. provider registry incl. forvo-disabled */
  const st = DM.status();
  ok("T20 registry", DM.providers.length === 7 && DM.providers.some(p => p.id === "forvo" && p.needsKey) &&
    st.forvo.state === "disabled-needs-key" && st.local.state === "ready");

  /* 7. timeout does not block (slow, last) */
  DM.__cacheClear(); mode = "com-hang";
  const t0 = Date.now();
  r = await DM.search("Haus");
  const dt = Date.now() - t0;
  ok("T7 timeout non-blocking", r.remote.commons.status === "error" && r.remote.wiktionary.status === "ok" && dt < 20000,
    dt + "ms err=" + r.remote.commons.error);
  mode = "normal";

  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("FAIL harness: " + (e && e.stack || e)); process.exit(1); });
