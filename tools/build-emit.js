/* Stage 5 — EMIT: validated caches -> client/content/src/*.json (source of truth),
   client/content/dm-*.js (compact runtime packs), client/content/dm-lib.js (registry),
   docs/content-schema.md, HTML/SW wiring.
   Run: node tools/build-emit.js */
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const cache = path.join(__dirname, "clib", ".cache");
const outDir = path.join(root, "client", "content");
const srcDir = path.join(outDir, "src");
fs.mkdirSync(srcDir, { recursive: true });

const vocab = JSON.parse(fs.readFileSync(path.join(cache, "vocab.json"), "utf8"));
const sentences = JSON.parse(fs.readFileSync(path.join(cache, "sentences.json"), "utf8"));
const grammar = JSON.parse(fs.readFileSync(path.join(cache, "grammar.json"), "utf8"));
const exercises = JSON.parse(fs.readFileSync(path.join(cache, "exercises.json"), "utf8"));
const dialogues = JSON.parse(fs.readFileSync(path.join(cache, "dialogues.json"), "utf8"));

function shard(arr, n) {
  const out = [];
  const per = Math.ceil(arr.length / n);
  for (let i = 0; i < n; i++) out.push(arr.slice(i * per, (i + 1) * per));
  return out.filter((x) => x.length);
}
/* sentence examples for vocab cards: invert sentence->vocab refs */
const sentByVocab = new Map();
sentences.forEach((s) => {
  (s.vocab || []).forEach((vid) => {
    if (!sentByVocab.has(vid)) sentByVocab.set(vid, s);
  });
});
vocab.forEach((w) => {
  const s = sentByVocab.get(w.id);
  w.ex = s ? s.de : "";
  w.exAr = s ? s.ar : "";
});

const plan = [
  ["vocab", vocab, 2], ["sent", sentences, 3], ["gram", grammar, 1],
  ["ex", exercises, 4], ["dlg", dialogues, 1],
];
const manifest = { version: 1, seed: "deutsch-master-library-v1", generated: new Date().toISOString(), files: [], counts: {} };
/* compact runtime rows */
function compact(kind, o) {
  if (kind === "vocab") return [o.id, o.de, o.art, o.ar, o.en || "", o.level, o.cat, o.type, o.plural || "", o.head || "", o.ex || "", o.exAr || ""];
  if (kind === "sent") return [o.id, o.de, o.ar, o.level, o.topic, o.kap, (o.gram || [])[0] || "", (o.vocab || []).join(",")];
  if (kind === "ex") return [o.id, o.type, o.prompt, o.choices, o.answer, o.level, (o.ref || []).join(","), o.kind || "fill", o.kap || "", o.words || o.lines || 0, o.why || ""];
  if (kind === "dlg") return [o.id, o.level, o.topic, o.titleDe, o.titleAr, o.lines];
  return o;
}
const runtimeFiles = [];
plan.forEach(([kind, arr, n]) => {
  manifest.counts[kind] = arr.length;
  shard(arr, n).forEach((chunk, i) => {
    const base = kind + "-" + String(i + 1).padStart(2, "0");
    fs.writeFileSync(path.join(srcDir, base + ".json"), JSON.stringify({ kind, rows: chunk }));
    const rrows = chunk.map((o) => compact(kind, o));
    const js = "(function(){var C=window.__dmLibChunks=window.__dmLibChunks||{vocab:[],sent:[],gram:[],ex:[],dlg:[]};" +
      "C[" + JSON.stringify(kind) + "].push(" + JSON.stringify(rrows) + ");})();";
    fs.writeFileSync(path.join(outDir, "dm-" + base + ".js"), js);
    manifest.files.push({ src: "content/src/" + base + ".json", runtime: "content/dm-" + base + ".js", kind, count: chunk.length });
    runtimeFiles.push("content/dm-" + base + ".js");
  });
});
/* grammar ships as objects (needed whole); already in 1 shard above via compact fallback */
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log("shards:", manifest.files.map((f) => f.runtime + "=" + f.count).join(" "));
console.log("counts:", JSON.stringify(manifest.counts));
let bytes = 0;
manifest.files.forEach((f) => { bytes += fs.statSync(path.join(root, "client", f.runtime)).size; });
console.log("runtime bytes:", bytes);
