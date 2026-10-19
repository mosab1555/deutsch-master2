-- Deutsch Master — Academy progress-link tables (ADDITIVE, STAGING ONLY).
--
-- Purpose: explicit one-time linking between a Staging Academy membership
-- (academy_members.user_id, a Staging auth.users UUID) and a Production
-- learner account (a Production auth.users UUID), so an assigned teacher can
-- read real learner progress through the server-side progress bridge.
--
-- How to apply (STAGING ONLY, never production):
--   1. Apply supabase/migration.sql (v1) first.
--   2. Apply supabase/migrations/20261015000000_academy_core.sql second.
--   3. Apply THIS file in the Staging Supabase SQL Editor (as postgres owner).
-- The Production project needs NO migration for this feature: its bridge
-- reads the existing user_progress table. Never copy user_progress rows
-- between projects; links are explicit per-student consent records.
--
-- Design notes:
--   - Raw link codes are NEVER stored: only SHA-256 code_hash, association,
--     creator, expiry, and redemption state. Raw codes exist only in the
--     one-time manager display and the student's redeem input.
--   - Production and Staging Auth UUIDs are never assumed equal. The mapping
--     below is the ONLY join between the two identity namespaces.
--   - All reads/writes go through Edge Functions using the service_role key
--     from function secrets. RLS is default-deny with NO policies granting
--     anon/authenticated any access (same lockdown as platform_owners), so a
--     browser client can never read codes, hashes, or mappings directly.
--   - Link lifecycle events are recorded in these tables' own columns
--     (created_by/redeemed_at/revoked_at). The shared academy_audit_events
--     table is NOT written from service paths because guard_audit_insert()
--     requires a JWT caller (auth.uid()) who is an academy manager; manager
--     UI actions additionally call the existing client logAudit() with the
--     manager session (entity_type 'member').
--   - Rollback: DROP TABLE IF EXISTS public.academy_prod_links,
--     public.academy_link_codes (in that order; CASCADE unnecessary, no other
--     objects reference them). Never touches v1 tables or auth.users.
--
-- Required extension (already enabled by v1; harmless if present).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. academy_link_codes — single-use short-lived link codes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_link_codes (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE CHECK (char_length(btrim(code_hash)) = 64),
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
  redeemed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_link_codes_student
  ON public.academy_link_codes(academy_id, student_user_id, created_at DESC);
ALTER TABLE public.academy_link_codes ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies granting anon/authenticated any access:
-- only the table owner / service_role (Edge Functions) may read/write.
-- UI access goes through the academy-link-codes function (manager session).

-- ============================================================
-- 2. academy_prod_links — explicit Staging↔Production account mappings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_prod_links (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  staging_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prod_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
-- One active mapping per Staging student (globally): prevents duplicate
-- active mappings for the same Academy membership identity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_prod_links_active_student
  ON public.academy_prod_links(staging_user_id) WHERE status = 'active';
-- One active mapping per Production account per academy: prevents one
-- learner account silently serving two memberships in the same academy.
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_prod_links_active_prod
  ON public.academy_prod_links(academy_id, prod_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_academy_prod_links_academy
  ON public.academy_prod_links(academy_id, status);
ALTER TABLE public.academy_prod_links ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies granting anon/authenticated any access:
-- only the table owner / service_role (Edge Functions) may read/write.

-- ============================================================
-- 3. Least-privilege lockdown (REVOKE first, then no grants to clients)
-- ============================================================
-- Staging pg_default_acl may grant broad defaults to new tables; strip them
-- first (same pattern as the ACL hardening repair). No GRANT to anon or
-- authenticated follows: browser clients must use the Edge Functions.
REVOKE ALL ON TABLE public.academy_link_codes, public.academy_prod_links
  FROM PUBLIC, anon, authenticated;
