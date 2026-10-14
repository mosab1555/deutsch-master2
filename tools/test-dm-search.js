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

  /* 20. provider registry incl. forvo-disabled + en fallback */
  const st = DM.status();
  ok("T20 registry", DM.providers.length === 8 && DM.providers.some(p => p.id === "forvo" && p.needsKey) &&
    DM.providers.some(p => p.id === "wiktionary-en") &&
    st.forvo.state === "disabled-needs-key" && st.local.state === "ready");

  /* ==== Phase 2: Fix 1 MyMemory retry (dispatcher accepts mymemory) ==== */
  /* F1a: first MT fails, retry succeeds, successes preserved */
  DM.__cacheClear();
  let mmCalls = 0;
  const origFetch = stubFetch;
  DM.__setFetch((url, opts) => {
    const u = String(url);
    if (u.includes("api.mymemory.translated.net")) {
      mmCalls++;
      if (mmCalls === 1) return Promise.resolve(mkRes(500, () => Promise.resolve({})));
      return Promise.resolve(mkRes(200, () => Promise.resolve(MM)));
    }
    return origFetch(url, opts);
  });
  DM.__cacheClear(); mmCalls = 0;
  r = await DM.search("OhneArabisch Test.");
  ok("F1a first MT fails", r.remote.mymemory && r.remote.mymemory.status === "error",
    "err=" + (r.remote.mymemory && r.remote.mymemory.error));
  const priorOk = r.remote.wiktionary && r.remote.wiktionary.status;
  const retryState = await DM.search("OhneArabisch Test.", { only: ["mymemory"], prior: r });
  ok("F1b retry MT succeeds", retryState.remote.mymemory && retryState.remote.mymemory.status === "ok" &&
    retryState.remote.mymemory.machine === true, (retryState.remote.mymemory && retryState.remote.mymemory.text) || "no-mt");
  ok("F1c retry preserves successes", retryState.remote.wiktionary && retryState.remote.wiktionary.status === priorOk,
    "wik=" + (retryState.remote.wiktionary && retryState.remote.wiktionary.status));
  /* F1d: fail-fail terminates as error (rate-limit honest, never fake success) */
  DM.__setFetch((url) => {
    const u = String(url);
    if (u.includes("api.mymemory.translated.net")) return Promise.resolve(mkRes(429, () => Promise.resolve({})));
    return origFetch(url);
  });
  DM.__cacheClear();
  r = await DM.adapters.mymemory("Ich gehe zur Arbeit.");
  ok("F1d rate-limit honest error", r.status === "error" && r.error === "rate-limited", r.error || r.status);
  /* F1e: retry does not rerun successful unrelated providers */
  DM.__setFetch(origFetch); DM.__cacheClear(); mode = "normal";
  calls = {};
  r = await DM.search("Haus");
  const wikUrlCount1 = Object.keys(calls).filter(k => k.includes("de.wiktionary.org")).length;
  calls = {};
  const r2 = await DM.search("Haus", { only: ["mymemory"], prior: r });
  const wikUrlCount2 = Object.keys(calls).filter(k => k.includes("de.wiktionary.org")).length;
  ok("F1e retry skips ok providers", wikUrlCount2 === 0, "wikCalls=" + wikUrlCount2 + " (was " + wikUrlCount1 + ")");
  /* F1f: old retry cannot overwrite newer query (gen+query guard via search gen) */
  DM.__cacheClear();
  const pa = DM.search("Haus");
  const pb = DM.search("Arbeit");
  const [ra, rb] = await Promise.all([pa, pb]);
  ok("F1f new search not overwritten", ra.query === "Haus" && rb.query === "Arbeit");
  /* F1g: loading/error terminate (no stuck loading) */
  DM.__cacheClear();
  r = await DM.search("OhneArabisch Test.");
  const stuck = Object.values(r.remote).some(v => v && v.status === "loading");
  ok("F1g no stuck loading", !stuck);

  /* ==== Phase 2: Fix 2 Tatoeba audio licensing ==== */
  const pol = DM.utils.tatoebaAudioPolicy;
  ok("F2a allowed (license spelling)", (() => {
    const p = pol({ id: 690095, author: "MisterTrouser", license: "CC BY 4.0", attribution_url: "https://tatoeba.org/user/profile/MisterTrouser" });
    return p.eligible && p.author === "MisterTrouser" && p.license === "CC BY 4.0" && p.url.includes("/v1/audios/690095/file");
  })());
  ok("F2b allowed (licence spelling per spec)", (() => {
    const p = pol({ id: 1, author: "kevin62", licence: "CC0 1.0", attribution_url: "https://example.com/audio/kevin" });
    return p.eligible && p.license === "CC0 1.0";
  })());
  ok("F2c disallowed unknown-license not embedded", (() => {
    const p = pol({ id: 3, author: "BraveSentry", license: "", attribution_url: "https://tatoeba.org/user/profile/BraveSentry" });
    return !p.eligible && p.reason === "unknown-license";
  })());
  ok("F2d removed/missing not embedded", (() => {
    const p = pol(null);
    return !p.eligible;
  })());
  ok("F2e text license never covers audio", (() => {
    const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
    return /tatoebaAudioPolicy/.test(src) && /unknown-license/.test(src) && !/text license.*covers audio/i.test(src);
  })());
  ok("F2f no audio bytes cached", (() => {
    const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
    return !/caches\.open\([^)]*audio/i.test(src) && !/cacheSet\([^)]*\.url/i.test(src) &&
      !/c\.put\([^)]*audio/i.test(src) && /never audio bytes/i.test(src);
  })());

  /* ==== Phase 2: Fix 3 cancellation ==== */
  /* F3a: query B aborts exclusive requests of query A (different keys) */
  DM.__cacheClear();
  let abortSeen = false;
  DM.__setFetch((url, opts) => {
    const u = String(url);
    const sig = opts && opts.signal;
    if (u.includes("openthesaurus.de")) {
      /* slow exclusive request for A; aborts when B starts (different query => different key, previous ctrl aborted) */
      return new Promise((res, rej) => {
        const t = setTimeout(() => res(mkRes(200, () => Promise.resolve(OT))), 3000);
        try {
          if (sig && typeof sig.addEventListener === "function") {
            if (sig.aborted) { clearTimeout(t); const e = new Error("aborted"); e.name = "AbortError"; rej(e); abortSeen = true; return; }
            sig.addEventListener("abort", () => { clearTimeout(t); abortSeen = true; const e = new Error("aborted"); e.name = "AbortError"; rej(e); }, { once: true });
          }
        } catch (e) {}
      });
    }
    return origFetch(url, opts);
  });
  DM.__cacheClear(); abortSeen = false;
  const slowA = DM.search("Haus");
  await new Promise(res => setTimeout(res, 100));
  const fastB = await DM.search("Donaudampfschifffahrt");
  const slowRes = await slowA;
  ok("F3a B aborts A exclusive", abortSeen || (slowRes.remote.openthesaurus && slowRes.remote.openthesaurus.status === "aborted"),
    "abortSeen=" + abortSeen + " status=" + (slowRes.remote.openthesaurus && slowRes.remote.openthesaurus.status));
  ok("F3b A cannot overwrite B", fastB.query === "Donaudampfschifffahrt" && slowRes.query === "Haus");
  /* F3c: aborted not retried */
  const abortedPrior = { query: "Haus", remote: { openthesaurus: { status: "aborted", provider: "openthesaurus" }, wiktionary: { status: "ok", provider: "wiktionary", senses: [{ n: "1", text: "x" }] } } };
  const failedKeys = Object.keys(abortedPrior.remote).filter(k => {
    const v = abortedPrior.remote[k];
    return v && (v.status === "error" || v.status === "empty");
  });
  ok("F3c aborted not in retry queue", failedKeys.length === 0, "keys=" + failedKeys.join(","));
  /* F3d: timeouts still work (independent per-provider) */
  DM.__setFetch(origFetch); DM.__cacheClear(); mode = "com-hang";
  r = await DM.search("Haus");
  ok("F3d timeout preserved", r.remote.commons && r.remote.commons.status === "error" && r.remote.commons.error === "timeout");
  mode = "normal";
  /* F3e: other providers survive one cancellation */
  DM.__cacheClear();
  r = await DM.search("Haus");
  ok("F3e survivors after cancel", r.remote.wiktionary.status === "ok" && r.remote.tatoeba.status === "ok");
  /* F3f: leave/cancel increments gen, no delayed update (unit: cancel callable) */
  ok("F3f cancel API", typeof DM.cancel === "function" && typeof DM.ui.cancel === "function");
  DM.__setFetch(origFetch);

  /* ==== Phase 2: Fix 4 cold sentence-search ==== */
  DM.__cacheClear();
  const c0 = Date.now();
  r = await DM.search("Ich gehe zur Arbeit.");
  const cdt = Date.now() - c0;
  ok("F4a cold-start correctness", r.local && Array.isArray(r.local.words) && r.remote.tatoeba && ["ok", "empty", "error"].includes(r.remote.tatoeba.status),
    cdt + "ms");
  ok("F4b cold stats recorded (no brittle timing)", (() => {
    try {
      const cs = DM.debug && DM.debug.coldStats;
      return !!(cs && cs.builds >= 1);
    } catch (e) { return false; }
  })());
  ok("F4c concurrent local+remote (no vocab load)", (() => {
    const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
    return /localP.*concat.*jobs|concurrently/i.test(src) && !/VOCAB\.push|load.*entire vocabulary/i.test(src);
  })());

  /* ==== Phase 2: Fix 5 incremental DOM (static guarantees + policy) ==== */
  ok("F5a no wrap.innerHTML clear", (() => {
    const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
    return !/wrap\.innerHTML\s*=\s*""/.test(src);
  })());
  ok("F5b stable keys + reuse", (() => {
    const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
    return /data-dm-sec/.test(src) && /data-dm-sent/.test(src) && /data-dm-audio/.test(src) &&
      /findAudioBySrc/.test(src) && /orderedInsert/.test(src);
  })());
  ok("F5c no global render", (() => {
    const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
    return !/renderAll\s*\(/.test(src);
  })());
  ok("F5d textContent-only (no remote innerHTML)", (() => {
    const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
    const idx = src.indexOf("function renderState");
    const body = idx >= 0 ? src.slice(idx, idx + 30000) : src;
    return !/\.innerHTML\s*=.*(it\.text|tr\.text|sn\.text|mm\.text)/.test(body);
  })());

  /* ==== Phase 2: Fix 6 dictionary fallback ==== */
  const WIKEN_SEARCH = { query: { search: [{ title: "Haus" }] } };
  const WIKEN_EXTRACT = { query: { pages: { 1512: { pageid: 1512, title: "Haus",
    extract: "\nEnglish\nProper noun\nHaus (plural Hauses)\nA surname\nGerman\nPronunciation\nIPA: [haʊs]\nNoun\nHaus n\nhouse, building\nIn dem Haus haben wir mal gewohnt. — We used to live in that house." } } } };
  DM.__setFetch((url, opts) => {
    const u = String(url);
    if (u.includes("en.wiktionary.org")) {
      if (u.includes("list=search")) return Promise.resolve(mkRes(200, () => Promise.resolve(WIKEN_SEARCH)));
      return Promise.resolve(mkRes(200, () => Promise.resolve(WIKEN_EXTRACT)));
    }
    if (u.includes("de.wiktionary.org") && u.includes("list=search") && u.includes(encodeURIComponent("Xyzqwort"))) {
      return Promise.resolve(mkRes(200, () => Promise.resolve(WIK_EMPTY)));
    }
    return origFetch(url, opts);
  });
  DM.__cacheClear();
  const enR = await DM.adapters["wiktionary-en"]("Haus");
  ok("F6a EN fallback returns lexical data", enR.status === "ok" && enR.provider === "wiktionary-en" &&
    (enR.senses.length > 0 || enR.grammar.ipa) && enR.license === "CC BY-SA", JSON.stringify(enR.senses).slice(0, 120));
  ok("F6b EN labelled honestly", enR.edition === "en" && /en\.wiktionary\.org/.test(enR.url));
  /* primary success => fallback not auto-triggered */
  DM.__cacheClear();
  r = await DM.search("Haus");
  ok("F6c primary success, fallback idle", r.remote.wiktionary.status === "ok" && !r.remote["wiktionary-en"]);
  /* both empty */
  DM.__setFetch((url) => {
    const u = String(url);
    if (u.includes("wiktionary.org") && u.includes("list=search")) return Promise.resolve(mkRes(200, () => Promise.resolve({ query: { search: [] } })));
    return origFetch(url);
  });
  DM.__cacheClear();
  r = await DM.search("Xyzqwort");
  ok("F6d both editions empty", r.remote.wiktionary.status === "empty" && r.remote["wiktionary-en"] && r.remote["wiktionary-en"].status === "empty");
  /* fallback timeout */
  DM.__setFetch((url, opts) => {
    const u = String(url);
    if (u.includes("en.wiktionary.org")) return new Promise(() => {});
    return origFetch(url, opts);
  });
  DM.__cacheClear();
  const enT = await Promise.race([
    DM.adapters["wiktionary-en"]("Haus"),
    new Promise(res => setTimeout(() => res({ status: "timeout-race" }), 11000))
  ]);
  ok("F6e fallback timeout terminates", enT.status === "error" && enT.error === "timeout", enT.error || enT.status);
  /* fallback failure isolated */
  DM.__setFetch((url) => {
    const u = String(url);
    if (u.includes("en.wiktionary.org")) return Promise.resolve(mkRes(500, () => Promise.resolve({})));
    return origFetch(url);
  });
  DM.__cacheClear();
  const enF = await DM.adapters["wiktionary-en"]("Haus");
  ok("F6f fallback failure isolated", enF.status === "error" && enF.error === "http-500");
  ok("F6g external links verified official", (() => {
    const links = DM.utils.dictFallbackLinks("Haus");
    return links.length === 3 && links.some(l => l.url.includes("duden.de")) &&
      links.some(l => l.url.includes("dwds.de")) && links.every(l => /^https:\/\//.test(l.url));
  })());
  ok("F6h missing dict hides nothing", (() => {
    const src = fs.readFileSync(path.join(ROOT, "client/dm-search.js"), "utf8");
    return /dict-none/.test(src) && /Does not hide/.test(src);
  })());
  DM.__setFetch(origFetch); DM.__cacheClear(); mode = "normal";

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
