"use strict";
// Scan for modal+fem-subject mismatches beyond R4 (queue only, no patch).
const fs = require("fs");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
const SDIR = ROOT + "\\client\\content\\src";
function load(kind) {
  const files = fs.readdirSync(SDIR).filter(f => f.startsWith(kind + "-") && f.endsWith(".json")).sort();
  let rows = [];
  for (const f of files) { const j = JSON.parse(fs.readFileSync(SDIR + "\\" + f, "utf8")); for (const r of (j.rows || j)) rows.push(r); }
  return rows;
}
const sents = load("sent");
const FEM = ["العائلة", "التلميذة", "الطاهية", "المديرة", "السيدة", "العروس", "الطالبة", "المعلمة", "البائعة", "الشرطية", "الممرضة", "السكرتيرة", "النادلة", "الصيدلانية", "المضيفة", "الموظفة", "الزميلة", "الجارة", "الخادمة", "الأم", "الأخت", "الابنة", "المرأة", "البنت", "العاملة", "الفلاحة", "المهندسة", "الطبيبة", "القابلة"];
const found = [];
for (const r of sents) {
  const ar = String(r.ar || "").trim();
  const m = ar.match(/^(يريد|يستطيع|يود) (\S+(?: \S+)?)/);
  if (!m) continue;
  const subj = m[2].replace(/^(ال)/, "");
  if (FEM.some(f => m[2].startsWith(f))) found.push(r);
}
console.log("modal-fem-subject queue-candidates=" + found.length);
found.slice(0, 8).forEach(r => console.log("  " + r.id + " | " + r.de.slice(0, 70) + " | " + String(r.ar).slice(0, 60)));
// append to review queue
const qf = ROOT + "\\audit\\remediation-review-queue.csv";
let q = fs.readFileSync(qf, "utf8");
const esc = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
for (const r of found) q += [r.id, r.de, r.ar, r.level, r.kap, "modal-arabic feminine-subject agreement (e.g. يريد العائلة); teacher review"].map(esc).join(",") + "\n";
fs.writeFileSync(qf, q, "utf8");
console.log("appended " + found.length + " to review queue");
