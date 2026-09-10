/* Deutsch Master - Learning platform: Journey, Placement, Listening, Speaking,
   Conversation, RealLife, Ausbildung, Achievements. Works on existing data + TTS. */
"use strict";
function ensureLearn(){
  if(!S.journey)S.journey={lessons:{},listen:{},speak:{},talk:{},final:{}};
  if(!S.journey.lessons)S.journey.lessons={};
  if(!S.journey.listen)S.journey.listen={};
  if(!S.journey.speak)S.journey.speak={};
  if(!S.journey.talk)S.journey.talk={};
  if(!S.journey.final)S.journey.final={};
  if(!S.ach)S.ach={};
  if(!S.lstats)S.lstats={ln:0,lok:0,sn:0,sok:0};
  if(!S.place)S.place=null;
}
function normDe(s){return String(s||"").toLowerCase().replace(/[?!.,;:"„“»«']/g,"").replace(/\s+/g," ").trim();}
function completeLesson(gid){
  try{
    ensureLearn();
    if(!S.journey.lessons[gid]){S.journey.lessons[gid]={date:todayStr()};addXP(15);save();toast("أتممت الدرس! ⭐+15","ok");checkAch();}
  }catch(e){}
}
/* ---------- Achievements ---------- */
function achDefs(){
  const words=allWords();
  const known=words.filter(w=>getStatus(w.id)==="known").length;
  const gl=Object.keys((S.journey||{lessons:{}}).lessons||{}).length;
  const a1done=!!(S.journey&&S.journey.final&&S.journey.final.A1);
  return [
    {id:"w1",t:"أول كلمة",d:"احفظ أول كلمة",ok:known>=1,p:Math.min(known,1)+"/1"},
    {id:"w100",t:"100 كلمة",d:"احفظ 100 كلمة",ok:known>=100,p:Math.min(known,100)+"/100"},
    {id:"w500",t:"500 كلمة",d:"احفظ 500 كلمة",ok:known>=500,p:Math.min(known,500)+"/500"},
    {id:"st7",t:"7 أيام",d:"Streak لمدة 7 أيام",ok:(S.streak.count||0)>=7,p:Math.min(S.streak.count||0,7)+"/7"},
    {id:"st30",t:"30 يوم",d:"Streak لمدة 30 يوم",ok:(S.streak.count||0)>=30,p:Math.min(S.streak.count||0,30)+"/30"},
    {id:"q10",t:"المثابر",d:"أكمل 10 اختبارات",ok:(S.testsTaken||0)>=10,p:Math.min(S.testsTaken||0,10)+"/10"},
    {id:"acc90",t:"الدقيق",d:"نسبة نجاح 90%+",ok:(S.bestPct||0)>=90,p:(S.bestPct||0)+"%"},
    {id:"g10",t:"النحوي",d:"أتمم 10 دروس قواعد",ok:gl>=10,p:Math.min(gl,10)+"/10"},
    {id:"li10",t:"المستمع",d:"أكمل 10 تمارين استماع",ok:(S.lstats.lok||0)>=10,p:Math.min(S.lstats.lok||0,10)+"/10"},
    {id:"sp5",t:"المتحدث",d:"أكمل 5 تمارين تحدث",ok:(S.lstats.sok||0)>=5,p:Math.min(S.lstats.sok||0,5)+"/5"},
    {id:"a1",t:"بطل A1",d:"اجتز الاختبار النهائي",ok:a1done,p:a1done?"تم":"لم يتم"},
    {id:"art50",t:"🏆 Article Killer",d:"50 إجابة أدوات صحيحة",ok:(S.gstats&&S.gstats.rush&&S.gstats.rush.ok||0)>=50,p:Math.min((S.gstats&&S.gstats.rush&&S.gstats.rush.ok||0),50)+"/50"},
    {id:"li20",t:"🎧 Listening Ear",d:"20 تمرين استماع",ok:(S.lstats.lok||0)>=20,p:Math.min(S.lstats.lok||0,20)+"/20"},
    {id:"sp10",t:"🎙️ Brave Speaker",d:"10 جلسات تحدث",ok:(S.lstats.sok||0)>=10,p:Math.min(S.lstats.sok||0,10)+"/10"},
    {id:"st14",t:"🔥 No Excuses",d:"14 يوم Streak",ok:(S.streak.count||0)>=14,p:Math.min(S.streak.count||0,14)+"/14"},
    {id:"mh50",t:"🧠 Mistake Hunter",d:"صحح 50 خطأ",ok:(S.fixedTotal||0)>=50,p:Math.min(S.fixedTotal||0,50)+"/50"},
    {id:"combo10",t:"🔥 10 Combo",d:"كومبو 10",ok:(S.bestCombo||0)>=10,p:Math.min(S.bestCombo||0,10)+"/10"},
    {id:"xp10k",t:"⭐ 10,000 XP",d:"اجمع 10000 XP",ok:(S.xp||0)>=10000,p:(S.xp||0)+"/10000"},
    {id:"gm100",t:"🎮 Game Master",d:"العب 100 لعبة",p:(function(){let n=0;try{Object.keys(S.gstats||{}).forEach(k=>{n+=S.gstats[k].n||0;});}catch(e){}return Math.min(n,100)+"/100";})(),ok:(function(){let n=0;try{Object.keys(S.gstats||{}).forEach(k=>{n+=S.gstats[k].n||0;});}catch(e){}return n>=100;})()},
    {id:"gr100",t:"📚 Bookworm",d:"100 اختبار ودرس",p:Math.min((S.testsTaken||0)+gl,100)+"/100",ok:((S.testsTaken||0)+gl)>=100},
    {id:"gerdy",t:"🇩🇪 Germany Ready",d:"أكمل مسار البقاء",ok:(function(){try{return S.journey&&S.journey.talk&&Object.keys(S.journey.talk).length>=5;}catch(e){return false;}})(),p:"محادثات"}
  ];
}
function checkAch(){
  try{
    ensureLearn();let changed=false;
    achDefs().forEach(a=>{if(a.ok&&!S.ach[a.id]){S.ach[a.id]={date:todayStr()};addXP(30);changed=true;setTimeout(()=>toast("🏆 إنجاز جديد: "+a.t+" ⭐+30","ok"),300);}});
    if(changed)save();
  }catch(e){}
}
/* ---------- German Journey ---------- */
function journeyStages(){
  const words=allWords();
  const known=words.filter(w=>getStatus(w.id)==="known").length;
  const gl=Object.keys(S.journey.lessons).length;
  const gTotal=(typeof EXPLAIN_ORDER!=="undefined"?EXPLAIN_ORDER.length:GRAMMAR.length);
  const liN=Object.keys(S.journey.listen).length, liT=LISTEN_ITEMS.length;
  const spN=Object.keys(S.journey.speak).length, spT=SPEAK_ITEMS.length;
  const a1=!!S.journey.final.A1;
  return [
    {id:"vocab",t:"📚 المفردات",d:known+" / "+words.length+" كلمة محفوظة",p:words.length?known/words.length:0,go:"vocab"},
    {id:"gram",t:"📐 القواعد",d:gl+" / "+gTotal+" درسًا",p:gTotal?gl/gTotal:0,go:"explain"},
    {id:"listen",t:"🎧 الاستماع",d:liN+" / "+liT+" تمرينًا",p:liT?liN/liT:0,go:"listen"},
    {id:"speak",t:"🎤 التحدث",d:spN+" / "+spT+" تمرينًا",p:spT?spN/spT:0,go:"speak"},
    {id:"practice",t:"📝 التدريب",d:(S.testsTaken||0)+" اختبارًا",p:Math.min(1,(S.testsTaken||0)/10),go:"quiz"},
    {id:"final",t:"🏁 الاختبار النهائي A1",d:a1?"مكتمل ✅":"لم يكتمل",p:a1?1:0,go:"journey"}
  ];
}
function renderJourney(){
  ensureLearn();
  const st=journeyStages();
  const total=Math.round(st.reduce((a,s)=>a+s.p,0)/st.length*100);
  let h='<div class="panel glass"><h3>🗺️ German Journey — رحلة A1</h3><div class="muted">التقدم الإجمالي: '+total+'%</div><div class="progress"><div class="progress-fill" style="width:'+total+'%"></div></div></div>';
  h+='<div class="panel glass"><h3>📍 المراحل</h3>';
  st.forEach(s=>{
    const st2=s.p>=1?"✓ Completed":(s.p>0?"🟡 In Progress":"🔒 Locked");
    h+='<div class="j-stage"><div><b>'+s.t+'</b><div class="muted">'+s.d+' • '+st2+'</div><div class="progress sm"><div class="progress-fill" style="width:'+Math.round(s.p*100)+'%"></div></div></div><button class="btn btn-ghost sm" data-go="'+s.go+'">فتح ←</button></div>';
  });
  h+='</div>';
  h+='<div class="panel glass"><h3>🎯 Placement Test — اختبار تحديد المستوى</h3><div class="muted">12 سؤالًا في المفردات والقواعد والقراءة.</div><div class="row-flex"><button class="btn btn-primary sm" id="placeStart">ابدأ الاختبار 🚀</button></div><div id="placeBox"></div>';
  if(S.place)h+='<div class="quiz-feedback ok">مستواك التقديري: <b>'+S.place.lvl+'</b> ('+S.place.score+'/12) — المسار المقترح: <b>'+S.place.path+'</b></div>';
  h+='</div>';
  h+='<div class="panel glass"><h3>🏁 A1 Final Test</h3><div class="muted">10 أسئلة متنوعة (اختيارات + صح/خطأ + أداة). النجاح من 70%.</div><div class="row-flex"><button class="btn btn-gold sm" id="finalStart">ابدأ الاختبار النهائي 🏁</button></div><div id="finalBox"></div></div>';
  h+='<div class="panel glass"><h3>📐 خريطة قواعد A1</h3><div class="ex-toc-list" id="jMap"></div></div>';
  $("journeyBox").innerHTML=h;
  $("journeyBox").querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{const g=b.getAttribute("data-go");if(g==="journey")return;showPage(g);}));
  $("placeStart").addEventListener("click",startPlacement);
  $("finalStart").addEventListener("click",()=>startFinal("finalBox",false));
  const order=(typeof EXPLAIN_ORDER!=="undefined"?EXPLAIN_ORDER:GRAMMAR.map(g=>g.id));
  $("jMap").innerHTML=order.map((id,i)=>{
    const g=GRAMMAR.find(x=>x.id===id);if(!g)return "";
    const done=S.journey.lessons[id];
    const firstOpen=order.find(x=>!S.journey.lessons[x]);
    const cur=(!done&&id===firstOpen)?"🟡":"";
    return '<button class="ex-toc-item" data-j="'+id+'"><span class="ex-num">'+(i+1)+'</span><span class="ex-t">'+escapeHtml(g.title)+'</span><span>'+(done?"✓":cur||"🔒")+'</span></button>';
  }).join("");
  $("jMap").querySelectorAll("[data-j]").forEach(b=>b.addEventListener("click",()=>openExplain(b.getAttribute("data-j"))));
}
function buildPlacement(){
  const words=shuffle(allWords().filter(w=>w.art!=="-")).slice(0,4);
  const qs=words.map(w=>({t:"ما معنى: "+fullDe(w)+"؟",opts:shuffle([w.ar].concat(shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar))),correct:0,fix:function(){this.opts=shuffle(this.opts);this.correct=this.opts.indexOf(w.ar);},w:w,why:fullDe(w)+" = "+w.ar}));
  qs.forEach(q=>q.fix());
  const g4=shuffle(GRAMMAR).slice(0,4);
  g4.forEach(g=>qs.push({t:"قواعد: "+g.quiz.q,opts:g.quiz.opts.slice(),correct:g.quiz.correct,why:g.quiz.explain}));
  const s4=shuffle(SENTENCES).slice(0,4);
  s4.forEach(s=>qs.push({t:"اقرأ واختر الترجمة: "+s.de,opts:shuffle([s.ar].concat(shuffle(SENTENCES.filter(x=>x.id!==s.id)).slice(0,3).map(x=>x.ar))),correct:0,fix2:s,why:s.de+" = "+s.ar}));
  qs.slice(8).forEach(q=>{if(q.fix2){q.opts=shuffle(q.opts);q.correct=q.opts.indexOf(q.fix2.ar);}});
  return shuffle(qs);
}
function startPlacement(){
  const qs=buildPlacement();let i=0,score=0;
  const box=$("placeBox");
  function render(){
    if(i>=qs.length){
      const lvl=score<=3?"A0 (ابدأ من الصفر)":score<=6?"A1":score<=9?"A2 (تقديري)":"B1 (تقديري)";
      const path=score<=6?"Start A1 🟢":"راجع A1 ثم انتقل للمستوى التالي";
      S.place={score:score,lvl:lvl,path:path,date:todayStr()};addXP(20);save();checkAch();
      box.innerHTML='<div class="quiz-feedback ok">النتيجة: '+score+'/12<br>مستواك التقديري: <b>'+lvl+'</b><br>المسار المقترح: <b>'+path+'</b> ⭐+20</div>';
      renderJourney();return;
    }
    const q=qs[i];
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+qs.length+'</div><h4>'+escapeHtml(q.t)+'</h4><div class="quiz-opts">'+q.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="plFb"></div>';
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("plFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===q.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+q.why;score++;}
      else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[q.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ الإجابة: "+q.opts[q.correct]+" — "+q.why;if(q.w)recordMistake(q.w,q.opts[j],"placement");}
      save();setTimeout(()=>{i++;render();},1600);
    }));
  }
  render();
}
function startFinal(boxId,quiet){
  const words=shuffle(allWords()).slice(0,10);
  const qs=words.map((w,i)=>{
    const kind=i%3;
    if(kind===0&&w.art!=="-")return{t:"اختر الأداة: ___ "+w.de,opts:["der","die","das"],correct:w.art==="der"?0:w.art==="die"?1:2,w:w,why:w.art+" "+w.de+" = "+w.ar};
    if(kind===1)return{t:"صح أم خطأ: "+fullDe(w)+" = "+(i%2?w.ar:"خطأ مقصود"),opts:["صح ✅","خطأ ❌"],correct:i%2?0:1,w:w,why:fullDe(w)+" = "+w.ar};
    const others=shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar);
    const opts=shuffle([w.ar].concat(others));
    return{t:"ما معنى "+fullDe(w)+"؟",opts:opts,correct:opts.indexOf(w.ar),w:w,why:fullDe(w)+" = "+w.ar};
  });
  let i=0,score=0;const box=$(boxId);
  function render(){
    if(i>=qs.length){
      const pct=Math.round(score/qs.length*100);
      if(pct>=70){S.journey.final.A1={pct:pct,date:todayStr()};addXP(50);save();checkAch();
        box.innerHTML='<div class="panel glass" style="text-align:center">🎉<h3>German Journey — Level A1 Completed!</h3><div>النتيجة: '+score+'/'+qs.length+' ('+pct+'%) ⭐+50</div><div class="muted">راجع نقاط ضعفك في صفحة أخطائي واستمر إلى A2 🚀</div></div>';}
      else{addXP(10);save();box.innerHTML='<div class="quiz-feedback no">النتيجة: '+score+'/'+qs.length+' ('+pct+'%) — تحتاج 70%. راجع الدروس وحاول مجددًا 💪 ⭐+10</div>';}
      try{renderJourney();}catch(e){}return;
    }
    const q=qs[i];
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+qs.length+'</div><h4>'+escapeHtml(q.t)+'</h4><div class="quiz-opts">'+q.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="fnFb"></div>';
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("fnFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===q.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+q.why;score++;}
      else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[q.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ الإجابة: "+q.opts[q.correct]+" — لماذا؟ "+q.why;recordMistake(q.w,q.opts[j],"final");}
      setTimeout(()=>{i++;render();},1700);
    }));
  }
  render();
}
/* ---------- Listening ---------- */
const LISTEN_ITEMS=[
{de:"Ich trinke jeden Morgen Kaffee.",ar:"أشرب القهوة كل صباح.",w:"Kaffee"},
{de:"Meine Schwester wohnt in Berlin.",ar:"أختي تسكن في برلين.",w:"Schwester"},
{de:"Der Zug kommt um halb acht.",ar:"القطار يأتي السابعة والنصف.",w:"Zug"},
{de:"Was kostet das Brot?",ar:"كم سعر الخبز؟",w:"Brot"},
{de:"Wir lernen jeden Tag Deutsch.",ar:"نتعلم الألمانية كل يوم.",w:"Tag"},
{de:"Mein Vater arbeitet in einem Büro.",ar:"أبي يعمل في مكتب.",w:"Vater"},
{de:"Die Kinder spielen im Garten.",ar:"الأطفال يلعبون في الحديقة.",w:"Kind"},
{de:"Entschuldigung, wo ist der Bahnhof?",ar:"عذرًا، أين محطة القطار؟",w:"Bahnhof"}];
function findWord(de){return allWords().find(w=>w.de===de)||allWords().find(w=>w.de.toLowerCase()===String(de).toLowerCase());}
function renderListen(){
  ensureLearn();
  let h='<div class="panel glass"><h3>🎧 الاستماع</h3><div class="muted">استمع ثم أجب. النطق بصوت ألماني.</div></div><div id="liBox"></div>';
  $("listenBox").innerHTML=h;renderLi(0);
}
function renderLi(i){
  const box=$("liBox");
  if(i>=LISTEN_ITEMS.length){box.innerHTML='<div class="quiz-feedback ok">أكملت كل تمارين الاستماع 🎧 راجع صفحة الرحلة!</div>';return;}
  const it=LISTEN_ITEMS[i], w=findWord(it.w);
  const mode=i%2;
  box.innerHTML='<div class="muted">تمرين '+(i+1)+'/'+LISTEN_ITEMS.length+'</div><div class="row-flex"><button class="btn btn-primary sm" id="liPlay">🔊 استمع</button><button class="btn btn-ghost sm" id="liSlow">🐢 ببطء</button></div><div id="liQ"></div>';
  $("liPlay").addEventListener("click",()=>speakGerman(it.de));
  $("liSlow").addEventListener("click",()=>{const r=currentRate();try{S.settings.speed=0.5;save();}catch(e){}speakGerman(it.de);try{S.settings.speed=r;save();}catch(e){}});
  setTimeout(()=>speakGerman(it.de),400);
  const q=$("liQ");
  if(mode===0){
    const opts=shuffle([it.ar].concat(shuffle(LISTEN_ITEMS.filter(x=>x!==it)).slice(0,3).map(x=>x.ar)));
    q.innerHTML='<h4>ما معنى ما سمعت؟</h4><div class="quiz-opts">'+opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="liFb"></div>';
    q.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("liFb");fb.classList.remove("hidden");
      q.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(opts[j]===it.ar){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+it.de+" = "+it.ar;liDone(i,true);}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ النص: "+it.de+" = "+it.ar+" — ركّز على الكلمات المفتاحية.";if(w)recordMistake(w,opts[j],"listening");liDone(i,false);}
      setTimeout(()=>renderLi(i+1),2200);
    }));
  }else{
    q.innerHTML='<h4>اكتب ما سمعت بالألمانية:</h4><div class="quiz-write"><input type="text" id="liIn" autocomplete="off" placeholder="..."><button class="btn btn-primary sm" id="liOk">تحقق ✅</button></div><div class="quiz-feedback hidden" id="liFb"></div><div class="muted">تلميح: '+escapeHtml(it.ar)+'</div>';
    $("liOk").addEventListener("click",()=>{
      const v=$("liIn").value, fb=$("liFb");fb.classList.remove("hidden");
      if(normDe(v)===normDe(it.de)){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+it.de;liDone(i,true);}
      else{fb.className="quiz-feedback no";fb.textContent="❌ النص الصحيح: "+it.de+" = "+it.ar;if(w)recordMistake(w,v,"listening-dictation");}
      setTimeout(()=>renderLi(i+1),2400);
    });
  }
}
function liDone(i,ok){
  ensureLearn();
  if(!S.journey.listen[i]){S.journey.listen[i]={date:todayStr()};addXP(15);toast("استماع ⭐+15","ok");}
  S.lstats.ln++;if(ok)S.lstats.lok++;
  save();checkAch();
}
/* ---------- Speaking ---------- */
const SPEAK_ITEMS=[
{q:"Wie heißt du?",ar:"ما اسمك؟",sample:"Ich heiße Ahmed."},
{q:"Woher kommst du?",ar:"من أين أنت؟",sample:"Ich komme aus Ägypten."},
{q:"Wo wohnst du?",ar:"أين تسكن؟",sample:"Ich wohne in Kairo."},
{q:"Was machst du gern?",ar:"ماذا تحب أن تفعل؟",sample:"Ich spiele gern Fußball."},
{q:"Wie alt bist du?",ar:"كم عمرك؟",sample:"Ich bin zwanzig Jahre alt."},
{q:"Was isst du gern?",ar:"ماذا تحب أن تأكل؟",sample:"Ich esse gern Pizza."},
{q:"Sprichst du Deutsch?",ar:"هل تتحدث الألمانية؟",sample:"Ja, ich spreche ein bisschen Deutsch."},
{q:"Was machst du morgen?",ar:"ماذا ستفعل غدًا؟",sample:"Morgen lerne ich Deutsch."}];
function renderSpeak(){
  ensureLearn();
  const sr=hasSR();
  let h='<div class="panel glass"><h3>🎤 التحدث</h3><div class="muted">'+(sr?"تحدث في المايك بالألمانية وسأعرض ما سمعته.":"المتصفح لا يدعم التعرف على الصوت — اكتب إجابتك بدلًا من ذلك.")+'</div></div><div id="spBox"></div>';
  $("speakBox").innerHTML=h;renderSp(0);
}
function hasSR(){try{return typeof window!=="undefined"&&(window.SpeechRecognition||window.webkitSpeechRecognition);}catch(e){return false;}}
/* Speech recognition engine.
   States: idle|starting|listening|processing|success|error|unsupported|permission-denied.
   onend is NEVER treated as an error by itself. */
var _micRec=null,_micState="idle",_micFinal="",_micInterim="",_micCancel=false,_micGen=0;
function srCtor(){try{return window.SpeechRecognition||window.webkitSpeechRecognition||null;}catch(e){return null;}}
function srErrorMsg(e){
  const m=String((e&&e.error)||"unknown");
  if(m==="not-allowed"||m==="permission-denied")return "🎤 تم رفض صلاحية الميكروفون. اسمح للمتصفح باستخدام الميكروفون ثم حاول مرة أخرى.";
  if(m==="service-not-allowed")return "🎤 خدمة الميكروفون مرفوضة على هذا الجهاز. تحقق من إعدادات النظام والمتصفح.";
  if(m==="no-speech")return "لم نسمع كلامًا. حاول التحدث بصوت واضح.";
  if(m==="audio-capture")return "لم نتمكن من الوصول إلى الميكروفون. تأكد أن الميكروفون يعمل وغير مستخدم بواسطة تطبيق آخر.";
  if(m==="network")return "حدثت مشكلة في خدمة التعرف الصوتي. تأكد من اتصال الإنترنت وحاول مرة أخرى.";
  if(m==="language-not-supported")return "التعرف على الألمانية غير مدعوم في هذا المتصفح.";
  if(m==="aborted")return "";
  return "حدث خطأ غير معروف في التعرف الصوتي.";
}
function micSetState(btn,st,label){
  _micState=st;
  if(!btn)return;
  if(st==="listening"||st==="starting"){btn.classList.add("live");btn.innerHTML=label||"🔴 جاري الاستماع... اضغط للإيقاف";}
  else{btn.classList.remove("live");btn.innerHTML=label||"🎙️ اضغط للتحدث";}
}
function micIdle(btn){_micRec=null;micSetState(btn,"idle");_micFinal="";_micInterim="";}
/* Optional mic permission probe. Never blocks: prompt/unknown => let the browser ask. */
function micPermProbe(cb){
  try{
    if(navigator&&navigator.permissions&&navigator.permissions.query){
      navigator.permissions.query({name:"microphone"}).then(
        r=>cb(r&&r.state||"unknown"),
        ()=>cb("unknown"));
      return;
    }
  }catch(e){}
  cb("unknown");
}
function micSecureOk(){
  try{
    if(typeof window==="undefined"||typeof window.isSecureContext==="undefined")return true;
    if(window.isSecureContext)return true;
    const h=String((window.location&&window.location.hostname)||"");
    return h===""||h==="localhost"||h==="127.0.0.1";
  }catch(e){return true;}
}
/* Honest transcript-based evaluator (no AI claims): word overlap + shape notes. */
const SP_STOP=["ich","du","er","sie","es","wir","ihr","der","die","das","ein","eine","einen","einem","ist","sind","bin","bist","und","oder","nicht","kein","keine","im","in","am","an","auf","mit","zu","von","aus","für","um","ja","nein"];
function evaluateSpoken(text,sample){
  const tw=normDe(text).split(" ").filter(Boolean);
  const sw=normDe(sample).split(" ").filter(Boolean);
  const keys=sw.filter(w=>w.length>3&&SP_STOP.indexOf(w)<0);
  const hit=keys.filter(k=>tw.indexOf(k)>=0);
  const vocab=keys.length?Math.round(hit.length/keys.length*100):100;
  const notes=[];
  if(text&&text[0]===text[0].toUpperCase())notes.push("✅ بداية الجملة كبيرة.");
  else notes.push("⚠️ ابدأ الجملة بحرف كبير.");
  if(/[.!?]$/.test(text.trim()))notes.push("✅ علامة الترقيم موجودة.");
  else notes.push("⚠️ أنهِ الجملة بـ . أو ؟ أو !");
  const missing=keys.filter(k=>tw.indexOf(k)<0);
  return {vocab:vocab,missing:missing,notes:notes,words:tw.length};
}
function startMic(btn,inp,fb,onFinal){
  if(!btn||!inp)return;
  btn.addEventListener("click",()=>{
    /* toggle stop: natural stop, never an error */
    if(_micState==="listening"||_micState==="starting"){
      _micCancel=true;_micGen++;
      try{if(_micRec)_micRec.stop();}catch(e){}
      if(_micState==="starting"){micIdle(btn);}
      return;
    }
    if(_micState!=="idle")return; /* single session guard */
    const Ctor=srCtor();
    if(!Ctor){
      micIdle(btn);
      toast("متصفحك لا يدعم التعرف على الكلام. جرّب Chrome أو Edge. ⌨️ اكتب إجابتك بدلًا من الكلام.","err");
      return;
    }
    if(!micSecureOk()){toast("هذا السياق قد يمنع الميكروفون. الأفضل HTTPS أو localhost. ⌨️ يمكنك الكتابة.","err");}
    _micCancel=false;
    micSetState(btn,"starting","🎤 بدء الاستماع...");
    const myGen=++_micGen;
    micPermProbe(state=>{
      if(_micCancel||myGen!==_micGen){micIdle(btn);return;}
      if(state==="denied"){
        micSetState(btn,"permission-denied");
        toast("الميكروفون غير مسموح به. اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح ثم حاول مرة أخرى.","err");
        micSetState(btn,"idle");
        return;
      }
      let r;
      try{
        r=new Ctor();
        r.lang="de-DE";
        r.continuous=false;
        r.interimResults=true;
        r.maxAlternatives=3;
      }catch(e){micSetState(btn,"error");toast("تعذر إنشاء التعرف على الكلام. 🔄","err");micSetState(btn,"idle");return;}
      _micRec=r;
      let finalGot=false,errDone=false;
      _micFinal="";_micInterim="";
      if(fb){fb.classList.add("hidden");}
      r.onstart=function(){micSetState(btn,"listening","🎤 جاري الاستماع... تحدث بالألمانية ⏹ إيقاف");};
      r.onresult=function(e){
        try{
          micSetState(btn,"processing","⏳ معالجة الكلام...");
          let interim="",final="";
          for(let k=e.resultIndex||0;k<e.results.length;k++){
            const res=e.results[k];
            const t=res[0]&&res[0].transcript?res[0].transcript:"";
            if(res.isFinal){if(t.length>final.length)final=t;}
            else if(t.length>interim.length)interim=t;
          }
          if(final){finalGot=true;_micFinal=final;inp.value=final;}
          else if(interim){_micInterim=interim;inp.value=interim;}
          micSetState(btn,"listening","🎤 جاري الاستماع... تحدث بالألمانية ⏹ إيقاف");
          if(finalGot&&typeof onFinal==="function"){try{onFinal(final);}catch(ex){}}
        }catch(ex){}
      };
      r.onerror=function(e){
        const m=srErrorMsg(e);
        errDone=true;
        micSetState(btn,"error");
        if(m)toast(m,"err");
        _micRec=null;
        micSetState(btn,"idle");
      };
      r.onend=function(){
        /* natural end (result received or user pressed stop) is NOT an error;
           after a real error we already toasted — always return to idle */
        _micRec=null;
        if(finalGot){micSetState(btn,"success");toast("✅ تم التقاط الإجابة: "+_micFinal,"ok");}
        micSetState(btn,"idle");
      };
      try{r.start();}catch(e){micSetState(btn,"error");toast("تعذر بدء التسجيل. تأكد من السماح بالميكروفون ثم حاول. 🔄","err");micSetState(btn,"idle");}
    });
  });
}
function renderSp(i){
  const box=$("spBox");
  if(i>=SPEAK_ITEMS.length){box.innerHTML='<div class="quiz-feedback ok">أكملت تمارين التحدث 🎤 أحسنت!</div>';return;}
  const it=SPEAK_ITEMS[i];
  box.innerHTML='<div class="muted">تمرين '+(i+1)+'/'+SPEAK_ITEMS.length+'</div><h4>'+escapeHtml(it.q)+'</h4><div class="muted">'+escapeHtml(it.ar)+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="spHear">🔊 اسمع السؤال</button></div><div class="quiz-write"><input type="text" id="spIn" autocomplete="off" placeholder="Antwort auf Deutsch..."><button class="btn btn-primary sm mic-btn" id="spMic">🎙️ اضغط للتحدث</button><button class="btn btn-gold sm" id="spOk">تحقق ✅</button></div><div class="quiz-feedback hidden" id="spFb"></div><div class="muted">مثال إجابة: '+escapeHtml(it.sample)+'</div>';
  $("spHear").addEventListener("click",()=>speakGerman(it.q));
  startMic($("spMic"),$("spIn"),$("spFb"),function(final){
    const fb=$("spFb");fb.classList.remove("hidden");
    fb.className="quiz-feedback ok";fb.textContent="🎤 سمعتك: "+final+" — اضغط تحقق للتقييم.";
  });
  $("spOk").addEventListener("click",()=>{
    const v=$("spIn").value.trim(), fb=$("spFb");fb.classList.remove("hidden");
    if(v.length<2){fb.className="quiz-feedback no";fb.textContent="اكتب أو قل إجابة أولًا.";return;}
    const ev=evaluateSpoken(v,it.sample);
    fb.className="quiz-feedback ok";
    fb.textContent="إجابتك: "+v+" — تطابق الكلمات: "+ev.vocab+"% ("+ev.words+" كلمات)"+(ev.missing.length?" — ناقصك: "+ev.missing.join("، "):" — كلماتك كاملة 🎉")+" — "+ev.notes.join(" ");
    spDone(i);setTimeout(()=>renderSp(i+1),3200);
  });
}
function spDone(i){
  ensureLearn();
  if(!S.journey.speak[i]){S.journey.speak[i]={date:todayStr()};addXP(25);toast("تحدث ⭐+25","ok");}
  S.lstats.sn++;S.lstats.sok++;
  save();checkAch();
}
/* ---------- Conversation ---------- */
const TALK_SITS=[
{id:"intro",t:"👋 التعارف",steps:[
 ["Hallo! Wie heißt du?","أهلًا! ما اسمك؟",["Ich bin 20 Jahre alt.","Ich heiße Sara.","Tschüs!"],1],
 ["Woher kommst du?","من أين أنت؟",["Ich wohne in Berlin.","Danke!","Ich komme aus Spanien."],2],
 ["Was machst du gern?","ماذا تحب أن تفعل؟",["Ich lese gern Bücher.","Ich bin müde.","Bis später!"],0],
 ["Freut mich! Tschüs!","سعدت بلقائك! سلام!",["Guten Appetit!","Freut mich auch! Tschüs!","Prost!"],1]]},
{id:"rest",t:"🍽️ في المطعم",steps:[
 ["Guten Tag! Was möchten Sie?","نهارك سعيد! ماذا تريد؟",["Wo ist der Bahnhof?","Ich bin 20.","Ich möchte eine Pizza."],2],
 ["Sonst noch etwas?","شيء آخر؟",["Nein, danke. Zahlen, bitte!","Ja, ein Auto.","Tschüs!"],0],
 ["Das macht 12 Euro.","الحساب 12 يورو.",["Guten Morgen!","Hier, bitte. Danke!","Bis morgen!"],1],
 ["Guten Appetit!","بالهناء!",["Auf Wiedersehen!","Prost!","Danke, gleichfalls!"],2]]},
{id:"shop",t:"🛒 التسوق",steps:[
 ["Was kostet das Brot?","كم سعر الخبز؟",["Ich bin Lehrer.","Das Brot kostet 2 Euro.","Gute Nacht!"],1],
 ["Brauchen Sie eine Tüte?","هل تحتاج كيسًا؟",["Nein, ich bin satt.","Danke, gleichfalls!","Ja, bitte."],2],
 ["Sonst noch etwas?","شيء آخر؟",["Nein, das ist alles.","Ich wohne hier.","Tschüs!"],0],
 ["Danke! Tschüs!","شكرًا! سلام!",["Guten Appetit!","Bitte! Tschüs!","Prost!"],1]]},
{id:"uni",t:"🏫 الجامعة",steps:[
 ["Was studierst du?","ماذا تدرس؟",["Ich esse Pizza.","Gute Reise!","Ich studiere Medizin."],2],
 ["Wann beginnt der Kurs?","متى يبدأ الكورس؟",["Um neun Uhr.","Im Kino.","Zu Hause!"],0],
 ["Verstehst du die Aufgabe?","هل تفهم المهمة؟",["Nein, ich schlafe.","Ja, alles klar.","Danke!"],1],
 ["Viel Erfolg!","بالتوفيق!",["Guten Appetit!","Prost!","Danke, gleichfalls!"],2]]},
{id:"work",t:"💼 العمل",steps:[
 ["Wie sind Ihre Arbeitszeiten?","ما مواعيد عملك؟",["Ich bin krank.","Von neun bis fünf Uhr.","Im Bett!"],1],
 ["Haben Sie Erfahrung?","هل لديك خبرة؟",["Ja, zwei Jahre.","Nein, danke.","Tschüs!"],0],
 ["Können Sie am Montag anfangen?","هل يمكنك البدء الاثنين؟",["Nein, nie.","Vielleicht!","Ja, gern."],2],
 ["Willkommen im Team!","أهلًا بك في الفريق!",["Gute Nacht!","Danke! Ich freue mich!","Prost!"],1]]},
{id:"hotel",t:"🏨 الفندق",steps:[
 ["Guten Abend! Haben Sie reserviert?","مساء الخير! هل حجزت؟",["Ich bin 20.","Ja, auf den Namen Omar.","Tschüs!"],1],
 ["Einzel- oder Doppelzimmer?","غرفة فردية أم مزدوجة؟",["Ich wohne hier.","Gute Nacht!","Einzelzimmer, bitte."],2],
 ["Wie lange bleiben Sie?","كم ستبقى؟",["Ich bin nett.","Drei Nächte.","Prost!"],1],
 ["Hier ist Ihr Schlüssel.","هذا مفتاحك.",["Danke schön!","Guten Appetit!","Bis morgen!"],0]]},
{id:"freunde",t:"🎉 الأصدقاء",steps:[
 ["Was machst du am Wochenende?","ماذا تفعل نهاية الأسبوع؟",["Ich bin ein Tisch.","Ich besuche meine Familie.","Gute Nacht!"],1],
 ["Kommst du mit ins Kino?","هل تأتي معنا للسينما؟",["Ich bin 30 Jahre alt.","Das Wetter ist schön.","Ja, gern! Wann?"],2],
 ["Wo treffen wir uns?","أين نتقابل؟",["Tschüs!","Vor dem Kino.","In meinem Kühlschrank."],1],
 ["Bis später!","أراك لاحقًا!",["Bis später, mach's gut!","Guten Appetit!","Prost Mahlzeit!"],0]]}];
function renderTalk(){
  ensureLearn();
  let h='<div class="panel glass"><h3>💬 المحادثة — تدريب تفاعلي</h3><div class="muted">اختر موقفًا ورد على الأسئلة (تدريب بقواعد ثابتة تناسب A1).</div></div><div class="grid-2" id="talkSits"></div><div id="talkBox"></div>';
  $("talkBox").innerHTML=h;
  $("talkSits").innerHTML=TALK_SITS.map(s=>{
    const done=S.journey.talk[s.id];
    return '<button class="quick-btn" data-t="'+s.id+'">'+s.t+' '+(done?"✓":"")+'</button>';
  }).join("");
  $("talkSits").querySelectorAll("[data-t]").forEach(b=>b.addEventListener("click",()=>startTalk(b.getAttribute("data-t"))));
}
function startTalk(id){
  const sit=TALK_SITS.find(s=>s.id===id);if(!sit)return;
  const box=$("talkBox");let i=0,score=0;
  function step(){
    if(i>=sit.steps.length){
      if(!S.journey.talk[id]){S.journey.talk[id]={date:todayStr()};addXP(20);toast("محادثة ⭐+20","ok");}
      save();checkAch();
      box.innerHTML='<div class="quiz-feedback ok">أنهيت محادثة '+sit.t+' — إجابات ممتازة: '+score+'/'+sit.steps.length+' 🎉</div>';
      renderTalk();window.scrollTo({top:0,behavior:"smooth"});return;
    }
    const st=sit.steps[i];
    const sh=shuffleOptions(st[2],st[3]);
    box.innerHTML='<div class="muted">'+sit.t+' — '+(i+1)+'/'+sit.steps.length+'</div><div class="talk-bot">🤖 '+escapeHtml(st[0])+' <button class="mini-btn" id="tkHear">🔊</button><div class="muted">'+escapeHtml(st[1])+'</div></div><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="tkFb"></div>';
    $("tkHear").addEventListener("click",e=>{e.stopPropagation();speakGerman(st[0]);});
    setTimeout(()=>speakGerman(st[0]),300);
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("tkFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="ممتاز ✅ رد طبيعي!";score++;addXP(5);}
      else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="الأفضل: "+sh.opts[sh.correct];}
      save();setTimeout(()=>{i++;step();},1800);
    }));
  }
  step();box.scrollIntoView({behavior:"smooth"});
}
/* ---------- Real Life German ---------- */
const REAL_SITS=[
{id:"rest",t:"🍽️ المطعم",voc:[["die Speisekarte","قائمة الطعام"],["die Rechnung","الفاتورة"],["der Kellner","الجرسون"],["das Trinkgeld","البقشيش"]],phr:[["Einen Tisch für zwei, bitte.","طاولة لشخصين من فضلك."],["Die Karte, bitte.","القائمة من فضلك."],["Zahlen, bitte.","الحساب من فضلك."]],dlg:[["Guten Abend! Haben Sie reserviert?","مساء الخير! هل حجزتم؟"],["Nein, einen Tisch für zwei.","لا، طاولة لشخصين."],["Sehr gern. Bitte hier.","بكل سرور. تفضلوا هنا."],["Danke!","شكرًا!"]]},
{id:"markt",t:"🛒 السوبرماركت",voc:[["der Einkaufswagen","عربة التسوق"],["die Kasse","الكاشير"],["das Angebot","العرض"],["der Preis","السعر"]],phr:[["Wo ist die Milch?","أين الحليب؟"],["Was kostet das?","كم سعر هذا؟"],["Ich brauche eine Tüte.","أحتاج كيسًا."]],dlg:[["Guten Tag!","نهارك سعيد!"],["Guten Tag! Wo ist das Brot?","نهارك سعيد! أين الخبز؟"],["Ganz hinten links.","في الآخر يسارًا."],["Danke!","شكرًا!"]]},
{id:"uni",t:"🏫 الجامعة",voc:[["die Vorlesung","المحاضرة"],["der Hörsaal","قاعة المحاضرات"],["die Prüfung","الامتحان"],["der Studentenausweis","كارنيه الطالب"]],phr:[["Wann beginnt die Vorlesung?","متى تبدأ المحاضرة؟"],["Wo ist der Hörsaal?","أين قاعة المحاضرات؟"],["Ich habe eine Frage.","لدي سؤال."]],dlg:[["Bist du neu hier?","هل أنت جديد هنا؟"],["Ja, ich studiere Medizin.","نعم، أدرس الطب."],["Willkommen! Ich heiße Jonas.","أهلًا! اسمي يوناس."],["Freut mich!","سعدت بلقائك!"]]},
{id:"work",t:"💼 العمل",voc:[["die Besprechung","الاجتماع"],["der Chef","المدير"],["die E-Mail","الإيميل"],["der Urlaub","الإجازة"]],phr:[["Wann ist die Besprechung?","متى الاجتماع؟"],["Ich schicke eine E-Mail.","سأرسل إيميلًا."],["Ich habe Urlaub.","لدي إجازة."]],dlg:[["Guten Morgen!","صباح الخير!"],["Guten Morgen! Ist Herr Schmidt da?","صباح الخير! هل السيد شميدت موجود؟"],["Ja, im Büro.","نعم، في المكتب."],["Danke!","شكرًا!"]]},
{id:"air",t:"✈️ المطار",voc:[["der Flug","الرحلة"],["das Gate","البوابة"],["der Pass","جواز السفر"],["das Gepäck","الأمتعة"]],phr:[["Wo ist Gate 5?","أين بوابة 5؟"],["Mein Flug hat Verspätung.","رحلتي متأخرة."],["Hier ist mein Pass.","هذا جواز سفري."]],dlg:[["Ihren Pass, bitte.","جوازك من فضلك."],["Hier, bitte.","تفضل."],["Danke. Guten Flug!","شكرًا. رحلة سعيدة!"],["Danke!","شكرًا!"]]},
{id:"home",t:"🏠 الشقة",voc:[["die Miete","الإيجار"],["der Vermieter","المالك"],["die Kaution","التأمين"],["die Nebenkosten","المصاريف الإضافية"]],phr:[["Wie hoch ist die Miete?","كم الإيجار؟"],["Ist die Wohnung frei?","هل الشقة متاحة؟"],["Wann kann ich einziehen?","متى يمكنني الانتقال؟"]],dlg:[["Ist die Wohnung noch frei?","هل الشقة ما زالت متاحة؟"],["Ja, ab Mai.","نعم، من مايو."],["Wie hoch ist die Miete?","كم الإيجار؟"],["500 Euro warm.","500 يورو شامل."]]},
{id:"train",t:"🚆 محطة القطار",voc:[["der Bahnsteig","الرصيف"],["die Fahrkarte","التذكرة"],["die Verspätung","التأخير"],["der Anschluss","المواصلة"]],phr:[["Wann fährt der Zug?","متى يتحرك القطار؟"],["Eine Fahrkarte nach Berlin.","تذكرة إلى برلين."],["Von welchem Bahnsteig?","من أي رصيف؟"]],dlg:[["Eine Fahrkarte nach Hamburg.","تذكرة إلى هامبورج."],["Einfach oder hin und zurück?","ذهاب فقط أم ذهاب وعودة؟"],["Hin und zurück.","ذهاب وعودة."],["Das macht 40 Euro.","الحساب 40 يورو."]]},
{id:"doc",t:"🏥 الطبيب",voc:[["der Termin","الموعد"],["die Schmerzen","الآلام"],["das Rezept","الروشتة"],["die Apotheke","الصيدلية"]],phr:[["Ich brauche einen Termin.","أحتاج موعدًا."],["Ich habe Kopfschmerzen.","لدي صداع."],["Wo ist die Apotheke?","أين الصيدلية؟"]],dlg:[["Was fehlt Ihnen?","ما مشكلتك؟"],["Ich habe Fieber.","لدي حمى."],["Nehmen Sie diese Tabletten.","خذ هذه الأقراص."],["Danke, Herr Doktor!","شكرًا دكتور!"]]},
{id:"phone",t:"📞 مكالمة",voc:[["der Anruf","المكالمة"],["besetzt","مشغول"],["die Nachricht","الرسالة"],["zurückrufen","يعاود الاتصال"]],phr:[["Hallo, hier spricht Ahmed.","ألو، معك أحمد."],["Sind Sie da?","هل أنت موجود؟"],["Ich rufe später an.","سأتصل لاحقًا."]],dlg:[["Hallo?","ألو؟"],["Hallo, hier spricht Sara. Ist Ali da?","ألو، معك سارة. هل علي موجود؟"],["Nein, er ist nicht da.","لا، هو غير موجود."],["Danke, tschüs!","شكرًا، سلام!"]]},
{id:"job",t:"🧑‍💼 مقابلة عمل",voc:[["die Bewerbung","طلب التوظيف"],["der Lebenslauf","السيرة الذاتية"],["die Erfahrung","الخبرة"],["das Gehalt","الراتب"]],phr:[["Erzählen Sie von sich.","حدثنا عن نفسك."],["Ich habe zwei Jahre Erfahrung.","لدي خبرة سنتين."],["Wann kann ich anfangen?","متى يمكنني البدء؟"]],dlg:[["Stellen Sie sich vor.","عرّف بنفسك."],["Ich heiße Omar. Ich bin Koch.","اسمي عمر. أنا طباخ."],["Haben Sie Erfahrung?","هل لديك خبرة؟"],["Ja, drei Jahre.","نعم، ثلاث سنوات."]]},
{id:"ausb",t:"🇩🇪 Ausbildung",voc:[["der Ausbilder","المدرب"],["der Betrieb","الشركة"],["die Berufsschule","مدرسة المهنة"],["der Vertrag","العقد"]],phr:[["Ich mache eine Ausbildung.","أتدرب مهنيًا."],["Wo ist die Berufsschule?","أين مدرسة المهنة؟"],["Wer ist mein Ausbilder?","من مدربي؟"]],dlg:[["Was lernst du?","ماذا تتعلم؟"],["Ich mache eine Ausbildung als Koch.","أتدرب كطباخ."],["Viel Erfolg!","بالتوفيق!"],["Danke!","شكرًا!"]]},
{id:"daily",t:"☀️ الحياة اليومية",voc:[["der Alltag","اليوم العادي"],["der Haushalt","المنزل/التدبير"],["der Spaziergang","التمشية"],["die Freizeit","وقت الفراغ"]],phr:[["Was machst du heute?","ماذا تفعل اليوم؟"],["Ich gehe spazieren.","أتمشى."],["Bis später!","أراك لاحقًا!"]],dlg:[["Was machst du am Wochenende?","ماذا تفعل نهاية الأسبوع؟"],["Ich besuche meine Familie.","أزور عائلتي."],["Schön! Viel Spaß!","جميل! استمتع!"],["Danke!","شكرًا!"]]}];
function renderReal(){
  let h='<div class="panel glass"><h3>🌍 Real Life German — مواقف عملية</h3><div class="muted">مفردات + عبارات + حوار لكل موقف.</div></div><div id="realList"></div><div id="realBox"></div>';
  $("realBox").innerHTML=h;
  $("realList").innerHTML='<div class="grid-2">'+REAL_SITS.map(s=>'<button class="quick-btn" data-r="'+s.id+'">'+s.t+'</button>').join("")+'</div>';
  $("realList").querySelectorAll("[data-r]").forEach(b=>b.addEventListener("click",()=>openReal(b.getAttribute("data-r"))));
}
function openReal(id){
  const s=REAL_SITS.find(x=>x.id===id);if(!s)return;
  const box=$("realBox");
  box.innerHTML='<div class="panel glass"><h3>'+s.t+'</h3><button class="btn btn-ghost sm" id="realBack">← كل المواقف</button>'+
  '<h4>📚 كلمات</h4>'+s.voc.map(v=>'<div class="ex-de"><div class="ex-de-l">'+escapeHtml(v[0])+' <button class="mini-btn" data-sp="'+escapeHtml(v[0])+'">🔊</button></div><div class="ex-ar">'+escapeHtml(v[1])+'</div></div>').join("")+
  '<h4>💬 عبارات مفيدة</h4>'+s.phr.map(v=>'<div class="ex-de"><div class="ex-de-l">'+escapeHtml(v[0])+' <button class="mini-btn" data-sp="'+escapeHtml(v[0])+'">🔊</button></div><div class="ex-ar">'+escapeHtml(v[1])+'</div></div>').join("")+
  '<h4>🗣️ حوار</h4>'+s.dlg.map(v=>'<div class="ex-de"><div class="ex-de-l">'+escapeHtml(v[0])+' <button class="mini-btn" data-sp="'+escapeHtml(v[0])+'">🔊</button></div><div class="ex-ar">'+escapeHtml(v[1])+'</div></div>').join("")+'</div>';
  $("realBack").addEventListener("click",renderReal);
  box.querySelectorAll("[data-sp]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();speakGerman(b.getAttribute("data-sp"));}));
  box.scrollIntoView({behavior:"smooth"});
}
/* ---------- Ausbildung German ---------- */
const JOB_VOC=[["die Bewerbung","طلب التوظيف"],["der Lebenslauf","السيرة الذاتية"],["das Vorstellungsgespräch","مقابلة التعارف"],["die Erfahrung","الخبرة"],["die Schicht","الوردية"],["der Lohn","الأجر"],["der Urlaubsantrag","طلب الإجازة"],["die Krankmeldung","إخطار المرض"],["der Arbeitsvertrag","عقد العمل"],["die Probezeit","فترة التجربة"],["der Kollege","الزميل"],["die Chefin","المديرة"]];
const JOB_QA=[["Erzählen Sie etwas über sich.","حدثنا عن نفسك.","Ich heiße Omar. Ich bin zwanzig Jahre alt. Ich komme aus Ägypten.","اسمي عمر. عمري عشرون. أنا من مصر."],["Warum möchten Sie hier arbeiten?","لماذا تريد العمل هنا؟","Ich möchte Deutsch lernen und Erfahrung sammeln.","أريد تعلم الألمانية واكتساب خبرة."],["Was sind Ihre Stärken?","ما نقاط قوتك؟","Ich bin pünktlich und fleißig.","أنا دقيق ومجتهد."],["Haben Sie schon gearbeitet?","هل عملت من قبل؟","Ja, ein Jahr als Kellner.","نعم، سنة كجرسون."],["Wann können Sie anfangen?","متى يمكنك البدء؟","Ab nächstem Monat.","من الشهر القادم."],["Haben Sie Fragen?","هل لديك أسئلة؟","Wie sind die Arbeitszeiten?","ما مواعيد العمل؟"]];
const JOB_FORMAL=[["Könnten Sie mir bitte helfen?","هل يمكنك مساعدتي من فضلك؟"],["Entschuldigen Sie die Störung.","عذرًا على الإزعاج."],["Vielen Dank für Ihre Hilfe.","شكرًا جزيلًا لمساعدتك."],["Ich habe eine Frage.","لدي سؤال."],["Bis morgen!","إلى الغد!"],["Schönes Wochenende!","نهاية أسبوع سعيدة!"]];
function renderJob(){
  let h='<div class="panel glass"><h3>🇩🇪 Ausbildung & العمل</h3><div class="muted">لغة الشغل الحقيقية: كلمات + مقابلات + رسميات.</div></div>';
  h+='<div class="panel glass"><h4>📚 كلمات الشغل</h4>'+JOB_VOC.map(v=>'<div class="ex-de"><div class="ex-de-l">'+escapeHtml(v[0])+' <button class="mini-btn" data-sp="'+escapeHtml(v[0])+'">🔊</button></div><div class="ex-ar">'+escapeHtml(v[1])+'</div></div>').join("")+'</div>';
  h+='<div class="panel glass"><h4>🎤 أسئلة المقابلات</h4>'+JOB_QA.map(v=>'<div class="ex-de"><div class="ex-de-l">❓ '+escapeHtml(v[0])+' <button class="mini-btn" data-sp="'+escapeHtml(v[0])+'">🔊</button></div><div class="ex-ar">'+escapeHtml(v[1])+'</div><div class="ex-de-l" style="margin-top:6px">✅ '+escapeHtml(v[2])+' <button class="mini-btn" data-sp="'+escapeHtml(v[2])+'">🔊</button></div><div class="ex-ar">'+escapeHtml(v[3])+'</div></div>').join("")+'</div>';
  h+='<div class="panel glass"><h4>🤝 جمل رسمية</h4>'+JOB_FORMAL.map(v=>'<div class="ex-de"><div class="ex-de-l">'+escapeHtml(v[0])+' <button class="mini-btn" data-sp="'+escapeHtml(v[0])+'">🔊</button></div><div class="ex-ar">'+escapeHtml(v[1])+'</div></div>').join("")+'</div>';
  const box=$("jobBox");box.innerHTML=h;
  box.querySelectorAll("[data-sp]").forEach(b=>b.addEventListener("click",()=>speakGerman(b.getAttribute("data-sp"))));
}
/* ---------- Achievements page ---------- */
function renderAch(){
  ensureLearn();checkAch();
  const ds=achDefs();
  const got=ds.filter(a=>S.ach[a.id]).length;
  $("achBox").innerHTML='<div class="panel glass"><h3>🏆 الإنجازات '+got+'/'+ds.length+'</h3><div class="ach-grid">'+ds.map(a=>{
    const done=!!S.ach[a.id];
    return '<div class="ach-card '+(done?"done":"locked")+'"><div style="font-size:28px">'+(done?"🏆":"🔒")+'</div><b>'+a.t+'</b><div class="muted">'+a.d+'</div><div class="muted">'+a.p+'</div></div>';
  }).join("")+'</div></div>';
}
/* ---------- Dashboard widgets + wiring ---------- */
function renderLearnWidgets(){
  try{
    ensureLearn();
    const el=$("dashLearn");
    if(el){
      const st=journeyStages();
      const total=Math.round(st.reduce((a,s)=>a+s.p,0)/st.length*100);
      const ds=achDefs(), got=ds.filter(a=>S.ach[a.id]).length;
      el.innerHTML='<div class="panel glass reveal"><h3>🗺️ رحلتي</h3><div class="muted">German Journey: '+total+'% • 🏆 '+got+'/'+ds.length+(S.place?' • مستواك: '+S.place.lvl:'')+'</div><div class="progress"><div class="progress-fill" style="width:'+total+'%"></div></div><div class="row-flex"><button class="btn btn-primary sm" data-go2="journey">أكمل الرحلة ←</button>'+(S.place?'':'<button class="btn btn-gold sm" data-go2="journey">حدد مستواك 🎯</button>')+'</div></div>';
      el.querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-go2"))));
    }
  }catch(e){}
  try{checkAch();}catch(e){}
}
const LEARN_PAGES={journey:renderJourney,listen:renderListen,speak:renderSpeak,talk:renderTalk,real:renderReal,job:renderJob,ach:renderAch};
(function(){
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(LEARN_PAGES[n])LEARN_PAGES[n]();}catch(e){console.error(e);}};
    const _rd=renderDashboard;
    renderDashboard=function(){_rd();try{renderLearnWidgets();}catch(e){}};
    ensureLearn();
  }catch(e){console.error(e);}
})();



