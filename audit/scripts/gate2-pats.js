"use strict";
const { PATS } = require("C:\\Users\\mosab\\Desktop\\deutsch-master2\\tools\\clib\\sentgen.js");
const { BIGPATS } = require("C:\\Users\\mosab\\Desktop\\deutsch-master2\\tools\\clib\\bigsenp.js");
const all = PATS.concat(BIGPATS);
console.log("patterns total=" + all.length);
const low = all.filter(p => /^[a-zäöü]/.test(p[0]));
console.log("lowercase-initial templates=" + low.length);
low.slice(0, 40).forEach(p => console.log("  [" + p[4] + "] " + p[0].slice(0, 90)));
