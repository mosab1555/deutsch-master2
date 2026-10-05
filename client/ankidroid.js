/* Deutsch Master - AnkiDroid section (dedicated advanced SRS environment).
 *
 * Separate product from normal Flashcards (script.js buildFlash/renderFlash):
 *  - own page (#page-ankidroid, mount #ankiRoot), own deck/note/card store,
 *  - own scheduler usage (DMProgress.srsGrade New/Learning/Review/Relearning),
 *  - own UI workflow (deck list -> overview -> study -> Show Answer -> Again/
 *    Hard/Good/Easy), browser, note types, templates, stats, import/export.
 * Never touches flashcards state (S.srs/S.status) and flashcards never reads
 * S.anki. Collection lives in S.anki so identity isolation + cloud sync come
 * from the existing DMIdentity/save()/CloudSync architecture (per-uid keys,
 * owner-bound queue). No separate localStorage keys, no second sync engine.
 * Imported/user content is untrusted: always escaped before DOM insertion.
 */
(function () {
"use strict";

/* ================= A. utils ================= */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
  });
}
function T(k) { try { return (typeof window.t === "function" ? window.t(k) : k) || k; } catch (e) { return k; } }
function toastM(m, cls) { try { if (typeof window.toast === "function") window.toast(m, cls); } catch (e) {} }
function liveS() { try { return window.S || null; } catch (e) { return null; } }
/* Returns true when the collection snapshot reached storage. window.save
 * reports quota/private-mode failures (false) instead of throwing; older or
 * foreign save() implementations return undefined, which counts as success
 * so behavior never regresses where no status is available. */
function persist() {
  try {
    if (typeof window.save === "function") return window.save() !== false;
  } catch (e) { return false; }
  return true;
}
function uid(prefix) {
  return (prefix || "a") + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
function clampN(v, lo, hi, dflt) {
  v = parseInt(v, 10);
  if (!isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, v));
}
function todayKey(d) {
  try {
    if (window.DMProgress && typeof window.DMProgress.todayKey === "function") return window.DMProgress.todayKey(d);
  } catch (e) {}
  var x = d || new Date();
  function p(n) { return String(n).padStart(2, "0"); }
  return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate());
}
function isArabic(s) { return /[\u0600-\u06FF]/.test(String(s || "")); }
function dirOf(s) { return isArabic(s) ? "rtl" : "ltr"; }
function norm(s) {
  s = String(s == null ? "" : s);
  try { if (typeof window.dmNorm === "function") return window.dmNorm(s); } catch (e) {}
  return s.toLowerCase().trim();
}
var _cloudT = 0;
function scheduleCloud() {
  persist();
  try {
    var now = Date.now();
    if (now - _cloudT < 15000) return; /* coalesce: autosync covers the rest */
    _cloudT = now;
    var CS = window.CloudSync;
    if (CS && typeof CS.uploadChanges === "function") {
      var u = null;
      try { u = window.AuthModule && typeof window.AuthModule.getUser === "function" ? window.AuthModule.getUser() : null; } catch (e) {}
      var id = u && u.id ? u.id : null;
      if (!id) { try { id = window.DMIdentity && typeof window.DMIdentity.activeUid === "function" ? window.DMIdentity.activeUid() : null; } catch (e2) {} }
      if (id) { try { var r = CS.uploadChanges(id, liveS()); if (r && typeof r.catch === "function") r.catch(function () {}); } catch (e3) {} }
    }
  } catch (e) {}
}
function activeUid() {
  try { if (window.DMIdentity && typeof window.DMIdentity.activeUid === "function") return window.DMIdentity.activeUid() || "guest"; } catch (e) {}
  return "guest";
}

/* ================= B. store (identity-scoped via S.anki) ================= */
function defaultTypes() {
  return {
    basic: { id: "basic", name: "Basic", fields: ["Front", "Back"], templates: [{ name: "Forward", q: "{{Front}}", a: "{{Front}}<hr>{{Back}}" }] },
    basic_rev: { id: "basic_rev", name: "Basic + Reversed", fields: ["Front", "Back"], templates: [{ name: "Forward", q: "{{Front}}", a: "{{Front}}<hr>{{Back}}" }, { name: "Reversed", q: "{{Back}}", a: "{{Back}}<hr>{{Front}}" }] },
    vocab: { id: "vocab", name: "Vocabulary", fields: ["Front", "Back", "Example", "Pronunciation", "Extra"], templates: [{ name: "Forward", q: "{{Front}}", a: "{{Front}}<hr>{{Back}}" }] },
    article: { id: "article", name: "Article", fields: ["Word", "Article", "Plural", "Arabic"], templates: [{ name: "Forward", q: "{{Word}}", a: "{{Article}} {{Word}}<br>{{Plural}}<hr>{{Arabic}}" }] },
    sentence: { id: "sentence", name: "Sentence", fields: ["Sentence", "Translation", "Note"], templates: [{ name: "Forward", q: "{{Sentence}}", a: "{{Sentence}}<hr>{{Translation}}" }] },
    verb: { id: "verb", name: "Verb", fields: ["Infinitive", "Meaning", "Conjugation"], templates: [{ name: "Forward", q: "{{Infinitive}}", a: "{{Infinitive}}<hr>{{Meaning}}<br>{{Conjugation}}" }] },
    grammar: { id: "grammar", name: "Grammar", fields: ["Rule", "Explanation", "Example"], templates: [{ name: "Forward", q: "{{Rule}}", a: "{{Rule}}<hr>{{Explanation}}<br>{{Example}}" }] },
    listening: { id: "listening", name: "Listening", fields: ["Prompt", "Transcript", "Meaning"], templates: [{ name: "Forward", q: "{{Prompt}}", a: "{{Transcript}}<hr>{{Meaning}}" }] }
  };
}
function blankAnki() {
  return {
    v: 2, seq: 0,
    decks: {}, notes: {}, cards: {}, types: defaultTypes(), media: {},
    settings: { defaultDeck: null, newOrder: "level", reviewOrder: "overdue", autoplay: false, shortcuts: true, learnSteps: [10, 30], relearnSteps: [10], buryRollover: true },
    days: {}, log: [], lastDay: todayKey(), undo: null
  };
}
/* Live accessor: ALWAYS read through S (S is replaced on identity switch),
 * never cache the collection object across renders/sessions. */
function A() {
  var S = liveS();
  if (!S) return blankAnki();
  if (!S.anki || typeof S.anki !== "object" || Array.isArray(S.anki)) { S.anki = blankAnki(); persist(); }
  var a = S.anki;
  if (!a.decks || typeof a.decks !== "object") a.decks = {};
  if (!a.notes || typeof a.notes !== "object") a.notes = {};
  if (!a.cards || typeof a.cards !== "object") a.cards = {};
  if (!a.types || typeof a.types !== "object" || !Object.keys(a.types).length) a.types = defaultTypes();
  if (!a.settings || typeof a.settings !== "object") a.settings = blankAnki().settings;
  if (!a.days || typeof a.days !== "object") a.days = {};
  if (!Array.isArray(a.log)) a.log = [];
  if (!a.lastDay) a.lastDay = todayKey();
  /* v2 migration: media asset store. Everything else (notes, cards, decks,
     review history, settings) is preserved untouched. */
  if (!a.media || typeof a.media !== "object" || Array.isArray(a.media)) a.media = {};
  if (!a.v || a.v < 2) a.v = 2;
  /* day rollover: buried cards become available again (Anki bury rule) */
  try {
    var tk = todayKey();
    if (a.lastDay !== tk) {
      a.lastDay = tk;
      Object.keys(a.cards).forEach(function (id) { var c = a.cards[id]; if (c && c.buried) { c.buried = 0; } });
      persist();
    }
  } catch (e) {}
  return a;
}
function commit(cloud) {
  if (cloud === false) return persist();
  var ok = persist();
  scheduleCloud();
  return ok;
}

/* ================= C. scheduler (DMProgress.srsGrade, namespaced) ================= */
function schedOf(card) {
  var s = (card && card.sched) || {};
  return {
    st: /^(new|learning|review|relearning)$/.test(s.st) ? s.st : "new",
    step: Math.max(0, s.step | 0), iv: Math.max(0, s.iv | 0), laps: Math.max(0, s.laps | 0),
    ease: isFinite(+s.ease) && +s.ease > 0 ? +s.ease : 2.5,
    e: isFinite(+s.e) && +s.e > 0 ? +s.e : (isFinite(+s.ease) && +s.ease > 0 ? +s.ease : 2.5),
    due: typeof s.due === "string" && s.due ? s.due : todayKey(),
    dueMin: Math.max(0, s.dueMin | 0), last: typeof s.last === "string" ? s.last : null,
    miss: 0, reps: Math.max(0, s.reps | 0)
  };
}
/* Grade ONE anki card. Pure w.r.t. flashcards: touches only a.cards. */
function gradeCard(a, cardId, rating, nowMs) {
  var DP = window.DMProgress;
  if (!DP || typeof DP.srsGrade !== "function") return null;
  var card = a.cards[cardId];
  if (!card) return null;
  var now = (typeof nowMs === "number" && isFinite(nowMs)) ? nowMs : Date.now();
  var prev = schedOf(card);
  var adapter = { srs: {}, mistakes: {} };
  adapter.srs[cardId] = JSON.parse(JSON.stringify(prev));
  var out = DP.srsGrade(adapter, cardId, rating, now, false);
  card.sched = adapter.srs[cardId];
  return { prev: prev, next: out };
}
function previewInterval(a, cardId, rating) {
  try {
    var DP = window.DMProgress;
    if (!DP || typeof DP.srsGrade !== "function") return "";
    var card = a.cards[cardId];
    var base = card ? schedOf(card) : { st: "new", step: 0, iv: 0, laps: 0, ease: 2.5, e: 2.5, due: todayKey(), dueMin: 0, last: null, miss: 0, reps: 0 };
    var adapter = { srs: {}, mistakes: {} };
    adapter.srs.__pv = base;
    var r = DP.srsGrade(adapter, "__pv", rating, Date.now(), true);
    if (r.dueMin && r.dueMin > Date.now()) {
      var mins = Math.max(1, Math.round((r.dueMin - Date.now()) / 60000));
      return String(T("anki_inmin")).replace("{n}", mins);
    }
    return String(T("anki_indays")).replace("{n}", Math.max(1, r.intervalD || 1));
  } catch (e) { return ""; }
}
function cardDue(card, nowMs) {
  try {
    var DP = window.DMProgress;
    if (DP && typeof DP.srsIsDue === "function") return !!DP.srsIsDue(schedOf(card), nowMs);
  } catch (e) {}
  var s = schedOf(card);
  return !s.due || s.due <= todayKey(new Date(typeof nowMs === "number" ? nowMs : Date.now()));
}
function bucketOf(card, nowMs) {
  var s = schedOf(card);
  if (card.susp) return "suspended";
  if (card.buried) return "buried";
  if (s.st === "relearning") return cardDue(card, nowMs) ? "relearning" : "later";
  if (s.st === "learning") return cardDue(card, nowMs) ? "learning" : "later";
  if (s.st === "review") return cardDue(card, nowMs) ? "review" : "later";
  return "new";
}
/* ================= D. decks ================= */
function deckPath(a, id) {
  var parts = [], cur = a.decks[id], guard = 0;
  while (cur && guard++ < 25) { parts.unshift(cur.name); cur = cur.parent ? a.decks[cur.parent] : null; }
  return parts.join("::") || "?";
}
function childrenOf(a, id) {
  return Object.keys(a.decks).filter(function (k) { return a.decks[k] && a.decks[k].parent === id; }).sort(function (x, y) {
    return String(a.decks[x].name).localeCompare(String(a.decks[y].name));
  });
}
function descendants(a, id) {
  var out = [], stack = [id], guard = 0;
  while (stack.length && guard++ < 5000) {
    var cur = stack.pop();
    out.push(cur);
    childrenOf(a, cur).forEach(function (c) { stack.push(c); });
  }
  return out;
}
function deckOpts(a, id) {
  var d = a.decks[id] || {};
  var o = d.opts || {};
  var defNew = 20, defMax = 100;
  try {
    if (a.settings && isFinite(+a.settings.newPerDay)) defNew = clampN(a.settings.newPerDay, 0, 100, 20);
    if (a.settings && isFinite(+a.settings.maxReview)) defMax = clampN(a.settings.maxReview, 1, 500, 100);
  } catch (e) {}
  return {
    newPerDay: clampN(o.newPerDay, 0, 100, defNew),
    maxReview: clampN(o.maxReview, 1, 500, defMax)
  };
}
function cardsInDecks(a, ids) {
  var set = {};
  ids.forEach(function (id) { set[id] = 1; });
  return Object.keys(a.cards).map(function (k) { return a.cards[k]; }).filter(function (c) { return c && set[c.deck]; });
}
/* Counts for ONE deck subtree, from the real scheduler. */
function deckCounts(a, id, nowMs) {
  var now = (typeof nowMs === "number" && isFinite(nowMs)) ? nowMs : Date.now();
  var ids = descendants(a, id);
  var cards = cardsInDecks(a, ids);
  var c = { total: 0, new: 0, learning: 0, review: 0, relearning: 0, suspended: 0, buried: 0 };
  cards.forEach(function (card) {
    var b = bucketOf(card, now);
    c.total++;
    if (b === "new") c.new++;
    else if (b === "learning") c.learning++;
    else if (b === "review") c.review++;
    else if (b === "relearning") c.relearning++;
    else if (b === "suspended") c.suspended++;
    else if (b === "buried") c.buried++;
  });
  return c;
}
function createDeck(a, fullName, opts) {
  fullName = String(fullName || "").trim().replace(/\s*::\s*/g, "::").replace(/^:+|:+$/g, "");
  if (!fullName) return { error: "empty" };
  var parts = fullName.split("::").map(function (p) { return p.trim(); }).filter(Boolean);
  if (!parts.length) return { error: "empty" };
  var parentId = null, leafId = null;
  for (var i = 0; i < parts.length; i++) {
    var sib = childrenOf(a, parentId).filter(function (k) { return a.decks[k].name === parts[i]; })[0];
    if (sib) { parentId = sib; leafId = sib; continue; }
    var id = uid("d");
    a.decks[id] = { id: id, name: parts[i].slice(0, 80), parent: parentId, opts: {}, collapsed: false, created: Date.now() };
    parentId = id; leafId = id;
  }
  if (opts && leafId) a.decks[leafId].opts = opts;
  if (!a.settings.defaultDeck) a.settings.defaultDeck = leafId;
  commit();
  return { id: leafId };
}
function renameDeck(a, id, newLeafName) {
  var d = a.decks[id];
  if (!d) return false;
  newLeafName = String(newLeafName || "").trim().replace(/::/g, "").slice(0, 80);
  if (!newLeafName) return false;
  var clash = childrenOf(a, d.parent).some(function (k) { return k !== id && a.decks[k].name === newLeafName; });
  if (clash) return false;
  d.name = newLeafName;
  commit();
  return true;
}
function deleteDeck(a, id, moveToId) {
  var d = a.decks[id];
  if (!d) return { error: "missing" };
  var kids = childrenOf(a, id);
  if (kids.length) return { error: "has-children" };
  var cards = cardsInDecks(a, [id]);
  if (cards.length && !moveToId) return { error: "has-cards", count: cards.length };
  if (cards.length) {
    if (!a.decks[moveToId] || moveToId === id) return { error: "bad-target" };
    cards.forEach(function (c) { c.deck = moveToId; });
  }
  delete a.decks[id];
  if (a.settings.defaultDeck === id) a.settings.defaultDeck = moveToId || Object.keys(a.decks)[0] || null;
  commit();
  return { ok: true, moved: cards.length };
}

/* ================= E. notes, cards, templates ================= */
function vocabById(id) {
  try {
    if (typeof window.wordById === "function") { var w = window.wordById(id); if (w) return w; }
    if (typeof window.allWords === "function") {
      var all = window.allWords();
      for (var i = 0; i < all.length; i++) if (all[i] && all[i].id === id) return all[i];
    }
  } catch (e) {}
  return null;
}
/* Notes either carry inline fields or reference app content (no duplication).
 * Image tokens ([[m:<mid>]]) stored in note.fields are merged into resolved
 * fields too, so generated (vocab-ref) cards keep their attached images. */
function resolveFields(note) {
  if (!note) return {};
  if (note.ref && note.ref.kind === "vocab") {
    var w = vocabById(note.ref.id);
    if (w) {
      var de = ((w.art && w.art !== "-") ? w.art + " " : "") + (w.de || "");
      var F = { Front: de, Back: w.ar || "", Example: w.ex || "", Pronunciation: w.pron || "", Extra: w.exAr || "", Word: w.de || "", Article: w.art || "-", Plural: "", Arabic: w.ar || "", Sentence: w.ex || "", Translation: w.exAr || "", Infinitive: w.de || "", Meaning: w.ar || "", Conjugation: "", Rule: "", Explanation: "", Prompt: de, Transcript: de, _level: w.level || "", _kapitel: w.kap || "", _cat: w.cat || "" };
      try {
        Object.keys(note.fields || {}).forEach(function (f) {
          var toks = extractMids(String(note.fields[f] || ""));
          if (toks.length && F[f] !== undefined) F[f] = String(F[f] || "") + " " + toks.map(function (m) { return "[[m:" + m + "]]"; }).join(" ");
        });
      } catch (e) {}
      return F;
    }
  }
  return Object.assign({}, note.fields || {});
}
/* Render a field value: escape everything, then expand KNOWN media tokens
 * into <img> tags (unknown/missing assets render nothing, never raw HTML). */
function renderFieldHTML(a, text, thumb) {
  var parts = String(text == null ? "" : text).split(/\[\[m:([A-Za-z0-9]+)\]\]/g);
  var out = "";
  for (var i = 0; i < parts.length; i += 2) {
    out += esc(parts[i]).replace(/\n/g, "<br>");
    var mid = parts[i + 1];
    if (mid !== undefined) {
      var m = a && a.media ? a.media[mid] : null;
      if (m && m.data) {
        var src = (thumb && m.thumb) ? m.thumb : m.data;
        out += '<img class="anki-img" loading="lazy" decoding="async" src="' + esc(src) + '" alt="" data-amedia="' + esc(mid) + '">';
      }
    }
  }
  return out;
}
function applyTemplate(fmt, fields, a, thumb) {
  return String(fmt == null ? "" : fmt).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, function (m, name) {
    var v = fields[name];
    if (v == null) return "";
    if (a) return renderFieldHTML(a, String(v), thumb);
    return esc(String(v)).replace(/\n/g, "<br>");
  });
}
function cardSides(a, card) {
  var note = a.notes[card.note];
  if (!note) return { front: "", back: "" };
  var type = a.types[note.type] || a.types.basic;
  var tmpl = (type.templates || [])[card.tmpl | 0] || (type.templates || [])[0] || { q: "{{Front}}", a: "{{Back}}" };
  var F = resolveFields(note);
  /* reversed cards swap Front/Back before templating */
  if (card.dir === "rev") { var t = F.Front; F.Front = F.Back; F.Back = t; }
  return { front: applyTemplate(tmpl.q, F, a, false), back: applyTemplate(tmpl.a, F, a, false), fields: F, tmplName: tmpl.name || "" };
}
function addNote(a, spec) {
  spec = spec || {};
  var type = a.types[spec.type] || a.types.basic;
  /* Validate BEFORE touching decks/notes: a note type with zero templates
   * would produce an unreviewable phantom note, and an empty front must not
   * leave behind an auto-created empty deck either. */
  if (!type.templates || !type.templates.length) return { error: "empty-templates" };
  var fields = {};
  (type.fields || []).forEach(function (f) { fields[f] = String(spec.fields && spec.fields[f] != null ? spec.fields[f] : "").slice(0, 4000); });
  if (!String(fields[type.fields[0]] || "").trim() && !spec.ref) return { error: "empty-front" };
  var deckId = spec.deck && a.decks[spec.deck] ? spec.deck : a.settings.defaultDeck;
  if (!deckId || !a.decks[deckId]) {
    var r = createDeck(a, "Deutsch", null);
    deckId = r.id;
  }
  var tags = Array.isArray(spec.tags) ? spec.tags : String(spec.tags || "").split(/[,،\s]+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  tags = tags.filter(function (t, i) { return tags.indexOf(t) === i; }).slice(0, 20);
  var nid = uid("n");
  var note = { id: nid, type: type.id, deck: deckId, fields: fields, tags: tags, created: Date.now(), modified: Date.now() };
  if (spec.ref && spec.ref.kind === "vocab" && spec.ref.id) { note.ref = { kind: "vocab", id: String(spec.ref.id) }; note.fields = {}; }
  a.notes[nid] = note;
  var made = [];
  (type.templates || [{ name: "Forward" }]).forEach(function (tm, idx) {
    var cid = uid("c");
    a.cards[cid] = { id: cid, note: nid, deck: deckId, tmpl: idx, dir: /rev/i.test(tm.name || "") ? "rev" : "fwd", sched: { st: "new", step: 0, iv: 0, laps: 0, ease: 2.5, e: 2.5, due: todayKey(), dueMin: 0, last: null, miss: 0, reps: 0 }, susp: false, buried: 0, created: Date.now() };
    made.push(cid);
  });
  /* Never claim success when the snapshot did not reach storage (quota /
   * private mode): roll the in-memory objects back so browser/counts/queue
   * cannot show a phantom card, and report the real failure. */
  if (!commit()) {
    made.forEach(function (cid) { delete a.cards[cid]; });
    delete a.notes[nid];
    return { error: "persist-failed" };
  }
  return { note: nid, cards: made };
}
function editNote(a, nid, patch) {
  var note = a.notes[nid];
  if (!note) return { error: "missing" };
  patch = patch || {};
  if (patch.fields) {
    var type = a.types[note.type] || a.types.basic;
    (type.fields || []).forEach(function (f) {
      if (patch.fields[f] !== undefined) note.fields[f] = String(patch.fields[f]).slice(0, 4000);
    });
    note.modified = Date.now();
  }
  if (patch.tags !== undefined) {
    var tags = Array.isArray(patch.tags) ? patch.tags : String(patch.tags || "").split(/[,،\s]+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    note.tags = tags.filter(function (t, i) { return tags.indexOf(t) === i; }).slice(0, 20);
    note.modified = Date.now();
  }
  if (patch.deck && a.decks[patch.deck] && patch.deck !== note.deck) {
    note.deck = patch.deck;
    Object.keys(a.cards).forEach(function (k) { var c = a.cards[k]; if (c && c.note === nid) c.deck = patch.deck; });
    note.modified = Date.now();
  }
  var pok = commit();
  return pok ? { ok: true } : { error: "persist-failed" };
}
function deleteNote(a, nid) {
  if (!a.notes[nid]) return false;
  Object.keys(a.cards).forEach(function (k) { if (a.cards[k] && a.cards[k].note === nid) delete a.cards[k]; });
  delete a.notes[nid];
  commit();
  pruneMedia(a);
  return true;
}
/* Change note type: keep shared field names, warn (caller confirms) when cards change count. */
function changeNoteType(a, nid, newTypeId) {
  var note = a.notes[nid];
  var nt = a.types[newTypeId];
  if (!note || !nt || note.ref) return { error: "unsupported" };
  var oldCount = Object.keys(a.cards).filter(function (k) { return a.cards[k] && a.cards[k].note === nid; }).length;
  var nf = {};
  (nt.fields || []).forEach(function (f) { nf[f] = note.fields && note.fields[f] != null ? String(note.fields[f]) : ""; });
  note.fields = nf;
  note.type = newTypeId;
  note.modified = Date.now();
  Object.keys(a.cards).forEach(function (k) { if (a.cards[k] && a.cards[k].note === nid) delete a.cards[k]; });
  var made = [];
  (nt.templates || [{ name: "Forward" }]).forEach(function (tm, idx) {
    var cid = uid("c");
    a.cards[cid] = { id: cid, note: nid, deck: note.deck, tmpl: idx, dir: /rev/i.test(tm.name || "") ? "rev" : "fwd", sched: { st: "new", step: 0, iv: 0, laps: 0, ease: 2.5, e: 2.5, due: todayKey(), dueMin: 0, last: null, miss: 0, reps: 0 }, susp: false, buried: 0, created: Date.now() };
    made.push(cid);
  });
  commit();
  return { ok: true, before: oldCount, after: made.length };
}

/* ================= F. seed from app content (references, not copies) ================= */
function seedFromContent(a, scope) {
  var words = [];
  try { words = typeof window.allWords === "function" ? window.allWords() : []; } catch (e) { words = []; }
  if (!words.length) return { error: "no-content" };
  scope = scope || "levels";
  var groups = {};
  words.forEach(function (w) {
    if (!w || !w.id) return;
    var key = scope === "kapitel" ? ("K " + (w.kap || "KX")) : String(w.level || "A1");
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  });
  var made = { decks: 0, cards: 0 };
  Object.keys(groups).sort().forEach(function (g) {
    var r = createDeck(a, scope === "kapitel" ? ("Deutsch::Kapitel::" + g) : ("Deutsch::" + g), null);
    var deckId = r.id;
    made.decks++;
    groups[g].forEach(function (w) {
      var dup = Object.keys(a.cards).some(function (k) {
        var c = a.cards[k];
        if (!c || c.deck !== deckId) return false;
        var n = a.notes[c.note];
        return n && n.ref && n.ref.id === w.id;
      });
      if (dup) return;
      var res = addNote(a, { type: "vocab", deck: deckId, ref: { kind: "vocab", id: w.id }, tags: [String(w.level || "a1").toLowerCase(), String(w.kap || "kx").toLowerCase()] });
      if (res.cards) made.cards += res.cards.length;
    });
  });
  /* verbs view */
  var verbs = words.filter(function (w) { return w && w.type === "فعل"; });
  if (verbs.length && scope === "levels") {
    var rv = createDeck(a, "Deutsch::Verbs", null);
    made.decks++;
    verbs.forEach(function (w) {
      var res = addNote(a, { type: "verb", deck: rv.id, ref: { kind: "vocab", id: w.id }, tags: ["verb", String(w.level || "a1").toLowerCase()] });
      if (res.cards) made.cards += res.cards.length;
    });
  }
  commit();
  return made;
}

/* ================= G. study queue (daily limits + subdecks) ================= */
function mistakeCount(id) {
  try { var S = liveS(); return (S && S.mistakes && S.mistakes[id] && S.mistakes[id].n) | 0; } catch (e) { return 0; }
}
function buildQueue(a, deckId, opts) {
  opts = opts || {};
  var now = (typeof opts.nowMs === "number" && isFinite(opts.nowMs)) ? opts.nowMs : Date.now();
  if (!a.decks[deckId]) return { items: [], counts: { relearning: 0, learning: 0, review: 0, new: 0, total: 0 } };
  var o = deckOpts(a, deckId);
  var maxNew = opts.newPerDay !== undefined ? Math.max(0, opts.newPerDay | 0) : o.newPerDay;
  var maxTotal = opts.maxReview !== undefined ? Math.max(1, opts.maxReview | 0) : o.maxReview;
  var lists = { relearning: [], learning: [], review: [], new: [] };
  var ids = descendants(a, deckId);
  var cards = cardsInDecks(a, ids);
  var scope = opts.onlyIds ? opts.onlyIds : null;
  var set = null;
  if (scope) { set = {}; scope.forEach(function (id) { set[id] = 1; }); }
  cards.forEach(function (card) {
    if (!card || card.susp || card.buried) return;
    if (set && !set[card.id]) return;
    if (opts.ahead && opts.ahead !== true) { /* placeholder for future modes */ }
    var b = bucketOf(card, now);
    if (b === "relearning") lists.relearning.push(card);
    else if (b === "learning") lists.learning.push(card);
    else if (b === "review") lists.review.push(card);
    else if (b === "new") lists.new.push(card);
  });
  function byDueMin(x, y) { return (x.sched.dueMin | 0) - (y.sched.dueMin | 0); }
  function byOverdueThenMiss(x, y) {
    var xd = x.sched.due || "", yd = y.sched.due || "";
    if (xd !== yd) return xd < yd ? -1 : 1;
    return mistakeCount(y.note) - mistakeCount(x.note);
  }
  lists.relearning.sort(byDueMin);
  lists.learning.sort(byDueMin);
  lists.review.sort((a.settings.reviewOrder === "mistakes" ? function (x, y) { return mistakeCount(y.note) - mistakeCount(x.note); } : byOverdueThenMiss));
  if (a.settings.newOrder === "random") {
    for (var i = lists.new.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = lists.new[i]; lists.new[i] = lists.new[j]; lists.new[j] = t; }
  }
  var items = lists.relearning.concat(lists.learning, lists.review, lists.new.slice(0, maxNew)).slice(0, maxTotal);
  if (opts.includeAhead && !items.length) {
    /* custom study "ahead": allow not-yet-due review cards when nothing is due */
    var ahead = cards.filter(function (card) {
      return card && !card.susp && !card.buried && schedOf(card).st === "review" && bucketOf(card, now) === "later";
    }).sort(byOverdueThenMiss).slice(0, Math.min(maxTotal, opts.limit | 0 || 20));
    items = ahead;
  }
  return { items: items, counts: { relearning: lists.relearning.length, learning: lists.learning.length, review: lists.review.length, new: Math.min(lists.new.length, maxNew), total: items.length } };
}
/* ================= H. search =================
 * Tokens (AND): plain text, deck:X (prefix incl. children), tag:X, is:new/
 * learn/learning/review/relearn/due/suspended/buried/today, type:X, level:X,
 * kapitel:X. Exact full Anki query syntax is NOT claimed (see limitations). */
function parseSearch(q) {
  var toks = String(q || "").split(/\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
  return toks.map(function (tok) {
    var neg = tok[0] === "-" ? tok.slice(1) : tok;
    var m = neg.match(/^([a-z]+):(.*)$/);
    if (!m) return { kind: "text", v: norm(neg), neg: tok[0] === "-" };
    return { kind: m[1].toLowerCase(), v: norm(m[2]), neg: tok[0] === "-" };
  });
}
function cardMatches(a, card, note, F, conds, nowMs) {
  for (var i = 0; i < conds.length; i++) {
    var cd = conds[i], hit = false;
    if (cd.kind === "text") {
      var hay = norm([F.Front, F.Back, F.Example, F.Word, F.Sentence, F.Meaning, (note.tags || []).join(" "), deckPath(a, card.deck)].join(" "));
      hit = hay.indexOf(cd.v) >= 0;
    } else if (cd.kind === "deck") {
      hit = norm(deckPath(a, card.deck)).indexOf(cd.v) === 0 || norm(deckPath(a, card.deck)).indexOf(cd.v) >= 0;
    } else if (cd.kind === "tag") {
      hit = (note.tags || []).some(function (t) { return norm(t) === cd.v || norm(t).indexOf(cd.v) >= 0; });
    } else if (cd.kind === "is") {
      var b = bucketOf(card, nowMs);
      var s = schedOf(card);
      hit = (cd.v === "new" && b === "new") || ((cd.v === "learn" || cd.v === "learning") && (b === "learning" || s.st === "learning")) ||
        (cd.v === "review" && (b === "review" || s.st === "review")) ||
        ((cd.v === "relearn" || cd.v === "relearning") && (b === "relearning" || s.st === "relearning")) ||
        (cd.v === "due" && (b === "new" || b === "learning" || b === "review" || b === "relearning")) ||
        (cd.v === "suspended" && !!card.susp) || (cd.v === "buried" && !!card.buried) ||
        (cd.v === "today" && (card.sched.last === todayKey()));
    } else if (cd.kind === "type") {
      hit = norm(note.type).indexOf(cd.v) >= 0;
    } else if (cd.kind === "level") {
      hit = norm(F._level || "").indexOf(cd.v) >= 0;
    } else if (cd.kind === "kapitel" || cd.kind === "kap") {
      hit = norm(F._kapitel || "").indexOf(cd.v) >= 0;
    } else { hit = true; }
    if (cd.neg) hit = !hit;
    if (!hit) return false;
  }
  return true;
}
function searchCards(a, q, nowMs) {
  var conds = parseSearch(q);
  var out = [];
  Object.keys(a.cards).forEach(function (k) {
    var card = a.cards[k];
    if (!card) return;
    var note = a.notes[card.note];
    if (!note) return;
    if (cardMatches(a, card, note, resolveFields(note), conds, nowMs)) out.push(card);
  });
  return out;
}

/* ================= I. CSV (honest scope: CSV only, no .apkg) ================= */
function parseCSV(text) {
  var rows = [], row = [], cell = "", q = false, i = 0;
  text = String(text || "").replace(/^\uFEFF/, "");
  while (i < text.length) {
    var ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { q = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += ch; i++;
  }
  row.push(cell); rows.push(row);
  return rows.filter(function (r) { return r.length > 1 || String(r[0] || "").trim() !== ""; });
}
function csvCell(v) {
  v = String(v == null ? "" : v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function importRows(a, rows, opts) {
  opts = opts || {};
  var report = { total: 0, added: 0, skipped: 0, errors: [] };
  if (!rows.length) return report;
  var head = rows[0].map(function (h) { return norm(h); });
  var hasHead = head.indexOf("front") >= 0 && head.indexOf("back") >= 0;
  var idx = { front: 0, back: 1, deck: 2, tags: 3, type: 4, extra: 5 };
  if (hasHead) {
    idx = { front: head.indexOf("front"), back: head.indexOf("back"), deck: head.indexOf("deck"), tags: head.indexOf("tags"), type: head.indexOf("type"), extra: head.indexOf("extra") };
  }
  var start = hasHead ? 1 : 0;
  for (var r = start; r < rows.length; r++) {
    var row = rows[r];
    report.total++;
    var front = String(row[idx.front] || "").trim().slice(0, 2000);
    var back = idx.back >= 0 ? String(row[idx.back] || "").trim().slice(0, 2000) : "";
    if (!front || !back) { report.skipped++; report.errors.push("row " + (r + 1) + ": empty front/back"); continue; }
    var deckName = idx.deck >= 0 && row[idx.deck] ? String(row[idx.deck]).trim() : (opts.deck || "Deutsch");
    var dr = createDeck(a, deckName, null);
    var dup = Object.keys(a.cards).some(function (k) {
      var c = a.cards[k];
      if (!c || c.deck !== dr.id) return false;
      var n = a.notes[c.note];
      if (!n || n.ref) return false;
      var F = resolveFields(n);
      return norm(F.Front) === norm(front);
    });
    if (dup) { report.skipped++; report.errors.push("row " + (r + 1) + ": duplicate"); continue; }
    var typeId = idx.type >= 0 && row[idx.type] && a.types[String(row[idx.type]).trim()] ? String(row[idx.type]).trim() : "basic";
    var spec = { type: typeId, deck: dr.id, fields: { Front: front, Back: back }, tags: idx.tags >= 0 ? String(row[idx.tags] || "") : "" };
    if (idx.extra >= 0 && row[idx.extra]) spec.fields.Extra = String(row[idx.extra]).slice(0, 2000);
    var res = addNote(a, spec);
    if (res.error) { report.skipped++; report.errors.push("row " + (r + 1) + ": " + res.error); }
    else report.added++;
    if (report.errors.length > 40) { report.errors.push("…"); break; }
  }
  return report;
}
function exportCSV(a, cardIds) {
  var lines = ["Front,Back,Deck,Tags,Type,Interval,State,Due"];
  cardIds.forEach(function (k) {
    var c = a.cards[k];
    if (!c) return;
    var n = a.notes[c.note];
    if (!n) return;
    var F = resolveFields(n);
    lines.push([F.Front || "", F.Back || "", deckPath(a, c.deck), (n.tags || []).join(" "), n.type, c.sched.iv | 0, c.sched.st, c.sched.due || ""].map(csvCell).join(","));
  });
  return lines.join("\n");
}

/* ================= I2. media assets (images attached to notes) =============
 * Architecture: Note/Card field text --contains--> token [[m:<mid>],
 * media store a.media --holds--> one optimized asset per hash. Shared images
 * are stored once and reused (dedup by content hash). Assets are data URLs,
 * so cards render offline; the collection syncs through the existing
 * identity-scoped S.anki snapshot (no second sync engine, no extra keys).
 * Security: only raster formats (jpeg/png/webp/gif-first-frame); SVG is
 * rejected (scriptable). Every asset is re-encoded through canvas, which
 * neutralizes embedded payloads. Remote URLs are never hot-linked: the
 * bytes are imported locally or the import fails with a clear error.
 * GIF note: canvas captures the first frame, so animated GIFs become stills.
 */
var MEDIA_MAX_FILE = 8 * 1024 * 1024;    /* upload input cap */
var MEDIA_MAX_DIM = 1280;                /* longest stored edge (px) */
var MEDIA_MAX_BYTES = 500 * 1024;        /* stored asset cap */
var MEDIA_BUDGET = 3 * 1024 * 1024;      /* whole-collection media cap */
var MEDIA_FETCH_TIMEOUT = 30000;
var MEDIA_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
var MEDIA_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
function mediaHash(s) {
  var h1 = 0x811c9dc5, h2 = 0x01000193;
  s = String(s || "");
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 31) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}
function extOf(name) {
  var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/);
  return m ? m[1] : "";
}
/* Pure validators (DOM-free, unit-tested). Decode is always the final proof. */
function validateImageFile(file) {
  if (!file) return { error: "bad-file" };
  var name = String(file.name || ""), type = String(file.type || "").toLowerCase().split(";")[0].trim();
  var size = +file.size;
  if (!(size > 0)) return { error: "bad-file" };
  if (size > MEDIA_MAX_FILE) return { error: "too-large" };
  var ext = extOf(name);
  if (ext === "svg" || type === "image/svg+xml") return { error: "svg" };
  if (MEDIA_MIME[type]) return { ok: true, mime: type };
  /* Never trust the extension alone: an empty/generic MIME is only a hint;
     the magic-byte sniff + real decode decide. Anything else is rejected. */
  if ((type === "" || type === "application/octet-stream") && MEDIA_EXT[ext]) return { ok: true, mime: MEDIA_EXT[ext], provisional: true };
  return { error: "bad-type" };
}
function validateImageURL(url) {
  var raw = String(url || "").trim().slice(0, 2000);
  if (!raw) return { error: "bad-url" };
  var u;
  try { u = new URL(raw); } catch (e) { return { error: "bad-url" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { error: "bad-url" };
  if (!u.hostname) return { error: "bad-url" };
  if (/\.svg(?:[?#]|$)/i.test(u.pathname)) return { error: "svg" };
  return { ok: true, url: u.href };
}
/* Magic-byte sniff on the first bytes (pure, unit-tested). Rejects SVG/unknown. */
function sniffImageKind(bytes) {
  try {
    var b = bytes;
    if (typeof b === "string") {
      var s = b;
      if (/^\s*</.test(s.slice(0, 512))) return "svg";
      return null;
    }
    var arr = b instanceof Uint8Array ? b : new Uint8Array(b);
    if (arr.length < 4) return null;
    var head = "";
    for (var i = 0; i < Math.min(arr.length, 512); i++) head += String.fromCharCode(arr[i]);
    if (/^\s*</.test(head)) return "svg";
    if (arr[0] === 0xFF && arr[1] === 0xD8) return "jpeg";
    if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) return "png";
    if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) return "gif";
    if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
        arr.length > 11 && arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) return "webp";
    return null;
  } catch (e) { return null; }
}
function extractMids(text) {
  var out = [], m, re = /\[\[m:([A-Za-z0-9]+)\]\]/g;
  while ((m = re.exec(String(text || "")))) { if (out.indexOf(m[1]) < 0) out.push(m[1]); }
  return out;
}
function mediaRefCounts(a) {
  var counts = {};
  try {
    Object.keys(a.notes || {}).forEach(function (k) {
      var n = a.notes[k];
      if (!n) return;
      Object.keys(n.fields || {}).forEach(function (f) {
        extractMids(n.fields[f]).forEach(function (mid) { counts[mid] = (counts[mid] || 0) + 1; });
      });
    });
  } catch (e) {}
  return counts;
}
function noteHasMedia(a, note) {
  if (!note) return false;
  try {
    return Object.keys(note.fields || {}).some(function (f) { return extractMids(note.fields[f]).length > 0; });
  } catch (e) { return false; }
}
function unusedMedia(a) {
  var counts = mediaRefCounts(a), out = [];
  Object.keys(a.media || {}).forEach(function (mid) { if (!counts[mid]) out.push(mid); });
  return out;
}
function mediaBytes(a) {
  var n = 0;
  try { Object.keys(a.media || {}).forEach(function (mid) { n += (a.media[mid] && a.media[mid].bytes) | 0; }); } catch (e) {}
  return n;
}
/* Remove assets referenced by no note. Never touches referenced media. */
function pruneMedia(a) {
  var counts = mediaRefCounts(a), dropped = 0;
  Object.keys(a.media || {}).forEach(function (mid) {
    if (!counts[mid]) { delete a.media[mid]; dropped++; }
  });
  if (dropped) commit();
  return dropped;
}
function storeMediaAsset(a, asset) {
  if (!asset || !asset.data) return { error: "bad-file" };
  var hash = mediaHash(asset.data);
  var ids = Object.keys(a.media || {});
  for (var i = 0; i < ids.length; i++) {
    if (a.media[ids[i]] && a.media[ids[i]].hash === hash) return { id: ids[i], reused: true };
  }
  if (mediaBytes(a) + (asset.bytes | 0) > MEDIA_BUDGET) return { error: "budget" };
  try {
    var approx = 0;
    try { approx = JSON.stringify(liveS()).length + (asset.bytes | 0); } catch (e) {}
    if (approx > 4500000) return { error: "budget" };
  } catch (e) {}
  var id = uid("m");
  a.media[id] = { id: id, hash: hash, mime: asset.mime, w: asset.w | 0, h: asset.h | 0, bytes: asset.bytes | 0, data: asset.data, thumb: asset.thumb || null, src: asset.src || "device", created: Date.now() };
  commit();
  return { id: id, reused: false };
}
/* Browser pipeline: Blob -> sniff -> decode -> resize/re-encode -> store. */
function decodeBlob(blob) {
  return new Promise(function (resolve, reject) {
    try {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      var done = false;
      img.onload = function () {
        if (done) return; done = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
        if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) { reject(new Error("decode")); return; }
        resolve(img);
      };
      img.onerror = function () {
        if (done) return; done = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
        reject(new Error("decode"));
      };
      img.src = url;
      setTimeout(function () { if (!done) { done = true; try { URL.revokeObjectURL(url); } catch (e) {} reject(new Error("timeout")); } }, MEDIA_FETCH_TIMEOUT);
    } catch (e) { reject(e); }
  });
}
function canvasAsset(img, src) {
  var nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
  if (!(nw > 0 && nh > 0) || nw > 12000 || nh > 12000) return { error: "bad-file" };
  var scale = Math.min(1, MEDIA_MAX_DIM / Math.max(nw, nh));
  var w = Math.max(1, Math.round(nw * scale)), h = Math.max(1, Math.round(nh * scale));
  var cv, ctx;
  try {
    cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
  } catch (e) { return { error: "bad-file" }; }
  var opaque = true;
  try {
    var d = ctx.getImageData(0, 0, w, h).data;
    for (var i = 3; i < d.length; i += 64) { if (d[i] < 255) { opaque = false; break; } }
  } catch (e) { opaque = true; }
  function encode(mime, q) { try { return cv.toDataURL(mime, q); } catch (e) { return null; } }
  var outMime = opaque ? "image/jpeg" : "image/png";
  var data = opaque ? (encode("image/jpeg", 0.82) || encode("image/png")) : encode("image/png");
  if (!data) return { error: "bad-file" };
  if (data.length > MEDIA_MAX_BYTES * 1.37 && opaque) {
    var retry = encode("image/jpeg", 0.68);
    if (retry) data = retry;
  }
  var bytes = Math.round(data.length * 0.75);
  if (bytes > MEDIA_MAX_BYTES) return { error: "too-large" };
  var thumb = null;
  try {
    var tw = Math.min(w, 96), th = Math.max(1, Math.round(h * (tw / w)));
    var tc = document.createElement("canvas");
    tc.width = tw; tc.height = th;
    tc.getContext("2d").drawImage(cv, 0, 0, tw, th);
    thumb = tc.toDataURL("image/jpeg", 0.6);
  } catch (e) { thumb = null; }
  return { mime: outMime, w: w, h: h, bytes: bytes, data: data, thumb: thumb, src: src || "device" };
}
function blobHead(blob, n) {
  return blob.slice(0, n || 16).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
}
function importFileAsset(a, file) {
  var v = validateImageFile(file);
  if (!v.error && !v.ok) v = { error: "bad-file" };
  if (v.error) return Promise.resolve({ error: v.error });
  return blobHead(file, 16).then(function (head) {
    var kind = sniffImageKind(head);
    if (kind === "svg") return { error: "svg" };
    if (!kind) return { error: "bad-file" };
    return decodeBlob(file).then(function (img) {
      var asset = canvasAsset(img, "device");
      if (asset.error) return asset;
      return storeMediaAsset(a, asset);
    }, function () { return { error: "bad-file" }; });
  }, function () { return { error: "bad-file" }; });
}
function importURLAsset(a, url) {
  var v = validateImageURL(url);
  if (v.error) return Promise.resolve({ error: v.error });
  var ctrl = null;
  try { ctrl = new AbortController(); } catch (e) {}
  var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, MEDIA_FETCH_TIMEOUT);
  var p;
  try {
    p = fetch(v.url, { headers: { Accept: "image/*" }, signal: ctrl ? ctrl.signal : undefined, redirect: "follow" });
  } catch (e) { clearTimeout(timer); return Promise.resolve({ error: "unreachable" }); }
  return p.then(function (res) {
    clearTimeout(timer);
    if (!res || !res.ok) return { error: "unreachable" };
    var ct = "";
    try { ct = String(res.headers.get("content-type") || "").toLowerCase().split(";")[0].trim(); } catch (e) {}
    if (ct === "image/svg+xml") return { error: "svg" };
    if (ct && ct.indexOf("image/") !== 0 && ct !== "application/octet-stream" && ct !== "binary/octet-stream") return { error: "non-image" };
    return res.blob().then(function (blob) {
      if (!blob || !(blob.size > 0)) return { error: "bad-file" };
      if (blob.size > MEDIA_MAX_FILE) return { error: "too-large" };
      return blobHead(blob, 16).then(function (head) {
        var kind = sniffImageKind(head);
        if (kind === "svg") return { error: "svg" };
        if (!kind) return { error: "non-image" };
        return decodeBlob(blob).then(function (img) {
          var asset = canvasAsset(img, "url");
          if (asset.error) return asset;
          return storeMediaAsset(a, asset);
        }, function () { return { error: "bad-file" }; });
      });
    });
  }, function (err) {
    clearTimeout(timer);
    if (err && err.name === "AbortError") return { error: "too-large" };
    return { error: "unreachable" };
  });
}

/* ================= J. review logging, day stats, undo ================= */
function logGrade(a, cardId, rating, prev, next) {
  var tk = todayKey();
  if (!a.days[tk]) a.days[tk] = { rev: 0, ok: 0, new: 0, again: 0 };
  var first = prev.st === "new";
  a.days[tk].rev++;
  if (rating === "good" || rating === "easy") a.days[tk].ok++;
  if (first) a.days[tk].new++;
  if (rating === "again") a.days[tk].again++;
  a.undo = { c: cardId, prev: prev, day: tk };
  a.log.push({ t: Date.now(), c: cardId, r: rating, ok: (rating === "good" || rating === "easy") ? 1 : 0, st: next.st, iv: next.iv | 0 });
  if (a.log.length > 500) a.log.splice(0, a.log.length - 500);
  var keys = Object.keys(a.days).sort();
  while (keys.length > 120) { delete a.days[keys.shift()]; }
  commit();
}
function undoLast(a) {
  var u = a.undo;
  if (!u || !a.cards[u.c]) return null;
  var card = a.cards[u.c];
  card.sched = u.prev;
  /* remove matching log tail */
  for (var i = a.log.length - 1; i >= 0; i--) {
    if (a.log[i].c === u.c) { a.log.splice(i, 1); break; }
  }
  if (a.days[u.day]) {
    a.days[u.day].rev = Math.max(0, a.days[u.day].rev - 1);
  }
  a.undo = null;
  commit();
  return card;
}
/* ================= K. stats (all from real log/schedule) ================= */
function computeStats(a, nowMs) {
  var now = (typeof nowMs === "number" && isFinite(nowMs)) ? nowMs : Date.now();
  var tk = todayKey(new Date(now));
  var s = { total: 0, new: 0, learning: 0, review: 0, relearning: 0, due: 0, overdue: 0, suspended: 0, buried: 0, mature: 0, young: 0, decks: Object.keys(a.decks).length, notes: Object.keys(a.notes).length };
  var forecast = {};
  Object.keys(a.cards).forEach(function (k) {
    var c = a.cards[k];
    if (!c) return;
    s.total++;
    var b = bucketOf(c, now);
    if (b === "new") s.new++;
    else if (b === "learning") s.learning++;
    else if (b === "review") s.review++;
    else if (b === "relearning") s.relearning++;
    if (c.susp) s.suspended++;
    if (c.buried) s.buried++;
    if (b === "new" || b === "learning" || b === "review" || b === "relearning") s.due++;
    if (c.sched.due && c.sched.due < tk && !c.susp && !c.buried && c.sched.st === "review") s.overdue++;
    if ((c.sched.iv | 0) >= 21) s.mature++; else if (c.sched.st === "review") s.young++;
    var d = c.sched.due;
    if (d && !c.susp && !c.buried) forecast[d] = (forecast[d] || 0) + 1;
  });
  var last30 = a.log.filter(function (e) { return e.t > now - 30 * 86400000; });
  var ok = last30.filter(function (e) { return e.ok; }).length;
  s.retention30 = last30.length ? Math.round(ok / last30.length * 100) : null;
  s.reviews30 = last30.length;
  s.today = a.days[tk] || { rev: 0, ok: 0, new: 0, again: 0 };
  var days = Object.keys(a.days).sort();
  s.streak = 0;
  var cursor = new Date(now);
  for (var i = 0; i < 400; i++) {
    var key = todayKey(cursor);
    if (a.days[key] && a.days[key].rev > 0) { s.streak++; cursor = new Date(cursor.getTime() - 86400000); }
    else if (key === tk && !(a.days[key] && a.days[key].rev > 0)) { cursor = new Date(cursor.getTime() - 86400000); continue; }
    else break;
  }
  s.forecast = forecast;
  s.week = days.slice(-7).map(function (d) { return { d: d, rev: (a.days[d] || {}).rev || 0, ok: (a.days[d] || {}).ok || 0 }; });
  return s;
}

/* ================= L. audio + pronunciation (honest capabilities) ================= */
function speakText(txt) {
  txt = String(txt || "").trim();
  if (!txt) return false;
  try {
    if (isArabic(txt)) { if (typeof window.speakAr === "function") { window.speakAr(txt); return true; } }
    else if (typeof window.speak === "function") { window.speak(txt); return true; }
  } catch (e) {}
  try {
    if ("speechSynthesis" in window) {
      var u = new SpeechSynthesisUtterance(txt);
      u.lang = isArabic(txt) ? "ar-SA" : "de-DE";
      window.speechSynthesis.speak(u);
      return true;
    }
  } catch (e2) {}
  return false;
}
function recogSupport() {
  try { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); } catch (e) { return false; }
}
function recordSupport() {
  try { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); } catch (e) { return false; }
}
function downloadFile(name, content, mime) {
  try {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url; link.download = name;
    document.body.appendChild(link); link.click();
    setTimeout(function () { try { document.body.removeChild(link); URL.revokeObjectURL(url); } catch (e) {} }, 500);
    return true;
  } catch (e) { return false; }
}

/* ================= M. view framework ================= */
var V = { name: "home", deck: null, q: "", page: 0, sel: {}, editNote: null, editType: null, custom: null, statsTab: "today" };
var SESS = null; /* active study session */
/* Editor image staging (reset on entering add/edit): EM = pending {field,mid},
 * EMR = removals [{field,mid}] applied on save. Assets commit to the store at
 * import time so previews render; save/cancel orphans are reclaimed by the
 * Unused-Media cleanup (never auto-deleted while referenced). */
var EM = null, EMR = [];
/* Editor draft (typed-but-unsaved values). Attaching/removing an image,
 * replacing media, or switching note type re-renders the editor; without a
 * draft those re-renders wipe what the user typed (the inputs are rebuilt
 * from the note/empty defaults). captureDraft() snapshots the live DOM
 * before every editor render so nothing is lost; entering add/edit starts
 * with a clean draft, a successful save clears it. */
var ED = null;
function captureDraft() {
  try {
    if (V.name !== "add" && V.name !== "edit") return;
    var typeEl = null;
    try { typeEl = document.getElementById("ankiEdType"); } catch (e) { typeEl = null; }
    if (!typeEl) return; /* editor not mounted yet */
    var a = A();
    var typeId = typeEl.value || "basic";
    var type = a.types[typeId] || a.types.basic;
    var fields = {};
    (type.fields || []).forEach(function (f) {
      try {
        var el = document.getElementById("ankiEdF_" + f);
        fields[f] = el ? String(el.value).slice(0, 4000) : "";
      } catch (e) { fields[f] = ""; }
    });
    ED = {
      noteId: V.name === "edit" ? V.editNote : null,
      type: typeId, deck: val("ankiEdDeck"),
      fields: fields, tags: val("ankiEdTags")
    };
  } catch (e) {}
}
function root() { try { return document.getElementById("ankiRoot"); } catch (e) { return null; } }
function setView(patch) {
  Object.keys(patch || {}).forEach(function (k) { V[k] = patch[k]; });
  if (patch && (patch.name === "add" || patch.name === "edit")) { EM = null; EMR = []; ED = null; }
  render();
}
function ratingLabel(r) {
  return r === "again" ? T("rate_forgot") : r === "hard" ? T("rate_hard") : r === "easy" ? T("rate_easy") : T("rate_good");
}
function chipCounts(c) {
  return '<span class="anki-counts"><span class="anki-count new" title="' + esc(T("anki_new")) + '">' + c.new + '</span>' +
    '<span class="anki-count learning" title="' + esc(T("anki_learning")) + '">' + (c.learning + c.relearning) + '</span>' +
    '<span class="anki-count review" title="' + esc(T("anki_due")) + '">' + c.review + '</span></span>';
}
function toolbarHTML(active) {
  function b(id, key, view) {
    return '<button class="btn ' + (active === view ? "btn-primary" : "btn-ghost") + ' sm" data-aview="' + view + '" id="' + id + '">' + esc(T(key)) + '</button>';
  }
  return '<div class="anki-toolbar" role="toolbar">' +
    b("ankiStudyBtn", "anki_study", "study") + b("ankiAddBtn", "anki_add", "add") +
    b("ankiBrowseBtn", "anki_browse", "browse") + b("ankiStatsBtn", "anki_stats", "stats") +
    '<span class="anki-toolbar-sp"></span>' +
    '<button class="btn btn-ghost sm" data-aview="types">' + esc(T("anki_note_type")) + '</button>' +
    '<button class="btn btn-ghost sm" data-aview="collection">' + esc(T("anki_collection")) + '</button>' +
    '<button class="btn btn-ghost sm" data-aview="settings">' + esc(T("anki_settings")) + '</button>' +
    '</div>';
}
function deckTreeHTML(a) {
  var ids = Object.keys(a.decks);
  if (!ids.length) return '<div class="anki-empty">' + esc(T("anki_empty_state")) + '</div>';
  var roots = childrenOf(a, null);
  Object.keys(a.decks).forEach(function (k) { if (!a.decks[k].parent || !a.decks[a.decks[k].parent]) { if (roots.indexOf(k) < 0) roots.push(k); } });
  var html = "";
  function row(id, depth) {
    var d = a.decks[id];
    if (!d) return;
    var kids = childrenOf(a, id);
    var c = deckCounts(a, id, Date.now());
    var open = !d.collapsed;
    html += '<div class="anki-deck" data-deck="' + esc(id) + '">' +
      '<div class="anki-deck-row" style="padding-inline-start:' + (8 + depth * 18) + 'px">' +
      (kids.length ? '<button class="anki-toggle" data-atoggle="' + esc(id) + '" aria-expanded="' + (open ? "true" : "false") + '" aria-label="expand">' + (open ? "▾" : "▸") + '</button>' : '<span class="anki-toggle-sp"></span>') +
      '<button class="anki-deck-name" data-aoverview="' + esc(id) + '" title="' + esc(deckPath(a, id)) + '">' + esc(d.name) + '</button>' +
      '<button class="anki-deck-go" data-aoverview="' + esc(id) + '">' + chipCounts(c) + '</button>' +
      '<button class="anki-menu-btn" data-amenu="' + esc(id) + '" aria-label="deck actions">⋮</button>' +
      '</div><div class="anki-kids' + (open ? "" : " hidden") + '">';
    if (open) kids.forEach(function (k) { row(k, depth + 1); });
    html += "</div></div>";
  }
  roots.forEach(function (k) { row(k, 0); });
  return html;
}
function render() {
  var r = root();
  if (!r) return;
  try { captureDraft(); } catch (e) {}
  var a = A();
  var html = "";
  /* Explicit navigation always wins: an in-progress session (SESS) must not
   * hijack the editor (e.g. study -> edit note would otherwise keep showing
   * the study screen). In-session re-renders keep V.name === "study". */
  if (V.name === "study") html = studyHTML(a);
  else if (V.name === "overview") html = overviewHTML(a);
  else if (V.name === "browse") html = browseHTML(a);
  else if (V.name === "add" || V.name === "edit") html = editorHTML(a);
  else if (V.name === "types") html = typesHTML(a);
  else if (V.name === "templates") html = templatesHTML(a);
  else if (V.name === "stats") html = statsHTML(a);
  else if (V.name === "settings") html = settingsHTML(a);
  else if (V.name === "collection") html = collectionHTML(a);
  else if (V.name === "custom") html = customHTML(a);
  else if (V.name === "io") html = ioHTML(a);
  else html = homeHTML(a);
  r.innerHTML = html;
  bindRoot(r, a);
}
function homeHTML(a) {
  var s = computeStats(a, Date.now());
  var h = toolbarHTML("home") +
    '<div class="anki-home-actions">' +
    '<button class="btn btn-ghost sm" data-aview="add">＋ ' + esc(T("anki_add")) + '</button>' +
    '<button class="btn btn-ghost sm" data-aseed="1">⚡ ' + esc(T("anki_generate")) + '</button>' +
    '<button class="btn btn-ghost sm" data-aview="io">⇅ CSV</button>' +
    '<span class="muted"> · ' + s.total + ' / ' + s.decks + ' / ' + s.notes + '</span>' +
    '</div>' +
    '<div class="anki-deck-list">' + deckTreeHTML(a) + '</div>';
  return h;
}
function overviewHTML(a) {
  var id = V.deck;
  if (!id || !a.decks[id]) { V.name = "home"; return homeHTML(a); }
  var c = deckCounts(a, id, Date.now());
  var o = deckOpts(a, id);
  var nn = Math.min(c.new, o.newPerDay), rv = Math.min(c.learning + c.review + c.relearning, o.maxReview);
  var h = toolbarHTML("study") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button></div>' +
    '<div class="anki-overview glass"><h3 dir="auto">' + esc(deckPath(a, id)) + '</h3>' +
    '<div class="anki-ov-grid">' +
    '<div class="anki-ov-card"><div class="anki-ov-num new">' + c.new + '</div><div class="anki-ov-lab">' + esc(T("anki_new")) + '</div></div>' +
    '<div class="anki-ov-card"><div class="anki-ov-num learning">' + (c.learning + c.relearning) + '</div><div class="anki-ov-lab">' + esc(T("anki_learning")) + '</div></div>' +
    '<div class="anki-ov-card"><div class="anki-ov-num review">' + c.review + '</div><div class="anki-ov-lab">' + esc(T("anki_due")) + '</div></div>' +
    '</div>' +
    '<p class="muted">📝 ' + nn + ' · 🔁 ' + rv + ' · ⏸️ ' + c.suspended + ' · 📥 ' + c.buried + '</p>' +
    '<div class="row-flex"><button class="btn btn-primary" data-astudy="' + esc(id) + '">📖 ' + esc(T("anki_study")) + ' (' + (nn + rv) + ')</button>' +
    '<button class="btn btn-ghost" data-aview="custom">🎯 ' + esc(T("anki_custom_study")) + '</button>' +
    '<button class="btn btn-ghost" data-aopts="' + esc(id) + '">⚙️ ' + esc(T("anki_deck_options")) + '</button></div>' +
    '</div>';
  return h;
}
/* ---- study ---- */
function startSession(a, deckId, opts) {
  opts = opts || {};
  var q = opts.onlyIds ? buildQueue(a, deckId, { onlyIds: opts.onlyIds, maxReview: opts.maxReview, newPerDay: opts.newPerDay, nowMs: opts.nowMs, includeAhead: opts.includeAhead, limit: opts.limit }) : buildQueue(a, deckId, { nowMs: opts.nowMs, includeAhead: opts.includeAhead, limit: opts.limit });
  SESS = { deck: deckId, queue: q.items.map(function (c) { return c.id; }), idx: 0, revealed: false, uid: activeUid(), undoStack: [], custom: !!opts.custom, started: Date.now() };
  V.name = "study";
  render();
}
function sessCard(a) {
  if (!SESS || SESS.idx >= SESS.queue.length) return null;
  if (SESS.uid !== activeUid()) { SESS = null; V.name = "home"; return null; }
  var c = a.cards[SESS.queue[SESS.idx]];
  if (!c || c.susp || c.buried) { SESS.idx++; return sessCard(a); }
  return c;
}
function studyHTML(a) {
  if (!SESS) {
    var pick = V.deck && a.decks[V.deck] ? V.deck : (a.settings.defaultDeck && a.decks[a.settings.defaultDeck] ? a.settings.defaultDeck : Object.keys(a.decks)[0]);
    if (!pick) return toolbarHTML("study") + '<div class="anki-empty">' + esc(T("anki_empty_state")) + '</div>';
    V.deck = pick; V.name = "overview";
    return overviewHTML(a);
  }
  var card = sessCard(a);
  if (!card) {
    var done = SESS.queue.length;
    SESS = null;
    return toolbarHTML("study") +
      '<div class="anki-session-complete"><h3>' + esc(T("anki_session_done")) + '</h3>' +
      '<p class="muted">' + done + ' ✓</p>' +
      '<div class="row-flex"><button class="btn btn-primary" data-aview="home">' + esc(T("anki_back_decks")) + '</button>' +
      (a.undo ? '<button class="btn btn-ghost" data-aundo="1">↩️ ' + esc(T("anki_undo")) + '</button>' : '') + '</div></div>';
  }
  var sides = cardSides(a, card);
  var note = a.notes[card.note] || {};
  var sched = schedOf(card);
  var bucket = bucketOf(card, Date.now());
  var bucketAr = bucket === "new" ? T("anki_new") : bucket === "learning" ? T("anki_learning") : bucket === "relearning" ? T("anki_learning") : T("anki_due");
  var prog = (SESS.idx + 1) + " / " + SESS.queue.length;
  var h = toolbarHTML("study") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button>' +
    '<span class="muted">' + esc(prog) + ' · <span class="anki-bucket-badge">' + esc(bucketAr) + '</span>' + (sched.st !== "new" ? ' · ⏱ ' + (sched.iv | 0) + 'd' : '') + '</span></div>' +
    '<div class="anki-card" id="ankiCard" tabindex="0"><div class="anki-card-inner' + (SESS.revealed ? " flipped" : "") + '" id="ankiCardInner">' +
    '<div class="anki-card-front" dir="auto">' + sides.front +
    '<div class="anki-hint muted">' + esc(T("anki_show_answer")) + ' ⏎</div></div>' +
    '<div class="anki-card-back' + (SESS.revealed ? "" : " hidden") + '" dir="auto">' + sides.back + '</div>' +
    '</div></div>' +
    '<div class="anki-audio-row"><button class="mini-btn" data-asay="front" aria-label="play front">🔊</button>' +
    (SESS.revealed ? '<button class="mini-btn" data-asay="back" aria-label="play back">🔊</button>' : '') +
    (SESS.revealed ? '<button class="btn btn-ghost sm" data-apron="1">🎤 ' + esc(T("anki_check_pron")) + '</button>' : '') + '</div>' +
    '<div id="ankiPronBox"></div>' +
    '<div class="anki-study-controls">';
  if (!SESS.revealed) {
    h += '<button class="btn btn-primary big-touch" id="ankiShowAns" data-ashow="1">👁️ ' + esc(T("anki_show_answer")) + '</button>';
  } else {
    h += '<div class="anki-ratings" id="ankiRatings">' +
      ["again", "hard", "good", "easy"].map(function (r, i) {
        return '<button class="btn big-touch ' + (r === "again" ? "btn-red" : r === "hard" ? "btn-gold" : r === "good" ? "btn-green" : "btn-primary") + '" data-arate="' + r + '"><b>' + (i + 1) + '</b> ' + esc(ratingLabel(r)) + ' <small>' + esc(previewInterval(a, card.id, r)) + '</small></button>';
      }).join("") + '</div>' +
      '<div class="row-flex"><button class="btn btn-ghost sm" data-aeditnote="' + esc(card.note) + '">✏️ e</button>' +
      '<button class="btn btn-ghost sm" data-asuspend="1">⏸️</button>' +
      '<button class="btn btn-ghost sm" data-abury="1">📥</button>' +
      (a.undo || SESS.undoStack.length ? '<button class="btn btn-ghost sm" data-aundo="1">↩️ ' + esc(T("anki_undo")) + '</button>' : '') + '</div>';
  }
  h += '</div><div class="anki-progress"><div class="progress"><div class="progress-fill" style="width:' + Math.round((SESS.idx) / Math.max(1, SESS.queue.length) * 100) + '%"></div></div></div>';
  return h;
}
function rateCurrent(rating) {
  var a = A();
  if (!SESS) return;
  var card = sessCard(a);
  if (!card || !SESS.revealed) return;
  var g = gradeCard(a, card.id, rating, Date.now());
  if (!g) return;
  SESS.undoStack.push({ c: card.id, prev: g.prev });
  logGrade(a, card.id, rating, g.prev, card.sched);
  try { if (typeof window.addXP === "function" && (rating === "good" || rating === "easy")) window.addXP(1, "anki"); } catch (e) {}
  SESS.idx++;
  SESS.revealed = false;
  render();
}
/* ---- browser ---- */
var BROWSE_PAGE = 60;
function browseHTML(a) {
  var q = V.q || "";
  var res = searchCards(a, q, Date.now());
  var sortK = V.sortK || "due";
  res.sort(function (x, y) {
    if (sortK === "deck") return deckPath(a, x.deck).localeCompare(deckPath(a, y.deck));
    if (sortK === "state") return schedOf(x).st.localeCompare(schedOf(y).st);
    if (sortK === "iv") return ((y.sched.iv | 0) - (x.sched.iv | 0));
    var xd = x.sched.due || "", yd = y.sched.due || "";
    return xd === yd ? String(x.id).localeCompare(String(y.id)) : (xd < yd ? -1 : 1);
  });
  var total = res.length;
  var page = Math.max(0, V.page | 0);
  var slice = res.slice(page * BROWSE_PAGE, page * BROWSE_PAGE + BROWSE_PAGE);
  var pages = Math.max(1, Math.ceil(total / BROWSE_PAGE));
  var h = toolbarHTML("browse") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button>' +
    '<span class="muted">' + total + ' · ' + esc(T("anki_browser")) + '</span></div>' +
    '<div class="anki-browser-toolbar"><input id="ankiSearch" class="full-input" dir="auto" placeholder="' + esc(T("anki_search_ph")) + '" value="' + esc(q) + '">' +
    '<select id="ankiSort"><option value="due"' + (sortK === "due" ? " selected" : "") + '>Due</option><option value="deck"' + (sortK === "deck" ? " selected" : "") + '>Deck</option><option value="state"' + (sortK === "state" ? " selected" : "") + '>State</option><option value="iv"' + (sortK === "iv" ? " selected" : "") + '>Interval</option></select></div>' +
    '<div class="anki-bulk"><button class="btn btn-ghost sm" data-abFloyd="sus">⏸️ ' + esc(T("anki_suspend")) + '</button>' +
    '<button class="btn btn-ghost sm" data-abFloyd="bury">📥 ' + esc(T("anki_bury")) + '</button>' +
    '<button class="btn btn-ghost sm" data-abFloyd="unsus">▶️ ' + esc(T("anki_unsuspend")) + '</button>' +
    '<button class="btn btn-ghost sm" data-abFloyd="unbury">📤 ' + esc(T("anki_unbury")) + '</button>' +
    '<button class="btn btn-ghost sm" data-abFloyd="reset">↺ ' + esc(T("anki_reset")) + '</button>' +
    '<button class="btn btn-red sm" data-abFloyd="del">🗑️</button>' +
    '<label class="muted"><input type="checkbox" id="ankiSelAll"> ✓</label></div>';
  if (!slice.length) {
    h += '<div class="anki-empty">—</div>';
  } else if (window.innerWidth < 640) {
    h += '<div class="anki-bcards">' + slice.map(function (c) {
      var n = a.notes[c.note] || {};
      var F = resolveFields(n);
      var s = schedOf(c);
      var hasM = noteHasMedia(a, n);
      return '<label class="anki-bcard"><input type="checkbox" data-asel="' + esc(c.id) + '"' + (V.sel[c.id] ? " checked" : "") + '>' +
        '<span class="anki-bcard-main"><b dir="auto">' + (hasM ? "📷 " : "") + esc(String(F.Front || "").slice(0, 80)) + '</b><small dir="auto">' + esc(String(F.Back || "").slice(0, 80)) + '</small>' +
        '<small class="muted">' + esc(deckPath(a, c.deck)) + ' · ' + esc(s.st) + ' · ' + esc(s.due || "") + ' · ' + (s.iv | 0) + 'd</small></span></label>';
    }).join("") + '</div>';
  } else {
    h += '<div class="anki-table-wrap"><table class="anki-browser-table"><thead><tr><th></th><th></th><th>' + esc(T("anki_front")) + '</th><th>' + esc(T("anki_back")) + '</th><th>Deck</th><th>State</th><th>Due</th><th>IV</th><th>' + esc(T("anki_tags")) + '</th></tr></thead><tbody>' +
      slice.map(function (c) {
        var n = a.notes[c.note] || {};
        var F = resolveFields(n);
        var s = schedOf(c);
        var thumb = "";
        if (noteHasMedia(a, n)) {
          var mids = [];
          try { Object.keys(n.fields || {}).forEach(function (f) { extractMids(n.fields[f]).forEach(function (m) { if (mids.indexOf(m) < 0) mids.push(m); }); }); } catch (e) {}
          var mm = mids.length && a.media ? a.media[mids[0]] : null;
          if (mm && (mm.thumb || mm.data)) thumb = '<img class="anki-thumb" loading="lazy" decoding="async" src="' + esc(mm.thumb || mm.data) + '" alt="" data-amedia="' + esc(mids[0]) + '">';
        }
        return '<tr><td><input type="checkbox" data-asel="' + esc(c.id) + '"' + (V.sel[c.id] ? " checked" : "") + '></td><td>' + thumb + '</td>' +
          '<td dir="auto">' + esc(String(F.Front || "").slice(0, 60)) + '</td><td dir="auto">' + esc(String(F.Back || "").slice(0, 60)) + '</td>' +
          '<td dir="auto">' + esc(deckPath(a, c.deck)) + '</td><td>' + esc(s.st) + (c.susp ? " ⏸️" : "") + (c.buried ? " 📥" : "") + '</td>' +
          '<td dir="ltr">' + esc(s.due || "") + '</td><td>' + (s.iv | 0) + 'd</td><td dir="auto">' + esc((n.tags || []).join(", ")) + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }
  h += '<div class="anki-pager"><button class="btn btn-ghost sm" data-apage="-1" ' + (page <= 0 ? "disabled" : "") + '>‹</button><span class="muted">' + (page + 1) + ' / ' + pages + '</span><button class="btn btn-ghost sm" data-apage="1" ' + (page + 1 >= pages ? "disabled" : "") + '>›</button></div>';
  return h;
}
/* ---- note images (editor staging UI) ---- */
function textFieldsOf(type) {
  return (type.fields || []).filter(function (f) { return !/^_/.test(f); });
}
function editorMediaHTML(a, note, type, isEdit) {
  var fields = textFieldsOf(type);
  var defField = fields[0] || "Front";
  var cur = {};
  if (isEdit && note && !note.ref) {
    fields.forEach(function (f) {
      extractMids(note.fields[f]).forEach(function (mid) {
        if (a.media && a.media[mid]) { cur[f] = cur[f] || []; cur[f].push(mid); }
      });
    });
  }
  if (isEdit && note && note.ref) {
    try {
      var F = resolveFields(note);
      fields.forEach(function (f) {
        extractMids(F[f]).forEach(function (mid) {
          if (a.media && a.media[mid]) { cur[f] = cur[f] || []; if (cur[f].indexOf(mid) < 0) cur[f].push(mid); }
        });
      });
    } catch (e) {}
  }
  (EMR || []).forEach(function (r) {
    if (cur[r.field]) cur[r.field] = cur[r.field].filter(function (m) { return m !== r.mid; });
  });
  var h = '<div class="form-group"><label>🖼️ ' + esc(T("anki_add_image")) + '</label>';
  h += '<select id="ankiImgField">' + fields.map(function (f) {
    return '<option value="' + esc(f) + '"' + ((EM && EM.field === f ? f : defField) === f ? " selected" : "") + '>' + esc(f) + '</option>';
  }).join("") + '</select>';
  h += '<div class="row-flex" style="margin-top:8px"><button class="btn btn-ghost sm" data-amedia-file="1">📁 ' + esc(T("anki_from_device")) + '</button>' +
    '<button class="btn btn-ghost sm" data-amedia-url="1">🌐 ' + esc(T("anki_from_internet")) + '</button></div>';
  h += '<input type="file" id="ankiImgFile" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" class="hidden">';
  h += '<div id="ankiImgUrlRow" class="hidden" style="margin-top:8px"><input id="ankiImgUrl" dir="ltr" placeholder="https://…" style="width:100%;margin-bottom:6px">' +
    '<div class="row-flex"><button class="btn btn-primary sm" data-amedia-fetch="1">⬇ ' + esc(T("anki_fetch_attach")) + '</button></div>' +
    '<div id="ankiImgUrlMsg" class="muted" dir="auto" style="margin-top:4px"></div></div>';
  h += '<div id="ankiImgPrev">';
  if (EM && EM.mid && a.media && a.media[EM.mid]) {
    var pm = a.media[EM.mid];
    h += '<div class="anki-imgstage"><img class="anki-thumb-lg" loading="lazy" src="' + esc(pm.thumb || pm.data) + '" alt="">' +
      '<span class="muted">✓ ' + esc(EM.field) + ' · ' + Math.round((pm.bytes || 0) / 1024) + ' KB</span></div>';
  }
  h += '</div><div id="ankiImgList">';
  Object.keys(cur).forEach(function (f) {
    cur[f].forEach(function (mid) {
      var m = a.media[mid];
      if (!m) return;
      h += '<div class="anki-imgrow"><img class="anki-thumb" loading="lazy" src="' + esc(m.thumb || m.data) + '" alt="">' +
        '<span class="muted" dir="auto">' + esc(f) + '</span>' +
        '<button class="btn btn-ghost sm" data-amedia-full="' + esc(mid) + '">👁️</button>' +
        '<button class="btn btn-ghost sm" data-amedia-rep="' + esc(f + ":" + mid) + '">🔄 ' + esc(T("anki_replace")) + '</button>' +
        '<button class="btn btn-ghost sm" data-amedia-rm="' + esc(f + ":" + mid) + '">🗑️ ' + esc(T("anki_remove")) + '</button></div>';
    });
  });
  h += '</div><p class="muted">GIF → ' + esc(T("anki_gif_static")) + '</p></div>';
  return h;
}
/* ---- add / edit note ---- */
function editorHTML(a) {
  var isEdit = V.name === "edit";
  var note = isEdit ? a.notes[V.editNote] : null;
  if (isEdit && !note) { V.name = "browse"; return browseHTML(a); }
  var typeId = (isEdit ? note.type : (V.editType || "basic"));
  var type = a.types[typeId] || a.types.basic;
  var deckId = isEdit ? note.deck : (V.deck && a.decks[V.deck] ? V.deck : a.settings.defaultDeck);
  /* Prefer the live draft (typed text + chosen deck/tags) when this render
   * was triggered from inside the editor (image attach/remove/replace, note
   * type switch); otherwise a re-render would wipe the user's input. */
  var draft = (ED && (isEdit ? ED.noteId === V.editNote : ED.noteId === null)) ? ED : null;
  if (draft && draft.deck && a.decks[draft.deck]) deckId = draft.deck;
  var h = toolbarHTML("add") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="' + (isEdit ? "browse" : "home") + '">' + esc(T("anki_cancel")) + '</button>' +
    '<b>' + (isEdit ? "✏️" : "➕") + ' ' + esc(type.name) + '</b></div>' +
    '<div class="anki-editor glass"><div class="form-group"><label>' + esc(T("anki_note_type")) + '</label><select id="ankiEdType">' +
    Object.keys(a.types).map(function (k) { return '<option value="' + esc(k) + '"' + (k === type.id ? " selected" : "") + '>' + esc(a.types[k].name) + '</option>'; }).join("") + '</select></div>' +
    '<div class="form-group"><label>' + esc(T("anki_deck")) + '</label><select id="ankiEdDeck">' +
    Object.keys(a.decks).map(function (k) { return '<option value="' + esc(k) + '"' + (k === deckId ? " selected" : "") + '>' + esc(deckPath(a, k)) + '</option>'; }).join("") + '</select></div>';
  (type.fields || []).forEach(function (f) {
    var v = isEdit && !note.ref ? (note.fields[f] || "") : "";
    if (isEdit && note.ref) { var F = resolveFields(note); v = F[f] || ""; }
    if (draft && draft.fields && draft.fields[f] !== undefined) v = draft.fields[f];
    var big = /example|explanation|conjugation|transcript|meaning/i.test(f);
    h += '<div class="form-group"><label dir="auto">' + esc(f) + '</label>' +
      (big ? '<textarea id="ankiEdF_' + esc(f) + '" dir="auto">' + esc(v) + '</textarea>' : '<input id="ankiEdF_' + esc(f) + '" dir="auto" value="' + esc(v) + '">') + '</div>';
  });
  var tags = isEdit ? (note.tags || []).join(", ") : "";
  if (draft && typeof draft.tags === "string") tags = draft.tags;
  h += editorMediaHTML(a, note, type, isEdit);
  h += '<div class="form-group"><label>' + esc(T("anki_tags")) + '</label><input id="ankiEdTags" dir="auto" value="' + esc(tags) + '"></div>' +
    (isEdit && note.ref ? '<p class="muted">🔗 vocab:' + esc(note.ref.id) + '</p>' : '') +
    '<div class="row-flex"><button class="btn btn-primary" data-asave="' + (isEdit ? "edit" : "add") + '">' + esc(T("anki_save")) + '</button>' +
    '<button class="btn btn-ghost" data-aview="' + (isEdit ? "browse" : "home") + '">' + esc(T("anki_cancel")) + '</button></div></div>';
  return h;
}
/* ---- note types + templates ---- */
function typesHTML(a) {
  var h = toolbarHTML("types") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button>' +
    '<button class="btn btn-ghost sm" data-atype-new="1">＋ ' + esc(T("anki_note_type")) + '</button></div>' +
    '<div class="anki-list">' + Object.keys(a.types).map(function (k) {
      var t = a.types[k];
      var n = Object.keys(a.notes).filter(function (x) { return a.notes[x] && a.notes[x].type === k; }).length;
      return '<div class="anki-list-row"><b dir="auto">' + esc(t.name) + '</b><span class="muted">' + n + ' · ' + (t.fields || []).length + ' fields · ' + ((t.templates || []).length) + ' cards</span>' +
        '<span><button class="btn btn-ghost sm" data-atype-edit="' + esc(k) + '">✏️</button>' +
        '<button class="btn btn-ghost sm" data-atemplates="' + esc(k) + '">🧪 ' + esc(T("anki_templates")) + '</button>' +
        '<button class="btn btn-ghost sm" data-atype-del="' + esc(k) + '">🗑️</button></span></div>';
    }).join("") + '</div><div id="ankiTypeBox"></div>';
  return h;
}
function templatesHTML(a) {
  var tid = V.editType || "basic";
  var t = a.types[tid] || a.types.basic;
  var h = toolbarHTML("types") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="types">← ' + esc(T("anki_note_type")) + '</button><b dir="auto">' + esc(t.name) + '</b></div>' +
    '<div class="anki-editor glass">' +
    (t.templates || []).map(function (tm, i) {
      return '<h4 dir="auto">' + esc(tm.name || ("#" + (i + 1))) + '</h4>' +
        '<div class="form-group"><label>Q</label><textarea id="ankiTQ_' + i + '" dir="ltr">' + esc(tm.q || "") + '</textarea></div>' +
        '<div class="form-group"><label>A</label><textarea id="ankiTA_' + i + '" dir="ltr">' + esc(tm.a || "") + '</textarea></div>';
    }).join("") +
    '<p class="muted">{"{{Front}}"} · ' + esc((t.fields || []).join(", ")) + '</p>' +
    '<div class="row-flex"><button class="btn btn-primary" data-atsave="' + esc(t.id) + '">' + esc(T("anki_save")) + '</button>' +
    '<button class="btn btn-ghost" data-atpreview="' + esc(t.id) + '">👁️</button></div><div id="ankiTPrev"></div></div>';
  return h;
}
/* ---- statistics view ---- */
function statsHTML(a) {
  var s = computeStats(a, Date.now());
  function card(v, lab) { return '<div class="anki-stat-card"><div class="anki-stat-value">' + v + '</div><div class="anki-stat-label">' + esc(lab) + '</div></div>'; }
  var h = toolbarHTML("stats") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button>' +
    '<span class="muted">🔥 ' + s.streak + ' · ' + esc(T("anki_due")) + ': ' + s.due + '</span></div>' +
    '<div class="anki-stats-grid">' +
    card(s.today.rev, "✓ today") + card(s.today.new, T("anki_new")) + card(s.learning + s.relearning, T("anki_learning")) +
    card(s.review, T("anki_due")) + card(s.overdue, "overdue") + card(s.retention30 == null ? "—" : s.retention30 + "%", "retention 30d") +
    card(s.mature, "mature ≥21d") + card(s.young, "young") + card(s.suspended, "⏸️") + card(s.buried, "📥") + card(s.total, "total") + card(s.reviews30, "reviews 30d") +
    '</div><div class="anki-chart-box"><h4>7d</h4><canvas id="ankiChart" width="640" height="180"></canvas></div>' +
    '<div class="anki-chart-box"><h4>due forecast</h4><div class="anki-forecast">' +
    Object.keys(s.forecast).sort().slice(0, 7).map(function (d) { return '<span class="anki-fday"><b>' + esc(d.slice(5)) + '</b>' + s.forecast[d] + '</span>'; }).join("") +
    '</div></div>';
  return h;
}
function drawChart(a) {
  try {
    var cv = document.getElementById("ankiChart");
    if (!cv) return;
    var s = computeStats(a, Date.now());
    var ctx = cv.getContext("2d");
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    var max = 1;
    s.week.forEach(function (d) { max = Math.max(max, d.rev); });
    var n = Math.max(1, s.week.length), bw = (W - 20) / n;
    s.week.forEach(function (d, i) {
      var h = Math.round((d.rev / max) * (H - 50));
      ctx.fillStyle = "#7c3aed";
      ctx.fillRect(10 + i * bw + 2, H - 30 - h, bw - 4, h);
      ctx.fillStyle = "#888";
      ctx.font = "10px sans-serif";
      ctx.fillText(String(d.d).slice(5), 10 + i * bw + 2, H - 14);
      ctx.fillText(String(d.rev), 10 + i * bw + 2, H - 34 - h);
    });
  } catch (e) {}
}
/* ---- settings ---- */
function settingsHTML(a) {
  var st = a.settings;
  var id = V.deck && a.decks[V.deck] ? V.deck : null;
  var h = toolbarHTML("settings") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button></div>' +
    '<div class="anki-editor glass"><h4>' + esc(T("anki_basic")) + '</h4>' +
    '<div class="form-group"><label>' + esc(T("anki_deck")) + ' (default)</label><select id="ankiSetDef">' +
    Object.keys(a.decks).map(function (k) { return '<option value="' + esc(k) + '"' + (st.defaultDeck === k ? " selected" : "") + '>' + esc(deckPath(a, k)) + '</option>'; }).join("") + '</select></div>' +
    '<div class="form-group"><label>new/day (new decks)</label><input id="ankiSetNew" type="number" min="0" max="100" value="' + clampN(st.newPerDay, 0, 100, 20) + '"></div>' +
    '<div class="form-group"><label>review order</label><select id="ankiSetROrder"><option value="overdue"' + (st.reviewOrder !== "mistakes" ? " selected" : "") + '>overdue first</option><option value="mistakes"' + (st.reviewOrder === "mistakes" ? " selected" : "") + '>hardest first</option></select></div>' +
    '<div class="form-group"><label>new order</label><select id="ankiSetNOrder"><option value="level"' + (st.newOrder !== "random" ? " selected" : "") + '>in order</option><option value="random"' + (st.newOrder === "random" ? " selected" : "") + '>random</option></select></div>' +
    '<label><input type="checkbox" id="ankiSetKeys"' + (st.shortcuts === false ? "" : " checked") + '> shortcuts (1-4/space/e/u)</label>' +
    '<h4 style="margin-top:12px">' + esc(T("anki_advanced")) + '</h4>' +
    '<div class="form-group"><label>learning steps (min)</label><input id="ankiSetSteps" dir="ltr" value="' + esc((st.learnSteps || [10, 30]).join(" ")) + '"></div>' +
    '<div class="form-group"><label>relearning steps (min)</label><input id="ankiSetRSteps" dir="ltr" value="' + esc((st.relearnSteps || [10]).join(" ")) + '"></div>' +
    '<div class="row-flex"><button class="btn btn-primary" data-aset-save="1">' + esc(T("anki_save")) + '</button></div></div>';
  if (id) {
    var o = deckOpts(a, id);
    h += '<div class="anki-editor glass"><h4>⚙️ ' + esc(deckPath(a, id)) + '</h4>' +
      '<div class="form-group"><label>new/day</label><input id="ankiDeckNew" type="number" min="0" max="100" value="' + o.newPerDay + '"></div>' +
      '<div class="form-group"><label>max reviews/day</label><input id="ankiDeckMax" type="number" min="1" max="500" value="' + o.maxReview + '"></div>' +
      '<div class="row-flex"><button class="btn btn-primary" data-adeck-save="' + esc(id) + '">' + esc(T("anki_save")) + '</button></div></div>';
  }
  return h;
}
/* ---- collection ---- */
function collectionHTML(a) {
  var problems = checkDB(a);
  var mkeys = Object.keys(a.media || {});
  var mbytes = mediaBytes(a);
  var unused = unusedMedia(a);
  var h = toolbarHTML("collection") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button></div>' +
    '<div class="anki-editor glass"><h4>🗄️ ' + esc(T("anki_collection")) + '</h4>' +
    '<p class="muted">' + problems.length + ' issues</p>' +
    '<div class="row-flex"><button class="btn btn-ghost sm" data-acoll="check">✓ check database</button>' +
    '<button class="btn btn-ghost sm" data-acoll="empty">∅ empty cards</button>' +
    '<button class="btn btn-ghost sm" data-acoll="unbury">📤 unbury all</button>' +
    '<button class="btn btn-ghost sm" data-aview="io">⇅ backup / CSV</button></div>' +
    '<div id="ankiCollBox">' + (problems.length ? '<ul>' + problems.slice(0, 20).map(function (p) { return '<li class="muted" dir="auto">' + esc(p) + '</li>'; }).join("") + '</ul>' : '<p class="muted">✓ OK</p>') + '</div></div>' +
    '<div class="anki-editor glass"><h4>🖼️ ' + esc(T("anki_media")) + ' · ' + mkeys.length + ' · ' + Math.round(mbytes / 1024) + ' KB</h4>' +
    '<p class="muted">' + esc(T("anki_unused_media")) + ': ' + unused.length + '</p>' +
    '<div class="row-flex"><button class="btn btn-ghost sm" data-acoll="media-clean">🧹 ' + esc(T("anki_cleanup")) + '</button></div>' +
    '<div id="ankiMediaBox">' + (unused.length ? '<div class="anki-thumbs">' + unused.slice(0, 24).map(function (mid) {
      var m = a.media[mid];
      return m ? '<img class="anki-thumb" loading="lazy" src="' + esc(m.thumb || m.data) + '" alt="" data-amedia="' + esc(mid) + '">' : "";
    }).join("") + '</div>' : '<p class="muted">✓ ' + esc(T("anki_no_unused")) + '</p>') + '</div></div>';
  return h;
}
function checkDB(a) {
  var out = [];
  Object.keys(a.cards).forEach(function (k) {
    var c = a.cards[k];
    if (!c) return;
    if (!a.notes[c.note]) out.push("orphan card " + k);
    if (!a.decks[c.deck]) out.push("card with missing deck " + k);
  });
  Object.keys(a.notes).forEach(function (k) {
    var n = a.notes[k];
    if (!n) return;
    var has = Object.keys(a.cards).some(function (x) { return a.cards[x] && a.cards[x].note === k; });
    if (!has) out.push("empty note " + k + " (" + (n.type || "?") + ")");
    if (!a.decks[n.deck]) out.push("note with missing deck " + k);
    try {
      Object.keys(n.fields || {}).forEach(function (f) {
        extractMids(n.fields[f]).forEach(function (mid) {
          if (!a.media || !a.media[mid]) out.push("broken media ref in note " + k + " (" + f + ")");
        });
      });
    } catch (e) {}
  });
  return out;
}
/* ---- custom study ---- */
function customHTML(a) {
  var h = toolbarHTML("study") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button></div>' +
    '<div class="anki-editor glass"><h4>🎯 ' + esc(T("anki_custom_study")) + '</h4>' +
    '<p class="muted">temporary session · cards keep their decks (nothing is duplicated or moved)</p>' +
    '<div class="form-group"><label>' + esc(T("anki_deck")) + '</label><select id="ankiCuDeck"><option value="">all</option>' +
    Object.keys(a.decks).map(function (k) { return '<option value="' + esc(k) + '"' + (V.deck === k ? " selected" : "") + '>' + esc(deckPath(a, k)) + '</option>'; }).join("") + '</select></div>' +
    '<div class="form-group"><label>filter</label><select id="ankiCuMode"><option value="due">due + new</option><option value="forgotten">forgotten (again-rated)</option><option value="hard">hard (suspended-free, ease&lt;2.0)</option><option value="tag">by tag + text query</option><option value="ahead">ahead (not-yet-due reviews)</option></select></div>' +
    '<div class="form-group"><label>tag / query</label><input id="ankiCuQ" dir="auto" placeholder="tag:verb"></div>' +
    '<div class="form-group"><label>limit</label><input id="ankiCuN" type="number" min="1" max="200" value="20"></div>' +
    '<div class="row-flex"><button class="btn btn-primary" data-acustom-go="1">🚀 start</button></div></div>';
  return h;
}
/* ---- import / export ---- */
function ioHTML(a) {
  var h = toolbarHTML("io") +
    '<div class="anki-backrow"><button class="btn btn-ghost sm" data-aview="home">' + esc(T("anki_back_decks")) + '</button></div>' +
    '<div class="anki-editor glass"><h4>📤 ' + esc(T("anki_export")) + '</h4>' +
    '<div class="row-flex"><button class="btn btn-ghost sm" data-aexport="csv">CSV (all)</button>' +
    '<button class="btn btn-ghost sm" data-aexport="json">JSON backup</button></div>' +
    '<h4 style="margin-top:12px">📥 ' + esc(T("anki_import")) + '</h4>' +
    '<p class="muted">CSV: Front,Back,Deck,Tags[,Type,Extra] · .apkg is NOT supported<br>' + esc(T("anki_csv_media_note")) + '</p>' +
    '<div class="form-group"><label>CSV file</label><input type="file" id="ankiCsvFile" accept=".csv,text/csv"></div>' +
    '<div class="form-group"><label>paste CSV</label><textarea id="ankiCsvText" dir="auto" placeholder="Front,Back,Deck,Tags"></textarea></div>' +
    '<div class="row-flex"><button class="btn btn-primary" data-aimport="1">' + esc(T("anki_import")) + '</button></div><div id="ankiIoBox"></div>' +
    '<h4 style="margin-top:12px">JSON restore</h4><div class="form-group"><input type="file" id="ankiJsonFile" accept=".json,application/json"></div></div>';
  return h;
}
/* ================= N. events ================= */
function closeMenu() { try { var m = document.getElementById("ankiMenu"); if (m) m.remove(); } catch (e) {} }
function openDeckMenu(a, deckId, anchor) {
  closeMenu();
  var d = a.decks[deckId];
  if (!d) return;
  var m = document.createElement("div");
  m.id = "ankiMenu";
  m.className = "anki-menu";
  m.innerHTML =
    '<button data-m="study">📖 ' + esc(T("anki_study")) + '</button>' +
    '<button data-m="add">➕ ' + esc(T("anki_add")) + '</button>' +
    '<button data-m="browse">🔍 ' + esc(T("anki_browse")) + '</button>' +
    '<button data-m="overview">👁 ' + esc(T("anki_overview")) + '</button>' +
    '<button data-m="sub">📁 subdeck</button>' +
    '<button data-m="opts">⚙️ ' + esc(T("anki_deck_options")) + '</button>' +
    '<button data-m="custom">🎯 ' + esc(T("anki_custom_study")) + '</button>' +
    '<button data-m="export">📤 CSV</button>' +
    '<button data-m="rename">✏️ ' + esc(T("anki_rename")) + '</button>' +
    '<button data-m="del" class="danger">🗑️ ' + esc(T("anki_delete")) + '</button>';
  document.body.appendChild(m);
  try {
    var r = anchor.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 4) + "px";
    m.style.insetInlineEnd = Math.max(8, window.innerWidth - r.right) + "px";
  } catch (e) {}
  m.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-m]") : null;
    if (!b) return;
    var k = b.getAttribute("data-m");
    closeMenu();
    if (k === "study") { V.deck = deckId; startSession(A(), deckId, {}); }
    else if (k === "add") { V.deck = deckId; setView({ name: "add" }); }
    else if (k === "browse") { V.deck = deckId; setView({ name: "browse", q: "deck:" + deckPath(A(), deckId), page: 0 }); }
    else if (k === "overview") { setView({ name: "overview", deck: deckId }); }
    else if (k === "sub") {
      var res = createDeck(A(), deckPath(A(), deckId) + "::New deck", null);
      if (res.id) { renameFlow(A(), res.id); }
      render();
    }
    else if (k === "opts") { setView({ name: "settings", deck: deckId }); }
    else if (k === "custom") { setView({ name: "custom", deck: deckId }); }
    else if (k === "export") {
      var ids = Object.keys(A().cards).filter(function (x) { return descendants(A(), deckId).indexOf(A().cards[x].deck) >= 0; });
      downloadFile("ankidroid-" + deckPath(A(), deckId).replace(/::/g, "-") + ".csv", exportCSV(A(), ids), "text/csv;charset=utf-8");
    }
    else if (k === "rename") { renameFlow(A(), deckId); }
    else if (k === "del") { deleteFlow(A(), deckId); }
  });
  setTimeout(function () { document.addEventListener("click", function h(e) { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener("click", h); } }); }, 10);
}
function renameFlow(a, deckId) {
  var d = a.decks[deckId];
  if (!d) return;
  var v = null;
  try { v = window.prompt(T("anki_rename") + ": " + deckPath(a, deckId), d.name); } catch (e) {}
  if (v === null || v === undefined) return;
  if (!renameDeck(a, deckId, v)) toastM("✖", "err");
  render();
}
function deleteFlow(a, deckId) {
  var c = deckCounts(a, deckId, Date.now());
  if (childrenOf(a, deckId).length) { toastM("📁 ✖", "err"); return; }
  var msg = T("anki_confirm_delete") + " (" + deckPath(a, deckId) + ", " + c.total + " cards)";
  var ok = false;
  try { ok = window.confirm(msg); } catch (e) {}
  if (!ok) return;
  var res = deleteDeck(a, deckId, null);
  if (res.error === "has-cards") {
    var target = a.settings.defaultDeck && a.decks[a.settings.defaultDeck] ? a.settings.defaultDeck : Object.keys(a.decks).filter(function (k) { return k !== deckId; })[0];
    if (target) {
      var ok2 = false;
      try { ok2 = window.confirm("move " + res.count + " cards to " + deckPath(a, target) + "?"); } catch (e2) {}
      if (ok2) deleteDeck(a, deckId, target);
      else return;
    } else { toastM("✖", "err"); return; }
  }
  if (V.deck === deckId) V.deck = null;
  if (V.name === "overview") V.name = "home";
  render();
}
function collectSel() { return Object.keys(V.sel).filter(function (k) { return V.sel[k]; }); }
function bulkOp(a, op) {
  var ids = collectSel();
  if (!ids.length) { toastM("0", ""); return; }
  var ok = false;
  try { ok = op === "del" ? window.confirm("🗑️ " + ids.length + "?") : true; } catch (e) { ok = op !== "del"; }
  if (!ok) return;
  ids.forEach(function (id) {
    var c = a.cards[id];
    if (!c) return;
    if (op === "sus") c.susp = true;
    else if (op === "unsus") c.susp = false;
    else if (op === "bury") c.buried = 1;
    else if (op === "unbury") c.buried = 0;
    else if (op === "reset") { c.sched = { st: "new", step: 0, iv: 0, laps: 0, ease: 2.5, e: 2.5, due: todayKey(), dueMin: 0, last: null, miss: 0, reps: 0 }; }
    else if (op === "del") { var n = a.notes[c.note]; delete a.cards[id]; if (n) { var left = Object.keys(a.cards).some(function (x) { return a.cards[x] && a.cards[x].note === c.note; }); if (!left) delete a.notes[c.note]; } }
  });
  V.sel = {};
  commit();
  if (op === "del") pruneMedia(a);
  render();
}
function bindRoot(r, a) {
  if (!r || r._ankiBound) { drawChart(a); return; }
  r._ankiBound = true;
  drawChart(a);
  r.addEventListener("click", function (ev) {
    var q = function (sel) { return ev.target.closest ? ev.target.closest(sel) : null; };
    var b;
    if ((b = q("[data-aview]"))) { SESS = null; setView({ name: b.getAttribute("data-aview"), page: 0 }); return; }
    /* NOTE: this click handler is bound once; always re-read the live
     * identity-scoped collection via A() here (the `a` closure goes stale
     * across identity switches and would mutate a detached object whose
     * change is then lost by persist()). All other branches already do. */
    if ((b = q("[data-atoggle]"))) { var sa = A(); var d = sa.decks[b.getAttribute("data-atoggle")]; if (d) { d.collapsed = !d.collapsed; commit(false); render(); } return; }
    if ((b = q("[data-aoverview]"))) { SESS = null; setView({ name: "overview", deck: b.getAttribute("data-aoverview") }); return; }
    if ((b = q("[data-amenu]"))) { ev.stopPropagation(); openDeckMenu(A(), b.getAttribute("data-amenu"), b); return; }
    if ((b = q("[data-astudy]"))) { V.deck = b.getAttribute("data-astudy"); startSession(A(), V.deck, {}); return; }
    if ((b = q("[data-aopts]"))) { setView({ name: "settings", deck: b.getAttribute("data-aopts") }); return; }
    if ((b = q("[data-ashow]"))) { if (SESS) { SESS.revealed = true; render(); var c = document.getElementById("ankiCard"); if (c) c.focus(); } return; }
    if ((b = q("[data-arate]"))) { rateCurrent(b.getAttribute("data-arate")); return; }
    if ((b = q("[data-asay]"))) {
      var card = SESS ? sessCard(A()) : null;
      if (card) { var sides = cardSides(A(), card); var txt = (b.getAttribute("data-asay") === "back" ? sides.fields.Back : sides.fields.Front) || ""; var tmp = document.createElement("div"); tmp.innerHTML = applyTemplate("{{x}}", { x: txt }); speakText(tmp.textContent); }
      return;
    }
    if ((b = q("[data-apron]"))) { pronFlow(); return; }
    if ((b = q("[data-aeditnote]"))) { setView({ name: "edit", editNote: b.getAttribute("data-aeditnote") }); return; }
    if ((b = q("[data-asuspend]"))) { var cc = SESS ? sessCard(A()) : null; if (cc) { cc.susp = true; commit(); SESS.idx++; SESS.revealed = false; render(); } return; }
    if ((b = q("[data-abury]"))) { var c2 = SESS ? sessCard(A()) : null; if (c2) { c2.buried = 1; commit(); SESS.idx++; SESS.revealed = false; render(); } return; }
    if ((b = q("[data-aundo]"))) {
      var sa = A();
      if (SESS && SESS.undoStack.length) {
        var last = SESS.undoStack.pop();
        var cd = sa.cards[last.c];
        if (cd) { cd.sched = last.prev; commit(); }
        SESS.idx = Math.max(0, SESS.idx - 1); SESS.revealed = true; render();
      } else if (undoLast(sa)) { render(); }
      return;
    }
    if ((b = q("[data-aseed]"))) {
      var res = seedFromContent(A(), "levels");
      toastM(res.error ? "✖" : "⚡ " + (res.cards || 0), res.error ? "err" : "ok");
      render(); return;
    }
    if ((b = q("[data-asave]"))) { saveEditor(A(), b.getAttribute("data-asave")); return; }
    if ((b = q("[data-abFloyd]"))) { bulkOp(A(), b.getAttribute("data-abFloyd")); return; }
    if ((b = q("[data-apage]"))) { V.page = Math.max(0, (V.page | 0) + parseInt(b.getAttribute("data-apage"), 10)); render(); return; }
    if ((b = q("[data-atype-new]"))) { typeEditor(A(), null); return; }
    if ((b = q("[data-atype-edit]"))) { typeEditor(A(), b.getAttribute("data-atype-edit")); return; }
    if ((b = q("[data-atype-del]"))) { deleteType(A(), b.getAttribute("data-atype-del")); return; }
    if ((b = q("[data-atemplates]"))) { setView({ name: "templates", editType: b.getAttribute("data-atemplates") }); return; }
    if ((b = q("[data-atsave]"))) { saveTemplates(A(), b.getAttribute("data-atsave")); return; }
    if ((b = q("[data-atpreview]"))) { previewTemplate(A(), b.getAttribute("data-atpreview")); return; }
    if ((b = q("[data-aset-save]"))) { saveSettings(A()); return; }
    if ((b = q("[data-adeck-save]"))) { saveDeckOpts(A(), b.getAttribute("data-adeck-save")); return; }
    if ((b = q("[data-acoll]"))) {
      var ck = b.getAttribute("data-acoll");
      if (ck === "media-clean") { collMediaClean(A()); return; }
      collAction(A(), ck); return;
    }
    if ((b = q("[data-acustom-go]"))) { customGo(A()); return; }
    if ((b = q("[data-aexport]"))) {
      var kind = b.getAttribute("data-aexport");
      if (kind === "json") downloadFile("ankidroid-backup-" + todayKey() + ".json", JSON.stringify(A()), "application/json");
      else downloadFile("ankidroid-all-" + todayKey() + ".csv", exportCSV(A(), Object.keys(A().cards)), "text/csv;charset=utf-8");
      return;
    }
    if ((b = q("[data-aimport]"))) { csvImportFlow(A()); return; }
    if ((b = q("[data-amedia-file]"))) { var fi = document.getElementById("ankiImgFile"); if (fi) fi.click(); return; }
    if ((b = q("[data-amedia-url]"))) { var ur = document.getElementById("ankiImgUrlRow"); if (ur) ur.classList.toggle("hidden"); var ui = document.getElementById("ankiImgUrl"); if (ui && !ur.classList.contains("hidden")) ui.focus(); return; }
    if ((b = q("[data-amedia-fetch]"))) { mediaFetchFlow(); return; }
    if ((b = q("[data-amedia-rm]"))) {
      var parts = String(b.getAttribute("data-amedia-rm")).split(":");
      EMR.push({ field: parts[0], mid: parts[1] });
      if (EM && EM.field === parts[0] && EM.mid === parts[1]) EM = null;
      render(); return;
    }
    if ((b = q("[data-amedia-rep]"))) {
      var pr = String(b.getAttribute("data-amedia-rep")).split(":");
      EMR.push({ field: pr[0], mid: pr[1] });
      EM = { field: pr[0], mid: null };
      var fi2 = document.getElementById("ankiImgFile");
      if (fi2) fi2.click(); else render();
      return;
    }
    if ((b = q("[data-amedia-full]"))) { openLightbox(A(), b.getAttribute("data-amedia-full")); return; }
    if ((b = q("[data-amedia]"))) {
      try { ev.stopImmediatePropagation(); } catch (e) {}
      openLightbox(A(), b.getAttribute("data-amedia"));
      return;
    }
    if ((b = q("[data-amedialightbox]"))) { closeLightbox(); return; }
  });
  r.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t || !t.id) {
      if (t && t.getAttribute && t.getAttribute("data-asel") !== null) {
        var id = t.getAttribute("data-asel");
        if (t.checked) V.sel[id] = 1; else delete V.sel[id];
      }
      return;
    }
    if (t.id === "ankiSort") { V.sortK = t.value; V.page = 0; render(); }
    else if (t.id === "ankiSelAll") {
      var on = t.checked;
      r.querySelectorAll("[data-asel]").forEach(function (cb) {
        var id = cb.getAttribute("data-asel");
        if (on) V.sel[id] = 1; else delete V.sel[id];
        cb.checked = on;
      });
    }
    else if (t.id === "ankiEdType") { V.editType = t.value; if (V.name === "add") render(); }
    else if (t.id === "ankiCsvFile" && t.files && t.files[0]) { readCSVFile(A(), t.files[0]); }
    else if (t.id === "ankiJsonFile" && t.files && t.files[0]) { readJSONFile(A(), t.files[0]); }
    else if (t.id === "ankiImgFile" && t.files && t.files[0]) { mediaFileFlow(t.files[0]); }
    else if (t.id === "ankiImgField" && EM) { EM.field = t.value || EM.field; }
  });
  r.addEventListener("input", function (ev) {
    var t = ev.target;
    if (t && t.id === "ankiSearch") {
      V.q = t.value; V.page = 0;
      clearTimeout(r._sq);
      r._sq = setTimeout(function () {
        try {
          var pos = t.selectionStart;
          render();
          var n = document.getElementById("ankiSearch");
          if (n) { n.focus(); n.setSelectionRange(pos, pos); }
        } catch (e) {}
      }, 350);
    }
  });
  r.addEventListener("click", function (ev) {
    var c = ev.target.closest ? ev.target.closest("#ankiCard") : null;
    if (c && SESS && !SESS.revealed && !ev.target.closest("button")) { SESS.revealed = true; render(); }
  });
}
/* ---- note images: import flows + lightbox ---- */
function mediaErrMsg(code) {
  return code === "too-large" ? T("anki_img_too_large")
    : code === "bad-type" ? T("anki_img_bad_type")
    : code === "svg" ? T("anki_img_svg")
    : code === "bad-url" ? T("anki_img_bad_url")
    : code === "unreachable" ? T("anki_img_load_fail")
    : code === "non-image" ? T("anki_img_load_fail")
    : code === "budget" ? T("anki_img_budget")
    : T("anki_img_bad_file");
}
function mediaFieldSel() {
  var s = null;
  try { s = document.getElementById("ankiImgField"); } catch (e) {}
  return s && s.value ? s.value : "Front";
}
function mediaFileFlow(file) {
  var a = A();
  var field = mediaFieldSel();
  var msg = null;
  try { msg = document.getElementById("ankiImgUrlMsg"); } catch (e) {}
  importFileAsset(a, file).then(function (res) {
    if (res.error) {
      if (msg) { msg.textContent = mediaErrMsg(res.error); }
      else toastM(mediaErrMsg(res.error), "err");
      try { var fi = document.getElementById("ankiImgFile"); if (fi) fi.value = ""; } catch (e) {}
      return;
    }
    EM = { field: field, mid: res.id };
    toastM(T("anki_img_saved"), "ok");
    render();
  });
}
function mediaFetchFlow() {
  var a = A();
  var field = mediaFieldSel();
  var url = val("ankiImgUrl");
  var msg = null;
  try { msg = document.getElementById("ankiImgUrlMsg"); } catch (e) {}
  var v = validateImageURL(url);
  if (v.error) { if (msg) msg.textContent = mediaErrMsg(v.error); return; }
  if (msg) msg.textContent = "…";
  importURLAsset(a, url).then(function (res) {
    if (res.error) {
      if (msg) msg.textContent = mediaErrMsg(res.error);
      else toastM(mediaErrMsg(res.error), "err");
      return;
    }
    EM = { field: field, mid: res.id };
    toastM(T("anki_img_saved"), "ok");
    render();
  });
}
function openLightbox(a, mid) {
  try {
    closeLightbox();
    var m = a && a.media ? a.media[mid] : null;
    if (!m || !m.data) return;
    var ov = document.createElement("div");
    ov.id = "ankiLightbox";
    ov.className = "anki-lightbox";
    ov.setAttribute("data-amedialightbox", "1");
    ov.innerHTML = '<img class="anki-lightbox-img" src="' + esc(m.data) + '" alt="">' +
      '<div class="anki-lightbox-cap muted">' + (m.w | 0) + '×' + (m.h | 0) + ' · ' + Math.round((m.bytes | 0) / 1024) + ' KB · ✖</div>';
    document.body.appendChild(ov);
  } catch (e) {}
}
function closeLightbox() { try { var ov = document.getElementById("ankiLightbox"); if (ov) ov.remove(); } catch (e) {} }
function bindLightbox() {
  /* The lightbox overlay is appended to <body> (outside #ankiRoot) so it
   * always covers the viewport; its clicks never reach bindRoot's delegated
   * handler, hence this separate document-level closer (registered once). */
  try {
    if (document._ankiLB) return;
    document._ankiLB = true;
    document.addEventListener("click", function (ev) {
      try {
        var t = ev.target && ev.target.closest ? ev.target.closest("[data-amedialightbox]") : null;
        if (t) closeLightbox();
      } catch (e) {}
    });
  } catch (e) {}
}
/* ================= O. mutations from UI ================= */
function val(id) { try { var e = document.getElementById(id); return e ? e.value : ""; } catch (e) { return ""; } }
function saveEditor(a, mode) {
  var isEdit = mode === "edit";
  var typeId = val("ankiEdType") || "basic";
  var type = a.types[typeId] || a.types.basic;
  var deck = val("ankiEdDeck") || a.settings.defaultDeck;
  var fields = {};
  (type.fields || []).forEach(function (f) { fields[f] = String(val("ankiEdF_" + f)).slice(0, 4000); });
  var tags = val("ankiEdTags");
  /* merge staged image edits: removals first, then the pending attachment */
  (EMR || []).forEach(function (r) {
    if (fields[r.field] !== undefined && r.mid) {
      var re = new RegExp("\\[\\[m:" + String(r.mid).replace(/[^A-Za-z0-9]/g, "") + "\\]\\]", "g");
      fields[r.field] = String(fields[r.field] || "").replace(re, "").replace(/[ \t]{2,}/g, " ").trim();
    }
  });
  if (EM && EM.mid && EM.field && fields[EM.field] !== undefined && a.media && a.media[EM.mid]) {
    if (extractMids(fields[EM.field]).indexOf(EM.mid) < 0) {
      fields[EM.field] = (String(fields[EM.field] || "").trim() + " [[m:" + EM.mid + "]]").trim();
    }
  }
  if (isEdit) {
    var nid = V.editNote;
    var res = editNote(a, nid, { fields: fields, tags: tags, deck: deck });
    /* Never report success before persistence actually succeeds; on failure
     * stay on the editor so the user's data (DOM + draft) is preserved. */
    if (res.error) { toastM("✖ " + res.error, "err"); return; }
    EM = null; EMR = []; ED = null;
    pruneMedia(a);
    setView({ name: "browse" });
  } else {
    var r = addNote(a, { type: typeId, deck: deck, fields: fields, tags: tags });
    if (r.error) { toastM("✖ " + r.error, "err"); return; }
    EM = null; EMR = []; ED = null;
    toastM("✅", "ok");
    /* Close the Add screen and return to the deck the card actually landed
     * in (addNote may have fallen back when the selection was stale), so
     * counts/overview/study show the new card immediately. */
    var landed = null;
    try {
      var saved = A().notes[r.note];
      if (saved && saved.deck && A().decks[saved.deck]) landed = saved.deck;
    } catch (e) {}
    if (landed) setView({ name: "overview", deck: landed });
    else setView({ name: "home", page: 0 });
  }
}
function typeEditor(a, tid) {
  var box = document.getElementById("ankiTypeBox");
  if (!box) return;
  var t = tid ? a.types[tid] : { id: "", name: "", fields: ["Front", "Back"], templates: [{ name: "Forward", q: "{{Front}}", a: "{{Front}}<hr>{{Back}}" }] };
  if (tid && !t) return;
  box.innerHTML = '<div class="anki-editor glass"><h4>' + (tid ? "✏️" : "＋") + ' ' + esc(T("anki_note_type")) + '</h4>' +
    '<div class="form-group"><label>id</label><input id="ankiTyId" dir="ltr" value="' + esc(t.id) + '"' + (tid ? " disabled" : "") + '></div>' +
    '<div class="form-group"><label>name</label><input id="ankiTyName" dir="auto" value="' + esc(t.name) + '"></div>' +
    '<div class="form-group"><label>fields (space separated)</label><input id="ankiTyFields" dir="ltr" value="' + esc((t.fields || []).join(" ")) + '"></div>' +
    '<div class="row-flex"><button class="btn btn-primary" id="ankiTySave"> ' + esc(T("anki_save")) + '</button></div></div>';
  document.getElementById("ankiTySave").addEventListener("click", function () {
    var nid = tid || String(val("ankiTyId")).trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    var nm = String(val("ankiTyName")).trim().slice(0, 60);
    var fl = String(val("ankiTyFields")).split(/\s+/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 12);
    if (!nid || !nm || !fl.length) { toastM("✖", "err"); return; }
    if (!tid && a.types[nid]) { toastM("✖ dup", "err"); return; }
    if (!tid) a.types[nid] = { id: nid, name: nm, fields: fl, templates: [{ name: "Forward", q: "{{" + fl[0] + "}}", a: "{{" + fl[0] + "}}<hr>{{" + (fl[1] || fl[0]) + "}}" }] };
    else { a.types[tid].name = nm; a.types[tid].fields = fl; }
    commit(); render();
  });
}
function deleteType(a, tid) {
  if (!a.types[tid] || ["basic", "basic_rev", "vocab"].indexOf(tid) >= 0) { toastM("🔒", "err"); return; }
  var n = Object.keys(a.notes).filter(function (x) { return a.notes[x] && a.notes[x].type === tid; }).length;
  if (n) { toastM("✖ " + n + " notes", "err"); return; }
  var ok = false;
  try { ok = window.confirm(T("anki_delete") + " " + tid + "?"); } catch (e) {}
  if (!ok) return;
  delete a.types[tid];
  commit(); render();
}
function saveTemplates(a, tid) {
  var t = a.types[tid];
  if (!t) return;
  (t.templates || []).forEach(function (tm, i) {
    tm.q = String(val("ankiTQ_" + i)).slice(0, 4000);
    tm.a = String(val("ankiTA_" + i)).slice(0, 4000);
    if (!tm.q) tm.q = "{{Front}}";
    if (!tm.a) tm.a = "{{Back}}";
  });
  commit(); toastM("✅", "ok"); render();
}
function previewTemplate(a, tid) {
  var box = document.getElementById("ankiTPrev");
  if (!box) return;
  var t = a.types[tid];
  if (!t) return;
  var sample = {};
  (t.fields || []).forEach(function (f) { sample[f] = "[" + f + "] مثال Beispiel"; });
  box.innerHTML = (t.templates || []).map(function (tm) {
    return '<div class="anki-tprev"><b dir="auto">' + esc(tm.name || "") + '</b><div class="anki-card-front" dir="auto">' + applyTemplate(tm.q, sample) + '</div><div class="anki-card-back" dir="auto">' + applyTemplate(tm.a, sample) + '</div></div>';
  }).join("");
}
function saveSettings(a) {
  var st = a.settings;
  var dd = val("ankiSetDef");
  if (dd && a.decks[dd]) st.defaultDeck = dd;
  st.reviewOrder = val("ankiSetROrder") === "mistakes" ? "mistakes" : "overdue";
  st.newOrder = val("ankiSetNOrder") === "random" ? "random" : "level";
  st.newPerDay = clampN(val("ankiSetNew"), 0, 100, 20);
  try { st.shortcuts = !!document.getElementById("ankiSetKeys").checked; } catch (e) {}
  function steps(id, fb) {
    var raw = String(val(id)).split(/[\s,;]+/).map(function (x) { return parseFloat(x); }).filter(function (x) { return isFinite(x) && x > 0 && x <= 1440; }).slice(0, 6);
    return raw.length ? raw : fb;
  }
  st.learnSteps = steps("ankiSetSteps", [10, 30]);
  st.relearnSteps = steps("ankiSetRSteps", [10]);
  commit(); toastM("✅", "ok"); render();
}
function saveDeckOpts(a, id) {
  var d = a.decks[id];
  if (!d) return;
  d.opts = d.opts || {};
  d.opts.newPerDay = clampN(val("ankiDeckNew"), 0, 100, 20);
  d.opts.maxReview = clampN(val("ankiDeckMax"), 1, 500, 100);
  commit(); toastM("✅", "ok"); render();
}
function collAction(a, kind) {
  var box = document.getElementById("ankiCollBox");
  if (kind === "unbury") {
    Object.keys(a.cards).forEach(function (k) { if (a.cards[k]) a.cards[k].buried = 0; });
    commit(); render(); return;
  }
  if (kind === "empty") {
    var prob = checkDB(a);
    var empties = [];
    Object.keys(a.notes).forEach(function (k) {
      var has = Object.keys(a.cards).some(function (x) { return a.cards[x] && a.cards[x].note === k; });
      if (!has) empties.push(k);
    });
    if (!empties.length) { if (box) box.innerHTML = '<p class="muted">✓ ∅</p>'; return; }
    var ok = false;
    try { ok = window.confirm("delete " + empties.length + " empty notes?"); } catch (e) {}
    if (ok) { empties.forEach(function (k) { delete a.notes[k]; }); commit(); }
    render(); return;
  }
  var p = checkDB(a);
  if (box) box.innerHTML = p.length ? "<ul>" + p.slice(0, 20).map(function (x) { return '<li class="muted" dir="auto">' + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="muted">✓ OK</p>';
}
function collMediaClean(a) {
  var unused = unusedMedia(a);
  if (!unused.length) { toastM("✓ " + T("anki_no_unused"), "ok"); return; }
  var ok = false;
  try { ok = window.confirm(T("anki_cleanup") + " (" + unused.length + ")?"); } catch (e) {}
  if (!ok) return;
  pruneMedia(a);
  render();
}
function customGo(a) {
  var deck = val("ankiCuDeck") || null;
  var mode = val("ankiCuMode") || "due";
  var q = val("ankiCuQ") || "";
  var n = clampN(val("ankiCuN"), 1, 200, 20);
  var pool = deck && a.decks[deck] ? cardsInDecks(a, descendants(a, deck)) : Object.keys(a.cards).map(function (k) { return a.cards[k]; });
  var ids = [];
  if (mode === "tag") {
    ids = searchCards(a, q || "is:due", Date.now()).filter(function (c) { return !deck || descendants(a, deck).indexOf(c.deck) >= 0; }).map(function (c) { return c.id; });
  } else if (mode === "forgotten") {
    ids = a.log.filter(function (e) { return e.r === "again"; }).map(function (e) { return e.c; })
      .filter(function (id, i, arr) { return arr.indexOf(id) === i && a.cards[id] && !a.cards[id].susp && !a.cards[id].buried && (!deck || descendants(a, deck).indexOf(a.cards[id].deck) >= 0); });
  } else if (mode === "hard") {
    ids = pool.filter(function (c) { return c && !c.susp && !c.buried && (c.sched.ease | 0) < 2 && c.sched.ease < 2.0; }).map(function (c) { return c.id; });
  } else if (mode === "ahead") {
    ids = pool.filter(function (c) { return c && !c.susp && !c.buried && schedOf(c).st === "review" && bucketOf(c, Date.now()) === "later"; }).map(function (c) { return c.id; });
  } else {
    var bq = deck ? buildQueue(a, deck, { maxReview: n }) : buildQueue(a, Object.keys(a.decks)[0], { maxReview: 0 });
    ids = (deck ? bq.items : pool.filter(function (c) { return c && !c.susp && !c.buried && bucketOf(c, Date.now()) !== "later"; })).map(function (c) { return c.id || c; });
  }
  ids = ids.slice(0, n);
  if (!ids.length) { toastM("∅", ""); return; }
  startSession(a, deck || Object.keys(a.decks)[0], { onlyIds: ids, maxReview: n, newPerDay: n, custom: true, includeAhead: mode === "ahead", limit: n });
}
function readCSVFile(a, file) {
  try {
    var rd = new FileReader();
    rd.onload = function () {
      var rows = parseCSV(String(rd.result || ""));
      var rep = importRows(a, rows, {});
      var box = document.getElementById("ankiIoBox");
      if (box) box.innerHTML = '<p dir="auto">+ ' + rep.added + ' · skip ' + rep.skipped + (rep.errors.length ? "<br>" + esc(rep.errors.slice(0, 6).join(" | ")) : "") + "</p>";
      render();
    };
    rd.readAsText(file);
  } catch (e) { toastM("✖", "err"); }
}
function csvImportFlow(a) {
  var ta = document.getElementById("ankiCsvText");
  var txt = ta ? ta.value : "";
  if (!txt.trim()) { toastM("∅", ""); return; }
  var rep = importRows(a, parseCSV(txt), {});
  var box = document.getElementById("ankiIoBox");
  if (box) box.innerHTML = '<p dir="auto">+ ' + rep.added + ' · skip ' + rep.skipped + "</p>";
  render();
}
function readJSONFile(a, file) {
  try {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(String(rd.result || "{}"));
        if (!data || typeof data !== "object" || !data.decks || !data.cards || !data.notes) throw new Error("bad backup");
        var ok = false;
        try { ok = window.confirm("restore backup? current collection will be replaced."); } catch (e) {}
        if (!ok) return;
        var S = liveS();
        S.anki = data;
        A(); commit(); render();
      } catch (e) { toastM("✖ backup", "err"); }
    };
    rd.readAsText(file);
  } catch (e) { toastM("✖", "err"); }
}
/* ---- pronunciation check (honest: transcript + word overlap, no fake score) ---- */
var _rec = null, _mrec = null, _mchunks = [];
function pronFlow() {
  var box = document.getElementById("ankiPronBox");
  if (!box) return;
  var a = A();
  var card = SESS ? sessCard(a) : null;
  if (!card) return;
  var F = cardSides(a, card).fields || {};
  var expected = String(F.Front || "") + " " + String(F.Back || "");
  function heard(transcript) {
    var ew = norm(expected).split(/\s+/).filter(Boolean);
    var tw = norm(transcript).split(/\s+/).filter(Boolean);
    var hit = tw.filter(function (w) { return ew.indexOf(w) >= 0; }).length;
    box.innerHTML = '<div class="anki-pron" dir="auto">🎤 "' + esc(transcript) + '"<br><span class="muted">' + hit + "/" + tw.length + " words match · " + esc(T("anki_check_pron")) + '</span></div>';
  }
  if (recogSupport()) {
    try {
      if (_rec) { try { _rec.stop(); } catch (e) {} }
      var RC = window.SpeechRecognition || window.webkitSpeechRecognition;
      _rec = new RC();
      _rec.lang = "de-DE";
      _rec.interimResults = false;
      _rec.maxAlternatives = 1;
      box.innerHTML = '<div class="anki-pron muted">🎤 …</div>';
      _rec.onresult = function (ev) {
        try { heard(ev.results[0][0].transcript || ""); } catch (e) { box.innerHTML = ""; }
      };
      _rec.onerror = function () { box.innerHTML = '<div class="anki-pron muted">🎤 ✖</div>'; };
      _rec.onend = function () { _rec = null; };
      _rec.start();
      return;
    } catch (e) {}
  }
  if (recordSupport()) {
    box.innerHTML = '<div class="anki-pron"><button class="btn btn-ghost sm" id="ankiRecBtn">⏺ ' + esc(T("anki_record")) + '</button> <button class="btn btn-ghost sm" id="ankiPlayBtn" disabled>🔊 ' + esc(T("anki_replay")) + '</button></div>';
    var rb = document.getElementById("ankiRecBtn"), pb = document.getElementById("ankiPlayBtn");
    var url = null;
    if (rb) rb.addEventListener("click", function () {
      try {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
          _mchunks = [];
          _mrec = new MediaRecorder(stream);
          _mrec.ondataavailable = function (e) { if (e.data && e.data.size) _mchunks.push(e.data); };
          _mrec.onstop = function () {
            try {
              url = URL.createObjectURL(new Blob(_mchunks, { type: _mrec.mimeType || "audio/webm" }));
              if (pb) pb.disabled = false;
              stream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e2) {} });
            } catch (e3) {}
          };
          _mrec.start();
          rb.disabled = true;
          setTimeout(function () { try { if (_mrec && _mrec.state !== "inactive") _mrec.stop(); } catch (e4) {} rb.disabled = false; }, 6000);
        }).catch(function () { box.innerHTML = '<div class="anki-pron muted">🎤 ✖</div>'; });
      } catch (e5) {}
    });
    if (pb) pb.addEventListener("click", function () { try { if (url) new Audio(url).play(); } catch (e6) {} });
    return;
  }
  box.innerHTML = '<div class="anki-pron muted">🎤 N/A</div>';
}

/* ================= P. shortcuts + boot ================= */
function isTyping(el) {
  try {
    if (!el) return false;
    var tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
  } catch (e) { return false; }
}
function ankiVisible() {
  try {
    var p = document.getElementById("page-ankidroid");
    return !!(p && p.classList.contains("active"));
  } catch (e) { return false; }
}
function bindKeys() {
  if (document._ankiKeys) return;
  document._ankiKeys = true;
  document.addEventListener("keydown", function (ev) {
    try {
      if (!A().settings.shortcuts && A().settings.shortcuts === false) return;
      if (ev.defaultPrevented || isTyping(ev.target) || !ankiVisible() || !SESS) return;
      var k = ev.key;
      if (k === " " || k === "Enter") {
        ev.preventDefault();
        if (!SESS.revealed) { SESS.revealed = true; render(); }
        else rateCurrent("good");
        return;
      }
      var map = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
      if (map[k]) {
        if (!SESS.revealed) return;
        ev.preventDefault();
        rateCurrent(map[k]);
        return;
      }
      if (k === "e" || k === "E") {
        var c = sessCard(A());
        if (c && SESS.revealed) { ev.preventDefault(); setView({ name: "edit", editNote: c.note }); }
      } else if (k === "u" || k === "U") {
        var sa = A();
        if (SESS && SESS.undoStack.length) {
          var last = SESS.undoStack.pop();
          var cd = sa.cards[last.c];
          if (cd) cd.sched = last.prev;
          commit();
          SESS.idx = Math.max(0, SESS.idx - 1); SESS.revealed = true; render();
        }
      }
    } catch (e) {}
  });
}
function renderIfVisible() { try { if (ankiVisible()) render(); } catch (e) {} }
function boot() {
  if (typeof document === "undefined" || !document.getElementById) return;
  bindKeys();
  bindLightbox();
  function hookNav() {
    try {
      document.querySelectorAll('[data-page="ankidroid"]').forEach(function (b) {
        if (b._ankiNav) return;
        b._ankiNav = true;
        b.addEventListener("click", function () { setTimeout(renderIfVisible, 30); });
      });
    } catch (e) {}
  }
  function observe() {
    try {
      var p = document.getElementById("page-ankidroid");
      if (p && window.MutationObserver) {
        new MutationObserver(function () { renderIfVisible(); }).observe(p, { attributes: true, attributeFilter: ["class"] });
      }
    } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { hookNav(); observe(); renderIfVisible(); });
  } else { hookNav(); observe(); renderIfVisible(); }
  try { window.addEventListener("hashchange", renderIfVisible); } catch (e) {}
}

/* ================= Q. public API (UI + tests) ================= */
var API = {
  render: render, startSession: startSession, rateCurrent: rateCurrent,
  store: A, createDeck: createDeck, renameDeck: renameDeck, deleteDeck: deleteDeck,
  deckPath: deckPath, childrenOf: childrenOf, descendants: descendants, deckCounts: deckCounts, deckOpts: deckOpts,
  addNote: addNote, editNote: editNote, deleteNote: deleteNote, changeNoteType: changeNoteType,
  resolveFields: resolveFields, applyTemplate: applyTemplate, cardSides: cardSides,
  seedFromContent: seedFromContent, buildQueue: buildQueue, bucketOf: bucketOf, cardDue: cardDue,
  gradeCard: gradeCard, previewInterval: previewInterval, logGrade: logGrade, undoLast: undoLast,
  parseSearch: parseSearch, searchCards: searchCards, parseCSV: parseCSV, exportCSV: exportCSV, importRows: importRows,
  computeStats: computeStats, checkDB: checkDB,
  validateImageFile: validateImageFile, validateImageURL: validateImageURL, sniffImageKind: sniffImageKind,
  extractMids: extractMids, renderFieldHTML: renderFieldHTML, mediaRefCounts: mediaRefCounts,
  noteHasMedia: noteHasMedia, unusedMedia: unusedMedia, mediaBytes: mediaBytes, pruneMedia: pruneMedia,
  storeMediaAsset: storeMediaAsset, mediaHash: mediaHash,
  importFileAsset: importFileAsset, importURLAsset: importURLAsset,
  view: function () { return V; }
};
try {
  window.AnkiDroid = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
} catch (e) {}
try { boot(); } catch (e) {}
})();








