/* Deutsch Master - Study reminder notifications (ADDITIVE ONLY).
 *
 * Web layer (works on GitHub Pages, no backend):
 *  - explicit permission flow (button click only, never auto-prompts)
 *  - settings persisted in S.push (existing Store/localStorage, no new system)
 *  - daily reminder at user time, weekday selection, inactivity tiers,
 *    review reminders gated on REAL data (SRS/planner via buildNotifs())
 *  - one notification per day max, no repeats, skips when app is visible,
 *    multi-tab send-claim, timezone-safe epoch timestamps
 *  - Service Worker push + notificationclick live in sw.js (same worker)
 * Web Push (VAPID): subscribes ONLY when a public key is configured in
 *  S.push.vapidPublicKey (empty by default). No secrets ever in client code.
 * Android/Capacitor: uses LocalNotifications plugin ONLY if present at
 *  runtime (optional, guarded). webDir=www untouched, no new dependencies.
 */
"use strict";
/* ---------- defaults (persisted via existing Store) ---------- */
var PUSH_DAY_MS = 864e5;
var PUSH_CLAIM_MS = 45e3;
function pushDefaults() {
  return {
    enabled: false, asked: false,
    time: "20:00", days: [1, 1, 1, 1, 1, 1, 1],
    idleOn: true, reviewOn: true,
    vapidPublicKey: "",
    lastOpenTs: 0, lastActiveTs: 0, lastClickTs: 0,
    lastSent: { date: "", key: "" }
  };
}
function pushState() {
  try {
    if (typeof ensureStudy === "function") ensureStudy();
    if (!S.push) S.push = pushDefaults();
    else {
      const d = pushDefaults();
      for (const k in d) if (S.push[k] === undefined) S.push[k] = d[k];
    }
    return S.push;
  } catch (e) { return pushDefaults(); }
}
function pushSave() { try { if (typeof Store !== "undefined" && Store.save) Store.save(); else if (typeof save === "function") save(); } catch (e) {} }
/* ---------- environment ---------- */
function pushEnv() {
  let notif = false, sw = false, perm = "unsupported";
  try { notif = ("Notification" in window); } catch (e) {}
  try { sw = ("serviceWorker" in navigator); } catch (e) {}
  try { if (notif) perm = window.Notification.permission || "default"; } catch (e) {}
  return { notif, sw, perm };
}
/* Status: on | off | need-perm | blocked | unsupported */
function pushStatus() {
  const st = pushState(), env = pushEnv();
  if (!env.notif) return "unsupported";
  if (env.perm === "denied") return "blocked";
  if (!st.enabled) return "off";
  if (env.perm !== "granted") return "need-perm";
  return "on";
}
/* ---------- message catalog (rotated, never same twice in a row) ---------- */
function pushDailyMsgs() {
  return [
    { k: "daily-1", t: "🇩🇪 وقت الألماني! جاهز لدرس النهارده؟" },
    { k: "daily-2", t: "📚 10 دقائق ألماني النهارده ممكن تفرق معاك!" },
    { k: "daily-3", t: "🇩🇪 يلا نكمل رحلة الألماني!" },
    { k: "daily-4", t: "🔥 وقت المراجعة! Deutsch Master مستنيك." },
    { k: "daily-5", t: "📚 كلمة جديدة النهارده = خطوة لقدام!" },
    { k: "daily-6", t: "🇩🇪 الألماني عايز استمرارية، يلا نكمل!" },
    { k: "daily-7", t: "⭐ خمس دقائق مراجعة وتحافظ على مستواك!" },
    { k: "daily-8", t: "📚 Deutsch Master مستنيك — نكمل من مكان ما وقفت!" }
  ];
}
function pushIdleMsg(days) {
  if (days <= 1) return { k: "idle-1", t: "🇩🇪 وحشتنا! بقالك يوم مفتحتش Deutsch Master." };
  if (days <= 3) return { k: "idle-3", t: "🇩🇪 وحشتنا! بقالك " + days + " أيام مفتحتش Deutsch Master." };
  if (days <= 6) return { k: "idle-6", t: "📚 بقالك كام يوم بعيد عن الألماني، تعالى نرجع نكمل." };
  return { k: "idle-7", t: "🔥 رحلتك في الألماني لسه مستمرة، ارجع وكمل من مكان ما وقفت." };
}
/* Review content ONLY from real on-device data. Returns null when nothing is due. */
function pushReviewMsg() {
  try {
    if (typeof buildNotifs === "function") {
      const items = buildNotifs() || [];
      const rev = items.find(n => /🧠|📚/.test(n.i || ""));
      if (rev && rev.t) return { k: "review-due", t: "🧠 " + String(rev.t).slice(0, 90) };
    }
  } catch (e) {}
  return null;
}
function pushPickMessage(nowTs, st) {
  const dayIdx = new Date(nowTs).getDay();
  const pool = pushDailyMsgs().filter((m, i) => true);
  let pick = pool[Math.floor(nowTs / PUSH_DAY_MS) % pool.length];
  if (st.lastSent && st.lastSent.key === pick.k) pick = pool[(pool.indexOf(pick) + 3) % pool.length];
  return pick;
}
/* ---------- time helpers (epoch ms: immune to DST/reload issues) ---------- */
function pushDayStr(ts) {
  try {
    const d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  } catch (e) { return ""; }
}
function pushReminderTs(dateStr, hhmm) {
  try {
    const p = String(hhmm || "20:00").split(":");
    const d = new Date();
    const ymd = String(dateStr || "").split("-");
    d.setFullYear(+ymd[0], +ymd[1] - 1, +ymd[2]);
    d.setHours(+p[0] || 0, +p[1] || 0, 0, 0);
    return d.getTime();
  } catch (e) { return 0; }
}
/* ---------- multi-tab claim (localStorage, 45s window) ---------- */
function pushClaimed() {
  try {
    const raw = localStorage.getItem("dm_push_claim");
    if (!raw) return false;
    return (Date.now() - (+raw || 0)) < PUSH_CLAIM_MS;
  } catch (e) { return false; }
}
function pushClaim() {
  try { localStorage.setItem("dm_push_claim", String(Date.now())); } catch (e) {}
}
/* ---------- delivery ---------- */
function pushShow(title, body, tag) {
  try {
    const env = pushEnv();
    if (!env.notif || env.perm !== "granted") return false;
    const n = new Notification(title, {
      body: body, tag: tag || "dm-study",
      icon: "icons/icon-192.png", badge: "icons/icon-192.png",
      data: { url: "./index.html?utm=push" }
    });
    if (n && n.onclick === undefined) { try { n.onclick = function () { try { n.close(); } catch (e) {} }; } catch (e) {} }
    return true;
  } catch (e) { return false; }
}
/* Core decision: returns {send,msg,reason}. Pure-ish, fully unit-testable. */
function pushDecide(nowTs, st, env, visibility) {
  if (!st.enabled) return { send: false, reason: "disabled" };
  if (!env.notif) return { send: false, reason: "unsupported" };
  if (env.perm === "denied") return { send: false, reason: "blocked" };
  if (env.perm !== "granted") return { send: false, reason: "need-perm" };
  const today = pushDayStr(nowTs);
  if (st.lastSent && st.lastSent.date === today) return { send: false, reason: "already-sent" };
  const dayIdx = new Date(nowTs).getDay();
  if (!st.days || !st.days[dayIdx]) return { send: false, reason: "day-off" };
  if (nowTs < pushReminderTs(today, st.time)) return { send: false, reason: "too-early" };
  const openDay = st.lastOpenTs ? pushDayStr(st.lastOpenTs) : "";
  if (openDay === today && (st.lastOpenTs || 0) >= pushReminderTs(today, st.time)) return { send: false, reason: "already-active" };
  if (visibility === "visible") return { send: false, reason: "app-open" };
  // priority: inactivity tier > real review data > daily rotation
  let msg = null;
  if (st.idleOn && st.lastOpenTs) {
    const days = Math.floor((nowTs - st.lastOpenTs) / PUSH_DAY_MS);
    if (days >= 1) msg = pushIdleMsg(days);
  }
  if (!msg && st.reviewOn) msg = pushReviewMsg();
  if (!msg) msg = pushPickMessage(nowTs, st);
  if (st.lastSent && st.lastSent.key === msg.k) return { send: false, reason: "repeat" };
  return { send: true, msg: msg };
}
function pushTick() {
  try {
    const st = pushState();
    const env = pushEnv();
    let vis = "hidden";
    try { vis = document.visibilityState || "hidden"; } catch (e) {}
    const dec = pushDecide(Date.now(), st, env, vis);
    if (!dec.send) return dec;
    if (pushClaimed()) return { send: false, reason: "claimed" };
    pushClaim();
    const ok = pushShow("Deutsch Master", dec.msg.t, dec.msg.k);
    if (ok) {
      st.lastSent = { date: pushDayStr(Date.now()), key: dec.msg.k };
      pushSave();
      pushRenderSettings();
    }
    return ok ? { send: true, msg: dec.msg } : { send: false, reason: "show-failed" };
  } catch (e) { return { send: false, reason: "error" }; }
}
/* ---------- permission flow (explicit user gesture only) ---------- */
function pushEnable() {
  const st = pushState(), env = pushEnv();
  st.asked = true;
  if (!env.notif) { pushSave(); pushRenderSettings(); pushToast("push_unsupported"); return "unsupported"; }
  if (env.perm === "denied") { pushSave(); pushRenderSettings(); pushToast("push_blocked"); return "blocked"; }
  const done = (perm) => {
    if (perm === "granted") {
      st.enabled = true;
      pushSave();
      pushSubscribe();
      pushTick();
    } else {
      st.enabled = false;
      pushSave();
    }
    pushRenderSettings();
    return perm;
  };
  try {
    const r = window.Notification.requestPermission();
    if (r && typeof r.then === "function") r.then(done).catch(() => { pushSave(); pushRenderSettings(); });
    else done(window.Notification.permission);
  } catch (e) { pushSave(); pushRenderSettings(); }
  return "pending";
}
function pushDisable() {
  const st = pushState();
  st.enabled = false;
  pushSave();
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        if (reg && reg.pushManager) reg.pushManager.getSubscription().then(sub => { if (sub) sub.unsubscribe().catch(() => {}); }).catch(() => {});
      }).catch(() => {});
    }
  } catch (e) {}
  pushRenderSettings();
}
/* VAPID subscription: ONLY when a public key is configured. Never any secret here. */
function pushSubscribe() {
  try {
    const st = pushState();
    const key = (st.vapidPublicKey || "").trim();
    if (!key) return null;
    if (!navigator.serviceWorker || !navigator.serviceWorker.ready) return null;
    const env = pushEnv();
    if (env.perm !== "granted") return null;
    return navigator.serviceWorker.ready.then(reg => {
      if (!reg.pushManager) return null;
      return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushB64(key) }).then(sub => {
        st.pushSub = { endpoint: sub.endpoint || "" };
        pushSave();
        return st.pushSub;
      }).catch(() => null);
    }).catch(() => null);
  } catch (e) { return null; }
}
function pushB64(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
/* ---------- Capacitor (optional, runtime-guarded, no new deps) ---------- */
function pushNative() {
  try {
    const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
    if (!P) return "absent";
    const st = pushState();
    if (!st.enabled) return "off";
    if (typeof P.schedule !== "function") return "unsupported";
    const p = String(st.time || "20:00").split(":");
    P.schedule({ notifications: [{ id: 7, title: "Deutsch Master", body: "🇩🇪 وقت المذاكرة!", schedule: { on: { hour: +p[0] || 20, minute: +p[1] || 0 } }, smallIcon: "ic_launcher" }] }).catch(() => {});
    return "scheduled";
  } catch (e) { return "error"; }
}
/* ---------- settings UI ---------- */
function pushT(k, fb) {
  try { if (typeof t === "function") { const v = t(k); if (v && v !== k) return v; } } catch (e) {}
  return fb;
}
function pushToast(kind) {
  try {
    if (typeof toast !== "function") return;
    if (kind === "push_unsupported") toast("الإشعارات غير مدعومة على هذا المتصفح", "err");
    else if (kind === "push_blocked") toast("الإشعارات محظورة — فعّلها من إعدادات المتصفح/الهاتف", "err");
  } catch (e) {}
}
function pushShortDay(i) {
  try {
    const L = (typeof S !== "undefined" && S.uiLang) || "ar";
    const d = new Date(2026, 8, 6 + i);
    return d.toLocaleDateString(L === "de" ? "de-DE" : (L === "en" ? "en-US" : "ar-EG"), { weekday: "short" });
  } catch (e) { return ["S", "M", "T", "W", "T", "F", "S"][i] || ""; }
}
function pushRenderSettings() {
  try {
    const st = pushState();
    const btn = document.getElementById("pushToggle");
    if (btn) btn.textContent = st.enabled ? pushT("push_enabled", "🔔 مفعلة") : pushT("push_enable", "🔔 تفعيل تذكيرات المذاكرة");
    const tm = document.getElementById("pushTime");
    if (tm && document.activeElement !== tm) tm.value = st.time || "20:00";
    const io = document.getElementById("pushIdle");
    if (io) io.checked = !!st.idleOn;
    const rv = document.getElementById("pushReview");
    if (rv) rv.checked = !!st.reviewOn;
    const box = document.getElementById("pushDays");
    if (box && !box._built) {
      box._built = true;
      for (let i = 0; i < 7; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-ghost sm push-day";
        b.setAttribute("data-day", String(i));
        b.setAttribute("aria-pressed", st.days[i] ? "true" : "false");
        if (st.days[i]) b.classList.add("day-on");
        b.textContent = pushShortDay(i);
        b.addEventListener("click", () => {
          const s2 = pushState();
          s2.days[i] = s2.days[i] ? 0 : 1;
          b.classList.toggle("day-on", !!s2.days[i]);
          b.setAttribute("aria-pressed", s2.days[i] ? "true" : "false");
          pushSave();
        });
        box.appendChild(b);
      }
    }
    if (box && box._built) {
      Array.prototype.forEach.call(box.children, (b) => {
        const i = +b.getAttribute("data-day");
        b.classList.toggle("day-on", !!st.days[i]);
        b.setAttribute("aria-pressed", st.days[i] ? "true" : "false");
      });
    }
    const sp = document.getElementById("pushStatus");
    if (sp) {
      const s = pushStatus();
      sp.textContent = s === "on" ? pushT("push_on", "مفعلة ✅") :
        s === "blocked" ? pushT("push_blocked", "محظورة من المتصفح ⚠️") :
        s === "need-perm" ? pushT("push_needperm", "تحتاج إذن المتصفح") :
        s === "unsupported" ? pushT("push_unsupported", "غير مدعومة هنا") :
        pushT("push_off", "غير مفعلة");
    }
  } catch (e) {}
}
function pushWire() {
  try {
    const t0 = document.getElementById("pushToggle");
    if (t0 && !t0._wired) {
      t0._wired = true;
      t0.addEventListener("click", () => {
        const st = pushState();
        if (st.enabled) pushDisable();
        else pushEnable();
      });
    }
    const tm = document.getElementById("pushTime");
    if (tm && !tm._wired) {
      tm._wired = true;
      tm.addEventListener("change", () => {
        const st = pushState();
        if (/^\d{2}:\d{2}$/.test(tm.value)) { st.time = tm.value; pushSave(); }
        pushRenderSettings();
      });
    }
    const io = document.getElementById("pushIdle");
    if (io && !io._wired) { io._wired = true; io.addEventListener("change", () => { pushState().idleOn = !!io.checked; pushSave(); }); }
    const rv = document.getElementById("pushReview");
    if (rv && !rv._wired) { rv._wired = true; rv.addEventListener("change", () => { pushState().reviewOn = !!rv.checked; pushSave(); }); }
  } catch (e) {}
}
/* ---------- boot: record open AFTER reading previous stamp ---------- */
function pushBoot() {
  try {
    const st = pushState();
    let srcPush = false;
    try {
      if (location.search.indexOf("src=push") >= 0 || location.search.indexOf("utm=push") >= 0) {
        srcPush = true;
        st.lastClickTs = Date.now();
      }
    } catch (e) {}
    pushWire();
    pushRenderSettings();
    pushTick();
    try { pushNative(); } catch (e) {}
    st.lastOpenTs = Date.now();
    st.lastActiveTs = Date.now();
    pushSave();
    if (srcPush) {
      try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    }
    try {
      document.addEventListener("visibilitychange", () => {
        try {
          if (!document.hidden) {
            const s2 = pushState();
            s2.lastActiveTs = Date.now();
            pushSave();
            pushTick();
          }
        } catch (e) {}
      });
    } catch (e) {}
  } catch (e) {}
}
try {
  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pushBoot);
  } else if (typeof document !== "undefined") pushBoot();
} catch (e) {}
