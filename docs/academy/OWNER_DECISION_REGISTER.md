# Owner Decision Register — C4 Privacy/Consent/Deletion

**Date:** 2026-10-18 · **Repo:** `C:\Users\mosab\Desktop\deutsch-master2` · **HEAD:** `225117550f0c1bc5fbb08c8936ea4e0428c3434e`
**Purpose:** Every decision that must be made by the owner (and where noted, legal counsel) before consent recording is enabled and before account deletion / production rollout proceeds. Each item lists what is already prepared locally, the exact options, and a clearly-marked PROPOSAL (not a decision).
**Status:** All seven items OPEN. Until D1/D2 are decided, the consent feature stays disabled by default (`window.DM_CONSENT_CONFIG` absent → module inert, verified by test P2). Until D3–D7 are decided, nothing is deployed to production.

---

## D1 — Consent wording + `policy_version` approval

- **What this gates:** enabling `DM_CONSENT_CONFIG` / recording real consent rows. The client refuses to run without an approved, non-blank `policyVersion` ≤ 64 chars (enforced in code and DB CHECK).
- **Context:** `client/privacy.html` + `www/privacy.html` describe the consent mechanism as an open item, written to avoid overclaims. The record stores only `consent_type`, `policy_version`, `decision`, optional self-declared `age_band`, server timestamp — no free text.
- **Options:** (a) approve current interim notices as the v1 policy text and freeze a version string (e.g. `2026-10-dm-v1`); (b) redraft wording first, then freeze; (c) keep feature disabled indefinitely.
- **PROPOSAL:** (b) — owner reviews the (short) notice text for the two types (`privacy_notice`, `terms_of_service`), then approve and freeze an explicit version string. Never reuse a version string for changed wording.
- **Blocks:** Phase F (client integration), any real consent recording.
- **References:** `supabase/migrations/20261018000000_consent_records.sql`, `client/dm-consent.js`, `client/privacy.html`.

## D2 — Age / parental consent model (Egypt PDPL)

- **What this gates:** whether consent collection for minors is legally adequate, and whether the learner app needs any age gate or guardian flow at all.
- **Context:** the app currently performs **no in-app age verification** (stated honestly in `privacy.html`). The DB/module accept only a self-declared `age_band` in `('under_15','age_15_17','age_18_plus','undisclosed')`. Under Egypt PDPL, processing a child's data generally requires verifiable guardian consent (data-processing notice draft at `docs/academy/DATA_PROCESSING_NOTICE_EGYPT.md`).
- **Options:** (a) legal review concludes self-declared band + informational notice is acceptable for this pilot scope; (b) require guardian consent flow (guardian email/confirmation) before enabling recording for `under_15`/`undisclosed`; (c) disable consent recording for all minors until (b) exists.
- **PROPOSAL:** obtain counsel input on (a) vs (b) before enabling recording; do NOT ship a "guardian verified" claim — the schema intentionally has no such flag.
- **Blocks:** D1 enablement for any real learner; privacy-page final wording.
- **References:** `docs/academy/DATA_PROCESSING_NOTICE_EGYPT.md`, age-band CHECK in the consent migration.

## D3 — Consent retention after account deletion

- **What this gates:** whether proof-of-consent must survive account deletion, and the final privacy wording about it.
- **Context:** `consent_records.user_id` is `ON DELETE CASCADE`; deleting the auth user erases the consent history. The deletion function's design notes this explicitly.
- **Options:** (a) keep CASCADE and document data-minimization rationale (consent history is deleted with the account); (b) retain an anonymized copy (no `user_id`) for compliance evidence; (c) legal review decides.
- **PROPOSAL:** (c) with a lean toward (a) unless counsel requires durable proof — (b) adds a new schema surface and needs its own review.
- **Blocks:** production deletion rollout; final privacy/deletion wording.
- **References:** `docs/academy/ACCOUNT_DELETION_BLOCKER.md` (2026-10-18 update), consent migration FK.

## D4 — Deletion confirmation strength + rate-limit production bar

- **What this gates:** production behavior of `delete-account` (currently: typed `"DELETE"` confirmation, self-only JWT identity, in-memory 3-per-15-min best-effort rate limiter, per-table receipt).
- **Context:** in-memory limiting does not survive across isolates/regions; for a destructive endpoint that may be insufficient for production. Confirmation is text-typed, not password re-entry.
- **Options:** (a) accept current design for first production release; (b) require password re-entry (or fresh re-auth) before deletion; (c) require durable rate limiting/store (e.g. table-based attempt log) in addition.
- **PROPOSAL:** (b) + (c) before public availability; (a) acceptable only for a small controlled pilot with the placeholder toast still in place.
- **Blocks:** any production delete-account deploy decision (not the staging E2E — staging may proceed under this runbook).
- **References:** `supabase/functions/delete-account/index.ts`, `docs/academy/STAGING_VALIDATION_RUNBOOK.md` §7.

## D5 — `academy_prod_links` ghost-link handling

- **What this gates:** production account deletion while a production learner holds an active academy link in the staging project.
- **Context:** `prod_user_id` intentionally has no FK to `auth.users`; deleting the production account leaves the staging link row `status='active'` pointing at a ghost account. Raised in `ACCOUNT_DELETION_BLOCKER.md`.
- **Options:** (a) learner function calls a staging-side revoke endpoint before deleting; (b) scheduled reconciliation job in staging; (c) documented manual revocation procedure only.
- **PROPOSAL:** (a) as the deterministic path, with (c) documented as fallback; (b) only if link volume justifies it.
- **Blocks:** production deletion deploy.
- **References:** `supabase/migrations/20261017000000_academy_progress_link.sql:63-72`, `docs/academy/ACCOUNT_DELETION_BLOCKER.md`.

## D6 — Hosting / cross-border transfer facts for the privacy page

- **What this gates:** final privacy wording about where data physically lives and whether cross-border transfer disclosure is required.
- **Context:** the privacy page deliberately makes **no hosting-location claim** (no "hosted in Egypt" statement; verified by test P1). Actual facts depend on the Supabase project region and hosting choices only the owner knows/controls.
- **Options:** (a) owner provides factual region/processor list and counsel approves a disclosure sentence; (b) keep the page silent on location (current state) until D6 is answered.
- **PROPOSAL:** (b) until (a) is available — silence is safer than an unverified claim.
- **Blocks:** privacy-page final version; not a technical blocker.
- **References:** `client/privacy.html`, test P1 in `tools/test-c4-privacy-consent.js`.

## D7 — Production rollout gates and order

- **What this gates:** who authorizes what, in which order, for the final production steps.
- **Proposed order (PROPOSAL):**
  1. Decisions D1–D6 recorded and dated.
  2. Staging validation completed per `docs/academy/STAGING_VALIDATION_RUNBOOK.md` (all phases accepted).
  3. Client wiring of `delete-account` (replacing the placeholder toast) + privacy page flip from "not available" to "available" — reviewed with the staging evidence attached.
  4. Production session: apply `20261018000000_consent_records` + deploy function + secrets, each step separately authorized and evidenced.
  5. Enable consent recording only after D1/D2 are signed off; until then the feature stays inert.
- **Blocks:** everything production-side.
- **References:** `docs/academy/STAGING_VALIDATION_RUNBOOK.md`, `docs/academy/ACCOUNT_DELETION_BLOCKER.md`, `docs/academy/C4_IMPLEMENTATION_REPORT.md`.

---

## Summary table

| ID | Decision | Blocks | Recommendation (PROPOSAL) |
|----|----------|--------|---------------------------|
| D1 | Consent wording + policy_version freeze | Real consent recording | Redraft → approve → freeze version string |
| D2 | Minor/parental consent model (Egypt PDPL) | Enabling recording for minors | Counsel input; no false "guardian verified" claim |
| D3 | Consent retention on deletion | Production deletion, wording | Counsel; prefer pure CASCADE unless proof needed |
| D4 | Deletion confirmation + rate-limit bar | Production deletion availability | Password re-entry + durable limiting before public |
| D5 | Ghost links in `academy_prod_links` | Production deletion | Revoke-call before delete + documented manual fallback |
| D6 | Hosting/cross-border disclosure | Final privacy wording | Stay silent until facts confirmed |
| D7 | Rollout order and authorizations | All production steps | Staging first, separate signed steps, consent last |

Nothing in this register has been decided; no option has been implemented beyond the safe defaults already in the code (feature disabled, placeholder toast kept, no deployment).
