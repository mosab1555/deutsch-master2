/* Deutsch Master - Study systems: storage adapter, i18n (AR/EN chrome),
   notifications, SRS review, dashboard upgrade, tutor, plan, roadmap,
   labs, interactive stories, grammar lab, profile, analytics.
   Additive only. No backend: TutorAPI has remote hook disabled by default. */
"use strict";
function ensureStudy(){
  if(!S.tutor)S.tutor={hist:[]};
  if(!S.plan2)S.plan2={goalType:"words",goalN:15};
  if(!S.uiLang)S.uiLang="ar";
  if(!S.srs)S.srs={};
  if(!S.notifRead)S.notifRead=0;
}
/* ---------- storage adapter (local backend, swappable) ---------- */
const Store={
  backend:"local",
  remote:null, /* set Store.remote={push(),pull()} later for real backend */
  save(){try{save();if(this.remote&&this.remote.push)this.remote.push(S).catch(()=>{});}catch(e){}},
  load(){return S;}
};
/* ---------- i18n: interface chrome AR/EN/DE (learning content stays German/Arabic) ---------- */
const I18N={
ar:{dashboard:"الرئيسية",vocab:"الكلمات",flashcards:"Flashcards",sentences:"الجمل",sentex:"تدريبات الجمل",verbs:"الأفعال",grammar:"القواعد",explain:"الشرح",quiz:"الاختبارات",journey:"الرحلة",listen:"استماع",speak:"تحدث",talk:"محادثة",real:"مواقف",job:"الشغل",ach:"إنجازاتي",games:"الألعاب",world:"العالم",life:"Deutsch Life",exp:"تجارب ألمانية",mygermany:"My Germany",dlife:"مواقف تدريبية",stories:"قصص",survive:"البقاء",challenge:"التحدي",me:"شخصيتي",practice:"تدريب ذكي",tutor:"المدرّب",roadmap:"الخريطة",labs:"المختبر",profile:"حسابي",analytics:"تقدمي",review:"المراجعة",mistakes:"أخطائي",stats:"الإحصائيات",planner:"خطة المذاكرة",favorites:"المفضلة",settings:"الإعدادات",side_level:"المستوى الحالي:",hero_tag:"🇩🇪 مستوى A1 • German Learning + Technology",hero_welcome:"مرحبًا بك في",hero_words:"ابدأ الكلمات 📚",hero_quiz:"اختبر نفسك 📝",hero_review:"مراجعة اليوم 🧠",hero_progress:"نسبة التقدم",dash_words:"📚 الكلمات",dash_quiz:"📝 ابدأ اختبار",dash_review:"🧠 ابدأ المذاكرة",plan_today:"🎯 خطة اليوم",plan_open:"فتح الخطة",quick_head:"⚡ إجراءات سريعة",quick_flash:"🃏 فلاش كارد",quick_sent:"💬 جمل A1",quick_verbs:"⚡ تصريف الأفعال",quick_listen:"🎧 اختبار استماع",quick_rule:"📐 قاعدة اليوم",quick_mist:"❌ أخطائي",stat_saved:"كلمات محفوظة",stat_due:"تحتاج مراجعة",stat_days:"أيام المذاكرة",stat_tests:"اختبارات محلولة",stat_correct:"إجابات صحيحة",stat_streak:"Streak أيام متتالية",title_vocab:"📚 الكلمات الألمانية",add_word:"+ إضافة كلمة",f_allcats:"كل التصنيفات",f_alltypes:"كل الأنواع",t_noun:"اسم",t_verb:"فعل",t_adj:"صفة",t_pron:"ضمير",t_part:"أداة",t_vocabw:"مفردات",f_allstatus:"كل الحالات",s_new:"🆕 جديدة",s_review:"🔁 مراجعة",s_hard:"🔴 صعبة",s_known:"✅ محفوظة",s_later:"⏳ لاحقًا",f_allart:"der/die/das الكل",f_noart:"بدون أداة",f_allkap:"كل الكبيتلات",f_alllevels:"كل المستويات",title_flash:"🃏 Flashcards",flash_shuffle:"🔀 خلط",flash_hint:"اضغط للقلب 🔄",flash_prev:"⏮ السابق",rate_easy:"😊 سهل",rate_mid:"😐 متوسط",rate_hard:"😟 صعب",title_sent:"💬 الجمل الألمانية",title_sentex:"✏️ تدريبات الجمل",title_verbs:"⚡ الأفعال الألمانية",title_grammar:"📐 القواعد (مقسمة لكل Kapitel)",title_explain:"📚 الشرح",title_listen:"🎧 الاستماع",title_speak:"🎤 التحدث",title_talk:"💬 المحادثة",title_real:"🌍 مواقف حقيقية",title_job:"💼 ألماني الشغل",title_ach:"🏆 إنجازاتي",title_games:"🎮 الألعاب",title_world:"🗺️ العالم",title_exp:"🇩🇪 German Experiences",title_mygermany:"🌍 My Germany",title_dlife:"🎭 Deutsch Life — تدريب المواقف",title_stories:"📖 قصص",title_survive:"🇩🇪 البقاء في ألمانيا",title_challenge:"⚡ التحدي",title_me:"🙂 شخصيتي وتقريري",title_practice:"🎯 تدريب ذكي",title_tutor:"🤖 المدرّب",title_roadmap:"🗺️ الخريطة",title_labs:"🧪 المختبر",title_profile:"👤 حسابي",title_analytics:"📈 تقدمي",title_quiz:"📝 الاختبارات",quiz_choose:"اختر نوع الاختبار",qt_mixed:"🎲 شامل (Recommended)",qt_article:"🎯 الأدوات",qt_dear:"📖 الكلمة → المعنى",qt_arde:"🔄 عربي → ألماني",qt_plural:"👥 الجمع",qt_write:"✍️ كتابة الأداة",qt_listen:"🎧 استماع",qt_listenart:"🎧+🎯 استماع وأداة",qt_sentence:"🧩 إكمال الجملة",qt_order:"🔀 ترتيب الجملة",qt_quick:"⚡ اختبار سريع ⏱️",quiz_count:"عدد الأسئلة:",quiz_start:"ابدأ الاختبار 🚀",quiz_check:"تحقق ✅",quiz_next:"التالي ⏭",quiz_quit:"إنهاء ✖",quiz_history:"📜 سجل الاختبارات",rev_head:"🧠 المراجعة الذكية",rev_start:"ابدأ جلسة مراجعة 🚀",rev_due:"📌 كلمات تحتاج مراجعة اليوم",mist_head:"❌ مراجعة أخطائي",mist_test:"🎯 اختبر أخطائي فقط",mist_clear:"🗑️ مسح الأخطاء",stats_head:"📊 الإحصائيات",stats_reset:"تصفير الإحصائيات",stats_dist:"توزيع حالات الكلمات",stats_acc:"نسبة النجاح",stats_correct:"✅ صحيحة:",stats_wrong:"❌ خاطئة:",stats_week:"آخر 7 أيام مذاكرة",plan_head:"🗓️ خطة المذاكرة",plan_goal:"حدد هدفك اليومي",plan_words:"عدد الكلمات اليومية",plan_sents:"عدد الجمل",plan_mins:"عدد دقائق المذاكرة",plan_save:"حفظ الخطة 💾",plan_prog:"تقدم اليوم",plan_dw:"+ كلمة ذاكرتها",plan_ds:"+ جملة ذاكرتها",plan_dm:"+ 5 دقائق",plan_reset:"تصفير تقدم اليوم",set_head:"⚙️ الإعدادات",set_appear:"المظهر والصوت",set_mode:"الوضع:",set_toggle:"تبديل Dark / Light",set_speed:"سرعة النطق الافتراضية",set_voice:"🔊 تجربة الصوت الألماني",set_colors:"🎨 ألوان الموقع",set_colorsub:"اختر Theme — يُطبق فورًا ويُحفظ.",set_lang:"🌐 اللغة",set_langsub:"اختر لغة الواجهة — تُطبق فورًا وتُحفظ.",gram_search_btn:"🔎 بحث عن قاعدة",gram_search_ph:"ابحث: Akkusativ / Artikel / sein...",gram_noresults:"لم يتم العثور على قاعدة مطابقة للبحث.",gram_lab_btn:"🧪 مختبر القواعد",gram_lab_close:"✖ إغلاق والعودة للشرح",gram_open:"فتح ←",gl_examples:"📚 أمثلة القاعدة",gl_qof:"سؤال {i} من {n}",gl_check:"تحقق ✅",gl_clear:"مسح",gl_next:"التالي ⏭",gl_result:"🏁 نتيجة التدريب",gl_errs:"الأخطاء للمراجعة",gl_recap:"📌 تذكير سريع بالقاعدة",gl_again:"🔁 إعادة التدريب",gl_back:"← كل القواعد",set_data:"البيانات",set_export:"📤 تصدير نسخة",set_import:"📥 استيراد",set_wipe:"🗑️ مسح كل البيانات",set_note:"كل البيانات محفوظة في LocalStorage ولا تضيع عند Refresh.",modal_add:"➕ إضافة كلمة جديدة",f_de:"الكلمة بالألمانية (بدون أداة)",f_art:"الأداة",f_noart2:"بدون أداة (فعل/صفة)",f_ar:"الترجمة بالعربية",f_pron:"النطق بالعربي",f_ex:"مثال بالألمانية",f_exar:"ترجمة المثال",f_cat:"التصنيف",f_type:"النوع",f_level:"المستوى",modal_addbtn:"Add Word ✅",modal_cancel:"إلغاء",modal_close:"إغلاق ✖",search_ph:"ابحث: Haus / البيت / فعل / قاعدة...",aria_menu:"القائمة",app_title:"Deutsch Master | أتقن الألمانية",speed_title:"سرعة النطق",lang_title:"اللغة",soon_title:"قريبًا",vocab_search_ph:"ابحث بكلمة ألمانية أو عربية...",sent_search_ph:"ابحث في الجمل...",verb_search_ph:"ابحث عن فعل: lernen / يتعلم...",write_ph:"اكتب الأداة: der / die / das",lang_ar:"🇪🇬 عربي",lang_en:"🇬🇧 EN",lang_de:"🇩🇪 Deutsch",toast_ar:"العربية 🇪🇬",toast_en:"English 🇬🇧",toast_de:"Deutsch 🇩🇪",lang_btn_aria:"تغيير اللغة",sx_sub:"تدرّب على تكوين وفهم الجمل الألمانية — اختر Kapitel للتدريب.",sx_questions:"سؤال",sx_start:"ابدأ التدريب 🚀",sx_notyet:"لم تتدرب بعد",sx_yourprog:"تقدمك",sx_multi_h:"☑️ اختيار أكثر من Kapitel",sx_multi_sub:"علّم على الفصول ثم ابدأ — الأسئلة من المختار فقط.",sx_multi_btn:"ابدأ التدريب المحدد 🚀",sx_mixed_h:"🔀 جميع Kapitel — مختلط",sx_mixed_sub:"تدريب مختلط من كل الفصول بخلط حقيقي.",sx_mixed_btn:"ابدأ المختلط 🌍",sx_nochoice:"اختر Kapitel واحدًا على الأقل ☑️",sx_noqs:"لا توجد أسئلة لهذا الاختيار ⚠️",sx_result:"🎯 النتيجة — ",sx_empty:"لا توجد أسئلة بعد.",sx_errors:"أخطاؤك (",sx_noerr:"ممتاز — بلا أخطاء! 🎉",sx_again:"🔄 تدريب جديد",sx_gomist:"❌ مراجعة أخطائي",sx_home:"🏠 الرئيسية",sx_correct:"صحيح ✅ ",sx_wrong:"خطأ ❌ ",sx_yourans:"إجابتك: ",sx_correctans:"الصحيحة: "},
en:{dashboard:"Home",vocab:"Words",flashcards:"Flashcards",sentences:"Sentences",sentex:"Sentence Exercises",verbs:"Verbs",grammar:"Grammar",explain:"Lessons",quiz:"Quizzes",journey:"Journey",listen:"Listening",speak:"Speaking",talk:"Chat",real:"Situations",job:"Work",ach:"My awards",games:"Games",world:"World",life:"Deutsch Life",exp:"German Experiences",mygermany:"My Germany",dlife:"Training Situations",stories:"Stories",survive:"Survival",challenge:"Challenge",me:"Profile",practice:"Smart training",tutor:"Tutor",roadmap:"Roadmap",labs:"Labs",profile:"Account",analytics:"Progress",review:"Review",mistakes:"Mistakes",stats:"Stats",planner:"Planner",favorites:"Favorites",settings:"Settings",side_level:"Current level:",hero_tag:"🇩🇪 Level A1 • German Learning + Technology",hero_welcome:"Welcome to",hero_words:"Start words 📚",hero_quiz:"Test yourself 📝",hero_review:"Today's review 🧠",hero_progress:"Progress",dash_words:"📚 Words",dash_quiz:"📝 Start a quiz",dash_review:"🧠 Start studying",plan_today:"🎯 Today's plan",plan_open:"Open plan",quick_head:"⚡ Quick actions",quick_flash:"🃏 Flashcard",quick_sent:"💬 A1 sentences",quick_verbs:"⚡ Verb conjugation",quick_listen:"🎧 Listening quiz",quick_rule:"📐 Rule of the day",quick_mist:"❌ My mistakes",stat_saved:"Saved words",stat_due:"Need review",stat_days:"Study days",stat_tests:"Quizzes taken",stat_correct:"Correct answers",stat_streak:"Streak days in a row",title_vocab:"📚 German words",add_word:"+ Add word",f_allcats:"All categories",f_alltypes:"All types",t_noun:"Noun",t_verb:"Verb",t_adj:"Adjective",t_pron:"Pronoun",t_part:"Particle",t_vocabw:"Vocabulary",f_allstatus:"All states",s_new:"🆕 New",s_review:"🔁 Review",s_hard:"🔴 Hard",s_known:"✅ Known",s_later:"⏳ Later",f_allart:"der/die/das all",f_noart:"No article",f_allkap:"All chapters",f_alllevels:"All levels",title_flash:"🃏 Flashcards",flash_shuffle:"🔀 Shuffle",flash_hint:"Tap to flip 🔄",flash_prev:"⏮ Previous",rate_easy:"😊 Easy",rate_mid:"😐 Medium",rate_hard:"😟 Hard",title_sent:"💬 German sentences",title_sentex:"✏️ Sentence Exercises",title_verbs:"⚡ German verbs",title_grammar:"📐 Grammar (by chapter)",title_explain:"📚 Lessons",title_listen:"🎧 Listening",title_speak:"🎤 Speaking",title_talk:"💬 Chat",title_real:"🌍 Real situations",title_job:"💼 German at work",title_ach:"🏆 My awards",title_games:"🎮 Games",title_world:"🗺️ World",title_exp:"🇩🇪 German Experiences",title_mygermany:"🌍 My Germany",title_dlife:"🎭 Deutsch Life — situation training",title_stories:"📖 Stories",title_survive:"🇩🇪 Surviving in Germany",title_challenge:"⚡ Challenge",title_me:"🙂 My profile and report",title_practice:"🎯 Smart training",title_tutor:"🤖 Tutor",title_roadmap:"🗺️ Roadmap",title_labs:"🧪 Labs",title_profile:"👤 My account",title_analytics:"📈 My progress",title_quiz:"📝 Quizzes",quiz_choose:"Choose the quiz type",qt_mixed:"🎲 Mixed (Recommended)",qt_article:"🎯 Articles",qt_dear:"📖 Word → meaning",qt_arde:"🔄 Arabic → German",qt_plural:"👥 Plural",qt_write:"✍️ Write the article",qt_listen:"🎧 Listening",qt_listenart:"🎧+🎯 Listening + article",qt_sentence:"🧩 Complete the sentence",qt_order:"🔀 Order the sentence",qt_quick:"⚡ Quick quiz ⏱️",quiz_count:"Number of questions:",quiz_start:"Start the quiz 🚀",quiz_check:"Check ✅",quiz_next:"Next ⏭",quiz_quit:"Finish ✖",quiz_history:"📜 Quiz history",rev_head:"🧠 Smart review",rev_start:"Start a review session 🚀",rev_due:"📌 Words due for review today",mist_head:"❌ Review my mistakes",mist_test:"🎯 Test only my mistakes",mist_clear:"🗑️ Clear mistakes",stats_head:"📊 Statistics",stats_reset:"Reset statistics",stats_dist:"Word states distribution",stats_acc:"Success rate",stats_correct:"✅ Correct:",stats_wrong:"❌ Wrong:",stats_week:"Last 7 study days",plan_head:"🗓️ Study plan",plan_goal:"Set your daily goal",plan_words:"Daily words",plan_sents:"Number of sentences",plan_mins:"Study minutes",plan_save:"Save plan 💾",plan_prog:"Today's progress",plan_dw:"+ word studied",plan_ds:"+ sentence studied",plan_dm:"+ 5 minutes",plan_reset:"Reset today's progress",set_head:"⚙️ Settings",set_appear:"Appearance and sound",set_mode:"Mode:",set_toggle:"Toggle Dark / Light",set_speed:"Default speech rate",set_voice:"🔊 Try the German voice",set_colors:"🎨 Site colors",set_colorsub:"Choose a theme — applied instantly and saved.",set_lang:"🌐 Language",set_langsub:"Choose the interface language — applied instantly and saved.",gram_search_btn:"🔎 Search a rule",gram_search_ph:"Search: Akkusativ / Artikel / sein...",gram_noresults:"No matching rule found.",gram_lab_btn:"🧪 Grammar Lab",gram_lab_close:"✖ Close and back to explanation",gram_open:"Open ←",gl_examples:"📚 Rule examples",gl_qof:"Question {i} of {n}",gl_check:"Check ✅",gl_clear:"Clear",gl_next:"Next ⏭",gl_result:"🏁 Training result",gl_errs:"Mistakes to review",gl_recap:"📌 Quick rule recap",gl_again:"🔁 Train again",gl_back:"← All rules",set_data:"Data",set_export:"📤 Export a copy",set_import:"📥 Import",set_wipe:"🗑️ Erase all data",set_note:"All data is stored in LocalStorage and is kept on refresh.",modal_add:"➕ Add a new word",f_de:"German word (no article)",f_art:"Article",f_noart2:"No article (verb/adjective)",f_ar:"Arabic translation",f_pron:"Arabic pronunciation",f_ex:"German example",f_exar:"Example translation",f_cat:"Category",f_type:"Type",f_level:"Level",modal_addbtn:"Add Word ✅",modal_cancel:"Cancel",modal_close:"Close ✖",search_ph:"Search: Haus / house / verb / rule...",aria_menu:"Menu",app_title:"Deutsch Master | Master German",speed_title:"Speech rate",lang_title:"Language",soon_title:"Soon",vocab_search_ph:"Search with a German or Arabic word...",sent_search_ph:"Search sentences...",verb_search_ph:"Search a verb: lernen / to learn...",write_ph:"Write the article: der / die / das",lang_ar:"🇪🇬 Arabic",lang_en:"🇬🇧 EN",lang_de:"🇩🇪 Deutsch",toast_ar:"Arabic 🇪🇬",toast_en:"English 🇬🇧",toast_de:"German 🇩🇪",lang_btn_aria:"Change language",sx_sub:"Practise building and understanding German sentences — choose a chapter.",sx_questions:"questions",sx_start:"Start training 🚀",sx_notyet:"Not trained yet",sx_yourprog:"Your progress",sx_multi_h:"☑️ Choose several chapters",sx_multi_sub:"Tick chapters then start — questions come only from the selection.",sx_multi_btn:"Start the selected training 🚀",sx_mixed_h:"🔀 All chapters — mixed",sx_mixed_sub:"Mixed training from all chapters, truly shuffled.",sx_mixed_btn:"Start mixed 🌍",sx_nochoice:"Choose at least one chapter ☑️",sx_noqs:"No questions for this choice ⚠️",sx_result:"🎯 Result — ",sx_empty:"No questions yet.",sx_errors:"Your mistakes (",sx_noerr:"Excellent — no mistakes! 🎉",sx_again:"🔄 New training",sx_gomist:"❌ Review my mistakes",sx_home:"🏠 Home",sx_correct:"Correct ✅ ",sx_wrong:"Wrong ❌ ",sx_yourans:"Your answer: ",sx_correctans:"Correct: "},
de:{dashboard:"Startseite",vocab:"Wörter",flashcards:"Flashcards",sentences:"Sätze",sentex:"Satzübungen",verbs:"Verben",grammar:"Grammatik",explain:"Erklärungen",quiz:"Tests",journey:"Reise",listen:"Hören",speak:"Sprechen",talk:"Chat",real:"Situationen",job:"Arbeit",ach:"Meine Erfolge",games:"Spiele",world:"Welt",life:"Deutsch Life",exp:"Deutsche Erfahrungen",mygermany:"My Germany",dlife:"Trainingssituationen",stories:"Geschichten",survive:"Überleben",challenge:"Challenge",me:"Profil",practice:"Intelligentes Training",tutor:"Tutor",roadmap:"Roadmap",labs:"Labor",profile:"Konto",analytics:"Fortschritt",review:"Wiederholung",mistakes:"Meine Fehler",stats:"Statistiken",planner:"Lernplan",favorites:"Favoriten",settings:"Einstellungen",side_level:"Aktuelles Niveau:",hero_tag:"🇩🇪 Niveau A1 • Deutsch lernen + Technologie",hero_welcome:"Willkommen bei",hero_words:"Wörter starten 📚",hero_quiz:"Teste dich 📝",hero_review:"Heutige Wiederholung 🧠",hero_progress:"Fortschritt",dash_words:"📚 Wörter",dash_quiz:"📝 Test starten",dash_review:"🧠 Lernen starten",plan_today:"🎯 Heutiger Plan",plan_open:"Plan öffnen",quick_head:"⚡ Schnellzugriff",quick_flash:"🃏 Karteikarte",quick_sent:"💬 A1-Sätze",quick_verbs:"⚡ Verbkonjugation",quick_listen:"🎧 Hörtest",quick_rule:"📐 Regel des Tages",quick_mist:"❌ Meine Fehler",stat_saved:"Gelernte Wörter",stat_due:"Offen zur Wiederholung",stat_days:"Lerntage",stat_tests:"Gemachte Tests",stat_correct:"Richtige Antworten",stat_streak:"Streak-Tage in Folge",title_vocab:"📚 Deutsche Wörter",add_word:"+ Wort hinzufügen",f_allcats:"Alle Kategorien",f_alltypes:"Alle Typen",t_noun:"Substantiv",t_verb:"Verb",t_adj:"Adjektiv",t_pron:"Pronomen",t_part:"Partikel",t_vocabw:"Wortschatz",f_allstatus:"Alle Stände",s_new:"🆕 Neu",s_review:"🔁 Wiederholung",s_hard:"🔴 Schwer",s_known:"✅ Gewusst",s_later:"⏳ Später",f_allart:"der/die/das alle",f_noart:"Ohne Artikel",f_allkap:"Alle Kapitel",f_alllevels:"Alle Niveaus",title_flash:"🃏 Flashcards",flash_shuffle:"🔀 Mischen",flash_hint:"Tippen zum Umdrehen 🔄",flash_prev:"⏮ Zurück",rate_easy:"😊 Leicht",rate_mid:"😐 Mittel",rate_hard:"😟 Schwer",title_sent:"💬 Deutsche Sätze",title_sentex:"✏️ Satzübungen",title_verbs:"⚡ Deutsche Verben",title_grammar:"📐 Grammatik (nach Kapiteln)",title_explain:"📚 Erklärungen",title_listen:"🎧 Hören",title_speak:"🎤 Sprechen",title_talk:"💬 Chat",title_real:"🌍 Echte Situationen",title_job:"💼 Deutsch bei der Arbeit",title_ach:"🏆 Meine Erfolge",title_games:"🎮 Spiele",title_world:"🗺️ Welt",title_exp:"🇩🇪 Deutsche Erfahrungen",title_mygermany:"🌍 My Germany",title_dlife:"🎭 Deutsch Life — Situationstraining",title_stories:"📖 Geschichten",title_survive:"🇩🇪 Überleben in Deutschland",title_challenge:"⚡ Challenge",title_me:"🙂 Mein Profil und Bericht",title_practice:"🎯 Intelligentes Training",title_tutor:"🤖 Tutor",title_roadmap:"🗺️ Roadmap",title_labs:"🧪 Labor",title_profile:"👤 Mein Konto",title_analytics:"📈 Mein Fortschritt",title_quiz:"📝 Tests",quiz_choose:"Wähle die Testart",qt_mixed:"🎲 Gemischt (empfohlen)",qt_article:"🎯 Artikel",qt_dear:"📖 Wort → Bedeutung",qt_arde:"🔄 Arabisch → Deutsch",qt_plural:"👥 Plural",qt_write:"✍️ Artikel schreiben",qt_listen:"🎧 Hören",qt_listenart:"🎧+🎯 Hören + Artikel",qt_sentence:"🧩 Satz vervollständigen",qt_order:"🔀 Satz ordnen",qt_quick:"⚡ Schnelltest ⏱️",quiz_count:"Anzahl der Fragen:",quiz_start:"Test starten 🚀",quiz_check:"Prüfen ✅",quiz_next:"Weiter ⏭",quiz_quit:"Beenden ✖",quiz_history:"📜 Testverlauf",rev_head:"🧠 Intelligente Wiederholung",rev_start:"Wiederholung starten 🚀",rev_due:"📌 Heute zu wiederholende Wörter",mist_head:"❌ Meine Fehler ansehen",mist_test:"🎯 Nur meine Fehler testen",mist_clear:"🗑️ Fehler löschen",stats_head:"📊 Statistiken",stats_reset:"Statistiken zurücksetzen",stats_dist:"Verteilung der Wortstände",stats_acc:"Erfolgsquote",stats_correct:"✅ Richtig:",stats_wrong:"❌ Falsch:",stats_week:"Letzte 7 Lerntage",plan_head:"🗓️ Lernplan",plan_goal:"Setze dein Tagesziel",plan_words:"Tägliche Wörter",plan_sents:"Anzahl der Sätze",plan_mins:"Lernminuten",plan_save:"Plan speichern 💾",plan_prog:"Heutiger Fortschritt",plan_dw:"+ gelerntes Wort",plan_ds:"+ gelernter Satz",plan_dm:"+ 5 Minuten",plan_reset:"Heutigen Fortschritt zurücksetzen",set_head:"⚙️ Einstellungen",set_appear:"Darstellung und Ton",set_mode:"Modus:",set_toggle:"Dark / Light wechseln",set_speed:"Standard-Sprechtempo",set_voice:"🔊 Deutsche Stimme testen",set_colors:"🎨 Farben der Seite",set_colorsub:"Wähle ein Theme — wird sofort angewendet und gespeichert.",set_lang:"🌐 Sprache",set_langsub:"Wähle die Sprache — wird sofort übernommen und gespeichert.",gram_search_btn:"🔎 Regel suchen",gram_search_ph:"Suche: Akkusativ / Artikel / sein...",gram_noresults:"Keine passende Regel gefunden.",gram_lab_btn:"🧪 Grammatik-Labor",gram_lab_close:"✖ Schließen und zurück zur Erklärung",gram_open:"Öffnen ←",gl_examples:"📚 Regelbeispiele",gl_qof:"Frage {i} von {n}",gl_check:"Prüfen ✅",gl_clear:"Löschen",gl_next:"Weiter ⏭",gl_result:"🏁 Trainingsergebnis",gl_errs:"Fehler zur Wiederholung",gl_recap:"📌 Kurze Regelwiederholung",gl_again:"🔁 Nochmal üben",gl_back:"← Alle Regeln",set_data:"Daten",set_export:"📤 Kopie exportieren",set_import:"📥 Importieren",set_wipe:"🗑️ Alle Daten löschen",set_note:"Alle Daten sind in LocalStorage gespeichert und bleiben beim Neuladen erhalten.",modal_add:"➕ Neues Wort hinzufügen",f_de:"Deutsches Wort (ohne Artikel)",f_art:"Artikel",f_noart2:"Ohne Artikel (Verb/Adjektiv)",f_ar:"Arabische Übersetzung",f_pron:"Arabische Aussprache",f_ex:"Deutsches Beispiel",f_exar:"Beispielübersetzung",f_cat:"Kategorie",f_type:"Typ",f_level:"Niveau",modal_addbtn:"Wort hinzufügen ✅",modal_cancel:"Abbrechen",modal_close:"Schließen ✖",search_ph:"Suchen: Haus / Haus / Verb / Regel...",aria_menu:"Menü",app_title:"Deutsch Master | Deutsch meistern",speed_title:"Sprechtempo",lang_title:"Sprache",soon_title:"Bald",vocab_search_ph:"Mit deutschem oder arabischem Wort suchen...",sent_search_ph:"Sätze suchen...",verb_search_ph:"Verb suchen: lernen / lernen...",write_ph:"Artikel schreiben: der / die / das",lang_ar:"🇪🇬 Arabisch",lang_en:"🇬🇧 EN",lang_de:"🇩🇪 Deutsch",toast_ar:"Arabisch 🇪🇬",toast_en:"Englisch 🇬🇧",toast_de:"Deutsch 🇩🇪",lang_btn_aria:"Sprache ändern",sx_sub:"Übe deutsche Sätze zu bilden und zu verstehen — wähle ein Kapitel.",sx_questions:"Fragen",sx_start:"Training starten 🚀",sx_notyet:"Noch nicht geübt",sx_yourprog:"Dein Fortschritt",sx_multi_h:"☑️ Mehrere Kapitel wählen",sx_multi_sub:"Kreuze Kapitel an und starte — Fragen kommen nur aus der Auswahl.",sx_multi_btn:"Ausgewähltes Training starten 🚀",sx_mixed_h:"🔀 Alle Kapitel — gemischt",sx_mixed_sub:"Gemischtes Training aus allen Kapiteln, echt gemischt.",sx_mixed_btn:"Gemischt starten 🌍",sx_nochoice:"Wähle mindestens ein Kapitel ☑️",sx_noqs:"Keine Fragen für diese Auswahl ⚠️",sx_result:"🎯 Ergebnis — ",sx_empty:"Noch keine Fragen.",sx_errors:"Deine Fehler (",sx_noerr:"Ausgezeichnet — keine Fehler! 🎉",sx_again:"🔄 Neues Training",sx_gomist:"❌ Meine Fehler ansehen",sx_home:"🏠 Startseite",sx_correct:"Richtig ✅ ",sx_wrong:"Falsch ❌ ",sx_yourans:"Deine Antwort: ",sx_correctans:"Richtig: "}};
function tv(k){try{const L=S.uiLang||"ar";const d=I18N[L]||{};if(d[k]!==undefined&&d[k]!==null&&d[k]!=="")return d[k];const a=(I18N.ar||{})[k];if(a!==undefined&&a!==null&&a!=="")return a;return null;}catch(e){return null;}}
function t(k){const v=tv(k);return v===null?k:v;}
function applyLang(){
  try{
    const L=S.uiLang||"ar";
    document.documentElement.setAttribute("dir",L==="ar"?"rtl":"ltr");
    document.documentElement.setAttribute("lang",L==="ar"?"ar":(L==="de"?"de":"en"));
    try{if(I18N[L]&&I18N[L].app_title)document.title=I18N[L].app_title;}catch(e){}
  }catch(e){}
  try{
    document.querySelectorAll(".nav-item").forEach(b=>{
      const p=b.dataset.page;if(!p||!I18N[S.uiLang||"ar"][p])return;
      const ic=b.querySelector(".nav-ico");
      b.childNodes.forEach(n=>{if(n.nodeType===3)n.remove();});
      b.appendChild(document.createTextNode(" "+t(p)));
      if(ic)b.insertBefore(ic,b.firstChild);
    });
  }catch(e){}
  try{
    document.querySelectorAll("[data-i18n]").forEach(el=>{const v=tv(el.getAttribute("data-i18n"));if(v!==null)el.textContent=v;});
    document.querySelectorAll("[data-i18n-ph]").forEach(el=>{const v=tv(el.getAttribute("data-i18n-ph"));if(v!==null)el.setAttribute("placeholder",v);});
    document.querySelectorAll("[data-i18n-title]").forEach(el=>{const v=tv(el.getAttribute("data-i18n-title"));if(v!==null)el.setAttribute("title",v);});
    document.querySelectorAll("[data-i18n-aria]").forEach(el=>{const v=tv(el.getAttribute("data-i18n-aria"));if(v!==null)el.setAttribute("aria-label",v);});
    const ls=$("langSel");if(ls)ls.value=S.uiLang||"ar";
  }catch(e){}
  try{
    const L2=S.uiLang||"ar";
    const lb=$("langBtnLabel");if(lb)lb.textContent=L2==="de"?"DE":(L2==="en"?"EN":"عربي");
    document.querySelectorAll("#langMenu [data-lang]").forEach(function(b){b.setAttribute("aria-checked",b.getAttribute("data-lang")===L2?"true":"false");});
    document.querySelectorAll("[data-setlang]").forEach(function(b){
      const on=b.getAttribute("data-setlang")===L2;
      b.classList.toggle("btn-primary",on);b.classList.toggle("btn-ghost",!on);
      b.setAttribute("aria-pressed",on?"true":"false");
    });
  }catch(e){}
}
/* ---------- mobile header language menu (same i18n system, no new backend) ---------- */
function setHeaderLang(v){
  if(v!=="ar"&&v!=="de"&&v!=="en")return;
  S.uiLang=v;Store.save();applyLang();
  toast(v==="de"?t("toast_de"):(v==="en"?t("toast_en"):t("toast_ar")),"ok");
}
function initHeaderLang(){
  try{
    /* sidebar + settings language buttons (work with or without the old header menu) */
    document.querySelectorAll("[data-setlang]").forEach(function(b){
      if(b._wired)return;b._wired=true;
      b.addEventListener("click",function(){setHeaderLang(b.getAttribute("data-setlang"));});
    });
    const btn=$("langBtn"),menu=$("langMenu");
    if(!btn||!menu||btn._wired)return;btn._wired=true;
    const close=function(){menu.hidden=true;btn.setAttribute("aria-expanded","false");};
    btn.addEventListener("click",function(e){try{e.stopPropagation();}catch(_){}
      if(menu.hidden){menu.hidden=false;btn.setAttribute("aria-expanded","true");}
      else close();
    });
    menu.querySelectorAll("[data-lang]").forEach(function(b){
      b.addEventListener("click",function(){setHeaderLang(b.getAttribute("data-lang"));close();});
    });
    document.addEventListener("click",function(e){
      try{if(!menu.hidden&&!menu.contains(e.target)&&!btn.contains(e.target))close();}catch(_){}
    });
    document.addEventListener("keydown",function(e){if(e.key==="Escape"){try{close();}catch(_){}}});
  }catch(e){}
}
/* ---------- notifications (in-app only) ---------- */
function buildNotifs(){
  ensureStudy();
  const out=[];
  const due=srsDue().length;
  if((S.streak.count||0)>0)out.push({i:"🔥",t:"لا تخسر سلسلتك! ("+(S.streak.count||0)+" أيام)"});
  if(due>0)out.push({i:"🧠",t:due+" كلمات تحتاج مراجعة."});
  try{
    const p=S.planner||{};const dw=(p.day===todayStr()?p.dw:0);
    if((p.words||0)>0&&dw<(p.words||0))out.push({i:"📚",t:"خطتك اليومية مكتملة بنسبة "+Math.round(dw/(p.words||1)*100)+"%. نشاط واحد آخر ويكتمل هدفك!"});
  }catch(e){}
  return out;
}
function renderNotifBell(){
  try{
    let bell=$("notifBell");
    if(!bell){
      const ta=document.querySelector(".top-actions");if(!ta)return;
      bell=document.createElement("button");bell.className="icon-btn";bell.id="notifBell";bell.title="التنبيهات";
      ta.insertBefore(bell,ta.firstChild);
      const drop=document.createElement("div");drop.id="notifDrop";ta.appendChild(drop);
      bell.addEventListener("click",()=>{
        const box=$("notifDrop");if(!box)return;
        box.classList.toggle("show");
        S.notifRead=Date.now();Store.save();
        const n=buildNotifs();
        box.innerHTML=n.length?n.map(x=>'<div class="search-hit">'+x.i+" "+escapeHtml(x.t)+"</div>").join(""):'<div class="search-hit">لا تنبيهات جديدة 🎉</div>';
        renderNotifBell();
      });
    }
    const n=buildNotifs().length;
    bell.textContent=n>0?("🔔"+n):"🔔";
  }catch(e){}
}
/* ---------- SRS (additive layer over review/mistakes) ---------- */
function srsEnsure(id){
  ensureStudy();
  if(!S.srs[id])S.srs[id]={ease:2.5,due:todayStr(),reps:0};
  return S.srs[id];
}
function srsUpdate(id,ok){
  try{
    const s=srsEnsure(id);
    if(ok){s.reps++;s.ease=Math.min(3,(s.ease||2.5)+0.15);const gap=s.reps<=1?1:s.reps===2?3:7;s.due=todayPlus(gap);}
    else{s.reps=0;s.ease=Math.max(1.3,(s.ease||2.5)-0.3);s.due=todayStr();}
    Store.save();
  }catch(e){}
}
if(typeof bumpReview==="function"&&!bumpReview._srs){
  const _br=bumpReview;
  bumpReview=function(id,ok){const r=_br(id,ok);try{srsUpdate(id,!!ok);}catch(e){}return r;};
  bumpReview._srs=true;
}
function srsDue(){
  ensureStudy();
  const t=todayStr(),out=[];
  allWords().forEach(w=>{
    const s=S.srs[w.id];
    const m=S.mistakes&&S.mistakes[w.id];
    if(s&&s.due<=t)out.push(w);
    else if(!s&&m&&m.n>=2)out.push(w);
  });
  return out;
}
/* ---------- dashboard upgrade: overview + continue + weak + goal + notifs ---------- */
function weakAreas(){
  const cats={};
  Object.keys(S.mistakes||{}).forEach(id=>{
    const w=wordById(id);if(!w)return;
    const k=(w.cat||"عام");
    cats[k]=(cats[k]||0)+S.mistakes[id].n;
  });
  const arr=Object.keys(cats).map(k=>({k:k,n:cats[k]})).sort((a,b)=>b.n-a.n);
  return arr.slice(0,3).map(x=>({k:x.k,n:x.n,lvl:x.n>=8?"🔴":x.n>=4?"🟠":"🟡"}));
}
function goalProgress(){
  ensureStudy();
  const g=S.plan2;
  if(g.goalType==="minutes"){const m=S.timeLog[todayStr()]||0;return {have:m,need:g.goalN,unit:"دقيقة"};}
  if(g.goalType==="acts"){const n=(_sess?_sess.n:0);return {have:n,need:g.goalN,unit:"نشاط"};}
  const p=S.planner||{};const have=(p.day===todayStr()?p.dw:0);
  return {have:have,need:(p.words||g.goalN||15),unit:"كلمة"};
}
function renderStudyDash(){
  try{
    ensureStudy();
    let host=$("dashStudy");
    if(!host){
      const anchor=$("dashLearn")||$("gamerStrip");
      if(!anchor)return;
      host=document.createElement("div");host.id="dashStudy";
      anchor.parentNode.insertBefore(host,anchor.nextSibling);
    }
    const words=allWords(),known=words.filter(w=>getStatus(w.id)==="known").length;
    const gp=goalProgress();
    const gpct=Math.min(100,Math.round(gp.have/Math.max(1,gp.need)*100));
    const last=S.lastActivity;
    const weak=weakAreas();
    const notifs=buildNotifs();
    host.innerHTML='<div class="panel glass reveal"><h3>🎯 هدف اليوم</h3>'
      +'<div class="row-flex"><select id="goalType"><option value="words">كلمات</option><option value="minutes">دقائق</option><option value="acts">أنشطة</option></select>'
      +'<input type="number" id="goalN" min="1" max="300" value="'+gp.need+'"><button class="btn btn-primary sm" id="goalSave">حفظ 🎯</button></div>'
      +'<div class="muted">'+gp.have+' / '+gp.need+' '+gp.unit+' ('+gpct+'%)</div><div class="progress"><div class="progress-fill" style="width:'+gpct+'%"></div></div>'
      +(last?'<div class="row-flex"><button class="btn btn-gold sm" id="contBtn">▶️ Continue Learning: '+escapeHtml(last.t)+'</button></div>':"")
      +'<h3>⚠️ نقاط الضعف</h3>'+(weak.length?weak.map(w=>'<div class="muted">'+w.lvl+" "+escapeHtml(w.k)+" ("+w.n+" أخطاء)</div>").join(""):'<div class="muted">لا أخطاء مسجلة — ممتاز! 🟢</div>')
      +'<h3>🔔 تنبيهات ('+notifs.length+')</h3>'+(notifs.length?notifs.map(n=>'<div class="muted">'+n.i+" "+escapeHtml(n.t)+"</div>").join(""):'<div class="muted">كل شيء تمام 🎉</div>')
      +'<div class="muted">📚 كلمات محفوظة: '+known+'/'+words.length+'</div></div>';
    $("goalType").value=S.plan2.goalType;$("goalN").value=gp.need;
    $("goalSave").addEventListener("click",()=>{S.plan2={goalType:$("goalType").value,goalN:Math.max(1,parseInt($("goalN").value||"15",10))};Store.save();renderStudyDash();toast("تم حفظ هدفك 🎯","ok");});
    const cb=$("contBtn");
    if(cb)cb.addEventListener("click",()=>{try{showPage(last.go);}catch(e){}});
  }catch(e){}
}
/* ---------- AI Tutor (local engine; remote hook ready, no keys in frontend) ---------- */
const TutorAPI={
  backend:"local",
  remote:null,
  ask(mode,text){
    if(this.backend==="remote"&&this.remote&&this.remote.ask)return this.remote.ask(mode,text);
    return Promise.resolve(TutorLocal.ask(mode,text));
  }
};
const TutorLocal={
  findNoun(tok){
    const clean=tok.replace(/^[.,!?;:"]+|[.,!?;:"]+$/g,"");
    return allWords().find(w=>w.de.toLowerCase()===clean.toLowerCase()&&w.type==="اسم");
  },
  ask(mode,text){
    if(mode==="translate")return this.translate(text);
    if(mode==="vocab")return this.vocabHelp(text);
    if(mode==="explain")return this.explain(text);
    if(mode==="examples")return this.examples(text);
    if(mode==="conv")return {echo:text};
    return this.correct(text);
  },
  correct(text){
    const issues=[],fixes=[];
    let out=text.trim();
    if(out&&/[a-zäöü]/.test(out[0])){issues.push("الجملة الألمانية تبدأ بحرف كبير.");fixes.push("ابدأ بحرف كبير.");out=out[0].toUpperCase()+out.slice(1);}
    if(out&&!/[.?!]$/.test(out)){issues.push("الجملة بدون علامة نهاية.");fixes.push("أضف . أو ؟ أو ! في النهاية.");out=out+".";}
    const toks=out.split(/\s+/);
    const ARTN={der:"der",die:"die",das:"das",eine:"die",einen:"der",keine:"die",keinen:"der"};
    for(let i=0;i<toks.length-1;i++){
      const a=toks[i].replace(/[^A-Za-zäöüÄÖÜß]/g,"");
      const al=a.toLowerCase();
      const w=this.findNoun(toks[i+1]);
      if(!w)continue;
      if(al==="der"||al==="die"||al==="das"){
        if(al!==w.art){issues.push("الأداة قبل «"+w.de+"» غير صحيحة ("+a+" ← "+w.art+").");fixes.push("استخدم «"+w.art+" "+w.de+"».");toks[i]=(/^[A-ZÄÖÜ]/.test(toks[i][0])?w.art.charAt(0).toUpperCase()+w.art.slice(1):w.art);}
      }else if(al==="ein"||al==="eine"||al==="einen"){
        const should=w.art==="die"?"eine":"ein";
        if(al!==should){issues.push("النكرة قبل «"+w.de+"» غير صحيحة ("+a+" ← "+should+").");fixes.push("استخدم «"+should+" "+w.de+"».");toks[i]=should;}
      }else if(al==="kein"||al==="keine"||al==="keinen"){
        const should=w.art==="die"?"keine":"kein";
        if(al!==should){issues.push("النفي قبل «"+w.de+"» غير صحيح.");fixes.push("استخدم «"+should+" "+w.de+"».");toks[i]=should;}
      }
    }
    out=toks.join(" ");
    if(/\bnicht\s+(ein|eine)\b/i.test(out)){issues.push("بعد nicht لا تأتي أداة نكرة.");fixes.push("استخدم kein/keine بدل nicht ein: مثل Ich habe kein Auto.");out=out.replace(/\bnicht\s+ein\b/i,"kein").replace(/\bnicht\s+eine\b/i,"keine");}
    const sv=out.match(/\b(ich|du|er|sie|es|wir|ihr)\s+(bin|bist|ist|sind|seid)\s+([A-Za-zäöüÄÖÜß]+en)\b/i);
    if(sv){issues.push("لا يجتمع فعل sein مع مصدر للتعبير عن فعل تقوم به.");fixes.push("احذف "+sv[2]+" وصرّف الفعل: مثل Ich gehe zur Schule.");out=out.replace(new RegExp("\\b"+sv[2]+"\\s+","i"),"");}
    const knownNouns={};
    allWords().filter(w=>w.type==="اسم"&&/^[A-ZÄÖÜ]/.test(w.de)).forEach(w=>{knownNouns[w.de.toLowerCase()]=w.de;});
    out=out.split(/\s+/).map(tk=>{
      const core=tk.replace(/[^A-Za-zäöüÄÖÜß]/g,"");
      if(/^[a-zäöü]/.test(core)&&knownNouns[core.toLowerCase()]){
        issues.push("الاسم «"+knownNouns[core.toLowerCase()]+"» يجب أن يُكتب بحرف كبير.");fixes.push("اكتب "+knownNouns[core.toLowerCase()]+" بحرف كبير.");
        return tk.replace(core,knownNouns[core.toLowerCase()]);
      }
      return tk;
    }).join(" ");
    return {ok:issues.length===0,corrected:out,issues:issues.slice(0,5),fixes:fixes.slice(0,5)};
  },
  translate(text){
    const parts=text.split(/\s+/).map(tok=>{
      const w=allWords().find(w=>w.de.toLowerCase()===tok.replace(/[^A-Za-zäöüÄÖÜß]/g,"").toLowerCase());
      return w?w.ar+" ("+w.de+")":tok;
    });
    return {literal:parts.join(" "),note:"ترجمة حرفية كلمة-بكلمة للمساعدة، وليست ترجمة احترافية."};
  },
  vocabHelp(q){
    const t=q.trim();
    return allWords().find(w=>w.de.toLowerCase()===t.toLowerCase())||allWords().find(w=>(w.ar||"").indexOf(t)>=0&&t.length>1)||null;
  },
  explain(q){
    const t=q.trim().toLowerCase();
    return GRAMMAR.find(g=>(g.title+g.body).toLowerCase().indexOf(t)>=0&&t.length>1)||null;
  },
  examples(q){
    const w=allWords().find(w=>w.de.toLowerCase()===q.trim().toLowerCase());
    if(!w)return [];
    return [{de:w.ex||w.de+".",ar:w.exAr||w.ar}];
  }
};
const TUTOR_CONV=[
{bot:"Hallo! Wie heißt du?",ar:"أهلًا! ما اسمك؟",hint:"أجب: Ich heiße ...",keys:["heiße","heisse","bin"],ok:"ممتاز! تعريف بالنفس واضح. 🎉",no:"حاول: Ich heiße + اسمك."},
{bot:"Woher kommst du?",ar:"من أين أنت؟",hint:"أجب: Ich komme aus ...",keys:["komme","aus"],ok:"رائع! استخدمت aus بشكل صحيح.",no:"حاول: Ich komme aus + بلدك."},
{bot:"Was möchtest du trinken?",ar:"ماذا تريد أن تشرب؟",hint:"أجب: Ich möchte ...",keys:["möchte","will","mag"],ok:"طلب مهذب وجميل! ☕",no:"حاول: Ich möchte + مشروب."}];
function renderTutor(){
  ensureStudy();
  $("tutorBox").innerHTML='<div class="panel glass"><h3>🤖 AI German Tutor (محلي)</h3><div class="muted">مساعد يعمل داخل جهازك. للأوضاع المتقدمة يمكن ربط API لاحقًا بدون مفاتيح في الواجهة.</div>'
  +'<div class="row-flex" id="tutorModes">'+[["correct","تصحيح"],["translate","ترجمة"],["vocab","كلمة"],["conv","محادثة"],["explain","اشرح"],["examples","أمثلة"]].map(m=>'<button class="btn btn-ghost sm" data-tm="'+m[0]+'">'+m[1]+'</button>').join("")+'</div>'
  +'<div class="quiz-write"><input type="text" id="tutorIn" placeholder="اكتب بالألمانية..."><button class="btn btn-primary sm" id="tutorGo">إرسال ➤</button></div>'
  +'<div id="tutorOut"></div><h4>📜 آخر المحادثات</h4><div id="tutorHist"></div></div>';
  let mode="correct";
  $("tutorModes").querySelectorAll("[data-tm]").forEach(b=>b.addEventListener("click",()=>{
    mode=b.getAttribute("data-tm");
    $("tutorModes").querySelectorAll("[data-tm]").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");toast("وضع: "+b.textContent,"ok");
  }));
  const hist=()=>{
    $("tutorHist").innerHTML=S.tutor.hist.slice(-5).reverse().map(h=>'<div class="muted">🧑 '+escapeHtml(h.q)+'<br>🤖 '+escapeHtml(h.a)+'</div>').join("")||'<div class="muted">لا شيء بعد.</div>';
  };
  hist();
  const run=()=>{
    const q=$("tutorIn").value.trim();if(!q)return;
    TutorAPI.ask(mode,q).then(r=>{
      let a="";
      if(mode==="correct"){
        a=(r.ok?"✅ صحيح! ممتاز.":"❌ يحتاج تصحيح.")+"<br>✅ "+escapeHtml(r.corrected)
          +(r.issues.length?"<br>لماذا؟<br>• "+r.issues.map(escapeHtml).join("<br>• "):"")
          +(r.fixes.length?"<br>💡 "+r.fixes.map(escapeHtml).join("<br>💡 "):"");
        if(!r.ok)addXP(2,"tutor");
      }else if(mode==="translate"){a="📝 "+escapeHtml(r.literal)+"<br><span class=muted>"+escapeHtml(r.note)+"</span>";}
      else if(mode==="vocab"){
        const w=r;
        a=w?("📚 "+escapeHtml(fullDe(w))+" = "+escapeHtml(w.ar)+"<br>الجمع: "+escapeHtml(w.plural||"—")+"<br>مثال: "+escapeHtml(w.ex||"—")):"لم أجد الكلمة. جرّب كلمة من القاموس.";
      }
      else if(mode==="conv"){
        const hit=TUTOR_CONV.find(s=>s.keys.some(k=>q.toLowerCase().indexOf(k)>=0));
        a=hit?("✅ "+hit.ok+"<br>التالي: "+TUTOR_CONV[(TUTOR_CONV.indexOf(hit)+1)%TUTOR_CONV.length].bot):("🤖 "+TUTOR_CONV[0].bot+"<br><span class=muted>"+TUTOR_CONV[0].ar+" — "+TUTOR_CONV[0].hint+"</span>");
        addXP(3,"tutor-conv");
      }
      else if(mode==="explain"){
        const g=r;
        a=g?("📐 "+escapeHtml(g.title)+": "+escapeHtml(g.body)+" <button class='btn btn-ghost sm' id='tutorOpenG'>افتح الشرح 📖</button>"):"لم أجد قاعدة مطابقة. جرّب: der، Akkusativ، Plural.";
        setTimeout(()=>{const b=$("tutorOpenG");if(b&&g)b.addEventListener("click",()=>openExplain(g.id));},0);
      }
      else if(mode==="examples"){
        a=r.length?r.map(e=>"🇩🇪 "+escapeHtml(e.de)+"<br>🇪🇬 "+escapeHtml(e.ar)).join("<br>"):"لم أجد أمثلة. جرّب كلمة ألمانية.";
      }
      $("tutorOut").innerHTML='<div class="panel glass">'+a+'</div>';
      S.tutor.hist.push({q:q,a:$("tutorOut").textContent.slice(0,160)});Store.save();hist();
    });
  };
  $("tutorGo").addEventListener("click",run);
  $("tutorIn").addEventListener("keydown",e=>{if(e.key==="Enter")run();});
}
/* ---------- roadmap ---------- */
const ROADMAP=[
{lvl:"A1",units:[
 {t:"المفردات الأساسية",go:"vocab",done:()=>allWords().filter(w=>getStatus(w.id)==="known").length>=50},
 {t:"القواعد الأساسية",go:"explain",done:()=>Object.keys((S.journey&&S.journey.lessons)||{}).length>=10},
 {t:"الاستماع",go:"listen",done:()=>(S.lstats.lok||0)>=5},
 {t:"التحدث",go:"speak",done:()=>(S.lstats.sok||0)>=3},
 {t:"الاختبار النهائي A1",go:"journey",done:()=>!!(S.journey&&S.journey.final&&S.journey.final.A1)}]},
{lvl:"A2",locked:true,units:[]},
{lvl:"B1",locked:true,units:[]}];
function renderRoadmap(){
  ensureStudy();
  let h="";
  ROADMAP.forEach(R=>{
    if(R.locked){h+='<div class="panel glass"><h3>🔒 '+R.lvl+' — Coming in future level</h3><div class="muted">سيُفتح بعد إتمام المستوى السابق.</div></div>';return;}
    const ds=R.units.map(u=>({u:u,ok:u.done()}));
    const doneN=ds.filter(x=>x.ok).length;
    const cur=ds.find(x=>!x.ok);
    h+='<div class="panel glass"><h3>'+R.lvl+' ('+doneN+'/'+ds.length+')</h3><div class="progress"><div class="progress-fill" style="width:'+Math.round(doneN/Math.max(1,ds.length)*100)+'%"></div></div>'
      +ds.map((x,i)=>'<div class="j-stage"><div><b>'+(x.ok?"✅ ":x.u===cur?"🔵 ":"🔒 ")+escapeHtml(x.u.t)+'</b></div><button class="btn btn-ghost sm" data-rgo="'+x.u.go+'">فتح ←</button></div>').join("")+'</div>';
  });
  $("roadmapBox").innerHTML=h;
  $("roadmapBox").querySelectorAll("[data-rgo]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-rgo"))));
}
/* ---------- labs (listening + speaking, A1 content) ---------- */
function renderLabs(){
  ensureStudy();
  $("labsBox").innerHTML='<div class="panel glass"><h3>🧪 المختبر</h3><div class="row-flex"><button class="btn btn-primary sm" data-lab="li">🎧 استماع</button><button class="btn btn-ghost sm" data-lab="sp">🗣️ تحدث</button><span class="tag">A1</span><span class="tag">🔒 A2/B1 قريبًا</span></div><div class="row-flex"><span>السرعة:</span><select id="labSpeed"><option value="0.75">0.75x</option><option value="1" selected>1x</option><option value="1.25">1.25x</option></select></div><div id="labBody"></div></div>';
  $("labsBox").querySelectorAll("[data-lab]").forEach(b=>b.addEventListener("click",()=>labShow(b.getAttribute("data-lab"))));
  labShow("li");
}
function labRate(){try{return parseFloat($("labSpeed").value||"1");}catch(e){return 1;}}
function labShow(which){
  const box=$("labBody");if(!box)return;
  if(which==="sp"){labSpeak(box);return;}
  const pool=shuffle(LISTEN_ITEMS).slice(0,5);
  let i=0,score=0;
  function q(){
    if(i>=pool.length){addXP(15,"lab-listen");Store.save();box.innerHTML='<div class="quiz-feedback ok">انتهى المختبر: '+score+'/'+pool.length+' ⭐+15</div>';return;}
    const it=pool[i],mode=i%3;
    box.innerHTML='<div class="muted">تمرين '+(i+1)+'/'+pool.length+'</div><div class="row-flex"><button class="btn btn-primary sm" id="labHear">🔊 استمع</button></div><div id="labQ"></div><div class="quiz-feedback hidden" id="labFb"></div>';
    $("labHear").addEventListener("click",()=>{try{const r=currentRate();S.settings.speed=labRate();speakGerman(it.de);S.settings.speed=r;}catch(e){speakGerman(it.de);}});
    const qq=$("labQ"),fb=$("labFb");
    const done=(ok,msg)=>{
      fb.classList.remove("hidden");
      if(ok){fb.className="quiz-feedback ok";score++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";const w=findWord(it.w);if(w)recordMistake(w,msg||"","lab-listen");}
      S.totalAnswered++;S.lstats.ln++;if(ok)S.lstats.lok++;Store.save();
      setTimeout(()=>{i++;q();},2000);
    };
    if(mode===0){
      const opts=shuffle([it.ar].concat(shuffle(LISTEN_ITEMS.filter(x=>x!==it)).slice(0,3).map(x=>x.ar)));
      qq.innerHTML='<div class="muted">اختر المعنى:</div><div class="quiz-opts">'+opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
      qq.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        qq.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        const ok=opts[j]===it.ar;
        if(ok)b.classList.add("correct");else{b.classList.add("wrong");qq.querySelectorAll(".quiz-opt")[opts.indexOf(it.ar)].classList.add("correct");}
        fb.classList.remove("hidden");
        if(ok){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+it.de;score++;S.totalCorrect++;}
        else{fb.className="quiz-feedback no";fb.textContent="❌ "+it.de+" = "+it.ar;const w=findWord(it.w);if(w)recordMistake(w,opts[j],"lab-listen");}
        S.totalAnswered++;S.lstats.ln++;if(ok)S.lstats.lok++;Store.save();
        setTimeout(()=>{i++;q();},2000);
      }));
    }else if(mode===1){
      qq.innerHTML='<div class="muted">اكتب ما سمعت:</div><div class="quiz-write"><input type="text" id="labIn" autocomplete="off"><button class="btn btn-primary sm" id="labOk">تحقق ✅</button></div>';
      $("labOk").addEventListener("click",()=>{
        const v=$("labIn").value.trim();
        done(v.toLowerCase()===it.de.toLowerCase(),"");
        if(v.toLowerCase()===it.de.toLowerCase())fb.textContent="صحيح ✅ "+it.de;
        else fb.textContent="❌ الصحيح: "+it.de+" = "+it.ar;
      });
    }else{
      const blank=it.de.replace(/\b(\w+)\b/,(m)=>"___");
      const answer=(it.de.match(/\b\w+\b/)||[""])[0];
      qq.innerHTML='<div class="muted">أكمل: <b style="direction:ltr">'+escapeHtml(blank)+'</b> ('+escapeHtml(it.ar)+')</div><div class="quiz-write"><input type="text" id="labIn" autocomplete="off"><button class="btn btn-primary sm" id="labOk">تحقق ✅</button></div>';
      $("labOk").addEventListener("click",()=>{
        const v=$("labIn").value.trim().toLowerCase();
        done(v===answer.toLowerCase(),"");
        if(v===answer.toLowerCase())fb.textContent="صحيح ✅ "+it.de;
        else fb.textContent="❌ الكلمة: "+answer+" — الجملة: "+it.de;
      });
    }
  }
  q();
}
function labSpeak(box){
  const pool=shuffle(SPEAK_ITEMS).slice(0,4);
  let i=0;
  function q(){
    if(i>=pool.length){addXP(15,"lab-speak");Store.save();box.innerHTML='<div class="quiz-feedback ok">انتهى مختبر التحدث ⭐+15</div>';return;}
    const it=pool[i];
    box.innerHTML='<div class="muted">موضوع '+(i+1)+'/'+pool.length+'</div><h4>'+escapeHtml(it.q)+'</h4><div class="muted">'+escapeHtml(it.ar)+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="labHear">🔊 اسمع</button></div><div class="quiz-write"><input type="text" id="labSpIn" placeholder="تحدث أو اكتب بالألمانية..."><button class="btn btn-primary sm" id="labMic">🎤 تحدث</button><button class="btn btn-gold sm" id="labSpOk">تحقق ✅</button></div><div class="quiz-feedback hidden" id="labSpFb"></div><div class="muted">مثال: '+escapeHtml(it.sample)+'</div>';
    $("labHear").addEventListener("click",()=>speakGerman(it.q));
    const Ctor=(typeof window!=="undefined")&&(window.SpeechRecognition||window.webkitSpeechRecognition);
    $("labMic").addEventListener("click",()=>{
      if(!Ctor){toast("التعرف الصوتي غير مدعوم — اكتب إجابتك ⌨️","err");return;}
      try{
        const r=new Ctor();r.lang="de-DE";r.interimResults=false;
        toast("🎤 تحدث الآن...","ok");
        r.onresult=e=>{const tx=e.results[0][0].transcript;$("labSpIn").value=tx;toast("سمعتك: "+tx,"ok");};
        r.onerror=()=>toast("تعذر السماع — اكتب إجابتك ⌨️","err");
        r.start();
      }catch(e){toast("تعذر تشغيل المايك","err");}
    });
    $("labSpOk").addEventListener("click",()=>{
      const v=$("labSpIn").value.trim(),fb=$("labSpFb");fb.classList.remove("hidden");
      if(v.length<2){fb.className="quiz-feedback no";fb.textContent="اكتب أو قل إجابة أولًا.";return;}
      const ev=(typeof evaluateSpoken==="function")?evaluateSpoken(v,it.sample):null;
      fb.className="quiz-feedback ok";
      fb.textContent="إجابتك: "+v+(ev?(" — تطابق الكلمات: "+ev.vocab+"%"):"")+" ✅";
      S.lstats.sn++;S.lstats.sok++;Store.save();addXP(10,"lab-speak");
      setTimeout(()=>{i++;q();},2200);
    });
  }
  q();
}
/* ---------- interactive branching stories ---------- */
const ISTORIES=[
{id:"bahnhof",t:"🚆 في المحطة",lvl:"A1",nodes:[
 {id:"s",de:"Du bist am Bahnhof. Wohin möchtest du?",ar:"أنت في المحطة. إلى أين تريد؟",choices:[{t:"Ich möchte nach Berlin.",ar:"أريد إلى برلين.",next:"b"},{t:"Ich bin 19 Jahre alt.",ar:"عمري 19.",next:"x1"},{t:"Ich habe einen Bruder.",ar:"لدي أخ.",next:"x1"}]},
 {id:"b",de:"Der Zug fährt um halb acht. Eine Fahrkarte?",ar:"القطار يتحرك 7:30. تذكرة؟",choices:[{t:"Ja, eine Fahrkarte, bitte.",ar:"نعم، تذكرة من فضلك.",next:"e"},{t:"Nein, danke.",ar:"لا، شكرًا.",next:"x2"}]},
 {id:"e",de:"Gute Reise! Der Zug kommt.",ar:"رحلة سعيدة! القطار قادم.",end:"🎉 وصلت! أحسنت.",xp:20},
 {id:"x1",de:"Wie bitte? Wohin möchten Sie?",ar:"عفوًا؟ إلى أين تريد؟",choices:[{t:"Ich möchte nach Berlin.",ar:"أريد إلى برلين.",next:"b"},{t:"Tschüs!",ar:"سلام!",next:"x2"}]},
 {id:"x2",de:"Ok. Tschüs!",ar:"حسنًا. سلام!",end:"انتهت المحادثة. حاول مجددًا!",xp:2}]},
{id:"restaurant",t:"🍔 في المطعم",lvl:"A1",nodes:[
 {id:"s",de:"Guten Tag! Was möchten Sie bestellen?",ar:"نهارك سعيد! ماذا تريد أن تطلب؟",choices:[{t:"Ich möchte eine Pizza.",ar:"أريد بيتزا.",next:"b"},{t:"Ich wohne in Berlin.",ar:"أسكن في برلين.",next:"x1"},{t:"Heute ist Montag.",ar:"اليوم الاثنين.",next:"x1"}]},
 {id:"b",de:"Sonst noch etwas?",ar:"شيء آخر؟",choices:[{t:"Nein, danke. Zahlen, bitte.",ar:"لا، شكرًا. الحساب من فضلك.",next:"e"},{t:"Ja, ein Auto.",ar:"نعم، سيارة.",next:"x1"}]},
 {id:"e",de:"Das macht 12 Euro. Guten Appetit!",ar:"الحساب 12 يورو. بالهناء!",end:"🎉 وجبة سعيدة!",xp:20},
 {id:"x1",de:"Wie bitte?",ar:"عفوًا؟",choices:[{t:"Ich möchte eine Pizza.",ar:"أريد بيتزا.",next:"b"},{t:"Tschüs!",ar:"سلام!",next:"x2"}]},
 {id:"x2",de:"Ok. Tschüs!",ar:"حسنًا. سلام!",end:"انتهت المحادثة. حاول مجددًا!",xp:2}]}];
function renderIStories(){
  ensureStudy();
  let h='<div class="panel glass"><h3>🎭 قصص تفاعلية — قراراتك تغيّر الأحداث</h3></div><div class="grid-2">'+ISTORIES.map(s=>'<div class="panel glass"><h4>'+s.t+'</h4><div class="muted">'+s.lvl+'</div><button class="btn btn-primary sm" data-ist="'+s.id+'">ابدأ ▶️</button></div>').join("")+'</div><div id="istBox"></div>';
  const host=$("istoriesBox")||$("storiesBox");
  const wrap=document.createElement("div");wrap.innerHTML=h;
  ($("storiesBox")||$("istoriesBox")).appendChild(wrap);
  wrap.querySelectorAll("[data-ist]").forEach(b=>b.addEventListener("click",()=>playIstory(b.getAttribute("data-ist"))));
}
function playIstory(id){
  const s=ISTORIES.find(x=>x.id===id);if(!s)return;
  const box=$("istBox")||$("storiesBox");
  let score=0,done=0;
  function node(nid){
    const n=s.nodes.find(x=>x.id===nid);
    if(n.end){
      addXP(n.xp||10,"istory");Store.save();
      box.innerHTML='<div class="quiz-feedback ok">'+escapeHtml(n.end)+'<br>⭐+'+(n.xp||10)+'</div>';return;
    }
    const sh=shuffle(n.choices.map((c,i)=>i));
    const opts=sh.map(i=>n.choices[i]);
    box.innerHTML='<div class="panel glass"><div class="ex-de-l">🧑‍✈️ '+escapeHtml(n.de)+' <button class="mini-btn" id="istHear">🔊</button></div><div class="ex-ar">'+escapeHtml(n.ar)+'</div><div class="quiz-opts">'+opts.map((c,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(c.t)+'<br><span class=muted>'+escapeHtml(c.ar)+'</span></button>').join("")+'</div></div>';
    $("istHear").addEventListener("click",()=>speakGerman(n.de));
    setTimeout(()=>speakGerman(n.de),300);
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      done++;if(opts[j].next&&!opts[j].next.startsWith("x")){score++;S.totalCorrect++;}
      S.totalAnswered++;Store.save();
      node(opts[j].next);
    }));
  }
  node("s");box.scrollIntoView({behavior:"smooth"});
}
/* ---------- grammar lab ---------- */
function renderGLab(){
  ensureStudy();
  $("glabBox").innerHTML='<div class="panel glass"><h3>🧪 مختبر القواعد</h3><div class="muted">اختر موضوعًا: شرح + تدريب + اختبار.</div><div class="grid-2" id="glabGrid"></div><div id="glabBody"></div></div>';
  $("glabGrid").innerHTML=GRAMMAR.map(g=>'<button class="quick-btn" data-gg="'+g.id+'">📐 '+escapeHtml(g.title)+'</button>').join("");
  $("glabGrid").querySelectorAll("[data-gg]").forEach(b=>b.addEventListener("click",()=>openGLab(b.getAttribute("data-gg"))));
}
function glShuffle(a){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=x[i];x[i]=x[j];x[j]=t;}return x;}
function openGLab(id){
  const g=GRAMMAR.find(x=>x.id===id);if(!g)return;
  const box=$("glabBody");
  const B=(typeof GLAB_BANK!=="undefined"&&GLAB_BANK[id])?GLAB_BANK[id]:null;
  let qs,examplesHtml;
  if(B){
    examplesHtml='<h4>'+escapeHtml(t("gl_examples"))+'</h4>'+B.examples.map(function(e){return '<div class="grammar-ex"><div style="direction:ltr;text-align:left;font-weight:800">'+escapeHtml(e[0])+'</div><div style="color:var(--gold)">'+escapeHtml(e[1])+'</div></div>';}).join("");
    qs=B.questions.map(function(q){return {t:q.t,ar:q.ar||"",type:q.type||"choice",opts:(q.opts||[]).slice(),correct:q.correct,words:(q.words||[]).slice(),why:q.why||""};});
  }else{
    examplesHtml="";
    qs=[{t:g.quiz.q,ar:"",type:"choice",opts:g.quiz.opts.slice(),correct:g.quiz.correct,why:g.quiz.explain}];
  }
  let i=0,score=0;const results=[];
  box.innerHTML='<div class="panel glass"><h4>📐 '+escapeHtml(g.title)+'</h4><div class="muted">'+escapeHtml(g.body)+'</div>'
    +examplesHtml
    +'<div class="row-flex"><button class="btn btn-ghost sm" id="glFull">الشرح الكامل 📖</button></div><div id="glQ"></div></div>';
  $("glFull").addEventListener("click",function(){openExplain(id);});
  const qb=$("glQ");
  function renderQ(){
    const it=qs[i];
    if(!it){finish();return;}
    const head='<div class="muted">'+escapeHtml(t("gl_qof").split("{i}").join(String(i+1)).split("{n}").join(String(qs.length)))+'</div><h4>'+escapeHtml(it.t)+'</h4>'
      +(it.ar?'<div class="muted">'+escapeHtml(it.ar)+'</div>':"");
    if(it.type==="order"){
      const sh=glShuffle(it.words.map(function(w,k){return k;}));
      qb.innerHTML=head+'<div class="quiz-opts" id="glChips">'+sh.map(function(k){return '<button class="quiz-opt" data-k="'+k+'">'+escapeHtml(it.words[k])+'</button>';}).join("")+'</div>'
        +'<div class="quiz-opts" id="glAns" style="min-height:52px;border:1px dashed var(--border);border-radius:12px"></div>'
        +'<div class="quiz-feedback hidden" id="glFb"></div>'
        +'<div class="row-flex"><button class="btn btn-gold sm" id="glCheck">'+escapeHtml(t("gl_check"))+'</button><button class="btn btn-ghost sm" id="glClear">'+escapeHtml(t("gl_clear"))+'</button></div>';
      const picked=[];
      qb.querySelectorAll("#glChips .quiz-opt").forEach(function(b){
        b.addEventListener("click",function(){
          if(b.disabled)return;b.disabled=true;
          const k=parseInt(b.getAttribute("data-k"),10);
          picked.push(k);
          const a=$("glAns");const s=document.createElement("button");s.className="quiz-opt";s.textContent=b.textContent;
          s.addEventListener("click",function(){
            try{a.removeChild(s);}catch(e){}
            const ix=picked.indexOf(k);if(ix>=0)picked.splice(ix,1);
            b.disabled=false;
          });
          a.appendChild(s);
        });
      });
      $("glClear").addEventListener("click",function(){picked.length=0;$("glAns").innerHTML="";qb.querySelectorAll("#glChips .quiz-opt").forEach(function(x){x.disabled=false;});});
      $("glCheck").addEventListener("click",function(){
        const ok=picked.length===it.words.length&&picked.every(function(v,ix){return v===ix;});
        grade(ok,picked.map(function(k){return it.words[k];}).join(" "),it.words.join(" "));
      });
    }else{
      qb.innerHTML=head+'<div class="quiz-opts">'+it.opts.map(function(o,j){return '<button class="quiz-opt" data-j="'+j+'" dir="auto">'+escapeHtml(o)+'</button>';}).join("")+'</div><div class="quiz-feedback hidden" id="glFb"></div>';
      qb.querySelectorAll(".quiz-opt").forEach(function(b){
        b.addEventListener("click",function(){
          const j=parseInt(b.getAttribute("data-j"),10);
          qb.querySelectorAll(".quiz-opt").forEach(function(x){x.disabled=true;});
          if(j===it.correct)b.classList.add("correct");
          else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[it.correct].classList.add("correct");}
          grade(j===it.correct,it.opts[j],it.opts[it.correct]);
        });
      });
    }
  }
  function grade(ok,pickedStr,correctStr){
    const it=qs[i];
    qb.querySelectorAll(".quiz-opt").forEach(function(x){x.disabled=true;});
    const gc=$("glCheck");if(gc)gc.disabled=true;
    const fb=$("glFb");fb.classList.remove("hidden");
    if(ok){fb.className="quiz-feedback ok";fb.textContent=t("sx_correct")+" "+it.why;score++;try{S.totalCorrect++;}catch(e){}}
    else{fb.className="quiz-feedback no";
      fb.innerHTML=escapeHtml(t("sx_wrong"))+" "+escapeHtml(t("sx_yourans"))+"<b>"+escapeHtml(pickedStr)+"</b> • "+escapeHtml(t("sx_correctans"))+"<b style='color:var(--green)'>"+escapeHtml(correctStr)+"</b><br><span class='muted'>"+escapeHtml(it.why)+"</span>";
      try{S.gweak=S.gweak||{};S.gweak[id]=(S.gweak[id]||0)+1;}catch(e){}}
    try{S.totalAnswered++;}catch(e){}
    try{Store.save();}catch(e){}
    results.push({ok:ok,picked:pickedStr,correct:correctStr,t:it.t,why:it.why});
    const nx=document.createElement("button");nx.className="btn btn-primary sm";nx.textContent=t("gl_next");
    fb.appendChild(document.createElement("br"));fb.appendChild(nx);
    nx.addEventListener("click",function(){i++;renderQ();});
  }
  function finish(){
    const total=qs.length,pct=total?Math.round(score/total*100):0;
    try{
      if(pct>=60&&typeof completeLesson==="function")completeLesson(id);
      addXP(10,"glab");markStudyDay();Store.save();
    }catch(e){}
    const wrongs=results.filter(function(r){return !r.ok;});
    const rows=wrongs.length?wrongs.map(function(r){
      return '<div class="mist-err">❌ <b>'+escapeHtml(r.t)+'</b><br>'+escapeHtml(t("sx_yourans"))+"<b>"+escapeHtml(r.picked)+"</b> | "+escapeHtml(t("sx_correctans"))+'<b style="color:var(--green)">'+escapeHtml(r.correct)+"</b><br><span class='muted'>"+escapeHtml(r.why)+"</span></div>";
    }).join(""):'<div class="muted">'+escapeHtml(t("sx_noerr"))+'</div>';
    const extra=(B?B.examples.slice(0,2):g.ex.slice(0,2)).map(function(e){return '<div class="muted">📚 <b dir="ltr">'+escapeHtml(e[0])+'</b> — '+escapeHtml(e[1])+'</div>';}).join("");
    qb.innerHTML='<div class="panel glass" style="text-align:center"><h3>'+escapeHtml(t("gl_result"))+': '+escapeHtml(g.title)+'</h3>'
      +'<div class="stat-num" style="font-size:44px">'+score+' / '+total+'</div>'
      +'<div class="stat-num" style="font-size:28px">'+pct+'%</div>'
      +'<div class="progress" style="margin:10px 0"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
      +'<h4>'+escapeHtml(t("gl_errs"))+' ('+wrongs.length+')</h4>'+rows
      +'<h4>'+escapeHtml(t("gl_recap"))+'</h4><div class="muted">'+escapeHtml(g.body)+'</div>'+extra
      +'<div class="row-flex" style="justify-content:center;margin-top:12px"><button class="btn btn-primary sm" id="glAgain">'+escapeHtml(t("gl_again"))+'</button>'
      +'<button class="btn btn-ghost sm" id="glBackRules">'+escapeHtml(t("gl_back"))+'</button></div></div>';
    $("glAgain").addEventListener("click",function(){openGLab(id);});
    $("glBackRules").addEventListener("click",function(){showPage("grammar");});
    try{if(typeof renderAll==="function")renderAll();}catch(e){}
    box.scrollIntoView({behavior:"smooth"});
  }
  renderQ();box.scrollIntoView({behavior:"smooth"});
}

/* ---------- profile ---------- */
function renderProfile(){
  ensureLearn();
  const words=allWords(),known=words.filter(w=>getStatus(w.id)==="known").length;
  const L=levelFor(S.xp||0);
  const ds=achDefs(),got=ds.filter(a=>S.ach[a.id]).length;
  $("profileBox").innerHTML='<div class="panel glass" style="text-align:center"><div style="font-size:64px">'+S.avatar.face+'</div><h3>'+escapeHtml(S.avatar.title||"طالب ألماني")+'</h3><div class="muted">المستوى '+L.lvl+' • '+L.name+'</div><h4>اختر صورتك:</h4><div class="row-flex" style="justify-content:center">'+AV_FACES.map(f=>'<button class="icon-btn" data-pav="'+f+'">'+f+'</button>').join("")+'</div></div>'
  +'<div class="grid-2"><div class="panel glass"><h3>📊 إحصائياتي</h3><div class="muted">⭐ XP: '+(S.xp||0)+'<br>🔥 Streak: '+(S.streak.count||0)+'<br>📚 كلمات: '+known+'/'+words.length+'<br>🏆 إنجازات: '+got+'/'+ds.length+'<br>📝 اختبارات: '+(S.testsTaken||0)+'</div></div>'
  +'<div class="panel glass"><h3>🏆 أحدث الإنجازات</h3>'+ds.filter(a=>S.ach[a.id]).slice(-4).map(a=>'<div class="muted">🏆 '+escapeHtml(a.t)+'</div>').join("")+'</div></div>';
  $("profileBox").querySelectorAll("[data-pav]").forEach(b=>b.addEventListener("click",()=>{S.avatar.face=b.getAttribute("data-pav");Store.save();renderProfile();toast("تم 👍","ok");}));
}
/* ---------- analytics ---------- */
function skillStats(){
  const w=allWords();
  const vocab={n:w.length,ok:w.filter(x=>getStatus(x.id)==="known").length};
  const gram={n:GRAMMAR.length,ok:Object.keys((S.journey&&S.journey.lessons)||{}).length};
  const li={n:(S.lstats.ln||0),ok:(S.lstats.lok||0)};
  const sp={n:(S.lstats.sn||0),ok:(S.lstats.sok||0)};
  const rd={n:SENTENCES.length,ok:0};
  const wr={n:0,ok:0};
  const rv={n:Object.keys(S.review||{}).length,ok:Object.keys(S.review||{}).filter(k=>getStatus(k)==="known").length};
  return {vocab:vocab,gram:gram,li:li,sp:sp,rd:rd,wr:wr,rv:rv};
}
function renderAnalytics(){
  ensureLearn();
  const s=skillStats();
  const row=(t,v,col)=>'<div class="stat-bar-row"><span class="lbl">'+t+'</span><div class="bar"><div class="fill" style="width:'+Math.round(v.ok/Math.max(1,v.n)*100)+'%;background:'+col+'"></div></div><b>'+v.ok+'/'+v.n+'</b></div>';
  const weak=weakAreas();
  $("analyticsBox").innerHTML='<div class="panel glass"><h3>📈 تقدمي</h3>'
  +row("📚 مفردات",s.vocab,"linear-gradient(90deg,#7c3aed,#00d4ff)")
  +row("📐 قواعد",s.gram,"linear-gradient(90deg,#059669,#34d399)")
  +row("🎧 استماع",s.li,"linear-gradient(90deg,#0284c7,#38bdf8)")
  +row("🗣️ تحدث",s.sp,"linear-gradient(90deg,#b45309,#fbbf24)")
  +row("📖 قراءة",{n:s.rd.n,ok:Math.min(s.rd.n,Math.round(s.vocab.ok/10))},"linear-gradient(90deg,#6d28d9,#c084fc)")
  +row("🔄 مراجعة",s.rv,"linear-gradient(90deg,#be123c,#fb7185)")
  +'<h3>🎯 تحتاج تحسين</h3>'+(weak.length?weak.map(x=>'<div class="muted">'+x.lvl+' '+escapeHtml(x.k)+' ('+x.n+')</div>').join(""):'<div class="muted">🟢 كل المجالات قوية!</div>')
  +'</div>';
}
/* ---------- wiring ---------- */
const STUDY_PAGES={tutor:renderTutor,roadmap:renderRoadmap,labs:renderLabs,profile:renderProfile,analytics:renderAnalytics};
(function(){
  try{
    const _sp=showPage;
    showPage=function(n){
      _sp(n);
      try{applyLang();}catch(e){}
      try{
        if(STUDY_PAGES[n])STUDY_PAGES[n]();
        if(n==="stories")renderIStories();
        if(n==="grammar")renderGLabPanel();
        if(n==="review")renderReviewPanel();
        if(n==="dashboard"){renderStudyDash();renderNotifBell();applyLang();}
        if(n==="settings")applyLang();
      }catch(e){console.error(e);}
      try{if(S){S.lastActivity=S.lastActivity||{};S.lastActivity={go:n,t:document.querySelector('[data-page="'+n+'"]')?document.querySelector('[data-page="'+n+'"]').textContent.trim().slice(0,20):n};Store.save();}}catch(e){}
    };
    const _rd=renderDashboard;
    renderDashboard=function(){_rd();try{renderStudyDash();}catch(e){}};
    ensureStudy();ensureLearn();
    try{
      const ls=$("langSel");
      if(ls){ls.value=S.uiLang||"ar";ls.addEventListener("change",()=>{S.uiLang=ls.value;Store.save();applyLang();toast(ls.value==="de"?t("toast_de"):(ls.value==="en"?t("toast_en"):t("toast_ar")),"ok");});}
      initHeaderLang();
      applyLang();renderNotifBell();
    }catch(e){}
  }catch(e){console.error(e);}
})();
function renderGLabPanel(){
  try{
    if($("glabHost"))return;
    const list=document.querySelector(".grammar-list")||$("grammarList");
    if(!list)return;
    const d=document.createElement("div");d.id="glabHost";d.className="panel glass";
    d.innerHTML='<div class="row-flex"><button class="btn btn-ghost sm" id="gramSearchBtn" data-i18n="gram_search_btn">🔎 بحث عن قاعدة</button>'
      +'<button class="btn btn-ghost sm" id="gramLabBtn" data-i18n="gram_lab_btn">🧪 مختبر القواعد</button></div>'
      +'<div id="gramSearchBox" class="hidden"><div class="quiz-write"><input type="text" id="gramSearchIn" data-i18n-ph="gram_search_ph" placeholder="ابحث: Akkusativ / Artikel / sein..." autocomplete="off"><button class="btn btn-primary sm" id="gramSearchGo">🔎</button></div><div id="gramSearchRes"></div></div>'
      +'<div id="gramLabWrap" class="hidden"><div id="glabBox"></div><div class="row-flex"><button class="btn btn-ghost sm" id="gramLabClose" data-i18n="gram_lab_close">✖ إغلاق والعودة للشرح</button></div></div>';
    list.parentNode.insertBefore(d,list);
    let labBuilt=false;
    $("gramSearchBtn").addEventListener("click",()=>{
      const b=$("gramSearchBox");if(!b)return;
      b.classList.toggle("hidden");
      if(!b.classList.contains("hidden")){const inp=$("gramSearchIn");if(inp)inp.focus();}
    });
    const run=()=>gramRunSearch(($("gramSearchIn")||{}).value||"");
    $("gramSearchIn").addEventListener("input",run);
    $("gramSearchGo").addEventListener("click",run);
    $("gramLabBtn").addEventListener("click",()=>{
      const w=$("gramLabWrap");if(!w)return;
      if(w.classList.contains("hidden")){
        if(!labBuilt){try{renderGLab();}catch(e){}labBuilt=true;}
        w.classList.remove("hidden");w.scrollIntoView({behavior:"smooth"});
      }else{
        w.classList.add("hidden");
        const l=document.querySelector(".grammar-list")||$("grammarList");
        if(l)l.scrollIntoView({behavior:"smooth"});
      }
    });
    $("gramLabClose").addEventListener("click",()=>{
      const w=$("gramLabWrap");if(w)w.classList.add("hidden");
      const l=document.querySelector(".grammar-list")||$("grammarList");
      if(l)l.scrollIntoView({behavior:"smooth"});
    });
  }catch(e){}
}
function gramHay(g){
  try{
    const parts=[g.title,g.body,(g.ex||[]).map(e=>(e[0]||"")+" "+(e[1]||"")).join(" "),
      g.quiz?(g.quiz.q+" "+(g.quiz.opts||[]).join(" ")+" "+g.quiz.explain):""];
    try{
      const E=(typeof EXPLAIN!=="undefined"&&EXPLAIN[g.id])?EXPLAIN[g.id]:null;
      if(E)parts.push(JSON.stringify(E));
    }catch(_){}
    return parts.join(" ").toLowerCase();
  }catch(e){return "";}
}
function gramRunSearch(q){
  try{
    const box=$("gramSearchRes");if(!box)return;
    q=String(q||"").trim().toLowerCase();
    if(q.length<2){box.innerHTML="";return;}
    const hits=GRAMMAR.filter(g=>gramHay(g).indexOf(q)>=0).slice(0,20);
    if(!hits.length){box.innerHTML='<div class="muted">'+escapeHtml(t("gram_noresults"))+'</div>';return;}
    box.innerHTML=hits.map(g=>'<div class="j-stage"><div><b>📐 '+escapeHtml(g.title)+'</b><div class="muted">'+escapeHtml(String(g.body||"").slice(0,90))+'…</div></div><button class="btn btn-ghost sm" data-gopen="'+g.id+'">'+escapeHtml(t("gram_open"))+'</button></div>').join("");
    box.querySelectorAll("[data-gopen]").forEach(b=>b.addEventListener("click",()=>{
      try{openExplain(b.getAttribute("data-gopen"));}catch(e){}
    }));
  }catch(e){}
}
function renderReviewPanel(){
  try{
    if($("srsHost"))return;
    const due=srsDue();
    const anchor=$("dueGrid")||$("reviewLevels");
    if(!anchor)return;
    const d=document.createElement("div");d.id="srsHost";d.className="panel glass";
    d.innerHTML='<h3>🧠 مراجعة اليوم ('+due.length+')</h3><div class="muted">مرتبة ذكيًا: الأكثر خطأ أولًا.</div><div class="row-flex"><button class="btn btn-primary sm" id="srsGo">ابدأ المراجعة 🚀</button></div>';
    anchor.parentNode.insertBefore(d,anchor);
    $("srsGo").addEventListener("click",()=>{due.slice(0,10).forEach(w=>{if(getStatus(w.id)==="new")setStatus(w.id,"review");});Store.save();toast("أُضيفت "+Math.min(10,due.length)+" كلمات للمراجعة","ok");showPage("review");});
  }catch(e){}
}
