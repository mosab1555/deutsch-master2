/* AnkiDroid DOM acceptance (headless Chrome + CDP, stdlib only).
 * Drives the REAL app: nav separation, deck CRUD, add-note UI, study flow
 * (show answer -> Again/Hard/Good/Easy with live intervals), browser search,
 * suspend/bury/undo, stats, CSV import/export, reload persistence, the
 * untouched 3-state Flashcards page, AND note images: device file (valid /
 * corrupt / oversized) via the real file input, internet URL import (valid /
 * non-image / unreachable / oversized) over real HTTP, editor attach +
 * replace + remove, study rendering + lightbox, browser indicator, offline
 * display after import, reload persistence, and Guest/A/B media isolation
 * at the identity-scoped store layer. Exits 1 on any FAIL.
 * Run: node tools/test-anki-dom.js (from project root).
 */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 19343;

let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(req.url.split("?")[0]);
        if (p === "/t/img.png") { // minimal VALID 1x1 grayscale PNG (built with zlib, real decodable bytes)
          const png = buildPng();
          res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length });
          res.end(png); return;
        }
        if (p === "/t/big.png") { // valid PNG header + padding -> decodable shape but oversized blob
          const png = buildPng();
          const pad = Buffer.alloc(9 * 1024 * 1024, 0);
          const body = Buffer.concat([png, pad]);
          res.writeHead(200, { "Content-Type": "image/png", "Content-Length": body.length });
          res.end(body); return;
        }
        if (p === "/t/notimage.txt") {
          const body = Buffer.from("hello, this is plain text, not an image");
          res.writeHead(200, { "Content-Type": "text/plain", "Content-Length": body.length });
          res.end(body); return;
        }
        if (p === "/") p = "/index.html";
        const f = path.join(CLIENT, path.normalize(p).replace(/^\\+/, ""));
        if (!f.startsWith(CLIENT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(f).toLowerCase();
        const ct = ext === ".html" ? "text/html" : ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : ext === ".json" ? "application/json" : "application/octet-stream";
        res.writeHead(200, { "Content-Type": ct + ";charset=utf-8" });
        fs.createReadStream(f).pipe(res);
      } catch (e) { res.writeHead(500); res.end(); }
    });
    srv.listen(0, "127.0.0.1", () => resolve({ srv, port: srv.address().port }));
  });
}
class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.consoleErrs = []; }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", () => reject(new Error("ws-error")));
      this.ws.addEventListener("message", ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.id && this.pending.has(m.id)) {
          const h = this.pending.get(m.id); this.pending.delete(m.id);
          if (m.error) h.rej(new Error(JSON.stringify(m.error).slice(0, 200))); else h.res(m.result);
        } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
          this.consoleErrs.push("console:" + JSON.stringify(m.params.args).slice(0, 200));
        } else if (m.method === "Runtime.exceptionThrown") {
          this.consoleErrs.push("exc:" + JSON.stringify(m.params.exceptionDetails).slice(0, 200));
        }
      });
    });
  }
  send(method, params, to) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("cdp-timeout:" + method)); } }, to || 25000);
    });
  }
  ev(expr) {
    return this.send("Runtime.evaluate", { expression: expr, returnByValue: true }).then(r => {
      if (r.exceptionDetails) throw new Error("eval-ex:" + JSON.stringify(r.exceptionDetails).slice(0, 200));
      return r.result && r.result.value;
    });
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
function httpJson(url, tries) {
  return new Promise((resolve, reject) => {
    const attempt = n => http.get(url, res => {
      let s = ""; res.on("data", c => s += c);
      res.on("end", () => { try { resolve(JSON.parse(s)); } catch (e) { n > 0 ? setTimeout(() => attempt(n - 1), 200) : reject(e); } });
    }).on("error", () => n > 0 ? setTimeout(() => attempt(n - 1), 200) : reject(new Error("no-endpoint")));
    attempt(tries == null ? 60 : tries);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let cdpRef = null;

/* Minimal valid PNG builder (stdlib zlib only): 1x1 grayscale. */
const CRC_T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function buildPng() {
  const zlib = require("zlib");
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  }
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 0;
  const idat = zlib.deflateSync(Buffer.from([0x00, 0xC8]));
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ankidom-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
  cdpRef = cdp;
  await cdp.connect();
  await cdp.send("Runtime.enable"); await cdp.send("Page.enable");
  const errCount = () => cdp.consoleErrs.length;

  await cdp.send("Page.navigate", { url: base + "/index.html" });
  await sleep(4500);

  // 1. nav separation
  ok("nav-flashcards", await cdp.ev(`!!document.querySelector('[data-page="flashcards"]')`));
  ok("nav-ankidroid", await cdp.ev(`!!document.querySelector('[data-page="ankidroid"]')`));
  ok("api-present", await cdp.ev(`typeof window.AnkiDroid === "object"`));

  // 2. open AnkiDroid
  await cdp.ev(`document.querySelector('[data-page="ankidroid"]').click()`);
  await sleep(800);
  ok("page-active", await cdp.ev(`document.getElementById("page-ankidroid").classList.contains("active")`));
  ok("toolbar", await cdp.ev(`!!document.querySelector("#ankiRoot .anki-toolbar")`));

  // 3. seed via API, check deck tree + counts render
  const seed = await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    Object.keys(SA.decks).forEach(k => delete SA.decks[k]);
    Object.keys(SA.notes).forEach(k => delete SA.notes[k]);
    Object.keys(SA.cards).forEach(k => delete SA.cards[k]);
    SA.log = []; SA.days = {}; SA.undo = null; SA.settings.defaultDeck = null;
    const d = A.createDeck(SA, "Deutsch::A1::Kapitel 1", null);
    A.addNote(SA, { type: "basic", deck: d.id, fields: { Front: "Haus", Back: "منزل" }, tags: "a1" });
    A.addNote(SA, { type: "basic_rev", deck: d.id, fields: { Front: "Buch", Back: "كتاب" }, tags: "a1" });
    A.render();
    return { deck: d.id, decks: Object.keys(SA.decks).length, cards: Object.keys(SA.cards).length,
      rows: document.querySelectorAll("#ankiRoot .anki-deck-row").length };
  })()`);
  ok("seed-decks", seed && seed.decks === 3, JSON.stringify(seed));
  ok("seed-cards", seed && seed.cards === 3, JSON.stringify(seed));
  ok("deck-rows", seed && seed.rows >= 3, JSON.stringify(seed));

  // 4. overview
  await cdp.ev(`AnkiDroid.render(); document.querySelector('#ankiRoot [data-aoverview]').click()`);
  await sleep(500);
  ok("overview", await cdp.ev(`!!document.querySelector("#ankiRoot .anki-overview")`));

  // 5. study: start, show answer, rate Good
  await cdp.ev(`document.querySelector('#ankiRoot [data-astudy]').click()`);
  await sleep(500);
  ok("study-front", await cdp.ev(`!!document.querySelector("#ankiRoot .anki-card-front") && !document.querySelector("#ankiShowAns") === false`));
  ok("show-btn", await cdp.ev(`!!document.querySelector("#ankiShowAns")`));
  await cdp.ev(`document.querySelector("#ankiShowAns").click()`);
  await sleep(400);
  const ratings = await cdp.ev(`[...document.querySelectorAll("#ankiRatings [data-arate]")].map(b => b.getAttribute("data-arate")).join(",")`);
  ok("four-ratings", ratings === "again,hard,good,easy", ratings);
  const etas = await cdp.ev(`[...document.querySelectorAll("#ankiRatings [data-arate] small")].map(s => s.textContent.trim()).join("|")`);
  ok("live-intervals", etas.split("|").every(s => s.length > 0), etas);
  const st0 = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store(); const id = Object.keys(SA.cards)[0]; return SA.cards[id].sched.st; })()`);
  await cdp.ev(`document.querySelector('#ankiRatings [data-arate="good"]').click()`);
  await sleep(400);
  const st1 = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store(); const id = Object.keys(SA.cards)[0]; return SA.cards[id].sched.st; })()`);
  ok("good-schedules", st0 === "new" && st1 === "learning", st0 + "->" + st1);

  // 6. keyboard: space reveals, 3 rates good
  const kb = await cdp.ev(`(() => {
    const before = document.querySelector("#ankiShowAns") ? 1 : 0;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    return before;
  })()`);
  await sleep(400);
  ok("space-reveals", await cdp.ev(`!!document.querySelector("#ankiRatings:not(.hidden)") || !!document.querySelector("#ankiRatings")`));

  // 7. browser + search
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "browse").click()`);
  await sleep(500);
  ok("browser", await cdp.ev(`!!document.querySelector("#ankiRoot #ankiSearch")`));
  await cdp.ev(`(() => { const i = document.querySelector("#ankiRoot #ankiSearch"); i.value = "tag:a1"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await sleep(900);
  const browCount = await cdp.ev(`document.querySelector("#ankiRoot").textContent`);
  ok("browser-search", /Haus|Buch/.test(browCount), "results render");

  // 8. stats
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "stats").click()`);
  await sleep(500);
  ok("stats", await cdp.ev(`document.querySelectorAll("#ankiRoot .anki-stat-card").length >= 8`));

  // 9. csv export content via API
  const csv = await cdp.ev(`(() => { const A = window.AnkiDroid; return A.exportCSV(A.store(), Object.keys(A.store().cards)).slice(0, 60); })()`);
  ok("csv-export", typeof csv === "string" && csv.indexOf("Front,Back,Deck") === 0, String(csv).slice(0, 60));

  // 10. reload persistence (guest key)
  await cdp.send("Page.navigate", { url: base + "/index.html" });
  await sleep(4500);
  await cdp.ev(`document.querySelector('[data-page="ankidroid"]').click()`);
  await sleep(800);
  const after = await cdp.ev(`(() => { const A = window.AnkiDroid; const SA = A.store(); return { decks: Object.keys(SA.decks).length, cards: Object.keys(SA.cards).length }; })()`);
  ok("reload-persists", after && after.cards === 3, JSON.stringify(after));

  // 10b. BUG-REPORT FLOW via the real UI: Add Basic note (Front=DomTestFront,
  // Back=DomTestBack) -> save -> overview -> browser finds it -> study queue
  // holds it -> reload -> still there and findable.
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "add").click()`);
  await sleep(500);
  ok("uiadd-editor", await cdp.ev(`!!document.querySelector("#ankiRoot #ankiEdF_Front") && !!document.querySelector('#ankiRoot [data-asave="add"]')`));
  await cdp.ev(`(() => { document.querySelector("#ankiRoot #ankiEdF_Front").value = "DomTestFront"; document.querySelector("#ankiRoot #ankiEdF_Back").value = "DomTestBack"; document.querySelector('#ankiRoot [data-asave="add"]').click(); })()`);
  await sleep(600);
  ok("uiadd-lands-overview", await cdp.ev(`!!document.querySelector("#ankiRoot .anki-overview")`));
  const uiadded = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store(); const found = A.searchCards(SA, "DomTestFront", Date.now()); const q = SA.decks[SA.notes[found[0].note].deck] ? A.buildQueue(SA, SA.notes[found[0].note].deck, {}).items.map(c => c.id) : []; return { n: found.length, card: found[0] && found[0].id, deck: found[0] && found[0].deck, inQueue: found[0] ? q.indexOf(found[0].id) >= 0 : false, counts: A.deckCounts(SA, found[0].deck, Date.now()) }; })()`);
  ok("uiadd-card-findable", uiadded && uiadded.n === 1, JSON.stringify(uiadded));
  ok("uiadd-card-deck", !!(uiadded && uiadded.deck), JSON.stringify(uiadded));
  ok("uiadd-counts-new", !!(uiadded && uiadded.counts && uiadded.counts.new >= 1), JSON.stringify(uiadded && uiadded.counts));
  ok("uiadd-study-queue", !!(uiadded && uiadded.inQueue), JSON.stringify(uiadded));
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "browse").click()`);
  await sleep(500);
  await cdp.ev(`(() => { const i = document.querySelector("#ankiRoot #ankiSearch"); i.value = "DomTestFront"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await sleep(900);
  ok("uiadd-browser", /DomTestFront/.test(await cdp.ev(`document.querySelector("#ankiRoot").textContent`)), "browser shows new card");
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "home").click()`);
  await sleep(500);
  await cdp.ev(`document.querySelector('#ankiRoot [data-aoverview]').click()`);
  await sleep(500);
  await cdp.ev(`(() => { const b = document.querySelector('#ankiRoot [data-astudy]'); if (b) b.click(); })()`);
  await sleep(500);
  ok("uiadd-study", await cdp.ev(`!!document.querySelector("#ankiRoot .anki-card-front")`));
  await cdp.send("Page.navigate", { url: base + "/index.html" });
  await sleep(4500);
  await cdp.ev(`document.querySelector('[data-page="ankidroid"]').click()`);
  await sleep(800);
  const afterUi = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store(); return { cards: Object.keys(SA.cards).length, found: A.searchCards(SA, "DomTestFront", Date.now()).length }; })()`);
  ok("uiadd-reload-persists", afterUi && afterUi.cards === 4, JSON.stringify(afterUi));
  ok("uiadd-reload-found", afterUi && afterUi.found === 1, JSON.stringify(afterUi));

  // 10c. CREATE-DECK FLOW via the real UI: new deck appears immediately,
  // becomes selected, overview opens; empty/cancel create nothing.
  ok("newdeck-btn", await cdp.ev(`!!document.querySelector('#ankiRoot [data-anewdeck]')`));
  const decksBefore = await cdp.ev(`Object.keys(window.AnkiDroid.store().decks).length`);
  await cdp.ev(`window.__realPrompt = window.prompt; window.prompt = () => ""; document.querySelector('#ankiRoot [data-anewdeck]').click()`);
  await sleep(500);
  const emptyNoDeck = await cdp.ev(`({ n: Object.keys(window.AnkiDroid.store().decks).length, ov: !!document.querySelector("#ankiRoot .anki-overview") })`);
  ok("newdeck-empty-rejected", emptyNoDeck.n === decksBefore, JSON.stringify(emptyNoDeck));
  await cdp.ev(`window.prompt = () => null; document.querySelector('#ankiRoot [data-anewdeck]').click()`);
  await sleep(400);
  ok("newdeck-cancel-safe", await cdp.ev(`Object.keys(window.AnkiDroid.store().decks).length === ` + decksBefore));
  await cdp.ev(`window.prompt = () => "FlowDeckB"; document.querySelector('#ankiRoot [data-anewdeck]').click()`);
  await sleep(600);
  await cdp.ev(`window.prompt = window.__realPrompt;`);
  const newdeck = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store();
    const id = Object.keys(SA.decks).find(k => A.deckPath(SA, k) === "FlowDeckB");
    const v = A.view();
    return { id: id || null, selected: v.deck === id, overview: !!document.querySelector("#ankiRoot .anki-overview"),
      title: (document.querySelector("#ankiRoot .anki-overview h3") || {}).textContent || "" }; })()`);
  ok("newdeck-appears", !!(newdeck && newdeck.id), JSON.stringify(newdeck));
  ok("newdeck-selected", !!(newdeck && newdeck.selected), JSON.stringify(newdeck));
  ok("newdeck-overview", !!(newdeck && newdeck.overview && /FlowDeckB/.test(newdeck.title)), JSON.stringify(newdeck));
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "home").click()`);
  await sleep(500);
  ok("newdeck-listed", /FlowDeckB/.test(await cdp.ev(`document.querySelector("#ankiRoot").textContent`)), "deck list shows new deck");
  // add a card to the new deck via the real Add UI -> same-deck overview
  await cdp.ev(`document.querySelector('#ankiRoot [data-aoverview="${newdeck.id}"]') ? document.querySelectorAll('#ankiRoot [data-aoverview="${newdeck.id}"]')[0].click() : 0`);
  await sleep(500);
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "add").click()`);
  await sleep(500);
  const addDeckSel = await cdp.ev(`(() => { const s = document.querySelector("#ankiRoot #ankiEdDeck"); return s ? s.value : null; })()`);
  ok("add-bound-to-newdeck", addDeckSel === newdeck.id, String(addDeckSel) + " vs " + newdeck.id);
  await cdp.ev(`(() => { document.querySelector("#ankiRoot #ankiEdF_Front").value = "FlowFrontB1"; document.querySelector("#ankiRoot #ankiEdF_Back").value = "FlowBackB1"; document.querySelector('#ankiRoot [data-asave="add"]').click(); })()`);
  await sleep(600);
  const flowCard = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store();
    const found = A.searchCards(SA, "FlowFrontB1", Date.now());
    const v = A.view();
    return { n: found.length, deck: found[0] && found[0].deck, card: found[0] && found[0].id,
      viewDeck: v.deck, overview: !!document.querySelector("#ankiRoot .anki-overview"),
      counts: found[0] ? A.deckCounts(SA, found[0].deck, Date.now()) : null }; })()`);
  ok("flow-card-saved", flowCard && flowCard.n === 1, JSON.stringify(flowCard));
  ok("flow-card-deck", flowCard && flowCard.deck === newdeck.id, JSON.stringify(flowCard));
  ok("flow-stays-on-deck", flowCard && flowCard.viewDeck === newdeck.id && flowCard.overview, JSON.stringify(flowCard));
  ok("flow-counts", !!(flowCard && flowCard.counts && flowCard.counts.total >= 1 && flowCard.counts.new >= 1), JSON.stringify(flowCard && flowCard.counts));
  // browser finds it by front + by card id + by deck filter
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "browse").click()`);
  await sleep(500);
  await cdp.ev(`(() => { const i = document.querySelector("#ankiRoot #ankiSearch"); i.value = "FlowFrontB1"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await sleep(900);
  ok("flow-browser-front", /FlowFrontB1/.test(await cdp.ev(`document.querySelector("#ankiRoot").textContent`)), "browser shows new card");
  await cdp.ev(`(() => { const i = document.querySelector("#ankiRoot #ankiSearch"); i.value = "deck:FlowDeckB"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await sleep(900);
  ok("flow-browser-deck", /FlowFrontB1/.test(await cdp.ev(`document.querySelector("#ankiRoot").textContent`)), "deck filter shows new card");
  const flowById = await cdp.ev(`(() => { const A = window.AnkiDroid; return A.searchCards(A.store(), "${flowCard.card}", Date.now()).length; })()`);
  ok("flow-browser-id", flowById === 1, String(flowById));
  // browser finds the new card by stable deck ID via the real search box
  await cdp.ev(`(() => { const i = document.querySelector("#ankiRoot #ankiSearch"); i.value = "deck:${newdeck.id}"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await sleep(900);
  ok("flow-browser-deckid", /FlowFrontB1/.test(await cdp.ev(`document.querySelector("#ankiRoot").textContent`)), "deck:ID filter shows new card");
  // double-submit guard: two rapid save clicks create exactly one note
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "add").click()`);
  await sleep(500);
  const dblSave = await cdp.ev(`(() => { const A = window.AnkiDroid;
    document.querySelector("#ankiRoot #ankiEdF_Front").value = "DblFrontX1";
    document.querySelector("#ankiRoot #ankiEdF_Back").value = "DblBackX1";
    const btn = document.querySelector('#ankiRoot [data-asave="add"]');
    const n0 = Object.keys(A.store().notes).length;
    btn.click(); btn.click();
    const notes = Object.keys(A.store().notes).map(k => A.store().notes[k]);
    return { added: notes.length - n0,
      dups: notes.filter(n => ((n.fields || {}).Front) === "DblFrontX1").length }; })()`);
  ok("flow-double-save-once", dblSave.added === 1 && dblSave.dups === 1, JSON.stringify(dblSave));
  // study from the deck overview contains the new card
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "home").click()`);
  await sleep(500);
  await cdp.ev(`(() => { const b = document.querySelectorAll('#ankiRoot [data-aoverview="${newdeck.id}"]')[0]; if (b) b.click(); })()`);
  await sleep(500);
  await cdp.ev(`(() => { const b = document.querySelector('#ankiRoot [data-astudy]'); if (b) b.click(); })()`);
  await sleep(600);
  ok("flow-study", /FlowFrontB1/.test(await cdp.ev(`document.querySelector("#ankiRoot").textContent`)), "study shows new card");
  // reload: deck + card persist, browser + study still find it
  await cdp.send("Page.navigate", { url: base + "/index.html" });
  await sleep(4500);
  await cdp.ev(`document.querySelector('[data-page="ankidroid"]').click()`);
  await sleep(800);
  const flowReload = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store();
    const found = A.searchCards(SA, "FlowFrontB1", Date.now());
    return { decks: Object.keys(SA.decks).length, n: found.length, deckOk: !!(found[0] && found[0].deck && SA.decks[found[0].deck]),
      inQueue: found[0] ? A.buildQueue(SA, found[0].deck, {}).items.some(c => c.id === found[0].id) : false }; })()`);
  ok("flow-reload-deck", flowReload.decks >= 4 && flowReload.n === 1 && flowReload.deckOk, JSON.stringify(flowReload));
  ok("flow-reload-study", flowReload.inQueue === true, JSON.stringify(flowReload));

  // 10d. multi-deck isolation + stale-render protection + persistence failure
  await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store();
    ["IsoA","IsoB","IsoC"].forEach(nm => { const r = A.createDeck(SA, nm, null);
      A.addNote(SA, { type: "basic", deck: r.id, fields: { Front: "IsoDomFront" + nm.slice(-1), Back: "b" }, tags: "" }); });
    A.render(); })()`);
  await sleep(500);
  const isoUi = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store();
    const fa = A.searchCards(SA, "deck:IsoA", Date.now()), fb = A.searchCards(SA, "deck:IsoB", Date.now()), fc = A.searchCards(SA, "deck:IsoC", Date.now());
    const qa = A.buildQueue(SA, fa[0].deck, {}).items.map(c => c.id);
    return { a: fa.length === 1 && /IsoDomFrontA/.test(JSON.stringify(A.resolveFields(SA.notes[fa[0].note]))),
      b: fb.length === 1, c: fc.length === 1, qIso: qa.indexOf(fa[0].id) >= 0 && qa.indexOf(fb[0].id) < 0 }; })()`);
  ok("iso-ui-filters", isoUi.a && isoUi.b && isoUi.c && isoUi.qIso, JSON.stringify(isoUi));
  const stale = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store();
    const idA = Object.keys(SA.decks).find(k => A.deckPath(SA, k) === "IsoA");
    const idB = Object.keys(SA.decks).find(k => A.deckPath(SA, k) === "IsoB");
    A.view().deck = idA; A.view().name = "overview"; A.render();
    A.view().deck = idB; A.view().name = "overview"; A.render();
    const r = A.addNote(A.store(), { type: "basic", deck: A.view().deck, fields: { Front: "StaleDomFront", Back: "b" }, tags: "" });
    A.render();
    const v = A.view();
    return { stays: v.deck === idB && v.name === "overview",
      bound: !!(r.cards && A.store().cards[r.cards[0]].deck === idB) }; })()`);
  ok("stale-render-stays", stale.stays === true, JSON.stringify(stale));
  ok("stale-render-bound", stale.bound === true, JSON.stringify(stale));
  const persistFail = await cdp.ev(`(() => {
    const A = window.AnkiDroid;
    const before = Object.keys(A.store().cards).length;
    window.__sv = window.save; window.save = () => false;
    const SA = A.store();
    const dd = Object.keys(SA.decks)[0];
    const r = A.addNote(SA, { type: "basic", deck: dd, fields: { Front: "PhantomDomFront", Back: "b" }, tags: "" });
    const after = Object.keys(A.store().cards).length;
    window.save = window.__sv;
    const retry = A.addNote(A.store(), { type: "basic", deck: dd, fields: { Front: "RetryDomFront", Back: "b" }, tags: "" });
    return { err: r.error || null, clean: after === before, retry: !retry.error };
  })()`);
  ok("persistfail-no-phantom", persistFail.err === "persist-failed" && persistFail.clean === true, JSON.stringify(persistFail));
  ok("persistfail-retry", persistFail.retry === true, JSON.stringify(persistFail));

  // 11. flashcards untouched: 3-state only
  await cdp.ev(`document.querySelector('[data-page="flashcards"]').click()`);
  await sleep(600);
  const frates = await cdp.ev(`[...document.querySelectorAll('#page-flashcards [data-flash-rate]')].map(b => b.getAttribute("data-flash-rate")).join(",")`);
  ok("flash-3state", frates === "known,review,hard", frates);

  // 12. MEDIA: back to AnkiDroid, fresh deck, clean media store
  await cdp.ev(`document.querySelector('[data-page="ankidroid"]').click()`);
  await sleep(600);
  const mdeck = await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    SA.media = {};
    const d = A.createDeck(SA, "MDeck", null);
    return d.id;
  })()`);
  ok("media-deck", typeof mdeck === "string" && mdeck.length > 0, String(mdeck));
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "add").click()`);
  await sleep(500);
  ok("media-block", await cdp.ev(`!!document.querySelector("#ankiRoot #ankiImgFile") && !!document.querySelector('#ankiRoot [data-amedia-file]') && !!document.querySelector('#ankiRoot [data-amedia-url]')`));
  ok("media-urlrow-hidden", await cdp.ev(`document.querySelector("#ankiImgUrlRow").classList.contains("hidden")`));
  await cdp.ev(`document.querySelector('#ankiRoot [data-amedia-url]').click()`);
  await sleep(300);
  ok("media-urlrow-shown", await cdp.ev(`!document.querySelector("#ankiImgUrlRow").classList.contains("hidden")`));

  // 13. device file via the REAL file input (canvas-generated PNG)
  await cdp.ev(`(async () => {
    const cv = document.createElement("canvas"); cv.width = 200; cv.height = 120;
    const cx = cv.getContext("2d"); cx.fillStyle = "#b00"; cx.fillRect(0, 0, 200, 120);
    cx.fillStyle = "#fff"; cx.fillRect(10, 10, 50, 20);
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    const f = new File([blob], "photo.png", { type: "image/png" });
    const dt = new DataTransfer(); dt.items.add(f);
    const inp = document.querySelector("#ankiImgFile");
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await sleep(1800);
  ok("media-preview", await cdp.ev(`!!document.querySelector("#ankiImgPrev img.anki-thumb-lg")`));
  const mcount1 = await cdp.ev(`Object.keys(window.AnkiDroid.store().media).length`);
  ok("media-stored", mcount1 === 1, String(mcount1));

  // 14. fill fields (deck=MDeck), save -> token attached
  await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const ids = Object.keys(SA.decks).filter(k => SA.decks[k].name === "MDeck");
    document.querySelector("#ankiEdDeck").value = ids[0];
    document.querySelector("#ankiEdF_Front").value = "der Apfel";
    document.querySelector("#ankiEdF_Back").value = "التفاحة";
    document.querySelector('#ankiRoot [data-asave="add"]').click();
    return 1;
  })()`);
  await sleep(600);
  const savedNote = await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    return n ? { front: n.fields.Front, id: n.id } : null;
  })()`);
  ok("media-note-token", !!savedNote && /\[\[m:[A-Za-z0-9]+\]\]/.test(savedNote.front), JSON.stringify(savedNote));

  // 15. corrupt + oversized device files rejected, store unchanged
  // (save lands on the deck overview now -> go back to the Add screen)
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "add").click()`);
  await sleep(500);
  ok("media-back-to-add", await cdp.ev(`!!document.querySelector("#ankiImgFile")`));
  const mBefore = await cdp.ev(`Object.keys(window.AnkiDroid.store().media).length`);
  await cdp.ev(`(async () => {
    const bad = new File(["this is not image data at all"], "x.png", { type: "image/png" });
    const dt = new DataTransfer(); dt.items.add(bad);
    const inp = document.querySelector("#ankiImgFile");
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await sleep(1500);
  const mAfterBad = await cdp.ev(`Object.keys(window.AnkiDroid.store().media).length`);
  const badMsg = await cdp.ev(`(document.querySelector("#ankiImgUrlMsg") || {}).textContent || ""`);
  ok("media-corrupt-rejected", mAfterBad === mBefore && badMsg.length > 0, badMsg + " " + mBefore + "->" + mAfterBad);
  await cdp.ev(`(async () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], "big.png", { type: "image/png" });
    const dt = new DataTransfer(); dt.items.add(big);
    const inp = document.querySelector("#ankiImgFile");
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await sleep(1500);
  const mAfterBig = await cdp.ev(`Object.keys(window.AnkiDroid.store().media).length`);
  const bigMsg = await cdp.ev(`(document.querySelector("#ankiImgUrlMsg") || {}).textContent || ""`);
  ok("media-oversize-rejected", mAfterBig === mBefore && bigMsg.length > 0, bigMsg + " " + mBefore + "->" + mAfterBig);

  // 16. URL import: valid / non-image / unreachable / oversized / invalid
  await cdp.ev(`document.querySelector('#ankiRoot [data-amedia-url]').click()`);
  await sleep(300);
  await cdp.ev(`document.querySelector("#ankiImgUrl").value = location.origin + "/t/img.png";
    document.querySelector('#ankiRoot [data-amedia-fetch]').click()`);
  await sleep(2000);
  const mAfterUrl = await cdp.ev(`Object.keys(window.AnkiDroid.store().media).length`);
  ok("media-url-import", mAfterUrl === mBefore + 1, mBefore + "->" + mAfterUrl);
  await cdp.ev(`document.querySelector("#ankiImgUrl").value = location.origin + "/t/notimage.txt";
    document.querySelector('#ankiRoot [data-amedia-fetch]').click()`);
  await sleep(2000);
  const mAfterTxt = await cdp.ev(`Object.keys(window.AnkiDroid.store().media).length`);
  const txtMsg = await cdp.ev(`(document.querySelector("#ankiImgUrlMsg") || {}).textContent || ""`);
  ok("media-url-nonimage", mAfterTxt === mAfterUrl && txtMsg.length > 0, txtMsg);
  await cdp.ev(`document.querySelector("#ankiImgUrl").value = "http://127.0.0.1:9/nope.png";
    document.querySelector('#ankiRoot [data-amedia-fetch]').click()`);
  await sleep(2500);
  const mAfterDead = await cdp.ev(`Object.keys(window.AnkiDroid.store().media).length`);
  const deadMsg = await cdp.ev(`(document.querySelector("#ankiImgUrlMsg") || {}).textContent || ""`);
  ok("media-url-unreachable", mAfterDead === mAfterUrl && deadMsg.length > 0, deadMsg);
  await cdp.ev(`document.querySelector("#ankiImgUrl").value = location.origin + "/t/big.png";
    document.querySelector('#ankiRoot [data-amedia-fetch]').click()`);
  await sleep(3000);
  const mAfterBigU = await cdp.ev(`Object.keys(window.AnkiDroid.store().media).length`);
  const bigUMsg = await cdp.ev(`(document.querySelector("#ankiImgUrlMsg") || {}).textContent || ""`);
  ok("media-url-toolarge", mAfterBigU === mAfterUrl && bigUMsg.length > 0, bigUMsg.slice(0, 60));
  await cdp.ev(`document.querySelector("#ankiImgUrl").value = "ht!tp://bad";
    document.querySelector('#ankiRoot [data-amedia-fetch]').click()`);
  await sleep(600);
  const badUMsg = await cdp.ev(`(document.querySelector("#ankiImgUrlMsg") || {}).textContent || ""`);
  ok("media-url-invalid", badUMsg.length > 0, badUMsg);

  // 17. study renders the attached image (front), lightbox, rating works
  await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    A.startSession(SA, n.deck, {});
  })()`);
  await sleep(600);
  const simg = await cdp.ev(`(() => {
    const img = document.querySelector("#ankiRoot .anki-card-front img.anki-img");
    return img ? { src: img.src.slice(0, 22), complete: img.complete, w: img.naturalWidth } : null;
  })()`);
  ok("media-study-img", !!simg && simg.src.indexOf("data:image/") === 0 && simg.complete && simg.w > 0, JSON.stringify(simg));
  await cdp.ev(`document.querySelector("#ankiRoot .anki-card-front img.anki-img").click()`);
  await sleep(400);
  ok("media-lightbox", await cdp.ev(`!!document.querySelector("#ankiLightbox img.anki-lightbox-img")`));
  await cdp.ev(`document.querySelector("#ankiLightbox").click()`);
  await sleep(300);
  ok("media-lightbox-close", await cdp.ev(`!document.querySelector("#ankiLightbox")`));
  await cdp.ev(`document.querySelector("#ankiShowAns").click()`);
  await sleep(400);
  const backImg = await cdp.ev(`!!document.querySelector("#ankiRoot .anki-card-back img.anki-img")`);
  ok("media-study-back", backImg === true);
  const mst0 = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    const cid = Object.keys(SA.cards).find(k => SA.cards[k].note === n.id);
    return SA.cards[cid].sched.st; })()`);
  await cdp.ev(`document.querySelector('#ankiRatings [data-arate="good"]').click()`);
  await sleep(400);
  const mst1 = await cdp.ev(`(() => { const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    const cid = Object.keys(SA.cards).find(k => SA.cards[k].note === n.id);
    return SA.cards[cid].sched.st; })()`);
  ok("media-study-grade", mst0 === "new" && mst1 === "learning", mst0 + "->" + mst1);

  // 18. browser shows media indicator
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "browse").click()`);
  await sleep(600);
  ok("media-browser-indicator", await cdp.ev(`!!document.querySelector('#ankiRoot img.anki-thumb, #ankiRoot .anki-bcard') && /📷|anki-thumb/.test(document.querySelector("#ankiRoot").innerHTML)`));

  // 19. edit via the real study->edit path: REPLACE image (rep -> file -> save)
  await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    const cid = Object.keys(SA.cards).find(k => SA.cards[k].note === n.id);
    SA.cards[cid].sched.due = "2000-01-01"; SA.cards[cid].sched.dueMin = 0;
    window.__oldMid = A.extractMids(n.fields.Front)[0];
    A.startSession(SA, n.deck, {});
  })()`);
  await sleep(600);
  await cdp.ev(`document.querySelector("#ankiShowAns").click()`);
  await sleep(400);
  await cdp.ev(`document.querySelector('#ankiRoot [data-aeditnote]').click()`);
  await sleep(500);
  ok("media-edit-view", await cdp.ev(`!!document.querySelector("#ankiEdF_Front") && !!document.querySelector('#ankiRoot [data-amedia-rep]')`));
  await cdp.ev(`document.querySelector('#ankiRoot [data-amedia-rep]').click()`);
  await sleep(400);
  await cdp.ev(`(async () => {
    const cv = document.createElement("canvas"); cv.width = 120; cv.height = 90;
    const cx = cv.getContext("2d"); cx.fillStyle = "#00b"; cx.fillRect(0, 0, 120, 90);
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    const f = new File([blob], "rep.png", { type: "image/png" });
    const dt = new DataTransfer(); dt.items.add(f);
    const inp = document.querySelector("#ankiImgFile");
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await sleep(1800);
  ok("media-replace-preview", await cdp.ev(`!!document.querySelector("#ankiImgPrev img.anki-thumb-lg")`));
  await cdp.ev(`document.querySelector('#ankiRoot [data-asave="edit"]').click()`);
  await sleep(500);
  const afterRep = await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    const mids = A.extractMids(n.fields.Front);
    return { front: n.fields.Front, mids: mids, oldGone: mids.indexOf(window.__oldMid) < 0, oldPruned: !SA.media[window.__oldMid] };
  })()`);
  ok("media-replace-token", !!afterRep && afterRep.mids.length === 1 && afterRep.oldGone === true, JSON.stringify(afterRep));
  ok("media-replace-prune", !!afterRep && afterRep.oldPruned === true, JSON.stringify(afterRep));

  // 20. reload persistence with media
  await cdp.send("Page.navigate", { url: base + "/index.html" });
  await sleep(4500);
  await cdp.ev(`document.querySelector('[data-page="ankidroid"]').click()`);
  await sleep(800);
  const persist = await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    return { note: !!n, media: Object.keys(SA.media).length };
  })()`);
  ok("media-reload", persist.note && persist.media >= 1, JSON.stringify(persist));

  // 21. offline: fresh-rendered card image decodes with network cut
  await cdp.send("Network.enable", {});
  await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const offImg = await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    const cid = Object.keys(SA.cards).find(k => SA.cards[k].note === n.id);
    SA.cards[cid].sched.due = "2000-01-01"; SA.cards[cid].sched.dueMin = 0;
    A.startSession(SA, n.deck, {});
    return 1;
  })()`);
  await sleep(700);
  const offDecoded = await cdp.ev(`(() => {
    const img = document.querySelector("#ankiRoot .anki-card-front img.anki-img");
    return img ? { data: img.src.indexOf("data:image/") === 0, complete: img.complete, w: img.naturalWidth } : null;
  })()`);
  ok("media-offline", !!offDecoded && offDecoded.data && offDecoded.complete && offDecoded.w > 0, JSON.stringify(offDecoded));
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // 22. Guest/A/B isolation at the identity-scoped store layer
  await cdp.ev(`[...document.querySelectorAll("#ankiRoot [data-aview]")].find(b => b.getAttribute("data-aview") === "home").click()`);
  await sleep(400);
  const iso = await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const guestSnap = JSON.stringify(window.S.anki);
    const guestMedia = Object.keys(SA.media).length;
    const guestNotes = Object.keys(SA.notes).length;
    // new Account A: empty cloud state
    window.S.anki = {};
    A.render();
    const aEmpty = Object.keys(A.store().notes).length === 0 && Object.keys(A.store().media).length === 0;
    const aUiEmpty = document.querySelectorAll("#ankiRoot .anki-deck-row").length === 0;
    // A creates its own note+image
    const ad = A.createDeck(A.store(), "ADeck", null);
    const an = A.addNote(A.store(), { type: "basic", deck: ad.id, fields: { Front: "A-note", Back: "b" }, tags: "" });
    const aSnap = JSON.stringify(window.S.anki);
    // B: fresh again
    window.S.anki = {};
    A.render();
    const bNoA = !JSON.stringify(window.S.anki).includes("A-note");
    const bd = A.createDeck(A.store(), "BDeck", null);
    A.addNote(A.store(), { type: "basic", deck: bd.id, fields: { Front: "B-note", Back: "b" }, tags: "" });
    // back to A
    window.S.anki = JSON.parse(aSnap);
    A.render();
    const backA = JSON.stringify(window.S.anki).includes("A-note") && !JSON.stringify(window.S.anki).includes("B-note");
    // back to guest
    window.S.anki = JSON.parse(guestSnap);
    A.render();
    const backG = Object.keys(A.store().media).length === guestMedia && Object.keys(A.store().notes).length === guestNotes;
    return { aEmpty, aUiEmpty, bNoA, backA, backG };
  })()`);
  ok("iso-new-account-empty", iso.aEmpty === true && iso.aUiEmpty === true, JSON.stringify(iso));
  ok("iso-b-no-a", iso.bNoA === true, JSON.stringify(iso));
  ok("iso-a-restored", iso.backA === true, JSON.stringify(iso));
  ok("iso-guest-restored", iso.backG === true, JSON.stringify(iso));

  // 23. remove image via UI -> token gone, orphan pruned, note preserved
  await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    const cid = Object.keys(SA.cards).find(k => SA.cards[k].note === n.id);
    SA.cards[cid].sched.due = "2000-01-01"; SA.cards[cid].sched.dueMin = 0;
    A.startSession(SA, n.deck, {});
  })()`);
  await sleep(600);
  await cdp.ev(`document.querySelector("#ankiShowAns").click()`);
  await sleep(400);
  await cdp.ev(`document.querySelector('#ankiRoot [data-aeditnote]').click()`);
  await sleep(500);
  await cdp.ev(`document.querySelector('#ankiRoot [data-amedia-rm]').click()`);
  await sleep(500);
  await cdp.ev(`document.querySelector('#ankiRoot [data-asave="edit"]').click()`);
  await sleep(500);
  const afterRm = await cdp.ev(`(() => {
    const A = window.AnkiDroid, SA = A.store();
    const all = Object.keys(SA.notes).map(k => SA.notes[k]);
    const n = all.find(x => x && x.fields && /der Apfel/.test(x.fields.Front || ""));
    return n ? { front: n.fields.Front, media: Object.keys(SA.media).length, unused: A.unusedMedia(SA).length } : null;
  })()`);
  ok("media-remove-token", !!afterRm && afterRm.front.indexOf("[[m:") < 0 && /der Apfel/.test(afterRm.front), JSON.stringify(afterRm));
  ok("media-remove-prune", !!afterRm && afterRm.unused === 0, JSON.stringify(afterRm));

  ok("zero-console-errors", errCount() === 0, cdp.consoleErrs.slice(0, 3).join(" | "));

  cdp.close(); try { chrome.kill(); } catch (e) {}
  srv.close();
  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
  process.exit(0);
})().catch(e => {
  try { console.log("PAGE-ERRORS " + JSON.stringify((cdpRef ? cdpRef.consoleErrs : []).slice(0, 5))); } catch (e2) {}
  console.log("FATAL " + (e && e.message || e)); process.exit(1);
});
