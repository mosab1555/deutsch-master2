# Staging Preflight Corrections — Local Files Only

**Date:** 2026-10-15 (UTC) · **Repo:** `C:\Users\mosab\Desktop\deutsch-master2` · **Branch:** `main`
**Staging ref:** `uafwvkgaijmcofistjum` · **Production ref:** `bhdgpscedjowchldsjnd` (never touched)
**Discipline:** no `reset/clean/stash`, no Supabase connection, no CLI, no SQL executed,
no secrets read/printed, no linkage change, no commits/pushes/deploys.
Only narrowly scoped local edits below + this report.

## 1. Exact corrections made

### A. `supabase/tests/academy_core_rls_test.sql` — plan 41 → 45

1. **Header pgTAP note added** (after SEEDED vs REAL): documents Supabase-bundled pgTAP
   semantics — `throws_like(sql, like_pattern, desc)` uses LIKE,
   `lives_ok` passes on no error, `is_empty` passes on 0 rows; missing GRANT raises
   `permission denied for table ...` (not 0 rows); RLS denial raises
   `new row violates row-level security policy ...`; static inspection proves nothing,
   only an isolated-DB run with `ROLLBACK` is evidence.
2. **`SELECT plan(41)` → `SELECT plan(45)`** (4 net-new assertions; 2 fixed in place).
3. **§10 Outsider + anonymous (still 2):** outsider `is_empty` kept (authenticated, has
   grant, RLS → 0 rows — valid). Anonymous `is_empty('SELECT 1 FROM public.academies')`
   replaced with `throws_like('SELECT 1 FROM public.academies', '%permission denied%',
   'anonymous denied academies (no grant by design, permission denied)')`.
   Comment added: §§3–4 are the positive control (fixtures exist; platform owner reads
   both, ownerA reads own). No grant to `anon` added — security model preserved.
4. **§12 Revocation (4 → 6):** `is_empty(... 'removed student loses class access ...')`
   shortened to `'removed student loses class access'` (removed overclaim), plus 2 new
   assertions in the same studentA1 role block:
   - `results_eq('SELECT id FROM public.profiles WHERE id = ''000...000e''', $$VALUES (...::uuid)$$, 'removed student profile preserved (account untouched)')`
   - `results_eq('SELECT user_id FROM public.user_progress WHERE user_id = ''000...000e''', ..., 'removed student progress preserved (history untouched)')`
   Both rely on trigger-created `profiles` + seeded `user_progress` fixtures; student reads
   own rows via untouched own-row policies after `class_enrollments` DELETE.
5. **§13 Audit + platform lockdown (3 → 5):**
   - Teacher audit `throws_like '%only academy managers may write audit events%'` kept
     (has grant; blocked by trigger — valid).
   - Added positive controls via helper (no direct SELECT grant by design):
     `SELECT ok(public.is_platform_owner(), 'platform fixture exists (is_platform_owner true for fixture owner)')`
     as `000...0001`, and `SELECT ok(NOT public.is_platform_owner(), 'non-owner helper false ...')`
     as ownerA. Proves the `platform_owners` row exists without weakening lockdown.
   - `SELECT is_empty('SELECT 1 FROM public.platform_owners', ...)` replaced with
     `throws_like('SELECT 1 FROM public.platform_owners', '%permission denied%',
     'ownerA cannot read platform_owners (no client policy, permission denied)')`.
     No client grant added.
   - `INSERT INTO public.platform_owners ... throws_like '%row-level security%'` corrected to
     `'%permission denied%'` (authenticated has no grant at all, so Postgres raises
     permission denied before RLS; old pattern would fail live despite correct deny).
   Single-transaction design preserved: one `BEGIN`, `SELECT * FROM finish()`, final
   `ROLLBACK`, no `COMMIT`. All fixtures keep `TEST FIXTURE` / `test-fixture-*` /
   `seeded-test-fixture` markers; no real users.

### B. Search-path hardening (behavior-preserving, signatures unchanged)

Rule: `SET search_path = public, pg_temp` (`pg_temp` last), bodies still schema-qualified
(`public.*`, `auth.uid()`), no logic/RLS/trigger/signature changes.

`supabase/migration.sql` (baseline; also added ONE-TIME header, see §D):
- `public.handle_new_user()` — `SET search_path = public` → `public, pg_temp`.
- `public.update_updated_at_column()` — added `SET search_path = public, pg_temp`
  (was none; invoker-rights trigger helper, body `NEW.updated_at = NOW()` unchanged).
- `public.get_or_create_user_progress(UUID, JSONB)` — added `SET search_path = public, pg_temp`
  (was `SECURITY DEFINER` with no path).
- `public.update_user_progress(UUID, JSONB, BIGINT, TEXT)` — added `SET search_path = public, pg_temp`
  (was `SECURITY DEFINER` with no path).

`supabase/migrations/20261015_academy_core.sql` (all `SET search_path = public;` → `public, pg_temp;`):
- `public.academy_touch_updated_at()` (invoker-rights).
- Helpers (all `SECURITY DEFINER STABLE`): `is_platform_owner()`, `academy_role(UUID)`,
  `is_academy_member(UUID)`, `is_academy_manager(UUID)`, `class_academy(UUID)`,
  `is_class_teacher(UUID)`, `is_class_student(UUID)`.
- Guards: `guard_academy_member_write()`, `guard_class_teacher_write()`,
  `guard_class_enrollment_write()`, `guard_audit_insert()` (all `SECURITY DEFINER`),
  plus `guard_class_immutable_academy()` (invoker-rights).

### C. `tools/test-academy-rls-static.js` (offline validator, stdlib-only)

- S1: also requires `supabase/migration.sql` (`S1 baseline exists`).
- S3: `anonymous denied` now requires `anonymous (reads no|denied)` + `permission denied`;
  added `revocation preserves profile+progress`, `platform fixture positive control`,
  `permission-denied (not empty) for missing grants`.
- S7: `helpers ... fixed search_path` tightened to `public, pg_temp`; added
  `no SECURITY DEFINER without fixed search_path` (comment-stripped), `pg_temp last`,
  baseline checks for all 4 functions, `baseline still one-time` (header present + no
  `CREATE TABLE IF NOT EXISTS` on v1 tables), and `pgTAP uses permission-denied`
  (throws_like `%permission denied%` present; old `is_empty` on `academies`-as-anon and
  `platform_owners` absent). S2 plan-count check unchanged (now 45 = 45).

### D. Baseline idempotence stance (unchanged by design)

`supabase/migration.sql` header now states ONE-TIME FRESH-PROJECT BASELINE ONLY, not
idempotent, never production. No broad `IF NOT EXISTS` added; no policies dropped.
Only `CREATE OR REPLACE FUNCTION` remains replaceable — as before.

## 2. New / revised test assertions (summary)

- `plan(45)`: 8 schema + 6 helpers/grants + 2 platform-owner + 3 ownerA + 2 adminA + 3
  teacherA1 + 1 teacherA2 + 3 studentA1 + 2 studentB + 2 outsider/anon + 2 self-grant +
  6 revocation + 5 audit/lockdown.
- Revised (same count, new expectation): anon academies → `throws_like %permission denied%`;
  platform_owners read → `throws_like %permission denied%`; platform_owners write
  `%row-level security%` → `%permission denied%`.
- New (+4): `ok(is_platform_owner() true)` / `ok(NOT is_platform_owner())` as fixture
  existence controls; `results_eq` profile-preserved / progress-preserved after
  enrollment removal.

## 3. Functions hardened

See §1B: 4 in baseline, 13 in academy core (7 helpers + 4 SECURITY DEFINER guards +
2 invoker helpers). All `SET search_path = public, pg_temp`, `pg_temp` last.

## 4. Remaining assumptions about `auth.users` (NOT verified here)

Fixture `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)`
requires exactly those 10 columns to exist with compatible types, plus:
- Defaults/nullable for all other `auth.users` columns (`aud`, `instance_id`,
  `confirmation_token`, `recovery_token`, `email_change`, `phone`, etc. must be nullable
  or defaulted in the hosted Gotrue version, or the INSERT fails).
- No additional `NOT NULL` / `CHECK` (e.g. `encrypted_password` length/format,
  `email` format, `role` allowed values must accept `'x'` / `'authenticated'`;
  `aud` must default when omitted).
- No `BEFORE INSERT` trigger rejecting synthetic rows; v1 `on_auth_user_created`
  trigger must fire and its `INSERT INTO public.profiles` must succeed for each fixture
  (depends on `raw_user_meta_data` JSON shape `'{}'` → `COALESCE(...,'')` path).
- `ON CONFLICT (id) DO NOTHING` requires `id` PK/unique; other `ON CONFLICT DO NOTHING`
  (no target) on academy tables requires no conflicting unique violation beyond PK.
- `role='authenticated'` assumes hosted schema stores that literal; if Gotrue expects a
  different role string, fixture role is still inert (tests use `SET ROLE`, not the column).

Incompatibilities requiring explicit test-file correction (do not guess; verify first):
missing/non-nullable column → add column only if the hosted default is documented, else
rewrite fixture column list; new CHECK → use compliant synthetic values (still
`@fixture.invalid`); trigger rejection → keep `ROLE authenticated` fixtures but adjust
payload, never substitute real users.

## 5. Local checks performed (offline only; no DB, no CLI, no network)

- `node tools/test-academy-rls-static.js` → **59/59 PASS** (`plan=45 counted=45`;
  env probe `docker/podman=false psql=false node-pg=false` → live RLS BLOCKED as expected).
- `node tools/test-academy-core.js` → **109/109 PASS**.
- `npm test` (33 suites via `tools/run-phase0-tests.js`) → **33/33 PASS**.
- `content-quality-gate` → **errors=0 warnings=1913 preserved**.
- `check-www-parity` → **11/11 PASS** (412 files, 140 PACKS, 108 SW refs).
- Live DB tests: **NOT EXECUTED** (no Docker/psql/staging auth here; `supabase test db`
  requires isolated env). No passing result fabricated.
- Diffs reviewed: only intended files changed (see §6); content packs/learner code untouched
  by this task; `audit/*`, backups, `.bak` files preserved.

## 6. Next safe, read-only staging checks (dashboard only; do not run now)

1. Confirm dashboard project is staging `uafwvkgaijmcofistjum` (never prod
   `bhdgpscedjowchldsjnd`); confirm `public` has none of the 12 app tables.
2. Read-only extension check: `SELECT extname FROM pg_extension WHERE extname IN
   ('uuid-ossp','pgcrypto','pgtap');` (expect 3 rows; enable via Dashboard if missing).
3. Hosted Auth schema check (the §4 verification):
   `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
   WHERE table_schema='auth' AND table_name='users' ORDER BY ordinal_position;`
   plus `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='auth.users'::regclass;`
   and `SELECT tgname FROM pg_trigger WHERE tgrelid='auth.users'::regclass;`
   Compare against §4; correct the fixture file first if mismatched — never use real users.
4. After baseline + academy apply (future authorized step): verify 5+7 tables with
   `rowsecurity`, `SELECT COUNT(*) = 13 FROM pg_proc WHERE pronamespace='public'::regnamespace
   AND proname IN (...)` for hardened functions, and `SHOW` equivalent that each reports
   `search_path=public, pg_temp` (or inspect `pg_proc.proconfig`).
5. Run the pgTAP file whole-in-one as `postgres` in staging SQL Editor; expect 45/45 then
   auto-`ROLLBACK`; afterwards verify zero `test-fixture-*` / `%@fixture.invalid` rows remain.
