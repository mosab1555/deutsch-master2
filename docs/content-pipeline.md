# Deutsch Master — Content Pipeline (how to grow the library safely)

## Order (dependency-driven)

```
1. tools/build-content-library.js   # vocab (rerun-safe: deterministic)
2. tools/build-sentences.js         # sentences (reads vocab.json)
3. tools/build-grammar-dialog.js    # grammar-900 + dialogues-1000 (legacy base)
4. tools/build-grammar2.js          # grammar micro-units (appends, rerun-safe)
5. tools/build-dialogs2.js          # dialogues -> 10k (appends, rerun-safe)
6. tools/build-rlx.js               # reading/listening/exams (appends, rerun-safe)
7. tools/build-exercises.js         # exercises (rebuilds from all banks)
8. tools/build-emit.js              # packs + manifest + dm-lazy.js
```

Every stage validates with `tools/content-quality-gate.js` **before** writing.
Exit codes: `0` = PASS · `1` = data errors · `2` = IO/config error.
Never weaken the gate to hit a number; rejected rows go to
`tools/clib/.cache/rejected.json` (git-ignored) with reasons.

## Adding vocabulary (stage 1)

- Base nouns: `tools/clib/nouns.js|heads.js|more.js` rows `de|art|plural|ar|en|cat|lvl`.
- Base verbs: `tools/clib/verbs.js` rows `inf|sep|reg|ar|en|cat|lvl|parts(prät,pp)`.
  Principal parts must be correct — they feed perfect-tense sentences,
  participle exercises, and prefix-verb derivation.
- Compounds: explicit pairs in `tools/clib/bigvocab.js` (`BIGCOMP`, format
  `head → mod:ar:en`) or category-constrained `MODGEN`/`QMOD`/`MODHEADS`.
  Compounds inherit the head's article/plural. Guards live in the builder:
  `BLOCKHEADS` (never compound), `DENY_DE` (exact bad outputs), head-length
  cap, verb-infinitive collision check, single-word-Arabic rule.
- Prefix verbs: `BIGPREFIX` rows `inf|sep|reg|ar`. Parts derive from the base
  verb automatically (separable keeps `ge` after the prefix: *angerufen*).
- New rows need: correct article/plural, real Arabic, valid `cat`/`level`
  (see gate `CATS`/`LEVELS`). Duplicates merge safely (logged, not errors).

## Adding sentences (stage 2)

- Templates: `tools/clib/sentgen.js` `PATS` (`[de,ar,lvl,topic,gram]`) use only
  fillGeneric-safe slots, or add an override branch in `build-sentences.js`
  for special word order (verb-final, inversion, imperatives, futures).
- Pools: `tools/clib/bigsen.js` (`BIGSUBJ` person-tagged, `BIGTIMES`,
  `BIGPLACES`, valency verb pools). Pool verbs MUST be regular-present or
  have `BIGSTEMS` cover; the tripwire drops violators (logged).
- Intransitive-only verbs never take objects (valency pools); weather
  impersonals stay out of person pools; modal infinitives are transitive-only.
- Object fit: `OBJCATS` (verb → allowed cats/allowlists/persons) keeps
  *wirft/öffnet/isst* on sensible objects.

## Adding grammar (stages 3/3b)

- Legacy topics: `tools/clib/grammar1.js|grammar2.js` (900 units, don't touch).
- New micro-units: data in `tools/clib/biggram*.js` + generators in
  `tools/build-grammar2.js` (series `lgSSNNN`, re-chained `related[]`).
- Every unit: title, ≥80-char body, ≥2 `[de,ar]` examples (composed with the
  tested conjugator or borrowed from validated sibling content — never
  invented), level, self-contained quiz (no two-correct-options).

## Adding dialogues/reading/listening/exams (stages 5/6)

- Dialogue situations: `tools/clib/bigdlg.js` (hand lines `[de,ar,lvl]`).
  Mixed-radix enumeration guarantees distinct line-sequences (seen-set enforced).
- Reading partitions the sentence bank (no reuse); listening reuses dialogue
  windows + sentence groups with fresh questions; exams are stride-sampled
  configurations (all distinct by construction).

## Emitting packs (stage 7)

`tools/build-emit.js` shards by rows: first shards keep baseline names/order
(boot path identical), the rest are lazy (`__dmLazyChunks` + manifest
`lazyIndex`). `dm-lazy.js` is regenerated with the pack index. Core packs stay
precached; lazy packs load on demand (+ bounded idle prefetch, never exercises).

## Checks before commit

```
node tools/content-quality-gate.js --cache
node tools/content-quality-gate.js client/content/src --json tools/content-audit.json
node tools/test-content-merge.js
node tools/runtime-qa.js            # 66/66 required
node tools/check-translations.js && node tools/check-reference.js
node tools/check-ref-dups.js && node tools/check-ref-dom.js
node tools/check-links.js && node tools/qa-audit.js
npm run www                         # regenerate www/ via official process
```

## Hard rules (repeat offenders)

- Never invent articles, plurals, conjugations, participles, or translations.
- Never ship `{…}` placeholders (gate errors).
- Never count trivial substitutions or title-only variants as new content.
- Post-verbal subjects are lowercase (`{Sl}` slot / `lowS()`); formal `Sie` stays up.
- Intransitive verbs never take objects; dative verbs never take accusative persons.
- Arabic agreement (gender/number/dual) goes through the central helpers.
- Keep boot fast: core packs small + sync, everything else lazy.
