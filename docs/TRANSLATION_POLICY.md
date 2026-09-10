# Translation Policy — Deutsch Master

Single source of truth: `client/study.js` → `const I18N = { ar, en, de }`.
Consumers: `t(key)` / `tv(key)` / `applyLang()` (same file), `data-i18n`,
`data-i18n-ph`, `data-i18n-title`, `data-i18n-aria` attributes in HTML.
No `client/i18n|locales|lang|translations` directories exist — do not create
parallel systems. Enforcement: `node tools/check-translations.js` (exit 0/1).

## DO NOT translate (keep as-is)

1. German educational content (words, sentences, examples, quiz Q/A, Kapitel names
   like "Kapitel 1 – Guten Tag", bank data such as `SENT_FILL`)
2. User-generated content (`S.customWords`, word-form inputs `nwDe/nwAr/...`)
3. Proper names (`Deutsch Master`, `Capacitor`) and brand/product names
4. Course/chapter identifiers (`K0`–`K5`, `KX`)
5. Technical identifiers (`chapterId`, `lessonId`, `SENT_FILL`, `localStorage`, `API`, `HTML`, `CSS`, `JavaScript`)
6. Programming code, URLs, file paths, CSS selectors, JS identifiers, regexes,
   internal app IDs, language codes (`ar`, `en`, `de`, `RTL`, `LTR`)

## DO translate (must use a key in ar+en+de)

Navigation, buttons, labels, titles, headings, tooltips, placeholders, alerts,
toasts, error messages, empty states, settings, dashboard UI, quiz UI, game UI
chrome, smart-training UI, smart-review UI, profile UI, notifications, filters.

## Phase-10 rule for new UI

Never hardcode interface text:

```js
button.textContent = "Start";          // BAD
button.textContent = t("quiz_start");  // GOOD (key must exist in ar+en+de)
```

```html
<h2>NEU</h2>                          <!-- BAD -->
<h2 data-i18n="title_new">NEU</h2>     <!-- GOOD -->
```

Fallback rule: `t()` returns the key itself when missing — the validator treats
any missing key as FAIL, so fallback must never be used to hide gaps.
