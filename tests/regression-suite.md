# Regression Suite — run after any fix, before every push

Prioritized. A single FAIL blocks the release.

> Tooling hygiene: run tools by EXPLICIT list (below). Never `node tools/*.js` blindly:
> `inject-version.js` rewrites HTML in place and `make-www.js` regenerates `www/`
> as side effects. Run those two only intentionally.

## P0 — must always pass (core learning + data + deployment + runtime)

```powershell
node tools/audit-curriculum.js      # VOC-008 GRAM-001 DATA-001
node tools/smoke-curriculum.js     # SENT-001 DATA-001
node tools/test-progress.js        # PROG-001..006 PROG-009 TEST-004 ERR-004 (+T5b-d counted flag)
node tools/test-upgrade.js         # GRAM-002 MIST-001 MIST-002 TEST-001 PWA-005
node tools/test-robustness.js      # PROG-010 ERR-* UI-005 UI-006 PWA-007 NAV-002 + R31-36 answer guards
node tools/check-links.js          # REF-005 DATA-002
node tools/test-career.js          # NAV-005 DATA-003
node tools/test-sw-update.js       # PWA-001 PWA-002 PWA-003
node tools/check-testplan.js       # catalog validity
node tools/test-howto.js           # GUIDE-001..006 (study methodology guide)
node tools/test-auth-identity.js     # AUTH/DATA isolation: sign-out, A/B separation, queue binding, snapshots (node part)
node tools/test-auth-identity.js --cdp  # + real-browser DOM/storage seams (needs Chrome; ~1 min)
node tools/test-auth-dom.js          # auth-screen DOM wiring: tabs/toggles/recovery/validation, zero errors (needs Chrome; ~1 min)
node tools/runtime-qa.js           # 66 headless-Chrome runtime checks (needs Chrome; ~6 min)
```

## P1 — full sweep (everything else automated)

```powershell
node tools/qa-audit.js
node tools/test-smart.js      # note: 1 known flaky tail (adaptive targeting) — rerun once on FAIL, confirm pass, log it
node tools/test-search.js
node tools/test-quiz-shuffle.js
node tools/test-adv.js
node tools/test-push.js
node tools/test-labsx.js
node tools/test-labsx-dom.js
node tools/test-flashdir.js
node tools/test-languages.js
node tools/check-translations.js
node tools/check-reference.js
node tools/check-ref-dom.js
node tools/check-ref-dups.js
node tools/e2e.js
node tools/inject-version.js   # PWA-004 (rewrites ?v= in place; idempotent)
```

## Post-suite gates

1. `git diff --check` clean (whitespace).
2. If `client/*` changed: `npm run www` and confirm `www/` synced (PWA-007 check proves it).
3. Review staged diff: no secrets, no unrelated files.
4. Commit → push → `HEAD == origin/main` → spot-check live site.

## Last full run (2026-10-02, stage 2)

All P0+P1 suites PASS + `runtime-qa.js` 66/66. Catalog: 117 PASS / 1 BLOCKED (PWA-009 install-half).
Fixed this cycle: curriculum `shuf` scope crash, quiz double-count (`counted:true`),
mistakes-v2 feature parity (skill filter/badge/why/history, career retry route),
order-question timer + double-submit guards. Known flakes: `test-smart` adaptive-targeting
(~1/6 runs, pre-existing, passes on rerun).
