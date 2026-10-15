"use strict";
const { execSync } = require("child_process");
const path = require("path");
const ROOT = "C:\\Users\\mosab\\Desktop\\deutsch-master2";
for (const f of ["client/content/src/sent-01.json", "client/content/src/vocab-01.json"]) {
  const oldS = execSync(`git show HEAD:${f}`, { cwd: ROOT, maxBuffer: 100 * 1024 * 1024 }).toString("utf8");
  const newS = require("fs").readFileSync(path.join(ROOT, f), "utf8");
  const o = JSON.parse(oldS), n = JSON.parse(newS);
  const orows = o.rows || o, nrows = n.rows || n;
  console.log("== " + f + " old=" + orows.length + " new=" + nrows.length);
  const om = new Map(orows.map(r => [r.id, r]));
  let changed = 0, added = 0, removed = 0;
  const exChanged = [], exAdded = [];
  for (const r of nrows) {
    if (!om.has(r.id)) { added++; if (exAdded.length < 3) exAdded.push(r.id + " :: " + JSON.stringify(r).slice(0, 200)); }
    else {
      const a = JSON.stringify(om.get(r.id)), b = JSON.stringify(r);
      if (a !== b) { changed++; if (exChanged.length < 3) exChanged.push(r.id + "\n  OLD: " + a.slice(0, 300) + "\n  NEW: " + b.slice(0, 300)); }
    }
  }
  for (const r of orows) if (!nrows.find(x => x.id === r.id)) removed++;
  console.log("  changed=" + changed + " added=" + added + " removed=" + removed);
  exChanged.forEach(s => console.log(s));
  exAdded.forEach(s => console.log("ADDED: " + s));
}
