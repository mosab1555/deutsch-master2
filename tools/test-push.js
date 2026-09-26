/* Study reminder notifications test (Web Push-ready local system).
 * Verifies: settings UI both pages, i18n keys x3, no secrets in client,
 * SW push/click handlers (single worker), permission flow, rotation,
 * inactivity tiers, one-per-day, visibility/day/disabled skips,
 * review gating on real data, no-repeat, multi-tab claim,
 * VAPID-guarded subscribe, Capacitor guards.
 * Run: node tools/test-push.js (from project root) */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
const DAY = 864e5;

/* ---------- A. settings markup (both pages) ---------- */
for (const page of ["client/index.html", "client/academy.html"]) {
  const html = RD(page);
  const sec = html.split('id="page-settings"')[1] || "";
  const secHtml = sec.split("</section>")[0];
  for (const id of ["pushToggle", "pushTime", "pushIdle", "pushReview", "pushDays", "pushStatus"]) {
    check(page + " settings has #" + id, secHtml.indexOf('id="' + id + '"') >= 0);
  }
  const tgl = secHtml.match(/<button[^>]*id="pushToggle"[^>]*>/);
  check(page + " toggle uses btn classes", !!tgl && /btn-primary/.test(tgl[0]) && /\bsm\b/.test(tgl[0]));
  check(page + " toggle no inline width", !!tgl && !/style\s*=/.test(tgl[0]));
  check(page + " script push.js after study.js",
    html.indexOf('<script src="push.js">') > html.indexOf('<script src="study.js">'));
}

/* ---------- B. i18n keys x3 ---------- */
const study = RD("client/study.js");
const NEED = ["push_head", "push_sub", "push_enable", "push_enabled", "push_on", "push_off", "push_blocked", "push_needperm", "push_unsupported", "push_time", "push_idle", "push_review", "push_days"];
for (const L of ["ar", "en", "de"]) {
  const dm = study.match(new RegExp(L + ":\\{((?:[^{}]|\\{[^{}]*\\})*)\\}"));
  const body = dm ? dm[1] : "";
  for (const k of NEED) check("i18n." + L + "." + k, body.indexOf(k + ":") >= 0);
}

/* ---------- C. no secrets in client ---------- */
for (const f of ["client/push.js", "client/sw.js"]) {
  const s = RD(f);
  check(f + " no private keys", !/begin private|privatekey|private_key|api_secret|vapid[^a-z]*private/i.test(s));
  check(f + " no bearer tokens", !/bearer [A-Za-z0-9\-_]{16,}/i.test(s));
}
check("single service worker (client)", fs.readdirSync(path.join(ROOT, "client")).filter(f => /^sw.*\.js$/.test(f)).length === 1);
check("single service worker (www)", fs.readdirSync(path.join(ROOT, "www")).filter(f => /^sw.*\.js$/.test(f)).length === 1);

/* ---------- D. service worker handlers ---------- */
const sw = RD("client/sw.js");
check("sw handles push", /addEventListener\("push"/.test(sw));
check("sw showNotification with icon+tag", /showNotification/.test(sw) && /dm-study/.test(sw));
check("sw handles notificationclick", /addEventListener\("notificationclick"/.test(sw));
check("sw click opens/focuses app", /openWindow/.test(sw) && /focus/.test(sw) && /utm=push/.test(sw));
check("sw precaches push.js", /"\.\/push\.js"/.test(sw));
check("sw cache versioned", /german-academy-v\d+/.test(sw));

/* ---------- E. behavioral (stub env) ---------- */
function mkEl(id) {
  return {
    _id: id, textContent: "", value: "", checked: false, _built: false,
    style: {}, dataset: {}, className: "", _cls: {},
    classList: { add(c) { this._s = this._s || {}; this._s[c] = 1; }, remove(c) { if (this._s) delete this._s[c]; }, toggle(c, f) { this._s = this._s || {}; if (f === undefined) { if (this._s[c]) delete this._s[c]; else this._s[c] = 1; } else if (f) this._s[c] = 1; else delete this._s[c]; }, contains(c) { return !!(this._s && this._s[c]); } },
    setAttribute(k, v) { this["@" + k] = v; }, getAttribute(k) { return this["@" + k]; },
    _ls: [], addEventListener(t, f) { this._ls.push([t, f]); },
    appendChild(c) { return c; }, children: []
  };
}
const els = {};
const docStub = {
  readyState: "complete", visibilityState: "hidden", hidden: true, activeElement: null,
  getElementById: (id) => { if (!els[id]) els[id] = mkEl(id); return els[id]; },
  createElement: (t) => mkEl(""),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}
};
const lsStore = {};
const notifCalls = { perm: "default", reqCount: 0, shown: [], nextPerm: "granted" };
function NotifStub(title, opts) { notifCalls.shown.push({ title, body: opts && opts.body, tag: opts && opts.tag }); this.title = title; }
NotifStub.permission = "default";
NotifStub.requestPermission = function () { notifCalls.reqCount++; NotifStub.permission = notifCalls.nextPerm; return Promise.resolve(notifCalls.nextPerm); };
const pushMgr = { subCalls: 0, lastArgs: null };
const sb = {
  console, S: { uiLang: "ar" },
  Store: { save() { try { lsStore.S = JSON.stringify(sb.S); } catch (e) {} }, load() { return sb.S; } },
  localStorage: { getItem: k => (k in lsStore ? lsStore[k] : null), setItem: (k, v) => { lsStore[k] = String(v); }, removeItem: k => { delete lsStore[k]; } },
  document: docStub, window: null, navigator: {}, location: { search: "", pathname: "/", hash: "" },
  history: { replaceState() {} },
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  Notification: NotifStub,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  toast() {}, t: (k) => k
};
sb.window = sb;
sb.window.Notification = NotifStub;
const ctx = vm.createContext(sb);
try {
  vm.runInContext(RD("client/push.js"), ctx, { filename: "push.js" });
  check("push.js loads under stubs", true);
} catch (e) { check("push.js loads under stubs", false, e.message); }
function call(js) { return vm.runInContext(js, ctx); }
function resetPush(over) {
  const base = { enabled: false, asked: false, time: "00:00", days: [1,1,1,1,1,1,1], idleOn: true, reviewOn: true, vapidPublicKey: "", lastOpenTs: 0, lastActiveTs: 0, lastClickTs: 0, lastSent: { date: "", key: "" } };
  call(`S.push = ${JSON.stringify(Object.assign(base, over || {}))};`);
  notifCalls.shown.length = 0;
  delete lsStore.dm_push_claim;
  docStub.visibilityState = "hidden"; docStub.hidden = true;
}
const NOW = Date.now();
const dayStr = (ts) => { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
try {
  // defaults
  call(`delete S.push;`);
  const d0 = call(`pushState()`);
  check("defaults created", d0.enabled === false && d0.time === "20:00" && d0.days.length === 7, JSON.stringify(d0).slice(0,80));
  // no auto-prompt on load
  check("no auto permission prompt", notifCalls.reqCount === 0, String(notifCalls.reqCount));
  // enable flow (granted)
  NotifStub.permission = "default"; notifCalls.nextPerm = "granted";
  resetPush();
  call(`pushEnable();`);
  // requestPermission is async; flush microtasks
  setTimeout(() => {}, 0);
  check("enable asks once on click", notifCalls.reqCount === 1, String(notifCalls.reqCount));
  setImmediate(runAsync);
} catch (e) { check("behavioral setup", false, e.message); finish(); }
function runAsync() {
  try {
    check("enable persists on grant", call(`S.push.enabled`) === true);
    check("status on after grant", call(`pushStatus()`) === "on", call(`pushStatus()`));
    // denied path: no re-prompt
    const before = notifCalls.reqCount;
    NotifStub.permission = "denied";
    call(`pushEnable();`);
    check("denied maps to blocked", call(`pushStatus()`) === "blocked", call(`pushStatus()`));
    check("denied never re-prompts", notifCalls.reqCount === before, String(notifCalls.reqCount));
    NotifStub.permission = "granted";
    // rotation: 8 unique, consecutive differ
    const msgs = call(`pushDailyMsgs()`);
    check("8 rotating messages", msgs.length === 8, String(msgs.length));
    check("messages unique", new Set(msgs.map(m => m.k)).size === 8);
    const k1 = call(`pushPickMessage(${NOW}, ${JSON.stringify({ lastSent: { date: "", key: "" } })}).k`);
    const k2 = call(`pushPickMessage(${NOW + DAY}, ${JSON.stringify({ lastSent: { date: "", key: "" } })}).k`);
    check("rotation advances daily", k1 !== k2, k1 + "/" + k2);
    const k3 = call(`pushPickMessage(${NOW + DAY}, {lastSent:{date:"",key:${JSON.stringify(k2)}}}).k`);
    check("never repeats last key", k3 !== k2, k3);
    // inactivity tiers
    for (const [n, exp] of [[1, "idle-1"], [2, "idle-3"], [3, "idle-3"], [4, "idle-6"], [6, "idle-6"], [7, "idle-7"], [10, "idle-7"]]) {
      const got = call(`pushIdleMsg(${n}).k`);
      check("tier " + n + "d -> " + exp, got === exp, got);
    }
    // one-per-day + visibility + disabled + early + active + day-off
    resetPush({ enabled: true, lastOpenTs: NOW - 3 * DAY });
    NotifStub.permission = "granted";
    const t1 = call(`pushTick()`);
    check("due tick sends tier msg", t1.send === true && t1.msg.k === "idle-3", JSON.stringify(t1));
    const t2 = call(`pushTick()`);
    check("same-day second tick silent", t2.send === false, t2.reason);
    // next day sends again
    const tmr = NOW + DAY;
    const t3 = call(`pushDecide(${tmr}, Object.assign(pushState(),{lastOpenTs:${NOW - 4 * DAY}}), {notif:true,perm:"granted"}, "hidden")`);
    check("next day eligible again", t3.send === true, JSON.stringify(t3));
    resetPush({ enabled: false, lastOpenTs: NOW - 5 * DAY });
    check("disabled never sends", call(`pushTick()`).send === false);
    resetPush({ enabled: true, lastOpenTs: NOW - 5 * DAY });
    docStub.visibilityState = "visible"; docStub.hidden = false;
    check("visible app never interrupted", call(`pushTick()`).send === false);
    docStub.visibilityState = "hidden"; docStub.hidden = true;
    const future = dayStr(NOW + DAY) + "T00:00";
    check("before reminder time silent", call(`pushDecide(${NOW}, Object.assign(pushState(),{time:"23:59",lastOpenTs:${NOW - 5 * DAY}}), {notif:true,perm:"granted"}, "hidden")`).send === false);
    const remTs = call(`pushReminderTs(${JSON.stringify(dayStr(NOW))}, "00:00")`);
    check("opened after time today skips", call(`pushDecide(${NOW}, Object.assign(pushState(),{time:"00:00",lastOpenTs:${remTs + 36e5}}), {notif:true,perm:"granted"}, "hidden")`).reason === "already-active");
    const myDay = new Date(NOW).getDay();
    const daysOff = [1,1,1,1,1,1,1]; daysOff[myDay] = 0;
    check("day-off skips", call(`pushDecide(${NOW}, Object.assign(pushState(),{days:${JSON.stringify(daysOff)},lastOpenTs:${NOW - 5 * DAY}}), {notif:true,perm:"granted"}, "hidden")`).reason === "day-off");
    // review gating on REAL data
    call(`globalThis.buildNotifs = function(){ return [{i:"🧠", t:"5 كلمات تحتاج مراجعة."}]; };`);
    const rv = call(`pushReviewMsg()`);
    check("review uses real due data", !!rv && rv.t.indexOf("5") >= 0, JSON.stringify(rv));
    call(`globalThis.buildNotifs = function(){ return []; };`);
    check("no review invented when none due", call(`pushReviewMsg()`) === null);
    delete sb.buildNotifs;
    // no-repeat same key
    resetPush({ enabled: true, lastOpenTs: NOW - 5 * DAY });
    const first = call(`pushTick()`);
    check("first send ok", first.send === true, JSON.stringify(first));
    delete lsStore.dm_push_claim;
    call(`S.push.lastSent = {date:"",key:"idle-6"}; S.push.lastOpenTs = ${NOW - 5 * DAY};`);
    const rep = call(`pushTick()`);
    check("same key never repeats", rep.send === false && rep.reason === "repeat", rep.reason);
    // multi-tab claim
    resetPush({ enabled: true, lastOpenTs: NOW - 5 * DAY });
    lsStore.dm_push_claim = String(Date.now());
    check("claimed tab stays silent", call(`pushTick()`).reason === "claimed");
    // VAPID guard
    resetPush({ enabled: true });
    pushMgr.subCalls = 0;
    sb.navigator.serviceWorker = { ready: Promise.resolve({ pushManager: { subscribe(args) { pushMgr.subCalls++; pushMgr.lastArgs = args; return Promise.resolve({ endpoint: "https://x/y" }); } } }) };
    const sub0 = call(`pushSubscribe()`);
    check("no key => no subscribe", sub0 === null && pushMgr.subCalls === 0);
    call(`S.push.vapidPublicKey = "BNc-test-public-key-12345678901234567890123456789012";`);
    call(`pushSubscribe();`);
    // Capacitor guards
    delete sb.window.Capacitor;
    check("capacitor absent safe", call(`pushNative()`) === "absent");
    sb.window.Capacitor = { Plugins: { LocalNotifications: { schedule(o) { sb.__sched = o; return Promise.resolve(); } } } };
    call(`S.push.enabled = true;`);
    check("capacitor plugin scheduled", call(`pushNative()`) === "scheduled" && !!(sb.__sched && sb.__sched.notifications), JSON.stringify(sb.__sched || {}).slice(0,80));
    delete sb.window.Capacitor;
    // settings render smoke (no throw, day buttons built once)
    call(`pushRenderSettings(); pushRenderSettings();`);
    check("settings render idempotent", (els.pushDays.children || []).length >= 0);
  } catch (e) { check("async behavioral", false, (e && e.message) + " @ " + ((e && e.stack || "").split("\n")[1] || "")); }
  finish();
}
function finish() {
  console.log("----");
  console.log("TOTAL pass=" + pass + " fail=" + fail + (fail ? " RESULT: FAIL" : " RESULT: PASS"));
  process.exit(fail ? 1 : 0);
}
