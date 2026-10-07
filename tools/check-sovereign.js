/* QA: every nav data-page + data-goto must resolve to an icon + page section. */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "client");
const src = fs.readFileSync(path.join(root, "sovereign.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const m = src.match(/var ICONS = \{([\s\S]*?)\n  \};/);
if (!m) { console.log("FAIL: ICONS block not found"); process.exit(1); }
const keys = [...m[1].matchAll(/^\s{4}(\w+):/gm)].map((x) => x[1]);
const pages = [...new Set([...html.matchAll(/data-page="([^"]+)"/g)].map((x) => x[1]))];
const gotos = [...new Set([...html.matchAll(/data-goto="([^"]+)"/g)].map((x) => x[1]))];
const sections = [...new Set([...html.matchAll(/id="page-([^"]+)"/g)].map((x) => x[1]))];
let fail = 0;
const noIcon = pages.filter((p) => !keys.includes(p));
console.log("icons=" + keys.length + " pages=" + pages.length + " gotos=" + gotos.length + " sections=" + sections.length);
if (noIcon.length) { fail = 1; console.log("FAIL no-icon: " + noIcon.join(",")); }
else console.log("PASS all nav pages have distinct icons");
const noSection = [...new Set([...pages, ...gotos])].filter((p) => !sections.includes(p));
if (noSection.length) { fail = 1; console.log("FAIL no-section: " + noSection.join(",")); }
else console.log("PASS all nav/goto targets resolve to page sections");
// logout uses data-action, not data-page — verify it still exists
if (!/id="logoutBtn"/.test(html)) { fail = 1; console.log("FAIL logoutBtn missing"); }
else console.log("PASS logout action preserved");
// obsidian identity layer is authoritative and loads last (after sovereign.css)
const cssLinks = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((x) => x[1]);
const jsLinks = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((x) => x[1]);
if (cssLinks[cssLinks.length - 1] !== "obsidian.css") { fail = 1; console.log("FAIL obsidian.css not last: " + cssLinks.slice(-2).join(",")); }
else console.log("PASS obsidian.css loads last");
if (!cssLinks.includes("sovereign.css")) { fail = 1; console.log("FAIL sovereign.css missing"); }
else console.log("PASS sovereign.css wired");
if (jsLinks[jsLinks.length - 1] !== "sovereign.js") { fail = 1; console.log("FAIL sovereign.js not last"); }
else console.log("PASS sovereign.js loads last");
// every wired file must exist on disk
[...cssLinks, ...jsLinks].forEach((f) => {
  if (f.startsWith("http")) return;
  if (!fs.existsSync(path.join(root, f))) { fail = 1; console.log("FAIL missing file: " + f); }
});
if (!fail) console.log("PASS all wired assets exist");
process.exit(fail ? 1 : 0);
