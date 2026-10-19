-- Deutsch Master — consent_records RLS integration tests (pgTAP).
--
-- SCOPE: ISOLATED ENVIRONMENTS ONLY (local `supabase start` stack or the
-- dedicated staging project). NEVER run against production.
--   Local:   supabase test db --file supabase/tests/consent_records_rls_test.sql
--   Staging: supabase test db --file supabase/tests/consent_records_rls_test.sql --linked
--            (operator-authorized staging run only; the file runs inside one
--            transaction and ROLLBACKs, so no fixture survives the run.)
--
-- PREREQUISITE: supabase/migrations/20261018000000_consent_records.sql must be
-- applied in the target environment first (staging first, never production
-- before owner sign-off). If the table is absent, this file fails at plan time
-- — that is the intended signal, not a suite bug.
--
-- WHAT IT PROVES (live DB, not fixtures-in-JS):
--   schema shape (table, RLS, policies, FK cascade, defaults, CHECKs, exact
--   grants), anonymous denial (no grant), authenticated own-row SELECT/INSERT,
--   cross-user read isolation, forged-user_id rejection, server-forced
--   created_at, forbidden UPDATE/DELETE, constraint validation (type/version/
--   decision/age band), append-only withdrawal history, session switching, and
--   the NULL-subject authenticated fail-closed path.
--
-- SEEDED vs REAL: both identities are fake TEST FIXTURE rows
-- (consent-student-*@fixture.invalid) created as postgres and removed by the
-- final ROLLBACK. No real account is created, modified, or deleted.
--
-- pgTAP NOTES (Supabase-bundled pgTAP; throws_like(sql, like_pattern, desc)
-- matches the Postgres error with LIKE, lives_ok(sql, desc) passes when sql
-- raises no error): denial by missing GRANT raises 'permission denied for
-- table ...'; the BEFORE INSERT guard trigger fires before RLS WITH CHECK, so
-- forged/NULL-subject inserts surface the guard message; CHECK violations
-- surface 'violates check constraint ...'. Static inspection of this file
-- proves nothing about live isolation; only a run in an isolated DB
-- (transaction below + ROLLBACK) is evidence.

CREATE EXTENSION IF NOT EXISTS pgtap;
RESET ROLE;
BEGIN;
SELECT plan(31);

-- ============ 0. Schema + security configuration (10) ============
SELECT has_table('public', 'consent_records', 'consent_records exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'consent_records'),
  'RLS is enabled on consent_records');

SELECT ok(
  (SELECT count(*) = 7 AND count(*) FILTER (WHERE is_nullable = 'NO') = 6
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consent_records'
      AND column_name IN ('id','user_id','consent_type','policy_version',
                          'decision','age_band','created_at')),
  'consent_records has exactly the 7 expected columns (6 NOT NULL)');

SELECT ok(
  (SELECT count(*) = 2 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'consent_records'
      AND cmd IN ('SELECT','INSERT')),
  'own-row SELECT and INSERT policies exist');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'consent_records'
      AND cmd IN ('UPDATE','DELETE','ALL')),
  'no UPDATE/DELETE/ALL policy (append-only by design)');

SELECT ok(
  (SELECT pg_get_constraintdef(c.oid) LIKE '%REFERENCES auth.users(id) ON DELETE CASCADE%'
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'consent_records'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) LIKE '%(user_id)%'
    LIMIT 1) IS TRUE,
  'user_id FK to auth.users cascades with account deletion');

SELECT ok(
  (SELECT is_nullable = 'NO' AND column_default ILIKE '%now()%'
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consent_records'
      AND column_name = 'created_at'),
  'created_at is NOT NULL DEFAULT now() (server-side default)');

SELECT ok(
  (SELECT count(*) = 4 FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'consent_records'
      AND c.contype = 'c'),
  'four CHECK constraints (consent_type, policy_version, decision, age_band)');

SELECT ok(
  has_table_privilege('authenticated', 'public.consent_records', 'SELECT')
  AND has_table_privilege('authenticated', 'public.consent_records', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.consent_records', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.consent_records', 'DELETE'),
  'authenticated has exactly SELECT+INSERT (no UPDATE/DELETE grant)');

SELECT ok(
  NOT has_table_privilege('anon', 'public.consent_records', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.consent_records', 'INSERT'),
  'anon has no table privileges at all');

-- ============ 1. Fixtures: disposable fake identities (no assertions) ============
-- TEST FIXTURES ONLY — never real users; discarded by the final ROLLBACK.
INSERT INTO auth.users
  (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('c0000000-0000-4000-8000-0000000000a1', 'consent-student-a@fixture.invalid', 'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('c0000000-0000-4000-8000-0000000000b2', 'consent-student-b@fixture.invalid', 'x', now(), now(), now(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;
RESET ROLE;

-- ============ 2. Anonymous denial (2) ============
RESET ROLE; SET ROLE anon;
SELECT throws_like(
  'SELECT 1 FROM public.consent_records',
  '%permission denied%',
  'anonymous cannot SELECT consent records (no grant, permission denied)');
SELECT throws_like(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'privacy_notice', 'test-policy-v1', 'granted')$$,
  '%permission denied%',
  'anonymous cannot INSERT consent records (no grant, permission denied)');
RESET ROLE;

-- ============ 3. Authenticated own-row writes as student A (3) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-0000000000a1', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-0000000000a1"}', false);
SELECT lives_ok(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision, age_band)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'privacy_notice', 'test-policy-v1', 'granted', 'under_15')$$,
  'student A records own privacy_notice acknowledgement (granted)');
SELECT lives_ok(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'terms_of_service', 'test-policy-v1', 'withdrawn')$$,
  'student A records own terms withdrawal (append-only new row)');
SELECT results_eq(
  'SELECT decision FROM public.consent_records ORDER BY decision',
  $$VALUES ('granted'), ('withdrawn')$$,
  'student A sees exactly own granted+withdrawn history rows');
RESET ROLE;

-- ============ 4. Session switch to student B (2) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-0000000000b2', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-0000000000b2"}', false);
SELECT lives_ok(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000b2', 'privacy_notice', 'test-policy-v1', 'granted')$$,
  'student B records own acknowledgement after session switch');
SELECT results_eq(
  'SELECT count(*)::int FROM public.consent_records',
  $$VALUES (1)$$,
  'student B sees only B own rows (A rows invisible)');
RESET ROLE;

-- ============ 5. Cross-user read isolation as student A (2) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-0000000000a1', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-0000000000a1"}', false);
SELECT is_empty(
  $$SELECT 1 FROM public.consent_records WHERE user_id = 'c0000000-0000-4000-8000-0000000000b2'$$,
  'student A cannot read student B rows (RLS own-row only)');
SELECT results_eq(
  'SELECT count(*)::int FROM public.consent_records',
  $$VALUES (2)$$,
  'student A still sees exactly own 2 history rows');
RESET ROLE;

-- ============ 6. Guard trigger: forged id, timestamp, NULL subject (3) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-0000000000a1', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-0000000000a1"}', false);
SELECT throws_like(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000b2', 'privacy_notice', 'test-policy-v1', 'granted')$$,
  '%consent records may only be created for the authenticated user%',
  'forged user_id (cross-user insert) rejected by guard trigger');
SELECT lives_ok(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision, created_at)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'privacy_notice', 'test-backdate-v1', 'granted', '2000-01-01T00:00:00Z')$$,
  'client-supplied backdated created_at is accepted but overridden');
SELECT ok(
  (SELECT created_at > now() - interval '5 minutes'
     FROM public.consent_records
    WHERE user_id = 'c0000000-0000-4000-8000-0000000000a1'
      AND policy_version = 'test-backdate-v1'),
  'guard forces server timestamp (backdated value ignored)');
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', false);
SELECT throws_like(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'privacy_notice', 'test-policy-v1', 'granted')$$,
  '%consent records may only be created for the authenticated user%',
  'authenticated NULL-subject insert denied (fail closed)');
RESET ROLE;

-- ============ 7. Forbidden UPDATE/DELETE (2) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-0000000000a1', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-0000000000a1"}', false);
SELECT throws_like(
  $$UPDATE public.consent_records SET decision = 'withdrawn' WHERE consent_type = 'privacy_notice'$$,
  '%permission denied%',
  'UPDATE on consent records denied (no grant, permission denied)');
SELECT throws_like(
  $$DELETE FROM public.consent_records WHERE consent_type = 'privacy_notice'$$,
  '%permission denied%',
  'DELETE on consent records denied (no grant, permission denied)');
RESET ROLE;

-- ============ 8. Constraint validation (5) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-0000000000a1', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-0000000000a1"}', false);
SELECT throws_like(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'guardian_consent', 'test-policy-v1', 'granted')$$,
  '%violates check constraint%',
  'invalid consent_type (guardian_consent) rejected by CHECK');
SELECT throws_like(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'privacy_notice', '   ', 'granted')$$,
  '%violates check constraint%',
  'blank policy_version rejected by CHECK');
SELECT throws_like(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'privacy_notice', repeat('x', 65), 'granted')$$,
  '%violates check constraint%',
  'overlong policy_version (65 chars) rejected by CHECK');
SELECT throws_like(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'privacy_notice', 'test-policy-v1', 'maybe')$$,
  '%violates check constraint%',
  'invalid decision value rejected by CHECK');
SELECT throws_like(
  $$INSERT INTO public.consent_records (user_id, consent_type, policy_version, decision, age_band)
    VALUES ('c0000000-0000-4000-8000-0000000000a1', 'privacy_notice', 'test-policy-v1', 'granted', 'adult')$$,
  '%violates check constraint%',
  'non-allowlisted age_band rejected by CHECK');
RESET ROLE;

-- ============ 9. Append-only history integrity (1) ============
SELECT ok(
  (SELECT count(*) = 2
     FROM public.consent_records
    WHERE user_id = 'c0000000-0000-4000-8000-0000000000a1'
      AND consent_type IN ('privacy_notice','terms_of_service')
      AND policy_version = 'test-policy-v1'),
  'student A history intact (2 rows; nothing rewritten or deleted)');

SELECT * FROM finish();
ROLLBACK;
