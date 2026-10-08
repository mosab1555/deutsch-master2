/* Deutsch Master — Reference encyclopedia overlay (ADDITIVE ONLY, pure data).
 * No REF_* globals here on purpose: tools/check-reference.js, check-ref-dups.js
 * and check-ref-dom.js only scan `reference-data-*.js` files and `var REF_*`
 * arrays, so this file never interferes with those gates.
 * Runtime: reference.js merges `overlays` into topics (by id), and uses
 * `aliases`/`featured`/`journey`/`pathMeta` for search + homepage + headers.
 * All topic ids referenced below MUST already exist in the planned registry
 * (no new topic ids). Path ids A..P match REF_PATHS in reference.js.
 */
"use strict";
try { window.DMRefEncy = window.DMRefEncy || null; } catch (e) {}
window.DMRefEncy = {
 featured: ["d-akkusativ", "d-dativ", "b-artikel-bestimmt", "c-personal", "f-modal", "i-negation", "h-wechsel", "d-vergleich", "g-perfekt", "b-nomen-plural"],
 journey: ["c-personal", "b-artikel-bestimmt", "b-artikel-unbestimmt", "d-nominativ", "d-akkusativ", "d-dativ", "f-grundlagen", "m-verbstellung", "i-negation", "i-fragen", "h-dativ", "g-perfekt"],
 aliases: {
  "d-nominativ": ["الفاعل", "فاعل", "subject", "Wer", "Nominative", "حالة الفاعل", "من قام بالفعل"],
  "d-akkusativ": ["المفعول به", "مفعول به", "مفعول مباشر", "object", "Wen", "Accusative", "المفعول المباشر", "على من وقع الفعل"],
  "d-dativ": ["المفعول غير المباشر", "غير المباشر", "المستفيد", "indirect object", "Wem", "Dative", "لمن", "أعطى لمن"],
  "d-genitiv": ["الملكية", "ملكية", "الاضافة", "Wessen", "Genitive", "possession", "ملك من"],
  "d-vergleich": ["مقارنة الحالات", "الحالات الاربع", "الحالات الأربعة", "cases compared", "Kasus", "حالات الاعراب", "حالات الإعراب", "der den dem"],
  "b-artikel-bestimmt": ["ادوات التعريف", "أدوات التعريف", "ال المعرفة", "definite articles", "أداة التعريف", "اداة التعريف", "der die das"],
  "b-artikel-unbestimmt": ["ادوات النكرة", "أدوات النكرة", "indefinite articles", "ein eine", "أداة النكرة"],
  "b-artikel-negativ": ["النفي", "نفي الاسم", "kein", "negation", "keine", "لا يوجد"],
  "b-artikel-possessiv": ["الملكية", "أدوات الملكية", "mein dein", "possessive article"],
  "b-nomen-genus": ["جنس الاسم", "مذكر مؤنث", "der die das الفرق", "gender"],
  "b-nomen-plural": ["الجمع", "جمع", "plural", "Plural", "جموع"],
  "b-w-der": ["der", "المذكر", "مذكر"],
  "b-w-die": ["die", "المؤنث", "مؤنث"],
  "b-w-das": ["das", "المحايد", "محايد"],
  "c-personal": ["الضمائر الشخصية", "ضمائر شخصية", "personal pronouns", "Personalpronomen", "الضمائر", "ضمائر", "ich du er"],
  "c-possessiv": ["ضمائر الملكية", "possessive pronouns", "meiner deiner"],
  "c-reflexiv": ["الضمائر الانعكاسية", "sich", "reflexive"],
  "c-interrogativ": ["ضمائر الاستفهام", "wer wen wem", "interrogative pronouns"],
  "c-w-ich": ["ich", "أنا", "المتكلم"],
  "f-modal": ["الافعال الناقصة", "الأفعال الناقصة", "modal verbs", "Modalverben", "können müssen", "كان", "الأفعال المساعدة"],
  "f-grundlagen": ["تصريف الأفعال", "تصريف", "conjugation", "Konjugation", "الفعل", "نهايات الأفعال"],
  "f-shw": ["sein haben", "يكون يملك", "فعل يكون", "فعل يملك", "bin bist ist"],
  "f-trennbar": ["الأفعال المنفصلة", " separable", "trennbar", "anrufen aufstehen"],
  "f-akkusativ-verben": ["أفعال تأخذ مفعولا", "sehen haben brauchen", "أفعال الأكوزاتيف"],
  "f-dativ-verben": ["أفعال تأخذ داتيف", "helfen danken", "أفعال الداتيف"],
  "f-w-koennen": ["يستطيع", "können", "kann", "القدرة"],
  "f-w-muessen": ["يجب", "müssen", "muss", "الوجوب"],
  "g-praesens": ["المضارع", "الحاضر", "present tense", "Präsens"],
  "g-perfekt": ["الماضي", "ماضي", "past tense", "present perfect", "الماضي التام", "haben gemacht"],
  "g-partizip2": ["التصريف الثالث", "Partizip", "gemacht gespielt"],
  "g-praeteritum": ["الماضي البسيط", "past simple", "Präteritum", "war hatte"],
  "i-negation": ["النفي", "نفي", "nicht", "kein", "negation", "doch", "لا", "ليس"],
  "i-fragen": ["السؤال", "سؤال", "questions", "Fragen", "كيف أسأل", "نعم لا"],
  "i-fragewoerter": ["أدوات الاستفهام", "كلمات السؤال", "W-Fragen", "wer was wo"],
  "i-konjunktionen": ["أدوات الربط", "حروف العطف", "conjunctions", "und oder weil dass"],
  "i-w-weil": ["weil", "لأن", "السبب", "الجملة الفرعية"],
  "i-w-wer": ["wer wen wem", "من", "ضمير من"],
  "i-w-wo": ["wo", "أين", "المكان"],
  "i-w-wohin": ["wohin", "إلى أين", "الاتجاه"],
  "m-verbstellung": ["ترتيب الفعل", "الفعل الثاني", "verb position", "V2", "ترتيب الجملة", "أين الفعل"],
  "m-tmp": ["ترتيب الجملة", "TeKaMoLo", "زمان كيفية مكان", "TeKaMoLo", "الزمان قبل المكان"],
  "m-haupt-neben": ["الجملة الرئيسية والفرعية", "Nebensatz", "Hauptsatz", "الجملة الثانوية"],
  "h-akkusativ": ["حروف جر اكوزاتيف", "Akkusativ Präpositionen", "حروف الجر", "durch für"],
  "h-dativ": ["حروف جر داتيف", "Dativ Präpositionen", "حروف الجر", "mit nach bei"],
  "h-wechsel": ["حروف الجر المتغيرة", "Wechselpräpositionen", "Wo Wohin", "حروف الجر", "in an auf"],
  "h-w-mit": ["mit", "مع", "بواسطة", "بالحافلة"],
  "h-w-von": ["von", "من", "von meinem Vater"],
  "h-w-zu": ["zu", "إلى", "zum Arzt"],
  "h-w-nach": ["nach", "إلى", "nach Berlin"],
  "h-w-in": ["in", "في", "إلى داخل", "im garden"],
  "e-grundlagen": ["الصفات", "الصفة", "adjectives", "Adjektive", "صفة"],
  "e-deklination": ["نهايات الصفات", "تصريف الصفات", "Adjektivdeklination"],
  "a-satz-basis": ["الجملة الألمانية", "تكوين جملة", "فاعل فعل", "simple sentence"],
  "a-alphabet": ["الحروف", "الأبجدية", "النطق", "alphabet", "Umlaut"],
  "p-vergleiche": ["الفرق بين", "مقارنة", "الخلط بين", "nicht kein", "den dem"],
  "p-fehler": ["أخطاء شائعة", "أخطاء العرب", "common mistakes", "Fehler"],
  "o-gruesse": ["التحية", "التعريف بالنفس", "Guten Tag", "كيف أعرف نفسي"],
  "j-w-gestern": ["gestern", "أمس", "البارحة"],
  "j-uhrzeit": ["الساعة", "الوقت", "Wie spät", "Uhrzeit"]
 },
 pathMeta: {
  A: { intro: "نقطة الصفر: الحروف والنطق وشكل الجملة الألمانية. ابدأ هنا لو أن لغتك الألمانية صفر.", willLearn: ["الحروف والنطق الصحيح", "أنواع الكلمات", "أبسط جملة ألمانية", "ترتيب الكلمات الأساسي"], why: "بدون أساس النطق والجملة ستقرأ خطأ وتكوّن جملًا معكوسة. هذا المسار يبني الأرضية التي يقف عليها كل شيء بعده.", outcomes: ["نطق أي كلمة ألمانية بثقة", "تمييز الاسم من الفعل من الأداة", "تكوين جملة صحيحة من 3 كلمات", "قراءة الجمل القصيرة بسلاسة"], startWith: "a-alphabet", level: "A1", next: "B" },
  B: { intro: "عالم الأسماء: جنس الاسم وجمعه وأدواته. أشهر صدمة للعربي — der / die / das — تُحل هنا.", willLearn: ["جنس الاسم واستنتاجه من النهايات", "جمع الأسماء", "أدوات التعريف والنكرة", "kein وضمائر الملكية والإشارة"], why: "كل جملة ألمانية فيها اسم، وكل اسم يحتاج أداة صحيحة. من يتقن هذا المسار يفهم نصف القواعد تلقائيًا.", outcomes: ["حفظ أي اسم جديد مع أداته وجمعه", "اختيار ein / eine / der / die / das بثقة", "نفي الأسماء بـ kein بشكل صحيح", "استخدام mein / dein / dieser بدون تردد"], startWith: "b-nomen-genus", level: "A1", next: "C" },
  C: { intro: "الضمائر: الكلمات الصغيرة التي تحل محل الأسماء حتى لا تكرر نفس الاسم في كل جملة.", willLearn: ["الضمائر الشخصية ich / du / er", "ضمائر الملكية", "الضمائر الانعكاسية sich", "ضمائر الاستفهام والوصل"], why: "الألماني يستبدل الاسم بالضمير فور ذكره أول مرة. بدون الضمائر كلامك يبدو ثقيلًا ومكررًا، ومعها تبدو طبيعيًا.", outcomes: ["استبدال أي اسم بالضمير المناسب", "التفريق بين mich / mir و dich / dir", "استخدام sich مع الأفعال الانعكاسية", "فهم الفرق بين sie و Sie"], startWith: "c-personal", level: "A1", next: "D" },
  D: { intro: "قلب القواعد الألمانية: الحالات الأربع التي تكشف وظيفة كل اسم في الجملة.", willLearn: ["Nominativ للفاعل", "Akkusativ للمفعول المباشر", "Dativ للمستفيد", "Genitiv للملكية + جدول المقارنة"], why: "هذا هو السبب الذي يجعل der تصبح den و dem. من يفهم الحالات يفهم لماذا تتغير الأدوات — ومن يحفظ الجداول بدونها ينساها بعد أسبوع.", outcomes: ["معرفة الفاعل والمفعول في أي جملة", "اختيار der / den / dem الصحيح حسب الدور", "فهم لماذا تتغير أدوات التعريف", "تكوين جمل صحيحة في مواقف الحياة اليومية"], startWith: "d-nominativ", level: "A1", next: "F" },
  E: { intro: "الصفات: كيف تصف الأشياء والأشخاص، وكيف تقارن بينها، ومتى تضاف النهايات.", willLearn: ["استخدام الصفات الأساسي", "العكس والتضاد", "المقارنة والتفضيل", "نهايات الصفات (B1)"], why: "الصفات هي ما يجعل كلامك حيًا: كبير / صغير / جميل / سريع. ونهاياتها أشهر عقدة B1 — تُفهم هنا خطوة بخطوة.", outcomes: ["وصف أي شيء بعشرات الصفات", "المقارنة بين شيئين بشكل صحيح", "فهم متى تأخذ الصفة نهاية ومتى تبقى ثابتة"], startWith: "e-grundlagen", level: "A1", next: "F" },
  F: { intro: "الأفعال: محرك الجملة الألمانية. التصريف والأفعال الناقصة والمنفصلة — أهم مسار عملي.", willLearn: ["تصريف الأفعال في المضارع", "sein / haben / werden", "الأفعال الناقصة müssen / können", "الأفعال المنفصلة وغير المنفصلة"], why: "لا جملة بدون فعل مُصرَّف. الأفعال الناقصة وحدها تفتح لك الطلب والاستئذان والاعتذار — أهم مهارات الحياة في ألمانيا.", outcomes: ["تصريف أي فعل منتظم مع كل الضمائر", "طلب أي شيء بأدب بـ möchten / können", "فهم الأفعال المنفصلة مثل anrufen", "اختيار haben أو sein للماضي"], startWith: "f-grundlagen", level: "A1", next: "G" },
  G: { intro: "الأزمنة: متى حدث الفعل؟ الحاضر والماضي والمستقبل — وكيف يحكي الألمان عن أمس.", willLearn: ["المضارع واستخداماته", "الماضي المحكي Perfekt", "التصريف الثالث Partizip II", "الماضي الكتابي والمستقبل"], why: "الألماني يحكي يومه بالماضي Perfekt في 90% من المواقف. إتقانه يعني أنك تستطيع سرد ما فعلت أمس — أول مهارة حكاية حقيقية.", outcomes: ["التحدث عن العادات والحاضر", "سرد ما حدث أمس بـ Perfekt", "اختيار haben أو sein للفعل المساعد", "فهم الفرق بين war و ist gewesen"], startWith: "g-praesens", level: "A1", next: "H" },
  H: { intro: "حروف الجر: الكلمات الصغيرة التي تحدد المكان والزمان والاتجاه — وكل حرف يفرض حالة.", willLearn: ["حروف تأخذ Akkusativ دائمًا", "حروف تأخذ Dativ دائمًا", "الحروف المتغيرة Wo / Wohin", "كل حرف جر مهم على حدة"], why: "mit تقول dem و für تقول den — والحرف وحده يقرر. من يحفظ الحرف مع حالته لا يخطئ أبدًا؛ ومن يحفظ المعنى فقط يخلط دائمًا.", outcomes: ["اختيار الحالة الصحيحة بعد أي حرف جر", "التفريق بين Wo و Wohin تلقائيًا", "استخدام mit / nach / aus / zu / für بثقة", "وصف أي مكان واتجاه بدقة"], startWith: "h-akkusativ", level: "A1", next: "I" },
  I: { intro: "التواصل: كيف تسأل وكيف تنفي وكيف تربط جملتين — أدوات الكلام اليومي.", willLearn: ["كلمات السؤال", "أنواع الأسئلة الثلاثة", "النفي nicht / kein / doch", "أدوات الربط weil / dass"], why: "السؤال والنفي هما نصف أي محادثة. والفرق بين nicht و kein هو أشهر خطأ عربي — يُحسم هنا مرة واحدة وإلى الأبد.", outcomes: ["طرح أي سؤال بترتيب صحيح", "نفي الأسماء بـ kein والأفعال بـ nicht", "الرد على السؤال المنفي بـ doch", "ربط جملتين بـ weil مع الفعل في النهاية"], startWith: "i-fragewoerter", level: "A1", next: "M" },
  J: { intro: "الوقت: الساعة والأيام والشهور والظروف الزمنية — لغة المواعيد والحياة اليومية.", willLearn: ["الساعة والأوقات", "أيام الأسبوع والشهور", "الفصول وأجزاء اليوم", "ظروف الزمان gestern / heute"], why: "كل موعد وكل حكاية تحتاج وقتًا. هذا المسار يعلمك المواعيد بالصيغة التي يستخدمها الألمان فعليًا.", outcomes: ["قول الساعة وفهم المواعيد", "تحديد اليوم والشهر بالحرف الصحيح", "استخدام gestern / morgen / oft بشكل طبيعي"], startWith: "j-uhrzeit", level: "A1", next: "K" },
  K: { intro: "الأرقام والكميات: العد والترتيب والكلمات مثل viel / viele / wenig.", willLearn: ["الأرقام الأساسية", "الأرقام الترتيبية", "كلمات الكمية"], why: "الأسعار والعناوين وأرقام الهواتف والكميات — الأرقام في كل موقف عملي. وقاعدتها بسيطة لكن نطقها يحتاج تدريبًا.", outcomes: ["العد حتى المليون ونطق الأسعار", "قول التاريخ والطابق بالترتيبي", "التفريق بين viel و viele"], startWith: "k-zahlen", level: "A1", next: "L" },
  L: { intro: "المكان والاتجاه: أين أنت؟ إلى أين تذهب؟ من أين أتيت؟ — مع عبارات الطريق الجاهزة.", willLearn: ["Wo للمكان الثابت", "Wohin للاتجاه", "Woher للمصدر", "عبارات الاتجاهات والطريق"], why: "أول ما تحتاجه في مدينة ألمانية: أين المحطة؟ وكيف أصل؟ هذا المسار يعطيك الأسئلة والإجابات الجاهزة.", outcomes: ["السؤال عن أي مكان أو اتجاه", "فهم إجابات الطريق rechts / links / geradeaus", "استخدام aus و von و nach و zu بشكل صحيح"], startWith: "l-wo", level: "A1", next: "M" },
  M: { intro: "هندسة الجملة: أين يقف الفعل دائمًا؟ وما ترتيب الزمان والمكان؟ — القاعدة التي تضبط كل شيء.", willLearn: ["مواضع الفعل الثلاثة", "الجملة الرئيسية والفرعية", "ترتيب TeKaMoLo"], why: "الفعل الثاني دائمًا — هذه الجملة الواحدة تضبط 80% من أخطاء الترتيب. وهذا المسار يشرح الاستثناءات القليلة المتبقية.", outcomes: ["وضع الفعل في مكانه الصحيح دائمًا", "بناء جملة تبدأ بظرف بدون خطأ", "فهم لماذا يقف الفعل آخر الجملة الفرعية"], startWith: "m-verbstellung", level: "A1", next: "N" },
  N: { intro: "علامات الترقيم: النقطة والفاصلة وعلامة السؤال — كيف تُكتب الألمانية بشكل صحيح.", willLearn: ["العلامات الأساسية", "علامات الكتابة الأطول"], why: "الفاصلة قبل dass و weil إجبارية، والنقطة تنهي الخبر. قواعد قليلة تجعل كتابتك تبدو احترافية.", outcomes: ["ترقيم أي جملة بشكل صحيح", "وضع الفاصلة قبل الجملة الفرعية"], startWith: "n-basis", level: "A1", next: "O" },
  O: { intro: "الألمانية اليومية: عبارات جاهزة للتحية والشكر والمواقف — تكلم من اليوم الأول.", willLearn: ["التحية والتعريف بالنفس", "الشكر والاعتذار", "ردود الحياة اليومية", "جمل المواقف العملية"], why: "القواعد وحدها لا تجعلك تتكلم. هذه العبارات الجاهزة تمنحك طلاقة فورية في المطار والمطعم والمصلحة.", outcomes: ["التعريف بنفسك بثقة", "التعامل بأدب في أي موقف", "طلب المساعدة وعدم الفهم"], startWith: "o-gruesse", level: "A1", next: "P" },
  P: { intro: "غرفة المراجعة: أشهر الثنائيات المربكة والأخطاء الشائعة — الفحص النهائي قبل أي اختبار.", willLearn: ["مقارنات الثنائيات المربكة", "أشهر أخطاء العرب"], why: "nicht أم kein؟ den أم dem؟ wen أم wem؟ هذه الصفحة تجمع كل الفروق المتشابهة في مكان واحد للمراجعة السريعة.", outcomes: ["التفريق بين أي ثنائية مربكة", "تجنب أشهر 15 خطأ قبل وقوعها"], startWith: "p-vergleiche", level: "A1", next: "A" }
 },
 overlays: {
  "d-nominativ": {
   quick: "Nominativ = حالة الفاعل: من قام بالفعل؟ اسأل Wer؟ (من) أو Was؟ (ماذا) + الفعل، والإجابة دائمًا في Nominativ.",
   why: "الألمانية تُظهر دور كل اسم في الجملة بتغيّر شكله، لا بترتيبه فقط. لذلك تحتاج حالة ثابتة للفاعل حتى لو تقدّم ظرف أو مفعول في البداية: Heute kauft der Mann Brot — الفاعل ما زال der Mann رغم أنه ليس أول كلمة.",
   when: ["فاعل أي جملة خبرية أو سؤال", "الاسم بعد أفعال sein / werden / bleiben (ليست أفعال مفعول)", "الاسم عند التعريف بنفسك أو التسمية: Ich bin Ahmed / Das ist mein Bruder"],
   how: ["حدّد الفعل المُصرَّف في الجملة", "اسأل: Wer + الفعل؟ (للعاقل) أو Was + الفعل؟ (لغير العاقل)", "الإجابة = الفاعل، وأداته der / die / das / die (جمع)", "تأكد: لو الفعل sein فما بعده Nominativ أيضًا وليس مفعولًا"],
   trick: "sein لا يأكل مفعولًا: كل ما يأتي بعد ich bin / er ist / sie wird يبقى في Nominativ دائمًا.",
   reallife: [["Mein Bruder wohnt in Berlin.", "أخي يعيش في برلين."], ["Die Suppe ist zu heiß.", "الشوربة ساخنة جدًا."]],
   breaks: [{ de: "Mein Bruder wohnt in Berlin.", ar: "أخي يعيش في برلين.", parts: [["Mein Bruder", "أخي", "فاعل Nominativ"], ["wohnt", "يعيش", "الفعل في المرتبة الثانية"], ["in Berlin", "في برلين", "مكان (حرف جر + Dativ)"]] }]
  },
  "d-akkusativ": {
   quick: "Akkusativ = حالة المفعول المباشر: على من وقع الفعل؟ اسأل Wen؟ (من) أو Was؟ (ماذا). التغيّر الوحيد في الأدوات: der تصبح den للمذكر.",
   why: "بدون Akkusativ لن تعرف من فَعَل ومن وقع عليه الفعل عندما يتحرك ترتيب الجملة: Den Hund beißt der Mann (الكلب هو المعضوض رغم أنه أول الجملة!). الحالة وحدها تكشف الدور.",
   when: ["المفعول المباشر لأفعال مثل sehen / haben / brauchen / kaufen / lesen / trinken", "تعبيرات زمنية بدون حرف جر: jeden Tag / jede Woche / letztes Jahr", "بعد حروف الجر: durch / für / gegen / ohne / um", "بعد حروف Wechsel مع سؤال Wohin؟ (حركة واتجاه)"],
   how: ["حدّد الفاعل أولًا (Nominativ)", "اسأل: Wen oder Was + الفاعل + الفعل؟", "الإجابة = المفعول (Akkusativ)", "طبّق الأداة: مذكر der ← den، مؤنث die تبقى، محايد das يبقى، جمع die تبقى", "الضمائر تتغير كلها: ich ← mich / du ← dich / er ← ihn"],
   trick: "اسأل wen؟ — أي إجابة عن هذا السؤال فهي Akkusativ. واحفظ: المذكر فقط هو من يخونك (der ← den).",
   vs: { title: "لا تخلط بين den و dem", a: "den Mann = أرى الرجل (مفعول مباشر ← Akkusativ)", b: "dem Mann = أساعد الرجل (مستفيد ← Dativ)", tip: "اسأل: أرى من؟ (Wen ← den) أم أساعد لمن؟ (Wem ← dem). الفعل يقرر: sehen تأخذ den، و helfen تأخذ dem." },
   reallife: [["Ich kaufe jeden Morgen frisches Brot.", "أشتري خبزًا طازجًا كل صباح."], ["Der Professor erklärt die Lektion sehr gut.", "الأستاذ يشرح الدرس جيدًا جدًا."], ["Wir besuchen unsere Tante am Freitag.", "نزور عمتنا يوم الجمعة."]],
   breaks: [{ de: "Ich kaufe jeden Morgen frisches Brot.", ar: "أشتري خبزًا طازجًا كل صباح.", parts: [["Ich", "أنا", "فاعل Nominativ"], ["kaufe", "أشتري", "الفعل ثانيًا"], ["frisches Brot", "خبزًا طازجًا", "مفعول Akkusativ (محايد: das Brot)"], ["jeden Morgen", "كل صباح", "تعبير زمني في Akkusativ"]]}]
  },
  "d-dativ": {
   quick: "Dativ = حالة المستفيد أو المتأثر: أعطيت لمن؟ ساعدت من؟ اسأل Wem؟ (لمن). أدواته: dem / der / dem / den+n.",
   why: "أفعال كاملة في الألمانية لا تأخذ مفعولًا مباشرًا بل مستفيدًا (helfen / danken / gehören / gefallen / antworten). ولو استخدمت Akkusativ معها ستبدو الجملة خاطئة للألماني فورًا: Er hilft mir (وليس mich).",
   when: ["مع أفعال Dativ الثابتة: helfen / danken / gehören / gefallen / antworten / gratulieren", "بعد حروف الجر: mit / nach / aus / zu / bei / seit / von / gegenüber", "بعد حروف Wechsel مع سؤال Wo؟ (ثبات في مكان)", "عند وجود مفعولين: ضمير Dativ يأتي قبل اسم Akkusativ (Ich gebe dir das Buch)"],
   how: ["اسأل: Wem + الجملة؟", "الإجابة = Dativ", "طبّق الأداة: der ← dem / die ← der / das ← dem / جمع die ← den + n للاسم", "الضمائر: ich ← mir / du ← dir / er ← ihm / sie (هي) ← ihr", "مع مفعولين: ضع ضمير Dativ قبل اسم Akkusativ"],
   trick: "helfen خائنة: معناها (يساعد) يوحي بمفعول مباشر، لكنها تأخذ Dativ دائمًا. احفظها هكذا: helfen + mir/dir/ihm.",
   vs: { title: "لا تخلط بين mich و mir", a: "mich = مفعول مباشر (Akkusativ): Er sieht mich (يراني)", b: "mir = مستفيد (Dativ): Er hilft mir (يساعدني)", tip: "الفعل يقرر وليس المعنى العربي: sehen تأخذ mich، و helfen تأخذ mir. احفظ الفعل مع ضميره." },
   reallife: [["Der Arzt hilft dem kranken Kind.", "الطبيب يساعد الطفل المريض."], ["Ich danke Ihnen für Ihre Hilfe.", "أشكر حضرتك على مساعدتك."], ["Das Geschenk gefällt meiner Mutter sehr.", "الهدية تعجب والدتي جدًا."]],
   breaks: [{ de: "Ich gebe dir morgen das Buch.", ar: "أعطيك الكتاب غدًا.", parts: [["Ich", "أنا", "فاعل"], ["gebe", "أعطي", "فعل يأخذ مفعولين"], ["dir", "لك", "ضمير Dativ قبل الاسم"], ["das Buch", "الكتاب", "مفعول Akkusativ"], ["morgen", "غدًا", "زمان"]]}]
  },
  "d-genitiv": {
   quick: "Genitiv = حالة الملكية والانتماء: ملك من؟ اسأل Wessen؟ (ملك من). أدواته: des / der / des / der، والمذكر والمحايد يضيفان s/es للاسم.",
   why: "تاريخيًا كانت الملكية تُبنى داخل الاسم نفسه (des Vaters) بدون حرف جر. اليومية الحديثة تستبدلها غالبًا بـ von + Dativ، لكنك ستراها في الكتب واللوحات الرسمية وحروف Trotz / während / wegen — ولذلك هي B1 لا A1.",
   when: ["الملكية الرسمية في الكتابة: das Auto meines Vaters", "بعد حروف: trotz / während / wegen / statt", "في التعبيرات الثابتة وأسماء الشوارع والوثائق"],
   how: ["اسأل: Wessen + الشيء؟", "ضع الأداة: مذكر des + اسم+s/es، مؤنث der، محايد des + s/es، جمع der", "في الكلام اليومي استبدلها بـ von + Dativ بدون حرج: das Auto von meinem Vater"],
   trick: "حرف s الزائد هو بصمة Genitiv: إذا رأيت des Mannes أو Vaters فأنت أمام ملكية. وتذكّر: trotz و während و wegen ثلاثي Genitiv.",
   reallife: [["Die Meinung meiner Kollegin ist wichtig.", "رأي زميلتي مهم."], ["Während des Urlaubs besuchen wir Hamburg.", "أثناء الإجازة نزور هامبورغ."]],
   breaks: [{ de: "Das Auto meines Vaters ist neu.", ar: "سيارة والدي جديدة.", parts: [["Das Auto", "السيارة", "موصوف Nominativ"], ["meines Vaters", "والدي (ملك والدي)", "Genitiv: meiner + s"], ["ist neu", "جديدة", "الفعل + الصفة"]]}]
  },
  "d-vergleich": {
   quick: "الحالات الأربع سؤال واحد لكل حالة: Wer؟ (فاعل) ← Wen؟ (مفعول) ← Wem؟ (مستفيد) ← Wessen؟ (ملكية). ابدأ أي جملة بهذه الأسئلة الأربعة وستصل للحالة الصحيحة.",
   why: "الخطأ الأشهر عند العرب هو حفظ الجداول بدون ربطها بالأسئلة. الجدول وحده لا يُستخدم أثناء الكلام — الأسئلة الأربعة هي أداة الاستخدام الحقيقية، والجدول مرجع للتأكد فقط.",
   when: ["قبل أي اختبار: راجع هذا الجدول أولًا ثم ادخل تفاصيل كل حالة", "عند الشك بين den و dem اسأل: Wen؟ أم Wem؟", "عند كتابة إيميل رسمي راجع Genitiv هنا"],
   how: ["اقرأ الجملة وحدد الفعل", "اسأل الأسئلة الأربعة بالترتيب", "طابق الإجابة مع صف الحالة في الجدول", "طبّق الأداة أو الضمير من الجدول"],
   trick: "سلّم الأسئلة: Wer ← Wen ← Wem ← Wessen. كل سؤال يضيف حرفًا: من يفعل؟ على من؟ لمن؟ ملك من؟",
   reallife: [["Der Mann schläft. / Ich sehe den Mann. / Ich helfe dem Mann.", "الرجل نائم. / أرى الرجل. / أساعد الرجل — نفس الاسم، ثلاثة أدوار."]],
   breaks: []
  },
  "b-artikel-bestimmt": {
   quick: "أدوات التعريف للشيء المعروف: der (مذكر) / die (مؤنث) / das (محايد) / die (جمع دائمًا). الأداة تتغير مع الحالة، والجمع ثابت لا يتغير.",
   why: "الجنس في الألمانية قاعدة نحوية وليس وصفًا منطقيًا (das Mädchen محايد رغم أنها فتاة!). الأداة هي بطاقة هوية الاسم: بدونها لا تعرف تصريفه في الجملة ولا جمعه ولا صفاته.",
   when: ["شيء معروف للطرفين: Der Kaffee ist kalt (القهوة التي طلبناها)", "أسماء سبق ذكرها أو فريدة: die Sonne / der Himmel", "مع الصفات الموصوفة: der große Tisch"],
   how: ["احفظ كل اسم جديد مع أداته ككتلة واحدة: der Tisch وليس Tisch", "اجعل الجمع عادة ثابتة: الجمع دائمًا die", "استخدم النهايات كإشارات: ung/heit/keit/schaft ← die، و chen/lein ← das", "في الجملة طبّق جدول الحالات: Akkusativ يغيّر المذكر فقط (den)، و Dativ يغيّر الكل"],
   trick: "الأداة جزء من الكلمة: لا تكتب Tisch وحده أبدًا في دفترك. اكتب der Tisch — die Tische (مفرد + جمع معًا).",
   reallife: [["Der Bus kommt in fünf Minuten.", "الحافلة تصل بعد خمس دقائق."], ["Die Wohnung ist hell und ruhig.", "الشقة مضيئة وهادئة."], ["Das Brot vom Bäcker schmeckt frisch.", "خبز المخبز طعمه طازج."]],
   breaks: [{ de: "Die Wohnung ist hell und ruhig.", ar: "الشقة مضيئة وهادئة.", parts: [["Die Wohnung", "الشقة", "فاعل مؤنث Nominativ"], ["ist", "تكون", "فعل sein — ما بعده Nominativ"], ["hell und ruhig", "مضيئة وهادئة", "صفات خبرية بدون نهايات"]]}]
  },
  "c-personal": {
   quick: "الضمائر الشخصية تحل محل الاسم لتجنب التكرار: ich / du / er / sie / es / wir / ihr / sie / Sie — وتتغير كاملة مع كل حالة (ich ← mich ← mir).",
   why: "تكرار الاسم في كل جملة يجعل كلامك ثقيلًا وغير طبيعي. الألماني يستبدل الاسم بالضمير فور ذكره أول مرة: Das ist mein Bruder. Er wohnt in Kairo.",
   when: ["بدل فاعل مذكور: Er statt der Mann", "كمفعول بعد فعل Akkusativ: Ich kenne ihn", "كمستفيد بعد فعل Dativ: Sie hilft mir", "رسميًا مع الغرباء: Sie (كبيرة دائمًا)"],
   how: ["حدد الحالة أولًا بسؤال Wer / Wen / Wem", "اختر صف الحالة من الجدول", "انتبه للفروق الحرجة: sie (هي) / sie (هم) / Sie (حضرتك) — السياق والفعل يفرّقان", "ihn (مفعول مذكر) ≠ ihm (مستفيد مذكر) ≠ ihr (مستفيدة/ملكها)"],
   trick: "الحركة القصيرة للأكوزاتيف: m-i-ch (mich) و d-i-ch (dich) بحرف i قصير، والداتيف أطول: m-i-r (mir) و d-i-r (dir).",
   vs: { title: "لا تخلط بين sie و sie و Sie", a: "sie الصغيرة = هي (Er kennt sie) أو هم (Er kennt sie — جمع)", b: "Sie الكبيرة = حضرتك (Können Sie helfen؟)", tip: "الحرف الكبير يغيّر المعنى كاملًا: الفعل المفرد مع sie الصغيرة قد يعني هي، ومع Sie الكبيرة يعني حضرتك. في الكتابة انتبه للحرف الأول." },
   reallife: [["Kennst du meinen Nachbarn? — Ja, ich kenne ihn gut.", "هل تعرف جاري؟ — نعم، أعرفه جيدًا."], ["Kannst du mir bitte helfen?", "هل يمكنك مساعدتي من فضلك؟"]],
   breaks: [{ de: "Kannst du mir bitte helfen?", ar: "هل يمكنك مساعدتي من فضلك؟", parts: [["Kannst", "هل تستطيع", "فعل modal أولًا (سؤال)"], ["du", "أنت", "فاعل"], ["mir", "لي (مساعدتي)", "ضمير Dativ لأن helfen داتيفية"], ["helfen", "المساعدة", "المصدر في النهاية"]]}]
  },
  "f-modal": {
   quick: "الأفعال الناقصة (können / müssen / wollen / sollen / dürfen / mögen / möchten) تُصرَّف في المرتبة الثانية وترسل المصدر إلى نهاية الجملة.",
   why: "الألماني يعبّر عن القدرة والوجوب والرغبة والإذن بهذه الأفعال بدل تراكيب طويلة. إتقانها يعني أنك تستطيع الطلب والاستئذان والاعتذار — أهم مهارات A1 العملية.",
   when: ["القدرة: Ich kann schwimmen", "الوجوب: Ich muss arbeiten", "الرغبة: Ich will / möchte", "النصيحة: Du sollst zum Arzt", "الإذن والمنع: Darf ich؟ / dürfen nicht = ممنوع"],
   how: ["صرّف الناقص حسب الفاعل (ich kann / du kannst — وانتبه ich/er بلا نهاية في الشواذ)", "ضع الناقص في المرتبة الثانية", "أرسل الفعل الرئيسي مصدرًا إلى النهاية: Ich muss heute arbeiten", "في السؤال ابدأ بالناقص: Kannst du mir helfen؟", "في النفي: الفعل المنفي بـ nicht يبقى مصدرًا: Ich kann nicht kommen"],
   trick: "الناقص أناني والمعنى كريم: الناقص يجلس ثانيًا مرتاحًا، والفعل الحقيقي يُنفى إلى آخر الجملة.",
   vs: { title: "لا تخلط بين müssen و dürfen في النفي", a: "Ich muss nicht arbeiten = لا يجب عليّ العمل (غير ضروري، لكنه مسموح)", b: "Ich darf nicht arbeiten = ممنوع عليّ العمل (منع صريح)", tip: "müssen nicht تعني الإعفاء، و dürfen nicht تعني المنع. في لافتات المنع ستقرأ دائمًا darf nicht." },
   reallife: [["Ich muss morgen früh zum Amt.", "يجب أن أذهب للمصلحة غدًا مبكرًا."], ["Darf ich Sie etwas fragen?", "هل يُسمح لي أن أسأل حضرتك شيئًا؟"], ["Wir möchten bitte zweimal Kaffee.", "نود اثنين قهوة من فضلك. (في المقهى)"]],
   breaks: [{ de: "Ich muss morgen früh zum Amt.", ar: "يجب أن أذهب للمصلحة غدًا مبكرًا.", parts: [["Ich", "أنا", "فاعل"], ["muss", "يجب", "ناقص مُصرَّف ثانيًا"], ["morgen früh", "غدًا مبكرًا", "زمان"], ["zum Amt", "إلى المصلحة", "اتجاه (zu + Dativ)"], ["(gehen)", "الذهاب (محذوف مفهوم)", "المصدر قد يُحذف مع الذهاب"]]}]
  },
  "i-negation": {
   quick: "kein تنفي اسمًا له أداة (Ich habe kein Auto)، و nicht تنفي الفعل أو الصفة أو الجملة (Ich fahre nicht). و nein رد على سؤال، و doch رد بالإثبات على سؤال منفي.",
   why: "العربية تنفي بـ (لا/ليس/ما) لأي شيء، لكن الألمانية تفرّق بين نفي الشيء ونفي الحدث. الخلط بينهما أشهر خطأ عربي: Ich habe nicht Auto (خطأ) مقابل Ich habe kein Auto (صح).",
   when: ["اسم غير محدد منفي ← kein/keine/keinen (يُصرَّف مثل ein)", "فعل أو صفة أو ظرف أو جملة كاملة ← nicht", "الرد بكلمة واحدة على سؤال ← nein", "الاعتراض على نفي (نعم بل!) ← doch", "أشخاص وأشياء مطلقة: niemand (لا أحد) / nichts (لا شيء) / nie (أبدًا)"],
   how: ["اسأل: هل أنفي اسمًا؟ نعم ← kein مع تصريف ein", "هل أنفي فعلًا أو صفة؟ نعم ← nicht (آخر الجملة غالبًا، وقبل الصفة مباشرة)", "سؤال منفي وأريد إثبات العكس؟ استخدم doch: Kommst du nicht؟ — Doch! (بل آتٍ!)"],
   trick: "له أداة ويُنفى ← kein تحل محل الأداة. ليس اسمًا ← nicht. وسؤال منفي يُكذَّب ← doch وحدها تكفي.",
   vs: { title: "لا تخلط بين kein و nicht", a: "kein + اسم: Ich habe kein Auto (ليس لدي سيارة)", b: "nicht + فعل/صفة: Ich fahre nicht / Das ist nicht gut", tip: "انظر ما بعد النفي: لو اسم له أداة فهو kein، ولو فعل أو صفة فهو nicht. احفظ: kein تحل محل الأداة، و nicht لا تلمس الأدوات." },
   reallife: [["Ich habe heute keine Zeit, ich muss lernen.", "ليس لدي وقت اليوم، يجب أن أذاكر."], ["— Sprichst du kein Deutsch? — Doch, ein bisschen!", "— ألا تتحدث الألمانية؟ — بل أتحدث قليلًا!"], ["Das Essen schmeckt nicht gut.", "الطعام طعمه ليس جيدًا."]],
   breaks: [{ de: "Ich habe heute keine Zeit.", ar: "ليس لدي وقت اليوم.", parts: [["Ich", "أنا", "فاعل"], ["habe", "لدي (أملك)", "فعل ثانيًا"], ["heute", "اليوم", "زمان"], ["keine Zeit", "لا وقت", "نفي اسم مؤنث: keine"]]}]
  },
  "h-wechsel": {
   quick: "الحروف التسعة (an / auf / hinter / in / neben / über / unter / vor / zwischen) تأخذ Dativ مع سؤال Wo؟ (ثبات) و Akkusativ مع Wohin؟ (حركة واتجاه).",
   why: "نفس الحرف يصف علاقتين مختلفتين: أين الشيء ساكنًا؟ وإلى أين يتحرك؟ الألمانية تميزهما بالحالة بدل حرف جديد: auf dem Tisch (فوقها ساكن) مقابل auf den Tisch (وضعه فوقها).",
   when: ["وصف مكان ثابت ← Wo؟ ← Dativ: Das Buch liegt auf dem Tisch", "حركة نحو مكان ← Wohin؟ ← Akkusativ: Ich lege das Buch auf den Tisch", "مع أفعال الثنائيات: liegen/legen / stehen/stellen / sitzen/setzen / hängen"],
   how: ["اسأل Wo؟ (أين) أم Wohin؟ (إلى أين) — هذا السؤال يقرر كل شيء", "Wo؟ ← Dativ (dem / der / dem)", "Wohin؟ ← Akkusativ (den / die / das)", "احفظ الثنائيات معًا: liegen (ساكن + Wo) / legen (يحرك + Wohin)"],
   trick: "Wohin فيها n زيادة — والـ n تذكّرك بـ den (الأكوزاتيف). حركة ← n ← den. وثبات ← m ← dem.",
   vs: { title: "لا تخلط بين Wo و Wohin", a: "Wo؟ = أين (ثبات ← Dativ): Wo ist das Buch؟ — Auf dem Tisch", b: "Wohin؟ = إلى أين (حركة ← Akkusativ): Wohin legst du das Buch؟ — Auf den Tisch", tip: "الفعل يكشف السؤال: liegen / stehen / sitzen أفعال ثبات (Wo)، و legen / stellen / setzen أفعال تحريك (Wohin)." },
   reallife: [["Die Kinder spielen im Garten.", "الأطفال يلعبون في الحديقة. (ثبات)"], ["Die Kinder gehen in den Garten.", "الأطفال يذهبون إلى الحديقة. (حركة)"], ["Häng das Bild an die Wand!", "علّق الصورة على الحائط! (حركة)"]],
   breaks: [{ de: "Die Kinder gehen in den Garten.", ar: "الأطفال يذهبون إلى الحديقة.", parts: [["Die Kinder", "الأطفال", "فاعل جمع"], ["gehen", "يذهبون", "فعل حركة"], ["in den Garten", "إلى الحديقة", "Wohin؟ ← Akkusativ مذكر: den"]]}]
  },
  "b-nomen-genus": {
   quick: "كل اسم ألماني له جنس ثابت (مذكر der / مؤنث die / محايد das) لا علاقة له بالمنطق — يُحفظ مع الكلمة كجزء منها.",
   why: "الجنس يحدد كل شيء بعده: الأداة في الجملة، ونهاية الصفة، والضمير الذي يعود عليه. das Mädchen محايد رغم أنها فتاة — القاعدة نحوية وليست وصفًا.",
   when: ["عند حفظ أي اسم جديد — الأداة أولًا", "عند اختيار الضمير: der ← er / die ← sie / das ← es", "عند الشك استخدم النهايات كإشارات مساعدة"],
   how: ["احفظ الاسم مع أداته دائمًا: der Tisch وليس Tisch", "النهايات ung/heit/keit/schaft/ung ← die غالبًا", "النهايات chen/lein ← das غالبًا (التصغير)", "المهن بـ er ← der غالبًا (der Lehrer)", "ما عدا ذلك: الحفظ هو القاعدة"],
   trick: "دفترك من عمودين: الأسماء المذكرة يسارًا والمؤنثة يمينًا والمحايدة وسطًا — العين تحفظ قبل العقل.",
   vs: { title: "الجنس النحوي ليس الجنس الحقيقي", a: "das Mädchen (محايد) رغم أنها فتاة — القاعدة فوق المعنى", b: "die Person (مؤنث) حتى لو المقصود رجل", tip: "لا تترجم الجنس من العربية أبدًا. الشمس مؤنثة في الألمانية (die Sonne) ومذكرة في العربية — احفظ ولا تقِس." },
   reallife: [["Die Sonne scheint heute.", "الشمس مشرقة اليوم."], ["Das Mädchen liest ein Buch.", "الفتاة تقرأ كتابًا."]],
   breaks: [{ de: "Das Mädchen liest ein Buch.", ar: "الفتاة تقرأ كتابًا.", parts: [["Das Mädchen", "الفتاة", "فاعل محايد Nominativ (رغم المعنى!)"], ["liest", "تقرأ", "فعل ثانيًا"], ["ein Buch", "كتابًا", "مفعول Akkusativ محايد"]]}]
  },
  "b-nomen-plural": {
   quick: "الجمع في الألمانية له 5 أنماط ولا قاعدة واحدة — لذلك يُحفظ الجمع مع كل اسم. والقاعدة الوحيدة الثابتة: الجمع دائمًا die.",
   why: "المفرد يخدعك: der Tisch تصبح die Tische، و das Buch تصبح die Bücher. من يحفظ المفرد وحده سيخترع جمعًا خاطئًا عند أول محادثة.",
   when: ["عند حفظ أي اسم: اكتب المفرد + الجمع معًا", "عند استخدام صفة أو فعل مع الجمع", "عند Dativ الجمع: أضف n للاسم (den Kindern)"],
   how: ["احفظ القالب: der Tisch — die Tische", "انتبه للـ Umlaut: Buch ← Bücher / Apfel ← Äpfel", "الكلمات الأجنبية الحديثة غالبًا +s: Taxi ← Taxis", "بعض الكلمات لا تتغير: Fenster ← Fenster", "Dativ الجمع: die Kinder ← den Kindern"],
   trick: "الجمع دائمًا die — مهما كانت أداة المفرد. هذه أثبت قاعدة في الألمانية كلها.",
   reallife: [["Die Kinder spielen im Park.", "الأطفال يلعبون في الحديقة."], ["Zwei Brötchen, bitte.", "خبزتان صغيرتان من فضلك. (في المخبز)"]],
   breaks: [{ de: "Die Kinder spielen im Park.", ar: "الأطفال يلعبون في الحديقة.", parts: [["Die Kinder", "الأطفال", "فاعل جمع (die ثابتة)"], ["spielen", "يلعبون", "فعل جمع"], ["im Park", "في الحديقة", "مكان (in + dem = im)"]]}]
  },
  "b-artikel-unbestimmt": {
   quick: "أداة النكرة لشيء غير محدد أو مذكور أول مرة: ein للمذكر والمحايد، و eine للمؤنث. ولا جمع لها — الجمع النكرة بدون أداة.",
   why: "الألماني يفرّق بين أول ذكر (نكرة) والذكر التالي (معرفة): Ein Mann kommt. Der Mann spricht. استخدام der من أول مرة يجعل السامع يسأل: أي رجل تقصد؟",
   when: ["أول ذكر لشيء: Ich habe eine Frage", "المهنة بعد sein: Er ist Lehrer (بدون أداة غالبًا)", "النفي بـ kein يتبع نفس تصريف ein"],
   how: ["مذكر Nominativ: ein Mann / محايد: ein Kind / مؤنث: eine Frau", "Akkusativ المذكر فقط يتغير: einen Mann", "Dativ: einem Mann / einer Frau / einem Kind", "الجمع النكرة: بدون أداة (Ich lese Bücher)"],
   trick: "ein مذكر يُشبه der في التغيّر: der ← den تقابلها ein ← einen. والمؤنث eine ثابتة مثل die تمامًا.",
   vs: { title: "لا تخلط بين ein و einen", a: "ein Mann kommt (فاعل ← Nominativ)", b: "Ich sehe einen Mann (مفعول ← Akkusativ)", tip: "الجملة الأولى تجيب عن Wer؟ والثانية عن Wen؟ — نفس قاعدة der / den لكن بالنكرة." },
   reallife: [["Ich habe eine Frage.", "لديّ سؤال. (في الدرس أو المصلحة)"], ["Er hilft einem Freund.", "هو يساعد صديقًا."]],
   breaks: [{ de: "Ich habe eine Frage.", ar: "لديّ سؤال.", parts: [["Ich", "أنا", "فاعل"], ["habe", "لدي", "فعل ثانيًا"], ["eine Frage", "سؤالًا", "مفعول مؤنث: eine ثابتة"]]}]
  },
  "b-artikel-negativ": {
   quick: "kein تنفي اسمًا له أداة وتحل محلها (Ich habe kein Auto)، وتُصرَّف مثل ein تمامًا. أشهر خطأ: استخدام nicht مع الأسماء.",
   why: "العربي يقول (ليس عندي سيارة) فينفي بـ nicht قبل الاسم فيخطئ. الألماني ينفي الشيء نفسه: kein Auto — كلمة واحدة بدل كلمتين.",
   when: ["نفي اسم نكرة: kein Auto / keine Zeit / keinen Hunger", "الإجابة بالنفي: Nein, ich habe kein Geld", "مع المهن والصفات الاسمية المنفية"],
   how: ["حدد جنس الاسم وحالته أولًا", "طبّق نهايات ein: kein / keine / keinen / keinem / keiner", "المذكر Akkusativ: keinen (Du hast keinen Hunger)", "المؤنث: keine (keine Zeit) — والجمع المنفي: keine (keine Freunde)"],
   trick: "kein = ein منفية: حيثما تضع ein ضع kein للنفي. ein Mann ← kein Mann، و einen Mann ← keinen Mann.",
   vs: { title: "لا تخلط بين kein و nicht (أهم فرق في A1)", a: "kein + اسم: Ich habe kein Auto", b: "nicht + فعل/صفة: Ich fahre nicht / Das ist nicht gut", tip: "بعد النفي اسم؟ ← kein. بعد النفي فعل أو صفة؟ ← nicht. راجع i-negation للأمثلة الكاملة." },
   reallife: [["Ich habe heute keine Zeit.", "ليس لدي وقت اليوم."], ["Er hat kein Geld dabei.", "ليس معه نقود."]],
   breaks: [{ de: "Er hat kein Geld dabei.", ar: "ليس معه نقود.", parts: [["Er", "هو", "فاعل"], ["hat", "لديه", "فعل ثانيًا"], ["kein Geld", "لا نقود", "نفي اسم محايد: kein"], ["dabei", "معه", "ظرف ملازم"]]}]
  },
  "b-artikel-possessiv": {
   quick: "أداة الملكية = ضمير الملكية + نهاية الإعراب: mein / dein / sein / ihr / unser / euer + نفس نهايات ein. ويأتي بعدها اسم دائمًا.",
   why: "الملكية في الألمانية تُبنى داخل الأداة نفسها (meinem Vater) لا بكلمة مستقلة. من يتقن نهايات ein يتقن الملكية مجانًا — نفس الجدول.",
   when: ["نسب شيء لشخص: mein Vater / deine Tasche", "في Dativ بعد حروف الجر: mit meinem Freund", "للرسمي: Ihr (كبيرة) لحضرتك"],
   how: ["اختر الأساس حسب المالك: ich ← mein / du ← dein / er ← sein / sie ← ihr", "أضف نهاية ein حسب جنس المملوك وحالته", "مذكر Nominativ: mein Vater — و Akkusativ: meinen Vater", "انتبه: euer تفقد e أحيانًا: eure Tasche"],
   trick: "انسخ جدول ein والصقه على الملكية: ein/eine/einen تقابلها mein/meine/meinen — نفس النهايات حرفيًا.",
   vs: { title: "لا تخلط بين sein و ihr", a: "sein Vater = والد هو (ملك المذكر)", b: "ihr Vater = والد هي (ملك المؤنث) أو والدهم", tip: "اسأل: المالك رجل؟ ← sein. المالك امرأة أو جمع؟ ← ihr. السياق وحده يفرّق." },
   reallife: [["Mein Vater arbeitet viel.", "والدي يعمل كثيرًا."], ["Wir fahren mit unserem Auto.", "نذهب بسيارتنا."]],
   breaks: [{ de: "Wir fahren mit unserem Auto.", ar: "نذهب بسيارتنا.", parts: [["Wir", "نحن", "فاعل"], ["fahren", "نذهب/نسافر", "فعل ثانيًا"], ["mit unserem Auto", "بسيارتنا", "mit + Dativ محايد: unserem"]]}]
  },
  "b-w-der": {
   quick: "der = أداة الاسم المذكر المفرد في Nominativ (der Mann)، وتتحول إلى den في Akkusativ و dem في Dativ و des في Genitiv.",
   why: "der هي أكثر كلمة تتغير في الألمانية — 4 حالات × 4 أشكال. فهم تحولاتها يعني فهم الحالات كلها من باب واحد.",
   when: ["فاعل مذكر: Der Mann schläft", "مفعول مذكر: Ich sehe den Mann", "مستفيد مذكر: Ich helfe dem Mann", "ملكية: Das Auto des Mannes"],
   how: ["احفظ السلسلة: der ← den ← dem ← des", "في الجملة اسأل Wer/Wen/Wem/Wessen أولًا", "طبّق الشكل المطابق للسؤال"],
   trick: "سلسلة المذكر: der - den - dem - des. لاحظ التدرج: كل حالة تضيف حرفًا.",
   reallife: [["Der Mann wartet auf den Bus.", "الرجل ينتظر الحافلة."]],
   breaks: [{ de: "Der Mann wartet auf den Bus.", ar: "الرجل ينتظر الحافلة.", parts: [["Der Mann", "الرجل", "فاعل Nominativ"], ["wartet", "ينتظر", "فعل ثانيًا"], ["auf den Bus", "الحافلة", "warten auf + Akkusativ"]]}]
  },
  "b-w-die": {
   quick: "die = أداة الاسم المؤنث المفرد (die Frau) وأداة الجمع لكل الأجناس (die Männer / die Frauen / die Kinder).",
   why: "die واحدة لمعنيين: مفرد مؤنث وجمع عام. السياق والفعل يفرّقان: Die Frau liest (هي) مقابل Die Frauen lesen (هم).",
   when: ["مفرد مؤنث: Die Tasche ist neu", "جمع أي جنس: Die Tische sind groß", "بعد حروف Dativ للمؤنث: mit der Frau (die ← der!)"],
   how: ["مفرد مؤنث Nominativ/Akkusativ: die ثابتة", "Dativ المؤنث: der (Ich helfe der Frau)", "الجمع Nominativ/Akkusativ: die — و Dativ: den + n"],
   trick: "die للمؤنث تتحول إلى der في Dativ — نفس شكل المذكر في Nominativ! السياق يمنع الخلط.",
   reallife: [["Die Frauen trinken Kaffee.", "النساء يشربن القهوة."]],
   breaks: [{ de: "Die Frauen trinken Kaffee.", ar: "النساء يشربن القهوة.", parts: [["Die Frauen", "النساء", "فاعل جمع"], ["trinken", "يشربن", "فعل جمع"], ["Kaffee", "قهوة", "مفعول (بدون أداة: غير معدود)"]]}]
  },
  "b-w-das": {
   quick: "das = أداة الاسم المحايد المفرد (das Kind / das Buch). في Akkusativ تبقى das، وفي Dativ تصبح dem.",
   why: "المحايد يجمع صفات الطرفين: ثابت مثل المؤنث في Akkusativ، ويتغير مثل المذكر في Dativ. وفهمه يضبط الحالات كلها.",
   when: ["فاعل محايد: Das Kind spielt", "مفعول محايد: Ich kaufe das Buch (تبقى das!)", "بعد mit: mit dem Kind"],
   how: ["Nominativ/Akkusativ: das ثابتة", "Dativ: dem (mit dem Auto)", "Genitiv: des + s (des Kindes)"],
   trick: "das لا تتغير في Akkusativ أبدًا: Ich sehe das Kind — نفس شكل الفاعل.",
   reallife: [["Das Buch ist interessant.", "الكتاب شيّق."]],
   breaks: [{ de: "Das Buch ist interessant.", ar: "الكتاب شيّق.", parts: [["Das Buch", "الكتاب", "فاعل محايد"], ["ist", "يكون", "فعل sein"], ["interessant", "شيّق", "صفة خبرية ثابتة"]]}]
  },
  "c-possessiv": {
   quick: "ضمير الملكية المستقل يقف وحده بدون اسم بعده: Das Buch ist meins (الكتاب لي). وهو يختلف عن أداة الملكية mein التي تحتاج اسمًا.",
   why: "العربي يقول (الكتاب كتابي) فيكرر الاسم. الألماني يختصره: Das ist meins — كلمة واحدة تنهي الجملة.",
   when: ["الرد على سؤال الملكية: Wessen Buch ist das؟ — Meins!", "المقارنة: Dein Auto ist neu, meins ist alt", "الرسمي: Ihres (حضرتك)"],
   how: ["أداة + اسم: mein Buch (يحتاج اسمًا)", "ضمير مستقل: meins (بدون اسم)", "يُصرَّف حسب المملوك: meins / meine / meiner"],
   trick: "حرف s في النهاية = مستقل: mein + s = meins. تذكّر: المستقل يحمل s زائدة.",
   vs: { title: "لا تخلط بين mein و meins", a: "mein Buch = كتابي (تحتاج اسمًا بعدها)", b: "Das Buch ist meins = الكتاب لي (تقف وحدها)", tip: "رأيت اسمًا بعدها؟ ← mein. انتهت الجملة بها؟ ← meins." },
   reallife: [["Ist das dein Handy? — Nein, meins ist zu Hause.", "هل هذا هاتفك؟ — لا، هاتفي في البيت."]],
   breaks: [{ de: "Das Buch ist meins.", ar: "الكتاب لي.", parts: [["Das Buch", "الكتاب", "فاعل"], ["ist", "يكون", "فعل sein"], ["meins", "لي (ملكي)", "ضمير مستقل بدون اسم"]]}]
  },
  "c-reflexiv": {
   quick: "الضمير الانعكاسي sich يعود على الفاعل نفسه مع أفعال محددة: sich waschen (يغتسل) / sich freuen (يفرح) / sich setzen (يجلس).",
   why: "بعض الأفعال الألمانية لا تكتمل بدون sich — حذفها يغيّر المعنى أو يجعل الجملة ناقصة. freuen بدون sich لا تعني (يفرح) أصلًا.",
   when: ["العناية اليومية: sich waschen / sich anziehen / sich rasieren", "المشاعر: sich freuen / sich ärgern / sich interessieren für", "الحركة: sich setzen / sich legen"],
   how: ["ich ← mich / du ← dich / er ← sich (Akkusativ)", "Dativ: ich ← mir / du ← dir / er ← sich (ثابتة!)", "الموضع: بعد الفاعل مباشرة (Ich wasche mich) أو بعد الفعل في السؤال"],
   trick: "sich للغائب ثابتة في الحالتين — الغائب لا يغيّر انعكاسه. واحفظ الفعل مع sich ككتلة: sich freuen auf.",
   reallife: [["Ich freue mich auf den Urlaub.", "أنا متشوق للعطلة."], ["Setzen Sie sich bitte.", "تفضل بالجلوس حضرتك."]],
   breaks: [{ de: "Ich freue mich auf den Urlaub.", ar: "أنا متشوق للعطلة.", parts: [["Ich", "أنا", "فاعل"], ["freue", "أفرح", "فعل ثانيًا"], ["mich", "نفسي", "انعكاسي Akkusativ"], ["auf den Urlaub", "للعطلة", "sich freuen auf + Akkusativ"]]}]
  },
  "c-interrogativ": {
   quick: "ضمائر الاستفهام تسأل عن الأشخاص والأشياء مع تغيّر الحالة: wer (فاعل) / wen (مفعول) / wem (مستفيد) / was (ثابت للأشياء).",
   why: "السؤال نفسه يكشف الحالة: Wer hilft؟ تختلف عن Wen siehst؟ وعن Wem hilfst؟ — من يتقن الأسئلة الثلاثة لا يخطئ الحالة أبدًا.",
   when: ["عن فاعل عاقل: Wer kommt؟", "عن مفعول عاقل: Wen siehst du؟", "عن مستفيد: Wem hilfst du؟", "عن شيء: Was ist das؟ (ثابت)"],
   how: ["عاقل + فاعل ← wer", "عاقل + مفعول ← wen", "عاقل + مستفيد ← wem", "غير عاقل ← was دائمًا"],
   trick: "wer - wen - wem: نفس سلم الحالات Wer/Wen/Wem. والـ m في wem تذكّرك بالـ m في dem.",
   vs: { title: "لا تخلط بين wer و wen و wem", a: "Wer؟ = من (فاعل): Wer hilft dir؟", b: "Wen؟ = من (مفعول): Wen siehst du؟ / Wem؟ = لمن (مستفيد): Wem hilfst du؟", tip: "أجب عن سؤالك: الإجابة er ← السؤال wer، و ihn ← wen، و ihm ← wem." },
   reallife: [["Wem gehört das Fahrrad?", "لمن هذه الدراجة؟"]],
   breaks: [{ de: "Wem gehört das Fahrrad?", ar: "لمن هذه الدراجة؟", parts: [["Wem", "لمن", "سؤال Dativ"], ["gehört", "تخص/تعود", "فعل gehören + Dativ"], ["das Fahrrad", "الدراجة", "فاعل الجملة!"]]}]
  },
  "e-grundlagen": {
   quick: "الصفة تصف الاسم. بعد sein تبقى ثابتة (Das Auto ist groß)، وقبل الاسم تأخذ نهاية حسب الأداة والجنس والحالة.",
   why: "الفرق بين ist groß و große ثابت يربك العرب: الخبر لا يأخذ نهاية أبدًا، والوصف قبل الاسم يأخذ نهاية دائمًا. فهم الموضعين يحل نصف المشكلة.",
   when: ["خبر بعد sein: Das Wetter ist schön (ثابتة)", "وصف قبل الاسم: der schöne Tag (بنهاية)", "مع أفعال الحواس والشعور"],
   how: ["بعد sein/werden/bleiben ← بدون نهاية", "قبل الاسم مع أداة معرفة ← نهاية e/en حسب الحالة", "قبل الاسم مع نكرة ← نهايات أوضح (guter Kaffee)", "التفصيل الكامل في e-deklination (B1)"],
   trick: "بعد ist لا نهاية أبدًا: ist schön وليس ist schöne. احفظها كقانون حديدي.",
   reallife: [["Der Kaffee ist zu heiß.", "القهوة ساخنة جدًا."], ["Ein schöner Tag!", "يوم جميل!"]],
   breaks: [{ de: "Der Kaffee ist zu heiß.", ar: "القهوة ساخنة جدًا.", parts: [["Der Kaffee", "القهوة", "فاعل مذكر"], ["ist", "يكون", "فعل sein"], ["zu heiß", "ساخنة جدًا", "صفة خبرية ثابتة"]]}]
  },
  "e-deklination": {
   quick: "نهايات الصفات قبل الاسم (B1): مع أداة معرفة النهايات بسيطة (e/en)، ومع النكرة أو بدون أداة النهايات أوضح لأن الصفة تحمل الإعراب.",
   why: "الصفة قبل الاسم تحمل بصمة الحالة عندما تكون الأداة ضعيفة. der gute Mann مقابل guter Mann — نفس المعنى، وتوزيع مختلف للنهايات.",
   when: ["وصف معرف: der gute Mann / die schöne Frau", "وصف نكرة: ein guter Mann / eine schöne Frau", "بدون أداة: frisches Brot / schwarzer Kaffee"],
   how: ["معرفة + Nominativ ← e (der gute)", "معرفة + باقي الحالات ← en غالبًا (den guten)", "نكرة مذكر Nominativ ← er (guter)", "بدون أداة: الصفة تأخذ نهاية الأداة نفسها"],
   trick: "الأداة القوية تُريح الصفة (e فقط)، والأداة الضعيفة تُتعبها (نهايات كاملة).",
   reallife: [["Ich trinke schwarzen Kaffee.", "أشرب قهوة سوداء."]],
   breaks: [{ de: "Ich trinke schwarzen Kaffee.", ar: "أشرب قهوة سوداء.", parts: [["Ich", "أنا", "فاعل"], ["trinke", "أشرب", "فعل ثانيًا"], ["schwarzen Kaffee", "قهوة سوداء", "صفة Akkusativ مذكر بدون أداة: en"]]}]
  },
  "f-grundlagen": {
   quick: "الفعل الألماني = الجذر + النهاية حسب الفاعل: lernen ← ich lerne / du lernst / er lernt / wir lernen. الفعل المُصرَّف يقف ثانيًا دائمًا.",
   why: "التصريف هو ما يجعل الفعل يتفق مع الفاعل — بدونه لا توجد جملة. وهو مهارة واحدة تُستخدم في كل جملة تنطقها.",
   when: ["كل جملة خبرية: الفعل المُصرَّف ثانيًا", "السؤال: الفعل أولًا", "الأمر: الفعل أولًا بدون فاعل غالبًا"],
   how: ["احذف en من المصدر تحصل على الجذر: lernen ← lern", "أضف النهايات: e / st / t / en / t / en", "الأفعال الشاذة تغيّر الجذر مع du/er (sehen ← siehst)", "احفظ الشواذ الثلاثة أولًا: sein / haben / werden"],
   trick: "النهايات الست: e - st - t - en - t - en. غنِّها مع أي فعل جديد وستحفظها في يوم واحد.",
   reallife: [["Ich lerne Deutsch.", "أتعلم الألمانية."], ["Er arbeitet in Berlin.", "هو يعمل في برلين."]],
   breaks: [{ de: "Ich lerne Deutsch.", ar: "أتعلم الألمانية.", parts: [["Ich", "أنا", "فاعل"], ["lerne", "أتعلم", "جذر lern + نهاية e"], ["Deutsch", "الألمانية", "مفعول (لغة تُكتب كبيرة)"]]}]
  },
  "f-shw": {
   quick: "أهم ثلاثة أفعال: sein (يكون) للهوية والمكان، و haben (يملك) للملكية والماضي، و werden (يصبح) للمستقبل والمبني للمجهول.",
   why: "هذه الثلاثة هي الأفعال المساعدة لكل الأزمنة + أكثر الأفعال استخدامًا وحدها. تصريفها شاذ تمامًا لذلك تُحفظ غيبًا أولًا.",
   when: ["التعريف: Ich bin Ahmed / Er ist Lehrer", "الملكية: Ich habe ein Auto", "الماضي: Ich habe gemacht / Ich bin gegangen", "المستقبل: Ich werde lernen"],
   how: ["sein: bin / bist / ist / sind / seid / sind", "haben: habe / hast / hat / haben / habt / haben", "werden: werde / wirst / wird / werden / werdet / werden", "الماضي المساعد: haben لمعظم الأفعال، و sein للحركة والتغيّر"],
   trick: "bin - bist - ist إيقاع واحد احفظه كأغنية. و haben أسهل: habe - hast - hat.",
   vs: { title: "لا تخلط بين sein و haben كفعل مساعد", a: "haben + معظم الأفعال: Ich habe gelernt / gegessen / gemacht", b: "sein + الحركة والتغيّر: Ich bin gegangen / gekommen / aufgewacht", tip: "تحرّك الجسم من مكان؟ ← sein. باقي الأفعال؟ ← haben." },
   reallife: [["Ich bin müde.", "أنا متعب."], ["Hast du Zeit?", "هل لديك وقت؟"]],
   breaks: [{ de: "Hast du Zeit?", ar: "هل لديك وقت؟", parts: [["Hast", "هل لديك", "فعل haben أولًا (سؤال)"], ["du", "أنت", "فاعل"], ["Zeit", "وقت", "مفعول مؤنث بدون أداة"]]}]
  },
  "f-trennbar": {
   quick: "الفعل المنفصل = مقطع أمامي + فعل: anrufen / aufstehen / einkaufen. في الجملة الرئيسية ينفصل المقطع ويقفز إلى النهاية.",
   why: "الترتيب وحده يكشف المعنى: Ich rufe dich an (أتصل بك) — من يترك المقطع ملتصقًا يقول جملة ناقصة يسمعها الألماني فورًا.",
   when: ["المكالمة: anrufen — Ich rufe dich morgen an", "الاستيقاظ: aufstehen — Ich stehe um 6 Uhr auf", "التسوق: einkaufen — Wir kaufen heute ein"],
   how: ["في المصدر: ملتصق (anzurufen مع zu في الوسط)", "في الرئيسية: منفصل للنهاية (rufe ... an)", "في الفرعية: ملتصق في النهاية (... anruft)", "في Perfekt: ge في الوسط (angerufen)"],
   trick: "المقطع مشدود بمطاطة إلى النهاية: كلما رأيت فعلًا ناقص المعنى في المرتبة الثانية فتش عن مقطعه في آخر الجملة.",
   reallife: [["Ruf mich bitte zurück!", "اتصل بي مجددًا من فضلك."], ["Der Zug kommt um 8 Uhr an.", "القطار يصل الساعة الثامنة."]],
   breaks: [{ de: "Der Zug kommt um 8 Uhr an.", ar: "القطار يصل الساعة الثامنة.", parts: [["Der Zug", "القطار", "فاعل"], ["kommt", "يأتي/يصل", "فعل ثانيًا"], ["um 8 Uhr", "الساعة الثامنة", "زمان"], ["an", "وصول", "مقطع ankommen في النهاية"]]}]
  },
  "f-dativ-verben": {
   quick: "أفعال مفعولها Dativ وليس Akkusativ — أشهرها helfen / danken / gehören / gefallen / antworten. تُحفظ مع حالتها.",
   why: "المعنى العربي يخدعك: (يساعد شخصًا) تبدو مفعولًا مباشرًا، لكن الألماني يقول Er hilft mir. القاعدة هنا ليست منطقية — إنها عادة تُحفظ.",
   when: ["المساعدة والشكر: helfen + mir / danken + dir", "الملكية والإعجاب: gehören / gefallen + Dativ", "التهنئة والإجابة: gratulieren / antworten + Dativ"],
   how: ["احفظ الفعل مع ضمير Dativ: helfen + mir", "اختبر نفسك بسؤال Wem؟ لا Wen؟", "في الجملة ضع ضمير Dativ قبل اسم Akkusativ"],
   trick: "خمسة الكبار: helfen - danken - gehören - gefallen - antworten. اكتبها على بطاقة واحدة واحفظها مع mir.",
   reallife: [["Kannst du mir helfen?", "هل يمكنك مساعدتي؟"], ["Das Kleid steht dir gut.", "الفستان يناسبك جدًا."]],
   breaks: [{ de: "Kannst du mir helfen?", ar: "هل يمكنك مساعدتي؟", parts: [["Kannst", "هل تستطيع", "modal أولًا"], ["du", "أنت", "فاعل"], ["mir", "لي", "Dativ مع helfen"], ["helfen", "المساعدة", "مصدر في النهاية"]]}]
  },
  "f-akkusativ-verben": {
   quick: "معظم الأفعال المتعدية مفعولها Akkusativ: sehen / haben / brauchen / kaufen / lesen / besuchen. وهي القاعدة الافتراضية.",
   why: "عند الشك افترض Akkusativ — فهو حالة 80% من المفاعيل. Dativ استثناء يُحفظ، و Akkusativ هو الأصل.",
   when: ["الحواس: sehen / hören / lesen", "الاحتياج: brauchen / haben / möchten", "الزيارة واللقاء: besuchen / treffen / kennen"],
   how: ["اسأل Wen/Was؟ — الإجابة Akkusativ", "المذكر: den / einen / keinen / meinen", "الضمير: mich / dich / ihn"],
   trick: "افترض Akkusativ ما لم تعرف أن الفعل داتيفي. القائمة الداتيفية قصيرة — ما عداها أكوزاتيفي.",
   reallife: [["Ich brauche deine Hilfe.", "أحتاج مساعدتك."], ["Besuchst du uns morgen?", "هل تزورنا غدًا؟"]],
   breaks: [{ de: "Ich brauche deine Hilfe.", ar: "أحتاج مساعدتك.", parts: [["Ich", "أنا", "فاعل"], ["brauche", "أحتاج", "فعل ثانيًا"], ["deine Hilfe", "مساعدتك", "مفعول مؤنث Akkusativ"]]}]
  },
  "f-w-koennen": {
   quick: "können = يستطيع (القدرة). المُصرَّف ثانيًا + المصدر في النهاية: Ich kann schwimmen. وصيغة Kann ich…؟ طلب مهذب.",
   why: "القدرة أول ما يُسأل عنه في العمل والدراسة: Kannst du Auto fahren؟ — إجابتها تفتح أبوابًا.",
   when: ["القدرة: Ich kann schwimmen", "الإذن المهذب: Kann ich hier sitzen؟", "النفي: Ich kann nicht kommen"],
   how: ["التصريف الشاذ: kann / kannst / kann / können / könnt / können", "المصدر الكامل في النهاية (schwimmen لا schwimme)", "السؤال: الفعل أولًا"],
   trick: "ich و er متطابقان (kann) — الشواذ الناقصة تكره النهايات مع المفرد.",
   reallife: [["Kannst du mir helfen?", "هل تستطيع مساعدتي؟"]],
   breaks: [{ de: "Kannst du mir helfen?", ar: "هل تستطيع مساعدتي؟", parts: [["Kannst", "هل تستطيع", "modal أولًا"], ["du", "أنت", "فاعل"], ["mir", "لي", "Dativ (helfen داتيفية)"], ["helfen", "المساعدة", "مصدر أخير"]]}]
  },
  "g-praesens": {
   quick: "المضارع يعبّر عن الحاضر والعادة والمستقبل القريب مع كلمة زمان: Ich lerne / Ich lerne morgen (سأتعلم غدًا).",
   why: "الألماني يستخدم المضارع للمستقبل القريب أكثر من Futur نفسه: Morgen kaufe ich ein — أبسط وأشهر.",
   when: ["الحاضر: Ich wohne in Kairo", "العادة: Ich trinke Kaffee", "المستقبل القريب: Morgen fliege ich"],
   how: ["صرّف الفعل حسب الفاعل", "أضف كلمة زمان للمستقبل: morgen / nächste Woche", "لا تحتاج werden للمستقبل اليومي"],
   trick: "كلمة morgen تحوّل المضارع إلى مستقبل مجانًا — بدون قواعد إضافية.",
   reallife: [["Morgen kaufe ich ein.", "غدًا سأتسوق. (مضارع بمعنى المستقبل)"]],
   breaks: [{ de: "Morgen kaufe ich ein.", ar: "غدًا سأتسوق.", parts: [["Morgen", "غدًا", "زمان أولًا"], ["kaufe", "أشتري", "فعل ثانيًا"], ["ich", "أنا", "فاعل بعد الفعل!"], ["ein", "تسوق", "مقطع einkaufen المنفصل"]]}]
  },
  "g-perfekt": {
   quick: "الماضي المحكي: فعل مساعد (haben/sein) ثانيًا + التصريف الثالث آخر الجملة: Ich habe gelernt / Ich bin gegangen.",
   why: "هكذا يحكي الألمان يومهم في 90% من المواقف. من يتقن Perfekt يستطيع سرد أمس كاملًا — أول قفزة حقيقية نحو الطلاقة.",
   when: ["حكاية الماضي اليومي: Gestern habe ich gearbeitet", "الحركة: Ich bin nach Berlin gefahren", "التغيّر: Ich bin aufgewacht"],
   how: ["اختر المساعد: haben (الغالب) أو sein (حركة/تغيّر)", "صرّف المساعد ثانيًا: habe / hast / hat", "ضع Partizip II في النهاية: gemacht / gegangen", "السؤال: المساعد أولًا (Hast du gelernt؟)"],
   trick: "المساعد ثانيًا والثالث أخيرًا: habe ... gemacht — قوس الماضي الشهير.",
   vs: { title: "لا تخلط بين haben و sein في الماضي", a: "haben + gemacht/gegessen/gelernt (معظم الأفعال)", b: "sein + gegangen/gekommen/aufgewacht (حركة وتغيّر)", tip: "انتقل جسمك من مكان؟ ← sein. غير ذلك؟ ← haben." },
   reallife: [["Gestern habe ich lange gearbeitet.", "أمس عملت طويلًا."], ["Wir sind nach Hamburg gefahren.", "سافرنا إلى هامبورغ."]],
   breaks: [{ de: "Gestern habe ich lange gearbeitet.", ar: "أمس عملت طويلًا.", parts: [["Gestern", "أمس", "زمان أولًا"], ["habe", "المساعد", "haben ثانيًا"], ["ich", "أنا", "فاعل"], ["lange", "طويلًا", "كيفية"], ["gearbeitet", "عملت", "Partizip II أخيرًا"]]}]
  },
  "g-partizip2": {
   quick: "التصريف الثالث: منتظم ge + جذر + t (gemacht)، وشاذ يتغيّر (gegessen / gegangen) ويُحفظ مع الفعل.",
   why: "بدون Partizip II لا يوجد ماضٍ. وهو أيضًا صفة جاهزة: das gekaufte Brot (الخبز المشترى).",
   when: ["نهاية Perfekt: habe gemacht", "المبني للمجهول لاحقًا", "صفة من فعل: ein gebrauchtes Auto"],
   how: ["منتظم: ge + mach + t = gemacht", "منفصل: المقطع يحتضن ge: angerufen", "غير منفصل be/ver: بدون ge: besucht / verkauft", "شاذ: احفظ الثلاثي: essen — aß — gegessen"],
   trick: "be و ver و zer تكره ge: besucht وليس gebesucht. هذه بادئات ترفض القبعة.",
   reallife: [["Das Essen ist gekocht.", "الطعام مطبوخ (جاهز)."]],
   breaks: [{ de: "Ich habe das Essen gekocht.", ar: "طبخت الطعام.", parts: [["Ich", "أنا", "فاعل"], ["habe", "المساعد", "haben"], ["das Essen", "الطعام", "مفعول"], ["gekocht", "طبخت", "Partizip II أخيرًا"]]}]
  },
  "h-akkusativ": {
   quick: "خمسة حروف تأخذ Akkusativ دائمًا: durch / für / gegen / ohne / um. بعدها المذكر den والمؤنث die.",
   why: "هذه الخمسة لا تتغير أبدًا — أسهل مجموعة حروف في الألمانية. حفظها يضمن 5 حروف بلا أخطاء مدى الحياة.",
   when: ["العبور: durch den Park", "الغرض: für dich / für 10 Euro", "المواجهة: gegen das Auto", "الغياب: ohne mich", "الدوران/الوقت: um den Tisch / um 8 Uhr"],
   how: ["احفظ الخمسة كأغنية: durch - für - gegen - ohne - um", "طبّق Akkusativ: den / die / das", "الضمائر: mich / dich / ihn"],
   trick: "كلمة DO-FOG-U بالإنجليزية؟ بالعربية: دفْعُم (durch - für - gegen - ohne - um). خمسة لا سادس لها.",
   reallife: [["Das Geschenk ist für dich.", "الهدية لك."], ["Ohne dich bin ich verloren.", "بدونك أنا ضائع."]],
   breaks: [{ de: "Das Geschenk ist für dich.", ar: "الهدية لك.", parts: [["Das Geschenk", "الهدية", "فاعل"], ["ist", "تكون", "فعل sein"], ["für dich", "لك", "für + Akkusativ: dich"]]}]
  },
  "h-dativ": {
   quick: "ثمانية حروف تأخذ Dativ دائمًا: aus / bei / mit / nach / seit / von / zu / gegenüber. بعدها المذكر dem.",
   why: "هذه الثمانية هي حروف الحياة اليومية: أذهب مع (mit)، وأعود من (von)، وأسكن عند (bei). إتقانها يغطي معظم جمل المواصلات والمصالح.",
   when: ["الرفقة والوسيلة: mit dem Bus / mit meinem Freund", "الأصل: aus Ägypten / von Berlin", "الاتجاه للأشخاص: zu meinem Vater / nach Hause", "المدة المستمرة: seit 2020"],
   how: ["احفظ الثمانية: aus - bei - mit - nach - seit - von - zu - gegenüber", "طبّق Dativ: dem / der / dem / den+n", "الضمائر: mir / dir / ihm / ihr"],
   trick: "mit و nach و von و zu الأربعة الكبار تغطي 80% من الاستخدام. ابدأ بها ثم أضف الباقي.",
   vs: { title: "لا تخلط بين nach و zu", a: "nach + مدن وبلاد بلا أداة: nach Berlin / nach Hause", b: "zu + أشخاص وأماكن بأداة: zum Arzt / zur Schule", tip: "بلا أداة؟ ← nach. يوجد der/die؟ ← zu. و nach Hause و zu Hause استثناءان يُحفظان." },
   reallife: [["Ich fahre mit dem Bus zur Arbeit.", "أذهب بالحافلة إلى العمل."], ["Seit einem Jahr lerne ich Deutsch.", "أتعلم الألمانية منذ سنة."]],
   breaks: [{ de: "Ich fahre mit dem Bus zur Arbeit.", ar: "أذهب بالحافلة إلى العمل.", parts: [["Ich", "أنا", "فاعل"], ["fahre", "أذهب/أركب", "فعل ثانيًا"], ["mit dem Bus", "بالحافلة", "mit + Dativ"], ["zur Arbeit", "إلى العمل", "zu + der = zur"]]}]
  },
  "i-fragewoerter": {
   quick: "كلمات السؤال W: wer (من) / was (ماذا) / wo (أين) / wann (متى) / wie (كيف) / warum (لماذا) — والسؤال يبدأ بها والفعل ثانيًا.",
   why: "بست كلمات تفتح أي محادثة: من أنت؟ ماذا تعمل؟ أين تسكن؟ — من يحفظها مع إجاباتها الجاهزة لا يصمت أبدًا.",
   when: ["الشخص: Wer bist du؟", "الشيء: Was ist das؟", "المكان: Wo wohnst du؟", "الزمان: Wann kommst du؟", "الكيفية: Wie geht's؟", "السبب: Warum lernst du Deutsch؟"],
   how: ["ابدأ بكلمة السؤال", "الفعل المُصرَّف ثانيًا", "الفاعل بعد الفعل: Wo wohnst du؟", "الإجابة بدون الكلمة: In Kairo (على Wo)"],
   trick: "كل كلمة سؤال لها إجابة ثابتة النوع: Wo ← مكان، و Wann ← زمان، و Wer ← شخص. احفظ السؤال مع نوع إجابته.",
   reallife: [["Woher kommst du? — Aus Ägypten.", "من أين أنت؟ — من مصر."]],
   breaks: [{ de: "Woher kommst du?", ar: "من أين أنت؟", parts: [["Woher", "من أين", "سؤال عن المصدر"], ["kommst", "تأتي", "فعل ثانيًا"], ["du", "أنت", "فاعل"]]}]
  },
  "i-fragen": {
   quick: "ثلاثة أنواع: سؤال W (بكلمة استفهام)، وسؤال نعم/لا (بالفعل أولًا)، وسؤال بديل (oder). والفعل المُصرَّف ثانيًا أو أولًا — لا ثالث.",
   why: "ترتيب السؤال ثابت لا يتغير: الفعل قبل الفاعل دائمًا. من يطبق هذه الآلية يسأل عن أي شيء دون حفظ قوالب.",
   when: ["سؤال W: Was machst du؟", "نعم/لا: Kommst du morgen؟ — Ja/Nein", "بديل: Tee oder Kaffee؟"],
   how: ["سؤال W: كلمة + فعل + فاعل (Wo wohnst du؟)", "نعم/لا: فعل + فاعل (Bist du müde؟)", "الإجابة: Ja / Nein / Doch (على المنفي)"],
   trick: "السؤال = الخبر مقلوبًا: Du kommst ← Kommst du؟ اقلب الفعل والفاعل تحصل على سؤال.",
   reallife: [["Kommst du morgen mit? — Ja, gern!", "هل تأتي معنا غدًا؟ — نعم بكل سرور!"]],
   breaks: [{ de: "Kommst du morgen mit?", ar: "هل تأتي معنا غدًا؟", parts: [["Kommst", "هل تأتي", "فعل أولًا (سؤال)"], ["du", "أنت", "فاعل"], ["morgen", "غدًا", "زمان"], ["mit", "معنا", "مقطع mitkommen المنفصل"]]}]
  },
  "i-konjunktionen": {
   quick: "أدوات الربط: und/oder/aber/denn تبقي الفعل ثانيًا، و weil/dass/ob ترسل الفعل إلى النهاية (جملة فرعية).",
   why: "الفرق بين denn و weil هو أشهر فخ: نفس المعنى (لأن)، وترتيب مختلف تمامًا. الخلط بينهما خطأ يسمعه الألماني فورًا.",
   when: ["الجمع والبديل: und / oder (الفعل ثانيًا)", "التعارض: aber (الفعل ثانيًا)", "السبب الرئيسي: denn (الفعل ثانيًا)", "السبب الفرعي: weil (الفعل أخيرًا)"],
   how: ["und/oder/aber/denn + جملة بفعل ثانٍ", "weil/dass/ob + ... + فعل أخير: weil ich krank bin", "الفاصلة قبل weil/dass إجبارية"],
   trick: "denn صديقة الترتيب (لا تغيّر شيئًا)، و weil مقلوبة الترتيب (تخطف الفعل للنهاية).",
   vs: { title: "لا تخلط بين denn و weil", a: "denn + فعل ثانٍ: Ich bleibe, denn ich bin krank", b: "weil + فعل أخير: Ich bleibe, weil ich krank bin", tip: "رأيت الفعل ثانيًا؟ ← denn. رأيته أخيرًا؟ ← weil. نفس المعنى، وهندسة مختلفة." },
   reallife: [["Ich lerne Deutsch, weil ich in Berlin arbeiten will.", "أتعلم الألمانية لأنني أريد العمل في برلين."]],
   breaks: [{ de: "Ich bleibe zu Hause, weil ich krank bin.", ar: "أبقى في البيت لأنني مريض.", parts: [["Ich bleibe zu Hause", "أبقى في البيت", "جملة رئيسية (فعل ثانٍ)"], ["weil", "لأن", "رابط فرعي"], ["ich krank bin", "أنني مريض", "الفعل bin في النهاية!"]]}]
  },
  "i-w-weil": {
   quick: "weil = لأن — تبدأ جملة فرعية والفعل المُصرَّف يقفز إلى نهايتها: weil ich krank bin.",
   why: "السبب في الألمانية يُبنى كجملة فرعية كاملة. من يتقن weil يتقن كل الجمل الفرعية — نفس القفزة في dass و ob و wenn.",
   when: ["تعليل أي فعل: Ich lerne, weil ich muss", "الرد على Warum: Warum؟ — Weil…", "الرسمي: da بدل weil في أول الجملة"],
   how: ["الفاصلة قبل weil إجبارية", "الفاعل بعد weil مباشرة", "الفعل المُصرَّف في النهاية", "مع فعل ناقص: مصدران في النهاية (weil ich arbeiten muss)"],
   trick: "weil تخطف الفعل: انظر آخر الجملة تجد الفعل مختبئًا هناك.",
   reallife: [["Ich bleibe heute zu Hause, weil ich krank bin.", "أبقى اليوم في البيت لأنني مريض."]],
   breaks: [{ de: "Ich bleibe zu Hause, weil ich krank bin.", ar: "أبقى في البيت لأنني مريض.", parts: [["Ich", "أنا", "فاعل رئيسي"], ["bleibe", "أبقى", "فعل رئيسي ثانٍ"], ["weil", "لأن", "فاصلة + رابط"], ["ich krank bin", "أنني مريض", "فعل الفرعية أخيرًا"]]}]
  },
  "i-w-wer": {
   quick: "wer (من/فاعل) / wen (من/مفعول) / wem (لمن/مستفيد): ضمير الاستفهام الوحيد الذي يتغير مع الحالة.",
   why: "هذا الثلاثي هو اختبار الحالات السريع: من يفرّق بينها يفرّق بين الحالات كلها.",
   when: ["فاعل: Wer kommt heute؟ — Mein Bruder", "مفعول: Wen siehst du؟ — Meinen Bruder", "مستفيد: Wem hilfst du؟ — Meinem Bruder"],
   how: ["الإجابة er ← السؤال wer", "الإجابة ihn ← السؤال wen", "الإجابة ihm ← السؤال wem"],
   trick: "نفس الأخ مع ثلاث نهايات: er / ihn / ihm — والسؤال يكشف النهاية قبل الإجابة.",
   reallife: [["Wen rufst du an? — Meinen Vater.", "من تتصل به؟ — والدي."]],
   breaks: [{ de: "Wen rufst du an?", ar: "من تتصل به؟", parts: [["Wen", "من (مفعول)", "سؤال Akkusativ"], ["rufst", "تتصل", "فعل ثانيًا"], ["du", "أنت", "فاعل"], ["an", "هاتفيًا", "مقطع anrufen"]]}]
  },
  "m-verbstellung": {
   quick: "للفعل ثلاثة مواضع فقط: ثانيًا في الخبر وسؤال W، وأولًا في سؤال نعم/لا والأمر، وأخيرًا في الجملة الفرعية.",
   why: "هذه القاعدة الواحدة تضبط كل جملة ألمانية. 80% من أخطاء الترتيب سببها فعل ليس في مكانه.",
   when: ["خبر: Ich lerne Deutsch (ثانٍ)", "ظرف أولًا: Heute lerne ich (الفعل يبقى ثانيًا!)", "نعم/لا: Lernst du؟ (أولًا)", "فرعية: weil ich lerne (أخيرًا)"],
   how: ["حدد نوع الجملة أولًا", "خبر أو W ← الفعل ثانيًا مهما بدأت", "نعم/لا أو أمر ← الفعل أولًا", "فرعية مع weil/dass ← الفعل أخيرًا"],
   trick: "الفعل الثاني قانون حديدي: حتى لو بدأت بـ Heute أو Morgen، الفعل لا يتحرك من المرتبة الثانية.",
   vs: { title: "لا تخلط بين Heute ich و Heute lerne ich", a: "خطأ: Heute ich lerne (الفعل ثالثًا)", b: "صح: Heute lerne ich (الفعل ثانيًا والفاعل بعده)", tip: "القاعدة: عنصران قبل الفعل ممنوعان. الظرف يطرد الفاعل من مكانه — الفاعل يقف بعد الفعل." },
   reallife: [["Heute lerne ich Deutsch.", "اليوم أتعلم الألمانية."], ["Morgen besuche ich meine Oma.", "غدًا أزور جدتي."]],
   breaks: [{ de: "Heute lerne ich Deutsch.", ar: "اليوم أتعلم الألمانية.", parts: [["Heute", "اليوم", "ظرف أولًا"], ["lerne", "أتعلم", "فعل ثانيًا (ثابت!)"], ["ich", "أنا", "فاعل بعد الفعل"], ["Deutsch", "الألمانية", "مفعول"]]}]
  },
  "m-tmp": {
   quick: "ترتيب الجملة الكامل TeKaMoLo: زمان (متى) ثم كيفية (كيف) ثم مكان (أين). والضمير Dativ يأتي قبل اسم Akkusativ.",
   why: "الألماني يرتب معلومات الجملة بهذا التسلسل تلقائيًا. من يطبقه يبدو طبيعيًا؛ ومن يعكسه يُفهم لكن يُسمع أنه أجنبي.",
   when: ["جملة كاملة: Ich fahre morgen mit dem Bus nach Berlin", "مفعولان: Ich gebe dir das Buch (ضمير قبل اسم)", "النفي والظروف داخل نفس الترتيب"],
   how: ["1 زمان: morgen / heute / um 8 Uhr", "2 كيفية: gern / mit dem Bus / schnell", "3 مكان: nach Berlin / zu Hause", "ضمير Dativ قبل اسم Akkusativ دائمًا"],
   trick: "Te-Ka-Mo-Lo: احفظها ككلمة واحدة (تيكامولو). زمان يسبق المكان دائمًا.",
   reallife: [["Ich fahre morgen mit dem Bus nach Berlin.", "أسافر غدًا بالحافلة إلى برلين. (زمان-كيفية-مكان)"]],
   breaks: [{ de: "Ich fahre morgen mit dem Bus nach Berlin.", ar: "أسافر غدًا بالحافلة إلى برلين.", parts: [["Ich", "أنا", "فاعل"], ["fahre", "أسافر", "فعل ثانٍ"], ["morgen", "غدًا", "زمان Te"], ["mit dem Bus", "بالحافلة", "كيفية Mo"], ["nach Berlin", "إلى برلين", "مكان Lo"]]}]
  },
  "m-haupt-neben": {
   quick: "الجملة الرئيسية فعلها ثانٍ (Ich bleibe zu Hause)، والفرعية فعلها أخير (weil ich krank bin). الفاصلة بينهما إجبارية.",
   why: "كل weil و dass و ob تفتح جملة فرعية بفعل أخير. فهم الفرق بين النوعين يفتح الباب للجمل الطويلة والكتابة الرسمية.",
   when: ["سبب: weil / da", "محتوى: dass (أعتقد أن…)", "شرط: wenn (عندما/إذا)", "سؤال غير مباشر: ob (هل)"],
   how: ["الرئيسية: فعل ثانٍ", "فاصلة إجبارية", "الرابط: weil/dass/wenn/ob", "الفرعية: ... + فعل أخير"],
   trick: "الفاصلة بوابة الفرعية: بعدها الفعل يقفز للنهاية. لا فاصلة = لا فرعية.",
   reallife: [["Ich denke, dass du recht hast.", "أعتقد أنك على حق."]],
   breaks: [{ de: "Ich denke, dass du recht hast.", ar: "أعتقد أنك على حق.", parts: [["Ich denke", "أعتقد", "رئيسية (فعل ثانٍ)"], ["dass", "أن", "رابط فرعي"], ["du recht hast", "أنك على حق", "فعل الفرعية أخيرًا"]]}]
  },
  "a-satz-basis": {
   quick: "أبسط جملة ألمانية = فاعل + فعل مُصرَّف + تكملة. الفعل دائمًا في المرتبة الثانية — هذه أول وأهم قاعدة.",
   why: "كل القواعد القادمة تفاصيل على هذه الهيكلية. من يبنيها صحيبًا يضيف عليها الحالات والأزمنة بسهولة.",
   when: ["تعريف: Ich bin Ahmed", "فعل يومي: Ich lerne Deutsch", "سؤال بقلب الترتيب: Lernst du؟"],
   how: ["1 اختر الفاعل: ich / du / er", "2 صرّف الفعل: lerne / lernst / lernt", "3 أضف التكملة: Deutsch / in Kairo", "الفعل ثانيًا دائمًا — احفظ مكان الكرسي"],
   trick: "كرسي الفعل محجوز في المرتبة الثانية: لا يجلس عليه ظرف ولا فاعل.",
   reallife: [["Ich wohne in Kairo.", "أسكن في القاهرة."], ["Er trinkt Kaffee.", "هو يشرب قهوة."]],
   breaks: [{ de: "Ich wohne in Kairo.", ar: "أسكن في القاهرة.", parts: [["Ich", "أنا", "فاعل أولًا"], ["wohne", "أسكن", "فعل ثانيًا"], ["in Kairo", "في القاهرة", "تكملة مكان"]]}]
  },
  "p-vergleiche": {
   quick: "صفحة المراجعة السريعة: أشهر الثنائيات المربكة جنبًا إلى جنب — nicht/kein، den/dem، wen/wem، wo/wohin، sein/haben.",
   why: "الامتحان لا يسأل القاعدة وحدها بل الفرق بين قاعدتين متشابهتين. هذه الصفحة تدرب عينك على الفروق الدقيقة.",
   when: ["قبل أي اختبار: راجع الثنائية التي تخطئ فيها", "عند التردد بين شكلين في الكتابة", "للمراجعة الأسبوعية السريعة"],
   how: ["اقرأ المثالين المتقابلين", "لاحظ الكلمة الفارقة الواحدة", "طبّق سؤال الاختبار: Wer/Wen/Wem؟", "ارجع للدرس الأصلي عبر الروابط"],
   trick: "الفرق دائمًا كلمة واحدة: den/dem، kein/nicht، wo/wohin. درّب عينك على تلك الكلمة.",
   reallife: [["Ich habe kein Auto. / Ich fahre nicht.", "ليس لدي سيارة. / أنا لا أقود. (kein للاسم، nicht للفعل)"]],
   breaks: []
  },
  "p-fehler": {
   quick: "أشهر أخطاء العرب في الألمانية: كل خطأ مع تصحيحه وسببه — راجعها قبل أن تقع فيها.",
   why: "أخطاؤنا متشابهة لأن لغتنا الأم واحدة: ننقل تركيب العربية إلى الألمانية. معرفة الفخ مسبقًا تمنع الوقوع فيه.",
   when: ["بعد كل مستوى: افحص أخطاء مستواك", "قبل الكتابة الرسمية", "عندما يصحح لك ألماني — ابحث عن خطئك هنا"],
   how: ["اقرأ الجملة الخاطئة أولًا واكتشف الخطأ بنفسك", "قارن بالصحيحة ولاحظ الفرق", "اقرأ السبب واحفظ القاعدة", "أعد كتابة الصحيحة من ذاكرتك"],
   trick: "الخطأ الذي تكتشفه بنفسك لا تنساه أبدًا — غطِّ الإجابة قبل قراءتها.",
   reallife: [["Ich bin 20 Jahre alt. (وليس: Ich habe 20 Jahre)", "عمري 20 سنة — الألماني يكون العمر بـ sein لا haben."]],
   breaks: []
  },
  "o-gruesse": {
   quick: "التحية والتعريف: Guten Morgen / Guten Tag / Guten Abend + Ich heiße… + Ich komme aus… + Ich wohne in…",
   why: "أول 30 ثانية من أي لقاء ألماني ثابتة ومحفوظة. إتقانها يمنحك ثقة فورية ويترك انطباعًا ممتازًا.",
   when: ["اللقاء الأول: Wie heißt du؟", "الرسمي: Wie heißen Sie؟", "الوداع: Tschüss / Auf Wiedersehen"],
   how: ["التحية حسب الوقت", "الاسم: Ich heiße Ahmed", "الأصل: Ich komme aus Ägypten", "السكن: Ich wohne in Kairo"],
   trick: "ثلاث جمل تفتح أي حوار: اسمي + أصلي + سكني. احفظها غيبًا وانطقها ببطء وثقة.",
   reallife: [["Guten Tag! Ich heiße Ahmed. Ich komme aus Ägypten.", "نهارك سعيد! اسمي أحمد. أنا من مصر."]],
   breaks: [{ de: "Ich heiße Ahmed.", ar: "اسمي أحمد.", parts: [["Ich", "أنا", "فاعل"], ["heiße", "أُدعى", "فعل heißen"], ["Ahmed", "أحمد", "اسم العلم (يكتب كبيرًا)"]]}]
  }
 }
};
