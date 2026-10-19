# C4 Implementation Report — Privacy/Terms Accuracy, Consent Groundwork, Deletion Readiness

**Date:** 2026-10-18 · **Branch:** `main` · **HEAD:** `225117550f0c1bc5fbb08c8936ea4e0428c3434e` (unchanged) · **Status:** implemented, tested, NOT committed / NOT deployed / NOT applied anywhere remote.

## 1. Scope delivered

| # | Deliverable | State |
|---|---|---|
| A | `privacy.html` / `terms.html` accuracy fixes (no overclaims, explicit open items) | Done, client+www byte-identical |
| B | Consent machinery: disabled-by-default client module + additive staging-only migration + rollback | Done; recording OFF (no `DM_CONSENT_CONFIG` anywhere) |
| C | Account-deletion: local (undeployed) Edge Function + blocker doc update | Prepared only; deletion stays BLOCKED |
| D | Egypt data-processing notice draft (internal, cited) | Done: `docs/academy/DATA_PROCESSING_NOTICE_EGYPT.md` |
| E | Regression suite + npm test wiring | Done: `tools/test-c4-privacy-consent.js` (150 checks), wired into `npm test` |

## 2. Artifacts

- `client/privacy.html` + `www/privacy.html` — deletion section now says the truth (local wipe works; in-app cloud deletion "غير متوفر داخل التطبيق حاليًا"; CASCADE/anonymization stated for when it ships); young-learners section states no in-app age verification/consent; open-items bullet added for student consent/age verification. Removed the stale "accounts run with anonymous ids" phrasing.
- `client/terms.html` + `www/terms.html` — academy described as an isolated test-environment preview with accurate feature availability; account-deletion limitation stated; consent/age open-items bullet added.
- `client/dm-consent.js` + `www/dm-consent.js` — inert-by-default module (`window.DMConsent`): `getStatus/isEnabled/record/withdraw/listMine`; writes only `user_id = <live session id>`, `consent_type ∈ {privacy_notice, terms_of_service}`, `decision ∈ {granted, withdrawn}`, optional `age_band ∈ {under_15, age_15_17, age_18_plus, undisclosed}`; no console, no localStorage, no DOM, no academy coupling; user id re-read per call from the live session.
- `client/index.html` / `www/index.html` — loads `dm-consent.js` after `profile.js`, before `app-init.js` (loaded but inert; no enforcement).
- `client/sw.js` / `www/sw.js` — precache `./dm-consent.js`; cache bumped `german-academy-v59 → v60`.
- `supabase/migrations/20261018000000_consent_records.sql` — NEW, additive, STAGING FIRST, NOT APPLIED: `consent_records` table, RLS enabled with own-row SELECT/INSERT policies only, append-only guard trigger (`guard_consent_record_write()`: rejects non-INSERT, forces `user_id = auth.uid()` and `created_at = NOW()` for JWT callers), REVOKE-first grants (SELECT, INSERT to `authenticated` only; no anon). No guardian/parental consent type exists by design.
- `supabase/manual/20261018_consent_records_rollback.sql` — NEW: drops trigger → function → policies → table (IF EXISTS); never touches v1/auth objects.
- `supabase/functions/delete-account/index.ts` — NEW, local only, NOT deployed: JWT-derived identity, body can never carry a user id, typed `"DELETE"` confirmation, per-caller in-memory rate limit, service key from `Deno.env.get` only, self-only `auth.admin.deleteUser`, per-table receipt + anonymized `auth_events` note, zero logging. Client tree has zero references to it; the `profile.js` placeholder toast is preserved and guarded by tests.
- `tools/test-c4-privacy-consent.js` — NEW suite (P1 legal-page integrity incl. strict UTF-8/no-overclaim checks; P2 consent module behavior incl. disabled matrix, cross-user isolation, sanitization; P3 migration/rollback static safety; P4 delete-account static safety; P5 integration surface).
- `package.json` — `npm test` chain now ends with `node tools/test-c4-privacy-consent.js`; added `npm run test:c4`.
- `docs/academy/ACCOUNT_DELETION_BLOCKER.md` — dated Update 2026-10-18 appended (existing text preserved): local function status, new `academy_prod_links` ghost-link open question, consent-retention question, status still BLOCKED.
- `docs/academy/DATA_PROCESSING_NOTICE_EGYPT.md` — NEW internal draft with verified citations and gaps list.

## 3. Test evidence (all offline, no network/DB)

- `npm test` → exit 0, all suites PASS: phase0 runner **34 suites / 0 failed**; academy-core **128/0**; academy-rls-static **84/0** (static only; live RLS not executed — no Docker here); academy-deploy-safety **173/0**; academy-preview **80/0**; **C4 suite 150/0**.
- `node tools/check-www-parity.js` → **11/11 PASS** (`client=414`, `www=414`; sw DM_FILES resolve 110).
- New-file parity: `dm-consent.js`, `privacy.html`, `terms.html`, `index.html`, `sw.js` byte-identical client↔www.
- Legal pages: strict-UTF-8 decode OK, 0 replacement chars, 0 `???` runs; Arabic present (privacy 2767 / terms 1819 Arabic chars).

## 4. Preservation evidence

- Baseline snapshot taken before any edit: `C:\Users\mosab\AppData\Local\Temp\opencode\c4-before\` (826 file hashes + head/status/stashes/worktrees).
- After-hash comparison: **818/826 byte-identical; 0 missing**; the only 8 changed files are exactly the intended C4 edits (privacy/terms/index/sw × client+www). **All C3 work untouched** (app-init/cloud-sync/reference and their http(s) archives).
- `HEAD` unchanged (`225117550…`), stash list unchanged (2), worktree list unchanged (6).
- `git status` delta vs baseline: 9 intended `M` files (incl. `package.json`) + 5 new `??` paths (`client/dm-consent.js`, `www/dm-consent.js`, the migration, the rollback, the C4 test); the delete-account function lands inside the already-untracked `supabase/functions/` tree.
- No commits, no pushes, no deploys, no migration applied, no remote Supabase object touched, no key material introduced anywhere.

## 5. Explicitly NOT done (by design)

- Consent recording is NOT enabled; no sign-in/sign-up/learning flow is gated; there is no UI for it yet.
- Guardian consent remains an academy-side written process (owner+legal); no client path can produce a "verified guardian" record.
- Account deletion is NOT available to users; the placeholder toast is unchanged; nothing was deployed.
- Legal text was corrected for honesty but NOT "legalized": entity name, contact channel, retention, transfer assessment, PDPC registration, and children's-data decisions remain open (see the notice doc).

## 6. Remaining blockers (unchanged priority order)

1. Owner+legal: approve policy text/version and the consent recording mechanism (`DM_CONSENT_CONFIG` stays absent until then).
2. Staging Supabase project + authenticated deploy to apply `20261018000000_consent_records.sql` and validate `delete-account` (two-user E2E per blocker §3.4) — only then can deletion be described as available.
3. Decide the `academy_prod_links` ghost-link handling BEFORE any production deletion deploy.
4. Decide consent-retention semantics after account deletion (CASCADE today).
5. Egypt compliance track items in `DATA_PROCESSING_NOTICE_EGYPT.md` §4.

## 7. Recommended next steps

1. Owner/legal review of the two Arabic legal pages' open-items wording and of `DATA_PROCESSING_NOTICE_EGYPT.md`.
2. Stand up staging; apply consent migration there; run the blocker §3.4 deletion E2E; record evidence.
3. Only after both: enable consent writing (with an approved `policy_version`) and wire the delete-account client flow, updating privacy/terms simultaneously.

## 8. Independent audit addendum (same day, post-report verification)

The claims in this report were independently re-verified against the working tree; corrections applied:

- **Reproduced:** 818/826 snapshot files byte-identical (0 missing; exactly the 8 intended client/www edits); C4 suite 150/150 before corrections; parity 11/11 (`client=414`, `www=414`, sw DM_FILES 110); academy-core 128/0; academy-rls-static 84/0 (static, live RLS not executed); academy-deploy-safety 173/0; academy-preview 80/0; account-isolation PASS (42); ref-identity 48/0.
- **Fixed — index.html/www indentation:** the three inserted `<script>` lines in §2 lacked the file's 4-space indentation; restored in `client/index.html` and `www/index.html` (no functional change).
- **Fixed — rollback data-loss documentation:** `supabase/manual/20261018_consent_records_rollback.sql` now carries an explicit DATA-LOSS WARNING (DROP TABLE destroys all consent rows; export with `COPY ... TO STDOUT` first) instead of implying no learner data is affected; the migration header references the warning.
- **Fixed — delete-account CORS:** Supabase Edge Functions do NOT add CORS automatically for user-written functions (Supabase docs, Functions > CORS), so the undeployed function would have failed browser preflight on the documented `functions.invoke` wiring. Added explicit OPTIONS handling (204, before auth), wildcard-origin headers on every JSON response and an allow-list matching supabase-js (`authorization, x-client-info, apikey, content-type`). Wildcard is safe here: bearer-token auth, no cookies, self-only effect; preflight carries no data. Still requires staging verification before client wiring.
- **Fixed — Egypt notice citations:** corrected the cross-border citation from "PDPL Art. 22" (which is actually the PDPC Board-meetings article) to Chapter Seven, Arts. 14–16; corrected "Prime Minister Decree 816/2025" to the Arabic Gazette's "Minister of Communications and Information Technology Decree No. 816 of 2025" (noting the common mis-description); added verified source links (NATLEX English translation, Arabic Gazette reproduction, Chambers 2026, CMS, Access Partnership, Kennedys) and the PDPC guidance on Arabic, separable, withdrawable consent.
- **Tests strengthened:** `tools/test-c4-privacy-consent.js` grew from 150 to 173 checks with meaningful negatives: user object without id; withdraw/listMine without session; non-object config; delayed-write identity capture across an account switch; per-session re-query without cached records; unknown type on listMine; rollback destruction documentation; no UPDATE/DELETE grant; no anon/service_role table grant; trigger EXECUTE revocation; non-POST 405; CORS preflight ordering; all body reads limited to `confirm`; unauthenticated-before-deletion ordering; secrets fail-closed; no response echo of the service key; no raw `.message` echo; dm-consent referenced exactly by index.html only. Result after corrections: **173/173 PASS**.
 - **Left unchanged (reported, not silently altered):** the pre-existing `delete_account` confirm-dialog wording in `study.js`/`profile.js` still says deletion is about to happen before the honest "requires setup" toast — flagged for owner UI copy decision; the in-memory rate limiter remains best-effort per isolate (documented, not a durable limiter); live RLS/pgTAP and the deletion E2E remain unexecuted locally (no Docker/staging).

## 9. Continuation addendum 2026-10-18 (validation prep — still no remote action)

- **New live suite prepared (not yet run):** `supabase/tests/consent_records_rls_test.sql` — 31 pgTAP assertions for consent RLS (schema/grants/policies, anon denial, own-row vs cross-user, forged `user_id`, server timestamp, UPDATE/DELETE denial, constraints, append-only history, session switch, NULL-subject fail-closed). Not executed: no Docker/psql locally and no authorization for a remote run in this session. Exact operator commands are in `docs/academy/STAGING_VALIDATION_RUNBOOK.md` §5.
- **Test suite strengthened again:** `tools/test-c4-privacy-consent.js` now has a P6 group (19 static checks) guarding the pgTAP file (isolated-only, single transaction + ROLLBACK, `plan(N)==counted` = 31, required scenarios present, no destructive SQL/secrets/refs). Suite total is now **194/194 PASS** — this supersedes the "173/173" figure above for the current tree.
- **New operator docs:** `docs/academy/STAGING_VALIDATION_RUNBOOK.md` (staged validation procedure for consent RLS, deletion E2E, optional client integration; includes rollback caveats) and `docs/academy/OWNER_DECISION_REGISTER.md` (D1–D7 owner/legal decisions).
- **Unchanged safety state:** no commits/pushes/deploys, no migration applied, no remote object touched, consent still disabled by default, placeholder toast intact, `academy_prod_links` ghost-link and consent-retention questions still open (now tracked as D5/D3).
