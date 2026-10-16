-- Deutsch Master — ACL hardening forward repair (STAGING ONLY, NOT YET EXECUTED).
--
-- Purpose: repair excessive privileges on the ALREADY-CREATED staging schema
-- without dropping/recreating anything. Editing supabase/migration.sql and
-- supabase/migrations/20261015_academy_core.sql only fixes FUTURE installs;
-- this file fixes the LIVE staging database that already ran those files.
--
-- Finding: pg_default_acl showed broad default table privileges for anon and
-- authenticated (roles postgres/supabase_admin, schema public), so staging
-- tables (notably academies, platform_owners) report TRUNCATE, REFERENCES,
-- TRIGGER in addition to the explicitly granted operations. RLS is enabled
-- but grants must be narrowed (least-privilege; RLS stays the boundary, no
-- policy weakened here).
--
-- Prerequisites (verify BEFORE running; DO NOT RUN NOW — review only):
--   1. Dashboard project is staging uafwvkgaijmcofistjum, NEVER production
--      bhdgpscedjowchldsjnd.
--   2. supabase/migration.sql (v1 baseline, 5 tables) AND
--      supabase/migrations/20261015_academy_core.sql (7 academy tables) have
--      both been applied to staging already.
--   3. Run in the Supabase SQL Editor AS postgres owner (same role that ran
--      the baseline/academy migrations). Do NOT run as anon/authenticated.
--   4. No secrets needed; this file contains no keys.
--
-- Safety: forward-only and additive. Only REVOKE/GRANT, ALTER DEFAULT
-- PRIVILEGES (postgres only), CREATE OR REPLACE FUNCTION bodies for the two
-- vulnerable progress helpers, and read-only SELECT verification at the end.
-- No DROP/CREATE TABLE, no policy/trigger/user/data changes.
-- supabase_admin defaults are platform-managed and intentionally untouched.
--
-- Expected final matrix (see docs/academy/ACL_HARDENING_REPORT.md §2):
--   Baseline authenticated: profiles/user_progress/sync_queue/devices =
--     SELECT,INSERT,UPDATE,DELETE; auth_events = SELECT,INSERT.
--   Baseline anon: auth_events INSERT only (pre-login logging, user_id NULL).
--   Academy authenticated: academies SELECT,INSERT,UPDATE;
--     academy_members/classes SELECT,INSERT,UPDATE,DELETE;
--     class_teachers/class_enrollments SELECT,INSERT,DELETE;
--     academy_audit_events SELECT,INSERT; platform_owners NONE.
--   Academy anon: NONE on all 7 tables.
--   Sequences authenticated USAGE: user_progress/sync_queue/auth_events +
--     academy_audit_events; anon USAGE: auth_events only.
--   Functions: progress RPCs EXECUTE authenticated (+service_role); RLS
--     helpers EXECUTE authenticated (+service_role); trigger/guard helpers
--     NO client EXECUTE (service_role only; trigger firing unaffected).

-- ============================================================
-- 1. Baseline tables: strip excessive, regrant exact
-- ============================================================
REVOKE ALL ON TABLE public.profiles, public.user_progress, public.sync_queue,
  public.devices, public.auth_events FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT SELECT, INSERT ON public.auth_events TO authenticated;
GRANT INSERT ON public.auth_events TO anon;

-- ============================================================
-- 2. Academy tables: strip excessive, regrant exact
-- ============================================================
REVOKE ALL ON TABLE public.academies, public.academy_members, public.classes,
  public.class_teachers, public.class_enrollments, public.academy_audit_events,
  public.platform_owners FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.academies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.class_teachers TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.class_enrollments TO authenticated;
GRANT SELECT, INSERT ON public.academy_audit_events TO authenticated;
-- platform_owners: intentionally NO grants to anon/authenticated.

-- ============================================================
-- 3. Sequences: strip excessive, regrant USAGE only
-- ============================================================
REVOKE ALL ON SEQUENCE public.user_progress_id_seq, public.sync_queue_id_seq,
  public.auth_events_id_seq, public.academy_audit_events_id_seq
  FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SEQUENCE public.user_progress_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.sync_queue_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.auth_events_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.auth_events_id_seq TO anon;
GRANT USAGE ON SEQUENCE public.academy_audit_events_id_seq TO authenticated;

-- ============================================================
-- 4. Future defaults for objects created by postgres (fail-closed)
-- ============================================================
-- PostgreSQL semantics: FOR ROLE <creator> IN SCHEMA <schema> governs only
-- future objects created BY that role in that schema. Staging migrations run
-- as postgres, so FOR ROLE postgres is correct and sufficient. supabase_admin
-- defaults untouched (platform-managed, no authorization demonstrated).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
-- Functions need the same treatment at BOTH levels: PostgreSQL grants EXECUTE
-- ON FUNCTIONS TO PUBLIC by default (global default), and IN SCHEMA entries add
-- to rather than replace it — a schema-scoped revoke alone would still leave
-- future postgres-created functions executable via PUBLIC (hence anon and
-- authenticated). The global revoke covers objects created BY postgres only
-- (supabase_admin untouched; existing functions untouched — defaults govern
-- future objects, and §§6-7 re-grant every existing function explicitly).
-- Future functions (and extensions installed as postgres later, e.g. pgtap on a
-- fresh project) need explicit GRANT EXECUTE checks.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 5. Vulnerable RPC fix: enforce caller identity (IDOR closure)
-- ============================================================
-- get_or_create_user_progress / update_user_progress accepted arbitrary
-- p_user_id as SECURITY DEFINER running as owner (bypasses RLS), so any
-- authenticated caller could read/modify another user's row via PostgREST RPC
-- (no client .rpc() usage today, but endpoint exposed). Fix: p_user_id must
-- equal auth.uid() (ERRCODE 42501 otherwise). Signatures unchanged; direct
-- table access via service_role/postgres remains for trusted admin tooling.
CREATE OR REPLACE FUNCTION public.get_or_create_user_progress(p_user_id UUID, p_initial_state JSONB DEFAULT '{}')
RETURNS TABLE (id BIGINT, user_id UUID, state JSONB, version BIGINT, updated_at TIMESTAMPTZ)
SET search_path = public, pg_temp AS $$
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'not authorized: p_user_id must equal auth.uid()' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.user_progress (user_id, state, version)
    VALUES (p_user_id, p_initial_state, 1)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN QUERY
    SELECT up.id, up.user_id, up.state, up.version, up.updated_at
    FROM public.user_progress up
    WHERE up.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_user_progress(
    p_user_id UUID,
    p_state JSONB,
    p_expected_version BIGINT,
    p_device_id TEXT
)
RETURNS TABLE (success BOOLEAN, new_version BIGINT, current_state JSONB, current_version BIGINT)
SET search_path = public, pg_temp AS $$
DECLARE
    v_current_version BIGINT;
    v_current_state JSONB;
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'not authorized: p_user_id must equal auth.uid()' USING ERRCODE = '42501';
    END IF;
    SELECT version, state INTO v_current_version, v_current_state
    FROM public.user_progress
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.user_progress (user_id, state, version, device_id)
        VALUES (p_user_id, p_state, 1, p_device_id)
        RETURNING version, state INTO v_current_version, v_current_state;
        RETURN QUERY SELECT TRUE, v_current_version, v_current_state, v_current_version;
    END IF;

    IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
        RETURN QUERY SELECT FALSE, v_current_version, v_current_state, v_current_version;
    END IF;

    UPDATE public.user_progress
    SET state = p_state,
        version = v_current_version + 1,
        device_id = p_device_id,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING version, state INTO v_current_version, v_current_state;

    RETURN QUERY SELECT TRUE, v_current_version, v_current_state, v_current_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Function EXECUTE hardening (triggers fire as owner regardless)
-- ============================================================
REVOKE ALL ON FUNCTION public.get_or_create_user_progress(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_progress(UUID, JSONB) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_user_progress(UUID, JSONB, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_progress(UUID, JSONB, BIGINT, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

REVOKE ALL ON FUNCTION public.is_platform_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.academy_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_role(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_academy_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_academy_member(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_academy_manager(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_academy_manager(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.class_academy(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_academy(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_class_teacher(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_class_student(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_class_student(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.academy_touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_touch_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.guard_academy_member_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_academy_member_write() TO service_role;
REVOKE ALL ON FUNCTION public.guard_class_teacher_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_class_teacher_write() TO service_role;
REVOKE ALL ON FUNCTION public.guard_class_enrollment_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_class_enrollment_write() TO service_role;
REVOKE ALL ON FUNCTION public.guard_class_immutable_academy() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_class_immutable_academy() TO service_role;
REVOKE ALL ON FUNCTION public.guard_audit_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_audit_insert() TO service_role;

-- ============================================================
-- 7. Read-only post-repair verification (run after the above; expect noted)
-- ============================================================
-- 7a. RLS still enabled on all 12 tables (expect 12 rows):
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   AND tablename IN ('profiles','user_progress','sync_queue','devices',
--     'auth_events','platform_owners','academies','academy_members','classes',
--     'class_teachers','class_enrollments','academy_audit_events')
--   AND rowsecurity IS TRUE;
--
-- 7b. No excessive table privileges remain (expect 0 rows — no TRUNCATE /
-- REFERENCES / TRIGGER for anon/authenticated on any app table):
-- SELECT grantee, table_schema, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
--   AND privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER');
--
-- 7c. Exact allowed privileges per role/table (compare to §2 matrix):
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN ('profiles','user_progress','sync_queue','devices',
--     'auth_events','academies','academy_members','classes','class_teachers',
--     'class_enrollments','academy_audit_events','platform_owners')
--   AND grantee IN ('anon','authenticated')
-- ORDER BY table_name, grantee, privilege_type;
-- -- Expected: profiles/user_progress/sync_queue/devices authenticated
-- --   SELECT,INSERT,UPDATE,DELETE; auth_events authenticated SELECT,INSERT +
-- --   anon INSERT; academies authenticated SELECT,INSERT,UPDATE;
-- --   academy_members/classes authenticated SELECT,INSERT,UPDATE,DELETE;
-- --   class_teachers/class_enrollments authenticated SELECT,INSERT,DELETE;
-- --   academy_audit_events authenticated SELECT,INSERT; platform_owners 0 rows.
--
-- 7d. Sequences USAGE only, no UPDATE/SELECT (expect only USAGE rows):
-- SELECT grantee, object_name, privilege_type FROM (
--   SELECT grantee, table_name AS object_name, privilege_type
--   FROM information_schema.role_usage_grants
--   WHERE object_schema = 'public'
--   UNION ALL
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND table_name LIKE '%_id_seq'
-- ) s ORDER BY object_name, grantee;
--
-- 7e. Future postgres defaults narrowed (expect 0 rows for anon/auth):
-- SELECT defaclrole::regrole AS creator, defaclnamespace::regnamespace AS schema,
--   defaclobjtype, defaclacl FROM pg_default_acl
-- WHERE defaclnamespace = 'public'::regnamespace
--   AND defaclrole = 'postgres'::regrole
--   AND defaclacl::text LIKE ANY (ARRAY['%anon%','%authenticated%']);
-- -- NOTE: supabase_admin rows (if any) intentionally remain; do not revoke.
--
-- 7f. Progress RPCs enforce caller identity (expect both bodies contain
-- p_user_id ... auth.uid() guard):
-- SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('get_or_create_user_progress','update_user_progress')
--   AND prosrc LIKE '%p_user_id%auth.uid()%';
-- -- expect 2 rows.
--
-- 7g. Spot-check helpers still executable by authenticated (expect true):
-- SELECT has_function_privilege('authenticated',
--   'public.is_platform_owner()', 'EXECUTE');
-- SELECT has_function_privilege('anon',
--   'public.is_platform_owner()', 'EXECUTE');
-- -- expect true then false.
