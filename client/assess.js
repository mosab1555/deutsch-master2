/* ============================================================================
   Deutsch Master — Assessment & Testing Center (مركز الاختبارات والتقييم)
   ----------------------------------------------------------------------------
   ADDITIVE module. Extends the existing Tests page (page-quiz) into a full
   assessment center. Reuses (never duplicates):
     - content: allWords()/VOCAB, GRAMMAR, GLAB_BANK, SENTENCES, SENT_FILL,
       CURR_READING, LISTEN_ITEMS, SPEAK_ITEMS, TALK_SITS, REAL_SITS, KAPITEL
     - progress: S (localStorage deutsch_master_v2), save(), recordMistake(),
       noteMastered(), gramRecord(), addXP(), DMProgress.logAttempt(),
       S.quizHistory / S.testsTaken / S.place / S.journey.final
     - router: showPage() (+ DMPageState.skipRender respect), existing CSS
       classes (panel/glass/quiz-opt/quiz-feedback/progress/btn/row-flex).
   The legacy quiz engine in script.js (quizType/startQuizRun/...) is left
   100% intact: all its DOM ids and buttons keep working (runtime-qa safe).

   Design thresholds (single place to tune, all documented):
     PASS_A1_EXAM      = 70   overall % to pass the A1 comprehensive exam
     STAGE_PASS        = 70   % to advance to the next placement stage
     KAP_READY         = 70   readiness % => Kapitel counts as done
     KAP_MASTERED      = 85   readiness % => Kapitel shown as mastered ✓
     STRONG_SKILL      = 80   skill % => "قوي"
     GOOD_SKILL        = 65   skill % => "جيد"
     WEAK_SKILL        = 40   below => "يحتاج مراجعة"
     MIN_SKILL_N       = 3    min answers in a skill before a verdict is given
     MIN_OVERALL_N     = 8    min answers before an overall verdict is given
     CONF_HIGH_N       = 20   answers needed for high confidence
     CONF_MED_N        = 10   answers needed for medium confidence
     TEST_W_KAP        = 0.65 weight of live-test evidence in Kapitel readiness
     PROG_W_KAP        = 0.35 weight of accumulated progress in readiness
     MIN_KAP_TEST_N    = 4    min test answers in a Kapitel to trust test data
     HISTORY_CAP       = 30   stored assessment results (ring buffer)
     RESUME_TTL_DAYS   = 7    stale in-progress sessions are discarded safely
     EXAM_TIME_SEC     = 1200 default timer for the full A1 exam (20 min)
     LVL_GATE_WORDS    = 40   min words of a level to unlock its level exam
     LVL_GATE_GRAMMAR  = 4    min grammar topics of a level to unlock its exam
   Anti-luck: level/Kapitel/mastery verdicts always carry an evidence count
   and a confidence label; with too little data the UI says so honestly
   ("النتيجة غير حاسمة — نحتاج أسئلة إضافية") instead of guessing.
   ========================================================================== */
"use strict";
/* ---------- interface language keys (same I18N system; merged additively) ---------- */
try{
Object.assign(I18N.ar,{as_sk_vocab:"الكلمات",as_sk_grammar:"القواعد",as_sk_sentences:"الجمل",as_sk_reading:"القراءة",as_sk_listening:"الاستماع",as_sk_writing:"الكتابة",as_sk_speaking:"التحدث",as_sk_practical:"المواقف",as_sk_words:"الكلمات",as_sk_ordering:"ترتيب الجملة",as_sk_verbs:"الأفعال",as_sk_articles:"المقالات",as_sk_plural:"الجمع",as_sk_translate:"الترجمة",as_sk_reallife:"المواقف",as_sk_mistakes:"أخطائي",as_sk_tfquiz:"صح أم خطأ",as_ev_nodata:"بيانات غير كافية",as_ev_strong:"قوي",as_ev_good:"جيد",as_ev_weak:"يحتاج مراجعة",as_ev_poor:"ضعيف — ابدأ من هنا",as_ev_nodata2:"لا بيانات",as_conf_high:"أسئلة كافية وتغطية متوازنة للمهارات",as_conf_med:"عدد أسئلة معقول لكن التغطية جزئية",as_conf_low_few:"أسئلة قليلة جدًا — النتيجة استرشادية",as_conf_low_cov:"تغطية المهارات محدودة",as_note_inconclusive:"النتيجة غير حاسمة — نحتاج أسئلة إضافية",as_note_start:"ابدأ من التأسيس (A1 من الصفر)",as_q_meaning:"ما معنى: ",as_q_mark:"؟",as_q_article:"اختر الأداة الصحيحة: ___ ",as_q_article_why:"تُحفظ الأداة مع الاسم دائمًا.",as_q_plural:"ما جمع: ",as_q_plural_why:"الجمع: ",as_q_translate:"اختر الكلمة الألمانية الصحيحة: ",as_q_tf:"صح أم خطأ: ",as_q_true:"صح ✅",as_q_false:"خطأ ❌",as_q_conj:"اختر التصريف الصحيح: ",as_q_conj_mid:" ___",as_q_fix:"الجملة فيها خطأ: «",as_q_fix_mid:"» — اختر التصحيح الصحيح:",as_q_order:"🔀 رتّب الكلمات لتكوين جملة صحيحة (",as_q_order_end:"):",as_q_order_why:"الجملة الصحيحة: ",as_q_complete:"🧩 أكمل: ",as_q_answer:"الإجابة: ",as_q_write:"✍️ اكتب الكلمة الناقصة: ",as_q_read:"📖 اقرأ ثم اختر المعنى الصحيح:",as_q_read_why:"الإجابة من النص: ",as_q_listen:"🎧 استمع واختر المعنى الصحيح:",as_q_speak:"🎤 أجب بالألمانية: ",as_q_speak_why:"مثال إجابة: ",as_q_sit:" — ما أفضل رد؟",as_q_sit_why:"أفضل رد: ",as_q_dialog:" — ماذا تقول بالألمانية؟",as_q_match:"🔗 وصّل كل كلمة بمعناها:",as_q_neg:"اختر النفي الصحيح: ",as_q_neg_verb:"nicht تنفي الفعل/الجملة: Ich lerne heute nicht.",as_q_neg_noun:"قبل الأسماء نستخدم kein/keine (وليس nicht): ",as_q_conj_all:"⚡ صرّف الفعل (",as_q_conj_all_mid:") مع كل ضمير:",as_q_wclass:"ما نوع الكلمة: ",as_q_wclass_mid:"؟",as_q_wclass_is:" نوعها: ",as_q_sentmean:"💬 ما معنى الجملة: «",as_q_sentmean_end:"»؟",as_q_gap_listen:"🎧 استمع للجملة واختر الكلمة الناقصة: ",as_q_sent_why:"الجملة: ",as_q_hear:"سمعت: ",as_q_match_hint:"اختر كلمة ألمانية ثم معناها بالعربية.",as_q_match_hint_en:"اختر كلمة ألمانية ثم معناها.",as_q_choose_de_first:"اختر الكلمة الألمانية أولًا",as_q_not_right:"❌ ليس المعنى الصحيح — حاول مجددًا",as_q_saved:"💾 تم حفظ تقدمك — يمكنك الاستكمال لاحقًا من المركز",as_q_no_sr:"التعرف الصوتي غير مدعوم — اكتب إجابتك ⌨️",as_q_speak_now:"🎤 تحدث الآن...",as_q_heard:"سمعتك: ",as_q_no_hear:"تعذر السماع — اكتب إجابتك ⌨️",as_q_no_mic:"تعذر تشغيل المايك",as_q_answer_first:"أجب أولًا ✍️",as_q_combo:"🔥 كومبو x",as_q_combo_xp:" — ⭐+5",as_q_perfect:"🏆 Perfect Round! خمس إجابات صحيحة متتالية ⭐+10",as_q_stageup:"🎉 أحسنت! انتقلت للمرحلة ",as_q_fb_ok:"صحيح ✅ ",as_q_fb_no:"❌ ",as_q_fb_right:"الصحيح: ",as_q_no_answer:"— (بدون إجابة)",as_q_timeout:"— (انتهى الوقت)",as_q_time_up:"⏱️ انتهى الوقت — يتم تسليم الاختبار تلقائيًا",as_q_time_q:"⏱️ انتهى وقت السؤال!",as_q_mode_train:"🟢 تدريب",as_q_mode_chal:"🟡 تحدي",as_q_mode_exam:"🔴 امتحان",as_q_mode_test:"🔵 اختبار",as_q_stage:"المرحلة ",as_q_stage_level:" (مستوى ",as_q_stage_close:")",as_q_stage_a:"المرحلة A (مستوى A1) — أجب بتركيز، الصعوبة تتكيف مع مستواك",as_q_quit:"إنهاء وحفظ ✖",as_q_hearbtn:"🔊 استمع",as_q_prev:"⏮ السابق",as_q_submit:"تحقق ✅",as_q_next:"التالي ⏭",as_q_match_auto:"💡 أكمل التوصيل — يتم التقييم تلقائيًا عند الانتهاء.",as_q_lock_hint:"💡 أجب ثم اضغط «تحقق». الإجابة المثبتة لا يمكن تغييرها — مثل الامتحان الحقيقي.",as_q_clear:"مسح 🗑️",as_q_write_ph:"اكتب إجابتك...",as_q_sample:"مثال: ",as_q_no_sr2:" (التعرف الصوتي غير مدعوم في متصفحك — اكتب إجابتك ⌨️)",as_q_mic:"🎤 تحدث",as_q_match_locked:"توصيل (",as_q_match_of:"/",as_q_match_err:", أخطاء: ",as_q_match_end:")",as_q_wordclass_of:"فعل Verb",as_q_wordclass_n:"اسم Nomen",as_q_wordclass_a:"صفة Adjektiv",as_c_head:"🎯 مركز الاختبارات والتقييم",as_c_sub:"هنا تعرف مستواك الحقيقي، والـ Kapitel الذي أنت فيه، ونقاط ضعفك، وماذا تذاكر الآن.",as_c_level:"مستواك الحالي",as_c_level_none:"حدد مستواك أولًا",as_c_kap:"Kapitel الحالي",as_c_kap_start:"ابدأ أول تقييم",as_c_kap_next:"قريب من ",as_c_kap_adv:"متقدم 🎉",as_c_mastery:"الإتقان",as_c_mastery_avg:"متوسط آخر ",as_c_mastery_q:" اختبارات",as_c_mastery_none:"لا اختبارات بعد",as_c_last:"آخر اختبار",as_c_last_go:"ابدأ الآن 🚀",as_c_best:"أفضل نتيجة",as_c_best_n:" اختبارات محلولة",as_c_best_0:"0 اختبارات",as_c_acc:"دقة الإجابات",as_c_acc_n:" إجابة مسجلة",as_c_acc_go:"أجب لتظهر دقتك",as_c_strong:"💪 القوية:",as_c_weak:"⚠️ الضعيفة:",as_c_place_h:"🎯 اختبار تحديد المستوى",as_c_dur:"⚡ حسب المدة",as_c_quick8:"اختبار سريع (8)",as_c_mid16:"اختبار متوسط (16)",as_c_full30:"اختبار شامل (30)",as_c_kap_h:"📖 اختبارات Kapitel",as_c_skill_h:"🧠 اختبارات المهارات",as_c_exam_h:"🏁 الامتحانات الشاملة",as_c_exam:"امتحان",as_c_exam_full:"الشامل",as_c_exam_pass:"النجاح من ",as_c_exam_timed:" — بتوقيت ⏱️",as_c_exam_avail:"محتوى ",as_c_exam_avail2:" متاح (",as_c_exam_words:" كلمة).",as_c_exam_prep:"المحتوى قيد التجهيز (",as_c_exam_rules:" قواعد)",as_c_exam_soon:" — سيُفتح عند اكتمال المحتوى.",as_c_exam_load:"⬇️ تحميل محتوى ",as_c_exam_note:"امتحانات Deutsch Master الداخلية — ليست شهادات رسمية (ليست Goethe).",as_c_map:"🗺️ خريطة الـ Kapitel",as_c_map_hint:"اضغط على أي Kapitel لاختباره أو مراجعته.",as_c_prog:"📈 تقدمك عبر الوقت",as_c_hist:"📜 سجل الاختبارات (",as_c_hist_close:")",as_c_hist_none:"لم تحل أي تقييم بعد — ابدأ بتحديد المستوى! 🚀",as_c_legacy_h:"📝 الاختبارات السريعة",as_c_legacy_sub:"تدريب سريع بالنظام السابق (أدوات، معاني، جمع، استماع...).",as_c_boss_locked:"🔒 اختبار الـ Kapitel مقفل — ",as_c_placement:"اختبار تحديد المستوى",as_c_kap_test:"اختبار ",as_c_exam_a1:"امتحان A1 الشامل — Deutsch Master",as_c_exam_lv:"امتحان ",as_c_exam_lv2:" الشامل — Deutsch Master",as_c_quick:"اختبار سريع",as_c_medium:"اختبار متوسط",as_c_full:"اختبار شامل",as_c_test_q:" سؤالًا",as_c_mine:"اختباري الخاص (",as_c_mine_mid:" • ",as_c_mine_cats:" فئات)",as_c_mistakes_me:"اختبرني في أخطائي",as_c_challenge:"تحدي اليوم 🎯",as_c_boss:"اختبار الزعيم 👑 • ",as_c_cumul:"اختبار تراكمي 📚 (",as_c_cumul_all:"الكل",as_c_smart:"اختبرني بذكاء 🧠 (",as_c_unlock_need:"يحتاج إتقان ",as_c_unlock_or:"% أو 3 اختبارات في ",as_c_unlock_open:" (التعلّم نفسه مفتوح دائمًا)",as_c_unlock_ok:"إتقان ",as_c_unlock_tests:" اختبارات في ",as_c_cat_test:" • ",as_c_sec_title:"🧭 مركز الاختبارات — اختر خطوتك",as_c_s1:"1. اختر المستوى",as_c_s2:"2. اختر Kapitel (",as_c_s2_close:")",as_c_nokap:"لا توجد Kapitel لهذا المستوى بعد.",as_c_locked_tip:"المحتوى قيد التجهيز",as_c_new:"🔒 جديد",as_c_done:"🟢 متقن",as_c_ready:"🟢 جاهز",as_c_rev:"🟡 مراجعة",as_c_train:"🔴 تدريب",as_c_mastery_w:" إتقان • ",as_c_last_r:"آخر نتيجة: ",as_c_never:"لم يُختبر",as_c_tests_n:" اختبارات",as_c_no_thin:"لا يوجد محتوى كافٍ لهذا الاختبار حاليًا (متاح: ",as_c_need:" — المطلوب: ",as_c_honest:"'). هذه نتيجة صادقة وليست درجة مخترعة. جرّب اختبارًا آخر أو أكمل الدروس أولًا.",as_c_cov:"التغطية المتاحة: ",as_c_back:"← عودة للمركز",as_c_boss_why:"الزعيم",as_c_level_q:"المستوى:",as_r_score:"📊 درجات الأقسام",as_r_skills:"📊 المهارات",as_r_thin:" (إجابات قليلة: ",as_r_thin_n:")",as_r_strong:"💪 نقاط القوة",as_r_weak:"⚠️ تحتاج مراجعة",as_r_notop:"لا نقاط قوة مؤكدة بعد — واصل التدرب.",as_r_noweak:"🎉 لا نقاط ضعف مؤكدة!",as_r_weak_det:"🎯 بالتفصيل: ",as_r_rec_rev:"راجع ",as_r_rec_go:"واصل ",as_r_mist:"❌ مراجعة أخطائي",as_r_journey:"🗺️ الرحلة",as_r_next:"➡️ ماذا تفعل الآن؟",as_r_your:"مستواك: ",as_r_kap:" • Kapitel: ",as_r_rev:"🔍 مراجعة الإجابات الخاطئة (",as_r_rev_close:")",as_r_noerr:"ممتاز — بلا أخطاء! 🎉",as_r_you:"إجابتك: ",as_r_right:"الصحيح: ",as_r_retry:"🔄 إعادة الاختبار",as_r_center:"← المركز",as_r_streak:"🔥 أطول سلسلة صحيحة: ",as_r_combo:" • 🏆 Perfect Rounds: ",as_r_record:"🎉 رقم قياسي جديد — أفضل نتيجة لك في هذا النوع!",as_r_conf:"مستوى الثقة",as_r_stages:"المراحل: ",as_r_badge_unconf:"🔒 غير مؤكد",as_r_badge_mastered:"✓ متقن ",as_r_badge_ready:"✓ جاهز ",as_r_badge_rev:" — يحتاج مراجعة",as_r_badge_locked:" — غير جاهز",as_r_resume:"💾 لديك اختبار غير مكتمل: ",as_r_resume_go:"▶️ استكمال الاختبار",as_r_discard:"🗑️ تجاهل",as_r_open_fail:"تعذر فتح النتيجة",as_r_resume_fail:"تعذر الاستكمال — بدء جديد أفضل",as_r_discarded:"تم تجاهل الاختبار غير المكتمل 🗑️",as_r_quit_saved:"💾 تم حفظ تقدمك",as_r_confirm_new:"لديك اختبار غير مكتمل محفوظ. بدء اختبار جديد سيستبدله. متابعة؟",as_r_loading:"⏳ جاري تحميل محتوى ",as_r_why:"لماذا؟ ",as_r_next_kap:"التالي",as_r_exam_pct:"امتحان شامل بنسبة ",as_r_pass_no:"لم تصل لعتبة النجاح ",as_r_passed:"ناجح 🎉",as_r_failed:"لم تنجح هذه المرة 💪",as_r_inconc:"غير حاسمة",as_r_done:"مكتمل ✅",as_r_path_a0:"Start A1 🟢",as_r_path_a1:"أكمل A1 ثم A2 🚀",as_r_path_go:"واصل إلى ",as_r_conf_h:"مرتفع ✅",as_r_conf_m:"متوسط 🟡",as_r_conf_l:"منخفض ⚠️",as_r_train_here:"تدرب على هذا الموضوع 🧪",as_r_train_skill:"تدرب على ",as_r_arrow:" ←",as_r_skill_sec:" • "});
Object.assign(I18N.en,{as_sk_vocab:"Words",as_sk_grammar:"Grammar",as_sk_sentences:"Sentences",as_sk_reading:"Reading",as_sk_listening:"Listening",as_sk_writing:"Writing",as_sk_speaking:"Speaking",as_sk_practical:"Situations",as_sk_words:"Words",as_sk_ordering:"Sentence structure",as_sk_verbs:"Verbs",as_sk_articles:"Articles",as_sk_plural:"Plural",as_sk_translate:"Translation",as_sk_reallife:"Situations",as_sk_mistakes:"My mistakes",as_sk_tfquiz:"True or False",as_ev_nodata:"Insufficient data",as_ev_strong:"Strong",as_ev_good:"Good",as_ev_weak:"Needs review",as_ev_poor:"Weak — start here",as_ev_nodata2:"No data",as_conf_high:"Enough questions with balanced skill coverage",as_conf_med:"Decent question count but partial coverage",as_conf_low_few:"Too few questions — indicative result only",as_conf_low_cov:"Limited skill coverage",as_note_inconclusive:"Inconclusive — more questions needed",as_note_start:"Start from the basics (A1 from zero)",as_q_meaning:"What does this mean: ",as_q_mark:"?",as_q_article:"Choose the correct article: ___ ",as_q_article_why:"Always memorize the article with the noun.",as_q_plural:"What is the plural of: ",as_q_plural_why:"The plural: ",as_q_translate:"Choose the correct German word: ",as_q_tf:"True or false: ",as_q_true:"True ✅",as_q_false:"False ❌",as_q_conj:"Choose the correct conjugation: ",as_q_conj_mid:" ___",as_q_fix:"This sentence has an error: «",as_q_fix_mid:"» — choose the correct fix:",as_q_order:"🔀 Order the words to build a correct sentence (",as_q_order_end:"):",as_q_order_why:"The correct sentence: ",as_q_complete:"🧩 Complete: ",as_q_answer:"Answer: ",as_q_write:"✍️ Type the missing word: ",as_q_read:"📖 Read, then choose the correct meaning:",as_q_read_why:"The answer comes from the text: ",as_q_listen:"🎧 Listen and choose the correct meaning:",as_q_speak:"🎤 Answer in German: ",as_q_speak_why:"Sample answer: ",as_q_sit:" — what is the best reply?",as_q_sit_why:"Best reply: ",as_q_dialog:" — what do you say in German?",as_q_match:"🔗 Match each word with its meaning:",as_q_neg:"Choose the correct negation: ",as_q_neg_verb:"nicht negates the verb/sentence: Ich lerne heute nicht.",as_q_neg_noun:"Before nouns use kein/keine (not nicht): ",as_q_conj_all:"⚡ Conjugate the verb (",as_q_conj_all_mid:") for each pronoun:",as_q_wclass:"What kind of word is: ",as_q_wclass_mid:"?",as_q_wclass_is:" is a: ",as_q_sentmean:"💬 What does this sentence mean: «",as_q_sentmean_end:"»?",as_q_gap_listen:"🎧 Listen to the sentence and pick the missing word: ",as_q_sent_why:"The sentence: ",as_q_hear:"You heard: ",as_q_match_hint:"Pick a German word, then its Arabic meaning.",as_q_match_hint_en:"Pick a German word, then its meaning.",as_q_choose_de_first:"Pick the German word first",as_q_not_right:"❌ Not the right meaning — try again",as_q_saved:"💾 Progress saved — resume later from the center",as_q_no_sr:"Speech recognition unsupported — type your answer ⌨️",as_q_speak_now:"🎤 Speak now…",as_q_heard:"I heard: ",as_q_no_hear:"Couldn't hear — type your answer ⌨️",as_q_no_mic:"Microphone failed",as_q_answer_first:"Answer first ✍️",as_q_combo:"🔥 Combo x",as_q_combo_xp:" — ⭐+5",as_q_perfect:"🏆 Perfect Round! Five correct in a row ⭐+10",as_q_stageup:"🎉 Well done! Advanced to stage ",as_q_fb_ok:"Correct ✅ ",as_q_fb_no:"❌ ",as_q_fb_right:"Correct: ",as_q_no_answer:"— (no answer)",as_q_timeout:"— (time is up)",as_q_time_up:"⏱️ Time is up — the quiz submits automatically",as_q_time_q:"⏱️ Question time is up!",as_q_mode_train:"🟢 Training",as_q_mode_chal:"🟡 Challenge",as_q_mode_exam:"🔴 Exam",as_q_mode_test:"🔵 Quiz",as_q_stage:"Stage ",as_q_stage_level:" (level ",as_q_stage_close:")",as_q_stage_a:"Stage A (level A1) — answer carefully, difficulty adapts to you",as_q_quit:"Finish & save ✖",as_q_hearbtn:"🔊 Listen",as_q_prev:"⏮ Previous",as_q_submit:"Check ✅",as_q_next:"Next ⏭",as_q_match_auto:"💡 Finish the matching — scored automatically when done.",as_q_lock_hint:"💡 Answer, then press “Check”. A locked answer cannot change — like a real exam.",as_q_clear:"Clear 🗑️",as_q_write_ph:"Type your answer…",as_q_sample:"Example: ",as_q_no_sr2:" (speech recognition unsupported in your browser — type your answer ⌨️)",as_q_mic:"🎤 Speak",as_q_match_locked:"Matching (",as_q_match_of:"/",as_q_match_err:", mistakes: ",as_q_match_end:")",as_q_wordclass_of:"verb Verb",as_q_wordclass_n:"noun Nomen",as_q_wordclass_a:"adjective Adjektiv",as_c_head:"🎯 Assessment & Testing Center",as_c_sub:"Find your real level, your Kapitel, your weak spots, and what to study next.",as_c_level:"Your level",as_c_level_none:"Determine your level first",as_c_kap:"Current Kapitel",as_c_kap_start:"Start your first assessment",as_c_kap_next:"Almost at ",as_c_kap_adv:"Advanced 🎉",as_c_mastery:"Mastery",as_c_mastery_avg:"Average of last ",as_c_mastery_q:" quizzes",as_c_mastery_none:"No quizzes yet",as_c_last:"Last quiz",as_c_last_go:"Start now 🚀",as_c_best:"Best score",as_c_best_n:" quizzes taken",as_c_best_0:"0 quizzes",as_c_acc:"Answer accuracy",as_c_acc_n:" recorded answers",as_c_acc_go:"Answer to see your accuracy",as_c_strong:"💪 Strong:",as_c_weak:"⚠️ Weak:",as_c_place_h:"🎯 Placement test",as_c_dur:"⚡ By duration",as_c_quick8:"Quick quiz (8)",as_c_mid16:"Medium quiz (16)",as_c_full30:"Full quiz (30)",as_c_kap_h:"📖 Kapitel quizzes",as_c_skill_h:"🧠 Skill quizzes",as_c_exam_h:"🏁 Comprehensive exams",as_c_exam:"exam",as_c_exam_full:"comprehensive",as_c_exam_pass:"Pass from ",as_c_exam_timed:" — timed ⏱️",as_c_exam_avail:"Content ",as_c_exam_avail2:" available (",as_c_exam_words:" words).",as_c_exam_prep:"Content in preparation (",as_c_exam_rules:" rules)",as_c_exam_soon:" — unlocks when content is complete.",as_c_exam_load:"⬇️ Load content ",as_c_exam_note:"Internal Deutsch Master exams — not official certificates (not Goethe).",as_c_map:"🗺️ Kapitel map",as_c_map_hint:"Tap any Kapitel to test or review it.",as_c_prog:"📈 Your progress over time",as_c_hist:"📜 Quiz history (",as_c_hist_close:")",as_c_hist_none:"No assessments yet — start with placement! 🚀",as_c_legacy_h:"📝 Quick quizzes",as_c_legacy_sub:"Quick training with classic types (articles, meanings, plurals, listening…).",as_c_boss_locked:"🔒 Kapitel boss test locked — ",as_c_placement:"Placement test",as_c_kap_test:"Quiz ",as_c_exam_a1:"Comprehensive A1 exam — Deutsch Master",as_c_exam_lv:"Comprehensive ",as_c_exam_lv2:" exam — Deutsch Master",as_c_quick:"Quick quiz",as_c_medium:"Medium quiz",as_c_full:"Full quiz",as_c_test_q:" questions",as_c_mine:"My custom quiz (",as_c_mine_mid:" • ",as_c_mine_cats:" categories)",as_c_mistakes_me:"Quiz me on my mistakes",as_c_challenge:"Today's challenge 🎯",as_c_boss:"Boss test 👑 • ",as_c_cumul:"Cumulative quiz 📚 (",as_c_cumul_all:"All",as_c_smart:"Quiz me smart 🧠 (",as_c_unlock_need:"Needs ",as_c_unlock_or:"% or 3 quizzes in ",as_c_unlock_open:" (learning itself is always open)",as_c_unlock_ok:"Mastery ",as_c_unlock_tests:" quizzes in ",as_c_cat_test:" • ",as_c_sec_title:"🧭 Test center — pick your step",as_c_s1:"1. Pick a level",as_c_s2:"2. Pick a Kapitel (",as_c_s2_close:")",as_c_nokap:"No Kapitel for this level yet.",as_c_locked_tip:"Content in preparation",as_c_new:"🔒 New",as_c_done:"🟢 Mastered",as_c_ready:"🟢 Ready",as_c_rev:"🟡 Review",as_c_train:"🔴 Train",as_c_mastery_w:" mastery • ",as_c_last_r:"Last result: ",as_c_never:"Not tested",as_c_tests_n:" quizzes",as_c_no_thin:"Not enough content for this quiz yet (available: ",as_c_need:" — required: ",as_c_honest:"'). Honest result, not a made-up score. Try another quiz or finish lessons first.",as_c_cov:"Available coverage: ",as_c_back:"← Back to center",as_c_boss_why:"Boss",as_c_level_q:"Level:",as_r_score:"📊 Section scores",as_r_skills:"📊 Skills",as_r_thin:" (few answers: ",as_r_thin_n:")",as_r_strong:"💪 Strengths",as_r_weak:"⚠️ Needs review",as_r_notop:"No confirmed strengths yet — keep training.",as_r_noweak:"🎉 No confirmed weaknesses!",as_r_weak_det:"🎯 In detail: ",as_r_rec_rev:"Review ",as_r_rec_go:"Continue ",as_r_mist:"❌ Review my mistakes",as_r_journey:"🗺️ Journey",as_r_next:"➡️ What now?",as_r_your:"Your level: ",as_r_kap:" • Kapitel: ",as_r_rev:"🔍 Reviewing wrong answers (",as_r_rev_close:")",as_r_noerr:"Excellent — no mistakes! 🎉",as_r_you:"Your answer: ",as_r_right:"Correct: ",as_r_retry:"🔄 Retry quiz",as_r_center:"← Center",as_r_streak:"🔥 Longest correct streak: ",as_r_combo:" • 🏆 Perfect Rounds: ",as_r_record:"🎉 New record — your best in this type!",as_r_conf:"Confidence",as_r_stages:"Stages: ",as_r_badge_unconf:"🔒 Unconfirmed",as_r_badge_mastered:"✓ Mastered ",as_r_badge_ready:"✓ Ready ",as_r_badge_rev:" — needs review",as_r_badge_locked:" — not ready",as_r_resume:"💾 You have an unfinished quiz: ",as_r_resume_go:"▶️ Resume quiz",as_r_discard:"🗑️ Discard",as_r_open_fail:"Could not open the result",as_r_resume_fail:"Cannot resume — starting fresh is better",as_r_discarded:"Incomplete quiz discarded 🗑️",as_r_quit_saved:"💾 Your progress was saved",as_r_confirm_new:"You have an unfinished saved quiz. Starting a new one will replace it. Continue?",as_r_loading:"⏳ Loading content ",as_r_why:"Why? ",as_r_next_kap:"Next",as_r_exam_pct:"Comprehensive exam at ",as_r_pass_no:"Didn't reach the pass mark ",as_r_passed:"Passed 🎉",as_r_failed:"Not this time 💪",as_r_inconc:"Inconclusive",as_r_done:"Complete ✅",as_r_path_a0:"Start A1 🟢",as_r_path_a1:"Finish A1 then A2 🚀",as_r_path_go:"Continue to ",as_r_conf_h:"High ✅",as_r_conf_m:"Medium 🟡",as_r_conf_l:"Low ⚠️",as_r_train_here:"Practice this topic 🧪",as_r_train_skill:"Practice ",as_r_arrow:" →",as_r_skill_sec:" • "});
Object.assign(I18N.de,{as_sk_vocab:"Wörter",as_sk_grammar:"Grammatik",as_sk_sentences:"Sätze",as_sk_reading:"Lesen",as_sk_listening:"Hören",as_sk_writing:"Schreiben",as_sk_speaking:"Sprechen",as_sk_practical:"Situationen",as_sk_words:"Wörter",as_sk_ordering:"Satzbau",as_sk_verbs:"Verben",as_sk_articles:"Artikel",as_sk_plural:"Plural",as_sk_translate:"Übersetzung",as_sk_reallife:"Situationen",as_sk_mistakes:"Meine Fehler",as_sk_tfquiz:"Richtig/Falsch",as_ev_nodata:"Zu wenig Daten",as_ev_strong:"Stark",as_ev_good:"Gut",as_ev_weak:"Braucht Wiederholung",as_ev_poor:"Schwach — hier starten",as_ev_nodata2:"Keine Daten",as_conf_high:"Genug Fragen mit ausgewogener Abdeckung",as_conf_med:"Ordentliche Anzahl, aber lückenhafte Abdeckung",as_conf_low_few:"Zu wenige Fragen — nur Richtwert",as_conf_low_cov:"Begrenzte Abdeckung",as_note_inconclusive:"Unklar — mehr Fragen nötig",as_note_start:"Bei den Grundlagen starten (A1 von Null)",as_q_meaning:"Was bedeutet: ",as_q_mark:"?",as_q_article:"Wähle den richtigen Artikel: ___ ",as_q_article_why:"Lerne den Artikel immer mit dem Nomen.",as_q_plural:"Wie lautet der Plural von: ",as_q_plural_why:"Der Plural: ",as_q_translate:"Wähle das richtige deutsche Wort: ",as_q_tf:"Richtig oder falsch: ",as_q_true:"Richtig ✅",as_q_false:"Falsch ❌",as_q_conj:"Wähle die richtige Konjugation: ",as_q_conj_mid:" ___",as_q_fix:"Dieser Satz hat einen Fehler: «",as_q_fix_mid:"» — wähle die richtige Korrektur:",as_q_order:"🔀 Ordne die Wörter zu einem richtigen Satz: (",as_q_order_end:"):",as_q_order_why:"Der richtige Satz: ",as_q_complete:"🧩 Ergänze: ",as_q_answer:"Antwort: ",as_q_write:"✍️ Schreibe das fehlende Wort: ",as_q_read:"📖 Lies und wähle die richtige Bedeutung:",as_q_read_why:"Die Antwort steht im Text: ",as_q_listen:"🎧 Höre zu und wähle die richtige Bedeutung:",as_q_speak:"🎤 Antworte auf Deutsch: ",as_q_speak_why:"Beispielantwort: ",as_q_sit:" — was ist die beste Antwort?",as_q_sit_why:"Beste Antwort: ",as_q_dialog:" — was sagst du auf Deutsch?",as_q_match:"🔗 Ordne jedes Wort seiner Bedeutung zu:",as_q_neg:"Wähle die richtige Verneinung: ",as_q_neg_verb:"nicht verneint Verb/Satz: Ich lerne heute nicht.",as_q_neg_noun:"Vor Nomen kein/keine (nicht nicht): ",as_q_conj_all:"⚡ Konjugiere das Verb (",as_q_conj_all_mid:") für jedes Pronomen:",as_q_wclass:"Was für ein Wort ist: ",as_q_wclass_mid:"?",as_q_wclass_is:" ist ein: ",as_q_sentmean:"💬 Was bedeutet dieser Satz: «",as_q_sentmean_end:"»?",as_q_gap_listen:"🎧 Höre den Satz und wähle das fehlende Wort: ",as_q_sent_why:"Der Satz: ",as_q_hear:"Gehört: ",as_q_match_hint:"Wähle ein deutsches Wort und seine arabische Bedeutung.",as_q_match_hint_en:"Wähle ein deutsches Wort und seine Bedeutung.",as_q_choose_de_first:"Wähle zuerst das deutsche Wort",as_q_not_right:"❌ Nicht die richtige Bedeutung — versuch es nochmal",as_q_saved:"💾 Fortschritt gespeichert — später im Center fortsetzen",as_q_no_sr:"Spracherkennung nicht unterstützt — schreiben ⌨️",as_q_speak_now:"🎤 Jetzt sprechen …",as_q_heard:"Gehört: ",as_q_no_hear:"Nicht gehört — schreiben ⌨️",as_q_no_mic:"Mikrofon fehlgeschlagen",as_q_answer_first:"Antworte zuerst ✍️",as_q_combo:"🔥 Kombo x",as_q_combo_xp:" — ⭐+5",as_q_perfect:"🏆 Perfect Round! Fünf Richtige in Folge ⭐+10",as_q_stageup:"🎉 Gut gemacht! Weiter zu Phase ",as_q_fb_ok:"Richtig ✅ ",as_q_fb_no:"❌ ",as_q_fb_right:"Richtig: ",as_q_no_answer:"— (keine Antwort)",as_q_timeout:"— (Zeit um)",as_q_time_up:"⏱️ Zeit um — der Test wird automatisch abgegeben",as_q_time_q:"⏱️ Fragezeit um!",as_q_mode_train:"🟢 Training",as_q_mode_chal:"🟡 Challenge",as_q_mode_exam:"🔴 Prüfung",as_q_mode_test:"🔵 Test",as_q_stage:"Phase ",as_q_stage_level:" (Niveau ",as_q_stage_close:")",as_q_stage_a:"Phase A (Niveau A1) — antworte konzentriert, die Stufe passt sich an",as_q_quit:"Beenden & speichern ✖",as_q_hearbtn:"🔊 Anhören",as_q_prev:"⏮ Zurück",as_q_submit:"Prüfen ✅",as_q_next:"Weiter ⏭",as_q_match_auto:"💡 Beende das Zuordnen — automatische Wertung am Ende.",as_q_lock_hint:"💡 Antworte, dann „Prüfen“. Fixierte Antworten ändern sich nicht — wie in echter Prüfung.",as_q_clear:"Löschen 🗑️",as_q_write_ph:"Schreibe deine Antwort …",as_q_sample:"Beispiel: ",as_q_no_sr2:" (Spracherkennung nicht unterstützt — schreiben ⌨️)",as_q_mic:"🎤 Sprechen",as_q_match_locked:"Zuordnung (",as_q_match_of:"/",as_q_match_err:", Fehler: ",as_q_match_end:")",as_q_wordclass_of:"Verb Verb",as_q_wordclass_n:"Nomen Nomen",as_q_wordclass_a:"Adjektiv Adjektiv",as_c_head:"🎯 Test- & Prüfungscenter",as_c_sub:"Finde dein echtes Niveau, dein Kapitel, deine Schwächen und was du jetzt lernen sollst.",as_c_level:"Dein Niveau",as_c_level_none:"Bestimme zuerst dein Niveau",as_c_kap:"Aktuelles Kapitel",as_c_kap_start:"Starte deine erste Prüfung",as_c_kap_next:"Fast bei ",as_c_kap_adv:"Fortgeschritten 🎉",as_c_mastery:"Beherrschung",as_c_mastery_avg:"Schnitt der letzten ",as_c_mastery_q:" Tests",as_c_mastery_none:"Noch keine Tests",as_c_last:"Letzter Test",as_c_last_go:"Jetzt starten 🚀",as_c_best:"Bestleistung",as_c_best_n:" Tests gemacht",as_c_best_0:"0 Tests",as_c_acc:"Antwortgenauigkeit",as_c_acc_n:" gespeicherte Antworten",as_c_acc_go:"Antworte für deine Genauigkeit",as_c_strong:"💪 Stärken:",as_c_weak:"⚠️ Schwächen:",as_c_place_h:"🎯 Einstufungstest",as_c_dur:"⚡ Nach Dauer",as_c_quick8:"Schnelltest (8)",as_c_mid16:"Mittlerer Test (16)",as_c_full30:"Volltest (30)",as_c_kap_h:"📖 Kapitel-Tests",as_c_skill_h:"🧠 Skill-Tests",as_c_exam_h:"🏁 Abschlussprüfungen",as_c_exam:"Prüfung",as_c_exam_full:"umfassende",as_c_exam_pass:"Bestehen ab ",as_c_exam_timed:" — mit Zeit ⏱️",as_c_exam_avail:"Inhalt ",as_c_exam_avail2:" verfügbar (",as_c_exam_words:" Wörter).",as_c_exam_prep:"Inhalt in Vorbereitung (",as_c_exam_rules:" Regeln)",as_c_exam_soon:" — wird bei vollständigem Inhalt freigeschaltet.",as_c_exam_load:"⬇️ Inhalt laden ",as_c_exam_note:"Interne Deutsch-Master-Tests — keine offiziellen Zertifikate (kein Goethe).",as_c_map:"🗺️ Kapitel-Karte",as_c_map_hint:"Tippe auf ein Kapitel zum Testen oder Wiederholen.",as_c_prog:"📈 Dein Fortschritt",as_c_hist:"📜 Testverlauf (",as_c_hist_close:")",as_c_hist_none:"Noch keine Tests — starte mit der Einstufung! 🚀",as_c_legacy_h:"📝 Schnelltests",as_c_legacy_sub:"Schnelles Training mit klassischen Typen (Artikel, Bedeutungen, Plural, Hören …).",as_c_boss_locked:"🔒 Kapitel-Bosstest gesperrt — ",as_c_placement:"Einstufungstest",as_c_kap_test:"Test ",as_c_exam_a1:"Umfassende A1-Prüfung — Deutsch Master",as_c_exam_lv:"Umfassende ",as_c_exam_lv2:" Prüfung — Deutsch Master",as_c_quick:"Schnelltest",as_c_medium:"Mittlerer Test",as_c_full:"Volltest",as_c_test_q:" Fragen",as_c_mine:"Mein eigener Test (",as_c_mine_mid:" • ",as_c_mine_cats:" Kategorien)",as_c_mistakes_me:"Teste mich mit meinen Fehlern",as_c_challenge:"Tages-Challenge 🎯",as_c_boss:"Bosstest 👑 • ",as_c_cumul:"Kumulativer Test 📚 (",as_c_cumul_all:"Alle",as_c_smart:"Teste mich smart 🧠 (",as_c_unlock_need:"Braucht ",as_c_unlock_or:"% oder 3 Tests in ",as_c_unlock_open:" (Lernen selbst ist immer offen)",as_c_unlock_ok:"Beherrschung ",as_c_unlock_tests:" Tests in ",as_c_cat_test:" • ",as_c_sec_title:"🧭 Testcenter — wähle deinen Schritt",as_c_s1:"1. Niveau wählen",as_c_s2:"2. Kapitel wählen (",as_c_s2_close:")",as_c_nokap:"Noch keine Kapitel für dieses Niveau.",as_c_locked_tip:"Inhalt in Vorbereitung",as_c_new:"🔒 Neu",as_c_done:"🟢 Gemeistert",as_c_ready:"🟢 Bereit",as_c_rev:"🟡 Wiederholen",as_c_train:"🔴 Üben",as_c_mastery_w:" Beherrschung • ",as_c_last_r:"Letztes Ergebnis: ",as_c_never:"Nicht getestet",as_c_tests_n:" Tests",as_c_no_thin:"Noch nicht genug Inhalt für diesen Test (verfügbar: ",as_c_need:" — nötig: ",as_c_honest:"'). Ehrliches Ergebnis, keine erfundene Note. Versuche einen anderen Test oder beende Lektionen.",as_c_cov:"Verfügbare Abdeckung: ",as_c_back:"← Zurück zum Center",as_c_boss_why:"Boss",as_c_level_q:"Niveau:",as_r_score:"📊 Bereichsergebnisse",as_r_skills:"📊 Skills",as_r_thin:" (wenige Antworten: ",as_r_thin_n:")",as_r_strong:"💪 Stärken",as_r_weak:"⚠️ Braucht Wiederholung",as_r_notop:"Noch keine bestätigten Stärken — weiter üben.",as_r_noweak:"🎉 Keine bestätigten Schwächen!",as_r_weak_det:"🎯 Im Detail: ",as_r_rec_rev:"Wiederhole ",as_r_rec_go:"Weiter mit ",as_r_mist:"❌ Meine Fehler ansehen",as_r_journey:"🗺️ Reise",as_r_next:"➡️ Was jetzt?",as_r_your:"Dein Niveau: ",as_r_kap:" • Kapitel: ",as_r_rev:"🔍 Falsche Antworten ansehen (",as_r_rev_close:")",as_r_noerr:"Ausgezeichnet — keine Fehler! 🎉",as_r_you:"Deine Antwort: ",as_r_right:"Richtig: ",as_r_retry:"🔄 Test wiederholen",as_r_center:"← Center",as_r_streak:"🔥 Längste richtige Serie: ",as_r_combo:" • 🏆 Perfect Rounds: ",as_r_record:"🎉 Neuer Rekord — dein Bestes in diesem Typ!",as_r_conf:"Konfidenz",as_r_stages:"Phasen: ",as_r_badge_unconf:"🔒 Unbestätigt",as_r_badge_mastered:"✓ Gemeistert ",as_r_badge_ready:"✓ Bereit ",as_r_badge_rev:" — braucht Wiederholung",as_r_badge_locked:" — nicht bereit",as_r_resume:"💾 Unvollendeter Test: ",as_r_resume_go:"▶️ Test fortsetzen",as_r_discard:"🗑️ Verwerfen",as_r_open_fail:"Ergebnis konnte nicht geöffnet werden",as_r_resume_fail:"Fortsetzen nicht möglich — neu starten",as_r_discarded:"Unvollendeter Test verworfen 🗑️",as_r_quit_saved:"💾 Fortschritt gespeichert",as_r_confirm_new:"Du hast einen unvollendeten Test. Ein neuer ersetzt ihn. Fortfahren?",as_r_loading:"⏳ Inhalt wird geladen ",as_r_why:"Warum? ",as_r_next_kap:"Weiter",as_r_exam_pct:"Prüfung mit ",as_r_pass_no:"Bestanden-Marke verfehlt ",as_r_passed:"Bestanden 🎉",as_r_failed:"Diesmal nicht 💪",as_r_inconc:"Unklar",as_r_done:"Fertig ✅",as_r_path_a0:"Start A1 🟢",as_r_path_a1:"Beende A1, dann A2 🚀",as_r_path_go:"Weiter zu ",as_r_conf_h:"Hoch ✅",as_r_conf_m:"Mittel 🟡",as_r_conf_l:"Niedrig ⚠️",as_r_train_here:"Übe dieses Thema 🧪",as_r_train_skill:"Übe ",as_r_arrow:" →",as_r_skill_sec:" • "});
}catch(__as_i18n_e){}
/* ---------- interface language keys, batch 2 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{as_note_passed_a:"اجتزت ",as_note_passed_b:" من ",as_note_passed_c:" مراحل",as_ev_test:"اختبار: ",as_ev_q:" أسئلة",as_ev_prog:"من تقدمك العام فقط",as_q_say_w:"مع ",as_q_say_s:" نقول: ",as_q_say_ex:" — مثال حقيقي: ",as_q_right_is:"الصحيح: ",as_q_er_end:" — مع Er يأخذ الفعل نهاية خاصة (",as_q_kein_note:" — الجملة فعلية بدون اسم)",as_q_dlg:"🗣️ أكمل الحوار (",as_q_dlg_said:") — قال: «",as_q_dlg_you:"» فأجبت: «",as_q_dlg_then:"» — ثم قال: «",as_q_dlg_st:"» (",as_q_dlg_ask:") — ما ردك؟",as_q_dlg_why:"الرد الطبيعي: ",as_q_says:" — يقول لك: «"});
Object.assign(I18N.en,{as_note_passed_a:"Passed ",as_note_passed_b:" of ",as_note_passed_c:" stages",as_ev_test:"Quiz: ",as_ev_q:" questions",as_ev_prog:"from your overall progress only",as_q_say_w:"With ",as_q_say_s:" we say: ",as_q_say_ex:" — real example: ",as_q_right_is:"Correct: ",as_q_er_end:" — with Er the verb takes a special ending (",as_q_kein_note:" — verbless sentence, no noun)",as_q_dlg:"🗣️ Complete the dialogue (",as_q_dlg_said:") — he said: «",as_q_dlg_you:"» you answered: «",as_q_dlg_then:"» — then he said: «",as_q_dlg_st:"» (",as_q_dlg_ask:") — what is your reply?",as_q_dlg_why:"The natural reply: ",as_q_says:" — says to you: «"});
Object.assign(I18N.de,{as_note_passed_a:"Bestanden ",as_note_passed_b:" von ",as_note_passed_c:" Phasen",as_ev_test:"Test: ",as_ev_q:" Fragen",as_ev_prog:"nur aus deinem Gesamtfortschritt",as_q_say_w:"Bei ",as_q_say_s:" sagen wir: ",as_q_say_ex:" — echtes Beispiel: ",as_q_right_is:"Richtig: ",as_q_er_end:" — mit Er bekommt das Verb eine besondere Endung (",as_q_kein_note:" — verbloser Satz, kein Nomen)",as_q_dlg:"🗣️ Dialog ergänzen (",as_q_dlg_said:") — er sagte: «",as_q_dlg_you:"» du antwortetest: «",as_q_dlg_then:"» — dann sagte er: «",as_q_dlg_st:"» (",as_q_dlg_ask:") — was antwortest du?",as_q_dlg_why:"Die natürliche Antwort: ",as_q_says:" — sagt zu dir: «"});
}catch(__as_i18n_e2){}
/* ---------- interface language keys, batch 3 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{as_q_missing:" — ناقصك: "});
Object.assign(I18N.en,{as_q_missing:" — you are missing: "});
Object.assign(I18N.de,{as_q_missing:" — dir fehlt: "});
}catch(__as_i18n_e3){}
/* ---------- interface language keys, batch 4 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{as_c_kexam_h:"الامتحان الشامل • "});
Object.assign(I18N.en,{as_c_kexam_h:"Comprehensive exam • "});
Object.assign(I18N.de,{as_c_kexam_h:"Prüfung • "});
}catch(__as_i18n_e4){}
/* ---------- interface language keys, batch 5 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{as_r_notop:"لا نقاط قوة مؤكدة بعد — واصل التدرب.",as_r_noweak:"🎉 لا نقاط ضعف مؤكدة!",as_r_test:"اختبار",as_c_place_sub:"اختبار شامل تكيّفي (A1 ← A2 ← B1): مفردات، قواعد، جمل، قراءة، استماع، مواقف عملية، وتحدث اختياري. يحدد مستواك والـ Kapitel بدقة.",as_c_place_go:"ابدأ تحديد المستوى 🚀",as_c_start_exam:"ابدأ الامتحان 🏁",as_q_match_pct:"تطابق الكلمات: ",as_q_rated:" (تقييم استرشادي)",as_q_ok_n:"صحيح: "});
Object.assign(I18N.en,{as_r_notop:"No confirmed strengths yet — keep training.",as_r_noweak:"🎉 No confirmed weaknesses!",as_r_test:"Quiz",as_c_place_sub:"Adaptive comprehensive test (A1 ← A2 ← B1): vocabulary, grammar, sentences, reading, listening, real situations, optional speaking. Determines your level and Kapitel precisely.",as_c_place_go:"Start placement 🚀",as_c_start_exam:"Start exam 🏁",as_q_match_pct:"Word match: ",as_q_rated:" (indicative rating)",as_q_ok_n:"Correct: "});
Object.assign(I18N.de,{as_r_notop:"Noch keine bestätigten Stärken — weiter üben.",as_r_noweak:"🎉 Keine bestätigten Schwächen!",as_r_test:"Test",as_c_place_sub:"Adaptiver Gesamttest (A1 ← A2 ← B1): Wortschatz, Grammatik, Sätze, Lesen, Hören, Alltagssituationen, optionales Sprechen. Bestimmt Niveau und Kapitel präzise.",as_c_place_go:"Einstufung starten 🚀",as_c_start_exam:"Prüfung starten 🏁",as_q_match_pct:"Worttreffer: ",as_q_rated:" (Richtwert)",as_q_ok_n:"Richtig: "});
}catch(__as_i18n_e5){}
/* ---------- interface language keys, batch 6 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{as_c_exam_w2:" كلمة، "});
Object.assign(I18N.en,{as_c_exam_w2:" words, "});
Object.assign(I18N.de,{as_c_exam_w2:" Wörter,"});
}catch(__as_i18n_e6){}
/* ---------- interface language keys, batch 7 (same I18N system) ---------- */
try{
Object.assign(I18N.ar,{as_c_varied:"متنوع"});
Object.assign(I18N.en,{as_c_varied:"Mixed"});
Object.assign(I18N.de,{as_c_varied:"Gemischt"});
}catch(__as_i18n_e7){}
/* Display-entry selectors (same i18n system; data untouched). */
function askSkillEntry(m){try{var L=askLang();if(L==="en"&&(m.en||""))return m.en;if(L==="de"&&(m.de||m.en||""))return m.de||m.en;return (m&&(m.ar||""))||"";}catch(e){try{return (m&&(m.ar||""))||"";}catch(e2){return "";}}}
function askModeEntry(m){try{var L=askLang();if(L!=="ar"&&(m.en||""))return m.en;return (m&&(m.ar||""))||"";}catch(e){try{return (m&&(m.ar||""))||"";}catch(e2){return "";}}}
function askDiffEntry(m){try{var L=askLang();if(L==="en"&&(m.en||""))return m.en;if(L==="de"&&(m.de||m.en||""))return m.de||m.en;return (m&&(m.ar||""))||"";}catch(e){try{return (m&&(m.ar||""))||"";}catch(e2){return "";}}}
/* Interface language for this module (reads the same S.uiLang). */
function askLang(){try{if(typeof uilang==="function")return uilang();var L=(typeof S!=="undefined"&&S&&S.uiLang)||"ar";return L==="en"?"en":(L==="de"?"de":"ar");}catch(e){return "ar";}}
function askT(k,fb){try{if(typeof window!=="undefined"&&typeof window.t==="function"){var v=window.t(k);if(v!==null&&v!==undefined&&v!==""&&v!==k)return v;}}catch(e){}return (fb===undefined||fb===null)?k:fb;}
function wMean(w){try{if(typeof wordMeaning==="function")return wordMeaning(w);}catch(e){}try{return (w&&(w.ar||w.en))||"";}catch(e2){return "";}}
function sMean(s){try{if(typeof sentMeaning==="function")return sentMeaning(s);}catch(e){}try{return (s&&(s.ar||s.en))||"";}catch(e2){return "";}}
function distractMean(pool,w,n){try{var out=[],seen={},rm=wMean(w);seen[rm]=1;n=n||3;if(!pool||!pool.length)return out;var tries=0,mt=Math.max(24,n*12);while(out.length<n&&tries<mt){tries++;var x=pool[(Math.random()*pool.length)|0];if(!x)continue;var m=wMean(x);if(!m||seen[m])continue;seen[m]=1;out.push(m);}return out;}catch(e){return [];}}
function distractSentMean(pool,s,n){try{var out=[],seen={},rm=sMean(s);seen[rm]=1;n=n||3;if(!pool||!pool.length)return out;var tries=0,mt=Math.max(24,n*12);while(out.length<n&&tries<mt){tries++;var x=pool[(Math.random()*pool.length)|0];if(!x)continue;var m=sMean(x);if(!m||seen[m])continue;seen[m]=1;out.push(m);}return out;}catch(e){return [];}}
/* Arabic topic label -> English/German equivalent (display only; data untouched). */
var ASTOPIC=[["معاني الكلمات","Word meanings","Wortbedeutungen"],["الأدوات der/die/das","Articles der/die/das","Artikel der/die/das"],["الجمع Plural","Plural","Plural"],["الترجمة عربي","Arabic translation","Arabische Übersetzung"],["صح أم خطأ — المفردات","True/false vocabulary","Richtig/Falsch Wortschatz"],["تصريف الأفعال","Verb conjugation","Verbkonjugation"],["تصحيح الخطأ","Error correction","Fehlerkorrektur"],["ترتيب الجملة","Sentence order","Wortstellung"],["إكمال الجمل","Sentence completion","Satzergänzung"],["الأدوات في السياق","Articles in context","Artikel im Kontext"],["الأفعال في السياق","Verbs in context","Verben im Kontext"],["الكلمة في السياق","Word in context","Wort im Kontext"],["الكتابة والإملاء","Writing and spelling","Schreiben"],["فهم المقروء","Reading comprehension","Leseverstehen"],["الفهم السمعي","Listening comprehension","Hörverstehen"],["التحدث","Speaking","Sprechen"],["الكلمة الناقصة سمعيًا","Missing word by listening","Fehlendes Wort (Hören)"],["النفي kein / nicht","Negation kein/nicht","Verneinung kein/nicht"],["تصريف الأفعال ich/du/er","Conjugation ich/du/er","Konjugation ich/du/er"],["أقسام الكلام","Parts of speech","Wortarten"],["معنى الجملة","Sentence meaning","Satzbedeutung"],["التوصيل ألماني","Matching German","Zuordnen Deutsch"],["مواقف: ","Situations: ","Situationen: "],["إكمال الحوار: ","Dialogue completion: ","Dialogergänzung: "],["النفي kein / nicht","Negation kein/nicht","Verneinung kein/nicht"]];
function askTopic(a){try{var L=askLang();if(L==="ar")return a;var s=String(a||"");for(var i=0;i<ASTOPIC.length;i++){if(s.indexOf(ASTOPIC[i][0])===0){return (L==="de"?ASTOPIC[i][2]:ASTOPIC[i][1])+s.slice(ASTOPIC[i][0].length);}}return a;}catch(e){return a;}}
var DMAssess = (function () {
  /* ============================ PURE CORE ============================ */
  var CONFIG = {
    PASS_A1_EXAM: 70, STAGE_PASS: 70,
    KAP_READY: 70, KAP_MASTERED: 85,
    STRONG_SKILL: 80, GOOD_SKILL: 65, WEAK_SKILL: 40,
    MIN_SKILL_N: 3, MIN_OVERALL_N: 8,
    CONF_HIGH_N: 20, CONF_MED_N: 10,
    TEST_W_KAP: 0.65, PROG_W_KAP: 0.35, MIN_KAP_TEST_N: 4,
    HISTORY_CAP: 30, RESUME_TTL_DAYS: 7, EXAM_TIME_SEC: 1200,
    LVL_GATE_WORDS: 40, LVL_GATE_GRAMMAR: 4, STORE_V: 1,
    QTIME_SEC: 12, BOSS_UNLOCK_READY: 50, PERFECT_ROUND_N: 5, MASTER_CAP: 120,
    /* Large-test sizing: quick 20 / normal 40 / intensive 60 / advanced 80 /
       master = all valid content up to MASTER_CAP. Counts are targets only:
       every spec slices to real valid content and reports the actual number. */
  };

  /* skill registry: key -> Arabic label + learning route (all real pages) */
  var SKILLS = {
    vocab: { ar: "الكلمات", de: "Wortschatz", en: "Words", go: "vocab" },
    grammar: { ar: "القواعد", de: "Grammatik", en: "Grammar", go: "grammar" },
    sentences: { ar: "الجمل", de: "Sätze", en: "Sentences", go: "sentences" },
    reading: { ar: "القراءة", de: "Lesen", en: "Reading", go: "sentences" },
    listening: { ar: "الاستماع", de: "Hören", en: "Listening", go: "listen" },
    writing: { ar: "الكتابة", de: "Schreiben", en: "Writing", go: "sentex" },
    speaking: { ar: "التحدث", de: "Sprechen", en: "Speaking", go: "speak" },
    practical: { ar: "المواقف", de: "Alltag", en: "Situations", go: "real" },
  };
  var SKILL_KEYS = Object.keys(SKILLS);

  function clampPct(x) { x = Math.round(+x || 0); return x < 0 ? 0 : x > 100 ? 100 : x; }
  function shuffled(a, rnd) {
    var x = (a || []).slice(), r = rnd || Math.random, i, j, t;
    for (i = x.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = x[i]; x[i] = x[j]; x[j] = t; }
    return x;
  }
  /* Stratified pick: plan = [{skill, n, kap?, level?}], pool items carry
     .skill/.kap/.level/.id. Never invents coverage: returns {picked, miss}
     where miss lists the slots that had no real content. */
  function stratify(pool, plan, rnd) {
    var used = {}, picked = [], miss = [];
    (plan || []).forEach(function (slot) {
      var cands = shuffled((pool || []).filter(function (q) {
        if (used[q.id]) return false;
        if (slot.skill && q.skill !== slot.skill) return false;
        if (slot.kap && q.kap !== slot.kap) return false;
        if (slot.level && q.level !== slot.level) return false;
        if (slot.types && slot.types.indexOf(q.type) < 0) return false;
        return true;
      }), rnd);
      var want = Math.max(0, slot.n | 0), got = 0;
      for (var i = 0; i < cands.length && got < want; i++) { used[cands[i].id] = 1; picked.push(cands[i]); got++; }
      if (got < want) miss.push({ skill: slot.skill || "*", kap: slot.kap || "*", want: want, got: got });
    });
    return { picked: shuffled(picked, rnd), miss: miss };
  }

  function emptyAgg() { return { n: 0, ok: 0, pct: 0, ev: "none" }; }
  function evOf(n) { return n >= CONFIG.MIN_SKILL_N ? "ok" : (n > 0 ? "thin" : "none"); }
  /* Deterministic RNG (daily test, reproducible practice). mulberry32. */
  function hashSeed(str) {
    var h = 2166136261;
    str = String(str == null ? "" : str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededRng(seedStr) { return mulberry32(hashSeed(seedStr)); }
  /* Content validation: every served question must pass this. Invalid items
     are skipped by buildPool — never crash a session, never fake a score. */
  function validateQ(q) {
    if (!q || typeof q !== "object") return false;
    if (!q.prompt || !String(q.prompt).trim()) return false;
    var t = q.type;
    if (t === "order") {
      if (!q.chips || q.chips.length < 3 || !q.answer || !String(q.answer).trim()) return false;
      return true;
    }
    if (t === "fill" || t === "speak") {
      if (t === "fill" && (!q.accept || !q.accept.length || !q.accept[0])) return false;
      if (t === "speak" && !q.sample) return false;
      return !!String(q.prompt).trim();
    }
    if (t === "match") {
      if (!q.pairs || q.pairs.length < 2) return false;
      for (var i = 0; i < q.pairs.length; i++) {
        if (!q.pairs[i].de || !q.pairs[i].ar) return false;
      }
      return true;
    }
    if (t === "conj") {
      if (!q.rows || q.rows.length < 1 || !q.rows[0].opts || q.rows[0].opts.length < 2) return false;
      return true;
    }
    /* option-based types: need unique non-empty options + valid correct idx */
    if (!q.opts || q.opts.length < 2) return false;
    if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.opts.length) return false;
    var seen = {}, ok = true;
    q.opts.forEach(function (o) {
      var k = String(o == null ? "" : o).trim();
      if (!k || seen[k]) ok = false;
      seen[k] = 1;
    });
    return ok;
  }
  var DIFF_ORDER = { easy: 0, medium: 1, hard: 2 };
  /* Difficulty filter: 'graded' sorts easy->hard; a missing level falls back
     to the closest available (never an empty test when content exists). */
  function filterByDiff(pool, diff) {
    pool = pool || [];
    if (!diff || diff === "mixed") return pool.slice();
    if (diff === "graded") {
      return pool.slice().sort(function (a, b) {
        return (DIFF_ORDER[a.diff] == null ? 1 : DIFF_ORDER[a.diff]) - (DIFF_ORDER[b.diff] == null ? 1 : DIFF_ORDER[b.diff]);
      });
    }
    var exact = pool.filter(function (q) { return q.diff === diff; });
    if (exact.length) return exact;
    var keys = Object.keys(DIFF_ORDER);
    var want = DIFF_ORDER[diff];
    for (var d = 1; d < 3; d++) {
      var lo = keys.filter(function (k) { return DIFF_ORDER[k] === want - d; })[0];
      var hi = keys.filter(function (k) { return DIFF_ORDER[k] === want + d; })[0];
      var fb = pool.filter(function (q) { return q.diff === lo || q.diff === hi; });
      if (fb.length) return fb;
    }
    return pool.slice();
  }
  /* Percent distribution -> integer counts summing exactly to total. */
  function distribute(total, ratios) {
    total = Math.max(0, total | 0);
    ratios = ratios || {};
    var keys = Object.keys(ratios);
    if (!keys.length || total <= 0) return {};
    var sum = 0;
    keys.forEach(function (k) { sum += Math.max(0, +ratios[k] || 0); });
    if (sum <= 0) return {};
    var out = {}, acc = 0;
    keys.forEach(function (k, i) {
      if (i === keys.length - 1) out[k] = total - acc;
      else { out[k] = Math.floor(total * (Math.max(0, +ratios[k] || 0) / sum)); acc += out[k]; }
    });
    return out;
  }
  /* Score one answered session. items: [{skill, topic, kap, ok, w}] */
  function scoreAnswers(items) {
    var sk = {}, kp = {}, tp = {}, tn = 0, tok = 0;
    SKILL_KEYS.forEach(function (s) { sk[s] = { n: 0, ok: 0 }; });
    (items || []).forEach(function (it) {
      var w = (typeof it.w === "number" && it.w > 0) ? it.w : 1;
      tn += w; if (it.ok) tok += w;
      if (sk[it.skill]) { sk[it.skill].n += w; if (it.ok) sk[it.skill].ok += w; }
      var k = it.kap || "?";
      if (!kp[k]) kp[k] = { n: 0, ok: 0 };
      kp[k].n += w; if (it.ok) kp[k].ok += w;
      var t = (it.skill || "?") + "::" + (it.topic || "?");
      if (!tp[t]) tp[t] = { n: 0, ok: 0, skill: it.skill, topic: it.topic };
      tp[t].n += w; if (it.ok) tp[t].ok += w;
    });
    function fin(o) { o.pct = o.n ? clampPct(o.ok / o.n * 100) : 0; o.ev = evOf(Math.round(o.n)); return o; }
    Object.keys(sk).forEach(function (s) { fin(sk[s]); });
    Object.keys(kp).forEach(function (k) { fin(kp[k]); });
    Object.keys(tp).forEach(function (k) { fin(tp[k]); });
    var total = fin({ n: tn, ok: tok });
    var covOk = SKILL_KEYS.filter(function (s) { return sk[s].ev === "ok"; }).length;
    var confidence = "low", why = "";
    if (tn >= CONFIG.CONF_HIGH_N && covOk >= 4) { confidence = "high"; why = askT("as_conf_high", "أسئلة كافية وتغطية متوازنة للمهارات"); }
    else if (tn >= CONF_MED_N_SAFE() && covOk >= 2) { confidence = "medium"; why = askT("as_conf_med", "عدد أسئلة معقول لكن التغطية جزئية"); }
    else { why = tn < CONFIG.MIN_OVERALL_N ? askT("as_conf_low_few", "أسئلة قليلة جدًا — النتيجة استرشادية") : askT("as_conf_low_cov", "تغطية المهارات محدودة"); }
    function CONF_MED_N_SAFE() { return CONFIG.CONF_MED_N; }
    var inconclusive = tn < CONFIG.MIN_OVERALL_N;
    return { skills: sk, kaps: kp, topics: tp, total: total, covOk: covOk, confidence: confidence, confWhy: why, inconclusive: inconclusive };
  }

  /* verdict label for a skill/section score (evidence-aware) */
  function statusOf(pct, ev) {
    if (ev !== "ok") return { k: "nodata", ar: askT("as_ev_nodata", "بيانات غير كافية"), ico: "▫️" };
    if (pct >= CONFIG.STRONG_SKILL) return { k: "strong", ar: askT("as_ev_strong", "قوي"), ico: "✅" };
    if (pct >= CONFIG.GOOD_SKILL) return { k: "good", ar: askT("as_ev_good", "جيد"), ico: "🟢" };
    if (pct >= CONFIG.WEAK_SKILL) return { k: "weak", ar: askT("as_ev_weak", "يحتاج مراجعة"), ico: "⚠️" };
    return { k: "poor", ar: askT("as_ev_poor", "ضعيف — ابدأ من هنا"), ico: "🔴" };
  }

  /* stages: [{id:'A'|'B'|'C', pct, n}] in order. Returns level verdict. */
  function levelFromStages(stages) {
    stages = stages || [];
    var tot = 0; stages.forEach(function (s) { tot += s.n || 0; });
    if (!stages.length || tot < CONFIG.MIN_OVERALL_N)
      return { level: "?", confidence: "low", inconclusive: true, note: askT("as_note_inconclusive", "النتيجة غير حاسمة — نحتاج أسئلة إضافية") };
    var passed = stages.filter(function (s) { return (s.pct || 0) >= CONFIG.STAGE_PASS; }).length;
    var last = stages[stages.length - 1];
    var map = { 1: "A1", 2: "A2", 3: "B1" };
    if (!passed) return { level: "A0", confidence: tot >= CONFIG.CONF_MED_N ? "medium" : "low", inconclusive: false, note: askT("as_note_start", "ابدأ من التأسيس (A1 من الصفر)") };
    var lvl = map[passed] || "A1";
    var conf = (tot >= CONFIG.CONF_HIGH_N && (last.pct >= CONFIG.STAGE_PASS + 10 || passed < stages.length)) ? "high" : (tot >= CONFIG.CONF_MED_N ? "medium" : "low");
    return { level: lvl, confidence: conf, inconclusive: false, note: askT("as_note_passed_a", "اجتزت ") + passed + askT("as_note_passed_b", " من ") + stages.length + askT("as_note_passed_c", " مراحل") };
  }

  /* Kapitel readiness: test = {n,ok,pct}|null, prog = 0..100|null.
     readiness = TEST_W*test + PROG_W*prog (renormalized when one is missing).
     Never trusts a Kapitel verdict on < MIN_KAP_TEST_N live answers alone. */
  function kapitelReadiness(test, prog) {
    var hasT = !!(test && test.n >= CONFIG.MIN_KAP_TEST_N);
    var hasP = (typeof prog === "number" && prog !== null);
    if (!hasT && !hasP) return { pct: 0, conf: "none", why: askT("as_ev_nodata2", "لا بيانات") };
    var r, conf;
    if (hasT && hasP) { r = CONFIG.TEST_W_KAP * test.pct + CONFIG.PROG_W_KAP * prog; conf = "high"; }
    else if (hasT) { r = test.pct; conf = test.n >= CONFIG.CONF_MED_N ? "medium" : "low"; }
    else { r = prog; conf = "low"; }
    return { pct: clampPct(r), conf: conf, why: hasT ? (askT("as_ev_test", "اختبار: ") + test.n + askT("as_ev_q", " أسئلة")) : askT("as_ev_prog", "من تقدمك العام فقط") };
  }
  /* order: array of kapitel ids in learning order.
     current = highest kap with readiness >= KAP_READY. */
  function currentKapitel(readinessByKap, order) {
    var cur = null, nxt = null;
    for (var i = 0; i < order.length; i++) {
      var r = readinessByKap[order[i]];
      if (r && r.pct >= CONFIG.KAP_READY) cur = order[i];
      else if (!nxt && r) nxt = order[i];
    }
    var status = !cur ? "start" : (nxt ? "progress" : "advanced");
    return { current: cur, next: nxt, status: status };
  }

  function weakTopics(topics, limit) {
    return Object.keys(topics || {}).map(function (k) { return { key: k, skill: topics[k].skill, topic: topics[k].topic, n: topics[k].n, pct: topics[k].pct }; })
      .filter(function (x) { return x.n >= 2 && x.pct < CONFIG.GOOD_SKILL; })
      .sort(function (a, b) { return a.pct - b.pct; }).slice(0, limit || 6);
  }
  function strongSkills(skills) {
    return SKILL_KEYS.filter(function (s) { return skills[s] && skills[s].ev === "ok" && skills[s].pct >= CONFIG.STRONG_SKILL; });
  }
  function weakSkills(skills) {
    return SKILL_KEYS.filter(function (s) { return skills[s] && skills[s].ev === "ok" && skills[s].pct < CONFIG.GOOD_SKILL; })
      .sort(function (a, b) { return skills[a].pct - skills[b].pct; });
  }

  return { CONFIG: CONFIG, SKILLS: SKILLS, SKILL_KEYS: SKILL_KEYS, shuffled: shuffled, stratify: stratify, scoreAnswers: scoreAnswers, statusOf: statusOf, levelFromStages: levelFromStages, kapitelReadiness: kapitelReadiness, currentKapitel: currentKapitel, weakTopics: weakTopics, strongSkills: strongSkills, weakSkills: weakSkills, clampPct: clampPct, hashSeed: hashSeed, mulberry32: mulberry32, seededRng: seededRng, validateQ: validateQ, filterByDiff: filterByDiff, distribute: distribute };
})();
/* ================= BROWSER LAYER (needs app globals; all lazy) ============ */
DMAssess.ui = (function () {
  "use strict";
  var C = DMAssess;
  /* NOTE: top-level const/let in classic scripts do NOT become window props,
     so window[name] misses banks like KAPITEL/LISTEN_ITEMS. Resolve bare
     identifiers through the global scope instead (cached by reference;
     curriculum merges mutate the same arrays, so caching stays fresh). */
  var __gcache = {};
  function G(name) {
    try {
      if (typeof window !== "undefined" && window[name] !== undefined) return window[name];
      if (__gcache[name] !== undefined) return __gcache[name] === null ? undefined : __gcache[name];
      var v;
      try { v = new Function("return (typeof " + name + " !== 'undefined') ? " + name + " : undefined;")(); } catch (e) { v = undefined; }
      __gcache[name] = (v === undefined ? null : v);
      return v;
    } catch (e) { return undefined; }
  }
  function FN(name) { try { var f = (typeof window !== "undefined" ? window[name] : undefined) || (typeof globalThis !== "undefined" ? globalThis[name] : undefined); return typeof f === "function" ? f : null; } catch (e) { return null; } }
  function esc(s) { try { var f = FN("escapeHtml"); if (f) return f(s); } catch (e) {} return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function say(text) { try { var f = FN("speakGerman") || FN("speak"); if (f) f(text); } catch (e) {} }
  function words() { try { var f = FN("allWords"); return f ? f() : []; } catch (e) { return []; } }
  function shuffle(a) { return C.shuffled(a); }
  /* ---------- indexed bank views + bounded sampling (freeze fix) ----------
     Root cause of the Tests Center "Page Unresponsive" freeze (measured:
     a single Kapitel click blocked the main thread ~18.7s with VOCAB=61k):
     every pool helper rescanned the ENTIRE 60-100k VOCAB / 15k SENTENCES
     banks on EVERY question attempt. buildPool retries each factory 100s of
     times per slot, and probeCount builds a full 120-question test for EACH
     of ~19 category cards per render — tens of thousands of full-bank scans
     plus full-array Fisher-Yates shuffles per click, growing with every
     content expansion.
     Fix (same records, same filters, zero content loss): banks only ever
     append, so a length-stamped index stays exact — one pass per growth,
     O(1) lookups afterwards. Sampling replaces full shuffles: a few random
     indices give the same uniform variety at O(1). buildPool's retry loop
     already provides statistical coverage across attempts. */
  var __poolIdx = null, __poolStamp = "\0";
  function poolStamp() {
    try {
      var vl = -1, sl = -1, gl = -1, fl = -1, cl = 0, rl = -1;
      try { vl = (typeof VOCAB !== "undefined" && VOCAB) ? VOCAB.length : -1; } catch (e0) {}
      try { sl = (typeof SENTENCES !== "undefined" && SENTENCES) ? SENTENCES.length : -1; } catch (e1) {}
      try { gl = (typeof GRAMMAR !== "undefined" && GRAMMAR) ? GRAMMAR.length : -1; } catch (e2) {}
      try { fl = (typeof SENT_FILL !== "undefined" && SENT_FILL) ? SENT_FILL.length : -1; } catch (e3) {}
      try { cl = (typeof S !== "undefined" && S.customWords) ? S.customWords.length : 0; } catch (e4) {}
      try { rl = (typeof CURR_READING !== "undefined" && CURR_READING) ? CURR_READING.length : -1; } catch (e5) {}
      return vl + "/" + sl + "/" + gl + "/" + fl + "/" + cl + "/" + rl;
    } catch (e) { return "err"; }
  }
  function poolIndex() {
    var st = poolStamp();
    if (__poolIdx && __poolStamp === st) return __poolIdx;
    var idx = { all: [], byKap: {}, byLevel: {}, byKapLevel: {}, sAll: [], sByKap: {}, sByLevel: {}, sByKapLevel: {}, fAll: [], fByKap: {}, fByLevel: {}, gByKap: {}, gByLevel: {}, gl: [], glByKap: {}, glByLevel: {}, rByKap: {}, rByLevel: {} };
    function put(m, k, v) { if (m[k]) m[k].push(v); else m[k] = [v]; }
    var ws = [];
    try { ws = words(); } catch (e) {}
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (!w || !w.de) continue;
      var k = w.kap || "?", l = w.level || "A1";
      idx.all.push(w);
      put(idx.byKap, k, w); put(idx.byLevel, l, w); put(idx.byKapLevel, l + "|" + k, w);
    }
    var Ss = [];
    try { Ss = G("SENTENCES") || []; } catch (e2) {}
    for (var j = 0; j < Ss.length; j++) {
      var s = Ss[j];
      if (!s || !s.de) continue;
      var sk = s.kap || "?", sl2 = (s.level || s.lvl) || "A1";
      idx.sAll.push(s);
      put(idx.sByKap, sk, s); put(idx.sByLevel, sl2, s); put(idx.sByKapLevel, sl2 + "|" + sk, s);
    }
    var Fs = [];
    try { Fs = G("SENT_FILL") || []; } catch (e3) {}
    for (var f = 0; f < Fs.length; f++) {
      var fi = Fs[f];
      /* Same validity rule the old fillPool applied per call: a gap item
         must have a ___ blank and >= 3 options. */
      if (!fi || String(fi.s || "").indexOf("___") < 0 || !fi.o || fi.o.length < 3) continue;
      idx.fAll.push(fi);
      put(idx.fByKap, fi.chapterId || "?", fi);
      put(idx.fByLevel, fi.lvl || "A1", fi);
    }
    var Gs = [];
    try { Gs = G("GRAMMAR") || []; } catch (e4) {}
    for (var g = 0; g < Gs.length; g++) {
      var gr = Gs[g];
      if (!gr || !gr.quiz) continue;
      put(idx.gByKap, gr.kap || "?", gr);
      put(idx.gByLevel, gr.level || "A1", gr);
    }
    try {
      var B = G("GLAB_BANK") || {}, gmap = {};
      for (var gi = 0; gi < Gs.length; gi++) if (Gs[gi] && Gs[gi].id) gmap[Gs[gi].id] = Gs[gi];
      Object.keys(B).forEach(function (gid) {
        var b = B[gid];
        if (!b || !b.questions) return;
        var gg = gmap[gid] || null;
        b.questions.forEach(function (q, qi) {
          if (!q || q.type === "order" || !q.opts || !q.opts.length) return;
          var row = { gid: gid, kap: gg ? gg.kap : null, level: gg ? (gg.level || "A1") : "A1", title: gg ? gg.title : gid, q: q, i: qi };
          idx.gl.push(row);
          put(idx.glByKap, row.kap || "?", row);
          put(idx.glByLevel, row.level || "A1", row);
        });
      });
    } catch (e5) {}
    var Rs = [];
    try { Rs = G("CURR_READING") || []; } catch (e6) {}
    for (var ri = 0; ri < Rs.length; ri++) {
      var rr = Rs[ri];
      if (!rr || !rr.de) continue;
      put(idx.rByKap, rr.kap || "?", rr);
      put(idx.rByLevel, rr.level || "A1", rr);
    }
    __poolIdx = idx; __poolStamp = st;
    return idx;
  }
  /* Uniform random pick without shuffling (O(1); same variety as
     shuffle(pool)[0], none of the O(N) cost on 60k+ banks). */
  function pickOne(pool) {
    if (!pool || !pool.length) return null;
    return pool[(Math.random() * pool.length) | 0];
  }
  /* Up to n distinct random items without shuffling (partial Fisher-Yates
     on indices; O(n)). */
  function pickNUnique(pool, n) {
    var out = [];
    if (!pool || !pool.length || n <= 0) return out;
    n = Math.min(n, pool.length);
    var idxs = {}, got = 0, guard = 0;
    while (got < n && guard < n * 10 + 16) {
      guard++;
      var i = (Math.random() * pool.length) | 0;
      if (idxs[i]) continue;
      idxs[i] = 1; out.push(pool[i]); got++;
    }
    return out;
  }
  /* Memoized filtered view of an indexed pool. Key must encode the filter +
     its scope (callers pass kap|level). Scoped to one buildPool call via
     o.memo, so results can never outlive the bank state they were built from. */
  function memoPool(memo, key, pool, pred) {
    if (!memo) return pool.filter(pred);
    var hit = memo[key];
    if (hit) return hit;
    var r = pool.filter(pred);
    memo[key] = r;
    return r;
  }
  function memoKey(o, tag) { return tag + "|" + (o.kap || "*") + "|" + (o.level || "*"); }
  /* Bounded host-sentence search: sample `cap` random sentences first (fast
     path, microseconds); only when sampling finds nothing AND the caller
     asks, fall back to an exhaustive scan. Callers that run inside
     buildPool's retry loop pass false and let retries provide coverage. */
  function findHost(sents, test, cap, exhaustive) {
    if (!sents || !sents.length) return null;
    var n = sents.length, tried = {}, count = 0;
    cap = Math.min(cap || 60, n);
    while (count < cap) {
      var i = (Math.random() * n) | 0;
      if (tried[i]) continue;
      tried[i] = 1; count++;
      if (test(sents[i])) return sents[i];
    }
    if (exhaustive && cap < n) {
      for (var j = 0; j < n; j++) {
        if (tried[j]) continue;
        if (test(sents[j])) return sents[j];
      }
    }
    return null;
  }

  /* ---------- content adapters (real project content only) ---------- */
  function kapitelList() {
    try {
      var K = G("KAPITEL") || [];
      return K.filter(function (k) { return k && k.id && k.id !== "KX"; });
    } catch (e) { return []; }
  }
  function kapLabel(id) {
    try { var f = FN("kapName"); if (f) return f(id); } catch (e) {}
    var k = kapitelList().filter(function (x) { return x.id === id; })[0];
    return k ? (k.icon + " " + k.id + " • " + k.name) : (id || "");
  }
  function vocabPool(o) {
    o = o || {};
    try {
      var idx = poolIndex();
      /* Returned arrays are shared read-only index views (never mutated by
         callers: shuffle/filter/slice all copy). No per-call scan or copy. */
      if (o.kap && o.level) return idx.byKapLevel[o.level + "|" + o.kap] || [];
      if (o.kap) return idx.byKap[o.kap] || [];
      if (o.level) return idx.byLevel[o.level] || [];
      return idx.all;
    } catch (e) {}
    return words().filter(function (w) {
      if (!w || !w.de) return false;
      if (o.kap && (w.kap || "") !== o.kap) return false;
      if (o.level && (w.level || "A1") !== o.level) return false;
      return true;
    });
  }
  function grammarPool(o) {
    o = o || {};
    try {
      var idx = poolIndex();
      if (o.kap) {
        var gk = idx.gByKap[o.kap] || [];
        if (o.level) return gk.filter(function (g) { return (g.level || "A1") === o.level; });
        return gk;
      }
      if (o.level) return idx.gByLevel[o.level] || [];
    } catch (e) {}
    try {
      var Gs = G("GRAMMAR") || [];
      return Gs.filter(function (g) {
        if (!g || !g.quiz) return false;
        if (o.kap && (g.kap || "") !== o.kap) return false;
        if (o.level && (g.level || "A1") !== o.level) return false;
        return true;
      });
    } catch (e2) { return []; }
  }
  function glabPool() {
    try { return poolIndex().gl; } catch (e) {}
    var out = [];
    try {
      var B = G("GLAB_BANK") || {}, GR = G("GRAMMAR") || [];
      Object.keys(B).forEach(function (gid) {
        var b = B[gid]; if (!b || !b.questions) return;
        var g = null;
        try { g = GR.filter(function (x) { return x.id === gid; })[0]; } catch (e) {}
        b.questions.forEach(function (q, i) {
          if (!q || q.type === "order" || !q.opts || !q.opts.length) return;
          out.push({ gid: gid, kap: g ? g.kap : null, level: g ? (g.level || "A1") : "A1", title: g ? g.title : gid, q: q, i: i });
        });
      });
    } catch (e2) {}
    return out;
  }
  function sentPool(o) {
    o = o || {};
    try {
      var idx = poolIndex();
      if (o.kap && o.level) return idx.sByKapLevel[(o.level || "A1") + "|" + o.kap] || [];
      if (o.kap) return idx.sByKap[o.kap] || [];
      if (o.level) return idx.sByLevel[o.level] || [];
      return idx.sAll;
    } catch (e) {}
    try {
      var Ss = G("SENTENCES") || [];
      return Ss.filter(function (s) {
        if (!s || !s.de) return false;
        if (o.kap && (s.kap || "") !== o.kap) return false;
        if (o.level && ((s.level || s.lvl) || "A1") !== o.level) return false;
        return true;
      });
    } catch (e2) { return []; }
  }
  function fillPool(o) {
    o = o || {};
    try {
      var idx = poolIndex();
      if (o.kap) return idx.fByKap[o.kap] || [];
      if (o.level) return idx.fByLevel[o.level] || [];
      return idx.fAll;
    } catch (e) {}
    try {
      var Fs = G("SENT_FILL") || [];
      return Fs.filter(function (f) {
        if (!f || String(f.s || "").indexOf("___") < 0 || !f.o || f.o.length < 3) return false;
        if (o.kap && (f.chapterId || "") !== o.kap) return false;
        if (o.level && (f.lvl || "A1") !== o.level) return false;
        return true;
      });
    } catch (e2) { return []; }
  }
  function readingPool(o) {
    o = o || {};
    try {
      var idx = poolIndex();
      if (o.kap) {
        var rk = idx.rByKap[o.kap] || [];
        if (o.level) return rk.filter(function (r) { return (r.level || "A1") === o.level; });
        return rk;
      }
      if (o.level) return idx.rByLevel[o.level] || [];
    } catch (e) {}
    try {
      var R = G("CURR_READING") || [];
      return R.filter(function (r) {
        if (!r || !r.de) return false;
        if (o.kap && (r.kap || "") !== o.kap) return false;
        if (o.level && (r.level || "A1") !== o.level) return false;
        return true;
      });
    } catch (e2) { return []; }
  }
  function listenPool() { try { return G("LISTEN_ITEMS") || []; } catch (e) { return []; } }
  function speakPool() { try { return G("SPEAK_ITEMS") || []; } catch (e) { return []; } }
  function talkPool() { try { return G("TALK_SITS") || []; } catch (e) { return []; } }
  function realPool() { try { return G("REAL_SITS") || []; } catch (e) { return []; } }
  function levelWordCount(lvl) { return vocabPool({ level: lvl }).length; }
  function levelGrammarCount(lvl) { return grammarPool({ level: lvl }).length + glabPool().filter(function (x) { return x.level === lvl; }).length; }
  function levelUnlocked(lvl) {
    if (lvl === "A1") return { ok: true };
    var w = levelWordCount(lvl), g = levelGrammarCount(lvl);
    if (w >= C.CONFIG.LVL_GATE_WORDS && g >= C.CONFIG.LVL_GATE_GRAMMAR) return { ok: true, words: w, grammar: g };
    return { ok: false, words: w, grammar: g };
  }

  var __qid = 0;
  function QID(p) { __qid++; return (p || "q") + "-" + Date.now().toString(36) + "-" + __qid; }
  function fullDe(w) { try { var f = FN("fullDe"); if (f) return f(w); } catch (e) {} return ((w.art && w.art !== "-") ? w.art + " " : "") + w.de; }
  /* Bounded unique sampling (no full shuffle): same uniform variety at O(n).
     Retries are capped; when the pool is too small or repetitive the caller
     gets fewer distractors and bails honestly (null), as before. */
  function distractAr(pool, right, n) {
    var out = [], seen = {};
    seen[right] = 1;
    n = n || 3;
    if (!pool || !pool.length) return out;
    var tries = 0, maxTries = Math.max(24, n * 12);
    while (out.length < n && tries < maxTries) {
      tries++;
      var w = pool[(Math.random() * pool.length) | 0];
      if (!w || !w.ar || seen[w.ar]) continue;
      seen[w.ar] = 1; out.push(w.ar);
    }
    return out;
  }
  function distractDe(pool, right, n) {
    var out = [], seen = {};
    seen[right] = 1;
    n = n || 3;
    if (!pool || !pool.length) return out;
    var tries = 0, maxTries = Math.max(24, n * 12);
    while (out.length < n && tries < maxTries) {
      tries++;
      var w = pool[(Math.random() * pool.length) | 0];
      if (!w) continue;
      var d = fullDe(w);
      if (!d || seen[d]) continue;
      seen[d] = 1; out.push(d);
    }
    return out;
  }
  function baseQ(type, skill, src) {
    return {
      id: QID("as"), type: type, skill: skill,
      topic: src.topic || skill, topicAr: src.topicAr || src.topic || skill,
      kap: src.kap || null, level: src.level || "A1",
      diff: src.diff || "medium", why: src.why || "",
      refId: src.refId || null, refKind: src.refKind || null, gid: src.gid || null
    };
  }

  /* ---------- question factories (null = not enough real content) ---------- */
  function mkVocabMean(o) {
    var pool = vocabPool(o);
    if (pool.length < 4) return null;
    var w = pickOne(pool);
    var opts = shuffle([wMean(w)].concat(distractMean(pool, w, 3)));
    if (opts.length < 4) return null;
    var q = baseQ("mc", "vocab", { topic: "meaning", topicAr: "معاني الكلمات", kap: w.kap, level: w.level || "A1", diff: "easy", refId: w.id, refKind: "word" });
    q.prompt = askT("as_q_meaning", "ما معنى: ") + fullDe(w) + askT("as_q_mark", "؟");
    q.de = fullDe(w); q.opts = opts; q.correct = opts.indexOf(wMean(w));
    q.why = fullDe(w) + " = " + wMean(w);
    return q;
  }
  function mkArticle(o) {
    var pool = memoPool(o.memo, memoKey(o, "art"), vocabPool(o), function (w) { return w.art && w.art !== "-" && /^[A-ZÄÖÜ]/.test(w.de || ""); });
    if (!pool.length) return null;
    var w = pickOne(pool);
    var base = shuffle(["der", "die", "das"]);
    var q = baseQ("mc", "vocab", { topic: "article", topicAr: "الأدوات der/die/das", kap: w.kap, level: w.level || "A1", diff: "easy", refId: w.id, refKind: "word" });
    q.prompt = askT("as_q_article", "اختر الأداة الصحيحة: ___ ") + w.de;
    q.de = w.de; q.opts = base; q.correct = base.indexOf(w.art);
    q.why = w.art + " " + w.de + " = " + wMean(w) + ". " + askT("as_q_article_why", "تُحفظ الأداة مع الاسم دائمًا.");
    return q;
  }
  function mkPlural(o) {
    var pool = memoPool(o.memo, memoKey(o, "pl"), vocabPool(o), function (w) { return w.art && w.art !== "-" && w.plural; });
    if (!pool.length) return null;
    var w = pickOne(pool);
    function pfull(x) { var p = String(x.plural || ""); if (/^(der|die|das)\s/.test(p)) return p; return "die " + p; }
    var right = pfull(w), set = {}, opts = [right];
    set[right] = 1;
    ["die " + w.de, (w.art === "der" ? "die " : "der ") + String(w.plural).replace(/^(der|die|das)\s+/, ""), "das " + w.de].forEach(function (c) { if (opts.length < 4 && !set[c]) { set[c] = 1; opts.push(c); } });
    if (opts.length < 3) return null;
    var q = baseQ("mc", "vocab", { topic: "plural", topicAr: "الجمع Plural", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
    q.prompt = askT("as_q_plural", "ما جمع: ") + fullDe(w) + askT("as_q_mark", "؟");
    q.de = fullDe(w); q.opts = shuffle(opts); q.correct = q.opts.indexOf(right);
    q.why = askT("as_q_plural_why", "الجمع: ") + right + " (" + wMean(w) + ")";
    return q;
  }
  function mkTranslate(o) {
    var pool = vocabPool(o);
    if (pool.length < 4) return null;
    var w = pickOne(pool);
    var opts = shuffle([fullDe(w)].concat(distractDe(pool, fullDe(w), 3)));
    if (opts.length < 4) return null;
    var q = baseQ("mc", "vocab", { topic: "translation", topicAr: "الترجمة عربي ← ألماني", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
    q.prompt = askT("as_q_translate", "اختر الكلمة الألمانية الصحيحة: ") + wMean(w);
    q.opts = opts; q.correct = opts.indexOf(fullDe(w));
    q.why = fullDe(w) + " = " + wMean(w);
    return q;
  }
  function mkTF(o) {
    var pool = vocabPool(o);
    if (pool.length < 2) return null;
    var w = pickOne(pool);
    var truth = Math.random() < 0.5;
    /* Bounded distinct pick (freeze fix): sample instead of filtering +
       shuffling the whole kap pool per attempt. */
    var claim = truth ? wMean(w) : null;
    if (!truth) {
      for (var ti = 0; ti < 24 && claim == null; ti++) {
        var cand = pickOne(pool);
        if (cand && cand.id !== w.id && wMean(cand) && wMean(cand) !== wMean(w)) claim = wMean(cand);
      }
    }
    if (!claim) return null;
    var q = baseQ("tf", "vocab", { topic: "meaning", topicAr: "صح أم خطأ — المفردات", kap: w.kap, level: w.level || "A1", diff: "easy", refId: w.id, refKind: "word" });
    q.prompt = askT("as_q_tf", "صح أم خطأ: ") + fullDe(w) + " = " + claim + askT("as_q_mark", "؟");
    q.de = fullDe(w); q.opts = shuffle([askT("as_q_true", "صح ✅"), askT("as_q_false", "خطأ ❌")]); q.correct = q.opts.indexOf(truth ? askT("as_q_true", "صح ✅") : askT("as_q_false", "خطأ ❌"));
    q.why = fullDe(w) + " = " + wMean(w);
    return q;
  }
  function mkGrammar(o) {
    var gs = grammarPool(o);
    var gl = glabPool().filter(function (x) {
      if (o.kap && x.kap !== o.kap) return false;
      if (o.level && x.level !== o.level) return false;
      return true;
    });
    var useGlab = gl.length && (!gs.length || Math.random() < 0.5);
    if (useGlab) {
      var it = pickOne(gl), gq = it.q;
      var order = shuffle(gq.opts.map(function (_, i) { return i; }));
      var q = baseQ("mc", "grammar", { topic: it.gid, topicAr: it.title || it.gid, kap: it.kap, level: it.level, diff: "medium", gid: it.gid });
      q.prompt = "📐 " + (it.title ? it.title + ": " : "") + gq.t;
      if (gq.ar) q.promptAr = gq.ar;
      q.opts = order.map(function (i) { return gq.opts[i]; }); q.correct = order.indexOf(gq.correct);
      q.why = gq.why || "";
      return q;
    }
    if (!gs.length) return null;
    var g = pickOne(gs);
    var ord = shuffle(g.quiz.opts.map(function (_, i) { return i; }));
    var q2 = baseQ("mc", "grammar", { topic: g.id, topicAr: g.title, kap: g.kap, level: g.level || "A1", diff: "medium", gid: g.id });
    q2.prompt = "📐 " + g.title + ": " + g.quiz.q;
    q2.opts = ord.map(function (i) { return g.quiz.opts[i]; }); q2.correct = ord.indexOf(g.quiz.correct);
    q2.why = g.quiz.explain || "";
    return q2;
  }
  function conjVerbForm(inf) {
    try { var f = FN("conjugateVerb"); if (!f) return null; return f(inf); } catch (e) { return null; }
  }
  function lastTok(s) { var p = String(s || "").trim().split(/\s+/); return p[p.length - 1] || ""; }
  function mkVerb(o) {
    var pool = memoPool(o.memo, memoKey(o, "verb"), vocabPool(o), function (w) { return w.type === "فعل"; });
    if (!pool.length) return null;
    /* Bounded search (freeze fix): try a few sampled verbs with a sampled
       host-sentence lookup instead of scanning every verb x every sentence.
       buildPool retries this factory 100s of times per slot, so coverage
       across a build stays complete; a single attempt stays sub-millisecond. */
    var sents = sentPool(o);
    var tried = {}, attempts = 0;
    while (attempts < 6) {
      attempts++;
      var vi = (Math.random() * pool.length) | 0;
      if (tried[vi]) continue;
      tried[vi] = 1;
      var w = pool[vi], conj = conjVerbForm(w.de);
      if (!conj) continue;
      var subs = ["Ich", "Du", "Er", "Wir", "Ihr"], persons = ["ich", "du", "er", "wir", "ihr"];
      var pi = Math.floor(Math.random() * subs.length);
      var form = lastTok(conj[persons[pi]]);
      if (!form) continue;
      var sub = subs[pi];
      var host = findHost(sents, function (sn) {
        return (" " + sn.de + " ").indexOf(" " + form + " ") >= 0 && sn.de.indexOf(sub) === 0;
      }, 60, false);
      var tail = "";
      if (host) {
        var rest = host.de.slice(sub.length).trim();
        if (rest.indexOf(form) === 0) tail = rest.slice(form.length);
      }
      var distract = [];
      persons.forEach(function (p, i) { if (i !== pi) { var f2 = lastTok(conj[p]); if (f2 && f2 !== form && distract.indexOf(f2) < 0) distract.push(f2); } });
      if (!distract.length) distract.push(w.de);
      while (distract.length < 3) distract.push(w.de);
      var opts = shuffle([form].concat(distract.slice(0, 3)));
      var q = baseQ("mc", "grammar", { topic: "conjugation", topicAr: "تصريف الأفعال", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
      q.prompt = askT("as_q_conj", "اختر التصريف الصحيح: ") + subs[pi] + askT("as_q_conj_mid", " ___") + tail + " (" + wMean(w) + ")";
      q.de = subs[pi] + " " + form + tail; q.opts = opts; q.correct = opts.indexOf(form);
      q.why = askT("as_q_say_w", "مع ") + subs[pi] + askT("as_q_say_s", " نقول: ") + subs[pi] + " " + form + (host ? askT("as_q_say_ex", " — مثال حقيقي: ") + host.de : "");
      return q;
    }
    return null;
  }
  function mkError(o) {
    /* تصحيح الخطأ: wrong sentence shown, pick the fix (verb-based, real). */
    var pool = memoPool(o.memo, memoKey(o, "verb"), vocabPool(o), function (w) { return w.type === "فعل"; });
    if (!pool.length) return null;
    /* Bounded search (freeze fix): same rationale as mkVerb — a few sampled
       verbs + sampled host lookup per attempt, retries provide coverage. */
    var sents = sentPool(o);
    var tried = {}, attempts = 0;
    while (attempts < 6) {
      attempts++;
      var vi = (Math.random() * pool.length) | 0;
      if (tried[vi]) continue;
      tried[vi] = 1;
      var w = pool[vi], conj = conjVerbForm(w.de);
      if (!conj) continue;
      var erF = lastTok(conj.er), ichF = lastTok(conj.ich);
      if (!erF || !ichF || erF === ichF) continue;
      var host = findHost(sents, function (sn) {
        return sn.de.indexOf("Er " + erF) === 0 || sn.de.indexOf("Er " + erF + " ") >= 0;
      }, 60, false);
      if (!host) continue;
      var wrong = host.de.replace("Er " + erF, "Er " + w.de);
      if (wrong === host.de) continue;
      var opts = shuffle([host.de, wrong, host.de.replace("Er " + erF, "Er " + ichF)]);
      var uni = [];
      opts.forEach(function (x) { if (uni.indexOf(x) < 0) uni.push(x); });
      if (uni.length < 2) continue;
      var q = baseQ("mc", "grammar", { topic: "correction", topicAr: "تصحيح الخطأ", kap: w.kap, level: w.level || "A1", diff: "hard", refId: w.id, refKind: "word" });
      q.prompt = askT("as_q_fix", "الجملة فيها خطأ: «") + wrong + askT("as_q_fix_mid", "» — اختر التصحيح الصحيح:");
      q.de = wrong; q.opts = uni; q.correct = uni.indexOf(host.de);
      q.why = askT("as_q_right_is", "الصحيح: ") + host.de + askT("as_q_er_end", " — مع Er يأخذ الفعل نهاية خاصة (") + erF + ").";
      return q;
    }
    return null;
  }
  function mkOrder(o) {
    var pool = memoPool(o.memo, memoKey(o, "ord"), sentPool(o), function (s) {
      var n = String(s.de || "").replace(/[.?!,]/g, "").split(" ").filter(Boolean).length;
      return n >= 4 && n <= 10;
    });
    if (!pool.length) return null;
    var s = pickOne(pool);
    var parts = shuffle(String(s.de).replace(/[.?!,]/g, "").split(" ").filter(Boolean));
    var q = baseQ("order", "sentences", { topic: "word-order", topicAr: "ترتيب الجملة", kap: s.kap, level: (s.level || s.lvl) || "A1", diff: "medium", refId: s.id, refKind: "sentence" });
    q.prompt = askT("as_q_order", "🔀 رتّب الكلمات لتكوين جملة صحيحة (") + sMean(s) + askT("as_q_order_end", "):");
    q.promptAr = s.ar; q.chips = parts; q.answer = String(s.de).replace(/[.?!,]/g, "").trim();
    q.why = askT("as_q_order_why", "الجملة الصحيحة: ") + s.de;
    return q;
  }
  function mkSentenceGap(o) {
    /* إكمال الجملة: real SENT_FILL gap items (mc over the 4 options). */
    var pool = fillPool(o);
    if (!pool.length) return null;
    var f = pickOne(pool);
    var skill = "sentences", topic = "gap", topicAr = "إكمال الجمل";
    var gt = String(f.grammarTarget || f.typ || "");
    if (/article/.test(gt)) { skill = "grammar"; topic = "article"; topicAr = "الأدوات في السياق"; }
    else if (/verb|conjug/.test(gt)) { skill = "grammar"; topic = "conjugation"; topicAr = "الأفعال في السياق"; }
    else if (/meaning|vocab/.test(gt)) { skill = "vocab"; topic = "context"; topicAr = "الكلمة في السياق"; }
    var q = baseQ("mc", skill, { topic: topic, topicAr: topicAr, kap: f.chapterId, level: f.lvl || "A1", diff: "medium", refId: f.id, refKind: "fill" });
    q.prompt = askT("as_q_complete", "🧩 أكمل: ") + f.s;
    q.de = f.s; q.opts = f.o.slice(); q.correct = f.c;
    q.why = f.why || (askT("as_q_answer", "الإجابة: ") + f.o[f.c]);
    return q;
  }
  function mkFillWrite(o) {
    /* ✍️ الكتابة: type the missing article/word (writing skill). */
    var pool = fillPool(o).filter(function (f) { return /article/.test(String(f.grammarTarget || f.typ || "")); });
    if (!pool.length) pool = fillPool(o);
    if (!pool.length) return null;
    var f = pickOne(pool);
    var q = baseQ("fill", "writing", { topic: "writing", topicAr: "الكتابة والإملاء", kap: f.chapterId, level: f.lvl || "A1", diff: "medium", refId: f.id, refKind: "fill" });
    q.prompt = askT("as_q_write", "✍️ اكتب الكلمة الناقصة: ") + f.s;
    q.de = f.s; q.accept = [String(f.o[f.c])]; q.answer = String(f.o[f.c]);
    q.why = f.why || (askT("as_q_answer", "الإجابة: ") + f.o[f.c]);
    return q;
  }
  function mkReading(o) {
    var rs = readingPool(o).filter(function (r) { return r.qs && r.qs.length; });
    if (rs.length) {
      var r = pickOne(rs), qq = pickOne(r.qs);
      if (!qq.opts || qq.opts.length < 2) return null;
      var q = baseQ("read", "reading", { topic: "comprehension", topicAr: "فهم المقروء", kap: r.kap, level: r.level || "A1", diff: "medium", refId: r.id, refKind: "reading" });
      q.passage = (r.title ? r.title + "\n" : "") + String(r.de).slice(0, 600);
      q.passageAr = r.ar ? String(r.ar).slice(0, 300) : "";
      q.prompt = "📖 " + qq.q;
      q.opts = qq.opts.slice(); q.correct = qq.correct;
      q.why = askT("as_q_read_why", "الإجابة من النص: ") + (r.title || "") + " — " + q.opts[q.correct];
      return q;
    }
    /* fallback: real sentence as micro-text + meaning question */
    var pool = memoPool(o.memo, memoKey(o, "sent5"), sentPool(o), function (s) { return String(s.de || "").split(" ").length >= 5; });
    if (pool.length < 4) return null;
    var s = pickOne(pool);
    /* Distractor source stays the full bank (same variety as before); the
       bounded sampler makes it O(1) instead of a 60k+ shuffle per attempt. */
    var opts = shuffle([sMean(s)].concat(distractMean(vocabPool({}), {ar: sMean(s)}, 3)));
    if (opts.length < 4) return null;
    var q2 = baseQ("read", "reading", { topic: "comprehension", topicAr: "فهم المقروء", kap: s.kap, level: (s.level || s.lvl) || "A1", diff: "easy", refId: s.id, refKind: "sentence" });
    q2.passage = s.de; q2.prompt = askT("as_q_read", "📖 اقرأ ثم اختر المعنى الصحيح:");
    q2.opts = opts; q2.correct = opts.indexOf(sMean(s));
    q2.why = s.de + " = " + sMean(s);
    return q2;
  }
  function mkListening(o) {
    var pool = listenPool();
    if (pool.length < 4) return null;
    var it = pickOne(pool);
    var others = pickNUnique(pool.filter(function (x) { return x !== it; }), 3).map(function (x) { return wMean(x); });
    var opts = shuffle([wMean(it)].concat(others));
    var q = baseQ("listen", "listening", { topic: "listening", topicAr: "الفهم السمعي", kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q.prompt = askT("as_q_listen", "🎧 استمع واختر المعنى الصحيح:");
    q.listenText = it.de; q.opts = opts; q.correct = opts.indexOf(wMean(it));
    q.why = it.de + " = " + wMean(it);
    return q;
  }
  function mkSpeaking(o) {
    var pool = speakPool();
    if (!pool.length) return null;
    var it = pickOne(pool);
    var q = baseQ("speak", "speaking", { topic: "speaking", topicAr: "التحدث", kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q.prompt = askT("as_q_speak", "🎤 أجب بالألمانية: ") + it.q;
    q.promptAr = it.ar; q.sample = it.sample;
    q.why = askT("as_q_speak_why", "مثال إجابة: ") + it.sample;
    return q;
  }
  function speakKeywords(sample) {
    var stop = {};
    try { var ss = G("SP_STOP"); if (ss && ss.length) ss.forEach(function (w) { stop[w] = 1; }); } catch (e) {}
    ["ich", "du", "er", "sie", "es", "wir", "ihr", "der", "die", "das", "ein", "eine", "und", "ist", "sind", "bin", "nicht", "kein", "keine", "im", "in", "am", "ja", "nein"].forEach(function (w) { stop[w] = 1; });
    return String(sample || "").toLowerCase().replace(/[?!.,;:"„“»«']/g, "").split(/\s+/).filter(function (w) { return w.length > 3 && !stop[w]; });
  }
  function gradeSpeaking(text, sample) {
    try {
      var f = FN("evaluateSpoken");
      if (f) { var ev = f(text, sample); return { pct: ev.vocab || 0, notes: (ev.notes || []).join(" ") + (ev.missing && ev.missing.length ? askT("as_q_missing", " — ناقصك: ") + ev.missing.join(askLang()==="en"||askLang()==="de" ? ", " : "، ") : "") }; }
    } catch (e) {}
    var tw = String(text || "").toLowerCase().split(/\s+/).filter(Boolean);
    var keys = speakKeywords(sample);
    if (!keys.length) return { pct: tw.length >= 2 ? 70 : 0, notes: "" };
    var hit = keys.filter(function (k) { return tw.indexOf(k) >= 0; });
    return { pct: Math.round(hit.length / keys.length * 100), notes: "" };
  }
  function mkSituation(o) {
    var sits = talkPool();
    if (sits.length) {
      var s = shuffle(sits)[0];
      var steps = (s.steps || []).filter(function (st) { return st[2] && st[2].length >= 3; });
      if (steps.length) {
        var st = shuffle(steps)[0];
        var ord = shuffle(st[2].map(function (_, i) { return i; }));
        var q = baseQ("mc", "practical", { topic: "situation:" + s.id, topicAr: "مواقف: " + s.t, kap: o.kap || null, level: o.level || "A1", diff: "medium" });
        q.prompt = "🌍 " + s.t + askT("as_q_says", " — يقول لك: «") + st[0] + "» (" + st[1] + ")" + askT("as_q_sit", " — ما أفضل رد؟");
        q.de = st[0]; q.opts = ord.map(function (i) { return st[2][i]; }); q.correct = ord.indexOf(st[3]);
        q.why = askT("as_q_sit_why", "أفضل رد: ") + st[2][st[3]];
        return q;
      }
    }
    var rs = realPool();
    if (!rs.length) return null;
    var r = pickOne(rs);
    var phrs = (r.phr || []).filter(function (p) { return p[0] && p[1]; });
    if (phrs.length < 3) return null;
    var pick = pickOne(phrs);
    var distract = pickNUnique(phrs.filter(function (p) { return p !== pick; }), 3).map(function (p) { return p[0]; });
    var opts = shuffle([pick[0]].concat(distract));
    if (opts.length < 3) return null;
    var q2 = baseQ("mc", "practical", { topic: "situation:" + r.id, topicAr: "مواقف: " + r.t, kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q2.prompt = "🌍 " + r.t + " — «" + pick[1] + "»" + askT("as_q_dialog", " — ماذا تقول بالألمانية؟");
    q2.opts = opts; q2.correct = opts.indexOf(pick[0]);
    q2.why = pick[0] + " = " + pick[1];
    return q2;
  }
  function mkMatch(o) {
    var pool = vocabPool(o);
    if (pool.length < 6) return null;
    var ws = pickNUnique(pool, 4);
    if (ws.some(function (w) { return !w.ar; })) return null;
    var q = baseQ("match", "vocab", { topic: "match", topicAr: "التوصيل ألماني ↔ عربي", kap: ws[0].kap, level: o.level || "A1", diff: "medium" });
    q.prompt = askT("as_q_match", "🔗 وصّل كل كلمة بمعناها:");
    q.pairs = ws.map(function (w) { return { de: fullDe(w), ar: wMean(w), id: w.id }; });
    q.why = ws.map(function (w) { return fullDe(w) + " = " + wMean(w); }).join(" • ");
    return q;
  }
  function mkKein(o) {
    /* النفي: kein / keine / nicht — from real nouns + real rule. */
    var pool = memoPool(o.memo, memoKey(o, "kein"), vocabPool(o), function (w) { return w.type === "اسم" && w.art && w.art !== "-" && /^[A-ZÄÖÜ]/.test(w.de || ""); });
    if (pool.length < 3) return null;
    var w = pickOne(pool);
    var useNicht = Math.random() < 0.35;
    var right, wrongs, sentence;
    if (useNicht) {
      right = "nicht"; wrongs = ["kein", "keine"];
      sentence = "Ich lerne heute ___ . (" + wMean(w) + askT("as_q_kein_note", " — الجملة فعلية بدون اسم)");
    } else {
      right = (w.art === "die") ? "keine" : "kein";
      wrongs = [right === "kein" ? "keine" : "kein", "nicht"];
      sentence = "Ich habe ___ " + w.de + ". (" + w.ar + ")";
    }
    var opts = shuffle([right].concat(wrongs));
    var q = baseQ("mc", "grammar", { topic: "negation", topicAr: "النفي kein / nicht", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
    q.prompt = askT("as_q_neg", "اختر النفي الصحيح: ") + sentence;
    q.de = sentence; q.opts = opts; q.correct = opts.indexOf(right);
    q.why = useNicht
      ? askT("as_q_neg_verb", "nicht تنفي الفعل/الجملة: Ich lerne heute nicht.")
      : askT("as_q_neg_noun", "قبل الأسماء نستخدم kein/keine (وليس nicht): ") + (w.art === "die" ? "keine " + w.de : "kein " + w.de) + " — " + wMean(w);
    return q;
  }
  function mkConj(o) {
    /* تصريف الأفعال: pronoun rows (ich/du/er...) each with 3 form options. */
    var pool = memoPool(o.memo, memoKey(o, "verb"), vocabPool(o), function (w) { return w.type === "فعل"; });
    if (!pool.length) return null;
    /* Bounded search (freeze fix): sample verbs instead of shuffling the
       whole pool; retries across buildPool attempts provide coverage. */
    var persons = [["ich", "Ich"], ["du", "Du"], ["er", "Er"], ["wir", "Wir"]];
    var tried = {}, attempts = 0;
    while (attempts < 8) {
      attempts++;
      var vi = (Math.random() * pool.length) | 0;
      if (tried[vi]) continue;
      tried[vi] = 1;
      var w = pool[vi], conj = conjVerbForm(w.de);
      if (!conj) continue;
      var forms = {};
      persons.forEach(function (p) { forms[p[0]] = lastTok(conj[p[0]]); });
      if (!forms.ich || !forms.er || forms.ich === forms.er) continue;
      var picks = shuffle(persons).slice(0, 2);
      var rows = [], okAll = true;
      picks.forEach(function (p) {
        var right = forms[p[0]];
        var distract = [];
        persons.forEach(function (q2) { if (q2[0] !== p[0] && forms[q2[0]] && forms[q2[0]] !== right && distract.indexOf(forms[q2[0]]) < 0) distract.push(forms[q2[0]]); });
        if (distract.length < 2) { okAll = false; return; }
        var opts = shuffle([right].concat(distract.slice(0, 2)));
        rows.push({ pron: p[1], key: p[0], opts: opts, correct: opts.indexOf(right) });
      });
      if (!okAll || rows.length < 2) continue;
      var q = baseQ("conj", "grammar", { topic: "conjugation", topicAr: "تصريف الأفعال ich/du/er", kap: w.kap, level: w.level || "A1", diff: "medium", refId: w.id, refKind: "word" });
      q.prompt = askT("as_q_conj_all", "⚡ صرّف الفعل (") + w.de + " — " + wMean(w) + askT("as_q_conj_all_mid", ") مع كل ضمير:");
      q.rows = rows;
      q.why = picks.map(function (p) { return p[1] + " " + forms[p[0]]; }).join(" • ");
      return q;
    }
    return null;
  }
  function mkWordClass(o) {
    /* أقسام الكلام: Verb / Nomen / Adjektiv from real word types. */
    var pool = memoPool(o.memo, memoKey(o, "wc"), vocabPool(o), function (w) { return w.type === "فعل" || w.type === "اسم" || w.type === "صفة"; });
    if (pool.length < 4) return null;
    var w = pickOne(pool);
    var arOf = { "فعل": "فعل Verb", "اسم": "اسم Nomen", "صفة": "صفة Adjektiv" };
    var others = ["فعل", "اسم", "صفة"].filter(function (t) { return t !== w.type; });
    var opts = shuffle([arOf[w.type]].concat(others.map(function (t) { return arOf[t]; })));
    var q = baseQ("mc", "vocab", { topic: "wordclass", topicAr: "أقسام الكلام", kap: w.kap, level: w.level || "A1", diff: "easy", refId: w.id, refKind: "word" });
    q.prompt = askT("as_q_wclass", "ما نوع الكلمة: ") + fullDe(w) + " (" + wMean(w) + askT("as_q_wclass_mid", ")؟");
    q.de = fullDe(w); q.opts = opts; q.correct = opts.indexOf(arOf[w.type]);
    q.why = fullDe(w) + askT("as_q_wclass_is", " نوعها: ") + arOf[w.type];
    return q;
  }
  function mkSentMean(o) {
    /* معنى الجملة: real sentence -> Arabic meaning options. */
    var pool = memoPool(o.memo, memoKey(o, "sent5"), sentPool(o), function (s) { return String(s.de || "").split(" ").length >= 5; });
    if (pool.length < 4) return null;
    var s = pickOne(pool);
    var opts = shuffle([sMean(s)].concat(distractMean(vocabPool({}), {ar: sMean(s)}, 3)));
    if (opts.length < 4) return null;
    var q = baseQ("mc", "sentences", { topic: "sentmean", topicAr: "معنى الجملة", kap: s.kap, level: (s.level || s.lvl) || "A1", diff: "easy", refId: s.id, refKind: "sentence" });
    q.prompt = askT("as_q_sentmean", "💬 ما معنى الجملة: «") + s.de + askT("as_q_sentmean_end", "»؟");
    q.de = s.de; q.opts = opts; q.correct = opts.indexOf(sMean(s));
    q.why = s.de + " = " + sMean(s);
    return q;
  }
  function mkDialogue(o) {
    /* أكمل الحوار: real TALK_SITS continuation with previous turn as context. */
    var sits = talkPool().filter(function (s) { return s.steps && s.steps.length >= 2; });
    if (!sits.length) return null;
    var s = shuffle(sits)[0];
    var valid = [];
    for (var i = 1; i < s.steps.length; i++) {
      if (s.steps[i][2] && s.steps[i][2].length >= 3) valid.push(i);
    }
    if (!valid.length) return null;
    var i2 = shuffle(valid)[0], prev = s.steps[i2 - 1], st = s.steps[i2];
    var ord = shuffle(st[2].map(function (_, i3) { return i3; }));
    var q = baseQ("mc", "practical", { topic: "dialogue:" + s.id, topicAr: "إكمال الحوار: " + s.t, kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q.prompt = askT("as_q_dlg", "🗣️ أكمل الحوار (") + s.t + askT("as_q_dlg_said", ") — قال: «") + prev[0] + askT("as_q_dlg_you", "» فأجبت: «") + prev[2][prev[3]] + askT("as_q_dlg_then", "» — ثم قال: «") + st[0] + askT("as_q_dlg_st", "» (") + st[1] + askT("as_q_dlg_ask", ") — ما ردك؟");
    q.de = st[0]; q.opts = ord.map(function (i4) { return st[2][i4]; }); q.correct = ord.indexOf(st[3]);
    q.why = askT("as_q_dlg_why", "الرد الطبيعي: ") + st[2][st[3]];
    return q;
  }
  function mkListenGap(o) {
    /* استماع بكلمة ناقصة: hear the sentence, pick the missing word. */
    var pool = listenPool().filter(function (x) { return x.de && x.de.split(" ").length >= 4; });
    if (pool.length < 4) return null;
    var it = pickOne(pool);
    var toks = it.de.replace(/[.?!,]/g, "").split(" ").filter(Boolean);
    var cands = toks.map(function (t, i) { return i; }).filter(function (i) { return toks[i].length > 3 && i > 0 && i < toks.length - 1; });
    if (!cands.length) return null;
    var bi = pickOne(cands), missing = toks[bi];
    /* Bounded word collection (freeze fix): sample random sentences instead
       of shuffling the whole pool per attempt. */
    var others = [], seenOw = {}, owTries = 0;
    seenOw[missing.toLowerCase()] = 1;
    while (others.length < 12 && owTries < 200) {
      owTries++;
      var xs = pool[(Math.random() * pool.length) | 0];
      if (!xs || xs === it) continue;
      var parts = String(xs.de || "").replace(/[.?!,]/g, "").split(" ");
      for (var pi2 = 0; pi2 < parts.length && others.length < 12; pi2++) {
        var tt = parts[pi2];
        if (tt.length > 3 && !seenOw[tt.toLowerCase()]) { seenOw[tt.toLowerCase()] = 1; others.push(tt); }
      }
    }
    if (others.length < 3) return null;
    var opts = shuffle([missing].concat(pickNUnique(others, 3)));
    var blanked = toks.slice(); blanked[bi] = "___";
    var q = baseQ("mc", "listening", { topic: "listen-gap", topicAr: "الكلمة الناقصة سمعيًا", kap: o.kap || null, level: o.level || "A1", diff: "medium" });
    q.prompt = askT("as_q_gap_listen", "🎧 استمع للجملة واختر الكلمة الناقصة: ") + blanked.join(" ");
    q.listenText = it.de; q.opts = opts; q.correct = opts.indexOf(missing);
    q.why = askT("as_q_sent_why", "الجملة: ") + it.de + " = " + sMean(it);
    return q;
  }

  var FACTORIES = {
    vocabMean: mkVocabMean, article: mkArticle, plural: mkPlural, translate: mkTranslate, tf: mkTF,
    grammar: mkGrammar, verb: mkVerb, error: mkError, order: mkOrder, gap: mkSentenceGap,
    fillWrite: mkFillWrite, reading: mkReading, listening: mkListening, speaking: mkSpeaking,
    situation: mkSituation, match: mkMatch,
    kein: mkKein, conj: mkConj, wordClass: mkWordClass, sentMean: mkSentMean,
    dialogue: mkDialogue, listenGap: mkListenGap
  };
  /* build a pool of tagged questions.
     spec = [{factory, skill?, n, kap?, level?, diff?}]
     opts = {cap?, rng?, excludeIds?{refId:1}, validate=true}
     Every question is validated (prompt/options/answer); invalid or
     duplicate items are skipped and reported in notes — the session then
     adapts its size honestly instead of serving broken questions. */
  function buildPool(spec, perFactoryCap, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var excl = opts.excludeIds || null;
    /* Per-build memo for filtered sub-pools (freeze fix): factories used to
       re-filter the (kap-sized) pools on EVERY attempt — 100s of identical
       4k scans per slot. The memo lives exactly one synchronous build, so it
       can never go stale (banks cannot change mid-build). */
    var memo = opts.memo || {};
    var pool = [], notes = [];
    (spec || []).forEach(function (sl) {
      var fn = FACTORIES[sl.factory];
      if (!fn) return;
      var want = sl.n || 1, tries = 0, got = 0, bad = 0, seen = {};
      while (got < want && tries < want * 12 + 8) {
        tries++;
        var q = null;
        try { q = fn({ kap: sl.kap, level: sl.level, rng: rng, memo: memo }); } catch (e) { q = null; }
        if (!q || seen[q.prompt]) continue;
        if (excl && q.refId && excl[q.refId]) continue;
        if (opts.validate !== false && !C.validateQ(q)) { bad++; continue; }
        seen[q.prompt] = 1;
        if (sl.skill) q.skill = sl.skill;
        if (sl.diff && sl.diff !== "mixed" && sl.diff !== "graded") q.diffLock = sl.diff;
        pool.push(q); got++;
        if (perFactoryCap && got >= perFactoryCap) break;
      }
      if (sl.diff) {
        var before = pool.length;
        var thisSlot = pool.splice(pool.length - got, got);
        var kept = C.filterByDiff(thisSlot, sl.diff);
        kept.forEach(function (q) { pool.push(q); });
        got = kept.length;
      }
      if (got < want) notes.push({ factory: sl.factory, want: want, got: got, bad: bad });
      else if (bad) notes.push({ factory: sl.factory, want: want, got: got, bad: bad });
    });
    return { pool: C.shuffled(pool, rng), notes: notes };
  }
  /* Weakness concepts from real mistake history -> NEW questions on the same
     concept (never the same memorized item). Returns {plan, excludeIds}. */
  var MISTAKE_FACTORIES = {
    artikel: ["article", "wordClass"], plural: ["plural", "wordClass"],
    "ein-kein": ["kein", "article"], "nicht-kein": ["kein", "grammar"],
    pronomen: ["grammar", "gap"], possessiv: ["grammar", "gap"],
    konjugation: ["verb", "conj", "error"], akkusativ: ["grammar", "error", "gap"],
    wortstellung: ["order", "gap"], fragen: ["grammar", "dialogue"],
    praepositionen: ["grammar", "gap", "situation"], allgemein: ["vocabMean", "translate", "match", "sentMean"]
  };
  function mistakePlan(limit) {
    var plan = [], excludeIds = {}, seen = {};
    try {
      var M = (typeof S !== "undefined" && S.mistakes) || {};
      var DM = (typeof DMProgress !== "undefined") ? DMProgress : null;
      Object.keys(M).forEach(function (id) {
        var m = M[id] || {};
        if (m.done) return;
        var skill = "allgemein";
        try {
          if (DM && DM.skillOfMistake) {
            var w = null;
            try { var f = (typeof wordById === "function") ? wordById : null; if (f) w = f(id); } catch (e) {}
            skill = DM.skillOfMistake(m, w) || "allgemein";
          } else if (m.skill) skill = m.skill;
        } catch (e) {}
        var key = skill + "|" + (m.kap || "?");
        if (seen[key]) return;
        seen[key] = 1;
        excludeIds[id] = 1;
        var facs = MISTAKE_FACTORIES[skill] || MISTAKE_FACTORIES.allgemein;
        plan.push({ factory: facs[Object.keys(seen).length % facs.length], skill: null, n: 2, kap: m.kap || null });
      });
    } catch (e) {}
    return { plan: plan.slice(0, limit || 12), excludeIds: excludeIds, concepts: Object.keys(seen).length };
  }

  /*__APPEND__*/
  return {
    kapitelList: kapitelList, kapLabel: kapLabel, levelUnlocked: levelUnlocked,
    levelWordCount: levelWordCount, levelGrammarCount: levelGrammarCount,
    buildPool: buildPool, mistakePlan: mistakePlan, MISTAKE_FACTORIES: MISTAKE_FACTORIES,
    stratify: function (p, s, r) { return C.stratify(p, s, r); },
    gradeSpeaking: gradeSpeaking, esc: esc, say: say, words: words,
    vocabPool: vocabPool, grammarPool: grammarPool, sentPool: sentPool,
    FACTORIES: FACTORIES
  };
})();
/* ============ TEST SPECS (modes) ============ */
DMAssess.specs = (function () {
  "use strict";
  var U = DMAssess.ui;
  function F(factory, n, extra) {
    var o = { factory: factory, n: n };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  /* General mixed tests: stratified by skill, any Kapitel, A1 base. */
  function mixedSpec(count, level) {
    var lv = level || null;
    var per = Math.max(1, Math.floor(count / 8));
    return {
      id: "mixed-" + count, kind: "general", modeTitle: count <= 10 ? askT("as_c_quick", "اختبار سريع") : (count <= 25 ? askT("as_c_medium", "اختبار متوسط") : askT("as_c_full", "اختبار شامل")),
      minQ: Math.min(count, 6), timed: false,
      build: function () {
        return U.buildPool([
          F("vocabMean", per, { level: lv }), F("article", per, { level: lv }),
          F("translate", per, { level: lv }), F("grammar", per, { level: lv }),
          F("verb", per, { level: lv }), F("order", per, { level: lv }),
          F("gap", per, { level: lv }), F("reading", per, { level: lv }),
          F("listening", per, { level: lv }), F("situation", per, { level: lv })
        ]).pool;
      }
    };
  }
  /* Adaptive placement: A1 -> A2 -> B1 stages. */
  function placementSpec() {
    function stage(level, n) {
      return [
        F("vocabMean", 2, { level: level }), F("article", 1, { level: level }),
        F("grammar", 2, { level: level }), F("verb", 1, { level: level }),
        F("order", 1, { level: level }), F("reading", 1, { level: level }),
        F("listening", 1, { level: level })
      ];
    }
    return {
      id: "placement", kind: "placement", modeTitle: askT("as_c_placement", "اختبار تحديد المستوى"), minQ: 8, timed: false, adaptive: true,
      stages: [
        { id: "A", level: "A1", plan: stage("A1", 0), need: 8 },
        { id: "B", level: "A2", plan: stage("A2", 0), need: 8 },
        { id: "C", level: "B1", plan: stage("B1", 0), need: 8 }
      ],
      build: function () { return U.buildPool(stage("A1", 0), 3).pool; }
    };
  }
  /* Kapitel test: only that Kapitel's real content. */
  function kapitelSpec(kap) {
    return {
      id: "kap-" + kap, kind: "kapitel", kap: kap, modeTitle: askT("as_c_kap_test", "اختبار ") + kap, minQ: 8, timed: false,
      build: function () {
        var o = { kap: kap };
        return U.buildPool([
          F("vocabMean", 2, o), F("article", 2, o), F("plural", 1, o),
          F("grammar", 2, o), F("verb", 1, o), F("order", 1, o),
          F("gap", 2, o), F("reading", 1, o), F("translate", 1, o)
        ]).pool;
      }
    };
  }
  /* Skill test: one skill, 10 questions. */
  var SKILL_FACTORIES = {
    vocab: ["vocabMean", "article", "plural", "translate", "tf", "match"],
    grammar: ["grammar", "verb", "error", "gap"],
    sentences: ["order", "gap", "match"],
    reading: ["reading", "gap"],
    listening: ["listening"],
    writing: ["fillWrite", "order", "gap"],
    speaking: ["speaking"],
    practical: ["situation", "translate"]
  };
  function skillSpec(skill) {
    var facs = SKILL_FACTORIES[skill] || ["vocabMean"];
    return {
      id: "skill-" + skill, kind: "skill", skill: skill,
      modeTitle: askT("as_c_kap_test", "اختبار ") + (askSkillEntry(DMAssess.SKILLS[skill]||{})||skill), minQ: 6, timed: false,
      build: function () {
        var per = Math.ceil(10 / facs.length), plan = facs.map(function (f) { return F(f, per); });
        return U.buildPool(plan, 4).pool;
      }
    };
  }
  /* Full A1 exam: 6 sections x 4 + 2 speaking, timed. */
  function a1ExamSpec() {
    return {
      id: "exam-a1", kind: "exam", level: "A1", modeTitle: askT("as_c_exam_a1", "امتحان A1 الشامل — Deutsch Master"),
      minQ: 20, timed: true, secs: DMAssess.CONFIG.EXAM_TIME_SEC, passPct: DMAssess.CONFIG.PASS_A1_EXAM,
      sections: [[askSec("listening"), "listening"], [askSec("reading"), "reading"], [askSec("vocab"), "vocab"], [askSec("grammar"), "grammar"], [askSec("writing"), "writing"], [askSec("speaking"), "speaking"]],
      build: function () {
        var L = { level: "A1" };
        return U.buildPool([
          F("listening", 4, L),
          F("reading", 4, L),
          F("vocabMean", 2, L), F("article", 1, L), F("plural", 1, L),
          F("grammar", 2, L), F("verb", 2, L),
          F("order", 2, L), F("fillWrite", 2, L),
          F("speaking", 2, L)
        ], 5).pool;
      }
    };
  }
  function levelExamSpec(level) {
    var L = { level: level };
    return {
      id: "exam-" + level.toLowerCase(), kind: "exam", level: level,
      modeTitle: askT("as_c_exam", "امتحان ") + level + askT("as_c_exam_lv2", " الشامل — Deutsch Master"),
      minQ: 20, timed: true, secs: DMAssess.CONFIG.EXAM_TIME_SEC, passPct: DMAssess.CONFIG.PASS_A1_EXAM,
      build: function () {
        return U.buildPool([
          F("listening", 4, L), F("reading", 4, L),
          F("vocabMean", 2, L), F("article", 1, L), F("plural", 1, L),
          F("grammar", 3, L), F("verb", 2, L),
          F("order", 2, L), F("fillWrite", 2, L), F("speaking", 2, L)
        ], 5).pool;
      }
    };
  }
  function levelExamSpec(level) {
    var L = { level: level };
    return {
      id: "exam-" + level.toLowerCase(), kind: "exam", level: level,
      modeTitle: askT("as_c_exam", "امتحان ") + level + askT("as_c_exam_lv2", " الشامل — Deutsch Master"),
      minQ: 20, timed: true, secs: DMAssess.CONFIG.EXAM_TIME_SEC, passPct: DMAssess.CONFIG.PASS_A1_EXAM,
      build: function () {
        return U.buildPool([
          F("listening", 4, L), F("reading", 4, L),
          F("vocabMean", 2, L), F("article", 1, L), F("plural", 1, L),
          F("grammar", 3, L), F("verb", 2, L),
          F("order", 2, L), F("fillWrite", 2, L), F("speaking", 2, L)
        ], 5).pool;
      }
    };
  }
  /* ---- Test Center category registry: id -> label/icon/factories/skill ----
     Single source of truth for picker cards AND builders. Counts shown in the
     UI are probed live from real content (never hardcoded). */
  var CATS = {
    words:     { ar: "الكلمات",      de: "Wörter",      en: "Words", ico: "🟦", facs: ["vocabMean", "match", "wordClass"], skill: "vocab" },
    sentences: { ar: "الجمل",        de: "Sätze",       en: "Sentences", ico: "🟩", facs: ["gap", "sentMean", "match"], skill: "sentences" },
    ordering:  { ar: "ترتيب الجملة", de: "Satzbau",     en: "Sentence structure", ico: "🟨", facs: ["order"], skill: "sentences" },
    grammar:   { ar: "القواعد",      de: "Grammatik",   en: "Grammar", ico: "🟥", facs: ["grammar", "kein", "gap"], skill: "grammar" },
    verbs:     { ar: "الأفعال",      de: "Verben",      en: "Verbs", ico: "🟪", facs: ["verb", "conj", "error"], skill: "grammar" },
    articles:  { ar: "المقالات",     de: "Artikel",     en: "Articles", ico: "🟧", facs: ["article"], skill: "vocab" },
    plural:    { ar: "الجمع",        de: "Plural",      en: "Plural", ico: "🟫", facs: ["plural"], skill: "vocab" },
    translate: { ar: "الترجمة",      de: "Übersetzung", en: "Translation", ico: "🔁", facs: ["translate", "sentMean"], skill: "vocab" },
    reading:   { ar: "القراءة",      de: "Lesen",       en: "Reading", ico: "📖", facs: ["reading", "sentMean"], skill: "reading" },
    listening: { ar: "الاستماع",     de: "Hören",       en: "Listening", ico: "🎧", facs: ["listening", "listenGap"], skill: "listening" },
    reallife:  { ar: "المواقف",      de: "Alltag",      en: "Situations", ico: "🌍", facs: ["situation", "dialogue"], skill: "practical" },
    mistakes:  { ar: "أخطائي",       de: "Fehler",      en: "My mistakes", ico: "❌", facs: null, skill: null },
    tfquiz:    { ar: "صح أم خطأ",    de: "Richtig/Falsch", en: "True/False", ico: "⚖️", facs: ["tf"], skill: "vocab" },
    writing:   { ar: "الكتابة",      de: "Schreiben",   en: "Writing", ico: "✍️", facs: ["fillWrite", "order"], skill: "writing" },
    speaking:  { ar: "التحدث",       de: "Sprechen",    en: "Speaking", ico: "🎤", facs: ["speaking"], skill: "speaking" }
  };
  var CAT_IDS = Object.keys(CATS);
  var MODES = {
    quick: { ar: "سريع", n: 20, de: "20 سؤالًا", en: "Quick", end: "20 questions"  },
    normal: { ar: "عادي", n: 40, de: "40 سؤالًا", en: "Normal", end: "40 questions"  },
    intensive: { ar: "مكثف", n: 60, de: "60 سؤالًا", en: "Intensive", end: "60 questions"  },
    advanced: { ar: "شامل", n: 80, de: "80 سؤالًا", en: "Comprehensive", end: "80 questions"  },
    master: { ar: "Master", n: 0, de: "كل المحتوى المتاح", en: "Master", end: "all available content"  }
  };
  var DIFFS = {
    easy:   { ar: "سهل",   de: "leichte Fragen", en: "Easy" },
    medium: { ar: "متوسط", de: "mittlere Fragen", en: "Medium" },
    hard:   { ar: "صعب",   de: "schwere Fragen", en: "Hard" },
    graded: { ar: "متدرج", de: "سهل ← صعب" , en: "Graded"}
  };
  /* one category inside one Kapitel, sized by mode + filtered by difficulty.
     mode.n is a TARGET: the pool is sliced to real valid content, and the
     actual count is exposed on pool._actual (never faked upward). Master
     uses MASTER_CAP as the practical upper bound. */
  function kapitelCategorySpec(kap, catId, modeKey, diffKey, level) {
    var cat = CATS[catId];
    var mode = MODES[modeKey] || MODES.quick;
    var diff = DIFFS[diffKey] ? diffKey : "mixed";
    var target = mode.n || DMAssess.CONFIG.MASTER_CAP;
    var o = { kap: kap };
    if (level) o.level = level;
    if (diff !== "mixed" && diff !== "graded") o.diff = diff;
    return {
      id: "kc-" + kap + "-" + catId + "-" + modeKey + "-" + diff,
      kind: "kapitel", cat: catId, kap: kap, level: level || null, target: target,
      modeTitle: (cat ? askSkillEntry(cat) : catId) + " • " + kap + " (" + askModeEntry(mode) + (askLang()==="ar"?"، ":" / ") + askDiffEntry(DIFFS[diffKey] || DIFFS.medium) + ")",
      minQ: 5, timed: false, diffKey: diff,
      build: function () {
        if (catId === "mistakes") return mistakeSpec(kap).build();
        var per = Math.max(1, Math.ceil(target / (cat.facs.length)));
        /* diff-filtered builds discard non-matching items AFTER collecting,
           so over-collect (bounded) to let the result actually reach the
           target when enough matching content exists. Probe and Start use
           identical parameters, so shown availability stays honest. */
        if (diff !== "mixed" && diff !== "graded") per = Math.min(60, per * 5);
        var plan = cat.facs.map(function (f) { return F(f, per, o); });
        var got = U.buildPool(plan, mode.n ? undefined : 99);
        var pool = got.pool;
        if (diff === "graded") pool = DMAssess.filterByDiff(pool, "graded");
        pool = pool.slice(0, target);
        pool._notes = got.notes;
        pool._actual = pool.length;
        pool._target = target;
        return pool;
      }
    };
  }
  /* full Kapitel exam: balanced mix across all available categories, scaled
     to `total` (default 60). Short categories redistribute automatically:
     buildPool reports real coverage and we slice to what truly exists. */
  function kapitelExamSpec(kap, level, total) {
    total = Math.max(8, Math.min(total || 60, DMAssess.CONFIG.MASTER_CAP));
    return {
      id: "kexam-" + kap, kind: "kapitel", cat: "full", kap: kap, level: level || null, target: total,
      modeTitle: askT("as_c_kexam_h", "الامتحان الشامل • ") + kap + " (" + total + askT("as_c_test_q", " سؤالًا") + ")",
      minQ: 8, timed: false,
      build: function () {
        var o = { kap: kap };
        if (level) o.level = level;
        var plan = [];
        /* balanced base: every category contributes; weights mirror the
           recommended 60-question distribution (vocab-heavy, skills mixed) */
        var WEIGHT = { words: 3, sentences: 2, ordering: 2, grammar: 3, verbs: 2, articles: 2, plural: 1, translate: 2, reading: 2, listening: 3, reallife: 2, tfquiz: 1, writing: 1, speaking: 1 };
        var units = 0, wsum = 0;
        CAT_IDS.forEach(function (cid) {
          if (cid === "mistakes") return;
          wsum += (WEIGHT[cid] || 1) * ((CATS[cid].facs || []).length || 1);
        });
        CAT_IDS.forEach(function (cid) {
          if (cid === "mistakes") return;
          var facs = CATS[cid].facs, w = (WEIGHT[cid] || 1);
          facs.forEach(function (f) {
            var n = Math.max(1, Math.round(total * w / Math.max(1, wsum)));
            plan.push(F(f, n, o)); units += n;
          });
        });
        var got = U.buildPool(plan, 99);
        var pool = DMAssess.shuffled(got.pool).slice(0, total);
        pool._notes = got.notes;
        pool._actual = pool.length;
        pool._target = total;
        return pool;
      }
    };
  }
  /* mixed test with explicit percent distribution {vocab:20, grammar:20...} */
  function mixedDistSpec(dist, o) {
    o = o || {};
    var counts = DMAssess.distribute(o.total || 20, dist || { vocab: 20, grammar: 20, sentences: 20, verbs: 10, listening: 10, reading: 10, practical: 10 });
    var DIST_FACS = {
      vocab: ["vocabMean", "article", "translate", "match", "wordClass"],
      grammar: ["grammar", "kein", "gap"], sentences: ["gap", "order", "sentMean"],
      verbs: ["verb", "conj", "error"], listening: ["listening", "listenGap"],
      reading: ["reading", "sentMean"], practical: ["situation", "dialogue"],
      writing: ["fillWrite", "order"], speaking: ["speaking"]
    };
    return {
      id: "dist-" + Date.now().toString(36), kind: "general",
      modeTitle: askT("as_c_kap_test", "اختبار ") + askT("as_c_varied", "متنوع") + " (" + (o.total || 20) + askT("as_c_test_q", " سؤالًا") + ")", minQ: 5, timed: false,
      build: function () {
        var plan = [];
        Object.keys(counts).forEach(function (sk) {
          var facs = DIST_FACS[sk] || ["vocabMean"];
          var per = Math.ceil(counts[sk] / facs.length) || 0;
          facs.forEach(function (f) { if (per > 0) plan.push(F(f, per, { kap: o.kap || null, level: o.level || null })); });
        });
        var got = U.buildPool(plan, 99, o.rng ? { rng: o.rng } : null);
        var pool = DMAssess.shuffled(got.pool, o.rng);
        return pool.slice(0, o.total || 20);
      }
    };
  }
  /* custom builder result: levels[], kaps[], cats[], diff, count, mode */
  function customSpec(b) {
    b = b || {};
    var levels = (b.levels && b.levels.length ? b.levels : [null]);
    var kaps = (b.kaps && b.kaps.length ? b.kaps : [null]);
    var cats = (b.cats && b.cats.length ? b.cats : ["words", "grammar", "sentences"]);
    var total = b.count || 10, diff = b.diff || "mixed", mode = b.mode || "test";
    return {
      id: "custom-" + Date.now().toString(36), kind: "general", customMode: mode,
      modeTitle: askT("as_c_mine", "اختباري الخاص (") + total + askT("as_c_mine_mid", " • ") + cats.length + askT("as_c_mine_cats", " فئات)"),
      minQ: 5, timed: mode === "exam",
      secs: mode === "exam" ? DMAssess.CONFIG.EXAM_TIME_SEC : 0,
      qTimed: mode === "challenge", qSecs: DMAssess.CONFIG.QTIME_SEC,
      passPct: mode === "exam" ? DMAssess.CONFIG.PASS_A1_EXAM : 0,
      build: function () {
        var per = Math.max(1, Math.ceil(total / Math.max(1, cats.length * levels.length * kaps.length)));
        var plan = [];
        cats.forEach(function (cid) {
          if (cid === "mistakes") return;
          var facs = (CATS[cid] || {}).facs || ["vocabMean"];
          levels.forEach(function (lv) {
            kaps.forEach(function (kp) {
              facs.forEach(function (f) {
                var slot = F(f, per, {});
                if (lv) slot.level = lv;
                if (kp) slot.kap = kp;
                if (diff !== "mixed" && diff !== "graded") slot.diff = diff;
                plan.push(slot);
              });
            });
          });
        });
        var got = U.buildPool(plan, 99);
        var pool = got.pool;
        if (diff === "graded") pool = DMAssess.filterByDiff(pool, "graded");
        pool = DMAssess.shuffled(pool).slice(0, total);
        pool._notes = got.notes;
        return pool;
      }
    };
  }
  /* mistake test: same weak concepts, NEW questions (same item excluded) */
  function mistakeSpec(kap) {
    return {
      id: "mist-" + (kap || "all") + "-" + Date.now().toString(36), kind: "skill", skill: "mixed-weak",
      modeTitle: askT("as_c_mistakes_me", "اختبرني في أخطائي") + (kap ? askT("as_c_cat_test", " • ") + kap : ""), minQ: 4, timed: false,
      build: function () {
        var mp = U.mistakePlan(12);
        if (!mp.plan.length) return [];
        var plan = mp.plan.map(function (sl) {
          if (kap) sl.kap = kap;
          sl.n = 2;
          return sl;
        });
        return U.buildPool(plan, 4, { excludeIds: mp.excludeIds }).pool;
      }
    };
  }
  /* daily challenge: fixed composition, date-seeded => same test all day */
  function dailySpec(dateStr) {
    var seed = dateStr || "today";
    return {
      id: "daily-" + seed, kind: "general",
      modeTitle: askT("as_c_challenge", "تحدي اليوم 🎯"), minQ: 8, timed: false, seed: seed,
      build: function () {
        var rng = DMAssess.seededRng(seed);
        var got = U.buildPool([
          F("vocabMean", 3, {}), F("grammar", 2, {}), F("gap", 2, {}),
          F("listening", 2, {}), F("situation", 1, {}), F("article", 2, {})
        ], 4, { rng: rng });
        return DMAssess.shuffled(got.pool, rng).slice(0, 12);
      }
    };
  }
  /* boss test: hard-heavy surprise mix; unlock = readiness>=50 OR 3 tests */
  function bossUnlock(kap, rmap, history) {
    var r = (rmap || {})[kap];
    var tested = 0;
    try {
      (history || []).forEach(function (h) {
        if (h.kapitel === kap || (h.kaps && h.kaps[kap] && h.kaps[kap].n >= 4)) tested++;
      });
    } catch (e) {}
    if (r && r.pct >= DMAssess.CONFIG.BOSS_UNLOCK_READY) return { ok: true, why: askT("as_c_unlock_ok", "إتقان ") + kap + ": " + r.pct + "%" };
    if (tested >= 3) return { ok: true, why: tested + askT("as_c_unlock_tests", " اختبارات في ") + kap };
    return { ok: false, why: askT("as_c_unlock_need", "يحتاج إتقان ") + DMAssess.CONFIG.BOSS_UNLOCK_READY + askT("as_c_unlock_or", "% أو 3 اختبارات في ") + kap + askT("as_c_unlock_open", " (التعلّم نفسه مفتوح دائمًا)") };
  }
  function bossSpec(kap, total) {
    total = Math.max(10, Math.min(total || 40, DMAssess.CONFIG.MASTER_CAP));
    return {
      id: "boss-" + kap, kind: "kapitel", cat: "boss", kap: kap, target: total,
      modeTitle: askT("as_c_boss", "اختبار الزعيم 👑 • ") + kap + " (" + total + askT("as_c_test_q", " سؤالًا") + ")",
      minQ: 8, timed: false, adaptiveDiff: true,
      build: function () {
        var o = { kap: kap };
        var got = U.buildPool([
          F("error", Math.ceil(total * 0.15), o), F("conj", Math.ceil(total * 0.12), o),
          F("kein", Math.ceil(total * 0.10), o), F("order", Math.ceil(total * 0.12), o),
          F("listenGap", Math.ceil(total * 0.12), o), F("dialogue", Math.ceil(total * 0.08), o),
          F("grammar", Math.ceil(total * 0.12), o), F("match", Math.ceil(total * 0.06), o),
          F("reading", Math.ceil(total * 0.06), o), F("situation", Math.ceil(total * 0.07), o)
        ], 99);
        var pool = DMAssess.filterByDiff(got.pool, "graded");
        pool = pool.slice(0, total);
        pool._notes = got.notes;
        pool._actual = pool.length;
        pool._target = total;
        return pool;
      }
    };
  }
  /* cumulative test: Kapitel range (e.g. K1..K3 or whole A1). Stays inside
     the selected kaps only — never leaks other content. Balanced by skill. */
  function cumulSpec(kaps, total, o) {
    o = o || {};
    kaps = (kaps || []).slice();
    total = Math.max(8, Math.min(total || 60, DMAssess.CONFIG.MASTER_CAP));
    return {
      id: "cumul-" + kaps.join("-") + "-" + total, kind: "kapitel", cat: "cumul",
      kap: kaps.length === 1 ? kaps[0] : null, kaps: kaps, level: o.level || null, target: total,
      modeTitle: askT("as_c_cumul", "اختبار تراكمي 📚 (") + (kaps.join(" + ") || askT("as_c_cumul_all", "الكل")) + ") • " + total + askT("as_c_test_q", " سؤالًا") + ")",
      minQ: 8, timed: false,
      build: function () {
        var dist = { vocab: 22, grammar: 18, sentences: 16, verbs: 12, listening: 10, reading: 10, practical: 12 };
        var counts = DMAssess.distribute(total, dist);
        var DIST_FACS = {
          vocab: ["vocabMean", "article", "translate", "match", "wordClass"],
          grammar: ["grammar", "kein", "gap"], sentences: ["gap", "order", "sentMean"],
          verbs: ["verb", "conj", "error"], listening: ["listening", "listenGap"],
          reading: ["reading", "sentMean"], practical: ["situation", "dialogue"]
        };
        var plan = [];
        Object.keys(counts).forEach(function (sk) {
          var facs = DIST_FACS[sk] || ["vocabMean"];
          var perKap = Math.max(1, Math.ceil(counts[sk] / Math.max(1, kaps.length) / facs.length));
          kaps.forEach(function (kp) {
            facs.forEach(function (f) {
              var slot = F(f, perKap, {});
              slot.kap = kp;
              if (o.level) slot.level = o.level;
              plan.push(slot);
            });
          });
          if (!kaps.length) facs.forEach(function (f) {
            var slot = F(f, Math.max(1, Math.ceil(counts[sk] / facs.length)), {});
            if (o.level) slot.level = o.level;
            plan.push(slot);
          });
        });
        var got = U.buildPool(plan, 99);
        var pool = DMAssess.shuffled(got.pool).slice(0, total);
        pool._notes = got.notes;
        pool._actual = pool.length;
        pool._target = total;
        return pool;
      }
    };
  }
  /* smart test-me: weakness-weighted distribution from real history */
  function smartSpec(o) {
    o = o || {};
    var total = Math.max(8, Math.min(o.total || 40, DMAssess.CONFIG.MASTER_CAP));
    return {
      id: "smart-" + Date.now().toString(36), kind: "general", cat: "smart",
      kap: o.kap || null, level: o.level || null, target: total,
      modeTitle: askT("as_c_smart", "اختبرني بذكاء 🧠 (") + total + askT("as_c_test_q", " سؤالًا") + ")", minQ: 6, timed: false,
      build: function () {
        var dist = { vocab: 15, grammar: 15, sentences: 15, verbs: 10, listening: 10, reading: 10, practical: 10, writing: 8, speaking: 7 };
        try {
          if (o.weakSkills && o.weakSkills.length) {
            var boost = {};
            o.weakSkills.forEach(function (s) { boost[s] = 3; });
            Object.keys(dist).forEach(function (k) { dist[k] = dist[k] * (boost[k] || 1); });
          }
        } catch (e) {}
        return mixedDistSpec(dist, { total: total, kap: o.kap || null, level: o.level || null }).build();
      }
    };
  }
  return { mixedSpec: mixedSpec, placementSpec: placementSpec, kapitelSpec: kapitelSpec, skillSpec: skillSpec, a1ExamSpec: a1ExamSpec, levelExamSpec: levelExamSpec, SKILL_FACTORIES: SKILL_FACTORIES, CATS: CATS, CAT_IDS: CAT_IDS, MODES: MODES, DIFFS: DIFFS, kapitelCategorySpec: kapitelCategorySpec, kapitelExamSpec: kapitelExamSpec, mixedDistSpec: mixedDistSpec, customSpec: customSpec, mistakeSpec: mistakeSpec, dailySpec: dailySpec, bossSpec: bossSpec, cumulSpec: cumulSpec, bossUnlock: bossUnlock, smartSpec: smartSpec };
})();
/* ============ SESSION RUNNER + STORE ============ */
DMAssess.app = (function () {
  "use strict";
  var C = DMAssess, U = DMAssess.ui;
  var sess = null, timerInt = null;
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function FN(name) { try { var f = window[name]; return typeof f === "function" ? f : null; } catch (e) { return null; } }
  function esc(s) { return U.esc(s); }
  function toast(m, k) { try { var f = FN("toast"); if (f) f(m, k || "ok"); } catch (e) {} }
  function save() { try { var f = FN("save"); if (f) f(); } catch (e) {} }

  function ensureStore() {
    try {
      if (typeof S === "undefined") return null;
      if (!S.assess || typeof S.assess !== "object") S.assess = {};
      if (S.assess.v !== C.CONFIG.STORE_V) S.assess.v = C.CONFIG.STORE_V;
      if (!Array.isArray(S.assess.history)) S.assess.history = [];
      return S.assess;
    } catch (e) { return null; }
  }
  /* B2C QA: fold ß→ss and umlauts to their standard DIN-5007 ASCII
     * transcriptions (ä→ae, ö→oe, ü→ue) so typed answers on non-German
     * keyboards ("regelmaessig" for "regelmäßig") are not false negatives —
     * same precedent as adv.js accepts:["grosses"]. Digraph folding keeps
     * umlaut words distinct from plain vowels (schön→schoen ≠ schon), so no
     * new false positives there. MC scoring is index-based and unaffected.
     * Known caveat: Maße/Masse-type minimal pairs conflate when typed; fills
     * served as typed input are articles/short words where this does not
     * occur in the bank. */
  function normWrite(s) { return String(s || "").trim().toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[.?!،؛:"]+$/g, "").replace(/\s+/g, " ").trim(); }
  function skillAr(s) { try { var m = (C.SKILLS[s] || {}); var L = "ar"; try { L = (typeof askLang === "function") ? askLang() : (((typeof S !== "undefined" && S && S.uiLang) || "ar")); } catch (e0) {} if (L === "en" && m.en) return m.en; if (L === "de" && (m.de || m.en)) return m.de || m.en; return m.ar || s; } catch (e) { try { return ((C.SKILLS[s] || {}).ar) || s; } catch (e2) { return s; } } }

  /* ---------- progress integration (evidence-based, no double count) ---------- */
  function wordById(id) {
    try { var f = FN("wordById"); if (f) { var w = f(id); if (w) return w; } } catch (e) {}
    try { var ws = U.words(); for (var i = 0; i < ws.length; i++) if (ws[i].id === id) return ws[i]; } catch (e2) {}
    return null;
  }
  function logAttempt(q, ok, ms) {
    try {
      if (typeof DMProgress !== "undefined" && DMProgress.logAttempt && typeof S !== "undefined") {
        S.evSeq = (S.evSeq || 0) + 1;
        DMProgress.logAttempt(S, DMProgress.makeAttempt({
          aid: "as" + S.evSeq + "-" + Date.now().toString(36),
          sec: "assess", session: sess ? sess.spec.id : "assess",
          qid: q.refId || q.id, qtype: q.type, ref: q.refId || "",
          lvl: q.level || "", kap: q.kap || "",
          ok: ok === true, ms: ms || 0
        }));
      } else if (typeof S !== "undefined") {
        S.totalAnswered = (S.totalAnswered || 0) + 1;
        if (ok) S.totalCorrect = (S.totalCorrect || 0) + 1;
      }
      save();
    } catch (e) {}
  }
  function progressSideEffects(q, ok, userText) {
    try {
      if (q.gid && FN("gramRecord")) FN("gramRecord")(q.gid, ok === true);
      var w = q.refId ? wordById(q.refId) : null;
      if (w && FN("recordMistake") && !ok) {
        var right = correctTextOf(q);
        FN("recordMistake")(w, userText || "", "assess-" + q.type, { q: q.prompt, ok: right, chapterId: q.kap || w.kap });
      }
      if (w && ok && FN("noteMastered")) { try { FN("noteMastered")(w.id); } catch (e) {} }
      if (ok && FN("addXP")) FN("addXP")(2);
    } catch (e) {}
  }
  function correctTextOf(q) {
    if (q.type === "order") return q.answer;
    if (q.type === "fill") return q.answer;
    if (q.type === "match") return q.why;
    if (q.type === "speak") return q.sample;
    if (q.type === "conj" && q.rows) return q.rows.map(function (r) { return r.pron + " " + r.opts[r.correct]; }).join(" • ");
    if (q.opts && typeof q.correct === "number") return q.opts[q.correct];
    return q.why || "";
  }

  /* ---------- flow ---------- */
  function shortageMsg(pool, minQ, title) {
    var bySkill = {};
    pool.forEach(function (q) { bySkill[q.skill] = (bySkill[q.skill] || 0) + 1; });
    return '<div class="panel glass"><h3>⚠️ ' + esc(title) + '</h3>' +
      '<div class="muted">'+askT("as_c_no_thin", "لا يوجد محتوى كافٍ لهذا الاختبار حاليًا (متاح: ")+pool.length+askT("as_c_need", " — المطلوب: ")+minQ+askT("as_c_honest", "'). هذه نتيجة صادقة وليست درجة مخترعة. جرّب اختبارًا آخر أو أكمل الدروس أولًا.'")+'</div>' + +
      '<div class="muted">التغطية المتاحة: ' + Object.keys(bySkill).map(function (s) { return esc(skillAr(s)) + " (" + bySkill[s] + ")"; }).join(" • ") + '</div>' +
      '<div class="row-flex"><button class="btn btn-ghost sm" data-as="dash">' + askT("as_c_back", "← عودة للمركز") + '</button></div></div>';
  }
  /* Header-aware focus: smooth-scrolls an element into view without hiding
     it under the fixed top header or the mobile bottom nav. Uses CSS
     scroll-margin-top where present; the JS offset is the safety net for
     older WebViews. Never scrolls to page top. */
  function focusBelowHeader(elOrId, opts) {
    try {
      var el = typeof elOrId === "string" ? $(elOrId) : elOrId;
      if (!el) return false;
      var extra = (opts && opts.extra) || 8;
      var hdr = 76;
      try {
        var hb = document.getElementById("dmTopHeader");
        if (hb) hdr = Math.max(hdr, Math.ceil(hb.getBoundingClientRect().height) + 10);
        var cs = getComputedStyle(document.documentElement);
        var vh = parseInt(cs.getPropertyValue("--dm-header-h"), 10);
        if (vh > hdr) hdr = vh + 10;
      } catch (e2) {}
      var y = 0;
      try {
        var r = el.getBoundingClientRect();
        y = (window.pageYOffset || document.documentElement.scrollTop || 0) + r.top - hdr - extra;
      } catch (e3) { return false; }
      if (y < 0) y = 0;
      try { window.scrollTo({ top: y, behavior: "smooth" }); }
      catch (e4) { try { window.scrollTo(0, y); } catch (e5) {} }
      try { if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1"); } catch (e6) {}
      return true;
    } catch (e) { return false; }
  }
  function startFlow(spec, opts) {
    opts = opts || {};
    ensureStore();
    var pool = [];
    try { pool = spec.build() || []; } catch (e) { pool = []; }
    pool = C.shuffled(pool).slice(0, opts.limit || pool.length || 0);
    if (pool.length < (spec.minQ || 6)) {
      var host = $("assessRunner") || $("assessRoot");
      if (host) { host.innerHTML = shortageMsg(pool, spec.minQ || 6, spec.modeTitle); wireDashBtns(host); }
      try { if (typeof showPage === "function") showPage("quiz"); } catch (e) {}
      return false;
    }
    sess = {
      spec: { id: spec.id, kind: spec.kind, modeTitle: spec.modeTitle, timed: !!spec.timed, secs: spec.secs || 0, passPct: spec.passPct || 0, kap: spec.kap || null, kaps: spec.kaps || null, total: spec.target || null, skill: spec.skill || null, level: spec.level || null, cat: spec.cat || null, mode: spec.customMode || (spec.kind === "exam" ? "exam" : "test"), diffKey: spec.diffKey || null, seed: spec.seed || null },
      specRef: spec, qs: pool, ans: pool.map(function () { return null; }),
      idx: 0, startedAt: Date.now(),
      deadline: spec.timed ? Date.now() + (spec.secs || C.CONFIG.EXAM_TIME_SEC) * 1000 : 0,
      stages: spec.adaptive ? [{ id: "A", level: "A1", n: pool.length, ok: 0, done: 0 }] : null,
      stageIdx: 0, t0q: Date.now(), autoSpoke: {},
      combo: 0, bestCombo: 0, perfects: 0,
      qTimed: !!spec.qTimed, qSecs: spec.qSecs || C.CONFIG.QTIME_SEC, qDeadline: 0,
      adaptiveDiff: !!spec.adaptiveDiff
    };
    if (sess.qTimed) sess.qDeadline = Date.now() + sess.qSecs * 1000;
    persistInProgress();
    renderRunner();
    try { if (typeof showPage === "function") showPage("quiz"); } catch (e) {}
    /* Focus the runner workspace (header-aware). showPage() already scrolled
       to top on page switches; this runs after so the runner stays visible
       without hiding under the fixed header. */
    setTimeout(function () { focusBelowHeader("assessRunner"); }, 80);
    return true;
  }
  function persistInProgress() {
    try {
      var st = ensureStore(); if (!st || !sess) return;
      st.inProgress = {
        v: C.CONFIG.STORE_V, specMeta: sess.spec,
        qs: sess.qs, ans: sess.ans, idx: sess.idx,
        startedAt: sess.startedAt, deadline: sess.deadline,
        stages: sess.stages, stageIdx: sess.stageIdx,
        combo: sess.combo || 0, bestCombo: sess.bestCombo || 0, perfects: sess.perfects || 0
      };
      save();
    } catch (e) {}
  }
  function clearInProgress() {
    try { var st = ensureStore(); if (st) { st.inProgress = null; save(); } } catch (e) {}
  }
  function resumeFlow() {
    try {
      var st = ensureStore();
      var ip = st && st.inProgress;
      if (!ip || ip.v !== C.CONFIG.STORE_V || !ip.qs || !ip.qs.length) return false;
      if (Date.now() - (ip.startedAt || 0) > C.CONFIG.RESUME_TTL_DAYS * 86400000) { clearInProgress(); return false; }
      var spec = null;
      try {
        var S2 = DMAssess.specs, m = ip.specMeta || {};
        if (m.id === "placement") spec = S2.placementSpec();
        else if (m.kind === "kapitel" && m.kap && !m.cat) spec = S2.kapitelSpec(m.kap);
        else if (m.kind === "kapitel" && m.kap && m.cat === "full") spec = S2.kapitelExamSpec(m.kap, m.level, m.total);
        else if (m.kind === "kapitel" && m.cat === "cumul") spec = S2.cumulSpec(m.kaps || (m.kap ? [m.kap] : []), m.total, { level: m.level });
        else if (m.kind === "kapitel" && m.kap && m.cat === "boss") spec = S2.bossSpec(m.kap, m.total);
        else if (m.kind === "kapitel" && m.kap && m.cat) spec = S2.kapitelCategorySpec(m.kap, m.cat, "normal", m.diffKey || "mixed", m.level);
        else if (m.kind === "skill" && m.skill && S2.SKILL_FACTORIES[m.skill]) spec = S2.skillSpec(m.skill);
        else if (m.id === "exam-a1") spec = S2.a1ExamSpec();
        else if (m.kind === "exam" && m.level) spec = S2.levelExamSpec(m.level);
        else spec = S2.mixedSpec(ip.qs.length);
        /* carry session behavior flags for rebuilt/new-kind specs */
        if (spec && m) {
          if (m.mode === "challenge") { spec.qTimed = true; spec.qSecs = DMAssess.CONFIG.QTIME_SEC; }
          if (m.mode === "exam" && !spec.timed) { spec.timed = true; spec.secs = DMAssess.CONFIG.EXAM_TIME_SEC; }
          if (m.cat === "boss") spec.adaptiveDiff = true;
        }
      } catch (e) { spec = null; }
      if (!spec) return false;
      sess = {
        spec: ip.specMeta, specRef: spec, qs: ip.qs, ans: ip.ans || ip.qs.map(function () { return null; }),
        idx: Math.min(ip.idx || 0, ip.qs.length - 1), startedAt: ip.startedAt,
        deadline: ip.deadline || 0, stages: ip.stages || null, stageIdx: ip.stageIdx || 0,
        t0q: Date.now(), autoSpoke: {},
        combo: ip.combo || 0, bestCombo: ip.bestCombo || 0, perfects: ip.perfects || 0,
        qTimed: !!(ip.specMeta && ip.specMeta.mode === "challenge"), qSecs: DMAssess.CONFIG.QTIME_SEC,
        qDeadline: 0, adaptiveDiff: !!(ip.specMeta && (ip.specMeta.cat === "boss" || ip.specMeta.adaptiveDiff))
      };
      if (sess.qTimed && !sess.ans[sess.idx]) sess.qDeadline = Date.now() + sess.qSecs * 1000;
      if (sess.deadline && Date.now() >= sess.deadline) { finish(true); return true; }
      renderRunner();
      try { if (typeof showPage === "function") showPage("quiz"); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  function discardFlow() {
    sess = null; stopTimer(); clearInProgress();
    renderCenter();
  }

  /* ---------- runner rendering ---------- */
  function stopTimer() { try { if (timerInt) { clearInterval(timerInt); timerInt = null; } } catch (e) {} }
  function finish(auto) { try { return DMAssess.center.finish(auto); } catch (e) { if (window.console) console.error("assess finish", e); return null; } }
  function renderCenter() { try { return DMAssess.center.renderCenter(); } catch (e) { if (window.console) console.error("assess center", e); } }
  function tickTimer() {
    if (!sess) return;
    if (sess.deadline) {
      var left = Math.max(0, Math.round((sess.deadline - Date.now()) / 1000));
      var el = $("asrTimer");
      if (el) {
        var m = Math.floor(left / 60), s = left % 60;
        el.textContent = "⏱️ " + m + ":" + (s < 10 ? "0" : "") + s;
        el.classList.toggle("asr-danger", left < 180);
      }
      persistThrottleTick(left);
      if (left <= 0) { toast(askT("as_q_time_up", "⏱️ انتهى الوقت — يتم تسليم الاختبار تلقائيًا"), "err"); finish(true); return; }
    }
    /* challenge per-question countdown */
    if (sess.qTimed && sess.qDeadline && !sess.ans[sess.idx]) {
      var ql = Math.max(0, Math.ceil((sess.qDeadline - Date.now()) / 1000));
      /* Backgrounded app: freeze the per-question clock instead of failing
         the user for leaving. Each throttled background tick pushes the
         deadline forward so the countdown effectively pauses; the visible
         countdown resumes intact on return. Overall exam deadlines keep
         their honest wall-clock (exam semantics, resumed via inProgress). */
      var hiddenNow = false;
      try { hiddenNow = !!(typeof document !== "undefined" && document.hidden); } catch (e) {}
      if (hiddenNow) {
        try { sess.qDeadline += 500; } catch (e) {}
      } else {
        var qe = $("asrQTimer");
        if (qe) {
          qe.textContent = "⏱️ " + ql + "s";
          qe.classList.toggle("asr-danger", ql <= 4);
        }
        if (ql <= 0) {
          var q = sess.qs[sess.idx];
          toast(askT("as_q_time_q", "⏱️ انتهى وقت السؤال!"), "err");
          lockAnswer(q, { ok: false, user: askT("as_q_timeout", "— (انتهى الوقت)"), correct: correctTextOf(q), timeout: true });
        }
      }
    }
  }
  var __lastPersist = 0;
  function persistThrottleTick(left) {
    try {
      var now = Date.now();
      if (now - __lastPersist > 10000 || left <= 0) { __lastPersist = now; persistInProgress(); }
    } catch (e) {}
  }
  function renderRunner() {
    stopTimer();
    if (!sess) { renderCenter(); return; }
    var root = $("assessRoot"); if (!root) return;
    var done = sess.ans.filter(Boolean).length;
    root.innerHTML = '<div id="assessRunner" class="asr-wrap"></div>';
    renderQ();
    if ((sess.spec.timed && sess.deadline) || sess.qTimed) { timerInt = setInterval(tickTimer, 500); }
    try {
      var before = window.onbeforeunload;
      window.onbeforeunload = function (e) {
        if (sess && sess.ans.filter(Boolean).length < sess.qs.length) { e.preventDefault(); e.returnValue = ""; return ""; }
        return null;
      };
      sess._prevUnload = before;
    } catch (e) {}
  }
  function modeBadge() {
    var m = (sess && sess.spec.mode) || "test";
    return m === "training" ? askT("as_q_mode_train", "🟢 تدريب") : m === "challenge" ? askT("as_q_mode_chal", "🟡 تحدي") : m === "exam" ? askT("as_q_mode_exam", "🔴 امتحان") : askT("as_q_mode_test", "🔵 اختبار");
  }
  function qStatusLine() {
    var done = sess.ans.filter(Boolean).length;
    return '<div class="quiz-top"><span id="asrQNum">' + (sess.idx + 1) + ' / ' + sess.qs.length + '</span>' +
      '<div class="progress"><div class="progress-fill" style="width:' + Math.round(done / sess.qs.length * 100) + '%"></div></div>' +
      '<span class="muted">✅ ' + done + '</span>' +
      (sess.combo >= 2 ? '<span class="asr-combo">🔥x' + sess.combo + '</span>' : '') +
      '<span class="asr-mode">' + modeBadge() + '</span>' +
      (sess.spec.timed ? '<span id="asrTimer" class="asr-timer">⏱️ …</span>' : '') +
      (sess.qTimed && !sess.ans[sess.idx] ? '<span id="asrQTimer" class="asr-timer">⏱️ …</span>' : '') + '</div>';
  }
  function renderQ() {
    var box = $("assessRunner"); if (!box || !sess) return;
    var q = sess.qs[sess.idx], a = sess.ans[sess.idx];
    var stageTag = "";
    if (sess.stages && sess.stages.length > 1) {
      var st = sess.stages[sess.stageIdx];
      stageTag = '<div class="muted">' + askT("as_q_stage", "المرحلة ") + esc(st.id) + askT("as_q_stage_level", " (مستوى ") + esc(st.level) + askT("as_q_stage_close", ")") + '</div>';
    } else if (sess.spec.kind === "placement") {
      stageTag = '<div class="muted">' + askT("as_q_stage_a", "المرحلة A (مستوى A1) — أجب بتركيز، الصعوبة تتكيف مع مستواك") + '</div>';
    }
    var h = '<div class="panel glass"><div class="asr-head"><b>' + esc(sess.spec.modeTitle) + '</b>' +
      '<button class="btn btn-ghost sm" data-as="quit">' + askT("as_q_quit", "إنهاء وحفظ ✖") + '</button></div>' +
      stageTag + qStatusLine();
    if (q.passage) h += '<div class="asr-passage" dir="auto"><div class="asr-de" dir="ltr">' + esc(q.passage) + '</div>' + (q.passageAr ? '<div class="muted">' + esc(q.passageAr) + '</div>' : '') + '</div>';
    h += '<h3 class="asr-prompt">' + esc(q.prompt) + '</h3>';
    if (q.promptAr) h += '<div class="muted">' + esc(q.promptAr) + '</div>';
    if (q.type === "listen") h += '<div class="row-flex"><button class="btn btn-gold sm" data-as="hear">' + askT("as_q_hearbtn", "🔊 استمع") + '</button></div>';
    h += '<div id="asrBody"></div><div class="quiz-feedback hidden" id="asrFb"></div>';
    h += '<div class="row-flex asr-nav"><button class="btn btn-ghost sm" data-as="prev">' + askT("as_q_prev", "⏮ السابق") + '</button>' +
      ((a || q.type === "match") ? "" : '<button class="btn btn-primary sm" data-as="submit">' + askT("as_q_submit", "تحقق ✅") + '</button>') +
      '<button class="btn btn-ghost sm" data-as="next">' + askT("as_q_next", "التالي ⏭") + '</button></div>';
    if (!a && q.type === "match") h += '<div class="muted">' + askT("as_q_match_auto", "💡 أكمل التوصيل — يتم التقييم تلقائيًا عند الانتهاء.") + '</div>';
    if (!a) h += '<div class="muted">' + askT("as_q_lock_hint", "💡 أجب ثم اضغط «تحقق». الإجابة المثبتة لا يمكن تغييرها — مثل الامتحان الحقيقي.") + '</div>';
    h += '</div>';
    box.innerHTML = h;
    renderBody(q, a);
    if (a) showLockedFeedback(q, a);
    else if (q.type === "listen" && !sess.autoSpoke[q.id]) { sess.autoSpoke[q.id] = 1; setTimeout(function () { U.say(q.listenText); }, 450); }
    wireRunner(q);
    tickTimer();
  }
  function renderBody(q, a) {
    var b = $("asrBody"); if (!b) return;
    if (q.type === "order") {
      b.innerHTML = '<div class="quiz-opts" id="asrPool" dir="ltr"></div>' +
        '<div class="asr-ans" id="asrAns" dir="ltr"></div>' +
        (a ? '' : '<div class="row-flex"><button class="btn btn-ghost sm" data-as="clear">' + askT("as_q_clear", "مسح 🗑️") + '</button></div>');
      var pool = $("asrPool");
      var picked = a ? a.pickedArr || [] : [];
      if (a) {
        $("asrAns").innerHTML = picked.map(function (p) { return '<span class="order-chip">' + esc(p) + '</span>'; }).join("");
        try { var pb = document.querySelector('[data-as="clear"]'); if (pb) pb.remove(); } catch (e) {}
      } else {
        sess._picked = [];
        q.chips.forEach(function (c) {
          var btn = document.createElement("button");
          btn.className = "order-chip"; btn.textContent = c; btn.type = "button";
          btn.addEventListener("click", function () {
            if (btn.classList.contains("used")) return;
            btn.classList.add("used"); sess._picked.push(c); drawAns();
          });
          pool.appendChild(btn);
        });
        window.__asrDraw = drawAns;
      }
      function drawAns() {
        var ans = $("asrAns"); if (!ans) return;
        ans.innerHTML = (sess._picked || []).map(function (p, i) { return '<span class="order-chip">' + esc(p) + ' <b data-un="' + i + '" style="cursor:pointer">✖</b></span>'; }).join("");
        ans.querySelectorAll("[data-un]").forEach(function (x) {
          x.addEventListener("click", function () {
            var i = parseInt(x.getAttribute("data-un"), 10);
            var removed = sess._picked.splice(i, 1)[0];
            Array.from(pool.children).forEach(function (c) { if (c.textContent === removed && c.classList.contains("used")) c.classList.remove("used"); });
            drawAns();
          });
        });
      }
      return;
    }
    if (q.type === "fill") {
      b.innerHTML = '<div class="quiz-write"><input type="text" id="asrIn" autocomplete="off" placeholder="' + askT("as_q_write_ph", "اكتب إجابتك...") + '" ' + (a ? 'disabled value="' + esc(a.user) + '"' : '') + '></div>';
      return;
    }
    if (q.type === "speak") {
      var sr = false;
      try { sr = !!(window.SpeechRecognition || window.webkitSpeechRecognition); } catch (e) {}
      b.innerHTML = '<div class="quiz-write"><input type="text" id="asrIn" autocomplete="off" placeholder="Antwort auf Deutsch..." ' + (a ? 'disabled value="' + esc(a.user) + '"' : '') + '>' +
        (!a && sr ? '<button class="btn btn-ghost sm" data-as="mic">' + askT("as_q_mic", "🎤 تحدث") + '</button>' : '') + '</div>' +
        '<div class="muted">' + askT("as_q_sample", "مثال: ") + esc(q.sample || "") + (sr ? '' : askT("as_q_no_sr2", " (التعرف الصوتي غير مدعوم في متصفحك — اكتب إجابتك ⌨️)")) + '</div>';
      return;
    }
    if (q.type === "conj") {
      var cans = a ? a.conjAns || {} : (sess._conj || {});
      b.innerHTML = '<div class="asr-conj">' + q.rows.map(function (r, ri) {
        return '<div class="asr-conjrow"><b>' + esc(r.pron) + ' ___</b><div class="quiz-opts">' + r.opts.map(function (o, oi) {
          var cls = "quiz-opt";
          if (a) {
            if (oi === r.correct) cls += " correct";
            else if (cans[ri] === oi) cls += " wrong";
            if (cans[ri] === oi) cls += " sel";
          } else if (cans[ri] === oi) cls += " sel";
          return '<button class="' + cls + '" data-crow="' + ri + '" data-cpick="' + oi + '" dir="ltr"' + (a ? " disabled" : "") + '>' + esc(o) + '</button>';
        }).join("") + "</div></div>";
      }).join("") + "</div>";
      if (!a) {
        sess._conj = sess._conj || {};
        b.querySelectorAll("[data-crow]").forEach(function (x) {
          x.addEventListener("click", function () {
            var ri = x.getAttribute("data-crow");
            sess._conj[ri] = parseInt(x.getAttribute("data-cpick"), 10);
            b.querySelectorAll('[data-crow="' + ri + '"]').forEach(function (y) { y.classList.remove("sel"); });
            x.classList.add("sel");
          });
        });
      }
      return;
    }
    if (q.type === "match") {
      var locked = a ? a.lockedPairs || [] : [];      b.innerHTML = '<div class="asr-match">' +
        '<div class="asr-mcol" id="asrMDe">' + q.pairs.map(function (p, i) {
          var isL = locked.indexOf(p.de) >= 0;
          return '<button class="quiz-opt asr-mbtn' + (isL ? ' correct' : '') + '" data-mde="' + i + '"' + (isL ? ' disabled' : '') + '>' + esc(p.de) + '</button>';
        }).join("") + '</div>' +
        '<div class="asr-mcol" id="asrMAr">' + C.shuffled(q.pairs.map(function (p) { return p; })).map(function (p) {
          var isL = locked.indexOf(p.de) >= 0;
          return '<button class="quiz-opt asr-mbtn' + (isL ? ' correct' : '') + '" data-mar="' + esc(p.ar) + '" data-mde-ref="' + esc(p.de) + '"' + (isL ? ' disabled' : '') + '>' + esc(p.ar) + '</button>';
        }).join("") + '</div></div>' +
        (a ? '' : '<div class="muted" id="asrMHint">' + (askLang()!=="ar"?askT("as_q_match_hint_en","اختر كلمة ألمانية ثم معناها."):askT("as_q_match_hint","اختر كلمة ألمانية ثم معناها بالعربية.")) + '</div>');
      if (!a) {
        sess._msel = null; sess._merr = 0; sess._mlock = [];
        b.querySelectorAll("[data-mde]").forEach(function (x) {
          x.addEventListener("click", function () {
            if (x.disabled) return;
            b.querySelectorAll("[data-mde]").forEach(function (y) { y.classList.remove("sel"); });
            x.classList.add("sel"); sess._msel = x.getAttribute("data-mde");
          });
        });
        b.querySelectorAll("[data-mar]").forEach(function (x) {
          x.addEventListener("click", function () {
            if (x.disabled || sess._msel === null) { toast(askT("as_q_choose_de_first", "اختر الكلمة الألمانية أولًا")); return; }
            var di = parseInt(sess._msel, 10), deBtn = b.querySelector('[data-mde="' + di + '"]');
            var want = q.pairs[di].ar, got = x.getAttribute("data-mar");
            if (want === got) {
              deBtn.classList.add("correct"); deBtn.disabled = true;
              x.classList.add("correct"); x.disabled = true;
              sess._mlock.push(q.pairs[di].de);
              sess._msel = null;
              if (sess._mlock.length >= q.pairs.length) submitAnswer();
            } else {
              sess._merr = (sess._merr || 0) + 1;
              x.classList.add("wrong");
              setTimeout(function () { try { x.classList.remove("wrong"); } catch (e) {} }, 700);
              toast(askT("as_q_not_right", "❌ ليس المعنى الصحيح — حاول مجددًا"), "err");
            }
          });
        });
      }
      return;
    }
    /* mc / tf / listen / read / default options */
    var opts = q.opts || [];
    b.innerHTML = '<div class="quiz-opts">' + opts.map(function (o, i) {
      var cls = "quiz-opt";
      if (a) {
        if (i === q.correct) cls += " correct";
        else if (i === a.picked && !a.ok) cls += " wrong";
        if (i === a.picked) cls += " sel";
      } else if (sess._sel === i) cls += " sel";
      return '<button class="' + cls + '" data-pick="' + i + '" dir="auto"' + (a ? ' disabled' : '') + '>' + esc(o) + '</button>';
    }).join("") + '</div>';
    if (!a) b.querySelectorAll("[data-pick]").forEach(function (x) {
      x.addEventListener("click", function () {
        sess._sel = parseInt(x.getAttribute("data-pick"), 10);
        b.querySelectorAll("[data-pick]").forEach(function (y) { y.classList.remove("sel"); });
        x.classList.add("sel");
      });
    });
  }
  function wireRunner(q) {
    var box = $("assessRunner"); if (!box) return;
    box.querySelectorAll("[data-as]").forEach(function (btn) {
      if (btn._asw) return; btn._asw = true;
      btn.addEventListener("click", function () {
        var k = btn.getAttribute("data-as");
        if (k === "prev") { if (sess.idx > 0) { sess.idx--; sess._sel = null; try { persistInProgress(); } catch (e2) {} renderQ(); } }
        else if (k === "next") {
          if (sess.idx < sess.qs.length - 1) { sess.idx++; sess._sel = null; try { persistInProgress(); } catch (e2) {} renderQ(); }
          else finish(false);
        }
        else if (k === "submit") submitAnswer();
        else if (k === "quit") {
          persistInProgress();
          stopTimer();
          try { if (window.onbeforeunload) window.onbeforeunload = null; } catch (e0) {}
          sess = null;
          toast(askT("as_q_saved", "💾 تم حفظ تقدمك — يمكنك الاستكمال لاحقًا من المركز"));
          renderCenter();
          try { if (typeof showPage === "function") showPage("quiz"); } catch (e) {}
        }
        else if (k === "hear") U.say(q.listenText);
        else if (k === "clear") {
          sess._picked = [];
          try {
            document.querySelectorAll("#asrPool .order-chip").forEach(function (c) { c.classList.remove("used"); });
            $("asrAns").innerHTML = "";
          } catch (e) {}
        }
        else if (k === "mic") startAsrMic(q);
      });
    });
    try {
      var inp = $("asrIn");
      if (inp && !sess.ans[sess.idx]) inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submitAnswer(); });
    } catch (e) {}
  }
  function startAsrMic(q) {
    var Ctor = null;
    try { Ctor = window.SpeechRecognition || window.webkitSpeechRecognition; } catch (e) {}
    var inp = $("asrIn");
    if (!Ctor) { toast(askT("as_q_no_sr", "التعرف الصوتي غير مدعوم — اكتب إجابتك ⌨️"), "err"); return; }
    try {
      var r = new Ctor();
      r.lang = "de-DE"; r.interimResults = false;
      toast(askT("as_q_speak_now", "🎤 تحدث الآن..."));
      r.onresult = function (e) {
        try {
          var tx = e.results[0][0].transcript;
          if (inp) inp.value = tx;
          toast(askT("as_q_heard", "سمعتك: ") + tx);
        } catch (ex) {}
      };
      r.onerror = function () { toast(askT("as_q_no_hear", "تعذر السماع — اكتب إجابتك ⌨️"), "err"); };
      r.start();
    } catch (e) { toast(askT("as_q_no_mic", "تعذر تشغيل المايك"), "err"); }
  }
  function collectAnswer(q) {
    if (q.type === "order") {
      var joined = (sess._picked || []).join(" ");
      if (!joined.trim()) return { empty: true };
      var norm = function (s) { return String(s || "").replace(/[.?!,]/g, "").trim().replace(/\s+/g, " ").toLowerCase(); };
      var ok = norm(joined) === norm(q.answer);
      return { ok: ok, user: joined, correct: q.answer };
    }
    if (q.type === "fill") {
      var v = ($("asrIn") && $("asrIn").value) || "";
      if (!normWrite(v)) return { empty: true };
      var okF = q.accept.some(function (a) { return normWrite(v) === normWrite(a); });
      return { ok: okF, user: v.trim(), correct: q.answer };
    }
    if (q.type === "speak") {
      var t = ($("asrIn") && $("asrIn").value) || "";
      if (t.trim().length < 2) return { empty: true };
      var g = U.gradeSpeaking(t, q.sample);
      var okS = g.pct >= 60;
      return { ok: okS, user: t.trim(), correct: q.sample, extra: askT("as_q_match_pct", "تطابق الكلمات: ") + g.pct + "%" + (g.notes ? " — " + g.notes : "") + askT("as_q_rated", " (تقييم استرشادي)") };
    }
    if (q.type === "match") return null; /* match submits itself when complete */
    if (q.type === "conj") {
      var cmap = sess._conj || {};
      if (Object.keys(cmap).length < q.rows.length) return { empty: true };
      var okRows = 0;
      var parts = q.rows.map(function (r, ri) {
        var good = cmap[ri] === r.correct;
        if (good) okRows++;
        return r.pron + " " + r.opts[cmap[ri]];
      });
      var okC = okRows >= Math.ceil(q.rows.length * 0.75);
      return { ok: okC, user: parts.join(" • "), correct: correctTextOf(q), conjAns: cmap, extra: askT("as_q_ok_n", "صحيح: ") + okRows + "/" + q.rows.length };
    }
    if (sess._sel === null || sess._sel === undefined) return { empty: true };
    var pi = sess._sel;
    return { ok: pi === q.correct, user: (q.opts || [])[pi], correct: (q.opts || [])[q.correct], picked: pi };
  }
  function submitAnswer() {
    if (!sess) return;
    var q = sess.qs[sess.idx];
    if (sess.ans[sess.idx]) return;
    if (q.type === "match") {
      var allOk = (sess._mlock || []).length >= q.pairs.length && (sess._merr || 0) <= 1;
      return lockAnswer(q, { ok: allOk, user: askT("as_q_match_locked", "توصيل (") + (sess._mlock || []).length + askT("as_q_match_of", "/") + q.pairs.length + askT("as_q_match_err", ", أخطاء: ") + (sess._merr || 0) + askT("as_q_match_end", ")"), correct: q.why, lockedPairs: sess._mlock || [] });
    }
    var r = collectAnswer(q);
    if (!r) return;
    if (r.empty) { toast(askT("as_q_answer_first", "أجب أولًا ✍️"), "err"); return; }
    lockAnswer(q, r);
  }
  /* adaptive difficulty: after a miss, pull an easier unanswered question
     forward (reinforce); after a streak, pull a harder one (stretch).
     Never changes Kapitel/skill coverage — only the order. */
  var DIFF_RANK = { easy: 0, medium: 1, hard: 2 };
  function adaptQueue(ok) {
    try {
      if (!sess || sess.idx + 1 >= sess.qs.length) return;
      var recent = sess.ans.slice(Math.max(0, sess.idx - 2), sess.idx + 1);
      var streak = recent.length === 3 && recent.every(function (x) { return x && x.ok; });
      var slump = recent.length >= 2 && recent.every(function (x) { return x && !x.ok; });
      if (!streak && !slump) return;
      var want = streak ? 2 : 0, cur = DIFF_RANK[sess.qs[sess.idx].diff] == null ? 1 : DIFF_RANK[sess.qs[sess.idx].diff];
      for (var j = sess.idx + 1; j < sess.qs.length; j++) {
        if (sess.ans[j]) continue;
        var rj = DIFF_RANK[sess.qs[j].diff] == null ? 1 : DIFF_RANK[sess.qs[j].diff];
        if ((streak && rj > cur) || (slump && rj < cur)) {
          var nxt = sess.idx + 1;
          if (j !== nxt && !sess.ans[nxt]) {
            var tq = sess.qs[nxt]; sess.qs[nxt] = sess.qs[j]; sess.qs[j] = tq;
            var ta = sess.ans[nxt]; sess.ans[nxt] = sess.ans[j]; sess.ans[j] = ta;
          }
          return;
        }
      }
    } catch (e) {}
  }
  function lockAnswer(q, r) {
    var ms = Date.now() - (sess.t0q || Date.now());
    sess.t0q = Date.now();
    if (sess.qTimed) sess.qDeadline = Date.now() + sess.qSecs * 1000;
    sess.ans[sess.idx] = { ok: !!r.ok, user: String(r.user == null ? "" : r.user), correct: String(r.correct == null ? "" : r.correct), picked: (r.picked == null ? -1 : r.picked), extra: r.extra || "", lockedPairs: r.lockedPairs || [], pickedArr: (sess._picked || []).slice(), conjAns: r.conjAns || null, timeout: !!r.timeout };
    logAttempt(q, !!r.ok, ms);
    progressSideEffects(q, !!r.ok, String(r.user || ""));
    /* game mechanics: combo + perfect rounds (lightweight, no heavy anim) */
    if (r.ok) {
      sess.combo = (sess.combo || 0) + 1;
      if (sess.combo > (sess.bestCombo || 0)) sess.bestCombo = sess.combo;
      if (sess.combo > 0 && sess.combo % 5 === 0) {
        try { if (FN("addXP")) FN("addXP")(5); } catch (e) {}
        toast(askT("as_q_combo", "🔥 كومبو x") + sess.combo + askT("as_q_combo_xp", " — ⭐+5"), "ok");
      }
    } else sess.combo = 0;
    var answeredN = sess.ans.filter(Boolean).length;
    if (answeredN > 0 && answeredN % C.CONFIG.PERFECT_ROUND_N === 0) {
      var round = sess.ans.slice(answeredN - C.CONFIG.PERFECT_ROUND_N, answeredN);
      if (round.length === C.CONFIG.PERFECT_ROUND_N && round.every(function (x) { return x && x.ok; })) {
        sess.perfects = (sess.perfects || 0) + 1;
        try { if (FN("addXP")) FN("addXP")(10); } catch (e2) {}
        toast(askT("as_q_perfect", "🏆 Perfect Round! خمس إجابات صحيحة متتالية ⭐+10"), "ok");
      }
    }
    if (sess.stages) {
      var st = sess.stages[sess.stageIdx];
      if (st) { st.done++; if (r.ok) st.ok++; }
    }
    sess._sel = null; sess._conj = null;
    /* adaptive difficulty: reinforce on struggle, stretch on streaks */
    if (sess.adaptiveDiff && !sess.ans[sess.idx + 1]) adaptQueue(!!r.ok);
    persistInProgress();
    /* adaptive placement: stage complete? advance or finish */
    if (sess.specRef.adaptive && sess.stages) {
      var cur = sess.stages[sess.stageIdx];
      var stageQs = sess.qs.length;
      var answered = sess.ans.filter(Boolean).length;
      if (answered >= stageQs) {
        var pct = cur.done ? Math.round(cur.ok / cur.done * 100) : 0;
        cur.pct = pct;
        var next = sess.stageIdx + 1, specRef = sess.specRef;
        if (pct >= C.CONFIG.STAGE_PASS && next < specRef.stages.length) {
          var lvl = specRef.stages[next].level;
          if (U.levelUnlocked(lvl).ok || lvl === "A1") {
            var more = [];
            try { more = U.buildPool(specRef.stages[next].plan, 3).pool || []; } catch (e) { more = []; }
            if (more.length >= 6) {
              sess.qs = sess.qs.concat(more);
              sess.ans = sess.ans.concat(more.map(function () { return null; }));
              sess.stages.push({ id: specRef.stages[next].id, level: lvl, n: more.length, ok: 0, done: 0 });
              sess.stageIdx++;
              sess.idx++;
              persistInProgress();
              toast(askT("as_q_stageup", "🎉 أحسنت! انتقلت للمرحلة ") + specRef.stages[next].id + " (مستوى " + lvl + ")");
              renderQ();
              return;
            }
          }
        }
        var _s = sess;
        renderQ();
        setTimeout(function () { try { if (A.getSess() === _s) finish(false); } catch (e) {} }, 1100);
        return;
      }
    }
    renderQ();
    var _s2 = sess;
    var last = sess.ans.filter(Boolean).length;
    if (last >= sess.qs.length) {
      setTimeout(function () { try { if (A.getSess() === _s2) finish(false); } catch (e) {} }, 900);
    }
  }
  function showLockedFeedback(q, a) {
    var fb = $("asrFb"); if (!fb) return;
    fb.classList.remove("hidden");
    fb.classList.add(a.ok ? "ok" : "no");
    fb.innerHTML = (a.ok ? askT("as_q_fb_ok", "صحيح ✅ ") : askT("as_q_fb_no", "❌ ")) + esc(q.why || (askT("as_q_fb_right", "الصحيح: ") + a.correct)) + (a.extra ? '<br><span class="muted">' + esc(a.extra) + '</span>' : '');
  }
  /*__APPEND4__*/
  return {
    startFlow: startFlow, resumeFlow: resumeFlow, discardFlow: discardFlow,
    renderRunner: renderRunner, ensureStore: ensureStore, getSess: function () { return sess; },
    setSess: function (s) { sess = s; }, correctTextOf: correctTextOf, modeBadge: modeBadge,
    persistInProgress: persistInProgress, clearInProgress: clearInProgress, stopTimer: stopTimer,
    focusBelowHeader: focusBelowHeader,
    renderCenter: function () { return DMAssess.center.renderCenter(); },
    finish: function (auto) { return DMAssess.center.finish(auto); },
    wireDashBtns: function (root) { return DMAssess.center.wireDashBtns(root); }
  };
})();
/* ============ RESULTS + DASHBOARD + WIRING ============ */
DMAssess.center = (function () {
  "use strict";
  var C = DMAssess, U = DMAssess.ui, A = DMAssess.app;
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function FN(name) { try { var f = window[name]; return typeof f === "function" ? f : null; } catch (e) { return null; } }
  function esc(s) { return U.esc(s); }
  function toast(m, k) { try { var f = FN("toast"); if (f) f(m, k || "ok"); } catch (e) {} }
  function save() { try { var f = FN("save"); if (f) f(); } catch (e) {} }
  function today() { try { var f = FN("todayStr"); if (f) return f(); } catch (e) {} return new Date().toISOString().slice(0, 10); }
  function skillAr(s) { try { var m = (C.SKILLS[s] || {}); var L = "ar"; try { L = (typeof askLang === "function") ? askLang() : (((typeof S !== "undefined" && S && S.uiLang) || "ar")); } catch (e0) {} if (L === "en" && m.en) return m.en; if (L === "de" && (m.de || m.en)) return m.de || m.en; return m.ar || s; } catch (e) { try { return ((C.SKILLS[s] || {}).ar) || s; } catch (e2) { return s; } } }
  function goPage(p) { try { if (typeof showPage === "function") showPage(p); } catch (e) {} }

  function hist() { try { var st = A.ensureStore(); return (st && st.history) || []; } catch (e) { return []; } }

  /* progress signals per Kapitel from accumulated learning (0..100 | null) */
  function progressByKap() {
    var out = {};
    try {
      var gs = FN("getStatus"), GR = (typeof GRAMMAR !== "undefined") ? GRAMMAR : [];
      /* gid->kap map once (was a linear GRAMMAR scan per key per Kapitel). */
      var gkap = {};
      try { for (var gi = 0; gi < GR.length; gi++) if (GR[gi] && GR[gi].id) gkap[GR[gi].id] = GR[gi].kap; } catch (e0) {}
      U.kapitelList().forEach(function (k) {
        var ws = U.vocabPool({ kap: k.id });
        var vr = null, gr = null;
        if (ws.length >= 5 && gs) {
          var kn = ws.filter(function (w) { try { return gs(w.id) === "known"; } catch (e) { return false; } }).length;
          vr = kn / ws.length * 100;
        }
        try {
          var entries = [];
          Object.keys(((typeof S !== "undefined" && S.grammar) || {})).forEach(function (gid) {
            if (gkap[gid] !== k.id) return;
            var m = S.grammar[gid];
            if (m && m.n) entries.push(m.ok / m.n * 100);
          });
          if (entries.length) gr = entries.reduce(function (a, b) { return a + b; }, 0) / entries.length;
        } catch (e) {}
        if (vr !== null && gr !== null) out[k.id] = 0.6 * vr + 0.4 * gr;
        else if (vr !== null) out[k.id] = vr;
        else if (gr !== null) out[k.id] = gr;
        else out[k.id] = null;
      });
    } catch (e) {}
    return out;
  }
  /* aggregate skill/kap evidence from recent history (fresh, never stored) */
  function aggregateEvidence(n) {
    var H = hist().slice(0, n || 5), sk = {}, kp = {}, tot = { n: 0, ok: 0 };
    C.SKILL_KEYS.forEach(function (s) { sk[s] = { n: 0, ok: 0 }; });
    H.forEach(function (h) {
      Object.keys(h.skills || {}).forEach(function (s) {
        if (!sk[s]) return;
        sk[s].n += h.skills[s].n || 0; sk[s].ok += h.skills[s].ok || 0;
      });
      Object.keys(h.kaps || {}).forEach(function (k) {
        if (!kp[k]) kp[k] = { n: 0, ok: 0 };
        kp[k].n += h.kaps[k].n || 0; kp[k].ok += h.kaps[k].ok || 0;
      });
      tot.n += h.total || 0; tot.ok += h.score || 0;
    });
    Object.keys(sk).forEach(function (s) { sk[s].pct = sk[s].n ? Math.round(sk[s].ok / sk[s].n * 100) : 0; sk[s].ev = sk[s].n >= C.CONFIG.MIN_SKILL_N ? "ok" : (sk[s].n ? "thin" : "none"); });
    Object.keys(kp).forEach(function (k) { kp[k].pct = kp[k].n ? Math.round(kp[k].ok / kp[k].n * 100) : 0; });
    return { skills: sk, kaps: kp, total: tot, sessions: H.length };
  }
  function kapitelReadinessMap(testKaps) {
    var prog = progressByKap(), map = {};
    U.kapitelList().forEach(function (k) {
      var t = (testKaps || {})[k.id] || null;
      map[k.id] = C.kapitelReadiness(t && t.n ? t : null, prog[k.id]);
    });
    return map;
  }

  /* ---------------- finish ---------------- */
  function finish(auto) {
    var sess = A.getSess();
    if (!sess) return null;
    A.stopTimer();
    try { if (sess._prevUnload !== undefined) window.onbeforeunload = sess._prevUnload || null; else window.onbeforeunload = null; } catch (e) {}
    sess.qs.forEach(function (q, i) {
      if (!sess.ans[i]) sess.ans[i] = { ok: false, user: askT("as_q_no_answer", "— (بدون إجابة)"), correct: A.correctTextOf(q), picked: -1, extra: "", skipped: true };
    });
    var items = sess.qs.map(function (q, i) {
      return { skill: q.skill, topic: q.topicAr || q.topic, kap: q.kap, ok: !!sess.ans[i].ok, w: q.type === "speak" ? 0.5 : 1 };
    });
    var scored = C.scoreAnswers(items);
    var stages = (sess.stages || []).map(function (s) { return { id: s.id, pct: s.done ? Math.round(s.ok / s.done * 100) : 0, n: s.done }; });
    var levelVerdict = null;
    if (sess.spec.kind === "placement") levelVerdict = C.levelFromStages(stages);
    else if (sess.spec.kind === "exam") {
      var pass = scored.total.pct >= (sess.spec.passPct || C.CONFIG.PASS_A1_EXAM);
      levelVerdict = pass
        ? { level: sess.spec.level || "A1", confidence: scored.confidence, inconclusive: false, note: askT("as_r_exam_pct", "امتحان شامل بنسبة ") + scored.total.pct + "%" }
        : { level: "pre-" + (sess.spec.level || "A1"), confidence: scored.confidence, inconclusive: scored.inconclusive, note: askT("as_r_pass_no", "لم تصل لعتبة النجاح ") + (sess.spec.passPct || C.CONFIG.PASS_A1_EXAM) + "% — واصل التدرب" };
    }
    var rmap = kapitelReadinessMap(scored.kaps);
    var order = U.kapitelList().map(function (k) { return k.id; });
    var cur = C.currentKapitel(rmap, order);
    var dur = Math.max(0, Math.round((Date.now() - sess.startedAt) / 1000));
    var status = sess.spec.kind === "exam"
      ? (scored.total.pct >= (sess.spec.passPct || C.CONFIG.PASS_A1_EXAM) ? askT("as_r_passed", "ناجح 🎉") : askT("as_r_failed", "لم تنجح هذه المرة 💪"))
      : (scored.inconclusive ? askT("as_r_inconc", "غير حاسمة") : askT("as_r_done", "مكتمل ✅"));
    var review = [];
    sess.qs.forEach(function (q, i) {
      var a = sess.ans[i];
      if (!a.ok && review.length < 25) {
        review.push({ p: String(q.prompt).slice(0, 160), ps: q.passage ? String(q.passage).slice(0, 200) : "", u: String(a.user).slice(0, 120), c: String(a.correct).slice(0, 120), why: String(q.why || "").slice(0, 220), sk: q.skill, tp: q.topicAr || q.topic, kap: q.kap, gid: q.gid || null, refId: q.refId || null });
      }
    });
    var sessMode = sess.spec.mode || (sess.spec.kind === "exam" ? "exam" : "test");
    var bestKey = sess.spec.kind + ":" + (sess.spec.cat || "") + ":" + (sess.spec.kap || "") + ":" + (sess.spec.level || "") + ":" + sessMode;
    var entry = {
      id: "as" + Date.now().toString(36), ts: Date.now(), date: today(),
      mode: sess.spec.kind, sessMode: sessMode, cat: sess.spec.cat || null,
      title: sess.spec.modeTitle + (sess.spec.kap ? " — " + sess.spec.kap : "") + (sess.spec.skill ? " — " + skillAr(sess.spec.skill) : ""),
      level: levelVerdict ? levelVerdict.level : null, levelConf: levelVerdict ? levelVerdict.confidence : null,
      kapitel: cur.current, kapitelNext: cur.next,
      score: scored.total.ok, total: sess.qs.length, pct: scored.total.pct,
      dur: dur, conf: scored.confidence, confWhy: scored.confWhy, status: status,
      skills: scored.skills, kaps: scored.kaps, rmap: rmap,
      weak: C.weakSkills(scored.skills), strong: C.strongSkills(scored.skills),
      weakTopics: C.weakTopics(scored.topics, 6).map(function (x) { return { sk: x.skill, tp: x.topic, pct: x.pct, n: Math.round(x.n) }; }),
      stages: stages, review: review, specId: sess.spec.id, bestKey: bestKey,
      comboBest: sess.bestCombo || 0, perfects: sess.perfects || 0, newRecord: false
    };
    /* personal records (additive keys only; history stays the source of truth) */
    try {
      var st0 = A.ensureStore();
      if (st0) {
        if (!st0.best || typeof st0.best !== "object") st0.best = {};
        if (!st0.days || typeof st0.days !== "object") st0.days = {};
        if (entry.pct > (st0.best[bestKey] || 0)) { st0.best[bestKey] = entry.pct; entry.newRecord = (st0.history || []).some(function (h) { return h.bestKey === bestKey; }); }
        if ((sess.bestCombo || 0) > (st0.bestCombo || 0)) st0.bestCombo = sess.bestCombo;
        var dk = today();
        st0.days[dk] = (st0.days[dk] || 0) + 1;
        var dks = Object.keys(st0.days).sort();
        while (dks.length > 60) { delete st0.days[dks.shift()]; }
      }
    } catch (e5) {}
    /* persist history (ring buffer) */
    try {
      var st = A.ensureStore();
      st.history.unshift(entry);
      while (st.history.length > C.CONFIG.HISTORY_CAP) st.history.pop();
      save();
    } catch (e) {}
    /* integrate with existing progress (single-counted) */
    try {
      if (typeof S !== "undefined") {
        S.testsTaken = (S.testsTaken || 0) + 1;
        if (entry.pct > (S.bestPct || 0)) S.bestPct = entry.pct;
        var xp = sess.spec.kind === "exam" ? (entry.pct >= (sess.spec.passPct || 70) ? 30 : 10) : (sess.spec.kind === "placement" ? 15 : 8);
        S.lastQuiz = { type: "🎯 " + entry.title, score: entry.score, total: entry.total, pct: entry.pct, xp: xp, date: today() };
        S.quizHistory = S.quizHistory || [];
        S.quizHistory.unshift({ type: "🎯 " + entry.title, score: entry.score, total: entry.total, pct: entry.pct, xp: xp, date: today() + " " + new Date().toLocaleTimeString("ar") });
        S.quizHistory = S.quizHistory.slice(0, 20);
        if (sess.spec.kind === "placement" && levelVerdict && !levelVerdict.inconclusive) {
          var det = C.SKILL_KEYS.filter(function (s) { return entry.skills[s] && entry.skills[s].n; }).map(function (s) { return { k: s, n: Math.round(entry.skills[s].n), ok: Math.round(entry.skills[s].ok), pct: entry.skills[s].pct }; });
          var path = entry.level === "A0" ? askT("as_r_path_a0", "Start A1 🟢") : (entry.level === "A1" ? askT("as_r_path_a1", "أكمل A1 ثم A2 🚀") : askT("as_r_path_go", "واصل إلى ") + entry.level);
          S.place = { score: Math.round(entry.pct / 100 * 12), total: 12, pct: entry.pct, lvl: entry.level, path: path, date: today(), skills: det };
          S.placeHistory = S.placeHistory || [];
          S.placeHistory.unshift({ score: Math.round(entry.pct / 100 * 12), lvl: entry.level, date: today(), skills: det });
          S.placeHistory = S.placeHistory.slice(0, 10);
        }
        if (sess.spec.id === "exam-a1" && entry.pct >= (sess.spec.passPct || 70)) {
          try {
            var el = FN("ensureLearn"); if (el) el();
            if (!S.journey) S.journey = { lessons: {}, listen: {}, speak: {}, talk: {}, final: {} };
            if (!S.journey.final) S.journey.final = {};
            S.journey.final.A1 = { pct: entry.pct, date: today() };
          } catch (e2) {}
        }
        if (FN("addXP")) FN("addXP")(xp);
        if (FN("checkAch")) { try { FN("checkAch")(); } catch (e3) {} }
        save();
        try { if (FN("renderAll")) FN("renderAll")(); } catch (e4) {}
      }
    } catch (e) {}
    A.clearInProgress();
    A.setSess(null);
    renderResult(entry);
    return entry;
  }

  function confAr(c) { return c === "high" ? askT("as_r_conf_h", "مرتفع ✅") : c === "medium" ? askT("as_r_conf_m", "متوسط 🟡") : askT("as_r_conf_l", "منخفض ⚠️"); }
  function pracGoFor(entry, r) {
    var sk = r.sk, go = ((C.SKILLS[sk] || {}).go) || "practice";
    if (r.gid) return { go: "labs", gid: r.gid, label: askT("as_r_train_here", "تدرب على هذا الموضوع 🧪") };
    return { go: go, label: askT("as_r_train_skill", "تدرب على ") + skillAr(sk) + askT("as_r_arrow", " ←") };
  }
  /* ---------------- result page ---------------- */
  function renderResult(entry) {
    var root = $("assessRoot"); if (!root) return;
    var st, h = '<div id="assessResult">';
    h += '<div class="panel glass asd-hero"><div class="muted">' + esc(entry.title) + ' • ' + esc(entry.date) + ' • ⏱️ ' + Math.floor(entry.dur / 60) + ':' + String(entry.dur % 60).padStart(2, "0") + '</div>';
    h += '<div class="asr-big">' + entry.pct + '%</div>';
    h += '<div><b>' + esc(entry.status) + '</b> <span class="muted">(' + entry.score + '/' + entry.total + ')</span></div>';
    if (entry.newRecord) h += '<div class="quiz-feedback ok">' + askT("as_r_record", "🎉 رقم قياسي جديد — أفضل نتيجة لك في هذا النوع!") + '</div>';
    if (entry.comboBest >= 3) h += '<div class="muted">' + askT("as_r_streak", "🔥 أطول سلسلة صحيحة: ") + '<b>x' + entry.comboBest + '</b>' + (entry.perfects ? askT("as_r_combo", " • 🏆 Perfect Rounds: ") + entry.perfects : '') + '</div>';
    if (entry.level) {
      h += '<div class="asd-lvlrow"><div class="asd-lvl"><span class="muted">' + askT("as_r_your", "مستواك: ").replace(/:\s*$/, "") + '</span><b>' + esc(entry.level) + '</b></div>';
      h += '<div class="asd-lvl"><span class="muted">Kapitel</span><b>' + esc(entry.kapitel || "—") + '</b></div>';
      h += '<div class="asd-lvl"><span class="muted">'+askT("as_r_conf", "مستوى الثقة")+'</span><b>' + esc(confAr(entry.levelConf || entry.conf)) + '</b></div></div>';
    } else {
      h += '<div class="asd-lvlrow"><div class="asd-lvl"><span class="muted">' + askT("as_c_kap", "Kapitel الحالي") + '</span><b>' + esc(entry.kapitel || "—") + '</b></div>';
      if (entry.kapitelNext) h += '<div class="asd-lvl"><span class="muted">' + askT("as_r_next_kap", "التالي") + '</span><b>' + esc(entry.kapitelNext) + '</b></div>';
      h += '<div class="asd-lvl"><span class="muted">'+askT("as_r_conf", "مستوى الثقة")+'</span><b>' + esc(confAr(entry.conf)) + '</b></div></div>';
      if (entry.confWhy) h += '<div class="muted">' + askT("as_r_why", "لماذا؟ ") + esc(entry.confWhy) + '</div>';
    }
    if (entry.stages && entry.stages.length > 1) {
      h += '<div class="muted">' + askT("as_r_stages", "المراحل: ") + entry.stages.map(function (s) { return esc(s.id) + " " + s.pct + "%"; }).join(askLang()==="ar"?" ← ":" → ") + '</div>';
    }
    h += '</div>';
    /* skill table (exam mode uses official section names) */
    var SEC_AR = { listening: "Hören — الاستماع 🎧", reading: "Lesen — القراءة 📖", vocab: "Wortschatz — المفردات 📚", grammar: "Grammatik — القواعد 📐", writing: "Schreiben — الكتابة ✍️", speaking: "Sprechen — التحدث 🎤" };
    h += '<div class="panel glass"><h3>' + (entry.mode === "exam" ? askT("as_r_score", "📊 درجات الأقسام") : askT("as_r_skills", "📊 المهارات")) + '</h3><div class="asd-skills">';
    C.SKILL_KEYS.forEach(function (s) {
      var m = entry.skills[s];
      if (!m || !m.n) return;
      st = C.statusOf(m.pct, m.ev);
      var lbl = (entry.mode === "exam" && SEC_AR[s]) ? askSec(s) : skillAr(s);
      h += '<div class="asd-skill"><div class="row-flex"><b>' + esc(lbl) + '</b><span>' + m.pct + '%</span></div>' +
        '<div class="progress sm"><div class="progress-fill" style="width:' + m.pct + '%"></div></div>' +
        '<div class="muted">' + st.ico + ' ' + st.ar + (m.ev === "thin" ? askT("as_r_thin", " (إجابات قليلة: ") + Math.round(m.n) + askT("as_r_thin_n", ")") : '') + '</div></div>';
    });
    h += '</div></div>';
    /* strengths / weaknesses */
    h += '<div class="grid-2"><div class="panel glass"><h3>' + askT("as_r_strong", "💪 نقاط القوة") + '</h3>' +
      (entry.strong.length ? entry.strong.map(function (s) { return '<div class="muted">✅ ' + esc(skillAr(s)) + ' (' + entry.skills[s].pct + '%)</div>'; }).join("") : '<div class="muted">'+askT("as_r_notop", "لا نقاط قوة مؤكدة بعد — واصل التدرب.")+'</div>') + '</div>';
    h += '<div class="panel glass"><h3>' + askT("as_r_weak", "⚠️ تحتاج مراجعة") + '</h3>' +
      (entry.weak.length ? entry.weak.map(function (s) { return '<div class="muted">🔴 ' + esc(skillAr(s)) + ' (' + entry.skills[s].pct + '%)</div>'; }).join("") : '<div class="muted">'+askT("as_r_noweak", "🎉 لا نقاط ضعف مؤكدة!")+'</div>') +
      (entry.weakTopics.length ? '<div class="muted">'+askT("as_r_weak_det", "🎯 بالتفصيل: ") + entry.weakTopics.map(function (t) { return esc(typeof askTopic==="function"?askTopic(t.tp):t.tp) + " (" + t.pct + "%)"; }).join(" • ") + '</div>' : '') + '</div></div>';
    /* next steps */
    var recs = [];
    (entry.weak.length ? entry.weak : C.SKILL_KEYS.filter(function (s) { return entry.skills[s] && entry.skills[s].n; }).slice(0, 3)).slice(0, 3).forEach(function (s) {
      recs.push({ label: (entry.weak.length ? askT("as_r_rec_rev", "راجع ") : askT("as_r_rec_go", "واصل ")) + skillAr(s), go: ((C.SKILLS[s] || {}).go) || "practice" });
    });
    recs.push({ label: askT("as_r_mist", "❌ مراجعة أخطائي"), go: "mistakes" });
    recs.push({ label: askT("as_r_journey", "🗺️ الرحلة"), go: "journey" });
    h += '<div class="panel glass"><h3>' + askT("as_r_next", "➡️ ماذا تفعل الآن؟") + '</h3><div class="muted">' + askT("as_r_your", "مستواك: ") + '<b>' + esc(entry.level || "—") + '</b>' + askT("as_r_kap", " • Kapitel: ") + '<b>' + esc(entry.kapitel || "—") + '</b></div><div class="row-flex">' +
      recs.map(function (r, i) { return '<button class="btn btn-ghost sm" data-asgo="' + esc(r.go) + '">' + esc(r.label) + '</button>'; }).join("") + '</div></div>';
    /* answer review */
    h += '<div class="panel glass"><h3>' + askT("as_r_rev", "🔍 مراجعة الإجابات الخاطئة (") + entry.review.length + askT("as_r_rev_close", ")") + '</h3>';
    if (!entry.review.length) h += '<div class="quiz-feedback ok">' + window.t("sc_quiz_noerr") + '</div>';
    h += entry.review.map(function (r, i) {
      var pg = pracGoFor(entry, r);
      return '<div class="asr-rev"><div><b>' + esc(r.p) + '</b></div>' +
        (r.ps ? '<div class="muted asr-de" dir="ltr">' + esc(r.ps) + '</div>' : '') +
        '<div>' + askT("as_r_you", "إجابتك: ") + '<b style="color:var(--red,#e5484d)">' + esc(r.u) + '</b></div>' +
        '<div>' + askT("as_r_right", "الصحيح: ") + '<b style="color:var(--green,#30a46c)">' + esc(r.c) + '</b></div>' +
        (r.why ? '<div class="muted">💡 ' + esc(r.why) + '</div>' : '') +
        '<div class="muted">🏷️ ' + esc(skillAr(r.sk)) + askT("as_r_skill_sec", " • ") + esc(typeof askTopic==="function"?askTopic(r.tp || ""):r.tp || "") + (r.kap ? askT("as_r_skill_sec", " • ") + esc(r.kap) : '') + '</div>' +
        '<div class="row-flex"><button class="btn btn-ghost sm" data-asgo="' + esc(pg.go) + '"' + (r.gid ? ' data-gid="' + esc(r.gid) + '"' : '') + '>' + esc(pg.label) + '</button></div></div>';
    }).join("") + '</div>';
    h += '<div class="row-flex"><button class="btn btn-primary sm" data-as="retry">' + askT("sc_retry", "🔄 إعادة الاختبار") + '</button><button class="btn btn-ghost sm" data-as="dash">' + askT("as_r_center", "← المركز") + '</button><button class="btn btn-ghost sm" data-asgo="practice">🎯 '+window.t("practice")+'</button></div>';
    h += '</div>';
    root.innerHTML = h;
    wireDashBtns(root);
    root.querySelectorAll("[data-asgo]").forEach(function (b) {      if (b._asg) return; b._asg = true;
      b.addEventListener("click", function () {
        var go = b.getAttribute("data-asgo"), gid = b.getAttribute("data-gid");
        goPage(go);
        if (gid) setTimeout(function () {
          try {
            if (typeof openGLab === "function") openGLab(gid);
            else if (typeof openExplain === "function") openExplain(gid);
          } catch (e) {}
        }, 400);
      });
    });
    /* Single header-aware focus on the result. (Previously this did BOTH
       scrollIntoView AND scrollTo(top:0) — the two fought and the page
       jumped to an unrelated position.) */
    try { A.focusBelowHeader(root.querySelector("#assessResult") || root, { extra: 4 }); } catch (e) {}
  }

/* ---------------- dashboard ---------------- */
  function inProgressValid() {
    try {
      var st = A.ensureStore(), ip = st && st.inProgress;
      if (!ip || ip.v !== C.CONFIG.STORE_V || !ip.qs || !ip.qs.length) return null;
      if (Date.now() - (ip.startedAt || 0) > C.CONFIG.RESUME_TTL_DAYS * 86400000) return null;
      var done = (ip.ans || []).filter(Boolean).length;
      return { title: (ip.specMeta || {}).modeTitle || askT("as_r_test", "اختبار"), done: done, total: ip.qs.length };
    } catch (e) { return null; }
  }
  function dashboardData() {
    var H = hist();
    var last = H[0] || null;
    var best = 0;
    H.forEach(function (h) { if (h.pct > best) best = h.pct; });
    var agg = aggregateEvidence(5);
    var mastery = 0, masteryN = 0;
    H.slice(0, 3).forEach(function (h) { mastery += h.pct; masteryN++; });
    mastery = masteryN ? Math.round(mastery / masteryN) : 0;
    var place = null;
    try { place = (typeof S !== "undefined" && S.place) || null; } catch (e) {}
    var rmap = kapitelReadinessMap(agg.kaps);
    var order = U.kapitelList().map(function (k) { return k.id; });
    var cur = C.currentKapitel(rmap, order);
    var lvl = null;
    for (var i = 0; i < H.length; i++) if (H[i].level && H[i].mode === "placement") { lvl = H[i].level; break; }
    if (!lvl && place && place.lvl) lvl = place.lvl;
    return { last: last, best: best, count: H.length, mastery: mastery, masteryN: masteryN, agg: agg, rmap: rmap, cur: cur, lvl: lvl, order: order };
  }
  function kapStateChip(r) {
    if (!r || r.conf === "none") return '<span class="muted">' + askT("as_r_badge_unconf", "🔒 غير مؤكد") + '</span>';
    if (r.pct >= C.CONFIG.KAP_MASTERED) return '<span class="as-ok">' + askT("as_r_badge_mastered", "✓ متقن ") + r.pct + '%</span>';
    if (r.pct >= C.CONFIG.KAP_READY) return '<span class="as-ok">' + askT("as_r_badge_ready", "✓ جاهز ") + r.pct + '%</span>';
    if (r.pct >= 40) return '<span class="as-warn">🟡 ' + r.pct + '%' + askT("as_r_badge_rev", " — يحتاج مراجعة") + '</span>';
    return '<span class="muted">🔒 ' + r.pct + '%' + askT("as_r_badge_locked", " — غير جاهز") + '</span>';
  }
  function renderCenter() {
    A.stopTimer();
    var root = $("assessRoot"); if (!root) return;
    var d = dashboardData(), ip = inProgressValid();
    var h = '<div id="assessDash">';
    if (ip) {
      h += '<div class="panel glass as-resume"><b>' + askT("as_r_resume", "💾 لديك اختبار غير مكتمل: ") + esc(ip.title) + ' (' + ip.done + '/' + ip.total + ')</b>' +
        '<div class="row-flex"><button class="btn btn-primary sm" data-as="resume">' + askT("as_r_resume_go", "▶️ استكمال الاختبار") + '</button><button class="btn btn-ghost sm" data-as="discard">' + askT("as_r_discard", "🗑️ تجاهل") + '</button></div></div>';
    }
    /* guided Test Center flow (testcenter.js, additive; guarded) */
    try { if (typeof DMTestCenter !== "undefined" && DMTestCenter && DMTestCenter.renderSection) h += DMTestCenter.renderSection(d); } catch (e) {}
    /* status */
    var kapTxt = d.cur.current ? d.cur.current : "—";
    var kapSub = !d.cur.current ? askT("as_c_kap_start", "ابدأ أول تقييم") : (d.cur.next ? askT("as_c_kap_next", "قريب من ") + d.cur.next : askT("as_c_kap_adv", "متقدم 🎉"));
    h += '<div class="panel glass"><h3>' + askT("as_c_head", "🎯 مركز الاختبارات والتقييم") + '</h3><div class="muted">' + askT("as_c_sub", "هنا تعرف مستواك الحقيقي، والـ Kapitel الذي أنت فيه، ونقاط ضعفك، وماذا تذاكر الآن.") + '</div>';
    h += '<div class="asd-grid">' +
      statCard("📊", askT("as_c_level", "مستواك الحالي"), d.lvl || "—", d.lvl ? "" : askT("as_c_level_none", "حدد مستواك أولًا")) +
      statCard("📖", askT("as_c_kap", "Kapitel الحالي"), kapTxt, kapSub) +
      statCard("🏆", askT("as_c_mastery", "الإتقان"), d.masteryN ? d.mastery + "%" : "—", d.masteryN ? askT("as_c_mastery_avg", "متوسط آخر ") + d.masteryN + askT("as_c_mastery_q", " اختبارات") : askT("as_c_mastery_none", "لا اختبارات بعد")) +
      statCard("🕘", askT("as_c_last", "آخر اختبار"), d.last ? d.last.pct + "%" : "—", d.last ? esc(d.last.title) : askT("as_c_last_go", "ابدأ الآن 🚀")) +
      statCard("⭐", askT("as_c_best", "أفضل نتيجة"), d.count ? d.best + "%" : "—", d.count ? d.count + askT("as_c_best_n", " اختبارات محلولة") : askT("as_c_best_0", "0 اختبارات")) +
      statCard("🎯", askT("as_c_acc", "دقة الإجابات"), d.agg.total.n ? Math.round(d.agg.total.ok / d.agg.total.n * 100) + "%" : "—", d.agg.total.n ? d.agg.total.n + askT("as_c_acc_n", " إجابة مسجلة") : askT("as_c_acc_go", "أجب لتظهر دقتك")) +
      '</div>';
    var sk = d.agg.skills;
    var strong = C.SKILL_KEYS.filter(function (s) { return sk[s].ev === "ok" && sk[s].pct >= C.CONFIG.STRONG_SKILL; });
    var weak = C.SKILL_KEYS.filter(function (s) { return sk[s].ev === "ok" && sk[s].pct < C.CONFIG.GOOD_SKILL; });
    h += '<div class="row-flex"><span class="muted">' + askT("as_c_strong", "💪 القوية:") + '</span>' + (strong.length ? strong.map(function (s) { return '<span class="tag">' + esc(skillAr(s)) + '</span>'; }).join("") : '<span class="muted">—</span>') + '</div>';
    h += '<div class="row-flex"><span class="muted">' + askT("as_c_weak", "⚠️ الضعيفة:") + '</span>' + (weak.length ? weak.map(function (s) { return '<span class="tag">' + esc(skillAr(s)) + ' ' + sk[s].pct + '%</span>'; }).join("") : '<span class="muted">—</span>') + '</div>';
    h += '</div>';
    /* placement hero */
    h += '<div class="panel glass as-hero"><div><h3>' + askT("as_c_place_h", "🎯 اختبار تحديد المستوى") + '</h3><div class="muted">' + askT("as_c_place_sub", "اختبار شامل تكيّفي (A1 ← A2 ← B1): مفردات، قواعد، جمل، قراءة، استماع، مواقف عملية، وتحدث اختياري. يحدد مستواك والـ Kapitel بدقة.") + '</div></div>' +
      '<button class="btn btn-primary" data-as="start:placement">' + askT("as_c_place_go", "ابدأ تحديد المستوى 🚀") + '</button></div>';
    /* general modes */
    h += '<div class="panel glass"><h3>' + askT("as_c_dur", "⚡ حسب المدة") + '</h3><div class="row-flex">' +
      '<button class="btn btn-ghost sm" data-as="start:mixed-8">' + askT("as_c_quick8", "اختبار سريع (8)") + '</button>' +
      '<button class="btn btn-ghost sm" data-as="start:mixed-16">' + askT("as_c_mid16", "اختبار متوسط (16)") + '</button>' +
      '<button class="btn btn-ghost sm" data-as="start:mixed-30">' + askT("as_c_full30", "اختبار شامل (30)") + '</button></div></div>';
    /* kapitel tests (dynamic from real KAPITEL) */
    h += '<div class="panel glass"><h3>' + askT("as_c_kap_h", "📖 اختبارات Kapitel") + '</h3><div class="asd-kaps">';
    U.kapitelList().forEach(function (k) {
      h += '<button class="quick-btn" data-as="start:kap-' + esc(k.id) + '">' + esc(k.icon || "📖") + ' ' + esc(k.id) + '<br><small>' + esc(k.name) + '</small></button>';
    });
    h += '</div></div>';
    /* skill tests */
    h += '<div class="panel glass"><h3>' + askT("as_c_skill_h", "🧠 اختبارات المهارات") + '</h3><div class="asd-kaps">';
    C.SKILL_KEYS.forEach(function (s) {
      h += '<button class="quick-btn" data-as="start:skill-' + s + '">' + esc(skillAr(s)) + '<br><small>' + esc((C.SKILLS[s] || {}).de || "") + '</small></button>';
    });
    h += '</div></div>';
    /* exams */
    h += '<div class="panel glass"><h3>' + askT("as_c_exam_h", "🏁 الامتحانات الشاملة") + '</h3><div class="grid-2">';
    h += '<div class="asd-exam"><b>🇩🇪 ' + askT("as_c_exam_a1", "امتحان A1 الشامل") + '</b><div class="muted">Hören • Lesen • Wortschatz • Grammatik • Schreiben • Sprechen — ' + askT("as_c_exam_pass", "النجاح من ") + C.CONFIG.PASS_A1_EXAM + '% ' + askT("as_c_exam_timed", "— بتوقيت ⏱️") + '</div><button class="btn btn-gold sm" data-as="start:exam-a1">' + askT("as_c_start_exam", "ابدأ الامتحان 🏁") + '</button></div>';
    ["A2", "B1", "B2"].forEach(function (lv) {
      var g = U.levelUnlocked(lv);
      if (g.ok) h += '<div class="asd-exam"><b>🇩🇪 ' + askT("as_c_exam", "امتحان ") + lv + ' ' + askT("as_c_exam_full", "الشامل") + '</b><div class="muted">' + askT("as_c_exam_avail", "محتوى ") + lv + askT("as_c_exam_avail2", " متاح (") + g.words + askT("as_c_exam_words", " كلمة).") + '</div><button class="btn btn-gold sm" data-as="start:exam-' + lv.toLowerCase() + '">' + askT("as_c_start_exam", "ابدأ الامتحان 🏁") + '</button></div>';
      else h += '<div class="asd-exam locked"><b>🔒 ' + askT("as_c_exam", "امتحان ") + lv + '</b><div class="muted">' + askT("as_c_exam_prep", "المحتوى قيد التجهيز (") + (g.words || 0) + askT("as_c_exam_w2", " كلمة، ") + (g.grammar || 0) + askT("as_c_exam_rules", " قواعد)") + askT("as_c_exam_soon", " — سيُفتح عند اكتمال المحتوى.") + '</div>' +
        (typeof Curriculum !== "undefined" ? '<button class="btn btn-ghost sm" data-as="load:' + lv + '">' + askT("as_c_exam_load", "⬇️ تحميل محتوى ") + lv + '</button>' : '') + '</div>';
    });
    h += '</div><div class="muted">' + askT("as_c_exam_note", "امتحانات Deutsch Master الداخلية — ليست شهادات رسمية (ليست Goethe).") + '</div></div>';
    /* kapitel map */
    h += '<div class="panel glass"><h3>' + askT("as_c_map", "🗺️ خريطة الـ Kapitel") + '</h3><div class="asd-map">';
    var kl = U.kapitelList();
    kl.forEach(function (k, i) {
      var r = d.rmap[k.id];
      var ico = !r || r.conf === "none" ? "🔒" : r.pct >= C.CONFIG.KAP_MASTERED ? "✓" : r.pct >= C.CONFIG.KAP_READY ? "✓" : r.pct >= 40 ? "🟡" : "🔒";
      h += '<button class="asd-maprow" data-as="start:kap-' + esc(k.id) + '"><span class="asd-mapico">' + ico + '</span><span><b>' + esc(k.id) + ' • ' + esc(k.name) + '</b><br>' + kapStateChip(r) + '</span><span>←</span></button>';
      if (i < kl.length - 1) h += '<div class="asd-mapdown">↓</div>';
    });
    h += '</div><div class="muted">' + askT("as_c_map_hint", "اضغط على أي Kapitel لاختباره أو مراجعته.") + '</div></div>';
    /* trends */
    var H = hist().slice(0, 5).reverse();
    if (H.length) {
      h += '<div class="panel glass"><h3>' + askT("as_c_prog", "📈 تقدمك عبر الوقت") + '</h3><div class="asd-bars">' +
        H.map(function (x) { return '<div class="asd-bar"><div class="asd-barfill" style="height:' + Math.max(4, x.pct) + '%"></div><span>' + x.pct + '%</span><small>' + esc(x.date.slice(5)) + '</small></div>'; }).join("") +
        '</div></div>';
    }
    /* history */
    h += '<div class="panel glass"><h3>' + askT("as_c_hist", "📜 سجل الاختبارات (") + d.count + askT("as_c_hist_close", ")") + '</h3><div class="history-list">';
    if (!d.count) h += '<div class="muted">' + askT("as_c_hist_none", "لم تحل أي تقييم بعد — ابدأ بتحديد المستوى! 🚀") + '</div>';
    h += hist().slice(0, 8).map(function (x) {
      return '<div class="history-item"><span>🎯 ' + esc(x.title) + ' • ' + esc(x.date) + ' • ⏱️ ' + Math.floor(x.dur / 60) + ':' + String(x.dur % 60).padStart(2, "0") + (x.level ? ' • ' + esc(x.level) : '') + '</span><span><b>' + x.pct + '%</b> <button class="btn btn-ghost sm" data-as="hist:' + x.id + '">فتح ←</button></span></div>';
    }).join("") + '</div></div>';
    /* legacy quick tests anchor */
    h += '<div class="panel glass"><h3>' + askT("as_c_legacy_h", "📝 الاختبارات السريعة") + '</h3><div class="muted">' + askT("as_c_legacy_sub", "تدريب سريع بالنظام السابق (أدوات، معاني، جمع، استماع...).") + '</div><div class="row-flex"><button class="btn btn-ghost sm" data-as="oldquiz">فتح الاختبارات السريعة ↓</button></div></div>';
    h += '</div>';
    root.innerHTML = h;
    wireDashBtns(root);
    try { if (typeof DMTestCenter !== "undefined" && DMTestCenter && DMTestCenter.wire) DMTestCenter.wire(root); } catch (e2) {}
  }
  function statCard(ico, label, val, sub) {
    return '<div class="asd-stat"><div class="asd-ico">' + ico + '</div><b>' + esc(val) + '</b><span class="muted">' + esc(label) + '</span><small class="muted">' + esc(sub || "") + '</small></div>';
  }
  /* ---------------- button delegation ---------------- */
  function startById(id) {
    var Sp = DMAssess.specs;
    if (id === "placement") return A.startFlow(Sp.placementSpec());
    if (id === "exam-a1") return A.startFlow(Sp.a1ExamSpec());
    if (id === "exam-a2") return A.startFlow(Sp.levelExamSpec("A2"));
    if (id === "exam-b1") return A.startFlow(Sp.levelExamSpec("B1"));
    if (id === "exam-b2") return A.startFlow(Sp.levelExamSpec("B2"));
    var m = id.match(/^mixed-(\d+)$/);
    if (m) { var n = parseInt(m[1], 10); return A.startFlow(Sp.mixedSpec(n), { limit: n + 6 }); }
    var k = id.match(/^kap-(.+)$/);
    if (k) return A.startFlow(Sp.kapitelSpec(k[1]));
    var s = id.match(/^skill-(.+)$/);
    if (s) return A.startFlow(Sp.skillSpec(s[1]));
    return false;
  }
  function openHistory(id) {
    var H = hist();
    for (var i = 0; i < H.length; i++) if (H[i].id === id) { renderResult(H[i]); return; }
    toast(askT("as_r_open_fail", "تعذر فتح النتيجة"), "err");
  }
  function wireDashBtns(root) {
    if (!root) return;
    root.querySelectorAll('[data-as]').forEach(function (b) {
      if (b._asw) return; b._asw = true;
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-as");
        if (k === "dash" || k === "center") renderCenter();
        else if (k === "resume") { if (!A.resumeFlow()) { toast(askT("as_r_resume_fail", "تعذر الاستكمال — بدء جديد أفضل"), "err"); renderCenter(); } }
        else if (k === "discard") { A.discardFlow(); toast(askT("as_r_discarded", "تم تجاهل الاختبار غير المكتمل 🗑️")); }
        else if (k === "quit") { A.persistInProgress(); toast(askT("as_r_quit_saved", "💾 تم حفظ تقدمك")); renderCenter(); }
        else if (k === "retry") {
          var s = A.getSess(), id = null;
          try { var H = hist(); id = H[0] ? H[0].specId : null; } catch (e) {}
          if (id) startById(id); else renderCenter();
        }
        else if (k === "oldquiz") {
          try {
            var q = $("quizSetup");
            if (q) { A.focusBelowHeader(q); try { if (FN("renderQuizHistory")) FN("renderQuizHistory")(); } catch (e) {} }
          } catch (e) {}
        }
        else if (k.indexOf("hist:") === 0) openHistory(k.slice(5));
        else if (k.indexOf("start:") === 0) {
          if (!A.getSess() && inProgressValid()) {
            var okNew = false;
            try { okNew = window.confirm(askT("as_r_confirm_new", "لديك اختبار غير مكتمل محفوظ. بدء اختبار جديد سيستبدله. متابعة؟")); } catch (e) { okNew = true; }
            if (!okNew) return;
            try { var st0 = A.ensureStore(); if (st0) { st0.inProgress = null; } } catch (e2) {}
          }
          startById(k.slice(6));
        }
        else if (k.indexOf("load:") === 0) {
          var lv = k.slice(5);
          try {
            if (typeof Curriculum !== "undefined" && Curriculum.ensure) {
              toast(askT("as_r_loading", "⏳ جاري تحميل محتوى ") + lv + " ...");
              Curriculum.ensure(lv, function () { try { if (!document.querySelector("#page-quiz.active")) return; } catch (e) {} renderCenter(); });
            }
          } catch (e) {}
        }
      });
    });
  }

  return { finish: finish, renderResult: renderResult, renderCenter: renderCenter, wireDashBtns: wireDashBtns, aggregateEvidence: aggregateEvidence, kapitelReadinessMap: kapitelReadinessMap, progressByKap: progressByKap };
})();
/* ============ CSS + PAGE WIRING (additive, idempotent) ============ */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var CSS = ".asr-wrap,.asd-hero{max-width:100%}"
    + ".asr-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}"
    + ".asr-timer{font-weight:800;background:rgba(255,255,255,.06);border:1px solid var(--border,#333);border-radius:10px;padding:4px 10px}"
    + ".asr-timer.asr-danger{color:#ff6b6b;border-color:#ff6b6b;animation:asrblink 1s infinite}"
    + "@keyframes asrblink{50%{opacity:.55}}"
    + ".asr-prompt{margin:10px 0;line-height:1.9}"
    + ".asr-passage{background:rgba(255,255,255,.04);border:1px solid var(--border,#333);border-radius:12px;padding:10px;margin:8px 0}"
    + ".asr-de{font-weight:700;line-height:2}"
    + ".asr-ans{min-height:52px;border:1px dashed var(--border,#555);border-radius:12px;padding:8px;margin:8px 0;display:flex;gap:6px;flex-wrap:wrap}"
    + ".order-chip{padding:8px 12px;border-radius:10px;border:1px solid var(--border,#444);background:rgba(255,255,255,.05);cursor:pointer;font-size:15px}"
    + ".order-chip.used{opacity:.35}"
    + ".quiz-opt.sel{outline:2px solid var(--gold,#f5b301);outline-offset:1px}"
    + ".asr-match{display:grid;grid-template-columns:1fr 1fr;gap:8px}"
    + ".asr-mcol{display:flex;flex-direction:column;gap:8px}"
    + ".asr-mbtn.sel{outline:2px solid var(--gold,#f5b301)}"
    + ".asr-rev{border-top:1px solid var(--border,#333);padding:10px 0}"
    + ".asr-big{font-size:52px;font-weight:900;line-height:1.2}"
    + ".asd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}"
    + "@media(max-width:640px){.asd-grid{grid-template-columns:repeat(2,1fr)}}"
    + ".asd-stat{background:rgba(255,255,255,.04);border:1px solid var(--border,#333);border-radius:12px;padding:10px;text-align:center;display:flex;flex-direction:column;gap:2px;min-width:0}"
    + ".asd-stat b{font-size:19px}.asd-ico{font-size:20px}"
    + ".asd-stat small{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".asd-lvlrow{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}"
    + ".asd-lvl{background:rgba(255,255,255,.05);border:1px solid var(--border,#333);border-radius:12px;padding:8px 14px;display:flex;flex-direction:column;min-width:110px}"
    + ".asd-lvl b{font-size:20px}"
    + ".asd-skills{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}"
    + "@media(max-width:560px){.asd-skills{grid-template-columns:1fr}}"
    + ".asd-kaps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}"
    + "@media(max-width:560px){.asd-kaps{grid-template-columns:repeat(2,1fr)}}"
    + ".quick-btn small{font-size:11px;opacity:.75}"
    + ".as-hero{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}"
    + ".asd-exam{background:rgba(255,255,255,.04);border:1px solid var(--border,#333);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px}"
    + ".asd-exam.locked{opacity:.75}"
    + ".asd-map{display:flex;flex-direction:column;gap:2px}"
    + ".asd-maprow{display:flex;align-items:center;gap:10px;text-align:start;background:rgba(255,255,255,.04);border:1px solid var(--border,#333);border-radius:12px;padding:8px 10px;cursor:pointer;color:inherit;width:100%}"
    + ".asd-mapico{font-size:20px;min-width:28px;text-align:center}"
    + ".asd-mapdown{text-align:center;opacity:.6;line-height:1}"
    + ".as-ok{color:var(--green,#30a46c);font-weight:700}.as-warn{color:var(--gold,#f5b301);font-weight:700}"
    + ".asd-bars{display:flex;gap:10px;align-items:flex-end;min-height:120px;padding-top:8px}"
    + ".asd-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}"
    + ".asd-barfill{width:100%;max-width:56px;background:linear-gradient(180deg,var(--gold,#f5b301),#b97e00);border-radius:8px 8px 0 0;min-height:4px}"
    + ".as-resume{border-color:var(--gold,#f5b301)}" + ".asr-combo{font-weight:800;color:#ff8c42;background:rgba(255,140,66,.12);border:1px solid rgba(255,140,66,.4);border-radius:10px;padding:2px 8px}" + ".asr-mode{font-weight:700;background:rgba(255,255,255,.06);border:1px solid var(--border,#333);border-radius:10px;padding:2px 8px;font-size:12px}" + ".asr-conj{display:flex;flex-direction:column;gap:10px}" + ".asr-conjrow{background:rgba(255,255,255,.03);border:1px solid var(--border,#333);border-radius:12px;padding:8px}"
    + ".tag{background:rgba(255,255,255,.07);border:1px solid var(--border,#333);border-radius:20px;padding:2px 10px;font-size:12px}"
    /* scroll anchors: keep focused workspace visible below the fixed header
       and above the mobile bottom nav; no absolute/fake-spacing hacks */
    + "html{scroll-padding-top:calc(var(--dm-header-h,68px) + 14px + env(safe-area-inset-top,0px))}"
    + "#assessRoot,#assessRunner,#assessResult,#assessDash{scroll-margin-top:calc(var(--dm-header-h,68px) + 14px + env(safe-area-inset-top,0px))}"
    + "#assessRunner{padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))}"
    + ".asr-nav{position:sticky;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:5;background:inherit;padding:6px 0}";
  function injectCss() {
    try { if (document.getElementById("assessCss")) return; var st = document.createElement("style"); st.id = "assessCss"; st.textContent = CSS; document.head.appendChild(st); } catch (e) {}
  }
  function ensureRoot() {
    try {
      var page = document.getElementById("page-quiz");
      if (!page) return null;
      var root = document.getElementById("assessRoot");
      if (!root) {
        root = document.createElement("div");
        root.id = "assessRoot";
        page.insertBefore(root, page.firstChild.nextSibling);
      }
      return root;
    } catch (e) { return null; }
  }
  function renderQuizPage() {
    try {
      if (!ensureRoot()) return;
      var s = DMAssess.app.getSess();
      if (s && s.qs && s.qs.length) DMAssess.app.renderRunner();
      else DMAssess.center.renderCenter();
    } catch (e) { if (window.console) console.error("assess render", e); }
  }
  function skipRender() {
    try { if (window.DMPageState && DMPageState.skipRender && DMPageState.skipRender("quiz")) return true; } catch (e) {}
    return false;
  }
  function wrap() {
    try {
      if (typeof showPage !== "function") return false;
      if (showPage._asWrapped) return true;
      var prev = showPage;
      var next = function (n) {
        var r = prev(n);
        try { if (n === "quiz" && !skipRender()) renderQuizPage(); } catch (e) { if (window.console) console.error(e); }
        return r;
      };
      next._asWrapped = true;
      showPage = next;
      try { window.showPage = next; } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  injectCss();
  if (!wrap()) {
    try {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { injectCss(); wrap(); ensureRoot(); });
      else setTimeout(function () { wrap(); }, 300);
    } catch (e) {}
  }
})();





try { if (typeof module !== "undefined" && module.exports) module.exports = DMAssess; } catch (e) {}
