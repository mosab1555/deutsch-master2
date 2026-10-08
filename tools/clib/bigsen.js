/* Deutsch Master — BIG sentence pools (deterministic, curated).
   Subjects (person-tagged), times, places, valency verb pools, stem-change verbs,
   perfect-tense Arabic map, imperatives, names, adverbs, zu-infinitives, Q-pools.
   Pool verbs are verified against vocab (existence + Arabic); irregulars covered
   by BIGSTEMS. Weather impersonals are vocab-only (never pooled with persons).
*/
"use strict";

/* [de, ar, person, lvl] — persons only (+Hund/Katze); Arabic gender-compatible. */
const BIGSUBJ = [
  ["Meine Großeltern", "أجدادي", "siepl", "A1"], ["Meine Geschwister", "إخوتي", "siepl", "A2"],
  ["Mein Onkel", "عمي", "er", "A1"], ["Meine Tante", "عمتي", "sie", "A1"],
  ["Mein Cousin", "ابن عمي", "er", "A2"], ["Meine Cousine", "ابنة عمتي", "sie", "A2"],
  ["Unsere Nachbarn", "جيراننا", "siepl", "A2"], ["Die Familie", "العائلة", "sie", "A1"],
  ["Die Großfamilie", "العائلة الكبيرة", "sie", "A2"], ["Mein Enkel", "حفيدي", "er", "A2"],
  ["Meine Enkelin", "حفيدتي", "sie", "A2"], ["Mein Schwiegersohn", "صهري", "er", "B1"],
  ["Meine Schwiegertochter", "كنتي", "sie", "B1"], ["Die Braut", "العروس", "sie", "A2"],
  ["Der Bräutigam", "العريس", "er", "A2"], ["Das Baby", "الرضيع", "es", "A1"],
  ["Die Zwillinge", "التوأم", "siepl", "A2"],
  ["Der Arzt", "الطبيب", "er", "A1"], ["Der Fahrer", "السائق", "er", "A1"],
  ["Die Verkäuferin", "البائعة", "sie", "A1"], ["Der Polizist", "الشرطي", "er", "A2"],
  ["Die Polizistin", "الشرطية", "sie", "A2"], ["Der Ingenieur", "المهندس", "er", "A2"],
  ["Der Student", "الطالب", "er", "A1"], ["Die Studentin", "الطالبة", "sie", "A1"],
  ["Der Schüler", "التلميذ", "er", "A1"], ["Die Schülerin", "التلميذة", "sie", "A1"],
  ["Die Kellnerin", "النادلة", "sie", "A2"], ["Der Koch", "الطاهي", "er", "A1"],
  ["Die Köchin", "الطاهية", "sie", "A2"], ["Der Bäcker", "الخباز", "er", "A2"],
  ["Die Friseurin", "مصففة الشعر", "sie", "A2"], ["Der Mechaniker", "الميكانيكي", "er", "A2"],
  ["Der Elektriker", "الكهربائي", "er", "A2"], ["Der Kunde", "العميل", "er", "A2"],
  ["Die Kundin", "العميلة", "sie", "A2"], ["Der Gast", "الضيف", "er", "A1"],
  ["Die Gäste", "الضيوف", "siepl", "A2"], ["Der Tourist", "السائح", "er", "A2"],
  ["Die Touristin", "السائحة", "sie", "A2"], ["Die Touristen", "السياح", "siepl", "A2"],
  ["Der Rentner", "المتقاعد", "er", "A2"], ["Die Rentnerin", "المتقاعدة", "sie", "A2"],
  ["Die Lehrerin", "المعلمة", "sie", "A1"], ["Der Hausmeister", "البواب", "er", "A2"],
  ["Die Sekretärin", "السكرتيرة", "sie", "A2"], ["Der Apotheker", "الصيدلي", "er", "A2"],
  ["Die Apothekerin", "الصيدلانية", "sie", "B1"], ["Der Zahnarzt", "طبيب الأسنان", "er", "A2"],
  ["Der Tierarzt", "الطبيب البيطري", "er", "B1"], ["Die Hebamme", "القابلة", "sie", "B1"],
  ["Der Krankenpfleger", "الممرض", "er", "B1"], ["Die Krankenschwester", "الممرضة", "sie", "A2"],
  ["Die Männer", "الرجال", "siepl", "A1"], ["Die Frauen", "النساء", "siepl", "A1"],
  ["Die Freunde", "الأصدقاء", "siepl", "A1"], ["Die Kollegen", "الزملاء", "siepl", "A2"],
  ["Die Schüler", "التلاميذ", "siepl", "A1"], ["Die Studenten", "الطلاب", "siepl", "A1"],
  ["Die Nachbarn", "الجيران", "siepl", "A2"], ["Die Einwohner", "السكان", "siepl", "B1"],
  ["Die Leute", "الناس", "siepl", "A1"], ["Alle", "الجميع", "siepl", "A2"],
  ["Beide", "كلاهما", "siepl", "A2"], ["Keiner", "لا أحد", "er", "B1"],
  ["Man", "المرء", "er", "B1"], ["Der Herr", "السيد", "er", "A2"],
  ["Die Dame", "السيدة", "sie", "A2"], ["Die Damen", "السيدات", "siepl", "B1"],
  ["Die Herren", "السادة", "siepl", "B1"], ["Der Verein", "النادي", "er", "B1"],
  ["Das Team", "الفريق", "es", "A2"], ["Das Land", "البلد", "es", "A2"],
  ["Das Paar", "الزوجان", "es", "A2"], ["Der Hund", "الكلب", "er", "A1"],
  ["Die Katze", "القطة", "sie", "A1"],
];

/* feminine subjects needing Arabic feminine agreement (extends subjFem). */
const BIGFEM = "Tante|Cousine|Enkelin|Schwiegertochter|Braut|Verkäuferin|Polizistin|Studentin|Schülerin|Kellnerin|Köchin|Friseurin|Kundin|Touristin|Rentnerin|Lehrerin|Sekretärin|Apothekerin|Hebamme|Krankenschwester|Dame|Katze|Großeltern|Geschwister|Zwillinge|Braut";

/* [de, ar, lvl] */
const BIGTIMES = [
  ["am Dienstag", "يوم الثلاثاء", "A1"], ["am Mittwoch", "يوم الأربعاء", "A1"],
  ["am Donnerstag", "يوم الخميس", "A1"], ["am Freitag", "يوم الجمعة", "A1"],
  ["am Samstag", "يوم السبت", "A1"], ["am Sonntag", "يوم الأحد", "A1"],
  ["im Januar", "في يناير", "A2"], ["im Februar", "في فبراير", "A2"],
  ["im März", "في مارس", "A2"], ["im April", "في أبريل", "A2"],
  ["im Mai", "في مايو", "A2"], ["im Juni", "في يونيو", "A2"],
  ["im Juli", "في يوليو", "A2"], ["im August", "في أغسطس", "A2"],
  ["im September", "في سبتمبر", "A2"], ["im Oktober", "في أكتوبر", "A2"],
  ["im November", "في نوفمبر", "A2"], ["im Dezember", "في ديسمبر", "A2"],
  ["im Frühling", "في الربيع", "A1"], ["im Herbst", "في الخريف", "A1"],
  ["mittags", "ظهرا", "A1"], ["nachmittags", "بعد الظهر", "A1"], ["nachts", "ليلا", "A1"],
  ["um 8 Uhr", "في الثامنة", "A1"], ["um halb 9", "في الثامنة والنصف", "A2"],
  ["um Viertel vor 6", "في السادسة إلا ربعا", "B1"], ["gegen Mittag", "نحو الظهر", "A2"],
  ["gegen Mitternacht", "نحو منتصف الليل", "B1"], ["vor dem Frühstück", "قبل الفطور", "A2"],
  ["nach dem Frühstück", "بعد الفطور", "A2"], ["vor dem Mittagessen", "قبل الغداء", "A2"],
  ["nach dem Mittagessen", "بعد الغداء", "A2"], ["beim Abendessen", "عند العشاء", "A2"],
  ["heute Morgen", "صباح اليوم", "A1"], ["heute Mittag", "ظهر اليوم", "A1"],
  ["heute Abend", "مساء اليوم", "A1"], ["heute Nacht", "ليلة اليوم", "A2"],
  ["morgen früh", "غدا صباحا", "A1"], ["morgen Mittag", "غدا ظهرا", "A2"],
  ["morgen Abend", "غدا مساء", "A1"], ["gestern Morgen", "صباح أمس", "A2"],
  ["gestern Mittag", "ظهر أمس", "A2"], ["gestern Abend", "مساء أمس", "A1"],
  ["vorgestern", "أول أمس", "A2"], ["übermorgen", "بعد غد", "A2"],
  ["vor einer Woche", "قبل أسبوع", "A2"], ["vor einem Monat", "قبل شهر", "A2"],
  ["vor einem Jahr", "قبل سنة", "A2"], ["in einer Woche", "بعد أسبوع", "A2"],
  ["in einem Monat", "بعد شهر", "A2"], ["in einem Jahr", "بعد سنة", "A2"],
  ["seit zwei Jahren", "منذ سنتين", "B1"], ["seit einem Monat", "منذ شهر", "A2"],
  ["seit letzter Woche", "منذ الأسبوع الماضي", "B1"], ["zweimal pro Woche", "مرتين أسبوعيا", "A2"],
  ["dreimal am Tag", "ثلاث مرات يوميا", "A2"], ["jeden Morgen", "كل صباح", "A1"],
  ["jeden Mittag", "كل ظهر", "A2"], ["jeden Abend", "كل مساء", "A1"],
  ["jede Nacht", "كل ليلة", "A2"], ["jedes Wochenende", "كل عطلة أسبوع", "A2"],
  ["den ganzen Tag", "طوال اليوم", "A2"], ["die ganze Woche", "طوال الأسبوع", "A2"],
  ["das ganze Jahr", "طوال السنة", "A2"], ["eine Stunde lang", "لمدة ساعة", "A2"],
  ["zwei Stunden lang", "لمدة ساعتين", "A2"], ["eine Woche lang", "لمدة أسبوع", "B1"],
  ["einen Monat lang", "لمدة شهر", "B1"], ["an Weihnachten", "في عيد الميلاد", "A1"],
  ["an Ostern", "في عيد الفصح", "A2"], ["an Silvester", "في ليلة رأس السنة", "B1"],
  ["am Neujahrstag", "في يوم رأس السنة", "B1"], ["am Geburtstag", "في عيد الميلاد", "A1"],
  ["am Muttertag", "في عيد الأم", "A2"], ["in den Ferien", "في العطلة", "A1"],
  ["in der Schulzeit", "في وقت المدرسة", "A2"], ["in der Arbeitszeit", "في وقت العمل", "B1"],
  ["in der Mittagspause", "في استراحة الغداء", "A2"], ["nach der Arbeit", "بعد العمل", "A1"],
  ["nach der Schule", "بعد المدرسة", "A1"], ["vor der Arbeit", "قبل العمل", "A2"],
  ["vor der Schule", "قبل المدرسة", "A2"], ["pünktlich um 8", "تمام الثامنة", "A2"],
  ["kurz vor 12", "قبل الثانية عشرة بقليل", "B1"], ["kurz nach 6", "بعد السادسة بقليل", "B1"],
  ["Ende Mai", "نهاية مايو", "B1"], ["Anfang Juni", "بداية يونيو", "B1"],
  ["Mitte Juli", "منتصف يوليو", "B1"], ["im Mai", "في مايو", "A1"], ["im Dezember", "في ديسمبر", "A1"],
];

/* [de, ar, topic, lvl] — topics must be valid CATS. */
const BIGPLACES = [
  ["am Flughafen", "في المطار", "airport", "A1"], ["am Hafen", "في الميناء", "travel", "A2"],
  ["an der Bushaltestelle", "عند موقف الحافلات", "transport", "A2"], ["im Taxi", "في التاكسي", "transport", "A1"],
  ["in der Straßenbahn", "في الترام", "transport", "A2"], ["im Bus", "في الحافلة", "transport", "A1"],
  ["in der U-Bahn", "في المترو", "transport", "A2"], ["am Gleis 5", "عند الرصيف 5", "station", "B1"],
  ["im Abteil", "في المقصورة", "transport", "B1"], ["im ICE", "في القطار السريع", "transport", "B1"],
  ["auf dem Bahnsteig", "على الرصيف", "station", "B1"], ["am Taxistand", "عند موقف التاكسي", "transport", "B1"],
  ["in der Tiefgarage", "في المرآب السفلي", "transport", "B1"], ["auf dem Parkplatz", "في موقف السيارات", "roads", "A2"],
  ["an der Tankstelle", "عند محطة الوقود", "roads", "A2"],
  ["auf dem Amt", "في الدائرة الحكومية", "documents", "A2"], ["im Rathaus", "في البلدية", "services", "A2"],
  ["in der Post", "في البريد", "services", "A1"], ["im Museum", "في المتحف", "city", "A1"],
  ["im Theater", "في المسرح", "hobbies", "A1"], ["im Kino", "في السينما", "hobbies", "A1"],
  ["im Zoo", "في حديقة الحيوان", "city", "A1"], ["auf dem Spielplatz", "في ملعب الأطفال", "family", "A1"],
  ["auf dem Sportplatz", "في الملعب الرياضي", "sports", "A1"], ["im Stadion", "في الملعب", "sports", "A1"],
  ["auf der Tribüne", "في المدرج", "sports", "B1"], ["im Schwimmbad", "في المسبح", "sports", "A1"],
  ["in der Sauna", "في الساونا", "health", "B1"], ["im Fitnessstudio", "في صالة اللياقة", "sports", "A2"],
  ["in der Disco", "في الديسكو", "hobbies", "A2"], ["in der Bar", "في البار", "drinks", "A2"],
  ["im Café", "في المقهى", "drinks", "A1"], ["auf dem Flohmarkt", "في سوق البرغوث", "shopping", "B1"],
  ["auf dem Weihnachtsmarkt", "في سوق عيد الميلاد", "shopping", "A2"], ["auf dem Wochenmarkt", "في السوق الأسبوعي", "shopping", "A2"],
  ["in der Kirche", "في الكنيسة", "general", "A2"], ["auf dem Friedhof", "في المقبرة", "general", "B1"],
  ["im Altersheim", "في دار المسنين", "health", "B1"], ["in der Bücherei", "في المكتبة العامة", "study", "A2"],
  ["im Bürgerbüro", "في مكتب المواطنين", "services", "B1"], ["auf dem Polizeirevier", "في قسم الشرطة", "emergency", "B1"],
  ["beim Anwalt", "عند المحامي", "services", "B1"], ["in der Kanzlei", "في مكتب المحاماة", "work", "B1"],
  ["in der Bäckerei", "في المخبز", "shopping", "A1"], ["beim Bäcker", "عند الخباز", "shopping", "A1"],
  ["beim Friseur", "عند الحلاق", "services", "A1"], ["im Friseursalon", "في صالون الحلاقة", "services", "A2"],
  ["im Schuhgeschäft", "في محل الأحذية", "shopping", "A1"], ["im Blumenladen", "في محل الزهور", "shopping", "A1"],
  ["im Handyladen", "في محل الهواتف", "shopping", "A2"], ["im Buchladen", "في مكتبة البيع", "shopping", "A2"],
  ["im Kaufhaus", "في المتجر الكبير", "shopping", "A2"], ["im Einkaufszentrum", "في مركز التسوق", "shopping", "A2"],
  ["im Keller", "في القبو", "home", "A1"], ["auf dem Dachboden", "في العلية", "home", "A2"],
  ["in der Garage", "في المرآب", "home", "A1"], ["vor dem Haus", "أمام البيت", "home", "A1"],
  ["hinter dem Haus", "خلف البيت", "home", "A1"], ["im Treppenhaus", "في مدخل الدرج", "home", "B1"],
  ["im Aufzug", "في المصعد", "home", "A2"], ["auf der Terrasse", "على الشرفة", "home", "A2"],
  ["im Wintergarten", "في الحديقة الشتوية", "home", "B1"], ["im Arbeitszimmer", "في غرفة العمل", "rooms", "A2"],
  ["im Kinderzimmer", "في غرفة الأطفال", "rooms", "A1"],
  ["in der Fabrik", "في المصنع", "work", "A2"], ["auf der Baustelle", "في موقع البناء", "work", "B1"],
  ["im Homeoffice", "في المكتب المنزلي", "work", "B1"], ["in der Werkstatt", "في الورشة", "work", "A2"],
  ["im Labor", "في المختبر", "work", "B1"], ["in der Praxis", "في العيادة", "doctor", "A2"],
  ["im Großraumbüro", "في المكتب المفتوح", "work", "B1"], ["in der Kantine", "في المقصف", "food", "A2"],
  ["im Pausenraum", "في غرفة الاستراحة", "work", "B1"], ["am Empfang", "عند الاستقبال", "hotel", "B1"],
  ["in der Filiale", "في الفرع", "banking", "B1"],
  ["am See", "عند البحيرة", "nature", "A1"], ["am Meer", "عند البحر", "nature", "A1"],
  ["am Strand", "على الشاطئ", "travel", "A1"], ["in den Bergen", "في الجبال", "nature", "A1"],
  ["im Wald", "في الغابة", "nature", "A1"], ["auf dem Berg", "على الجبل", "nature", "A2"],
  ["auf dem Land", "في الريف", "nature", "A2"], ["im Dorf", "في القرية", "city", "A2"],
  ["auf dem Bauernhof", "في المزرعة", "nature", "A2"], ["am Fluss", "عند النهر", "nature", "A2"],
  ["am Bach", "عند الجدول", "nature", "B1"], ["auf der Wiese", "في المرج", "nature", "B1"],
  ["im Gebirge", "في الجبال العالية", "nature", "B1"], ["an der Küste", "على الساحل", "travel", "B1"],
  ["im Klassenzimmer", "في غرفة الصف", "school", "A1"], ["in der Aula", "في القاعة", "school", "B1"],
  ["auf dem Schulhof", "في ساحة المدرسة", "school", "A1"], ["in der Mensa", "في مطعم الجامعة", "university", "A2"],
  ["in der Turnhalle", "في الصالة الرياضية", "school", "A2"], ["im Hörsaal", "في قاعة المحاضرات", "university", "B1"],
  ["im Seminarraum", "في قاعة الندوات", "university", "B1"], ["im Sekretariat", "في السكرتارية", "school", "B1"],
  ["beim Zahnarzt", "عند طبيب الأسنان", "doctor", "A1"], ["beim Hautarzt", "عند طبيب الجلد", "doctor", "B1"],
  ["im Wartezimmer", "في غرفة الانتظار", "doctor", "A2"], ["in der Reha", "في التأهيل", "health", "B1"],
];

/* transitive pools [inf, ar] — present forms must be rule-correct or in BIGSTEMS. */
const BIGTRAN1 = [
  ["hören", "يسمع"], ["sehen", "يرى"], ["lesen", "يقرأ"], ["schreiben", "يكتب"],
  ["nennen", "يسمي"], ["beantworten", "يجيب"],
  ["benutzen", "يستخدم"], ["beobachten", "يراقب"],
  ["beschreiben", "يصف"], ["brauchen", "يحتاج"], ["decken", "يغطي"],
  ["drucken", "يطبع"], ["empfangen", "يستقبل"], ["entdecken", "يكتشف"], ["erzählen", "يروي"],
  ["fangen", "يمسك"], ["fassen", "يمسك"], ["filmen", "يصور"],
  ["führen", "يقود"], ["füllen", "يملأ"], ["holen", "يحضر"],
  ["kassieren", "يحاسب"], ["kontrollieren", "يراقب"], ["laden", "يحمل"], ["lagern", "يخزن"],
  ["leeren", "يفرغ"], ["liefern", "يوصل"], ["loben", "يمدح"], ["malen", "يرسم"],
  ["mieten", "يستأجر"], ["nehmen", "يأخذ"], ["nutzen", "يستخدم"], ["öffnen", "يفتح"],
  ["organisieren", "ينظم"], ["packen", "يحزم"], ["parken", "يركن"], ["planen", "يخطط"],
  ["prüfen", "يفحص"], ["räumen", "يرتب"], ["reinigen", "ينظف"], ["retten", "ينقذ"],
  ["rufen", "ينادي"], ["sagen", "يقول"], ["sammeln", "يجمع"], ["schützen", "يحمي"],
  ["senden", "يرسل"], ["setzen", "يضع"], ["sichern", "يؤمن"], ["sparen", "يوفر"],
  ["speichern", "يحفظ"], ["stören", "يزعج"], ["studieren", "يتعلم"], ["tragen", "يحمل"],
  ["vermieten", "يؤجر"], ["verschieben", "يؤجل"], ["verstehen", "يفهم"], ["verwalten", "يدير"],
  ["wechseln", "يبدل"], ["wählen", "يختار"], ["wecken", "يوقظ"], ["wiegen", "يزن"],
  ["wischen", "يمسح"], ["zeichnen", "يرسم"], ["zeigen", "يري"], ["ziehen", "يسحب"],
  ["zählen", "يعد"], ["absagen", "يلغي"], ["zusagen", "يوافق"], ["vorschlagen", "يقترح"],
  ["aufschreiben", "يدون"], ["vorlesen", "يقرأ بصوت عال"], ["einladen", "يدعو"],
  ["ausfüllen", "يملأ"], ["abwaschen", "يغسل"], ["aufessen", "يأكل كله"],
  ["mitbringen", "يحضر معه"], ["zurückbringen", "يعيد"], ["abgeben", "يسلم"],
  ["aufgeben", "يستسلم"], ["annehmen", "يقبل"], ["aufnehmen", "يستقبل"],
];
const BIGTRAN2 = [
  ["kosten", "يتذوق"], ["trinken", "يشرب"], ["essen", "يأكل"], ["kochen", "يطبخ"],
  ["backen", "يخبز"], ["schneiden", "يقطع"], ["waschen", "يغسل"], ["putzen", "ينظف"],
  ["bügeln", "يكوي"], ["bezahlen", "يدفع"], ["bestellen", "يطلب"], ["reservieren", "يحجز"],
  ["reparieren", "يصلح"], ["fotografieren", "يصور"], ["hängen", "يعلق"], ["kleben", "يلصق"],
  ["heben", "يرفع"], ["werfen", "يرمي"], ["treten", "يركل"], ["brechen", "يكسر"],
  ["erfahren", "يعرف"], ["erhalten", "يحصل على"],
  ["betrügen", "يغش"], ["jagen", "يصطاد"], ["meiden", "يتجنب"],
];

/* intransitive pools — NO reflexive-only, NO weather impersonals. */
const BIGINTRAN1 = [
  ["frühstücken", "يتناول الفطور"], ["duschen", "يستحم"], ["aufwachen", "يستيقظ"],
  ["ankommen", "يصل"], ["abfahren", "يغادر"], ["aussteigen", "ينزل"],
  ["einsteigen", "يركب"], ["umsteigen", "يبدل"], ["spazieren", "يتنزه"],
  ["bummeln", "يتجول"], ["niesen", "يعطس"], ["gähnen", "يتثاءب"],
  ["schnarchen", "يشخر"], ["frieren", "يتجمد"], ["schwitzen", "يتعرق"],
  ["zittern", "يرتجف"], ["strahlen", "يشع"], ["glänzen", "يلمع"],
  ["lächeln", "يبتسم"], ["schreien", "يصرخ"], ["flüstern", "يهمس"],
  ["schimpfen", "يوبخ"], ["lachen", "يضحك"], ["weinen", "يبكي"],
  ["hoffen", "يأمل"], ["zweifeln", "يشك"], ["zögern", "يتردد"],
  ["eilen", "يسرع"], ["rennen", "يركض"], ["klettern", "يتسلق"],
  ["stolpern", "يتعثر"], ["fallen", "يسقط"], ["aufstehen", "ينهض"],
  ["umziehen", "ينتقل"], ["verreisen", "يسافر"], ["zurückkehren", "يعود"],
  ["grillen", "يشوي"], ["angeln", "يصطاد"], ["segeln", "يبحر"],
  ["surfen", "يتصفح"], ["tauchen", "يغوص"], ["bluten", "ينزف"],
  ["leben", "يعيش"], ["baden", "يستحم"], ["klagen", "يشتكي"],
  ["winken", "يلوح"], ["springen", "يقفز"], ["verschwinden", "يختفي"],
  ["joggen", "يركض"], ["reiten", "يركب الخيل"], ["leiden", "يعاني"],
];
const BIGINTRAN2 = [
  ["arbeiten", "يعمل"], ["lernen", "يتعلم"], ["schlafen", "ينام"],
  ["warten", "ينتظر"], ["reisen", "يسافر"], ["spielen", "يلعب"],
  ["tanzen", "يرقص"], ["lachen", "يضحك"], ["bleiben", "يبقى"],
  ["trainieren", "يتدرب"], ["feiern", "يحتفل"], ["telefonieren", "يتصل"],
  ["diskutieren", "يناقش"], ["funktionieren", "يعمل"],
];

/* ditransitive-capable [inf, ar]. */
const BIGDITRAN = [
  ["senden", "يرسل"], ["reichen", "يناول"], ["wünschen", "يتمنى"],
  ["verbieten", "يمنع"], ["erlauben", "يسمح"], ["verzeihen", "يسامح"],
  ["schreiben", "يكتب"], ["sagen", "يقول"], ["zahlen", "يدفع"],
  ["borgen", "يقرض"], ["versprechen", "يعد"], ["empfehlen", "يوصي"],
];

/* stem-change verbs missing from base STEMS (du, er). */
const BIGSTEMS = {
  "verraten": ["verrätst", "verrät"], "erfahren": ["erfährst", "erfährt"],
  "erhalten": ["erhältst", "erhält"], "geraten": ["gerätst", "gerät"],
  "gefallen": ["gefällst", "gefällt"], "werfen": ["wirfst", "wirft"],
  "gelten": ["giltst", "gilt"], "brechen": ["brichst", "bricht"],
  "treten": ["trittst", "tritt"], "lassen": ["lässt", "lässt"],
  "entlassen": ["entlässt", "entlässt"],
};

/* perfect-tense Arabic (past stems) for auto-derived participles. */
const BIGPERFV_AR = {
  "hören": "سمع", "sehen": "رأى", "lesen": "قرأ", "schreiben": "كتب",
  "kennen": "عرف", "nennen": "سمى", "besuchen": "زار", "abholen": "استقبل",
  "anrufen": "اتصل", "beantworten": "أجاب", "bedienen": "خدم", "begrüßen": "رحب",
  "benutzen": "استخدم", "beobachten": "راقب", "beschreiben": "وصف", "bitten": "طلب",
  "brauchen": "احتاج", "decken": "غطى", "drucken": "طبع", "empfangen": "استقبل",
  "entdecken": "اكتشف", "erzählen": "روى", "fangen": "أمسك", "fassen": "أمسك",
  "filmen": "صور", "fragen": "سأل", "führen": "قاد", "füllen": "ملأ",
  "grüßen": "حيا", "holen": "أحضر", "kassieren": "حاسب", "kontrollieren": "راقب",
  "laden": "حمل", "lagern": "خزن", "leeren": "أفرغ", "liefern": "وصل",
  "loben": "مدح", "malen": "رسم", "mieten": "استأجر", "nehmen": "أخذ",
  "nutzen": "استخدم", "öffnen": "فتح", "organisieren": "نظم", "packen": "حزم",
  "parken": "ركن", "planen": "خطط", "prüfen": "فحص", "räumen": "رتب",
  "reinigen": "نظف", "retten": "أنقذ", "rufen": "نادى", "sagen": "قال",
  "sammeln": "جمع", "schützen": "حمى", "senden": "أرسل", "setzen": "وضع",
  "sichern": "أمن", "sparen": "وفر", "speichern": "حفظ", "stören": "أزعج",
  "studieren": "درس", "tragen": "حمل", "vermieten": "أجر", "verschieben": "أجل",
  "verstehen": "فهم", "verwalten": "أدار", "wechseln": "بدل", "wählen": "اختار",
  "wecken": "أيقظ", "wiegen": "وزن", "wischen": "مسح", "zeichnen": "رسم",
  "zeigen": "أرى", "ziehen": "سحب", "zählen": "عد", "absagen": "ألغى",
  "zusagen": "وافق", "vorschlagen": "اقترح", "aufschreiben": "دون", "vorlesen": "قرأ",
  "einladen": "دعا", "ausfüllen": "ملأ", "abwaschen": "غسل", "aufessen": "أكل",
  "mitbringen": "أحضر", "zurückbringen": "أعاد", "abgeben": "سلم", "aufgeben": "استسلم",
  "annehmen": "قبل", "aufnehmen": "استقبل", "frühstücken": "تناول الفطور",
  "duschen": "استحم", "aufwachen": "استيقظ", "ankommen": "وصل", "abfahren": "غادر",
  "aussteigen": "نزل", "einsteigen": "ركب", "umsteigen": "بدل", "spazieren": "تنزه",
  "bummeln": "تجول", "niesen": "عطس", "gähnen": "تثاءب", "schnarchen": "شخر",
  "frieren": "تجمد", "schwitzen": "تعرق", "zittern": "ارتجف", "strahlen": "شع",
  "glänzen": "لمع", "lächeln": "ابتسم", "schreien": "صرخ", "flüstern": "همس",
  "schimpfen": "وبخ", "lachen": "ضحك", "weinen": "بكى", "hoffen": "أمل",
  "zweifeln": "شك", "zögern": "تردد", "eilen": "أسرع", "rennen": "ركض",
  "klettern": "تسلق", "stolpern": "تعثر", "fallen": "سقط", "aufstehen": "نهض",
  "umziehen": "انتقل", "verreisen": "سافر", "zurückkehren": "عاد", "grillen": "شوى",
  "angeln": "اصطاد", "segeln": "أبحر", "surfen": "تصفح", "tauchen": "غاص",
  "bluten": "نزف", "reichen": "ناول", "wünschen": "تمنى", "verbieten": "منع",
  "erlauben": "سمح", "verzeihen": "سامح", "borgen": "أقرض", "verraten": "أفشى",
  "versprechen": "وعد", "brechen": "كسر", "werfen": "رمى", "treten": "ركل",
  "reiten": "ركب", "leiden": "عانى", "meiden": "تجنب", "kleben": "لصق",
  "baden": "استحم", "jagen": "صاد", "klagen": "اشتكى", "winken": "لوح",
  "heben": "رفع", "betrügen": "غش", "hängen": "علق", "springen": "قفز",
  "erfahren": "عرف", "erhalten": "حصل على", "leben": "عاش", "verschwinden": "اختفى",
};

/* imperatives [inf, du-imperative, ar] — inseparable only (word order). */
const BIGIMPV = [
  ["kaufen", "Kaufe", "اشتر"], ["verkaufen", "Verkaufe", "بع"], ["waschen", "Wasch", "اغسل"],
  ["bügeln", "Bügle", "اكو"], ["bringen", "Bring", "أحضر"], ["holen", "Hol", "أحضر"],
  ["zeigen", "Zeig", "أر"], ["erklären", "Erkläre", "اشرح"], ["erzählen", "Erzähle", "احك"],
  ["wiederholen", "Wiederhole", "كرر"], ["übersetzen", "Übersetze", "ترجم"], ["bestellen", "Bestelle", "اطلب"],
  ["bezahlen", "Bezahle", "ادفع"], ["reservieren", "Reserviere", "احجز"], ["parken", "Parke", "اركن"],
  ["fotografieren", "Fotografiere", "صور"], ["backen", "Backe", "اخبز"], ["schneiden", "Schneide", "اقطع"],
  ["rufen", "Rufe", "ناد"], ["grüßen", "Grüße", "حي"], ["entschuldigen", "Entschuldige", "اعذر"],
  ["gratulieren", "Gratuliere", "هنئ"],
];

const BIGNAMES = [
  ["Layla", "ليلى"], ["Karim", "كريم"], ["Hassan", "حسن"], ["Fatima", "فاطمة"],
  ["Yusuf", "يوسف"], ["Nour", "نور"], ["Tarek", "طارق"], ["Dina", "دينا"],
  ["Heba", "هبة"], ["Samir", "سمير"], ["Felix", "فيليكس"], ["Lena", "لينا"],
  ["Max", "ماكس"], ["Emma", "إيما"], ["Paul", "باول"], ["Marie", "ماري"],
];

const BIGADV = [
  ["sehr gut", "جيدا جدا"], ["wirklich", "حقا"], ["plötzlich", "فجأة"],
  ["endlich", "أخيرا"], ["leider", "للأسف"], ["hoffentlich", "نأمل"],
  ["fast", "تقريبا"], ["kaum", "بالكاد"], ["sicher", "بالتأكيد"],
  ["vielleicht", "ربما"], ["natürlich", "بالطبع"], ["gern", "بسرور"],
];

const BIGZU = [
  ["das Zimmer aufzuräumen", "أن يرتب الغرفة"], ["die Hausaufgaben zu machen", "أن يعمل الواجب"],
  ["den Arzt anzurufen", "أن يتصل بالطبيب"], ["die Rechnung zu bezahlen", "أن يدفع الفاتورة"],
  ["das Auto zu reparieren", "أن يصلح السيارة"], ["die Reise zu buchen", "أن يحجز الرحلة"],
  ["die Wohnung zu putzen", "أن ينظف الشقة"], ["Deutsch zu üben", "أن يتدرب على الألمانية"],
  ["ein Buch zu lesen", "أن يقرأ كتابا"], ["einen Brief zu schreiben", "أن يكتب رسالة"],
  ["die Kinder abzuholen", "أن يستقبل الأطفال"], ["die Oma zu besuchen", "أن يزور الجدة"],
  ["lange zu schlafen", "أن ينام طويلا"], ["früh ins Bett zu gehen", "أن يذهب للنوم مبكرا"],
  ["jeden Tag Sport zu machen", "أن يمارس الرياضة يوميا"], ["gesund zu kochen", "أن يطبخ صحيا"],
  ["Geld zu sparen", "أن يوفر المال"], ["die Prüfung zu bestehen", "أن يجتاز الامتحان"],
  ["den Bus zu nehmen", "أن يأخذ الحافلة"], ["mit dem Rauchen aufzuhören", "أن يقلع عن التدخين"],
];

const BIGWIE = [
  ["der Urlaub", "الإجازة"], ["die Prüfung", "الامتحان"], ["die Reise", "الرحلة"],
  ["das Konzert", "الحفل"], ["die Party", "الحفلة"], ["das Praktikum", "التدريب"],
  ["der Deutschkurs", "دورة الألمانية"], ["das Vorstellungsgespräch", "مقابلة العمل"],
  ["die Arbeit", "العمل"], ["der Umzug", "الانتقال"],
];

const BIGWO = [
  ["die Bank", "البنك"], ["die Post", "البريد"], ["die Polizei", "الشرطة"],
  ["der Notausgang", "مخرج الطوارئ"], ["der Spielplatz", "ملعب الأطفال"],
  ["die Bushaltestelle", "موقف الحافلات"], ["der Fahrstuhl", "المصعد"],
  ["die Tiefgarage", "المرآب السفلي"], ["das Fundbüro", "مكتب المفقودات"],
  ["die Rezeption", "الاستقبال"],
];

/* object-fit rules: verb -> allowed categories and/or explicit noun allowlist.
   Verbs absent here accept any non-country thing (default). */
const OBJCATS = {
  "essen": { cats: ["food"] }, "trinken": { cats: ["drinks", "food"] },
  "kochen": { cats: ["food"] }, "backen": { cats: ["food"] },
  "lesen": { allow: ["Buch", "Zeitung", "Brief", "E-Mail", "Roman", "Magazin", "Comic", "Geschichte", "Nachricht", "Liste"] },
  "schreiben": { allow: ["Brief", "E-Mail", "Hausaufgabe", "Geschichte", "Liste", "Nachricht"] },
  "hören": { allow: ["Musik", "Radio", "Lied", "Nachricht", "Konzert", "Geräusch"] },
  "öffnen": { allow: ["Tür", "Fenster", "Flasche", "Dose", "Geschäft", "Konto", "Brief", "Buch", "Tasche", "Schrank"] },
  "schließen": { allow: ["Tür", "Fenster", "Flasche", "Dose", "Geschäft", "Konto", "Brief", "Buch", "Tasche", "Schrank"] },
  "werfen": { cats: ["sports"], allow: ["Müll", "Schlüssel"] },
  "treten": { cats: ["sports"] }, "brechen": { cats: ["food", "home"] },
  "fangen": { cats: ["animals", "sports"] }, "schneiden": { cats: ["food"] },
  "waschen": { cats: ["clothing", "transport"] },
  "putzen": { cats: ["home", "rooms", "transport"] }, "bügeln": { cats: ["clothing"] },
  "reparieren": { cats: ["home", "transport", "computers", "phones", "work"] },
  "vermieten": { cats: ["home"] }, "sparen": { cats: ["money", "time"] },
  "erfahren": { cats: ["communication"] }, "kassieren": { cats: ["people", "money", "documents"] },
  "ausfüllen": { cats: ["documents"] }, "entdecken": { cats: ["travel", "city", "nature"] },
  "schützen": { cats: ["people", "home", "family", "health"] },
  "hängen": { cats: ["home", "rooms", "clothing"] },
  "decken": { allow: ["Tisch", "Bett"] },
  "mitbringen": { cats: ["food", "drinks", "general", "hobbies"] },
  "geben": { nopeople: true }, "nehmen": { nopeople: true },
  "entschuldigen": { allow: ["Fehler", "Verspätung", "Lärm"] },
  "grüßen": { person: true }, "gratulieren": { person: true },
  "beantworten": { allow: ["Frage", "Antwort", "Anfrage", "E-Mail", "Brief", "Nachricht", "Liste"] },
  "stören": { allow: ["Ruhe", "Frieden", "Unterricht", "Schlaf", "Arbeit", "Konzert"] },
  "leeren": { allow: ["Teller", "Glas", "Flasche", "Mülleimer", "Briefkasten", "Tasche", "Tasse", "Topf"] },
  "verlieren": { allow: ["Schlüssel", "Geld", "Handy", "Geduld", "Hoffnung", "Spiel", "Stelle", "Wohnung"] },
};

/* predicative adjective allowlists for finden/machen (evaluative/state only). */
const FINDEVAL = ["gut", "schlecht", "schön", "interessant", "langweilig", "spannend", "wichtig", "toll", "super", "nett", "freundlich", "sympathisch", "komisch", "seltsam", "teuer", "billig", "groß", "klein", "neu", "alt", "modern", "praktisch", "blöd", "doof", "wunderbar", "schrecklich", "furchtbar", "fantastisch", "schick", "hübsch", "hässlich"];
const MACHEVAL = ["glücklich", "traurig", "müde", "krank", "gesund", "sauer", "wütend", "stolz", "nervös", "froh", "munter", "fit", "kaputt", "pleite", "arm", "reich", "berühmt", "beliebt"];

/* person-object verbs (accusative persons): conjugated-safe inseparable only. */
const PERSON_V = [
  ["besuchen", "يزور"], ["fragen", "يسأل"], ["bitten", "يطلب"], ["bedienen", "يخدم"],
  ["begrüßen", "يرحب"], ["grüßen", "يحيي"], ["kennen", "يعرف"], ["umarmen", "يعانق"],
  ["heiraten", "يتزوج"], ["küssen", "يقبل"], ["bewundern", "يعجب بـ"], ["beneiden", "يحسد"],
  ["trösten", "يواسي"], ["bestrafen", "يعاقب"], ["entlassen", "يفصل"],
  ["befördern", "يرقي"], ["beschenken", "يهدي"], ["verraten", "يفشي"],
];

module.exports = { BIGSUBJ, BIGFEM, BIGTIMES, BIGPLACES, BIGTRAN1, BIGTRAN2, BIGINTRAN1, BIGINTRAN2, BIGDITRAN, BIGSTEMS, BIGPERFV_AR, BIGIMPV, BIGNAMES, BIGADV, BIGZU, BIGWIE, BIGWO, OBJCATS, FINDEVAL, MACHEVAL, PERSON_V };
