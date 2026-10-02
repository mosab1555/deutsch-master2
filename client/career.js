/* ============================================================================
   Deutsch Master — Career Pathway (Ausbildung + Introductory Nursing)
   Structured, prerequisite-based professional German for beginners.

   Honesty rules enforced in content:
   - Interview questions are labeled PRACTICE EXAMPLES, never official or
     guaranteed questions. No certification/employment promises anywhere.
   - Nursing content is LANGUAGE ONLY (beginner→intermediate communication),
     clearly distinguished from medical advice or clinical instruction.
   - Each module lists prerequisites from existing A1/A2 material and links
     back to grammar rules (g-ids) and everyday vocabulary.
   ============================================================================ */

/* ============================ PURE DATA ============================ */
var CAREER_TRACKS = [
  {
    id: "ausbildung", icon: "🎓", title: "طريق الأوسبيلدونغ", de: "Ausbildung",
    level: "A1 → A2",
    intro: "تحضير عملي للأوسبيلدونغ باللغة البسيطة: ما هو، كيف تعرّف بنفسك، أسئلة تدريبية للمقابلة، وفهم يوم العمل. إتمام هذا المسار لا يعني شهادة رسمية ولا يضمن قبولًا أو وظيفة.",
    prereq: "المتطلبات: أساس A1 (الكلمات والأدوات der/die/das وتصريف ich/du/er). كل وحدة تذكّرك بالقاعدة المرتبطة.",
    modules: [
      {
        id: "m-ausb-1", title: "ما هو الأوسبيلدونغ؟", de: "Was ist eine Ausbildung?",
        grammar: [{ id: "g1", t: "der / die / das" }, { id: "g3", t: "ein / eine" }],
        vocab: [
          ["der Ausbilder", "der", "المدرّب المهني", "die Ausbilder", "Der Ausbilder erklärt die Arbeit.", "المدرب يشرح العمل."],
          ["der Betrieb", "der", "الشركة/مكان التدريب", "die Betriebe", "Der Betrieb ist in Berlin.", "الشركة في برلين."],
          ["die Berufsschule", "die", "مدرسة المهنة", "die Berufsschulen", "Die Berufsschule ist am Montag.", "مدرسة المهنة يوم الاثنين."],
          ["der Vertrag", "der", "العقد", "die Verträge", "Der Vertrag ist wichtig.", "العقد مهم."],
          ["die Bewerbung", "die", "طلب التقديم", "die Bewerbungen", "Die Bewerbung ist fertig.", "طلب التقديم جاهز."],
          ["der Lebenslauf", "der", "السيرة الذاتية", "die Lebensläufe", "Der Lebenslauf ist kurz.", "السيرة الذاتية قصيرة."],
          ["die Probezeit", "die", "فترة التجربة", "die Probezeiten", "Die Probezeit dauert drei Monate.", "فترة التجربة ثلاثة أشهر."],
          ["das Gehalt", "das", "الراتب", "die Gehälter", "Das Gehalt kommt monatlich.", "الراتب يأتي شهريًا."]
        ],
        phrases: [
          ["Ich mache eine Ausbildung als Koch.", "أتدرب مهنيًا كطباخ."],
          ["Die Ausbildung dauert drei Jahre.", "التدريب المهني مدته ثلاث سنوات."],
          ["Wo ist die Berufsschule?", "أين مدرسة المهنة؟"],
          ["Wer ist mein Ausbilder?", "من هو مدربي؟"]
        ],
        dialogue: [
          ["Was machst du in Deutschland?", "ماذا تفعل في ألمانيا؟"],
          ["Ich mache eine Ausbildung als Elektriker.", "أتدرب مهنيًا ككهربائي."],
          ["Wie lange dauert die Ausbildung?", "كم مدة التدريب؟"],
          ["Drei Jahre. Schule und Betrieb.", "ثلاث سنوات. مدرسة وشركة."]
        ],
        followup: { q: "Was machst du in Deutschland?", ar: "ماذا تجيب عن سؤال «ماذا تفعل في ألمانيا»؟", a: "Ich mache eine Ausbildung als Koch.", aAr: "أتدرب مهنيًا كطباخ." },
        quiz: [
          { q: "ما معنى «der Ausbilder»؟", opts: ["المدرب المهني", "الراتب", "العقد", "المدرسة"], c: 0, why: "der Ausbilder هو الشخص الذي يدرّبك في الشركة." },
          { q: "ما أداة كلمة «Vertrag»؟", opts: ["der", "die", "das", "den"], c: 0, why: "der Vertrag مذكر: der Vertrag ist wichtig." },
          { q: "«Die Ausbildung ___ drei Jahre.» (تستمر)", opts: ["dauert", "dauern", "dauerst", "dauer"], c: 0, why: "die Ausbildung مفرد مؤنث → الفعل: dauert." },
          { q: "كيف تسأل عن مكان مدرسة المهنة؟", opts: ["Wo ist die Berufsschule?", "Wer ist die Berufsschule?", "Was ist die Berufsschule?", "Wann ist die Berufsschule?"], c: 0, why: "Wo للسؤال عن المكان." },
          { q: "ما جمع «der Vertrag»؟", opts: ["die Verträge", "die Vertrags", "die Vertrage", "die Verträger"], c: 0, why: "الجمع المحفوظ: die Verträge (مع Umlaut)." }
        ]
      },
      {
        id: "m-ausb-2", title: "عرّف بنفسك باحتراف", de: "Sich vorstellen",
        grammar: [{ id: "g5", t: "الضمائر ich/du/er" }, { id: "g7", t: "تصريف الأفعال" }],
        vocab: [
          ["die Erfahrung", "die", "الخبرة", "die Erfahrungen", "Ich habe ein Jahr Erfahrung.", "لدي سنة خبرة."],
          ["die Motivation", "die", "الدافع", "die Motivationen", "Meine Motivation ist groß.", "دافعي كبير."],
          ["die Stärke", "die", "نقطة القوة", "die Stärken", "Pünktlichkeit ist meine Stärke.", "الالتزام بالمواعيد نقطة قوتي."],
          ["das Ziel", "das", "الهدف", "die Ziele", "Mein Ziel ist die Ausbildung.", "هدفي هو التدريب المهني."],
          ["pünktlich", "-", "دقيق/ملتزم بالمواعيد", "-", "Ich bin immer pünktlich.", "أنا دائمًا ملتزم بالمواعيد."],
          ["fleißig", "-", "مجتهد", "-", "Ich lerne fleißig Deutsch.", "أتعلم الألمانية باجتهاد."]
        ],
        phrases: [
          ["Ich heiße Omar. Ich bin zwanzig Jahre alt.", "اسمي عمر. عمري عشرون سنة."],
          ["Ich komme aus Ägypten.", "أنا من مصر."],
          ["Ich lerne seit einem Jahr Deutsch.", "أتعلم الألمانية منذ سنة."],
          ["Ich möchte eine Ausbildung als Koch machen.", "أريد أن أتدرب مهنيًا كطباخ."]
        ],
        dialogue: [
          ["Stellen Sie sich bitte vor.", "عرّف بنفسك من فضلك."],
          ["Ich heiße Sara. Ich bin neunzehn Jahre alt.", "اسمي سارة. عمري تسع عشرة سنة."],
          ["Warum möchten Sie diese Ausbildung machen?", "لماذا تريدين هذا التدريب؟"],
          ["Ich koche gern und lerne gern Neues.", "أحب الطبخ وأحب تعلم الجديد."]
        ],
        followup: { q: "Warum möchten Sie diese Ausbildung machen?", ar: "لماذا تريد هذا التدريب؟", a: "Ich lerne gern und arbeite gern mit Menschen.", aAr: "أحب التعلم وأحب العمل مع الناس." },
        quiz: [
          { q: "كيف تقول «أنا من مصر»؟", opts: ["Ich komme aus Ägypten.", "Ich gehe aus Ägypten.", "Ich bin aus Ägypten zu.", "Ich komme nach Ägypten."], c: 0, why: "الموطن مع kommen aus." },
          { q: "«Ich ___ seit einem Jahr Deutsch.» (أتعلم)", opts: ["lerne", "lernst", "lernt", "lernen"], c: 0, why: "ich + lerne." },
          { q: "ما معنى «pünktlich» في سياق العمل؟", opts: ["ملتزم بالمواعيد", "سريع", "قوي", "هادئ"], c: 0, why: "pünktlich = يأتي في الموعد — صفة مهمة في المقابلات." },
          { q: "«___ Ziel ist die Ausbildung.» (هدفي)", opts: ["Mein", "Meine", "Meinen", "Meinem"], c: 0, why: "das Ziel محايد → Mein Ziel." },
          { q: "أي جملة تعبر عن الدافع بشكل بسيط وصحيح؟", opts: ["Ich möchte gern lernen.", "Ich müssen gern lernen.", "Ich möchte gern lernt.", "Ich gern möchte lernen."], c: 0, why: "möchte + المصدر في نهاية الجملة." }
        ]
      },
      {
        id: "m-ausb-3", title: "أسئلة المقابلة — تدريب", de: "Vorstellungsgespräch (Übung)",
        note: "⚠️ هذه أسئلة تدريبية شائعة للتدريب فقط، وليست أسئلة رسمية مضمونة في أي مقابلة حقيقية.",
        grammar: [{ id: "g10", t: "تكوين الأسئلة" }, { id: "g9", t: "ترتيب الجملة" }],
        vocab: [
          ["das Vorstellungsgespräch", "das", "مقابلة التعارف", "die Vorstellungsgespräche", "Das Gespräch ist am Montag.", "المقابلة يوم الاثنين."],
          ["die Frage", "die", "السؤال", "die Fragen", "Haben Sie Fragen?", "هل لديك أسئلة؟"],
          ["die Antwort", "die", "الإجابة", "die Antworten", "Die Antwort ist kurz.", "الإجابة قصيرة."],
          ["die Arbeitszeit", "die", "وقت العمل", "die Arbeitszeiten", "Wie sind die Arbeitszeiten?", "ما مواعيد العمل؟"]
        ],
        phrases: [
          ["Erzählen Sie etwas über sich.", "حدثنا عن نفسك."],
          ["Was sind Ihre Stärken?", "ما نقاط قوتك؟"],
          ["Haben Sie Fragen an uns?", "هل لديك أسئلة لنا؟"],
          ["Vielen Dank für das Gespräch.", "شكرًا جزيلًا على المقابلة."]
        ],
        dialogue: [
          ["Warum möchten Sie bei uns arbeiten?", "لماذا تريد العمل عندنا؟"],
          ["Ihr Betrieb ist bekannt und ich lerne gern.", "شركتكم معروفة وأنا أحب التعلم."],
          ["Wann können Sie anfangen?", "متى يمكنك البدء؟"],
          ["Ab nächstem Monat.", "من الشهر القادم."]
        ],
        followup: { q: "Haben Sie Fragen an uns?", ar: "هل لديك أسئلة لنا؟ (ماذا تجيب؟)", a: "Ja. Wie sind die Arbeitszeiten?", aAr: "نعم. ما مواعيد العمل؟" },
        quiz: [
          { q: "سُئلت «Erzählen Sie über sich» — بماذا تبدأ؟", opts: ["Ich heiße … Ich bin … Jahre alt.", "Wie heißen Sie?", "Ich weiß nicht.", "Wo arbeiten Sie?"], c: 0, why: "ابدأ بالاسم والعمر والبلد بجمل بسيطة." },
          { q: "ما السؤال المهذب الذي تسأله أنت في نهاية المقابلة؟", opts: ["Wie sind die Arbeitszeiten?", "Wie viel Geld sofort?", "Wann ist Urlaub?", "Warum fragen Sie?"], c: 0, why: "السؤال عن مواعيد العمل مهذب ومناسب." },
          { q: "«Vielen Dank ___ das Gespräch.»", opts: ["für", "um", "an", "über"], c: 0, why: "danken für + Akkusativ: Danke für das Gespräch." },
          { q: "كيف تشكر في نهاية المقابلة؟", opts: ["Vielen Dank für das Gespräch.", "Tschüs, ich gehe.", "Bis später vielleicht.", "Danke, fertig."], c: 0, why: "جملة الشكر الرسمية الكاملة هي الأنسب." },
          { q: "«Ab ___ Monat.» (من الشهر القادم)", opts: ["nächstem", "nächster", "nächstes", "nächsten"], c: 0, why: "ab + Dativ: ab nächstem Monat." }
        ]
      },
      {
        id: "m-ausb-4", title: "يوم العمل: المواعيد والتعليمات", de: "Arbeitsalltag",
        grammar: [{ id: "g11", t: "حروف الجر (mit/von/zu)" }, { id: "g9", t: "ترتيب الجملة" }],
        vocab: [
          ["die Schicht", "die", "الوردية", "die Schichten", "Die Schicht beginnt um sechs Uhr.", "الوردية تبدأ السادسة."],
          ["der Dienstplan", "der", "جدول العمل", "die Dienstpläne", "Der Dienstplan hängt im Büro.", "جدول العمل معلق في المكتب."],
          ["die Pause", "die", "الاستراحة", "die Pausen", "Die Pause ist um zwölf Uhr.", "الاستراحة الثانية عشرة."],
          ["der Kollege", "der", "الزميل", "die Kollegen", "Der Kollege hilft mir.", "الزميل يساعدني."],
          ["die Chefin", "die", "المديرة", "die Chefinnen", "Die Chefin erklärt die Aufgabe.", "المديرة تشرح المهمة."],
          ["die Aufgabe", "die", "المهمة", "die Aufgaben", "Was ist meine Aufgabe?", "ما مهمتي؟"]
        ],
        phrases: [
          ["Könnten Sie das bitte wiederholen?", "هل يمكنك تكرار ذلك من فضلك؟"],
          ["Langsamer, bitte. Ich lerne noch Deutsch.", "ببطء من فضلك. ما زلت أتعلم الألمانية."],
          ["Was soll ich jetzt tun?", "ماذا يجب أن أفعل الآن؟"],
          ["Verstanden. Ich mache das sofort.", "فهمت. سأفعل ذلك فورًا."]
        ],
        dialogue: [
          ["Bitte kommen Sie um sechs Uhr.", "تعال السادسة من فضلك."],
          ["Um sechs Uhr. Verstanden.", "السادسة. فهمت."],
          ["Ihre Aufgabe: Tische sauber machen.", "مهمتك: تنظيف الطاولات."],
          ["Gerne. Ich fange sofort an.", "بكل سرور. سأبدأ فورًا."]
        ],
        followup: { q: "Was sagen Sie, wenn Sie etwas nicht verstehen?", ar: "ماذا تقول إذا لم تفهم؟", a: "Könnten Sie das bitte wiederholen?", aAr: "هل يمكنك تكرار ذلك من فضلك؟" },
        quiz: [
          { q: "لم تفهم التعليمات — ماذا تقول بأدب؟", opts: ["Könnten Sie das bitte wiederholen?", "Was? Nochmal!", "Ich verstehe nichts.", "Sprechen Sie!"], c: 0, why: "الصيغة المهذبة مع bitte هي الصحيحة مهنيًا." },
          { q: "«Die Schicht ___ um sechs Uhr.» (تبدأ)", opts: ["beginnt", "beginne", "beginnst", "beginnen"], c: 0, why: "die Schicht مفرد → beginnt." },
          { q: "أين تجد مواعيد عملك؟", opts: ["Im Dienstplan.", "Im Kühlschrank.", "Im Traum.", "Im Bus."], c: 0, why: "der Dienstplan = جدول العمل." },
          { q: "«Was ist ___ Aufgabe?» (ما مهمتي؟)", opts: ["meine", "mein", "meinen", "meiner"], c: 0, why: "die Aufgabe مؤنث → meine Aufgabe." },
          { q: "كيف ترد عندما تُكلف بمهمة؟", opts: ["Verstanden. Ich mache das sofort.", "Nein, später.", "Vielleicht morgen.", "Ich habe keine Zeit."], c: 0, why: "الرد الإيجابي الفوري هو المهني." }
        ]
      }
    ]
  },
  {
    id: "pflege", icon: "🏥", title: "ألماني التمريض (تمهيدي)", de: "Pflege",
    level: "A2 (تمهيدي)",
    intro: "لغة التمريض الأساسية للمبتدئين: الجسم والأعراض، المواعيد، النظافة، والحديث المهذب مع المرضى. هذا المحتوى لغوي فقط وليس تعليمات طبية أو تدريبًا معتمدًا.",
    prereq: "المتطلبات: أساس A1 كامل + يُفضّل إتمام مسار الأوسبيلدونغ أولًا. المصطلحات المتقدمة موسومة بوضوح كمرحلة لاحقة.",
    modules: [
      {
        id: "m-pfl-1", title: "الجسم والأعراض الشائعة", de: "Körper und Symptome",
        grammar: [{ id: "g1", t: "der / die / das" }, { id: "g8", t: "Akkusativ" }],
        vocab: [
          ["der Kopf", "der", "الرأس", "die Köpfe", "Mein Kopf tut weh.", "رأسي يؤلمني."],
          ["der Arm", "der", "الذراع", "die Arme", "Der Arm tut weh.", "الذراع تؤلم."],
          ["das Bein", "das", "الساق", "die Beine", "Das Bein ist okay.", "الساق بخير."],
          ["der Bauch", "der", "البطن", "die Bäuche", "Mein Bauch tut weh.", "بطني يؤلمني."],
          ["der Rücken", "der", "الظهر", "die Rücken", "Mein Rücken tut weh.", "ظهري يؤلمني."],
          ["die Hand", "die", "اليد", "die Hände", "Die Hand ist sauber.", "اليد نظيفة."],
          ["der Schmerz", "der", "الألم", "die Schmerzen", "Ich habe Schmerzen.", "لدي آلام."],
          ["das Fieber", "das", "الحمى", "die Fieber", "Ich habe Fieber.", "لدي حمى."],
          ["der Husten", "der", "السعال", "die Husten", "Ich habe Husten.", "لدي سعال."],
          ["die Tablette", "die", "القرص/الحبة", "die Tabletten", "Nehmen Sie eine Tablette.", "خذ قرصًا."]
        ],
        phrases: [
          ["Wo tut es weh?", "أين يؤلمك؟"],
          ["Ich habe Kopfschmerzen.", "لدي صداع."],
          ["Seit wann haben Sie Fieber?", "منذ متى لديك حمى؟"],
          ["Nehmen Sie diese Tablette mit Wasser.", "خذ هذا القرص مع الماء."]
        ],
        dialogue: [
          ["Guten Tag! Was fehlt Ihnen?", "مرحبًا! ما مشكلتك؟"],
          ["Mein Kopf tut weh und ich habe Fieber.", "رأسي يؤلمني ولدي حمى."],
          ["Seit wann?", "منذ متى؟"],
          ["Seit gestern Abend.", "منذ مساء أمس."]
        ],
        followup: { q: "Der Patient sagt: «Mein Bauch tut weh.» Was verstehen Sie?", ar: "ماذا فهمت من كلام المريض؟", a: "Er hat Bauchschmerzen.", aAr: "لديه ألم في البطن." },
        quiz: [
          { q: "المريض يقول «Mein Kopf tut weh» — ما مشكلته؟", opts: ["صداع/ألم في الرأس", "ألم في الساق", "سعال", "حمى فقط"], c: 0, why: "der Kopf = الرأس، وtut weh = يؤلم." },
          { q: "ما أداة كلمة «Schmerz»؟", opts: ["der", "die", "das", "dem"], c: 0, why: "der Schmerz مذكر." },
          { q: "كيف تسأل المريض عن مكان الألم؟", opts: ["Wo tut es weh?", "Wer tut es weh?", "Wann tut es weh?", "Was tut es weh?"], c: 0, why: "Wo للسؤال عن المكان." },
          { q: "«Nehmen Sie diese Tablette ___ Wasser.»", opts: ["mit", "ohne", "nach", "bei"], c: 0, why: "mit Wasser = مع الماء (mit + Dativ)." },
          { q: "ما جمع «die Tablette»؟", opts: ["die Tabletten", "die Tabletts", "die Tablier", "die Tabletten-en"], c: 0, why: "الجمع المحفوظ: die Tabletten." }
        ]
      },
      {
        id: "m-pfl-2", title: "المواعيد والوقت", de: "Termine und Zeit",
        grammar: [{ id: "g11", t: "حروف الجر (am/um)" }, { id: "g10", t: "تكوين الأسئلة" }],
        vocab: [
          ["der Termin", "der", "الموعد", "die Termine", "Der Termin ist am Montag.", "الموعد يوم الاثنين."],
          ["die Sprechstunde", "die", "ساعة العيادة", "die Sprechstunden", "Die Sprechstunde ist morgens.", "ساعة العيادة صباحًا."],
          ["die Verspätung", "die", "التأخير", "die Verspätungen", "Entschuldigung für die Verspätung.", "عذرًا على التأخير."],
          ["pünktlich", "-", "في الموعد", "-", "Bitte kommen Sie pünktlich.", "تعال في الموعد من فضلك."],
          ["der Warteraum", "der", "غرفة الانتظار", "die Warteräume", "Bitte warten Sie im Warteraum.", "انتظر في غرفة الانتظار من فضلك."]
        ],
        phrases: [
          ["Ich brauche einen Termin.", "أحتاج موعدًا."],
          ["Der Termin ist am Freitag um zehn Uhr.", "الموعد يوم الجمعة العاشرة."],
          ["Bitte bringen Sie Ihre Karte mit.", "أحضر بطاقتك من فضلك."],
          ["Sind Sie versichert?", "هل لديك تأمين صحي؟"]
        ],
        dialogue: [
          ["Guten Tag! Ich brauche einen Termin.", "مرحبًا! أحتاج موعدًا."],
          ["Gerne. Am Donnerstag um neun Uhr?", "بكل سرور. الخميس التاسعة؟"],
          ["Ja, das passt. Danke!", "نعم، مناسب. شكرًا!"],
          ["Bitte bringen Sie Ihre Karte mit.", "أحضر بطاقتك من فضلك."]
        ],
        followup: { q: "Der Termin ist am Donnerstag um neun Uhr. Wann kommen Sie?", ar: "متى تأتي؟", a: "Am Donnerstag um neun Uhr.", aAr: "الخميس الساعة التاسعة." },
        quiz: [
          { q: "«Der Termin ist ___ Montag.»", opts: ["am", "im", "um", "an"], c: 0, why: "أيام الأسبوع مع an + dem = am Montag." },
          { q: "«___ zehn Uhr.» (الساعة العاشرة)", opts: ["um", "am", "im", "an"], c: 0, why: "الساعة مع um: um zehn Uhr." },
          { q: "ماذا تطلب موظفة الاستقبال من المريض؟", opts: ["Bitte bringen Sie Ihre Karte mit.", "Gehen Sie sofort weg.", "Warten Sie draußen.", "Kommen Sie nie wieder."], c: 0, why: "بطاقة التأمين تُطلب بأدب مع bitte." },
          { q: "ما معنى «die Sprechstunde»؟", opts: ["ساعة العيادة", "غرفة العمليات", "الصيدلية", "الإسعاف"], c: 0, why: "Sprechstunde = ساعات استقبال الطبيب للمرضى." },
          { q: "تأخرت عن الموعد — ماذا تقول؟", opts: ["Entschuldigung für die Verspätung.", "Egal, ich warte.", "Das ist normal.", "Kein Problem für mich."], c: 0, why: "الاعتذار المهذب هو الصحيح." }
        ]
      },
      {
        id: "m-pfl-3", title: "النظافة والعناية اليومية", de: "Hygiene und Pflege",
        grammar: [{ id: "g7", t: "تصريف الأفعال" }, { id: "g8", t: "Akkusativ" }],
        vocab: [
          ["die Seife", "die", "الصابون", "die Seifen", "Die Seife liegt am Waschbecken.", "الصابون عند المغسلة."],
          ["das Handtuch", "das", "المنشفة", "die Handtücher", "Nehmen Sie ein Handtuch.", "خذ منشفة."],
          ["waschen", "-", "يغسل", "-", "Bitte waschen Sie Ihre Hände.", "اغسل يديك من فضلك."],
          ["desinfizieren", "-", "يُطهّر", "-", "Wir desinfizieren die Hände.", "نُطهّر الأيدي."],
          ["die Handschuhe", "die", "القفازات (جمع)", "die Handschuhe", "Ziehen Sie Handschuhe an.", "البس القفازات."],
          ["sauber", "-", "نظيف", "-", "Die Hände sind sauber.", "الأيدي نظيفة."]
        ],
        phrases: [
          ["Bitte waschen Sie Ihre Hände.", "اغسل يديك من فضلك."],
          ["Die Hände müssen sauber sein.", "يجب أن تكون الأيدي نظيفة."],
          ["Ich helfe Ihnen beim Aufstehen.", "أساعدك على النهوض."],
          ["Brauchen Sie etwas?", "هل تحتاج شيئًا؟"]
        ],
        dialogue: [
          ["Bitte waschen Sie zuerst Ihre Hände.", "اغسل يديك أولًا من فضلك."],
          ["Gerne. Wo ist die Seife?", "بكل سرور. أين الصابون؟"],
          ["Am Waschbecken, bitte.", "عند المغسلة من فضلك."],
          ["Danke! Die Hände sind sauber.", "شكرًا! الأيدي نظيفة."]
        ],
        followup: { q: "Was machen Sie vor der Pflege?", ar: "ماذا تفعل قبل العناية بالمريض؟", a: "Ich wasche und desinfiziere meine Hände.", aAr: "أغسل يدي وأُطهّرهما." },
        quiz: [
          { q: "ماذا تطلب من المريض أولًا بلطف؟", opts: ["Bitte waschen Sie Ihre Hände.", "Stehen Sie sofort auf!", "Essen Sie jetzt!", "Gehen Sie raus!"], c: 0, why: "طلب غسل الأيدي بأدب هو الإجراء الأول." },
          { q: "«___ Sie Handschuhe an.» (البس)", opts: ["Ziehen", "Zieht", "Ziehst", "Zieht an"], c: 0, why: "صيغة الأمر للجمع/الاحترام: Ziehen Sie … an." },
          { q: "ما معنى «desinfizieren»؟", opts: ["يُطهّر", "يغسل بالماء فقط", "يجفف", "يلبس"], c: 0, why: "التطهير خطوة بعد الغسل في بيئة الرعاية." },
          { q: "«Die Hände ___ sauber.» (نظيفة/جمع)", opts: ["sind", "ist", "bin", "seid"], c: 0, why: "die Hände جمع → sind." },
          { q: "ما أداة «Handtuch»؟", opts: ["das", "der", "die", "den"], c: 0, why: "das Handtuch محايد." }
        ]
      },
      {
        id: "m-pfl-4", title: "التحدث مع المرضى بلطف", de: "Mit Patienten sprechen",
        grammar: [{ id: "g5", t: "الضمائر" }, { id: "g10", t: "تكوين الأسئلة" }],
        vocab: [
          ["der Patient", "der", "المريض", "die Patienten", "Der Patient wartet.", "المريض ينتظر."],
          ["die Patientin", "die", "المريضة", "die Patientinnen", "Die Patientin schläft.", "المريضة نائمة."],
          ["die Schwester", "die", "الممرضة", "die Schwestern", "Die Schwester kommt sofort.", "الممرضة قادمة فورًا."],
          ["der Pfleger", "der", "الممرض", "die Pfleger", "Der Pfleger hilft Ihnen.", "الممرض يساعدك."],
          ["ruhig", "-", "هادئ", "-", "Bleiben Sie bitte ruhig.", "ابقَ هادئًا من فضلك."],
          ["geduldig", "-", "صبور", "-", "Wir sind geduldig mit Ihnen.", "نحن صبورون معك."]
        ],
        phrases: [
          ["Wie geht es Ihnen heute?", "كيف حالك اليوم؟"],
          ["Haben Sie Schmerzen?", "هل لديك آلام؟"],
          ["Ich hole sofort die Schwester.", "سأحضر الممرضة فورًا."],
          ["Das habe ich nicht verstanden. Können Sie das wiederholen?", "لم أفهم. هل يمكنك التكرار؟"]
        ],
        dialogue: [
          ["Wie geht es Ihnen heute, Herr Ali?", "كيف حالك اليوم سيد علي؟"],
          ["Etwas besser, danke.", "أفضل قليلًا، شكرًا."],
          ["Kann ich etwas für Sie tun?", "هل يمكنني فعل شيء لك؟"],
          ["Ein Glas Wasser, bitte.", "كوب ماء من فضلك."]
        ],
        followup: { q: "Der Patient bittet um Wasser. Was antworten Sie?", ar: "ماذا تجيب؟", a: "Gerne. Ich bringe sofort Wasser.", aAr: "بكل سرور. سأحضر الماء فورًا." },
        quiz: [
          { q: "كيف تسأل المريض عن حاله بأدب؟", opts: ["Wie geht es Ihnen heute?", "Was willst du?", "Geht es?", "Bist du krank oder was?"], c: 0, why: "صيغة الاحترام Ihnen هي المهنية مع المرضى." },
          { q: "لم تفهم كلام المريض — ماذا تقول؟", opts: ["Das habe ich nicht verstanden. Können Sie das wiederholen?", "Egal.", "Sprechen Sie lauter sofort!", "Ich habe keine Zeit."], c: 0, why: "الاعتراف بعدم الفهم وطلب التكرار بأدب هو الصحيح." },
          { q: "«Ich hole sofort ___ Schwester.»", opts: ["die", "der", "das", "den"], c: 0, why: "die Schwester مؤنث → die." },
          { q: "المريض يطلب ماءً — الرد المناسب؟", opts: ["Gerne. Ich bringe sofort Wasser.", "Warten Sie lange.", "Später vielleicht.", "Nein, kein Wasser."], c: 0, why: "الرد الإيجابي الفوري مع Gerne." },
          { q: "أي صفة تصف التعامل الجيد مع المرضى؟", opts: ["geduldig", "laut", "schnell weg", "genervt"], c: 0, why: "geduldig = صبور — أساس التعامل مع المرضى." }
        ]
      }
    ]
  }
];
/* Node export for tools/ tests (browser keeps the global). */
try { if (typeof module !== "undefined" && module.exports) module.exports = CAREER_TRACKS; } catch (e) {}

/* ====================== RENDERERS (browser) ====================== */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  if (typeof document === "undefined") return;

  function esc(s) {
    if (typeof escapeHtml === "function") return escapeHtml(s);
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function carSpeak(t) { try { speakGerman(t); } catch (e) {} }
  function spBtn(t) { return ' <button class="mini-btn" data-sp="' + esc(t) + '">🔊</button>'; }
  function bindSpeak(box) {
    box.querySelectorAll("[data-sp]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); carSpeak(b.getAttribute("data-sp")); });
    });
  }
  function carShuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* Option order: prefer the app's audited fair shuffle, fallback local. */
  function orderIdx(n) {
    try { if (typeof dmQuizOrder === "function") return dmQuizOrder(n); } catch (e) {}
    return carShuffle(Array.from({ length: n }, function (_, i) { return i; }));
  }

  var state = { track: null, mod: null, qi: 0, score: 0, wrong: [], session: 0, done: false };

  function box() { return document.getElementById("careerBox"); }

  function renderCareerPath() {
    var b = box(); if (!b) return;
    var h = '<div class="panel glass"><h3>🧭 المسار المهني</h3>' +
      '<div class="muted">A1 أساس عام ← A2 ← لغة يومية ← الأوسبيلدونغ ← تمريض تمهيدي. المراحل المتقدمة موسومة «لاحقًا».</div></div>';
    h += CAREER_TRACKS.map(function (t) {
      return '<div class="panel glass"><h3>' + t.icon + " " + esc(t.title) +
        ' <span class="tag">' + esc(t.level) + '</span></h3>' +
        '<div class="muted">' + esc(t.intro) + '</div>' +
        '<div class="muted">📌 ' + esc(t.prereq) + '</div>' +
        '<div class="grid-2">' + t.modules.map(function (m) {
          return '<button class="quick-btn" data-track="' + t.id + '" data-mod="' + m.id + '">📘 ' + esc(m.title) + '<br><span class="muted">' + esc(m.de) + '</span></button>';
        }).join("") + '</div></div>';
    }).join("");
    b.innerHTML = h;
    b.querySelectorAll("[data-mod]").forEach(function (btn) {
      btn.addEventListener("click", function () { openModule(btn.getAttribute("data-track"), btn.getAttribute("data-mod")); });
    });
    bindSpeak(b);
  }

  function findMod(trackId, modId) {
    var t = CAREER_TRACKS.find(function (x) { return x.id === trackId; });
    if (!t) return null;
    var m = t.modules.find(function (x) { return x.id === modId; });
    return m ? { t: t, m: m } : null;
  }

  function openModule(trackId, modId) {
    var f = findMod(trackId, modId); if (!f) return;
    state.track = trackId; state.mod = modId; state.done = false;
    var b = box(); if (!b) return;
    var m = f.m;
    var h = '<div class="panel glass"><button class="btn btn-ghost sm" id="careerBack">← كل المسارات</button>' +
      '<h3>' + f.t.icon + " " + esc(m.title) + '</h3><div class="muted">' + esc(m.de) + '</div>' +
      (m.note ? '<div class="muted">⚠️ ' + esc(m.note) + '</div>' : "") +
      (m.grammar ? '<div class="muted">📐 القواعد المرتبطة: ' + m.grammar.map(function (g) {
        return '<button class="mini-btn" data-gram="' + esc(g.id) + '">' + esc(g.t) + '</button>';
      }).join(" ") + ' (راجع صفحة الشرح)</div>' : "") +
      '<h4>📚 الكلمات الأساسية (بالأداة والجمع)</h4>' +
      m.vocab.map(function (v) {
        return '<div class="ex-de"><div class="ex-de-l"><b>' + esc(v[0]) + '</b> = ' + esc(v[2]) +
          ' <span class="muted">(' + esc(v[3]) + ')</span>' + spBtn(v[0]) + '</div>' +
          '<div class="ex-ar">' + esc(v[4]) + spBtn(v[4]) + '</div><div class="ex-ar">' + esc(v[5]) + '</div></div>';
      }).join("") +
      '<h4>💬 عبارات مفيدة <button class="mini-btn" id="careerHideAr">👁️ إظهار/إخفاء الترجمة</button></h4><div id="careerPhr">' +
      m.phrases.map(function (p) {
        return '<div class="ex-de"><div class="ex-de-l">' + esc(p[0]) + spBtn(p[0]) + '</div><div class="ex-ar">' + esc(p[1]) + '</div></div>';
      }).join("") + '</div>' +
      '<h4>🗣️ حوار + سؤال متابعة</h4>' +
      m.dialogue.map(function (d) {
        return '<div class="ex-de"><div class="ex-de-l">' + esc(d[0]) + spBtn(d[0]) + '</div><div class="ex-ar">' + esc(d[1]) + '</div></div>';
      }).join("") +
      '<div class="ex-de"><div class="ex-de-l">❓ ' + esc(m.followup.q) + '</div><div class="ex-ar">' + esc(m.followup.ar) + '</div>' +
      '<div class="ex-de-l" style="margin-top:6px">✅ ' + esc(m.followup.a) + spBtn(m.followup.a) + '</div><div class="ex-ar">' + esc(m.followup.aAr) + '</div></div>' +
      '<div class="row-flex"><button class="btn btn-primary" id="careerStartQuiz">📝 اختبار الوحدة (' + m.quiz.length + ' أسئلة)</button></div>' +
      '<div id="careerQuiz"></div></div>';
    b.innerHTML = h;
    document.getElementById("careerBack").addEventListener("click", renderCareerPath);
    b.querySelectorAll("[data-gram]").forEach(function (gbtn) {
      gbtn.addEventListener("click", function () {
        try { showPage("explain"); } catch (e) {}
        toast("ابحث عن القاعدة في صفحة الشرح 📄", "ok");
      });
    });
    document.getElementById("careerHideAr").addEventListener("click", function () {
      b.querySelectorAll("#careerPhr .ex-ar").forEach(function (x) { x.style.display = x.style.display === "none" ? "" : "none"; });
    });
    document.getElementById("careerStartQuiz").addEventListener("click", startModuleQuiz);
    bindSpeak(b);
    b.scrollIntoView({ behavior: "smooth" });
  }

  function startModuleQuiz() {
    state.qi = 0; state.score = 0; state.wrong = []; state.session++;
    try {
      if (typeof markStudyDay === "function") markStudyDay();
      if (typeof DMProgress !== "undefined" && typeof S !== "undefined") {
        S.lastActivity = { page: "career", ts: new Date().toISOString(), label: "المسار المهني" };
        try { save(); } catch (e) {}
      }
    } catch (e) {}
    renderModuleQ();
  }

  function currentQuiz() {
    var f = findMod(state.track, state.mod);
    return f ? f.m.quiz : [];
  }

  function logCareerAttempt(q, ok, picked) {
    try {
      if (typeof DMProgress === "undefined" || typeof S === "undefined") return;
      S.evSeq = (S.evSeq || 0) + 1;
      var r = DMProgress.logAttempt(S, DMProgress.makeAttempt({
        aid: "ev" + S.evSeq + "-career" + state.session + "q" + state.qi,
        sec: "career", session: state.track + "/" + state.mod,
        qid: state.mod + "-q" + state.qi, qtype: "mcq",
        ref: state.mod, lvl: "A2", ok: ok === true
      }));
      if (r.recorded) { try { save(); } catch (e) {} }
    } catch (e) {}
  }

  function renderModuleQ() {
    var qbox = document.getElementById("careerQuiz"); if (!qbox) return;
    var quiz = currentQuiz();
    if (state.qi >= quiz.length) { renderModuleResult(); return; }
    var q = quiz[state.qi];
    var order = orderIdx(q.opts.length);
    qbox.innerHTML = '<h4>سؤال ' + (state.qi + 1) + ' / ' + quiz.length + '</h4>' +
      '<div class="ex-de"><div class="ex-de-l">' + esc(q.q) + '</div></div>' +
      '<div class="grid-2">' + order.map(function (oi) {
        return '<button class="quick-btn" data-opt="' + oi + '">' + esc(q.opts[oi]) + '</button>';
      }).join("") + '</div><div id="careerFb"></div>';
    qbox.querySelectorAll("[data-opt]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var picked = parseInt(btn.getAttribute("data-opt"), 10);
        var ok = picked === q.c;
        logCareerAttempt(q, ok, q.opts[picked]);
        qbox.querySelectorAll("[data-opt]").forEach(function (x) { x.disabled = true; });
        btn.classList.add(ok ? "correct" : "wrong");
        if (!ok) {
          state.wrong.push({ q: q.q, picked: q.opts[picked], right: q.opts[q.c], why: q.why });
          try {
            if (typeof recordMistake === "function" && typeof DMProgress !== "undefined") {
              /* unified notebook: pseudo ref keeps skill grouping + Arabic why;
                 retry button on the module re-quizzes the same skill. */
              var w = { id: state.mod + "-q" + state.qi, art: "-", de: q.q, ar: q.opts[q.c] };
              recordMistake(w, q.opts[picked], "mcq", {
                qid: state.mod + "-q" + state.qi, q: q.q, ok: q.opts[q.c],
                skill: DMProgress.classifyError({ q: q.q, correct: q.opts[q.c] })
              });
            }
          } catch (e) {}
        } else {
          try { if (typeof addXP === "function") addXP(10); } catch (e) {}
        }
        document.getElementById("careerFb").innerHTML =
          '<div class="panel glass">' + (ok ? "✅ صحيح! +10 XP" : "❌ خطأ.") +
          '<br>الصحيحة: <b>' + esc(q.opts[q.c]) + '</b><br>💡 ' + esc(q.why) +
          '<br><button class="btn btn-primary sm" id="careerNext">التالي ←</button></div>';
        document.getElementById("careerNext").addEventListener("click", function () {
          state.qi++;
          if (ok) state.score++;
          renderModuleQ();
        });
        try { if (typeof save === "function") save(); } catch (e) {}
      });
    });
    qbox.scrollIntoView({ behavior: "smooth" });
  }

  function renderModuleResult() {
    var qbox = document.getElementById("careerQuiz"); if (!qbox) return;
    var quiz = currentQuiz();
    var pct = quiz.length ? Math.round(state.score / quiz.length * 100) : 0;
    var h = '<h4>🎉 نتيجة الوحدة: ' + state.score + '/' + quiz.length + ' (' + pct + '٪)</h4>' +
      '<p>' + (pct >= 80 ? "ممتاز! 🎉" : pct >= 50 ? "جيد، واصل! 💪" : "تحتاج مراجعة، لا تستسلم! 📚") + '</p>';
    if (state.wrong.length) {
      h += '<h4>❌ راجع أخطاءك (' + state.wrong.length + ')</h4>' + state.wrong.map(function (x) {
        return '<div class="mist-err">❓ ' + esc(x.q) + '<br>إجابتك: <b>' + esc(x.picked) +
          '</b> | الصحيحة: <b style="color:var(--green)">' + esc(x.right) + '</b><br>💡 ' + esc(x.why) + '</div>';
      }).join("");
    } else {
      h += '<div class="muted">ممتاز — بلا أخطاء! 🎉</div>';
    }
    h += '<div class="row-flex"><button class="btn btn-primary sm" id="careerRetry">🔄 إعادة اختبار الوحدة</button>' +
      '<button class="btn btn-ghost sm" id="careerBackBtn">← الوحدة</button></div>';
    qbox.innerHTML = h;
    document.getElementById("careerRetry").addEventListener("click", startModuleQuiz);
    document.getElementById("careerBackBtn").addEventListener("click", function () { openModule(state.track, state.mod); });
    try {
      if (typeof markStudyDay === "function") markStudyDay();
      if (typeof renderAll === "function") renderAll();
    } catch (e) {}
  }

  /* chain into the app router (same pattern as learn.js) */
  function attach() {
    try {
      if (typeof showPage === "function") {
        var prev = showPage;
        /* Page-state preservation: keep the open career unit as-left on return visits. */
        showPage = function (n) { prev(n); try { if (n === "career" && !(window.DMPageState && DMPageState.skipRender && DMPageState.skipRender("career"))) renderCareerPath(); } catch (e) {} };
      }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
  else attach();
})();
