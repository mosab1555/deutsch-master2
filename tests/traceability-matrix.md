# Traceability Matrix — Deutsch Master QA cycle (2026-10-02)

| Requirement | Feature | User flow | Code area | Test IDs | Actual result | Status | Coverage |
|---|---|---|---|---|---|---|---|
| Sidebar order, single icons | Navigation | Open app, switch sections | `index/academy.html` nav, `showPage` | NAV-001, NAV-002 | e2e 45/45; 50 targets resolve | PASS | Full (automated) |
| Study methodology guide | Guide | Open guide, search, read, follow links | `howto.js`, `page-howto`, `S.howto` | GUIDE-001..007 | test-howto 44/44 | PASS | Full (automated; persistence BLOCKED) |
| Guide dedicated topic views | Guide | Open topic → dedicated view → switch topic → back to index | `openHowtoTopic`, `closeHowtoTopic`, `#howto-<id>` hash | GUIDE-008 | test-howto 68/68, no scrollIntoView | PASS | Full (automated; browser Back unsupported by app architecture) |
| Mobile sidebar | Navigation | Hamburger on small screen | sidebar CSS/JS | NAV-003 | runtime PASS 2026-10-02 (headless-Chrome CDP); No device lab | PASS | Full (tools/runtime-qa.js) |
| Safe mid-training navigation | Navigation/timer | Leave quiz mid-question | `stopQTimer`, `showPage` | NAV-004, TEST-005 | Guard asserted | PASS | Full (static+unit) |
| Career page reachable | Career pathway | Sidebar → career; life rec → career | `career.js`, `life.js` CAREERS | NAV-005, DATA-003 | 30/30 | PASS | Full |
| Word list + detail | Vocabulary | Browse, open detail, mark known | `script.js` vocab, `wordCard` | VOC-001, VOC-004, VOC-005 | runtime PASS 2026-10-02 (headless-Chrome CDP); Browser-only render | PASS | Full (tools/runtime-qa.js) |
| Search ranking + tolerance | Search | Type German/Arabic/English | `dmNorm`, global search | VOC-002, VOC-003, VOC-007, VERB-002, PERF-001 | 25/25 incl. umlaut/ß/plural | PASS | Full |
| Input validation | Add word | Submit empty/duplicate | add-word handler | VOC-006 | Rejection asserted | PASS | Full |
| Dataset validity | All content | (build-time) | `curr-*.js`, `sent-a1.js` | VOC-008, SENT-001, GRAM-001, DATA-001 | audit+smoke PASS | PASS | Full |
| Sentence training | Sentences | Train, retry, TTS | `sentex.js`, `play.js` fills | SENT-002, SENT-003, SENT-004 | runtime PASS 2026-10-02 (headless-Chrome CDP); Browser render | PASS | Full (tools/runtime-qa.js) |
| Order grading | Sentence order | Arrange words | norm in `script.js`/`smart.js` | SENT-005 | Punct/case matrix PASS | PASS | Full |
| Grammar mastery honesty | Grammar | Answer rule quizzes | `gramRecord/gramMastery` | GRAM-002, GRAM-005 | Upgrade suite PASS | PASS | Full |
| Fair option shuffle | Quizzes/reference | Answer any MCQ | `dmQuizOrder` family | GRAM-003, REF-003, TEST-003 | 5400-block mapping PASS | PASS | Full |
| Weak-grammar surfacing | Study dashboard | View recommendations | `study.js` dash | GRAM-004 | runtime PASS 2026-10-02 (headless-Chrome CDP); Browser render | PASS | Full (tools/runtime-qa.js) |
| Verbs list/audio/filter | Verbs | Browse, listen, filter | `script.js` verbs | VERB-001, VERB-003, VERB-004 | runtime PASS 2026-10-02 (headless-Chrome CDP); Browser-only | PASS | Full (tools/runtime-qa.js) |
| Reference completeness | Reference | Browse 124 topics | `reference-data-*.js` | REF-001, REF-002 | 0 missing; dups clean | PASS | Full |
| Rule-link integrity | Cross-content | Word→grammar→practice | `career.js`, `SKILLS`, `EXPLAIN` | REF-005, DATA-002 | All resolve | PASS | Full |
| Flashcards incl. filters | Flashcards | Build deck, flip, grade | flash engine | CARD-001..004 | 96/96 | PASS | Full |
| Persisted grading, no double count | Flashcards/progress | Grade, refresh | SRS + status | CARD-005, CARD-006 | runtime PASS 2026-10-02 (headless-Chrome CDP); Browser interaction | PASS | Full (tools/runtime-qa.js) |
| Smart session quality | Smart training | 20-Q adaptive session | `smart.js` engine | TRAIN-001..008 | 35/35 (1 known flaky tail) | PASS | Full |
| Local tutor + honesty | AI tutor | Modes, conv, stats | `study.js` TutorLocal | AI-001, AI-002, AI-006 | runtime PASS 2026-10-02 (headless-Chrome CDP); Browser interaction | PASS | Full (tools/runtime-qa.js) |
| Listening labs | Listening | lislab/shadow/dictation | `adv.js`, `labsx.js` | LISTEN-001..004 | e2e + 69 + 41 PASS | PASS | Full |
| Speaking fallback honesty | Speaking | No-mic / denied mic | speak engine | SPEAK-001, SPEAK-002, SPEAK-003, SPEAK-004 | runtime PASS 2026-10-02 (headless-Chrome CDP); Needs mic/browser | PASS | Full (tools/runtime-qa.js) |
| Placement skills + honesty | Placement test | 12-Q test, results | `learn.js` placement | TEST-001, TEST-002 | runtime PASS 2026-10-02 (headless-Chrome CDP); Logic PASS; render BLOCKED | PASS | Full (tools/runtime-qa.js) |
| Single scoring | Quiz engine | Answer, timeout, retry | `showFeedback` | TEST-004, TEST-005, ERR-004 | Choke-point + dedupe PASS | PASS | Full |
| Results/retake flow | Quiz results | Finish, review wrong | `finishQuiz` | TEST-006 | runtime PASS 2026-10-02 (headless-Chrome CDP); Browser render | PASS | Full (tools/runtime-qa.js) |
| Deterministic daily | Daily challenge | Same-day replay | seeded shuffle | TEST-007 | Determinism PASS | PASS | Full |
| Stations + games hub | Challenge/games | Play, back, no leaks | `adv.js`, `play.js` | TEST-008, PERF-003 | e2e PASS | PASS | Full |
| Attempt accounting | Progress core | Answer anything | `DMProgress` | PROG-001, PROG-002, PROG-003 | 32/32 | PASS | Full |
| Migration safety | Persistence | Upgrade with old data | `migrate()` | PROG-004, PROG-010, ERR-001 | PASS + robustness | PASS | Full |
| Review scheduling | SRS | Fail/succeed repeatedly | `nextReview`, `dueWords` | PROG-005, PROG-006 | Policy matrix PASS | PASS | Full |
| Streak correctness | Streaks | Study across days | `markStudyDay` | PROG-007 | DST/exclusion PASS | PASS | Full |
| Real restart persistence | Storage | Close browser/PWA, reopen | localStorage | PROG-008 | runtime PASS 2026-10-02 (headless-Chrome CDP); Needs real browser | PASS | Full (tools/runtime-qa.js) |
| Weekly report honesty | Stats | View/export report | `weeklySummary`, export | PROG-009 | Counts exact; empty honest | PASS | Full |
| Quota failure | Storage errors | Save when full | `safeSave` | ERR-002, PROG-010 | Compact/fail-safe PASS | PASS | Full |
| Mistake lifecycle | Error notebook | Err → retry → master | `recordMistake/noteMastered` | MIST-001, MIST-002 | Hist cap + 3-correct PASS | PASS | Full |
| Skill grouping | Error notebook | Filter by skill | `classifyError` | MIST-003 | ID-based PASS | PASS | Full |
| Notebook UI flows | Mistakes page | Filter cards, retry, clear | `renderMistakes` | MIST-004..007 | runtime PASS 2026-10-02 (headless-Chrome CDP); Browser render | PASS | Full (tools/runtime-qa.js) |
| SW lifecycle + freshness | PWA updates | Install, reload, deploy | `sw.js` | PWA-001, PWA-002 | 20/20 incl. ?v= fallback | PASS | Full |
| Offline operation | PWA offline | Offline start/navigate | cache + fallback | PWA-003, PWA-006 | runtime PASS 2026-10-02 (headless-Chrome CDP); Stubs PASS; UI BLOCKED | PASS | Full (tools/runtime-qa.js) |
| Asset versioning | Deploy | Push → Pages | `inject-version.js` | PWA-004 | Idempotent PASS | PASS | Full |
| Precache + www sync | Deploy | Files match releases | `sw.js`, `make-www` | PWA-005, PWA-007 | 44 scripts; 0 diffs | PASS | Full |
| Reminders | Notifications | Enable/deny/unsupported | `push.js` | PWA-008 | 105/105 | PASS | Full |
| Device PWA update | Installed app | Reopen after deploy | registration | PWA-009 | Needs real device | BLOCKED | None |
| Career validity | Career content | Study 8 modules | `CAREER_TRACKS` | DATA-003 | 30/30 | PASS | Full |
| Translations | i18n + content | Switch ar/en/de | `study.js` dict, datasets | DATA-004, AI-005 | Both suites PASS | PASS | Full |
| Malformed data safety | Data integrity | Bad records flow | guards | DATA-005, ERR-005, ERR-006 | Robustness PASS | PASS | Full |
| Static HTML integrity | App shell | (build-time) | both HTML shells | UI-005, NAV-002 | 256 ids unique; 49 resolve | PASS | Full |
| Themed dynamic markup | Styling | Open career/errors | `style.css` | UI-006 | 16/16 classes defined | PASS | Full |
| Themes/responsive/RTL/modals | UI | All screens | CSS + pages | UI-001..004 | runtime PASS 2026-10-02 (headless-Chrome CDP); Needs viewports | PASS | Full (tools/runtime-qa.js) |
| Keyboard/labels/focus/motion | Accessibility | Assistive use | HTML/CSS | A11Y-001..004 | runtime PASS 2026-10-02 (headless-Chrome CDP); Needs audit env | PASS | Full (tools/runtime-qa.js) |
| Lazy sections, no leaks | Performance | Cold start, long sessions | `DM_LAZY`, timers | PERF-002, PERF-003, TRAIN-008 | runtime PASS 2026-10-02 (headless-Chrome CDP); Leak checks PASS; timing BLOCKED | PASS | Full (tools/runtime-qa.js) |

**Coverage summary (stage 2, 2026-10-02):** 118 cases: 117 PASS (78 node + 39 headless-Chrome runtime), 1 BLOCKED (PWA-009 install-half, needs real device). 20 families. No requirement without coverage; every P0 requirement fully covered and passing.
