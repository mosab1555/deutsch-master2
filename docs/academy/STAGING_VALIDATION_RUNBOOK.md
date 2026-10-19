# Staging Validation Runbook — Consent (C4-A), Account Deletion (C4-B), Client/Server Integration (C4-C)

**Date:** 2026-10-18 (UTC+2) · **Repo:** `C:\Users\mosab\Desktop\deutsch-master2` · **Branch:** `main` · **HEAD:** `225117550f0c1bc5fbb08c8936ea4e0428c3434e`
**Status:** PREPARED — NOT EXECUTED. Nothing in this runbook has been run against any remote project.
Everything below requires explicit owner authorization before the first command. This session (2026-10-18) performed local-only work: static suites, the new consent pgTAP suite, and this runbook.

---

## 0. Purpose

Single operator procedure that turns the remaining C4 blockers into verifiable evidence:

1. **A — Consent RLS live proof:** run the pgTAP suites on staging.
2. **B — Deletion live proof:** deploy `delete-account` to staging and run the two-user end-to-end deletion test.
3. **C — Client/server integration:** optional, staging-pointed consent client test (only after owner decision D1 in `OWNER_DECISION_REGISTER.md`).

## 1. Non-negotiable safety rules

- **Staging project only:** `uafwvkgaijmcofistjum` (fixed order of these 20 chars; cross-check every command).
- **Production project is forbidden:** `bhdgpscedjowchldsjnd` — never pass it to any command, never open its dashboard during this runbook.
- **Before every remote command:** confirm the target. The repo is linked via `supabase/.temp/project-ref` → verify it reads `uafwvkgaijmcofistjum`. If it does not, STOP.
- Never run `supabase db reset` (destroys the whole database), never `--include-all` without reviewing `supabase migration list` first, never edit data in `auth.users` by hand except the documented test users A+B, never print or commit any key.
- Any output containing the production ref or a production URL → STOP the run, capture the output, and report.

## 2. Preconditions (all must be true before starting)

| # | Precondition | How to verify |
|---|--------------|---------------|
| 1 | Owner authorization for a staging session (date, operator, scope) | written approval, filed in `docs/audit/` |
| 2 | Supabase CLI ≥ 2.115.0 logged in with access to staging | `supabase --version`; `supabase projects list` shows staging only in scope |
| 3 | Repo linked to staging | `Get-Content supabase\.temp\project-ref` → `uafwvkgaijmcofistjum` |
| 4 | No pending unauthorized local changes | `git status --short` reviewed; expected C4 files only |
| 5 | Owner decisions on retention/ghost links are NOT required for staging (staging data is disposable) but ARE required before any production step | `OWNER_DECISION_REGISTER.md` D1–D7 |
| 6 | `pgtap` extension present in staging (historically yes — pgTAP output exists in `tap_out_run1.txt`) | Phase A check below; if missing, enable via Dashboard → Database → Extensions as `postgres`, **before** the consent migration, then re-check |
| 7 | Node v24.19.0 for the offline suites | `node --version` |
| 8 | Docker is NOT required if using `--use-api` for function deploy; `supabase test db --linked` needs network + login only | — |

## 3. Phase A — read-only preflight (staging)

```powershell
# A1 target identity — MUST print: Linked project: uafwvkgaijmcofistjum
supabase projects list
Get-Content supabase\.temp\project-ref

# A2 migration state (read-only) — record output verbatim as evidence
supabase migration list --linked
```

Expected: baseline + academy migrations from `20261014000000` through `20261017000000` already applied (staging hosted the Phase-0/academy work); `20261018000000_consent_records` NOT applied yet.

```sql
-- A3 extensions (staging SQL editor, read-only)
SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp','pgcrypto','pgtap');
-- A4 confirm no consent table yet
SELECT to_regclass('public.consent_records');  -- expect NULL before Phase B
```

If A3 lacks `pgtap`: enable it now (Dashboard → Extensions) and re-run A3. Do not proceed with pgTAP phases otherwise.

## 4. Phase B — apply the consent migration (staging only)

**Order is fixed** (later migrations depend on earlier ones; if `supabase migration list` shows any of 20261014000000…20261017000000 as pending, they run first in this exact order):

1. `20261014000000_baseline.sql` (ONE-TIME fresh-project baseline; already applied in staging — never re-run)
2. `20261015000000_academy_core.sql`
3. `20261016000000_acl_hardening_repair.sql`
4. `20261016000001_academy_member_null_hardening.sql`
5. `20261017000000_academy_progress_link.sql`
6. `20261018000000_consent_records.sql` ← the only expected pending item

```powershell
# B1 review what db push WOULD apply, then push the pending consent migration
supabase migration list --linked
supabase db push --linked
```

`supabase db push` never touches production while the repo is linked to staging (A1/A4 re-verified immediately before). Never add `--include-all`.
If `db push` is refused or unavailable, apply the single pending file in the staging SQL editor as `postgres`: whole file, one run.

```sql
-- B2 post-apply verification (staging SQL editor, read-only)
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.consent_records'::regclass;             -- t
SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='consent_records';    -- 2
SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='consent_records'; -- 7
```

## 5. Phase C — pgTAP live suites (the core C4-A evidence)

Canonical files (use ONLY these two):

- `supabase/tests/academy_core_rls_test.sql` → expect **52/52 PASS** (plan 52)
- `supabase/tests/consent_records_rls_test.sql` → expect **31/31 PASS** (plan 31, added 2026-10-18)

**Never use** `supabase/tests/academy_core_rls_diagnostic.sql` — it is a stale pre-hardening copy (plan 45, wrong expectations). It is kept only as historical evidence.

```powershell
# C1 run against the linked staging project (each file runs fully inside one
# transaction and ROLLBACKs; no fixture survives)
supabase test db supabase/tests/academy_core_rls_test.sql --linked
supabase test db supabase/tests/consent_records_rls_test.sql --linked

# C2 fallback if `test db --linked` is unavailable in this CLI build:
# paste each file, whole and in one run, into the staging SQL editor as `postgres`.
# The file's outer BEGIN/ROLLBACK makes this equivalent evidence.
```

```sql
-- C3 post-run reality check (read-only) — ALL must return 0
SELECT count(*) FROM public.consent_records;
SELECT count(*) FROM auth.users WHERE email LIKE '%@fixture.invalid';
```

Stop conditions: any FAIL line, or any fixture row remaining after C3 → STOP, capture the exact output, do not patch live.

## 6. Phase D — deploy `delete-account` to staging

Preconditions: Phase C green; `SUPABASE_SERVICE_ROLE_KEY` for **staging** available to the operator (from staging Dashboard → Project Settings → API).

```powershell
# D1 set the staging function secret (value never echoed to logs; do not paste into any doc)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<STAGING_SERVICE_ROLE_KEY> --project-ref uafwvkgaijmcofistjum

# D2 deploy (bundles without Docker)
supabase functions deploy delete-account --project-ref uafwvkgaijmcofistjum --use-api
```

Do NOT pass `--no-verify-jwt`: the gateway JWT check stays on (the handler also re-verifies the caller itself — defense in depth). Record the deployed version id as evidence.

## 7. Phase E — two-user deletion E2E (staging)

Create disposable staging users **A** and **B** (Dashboard → Authentication → Add user, email+password, auto-confirm) — clearly named e.g. `dm-e2e-a@<operator>.test`. These are real staging auth users (the pgTAP fixtures cannot be used here because deletion is an admin/auth operation).

Preparation per user: sign in on the staging-pointed client or via API to obtain an access token; create ≥1 row in `user_progress`, `sync_queue`, `devices` (normal app usage while signed in), and confirm the `profiles` row exists.

```powershell
# E1 capture pre-state as postgres (staging SQL editor): counts for A and B rows + auth_events
SELECT (SELECT count(*) FROM public.profiles WHERE id='<A_ID>')  AS a_profiles,
       (SELECT count(*) FROM public.user_progress WHERE user_id='<A_ID>') AS a_progress,
       (SELECT count(*) FROM public.sync_queue WHERE user_id='<A_ID>')    AS a_sync,
       (SELECT count(*) FROM public.devices WHERE user_id='<A_ID>')       AS a_devices;
SELECT count(*) FROM public.auth_events WHERE user_id='<A_ID>';  -- note value

# E2 positive path — delete A with A's token
curl -X POST "https://uafwvkgaijmcofistjum.supabase.co/functions/v1/delete-account" ^
  -H "Authorization: Bearer <A_ACCESS_TOKEN>" -H "Content-Type: application/json" ^
  -d "{\"confirm\":\"DELETE\"}"
```

Expected receipt (fields exactly as implemented): `profiles`, `user_progress`, `sync_queue`, `devices` counts ≥ 1, `auth_events_anonymized` count, and `retained_note` explaining anonymized audit rows remain.

Negative cases (each must fail safely, then positive path retested):

| Case | Expected |
|------|----------|
| missing/invalid token | 401 `unauthenticated`, nothing deleted |
| `confirm` missing or ≠ `"DELETE"` | 400 `confirmation required`, nothing deleted |
| GET/PUT | 405, nothing deleted |
| OPTIONS preflight | 204 + CORS headers |
| body > 1 KB | 413 |
| 4th attempt within 15 min | 429 (rate limiter is in-memory, per isolate, best-effort — not a production guarantee) |

Verification after E2 (staging SQL editor):

```sql
-- E3 ALL rows for A gone (CASCADE), auth_events for A anonymized (user_id NULL),
-- B's rows unchanged vs E1 capture
SELECT ... counts for A (profiles/user_progress/sync_queue/devices) = 0;
SELECT count(*) FROM public.auth_events WHERE user_id='<A_ID>';                 -- 0 (was N)
SELECT count(*) FROM public.auth_events WHERE user_id IS NULL;                  -- increased by ≥ N
-- rerun E1 query for B; compare byte-identical with capture
```

Also verify from the device: user A's local per-uid keys/snapshot cleared (only when client wiring exists — not yet), user B stays signed in, guest snapshot untouched.

Double-delete: repeat E2 with A's old token → clean not-found/401 response, **no false success**.

## 8. Phase F — consent client/server integration (OPTIONAL, staging-pointed only)

**HARD RULE:** never set `window.DM_CONSENT_CONFIG` on any page that talks to production (`bhdgpscedjowchldsjnd`), including the live Pages deployment. Enabling consent in that context would attempt writes against production and must be treated as a production change.

Preconditions: owner decision D1 (approved wording + `policy_version` string) and D2 (age/parental model) in `OWNER_DECISION_REGISTER.md`.

Procedure:

1. Serve a local copy of `client/` (e.g. `npx serve client`) whose Supabase config points at **staging**, or use a staging-only preview config that is never committed.
2. Set `window.DM_CONSENT_CONFIG = { enabled: true, policyVersion: "<owner-approved>" }` via devtools on that staging-pointed page only.
3. Sign in as a staging test user (not A/B — use fresh user C) → `DMConsent.record('privacy_notice')` → verify the row appears in staging `consent_records` with `user_id = C`; `DMConsent.withdraw('terms_of_service')` → new `withdrawn` row; `DMConsent.listMine()` returns own rows only.
4. Verify in SQL that C sees only C rows (RLS) and that UPDATE/DELETE are impossible (already covered by the pgTAP suite; this is client-path confirmation only).
5. Cleanup: delete user C via dashboard; confirm CASCADE removed C's consent rows; remove the staging-only config.

If D1/D2 are not decided: SKIP this phase. The consent feature must stay disabled (module is inert by default; `client/privacy.html` already states consent is an open item).

## 9. Phase G — evidence, cleanup, exit criteria

Evidence to capture (save under `docs/audit/`, no keys, no tokens):

- A1/A2 outputs, B1 output, B2 verification rows
- C1 full TAP output for both suites (52/52, 31/31) + C3 zero-fixture check
- D1/D2 output (version id; secret never shown)
- E1/E2/E3: pre-state, receipt JSON, post-state, negative-case responses
- completion date/operator, final `supabase migration list --linked`

Cleanup:

- Delete staging users A/B/C (Dashboard → Auth). Verify no `@<operator>.test` user remains.
- Optionally delete the staging function after acceptance: `supabase functions delete delete-account --project-ref uafwvkgaijmcofistjum`. Keep it only if staging integration continues.
- Confirm `git status` still shows only intended local files; no config or secret was committed.

Exit criteria (all true → C4 staging validation ACCEPTED):

- academy pgTAP 52/52 and consent pgTAP 31/31 on staging
- zero fixture rows remain
- deletion receipt matches pre-state; B untouched; audit rows anonymized; negative cases all fail closed
- (optional) consent client path verified on staging-pointed build with owner-approved policy version

## 10. Rollback procedures

| Item | Rollback | Caveat |
|------|----------|--------|
| Consent table | `supabase/manual/20261018_consent_records_rollback.sql` (run as postgres) | DATA-LOSS: destroys all consent rows; safe no-op if the table never existed |
| Function | `supabase functions delete delete-account --project-ref uafwvkgaijmcofistjum` | none; client never calls it (verified statically) |
| Academy core | `supabase/manual/20261015_academy_core_rollback.sql` | **must first drop `academy_link_codes` / `academy_prod_links`** (FK dependencies) — the shipped rollback does not drop them |
| Test users | delete via Dashboard | cascades clean public rows; anonymized `auth_events` remain by design |

## 11. Known traps / do-not list

- `supabase/tests/academy_core_rls_diagnostic.sql` is stale (plan 45) — never run it as validation.
- Rate limiter in `delete-account` is in-memory best-effort per isolate; do not cite it as a production control (owner decision D4).
- `academy_prod_links.prod_user_id` has no FK — production deletion ghosts these rows; owner decision D5 required before production.
- `consent_records` CASCADE erases consent history on account deletion; retention decision D3 required before production.
- `docs/academy/C4_IMPLEMENTATION_REPORT.md` §8 count (173/173) is stale; the current suite count is 194/194 (P6 added 2026-10-18).
- Do not run anything from this runbook against production; production deploy is a separate authorized session after D1–D7 are decided.
