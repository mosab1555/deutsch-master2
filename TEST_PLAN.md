# Deutsch Master — Comprehensive Test Plan

**Scope:** full end-to-end QA of the Deutsch Master PWA (`client/` source, `www/` generated output, GitHub Pages deployment).
**Method:** analyze → plan → execute → fix → retest → regress → validate → commit → push → verify.
**Catalog:** `tests/test-cases.json` (machine-readable, validated by `tools/check-testplan.js`).
**Traceability:** `tests/traceability-matrix.md`. **Regression set:** `tests/regression-suite.md`. **Data:** `tests/test-data-strategy.md`.

## 1. Architecture under test (from code inspection, not filenames)

- **No framework, no bundler.** Static HTML (`client/index.html`, `client/academy.html`) + ~30 classic scripts sharing one global scope. Routing is `showPage(name)` toggling `section.page` blocks; heavy sections lazy-render on first visit (`DM_LAZY`).
- **State:** single global `S` persisted to `localStorage` key `deutsch_master_v2` (+ legacy v1 migration). No IndexedDB. No backend; GitHub Pages static hosting only.
- **Progress core:** per-feature counters (`totalCorrect/totalAnswered`, `S.review`, `S.srs`, `S.mistakes`, `S.grammar`, `S.placeHistory`) plus the unified event log `S.events` with stable attempt IDs (`client/progress.js`, `DMProgress`). Single scoring choke point: `showFeedback()` (quiz), `bumpReview()` (review), `gramRecord()` (grammar).
- **Content:** tuple datasets (`curr-a*.js`, `curr-b*.js`), sentence banks (`sent-a1.js`, `SENT_FILL` in `play.js`), explanations (`explain.js` g1..g40), reference bank (`reference-data-*.js`), career tracks (`career.js`).
- **PWA:** `sw.js` (network-first HTML/JS/CSS, cache-first media, versioned `DM_CACHE`), `manifest.json`, deploy pipeline `.github/workflows/deploy.yml` runs `tools/inject-version.js` (`?v=SHA` cache-busting) then uploads `./client`.
- **Generated output:** `www/` is a committed copy of `client/` via `npm run www` (`tools/make-www.js`) for Capacitor.

## 2. Requirement classification (from implementation, UI text, tests, history)

| Area | Status |
|---|---|
| Vocabulary/search/filters, sentences, verbs, explanations, reference, flashcards, smart training (20 types), grammar lab, listening/shadowing/dictation, placement/final/daily tests, games, mistakes + SRS + streaks, themes (34), i18n ar/en/de, TTS with fallbacks, push reminders, offline SW, career pathway, weekly report, offline manager | Fully implemented |
| Speaking/conversation scoring | Partially implemented — recognition is browser-dependent; app correctly offers text fallback and makes no phoneme-level claims |
| Cross-device sync, server AI, clinical nursing instruction, official certification | Missing by design (static hosting; content carries honesty labels) — NOT defects |
| Test assertions on raw `<script src="x.js">` | Was inconsistent with deploy versioning — fixed in this cycle (test-side) |

**Assumptions / gaps:** no browser automation available (browser-only checks marked BLOCKED); no real-device lab (PWA install/update on device BLOCKED); exact CEFR mapping of placement is explicitly estimative by design.

## 3. User flows covered

First launch → navigation → vocab search/filter/detail → sentence training → verbs → reference → flashcards → smart training → tutor → grammar lab → listening/speaking → placement → daily/final tests → mistake review → personalized review → settings/reminders → refresh/restart → offline → online recovery → desktop↔mobile. Each catalog case defines entry, preconditions, actions, state/data changes, persistence, success/failure/recovery.

## 4. Test types and ID families

Functional, integration, error-state, edge-case, UI/responsive, accessibility, performance, PWA/cache. Families: NAV VOC SENT GRAM VERB REF CARD TRAIN AI LISTEN SPEAK TEST PROG MIST PWA DATA UI A11Y PERF ERR (see catalog for per-case type).

## 5. Error-state and edge-case strategy

Corrupt/missing/quota storage, malformed records, empty/single-item pools, extreme/RTL/mixed strings, umlaut/ß variants, no-match search, invalid filter combos, rapid/double clicks, timer expiry, nav/refresh mid-exercise, denied mic, missing TTS/SR/Cache APIs, stale assets, version changes. Node-executable cases live in `tools/test-robustness.js`; browser-only ones are marked BLOCKED with reasons.

## 6. Integration points verified

vocab↔flashcards/sentences/grammar/explain (shared `allWords()`/ids), exercises→progress→mistakes→review→SRS, placement→level/path, search↔filters, audio↔content, tutor→stats, SW↔cache↔HTML refs, client↔www↔Pages.

## 7. Entry/exit criteria

- Entry: clean tree at a known commit; baseline suite executed.
- Exit: all automatable suites PASS; new FAILs triaged; regression suite PASS; `www/` synced; diff reviewed; pushed with HEAD == origin/main; live site spot-checked.

## 8. Results of this cycle

- **Baseline:** 3 suites failing (5 checks) — all test-harness brittleness vs `?v=` versioning, zero app bugs. Plus 1 stale tool (`check-ref-stage2.js`, self-described temp file) crashing unconditionally against the current reference architecture — removed; its assertions are covered by `check-reference.js`/`check-ref-dom.js`.
- **Fixes:** `tools/test-labsx.js`, `tools/test-push.js`, `tools/qa-audit.js` made version-tolerant.
- **New coverage:** `tools/test-robustness.js` (33 checks), `tests/test-cases.json` (118 cases: 78 PASS executed, 40 BLOCKED browser/device-only), `tools/check-testplan.js` (13 checks).
- **Final:** every Node-runnable suite PASS. Browser/device-only items honestly BLOCKED (see §9).

## 9. Honestly BLOCKED (environment limits, not skipped work)

No browser automation (Playwright/Puppeteer unavailable), no real phones/tablets, no installed-PWA device testing, no microphone/speech engine. Affected: manual UI/responsive/a11y/speaking/PWA-device cases — all marked BLOCKED in the catalog with exact reasons. Nothing is marked PASS without execution.
