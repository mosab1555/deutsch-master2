# ACL Hardening Report — Deutsch Master

**Date:** 2026-10-15 (UTC) · **Repo:** `C:\Users\mosab\Desktop\deutsch-master2` · **Branch:** `main`
**Staging ref:** `uafwvkgaijmcofistjum` · **Production ref:** `bhdgpscedjowchldsjnd` (never touched)
**Discipline:** no Supabase connections/CLI, no SQL executed, no DB modifications,
no secret inspection/output, no reset/clean/stash/pop, no commit/push/deploy.
All Git changes, untracked files, backups, and audit artifacts preserved.

## 0. Summary

A read-only `pg_default_acl` query showed broad default table privileges for
`anon`/`authenticated` (roles `postgres`/`supabase_admin`, schema `public`).
Consequence: staging `academies`/`platform_owners` (and by inheritance every
new table) report `TRUNCATE, REFERENCES, TRIGGER` in addition to explicitly
granted operations. RLS is enabled but grants were not least-privilege. A
second defect: `get_or_create_user_progress` / `update_user_progress` accept
arbitrary `p_user_id` as `SECURITY DEFINER` (owner, bypasses RLS) with no
`auth.uid()` check — any authenticated caller could read/modify another
user's row via PostgREST RPC (IDOR).

Prepared (review-only, **not executed**):
- hardened future baselines (`supabase/migration.sql`, `20261015_academy_core.sql`),
- narrow RPC identity fix + tests,
- forward-only staging repair
  (`supabase/migrations/20261016_acl_hardening_repair.sql`),
- offline static ACL-matrix checks (79 + 112 assertions),
- this report. **Staging repair is prepared but not yet executed.**

## 1. Source of the broad default privileges

PostgreSQL combines (a) per-object ACLs (`relacl`) with (b) default privileges
(`pg_default_acl`: per creator-role × schema × object-type template applied to
**future** objects). The finding is (b): entries with
`defaclrole IN (postgres, supabase_admin)`, `defaclnamespace = public`,
granting to `anon`/`authenticated` broader than any migration's explicit
`GRANT` (which never mentions `TRUNCATE/REFERENCES/TRIGGER`).

Why this matters:
- `supabase/migration.sql` §10 granted only
  `SELECT,INSERT,UPDATE,DELETE` (4 baseline tables) and `SELECT,INSERT`
  (`auth_events`), yet new tables still show `TRUNCATE/REFERENCES/TRIGGER` —
  those come from (b), not from the migration text.
- `20261015_academy_core.sql` §11 granted `authenticated`-only minimal sets
  and zero grants on `platform_owners`, yet staging `academies` and
  `platform_owners` still report excessive privileges — again (b). `platform_owners`
  received **only** default privileges (migration grants none), proving (b) is
  the source.
- A bare additional `GRANT` can never remove (b); only `REVOKE` (per-object)
  plus `ALTER DEFAULT PRIVILEGES ... REVOKE` (future) narrows it. All fixes
  below are REVOKE-first.

Validated PostgreSQL default-privilege semantics (offline, from documented
syntax; live `pg_default_acl` re-query pending §7):
- `ALTER DEFAULT PRIVILEGES [FOR ROLE creator [, ...]] [IN SCHEMA s [, ...]]
  GRANT/REVOKE ... ON TABLES/SEQUENCES/FUNCTIONS` affects **only future
  objects created BY `creator` in `s`**. Omitted `FOR ROLE` means current role.
- Staging migrations run in SQL Editor **as `postgres` owner**, so
  `FOR ROLE postgres IN SCHEMA public` is the correct and sufficient future
  scope. `supabase_admin` rows are platform-managed; this task intentionally
  leaves them untouched (no authorization demonstrated, no necessity proven —
  per-object `REVOKE` already repairs existing tables regardless of which
  default installed them). Residual risk documented in §7.
- `REVOKE ALL ON TABLE` covers all seven table privileges
  (`SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER`).
  `REVOKE ALL ON SEQUENCE` covers `USAGE,SELECT,UPDATE`.
  Function default is `EXECUTE TO PUBLIC`; per-function `REVOKE/GRANT` used
  instead of changing function defaults (finding was tables/sequences only).

## 2. Intended permission matrix (derived from runtime usage + RLS)

Evidence: `client/auth.js` (profiles SELECT/UPDATE eq id, devices upsert
`onConflict(user_id,device_id)`, auth_events INSERT-only logger),
`client/cloud-sync.js` (user_progress SELECT eq user_id + upsert
`onConflict(user_id)` ×10 call sites; `sync_queue` table never touched via
PostgREST — local `dm_sync_queue` only), `client/profile.js` (profiles SELECT/
UPDATE, user_progress/devices SELECT), `client/academy-core.js` + portal
(table-by-table ops in §2 table), RLS policies in both migrations (no policy
weakened), `server/` is shop backend (no Supabase RPC).

Conventions: `authenticated` = signed-in via anon key (real boundary is RLS
own-row / academy-membership checks). `anon` = signed-out (`auth.uid()` NULL,
can never satisfy `auth.uid() = <uuid>` policies, so table grants are dead).
`service_role` = trusted operator only (key never in repo/client; BYPASSRLS).

### 2a. Baseline tables (5)

| Table | anon | authenticated | Basis |
|---|---|---|---|
| `profiles` | NONE | SELECT, INSERT, UPDATE, DELETE | auth.js/profile.js own-row SELECT/UPDATE; INSERT via `handle_new_user` trigger; DELETE per `profiles_delete_own` policy (preserved CRUD) |
| `user_progress` | NONE | SELECT, INSERT, UPDATE, DELETE | cloud-sync SELECT+upsert; academy `getStudentProgress`; DELETE per policy |
| `sync_queue` | NONE | SELECT, INSERT, UPDATE, DELETE | no PostgREST use today; CRUD preserved per own-row policies (intended queue table) |
| `devices` | NONE | SELECT, INSERT, UPDATE, DELETE | registerDevice upsert; getSyncStatus SELECT; DELETE per policy |
| `auth_events` | INSERT only | SELECT, INSERT | logAuthEvent INSERT-only (NULL user_id allowed pre-login per `auth_events_insert_own`); SELECT for authenticated own reads; never UPDATE/DELETE |

### 2b. Academy tables (7)

| Table | anon | authenticated | Basis (UI op + RLS policy) |
|---|---|---|---|
| `academies` | NONE | SELECT, INSERT, UPDATE | list/checkSetup SELECT; createAcademy INSERT; updateAcademy UPDATE (incl. archive). NO DELETE policy; no client DELETE → DELETE revoked |
| `academy_members` | NONE | SELECT, INSERT, UPDATE, DELETE | myMemberships/list SELECT; addMember INSERT; updateMemberRole/remove(status) UPDATE; DELETE per `members_delete_owner` (owner hard-delete; UI uses soft-remove) |
| `classes` | NONE | SELECT, INSERT, UPDATE, DELETE | list/myTeaching SELECT; createClass INSERT; updateClass UPDATE; DELETE per `classes_delete_owner` (UI archives) |
| `class_teachers` | NONE | SELECT, INSERT, DELETE | list/myTeaching SELECT; assign INSERT; unassign DELETE. NO UPDATE policy; no client UPDATE → UPDATE revoked |
| `class_enrollments` | NONE | SELECT, INSERT, DELETE | list SELECT; enroll INSERT; remove DELETE. NO UPDATE policy → UPDATE revoked |
| `academy_audit_events` | NONE | SELECT, INSERT | logAudit INSERT (actor=caller guard); SELECT per `audit_select_manager` (portal only INSERTs today; manager reads preserved). Append-only |
| `platform_owners` | NONE | NONE | dashboard/service_role only; boolean via `is_platform_owner()` helper |

### 2c. Sequences (4, USAGE-only; USAGE suffices for BIGSERIAL nextval)

| Sequence | anon | authenticated |
|---|---|---|
| `user_progress_id_seq` | NONE | USAGE |
| `sync_queue_id_seq` | NONE | USAGE |
| `auth_events_id_seq` | USAGE | USAGE (anon needs nextval for pre-login INSERT) |
| `academy_audit_events_id_seq` | NONE | USAGE |

No `SELECT/UPDATE` on sequences (would allow currval/setval abuse).

### 2d. Functions EXECUTE

| Function(s) | anon | authenticated | service_role | Note |
|---|---|---|---|---|
| `get_or_create_user_progress(UUID,JSONB)`, `update_user_progress(UUID,JSONB,BIGINT,TEXT)` | NONE | EXECUTE | EXECUTE | sole public RPCs; now identity-guarded (§4) |
| RLS helpers `is_platform_owner()`, `academy_role/manager/member`, `class_academy`, `is_class_teacher/student` | NONE | EXECUTE | EXECUTE | called inside RLS policies; required for policy evaluation |
| Trigger/guard helpers `handle_new_user()`, `update_updated_at_column()`, `academy_touch_updated_at()`, `guard_*` (5) | NONE | NONE | EXECUTE | never called directly; trigger firing runs as owner unaffected by revoke |

## 3. Changes to future baseline installations (`supabase/migration.sql`)

- §8: added caller-identity guard to both progress helpers
  (`IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE ... ERRCODE 42501`),
  comments note IDOR closure; signatures/search_path unchanged.
- §10 replaced (was `GRANT ... TO anon, authenticated` ×8):
  - `REVOKE ALL ON TABLE (5) FROM PUBLIC, anon, authenticated` +
    `REVOKE ALL ON SEQUENCE (3) FROM PUBLIC, anon, authenticated` first.
  - Exact re-grants per §2a/§2c (anon only `INSERT ON auth_events` + `USAGE`
    on its sequence).
  - `REVOKE/GRANT EXECUTE` per §2d (progress RPCs to authenticated+service_role;
    trigger helpers revoked from clients, kept for service_role).
  - `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON
    TABLES/SEQUENCES FROM PUBLIC, anon, authenticated` (fail-closed; explicit
    grants remain sole path). No `supabase_admin` alteration.
- One-time header, RLS policies, triggers, indexes unchanged. No policy weakened.

## 4. Changes to the academy migration (`20261015_academy_core.sql`)

- §11 replaced (was broad `GRANT ... TO authenticated` incl. spurious
  `DELETE ON academies`, `UPDATE ON class_teachers/enrollments`):
  - `REVOKE ALL ON TABLE (7 incl. platform_owners) FROM PUBLIC, anon, authenticated` +
    `REVOKE ALL ON SEQUENCE academy_audit_events_id_seq` first.
  - Exact re-grants per §2b/§2c (anon NONE; academies no DELETE; links no UPDATE).
  - `REVOKE/GRANT EXECUTE` per §2d (7 helpers to authenticated+service_role;
    6 trigger/guard helpers revoked from clients).
  - Same `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` pair; `supabase_admin` untouched.
- Tables, RLS policies (§10, 15+ CREATE POLICY incl. additive
  `progress_teacher_read`/`profiles_academy_read`), triggers/guards, helper
  bodies unchanged. No `DROP` of v1 tables; no `INSERT` into `platform_owners`;
  no hardcoded identity. Rollback file unchanged (drops in reverse, preserves v1).

## 5. New forward repair file and prerequisites

**File:** `supabase/migrations/20261016_acl_hardening_repair.sql`
(forward-only, additive; **prepared but NOT executed**).

Contents: §1 baseline REVOKE+re-grant; §2 academy REVOKE+re-grant (incl.
`platform_owners` lockdown); §3 sequences USAGE-only; §4 postgres future-default
revokes (supabase_admin untouched); §5 `CREATE OR REPLACE` both progress helpers
with identity guard; §6 all EXECUTE hardening; §7 read-only verification
SELECTs (RLS 12 rows; 0 rows TRUNCATE/REFERENCES/TRIGGER for anon/auth;
full role/table privilege dump vs §2; sequence USAGE dump; postgres `pg_default_acl`
0 rows for anon/auth with supabase_admin-note; RPC body guard 2 rows;
`has_function_privilege` spot-checks).

Prerequisites (in file header; verify before any future run):
1. Dashboard project is staging `uafwvkgaijmcofistjum`, never prod
   `bhdgpscedjowchldsjnd`. 2. Baseline + academy migrations already applied.
3. Run as `postgres` owner in SQL Editor. 4. No secrets required.
Safety: no `DROP/CREATE TABLE`, no policy/trigger/user/data changes; all
statements idempotent (`REVOKE`/`GRANT`/`ALTER DEFAULT`/`CREATE OR REPLACE`
tolerate re-run); ends with SELECTs only.

## 6. SECURITY DEFINER findings

| Function | Search_path | EXECUTE (before → after) | Identity/auth | Verdict |
|---|---|---|---|---|
| `handle_new_user()` (trigger) | `public, pg_temp` ✓ | PUBLIC → service_role only | runs on `auth.users` INSERT as owner; inserts `NEW.id` profile; not caller-controlled | SAFE (trigger-only; direct EXECUTE revoked) |
| `update_updated_at_column()` / `academy_touch_updated_at()` / `guard_class_immutable_academy()` (invoker) | `public, pg_temp` ✓ | PUBLIC → service_role only | set `NEW.updated_at`/immutability; no user param | SAFE |
| `get_or_create_user_progress(p_user_id, ...)` | `public, pg_temp` ✓ | PUBLIC → authenticated+service_role | **VULNERABLE before**: no `auth.uid()` check, owner bypasses RLS → cross-user read/create via RPC | **FIXED**: `p_user_id = auth.uid()` else 42501; no client `.rpc()` today so no behavior loss; admin via direct table retained |
| `update_user_progress(p_user_id, p_state, ...)` | `public, pg_temp` ✓ | PUBLIC → authenticated+service_role | **VULNERABLE before**: same IDOR + cross-user overwrite with version games | **FIXED**: same guard; optimistic-locking semantics unchanged for own rows |
| Academy helpers `is_platform_owner()`, `academy_role/member/manager(UUID)`, `class_academy(UUID)`, `is_class_teacher/student(UUID)` | `public, pg_temp` ✓ | PUBLIC → authenticated+service_role | derive caller from `auth.uid()`; UUID params are academy/class ids (not user ids); recursion-safe STABLE | SAFE (EXECUTE narrowed, anon removed) |
| Guards `guard_academy_member_write/teacher/enrollment/audit` | `public, pg_temp` ✓ | PUBLIC → service_role only | enforce manager tiers, no self-promotion, no self-enroll, actor=caller; called as triggers | SAFE |

No function weakened; no RLS policy changed to compensate. `is_class_student`
unused by policies (retained for completeness, same hardening).

## 7. Tests executed and what remains unverified

Executed offline (no DB, no CLI, no network):
- `node tools/test-academy-rls-static.js` → **79/79 PASS** (S1–S11 incl. new
  ACL-matrix: REVOKE-first, exact grants, no DELETE on academies, no UPDATE on
  links, audit append-only, platform_owners locked, sequences USAGE-only,
  postgres defaults revoked / supabase_admin untouched, RPC identity guards,
  EXECUTE narrowing, repair safety/prerequisites).
- `node tools/test-academy-core.js` → **112/112 PASS** (was 109; + narrowed
  matrix, RPC guard, repair-file checks; service_role check relaxed to allow
  `GRANT EXECUTE ... TO service_role` while still forbidding keys/table-grants).
- `npm test` (`tools/run-phase0-tests.js`, 33 suites) → **33/33 PASS**
  (content-quality-gate errors=0, warnings preserved; check-www-parity 11/11).

Remains UNVERIFIED (requires isolated staging, never production; not run here):
- Live `pg_default_acl` re-query (§1 template removal for postgres; supabase_admin
  residual), `relacl` dump vs §2, sequence/function privilege spot-checks
  (repair §7 queries), `SHOW search_path`/`pg_proc.proconfig` for all 17 functions.
- pgTAP `supabase/tests/academy_core_rls_test.sql` (45 assertions) whole-in-one
  as postgres in staging SQL Editor with auto-ROLLBACK (Docker/psql absent here;
  S10 reports BLOCKED as expected). Includes permission-denied (not empty) for
  anon academies / platform_owners, now also implicitly covering narrowed
  DELETE/UPDATE (future live extension: assert `throws_like %permission denied%`
  for `DELETE academies`, `UPDATE class_teachers` as authenticated).
- Trigger-firing unaffected by EXECUTE revokes (standard PG semantics; live
  insert/update smoke test pending), service_role direct-call paths, and
  `auth.users` fixture-column assumptions per STAGING_PREFLIGHT §4.

## 8. Files changed (exact)

- `supabase/migration.sql` (hardened §8 RPC guards + §10 REVOKE-first grants,
  EXECUTE, postgres defaults).
- `supabase/migrations/20261015_academy_core.sql` (hardened §11 REVOKE-first
  narrowed grants, EXECUTE, postgres defaults).
- `supabase/migrations/20261016_acl_hardening_repair.sql` (new forward repair,
  review-only).
- `tools/test-academy-rls-static.js` (new S11 ACL-matrix, 20 assertions).
- `tools/test-academy-core.js` (service_role EXECUTE allowance + 3 ACL/repair checks).
- `docs/academy/ACL_HARDENING_REPORT.md` (this file).

No other files touched; all prior Git modifications, untracked files, backups
(`*.bak`, `audit/`, `supabase/.temp/`), and reports preserved. No commits.

**Statement:** the staging repair
(`supabase/migrations/20261016_acl_hardening_repair.sql`) is **prepared but not
yet executed** — no Supabase connection made, no SQL run, no database modified.
Review §5 prerequisites + §7 verification before any future authorized run in
staging `uafwvkgaijmcofistjum` only.
