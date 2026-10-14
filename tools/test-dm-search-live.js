/* Deutsch Master — DMSearch LIVE evidence (real HTTP, no mocks).
 * Records actual Tatoeba status codes + hit counts for the example queries.
 * Evidence-only: exit 0 unless the harness itself breaks (stuck loading,
 * exception, or a fallback-flag/fetch-count mismatch, which are real logic
 * invariants independent of provider data).
 * Usage: node tools/test-dm-search-live.js (exit 0 = PASS, 1 = FAIL)
 */
const DM = require("../client/dm-search.js");

let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("PASS " + n + (e ? " | " + e : "")); } else { fail++; console.log("FAIL " + n + (e ? " | " + e : "")); } }

/* mirror the app globals used by localSearch (same stubs as unit tests) */
globalThis.dmNorm = (s) => String(s == null ? "" : s).trim().replace(/\s+/g, " ").toLowerCase()
  .replace(/ß/g, "ss").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
globalThis.dmWordHits = (qn) => {
  const bank = [{ id: "w1", de: "Haus", art: "das", ar: "بيت", en: "house", plural: "Häuser", level: "A1", kap: "K1" }];
  return bank.filter(w => globalThis.dmNorm(w.de) === qn || globalThis.dmNorm(w.de).indexOf(qn) === 0)
    .map(w => ({ w, score: 0, via: "de" }));
};
globalThis.gsLevel = "mixed";

const seen = [];
let realFetch = null;
try { realFetch = globalThis.fetch.bind(globalThis); } catch (e) {}
if (!realFetch) { console.log("SKIP no-fetch in this runtime"); process.exit(0); }
DM.__setFetch((u, o) => { try { seen.push(String(u)); } catch (e) {} return realFetch(u, o); });

(async () => {
  for (const q of ["Ich möchte einen Kaffee, bitte.", "Haus", "Kaffee"]) {
    DM.__cacheClear(); seen.length = 0;
    const t0 = Date.now();
    let st = null;
    try {
      st = await DM.search(q);
    } catch (e) { ok("LIVE " + q.slice(0, 20) + " no-throw", false, String((e && e.message) || e)); continue; }
    const dt = Date.now() - t0;
    const tat = (st && st.remote && st.remote.tatoeba) || {};
    const tatUrls = seen.filter(u => u.includes("api.tatoeba.org"));
    let stuck = false;
    try { stuck = Object.values(st.remote).some(v => v && v.status === "loading"); } catch (e) {}
    console.log("EVIDENCE query=" + JSON.stringify(q) + " ms=" + dt +
      " tatoeba=" + tat.status + (tat.error ? "/" + tat.error : "") +
      " fallback=" + !!tat.fallback + " items=" + ((tat.items || []).length) +
      " tatFetches=" + tatUrls.length);
    (tat.items || []).slice(0, 3).forEach(it =>
      console.log("  item id=" + it.id + " match=" + it.match + " text=" + JSON.stringify(it.text).slice(0, 90)));
    tatUrls.forEach(u => console.log("  fetch " + ((u.match(/[?&]q=[^&]*/) || ["?q=?"])[0])));
    ok("LIVE " + q.slice(0, 20) + " settles", !stuck, "tatoeba=" + tat.status);
    if (tat.status === "ok" && tat.fallback) {
      ok("LIVE fallback really fetched", tatUrls.length >= 2, tatUrls.length + " fetches");
    }
  }
  /* Raw endpoint probes: the actual HTTP status codes, unabstracted. */
  async function raw(label, url) {
    try {
      const r = await realFetch(url);
      let n = "?";
      try { const j = await r.json(); n = (((j && j.data) || []).length); } catch (e) {}
      console.log("RAW " + label + " http=" + r.status + " hits=" + n);
    } catch (e) { console.log("RAW " + label + " NETWORK-BLOCKED " + String((e && e.message) || e)); }
  }
  const TAT = "https://api.tatoeba.org/v1/sentences";
  const P = "&limit=6&sort=relevance&showtrans=all&include=audios";
  await raw("full-normalized", TAT + "?lang=deu&q=" + encodeURIComponent("Ich möchte einen Kaffee bitte") + P);
  await raw("keyword-Kaffee", TAT + "?lang=deu&q=Kaffee" + P);
  await raw("Haus", TAT + "?lang=deu&q=Haus" + P);
  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("FAIL harness: " + (e && e.stack || e)); process.exit(1); });
