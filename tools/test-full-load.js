"use strict";
/* Deutsch Master — Full-pack load test (Phase 6: pack loading + merge correctness).
 * Simulates the browser boot in Node with stub DOM: loads sync packs +
 * dm-lib + dm-lazy, then pulls FULL vocab/sent kinds via loadKindProgress
 * (the on-demand path the vocab/sentences views now use) and asserts the
 * complete valid dataset lands in the live banks and is searchable.
 * Run: node tools/test-full-load.js   (exit 1 on failure)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");

let pass = 0, fail = 0;
function ok(c, name, extra) {
  if (c) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? " :: " + extra : "")); }
}

// ---- stub browser env ----
const pendingScripts = [];
const sandbox = {
  console,
  navigator: {},
  performance: { now: () => Date.now() },
  requestIdleCallback: undefined,
  setTimeout, clearTimeout, setInterval, clearInterval,
  CustomEvent: function (t, o) { this.type = t; this.detail = (o && o.detail) || {}; },
  Event: function (t) { this.type = t; },
};
sandbox.window = sandbox;
sandbox.document = {
  hidden: false,
  readyState: "complete",
  head: { appendChild(el) { pendingScripts.push(el); flushScripts(); } },
  documentElement: { appendChild(el) { pendingScripts.push(el); flushScripts(); } },
  createElement(tag) {
    if (tag !== "script") return {};
    return {
      _src: "",
      set src(v) {
        this._src = v;
        // resolve relative to client/ like the browser page does
        const p = path.join(ROOT, "client", v);
        this._exists = fs.existsSync(p);
        this._path = p;
      },
      get src() { return this._src; },
      onload: null, onerror: null,
    };
  },
  addEventListener() {},
  querySelector() { return null; },
  getElementById() { return null; },
};
sandbox.window.dispatchEvent = function () {};
sandbox.window.addEventListener = function () {};
function flushScripts() {
  while (pendingScripts.length) {
    const el = pendingScripts.shift();
    try {
      if (!el._exists) { if (el.onerror) el.onerror(); continue; }
      const code = fs.readFileSync(el._path, "utf8");
      vm.runInContext(code, ctx, { filename: el._path });
      if (el.onload) el.onload();
    } catch (e) {
      console.log("  script error " + el._src + " :: " + String(e.message).slice(0, 160));
      if (el.onerror) el.onerror();
    }
  }
}
const ctx = vm.createContext(sandbox);
function loadClient(rel) {
  const code = fs.readFileSync(path.join(ROOT, "client", rel), "utf8");
  vm.runInContext(code, ctx, { filename: rel });
}

(async function () {
  // expectations from the manifest (authoritative declarations, verified by
  // tools/content-inventory-audit.js against real src/runtime/cache rows)
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "client", "content", "manifest.json"), "utf8"));
  const EXP_VOCAB = manifest.counts.vocab;
  const EXP_SENT = manifest.counts.sent;
  const filesFor = (kind) => manifest.files.filter((f) => f.kind === kind);
  const lazyCount = (kind) => filesFor(kind).filter((f) => f.load === "lazy").length;
  const syncCount = (kind) => filesFor(kind).filter((f) => f.load === "sync").reduce((a, f) => a + f.count, 0);
  // base banks (as script.js declares them; empty here = pure library measurement)
  vm.runInContext("var VOCAB=[],SENTENCES=[],GRAMMAR=[],SENT_FILL=[],CURR_READING=[];", ctx);
  // boot order mirrors client/index.html sync scripts
  ["content/dm-vocab-01.js", "content/dm-vocab-02.js",
   "content/dm-sent-01.js", "content/dm-sent-02.js", "content/dm-sent-03.js",
   "content/dm-gram-01.js", "content/dm-dlg-01.js",
   "content/dm-lib.js", "content/dm-lazy.js"].forEach(loadClient);

  const bootV = vm.runInContext("VOCAB.length", ctx);
  const bootS = vm.runInContext("SENTENCES.length", ctx);
  ok(bootV === syncCount("vocab"), "boot vocab sync subset = " + syncCount("vocab"), "got " + bootV);
  ok(bootS === syncCount("sent"), "boot sentences sync subset = " + syncCount("sent"), "got " + bootS);
  ok(vm.runInContext("DM_LIB_MORE.kindLoaded('vocab')", ctx) === false, "vocab kindLoaded false at boot");
  ok(vm.runInContext("DM_LIB_MORE.kindLoaded('sent')", ctx) === false, "sent kindLoaded false at boot");

  // on-demand full vocab (what renderVocab now triggers)
  let vProg = [];
  sandbox.__vprog = (d, t) => vProg.push(d + "/" + t);
  await vm.runInContext(`DM_LIB_MORE.loadKindProgress('vocab', function(d,t){__vprog(d,t);})`, ctx);
  const fullV = vm.runInContext("VOCAB.length", ctx);
  ok(fullV === EXP_VOCAB, "full vocab after loadKind = " + EXP_VOCAB, "got " + fullV);
  ok(vm.runInContext("DM_LIB_MORE.kindLoaded('vocab')", ctx) === true, "vocab kindLoaded true after load");
  ok(vProg.length === lazyCount("vocab"), "vocab progress ticks = " + lazyCount("vocab") + " lazy packs", "got " + vProg.length);

  // on-demand full sentences (what sentA1Render now triggers)
  let sProg = 0;
  sandbox.__sprog = () => { sProg++; };
  await vm.runInContext(`DM_LIB_MORE.loadKindProgress('sent', function(){__sprog();})`, ctx);
  const fullS = vm.runInContext("SENTENCES.length", ctx);
  ok(fullS === EXP_SENT, "full sentences after loadKind = " + EXP_SENT, "got " + fullS);
  ok(vm.runInContext("DM_LIB_MORE.kindLoaded('sent')", ctx) === true, "sent kindLoaded true after load");
  ok(sProg === lazyCount("sent"), "sent progress ticks = " + lazyCount("sent") + " lazy packs", "got " + sProg);

  // idempotent re-entry (no dup merges, same promise)
  await vm.runInContext(`DM_LIB_MORE.loadKindProgress('vocab')`, ctx);
  ok(vm.runInContext("VOCAB.length", ctx) === EXP_VOCAB, "vocab stable on re-load (no dupes)");
  await vm.runInContext(`DM_LIB_MORE.loadKindProgress('sent')`, ctx);
  ok(vm.runInContext("SENTENCES.length", ctx) === EXP_SENT, "sentences stable on re-load (no dupes)");

  // uniqueness + searchability across ALL packs
  const vIds = vm.runInContext("new Set(VOCAB.map(w=>w.id)).size", ctx);
  ok(vIds === EXP_VOCAB, "vocab ids unique across packs", "got " + vIds);
  const sIds = vm.runInContext("new Set(SENTENCES.map(s=>s.id)).size", ctx);
  ok(sIds === EXP_SENT, "sentence ids unique across packs", "got " + sIds);
  const deepWord = vm.runInContext(`VOCAB.some(w=>w.id==='lv30000')`, ctx);
  ok(deepWord === true, "deep lazy vocab searchable in live bank (lv30000)");
  const newWord = vm.runInContext(`VOCAB.some(w=>w.id==='lv100000')`, ctx);
  ok(newWord === true, "new-range vocab visible in live bank (lv100000)");
  const deepSent = vm.runInContext(`SENTENCES.some(s=>s.id==='ls149999')`, ctx);
  ok(deepSent === true, "deep lazy sentence visible in live bank (ls149999)");
  const libSearch = vm.runInContext(`DM_LIB.search('Frau',{limit:5}).length>0`, ctx);
  ok(libSearch === true, "DM_LIB.search works after full load");

  console.log(`\n==== FULL-LOAD RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FATAL " + (e && e.stack || e)); process.exit(1); });
