"use strict";
const { BIGPERFV_AR } = require("C:\\Users\\mosab\\Desktop\\deutsch-master2\\tools\\clib\\bigsen.js");
const bad = Object.entries(BIGPERFV_AR).filter(([k, v]) => String(v).includes("/"));
console.log("BIGPERFV_AR entries=" + Object.keys(BIGPERFV_AR).length + " with-slash=" + bad.length);
bad.slice(0, 10).forEach(([k, v]) => console.log("  " + k + " :: " + v));
