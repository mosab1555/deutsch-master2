"use strict";
// Append R9 summary to remediation-patches.json (counts only; per-row data derivable).
const fs = require("fs");
const p = "C:\\Users\\mosab\\Desktop\\deutsch-master2\\audit\\remediation-patches.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
j.byRule["R9-modal-fem"] = 597;
j.count += 597;
j.notes = "R9 applied by audit/scripts/remediate-r9.js --write (initial masculine modal + singular feminine subject -> feminine modal; dual/plural untouched). Per-row before/after not stored; rule is a pure function of the row's Arabic head (see script).";
fs.writeFileSync(p, JSON.stringify(j, null, 1), "utf8");
console.log("total patches now " + j.count);
