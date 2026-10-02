/* Deutsch Master - Study Methodology Guide (ADDITIVE ONLY).
   Page: "طريقة مذاكرة الألماني" (data-page="howto").
   A learning-methodology layer ON TOP of existing features: it teaches HOW to
   study and links to existing sections via showPage(). No duplicate features.
   Storage: S.howto namespace only {read:{}}. Reuses: showPage, t/applyLang,
   escapeHtml, $, toast, save. All cross-calls are typeof-guarded. */
"use strict";

/* ---------- i18n (merged additively; page key matches data-page name) ---------- */
try {
  Object.assign(I18N.ar, {
    howto: "طريقة مذاكرة الألماني",
    title_howto: "🧭 طريقة مذاكرة الألماني",
    hw_search_ph: "ابحث: der / Akkusativ / جمع / نطق / مراجعة...",
    hw_all: "الكل",
    hw_cat_start: "🚀 ابدأ صح",
    hw_cat_words: "📚 الكلمات والحفظ",
    hw_cat_sent: "🧩 الجمل والقواعد",
    hw_cat_skills: "🎧 المهارات",
    hw_cat_review: "🧠 المراجعة والإتقان",
    hw_intro: "دليلك الكامل للمذاكرة داخل التطبيق: ماذا تذاكر، وبأي ترتيب، وكيف تحفظ، وكيف تراجع دون نسيان.",
    hw_read: "تمت القراءة ✓",
    hw_mark: "علّم كمقروء ✓",
    hw_open: "افتح ←",
    hw_no_results: "لا توجد نتائج مطابقة — جرّب كلمة أخرى.",
    hw_fixnow: "🆘 ماذا أفعل الآن؟ اختر وضعك",
    hw_next: "➡️ خطوتك التالية المقترحة",
    hw_back: "← الرجوع إلى طريقة مذاكرة الألماني",
    hw_related: "📚 مواضيع مرتبطة",
    hw_features: "🛠️ تدرب في التطبيق"
  });
  Object.assign(I18N.en, {
    howto: "How to Study German",
    title_howto: "🧭 How to Study German",
    hw_search_ph: "Search: der / Akkusativ / plural / pronunciation / review...",
    hw_all: "All",
    hw_cat_start: "🚀 Start right",
    hw_cat_words: "📚 Words & memory",
    hw_cat_sent: "🧩 Sentences & grammar",
    hw_cat_skills: "🎧 Skills",
    hw_cat_review: "🧠 Review & mastery",
    hw_intro: "Your complete in-app study guide: what to study, in which order, how to memorize, and how to review without forgetting.",
    hw_read: "Read ✓",
    hw_mark: "Mark as read ✓",
    hw_open: "Open ←",
    hw_no_results: "No matches — try another word.",
    hw_fixnow: "🆘 What should I do now? Pick your situation",
    hw_next: "➡️ Your suggested next step",
    hw_back: "← Back to How to Study German",
    hw_related: "📚 Related topics",
    hw_features: "🛠️ Practice in the app"
  });
  Object.assign(I18N.de, {
    howto: "Deutsch lernen lernen",
    title_howto: "🧭 Deutsch lernen lernen",
    hw_search_ph: "Suchen: der / Akkusativ / Plural / Aussprache / Wiederholung...",
    hw_all: "Alle",
    hw_cat_start: "🚀 Richtig starten",
    hw_cat_words: "📚 Wörter & Gedächtnis",
    hw_cat_sent: "🧩 Sätze & Grammatik",
    hw_cat_skills: "🎧 Fertigkeiten",
    hw_cat_review: "🧠 Wiederholung & Beherrschung",
    hw_intro: "Deine komplette Lernanleitung in der App: was, in welcher Reihenfolge, wie merken, wie wiederholen.",
    hw_read: "Gelesen ✓",
    hw_mark: "Als gelesen markieren ✓",
    hw_open: "Öffnen ←",
    hw_no_results: "Keine Treffer — versuch ein anderes Wort.",
    hw_fixnow: "🆘 Was soll ich jetzt tun? Wähle deine Situation",
    hw_next: "➡️ Dein vorgeschlagener nächster Schritt",
    hw_back: "← Zurück zu Deutsch lernen lernen",
    hw_related: "📚 Verwandte Themen",
    hw_features: "🛠️ In der App üben"
  });
} catch (e) {}

/* ---------- storage (own namespace, never wipes other data) ---------- */
function ensureHowto() {
  try {
    if (typeof S === "undefined") return { read: {} };
    if (!S.howto) S.howto = {};
    if (!S.howto.read) S.howto.read = {};
    return S.howto;
  } catch (e) { return { read: {} }; }
}
function hwSave() { try { if (typeof save === "function") save(); } catch (e) {} }
function hwT(k) { try { if (typeof t === "function") return t(k); } catch (e) {} return k; }
function hwGo(page) { try { if (typeof showPage === "function") showPage(page); } catch (e) {} }

/* ---------- categories ---------- */
var DM_HOWTO_CATS = [
  { id: "start", icon: "🚀" },
  { id: "words", icon: "📚" },
  { id: "sent", icon: "🧩" },
  { id: "skills", icon: "🎧" },
  { id: "review", icon: "🧠" }
];
function hwCatName(id) {
  try {
    var L = (typeof S !== "undefined" && S.uiLang) || "ar";
    var m = { start: { ar: "🚀 ابدأ صح", en: "🚀 Start right", de: "🚀 Richtig starten" },
      words: { ar: "📚 الكلمات والحفظ", en: "📚 Words & memory", de: "📚 Wörter & Gedächtnis" },
      sent: { ar: "🧩 الجمل والقواعد", en: "🧩 Sentences & grammar", de: "🧩 Sätze & Grammatik" },
      skills: { ar: "🎧 المهارات", en: "🎧 Skills", de: "🎧 Fertigkeiten" },
      review: { ar: "🧠 المراجعة والإتقان", en: "🧠 Review & mastery", de: "🧠 Wiederholung & Beherrschung" } };
    return (m[id] && (m[id][L] || m[id].ar)) || id;
  } catch (e) { return id; }
}

/* ---------- modules: id, icon, cat, kw (search), t {ar,en,de}, body (Arabic + German), go [[label,page]] ---------- */
var DM_HOWTO = [
{
id: "hw-plan", icon: "🗺️", cat: "start", kw: "خطة مذاكرة نظام رحلة كيف أبدأ مقدمة introduction plan system",
t: { ar: "خطة المذاكرة الصحيحة: كيف يعمل التطبيق؟", en: "The right study plan: how the app works", de: "Der richtige Lernplan: wie die App funktioniert" },
body: '<h4>🎯 ما هو؟</h4><p>التطبيق دائرة متكاملة: <b>كلمات ← جمل ← قواعد ← مهارات (استماع/تحدث/كتابة) ← مراجعة ← أخطاء</b>. كل جزء يغذّي الآخر، فالكلمة التي تحفظها تظهر في الجمل، والخطأ الذي ترتكبه يعود إليك في المراجعة.</p>'
+ '<h4>⭐ لماذا يهم؟</h4><p>من يذاكر الكلمات فقط ينسى، ومن يحل اختبارات فقط دون فهم القاعدة يكرر نفس الخطأ. الدائرة الكاملة هي ما يثبّت اللغة.</p>'
+ '<h4>🛠️ كيف تذاكر؟</h4><p>جلسة واحدة صحيحة = <b>كلمات جديدة (قليلة) + جمل + قاعدة واحدة + مراجعة القديم</b>. التفاصيل في وحدة «الخطة اليومية».</p>'
+ '<h4>🚫 لا تحفظ</h4><p>لا تحفظ قوائم كلمات معزولة بدون جمل، ولا تنتقل لدرس جديد قبل مراجعة القديم.</p>'
+ '<h4>✅ علامة الإتقان</h4><p>تستطيع شرح الدائرة لغيرك: أين تحفظ، أين تتدرب، وأين تراجع.</p>',
go: [["🗓️ خطة المذاكرة", "planner"], ["🗺️ الخريطة", "roadmap"], ["🧭 الرحلة", "journey"]]
},
{
id: "hw-order", icon: "🪜", cat: "start", kw: "ترتيب تعلم الألماني من أين أبدأ تسلسل order sequence ladder",
t: { ar: "ترتيب تعلم الألماني: من أين تبدأ؟", en: "German learning order: where to start", de: "Lernreihenfolge: wo anfangen" },
body: '<h4>🪜 السلم الصحيح</h4><p>1) الأصوات والنطق الأساسي ← 2) كلمات + أدواتها ← 3) الجمع ← 4) الأفعال وتصريفها ← 5) جمل بسيطة ← 6) ترتيب الكلمات ← 7) النفي والأسئلة ← 8) Akkusativ ← 9) Dativ وحروف الجر ← 10) الماضي (Perfekt) ← 11) المهارات يوميًا.</p>'
+ '<h4>⭐ لماذا؟</h4><p>كل درجة تعتمد على السابقة: لا تستطيع بناء جملة دون فعل مصرف، ولا تفهم Akkusativ دون معرفة الأدوات.</p>'
+ '<h4>🚫 لا تفعل</h4><p>لا تقفز لـ Dativ وأنت تخطئ في der/die/das، ولا تحفظ الماضي قبل إتقان الحاضر.</p>'
+ '<h4>✅ علامة الإتقان</h4><p>تعرف بالضبط في أي درجة أنت وما الدرجة التالية.</p>',
go: [["📚 الكلمات", "vocab"], ["💬 الجمل", "sentences"], ["📐 القواعد", "grammar"]]
},
{
id: "hw-lesson", icon: "📖", cat: "start", kw: "كيف تذاكر درس واحد طريقة lesson how to study preview recall retest",
t: { ar: "كيف تذاكر درسًا واحدًا من أوله لآخره", en: "How to study one lesson end-to-end", de: "Wie man eine Lektion lernt" },
body: '<h4>🔁 الدورة الكاملة (طبقها على كل درس)</h4><p><b>1) نظرة سريعة:</b> اقرأ عنوان الدرس وأمثلته دون حفظ.<br><b>2) تعلّم:</b> افهم الفكرة من «الشرح» — ما القاعدة بكلمة واحدة؟<br><b>3) لاحظ النمط:</b> قارن 3 أمثلة واستخرج القاعدة بنفسك.<br><b>4) تدرب سهل:</b> حل أسئلة الاختبارات على الدرس.<br><b>5) ابنِ جملتين</b> من عندك بنفس القاعدة.<br><b>6) راجع الأخطاء:</b> افتح سجل الأخطاء وافهم كل خطأ.<br><b>7) أعد الاختبار</b> بعد يومين على الأقل.</p>'
+ '<h4>✅ علامة الإتقان</h4><p>تجيب عن أسئلة الدرس بعد يومين دون مراجعة مسبقة، وتستخدم القاعدة في جملة من تأليفك.</p>',
go: [["📄 الشرح", "explain"], ["📝 الاختبارات", "quiz"], ["❌ أخطائي", "mistakes"]]
},
{
id: "hw-daily", icon: "📅", cat: "start", kw: "خطة يومية روتين 20 30 45 60 دقيقة daily plan routine minutes",
t: { ar: "الخطة اليومية الجاهزة (20 / 30 / 45 / 60 دقيقة)", en: "Ready daily plans (20/30/45/60 min)", de: "Tagespläne (20/30/45/60 Min.)" },
body: '<h4>⏱️ خطة 20 دقيقة (مشغول)</h4><p>7 كلمات جديدة + 5 جمل قراءة بصوت + مراجعة المستحق.</p>'
+ '<h4>⏱️ خطة 30 دقيقة (الأساسية ⭐)</h4><p>10 كلمات + قاعدة واحدة + 5 جمل + مراجعة المستحق والأخطاء.</p>'
+ '<h4>⏱️ خطة 45 دقيقة</h4><p>12 كلمة + قاعدة + جمل + استماع واحد + تحدث 5 دقائق + مراجعة.</p>'
+ '<h4>⏱️ خطة 60 دقيقة (الكاملة)</h4><p>15 كلمة + قاعدة + جمل + استماع + تحدث + كتابة 3 جمل + مراجعة أخطاء + مراجعة مستحقة.</p>'
+ '<h4>⚠️ قاعدة ذهبية</h4><p>20 دقيقة كل يوم أفضل من 3 ساعات يومًا واحدًا. الاستمرارية تهزم الكثافة. ثبّت موعدًا يوميًا وفعّل التذكير من الإعدادات.</p>',
go: [["🗓️ خطة المذاكرة", "planner"], ["🧠 المراجعة", "review"], ["⚙️ الإعدادات", "settings"]]
},
{
id: "hw-week", icon: "🗓️", cat: "start", kw: "خطة أسبوعية شهرية weekly monthly plan weekend مراجعة شاملة",
t: { ar: "الخطة الأسبوعية والشهرية", en: "Weekly and monthly plans", de: "Wochen- und Monatsplan" },
body: '<h4>🗓️ الأسبوع المثالي</h4><p><b>السبت–الاثنين:</b> كلمات + جمل جديدة.<br><b>الثلاثاء–الأربعاء:</b> قواعد + تدريب ذكي.<br><b>الخميس:</b> استماع + تحدث + كتابة.<br><b>الجمعة:</b> مراجعة شاملة: المستحق + الأخطاء + اختبار شامل.</p>'
+ '<h4>📆 الشهر</h4><p>الأسبوع 1–3: بناء. الأسبوع 4: تثبيت — لا كلمات جديدة كثيرة، بل مراجعة + اختبار تحديد المستوى + التحدي اليومي.</p>'
+ '<h4>🧩 للمشغولين</h4><p>3 أيام فقط؟ اجعلها: (كلمات+جمل) / (قاعدة+تدريب) / (مراجعة شاملة). المهم ألا يمر أسبوع دون مراجعة.</p>',
go: [["🎯 تدريب ذكي", "practice"], ["⚡ التحدي", "challenge"], ["📊 الإحصائيات", "stats"]]
},
{
id: "hw-fixnow", icon: "🆘", cat: "start", kw: "ماذا أفعل الآن مبتدئ ضعيف خائف أنسى تراكم اختبار ماذا أذاكر what now help",
t: { ar: "ماذا أفعل الآن؟ دليل المواقف", en: "What should I do now? Situation guide", de: "Was jetzt? Situations-Guide" },
body: '<h4>🧭 اختر وضعك وابدأ فورًا (التفاصيل في شبكة المواقف أعلى الصفحة)</h4><p><b>مبتدئ تمامًا ←</b> الكلمات (10 كلمات) + وحدة «حفظ الكلمات».<br><b>أنسى بسرعة ←</b> المراجعة اليومية + وحدة «منع النسيان».<br><b>لا أكوّن جملًا ←</b> وحدة «تكوين الجمل» + الجمل.<br><b>ضعيف في القواعد ←</b> الشرح + وحدة «كيف تذاكر القواعد».<br><b>ضعيف في الاستماع ←</b> وحدة «الاستماع» + استماع.<br><b>أخاف من التحدث ←</b> وحدة «التحدث» + تحدث.<br><b>أخطئ في der/die/das ←</b> وحدة «الأدوات» + فلاش كارد.<br><b>أعرف كلمات ولا أستخدمها ←</b> وحدتا «تكوين الجمل» و«التعلم من الجمل».<br><b>توقفت أو تراكم ←</b> خطة 20 دقيقة + المراجعة فقط لمدة 3 أيام.<br><b>تحضير لاختبار ←</b> الأخطاء + مراجعة + اختبار شامل.</p>',
go: [["📚 الكلمات", "vocab"], ["🧠 المراجعة", "review"], ["📝 الاختبارات", "quiz"]]
},
{
id: "hw-words", icon: "📚", cat: "words", kw: "حفظ الكلمات مفردات memorize vocabulary words vergessen vergessen",
t: { ar: "طريقة حفظ الكلمات (الطريقة الكاملة)", en: "How to memorize words (full method)", de: "Wörter merken (komplette Methode)" },
body: '<h4>🎯 القاعدة الذهبية</h4><p>لا تحفظ <b>Tisch = طاولة</b> وحدها. احفظ البطاقة الكاملة:</p><div class="hw-de">der Tisch → die Tische<br>Ich habe einen Tisch.</div><p>طاولة — عندي طاولة. الكلمة + أداتها + جمعها + جملة = 4 روابط في الذاكرة بدل رابط واحد.</p>'
+ '<h4>🛠️ التقنيات</h4><p><b>1) السياق:</b> كل كلمة بجملة حقيقية.<br><b>2) التصنيف:</b> احفظ بالعائلات (البيت، الطعام، المدرسة).<br><b>3) الاسترجاع:</b> انظر للمعنى وحاول تذكر الألماني قبل قلب البطاقة.<br><b>4) الاستخدام:</b> كوّن جملة من عندك لكل كلمة جديدة.<br><b>5) الخلط:</b> راجع قديمًا مع جديد في كل جلسة.<br><b>6) العدد:</b> 7–15 كلمة جديدة يوميًا كحد أقصى — الزيادة تُنسي.</p>'
+ '<h4>✅ علامة الإتقان</h4><p>تتذكر الكلمة + أداتها + جمعها بعد 3 أيام دون مراجعة، وتستخدمها في جملة.</p>',
go: [["📚 الكلمات", "vocab"], ["🃏 فلاش كارد", "flashcards"], ["🎯 تدريب ذكي", "practice"]]
},
{
id: "hw-art", icon: "🎯", cat: "words", kw: "der die das أدوات articles أداة artikel genus",
t: { ar: "طريقة حفظ الأدوات Der / Die / Das", en: "How to learn der/die/das", de: "Artikel lernen: der/die/das" },
body: '<h4>🎯 ما هي؟</h4><p>كل اسم ألماني له جنس: مذكر <b>der</b>، مؤنث <b>die</b>، محايد <b>das</b>. الأداة جزء من الكلمة — من يحفظ الاسم دون أداته سيخطئ في كل الجمل لاحقًا.</p>'
+ '<h4>📐 ميول مساعدة (ليست قواعد مطلقة!)</h4><p><b>die ←</b> غالبية الكلمات المنتهية بـ -ung, -heit, -keit, -schaft, -ion: <span dir="ltr">die Wohnung, die Freiheit</span>.<br><b>das ←</b> غالبية -chen, -lein (التصغير): <span dir="ltr">das Mädchen, das Brötchen</span>.<br><b>der ←</b> الأيام والشهور والفصول والاتجاهات: <span dir="ltr">der Montag, der Sommer</span>، وكثير من -er: <span dir="ltr">der Lehrer</span>.<br>⚠️ لكل ميل استثناءات — اعتبرها مساعدة تخمين لا قاعدة.</p>'
+ '<h4>🛠️ كيف تحفظ؟</h4><p>لوّن في ذهنك: der أزرق، die وردي، das أخضر (نفس ألوان التطبيق). احفظ بصوت عالٍ «der Tisch» لا «Tisch». اختبر نفسك باختبار الأدوات يوميًا 5 دقائق.</p>'
+ '<h4>❌ خطأ شائع</h4><p>تخمين الأداة من المعنى العربي (الشمس مؤنثة؟ <span dir="ltr">die Sonne</span> نعم، لكن <span dir="ltr">das Mädchen</span> محايد رغم معناه!). الجنس ألماني لا عربي.</p>',
go: [["📚 الكلمات", "vocab"], ["🃏 فلاش كارد", "flashcards"], ["📝 الاختبارات", "quiz"]]
},
{
id: "hw-plural", icon: "👥", cat: "words", kw: "الجمع plurals plural die tische",
t: { ar: "طريقة حفظ الجمع", en: "How to learn plurals", de: "Plural lernen" },
body: '<h4>⭐ لماذا مع الاسم دائمًا؟</h4><p>لا توجد قاعدة واحدة للجمع في الألمانية — لذلك الجمع يُحفظ ولا يُستنتج. السلسلة الكاملة دائمًا:</p><div class="hw-de">der Tisch → die Tische → Die Tische sind groß.</div>'
+ '<h4>📐 أشهر الأنماط (للتعرّف لا للحفظ كقواعد)</h4><p><b>-e:</b> <span dir="ltr">der Tisch → die Tische</span>.<br><b>-er + Umlaut:</b> <span dir="ltr">das Kind → die Kinder</span>, <span dir="ltr">der Mann → die Männer</span>.<br><b>-en/-n:</b> معظم المؤنث: <span dir="ltr">die Frau → die Frauen</span>.<br><b>-s:</b> كلمات أجنبية: <span dir="ltr">das Auto → die Autos</span>.<br><b>Umlaut فقط:</b> <span dir="ltr">der Apfel → die Äpfel</span>.<br><b>بدون تغيير:</b> <span dir="ltr">der Lehrer → die Lehrer</span>.</p>'
+ '<h4>🛠️ كيف تتدرب؟</h4><p>اختبار «الجمع» في الاختبارات + بطاقات الفلاش (الجمع مكتوب تحت الكلمة). أي خطأ في الجمع = يُسجل ويُراجع.</p>',
go: [["📚 الكلمات", "vocab"], ["📝 الاختبارات", "quiz"], ["🃏 فلاش كارد", "flashcards"]]
},
{
id: "hw-verbs", icon: "⚡", cat: "words", kw: "الأفعال تصريف verbs konjugation conjugation separable trennbar",
t: { ar: "طريقة حفظ الأفعال", en: "How to learn verbs", de: "Verben lernen" },
body: '<h4>🎯 بطاقة الفعل الكاملة</h4><p>احفظ: المصدر + المعنى + ich/du/er + جملة:</p><div class="hw-de">lernen → ich lerne, du lernst, er lernt<br>Ich lerne Deutsch.</div>'
+ '<h4>⚠️ نقاط خاصة</h4><p><b>الأفعال المنفصلة:</b> المقطع يذهب لآخر الجملة: <span dir="ltr">Ich stehe um 7 Uhr <b>auf</b>.</span> (aufstehen).<br><b>الأفعال الشاذة:</b> تتغير في du/er: <span dir="ltr">sprechen → du sprichst</span>, <span dir="ltr">lesen → du liest</span> — تُحفظ كما هي.<br><b>الأفعال الناقصة:</b> الثاني في النهاية مصدرًا: <span dir="ltr">Ich muss Deutsch <b>lernen</b>.</span><br><b>الماضي (لاحقًا):</b> <span dir="ltr">gelernt, gesprochen</span> — لا تشغل نفسك به قبل إتقان الحاضر.</p>'
+ '<h4>🛠️ كيف تتدرب؟</h4><p>قسم الأفعال للتصريف، والجمل لرؤية الفعل حيًا، والتدريب الذكي للاختبار.</p>',
go: [["⚡ الأفعال", "verbs"], ["💬 الجمل", "sentences"], ["🎯 تدريب ذكي", "practice"]]
},
{
id: "hw-forget", icon: "🧠", cat: "words", kw: "النسيان أنسى بسرعة vergessen forgetting تذكر recall",
t: { ar: "كيف تمنع النسيان", en: "How to stop forgetting", de: "Vergessen verhindern" },
body: '<h4>💡 الحقيقة</h4><p>النسيان طبيعي وليس فشلًا منك. الذاكرة تحتفظ بما <b>تسترجعه بنشاط</b> لا بما تقرؤه بسلبية. قراءة الكلمة 10 مرات أضعف من محاولة تذكرها مرة واحدة.</p>'
+ '<h4>🛡️ الأسلحة الخمسة</h4><p><b>1) الاسترجاع النشط:</b> غطِّ الإجابة وحاول قبل أن تنظر.<br><b>2) التباعد:</b> راجع بعد يوم ثم 3 أيام ثم أسبوع (النظام يفعلها تلقائيًا).<br><b>3) الاستخدام:</b> كلمة استخدمتَها في جملة بصوتك لا تُنسى بسهولة.<br><b>4) الخلط:</b> لا تراجع درسًا واحدًا وحده — اخلط القديم بالجديد.<br><b>5) النوم والاستمرارية:</b> مذاكرة يومية قصيرة تثبّت أكثر من سهرة واحدة.</p>',
go: [["🧠 المراجعة", "review"], ["🃏 فلاش كارد", "flashcards"], ["❌ أخطائي", "mistakes"]]
},
{
id: "hw-srs", icon: "🔁", cat: "words", kw: "spaced repetition srs تكرار متباعد مراجعة ذكية intervals",
t: { ar: "التكرار المتباعد SRS: كيف يعمل هنا؟", en: "Spaced repetition / SRS: how it works here", de: "Spaced Repetition / SRS: wie es hier funktioniert" },
body: '<h4>🔁 الفكرة</h4><p>تُراجع الكلمة قبل أن تنساها بقليل. إجابة صحيحة = الفاصل يكبر (يوم ← 3 أيام ← أسبوع). إجابة خاطئة = تعود للمراجعة اليوم.</p>'
+ '<h4>📱 نظام التطبيق الفعلي</h4><p>كل كلمة لها حالة: 🆕 جديدة ← 🔁 مراجعة ← 🔴 صعبة / ✅ محفوظة. عند التقييم في الفلاش كارد أو المراجعة، يحسب النظام موعد المراجعة التالي تلقائيًا. افتح صفحة «المراجعة» يوميًا وصفِّ الرقم إلى صفر — هذا أهم عادة في التطبيق كله.</p>'
+ '<h4>⚠️ تحذير</h4><p>تخطّي المراجعة 3 أيام يكوّم عليك عشرات الكلمات. القاعدة: لا كلمات جديدة قبل تصفية المستحق.</p>',
go: [["🧠 المراجعة", "review"], ["🃏 فلاش كارد", "flashcards"], ["📊 الإحصائيات", "stats"]]
},
{
id: "hw-sent", icon: "🧩", cat: "sent", kw: "تكوين الجمل بناء جملة sentences build satzbau",
t: { ar: "طريقة تكوين الجمل خطوة بخطوة", en: "How to build sentences step by step", de: "Sätze Schritt für Schritt bauen" },
body: '<h4>🪜 السلم (لا تقفز درجة)</h4><div class="hw-de">1) Ich lerne Deutsch.<br>2) Ich lerne jeden Tag Deutsch.<br>3) Ich lerne jeden Tag Deutsch zu Hause.<br>4) Lernst du jeden Tag Deutsch?<br>5) Ich lerne nicht jeden Tag Deutsch.<br>6) Ich lerne Deutsch, weil ich in Berlin arbeite.</div>'
+ '<h4>🧱 مكوّنات الجملة</h4><p><b>فاعل</b> (ich/du/er...) + <b>فعل مصرف في المرتبة الثانية</b> + <b>مفعول/تكملة</b> + <b>وقت + مكان</b>. الفعل في المرتبة الثانية هو أهم قاعدة في الألمانية كلها.</p>'
+ '<h4>🛠️ التدريب</h4><p>خذ جملة تعرفها ووسّعها بكلمة كل يوم. ثم حوّلها لسؤال ثم لنفي. قسم «تدريبات الجمل» و«صحح الجملة» و«اكتشف الخطأ» صُنعت لهذا.</p>',
go: [["💬 الجمل", "sentences"], ["✏️ تدريبات الجمل", "sentex"], ["🩺 صحح الجملة", "fixsent"]]
},
{
id: "hw-wordorder", icon: "🔀", cat: "sent", kw: "ترتيب الكلمات word order verb position zweite verbstellung tekamolo",
t: { ar: "ترتيب الكلمات في الجملة", en: "Word order", de: "Wortstellung" },
body: '<h4>🥇 القاعدة الأم: الفعل الثاني</h4><div class="hw-de">Ich <b>lerne</b> Deutsch. / Heute <b>lerne</b> ich Deutsch.</div><p>مهما بدأت به الجملة، الفعل المصرف يبقى في المرتبة الثانية.</p>'
+ '<h4>⏰ الترتيب الداخلي: الزمان قبل المكان</h4><div class="hw-de">Ich lerne <b>jeden Tag</b> (متى) <b>zu Hause</b> (أين) Deutsch.</div>'
+ '<h4>🔚 الفعل في النهاية</h4><p>مع فعل ناقص أو في الجملة الجانبية بـ weil/dass يذهب الفعل لآخر الجملة: <span dir="ltr">Ich muss Deutsch <b>lernen</b>.</span> / <span dir="ltr">..., weil ich Deutsch <b>lerne</b>.</span></p>'
+ '<h4>❌ خطأ شائع</h4><p><span dir="ltr">Heute ich lerne Deutsch ✗</span> ← الصحيح <span dir="ltr">Heute lerne ich Deutsch ✓</span> (الفعل ثانيًا دائمًا).</p>',
go: [["💬 الجمل", "sentences"], ["✏️ تدريبات الجمل", "sentex"], ["🔍 اكتشف الخطأ", "finderr"]]
},
{
id: "hw-neg", icon: "🚫", cat: "sent", kw: "النفي nicht kein negation verneinung",
t: { ar: "النفي: nicht و kein", en: "Negation: nicht vs kein", de: "Verneinung: nicht und kein" },
body: '<h4>🎯 الفرق بكلمة واحدة</h4><p><b>kein</b> = نفي اسم نكرة (لا ...). <b>nicht</b> = نفي كل شيء آخر.</p><div class="hw-de">Ich habe <b>kein</b> Auto. (لا أملك سيارة)<br>Ich lerne <b>nicht</b>. / Das Auto ist <b>nicht</b> groß.</div>'
+ '<h4>📍 مكان nicht</h4><p>غالبًا في آخر الجملة أو قبل الصفة/المكان المُراد نفيه: <span dir="ltr">Ich lerne heute <b>nicht</b>.</span></p>'
+ '<h4>❌ خطأ شائع</h4><p><span dir="ltr">Ich habe nicht Auto ✗</span> ← <span dir="ltr">Ich habe kein Auto ✓</span>. و <span dir="ltr">Ich kein lerne ✗</span> ← <span dir="ltr">Ich lerne nicht ✓</span>.</p>',
go: [["📄 الشرح", "explain"], ["🏛️ المرجع الشامل", "reference"], ["✏️ تدريبات الجمل", "sentex"]]
},
{
id: "hw-questions", icon: "❓", cat: "sent", kw: "الأسئلة سؤال fragen w-fragen questions question",
t: { ar: "الأسئلة", en: "Questions", de: "Fragen" },
body: '<h4>❓ النوعان</h4><p><b>1) سؤال نعم/لا:</b> الفعل أولًا: <span dir="ltr"><b>Lernst</b> du Deutsch?</span><br><b>2) سؤال بأداة استفهام:</b> الأداة + الفعل ثانيًا: <span dir="ltr"><b>Was</b> lernst du? <b>Wo</b> wohnst du? <b>Wann</b> lernst du?</span></p>'
+ '<h4>🛠️ كيف تتدرب؟</h4><p>حوّل كل جملة تتعلمها إلى سؤالين: واحد بـ Was/Wo/Wann وواحد نعم/لا. أجب عنهما بصوت عالٍ. أسئلة A1 الشائعة عن نفسك (الاسم، السكن، العمل، الهوايات) احفظها كقوالب جاهزة في «المحادثة».</p>',
go: [["💬 محادثة", "talk"], ["💬 الجمل", "sentences"], ["🎤 تحدث", "speak"]]
},
{
id: "hw-akk", icon: "🎯", cat: "sent", kw: "akkusativ accusative المنصوب wen was den einen",
t: { ar: "Akkusativ: الطريقة العملية", en: "Akkusativ: the practical way", de: "Akkusativ: der praktische Weg" },
body: '<h4>🎯 ما هو؟</h4><p>حالة المفعول المباشر — إجابة سؤال <b>wen؟ / was؟</b> (مَن؟ / ماذا؟). يتغير فيها <b>der فقط → den</b>:</p><div class="hw-de">Ich sehe <b>den</b> Mann. / Ich habe <b>einen</b> Hund.<br>die / das / die(جمع) لا تتغير.</div>'
+ '<h4>🧲 احفظ الأفعال مع حالتها</h4><p>بعض الأفعال تطلب Akkusativ دائمًا: <span dir="ltr">sehen, haben, brauchen, kaufen, besuchen</span>. واحفظ حروف الجر: <span dir="ltr">für, durch, gegen, ohne, um</span> + Akkusativ: <span dir="ltr">für <b>dich</b></span>.</p>'
+ '<h4>❌ خطأ شائع</h4><p><span dir="ltr">Ich sehe der Mann ✗</span> ← <span dir="ltr">Ich sehe den Mann ✓</span>. اسأل نفسك دائمًا: ماذا أرى؟ = المفعول = Akkusativ.</p>',
go: [["📄 الشرح", "explain"], ["🏛️ المرجع الشامل", "reference"], ["📐 القواعد", "grammar"]]
},
{
id: "hw-dat", icon: "🎁", cat: "sent", kw: "dativ dative wem dem einem mit nach",
t: { ar: "Dativ: الطريقة العملية", en: "Dativ: the practical way", de: "Dativ: der praktische Weg" },
body: '<h4>🎁 ما هو؟</h4><p>حالة المفعول غير المباشر — إجابة <b>wem؟</b> (لمن؟). التغييرات: <b>der → dem، das → dem، die → der، الجمع → den + n</b>:</p><div class="hw-de">Ich helfe <b>dem</b> Kind. / Ich danke <b>der</b> Frau.<br>Ich fahre mit <b>dem</b> Bus.</div>'
+ '<h4>🧲 احفظ بالأزواج</h4><p>أفعال Dativ الشهيرة: <span dir="ltr">helfen, danken, gehören, gefallen</span>. حروف Dativ: <span dir="ltr">mit, nach, aus, zu, von, bei, seit</span>. لا تحفظ الحرف وحده — احفظ مثالًا: <span dir="ltr">mit dem Bus, nach Hause, bei mir</span>.</p>'
+ '<h4>⚠️ للمبتدئ</h4><p>أتقن Akkusativ أولًا، ثم ادخل Dativ. الخلط بينهما طبيعي في البداية ويُحل بالجمل لا بالحفظ.</p>',
go: [["📄 الشرح", "explain"], ["🏛️ المرجع الشامل", "reference"], ["🎯 تدريب ذكي", "practice"]]
},
{
id: "hw-prep", icon: "🔗", cat: "sent", kw: "حروف الجر prepositions präpositionen wechsel an auf in",
t: { ar: "حروف الجر", en: "Prepositions", de: "Präpositionen" },
body: '<h4>🗺️ الخريطة الذهنية</h4><p><b>Akkusativ:</b> <span dir="ltr">für, durch, gegen, ohne, um</span>.<br><b>Dativ:</b> <span dir="ltr">mit, nach, aus, zu, von, bei, seit</span>.<br><b>المتبدلة (Wechsel):</b> <span dir="ltr">an, auf, hinter, in, neben, über, unter, vor, zwischen</span> — السؤال يحدد: <b>wohin؟ (إلى أين = حركة) → Akkusativ</b>، <b>wo؟ (أين = ثبات) → Dativ</b>:</p><div class="hw-de">Ich gehe in <b>die</b> Schule. (حركة → Akk)<br>Ich bin in <b>der</b> Schule. (ثبات → Dat)</div>'
+ '<h4>🛠️ الطريقة</h4><p>لا تحفظ جدولًا — احفظ 3 جمل لكل حرف من حياتك: طريقي، بيتي، شغلي. ثم تدرب في «تدريبات الجمل».</p>',
go: [["🏛️ المرجع الشامل", "reference"], ["✏️ تدريبات الجمل", "sentex"], ["💬 الجمل", "sentences"]]
},
{
id: "hw-tense", icon: "⏳", cat: "sent", kw: "الأزمنة ماضي حاضر perfekt präteritum tenses past",
t: { ar: "الأزمنة: ماذا تحتاج في A1؟", en: "Tenses: what A1 needs", de: "Zeiten: was A1 braucht" },
body: '<h4>✅ الحاضر Präsens (الأهم)</h4><p>90% من كلامك في A1 حاضر: <span dir="ltr">Ich lerne, du lernst</span>. أتقنه أولًا.</p>'
+ '<h4>✅ الماضي Perfekt (الثاني)</h4><div class="hw-de">Ich <b>habe</b> Deutsch <b>gelernt</b>. / Ich <b>bin</b> nach Berlin <b>gefahren</b>.</div><p><b>haben</b> لمعظم الأفعال، <b>sein</b> للحركة والتغير. التصريف الثالث (Partizip II) يُحفظ مع الفعل: <span dir="ltr">lernen → gelernt, sprechen → gesprochen, fahren → gefahren</span>.</p>'
+ '<h4>📌 الباقي لاحقًا</h4><p>من Präteritum يكفي <span dir="ltr">war, hatte</span> في A1. المستقبل بـ <span dir="ltr">werden</span> والجمل الجانبية المتقدمة لـ A2/B1 — لا تستعجلها.</p>',
go: [["⚡ الأفعال", "verbs"], ["📄 الشرح", "explain"], ["🏛️ المرجع الشامل", "reference"]]
},
{
id: "hw-gram", icon: "📐", cat: "sent", kw: "كيف تذاكر القواعد grammar study method grammatik",
t: { ar: "كيف تذاكر القواعد (وليس فقط ما هي)", en: "How to study grammar", de: "Wie man Grammatik lernt" },
body: '<h4>🔁 العملية الثابتة لكل قاعدة</h4><p>1) افهم الفكرة بجملة واحدة. 2) اقرأ 3 أمثلة. 3) استخرج النمط بنفسك. 4) حل 5 أسئلة سهلة. 5) ابنِ جملتين من عندك. 6) راجع أخطاءك. 7) أعد الاختبار بعد أيام. 8) استخدم القاعدة تحدثًا وكتابة.</p>'
+ '<h4>⚠️ تحذيران</h4><p>قاعدة دون أمثلة = صفر. وقاعدة دون استخدام في جملة من تأليفك = نسيان خلال أسبوع.</p>'
+ '<h4>🛠️ أين؟</h4><p>«الشرح» للفهم، «المرجع الشامل» للتفصيل، «القواعد» و«مختبر القواعد» للتدريب، «تدريبات الجمل» للاستخدام.</p>',
go: [["📄 الشرح", "explain"], ["🏛️ المرجع الشامل", "reference"], ["📐 القواعد", "grammar"]]
},
{
id: "hw-pron", icon: "🔊", cat: "skills", kw: "النطق أصوات umlaut ä ö ü ß ch sch pronunciation aussprache",
t: { ar: "النطق", en: "Pronunciation", de: "Aussprache" },
body: '<h4>🔊 الأصوات الصعبة على العرب</h4><p><b>ä:</b> بين الفتحة والكسرة <span dir="ltr">Mädchen</span>. <b>ö:</b> ضم الشفاه مع نطق «إي» <span dir="ltr">schön</span>. <b>ü:</b> ضم الشفاه مع «إي» أعمق <span dir="ltr">Tür</span>. <b>ß = ss:</b> <span dir="ltr">Straße</span>. <b>ch:</b> خفيف بعد i/e <span dir="ltr">ich</span>، وخشن بعد a/o/u <span dir="ltr">Buch</span>. <b>sch=ش</b> <span dir="ltr">Schule</span>، <b>sp=شب</b> <span dir="ltr">Sport</span>، <b>st=شت</b> <span dir="ltr">Stadt</span>. <b>w=ڤ</b> <span dir="ltr">Wasser</span>، <b>v=ف</b> <span dir="ltr">Vater</span>. <b>z=تس</b> <span dir="ltr">Zeit</span>.</p>'
+ '<h4>🔁 حلقة التدريب</h4><p><b>استمع ← كرر ← قارن ← كرر ← استخدم في جملة.</b> ابدأ بسرعة 0.5x ثم 1x. قلّد النطق في «تقليد النطق» يوميًا 5 دقائق.</p>'
+ '<h4>📌 النبر</h4><p>النبر غالبًا على المقطع الأول: <span dir="ltr"><b>Deutsch</b>land, <b>Ar</b>beit</span>. استمع أولًا دائمًا قبل أن تنطق كلمة جديدة.</p>',
go: [["🎙️ تقليد النطق", "shadowing"], ["🎧 استماع", "listen"], ["🎤 تحدث", "speak"]]
},
{
id: "hw-listen", icon: "🎧", cat: "skills", kw: "الاستماع listening hören stufen levels",
t: { ar: "الاستماع: الطريقة المتدرجة", en: "Listening: the step method", de: "Hören: die Stufenmethode" },
body: '<h4>🪜 المستويات الستة (لا تقفز)</h4><p><b>1)</b> استمع والتقط كلمات تعرفها فقط.<br><b>2)</b> التقط عبارات كاملة.<br><b>3)</b> استمع مع النص مكتوبًا.<br><b>4)</b> استمع دون نص.<br><b>5)</b> استمع وكرر (ترديد).<br><b>6)</b> استمع وأجب عن سؤال.</p>'
+ '<h4>🛠️ القواعد</h4><p>نفس المقطع 3 مرات أفضل من 3 مقاطع مرة واحدة. ابدأ بالبطيء (0.5x–0.75x). الإملاء السمعي هو أقوى تدريب ربط بين الأذن واليد — استخدمه مرتين أسبوعيًا.</p>'
+ '<h4>✅ علامة التقدم</h4><p>تفهم جملة A1 كاملة من أول استماع دون نص.</p>',
go: [["🎧 استماع", "listen"], ["📻 مختبر الاستماع", "lislab"], ["👂 الإملاء السمعي", "dictation"]]
},
{
id: "hw-speak", icon: "🎤", cat: "skills", kw: "التحدث تحدث speaking sprechen angst خوف",
t: { ar: "التحدث: اكسر حاجز الخوف", en: "Speaking: break the fear", de: "Sprechen: Angst überwinden" },
body: '<h4>💡 الحقيقة المحررة</h4><p>لا تنتظر «حتى تُتقن القواعد» لتتحدث — التحدث هو ما يُتقن القواعد. الأخطاء أثناء الكلام وقود التعلم لا عيب.</p>'
+ '<h4>🛠️ البرنامج اليومي (10 دقائق)</h4><p><b>1)</b> كرر 5 جمل تعرفها بصوت عالٍ.<br><b>2)</b> صِف ما حولك: <span dir="ltr">Das ist ein Tisch. Der Tisch ist groß.</span><br><b>3)</b> أجب عن سؤال شائع: <span dir="ltr">Wo wohnst du? Was machst du?</span><br><b>4)</b> أعد أصعب جملة 5 مرات.<br><b>5)</b> حدّث نفسك دقيقة كاملة (حديث ذاتي).</p>'
+ '<h4>🎤 تمارين A1 الجاهزة</h4><p>قدّم نفسك (الاسم، العمر، السكن، العمل، الهوايات) — احفظها كقالب وكررها حتى تخرج دون تفكير.</p>',
go: [["🎤 تحدث", "speak"], ["💬 محادثة", "talk"], ["🤖 المدرّب", "tutor"]]
},
{
id: "hw-conv", icon: "💬", cat: "skills", kw: "المحادثة حوار conversation dialog مواقف",
t: { ar: "تدريب المحادثة", en: "Conversation training", de: "Gesprächstraining" },
body: '<h4>🧱 ابنِ مخزون العبارات (Chunks)</h4><p>الألمان يتحدثون بقوالب جاهزة — احفظها كاملة لا كلمة كلمة:</p><div class="hw-de">Wie geht es dir? / Ich hätte gern ... / Wie viel kostet das?<br>Können Sie mir helfen? / Bis später!</div>'
+ '<h4>🎬 الطريقة</h4><p>اختر موقفًا واحدًا (مطعم، سوق، محطة) وتدرب عليه 3 أيام: يوم استماع، يوم ترديد، يوم تمثيل الدورين بنفسك. أخطاؤك في المحادثة تُصحح في «المدرّب».</p>'
+ '<h4>✅ علامة التقدم</h4><p>تدير حوار مطعم/سوق كاملًا دون توقف طويل.</p>',
go: [["💬 محادثة", "talk"], ["🌍 مواقف", "real"], ["🎬 مواقف ألمانية", "situations"]]
},
{
id: "hw-write", icon: "✍️", cat: "skills", kw: "الكتابة schreiben writing فقرة",
t: { ar: "الكتابة: من كلمة لفقرة", en: "Writing: from word to paragraph", de: "Schreiben: vom Wort zum Absatz" },
body: '<h4>🪜 السلم</h4><div class="hw-de">Tisch → ein großer Tisch → Der Tisch ist groß.<br>→ Der Tisch ist groß und neu. Er steht im Zimmer.</div><p>كلمة ← عبارة ← جملة ← 3 جمل ← فقرة قصيرة.</p>'
+ '<h4>📝 ماذا تكتب يوميًا؟ (موضوع واحد، 3–5 جمل)</h4><p>عرّف بنفسك • صِف عائلتك • صِف يومك • صِف غرفتك • تحدث عن طعامك • هواياتك • خططك للأسبوع. اكتب في «مختبر الكتابة» وراجع تصحيحه، ثم أعد كتابة النص مصححًا بيدك.</p>'
+ '<h4>⚠️</h4><p>لا تستخدم مترجمًا لكتابة النص كاملًا — اكتب بما تعرف، والخطأ هنا مفيد لأنه يُصحح.</p>',
go: [["✍️ مختبر الكتابة", "writing"], ["📄 الشرح", "explain"], ["🤖 المدرّب", "tutor"]]
},
{
id: "hw-think", icon: "🧠", cat: "skills", kw: "التفكير بالألمانية denken think self-talk حديث ذاتي",
t: { ar: "كيف تبدأ التفكير بالألمانية", en: "How to start thinking in German", de: "Auf Deutsch denken" },
body: '<h4>🎯 المبدأ</h4><p>الترجمة في الرأس (عربي ← ألماني) بطيئة. الهدف: ربط الكلمة بالموقف مباشرة. عندما ترى خبزًا فكّر <span dir="ltr">Brot</span> لا «خبز = Brot».</p>'
+ '<h4>🛠️ تمارين يومية</h4><p><b>1)</b> سمِّ 10 أشياء حولك بالألمانية.<br><b>2)</b> صِف فعلك الحالي: <span dir="ltr">Ich trinke Kaffee. Ich sitze.</span><br><b>3)</b> حديث ذاتي دقيقتين يوميًا.<br><b>4)</b> أعد استخدام 3 قوالب جمل تعرفها في مواقف جديدة.<br><b>5)</b> احفظ عبارات كاملة (chunks) لا كلمات مفردة.</p>',
go: [["🎤 تحدث", "speak"], ["💬 محادثة", "talk"], ["🎬 مواقف ألمانية", "situations"]]
},
{
id: "hw-notrans", icon: "🚫", cat: "skills", kw: "ترجمة حرفية بدون ترجمة literal translation wortwörtlich",
t: { ar: "كيف تتعلم بدون ترجمة حرفية", en: "How to learn without literal translation", de: "Ohne wörtliche Übersetzung lernen" },
body: '<h4>⚠️ المشكلة</h4><p>الترجمة الحرفية تُنتج ألمانيًا مكسورًا: <span dir="ltr">Ich mache Sport ✓</span> لكن <span dir="ltr">Ich tue Hausaufgaben ✗</span> (الصحيح <span dir="ltr">Ich mache Hausaufgaben</span>). كل لغة لها تركيباتها.</p>'
+ '<h4>✅ الحل</h4><p>احفظ <b>الفعل مع مكمله</b> كوحدة: <span dir="ltr">Sport machen, eine Frage stellen, einen Termin haben</span>. وعندما تقابل تعبيرًا غريبًا اسأل: «ماذا يقول الألمان هنا؟» لا «كيف أترجم جملتي؟». المرجع والجمل هما مصدر التركيبات الصحيحة.</p>',
go: [["💬 الجمل", "sentences"], ["🏛️ المرجع الشامل", "reference"], ["🎬 مواقف ألمانية", "situations"]]
},
{
id: "hw-fromsent", icon: "📖", cat: "skills", kw: "التعلم من الجمل المواقف اليومية context sentences situations",
t: { ar: "كيف تتعلم من الجمل والمواقف اليومية", en: "How to learn from sentences & daily situations", de: "Aus Sätzen und Alltag lernen" },
body: '<h4>📖 بروتوكول الجملة الواحدة (5 دقائق)</h4><p>1) اقرأ الجملة واستمع لها. 2) افهم معناها كاملًا. 3) استخرج منها: كلمة جديدة + قاعدة مستخدمة. 4) بدّل كلمة واحدة وكرر: <span dir="ltr">Ich trinke Kaffee → Ich trinke Tee.</span> 5) كوّن جملة جديدة بنفس النمط عن حياتك.</p>'
+ '<h4>🏠 المواقف اليومية مصدر مجاني</h4><p>المطبخ = أفعال الأكل، الشارع = الاتجاهات، السوق = الأرقام والأسعار. كل موقف تمر به اسأل: كيف أقول ما يحدث الآن بالألمانية؟ الجملة الواحدة التي تربطها بحياتك تساوي عشر جمل محفوظة.</p>',
go: [["💬 الجمل", "sentences"], ["🌍 مواقف", "real"], ["🎭 مواقف تدريبية", "dlife"]]
},
{
id: "hw-review", icon: "🔁", cat: "review", kw: "المراجعة review wiederholung مراجعة الدروس",
t: { ar: "المراجعة: النظام الكامل", en: "Review: the full system", de: "Wiederholung: das komplette System" },
body: '<h4>📋 جلسة المراجعة اليومية (10 دقائق)</h4><p>1) افتح «المراجعة» وصفِّ المستحق لصفر. 2) راجع «أخطائي» المفتوحة. 3) اخلط: كل 3 كلمات جديدة مع 7 قديمة. 4) انهِ بسؤال: ما أصعب 3 كلمات اليوم؟ أعدها غدًا أولًا.</p>'
+ '<h4>📏 كم مرة؟</h4><p>الجديد يوميًا، الصعب كل يومين، المتقن أسبوعيًا. من يراجع 10 دقائق يوميًا يتفوق على من يراجع ساعتين أسبوعيًا.</p>'
+ '<h4>📊 تابع أرقامك</h4><p>«تقدمي» و«الإحصائيات» يريانك الحقيقة: المستحق، الدقة، الاستمرارية. الرقم الذي لا يتحرك يخبرك أين المشكلة.</p>',
go: [["🧠 المراجعة", "review"], ["📈 تقدمي", "analytics"], ["🗓️ خطة المذاكرة", "planner"]]
},
{
id: "hw-mistakes", icon: "❌", cat: "review", kw: "الأخطاء أخطائي التعامل مع الخطأ mistakes errors fehler",
t: { ar: "التعامل مع الأخطاء: وقود التعلم", en: "Handling mistakes: learning fuel", de: "Mit Fehlern lernen" },
body: '<h4>🔁 دورة الخطأ الصحيحة</h4><p><b>خطأ ← افهم السبب ← صحح ← كرر الصحيح بصوت ← أعد الاختبار لاحقًا.</b> من يحفظ الإجابة الصحيحة دون فهم السبب سيكرر نفس الخطأ.</p>'
+ '<h4>📱 في التطبيق</h4><p>كل خطأ يُسجل تلقائيًا في «أخطائي» مع سببه. زر «اختبر أخطائي فقط» يحوّل نقاط ضعفك لاختبار مخصص. الخطأ الذي تجيب عنه صحيحًا 3 مرات يُعتبر مُتقنًا.</p>'
+ '<h4>💪 العقلية</h4><p>10 أخطاء مفهومة ومُصححة أفضل من 100 إجابة صحيحة بالحظ. لا تتجنب الأسئلة الصعبة — هي أسرع طريق للتقدم.</p>',
go: [["❌ أخطائي", "mistakes"], ["🧠 أخطائي (إعادة)", "erreplay"], ["🎯 تدريب ذكي", "practice"]]
},
{
id: "hw-weak", icon: "🎯", cat: "review", kw: "نقاط الضعف ضعيف weak schwäche stärken تقوية",
t: { ar: "تقوية نقاط الضعف", en: "Fixing weak areas", de: "Schwächen beheben" },
body: '<h4>🔍 اكتشفها</h4><p>«التدريب الذكي» يكتشف ضعفك تلقائيًا ويبني جلسات عليه. «تقدمي» و«المهارات» يريانك بالأرقام أين تنزف درجات: أدوات؟ جمع؟ استماع؟</p>'
+ '<h4>🛠️ بروتوكول التقوية (أسبوع واحد لكل نقطة)</h4><p>1) حدد نقطة واحدة فقط (الأضعف). 2) ارجع لوحدتها هنا واقرأ طريقتها. 3) 15 دقيقة يوميًا عليها فقط + مراجعتها. 4) اختبر نفسك نهاية الأسبوع. 5) انتقل للنقطة التالية فقط بعد تحسن الرقم.</p>'
+ '<h4>⚠️</h4><p>لا تهاجم 5 نقاط معًا — التشتت يُبقي كل شيء ضعيفًا. نقطة واحدة في الأسبوع.</p>',
go: [["🎯 تدريب ذكي", "practice"], ["📈 تقدمي", "analytics"], ["🤖 المدرّب", "tutor"]]
},
{
id: "hw-mastery", icon: "✅", cat: "review", kw: "إتقان أتقنت الدرس mastery beherrschung علامات",
t: { ar: "كيف تعرف أنك أتقنت الدرس؟", en: "How to know you mastered a topic", de: "Woher weiß ich, dass ich es kann" },
body: '<h4>✅ سلم الإتقان السباعي</h4><p>1) <b>تتعرّف</b> عليه عند رؤيته. 2) <b>تتذكره</b> دون نظر. 3) <b>تستخدمه</b> في جملة صحيحة. 4) <b>تجيب</b> عنه دون تفكير طويل. 5) <b>تفهمه</b> عند سماعه. 6) <b>تنتجه</b> أثناء الكلام. 7) <b>تتذكره بعد أيام</b> دون مراجعة.</p>'
+ '<h4>📌 القاعدة العملية</h4><p>لا تنتقل للدرس التالي قبل المستوى 3 على الأقل، ولا تعتبر الموضوع مُتقنًا قبل المستوى 7. التطبيق يساعدك: الإتقان الحقيقي يُقاس بالإجابات الصحيحة المتكررة (انظر شارات القواعد ونسب الدقة) لا بعدد الزيارات.</p>',
go: [["📝 الاختبارات", "quiz"], ["📈 تقدمي", "analytics"], ["⚡ التحدي", "challenge"]]
},
{
id: "hw-road", icon: "🛣️", cat: "review", kw: "A1 A2 B1 roadmap مستويات الطريق levels خارطة",
t: { ar: "الطريق: A1 ← A2 ← B1", en: "The road: A1 → A2 → B1", de: "Der Weg: A1 → A2 → B1" },
body: '<h4>🟢 A1 (مستواك الآن — مفتوح بالكامل)</h4><p>الهدف: جمل بسيطة صحيحة، تقديم نفسك، يومك، مشترياتك، أسئلة وأجوبة قصيرة. أتقن: 800–1000 كلمة مع أدواتها وجموعها + الحاضر + Perfekt + Akkusativ/Dativ الأساسي.</p>'
+ '<h4>🟡 A2 (التالي — يُفتح بعد إتمام A1)</h4><p>جمل أطول مربوطة بـ weil/dass/wenn، الماضي بثقة، وصف وتخطيط ومقارنة. القاعدة: لا تستعجل A2 قبل أن تستخدم A1 دون تفكير.</p>'
+ '<h4>🔵 B1 (الاستقلالية — لاحقًا)</h4><p>رأي مبرر، رسائل وشكاوى، فرضيات. يُبنى على A2 المتقن لا بجانبه.</p>'
+ '<h4>🎯 متى تنتقل؟</h4><p>عندما تحقق المستوى 7 من سلم الإتقان في مواضيع A1 الأساسية: تجيب وتفهم وتستخدم دون مراجعة مسبقة. «اختبار تحديد المستوى» و«الاختبار النهائي» هما الحكمان.</p>',
go: [["🗺️ الخريطة", "roadmap"], ["🧭 الرحلة", "journey"], ["📝 الاختبارات", "quiz"]]
},
{
id: "hw-exam", icon: "🎓", cat: "review", kw: "التحضير للاختبار امتحان prüfung test vorbereitung A1 A2",
t: { ar: "التحضير للاختبارات (تحديد المستوى والنهائي)", en: "Preparing for tests", de: "Prüfungsvorbereitung" },
body: '<h4>📋 خطة آخر 7 أيام قبل أي اختبار</h4><p>1–2) مراجعة شاملة للمستحق + الأخطاء (لا جديد). 3–4) اختبارات شاملة قصيرة + فهم كل خطأ. 5) مهارات: استماع + تحدث. 6) راحة نسبية + مراجعة خفيفة. 7) الاختبار.</p>'
+ '<h4>💡 يوم الاختبار</h4><p>اقرأ السؤال كاملًا قبل الإجابة. مع الشك في الأداة: تذكر الجملة التي حفظت الكلمة فيها — الأداة تأتي معها. لا تغيّر إجابتك الأولى إلا بيقين.</p>'
+ '<h4>📊 بعد الاختبار</h4><p>النتيجة تشخيص لا حكم: كل خطأ يتحول لخطة تقوية (راجع وحدة «تقوية نقاط الضعف»). أعد الاختبار بعد أسبوعين وقارن.</p>',
go: [["📝 الاختبارات", "quiz"], ["❌ أخطائي", "mistakes"], ["⚡ التحدي", "challenge"]]
},
{
id: "hw-common", icon: "⚠️", cat: "review", kw: "أخطاء شائعة common mistakes fehler عادات سيئة",
t: { ar: "الأخطاء الشائعة في المذاكرة (القاتلة الصامتة)", en: "Common study mistakes", de: "Häufige Lernfehler" },
body: '<h4>☠️ القائمة (المشكلة ← لماذا تضر ← البديل)</h4><p><b>كلمات معزولة ←</b> تُنسى دون سياق ← <b>كلمة + أداة + جمع + جملة.</b><br><b>تجاهل الأدوات والجمع ←</b> جمل مكسورة للأبد ← <b>جزء من البطاقة.</b><br><b>قواعد دون أمثلة ←</b> فهم وهمي ← <b>3 أمثلة + جملتان من تأليفك.</b><br><b>كلمات كثيرة دفعة واحدة ←</b> تشتت ونسيان ← <b>7–15 يوميًا.</b><br><b>لا مراجعة ←</b> منحنى النسيان يمحو كل شيء ← <b>10 دقائق مراجعة يوميًا.</b><br><b>قراءة فقط دون تحدث ←</b> فهم دون إنتاج ← <b>تحدث يوميًا ولو 5 دقائق.</b><br><b>ترجمة حرفية ←</b> ألماني مكسور ← <b>احفظ التركيبات كاملة.</b><br><b>تجنب الأخطاء ←</b> لا نمو ← <b>الأخطاء وقود.</b><br><b>مذاكرة متقطعة ←</b> إعادة من الصفر كل مرة ← <b>موعد يومي ثابت.</b><br><b>التقدم السريع دون إتقان ←</b> أساس هش ← <b>سلم الإتقان السباعي.</b></p>',
go: [["🧠 المراجعة", "review"], ["❌ أخطائي", "mistakes"], ["📊 الإحصائيات", "stats"]]
}
];

/* "What should I do now?" quick situations -> module + page */
var DM_HOWTO_FIX = [
  { i: "👶", ar: "مبتدئ تمامًا", mod: "hw-words", go: "vocab" },
  { i: "📝", ar: "أعرف بعض الكلمات", mod: "hw-sent", go: "sentences" },
  { i: "💨", ar: "أنسى الكلمات بسرعة", mod: "hw-forget", go: "review" },
  { i: "🧩", ar: "لا أعرف تكوين الجمل", mod: "hw-sent", go: "sentex" },
  { i: "📐", ar: "ضعيف في القواعد", mod: "hw-gram", go: "explain" },
  { i: "🎧", ar: "ضعيف في الاستماع", mod: "hw-listen", go: "listen" },
  { i: "😨", ar: "أخاف من التحدث", mod: "hw-speak", go: "speak" },
  { i: "🎯", ar: "أخطئ في der/die/das", mod: "hw-art", go: "flashcards" },
  { i: "👥", ar: "أخطئ في الجمع", mod: "hw-plural", go: "quiz" },
  { i: "🎯", ar: "أخطئ في Akkusativ", mod: "hw-akk", go: "reference" },
  { i: "🔇", ar: "أعرف الكلمات ولا أستخدمها", mod: "hw-fromsent", go: "sentences" },
  { i: "😴", ar: "توقفت عن المذاكرة", mod: "hw-daily", go: "planner" },
  { i: "📚", ar: "لدي تراكم دروس", mod: "hw-review", go: "review" },
  { i: "🎓", ar: "أريد التحضير للاختبار", mod: "hw-exam", go: "quiz" }
];

/* ---------- search (pure, tested) ---------- */
function hwStrip(s) { return String(s == null ? "" : s).replace(/<[^>]*>/g, " "); }
function hwNorm(s) {
  var x = String(s == null ? "" : s).toLowerCase();
  x = x.replace(/[.?!,;:¿¡"']/g, "").replace(/\s+/g, " ").trim();
  x = x.replace(/ß/g, "ss").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
  return x;
}
function howtoSearch(q) {
  var nq = hwNorm(q);
  if (!nq) return DM_HOWTO.map(function (m) { return m.id; });
  return DM_HOWTO.filter(function (m) {
    var hay = hwNorm(m.id + " " + (m.kw || "") + " " + m.t.ar + " " + m.t.en + " " + m.t.de + " " + hwStrip(m.body));
    return hay.indexOf(nq) >= 0;
  }).map(function (m) { return m.id; });
}
function hwById(id) {
  for (var i = 0; i < DM_HOWTO.length; i++) if (DM_HOWTO[i].id === id) return DM_HOWTO[i];
  return null;
}

/* ---------- session state (read marks persist in S.howto; view state is session) ---------- */
var HW = { q: "", cat: "all", open: null, _force: 0 };

/* ---------- render ---------- */
function hwEsc(s) { try { if (typeof escapeHtml === "function") return escapeHtml(s); } catch (e) {} return String(s == null ? "" : s); }
function hwLang() { try { return (typeof S !== "undefined" && S.uiLang) || "ar"; } catch (e) { return "ar"; } }
function hwTitle(m) { var L = hwLang(); return m.t[L] || m.t.ar; }

/* Related topics for topic-to-topic navigation: same-category siblings first. */
function hwRelated(id) {
  var m = hwById(id);
  if (!m) return [];
  var out = [];
  DM_HOWTO.forEach(function (x) { if (x.id !== id && x.cat === m.cat) out.push(x.id); });
  return out.slice(0, 6);
}

/* Stable internal route identifiers (deep-linkable topics, no second router).
   Index: "howto". Topic: "howto-<moduleId>", e.g. "howto-hw-words". */
function hwRoute(id) { return id ? "howto-" + id : "howto"; }
function hwSetHash(id) {
  try {
    if (typeof history === "undefined" || !history.replaceState) return;
    var base = "";
    try { base = location.pathname + location.search; } catch (e) { base = ""; }
    history.replaceState(null, "", base + "#" + hwRoute(id));
  } catch (e) {}
}
function hwTopicFromHash(hash) {
  try {
    var s = String(hash == null ? (typeof location !== "undefined" ? location.hash : "") : hash);
    s = s.replace(/^#/, "");
    if (s === "howto") return null;
    if (s.indexOf("howto-") === 0) {
      var id = s.slice("howto-".length);
      if (/^hw-[a-z]+$/.test(id) && hwById(id)) return id;
    }
  } catch (e) {}
  return null;
}

/* Dedicated topic view: replaces the index (never rendered underneath it).
   Navigation always flows through showPage("howto") — the project's router. */
function openHowtoTopic(id) {
  if (!hwById(id)) return false;
  HW.open = id;
  HW._force = 1;
  hwSetHash(id);
  hwGo("howto");
  return true;
}
function closeHowtoTopic() {
  HW.open = null;
  HW._force = 1;
  hwSetHash(null);
  hwGo("howto");
  return true;
}
function hwSkipPassive() {
  try {
    if (HW._force) return false;
    if (typeof window !== "undefined" && window.DMPageState && window.DMPageState.skipRender) {
      return !!window.DMPageState.skipRender("howto");
    }
  } catch (e) {}
  return false;
}

function renderHowtoIndex(box, read, ids, doneN, pct) {
  var h = "";
  h += '<div class="panel glass hw-hero"><div class="hw-hero-top"><div class="hw-hero-ico">🧭</div><div><b>' + hwEsc(hwT("title_howto")) + '</b><div class="muted">' + hwEsc(hwT("hw_intro")) + '</div></div></div>';
  h += '<div class="hw-prog-row"><div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div><span class="muted">' + doneN + '/' + DM_HOWTO.length + ' (' + pct + '%)</span></div>';
  h += '<input type="text" id="hwSearch" class="full-input" data-i18n-ph="hw_search_ph" placeholder="' + hwEsc(hwT("hw_search_ph")) + '" value="' + hwEsc(HW.q) + '" autocomplete="off">';
  h += '<div class="hw-cats"><button class="level-tab' + (HW.cat === "all" ? " active" : "") + '" data-hwcat="all">' + hwEsc(hwT("hw_all")) + '</button>';
  DM_HOWTO_CATS.forEach(function (c) {
    h += '<button class="level-tab' + (HW.cat === c.id ? " active" : "") + '" data-hwcat="' + c.id + '">' + hwEsc(hwCatName(c.id)) + '</button>';
  });
  h += "</div></div>";

  /* fix-now grid (hidden while searching/filtering to keep results focused) */
  if (!HW.q && HW.cat === "all") {
    h += '<div class="panel glass"><h3>' + hwEsc(hwT("hw_fixnow")) + '</h3><div class="hw-fix-grid">';
    DM_HOWTO_FIX.forEach(function (f, i) {
      h += '<button class="quiz-opt hw-fix" data-hwfix="' + i + '"><span>' + f.i + '</span> ' + hwEsc(f.ar) + "</button>";
    });
    h += "</div></div>";
  }

  if (!ids.length) {
    h += '<div class="panel glass"><div class="muted">' + hwEsc(hwT("hw_no_results")) + "</div></div>";
  }
  ids.forEach(function (id) {
    var m = hwById(id);
    if (!m) return;
    var isRead = !!read[id];
    h += '<button class="panel glass hw-mod hw-entry' + (isRead ? " hw-done" : "") + '" data-hwopen="' + id + '"><span class="hw-ico">' + m.icon + '</span><span class="hw-title">' + hwEsc(hwTitle(m)) + '</span><span class="hw-tags">' + (isRead ? '<span class="status-tag known">' + hwEsc(hwT("hw_read")) + "</span>" : "") + '<span class="hw-chev">◀</span></span></button>';
  });
  box.innerHTML = h;

  try {
    var si = null;
    try { si = document.getElementById("hwSearch"); } catch (e0) {}
    if (si) {
      si.addEventListener("input", function () { HW.q = si.value; renderHowto(); var n = null; try { n = document.getElementById("hwSearch"); } catch (e1) {} if (n) { try { n.focus(); } catch (e2) {} try { n.setSelectionRange(n.value.length, n.value.length); } catch (e3) {} } });
    }
    box.querySelectorAll("[data-hwcat]").forEach(function (b) {
      b.addEventListener("click", function () { HW.cat = b.getAttribute("data-hwcat"); renderHowto(); });
    });
    box.querySelectorAll("[data-hwopen]").forEach(function (b) {
      b.addEventListener("click", function () { openHowtoTopic(b.getAttribute("data-hwopen")); });
    });
    box.querySelectorAll("[data-hwfix]").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = DM_HOWTO_FIX[parseInt(b.getAttribute("data-hwfix"), 10)];
        if (!f) return;
        HW.q = ""; HW.cat = "all";
        openHowtoTopic(f.mod);
      });
    });
  } catch (e) {}
}

function renderHowtoTopic(box, m, read) {
  var isRead = !!read[m.id];
  var rel = hwRelated(m.id);
  var h = "";
  h += '<div class="hw-back-row"><button class="btn btn-ghost" data-hwback>' + hwEsc(hwT("hw_back")) + "</button></div>";
  h += '<div class="panel glass hw-topic"><div class="hw-crumb muted">' + hwEsc(hwT("title_howto")) + " / " + hwEsc(hwCatName(m.cat)) + "</div>";
  h += '<h2 class="hw-topic-title"><span class="hw-ico">' + m.icon + "</span> " + hwEsc(hwTitle(m)) + "</h2>";
  h += '<div class="hw-body">' + m.body + "</div>";
  if (m.go && m.go.length) {
    h += '<div class="hw-next"><b>' + hwEsc(hwT("hw_features")) + ':</b><div class="row-flex">';
    m.go.forEach(function (g) {
      h += '<button class="btn btn-ghost sm" data-hwgo="' + hwEsc(g[1]) + '">' + hwEsc(g[0]) + " " + hwEsc(hwT("hw_open")) + "</button>";
    });
    h += "</div></div>";
  }
  if (rel.length) {
    h += '<div class="hw-next"><b>' + hwEsc(hwT("hw_related")) + ':</b><div class="hw-fix-grid">';
    rel.forEach(function (rid) {
      var rm = hwById(rid);
      if (!rm) return;
      h += '<button class="quiz-opt hw-fix" data-hwrel="' + rid + '"><span>' + rm.icon + "</span> " + hwEsc(hwTitle(rm)) + "</button>";
    });
    h += "</div></div>";
  }
  h += '<div class="row-flex">' + (isRead ? '<span class="status-tag known">' + hwEsc(hwT("hw_read")) + "</span>" : '<button class="btn btn-green sm" data-hwread="' + m.id + '">' + hwEsc(hwT("hw_mark")) + "</button>") + "</div>";
  h += '<div class="hw-back-row"><button class="btn btn-ghost" data-hwback>' + hwEsc(hwT("hw_back")) + "</button></div>";
  h += "</div>";
  box.innerHTML = h;

  try {
    box.querySelectorAll("[data-hwback]").forEach(function (b) {
      b.addEventListener("click", function () { closeHowtoTopic(); });
    });
    box.querySelectorAll("[data-hwread]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        try { ev.stopPropagation(); } catch (e2) {}
        ensureHowto().read[m.id] = 1; hwSave(); renderHowto();
        try { if (typeof toast === "function") toast("✅", "ok"); } catch (e3) {}
      });
    });
    box.querySelectorAll("[data-hwgo]").forEach(function (b) {
      b.addEventListener("click", function () { hwGo(b.getAttribute("data-hwgo")); });
    });
    box.querySelectorAll("[data-hwrel]").forEach(function (b) {
      b.addEventListener("click", function () { openHowtoTopic(b.getAttribute("data-hwrel")); });
    });
  } catch (e) {}
}

/* Index OR dedicated topic — exactly one view at a time, never both. */
function renderHowto() {
  var box = null;
  try { box = document.getElementById("howtoBox"); } catch (e) {}
  if (!box) return;
  ensureHowto();
  var H = ensureHowto();
  var read = H.read || {};
  var openM = HW.open ? hwById(HW.open) : null;
  if (openM) { renderHowtoTopic(box, openM, read); return; }
  if (HW.open) { HW.open = null; }
  var ids = howtoSearch(HW.q).filter(function (id) {
    if (HW.cat === "all") return true;
    var m = hwById(id);
    return m && m.cat === HW.cat;
  });
  var doneN = DM_HOWTO.filter(function (m) { return read[m.id]; }).length;
  var pct = Math.round(doneN / DM_HOWTO.length * 100);
  renderHowtoIndex(box, read, ids, doneN, pct);
}

/* ---------- wiring: showPage wrap (same additive pattern as labsx.js) ----------
   Explicit topic opens (HW._force) always re-render as a dedicated view.
   Passive return visits keep the as-left DOM when DMPageState asks for it,
   so leaving the section and coming back preserves the user's state. */
(function () {
  try {
    if (typeof showPage === "function" && !showPage._howto) {
      var _sp = showPage;
      showPage = function (n) {
        _sp(n);
        var force = false;
        try { force = !!HW._force; HW._force = 0; } catch (e) {}
        try { if (n === "howto" && (force || !hwSkipPassive())) renderHowto(); } catch (e) { console.error(e); }
      };
      showPage._howto = true;
    }
    try {
      /* Deep link: #howto / #howto-<topicId> restores the topic view on load. */
      var deep = hwTopicFromHash();
      if (deep) HW.open = deep;
    } catch (e) {}
    try { ensureHowto(); } catch (e) {}
  } catch (e) { console.error(e); }
})();
