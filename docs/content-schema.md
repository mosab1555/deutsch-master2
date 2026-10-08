# Deutsch Master — Content Schema (Library v1)

Source of truth: `client/content/src/*.json` (sharded, deterministic output of
`tools/build-*.js`). Runtime: `client/content/dm-*.js` (compact rows) merged by
`client/content/dm-lib.js` into the live app globals. Never hand-edit generated
files — change `tools/clib/*` data or the builders and re-run the pipeline:

```
node tools/build-content-library.js   # stage 1 vocab
node tools/build-sentences.js         # stage 2 sentences
node tools/build-grammar-dialog.js    # stage 3 grammar + dialogues
node tools/build-exercises.js         # stage 4 exercises (+FULL gate)
node tools/build-emit.js              # stage 5 emit packs
node tools/content-quality-gate.js client/content/src   # audit (exit 1 on error)
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
- `id`: `lgTTUU` (topic 01–60, unit 01–15) = 900 units.
- `body` ≥ 80 chars: ما هو / لماذا / كيف / examples / (contrast only) common mistake.
- `kind`: `contrast` (wrong/right pair) or `classify` (which example fits?).
  Classify units borrow a **sibling example from the same topic** (real,
  validated, marked in body) — never fabricated German.
- `related[]`: unit ids, all must resolve (pruned, never dangling).
- App mapping: pushed to `GRAMMAR` (native shape) + 60 topic overlays in
  `DMRefEncy.overlays` (no aliases → no broken links).

## 4. Exercises
`{id, type, prompt, choices[], answer, level, ref[], kind, kap, words?|lines?, why}`
- `id`: `le00001…`. Types: article|plural|choice|translate|conjugate|gap|
  order|correct|classify|dialogue|truefalse (+gap-style prompts with `___`
  so Smart Training `smFills` picks them up; `kind:"order"` for ordering).
- Rules: choices ≥3 (unique, normalized), answer index valid and pointing at
  the true answer, gap prompts contain `___`, order has `words[]` (≥3),
  truefalse has boolean-compatible answer, `ref[]` must resolve to
  vocab/sentence/grammar/dialogue ids.
- 4-choice answer positions rotated uniformly (no position bias).
- App mapping: pushed to `SENT_FILL` as `{s,o,c,…kind,typ:"<type>",ctx:"lib"}`
  (**deferred** packs, merged on DOMContentLoaded; core app never waits).

## 5. Dialogues
`{id, level, topic, titleDe, titleAr, lines[[speaker,de,ar]…]}`
- `id`: `ld0001…`. ≥4 lines, ≥2 speakers, every line has German + Arabic.
- 125 hand-authored situations × 8 slot-variants (names/places/times/items).
- App mapping: `window.DM_DIALOGS` + `CURR_READING` entries (`lr…`, kap `""`,
  deterministic comprehension question each).

## 6. Relationship graph (no content duplication, ID references only)
- word → sentences: `DM_LIB.sentsForWord(wid)` (≤20).
- sentence → grammar/vocab: `libGram`, `libVocab` (+ `DM_LIB.gramForSentence`).
- grammar → units/topics: `related[]`, `topicId`.
- exercise → content: `ref[]` / `libRefIds`.

## 7. Validation rules enforced by the gate
Schema presence · German structure (punctuation, no Arabic leakage, noun
capitalization, sentence length) · Arabic presence (Arabic-script check) ·
article/plural convention (`-` = plural-less) · allowed level/cat/type values ·
duplicate + near-duplicate detection · reference integrity · exercise answer
validity (index, uniqueness, gap blank, order words) · template-cluster and
answer-position warnings · level distribution report.
