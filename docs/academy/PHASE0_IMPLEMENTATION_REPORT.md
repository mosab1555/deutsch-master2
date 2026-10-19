# Phase 0 Implementation Report — Reliability and Product-Truth Hardening

**Date:** 2026-10-15 (UTC) · **Repo:** `C:\Users\mosab\Desktop\deutsch-master2` · **Branch:** `main`
**Base HEAD:** `3d26062` (verified intact at start and end) · **`origin/main`:** `7dbd6fc` (verified; local `main` still ahead by the 2 pre-existing commits `8dda233`, `3d26062`)
**Basis:** `docs/academy/PLATFORM_READINESS_AUDIT.md` (read, never modified)
**Discipline:** no `git reset/clean/stash`, no staging/commits/pushes/deploys, no content-bank regeneration, no Supabase/production changes, no secret exposure. All 65 pre-existing untracked files preserved (verified by count before/after).

## 1. Changes made and files affected

**Modified (12 tracked files, all reviewed):**
- `package.json` — added `test` / `test:phase0` (`node tools/run-phase0-tests.js`) and `test:parity` (`node tools/check-www-parity.js`). No dependencies added/changed.
- `client/sw.js` (+ mirrored `www/sw.js`) — cache `german-academy-v57 → v58`; added missing precache entries for sync-loaded `sentx-a2/b1/b2.js` (R28 gap: they are page-blocking scripts but were absent offline) and for new `privacy.html`/`terms.html`.
- `client/study.js` (+ mirrored `www/study.js`) — 9 new `acad_*` interface keys × AR/EN/DE (parity verified 848/848/848). No learning logic touched.
- `client/academy.html` (+ mirrored `www/academy.html`) — honest title/meta; academy-status notice on the dashboard (admin-not-implemented statement, unavailable-items list, pilot-scope `<details>`, working links to learner app + privacy); dashboard eyebrow key swapped to the honest `acad_eyebrow`; privacy link in settings. Shell, nav, sections, scripts all byte-identical otherwise.
- `client/index.html` (+ mirrored `www/index.html`) — one line: privacy link in settings data panel.
- `tools/test-upgrade.js`, `tools/test-flashdir.js`, `tools/e2e.js` — harness-fidelity repairs only (see §2); zero assertion relaxations.

**Created (new deliverables, uncommitted per tasking):**
- `.github/workflows/ci.yml` — Phase 0 regression on PR + `main` push (Node 20, stdlib-only, no install).
- `tools/run-phase0-tests.js` — explicit-list orchestrator (33 suites; rerun-once-and-log for the two statistical flakes).
- `tools/check-www-parity.js` — read-only recursive client/www parity (lists, bytes mod `?v=`, manifests, 140 lazy PACKS, 101→106 SW refs).
- `tools/build-a1-review-packet.js` — deterministic one-time packet generator (seed `20261015`).
- `client/privacy.html`, `client/terms.html` (+ mirrored `www/` copies) — Arabic RTL privacy/terms from verified behavior.
- `docs/academy/A1_PILOT_REVIEW_PACKET.csv` — exactly 200 A1 records, reviewer columns empty, zero approval language.
- `docs/academy/ACCOUNT_DELETION_BLOCKER.md` — explicit evidence-based blocker report.
- This file.

## 2. Tests actually executed and their results

**Full `npm test` (local, Node v24.19.0): 33/33 suites PASS, exit 0** — final run after all changes (log tail archived in session; per-suite RESULT lines all PASS). Coverage includes the 9 required areas: content-remediation (12/12), content-quality-gate (`errors=0`, **1913 warnings preserved, no `--strict`**), assess (68/68), content-merge (SMOKE OK), manifest (20/20), lazy-packs (21/21), full-load (18/18, 104,640 vocab + 150,000 sentences), sent-refs (500-sample, 0 structural errors, report redirected to OS temp — nothing written to the repo), www-parity (11/11, 410 files each tree).

**Pre-existing failures found and repaired (all proven pre-existing at `origin/main`, none caused by Phase 0):**
1. `test-upgrade` crashed (`dmWords is not defined`): stub predates the `dmWords()` cache refactor (present at `7dbd6fc`, test file identical since). Fixed by adding the faithful `dmWords` stub; follow-on U4/U5 needed the faithful `t` stub (`srsWhy` renders via `window.t`). Now 20/20.
2. `test-robustness` R28 (SW missing `sentx-a2/b1/b2.js`): missing at origin too. Fixed in `sw.js` + v58 bump (genuine offline fix, not test-tampering). Now 64/64.
3. `test-flashdir` behavioral + `e2e` console-clean: harnesses boot `script.js` with `document.readyState === undefined`, so boot renders run mid-parse before `study.js` defines `t()` — impossible in a real browser (readyState is `"loading"`; the app comment at `script.js:4523-4525` documents the assumption). Fixed by setting `readyState:"loading"` + firing `DOMContentLoaded` after full load (e2e), plus faithful `t/wordMeaning/wordExMeaning` stubs from the real ar dict, `options:[]` on stub selects, and a stub German voice (production `speakWithWeb` requires one since commit `74c39a1`; the harness predates it). Now 100/100 and 51/51.
4. Statistical flakes (handled, not hidden): `e2e chall positions` chi-square flaked once (20.4) then passed on rerun; `test-smart` has the documented ~1/6 adaptive tail (passed first try this run). Both carry a rerun-exactly-once-and-log rule in the orchestrator.

**Not executed:** Chrome-gated suites (`--cdp`, `test-auth-dom`, `runtime-qa`, `test-pack-cache`, DOM Chrome harnesses) — no browser in this environment; remote GitHub Actions runs are **not claimed** (workflow created but never fired: no push allowed).

## 3. CI workflow coverage and limitations

`ci.yml` runs `npm test` (the 33-suite orchestrator) on pull requests and `main` pushes, Node 20, `contents: read`, 30-min timeout. Deterministic: fixed seed packet logic is one-time (not in CI); all CI suites are stdlib-only, no network, no writes to content/assets/audit files. **Limitations:** (a) remote run never executed — status unknown until the owner pushes; local Node was v24.19.0 vs CI Node 20 (syntax used is long-stable, risk low but unproven); (b) Chrome-gated suites remain manual gates per `tests/regression-suite.md`; (c) CI cannot catch linguistic quality (by design — see audit §8).

## 4. Current B2 and exam-readiness limitations (unchanged by Phase 0, now disclosed in-product)

- B2 library banks remain 0 for sentences/grammar/exercises/dialogues/reading/listening/exams (B2 vocab 1,692 only); B2 content is CURR overlays. The 7 bank gaps block advertising B2 as complete — the academy notice states "B2 introductory only".
- The 10,000 `lx*` exam rows remain question-less shells (`hasQ=false`, 0 consumers outside `dm-lazy.js`); runtime exams are assembled live from pools behind level gates with the "internal, not Goethe" disclaimer (`client/assess.js:2780-2784`). Verified, not altered: no UI ever claimed "10,000 exams" (grep clean), so no entry point needed disabling; the academy notice + terms state the internal-exam status explicitly.
- All 150,000 sentences remain `unreviewed / approved: 0` (`review-status.json` untouched); the packet adds no approvals.

## 5. Privacy, terms, and account-deletion status

- `client/privacy.html` + `client/terms.html`: Arabic, RTL, responsive (existing CSS), linked from settings in both entries + academy notice + each other. Content derived from verified flows only (localStorage keys, single-JSONB sync with caps 500/1200/100, own-row RLS, provider-gated OAuth/OTP, jsDelivr/Wiktionary/Tatoeba/Commons roles, no ads/analytics SDKs, SW never caches user rows, merge-deletion limitation, guest/account separation). No invented contacts, retention schedules, certifications, or governing law — open items are listed in-page as `[owner/legal TODO]`.
- Account deletion: **BLOCKED, documented in `docs/academy/ACCOUNT_DELETION_BLOCKER.md`.** Deleting `auth.users` needs `service_role`, which must never enter browser code (verified absent); no Edge Functions exist; RLS cannot delete from `auth` schema. FK evidence: CASCADE cleans profiles/progress/queue/devices, `auth_events` anonymizes (SET NULL). The placeholder toast is preserved (honest, deletes nothing); no fake local-only "delete" was added. Unblock path (staging project → `delete-account` Edge Function with JWT-bound self-delete + receipt → client wiring → two-account + guest staging E2E) is specified with acceptance steps.

## 6. Items requiring teacher, owner, or legal review

- **Teacher (qualified, named):** review all 200 packet rows (decision/name/date per row); ≥90% OK per batch before any "approved" claim; Arabic pedagogy + level-ceiling sign-off per K1–K5 slice. Packet explicitly diverges from `audit/pilot-corpus-spec.md` (3,000 rows) as a bounded step-1 subset — teacher confirms sufficiency.
- **Owner:** provision staging Supabase; approve Edge Function design; set OAuth/SMS providers; define privacy contact, retention schedule, governing law, refund policy (before any payment); decide custom domain/`CNAME`; run the first remote CI (push) and record results; run Chrome-gated suites (`--cdp`, `runtime-qa`) + real-device checks.
- **Legal:** review privacy/terms open-items placeholders; pilot guardian-consent forms; data-processing terms for any academy handling minor data.

## 7. Remaining P0/P1 blockers to a supervised A1 pilot

1. Teacher review of the 200-row packet incomplete (0/200 reviewed) — pilot scope cannot be called approved.
2. Account deletion blocked (staging + Edge Function outstanding).
3. Privacy/terms legal sign-off outstanding (placeholders).
4. Remote CI never run; Chrome-gated suites not re-run post-Phase-0; no real-device pass (TTS/mic/PWA-install).
5. `review-status.json` still 0 approved (correct — must stay so until teacher sign-off).
6. Academy MVP (roles/classes/enrollment/reports/payments/certs) not started — pilot remains single-cohort, supervised, TOS-limited by design.

## 8. Locally verified vs not tested

**Verified locally:** all 33 node suites green on the final tree; parity 410/410 files + 140 PACKS + 106 SW refs; packet exactly 200 with empty reviewer fields; `git` state clean (see below); `npm run www` side-effect review (12 mirrored files + 4 new mirror copies, backups untouched).
**NOT tested:** remote Actions runs, Chrome-gated suites, production Pages behavior, real devices (Android WebView/iOS Safari), native builds, Supabase staging round-trips, screen-reader audit. Nothing in this report claims them.

---

## Close-out

**Verified Git state (end):** HEAD `3d26062` intact; `8dda233` intact; `origin/main` `7dbd6fc` unchanged relationship; 12 tracked files modified (all Phase-0 scoped, listed in §1); untracked = 65 pre-existing + audit report + 8 Phase-0 files (ci.yml, orchestrator, parity checker, packet builder, packet CSV, blocker doc, privacy/terms ×2 client + ×2 www-mirror, this report) — no work lost, no content banks rewritten, no commits/pushes/deploys.

**Readiness decision: READY WITH BLOCKERS.**

Phase 0 objectives are met (dependable `npm test` + CI definition, honest academy entry, truthful level/exam presentation, real privacy/terms, bounded review packet, parity automation, 4 pre-existing failures repaired with evidence). The platform is **not** academy-pilot-ready: teacher review (0/200), account-deletion backend, legal sign-off, remote CI + Chrome/device validation, and any academy-dashboard build remain outstanding per §7. Next recommended step: owner unblocks staging + teacher review in parallel; engineering holds on new features until the packet returns signed.
