"use strict";
// R9 follow-up: initial masculine modal + singular feminine subject -> feminine modal.
// (تستطيع البائعة / تريد المعلمة / تود القابلة). Dual/plural untouched. --write applies.
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
const SDIR = ROOT + "\\client\\content\\src";
const WRITE = process.argv.includes("--write");
function load(kind) {
  const files = fs.readdirSync(SDIR).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8")); for (const r of (j.rows || j)) rows.push({ ...r, _file: f }); }
  return rows;
}
const FEM = ["العائلة", "التلميذة", "الطاهية", "المديرة", "السيدة", "العروس", "الطالبة", "المعلمة", "البائعة", "الشرطية", "الممرضة", "السكرتيرة", "النادلة", "الصيدلانية", "المضيفة", "الموظفة", "الزميلة", "الجارة", "الخادمة", "الأم", "الأخت", "الابنة", "المرأة", "البنت", "العاملة", "الفلاحة", "المهندسة", "الطبيبة", "القابلة"];
const FIX = { "يريد": "تريد", "يستطيع": "تستطيع", "يود": "تود" };
const sents = load("sent");
const fileCache = new Map();
function fileRows(f) {
  if (!fileCache.has(f)) fileCache.set(f, JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8")));
  return fileCache.get(f);
}
let n = 0;
const touched = new Map();
const patchedIds = [];
for (const r of sents) {
  const ar = String(r.ar || "").trim();
  const m = ar.match(/^(يريد|يستطيع|يود) (\S+)/);
  if (!m || !FIX[m[1]]) continue;
  const subj = m[2];
  if (!FEM.some(f => subj === f || subj.startsWith(f + " "))) continue;
  // skip if German subject is plural (safety: siepl/wir subjects need different forms)
  const de = String(r.de || "");
  if (/^(Wir|Ihr|Beide|Viele|Die (Studenten|Männer|Frauen|Kinder|Leute|Damen|Herren|Eltern|Touristen|Kollegen|Nachbarn|Freunde|Gäste|Schüler|Mädchen))\b/.test(de)) continue;
  const n2 = ar.replace(new RegExp("^" + m[1] + " "), FIX[m[1]] + " ");
  if (n2 !== ar) {
    n++;
    patchedIds.push([r.id, ar, n2]);
    fileRows(r._file).rows.find(x => x.id === r.id).ar = n2;
    touched.set(r._file, (touched.get(r._file) || 0) + 1);
  }
}
if (WRITE) for (const [f, j] of fileCache) if (touched.has(f)) { fs.writeFileSync(SDIR + "\\" + f, JSON.stringify(j), "utf8"); console.log("wrote " + f + " (" + touched.get(f) + ")"); }
console.log("R9 modal-fem patched=" + n + (WRITE ? " (written)" : " (dry)"));
// remove patched rows from review queue (they no longer need that review item)
if (WRITE) {
  const qf = ROOT + "\\audit\\remediation-review-queue.csv";
  const lines = fs.readFileSync(qf, "utf8").split("\n");
  const keep = lines.filter(l => !/^"(ls\d+)",.*modal-arabic feminine-subject/.test(l) || false);
  // Recompute: drop modal-arabic queue rows whose current ar no longer mismatches
  const cur = new Map(load("sent").map(r => [r.id, String(r.ar).trim()]));
  const out = [lines[0]];
  for (const l of lines.slice(1)) {
    const m = l.match(/^"(ls\d+)",/);
    if (!m) { if (l.trim()) out.push(l); continue; }
    if (/modal-arabic feminine-subject/.test(l)) {
      const a = cur.get(m[1]) || "";
      if (/^(يريد|يستطيع|يود) /.test(a)) out.push(l); // still mismatched -> keep
      // else patched -> drop
    } else out.push(l);
  }
  fs.writeFileSync(qf, out.join("\n"), "utf8");
  console.log("review queue pruned; remaining=" + (out.length - 1));
}
