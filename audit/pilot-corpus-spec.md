# Pilot corpus specification (2,000–5,000 sentences) — DRAFT, no content approved

Status: SPECIFICATION ONLY. No rows selected, no teacher review performed,
nothing labeled approved. This spec tells a future curator + teacher how to
build the pilot, and how to verify it with `tools/test-content-remediation.js`.

## 1. Size and level quotas
- Total 3,000 rows (within the 2,000–5,000 band): A1 1,200 / A2 900 / B1 600 / B2 300.
- B2 rows come ONLY from CURR overlays (the library bank has no B2 sentences);
  if CURR B2 coverage is insufficient, shrink B2 and say so — never invent rows.

## 2. Selection (from existing banks; no new authored rows in this phase)
1. Start from `client/content/src/sent-*.json` AFTER remediation phase 1.
2. Exclude: any ID in `audit/remediation-review-queue.csv`; any row whose
   German contains a compound from the phase-1 DENY list or the audit
   compounds-review CSV; any row with gram in template-heavy lists beyond quota.
3. Diversity caps: max 8 rows per normalized template (template norm = the T9
   rule in the test); max 3 rows sharing the same object noun; at most 20%
   with KX chapter (the rest must carry real K1–K25 from CURR-mapped rows or
   A1 K1–K5 library mapping).
4. Arabic bar: zero "/" residues, zero أن+indicative violations (enforced by
   tests T7/T8), no Latin spill; every row re-read by the Arabic reviewer.

## 3. Chapter mapping (honest)
- A1 rows keep library K1–K5 only where the row's gram/topic plausibly matches
  the chapter objectives in `client/content/curriculum-manifest.json`; all
  other A1 rows and all A2/B1 rows take chapters ONLY from CURR overlay
  alignment done by the curriculum owner. Keyword-frequency inference is
  forbidden (it was explicitly rejected in remediation phase 1).
- Rows that cannot be honestly mapped stay KX and count against the 20% cap.

## 4. Exercises
- Pair each pilot sentence with at most one auto-derived exercise, only of
  types whose answer key is mechanically verifiable (article/plural/conjugate
  against the vocab bank). Meaning-gap and order exercises require per-item
  teacher sign-off (the B2C/B2D/B2E answer audits are the template for this).

## 5. Acceptance
- `tools/test-content-remediation.js` PASS on the pilot slice (run with a
  slice filter), PLUS a teacher sign-off sheet per 100-row batch (OK/awkward/
  wrong rubric from the audit), PLUS target: ≥90% OK per batch before the
  pilot may be called teacher-approved. Anything less stays unreviewed.
