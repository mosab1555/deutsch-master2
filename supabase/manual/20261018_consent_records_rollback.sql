-- Deutsch Master — consent_records rollback (forward-only migration DOWN path).
--
-- Safe reverse of supabase/migrations/20261018000000_consent_records.sql:
-- drops ONLY objects created by that migration, in reverse order
-- (trigger -> function -> policies -> table), IF EXISTS throughout.
-- Table-dependent drops are additionally guarded with to_regclass() because
-- DROP ... IF EXISTS on a missing table still fails with "relation does not
-- exist"; with the guards, a re-run (or a run after a partial/failed forward
-- application that never created the table) is a safe no-op.
--
-- ⚠ DATA-LOSS WARNING — DROP TABLE DESTROYS ALL CONSENT RECORDS.
-- The final statement drops public.consent_records together with every row
-- in it. Those rows are the append-only audit trail of students'
-- acknowledgements/withdrawals (user_id, consent_type, policy_version,
-- decision, age_band, created_at). There is no soft-delete and no archive
-- step here. A rollback after real records exist is therefore irreversible
-- and destroys consent evidence.
--
--   * Run this ONLY to undo an accidental/mistaken application, before any
--     real consent rows exist (i.e. while recording is still disabled and
--     DM_CONSENT_CONFIG is absent), or
--   * if the owner/legal counsel have explicitly decided the history may be
--     discarded (see docs/academy/ACCOUNT_DELETION_BLOCKER.md retention
--     question and docs/academy/DATA_PROCESSING_NOTICE_EGYPT.md).
--   * Before any rollback where rows may exist, export the table first:
--     COPY public.consent_records TO STDOUT WITH CSV HEADER;
--
-- NEVER touches v1 tables (profiles/user_progress/sync_queue/devices/
-- auth_events), academy tables, or auth.users. No v1/academy learner data is
-- read, written, or migrated by this script; the only data destroyed is the
-- consent history described above. Run only on the same staging project
-- where the forward migration was applied; production is untouched.

DO $$
BEGIN
  IF to_regclass('public.consent_records') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_guard_consent_insert ON public.consent_records;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.guard_consent_record_write();

DO $$
BEGIN
  IF to_regclass('public.consent_records') IS NOT NULL THEN
    DROP POLICY IF EXISTS "consent_select_own" ON public.consent_records;
    DROP POLICY IF EXISTS "consent_insert_own" ON public.consent_records;
    -- Destroys the table and ALL consent rows in it (see DATA-LOSS WARNING above).
    DROP TABLE IF EXISTS public.consent_records;
  END IF;
END $$;

-- Expected post-rollback state: no public.consent_records table, no
-- guard_consent_record_write() function, no trg_guard_consent_insert
-- trigger; v1 and academy objects unchanged.
