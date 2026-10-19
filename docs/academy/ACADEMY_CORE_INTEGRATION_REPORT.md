# Academy Core Integration Report — Database & Security Verification

**Date:** 2026-10-15 (UTC) · **Repo:** `C:\Users\mosab\Desktop\deutsch-master2` · **Branch:** `main`
**HEAD:** `3d26062` · **`origin/main`:** `7dbd6fc` (local ahead by the 2 pre-existing commits; unchanged)
**Primary report (read, never modified):** `docs/academy/ACADEMY_CORE_IMPLEMENTATION_REPORT.md`
**Discipline:** no `git reset/clean/stash`, no staging/commits/pushes/deploys, no content regeneration,
no `--linked` database commands, no production contact, no secrets printed or changed, no auth-provider
changes. All prior work and backups preserved. This phase adds two new files only
(`supabase/tests/academy_core_rls_test.sql`, `tools/test-academy-rls-static.js`, this report);
no existing implementation file was modified.

**Acceptance decision: `BLOCKED — SAFE INTEGRATION ENVIRONMENT UNAVAILABLE`**

Pure-logic suites pass (109 + 48 static checks, 33/33 regression), but passing them does not
qualify as database-level RLS verification — and no live database verification was performed,
for the safety reasons documented below. The migration was NOT applied anywhere.

---

## 1. Environment used and proof of isolation from production

| Item | Evidence (this machine, read-only inspection) |
|---|---|
| Supabase CLI | v2.119.0 installed via npm. `--help` outputs only; no DB command executed. |
| Linked project | `supabase/.temp/project-ref` + `linked-project.json` + `supabase status` all agree the CLI is linked to **`bhdgpscedjowchldsjnd` / `deutsch-master`** — the same URL shipped in `client/supabase-config.js`. **This is production.** |
| Local stack | **Impossible:** `supabase status` fails with `docker: command not found (podman also not found)`; `Get-Command docker` empty; no `supabase/config.toml` exists (no local stack ever configured). `supabase start` was deliberately NOT attempted. |
| Standalone Postgres | **Absent:** no `psql/pg_ctl/initdb/postgres/pg_tmp`, no `C:/Program Files*/PostgreSQL`, no `pg`/`pg-mem` node modules. |
| Staging project | **None exists:** no staging ref/URL/credentials anywhere in the repo (`.env.example` holds shop placeholders only; `Select-String` for staging/local-DB URLs finds nothing); no staging authorization is configured. Nothing to connect to, and nothing was created/linked. |
| Browser runner | **Unavailable:** no `playwright/puppeteer/chrome` modules or binaries; `tools/e2e.js` is a Node fake-DOM harness (see its header), not a browser. MS Edge exists on disk but there is no CDP harness and no staging users, so no authenticated E2E is possible. |
| Production contact | **Zero:** no `--linked`/`--db-url` command was run; migration/rollback inspected by file read only; regression suites are stdlib-only with no network. |

Conclusion: the only reachable database is production, and touching it is forbidden. No isolated
environment (local containers or dedicated staging) can be established from here, so the migration
was applied **nowhere** and no live RLS test was executed — by design, not by omission.

---

## 2. Migration results

**Not applied (intentionally).** `supabase/migrations/20261015_academy_core.sql` (28,075 bytes, 607 lines)
was verified by read-only inspection only:
- Additive: 7 new tables, 0 alterations to v1 tables, 0 dropped v1 policies, no `INSERT INTO platform_owners`,
  no hardcoded identity, no service-role grant/key (static validator S7 PASS).
- Helpers are `SECURITY DEFINER` with fixed `search_path = public`; every policy gates on `auth.uid()`;
  academy-table grants go to `authenticated` only (never `anon`); `platform_owners` has no client policies.
- Rollback file (4,438 bytes) inspected WITHOUT execution: correct reverse order
  (policies → triggers → functions → tables), `IF EXISTS` throughout (20+ occurrences), preserves
  v1 tables and `auth.users`. It was never run against any database.

---

## 3. Actual database-level RLS test results

**None — live execution BLOCKED (see §1).** To make the eventual isolated run reproducible, this phase
delivers a ready-to-run pgTAP suite plus a static validator, both passing statically:

- New: `supabase/tests/academy_core_rls_test.sql` — **41 pgTAP assertions** (`SELECT plan(41)`),
  single transaction ending in `ROLLBACK` (no residue, no `COMMIT`).
- Fixtures: academies A/B; platform owner; ownerA/adminA; teacherA1 (assigned CLASS_A1) vs teacherA2
  (unassigned); studentA1 (enrolled CLASS_A1) vs studentB (academy B); outsider; anonymous.
  Identity is simulated per block with `SET ROLE authenticated/anon` + `request.jwt.claim.sub`
  (the exact claim `auth.uid()` reads). The service role is never assumed — no `SET ROLE service_role`.
- Covers: schema/RLS-enabled (8), helpers + authenticated-vs-anon grants (6), platform-owner create+read (2),
  ownerA own-only + cross-academy write denial (3), adminA update + self-grant-owner block (2),
  teacherA1 assigned-only + foreign-progress denial + create denial (3), teacherA2 sees nothing (1),
  studentA1 self-only progress + enrolled-class-only (3), studentB cross-denials (2), outsider/anon empty (2),
  self-grant attacks (2), enrollment removal → access lost (2), teacher revocation → access lost (2),
  audit append-only + `platform_owners` read/write lockdown (3).
- Seeded-vs-real: all fixtures carry `TEST FIXTURE` / `test-fixture-*` / `seeded-test-fixture` markers,
  including `user_progress.state.fixture`; never presentable as learner activity.
- Static validation: `tools/test-academy-rls-static.js` — **48/48 PASS**, including plan-count equality
  (41 = 41), coverage of every area above, transaction/ROLLBACK/finish() structure, secret hygiene,
  migration/rollback safety re-checks, and proof that no `client/*.js` path writes `platform_owners`.
- Live command (isolated env only, NEVER production): `supabase start && supabase test db --file supabase/tests/academy_core_rls_test.sql`.

---

## 4. Cross-academy denial tests (live)

**Not executed — BLOCKED.** The denials are specified (not proven) in the pgTAP suite §3 above
(ownerA→B write, studentB→A class/progress, teacherA1→unassigned progress, outsider/anon→all).
No denial is claimed as database-verified.

## 5. End-to-end workflow results (portal + learner)

**Not executed — no browser runner and no staging users (see §1).** All 9 workflow steps
(create academy → add teacher/class → assign/enroll → teacher-scoped view → real progress display →
removal revokes without deleting account/history → loading/empty/denied states → RTL/learner independence)
remain unverified end-to-end. Static coverage only: `test-academy-core.js` UI-wiring checks
(all 6 portal sections, banner, scripts, SW precache, learner `index.html` clean) PASS 109/109;
`e2e` 51/51 (learner journeys, Node fake-DOM) PASS. No test record is presented as real learning activity.

## 6. Existing tests run and their outcomes

- `npm test` (33 suites): **33/33 PASS** (Node v24.19.0), incl. `test-howto` 68/68, `check-translations`
  (865 keys × AR/EN/DE, 364 data-i18n keys), `check-www-parity` 11/11, `e2e` 51/51.
- `tools/test-academy-core.js`: **109/109 PASS** (pure-logic boundaries + wiring; not DB evidence).
- `tools/test-academy-rls-static.js` (new): **48/48 PASS** (static only; live run BLOCKED).
- `content-quality-gate`: **`errors=0 warnings=1913` preserved** (default mode, no `--strict`).
- Client build/parity: `check-www-parity` 11/11 (412 files, 140 PACKS, 108 SW refs). `npm run www`
  was NOT re-run in this phase (no `client/*` changes; mirroring script already inspected in Phase 1).
- No content libraries regenerated; no broad build/mirror commands executed.

## 7. What remains unverified

1. Migration applies cleanly to a real Postgres/Supabase instance (syntax + FK + extension order).
2. Every RLS policy/trigger/grant in §3 against live authenticated identities (the core of this phase).
3. Cross-academy denials at the database layer (specified, unproven).
4. Portal end-to-end in a real browser with staging users (all 9 steps).
5. Remote CI, Chrome-gated suites, real devices, production behavior (all previously outstanding).

## 8. Secure staging + platform-owner provisioning procedure

**Provision staging (trusted operator only, never production):**
1. Create a NEW Supabase project (staging); record its ref separately. Verify `supabase/.temp/project-ref`
   still points at production — do all staging work with `--project-ref <staging>` or the dashboard,
   never `--linked`.
2. In staging SQL Editor as `postgres`: run `supabase/migration.sql` (v1), then
   `supabase/migrations/20261015_academy_core.sql`. Confirm 7 tables + RLS enabled.
3. Install Docker Desktop on the staging-test machine; `supabase start`; run the pgTAP suite locally first:
   `supabase test db --file supabase/tests/academy_core_rls_test.sql` (expects 41/41, auto-rollback).
4. Allowlist staging + Pages URLs in staging Auth settings; configure a LOCAL-ONLY
   `client/supabase-config.js` (never commit real keys beyond the publishable pattern).
5. Exercise the §5 portal workflow with TEST-labeled users; verify teacher scoping and revocation;
   then `ROLLBACK`/delete fixtures. Never copy staging data to production.

**First platform owner (staging; same for production only after all blockers clear):**
1. Create/identify the operator's login user in Auth; copy its `auth.users.id` UUID (never commit it).
2. As `postgres` in the SQL Editor: `INSERT INTO public.platform_owners (user_id) VALUES ('<UUID>');`
3. Verify: owner can `INSERT INTO academies`; a non-owner gets an RLS denial. Add a second owner
   for recovery. Safety properties (statically verified, S7/S9): no client policy or code path can
   write `platform_owners`; `is_platform_owner()` exposes only a boolean; triggers reject
   self-grants — so ordinary public users cannot trigger provisioning.

## 9. Blockers that must be resolved before production use

1. **Isolated environment still missing** (Docker Desktop or dedicated staging + authorization) — live
   RLS/pgTAP run outstanding.
2. Migration never applied anywhere, even staging.
3. Platform owner never provisioned (needs staging + operator UUID).
4. Email-invite backend outstanding (SMTP + Edge Function); UUID enrollment is interim.
5. Portal browser E2E outstanding (needs staging users + Playwright/Puppeteer CDP harness).
6. Content review (0/200), legal sign-off, remote CI/Chrome/device validation (carried over).
7. Production migration/deploy remains explicitly unauthorized.

---

## Files added / touched in this phase

- Added: `supabase/tests/academy_core_rls_test.sql` (41-assertion pgTAP, transaction + ROLLBACK),
  `tools/test-academy-rls-static.js` (48 static checks, stdlib-only, no DB), this report.
- Modified: none. Implementation report, migrations, portal code, tests, and content untouched.
- Git: HEAD `3d26062` intact, no commits/pushes/deploys; prior Phase 1 working tree fully preserved.
