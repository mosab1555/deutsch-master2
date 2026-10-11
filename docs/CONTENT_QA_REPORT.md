# Content QA Report — Deutsch Master

- **Date:** 2026-10-11 · **Revision examined:** `25f836e` (+ this review cycle)
- **Method:** full-bank automated gates (entire datasets, not samples) + representative
  pack-level answer audits + targeted code inspection. Linguistic naturalness is
  explicitly out of scope for automation — see §5.

## 1. Structural gates (full datasets) — PASS

| Suite | Coverage | Result |
|-------|----------|--------|
| `tools/content-quality-gate.js` | vocab 104,640 · sentences 150,000 · grammar 3,069 · exercises 697,330 · dialogues 10,000 · reading 5,000 · listening 10,000 · exams 10,000 | **0 errors**, 1,913 warnings |
| `tools/check-reference.js` | 124 topics · 161 tables · 337 examples · 275 questions | PASS, 0 pending, 0 missing translations |
| `tools/check-ref-dups.js` | 337 examples | 0 duplicates |
| `tools/check-ref-dom.js` | alias search, DOM wiring | PASS |
| `tools/check-translations.js` | 836 keys × AR/EN/DE + both HTML entries | PASS parity |
| `tools/content-inventory.json` | layer parity (physical vs indexed counts) | generated 2026-10-11, layers consistent |

Warning triage (1,913): overwhelmingly `plural identical to singular` on uncountable /
plural-invariant nouns (e.g. mass nouns) — legitimate German, not defects. No warning
class indicated broken encoding, empty German terms, or missing required fields; the
gate errors (not warnings) on those, and errors = 0.

## 2. Answer integrity (pack level) — PASS

- B2 batches C/D/E: `test-b2c-pack` (13), `test-b2d-pack` (13), `test-b2e-pack` (13),
  `test-b2c-answers` (32), `test-b2d-answers` (33), `test-b2e-answers` (34) — all PASS,
  0 ambiguous flags. Index-scored and case-contrast units are pinned by design and
  documented in-test.
- Assessment core: `test-assess.js` 68/68 (percent math, thresholds A0–B1, confidence tiers).
- Anti-bias: `qa-audit.js` shuffle/no-sort-bias/seeded-daily checks PASS; `test-quiz-shuffle` PASS.
- Selection: `test-tc-selection-freeze.js` 11/11 (no pool rebuild pathology; question pools
  bounded; empty states render panels, not blanks).

## 3. Curriculum overlay QA — PASS

- `test-manifest.js` 10/10 (4 levels, 27 chapters with objectives/status/provenance,
  K15–K25 coverage w/s/g counts, Aspekte attribution, gaps/backlog honesty).
- `smoke-curriculum.js` 13/13 (chapter merges K0–K25, word/grammar counts per batch).
- `test-lazy-packs.js` 21/21 (on-demand full-bank loading; no missing-pack failures).
- `test-content-merge.js`: 38,200 fill kinds merged, smart-compatible — SMOKE OK.

## 4. Fixes made in this cycle

1. **Identity snapshot durability** (`client/script.js`): `snapshot()` and
   `loadIdentitySnapshot()` now write synchronously (`saveNow()` + fallback).
   Prevents missing/stale per-account snapshots across fast transitions.
   Proven by `test-account-isolation.js`: was FAIL + crash → now 32/32 PASS.
2. **QA harness correction** (`tools/qa-audit.js`): two search checks inspected call
   sites instead of function bodies (false FAILs). Re-pointed at
   `function renderSentences/Verbs` bodies; app code already used `dmNorm`.
   Suite now 89/89 PASS. No app search code was changed.
3. **Docs/identity**: README + package.json corrected to the verified learning product;
   `www/` regenerated from `client/` (byte-identical `script.js` verified).

## 5. What still REQUIRES HUMAN REVIEW (not automated, not claimed)

- Naturalness/idiomaticity of German sentences, dialogues, and story texts (full bank).
- Arabic explanation clarity and pedagogical grading per level (sampled audit first).
- A1 vocabulary ceiling compliance (no B2+ leakage into A1 chapters).
- Distractor plausibility beyond structural checks (sampled teacher review).
- TTS voice quality per device (spot-check on academy hardware).
- Selection method for the above: stratified sample per level × chapter (teacher-led),
  then full review of flagged chapters. Suggested owner: academy German department.
