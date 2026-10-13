# CONTENT BALANCE REPORT — Deutsch Master (A1–B2)

Generated: 2026-10-13. Source of measurements: `client/content/src/*.json`
(151 files, source of truth), `client/content/dm-*.js` runtime packs,
`client/play.js` (`SENT_FILL`), `client/curr-*.js` overlays, `client/curriculum.js`
merger, `client/content/dm-lib.js` / `dm-lazy.js`, `client/assess.js` /
`client/testcenter.js`, plus `tools/content-inventory-audit.js` (re-ran
2026-10-13, all parities match) and `tools/smoke-curriculum.js` (13/13 PASS).

Owner-reported sentence-training figures (fill 32,234; order 9; qa 5;
correct 6; error 9; transform 6; situational 6) were treated as unverified
claims and independently reconstructed below.

---

## 1. Counting methodology (what each number measures)

Three count layers must never be mixed in one table:

| Layer | Definition | Example |
|---|---|---|
| **T — templates / source records** | Physical rows in `content/src/*.json` | 697,330 ex rows |
| **Q — executable questions** | Items the learner can actually open (after load-condition + filters) | SENT_FILL at boot |
| **G — generated variants** | Runtime-built from pools (assess factories, `currBuildFills`) | placement questions |

`sentexTypeCounts()` (`client/sentex.js:171`) counts **Q-layer** `SENT_FILL`
entries by `kind`. `SENT_FILL` is filled from three independent sources:

1. **Static** (`client/play.js`, `const SENT_FILL=`): 137 hand-written items.
2. **Library drills** (`dm-lib.js mergeEx`, once at `DOMContentLoaded`):
   every `ex` row from boot-loaded packs (`dm-ex-01..04`, `defer`) is pushed
   with `kind = (q.kind === "order" ? "order" : "fill")`.
3. **Curriculum-generated** (`curriculum.js currBuildFills`, once per merged
   CURR dataset): one gap-fill per usable word/grammar example, no `kind`
   field (= counts as `fill`).

---

## 2. Verified initial counts

### 2.1 Library banks (T-layer, ground truth from src)

| Bank | Total | A1 | A2 | B1 | B2 |
|---|---|---|---|---|---|
| vocab | 104,640 | 51,975 | 34,658 | 16,315 | **1,692** |
| sentences | 150,000 | 59,156 | 60,537 | 30,307 | **0** |
| grammar | 3,069 | 1,039 | 1,387 | 643 | **0** |
| exercises (ex) | 697,330 | 251,855 | 300,658 | 144,817 | **0** |
| dialogues | 10,000 | 3,598 | 4,775 | 1,627 | **0** |
| reading | 5,000 | 2,000 | 2,000 | 1,000 | **0** |
| listening | 10,000 | 4,117 | 4,477 | 1,406 | **0** |
| exams | 10,000 | 3,334 | 3,333 | 3,333 | **0** |

IDs unique in every bank (0 duplicate IDs, 0 duplicate sentence texts,
0 duplicate vocab keys per inventory audit). Validity 100% by structural
criteria (non-empty DE/AR fields). **Structural validity is NOT a claim of
linguistic correctness** — generator artefacts exist (see §5, R6).

`ex` bank by `kind`: `fill` 644,690 (types article/plural/choice/gap/
translate/conjugate/classify/dialogue/listen/truefalse/correct) vs `order`
52,640 — all order rows live in `ex-74..ex-80` (lazy packs, see R2).

### 2.2 Base banks (boot, Q-layer before library merge)

- Base vocab (procedural, `script.js buildVocab`, all A1): 853 words
  (`RAW_K0..K5`), K0–K5 mapped.
- Base sentences (`RAW_SENT`): 107 items, K1–K5.
- `sent-a1.js`: 352 curated A1 rows (K0–K5) + runtime import of VOCAB
  examples into the sentences view (dedup by normalized key) — the
  sentences view therefore skews further toward A1 at runtime.
- Static `SENT_FILL` (`play.js`): **137 items, 137 unique IDs.**

### 2.3 CURR overlays (original curriculum content, T-layer)

| Level | Words | Grammar | Sentences | Reading | Listening | Speaking | Situations |
|---|---|---|---|---|---|---|---|
| A1 (A1X) | 1,043 | 6 | 30 | 2 | 0 | 0 | 2 |
| A2 (A2+A2B) | 302 | 18 | 66 | 3 | 0 | 0 | 5 |
| B1 (B1+B1B) | 308 | 18 | 66 | 3 | 0 | 0 | 5 |
| B2 (B2+B2B+B2C+B2D+B2E) | 670 | 70 | 394 | 25 | 0 | 0 | 14 |

CURR sentences carry **real** chapter IDs (K6–K25). CURR listening = 0
everywhere (listening served by base `LISTEN_ITEMS` + lazy `lis` bank).

### 2.4 Sentence-training types (Q-layer — the reported imbalance)

Static `SENT_FILL` by type (`sentexTypeOf`):

| Type | Static | Level | Chapters |
|---|---|---|---|
| fill | 98 | A1 98 (A2 23/B1 10 are `lvl`-tagged fills inside the 137: 104 A1 / 23 A2 / 10 B1) | K0–K5 |
| order | **9** | A1 only | K0–K5 |
| qa | **7** | A1 only | K0–K5 |
| correct | **7** | A1 only | K0–K5 |
| error | **6** | A1 only | K0–K5 |
| transform | **6** | A1 only | K0–K5 |
| sit | **4** | A1 only | K0–K5 |

Runtime composition of `SENT_FILL` (verified mechanism, §3):

| Source | Fill-kind | Other kinds |
|---|---|---|
| static (`play.js`) | 98 | 39 (9/7/7/6/6/4) |
| library boot merge (`dm-ex-01..04` = 30,200 rows, all `kind: fill`) | 30,200 | 0 |
| curriculum-generated (`currBuildFills`, all 10 datasets) | ~1,900 (smoke subset measured 1,896) | 0 |
| **runtime total** | **≈ 32,200–32,400** | **39** |

Owner figure **32,234 = 30,200 + 98 + ~1,936 generated** (merge-order
variance accounts for single/double-digit drift; verified bracket
30,337 + ~1.9–2.0k). **BROWSER-VERIFIED 2026-10-13 (headless Chrome, real
boot over http): after A1 merge, `sentexTypeCounts().fill` = 32,234 —
the owner's figure reproduced TO THE DIGIT**
(`SENT_FILL` = 32,803 = 137 static + 180 sentx + 30,200 lib + 2,286
CURR-generated: 1,936 fills + 350 orders).
**The fill imbalance is REAL** (three orders of
magnitude), but it is a **category error**: ~30k of the 32k are
vocabulary drills (article/plural/choice prompts such as
`___ Frau (المرأة)`), not sentence practice. They are valid practice with
defensible keys — but presenting them as "تدريبات الجمل" completion is
wrong (R1).

Owner's per-type figures vs verified static counts:

| Type | Owner | Verified (current source) |
|---|---|---|
| order | 9 | 9 ✓ |
| qa | 5 | 7 (Δ — likely filtered view / session state) |
| correct | 6 | 7 (Δ — same) |
| error | 9 | 6 (Δ — same) |
| transform | 6 | 6 ✓ |
| sit | 6 | 4 (Δ — same) |

The Δ rows are **not reproducible from current source**: no code path adds
or removes `qa/correct/error/transform/sit` items (CURR adds none —
verified 0 `kind:` hits in all 10 curr files; lib boot packs add none).
`www/` is byte-identical to `client/` for `play.js`/`sentex.js`, so this is
not a stale-build effect either. Most likely the owner counted from a
chapter-filtered view or an older `play.js` revision. Structural conclusion
is identical either way: **single-digit, A1-only, static items; A2/B1/B2 = 0
in all six non-fill types (before this task's additions).**

### 2.5 Assessments (G-layer + exam bank)

- Tests are **generated at runtime** by `assess.js` factories from live
  pools (`vocabPool/grammarPool/sentPool` filtered by level/kap). Pool
  depth follows content distribution (§2.1–2.3); factories bail honestly
  (`null`) when pools are thin, and `testcenter.js` probes build the real
  spec to display honest available counts.
- The 10,000-row `exam` bank (balanced A1/A2/B1, B2 = 0) is **never read by
  `assess.js`/`testcenter.js`** (0 references to `DM_EXAMS` outside the
  lazy merger) and its packs load only on explicit demand (nothing calls
  `loadKind("exam")`). Dormant content, same class as R2.
- Test Center + placement UI hardcode levels `["A1","A2","B1"]`
  (`testcenter.js` ×2). **No B2 test path exists** although B2 pools are
  non-zero (670 CURR + 1,692 lib words, 70 CURR grammar, 394 CURR
  sentences) and would pass the existing unlock gates
  (`LVL_GATE_WORDS=40`, `LVL_GATE_GRAMMAR=4`).
- Same-base-question repetition: `buildPool` dedups by prompt within one
  build (`seen[q.prompt]`) and supports `excludeIds`; cross-session
  repetition is inherent to generator design (documented, not a bug).

---

## 3. Root causes

- **R1 — Category conflation (counting defect).** `sentexTypeCounts()` and
  the `renderSxHome` header count library vocab-drills (`ctx:"lib"`) as
  sentence-training "fill". Chapter chips K1–K5 are likewise inflated
  (+1,773 A1 lib drills), while 28,427 A2/B1 lib drills sit under the `KX`
  chip — mislabelled "➕ كلماتي المضافة" (my added words) via
  `sentexChapterName()` → `KAPITEL`, although user words never enter
  `SENT_FILL`. Fix: split curated vs library counts in the UI, KX chip
  label sentex-scoped to library content. No pool/filter change.
- **R2 — Dormant exercise packs (wiring gap).** 84 lazy `ex` packs
  (667,130 rows, incl. **all 52,640 `order` items** with real levels
  A1/A2/B1) are never loaded: idle prefetch explicitly excludes `ex`
  ("176MB across 84 packs"), and nothing calls `loadKind("ex")`.
  `dm-lib.js mergeEx` runs once at `DOMContentLoaded` (boot packs only);
  `dm-lazy.js mergeAll` would merge late packs correctly — it is just
  never fed. Same dormancy class: `exam` (10k), `read`/`lis`/`dlg-02/03`
  packs (nothing calls their `loadKind` except vocab/sent views).
  Fix: on-demand ordered loading of the 7 order-bearing packs
  (`ex-74..ex-80`) from sentence training with honest progress
  (established `loadKindProgress` pattern); guarded file list tested by
  `tools/test-sentex-balance.js` against src so rebuilds fail loudly.
- **R3 — No non-fill content exists beyond A1 (content gap).** CURR
  datasets contain zero `kind`-bearing items; the six variety types exist
  only as 39 static A1 rows. Fix order: (1) R2 wiring, (2) rule-correct
  generation from CURR sentences (`currBuildOrders`, real K6–K25 mapping),
  (3) small original batches for qa/correct/error/transform/sit.
- **R4 — Synthetic chapter mapping (known limitation, partly
  pre-disclosed).** Library vocab chapters = `id`-hash (`kapForLevel`,
  A1 only; everything else KX). Library A2/B1 sentences = all KX
  (90,844 rows); A2/B1 ex rows = all KX (ex-01..04: A2 20,573 + B1 7,854
  under KX). Only A1 sentences (K1–K5, ~1,622 per file of 4,000) and A1 ex
  rows carry file-level kaps. Chapter filters over library content are
  therefore meaningless outside A1. Documented here; manifest already
  admits the vocab half ("kapMapped: synthetic-only").
- **R5 — B2 outside the library (content gap, pre-disclosed).** Library
  B2 = 1,692 vocab rows only; everything else B2 = CURR overlays (670
  words / 394 sentences / 70 grammar / 25 reading / 14 situations).
  Assessment UI excludes B2 entirely. Fix: expose B2 in Test Center behind
  existing honest probes; keep placement A1–B1 until B2 pools deepen.
- **R6 — Generator artefacts presented without review flag.**
  Machine-built rows can be semantically absurd while structurally valid,
  e.g. order item `le584461` ("Ich freue mich auf das Intensivasthma"),
  sent `ls00004` ("Der Tourist kann den Unterfriedhof liefern"). Nothing
  marks these as unreviewed in the UI. Fix: report flags + code comment
  + teacher-review list (§7); no mass deletion.

## 4. Balance matrix & target ranges

A1 may stay the largest (foundation). "Balanced" = every level/type has
**enough honest, usable, mapped practice** — not equal totals.

| Area | Verified state | Target (rationale) |
|---|---|---|
| fill (sentence gaps) | ~32k Q (mostly lib drills) | No new content. Honest split label (R1). |
| order | 9 static A1; 52.6k dormant (A1 20.8k K1–K5 / A2 20.9k KX / B1 10.9k KX); B2 0 | On-demand order packs (R2) + generated CURR orders with real chapters: A2 ≥ 20, B1 ≥ 20, B2 ≥ 100 (one mixed session ≈ 20 Q without instant repetition). |
| qa / correct / error / transform / sit | 4–7 static A1 each; 0 elsewhere | Starter sets ≥ 12 valid chapter-mapped items per type × A2/B1/B2 (≈ 60/type total); A1 keeps static. Rationale: one classroom session per type/level. |
| vocab | A1 51,975+853+1,043 / A2 34,658+302 / B1 16,315+308 / B2 1,692+670 | Acceptable as-is except B2 thin → backlog (lexicographic work, out of batch scope). |
| sentences (view) | lib A1 59k / A2 60.5k / B1 30.3k / B2 0 (+CURR 30/66/66/394, +base/a1x/A1-skewed example import) | Acceptable; B2 served by CURR 394. No action. |
| assessments | generated pools scale with content; exam bank dormant; B2 path missing | Wire B2 Test Center level w/ probes; exam-bank wiring = backlog. |
| reading/listening/dialogues | CURR A1 thin (2/0), lazy banks unload-on-demand only | Backlog (out of scope for this batch). |

## 5. Priority order

1. **P0** — Honest counts (R1): curated/library split, KX chip label.
   Zero behaviour change; unblocks truthful UI.
2. **P1** — Order wiring (R2) + `currBuildOrders` generation (R3-half).
   Biggest learner-visible gap closed with existing content.
3. **P2** — Original starter batches qa/correct/error/transform/sit for
   A2 → B1 → B2 (R3-half), one level at a time, structurally validated.
4. **P3** — B2 Test Center level behind probes (R5).
5. **P4** — Chapter-mapping honesty/backlog (R4), exam-bank wiring
   backlog, B2 library backlog (R5), generator-artefact review (R6).

## 6. Items requiring a qualified German teacher (not certified here)

1. All 52,640 lazy `order` rows (structural pass only; sample artefacts §3 R6).
2. All 30,200 boot lib `fill` drills (distractor fit unreviewed).
3. All new `sentx-*` original batches (authored to chapter objectives;
   structural tests pass; native-speaker proofread pending — same residual
   class as the B2C/D/E answer audits in `curriculum-manifest.json`).
4. All `currBuildOrders` generated items (deterministic keys, semantics
   inherited from CURR sentences — spot-check pending).
5. Machine-generated library sentences/vocab examples at large (out of
   scope to review here; never claimed correct).

## 7. Files changed by this task (to be filled during Phases 3–4)

- `client/sentex.js` — honest counts (P0: `sentexCounts2`/`sxIsLib`,
  curated vs library split in header + per-type note, KX chip relabelled
  to library pool), order-pack on-demand load (P1: `SENTEX_ORDER_PACKS`,
  `sxEnsureOrderPacks`, gated type/chapter switches). Pools/filters
  unchanged; zero console errors in headless-Chrome probes.
- `client/curriculum.js` — `currBuildOrders` + one-line merge hook (P1):
  350 generated orders (A1 29 / A2 64 / B1 63 / B2 194, 25 chapters).
- `client/sentx-a2.js`, `client/sentx-b1.js`, `client/sentx-b2.js` (new,
  180 original items, 12/type/level, unique sentences, `o[c]===s`
  key correspondence; proofread pending) + `client/index.html` script tags.
- `client/testcenter.js` — B2 level option (picker + builder, P3;
  lock/probe behaviour unchanged, B2 locked until merged).
- `client/assess.js` — `exam-b2` dispatch + B2 dashboard exam card
  (generic `levelExamSpec`; `startFlow` refuses honestly on thin pools).
- `tools/test-sentex-balance.js` (new, 55 asserts, all PASS).
- `tools/test-tc-runtime.js` — TC-BOOT now expects 4 level buttons.
- `www/` regenerated via `npm run www` (Phase 6).

### Post-change runtime counts (browser-verified 2026-10-13)

| Type | Before (full merge) | After (full merge, before order packs) | After order-pack load |
|---|---|---|---|
| fill | 32,234 (30,200 lib + 98 static + 1,936 curr) | 32,234 (unchanged) | 35,594 (+3,360 fills inside ex-74..80) |
| order | 9 | 359 (9 + 350 generated) | **52,999** (9 + 350 + 52,640 lib; A1 20,858 / A2 20,959 / B1 10,988 / B2 194) |
| qa | 7 | 43 (+36 sentx) | 43 |
| correct | 7 | 43 (+36) | 43 |
| error | 6 | 42 (+36) | 42 |
| transform | 6 | 42 (+36) | 42 |
| sit | 4 | 40 (+36) | 40 |

Loader: 7 packs in ~2 s (local http), `mergeAll` dedup by id, zero
console errors; a real K6 order run renders (chips + progress + level
badge). K6 chapter pools at full merge: fill ~40+, order 22 (T4 byKap),
other five types 4 each (4 sentx items per A2 chapter). Remaining thin
spots: A1 variety types still static-only (K1: 1 each — A1 starter sets =
follow-up), B2 order = 194 generated only (no lib rows exist),
K18–K25 variety types = follow-up.
