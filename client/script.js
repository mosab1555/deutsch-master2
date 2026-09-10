/* Deutsch Master - App Logic (Vanilla JS) */
"use strict";

/* ============ DATA ============ */
const CATEGORIES = ["Family","Food","Drinks","Home","School","University","Work","Travel","Shopping","Body","Time","Days","Months","Numbers","Colors","Animals","Clothes","Languages","General","Common Verbs","Adjectives"];
const CAT_AR = {Family:"العائلة",Food:"الطعام",Drinks:"المشروبات",Home:"البيت",School:"المدرسة",University:"الجامعة",Work:"العمل",Travel:"السفر",Shopping:"التسوق",Body:"الجسم",Time:"الوقت",Days:"الأيام",Months:"الشهور",Numbers:"الأرقام",Colors:"الألوان",Animals:"الحيوانات",Clothes:"الملابس",Languages:"اللغات",General:"عام","Common Verbs":"أفعال شائعة",Adjectives:"صفات"};

/* ============================================================
   بيانات الكلمات من صورك - مقسمة لكل Kapitel
   الصيغة: [الكلمة, الأداة, المعنى, النطق, النوع, التصنيف, (مثال), (ترجمته)]
   المثال يُولّد تلقائيًا حسب النوع لو لم يُكتب
   ============================================================ */
const RAW_K0 = [
["Freund","der","الصديق","فرويند","اسم","General"],
["Straße","die","الشارع","شتراسه","اسم","Travel"],
["Land","das","البلد","لانت","اسم","Travel"],
["Arbeiter","der","العامل","أربايتر","اسم","Work"],
["Information","die","المعلومة","إنفورماتسيون","اسم","School"],
["Mädchen","das","الفتاة","ميتشن","اسم","Family"],
["Name","der","الاسم","نامه","اسم","School"],
["Karte","die","الكارت","كارته","اسم","Travel"],
["Bus","der","الأتوبيس","بوس","اسم","Travel"],
["Klub","der","النادي","كلوب","اسم","School"],
["Kurs","der","الكورس","كورس","اسم","School"],
["Krokodil","das","التمساح","كروكوديل","اسم","Animals"],
["Wolf","der","الذئب","فولف","اسم","Animals"],
["Thema","das","الموضوع","تيما","اسم","School"],
["Läufer","der","العدّاء","لويفر","اسم","Work"],
["Tür","die","الباب","تور","اسم","Home"],
["Mann","der","الرجل","مان","اسم","Family"],
["Wort","das","الكلمة","فورت","اسم","School"],
["Apfel","der","التفاحة","أبفل","اسم","Food"],
["Kollege","der","الزميل","كوليجه","اسم","Work"],
["Tomate","die","الطماطم","توماته","اسم","Food"],
["Student","der","الطالب","شتودنت","اسم","University"],
["Schule","die","المدرسة","شوله","اسم","School"],
["Buch","das","الكتاب","بوخ","اسم","School"],
["Räuber","der","السارق","رويبر","اسم","General"],
["Bett","das","السرير","بت","اسم","Home"],
["Öl","das","الزيت","أول","اسم","Food"],
["Morgen","der","الصباح","مورجن","اسم","Time"],
["allein","-","وحيد","ألاين","صفة","Adjectives","Ich bin allein.","أنا وحيد."],
["äußerlich","-","خارجي","أوسرليش","صفة","Adjectives","Er ist äußerlich ruhig.","هو هادئ ظاهريًا."]
];
const RAW_K1 = [
["kommen","-","يأتي","كومن","فعل","Common Verbs","Er kommt morgen.","هو يأتي غدًا."],
["fragen","-","يسأل","فراجن","فعل","Common Verbs","Er fragt mich.","هو يسألني."],
["leben","-","يعيش","ليبن","فعل","Common Verbs","Er lebt in England.","هو يعيش في إنجلترا."],
["lieben","-","يحب","ليبن","فعل","Common Verbs","Ich liebe dich.","أنا أحبك."],
["hören","-","يسمع","هورن","فعل","Common Verbs","Wir hören gut.","نحن نسمع جيدًا."],
["wohnen","-","يسكن","فونن","فعل","Common Verbs","Ich wohne in Frankfurt.","أنا أسكن في فرانكفورت."],
["sein","-","يكون","زاين","فعل","Common Verbs","Ich bin Mohammad.","أنا محمد."],
["haben","-","يمتلك","هابن","فعل","Common Verbs","Ich habe einen Laptop.","لدي لابتوب."],
["sprechen","-","يتحدث","شبريشن","فعل","Common Verbs","Ich spreche Deutsch.","أنا أتحدث الألمانية."],
["sehen","-","يرى","زين","فعل","Common Verbs","Ich sehe dich.","أنا أراك."],
["buchstabieren","-","يتهجى","بوخشتابيرن","فعل","Common Verbs","Ich buchstabiere meinen Namen.","أنا أتهجى اسمي."],
["ergänzen","-","يُكمل","إرجينتسن","فعل","Common Verbs","Er ergänzt den Text.","هو يُكمل النص."],
["gehen","-","يذهب","جين","فعل","Common Verbs","Ich gehe nach Hause.","أنا أذهب إلى البيت."],
["grüßen","-","يُحيي","جروسن","فعل","Common Verbs","Ich grüße dich.","أنا أحييك."],
["heißen","-","يُسمى","هايسن","فعل","Common Verbs","Ich heiße Niklas.","اسمي نيكلاس."],
["kennen","-","يعرف","كنن","فعل","Common Verbs","Ich kenne ihn.","أنا أعرفه."],
["lernen","-","يتعلم","ليرنن","فعل","Common Verbs","Ich lerne Deutsch.","أنا أتعلم الألمانية."],
["lesen","-","يقرأ","ليزن","فعل","Common Verbs","Ich lese ein Buch.","أنا أقرأ كتابًا."],
["machen","-","يفعل / يصنع","ماخن","فعل","Common Verbs","Ich mache Hausaufgaben.","أنا أعمل الواجب المنزلي."],
["reagieren","-","يرد / يتفاعل","رياجيرن","فعل","Common Verbs","Er reagiert schnell.","هو يرد بسرعة."],
["sagen","-","يقول","زاجن","فعل","Common Verbs","Er sagt Hallo.","هو يقول مرحبًا."],
["schreiben","-","يكتب","شرايبن","فعل","Common Verbs","Ich schreibe einen Brief.","أنا أكتب رسالة."],
["spielen","-","يلعب","شبيلن","فعل","Common Verbs","Er spielt Fußball.","هو يلعب كرة القدم."],
["variieren","-","يُغيّر","فريرن","فعل","Common Verbs","Er variiert die Übung.","هو يُغيّر التمرين."],
["verabschieden","-","يُودّع","فيرأبشيدن","فعل","Common Verbs","Ich verabschiede mich.","أنا أودع."],
["verstehen","-","يفهم","فيرشتين","فعل","Common Verbs","Ich verstehe das nicht.","أنا لا أفهم هذا."],
["zuordnen","-","يُرتّب","تسو أوردنن","فعل","Common Verbs","Ich ordne die Wörter zu.","أنا أرتب الكلمات."],
["Befinden","das","الحال","بفيندن","اسم","General"],
["Butterbrot","das","ساندوتش الزبدة","بوتربروت","اسم","Food"],
["Gespräch","das","المحادثة","جشبريش","اسم","School"],
["Handtuch","das","الفوطة","هانتوخ","اسم","Home"],
["Interview","das","المقابلة","إنترفيو","اسم","Work"],
["Kursplakat","das","ملصق الكورس","كورس بلاكات","اسم","School"],
["Redemittel","das","طريقة الحديث","ريده متل","اسم","School"],
["Telefon","das","التليفون","تيليفون","اسم","Home"],
["Verb","das","الفعل","فيرب","اسم","School"],
["Würstchen","das","السجق الصغير","فورستشن","اسم","Food"],
["Würstel","das","النقانق النمساوية","فورستل","اسم","Food"],
["W-Wort","das","أداة الاستفهام","فيه فورت","اسم","School"],
["Dialog","der","المحادثة","ديالوج","اسم","School"],
["Kindergarten","der","الحضانة","كندر جارتن","اسم","School"],
["Koffer","der","حقيبة السفر","كوفر","اسم","Travel"],
["Nachname","der","اسم العائلة","ناخ نامه","اسم","Family"],
["Punkt","der","النقطة","بونكت","اسم","School"],
["Reiseführer","der","المرشد السياحي","رايزه فورر","اسم","Travel"],
["Text","der","النص","تكست","اسم","School"],
["Unterstrich","der","شرطة سفلية","أونتر شتريش","اسم","School"],
["Vorname","der","الاسم الأول","فور نامه","اسم","Family"],
["Kranke","der","المريض","كرانكه","اسم","General"],
["Antwort","die","الإجابة","أنتفورت","اسم","School"],
["Autobahn","die","الطريق السريع","أوتوبان","اسم","Travel"],
["E-Mail-Adresse","die","البريد الإلكتروني","إيميل أدرسه","اسم","School"],
["Entschuldigung","die","المعذرة","إنتشولديجونج","اسم","General"],
["Flasche","die","الزجاجة","فلاشه","اسم","Home"],
["Nudel","die","المكرونة","نودل","اسم","Food"],
["Person","die","الشخص","بيرزون","اسم","General"],
["Reiseführerin","die","المرشدة السياحية","رايزه فوررين","اسم","Travel"],
["Situation","die","الموقف","زيتواتسيون","اسم","General"],
["Sprache","die","اللغة","شبراخه","اسم","Languages"],
["Stadt","die","المدينة","شتات","اسم","Travel"],
["Universität","die","الجامعة","أونيفيرزيتيت","اسم","University"],
["Tabelle","die","الجدول","تابله","اسم","School"],
["Herkunft","die","الموطن","هيركونفت","اسم","Travel"],
["Österreich","-","النمسا","أوسترايش","اسم","Travel"],
["Frankreich","-","فرنسا","فرانكرايش","اسم","Travel"],
["Griechenland","-","اليونان","جريشن لانت","اسم","Travel"],
["Finnland","-","فنلندا","فنلانت","اسم","Travel"],
["Algerien","-","الجزائر","ألجيرين","اسم","Travel"],
["Brasilien","-","البرازيل","برازيلين","اسم","Travel"],
["Deutschland","-","ألمانيا","دويتش لانت","اسم","Travel"],
["Italien","-","إيطاليا","إتالين","اسم","Travel"],
["Japan","-","اليابان","يابان","اسم","Travel"],
["Marokko","-","المغرب","ماروكو","اسم","Travel"],
["Mexiko","-","المكسيك","ميكسيكو","اسم","Travel"],
["Polen","-","بولندا","بولن","اسم","Travel"],
["Portugal","-","البرتغال","بور/forتوغال","اسم","Travel"],
["Russland","-","روسيا","روسلانت","اسم","Travel"],
["Spanien","-","إسبانيا","شبانيِن","اسم","Travel"],
["Thailand","-","تايلاند","تايلانت","اسم","Travel"],
["Schweiz","die","سويسرا","شفايتز","اسم","Travel"],
["Türkei","die","تركيا","توركاي","اسم","Travel"],
["Ukraine","die","أوكرانيا","أوكراينه","اسم","Travel"],
["USA","die","أمريكا","أو إس آي","اسم","Travel","Ich komme aus den USA.","أنا من أمريكا."],
["Arabisch","-","العربية","أرابش","اسم","Languages"],
["Bulgarisch","-","البلغارية","بولجاريش","اسم","Languages"],
["Deutsch","-","الألمانية","دويتش","اسم","Languages"],
["Englisch","-","الإنجليزية","إنجليش","اسم","Languages"],
["Französisch","-","الفرنسية","فرانتسوزش","اسم","Languages"],
["Indonesisch","-","الإندونيسية","إندونيزِش","اسم","Languages"],
["Italienisch","-","الإيطالية","إتالينِش","اسم","Languages"],
["Japanisch","-","اليابانية","يابانِش","اسم","Languages"],
["Polnisch","-","البولندية","بولنِش","اسم","Languages"],
["Portugiesisch","-","البرتغالية","بورتوجيزِش","اسم","Languages"],
["Rätoromanisch","-","الرومانية القديمة","ريتورومانِش","اسم","Languages"],
["Russisch","-","الروسية","روسِش","اسم","Languages"],
["Serbisch","-","الصربية","زيربِش","اسم","Languages"],
["Spanisch","-","الإسبانية","شبانيش","اسم","Languages"],
["Türkisch","-","التركية","توركِش","اسم","Languages"],
["Ungarisch","-","المجرية","أونجاريش","اسم","Languages"],
["Griechisch","-","اليونانية","جريخِش","اسم","Languages"],
["Finnisch","-","الفنلندية","فنِش","اسم","Languages"],
["null","-","صفر (0)","نول","مفردات","Numbers"],
["eins","-","واحد (1)","آينس","مفردات","Numbers","Ich habe einen Apfel.","لدي تفاحة واحدة."],
["zwei","-","اثنان (2)","تسفاي","مفردات","Numbers"],
["drei","-","ثلاثة (3)","دراي","مفردات","Numbers"],
["vier","-","أربعة (4)","فير","مفردات","Numbers"],
["fünf","-","خمسة (5)","فونف","مفردات","Numbers"],
["sechs","-","ستة (6)","زكس","مفردات","Numbers"],
["sieben","-","سبعة (7)","زيبن","مفردات","Numbers"],
["acht","-","ثمانية (8)","أخت","مفردات","Numbers"],
["neun","-","تسعة (9)","نوين","مفردات","Numbers"],
["zehn","-","عشرة (10)","تسين","مفردات","Numbers"],
["elf","-","أحد عشر (11)","إلف","مفردات","Numbers"],
["zwölf","-","اثنا عشر (12)","تسفولف","مفردات","Numbers"],
["dreizehn","-","ثلاثة عشر (13)","دراي تسين","مفردات","Numbers"],
["vierzehn","-","أربعة عشر (14)","فير تسين","مفردات","Numbers"],
["fünfzehn","-","خمسة عشر (15)","فونف تسين","مفردات","Numbers"],
["sechzehn","-","ستة عشر (16)","زختسين","مفردات","Numbers"],
["siebzehn","-","سبعة عشر (17)","زيب تسين","مفردات","Numbers"],
["achtzehn","-","ثمانية عشر (18)","أخت تسين","مفردات","Numbers"],
["neunzehn","-","تسعة عشر (19)","نوين تسين","مفردات","Numbers"],
["zwanzig","-","عشرون (20)","تسفانتسيش","مفردات","Numbers"],
["hundert","-","مائة","هوندرت","مفردات","Numbers"],
["tausend","-","ألف","تاوزنت","مفردات","Numbers"],
["Telefonnummer","die","رقم التليفون","تيليفون نومر","اسم","Home"],
["Handynummer","die","رقم الموبايل","هاندي نومر","اسم","Home"],
["Frau","die","السيدة","فراو","اسم","Family"],
["Wörter","die","كلمات الدرس","فورتر","اسم","School","Die Wörter sind neu.","كلمات الدرس جديدة."],
["Kursbuch","das","كتاب الكورس","كورس بوخ","اسم","School"],
["Übungsbuch","das","كتاب التمرينات","أوبونجس بوخ","اسم","School"],
["Testheft","das","كتيب الامتحانات","تست هفت","اسم","School"],
["Aufsatz","der","البرجراف","أوف زاتز","اسم","School"],
["offiziell","-","رسمي","أوفيتسيِل","صفة","Adjectives"],
["inoffiziell","-","غير رسمي","إن أوفيتسيِل","صفة","Adjectives"],
["bekannt","-","معروف","بكانت","صفة","Adjectives"],
["deutsch","-","ألماني","دويتش","صفة","Adjectives"],
["formell","-","رسمي","فورمِل","صفة","Adjectives"],
["informell","-","غير رسمي","إن فورمِل","صفة","Adjectives"],
["international","-","عالمي","إنترناتسيونال","صفة","Adjectives"],
["kurz","-","قصير","كورتس","صفة","Adjectives"],
["Portugiese","-","برتغالي","بورتوجيزه","صفة","Adjectives"],
["ich","-","أنا","إش","ضمير","General","Ich bin Schüler.","أنا تلميذ."],
["man","-","المرء","مان","ضمير","General","Man lernt Deutsch.","المرء يتعلم الألمانية."],
["das","-","هذا / هذه","داس","ضمير","General","Das ist Ali.","هذا علي."],
["ander-","-","آخر","أندر","مفردات","General","Ein anderes Mal.","مرة أخرى."],
["auch","-","أيضًا","أوخ","مفردات","General","Ich wohne auch in Berlin.","أنا أسكن في برلين أيضًا."],
["aus","-","من","أوس","أداة","General","Ich komme aus Ägypten.","أنا من مصر."],
["bitte","-","من فضلك / عفوًا","بته","مفردات","General","Ein bisschen langsamer, bitte.","أبطأ قليلًا من فضلك."],
["danke","-","شكرًا","دانكه","مفردات","General","Danke, gut.","شكرًا، بخير."],
["ein bisschen","-","قليلًا","آين بسشن","مفردات","General","Ich spreche ein bisschen Deutsch.","أتحدث القليل من الألمانية."],
["ganz","-","تمامًا","جانتس","مفردات","General","Ganz gut, danke.","بخير تمامًا، شكرًا."],
["in","-","في","إن","أداة","General","Ich bin in Berlin.","أنا في برلين."],
["nicht","-","لا / أداة نفي","نيشت","أداة","General","Ich komme heute nicht.","لن آتي اليوم."],
["noch einmal","-","مرة أخرى","نوخ آينمال","مفردات","General","Noch einmal, bitte.","مرة أخرى من فضلك."],
["oder","-","أو","أودر","أداة","General","Tee oder Kaffee?","شاي أم قهوة؟"],
["sehr","-","جدًا","زير","مفردات","General","Danke, sehr gut.","شكرًا، بخير جدًا."],
["und","-","و","أونت","أداة","General","Brot und Milch.","خبز وحليب."],
["zu","-","إلى","تسو","أداة","General","Zu Hause.","في البيت."],
["zu zweit","-","كل اثنين معًا","تسو تسفايت","مفردات","General","Wir lernen zu zweit.","نتعلم كل اثنين معًا."],
["auf Deutsch","-","بالألمانية","أوف دويتش","مفردات","Languages","Ich spreche auf Deutsch.","أنا أتحدث بالألمانية."],
["was","-","ماذا","فاس","أداة","General","Was sprechen Sie?","ماذا تتحدث؟"],
["wer","-","مَن","فير","أداة","General","Wer ist das?","من هذا؟"],
["wie","-","كيف","في","أداة","General","Wie geht's?","كيف الحال؟"],
["wo","-","أين","فو","أداة","General","Wo wohnen Sie?","أين تسكن؟"],
["woher","-","من أين","فوهير","أداة","General","Woher kommen Sie?","من أين أنت؟"],
["welch-","-","أي","فلش","أداة","General","Welche Sprachen sprechen Sie?","أي لغات تتحدث؟"]
];

const RAW_K2 = [
["achten","-","يُراعي / يلاحظ","أختن","فعل","Common Verbs","Er achtet auf die Regel.","هو يراعي القاعدة."],
["ankreuzen","-","يضع علامة ✓","آن كرويتسن","فعل","Common Verbs","Ich kreuze die Antwort an.","أضع علامة على الإجابة."],
["ansehen","-","يُشاهد","آن زين","فعل","Common Verbs","Ich sehe den Film an.","أنا أشاهد الفيلم."],
["antworten","-","يُجيب","أنتفورتن","فعل","Common Verbs","Ich antworte dir.","أنا أجيبك."],
["arbeiten","-","يعمل","أربايتن","فعل","Common Verbs","Mein Freund arbeitet von 6 bis 9 Uhr.","صديقي يعمل من 6 إلى 9."],
["berichten","-","يُخبر / يحكي","بريشتن","فعل","Common Verbs","Er berichtet über Berlin.","هو يحكي عن برلين."],
["fahren","-","يسافر / يقود","فارن","فعل","Common Verbs","Ich fahre nach Kairo.","أنا أسافر إلى القاهرة."],
["fotografieren","-","يُصور","فوتوجرافيرن","فعل","Common Verbs","Er fotografiert die Stadt.","هو يُصور المدينة."],
["freihaben","-","يأخذ راحة","فراي هابن","فعل","Common Verbs","Ich habe morgen frei.","لدي راحة غدًا."],
["joggen","-","يركض","يوجن","فعل","Common Verbs","Er joggt im Park.","هو يركض في الحديقة."],
["kochen","-","يُطبخ","كوخن","فعل","Common Verbs","Ich koche gern.","أنا أحب الطبخ."],
["markieren","-","يُعلّم على","ماركيرن","فعل","Common Verbs","Ich markiere das Wort.","أنا أُعلّم على الكلمة."],
["merken","-","يُلاحظ","ميركن","فعل","Common Verbs","Ich merke das.","أنا أُلاحظ هذا."],
["nachsprechen","-","يُردد خلف","ناخ شبريشن","فعل","Common Verbs","Sprich bitte nach!","ردد من فضلك!"],
["nennen","-","يذكر / يُسمي","ننن","فعل","Common Verbs","Er nennt seinen Namen.","هو يذكر اسمه."],
["passen","-","يُناسب","باسن","فعل","Common Verbs","Das passt gut.","هذا يُناسب جيدًا."],
["präsentieren","-","يعرض","بريزنتيرن","فعل","Common Verbs","Er präsentiert das Projekt.","هو يعرض المشروع."],
["reisen","-","يُسافر","رايزن","فعل","Common Verbs","Ich reise gern.","أنا أحب السفر."],
["schwimmen","-","يسبح","شفمن","فعل","Common Verbs","Er schwimmt gut.","هو يسبح جيدًا."],
["singen","-","يُغني","زنجن","فعل","Common Verbs","Sie singt schön.","هي تُغني بشكل جميل."],
["stehen","-","يقف","شتين","فعل","Common Verbs","Er steht hier.","هو يقف هنا."],
["studieren","-","يدرس (جامعة)","شتوديرن","فعل","Common Verbs","Ich studiere Medizin.","أنا أدرس الطب."],
["suchen","-","يبحث عن","زوخن","فعل","Common Verbs","Ich suche mein Buch.","أنا أبحث عن كتابي."],
["tanzen","-","يرقص","تانتسن","فعل","Common Verbs","Sie tanzt gern.","هي تحب الرقص."],
["tauschen","-","يتبادل","تاوشن","فعل","Common Verbs","Wir tauschen die Bücher.","نتبادل الكتب."],
["unterstreichen","-","يضع خطًا تحت","أونتر شترايشن","فعل","Common Verbs","Ich unterstreiche das Wort.","أضع خطًا تحت الكلمة."],
["sich verabreden","-","يتفق على موعد","فيرأبريدن","فعل","Common Verbs","Wir haben einen Termin vereinbart.","اتفقنا على موعد."],
["vergleichen","-","يُقارن","فيرجلايشن","فعل","Common Verbs","Er vergleicht die Preise.","هو يُقارن الأسعار."],
["wählen","-","يختار","فيلن","فعل","Common Verbs","Ich wähle die Antwort.","أنا أختار الإجابة."],
["warten","-","ينتظر","فارتن","فعل","Common Verbs","Ich warte hier.","أنا أنتظر هنا."],
["zusammenpassen","-","يتناسب","تسوزامن باسن","فعل","Common Verbs","Das passt zusammen.","هذا يتناسب معًا."],
["es gibt","-","يوجد","إس جيبت","فعل","Common Verbs","Es gibt viele Wörter.","يوجد كلمات كثيرة."],
["eine Frage stellen","-","يطرح سؤالًا","آينه فراجه شتِلن","فعل","Common Verbs","Ich stelle eine Frage.","أنا أطرح سؤالًا."],
["Auto","das","السيارة","أوتو","اسم","Travel"],
["Beispiel","das","المثال","باي شبيل","اسم","School"],
["Café","das","المقهى","كافيه","اسم","Food"],
["Formular","das","الاستمارة","فورمولار","اسم","School"],
["Foto","das","الصورة","فوتو","اسم","General"],
["Geburtsdatum","das","تاريخ الميلاد","جيبورتس داتوم","اسم","General"],
["Geld","das","المال","جلت","اسم","Shopping"],
["Glas","das","الكوب / الزجاج","جلاس","اسم","Home"],
["Hobby","das","الهواية","هوبي","اسم","General"],
["Jahr","das","العام","يار","اسم","Time"],
["Kapitel","das","الفصل (في كتاب)","كابيتل","اسم","School"],
["Kino","das","السينما","كينو","اسم","General"],
["Krankenhaus","das","المستشفى","كرانكن هاوس","اسم","General"],
["Medikament","das","الدواء","ميديكامنت","اسم","General"],
["Museum","das","المتحف","موزيوم","اسم","Travel"],
["Restaurant","das","المطعم","رستوران","اسم","Food"],
["Schwimmbad","das","حمام السباحة","شفمبات","اسم","General"],
["Seminar","das","الحلقة الدراسية","زيمينار","اسم","University"],
["Stadion","das","الإستاد","شتاديون","اسم","General"],
["Taxi","das","التاكسي","تاكسي","اسم","Travel"],
["Theater","das","المسرح","تياتر","اسم","General"],
["Wochenende","das","نهاية الأسبوع","فوخن إنده","اسم","Time"],
["Wörterbuch","das","القاموس","فورتر بوخ","اسم","School"],
["Zimmer","das","الحجرة","تسيمر","اسم","Home"],
["Abend","der","المساء","آبنت","اسم","Time"],
["Beruf","der","المهنة","بيروف","اسم","Work"],
["Club","der","النادي","كلوب","اسم","General"],
["Familienname","der","اسم العائلة","فاميليِن نامه","اسم","Family"],
["Geburtsort","der","مكان الميلاد","جيبورتس أورت","اسم","General"],
["Kollege","der","الزميل","كوليجه","اسم","Work"],
["Kommentar","der","التعليق","كومنتار","اسم","School"],
["Kursraum","der","قاعة الدراسة","كورس راوم","اسم","School"],
["Lernwortschatz","der","المفردات اللغوية","ليرن فورت شاتز","اسم","School"],
["Moment","der","اللحظة","مومنت","اسم","Time"],
["Nachmittag","der","بعد الظهر","ناخ متاج","اسم","Time"],
["Patient","der","المريض","باتسيِنت","اسم","General"],
["Platz","der","المكان","بلاتز","اسم","General"],
["Schlüssel","der","المفتاح","شلوسل","اسم","Home"],
["Sportclub","der","النادي الرياضي","شبورت كلوب","اسم","General"],
["Stift","der","القلم الجاف","شتيفت","اسم","School"],
["Tag","der","اليوم","تاج","اسم","Time"],
["Termin","der","الموعد","تيرمين","اسم","General"],
["Wochentag","der","يوم الأسبوع","فوخن تاج","اسم","Days"],
["Wohnort","der","محل الإقامة","فون أورت","اسم","Home"],
["Sport","der","الرياضة","شبورت","اسم","General"],
["Arzt","der","الطبيب","آرتست","اسم","Work"],
["Koch","der","الطباخ","كوخ","اسم","Work"],
["Architekt","der","المهندس المعماري","أرخيتكت","اسم","Work"],
["Elektriker","der","فني الكهرباء","إليكتريكر","اسم","Work"],
["Erzieher","der","المربي","إرتسيِر","اسم","Work"],
["Friseur","der","الحلاق","فريزور","اسم","Work"],
["Handwerker","der","العامل اليدوي","هانت فيركر","اسم","Work"],
["Informatiker","der","متخصص الحاسوب","إنفورماتيكر","اسم","Work"],
["Ingenieur","der","المهندس","إنجينيور","اسم","Work"],
["Journalist","der","الصحفي","يورنالست","اسم","Work"],
["Jurist","der","القانوني","يورست","اسم","Work"],
["Kellner","der","الجرسون","كلنر","اسم","Work"],
["Krankenpfleger","der","الممرض","كرانكن فليجر","اسم","Work"],
["Lehrer","der","المعلم","ليرر","اسم","School"],
["Mechaniker","der","الميكانيكي","ميشانيكر","اسم","Work"],
["Polizist","der","الشرطي","بوليتسست","اسم","Work"],
["Taxifahrer","der","سائق التاكسي","تاكسي فارر","اسم","Work"],
["Verkäufer","der","البائع","فيركويفر","اسم","Work"],
["Fußball","der","كرة القدم","فوس بال","اسم","General"],
["Basketball","der","كرة السلة","باسكت بال","اسم","General"],
["Yoga","das","اليوجا","يوجا","اسم","General"],
["Karate","das","الكاراتيه","كاراته","اسم","General"],
["Tennis","das","التنس","تنس","اسم","General"],
["Zumba","das","الزومبا","زومبا","اسم","General"],
["Samstag","der","السبت","زامستاج","اسم","Days"],
["Sonntag","der","الأحد","زونتاج","اسم","Days"],
["Montag","der","الاثنين","مونتاج","اسم","Days"],
["Dienstag","der","الثلاثاء","دينستاج","اسم","Days"],
["Mittwoch","der","الأربعاء","متفوخ","اسم","Days"],
["Donnerstag","der","الخميس","دونرستاج","اسم","Days"],
["Freitag","der","الجمعة","فرايتاج","اسم","Days"],
["Frühling","der","الربيع","فرولنج","اسم","Time"],
["Sommer","der","الصيف","زومر","اسم","Time"],
["Herbst","der","الخريف","هيربست","اسم","Time"],
["Winter","der","الشتاء","فينتر","اسم","Time"],
["Januar","-","يناير","يَنوار","مفردات","Months"],
["Februar","-","فبراير","فيبروار","مفردات","Months"],
["März","-","مارس","ميرتس","مفردات","Months"],
["April","-","أبريل","أبريل","مفردات","Months"],
["Mai","-","مايو","ماي","مفردات","Months"],
["Juni","-","يونيو","يوني","مفردات","Months"],
["Juli","-","يوليو","يولي","مفردات","Months"],
["August","-","أغسطس","أوجست","مفردات","Months"],
["September","-","سبتمبر","زبتيمبر","مفردات","Months"],
["Oktober","-","أكتوبر","أوكتوبر","مفردات","Months"],
["November","-","نوفمبر","نوفمبر","مفردات","Months"],
["Dezember","-","ديسمبر","ديتسيمبر","مفردات","Months"],
["Fahrrad","das","الدراجة","فار رات","اسم","Travel"],
["Flugzeug","das","الطائرة","فلوك تسويج","اسم","Travel"],
["Motorrad","das","الدراجة النارية","موتور رات","اسم","Travel"],
["Schiff","das","السفينة","شيف","اسم","Travel"],
["Straßenbahn","die","الترام","شتراسن بان","اسم","Travel"],
["S-Bahn","die","قطار الضواحي","إس بان","اسم","Travel"],
["U-Bahn","die","المترو","أو بان","اسم","Travel"],
["Adresse","die","العنوان","أدرسه","اسم","Home"],
["Angabe","die","البيانات","آنجابه","اسم","General"],
["Anmeldung","die","التسجيل","آن ملدونج","اسم","School"],
["E-Mail","die","الإيميل","إيميل","اسم","School"],
["Farbe","die","اللون","فاربه","اسم","General"],
["Firma","die","الشركة","فيرما","اسم","Work"],
["Form","die","الشكل","فورم","اسم","General"],
["Frage","die","السؤال","فراجه","اسم","School"],
["Freundin","die","الصديقة","فرويندين","اسم","Family"],
["Hausnummer","die","رقم المنزل","هاوس نومر","اسم","Home"],
["Lernkarte","die","البطاقة التعليمية","ليرن كارته","اسم","School"],
["Leute","die","الناس","لويته","اسم","General","Die Leute sind nett.","الناس لطفاء."],
["Möglichkeit","die","الإمكانية","موجليش كايت","اسم","General"],
["Musik","die","الموسيقى","موزيك","اسم","General"],
["Notiz","die","الملاحظة","نوتيتز","اسم","School"],
["Postleitzahl","die","الرقم البريدي","بوست لايت تسال","اسم","Home"],
["Rechnung","die","الفاتورة","ريشنونج","اسم","Shopping"],
["Seite","die","الصفحة","زايته","اسم","School"],
["Sensation","die","خبر مثير","زينزاتسيون","اسم","General"],
["Spaghetti","die","السباجيتي","شباجيتي","اسم","Food","Die Spaghetti sind lecker.","السباجيتي لذيذة."],
["Spritze","die","الحقنة","شبرتسه","اسم","General"],
["Stunde","die","الساعة / الحصة","شتونده","اسم","Time"],
["Tablette","die","قرص الدواء","تابلته","اسم","General"],
["Verabredung","die","الاتفاق على موعد","فيرأبريدونج","اسم","General"],
["Woche","die","الأسبوع","فوخه","اسم","Time"],
["Zeichnung","die","الرسم","تسايشنونج","اسم","School"],
["Million","die","المليون","ميليون","اسم","Numbers"],
["Milliarde","die","المليار","ميليارده","اسم","Numbers"],
["Satzmelodie","die","نغمة الجملة","زاتز ميلودي","اسم","School"],
["Endung","die","النهاية","إندونج","اسم","School"],
["Kollegin","die","الزميلة","كوليجِن","اسم","Work"],
["Artikelbild","das","شكل الأداة","أرتيكل بلت","اسم","School"],
["ab","-","ابتداءً من","آب","أداة","General","Ab Montag.","ابتداءً من الاثنين."],
["aber","-","لكن","آبر","أداة","General","Aber ich lerne.","لكنني أتعلم."],
["alle","-","كل","أله","مفردات","General","Alle lernen.","الجميع يتعلم."],
["alt","-","قديم / كبير في السن","آلت","صفة","Adjectives"],
["bei","-","لدى / عند","باي","أداة","General","Ich bin bei dir.","أنا عندك."],
["bestimmt","-","بالتأكيد","بشتمت","مفردات","General","Bestimmt!","بالتأكيد!"],
["durch","-","من خلال","دورش","أداة","General","Durch die Stadt.","من خلال المدينة."],
["für","-","من أجل","فور","أداة","General","Für dich.","من أجلك."],
["gegenseitig","-","متبادل","جيجن زايتِش","صفة","Adjectives"],
["gern","-","بسرور","جيرن","مفردات","General","Ich lerne gern.","أنا أتعلم بسرور."],
["groß","-","كبير","جروس","صفة","Adjectives"],
["hier","-","هنا","هير","مفردات","General","Ich bin hier.","أنا هنا."],
["immer","-","دائمًا","إمر","مفردات","General","Immer gut.","دائمًا بخير."],
["ja","-","نعم","يا","مفردات","General","Ja, gern.","نعم، بسرور."],
["nein","-","لا","ناين","مفردات","General","Nein, danke.","لا، شكرًا."],
["jede","-","كل (مفرد)","يده","مفردات","General","Jede Woche.","كل أسبوع."],
["leider","-","للأسف","لايدر","مفردات","General","Leider nicht.","للأسف لا."],
["lustig","-","مضحك","لوستِش","صفة","Adjectives"],
["männlich","-","مذكر","مينلِش","صفة","Adjectives"],
["weiblich","-","مؤنث","فايبلِش","صفة","Adjectives"],
["mehrere","-","عدة","ميرره","مفردات","General","Mehrere Tage.","عدة أيام."],
["meistens","-","غالبًا","مايستنس","مفردات","General","Meistens gut.","غالبًا بخير."],
["mit","-","مع","مت","أداة","General","Ich komme mit dir.","أنا آتٍ معك."],
["morgen","-","غدًا","مورجن","مفردات","Time","Bis morgen!","إلى الغد!"],
["neu","-","جديد","نوي","صفة","Adjectives"],
["noch","-","ما زال","نوخ","مفردات","General","Noch nicht.","ليس بعد."],
["oft","-","غالبًا","أوفت","مفردات","General","Ich lerne oft.","أنا أتعلم غالبًا."],
["persönlich","-","شخصي","بيرزونلِش","صفة","Adjectives"],
["so","-","هكذا / جدًا","زو","مفردات","General","So gut!","جيد جدًا!"],
["super","-","رائع","زوبر","صفة","Adjectives"],
["toll","-","رائع","تول","صفة","Adjectives"],
["viel","-","كثير","فيل","مفردات","General","Viel Glück!","حظًا سعيدًا!"],
["von","-","من","فون","أداة","General","Von mir.","مني."],
["wirklich","-","حقًا","فيركلِش","مفردات","General","Wirklich?","حقًا؟"],
["blau","-","أزرق","بلاو","صفة","Colors"],
["grün","-","أخضر","جرون","صفة","Colors"],
["rot","-","أحمر","روت","صفة","Colors"],
["ledig","-","أعزب","ليدِش","صفة","Adjectives"],
["verheiratet","-","متزوج","فيرهايراتت","صفة","Adjectives"],
["geschieden","-","منفصل","جِشيدن","صفة","Adjectives"],
["verwitwet","-","أرمل","فيرفتفت","صفة","Adjectives"],
["verlobt","-","خاطب","فيرلوبت","صفة","Adjectives"],
["schwanger","-","حامل","شفانجر","صفة","Adjectives"]
];
const RAW_K3 = [
["aufstehen","-","يستيقظ","أوف شتين","فعل","Common Verbs","Ich stehe früh auf.","أنا أستيقظ مبكرًا."],
["bilden","-","يُكوّن","بلدن","فعل","Common Verbs","Wir bilden Sätze.","نحن نُكوّن جملًا."],
["dirigieren","-","يقود فرقة موسيقية","ديريجيرن","فعل","Common Verbs","Er dirigiert gut.","هو يقود الفرقة جيدًا."],
["finden","-","يجد / يرى","فِندن","فعل","Common Verbs","Ich finde das gut.","أنا أرى هذا جيدًا."],
["klopfen","-","يدق","كلوپفن","فعل","Common Verbs","Er klopft an die Tür.","هو يدق الباب."],
["sehen","-","يرى","زين","فعل","Common Verbs","Siehst du den Film?","هل ترى الفيلم؟"],
["würfeln","-","يرمي الزهر","فورفلن","فعل","Common Verbs","Wir würfeln gern.","نحب رمي الزهر."],
["zeichnen","-","يرسم","تسايشنن","فعل","Common Verbs","Ich zeichne ein Haus.","أنا أرسم بيتًا."],
["zeigen","-","يُري","تسايجن","فعل","Common Verbs","Ich zeige dir die Stadt.","أنا أُريك المدينة."],
["Bild","das","الصورة","بلت","اسم","General"],
["Ding","das","الشيء","دنج","اسم","General"],
["Event","das","الحدث","إفنت","اسم","General"],
["Glück","das","الحظ / السعادة","جلوك","اسم","General"],
["Haus","das","البيت","هاوس","اسم","Home"],
["Hotel","das","الفندق","هوتِل","اسم","Travel"],
["Konzert","das","الحفلة الموسيقية","كونتسيرت","اسم","General"],
["Konzerthaus","das","قاعة الحفلات","كونتسيرت هاوس","اسم","General"],
["Mal","das","المرة","مال","اسم","Time"],
["Meer","das","البحر","مير","اسم","Travel"],
["Orchester","das","الأوركسترا","أوركستر","اسم","General"],
["Plakat","das","الملصق","بلاكات","اسم","General"],
["Publikum","das","الجمهور","بوبليكوم","اسم","General"],
["Rathaus","das","مجلس البلدية","رات هاوس","اسم","Travel"],
["Requiem","das","الترنيمة الجنائزية","ريكفيِم","اسم","General"],
["Symbol","das","الرمز","زومبول","اسم","General"],
["Ticket","das","التذكرة","تيكت","اسم","Travel"],
["Ziel","das","الهدف","تسيل","اسم","General"],
["Festival","das","المهرجان","فستيفال","اسم","General"],
["Arm","der","الذراع","آرم","اسم","Body"],
["Bahnhof","der","محطة القطار","بان هوف","اسم","Travel"],
["Besucher","der","الزائر","بيزوخر","اسم","Travel"],
["Chor","der","الكورال","كور","اسم","General"],
["Dank","der","الشكر","دانك","اسم","General"],
["Euro","der","اليورو","أويرو","اسم","Shopping"],
["Film","der","الفيلم","فِلم","اسم","General"],
["Filmfan","der","معجب الأفلام","فِلم فان","اسم","General"],
["Fluss","der","النهر","فلوس","اسم","Travel"],
["Gast","der","الضيف","جاست","اسم","General"],
["Hafen","der","الميناء","هافن","اسم","Travel"],
["Imperativ","der","صيغة الأمر","إمبيراتيف","اسم","School"],
["Konsonant","der","الحرف الساكن","كونزونانت","اسم","School"],
["Markt","der","السوق","ماركت","اسم","Shopping"],
["Mensch","der","الإنسان","مينش","اسم","General"],
["Meter","der","المتر","ميتر","اسم","General"],
["Monat","der","الشهر","مونات","اسم","Time"],
["Ort","der","المكان","أورت","اسم","General"],
["Park","der","الحديقة العامة","بارك","اسم","Travel"],
["Plan","der","الخريطة","بلان","اسم","Travel"],
["Regisseur","der","المخرج","ريجيسور","اسم","Work"],
["Satz","der","الجملة","زاتز","اسم","School"],
["Schauspieler","der","الممثل","شاوشبيلر","اسم","Work"],
["Solist","der","العازف المنفرد","زولست","اسم","General"],
["Star","der","النجم","شتار","اسم","General"],
["Start","der","البداية","شتارت","اسم","General"],
["Test","der","الاختبار","تست","اسم","School"],
["Tisch","der","المنضدة","تيش","اسم","Home"],
["Lampe","die","المصباح","لامبه","اسم","Home"],
["Turm","der","البرج","تورم","اسم","Travel"],
["Vokal","der","الحرف المتحرك","فوكال","اسم","School"],
["Weg","der","الطريق","فيج","اسم","Travel"],
["Zug","der","القطار","تسوك","اسم","Travel"],
["See","der","البحيرة","زيه","اسم","Travel"],
["Ausstellung","die","المعرض","أوس شتيلونج","اسم","General"],
["Bauzeit","die","وقت البناء","باو تسايت","اسم","Time"],
["Bildgeschichte","die","قصة الصورة","بلت جِشِشته","اسم","School"],
["Brücke","die","الجسر","بروكه","اسم","Travel"],
["Fahrkarte","die","تذكرة السفر","فار كارته","اسم","Travel"],
["Gruppe","die","المجموعة","جروبه","اسم","General"],
["Jahreszeit","die","فصل السنة","يارس تسايت","اسم","Time"],
["Kirche","die","الكنيسة","كيرشه","اسم","Travel"],
["Konzertkarte","die","تذكرة الحفلة","كونتسيرت كارته","اسم","General"],
["Kosten","die","التكاليف","كوستن","اسم","Shopping","Die Kosten sind hoch.","التكاليف مرتفعة."],
["Kunsthalle","die","قاعة الفنون","كونست هاله","اسم","General"],
["Lösung","die","الحل","لوزونج","اسم","School"],
["Mitte","die","الوسط","مته","اسم","General"],
["Position","die","الموضع","بوزيتسيون","اسم","General"],
["Produktion","die","الإنتاج","برودوكتسيون","اسم","Work"],
["Stadttour","die","جولة المدينة","شتات تور","اسم","Travel"],
["Station","die","المحطة","شتاتسيون","اسم","Travel"],
["Taxifahrt","die","ركوب التاكسي","تاكسي فارت","اسم","Travel"],
["Wegbeschreibung","die","وصف الطريق","فيج بِشرايبونج","اسم","Travel"],
["Welt","die","العالم","فلت","اسم","Travel"],
["See","die","البحر","زيه","اسم","Travel"],
["ähnlich","-","مشابه","إينلِش","صفة","Adjectives"],
["breit","-","عريض","برايت","صفة","Adjectives"],
["deutschsprachig","-","ناطق بالألمانية","دويتش شبراخِش","صفة","Adjectives"],
["doppelt","-","مزدوج","دوبلت","صفة","Adjectives"],
["einfach","-","بسيط","آينفاخ","صفة","Adjectives"],
["genau","-","بالضبط","جِناو","مفردات","General","Genau!","بالضبط!"],
["hoch","-","مرتفع","هوخ","صفة","Adjectives"],
["interessant","-","شيق","إنترسانت","صفة","Adjectives"],
["lang","-","طويل","لانج","صفة","Adjectives"],
["passend","-","مناسب","باسنت","صفة","Adjectives"],
["richtig","-","صحيح","ريشتِش","صفة","Adjectives"],
["schnell","-","سريع","شنِل","صفة","Adjectives"],
["schön","-","جميل","شون","صفة","Adjectives"],
["circa","-","تقريبًا","تسيركا","مفردات","General","Circa 5 Euro.","حوالي 5 يورو."],
["da","-","هنا / موجود","دا","مفردات","General","Da ist das Café.","ها هو المقهى."],
["heute","-","اليوم","هويته","مفردات","Time","Heute ist Montag.","اليوم الاثنين."],
["jetzt","-","الآن","يتست","مفردات","Time","Jetzt lerne ich.","الآن أتعلم."],
["links","-","يسارًا","لينكس","مفردات","Travel","Gehen Sie links!","اذهب يسارًا!"],
["rechts","-","يمينًا","ريشتس","مفردات","Travel","Gehen Sie rechts!","اذهب يمينًا!"],
["geradeaus","-","للأمام مباشرة","جراده أوس","مفردات","Travel","Fahren Sie geradeaus!","سِر للأمام مباشرة!"],
["zu Fuß","-","سيرًا على الأقدام","تسو فوس","مفردات","Travel","Ich gehe zu Fuß.","أنا أذهب سيرًا."],
["nach","-","بعد / إلى","ناخ","أداة","General","Nach Hause.","إلى البيت."],
["vor","-","قبل / أمام","فور","أداة","General","Vor dem Haus.","أمام البيت."],
["bis","-","حتى","بس","أداة","General","Bis bald!","إلى قريب!"],
["also","-","إذًا","آلزو","مفردات","General","Also, los!","إذًا، هيا!"],
["schon","-","بالفعل","شون","مفردات","General","Schon gut.","لا بأس."],
["vielen Dank","-","شكرًا جزيلًا","فيلن دانك","مفردات","General","Vielen Dank!","شكرًا جزيلًا!"],
["grüß Gott","-","حياك الله (جنوب ألمانيا)","جروس جوت","مفردات","General","Grüß Gott!","حياك الله!"],
["grüezi","-","مرحبًا (سويسرا)","جرويتسي","مفردات","General","Grüezi!","مرحبًا!"],
["moin","-","صباح الخير (شمال ألمانيا)","موين","مفردات","General","Moin!","صباح الخير!"]
];

const RAW_K4 = [
["beantworten","-","يُجيب على","بيأنتفورتن","فعل","Common Verbs","Ich beantworte deine Frage.","أنا أُجيب على سؤالك."],
["brauchen","-","يحتاج إلى","براوخن","فعل","Common Verbs","Ich brauche eine Tüte.","أنا أحتاج كيسًا."],
["drankommen","-","يأتي عليه الدور","دران كومن","فعل","Common Verbs","Jetzt kommst du dran.","الآن دورك."],
["einfallen","-","يخطر بباله","آين فالن","فعل","Common Verbs","Mir fällt nichts ein.","لا يخطر ببالي شيء."],
["einkaufen","-","يتسوق","آين كاوفن","فعل","Common Verbs","Ich kaufe gern ein.","أنا أحب التسوق."],
["erzählen","-","يحكي","إرتسيلن","فعل","Common Verbs","Er erzählt eine Geschichte.","هو يحكي قصة."],
["essen","-","يأكل","إسن","فعل","Common Verbs","Ich esse einen Apfel.","أنا آكل تفاحة."],
["frühstücken","-","يفطر","فرو شتوكن","فعل","Common Verbs","Ich frühstücke um 6 Uhr.","أنا أفطر السادسة."],
["führen","-","يُجري / يقود","فورن","فعل","Common Verbs","Wir führen ein Gespräch.","نحن نُجري محادثة."],
["grillen","-","يشوي","جرِلن","فعل","Common Verbs","Wir grillen heute.","نحن نشوي اليوم."],
["helfen","-","يُساعد","هِلفن","فعل","Common Verbs","Er hilft mir.","هو يُساعدني."],
["kaufen","-","يشتري","كاوفن","فعل","Common Verbs","Ich kaufe Brot.","أنا أشتري خبزًا."],
["kosten","-","يتكلف / ما سعره؟","كوستن","فعل","Common Verbs","Was kostet das?","ما سعر هذا؟"],
["möchten","-","يريد","موشتن","فعل","Common Verbs","Was möchten Sie?","ماذا تريد؟"],
["mögen","-","يحب","موجن","فعل","Common Verbs","Ich mag Kaffee.","أنا أحب القهوة."],
["nehmen","-","يأخذ","نيمِن","فعل","Common Verbs","Ich nehme den Bus.","أنا آخذ الأتوبيس."],
["planen","-","يُخطط","بلانن","فعل","Common Verbs","Ich plane die Reise.","أنا أُخطط للرحلة."],
["probieren","-","يُجرب","بروبيرن","فعل","Common Verbs","Probier mal!","جرب!"],
["recherchieren","-","يبحث","ريشيرشيرن","فعل","Common Verbs","Ich recherchiere im Internet.","أبحث في الإنترنت."],
["schälen","-","يُقشر","شيلن","فعل","Common Verbs","Ich schäle den Apfel.","أنا أُقشر التفاحة."],
["schlafen","-","ينام","شلافن","فعل","Common Verbs","Er schläft gut.","هو ينام جيدًا."],
["schmecken","-","يستطعم / طعمه","شمِكن","فعل","Common Verbs","Fleisch schmeckt sehr gut.","اللحم طعمه جيد جدًا."],
["schneiden","-","يقطع","شنايدن","فعل","Common Verbs","Ich schneide das Brot.","أنا أقطع الخبز."],
["stimmen","-","يصِح","شتمن","فعل","Common Verbs","Das stimmt.","هذا صحيح."],
["trinken","-","يشرب","ترينكن","فعل","Common Verbs","Ich trinke Wasser.","أنا أشرب الماء."],
["verbinden","-","يربط / يوصل","فيربندن","فعل","Common Verbs","Ich verbinde dich.","أنا أصلك بالهاتف."],
["waschen","-","يغسل","فاشن","فعل","Common Verbs","Ich wasche die Äpfel.","أنا أغسل التفاح."],
["wechseln","-","يُبدّل / يفك فلوس","فِكسلن","فعل","Common Verbs","Ich wechsle Geld.","أنا أفك نقودًا."],
["zubereiten","-","يُجهز (الطعام)","تسو بِرايتن","فعل","Common Verbs","Ich bereite das Essen zu.","أنا أُجهز الطعام."],
["werden","-","يُصبح","فيردن","فعل","Common Verbs","Er wird mein Mann.","هو سيُصبح زوجي."],
["bleiben","-","يبقى","بلايبن","فعل","Common Verbs","Sie bleibt meine Freundin.","هي ستبقى صديقتي."],
["Fleisch","das","اللحم","فلايش","اسم","Food"],
["Obst","das","الفاكهة","أوبست","اسم","Food"],
["Gemüse","das","الخضروات","جِموزه","اسم","Food"],
["Abendessen","das","طعام العشاء","آبنت إسن","اسم","Food"],
["Brot","das","الخبز","بروت","اسم","Food"],
["Brötchen","das","الخبز الصغير","بروتشن","اسم","Food"],
["Dessert","das","التحلية","ديسير","اسم","Food"],
["Ei","das","البيضة","آي","اسم","Food"],
["Essen","das","الأكل","إسن","اسم","Food"],
["Fett","das","الدهون","فت","اسم","Food"],
["Fischgericht","das","وجبة السمك","فِش جِريشت","اسم","Food"],
["Frühstück","das","الإفطار","فرو شتوك","اسم","Food"],
["Gericht","das","الوجبة","جِريشت","اسم","Food"],
["Geschäft","das","المحل / التجارة","جِشيفت","اسم","Shopping"],
["Getränk","das","المشروب","جِترينك","اسم","Drinks"],
["Hähnchen","das","الدجاجة المشوية","هينشن","اسم","Food"],
["Huhn","das","الفراخ","هون","اسم","Food"],
["Lebensmittel","das","المواد الغذائية","ليبنس متل","اسم","Food"],
["Maß","das","المقدار / المكيال","ماس","اسم","General"],
["Mittagessen","das","الغداء","مِتاج إسن","اسم","Food"],
["Müsli","das","الموسلي","موسلي","اسم","Food"],
["Paar","das","الزوج","بار","اسم","General"],
["Salz","das","الملح","زالتس","اسم","Food"],
["Stück","das","القطعة","شتوك","اسم","General"],
["Sushi","das","السوشي","سوشي","اسم","Food"],
["Team","das","الفريق","تيم","اسم","General"],
["Zucker","der","السكر","تسُوكر","اسم","Food"],
["Joghurt","der","الزبادي","يوجورت","اسم","Food"],
["Keks","der","البسكويت","كيكس","اسم","Food"],
["Hahn","der","الديك","هان","اسم","Animals"],
["Apfel","der","التفاحة","أبفل","اسم","Food"],
["Becher","der","الكوب","بِشر","اسم","Home"],
["Cent","der","السنت","سِنت","اسم","Shopping"],
["Champignon","der","فطر عيش الغراب","شامبنيون","اسم","Food"],
["Chef","der","الرئيس","شِف","اسم","Work"],
["Döner","der","الشاورما التركية","دونر","اسم","Food"],
["Einkauf","der","التسوق","آين كاوف","اسم","Shopping"],
["Einkaufswagen","der","عربة التسوق","آين كاوفس فاجن","اسم","Shopping"],
["Einkaufszettel","der","قائمة المشتريات","آين كاوفس تسيتل","اسم","Shopping"],
["Kassenzettel","der","فاتورة الشراء","كاسن تسيتل","اسم","Shopping"],
["Emmentaler","der","الجبن السويسري","إمنتالر","اسم","Food"],
["Essig","der","الخل","إسِش","اسم","Food"],
["Fisch","der","السمك","فِش","اسم","Food"],
["Kaffee","der","القهوة","كافيه","اسم","Drinks"],
["Käse","der","الجبنة","كيزه","اسم","Food"],
["Kuchen","der","الكيكة","كوخن","اسم","Food"],
["Mittag","der","الظهر","مِتاج","اسم","Time"],
["Orangensaft","der","عصير البرتقال","أورانجن زافت","اسم","Drinks"],
["Pfeffer","der","الفلفل","بفِفر","اسم","Food"],
["Preis","der","السعر","برايس","اسم","Shopping"],
["Reis","der","الأرز","رايس","اسم","Food"],
["Saft","der","العصير","زافت","اسم","Drinks"],
["Salat","der","السلطة","زالات","اسم","Food"],
["Schinken","der","لحم الخنزير","شِنكن","اسم","Food"],
["Spaß","der","المتعة","شباس","اسم","General"],
["Supermarkt","der","السوبر ماركت","زوپر ماركت","اسم","Shopping"],
["Tee","der","الشاي","تيه","اسم","Drinks"],
["Altstadt","die","المدينة القديمة","آلت شتات","اسم","Travel"],
["Arbeit","die","العمل","أربايت","اسم","Work"],
["Arbeitszeit","die","وقت العمل","أربايتس تسايت","اسم","Work"],
["Assoziation","die","ارتباط الأفكار","أسوتسياتسيون","اسم","School"],
["Bäckerei","die","المخبز","بِكراي","اسم","Shopping"],
["Banane","die","الموزة","بانانه","اسم","Food"],
["Birne","die","الكمثرى","بيرنه","اسم","Food"],
["Butter","die","الزبدة","بوتر","اسم","Food"],
["Dose","die","العلبة / الكانز","دوزه","اسم","Food"],
["Einladung","die","الدعوة","آين لادونج","اسم","General"],
["Grillparty","die","حفلة الشواء","جريل بارتي","اسم","Food"],
["Gurke","die","الخيار","جوركه","اسم","Food"],
["Henne","die","الدجاجة","هِنه","اسم","Animals"],
["Kantine","die","الكانتين","كانتينه","اسم","Food"],
["Kartoffel","die","البطاطس","كارتوفل","اسم","Food"],
["Limonade","die","عصير الليمون","ليموناده","اسم","Drinks"],
["Mahlzeit","die","الوجبة","مال تسايت","اسم","Food"],
["Marmelade","die","المربى","مارميلاده","اسم","Food"],
["Methode","die","الطريقة","ميتوده","اسم","School"],
["Metzgerei","die","محل الجزارة","ميتسجِراي","اسم","Shopping"],
["Milch","die","اللبن","مِلش","اسم","Drinks"],
["Mindmap","die","الخارطة الذهنية","مايند ماب","اسم","School"],
["Muttersprache","die","اللغة الأم","موتر شبراخه","اسم","Languages"],
["Nachricht","die","الخبر / الرسالة","ناخريشت","اسم","General"],
["Olive","die","الزيتون","أوليفه","اسم","Food"],
["Packung","die","العبوة","باكونج","اسم","Shopping"],
["Pizza","die","البيتزا","بيتزا","اسم","Food"],
["Pommes frites","die","البطاطس المقلية","بوم فريت","اسم","Food","Die Pommes frites sind lecker.","البطاطس المقلية لذيذة."],
["Sahne","die","القشطة","زانه","اسم","Food"],
["Schokolade","die","الشيكولاتة","شوكولاده","اسم","Food"],
["Suppe","die","الشوربة","زوبه","اسم","Food"],
["Tomate","die","الطماطم","توماته","اسم","Food"],
["Tüte","die","الكيس","توته","اسم","Shopping"],
["Uhr","die","الساعة (آلة)","أور","اسم","Time"],
["Verpackung","die","التغليف","فيرباكونج","اسم","Shopping"],
["Vorliebe","die","الميل / المُفضل","فورليبه","اسم","General"],
["Wortgruppe","die","كلمات مترابطة","فورت جروبه","اسم","School"],
["Wurst","die","السجق","فورست","اسم","Food"],
["Zeit","die","الوقت","تسايت","اسم","Time"],
["Zwiebel","die","البصل","تسفيبل","اسم","Food"],
["Cola","die","الكولا","كولا","اسم","Drinks"],
["abends","-","كل مساء","آبنتس","مفردات","Time","Abends lerne ich.","كل مساء أتعلم."],
["alles","-","كل شيء","ألس","مفردات","General","Ist das alles?","هل هذا كل شيء؟"],
["als","-","كـ","آلس","أداة","General","Als Lehrer.","كمعلم."],
["asiatisch","-","آسيوي","أزياتِش","صفة","Adjectives"],
["bis später","-","إلى اللقاء","بس شبيتر","مفردات","General","Bis später!","إلى اللقاء!"],
["dort","-","هناك","دورت","مفردات","General","Dort ist der Markt.","هناك السوق."],
["echt","-","حقيقي","إشت","صفة","Adjectives"],
["etwas","-","شيئًا ما","إتفاس","مفردات","General","Sonst noch etwas?","هل ترغب في شيء آخر؟"],
["fertig","-","مُنتهٍ","فيرتِش","صفة","Adjectives"],
["frisch","-","طازج","فريش","صفة","Adjectives"],
["gerne","-","بكل سرور","جيرنه","مفردات","General","Sehr gerne!","بكل سرور!"],
["gesund","-","صحي","جِزونت","صفة","Adjectives"],
["gleich","-","حالًا","جلايش","مفردات","Time","Ich komme gleich.","سآتي حالًا."],
["gleichfalls","-","بالمثل","جلايش فالس","مفردات","General","Danke, gleichfalls!","شكرًا، وبالمثل!"],
["guten Appetit","-","بالهناء والشفاء","جوتن أبيتيت","مفردات","Food","Guten Appetit!","بالهناء والشفاء!"],
["halb","-","نصف","هالب","مفردات","Time","Es ist halb vier.","الساعة الثالثة والنصف."],
["klein","-","صغير","كلاين","صفة","Adjectives"],
["kreativ","-","مبدع","كرياتيف","صفة","Adjectives"],
["länger","-","أطول","لينجر","صفة","Adjectives"],
["lecker","-","لذيذ","لِكر","صفة","Adjectives"],
["manchmal","-","أحيانًا","مانشمال","مفردات","Time","Manchmal koche ich.","أحيانًا أطبخ."],
["mehr","-","أكثر","مير","مفردات","General","Noch mehr?","المزيد؟"],
["natürlich","-","طبعًا","ناتورلِش","مفردات","General","Natürlich!","طبعًا!"],
["nett","-","لطيف","نت","صفة","Adjectives"],
["nichts","-","لا شيء","نيشتس","مفردات","General","Nichts!","لا شيء!"],
["normalerweise","-","في العادة","نورمالر فايزه","مفردات","Time","Normalerweise frühstücke ich.","في العادة أفطر."],
["nur","-","فقط","نور","مفردات","General","Nur das.","فقط هذا."],
["prost","-","في صحتك","بروست","مفردات","Food","Prost!","في صحتك!"],
["rund um","-","حول","روند أوم","أداة","General","Alles rund um Mode.","كل شيء حول الموضة."],
["satt","-","شبعان","زات","صفة","Adjectives"],
["seit","-","منذ","زايت","أداة","Time","Seit Montag.","منذ الاثنين."],
["sonst","-","وإلا","زونست","مفردات","General","Sonst nichts, danke.","لا شيء آخر، شكرًا."],
["stressig","-","مجهد","شترِسِش","صفة","Adjectives"],
["süß","-","حلو","زوس","صفة","Adjectives"],
["teuer","-","غالٍ","توير","صفة","Adjectives"],
["thematisch","-","حسب الموضوع","تيماتِش","صفة","School"],
["unregelmäßig","-","غير منتظم","أون ريجل ميسِش","صفة","Adjectives"],
["vielleicht","-","ربما","فِلايشت","مفردات","General","Vielleicht morgen.","ربما غدًا."],
["wach","-","مستيقظ","فاخ","صفة","Adjectives"],
["wenig","-","قليل","فينِش","مفردات","General","Wenig Zeit.","وقت قليل."],
["wichtig","-","مهم","فِشتِش","صفة","Adjectives"],
["wie viel","-","كم (للكمية)","في فيل","مفردات","General","Wie viel kostet das?","كم سعر هذا؟"],
["wie viele","-","كم (للعدد)","في فيله","مفردات","General","Wie viele Äpfel?","كم تفاحة؟"],
["zurück","-","إلى الخلف","تسو روك","مفردات","General","Zurück, bitte!","ارجع من فضلك!"],
["zusammen","-","معًا","تسوزامن","مفردات","General","Wir lernen zusammen.","نتعلم معًا."]
];

const RAW_K5 = [
["können","-","يستطيع أن","كونن","فعل","Common Verbs","Ich kann Deutsch sprechen.","أنا أستطيع التحدث بالألمانية."],
["müssen","-","يجب أن","موسن","فعل","Common Verbs","Ich muss lernen.","يجب أن أتعلم."],
["wollen","-","يريد أن","فولن","فعل","Common Verbs","Ich will einen Termin.","أنا أريد موعدًا."],
["frühstücken","-","يفطر","فرو شتوكن","فعل","Common Verbs","Wir frühstücken zusammen.","نفطر معًا."],
["duschen","-","يستحم","دوشن","فعل","Common Verbs","Ich dusche morgens.","أنا أستحم صباحًا."],
["beschreiben","-","يصف","بِشرايبن","فعل","Common Verbs","Er beschreibt die Stadt.","هو يصف المدينة."],
["besuchen","-","يزور","بيزوخن","فعل","Common Verbs","Der Freund besucht ihn.","الصديق يزوره."],
["bitten um","-","يطلب","بِتن أوم","فعل","Common Verbs","Ich bitte um Entschuldigung.","أنا أطلب المعذرة."],
["bleiben","-","يبقى","بلايبن","فعل","Common Verbs","Ich bleibe heute zu Hause.","سأبقى في البيت اليوم."],
["entschuldigen","-","يعتذر","إنتشولديجن","فعل","Common Verbs","Entschuldigen Sie bitte!","اعذرني من فضلك!"],
["telefonieren","-","يتصل هاتفيًا","تيليفونيرن","فعل","Common Verbs","Ich telefoniere mit dir.","أنا أتصل بك."],
["treffen","-","يُقابل","ترِفن","فعل","Common Verbs","Der Lehrer trifft den Schüler.","المعلم يُقابل التلميذ."],
["tun","-","يفعل","تون","فعل","Common Verbs","Was kann ich für Sie tun?","ماذا يمكنني أن أفعل لك؟"],
["überlegen","-","يُفكر","أوبر ليجن","فعل","Common Verbs","Ich überlege kurz.","أنا أفكر قليلًا."],
["vereinbaren","-","يتفق على","فيرآينبارن","فعل","Common Verbs","Wir vereinbaren ein Treffen.","نتفق على لقاء."],
["vorbereiten","-","يُحضّر","فور بِرايتن","فعل","Common Verbs","Ich bereite die Prüfung vor.","أنا أُحضّر للامتحان."],
["ziehen","-","يسحب","تسيِن","فعل","Common Verbs","Ziehen Sie eine Karte!","اسحب كارتًا!"],
["zu Mittag essen","-","يتغدى","تسو مِتاج إسن","فعل","Common Verbs","Wir essen zu Mittag.","نحن نتغدى."],
["sitzen","-","يجلس","زِتسن","فعل","Common Verbs","Ich sitze hier.","أنا أجلس هنا."],
["nummerieren","-","يُرقّم","نومريرن","فعل","Common Verbs","Ich nummeriere die Seiten.","أنا أُرقّم الصفحات."],
["absagen","-","يُلغي","آب زاجن","فعل","Common Verbs","Ich sage den Termin ab.","أنا أُلغي الموعد."],
["verschieben","-","يُؤجل الموعد","فيرشيبن","فعل","Common Verbs","Ich verschiebe den Termin.","أنا أُؤجل الموعد."],
["ändern","-","يُغيّر","إندرن","فعل","Common Verbs","Ich ändere den Plan.","أنا أُغيّر الخطة."],
["reagieren","-","يرد على","رياجيرن","فعل","Common Verbs","Sie reagiert freundlich.","هي ترد بلطف."],
["Baby","das","الرضيع","بيبي","اسم","Family"],
["Büro","das","المكتب","بوروه","اسم","Work"],
["Gästebuch","das","دفتر الضيوف","جِسته بوخ","اسم","Home"],
["Kind","das","الطفل","كِند","اسم","Family"],
["Modalverb","das","فعل الكيفية","مودال فيرب","اسم","School"],
["Problem","das","المشكلة","بروبلِم","اسم","General"],
["Pronomen","das","الضمير","برونومن","اسم","School"],
["Satzende","das","نهاية الجملة","زاتز إنده","اسم","School"],
["Saxofon","das","الساكسفون","زاكسوفون","اسم","General"],
["Spiel","das","اللعبة","شبيل","اسم","General"],
["Telefongespräch","das","المحادثة الهاتفية","تيليفون جِشبريش","اسم","General"],
["Training","das","التدريب","تريننج","اسم","General"],
["Viertel","das","الربع / الحي","فيرتل","اسم","Time"],
["Alltag","der","الحياة اليومية","آلتاج","اسم","General"],
["Ball","der","الكرة","بال","اسم","General"],
["Eintrag","der","التدوينة","آين تراج","اسم","School"],
["Englisch-Test","der","اختبار الإنجليزية","إنجليش تست","اسم","School"],
["Geburtstag","der","عيد الميلاد","جيبورتس تاج","اسم","Family"],
["Geigenunterricht","der","درس الكمان","جايجن أونتر ريشت","اسم","School"],
["Hamster","der","الهامستر","هامستر","اسم","Animals"],
["Hund","der","الكلب","هوند","اسم","Animals"],
["Junge","der","الصبي","يونجه","اسم","Family"],
["Kalender","der","التقويم","كاليندر","اسم","Home"],
["Kunde","der","العميل","كونده","اسم","Work"],
["Mathe-Test","der","اختبار الرياضيات","ماته تست","اسم","School"],
["Sonntagnachmittag","der","بعد ظهر الأحد","زونتاج ناخ متاج","اسم","Time"],
["Sprachkurs","der","كورس اللغة","شبراخ كورس","اسم","School"],
["Stapel","der","الكومة","شتابل","اسم","Home"],
["Stress","der","التوتر","شترِس","اسم","General"],
["Techniker","der","الفني","تِشنيكر","اسم","Work"],
["Vater","der","الأب","فاتر","اسم","Family"],
["Verwandte","der","القريب","فيرفانتر","اسم","Family"],
["Großvater","der","الجد","جروس فاتر","اسم","Family"],
["Opa","der","الجد","أوبا","اسم","Family"],
["Sohn","der","الابن","زون","اسم","Family"],
["Bruder","der","الأخ","برودر","اسم","Family"],
["Enkel","der","الحفيد","إنكل","اسم","Family"],
["Ehemann","der","الزوج","إيه مان","اسم","Family"],
["Onkel","der","العم / الخال","أونكل","اسم","Family"],
["Neffe","der","ابن الأخ","نِفه","اسم","Family"],
["Cousin","der","ابن العم","كوزان","اسم","Family"],
["Aussage","die","القول / الجملة","أوس زاجه","اسم","School"],
["Bar","die","البار","بار","اسم","General"],
["Besprechung","die","الاجتماع","بِشبرِشونج","اسم","Work"],
["Bibliothek","die","المكتبة","بيبليوتيك","اسم","School"],
["Familie","die","العائلة","فاميليا","اسم","Family"],
["Fantasie","die","الخيال","فانتازي","اسم","General"],
["Geige","die","الكمان","جايجه","اسم","School"],
["halbe Stunde","die","نصف ساعة","هالبه شتونده","اسم","Time","Eine halbe Stunde.","نصف ساعة."],
["Hausaufgabe","die","الواجب المنزلي","هاوس أوف جابه","اسم","School"],
["Höflichkeit","die","التأدب","هوفلِشكايت","اسم","General"],
["Homepage","die","الصفحة الرئيسية","هوم بيدج","اسم","School"],
["Idee","die","الفكرة","إديه","اسم","General"],
["Maus","die","الفأر","ماوس","اسم","Animals"],
["Mensa","die","مطعم الجامعة","مِنزا","اسم","University"],
["Minute","die","الدقيقة","مينوته","اسم","Time"],
["Musikschule","die","مدرسة الموسيقى","موزيك شوله","اسم","School"],
["Party","die","الحفلة","بارتي","اسم","General"],
["Praxis","die","العيادة","براكسِس","اسم","General"],
["Pünktlichkeit","die","الانضباط","بونكتلِشكايت","اسم","General"],
["Regel","die","القاعدة","ريجل","اسم","School"],
["Rollenkarte","die","بطاقة الدور","رولن كارته","اسم","School"],
["Satzklammer","die","جزءا الفعل","زاتز كلامر","اسم","School"],
["Sekunde","die","الثانية","زيكونده","اسم","Time"],
["Sprachschule","die","مدرسة اللغة","شبراخ شوله","اسم","School"],
["Großmutter","die","الجدة","جروس موتر","اسم","Family"],
["Oma","die","الجدة","أوما","اسم","Family"],
["Mutter","die","الأم","موتر","اسم","Family"],
["Tochter","die","الابنة","توختر","اسم","Family"],
["Schwester","die","الأخت","شفيستر","اسم","Family"],
["Enkelin","die","الحفيدة","إنكِلِن","اسم","Family"],
["Ehefrau","die","الزوجة","إيه فراو","اسم","Family"],
["Tante","die","العمة / الخالة","تانته","اسم","Family"],
["Nichte","die","ابنة الأخ","نِشته","اسم","Family"],
["Cousine","die","بنت العم","كوزينه","اسم","Family"],
["Eltern","die","الوالدان","إلترن","اسم","Family","Meine Eltern wohnen hier.","والداي يسكنان هنا."],
["Großeltern","die","الجدان","جروس إلترن","اسم","Family","Meine Großeltern sind nett.","جداي لطيفان."],
["Geschwister","die","الإخوة","جِشفيستر","اسم","Family","Haben Sie Geschwister?","هل لديك إخوة؟"],
["Kinder","die","الأطفال","كِندر","اسم","Family","Die Kinder spielen.","الأطفال يلعبون."],
["Enkelkinder","die","الأحفاد","إنكل كِندر","اسم","Family","Die Enkelkinder sind klein.","الأحفاد صغار."],
["Verwandten","die","الأقرباء","فيرفانتن","اسم","Family","Die Verwandten kommen.","الأقرباء قادمون."],
["Eheleute","die","الزوجان","إيه لويته","اسم","Family","Die Eheleute sind glücklich.","الزوجان سعيدان."],
["Tageszeit","die","وقت اليوم","تاجس تسايت","اسم","Time"],
["Tour","die","الرحلة","تور","اسم","Travel"],
["Trompete","die","البوق","ترومبيته","اسم","General"],
["Uhrzeit","die","وقت الساعة","أور تسايت","اسم","Time"],
["Uni","die","الجامعة","أوني","اسم","University"],
["Verspätung","die","التأخير","فيرشبيتونج","اسم","Time"],
["Zeitangabe","die","ظرف الزمان","تسايت آنجابه","اسم","School"],
["Zeitung","die","الصحيفة","تسايتونج","اسم","General"],
["Mitternacht","die","منتصف الليل","مِتر ناخت","اسم","Time"],
["Grüße","die","التحيات","جروسه","اسم","General","Liebe Grüße!","تحياتي القلبية!"],
["ab","-","ابتداءً من","آب","أداة","General","Ab Montag.","ابتداءً من الاثنين."],
["abwechselnd","-","بالتناوب","آب فِكسلنت","مفردات","General","Abwechselnd lesen.","نقرأ بالتناوب."],
["cool","-","رائع","كول","صفة","Adjectives"],
["dreimal","-","ثلاث مرات","دراي مال","مفردات","Time","Dreimal täglich.","ثلاث مرات يوميًا."],
["falsch","-","خطأ","فالش","صفة","Adjectives"],
["höflich","-","مؤدب","هوفلِش","صفة","Adjectives"],
["unhöflich","-","غير مؤدب","أون هوفلِش","صفة","Adjectives"],
["krank","-","مريض","كرانك","صفة","Adjectives"],
["lange","-","طويلًا","لانجه","مفردات","Time","Wie lange?","كم من الوقت؟"],
["nächst-","-","التالي","نيخست","صفة","Time","Nächste Woche.","الأسبوع القادم."],
["noch mal","-","مرة أخرى","نوخ مال","مفردات","General","Noch mal, bitte!","مرة أخرى من فضلك!"],
["offen","-","مفتوح","أوفن","صفة","Adjectives"],
["plus","-","زائد","بلوس","مفردات","Numbers","Zwei plus zwei.","اثنان زائد اثنان."],
["pünktlich","-","منضبط","بونكتلِش","صفة","Adjectives","Bitte pünktlich!","كن منضبطًا من فضلك!"],
["schade","-","للأسف","شاده","مفردات","General","Schade!","يا خسارة!"],
["spät","-","متأخر","شبيت","صفة","Time","Er kommt zu spät.","هو يأتي متأخرًا."],
["verschieden","-","مختلف","فيرشيدن","صفة","Adjectives"],
["vorher","-","قبل ذلك","فور هير","مفردات","Time","Wie vorher.","كما قبل."],
["wie lange","-","كم المدة؟","في لانجه","مفردات","Time","Wie lange arbeitest du?","كم تعمل؟"],
["willkommen","-","مرحبًا","فِل كومن","مفردات","General","Willkommen!","مرحبًا بك!"],
["zu Hause","-","في البيت","تسو هاوزه","مفردات","Home","Ich bin zu Hause.","أنا في البيت."]
];
/* ============ الجمع الكامل لكل اسم "De|art" -> الجمع ============ */
const PLURAL_A = {
"Freund|der":"Freunde","Straße|die":"Straßen","Land|das":"Länder","Arbeiter|der":"Arbeiter","Information|die":"Informationen","Mädchen|das":"Mädchen","Name|der":"Namen","Karte|die":"Karten","Bus|der":"Busse","Klub|der":"Klubs","Kurs|der":"Kurse","Krokodil|das":"Krokodile","Wolf|der":"Wölfe","Thema|das":"Themen","Läufer|der":"Läufer","Tür|die":"Türen","Mann|der":"Männer","Wort|das":"Wörter","Apfel|der":"Äpfel","Kollege|der":"Kollegen","Tomate|die":"Tomaten","Student|der":"Studenten","Schule|die":"Schulen","Buch|das":"Bücher","Räuber|der":"Räuber","Bett|das":"Betten","Öl|das":"Öle","Morgen|der":"Morgen",
"Befinden|das":"Befinden","Butterbrot|das":"Butterbrote","Gespräch|das":"Gespräche","Handtuch|das":"Handtücher","Interview|das":"Interviews","Kursplakat|das":"Kursplakate","Redemittel|das":"Redemittel","Telefon|das":"Telefone","Verb|das":"Verben","Würstchen|das":"Würstchen","Würstel|das":"Würstel","W-Wort|das":"W-Wörter","Dialog|der":"Dialoge","Kindergarten|der":"Kindergärten","Koffer|der":"Koffer","Nachname|der":"Nachnamen","Punkt|der":"Punkte","Reiseführer|der":"Reiseführer","Text|der":"Texte","Unterstrich|der":"Unterstriche","Vorname|der":"Vornamen","Kranke|der":"Kranken","Antwort|die":"Antworten","Autobahn|die":"Autobahnen","E-Mail-Adresse|die":"E-Mail-Adressen","Entschuldigung|die":"Entschuldigungen","Flasche|die":"Flaschen","Nudel|die":"Nudeln","Person|die":"Personen","Reiseführerin|die":"Reiseführerinnen","Situation|die":"Situationen","Sprache|die":"Sprachen","Stadt|die":"Städte","Universität|die":"Universitäten","Tabelle|die":"Tabellen","Herkunft|die":"Herkünfte","Telefonnummer|die":"Telefonnummern","Handynummer|die":"Handynummern","Frau|die":"Frauen","Wörter|die":"Wörter","Kursbuch|das":"Kursbücher","Übungsbuch|das":"Übungsbücher","Testheft|das":"Testhefte","Aufsatz|der":"Aufsätze",
"Auto|das":"Autos","Beispiel|das":"Beispiele","Café|das":"Cafés","Formular|das":"Formulare","Foto|das":"Fotos","Geburtsdatum|das":"Geburtsdaten","Geld|das":"Gelder","Glas|das":"Gläser","Hobby|das":"Hobbys","Jahr|das":"Jahre","Kapitel|das":"Kapitel","Kino|das":"Kinos","Krankenhaus|das":"Krankenhäuser","Medikament|das":"Medikamente","Museum|das":"Museen","Restaurant|das":"Restaurants","Schwimmbad|das":"Schwimmbäder","Seminar|das":"Seminare","Stadion|das":"Stadien","Taxi|das":"Taxis","Theater|das":"Theater","Wochenende|das":"Wochenenden","Wörterbuch|das":"Wörterbücher","Zimmer|das":"Zimmer","Abend|der":"Abende","Beruf|der":"Berufe","Club|der":"Clubs","Familienname|der":"Familiennamen","Geburtsort|der":"Geburtsorte","Kommentar|der":"Kommentare","Kursraum|der":"Kursräume","Lernwortschatz|der":"Lernwortschätze","Moment|der":"Momente","Nachmittag|der":"Nachmittage","Patient|der":"Patienten","Platz|der":"Plätze","Schlüssel|der":"Schlüssel","Sportclub|der":"Sportclubs","Stift|der":"Stifte","Tag|der":"Tage","Termin|der":"Termine","Wochentag|der":"Wochentage","Wohnort|der":"Wohnorte","Arzt|der":"Ärzte","Koch|der":"Köche","Architekt|der":"Architekten","Elektriker|der":"Elektriker","Erzieher|der":"Erzieher","Friseur|der":"Friseure","Handwerker|der":"Handwerker","Informatiker|der":"Informatiker","Ingenieur|der":"Ingenieure","Journalist|der":"Journalisten","Jurist|der":"Juristen","Kellner|der":"Kellner","Krankenpfleger|der":"Krankenpfleger","Lehrer|der":"Lehrer","Mechaniker|der":"Mechaniker","Polizist|der":"Polizisten","Taxifahrer|der":"Taxifahrer","Verkäufer|der":"Verkäufer","Fußball|der":"Fußbälle","Basketball|der":"Basketbälle","Samstag|der":"Samstage","Sonntag|der":"Sonntage","Montag|der":"Montage","Dienstag|der":"Dienstage","Mittwoch|der":"Mittwoche","Donnerstag|der":"Donnerstage","Freitag|der":"Freitage","Frühling|der":"Frühlinge","Sommer|der":"Sommer","Herbst|der":"Herbste","Winter|der":"Winter","Fahrrad|das":"Fahrräder","Flugzeug|das":"Flugzeuge","Motorrad|das":"Motorräder","Schiff|das":"Schiffe","Straßenbahn|die":"Straßenbahnen","S-Bahn|die":"S-Bahnen","U-Bahn|die":"U-Bahnen","Adresse|die":"Adressen","Angabe|die":"Angaben","Anmeldung|die":"Anmeldungen","E-Mail|die":"E-Mails","Farbe|die":"Farben","Firma|die":"Firmen","Form|die":"Formen","Frage|die":"Fragen","Freundin|die":"Freundinnen","Hausnummer|die":"Hausnummern","Lernkarte|die":"Lernkarten","Leute|die":"Leute","Möglichkeit|die":"Möglichkeiten","Notiz|die":"Notizen","Postleitzahl|die":"Postleitzahlen","Rechnung|die":"Rechnungen","Seite|die":"Seiten","Sensation|die":"Sensationen","Spaghetti|die":"Spaghetti","Spritze|die":"Spritzen","Stunde|die":"Stunden","Tablette|die":"Tabletten","Verabredung|die":"Verabredungen","Woche|die":"Wochen","Zeichnung|die":"Zeichnungen","Million|die":"Millionen","Milliarde|die":"Milliarden","Satzmelodie|die":"Satzmelodien","Endung|die":"Endungen","Kollegin|die":"Kolleginnen","Artikelbild|das":"Artikelbilder"
};
const PLURAL_B = {
"Bild|das":"Bilder","Ding|das":"Dinge","Event|das":"Events","Haus|das":"Häuser","Hotel|das":"Hotels","Konzert|das":"Konzerte","Konzerthaus|das":"Konzerthäuser","Mal|das":"Male","Meer|das":"Meere","Orchester|das":"Orchester","Plakat|das":"Plakate","Rathaus|das":"Rathäuser","Requiem|das":"Requiems","Symbol|das":"Symbole","Ticket|das":"Tickets","Ziel|das":"Ziele","Festival|das":"Festivals","Arm|der":"Arme","Bahnhof|der":"Bahnhöfe","Besucher|der":"Besucher","Chor|der":"Chöre","Film|der":"Filme","Filmfan|der":"Filmfans","Fluss|der":"Flüsse","Gast|der":"Gäste","Hafen|der":"Häfen","Imperativ|der":"Imperative","Konsonant|der":"Konsonanten","Markt|der":"Märkte","Mensch|der":"Menschen","Meter|der":"Meter","Monat|der":"Monate","Ort|der":"Orte","Park|der":"Parks","Plan|der":"Pläne","Regisseur|der":"Regisseure","Satz|der":"Sätze","Schauspieler|der":"Schauspieler","Solist|der":"Solisten","Star|der":"Stars","Start|der":"Starts","Test|der":"Tests","Tisch|der":"Tische","Lampe|die":"Lampen","Turm|der":"Türme","Vokal|der":"Vokale","Weg|der":"Wege","Zug|der":"Züge","See|der":"Seen","Ausstellung|die":"Ausstellungen","Bauzeit|die":"Bauzeiten","Bildgeschichte|die":"Bildgeschichten","Brücke|die":"Brücken","Fahrkarte|die":"Fahrkarten","Gruppe|die":"Gruppen","Jahreszeit|die":"Jahreszeiten","Kirche|die":"Kirchen","Konzertkarte|die":"Konzertkarten","Kosten|die":"Kosten","Kunsthalle|die":"Kunsthallen","Lösung|die":"Lösungen","Mitte|die":"Mitten","Position|die":"Positionen","Produktion|die":"Produktionen","Stadttour|die":"Stadttouren","Station|die":"Stationen","Taxifahrt|die":"Taxifahrten","Wegbeschreibung|die":"Wegbeschreibungen","Welt|die":"Welten","See|die":"Seen",
"Fleisch|das":"Fleisch","Obst|das":"Obst","Gemüse|das":"Gemüse","Abendessen|das":"Abendessen","Brot|das":"Brote","Brötchen|das":"Brötchen","Dessert|das":"Desserts","Ei|das":"Eier","Essen|das":"Essen","Fett|das":"Fette","Fischgericht|das":"Fischgerichte","Frühstück|das":"Frühstücke","Gericht|das":"Gerichte","Geschäft|das":"Geschäfte","Getränk|das":"Getränke","Hähnchen|das":"Hähnchen","Huhn|das":"Hühner","Lebensmittel|das":"Lebensmittel","Maß|das":"Maße","Mittagessen|das":"Mittagessen","Müsli|das":"Müslis","Paar|das":"Paare","Salz|das":"Salze","Stück|das":"Stücke","Sushi|das":"Sushis","Team|das":"Teams","Joghurt|der":"Joghurts","Keks|der":"Kekse","Hahn|der":"Hähne","Becher|der":"Becher","Cent|der":"Cents","Champignon|der":"Champignons","Chef|der":"Chefs","Döner|der":"Döner","Einkauf|der":"Einkäufe","Einkaufswagen|der":"Einkaufswagen","Einkaufszettel|der":"Einkaufszettel","Kassenzettel|der":"Kassenzettel","Emmentaler|der":"Emmentaler","Essig|der":"Essige","Fisch|der":"Fische","Kaffee|der":"Kaffees","Käse|der":"Käse","Kuchen|der":"Kuchen","Mittag|der":"Mittage","Orangensaft|der":"Orangensäfte","Preis|der":"Preise","Saft|der":"Säfte","Salat|der":"Salate","Schinken|der":"Schinken","Spaß|der":"Späße","Supermarkt|der":"Supermärkte","Tee|der":"Tees","Altstadt|die":"Altstädte","Arbeit|die":"Arbeiten","Arbeitszeit|die":"Arbeitszeiten","Assoziation|die":"Assoziationen","Bäckerei|die":"Bäckereien","Banane|die":"Bananen","Birne|die":"Birnen","Dose|die":"Dosen","Einladung|die":"Einladungen","Grillparty|die":"Grillpartys","Gurke|die":"Gurken","Henne|die":"Hennen","Kantine|die":"Kantinen","Kartoffel|die":"Kartoffeln","Limonade|die":"Limonaden","Mahlzeit|die":"Mahlzeiten","Marmelade|die":"Marmeladen","Methode|die":"Methoden","Metzgerei|die":"Metzgereien","Mindmap|die":"Mindmaps","Muttersprache|die":"Muttersprachen","Nachricht|die":"Nachrichten","Olive|die":"Oliven","Packung|die":"Packungen","Pizza|die":"Pizzen","Pommes frites|die":"Pommes frites","Schokolade|die":"Schokoladen","Suppe|die":"Suppen","Tüte|die":"Tüten","Uhr|die":"Uhren","Verpackung|die":"Verpackungen","Vorliebe|die":"Vorlieben","Wortgruppe|die":"Wortgruppen","Wurst|die":"Würste","Zeit|die":"Zeiten","Zwiebel|die":"Zwiebeln","Cola|die":"Colas",
"Baby|das":"Babys","Büro|das":"Büros","Gästebuch|das":"Gästebücher","Kind|das":"Kinder","Modalverb|das":"Modalverben","Problem|das":"Probleme","Pronomen|das":"Pronomen","Satzende|das":"Satzenden","Saxofon|das":"Saxofone","Spiel|das":"Spiele","Telefongespräch|das":"Telefongespräche","Training|das":"Trainings","Viertel|das":"Viertel","Alltag|der":"Alltage","Ball|der":"Bälle","Eintrag|der":"Einträge","Englisch-Test|der":"Englisch-Tests","Geburtstag|der":"Geburtstage","Hamster|der":"Hamster","Hund|der":"Hunde","Junge|der":"Jungen","Kalender|der":"Kalender","Kunde|der":"Kunden","Mathe-Test|der":"Mathe-Tests","Sonntagnachmittag|der":"Sonntagnachmittage","Sprachkurs|der":"Sprachkurse","Stapel|der":"Stapel","Techniker|der":"Techniker","Vater|der":"Väter","Verwandte|der":"Verwandten","Großvater|der":"Großväter","Opa|der":"Opas","Sohn|der":"Söhne","Bruder|der":"Brüder","Enkel|der":"Enkel","Ehemann|der":"Ehemänner","Onkel|der":"Onkel","Neffe|der":"Neffen","Cousin|der":"Cousins","Aussage|die":"Aussagen","Bar|die":"Bars","Besprechung|die":"Besprechungen","Bibliothek|die":"Bibliotheken","Familie|die":"Familien","Fantasie|die":"Fantasien","Geige|die":"Geigen","halbe Stunde|die":"halbe Stunden","Hausaufgabe|die":"Hausaufgaben","Höflichkeit|die":"Höflichkeiten","Homepage|die":"Homepages","Idee|die":"Ideen","Maus|die":"Mäuse","Mensa|die":"Mensen","Minute|die":"Minuten","Musikschule|die":"Musikschulen","Party|die":"Partys","Praxis|die":"Praxen","Regel|die":"Regeln","Rollenkarte|die":"Rollenkarten","Satzklammer|die":"Satzklammern","Sekunde|die":"Sekunden","Sprachschule|die":"Sprachschulen","Großmutter|die":"Großmütter","Oma|die":"Omas","Mutter|die":"Mütter","Tochter|die":"Töchter","Schwester|die":"Schwestern","Enkelin|die":"Enkelinnen","Ehefrau|die":"Ehefrauen","Tante|die":"Tanten","Nichte|die":"Nichten","Cousine|die":"Cousinen","Eltern|die":"Eltern","Großeltern|die":"Großeltern","Geschwister|die":"Geschwister","Kinder|die":"Kinder","Enkelkinder|die":"Enkelkinder","Verwandten|die":"Verwandten","Eheleute|die":"Eheleute","Tageszeit|die":"Tageszeiten","Tour|die":"Touren","Trompete|die":"Trompeten","Uhrzeit|die":"Uhrzeiten","Uni|die":"Unis","Verspätung|die":"Verspätungen","Zeitangabe|die":"Zeitangaben","Zeitung|die":"Zeitungen","Grüße|die":"Grüße"
};
const PLURAL = Object.assign({},PLURAL_A,PLURAL_B);
/* ============ KAPITEL ============ */
const KAPITEL = [
{id:"K0",name:"Einführung – مقدمة",icon:"🌟"},
{id:"K1",name:"Kapitel 1 – Guten Tag",icon:"👋"},
{id:"K2",name:"Kapitel 2 – Freunde und Kollegen",icon:"👥"},
{id:"K3",name:"Kapitel 3 – In Hamburg",icon:"🏙️"},
{id:"K4",name:"Kapitel 4 – Guten Appetit",icon:"🍽️"},
{id:"K5",name:"Kapitel 5 – Alltag und Familie",icon:"🏠"},
{id:"KX",name:"➕ كلماتي المضافة",icon:"⭐"}
];
function kapName(k){const f=KAPITEL.find(x=>x.id===k);return f?f.icon+" "+f.id+" • "+f.name:k||"";}
/* الصيغ الكاملة: der Tisch / die Tische */
function fullDe(w){return (w.art!=="-"?w.art+" ":"")+w.de;}
function pluralFull(w){return w.plural?((w.art&&w.art!=="-"?w.art+" ":"")+w.plural):"";}
function wordById(id){return allWords().find(w=>w.id===id);}
function pluralDistractors(w){
  const correct=pluralFull(w);
  const set=[correct,"die "+w.de,((w.art==="der"?"die":"der")+" "+w.plural),("das "+w.plural)];
  const uniq=[];set.forEach(s=>{if(uniq.indexOf(s)<0)uniq.push(s);});
  let i=0;while(uniq.length<4){i++;const cand=("die "+w.de+(i===1?"en":(i===2?"e":"er")));if(uniq.indexOf(cand)<0)uniq.push(cand);}
  return shuffle(uniq.slice(0,4));
}
/* مولّد الأمثلة: مثال فريد لكل كلمة — سياق حقيقي مناسب لمستوى A1/A2 مع ترجمة عربية.
   حتمي (نفس الناتج كل مرة): الاختيار بهاش الكلمة + رقمها، والجملة تحتوي الكلمة نفسها فلا تطابق أبدًا. */
function hashStr(s){let h=0;for(let i=0;i<s.length;i++){h=((h*31)+s.charCodeAt(i))|0;}return h<0?-h:h;}
function artAkk(a){return a==="der"?"den":a;}
function artDat(a){return a==="der"?"dem":a==="die"?"der":a==="das"?"dem":a;}
function meinDat(a){return a==="der"?"meinem":a==="die"?"meiner":"meinem";}
function capA(a){return a.charAt(0).toUpperCase()+a.slice(1);}
const ADV_AR={heute:"اليوم",morgen:"غدًا",jetzt:"الآن",oft:"غالبًا",gern:"بسرور","jeden Tag":"كل يوم",gestern:"أمس",schon:"من قبل","am Sonntag":"يوم الأحد"};
function fillTpl(t,c,adv,advAr){return t.split("{A}").join(capA(c.art)).split("{art}").join(c.art).split("{akk}").join(artAkk(c.art)).split("{dat}").join(artDat(c.art)).split("{datMein}").join(meinDat(c.art)).split("{de}").join(c.de).split("{ar}").join(c.ar).split("{adv}").join(adv||"").split("{advAr}").join(advAr||"").replace(/  +/g," ").trim();}
function pickFrame(frames,h,n){return frames[(h+n*7)%frames.length];}
const NOUN_UNIV=[
{de:"Ich kenne {akk} {de} gut.",ar:"أعرف {ar} جيدًا."},
{de:"Ich brauche {akk} {de} {adv}.",ar:"أحتاج {ar} {advAr}.",adv:["heute","morgen","jetzt"]},
{de:"Ich suche {akk} {de}.",ar:"أبحث عن {ar}."},
{de:"Ich habe {akk} {de} nicht gefunden.",ar:"لم أجد {ar}."},
{de:"Siehst du {akk} {de}?",ar:"هل ترى {ar}؟"},
{de:"Kennst du {akk} {de}?",ar:"هل تعرف {ar}؟"},
{de:"Wo ist {art} {de}?",ar:"أين {ar}؟"},
{de:"Ich mag {akk} {de} sehr.",ar:"أحب {ar} كثيرًا."},
{de:"Wir sprechen über {akk} {de}.",ar:"نتحدث عن {ar}."},
{de:"Ich denke oft an {akk} {de}.",ar:"أفكر كثيرًا في {ar}."},
{de:"Ich warte auf {akk} {de}.",ar:"أنتظر {ar}."},
{de:"Er fragt nach {dat} {de}.",ar:"هو يسأل عن {ar}."},
{de:"Ich erzähle von {dat} {de}.",ar:"أحكي عن {ar}."},
{de:"Ich sehe {akk} {de} {adv}.",ar:"أرى {ar} {advAr}.",adv:["jeden Tag","oft","gern"]},
{de:"Hast du {akk} {de} schon gesehen?",ar:"هل رأيت {ar} من قبل؟"},
{de:"Ich möchte {akk} {de} nicht.",ar:"لا أريد {ar}."},
{de:"Kannst du {akk} {de} sehen?",ar:"هل يمكنك رؤية {ar}؟"},
{de:"Ich muss {akk} {de} finden.",ar:"يجب أن أجد {ar}."},
{de:"Wir haben {akk} {de} {adv} gesehen.",ar:"رأينا {ar} {advAr}.",adv:["gestern","heute","oft"]},
{de:"Er liebt {akk} {de}.",ar:"هو يحب {ar}."},
{de:"Er zeigt mir {akk} {de}.",ar:"هو يُريني {ar}."},
{de:"Wir brauchen {akk} {de} nicht.",ar:"لا نحتاج {ar}."},
{de:"Ich hole {akk} {de} {adv}.",ar:"سأُحضر {ar} {advAr}.",adv:["heute","morgen","jetzt"]},
{de:"Hast du {akk} {de} dabei?",ar:"هل {ar} معك؟"},
{de:"Ich verstehe {akk} {de} nicht.",ar:"لا أفهم {ar}."},
{de:"Er kennt {akk} {de} nicht.",ar:"هو لا يعرف {ar}."},
{de:"Was machst du mit {dat} {de}?",ar:"ماذا تفعل بـ {ar}؟"},
{de:"Wie findest du {akk} {de}?",ar:"ما رأيك في {ar}؟"}];
const FAMILY_EXTRA=[
{de:"Ich besuche {akk} {de} {adv}.",ar:"أزور {ar} {advAr}.",adv:["am Sonntag","heute","morgen"]},
{de:"Ich rufe {akk} {de} {adv} an.",ar:"أتصل بـ {ar} {advAr}.",adv:["heute","morgen","oft"]},
{de:"Ich helfe {datMein} {de}.",ar:"أساعد {ar}."}];
const FOOD_EXTRA=[
{de:"{A} {de} schmeckt gut.",ar:"مذاق {ar} جيد."},
{de:"Ich kaufe {akk} {de} im Supermarkt.",ar:"أشتري {ar} من السوبرماركت."},
{de:"Möchtest du {akk} {de}?",ar:"هل تريد {ar}؟"}];
const FOOD_ONLY={de:"Wir essen {akk} {de} gern.",ar:"نأكل {ar} بسرور."};
const DRINK_ONLY={de:"Wir trinken {akk} {de} gern.",ar:"نشرب {ar} بسرور."};
const DAY_FRAMES=[
{de:"Heute ist {de}.",ar:"اليوم {ar}."},
{de:"Am {de} habe ich Zeit.",ar:"يوم {ar} لدي وقت."},
{de:"Wir treffen uns am {de}.",ar:"نلتقي يوم {ar}."},
{de:"Am {de} arbeite ich nicht.",ar:"يوم {ar} لا أعمل."},
{de:"Bist du am {de} da?",ar:"هل أنت موجود يوم {ar}؟"},
{de:"Der Kurs ist am {de}.",ar:"الكورس يوم {ar}."}];
const COUNTRY_FRAMES=[
{de:"Ich komme aus {de}.",ar:"أنا من {ar}."},
{de:"Er wohnt in {de}.",ar:"هو يسكن في {ar}."},
{de:"Wir fahren nach {de}.",ar:"نسافر إلى {ar}."},
{de:"Kennst du {de}?",ar:"هل تعرف {ar}؟"},
{de:"Die Reise nach {de} ist schön.",ar:"الرحلة إلى {ar} جميلة."},
{de:"Er lebt in {de}.",ar:"هو يعيش في {ar}."},
{de:"Ich möchte nach {de} reisen.",ar:"أريد السفر إلى {ar}."},
{de:"Bist du aus {de}?",ar:"هل أنت من {ar}؟"},
{de:"Das Wetter in {de} ist gut.",ar:"الطقس في {ar} جيد."},
{de:"Ich arbeite in {de}.",ar:"أعمل في {ar}."}];
const LANG_FRAMES=[
{de:"Ich spreche {de}.",ar:"أتحدث {ar}."},
{de:"Ich lerne {de}.",ar:"أتعلم {ar}."},
{de:"Er spricht {de}.",ar:"هو يتحدث {ar}."},
{de:"Lernst du {de}?",ar:"هل تتعلم {ar}؟"},
{de:"Ich übe {de} jeden Tag.",ar:"أتدرب على {ar} كل يوم."},
{de:"Mein {de} ist gut.",ar:"مستواي في {ar} جيد."},
{de:"Sprichst du {de}?",ar:"هل تتحدث {ar}؟"},
{de:"Wir lernen {de} zusammen.",ar:"نتعلم {ar} معًا."},
{de:"Ich verstehe {de} nicht.",ar:"لا أفهم {ar}."},
{de:"Magst du {de}?",ar:"هل تحب {ar}؟"}];
const MONTH_FRAMES=[
{de:"Mein Geburtstag ist im {de}.",ar:"عيد ميلادي في {ar}."},
{de:"Das Wetter im {de} ist schön.",ar:"الطقس في {ar} جميل."},
{de:"Wir reisen im {de}.",ar:"نسافر في {ar}."},
{de:"Im {de} lerne ich viel.",ar:"في {ar} أتعلم كثيرًا."},
{de:"Der Kurs beginnt im {de}.",ar:"يبدأ الكورس في {ar}."},
{de:"Bist du im {de} da?",ar:"هل أنت موجود في {ar}؟"},
{de:"Im {de} habe ich Urlaub.",ar:"في {ar} لدي إجازة."},
{de:"Im {de} ist es warm.",ar:"في {ar} الجو دافئ."}];
const NUMBER_FRAMES=[
{de:"Die Zahl {de} ist klein.",ar:"الرقم {ar} صغير."},
{de:"Ich schreibe {de}.",ar:"أكتب {ar}."},
{de:"Die Hausnummer ist {de}.",ar:"رقم المنزل هو {ar}."},
{de:"Die Antwort ist {de}.",ar:"الإجابة هي {ar}."},
{de:"Das kostet {de} Euro.",ar:"سعر هذا {ar} يورو."},
{de:"Ich zähle: eins, zwei, {de}.",ar:"أعد: واحد، اثنان، {ar}."},
{de:"Ich wähle die Nummer {de}.",ar:"أختار الرقم {ar}."},
{de:"Kennst du die Zahl {de}?",ar:"هل تعرف الرقم {ar}؟"}];
/* الصفات: فاعل ألماني صحيح + ترجمة عربية بصيغة ثابتة لا تتأثر بالجنس */
const SUBJ_T=[["der","Film","الفيلم"],["das","Buch","الكتاب"],["der","Tag","اليوم"],["das","Wetter","الطقس"],["das","Essen","الطعام"],["der","Kuchen","الكعك"],["der","Hund","الكلب"],["der","Zug","القطار"],["die","Frage","السؤال"],["die","Antwort","الجواب"],["die","Übung","التمرين"],["die","Tür","الباب"],["das","Haus","البيت"],["das","Brot","الخبز"],["der","Tee","الشاي"],["der","Käse","الجبن"],["der","Preis","السعر"],["der","Test","الاختبار"],["der","Stift","القلم"],["die","Wand","الحائط"],["die","Farbe","اللون"],["die","Woche","الأسبوع"],["das","Verb","الفعل"],["der","Artikel","الأداة"]];
const SUBJ_P=[["Er","هو"],["Ich","أنا"],["Wir","نحن"],["Mein Bruder","أخي"],["Mein Vater","أبي"],["Mein Mann","زوجي"],["Mein Sohn","ابني"],["Mein Freund","صديقي"],["Der Mann","الرجل"],["Der Lehrer","المعلم"]];
function subjNom(s){if(s[0]==="Er"||s[0]==="Ich"||s[0]==="Wir"||s[0].indexOf("Mein")===0)return s[0];if(s[0]==="Der Mann"||s[0]==="Der Lehrer")return s[0];return capA(s[0])+" "+s[1];}
function subjAkk(s){if(s[0]==="Er"||s[0]==="Ich"||s[0]==="Wir")return s[0];if(s[0].indexOf("Mein")===0)return s[0];if(s[0]==="Der Mann"||s[0]==="Der Lehrer")return "den "+s[0].split(" ")[1];return (s[0]==="der"?"den":s[0])+" "+s[1];}
const ADJ_P_ONLY=["ledig","verheiratet","geschieden","verwitwet","verlobt","schwanger","krank","satt","wach","Portugiese"];
const ADJ_COLOR=["blau","grün","rot"];
const ADJ_TASTE=["lecker","süß","frisch"];
function autoExample(de,art,type,cat,ar,n){
  const idx=(typeof n==="number")?n:0;
  const h0=hashStr(de+"|"+art+"|"+cat)^((idx*2654435761)|0);
  const H=h0<0?-h0:h0;
  const H2=(function(){const x=hashStr(cat+"#"+de);return x<0?-x:x;})();
  if(type==="صفة"){
    if(de==="gegenseitig")return ["Wir helfen uns gegenseitig.","نساعد بعضنا."];
    if(de==="verschieden")return ["Jeder Tag ist verschieden.","كل يوم مختلف."];
    if(de==="männlich"||de==="weiblich")return ["Der Artikel ist "+de+".","الأداة "+ar+"."];
    let poolS,skel;
    if(ADJ_P_ONLY.indexOf(de)>=0){poolS=SUBJ_P;skel=H%5;}
    else if(ADJ_COLOR.indexOf(de)>=0){poolS=[SUBJ_T[20],SUBJ_T[19],SUBJ_T[18]];skel=H%4;}
    else if(ADJ_TASTE.indexOf(de)>=0){poolS=[SUBJ_T[4],SUBJ_T[5],SUBJ_T[13],SUBJ_T[14],SUBJ_T[15]];skel=H%4;}
    else if((H>>3)%2===0){poolS=SUBJ_T;skel=(H>>2)%5;}
    else{poolS=SUBJ_P;skel=(H>>2)%5;}
    const s=poolS[(H2>>8)%poolS.length];
    const sar=s[2]||s[0];
    if(poolS===SUBJ_T){
      if(skel===0)return [subjNom(s)+" ist "+de+".",sar+" "+ar+"."];
      if(skel===1)return ["Ich finde "+subjAkk(s)+" "+de+".","أجد "+sar+" "+ar+"."];
      if(skel===2)return ["Ist "+subjNom(s)+" "+de+"?","هل "+sar+" "+ar+"؟"];
      if(skel===3)return [subjNom(s)+" ist nicht "+de+".",sar+" ليس "+ar+"."];
      return ["Wir finden "+subjAkk(s)+" "+de+".","نجد "+sar+" "+ar+"."];
    }
    if(skel===0)return [subjNom(s)+" ist "+de+".",sar+" "+ar+"."];
    if(skel===1)return ["Bist du "+de+"?","هل أنت "+ar+"؟"];
    if(skel===2)return ["Wir sind "+de+".","نحن "+ar+"."];
    if(skel===3)return ["Ich bin "+de+".","أنا "+ar+"."];
    return ["Ist er "+de+"?","هل هو "+ar+"؟"];
  }
  if(art==="-"&&type==="اسم"&&cat==="Travel")return simplePick(COUNTRY_FRAMES,de,ar,H);
  if(art==="-"&&type==="اسم"&&cat==="Languages")return simplePick(LANG_FRAMES,de,ar,H);
  if(cat==="Months")return simplePick(MONTH_FRAMES,de,ar,H);
  if(cat==="Numbers")return simplePick(NUMBER_FRAMES,de,ar,H);
  if(type==="فعل")return ["Ich möchte "+de+".","(أريد) "+ar];
  if(type==="اسم"&&art!=="-"){
    const c={art:art,de:de,ar:ar};
    let pool=NOUN_UNIV;
    if(cat==="Family")pool=FAMILY_EXTRA.concat(NOUN_UNIV);
    else if(cat==="Food"||cat==="Drinks")pool=FOOD_EXTRA.concat([(cat==="Drinks"?DRINK_ONLY:FOOD_ONLY)]).concat(NOUN_UNIV);
    else if(cat==="Days")pool=DAY_FRAMES.concat(NOUN_UNIV);
    const f=pickFrame(pool,H,idx);
    let adv="",advAr="";
    if(f.adv){adv=f.adv[(H>>4)%f.adv.length];advAr=ADV_AR[adv]||adv;}
    return [fillTpl(f.de,c,adv,advAr),fillTpl(f.ar,c,adv,advAr)];
  }
  if(cat==="Days")return ["Am "+de+" lerne ich.","أتعلم يوم "+ar+"."];
  if(cat==="Languages")return ["Ich spreche "+de+".","أنا أتحدث "+ar+"."];
  if(cat==="Travel"&&art==="-")return ["Ich komme aus "+de+".","أنا من "+ar+"."];
  return [de+".",ar];
}
function simplePick(frames,de,ar,H){const f=frames[H%frames.length];return [f.de.split("{de}").join(de).split("{ar}").join(ar),f.ar.split("{de}").join(de).split("{ar}").join(ar)];}
function buildVocab(){
  const blocks=[["K0",RAW_K0],["K1",RAW_K1],["K2",RAW_K2],["K3",RAW_K3],["K4",RAW_K4],["K5",RAW_K5]];
  const out=[],seen={};let n=0;
  blocks.forEach(function(b){
    const kap=b[0];
    b[1].forEach(function(r){
      const key=r[0]+"|"+r[1];
      if(seen[key])return;seen[key]=1;n++;
      const auto=autoExample(r[0],r[1],r[4],r[5],r[2],n);
      out.push({id:"k"+kap.toLowerCase()+"w"+n,de:r[0],art:r[1],ar:r[2],pron:r[3],type:r[4],cat:r[5],ex:r[6]||auto[0],exAr:r[7]||auto[1],kap:kap,level:"A1",plural:PLURAL[r[0]+"|"+r[1]]||""});
    });
  });
  return out;
}
const VOCAB = buildVocab();

/* ============ الجمل من صورك - مقسمة لكل Kapitel [de, ar, pron, kap] ============ */
const RAW_SENT = [
["Ich liebe dich.","أنا أحبك.","إش ليبه دِش","K1"],
["Sie wohnt in Tanta.","هي تسكن في طنطا.","زي فونت إن تانتا","K1"],
["Du kommst morgen.","أنت تأتي غدًا.","دو كومست مورجن","K1"],
["Mona liebt Schokolade.","منى تحب الشيكولاتة.","مونا ليبت شوكولاده","K1"],
["Wir hören gut.","نحن نسمع جيدًا.","فير هورن جوت","K1"],
["Er lebt in England.","هو يعيش في إنجلترا.","إر ليبت إن إنجلانت","K1"],
["Ich spreche Deutsch.","أنا أتحدث الألمانية.","إش شبريشه دويتش","K1"],
["Du sprichst Deutsch gut.","أنت تتحدث الألمانية جيدًا.","دو شبريخست دويتش جوت","K1"],
["Du bist mein Bruder.","أنت أخي.","دو بست ماين برودر","K1"],
["Ich bin Mohammad.","أنا محمد.","إش بن محمد","K1"],
["Ich habe einen Laptop.","لدي لابتوب.","إش هابه آينن لابتوب","K1"],
["Guten Morgen!","صباح الخير!","جوتن مورجن","K1"],
["Guten Tag!","طاب يومك!","جوتن تاج","K1"],
["Guten Abend!","مساء الخير!","جوتن آبنت","K1"],
["Hallo!","أهلًا!","هالو","K1"],
["Auf Wiedersehen!","إلى اللقاء!","أوف فيدرزين","K1"],
["Gute Nacht!","تصبح على خير!","جوته ناخت","K1"],
["Tschüs!","مع السلامة!","تشوس","K1"],
["Bis bald!","إلى قريب!","بس بالت","K1"],
["Wie heißt du?","ما اسمك؟","في هايست دو","K1"],
["Ich heiße Niklas.","اسمي نيكلاس.","إش هايسه نيكلاس","K1"],
["Ich bin Julia.","أنا جوليا.","إش بن يوليا","K1"],
["Woher kommst du?","من أين أنت؟","فوهير كومست دو","K1"],
["Ich komme aus Spanien.","أنا من إسبانيا.","إش كومه أوس شبانين","K1"],
["Ich komme aus Ägypten.","أنا من مصر.","إش كومه أوس إيجيبتن","K1"],
["Ich bin aus der Türkei.","أنا من تركيا.","إش بن أوس دير توركاي","K1"],
["Welche Sprachen sprichst du?","أي لغات تتحدث؟","فلشه شبراخن شبريخست دو","K1"],
["Ich spreche Deutsch und Russisch.","أتحدث الألمانية والروسية.","إش شبريشه دويتش أوند روسِش","K1"],
["Ich spreche Spanisch und ein bisschen Deutsch.","أتحدث الإسبانية وقليلًا من الألمانية.","","K1"],
["Wo wohnst du?","أين تسكن؟","فو فونست دو","K1"],
["Ich wohne in Berlin.","أنا أسكن في برلين.","إش فونه إن برلين","K1"],
["In Berlin auch.","في برلين أيضًا.","إن برلين أوخ","K1"],
["Freut mich!","تشرفت!","فرويت مِش","K1"],
["Wie geht's?","كيف الحال؟","في جيتس","K1"],
["Danke, sehr gut.","شكرًا، بخير جدًا.","دانكه زير جوت","K1"],
["Ganz gut. Und dir?","بخير. وأنت؟","جانتس جوت أوند دير","K1"],
["Das ist Ali.","هذا علي.","داس إست علي","K1"],
["Das sind meine Freunde.","هؤلاء أصدقائي.","داس زِند ماينه فروينده","K1"],
["Wer ist das?","من هذا؟","فير إست داس","K1"],
["Ich weiß nicht.","لا أعرف.","إش فايس نيشت","K1"],
["Ich verstehe das nicht.","أنا لا أفهم هذا.","إش فيرشتيه داس نيشت","K1"],
["Ein bisschen langsamer, bitte.","أبطأ قليلًا من فضلك.","","K1"],
["Wie bitte?","عفوًا؟","في بته","K1"],
["Ich bin verwitwet.","أنا أرمل.","إش بن فيرفتفت","K2"],
["Nein, ich bin single.","لا، أنا أعزب.","ناين إش بن سنجل","K2"],
["Sie ist in Kairo geboren.","هي وُلدت في القاهرة.","زي إست إن كايرو جيبورن","K2"],
["Was ist deine Lieblingsjahreszeit?","ما فصلك المفضل؟","","K2"],
["Das ist der Hafen von Hamburg.","هذا ميناء هامبورج.","داس إست دير هافن فون هامبورج","K3"],
["Das ist ein Hafen.","هذا ميناء (ما).","داس إست آين هافن","K3"],
["Haben Sie Kinder?","هل لديك أطفال؟","هابن زي كندر","K3"],
["Ja, ich habe ein Kind.","نعم، لدي طفل.","يا إش هابه آين كند","K3"],
["Nein, ich habe keine Kinder.","لا، ليس لدي أطفال.","ناين إش هابه كاينه كندر","K3"],
["Das ist kein Fluss.","هذا ليس نهرًا.","داس إست كاين فلوس","K3"],
["Fragen Sie!","اسأل (رسمي)!","فراجن زي","K3"],
["Gehen Sie links!","اذهب يسارًا!","جين زي لينكس","K3"],
["Fahren Sie geradeaus!","سِر للأمام!","فارن زي جراده أوس","K3"],
["Ich studiere Deutsch im Jahr 2055.","أدرس الألمانية عام 2055.","","K3"],
["Wie alt bist du?","كم عمرك؟","في آلت بست دو","K3"],
["Ich bin 15 Jahre alt.","عمري 15 سنة.","إش بن فونفتسين ياره آلت","K3"],
["Wo ist bitte das Café?","أين المقهى من فضلك؟","","K3"],
["Jetzt kommst du dran.","الآن دورك.","يتست كومست دو دران","K4"],
["Wir führen ein Gespräch.","نحن نُجري محادثة.","فير فورن آين جشبريش","K4"],
["Ich bin der Lehrer.","أنا المعلم.","إش بن دير ليرر","K4"],
["Er wird mein Mann.","هو سيُصبح زوجي.","","K4"],
["Sie bleibt meine Freundin.","هي ستبقى صديقتي.","","K4"],
["Wer besucht meinen Bruder?","من يزور أخي؟","فير بزوخت ماينن برودر","K4"],
["Der Freund besucht ihn.","الصديق يزوره.","دير فرويند بزوخت إين","K4"],
["Wen liebt der Sohn?","الابن يحب من؟","فين ليبت دير زون","K4"],
["Der Sohn liebt die Mutter.","الابن يحب الأم.","دير زون ليبت دي موتر","K4"],
["Wen trifft der Lehrer?","المعلم يُقابل من؟","","K4"],
["Der Lehrer trifft den Schüler.","المعلم يُقابل التلميذ.","","K4"],
["Was isst du?","ماذا تأكل؟","فاس إست دو","K4"],
["Ich esse einen Apfel.","أنا آكل تفاحة.","إش إسه آينن أبفل","K4"],
["Was kostet das?","ما سعر هذا؟","فاس كوستت داس","K4"],
["Ist das alles?","هل هذا كل شيء؟","إست داس ألس","K4"],
["Wer kommt dran?","من عليه الدور؟","فير كومت دران","K4"],
["Was möchten Sie?","ماذا تريد حضرتك؟","فاس موشتن زي","K4"],
["Wo finde ich Reis?","أين أجد الأرز؟","","K4"],
["Ich brauche noch eine Tüte.","أحتاج كيسًا آخر.","إش براوخه نوخ آينه توته","K4"],
["Guten Appetit!","بالهناء والشفاء!","جوتن أبيتيت","K4"],
["Danke, gleichfalls!","شكرًا وبالمثل!","دانكه جلايش فالس","K4"],
["Nein danke, ich bin satt.","لا شكرًا، أنا شبعان.","ناين دانكه إش بن زات","K4"],
["Fleisch schmeckt sehr gut.","اللحم طعمه جيد جدًا.","فلايش شمِكت زير جوت","K4"],
["Fleisch ist sehr lecker.","اللحم لذيذ جدًا.","","K4"],
["Mein Freund isst kein Fleisch.","صديقي لا يأكل اللحم.","","K4"],
["Du kannst toll Deutsch sprechen.","تستطيع التحدث بالألمانية ببراعة.","","K5"],
["Kann ich ein Glas Wasser trinken?","هل يمكنني شرب كوب ماء؟","","K5"],
["Ich frühstücke um 6 Uhr.","أنا أفطر السادسة.","إش فرو شتوكه أوم زكس أور","K5"],
["Mein Freund arbeitet von 6 bis 9 Uhr.","صديقي يعمل من 6 إلى 9.","","K5"],
["Haben Sie Geschwister?","هل لديك إخوة؟","هابن زي جِشفيستر","K5"],
["Ja, ich habe einen Bruder.","نعم، لدي أخ.","يا إش هابه آينن برودر","K5"],
["Nein, ich habe keine Geschwister.","لا، ليس لدي إخوة.","","K5"],
["Entschuldigung, ich bin zu spät.","عذرًا، لقد تأخرت.","إنتشولديجونج إش بن تسو شبيت","K5"],
["Es tut mir leid.","أنا آسف.","إس توت مير لايد","K5"],
["Kein Problem.","لا مشكلة.","كاين بروبلم","K5"],
["Macht nichts.","لا بأس.","ماخت نيشتس","K5"],
["Das nächste Mal bitte pünktlich!","المرة القادمة كن منضبطًا!","","K5"],
["Ich bitte um Entschuldigung.","أنا أطلب المعذرة.","إش بته أوم إنتشولديجونج","K5"],
["Was kann ich für Sie tun?","ماذا يمكنني أن أفعل لك؟","","K5"],
["Wir haben einen Termin vereinbart.","لقد اتفقنا على موعد.","","K5"],
["Ziehen Sie eine Karte!","اسحب كارتًا!","تسيِن زي آينه كارته","K5"],
["Wie viel Uhr ist es?","كم الساعة؟","في فيل أور إست إس","K5"],
["Euer Hund ist so süß.","كلبكم لطيف جدًا.","أوير هوند إست زو زوس","K5"],
["Er kommt zu spät.","هو يأتي متأخرًا.","إر كومت تسو شبيت","K5"],
["Liebe Grüße!","تحياتي القلبية!","ليبه جروسه","K5"],
["Ich lerne Deutsch.","أنا أتعلم الألمانية.","إش ليرنه دويتش","K1"],
["Sprechen Sie Englisch?","هل تتحدث الإنجليزية؟","شبريشن زي إنجليش","K1"]
];
/* ============ القواعد من صورك - مقسمة لكل Kapitel ============ */
const RAW_GRAM = [
["der / die / das","K0","كل اسم في الألمانية له جنس (أداة) يُحفظ معه: مذكر der، مؤنث die، محايد das. ولا يوجد سبب منطقي — الحفظ هو الحل.","der Freund|الصديق","die Straße|الشارع","das Land|البلد","ما أداة كلمة Tisch؟","der|die|das","0","Tisch مذكر: der Tisch."],
["الجمع في الألمانية","K0","الجمع مختلف لكل اسم ويُحفظ مع المفرد، وأداة الجمع دائمًا die. مثال: das Land تصبح die Länder.","das Land => die Länder|البلد => البلاد","die Straße => die Straßen|الشارع => الشوارع","ما جمع Land؟","Länder|Lands|Landens","0","das Land جمعها die Länder."],
["الحرف الكبير","K0","أول حرف يكون كبيرًا دائمًا في 4 حالات: أول الجملة، اسم العلم، الاسم (المعرف وغيره)، ضمير المخاطب الرسمي Sie.","das Buch|الاسم يُكتب كبيرًا","Sie|حضرتك تُكتب كبيرة","أي كلمة تُكتب كبيرة دائمًا؟","Buch|bin|und","0","الأسماء تُكتب بحرف كبير: das Buch."],
["ضمائر الفاعل","K1","ich أنا، du أنت، er هو، es هو (للمحايد)، sie هي، wir نحن، ihr أنتم، sie هم، Sie حضرتك.","ich - du - er|أنا - أنت - هو","wir - ihr - Sie|نحن - أنتم - حضرتك","ما معنى wir؟","نحن|أنتم|هم","0","wir = نحن."],
["الأفعال المنتظمة","K1","نحذف en من المصدر ثم نضيف: ich بـ e، du بـ st، er بـ t، wir بالمصدر، ihr بـ t، sie بالمصدر.","ich komme|أنا آتي","du kommst|أنت تأتي","صرف lernen مع du؟","du lerne|du lernst|du lernt","1","du تأخذ st: du lernst."],
["الأفعال الشاذة","K1","نفس النهايات لكن الجذر يتغير أحيانًا — وأهمها sein و haben و sprechen.","ich bin|أنا أكون","ich habe|أنا أملك","أكمل: ich ___ (يكون)؟","bin|bist|ist","0","مع ich نقول: ich bin."],
["التحيات رسمي/غير رسمي","K1","التحية الرسمية كاملة (Guten Morgen) وغير الرسمية مختصرة (Morgen) أو Hallo و Tschüs.","Guten Morgen!|صباح الخير! (رسمي)","Hallo! Tschüs!|أهلًا! مع السلامة! (غير رسمي)","ما التحية الرسمية صباحًا؟","Guten Morgen|Hallo|Tschüs","0","Guten Morgen هي الصيغة الرسمية."],
["السؤال عن الاسم والموطن واللغة","K1","عن الاسم: Wie heißen Sie؟ عن الموطن: Woher kommen Sie؟ (مع aus + البلد) عن اللغة: Was sprechen Sie؟","Ich komme aus Ägypten.|أنا من مصر.","Was sprechen Sie?|ماذا تتحدث؟","Woher kommen Sie تسأل عن؟","الموطن|الاسم|العمر","0","woher = من أين: السؤال عن الموطن."],
["das بمعنيين","K1","das أداة المحايد (das Buch) وأيضًا اسم إشارة (هذا/هذه/هؤلاء): Das ist Ali / Das sind Frauen.","Das ist Ali.|هذا علي.","Das sind Frauen.|هؤلاء نساء.","Das sind Frauen تعني؟","هؤلاء نساء|هذا رجل|هذه امرأة","0","مع الجمع das تعني هؤلاء."],
["W-Fragen","K1","أدوات الاستفهام: Was ماذا، Wer من، Wo أين، Woher من أين، Wie كيف، Wann متى. والفعل ثانيًا.","Wo wohnst du?|أين تسكن؟","Wer ist das?|من هذا؟","ما معنى Wo؟","أين|متى|كيف","0","Wo = أين."],
["أدوات البلاد","K2","معظم البلاد بدون أداة (Deutschland) لكن بعضها مؤنث: die Schweiz و die Türkei و die Ukraine.","Ich komme aus Spanien.|أنا من إسبانيا.","Ich bin aus der Türkei.|أنا من تركيا.","ما أداة Schweiz؟","die|der|das","0","سويسرا مؤنثة: die Schweiz."],
["أيام الأسبوع","K2","أيام الأسبوع مذكرة وتُستخدم مع حرف الجر am: am Montag.","Am Montag lerne ich.|أتعلم يوم الاثنين.","Heute ist Sonntag.|اليوم الأحد.","أكمل: ___ Montag؟","am|im|um","0","أيام الأسبوع تأخذ am."],
["المعرفة والنكرة","K3","المعرفة der/die/das لشيء معروف، والنكرة ein/eine لشيء غير معروف، والجمع النكرة بدون أداة.","Das ist der Hafen.|هذا هو الميناء (معروف).","Das ist ein Hafen.|هذا ميناء (غير معروف).","أكمل (معرفة): Das ist ___ Hafen؟","der|ein|kein","0","المعرفة للمذكر: der Hafen."],
["النفي kein / keine","K3","ننفي الاسم النكرة بـ kein (مذكر/محايد) و keine (مؤنث/جمع).","Ich habe ein Kind.|لدي طفل.","Ich habe keine Kinder.|ليس لدي أطفال.","أكمل: Ich habe ___ Kinder؟","keine|kein|nicht","0","Kinder جمع: keine Kinder."],
["الأمر الرسمي","K3","مع Sie نضع الفعل بالمصدر أولًا ثم Sie ثم علامة تعجب.","Fragen Sie!|اسأل!","Gehen Sie links!|اذهب يسارًا!","ما الأمر الرسمي من fragen؟","Fragen Sie!|Fragst du!|Frage!","0","الأمر الرسمي: المصدر + Sie."],
["الفعل في المرتبة الثانية","K3","القاعدة الذهبية: الفعل المُصرّف يأتي ثانيًا دائمًا في الجملة الخبرية.","Ich lerne heute.|أتعلم اليوم.","Heute lerne ich.|اليوم أتعلم.","أين يأتي الفعل المُصرّف؟","الثانية|الأولى|الأخيرة","0","الفعل المُصرّف ثانيًا دائمًا."],
["حروف الزمن im / am","K3","مع الشهور والفصول: im (im Sommer) ومع الأيام والأوقات: am (am Montag) عدا Nacht فهي in der Nacht.","Im Sommer.|في الصيف.","Am Freitag.|يوم الجمعة.","أكمل: ___ Sommer؟","Im|Am|Um","0","الفصول تأخذ im."],
["nicht أم kein","K3","nicht تنفي الفعل والصفة والاسم المعرف، و kein تنفي الاسم النكرة فقط.","Ich studiere nicht.|أنا لا أدرس.","Hast du kein Auto?|أليس لديك سيارة؟","كيف تنفي الفعل liebe؟","ich liebe nicht|ich kein liebe|ich liebe kein","0","الفعل يُنفى بـ nicht بعده."],
["السؤال عن العمر","K3","نسأل: Wie alt bist du؟ ونجيب: Ich bin … Jahre alt.","Wie alt bist du?|كم عمرك؟","Ich bin 15 Jahre alt.|عمري 15 سنة.","كيف تسأل عن العمر؟","Wie alt bist du?|Wie heißt du?|Wo wohnst du?","0","العمر: Wie alt bist du؟"],
["Akkusativ","K4","حالة المفعول: التغيير فقط في المذكر (der→den و ein→einen و kein→keinen و mein→meinen).","Ich esse einen Apfel.|آكل تفاحة.","Wen liebt der Sohn?|الابن يحب من؟","أكمل: Ich habe ___ Apfel؟","einen|ein|einem","0","المذكر مفعول: einen Apfel."],
["أفعال Nominativ","K4","أفعال sein و werden و bleiben يأتي بعدها Nominativ (بدون تغيير).","Ich bin der Lehrer.|أنا المعلم.","Er wird mein Mann.|سيُصبح زوجي.","أكمل: Ich bin ___ Lehrer؟","der|den|dem","0","بعد sein تبقى der."],
["ضمائر Akkusativ","K4","الضمائر تتغير في المفعول: mich و dich و ihn و uns و euch.","Ich liebe dich.|أنا أحبك.","Der Freund besucht ihn.|الصديق يزوره.","أكمل: Ich liebe ___؟","dich|du|dein","0","المفعول من du هو dich."],
["wer / wen / was","K4","نسأل عن الفاعل العاقل بـ wer، وعن المفعول العاقل بـ wen، وعن غير العاقل بـ was.","Wer besucht ihn?|من يزوره؟","Was isst du?|ماذا تأكل؟","نسأل عن المفعول العاقل بـ؟","Wen|Wer|Was","0","المفعول العاقل: wen."],
["محادثة الأسعار","K4","في المحل: Was kostet das؟ (كم السعر) و Sonst noch etwas؟ (شيء آخر) و Guten Appetit!","Was kostet das?|كم سعر هذا؟","Sonst noch etwas?|شيء آخر؟","Was kostet das تسأل عن؟","السعر|الوقت|الاسم","0","kosten = يتكلف: السؤال عن السعر."],
["Modalverben","K5","فعل الكيفية (können/müssen/wollen) ليس أساسيًا بل يأتي معه الفعل الأساسي بالمصدر في آخر الجملة.","Ich kann Deutsch sprechen.|أستطيع التحدث بالألمانية.","Ich muss lernen.|يجب أن أتعلم.","أين يأتي الفعل الأساسي مع المساعد؟","المصدر آخر الجملة|مُصرّف ثانيًا|محذوف","0","الأساسي بالمصدر في آخر الجملة."],
["um / von…bis","K5","مع الساعة تمامًا: um (um 6 Uhr) ومن…إلى: von…bis ونسأل بـ wann و wie lange.","Ich frühstücke um 6 Uhr.|أفطر السادسة.","Von 6 bis 9 Uhr.|من 6 إلى 9.","أكمل: ___ 6 Uhr؟","um|am|im","0","الساعة تمامًا تأخذ um."],
["Possessiv في Nom و Akk","K5","ضمائر الملكية تتغير مع المذكر المفعول: mein→meinen و dein→deinen.","Mein Name ist Ahmed.|اسمي أحمد.","Wer besucht meinen Bruder?|من يزور أخي؟","أكمل (أمي): ___ Mutter ist nett؟","Meine|Mein|Meinen","0","Mutter مؤنث: Meine Mutter."],
["الساعة رسمي/غير رسمي","K5","الرسمية ein Uhr والعامية eins، والنصف يُحسب للساعة القادمة: halb vier = 3:30.","Es ist ein Uhr.|الساعة الواحدة.","Es ist halb vier.|الثالثة والنصف.","halb vier تعني؟","3:30|4:30|4:00","0","النصف للساعة القادمة: 3:30."],
["الاعتذار والرد","K5","نعتذر: Es tut mir leid / Entschuldigen Sie، ونرد: Kein Problem / Macht nichts / Schon gut.","Es tut mir leid.|أنا آسف.","Kein Problem.|لا مشكلة.","ما الرد على Entschuldigung؟","Kein Problem.|Guten Tag.|Danke.","0","الرد: Kein Problem (لا مشكلة)."],
["Dativ مع mit/bei/aus","K5","حروف mit و bei و aus و von و seit تأخذ Dativ دائمًا.","Ich komme mit dir.|آتي معك.","Ich bin bei dir.|أنا عندك.","أي حالة بعد mit؟","Dativ|Akkusativ|Nominativ","0","mit دائمًا + Dativ."],
["Ja/Nein-Fragen","K1","السؤال يبدأ بالفعل المُصرّف ثم الفاعل، والجواب ja أو nein.","Kommst du morgen?|هل تأتي غدًا؟","Bist du müde?|هل أنت متعب؟","كيف تسأل: هل تتحدث الألمانية؟","Sprichst du Deutsch?|Du sprichst Deutsch?|Sprechen du Deutsch?","0","الفعل أولًا: Sprichst du Deutsch؟"],
["Nominativ","K4","Nominativ هي حالة الفاعل — صورة القاموس بدون تغيير: der/die/das.","Der Mann schläft.|الرجل نائم.","Ein Kind lacht.|طفل يضحك.","ما حالة الفاعل؟","Nominativ|Akkusativ|Dativ","0","الفاعل دائمًا Nominativ."],
["Imperativ mit du","K3","الأمر مع الصديق يستخدم جذر الفعل: Komm! Sprich!","Komm her!|تعال هنا!","Warte kurz!|انتظر قليلًا!","آمر صديقًا أن يأتي؟","Komm!|Kommen Sie!|Du kommst!","0","مع الصديق: الجذر + !"],
["trennbare Verben","K4","الفعل المنفصل تنفصل قطعته وتذهب لآخر الجملة: Ich stehe früh auf.","Ich stehe früh auf.|أستيقظ مبكرًا.","Ruf mich an!|اتصل بي!","أين تذهب القطعة؟","آخر الجملة|أول الجملة|تُحذف","0","القطعة دائمًا في الآخر."],
["doch / nein / ja","K1","doch تعني بلى — رد إيجابي على سؤال منفي.","Du bist nicht müde? — Doch!|ألست متعبًا؟ — بل أنا متعب!","Kommst du? — Ja!|هل تأتي؟ — نعم!","Du lernst nicht؟ (وأنت تتعلم)","Doch!|Nein!|Tschüs!","0","الرد على النفي بالموافقة = doch."],
["Präpositionen A1","K3","nach للاتجاه، in للمكان، aus للأصل، mit للصحبة، für للغرض.","Ich fahre nach Berlin.|أسافر إلى برلين.","Ich wohne in Kairo.|أسكن في القاهرة.","أكمل: Ich fahre ___ Berlin.","nach|in|aus","0","الاتجاه لمدينة = nach."],
["Uhrzeit und Datum","K5","الساعة بـ um، واليوم بـ am، والتاريخ der + رقم + شهر.","Der Termin ist um 9 Uhr.|الموعد التاسعة.","Heute ist Montag.|اليوم الاثنين.","أكمل: ___ Freitag habe ich Zeit.","Am|Um|Im","0","اليوم يأخذ am."],
["Zahlen","K1","الأرقام 0-12 تُحفظ، ثم تركيب: 21 = einundzwanzig.","Ich bin zwanzig Jahre alt.|عمري عشرون.","Das kostet fünf Euro.|سعره خمسة يورو.","كيف أقول 24؟","vierundzwanzig|zwanzigvier|vierzigzwei","0","آحاد + und + عشرات."],
["Alphabet und Aussprache","K0","الألمانية تُنطق كما تُكتب غالبًا: sch = ش، و ch حسب ما قبلها.","Die Schule ist groß.|المدرسة كبيرة.","Ich buchstabiere meinen Namen.|أتهجى اسمي.","كيف تُنطق sch؟","ش|س|ك","0","sch = ش دائمًا."],
["Modalverben im Detail","K5","können قدرة، müssen وجوب، wollen رغبة، möchten أدب: المساعد ثانيًا + الأساسي مصدرًا آخرًا.","Kannst du mir helfen?|هل يمكنك مساعدتي؟","Ich muss morgen arbeiten.|يجب أن أعمل غدًا.","أكمل بأدب: Ich ___ einen Kaffee.","möchte|will|muss","0","الطلب المهذب = möchten."]
];
/* ============ محرك بناء الجمل والقواعد والأفعال ============ */
function buildSent(){
  return RAW_SENT.map(function(s,i){return{id:"s"+(i+1),de:s[0],ar:s[1],pron:s[2]||"",kap:s[3],level:"A1"};});
}
function buildGram(){
  return RAW_GRAM.map(function(g,i){
    const n=g.length;
    const exes=g.slice(3,n-4).map(function(e){const p=String(e).split("|");return[p[0]||"",p[1]||""];});
    return{id:"g"+(i+1),title:g[0],kap:g[1],body:g[2],ex:exes,
      quiz:{q:g[n-4],opts:String(g[n-3]).split("|"),correct:parseInt(g[n-2],10),explain:g[n-1]}};
  });
}
const SENTENCES = buildSent();
const GRAMMAR = buildGram();
/* تصريف الأفعال التلقائي (منتظم + شاذ + منفصل + منعكس) */
const IRREG = {
"sein":["bin","bist","ist","sind","seid","sind"],
"haben":["habe","hast","hat","haben","habt","haben"],
"werden":["werde","wirst","wird","werden","werdet","werden"],
"sprechen":["spreche","sprichst","spricht","sprechen","sprecht","sprechen"],
"sehen":["sehe","siehst","sieht","sehen","seht","sehen"],
"essen":["esse","isst","isst","essen","esst","essen"],
"nehmen":["nehme","nimmst","nimmt","nehmen","nehmt","nehmen"],
"lesen":["lese","liest","liest","lesen","lest","lesen"],
"fahren":["fahre","fährst","fährt","fahren","fahrt","fahren"],
"schlafen":["schlafe","schläfst","schläft","schlafen","schlaft","schlafen"],
"helfen":["helfe","hilfst","hilft","helfen","helft","helfen"],
"treffen":["treffe","triffst","trifft","treffen","trefft","treffen"],
"waschen":["wasche","wäschst","wäscht","waschen","wascht","waschen"],
"fallen":["falle","fällst","fällt","fallen","fallt","fallen"],
"können":["kann","kannst","kann","können","könnt","können"],
"müssen":["muss","musst","muss","müssen","müsst","müssen"],
"wollen":["will","willst","will","wollen","wollt","wollen"],
"möchten":["möchte","möchtest","möchte","möchten","möchtet","möchten"],
"mögen":["mag","magst","mag","mögen","mögt","mögen"],
"tun":["tue","tust","tut","tun","tut","tun"]
};
const SEPS=["zurück","zusammen","fern","ab","an","auf","aus","bei","ein","mit","nach","vor","zu","fest","los","weiter","heim"];
const INSEP=["antworten"];
function conjugateVerb(inf){
  let refl=false,sep="",leadWords="",core=inf;
  if(core.indexOf("sich ")===0){refl=true;core=core.slice(5);}
  if(core.indexOf(" ")>=0){
    const parts=core.split(" "),last=parts[parts.length-1];
    if(last.length>3&&/(en|ern|eln)$/.test(last)){leadWords=parts.slice(0,-1).join(" ");core=last;}
    else return null;
  }
  if(INSEP.indexOf(core)<0){
    for(let i=0;i<SEPS.length;i++){const p=SEPS[i];
      if(core.indexOf(p)===0&&core.length>p.length+3){const rest=core.slice(p.length);
        if(/(en|n)$/.test(rest)){sep=p;core=rest;break;}}}
  }
  let forms;
  if(IRREG[core])forms=IRREG[core];
  else{
    let base;
    if(/(eln|ern)$/.test(core))base=core.slice(0,-1);
    else if(/en$/.test(core))base=core.replace(/en$/,"");
    else return null;
    const ez=/(d|t)$/.test(base)||base==="zeichn";
    const st=/(s|ß|x|z)$/.test(base);
    const e=ez?"e":"";
    forms=[base+"e",base+e+(st?"t":"st"),base+e+"t",core,base+e+"t",core];
  }
  const suf=sep?" "+sep:"";
  const R=refl?[" mich"," dich"," sich"," uns"," euch"," sich"]:["","","","","",""];
  const P=["ich ","du ","er/sie/es ","wir ","ihr ","sie/Sie "];
  const K=["ich","du","er","wir","ihr","sie"];
  const conj={};
  for(let i=0;i<6;i++)conj[K[i]]=P[i]+forms[i]+(leadWords?" "+leadWords:"")+suf+R[i];
  return conj;
}
function allVerbs(){
  const seen={},out=[];let n=0;
  allWords().forEach(function(w){
    if(w.type!=="فعل"||seen[w.de])return;seen[w.de]=1;n++;
    const c=conjugateVerb(w.de);
    out.push({id:"v"+n,inf:w.de,ar:w.ar,pron:w.pron,kap:w.kap||"KX",conj:c,phrase:!c});
  });
  return out;
}
/* ============ STATE ============ */
const LS_KEY = "deutsch_master_v2";
function defaultState(){return{customWords:[],status:{},favs:[],quizHistory:[],totalCorrect:0,totalAnswered:0,testsTaken:0,studyDays:{},streak:{count:0,last:"",longest:0},planner:{words:20,sentences:10,minutes:30,day:"",dw:0,ds:0,dm:0},settings:{theme:"dark",speed:1,color:"default"},review:{},xp:0,bestPct:0,maxCombo:0,mistakes:{},lastQuiz:null};}
let S = defaultState();
try{const raw=localStorage.getItem(LS_KEY);if(raw){const p=JSON.parse(raw);S=Object.assign(defaultState(),p);S.streak=Object.assign({count:0,last:"",longest:0},p.streak||{});S.planner=Object.assign(defaultState().planner,p.planner||{});S.settings=Object.assign({theme:"dark",speed:1,color:"default"},p.settings||{});}}catch(e){}
try{const old=localStorage.getItem("deutsch_master_v1");if(old&&!localStorage.getItem(LS_KEY)){const p=JSON.parse(old);if(p.streak)S.streak=p.streak;if(p.studyDays)S.studyDays=p.studyDays;if(p.settings)S.settings=Object.assign({theme:"dark",speed:1},p.settings);if(p.planner)S.planner=p.planner;if(p.customWords)S.customWords=p.customWords;save();}}catch(e){}
function save(){try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(e){}}
function todayStr(d){const x=d||new Date();return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");}
function allWords(){return VOCAB.concat(S.customWords||[]);}
function getStatus(id){return S.status[id]||"new";}
function setStatus(id,st){S.status[id]=st;save();}
const STATUS_AR={new:"🆕 جديدة",review:"🔁 مراجعة",hard:"🔴 صعبة",known:"✅ محفوظة",later:"⏳ لاحقًا"};

/* ============ HELPERS ============ */
function $(id){return document.getElementById(id);}
function toast(msg,cls){const t=document.createElement("div");t.className="toast "+(cls||"");t.textContent=msg;$("toasts").appendChild(t);setTimeout(()=>t.remove(),2600);}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const tmp=a[i];a[i]=a[j];a[j]=tmp;}return a;}
function currentRate(){try{const v=parseFloat((S&&S.settings&&S.settings.speed)||($("speedSelect")&&$("speedSelect").value)||1);return (v>0&&v<=2)?v:1;}catch(e){return 1;}}
/* Unified German pronunciation engine: Native Android TTS -> Web Speech API -> Audio fallback */
var _deVoice=null;
function loadGermanVoice(){
  try{
    if(!("speechSynthesis" in window)||!window.speechSynthesis)return null;
    const vs=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
    if(!vs||!vs.length)return _deVoice;
    let gv=vs.find(v=>v.lang&&v.lang.toLowerCase()==="de-de")||vs.find(v=>v.lang&&v.lang.toLowerCase().indexOf("de")===0)||null;
    if(gv)_deVoice=gv;
    return _deVoice;
  }catch(e){return _deVoice;}
}
try{
  if("speechSynthesis" in window&&window.speechSynthesis){
    try{loadGermanVoice();}catch(e){}
    try{window.speechSynthesis.onvoiceschanged=function(){try{loadGermanVoice();}catch(e){}};}catch(e){}
  }
}catch(e){}
var _fallbackAudio=null;
function stopFallbackAudio(){try{if(_fallbackAudio){_fallbackAudio.pause();try{_fallbackAudio.currentTime=0;}catch(e){}}}catch(e){}}
function hasNativeTTS(){try{return (typeof window.AndroidTTS!=="undefined")&&window.AndroidTTS&&typeof window.AndroidTTS.speak==="function";}catch(e){return false;}}
function speakWithNative(text,rate){
  window.AndroidTTS.stop?window.AndroidTTS.stop():null;
  try{if(typeof window.AndroidTTS.setRate==="function"){try{window.AndroidTTS.setRate(rate);}catch(e){}}}catch(e){}
  window.AndroidTTS.speak(text);
  return true;
}
function hasWebSpeech(){
  try{
    return ("speechSynthesis" in window)&&window.speechSynthesis&&typeof SpeechSynthesisUtterance!=="undefined";
  }catch(e){return false;}
}
function speakWithWeb(text,rate){
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="de-DE";u.rate=rate;
  const gv=_deVoice||loadGermanVoice();
  if(gv)u.voice=gv;
  else{
    try{
      const vs=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
      const f=vs.find(v=>v.lang&&v.lang.toLowerCase().indexOf("de")===0);
      if(f)u.voice=f;
    }catch(e){}
  }
  window.speechSynthesis.speak(u);
  return true;
}
function speakWithAudioUrl(text,rate){
  try{
    if(!_fallbackAudio)_fallbackAudio=new Audio();
    stopFallbackAudio();
    _fallbackAudio.playbackRate=rate;
    _fallbackAudio.src="https://translate.google.com/translate_tts?ie=UTF-8&tl=de-DE&client=tw-ob&q="+encodeURIComponent(text);
    const p=_fallbackAudio.play();
    if(p&&typeof p.catch==="function")p.catch(()=>{});
    return true;
  }catch(e){return false;}
}
function stopAllSpeech(){
  try{if(hasNativeTTS()&&window.AndroidTTS.stop)window.AndroidTTS.stop();}catch(e){}
  try{if(("speechSynthesis" in window)&&window.speechSynthesis)window.speechSynthesis.cancel();}catch(e){}
  try{stopFallbackAudio();}catch(e){}
}
function speakGerman(text){
  const t=String(text==null?"":text).trim();
  if(!t)return;
  const rate=currentRate();
  try{stopAllSpeech();}catch(e){}
  if(hasNativeTTS()){
    try{if(speakWithNative(t,rate))return;}catch(e){}
  }
  if(hasWebSpeech()){
    try{if(speakWithWeb(t,rate))return;}catch(e){}
  }
  try{if(speakWithAudioUrl(t,rate))return;}catch(e){}
  toast("تعذر تشغيل النطق على هذا الجهاز 😢","err");
}
function speak(text){speakGerman(text);}
function markStudyDay(){
  const t=todayStr();
  S.studyDays[t]=true;
  if(S.streak.last!==t){
    const y=new Date();y.setDate(y.getDate()-1);
    if(S.streak.last===todayStr(y)){S.streak.count+=1;}
    else if(!S.streak.last){S.streak.count=1;}
    else{const diff=Math.round((new Date(t)-new Date(S.streak.last))/86400000);S.streak.count=(diff===1)?S.streak.count+1:1;}
    S.streak.last=t;
    if(S.streak.count>S.streak.longest)S.streak.longest=S.streak.count;
  }
  if(S.planner.day!==t){S.planner.day=t;S.planner.dw=0;S.planner.ds=0;S.planner.dm=0;}
  save();renderStreak();
}
function renderStreak(){
  $("topStreak").textContent="🔥 "+(S.streak.count||0);
  $("sideStreak").textContent="🔥 "+(S.streak.count||0)+" يوم متتالية";
}

/* ============ NAV ============ */
function showPage(name){
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+name));
  $("sidebar").classList.remove("open");$("sidebarOverlay").classList.remove("show");
  window.scrollTo({top:0,behavior:"smooth"});
  requestAnimationFrame(observeReveals);
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-goto"))));
$("menuBtn").addEventListener("click",()=>{$("sidebar").classList.add("open");$("sidebarOverlay").classList.add("show");});
$("sidebarOverlay").addEventListener("click",()=>{$("sidebar").classList.remove("open");$("sidebarOverlay").classList.remove("show");});

/* ============ THEME / SPEED ============ */
function applyTheme(){document.documentElement.setAttribute("data-theme",S.settings.theme);$("themeBtn").textContent=S.settings.theme==="dark"?"🌙":"☀️";try{applyColor();}catch(e){}}
/* ============ COLOR THEMES ============ */
function hexRgb(h){h=String(h||"").replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");const n=parseInt(h,16);return [(n>>16)&255,(n>>8)&255,n&255].join(",");}
const THEMES=[
{id:"default",name:"Default Blue",c1:"#7c3aed",c2:"#00d4ff",gold:"#f5c451",p2:"#2563eb"},
{id:"royal",name:"Royal Blue",c1:"#1d4ed8",c2:"#38bdf8",gold:"#fbbf24",p2:"#1e40af"},
{id:"ocean",name:"Ocean",c1:"#0ea5e9",c2:"#22d3ee",gold:"#fcd34d",p2:"#0369a1"},
{id:"cyan",name:"Cyan",c1:"#06b6d4",c2:"#67e8f9",gold:"#fde047",p2:"#0e7490"},
{id:"purple",name:"Purple",c1:"#7c3aed",c2:"#a78bfa",gold:"#f5c451",p2:"#6d28d9"},
{id:"violet",name:"Violet",c1:"#8b5cf6",c2:"#d946ef",gold:"#fbbf24",p2:"#7c3aed"},
{id:"pink",name:"Pink",c1:"#ec4899",c2:"#f9a8d4",gold:"#fde68a",p2:"#be185d"},
{id:"rose",name:"Rose",c1:"#f43f5e",c2:"#fda4af",gold:"#fef3c7",p2:"#be123c"},
{id:"red",name:"Red",c1:"#ef4444",c2:"#f87171",gold:"#fde68a",p2:"#b91c1c"},
{id:"orange",name:"Orange",c1:"#f97316",c2:"#fdba74",gold:"#fef08a",p2:"#c2410c"},
{id:"sunset",name:"Sunset",c1:"#f59e0b",c2:"#ef4444",gold:"#fde68a",p2:"#b45309"},
{id:"amber",name:"Amber",c1:"#f59e0b",c2:"#fcd34d",gold:"#fff7ed",p2:"#b45309"},
{id:"yellow",name:"Yellow",c1:"#eab308",c2:"#fef08a",gold:"#fffbeb",p2:"#a16207"},
{id:"lime",name:"Lime",c1:"#84cc16",c2:"#bef264",gold:"#fefce8",p2:"#4d7c0f"},
{id:"green",name:"Green",c1:"#22c55e",c2:"#4ade80",gold:"#fef9c3",p2:"#15803d"},
{id:"emerald",name:"Emerald",c1:"#10b981",c2:"#6ee7b7",gold:"#fef3c7",p2:"#047857"},
{id:"teal",name:"Teal",c1:"#14b8a6",c2:"#5eead4",gold:"#fef9c3",p2:"#0f766e"},
{id:"turquoise",name:"Turquoise",c1:"#06b6d4",c2:"#5eead4",gold:"#fef08a",p2:"#0e7490"},
{id:"neon",name:"Neon",c1:"#22ff88",c2:"#00e5ff",gold:"#faff00",p2:"#00aa55"},
{id:"midnight",name:"Midnight",c1:"#312e81",c2:"#155e75",gold:"#d4a017",p2:"#1e1b4b"},
{id:"cyber",name:"Cyber",c1:"#d946ef",c2:"#22d3ee",gold:"#f0abfc",p2:"#a21caf"},
{id:"darkpurple",name:"Dark Purple",c1:"#6d28d9",c2:"#4c1d95",gold:"#c4b5fd",p2:"#4c1d95"}];
function themeById(id){return THEMES.find(t=>t.id===id)||THEMES[0];}
function applyColor(id){
  const t=themeById(id||(S.settings&&S.settings.color)||"default");
  const r=document.documentElement.style;
  r.setProperty("--violet",t.c1);r.setProperty("--neon",t.c2);r.setProperty("--cyan",t.c2);
  r.setProperty("--gold",t.gold);r.setProperty("--p1",t.c1);r.setProperty("--p2",t.p2);
  r.setProperty("--v1",hexRgb(t.c1));r.setProperty("--v2",hexRgb(t.c2));r.setProperty("--v3",hexRgb(t.gold));
  r.setProperty("--grad","linear-gradient(135deg,"+t.c1+","+t.c2+")");
}
function setColor(id){S.settings.color=id;save();applyColor(id);renderThemes();toast("تم تطبيق اللون ✅","ok");}
function renderThemes(){
  const box=$("themeGrid");if(!box)return;
  const cur=(S.settings&&S.settings.color)||"default";
  box.innerHTML=THEMES.map(t=>'<div class="theme-card'+(t.id===cur?" selected":"")+'" data-th="'+t.id+'"><div class="theme-prev" style="background:linear-gradient(135deg,'+t.c1+','+t.c2+')"></div><div class="theme-name">'+t.name+'</div><div class="theme-hex">'+t.c1+' • '+t.c2+'</div></div>').join("");
  box.querySelectorAll("[data-th]").forEach(c=>c.addEventListener("click",()=>setColor(c.getAttribute("data-th"))));
}
$("themeBtn").addEventListener("click",()=>{S.settings.theme=S.settings.theme==="dark"?"light":"dark";save();applyTheme();});
$("themeBtn2").addEventListener("click",()=>{S.settings.theme=S.settings.theme==="dark"?"light":"dark";save();applyTheme();toast("تم تبديل المظهر ✅","ok");});
function syncSpeed(v){S.settings.speed=parseFloat(v);$("speedSelect").value=String(S.settings.speed);$("speedSelect2").value=String(S.settings.speed);save();}
$("speedSelect").addEventListener("change",e=>syncSpeed(e.target.value));
$("speedSelect2").addEventListener("change",e=>syncSpeed(e.target.value));
$("testVoice").addEventListener("click",()=>speak("Ich lerne Deutsch. Guten Tag!"));

/* ============ TYPING ============ */
const PHRASES=["der Tisch = الطاولة 🍎","احفظ الأداة مع الكلمة دائمًا! der / die / das","Ich lerne Deutsch 🇩🇪","راجع 20 كلمة يوميًا لتصل إلى A1 بسرعة ⚡","Streak اليوم: افتح التطبيق وذاكر 🔥"];
let phraseI=0,charI=0,del=false;
function typingLoop(){const el=$("typingText");if(!el)return;const p=PHRASES[phraseI];el.textContent=p.slice(0,charI);if(!del){charI++;if(charI>p.length+8)del=true;}else{charI--;if(charI<=0){del=false;phraseI=(phraseI+1)%PHRASES.length;}}setTimeout(typingLoop,del?35:70);}

/* ============ REVEAL ============ */
let observer=null;
function observeReveals(){
  if(!("IntersectionObserver" in window)){document.querySelectorAll(".reveal").forEach(e=>e.classList.add("visible"));return;}
  if(!observer)observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");observer.unobserve(e.target);}}),{threshold:.1});
  document.querySelectorAll(".reveal:not(.visible)").forEach(e=>observer.observe(e));
}

/* ============ WORD CARD ============ */
function wordCard(w){
  const st=getStatus(w.id);const fav=S.favs.includes(w.id);
  const artCls=w.art==="der"?"der":w.art==="die"?"die":w.art==="das"?"das":"none";
  const artTxt=w.art==="-"?"–":w.art;
  const full=(w.art!=="-"?w.art+" ":"")+w.de;
  const d=document.createElement("div");d.className="word-card glass";
  const hasArt=w.art!=="-";
  const deLine=hasArt?'<span class="article '+artCls+'">'+artTxt+'</span><span class="word-de">'+escapeHtml(w.de)+'</span>':'<span class="word-de">'+escapeHtml(w.de)+'</span>';
  const plLine=(w.type==="اسم"&&w.plural)?'<div class="de-plural"><span class="article '+artCls+' sm">'+artTxt+'</span><span>'+escapeHtml(w.plural)+'</span><button class="mini-btn" data-act="speakPl" title="نطق الجمع">🔊</button></div>':'';
  d.innerHTML=
    '<div class="de-line" data-act="detail" title="اضغط للتفاصيل والنطق 🔊">'+deLine+
    '<button class="mini-btn" data-act="speak" title="نطق">🔊</button>'+
    '<button class="mini-btn fav '+(fav?"active":"")+'" data-act="fav" title="مفضلة">❤️</button></div>'+
    plLine+
    '<div class="word-ar">'+escapeHtml(w.ar)+'</div>'+
    '<div class="word-pron">النطق: '+escapeHtml(w.pron)+'</div>'+
    '<div class="word-ex"><div class="ex-de">'+escapeHtml(w.ex)+'</div><div>'+escapeHtml(w.exAr)+'</div></div>'+
    '<div class="word-meta"><span class="tag kap-tag">'+kapName(w.kap||"KX")+'</span><span class="tag">'+escapeHtml(w.cat)+' • '+(CAT_AR[w.cat]||"")+'</span><span class="tag">'+escapeHtml(w.type)+'</span><span class="tag">'+escapeHtml(w.level||"A1")+'</span><span class="status-tag '+st+'">'+STATUS_AR[st]+'</span></div>'+
    '<div class="card-actions">'+
    '<button class="mini-btn" data-act="known">✅ أعرفها</button>'+
    '<button class="mini-btn" data-act="hard">🔴 صعبة</button>'+
    '<button class="mini-btn" data-act="review">🔁 مراجعة</button>'+
    '<button class="mini-btn" data-act="later">⏳ لاحقًا</button>'+
    '<button class="mini-btn" data-act="speakEx">🔊 المثال</button>'+
    '<button class="mini-btn" data-act="quiz">❓ اختبرني</button></div>';
  d.querySelector(".de-line").addEventListener("click",ev=>{
    if(ev.target.closest("button"))return;
    if(w.type==="اسم"||w.art!=="-")openWordDetail(w.id);else speak(full);
  });
  d.querySelectorAll("button").forEach(b=>b.addEventListener("click",ev=>{
    ev.stopPropagation();const a=b.getAttribute("data-act");
    if(a==="detail")return;
    if(a==="speak")speak(full);
    else if(a==="speakPl")speak(pluralFull(w));
    else if(a==="speakEx")speak(w.ex);
    else if(a==="fav")toggleFav(w.id);
    else if(a==="quiz")quickArticleQuiz(w);
    else{setStatus(w.id,a==="known"?"known":a);markStudyDay();renderAll();toast(a==="known"?"أحسنت! كلمة محفوظة ✅":"تم تحديث حالة الكلمة 📌","ok");}
  }));
  return d;
}
function escapeHtml(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function toggleFav(id){
  const i=S.favs.indexOf(id);
  if(i>=0)S.favs.splice(i,1);else S.favs.push(id);
  save();renderAll();
  toast(i>=0?"أُزيلت من المفضلة":"أُضيفت للمفضلة ❤️","ok");
}

/* ============ VOCAB ============ */
function fillCategories(){
  const opts=CATEGORIES.map(c=>'<option value="'+c+'">'+c+' • '+(CAT_AR[c]||"")+'</option>').join("");
  $("filterCategory").innerHTML='<option value="">كل التصنيفات</option>'+opts;
  $("flashCategory").innerHTML='<option value="">كل التصنيفات</option>'+opts;
  $("nwCat").innerHTML=opts;
}
function fillKapitels(){
  const words=allWords();
  const opts=KAPITEL.map(k=>{
    const n=k.id==="KX"?words.filter(w=>w.kap==="KX"||!w.kap).length:words.filter(w=>w.kap===k.id).length;
    return '<option value="'+k.id+'">'+k.icon+" "+k.id+" • "+k.name+" ("+n+")</option>";
  }).join("");
  ["filterKapitel","flashKapitel","sentenceKapitel","verbKapitel","grammarKapitel","explainKapitel"].forEach(function(id){const el=$(id);if(!el)return;const cur=el.value;el.innerHTML='<option value="">كل الكبيتلات</option>'+opts;el.value=cur;});
}
function filteredVocab(){
  const q=($("vocabSearch").value||"").trim().toLowerCase();
  const c=$("filterCategory").value,t=$("filterType").value,s=$("filterStatus").value,a=$("filterArticle").value;
  const k=$("filterKapitel")?$("filterKapitel").value:"";
  const lv=$("filterLevel")?$("filterLevel").value:"";
  return allWords().filter(w=>{
    if(lv&&(w.level||"A1")!==lv)return false;
    if(c&&w.cat!==c)return false;
    if(t&&w.type!==t)return false;
    if(s&&getStatus(w.id)!==s)return false;
    if(a&&w.art!==a)return false;
    if(k&&(w.kap||"KX")!==k)return false;
    if(q){const hay=(w.de+" "+w.ar+" "+w.pron+" "+w.ex).toLowerCase();if(hay.indexOf(q)<0)return false;}
    return true;
  });
}
function renderVocab(){
  const list=filteredVocab();
  $("vocabCount").textContent=list.length;
  const g=$("vocabGrid");g.innerHTML="";
  if(!list.length){g.innerHTML='<div class="panel glass">لا توجد نتائج. جرّب بحثًا آخر أو أضف كلمة جديدة ➕</div>';return;}
  list.slice(0,120).forEach(w=>g.appendChild(wordCard(w)));
}
["vocabSearch","filterCategory","filterType","filterStatus","filterArticle","filterKapitel","filterLevel"].forEach(id=>{const el=$(id);if(el)el.addEventListener("input",renderVocab);});

/* ============ DASHBOARD ============ */
function animateCount(el,to){
  const from=parseInt(el.textContent||"0",10)||0;
  if(from===to){el.textContent=to;return;}
  const step=Math.max(1,Math.ceil(Math.abs(to-from)/20));let cur=from;
  const iv=setInterval(()=>{cur+=to>from?step:-step;if((to>from&&cur>=to)||(to<from&&cur<=to)){cur=to;clearInterval(iv);}el.textContent=cur;},40);
}
function renderDashboard(){
  const words=allWords();
  const known=words.filter(w=>getStatus(w.id)==="known").length;
  const due=dueWords().length;
  const days=Object.keys(S.studyDays).length;
  const pct=words.length?Math.round(known/words.length*100):0;
  animateCount($("dSaved"),known);animateCount($("dReview"),due);
  animateCount($("dDays"),days);animateCount($("dTests"),S.testsTaken||0);
  animateCount($("dCorrect"),S.totalCorrect||0);animateCount($("dStreak"),S.streak.count||0);
  $("heroProgressPct").textContent=pct+"%";
  setTimeout(()=>{$("heroProgressFill").style.width=pct+"%";},100);
  $("dSavedBar").style.width=pct+"%";
  $("dReviewBar").style.width=Math.min(100,words.length?due/words.length*100:0)+"%";
  $("dDaysBar").style.width=Math.min(100,days/30*100)+"%";
  $("dTestsBar").style.width=Math.min(100,(S.testsTaken||0)/20*100)+"%";
  const acc=S.totalAnswered?Math.round(S.totalCorrect/S.totalAnswered*100):0;
  $("dCorrectBar").style.width=acc+"%";
  $("dStreakBar").style.width=Math.min(100,(S.streak.count||0)/30*100)+"%";
  const L=levelFor(S.xp||0);
  $("lvlNum").textContent=L.lvl;$("lvlName").textContent=L.name;
  $("xpNum").textContent=S.xp||0;
  $("xpNext").textContent=L.cur+" / "+L.need;
  setTimeout(()=>{$("xpFill").style.width=Math.min(100,L.cur/Math.max(1,L.need)*100)+"%";},100);
  $("accNum").textContent=acc+"%";
  $("bestNum").textContent=(S.bestPct||0)+"%";
  $("comboNum").textContent=(S.maxCombo||0);
  $("lastQuizTxt").textContent=S.lastQuiz?("آخر اختبار: "+S.lastQuiz.type+" — "+S.lastQuiz.score+"/"+S.lastQuiz.total+" ("+S.lastQuiz.pct+"%) ⭐+"+S.lastQuiz.xp+" بتاريخ "+S.lastQuiz.date):"لم تحل أي اختبار بعد — ابدأ الآن! 🚀";
  const p=S.planner;const t=todayStr();
  const dw=p.day===t?p.dw:0,ds=p.day===t?p.ds:0,dm=p.day===t?p.dm:0;
  $("dashPlanner").innerHTML='<div class="stat-bar-row"><span class="lbl">📚 كلمات</span><div class="bar"><div class="fill" style="width:'+Math.min(100,dw/Math.max(1,p.words)*100)+'%;background:linear-gradient(90deg,#7c3aed,#00d4ff)"></div></div><b>'+dw+'/'+p.words+'</b></div>'+
  '<div class="stat-bar-row"><span class="lbl">💬 جمل</span><div class="bar"><div class="fill" style="width:'+Math.min(100,ds/Math.max(1,p.sentences)*100)+'%;background:linear-gradient(90deg,#059669,#34d399)"></div></div><b>'+ds+'/'+p.sentences+'</b></div>'+
  '<div class="stat-bar-row"><span class="lbl">⏱️ دقائق</span><div class="bar"><div class="fill" style="width:'+Math.min(100,dm/Math.max(1,p.minutes)*100)+'%;background:linear-gradient(90deg,#b8860b,#fde68a)"></div></div><b>'+dm+'/'+p.minutes+'</b></div>';
}

/* ============ REVIEW SYSTEM ============ */
function dueWords(){
  const words=allWords();
  return words.filter(w=>{
    const st=getStatus(w.id);const r=S.review[w.id]||{c:0,w:0};
    if(st==="known"&&r.w===0)return false;
    if(st==="known")return r.w>r.c;
    return true;
  }).sort((a,b)=>{
    const ra=S.review[a.id]||{c:0,w:0},rb=S.review[b.id]||{c:0,w:0};
    const sa=(rb.w-rb.c)-(ra.w-ra.c);
    if(sa!==0)return sa;
    const order={hard:0,review:1,later:2,new:3,known:4};
    return (order[getStatus(a.id)]||3)-(order[getStatus(b.id)]||3);
  });
}
function renderReview(){
  const words=allWords();
  const counts={new:0,review:0,hard:0,known:0,later:0};
  words.forEach(w=>{counts[getStatus(w.id)]=(counts[getStatus(w.id)]||0)+1;});
  const colors={new:"#22d3ee",review:"#fb923c",hard:"#ef4444",known:"#22c55e",later:"#94a3b8"};
  $("reviewLevels").innerHTML=Object.keys(counts).map(k=>'<div class="level-card glass"><div class="level-num" style="color:'+colors[k]+'">'+counts[k]+'</div><div>'+STATUS_AR[k]+'</div></div>').join("");
  const due=dueWords();
  $("dueCount").textContent=due.length;
  $("navReviewBadge").textContent=due.length;
  const g=$("dueGrid");g.innerHTML="";
  due.slice(0,9).forEach(w=>g.appendChild(wordCard(w)));
  if(!due.length)g.innerHTML='<div class="muted">ممتاز! لا توجد كلمات تحتاج مراجعة اليوم 🎉</div>';
}
let reviewQueue=[],reviewIdx=0;
$("startReview").addEventListener("click",()=>{
  reviewQueue=dueWords().slice(0,15);
  if(!reviewQueue.length){toast("لا توجد كلمات للمراجعة 🎉","ok");return;}
  reviewIdx=0;renderReviewQ();markStudyDay();
});
function renderReviewQ(){
  const box=$("reviewSession");box.classList.remove("hidden");
  const w=reviewQueue[reviewIdx];if(!w){box.innerHTML='<h3>🎉 انتهت جلسة المراجعة!</h3><button class="btn btn-primary" onclick="document.getElementById(\'reviewSession\').classList.add(\'hidden\')">إغلاق</button>';renderAll();return;}
  const full=(w.art!=="-"?w.art+" ":"")+w.de;
  box.innerHTML='<h3>مراجعة '+(reviewIdx+1)+' / '+reviewQueue.length+'</h3>'+
  '<div class="word-de word-de-ltr" style="font-size:32px">'+escapeHtml(full)+' <button class="mini-btn" id="rvSpeak">🔊</button></div>'+
  '<div class="muted">حاول تذكر المعنى ثم أظهر الإجابة</div>'+
  '<div id="rvAns" class="hidden" style="margin:12px 0"><div class="word-ar" style="font-size:26px">'+escapeHtml(w.ar)+'</div><div class="word-pron">'+escapeHtml(w.pron)+'</div><div class="word-ex"><div class="ex-de">'+escapeHtml(w.ex)+'</div><div>'+escapeHtml(w.exAr)+'</div></div></div>'+
  '<div class="row-flex"><button class="btn btn-ghost sm" id="rvShow">👁️ إظهار الإجابة</button>'+
  '<button class="btn btn-green sm" id="rvOk">✅ عرفتها</button>'+
  '<button class="btn btn-red sm" id="rvNo">❌ أخطأت</button></div>';
  box.scrollIntoView({behavior:"smooth"});
  $("rvSpeak").addEventListener("click",()=>speak(full));
  $("rvShow").addEventListener("click",()=>$("rvAns").classList.remove("hidden"));
  $("rvOk").addEventListener("click",()=>{bumpReview(w.id,true);reviewIdx++;renderReviewQ();});
  $("rvNo").addEventListener("click",()=>{bumpReview(w.id,false);reviewIdx++;renderReviewQ();});
}
function bumpReview(id,ok){
  if(!S.review[id])S.review[id]={c:0,w:0};
  if(ok){S.review[id].c++;if(getStatus(id)!=="hard")setStatus(id,"known");}
  else{S.review[id].w++;setStatus(id,"hard");}
  S.totalAnswered++;if(ok)S.totalCorrect++;
  markStudyDay();save();renderAll();
}

/* ============ FLASHCARDS ============ */
let flashList=[],flashIdx=0;
function buildFlash(){
  const c=$("flashCategory").value;
  const k=$("flashKapitel")?$("flashKapitel").value:"";
  flashList=shuffle(allWords().filter(w=>(!c||w.cat===c)&&(!k||(w.kap||"KX")===k)));
  if(!flashList.length)flashList=allWords().slice();
  flashIdx=0;renderFlash();
}
function renderFlash(){
  if(!flashList.length)return;
  const w=flashList[flashIdx%flashList.length];
  $("flashcard").classList.remove("flipped");
  setTimeout(()=>{
    $("flashArticle").textContent=w.art==="-"?"A1":w.art;
    $("flashArticle").className="flash-article article "+(w.art==="-"?"none":w.art);
    $("flashWord").textContent=(w.art!=="-"?w.art+" ":"")+w.de;
    $("flashPlural").textContent=pluralFull(w);
    $("flashAr").textContent=w.ar;
    $("flashPron").textContent="النطق: "+w.pron;
    $("flashEx").innerHTML=escapeHtml(w.ex)+" <br><span style='color:var(--muted)'>"+escapeHtml(w.exAr)+"</span>";
    $("flashcard").dataset.wid=w.id;
    $("flashCounter").textContent=(flashIdx%flashList.length+1)+" / "+flashList.length;
    $("flashBar").style.width=((flashIdx%flashList.length+1)/flashList.length*100)+"%";
  },150);
}
$("flashcard").addEventListener("click",e=>{if(e.target.closest("button"))return;$("flashcard").classList.toggle("flipped");});
document.querySelector("[data-speak-flash]").addEventListener("click",e=>{e.stopPropagation();const w=flashList[flashIdx%flashList.length];if(w)speak((w.art!=="-"?w.art+" ":"")+w.de);});
document.querySelector("[data-speak-flash-ex]").addEventListener("click",e=>{e.stopPropagation();const w=flashList[flashIdx%flashList.length];if(w)speak(w.ex);});
$("flashPlural").addEventListener("click",e=>{e.stopPropagation();const id=$("flashcard").dataset.wid;const w=id?wordById(id):null;if(w&&w.plural)speak(pluralFull(w));});
$("flashPlural").style.cursor="pointer";$("flashPlural").title="اضغط لسماع الجمع 🔊";
$("flashNext").addEventListener("click",()=>{flashIdx++;renderFlash();});
$("flashPrev").addEventListener("click",()=>{flashIdx=(flashIdx-1+flashList.length)%flashList.length;renderFlash();});
$("flashShuffle").addEventListener("click",()=>{buildFlash();toast("تم الخلط 🔀","ok");});
$("flashCategory").addEventListener("change",buildFlash);
$("flashKapitel").addEventListener("change",buildFlash);
document.querySelectorAll("[data-flash-rate]").forEach(b=>b.addEventListener("click",()=>{
  const w=flashList[flashIdx%flashList.length];if(!w)return;
  const r=b.getAttribute("data-flash-rate");
  if(r==="known"){bumpReview(w.id,true);}else if(r==="hard"){bumpReview(w.id,false);}else{setStatus(w.id,"review");markStudyDay();save();}
  flashIdx++;renderFlash();renderAll();
}));

/* ============ SENTENCES ============ */
function renderSentences(){
  const q=($("sentenceSearch").value||"").toLowerCase();
  const k=$("sentenceKapitel")?$("sentenceKapitel").value:"";
  const list=SENTENCES.filter(s=>(!k||s.kap===k)&&(!q||(s.de+s.ar).toLowerCase().indexOf(q)>=0));
  const box=$("sentList");box.innerHTML="";
  if(!list.length){box.innerHTML='<div class="panel glass">لا توجد جمل هنا بعد.</div>';return;}
  list.forEach((s,i)=>{
    const d=document.createElement("div");d.className="sent-card glass";
    const pron=s.pron?'<div class="sent-pron">🔊 '+escapeHtml(s.pron)+'</div>':'';
    d.innerHTML='<div class="sent-num">'+(i+1)+'</div><div style="flex:1"><div class="sent-de">'+escapeHtml(s.de)+'</div><div class="sent-ar">'+escapeHtml(s.ar)+'</div>'+pron+'<div><span class="tag kap-tag">'+kapName(s.kap)+'</span></div></div><button class="icon-btn" title="استماع">🔊</button>';
    d.querySelector("button").addEventListener("click",()=>{speak(s.de);markStudyDay();});
    box.appendChild(d);
  });
}
$("sentenceSearch").addEventListener("input",renderSentences);
$("sentenceKapitel").addEventListener("change",renderSentences);

/* ============ VERBS ============ */
function renderVerbs(){
  const q=($("verbSearch").value||"").toLowerCase();
  const k=$("verbKapitel")?$("verbKapitel").value:"";
  const box=$("verbGrid");box.innerHTML="";
  const list=allVerbs().filter(v=>(!k||v.kap===k)&&(!q||(v.inf+v.ar).toLowerCase().indexOf(q)>=0));
  if(!list.length){box.innerHTML='<div class="panel glass">لا توجد أفعال هنا بعد.</div>';return;}
  list.slice(0,120).forEach(v=>{
    const d=document.createElement("div");d.className="word-card glass";
    let body="";
    if(v.conj){
      const rows=["ich","du","er","wir","ihr","sie"].map(k2=>'<tr><td>'+k2+'</td><td>'+escapeHtml(v.conj[k2])+'</td></tr>').join("");
      body='<table class="conj-table">'+rows+'</table>';
    }else{
      body='<div class="word-ex"><div class="ex-de">📌 تعبير: '+escapeHtml(v.inf)+'</div><div>يُستخدم كتعبير ثابت — استمع له 🔊</div></div>';
    }
    d.innerHTML='<div class="word-top"><span class="verb-de">'+escapeHtml(v.inf)+'</span><button class="mini-btn">🔊</button></div>'+
    '<div class="word-ar">'+escapeHtml(v.ar)+'</div><div class="word-pron">النطق: '+escapeHtml(v.pron)+'</div>'+
    '<div class="word-meta"><span class="tag kap-tag">'+kapName(v.kap)+'</span></div>'+body;
    d.querySelector("button").addEventListener("click",()=>speak(v.inf));
    box.appendChild(d);
  });
}
$("verbSearch").addEventListener("input",renderVerbs);
$("verbKapitel").addEventListener("change",renderVerbs);

/* ============ GRAMMAR ============ */
function renderGrammar(){
  const box=$("grammarList");box.innerHTML="";
  const k=$("grammarKapitel")?$("grammarKapitel").value:"";
  const list=GRAMMAR.filter(g=>!k||g.kap===k);
  if(!list.length){box.innerHTML='<div class="panel glass">لا توجد قواعد هنا بعد.</div>';return;}
  list.forEach((g,gi)=>{
    const d=document.createElement("div");d.className="grammar-card glass";
    const ex=g.ex.map(e=>'<div class="grammar-ex"><div style="direction:ltr;text-align:left;font-weight:800">'+escapeHtml(e[0])+'</div><div style="color:var(--gold)">'+escapeHtml(e[1])+'</div></div>').join("");
    d.innerHTML='<h3>📐 '+escapeHtml(g.title)+'</h3><div style="margin-bottom:8px"><span class="tag kap-tag">'+kapName(g.kap)+'</span></div><div class="grammar-body">'+escapeHtml(g.body)+'</div>'+ex+
    '<div class="row-flex" style="margin:10px 0"><button class="btn btn-primary sm" data-explain="'+g.id+'">📖 شرح القاعدة</button></div>'+
    '<div class="grammar-quiz"><b>❓ اختبار سريع:</b> '+escapeHtml(g.quiz.q)+'<div class="quiz-opts" style="margin:8px 0">'+g.quiz.opts.map((o,i)=>'<button class="quiz-opt" data-i="'+i+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden"></div></div>';
    d.querySelector("[data-explain]").addEventListener("click",()=>openExplain(g.id));
    d.querySelectorAll(".quiz-opt").forEach(btn=>btn.addEventListener("click",()=>{
      const i=parseInt(btn.getAttribute("data-i"),10);
      const fb=d.querySelector(".quiz-feedback");fb.classList.remove("hidden");
      d.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(i===g.quiz.correct){btn.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+g.quiz.explain;S.totalCorrect++;markStudyDay();}
      else{btn.classList.add("wrong");d.querySelectorAll(".quiz-opt")[g.quiz.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="خطأ ❌ "+g.quiz.explain;}
      S.totalAnswered++;save();renderDashboard();renderStats();
    }));
    box.appendChild(d);
  });
}

if($("grammarKapitel"))$("grammarKapitel").addEventListener("change",renderGrammar);

/* ============ EXPLAIN (📚 الشرح - A1 book) ============ */
function explainOrder(){
  try{
    if(typeof EXPLAIN_ORDER!=="undefined"&&EXPLAIN_ORDER.length)return EXPLAIN_ORDER.filter(id=>GRAMMAR.some(g=>g.id===id));
  }catch(e){}
  return GRAMMAR.map(g=>g.id);
}
function renderExplainIndex(){
  const idx=$("explainIndex"),det=$("explainDetail");
  if(!idx)return;
  det.classList.add("hidden");idx.classList.remove("hidden");
  const k=$("explainKapitel")?$("explainKapitel").value:"";
  const order=explainOrder();
  const list=order.map(id=>GRAMMAR.find(g=>g.id===id)).filter(g=>g&&(!k||g.kap===k));
  $("explainCount").textContent="A1 • "+list.length+" قاعدة";
  if(!list.length){idx.innerHTML='<div class="panel glass">لا توجد شروحات هنا بعد.</div>';return;}
  let h='<div class="panel glass ex-toc"><h3>📖 فهرس شرح A1 — من الأسهل إلى الأصعب</h3><div class="muted">اضغط أي قاعدة لفتح شرحها المفصل 👇</div><div class="ex-toc-list">';
  list.forEach((g,i)=>{
    h+='<button class="ex-toc-item" data-ex="'+g.id+'"><span class="ex-num">'+(i+1)+'</span><span class="ex-t">'+escapeHtml(g.title)+'</span><span class="tag kap-tag">'+escapeHtml(g.kap||"")+'</span><span>←</span></button>';
  });
  h+='</div></div>';
  idx.innerHTML=h;
  idx.querySelectorAll("[data-ex]").forEach(b=>b.addEventListener("click",()=>openExplain(b.getAttribute("data-ex"))));
}
function exBlock(title,inner){return '<div class="ex-block glass"><h4>'+title+'</h4>'+inner+'</div>';}
function exOne(e){return '<div class="ex-de"><div class="ex-de-l">'+escapeHtml(e[0])+' <button class="mini-btn" data-spk="'+escapeHtml(e[0])+'" title="استمع 🔊">🔊</button></div><div class="ex-ar">'+escapeHtml(e[1])+'</div>'+(e[2]?'<div class="ex-pron">🗣️ نطق تقريبي: '+escapeHtml(e[2])+' <span class="muted">(تقريبي فقط — اعتمد على الصوت 🔊)</span></div>':"")+'</div>';}
function exTable(t){return '<div class="ex-block glass"><h4>📊 '+escapeHtml(t.cap)+'</h4><div class="tbl-wrap"><table class="ex-table"><tr>'+t.head.map(h=>'<th>'+escapeHtml(h)+'</th>').join("")+'</tr>'+t.rows.map(r=>'<tr>'+r.map(c=>'<td>'+escapeHtml(c)+'</td>').join("")+'</tr>').join("")+'</table></div></div>';}
function openExplain(id){
  const g=GRAMMAR.find(x=>x.id===id);if(!g)return;
  let E=null;try{E=(typeof EXPLAIN!=="undefined"&&EXPLAIN[id])?EXPLAIN[id]:null;}catch(e){E=null;}
  const order=explainOrder();
  const pos=order.indexOf(id);
  const prev=pos>0?order[pos-1]:null, next=(pos>=0&&pos<order.length-1)?order[pos+1]:null;
  const gPrev=prev?GRAMMAR.find(x=>x.id===prev):null, gNext=next?GRAMMAR.find(x=>x.id===next):null;
  const idx=$("explainIndex"),det=$("explainDetail");
  idx.classList.add("hidden");det.classList.remove("hidden");
  showPage("explain");
  const LV=(E&&E.level)||"A1";
  let h='<div class="ex-nav"><button class="btn btn-ghost sm" id="exBack">📖 الفهرس</button><span class="tag kap-tag">'+kapName(g.kap)+'</span><span class="tag">مستوى '+LV+'</span></div>';
  h+='<div class="panel glass ex-hero"><h2>📚 '+escapeHtml(g.title)+'</h2><div class="ex-short">'+escapeHtml(g.body)+'</div></div>';
  if(E){
    if(E.goals&&E.goals.length)h+=exBlock("🎯 ماذا سأتعلم؟",'<ul class="ex-ul">'+E.goals.map(w=>'<li>'+escapeHtml(w)+'</li>').join("")+'</ul><div class="row-flex"><button class="btn btn-ghost sm" id="exSimple">❓ مش فاهم — اشرح أبسط</button></div><div id="exSimpleBox"></div>');
    h+='<details class="ex-lvl glass" open><summary>🟢 المستوى 1: الأساسيات</summary>'+
    exBlock("1️⃣ ما هي القاعدة؟",'<p>'+escapeHtml(E.what)+'</p>')+
    exBlock("2️⃣ لماذا نستخدمها؟",'<p>'+escapeHtml(E.why)+'</p>')+
    exBlock("5️⃣ أمثلة بسيطة",E.examples.map(exOne).join(""))+'</details>';
    h+='<details class="ex-lvl glass"><summary>🟡 المستوى 2: التعمق</summary>'+
    exBlock("3️⃣ متى نستخدمها؟",'<ul class="ex-ul">'+E.when.map(w=>'<li>'+escapeHtml(w)+'</li>').join("")+'</ul>')+
    exBlock("4️⃣ كيف نستخدمها؟",'<ol class="ex-ul">'+E.how.map(w=>'<li>'+escapeHtml(w)+'</li>').join("")+'</ol>')+
    (E.tables&&E.tables.length?E.tables.map(exTable).join(""):"")+
    exBlock("6️⃣ أمثلة من الحياة اليومية",E.daily.map(exOne).join(""))+
    exBlock("9️⃣ مقارنة سريعة",'<p>'+escapeHtml(E.compare)+'</p>')+'</details>';
    h+='<details class="ex-lvl glass"><summary>🔴 المستوى 3: الأخطاء والمراجعة</summary>'+
    exBlock("7️⃣ ملاحظات مهمة ⭐",'<ul class="ex-ul">'+E.notes.map(w=>'<li>'+escapeHtml(w)+'</li>').join("")+'</ul>')+
    exBlock("8️⃣ الأخطاء الشائعة",E.mistakes.map(m=>'<div class="ex-mist"><div class="ex-wrong">❌ خطأ: '+escapeHtml(m.w)+'</div><div class="ex-right">✅ الصحيح: '+escapeHtml(m.r)+'</div><div class="muted">لماذا؟ '+escapeHtml(m.why)+'</div></div>').join(""))+
    exBlock("🔟 خلاصة القاعدة",'<div class="ex-sum">'+escapeHtml(E.summary)+'</div>')+'</details>';
    if(E.drill&&E.drill.length){
      h+='<div class="panel glass"><b>✍️ تدريب سريع:</b> '+escapeHtml(E.drill[0].t)+'<div class="quiz-opts" id="exDrillOpts" style="margin:8px 0">'+E.drill[0].opts.map((o,i)=>'<button class="quiz-opt" data-i="'+i+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="exDrillFb"></div></div>';
    }
  }else{
    h+=exBlock("الشرح المختصر",'<p>'+escapeHtml(g.body)+'</p>');
  }
  const q=g.quiz?'<div class="panel glass"><b>❓ اختبار قصير:</b> '+escapeHtml(g.quiz.q)+'<div class="quiz-opts" id="exQuizOpts" style="margin:8px 0">'+g.quiz.opts.map((o,i)=>'<button class="quiz-opt" data-i="'+i+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="exQuizFb"></div></div>':'';
  h+=q;
  if(E&&E.review){
    h+='<div class="panel glass"><b>📌 ماذا تعلمت؟ Was habe ich gelernt?</b><ul class="ex-ul"><li>القاعدة: '+escapeHtml(E.review.rule)+'</li><li>كلمات مهمة: '+escapeHtml(E.review.words)+'</li><li>أهم مثال: '+escapeHtml(E.review.example)+'</li><li>خطأ تجنبه: '+escapeHtml(E.review.mistake)+'</li><li>سؤال سريع: '+escapeHtml(E.review.q)+'</li></ul><div class="row-flex"><button class="btn btn-gold sm" id="exReviewLater">🔁 راجع الدرس لاحقًا</button></div></div>';
  }
  h+='<div class="ex-nav bottom"><button class="btn btn-ghost sm" id="exPrev" '+(gPrev?'':'disabled')+'>→ '+(gPrev?escapeHtml(gPrev.title):'لا يوجد')+'</button><button class="btn btn-gold sm" id="exIdx">📖 الفهرس</button><button class="btn btn-ghost sm" id="exNext" '+(gNext?'':'disabled')+'>'+(gNext?escapeHtml(gNext.title):'لا يوجد')+' ←</button></div>';
  det.innerHTML=h;
  window.scrollTo({top:0,behavior:"smooth"});
  const goIdx=()=>renderExplainIndex();
  $("exBack").addEventListener("click",goIdx);
  $("exIdx").addEventListener("click",goIdx);
  if(gPrev)$("exPrev").addEventListener("click",()=>openExplain(gPrev.id));
  if(gNext)$("exNext").addEventListener("click",()=>openExplain(gNext.id));
  det.querySelectorAll("[data-spk]").forEach(b=>b.addEventListener("click",ev=>{ev.stopPropagation();try{speakGerman(b.getAttribute("data-spk"));}catch(e){}}));
  if($("exReviewLater"))$("exReviewLater").addEventListener("click",()=>{
    try{
      if(E&&E.relWords)E.relWords.forEach(function(dw){const w=allWords().find(x=>x.de===dw);if(w)setStatus(w.id,"review");});
      save();markStudyDay();
    }catch(e){}
    toast("أُضيف الدرس للمراجعة 🔁","ok");showPage("review");
  });
  if($("exSimple"))$("exSimple").addEventListener("click",()=>{
    const bx=$("exSimpleBox");if(!bx)return;
    const n=parseInt(bx.dataset.n||"0",10)+1;bx.dataset.n=n;
    const ex0=(E.examples&&E.examples[0])||["",""];
    const m0=(E.mistakes&&E.mistakes[0])||{r:"",why:""};
    if(n===1){bx.innerHTML='<div class="ex-sum">ببساطة، فكر فيها كده: '+escapeHtml(E.summary)+'<br>مثال: '+escapeHtml(ex0[0])+' = '+escapeHtml(ex0[1])+'</div>';}
    else{bx.innerHTML='<div class="ex-sum" style="font-size:18px">كأنك تتعلم أول مرة 🌱<br>'+escapeHtml(E.summary)+'<br>✅ احفظ هذه فقط: '+escapeHtml(m0.r||ex0[0])+(m0.why?'<br>ليه؟ '+escapeHtml(m0.why):"")+'</div>';bx.dataset.n=0;}
    bx.scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  if(E&&E.drill&&E.drill.length){
    const dr=E.drill[0];
    det.querySelectorAll("#exDrillOpts .quiz-opt").forEach(btn=>btn.addEventListener("click",()=>{
      const i=parseInt(btn.getAttribute("data-i"),10);
      const fb=$("exDrillFb");fb.classList.remove("hidden");
      det.querySelectorAll("#exDrillOpts .quiz-opt").forEach(x=>x.disabled=true);
      if(i===dr.correct){btn.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+dr.why;}
      else{btn.classList.add("wrong");det.querySelectorAll("#exDrillOpts .quiz-opt")[dr.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="خطأ ❌ الصحيح: "+dr.opts[dr.correct]+" — لماذا؟ "+dr.why;}
    }));
  }
  if(g.quiz){
    det.querySelectorAll("#exQuizOpts .quiz-opt").forEach(btn=>btn.addEventListener("click",()=>{
      const i=parseInt(btn.getAttribute("data-i"),10);
      const fb=$("exQuizFb");fb.classList.remove("hidden");
      det.querySelectorAll("#exQuizOpts .quiz-opt").forEach(x=>x.disabled=true);
      if(i===g.quiz.correct){btn.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+g.quiz.explain;try{if(typeof completeLesson==="function")completeLesson(g.id);}catch(e){}}
      else{btn.classList.add("wrong");det.querySelectorAll("#exQuizOpts .quiz-opt")[g.quiz.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="خطأ ❌ "+g.quiz.explain;try{if(S){S.gweak=S.gweak||{};S.gweak[g.id]=(S.gweak[g.id]||0)+1;save();}}catch(e){}}
    }));
  }
}
if($("explainKapitel"))$("explainKapitel").addEventListener("change",renderExplainIndex);

/* ============ QUIZ ENGINE ============ */
let quizType="mixed",quizQs=[],quizIdx=0,quizScore=0;
let quizCombo=0,quizXpEarned=0,quizResults=[],quizTimerInt=null,qTimeLeft=0;
const QUICK_SECS=15;
function stopQTimer(){if(quizTimerInt){clearInterval(quizTimerInt);quizTimerInt=null;}$("quizTimerWrap").classList.add("hidden");}
function startQTimer(){
  stopQTimer();
  if(quizType!=="quick")return;
  qTimeLeft=QUICK_SECS;
  $("quizTimerWrap").classList.remove("hidden");
  $("quizTimerFill").style.width="100%";
  quizTimerInt=setInterval(()=>{
    qTimeLeft-=0.1;
    $("quizTimerFill").style.width=Math.max(0,qTimeLeft/QUICK_SECS*100)+"%";
    if(qTimeLeft<=0){stopQTimer();timeoutAnswer();}
  },100);
}
document.querySelectorAll(".quiz-type").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".quiz-type").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");quizType=b.getAttribute("data-type");
}));
document.querySelectorAll("[data-quiz]").forEach(b=>b.addEventListener("click",()=>{
  const t=b.getAttribute("data-quiz");showPage("quiz");
  document.querySelectorAll(".quiz-type").forEach(x=>x.classList.toggle("active",x.getAttribute("data-type")===t));
  quizType=t;$("startQuiz").click();
}));
function randOpts(words,correct,fn){
  const pool=shuffle(words.filter(w=>w.id!==correct.id));
  const opts=[correct].concat(pool.slice(0,3));
  return shuffle(opts).map(fn);
}
/* ============================================================
   QUESTION BANK — بنك الأسئلة القابل للتوسع
   لإضافة نوع جديد: أضف مولّدًا هنا + زر data-type في HTML فقط
   صيغة السؤال: {kind, w, prompt, opts?, correctText?, writeAnswer?, listen?, replay?, parts?, correct?, explain}
   ============================================================ */
const LVL_NAMES=["مبتدئ","متعلم","مجتهد","متقدم","محترف","خبير","أسطورة"];
function levelFor(xp){const lvl=Math.floor(Math.sqrt((xp||0)/100))+1;const base=100*(lvl-1)*(lvl-1);const need=100*lvl*lvl-base;return{lvl:lvl,cur:(xp||0)-base,need:need,name:LVL_NAMES[Math.min(lvl-1,LVL_NAMES.length-1)]};}
function addXP(n){S.xp=(S.xp||0)+n;save();return n;}
function recordMistake(w,picked,kind){
  if(!w||!w.id)return;
  if(!S.mistakes)S.mistakes={};
  const m=S.mistakes[w.id]||{n:0};
  m.n++;m.last=picked||"";m.kind=kind||"";m.date=todayStr();
  m.de=fullDe(w);m.ar=w.ar;
  S.mistakes[w.id]=m;
  const keys=Object.keys(S.mistakes);
  if(keys.length>200){keys.sort((a,b)=>S.mistakes[a].n-S.mistakes[b].n);for(let i=0;i<keys.length-200;i++)delete S.mistakes[keys[i]];}
  save();
}
function removeMistake(id){if(S.mistakes&&S.mistakes[id]){delete S.mistakes[id];save();}}
/* المراجعة الذكية: وزن الكلمة حسب أخطائها وحالتها */
function wordWeight(w){
  let s=1;
  const m=S.mistakes&&S.mistakes[w.id];
  if(m)s+=3*Math.min(m.n,5);
  const st=getStatus(w.id);
  if(st==="hard")s+=2;else if(st==="review")s+=1;else if(st==="known")s-=0.6;
  return Math.max(0.2,s);
}
function normWrite(s){return String(s||"").trim().toLowerCase().replace(/[.?!]$/,"").split(/\s+/)[0];}
function pickWeighted(words,n){
  const pool=words.slice(),out=[];
  while(out.length<n&&pool.length){
    let tot=0,i;pool.forEach(w=>tot+=wordWeight(w));
    let r=Math.random()*tot;
    for(i=0;i<pool.length;i++){r-=wordWeight(pool[i]);if(r<=0)break;}
    i=Math.min(i,pool.length-1);out.push(pool.splice(i,1)[0]);
  }
  return out;
}
/* مولدات بنك الأسئلة — كل نوع دالة مستقلة */
function genArticle(w,words){return{kind:"article",w:w,prompt:"ما الأداة الصحيحة؟  —  "+w.de,opts:["der","die","das"],correct:w.art==="der"?0:w.art==="die"?1:2,explain:w.art+" "+w.de+" = "+w.ar+". احفظ الأداة مع الكلمة!"};}
function genMeaning(w,words){return{kind:"de-ar",w:w,prompt:"اختر المعنى الصحيح:  "+fullDe(w),opts:randOpts(words,w,x=>x.ar),correctText:w.ar,explain:fullDe(w)+" = "+w.ar+" — النطق: "+w.pron};}
function genTranslate(w,words){return{kind:"ar-de",w:w,prompt:"اختر الكلمة الألمانية الصحيحة:  "+w.ar,opts:randOpts(words,w,x=>fullDe(x)),correctText:fullDe(w),explain:fullDe(w)+" = "+w.ar+" — "+w.ex};}
function genPlural(w,words){const c=pluralFull(w);return{kind:"plural",w:w,prompt:"ما جمع الكلمة؟  —  "+fullDe(w),opts:pluralDistractors(w),correctText:c,explain:"الجمع: "+c+" ("+w.ar+")"};}
function genWrite(w,words){return{kind:"write",w:w,prompt:"اكتب الأداة الصحيحة:  ___ "+w.de,writeAnswer:w.art,explain:"الإجابة: "+w.art+" "+w.de+" = "+w.ar};}
function genListening(w,words){const f=fullDe(w);return{kind:"listening",w:w,prompt:"🎧 استمع واختر الكلمة التي سمعتها",opts:randOpts(words,w,x=>fullDe(x)),correctText:f,listen:f,explain:"سمعت: "+f+" = "+w.ar};}
function genSentence(w,words){const blank=w.ex.replace(w.de,"_____").replace(w.de.toLowerCase(),"_____");return{kind:"sentence",w:w,prompt:"أكمل الجملة: "+blank+" ("+w.exAr+")",opts:randOpts(words,w,x=>x.de),correctText:w.de,explain:"الإجابة: "+w.de+" — "+w.ex};}
function genOrder(w,words){const parts=w.ex.replace(/[.?!,]/g,"").split(" ").filter(Boolean);return{kind:"order",w:w,prompt:"🔀 رتّب الكلمات لتكوين جملة صحيحة: ("+w.exAr+")",parts:shuffle(parts),correct:w.ex,explain:"الجملة الصحيحة: "+w.ex};}
const MIXED_KINDS=["article","de-ar","ar-de","plural","write","listening","sentence","order"];
function kindFits(t,w){
  if(t==="article"||t==="write")return w.art!=="-";
  if(t==="plural")return w.art!=="-"&&!!w.plural;
  if(t==="order")return w.ex.replace(/[.?!,]/g,"").split(" ").filter(Boolean).length>=4;
  return true;
}
function makeQ(t,w,words){
  if(!kindFits(t,w))t=(w.art!=="-"?"article":"de-ar");
  if(t==="article")return genArticle(w,words);
  if(t==="de-ar")return genMeaning(w,words);
  if(t==="ar-de")return genTranslate(w,words);
  if(t==="plural")return genPlural(w,words);
  if(t==="write")return genWrite(w,words);
  if(t==="listening")return genListening(w,words);
  if(t==="sentence")return genSentence(w,words);
  if(t==="order")return genOrder(w,words);
  return genMeaning(w,words);
}
function buildQuestions(type,count,forcedWords){
  const words=allWords();
  const qs=[];
  if(type==="listenArticle"){
    const picks=forcedWords&&forcedWords.length?forcedWords:pickWeighted(words,Math.ceil(count/2));
    for(let i=0;i<count&&picks.length;i++){
      const w=picks[i%picks.length];
      const f=fullDe(w);
      qs.push({kind:"listening",w:w,step:"word",prompt:"🎧 استمع للكلمة (١) — ما الكلمة التي سمعتها؟",opts:randOpts(words,w,x=>fullDe(x)),correctText:f,listen:f,explain:"سمعت: "+f+" = "+w.ar});
      if(qs.length>=count)break;
      if(w.art!=="-")qs.push({kind:"article",w:w,step:"article",replay:f,prompt:"🎧 (٢) ما أداة الكلمة التي سمعتها؟",opts:["der","die","das"],correct:w.art==="der"?0:w.art==="die"?1:2,explain:w.art+" "+w.de+" = "+w.ar});
      else qs.push(makeQ("de-ar",w,words));
    }
    return qs.slice(0,count);
  }
  let kinds;
  if(type==="mixed")kinds=MIXED_KINDS;
  else if(type==="quick")kinds=["article","de-ar","ar-de","plural","listening","order"];
  else if(type==="sentence"&&!(forcedWords&&forcedWords.length)){
    try{return pickFillBank("mix",count).map(fillToQuiz);}catch(e){}
    kinds=[type];
  }
  else kinds=[type];
  const picks=forcedWords&&forcedWords.length?forcedWords:pickWeighted(words,count);
  if(!picks.length)return[];
  for(let i=0;i<count;i++){
    const w=picks[i%picks.length];
    const t=(type==="mixed"||type==="quick")?kinds[i%kinds.length]:kinds[0];
    qs.push(makeQ(t,w,words));
  }
  return qs;
}
$("startQuiz").addEventListener("click",()=>{
  const n=quizType==="quick"?10:(parseInt($("quizCount").value,10)||10);
  startQuizRun(quizType,buildQuestions(quizType,n));
});
function startQuizRun(type,qs){
  quizType=type;quizQs=qs;quizIdx=0;quizScore=0;quizCombo=0;quizXpEarned=0;quizResults=[];
  stopQTimer();
  if(!qs.length){toast("لا توجد كلمات مناسبة لهذا الاختبار ⚠️","err");return;}
  $("quizSetup").classList.add("hidden");$("quizPlay").classList.remove("hidden");$("quizResult").classList.add("hidden");
  renderQ();markStudyDay();
}
function renderQ(){
  const q=quizQs[quizIdx];if(!q){finishQuiz();return;}
  stopQTimer();
  $("quizQNum").textContent=(quizIdx+1)+" / "+quizQs.length;
  $("quizBar").style.width=(quizIdx/quizQs.length*100)+"%";
  $("quizScoreLive").textContent=quizScore+" ✅";
  $("quizCombo").textContent="🔥"+quizCombo;
  $("quizQuestion").textContent=q.prompt;
  $("quizFeedback").classList.add("hidden");
  $("quizNext").disabled=true;
  const box=$("quizOpts");box.innerHTML="";$("quizOrder").innerHTML="";$("quizListenBtn").innerHTML="";
  $("quizWrite").classList.add("hidden");$("quizWriteInput").value="";
  if(q.listen||q.replay){
    const txt=q.listen||q.replay;
    const b=document.createElement("button");b.className="btn btn-gold sm";b.textContent="🔊 استمع الآن";
    b.addEventListener("click",()=>speak(txt));
    $("quizListenBtn").appendChild(b);setTimeout(()=>speak(txt),400);
  }
  if(q.kind==="order"){
    const ans=document.createElement("div");ans.className="order-answer";ans.id="orderAns";
    const pool=document.createElement("div");pool.className="quiz-order";
    let picked=[];
    q.parts.forEach(p=>{
      const c=document.createElement("button");c.className="order-chip";c.textContent=p;
      c.addEventListener("click",()=>{if(c.classList.contains("used"))return;c.classList.add("used");picked.push(p);renderAns();});
      pool.appendChild(c);
    });
    function renderAns(){
      ans.innerHTML=picked.map((p,i)=>'<span class="order-chip">'+escapeHtml(p)+' <b data-i="'+i+'" style="cursor:pointer">✖</b></span>').join("");
      ans.querySelectorAll("b").forEach(x=>x.addEventListener("click",()=>{
        const i=parseInt(x.getAttribute("data-i"),10);
        const removed=picked.splice(i,1)[0];
        Array.from(pool.children).find(c=>c.textContent===removed&&c.classList.contains("used")).classList.remove("used");
        renderAns();
      }));
    }
    const check=document.createElement("button");check.className="btn btn-primary sm";check.textContent="تحقق ✅";
    check.addEventListener("click",()=>answerOrder(picked.join(" ")));
    $("quizOrder").appendChild(pool);$("quizOrder").appendChild(ans);$("quizOrder").appendChild(check);
    return;
  }
  if(q.kind==="write"){
    $("quizWrite").classList.remove("hidden");
    setTimeout(()=>$("quizWriteInput").focus(),300);
    startQTimer();
    return;
  }
  startQTimer();
  const opts=q.opts||[];
  opts.forEach(o=>{
    const txt=(typeof o==="string")?o:o;
    const btn=document.createElement("button");btn.className="quiz-opt";btn.textContent=txt;btn.dir="auto";
    btn.addEventListener("click",()=>answerQuiz(txt,btn));
    box.appendChild(btn);
  });
}
function answerWrite(){
  const q=quizQs[quizIdx];
  const raw=$("quizWriteInput").value;
  if(!normWrite(raw)){toast("اكتب الأداة أولًا ✍️","err");return;}
  const ok=normWrite(raw)===q.writeAnswer;
  $("quizWriteInput").disabled=true;$("quizWriteCheck").disabled=true;
  $("quizWriteInput").style.borderColor=ok?"var(--green)":"var(--red)";
  showFeedback(ok,q,raw);
}
function timeoutAnswer(){
  const q=quizQs[quizIdx];
  if(!q||!$("quizNext").disabled)return;
  if(q.kind==="write"){$("quizWriteInput").disabled=true;$("quizWriteCheck").disabled=true;}
  Array.from($("quizOpts").children).forEach(b=>{b.disabled=true;});
  toast("⏱️ انتهى الوقت!","err");
  showFeedback(false,q,"(انتهى الوقت)");
}
$("quizWriteCheck").addEventListener("click",answerWrite);
$("quizWriteInput").addEventListener("keydown",e=>{if(e.key==="Enter")answerWrite();});
function correctOf(q){
  if(q.kind==="article")return q.opts[q.correct];
  return q.correctText;
}
function answerQuiz(picked,btn){
  const q=quizQs[quizIdx];
  const ok=picked===correctOf(q);
  Array.from($("quizOpts").children).forEach(b=>{b.disabled=true;if(b.textContent===correctOf(q))b.classList.add("correct");});
  if(!ok)btn.classList.add("wrong");
  showFeedback(ok,q);
}
function answerOrder(joined){
  const q=quizQs[quizIdx];
  const norm=s=>s.replace(/[.?!,]/g,"").trim().replace(/\s+/g," ").toLowerCase();
  const ok=norm(joined)===norm(q.correct.replace(/[.?!,]/g,""));
  showFeedback(ok,q);
  if(ok){toast("ترتيب صحيح! 🎉","ok");}
}
function showFeedback(ok,q,pickedText){
  stopQTimer();
  const fb=$("quizFeedback");fb.classList.remove("hidden","ok","no");
  fb.classList.add(ok?"ok":"no");
  let gained=0;
  if(ok){
    quizScore++;quizCombo++;
    if(quizCombo>(S.maxCombo||0))S.maxCombo=quizCombo;
    S.totalCorrect++;
    if(quizType==="quick"){gained=10+Math.max(0,Math.ceil(qTimeLeft))+(quizCombo-1)*5;}
    else gained=10;
    addXP(gained);quizXpEarned+=gained;
    if(q.w)bumpSilent(q.w.id,true);
    if(q.w&&S.mistakes&&S.mistakes[q.w.id]){S.mistakes[q.w.id].n--;if(S.mistakes[q.w.id].n<=0)delete S.mistakes[q.w.id];}
  }else{
    quizCombo=0;
    if(q.w){bumpSilent(q.w.id,false);recordMistake(q.w,pickedText||"",q.kind);}
  }
  fb.textContent=(ok?"صحيح ✅ +"+gained+" XP ⭐"+(quizCombo>=2?"  🔥x"+quizCombo:""):"خطأ ❌ ")+q.explain;
  $("quizNext").disabled=false;
  S.totalAnswered++;save();
  $("quizScoreLive").textContent=quizScore+" ✅";
  $("quizCombo").textContent="🔥"+quizCombo;
  quizResults.push({ok:ok,xp:gained,picked:pickedText||"",q:q});
}
function bumpSilent(id,ok){
  if(!S.review[id])S.review[id]={c:0,w:0};
  if(ok){S.review[id].c++;}else{S.review[id].w++;setStatus(id,"hard");}
}
$("quizNext").addEventListener("click",()=>{stopQTimer();quizIdx++;if(quizIdx>=quizQs.length)finishQuiz();else renderQ();});
$("quizQuit").addEventListener("click",()=>{stopQTimer();finishQuiz();});
function quizTypeName(t){const m={mixed:"🎲 شامل",article:"🎯 الأدوات","de-ar":"📖 الكلمة → المعنى","ar-de":"🔄 عربي → ألماني",plural:"👥 الجمع",write:"✍️ كتابة الأداة",listening:"🎧 استماع",listenArticle:"🎧+🎯 استماع وأداة",sentence:"🧩 إكمال الجملة",order:"🔀 ترتيب الجملة",quick:"⚡ اختبار سريع",mistakes:"❌ أخطائي"};return m[t]||t;}
function finishQuiz(){
  stopQTimer();
  $("quizPlay").classList.add("hidden");$("quizSetup").classList.remove("hidden");
  const total=quizQs.length,score=quizScore;
  const pct=total?Math.round(score/total*100):0;
  const wrong=total-score;
  S.testsTaken=(S.testsTaken||0)+1;
  if(pct>(S.bestPct||0))S.bestPct=pct;
  S.lastQuiz={type:quizTypeName(quizType),score:score,total:total,pct:pct,xp:quizXpEarned,date:todayStr()};
  S.quizHistory.unshift({type:quizTypeName(quizType),score:score,total:total,pct:pct,xp:quizXpEarned,date:todayStr()+" "+new Date().toLocaleTimeString("ar")});
  S.quizHistory=S.quizHistory.slice(0,20);
  save();
  const r=$("quizResult");r.classList.remove("hidden");
  const mist=quizResults.filter(x=>!x.ok&&x.q.w);
  const mistRows=mist.length?mist.map(x=>{
    const right=x.q.kind==="article"?x.q.opts[x.q.correct]:(x.q.correctText||x.q.writeAnswer||"");
    return '<div class="mist-err">❌ <b>'+escapeHtml(fullDe(x.q.w))+'</b> — '+escapeHtml(x.q.w.ar)+'<br>إجابتك: <b>'+escapeHtml(x.picked||"—")+'</b> | الصحيحة: <b style="color:var(--green)">'+escapeHtml(right)+'</b></div>';
  }).join(""):'<div class="muted">ممتاز — بلا أخطاء! 🎉</div>';
  r.innerHTML='<h3>🎉 اختبار مكتمل — '+escapeHtml(quizTypeName(quizType))+'</h3>'+
    '<div class="stat-num" style="font-size:44px">'+pct+'%</div>'+
    '<div class="progress" style="margin:10px 0"><div class="progress-fill" style="width:'+pct+'%"></div></div>'+
    '<div class="row-flex" style="justify-content:center">✅ صحيحة: <b>'+score+'</b> &nbsp; ❌ خاطئة: <b>'+wrong+'</b> &nbsp; ⭐ XP: <b>+'+quizXpEarned+'</b> &nbsp; 🔥 أفضل Combo: <b>'+(S.maxCombo||0)+'</b></div>'+
    '<p>'+(pct>=80?"ممتاز! 🎉":pct>=50?"جيد، واصل! 💪":"تحتاج مراجعة، لا تستسلم! 📚")+'</p>'+
    '<h3>الكلمات التي أخطأت فيها ('+mist.length+')</h3>'+mistRows+
    '<div class="row-flex"><button class="btn btn-primary sm" id="retryQuiz">🔄 إعادة الاختبار</button><button class="btn btn-red sm" id="goMistakes">❌ مراجعة الأخطاء</button><button class="btn btn-ghost sm" id="goHome">🏠 الرئيسية</button></div>';
  $("retryQuiz").addEventListener("click",()=>{r.classList.add("hidden");if(quizType==="mistakes")startMistakesQuiz();else $("startQuiz").click();});
  $("goMistakes").addEventListener("click",()=>{r.classList.add("hidden");showPage("mistakes");});
  $("goHome").addEventListener("click",()=>{r.classList.add("hidden");showPage("dashboard");});
  markStudyDay();renderAll();
  r.scrollIntoView({behavior:"smooth"});
}
function quickArticleQuiz(w){
  showPage("quiz");
  document.querySelectorAll(".quiz-type").forEach(x=>x.classList.toggle("active",x.getAttribute("data-type")==="article"));
  quizType="article";
  if(w.art==="-"){toast("هذه الكلمة بدون أداة، اخترنا لك اختبارًا شاملًا","ok");quizType="mixed";}
  const qs=buildQuestions(quizType,10);
  if(w.art!=="-"&&qs.length){qs[0]={kind:"article",w:w,prompt:"ما الأداة الصحيحة؟  —  "+w.de,opts:["der","die","das"],correct:w.art==="der"?0:w.art==="die"?1:2,explain:w.art+" "+w.de+" = "+w.ar};}
  showPage("quiz");
  startQuizRun(quizType,qs);
}
function renderQuizHistory(){
  const box=$("quizHistory");box.innerHTML="";
  if(!S.quizHistory.length){box.innerHTML='<div class="muted">لم تحل أي اختبار بعد. ابدأ الآن! 🚀</div>';return;}
  S.quizHistory.forEach(h=>{
    const d=document.createElement("div");d.className="history-item";
    d.innerHTML='<span>📝 '+escapeHtml(h.type)+' • '+escapeHtml(h.date)+'</span><b>'+h.score+'/'+h.total+' ('+h.pct+'%)'+(h.xp?" ⭐+"+h.xp:"")+'</b>';
    box.appendChild(d);
  });
}

/* ============ STATS ============ */
/* ============ مراجعة أخطائي ============ */
function renderMistakes(){
  if(!S.mistakes)S.mistakes={};
  const ids=Object.keys(S.mistakes).sort((a,b)=>S.mistakes[b].n-S.mistakes[a].n);
  $("mistCount").textContent=ids.length;
  $("navMistBadge").textContent=ids.length;
  const g=$("mistGrid");g.innerHTML="";
  if(!ids.length){g.innerHTML='<div class="panel glass">لا توجد أخطاء — استمر! 🎉<br><span class="muted">الكلمات التي تخطئ فيها أثناء الاختبارات ستظهر هنا.</span></div>';return;}
  ids.slice(0,60).forEach(id=>{
    const m=S.mistakes[id];const w=wordById(id);
    const d=document.createElement("div");d.className="mist-card glass";
    d.innerHTML='<div class="de-line" dir="ltr"><b>'+escapeHtml(m.de||(w?fullDe(w):id))+'</b></div>'+
      '<div class="word-ar">'+escapeHtml(m.ar||(w?w.ar:""))+'</div>'+
      '<div class="mist-err">❌ خطأك: <b>'+escapeHtml(m.last||"—")+'</b> • تكرر <b>'+m.n+'</b> '+(m.n>1?"مرات":"مرة")+'</div>'+
      '<div class="card-actions"><button class="mini-btn" data-a="speak">🔊</button><button class="mini-btn" data-a="test">🎯 اختبرني</button><button class="mini-btn" data-a="del">🗑️</button></div>';
    d.querySelector('[data-a="speak"]').addEventListener("click",()=>{if(w)speak(fullDe(w));});
    d.querySelector('[data-a="test"]').addEventListener("click",()=>{if(w)quickArticleQuiz(w);else toast("الكلمة غير موجودة","err");});
    d.querySelector('[data-a="del"]').addEventListener("click",()=>{removeMistake(id);renderMistakes();});
    g.appendChild(d);
  });
}
function startMistakesQuiz(){
  const ids=Object.keys(S.mistakes||{});
  const words=ids.map(wordById).filter(Boolean);
  if(!words.length){toast("لا توجد أخطاء للاختبار 🎉","ok");return;}
  showPage("quiz");
  startQuizRun("mistakes",buildQuestions("mixed",Math.min(15,words.length),words));
}
$("startMistakes").addEventListener("click",startMistakesQuiz);
$("clearMistakes").addEventListener("click",()=>{if(!confirm("مسح كل الأخطاء؟"))return;S.mistakes={};save();renderMistakes();toast("تم المسح 🗑️","ok");});
function renderStats(){
  const words=allWords();
  const counts={new:0,review:0,hard:0,known:0,later:0};
  words.forEach(w=>counts[getStatus(w.id)]++);
  const acc=S.totalAnswered?Math.round(S.totalCorrect/S.totalAnswered*100):0;
  const cards=[
    ["📚",words.length,"إجمالي الكلمات"],["✅",counts.known,"محفوظة"],["🔴",counts.hard,"صعبة"],
    ["📝",S.testsTaken||0,"اختبارات"],["🎯",acc+"%","نسبة النجاح"],["📅",Object.keys(S.studyDays).length,"أيام المذاكرة"],["🔥",(S.streak.longest||0),"أطول Streak"]
  ];
  $("statsGrid").innerHTML=cards.map(c=>'<div class="stat-card glass"><div class="stat-ico">'+c[0]+'</div><div class="stat-num">'+c[1]+'</div><div class="stat-label">'+c[2]+'</div></div>').join("");
  const colors={new:"#22d3ee",review:"#fb923c",hard:"#ef4444",known:"#22c55e",later:"#94a3b8"};
  $("statusBars").innerHTML=Object.keys(counts).map(k=>'<div class="stat-bar-row"><span class="lbl">'+STATUS_AR[k]+'</span><div class="bar"><div class="fill" style="width:'+(words.length?counts[k]/words.length*100:0)+'%;background:'+colors[k]+'"></div></div><b>'+counts[k]+'</b></div>').join("");
  const wrong=Math.max(0,(S.totalAnswered||0)-(S.totalCorrect||0));
  $("donut").style.background="conic-gradient(var(--green) "+acc+"%, rgba(255,255,255,.1) "+acc+"%)";
  $("donutTxt").textContent=acc+"%";
  $("legCorrect").textContent=S.totalCorrect||0;$("legWrong").textContent=wrong;
  const wc=$("weekChart");wc.innerHTML="";
  const daysAr=["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const key=todayStr(d);const on=!!S.studyDays[key];
    const div=document.createElement("div");div.className="week-day";
    div.innerHTML='<div class="week-bar" style="height:'+(on?100:12)+'px;opacity:'+(on?1:.3)+'"></div><span>'+daysAr[d.getDay()]+'</span>';
    wc.appendChild(div);
  }
}
$("resetStats").addEventListener("click",()=>{
  if(!confirm("تصفير الإحصائيات؟"))return;
  S.totalCorrect=0;S.totalAnswered=0;S.testsTaken=0;S.quizHistory=[];S.review={};save();renderAll();toast("تم التصفير 🗑️","ok");
});

/* ============ PLANNER ============ */
function renderPlanner(){
  $("planWords").value=S.planner.words;$("planSentences").value=S.planner.sentences;$("planMinutes").value=S.planner.minutes;
  const t=todayStr();
  const dw=S.planner.day===t?S.planner.dw:0,ds=S.planner.day===t?S.planner.ds:0,dm=S.planner.day===t?S.planner.dm:0;
  function bar(v,g){const p=Math.min(100,Math.round(v/g*100));return '<div class="progress"><div class="progress-fill" style="width:'+p+'%"></div></div><div class="muted">'+v+' / '+g+' ('+p+'%)</div>';}
  $("planProgress").innerHTML='<b>📚 كلمات</b>'+bar(dw,S.planner.words)+'<br><b>💬 جمل</b>'+bar(ds,S.planner.sentences)+'<br><b>⏱️ دقائق</b>'+bar(dm,S.planner.minutes);
}
$("savePlan").addEventListener("click",()=>{
  S.planner.words=Math.max(1,parseInt($("planWords").value,10)||20);
  S.planner.sentences=Math.max(1,parseInt($("planSentences").value,10)||10);
  S.planner.minutes=Math.max(5,parseInt($("planMinutes").value,10)||30);
  save();renderAll();toast("تم حفظ الخطة 💾","ok");markStudyDay();
});
function planTouch(kind){
  const t=todayStr();
  if(S.planner.day!==t){S.planner.day=t;S.planner.dw=0;S.planner.ds=0;S.planner.dm=0;}
  if(kind==="w")S.planner.dw++;if(kind==="s")S.planner.ds++;if(kind==="m")S.planner.dm+=5;
  save();renderAll();markStudyDay();
}
$("planWordDone").addEventListener("click",()=>planTouch("w"));
$("planSentDone").addEventListener("click",()=>planTouch("s"));
$("planMinDone").addEventListener("click",()=>planTouch("m"));
$("planResetDay").addEventListener("click",()=>{S.planner.day=todayStr();S.planner.dw=0;S.planner.ds=0;S.planner.dm=0;save();renderAll();});

/* ============ FAVORITES ============ */
function renderFavs(){
  const list=allWords().filter(w=>S.favs.includes(w.id));
  $("favCount").textContent=list.length;$("navFavBadge").textContent=list.length;
  const g=$("favGrid");g.innerHTML="";
  if(!list.length){g.innerHTML='<div class="panel glass">لا توجد مفضلة بعد. اضغط ❤️ على أي كلمة!</div>';return;}
  list.forEach(w=>g.appendChild(wordCard(w)));
}

/* ============ SEARCH ============ */
(function(){
  const inp=$("globalSearch");if(!inp)return;
  const wrap=inp.closest(".search-wrap");
  const hasText=()=>inp.value.trim()!=="";
  const sync=()=>{if(wrap)wrap.classList.toggle("has-text",hasText());};
  inp.addEventListener("input",sync);sync();
  try{inp.dataset.iconSync="1";}catch(e){}
})();
$("globalSearch").addEventListener("input",e=>{
  const q=e.target.value.trim().toLowerCase();const box=$("searchResults");
  if(q.length<2){box.classList.remove("show");box.innerHTML="";return;}
  const hits=[];
  allWords().filter(w=>(w.de+w.ar).toLowerCase().indexOf(q)>=0).slice(0,5).forEach(w=>hits.push({t:"📚 "+(w.art!=="-"?w.art+" ":"")+w.de+" — "+w.ar+" ["+(w.kap||"KX")+"]",go:()=>{showPage("vocab");$("vocabSearch").value=w.de;renderVocab();}}));
  allVerbs().filter(v=>(v.inf+v.ar).indexOf(q)>=0).slice(0,3).forEach(v=>hits.push({t:"⚡ "+v.inf+" — "+v.ar+" ["+v.kap+"]",go:()=>{showPage("verbs");$("verbSearch").value=v.inf;renderVerbs();}}));
  SENTENCES.filter(s=>(s.de+s.ar).toLowerCase().indexOf(q)>=0).slice(0,3).forEach(s=>hits.push({t:"💬 "+s.de+" ["+s.kap+"]",go:()=>{showPage("sentences");$("sentenceSearch").value=s.de;renderSentences();}}));
  GRAMMAR.filter(g=>(g.title+g.body).toLowerCase().indexOf(q)>=0).slice(0,3).forEach(g=>hits.push({t:"📐 "+g.title+" ["+g.kap+"]",go:()=>showPage("grammar")}));
  GRAMMAR.filter(g=>(g.title+g.body).toLowerCase().indexOf(q)>=0).slice(0,2).forEach(g=>hits.push({t:"📚 شرح: "+g.title+" ["+g.kap+"]",go:()=>openExplain(g.id)}));
  box.innerHTML="";
  if(!hits.length){box.innerHTML='<div class="search-hit">لا نتائج لـ "'+escapeHtml(q)+'"</div>';}
  hits.forEach(h=>{const d=document.createElement("div");d.className="search-hit";d.textContent=h.t;d.addEventListener("click",()=>{h.go();box.classList.remove("show");$("globalSearch").value="";const w=$("globalSearch").closest(".search-wrap");if(w){w.classList.remove("has-text");w.classList.remove("focus");}});box.appendChild(d);});
  box.classList.add("show");
});
document.addEventListener("click",e=>{if(!e.target.closest(".search-wrap"))$("searchResults").classList.remove("show");});

/* ============ ADD WORD ============ */
$("openAddWord").addEventListener("click",()=>$("wordModal").classList.remove("hidden"));
$("closeModal").addEventListener("click",()=>$("wordModal").classList.add("hidden"));
$("wordModal").addEventListener("click",e=>{if(e.target===$("wordModal"))$("wordModal").classList.add("hidden");});
$("addWordBtn").addEventListener("click",()=>{
  const de=$("nwDe").value.trim(),ar=$("nwAr").value.trim();
  if(!de||!ar){toast("أدخل الكلمة الألمانية والترجمة على الأقل ⚠️","err");return;}
  const w={id:"c"+Date.now(),de:de,art:$("nwArt").value,ar:ar,pron:$("nwPron").value||de,ex:$("nwEx").value||de+".",exAr:$("nwExAr").value||ar,cat:$("nwCat").value||"Food",type:$("nwType").value||"اسم",level:$("nwLevel").value||"A1"};
  w.kap="KX";S.customWords.push(w);save();
  $("wordModal").classList.add("hidden");
  ["nwDe","nwAr","nwPron","nwEx","nwExAr"].forEach(id=>$(id).value="");
  renderAll();markStudyDay();toast("تمت إضافة الكلمة ✅","ok");
});

/* ============ SETTINGS DATA ============ */
$("exportData").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="deutsch-master-backup.json";a.click();
  toast("تم التصدير 📤","ok");
});
$("importDataBtn").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);S=Object.assign(defaultState(),d);save();applyAll();toast("تم الاستيراد ✅","ok");}catch(err){toast("ملف غير صالح ❌","err");}};
  r.readAsText(f);
});
$("wipeData").addEventListener("click",()=>{
  if(!confirm("مسح كل البيانات نهائيًا؟"))return;
  S=defaultState();save();applyAll();toast("تم المسح 🗑️","ok");
});

/* ============ RENDER ALL ============ */
/* ============ مودال تفاصيل الكلمة ============ */
function openWordDetail(id){
  const w=wordById(id);if(!w)return;
  const st=getStatus(w.id);const fav=S.favs.includes(w.id);
  const artCls=w.art==="der"?"der":w.art==="die"?"die":w.art==="das"?"das":"none";
  const head=w.art!=="-"?'<span class="article '+artCls+'">'+w.art+'</span><span>'+escapeHtml(w.de)+'</span>':'<span>'+escapeHtml(w.de)+'</span>';
  const pl=(w.type==="اسم"&&w.plural)?'<div class="detail-pl"><span class="article '+artCls+' sm">'+w.art+'</span> '+escapeHtml(w.plural)+' <button class="icon-btn" id="dtSpeakPl" title="نطق الجمع">🔊</button></div>':'';
  $("detailBody").innerHTML=
    '<div class="detail-de">'+head+' <button class="icon-btn" id="dtSpeak">🔊</button></div>'+pl+
    '<div class="detail-ar">'+escapeHtml(w.ar)+'</div>'+
    '<div class="word-pron">النطق: '+escapeHtml(w.pron)+'</div>'+
    '<div class="word-ex"><div class="ex-de">'+escapeHtml(w.ex)+'</div><div>'+escapeHtml(w.exAr)+'</div></div>'+
    '<div class="word-meta"><span class="tag kap-tag">'+kapName(w.kap||"KX")+'</span><span class="tag">'+escapeHtml(w.cat)+'</span><span class="tag">'+escapeHtml(w.type)+'</span><span class="tag">مستوى '+(w.level||"A1")+'</span><span class="status-tag '+st+'">'+STATUS_AR[st]+'</span></div>'+
    '<div class="row-flex"><button class="btn btn-green sm" id="dtKnown">✅ أعرفها</button><button class="btn btn-gold sm" id="dtReview">🔁 تحتاج مراجعة</button><button class="btn btn-ghost sm" id="dtFav">'+(fav?"💔 إزالة من المفضلة":"❤️ مفضلة")+'</button><button class="btn btn-primary sm" id="dtQuiz">❓ اختبرني</button></div>';
  $("detailModal").classList.remove("hidden");
  $("dtSpeak").addEventListener("click",()=>speak(fullDe(w)));
  if($("dtSpeakPl"))$("dtSpeakPl").addEventListener("click",()=>speak(pluralFull(w)));
  $("dtKnown").addEventListener("click",()=>{setStatus(w.id,"known");markStudyDay();renderAll();openWordDetail(id);toast("أحسنت! ✅","ok");});
  $("dtReview").addEventListener("click",()=>{setStatus(w.id,"review");markStudyDay();renderAll();openWordDetail(id);toast("ستُراجع لاحقًا 🔁","ok");});
  $("dtFav").addEventListener("click",()=>{toggleFav(w.id);openWordDetail(id);});
  $("dtQuiz").addEventListener("click",()=>{$("detailModal").classList.add("hidden");quickArticleQuiz(w);});
}
$("closeDetail").addEventListener("click",()=>$("detailModal").classList.add("hidden"));
$("detailModal").addEventListener("click",e=>{if(e.target===$("detailModal"))$("detailModal").classList.add("hidden");});
function renderAll(){
  renderStreak();renderDashboard();renderVocab();renderReview();renderMistakes();renderSentences();renderVerbs();renderGrammar();renderExplainIndex();renderQuizHistory();renderStats();renderPlanner();renderFavs();
  observeReveals();
}
function applyAll(){
  applyTheme();syncSpeed(S.settings.speed||1);
  renderAll();buildFlash();
}

/* ============ INIT ============ */
fillCategories();fillKapitels();
applyTheme();
try{renderThemes();}catch(e){}
$("speedSelect").value=String(S.settings.speed||1);
$("speedSelect2").value=String(S.settings.speed||1);
if("speechSynthesis" in window){try{window.speechSynthesis.getVoices();window.speechSynthesis.onvoiceschanged=function(){};}catch(e){}}
renderAll();
buildFlash();
typingLoop();
observeReveals();
console.log("Deutsch Master ready ✅");
