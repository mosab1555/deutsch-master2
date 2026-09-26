/* Deutsch Master - A1 Sentence Database expansion (ADDITIVE ONLY).
   يوسّع خانة "الجمل" الأساسية فوق النظام الحالي بدون حذف أي شيء:
   1) بنك جمل A1 منظم: كل جملة مرتبطة بـ Kapitel + موضوع + قاعدة + كلمة.
      الصيغة: [de, ar, kap, topic, gramTitle, wordKey]
      - kap: K0..K5 (موجودة فعليًا في KAPITEL)
      - topic: قيمة من CATEGORIES الموجودة (Family, Food, ...)
      - gramTitle: عنوان قاعدة من GRAMMAR (يُحلّ إلى id تلقائيًا)
      - wordKey: "de|art" لمطابقة كلمة VOCAB (تلميح — يوجد ربط تلقائي احتياطي)
   2) استيراد أمثلة المفردات (w.ex) كجمل مرتبطة بكلماتها — يغطي كل الكلمات.
   3) Duplicate Detection قبل أي إضافة (تطبيع: حالة/مسافات/ترقيم).
   4) نفس العرض والنطق (speakGerman de-DE) + فلتر موضوع + Pagination للأداء.
   لا يمس: تدريبات الجمل (sentex.js) ولا Smart Training ولا أي Feature. */
"use strict";

/* ================= PART 1: K0 + K1 ================= */
var SENT_A1_K0K1 = [
/* ---- K0: der/die/das + الجمع + الحرف الكبير + Alphabet (g1,g2,g3,g39) ---- */
["Der Mann ist hier.","الرجل هنا.","K0","General","der / die / das","Mann|der"],
["Die Frau ist nett.","السيدة لطيفة.","K0","Family","der / die / das","Frau|die"],
["Das Kind spielt.","الطفل يلعب.","K0","Family","der / die / das","Kind|das"],
["Der Tisch ist groß.","الطاولة كبيرة.","K0","Home","der / die / das","Tisch|der"],
["Die Tür ist offen.","الباب مفتوح.","K0","Home","der / die / das","Tür|die"],
["Das Buch ist neu.","الكتاب جديد.","K0","School","der / die / das","Buch|das"],
["Die Bücher sind neu.","الكتب جديدة.","K0","School","الجمع في الألمانية","Buch|das"],
["Der Apfel ist rot.","التفاحة حمراء.","K0","Food","der / die / das","Apfel|der"],
["Die Äpfel sind frisch.","التفاح طازج.","K0","Food","الجمع في الألمانية","Apfel|der"],
["Das Bett ist weich.","السرير مريح.","K0","Home","der / die / das","Bett|das"],
["Die Betten sind sauber.","الأسرّة نظيفة.","K0","Home","الجمع في الألمانية","Bett|das"],
["Der Name ist kurz.","الاسم قصير.","K0","School","الحرف الكبير","Name|der"],
["Die Namen sind lang.","الأسماء طويلة.","K0","School","الجمع في الألمانية","Name|der"],
["Das Wort ist schwer.","الكلمة صعبة.","K0","School","الحرف الكبير","Wort|das"],
["Die Wörter sind leicht.","الكلمات سهلة.","K0","School","الجمع في الألمانية","Wort|das"],
["Der Bus kommt.","الأتوبيس قادم.","K0","Travel","der / die / das","Bus|der"],
["Die Busse sind voll.","الأتوبيسات ممتلئة.","K0","Travel","الجمع في الألمانية","Bus|der"],
["Der Kurs beginnt heute.","الكورس يبدأ اليوم.","K0","School","der / die / das","Kurs|der"],
["Die Kurse sind gut.","الكورسات جيدة.","K0","School","الجمع في الألمانية","Kurs|der"],
["Das Land ist groß.","البلد كبير.","K0","Travel","der / die / das","Land|das"],
["Die Länder sind schön.","البلاد جميلة.","K0","Travel","الجمع في الألمانية","Land|das"],
["Die Straße ist lang.","الشارع طويل.","K0","Travel","der / die / das","Straße|die"],
["Die Straßen sind sauber.","الشوارع نظيفة.","K0","Travel","الجمع في الألمانية","Straße|die"],
["Der Morgen ist schön.","الصباح جميل.","K0","Time","der / die / das","Morgen|der"],
["Ich lerne das Alphabet.","أتعلم الأبجدية.","K0","Languages","Alphabet und Aussprache","- |-"],
["Buchstabieren Sie bitte Ihren Namen.","تهجَّ اسمك من فضلك.","K0","General","Alphabet und Aussprache","buchstabieren|-"],
["Das Öl ist teuer.","الزيت غالٍ.","K0","Food","der / die / das","Öl|das"],
["Die Tomate ist rot.","الطماطم حمراء.","K0","Food","der / die / das","Tomate|die"],
["Der Student liest ein Buch.","الطالب يقرأ كتابًا.","K0","University","der / die / das","Student|der"],
["Die Studenten lernen Deutsch.","الطلاب يتعلمون الألمانية.","K0","University","الجمع في الألمانية","Student|der"],
["Die Schule ist groß.","المدرسة كبيرة.","K0","School","der / die / das","Schule|die"],
["Der Kollege ist freundlich.","الزميل ودود.","K0","Work","der / die / das","Kollege|der"],
["Die Kollegen sind nett.","الزملاء لطفاء.","K0","Work","الجمع في الألمانية","Kollege|der"],
["Der Arbeiter arbeitet viel.","العامل يعمل كثيرًا.","K0","Work","der / die / das","Arbeiter|der"],
["Das Mädchen spielt im Garten.","الفتاة تلعب في الحديقة.","K0","Family","der / die / das","Mädchen|das"],
["Die Karte ist neu.","الكارت جديد.","K0","Travel","der / die / das","Karte|die"],
["Der Klub ist modern.","النادي حديث.","K0","General","der / die / das","Klub|der"],
["Das Thema ist interessant.","الموضوع شيّق.","K0","School","der / die / das","Thema|das"],
["Die Tür ist zu.","الباب مغلق.","K0","Home","der / die / das","Tür|die"],
["Sie schreibt mit einem Stift.","هي تكتب بقلم.","K0","School","الحرف الكبير","- |-"],
/* ---- K1: sein / haben (g6) ---- */
["Ich bin Student.","أنا طالب.","K1","University","الأفعال الشاذة","sein|-"],
["Du bist müde.","أنت متعب.","K1","General","الأفعال الشاذة","sein|-"],
["Er ist in Berlin.","هو في برلين.","K1","Travel","الأفعال الشاذة","sein|-"],
["Sie ist Lehrerin.","هي معلّمة.","K1","Work","الأفعال الشاذة","sein|-"],
["Wir sind Freunde.","نحن أصدقاء.","K1","General","ضمائر الفاعل","sein|-"],
["Ihr seid nett.","أنتم لطفاء.","K1","General","الأفعال الشاذة","sein|-"],
["Sind Sie Herr Schmidt?","هل حضرتك السيد شميدت؟","K1","General","الأفعال الشاذة","sein|-"],
["Bist du krank?","هل أنت مريض؟","K1","Body","Ja/Nein-Fragen","sein|-"],
["Ist das dein Buch?","هل هذا كتابك؟","K1","School","Ja/Nein-Fragen","sein|-"],
["Ich bin nicht müde.","أنا لست متعبًا.","K1","General","nicht أم kein","sein|-"],
["Wir sind zu Hause.","نحن في البيت.","K1","Home","الأفعال الشاذة","sein|-"],
["Ich habe Zeit.","لدي وقت.","K1","Time","الأفعال الشاذة","haben|-"],
["Du hast Glück.","أنت محظوظ.","K1","General","الأفعال الشاذة","haben|-"],
["Er hat ein Auto.","لديه سيارة.","K1","Travel","الأفعال الشاذة","haben|-"],
["Wir haben Hunger.","نحن جائعون.","K1","Food","الأفعال الشاذة","haben|-"],
["Habt ihr Fragen?","هل لديكم أسئلة؟","K1","School","Ja/Nein-Fragen","haben|-"],
["Ich habe keine Zeit.","ليس لدي وقت.","K1","Time","nicht أم kein","haben|-"],
["Hast du einen Stift?","هل معك قلم؟","K1","School","Ja/Nein-Fragen","haben|-"],
["Haben Sie Kinder?","هل لديك أطفال؟","K1","Family","الأفعال الشاذة","haben|-"],
/* ---- K1: wohnen / kommen / أفعال منتظمة (g5) ---- */
["Ich wohne in Tanta.","أنا أسكن في طنطا.","K1","Home","الأفعال المنتظمة","wohnen|-"],
["Wo wohnt deine Familie?","أين تسكن عائلتك؟","K1","Family","W-Fragen","wohnen|-"],
["Meine Familie wohnt in Ägypten.","عائلتي تسكن في مصر.","K1","Family","الأفعال المنتظمة","wohnen|-"],
["Ich wohne nicht in Berlin.","لا أسكن في برلين.","K1","Home","nicht أم kein","wohnen|-"],
["Wohnst du in Kairo?","هل تسكن في القاهرة؟","K1","Home","Ja/Nein-Fragen","wohnen|-"],
["Wir wohnen zusammen.","نسكن معًا.","K1","Home","الأفعال المنتظمة","wohnen|-"],
["Er kommt aus Italien.","هو من إيطاليا.","K1","Travel","الأفعال المنتظمة","kommen|-"],
["Kommst du morgen?","هل تأتي غدًا؟","K1","General","Ja/Nein-Fragen","kommen|-"],
["Wir kommen später.","سنأتي لاحقًا.","K1","General","الأفعال المنتظمة","kommen|-"],
["Kommen Sie aus Ägypten?","هل حضرتك من مصر؟","K1","Travel","السؤال عن الاسم والموطن واللغة","kommen|-"],
["Ich frage den Lehrer.","أسأل المعلم.","K1","School","الأفعال المنتظمة","fragen|-"],
["Fragst du mich?","هل تسألني؟","K1","General","Ja/Nein-Fragen","fragen|-"],
["Er lebt in Hamburg.","يعيش في هامبورج.","K1","Travel","الأفعال المنتظمة","leben|-"],
["Wir leben in Ägypten.","نعيش في مصر.","K1","Travel","الأفعال المنتظمة","leben|-"],
["Ich liebe Kaffee.","أحب القهوة.","K1","Drinks","الأفعال المنتظمة","lieben|-"],
["Liebst du Tee?","هل تحب الشاي؟","K1","Drinks","Ja/Nein-Fragen","lieben|-"],
["Wir hören Musik.","نسمع الموسيقى.","K1","General","الأفعال المنتظمة","hören|-"],
["Hört ihr mich?","هل تسمعونني؟","K1","General","Ja/Nein-Fragen","hören|-"],
["Ich sage die Wahrheit.","أقول الحقيقة.","K1","General","الأفعال المنتظمة","sagen|-"],
["Wir machen eine Pause.","نأخذ استراحة.","K1","Work","الأفعال المنتظمة","machen|-"],
["Machst du mit?","هل تشارك؟","K1","General","Ja/Nein-Fragen","machen|-"],
["Sie spielt Klavier.","هي تعزف البيانو.","K1","General","الأفعال المنتظمة","spielen|-"],
["Spielt ihr Fußball?","هل تلعبون كرة القدم؟","K1","General","Ja/Nein-Fragen","spielen|-"],
["Ich verstehe dich.","أفهمك.","K1","General","الأفعال الشاذة","verstehen|-"],
["Verstehst du mich?","هل تفهمني؟","K1","General","Ja/Nein-Fragen","verstehen|-"],
["Wir verstehen die Frage.","نفهم السؤال.","K1","School","الأفعال الشاذة","verstehen|-"],
["Gehst du heute zur Arbeit?","هل تذهب اليوم إلى العمل؟","K1","Work","Ja/Nein-Fragen","gehen|-"],
["Wir gehen ins Kino.","نذهب إلى السينما.","K1","General","الأفعال الشاذة","gehen|-"],
["Ich kenne den Mann.","أعرف الرجل.","K1","General","الأفعال المنتظمة","kennen|-"],
["Kennst du Mona?","هل تعرف منى؟","K1","General","Ja/Nein-Fragen","kennen|-"],
["Er heißt Omar.","اسمه عمر.","K1","General","الأفعال الشاذة","heißen|-"],
["Wie heißt deine Schwester?","ما اسم أختك؟","K1","Family","W-Fragen","heißen|-"],
["Ich lese gern Bücher.","أحب قراءة الكتب.","K1","School","الأفعال الشاذة","lesen|-"],
["Liest du Zeitungen?","هل تقرأ الجرائد؟","K1","General","Ja/Nein-Fragen","lesen|-"],
["Wir sprechen Arabisch.","نتحدث العربية.","K1","Languages","الأفعال الشاذة","sprechen|-"],
["Sprichst du Englisch?","هل تتحدث الإنجليزية؟","K1","Languages","Ja/Nein-Fragen","sprechen|-"],
["Ich sehe den Film.","أشاهد الفيلم.","K1","General","الأفعال الشاذة","sehen|-"],
["Siehst du mich?","هل تراني؟","K1","General","Ja/Nein-Fragen","sehen|-"],
["Er schreibt eine E-Mail.","يكتب إيميلًا.","K1","Work","الأفعال المنتظمة","schreiben|-"],
["Schreibst du oft?","هل تكتب كثيرًا؟","K1","General","Ja/Nein-Fragen","schreiben|-"],
["Ich grüße dich.","أحييك.","K1","General","الأفعال المنتظمة","grüßen|-"],
["Er ergänzt den Satz.","هو يُكمل الجملة.","K1","School","الأفعال المنتظمة","ergänzen|-"],
["Ich ordne die Wörter zu.","أرتب الكلمات.","K1","School","الأفعال المنتظمة","zuordnen|-"],
["Ich buchstabiere langsam.","أتهجى ببطء.","K1","School","الأفعال المنتظمة","buchstabieren|-"],
["Reagiert er schnell?","هل يرد بسرعة؟","K1","General","Ja/Nein-Fragen","reagieren|-"],
/* ---- K1: تحيات وتعريف (g7,g8) + ضمائر (g4) + das (g9) ---- */
["Guten Morgen, wie geht es Ihnen?","صباح الخير، كيف حال حضرتك؟","K1","General","التحيات رسمي/غير رسمي","guten Morgen|-"],
["Hallo, ich bin neu hier.","أهلًا، أنا جديد هنا.","K1","General","التحيات رسمي/غير رسمي","hallo|-"],
["Freut mich, dich kennenzulernen!","سعدت بالتعرف عليك!","K1","General","التحيات رسمي/غير رسمي","- |-"],
["Bis morgen!","إلى الغد!","K1","General","التحيات رسمي/غير رسمي","- |-"],
["Ich komme aus Tanta.","أنا من طنطا.","K1","Travel","السؤال عن الاسم والموطن واللغة","kommen|-"],
["Ich spreche ein bisschen Arabisch.","أتحدث القليل من العربية.","K1","Languages","السؤال عن الاسم والموطن واللغة","sprechen|-"],
["Welche Sprache sprichst du?","أي لغة تتحدث؟","K1","Languages","W-Fragen","sprechen|-"],
["Wir sind Schüler.","نحن تلاميذ.","K1","School","ضمائر الفاعل","sein|-"],
["Bist du Lehrer?","هل أنت معلّم؟","K1","Work","ضمائر الفاعل","sein|-"],
["Das sind meine Eltern.","هؤلاء والداي.","K1","Family","das بمعنيين","- |-"],
["Das ist mein Bruder.","هذا أخي.","K1","Family","das بمعنيين","Bruder|der"],
/* ---- K1: W-Fragen (g10) + Ja/Nein (g31) + doch (g35) + Zahlen (g38) ---- */
["Was machst du?","ماذا تفعل؟","K1","General","W-Fragen","machen|-"],
["Was ist das?","ما هذا؟","K1","General","W-Fragen","was|-"],
["Wer ist da?","من هناك؟","K1","General","W-Fragen","wer|-"],
["Wo ist die Toilette?","أين الحمّام؟","K1","Travel","W-Fragen","wo|-"],
["Wann beginnt der Kurs?","متى يبدأ الكورس؟","K1","School","W-Fragen","Kurs|der"],
["Wie heißt das auf Deutsch?","ما اسم هذا بالألمانية؟","K1","Languages","W-Fragen","heißen|-"],
["Warum lernst du Deutsch?","لماذا تتعلم الألمانية؟","K1","Languages","W-Fragen","lernen|-"],
["Kommst du aus Kairo?","هل أنت من القاهرة؟","K1","Travel","Ja/Nein-Fragen","kommen|-"],
["Sprichst du Arabisch?","هل تتحدث العربية؟","K1","Languages","Ja/Nein-Fragen","sprechen|-"],
["Wohnst du allein?","هل تسكن وحدك؟","K1","Home","Ja/Nein-Fragen","wohnen|-"],
["Bist du Student?","هل أنت طالب؟","K1","University","Ja/Nein-Fragen","sein|-"],
["Kommst du heute nicht? – Doch!","ألن تأتي اليوم؟ – بل سآتي!","K1","General","doch / nein / ja","kommen|-"],
["Du lernst nicht? – Doch, ich lerne!","ألا تذاكر؟ – بل أذاكر!","K1","School","doch / nein / ja","lernen|-"],
["Ich bin zwanzig Jahre alt.","عمري عشرون سنة.","K1","General","Zahlen","zwanzig|-"],
["Das kostet fünf Euro.","سعره خمسة يورو.","K1","Shopping","Zahlen","fünf|-"],
["Ich habe zwei Brüder.","لدي أخوان.","K1","Family","Zahlen","haben|-"],
["Wir sind vier Personen.","نحن أربعة أشخاص.","K1","General","Zahlen","sein|-"],
["Meine Nummer ist fünfzehn.","رقمي خمسة عشر.","K1","General","Zahlen","fünfzehn|-"]
];
/* ================= PART 2: K2 + K3 ================= */
var SENT_A1_K2K3 = [
/* ---- K2: أفعال يومية ---- */
["Ich arbeite in Kairo.","أعمل في القاهرة.","K2","Work","الأفعال المنتظمة","arbeiten|-"],
["Arbeitest du viel?","هل تعمل كثيرًا؟","K2","Work","Ja/Nein-Fragen","arbeiten|-"],
["Wir arbeiten zusammen.","نعمل معًا.","K2","Work","الأفعال المنتظمة","arbeiten|-"],
["Er arbeitet heute nicht.","هو لا يعمل اليوم.","K2","Work","nicht أم kein","arbeiten|-"],
["Ich fahre mit dem Bus.","أذهب بالأوتوبيس.","K2","Travel","الأفعال الشاذة","fahren|-"],
["Fährst du nach Berlin?","هل تسافر إلى برلين؟","K2","Travel","Ja/Nein-Fragen","fahren|-"],
["Wir fahren morgen.","سنُسافر غدًا.","K2","Travel","الأفعال الشاذة","fahren|-"],
["Ich koche heute.","أطبخ اليوم.","K2","Food","الأفعال المنتظمة","kochen|-"],
["Kochst du gern?","هل تحب الطبخ؟","K2","Food","Ja/Nein-Fragen","kochen|-"],
["Meine Mutter kocht gut.","أمي تطبخ جيدًا.","K2","Family","الأفعال المنتظمة","kochen|-"],
["Ich suche meine Tasche.","أبحث عن حقيبتي.","K2","General","الأفعال المنتظمة","suchen|-"],
["Suchst du etwas?","هل تبحث عن شيء؟","K2","General","Ja/Nein-Fragen","suchen|-"],
["Wir suchen das Hotel.","نبحث عن الفندق.","K2","Travel","الأفعال المنتظمة","suchen|-"],
["Ich studiere in Berlin.","أدرس في برلين.","K2","University","الأفعال المنتظمة","studieren|-"],
["Studierst du Medizin?","هل تدرس الطب؟","K2","University","Ja/Nein-Fragen","studieren|-"],
["Er schwimmt im Meer.","يسبح في البحر.","K2","General","الأفعال المنتظمة","schwimmen|-"],
["Schwimmst du gern?","هل تحب السباحة؟","K2","General","Ja/Nein-Fragen","schwimmen|-"],
["Sie singt ein Lied.","تُغني أغنية.","K2","General","الأفعال المنتظمة","singen|-"],
["Wir singen zusammen.","نُغني معًا.","K2","General","الأفعال المنتظمة","singen|-"],
["Ich reise nach Deutschland.","أسافر إلى ألمانيا.","K2","Travel","الأفعال المنتظمة","reisen|-"],
["Reist du oft?","هل تُسافر كثيرًا؟","K2","Travel","Ja/Nein-Fragen","reisen|-"],
["Er steht vor der Tür.","يقف أمام الباب.","K2","Home","الأفعال المنتظمة","stehen|-"],
["Ich antworte sofort.","أُجيب فورًا.","K2","General","الأفعال المنتظمة","antworten|-"],
["Antwortest du mir?","هل تُجيبني؟","K2","General","Ja/Nein-Fragen","antworten|-"],
["Das passt mir gut.","هذا يُناسبني.","K2","General","الأفعال المنتظمة","passen|-"],
["Passt dir der Termin?","هل يُناسبك الموعد؟","K2","Time","Ja/Nein-Fragen","passen|-"],
["Ich merke nichts.","لا أُلاحظ شيئًا.","K2","General","nicht أم kein","merken|-"],
["Er nennt seinen Namen.","يذكر اسمه.","K2","General","الأفعال المنتظمة","nennen|-"],
["Sprich mir nach!","ردّد خلفي!","K2","School","Imperativ mit du","nachsprechen|-"],
["Kreuze die Antwort an!","ضع علامة على الإجابة!","K2","School","Imperativ mit du","ankreuzen|-"],
["Ich sehe mir den Film an.","أُشاهد الفيلم.","K2","General","trennbare Verben","ansehen|-"],
["Achte auf die Regel!","انتبه للقاعدة!","K2","School","Imperativ mit du","achten|-"],
["Markiere das Wort!","علّم على الكلمة!","K2","School","Imperativ mit du","markieren|-"],
["Ich habe morgen frei.","لدي إجازة غدًا.","K2","Time","الأفعال المنتظمة","freihaben|-"],
["Hast du am Sonntag frei?","هل أنت حر يوم الأحد؟","K2","Days","Ja/Nein-Fragen","freihaben|-"],
["Er joggt jeden Morgen.","يركض كل صباح.","K2","Body","الأفعال المنتظمة","joggen|-"],
["Ich berichte über meine Stadt.","أحكي عن مدينتي.","K2","Travel","الأفعال المنتظمة","berichten|-"],
["Er fotografiert das Haus.","يُصوّر البيت.","K2","Home","الأفعال المنتظمة","fotografieren|-"],
["Er präsentiert seine Arbeit.","يعرض عمله.","K2","Work","الأفعال المنتظمة","präsentieren|-"],
/* ---- K2: أيام الأسبوع (g12) ---- */
["Am Montag arbeite ich.","يوم الاثنين أعمل.","K2","Days","أيام الأسبوع","- |-"],
["Am Freitag habe ich frei.","يوم الجمعة لدي إجازة.","K2","Days","أيام الأسبوع","freihaben|-"],
["Wir treffen uns am Sonntag.","نلتقي يوم الأحد.","K2","Days","أيام الأسبوع","Sonntag|der"],
["Heute ist Montag.","اليوم الاثنين.","K2","Days","أيام الأسبوع","Montag|der"],
["Morgen ist Dienstag.","غدًا الثلاثاء.","K2","Days","أيام الأسبوع","Dienstag|der"],
["Am Samstag besuche ich meine Familie.","يوم السبت أزور عائلتي.","K2","Family","أيام الأسبوع","- |-"],
["Bist du am Mittwoch da?","هل أنت موجود يوم الأربعاء؟","K2","Days","أيام الأسبوع","sein|-"],
/* ---- K2: البلاد بالأداة (g11) + الأسرة ---- */
["Ich komme aus der Türkei.","أنا من تركيا.","K2","Travel","أدوات البلاد","Türkei|die"],
["Sie kommt aus der Schweiz.","هي من سويسرا.","K2","Travel","أدوات البلاد","kommen|-"],
["Wohnst du in Deutschland?","هل تسكن في ألمانيا؟","K2","Travel","أدوات البلاد","wohnen|-"],
["Meine Schwester wohnt in Wien.","أختي تسكن في فيينا.","K2","Family","أدوات البلاد","wohnen|-"],
["Ich habe einen Bruder und eine Schwester.","لدي أخ وأخت.","K2","Family","Akkusativ","haben|-"],
["Mein Bruder ist verheiratet.","أخي متزوج.","K2","Family","Nominativ","Bruder|der"],
["Meine Eltern wohnen in Tanta.","والداي يسكنان في طنطا.","K2","Family","الأفعال المنتظمة","wohnen|-"],
["Besucht ihr eure Familie oft?","هل تزورون عائلتكم كثيرًا؟","K2","Family","Ja/Nein-Fragen","- |-"],
["Das Baby schläft.","الرضيع نائم.","K2","Family","الأفعال الشاذة","- |-"],
["Die Kinder spielen draußen.","الأطفال يلعبون في الخارج.","K2","Family","الأفعال المنتظمة","spielen|-"],
["Meine Oma kocht sehr gut.","جدتي تطبخ جيدًا جدًا.","K2","Family","الأفعال المنتظمة","kochen|-"],
["Ruf deine Mutter an!","اتصل بأمك!","K2","Family","trennbare Verben","Mutter|die"],
/* ---- K3: معرفة/نكرة (g13) + kein (g14) ---- */
["Das ist ein Tisch.","هذه طاولة.","K3","Home","المعرفة والنكرة","- |-"],
["Das ist die Tür.","هذا هو الباب.","K3","Home","المعرفة والنكرة","Tür|die"],
["Ich habe eine Schwester.","لدي أخت.","K3","Family","المعرفة والنكرة","haben|-"],
["Ich sehe einen Mann.","أرى رجلًا.","K3","General","Akkusativ","sehen|-"],
["Ich habe kein Auto.","ليس لدي سيارة.","K3","Travel","النفي kein / keine","haben|-"],
["Sie hat keine Kinder.","ليس لديها أطفال.","K3","Family","النفي kein / keine","haben|-"],
["Hast du kein Geld?","أليس معك نقود؟","K3","General","النفي kein / keine","haben|-"],
["Das ist kein Problem.","هذه ليست مشكلة.","K3","General","النفي kein / keine","- |-"],
["Ich trinke keinen Kaffee.","لا أشرب القهوة.","K3","Drinks","النفي kein / keine","trinken|-"],
/* ---- K3: الأمر الرسمي (g15) + أمر du (g33) ---- */
["Kommen Sie bitte herein!","تفضل بالدخول!","K3","General","الأمر الرسمي","kommen|-"],
["Sprechen Sie langsamer, bitte!","تحدث ببطء من فضلك!","K3","Languages","الأمر الرسمي","sprechen|-"],
["Schreiben Sie Ihren Namen!","اكتب اسمك!","K3","School","الأمر الرسمي","schreiben|-"],
["Warten Sie kurz!","انتظر قليلًا!","K3","General","الأمر الرسمي","- |-"],
["Nehmen Sie Platz!","تفضل بالجلوس!","K3","General","الأمر الرسمي","- |-"],
["Komm her!","تعال هنا!","K3","General","Imperativ mit du","kommen|-"],
["Warte kurz!","انتظر قليلًا!","K3","General","Imperativ mit du","- |-"],
["Sprich bitte!","تحدث من فضلك!","K3","General","Imperativ mit du","sprechen|-"],
/* ---- K3: الفعل ثانيًا (g16) + زمن im/am (g17) + nicht/kein (g18) ---- */
["Heute lerne ich Deutsch.","اليوم أتعلم الألمانية.","K3","Languages","الفعل في المرتبة الثانية","lernen|-"],
["Morgen fahre ich nach Kairo.","غدًا أُسافر إلى القاهرة.","K3","Travel","الفعل في المرتبة الثانية","fahren|-"],
["Im Sommer reisen wir.","في الصيف نُسافر.","K3","Travel","حروف الزمن im / am","reisen|-"],
["Im Winter ist es kalt.","في الشتاء الجو بارد.","K3","Time","حروف الزمن im / am","sein|-"],
["Am Montag beginnt der Kurs.","يوم الاثنين يبدأ الكورس.","K3","School","حروف الزمن im / am","Kurs|der"],
["In der Nacht schlafen wir.","في الليل ننام.","K3","Time","حروف الزمن im / am","- |-"],
["Ich studiere nicht.","أنا لا أُذاكر.","K3","School","nicht أم kein","studieren|-"],
["Er kommt heute nicht.","هو لن يأتي اليوم.","K3","General","nicht أم kein","kommen|-"],
["Das verstehe ich nicht.","هذا لا أفهمه.","K3","General","nicht أم kein","verstehen|-"],
/* ---- K3: العمر (g19) + اتجاهات + حروف (g36) ---- */
["Wie alt ist dein Bruder?","كم عمر أخيك؟","K3","Family","السؤال عن العمر","Bruder|der"],
["Ich bin dreißig Jahre alt.","عمري ثلاثون سنة.","K3","General","السؤال عن العمر","sein|-"],
["Wo ist der Bahnhof?","أين محطة القطار؟","K3","Travel","Präpositionen A1","Bahnhof|der"],
["Der Bahnhof ist dort.","المحطة هناك.","K3","Travel","Präpositionen A1","Bahnhof|der"],
["Ich fahre zum Bahnhof.","أذهب إلى المحطة.","K3","Travel","Präpositionen A1","fahren|-"],
["Der Bahnhof ist nicht weit.","المحطة ليست بعيدة.","K3","Travel","nicht أم kein","Bahnhof|der"],
["Gehen Sie geradeaus!","سِر للأمام!","K3","Travel","الأمر الرسمي","gehen|-"],
["Die Apotheke ist links.","الصيدلية على اليسار.","K3","Travel","Präpositionen A1","- |-"],
["Ist es weit?","هل هو بعيد؟","K3","Travel","Ja/Nein-Fragen","sein|-"],
["Nein, es ist nicht weit.","لا، ليس بعيدًا.","K3","Travel","nicht أم kein","sein|-"],
["Ich fahre nach Hamburg.","أُسافر إلى هامبورج.","K3","Travel","Präpositionen A1","fahren|-"],
["Wohnen Sie in Hamburg?","هل تسكن في هامبورج؟","K3","Travel","Präpositionen A1","wohnen|-"],
["Das Bild hängt an der Wand.","الصورة معلقة على الحائط.","K3","Home","Präpositionen A1","- |-"],
["Ich warte auf dich.","أنتظرك.","K3","General","Präpositionen A1","- |-"],
["Danke für deine Hilfe!","شكرًا لمساعدتك!","K3","General","Präpositionen A1","danke|-"],
["Wen siehst du?","من ترى؟","K3","General","wer / wen / was","sehen|-"],
["Ich sehe dich.","أراك.","K3","General","ضمائر Akkusativ","sehen|-"]
];
//__PART2__
/* ================= PART 3: K4 + K5 + أفعال مركزة ================= */
var SENT_A1_K4K5 = [
/* ---- K4: طعام وشراب + Akkusativ (g20) ---- */
["Ich esse eine Pizza.","آكل بيتزا.","K4","Food","Akkusativ","essen|-"],
["Wir essen heute zu Hause.","نأكل اليوم في البيت.","K4","Food","Akkusativ","essen|-"],
["Was möchtest du essen?","ماذا تريد أن تأكل؟","K4","Food","wer / wen / was","essen|-"],
["Ich esse gern Pizza.","أحب أكل البيتزا.","K4","Food","Akkusativ","essen|-"],
["Ich trinke einen Kaffee.","أشرب قهوة.","K4","Drinks","Akkusativ","trinken|-"],
["Trinkst du einen Tee?","هل تشرب شايًا؟","K4","Drinks","Ja/Nein-Fragen","trinken|-"],
["Was trinkst du?","ماذا تشرب؟","K4","Drinks","wer / wen / was","trinken|-"],
["Ich kaufe ein Brot.","أشتري خبزًا.","K4","Shopping","Akkusativ","kaufen|-"],
["Kaufst du Milch?","هل تشتري حليبًا؟","K4","Shopping","Ja/Nein-Fragen","kaufen|-"],
["Wir kaufen Obst und Gemüse.","نشتري فاكهة وخضارًا.","K4","Food","Akkusativ","kaufen|-"],
["Brauchst du Hilfe?","هل تحتاج مساعدة؟","K4","General","Akkusativ","- |-"],
["Die Suppe schmeckt gut.","الشوربة طعمها جيد.","K4","Food","Nominativ","- |-"],
["Der Kaffee schmeckt gut.","مذاق القهوة جيد.","K4","Drinks","Nominativ","- |-"],
["Das Essen ist lecker.","الطعام لذيذ.","K4","Food","Nominativ","- |-"],
["Ich habe Hunger.","أنا جائع.","K4","Food","الأفعال الشاذة","haben|-"],
["Ich habe Durst.","أنا عطشان.","K4","Drinks","الأفعال الشاذة","haben|-"],
/* ---- K4: أسعار ومحادثة محل (g24) ---- */
["Was kostet die Milch?","كم سعر الحليب؟","K4","Shopping","محادثة الأسعار","- |-"],
["Das kostet zwei Euro.","سعره اثنان يورو.","K4","Shopping","محادثة الأسعار","zwei|-"],
["Zahlen, bitte!","الحساب من فضلك!","K4","Food","محادثة الأسعار","- |-"],
["Sonst noch etwas?","شيء آخر؟","K4","Shopping","محادثة الأسعار","- |-"],
["Nein, das ist alles.","لا، هذا كل شيء.","K4","Shopping","محادثة الأسعار","- |-"],
["Wo finde ich den Reis?","أين أجد الأرز؟","K4","Shopping","W-Fragen","- |-"],
/* ---- K4: أفعال Nominativ (g21) + ضمائر Akk (g22) + wer/wen/was (g23) ---- */
["Sie ist meine Freundin.","هي صديقتي.","K4","General","أفعال Nominativ","sein|-"],
["Er bleibt mein Freund.","سيبقى صديقي.","K4","General","أفعال Nominativ","Freund|der"],
["Wir bleiben zu Hause.","سنبقى في البيت.","K4","Home","أفعال Nominativ","- |-"],
["Wer ist dein Lehrer?","من معلّمك؟","K4","School","wer / wen / was","Lehrer|der"],
["Wen rufst du an?","من تتصل به؟","K4","General","wer / wen / was","- |-"],
["Ich liebe meine Familie.","أحب عائلتي.","K4","Family","ضمائر Akkusativ","lieben|-"],
["Sie besucht ihren Bruder.","تزور أخاها.","K4","Family","ضمائر Akkusativ","Bruder|der"],
["Ich sehe ihn morgen.","سأراه غدًا.","K4","General","ضمائر Akkusativ","sehen|-"],
["Sie kennt uns.","هي تعرفنا.","K4","General","ضمائر Akkusativ","kennen|-"],
["Er liebt sie.","هو يُحبها.","K4","General","ضمائر Akkusativ","lieben|-"],
/* ---- K4: أفعال منفصلة (g34) + ظروف مكان ---- */
["Ich rufe dich später an.","سأتصل بك لاحقًا.","K4","General","trennbare Verben","- |-"],
["Stehst du früh auf?","هل تستيقظ مبكرًا؟","K4","Time","trennbare Verben","- |-"],
["Ich stehe um sechs Uhr auf.","أستيقظ السادسة.","K4","Time","trennbare Verben","- |-"],
["Ruf mich bitte an!","اتصل بي من فضلك!","K4","General","trennbare Verben","- |-"],
["Mach die Tür auf!","افتح الباب!","K4","Home","trennbare Verben","- |-"],
["Die Katze ist unter dem Tisch.","القطة تحت الطاولة.","K4","Home","Präpositionen A1","- |-"],
["Der Garten ist hinter dem Haus.","الحديقة خلف البيت.","K4","Home","Präpositionen A1","- |-"],
["Die Bank ist neben der Post.","البنك بجانب البريد.","K4","Travel","Präpositionen A1","- |-"],
["Ich bin müde.","أنا متعب.","K4","General","Nominativ","sein|-"],
/* ---- K5: Modalverben (g25,g40) ---- */
["Ich kann schwimmen.","أستطيع السباحة.","K5","General","Modalverben","können|-"],
["Kannst du mir helfen?","هل يمكنك مساعدتي؟","K5","General","Modalverben","können|-"],
["Wir können Deutsch sprechen.","نستطيع التحدث بالألمانية.","K5","Languages","Modalverben","können|-"],
["Kann ich ein Glas Wasser trinken?","هل يمكنني شرب كوب ماء؟","K5","Drinks","Modalverben","können|-"],
["Ich muss heute arbeiten.","يجب أن أعمل اليوم.","K5","Work","Modalverben","müssen|-"],
["Musst du morgen früh aufstehen?","هل يجب أن تستيقظ مبكرًا غدًا؟","K5","Time","Modalverben","müssen|-"],
["Ich will einen Kaffee.","أريد قهوة.","K5","Drinks","Modalverben","wollen|-"],
["Willst du mitkommen?","هل تريد أن تأتي معنا؟","K5","General","Modalverben","wollen|-"],
["Ich möchte ein Wasser.","أريد ماءً.","K5","Drinks","Modalverben im Detail","möchten|-"],
["Möchten Sie etwas essen?","هل تريد شيئًا للأكل؟","K5","Food","Modalverben im Detail","möchten|-"],
["Du kannst toll Deutsch sprechen.","تستطيع التحدث بالألمانية ببراعة.","K5","Languages","Modalverben","können|-"],
/* ---- K5: الوقت um/von-bis (g26) + الساعة (g28) + Datum (g37) ---- */
["Ich frühstücke um sieben Uhr.","أفطر السابعة.","K5","Time","um / von…bis","frühstücken|-"],
["Wir essen um zwölf Uhr.","نأكل الثانية عشرة.","K5","Time","um / von…bis","essen|-"],
["Von wann bis wann arbeitest du?","من متى إلى متى تعمل؟","K5","Work","um / von…bis","arbeiten|-"],
["Ich arbeite von acht bis vier Uhr.","أعمل من الثامنة إلى الرابعة.","K5","Work","um / von…bis","arbeiten|-"],
["Es ist ein Uhr.","الساعة الواحدة.","K5","Time","الساعة رسمي/غير رسمي","eins|-"],
["Es ist halb drei.","الثانية والنصف.","K5","Time","الساعة رسمي/غير رسمي","drei|-"],
["Es ist jetzt neun Uhr.","الساعة الآن التاسعة.","K5","Time","الساعة رسمي/غير رسمي","neun|-"],
["Der Termin ist am Freitag.","الموعد يوم الجمعة.","K5","Time","Uhrzeit und Datum","Freitag|der"],
/* ---- K5: Possessiv (g27) + عائلة ---- */
["Mein Vater ist nett.","أبي لطيف.","K5","Family","Possessiv في Nom و Akk","Vater|der"],
["Meine Mutter arbeitet viel.","أمي تعمل كثيرًا.","K5","Family","Possessiv في Nom و Akk","Mutter|die"],
["Das ist meine Schwester.","هذه أختي.","K5","Family","Possessiv في Nom و Akk","Schwester|die"],
["Wo ist meine Tasche?","أين حقيبتي؟","K5","General","Possessiv في Nom و Akk","Tasche|die"],
["Besuchst du deinen Vater oft?","هل تزور والدك كثيرًا؟","K5","Family","Possessiv في Nom و Akk","Vater|der"],
["Wir haben zwei Kinder.","لدينا طفلان.","K5","Family","Possessiv في Nom و Akk","haben|-"],
["Mein Sohn geht zur Schule.","ابني يذهب إلى المدرسة.","K5","Family","Possessiv في Nom و Akk","Sohn|der"],
["Hast du Geschwister?","هل لديك إخوة؟","K5","Family","Ja/Nein-Fragen","haben|-"],
["Meine Geschwister wohnen in Kairo.","إخوتي يسكنون في القاهرة.","K5","Family","الأفعال المنتظمة","wohnen|-"],
/* ---- K5: اعتذار (g29) + Dativ (g30) ---- */
["Entschuldigen Sie die Störung!","عذرًا على الإزعاج!","K5","General","الاعتذار والرد","Entschuldigung|die"],
["Das tut mir leid.","يؤسفني ذلك.","K5","General","الاعتذار والرد","- |-"],
["Ich komme mit dir.","سآتي معك.","K5","General","Dativ مع mit/bei/aus","kommen|-"],
["Kommst du mit mir?","هل تأتي معي؟","K5","General","Dativ مع mit/bei/aus","kommen|-"],
["Ich bin bei einem Freund.","أنا عند صديق.","K5","General","Dativ مع mit/bei/aus","sein|-"],
["Ich fahre mit dem Bus zur Arbeit.","أذهب بالأوتوبيس إلى العمل.","K5","Work","Dativ مع mit/bei/aus","fahren|-"],
["Ich trinke Tee ohne Zucker.","أشرب الشاي بدون سكر.","K5","Drinks","Dativ مع mit/bei/aus","trinken|-"],
/* ---- K5: حياة يومية ---- */
["Gute Besserung!","أتمنى لك الشفاء!","K5","Body","الاعتذار والرد","- |-"],
["Was machst du am Wochenende?","ماذا تفعل في عطلة الأسبوع؟","K5","Time","W-Fragen","machen|-"],
["Am Wochenende besuche ich meine Familie.","في العطلة أزور عائلتي.","K5","Family","الفعل في المرتبة الثانية","- |-"],
["Ich gehe jeden Morgen zur Arbeit.","أذهب كل صباح إلى العمل.","K5","Work","الأفعال الشاذة","gehen|-"],
["Abends sehe ich fern.","مساءً أُشاهد التلفاز.","K5","Home","trennbare Verben","- |-"],
["Ohne Zucker, bitte.","بدون سكر من فضلك.","K5","Drinks","Dativ مع mit/bei/aus","- |-"]
];
/* ============ أفعال مركزة: تصريفات وسياقات (كل فعل مهم × عدة جمل) ============ */
var SENT_A1_VERBS = [
["Ich gehe zur Schule.","أذهب إلى المدرسة.","K1","School","الأفعال الشاذة","gehen|-"],
["Wir gehen nach Hause.","نذهب إلى البيت.","K1","Home","الأفعال الشاذة","gehen|-"],
["Er geht ins Kino.","يذهب إلى السينما.","K1","General","الأفعال الشاذة","gehen|-"],
["Wohin gehst du?","إلى أين تذهب؟","K1","General","W-Fragen","gehen|-"],
["Ich komme morgen.","سآتي غدًا.","K1","General","الأفعال المنتظمة","kommen|-"],
["Woher kommt deine Freundin?","من أين صديقتك؟","K1","General","W-Fragen","kommen|-"],
["Wir kommen aus Ägypten.","نحن من مصر.","K1","Travel","السؤال عن الاسم والموطن واللغة","kommen|-"],
["Kommt ihr auch?","هل تأتون أيضًا؟","K1","General","Ja/Nein-Fragen","kommen|-"],
["Ich mache Hausaufgaben.","أعمل الواجب المنزلي.","K1","School","الأفعال المنتظمة","machen|-"],
["Was machst du gern?","ماذا تحب أن تفعل؟","K1","General","W-Fragen","machen|-"],
["Wir machen einen Ausflug.","نقوم برحلة.","K1","Travel","الأفعال المنتظمة","machen|-"],
["Macht das Spaß?","هل هذا ممتع؟","K1","General","Ja/Nein-Fragen","machen|-"],
["Ich spreche Deutsch.","أنا أتحدث الألمانية.","K1","Languages","الأفعال الشاذة","sprechen|-"],
["Was sprichst du?","ماذا تتحدث؟","K1","Languages","W-Fragen","sprechen|-"],
["Wir sprechen morgen.","سنتحدث غدًا.","K1","General","الأفعال الشاذة","sprechen|-"],
["Sprechen Sie Französisch?","هل تتحدث الفرنسية؟","K1","Languages","Ja/Nein-Fragen","sprechen|-"],
["Ich esse um acht Uhr.","آكل الساعة الثامنة.","K4","Food","Akkusativ","essen|-"],
["Isst du Fleisch?","هل تأكل اللحم؟","K4","Food","Ja/Nein-Fragen","essen|-"],
["Wir essen zusammen.","نأكل معًا.","K4","Food","الأفعال الشاذة","essen|-"],
["Er isst kein Fleisch.","هو لا يأكل اللحم.","K4","Food","النفي kein / keine","essen|-"],
["Ich trinke Wasser.","أشرب الماء.","K4","Drinks","Akkusativ","trinken|-"],
["Trinkst du Kaffee?","هل تشرب القهوة؟","K4","Drinks","Ja/Nein-Fragen","trinken|-"],
["Wir trinken Tee.","نشرب الشاي.","K4","Drinks","Akkusativ","trinken|-"],
["Er trinkt keinen Alkohol.","هو لا يشرب الكحول.","K4","Drinks","النفي kein / keine","trinken|-"],
["Ich lerne jeden Tag.","أتعلم كل يوم.","K1","School","الأفعال المنتظمة","lernen|-"],
["Lernst du Deutsch?","هل تتعلم الألمانية؟","K1","Languages","Ja/Nein-Fragen","lernen|-"],
["Wir lernen zu zweit.","نتعلم كل اثنين معًا.","K1","School","الأفعال المنتظمة","lernen|-"],
["Lernt ihr fleißig?","هل تذاكرون باجتهاد؟","K1","School","Ja/Nein-Fragen","lernen|-"],
["Ich habe ein Buch.","لدي كتاب.","K1","School","الأفعال الشاذة","haben|-"],
["Hast du Zeit?","هل لديك وقت؟","K1","Time","Ja/Nein-Fragen","haben|-"],
["Wir haben einen Hund.","لدينا كلب.","K1","Animals","الأفعال الشاذة","haben|-"],
["Haben Sie einen Termin?","هل لديك موعد؟","K1","Time","Ja/Nein-Fragen","haben|-"],
["Ich bin zu Hause.","أنا في البيت.","K1","Home","الأفعال الشاذة","sein|-"],
["Bist du bereit?","هل أنت مستعد؟","K1","General","Ja/Nein-Fragen","sein|-"],
["Wir sind pünktlich.","نحن منضبطون.","K1","Time","الأفعال الشاذة","sein|-"],
["Sind Sie zufrieden?","هل أنت راضٍ؟","K1","General","Ja/Nein-Fragen","sein|-"]
];

/* ================= PART 4: الدمج + Dedup + الربط (engine) ================= */
var SENT_A1_EXTRA = [].concat(
  (typeof SENT_A1_K0K1 !== "undefined" ? SENT_A1_K0K1 : []),
  (typeof SENT_A1_K2K3 !== "undefined" ? SENT_A1_K2K3 : []),
  (typeof SENT_A1_K4K5 !== "undefined" ? SENT_A1_K4K5 : []),
  (typeof SENT_A1_VERBS !== "undefined" ? SENT_A1_VERBS : [])
);

var SentA1 = {
  merged: false,
  stats: { before: 0, vocabEx: 0, bank: 0, dup: 0, linkedWords: 0, unlinked: 0, gramCovered: 0, kapCovered: 0 },
  importedWid: {},
  rejectedKeys: {},
  seq: 1
};

/* تطبيع للمقارنة: يتجاهل الحالة والمسافات والترقيم */
function sentNorm(s) {
  return String(s || "").toLowerCase()
    .replace(/[?.!,;:"„“»«'’‚‘…–—\-()\[\]]/g, "")
    .replace(/\s+/g, " ").trim();
}
function sentKey(de) { return sentNorm(de); }

/* عنوان القاعدة -> id (g1..g40) */
function sentGramId(title) {
  try {
    var g = GRAMMAR.find(function (x) { return x.title === title; });
    return g ? g.id : null;
  } catch (e) { return null; }
}
/* wordKey "de|art" -> word id ، ثم احتياطي: بحث عن الكلمة داخل الجملة */
function sentFindWid(de, wordKey) {
  try {
    if (wordKey) {
      var p = String(wordKey).split("|");
      var hit = allWords().find(function (w) { return w.de === p[0] && String(w.art) === String(p[1] || w.art); });
      if (hit) return hit.id;
      hit = allWords().find(function (w) { return w.de === p[0]; });
      if (hit) return hit.id;
    }
    var low = " " + sentNorm(de) + " ";
    var best = null;
    allWords().forEach(function (w) {
      if (best) return;
      var dw = sentNorm(w.de);
      if (!dw || dw.length < 3) return;
      if (w.art && w.art !== "-") {
        var arts = { der: ["der", "den", "dem"], die: ["die", "der", "den"], das: ["das", "dem", "den"] };
        var forms = arts[w.art] || [w.art];
        for (var i = 0; i < forms.length; i++) {
          if (low.indexOf(" " + forms[i] + " " + dw + " ") >= 0 || low.indexOf(" " + forms[i] + " " + dw + "s ") >= 0) { best = w.id; return; }
        }
        if (low.indexOf(" " + dw + " ") >= 0 && dw.length > 5) best = w.id;
      } else {
        if (low.indexOf(" " + dw + " ") >= 0) best = w.id;
      }
    });
    return best;
  } catch (e) { return null; }
}
/* موضوع تلقائي للجمل القديمة (الـ 108) حسب كلمات مفتاحية */
function sentAutoTopic(de, kap) {
  var t = " " + sentNorm(de) + " ";
  function any(list) { return list.some(function (w) { return t.indexOf(" " + w + " ") >= 0 || t.indexOf(" " + w) === 0; }); }
  if (any(["familie", "bruder", "schwester", "vater", "mutter", "eltern", "sohn", "oma", "freundin", "mann ", "kinder", "kind ", "baby"])) return "Family";
  if (any(["pizza", "apfel", "brot", "milch", "kaffee", "tee", "essen", "trinken", "hunger", "durst", "suppe", "fleisch", "kuchen", "eis"])) return "Food";
  if (any(["schule", "lehrer", "kurs", "buch", "frage", "hausaufgaben", "student", "universität", "prüfung"])) return "School";
  if (any(["arbeit", "büro", "kollege", "chef", "beruf"])) return "Work";
  if (any(["bahnhof", "bus", "zug", "reise", "hotel", "stadt", "berlin", "hamburg", "kairo", "flug", "tax"])) return "Travel";
  if (any(["kaufen", "kosten", "euro", "preis", "rechnung", "tüte"])) return "Shopping";
  if (any(["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag", "uhr", "zeit", "heute", "morgen", "woche", "jahr"])) return "Time";
  if (any(["deutsch", "arabisch", "englisch", "sprache", "sprechen"])) return "Languages";
  if (any(["haus", "wohnung", "tür", "tisch", "bett", "garten", "küche"])) return "Home";
  if (any(["krank", "arzt", "müde", "gesund", "kopf"])) return "Body";
  if (any(["hund", "katze", "vogel"])) return "Animals";
  return "General";
}

/* الدمج الرئيسي — idempotent: آمن عند إعادة التشغيل بعد تحميل A1X/A2 */
function sentA1Merge() {
  try {
    if (typeof SENTENCES === "undefined" || typeof VOCAB === "undefined") return SentA1.stats;
    var seen = {};
    SENTENCES.forEach(function (s) { seen[sentKey(s.de)] = 1; });
    try {
      VOCAB.forEach(function (w) { if (w.ex) seen[sentKey(w.ex)] = 1; });
      GRAMMAR.forEach(function (g) { (g.ex || []).forEach(function (e) { if (e[0]) seen[sentKey(e[0])] = 1; }); });
    } catch (e) {}
    if (!SentA1.merged) SentA1.stats.before = SENTENCES.length;
    /* مثال ضعيف مولّد آليًا (قالب Ich möchte X)؟ البنك يغطي الأفعال — نتخطاه */
    function weakAutoEx(w) {
      if (!w.ex) return true;
      if (/^Ich möchte \S+\.$/.test(w.ex) && /\(أريد\)/.test(w.exAr || "")) return true;
      if (/^\([^)]*\)/.test(w.exAr || "")) return true;
      return false;
    }
    /* 1) أمثلة المفردات -> جمل مرتبطة بكلماتها */
    var nV = 0, nD = 0;
    VOCAB.forEach(function (w) {
      if (!w.ex || sentNorm(w.ex).split(" ").length < 2 || weakAutoEx(w)) return;
      if (SentA1.importedWid[w.id]) return;
      var k = sentKey(w.ex);
      if (seen[k]) { if (!SentA1.rejectedKeys[k]) { SentA1.rejectedKeys[k] = 1; nD++; } return; }
      seen[k] = 1;
      SentA1.importedWid[w.id] = 1;
      SENTENCES.push({
        id: "sv" + (SentA1.seq++), de: w.ex, ar: w.exAr || "", pron: "",
        kap: w.kap || "KX", level: w.level || "A1",
        topic: w.cat || "General", gram: null, wid: w.id, w: w.de, src: "vocab"
      });
      nV++;
    });
    /* 2) البنك المنظم */
    var nB = 0;
    SENT_A1_EXTRA.forEach(function (r) {
      var k = sentKey(r[0]);
      if (!k) return;
      if (seen[k]) { if (!SentA1.rejectedKeys[k]) { SentA1.rejectedKeys[k] = 1; nD++; } return; }
      seen[k] = 1;
      var gid = sentGramId(r[4]);
      var wid = sentFindWid(r[0], r[5]);
      SENTENCES.push({
        id: "sa" + (SentA1.seq++), de: r[0], ar: r[1], pron: "",
        kap: r[2], level: "A1", topic: r[3], gram: gid,
        gramTitle: gid ? null : r[4], wid: wid || null,
        w: (r[5] || "").split("|")[0] || null, src: "bank"
      });
      nB++;
    });
    /* 3) backfill للجمل القديمة: موضوع + ربط كلمة */
    SENTENCES.forEach(function (s) {
      if (!s.topic) s.topic = sentAutoTopic(s.de, s.kap);
      if (!s.wid && !s.src) { s.wid = sentFindWid(s.de, null); s.src = "core"; }
      if (!s.level) s.level = "A1";
    });
    SentA1.stats.vocabEx += nV;
    SentA1.stats.bank += nB;
    SentA1.stats.dup += nD;
    /* إحصاءات الربط */
    try {
      var wset = {}, gset = {}, kset = {};
      SENTENCES.forEach(function (s) {
        if (s.wid) wset[s.wid] = 1;
        if (s.gram) gset[s.gram] = 1;
        if (s.kap) kset[s.kap] = 1;
      });
      SentA1.stats.linkedWords = Object.keys(wset).length;
      SentA1.stats.gramCovered = Object.keys(gset).length;
      SentA1.stats.kapCovered = Object.keys(kset).length;
      var totalW = allWords().filter(function (w) { return (w.level || "A1") === "A1"; }).length;
      SentA1.stats.unlinked = Math.max(0, totalW - SentA1.stats.linkedWords);
      SentA1.stats.totalWords = totalW;
    } catch (e) {}
    SentA1.merged = true;
  } catch (e) { if (window.console) console.error("sent-a1 merge", e); }
  return SentA1.stats;
}

/* تقرير الجودة والتدقيق */
window.SentAudit = function () {
  sentA1Merge();
  var rep = {
    before: SentA1.stats.before, after: 0, vocabEx: SentA1.stats.vocabEx,
    bank: SentA1.stats.bank, dupRejected: SentA1.stats.dup,
    linkedWords: SentA1.stats.linkedWords, unlinkedWords: SentA1.stats.unlinked,
    totalWordsA1: SentA1.stats.totalWords || 0,
    gramCovered: SentA1.stats.gramCovered, kapCovered: 0,
    empty: 0, brokenWid: 0, brokenGram: 0, brokenKap: 0, dupFound: 0
  };
  try {
    rep.after = SENTENCES.length;
    var seen = {}, kaps = {};
    SENTENCES.forEach(function (s) {
      if (!s.de || !s.ar) rep.empty++;
      var k = sentKey(s.de);
      if (seen[k]) rep.dupFound++; else seen[k] = 1;
      if (s.wid && typeof wordById === "function" && !wordById(s.wid)) rep.brokenWid++;
      if (s.gram && !GRAMMAR.some(function (g) { return g.id === s.gram; })) rep.brokenGram++;
      if (s.kap && typeof KAPITEL !== "undefined" && !KAPITEL.some(function (x) { return x.id === s.kap; })) rep.brokenKap++;
      if (s.kap) kaps[s.kap] = 1;
    });
    rep.kapCovered = Object.keys(kaps).length;
    rep.kaps = Object.keys(kaps).sort();
  } catch (e) { rep.error = String(e); }
  return rep;
};

/* ================= PART 5: العرض + الفلاتر + Pagination (إضافي، لا يكسر) ================= */
var sentA1Limit = 80;
var SENT_A1_PAGE = 80;

function sentA1TopicLabel(t) {
  try { if (typeof CAT_AR !== "undefined" && CAT_AR[t]) return t + " • " + CAT_AR[t]; } catch (e) {}
  return t;
}
/* حقن فلتر الموضوع + عدّاد — مرة واحدة فقط */
function sentA1InjectUI() {
  try {
    var search = document.getElementById("sentenceSearch");
    if (!search) return;
    if (!document.getElementById("sentenceTopic")) {
      var sel = document.createElement("select");
      sel.id = "sentenceTopic";
      var topics = {};
      try {
        SENTENCES.forEach(function (s) { if (s.topic) topics[s.topic] = 1; });
        (typeof CATEGORIES !== "undefined" ? CATEGORIES : []).forEach(function (c) { topics[c] = topics[c] || 0; });
      } catch (e) {}
      var names = Object.keys(topics).sort();
      sel.innerHTML = '<option value="">كل الموضوعات</option>' + names.map(function (t) {
        return '<option value="' + t + '">' + sentA1TopicLabel(t) + '</option>';
      }).join("");
      sel.addEventListener("change", function () { sentA1Limit = SENT_A1_PAGE; sentA1Render(); });
      search.parentNode.insertBefore(sel, search);
    }
    if (!document.getElementById("sentCount")) {
      var pill = document.createElement("span");
      pill.id = "sentCount";
      pill.className = "count-pill";
      pill.style.cssText = "white-space:nowrap";
      var head = document.querySelector("#page-sentences .page-head h2");
      if (head) head.appendChild(pill);
    }
  } catch (e) { if (window.console) console.error("sent-a1 ui", e); }
}

function sentA1Card(s, i) {
  var d = document.createElement("div");
  d.className = "sent-card glass";
  var pron = s.pron ? '<div class="sent-pron">🔊 ' + escapeHtml(s.pron) + '</div>' : '';
  var tags = '<span class="tag kap-tag">' + escapeHtml(typeof kapName === "function" ? kapName(s.kap) : (s.kap || "")) + '</span>'
    + ' <span class="tag">' + escapeHtml(s.level || "A1") + '</span>';
  if (s.topic) tags += ' <span class="tag">' + escapeHtml(sentA1TopicLabel(s.topic)) + '</span>';
  var link = "";
  try {
    if (s.wid && typeof wordById === "function") {
      var w = wordById(s.wid);
      if (w) link = '<div class="muted">🔗 ' + escapeHtml((w.art && w.art !== "-" ? w.art + " " : "") + w.de) + ' = ' + escapeHtml(w.ar) + '</div>';
    }
  } catch (e) {}
  d.innerHTML = '<div class="sent-num">' + (i + 1) + '</div><div style="flex:1"><div class="sent-de">'
    + escapeHtml(s.de) + '</div><div class="sent-ar">' + escapeHtml(s.ar) + '</div>'
    + pron + link + '<div>' + tags + '</div></div><button class="icon-btn" title="استماع">🔊</button>';
  d.querySelector("button").addEventListener("click", function () {
    try { speak(s.de); } catch (e) {}
    try { if (typeof markStudyDay === "function") markStudyDay(false); } catch (x) {}
  });
  return d;
}

/* العارض الموحد: يحترم المستوى + Kapitel + الموضوع + البحث، مع Pagination */
function sentA1Render() {
  try {
    sentA1Merge();
    sentA1InjectUI();
    var box = document.getElementById("sentList");
    if (!box) return;
    var raw = (document.getElementById("sentenceSearch").value || "");
    var q = (typeof dmNorm === "function" ? dmNorm(raw) : raw.toLowerCase()).trim();
    var qAr = raw.trim().toLowerCase();
    var k = document.getElementById("sentenceKapitel") ? document.getElementById("sentenceKapitel").value : "";
    var tp = document.getElementById("sentenceTopic") ? document.getElementById("sentenceTopic").value : "";
    var lv = (typeof window.currSentLevel !== "undefined" ? window.currSentLevel : "all") || "all";
    if (lv !== "all" && typeof Curriculum !== "undefined" && !Curriculum.loaded[lv]) {
      Curriculum.ensure(lv, function () { sentA1Render(); });
      box.innerHTML = '<div class="panel glass">⏳ جاري تحميل محتوى ' + lv + ' ...</div>';
      return;
    }
    var list = SENTENCES.filter(function (s) {
      if (lv !== "all" && (s.level || "A1") !== lv) return false;
      if (k && s.kap !== k) return false;
      if (tp && (s.topic || "General") !== tp) return false;
      if (!q) return true;
      var de = (typeof dmNorm === "function" ? dmNorm(s.de) : s.de.toLowerCase());
      if (de.indexOf(q) >= 0) return true;
      if ((s.ar || "").toLowerCase().indexOf(qAr) >= 0) return true;
      try {
        if (s.wid && typeof wordById === "function") {
          var w = wordById(s.wid);
          if (w && ((w.de || "").toLowerCase().indexOf(qAr) >= 0 || (w.ar || "").indexOf(raw.trim()) >= 0)) return true;
        }
      } catch (e) {}
      return false;
    });
    try {
      var pill = document.getElementById("sentCount");
      if (pill) pill.textContent = list.length + " جملة";
    } catch (e) {}
    box.innerHTML = "";
    if (!list.length) { box.innerHTML = '<div class="panel glass">لا توجد جمل هنا بعد.</div>'; return; }
    var shown = list.slice(0, sentA1Limit);
    shown.forEach(function (s, i) { box.appendChild(sentA1Card(s, i)); });
    if (list.length > sentA1Limit) {
      var b = document.createElement("button");
      b.className = "btn btn-ghost";
      b.style.display = "block"; b.style.margin = "12px auto";
      b.textContent = "عرض المزيد (" + (list.length - sentA1Limit) + " ⬇)";
      b.addEventListener("click", function () { sentA1Limit += SENT_A1_PAGE; try { sentA1Render(); } catch (e) {} });
      box.appendChild(b);
    }
  } catch (e) { if (window.console) console.error("sent-a1 render", e); }
}

/* استبدال العارضين القديمين بالموحد (نفس الأسماء — المستمعات القديمة تعمل) */
try { renderSentences = sentA1Render; } catch (e) {}
try { currApplySentFilter = sentA1Render; } catch (e) {}
try {
  ["sentenceSearch", "sentenceKapitel"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el.dataset.sentA1) {
      el.dataset.sentA1 = "1";
      el.addEventListener("input", function () { sentA1Limit = SENT_A1_PAGE; setTimeout(sentA1Render, 60); });
      el.addEventListener("change", function () { sentA1Limit = SENT_A1_PAGE; setTimeout(sentA1Render, 60); });
    }
  });
} catch (e) {}
/* دمج عند فتح الصفحة (يلتقط كلمات A1X/A2 المضافة لاحقًا) + نفس نمط showPage-wrap */
try {
  var _sentA1SP = showPage;
  showPage = function (n) {
    _sentA1SP(n);
    try { if (n === "sentences") sentA1Render(); } catch (e) { if (window.console) console.error(e); }
  };
} catch (e) {}
try { sentA1Merge(); } catch (e) {}
