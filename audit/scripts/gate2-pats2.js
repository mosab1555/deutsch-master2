"use strict";
const { PATS, TIMES, PLACES } = require("C:\\Users\\mosab\\Desktop\\deutsch-master2\\tools\\clib\\sentgen.js");
const { BIGPATS } = require("C:\\Users\\mosab\\Desktop\\deutsch-master2\\tools\\clib\\bigsenp.js");
const all = PATS.concat(BIGPATS);
const t0 = all.filter(p => /^\{(T|P|T1|P1)/.test(p[0]));
console.log("templates starting with {T}/{P} slot=" + t0.length);
t0.slice(0, 30).forEach(p => console.log("  [" + p[4] + "] " + p[0].slice(0, 100)));
// check fillGeneric: does it capitalize? inspect build-sentences fillGeneric end
const fs = require("fs");
const src = fs.readFileSync("C:\\Users\\mosab\\Desktop\\deutsch-master2\\tools\\build-sentences.js", "utf8");
const i = src.indexOf("function fillGeneric");
const j = src.indexOf("function buildOne");
console.log("---fillGeneric tail---");
console.log(src.slice(j - 2500, j).slice(-1200));
