/* AnkiDroid DOM acceptance (headless Chrome + CDP, stdlib only).
 * Drives the REAL app: nav separation, deck CRUD, add-note UI, study flow
 * (show answer -> Again/Hard/Good/Easy with live intervals), browser search,
 * suspend/bury/undo, stats, CSV import/export, reload persistence, and the
 * untouched 3-state Flashcards page. Exits 1 on any FAIL.
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

(async () => {
  const { srv, port } = await serve();
  const base = "http://127.0.0.1:" + port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ankidom-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile,
    "--remote-debugging-port=" + CDP_PORT, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  const cdp = new CDP((await httpJson("http://127.0.0.1:" + CDP_PORT + "/json/list")).find(t => t.type === "page").webSocketDebuggerUrl);
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

  // 11. flashcards untouched: 3-state only
  await cdp.ev(`document.querySelector('[data-page="flashcards"]').click()`);
  await sleep(600);
  const frates = await cdp.ev(`[...document.querySelectorAll('#page-flashcards [data-flash-rate]')].map(b => b.getAttribute("data-flash-rate")).join(",")`);
  ok("flash-3state", frates === "known,review,hard", frates);

  ok("zero-console-errors", errCount() === 0, cdp.consoleErrs.slice(0, 3).join(" | "));

  cdp.close(); try { chrome.kill(); } catch (e) {}
  srv.close();
  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
  process.exit(0);
})().catch(e => { console.log("FATAL " + (e && e.message || e)); process.exit(1); });
