# Deutsch Master — Content Schema (Library v2)

Source of truth: `client/content/src/*.json` (sharded, deterministic output of
`tools/build-*.js`). Runtime: `client/content/dm-*.js` (compact rows; CORE packs
push to `__dmLibChunks` merged by `client/content/dm-lib.js`; LAZY packs push to
`__dmLazyChunks` merged on demand by `client/content/dm-lazy.js`). Never hand-edit
generated files — change `tools/clib/*` data or the builders and re-run the pipeline:

```
node tools/build-content-library.js   # stage 1 vocab (+BIG verbs/nouns/compounds)
node tools/build-sentences.js         # stage 2 sentences (310 patterns, repairs)
node tools/build-grammar-dialog.js    # stage 3 grammar (900) + dialogues (1000)
node tools/build-grammar2.js          # stage 3b grammar micro-units (lgSSNNN)
node tools/build-dialogs2.js          # stage 5 dialogues -> 10,000
node tools/build-rlx.js               # stage 6 reading/listening/exams
node tools/build-exercises.js         # stage 4 exercises (500k+, FULL gate)
node tools/build-emit.js              # stage 7 emit packs + manifest + dm-lazy
node tools/content-quality-gate.js --cache        # full-dataset audit
node tools/content-quality-gate.js client/content/src  # emitted-pack audit
node tools/test-content-merge.js      # runtime merge smoke (manifest-driven)
```

Every stage validates its batch with the Quality Gate **before** insertion.
Rejected records are logged to `tools/clib/.cache/rejected.json` with reasons
and never enter the dataset. Exit code != 0 = do not build/deploy.

## 1. Vocabulary
`{id, de, art, ar, en?, level, cat, type, plural?, head?, ex?, exAr?, parts?, sep?, reg?, comp?, sup?, femOf?}`
- `id`: `lv00001…` (unique across ALL types).
- `type`: noun|verb|adj|pron|adv|conj|prep|num|phrase|func.
- `art`: der|die|das for nouns, `-` otherwise. **Never invent articles/plurals.**
- `plural`: plural form, or `"-"` for plural-less nouns (mass/abstract/countries).
- `level`: A1|A2|B1. `cat`: fixed taxonomy (see gate CATS).
- Homographs across word classes are legitimate separate entries
  (e.g. noun `Essen` vs verb `essen`); same spelling + same class = duplicate.
- App mapping (`dm-lib`): type→اسم/فعل/صفة/ضمير/مفردات/أداة, cat→existing
  `CATEGORIES` where possible, else kept as new filter chips.

## 2. Sentences
`{id, de, ar, level, topic, kap, gram[], vocab[]}`
- `id`: `ls00001…`. German ends with `.`/`?`/`!`, ≥3 words, Arabic required.
- `gram[]`: library grammar ids (`lg0102`); `vocab[]`: library vocab ids.
- Duplicates: exact/whitespace/case-insensitive rejected; near-duplicates
  (token Jaccard > 0.92, windowed) rejected.
- App mapping: `gram` display field left empty (library links live in
  `DM_LIB.gramForSentence`), `src:"lib"`, kap K1..K5 (A1) / KX (A2·B1).

## 3. Grammar micro-units
`{id, title, deTitle, kap, level, cat, topicId, unit, kind, body, examples[[de,ar]x2], mistakes[], related[], quiz{q,opts,correct,explain}}`
- `id`: `lgTTUU` (topics 01–60, stage 3) or `lgSSNNN` (series 51–83, stage 3b).
- `body` ≥ 80 chars: ما هو / لماذا / كيف / examples / (contrast only) common mistake.
- `kind`: `contrast` (wrong/right pair) or `classify` (which example fits?).
  Classify units borrow a **sibling example from the same topic** (real,
  validated, marked in body) — never fabricated German.
- Series 3b covers: separable/inseparable verbs, verb+preposition (+case),
  dative/ditransitive/reflexive verbs, verb spotlights, mistake contrasts,
  declension cells, pronoun tables, sentence-transformation families,
  connectors, prepositions, tenses, registers, word formation, NVV/FVG.
- `related[]`: unit ids, all must resolve (re-chained after rejects, never dangling).
- App mapping: pushed to `GRAMMAR` (native shape) + 60 topic overlays in
  `DMRefEncy.overlays` (no aliases → no broken links).

## 4. Exercises
`{id, type, prompt, choices[], answer, level, ref[], kind, kap, words?|lines?, why}`
- `id`: `le00001…` (5 digits; 500k+ bank). Types: article|plural|choice|translate|
  conjugate|gap|order|correct|classify|dialogue|listen|truefalse (+gap-style prompts
  with `___` so Smart Training `smFills` picks them up; `kind:"order"` for ordering).
- Rules: choices ≥3 (unique, normalized), answer index valid and pointing at
  the true answer, gap prompts contain `___`, order has `words[]` (≥3),
  truefalse has boolean-compatible answer, `ref[]` must resolve to
  vocab/sentence/grammar/dialogue/reading/listening/exam ids.
- 4-choice answer positions rotated uniformly (no position bias, verified 25/25/25/25).
- Conjugation answers use the full tested engine (stems, separable, -eln/-nen);
  participles come from curated principal parts only.
- App mapping: pushed to `SENT_FILL` as `{s,o,c,…kind,typ:"<type>",ctx:"lib"}`
  (**deferred** core packs merged on DOMContentLoaded; lazy packs merge on demand).

## 5. Dialogues
`{id, level, topic, titleDe, titleAr, lines[[speaker,de,ar]…]}`
- `id`: `ld0001…` (10,000). ≥4 lines, ≥2 speakers, every line has German + Arabic.
- 30 hand-authored situations × twists × levels × lengths × mixed-radix
  pool rotation (exact-duplicate rejection).
- App mapping: `window.DM_DIALOGS` + `CURR_READING` entries (`lr…`, kap `""`,
  deterministic comprehension question each).

## 6. Reading / Listening / Exams
- Reading `{id(lr…), title, titleAr, level, topic, de, ar, questions[{q,choices,answer}], vocab[], grammar[]}`:
  non-overlapping partitions of the sentence bank (no sentence reuse), 2
  questions each (detail + vocabulary-in-context), refs resolve. Maps to
  `CURR_READING` (`{id,level,kap,title,de,ar,qs}`) at runtime.
- Listening `{id(ll…), level, topic, titleDe, titleAr, lines[[sp,de,ar]], questions, vocab, grammar, audio:{tts:true,rate}}`:
  dialogue excerpts + sentence-derived scripts. Maps to `window.DM_LISTENING`.
- Exams `{id(lx…), level, topic(+mixed), title, titleAr, skills[], types[], count 5..100, timed, seconds}`:
  stride-sampled level×topic×skill×size×timed configurations (all distinct).
  Maps to `window.DM_EXAMS`. The exam engine pulls questions from the bank.

## 7. Pack architecture (core + lazy)
- `client/content/manifest.json` (v2): every pack lists `src/runtime/kind/
  count/load(core|sync|defer|lazy)/bytes`. Core packs keep baseline names and
  load order (fast boot, precached). Lazy packs (`dm-*-NN.js`, N past core)
  are fetched on demand or via bounded idle prefetch (~12MB, never exercises).
- `dm-lazy.js` (precached, versioned): `DM_LIB_MORE.merge/loadPack/loadKind/
  searchAll` + `dm-lib-lazy-ready` events. Never throws; dedups by id.
- Search: `DM_LIB.search` (core, lazy index) + `DM_LIB_MORE.searchAll`
  (core + lazy rows). Flashcard/Smart-Training consumers read the same
  globals, so prefetched packs flow into decks and training automatically.
- Service worker precaches CORE files only; lazy packs use the existing
  network-first script handler (offline after first load).

## 8. Relationship graph (no content duplication, ID references only)
- word → sentences: `DM_LIB.sentsForWord(wid)` (≤20).
- sentence → grammar/vocab: `libGram`, `libVocab` (+ `DM_LIB.gramForSentence`).
- grammar → units/topics: `related[]`, `topicId`.
- exercise → content: `ref[]` / `libRefIds`.

## 9. Validation rules enforced by the gate
Schema presence · German structure (punctuation, no Arabic leakage, noun
capitalization, sentence length, no unfilled `{…}` placeholders) · Arabic
presence (Arabic-script check) · article/plural convention (`-` = plural-less;
separable-participle sanity) · allowed level/cat/type values ·
duplicate + near-duplicate detection (scale-safe bucketed Jaccard for 150k+) ·
reference integrity (incl. reading/listening/exam refs) · exercise answer
validity (index, uniqueness, gap blank, order words) · template-cluster and
answer-position warnings · level distribution report.
