# Technical Readiness Report — Deutsch Master

- **Date:** 2026-10-11 · **Revision examined:** `25f836e` (+ working-tree fixes in this cycle)
- **Scope:** `client/` runtime (the deployed Pages app), PWA/offline, performance,
  cross-device, accessibility, identity/sync durability.
- **Method:** repository inspection + existing Node suites + headless perf probes.
  No new dependencies installed. No destructive commands run.

## 1. Project identity (release-blocking — RESOLVED as documentation + metadata)

- **Finding:** the deployed artifact is genuinely Deutsch Master. `.github/workflows/deploy.yml`
  uploads `./client`, and `client/index.html` is the Arabic RTL learning platform
  (dashboard, vocab, sentences, grammar, tests, PWA). No marketplace code ships publicly.
- **Contamination found:** YES, but documentation-level, not deployment-level. `README.md`
  and root `package.json` described a "Marketplace" product; `MARKETPLACE.md` describes
  `client/` as a storefront (false — `client/js/` does not even exist). `server/` +
  `shared/` are a real but separate Express/PostgreSQL marketplace backend: preserved
  untouched, unused by the learning app and undeployed.
- **Fix applied (this cycle):** rewrote `README.md` to the verified learning product;
  corrected `package.json` description; added a scope banner to `MARKETPLACE.md`;
  documented the separation (incl. manual repo-separation steps) here and in README.
- **Status:** PASS (deployed product correct; docs corrected; history preserved).

## 2. Runtime reliability — PASS

| Check | Result |
|-------|--------|
| `tools/qa-audit.js` | **89/89 PASS** (was 87 + 2 FAIL — both were brittle regexes testing call sites instead of function bodies; `renderSentences`/`renderVerbs` do use `dmNorm`. Fixed the test, re-verified the app code at `client/script.js:3041,3045,3102,3107`) |
| `tools/test-robustness.js` | 64/64 PASS (corrupt storage, malformed records, quota, RTL/mixed input, timer guards) |
| `tools/test-assess.js` | 68/68 PASS (assessment engine, thresholds) |
| `tools/qa-simulator.js` | 17/17 PASS, zero console errors |
| `tools/test-nav-func.js` | 10/10 PASS · `test-merge-fix` 44/44 · `test-progress` 35/35 · `test-search` 25/25 · `test-quiz-shuffle` PASS |
| `tools/test-tc-selection-freeze.js` | 11/11 PASS — max long-task **91 ms** across full selection run; no DOM accumulation (Δ=33 nodes); 3× repeated generation clean |

## 3. Identity/sync durability — FAIL found and FIXED (this cycle)

- **Defect:** `DMIdentity.snapshot()` and `loadIdentitySnapshot()` used the coalesced
  `save()` (250 ms deferred writes). Across fast guest→account→logout transitions,
  account snapshots could be missing/stale. Reproduced: `test-account-isolation.js`
  failed `T04-account-key-default` and crashed at line 199 (`JSON.parse(null)`).
- **Fix:** both paths now use synchronous `saveNow()` with `save()` fallback
  (`client/script.js`, identity section). High-frequency UI saves keep the coalescing
  optimization; only identity transitions bypass it. Rationale documented in code.
- **Re-verified:** `test-account-isolation.js` **PASS (32/32)** — guest clean-start,
  byte-identical guest restore, per-account snapshots, queue ownership, reload paths.
  `www/` regenerated via `npm run www` (verified byte-identical `script.js`).
- **Status:** PASS.

## 4. Performance — PARTIAL (measured, one backlog item)

Headless probe (`tools/perf-baseline.js`, this cycle): cold boot ~12.3 s wall in
instrumented headless (88 JS files, heap 134 MB); per-page nav 1.4–1.6 s except
**sentences first render ~4.2 s** with one ~2.7 s long task over the 150k bank.
Mitigations already in place and verified: paginated renderers (80/page sentences,
60/page verbs), debounced search, incremental normalized rows, memoized banks,
dataset-version-aware rendering, and the Kapitel-selection freeze fix (≤91 ms).
**Remaining bottleneck:** sentences-bank first-filter indexing — recorded as backlog,
not a release blocker (selection interactions stay responsive; no freeze).
Mobile/real-device timings: NOT TESTED (no device lab) — do not quote these numbers
as device performance.

## 5. Cross-device / PWA — PARTIAL

- Verified: responsive layouts via headless viewports in existing suites, RTL layout,
  service-worker versioning (`sw.js` `german-academy-v52`, cache-bump + `?v=SHA`
  injection via `tools/inject-version.js`), offline fallback (`test-sw-update` PASS),
  Capacitor config (`www` webDir) + Android manifest, Electron shell loads `client/index.html`.
- NOT TESTED: real-device PWA install/update flow, iOS behavior, real Android APK run
  (marked BLOCKED in `tests/test-cases.json`). No promises made beyond evidence.

## 6. Accessibility — PARTIAL

- Verified: `check-translations.js` PASS (836-key parity AR/EN/DE, RTL/LTR wiring,
  persistence); semantic headings/panels in inspected renderers; focus-visible styles
  asserted in robustness suite (R46); German umlauts + Arabic script render from UTF-8
  banks; no `eval`, no unsanitized URL navigation found.
- Sampling only: 461 `innerHTML` sites use per-module `esc()/escapeHtml()` (spot-checked
  `renderSentences`, stories, listening); full-site manual screen-reader/keyboard audit
  NOT performed — listed for human verification.

## 7. Security & privacy — PASS with noted boundaries

- No secrets in tree: `server/.env` is untracked (gitignored) and was never read or
  committed; only comments mentioning `service_role`/`sb_secret` as prohibitions exist.
- `client/supabase-config.js` ships the **publishable** key only — public by design;
  RLS in `supabase/migration.sql` restricts every table to `auth.uid() = user_id`
  (own rows only), grants limited to anon/authenticated roles. No service-role key anywhere.
- Guest→account isolation proven by test (32 checks); sign-out restores guest
  byte-identically; sync queue is owner-bound with retry (`test-sync-queue` PASS 36).
- No legal-compliance claims made. Privacy behavior is documented in README as
  implemented (local-first, RLS, sign-out semantics).

## 8. Repository metadata (manual — `gh` CLI unavailable here)

Apply in GitHub → repository Settings (exact values):
- **Description:** `An Arabic-friendly German-learning platform with vocabulary, grammar, practice tests, flashcards, and learner progress tracking.`
- **Website/Homepage:** `https://mosab1555.github.io/deutsch-master2/`
- **Topics:** `german`, `language-learning`, `arabic`, `pwa`, `education`, `supabase`, `capacitor`
- Do NOT add `cefr`, `goethe`, or certification-related topics (unverified).

## 9. Remaining risks / NOT TESTED

Real-device PWA install, iOS Safari speech, production Supabase RLS live-fire test,
full screen-reader pass, and learner pilot outcomes. None block the static release;
all are tracked in the Educational report and test catalog.

## 10. Addendum 2026-10-12 — release-blocker closure cycle

- **MIST-005 (`goes=none`, intermittent)**: root cause was NOT timing. The test always
  clicked the FIRST mistake card (TEST-004's, kind varies with random questions) while
  the proven word-backed MIST-001 card is last by insertion order. Fix: retry
  last-card-first with bounded per-card destination polling + toast diagnostics
  (`tools/runtime-qa.js`). Verified: `goes=quiz`, 66/66 twice.
- **A11Y-004 (fails on first-question=writing)**: blind `b[0]` click is a no-op for
  `write`-kind questions (they render `#quizWrite`, no `.quiz-opt`). Fix: branch on
  the rendered kind — write fills the input with the live answer key, order answers
  via chips, else first option. Writing path stays tested, never skipped.
- **TC-MISC (13/14, "pre-existing")**: two compounded causes. (1) The test used
  selectors `[data-tc="smart"]`/`[data-tc="mistakes"]` that never existed in any
  revision (real cards are `cat:__smart__`/`cat:mistakes`). (2) A REAL app defect:
  `probeCache` never invalidated on mistake-count changes, so the hub mistakes card
  wrongly lingered or stayed hidden after recording/clearing mistakes. Fix: mistake
  count folded into `probeKey` (`client/testcenter.js`, synced to `www/`); test now
  asserts the documented rule both directions with deterministic setup
  (TC-MISC-SMART / -MIST0 / -MIST1 / -MISC-HUB). Verified 17/17 twice.
- **B2E article-gap coverage**: census yields 0 article fills, leaving `artGap`
  branches untested. Added C2g–C2k probes against the REAL implementation
  (glued-first scan, absent needle, first-match determinism, `at===0` accept,
  options contract). Suite now 39/39 (`tools/test-b2e-answers.js`).
- **Results this cycle**: `runtime-qa` 66/66 ×2, `test-tc-runtime` 17/17 ×2,
  `test-b2e-answers` 39/39, plus `qa-audit` 89/89, `assess` 68/68, `manifest` 20/20,
  `check-testplan` 13/13, `account-isolation` 32/32, `b2c/b2d-answers` 32/33,
  `test-tc-selection-freeze` 11/11.
- **Known FAIL (pre-existing, not mine)**: `test-robustness` R27
  (`www` identical mod `?v=`) fails because the owner's concurrent uncommitted work
  on `client/sent-a1.js` postdates the last `www/` sync. Owner files
  (`client/sent-a1.js`, `tools/test-perf-fix.js`, `tools/test-sentences-perf.js`)
  were preserved untouched and excluded from this commit; recovery is
  `npm run www` after that work lands.
- GitHub description/homepage/topics still require manual update (no `gh` CLI);
  exact values in §8 above.
