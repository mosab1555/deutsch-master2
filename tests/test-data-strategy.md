# Test Data Strategy

## Sources of truth (never invent competing ones)

- **Vocabulary/grammar/sentences/reading:** `client/curr-a1x.js`, `curr-a2/b*.js`, `curriculum.js`, `sent-a1.js`, `play.js` (`SENT_FILL`), `explain.js` (g1..g40).
- **Reference:** `client/reference-data-*.js` (loaded by `reference.js`).
- **Career:** `CAREER_TRACKS` in `client/career.js` (2 tracks, 8 modules, 40 quizzes).
- **Runtime state:** `localStorage["deutsch_master_v2"]` shape from `defaultState()` + `DMProgress` fields (`events`, `evSeen`, `evSeq`, `schemaV`, `lastActivity`).

## Fixtures

- Small deterministic fixtures live **inside each tool** (e.g. `test-smart.js` WORDS, `test-upgrade.js` 3-word world, `test-robustness.js` malformed stores). They assert engine behavior, never production content.
- Production content is validated **in place** (`audit-curriculum.js`, `smoke-curriculum.js`, `check-reference.js`, `check-links.js`, `test-career.js`) — no fixture drift possible.

## Data rules enforced by tests

1. Stable IDs as keys (words `k<kap>wN`/verbs `vN`, grammar `gN`, sentences `fN`/`cfN`, career `m-*-N`, attempts `ev*`). Display text is never a key.
2. Every noun carries article + plural; every record carries Arabic; relationships resolve (`check-links.js`).
3. No duplicates (normalized) within or across modules.
4. Honesty labels travel with content (practice-only interviews, estimative placement, language-only nursing).
5. Retention bounds: events ≤500, mistakes ≤200 entries × 5 hist, placeHistory ≤10, quizHistory ≤20.

## Corruption testing

`test-robustness.js` feeds null/garbage/oversized/mixed-script payloads into `migrate`, `logAttempt`, `rebuildTotals`, `safeSave` (throwing storage stub), `classifyError`, `nextReview`, `buildQueue`, `weeklySummary` — all must normalize or fail-safe without exceptions.

## What is NOT faked

No synthetic progress, scores, or proficiency in any fixture; weekly summaries assert `hasData:false` on empty logs. BLOCKED browser/device tests are never synthesized.
