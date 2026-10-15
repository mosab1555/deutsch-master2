"use strict";
// Find "/" inside Arabic strings in clib pools (slash-leftover source hunt)
const fs = require("fs");
const dir = "C:\\Users\\mosab\\Desktop\\deutsch-master2\\tools\\clib";
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js"))) {
  const src = fs.readFileSync(dir + "\\" + f, "utf8");
  const lines = src.split("\n");
  let n = 0;
  const ex = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Arabic-range char + slash on same line inside a quoted string
    if (/[\u0600-\u06FF]/.test(l) && /"[^"]*\/[^"]*"/.test(l)) { n++; if (ex.length < 3) ex.push((i + 1) + ": " + l.trim().slice(0, 160)); }
  }
  if (n) { console.log(f + ": " + n + " lines"); ex.forEach(e => console.log("   " + e)); }
}
