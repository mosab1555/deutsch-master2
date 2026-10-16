-- Deutsch Master — Phase 1 rollback for 20261015_academy_core.sql (STAGING ONLY).
--
-- Run in the Supabase SQL Editor as the project owner when the academy-core
-- migration must be reverted. This rollback removes ONLY objects created by
-- the academy-core migration. It NEVER touches v1 tables
-- (profiles/user_progress/sync_queue/devices/auth_events), auth.users, or
-- any learner data.
--
-- Order: policies -> triggers -> functions -> tables (reverse of creation).
-- Every statement is IF EXISTS so the script is safely re-runnable.

-- ---- 1. Drop additive policies on v1 tables (restore own-row-only) ----
DROP POLICY IF EXISTS "progress_teacher_read" ON public.user_progress;
DROP POLICY IF EXISTS "profiles_academy_read" ON public.profiles;

-- ---- 2. Drop academy policies ----
DROP POLICY IF EXISTS "academies_select_member" ON public.academies;
DROP POLICY IF EXISTS "academies_insert_platform" ON public.academies;
DROP POLICY IF EXISTS "academies_update_manager" ON public.academies;

DROP POLICY IF EXISTS "members_select_same_academy" ON public.academy_members;
DROP POLICY IF EXISTS "members_insert_manager" ON public.academy_members;
DROP POLICY IF EXISTS "members_update_manager" ON public.academy_members;
DROP POLICY IF EXISTS "members_delete_owner" ON public.academy_members;

DROP POLICY IF EXISTS "classes_select_member" ON public.classes;
DROP POLICY IF EXISTS "classes_insert_manager" ON public.classes;
DROP POLICY IF EXISTS "classes_update_manager" ON public.classes;
DROP POLICY IF EXISTS "classes_delete_owner" ON public.classes;

DROP POLICY IF EXISTS "cteacher_select_member" ON public.class_teachers;
DROP POLICY IF EXISTS "cteacher_insert_manager" ON public.class_teachers;
DROP POLICY IF EXISTS "cteacher_delete_manager" ON public.class_teachers;

DROP POLICY IF EXISTS "enroll_select_scoped" ON public.class_enrollments;
DROP POLICY IF EXISTS "enroll_insert_scoped" ON public.class_enrollments;
DROP POLICY IF EXISTS "enroll_delete_scoped" ON public.class_enrollments;

DROP POLICY IF EXISTS "audit_select_manager" ON public.academy_audit_events;
DROP POLICY IF EXISTS "audit_insert_manager" ON public.academy_audit_events;

-- ---- 3. Drop triggers ----
DROP TRIGGER IF EXISTS trg_guard_academy_members ON public.academy_members;
DROP TRIGGER IF EXISTS trg_academy_members_touch ON public.academy_members;
DROP TRIGGER IF EXISTS trg_guard_class_teachers ON public.class_teachers;
DROP TRIGGER IF EXISTS trg_guard_class_enrollments ON public.class_enrollments;
DROP TRIGGER IF EXISTS trg_guard_class_academy ON public.classes;
DROP TRIGGER IF EXISTS trg_classes_touch ON public.classes;
DROP TRIGGER IF EXISTS trg_guard_audit ON public.academy_audit_events;
DROP TRIGGER IF EXISTS trg_academies_touch ON public.academies;

-- ---- 4. Drop functions ----
DROP FUNCTION IF EXISTS public.guard_audit_insert();
DROP FUNCTION IF EXISTS public.guard_class_immutable_academy();
DROP FUNCTION IF EXISTS public.guard_class_enrollment_write();
DROP FUNCTION IF EXISTS public.guard_class_teacher_write();
DROP FUNCTION IF EXISTS public.guard_academy_member_write();
DROP FUNCTION IF EXISTS public.is_class_student(UUID);
DROP FUNCTION IF EXISTS public.is_class_teacher(UUID);
DROP FUNCTION IF EXISTS public.class_academy(UUID);
DROP FUNCTION IF EXISTS public.is_academy_manager(UUID);
DROP FUNCTION IF EXISTS public.is_academy_member(UUID);
DROP FUNCTION IF EXISTS public.academy_role(UUID);
DROP FUNCTION IF EXISTS public.is_platform_owner();
DROP FUNCTION IF EXISTS public.academy_touch_updated_at();

-- ---- 5. Drop tables (audit first, then links, then academies) ----
DROP TABLE IF EXISTS public.academy_audit_events;
DROP TABLE IF EXISTS public.class_enrollments;
DROP TABLE IF EXISTS public.class_teachers;
DROP TABLE IF EXISTS public.classes;
DROP TABLE IF EXISTS public.academy_members;
DROP TABLE IF EXISTS public.academies;
DROP TABLE IF EXISTS public.platform_owners;

-- Verification (run manually after rollback):
--   SELECT tablename FROM pg_tables WHERE schemaname='public'
--     AND tablename IN ('platform_owners','academies','academy_members',
--       'classes','class_teachers','class_enrollments','academy_audit_events');
--   -- expect 0 rows. Learner tables (profiles/user_progress/...) still exist:
--   SELECT tablename FROM pg_tables WHERE schemaname='public'
--     AND tablename IN ('profiles','user_progress','sync_queue','devices','auth_events');
--   -- expect 5 rows.
