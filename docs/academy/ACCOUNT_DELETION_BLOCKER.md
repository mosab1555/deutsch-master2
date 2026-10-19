# Account Deletion — Explicit Blocker Report (Phase 0)

**Status:** BLOCKED — safe in-app account deletion cannot be completed without owner configuration and a staging environment. No code change in this phase pretends otherwise.
**Date:** 2026-10-15 · **HEAD:** `3d26062` · **Scope:** `docs/academy/PHASE0_IMPLEMENTATION_REPORT.md §5`

## 1. Current behavior (verified)

- The profile page delete button (`client/profile.js:221 deleteAccountBtn`, handler `:255-259`) shows a confirmation dialog and then an honest toast: account deletion "requires additional setup in Supabase Dashboard". It deletes nothing — neither local nor cloud data.
- Local wipe IS available and works: settings → "مسح كل البيانات" clears device storage only. It is labeled as local deletion, not account deletion.
- Guest progress and authenticated progress are separated per account id (`client/script.js:1449 dmStateKey`, `client/app-init.js:994-1046`, `client/cloud-sync.js:28-40` generation guards). Any deletion design must preserve this separation: deleting account A must never touch account B's rows or the guest snapshot.

## 2. Why safe deletion is impossible with the current architecture (evidence)

1. **Deleting the login itself requires privilege the browser must never hold.** Removing the `auth.users` row (the actual account) is a Supabase Auth admin operation: it requires the `service_role` key. The browser ships only the publishable key by design (`client/supabase-config.js:1-17`, prohibition comment `:7-9`). A grep over `client/*.js` finds `service_role|sb_secret` only in that prohibition comment — introducing the key client-side would let anyone delete or impersonate any user. Forbidden.
2. **RLS cannot substitute.** Row Level Security policies (`supabase/migration.sql:93-159`) govern the public tables only; no policy can delete from the `auth` schema, and the app's grants (`:282-290`) intentionally exclude it.
3. **No server-side infrastructure exists in this repo.** `supabase/` contains only `migration.sql` + gitignored `.temp/` — zero Edge Functions. `server/` is an unrelated marketplace backend, never deployed to Pages (`.github/workflows/deploy.yml:36-39` uploads `./client` only), and wiring it to auth deletion would be a new product, not a fix.
4. **Cascade behavior is known and must be disclosed, not guessed.** Per `supabase/migration.sql:12,26,42,60,75`: deleting `auth.users` would CASCADE to `profiles`, `user_progress`, `sync_queue`, `devices`, while `auth_events` rows are kept with `user_id` set to NULL. So: learning data auto-cleans, login-audit entries remain anonymously. Any future flow must state exactly this.

## 3. What "done correctly" requires (owner tasks, in order)

1. **Supabase Edge Function `delete-account`** (Deno, `service_role` from function secrets — never in `client/` or `www/`):
   - Verify the caller's JWT on the server (`supabase.auth.getUser(jwt)`), operate ONLY on `user.id === caller.id` (plus an explicit typed confirmation, e.g. password re-entry or confirmation token, to satisfy the explicit-confirmation requirement).
   - Call Auth admin delete for that id; rely on the CASCADEs above; return a per-table deletion receipt (counts from `user_progress/sync_queue/devices/profiles`) plus the explicit note that anonymized `auth_events` remain.
   - Never accept a raw user id parameter; never run with the anon key; rate-limit per user.
2. **Client wiring (only after 1):** replace the placeholder toast with: confirm dialog → `functions.invoke('delete-account')` → on success clear local per-uid keys + snapshot → show receipt; on ANY failure show failure (never false success) and keep data intact.
3. **Configuration:** `SUPABASE_SERVICE_ROLE_KEY` set as a function secret (dashboard/CLI, never committed); function URL allowlisted; production deploy is a separate signed step.
4. **Staging validation (mandatory before production):** create two staging users A+B plus guest data → delete A → assert: A login gone, A's `user_progress/sync_queue/devices/profiles` rows gone, B rows byte-identical, guest snapshot intact, `auth_events` for A anonymized-not-attributed, double-delete returns clean not-found (no false success), expired/invalid JWT rejected.
5. **Docs:** update `client/privacy.html` deletion section (remove the "not available" note, state exactly what is deleted vs retained) and record retention owners.

## 4. What was deliberately NOT done

- No client-side "delete" that only clears `localStorage` (explicitly rejected by the phase requirements as a false substitute).
- No `service_role` key added anywhere; no production data touched; no functions deployed; no RLS/migration changes.
- The placeholder toast is preserved unchanged so no user is misled in the meantime.

## 5. Recommendation

Keep this BLOCKED until owner provisions a staging Supabase project and approves the Edge Function design above. Estimated build+validation once unblocked: small (one function + client wiring + staging E2E), but it must not be improvised without staging.

---

## Update 2026-10-18 (C4 session) — local preparation only; status UNCHANGED: BLOCKED

**Prepared locally, NOT deployed, NOT wired:**

- `supabase/functions/delete-account/index.ts` now implements the §3.1 design in full: caller identity derived ONLY from the verified JWT (`auth.getUser` on the Authorization header), the request body can never carry a user id, typed `"DELETE"` confirmation required, in-memory rate limit (3 attempts / 15 min per caller, best effort per isolate), `SUPABASE_SERVICE_ROLE_KEY` read from `Deno.env.get` only, self-only `auth.admin.deleteUser(callerId)`, per-table receipt (profiles / user_progress / sync_queue / devices counts + anonymized `auth_events` count), explicit `retained_note`, generic error strings, zero logging.
- **CORS added (independent-audit fix, same session):** the function now answers `OPTIONS` preflight with 204 BEFORE any auth work and attaches `CORS_HEADERS` (`Access-Control-Allow-Origin: *`; allow-headers `authorization, x-client-info, apikey, content-type`; methods `POST, OPTIONS`) to every JSON response — Supabase does not add CORS automatically for user-written functions (Supabase docs, Functions > CORS), so the documented `functions.invoke` wiring would otherwise have failed preflight. Wildcard origin is acceptable here: bearer-token auth only, no cookies, self-only effect, no data on preflight. Verify on staging before client wiring.
- `tools/test-c4-privacy-consent.js` (group P4) statically guards the design and the placeholder: function exists with the above properties; NO file in `client/` or `www/` references `delete-account`; the `client/profile.js` placeholder toast is preserved and never calls `functions.invoke`.

**Still missing (blockers unchanged, §3.3–3.4):** staging project + authenticated staging deploy, service-role secret provisioning, two-user staging E2E, client wiring, and the privacy/terms flip from "not available" to "available". The §3.2 client wiring was deliberately NOT done.

**Privacy wording (partial §3.5):** `client/privacy.html` + `www/privacy.html` deletion section now states the interim truth — local wipe works; in-app cloud deletion is "غير متوفر داخل التطبيق حاليًا" until the server function ships; and what will happen when it ships (CASCADE per §2.4; `auth_events` anonymized). No overclaim of availability.

**NEW open integration question (decide BEFORE any production deploy):** production account deletion leaves `academy_prod_links` rows in the Staging project pointing at a deleted production account. `prod_user_id` intentionally has no FK to `auth.users` (`supabase/migrations/20261017000000_academy_progress_link.sql:63-72`), so such a row would silently remain `status='active'` linking a membership to a ghost account. Options: (a) learner function calls a staging-side revoke endpoint before deleting, (b) scheduled reconciliation in Staging, or (c) documented manual revocation. Owner decision required; do not deploy to production before it is made.

**NEW retention question (owner/legal):** `consent_records.user_id` is `ON DELETE CASCADE`, so a future account deletion will also erase the consent history. If proof-of-consent retention after deletion is a legal requirement, a separate retention design (e.g. anonymized copy) is needed; otherwise document the data-minimization rationale. See `docs/academy/DATA_PROCESSING_NOTICE_EGYPT.md`.

**Status:** BLOCKED (unchanged). Nothing deployed; no remote Supabase object was created, modified, or deleted; no key material was added anywhere.
