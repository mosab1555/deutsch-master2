-- Deutsch Master — Academy membership NULL-membership hardening.
--
-- SCOPE: staging-first review. Do NOT apply to production without the full
-- 52-test pgTAP suite passing on staging plus the static validator.
-- This migration ONLY replaces guard_academy_member_write(). It does not
-- create/drop tables, policies, triggers, or other functions, and it does not
-- alter grants beyond restating the existing guard EXECUTE grants.
-- DOWN path (if ever needed): re-apply the function body from
-- supabase/migrations/20261015_academy_core.sql lines 252-313 verbatim.
--
-- WHY: academy_role() returns NULL for callers with no membership row, so
-- every NOT (... OR NULL) gate in the previous body evaluated to NULL and was
-- silently skipped for member-less callers (outsider self-insert as student
-- passed the trigger and relied on RLS alone). The block below fails those
-- callers closed at the trigger layer, for INSERT, UPDATE and DELETE alike.
--
-- PRESERVED FLOWS (verified by design, must stay green in the suite):
--   * platform owners (with or without academy membership) via v_is_platform;
--   * member writers (owner/admin/teacher/student) — v_caller_role NOT NULL;
--   * JWT-less operator/service sessions (direct dashboard SQL, secret-key
--     admin without user token): auth.uid() NULL and no authenticated JWT
--     role claim, so the legacy pass-through applies; their trust derives
--     from database credentials / the service key, and RLS does not
--     constrain owners/bypass roles anyway.
-- TRUST ASSUMPTIONS (explicit): auth.uid()/auth.jwt() are the documented
-- Supabase JWT accessors (RLS reference); the 'role' JWT claim follows the
-- documented request-to-role mapping. Whether auth.jwt() yields NULL or '{}'
-- when unset does not change the outcome below (NULL->>'role' and
-- '{}'->>'role' are both NULL, hence never 'authenticated'). No
-- session_user/current_user name matching is used: pooler login names vary
-- by connection method, so name allowlists are brittle by design.

CREATE OR REPLACE FUNCTION public.guard_academy_member_write()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
  v_is_platform BOOLEAN;
BEGIN
  v_is_platform := public.is_platform_owner();
  SELECT public.academy_role(COALESCE(NEW.academy_id, OLD.academy_id)) INTO v_caller_role;

  -- Fail closed for JWT-authenticated callers with no membership row in this academy.
  -- Without this, a NULL v_caller_role makes every NOT (... OR NULL) gate below
  -- evaluate to NULL and silently skip, so a member-less caller would pass the
  -- trigger and rely on RLS alone (e.g. outsider self-insert as student).
  -- Platform owners pass via v_is_platform. The denial is keyed ONLY to the
  -- verified JWT role claim (auth.jwt()->>'role' = 'authenticated'): a
  -- service_role JWT with a non-NULL subject must not trigger this path, and
  -- auth.uid() alone is never sufficient to deny. Sessions without any JWT
  -- (direct operator SQL: auth.jwt()->>'role' IS NULL) keep the pre-existing
  -- pass-through: their trust derives from database credentials / the service
  -- key, not from membership rows.
  IF NOT v_is_platform AND v_caller_role IS NULL
     AND (auth.jwt()->>'role' = 'authenticated') THEN
    RAISE EXCEPTION 'no academy membership; operation not permitted';
  END IF;

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

-- Restate the existing guard EXECUTE grants (unchanged semantics: trigger
-- firing runs as owner regardless; direct invocation stays service_role-only).
REVOKE ALL ON FUNCTION public.guard_academy_member_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_academy_member_write() TO service_role;
