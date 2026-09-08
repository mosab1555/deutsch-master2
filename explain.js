/* Deutsch Master - Detailed A1 Explanations (explain.js)
   Single source for the "📚 الشرح" section. A1 only.
   Keyed by GRAMMAR id: g1..g30. Rendered by script.js (renderExplain).
   German content verified for A1 accuracy. */
"use strict";

const EXPLAIN_ORDER = ["g1","g2","g3","g4","g5","g6","g7","g8","g9","g10","g11","g12","g13","g14","g15","g16","g17","g18","g19","g20","g21","g22","g23","g24","g25","g26","g27","g28","g29","g30"];

const EXPLAIN = {

g1: {
what: "كل اسم ألماني له «جنس» ثابت: مذكر يأخذ der، مؤنث يأخذ die، محايد يأخذ das. الأداة جزء من الكلمة نفسها وليست إضافة اختيارية.",
why: "بدون الأداة الصحيحة الجملة تكون خاطئة، والأداة تغيّر شكل الصفات والضمائر وحروف الجر بعدها. من يحفظ الكلمة بدون أداتها سيخطئ في كل القواعد التالية (Akkusativ و Dativ والجمع).",
when: ["مع أي اسم مفرد: der Tisch (الطاولة)، die Tasche (الحقيبة)، das Buch (الكتاب).", "عند الإشارة لشيء معروف: Der Kaffee ist heiß (القهوة ساخنة).", "لا نستخدم أداة مع الأفعال والصفات standalone ومعظم أسماء البلاد واللغات."],
how: ["احفظ الكلمة هكذا دائمًا: der Freund، وليس Freund فقط.", "قاعدة مساعدة (ليست 100%): كلمات تنتهي بـ -ung و -heit و -keit و -schaft غالبًا مؤنثة (die). وكلمات تنتهي بـ -chen و -lein غالبًا محايدة (das).", "غير ذلك لا يوجد منطق: der Löffel (ملعقة مذكر) لكن die Gabel (شوكة مؤنث) — الحفظ هو الحل."],
examples: [["der Tisch ist groß.", "الطاولة كبيرة."], ["die Lampe ist neu.", "المصباح جديد."], ["das Buch ist gut.", "الكتاب جيد."]],
daily: [["Der Kaffee ist heiß.", "القهوة ساخنة."], ["Die Milch ist kalt.", "الحليب بارد."], ["Das Brot ist frisch.", "الخبز طازج."]],
notes: ["القاموس يكتب m للـ der و f للـ die و n للـ das — تعلم قراءة هذه الرموز.", "الجمع في الألمانية القياسية أداته die دائمًا مهما كانت أداة المفرد.", "في بطاقات هذا التطبيق نعرض الجمع مع أداة المفرد لتثبيت حفظها (der Eintrag ← der Einträge)، لكن القاعدة القياسية أن الجمع بـ die."],
mistakes: [{w: "Tisch ist groß.", r: "Der Tisch ist groß.", why: "الاسم المفرد يحتاج أداته — لا تترك الاسم عاريًا."}, {w: "das Tasche", r: "die Tasche", why: "Tasche مؤنثة ثابتة — لا تخمن من المعنى العربي."}],
compare: "der/die/das للمعرفة (شيء محدد) ← تقابلها ein/eine للنكرة (شيء غير محدد): Der Mann (الرجل المعروف) مقابل Ein Mann (رجل ما). التفصيل في شرح «المعرفة والنكرة».",
summary: "كل اسم = أداة + اسم. احفظهما معًا دائمًا: der / die / das."
},

g2: {
what: "الجمع في الألمانية له عدة نهايات (-e و -er و -n/-en و -s وتغيّر Umlaut أحيانًا) ولا توجد قاعدة واحدة تختصرها كلها، لذلك يُحفظ الجمع مع كل اسم.",
why: "بدون حفظ الجمع ستخطئ في الكلام عن أكثر من شيء واحد، وهي من أكثر نقاط الامتحان في A1.",
when: ["عند الحديث عن أكثر من واحد: zwei Bücher (كتابان).", "أداة الجمع القياسية في الألمانية هي die دائمًا: die Bücher، die Tische.", "ملاحظة خاصة بهذا التطبيق: البطاقات تعرض الجمع بأداة المفرد (der Tische، das Bücher) لتثبيت الأداة الأصلية — أما الامتحان والقاعدة القياسية فالجمع بـ die."],
how: ["احفظ كل اسم هكذا: der Tisch → die Tische.", "أشهر الأنماط: der Tisch→Tische، das Buch→Bücher (مع Umlaut)، die Tasche→Taschen، das Kind→Kinder.", "الكلمات الأجنبية الحديثة غالبًا +s: das Taxi→Taxis، das Hotel→Hotels."],
examples: [["der Tisch – die Tische", "الطاولة – الطاولات."], ["das Buch – die Bücher", "الكتاب – الكتب."], ["die Tasche – die Taschen", "الحقيبة – الحقائب."]],
daily: [["Die Kinder sind hier.", "الأطفال هنا."], ["Zwei Brötchen, bitte.", "خبزتان صغيرتان من فضلك."], ["Die Äpfel sind frisch.", "التفاح طازج."]],
notes: ["بعض الكلمات جمعها = مفردها: der Lehrer→die Lehrer، das Fenster→die Fenster.", "Umlaut (ä ö ü) يظهر كثيرًا في الجمع: der Mann→die Männer، die Mutter→die Mütter."],
mistakes: [{w: "die Buchs", r: "die Bücher", why: "الجمع لا يُخترع بإضافة s دائمًا — Buch جمعها Bücher."}, {w: "der Tische (في جملة رسمية)", r: "die Tische", why: "في الألمانية القياسية الجمع بـ die. صيغة der Tische موجودة في بطاقات التطبيق فقط كوسيلة حفظ للأداة. "}],
compare: "المفرد له 3 أدوات (der/die/das) لكن الجمع له أداة واحدة قياسية (die). قارن: der Mann (مفرد) ← die Männer (جمع).",
summary: "احفظ الجمع مع المفرد. القاعدة القياسية: الجمع بـ die."
},

g3: {
what: "الحرف الأول يُكتب كبيرًا في 4 حالات فقط — وأهمها أن كل اسم ألماني يُكتب بحرف كبير دائمًا حتى في وسط الجملة.",
why: "الكتابة بحرف صغير للاسم خطأ إملائي واضح وينقص الدرجات في الامتحان، لكنها في المقابل علامة تساعدك تميّز الأسماء داخل الجملة بسرعة.",
when: ["أول الجملة: Heute lerne ich.", "أسماء العلم: Ahmed، Berlin.", "كل الأسماء: das Buch، der Tisch — حتى لو نكرة: ein Tisch.", "ضمير المخاطب الرسمي Sie (حضرتك) — وحرف S كبير دائمًا."],
how: ["اسأل نفسك: هل الكلمة اسم (تشير لشيء/شخص)؟ ← اكتبها كبيرة.", "الفعل والصفة والحرف لا تكبر إلا في أول الجملة: lernen صغيرة، لكن Lernen كاسم (التعلّم) كبيرة."],
examples: [["Das Buch ist neu.", "الكتاب جديد."], ["Ich trinke Kaffee.", "أشرب قهوة."], ["Können Sie mir helfen?", "هل يمكنك مساعدتي؟ (رسمي)"]],
daily: [["Ich kaufe Brot und Milch.", "أشتري خبزًا وحليبًا."], ["Berlin ist schön.", "برلين جميلة."], ["Sprechen Sie Deutsch?", "هل تتحدث الألمانية؟ (رسمي)"]],
notes: ["sie (هي/هم) الصغيرة ≠ Sie (حضرتك) الكبيرة — الفرق فقط في الحرف الأول.", "اللغات كأسماء تُكتب كبيرة: Deutsch، Arabisch."],
mistakes: [{w: "ich lerne deutsch.", r: "Ich lerne Deutsch.", why: "بداية الجملة كبيرة، واللغة كاسم كبيرة."}, {w: "ich habe ein buch.", r: "Ich habe ein Buch.", why: "Buch اسم — يكبر دائمًا حتى بعد ein."}],
compare: "الإنجليزية تكبّر I فقط، الألمانية تكبّر كل الأسماء + Sie الرسمية.",
summary: "اسم ← كبير دائمًا. Sie الرسمية ← كبيرة دائمًا."
},

g4: {
what: "ضمائر الفاعل تحل محل الاسم الذي يقوم بالفعل: ich (أنا)، du (أنت)، er (هو)، es (هو/هي للمحايد)، sie (هي)، wir (نحن)، ihr (أنتم)، sie (هم)، Sie (حضرتك).",
why: "بدونها ستكرر الأسماء في كل جملة. وهي مفتاح تصريف الأفعال: كل ضمير له نهاية فعل مختلفة.",
when: ["بدل تكرار الاسم: Ahmed lernt. Er lernt viel (هو يتعلم كثيرًا).", "es للأشياء المحايدة والأطفال والحيوانات أحيانًا: Das Baby schläft. Es schläft.", "Sie الرسمية لمخاطبة الغرباء والموظفين والمعلمين."],
how: ["احفظها مرتبة: ich – du – er/es/sie (مفرد) ← wir – ihr – sie/Sie (جمع).", "الفعل يتغير مع كل ضمير (التفصيل في شرح الأفعال المنتظمة)."],
examples: [["Ich lerne Deutsch.", "أنا أتعلم الألمانية."], ["Du sprichst gut.", "أنت تتحدث جيدًا."], ["Wir wohnen in Kairo.", "نحن نسكن في القاهرة."]],
daily: [["Er kommt morgen.", "هو يأتي غدًا."], ["Sie ist nett.", "هي لطيفة."], ["Wohnt ihr hier?", "هل تسكنون هنا؟"]],
notes: ["du للصديق والعائلة والأطفال، و Sie للرسمي — الخلط بينهما خطأ اجتماعي قبل أن يكون لغويًا.", "sie الصغيرة = هي أو هم حسب الفعل، و Sie الكبيرة = حضرتك دائمًا."],
mistakes: [{w: "Du lernt Deutsch.", r: "Du lernst Deutsch.", why: "du تأخذ نهاية st وليست t."}, {w: "sie kommen (قصد حضرتك)", r: "Sie kommen.", why: "حضرتك تُكتب S كبيرة دائمًا."}],
compare: "ضمائر الفاعل (ich/du) للجملة العادية ← تقابلها ضمائر المفعول (mich/dich) في شرح Akkusativ.",
summary: "ich du er/es/sie – wir ihr sie/Sie. كل ضمير = نهاية فعل."
},

g5: {
what: "الأفعال المنتظمة (Regelmäßige Verben) تتصرف بنمط واحد ثابت: نحذف -en من المصدر ثم نضيف نهايات ثابتة.",
why: "أغلب أفعال A1 منتظمة. إتقان هذا النمط يعني أنك تستطيع تصريف مئات الأفعال فورًا.",
when: ["مع كل فعل ينتهي بـ -en ولا يتغير جذره: lernen، wohnen، spielen، machen."],
how: ["الخطوات: lernen ← الجذر lern ← أضف النهاية.", "النهايات: ich -e (lerne)، du -st (lernst)، er/sie/es -t (lernt)، wir -en (lernen)، ihr -t (lernt)، sie/Sie -en (lernen).", "ملاحظة النطق: إذا انتهى الجذر بـ -t أو -d نضيف e مساعدة مع du/er: du arbeitest (وليس arbeitst)."],
examples: [["Ich lerne Deutsch.", "أنا أتعلم الألمانية."], ["Du wohnst in Berlin.", "أنت تسكن في برلين."], ["Wir spielen Fußball.", "نحن نلعب كرة القدم."]],
daily: [["Ich mache Kaffee.", "أنا أصنع قهوة."], ["Er hört Musik.", "هو يسمع موسيقى."], ["Spielt ihr Tennis?", "هل تلعبون التنس؟"]],
notes: ["wir و sie/Sie دائمًا = المصدر نفسه — أسهل شكل للحفظ.", "du و er متشابهان لكن مختلفان: du lernst (بـ s) و er lernt (بدون s)."],
mistakes: [{w: "du lernt", r: "du lernst", why: "du تأخذ st دائمًا في المنتظم."}, {w: "ich lernst", r: "ich lerne", why: "ich تأخذ e فقط — لا تخلط النهايات."}],
compare: "المنتظم جذره ثابت (lern- دائمًا) ← الشاذ جذره يتغير (sprech- تصبح sprich- مع du/er).",
summary: "احذف en ثم أضف: e – st – t – en – t – en."
},

g6: {
what: "الأفعال الشاذة تغيّر جذرها مع du و er/es/sie، وأهمها إطلاقًا: sein (يكون) و haben (يمتلك) — يُحفظان كاملين لأنهما أساس كل شيء.",
why: "sein و haben هما أكثر فعلين في اللغة، ويُستخدمان في كل جملة تقريبًا وفي تكوين الأزمنة لاحقًا.",
when: ["sein للتعريف والحالة: Ich bin müde (أنا متعب).", "haben للملكية: Ich habe ein Auto.", "أفعال شاذة شائعة في A1: sprechen (sprichst/spricht)، sehen (siehst/sieht)، essen (isst)، fahren (fährst/fährt)."],
how: ["sein: ich bin – du bist – er ist – wir sind – ihr seid – sie sind.", "haben: ich habe – du hast – er hat – wir haben – ihr habt – sie haben.", "القاعدة العامة للشواذ: التغيير فقط مع du و er/es/sie، وباقي الضمائر مثل المنتظم."],
examples: [["Ich bin Lehrer.", "أنا معلم."], ["Du hast ein Buch.", "لديك كتاب."], ["Er spricht Deutsch.", "هو يتحدث الألمانية."]],
daily: [["Bist du müde?", "هل أنت متعب؟"], ["Wir haben Zeit.", "لدينا وقت."], ["Sie ist krank.", "هي مريضة."]],
notes: ["sein لا يُترجم دائمًا «يكون» حرفيًا: Ich bin 20 Jahre alt = عمري 20 سنة.", "haben + Akkusativ دائمًا: Ich habe einen Hund (وليس ein Hund)."],
mistakes: [{w: "Ich bist Lehrer.", r: "Ich bin Lehrer.", why: "bist خاصة بـ du فقط."}, {w: "Er hab ein Auto.", r: "Er hat ein Auto.", why: "haben شاذ: er تأخذ hat وليست habt."}],
compare: "sein للوصف (Ich bin gut) ← haben للملكية (Ich habe Zeit). لا تخلطهما.",
summary: "احفظ sein و haben غيبًا — هما مفتاح A1 كله."
},

g7: {
what: "الألمانية تفرّق بين التحية الرسمية (للغرباء والعمل) وغير الرسمية (للأصدقاء والعائلة).",
why: "استخدام Hallo مع مديرك أو Guten Tag مع صديقك المقرب يعطي انطباعًا خاطئًا — القاعدة اجتماعية بقدر ما هي لغوية.",
when: ["رسمي: Guten Morgen (صباح الخير)، Guten Tag (نهارك سعيد)، Guten Abend (مساء الخير)، Auf Wiedersehen (مع السلامة).", "غير رسمي: Morgen!، Tag!، Hallo!، Tschüs! (سلام)، Ciao!."],
how: ["في المتجر أو الإدارة أو مع شخص أكبر: استخدم الصيغة الكاملة + Sie.", "مع الأصدقاء: الصيغة المختصرة + du."],
examples: [["Guten Morgen, Herr Schmidt!", "صباح الخير سيد شميدت!"], ["Hallo, wie geht's?", "أهلًا، كيف حالك؟"], ["Tschüs, bis morgen!", "سلام، أراك غدًا!"]],
daily: [["Guten Tag, was möchten Sie?", "نهارك سعيد، ماذا تريد؟ (في محل)"], ["Hallo Mama, ich bin da!", "أهلًا ماما، وصلت!"]],
notes: ["Wie geht es Ihnen؟ رسمي ← Wie geht's؟ غير رسمي.", "في جنوب ألمانيا والنمسا ستسمع Grüß Gott و Servus — افهمها ولا حاجة لاستخدامها في A1."],
mistakes: [{w: "Hallo Herr Direktor, … (في إيميل رسمي)", r: "Guten Tag, Herr Direktor, …", why: "السياق الرسمي يحتاج الصيغة الكاملة."}, {w: "Auf Wiedersehen يا صاحبي", r: "Tschüs!", why: "مع الأصدقاء المختصرة طبيعية أكثر."}],
compare: "رسمي = كامل + Sie ← غير رسمي = مختصر + du.",
summary: "غريب/رسمي ← Guten… + Sie. صديق ← Hallo/Tschüs + du."
},

g8: {
what: "ثلاثة أسئلة تحفظك في أي تعارف: الاسم (Wie heißen Sie؟)، الموطن (Woher kommen Sie؟)، اللغة (Welche Sprachen sprechen Sie؟ / Was sprechen Sie؟).",
why: "أول محادثة في حياتك بالألمانية ستكون هذه الأسئلة — وهي ثابتة في امتحان A1 الشفهي.",
when: ["الاسم: Wie heißt du؟ (غير رسمي) / Wie heißen Sie؟ (رسمي).", "الموطن: Woher kommst du؟ — الجواب دائمًا مع aus: Ich komme aus Ägypten.", "اللغة: Was sprichst du؟ / Welche Sprache sprichst du؟ — الجواب: Ich spreche Deutsch und Arabisch."],
how: ["الجواب النموذجي الكامل: Ich heiße Ahmed. Ich komme aus Ägypten. Ich spreche Arabisch und Deutsch.", "انتبه: aus + اسم البلد بدون أداة في الغالب: aus Deutschland، aus Spanien."],
examples: [["Wie heißen Sie?", "ما اسم حضرتك؟"], ["Ich komme aus Marokko.", "أنا من المغرب."], ["Ich spreche Deutsch.", "أنا أتحدث الألمانية."]],
daily: [["Woher kommst du?", "من أين أنت؟"], ["Sprichst du Englisch?", "هل تتحدث الإنجليزية?"]],
notes: ["heißen فعل شاذ: du heißt (بـ ß واحدة) — وليست heißst.", "kommen + aus دائمًا للموطن، و wohnen + in للسكن: Ich wohne in Berlin."],
mistakes: [{w: "Ich komme aus Ägypten aus.", r: "Ich komme aus Ägypten.", why: "aus مرة واحدة قبل البلد فقط."}, {w: "Was heißt du?", r: "Wie heißt du?", why: "السؤال عن الاسم بـ Wie وليس Was."}],
compare: "Woher (من أين — الأصل) ← Wo (أين — المكان الحالي): Woher kommst du؟ مقابل Wo wohnst du؟",
summary: "Wie heißt…؟ + Woher…؟ + aus + Was sprichst…؟ = تعارف كامل."
},

g9: {
what: "كلمة das لها وظيفتان: (1) أداة الاسم المحايد: das Buch. (2) اسم إشارة بمعنى هذا/هذه/هؤلاء: Das ist Ali. Das sind Frauen.",
why: "المبتدئ يراها نفس الكلمة فيظنها خطأ — فهم الفرق يفتح لك نوعًا كاملًا من الجمل (الإشارة والتعريف).",
when: ["كأداة: قبل اسم محايد مفرد: das Kind، das Haus.", "كإشارة للمفرد: Das ist mein Bruder (هذا أخي).", "كإشارة للجمع: Das sind meine Freunde (هؤلاء أصدقائي) — الفعل sind يكشف الجمع."],
how: ["إذا بعدها فعل مفرد (ist) + اسم مفرد ← غالبًا إشارة لمفرد.", "إذا بعدها sind + جمع ← إشارة لجمع بمعنى هؤلاء."],
examples: [["Das ist Ali.", "هذا علي."], ["Das ist ein Buch.", "هذا كتاب."], ["Das sind Frauen.", "هؤلاء نساء."]],
daily: [["Was ist das?", "ما هذا؟"], ["Das ist meine Tasche.", "هذه حقيبتي."], ["Sind das deine Schlüssel?", "هل هذه مفاتيحك؟"]],
notes: ["das الإشارة لا تتغير مع الجنس في A1: Das ist der Lehrer / Das ist die Lehrerin — كلاهما صحيح.", "لا تخلط: dass (بـ s مزدوجة) معناها «أنّ» وهي مستوى أعلى — تجاهلها الآن."],
mistakes: [{w: "Das sind ein Mann.", r: "Das ist ein Mann.", why: "sind للجمع، و ein Mann مفرد ← الفعل ist."}, {w: "Dass ist Ali.", r: "Das ist Ali.", why: "الإشارة بـ s واحدة فقط."}],
compare: "das الأداة (قبل اسم واحد محايد) ← das الإشارة (في أول الجملة قبل الفعل).",
summary: "das Buch = أداة. Das ist… = هذا. Das sind… = هؤلاء."
},

g10: {
what: "أدوات الاستفهام التي تبدأ غالبًا بـ W: Was (ماذا)، Wer (من)، Wo (أين)، Woher (من أين)، Wohin (إلى أين)، Wie (كيف)، Wann (متى)، Warum (لماذا)، Wie viel (كم سعر/كمية)، Woher/Wohin للاتجاه.",
why: "نصف محادثات A1 أسئلة. إتقانها يعني أنك تفهم السؤال وتجيب حتى لو لم تفهم كل الكلمات.",
when: ["Was: عن الأشياء. Wer: عن الأشخاص (فاعل). Wo: عن المكان. Wann: عن الزمن. Wie: عن الكيفية والحال. Woher: عن الأصل."],
how: ["القاعدة الذهبية: أداة الاستفهام أولًا ← الفعل المُصرّف ثانيًا ← الفاعل ثالثًا: Wo wohnst du؟", "الجواب بدون أداة الاستفهام: Ich wohne in Kairo."],
examples: [["Wo wohnst du?", "أين تسكن؟"], ["Wer ist das?", "من هذا؟"], ["Was machst du?", "ماذا تفعل؟"]],
daily: [["Wann kommst du?", "متى تأتي؟"], ["Wie geht's?", "كيف حالك؟"], ["Woher kommst du?", "من أين أنت؟"]],
notes: ["Wie viel + اسم للكمية والسعر: Wie viel kostet das؟", "Warum (لماذا) جوابها بـ weil — لكن weil مستوى A2، في A1 يكفي فهم السؤال."],
mistakes: [{w: "Wo du wohnst?", r: "Wo wohnst du?", why: "في السؤال الفعل ثانيًا قبل الفاعل."}, {w: "Was bist du?", r: "Wer bist du?", why: "للشخص العاقل نستخدم Wer وليس Was."}],
compare: "Wo (أين الآن) ← Woher (من أين أتيت) ← Wohin (إلى أين تذهب): ثلاثة اتجاهات مختلفة.",
summary: "W أولًا + فعل ثانيًا + فاعل. احفظ معاني الـ W."
},

g11: {
what: "معظم أسماء البلاد بدون أداة: Deutschland، Ägypten، Spanien. لكن بعضها مؤنث مع die: die Schweiz، die Türkei، die Ukraine، die USA (جمع).",
why: "الخطأ هنا شائع لأن العربية تقول «ألمانيا» بدون أداة بينما الألمانية تقول die Türkei بأداة — القاعدة تُحفظ كقائمة صغيرة.",
when: ["بدون أداة: Ich komme aus Deutschland.", "مع die: Ich komme aus der Türkei. (aus + die تصبح der في Dativ — التفصيل في شرح Dativ).", "السؤال الدائم: Woher kommen Sie؟"],
how: ["احفظ القائمة المؤنثة: die Schweiz، die Türkei، die Ukraine. والباقي في A1 بدون أداة.", "مع aus: بلد بدون أداة ← aus + اسم مباشرة. بلد مؤنث ← aus der + اسم."],
examples: [["Ich komme aus Spanien.", "أنا من إسبانيا."], ["Ich komme aus der Türkei.", "أنا من تركيا."], ["Er kommt aus Japan.", "هو من اليابان."]],
daily: [["Kommst du aus Italien?", "هل أنت من إيطاليا؟"], ["Sie kommt aus der Schweiz.", "هي من سويسرا."]],
notes: ["die USA جمع لذلك: aus den USA.", "المدن كلها بدون أداة: aus Berlin، aus Kairo."],
mistakes: [{w: "Ich komme aus die Türkei.", r: "Ich komme aus der Türkei.", why: "aus تأخذ Dativ فتتحول die إلى der."}, {w: "Ich komme aus der Deutschland.", r: "Ich komme aus Deutschland.", why: "Deutschland بدون أداة أصلًا."}],
compare: "بلد عادي (بدون أداة) ← بلد مؤنث (die ثم der بعد aus).",
summary: "الكل aus + بلد. فقط Schweiz/Türkei/Ukraine مؤنثة."
},

g12: {
what: "أيام الأسبوع كلها مذكرة (der) وتُستخدم مع حرف الجر am عند الحديث عن حدوث شيء في يوم معين.",
why: "لا يمكنك عمل موعد أو الحديث عن روتينك بدونها — وهي ثابتة في امتحان A1.",
when: ["الأيام: Montag Dienstag Mittwoch Donnerstag Freitag Samstag/Sonnabend Sonntag.", "الحدث في يوم: am Montag (يوم الاثنين).", "اليوم نفسه: Heute ist Montag."],
how: ["am + يوم = في هذا اليوم: Am Freitag habe ich Zeit.", "بدون am عند ذكر اليوم كمعلومة: Heute ist Sonntag."],
examples: [["Am Montag lerne ich.", "أتعلم يوم الاثنين."], ["Heute ist Freitag.", "اليوم الجمعة."], ["Bis morgen!", "إلى الغد!"]],
daily: [["Wann hast du Zeit? – Am Samstag.", "متى لديك وقت؟ – يوم السبت."], ["Am Sonntag schlafe ich lange.", "يوم الأحد أنام طويلًا."]],
notes: ["Samstag = Sonnabend (نفس اليوم، الاسم الثاني شائع في الشمال).", "الجمع: أيام الأسبوع تجمع بـ -e: die Montage (نادر في A1 — يكفي المفرد)."],
mistakes: [{w: "Im Montag", r: "Am Montag", why: "الأيام تأخذ am وليست im."}, {w: "Am Montag ist Montag.", r: "Heute ist Montag.", why: "عند الإخبار عن اليوم نفسه لا نحتاج am."}],
compare: "am للأيام (am Montag) ← im للشهور والفصول (im Mai). التفصيل في شرح im/am.",
summary: "الأيام مذكرة + am. Heute ist + يوم بدون حرف."
},

g13: {
what: "المعرفة (der/die/das) لشيء معروف أو مذكور قبلًا، والنكرة (ein مذكر/محايد + eine مؤنث) لشيء جديد غير معروف. والجمع النكرة بدون أداة إطلاقًا.",
why: "الفرق بين «الطاولة» و«طاولة ما» يغيّر المعنى تمامًا، والألمان يميزونه بدقة.",
when: ["أول ذكر (جديد): Das ist ein Tisch. (هذه طاولة ما).", "بعد أن عرفناه: Der Tisch ist groß. (الطاولة كبيرة).", "جمع نكرة: Das sind Tische. (هذه طاولات — بدون أداة)."],
how: ["ein + مذكر/محايد: ein Tisch، ein Buch.", "eine + مؤنث: eine Lampe.", "جمع نكرة = الاسم جمعًا بدون شيء قبله: keine أداة، kein ein."],
examples: [["Das ist ein Hafen.", "هذا ميناء (غير معروف)."], ["Der Hafen ist schön.", "الميناء جميل (معروف)."], ["Das sind Äpfel.", "هذا تفاح (جمع نكرة)."]],
daily: [["Ich habe ein Auto.", "لدي سيارة."], ["Hast du eine Tasche?", "هل لديك حقيبة؟"], ["Das sind meine Freunde.", "هؤلاء أصدقائي."]],
notes: ["ein للمذكر تتغير في Akkusativ إلى einen: Ich habe einen Tisch. (التفصيل في شرح Akkusativ).", "النفي يقابلها: ein ← kein، و eine ← keine."],
mistakes: [{w: "Das ist einen Tisch.", r: "Das ist ein Tisch.", why: "بعد ist (من أفعال Nominativ) لا يتغير شيء — ein تبقى ein."}, {w: "Das sind ein Tische.", r: "Das sind Tische.", why: "الجمع النكرة بدون أداة نهائيًا."}],
compare: "der = الـ (معروف) ← ein = واحد ما (جديد). keine = نفي ein.",
summary: "جديد ← ein/eine. معروف ← der/die/das. جمع جديد ← بدون أداة."
},

g14: {
what: "ننفي الاسم النكرة بـ kein (مذكر/محايد) و keine (مؤنث/جمع): Ich habe kein Auto. Ich habe keine Tasche. Ich habe keine Kinder.",
why: "أشهر خطأ للمبتدئ هو استخدام nicht مكان kein — الألمان يفرقون بين نفي الاسم ونفي الفعل بدقة.",
when: ["مع اسم نكرة مفرد مذكر/محايد: kein.", "مع اسم نكرة مفرد مؤنث: keine.", "مع أي جمع: keine دائمًا."],
how: ["kein تتصرف مثل ein تمامًا: kein Tisch، keinen Tisch (في Akkusativ)، keine Tasche، keine Kinder.", "الخلاصة: احفظها كمرآة لـ ein/eine."],
examples: [["Ich habe kein Auto.", "ليس لدي سيارة."], ["Ich habe keine Tasche.", "ليس لدي حقيبة."], ["Ich habe keine Kinder.", "ليس لدي أطفال."]],
daily: [["Hast du Zeit? – Ich habe keine Zeit.", "هل لديك وقت؟ – ليس لدي وقت."], ["Kein Problem!", "لا مشكلة!"]],
notes: ["kein تنفي الاسم فقط. نفي الفعل والصفة بالتفصيل في شرح nicht/kein.", "في Akkusativ: kein للمذكر تصبح keinen: Ich habe keinen Hund."],
mistakes: [{w: "Ich habe kein Tasche.", r: "Ich habe keine Tasche.", why: "Tasche مؤنثة ← keine."}, {w: "Ich habe keine Auto.", r: "Ich habe kein Auto.", why: "Auto محايد ← kein."}],
compare: "kein/keine للاسم النكرة ← nicht للفعل والصفة والمعرف. التفصيل في الدرس التالي.",
summary: "مذكر/محايد مفرد ← kein. مؤنث أو أي جمع ← keine."
},

g15: {
what: "صيغة الأمر الرسمية مع Sie: نضع الفعل بالمصدر أولًا ثم Sie ثم علامة تعجب: Fragen Sie! Gehen Sie! Sprechen Sie!",
why: "في التعامل الرسمي (الإدارة، الطبيب، المتجر) الأمر المباشر بدون Sie يعتبر وقحًا — هذه الصيغة تحميك.",
when: ["إرشادات رسمية: Kommen Sie bitte! (تفضل!).", "لافتات وتعليمات: Drücken Sie! (اضغط!).", "مع الغرباء ومن هم أكبر سنًا أو مقامًا."],
how: ["خطوة واحدة: المصدر + Sie + ! — بدون أي تغيير في الفعل.", "للتهذيب أضف bitte: Fragen Sie bitte!"],
examples: [["Fragen Sie!", "اسأل! (رسمي)"], ["Gehen Sie links!", "اذهب يسارًا! (رسمي)"], ["Nehmen Sie Platz!", "تفضل بالجلوس!"]],
daily: [["Drücken Sie die Taste!", "اضغط الزر!"], ["Warten Sie bitte!", "انتظر من فضلك!"]],
notes: ["الأمر مع du مختلف تمامًا (Frag! / Geh!) وهو مستوى A2 غالبًا — في A1 ركّز على صيغة Sie.", "الفعل المنفصل تبقى قطعته في الآخر: Stehen Sie auf! (قف!)."],
mistakes: [{w: "Sie fragen!", r: "Fragen Sie!", why: "في الأمر الفعل أولًا ثم الفاعل."}, {w: "Frage Sie!", r: "Fragen Sie!", why: "مع Sie نستخدم المصدر الكامل، وليس جذر du. "}],
compare: "Fragen Sie! (رسمي لشخص غريب) ← Frag! (غير رسمي لصديق — للمستقبل).",
summary: "رسمي = مصدر + Sie + !"
},

g16: {
what: "القاعدة الذهبية: الفعل المُصرّف في المرتبة الثانية دائمًا في الجملة الخبرية الألمانية — مهما بدأت الجملة.",
why: "من يطبقها يتحدث ألمانية صحيحة فورًا، ومن يخالفها تُفهم جملته لكنها خاطئة بوضوح.",
when: ["الترتيب العادي: Ich (1) lerne (2) Deutsch.", "عند البدء بالزمن: Heute (1) lerne (2) ich Deutsch.", "السؤال: الفعل أولًا: Lernst du Deutsch؟"],
how: ["حدد الفعل المُصرّف ← ضعه ثاني عنصر (وليس ثاني كلمة بالضرورة).", "باقي الجملة بحرية نسبية في A1: الفاعل ثم المفعول ثم الزمن/المكان."],
examples: [["Ich lerne heute.", "أنا أتعلم اليوم."], ["Heute lerne ich.", "اليوم أتعلم أنا."], ["Er wohnt in Berlin.", "هو يسكن في برلين."]],
daily: [["Morgen komme ich.", "غدًا آتي."], ["Ich trinke gern Kaffee.", "أشرب القهوة بسرور."]],
notes: ["إذا بدأت بظرف (Heute/Morgen) يجب قلب الفاعل بعد الفعل: Heute lerne ich (وليس Heute ich lerne).", "الأفعال المساعدة أيضًا ثانية: Ich kann Deutsch sprechen."],
mistakes: [{w: "Heute ich lerne Deutsch.", r: "Heute lerne ich Deutsch.", why: "الفعل يجب أن يكون الثاني — اقلب الفاعل بعده."}, {w: "Ich heute lerne.", r: "Ich lerne heute.", why: "الفعل ثانيًا قبل الظرف في الترتيب العادي."}],
compare: "العربية حرة (أتعلم اليوم/اليوم أتعلم) ← الألمانية حرة أيضًا لكن الفعل ثابت في المرتبة الثانية.",
summary: "اعثر على الفعل المُصرّف وضعه ثانيًا دائمًا."
},

g17: {
what: "حروف الزمن: im للشهور والفصول (im Mai، im Sommer)، و am للأيام وأوقات اليوم (am Montag، am Morgen)، والليل استثناء: in der Nacht.",
why: "الخلط بينهما من أشهر أخطاء A1 لأن العربية تقول «في» للكل — الألمانية تفرّق.",
when: ["im + شهر/فصل: im Januar، im Frühling.", "am + يوم/تاريخ/وقت من اليوم: am Freitag، am Morgen، am Abend.", "in der Nacht (في الليل) تُحفظ كما هي."],
how: ["im = in + dem (للمذكر/المحايد Dativ).", "am = an + dem.", "اسأل: هل هو شهر/فصل؟ ← im. هل هو يوم/صباح/مساء؟ ← am."],
examples: [["Im Sommer ist es heiß.", "في الصيف الجو حار."], ["Am Freitag habe ich Zeit.", "يوم الجمعة لدي وقت."], ["In der Nacht schlafe ich.", "في الليل أنام."]],
daily: [["Im Mai komme ich.", "في مايو آتي."], ["Am Morgen trinke ich Kaffee.", "في الصباح أشرب قهوة."]],
notes: ["السنوات بدون حرف في A1: 2024 = zweitausendvierundzwanzig (يكفي فهمها).", "am Wochenende (في نهاية الأسبوع) تُحفظ كاملة."],
mistakes: [{w: "Im Montag", r: "Am Montag", why: "اليوم يأخذ am."}, {w: "Am Sommer", r: "Im Sommer", why: "الفصل يأخذ im."}],
compare: "im للكبير (شهر/فصل) ← am للصغير (يوم/صباح). والليل وحده in der Nacht.",
summary: "شهر/فصل ← im. يوم/صباح/مساء ← am. ليل ← in der Nacht."
},

g18: {
what: "nicht تنفي الفعل والصفة والاسم المعرف. kein/keine تنفي الاسم النكرة فقط. هذا هو كل الفرق.",
why: "بعد هذا الدرس لن تخطئ أبدًا بين «ليس لدي سيارة» (kein) و«أنا لا أقود» (nicht).",
when: ["nicht + فعل: Ich schlafe nicht. (أنا لا أنام).", "nicht + صفة: Der Kaffee ist nicht heiß.", "nicht + اسم معرف: Das ist nicht mein Buch.", "kein + اسم نكرة: Ich habe kein Buch."],
how: ["هل بعد النفي اسم نكرة؟ ← kein/keine.", "غير ذلك (فعل/صفة/معرف)؟ ← nicht.", "مكان nicht: بعد الفعل المُصرّف غالبًا، وقبل الصفة/المعرف المنفي."],
examples: [["Ich studiere nicht.", "أنا لا أدرس."], ["Hast du kein Auto?", "أليس لديك سيارة؟"], ["Das ist nicht gut.", "هذا ليس جيدًا."]],
daily: [["Ich komme heute nicht.", "لن آتي اليوم."], ["Kein Problem!", "لا مشكلة!"]],
notes: ["لا يجتمع kein + nicht معًا في A1 إطلاقًا.", "الجواب بالنفي: Nein، ثم الجملة المنفية كاملة."],
mistakes: [{w: "Ich habe nicht Auto.", r: "Ich habe kein Auto.", why: "Auto اسم نكرة ← kein."}, {w: "Ich kein liebe dich.", r: "Ich liebe dich nicht.", why: "الفعل يُنفى بـ nicht بعده وليس kein قبله."}],
compare: "kein = لا + اسم نكرة (لا سيارة) ← nicht = لا + فعل/صفة (لا أنام/ليس ساخنًا).",
summary: "اسم نكرة ← kein. أي شيء آخر ← nicht."
},

g19: {
what: "السؤال عن العمر ثابت: Wie alt bist du؟ (غير رسمي) / Wie alt sind Sie؟ (رسمي). والجواب: Ich bin … Jahre alt.",
why: "جملة محفوظة كاملة تُستخدم في كل تعارف وفي الامتحان الشفهي.",
when: ["السؤال لأي شخص في سياق ودود.", "الجواب بالرقم + Jahre alt."],
how: ["Wie alt + فعل sein حسب الضمير + الضمير؟", "الجواب: Ich bin 20 Jahre alt."],
examples: [["Wie alt bist du?", "كم عمرك؟"], ["Ich bin 15 Jahre alt.", "عمري 15 سنة."], ["Wie alt ist er?", "كم عمره؟"]],
daily: [["Bist du 18?", "هل عمرك 18؟"], ["Mein Sohn ist 5 Jahre alt.", "ابني عمره 5 سنوات."]],
notes: ["alt تعني «كبير/قديم» لكن في السؤال عن العمر معناها «كم عمرك» حصرًا.", "Jahre جمع Jahr (سنة) — لا تقل Jahr alt بالمفرد مع رقم."],
mistakes: [{w: "Wie viel Jahre bist du?", r: "Wie alt bist du?", why: "السؤال عن العمر محفوظ بـ Wie alt وليس Wie viel."}, {w: "Ich bin 20 Jahre.", r: "Ich bin 20 Jahre alt.", why: "الصيغة الكاملة تتضمن alt في النهاية."}],
compare: "Wie alt (العمر) ← Wie heißt (الاسم) ← Woher (الموطن): ثلاثة أسئلة التعارف.",
summary: "Wie alt bist du؟ ← Ich bin … Jahre alt."
},

g20: {
what: "Akkusativ (حالة المفعول) تعني أن المفعول به يتغير شكله. والخبر السار: التغيير فقط في المذكر المفرد: der→den، ein→einen، kein→keinen، mein→meinen. المؤنث والمحايد والجمع لا يتغير شيء.",
why: "بدونها ستقول Ich habe ein Hund (خطأ) بدل Ich habe einen Hund (صح). وهي بوابة فهم الجمل الطويلة.",
when: ["بعد أفعال تأخذ مفعولًا: haben، essen، trinken، sehen، lieben، kaufen، besuchen.", "بعد حروف معينة في A1: für (من أجل) — التفصيل لاحقًا.", "السؤال عن المفعول: Wen؟ (من؟) و Was؟ (ماذا؟)."],
how: ["حدد الفاعل والفعل والمفعول: Ich (فاعل) esse (فعل) einen Apfel (مفعول).", "إذا المفعول مذكر مفرد ← غيّر أداته. غير ذلك ← اتركه كما هو."],
examples: [["Ich esse einen Apfel.", "آكل تفاحة."], ["Ich sehe den Mann.", "أرى الرجل."], ["Ich liebe die Frau.", "أحب المرأة. (لا تغيير)"]],
daily: [["Hast du einen Stift?", "هل لديك قلم؟"], ["Ich kaufe das Brot.", "أشتري الخبز. (لا تغيير للمحايد)"], ["Sie besucht ihren Vater.", "هي تزور والدها."]],
notes: ["الضمائر أيضًا تتغير (التفصيل في شرح ضمائر Akkusativ).", "الأسماء نفسها لا تتغير، فقط الأداة قبلها (ما عدا المفرد المذكر الضعيف وهو خارج A1)."],
mistakes: [{w: "Ich habe ein Apfel.", r: "Ich habe einen Apfel.", why: "Apfel مذكر مفعول ← einen."}, {w: "Ich sehe die Mann.", r: "Ich sehe den Mann.", why: "Mann مذكر مفعول ← den."}],
compare: "Nominativ (الفاعل: der/ein) ← Akkusativ (المفعول: den/einen) — الفرق فقط في المذكر.",
summary: "مذكر مفعول فقط يتغير: der→den و ein→einen."
},

g21: {
what: "أفعال sein (يكون) و werden (يصبح) و bleiben (يبقى) لا تأخذ مفعولًا — ما بعدها يبقى في حالة Nominativ (بدون أي تغيير).",
why: "المبتدئ بعد تعلم Akkusativ يتحمس ويغيّر كل شيء — هذه الأفعال الثلاثة هي الاستثناء الذي يجب حفظه.",
when: ["Ich bin der Lehrer. (أنا المعلم).", "Er wird Arzt. (سيصبح طبيبًا).", "Sie bleibt meine Freundin. (ستبقى صديقتي)."],
how: ["بعد هذه الأفعال الثلاثة: اترك الأداة كما هي (der تبقى der، ein يبقى ein)."],
examples: [["Ich bin der Lehrer.", "أنا المعلم."], ["Er wird mein Mann.", "سيصبح زوجي."], ["Das bleibt mein Problem.", "سيبقى هذا مشكلتي."]],
daily: [["Bist du der Chef?", "هل أنت المدير؟"], ["Ich werde müde.", "أشعر بالتعب (أصبح متعبًا)."]],
notes: ["werden هنا بمعنى «يصبح» وليست للمستقبل في A1.", "هذا ينطبق أيضًا على heißen و scheinen لكنها خارج A1 — يكفي الثلاثة."],
mistakes: [{w: "Ich bin den Lehrer.", r: "Ich bin der Lehrer.", why: "بعد sein لا يوجد مفعول — تبقى der."}, {w: "Er wird einen Arzt.", r: "Er wird Arzt.", why: "بعد werden تبقى Nominativ وبدون تغيير (والمهن غالبًا بدون أداة)."}],
compare: "haben/essen/sehen + مفعول (Akkusativ) ← sein/werden/bleiben + وصف (Nominativ).",
summary: "sein و werden و bleiben ← ما بعدهم Nominativ دائمًا."
},

g22: {
what: "ضمائر المفعول (Akkusativ) تتغير عن ضمائر الفاعل: mich (ني)، dich (ك)، ihn/ihn (ه)، es (ه للمحايد)، sie (ها)، uns (نا)، euch (كم)، sie/Sie (هم/حضرتك).",
why: "لا يمكنك قول «أحبك» أو «أراك» بدونها — وهي في كل محادثة.",
when: ["بعد فعل + شخص كمفعول: Ich liebe dich. Er besucht mich.", "الجواب عن Wen؟: Wen liebst du؟ – Dich!"],
how: ["احفظ الأزواج: ich→mich، du→dich، er→ihn، wir→uns، ihr→euch.", "es و sie و sie/Sie لا تتغير في Akkusativ — سهلة."],
examples: [["Ich liebe dich.", "أنا أحبك."], ["Er besucht mich.", "هو يزورني."], ["Sie sieht ihn.", "هي تراه."]],
daily: [["Hörst du mich?", "هل تسمعني؟"], ["Ich verstehe dich nicht.", "لا أفهمك."], ["Ruf mich an!", "اتصل بي!"]],
notes: ["الفعل helfen يأخذ Dativ وليس Akkusativ (Ich helfe dir) — استثناء يُحفظ وحده.", "ترتيب الضمائر في الجملة مستوى A2 — في A1 يكفي استخدام ضمير واحد صحيح."],
mistakes: [{w: "Ich liebe du.", r: "Ich liebe dich.", why: "بعد الفعل (مفعول) نستخدم dich وليس du."}, {w: "Er sieht ich.", r: "Er sieht mich.", why: "المفعول من ich هو mich."}],
compare: "ich/du (فاعل قبل الفعل) ← mich/dich (مفعول بعد الفعل).",
summary: "mich dich ihn uns euch — واحفظ أن es/sie ثابتة."
},

g23: {
what: "أدوات السؤال عن الأشخاص والأشياء: wer (من — للفاعل)، wen (من — للمفعول)، was (ماذا — لغير العاقل).",
why: "الفرق بين wer و wen هو الفرق بين «من فعل؟» و«بمن فُعل؟» — أساس فهم الأسئلة في A1.",
when: ["Wer + فعل (فاعل): Wer kommt؟ (من يأتي؟).", "Wen + فعل (مفعول عاقل): Wen liebst du؟ (من تحب؟).", "Was + فعل (غير عاقل): Was isst du؟ (ماذا تأكل؟)."],
how: ["شخص يفعل ← Wer.", "شخص يُفعل به ← Wen.", "شيء ← Was."],
examples: [["Wer ist das?", "من هذا؟"], ["Wen besuchst du?", "من تزور؟"], ["Was trinkst du?", "ماذا تشرب؟"]],
daily: [["Wer ruft an?", "من يتصل؟"], ["Wen fragst du?", "من تسأل؟"], ["Was kostet das?", "كم سعر هذا؟"]],
notes: ["wen هي نفس wer لكن في حالة Akkusativ — أول لقاء لك بفكرة تصريف أدوات الاستفهام.", "الجواب عن Wer يكون بالفاعل (Nominativ)، وعن Wen بالمفعول (Akkusativ)."],
mistakes: [{w: "Wen kommt?", r: "Wer kommt?", why: "الفاعل يُسأل عنه بـ Wer."}, {w: "Wer liebst du?", r: "Wen liebst du?", why: "المفعول العاقل يُسأل عنه بـ Wen."}],
compare: "Wer (من فعل) ← Wen (بمن فُعل) ← Was (ماذا — لغير العاقل).",
summary: "فاعل عاقل Wer. مفعول عاقل Wen. شيء Was."
},

g24: {
what: "جمل المحل والمطعم المحفوظة: السؤال عن السعر (Was kostet das؟)، وطلب شيء إضافي (Sonst noch etwas؟)، والردود المهذبة.",
why: "أول موقف حقيقي ستعيشه في ألمانيا هو الشراء — هذه الجمل تكفيك تمامًا في A1.",
when: ["السعر: Was kostet das؟ / Was kosten die Äpfel؟ (للمفرد kosten مفرد، وللجمع kosten جمع).", "في المطعم: Ich möchte … (أريد … بأدب). Zahlen, bitte! (الحساب من فضلك!).", "البائع: Sonst noch etwas؟ (شيء آخر؟)."],
how: ["kosten تتصرف عادي: das kostet (مفرد) / die kosten (جمع).", "للطلب المهذب استخدم Ich möchte + Akkusativ: Ich möchte einen Kaffee."],
examples: [["Was kostet das?", "كم سعر هذا؟"], ["Sonst noch etwas?", "شيء آخر؟"], ["Zahlen, bitte!", "الحساب من فضلك!"]],
daily: [["Ich möchte zwei Brötchen.", "أريد خبزتين صغيرتين."], ["Das kostet 5 Euro.", "سعر هذا 5 يورو."], ["Guten Appetit!", "بالهناء والشفاء!"]],
notes: ["möchte صيغة مهذبة من mögen — تُحفظ كاملة في A1: ich möchte، wir möchten.", "Euro لا تجمع في الألمانية: 5 Euro (وليس Euros)."],
mistakes: [{w: "Was kostet die Äpfel?", r: "Was kosten die Äpfel?", why: "الجمع يأخذ kosten بالجمع."}, {w: "Ich will einen Kaffee. (بصوت عالٍ)", r: "Ich möchte einen Kaffee.", why: "will حادة — möchte مهذبة ومناسبة للطلب."}],
compare: "Was kostet (سؤال عن سعر) ← Wie viel kostet (سؤال عن سعر مع توقع رقم) — نفس المعنى تقريبًا في A1.",
summary: "Was kostet…؟ + Ich möchte… + Zahlen bitte = تسوق كامل."
},

g25: {
what: "الأفعال المساعدة (Modalverben): können (يستطيع)، müssen (يجب)، wollen (يريد)، möchten (يود بأدب). الفعل المساعد مُصرّف في المرتبة الثانية، والفعل الأساسي بالمصدر في آخر الجملة.",
why: "بدونها لا تستطيع التعبير عن القدرة والرغبة والضرورة — وهي قلب جمل A1 الطويلة.",
when: ["القدرة: Ich kann Deutsch sprechen.", "الضرورة: Ich muss lernen.", "الرغبة: Ich will schlafen. / Ich möchte Kaffee."],
how: ["الخطوات: (1) صرّف المساعد حسب الفاعل. (2) ضعه ثانيًا. (3) ضع الأساسي بالمصدر في الآخر.", "تصريف können: ich kann – du kannst – er kann – wir können – ihr könnt – sie können."],
examples: [["Ich kann Deutsch sprechen.", "أستطيع التحدث بالألمانية."], ["Ich muss lernen.", "يجب أن أتعلم."], ["Wir wollen schwimmen.", "نريد السباحة."]],
daily: [["Kannst du mir helfen?", "هل يمكنك مساعدتي؟"], ["Ich muss morgen arbeiten.", "يجب أن أعمل غدًا."], ["Möchtest du Kaffee?", "هل تود قهوة؟"]],
notes: ["müssen قوية (إلزام) — للاقتراح اللطيف استخدم sollten (مستوى A2).", "wollen أقوى من möchten: الأول إرادة، والثاني تمنٍّ مهذب."],
mistakes: [{w: "Ich kann sprechen Deutsch.", r: "Ich kann Deutsch sprechen.", why: "الفعل الأساسي بالمصدر في آخر الجملة دائمًا."}, {w: "Ich können sprechen.", r: "Ich kann sprechen.", why: "المساعد يُصرّف حسب الفاعل: ich kann."}],
compare: "können (أستطيع — قدرة) ← müssen (يجب — إلزام) ← wollen/möchten (أريد — رغبة).",
summary: "مساعد مُصرّف ثانيًا + أساسي مصدر أخيرًا."
},

g26: {
what: "التعبير عن الوقت المحدد: um للساعة تمامًا (um 6 Uhr)، و von…bis للفترة (von 6 bis 9 Uhr). والسؤال: Wann؟ (متى) و Wie lange؟ (كم المدة).",
why: "المواعيد والدوام والدراسة كلها بهذه الصيغ — لا غنى عنها.",
when: ["تمام الساعة: um 6 Uhr، um halb 8.", "الفترة: von Montag bis Freitag، von 9 bis 12 Uhr.", "السؤال: Wann frühstückst du؟ – Um 7 Uhr."],
how: ["um + رقم + Uhr.", "von + بداية + bis + نهاية."],
examples: [["Ich frühstücke um 6 Uhr.", "أفطر السادسة."], ["Von 6 bis 9 Uhr.", "من 6 إلى 9."], ["Wann kommst du?", "متى تأتي؟"]],
daily: [["Der Kurs ist von 9 bis 12 Uhr.", "الكورس من 9 إلى 12."], ["Wie lange lernst du? – Zwei Stunden.", "كم تتعلم؟ – ساعتين."]],
notes: ["Uhr تُذكر مع الرقم دائمًا في الرسمي: um 6 Uhr (وليس um 6 فقط).", "bis وحدها بدون von صحيحة: Bis morgen! (إلى الغد!)."],
mistakes: [{w: "Am 6 Uhr", r: "Um 6 Uhr", why: "الساعة تمامًا تأخذ um."}, {w: "Von 6 bis 9 Uhr bis.", r: "Von 6 bis 9 Uhr.", why: "bis مرة واحدة تكفي."}],
compare: "um (نقطة: في السادسة) ← von..bis (فترة: من..إلى).",
summary: "تمام ← um. فترة ← von..bis. سؤال ← Wann؟"
},

g27: {
what: "ضمائر الملكية: mein (ي)، dein (ك)، sein (ه)، ihr (ها)، unser (نا)، euer (كم)، ihr/Ihr (هم/حضرتك). وتتغير نهايتها مع المذكر المفعول فقط في A1: mein→meinen.",
why: "«أبي وأمي وأخي» من أول كلماتك — وبدون النهايات الصحيحة ستخطئ في أشهر جملة: Ich besuche meinen Vater.",
when: ["ملكية عادية: Mein Name ist Ahmed. Meine Mutter ist nett.", "مع مفعول مذكر: Ich besuche meinen Bruder. (وليس mein Bruder)."],
how: ["القاعدة: نفس تصريف ein تمامًا. المؤنث يضيف e: meine. والمذكر المفعول يضيف en: meinen.", "الجدول المصغر: mein/meine/mein (مفرد) — meine (جمع). وفي Akkusativ: meinen/meine/mein."],
examples: [["Mein Name ist Ahmed.", "اسمي أحمد."], ["Meine Mutter ist nett.", "أمي لطيفة."], ["Wer besucht meinen Bruder?", "من يزور أخي؟"]],
daily: [["Ist das dein Buch?", "هل هذا كتابك؟"], ["Das ist meine Tasche.", "هذه حقيبتي."], ["Unser Lehrer ist gut.", "معلمنا جيد."]],
notes: ["euer تحذف e الثانية أحيانًا: eure Mutter (وليس euere) — تُقبل الصيغتان في A1.", "الملكية لا تأخذ أداة معها: mein der Vater خطأ — قل mein Vater فقط."],
mistakes: [{w: "Ich besuche mein Bruder.", r: "Ich besuche meinen Bruder.", why: "Bruder مذكر مفعول ← meinen."}, {w: "Mein Mutter ist nett.", r: "Meine Mutter ist nett.", why: "Mutter مؤنثة ← Meine."}],
compare: "ein (نكرة لشيء ما) ← mein (ملكية لشيء يخصني) — نفس النهايات تمامًا.",
summary: "احفظ mein/meine ثم أضف n للمذكر المفعول: meinen."
},

g28: {
what: "الساعة بالألمانية لها صيغتان: رسمية (ein Uhr، halb vier) وعامية مختصرة (eins، halb vier). والنصف يُحسب للساعة القادمة: halb vier = الثالثة والنصف (3:30) وليست الرابعة والنصف!",
why: "halb vier أشهر فخ في A1 — من يترجمها حرفيًا («نصف أربعة» = 4:30) يخطئ الموعد بنصف ساعة.",
when: ["الرسمية: Es ist ein Uhr. (الواحدة). Es ist halb vier. (3:30).", "العامية: Es ist eins. (الساعة واحدة).", "الدقائق: vor (إلا) و nach (و): Viertel nach drei (3:15)، Viertel vor vier (3:45)."],
how: ["الساعة الكاملة: Es ist + رقم + Uhr.", "النصف: halb + الساعة القادمة.", "حفظ halb: انظر للساعة التي لم تأتِ بعد."],
examples: [["Es ist ein Uhr.", "الساعة الواحدة."], ["Es ist halb vier.", "الثالثة والنصف (3:30)."], ["Es ist Viertel nach drei.", "الثالثة والربع."]],
daily: [["Wie spät ist es?", "كم الساعة؟"], ["Der Zug kommt um halb acht.", "القطار يأتي 7:30."]],
notes: ["ein Uhr رسمية (للإذاعة والمواعيد) ← eins عامية (بين الأصدقاء).", "vor/nach التفصيل الكامل مستوى A2 — في A1 يكفي halb والتمام."],
mistakes: [{w: "halb vier = 4:30", r: "halb vier = 3:30", why: "الألماني ينظر للنصف القادم: نصف الطريق إلى الرابعة."}, {w: "Es ist eins Uhr.", r: "Es ist ein Uhr. / Es ist eins.", why: "لا تجمع الصيغتين: إما ein Uhr أو eins وحدها."}],
compare: "ein Uhr (رسمي كامل) ← eins (عامي مختصر). نفس الوقت، سياق مختلف.",
summary: "halb + القادمة. halb vier = 3:30."
},

g29: {
what: "الاعتذار والرد عليه: للاعتذار Es tut mir leid (أنا آسف) أو Entschuldigung / Entschuldigen Sie. والرد: Kein Problem / Macht nichts / Schon gut (لا مشكلة).",
why: "ستخطئ حتمًا في المواصلات والمتجر والشارع — هذه الجمل تنقذك اجتماعيًا.",
when: ["خطأ صغير (دعس قدم): Oh, Entschuldigung!", "خطأ أكبر/مشاعر: Es tut mir leid.", "الرد دائمًا مطمئن: Kein Problem!"],
how: ["Entschuldigung وحدها للمواقف الخفيفة والسريعة.", "Es tut mir leid للمواقف الجادة أو عند مخاطبة شخص تعرفه.", "Entschuldigen Sie (رسمي) عند إيقاف غريب لسؤاله."],
examples: [["Es tut mir leid.", "أنا آسف."], ["Entschuldigung!", "عذرًا!"], ["Kein Problem!", "لا مشكلة!"]],
daily: [["Entschuldigen Sie, wo ist der Bahnhof?", "عذرًا، أين محطة القطار؟"], ["Macht nichts!", "لا عليك!"], ["Schon gut!", "حصل خير!"]],
notes: ["Entschuldigung اسم (العذر) ← Entschuldigen Sie فعل أمر (اعذرني) — كلاهما صحيح حسب السياق.", "لا تقل Sorry في الرسمي — احتفظ بها للأصدقاء فقط."],
mistakes: [{w: "Es tut mich leid.", r: "Es tut mir leid.", why: "الفعل tut leid يأخذ Dativ: mir (لي) وليس mich."}, {w: "Kein Probleme!", r: "Kein Problem!", why: "الرد محفوظ بالمفرد: Problem بدون e."}],
compare: "Entschuldigung (سريع/خفيف) ← Es tut mir leid (جاد/عميق).",
summary: "اعتذر بـ Entschuldigung / Es tut mir leid ← ورد بـ Kein Problem."
},

g30: {
what: "حروف الجر mit (مع) و bei (عند) و aus (من) و von (من/لدى) و seit (منذ) تأخذ حالة Dativ دائمًا — أي تغيّر ما بعدها بطريقة ثابتة.",
why: "في A1 يكفي أن تعرف أنها Dativ وتحفظ شكلين فقط: mit mir/dir (معي/معك) — الباقي تفصيله في A2.",
when: ["mit + شخص: Ich komme mit dir. (آتي معك).", "bei + مكان/شخص: Ich bin bei dir. (أنا عندك).", "aus + أصل: Ich komme aus Ägypten."],
how: ["في A1 احفظ الضمائر الجاهزة: mit mir، mit dir، bei mir، von mir.", "القاعدة الكاملة: der→dem، die→der، das→dem في Dativ — للقراءة فقط الآن، والاستخدام الكامل في A2.", "aus der Türkei مثال حي: die تحولت إلى der بسبب Dativ."],
examples: [["Ich komme mit dir.", "آتي معك."], ["Ich bin bei dir.", "أنا عندك."], ["Ich komme aus der Türkei.", "أنا من تركيا."]],
daily: [["Fährst du mit mir?", "هل تأتي معي؟"], ["Ich bin beim Arzt. (bei + dem = beim)", "أنا عند الطبيب."]],
notes: ["لا تحفظ الجدول كاملًا الآن — احفظ الجمل الجاهزة، وافهم أن mit/bei/aus/von/seit = Dativ دائمًا.", "helfen + Dativ أيضًا: Ich helfe dir (أساعدك) — وليست dich."],
mistakes: [{w: "Ich komme mit dich.", r: "Ich komme mit dir.", why: "mit تأخذ Dativ: dir وليست dich."}, {w: "Ich komme aus die Türkei.", r: "Ich komme aus der Türkei.", why: "aus تأخذ Dativ فتحولت die إلى der."}],
compare: "Akkusativ (تغيير المذكر فقط: den) ← Dativ (تغيير أكبر: dem/der — للمستقبل، الآن احفظ الجمل).",
summary: "mit/bei/aus/von/seit ← Dativ. احفظ: mit mir – mit dir."
}

};
