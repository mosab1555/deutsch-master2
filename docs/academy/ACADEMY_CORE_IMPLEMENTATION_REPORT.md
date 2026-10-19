# Academy Core Implementation Report — Phase 1 Multi-Academy Vertical Slice

**Date:** 2026-10-15 (UTC) · **Repo:** `C:\Users\mosab\Desktop\deutsch-master2` · **Branch:** `main`
**Base HEAD at start:** `3d26062` (local `main` 2 ahead of `origin/main` `7dbd6fc`: `8dda233`, `3d26062`)
**Basis:** `docs/academy/PLATFORM_READINESS_AUDIT.md` + `docs/academy/PHASE0_IMPLEMENTATION_REPORT.md` (read, never modified)
**Discipline:** no `git reset/clean/stash`, no staging/commits/pushes/deploys, no content-bank regeneration,
no production Supabase changes, no secret exposure. All Phase 0 work preserved
(audit reports, review packet, CI, privacy/terms, remediation commits).
Learner experience untouched except two verified additive integrations
(`acad_*` honesty wording + 17 portal i18n keys; `sw.js` v59 precache).

---

## 0. Gate 0 — repository state (recorded before and after)

**Before (start):**
- Branch `main`, HEAD `3d26062`, `origin/main` `7dbd6fc` (local ahead by 2).
- Tracked modifications (12 files, Phase 0 scoped): `client/academy.html`, `client/index.html`,
  `client/study.js`, `client/sw.js`, `package.json`, `tools/e2e.js`, `tools/test-flashdir.js`,
  `tools/test-upgrade.js`, plus `www/` mirrors.
- Untracked: 65 pre-existing files (audit CSVs/scripts, tools, `docs/academy/`, `.github/workflows/ci.yml`,
  `client/privacy.html`, `client/terms.html`, etc.) — all preserved, none deleted.

**After (end, uncommitted per tasking):**
- Modified tracked: the same 12 Phase 0 files **plus** Phase 1 scope only:
  `client/academy.html` (portal nav + 6 portal sections + 2 script tags),
  `client/study.js` (Phase 1 honesty wording of existing `acad_*` keys; key count unchanged by this edit),
  `client/sw.js` (`v58→v59` + precache `academy-core.js`/`academy-portal.js`),
  `package.json` (added `test:academy` script only),
  `tools/check-translations.js` (merge `academy-portal.js` i18n like labsx/adv — harness update, no relaxation),
  `www/` mirrors of the above via `npm run www` (reviewed, backups intact).
- New files (uncommitted): `supabase/migrations/20261015_academy_core.sql`,
  `supabase/migrations/20261015_academy_core_rollback.sql`,
  `client/academy-core.js`, `client/academy-portal.js`,
  `client/academy-portal.js` i18n block (17 keys × AR/EN/DE),
  `tools/test-academy-core.js`, `www/academy-core.js`, `www/academy-portal.js`, this report.
- No commits, pushes, or deploys performed. Working tree preserved for review.

---

## 1. What is implemented (traceable UI → data)

**Data model (additive SQL, staging-only):** `supabase/migrations/20261015_academy_core.sql`
- Reuses `auth.users`, `profiles`, `user_progress` (no duplicate identity, no second auth).
- New: `platform_owners` (global, dashboard-SQL only, **no** anon/authenticated policies),
  `academies` (name/slug/description/logo/primary_color/settings/archived_at),
  `academy_members` (`academy_id,user_id` PK; role `academy_owner|academy_admin|teacher|student`; status `active|removed`),
  `classes` (academy-scoped, level A1–B2, archived_at), `class_teachers` (many-to-many assignments),
  `class_enrollments` (class↔student), `academy_audit_events` (append-only for clients).
- Cross-academy membership is an explicit row per academy (a user may be owner in A, student in B).
- Guards (triggers, server-side): `guard_academy_member_write` (tiered grants, self-promotion block,
  immutable academy/user ids), `guard_class_teacher_write` (assignee must be active teacher/admin/owner),
  `guard_class_enrollment_write` (manager-or-assigned-teacher enrollment; **self-enrollment disabled**;
  student must be academy member first), `guard_class_immutable_academy`, `guard_audit_insert`.
- RLS (default-deny, `auth.uid()` everywhere, recursion-safe `SECURITY DEFINER` helpers with fixed
  `search_path`): owners manage own academy only; admins within academy only (cannot grant owner/admin);
  teachers see **assigned classes only** + students of those classes; students see **enrolled classes only**
  + own progress; managers + assigned teachers read enrollments; audit readable by managers;
  additive `progress_teacher_read` (teacher-of-class OR academy manager) and `profiles_academy_read`
  (same-academy) on top of untouched own-row policies. Grants to `authenticated` only (never `anon`
  for academy tables); **no** grants on `platform_owners`.

**Client (no learner regression):**
- `client/academy-core.js` — pure authz (`canManageAcademy/canGrantRole/canManageClass/canViewClass/canViewStudent/canEnroll`,
  self-grant denial), validation (academy/class/slug/UUID), honest progress aggregation
  (`aggregateProgress`: totals/accuracy/mistakes/due/weekly from `user_progress.state` only; `hasData:false`
  + zeros when missing; never grades/attendance/engagement), and bounded Supabase layer
  (pagination `PAGE_SIZE 20 / MAX 50`, `ilike` search, `SETUP_REQUIRED/DENIED/NOT_AUTH/VALIDATION` codes).
- `client/academy-portal.js` — academy.html-only UI (inert on index.html): setup banner
  (migration-missing vs ready), "copy my User ID" helper, academy selector + role pill,
  overview (counts), settings (rename/desc/color/archive), teachers/members (search/paginate/add-by-UUID/
  role-change/remove→`removed`), classes (search/paginate/create/edit/archive + per-class teacher assignment),
  enrollment (class picker + enroll-by-UUID + remove-from-class), teacher dashboard (assigned classes,
  ≤10 students/page, per-student real summaries + detail of last 8 attempts, explicit empty/denied states).
  Every button wired; writes disabled with honest status when DB unconfigured. RTL + existing CSS reused.
- `client/academy.html` — portal nav group placed **after** the mandated 10-item learning spine
  (preserves `test-howto` head order), 6 new `page-*` sections, 17 new `data-i18n` keys.
  Learner pages/sections/scripts byte-identical otherwise. `index.html` never loads portal code.

**Enrollment lifecycle (Gate 5):**
- Invitation/email inspection: client has Email/OTP/magic-link/password-reset (`auth.js`) but **no**
  invitation system; server `mail.js` is shop-scoped; Supabase `auth.admin.inviteUserByEmail` needs
  `service_role` + SMTP + Edge Function — none configured. Therefore Phase 1 does **not** simulate
  delivery. Secure alternative: manager/teacher enrolls an **existing authenticated user by UUID**
  (portal shows "copy my User ID"; out-of-band exchange via WhatsApp/in-person documented in-UI).
- Removal from class = `DELETE class_enrollments` row; removal from academy = `status='removed'`
  (preserves row for audit). Both revoke access without touching `profiles`/`user_progress`
  (account + history intact). No permanent account deletion anywhere (placeholder toast preserved).

**Out of scope (not built):** payments/subscriptions, certificates, custom domains, full redesign,
bulk content generation, teacher auto-approval, prod migrations/deploys — none present, none claimed.

---

## 2. What passed locally (evidence, not claims)

- **`npm run www` + `check-www-parity`: PASS** — 412/412 files, 140 lazy PACKS, 108 SW refs (incl. 2 new).
- **`npm test` (33 suites): 33/33 PASS, exit 0** (final run after all changes):
  audit-curriculum, smoke-curriculum, test-progress, test-upgrade, test-robustness, check-links,
  test-career, test-sw-update, check-testplan, **test-howto 68/68** (fixed by nav placement),
  test-auth-identity(node), test-content-remediation, content-quality-gate, test-assess,
  test-content-merge, test-manifest, test-lazy-packs, test-full-load, validate-sent-refs(500),
  check-www-parity, qa-audit, test-smart, test-search, test-quiz-shuffle, test-adv, test-push,
  test-labsx, test-flashdir, test-languages, **check-translations PASS** (865 keys × AR/EN/DE parity,
  364 data-i18n keys, both shells keyed — fixed by portal i18n block + harness merge),
  check-reference, check-ref-dups, e2e 51/51.
- **`npm run test:academy` (new, 109 checks): PASS** — two-academy fixtures (A/B, owners/admins/
  teachers/students/outsider): owner/admin own-academy-only, teacher assigned-only, student
  enrolled-only + self-only progress, cross-academy denial, tiered grants, self-promotion blocked,
  class lifecycle validation, enrollment→view→removal→denied, aggregation accuracy (4 attempts →
  75%), empty states, migration safety (no service grants/keys/hardcoded identity, no learner-table
  drops, `auth.uid()` policies, authenticated-only grants), UI wiring (all 6 sections + banner +
  scripts; learner index.html clean; SW precache), learner non-interference.
- **`content-quality-gate`: `errors=0 warnings=1913` preserved** (verified `errors=0 warnings=1913`;
  default mode, never `--strict`). No source correction; count unchanged.
- **Two pre-existing failures found during Phase 1, both caused by Phase 1 additions and repaired
  with evidence (not suppressed):** `test-howto` head-order (portal nav moved after spine) and
  `check-translations` uncovered chrome (portal i18n block + harness merge). Both green on rerun.

---

## 3. What still needs database configuration (setup status, not success)

- The migration has **not** been applied anywhere (not even staging — no DB access in this environment).
  Until applied, the portal correctly shows *"Academy database is not configured yet"* and disables writes.
- To activate (staging project only): apply `supabase/migration.sql` (v1) → apply
  `supabase/migrations/20261015_academy_core.sql` in SQL Editor as owner → provision first platform
  owner (below) → create academy (as platform owner) → add managers/teachers/students by UUID →
  create classes → assign teachers → enroll students → verify teacher dashboard.
- Email invitations remain unconfigured (SMTP + `auth.admin.inviteUserByEmail` Edge Function).
  Phase 1 uses UUID enrollment; invite-by-email is a documented future step, not simulated.

---

## 4. What has NOT been tested against production (explicit)

- **Database-level isolation is NOT production-verified.** RLS/triggers passed static review +
  pure-logic tests (109 checks) but were never fired against a live Supabase (no local Supabase env
  in repo, no staging project provisioned here). Do not cite as production-verified.
- **Not executed:** remote GitHub Actions runs (no push allowed), Chrome-gated suites
  (`--cdp`, `runtime-qa`, DOM harnesses), real-device passes (TTS/mic/PWA-install), native builds,
  production Pages behavior, screen-reader audit, Supabase staging round-trips, load/security pen-tests.
- Linguistic quality unchanged: 150,000 sentences `unreviewed / approved: 0`; B2 thin; 10,000 `lx*`
  exam shells still question-less (runtime exams assembled from pools). Nothing claimed otherwise.

---

## 5. First platform owner provisioning (secure, no hard-coding)

1. In Supabase Dashboard → Authentication, create (or identify) the owner's login user; copy its
   `auth.users.id` UUID (never commit it, never email it insecurely).
2. In SQL Editor (as `postgres`, staging project), run:
   `INSERT INTO public.platform_owners (user_id) VALUES ('<PASTE-UUID>');`
3. Verify: `SELECT * FROM public.platform_owners;` (expect 1 row) and confirm the owner can
   `INSERT INTO academies` while a non-owner cannot (expect RLS denial).
4. Add a second owner the same way (recovery), then create the first academy and grant its
   `academy_owner` via `academy_members`. Never place `service_role`/`sb_secret` in
   `client/`, `www/`, or any committed file (verified absent by tests).

## 6. Rollback strategy

- Run `supabase/migrations/20261015_academy_core_rollback.sql` as owner (idempotent `IF EXISTS`):
  drops additive policies on v1 tables → academy policies → triggers → functions → tables
  (`audit → enrollments → teachers → classes → members → academies → platform_owners`).
- It never touches `profiles/user_progress/sync_queue/devices/auth_events` or `auth.users`.
- Verify: academy tables count 0; learner tables count 5. Client rollback = redeploy prior SHA
  (portal files are additive; learner works with or without them). No data migration to reverse
  because nothing was applied to production.

## 7. Local setup & staging integration

```
# 0. Prerequisites: Node 20+ (repo uses stdlib-only scripts; no npm install needed for tests)
git status --short --branch   # confirm clean review state; do NOT reset/clean/stash

# 1. Static checks (no DB needed)
node tools/test-academy-core.js   # 109 checks, exit 0
node tools/check-www-parity.js    # 11 checks after any client/* edit
npm test                          # 33 suites (includes parity + quality gate errors=0)

# 2. Serve locally (two terminals or one static server rooted at repo)
npx serve .                       # or: python3 -m http.server 5500
# open http://127.0.0.1:5500/client/academy.html  (portal; shows setup status until DB ready)
# open http://127.0.0.1:5500/client/index.html    (learner; unchanged)

# 3. Staging Supabase (owner only, never production in Phase 1)
# 3a. New staging project → SQL Editor → run supabase/migration.sql (v1)
# 3b. Run supabase/migrations/20261015_academy_core.sql
# 3c. Provision platform owner per §5; set Auth URL allowlist to staging + Pages URLs
# 3d. Paste staging URL + publishable key into a LOCAL-ONLY client/supabase-config.js
#     (never commit keys beyond the existing publishable placeholder pattern)
# 3e. Reload academy.html → banner turns green → exercise §3 flows with 2 test academies
```

## 8. Files changed / created (review checklist)

- Modified: `client/academy.html`, `client/study.js` (honesty wording only), `client/sw.js` (v59),
  `package.json` (`test:academy`), `tools/check-translations.js` (portal merge),
  `www/` mirrors (via `npm run www`, backups preserved).
- Created: `supabase/migrations/20261015_academy_core.sql`,
  `supabase/migrations/20261015_academy_core_rollback.sql`,
  `client/academy-core.js`, `client/academy-portal.js`,
  `tools/test-academy-core.js`, this report (+ `www/` copies of the two portal JS files).
- Untouched: all content banks, `script.js`, `progress.js`, `cloud-sync.js`, `auth.js`,
  `app-init.js`, `profile.js`, learner `index.html` behavior, guest isolation, sync merge.

---

## Readiness decision: READY WITH BLOCKERS (do not pilot as SaaS yet)

Phase 1 objectives are met: additive academy data model with strict tenant RLS design, functional
admin + teacher portal wired to real operations with honest setup/empty/denied states, UUID-based
enrollment without fake invitations, 109 permission tests + 33/33 regression green, learner
unregressed, 1913 warnings preserved, working tree uncommitted.

**Exact remaining blockers:**
1. Staging Supabase not provisioned; migration never applied/fired — DB isolation unproven live.
2. First platform owner not provisioned (needs owner UUID + staging SQL per §5).
3. Email-invite backend outstanding (SMTP + Edge Function) — UUID flow is the interim.
4. Teacher review of content (0/200 packet rows) + legal sign-off on privacy/terms placeholders.
5. Remote CI + Chrome-gated + real-device validation never run (no push allowed here).
6. No production migration/deploy performed or authorized in this phase.

Next: owner provisions staging + runs §7 end-to-end with two test academies; engineering holds new
features until staging RLS fire-tests + teacher sign-off return green.
