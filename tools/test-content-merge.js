/* Node smoke test: load content packs + dm-lib (+ dm-lazy sample) with browser stubs.
   Core pack list is manifest-driven (files with load != lazy). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const client = path.join(__dirname, "..", "client", "content");

const listeners = {};
const sandbox = {
  console, VOCAB: [], SENTENCES: [], GRAMMAR: [], SENT_FILL: [], CURR_READING: [],
  DMRefEncy: { overlays: {} },
  document: {
    readyState: "loading",
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    createElement() { return { set src(v) {}, }; },
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
  },
  window: {},
  localStorage: { getItem() { return null; }, setItem() {} },
  requestIdleCallback: undefined,
  setTimeout,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
function load(f) {
  const code = fs.readFileSync(path.join(client, f), "utf8");
  vm.runInContext(code, sandbox, { filename: f });
}
const manifest = JSON.parse(fs.readFileSync(path.join(client, "manifest.json"), "utf8"));
const coreFiles = manifest.files.filter((f) => f.load !== "lazy").map((f) => f.runtime.replace("content/", ""));
coreFiles.forEach(load);
load("dm-lib.js");
load("dm-lazy.js");
/* lazy sample: one pack per new kind + one per old kind */
["dm-vocab-03.js", "dm-sent-04.js", "dm-gram-02.js", "dm-dlg-02.js", "dm-read-01.js", "dm-lis-01.js", "dm-exam-01.js", "dm-ex-05.js"].forEach((f) => {
  try { load(f); } catch (e) { console.log("lazy sample missing (ok if counts=0):", f); }
});
try { if (sandbox.window.DM_LIB_MORE) sandbox.window.DM_LIB_MORE.merge(); } catch (e) {}
/* browser order: deferred ex packs run before DOMContentLoaded -> fire it now */
(listeners.DOMContentLoaded || []).forEach((fn) => fn());
console.log("VOCAB:", sandbox.VOCAB.length);
console.log("SENTENCES:", sandbox.SENTENCES.length);
console.log("GRAMMAR:", sandbox.GRAMMAR.length);
console.log("SENT_FILL:", sandbox.SENT_FILL.length);
console.log("CURR_READING:", sandbox.CURR_READING.length);
console.log("DM_DIALOGS:", (sandbox.window.DM_DIALOGS || sandbox.DM_DIALOGS || []).length);
console.log("overlays:", Object.keys(sandbox.DMRefEncy.overlays).length);
const lib = sandbox.window.DM_LIB;
console.log("DM_LIB stats:", JSON.stringify(lib.stats));
// search smoke
const r1 = lib.search("der Mann");
console.log("search 'der Mann':", r1.length, r1.slice(0, 2).map((x) => x.kind + ":" + x.id).join(","));
const r2 = lib.search("الطقس");
console.log("search Arabic:", r2.length);
const r3 = lib.search("lernen", { level: "A1", limit: 5 });
console.log("search lernen A1:", r3.length);
// shape spot checks
const badV = sandbox.VOCAB.filter((w) => !w.de || !w.ar || !w.type || !w.cat);
const badS = sandbox.SENTENCES.filter((s) => !s.de || !s.ar);
const badF = sandbox.SENT_FILL.filter((f) => !f.s || !Array.isArray(f.o) || f.o.length < (f.typ === "truefalse" ? 2 : 3) || f.c < 0 || f.c >= f.o.length);
console.log("malformed vocab/sent/fill:", badV.length, badS.length, badF.length);
// lazy arrays
console.log("DM_READING:", (sandbox.window.DM_READING || []).length);
console.log("DM_LISTENING:", (sandbox.window.DM_LISTENING || []).length);
console.log("DM_EXAMS:", (sandbox.window.DM_EXAMS || []).length);
console.log("DM_LIB_MORE:", sandbox.window.DM_LIB_MORE ? "present packs=" + sandbox.window.DM_LIB_MORE.lazyTotal : "MISSING");
// manifest count cross-check (core + lazy sample loaded)
const manCounts = {};
manifest.files.forEach((f) => { manCounts[f.kind] = (manCounts[f.kind] || 0) + f.count; });
console.log("manifest counts:", JSON.stringify(manCounts));
const more = sandbox.window.DM_LIB_MORE;
if (more && more.searchAll) {
  const sr = more.searchAll("lernen", { limit: 5 });
  console.log("searchAll lernen:", sr.length);
}
// SENT_FILL kind distribution
const kinds = {};
sandbox.SENT_FILL.forEach((f) => { kinds[f.kind || "?"] = (kinds[f.kind || "?"] || 0) + 1; });
console.log("fill kinds:", JSON.stringify(kinds));
// order-kind items must exist for smart orders
const orders = sandbox.SENT_FILL.filter((f) => f.kind === "order").length;
const fills = sandbox.SENT_FILL.filter((f) => (!f.kind || f.kind === "fill") && /___/.test(f.s)).length;
console.log("smart-compatible fills/order:", fills, orders);
if (badV.length || badS.length || badF.length) process.exit(1);
console.log("SMOKE OK");
