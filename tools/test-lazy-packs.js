/* Hardening verification: lazy packs load on demand, merge safely, and the
   idle-prefetch respects saveData/slow connections. Runs in node with
   minimal browser stubs. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const contentDir = path.join(__dirname, "..", "client", "content");

function makeSandbox(conn) {
  const scripts = [];
  const sb = {
    window: {},
    document: {
      readyState: "complete",
      hidden: false,
      createElement: () => {
        const el = { onload: null, onerror: null };
        Object.defineProperty(el, "src", { set(v) { scripts.push(v); }, get() { return ""; } });
        return el;
      },
      head: { appendChild: (el) => { setImmediate(() => { try { if (el.onload) el.onload(); } catch (e) {} }); } },
      documentElement: { appendChild: () => {} },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    navigator: conn ? { connection: conn } : {},
    setTimeout: (fn) => { sb.__timers.push(fn); return 0; },
    addEventListener: undefined,
  };
  sb.__timers = [];
  sb.window = sb;
  sb.dispatchEvent = () => {};
  sb.Event = function (t) { this.type = t; };
  // core globals the merger extends
  sb.VOCAB = []; sb.SENTENCES = []; sb.GRAMMAR = []; sb.SENT_FILL = [];
  return { sb, scripts };
}
function loadPackFile(sb, file) {
  const code = fs.readFileSync(path.join(contentDir, file), "utf8");
  vm.runInContext(code, vm.createContext(sb), { filename: file });
}
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? " :: " + x : "")); } };

// 1. guards present in generated dm-lazy.js
const lazySrc = fs.readFileSync(path.join(contentDir, "dm-lazy.js"), "utf8");
ok("lazy:saveData-guard", /saveData/.test(lazySrc));
ok("lazy:slow-conn-guard", /slow-2g/.test(lazySrc) && /"2g"/.test(lazySrc));
ok("lazy:8MB-budget", /8 \* 1024 \* 1024/.test(lazySrc));
ok("lazy:ex-never-idle", /p\.kind !== "ex"/.test(lazySrc));
ok("lazy:loadPack-API", /loadPack = function/.test(lazySrc));
ok("lazy:loadKind-API", /loadKind = function/.test(lazySrc));

// 2. representative lazy packs load on demand and merge (normal connection)
async function scenario(conn) {
  const { sb, scripts } = makeSandbox(conn);
  loadPackFile(sb, "dm-vocab-01.js"); // core-style chunk into __dmLibChunks (ignored by lazy merger)
  loadPackFile(sb, "dm-lazy.js");
  // run scheduled timers, then flush the sequential prefetch chain
  sb.__timers.forEach((fn) => { try { fn(); } catch (e) {} });
  for (let k = 0; k < 40; k++) await new Promise((r) => setImmediate(r));
  const label = !conn ? "normal" : conn.saveData ? "saveData" : conn.effectiveType;
  const fetched = scripts.length;
  if (!conn || conn.effectiveType === "4g") {
    ok("prefetch-runs:" + label, fetched > 0, "fetched=" + fetched);
    if (!conn) {
      const exFetched = scripts.filter((f) => /dm-ex-/.test(f)).length;
      ok("prefetch-never-ex", exFetched === 0, "ex=" + exFetched);
    }
  } else {
    ok("prefetch-skipped:" + label, fetched === 0, "fetched=" + fetched);
  }
  // on-demand: load one pack of each lazy kind straight from disk (simulates loaded script)
  if (!conn) {
    for (const f of ["dm-vocab-03.js", "dm-sent-04.js", "dm-gram-02.js", "dm-ex-05.js", "dm-dlg-02.js", "dm-read-01.js", "dm-lis-01.js", "dm-exam-01.js"]) {
      loadPackFile(sb, f);
    }
    sb.DM_LIB_MORE.merge();
    ok("merge:vocab", sb.VOCAB.length > 0, "n=" + sb.VOCAB.length);
    ok("merge:sentences", sb.SENTENCES.length > 0, "n=" + sb.SENTENCES.length);
    ok("merge:exercises", sb.SENT_FILL.length > 0, "n=" + sb.SENT_FILL.length);
    ok("merge:dialogues", (sb.DM_DIALOGS || []).length > 0);
    ok("merge:reading", (sb.DM_READING || []).length > 0);
    ok("merge:listening", (sb.DM_LISTENING || []).length > 0);
    ok("merge:exams", (sb.DM_EXAMS || []).length > 0);
    // malformed records do not crash the interface
    sb.__dmLazyChunks = {
      vocab: [[["bad"]]], sent: [[["x", 42]]], gram: [[null]], ex: [[null]],
      dlg: [[null]], read: [[[null]]], lis: [[[null]]], exam: [[null]],
    };
    try { sb.DM_LIB_MORE.merge(); ok("merge:malformed-safe", true); }
    catch (e) { ok("merge:malformed-safe", false, e.message); }
    // existing user data intact (merger must not wipe globals)
    sb.VOCAB.push({ id: "user-word", de: "Testwort" });
    sb.DM_LIB_MORE.merge();
    ok("merge:progress-intact", sb.VOCAB.some((w) => w.id === "user-word"));
    // search across lazy rows
    try {
      const hits = sb.DM_LIB_MORE.searchAll("der Mann", { limit: 5 });
      ok("searchAll:works", Array.isArray(hits), "n=" + (hits && hits.length));
    } catch (e) { ok("searchAll:works", false, e.message); }
  }
}
(async () => {
  for (const conn of [undefined, { saveData: true }, { effectiveType: "2g" }, { effectiveType: "4g" }]) {
    await scenario(conn);
  }
  console.log("\n==== LAZY RESULT: " + pass + " passed, " + fail + " failed ====");
  process.exit(fail ? 1 : 0);
})();
