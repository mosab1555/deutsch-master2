/* ============================================================================
   🇩🇪 DEUTSCHLAND LIFE SIMULATOR — "Lerne Deutsch nicht nur. Lebe Deutsch."
   Immersive scenario layer. REUSES (never duplicates):
     audio: speakGerman/currentRate | mic: startMic | eval: evaluateSpoken/normDe
     mistakes/SRS: recordMistake (+S.gweak for Smart Training) | XP: addXP/earnCoins
     progress: save()/S + DMProgress.logAttempt + CloudSync auto-upload on save
     nav: showPage + DMPageState.skipRender | words: allWords/findWord/openWordDetail
   Flow enforced per scenario: WATCH -> checkpoint -> PRACTICE -> TEST ->
   RESULTS -> REVIEW. Test is unreachable before demo+checkpoint+practice.
   Offline: all content is local; TTS falls back gracefully. No new SW, no new
   auth/progress/speech systems. Single state bucket: S.sim.
   ============================================================================ */
"use strict";

/* ---------- state ---------- */
function ensureSim(){
  if(!S.sim)S.sim={demo:{},done:{},best:{},att:{},hints:{},xp:0,weak:{},badges:{},streak:{}};
  var s=S.sim;
  if(!s.demo)s.demo={}; if(!s.done)s.done={}; if(!s.best)s.best={};
  if(!s.att)s.att={}; if(!s.hints)s.hints={}; if(!s.weak)s.weak={};
  if(!s.badges)s.badges={};
  return s;
}

/* ---------- pure helpers (node-testable, no DOM) ---------- */
function simNorm(s){
  var x=String(s==null?"":s).toLowerCase();
  x=x.replace(/[.?!,;:¿¡"„“»«'']/g,"").replace(/\s+/g," ").trim();
  x=x.replace(/ß/g,"ss").replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u");
  return x;
}
function simTokens(s){return simNorm(s).split(" ").filter(Boolean);}
var SIM_STOP=["ich","du","er","sie","es","wir","ihr","der","die","das","ein","eine","einen","einem","einer","ist","sind","bin","bist","und","oder","nicht","kein","keine","im","in","am","an","auf","mit","zu","von","aus","fur","für","um","ja","nein","bitte","danke","sehr","gern","auch","noch","mal","den","dem","des"];
function simKeys(s){
  return simTokens(s).filter(function(w){return w.length>2&&SIM_STOP.indexOf(w)<0;});
}
/* Intelligent (non-literal) grading: any acceptable variant with the right
   content words passes. Returns {ok, comm, vocab, missing, notes}. */
function simGrade(answer, turn){
  var ans=simNorm(answer||"");
  var accepts=(turn&&turn.accept)||[];
  var best={hit:0,need:1,missing:[]};
  accepts.forEach(function(a){
    var ks=simKeys(a);
    if(!ks.length)ks=simTokens(a);
    var hit=ks.filter(function(k){return ans.indexOf(k)>=0;});
    if(hit.length>best.hit||(hit.length===best.hit&&ks.length<best.need)){
      best={hit:hit.length,need:ks.length,missing:ks.filter(function(k){return ans.indexOf(k)<0;})};
    }
  });
  var vocab=best.need?Math.round(best.hit/best.need*100):100;
  var t=(answer||"").trim();
  var gram=100;
  if(!/^[A-ZÄÖÜ]/.test(t))gram-=20;
  if(!/[.?!]$/.test(t))gram-=15;
  if(/\b(der|die|das|den|einen|einem)\b/i.test(t)&&/\b(brot)\b/i.test(t)&&!/brötchen/i.test(answer||""))gram-=10;
  /* article awareness (der/die/das, ein/einen...): tracked, never blocks A1 pass */
  var ART=["der","die","das","den","dem","des","ein","eine","einen","einem","einer","eines","mein","meine","meinen","meinem","kein","keine","keinen"];
  var modelToks=simTokens((turn&&turn.model)||"");
  var ansToks=simTokens(ans);
  var wantArt=modelToks.filter(function(w){return ART.indexOf(w)>=0;});
  var missArt=wantArt.filter(function(w){return ansToks.indexOf(w)<0;});
  var artIssue=missArt.length>0;
  if(artIssue)gram-=15*missArt.length;
  gram=Math.max(0,gram);
  var ok=vocab>=60;
  /* A1 is communication-first: any on-topic keyword saves a weak attempt. */
  if(!ok&&turn&&turn.keywords){
    var kl=simKeys((turn.keywords||[]).join(" "));
    if(kl.some(function(k){return ans.indexOf(k)>=0;})){ok=true;vocab=Math.max(vocab,60);}
  }
  var comm=Math.round(vocab*0.7+gram*0.3);
  var notes=[];
  if(/^[A-ZÄÖÜ]/.test(t))notes.push("ok-cap");else notes.push("fix-cap");
  if(/[.!?]$/.test(t))notes.push("ok-punct");else notes.push("fix-punct");
  if(artIssue)notes.push("fix-art:"+missArt.join("/"));else notes.push("ok-art");
  return {ok:ok,comm:comm,vocab:vocab,gram:gram,missing:best.missing,notes:notes,artIssue:artIssue,missArt:missArt};
}
/* Natural NPC repair line (safe failure, never bare "Wrong"). */
function simRepair(turn, grade){
  var miss=(grade.missing||[]).slice(0,2).join(" / ");
  if(/brötchen/i.test(turn.model||"")&&/brot/i.test(turn.last||"")&&!/brötchen/i.test(turn.last||""))
    return {npc:"Zwei Brötchen?",tip:"💡 Brötchen (قطع الخبز الصغيرة) هي الكلمة الصحيحة هنا، وليس Brot (الخبز الكبير). قلها مرة أخرى!"};
  if(miss)return {npc:"Wie bitte? Meinen Sie: "+turn.model,tip:"💡 كلمة مهمة ناقصة: "+miss+" — حاول إدخالها في جملتك."};
  return {npc:"Können Sie das bitte wiederholen?",tip:"💡 أعد المحاولة بهدوء — الهدف أن تصل الفكرة، وليس الكمال."};
}
function simSupportLevel(sid){
  /* Levels 1..5: support fades as mastery grows. Pure + testable. */
  var s=ensureSimSafe();
  var n=(s.att&&s.att[sid])||0;
  var best=(s.best&&s.best[sid]&&s.best[sid].comm)||0;
  if(n>=8&&best>=85)return 5;
  if(n>=5&&best>=75)return 4;
  if(n>=3&&best>=65)return 3;
  if(n>=1)return 2;
  return 1;
}
function ensureSimSafe(){try{return ensureSim();}catch(e){return {att:{},best:{}};}}
try{if(typeof module!=="undefined"&&module.exports){module.exports={simNorm:simNorm,simGrade:simGrade,simSupportLevel:simSupportLevel,simRepair:simRepair};}}catch(e){}

/* ---------- survival phrases ("I don't understand") ---------- */
var SIM_SURVIVAL=[
 {de:"Wie bitte?",ar:"عفوًا، ماذا؟",tip:"الأكثر استخدامًا في الحياة اليومية."},
 {de:"Können Sie das bitte wiederholen?",ar:"هل يمكنك تكرار ذلك من فضلك؟",tip:"رسمية ومهذبة — مثالية في Bürgeramt."},
 {de:"Ich habe das nicht verstanden.",ar:"لم أفهم ذلك.",tip:"صادقة وطبيعية — الألمان يحترمونها."},
 {de:"Was bedeutet das?",ar:"ماذا يعني ذلك؟",tip:"لسؤال عن كلمة واحدة."},
 {de:"Können Sie bitte langsamer sprechen?",ar:"هل يمكنك التحدث ببطء من فضلك؟",tip:"اطلب البطء بدل أن تستسلم."}
];

/* ---------- scenario data model (content separate from rendering) ----------
   {id,title,arTitle,icon,location,locationAr,level,situation,situationAr,
    npc:{name,nameAr},dialogue:[{by,npc,de,ar,phrases:[{de,ar,tip}]}], turns:[
    {npc:{de,ar},model,de,ar,accept[],keywords[],hint,hintAr,chips[],skill,
     grammar,grammarAr,fix}]} */
var SIM_SCENARIOS=[
{id:"baeckerei",title:"Beim Bäcker",arTitle:"في المخبز",icon:"🥨",location:"Bäckerei",locationAr:"المخبز",level:"A1",
 situation:"Du gehst morgens in eine deutsche Bäckerei und kaufst Brötchen.",
 situationAr:"تدخل مخبزًا ألمانيًا صباحًا لتشتري خبزًا.",
 npc:{name:"Frau Becker",nameAr:"السيدة بيكر (البائعة)"},
 dialogue:[
  {by:"npc",de:"Guten Morgen! Was möchten Sie?",ar:"صباح الخير! ماذا تريد؟",phrases:[{de:"Was möchten Sie?",ar:"ماذا تريد؟",tip:"💡 möchten = تريد (مهذبة). أهم فعل للطلب."}]},
  {by:"me",de:"Ich möchte zwei Brötchen, bitte.",ar:"أريد قطعتين من الخبز، من فضلك.",phrases:[{de:"Ich möchte …",ar:"أريد …",tip:"💡 Ich möchte + Akkusativ = صيغة الطلب الذهبية."},{de:"das Brötchen",ar:"قطعة الخبز الصغيرة",tip:"⚠️ ليس Brot! Brötchen للقطع الصغيرة."}]},
  {by:"npc",de:"Sonst noch etwas?",ar:"هل تريد شيئًا آخر؟",phrases:[{de:"Sonst noch etwas?",ar:"شيء آخر؟",tip:"💡 ستسمعها في كل محل — احفظها كما هي."}]},
  {by:"me",de:"Nein, danke.",ar:"لا، شكرًا.",phrases:[]},
  {by:"npc",de:"Das macht drei Euro.",ar:"الحساب ثلاثة يورو.",phrases:[{de:"Das macht …",ar:"الحساب …",tip:"💡 هكذا يقول البائع السعر دائمًا."}]},
  {by:"me",de:"Bitte schön.",ar:"تفضل.",phrases:[{de:"Bitte schön.",ar:"تفضل (عند الدفع).",tip:"💡 تقولها وأنت تعطي النقود."}]},
  {by:"npc",de:"Danke. Einen schönen Tag!",ar:"شكرًا. يومًا سعيدًا!",phrases:[]},
  {by:"me",de:"Danke, gleichfalls!",ar:"شكرًا، لك أيضًا!",phrases:[{de:"gleichfalls",ar:"لك بالمثل.",tip:"💡 الرد الجاهز على كل أمنية."}]}
 ],
 turns:[
  {npc:{de:"Guten Morgen! Was möchten Sie?",ar:"صباح الخير! ماذا تريد؟"},model:"Ich möchte zwei Brötchen, bitte.",modelAr:"أريد قطعتين من الخبز، من فضلك.",
   accept:["Ich möchte zwei Brötchen","Ich hätte gern zwei Brötchen","Zwei Brötchen, bitte","Ich möchte zwei Brötchen, bitte"],keywords:["Brötchen","möchte","hätte"],
   hint:"ابدأ بـ Ich möchte …",hintAr:"ابدأ بـ Ich möchte …",chips:["Ich möchte","zwei","Brötchen","bitte","gern"],skill:"akkusativ",grammar:"Akkusativ مع möchte",grammarAr:"الطلب بـ Ich möchte + مفعول",fix:"Brötchen ≠ Brot"},
  {npc:{de:"Sonst noch etwas?",ar:"شيء آخر؟"},model:"Nein, danke. Das ist alles.",modelAr:"لا شكرًا. هذا كل شيء.",
   accept:["Nein, danke","Nein danke","Das ist alles","Nein, danke. Das ist alles","Nein"],keywords:["Nein","alles"],
   hint:"Nein, …",hintAr:"انفِ بأدب",chips:["Nein","danke","Das ist alles"],skill:"allgemein",grammar:"النفي المهذب",grammarAr:"Nein, danke",fix:""},
  {npc:{de:"Das macht drei Euro.",ar:"الحساب ثلاثة يورو."},model:"Bitte schön.",modelAr:"تفضل.",
   accept:["Bitte schön","Bitte sehr","Hier bitte","Stimmt so"],keywords:["Bitte"],
   hint:"… schön",hintAr:"كلمة واحدة مهذبة عند الدفع",chips:["Bitte","schön","Hier"],skill:"allgemein",grammar:"عبارات الدفع",grammarAr:"Bitte schön عند الدفع",fix:""}
 ]},
{id:"supermarkt",title:"Im Supermarkt",arTitle:"في السوبرماركت",icon:"🛒",location:"Supermarkt",locationAr:"السوبرماركت",level:"A1",
 situation:"Du suchst Milch und fragst an der Kasse nach dem Preis.",
 situationAr:"تبحث عن الحليب وتسأل عن السعر عند الكاشير.",
 npc:{name:"Herr Ali",nameAr:"السيد علي (الموظف)"},
 dialogue:[
  {by:"me",de:"Entschuldigung, wo ist die Milch?",ar:"عذرًا، أين الحليب؟",phrases:[{de:"Wo ist …?",ar:"أين …؟",tip:"💡 أهم سؤال في أي محل."}]},
  {by:"npc",de:"Die Milch ist rechts, neben dem Brot.",ar:"الحليب على اليمين، بجانب الخبز.",phrases:[{de:"rechts / neben",ar:"يمين / بجانب",tip:"💡 كلمتا الاتجاه الأكثر فائدة."}]},
  {by:"me",de:"Danke! Was kostet die Milch?",ar:"شكرًا! كم سعر الحليب؟",phrases:[{de:"Was kostet …?",ar:"كم سعر …؟",tip:"💡 اسأل عن السعر بهذه الصيغة."}]},
  {by:"npc",de:"Ein Euro zwanzig.",ar:"يورو وعشرون سنتًا.",phrases:[]},
  {by:"me",de:"Ich nehme zwei Flaschen, bitte.",ar:"سآخذ زجاجتين من فضلك.",phrases:[{de:"Ich nehme …",ar:"سآخذ …",tip:"💡 بديل طبيعي لـ Ich möchte."}]},
  {by:"npc",de:"Sonst noch etwas?",ar:"شيء آخر؟",phrases:[]},
  {by:"me",de:"Nein, danke. Das ist alles.",ar:"لا شكرًا. هذا كل شيء.",phrases:[]}
 ],
 turns:[
  {npc:{de:"Kann ich Ihnen helfen?",ar:"هل أساعدك؟"},model:"Ja. Wo ist die Milch?",modelAr:"نعم. أين الحليب؟",
   accept:["Wo ist die Milch","Wo finde ich die Milch","Ich suche die Milch","Milch, bitte. Wo"],keywords:["Milch","Wo"],
   hint:"Wo ist …?",hintAr:"اسأل بـ Wo",chips:["Wo","ist","die","Milch","suche"],skill:"fragen",grammar:"أسئلة Wo",grammarAr:"السؤال عن المكان",fix:"die Milch (مؤنث)"},
  {npc:{de:"Die Milch ist rechts. Was kostet — äh, wie viele möchten Sie?",ar:"الحليب على اليمين. كم تريد؟"},model:"Ich nehme zwei Flaschen, bitte.",modelAr:"سآخذ زجاجتين من فضلك.",
   accept:["Ich nehme zwei Flaschen","Zwei Flaschen, bitte","Ich möchte zwei Flaschen","Zwei Flaschen"],keywords:["zwei","Flaschen","nehme"],
   hint:"Ich nehme …",hintAr:"عبّر عن الكمية",chips:["Ich nehme","zwei","Flaschen","bitte"],skill:"akkusativ",grammar:"Akkusativ بعد nehmen",grammarAr:"Ich nehme + مفعول",fix:"die Flasche → Flaschen (جمع)"},
  {npc:{de:"Sonst noch etwas?",ar:"شيء آخر؟"},model:"Nein, danke. Das ist alles.",modelAr:"لا شكرًا. هذا كل شيء.",
   accept:["Nein, danke","Das ist alles","Nein, danke. Das ist alles","Nein"],keywords:["Nein","alles"],
   hint:"Nein, …",hintAr:"اختم بأدب",chips:["Nein","danke","Das ist alles"],skill:"allgemein",grammar:"الختام المهذب",grammarAr:"Nein, danke",fix:""}
 ]},
{id:"bahnhof",title:"Am Bahnhof",arTitle:"في محطة القطار",icon:"🚆",location:"Bahnhof",locationAr:"محطة القطار",level:"A1",
 situation:"Du kaufst eine Fahrkarte nach Berlin und fragst nach dem Bahnsteig.",
 situationAr:"تشتري تذكرة إلى برلين وتسأل عن الرصيف.",
 npc:{name:"Frau Weber",nameAr:"السيدة فيبر (موظفة الشباك)"},
 dialogue:[
  {by:"me",de:"Guten Tag! Ich möchte nach Berlin fahren.",ar:"نهارك سعيد! أريد السفر إلى برلين.",phrases:[{de:"nach Berlin",ar:"إلى برلين",tip:"💡 nach + مدينة (بدون أداة) للاتجاه."}]},
  {by:"npc",de:"Einfach oder hin und zurück?",ar:"ذهاب فقط أم ذهاب وعودة؟",phrases:[{de:"hin und zurück",ar:"ذهاب وعودة",tip:"💡 احفظها كقطعة واحدة."}]},
  {by:"me",de:"Einfach, bitte. Was kostet das?",ar:"ذهاب فقط من فضلك. كم السعر؟",phrases:[]},
  {by:"npc",de:"Vierzig Euro. Der Zug fährt um zehn Uhr von Bahnsteig drei.",ar:"أربعون يورو. القطار يتحرك العاشرة من رصيف 3.",phrases:[{de:"von Bahnsteig drei",ar:"من رصيف 3",tip:"💡 von + Dativ — لكن الرقم يكفي في الكلام."}]},
  {by:"me",de:"Danke! Tschüs!",ar:"شكرًا! سلام!",phrases:[]}
 ],
 turns:[
  {npc:{de:"Guten Tag! Wohin möchten Sie fahren?",ar:"نهارك سعيد! إلى أين تريد السفر؟"},model:"Ich möchte nach Berlin.",modelAr:"أريد الذهاب إلى برلين.",
   accept:["Ich möchte nach Berlin","Nach Berlin","Ich fahre nach Berlin","Nach Berlin, bitte"],keywords:["Berlin","nach"],
   hint:"Ich möchte nach …",hintAr:"اذكر المدينة",chips:["Ich möchte","nach","Berlin","fahren"],skill:"praepositionen",grammar:"nach + مدينة",grammarAr:"الاتجاه بـ nach",fix:"nach (بدون أداة) وليس in"},
  {npc:{de:"Einfach oder hin und zurück?",ar:"ذهاب فقط أم ذهاب وعودة؟"},model:"Einfach, bitte.",modelAr:"ذهاب فقط من فضلك.",
   accept:["Einfach","Einfach, bitte","Nur einfach","Einfache Fahrt"],keywords:["Einfach"],
   hint:"Einfach, …",hintAr:"اختر نوع التذكرة",chips:["Einfach","hin und zurück","bitte"],skill:"allgemein",grammar:"أنواع التذاكر",grammarAr:"einfach = ذهاب فقط",fix:""},
  {npc:{de:"Von welchem Bahnsteig fährt der Zug?",ar:"من أي رصيف يتحرك القطار؟ (الموظفة تختبرك!)"},model:"Von Bahnsteig drei.",modelAr:"من رصيف 3.",
   accept:["Von Bahnsteig drei","Bahnsteig drei","Nummer drei","Von Nummer drei"],keywords:["Bahnsteig","drei"],
   hint:"Von Bahnsteig …",hintAr:"أجب بالرقم",chips:["Von","Bahnsteig","drei","Nummer"],skill:"fragen",grammar:"الإجابة برقم",grammarAr:"Von + رقم الرصيف",fix:""}
 ]},
{id:"cafe",title:"Im Café",arTitle:"في المقهى",icon:"☕",location:"Café",locationAr:"المقهى",level:"A1",
 situation:"Du bestellst einen Kaffee und einen Kuchen im Café.",
 situationAr:"تطلب قهوة وكعكًا في المقهى.",
 npc:{name:"Jonas",nameAr:"يونس (النادل)"},
 dialogue:[
  {by:"npc",de:"Hallo! Was möchten Sie bestellen?",ar:"أهلًا! ماذا تريد أن تطلب؟",phrases:[{de:"bestellen",ar:"يطلب (في مطعم)",tip:"💡 bestellen للطلب في المطاعم فقط."}]},
  {by:"me",de:"Ich möchte einen Kaffee, bitte.",ar:"أريد قهوة من فضلك.",phrases:[{de:"einen Kaffee",ar:"قهوة (مفعول)",tip:"⚠️ Akkusativ: ein → einen مع المذكر!"}]},
  {by:"npc",de:"Gern. Möchten Sie auch einen Kuchen?",ar:"بكل سرور. هل تريد كعكًا أيضًا؟",phrases:[]},
  {by:"me",de:"Ja, einen Apfelkuchen, bitte.",ar:"نعم، كعكة تفاح من فضلك.",phrases:[{de:"einen Apfelkuchen",ar:"كعكة تفاح",tip:"⚠️ einen تتكرر — هذه قاعدة المذكر."}]},
  {by:"npc",de:"Das macht sechs Euro fünfzig.",ar:"الحساب ستة يورو وخمسون.",phrases:[]},
  {by:"me",de:"Stimmt so.",ar:"احتفظ بالباقي (بقشيش).",phrases:[{de:"Stimmt so.",ar:"احتفظ بالباقي.",tip:"💡 عبقرية ألمانية: بقشيش مهذب بكلمتين."}]}
 ],
 turns:[
  {npc:{de:"Hallo! Was möchten Sie bestellen?",ar:"أهلًا! ماذا تريد أن تطلب؟"},model:"Ich möchte einen Kaffee, bitte.",modelAr:"أريد قهوة من فضلك.",
   accept:["Ich möchte einen Kaffee","Einen Kaffee, bitte","Ich hätte gern einen Kaffee","Einen Kaffee"],keywords:["Kaffee","einen"],
   hint:"Ich möchte einen …",hintAr:"انتبه: einen وليس ein",chips:["Ich möchte","einen","Kaffee","bitte"],skill:"akkusativ",grammar:"einen للمذكر",grammarAr:"Akkusativ: ein → einen",fix:"einen Kaffee (مذكر)"},
  {npc:{de:"Möchten Sie auch einen Kuchen?",ar:"هل تريد كعكًا أيضًا؟"},model:"Ja, einen Apfelkuchen, bitte.",modelAr:"نعم، كعكة تفاح من فضلك.",
   accept:["Ja, einen Apfelkuchen","Einen Apfelkuchen, bitte","Ja gern, einen Kuchen","Ja, einen Kuchen"],keywords:["Apfelkuchen","Kuchen","einen"],
   hint:"Ja, einen …",hintAr:"كرر القاعدة نفسها",chips:["Ja","einen","Apfelkuchen","Kuchen"],skill:"akkusativ",grammar:"einen للمذكر",grammarAr:"Akkusativ مرة أخرى",fix:"einen Kuchen (مذكر)"},
  {npc:{de:"Das macht sechs Euro fünfzig.",ar:"الحساب 6.50."},model:"Stimmt so.",modelAr:"احتفظ بالباقي.",
   accept:["Stimmt so","Stimmt so, danke","Danke, stimmt so","Hier, stimmt so"],keywords:["Stimmt"],
   hint:"Stimmt …",hintAr:"عبارة البقشيش",chips:["Stimmt","so","danke"],skill:"allgemein",grammar:"عبارة البقشيش",grammarAr:"Stimmt so = احتفظ بالباقي",fix:""}
 ]},
{id:"wohnung",title:"Die Wohnung",arTitle:"الشقة الجديدة",icon:"🏠",location:"Wohnung",locationAr:"الشقة",level:"A1",
 situation:"Du sprichst mit dem Vermieter über ein Problem: Wasser tropft.",
 situationAr:"تتحدث مع مالك الشقة عن مشكلة: الماء يتساقط.",
 npc:{name:"Herr Yilmaz",nameAr:"السيد يلماز (المالك)"},
 dialogue:[
  {by:"me",de:"Guten Tag, Herr Yilmaz! Ich habe ein Problem.",ar:"نهارك سعيد سيد يلماز! لدي مشكلة.",phrases:[{de:"Ich habe ein Problem.",ar:"لدي مشكلة.",tip:"💡 ابدأ بها — مباشرة ومهذبة."}]},
  {by:"npc",de:"Oh! Was ist los?",ar:"أوه! ما الأمر؟",phrases:[{de:"Was ist los?",ar:"ما الأمر؟",tip:"💡 ستسمعها كثيرًا — تعني ما المشكلة؟"}]},
  {by:"me",de:"Wasser tropft im Bad.",ar:"الماء يتساقط في الحمام.",phrases:[{de:"tropfen",ar:"يتساقط (نقاطًا)",tip:"💡 tropfen للماء الذي يقطر."}]},
  {by:"npc",de:"Seit wann?",ar:"منذ متى؟",phrases:[{de:"Seit wann?",ar:"منذ متى؟",tip:"💡 seit = منذ (للمدة المستمرة)."}]},
  {by:"me",de:"Seit gestern. Können Sie bitte helfen?",ar:"منذ أمس. هل يمكنك المساعدة من فضلك؟",phrases:[{de:"Können Sie bitte helfen?",ar:"هل يمكنك المساعدة؟",tip:"💡 طلب مهذب بـ Können Sie."}]},
  {by:"npc",de:"Ja, natürlich. Ich komme morgen um zehn Uhr.",ar:"نعم بالطبع. سآتي غدًا العاشرة.",phrases:[]},
  {by:"me",de:"Vielen Dank! Bis morgen!",ar:"شكرًا جزيلًا! إلى الغد!",phrases:[]}
 ],
 turns:[
  {npc:{de:"Guten Tag! Was ist los?",ar:"نهارك سعيد! ما الأمر؟"},model:"Ich habe ein Problem. Wasser tropft im Bad.",modelAr:"لدي مشكلة. الماء يتساقط في الحمام.",
   accept:["Ich habe ein Problem","Wasser tropft","Wasser tropft im Bad","Es gibt ein Problem im Bad","Im Bad tropft Wasser"],keywords:["Problem","Wasser","tropft","Bad"],
   hint:"Ich habe …",hintAr:"اشرح المشكلة",chips:["Ich habe","ein Problem","Wasser","tropft","Bad"],skill:"allgemein",grammar:"وصف المشكلة",grammarAr:"Ich habe ein Problem",fix:"das Bad (محايد)"},
  {npc:{de:"Seit wann?",ar:"منذ متى؟"},model:"Seit gestern.",modelAr:"منذ أمس.",
   accept:["Seit gestern","Seit zwei Tagen","Seit heute Morgen","Gestern"],keywords:["Seit","gestern"],
   hint:"Seit …",hintAr:"اذكر المدة",chips:["Seit","gestern","heute","Tagen"],skill:"praepositionen",grammar:"seit + مدة",grammarAr:"seit = منذ",fix:""},
  {npc:{de:"Okay. Was möchten Sie?",ar:"حسنًا. ماذا تريد؟"},model:"Können Sie bitte helfen?",modelAr:"هل يمكنك المساعدة من فضلك؟",
   accept:["Können Sie bitte helfen","Können Sie helfen","Bitte helfen Sie mir","Helfen Sie mir bitte"],keywords:["helfen","Können"],
   hint:"Können Sie …?",hintAr:"اطلب بأدب",chips:["Können Sie","bitte","helfen","mir"],skill:"konjugation",grammar:"طلب بـ können",grammarAr:"Können Sie …؟",fix:""}
 ]},
{id:"buergeramt",title:"Beim Bürgeramt",arTitle:"في مكتب المواطنين",icon:"🏛️",location:"Bürgeramt",locationAr:"مكتب المواطنين",level:"A1",
 situation:"Du hast einen Termin und meldest dich an der Rezeption an.",
 situationAr:"لديك موعد وتسجل حضورك عند الاستقبال.",
 npc:{name:"Frau Becker",nameAr:"السيدة بيكر (الموظفة)"},
 dialogue:[
  {by:"npc",de:"Guten Tag! Haben Sie einen Termin?",ar:"نهارك سعيد! هل لديك موعد؟",phrases:[{de:"einen Termin",ar:"موعد",tip:"⚠️ einen — مفعول مذكر مرة أخرى!"}]},
  {by:"me",de:"Ja. Ich habe einen Termin um zehn Uhr.",ar:"نعم. لدي موعد العاشرة.",phrases:[{de:"um zehn Uhr",ar:"الساعة العاشرة",tip:"💡 um + وقت = الساعة."}]},
  {by:"npc",de:"Ihren Pass, bitte.",ar:"جوازك من فضلك.",phrases:[{de:"Ihren Pass",ar:"جوازك (رسمي)",tip:"💡 Ihr- للرسمي، dein- للودي."}]},
  {by:"me",de:"Hier ist mein Pass.",ar:"هذا جوازي.",phrases:[{de:"Hier ist …",ar:"هذا … (تقديم شيء)",tip:"💡 الصيغة الجاهزة لتسليم أي ورقة."}]},
  {by:"npc",de:"Danke. Bitte nehmen Sie Platz.",ar:"شكرًا. تفضل بالجلوس.",phrases:[{de:"Nehmen Sie Platz.",ar:"تفضل بالجلوس.",tip:"💡 أمر مهذب — لا تخف منه!"}]},
  {by:"me",de:"Danke schön!",ar:"شكرًا جزيلًا!",phrases:[]}
 ],
 turns:[
  {npc:{de:"Guten Tag! Haben Sie einen Termin?",ar:"هل لديك موعد؟"},model:"Ja. Ich habe einen Termin um zehn Uhr.",modelAr:"نعم. لدي موعد العاشرة.",
   accept:["Ich habe einen Termin","Ja, ich habe einen Termin","Ja. Um zehn Uhr","Einen Termin um zehn"],keywords:["Termin","zehn","habe"],
   hint:"Ich habe einen …",hintAr:"أكّد الموعد",chips:["Ich habe","einen","Termin","zehn Uhr"],skill:"akkusativ",grammar:"einen Termin",grammarAr:"Akkusativ: einen",fix:"der Termin → einen Termin"},
  {npc:{de:"Ihren Pass, bitte.",ar:"جوازك من فضلك."},model:"Hier ist mein Pass.",modelAr:"هذا جوازي.",
   accept:["Hier ist mein Pass","Hier, bitte","Hier ist mein Ausweis","Mein Pass, bitte"],keywords:["Pass","Hier"],
   hint:"Hier ist …",hintAr:"سلّم الجواز",chips:["Hier","ist","mein","Pass"],skill:"possessiv",grammar:"mein + الاسم",grammarAr:"ضمير الملكية mein",fix:"mein Pass (مذكر)"},
  {npc:{de:"Bitte nehmen Sie Platz.",ar:"تفضل بالجلوس."},model:"Danke schön!",modelAr:"شكرًا جزيلًا!",
   accept:["Danke","Danke schön","Vielen Dank","Danke sehr"],keywords:["Danke"],
   hint:"Danke …",hintAr:"اشكر بأدب",chips:["Danke","schön","Vielen"],skill:"allgemein",grammar:"الشكر",grammarAr:"Danke schön",fix:""}
 ]}
];
function simScenario(id){for(var i=0;i<SIM_SCENARIOS.length;i++)if(SIM_SCENARIOS[i].id===id)return SIM_SCENARIOS[i];return null;}

/* ---------- badges ---------- */
var SIM_BADGES=[
 {id:"first-order",icon:"🥨",t:"First Order",ar:"أول طلب",test:function(s){return Object.keys(s.done||{}).length>=1;}},
 {id:"train",icon:"🚆",t:"Train Traveler",ar:"مسافر القطار",test:function(s){return !!(s.done&&s.done.bahnhof);}},
 {id:"market",icon:"🛒",t:"Supermarket Ready",ar:"جاهز للسوبرماركت",test:function(s){return !!(s.done&&s.done.supermarkt);}},
 {id:"home",icon:"🏠",t:"Apartment Ready",ar:"جاهز للسكن",test:function(s){return !!(s.done&&s.done.wohnung);}},
 {id:"work",icon:"💼",t:"Work Ready",ar:"جاهز للعمل",test:function(s){return Object.keys(s.done||{}).length>=4;}},
 {id:"germany",icon:"🇩🇪",t:"Germany Ready",ar:"جاهز لألمانيا",test:function(s){return Object.keys(s.done||{}).length>=6;}}
];
function simCheckBadges(){
  var s=ensureSim(),got=[];
  SIM_BADGES.forEach(function(b){
    if(!s.badges[b.id]&&b.test(s)){s.badges[b.id]=1;got.push(b);}
  });
  if(got.length){save();got.forEach(function(b){try{toast("🏆 وسام جديد: "+b.icon+" "+b.ar+"!","ok");}catch(e){}});}
  return got;
}

/* ---------- session (in-memory; test answers never persisted mid-run) ---------- */
var SIM={sid:null,phase:"map",turnIdx:0,results:[],showDe:true,showAr:true,practiced:false,hintCount:0,retries:0,playAll:false};

/* ---------- audio (isolated: never bubbles to cards/nav) ---------- */
function simSpeak(text, slow){
  try{
    if(slow){var r=currentRate();S.settings.speed=0.5;save();speakGerman(text);S.settings.speed=r;save();}
    else speakGerman(text);
  }catch(e){try{speakGerman(text);}catch(_){}}
}
function simAudioBtn(text, slow, label){
  return '<button class="mini-btn sim-audio" data-say="'+escapeHtml(text)+'" data-slow="'+(slow?1:0)+'" title="استمع" aria-label="استمع">'+(label||"🔊")+'</button>';
}
function simBindAudio(scope){
  try{
    scope.querySelectorAll(".sim-audio").forEach(function(b){
      b.addEventListener("click",function(e){
        e.stopPropagation();e.preventDefault();
        var t=b.getAttribute("data-say")||"";
        simSpeak(t,b.getAttribute("data-slow")==="1");
      });
    });
  }catch(e){}
}

/* ---------- progress ---------- */
function simProgress(){
  var s=ensureSim();
  var total=SIM_SCENARIOS.length,dn=Object.keys(s.done).length;
  var comm=[],speak=[],list=[];
  Object.keys(s.best||{}).forEach(function(k){
    var b=s.best[k];if(!b)return;
    comm.push(b.comm||0);speak.push(b.speaking||0);list.push(b.listening||0);
  });
  function avg(a){return a.length?Math.round(a.reduce(function(x,y){return x+y;},0)/a.length):0;}
  return {dn:dn,total:total,pct:Math.round(dn/Math.max(1,total)*100),
    comm:avg(comm),speaking:avg(speak),listening:avg(list),
    streak:(S.streak&&S.streak.count)||0};
}
function simRecordMistake(sid, turn, answer){
  try{
    var s=ensureSim();
    var key=turn.skill||"allgemein";
    s.weak[key]=(s.weak[key]||0)+1;
    var w={id:"sim:"+sid+":"+simNorm(turn.model).slice(0,24),de:turn.model,ar:turn.modelAr||"",
      art:"-",type:"محادثة",cat:"General",kap:"SIM",skill:key};
    try{recordMistake(w,answer,"simulator",{q:turn.npc.de,ok:turn.model,kap:"SIM"});}catch(e){}
    try{
      if(turn.skill&&turn.skill!=="allgemein"){S.gweak=S.gweak||{};S.gweak[turn.skill]=(S.gweak[turn.skill]||0)+1;}
    }catch(e){}
    try{
      if(typeof DMProgress!=="undefined"&&DMProgress.logAttempt){
        S.evSeq=(S.evSeq||0)+1;
        DMProgress.logAttempt(S,DMProgress.makeAttempt({aid:"ev"+S.evSeq+"-sim-"+sid+"-"+Date.now(),
          sec:"simulator",session:sid,qid:"sim:"+sid,qtype:turn.skill||"reply",
          ref:w.id,kap:"SIM",ok:false,tries:1,hint:SIM.hintCount>0}),{counted:true});
      }
    }catch(e){}
    S.totalAnswered=(S.totalAnswered||0)+1;
    save();
  }catch(e){}
}
function simRecordSuccess(turn){
  try{
    S.totalAnswered=(S.totalAnswered||0)+1;
    S.totalCorrect=(S.totalCorrect||0)+1;
    save();
  }catch(e){}
}
/* Soft tracking: article/grammar slip inside an otherwise successful answer.
   Recorded into mistakes + weak skills (feeds SRS/Smart Training) WITHOUT
   touching totals or blocking progress — communication stays first at A1. */
function simRecordSoft(sid, turn, answer, note){
  try{
    var s=ensureSim();
    s.weak[turn.skill||"allgemein"]=(s.weak[turn.skill||"allgemein"]||0)+1;
    var w={id:"sim:"+sid+":"+simNorm(turn.model).slice(0,24),de:turn.model,ar:(turn.modelAr||"")+(note?" ["+note+"]":""),
      art:"-",type:"محادثة",cat:"General",kap:"SIM",skill:turn.skill||"allgemein"};
    try{recordMistake(w,(answer||"")+" ~ "+(note||""),"simulator",{q:turn.npc.de,ok:turn.model,kap:"SIM"});}catch(e){}
    save();
  }catch(e){}
}

/* ================= RENDER: world / map ================= */
function renderSim(){
  ensureSim();
  SIM.phase="map";SIM.sid=null;
  var box=$("simBox");if(!box)return;
  var p=simProgress();
  var h='<div class="panel glass"><div class="muted">🇩🇪 DEUTSCHLAND LIFE SIMULATOR</div>'
    +'<h3>🇩🇪 Deutschland Life</h3><div class="muted">محاكاة الحياة في ألمانيا</div>'
    +'<p class="muted">Lerne Deutsch nicht nur. Lebe Deutsch. — شاهِد الحوار أولًا، افهمه، تدرّب، ثم اختبر نفسك.</p>'
    +'<div class="muted">'+p.dn+' / '+p.total+' Szenarien • 🗣️ '+p.speaking+'% • 👂 '+p.listening+'% • 💬 '+p.comm+'% • 🔥 '+p.streak+' Tage</div>'
    +'<div class="progress"><div class="progress-fill" style="width:'+p.pct+'%"></div></div>'
    +'<div class="row-flex"><button class="btn btn-ghost sm" id="simBadges">🏆 الأوسمة</button></div></div>';
  h+='<div class="grid-2">';
  SIM_SCENARIOS.forEach(function(sc,idx){
    var s=ensureSim();
    var done=!!s.done[sc.id],demo=!!s.demo[sc.id];
    var best=s.best[sc.id];
    var locked=idx>1&&!s.done[SIM_SCENARIOS[idx-2].id]&&!done;
    h+='<div class="panel glass"><h4>'+sc.icon+' '+escapeHtml(sc.title)+'</h4>'
      +'<div class="muted">'+escapeHtml(sc.arTitle)+' • '+escapeHtml(sc.locationAr)+' • A1 '+(done?"✅":demo?"👀":"")+(locked?" 🔒":"")+'</div>'
      +'<div class="muted">'+escapeHtml(sc.situationAr)+'</div>'
      +(best?'<div class="muted">💬 '+best.comm+'% • 🗣️ '+best.speaking+'%</div>':"")
      +'<div class="row-flex"><button class="btn btn-primary sm" data-sim="'+sc.id+'">'
      +(done?"مراجعة 🔁":demo?"أكمل ←":"ابدأ 👀")+'</button></div></div>';
  });
  h+='</div><div class="muted">🎯 الأخطاء تعود في سيناريوهات لاحقة: النظام يرشّح لك المواقف التي تحتوي نقاط ضعفك.</div><div id="simBody"></div>';
  box.innerHTML=h;
  var bb=$("simBadges");
  if(bb)bb.addEventListener("click",renderSimBadges);
  box.querySelectorAll("[data-sim]").forEach(function(b){
    b.addEventListener("click",function(){openSimScenario(b.getAttribute("data-sim"));});
  });
  renderSimSuggest();
}
function renderSimSuggest(){
  try{
    ensureSim();
    var s=S.sim,weak=Object.keys(s.weak||{}).sort(function(a,b){return (s.weak[b]||0)-(s.weak[a]||0);})[0];
    if(!weak)return;
    var hit=SIM_SCENARIOS.filter(function(sc){return !s.done[sc.id]&&sc.turns.some(function(tn){return tn.skill===weak;});})[0];
    if(!hit)return;
    var el=$("simBody");if(!el)return;
    var d=document.createElement("div");
    d.className="panel glass";
    d.innerHTML='<div class="muted">🎯 تدريب مقترح لنقطة ضعفك ('+escapeHtml(weak)+'): <b>'+hit.icon+' '+escapeHtml(hit.title)+'</b></div>'
      +'<div class="row-flex"><button class="btn btn-gold sm" id="simSugGo">ابدأ التدريب المقترح</button></div>';
    el.appendChild(d);
    var g=$("simSugGo");if(g)g.addEventListener("click",function(){openSimScenario(hit.id);});
  }catch(e){}
}
function renderSimBadges(){
  var s=ensureSim();
  var h='<div class="panel glass" style="text-align:center"><h3>🏆 الأوسمة</h3><div class="ach-grid">'
    +SIM_BADGES.map(function(b){
      var got=!!s.badges[b.id];
      return '<div class="ach-card '+(got?"done":"locked")+'"><div style="font-size:28px">'+(got?b.icon:"🔒")+'</div><b>'+escapeHtml(b.t)+'</b><div class="muted">'+escapeHtml(b.ar)+'</div></div>';
    }).join("")+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="simBBack">🗺️ رجوع</button></div></div>';
  $("simBox").innerHTML=h;
  $("simBBack").addEventListener("click",renderSim);
}

/* ================= phase indicator ================= */
function simSteps(active){
  var steps=[["watch","👀","مشاهدة"],["practice","🧠","تدريب"],["test","🎤","اختبار"],["results","📊","النتيجة"]];
  return '<div class="row-flex sim-steps">'+steps.map(function(s){
    return '<span class="tag'+(s[0]===active?" sim-active":"")+'">'+s[1]+' '+s[2]+'</span>';
  }).join("")+'</div>';
}
function simShell(sc, active, inner){
  return simSteps(active)
    +'<div class="panel glass"><div class="muted">'+sc.icon+' '+escapeHtml(sc.title)+' • '+escapeHtml(sc.arTitle)+' • 🧑‍🦰 '+escapeHtml(sc.npc.name)+'</div>'
    +'<div class="muted">'+escapeHtml(sc.situationAr)+'</div></div>'+inner
    +'<div class="row-flex"><button class="btn btn-ghost sm" id="simExit">🗺️ الخريطة</button></div>';
}
function simBindExit(){var b=$("simExit");if(b)b.addEventListener("click",renderSim);}

/* ================= STEP 1: WATCH / LEARN (demonstration) ================= */
function openSimScenario(sid){
  var sc=simScenario(sid);if(!sc)return;
  ensureSim();
  SIM.sid=sid;SIM.phase="watch";SIM.turnIdx=0;SIM.results=[];SIM.practiced=false;SIM.hintCount=0;SIM.retries=0;
  renderSimWatch(sc);
  try{$("simBox").scrollIntoView({behavior:"smooth"});}catch(e){}
}
function renderSimWatch(sc){
  SIM.phase="watch";
  var box=$("simBox");
  var inner='<div class="panel glass"><h3>👀 شاهِد الحوار الكامل أولًا</h3>'
    +'<div class="muted">استمع لكل جملة. اضغط أي عبارة مميزة لترى معناها. هذه مشاهدة — وليست اختبارًا.</div>'
    +'<div class="row-flex">'
    +'<button class="btn btn-primary sm" id="simPlayAll">▶️ تشغيل الحوار كاملًا</button>'
    +'<button class="btn btn-ghost sm" id="simTglDe">🇩🇪 '+(SIM.showDe?"إخفاء":"إظهار")+' الألمانية</button>'
    +'<button class="btn btn-ghost sm" id="simTglAr">🇦🇪 '+(SIM.showAr?"إخفاء":"إظهار")+' العربية</button>'
    +'</div><div id="simDlg">'
    +sc.dialogue.map(function(line,i){
      var who=line.by==="npc"?"🧑‍🦰 "+escapeHtml(sc.npc.name):"🙂 أنت";
      var ph=(line.phrases||[]).map(function(p,j){
        return '<button class="mini-btn sim-phrase" data-i="'+i+'" data-j="'+j+'">💡 '+escapeHtml(p.de)+'</button>';
      }).join(" ");
      return '<div class="ex-de"><div class="ex-de-l">'+who+' '+simAudioBtn(line.de,false)
        +' <button class="mini-btn sim-audio" data-say="'+escapeHtml(line.de)+'" data-slow="1" title="بطيء">🐢</button>'
        +'<div class="sim-de"'+(SIM.showDe?"":' style="display:none"')+'>'+escapeHtml(line.de)+'</div></div>'
        +'<div class="ex-ar sim-ar"'+(SIM.showAr?"":' style="display:none"')+'>'+escapeHtml(line.ar)+'</div>'
        +(ph?'<div class="muted">'+ph+'</div>':"")
        +'<div class="muted sim-ph" id="simPh'+i+'"></div></div>';
    }).join("")+'</div>'
    +'<div class="row-flex"><button class="btn btn-gold sm" id="simToCheck">هل فهمت الحوار؟ ←</button></div></div>';
  box.innerHTML=simShell(sc,"watch",inner);
  simBindAudio(box);simBindExit();
  box.querySelectorAll(".sim-phrase").forEach(function(b){
    b.addEventListener("click",function(e){
      e.stopPropagation();
      var line=sc.dialogue[parseInt(b.getAttribute("data-i"),10)];
      var p=line.phrases[parseInt(b.getAttribute("data-j"),10)];
      var el=$("simPh"+b.getAttribute("data-i"));
      if(el)el.innerHTML='<b>'+escapeHtml(p.de)+'</b> = '+escapeHtml(p.ar)+'<br><span class="muted">'+escapeHtml(p.tip)+'</span> '+simAudioBtn(p.de,false);
      simBindAudio(box);
    });
  });
  $("simTglDe").addEventListener("click",function(){SIM.showDe=!SIM.showDe;renderSimWatch(sc);});
  $("simTglAr").addEventListener("click",function(){SIM.showAr=!SIM.showAr;renderSimWatch(sc);});
  $("simPlayAll").addEventListener("click",function(){
    var i=0;
    function next(){
      if(i>=sc.dialogue.length)return;
      simSpeak(sc.dialogue[i].de,false);i++;setTimeout(next,2600);
    }
    next();
    try{toast("▶️ يلعب الحوار كاملًا...","ok");}catch(e){}
  });
  $("simToCheck").addEventListener("click",function(){renderSimCheckpoint(sc);});
}

/* ================= "I UNDERSTAND" CHECKPOINT (explicit gate) ================= */
function renderSimCheckpoint(sc){
  var box=$("simBox");
  var inner='<div class="panel glass" style="text-align:center"><h3>هل فهمت الحوار؟ 🤔</h3>'
    +'<div class="muted">لا يبدأ التدريب تلقائيًا — أنت تختار متى تكمل.</div>'
    +'<div class="row-flex"><button class="btn btn-green sm" id="simUnderstood">✅ فهمت، ابدأ التدريب</button>'
    +'<button class="btn btn-ghost sm" id="simRewatch">🔁 شاهد الحوار مرة أخرى</button></div></div>';
  box.innerHTML=simShell(sc,"watch",inner);
  simBindExit();
  $("simRewatch").addEventListener("click",function(){renderSimWatch(sc);});
  $("simUnderstood").addEventListener("click",function(){
    try{ensureSim().demo[sc.id]=1;save();}catch(e){}
    renderSimPractice(sc,0);
  });
}

/* ================= STEP 2: PRACTICE (guided, with hints) ================= */
function renderSimPractice(sc, idx){
  SIM.phase="practice";
  if(idx>=sc.turns.length){
    SIM.practiced=true;
    renderSimTestGate(sc);
    return;
  }
  var tn=sc.turns[idx],lvl=simSupportLevel(sc.id);
  var box=$("simBox");
  var showAr=lvl<=2,showHint=lvl<=3;
  var chips=(tn.chips||[]).map(function(c){return '<button class="mini-btn sim-chip">'+escapeHtml(c)+'</button>';}).join(" ");
  var inner='<div class="panel glass"><div class="muted">🧠 تدريب موجّه — خطوة '+(idx+1)+'/'+sc.turns.length+' (مستوى الدعم '+lvl+'/5)</div>'
    +'<div class="talk-bot">🧑‍🦰 '+escapeHtml(tn.npc.de)+' '+simAudioBtn(tn.npc.de,false)
    +(showAr?'<div class="muted">'+escapeHtml(tn.npc.ar)+'</div>':'<div class="muted">🎧 استمع جيدًا...</div>')+'</div>'
    +(showHint?'<div class="muted">💡 تلميح: <b>'+escapeHtml(tn.hint)+'</b>'+(lvl<=1&&tn.hintAr?' — '+escapeHtml(tn.hintAr):"")+'</div>'
      +'<div class="muted">🧩 كلمات مساعدة: '+chips+'</div>':"")
    +'<div class="muted">🎯 النموذج مخفي جزئيًا — ركّب الجملة بنفسك:</div>'
    +'<div class="quiz-write"><input type="text" id="simPrIn" autocomplete="off" placeholder="Antwort auf Deutsch...">'
    +'<button class="btn btn-primary sm mic-btn" id="simPrMic">🎙️</button>'
    +'<button class="btn btn-gold sm" id="simPrOk">تحقق ✅</button></div>'
    +'<div class="quiz-feedback hidden" id="simPrFb"></div>'
    +'<div class="muted">النموذج الصحيح: <button class="btn btn-ghost sm" id="simPrShow">إظهار 👀</button> <span id="simPrModel"></span></div></div>';
  box.innerHTML=simShell(sc,"practice",inner);
  simBindAudio(box);simBindExit();
  setTimeout(function(){simSpeak(tn.npc.de,false);},350);
  box.querySelectorAll(".sim-chip").forEach(function(c){
    c.addEventListener("click",function(e){
      e.stopPropagation();
      var inp=$("simPrIn");
      inp.value=(inp.value?inp.value+" ":"")+c.textContent;
      try{inp.focus();}catch(e2){}
    });
  });
  try{startMic($("simPrMic"),$("simPrIn"),$("simPrFb"),function(){try{toast("🎤 سمعتك — اضغط تحقق","ok");}catch(e){}});}catch(e){}
  var sh=$("simPrShow");
  if(sh)sh.addEventListener("click",function(){
    $("simPrModel").innerHTML='<b>'+escapeHtml(tn.model)+'</b> = '+escapeHtml(tn.modelAr)+' '+simAudioBtn(tn.model,false);
    simBindAudio(box);
  });
  $("simPrOk").addEventListener("click",function(){
    var v=$("simPrIn").value.trim(),fb=$("simPrFb");
    fb.classList.remove("hidden");
    if(v.length<2){fb.className="quiz-feedback no";fb.textContent="اكتب أو قل ردًا أولًا.";return;}
    tn.last=v;
    var g=simGrade(v,tn);
    if(g.ok){
      fb.className="quiz-feedback ok";
      fb.textContent="✅ أحسنت! ("+g.vocab+"%) النموذج: "+tn.model;
      simRecordSuccess(tn);
      if(g.artIssue){try{simRecordSoft(sc.id,tn,v,"Artikel: "+(g.missArt||[]).join("/"));}catch(e){}
        fb.textContent+=" ⚠️ انتبه للأداة: "+tn.model+" (سُجّلت للمراجعة).";}
      setTimeout(function(){renderSimPractice(sc,idx+1);},2200);
    }else{
      var rep=simRepair(tn,g);
      fb.className="quiz-feedback no";
      fb.textContent="🤔 "+rep.npc+" "+rep.tip+" (تطابق: "+g.vocab+"%) — حاول مرة أخرى، النموذج متاح بزر الإظهار.";
      simRecordMistake(sc.id,tn,v);
      simSpeak(rep.npc,false);
    }
  });
}

/* ---- gate: practice done -> explicit entry to the real test ---- */
function renderSimTestGate(sc){
  var box=$("simBox");
  var inner='<div class="panel glass" style="text-align:center"><h3>🎤 جاهز للاختبار الحقيقي؟</h3>'
    +'<div class="muted">في الاختبار: <b>بدون نموذج الإجابة</b>، وبدون تلميحات تلقائية. زر 🆘 مساعدة يعطي تلميحًا صغيرًا فقط.</div>'
    +'<div class="row-flex"><button class="btn btn-primary sm" id="simStartTest">🎤 ابدأ الاختبار</button>'
    +'<button class="btn btn-ghost sm" id="simPracAgain">🔁 تدريب مرة أخرى</button></div></div>';
  box.innerHTML=simShell(sc,"practice",inner);
  simBindExit();
  $("simPracAgain").addEventListener("click",function(){renderSimPractice(sc,0);});
  $("simStartTest").addEventListener("click",function(){renderSimTest(sc,0);});
}

/* ================= STEP 3: TEST (model answer hidden, voice-first) ================= */
function renderSimTest(sc, idx){
  SIM.phase="test";
  if(idx>=sc.turns.length){renderSimResults(sc);return;}
  var s=ensureSim();
  if(!s.demo[sc.id]||!SIM.practiced){
    renderSimPractice(sc,0);return; /* hard gate: never test before watch+practice */
  }
  var tn=sc.turns[idx],lvl=simSupportLevel(sc.id);
  var box=$("simBox");
  var inner='<div class="panel glass"><div class="muted">🎤 اختبار — موقف '+(idx+1)+'/'+sc.turns.length+' (مستوى '+lvl+'/5 — '+(lvl>=4?"بدون تلميحات، كالحياة الحقيقية":"دعم خفيف")+')</div>'
    +'<div class="talk-bot">🧑‍🦰 '+escapeHtml(tn.npc.de)+' '+simAudioBtn(tn.npc.de,false)
    +(lvl<=2?'<div class="muted">'+escapeHtml(tn.npc.ar)+'</div>':"")+'</div>'
    +'<div class="muted">🎤 اضغط وتحدث بالألمانية:</div>'
    +'<div class="quiz-write"><input type="text" id="simTsIn" autocomplete="off" placeholder="Sprich oder schreibe...">'
    +'<button class="btn btn-primary sm mic-btn" id="simTsMic">🎤 تحدث</button>'
    +'<button class="btn btn-gold sm" id="simTsOk">إرسال ✅</button></div>'
    +'<div class="quiz-feedback hidden" id="simTsFb"></div>'
    +'<div class="row-flex"><button class="btn btn-ghost sm" id="simHelp">🆘 مساعدة</button>'
    +'<button class="btn btn-ghost sm" id="simNoUnd">❓ لم أفهم</button></div>'
    +'<div class="muted" id="simHelpOut"></div></div>';
  box.innerHTML=simShell(sc,"test",inner);
  simBindAudio(box);simBindExit();
  setTimeout(function(){simSpeak(tn.npc.de,false);},350);
  var micBtn=$("simTsMic");
  try{startMic(micBtn,$("simTsIn"),$("simTsFb"),function(){try{toast("🔴 Aufnahme... تم الالتقاط","ok");}catch(e){}});}catch(e){
    if(micBtn)micBtn.addEventListener("click",function(){try{toast("المايك غير مدعوم — اكتب ⌨️","err");}catch(e2){}});
  }
  var helpN=0;
  $("simHelp").addEventListener("click",function(e){
    e.stopPropagation();
    helpN++;SIM.hintCount++;save();
    var out=$("simHelpOut");
    if(helpN===1)out.innerHTML='💡 تلميح صغير: ابدأ بـ <b>'+escapeHtml(tn.hint)+'</b>';
    else if(helpN===2)out.innerHTML='💡 كلمات: '+tn.chips.slice(0,3).map(escapeHtml).join(" • ");
    else out.innerHTML='💡 النموذج (استخدام المساعدة يخفض درجتك قليلًا): <b>'+escapeHtml(tn.model)+'</b>';
  });
  $("simNoUnd").addEventListener("click",function(e){
    e.stopPropagation();
    var p=SIM_SURVIVAL[Math.floor(Math.random()*SIM_SURVIVAL.length)];
    $("simHelpOut").innerHTML='🆘 قل: <b>'+escapeHtml(p.de)+'</b> = '+escapeHtml(p.ar)+'<br><span class="muted">'+escapeHtml(p.tip)+'</span> '+simAudioBtn(p.de,false);
    simBindAudio(box);
    simSpeak(p.de,false);
  });
  $("simTsOk").addEventListener("click",function(){
    var v=$("simTsIn").value.trim(),fb=$("simTsFb");
    fb.classList.remove("hidden");
    if(v.length<2){fb.className="quiz-feedback no";fb.textContent="تحدث أو اكتب إجابة أولًا — أو اضغط ❓ لم أفهم.";return;}
    tn.last=v;
    var g=simGrade(v,tn);
    var ev={vocab:g.vocab,missing:g.missing};
    try{if(typeof evaluateSpoken==="function")ev=evaluateSpoken(v,tn.model);}catch(e){}
    var rec={comm:g.comm,vocab:ev.vocab!==undefined?ev.vocab:g.vocab,gram:g.gram,listening:90,speaking:Math.min(100,Math.max(0,g.vocab-(helpN*10)))};
    SIM.results.push(rec);
    if(g.ok){
      fb.className="quiz-feedback ok";
      fb.textContent="✅ "+simNpcReplyText(sc,tn)+" ("+g.vocab+"%)";
      try{simSpeak(simNpcReplyText(sc,tn),false);}catch(e){}
      simRecordSuccess(tn);
      if(g.artIssue){try{simRecordSoft(sc.id,tn,v,"Artikel: "+(g.missArt||[]).join("/"));}catch(e){}
        fb.textContent+=" ⚠️ Artikel: "+(g.missArt||[]).join("/")+" — "+tn.model;}
      setTimeout(function(){renderSimTest(sc,idx+1);},2600);
    }else{
      SIM.retries++;
      var rep=simRepair(tn,g);
      fb.className="quiz-feedback no";
      fb.innerHTML='🧑‍🦰 '+escapeHtml(rep.npc)+'<br>'+escapeHtml(rep.tip)+'<br><span class="muted">حاول مرة أخرى — أو اضغط 🆘.</span>';
      simSpeak(rep.npc,false);
      simRecordMistake(sc.id,tn,v);
    }
  });
}
function simNpcReplyText(sc, tn){
  var i=sc.turns.indexOf(tn);
  var dlg=sc.dialogue.filter(function(l){return l.by==="npc";});
  return (dlg[Math.min(i+1,dlg.length-1)]||{de:"Gern!"}).de;
}
/* npc reply text for the talk-bot: the NPC's next line, or a generic close. */

/* ================= STEP 4: RESULTS ================= */
function renderSimResults(sc){
  SIM.phase="results";
  var s=ensureSim();
  var R=SIM.results.length?SIM.results:[{comm:0,vocab:0,gram:0,listening:0,speaking:0}];
  function avg(k){return Math.round(R.reduce(function(a,r){return a+(r[k]||0);},0)/R.length);}
  var res={comm:avg("comm"),vocab:avg("vocab"),gram:avg("gram"),listening:avg("listening"),speaking:avg("speaking")};
  var prev=s.best[sc.id];
  var isBest=!prev||res.comm>(prev.comm||0);
  if(isBest)s.best[sc.id]=res;
  s.done[sc.id]={date:(function(){try{return todayStr();}catch(e){return "";}})(),comm:res.comm};
  try{
    var n=(s.att[sc.id]||0)+1;s.att[sc.id]=n;
    addXP(60,"simulator");earnCoins(15,"simulator");markStudyDay();checkAch();
    simCheckBadges();save();
  }catch(e){}
  var weakSkills=Object.keys(s.weak||{}).sort(function(a,b){return (s.weak[b]||0)-(s.weak[a]||0);}).slice(0,3);
  var box=$("simBox");
  var bar=function(v){return '<div class="progress sm"><div class="progress-fill" style="width:'+v+'%"></div></div>';};
  var inner='<div class="panel glass" style="text-align:center"><h3>🎯 Deine Ergebnisse</h3>'
    +'<div class="muted">'+sc.icon+' '+escapeHtml(sc.title)+'</div>'
    +'<div>💬 Communication: <b>'+res.comm+'%</b></div>'+bar(res.comm)
    +'<div>📚 Vocabulary: <b>'+res.vocab+'%</b></div>'+bar(res.vocab)
    +'<div>📐 Grammar: <b>'+res.gram+'%</b></div>'+bar(res.gram)
    +'<div>👂 Listening: <b>'+res.listening+'%</b></div>'+bar(res.listening)
    +'<div>🗣️ Speaking: <b>'+res.speaking+'%</b></div>'+bar(res.speaking)
    +(isBest?'<div class="quiz-feedback ok">🏆 أفضل نتيجة لك!</div>':"")
    +(weakSkills.length?'<div class="muted">أكثر ما تحتاج مراجعته: '+weakSkills.map(function(w){return "⚠️ "+escapeHtml(w);}).join(" • ")+'</div>':"")
    +'<div class="muted">⭐+60 XP • 🪙+15 • تلميحات مستخدمة: '+SIM.hintCount+' • إعادات: '+SIM.retries+'</div>'
    +'<div class="row-flex"><button class="btn btn-primary sm" id="simToReview">🔁 مراجعة الأخطاء</button>'
    +'<button class="btn btn-gold sm" id="simToPractice">🎯 تدريب ذكي</button>'
    +'<button class="btn btn-ghost sm" id="simAgain">🔁 إعادة السيناريو</button></div></div>';
  box.innerHTML=simShell(sc,"results",inner);
  simBindExit();
  $("simToReview").addEventListener("click",function(){renderSimReview(sc);});
  $("simAgain").addEventListener("click",function(){openSimScenario(sc.id);});
  $("simToPractice").addEventListener("click",function(){showPage("practice");});
}

/* ================= STEP 5: REVIEW MISTAKES ================= */
function renderSimReview(sc){
  var s=ensureSim();
  var box=$("simBox");
  var items=sc.turns.map(function(tn,i){
    var r=SIM.results[i];
    var bad=r&&r.vocab<60;
    return {tn:tn,r:r,bad:!!bad};
  });
  var inner='<div class="panel glass"><h3>🔁 مراجعة الأخطاء</h3>'
    +items.map(function(it,i){
      return '<div class="ex-de"><div class="ex-de-l">'+(it.bad?"❌":"✅")+' '+escapeHtml(it.tn.npc.de)+' '+simAudioBtn(it.tn.npc.de,false)+'</div>'
        +'<div class="ex-ar">'+escapeHtml(it.tn.npc.ar)+'</div>'
        +'<div class="muted">إجابتك: '+(it.tn.last?escapeHtml(it.tn.last):"—")+' → الأفضل: <b>'+escapeHtml(it.tn.model)+'</b> '+simAudioBtn(it.tn.model,false)+'</div>'
        +(it.tn.grammar?'<div class="muted">📐 '+escapeHtml(it.tn.grammar)+' — '+escapeHtml(it.tn.grammarAr||"")+'</div>':"")
        +'</div>';
    }).join("")
    +'<div class="muted">💡 أُرسلت أخطاؤك إلى <b>أخطائي + المراجعة الذكية (SRS) + التدريب الذكي</b> — ستعود هذه المفاهيم في سيناريوهات قادمة.</div>'
    +'<div class="row-flex"><button class="btn btn-primary sm" id="simRevMist">❌ افتح أخطائي</button>'
    +'<button class="btn btn-gold sm" id="simRevGo">🧠 ابدأ المراجعة</button></div></div>';
  box.innerHTML=simShell(sc,"results",inner);
  simBindAudio(box);simBindExit();
  $("simRevMist").addEventListener("click",function(){showPage("mistakes");});
  $("simRevGo").addEventListener("click",function(){showPage("review");});
}

/* ---------- dashboard widget (idempotent, additive) ---------- */
function renderSimWidget(){
  try{
    ensureSim();
    var host=$("dashLearn");if(!host)return;
    var w=$("simWidget");
    if(!w){w=document.createElement("div");w.id="simWidget";w.className="panel glass reveal";host.parentNode.insertBefore(w,host.nextSibling);}
    var p=simProgress();
    w.innerHTML='<h3>🇩🇪 محاكاة الحياة في ألمانيا</h3>'
      +'<div class="muted">Lerne Deutsch nicht nur. Lebe Deutsch. — '+p.dn+'/'+p.total+' ('+p.pct+'%) • 💬 '+p.comm+'%</div>'
      +'<div class="progress"><div class="progress-fill" style="width:'+p.pct+'%"></div></div>'
      +'<div class="row-flex"><button class="btn btn-primary sm" id="simWGo">🇩🇪 ادخل المحاكاة</button></div>';
    var g=$("simWGo");if(g)g.addEventListener("click",function(){showPage("simulator");});
  }catch(e){}
}

/* ---------- wiring (same pattern as life/dlife/mygermany) ---------- */
var SIM_PAGES={simulator:renderSim};
(function(){
  try{
    if(typeof showPage==="function"){
      var _sp=showPage;
      showPage=function(n){_sp(n);try{if(SIM_PAGES[n]&&!(window.DMPageState&&DMPageState.skipRender&&DMPageState.skipRender(n)))SIM_PAGES[n]();if(n==="dashboard")renderSimWidget();}catch(e){console.error(e);}};
    }
    if(typeof renderDashboard==="function"){
      var _rd=renderDashboard;
      renderDashboard=function(){_rd();try{renderSimWidget();}catch(e){}};
    }
    if(typeof S!=="undefined")ensureSim();
  }catch(e){console.error(e);}
})();
