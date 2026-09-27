# Reference implementation plan (internal, not shown in app)

| Stage | Status | Checkpoint | Build (www sync) | Tests | Notes |
| ----- | ------ | ---------- | ---------------- | ----- | ----- |
| 0 analysis | 🟢 done | 2377408 | n/a | translation PASS | arch: SPA + showPage + I18N in study.js + speakGerman + make-www.js |
| 1 skeleton | 🟢 done | 1f78016 | www synced | translation PASS, syntax OK | 16 cats, search UI, responsive CSS, no content |
| 2 pronouns+articles | 🟢 done | (this commit) | www synced | check-ref-stage2 PASS, translation PASS | 12 topics, exact pronoun tables, kein/nicht |
| 3 prepositions+cases | ⬜ todo | — | — | — | TODO: mit/gestern/ماضي search hits land here |
| 4 time+past | ⬜ todo | — | — | — | — |
| 5+ | ⬜ todo | — | — | — | per-stage scope, no cross-stage content |

TODO / Later (out of current scope, do not implement now):
- Full cross-reference search ranking (stage 10): mit, ماضي, gestern currently only in later-stage data.
- Stage-10 acceptance: matching result in first 3 for mit/Dativ/ماضي/gestern/ضمائر/nicht.
