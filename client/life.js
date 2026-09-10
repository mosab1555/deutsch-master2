/* Deutsch Life — interactive German world. Reuses: REAL_SITS/SURV_EXTRA (learn.js
   data), TALK flows, speakGerman/startMic, XP/coins/achievements (play/learn),
   SRS (study.js), GRAMMAR explain, word system. No backend. No eval. */
"use strict";
function ensureLife(){
  if(!S.life)S.life={missions:{},euro:100,career:null,stamps:{},dailyMiss:null,areas:{}};
  if(S.life.euro==null)S.life.euro=100;
  if(!S.life.missions)S.life.missions={};
  if(!S.life.stamps)S.life.stamps={};
  if(!S.life.areas)S.life.areas={};
}
function lifeSit(id){
  try{
    let s=(typeof REAL_SITS!=="undefined")?REAL_SITS.find(x=>x.id===id):null;
    if(!s&&(typeof SURV_EXTRA!=="undefined"))s=SURV_EXTRA.find(x=>x.id===id);
    return s||null;
  }catch(e){return null;}
}
/* 12 locations, tiers unlock progressively (entry always allowed) */
const LIFE_LOCS=[
{id:"home",icon:"🏠",t:"Home",ar:"البيت",tier:"A1",sit:"home",x:50,y:82},
{id:"shop",icon:"🛒",t:"Supermarket",ar:"السوبرماركت",tier:"A1",sit:"supermarkt",x:28,y:64},
{id:"rest",icon:"🍽️",t:"Restaurant",ar:"المطعم",tier:"A1",sit:"rest",x:16,y:48},
{id:"station",icon:"🚆",t:"Train Station",ar:"محطة القطار",tier:"A1",sit:"train",x:50,y:52},
{id:"bank",icon:"🏦",t:"Bank",ar:"البنك",tier:"A2",sit:null,x:72,y:38},
{id:"hotel",icon:"🏨",t:"Hotel",ar:"الفندق",tier:"A2",sit:"hotel",x:22,y:30},
{id:"doc",icon:"🏥",t:"Hospital",ar:"المستشفى",tier:"A2",sit:"apotheke",x:82,y:56},
{id:"school",icon:"🏫",t:"School",ar:"المدرسة",tier:"A2",sit:"uni",x:50,y:22},
{id:"work",icon:"💼",t:"Workplace",ar:"الشغل",tier:"B1",sit:"work",x:78,y:74},
{id:"interview",icon:"🧑‍💼",t:"Job Interview",ar:"مقابلة العمل",tier:"B1",sit:"bewerbung",x:62,y:88},
{id:"jobcenter",icon:"🏢",t:"Job Center",ar:"مكتب العمل",tier:"B1",sit:null,x:36,y:90},
{id:"city",icon:"🏙️",t:"City Center",ar:"وسط المدينة",tier:"B1",sit:"markt",x:50,y:40}];
/* Missions. Steps: listen{line}|reply{prompt,promptAr,ok,bad[],why,gid}|vocab{wi}|price{items,ask}|grammar{gid} */
const LIFE_MISSIONS=[
{id:"m-home-1",loc:"home",title:"صباح في البيت",obj:"ابدأ يومك بالألمانية.",xp:60,coins:10,sit:"home",focus:"greetings",steps:[
 {r:"listen",line:0},{r:"reply",prompt:"Guten Morgen! Wie geht es dir?",promptAr:"صباح الخير! كيف حالك؟",ok:"Danke, gut! Und dir?",bad:["Ich bin 20 Jahre alt.","Die Tür ist groß."],why:"الرد على التحية بسؤال مماثل."},{r:"vocab",wi:0},{r:"vocab",wi:1}]},
{id:"m-home-2",loc:"home",title:"الفطور",obj:"اطلب فطورك.",xp:60,coins:10,sit:"home",focus:"food",steps:[
 {r:"vocab",wi:2},{r:"reply",prompt:"Möchtest du Kaffee?",promptAr:"هل تريد قهوة؟",ok:"Ja, gern.",bad:["Ich wohne hier.","Nein, ich bin der Tisch."],why:"نعم + gern للموافقة."},{r:"listen",line:1},{r:"grammar",gid:"g16"}]},
{id:"m-shop-1",loc:"shop",title:"اشترِ الفطور",obj:"اشترِ خبزًا وحليبًا.",xp:80,coins:12,sit:"supermarkt",focus:"numbers",steps:[
 {r:"listen",line:0},{r:"vocab",wi:0},{r:"price",items:[["das Brot",2.5],["die Milch",1.8]],ask:"Brot + Milch = ?"},{r:"reply",prompt:"Sonst noch etwas?",promptAr:"شيء آخر؟",ok:"Nein, danke. Das ist alles.",bad:["Ja, ich bin müde.","Wo ist Berlin?"],why:"النفي المهذب + das ist alles."}]},
{id:"m-shop-2",loc:"shop",title:"أين الحليب؟",obj:"اسأل عن مكان منتج.",xp:60,coins:10,sit:"supermarkt",focus:"fragen",steps:[
 {r:"reply",prompt:"Kann ich helfen?",promptAr:"هل أساعدك؟",ok:"Ja. Wo ist die Milch?",bad:["Ich bin 30.","Gute Nacht!"],why:"السؤال بـ Wo عن المكان."},{r:"vocab",wi:1},{r:"listen",line:2},{r:"grammar",gid:"g10"}]},
{id:"m-rest-1",loc:"rest",title:"احجز طاولة",obj:"ادخل المطعم واحجز.",xp:80,coins:12,sit:"rest",focus:"polite",steps:[
 {r:"listen",line:0},{r:"reply",prompt:"Haben Sie reserviert?",promptAr:"هل حجزت؟",ok:"Nein, einen Tisch für zwei.",bad:["Ich bin 19 Jahre alt.","Heute ist Montag."],why:"الإجابة المباشرة بالنفي + الطلب."},{r:"vocab",wi:0},{r:"grammar",gid:"g20"}]},
{id:"m-rest-2",loc:"rest",title:"اطلب والحساب",obj:"اطلب وادفع €18.",xp:100,coins:15,sit:"rest",focus:"numbers",steps:[
 {r:"reply",prompt:"Was möchten Sie bestellen?",promptAr:"ماذا تريد أن تطلب؟",ok:"Ich möchte eine Pizza.",bad:["Ich wohne in Berlin.","Das ist mein Bruder."],why:"Ich möchte + Akkusativ للطلب."},{r:"price",items:[["die Pizza",12],["das Wasser",3],["der Salat",3]],ask:"Pizza + Wasser + Salat = ?"},{r:"reply",prompt:"Zusammen oder getrennt?",promptAr:"معًا أم منفصل؟",ok:"Zusammen, bitte.",bad:["Ich bin krank.","Im Bett!"],why:"zusammen = معًا."},{r:"listen",line:3}]},
{id:"m-station-1",loc:"station",title:"تذكرة إلى برلين",obj:"اشترِ تذكرة وسافر.",xp:100,coins:15,sit:"train",focus:"reisen",steps:[
 {r:"reply",prompt:"Wohin möchten Sie fahren?",promptAr:"إلى أين تريد السفر؟",ok:"Ich möchte nach Berlin.",bad:["Ich bin 19 Jahre alt.","Das ist mein Bruder."],why:"nach + مدينة للاتجاه."},{r:"vocab",wi:1},{r:"price",items:[["die Fahrkarte",40]],ask:"تذكرة واحدة = ?"},{r:"listen",line:3}]},
{id:"m-station-2",loc:"station",title:"أي رصيف؟",obj:"اعرف موعد قطارك.",xp:60,coins:10,sit:"train",focus:"time",steps:[
 {r:"reply",prompt:"Von welchem Bahnsteig?",promptAr:"من أي رصيف؟",ok:"Von Bahnsteig drei.",bad:["Um drei Euro.","Ich bin müde."],why:"الإجابة برقم الرصيف."},{r:"listen",line:0},{r:"vocab",wi:0},{r:"grammar",gid:"g26"}]},
{id:"m-bank-1",loc:"bank",title:"افتح حسابًا",obj:"افتح حسابًا بنكيًا.",xp:100,coins:15,sit:null,focus:"formal",steps:[
 {r:"reply",prompt:"Guten Tag! Was kann ich für Sie tun?",promptAr:"نهارك سعيد! كيف أساعدك؟",ok:"Ich möchte ein Konto eröffnen.",bad:["Ich bin 20.","Tschüs!"],why:"الطلب الرسمي بـ Ich möchte."},{r:"vocabB",voc:[["das Konto","الحساب"],["die Karte","البطاقة"],["der Kontostand","الرصيد"]]},{r:"reply",prompt:"Haben Sie einen Ausweis?",promptAr:"هل لديك هوية؟",ok:"Ja, hier ist mein Pass.",bad:["Nein, ich bin der Tisch.","Heute ist Montag."],why:"نعم + تقديم الهوية."},{r:"grammar",gid:"g13"}]},
{id:"m-bank-2",loc:"bank",title:"حوّل مبلغًا",obj:"حوّل €50.",xp:100,coins:15,sit:null,focus:"numbers",steps:[
 {r:"vocabB",voc:[["überweisen","يحوّل"],["der Betrag","المبلغ"],["das Geld","المال"]]},{r:"price",items:[["Überweisung",50]],ask:"تحويل 50 = ؟ (رصيدك €100)"},{r:"reply",prompt:"An wen?",promptAr:"إلى من؟",ok:"An meinen Bruder.",bad:["Nach Berlin.","Um 10 Uhr."],why:"an + Akkusativ للشخص."},{r:"listenB",de:"Die Überweisung ist fertig.",ar:"التحويل تم."}]},
{id:"m-bank-2",loc:"bank",title:"حوّل مبلغًا",obj:"حوّل €50.",xp:100,coins:15,sit:null,focus:"numbers",steps:[
 {r:"vocabB",voc:[["überweisen","يحوّل"],["der Betrag","المبلغ"],["das Geld","المال"]]},{r:"price",items:[["Überweisung",50]],ask:"تحويل 50 = ؟ (رصيدك €100)"},{r:"reply",prompt:"An wen?",promptAr:"إلى من؟",ok:"An meinen Bruder.",bad:["Nach Berlin.","Um 10 Uhr."],why:"an + Akkusativ للشخص."},{r:"listenB",de:"Die Überweisung ist fertig.",ar:"التحويل تم."}]},
{id:"m-hotel-1",loc:"hotel",title:"Check-in",obj:"احجز غرفة.",xp:100,coins:15,sit:"hotel",focus:"formal",steps:[
 {r:"listen",line:0},{r:"reply",prompt:"Wie lange bleiben Sie?",promptAr:"كم ستبقى؟",ok:"Drei Nächte.",bad:["Ich bin nett.","Prost!"],why:"الإجابة بمدة الإقامة."},{r:"vocab",wi:1},{r:"price",items:[["Zimmer pro Nacht",60],["Frühstück",10]],ask:"غرفة + فطور = ?"}]},
{id:"m-hotel-2",loc:"hotel",title:"مساعدة",obj:"اطلب مساعدة.",xp:60,coins:10,sit:"hotel",focus:"fragen",steps:[
 {r:"reply",prompt:"Kann ich helfen?",promptAr:"هل أساعدك؟",ok:"Wo ist mein Zimmer?",bad:["Ich bin 30.","Gute Nacht!"],why:"السؤال عن الغرفة."},{r:"vocab",wi:2},{r:"listen",line:2},{r:"grammar",gid:"g10"}]},
{id:"m-doc-1",loc:"doc",title:"احجز موعدًا",obj:"احجز عند الطبيب.",xp:80,coins:12,sit:"apotheke",focus:"health",steps:[
 {r:"reply",prompt:"Was fehlt Ihnen?",promptAr:"ما مشكلتك؟",ok:"Ich habe Kopfschmerzen.",bad:["Ich bin Lehrer.","Guten Appetit!"],why:"وصف العرض مباشرة."},{r:"vocab",wi:0},{r:"listen",line:1},{r:"grammar",gid:"g4"}]},
{id:"m-doc-2",loc:"doc",title:"في الصيدلية",obj:"اصرف الروشتة.",xp:60,coins:10,sit:"apotheke",focus:"health",steps:[
 {r:"vocab",wi:1},{r:"reply",prompt:"Wie oft?",promptAr:"كم مرة؟",ok:"Zweimal täglich.",bad:["Einmal Berlin.","Nie, danke."],why:"الجرعة: عدد + täglich."},{r:"listen",line:2},{r:"vocab",wi:2}]},
{id:"m-school-1",loc:"school",title:"أول يوم",obj:"تعارف في المدرسة.",xp:60,coins:10,sit:"uni",focus:"kennenlernen",steps:[
 {r:"listen",line:0},{r:"reply",prompt:"Bist du neu hier?",promptAr:"هل أنت جديد هنا؟",ok:"Ja, ich lerne Deutsch.",bad:["Nein, ich bin ein Tisch.","Heute ist Montag."],why:"نعم + ما تفعله."},{r:"vocab",wi:0},{r:"grammar",gid:"g4"}]},
{id:"m-school-2",loc:"school",title:"المحاضرة",obj:"اعرف موعد المحاضرة.",xp:60,coins:10,sit:"uni",focus:"time",steps:[
 {r:"reply",prompt:"Wann beginnt die Vorlesung?",promptAr:"متى تبدأ المحاضرة؟",ok:"Um neun Uhr.",bad:["Im Kino.","Zu Hause!"],why:"الوقت بـ um."},{r:"vocab",wi:2},{r:"listen",line:2},{r:"grammar",gid:"g26"}]},
{id:"m-work-1",loc:"work",title:"صباح العمل",obj:"ابدأ يوم العمل.",xp:80,coins:12,sit:"work",focus:"formal",steps:[
 {r:"listen",line:0},{r:"reply",prompt:"Ist Herr Schmidt da?",promptAr:"هل السيد شميدت موجود؟",ok:"Ja, im Büro.",bad:["Nein, ich bin müde.","Im Bett!"],why:"نعم + المكان."},{r:"vocab",wi:0},{r:"grammar",gid:"g15"}]},
{id:"m-work-2",loc:"work",title:"الاجتماع",obj:"احضر الاجتماع.",xp:80,coins:12,sit:"work",focus:"time",steps:[
 {r:"vocab",wi:2},{r:"reply",prompt:"Wann ist die Besprechung?",promptAr:"متى الاجتماع؟",ok:"Um zehn Uhr.",bad:["Ich bin krank.","Zu Hause!"],why:"الوقت بـ um."},{r:"listen",line:1},{r:"price",items:[["Kaffee fürs Team",8]],ask:"قهوة للفريق = ?"}]},
{id:"m-interview-1",loc:"interview",title:"عرّف بنفسك",obj:"اجتز أول سؤال.",xp:100,coins:15,sit:"bewerbung",focus:"vorstellen",steps:[
 {r:"reply",prompt:"Erzählen Sie etwas über sich.",promptAr:"حدثنا عن نفسك.",ok:"Ich heiße Omar. Ich bin zwanzig.",bad:["Tschüs!","Keine Ahnung."],why:"الاسم + العمر بداية قوية."},{r:"vocab",wi:0},{r:"listenB",de:"Sehr gut. Weiter.",ar:"جيد جدًا. أكمل."},{r:"grammar",gid:"g4"}]},
{id:"m-interview-2",loc:"interview",title:"لماذا نحن؟",obj:"أقنع المحاور.",xp:100,coins:15,sit:"bewerbung",focus:"motivation",steps:[
 {r:"reply",prompt:"Warum möchten Sie hier arbeiten?",promptAr:"لماذا تريد العمل هنا؟",ok:"Ich möchte lernen und arbeiten.",bad:["Geld!","Weiß nicht."],why:"الدافع المهني يقنع."},{r:"vocab",wi:3},{r:"reply",prompt:"Was sind Ihre Stärken?",promptAr:"ما نقاط قوتك؟",ok:"Ich bin pünktlich und fleißig.",bad:["Ich schlafe gern.","Nichts."],why:"صفتان إيجابيتان."},{r:"listenB",de:"Danke. Wir melden uns.",ar:"شكرًا. سنتصل بك."}]},
{id:"m-jobcenter-1",loc:"jobcenter",title:"ابحث عن عمل",obj:"سجّل في مكتب العمل.",xp:80,coins:12,sit:null,focus:"formal",steps:[
 {r:"vocabB",voc:[["die Stelle","الوظيفة"],["arbeitslos","عاطل"],["der Antrag","الطلب"]]},{r:"reply",prompt:"Was suchen Sie?",promptAr:"ماذا تبحث؟",ok:"Ich suche Arbeit.",bad:["Ich bin 20.","Tschüs!"],why:"الفعل suchen + العمل."},{r:"listenB",de:"Füllen Sie den Antrag aus.",ar:"املأ الطلب."},{r:"grammar",gid:"g15"}]},
{id:"m-jobcenter-2",loc:"jobcenter",title:"موعد المتابعة",obj:"احضر الموعد.",xp:60,coins:10,sit:null,focus:"time",steps:[
 {r:"reply",prompt:"Wann haben Sie Zeit?",promptAr:"متى لديك وقت؟",ok:"Am Montag um zehn.",bad:["Ich bin nett.","Prost!"],why:"اليوم + الساعة."},{r:"vocabB",voc:[["der Termin","الموعد"],["pünktlich","دقيق"]]},{r:"listenB",de:"Bis Montag!",ar:"إلى الاثنين!"},{r:"grammar",gid:"g26"}]},
{id:"m-city-1",loc:"city",title:"اسأل عن الطريق",obj:"صل إلى وسط المدينة.",xp:80,coins:12,sit:"markt",focus:"weg",steps:[
 {r:"reply",prompt:"Wo ist die Stadtmitte?",promptAr:"أين وسط المدينة؟",ok:"Geradeaus, dann links.",bad:["Ich bin 30.","Gute Nacht!"],why:"الاتجاهات: geradeaus/links."},{r:"vocab",wi:0},{r:"listen",line:2},{r:"grammar",gid:"g36"}]},
{id:"m-city-2",loc:"city",title:"جولة",obj:"اكتشف المدينة.",xp:60,coins:10,sit:"markt",focus:"entdecken",steps:[
 {r:"vocab",wi:2},{r:"reply",prompt:"Was ist das?",promptAr:"ما هذا؟",ok:"Das ist die Kirche.",bad:["Ich bin müde.","Keine Ahnung."],why:"Das ist + اسم."},{r:"listen",line:1},{r:"price",items:[["Stadtplan",3]],ask:"خريطة = ?"}]}
];
/* ---------- economy ---------- */
function euro(n){return "€"+(Math.round(n*100)/100).toFixed(2);}
function lifeEuro(){ensureLife();return S.life.euro;}
function lifeSpend(n){
  ensureLife();
  if(S.life.euro<n-1e-9)return false;
  S.life.euro=Math.round((S.life.euro-n)*100)/100;save();return true;
}
function lifeEarn(n){ensureLife();S.life.euro=Math.round((S.life.euro+n)*100)/100;save();}
/* ---------- mission engine ---------- */
function lifeMissions(loc){return LIFE_MISSIONS.filter(m=>m.loc===loc);}
function lifeLocDone(loc){
  const ms=lifeMissions(loc);
  return ms.length>0&&ms.every(m=>S.life.missions[m.id]);
}
function startMission(mid){
  ensureLife();
  const m=LIFE_MISSIONS.find(x=>x.id===mid);if(!m)return;
  const box=$("lifeBox");if(!box){showPage("life");return;}
  const sit=m.sit?lifeSit(m.sit):null;
  let i=0,score=0;
  const total=m.steps.length;
  function step(){
    if(i>=m.steps.length)return finish();
    const st=m.steps[i];
    box.innerHTML='<div class="muted">🎯 '+escapeHtml(m.title)+' — خطوة '+(i+1)+'/'+total+' • '+euro(lifeEuro())+'</div><div id="mQ"></div><div class="quiz-feedback hidden" id="mFb"></div><div class="row-flex"><button class="btn btn-ghost sm" id="mQuit">🚪 خروج</button></div>';
    $("mQuit").addEventListener("click",()=>renderLife());
    const qb=$("mQ"),fb=$("mFb");
    const ok=(msg)=>{score++;S.totalCorrect++;fb.classList.remove("hidden");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+(msg||"");S.totalAnswered++;sessTick(true);save();i++;setTimeout(step,1800);};
    const no=(msg,w)=>{fb.classList.remove("hidden");fb.className="quiz-feedback no";fb.textContent="❌ "+msg;try{if(m.focus)S.life.errFocus=S.life.errFocus||{},S.life.errFocus[m.focus]=(S.life.errFocus[m.focus]||0)+1;}catch(e){}if(w)recordMistake(w,msg,"life");S.totalAnswered++;sessTick(false,w&&w.id);save();i++;setTimeout(step,2200);};
    if(st.r==="listen"){
      const line=sit&&sit.dlg[st.line]||null;
      if(!line){i++;step();return;}
      const others=shuffle((sit.dlg||[]).filter((_,k)=>k!==st.line)).slice(0,2).map(x=>x[1]);
      const sh=shuffleOptions([line[1]].concat(others),0);
      qb.innerHTML='<div class="row-flex"><button class="btn btn-primary sm" id="mHear">🔊 استمع</button></div><div class="muted">ماذا سمعت؟</div><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
      const play=()=>speakGerman(line[0]);
      $("mHear").addEventListener("click",play);
      setTimeout(play,300);
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===sh.correct){b.classList.add("correct");ok(line[0]+" = "+line[1]);}
        else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");no("سمعت: "+line[0]+" = "+line[1]);}
      }));
    }else if(st.r==="listenB"){
      const others=["Guten Tag!","Danke schön!","Bis morgen!"].filter(x=>x!==st.ar);
      const sh=shuffleOptions([st.ar].concat(others.slice(0,2)),0);
      qb.innerHTML='<div class="row-flex"><button class="btn btn-primary sm" id="mHear">🔊 استمع</button></div><div class="muted">ماذا سمعت؟</div><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
      const play=()=>speakGerman(st.de);
      $("mHear").addEventListener("click",play);
      setTimeout(play,300);
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===sh.correct){b.classList.add("correct");ok(st.de+" = "+st.ar);}
        else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");no("سمعت: "+st.de+" = "+st.ar);}
      }));
    }else if(st.r==="reply"){
      const sh=shuffleOptions([st.ok].concat(st.bad),0);
      qb.innerHTML='<div class="talk-bot">🧑 '+escapeHtml(st.prompt)+' <button class="mini-btn" id="mHear">🔊</button><div class="muted">'+escapeHtml(st.promptAr)+'</div></div><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
      $("mHear").addEventListener("click",e=>{e.stopPropagation();speakGerman(st.prompt);});
      setTimeout(()=>speakGerman(st.prompt),300);
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===sh.correct){b.classList.add("correct");ok(st.why||"");}
        else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");no("الأفضل: "+st.ok+" — "+(st.why||""));}
      }));
    }else if(st.r==="vocab"||st.r==="vocabB"){
      let v=null;
      if(st.r==="vocab"&&sit&&sit.voc[st.wi])v=sit.voc[st.wi];
      else if(st.voc)v=st.voc;
      if(!v){i++;step();return;}
      const others=shuffle(allWords().filter(x=>(x.ar||"")!==v[1])).slice(0,3).map(x=>x.ar);
      const sh=shuffleOptions([v[1]].concat(others),0);
      const w=(typeof findWord==="function")?findWord(v[0]):null;
      qb.innerHTML='<h3 style="direction:ltr;text-align:center">'+escapeHtml(v[0])+' <button class="mini-btn" id="mHear">🔊</button></h3><div class="muted">ما معناها؟'+(w?' <button class="mini-btn" data-wid="'+w.id+'">📖 بطاقة الكلمة</button>':"")+'</div><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
      $("mHear").addEventListener("click",()=>speakGerman(v[0]));
      qb.querySelectorAll("[data-wid]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();try{openWordDetail(b.getAttribute("data-wid"));}catch(ex){}}));
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===sh.correct){b.classList.add("correct");ok(v[0]+" = "+v[1]);if(w){try{if(getStatus(w.id)==="new")setStatus(w.id,"review");}catch(e){}}}
        else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");no(v[0]+" = "+v[1],w||undefined);}
      }));
    }else if(st.r==="price"){
      const total=st.items.reduce((a,x)=>a+x[1],0);
      const opts=shuffle([total,total+2,Math.max(1,total-1)]);
      qb.innerHTML='<div class="muted">'+escapeHtml(st.ask)+'</div><div class="muted">'+st.items.map(x=>escapeHtml(x[0])+": €"+x[1]).join(" • ")+'</div><div class="quiz-opts">'+opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">€'+o+'</button>').join("")+'</div>';
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(opts[j]===total){
          if(!lifeSpend(total)){fb.classList.remove("hidden");fb.className="quiz-feedback no";fb.textContent="❌ رصيدك لا يكفي! ("+euro(lifeEuro())+")";i++;setTimeout(step,2200);return;}
          b.classList.add("correct");ok("دفعت "+euro(total)+" • المتبقي "+euro(lifeEuro()));
        }
        else{b.classList.add("wrong");no("المجموع الصحيح: €"+total);}
      }));
    }else if(st.r==="grammar"){
      const g=GRAMMAR.find(x=>x.id===st.gid);
      qb.innerHTML='<div class="muted">📐 لماذا؟ اضغط لشرح القاعدة ثم تابع.</div><div class="row-flex"><button class="btn btn-gold sm" id="mGram">شرح القاعدة 📖</button><button class="btn btn-primary sm" id="mGramOk">فهمت ✅</button></div>';
      $("mGram").addEventListener("click",()=>{try{openExplain(st.gid);}catch(e){}});
      $("mGramOk").addEventListener("click",()=>{addXP(5,"life-gram");ok("مراجعة سريعة مفيدة!");});
    }else{i++;step();}
  }
  function finish(){
    ensureLife();
    const first=!S.life.missions[mid];
    S.life.missions[mid]={date:todayStr(),score:score+"/"+total};
    addXP(m.xp,"life");earnCoins(m.coins,"life");markStudyDay();
    const loc=m.loc;
    let stampNew=false;
    if(lifeLocDone(loc)&&!S.life.stamps[loc]){S.life.stamps[loc]={date:todayStr()};stampNew=true;addXP(30,"life-stamp");earnCoins(15,"life-stamp");}
    save();checkAch();
    const L=LIFE_LOCS.find(x=>x.id===loc);
    box.innerHTML='<div class="panel glass" style="text-align:center"><div class="stamp-pop">🎉</div><h3>Mission Complete!</h3><div>'+escapeHtml(m.title)+' • '+score+'/'+total+'</div><div>⭐+'+m.xp+' XP • 🪙+'+m.coins+'</div>'+(stampNew?'<div class="stamp-pop">🏅 Stamp جديد: '+L.icon+" "+L.t+'!</div>':"")+'<div class="row-flex"><button class="btn btn-primary sm" id="mBack">🗺️ العالم</button></div></div>';
    $("mBack").addEventListener("click",renderLife);
    box.scrollIntoView({behavior:"smooth"});
  }
  step();box.scrollIntoView({behavior:"smooth"});
}
/* ---------- world page ---------- */
function lifeTierRank(t){return t==="A1"?0:t==="A2"?1:2;}
function lifeTierDone(tier){
  const ms=LIFE_MISSIONS.filter(m=>{const L=LIFE_LOCS.find(x=>x.id===m.loc);return L&&L.tier===tier;});
  const dn=ms.filter(m=>S.life.missions[m.id]).length;
  return {dn:dn,total:ms.length};
}
function lifeLocState(loc){
  const ms=lifeMissions(loc.id);
  const dn=ms.filter(m=>S.life.missions[m.id]).length;
  const idx=LIFE_LOCS.indexOf(loc);
  const prev=idx===0?null:LIFE_LOCS[idx-1];
  const prevDone=!prev||lifeLocDone(prev.id);
  return {dn:dn,total:ms.length,locked:!prevDone,stamped:!!S.life.stamps[loc.id]};
}
function renderLife(){
  ensureLife();
  const doneN=Object.keys(S.life.missions).length;
  const total=LIFE_MISSIONS.length;
  const pct=Math.round(doneN/Math.max(1,total)*100);
  let h='<div class="panel glass"><h3>🇩🇪 Deutsch Life — عش الألمانية</h3><div class="muted">المهام: '+doneN+'/'+total+' ('+pct+'%) • '+euro(lifeEuro())+' • ⭐ '+(S.xp||0)+'</div><div class="progress"><div class="progress-fill" style="width:'+pct+'%"></div></div><div class="row-flex"><button class="btn btn-gold sm" data-life="passport">🪪 جوازي</button><button class="btn btn-ghost sm" data-life="career">💼 المهنة</button><button class="btn btn-ghost sm" data-life="coach">🤖 الكوتش</button><button class="btn btn-ghost sm" data-life="daily">🔥 مهمة اليوم</button></div></div>';
  h+='<div class="panel glass"><h3>🗺️ الخريطة</h3><div class="lifemap">'+LIFE_LOCS.map(L=>{
    const st=lifeLocState(L);
    return '<button class="lifemap-pin tier-'+L.tier+(st.locked?" locked":"")+'" style="left:'+L.x+'%;top:'+L.y+'%" data-loc="'+L.id+'" title="'+L.ar+'"><span>'+L.icon+'</span><small>'+L.ar+'</small>'+(st.stamped?'<b class="stamp-mini">🏅</b>':"")+(st.locked?'<b class="stamp-mini">🔒</b>':"")+'</button>';
  }).join("")+'</div><div class="muted">A1 مفتوح • A2 بعد 4 مهام A1 • B1 بعد 4 مهام A2 (الدخول مسموح دائمًا للمراجعة)</div><div id="locList" class="grid-2">'+LIFE_LOCS.map(L=>{
    const st=lifeLocState(L);
    return '<div class="panel glass"><h4>'+L.icon+" "+L.t+' <span class="tag">'+L.tier+'</span> '+(st.stamped?"🏅":st.locked?"🔒":"")+'</h4><div class="muted">'+L.ar+' • '+st.dn+'/'+st.total+' مهام</div><div class="progress sm"><div class="progress-fill" style="width:'+Math.round(st.dn/Math.max(1,st.total)*100)+'%"></div></div><button class="btn btn-primary sm" data-loc="'+L.id+'">ادخل ←</button></div>';
  }).join("")+'</div><div id="lifeBox"></div></div>';
  $("lifeBox").innerHTML=h;
  const box=$("lifeBox");
  box.querySelectorAll("[data-loc]").forEach(b=>b.addEventListener("click",()=>openLoc(b.getAttribute("data-loc"))));
  box.querySelectorAll("[data-life]").forEach(b=>b.addEventListener("click",()=>{
    const k=b.getAttribute("data-life");
    if(k==="passport")renderPassport();
    else if(k==="career")renderCareer();
    else if(k==="coach")renderCoach();
    else if(k==="daily")renderLifeDaily();
  }));
}
function openLoc(id){
  const L=LIFE_LOCS.find(x=>x.id===id);if(!L)return;
  const box=$("lifeBox");
  const ms=lifeMissions(id);
  let h='<div class="panel glass"><h3>'+L.icon+" "+L.t+'</h3><div class="muted">'+L.ar+' • المستوى '+L.tier+'</div>';
  h+=ms.map(m=>{
    const done=S.life.missions[m.id];
    return '<div class="j-stage"><div><b>'+(done?"✅ ":"")+escapeHtml(m.title)+'</b><div class="muted">'+escapeHtml(m.obj)+' • ⭐+'+m.xp+' • 🪙+'+m.coins+'</div></div>'+(done?"":'<button class="btn btn-primary sm" data-mid="'+m.id+'">ابدأ 🚀</button>')+'</div>';
  }).join("");
  h+='<div class="row-flex"><button class="btn btn-ghost sm" id="locBack">🗺️ الخريطة</button></div></div><div id="mBox"></div>';
  box.innerHTML=h;
  $("locBack").addEventListener("click",renderLife);
  box.querySelectorAll("[data-mid]").forEach(b=>b.addEventListener("click",()=>startMission(b.getAttribute("data-mid"))));
  box.scrollIntoView({behavior:"smooth"});
}
/* ---------- passport ---------- */
function renderPassport(){
  ensureLife();
  const box=$("lifeBox");
  const stamps=LIFE_LOCS.map(L=>({L:L,got:!!S.life.stamps[L.id]}));
  const gotN=stamps.filter(s=>s.got).length;
  box.innerHTML='<div class="panel glass" style="text-align:center"><h3>🪪 German Passport</h3><div class="muted">المستوى '+(function(){try{return levelFor(S.xp||0).lvl;}catch(e){return 1;}})()+' • ⭐ '+(S.xp||0)+' • '+euro(lifeEuro())+'</div><div class="ach-grid">'+stamps.map(s=>'<div class="ach-card '+(s.got?"done":"locked")+'"><div style="font-size:28px">'+(s.got?s.L.icon:"🔒")+'</div><b>'+s.L.t+'</b><div class="muted">'+s.L.ar+(s.got?" ✅":"")+'</div></div>').join("")+'</div><div class="muted">الأختام: '+gotN+'/'+stamps.length+'</div><div class="progress"><div class="progress-fill" style="width:'+Math.round(gotN/Math.max(1,stamps.length)*100)+'%"></div></div><div class="row-flex"><button class="btn btn-ghost sm" id="ppBack">🗺️ العالم</button></div></div>';
  $("ppBack").addEventListener("click",renderLife);
}
/* ---------- career ---------- */
const CAREERS=[
{id:"studium",t:"🎓 Studium",path:["A1 أساسيات","مفردات الجامعة","القواعد A1","استماع المحاضرات","التقديم للجامعة"],rec:{page:"explain",label:"ابدأ القواعد"}},
{id:"arbeit",t:"💼 Arbeit",path:["A1 أساسيات","كلمات العمل","ألماني المكتب","المقابلة","التواصل المهني"],rec:{page:"job",label:"افتح قسم الشغل"}},
{id:"ausbildung",t:"🏫 Ausbildung",path:["A1 أساسيات","ألماني يومي","كلمات المهنة","مقابلة Ausbildung","جاهز للتدريب"],rec:{page:"job",label:"افتح قسم الشغل"}}];
function renderCareer(){
  ensureLife();
  const box=$("lifeBox");
  const cur=S.life.career;
  let h='<div class="panel glass"><h3>💼 Career Mode — اختر هدفك</h3><div class="row-flex">'+CAREERS.map(c=>'<button class="btn '+(cur===c.id?"btn-gold":"btn-ghost")+' sm" data-car="'+c.id+'">'+c.t+'</button>').join("")+'</div>';
  if(cur){
    const c=CAREERS.find(x=>x.id===cur);
    h+='<h4>مسارك: '+c.t+'</h4>'+c.path.map((p,i)=>'<div class="j-stage"><div><b>'+(i+1)+'. '+escapeHtml(p)+'</b></div></div>').join("");
    h+='<div class="row-flex"><button class="btn btn-primary sm" id="carGo">'+c.rec.label+' ←</button><button class="btn btn-gold sm" id="carSim">🎤 محاكاة المقابلة</button></div><div id="carBox"></div>';
  }
  h+='<div class="row-flex"><button class="btn btn-ghost sm" id="carBack">🗺️ العالم</button></div></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-car]").forEach(b=>b.addEventListener("click",()=>{S.life.career=b.getAttribute("data-car");save();renderCareer();toast("هدفك: "+b.textContent,"ok");}));
  $("carBack").addEventListener("click",renderLife);
  if(cur){
    const c=CAREERS.find(x=>x.id===cur);
    $("carGo").addEventListener("click",()=>showPage(c.rec.page));
    $("carSim").addEventListener("click",()=>startInterview($("carBox")));
  }
}
/* interview simulator with real scoring */
function startInterview(box){
  const QA=(typeof JOB_QA!=="undefined")?JOB_QA.slice(0,5):[];
  if(!QA.length){box.innerHTML='<div class="muted">لا أسئلة متاحة.</div>';return;}
  let i=0,vs=0,gs=0,n=0;
  function q(){
    if(i>=QA.length){
      const v=Math.round(vs/Math.max(1,n)),g=Math.round(gs/Math.max(1,n));
      addXP(40,"interview");earnCoins(20,"interview");markStudyDay();checkAch();save();
      S.life.interviews=(S.life.interviews||0)+1;save();
      box.innerHTML='<div class="panel glass" style="text-align:center"><h3>📋 نتيجة المقابلة</h3><div>Vocabulary: '+v+'%</div><div>Grammar: '+g+'%</div><div class="muted">'+(v>=70?"ممتاز! جاهز 🎉":"راجع كلمات المقابلات وحاول مجددًا 💪")+'</div><div>⭐+40 • 🪙+20</div></div>';return;
    }
    const it=QA[i];
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+QA.length+'</div><h4>'+escapeHtml(it[0])+'</h4><div class="muted">'+escapeHtml(it[1])+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="ivHear">🔊 اسمع</button></div><div class="quiz-write"><input type="text" id="ivIn" placeholder="أجب بالألمانية..."><button class="btn btn-primary sm" id="ivMic">🎤</button><button class="btn btn-gold sm" id="ivOk">تحقق ✅</button></div><div class="quiz-feedback hidden" id="ivFb"></div><div class="muted">مثال: '+escapeHtml(it[2])+'</div>';
    $("ivHear").addEventListener("click",()=>speakGerman(it[0]));
    $("ivMic").addEventListener("click",()=>{
      const Ctor=(typeof window!=="undefined")&&(window.SpeechRecognition||window.webkitSpeechRecognition);
      if(!Ctor){toast("المايك غير مدعوم — اكتب ⌨️","err");return;}
      try{const r=new Ctor();r.lang="de-DE";r.onresult=e=>{$("ivIn").value=e.results[0][0].transcript;};r.onerror=()=>toast("تعذر السماع — اكتب ⌨️","err");r.start();toast("🎤 تحدث...","ok");}catch(e){toast("تعذر المايك","err");}
    });
    $("ivOk").addEventListener("click",()=>{
      const v=$("ivIn").value.trim(),fb=$("ivFb");fb.classList.remove("hidden");
      if(v.length<2){fb.className="quiz-feedback no";fb.textContent="اكتب إجابة أولًا.";return;}
      let ev={vocab:50,missing:[]};
      try{if(typeof evaluateSpoken==="function")ev=evaluateSpoken(v,it[2]);}catch(e){}
      vs+=ev.vocab;n++;
      const gram=/^[A-ZÄÖÜ]/.test(v)&&/[.?!]$/.test(v)?100:60;
      gs+=gram;
      fb.className="quiz-feedback ok";
      fb.textContent="Vocabulary: "+ev.vocab+"% • Grammar: "+gram+"%"+(ev.missing.length?" • ناقصك: "+ev.missing.join("، "):"")+" — مثال: "+it[2];
      setTimeout(()=>{i++;q();},2600);
    });
  }
  q();
}
/* ---------- AI Life Coach (local rules, honest fallback) ---------- */
function coachAdvice(){
  ensureLife();
  const weak=lifeWeak();
  const last=S.lastActivity;
  const adv=[];
  if(weak.length)adv.push({t:"لاحظت أخطاء في: "+weak.slice(0,2).map(w=>w.k).join("، ")+".",go:"practice",b:"تدرب الآن 🎯"});
  else adv.push({t:"مستواك متوازن اليوم. استمر! 🚀",go:"games",b:"العب 🎮"});
  const dueN=(function(){try{return srsDue().length;}catch(e){return 0;}})();
  if(dueN>0)adv.push({t:"لديك "+dueN+" كلمات تحتاج مراجعة.",go:"review",b:"ابدأ المراجعة 🔁"});
  if(last)adv.push({t:"آخر نشاط: "+last.t+".",go:last.go,b:"أكمل ←"});
  return adv.slice(0,3);
}
function renderCoach(){
  const box=$("lifeBox");
  const L=(function(){try{return levelFor(S.xp||0);}catch(e){return{lvl:1};}})();
  box.innerHTML='<div class="panel glass"><h3>🤖 Dein Coach (مساعد محلي)</h3><div class="muted">المستوى '+L.lvl+' • ⭐ '+(S.xp||0)+' • 🔥 '+(S.streak.count||0)+'</div>'+coachAdvice().map(a=>'<div class="ex-de"><div class="ex-ar">💡 '+escapeHtml(a.t)+'</div><div class="row-flex"><button class="btn btn-primary sm" data-cgo="'+a.go+'">'+a.b+'</button></div></div>').join("")+'<div class="muted">يعمل بقواعد محلية على بياناتك. يمكن ربط AI حقيقي عبر Backend لاحقًا.</div><div class="row-flex"><button class="btn btn-ghost sm" id="coachBack">🗺️ العالم</button></div></div>';
  box.querySelectorAll("[data-cgo]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-cgo"))));
  $("coachBack").addEventListener("click",renderLife);
}
/* ---------- adaptive: weak areas drive next missions ---------- */
function lifeWeak(){
  const cats={};
  try{
    Object.keys(S.mistakes||{}).forEach(id=>{
      const w=wordById(id);if(!w)return;
      const k=(w.cat||"عام");
      cats[k]=(cats[k]||0)+S.mistakes[id].n;
    });
    Object.keys(S.gweak||{}).forEach(g=>{cats["قواعد:"+(g||"")]= (cats["قواعد:"+(g||"") ]||0)+S.gweak[g];});
  }catch(e){}
  return Object.keys(cats).map(k=>({k:k,n:cats[k]})).sort((a,b)=>b.n-a.n).slice(0,3);
}
function lifeSuggest(){
  ensureLife();
  const weak=lifeWeak();
  const done=id=>!!S.life.missions[id];
  const cands=LIFE_MISSIONS.filter(m=>!done(m.id));
  if(!cands.length)return null;
  if(weak.length){
    const wk=weak[0].k;
    const hit=cands.find(m=>{
      const L=LIFE_LOCS.find(x=>x.id===m.loc);
      return (L&&(L.ar===wk||L.t===wk))||(m.focus&&wk.indexOf(m.focus)>=0);
    });
    if(hit)return hit;
  }
  return cands[0];
}
/* ---------- daily mission (date-seeded) ---------- */
function lifeDaily(){
  ensureLife();
  const t=todayStr();
  let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;h=h<0?-h:h;
  const open=LIFE_MISSIONS.filter(m=>!S.life.missions[m.id]);
  const pool=open.length?open:LIFE_MISSIONS;
  const m=pool[h%pool.length];
  const key="d"+t;
  const done=S.life.missions[key+":"+m.id];
  return {m:m,done:!!done,key:key+":"+m.id,today:t};
}
function renderLifeDaily(){
  const d=lifeDaily();
  const box=$("lifeBox");
  box.innerHTML='<div class="panel glass" style="text-align:center"><h3>🔥 مهمة اليوم</h3><div><b>'+escapeHtml(d.m.title)+'</b></div><div class="muted">'+escapeHtml(d.m.obj)+' • ⭐+'+d.m.xp+'</div>'+(d.done?'<div class="quiz-feedback ok">🏆 مكتملة اليوم!</div>':'<div class="row-flex"><button class="btn btn-primary sm" id="dmGo">ابدأ 🚀</button></div>')+'<div class="row-flex"><button class="btn btn-ghost sm" id="dmBack">🗺️ العالم</button></div></div>';
  $("dmBack").addEventListener("click",renderLife);
  if(!d.done)$("dmGo").addEventListener("click",()=>{
    S.life.missions[d.key]={date:d.today,score:"daily"};
    save();startMission(d.m.id);
  });
}
/* ---------- dashboard + profile widgets ---------- */
function lifeProgress(){
  ensureLife();
  const total=LIFE_MISSIONS.length;
  const dn=Object.keys(S.life.missions).filter(k=>LIFE_MISSIONS.some(m=>m.id===k)).length;
  return {dn:dn,total:total,pct:Math.round(dn/Math.max(1,total)*100)};
}
function renderLifeWidgets(){
  try{
    ensureLife();
    const el=$("dashLife");
    if(el){
      const p=lifeProgress();
      const sug=lifeSuggest();
      const d=lifeDaily();
      el.innerHTML='<div class="panel glass reveal"><h3>🇩🇪 عالمك: '+p.pct+'% مستكشف</h3><div class="progress"><div class="progress-fill" style="width:'+p.pct+'%"></div></div><div class="muted">مهام: '+p.dn+'/'+p.total+' • '+euro(lifeEuro())+' • مهمة اليوم: '+(d.done?"✅":"⏳")+'</div><div class="row-flex"><button class="btn btn-primary sm" data-lgo="life">ادخل العالم 🗺️</button>'+(sug?'<button class="btn btn-gold sm" data-lgo2="'+sug.id+'">التالي: '+escapeHtml(sug.title)+'</button>':"")+'</div></div>';
      el.querySelectorAll("[data-lgo]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-lgo"))));
      el.querySelectorAll("[data-lgo2]").forEach(b=>b.addEventListener("click",()=>startMission(b.getAttribute("data-lgo2"))));
    }
    const pr=$("profileLife");
    if(pr){
      const p=lifeProgress();
      const stamps=Object.keys(S.life.stamps).length;
      pr.innerHTML='<div class="panel glass"><h3>🪪 جوازي</h3><div class="muted">مستكشف: '+p.pct+'% • أختام: '+stamps+'/12 • '+euro(lifeEuro())+'</div><div class="row-flex"><button class="btn btn-ghost sm" data-lgo="life">عرض العالم</button></div></div>';
      pr.querySelectorAll("[data-lgo]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-lgo"))));
    }
  }catch(e){}
}
/* ---------- world achievements (appended, no duplicates) ---------- */
const LIFE_ACHS=[
{id:"firstday",t:"🇩🇪 First Day in Germany",d:"أكمل أول مهمة",ok:()=>Object.keys(S.life.missions).length>=1,p:()=>Math.min(Object.keys(S.life.missions).length,1)+"/1"},
{id:"shopmaster",t:"🛒 Supermarket Master",d:"أكمل مهام السوبرماركت",ok:()=>!!S.life.stamps.shop,p:()=>S.life.stamps.shop?"تم":"—"},
{id:"restexp",t:"🍽️ Restaurant Expert",d:"أكمل مهام المطعم",ok:()=>!!S.life.stamps.rest,p:()=>S.life.stamps.rest?"تم":"—"},
{id:"traintrav",t:"🚆 Train Traveler",d:"أكمل مهام المحطة",ok:()=>!!S.life.stamps.station,p:()=>S.life.stamps.station?"تم":"—"},
{id:"hotelguest",t:"🏨 Hotel Guest",d:"أكمل مهام الفندق",ok:()=>!!S.life.stamps.hotel,p:()=>S.life.stamps.hotel?"تم":"—"},
{id:"bankcust",t:"🏦 Bank Customer",d:"أكمل مهام البنك",ok:()=>!!S.life.stamps.bank,p:()=>S.life.stamps.bank?"تم":"—"},
{id:"jobhunt",t:"💼 Job Hunter",d:"أكمل مهام المقابلة",ok:()=>!!S.life.stamps.interview,p:()=>S.life.stamps.interview?"تم":"—"},
{id:"ausbrdy",t:"🎓 Ausbildung Ready",d:"أكمل مهام المهنة",ok:()=>!!S.life.stamps.work||!!S.life.stamps.jobcenter,p:()=>(S.life.stamps.work||S.life.stamps.jobcenter)?"تم":"—"},
{id:"explorer",t:"🗺️ City Explorer",d:"6 أختام",ok:()=>Object.keys(S.life.stamps).length>=6,p:()=>Math.min(Object.keys(S.life.stamps).length,6)+"/6"},
{id:"germaster",t:"🏆 Germany Master",d:"12 ختمًا",ok:()=>Object.keys(S.life.stamps).length>=12,p:()=>Object.keys(S.life.stamps).length+"/12"}];
if(typeof achDefs==="function"&&!achDefs._life){
  const _ad=achDefs;
  achDefs=function(){
    const base=_ad();
    try{
      ensureLife();
      LIFE_ACHS.forEach(a=>{
        if(!base.some(b=>b.id===a.id))base.push({id:a.id,t:a.t,d:a.d,ok:!!a.ok(),p:a.p()});
      });
    }catch(e){}
    return base;
  };
  achDefs._life=true;
}
/* ---------- wiring ---------- */
const LIFE_PAGES={life:renderLife};
(function(){
  try{
    if($("dashLearn")&&!$("dashLife")){
      const d=document.createElement("div");d.id="dashLife";
      $("dashLearn").parentNode.insertBefore(d,$("dashLearn").nextSibling);
    }
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(LIFE_PAGES[n])LIFE_PAGES[n]();if(n==="dashboard"||n==="profile")renderLifeWidgets();}catch(e){console.error(e);}};
    const _rd=renderDashboard;
    renderDashboard=function(){_rd();try{renderLifeWidgets();}catch(e){}};
    ensureLife();
  }catch(e){console.error(e);}
})();

