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
    return foldDe(s).replace(/[\u00a1\u00bf.?!\u2026\u060c\u061f\u061b;:,()"«»„“”'']/g, "").replace(/\s+/g, " ").trim();
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

  function fetchJson(url, timeoutMs) {
    if (!allowedUrl(url)) return Promise.resolve({ ok: false, error: "blocked-host" });
    if (!httpFetch) return Promise.resolve({ ok: false, error: "no-fetch" });
    var ctrl = null, timer = 0;
    try {
      if (typeof root.AbortController === "function") ctrl = new root.AbortController();
    } catch (e) { ctrl = null; }
    var opts = { method: "GET", credentials: "omit", redirect: "follow" };
    if (ctrl) { opts.signal = ctrl.signal; }
    var ms = timeoutMs || TIMEOUT_MS;
    var p = null;
    try {
      p = httpFetch(url, opts).then(function (res) {
        try { if (timer) clearTimeout(timer); } catch (e) {}
        if (!res || typeof res.json !== "function") return { ok: false, error: "http-bad-response" };
        if (res.status === 429) return { ok: false, error: "rate-limited" };
        if (res.status < 200 || res.status >= 300) return { ok: false, error: "http-" + res.status };
        return res.json().then(
          function (j) { return { ok: true, data: j }; },
          function () { return { ok: false, error: "bad-json" }; });
      }, function (err) {
        try { if (timer) clearTimeout(timer); } catch (e) {}
        var n = ""; try { n = err && err.name; } catch (e2) {}
        if (n === "AbortError") return { ok: false, error: "timeout" };
        if (typeof root !== "undefined" && root.navigator && root.navigator.onLine === false) {
          return { ok: false, error: "offline" };
        }
        return { ok: false, error: "network" };
      });
    } catch (e) { return Promise.resolve({ ok: false, error: "network" }); }
    if (ctrl) {
      try {
        timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms);
      } catch (e) {}
    }
    /* Hard timeout race: if fetch never settles AND abort is unsupported. */
    var kill = new Promise(function (res) {
      setTimeout(function () { res({ ok: false, error: "timeout" }); }, ms + 1500);
    });
    return Promise.race([p, kill]).then(function (r) {
      try { if (timer) clearTimeout(timer); } catch (e) {}
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
  function cachedFetch(pid, query, worker) {
    var k = pid + "|||" + query;
    var hit = cacheGet(k);
    if (hit) return Promise.resolve(hit);
    if (inflight.has(k)) return inflight.get(k);
    var p = Promise.resolve().then(worker).then(function (r) {
      try { inflight.delete(k); } catch (e) {}
      if (r && (r.status === "ok" || r.status === "empty")) cacheSet(k, r);
      return r;
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
        var ql = foldDe(q), out2 = [];
        for (var i = 0; i < rows.length && out2.length < 4; i++) {
          try {
            var r = rows[i];
            if (r && r.nde && r.nde.indexOf(ql) >= 0 && r.s) {
              out2.push({ de: sstr(r.s.de), ar: sstr(r.s.ar || ""), kap: sstr(r.s.kap || "") });
            }
          } catch (e2) {}
        }
        if (out2.length) out.sentences = out2;
      }
      if (!out.sentences.length && root.SENTENCES && root.SENTENCES.length) {
        var qx = foldDe(q), tmp = [];
        for (var j = 0; j < root.SENTENCES.length && tmp.length < 4; j++) {
          try {
            var s = root.SENTENCES[j];
            if (s && foldDe(sstr(s.de) + " " + sstr(s.ar)).indexOf(qx) >= 0) {
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
  function wiktionarySearch(query) {
    var q = normQ(query);
    if (!q || /\s{2,}/.test(q) === false && q.split(" ").length > 6) {
      /* long phrases: still try, MediaWiki handles them; no special-casing */
    }
    if (!q) return Promise.resolve({ status: "empty", provider: "wiktionary" });
    return cachedFetch("wiktionary", q, function () {
      var u1 = WIK + "?action=query&list=search&srsearch=" + encodeURIComponent(q) +
        "&srlimit=5&srnamespace=0&format=json&origin=*";
      return fetchJson(u1).then(function (r1) {
        if (!r1.ok) return { status: "error", provider: "wiktionary", error: r1.error };
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
        return fetchJson(u2).then(function (r2) {
          if (!r2.ok) return { status: "error", provider: "wiktionary", error: r2.error };
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
    });
  }

  /* ================= provider: Tatoeba ================= */
  var TAT = "https://api.tatoeba.org/v1/sentences";
  function tatoebaSearch(query) {
    var q = normQ(query);
    if (!q) return Promise.resolve({ status: "empty", provider: "tatoeba" });
    return cachedFetch("tatoeba", q, function () {
      var u = TAT + "?lang=deu&q=" + encodeURIComponent(q) +
        "&limit=6&sort=relevance&showtrans=all&include=audios";
      return fetchJson(u).then(function (r) {
        if (!r.ok) return { status: "error", provider: "tatoeba", error: r.error };
        var arr = [];
        try { arr = r.data.data || []; } catch (e) { arr = []; }
        if (!arr.length) return { status: "empty", provider: "tatoeba" };
        var qn = normSent(q);
        var items = arr.slice(0, 6).map(function (s) {
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
              if (a && a.id) aud.push({ id: a.id, url: "https://api.tatoeba.org/v1/audios/" + a.id + "/file" });
            });
          } catch (e) {}
          return { id: s.id, text: txt, match: (normSent(txt) === qn && qn ? "exact" : "similar"),
            owner: sstr(s.owner || ""), license: sstr(s.license || ""),
            url: "https://tatoeba.org/en/sentences/show/" + s.id,
            ara: ara, eng: eng, audio: aud };
        });
        return { status: "ok", provider: "tatoeba", items: items };
      });
    });
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
  function commonsSearch(query) {
    var q = normQ(query);
    if (!q || /\s/.test(q) || q.length > 40) {
      /* Pronunciation files are per-word; sentences use TTS fallback. */
      return Promise.resolve({ status: "empty", provider: "commons" });
    }
    return cachedFetch("commons", q, function () {
      /* allimages+aiprefix = deterministic filename-prefix lookup (one call
         carries url + license metadata). list=search is NOT used: CirrusSearch
         full-text does not honour the "File:De-<word>" prefix. */
      var u = COM + "?action=query&list=allimages&aiprefix=" + encodeURIComponent("De-" + q) +
        "&ailimit=8&aiprop=url%7Cextmetadata&format=json&origin=*";
      return fetchJson(u).then(function (r) {
        if (!r.ok) return { status: "error", provider: "commons", error: r.error };
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
    });
  }

  /* ================= provider: OpenThesaurus ================= */
  function openthesaurusSearch(query) {
    var q = normQ(query);
    if (!q || /\s/.test(q) || q.length > 40) return Promise.resolve({ status: "empty", provider: "openthesaurus" });
    return cachedFetch("openthesaurus", q, function () {
      var u = "https://www.openthesaurus.de/synonyme/search?q=" + encodeURIComponent(q) + "&format=application/json";
      return fetchJson(u).then(function (r) {
        if (!r.ok) return { status: "error", provider: "openthesaurus", error: r.error };
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
    });
  }

  /* ================= provider: MyMemory (MT fallback) ================= */
  var MM_BAD = /MYMEMORY WARNING|INVALID (EMAIL|TARGET LANGUAGE)|QUERY LENGTH LIMIT|NO QUERY SPECIFIED/i;
  function mymemorySearch(deText) {
    var q = normQ(deText);
    if (!q || q.length > 500) return Promise.resolve({ status: "empty", provider: "mymemory" });
    return cachedFetch("mymemory", q, function () {
      var u = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(q) + "&langpair=de|ar";
      return fetchJson(u).then(function (r) {
        if (!r.ok) return { status: "error", provider: "mymemory", error: r.error };
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
    });
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
  /* Run local sync + remotes concurrently; onUpdate(pid) after each settles.
   * opts: { only:[ids], prior:{}, needMT:bool, mtText:string, onUpdate:fn } */
  function searchAll(query, opts) {
    opts = opts || {};
    var q = normQ(query);
    var state = { query: q, isSentence: isSentenceQuery(q), offline: isOffline(), local: null, remote: {} };
    if (opts.prior && opts.prior.remote) {
      Object.keys(opts.prior.remote).forEach(function (k) { state.remote[k] = opts.prior.remote[k]; });
    }
    var jobs = [];
    function runPid(pid) {
      if (opts.only && opts.only.indexOf(pid) < 0) return;
      if (state.remote[pid] && state.remote[pid].status === "ok") return; /* keep successes on retry */
      state.remote[pid] = { status: "loading", provider: pid };
      var p = Promise.resolve()
        .then(function () { return ADAPTERS[pid](q); })
        .then(function (r) {
          state.remote[pid] = r || { status: "error", provider: pid, error: "bad-result" };
          try { if (typeof opts.onUpdate === "function") opts.onUpdate(pid, state); } catch (e) {}
          return state.remote[pid];
        }, function () {
          state.remote[pid] = { status: "error", provider: pid, error: "exception" };
          try { if (typeof opts.onUpdate === "function") opts.onUpdate(pid, state); } catch (e) {}
          return state.remote[pid];
        });
      jobs.push(p);
    }
    /* Local first (sync), then remotes concurrently. */
    try {
      state.local = null;
      return Promise.resolve().then(function () { return ADAPTERS.local(q); }).then(function (lr) {
        state.local = lr;
        try { if (typeof opts.onUpdate === "function") opts.onUpdate("local", state); } catch (e) {}
        if (!q) return state;
        if (state.offline) {
          REMOTE_ORDER.forEach(function (pid) {
            if (!state.remote[pid]) state.remote[pid] = { status: "error", provider: pid, error: "offline" };
          });
          return state;
        }
        REMOTE_ORDER.forEach(runPid);
        return Promise.all(jobs).then(function () {
          /* MT fallback: sentence-like query with no human Arabic anywhere. */
          var hasAra = false;
          try {
            (state.local.sentences || []).forEach(function (s) { if (sstr(s.ar).trim()) hasAra = true; });
            Object.keys(state.remote).forEach(function (k) {
              ((((state.remote[k] || {}).items) || [])).forEach(function (it) {
                if (it && it.ara && it.ara.length) hasAra = true;
              });
            });
          } catch (e) {}
          var wantMT = opts.needMT !== false && state.isSentence && !hasAra && !state.remote.mymemory;
          if (wantMT && !isOffline()) {
            state.remote.mymemory = { status: "loading", provider: "mymemory" };
            return Promise.resolve().then(function () { return ADAPTERS.mymemory(q); }).then(function (mr) {
              state.remote.mymemory = mr;
              try { if (typeof opts.onUpdate === "function") opts.onUpdate("mymemory", state); } catch (e) {}
              return state;
            }, function () {
              state.remote.mymemory = { status: "error", provider: "mymemory", error: "exception" };
              return state;
            });
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
      dm_ext_human: "تسجيل بشري", dm_ext_verified: "محتوى مُدقق من المصدر", dm_ext_open: "فتح المصدر" },
    en: { dm_ext_title: "Extended results from German sources", dm_ext_loading: "Fetching extra results…",
      dm_ext_meaning: "Meaning & grammar", dm_ext_examples: "Real examples", dm_ext_syn: "Synonyms & related",
      dm_ext_pron: "Pronunciation", dm_ext_trans: "Arabic translation", dm_ext_machine: "Machine translation — unverified",
      dm_ext_exact: "exact", dm_ext_similar: "similar", dm_ext_retry: "Retry",
      dm_ext_offline: "You are offline — local results only.", dm_ext_none: "No extra results for this query.",
      dm_ext_sources: "Sources", dm_ext_listen: "Listen", dm_ext_tts: "Synthetic voice 🇩🇪",
      dm_ext_save: "☆ Save", dm_ext_noaudio: "No human recording — use synthetic voice.",
      dm_ext_ar_missing: "No verified Arabic translation found.", dm_ext_fail: "This source is unreachable.",
      dm_ext_human: "Human recording", dm_ext_verified: "Verified source content", dm_ext_open: "Open source" },
    de: { dm_ext_title: "Erweiterte Ergebnisse aus deutschen Quellen", dm_ext_loading: "Zusätzliche Ergebnisse werden geladen…",
      dm_ext_meaning: "Bedeutung & Grammatik", dm_ext_examples: "Echte Beispiele", dm_ext_syn: "Synonyme & Verwandtes",
      dm_ext_pron: "Aussprache", dm_ext_trans: "Arabische Übersetzung", dm_ext_machine: "Maschinelle Übersetzung — ungeprüft",
      dm_ext_exact: "exakt", dm_ext_similar: "ähnlich", dm_ext_retry: "Wiederholen",
      dm_ext_offline: "Du bist offline — nur lokale Ergebnisse.", dm_ext_none: "Keine zusätzlichen Ergebnisse.",
      dm_ext_sources: "Quellen", dm_ext_listen: "Anhören", dm_ext_tts: "Synthetische Stimme 🇩🇪",
      dm_ext_save: "☆ Speichern", dm_ext_noaudio: "Keine menschliche Aufnahme — synthetische Stimme nutzen.",
      dm_ext_ar_missing: "Keine geprüfte arabische Übersetzung gefunden.", dm_ext_fail: "Diese Quelle ist nicht erreichbar.",
      dm_ext_human: "Menschliche Aufnahme", dm_ext_verified: "Geprüfter Quelleninhalt", dm_ext_open: "Quelle öffnen" }
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
  function renderState(box, state) {
    var q = state.query;
    var wrap = $("dmExt");
    if (!wrap) {
      wrap = el("div", "dm-ext");
      wrap.id = "dmExt";
      try { box.appendChild(wrap); } catch (e) { return; }
    }
    wrap.innerHTML = "";
    wrap.appendChild(el("div", "dm-ext-title", "🌐 " + T("dm_ext_title")));
    var anyOk = false, anyLoading = false, fails = [];
    Object.keys(state.remote).forEach(function (pid) {
      var r = state.remote[pid];
      if (!r) return;
      if (r.status === "ok") anyOk = true;
      if (r.status === "loading") anyLoading = true;
      if (r.status === "error") fails.push(pid);
    });
    if (state.offline) {
      var off = el("div", "dm-ext-note", "📴 " + T("dm_ext_offline"));
      wrap.appendChild(off);
    }
    if (anyLoading && !anyOk) {
      wrap.appendChild(el("div", "dm-ext-note dm-loading", "⏳ " + T("dm_ext_loading")));
    }
    /* --- meaning / grammar (Wiktionary) --- */
    var wik = state.remote.wiktionary;
    if (wik && wik.status === "ok") {
      var sec = el("div", "dm-ext-sec");
      var h = el("div", "dm-ext-h");
      h.appendChild(el("span", "", "📖 " + T("dm_ext_meaning") + " · "));
      h.appendChild(srcBadge("Wiktionary"));
      h.appendChild(matchBadge(wik.match || "similar"));
      sec.appendChild(h);
      if (wik.grammar && (wik.grammar.pos || wik.grammar.gender || wik.grammar.plural || wik.grammar.ipa)) {
        var g = [];
        if (wik.grammar.gender) g.push(wik.grammar.gender);
        if (wik.grammar.pos) g.push(wik.grammar.pos);
        if (wik.grammar.plural) g.push("Pl. " + wik.grammar.plural);
        if (wik.grammar.ipa) g.push("[" + wik.grammar.ipa + "]");
        sec.appendChild(el("div", "dm-ext-gram", g.join(" · ")));
      }
      wik.senses.slice(0, 8).forEach(function (sn) {
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
      wrap.appendChild(sec);
    }
    /* --- examples (Tatoeba) --- */
    var tat = state.remote.tatoeba;
    if (tat && tat.status === "ok" && tat.items && tat.items.length) {
      var s2 = el("div", "dm-ext-sec");
      var h2 = el("div", "dm-ext-h");
      h2.appendChild(el("span", "", "💬 " + T("dm_ext_examples") + " · "));
      h2.appendChild(srcBadge("Tatoeba"));
      s2.appendChild(h2);
      tat.items.slice(0, 6).forEach(function (it) {
        var card = el("div", "dm-ext-sent");
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
        if (it.audio && it.audio.length) {
          it.audio.slice(0, 1).forEach(function (a) {
            try {
              var au = root.document.createElement("audio");
              au.controls = true; au.preload = "none"; au.src = a.url;
              au.className = "dm-ext-audio";
              au.addEventListener("error", function () {
                try {
                  var nt = el("div", "dm-ext-note", "⚠️ " + T("dm_ext_noaudio"));
                  au.replaceWith(nt);
                } catch (e) {}
              });
              card.appendChild(au);
              var lb = el("div", "dm-ext-meta");
              lb.appendChild(el("span", "", "🎙️ " + T("dm_ext_human") + " "));
              card.appendChild(lb);
            } catch (e) {}
          });
        }
        var row = el("div", "row-flex");
        var tb = el("button", "mini-btn", "🔊 " + T("dm_ext_tts"));
        tb.addEventListener("click", function (ev) { try { ev.stopPropagation(); speakDe(it.text); } catch (e) {} });
        row.appendChild(tb);
        card.appendChild(row);
        s2.appendChild(card);
      });
      wrap.appendChild(s2);
    }
    /* --- synonyms (OpenThesaurus) --- */
    var ot = state.remote.openthesaurus;
    if (ot && ot.status === "ok" && ot.terms && ot.terms.length) {
      var s3 = el("div", "dm-ext-sec");
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
      wrap.appendChild(s3);
    }
    /* --- pronunciation (Commons + TTS fallback) --- */
    var com = state.remote.commons;
    var s4 = el("div", "dm-ext-sec");
    var h4 = el("div", "dm-ext-h");
    h4.appendChild(el("span", "", "🎧 " + T("dm_ext_pron") + " · "));
    h4.appendChild(srcBadge("Commons"));
    s4.appendChild(h4);
    var hasHuman = false;
    if (com && com.status === "ok" && com.items && com.items.length) {
      com.items.slice(0, 3).forEach(function (a) {
        hasHuman = true;
        var row = el("div", "dm-ext-prow");
        try {
          var au2 = root.document.createElement("audio");
          au2.controls = true; au2.preload = "none"; au2.src = a.url;
          au2.className = "dm-ext-audio";
          au2.addEventListener("error", function () {
            try { au2.replaceWith(el("div", "dm-ext-note", "⚠️ " + T("dm_ext_noaudio"))); } catch (e) {}
          });
          row.appendChild(au2);
        } catch (e) {}
        var cap = el("div", "dm-ext-meta");
        cap.appendChild(el("span", "", "🎙️ " + T("dm_ext_human") + " · " + (a.artist || "?") + " · " + (a.license || "") + " "));
        cap.appendChild(link(a.pageUrl, T("dm_ext_open")));
        row.appendChild(cap);
        s4.appendChild(row);
      });
    }
    var ttsRow = el("div", "row-flex");
    var tts = el("button", "mini-btn", "🔊 " + T("dm_ext_tts"));
    tts.addEventListener("click", function (ev) { try { ev.stopPropagation(); speakDe(q); } catch (e) {} });
    ttsRow.appendChild(tts);
    if (!hasHuman && !(com && com.status === "loading")) {
      ttsRow.appendChild(el("span", "muted", T("dm_ext_noaudio")));
    }
    s4.appendChild(ttsRow);
    if ((com && com.status === "ok") || !(com && com.status === "error" && !anyOk)) {
      /* Show pronunciation section when useful; hide only if it failed AND nothing else worked. */
      if (hasHuman || !(tat && tat.status === "ok") || true) wrap.appendChild(s4);
    } else if (hasHuman) { wrap.appendChild(s4); }
    /* --- MT fallback (MyMemory) --- */
    var mm = state.remote.mymemory;
    if (mm && (mm.status === "ok" || mm.status === "loading")) {
      var s5 = el("div", "dm-ext-sec");
      var h5 = el("div", "dm-ext-h");
      h5.appendChild(el("span", "", "🌍 " + T("dm_ext_trans") + " · "));
      h5.appendChild(srcBadge("MyMemory"));
      s5.appendChild(h5);
      if (mm.status === "ok") {
        var mb = el("span", "dm-badge dm-mt", "🤖 " + T("dm_ext_machine"));
        s5.appendChild(mb);
        s5.appendChild(el("div", "dm-ext-ar", "🇸🇦 " + mm.text));
      } else {
        s5.appendChild(el("div", "dm-ext-note dm-loading", "⏳ " + T("dm_ext_loading")));
      }
      wrap.appendChild(s5);
    }
    /* --- failures / empty / retry --- */
    var showRetry = fails.length > 0;
    if (!anyOk && !anyLoading) {
      if (!state.offline) wrap.appendChild(el("div", "dm-ext-note", "ℹ️ " + T("dm_ext_none")));
      showRetry = true;
    }
    var foot = el("div", "dm-ext-foot dm-ext-srcs");
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
    wrap.appendChild(foot);
    /* provider errors are accessory facts (failed source ≠ missing word) */
    if (fails.length && anyOk) {
      var ef = el("div", "dm-ext-errs");
      ef.appendChild(el("span", "muted", "⚠️ " + fails.join(", ") + ": " + T("dm_ext_fail")));
      wrap.appendChild(ef);
    }
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
  function enhance(myGen) {
    var box = $("searchResults");
    if (!box) return;
    var q = currentQuery();
    if (!q) { lastQuery = ""; return; }
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
      return false;
    };
    searchAll(q, {
      onUpdate: function (pid, st) {
        if (stale()) return;
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
  function retryFailed() {
    var box = $("searchResults");
    if (!box || !lastState) return;
    var q = lastState.query || currentQuery();
    if (!q) return;
    var failed = Object.keys(lastState.remote).filter(function (k) {
      var r = lastState.remote[k];
      return r && (r.status === "error" || r.status === "empty") && k !== "mymemory";
    });
    /* MT retry: if sentence still lacks Arabic, include mymemory explicitly. */
    var hasAra = false;
    try {
      Object.keys(lastState.remote).forEach(function (k) {
        (((lastState.remote[k] || {}).items) || []).forEach(function (it) {
          if (it && it.ara && it.ara.length) hasAra = true;
        });
      });
    } catch (e) {}
    if (lastState.isSentence && !hasAra &&
        (!lastState.remote.mymemory || lastState.remote.mymemory.status !== "ok")) {
      failed.push("mymemory");
    }
    if (!failed.length) failed = ["wiktionary", "tatoeba", "commons", "openthesaurus"];
    var g = ++gen;
    failed.forEach(function (pid) {
      lastState.remote[pid] = { status: "loading", provider: pid };
    });
    try { renderState(box, lastState); } catch (e) {}
    searchAll(q, {
      only: failed,
      prior: lastState,
      onUpdate: function (pid, st) {
        if (g !== gen) return;
        lastState = st;
        try { var b = $("searchResults"); if (b) renderState(b, st); } catch (e) {}
      }
    }).then(function (st) {
      if (g !== gen) return;
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
      allowedUrl: allowedUrl, parseWik: wikParsePlain, isCommonsCandidate: commonsCandidate },
    ui: { enhance: enhance, retry: retryFailed, install: installEnhance, speak: speakDe },
    __setFetch: __setFetch,
    __cacheClear: function () { try { memCache.clear(); inflight.clear(); } catch (e) {} }
  };
  try { root.DMSearch = DMSearch; } catch (e) {}
  try {
    if (typeof module !== "undefined" && module && module.exports) module.exports = DMSearch;
  } catch (e) {}
})(typeof window !== "undefined" ? window : globalThis);
