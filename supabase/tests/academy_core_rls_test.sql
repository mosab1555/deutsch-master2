-- Deutsch Master — Academy Core RLS integration tests (pgTAP).
--
-- SCOPE: ISOLATED ENVIRONMENTS ONLY (local `supabase start` stack or a
-- dedicated staging project). NEVER run against production.
--   Local:  supabase start && supabase test db --file supabase/tests/academy_core_rls_test.sql
--   (requires Docker; the file runs inside one transaction and ROLLBACKs, so
--   no fixture survives the run).
--
-- WHAT IT PROVES (live DB, not fixtures-in-JS):
--   two academies (A/B) with platform owner, ownerA/adminA, teacherA1
--   (assigned to CLASS_A1), teacherA2 (unassigned), studentA1 (enrolled in
--   CLASS_A1), ownerB/teacherB/studentB (academy B), outsider (no membership),
--   and anonymous — exercising permitted ops, cross-academy denials, teacher
--   assigned-vs-unassigned, student self-vs-other, self-grant attacks,
--   enrollment/assignment revocation, audit append-only, platform_owners
--   lockdown, and grants/RLS on exposed tables. Authenticated end-user roles
--   are simulated with SET ROLE authenticated + request.jwt.claim.sub (the
--   same claim auth.uid() reads); the service role is NEVER used as evidence
--   for end-user restrictions (all behavior asserts run as authenticated/anon).
--
-- SEEDED vs REAL: every fixture UUID/name carries the TEST-FIXTURE marker and
-- user_progress rows are labelled seeded-test-fixture (never presented as
-- learner activity). The portal distinguishes them the same way.
--
-- pgTAP NOTES (Supabase-bundled pgTAP; throws_like(sql, like_pattern, desc)
-- matches the Postgres error with LIKE, lives_ok(sql, desc) passes when sql
-- raises no error, is_empty(sql, desc) passes on 0 rows): denial by missing
-- GRANT raises 'permission denied for table ...' (not 0 rows), so anon on
-- academies and any client role on platform_owners must use throws_like
-- '%permission denied%'. RLS denials raise 'new row violates row-level
-- security policy ...' and keep throws_like '%row-level security%'. Static
-- inspection of this file proves nothing about live isolation; only a run in
-- an isolated DB (transaction below + ROLLBACK) is evidence.

CREATE EXTENSION IF NOT EXISTS pgtap;
RESET ROLE;
BEGIN;
SELECT plan(52);

-- ============ 0. Schema present (8) ============
SELECT has_table('public', 'academies', 'academies exists');
SELECT has_table('public', 'academy_members', 'academy_members exists');
SELECT has_table('public', 'classes', 'classes exists');
SELECT has_table('public', 'class_teachers', 'class_teachers exists');
SELECT has_table('public', 'class_enrollments', 'class_enrollments exists');
SELECT has_table('public', 'platform_owners', 'platform_owners exists');
SELECT has_table('public', 'academy_audit_events', 'academy_audit_events exists');
SELECT ok(
  (SELECT count(*) = 7 FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN
      ('academies','academy_members','classes','class_teachers',
       'class_enrollments','platform_owners','academy_audit_events')
    AND rowsecurity IS TRUE),
  'RLS enabled on all 7 academy tables');

-- ============ 1. Helpers + grants (6) ============
SELECT has_function('public', 'is_platform_owner', ARRAY[]::text[], 'is_platform_owner() exists');
SELECT has_function('public', 'academy_role', ARRAY['uuid'], 'academy_role(uuid) exists');
SELECT has_function('public', 'is_academy_manager', ARRAY['uuid'], 'is_academy_manager(uuid) exists');
SELECT has_function('public', 'is_class_teacher', ARRAY['uuid'], 'is_class_teacher(uuid) exists');
SELECT ok(has_table_privilege('authenticated', 'public.academies', 'SELECT'),
  'authenticated granted SELECT on academies (RLS is the boundary)');
SELECT ok(NOT has_table_privilege('anon', 'public.academies', 'SELECT'),
  'anon has NO grant on academies');

-- ============ 2. Fixtures (superuser; RLS bypassed for setup) ============
-- Fake auth identities (TEST FIXTURES ONLY — never real users).
INSERT INTO auth.users
  (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'test-platform-owner@fixture.invalid', 'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-00000000000a', 'test-owner-a@fixture.invalid',       'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-admin-a@fixture.invalid',       'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'test-teacher-a1@fixture.invalid',    'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-00000000000d', 'test-teacher-a2@fixture.invalid',    'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-00000000000e', 'test-student-a1@fixture.invalid',    'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-00000000000f', 'test-student-a2@fixture.invalid',    'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b1', 'test-owner-b@fixture.invalid',       'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'test-teacher-b@fixture.invalid',     'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b3', 'test-student-b@fixture.invalid',     'x', now(), now(), now(), '{}', '{}', false, 'authenticated'),
  ('00000000-0000-4000-8000-0000000000ff', 'test-outsider@fixture.invalid',      'x', now(), now(), now(), '{}', '{}', false, 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.platform_owners (user_id)
VALUES ('00000000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO public.academies (id, name, slug, description)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'TEST FIXTURE Academy A', 'test-fixture-a', 'seeded test fixture, not real'),
  ('22222222-2222-4222-8222-222222222222', 'TEST FIXTURE Academy B', 'test-fixture-b', 'seeded test fixture, not real')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.academy_members (academy_id, user_id, role, status) VALUES
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000a', 'academy_owner', 'active'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000b', 'academy_admin', 'active'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000c', 'teacher', 'active'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000d', 'teacher', 'active'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000e', 'student', 'active'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000f', 'student', 'active'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000000b1', 'academy_owner', 'active'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000000b2', 'teacher', 'active'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000000b3', 'student', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.classes (id, academy_id, name, level) VALUES
  ('a0000000-0000-4000-8000-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'TEST FIXTURE Class A1', 'A1'),
  ('a0000000-0000-4000-8000-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'TEST FIXTURE Class A2', 'A1'),
  ('b0000000-0000-4000-8000-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'TEST FIXTURE Class B1', 'A1')
ON CONFLICT (id) DO NOTHING;

-- Assignment/enrollment fixtures require a manager identity for the
-- BEFORE INSERT guards (guard_class_teacher_write / guard_class_enrollment_write).
-- Seed both as the existing platform-owner fixture (manager of every academy).
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
INSERT INTO public.class_teachers (class_id, teacher_id) VALUES
  ('a0000000-0000-4000-8000-aaaaaaaaaaa1', '00000000-0000-4000-8000-00000000000c'),
  ('b0000000-0000-4000-8000-bbbbbbbbbbb1', '00000000-0000-4000-8000-0000000000b2')
ON CONFLICT DO NOTHING;

INSERT INTO public.class_enrollments (class_id, student_id) VALUES
  ('a0000000-0000-4000-8000-aaaaaaaaaaa1', '00000000-0000-4000-8000-00000000000e'),
  ('a0000000-0000-4000-8000-aaaaaaaaaaa2', '00000000-0000-4000-8000-00000000000f'),
  ('b0000000-0000-4000-8000-bbbbbbbbbbb1', '00000000-0000-4000-8000-0000000000b3')
ON CONFLICT DO NOTHING;
RESET ROLE;

-- Seeded progress rows: labelled fixtures, never mistaken for learner activity.
INSERT INTO public.user_progress (user_id, state, version) VALUES
  ('00000000-0000-4000-8000-00000000000e',
   '{"fixture":"seeded-test-fixture","events":[{"aid":"fx1","ts":"2026-10-01T10:00:00Z","ok":true,"qtype":"article"}],"totalAnswered":1,"totalCorrect":1}',
   1),
  ('00000000-0000-4000-8000-0000000000b3',
   '{"fixture":"seeded-test-fixture","events":[],"totalAnswered":0,"totalCorrect":0}',
   1)
ON CONFLICT (user_id) DO NOTHING;

-- Helper: act as an end user (same claim auth.uid() reads). Callers RESET ROLE first.
-- (Inlined per block: SET ROLE authenticated + set_config sub.)

-- ============ 3. Platform owner (2) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
SELECT results_eq(
  'SELECT id FROM public.academies ORDER BY 1',
  $$VALUES ('11111111-1111-4111-8111-111111111111'::uuid), ('22222222-2222-4222-8222-222222222222'::uuid)$$,
  'platform owner reads both academies');
SELECT lives_ok(
  $$INSERT INTO public.academies (name, slug) VALUES ('TEST FIXTURE Academy C', 'test-fixture-c')$$,
  'platform owner may create academies');
RESET ROLE;

-- ============ 4. Academy owner A (3) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT results_eq(
  'SELECT id FROM public.academies ORDER BY 1',
  $$VALUES ('11111111-1111-4111-8111-111111111111'::uuid)$$,
  'ownerA reads own academy only');
SELECT lives_ok(
  $$INSERT INTO public.classes (academy_id, name, level) VALUES ('11111111-1111-4111-8111-111111111111', 'TEST FIXTURE Class A3', 'A2')$$,
  'ownerA creates class in own academy');
SELECT throws_like(
  $$INSERT INTO public.classes (academy_id, name) VALUES ('22222222-2222-4222-8222-222222222222', 'TEST FIXTURE Cross')$$,
  '%row-level security%',
  'ownerA denied creating class in academy B');
RESET ROLE;

-- ============ 5. Admin A (3) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
SELECT lives_ok(
  $$UPDATE public.academies SET description = 'seeded update' WHERE id = '11111111-1111-4111-8111-111111111111'$$,
  'adminA updates own academy');
SELECT throws_like(
  $$UPDATE public.academy_members SET role = 'academy_owner' WHERE academy_id = '11111111-1111-4111-8111-111111111111' AND user_id = '00000000-0000-4000-8000-00000000000b'$$,
  '%members cannot change their own role or status%',
  'adminA blocked from self-granting owner');
SELECT throws_like(
  $$UPDATE public.academy_members SET role = 'academy_owner' WHERE academy_id = '11111111-1111-4111-8111-111111111111' AND user_id = '00000000-0000-4000-8000-00000000000c'$$,
  '%only academy owners may grant owner/admin roles%',
  'adminA blocked from granting owner to another member');
RESET ROLE;

-- ============ 6. Assigned teacher A1 (3) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', false);
SELECT results_eq(
  'SELECT id FROM public.classes ORDER BY 1',
  $$VALUES ('a0000000-0000-4000-8000-aaaaaaaaaaa1'::uuid)$$,
  'teacherA1 sees assigned class only');
SELECT is_empty(
  'SELECT 1 FROM public.user_progress WHERE user_id = ''00000000-0000-4000-8000-00000000000f''',
  'teacherA1 denied progress of student in unassigned class');
SELECT throws_like(
  $$INSERT INTO public.classes (academy_id, name) VALUES ('11111111-1111-4111-8111-111111111111', 'TEST FIXTURE Rogue')$$,
  '%row-level security%',
  'teacherA1 denied creating classes');
RESET ROLE;

-- ============ 7. Unassigned teacher A2 (1) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000d', false);
SELECT is_empty(
  'SELECT 1 FROM public.classes',
  'unassigned teacherA2 sees no classes');
RESET ROLE;

-- ============ 8. Enrolled student A1 (3) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000e', false);
SELECT results_eq(
  'SELECT user_id FROM public.user_progress',
  $$VALUES ('00000000-0000-4000-8000-00000000000e'::uuid)$$,
  'studentA1 reads own progress only');
SELECT is_empty(
  'SELECT 1 FROM public.user_progress WHERE user_id = ''00000000-0000-4000-8000-00000000000f''',
  'studentA1 denied another student progress');
SELECT results_eq(
  'SELECT id FROM public.classes ORDER BY 1',
  $$VALUES ('a0000000-0000-4000-8000-aaaaaaaaaaa1'::uuid)$$,
  'studentA1 sees enrolled class only');
RESET ROLE;

-- ============ 9. Other-academy student B (2) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b3', false);
SELECT is_empty(
  'SELECT 1 FROM public.classes WHERE id = ''a0000000-0000-4000-8000-aaaaaaaaaaa1''',
  'studentB denied academy A class');
SELECT is_empty(
  'SELECT 1 FROM public.user_progress WHERE user_id = ''00000000-0000-4000-8000-00000000000e''',
  'studentB denied academy A student progress');
RESET ROLE;

-- ============ 10. Outsider + anonymous (2) ============
-- Positive control: §§3–4 prove academies fixtures exist (platform owner reads
-- both, ownerA reads own). Outsider (authenticated, has grant) gets 0 rows via
-- RLS; anon (no grant by design) gets permission denied, not 0 rows.
-- pgTAP throws_like(sql, pattern, desc) matches the Postgres error with LIKE;
-- '%permission denied%' covers 'permission denied for table/relation ...'.
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000ff', false);
SELECT is_empty('SELECT 1 FROM public.academies', 'outsider reads no academies');
RESET ROLE; SET ROLE anon;
SELECT throws_like(
  'SELECT 1 FROM public.academies',
  '%permission denied%',
  'anonymous denied academies (no grant by design, permission denied)');
RESET ROLE;

-- ============ 11. Self-grant attacks (8) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000ff', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000ff"}', false);
SELECT throws_like(
  $$INSERT INTO public.academy_members (academy_id, user_id, role) VALUES ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000ff', 'teacher')$$,
  '%no academy membership; operation not permitted%',
  'outsider blocked from self-granting teacher');
SELECT throws_like(
  $$INSERT INTO public.academy_members (academy_id, user_id, role) VALUES ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000ff', 'student')$$,
  '%no academy membership; operation not permitted%',
  'outsider self-insert as student denied at guard layer');
-- Authenticated JWT-backed caller with NULL subject and no membership must
-- also fail closed (fails the same guard; assumes auth.uid() maps empty
-- subject to NULL per Supabase auth helpers; a loud mismatch here means the
-- emulation assumption needs review, not a silent pass).
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', false);
SELECT ok(auth.uid() IS NULL, 'authenticated NULL-subject yields auth.uid() IS NULL');
SELECT is(auth.jwt()->>'role', 'authenticated', 'authenticated NULL-subject carries role authenticated');
SELECT throws_like(
  $$INSERT INTO public.academy_members (academy_id, user_id, role) VALUES ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000ff', 'student')$$,
  '%no academy membership; operation not permitted%',
  'authenticated NULL-subject without membership denied at guard layer');
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000000c"}', false);
SELECT lives_ok(
  $$UPDATE public.academy_members SET role = 'academy_admin' WHERE academy_id = '11111111-1111-4111-8111-111111111111' AND user_id = '00000000-0000-4000-8000-00000000000c'$$,
  'teacher self-promotion attempt raises no unexpected error');
SELECT results_eq(
  'SELECT role FROM public.academy_members WHERE academy_id = ''11111111-1111-4111-8111-111111111111'' AND user_id = ''00000000-0000-4000-8000-00000000000c''',
  $$VALUES ('teacher')$$,
  'teacher role unchanged after self-promotion attempt');
SELECT throws_like(
  $$INSERT INTO public.academy_members (academy_id, user_id, role) VALUES ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000ff', 'student')$$,
  '%only academy managers may add members%',
  'teacher blocked from adding non-member as student');
SELECT set_config('request.jwt.claims', '{}', false);
RESET ROLE;

-- ============ 12. Revocation (6) ============
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT lives_ok(
  $$DELETE FROM public.class_enrollments WHERE class_id = 'a0000000-0000-4000-8000-aaaaaaaaaaa1' AND student_id = '00000000-0000-4000-8000-00000000000e'$$,
  'ownerA removes enrollment');
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000e', false);
SELECT is_empty(
  'SELECT 1 FROM public.classes',
  'removed student loses class access');
SELECT results_eq(
  'SELECT id FROM public.profiles WHERE id = ''00000000-0000-4000-8000-00000000000e''',
  $$VALUES ('00000000-0000-4000-8000-00000000000e'::uuid)$$,
  'removed student profile preserved (account untouched)');
SELECT results_eq(
  'SELECT user_id FROM public.user_progress WHERE user_id = ''00000000-0000-4000-8000-00000000000e''',
  $$VALUES ('00000000-0000-4000-8000-00000000000e'::uuid)$$,
  'removed student progress preserved (history untouched)');
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT lives_ok(
  $$DELETE FROM public.class_teachers WHERE class_id = 'a0000000-0000-4000-8000-aaaaaaaaaaa1' AND teacher_id = '00000000-0000-4000-8000-00000000000c'$$,
  'ownerA revokes teacher assignment');
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', false);
SELECT is_empty(
  'SELECT 1 FROM public.classes',
  'revoked teacher loses class access');
RESET ROLE;

-- ============ 13. Audit + platform lockdown (5) ============
-- Positive controls: platform_owners fixture existence is proven via the
-- SECURITY DEFINER helper (no direct SELECT grant by design, so direct
-- SELECT/INSERT by client roles must raise permission denied, not RLS empty).
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000c', false);
SELECT throws_like(
  $$INSERT INTO public.academy_audit_events (academy_id, actor_id, action, entity_type) VALUES ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000c', 'test', 'settings')$$,
  '%only academy managers may write audit events%',
  'teacher denied audit writes');
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
SELECT ok(
  public.is_platform_owner(),
  'platform fixture exists (is_platform_owner true for fixture owner)');
RESET ROLE; SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
SELECT ok(
  NOT public.is_platform_owner(),
  'non-owner helper false (is_platform_owner exposes boolean only)');
SELECT throws_like(
  'SELECT 1 FROM public.platform_owners',
  '%permission denied%',
  'ownerA cannot read platform_owners (no client policy, permission denied)');
SELECT throws_like(
  $$INSERT INTO public.platform_owners (user_id) VALUES ('00000000-0000-4000-8000-00000000000a')$$,
  '%permission denied%',
  'platform_owners not writable by academy owners (trusted-operator SQL only)');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
