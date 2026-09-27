/* Deutsch Master — 📚 المرجع الألماني الشامل (ADDITIVE ONLY).
   Independent reference section. Never touches existing grammar/vocab/quiz data.
   Reuses: showPage-wrap, escapeHtml, speakGerman, t(), glass/cards theme.
   Scope Phase 1: structure + 16 categories + navigation + search UI + responsive.
   Scope Phase 2: fills cat_pronouns + cat_articles with full tables (see REF_DATA). */
"use strict";

/* ---------- i18n (one Object.assign per lang; merged by tools/check-translations.js) ---------- */
try{
  Object.assign(I18N.ar,{reference:"المرجع الألماني الشامل",title_reference:"📚 المرجع الألماني الشامل",ref_search_ph:"ابحث: mit / Dativ / ضمائر / ماضي / gestern...",ref_categories:"التصنيفات",ref_back:"← كل التصنيفات",ref_examples:"أمثلة",ref_quiz:"📝 اختبر نفسك",ref_no_results:"لا توجد نتائج مطابقة — جرّب كلمة أخرى",ref_coming:"محتوى هذا القسم يصل في المرحلة القادمة — الهيكل جاهز الآن ✅",ref_topics:"المواضيع",ref_search_label:"🔍 بحث المرجع",ref_level:"المستوى",ref_show_answer:"عرض الإجابة",ref_correct:"صحيح ✅",ref_wrong:"خطأ ❌"});
  Object.assign(I18N.en,{reference:"Complete German Reference",title_reference:"📚 Complete German Reference",ref_search_ph:"Search: mit / Dativ / pronouns / past / gestern...",ref_categories:"Categories",ref_back:"← All categories",ref_examples:"Examples",ref_quiz:"📝 Test yourself",ref_no_results:"No matches — try another word",ref_coming:"This section's content arrives in the next stage — structure ready ✅",ref_topics:"Topics",ref_search_label:"🔍 Reference search",ref_level:"Level",ref_show_answer:"Show answer",ref_correct:"Correct ✅",ref_wrong:"Wrong ❌"});
  Object.assign(I18N.de,{reference:"Deutsche Komplettreferenz",title_reference:"📚 Deutsche Komplettreferenz",ref_search_ph:"Suchen: mit / Dativ / Pronomen / Vergangenheit / gestern...",ref_categories:"Kategorien",ref_back:"← Alle Kategorien",ref_examples:"Beispiele",ref_quiz:"📝 Teste dich",ref_no_results:"Keine Treffer — versuch ein anderes Wort",ref_coming:"Inhalt folgt in der nächsten Stufe — Struktur bereit ✅",ref_topics:"Themen",ref_search_label:"🔍 Referenzsuche",ref_level:"Niveau",ref_show_answer:"Antwort zeigen",ref_correct:"Richtig ✅",ref_wrong:"Falsch ❌"});
}catch(e){}

/* ---------- 16 categories (titles trilingual inline = educational data, not UI chrome) ---------- */
const REF_CATS=[
 {id:"pronouns",icon:"👤",ar:"الضمائر",de:"Pronomen",en:"Pronouns"},
 {id:"articles",icon:"🧩",ar:"الأدوات",de:"Artikel",en:"Articles"},
 {id:"connect",icon:"🔗",ar:"حروف العطف والربط",de:"Konjunktionen & Konnektoren",en:"Conjunctions"},
 {id:"questions",icon:"❓",ar:"أدوات السؤال",de:"Fragewörter",en:"Question words"},
 {id:"preps",icon:"📍",ar:"حروف الجر",de:"Präpositionen",en:"Prepositions"},
 {id:"time",icon:"⏰",ar:"الزمن والماضي",de:"Zeit & Vergangenheit",en:"Time & past"},
 {id:"verbs",icon:"🕐",ar:"الأفعال والأزمنة",de:"Verben & Zeiten",en:"Verbs & tenses"},
 {id:"cases",icon:"📊",ar:"الحالات الإعرابية",de:"Kasus",en:"Cases"},
 {id:"sentence",icon:"📝",ar:"بناء الجملة",de:"Satzbau",en:"Sentence structure"},
 {id:"punct",icon:"📌",ar:"علامات الترقيم",de:"Zeichensetzung",en:"Punctuation"},
 {id:"numbers",icon:"🔢",ar:"الأرقام والوقت",de:"Zahlen & Uhrzeit",en:"Numbers & time"},
 {id:"place",icon:"🗺️",ar:"المكان والاتجاهات",de:"Ort & Richtung",en:"Place & directions"},
 {id:"quantity",icon:"⚖️",ar:"الكمية والمقدار",de:"Menge",en:"Quantity"},
 {id:"daily",icon:"🗣️",ar:"التعبيرات اليومية",de:"Alltagssprache",en:"Daily phrases"},
 {id:"compare",icon:"⚡",ar:"المقارنات السريعة",de:"Schnellvergleiche",en:"Quick comparisons"},
 {id:"mistakes",icon:"⚠️",ar:"أخطاء شائعة",de:"Häufige Fehler",en:"Common mistakes"}
];
/* Topic titles per category (detail content arrives per-stage; Phase 2 fills pronouns+articles) */
const REF_TOPICS={
 pronouns:["Personalpronomen","Possessivpronomen","Demonstrativpronomen","Interrogativpronomen","Relativpronomen","Indefinitpronomen","Reflexivpronomen"],
 articles:["Bestimmte Artikel","Unbestimmte Artikel","Negation (kein/nicht)","Possessivartikel","Demonstrativartikel"],
 connect:["Konjunktionen","Konnektoren","Ereignisfolge"],
 questions:["W-Fragen","Ja/Nein-Fragen","Fragetypen"],
 preps:["Akkusativ","Dativ","Genitiv","Wechselpräpositionen","Zeit","Ort","Verkehrsmittel","Verben mit Präpositionen"],
 time:["Zeitwörter","Vergangenheit","Perfekt","Präteritum","Partizip II","haben/sein"],
 verbs:["sein","haben","werden","Modalverben","Trennbare Verben","Untrennbare Verben","Reflexive Verben","Imperativ","Futur I"],
 cases:["Nominativ","Akkusativ","Dativ","Genitiv"],
 sentence:["Hauptsatz","Fragesatz","Satzstellung","Modalverb-Satz","Perfekt-Satz","Zeit & Ort"],
 punct:["Punkt","Komma","Fragezeichen","Ausrufezeichen","Doppelpunkt","Semikolon","Anführungszeichen","Bindestrich","Klammern"],
 numbers:["Zahlen","Ordinalzahlen","Uhrzeit","Wochentage","Monate","Jahreszeiten","Datum","Tageszeiten","Dauer","Häufigkeit"],
 place:["Orte","Richtungen","Positionen","Wohin/Wo","Wegbeschreibung"],
 quantity:["viel/viele","wenig/wenige","mehr/weniger","genug","einige","mehrere","alle","jeder","kein"],
 daily:["Begrüßung","Vorstellung","Dank","Entschuldigung","Bitte","Zustimmung","Ablehnung","Nichtverstehen"],
 compare:["kein/nicht","der/die/das","wer/wen/wem","wo/wohin/woher","seit/vor/für","in/an/auf","haben/sein","Perfekt/Präteritum"],
 mistakes:["nicht vs kein","wo vs wohin","seit vs vor","zu vs nach","kennen vs wissen"]
};
/* Full detail data filled per stage. Keys: <catId>_<topicIndex> (see REF_TOPICS). */
var REF_DATA={
"pronouns_0":{level:"🟢 A1",use:"الضمائر الشخصية تحل محل الاسم: من يقوم بالفعل (Nominativ) ومن يقع عليه الفعل (Akkusativ/Dativ).",
 tables:[{cap:"Personalpronomen — Nominativ / Akkusativ / Dativ",head:["","ich","du","er","sie","es","wir","ihr","sie","Sie"],
  rows:[["Nominativ (wer?)","ich","du","er","sie","es","wir","ihr","sie","Sie"],
  ["Akkusativ (wen?)","mich","dich","ihn","sie","es","uns","euch","sie","Sie"],
  ["Dativ (wem?)","mir","dir","ihm","ihr","ihm","uns","euch","ihnen","Ihnen"]]}],
 examples:[["Ich sehe dich.","أنا أراك."],["Er hilft mir.","هو يساعدني."],["Wir sprechen mit Ihnen.","نحن نتحدث مع حضرتك."],["Sie wohnt in Berlin.","هي تسكن في برلين."]],
 quiz:[{q:"أكمل: ___ helfe dir. (أنا)",opts:["Ich","Mich","Mir"],correct:0,why:"الفاعل في Nominativ هو ich."},{q:"أكمل: Ich sehe ___. (هو)",opts:["er","ihn","ihm"],correct:1,why:"sehen يأخذ Akkusativ: wen? → ihn."},{q:"أكمل: Er spricht mit ___. (أنا)",opts:["mich","mir","ich"],correct:1,why:"mit تأخذ Dativ دائمًا: mit mir."}]},
"pronouns_1":{level:"🟡 A2",use:"ضمير الملكية المستقل يقف وحده بدون اسم بعده (Das Buch ist meines = الكتاب ملكي). أما mein/meine + اسم فهو Possessivartikel (مستوى A1 — انظر قسم الأدوات).",
 tables:[{cap:"Possessivpronomen selbstständig — Nominativ (Stamm mein-)",head:["maskulin","feminin","neutral","Plural"],
  rows:[["meiner","meine","meines","meine"],["deiner","deine","deines","deine"],["seiner","seine","seines","seine"]]}],
 examples:[["Das Buch ist meines.","هذا الكتاب ملكي."],["Die Tasche ist deine.","الحقيبة حقيبتك."],["Ist das dein Auto? — Ja, es ist meines.","هل هذه سيارتك؟ — نعم، إنها ملكي."]],
 quiz:[{q:"أكمل: Das Fahrrad ist ___. (ملكي)",opts:["mein","meines","meiner"],correct:1,why:"neutral مستقل في Nominativ: meines."},{q:"أي جملة فيها Possessivpronomen مستقل؟",opts:["Mein Vater arbeitet.","Das Auto ist meines.","Ich sehe mein Buch."],correct:1,why:"meines وحده بدون اسم بعده = ضمير مستقل."}]},
"pronouns_2":{level:"🟢 A1",use:"ضمائر الإشارة تشير لشيء محدد قريب أو بعيد: dieser (هذا) — der/die/das كإشارة — das (هذا/ذلك).",
 tables:[{cap:"dieser-Wörter — Nominativ",head:["maskulin","feminin","neutral","Plural"],rows:[["dieser","diese","dieses","diese"]]},
  {cap:"dieser-Wörter — Akkusativ",head:["maskulin","feminin","neutral","Plural"],rows:[["diesen","diese","dieses","diese"]]}],
 examples:[["Dieser Mann ist nett.","هذا الرجل لطيف."],["Ich kenne diese Frau.","أنا أعرف هذه المرأة."],["Dieses Haus ist groß.","هذا البيت كبير."],["Das ist mein Lehrer.","هذا معلمي."]],
 quiz:[{q:"أكمل: ___ Frau ist nett. (هذه)",opts:["Dieser","Diese","Dieses"],correct:1,why:"Frau مؤنثة: diese Frau."},{q:"أكمل: Ich nehme ___ Kuchen. (هذا — Kuchen مذكر)",opts:["dieser","diesen","dieses"],correct:1,why:"Akkusativ مذكر: diesen Kuchen."}]},
"pronouns_3":{level:"🟢 A1",use:"ضمائر الاستفهام تسأل عن الأشخاص والأشياء: wer (من) — was (ماذا). لا تخلط بينها وبين Fragewörter العامة مثل wo/wann (انظر قسم أدوات السؤال).",
 tables:[{cap:"Interrogativpronomen — wer / was",head:["Nominativ (wer?)","Akkusativ (wen?)","Dativ (wem?)"],
  rows:[["wer","wen","wem"],["was","was","—"]]}],
 examples:[["Wer ist das?","من هذا؟"],["Wen siehst du?","من ترى؟"],["Mit wem sprichst du?","مع من تتحدث؟"],["Was ist das?","ما هذا؟"],["Welcher Bus fährt ins Zentrum?","أي أتوبيس يذهب إلى المركز؟"]],
 quiz:[{q:"___ kommt heute? (من)",opts:["Wer","Wen","Wem"],correct:0,why:"السؤال عن الفاعل: wer."},{q:"___ siehst du? (من — مفعول)",opts:["Wer","Wen","Wem"],correct:1,why:"sehen + Akkusativ: wen?"}]},
"pronouns_4":{level:"🟡 A2",use:"الضمير النسبي يربط جملتين ويصف الاسم: Der Mann, der hier wohnt (= الرجل الذي يسكن هنا). يطابق جنس الاسم وعدده، وحالته حسب دوره في الجملة النسبية.",
 tables:[{cap:"Relativpronomen — der/die/das",head:["","maskulin","feminin","neutral","Plural"],
  rows:[["Nominativ","der","die","das","die"],["Akkusativ","den","die","das","die"],["Dativ","dem","der","dem","denen"]]}],
 examples:[["Der Mann, der hier wohnt, ist mein Lehrer.","الرجل الذي يسكن هنا هو معلمي."],["Das Buch, das ich lese, ist interessant.","الكتاب الذي أقرؤه شيّق."]],
 quiz:[{q:"Der Film, ___ ich sehe, ist gut.",opts:["der","den","dem"],correct:1,why:"Film مذكر ومفعول (أشاهده): Akkusativ → den."}]},
"pronouns_5":{level:"🟢 A1 + 🟡 A2",use:"الضمائر غير المحددة تتحدث عن شخص/شيء غير معيّن: man (المرء/الناس عمومًا) — etwas/nichts — jemand/niemand — jeder/alle.",
 tables:[{cap:"Indefinitpronomen — الاستخدام",head:["الضمير","العربي","الاستخدام","مثال"],
  rows:[["man","المرء / الناس","فاعل عام (الفعل مفرد دائمًا)","Man spricht hier Deutsch."],["etwas / nichts","شيء / لا شيء","للأشياء غير المحددة","Ich habe etwas gekauft."],["jemand / niemand","شخص ما / لا أحد","للأشخاص غير المحددين","Niemand ist hier."],["jeder / alle","كل واحد / الجميع","jeder + مفرد، alle + جمع","Jeder muss lernen."]]}],
 examples:[["Man spricht hier Deutsch.","الناس هنا يتحدثون الألمانية."],["Ich habe etwas gekauft.","اشتريت شيئًا ما."],["Jeder muss jeden Tag lernen.","على كل شخص أن يتعلم كل يوم."]],
 quiz:[{q:"___ ist hier. (لا أحد)",opts:["Jemand","Niemand","Man"],correct:1,why:"لا أحد = niemand."},{q:"___ spricht hier Deutsch. (الناس عمومًا)",opts:["Man","Etwas","Jeder"],correct:0,why:"الفاعل العام = man + فعل مفرد."}]},
"pronouns_6":{level:"🟢 A1",use:"الضمير الانعكاسي يعود على الفاعل نفسه مع أفعال مثل sich waschen / sich setzen / sich treffen: الفاعل والمفعول نفس الشخص.",
 tables:[{cap:"Reflexivpronomen — Akkusativ",head:["ich","du","er/sie/es","wir","ihr","sie/Sie"],
  rows:[["mich","dich","sich","uns","euch","sich"]]},
  {cap:"Reflexivpronomen — Dativ",head:["ich","du","er/sie/es","wir","ihr","sie/Sie"],
  rows:[["mir","dir","sich","uns","euch","sich"]]}],
 examples:[["Ich wasche mich.","أنا أغسل (نفسي)."],["Du setzt dich hier.","أنت تجلس هنا."],["Wir treffen uns morgen.","سنلتقي غدًا."]],
 quiz:[{q:"Ich wasche ___.",opts:["mich","dich","sich"],correct:0,why:"الفاعل ich → mich."},{q:"Wir treffen ___ morgen.",opts:["uns","euch","sich"],correct:0,why:"الفاعل wir → uns."}]},
"articles_0":{level:"🟢 A1",use:"أداة التعريف للشيء المعروف: der (مذكر) — die (مؤنث) — das (محايد) — die (جمع). تتغير حسب الحالة الإعرابية.",
 tables:[{cap:"Bestimmte Artikel — الحالات الأربع",head:["","maskulin","feminin","neutral","Plural"],
  rows:[["Nominativ","der","die","das","die"],["Akkusativ","den","die","das","die"],["Dativ","dem","der","dem","den"],["Genitiv 🔵 B1","des","der","des","der"]]}],
 examples:[["Der Mann kauft das Brot.","الرجل يشتري الخبز."],["Ich sehe den Hund.","أنا أرى الكلب."],["Sie hilft dem Kind.","هي تساعد الطفل."],["Die Kinder spielen im Garten.","الأطفال يلعبون في الحديقة."]],
 quiz:[{q:"___ Mann ist nett. (مذكر، فاعل)",opts:["Der","Den","Dem"],correct:0,why:"Nominativ مذكر = der."},{q:"Ich sehe ___ Hund. (مفعول)",opts:["der","den","dem"],correct:1,why:"Akkusativ مذكر = den."},{q:"Sie hilft ___ Kind. (محايد + helfen)",opts:["das","dem","den"],correct:1,why:"helfen + Dativ: dem Kind."}]},
"articles_1":{level:"🟢 A1",use:"أداة النكرة لشيء غير محدد: ein (مذكر/محايد) — eine (مؤنث). لا توجد صيغة جمع للنكرة (نستخدم الجمع بدون أداة أو some: Bücher).",
 tables:[{cap:"Unbestimmte Artikel",head:["","maskulin","feminin","neutral"],
  rows:[["Nominativ","ein","eine","ein"],["Akkusativ","einen","eine","ein"],["Dativ","einem","einer","einem"]]}],
 examples:[["Ein Mann wartet hier.","رجل ما ينتظر هنا."],["Ich habe eine Frage.","لديّ سؤال."],["Er hilft einem Freund.","هو يساعد صديقًا."],["Ich lese Bücher.","أنا أقرأ كتبًا. (جمع النكرة بدون أداة)"]],
 quiz:[{q:"Ich habe ___ Frage.",opts:["ein","eine","einen"],correct:1,why:"Frage مؤنثة: eine (تبقى eine في Akkusativ)."},{q:"Das ist ___ Buch. (محايد، فاعل)",opts:["ein","eine","einen"],correct:0,why:"Nominativ محايد = ein."}]},
"articles_2":{level:"🟢 A1",use:"kein تنفي اسمًا له أداة (kein + اسم)، وnicht تنفي الفعل أو الصفة أو الجملة كلها. أشهر خطأ في A1 هو الخلط بينهما.",
 tables:[{cap:"kein vs nicht",head:["","kein 🧩","nicht 🔗"],
  rows:[["ينفي","اسمًا (بدل أداته)","فعلًا / صفة / جملة"],["مثال 1","Ich habe kein Auto. (ليس لدي سيارة)","Ich lerne heute nicht. (لن أتعلم اليوم)"],["مثال 2","Sie hat keine Zeit. (ليس لديها وقت)","Das ist nicht gut. (هذا ليس جيدًا)"],["تصريف kein","مثل ein: kein/keine/keinen…","— لا يُصرَّف"]]}],
 examples:[["Ich habe kein Buch.","ليس لديّ كتاب."],["Sie hat keine Freunde in Berlin.","ليس لديها أصدقاء في برلين."],["Ich komme heute nicht.","لن آتي اليوم."],["Das Wetter ist nicht schön.","الطقس ليس جميلًا."]],
 quiz:[{q:"Ich habe ___ Auto.",opts:["nicht","kein","keine"],correct:1,why:"نفي اسم مذكر محايد بعد haben: kein Auto."},{q:"Ich lerne heute ___.",opts:["kein","nicht","keine"],correct:1,why:"نفي الفعل/الجملة = nicht."},{q:"Sie hat ___ Zeit.",opts:["kein","keine","nicht"],correct:1,why:"Zeit مؤنثة: keine Zeit."}]},
"articles_3":{level:"🟢 A1",use:"أداة الملكية = ضمير الملكية + نهاية الإعراب: mein/dein/sein/ihr/sein/unser/euer/ihr/Ihr + نفس نهايات ein تمامًا.",
 tables:[{cap:"Possessivartikel — الأساس",head:["ich","du","er","sie","es","wir","ihr","sie","Sie"],
  rows:[["mein-","dein-","sein-","ihr-","sein-","unser-","euer-","ihr-","Ihr-"]]},
  {cap:"النهايات (مثل ein تمامًا)",head:["","maskulin","feminin","neutral","Plural"],
  rows:[["Nominativ","mein","meine","mein","meine"],["Akkusativ","meinen","meine","mein","meine"],["Dativ","meinem","meiner","meinem","meinen"]]}],
 examples:[["Mein Vater arbeitet viel.","والدي يعمل كثيرًا."],["Ich liebe meine Mutter.","أنا أحب والدتي."],["Wir fahren mit unserem Auto.","نحن نذهب بسيارتنا."]],
 quiz:[{q:"___ Vater arbeitet. (والدي)",opts:["Mein","Meine","Meinen"],correct:0,why:"Nominativ مذكر: mein Vater."},{q:"Ich liebe ___ Mutter. (والدتي — مفعول)",opts:["mein","meine","meiner"],correct:1,why:"Akkusativ مؤنث: meine Mutter."}]},
"articles_4":{level:"🟢 A1",use:"أداة الإشارة المحددة: dieser/diese/dieses + اسم (هذا المحدد القريب). تُصرَّف مثل der/die/das مع إضافة -es/-er في النهايات.",
 tables:[{cap:"Demonstrativartikel — Nominativ / Akkusativ",head:["","maskulin","feminin","neutral","Plural"],
  rows:[["Nominativ","dieser","diese","dieses","diese"],["Akkusativ","diesen","diese","dieses","diese"],["Dativ 🟡 A2","diesem","dieser","diesem","diesen"]]}],
 examples:[["Dieses Haus ist groß.","هذا البيت كبير."],["Ich nehme diesen Kuchen.","سآخذ هذه الكعكة."],["Diese Kinder sind nett.","هؤلاء الأطفال لطفاء."]],
 quiz:[{q:"___ Haus ist groß. (محايد)",opts:["Dieser","Diese","Dieses"],correct:2,why:"Haus محايد: dieses Haus."},{q:"Ich nehme ___ Kuchen. (مذكر، مفعول)",opts:["dieser","diesen","dieses"],correct:1,why:"Akkusativ مذكر: diesen."}]}
};

function refT(k){try{if(typeof t==="function"){const v=t(k);if(v&&v!==k)return v;}}catch(e){}const f={ref_search_ph:"ابحث: mit / Dativ / ضمائر / ماضي / gestern...",ref_categories:"التصنيفات",ref_back:"← كل التصنيفات",ref_examples:"أمثلة",ref_quiz:"📝 اختبر نفسك",ref_no_results:"لا توجد نتائج مطابقة — جرّب كلمة أخرى",ref_coming:"محتوى هذا القسم يصل في المرحلة القادمة — الهيكل جاهز الآن ✅",ref_topics:"المواضيع",ref_search_label:"🔍 بحث المرجع"};return f[k]||k;}
function refEsc(s){try{if(typeof escapeHtml==="function")return escapeHtml(s);}catch(e){}return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function refSpeakBtn(de){return ' <button class="mini-btn ref-say" data-spk="'+refEsc(de)+'" title="🔊">🔊</button>';}
function refNorm(s){let x=String(s==null?"":s).toLowerCase();x=x.replace(/ß/g,"ss").replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u");return x.trim();}

function refCatTitle(c){try{const L=(typeof S!=="undefined"&&S.uiLang)||"ar";if(L==="de")return c.de;if(L==="en")return c.en;}catch(e){}return c.ar;}

function renderReference(){
  const box=document.getElementById("refBox");if(!box)return;
  let h='<div class="panel glass ref-search-panel"><label class="ref-search-label">'+refEsc(refT("ref_search_label"))+'</label>';
  h+='<input type="text" id="refSearch" class="full-input" data-i18n-ph="ref_search_ph" placeholder="'+refEsc(refT("ref_search_ph"))+'">';
  h+='<div id="refResults" class="ref-results"></div></div>';
  h+='<h3 class="ref-sec-title">'+refEsc(refT("ref_categories"))+' (16)</h3><div class="ref-grid">';
  REF_CATS.forEach(c=>{
    const n=(REF_TOPICS[c.id]||[]).length;
    const ready=Object.keys(REF_DATA).some(k=>k.indexOf(c.id+"_")===0||k.indexOf(c.id)===0);
    h+='<button class="ref-card glass" data-cat="'+c.id+'"><span class="ref-ico">'+c.icon+'</span><span class="ref-name">'+refEsc(refCatTitle(c))+'</span><span class="ref-de">'+refEsc(c.de)+'</span><span class="ref-count">'+n+' • '+(ready?"✅":"🕐")+'</span></button>';
  });
  h+='</div><div id="refDetail"></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-cat]").forEach(b=>b.addEventListener("click",()=>openRefCat(b.getAttribute("data-cat"))));
  const si=document.getElementById("refSearch");
  let tm=null;
  si.addEventListener("input",()=>{try{clearTimeout(tm);}catch(e){}tm=setTimeout(runRefSearch,120);});
  try{if(typeof applyLang==="function")applyLang();}catch(e){}
}

function openRefCat(id){
  const box=document.getElementById("refBox");if(!box)return;
  const c=REF_CATS.find(x=>x.id===id);if(!c)return;
  let det=document.getElementById("refDetail");
  const topics=REF_TOPICS[id]||[];
  let h='<div class="panel glass ref-detail-head"><button class="btn btn-ghost sm" id="refBackBtn">'+refEsc(refT("ref_back"))+'</button>';
  h+='<h3>'+c.icon+' '+refEsc(refCatTitle(c))+' <span class="muted">'+refEsc(c.de)+'</span></h3></div>';
  h+='<div class="ref-topic-list">';
  topics.forEach((tp,i)=>{
    const key=id+"_"+i;
    const d=REF_DATA[key];
    h+='<details class="ref-topic glass"'+(d?"":"")+'>';
    h+='<summary>'+refEsc(tp)+'</summary>';
    h+='<div class="ref-topic-body" data-topic-body="'+refEsc(key)+'" data-topic-name="'+refEsc(tp)+'">';
    if(d){h+=renderRefTopic(d);}else{h+='<div class="muted">'+refEsc(refT("ref_coming"))+'</div>';}
    h+='</div></details>';
  });
  h+='</div>';
  det.innerHTML=h;
  document.getElementById("refBackBtn").addEventListener("click",()=>{det.innerHTML="";try{window.scrollTo({top:0,behavior:"smooth"});}catch(e){}});
  wireRefTopics(det);
  det.scrollIntoView({behavior:"smooth",block:"start"});
}

function renderRefTopic(d){
  let h="";
  if(d.level)h+='<div><span class="ref-lvl">'+refEsc(d.level)+'</span> <span class="muted">'+refEsc(d.use||"")+'</span></div>';
  else if(d.use)h+='<div class="muted">'+refEsc(d.use)+'</div>';
  (d.tables||[]).forEach(tb=>{
    h+='<div class="ref-tbl-title">📊 '+refEsc(tb.cap)+'</div><div class="ref-tbl-wrap"><table class="ref-tbl"><tr>'+tb.head.map(x=>'<th>'+refEsc(x)+'</th>').join("")+'</tr>';
    tb.rows.forEach(r=>{h+='<tr>'+r.map(cell=>'<td>'+refEsc(cell)+'</td>').join("")+'</tr>';});
    h+='</table></div>';
  });
  if(d.examples&&d.examples.length){
    h+='<div class="ref-tbl-title">'+refEsc(refT("ref_examples"))+'</div>';
    d.examples.forEach(e=>{
      h+='<div class="ref-ex"><div class="ref-ex-de" dir="ltr">'+refEsc(e[0])+refSpeakBtn(e[0])+'</div><div class="ref-ex-ar">'+refEsc(e[1])+'</div></div>';
    });
  }
  if(d.quiz&&d.quiz.length){
    h+='<details class="ref-quiz"><summary>'+refEsc(refT("ref_quiz"))+' ('+d.quiz.length+')</summary><div class="ref-quiz-body">';
    d.quiz.forEach((q,qi)=>{
      h+='<div class="ref-q" data-q="'+qi+'"><b>'+refEsc(q.q)+'</b><div class="quiz-opts">'+q.opts.map((o,oi)=>'<button class="quiz-opt" data-qi="'+qi+'" data-oi="'+oi+'">'+refEsc(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden"></div></div>';
    });
    h+='</div></details>';
  }
  return h;
}

function wireRefTopics(root){
  root.querySelectorAll("[data-spk]").forEach(b=>b.addEventListener("click",ev=>{ev.stopPropagation();ev.preventDefault();try{if(typeof speakGerman==="function")speakGerman(b.getAttribute("data-spk"));}catch(e){}}));
  root.querySelectorAll(".ref-quiz-body").forEach(qb=>{
    const topicKey=qb.closest("[data-topic-body]")?qb.closest("[data-topic-body]").getAttribute("data-topic-body"):null;
    const d=topicKey?REF_DATA[topicKey]:null;
    qb.querySelectorAll(".quiz-opt").forEach(btn=>btn.addEventListener("click",()=>{
      const qi=parseInt(btn.getAttribute("data-qi"),10);
      const oi=parseInt(btn.getAttribute("data-oi"),10);
      const q=d&&d.quiz?d.quiz[qi]:null;if(!q)return;
      const wrap=btn.closest(".ref-q");
      wrap.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      const fb=wrap.querySelector(".quiz-feedback");fb.classList.remove("hidden");
      if(oi===q.correct){btn.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent=refT("ref_correct")+" "+(q.why||"");}
      else{btn.classList.add("wrong");wrap.querySelectorAll(".quiz-opt")[q.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent=refT("ref_wrong")+" ✅ "+q.opts[q.correct]+" — "+(q.why||"");}
      try{if(typeof markStudyDay==="function")markStudyDay(false);}catch(e){}
    }));
  });
}

function runRefSearch(){
  const inp=document.getElementById("refSearch"),out=document.getElementById("refResults");
  if(!inp||!out)return;
  const q=refNorm(inp.value);
  if(!q||q.length<2){out.innerHTML="";out.classList.remove("show");return;}
  const hits=[];
  REF_CATS.forEach(c=>{
    const hay=refNorm(c.ar+" "+c.de+" "+c.en);
    if(hay.indexOf(q)>=0)hits.push({score:3,html:"cat",cat:c,text:c.icon+" "+refCatTitle(c)+" — "+c.de});
  });
  Object.keys(REF_TOPICS).forEach(cid=>{
    (REF_TOPICS[cid]||[]).forEach((tp,i)=>{
      const key=cid+"_"+i,d=REF_DATA[key];
      let hay=refNorm(tp);
      if(d){hay+=" "+refNorm([d.use||"",JSON.stringify(d.tables||[]),JSON.stringify(d.examples||[])].join(" "));}
      if(hay.indexOf(q)>=0){
        const c=REF_CATS.find(x=>x.id===cid);
        hits.push({score:d?5:2,html:"topic",cat:c,topic:tp,key:key,text:"📄 "+tp+" <span class='muted'>("+(c?refCatTitle(c):cid)+")</span>"});
      }
    });
  });
  hits.sort((a,b)=>b.score-a.score);
  const top=hits.slice(0,12);
  if(!top.length){out.innerHTML='<div class="search-hit">'+refEsc(refT("ref_no_results"))+'</div>';out.classList.add("show");return;}
  out.innerHTML=top.map((h,i)=>'<div class="search-hit" data-h="'+i+'">'+h.text+'</div>').join("");
  out.classList.add("show");
  out.querySelectorAll("[data-h]").forEach(el=>el.addEventListener("click",()=>{
    const h=top[parseInt(el.getAttribute("data-h"),10)];
    if(!h)return;
    openRefCat(h.cat.id);
    out.classList.remove("show");
    if(h.html==="topic"){
      setTimeout(()=>{
        const det=document.getElementById("refDetail");if(!det)return;
        const bodies=det.querySelectorAll("[data-topic-name]");
        bodies.forEach(b=>{
          if(b.getAttribute("data-topic-name")===h.topic){
            const d=b.closest("details");if(d)d.open=true;
            b.scrollIntoView({behavior:"smooth",block:"center"});
          }
        });
      },80);
    }
  }));
}

/* ---------- showPage wrap + lazy registration (same pattern as labsx/learn/play) ---------- */
(function(){
  try{if(typeof DM_LAZY!=="undefined"&&DM_LAZY)DM_LAZY.reference=renderReference;}catch(e){}
  try{
    if(typeof showPage==="function"){
      const _sp=showPage;
      const REF_PAGES={reference:renderReference};
      showPage=function(n){_sp(n);try{if(REF_PAGES[n])REF_PAGES[n]();}catch(e){if(window.console)console.error(e);}};
    }
  }catch(e){}
})();
