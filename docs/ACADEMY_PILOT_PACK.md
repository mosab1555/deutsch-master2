# Academy Pilot Package — Deutsch Master

- **Date:** 2026-10-12 · **Revision:** `ab599a3` (+ sentences first-filter perf fix, this cycle)
- **Status:** PREPARATION ONLY — no teacher review has been received, no learners
  recruited, no pilot run. Every human-dependent item is marked
  **REQUIRES HUMAN ACTION** and is never pre-marked complete.
- **Sources (not duplicated here):** `docs/EDUCATIONAL_READINESS_REPORT.md`
  (four-skills workflows, assessment integrity), `docs/CURRICULUM_MAP.md`
  (27 chapters A1–B2, objectives, recorded gaps), `docs/CONTENT_QA_REPORT.md`
  (automated structural gates), `docs/TECHNICAL_READINESS_REPORT.md`
  (runtime, PWA/offline, performance evidence).

## 0. What the software is (evidence summary for planners)

- Arabic-RTL learning platform (A1–B2, CEFR-informed objectives, never
  CEFR-certified; no Goethe affiliation, no accreditation — see Curriculum Map).
- Banks (structural counts, not quality claims): vocabulary 104,640 · sentences
  150,000 · grammar 3,069 · exercises 697,330 · dialogues 10,000 · reading
  5,000 · listening 10,000 · exams 10,000. Automated gates: 0 errors
  (1,913 triaged warnings, mostly plural-invariant nouns).
- Real workflows per skill: listening = TTS playback (normal/slow) + multiple
  choice + dictation typing; reading = graded stories + quizzes; writing =
  recall/transcription prompts, attempts saved, **self-checked practice only —
  never automated assessment**; speaking = microphone via SpeechRecognition
  with transcript-overlap check (no phoneme scoring) + always-offered text
  fallback.
- Progress: counters, SRS scheduling, mistake log with retry, streaks, event
  log; per-account isolation proven (guest↔account byte-identical restore);
  local-first with versioned service worker + offline fallback.
- Recorded limitations: `curriculum-manifest.json` lists 5 gaps + 8 backlog
  items; placement mapping A0–B1 is estimative; TTS/speech quality is
  device-dependent; full linguistic audit pending (Section A).

## A. Teacher review sheet — REQUIRES HUMAN ACTION

Automation (dedup, schema, single-answer structure, shuffle-bias checks)
**cannot replace expert linguistic judgment.** A qualified German teacher
reviews a stratified sample per level × chapter first, then full chapters
only where flags arise (sampling plan owned by the academy German department).

Copy one row per reviewed sentence/item:

| # | Field | To record |
|---|-------|-----------|
| 1 | Lesson / chapter | e.g. K3, topic, bank id if shown |
| 2 | German sentence (as displayed) | exact text |
| 3 | Learning objective | the can-do from `docs/CURRICULUM_MAP.md` |
| 4 | Linguistic accuracy | correct / incorrect + rule violated |
| 5 | Naturalness / idiomaticity | natural / awkward / wrong register |
| 6 | Level appropriateness | at-level / too easy / too hard + why |
| 7 | Arabic translation quality | accurate / misleading / dialect issue |
| 8 | Answer-key correctness (if quizzed) | key correct / ambiguous / wrong |
| 9 | Teacher comments | free text, incl. suggested fix |

Triage rule: any row marked incorrect/wrong blocks that item from pilot use
until fixed (see stop conditions, Section C). Reviewartefakte (sheet +
teacher sign-off) are required launch evidence (Section D).

## B. Learner pilot protocol (proposed, NOT run)

- **Design:** small, voluntary, supervised pilot. Suggested frame: 2–3 weeks,
  2 sessions/week, A1 learners only (objectives: introduce self, understand
  short messages, everyday routine — the A1 can-dos in the Curriculum Map).
  The academy sets final duration/objectives; do not run longer or wider
  without a new review.
- **No recruitment claimed:** no students have been recruited and no pilot
  has run. Recruitment, if approved, follows the consent wording (Section D).
- **Baseline assessment (week 0):** placement + chapter quizzes already in
  the app, cross-checked by teacher judgement (app mapping is estimative).
  Record participant IDs, date, scores per skill area.
- **Assigned activities + usage records:** vocabulary cards, sentence
  training, listening MC + dictation, story quizzes, grammar drills —
  teacher assigns per session; the app's event log / mistake log / streaks
  provide usage records. Writing/speaking outputs are collected as practice
  artefacts, never as grades.
- **Follow-up assessment (end):** equivalent skills and difficulty to the
  baseline (parallel form, teacher-approved as comparable — not the identical
  items). Same scoring rubric as baseline.
- **Usability questionnaire:** short, anonymous; clarity of Arabic
  instructions, ease of navigation (RTL), audio quality on their device,
  offline-room experience, what confused them.
- **Teacher observations:** session notes on engagement, where learners got
  stuck, suspected content errors, device/speech incidents.
- **Data minimization:** anonymous participant IDs (e.g. P01…P12). No names,
  no contact details, no sensitive data unless strictly necessary and
  properly authorized. Informed consent from participants; guardian consent
  where required (minors). Missing data (absences, skipped items, device
  failures) is reported as-is with reasons — never imputed silently.
- **No significance promises:** a small pilot cannot yield statistically
  significant results. Report baseline→follow-up descriptively per learner
  (e.g. median change, range), with no causal claims about the app.

## C. Evaluation rubric

Score each dimension from pilot evidence; every claim cites its source
(logs, sheets, questionnaires, observations):

1. **Correctness of answers** — quiz/placement scores vs. answer keys
   (structural integrity pre-proven by `test-assess` 68/68 and B2 pack
   audits; pilot adds human-judged writing/speaking practice quality).
2. **Completion & usability** — task completion rates, drop-off points,
   questionnaire clarity ratings, teacher-noted friction.
3. **Performance & reliability on student devices** — cold-start and
   sentences-filter responsiveness on academy hardware (lab numbers for
   reference: post-fix merge ~2 ms warmed / ~350 ms true-cold on 150k,
   empty-query filter ~5 ms, warm search ~30 ms — all headless-Chrome
   measurements, NOT device guarantees), offline-room behavior, crash/
   data-loss incidents (target: zero data loss).
4. **Learner-reported clarity** — Arabic explanation clarity, navigation,
   audio intelligibility per device.
5. **Teacher-identified content defects** — count and severity from
   Section A sheets + session observations; fix-or-exclude disposition.
6. **Baseline→follow-up change** — descriptive per-learner deltas only;
   no causal attribution, no significance language.

**Stop conditions (halt the pilot, fix, re-review):** critical content
errors (wrong German taught as correct, wrong answer keys), any learner
data loss or cross-account leakage, any privacy/consent breach, or speech
features misleading learners about assessment (writing/speaking presented
as graded). Resume only after fix + teacher re-sign-off.

## D. Launch checklist (all human-gated)

- [ ] Qualified German-teacher review (Section A) complete + sign-off — **REQUIRES HUMAN ACTION**
- [ ] Stratified sample covers every level × chapter used in the pilot — **REQUIRES HUMAN ACTION**
- [ ] Real-device PWA checks on academy hardware (install, update, offline room, low-end device spot-check) — **REQUIRES HUMAN ACTION**
- [ ] Speech support matrix verified per device (TTS voices DE/AR, mic permission, SpeechRecognition availability) + fallback behavior demonstrated (text fallback always offered) — **REQUIRES HUMAN ACTION**
- [ ] Accessibility review (keyboard flow, screen-reader pass on core pages, focus visibility, Arabic RTL) — **REQUIRES HUMAN ACTION**
- [ ] Consent wording approved (participant + guardian where required), anonymous IDs issued, data-minimization confirmed — **REQUIRES HUMAN ACTION**
- [ ] Baseline/follow-up parallel forms teacher-approved as comparable — **REQUIRES HUMAN ACTION**
- [ ] Evidence collection plan assigned (who exports logs, who holds sheets, where artefacts live) — **REQUIRES HUMAN ACTION**
- [ ] Stop-condition owner named (who can halt the pilot) — **REQUIRES HUMAN ACTION**
- [ ] Repository separation decision for `server/` marketplace recorded (see Technical report §1; not a pilot blocker, tracked for hygiene)
