-- Deutsch Master — Student consent records (ADDITIVE, STAGING FIRST, NOT APPLIED).
--
-- Purpose: minimal, honest groundwork for recording a student's OWN
-- acknowledgement of the privacy notice and the terms of service, with the
-- approved policy version and a server-side timestamp, under own-row RLS.
--
-- What this migration deliberately does NOT do:
--   * It does NOT implement parental/guardian consent. Egyptian PDPL
--     Executive Regulations (Decree 816/2025, arts. 14-15) require explicit
--     WRITTEN guardian consent (mechanisms subject to PDPC approval) for
--     children's data; a checkbox cannot satisfy that and no client path here
--     can produce a "verified guardian" record. Guardian consent remains an
--     academy-side written process until owner + legal counsel decide
--     otherwise (see docs/academy/DATA_PROCESSING_NOTICE_EGYPT.md).
--   * It does NOT enforce consent. No sign-in/sign-up/learning flow is gated
--     by this table; enforcement requires an owner/legal decision and is
--     disabled by default in the client (client/dm-consent.js).
--   * It does NOT store dates of birth, names, contacts, or any free text.
--     Only a nullable coarse age band is allowed, and only when a caller
--     explicitly supplies one.
--   * It does NOT alter or drop any existing table, policy, function, or
--     grant. auth.users remains the identity source; no second auth system.
--
-- How to apply (STAGING ONLY, never production before owner sign-off):
--   1. Apply supabase/migration.sql (v1) first.
--   2. Apply this file in the Staging Supabase SQL Editor (as postgres owner).
--   3. Do NOT enable client recording (DM_CONSENT_CONFIG) until legal review
--      approves the policy text/version and the recording mechanism.
--
-- Rollback: supabase/manual/20261018_consent_records_rollback.sql
--   (drops the trigger, function, policies, and table, IF EXISTS; never
--   touches auth.users or any v1/academy table). ⚠ The rollback DESTROYS
--   all consent rows (DROP TABLE, no archive step) — export first if any
--   real records may exist; see the warning in that file.
--
-- Design notes:
--   - Append-only: SELECT/INSERT policies only; no UPDATE/DELETE policy and
--     no UPDATE/DELETE grant exists, so a client can never rewrite history.
--     A withdrawal is a NEW row with decision = 'withdrawn'.
--   - The guard trigger fails closed for JWT-authenticated callers: user_id
--     must equal auth.uid() and created_at is forced to NOW() (server clock),
--     so a client cannot backdate a record or write another user's row.
--     Operator/service sessions (auth.jwt() role NULL, e.g. dashboard SQL /
--     service_role without user token) keep the legacy pass-through used by
--     the academy migrations, since their trust derives from DB credentials.
--   - Default deny: RLS enabled, REVOKE first (staging pg_default_acl may
--     grant broad defaults), then grant exactly SELECT, INSERT to
--     authenticated. No anon access, no service-path table grant needed
--     (service_role bypasses RLS by design).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. consent_records — append-only own-row consent acknowledgements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Client-insertable self-acknowledgement types ONLY. Guardian/parental
  -- consent is intentionally NOT a value here: it must not be recordable
  -- through the student's own client session.
  consent_type TEXT NOT NULL CHECK (consent_type IN ('privacy_notice','terms_of_service')),
  -- Version identifier of the approved text (owner/legal assigned); opaque
  -- here, never a legal claim by itself.
  policy_version TEXT NOT NULL CHECK (char_length(btrim(policy_version)) BETWEEN 1 AND 64),
  decision TEXT NOT NULL CHECK (decision IN ('granted','withdrawn')),
  -- Coarse, nullable, self-declared category only (no date of birth).
  -- Bands reflect the Egyptian PDPL Executive Regulations age thresholds
  -- (Decree 816/2025 arts. 14-15: under 15 / 15-18) and stay pending legal
  -- confirmation of how the platform may lawfully use them.
  age_band TEXT CHECK (age_band IS NULL OR age_band IN ('under_15','age_15_17','age_18_plus','undisclosed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_records_user
  ON public.consent_records(user_id, consent_type, created_at DESC);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Guard trigger — append-only, self-only, server timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_consent_record_write()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP <> 'INSERT') THEN
    RAISE EXCEPTION 'consent records are append-only';
  END IF;
  -- JWT-authenticated clients may only create their own row and may never
  -- choose the timestamp. Sessions without a JWT role claim (operator SQL /
  -- service_role without user token) keep the documented pass-through.
  IF auth.jwt()->>'role' = 'authenticated' THEN
    IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'consent records may only be created for the authenticated user';
    END IF;
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_consent_insert ON public.consent_records;
CREATE TRIGGER trg_guard_consent_insert
  BEFORE INSERT ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_consent_record_write();

-- ============================================================
-- 3. RLS policies — own-row SELECT and INSERT only (default deny)
-- ============================================================
DROP POLICY IF EXISTS "consent_select_own" ON public.consent_records;
CREATE POLICY "consent_select_own" ON public.consent_records
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "consent_insert_own" ON public.consent_records;
CREATE POLICY "consent_insert_own" ON public.consent_records
  FOR INSERT WITH CHECK (user_id = auth.uid());
-- No UPDATE policy and no DELETE policy: append-only by design.

-- ============================================================
-- 4. Least-privilege lockdown (REVOKE first, then exact grants)
-- ============================================================
REVOKE ALL ON TABLE public.consent_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.consent_records TO authenticated;
-- No anon grant: guests have no account and nothing to acknowledge server-side.

REVOKE ALL ON FUNCTION public.guard_consent_record_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_consent_record_write() TO service_role;

-- ============================================================
-- 5. Read-only post-apply verification (staging only; expect noted)
-- ============================================================
-- 5a. RLS enabled (expect rowsecurity = true):
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname = 'consent_records';
--
-- 5b. Exact grants (expect authenticated SELECT,INSERT only; no anon rows):
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND table_name = 'consent_records'
--   ORDER BY grantee, privilege_type;
