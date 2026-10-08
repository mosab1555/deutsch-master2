/* Node smoke test: load content packs + dm-lib with browser stubs. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const client = path.join(__dirname, "..", "client", "content");

const listeners = {};
const sandbox = {
  console, VOCAB: [], SENTENCES: [], GRAMMAR: [], SENT_FILL: [], CURR_READING: [],
  DMRefEncy: { overlays: {} },
  document: { readyState: "loading", addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); } },
  window: {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
function load(f) {
  const code = fs.readFileSync(path.join(client, f), "utf8");
  vm.runInContext(code, sandbox, { filename: f });
}
["dm-vocab-01.js", "dm-vocab-02.js", "dm-sent-01.js", "dm-sent-02.js", "dm-sent-03.js",
 "dm-gram-01.js", "dm-dlg-01.js", "dm-lib.js",
 "dm-ex-01.js", "dm-ex-02.js", "dm-ex-03.js", "dm-ex-04.js"].forEach(load);
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
