# Remediation report — Phase 1 (2026-10-15)

## 1. Verified root causes and source files
- **Lowercase starts (5,953):** `tools/build-sentences.js` `fillGeneric()` substitutes
  `{T}`/`{P}`/`{O}` slots with raw lowercase pool fragments and never capitalizes;
  9 `{T}`/`{P}`-initial templates + komparativ/superlativ branches using lowercase
  `declArt` output. No lowercase-initial template exists (verified: 310 patterns).
  Fix: capitalize `de` at emission (finalize block) — German has no valid
  lowercase sentence start (verified: 0 camelCase/ß exceptions in data).
- **Modal tail order (1,088 genuine):** `build-sentences.js` modal-muessen/koennen/
  wollen/sollen branch appended the adjunct AFTER the infinitive
  (`kann den Strom nennen am Muttertag`). Fix: adjunct before infinitive.
  Note: the audit's 1,799 count included 848 `möchten`+bare-NP rows which are
  grammatical ellipsis — corrected, not patched. The audit also undercounted by
  ~120 (tails ending in -n passed its regex) — remediation count is 1,088.
- **wehtun "Der + -in" (227): AUDIT FALSE POSITIVE.** `Der Irakerin tut der
  Brustkorb weh` is a grammatical fronted-dative experiencer (dative of `die`
  is `der`). No data changed. (2 `lassen-passiv-sinn` rows queued for teacher.)
- **Arabic slashes (4,619):** vocab `ar` polysemy (`العم / الخال`, `يشرق / يفتح`)
  copied verbatim into sentences (phrase builders, `verbArOf`, `arVerb`,
  `arPastFull`, `arAdj`/`adjAgr` had no normalization; MODGEN line ~237 and
  gibt-es-kein already used first-gloss — extended to all paths).
- **يريد نحن (16):** `MODAL_AR` table unconjugated + subject pronoun. Fix:
  `modalAr()` conjugates wollen/können/möchten; impersonals unchanged.
- **العائلة يحيي (11 of 14):** `subjFem()` missed `Familie` (covers
  Groß-/Kleinfamilie). 3 non-subject rows not patched (1 correct masculine,
  1 malformed `يحييون`, 1 correct) → queue.
- **تتصل ليلى (494 ruft-an + 356 anrufen-person):** `ruft-an`/`anrufen` branches
  omitted بـ before person objects (the `sobald` branch already had it).
  Abstract objects (workplace, exams) skipped → queue.
- **أن+indicative (2,208):** `arInfPl()` ignored subjunctive mood. Fix: `subj`
  flag (ون→وا, ان→ا; سوف-contexts keep indicative). Hollow-singular guard
  (يكون/يخون keep) + وو-collapse (يدعوون→يدعوا) verified against data.
- **superlativ هو (232):** hardcoded masculine pronoun; fixed by object gender.
- **Compounds:** MODGEN/QMOD productive compounding; `DENY_DE` extended with 16
  evidenced forms (ß+ss variants); QMOD pass lacked the DENY guard (added).
  Real words (Rohschinken, Picknickrest, Kartenpin, Topper, Cookie) excluded.
- **KX (90,844):** by design — `kapFor()` returns KX for non-A1 in every
  builder, documented in `gen-curriculum-manifest.js`. No keyword-inference
  mapping performed (forbidden); real mapping lives in CURR overlays.
- **Exam shells (10,000):** confirmed rows carry configs without question
  items; assembly is runtime-side — reported, not altered.

## 2. Exact fixes made and affected record counts
Source edits: `tools/build-sentences.js` (+modalAr/firstAr/subj-flag/بـ/هو-هي/emit-cap/first-gloss choke points), `tools/build-content-library.js` (+16 DENY forms, QMOD guard).
Data patches (`client/content/src/sent-*.json`, IDs/counts/levels/chapters/refs untouched; per-row trail in `audit/remediation-patches.json`):

| Rule | Patched | Queued |
|---|---|---|
| R1 capitalize | 5,953 | 0 |
| R2 modal tail reorder | 1,088 | 0 |
| R3 slash first-gloss / qualifier removal | 4,436 | 183 (ambiguous boundary) |
| R4 يريد نحن → نحن نريد (Wir wollen only) | 16 | 0 |
| R5 العائلة يحيي → تحيي (subject only) | 11 | 0 (+3 correctly untouched) |
| R6 anrufen بـ (verified persons/names) | 960 | 112+ abstracts |
| R7 أن mood (hollow-guarded) | 2,157 | 0 |
| R8 superlativ هي | 232 | 0 |
| R9 modal feminine (تستطيع/تريد/تود + sing. fem. subject) | 597 | 0 (rows fixed; broader class stays in teacher CSVs) |
| modal-fem wider scan (appended then fixed by R9) | — | 0 remaining |
| **Total** | **15,450** | **185 queue rows** (+ standing audit CSV worklists) |

Derived artifacts re-emitted with the project's own compact path
(`audit/scripts/reemit-sent.js`, same shape as `build-emit.js`): 31
`dm-sent-*.js` packs (ID-aligned, verified 3/3 packs), `manifest.json` counts
(sent total still 150,000), `dm-lazy.js` PACKS bytes refreshed.
Full `build-emit`/pipeline rebuild deliberately NOT run: generation is globally
seeded-sequential, so a rebuild would rewrite all 150k rows and clobber the
staged sent-ref remediation — documented for the next full-regen window.

## 3. Automated checks added and results
- New `tools/test-content-remediation.js`: 12/12 PASS (T1 capitalization, T2
  modal tails, T3 wehtun-shape pin, T4 placeholders, T5 kap/level sets, T6
  dupes, T7/T8 queue-aware slash+mood, T9–T11 report-only template/reading/exam).
- Existing suites re-run, no regressions: `content-quality-gate.js` errors=0
  warnings=1913 (identical), `test-assess.js` 68/68, `test-content-merge.js`
  SMOKE OK. (`test-b2c-answers.js` 32/32 from the audit; B2C packs untouched.)
- Runtime compat verified: sync packs loaded in a window stub, patched rows
  flow through with shape [id,de,ar,level,topic,kap,gram,vocabCsv], 0 bad-shape.

## 4. Before/after defect counts (recomputed on patched data)
lowercase 5953→0; ar-slash 4619→183 (all queued); modal-tail 1088→0;
أن-mood ~2208→0; ruft-an missing-ب 494→0. Semantic nonsense, compounds,
KX share, reading/exam structure: UNCHANGED (teacher/curriculum work).

## 5. Records still requiring a German teacher
- `audit/remediation-review-queue.csv` (185): ambiguous slash boundaries,
  abstract anrufen objects, malformed verbs (`يحييون`), lassen cases.
- Standing audit worklists (unchanged): `sentences-semantic.csv`,
  `sentences-compounds-review.csv` (2,032), `sentences-unknown.csv`
  (review queue), `bank-vocab-issues.csv`, `bank-a1-leak.csv`,
  `bank-read-repetitive.csv` — the semantic/level/content program (Phase B).
- Plural-gender Arabic (النساء يكتبون class), komparativ-adv masculine يفضل,
  يجب على+pronoun restructuring: documented, generator-future + teacher.
- Nothing in any bank is teacher-approved: `client/content/review-status.json`
  (new sidecar, default unreviewed, empty overrides) + contract
  `audit/review-status.schema.json`. Pilot spec: `audit/pilot-corpus-spec.md`.

## 6. Changes not completed and why
- Full pipeline regeneration: deferred (would invalidate staged sent-ref work;
  needs a coordinated regen window + teacher spot-check).
- Teacher dashboard/academy/certs/payments: out of scope per constraints.
- server|shared untouched; auth/RLS/PWA/UI untouched; no push to deployment.
- `www/` mirror NOT rebuilt (generated via `npm run www`; release-time step).

## 7. Working-tree safety for a separately reviewed commit
- Pre-existing staged entries (sent-ref remediation, dm-lazy PACKS) untouched
  in the index; phase-1 work sits as unstaged modifications + new files only.
- Changed tracked files: `tools/build-sentences.js`, `tools/build-content-library.js`,
  `client/content/src/sent-*.json` (31), `client/content/dm-sent-*.js` (31),
  `client/content/manifest.json`, `client/content/dm-lazy.js`,
  new `client/content/review-status.json`.
- New files: `tools/test-content-remediation.js`,
  `audit/remediate-*.js|json|csv`, `audit/reemit-sent.js`, `audit/verify-*.js`,
  `audit/before-after.js`, `audit/spot-r2.js`, `audit/queue-modal-fem.js`,
  `audit/remediate-r9.js`, `audit/patch-*.js`, `audit/gate*.js`,
  `audit/REMEDIATION_REPORT.md` (this file), `audit/pilot-corpus-spec.md`,
  `audit/review-status.schema.json`, `audit/remediation-patches.json` (15,450 rows).
- Reviewer: run `node tools/test-content-remediation.js` (expect 12/12) and the
  three existing suites above; inspect `audit/remediation-patches.json` sample
  rows; confirm staged (`git diff --cached`) vs unstaged (`git diff`) separation
  before committing in two steps (pre-existing staged work first, phase 1 second).
- PASSING TESTS DO NOT CERTIFY LINGUISTIC CORRECTNESS. The hand-sample error
  rate from the audit stands until teachers work the queues.
