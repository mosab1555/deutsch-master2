# Egypt Data-Processing Notice — Internal Draft (C4)

**Status: INTERNAL DRAFT — NOT legal advice, NOT approved, NOT published.**
Date: 2026-10-18 · HEAD: `225117550f0c1bc5fbb08c8936ea4e0428c3434e` · Prepared in the C4 session.
Nothing in this file may be copied into `client/privacy.html` / `client/terms.html` (or any public page) before owner + legal counsel sign-off. Public pages keep the current honest "open items" wording.

## 1. Verified legal facts (with sources — counsel must re-verify against the Official Gazette Arabic text)

Facts below were verified on 2026-10-18 against public summaries and English translations of the Egyptian framework, not against the certified Official Gazette copy held by counsel. Article numbers come from those sources (including the ILO NATLEX English translation of Law 151/2020 and the Arabic Official-Gazette reproduction of Decree 816/2025 listed below) and MUST be checked by counsel.

1. **Primary law:** Personal Data Protection Law No. 151 of 2020 (PDPL). Regulator: Personal Data Protection Center (PDPC).
2. **Executive Regulations:** issued by the **Minister of Communications and Information Technology** Decree No. 816 of 2025 (published in the Official Gazette الوقائع المصرية, issue 244 تابع (أ), 1 November 2025; made publicly available in late December 2025). Some English summaries mis-describe it as a "Prime Ministerial" decree — the Arabic Gazette text is the authority. The one-year transitional period is read by practitioners as ending ~1 November 2026 (some commentary suggests end-2026 because of the late public release; the exact deadline must be confirmed by counsel).
3. **Children's data:** children's personal data is treated as a sensitive category (PDPL Art. 12). Processing requires the **explicit written consent of the guardian for children under 15** (paper or electronic, time-limited and revocable); for the 15–18 band, consent of the child or the guardian applies. Mechanisms for obtaining/verifying children's consent are **subject to approval by the PDPC** (Executive Regulations Art. 15, read with Art. 14). Secure electronic records evidencing those consents are required (Executive Regulations Art. 14(7)).
4. **Cross-border transfer:** PDPL **Chapter Seven, Arts. 14–16** (NOT Art. 22 — Art. 22 concerns PDPC Board meetings) governs transfers outside Egypt: generally prohibited unless the destination provides an equivalent level of protection and a licence/permit is obtained from the PDPC, with limited exceptions (e.g. explicit consent, contract necessity) under Art. 15. Whether this project's hosting (Supabase; default regions outside Egypt) needs a specific licence/permit is an open legal question — do NOT claim compliance either way on public pages.
5. **Consent and notices (PDPC guidelines as reported):** privacy information must be available in Arabic; consent must be explicit, informed, specific, freely given, requested separately from the privacy notice and general terms, and withdrawable without friction. These match the project's own design constraints (separate `privacy_notice` / `terms_of_service` acknowledgement types, no bundled checkbox), but are not yet implemented for learners.
6. **Transitional reality:** the platform is not yet registered/notified with the PDPC; no transfer licence is held; no PDPC-approved children's-consent mechanism exists in-app. All are owner actions with counsel.

**Sources used (titles, links, retrieved 2026-10-18 via web search):**
- Law 151/2020 English translation (NATLEX/ILO): https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/111246/EGY111246%20Eng.pdf — cross-border Arts. 14–16; sensitive data Art. 12.
- Decree 816/2025 Arabic text (law-firm reproduction of the Official Gazette publication): https://alhasswalawfirm.com/law-library/decree-816-2025 — Arts. 14–15 children's/sensitive consent; written-consent and record-keeping duties.
- Chambers & Partners, *Data Protection & Privacy 2026 — Egypt*: https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/egypt — grace period to 31 Oct 2026; children's-data rules; licence/permit and cross-border requirements.
- CMS, *Egypt's PDPL: Executive regulations issued — one year compliance countdown begins*: https://cms.law/en/int/legal-updates/egypt-s-pdpl-executive-regulations-issued-one-year-compliance-countdown-begins — issuance 1 Nov 2025, public release 25 Dec 2025, enforcement expected 1 Nov 2026, Arabic-language notice/consent guidance.
- Access Partnership, *Egypt Finalises Executive Regulations to the PDPL*: https://accesspartnership.com/opinion/egypt-finalises-executive-regulations-to-the-personal-data-protection-law-pdpl/ — cross-border licence/permit model; 72-hour breach notification.
- Kennedys, *Egypt's PDPL — the compliance countdown has begun*: https://www.kennedyslaw.com/en/thought-leadership/article/2026/egypt-s-personal-data-protection-law-the-compliance-countdown-has-begun/ — consent separability, Arabic consent, affirmative action.
- Official texts still to be obtained by counsel: the Official Gazette publication of Decree 816/2025 and Law 151/2020 (Arabic certified copies).

## 2. Data map (verified against the repository, not aspirational)

| Data | Where it lives now | Purpose | Status / notes |
|---|---|---|---|
| Learning state (progress, SRS, preferences, UI language) | Device only (`localStorage`/IndexedDB) | Deliver the learning experience | Works offline; wiped by the in-app local wipe |
| Account identity (email, hashed password / OAuth) | Supabase Auth (learner project) | Sign-in | Publishable key only in client; no privileged key ever |
| Sync data `profiles` / `user_progress` / `sync_queue` / `devices` | Supabase Postgres, own-row RLS | Cross-device sync | CASCADE-deleted with the account once deletion ships |
| `auth_events` | Supabase Postgres | Sign-in audit/abuse detection | Rows kept with `user_id = NULL` after account deletion (anonymized) |
| Academy preview data | Separate **Staging** Supabase project | Internal pilot preview | Production Pages artifact excludes academy pages |
| Consent records `consent_records` | **Prepared, NOT applied** (`supabase/migrations/20261018000000_consent_records.sql`) | Record a student's own acknowledgement of privacy notice / terms + policy version + coarse age band | Recording disabled by default (`client/dm-consent.js`; `DM_CONSENT_CONFIG` absent = off) |
| Ads / analytics / trackers | — | — | None (matches `privacy.html`) |

## 3. Draft notice text (Arabic — FOR REVIEW ONLY, do not publish)

> **مسودة إشعار معالجة البيانات (مصر) — قيد المراجعة القانونية، غير منشور**
>
> - **المتحكم في البيانات:** [اسم الكيان القانوني — يُحدد]، مصر. بيانات التواصل: [قناة رسمية — تُحدد].
> - **ما نعالجه:** بيانات التعلم على جهازك؛ بيانات الحساب (البريد)؛ بيانات المزامنة (التقدم والأجهزة وسجل دخول مجهول بعد الحذف).
> - **الأغراض:** تقديم الخدمة التعليمية، الأمان، والمزامنة عند تفعيلها. لا إعلانات ولا تتبّع تسويقي.
> - **الأساس القانوني:** [مسودة: تنفيذ الخدمة / موافقة صريحة للاختياري / التزامات قانونية — تُعتمد قانونيًا].
> - **بيانات الأطفال (حساسة قانونًا):** المنصة موجّهة لجمهور واسع؛ التطبيق لا يجمع موافقة ولي الأمر داخل التطبيق. للفئة دون 15 يتطلب القانون موافقة كتابية صريحة من ولي الأمر، وآليات معتمدة من مركز حماية البيانات الشخصية — [غير مطبقة، قيد التصميم].
> - **النقل خارج مصر:** الاستضافة خارج مصر بحكم إعدادات مقدّم الخدمة السحابية — [تقييم النقل والتراخيص مطلوب قانونيًا].
> - **الاحتفاظ:** مدة الحساب + [فترات الاحتفاظ تُحدد قانونيًا]؛ سجلات الدخول تُجهَّل الهوية عند حذف الحساب.
> - **الحقوق:** الوصول/التصحيح/الحذف/سحب الموافقة — قنوات ممارسة الحقوق: [تُحدد].
> - **الشكاوى:** مركز حماية البيانات الشخصية (PDPC) — [الإجراء يُحدد].

## 4. Gaps / open items (owner + counsel)

1. Legal entity name, address, and official contact channel for rights requests (public pages currently list this as an open item).
2. Controller/processor classification for the platform, Supabase, and any academy partner.
3. PDPC registration/notification necessity and timeline (transitional period ends ~1 Nov 2026 — act early).
4. Cross-border transfer assessment (regions used, safeguards/licence if required).
5. Children's-data decision: target audience statement, age verification strength (if any), PDPC-approved guardian-consent mechanism for the academy process; whether in-app under-15 self-service accounts are acceptable at all.
6. Retention schedule (including consent proof: currently `consent_records` rows CASCADE-delete with the account — see `ACCOUNT_DELETION_BLOCKER.md` Update 2026-10-18).
7. Policy versioning: assign the first approved `policy_version` string before enabling `DM_CONSENT_CONFIG`.
8. Academy preview: staging-only today; the same notice questions apply before any real student data (even in pilot).
