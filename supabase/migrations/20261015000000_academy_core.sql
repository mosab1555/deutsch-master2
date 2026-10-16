-- Deutsch Master — Phase 1 Academy Core migration (ADDITIVE, NOT applied to production).
--
-- Purpose: multi-academy foundation for academy owners/admins, teachers,
-- classes, enrollments, academy settings, and audit events — reusing the
-- existing auth.users / profiles / user_progress model from
-- supabase/migration.sql (v1). No existing table is altered destructively,
-- no existing RLS policy is dropped, no duplicate identity or second auth
-- mechanism is introduced.
--
-- How to apply (STAGING ONLY, never production in Phase 1):
--   1. Provision a fresh staging Supabase project.
--   2. Apply supabase/migration.sql (v1) first.
--   3. Apply THIS file in the Supabase SQL Editor (as postgres owner).
--   4. Provision the first platform owner per
--      docs/academy/ACADEMY_CORE_IMPLEMENTATION_REPORT.md (manual SQL with a
--      real auth.users UUID; never hard-code an identity here, never commit a
--      service_role key).
--
-- Rollback: supabase/migrations/20261015_academy_core_rollback.sql
--   (drops policies/triggers/functions/tables in reverse order, IF EXISTS).
--   Rollback does NOT touch v1 tables (profiles/user_progress/sync_queue/
--   devices/auth_events) and never deletes auth.users.
--
-- Design notes:
--   - Roles are PER-ACADEMY in academy_members (academy_owner, academy_admin,
--     teacher, student). A user may hold different roles in different
--     academies (cross-academy membership is an explicit row per academy).
--   - platform_owner is GLOBAL in platform_owners (not per-academy), managed
--     only via direct SQL / service_role in the dashboard. No client code may
--     INSERT/UPDATE/DELETE it (no policy grants it to anon/authenticated).
--   - Teachers may be assigned to MANY classes via class_teachers (not a
--     single classes.teacher_id), and students enroll via class_enrollments.
--     Removal revokes access without touching profiles or user_progress.
--   - All helper predicates are SECURITY DEFINER with fixed search_path so
--     RLS policies avoid recursion (policies call helpers; helpers read base
--     tables as owner). No policy is fail-open; default deny when unauthenticated.
--   - Privileged writes stay server-side: role-change guard + membership
--     validation triggers. Clients use only the anon/publishable key; RLS is
--     the enforcement point.

-- Required extension (already enabled by v1; harmless if present).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 0. Small updated_at helper (idempotent; v1 has its own copy)
-- ============================================================
CREATE OR REPLACE FUNCTION public.academy_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- ============================================================
-- 1. platform_owners — global platform owners (service-side managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_owners (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies granting anon/authenticated any access:
-- only the table owner / service_role (dashboard SQL, Edge Functions) may
-- read/write. Helpers below (SECURITY DEFINER) expose only a boolean.

-- ============================================================
-- 2. academies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0B1020',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_academies_touch ON public.academies;
CREATE TRIGGER trg_academies_touch
  BEFORE UPDATE ON public.academies
  FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();

-- ============================================================
-- 3. academy_members — per-academy membership + role
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_members (
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('academy_owner','academy_admin','teacher','student')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (academy_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_academy_members_user ON public.academy_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_academy_members_academy ON public.academy_members(academy_id, status);
ALTER TABLE public.academy_members ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_academy_members_touch ON public.academy_members;
CREATE TRIGGER trg_academy_members_touch
  BEFORE UPDATE ON public.academy_members
  FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();

-- ============================================================
-- 4. classes — learning groups inside one academy
-- ============================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  level TEXT CHECK (level IS NULL OR level IN ('A1','A2','B1','B2')),
  description TEXT NOT NULL DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_classes_academy ON public.classes(academy_id, archived_at);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_classes_touch ON public.classes;
CREATE TRIGGER trg_classes_touch
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();

-- ============================================================
-- 5. class_teachers — teacher-to-class assignments (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_teachers (
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON public.class_teachers(teacher_id);
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. class_enrollments — student enrollment in classes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON public.class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON public.class_enrollments(class_id);
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. academy_audit_events — sensitive admin changes (append-only for clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_audit_events (
  id BIGSERIAL PRIMARY KEY,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (char_length(btrim(action)) BETWEEN 2 AND 80),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('academy','member','class','teacher_assignment','enrollment','settings')),
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_audit_academy_time
  ON public.academy_audit_events(academy_id, created_at DESC);
ALTER TABLE public.academy_audit_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. Helper predicates (SECURITY DEFINER, recursion-safe)
-- ============================================================

-- True when the caller is a global platform owner.
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_owners po WHERE po.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Caller's active membership role in an academy (NULL when none/removed).
CREATE OR REPLACE FUNCTION public.academy_role(p_academy UUID)
RETURNS TEXT AS $$
  SELECT m.role FROM public.academy_members m
  WHERE m.academy_id = p_academy AND m.user_id = auth.uid() AND m.status = 'active'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- True when caller holds an active membership in the academy.
CREATE OR REPLACE FUNCTION public.is_academy_member(p_academy UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_members m
    WHERE m.academy_id = p_academy AND m.user_id = auth.uid() AND m.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- True for academy_owner / academy_admin / platform_owner.
CREATE OR REPLACE FUNCTION public.is_academy_manager(p_academy UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_platform_owner() OR EXISTS (
    SELECT 1 FROM public.academy_members m
    WHERE m.academy_id = p_academy AND m.user_id = auth.uid()
      AND m.status = 'active' AND m.role IN ('academy_owner','academy_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Academy id that owns a class (NULL when class unknown).
CREATE OR REPLACE FUNCTION public.class_academy(p_class UUID)
RETURNS UUID AS $$
  SELECT c.academy_id FROM public.classes c WHERE c.id = p_class LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- True when caller is assigned to the class, or manages its academy.
CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_teachers t
    WHERE t.class_id = p_class AND t.teacher_id = auth.uid()
  ) OR public.is_academy_manager(public.class_academy(p_class))
    OR public.is_platform_owner();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- True when caller is enrolled in the class.
CREATE OR REPLACE FUNCTION public.is_class_student(p_class UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments e
    WHERE e.class_id = p_class AND e.student_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- ============================================================
-- 9. Write guards (triggers; clients cannot bypass)
-- ============================================================

-- Only managers may hold privileged assignment writes; role escalation rules:
--   * granting academy_owner requires existing academy_owner or platform_owner
--   * granting academy_admin requires academy_owner or platform_owner
--   * academy_admin may grant teacher/student only
--   * NOBODY may change their own role row (prevents self-promotion)
--   * status 'removed' keeps the row for audit but revokes all access
CREATE OR REPLACE FUNCTION public.guard_academy_member_write()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
  v_is_platform BOOLEAN;
BEGIN
  v_is_platform := public.is_platform_owner();
  SELECT public.academy_role(COALESCE(NEW.academy_id, OLD.academy_id)) INTO v_caller_role;

  -- Self-modification of own membership role/status is never allowed via
  -- client writes (owners change others; platform recovery is via dashboard SQL).
  IF (TG_OP = 'UPDATE') AND (OLD.user_id = auth.uid()) AND
     (OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status) THEN
    RAISE EXCEPTION 'members cannot change their own role or status';
  END IF;

  IF (TG_OP = 'INSERT') THEN
    -- Caller must manage the academy.
    IF NOT (v_is_platform OR v_caller_role IN ('academy_owner','academy_admin')) THEN
      RAISE EXCEPTION 'only academy managers may add members';
    END IF;
    -- Privilege tiers.
    IF NEW.role = 'academy_owner' AND NOT (v_is_platform OR v_caller_role = 'academy_owner') THEN
      RAISE EXCEPTION 'only academy owners may grant academy_owner';
    END IF;
    IF NEW.role = 'academy_admin' AND NOT (v_is_platform OR v_caller_role = 'academy_owner') THEN
      RAISE EXCEPTION 'only academy owners may grant academy_admin';
    END IF;
    IF NEW.user_id = auth.uid() AND NEW.role IN ('academy_owner','academy_admin','teacher') THEN
      RAISE EXCEPTION 'members cannot grant themselves a privileged role';
    END IF;
    NEW.status := COALESCE(NEW.status, 'active');
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NOT (v_is_platform OR v_caller_role IN ('academy_owner','academy_admin')) THEN
      RAISE EXCEPTION 'only academy managers may update members';
    END IF;
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
      IF NEW.role IN ('academy_owner','academy_admin') AND
         NOT (v_is_platform OR v_caller_role = 'academy_owner') THEN
        RAISE EXCEPTION 'only academy owners may grant owner/admin roles';
      END IF;
    END IF;
    -- Never move a membership across academies via UPDATE.
    IF NEW.academy_id IS DISTINCT FROM OLD.academy_id THEN
      RAISE EXCEPTION 'academy_id is immutable; remove and re-add instead';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'user_id is immutable; remove and re-add instead';
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    -- Hard deletes of membership rows are reserved to owner-tier + platform
    -- (normal removal sets status='removed' via UPDATE, preserving audit).
    IF NOT (v_is_platform OR v_caller_role = 'academy_owner') THEN
      RAISE EXCEPTION 'only academy owners may hard-delete memberships; use status=removed';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_academy_members ON public.academy_members;
CREATE TRIGGER trg_guard_academy_members
  BEFORE INSERT OR UPDATE OR DELETE ON public.academy_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_academy_member_write();

-- Teacher assignment: assignee must hold an active teacher/admin/owner
-- membership in the class's academy; writer must manage the academy.
CREATE OR REPLACE FUNCTION public.guard_class_teacher_write()
RETURNS TRIGGER AS $$
DECLARE
  v_academy UUID;
BEGIN
  SELECT c.academy_id INTO v_academy FROM public.classes c WHERE c.id = NEW.class_id;
  IF v_academy IS NULL THEN
    RAISE EXCEPTION 'unknown class';
  END IF;
  IF NOT public.is_academy_manager(v_academy) THEN
    RAISE EXCEPTION 'only academy managers may assign teachers';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.academy_members m
    WHERE m.academy_id = v_academy AND m.user_id = NEW.teacher_id
      AND m.status = 'active' AND m.role IN ('teacher','academy_admin','academy_owner')
  ) THEN
    RAISE EXCEPTION 'assignee must be an active teacher/admin/owner of the academy';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_class_teachers ON public.class_teachers;
CREATE TRIGGER trg_guard_class_teachers
  BEFORE INSERT ON public.class_teachers
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_teacher_write();

-- Enrollment: student must hold an active student (or teacher/admin/owner —
-- staff may sit in a class) membership in the class's academy; writer must be
-- a manager of the academy or an assigned teacher of the class.
-- Self-enrollment is NOT permitted through this path (invite-code self-join,
-- when enabled, must be a separate reviewed function; Phase 1 uses
-- manager/teacher-driven enrollment of existing authenticated users).
CREATE OR REPLACE FUNCTION public.guard_class_enrollment_write()
RETURNS TRIGGER AS $$
DECLARE
  v_academy UUID;
BEGIN
  SELECT c.academy_id INTO v_academy FROM public.classes c WHERE c.id = NEW.class_id;
  IF v_academy IS NULL THEN
    RAISE EXCEPTION 'unknown class';
  END IF;
  IF NEW.student_id = auth.uid() THEN
    RAISE EXCEPTION 'self-enrollment is disabled; ask a manager or teacher to enroll you';
  END IF;
  IF NOT (public.is_academy_manager(v_academy) OR public.is_class_teacher(NEW.class_id)) THEN
    RAISE EXCEPTION 'only academy managers or assigned teachers may enroll students';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.academy_members m
    WHERE m.academy_id = v_academy AND m.user_id = NEW.student_id AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'student must be an active member of the academy first';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_class_enrollments ON public.class_enrollments;
CREATE TRIGGER trg_guard_class_enrollments
  BEFORE INSERT ON public.class_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_enrollment_write();

-- Class academy binding is immutable (prevents cross-academy moves).
CREATE OR REPLACE FUNCTION public.guard_class_immutable_academy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.academy_id IS DISTINCT FROM OLD.academy_id THEN
    RAISE EXCEPTION 'class academy_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_class_academy ON public.classes;
CREATE TRIGGER trg_guard_class_academy
  BEFORE UPDATE OF academy_id ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_immutable_academy();

-- Audit writer: actor must be the caller (or NULL for system), and caller must
-- manage the academy. Append-only for client roles (no UPDATE/DELETE).
CREATE OR REPLACE FUNCTION public.guard_audit_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actor_id IS NOT NULL AND NEW.actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'audit actor must be the caller';
  END IF;
  IF NOT public.is_academy_manager(NEW.academy_id) THEN
    RAISE EXCEPTION 'only academy managers may write audit events';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_audit ON public.academy_audit_events;
CREATE TRIGGER trg_guard_audit
  BEFORE INSERT ON public.academy_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_audit_insert();

-- ============================================================
-- 10. RLS POLICIES (default-deny; every policy requires auth.uid())
-- ============================================================

-- ---- academies ----
DROP POLICY IF EXISTS "academies_select_member" ON public.academies;
CREATE POLICY "academies_select_member" ON public.academies
  FOR SELECT USING (
    public.is_platform_owner() OR public.is_academy_member(id)
  );

DROP POLICY IF EXISTS "academies_insert_platform" ON public.academies;
CREATE POLICY "academies_insert_platform" ON public.academies
  FOR INSERT WITH CHECK (public.is_platform_owner());

DROP POLICY IF EXISTS "academies_update_manager" ON public.academies;
CREATE POLICY "academies_update_manager" ON public.academies
  FOR UPDATE USING (public.is_academy_manager(id))
  WITH CHECK (public.is_academy_manager(id));

-- No DELETE policy for client roles: archiving is via archived_at.
-- Platform hard-delete (if ever needed) is via dashboard SQL as owner.

-- ---- academy_members ----
DROP POLICY IF EXISTS "members_select_same_academy" ON public.academy_members;
CREATE POLICY "members_select_same_academy" ON public.academy_members
  FOR SELECT USING (
    public.is_platform_owner() OR public.is_academy_member(academy_id)
  );

DROP POLICY IF EXISTS "members_insert_manager" ON public.academy_members;
CREATE POLICY "members_insert_manager" ON public.academy_members
  FOR INSERT WITH CHECK (
    public.is_platform_owner() OR public.is_academy_manager(academy_id)
  );

DROP POLICY IF EXISTS "members_update_manager" ON public.academy_members;
CREATE POLICY "members_update_manager" ON public.academy_members
  FOR UPDATE USING (
    public.is_platform_owner() OR public.is_academy_manager(academy_id)
  ) WITH CHECK (
    public.is_platform_owner() OR public.is_academy_manager(academy_id)
  );

DROP POLICY IF EXISTS "members_delete_owner" ON public.academy_members;
CREATE POLICY "members_delete_owner" ON public.academy_members
  FOR DELETE USING (
    public.is_platform_owner() OR
    (public.academy_role(academy_id) = 'academy_owner')
  );

-- ---- classes ----
-- Class metadata visibility is STRICT: managers see all academy classes;
-- teachers see only assigned classes; students see only enrolled classes.
-- (No blanket same-academy read: Gate 2 requires teachers/students to be
-- scoped to assignments/enrollments.)
DROP POLICY IF EXISTS "classes_select_member" ON public.classes;
CREATE POLICY "classes_select_member" ON public.classes
  FOR SELECT USING (
    public.is_platform_owner()
    OR public.is_academy_manager(academy_id)
    OR EXISTS (SELECT 1 FROM public.class_teachers t WHERE t.class_id = classes.id AND t.teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.class_enrollments e WHERE e.class_id = classes.id AND e.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "classes_insert_manager" ON public.classes;
CREATE POLICY "classes_insert_manager" ON public.classes
  FOR INSERT WITH CHECK (public.is_academy_manager(academy_id));

DROP POLICY IF EXISTS "classes_update_manager" ON public.classes;
CREATE POLICY "classes_update_manager" ON public.classes
  FOR UPDATE USING (public.is_academy_manager(academy_id))
  WITH CHECK (public.is_academy_manager(academy_id));

DROP POLICY IF EXISTS "classes_delete_owner" ON public.classes;
CREATE POLICY "classes_delete_owner" ON public.classes
  FOR DELETE USING (
    public.is_platform_owner() OR (public.academy_role(academy_id) = 'academy_owner')
  );

-- ---- class_teachers ----
DROP POLICY IF EXISTS "cteacher_select_member" ON public.class_teachers;
CREATE POLICY "cteacher_select_member" ON public.class_teachers
  FOR SELECT USING (
    public.is_platform_owner()
    OR public.is_academy_member(public.class_academy(class_id))
    OR teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "cteacher_insert_manager" ON public.class_teachers;
CREATE POLICY "cteacher_insert_manager" ON public.class_teachers
  FOR INSERT WITH CHECK (public.is_academy_manager(public.class_academy(class_id)));

DROP POLICY IF EXISTS "cteacher_delete_manager" ON public.class_teachers;
CREATE POLICY "cteacher_delete_manager" ON public.class_teachers
  FOR DELETE USING (public.is_academy_manager(public.class_academy(class_id)));

-- ---- class_enrollments ----
-- Students see ONLY their own rows; teachers see rows of assigned classes;
-- managers see all rows of their academy.
DROP POLICY IF EXISTS "enroll_select_scoped" ON public.class_enrollments;
CREATE POLICY "enroll_select_scoped" ON public.class_enrollments
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_platform_owner()
    OR public.is_class_teacher(class_id)
    OR public.is_academy_manager(public.class_academy(class_id))
  );

DROP POLICY IF EXISTS "enroll_insert_scoped" ON public.class_enrollments;
CREATE POLICY "enroll_insert_scoped" ON public.class_enrollments
  FOR INSERT WITH CHECK (
    public.is_academy_manager(public.class_academy(class_id))
    OR public.is_class_teacher(class_id)
  );

DROP POLICY IF EXISTS "enroll_delete_scoped" ON public.class_enrollments;
CREATE POLICY "enroll_delete_scoped" ON public.class_enrollments
  FOR DELETE USING (
    public.is_academy_manager(public.class_academy(class_id))
    OR public.is_class_teacher(class_id)
  );

-- ---- academy_audit_events (append-only for clients) ----
DROP POLICY IF EXISTS "audit_select_manager" ON public.academy_audit_events;
CREATE POLICY "audit_select_manager" ON public.academy_audit_events
  FOR SELECT USING (
    public.is_platform_owner() OR public.is_academy_manager(academy_id)
  );

DROP POLICY IF EXISTS "audit_insert_manager" ON public.academy_audit_events;
CREATE POLICY "audit_insert_manager" ON public.academy_audit_events
  FOR INSERT WITH CHECK (
    public.is_platform_owner() OR public.is_academy_manager(academy_id)
  );

-- ---- user_progress: ADDITIVE teacher/manager read (own-row policies stay) ----
DROP POLICY IF EXISTS "progress_teacher_read" ON public.user_progress;
CREATE POLICY "progress_teacher_read" ON public.user_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.class_enrollments e
      JOIN public.class_teachers t ON t.class_id = e.class_id
      WHERE e.student_id = user_progress.user_id
        AND t.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.academy_members sm
      JOIN public.academy_members vm ON vm.academy_id = sm.academy_id
      WHERE sm.user_id = user_progress.user_id
        AND sm.status = 'active'
        AND vm.user_id = auth.uid()
        AND vm.status = 'active'
        AND vm.role IN ('academy_owner','academy_admin')
    )
    OR public.is_platform_owner()
  );

-- ---- profiles: ADDITIVE same-academy read (own-row policies stay) ----
DROP POLICY IF EXISTS "profiles_academy_read" ON public.profiles;
CREATE POLICY "profiles_academy_read" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.academy_members me
      JOIN public.academy_members other ON other.academy_id = me.academy_id
      WHERE me.user_id = auth.uid() AND me.status = 'active'
        AND other.user_id = profiles.id AND other.status = 'active'
    )
    OR public.is_platform_owner()
  );

-- ============================================================
-- 11. GRANTS (least-privilege; RLS remains the boundary)
-- ============================================================
-- ACL HARDENING (2026-10-15): staging pg_default_acl gave newly created
-- academy tables broad defaults (TRUNCATE, REFERENCES, TRIGGER for
-- anon/authenticated). A bare GRANT cannot remove those — REVOKE first, then
-- grant only the exact operations verified against client/academy-core.js and
-- the RLS policies in §10 (no policy weakened to compensate):
--   academies: SELECT (listAcademies/checkSetup) + INSERT (createAcademy) +
--     UPDATE (updateAcademy incl. archived_at); NO DELETE policy exists
--     (archiving via UPDATE) and no client DELETE — DELETE revoked.
--   academy_members: SELECT (myMemberships/listMembers) + INSERT (addMember)
--     + UPDATE (updateMemberRole/removeMember via status) + DELETE (owner
--     hard-delete per members_delete_owner policy; UI uses soft-remove).
--   classes: SELECT (listClasses/myTeachingClasses) + INSERT (createClass) +
--     UPDATE (updateClass) + DELETE (owner hard-delete per
--     classes_delete_owner policy; UI archives instead).
--   class_teachers: SELECT (listClassTeachers/myTeachingClasses) + INSERT
--     (assignTeacher) + DELETE (unassignTeacher); NO UPDATE policy and no
--     client UPDATE — UPDATE revoked.
--   class_enrollments: SELECT (listEnrollments) + INSERT (enrollStudent) +
--     DELETE (removeEnrollment); NO UPDATE policy and no client UPDATE.
--   academy_audit_events: INSERT (logAudit, actor must equal caller per
--     guard_audit_insert) + SELECT (manager reads per audit_select_manager
--     policy; portal currently only INSERTs); append-only, no UPDATE/DELETE.
--   platform_owners: NO grants to anon/authenticated (dashboard/service_role
--     only; helpers expose boolean via is_platform_owner()).
-- Academy data is NEVER exposed to anon: only authenticated (RLS enforced).
--
-- 11a. Strip inherited/default excessive privileges first (ALL covers
-- SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER).
REVOKE ALL ON TABLE public.academies, public.academy_members, public.classes,
  public.class_teachers, public.class_enrollments, public.academy_audit_events,
  public.platform_owners FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.academy_audit_events_id_seq FROM PUBLIC, anon, authenticated;

-- 11b. Exact required operations (authenticated only; anon NONE by design).
GRANT SELECT, INSERT, UPDATE ON public.academies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.class_teachers TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.class_enrollments TO authenticated;
GRANT SELECT, INSERT ON public.academy_audit_events TO authenticated;
-- No grants on platform_owners to anon/authenticated (dashboard-only).
GRANT USAGE ON SEQUENCE public.academy_audit_events_id_seq TO authenticated;

-- 11c. RPC EXECUTE (least-privilege; RLS helpers must stay executable).
-- Helper predicates are called inside RLS policies: revoke PUBLIC/anon, keep
-- authenticated (+ explicit service_role for trusted tooling).
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
-- Trigger/guard helpers are never called directly: no client EXECUTE.
-- (Trigger firing runs as owner and is unaffected by these revokes.)
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

-- 11d. Future defaults for objects created by postgres in public (fail-closed).
-- Same PostgreSQL semantics as baseline §10d: only future objects created BY
-- postgres in public are affected (migrations run as postgres). Explicit
-- per-table GRANTs above remain the only access path. supabase_admin
-- defaults are platform-managed and intentionally untouched.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
