"use strict";
// Patch DENY_DE + QMOD guard via exact byte replacement (file has mixed encoding).
const fs = require("fs");
const p = "C:\\Users\\mosab\\Desktop\\deutsch-master2\\tools\\build-content-library.js";
let s = fs.readFileSync(p, "utf8");
const oldDeny = 'const DENY_DE = new Set(["kleinvater", "kleinmutter", "neuvater", "neumutter", "altvater", "altmutter", "großkind", "neukind", "altkind", "wollschuh", "kleinplatz", "großplatz", "neuplatz", "altplatz", "passreise"]);';
if (!s.includes(oldDeny)) { console.log("DENY PATTERN NOT FOUND"); process.exit(1); }
const add = ["lkwstraßenbahn", "lkwstrassenbahn", "schmerzstent", "geburtsvater", "jugendschutzgelb", "biomango", "unterfriedhof", "gemüsebirne", "teeknoblauch", "tagessekunde", "wochensekunde", "spätsekunde", "sicherheitsschnupfen", "wanderstorch", "familienschwiegervater", "grillhefe"];
const newDeny = 'const DENY_DE = new Set(["kleinvater", "kleinmutter", "neuvater", "neumutter", "altvater", "altmutter", "großkind", "neukind", "altkind", "wollschuh", "kleinplatz", "großplatz", "neuplatz", "altplatz", "passreise", ' + add.map(a => '"' + a + '"').join(", ") + "]);";
// remediation phase 1: evidenced nonsense compounds (audit probe-specimens: counts
// Lkwstra* 10, Schmerzstent 9, Geburtsvater 23, Jugendschutzgelb 10, Biomango 11,
// Unterfriedhof 8, Gemüsebirne 11, Teeknoblauch-class; real words like Rohschinken,
// Picknickrest, Kartenpin, Topper, Cookie deliberately NOT listed).
s = s.replace(oldDeny, newDeny.replace("const DENY", "/* remediation phase 1 */\nconst DENY"));
// QMOD pass guard (it lacked the DENY check that MODGEN has):
const qmodAnchor = '      if (h.de.toLowerCase().startsWith(mod.toLowerCase())) continue;\r\n      if (badHead(h)) { skipped++; continue; }\r\n      const har = String(h.ar).split("/")[0].trim().replace(/^ال/, "");';
if (!s.includes(qmodAnchor)) { console.log("QMOD ANCHOR NOT FOUND"); process.exit(1); }
s = s.replace(qmodAnchor, '      if (h.de.toLowerCase().startsWith(mod.toLowerCase())) continue;\r\n      if (badHead(h)) { skipped++; continue; }\r\n      if (DENY_DE.has(normDE(mod + h.de.replace(/^[A-Z\xc4\xd6\xdc]/, function (c) { return c.toLowerCase(); })))) { rej(mod + "+" + h.de, "compound: denied output (qmod)"); skipped++; continue; }\r\n      const har = String(h.ar).split("/")[0].trim().replace(/^ال/, "");');
fs.writeFileSync(p, s, "utf8");
console.log("patched DENY_DE +" + add.length + " + QMOD guard");
