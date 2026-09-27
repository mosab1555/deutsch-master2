# Reference v2 implementation plan (internal, not shown in app)

Architecture: knowledge base, 16 paths A..P, 72 topics, unified template
(Title/what/rule/tables/examples/notes/mistakes/related/quiz).
Engine: client/reference.js. Data: client/reference-data-*.js (pure data).
Quality gate: node tools/check-reference.js (all counts must be 0).
i18n: UI chrome via I18N keys (ar/en/de); titles trilingual inline;
explanations Arabic + German examples (project Translation Policy convention).

| Stage | Status | Checkpoint | Tests | Notes |
| ----- | ------ | ---------- | ----- | ----- |
| 1 arch & data model | 🟢 done | 8c5f536 | translation PASS | reuses quiz-opt/ex-table/speakGerman/i18n/showPage-wrap; links to explain.js lessons instead of duplicating |
| 2 paths A-P + engine | 🟢 done | 8c5f536 | syntax OK | 16 paths, breadcrumbs, chips, B1 collapse, quiz gate refValidQuiz, ranked search |
| 3 B nouns/articles + C pronouns | 🟢 done | 7a52342 | data PASS | migrated old pronouns/articles content, no deletion |
| 4 D cases + comparison | 🟢 done | 19f04f9 | data PASS | central 4-case table |
| 5 E adjectives + F verbs | 🟢 done | a07d2c6 | data PASS | Steigerung, Modalverben, trennbar/untrennbar, sein/haben/werden |
| 6 G tenses + J time/date | 🟢 done | 7abc178 | data+search PASS | haben/sein rule, Partizip II, 24+ Zeitwörter |
| 7 H prepositions | 🟢 done | 3a2eeb4 | data+search PASS | Wo/Wohin with in der/in die; stopword-calibrated ranking |
| 8 I questions/negation/conjunctions | 🟢 done | a004bd4 | data PASS | W/Ja-Nein/Modal/Perfekt, nicht vs kein, weil-V-Ende |
| 9 A basics + M sentence | 🟢 done | e331f1c | data PASS | Alphabet/Aussprache, Wortarten, V2, TMP |
| 10 K numbers/quantity + L place | 🟢 done | 9b12f61 | data PASS | Zahlen, Ordinal, viel/viele, Wo/Wohin/Woher |
| 11 N punctuation + O phrases | 🟢 done | 3382271 | data PASS | 10 marks, 4 situation groups |
| 12 P comparisons + errors | 🟢 done | 36e7149 | data PASS 72/72 | 14 comparisons, 15 errors |
| 13 word cards: 26 preps + 8 verbs + 11 Q-words + der/ich/weil/gestern | 🟢 done | 2cf8e6a, 14ded31, 218b629 | data+search PASS | every word = full unit (meaning/case/examples/mistake/quiz) |
| 14 full paradigms + opposites + Lageverben + per-error rule links | 🟢 done | b722e33 | data PASS 122/122 | meiner/jener/derjenige/welcher/dessen/einer, ein/kein/mein compare, Gegenteil, nicht position, tense compare, obwohl/deshalb/trotzdem, 36 Zeitwörter, numbers in life, dialogues |
| 13 search + related | 🟢 done | engine | 9/9 queries top-3 | de/ar/en/title/examples/keywords/related, live |
| 14 quizzes + speech | 🟢 done | engine+data | gate enforced | invalid questions never render; speakGerman fallback chain |
| 15 i18n | 🟢 done | — | translation PASS | 0 missing/duplicate/empty |
| 16 responsive + perf | 🟢 done | — | static review | ~145KB total, 1 topic in DOM, capped search, wrapped tables |
| 17 regression + deploy | 🟢 done | (this commit) | search 25/25, QA 89/89 | push main, HEAD==origin/main |

TODO / Later (none blocking):
- Manual browser pass on 360×800 / 390×844 (no automation available here).
- B1 topics (Genitiv details, Adjektivdeklination) are collapsed by design.
