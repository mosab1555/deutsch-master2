# Educational Readiness Report — Deutsch Master

- **Date:** 2026-10-11 · **Revision examined:** `25f836e` (+ this review cycle)
- **Scope:** curriculum structure, four-skills workflows, assessment integrity,
  vocabulary/grammar banks, progress meaningfulness.
- **Rule:** code proves structure; only a qualified teacher + learner pilot prove learning.
  Every unreviewed item is marked **REQUIRES HUMAN REVIEW**. No effectiveness statistics
  are claimed.

## 1. Curriculum structure — PARTIAL (mapped, teacher review pending)

Full map: `docs/CURRICULUM_MAP.md`. 27 chapters across A1 (7 units), A2 (3), B1 (3+extensions),
B2 (11, K15–K25 with 40 words + 16 sentences + 4 grammar each). Objectives, status, and
provenance recorded per chapter in `client/content/curriculum-manifest.json`
(`test-manifest.js` PASS: levels, objectives, B2 Aspekte-attribution, gaps/backlog recorded).
Publisher series used as topic alignment only; all texts original (manifest copyright
boundary). Netzwerk-neu-B2 mislabelling explicitly avoided (verified: Netzwerk neu ends
at B1; B2 aligns to Aspekte neu/Beruf B2 objectives).

## 2. Four skills (A1) — PARTIAL (all workflows real; human review pending)

| Skill | Verdict | Evidence |
|-------|---------|----------|
| Hören (Listening) | PASS (workflow real) | `learn.js` renderListen: TTS playback normal/slow, MC questions, dictation typing; `dm-lis-01/02` banks (10k); story audio |
| Lesen (Reading) | PASS (workflow real) | `world.js` STORIES: graded texts + vocab + audio + quizzes; `dm-read-01` (5k) |
| Schreiben (Writing) | PARTIAL | `feats.js` recall/transcription prompts, attempts saved; **self-checked only — must be presented as practice, never as automated assessment** |
| Sprechen (Speaking) | PARTIAL | `learn.js` renderSpeak + `evaluateSpoken` (honest transcript overlap, no phoneme claims); text fallback always offered; device-dependent |

No inactive menus or fake simulations found. Automated writing/speaking grading is NOT
claimed anywhere in-app (verified messaging presents them as practice).

## 3. Assessment integrity — PASS (structural) / REQUIRES HUMAN REVIEW (linguistic)

- `test-assess.js` 68/68 (scoring, thresholds, placement mapping A0–B1 estimative by design).
- B2 packs: `test-b2c/d/e-pack` + `test-b2c/d/e-answers` all PASS (32–34 checks each,
  0 ambiguous flags; distractor/case-contrast units pinned by design).
- `qa-audit.js` shuffle/no-sort-bias/seeded-daily checks PASS (no answer-position bias).
- `content-quality-gate.js`: **0 errors** across vocab 104,640 / sentences 150,000 /
  grammar 3,069 / exercises 697,330 (+ dialogue/reading/listening/exam banks);
  1,913 warnings (mostly plural==singular, legitimate for uncountables — triaged, not defects).
- Retry/review/incorrect-answer flows and persistence covered by `test-progress` (35),
  `test-merge-fix` (44), sync/account suites. Empty states handled (verified panels).
- **Limit:** automated checks prove single-defensible-answer structure on sampled packs,
  not German naturalness. Full-bank linguistic audit by a teacher is still required.

## 4. Vocabulary & grammar banks — PASS (structural) / REQUIRES HUMAN REVIEW (linguistic)

- Reference bank: 124 topics / 161 tables / 337 examples / 275 questions, 0 duplicates,
  0 missing translations (`check-reference`, `check-ref-dom`, `check-ref-dups` PASS).
- i18n: 836 keys × AR/EN/DE with parity, RTL/LTR wiring (`check-translations` PASS).
- Umlaut folding (ä/a, ö/o, ü/u, ß/ss) active in vocab, sentence, and verb search
  (verified in code; `qa-audit` search checks PASS after harness correction).
- No silent content guessing was performed in this cycle; warnings left as warnings.

## 5. Progress meaningfulness — PASS

Counters, SRS, mistakes, streaks, and event log flow through tested choke points;
account isolation (32 checks) and sync-queue recovery (36 checks) prove no cross-account
leakage and no loss across switches/reloads. Can-do outcomes (introduce self, understand
short messages) are expressed as CEFR-informed objectives in the manifest, not as
certified results.

## 6. Academy-readiness checklist (external actions — NOT complete)

1. Qualified German teacher: linguistic audit of A1–B2 banks (sampled, then full on flags).
2. Supervised pilot: baseline + follow-up assessments with real learners + teacher feedback.
3. Placement-cut validation against teacher judgement (current mapping is estimative).
4. Device/speech check on academy hardware (mic, TTS voices, offline room use).
5. Data/consent wording review for student accounts (legal/parental as applicable).
6. Decide repository separation for `server/` marketplace (human decision; steps in Technical report).
