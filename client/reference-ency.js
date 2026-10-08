/* Deutsch Master — Reference encyclopedia overlay (ADDITIVE ONLY, pure data).
 * No REF_* globals here on purpose: tools/check-reference.js, check-ref-dups.js
 * and check-ref-dom.js only scan `reference-data-*.js` files and `var REF_*`
 * arrays, so this file never interferes with those gates.
 * Runtime: reference.js merges `overlays` into topics (by id), and uses
 * `aliases`/`phrases`/`featured` for search + homepage. All ids referenced
 * below MUST already exist in the planned registry (no new topic ids).
 */
"use strict";
try { window.DMRefEncy = window.DMRefEncy || null; } catch (e) {}
window.DMRefEncy = {
 featured: ["d-akkusativ", "d-dativ", "b-artikel-bestimmt", "c-personal", "f-modal", "i-negation", "h-wechsel", "d-vergleich", "g-perfekt", "b-nomen-plural"],
 aliases: {
  "d-nominativ": ["الفاعل", "فاعل", "subject", "Wer", "Nominative"],
  "d-akkusativ": ["المفعول به", "مفعول به", "مفعول مباشر", "object", "Wen", "Accusative"],
  "d-dativ": ["المفعول غير المباشر", "غير المباشر", "المستفيد", "indirect object", "Wem", "Dative"],
  "d-genitiv": ["الملكية", "ملكية", "الاضافة", "Wessen", "Genitive", "possession"],
  "d-vergleich": ["مقارنة الحالات", "الحالات الاربع", "الحالات الأربعة", "cases compared", "Kasus"],
  "b-artikel-bestimmt": ["ادوات التعريف", "أدوات التعريف", "ال المعرفة", "definite articles"],
  "b-artikel-unbestimmt": ["ادوات النكرة", "أدوات النكرة", "indefinite articles"],
  "b-artikel-negativ": ["النفي", "نفي الاسم", "kein", "negation"],
  "c-personal": ["الضمائر الشخصية", "ضمائر شخصية", "personal pronouns", "Personalpronomen"],
  "c-possessiv": ["ضمائر الملكية", "possessive pronouns"],
  "f-modal": ["الافعال الناقصة", "الأفعال الناقصة", "modal verbs", "Modalverben"],
  "i-negation": ["النفي", "نفي", "nicht", "kein", "negation", "doch"],
  "h-wechsel": ["حروف الجر المتغيرة", "Wechselpräpositionen", "Wo Wohin"],
  "h-akkusativ": ["حروف جر اكوزاتيف", "Akkusativ Präpositionen"],
  "h-dativ": ["حروف جر داتيف", "Dativ Präpositionen"],
  "g-perfekt": ["الماضي", "ماضي", "past tense", "present perfect"],
  "g-praeteritum": ["الماضي البسيط", "past simple", "Präteritum"],
  "m-verbstellung": ["ترتيب الفعل", "الفعل الثاني", "verb position", "V2"],
  "m-tmp": ["ترتيب الجملة", "TeKaMoLo", "زمان كيفية مكان"],
  "b-nomen-plural": ["الجمع", "جمع", "plural", "Plural"]
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
   reallife: [["Ich kaufe jeden Morgen frisches Brot.", "أشتري خبزًا طازجًا كل صباح."], ["Der Professor erklärt die Lektion sehr gut.", "الأستاذ يشرح الدرس جيدًا جدًا."], ["Wir besuchen unsere Tante am Freitag.", "نزور عمتنا يوم الجمعة."]],
   breaks: [{ de: "Ich kaufe jeden Morgen frisches Brot.", ar: "أشتري خبزًا طازجًا كل صباح.", parts: [["Ich", "أنا", "فاعل Nominativ"], ["kaufe", "أشتري", "الفعل ثانيًا"], ["frisches Brot", "خبزًا طازجًا", "مفعول Akkusativ (محايد: das Brot)"], ["jeden Morgen", "كل صباح", "تعبير زمني في Akkusativ"]]}]
  },
  "d-dativ": {
   quick: "Dativ = حالة المستفيد أو المتأثر: أعطيت لمن؟ ساعدت من؟ اسأل Wem؟ (لمن). أدواته: dem / der / dem / den+n.",
   why: "أفعال كاملة في الألمانية لا تأخذ مفعولًا مباشرًا بل مستفيدًا (helfen / danken / gehören / gefallen / antworten). ولو استخدمت Akkusativ معها ستبدو الجملة خاطئة للألماني فورًا: Er hilft mir (وليس mich).",
   when: ["مع أفعال Dativ الثابتة: helfen / danken / gehören / gefallen / antworten / gratulieren", "بعد حروف الجر: mit / nach / aus / zu / bei / seit / von / gegenüber", "بعد حروف Wechsel مع سؤال Wo؟ (ثبات في مكان)", "عند وجود مفعولين: ضمير Dativ يأتي قبل اسم Akkusativ (Ich gebe dir das Buch)"],
   how: ["اسأل: Wem + الجملة؟", "الإجابة = Dativ", "طبّق الأداة: der ← dem / die ← der / das ← dem / جمع die ← den + n للاسم", "الضمائر: ich ← mir / du ← dir / er ← ihm / sie (هي) ← ihr", "مع مفعولين: ضع ضمير Dativ قبل اسم Akkusativ"],
   trick: "helfen خائنة: معناها (يساعد) يوحي بمفعول مباشر، لكنها تأخذ Dativ دائمًا. احفظها هكذا: helfen + mir/dir/ihm.",
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
   reallife: [["Kennst du meinen Nachbarn? — Ja, ich kenne ihn gut.", "هل تعرف جاري؟ — نعم، أعرفه جيدًا."], ["Kannst du mir bitte helfen?", "هل يمكنك مساعدتي من فضلك؟"]],
   breaks: [{ de: "Kannst du mir bitte helfen?", ar: "هل يمكنك مساعدتي من فضلك؟", parts: [["Kannst", "هل تستطيع", "فعل modal أولًا (سؤال)"], ["du", "أنت", "فاعل"], ["mir", "لي (مساعدتي)", "ضمير Dativ لأن helfen داتيفية"], ["helfen", "المساعدة", "المصدر في النهاية"]]}]
  },
  "f-modal": {
   quick: "الأفعال الناقصة (können / müssen / wollen / sollen / dürfen / mögen / möchten) تُصرَّف في المرتبة الثانية وترسل المصدر إلى نهاية الجملة.",
   why: "الألماني يعبّر عن القدرة والوجوب والرغبة والإذن بهذه الأفعال بدل تراكيب طويلة. إتقانها يعني أنك تستطيع الطلب والاستئذان والاعتذار — أهم مهارات A1 العملية.",
   when: ["القدرة: Ich kann schwimmen", "الوجوب: Ich muss arbeiten", "الرغبة: Ich will / möchte", "النصيحة: Du sollst zum Arzt", "الإذن والمنع: Darf ich؟ / dürfen nicht = ممنوع"],
   how: ["صرّف الناقص حسب الفاعل (ich kann / du kannst — وانتبه ich/er بلا نهاية في الشواذ)", "ضع الناقص في المرتبة الثانية", "أرسل الفعل الرئيسي مصدرًا إلى النهاية: Ich muss heute arbeiten", "في السؤال ابدأ بالناقص: Kannst du mir helfen؟", "في النفي: الفعل المنفي بـ nicht يبقى مصدرًا: Ich kann nicht kommen"],
   trick: "الناقص أناني والمعنى كريم: الناقص يجلس ثانيًا مرتاحًا، والفعل الحقيقي يُنفى إلى آخر الجملة.",
   reallife: [["Ich muss morgen früh zum Amt.", "يجب أن أذهب للمصلحة غدًا مبكرًا."], ["Darf ich Sie etwas fragen?", "هل يُسمح لي أن أسأل حضرتك شيئًا؟"], ["Wir möchten bitte zweimal Kaffee.", "نود اثنين قهوة من فضلك. (في المقهى)"]],
   breaks: [{ de: "Ich muss morgen früh zum Amt.", ar: "يجب أن أذهب للمصلحة غدًا مبكرًا.", parts: [["Ich", "أنا", "فاعل"], ["muss", "يجب", "ناقص مُصرَّف ثانيًا"], ["morgen früh", "غدًا مبكرًا", "زمان"], ["zum Amt", "إلى المصلحة", "اتجاه (zu + Dativ)"], ["(gehen)", "الذهاب (محذوف مفهوم)", "المصدر قد يُحذف مع الذهاب"]]}]
  },
  "i-negation": {
   quick: "kein تنفي اسمًا له أداة (Ich habe kein Auto)، و nicht تنفي الفعل أو الصفة أو الجملة (Ich fahre nicht). و nein رد على سؤال، و doch رد بالإثبات على سؤال منفي.",
   why: "العربية تنفي بـ (لا/ليس/ما) لأي شيء، لكن الألمانية تفرّق بين نفي الشيء ونفي الحدث. الخلط بينهما أشهر خطأ عربي: Ich habe nicht Auto (خطأ) مقابل Ich habe kein Auto (صح).",
   when: ["اسم غير محدد منفي ← kein/keine/keinen (يُصرَّف مثل ein)", "فعل أو صفة أو ظرف أو جملة كاملة ← nicht", "الرد بكلمة واحدة على سؤال ← nein", "الاعتراض على نفي (نعم بل!) ← doch", "أشخاص وأشياء مطلقة: niemand (لا أحد) / nichts (لا شيء) / nie (أبدًا)"],
   how: ["اسأل: هل أنفي اسمًا؟ نعم ← kein مع تصريف ein", "هل أنفي فعلًا أو صفة؟ نعم ← nicht (آخر الجملة غالبًا، وقبل الصفة مباشرة)", "سؤال منفي وأريد إثبات العكس؟ استخدم doch: Kommst du nicht؟ — Doch! (بل آتٍ!)"],
   trick: "له أداة ويُنفى ← kein تحل محل الأداة. ليس اسمًا ← nicht. وسؤال منفي يُكذَّب ← doch وحدها تكفي.",
   reallife: [["Ich habe heute keine Zeit, ich muss lernen.", "ليس لدي وقت اليوم، يجب أن أذاكر."], ["— Sprichst du kein Deutsch? — Doch, ein bisschen!", "— ألا تتحدث الألمانية؟ — بل أتحدث قليلًا!"], ["Das Essen schmeckt nicht gut.", "الطعام طعمه ليس جيدًا."]],
   breaks: [{ de: "Ich habe heute keine Zeit.", ar: "ليس لدي وقت اليوم.", parts: [["Ich", "أنا", "فاعل"], ["habe", "لدي (أملك)", "فعل ثانيًا"], ["heute", "اليوم", "زمان"], ["keine Zeit", "لا وقت", "نفي اسم مؤنث: keine"]]}]
  },
  "h-wechsel": {
   quick: "الحروف التسعة (an / auf / hinter / in / neben / über / unter / vor / zwischen) تأخذ Dativ مع سؤال Wo؟ (ثبات) و Akkusativ مع Wohin؟ (حركة واتجاه).",
   why: "نفس الحرف يصف علاقتين مختلفتين: أين الشيء ساكنًا؟ وإلى أين يتحرك؟ الألمانية تميزهما بالحالة بدل حرف جديد: auf dem Tisch (فوقها ساكن) مقابل auf den Tisch (وضعه فوقها).",
   when: ["وصف مكان ثابت ← Wo؟ ← Dativ: Das Buch liegt auf dem Tisch", "حركة نحو مكان ← Wohin؟ ← Akkusativ: Ich lege das Buch auf den Tisch", "مع أفعال الثنائيات: liegen/legen / stehen/stellen / sitzen/setzen / hängen"],
   how: ["اسأل Wo؟ (أين) أم Wohin؟ (إلى أين) — هذا السؤال يقرر كل شيء", "Wo؟ ← Dativ (dem / der / dem)", "Wohin؟ ← Akkusativ (den / die / das)", "احفظ الثنائيات معًا: liegen (ساكن + Wo) / legen (يحرك + Wohin)"],
   trick: "Wohin فيها n زيادة — والـ n تذكّرك بـ den (الأكوزاتيف). حركة ← n ← den. وثبات ← m ← dem.",
   reallife: [["Die Kinder spielen im Garten.", "الأطفال يلعبون في الحديقة. (ثبات)"], ["Die Kinder gehen in den Garten.", "الأطفال يذهبون إلى الحديقة. (حركة)"], ["Häng das Bild an die Wand!", "علّق الصورة على الحائط! (حركة)"]],
   breaks: [{ de: "Die Kinder gehen in den Garten.", ar: "الأطفال يذهبون إلى الحديقة.", parts: [["Die Kinder", "الأطفال", "فاعل جمع"], ["gehen", "يذهبون", "فعل حركة"], ["in den Garten", "إلى الحديقة", "Wohin؟ ← Akkusativ مذكر: den"]]}]
  }
 }
};
