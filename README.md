# Deutsch Master — Arabic-Friendly German-Learning Platform

An interactive German-learning web app for Arabic speakers, covering levels **A1–B2** with
vocabulary, grammar, sentences, listening, speaking, reading, writing practice, tests,
flashcards (incl. AnkiDroid), and learner progress tracking — online and offline.

- **Production:** https://mosab1555.github.io/deutsch-master2/
- **Deployed source:** `client/` (uploaded verbatim by `.github/workflows/deploy.yml`)
- **Status:** actively maintained learning product. No official affiliation with
  Goethe-Institut; no formal CEFR certification or academy accreditation is claimed.
  Exam-practice features support preparation — they are not an official exam.

## What problem it solves

Arabic-speaking beginners often face German courses designed for other audiences:
articles/plurals taught separately from words, grammar without drills, listening without
transcripts, and progress that disappears when switching devices. Deutsch Master keeps
everything in one offline-capable app: every noun ships with article + plural, every rule
with examples and drills, every chapter with practice and a test, and progress syncs to
the cloud when signed in.

## Verified learning features

All items below were verified by code inspection against `client/` plus the automated
suites in `tools/` (see `docs/TECHNICAL_READINESS_REPORT.md`).

- **Vocabulary** (~104k library entries): search with German umlaut folding
  (ä/a, ö/o, ü/u, ß/ss), chapter/level/type filters, word detail, favorites, custom words.
- **Sentences** (~150k entries): searchable bank, paginated rendering, per-sentence TTS.
- **Grammar**: chapter-ordered rules with examples, Grammar Lab drills, reference bank
  (124 topics, 161 tables, 337 examples, 275 questions — `tools/check-reference.js` PASS).
- **Four skills (A1-oriented, real workflows, not placeholders):**
  - *Hören*: listening page with German TTS playback, comprehension questions, dictation typing.
  - *Lesen*: graded A1 stories with vocabulary, audio playback, comprehension quizzes.
  - *Schreiben*: recall/transcription writing practice with saved attempts (self-checked;
    teacher feedback is not automated — see Educational report).
  - *Sprechen*: microphone input via SpeechRecognition where the browser supports it,
    with an honest transcript-overlap check and a text fallback where it does not.
- **Tests Center**: placement, chapter, daily, and final tests; selection paths verified
  freeze-free (`tools/test-tc-selection-freeze.js` PASS, max long-task 91 ms).
- **Review system**: mistakes ledger, SRS scheduling, streaks, achievements, statistics.
- **Flashcards + AnkiDroid**: decks, spaced repetition, CSV/JSON import/export.
- **Progress & sync**: localStorage-first (`deutsch_master_v2`), identity-scoped snapshots
  per signed-in account, Supabase cloud sync with offline queue. Guest data never leaks
  into accounts (`tools/test-account-isolation.js` PASS, 32 checks).
- **PWA/offline**: versioned service worker (network-first HTML/JS/CSS, cache-first media),
  installable manifest, Arabic RTL + English + German UI (836 keys each, parity-checked).

## Educational scope

| Level | Chapters | Alignment reference (content is original) |
|-------|----------|-------------------------------------------|
| A1 | K0–K5 + KX (7 units) | Netzwerk neu A1 topics/objectives |
| A2 | K6–K8 | Netzwerk neu A2 topics/objectives |
| B1 | K9–K11 (+K12–K14 extensions) | Netzwerk neu B1 topics/objectives |
| B2 | K15–K25 (11 units) | Aspekte neu / Aspekte Beruf B2 objectives |

Objectives are **CEFR-informed, not CEFR-certified**: each chapter records objectives,
status, and provenance in `client/content/curriculum-manifest.json` (27 chapters,
5 recorded gaps, 8 backlog items). Anything unreviewed is marked as such — see
`docs/CURRICULUM_MAP.md`. Full linguistic correctness still requires review by a
qualified German teacher plus a supervised learner pilot.

## Technologies

Zero-build static frontend: plain HTML/CSS/JS, no framework, no bundler, no npm runtime
dependencies for the app itself. Cloud sync via Supabase (PostgREST + Auth); Row Level
Security restricts every user to their own rows (`supabase/migration.sql`). Mobile via
Capacitor (`www/` generated from `client/`), desktop via Electron.

## Project structure

```
client/            Deutsch Master app (SOURCE OF TRUTH for web + Pages deploy)
  index.html       Main entry (also academy.html, same app)
  content/         Vocabulary/sentence/grammar/exercise/dialogue banks + curriculum-manifest.json
  curr-*.js        Chapter overlays (A1–B2)
  script.js        Core state/identity/search/rendering
  learn.js         Listening/speaking pages, stories consume world.js
  auth.js          Supabase auth | cloud-sync.js  Offline-first sync queue
  app-init.js      Identity transitions (guest <-> account isolation)
  sw.js            Service worker | manifest.json  PWA manifest
  supabase-config.js  Browser-safe publishable key ONLY (never service_role)
www/               Generated copy of client/ for Capacitor (npm run www). Do not edit by hand.
android/ ios/      Capacitor native shells | electron/  Windows shell
server/            SEPARATE historical marketplace backend (Express/PostgreSQL).
                   Not used by the learning app, not deployed to Pages. Preserved as-is.
shared/            Constants for server/ only.
tools/             Validation + regression suites (node tools/<name>.js)
tests/             Test catalog (test-cases.json), traceability, regression suite
docs/              Readiness reports, curriculum map, content pipeline/schema
supabase/          migration.sql (RLS policies) for the learning app's cloud sync
```

> `server/`, `shared/`, `MARKETPLACE.md`, and `_backup/manifest.marketplace.json`
> belong to a separate marketplace project preserved in this repository's history.
> They are **not** shipped to the public learning site (Pages uploads `./client` only).
> Genuine repository separation (e.g. moving them elsewhere) is a human decision —
> see `docs/TECHNICAL_READINESS_REPORT.md`.

## Local setup

```bash
# Frontend only (no build, no backend needed):
npx serve client
# or: python -m http.server -d client 8080
# open http://localhost:8080/index.html

# Cloud sync (optional): copy client/supabase-config.example.js ->
# client/supabase-config.js is already provisioned with the publishable key.
# Apply supabase/migration.sql in the Supabase SQL editor for RLS tables.

# Mobile shell: npm run www && npx cap sync
# Windows: npm run start-win  (package: npm run dist-win)
```

## Testing

```bash
node tools/check-translations.js     # i18n parity (836 keys x3) — PASS
node tools/content-quality-gate.js   # dataset structural gate (0 errors) — PASS
node tools/qa-audit.js               # 89 checks: shuffle, search, storage, security — PASS
node tools/test-robustness.js        # 64 checks: corrupt state, nav, identity — PASS
node tools/test-account-isolation.js # 32 checks: guest/account isolation — PASS
node tools/test-assess.js            # 68 checks: assessment engine — PASS
node tools/test-tc-selection-freeze.js # freeze guard incl. perf probe — PASS
node tools/check-testplan.js         # catalog traceability (13 checks) — PASS
node tools/test-manifest.js          # curriculum manifest integrity — PASS
```

Browser/device-only cases (real PWA install, real-device speech) are marked BLOCKED in
`tests/test-cases.json` with reasons — never reported as passing.

## Current limitations & known issues

- Full linguistic review by a qualified German teacher is still pending
  (REQUIRES HUMAN REVIEW — see `docs/EDUCATIONAL_READINESS_REPORT.md`).
- No supervised learner pilot yet; no learning-effectiveness statistics are claimed.
- Writing/speaking feedback is self-check/overlap-based; teacher assessment is not automated.
- `server/` (marketplace backend) is unmaintained relative to the learning app; do not
  treat its demo credentials or payment/shipping integrations as part of this product.
- GitHub repository description/homepage/topics still show marketplace metadata
  (no `gh` CLI in this environment) — manual update fields are listed in the technical report.
- Perf probe: cold boot parses ~88 JS files; sentences-page first render ~4.2 s in
  headless measurement with one ~2.7 s long task on huge-bank filtering. Selection
  interactions themselves stay under 100 ms; further bank-indexing work is backlog.

## Privacy & data

- Guest progress stays in the browser's localStorage; nothing leaves the device unless
  the learner signs in.
- Signed-in progress syncs to Supabase; RLS policies (`supabase/migration.sql`) limit
  each user to their own rows. Only the browser-safe publishable key ships in the app.
- No secrets, tokens, or private user data are committed to this repository.
- Sign-out restores the guest snapshot byte-identically; per-account snapshots never mix.

## Licensing & content provenance

All curriculum texts (Arabic explanations, examples, dialogues, questions) are original
work by the project. Publisher series (Netzwerk neu A1–B1, Aspekte neu/Beruf B2) are used
solely as topic/objective alignment references — no book text, glossaries, answer keys,
audio, or transcripts are reproduced. No official Goethe-Institut affiliation.
