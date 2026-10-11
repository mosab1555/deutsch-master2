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
