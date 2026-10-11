# Deutsch Master — Curriculum Map (evidence-based)

- **Date:** 2026-10-11 · **Revision examined:** `25f836e` (+ this review cycle's working tree)
- **Sources of truth:** `client/content/curriculum-manifest.json` (v1, 27 chapters),
  `client/content/dm-*.js` banks, `client/curr-*.js` overlays, `tools/content-inventory.json`.
- **Labelling rule:** objectives are **CEFR-informed, never CEFR-certified**.
  Chapters marked `status: draft/unreviewed` in the manifest are repeated as such here.
  Full linguistic sign-off **REQUIRES HUMAN REVIEW** (qualified German teacher).

## How to read this map

Each row: chapter → intended objective → grammar/vocab → practice activity →
assessment → implementation evidence → gaps/human review needed.

## A1 — Everyday basics (Netzwerk neu A1 topics, alignment only)

| Chapter | Objective (can-do, CEFR-informed) | Grammar / Vocab | Practice | Assessment | Evidence | Gaps / review |
|---------|-----------------------------------|-----------------|----------|------------|----------|---------------|
| K0 Einführung | Alphabet, pronunciation, greetings | Present `sein`, basic phrases | Vocab cards, sentences | Chapter quiz | `curr-a1x.js`, manifest tested:true | Teacher spot-check of phonetic guidance |
| K1 Guten Tag | Introduce self and others | Personal pronouns, W-questions | Dialogues `dm-dlg-*`, listening MC | Chapter quiz | `dm-lib.js`, `learn.js` renderListen | Review dialogue naturalness |
| K2 Freunde/Kollegen | Describe people, family | Possessives, plural | Stories (Lesen), flashcards | Story quiz | `world.js` STORIES | Verify A1 word ceiling |
| K3 In Hamburg | Orientation, directions | Prepositions (in/aus/bei) | Sentence ordering, dictation | Daily test | `sentex.js`, `dm-sent-*` | — |
| K4 Guten Appetit | Food, shopping | Akkusativ-einführung | Role dialogues, writing recall | Chapter quiz | `feats.js` writing | — |
| K5 Alltag/Familie | Daily routine, time | Separable verbs, time adverbs | Smart training (20 types) | Placement/final | `smart.js`, `assess.js` | — |
| KX extension | Consolidation | Mixed | Review/SRS | Mistake retest | `progress.js` | Confirm scope with teacher |

## A2 — Independent everyday use (Netzwerk neu A2 topics)

| Chapter | Objective | Grammar / Vocab | Practice | Assessment | Evidence | Gaps / review |
|---------|-----------|-----------------|----------|------------|----------|---------------|
| K6 Alltag/Wohnen | Housing, household | Wechselpräpositionen, Dativ | Grammar Lab drills | Chapter quiz | `curr-a2.js` | Drill distractor audit sampled |
| K7 Arbeit/Termine | Appointments, past events | Perfekt | Sentence training | Chapter quiz | `curr-a2b.js` | Irregular participles list review |
| K8 Reisen/Gesundheit | Travel, health | Modal verbs (past), imperative | Listening + speaking prompts | Daily test | `learn.js` renderSpeak + fallback | SR accuracy varies by device — documented |

## B1 — Coherent communication (Netzwerk neu B1 topics)

| Chapter | Objective | Grammar / Vocab | Practice | Assessment | Evidence | Gaps / review |
|---------|-----------|-----------------|----------|------------|----------|---------------|
| K9 Beruf/Bildung | Work, education | Konjunktiv II (intro), connectors | Reading bank `dm-read-01` | Chapter quiz | `curr-b1.js` | Complexity ceiling check |
| K10 Medien/Technik | Media, opinions | Passive (intro), nominalization | Discussions, essays (self-check) | Final test | `curr-b1b.js` | Teacher review of writing prompts |
| K11 Meinung/Gesellschaft | Argue for/against | Argument connectors | Debate dialogues | Chapter quiz | content banks | — |
| K12–K14 extensions | Study/career, news, culture | Mixed B1 | Mixed banks | Mixed tests | manifest measured totals | 5 recorded gaps in manifest — see below |

## B2 — Independent professional use (Aspekte neu / Aspekte Beruf B2 objectives)

Original CEFR-B2 content (40 words + 16 sentences + 4 grammar per chapter overlay).
**Not labelled as Netzwerk neu** — no Netzwerk B2 exists (verified via Klett catalog;
see manifest `b2SourceVerification`).

| Chapters | Objective | Evidence | QA status |
|----------|-----------|----------|-----------|
| K15–K17 Berufswelt/Umwelt/Meinung | Professional correspondence, reports | `curr-b2b.js`, `test-b2c-pack/answers` | 32–34 checks PASS, 0 ambiguous |
| K18–K21 Arbeitswelt/Diskussion/Medien/Prüfung | Discussion, exam training | `curr-b2d.js`, `test-b2d-pack/answers` | PASS |
| K22–K25 Wissenschaft/Gesundheit/Stadt/Globales | Abstract topics, presentations | `curr-b2e.js`, `test-b2e-pack/answers` | PASS |

## Four-skills coverage (A1 learner)

| Skill | Workflow (real, not placeholder) | Evidence | Limitation |
|-------|----------------------------------|----------|------------|
| Hören | TTS playback (normal/slow) + MC + dictation typing | `learn.js` renderListen/renderLi | Synthetic voice, not studio audio |
| Lesen | Graded stories + reading bank + vocab + quizzes | `world.js` STORIES, `dm-read-01.js` (5k) | A1 ceiling needs teacher sampling |
| Schreiben | Recall/transcription prompts, attempts saved (max 50) | `feats.js` S.feat.writing | Self-checked only — NOT automated assessment |
| Sprechen | Mic via SpeechRecognition + transcript-overlap check; text fallback | `learn.js` renderSpeak/evaluateSpoken, `labsx.js` | No phoneme scoring; device-dependent; fallback always offered |

## Recorded gaps (from manifest — not hidden)

5 gaps + 8 backlog items are recorded in `curriculum-manifest.json`
(`gaps`/`backlog` arrays). This map does not overrule them.
Top items for academy planning: teacher linguistic audit (all levels),
supervised learner pilot with baseline/follow-up, B1-extension consolidation,
bank-indexing for sentences-page first render.

## What this map does NOT claim

- No CEFR alignment certificate, no Goethe-Institut affiliation, no accreditation.
- Question counts (e.g. 697k exercises) measure bank size, not quality.
- Automated checks prove structural integrity (one defensible answer, valid distractors
  sampled); they cannot prove a German sentence is natural — teacher review pending.
