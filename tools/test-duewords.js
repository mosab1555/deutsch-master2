"use strict";
/* Differential test: new dueWords (decorate-sort) vs original (filter+sort).
 * Builds a synthetic bank + SRS state, runs both implementations, asserts
 * identical id order AND identical length. Run: node tools/test-duewords.js
 */
function todayStr(d) { const x = d || new Date(); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
let S;
function getStatus(id) { try { return ((S && S.status) || {})[id] || "new"; } catch (e) { return "new"; } }
function srsOverdue(id, today) {
  try {
    var t = today || todayStr();
    if (S.srs && S.srs[id] && S.srs[id].due && S.srs[id].due <= t) return true;
    const s = S.srs && S.srs[id];
    return !!(s && s.due && s.due <= t);
  } catch (e) { return false; }
}
function dueWordsOld(words) {
  const t = todayStr();
  return words.filter(w => {
    if (S.srs && S.srs[w.id] && S.srs[w.id].due && S.srs[w.id].due <= t) return true;
    if (srsOverdue(w.id, t)) return true;
    const st = getStatus(w.id); const r = S.review[w.id] || { c: 0, w: 0 };
    if (st === "known" && r.w === 0) return false;
    if (st === "known") return r.w > r.c;
    return true;
  }).sort((a, b) => {
    const aOverdue = (S.srs && S.srs[a.id] && S.srs[a.id].due && S.srs[a.id].due <= t) ? 1 : 0;
    const bOverdue = (S.srs && S.srs[b.id] && S.srs[b.id].due && S.srs[b.id].due <= t) ? 1 : 0;
    if (bOverdue !== aOverdue) return bOverdue - aOverdue;
    const oa = srsOverdue(a.id, t) ? 1 : 0, ob = srsOverdue(b.id, t) ? 1 : 0;
    if (ob !== oa) return ob - oa;
    const ra = S.review[a.id] || { c: 0, w: 0 }, rb = S.review[b.id] || { c: 0, w: 0 };
    const sa = (rb.w - rb.c) - (ra.w - ra.c);
    if (sa !== 0) return sa;
    const order = { hard: 0, review: 1, later: 2, new: 3, known: 4 };
    return (order[getStatus(a.id)] || 3) - (order[getStatus(b.id)] || 3);
  });
}
function dueWordsNew(words) {
  const t = todayStr();
  const order = { hard: 0, review: 1, later: 2, new: 3, known: 4 };
  const n = words.length;
  const rank = new Array(n);
  const idx = [];
  for (let k = 0; k < n; k++) {
    const w = words[k], id = w.id;
    const rec = S.srs && S.srs[id];
    const over = (rec && rec.due && rec.due <= t) ? 1 : 0;
    let so = 0;
    if (!over) so = srsOverdue(id, t) ? 1 : 0;
    const st = getStatus(id);
    const r = (S.review && S.review[id]) || { c: 0, w: 0 };
    if (!over && !so) {
      if (st === "known" && r.w === 0) continue;
      if (st === "known" && !(r.w > r.c)) continue;
    }
    let wc = r.w - r.c + 1048576;
    if (wc < 0) wc = 0; else if (wc > 2097151) wc = 2097151;
    const sr = (order[st] || 3);
    rank[k] = over * 562949953421312 + so * 281474976710656 + wc * 134217728 + (4 - sr) * 16777216 + (16777215 - k);
    idx.push(k);
  }
  idx.sort((a, b) => rank[b] - rank[a]);
  const m = idx.length;
  const out = new Array(m);
  for (let q = 0; q < m; q++) out[q] = words[idx[q]];
  return out;
}
// deterministic PRNG
let seed = 42;
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
const N = 60000;
const words = [];
for (let i = 0; i < N; i++) words.push({ id: "w" + i, de: "Wort" + i });
const statuses = ["new", "review", "hard", "known", "later", "weird"];
S = { status: {}, review: {}, srs: {} };
const t = todayStr();
for (let i = 0; i < N; i++) {
  const r = rnd();
  if (r < 0.4) S.status["w" + i] = statuses[Math.floor(rnd() * statuses.length)];
  if (rnd() < 0.3) S.review["w" + i] = { c: Math.floor(rnd() * 5), w: Math.floor(rnd() * 5) };
  if (rnd() < 0.2) {
    const d = new Date(); d.setDate(d.getDate() - Math.floor(rnd() * 10));
    const pad = (x) => String(x).padStart(2, "0");
    S.srs["w" + i] = { due: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) };
  }
}
let t0 = Date.now();
const a = dueWordsOld(words).map((w) => w.id);
const tOld = Date.now() - t0;
t0 = Date.now();
const b = dueWordsNew(words).map((w) => w.id);
const tNew = Date.now() - t0;
let same = a.length === b.length;
if (same) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
console.log("old len=" + a.length + " new len=" + b.length + " identical=" + same);
console.log("old ms=" + tOld + " new ms=" + tNew);
if (!same) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) { console.log("first diff at", i, a[i], b[i]); break; }
  }
  process.exit(1);
}
console.log("PASS duewords-equivalent");
