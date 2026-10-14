/* Deutsch Master — Unified multi-source German search engine (DMSearch).
 *
 * One search field (the existing #globalSearch) fans out to:
 *   1. local   — existing Deutsch Master banks (dmWordHits / SENTENCES / verbs / grammar).
 *                Always first, works offline, never inflates course banks.
 *   2. wiktionary (de.wiktionary.org MediaWiki API, origin=* CORS) — definitions,
 *                grammar, plural, IPA, German examples. Parsed as TEXT only.
 *   3. tatoeba  (api.tatoeba.org v1) — German example sentences + linked
 *                translations (Arabic preferred), audio refs, attribution.
 *   4. commons  (commons.wikimedia.org MediaWiki API, origin=* CORS) — strictly
 *                matched pronunciation recordings with license attribution.
 *   5. openthesaurus (openthesaurus.de API) — synonyms / related terms with
 *                attribution. Graceful "unavailable" if blocked (never faked).
 *   6. mymemory (api.mymemory.translated.net) — German->Arabic machine
 *                translation fallback for sentences lacking a human translation.
 *                Always labelled machine-generated, never authoritative.
 *   7. forvo    — registered as OPTIONAL (needs private key). Never called from
 *                the browser, never blocks search, never caches audio.
 *
 * Rules honoured: per-provider timeout (8s) + result caps, AbortController
 * cancellation, stale-generation guard, in-flight dedup, bounded text-only
 * memory cache (never audio bytes, never Forvo), HTTPS allowlist, no remote
 * HTML execution (textContent-only rendering), query-only data sent
 * (no account/progress data), local results preserved on total remote failure.
 *
 * Classic script (repo convention): no modules, no framework. Attaches to
 * window.DMSearch and progressively enhances runGlobalSearch WITHOUT editing
 * script.js (monkey-patch wrapper, search-region-only updates, no renderAll).
 */
(function (root) {
  "use strict";

  /* ================= metadata + policy ================= */
  var ALLOW_HOSTS = [
    "de.wiktionary.org",
    "en.wiktionary.org",
    "api.tatoeba.org",
    "tatoeba.org",
    "commons.wikimedia.org",
    "upload.wikimedia.org",
    "www.openthesaurus.de",
    "api.mymemory.translated.net"
  ];
  var TIMEOUT_MS = 8000;
  var CACHE_TTL = 10 * 60 * 1000;
  var CACHE_MAX = 120;

  var PROVIDERS = [
    { id: "local", name: "Deutsch Master", home: "https://mosab1555.github.io/deutsch-master2/",
      docs: "", caps: ["words", "sentences", "offline"], needsKey: false },
    { id: "wiktionary", name: "Wiktionary (DE)", home: "https://de.wiktionary.org/",
      docs: "https://www.mediawiki.org/wiki/API:Main_page",
      caps: ["definitions", "grammar", "examples-de"], needsKey: false },
    { id: "wiktionary-en", name: "Wiktionary (EN)", home: "https://en.wiktionary.org/",
      docs: "https://www.mediawiki.org/wiki/API:Main_page",
      caps: ["definitions", "grammar", "examples-de"], needsKey: false },
    { id: "tatoeba", name: "Tatoeba", home: "https://tatoeba.org/",
      docs: "https://api.tatoeba.org/",
      caps: ["sentences", "translations", "audio"], needsKey: false },
    { id: "commons", name: "Wikimedia Commons", home: "https://commons.wikimedia.org/",
      docs: "https://www.mediawiki.org/wiki/API:Main_page",
      caps: ["audio"], needsKey: false },
    { id: "openthesaurus", name: "OpenThesaurus", home: "https://www.openthesaurus.de/",
      docs: "https://www.openthesaurus.de/about/api",
      caps: ["synonyms"], needsKey: false },
    { id: "mymemory", name: "MyMemory (MT)", home: "https://mymemory.translated.net/",
      docs: "https://mymemory.translated.net/doc/spec.php",
      caps: ["mt-ar"], needsKey: false },
    { id: "forvo", name: "Forvo (optional)", home: "https://forvo.com/",
      docs: "https://api.forvo.com/documentation/general-information/",
      caps: ["audio"], needsKey: true }
  ];

  /* ================= tiny utils (no DOM at load) ================= */
  function sstr(x) { return String(x == null ? "" : x); }
  function normQ(q) { return sstr(q).replace(/\s+/g, " ").trim().slice(0, 200); }
  function foldDe(s) {
    try {
      if (typeof root.dmNorm === "function") return root.dmNorm(s);
    } catch (e) {}
    return sstr(s).trim().toLowerCase()
      .replace(/\u00df/g, "ss").replace(/\u00e4/g, "a").replace(/\u00f6/g, "o").replace(/\u00fc/g, "u");
  }
  function normSent(s) {
    return foldDe(s).replace(/[¡¿.?…،؛:,.()"«»„“”'']/g, "").replace(/\s+/g, " ").trim();
  }
  /* Sentence-query normalization for external search (letters preserved,
   * incl. ä ö ü ß — only punctuation/whitespace is touched). The full
   * normalized phrase is always tried first; keywords only on empty. */
  var TAT_PUNCT_RE = /[.?!\u2026\u00a1\u00bf\u060c\u061f\u061b;:,()"\u00ab\u00bb\u201e\u201c\u201d''\[\]{}\u2014\u2013\-/\\|@#*+=<>~^$%&_]/g;
  function normTatPhrase(q) {
    return sstr(q).replace(TAT_PUNCT_RE, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  }
  function stripFolded(f) {
    return sstr(f).replace(/[.?…¡¿،؛:,.()"«»„“”'']/g, "").replace(/\s+/g, " ").trim();
  }
  /* German stopwords + particles with (almost) no sentence discrimination.
   * Kept minimal and stable: content words (e.g. "Kaffee") always survive. */
  /* Base list in natural German spelling. Lookup covers every umlaut
   * folding (raw ae/oe/ue + single-char a/o/u + ss), so the filter behaves
   * identically whether root.dmNorm folds "moechte" or "mochte". */
  var TAT_STOP_WORDS = ("ich du er sie es wir ihr der die das den dem des "
    + "ein eine einer einen einem eines und oder aber denn doch nur auch sehr "
    + "bitte mal ja nein nicht kein keine keiner keinen mein meine dein deine "
    + "sein seine ihre unser unsere ist sind war waren bin bist habe haben hat "
    + "hast hatte moechte moechten will willst wollen kann kannst koennen muss "
    + "musst muessen soll sollst sollen darf darfst duerfen mag magst moegen "
    + "werde werden wird wuerde wuerden haette haetten zu zum zur im in am an "
    + "ans auf aus bei mit nach von vom fuer um durch ueber unter vor hinter "
    + "neben zwischen als wie was wer wen wem wo wohin woher wann warum "
    + "weshalb welcher welche welches diesen diese dieser dieses jeden jede "
    + "jeder jedes allen alle aller alles man etwas nichts wieder schon noch "
    + "da dort hier heute morgen gern gerne einmal").split(" ");
  var TAT_STOP = {};
  (function () {
    function foldA(w) {
      return w.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
    }
    for (var i = 0; i < TAT_STOP_WORDS.length; i++) {
      var w = TAT_STOP_WORDS[i];
      TAT_STOP[w] = 1;
      try { TAT_STOP[foldA(w)] = 1; } catch (e) {}
    }
  })();
  /* Meaningful fallback phrases for an empty full-phrase result: content
   * terms joined (max 3), then the single longest term. Never returns the
   * full phrase itself or duplicates (no duplicate requests). */
  function tatFallbackPhrases(q, fullPhrase) {
    var out = [];
    try {
      var words = sstr(fullPhrase).split(" ").filter(Boolean);
      var terms = [];
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (w.length < 3) continue;
        if (!/[a-zäöüß]/i.test(w)) continue;
        var wl = null;
        try { wl = foldDe(w); } catch (e) { wl = w.toLowerCase(); }
        if (TAT_STOP[wl]) continue;
        terms.push(w);
      }
      var fullFold = null;
      try { fullFold = foldDe(fullPhrase); } catch (e) { fullFold = fullPhrase; }
      var seen = {};
      try { seen[fullFold] = 1; } catch (e) {}
      function fresh(ph) {
        if (!ph) return false;
        var k = null;
        try { k = foldDe(ph); } catch (e) { k = ph; }
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      }
      var joined = terms.slice(0, 3).join(" ");
      if (terms.length && fresh(joined)) out.push(joined);
      if (terms.length > 1) {
        var longest = terms.slice().sort(function (a, b) { return b.length - a.length; })[0];
        if (longest && fresh(longest)) out.push(longest);
      }
    } catch (e) {}
    return out.slice(0, 2);
  }
  function isSentenceQuery(q) {
    var t = normQ(q);
    if (!t) return false;
    if (/[.?!…]/.test(t)) return true;
    if (/\s/.test(t) && t.split(" ").length >= 3) return true;
    return t.length > 42;
  }
  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ""; }
  }
  function allowedUrl(url) {
    var h = hostOf(url);
    if (!h) return false;
    for (var i = 0; i < ALLOW_HOSTS.length; i++) {
      if (h === ALLOW_HOSTS[i] || h.slice(-ALLOW_HOSTS[i].length - 1) === "." + ALLOW_HOSTS[i]) return true;
    }
    return false;
  }
  function escRe(s) { return sstr(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function stripTags(s) { return sstr(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim(); }

  /* fetch indirection (stubbed in tests via __setFetch) */
  var httpFetch = null;
  try { httpFetch = (root && typeof root.fetch === "function") ? root.fetch.bind(root) : null; } catch (e) {}
  function __setFetch(fn) { httpFetch = fn; }

  /* Outer-signal aware fetch: outerSignal aborts as "aborted" (intentional
   * cancellation), timeout aborts as "timeout". No AbortSignal.any/timeout
   * helpers: feature-detected addEventListener only, compatible fallback. */
  function fetchJson(url, timeoutMs, outerSignal) {
    if (!allowedUrl(url)) return Promise.resolve({ ok: false, error: "blocked-host" });
    if (!httpFetch) return Promise.resolve({ ok: false, error: "no-fetch" });
    try {
      if (outerSignal && outerSignal.aborted) return Promise.resolve({ ok: false, error: "aborted" });
    } catch (e) {}
    var ctrl = null, timer = 0;
    try {
      if (typeof root.AbortController === "function") ctrl = new root.AbortController();
    } catch (e) { ctrl = null; }
    var opts = { method: "GET", credentials: "omit", redirect: "follow" };
    if (ctrl) { opts.signal = ctrl.signal; }
    else if (outerSignal) { opts.signal = outerSignal; }
    var ms = timeoutMs || TIMEOUT_MS;
    var outerAborted = false, timedOut = false;
    var detachOuter = null;
    if (ctrl && outerSignal) {
      try {
        if (outerSignal.aborted) {
          outerAborted = true;
          try { ctrl.abort(); } catch (e) {}
        } else if (typeof outerSignal.addEventListener === "function") {
          var onAbort = function () { outerAborted = true; try { ctrl.abort(); } catch (e) {} };
          try { outerSignal.addEventListener("abort", onAbort, { once: true }); } catch (e2) {
            try { outerSignal.addEventListener("abort", onAbort); } catch (e3) {}
          }
          detachOuter = function () {
            try {
              if (typeof outerSignal.removeEventListener === "function") outerSignal.removeEventListener("abort", onAbort);
            } catch (e) {}
          };
        } else if ("onabort" in outerSignal) {
          try {
            var prev = outerSignal.onabort;
            outerSignal.onabort = function (ev) { outerAborted = true; try { ctrl.abort(); } catch (e) {} try { if (typeof prev === "function") prev.call(outerSignal, ev); } catch (e2) {} };
          } catch (e) {}
        }
      } catch (e) {}
    }
    var p = null;
    try {
      p = httpFetch(url, opts).then(function (res) {
        try { if (timer) clearTimeout(timer); } catch (e) {}
        try { if (detachOuter) detachOuter(); } catch (e) {}
        if (!res || typeof res.json !== "function") return { ok: false, error: "http-bad-response" };
        if (res.status === 429) return { ok: false, error: "rate-limited" };
        if (res.status < 200 || res.status >= 300) return { ok: false, error: "http-" + res.status };
        return res.json().then(
          function (j) { return { ok: true, data: j }; },
          function () { return { ok: false, error: "bad-json" }; });
      }, function (err) {
        try { if (timer) clearTimeout(timer); } catch (e) {}
        try { if (detachOuter) detachOuter(); } catch (e) {}
        var n = ""; try { n = err && err.name; } catch (e2) {}
        if (n === "AbortError") {
          try { if (outerSignal && outerSignal.aborted) return { ok: false, error: "aborted" }; } catch (e3) {}
          if (outerAborted) return { ok: false, error: "aborted" };
          if (timedOut) return { ok: false, error: "timeout" };
          return { ok: false, error: "timeout" };
        }
        try {
          if (outerSignal && outerSignal.aborted) return { ok: false, error: "aborted" };
        } catch (e3) {}
        if (outerAborted) return { ok: false, error: "aborted" };
        if (typeof root !== "undefined" && root.navigator && root.navigator.onLine === false) {
          return { ok: false, error: "offline" };
        }
        return { ok: false, error: "network" };
      });
    } catch (e) { return Promise.resolve({ ok: false, error: "network" }); }
    if (ctrl) {
      try {
        timer = setTimeout(function () { timedOut = true; try { ctrl.abort(); } catch (e) {} }, ms);
      } catch (e) {}
    }
    /* Hard timeout race: if fetch never settles AND abort is unsupported. */
    var kill = new Promise(function (res) {
      setTimeout(function () {
        var abortedNow = false;
        try { abortedNow = !!(outerSignal && outerSignal.aborted) || outerAborted; } catch (e) {}
        res({ ok: false, error: abortedNow ? "aborted" : "timeout" });
      }, ms + 1500);
    });
    return Promise.race([p, kill]).then(function (r) {
      try { if (timer) clearTimeout(timer); } catch (e) {}
      try { if (detachOuter) detachOuter(); } catch (e) {}
      return r;
    });
  }

  /* bounded text-only cache + in-flight dedup */
  var memCache = new Map();
  var inflight = new Map();
  function cacheGet(k) {
    var e = memCache.get(k);
    if (!e) return null;
    try { if (Date.now() - e.t > CACHE_TTL) { memCache.delete(k); return null; } } catch (x) { return null; }
    return e.v;
  }
  function cacheSet(k, v) {
    try {
      if (memCache.size >= CACHE_MAX) {
        var first = memCache.keys().next();
        if (first && !first.done) memCache.delete(first.value);
      }
      memCache.set(k, { t: Date.now(), v: v });
    } catch (e) {}
  }
  function cachedFetch(pid, query, worker, outerSignal) {
    var k = pid + "|||" + query;
    var hit = cacheGet(k);
    if (hit) return Promise.resolve(hit);
    /* Shared ownership: a deduplicated in-flight request is owned by its
     * first creator. Later consumers attach without aborting it, so aborting
     * one generation never kills a request another active generation needs.
     * Only exclusive (newly created) requests receive the outer signal. */
    if (inflight.has(k)) return inflight.get(k);
    var p = Promise.resolve().then(function () { return worker(outerSignal); }).then(function (r) {
      try { inflight.delete(k); } catch (e) {}
      if (r && (r.status === "ok" || r.status === "empty")) cacheSet(k, r);
      return r;
    }, function () {
      try { inflight.delete(k); } catch (e) {}
      return { status: "error", provider: pid, error: "exception" };
    });
    try { inflight.set(k, p); } catch (e) {}
    return p;
  }

  /* ================= provider: local ================= */
  function localSearch(query) {
    var q = normQ(query);
    var out = { status: "ok", provider: "local", words: [], sentences: [], verbs: [], grammar: [] };
    if (!q) { out.status = "empty"; return Promise.resolve(out); }
    try {
      var qn = foldDe(q);
      if (typeof root.dmWordHits === "function") {
        var lvl = (root.gsLevel && root.gsLevel !== "mixed") ? root.gsLevel : "mixed";
        var hits = [];
        try { hits = root.dmWordHits(qn, lvl) || []; } catch (e) { hits = []; }
        out.words = hits.slice(0, 8).map(function (h) {
          var w = h.w || {};
          return { id: w.id || "", de: sstr(w.de), art: sstr(w.art || "-"), ar: sstr(w.ar || ""),
            en: sstr(w.en || ""), plural: sstr(w.plural || ""), pron: sstr(w.pron || ""),
            level: sstr(w.level || ""), kap: sstr(w.kap || ""), via: sstr(h.via || ""), match: (h.score === 0 ? "exact" : "similar") };
        });
      }
    } catch (e) {}
    try {
      if (typeof root.sentA1SearchRows === "function") {
        var rows = root.sentA1SearchRows() || [];
        var ql = foldDe(q), qn = normSent(q), out2 = [];
        for (var i = 0; i < rows.length && out2.length < 4; i++) {
          try {
            var r = rows[i];
            if (!r || !r.nde || !r.s) continue;
            /* Literal hit first (cheap); punctuation-stripped hit second so
             * "Kaffee, bitte." still matches "Kaffee bitte". */
            if (r.nde.indexOf(ql) >= 0 ||
                (qn && qn !== ql && stripFolded(r.nde).indexOf(qn) >= 0)) {
              out2.push({ de: sstr(r.s.de), ar: sstr(r.s.ar || ""), kap: sstr(r.s.kap || "") });
            }
          } catch (e2) {}
        }
        if (out2.length) out.sentences = out2;
      }
      if (!out.sentences.length && root.SENTENCES && root.SENTENCES.length) {
        var qx = foldDe(q), qnx = normSent(q), tmp = [];
        for (var j = 0; j < root.SENTENCES.length && tmp.length < 4; j++) {
          try {
            var s = root.SENTENCES[j];
            if (!s) continue;
            var hay = foldDe(sstr(s.de) + " " + sstr(s.ar));
            if (hay.indexOf(qx) >= 0 ||
                (qnx && qnx !== qx && stripFolded(hay).indexOf(qnx) >= 0)) {
              tmp.push({ de: sstr(s.de), ar: sstr(s.ar || ""), kap: sstr(s.kap || "") });
            }
          } catch (e3) {}
        }
        out.sentences = tmp;
      }
    } catch (e) {}
    if (!out.words.length && !out.sentences.length && !out.verbs.length && !out.grammar.length) out.status = "empty";
    return Promise.resolve(out);
  }

  /* ================= provider: Wiktionary ================= */
  var WIK = "https://de.wiktionary.org/w/api.php";
  function wikParsePlain(title, text) {
    var t = sstr(text);
    var res = { title: title, url: "https://de.wiktionary.org/wiki/" + encodeURIComponent(title),
      senses: [], examples: [], grammar: { pos: "", gender: "", plural: "", ipa: "" } };
    if (!t) return res;
    var m = t.match(/IPA:\s*\[([^\]\n]{1,80})\]/);
    if (m) res.grammar.ipa = m[1].trim();
    var pl = t.match(/Plural:\s*([^\n]{1,80})/);
    if (pl) res.grammar.plural = pl[1].replace(/\s+/g, " ").trim().slice(0, 80);
    var pos = t.match(/^(Substantiv|Verb|Adjektiv|Adverb|Pronomen|Präposition|Konjunktion|Artikel|Numerale|Interjektion|Phrase|Redewendung|Sprichwort|Deklinierte Form|Konjugierte Form)\b/m);
    if (pos) res.grammar.pos = pos[1];
    var g = t.match(/^Substantiv,\s*([mnf])\b/m);
    if (g) res.grammar.gender = g[1] === "m" ? "der" : (g[1] === "f" ? "die" : "das");
    function section(name) {
      var lines = t.split("\n");
      var cap = [], on = false;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!on) { if (ln === name || ln.replace(/:$/, "") === name.replace(/:$/, "")) on = true; continue; }
        if (!ln) continue;
        if (/^[A-ZÄÖÜ][^[\]]{0,40}:$/.test(ln) && ln.indexOf("[") < 0) break; /* next section header */
        if (/^\[\d+[^\]]*\]/.test(ln)) cap.push(ln);
        else if (cap.length && cap.length < 10 && ln.length < 240 && /[.!?]$/.test(ln) === false && ln.length > 0) {
          /* continuation lines are ignored; stop at prose */
        }
        if (cap.length >= 10) break;
      }
      return cap;
    }
    var sens = section("Bedeutungen:");
    for (var k = 0; k < sens.length && res.senses.length < 8; k++) {
      var mm = sens[k].match(/^\[([^\]]+)\]\s*(.+)$/);
      if (mm) res.senses.push({ n: mm[1].slice(0, 12), text: mm[2].trim().slice(0, 220) });
    }
    var exs = section("Beispiele:");
    for (var e2 = 0; e2 < exs.length && res.examples.length < 3; e2++) {
      var me = exs[e2].match(/^\[[^\]]+\]\s*(.+)$/);
      if (me) res.examples.push(me[1].replace(/[“”„"«»]/g, "").trim().slice(0, 200));
    }
    return res;
  }
  function wiktionarySearch(query, outerSignal) {
    var q = normQ(query);
    if (!q || /\s{2,}/.test(q) === false && q.split(" ").length > 6) {
      /* long phrases: still try, MediaWiki handles them; no special-casing */
    }
    if (!q) return Promise.resolve({ status: "empty", provider: "wiktionary" });
    return cachedFetch("wiktionary", q, function (sig) {
      var s = sig || outerSignal;
      var u1 = WIK + "?action=query&list=search&srsearch=" + encodeURIComponent(q) +
        "&srlimit=5&srnamespace=0&format=json&origin=*";
      return fetchJson(u1, undefined, s).then(function (r1) {
        if (!r1.ok) {
          if (r1.error === "aborted") return { status: "aborted", provider: "wiktionary" };
          return { status: "error", provider: "wiktionary", error: r1.error };
        }
        var hits = [];
        try { hits = (((r1.data || {}).query || {}).search) || []; } catch (e) { hits = []; }
        if (!hits.length) return { status: "empty", provider: "wiktionary" };
        var exact = null, i;
        for (i = 0; i < hits.length; i++) {
          if (foldDe(hits[i].title) === foldDe(q)) { exact = hits[i].title; break; }
        }
        var title = exact || hits[0].title;
        var u2 = WIK + "?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=" +
          encodeURIComponent(title) + "&format=json&origin=*";
        return fetchJson(u2, undefined, s).then(function (r2) {
          if (!r2.ok) {
            if (r2.error === "aborted") return { status: "aborted", provider: "wiktionary" };
            return { status: "error", provider: "wiktionary", error: r2.error };
          }
          var pages = {};
          try { pages = ((r2.data || {}).query || {}).pages || {}; } catch (e) {}
          var keys = Object.keys(pages);
          if (!keys.length || pages[keys[0]].missing !== undefined) {
            return { status: "empty", provider: "wiktionary" };
          }
          var pg = pages[keys[0]];
          var parsed = wikParsePlain(pg.title || title, pg.extract || "");
          if (!parsed.senses.length && !parsed.grammar.ipa && !parsed.grammar.plural && !parsed.examples.length) {
            return { status: "empty", provider: "wiktionary", title: parsed.title, url: parsed.url };
          }
          parsed.status = "ok"; parsed.provider = "wiktionary";
          parsed.match = exact ? "exact" : "similar";
          parsed.license = "CC BY-SA";
          return parsed;
        });
      });
    }, outerSignal);
  }

  /* ============ provider: Wiktionary EN fallback (honest 2nd edition) ============
   * Independent public MediaWiki edition, CORS *, no key, CC BY-SA.
   * Only called when DE primary has no usable definition. Own provider ID,
   * own attribution, normalized shape. Never scrapes; links are official. */
  var WIKEN = "https://en.wiktionary.org/w/api.php";
  function wikEnParseGerman(title, text) {
    var t = sstr(text);
    var res = { title: title, url: "https://en.wiktionary.org/wiki/" + encodeURIComponent(title),
      senses: [], examples: [], grammar: { pos: "", gender: "", plural: "", ipa: "" } };
    if (!t) return res;
    try {
      var gi = t.indexOf("\nGerman\n");
      if (gi >= 0) t = t.slice(gi);
    } catch (e) {}
    var m = t.match(/IPA[^:\n]*:\s*(\[[^\]\n]{1,80}\]|\/[^\n/]{1,80}\/)/);
    if (m) res.grammar.ipa = m[1].trim().replace(/^[\[/]+|[\]/]+$/g, "").slice(0, 80);
    var noun = t.match(/^Noun\n/m);
    if (noun) res.grammar.pos = "Noun";
    else {
      var pos2 = t.match(/^(Verb|Adjective|Adverb|Pronoun|Preposition|Conjunction|Article|Numeral|Interjection|Phrase|Proverb)\n/m);
      if (pos2) res.grammar.pos = pos2[1];
    }
    var g = t.match(/\b([mnf])\s*\(.*plural|^(Haus)\s+[mnf]\b/m);
    /* EN edition rarely marks gender cleanly; keep empty unless explicit. */
    var lines = t.split("\n");
    var inDe = false, capN = 0;
    for (var i = 0; i < lines.length && res.senses.length < 6; i++) {
      var ln = lines[i].trim();
      if (!inDe) { if (/^German$/.test(ln)) inDe = true; continue; }
      if (/^[A-Z][A-Za-z ]{0,30}$/.test(ln) && /English|Bavarian|Central Franconian|Hunsrik|Dutch|German$/.test(ln) === false) {
        /* section boundary inside German block (Etymology/Pronunciation/Noun): keep scanning */
      }
      if (/^[a-z]/.test(ln) === false && ln.length > 60) continue;
      /* Gloss lines in EN extracts are short lowercase definitions. */
      if (ln && ln.length >= 3 && ln.length <= 160 && /^[a-z]/.test(ln) &&
          ln.indexOf("From ") !== 0 && ln.indexOf("IPA") !== 0 && ln.indexOf("Rhymes") !== 0 &&
          ln.indexOf("“") !== 0 && res.senses.length < 6) {
        if (/house|building|home|theatre|municipality/i.test(ln) || capN > 0 || res.senses.length === 0) {
          res.senses.push({ n: String(res.senses.length + 1), text: ln.slice(0, 220) });
          capN++;
        }
      }
      if (/^[A-Z][a-z]+$/.test(ln) && i > 10 && res.senses.length >= 2) break;
    }
    /* Fallback: harvest German example sentences with translation dash. */
    for (var j = 0; j < lines.length && res.examples.length < 2; j++) {
      var l2 = lines[j].trim();
      if (l2.length > 12 && l2.length < 200 && /[.!?]$/.test(l2) && / — | – | - /.test(l2) &&
          /[äöüÄÖÜß]/.test(l2)) {
        res.examples.push(l2.slice(0, 200));
      }
    }
    return res;
  }
  function wiktionaryEnSearch(query, outerSignal) {
    var q = normQ(query);
    if (!q || /\s/.test(q) || q.length > 40) return Promise.resolve({ status: "empty", provider: "wiktionary-en" });
    return cachedFetch("wiktionary-en", q, function (sig) {
      var s = sig || outerSignal;
      var u1 = WIKEN + "?action=query&list=search&srsearch=" + encodeURIComponent(q) +
        "&srlimit=5&srnamespace=0&format=json&origin=*";
      return fetchJson(u1, undefined, s).then(function (r1) {
        if (!r1.ok) {
          if (r1.error === "aborted") return { status: "aborted", provider: "wiktionary-en" };
          return { status: "error", provider: "wiktionary-en", error: r1.error };
        }
        var hits = [];
        try { hits = (((r1.data || {}).query || {}).search) || []; } catch (e) { hits = []; }
        if (!hits.length) return { status: "empty", provider: "wiktionary-en" };
        var exact = null, i;
        for (i = 0; i < hits.length; i++) {
          if (foldDe(hits[i].title) === foldDe(q)) { exact = hits[i].title; break; }
        }
        var title = exact || hits[0].title;
        var u2 = WIKEN + "?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=" +
          encodeURIComponent(title) + "&format=json&origin=*";
        return fetchJson(u2, undefined, s).then(function (r2) {
          if (!r2.ok) {
            if (r2.error === "aborted") return { status: "aborted", provider: "wiktionary-en" };
            return { status: "error", provider: "wiktionary-en", error: r2.error };
          }
          var pages = {};
          try { pages = ((r2.data || {}).query || {}).pages || {}; } catch (e) {}
          var keys = Object.keys(pages);
          if (!keys.length || pages[keys[0]].missing !== undefined) {
            return { status: "empty", provider: "wiktionary-en" };
          }
          var pg = pages[keys[0]];
          var parsed = wikEnParseGerman(pg.title || title, pg.extract || "");
          if (!parsed.senses.length && !parsed.grammar.ipa && !parsed.examples.length) {
            return { status: "empty", provider: "wiktionary-en", title: parsed.title, url: parsed.url };
          }
          parsed.status = "ok"; parsed.provider = "wiktionary-en";
          parsed.match = exact ? "exact" : "similar";
          parsed.license = "CC BY-SA";
          parsed.edition = "en";
          return parsed;
        });
      });
    }, outerSignal);
  }
  function dictFallbackLinks(q) {
    var e = encodeURIComponent(normQ(q));
    return [
      { name: "Duden", url: "https://www.duden.de/suchen/dudenonline/" + e },
      { name: "DWDS", url: "https://www.dwds.de/wb/" + e },
      { name: "LEO", url: "https://dict.leo.org/german-english/" + e }
    ];
  }

  /* ================= provider: Tatoeba =================
   * Audio policy (per official spec https://api.tatoeba.org/openapi.json +
   * FAQ https://en.wiki.tatoeba.org/articles/show/faq):
   * - Sentence-search returns per-recording Audio objects: id, author,
   *   licence/license (spec spells "licence", live returns "license";
   *   both accepted), attribution_url, download_url.
   * - Text license (CC BY 2.0 FR) NEVER covers its audio. Each recording
   *   needs its own author + license + attribution URL.
   * - GET /v1/audios/{id}/file 403 = author disallows reuse outside
   *   Tatoeba -> unavailable for embedding, no bypass via alt URL.
   *   404 = removed/missing -> unavailable. Never download/cache bytes;
   *   only embed via <audio src>, cross-origin (SW never caches it).
   * - If license/attribution cannot be determined (e.g. license "" as seen
   *   on legacy BraveSentry recordings which 403), do NOT embed. Keep the
   *   sentence text (its own CC BY 2.0 FR allows display with attribution).
   * - Eligible embed shows contributor + license + attribution link.
   *   Otherwise Commons human audio, else German TTS fallback. */
  var TAT = "https://api.tatoeba.org/v1/sentences";
  function tatoebaAudioPolicy(a) {
    var r = { eligible: false, reason: "unknown", author: "", license: "", attributionUrl: "", id: 0, url: "" };
    try {
      if (!a || a.id === undefined || a.id === null) { r.reason = "removed"; return r; }
      var id = a.id;
      r.id = id;
      r.url = "https://api.tatoeba.org/v1/audios/" + id + "/file";
      var author = sstr(a.author || "").trim().slice(0, 60);
      /* Spec: "licence"; live: "license". Accept both, never invent. */
      var lic = "";
      try {
        if (a.license !== undefined && a.license !== null) lic = sstr(a.license);
        else if (a.licence !== undefined && a.licence !== null) lic = sstr(a.licence);
      } catch (e) {}
      lic = lic.trim().slice(0, 60);
      var attr = sstr(a.attribution_url || a.attributionUrl || "").trim().slice(0, 300);
      if (!attr && author) attr = "https://tatoeba.org/user/profile/" + encodeURIComponent(author);
      r.author = author;
      r.license = lic;
      r.attributionUrl = attr;
      if (!lic) { r.reason = "unknown-license"; return r; }
      if (!author) { r.reason = "unknown-author"; return r; }
      r.eligible = true;
      r.reason = "eligible";
      return r;
    } catch (e) { r.reason = "unknown"; return r; }
  }
  function tatoebaSearch(query, outerSignal) {
    var q = normQ(query);
    if (!q) return Promise.resolve({ status: "empty", provider: "tatoeba" });
    return cachedFetch("tatoeba", q, function (sig) {
      var s = sig || outerSignal;
      function abortedNow() {
        try { return !!(s && s.aborted); } catch (e) { return false; }
      }
      function tatFetch(phrase) {
        var u = TAT + "?lang=deu&q=" + encodeURIComponent(phrase) +
          "&limit=6&sort=relevance&showtrans=all&include=audios";
        return fetchJson(u, undefined, s);
      }
      /* Match labels always use the ORIGINAL query: a fallback hit can only
       * ever be "similar", never "exact". Nothing is fabricated: item text
       * and translations are passed through verbatim as text. */
      function tatItems(arr, qn) {
        return arr.slice(0, 6).map(function (s) {
          var txt = sstr(s.text);
          var trs = [];
          try { trs = s.translations || []; } catch (e) {}
          var ara = [], eng = [];
          for (var i = 0; i < trs.length; i++) {
            var tr = trs[i] || {};
            if (tr.lang === "ara" && ara.length < 3) ara.push({ id: tr.id, text: sstr(tr.text), owner: sstr(tr.owner || "") });
            else if (tr.lang === "eng" && eng.length < 2) eng.push({ id: tr.id, text: sstr(tr.text), owner: sstr(tr.owner || "") });
          }
          var aud = [];
          try {
            (s.audios || []).slice(0, 2).forEach(function (a) {
              if (!a || a.id === undefined || a.id === null) return;
              var pol = tatoebaAudioPolicy(a);
              aud.push({ id: pol.id, url: pol.url, author: pol.author, license: pol.license,
                attributionUrl: pol.attributionUrl, eligible: pol.eligible, reason: pol.reason });
            });
          } catch (e) {}
          return { id: s.id, text: txt, match: (normSent(txt) === qn && qn ? "exact" : "similar"),
            owner: sstr(s.owner || ""), license: sstr(s.license || ""),
            url: "https://tatoeba.org/en/sentences/show/" + s.id,
            ara: ara, eng: eng, audio: aud };
        });
      }
      /* Full normalized phrase first (punctuation stripped, ä ö ü ß kept). */
      var fullPhrase = normTatPhrase(q) || q;
      return tatFetch(fullPhrase).then(function (r) {
        if (!r.ok) {
          if (r.error === "aborted") return { status: "aborted", provider: "tatoeba" };
          return { status: "error", provider: "tatoeba", error: r.error };
        }
        var arr = [];
        try { arr = r.data.data || []; } catch (e) { arr = []; }
        var qn = normSent(q);
        if (arr.length) {
          return { status: "ok", provider: "tatoeba", items: tatItems(arr, qn), fallback: false };
        }
        /* Technically fine but zero matches: keyword fallback. Never after
         * cancellation or when a newer query already superseded this one
         * (both surface as an aborted outer signal). */
        if (abortedNow()) return { status: "aborted", provider: "tatoeba" };
        var cands = tatFallbackPhrases(q, fullPhrase);
        if (!cands.length) return { status: "empty", provider: "tatoeba", fallback: false };
        if (abortedNow()) return { status: "aborted", provider: "tatoeba" };
        var jobs = cands.map(function (ph) {
          return tatFetch(ph).then(function (r2) {
            if (!r2.ok) return { error: r2.error, arr: [] };
            var a2 = [];
            try { a2 = r2.data.data || []; } catch (e) { a2 = []; }
            return { error: null, arr: a2 };
          }, function () { return { error: "exception", arr: [] }; });
        });
        return Promise.all(jobs).then(function (outs) {
          if (abortedNow()) return { status: "aborted", provider: "tatoeba" };
          var seen = {}, merged = [];
          outs.forEach(function (o) {
            (o.arr || []).forEach(function (it) {
              var id = it && it.id;
              if (id === undefined || id === null || seen[id]) return;
              seen[id] = 1;
              merged.push(it);
            });
          });
          if (!merged.length) {
            var anyAbort = outs.some(function (o) { return o.error === "aborted"; });
            if (anyAbort) return { status: "aborted", provider: "tatoeba" };
            var errs = outs.filter(function (o) { return !!o.error; });
            /* No match anywhere, but every fallback failed: report the
             * failure honestly instead of a quiet "no match". */
            if (errs.length && errs.length === outs.length) {
              return { status: "error", provider: "tatoeba", error: errs[0].error };
            }
            return { status: "empty", provider: "tatoeba", fallback: true };
          }
          return { status: "ok", provider: "tatoeba", items: tatItems(merged.slice(0, 6), qn), fallback: true };
        });
      });
    }, outerSignal);
  }

  /* ================= provider: Commons ================= */
  var COM = "https://commons.wikimedia.org/w/api.php";
  var AUDIO_EXT = /\.(ogg|oga|wav|mp3|flac|weba|webm)$/i;
  function commonsCandidate(title, word) {
    var t = sstr(title);
    if (!/^File:/i.test(t)) return false;
    if (!AUDIO_EXT.test(t)) return false;
    var body = t.replace(/^File:/i, "").replace(/\.(ogg|oga|wav|mp3|flac|weba|webm)$/i, "");
    /* Strict: "De-<word>" + (end | digit version | parenthetical | dot).
       A hyphenated compound (De-Haus-Boot), an underscore phrase
       (De-Haus_Habsburg) and a free phrase (De-Haus des Meeres) are DIFFERENT
       terms and are rejected. Numbered takes (De-Haus2) are kept. */
    var re = new RegExp("^De-" + escRe(word) + "($|[0-9(.])", "i");
    if (re.test(body)) return true;
    var ll = new RegExp("^LL-Q188 \\(deu\\)-.*-" + escRe(word) + "\\s*$", "i");
    if (ll.test(body)) return true;
    return false;
  }
  function commonsSearch(query, outerSignal) {
    var q = normQ(query);
    if (!q || /\s/.test(q) || q.length > 40) {
      /* Pronunciation files are per-word; sentences use TTS fallback. */
      return Promise.resolve({ status: "empty", provider: "commons" });
    }
    return cachedFetch("commons", q, function (sig) {
      var s = sig || outerSignal;
      /* allimages+aiprefix = deterministic filename-prefix lookup (one call
         carries url + license metadata). list=search is NOT used: CirrusSearch
         full-text does not honour the "File:De-<word>" prefix. */
      var u = COM + "?action=query&list=allimages&aiprefix=" + encodeURIComponent("De-" + q) +
        "&ailimit=8&aiprop=url%7Cextmetadata&format=json&origin=*";
      return fetchJson(u, undefined, s).then(function (r) {
        if (!r.ok) {
          if (r.error === "aborted") return { status: "aborted", provider: "commons" };
          return { status: "error", provider: "commons", error: r.error };
        }
        var arr = [];
        try { arr = (((r.data || {}).query || {}).allimages) || []; } catch (e) {}
        var scored = [];
        for (var i = 0; i < arr.length; i++) {
          var im = arr[i] || {};
          var title = im.title || ("File:" + (im.name || ""));
          if (!commonsCandidate(title, q)) continue;
          var base = sstr(im.name || "").toLowerCase();
          var exact = (base === ("de-" + q.toLowerCase() + ".ogg") ||
            base.replace(/\.[^.]+$/, "") === ("de-" + q.toLowerCase()));
          var md = im.extmetadata || {};
          var artist = "", lic = "";
          try { artist = stripTags((md.Artist || {}).value || "").slice(0, 80); } catch (e) {}
          try { lic = stripTags((md.LicenseShortName || {}).value || (md.UsageTerms || {}).value || "").slice(0, 60); } catch (e) {}
          /* allimages already returns the direct upload URL. */
          scored.push({ exact: exact, item: { title: title, url: sstr(im.url || ""),
            pageUrl: sstr(im.descriptionurl || ("https://commons.wikimedia.org/wiki/" + encodeURIComponent(title))),
            artist: artist, license: lic || "see Commons page" } });
        }
        scored.sort(function (a, b) { return (b.exact ? 1 : 0) - (a.exact ? 1 : 0); });
        var items = scored.filter(function (s) { return !!s.item.url; }).slice(0, 3).map(function (s) { return s.item; });
        if (!items.length) return { status: "empty", provider: "commons" };
        return { status: "ok", provider: "commons", items: items };
      });
    }, outerSignal);
  }

  /* ================= provider: OpenThesaurus ================= */
  function openthesaurusSearch(query, outerSignal) {
    var q = normQ(query);
    if (!q || /\s/.test(q) || q.length > 40) return Promise.resolve({ status: "empty", provider: "openthesaurus" });
    return cachedFetch("openthesaurus", q, function (sig) {
      var s = sig || outerSignal;
      var u = "https://www.openthesaurus.de/synonyme/search?q=" + encodeURIComponent(q) + "&format=application/json";
      return fetchJson(u, undefined, s).then(function (r) {
        if (!r.ok) {
          if (r.error === "aborted") return { status: "aborted", provider: "openthesaurus" };
          return { status: "error", provider: "openthesaurus", error: r.error };
        }
        var sets = [];
        try { sets = r.data.synsets || []; } catch (e) {}
        if (!sets.length) return { status: "empty", provider: "openthesaurus" };
        var terms = [], seen = {};
        for (var i = 0; i < sets.length && terms.length < 12; i++) {
          var arr = [];
          try { arr = sets[i].terms || []; } catch (e) {}
          for (var j = 0; j < arr.length && terms.length < 12; j++) {
            var tm = sstr(arr[j] && arr[j].term).trim();
            if (!tm || tm === "..." || seen[tm.toLowerCase()]) continue;
            if (foldDe(tm) === foldDe(q)) continue;
            seen[tm.toLowerCase()] = 1;
            terms.push({ term: tm.slice(0, 60), level: sstr((arr[j] && arr[j].level) || "") });
          }
        }
        if (!terms.length) return { status: "empty", provider: "openthesaurus" };
        return { status: "ok", provider: "openthesaurus", terms: terms,
          url: "https://www.openthesaurus.de/synonyme/" + encodeURIComponent(q),
          license: "CC BY-SA 4.0" };
      });
    }, outerSignal);
  }

  /* ================= provider: MyMemory (MT fallback) ================= */
  var MM_BAD = /MYMEMORY WARNING|INVALID (EMAIL|TARGET LANGUAGE)|QUERY LENGTH LIMIT|NO QUERY SPECIFIED/i;
  function mymemorySearch(deText, outerSignal) {
    var q = normQ(deText);
    if (!q || q.length > 500) return Promise.resolve({ status: "empty", provider: "mymemory" });
    return cachedFetch("mymemory", q, function (sig) {
      var s = sig || outerSignal;
      var u = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(q) + "&langpair=de|ar";
      return fetchJson(u, undefined, s).then(function (r) {
        if (!r.ok) {
          if (r.error === "aborted") return { status: "aborted", provider: "mymemory" };
          return { status: "error", provider: "mymemory", error: r.error };
        }
        var txt = "";
        try { txt = sstr(r.data.responseData && r.data.responseData.translatedText); } catch (e) {}
        var st = null;
        try { st = r.data.responseStatus; } catch (e) {}
        if (!txt || MM_BAD.test(txt) || (st !== 200 && st !== "200")) {
          return { status: "empty", provider: "mymemory" };
        }
        var match = 0;
        try { match = parseFloat(r.data.responseData && r.data.responseData.match) || 0; } catch (e) {}
        return { status: "ok", provider: "mymemory", text: txt.slice(0, 500), match: match, machine: true };
      });
    }, outerSignal);
  }

  /* ================= provider: Forvo (optional, disabled without key) ================= */
  function forvoSearch() {
    return Promise.resolve({ status: "disabled", provider: "forvo",
      reason: "needs-key",
      note: "Forvo needs a private API key and must never be embedded in public client code." });
  }

  /* ================= coordinator ================= */
  var ADAPTERS = {
    local: localSearch,
    wiktionary: wiktionarySearch,
    "wiktionary-en": wiktionaryEnSearch,
    tatoeba: tatoebaSearch,
    commons: commonsSearch,
    openthesaurus: openthesaurusSearch,
    mymemory: mymemorySearch,
    forvo: forvoSearch
  };
  var REMOTE_ORDER = ["wiktionary", "tatoeba", "commons", "openthesaurus"];

  function isOffline() {
    try { return root.navigator && root.navigator.onLine === false; } catch (e) { return false; }
  }
  /* Generation + cancellation ownership (Fix 3):
   * Each searchAll generation owns an AbortController. A new query with a
   * DIFFERENT normalized query aborts the previous generation's exclusive
   * requests. Same-query concurrent searches share deduped in-flight
   * requests (same cache key) and are NOT aborted, so one consumer never
   * kills a request another active consumer still needs. Aborted providers
   * resolve as {status:"aborted"}: never shown as failures, never retried,
   * never overwrite newer results (gen + query guards in UI layer). */
  var searchGen = 0;
  var activeSearch = null; /* {gen, query, ctrl} */
  function newSearchController() {
    var ctrl = null;
    try {
      if (typeof root.AbortController === "function") ctrl = new root.AbortController();
    } catch (e) { ctrl = null; }
    return ctrl;
  }
  function cancelSearch(reason) {
    try {
      if (activeSearch && activeSearch.ctrl) {
        try { activeSearch.ctrl.abort(); } catch (e) {}
      }
    } catch (e) {}
    searchGen++;
    activeSearch = null;
    return searchGen;
  }
  function isAbortedResult(r) {
    return !!(r && (r.status === "aborted" || r.error === "aborted"));
  }
  /* Cold local-search measurement (Fix 4): records build/scan times without
   * brittle assertions. Exposed via DMSearch.debug.coldStats for the
   * documented measurement + regression test. */
  var coldStats = { builds: 0, lastBuildMs: 0, lastScanMs: 0, lastTotalMs: 0, cold: true };
  function timedLocalSearch(q, sig) {
    var t0 = 0;
    try { t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); } catch (e) { t0 = Date.now(); }
    return ADAPTERS.local(q).then(function (lr) {
      try {
        var t1 = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now());
        coldStats.lastTotalMs = t1 - t0;
        coldStats.lastBuildMs = coldStats.lastTotalMs;
        coldStats.builds++;
        coldStats.cold = false;
      } catch (e) {}
      return lr;
    });
  }
  /* Run local + remotes concurrently; onUpdate(pid) after each settles.
   * opts: { only:[ids], prior:{}, needMT:bool, onUpdate:fn, signal } */
  function searchAll(query, opts) {
    opts = opts || {};
    var q = normQ(query);
    var myGen = ++searchGen;
    var ctrl = opts.signalCtrl || newSearchController();
    var sig = null;
    try { sig = ctrl ? ctrl.signal : (opts.signal || null); } catch (e) { sig = opts.signal || null; }
    /* Abort previous generation ONLY when the query differs: same-query
     * concurrent calls share inflight dedup keys and must not be killed. */
    try {
      if (activeSearch && activeSearch.ctrl && activeSearch.query !== q) {
        try { activeSearch.ctrl.abort(); } catch (e) {}
      }
    } catch (e) {}
    activeSearch = { gen: myGen, query: q, ctrl: ctrl };
    var state = { query: q, isSentence: isSentenceQuery(q), offline: isOffline(), local: null, remote: {},
      gen: myGen };
    if (opts.prior && opts.prior.remote) {
      Object.keys(opts.prior.remote).forEach(function (k) { state.remote[k] = opts.prior.remote[k]; });
    }
    if (opts.prior && opts.prior.local) {
      try { state.local = opts.prior.local; } catch (e) {}
    }
    var jobs = [];
    function runPid(pid) {
      if (opts.only && opts.only.indexOf(pid) < 0) return;
      if (state.remote[pid] && state.remote[pid].status === "ok") return; /* keep successes on retry */
      /* Aborted prior entries are re-runnable; error/empty/loading are too. */
      state.remote[pid] = { status: "loading", provider: pid };
      var p = Promise.resolve()
        .then(function () { return ADAPTERS[pid](q, sig); })
        .then(function (r) {
          state.remote[pid] = r || { status: "error", provider: pid, error: "bad-result" };
          /* Aborted must not look like failure and must not trigger retry UI. */
          try { if (typeof opts.onUpdate === "function") opts.onUpdate(pid, state); } catch (e) {}
          return state.remote[pid];
        }, function () {
          state.remote[pid] = { status: "error", provider: pid, error: "exception" };
          try { if (typeof opts.onUpdate === "function") opts.onUpdate(pid, state); } catch (e) {}
          return state.remote[pid];
        });
      jobs.push(p);
    }
    /* Fix 4: local and remotes start concurrently. The cold
     * sentA1SearchRows() index build is synchronous, but remotes are already
     * in-flight (network async) so external searches progress while the
     * local index warms. No full vocab/sentence bank is loaded here; only
     * already-present globals are scanned. A pre-prewarm query is queued via
     * the same promise chain, never lost. */
    try {
      state.local = null;
      var localP = Promise.resolve().then(function () { return timedLocalSearch(q, sig); }).then(function (lr) {
        /* If a newer generation superseded us, keep results but let UI guard drop them. */
        state.local = lr;
        try { if (typeof opts.onUpdate === "function") opts.onUpdate("local", state); } catch (e) {}
        return lr;
      });
      if (!q) {
        return localP.then(function () { return state; });
      }
      if (state.offline) {
        return localP.then(function () {
          REMOTE_ORDER.forEach(function (pid) {
            if (!state.remote[pid]) state.remote[pid] = { status: "error", provider: pid, error: "offline" };
          });
          return state;
        });
      }
      REMOTE_ORDER.forEach(runPid);
      return Promise.all([localP].concat(jobs)).then(function () {
        /* Dictionary fallback (Fix 6): EN edition only when DE primary has
         * no usable definition. Respects opts.only: on retry, run only if
         * explicitly requested; on fresh search, auto-trigger on empty. */
        var needDictFallback = false;
        try {
          var dePrimary = state.remote.wiktionary;
          var hasUsableDe = !!(dePrimary && dePrimary.status === "ok");
          var deEmpty = !!(dePrimary && dePrimary.status === "empty");
          if (opts.only) {
            needDictFallback = opts.only.indexOf("wiktionary-en") >= 0;
          } else {
            needDictFallback = deEmpty && !hasUsableDe && !state.remote["wiktionary-en"];
          }
        } catch (e) {}
        var dictP = Promise.resolve(state);
        if (needDictFallback && !isOffline()) {
          var enExplicitlyOk = state.remote["wiktionary-en"] && state.remote["wiktionary-en"].status === "ok";
          if (!enExplicitlyOk) {
            state.remote["wiktionary-en"] = { status: "loading", provider: "wiktionary-en" };
            dictP = Promise.resolve().then(function () { return ADAPTERS["wiktionary-en"](q, sig); }).then(function (er) {
              state.remote["wiktionary-en"] = er;
              try { if (typeof opts.onUpdate === "function") opts.onUpdate("wiktionary-en", state); } catch (e) {}
              return state;
            }, function () {
              state.remote["wiktionary-en"] = { status: "error", provider: "wiktionary-en", error: "exception" };
              return state;
            });
          }
        }
        return dictP.then(function () {
          /* MT fallback (Fix 1): sentence-like query with no human Arabic.
           * Respects opts.only so retry runs MT ONLY when explicitly in the
           * failed list (previously mymemory was never dispatched because it
           * is not in REMOTE_ORDER and wantMT required !state.remote.mymemory
           * which was always set on retry -> stuck loading). */
          var hasAra = false;
          try {
            (state.local.sentences || []).forEach(function (s) { if (sstr(s.ar).trim()) hasAra = true; });
            Object.keys(state.remote).forEach(function (k) {
              ((((state.remote[k] || {}).items) || [])).forEach(function (it) {
                if (it && it.ara && it.ara.length) hasAra = true;
              });
            });
          } catch (e) {}
          var mtInOnly = !!(opts.only && opts.only.indexOf("mymemory") >= 0);
          var wantMT;
          if (opts.only) {
            wantMT = mtInOnly;
          } else {
            wantMT = opts.needMT !== false && state.isSentence && !hasAra && !state.remote.mymemory;
          }
          if (wantMT && !isOffline()) {
            var mmPrevOk = state.remote.mymemory && state.remote.mymemory.status === "ok";
            if (!(mmPrevOk && !mtInOnly)) {
              state.remote.mymemory = { status: "loading", provider: "mymemory" };
              try { if (typeof opts.onUpdate === "function") opts.onUpdate("mymemory", state); } catch (e) {}
              return Promise.resolve().then(function () { return ADAPTERS.mymemory(q, sig); }).then(function (mr) {
                state.remote.mymemory = mr;
                try { if (typeof opts.onUpdate === "function") opts.onUpdate("mymemory", state); } catch (e) {}
                return state;
              }, function () {
                state.remote.mymemory = { status: "error", provider: "mymemory", error: "exception" };
                try { if (typeof opts.onUpdate === "function") opts.onUpdate("mymemory", state); } catch (e) {}
                return state;
              });
            }
          }
          return state;
        });
      });
    } catch (e) {
      return Promise.resolve(state);
    }
  }

  function status() {
    var out = {};
    PROVIDERS.forEach(function (p) {
      out[p.id] = { name: p.name, home: p.home, caps: p.caps,
        state: p.id === "forvo" ? "disabled-needs-key" : (p.id === "local" ? "ready" : "ready-no-key") };
    });
    return out;
  }

  /* ================= i18n (same system: S.uiLang + I18N + t()) ================= */
  var STR = {
    ar: { dm_ext_title: "نتائج موسّعة من مصادر ألمانية", dm_ext_loading: "جارٍ جلب نتائج إضافية…",
      dm_ext_meaning: "المعنى والقواعد", dm_ext_examples: "أمثلة حقيقية", dm_ext_syn: "مرادفات وكلمات قريبة",
      dm_ext_pron: "النطق", dm_ext_trans: "الترجمة العربية", dm_ext_machine: "ترجمة آلية — غير مُدققة",
      dm_ext_exact: "مطابق", dm_ext_similar: "مشابه", dm_ext_retry: "إعادة المحاولة",
      dm_ext_offline: "أنت دون إنترنت — تُعرض النتائج المحلية فقط.", dm_ext_none: "لا نتائج إضافية لهذا البحث.",
      dm_ext_sources: "المصادر", dm_ext_listen: "استمع", dm_ext_tts: "نطق آلي 🇩🇪",
      dm_ext_save: "☆ حفظ", dm_ext_noaudio: "لا يوجد تسجيل بشري — استخدم النطق الآلي.",
      dm_ext_ar_missing: "لم تُعثر على ترجمة عربية مُدققة.", dm_ext_fail: "تعذّر الوصول لهذا المصدر.",
      dm_ext_human: "تسجيل بشري", dm_ext_verified: "محتوى مُدقق من المصدر", dm_ext_open: "فتح المصدر",
      dm_ext_dict_fallback: "تعريف من الطبعة الإنجليزية", dm_ext_no_dict: "لا يوجد تعريف usable — جرّب القواميس الخارجية.",
      dm_ext_audio_unavail: "التسجيل غير متاح لإعادة الاستخدام — استخدم النطق الآلي.",
      dm_ext_audio_attr: "التسجيل:", dm_ext_mt_fail: "تعذّرت الترجمة الآلية." },
    en: { dm_ext_title: "Extended results from German sources", dm_ext_loading: "Fetching extra results…",
      dm_ext_meaning: "Meaning & grammar", dm_ext_examples: "Real examples", dm_ext_syn: "Synonyms & related",
      dm_ext_pron: "Pronunciation", dm_ext_trans: "Arabic translation", dm_ext_machine: "Machine translation — unverified",
      dm_ext_exact: "exact", dm_ext_similar: "similar", dm_ext_retry: "Retry",
      dm_ext_offline: "You are offline — local results only.", dm_ext_none: "No extra results for this query.",
      dm_ext_sources: "Sources", dm_ext_listen: "Listen", dm_ext_tts: "Synthetic voice 🇩🇪",
      dm_ext_save: "☆ Save", dm_ext_noaudio: "No human recording — use synthetic voice.",
      dm_ext_ar_missing: "No verified Arabic translation found.", dm_ext_fail: "This source is unreachable.",
      dm_ext_human: "Human recording", dm_ext_verified: "Verified source content", dm_ext_open: "Open source",
      dm_ext_dict_fallback: "Definition from English edition", dm_ext_no_dict: "No usable definition — try external dictionaries.",
      dm_ext_audio_unavail: "Recording unavailable for reuse — use synthetic voice.",
      dm_ext_audio_attr: "Recording:", dm_ext_mt_fail: "Machine translation failed." },
    de: { dm_ext_title: "Erweiterte Ergebnisse aus deutschen Quellen", dm_ext_loading: "Zusätzliche Ergebnisse werden geladen…",
      dm_ext_meaning: "Bedeutung & Grammatik", dm_ext_examples: "Echte Beispiele", dm_ext_syn: "Synonyme & Verwandtes",
      dm_ext_pron: "Aussprache", dm_ext_trans: "Arabische Übersetzung", dm_ext_machine: "Maschinelle Übersetzung — ungeprüft",
      dm_ext_exact: "exakt", dm_ext_similar: "ähnlich", dm_ext_retry: "Wiederholen",
      dm_ext_offline: "Du bist offline — nur lokale Ergebnisse.", dm_ext_none: "Keine zusätzlichen Ergebnisse.",
      dm_ext_sources: "Quellen", dm_ext_listen: "Anhören", dm_ext_tts: "Synthetische Stimme 🇩🇪",
      dm_ext_save: "☆ Speichern", dm_ext_noaudio: "Keine menschliche Aufnahme — synthetische Stimme nutzen.",
      dm_ext_ar_missing: "Keine geprüfte arabische Übersetzung gefunden.", dm_ext_fail: "Diese Quelle ist nicht erreichbar.",
      dm_ext_human: "Menschliche Aufnahme", dm_ext_verified: "Geprüfter Quelleninhalt", dm_ext_open: "Quelle öffnen",
      dm_ext_dict_fallback: "Definition aus englischer Ausgabe", dm_ext_no_dict: "Keine brauchbare Definition — externe Wörterbücher versuchen.",
      dm_ext_audio_unavail: "Aufnahme nicht zur Wiederverwendung verfügbar — synthetische Stimme nutzen.",
      dm_ext_audio_attr: "Aufnahme:", dm_ext_mt_fail: "Maschinelle Übersetzung fehlgeschlagen." }
  };
  try {
    if (root.I18N && root.I18N.ar) {
      Object.assign(root.I18N.ar, STR.ar);
      Object.assign(root.I18N.en, STR.en);
      Object.assign(root.I18N.de, STR.de);
    } else {
      root.__earlyI18N = root.__earlyI18N || [];
      root.__earlyI18N.push(STR);
    }
  } catch (e) {}
  function T(k) {
    try { if (typeof root.t === "function") { var v = root.t(k); if (v && v !== k) return v; } } catch (e) {}
    try {
      var L = "ar";
      try { if (root.S && root.S.uiLang) L = root.S.uiLang; } catch (e2) {}
      if (STR[L] && STR[L][k]) return STR[L][k];
    } catch (e) {}
    return (STR.ar[k] || k);
  }

  /* ================= UI: progressive enhancement of #searchResults ================= */
  var gen = 0, debounceT = 0;
  function $(id) { try { return root.document.getElementById(id); } catch (e) { return null; } }
  function el(tag, cls, txt) {
    var d = root.document.createElement(tag);
    if (cls) d.className = cls;
    if (txt !== undefined && txt !== null) d.textContent = txt;
    return d;
  }
  function link(href, txt) {
    var a = root.document.createElement("a");
    a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.className = "dm-ext-link"; a.textContent = txt;
    return a;
  }
  function speakDe(text) {
    var t = normQ(text);
    if (!t) return;
    try {
      if (typeof root.speak === "function") { root.speak(t); return; }
    } catch (e) {}
    try {
      var synth = root.speechSynthesis;
      if (!synth) return;
      try { synth.cancel(); } catch (e) {}
      var u = new root.SpeechSynthesisUtterance(t);
      u.lang = "de-DE";
      try {
        var vs = synth.getVoices ? synth.getVoices() : [];
        for (var i = 0; i < vs.length; i++) {
          if (vs[i] && vs[i].lang && vs[i].lang.toLowerCase().indexOf("de") === 0) { u.voice = vs[i]; break; }
        }
      } catch (e) {}
      synth.speak(u);
    } catch (e) {}
  }
  function srcBadge(name) {
    return el("span", "dm-ext-src", name);
  }
  function matchBadge(kind) {
    var b = el("span", "dm-badge " + (kind === "exact" ? "dm-exact" : "dm-sim"),
      kind === "exact" ? T("dm_ext_exact") : T("dm_ext_similar"));
    return b;
  }
  /* Incremental renderer (Fix 5): stable keys, in-place updates, audio
   * identity preserved. Never clears wrap.innerHTML; only the changed
   * provider section is created/updated. Audio elements with the same src
   * are reused so currentTime/playback/focus survive progressive updates.
   * All remote text via textContent only. Scoped to #dmExt, no renderAll. */
  function findSec(wrap, key) {
    try {
      var list = wrap.querySelectorAll("[data-dm-sec]");
      for (var i = 0; i < list.length; i++) {
        if (list[i].getAttribute("data-dm-sec") === key) return list[i];
      }
    } catch (e) {}
    return null;
  }
  function orderedInsert(wrap, node, order, key) {
    try {
      var idx = order.indexOf(key);
      var kids = wrap.children;
      for (var i = 0; i < kids.length; i++) {
        var k = null;
        try { k = kids[i].getAttribute("data-dm-sec"); } catch (e) {}
        var ki = k ? order.indexOf(k) : 999;
        if (ki > idx) { wrap.insertBefore(node, kids[i]); return; }
      }
      wrap.appendChild(node);
    } catch (e) {
      try { wrap.appendChild(node); } catch (e2) {}
    }
  }
  function setNote(wrap, order, key, text, cls) {
    var n = findSec(wrap, key);
    if (!text) { try { if (n && n.parentNode) n.parentNode.removeChild(n); } catch (e) {} return null; }
    if (!n) {
      n = el("div", cls || "dm-ext-note", text);
      try { n.setAttribute("data-dm-sec", key); } catch (e) {}
      orderedInsert(wrap, n, order, key);
    } else {
      try { if (n.textContent !== text) n.textContent = text; } catch (e) {}
      try { if (cls) n.className = cls; } catch (e) {}
    }
    return n;
  }
  function findAudioBySrc(section, src) {
    try {
      var list = section.querySelectorAll("audio.dm-ext-audio");
      for (var i = 0; i < list.length; i++) {
        try {
          if (list[i].getAttribute("src") === src || list[i].src === src) return list[i];
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }
  function makeAudio(src, onGone) {
    var au = root.document.createElement("audio");
    au.controls = true; au.preload = "none"; au.src = src;
    au.className = "dm-ext-audio";
    try { au.setAttribute("data-dm-audio", src); } catch (e) {}
    au.addEventListener("error", function () {
      /* 403 (reuse disallowed) / 404 (removed) surface here. No bypass
       * via alternative URL: mark unavailable, keep TTS fallback. */
      try {
        var nt = el("div", "dm-ext-note", "⚠️ " + T("dm_ext_audio_unavail"));
        try { nt.setAttribute("data-dm-audio-gone", src); } catch (e) {}
        au.replaceWith(nt);
        if (typeof onGone === "function") { try { onGone(); } catch (e) {} }
      } catch (e) {}
    });
    return au;
  }
  function renderState(box, state) {
    var q = state.query;
    var wrap = $("dmExt");
    if (!wrap) {
      wrap = el("div", "dm-ext");
      wrap.id = "dmExt";
      try { box.appendChild(wrap); } catch (e) { return; }
    }
    /* New query: reset sections (query key changed). Same query progressive
     * update: reuse everything. */
    try {
      var wq = wrap.getAttribute("data-dm-q") || "";
      if (wq !== q) {
        wrap.setAttribute("data-dm-q", q);
        /* Remove all provider sections but keep wrap node itself. */
        var olds = [];
        try {
          var all = wrap.querySelectorAll("[data-dm-sec]");
          for (var oi = 0; oi < all.length; oi++) olds.push(all[oi]);
        } catch (e) {}
        for (var oj = 0; oj < olds.length; oj++) {
          try { if (olds[oj].parentNode === wrap) wrap.removeChild(olds[oj]); } catch (e) {}
        }
      }
    } catch (e) {}
    var ORDER = ["title", "offline", "loading", "dict-de", "dict-en", "dict-none",
      "examples", "syn", "pron", "mt", "none", "foot", "errs"];
    (function ensureTitle() {
      var t = findSec(wrap, "title");
      var txt = "🌐 " + T("dm_ext_title");
      if (!t) {
        t = el("div", "dm-ext-title", txt);
        try { t.setAttribute("data-dm-sec", "title"); } catch (e) {}
        orderedInsert(wrap, t, ORDER, "title");
      } else if (t.textContent !== txt) {
        try { t.textContent = txt; } catch (e) {}
      }
    })();
    var anyOk = false, anyLoading = false, fails = [];
    Object.keys(state.remote).forEach(function (pid) {
      var r = state.remote[pid];
      if (!r) return;
      if (r.status === "ok") anyOk = true;
      if (r.status === "loading") anyLoading = true;
      /* Aborted is intentional cancellation: never a failure, never retried. */
      if (r.status === "error") fails.push(pid);
    });
    setNote(wrap, ORDER, "offline", state.offline ? "📴 " + T("dm_ext_offline") : "", "dm-ext-note");
    setNote(wrap, ORDER, "loading", (anyLoading && !anyOk) ? "⏳ " + T("dm_ext_loading") : "", "dm-ext-note dm-loading");
    /* --- meaning / grammar (Wiktionary) --- */
    /* --- meaning / grammar (Wiktionary DE primary + EN fallback) --- */
    function renderDictSec(pid, secKey, badgeName) {
      var wik = state.remote[pid];
      var prev = findSec(wrap, secKey);
      if (!(wik && wik.status === "ok")) {
        try { if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {}
        return;
      }
      var sig = "";
      try { sig = pid + "|" + (wik.title || "") + "|" + (wik.senses || []).length + "|" + ((wik.examples || []).length); } catch (e) {}
      if (prev) {
        try {
          if (prev.getAttribute("data-dm-sig") === sig) return prev;
        } catch (e) {}
        try { if (prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {}
        prev = null;
      }
      var sec = el("div", "dm-ext-sec");
      try { sec.setAttribute("data-dm-sec", secKey); sec.setAttribute("data-dm-sig", sig); } catch (e) {}
      var h = el("div", "dm-ext-h");
      h.appendChild(el("span", "", "📖 " + T("dm_ext_meaning") + " · "));
      h.appendChild(srcBadge(badgeName));
      h.appendChild(matchBadge(wik.match || "similar"));
      if (pid === "wiktionary-en") {
        var fb = el("span", "dm-badge dm-sim", T("dm_ext_dict_fallback"));
        h.appendChild(fb);
      }
      sec.appendChild(h);
      if (wik.grammar && (wik.grammar.pos || wik.grammar.gender || wik.grammar.plural || wik.grammar.ipa)) {
        var g = [];
        if (wik.grammar.gender) g.push(wik.grammar.gender);
        if (wik.grammar.pos) g.push(wik.grammar.pos);
        if (wik.grammar.plural) g.push("Pl. " + wik.grammar.plural);
        if (wik.grammar.ipa) g.push("[" + wik.grammar.ipa + "]");
        sec.appendChild(el("div", "dm-ext-gram", g.join(" · ")));
      }
      (wik.senses || []).slice(0, 8).forEach(function (sn) {
        sec.appendChild(el("div", "dm-ext-sense", "[" + sn.n + "] " + sn.text));
      });
      (wik.examples || []).slice(0, 3).forEach(function (ex) {
        sec.appendChild(el("div", "dm-ext-wex", "💬 " + ex));
      });
      var fl = el("div", "dm-ext-foot");
      fl.appendChild(link(wik.url, T("dm_ext_open") + " · CC BY-SA"));
      /* save shortcut when a local word matches */
      try {
        var lw = null;
        if (state.local && state.local.words && state.local.words.length) {
          for (var li = 0; li < state.local.words.length; li++) {
            if (foldDe(state.local.words[li].de) === foldDe(wik.title)) { lw = state.local.words[li]; break; }
          }
        }
        if (lw && lw.id && typeof root.toggleFav === "function") {
          (function (id) {
            var b = el("button", "mini-btn", T("dm_ext_save"));
            b.addEventListener("click", function (ev) {
              try { ev.stopPropagation(); root.toggleFav(id); b.textContent = "★"; } catch (e) {}
            });
            fl.appendChild(b);
          })(lw.id);
        }
      } catch (e) {}
      sec.appendChild(fl);
      orderedInsert(wrap, sec, ORDER, secKey);
      return sec;
    }
    renderDictSec("wiktionary", "dict-de", "Wiktionary");
    renderDictSec("wiktionary-en", "dict-en", "Wiktionary EN");
    /* No usable definition in either edition: honest note + verified
     * external dictionary links (links only, never scraped). Does not hide
     * sentences/audio/synonyms/translations elsewhere. */
    (function renderDictNone() {
      var deR = state.remote.wiktionary, enR = state.remote["wiktionary-en"];
      var bothSettled = deR && enR &&
        (deR.status === "empty" || deR.status === "error") &&
        (enR.status === "empty" || enR.status === "error");
      var deEmptyAlone = deR && (deR.status === "empty") && (!enR || enR.status !== "ok" && enR.status !== "loading");
      var showNone = false;
      try {
        var deDone = deR && (deR.status === "empty" || deR.status === "error");
        var enDone = !enR || enR.status === "empty" || enR.status === "error";
        var enLoading = enR && enR.status === "loading";
        var deLoading = deR && deR.status === "loading";
        showNone = !!(deDone && enDone && !enLoading && !deLoading &&
          !(deR && deR.status === "ok") && !(enR && enR.status === "ok") &&
          !/\s/.test(q) && q.length <= 40 && q.length > 0);
      } catch (e) {}
      var prev = findSec(wrap, "dict-none");
      if (!showNone) { try { if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {} return; }
      if (prev) return;
      var sec = el("div", "dm-ext-sec");
      try { sec.setAttribute("data-dm-sec", "dict-none"); } catch (e) {}
      sec.appendChild(el("div", "dm-ext-note", "ℹ️ " + T("dm_ext_no_dict")));
      var row = el("div", "dm-ext-foot");
      dictFallbackLinks(q).forEach(function (l, ix, arr) {
        row.appendChild(link(l.url, l.name));
        if (ix < arr.length - 1) row.appendChild(el("span", "muted", " · "));
      });
      sec.appendChild(row);
      orderedInsert(wrap, sec, ORDER, "dict-none");
    })();
    /* --- examples (Tatoeba, incremental, per-recording licensing) --- */
    (function renderExamples() {
      var tat = state.remote.tatoeba;
      var key = "examples";
      var prev = findSec(wrap, key);
      if (!(tat && tat.status === "ok" && tat.items && tat.items.length)) {
        try { if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {}
        return;
      }
      var s2 = prev;
      if (!s2) {
        s2 = el("div", "dm-ext-sec");
        try { s2.setAttribute("data-dm-sec", key); } catch (e) {}
        var h2 = el("div", "dm-ext-h");
        h2.appendChild(el("span", "", "💬 " + T("dm_ext_examples") + " · "));
        h2.appendChild(srcBadge("Tatoeba"));
        s2.appendChild(h2);
        orderedInsert(wrap, s2, ORDER, key);
      }
      var seen = {};
      try {
        var existing = s2.querySelectorAll("[data-dm-sent]");
        for (var ei = 0; ei < existing.length; ei++) {
          try { seen[existing[ei].getAttribute("data-dm-sent")] = existing[ei]; } catch (e) {}
        }
      } catch (e) {}
      tat.items.slice(0, 6).forEach(function (it) {
        var ck = "tatoeba-" + it.id;
        var card = seen[ck];
        if (card) {
          /* Update in place: never recreate existing audio elements. */
          return;
        }
        card = el("div", "dm-ext-sent");
        try { card.setAttribute("data-dm-sent", ck); } catch (e) {}
        var top = el("div", "dm-ext-sent-top");
        top.appendChild(el("b", "", it.text));
        top.appendChild(matchBadge(it.match || "similar"));
        card.appendChild(top);
        var shown = 0;
        (it.ara || []).slice(0, 2).forEach(function (tr) {
          card.appendChild(el("div", "dm-ext-ar", "🇸🇦 " + tr.text));
          shown++;
        });
        (it.eng || []).slice(0, shown ? 1 : 2).forEach(function (tr) {
          card.appendChild(el("div", "dm-ext-en", "🇬🇧 " + tr.text));
        });
        var meta = el("div", "dm-ext-meta");
        var attr = "👤 " + (it.owner || "?") + " · " + (it.license || "CC-BY");
        meta.appendChild(el("span", "", attr + " "));
        meta.appendChild(link(it.url, "Tatoeba #" + it.id));
        card.appendChild(meta);
        /* Per-recording audio: embed ONLY eligible (license+author known).
         * Ineligible (unknown license/author, 403/404) -> sentence kept,
         * TTS fallback, no embed, no bypass. */
        var elig = [];
        try {
          (it.audio || []).forEach(function (a) {
            if (a && a.eligible && a.url) elig.push(a);
          });
        } catch (e) {}
        elig.slice(0, 1).forEach(function (a) {
          try {
            var existAu = findAudioBySrc(card, a.url);
            if (existAu) return;
            var au = makeAudio(a.url);
            card.appendChild(au);
            var lb = el("div", "dm-ext-meta");
            var atxt = "🎙️ " + T("dm_ext_human") + " · " + (a.author || "?") + " · " + (a.license || "");
            lb.appendChild(el("span", "", atxt + " "));
            try {
              if (a.attributionUrl) lb.appendChild(link(a.attributionUrl, T("dm_ext_open")));
            } catch (e) {}
            card.appendChild(lb);
          } catch (e) {}
        });
        if (!elig.length && (it.audio || []).length) {
          /* Recording exists but reuse not established: explicit note. */
          card.appendChild(el("div", "dm-ext-note", "⚠️ " + T("dm_ext_audio_unavail")));
        }
        var row = el("div", "row-flex");
        var tb = el("button", "mini-btn", "🔊 " + T("dm_ext_tts"));
        tb.addEventListener("click", function (ev) { try { ev.stopPropagation(); speakDe(it.text); } catch (e) {} });
        row.appendChild(tb);
        card.appendChild(row);
        s2.appendChild(card);
      });
      /* Remove stale cards no longer in results (avoid duplicates). */
      try {
        var want = {};
        tat.items.slice(0, 6).forEach(function (it) { want["tatoeba-" + it.id] = 1; });
        var all = s2.querySelectorAll("[data-dm-sent]");
        for (var ri = 0; ri < all.length; ri++) {
          var kk = null;
          try { kk = all[ri].getAttribute("data-dm-sent"); } catch (e) {}
          if (kk && !want[kk]) { try { all[ri].parentNode.removeChild(all[ri]); } catch (e) {} }
        }
      } catch (e) {}
    })();
    /* --- synonyms (OpenThesaurus, incremental) --- */
    (function renderSyn() {
      var ot = state.remote.openthesaurus;
      var prev = findSec(wrap, "syn");
      if (!(ot && ot.status === "ok" && ot.terms && ot.terms.length)) {
        try { if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {}
        return;
      }
      var sig = "";
      try { sig = (ot.terms || []).slice(0, 12).map(function (t) { return t.term; }).join("|"); } catch (e) {}
      if (prev) {
        try { if (prev.getAttribute("data-dm-sig") === sig) return; } catch (e) {}
        try { if (prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {}
      }
      var s3 = el("div", "dm-ext-sec");
      try { s3.setAttribute("data-dm-sec", "syn"); s3.setAttribute("data-dm-sig", sig); } catch (e) {}
      var h3 = el("div", "dm-ext-h");
      h3.appendChild(el("span", "", "🔗 " + T("dm_ext_syn") + " · "));
      h3.appendChild(srcBadge("OpenThesaurus"));
      s3.appendChild(h3);
      var chips = el("div", "dm-ext-chips");
      ot.terms.slice(0, 12).forEach(function (tm) {
        chips.appendChild(el("span", "dm-chip", tm.term + (tm.level ? " (" + tm.level + ")" : "")));
      });
      s3.appendChild(chips);
      var f3 = el("div", "dm-ext-foot");
      f3.appendChild(link(ot.url, T("dm_ext_open") + " · CC BY-SA 4.0"));
      s3.appendChild(f3);
      orderedInsert(wrap, s3, ORDER, "syn");
    })();
    /* --- pronunciation (Commons + TTS fallback, audio-preserving) --- */
    (function renderPron() {
      var com = state.remote.commons;
      var tat = state.remote.tatoeba;
      var prev = findSec(wrap, "pron");
      var show = ((com && com.status === "ok") || !(com && com.status === "error" && !anyOk));
      if (!show) { try { if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {} return; }
      var s4 = prev;
      if (!s4) {
        s4 = el("div", "dm-ext-sec");
        try { s4.setAttribute("data-dm-sec", "pron"); } catch (e) {}
        var h4 = el("div", "dm-ext-h");
        h4.appendChild(el("span", "", "🎧 " + T("dm_ext_pron") + " · "));
        h4.appendChild(srcBadge("Commons"));
        s4.appendChild(h4);
        orderedInsert(wrap, s4, ORDER, "pron");
      }
      /* Reuse existing audio rows by src; only append missing, remove stale. */
      var wantSrcs = [];
      try {
        if (com && com.status === "ok" && com.items) {
          com.items.slice(0, 3).forEach(function (a) { if (a && a.url) wantSrcs.push(a.url); });
        }
      } catch (e) {}
      var hasHuman = wantSrcs.length > 0;
      try {
        var existingRows = s4.querySelectorAll("[data-dm-prow]");
        var have = {};
        for (var i = 0; i < existingRows.length; i++) {
          var k = null;
          try { k = existingRows[i].getAttribute("data-dm-prow"); } catch (e) {}
          if (k) have[k] = existingRows[i];
        }
        /* Append missing rows (audio elements created once, then reused). */
        (com && com.status === "ok" && com.items ? com.items.slice(0, 3) : []).forEach(function (a) {
          if (!a || !a.url || have[a.url]) return;
          var row = el("div", "dm-ext-prow");
          try { row.setAttribute("data-dm-prow", a.url); } catch (e) {}
          try {
            var au2 = makeAudio(a.url);
            row.appendChild(au2);
          } catch (e) {}
          var cap = el("div", "dm-ext-meta");
          cap.appendChild(el("span", "", "🎙️ " + T("dm_ext_human") + " · " + (a.artist || "?") + " · " + (a.license || "") + " "));
          cap.appendChild(link(a.pageUrl, T("dm_ext_open")));
          row.appendChild(cap);
          /* Insert before TTS row if present. */
          try {
            var ttsN = s4.querySelector("[data-dm-tts]");
            if (ttsN) s4.insertBefore(row, ttsN);
            else s4.appendChild(row);
          } catch (e) { s4.appendChild(row); }
        });
        /* Remove stale rows. */
        for (var kk in have) {
          if (wantSrcs.indexOf(kk) < 0) {
            try {
              /* Do not yank focus: if it contains focus, keep it. */
              var ae = null;
              try { ae = root.document.activeElement; } catch (e) {}
              if (ae && have[kk].contains && have[kk].contains(ae)) continue;
              have[kk].parentNode.removeChild(have[kk]);
            } catch (e) {}
          }
        }
      } catch (e) {}
      /* TTS row: create once, update note in place. */
      var ttsRow = null;
      try { ttsRow = s4.querySelector("[data-dm-tts]"); } catch (e) {}
      if (!ttsRow) {
        ttsRow = el("div", "row-flex");
        try { ttsRow.setAttribute("data-dm-tts", "1"); } catch (e) {}
        var tts = el("button", "mini-btn", "🔊 " + T("dm_ext_tts"));
        tts.addEventListener("click", function (ev) { try { ev.stopPropagation(); speakDe(q); } catch (e) {} });
        ttsRow.appendChild(tts);
        s4.appendChild(ttsRow);
      }
      try {
        var note = ttsRow.querySelector("[data-dm-tts-note]");
        var needNote = !hasHuman && !(com && com.status === "loading");
        if (needNote && !note) {
          var sp = el("span", "muted", T("dm_ext_noaudio"));
          try { sp.setAttribute("data-dm-tts-note", "1"); } catch (e) {}
          ttsRow.appendChild(sp);
        } else if (!needNote && note) {
          try { note.parentNode.removeChild(note); } catch (e) {}
        } else if (note && note.textContent !== T("dm_ext_noaudio")) {
          note.textContent = T("dm_ext_noaudio");
        }
      } catch (e) {}
    })();
    /* --- MT fallback (MyMemory, honest incl. rate-limit/error) --- */
    (function renderMT() {
      var mm = state.remote.mymemory;
      var prev = findSec(wrap, "mt");
      if (!(mm && (mm.status === "ok" || mm.status === "loading" || mm.status === "error"))) {
        try { if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {}
        return;
      }
      if (mm.status === "aborted") {
        try { if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {}
        return;
      }
      var sig = mm.status + "|" + (mm.status === "ok" ? (mm.text || "").slice(0, 80) : (mm.error || ""));
      if (prev) {
        try { if (prev.getAttribute("data-dm-sig") === sig) return; } catch (e) {}
        try { if (prev.parentNode) prev.parentNode.removeChild(prev); } catch (e) {}
      }
      var s5 = el("div", "dm-ext-sec");
      try { s5.setAttribute("data-dm-sec", "mt"); s5.setAttribute("data-dm-sig", sig); } catch (e) {}
      var h5 = el("div", "dm-ext-h");
      h5.appendChild(el("span", "", "🌍 " + T("dm_ext_trans") + " · "));
      h5.appendChild(srcBadge("MyMemory"));
      s5.appendChild(h5);
      if (mm.status === "ok") {
        var mb = el("span", "dm-badge dm-mt", "🤖 " + T("dm_ext_machine"));
        s5.appendChild(mb);
        s5.appendChild(el("div", "dm-ext-ar", "🇸🇦 " + mm.text));
      } else if (mm.status === "loading") {
        s5.appendChild(el("div", "dm-ext-note dm-loading", "⏳ " + T("dm_ext_loading")));
      } else {
        /* Rate-limited or failed: report actual failure, never fake success. */
        var msg = "⚠️ MyMemory: " + (mm.error || "error") + " · " + T("dm_ext_mt_fail");
        if (mm.error === "rate-limited") msg = "⚠️ MyMemory: rate-limited · " + T("dm_ext_mt_fail");
        s5.appendChild(el("div", "dm-ext-note", msg));
      }
      orderedInsert(wrap, s5, ORDER, "mt");
    })();
    /* --- failures / empty / retry (incremental foot+errs) --- */
    (function renderFootErrs() {
      var showRetry = fails.length > 0;
      var showNone = (!anyOk && !anyLoading && !state.offline);
      setNote(wrap, ORDER, "none", showNone ? "ℹ️ " + T("dm_ext_none") : "", "dm-ext-note");
      if (!anyOk && !anyLoading) showRetry = true;
      var prev = findSec(wrap, "foot");
      var sig = T("dm_ext_sources") + "|" + (showRetry ? "R" : "-") + "|" + q;
      if (prev) {
        try {
          if (prev.getAttribute("data-dm-sig") === sig) {
            /* Refresh retry visibility without rebuilding (preserve focus). */
          } else {
            if (prev.parentNode) prev.parentNode.removeChild(prev);
            prev = null;
          }
        } catch (e) { prev = null; }
      }
      if (!prev) {
        var foot = el("div", "dm-ext-foot dm-ext-srcs");
        try { foot.setAttribute("data-dm-sec", "foot"); foot.setAttribute("data-dm-sig", sig); } catch (e) {}
        foot.appendChild(el("span", "muted", T("dm_ext_sources") + ": "));
        [["Wiktionary", "https://de.wiktionary.org/wiki/" + encodeURIComponent(q)],
         ["Tatoeba", "https://tatoeba.org/en/sentences/search?query=" + encodeURIComponent(q) + "&from=deu"],
         ["Commons", "https://commons.wikimedia.org/w/index.php?search=" + encodeURIComponent("File:De-" + q) + "&ns6=1"],
         ["OpenThesaurus", "https://www.openthesaurus.de/synonyme/" + encodeURIComponent(q)]
        ].forEach(function (sl, ix, arr) {
          foot.appendChild(link(sl[1], sl[0]));
          if (ix < arr.length - 1) foot.appendChild(el("span", "muted", " · "));
        });
        if (showRetry && !state.offline) {
          var rb = el("button", "mini-btn dm-retry", "↻ " + T("dm_ext_retry"));
          rb.addEventListener("click", function (ev) {
            try { ev.stopPropagation(); retryFailed(); } catch (e) {}
          });
          foot.appendChild(el("span", "", " "));
          foot.appendChild(rb);
        }
        orderedInsert(wrap, foot, ORDER, "foot");
      } else {
        /* Toggle retry button in place to preserve sibling audio/focus. */
        try {
          var hasRb = !!prev.querySelector(".dm-retry");
          var wantRb = !!(showRetry && !state.offline);
          if (wantRb && !hasRb) {
            var rb2 = el("button", "mini-btn dm-retry", "↻ " + T("dm_ext_retry"));
            rb2.addEventListener("click", function (ev) {
              try { ev.stopPropagation(); retryFailed(); } catch (e) {}
            });
            prev.appendChild(el("span", "", " "));
            prev.appendChild(rb2);
          } else if (!wantRb && hasRb) {
            var rbn = prev.querySelector(".dm-retry");
            try { if (rbn && rbn.parentNode) rbn.parentNode.removeChild(rbn); } catch (e) {}
          }
        } catch (e) {}
      }
      /* provider errors are accessory facts (failed source ≠ missing word) */
      var efPrev = findSec(wrap, "errs");
      if (fails.length && anyOk) {
        var txt = "⚠️ " + fails.join(", ") + ": " + T("dm_ext_fail");
        if (!efPrev) {
          var ef = el("div", "dm-ext-errs");
          try { ef.setAttribute("data-dm-sec", "errs"); } catch (e) {}
          ef.appendChild(el("span", "muted", txt));
          orderedInsert(wrap, ef, ORDER, "errs");
        } else {
          try {
            var sp = efPrev.querySelector("span");
            if (sp && sp.textContent !== txt) sp.textContent = txt;
          } catch (e) {}
        }
      } else {
        try { if (efPrev && efPrev.parentNode) efPrev.parentNode.removeChild(efPrev); } catch (e) {}
      }
    })();
  }

  var lastState = null, lastQuery = "";
  function currentQuery() {
    try {
      var i = $("globalSearch");
      return i ? normQ(i.value) : "";
    } catch (e) { return ""; }
  }
  function scheduleEnhance() {
    try {
      if (typeof root.document === "undefined") return;
      if (!$("globalSearch") || !$("searchResults")) return;
    } catch (e) { return; }
    try { if (debounceT) clearTimeout(debounceT); } catch (e) {}
    var myGen = ++gen;
    debounceT = setTimeout(function () { enhance(myGen); }, 450);
  }
  function viewAlive() {
    try {
      var b = $("searchResults");
      if (!b) return false;
      /* View closed / navigated away: detached node means cancel UI updates. */
      if (!b.isConnected && typeof b.isConnected === "boolean") return false;
      if (!root.document || !root.document.contains) return true;
      try { return root.document.contains(b); } catch (e) { return true; }
    } catch (e) { return true; }
  }
  function enhance(myGen) {
    var box = $("searchResults");
    if (!box) return;
    var q = currentQuery();
    if (!q) {
      lastQuery = "";
      try { cancelSearch("empty-query"); } catch (e) {}
      return;
    }
    if (q === lastQuery && lastState) {
      /* same query (e.g. unrelated re-render): keep rendered results */
      if (!$("dmExt")) renderState(box, lastState);
      return;
    }
    lastQuery = q;
    var g = (myGen === undefined ? ++gen : myGen);
    lastState = { query: q, isSentence: isSentenceQuery(q), offline: isOffline(), local: null, remote: {} };
    ["wiktionary", "tatoeba", "commons", "openthesaurus"].forEach(function (pid) {
      lastState.remote[pid] = { status: "loading", provider: pid };
    });
    try { renderState(box, lastState); } catch (e) {}
    var stale = function () {
      if (g !== gen) return true;
      try { if (normQ($("globalSearch").value) !== q) return true; } catch (e) {}
      try { if (!viewAlive()) return true; } catch (e) {}
      return false;
    };
    searchAll(q, {
      onUpdate: function (pid, st) {
        if (stale()) return;
        /* Aborted providers never touch the new query's UI. */
        try {
          if (st && st.remote && st.remote[pid] && st.remote[pid].status === "aborted") return;
        } catch (e) {}
        lastState = st;
        try {
          var b = $("searchResults");
          if (b) renderState(b, st);
        } catch (e) {}
      }
    }).then(function (st) {
      if (stale()) return;
      lastState = st;
      try {
        var b = $("searchResults");
        if (b) renderState(b, st);
      } catch (e) {}
    });
  }
  /* When the search view is closed / user navigates away, cancel outstanding
   * requests so no delayed UI update occurs. Safe to call anytime. */
  function leaveSearch() {
    try { if (debounceT) clearTimeout(debounceT); } catch (e) {}
    try { cancelSearch("leave"); } catch (e) {}
    gen++;
  }
  function retryFailed() {
    var box = $("searchResults");
    if (!box || !lastState) return;
    var q = lastState.query || currentQuery();
    if (!q) return;
    /* Only genuine failures are retried; aborted is intentional cancellation. */
    var failed = Object.keys(lastState.remote).filter(function (k) {
      var r = lastState.remote[k];
      if (!r) return false;
      if (r.status === "aborted") return false;
      if (k === "mymemory" || k === "wiktionary-en") return false;
      return (r.status === "error" || r.status === "empty");
    });
    /* MT retry: if sentence still lacks Arabic, include mymemory explicitly.
     * This is the Fix 1 path: the dispatcher now accepts "mymemory" in
     * only[] and re-executes ADAPTERS.mymemory (previously stuck loading). */
    var hasAra = false;
    try {
      Object.keys(lastState.remote).forEach(function (k) {
        (((lastState.remote[k] || {}).items) || []).forEach(function (it) {
          if (it && it.ara && it.ara.length) hasAra = true;
        });
      });
      (lastState.local && lastState.local.sentences || []).forEach(function (s) {
        if (sstr(s.ar).trim()) hasAra = true;
      });
    } catch (e) {}
    if (lastState.isSentence && !hasAra &&
        (!lastState.remote.mymemory || lastState.remote.mymemory.status !== "ok")) {
      if (failed.indexOf("mymemory") < 0) failed.push("mymemory");
    }
    /* Dictionary fallback retry: DE empty -> retry EN explicitly. */
    try {
      var deR = lastState.remote.wiktionary, enR = lastState.remote["wiktionary-en"];
      if (deR && deR.status === "empty" && (!enR || enR.status === "error" || enR.status === "empty")) {
        if (failed.indexOf("wiktionary-en") < 0) failed.push("wiktionary-en");
      } else if (enR && (enR.status === "error" || enR.status === "empty") && failed.indexOf("wiktionary") >= 0) {
        if (failed.indexOf("wiktionary-en") < 0) failed.push("wiktionary-en");
      }
    } catch (e) {}
    if (!failed.length) failed = ["wiktionary", "tatoeba", "commons", "openthesaurus"];
    var g = ++gen;
    var retryQuery = q;
    failed.forEach(function (pid) {
      lastState.remote[pid] = { status: "loading", provider: pid };
    });
    try { renderState(box, lastState); } catch (e) {}
    searchAll(q, {
      only: failed,
      prior: lastState,
      onUpdate: function (pid, st) {
        /* Old retry must never overwrite a newer query. */
        if (g !== gen) return;
        try { if ((st && st.query) !== retryQuery) return; } catch (e) {}
        try { if (normQ($("globalSearch").value) !== retryQuery) return; } catch (e) {}
        try { if (!viewAlive()) return; } catch (e) {}
        if (st && st.remote && st.remote[pid] && st.remote[pid].status === "aborted") return;
        lastState = st;
        try { var b = $("searchResults"); if (b) renderState(b, st); } catch (e) {}
      }
    }).then(function (st) {
      if (g !== gen) return;
      try { if ((st && st.query) !== retryQuery) return; } catch (e) {}
      try { if (normQ($("globalSearch").value) !== retryQuery) return; } catch (e) {}
      try { if (!viewAlive()) return; } catch (e) {}
      lastState = st;
      try { var b = $("searchResults"); if (b) renderState(b, st); } catch (e) {}
    });
  }

  var installed = false;
  function installEnhance() {
    if (installed) return true;
    try {
      if (typeof root.document === "undefined") return false;
      if (typeof root.runGlobalSearch !== "function") return false;
      if (root.__dmExtInstalled) { installed = true; return true; }
      var orig = root.runGlobalSearch;
      var wrapped = function () {
        var r = orig.apply(this, arguments);
        try { scheduleEnhance(); } catch (e) {}
        return r;
      };
      try {
        root.runGlobalSearch = wrapped;
      } catch (e) { return false; }
      root.__dmExtInstalled = true;
      installed = true;
      return true;
    } catch (e) { return false; }
  }
  /* install now (script loads after script.js) + retry on DOM ready */
  try { installEnhance(); } catch (e) {}
  try {
    if (root.document) {
      if (root.document.readyState === "loading") {
        root.document.addEventListener("DOMContentLoaded", function () {
          try { installEnhance(); } catch (e) {}
        });
      } else {
        try { installEnhance(); } catch (e) {}
      }
    }
  } catch (e) {}

  /* ================= export ================= */
  var DMSearch = {
    providers: PROVIDERS,
    status: status,
    search: searchAll,
    adapters: ADAPTERS,
    utils: { normQ: normQ, foldDe: foldDe, normSent: normSent, isSentenceQuery: isSentenceQuery,
      allowedUrl: allowedUrl, parseWik: wikParsePlain, parseWikEn: wikEnParseGerman,
      isCommonsCandidate: commonsCandidate, tatoebaAudioPolicy: tatoebaAudioPolicy,
      dictFallbackLinks: dictFallbackLinks, tatPhrase: normTatPhrase, tatFallback: tatFallbackPhrases },
    ui: { enhance: enhance, retry: retryFailed, install: installEnhance, speak: speakDe,
      leave: leaveSearch, cancel: cancelSearch },
    cancel: cancelSearch,
    debug: { coldStats: coldStats, ORDER: ["title", "offline", "loading", "dict-de", "dict-en", "dict-none", "examples", "syn", "pron", "mt", "none", "foot", "errs"] },
    __renderForTest: (typeof renderState !== "undefined" ? renderState : null),
    __setFetch: __setFetch,
    __cacheClear: function () { try { memCache.clear(); inflight.clear(); } catch (e) {} },
    __resetGen: function () { try { searchGen = 0; activeSearch = null; gen = 0; lastState = null; lastQuery = ""; } catch (e) {} }
  };
  try { root.DMSearch = DMSearch; } catch (e) {}
  try {
    if (typeof module !== "undefined" && module && module.exports) module.exports = DMSearch;
  } catch (e) {}
})(typeof window !== "undefined" ? window : globalThis);
