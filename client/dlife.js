/* DEUTSCH LIFE — scenario training (NOT missions, NOT life sim).
   Free-response + scoring + feedback. Reuses: speakGerman/startMic/evaluateSpoken/
   recordMistake/openExplain/openWordDetail/addXP/earnCoins, vocab data. No backend. */
"use strict";
function ensureDl(){if(!S.dlife)S.dlife={done:{},scores:{}};return S.dlife;}
const DL_SITS=[
{id:"shopping",icon:"🛒",t:"Shopping",ar:"التسوق",steps:[
 {k:"listen",say:"Guten Tag! Kann ich helfen?",sayAr:"نهارك سعيد! هل أساعدك؟"},
 {k:"say",say:"Was brauchen Sie?",sayAr:"ماذا تحتاج؟",expect:["milch","brot","milch und brot"],sample:"Ich brauche Milch und Brot.",hint:"مثال: Ich brauche Milch."},
 {k:"vocab",de:"die Milch",ar:"??????"},{k:"say",say:"Sonst noch etwas?",sayAr:"شيء آخر؟",expect:["nein","danke","nein danke"],sample:"Nein, danke.",hint:"مثال: Nein, danke."}]},
{id:"restaurant",icon:"🍽️",t:"Restaurant",ar:"المطعم",steps:[
 {k:"listen",say:"Guten Abend! Einen Tisch für zwei?",sayAr:"مساء الخير! طاولة لشخصين؟"},
 {k:"say",say:"Was möchten Sie essen?",sayAr:"ماذا تريد أن تأكل؟",expect:["pizza"],sample:"Ich möchte Pizza.",hint:"مثال: Ich möchte Pizza."},
 {k:"vocab",de:"die Rechnung",ar:"????????"},
 {k:"say",say:"Möchten Sie etwas trinken?",sayAr:"هل تريد شيئًا للشرب؟",expect:["wasser"],sample:"Ja, Wasser bitte.",hint:"مثال: Wasser bitte."}]},
{id:"transport",icon:"🚆",t:"Transport",ar:"المواصلات",steps:[
 {k:"listen",say:"Der Zug nach Berlin fährt um zehn Uhr ab.",sayAr:"قطار برلين يتحرك العاشرة."},
 {k:"say",say:"Wohin möchten Sie fahren?",sayAr:"إلى أين تريد السفر؟",expect:["berlin"],sample:"Ich möchte nach Berlin.",hint:"مثال: Nach Berlin."},
 {k:"vocab",de:"die Fahrkarte",ar:"???????"},
 {k:"say",say:"Einfach oder hin und zurück?",sayAr:"ذهاب فقط أم ذهاب وعودة؟",expect:["einfach","hin und zurück","zurück"],sample:"Einfach, bitte.",hint:"مثال: Einfach."}]},
{id:"hotel",icon:"🏨",t:"Hotel",ar:"الفندق",steps:[
 {k:"listen",say:"Haben Sie reserviert?",sayAr:"هل حجزت؟"},
 {k:"say",say:"Wie lange bleiben Sie?",sayAr:"كم ستبقى؟",expect:["nacht","nächte","drei"],sample:"Drei Nächte.",hint:"مثال: Drei Nächte."},
 {k:"vocab",de:"der Schlüssel",ar:"المفتاح"},
 {k:"say",say:"Brauchen Sie Hilfe?",sayAr:"هل تحتاج مساعدة؟",expect:["nein","danke","nein danke"],sample:"Nein, danke.",hint:"مثال: Nein, danke."}]},
{id:"bank",icon:"🏦",t:"Bank",ar:"البنك",steps:[
 {k:"listen",say:"Was kann ich für Sie tun?",sayAr:"كيف أساعدك؟"},
 {k:"say",say:"Möchten Sie ein Konto eröffnen?",sayAr:"هل تريد فتح حساب؟",expect:["ja"],sample:"Ja, gern.",hint:"مثال: Ja, gern."},
 {k:"vocab",de:"das Konto",ar:"??????"},
 {k:"say",say:"Haben Sie einen Ausweis?",sayAr:"هل لديك هوية؟",expect:["ja","hier","pass"],sample:"Ja, hier ist mein Pass.",hint:"مثال: Ja, hier."}]},
{id:"doctor",icon:"🏥",t:"Doctor",ar:"الطبيب",steps:[
 {k:"listen",say:"Was fehlt Ihnen?",sayAr:"ما مشكلتك؟"},
 {k:"say",say:"Wo tut es weh?",sayAr:"أين الألم؟",expect:["kopf","kopfschmerzen"],sample:"Ich habe Kopfschmerzen.",hint:"مثال: Kopfschmerzen."},
 {k:"vocab",de:"die Tablette",ar:"?????"},
 {k:"say",say:"Nehmen Sie Tabletten?",sayAr:"هل تأخذ أقراصًا؟",expect:["ja","nein"],sample:"Ja, danke.",hint:"مثال: Ja."}]},
{id:"phone",icon:"📞",t:"Phone Call",ar:"مكالمة",steps:[
 {k:"listen",say:"Hallo? Wer spricht?",sayAr:"ألو؟ من يتحدث؟"},
 {k:"say",say:"Mit wem spreche ich?",sayAr:"مع من أتحدث؟",expect:["ich","heiße","bin"],sample:"Ich heiße Omar.",hint:"مثال: Ich heiße ..."},
 {k:"vocab",de:"der Anruf",ar:"????????"},
 {k:"say",say:"Kann ich eine Nachricht hinterlassen?",sayAr:"هل أترك رسالة؟",expect:["ja","nein"],sample:"Ja, bitte.",hint:"مثال: Ja."}]},
{id:"meet",icon:"🗣️",t:"Meeting Someone",ar:"التعارف",steps:[
 {k:"listen",say:"Hallo! Wie heißt du?",sayAr:"أهلًا! ما اسمك؟"},
 {k:"say",say:"Woher kommst du?",sayAr:"من أين أنت؟",expect:["komme","aus"],sample:"Ich komme aus Ägypten.",hint:"مثال: Aus Ägypten."},
 {k:"vocab",de:"der Freund",ar:"??????"},
 {k:"say",say:"Was machst du gern?",sayAr:"ماذا تحب أن تفعل؟",expect:["fußball","lesen","musik","schwimmen","gern"],sample:"Ich spiele gern Fußball.",hint:"مثال: Fußball."}]},
{id:"school",icon:"🏫",t:"School",ar:"المدرسة",steps:[
 {k:"listen",say:"Wann beginnt der Unterricht?",sayAr:"متى تبدأ الحصة؟"},
 {k:"say",say:"In welche Klasse gehst du?",sayAr:"في أي صف أنت؟",expect:["klasse","zehn","10"],sample:"Ich gehe in Klasse zehn.",hint:"مثال: Klasse zehn."},
 {k:"vocab",de:"die Hausaufgabe",ar:"??????"},
 {k:"say",say:"Hast du die Hausaufgaben?",sayAr:"هل لديك الواجب؟",expect:["ja","nein"],sample:"Ja, hier.",hint:"مثال: Ja."}]},
{id:"interview",icon:"💼",t:"Job Interview",ar:"مقابلة العمل",steps:[
 {k:"listen",say:"Erzählen Sie etwas über sich.",sayAr:"حدثنا عن نفسك."},
 {k:"say",say:"Warum möchten Sie hier arbeiten?",sayAr:"لماذا تريد العمل هنا؟",expect:["lernen","arbeiten","deutsch"],sample:"Ich möchte Deutsch lernen.",hint:"مثال: Ich möchte lernen."},
 {k:"vocab",de:"die Erfahrung",ar:"??????"},
 {k:"say",say:"Was sind Ihre Stärken?",sayAr:"ما نقاط قوتك؟",expect:["pünktlich","fleißig","team"],sample:"Ich bin pünktlich.",hint:"مثال: Pünktlich."}]}];
function dlSuggestGame(){
  try{
    const cats={};
    Object.keys(S.mistakes||{}).forEach(id=>{const w=wordById(id);if(w&&w.cat)cats[w.cat]=(cats[w.cat]||0)+S.mistakes[id].n;});
    const top=Object.keys(cats).sort((a,b)=>cats[b]-cats[a])[0];
    if(!top)return null;
    return {t:"نقطة ضعفك: "+top+" — جرّب لعبة الكلمات لتقويتها.",go:"games"};
  }catch(e){return null;}
}
function startScenario(id){
  ensureDl();
  const s=DL_SITS.find(x=>x.id===id);if(!s)return;
  const box=$("dlifeBox");if(!box){showPage("dlife");return;}
  let i=0,vSum=0,gSum=0,n=0;
  function step(){
    if(i>=s.steps.length)return finish();
    const st=s.steps[i];
    box.innerHTML='<div class="muted">'+s.icon+" "+s.t+' — خطوة '+(i+1)+'/'+s.steps.length+'</div><div id="dQ"></div><div class="quiz-feedback hidden" id="dFb"></div><div class="row-flex"><button class="btn btn-ghost sm" id="dQuit">🚪 خروج</button></div>';
    $("dQuit").addEventListener("click",renderDlife);
    const qb=$("dQ"),fb=$("dFb");
    const showFb=(ok,html)=>{fb.classList.remove("hidden");fb.className=ok?"quiz-feedback ok":"quiz-feedback no";fb.innerHTML=html;};
    if(st.say){
      qb.innerHTML='<div class="talk-bot">🧑 '+escapeHtml(st.say)+' <button class="mini-btn" id="dHear">🔊</button><div class="muted">'+escapeHtml(st.sayAr||"")+'</div></div><div id="dIn"></div>';
      const play=()=>speakGerman(st.say);
      $("dHear").addEventListener("click",play);
      setTimeout(play,300);
    }
    if(st.expect){
      /* free response: type or speak */
      qb.innerHTML+='<div class="muted">🎯 الهدف: '+escapeHtml(st.hint||"رد بالألمانية.")+'</div><div class="quiz-write"><input type="text" id="dIn2" placeholder="Antwort auf Deutsch..."><button class="btn btn-primary sm" id="dMic">🎤</button><button class="btn btn-gold sm" id="dOk">تحقق ✅</button></div>';
      $("dMic").addEventListener("click",()=>{
        const Ctor=(typeof window!=="undefined")&&(window.SpeechRecognition||window.webkitSpeechRecognition);
        if(!Ctor){toast("المايك غير مدعوم — اكتب ⌨️","err");return;}
        try{const r=new Ctor();r.lang="de-DE";r.onresult=e=>{$("dIn2").value=e.results[0][0].transcript;toast("سمعتك ✅","ok");};r.onerror=()=>toast("تعذر السماع — اكتب ⌨️","err");r.start();toast("🎤 تحدث...","ok");}catch(e){toast("تعذر المايك","err");}
      });
      $("dOk").addEventListener("click",()=>{
        const v=$("dIn2").value.trim();if(v.length<2){showFb(false,"اكتب أو قل ردًا أولًا.");return;}
        const low=v.toLowerCase();
        const hit=(st.expect||[]).some(k=>low.indexOf(k.toLowerCase())>=0);
        let ev={vocab:hit?80:30,missing:[],notes:[]};
        try{if(typeof evaluateSpoken==="function")ev=evaluateSpoken(v,st.sample||v);}catch(e){}
        const gram=/^[A-ZÄÖÜ]/.test(v)&&/[.?!]$/.test(v)?100:60;
        vSum+=ev.vocab;gSum+=gram;n++;
        if(hit){
          showFb(true,"✅ مقبول! Grammar: "+gram+"% • Vocabulary: "+ev.vocab+"%"+(ev.missing.length?" • ناقصك: "+ev.missing.join("، "):"")+"<br>الأفضل: "+escapeHtml(st.sample||""));
          S.totalCorrect++;
        }else{
          showFb(false,"الأفضل: <b>"+escapeHtml(st.sample||"")+"</b> — "+escapeHtml(st.hint||"")+"<br>Grammar: "+gram+"% • حاول استخدام: "+(st.expect||[]).join("، "));
          try{recordMistake({id:"dl:"+s.id+":"+i,de:st.sample||st.say||s.t,ar:st.hint||"",art:"-",type:"مفردات",cat:"General"},v,"dlife");}catch(e){}
        }
        S.totalAnswered++;save();i++;setTimeout(step,2600);
      });
    }else if(st.de){
      /* vocab step */
      const w=(typeof findWord==="function")?findWord(st.de):null;
      const war=st.ar||(w?w.ar:"");
      const others=shuffle(allWords().filter(x=>(x.ar||"")!==war)).slice(0,3).map(x=>x.ar);
      const sh=shuffleOptions([war].concat(others),0);
      qb.innerHTML+='<h3 style="direction:ltr;text-align:center">'+escapeHtml(st.de)+' <button class="mini-btn" id="dHear2">🔊</button></h3><div class="muted">ما معناها؟'+(w?' <button class="mini-btn" data-wid="'+w.id+'">📖</button>':"")+'</div><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
      $("dHear2").addEventListener("click",()=>speakGerman(st.de));
      qb.querySelectorAll("[data-wid]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();try{openWordDetail(b.getAttribute("data-wid"));}catch(ex){}}));
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===sh.correct){b.classList.add("correct");showFb(true,st.de+" = "+st.ar);S.totalCorrect++;if(w){try{if(getStatus(w.id)==="new")setStatus(w.id,"review");}catch(e){}}}
        else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");showFb(false,st.de+" = "+st.ar);if(w)recordMistake(w,sh.opts[j],"dlife");}
        S.totalAnswered++;save();i++;setTimeout(step,2000);
      }));
    }else{
      /* listen step */
      const others=shuffle([st.sayAr,"نعم، شكرًا.","إلى اللقاء."]).filter((v,k,a)=>a.indexOf(v)===k).slice(0,3);
      const allOpts=others.indexOf(st.sayAr)>=0?others:[st.sayAr].concat(others).slice(0,3);
      const sh=shuffleOptions(allOpts,allOpts.indexOf(st.sayAr));
      qb.innerHTML+='<div class="muted">ماذا سمعت؟</div><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===sh.correct){b.classList.add("correct");showFb(true,"صحيح ✅");S.totalCorrect++;}
        else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");showFb(false,"سمعت: "+st.say+" = "+st.sayAr);}
        S.totalAnswered++;save();i++;setTimeout(step,2000);
      }));
    }
  }
  function finish(){
    ensureDl();
    const v=n?Math.round(vSum/n):0,g=n?Math.round(gSum/n):0;
    S.dlife.done[S.dlife.done[id]?id:id]=S.dlife.done[id]||{n:0};
    S.dlife.done[id]={n:(S.dlife.done[id].n||0)+1,v:v,g:g,date:todayStr()};
    S.dlife.scores[id]={v:v,g:g};
    addXP(60,"dlife");earnCoins(15,"dlife");markStudyDay();checkAch();save();
    const sug=dlSuggestGame();
    box.innerHTML='<div class="panel glass" style="text-align:center"><h3>🎭 '+s.t+' مكتمل!</h3><div>Vocabulary: '+v+'% • Grammar: '+g+'%</div><div>⭐+60 XP • 🪙+15</div>'+(sug?'<div class="muted">🎮 '+escapeHtml(sug.t)+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="dGame">جرّب اللعبة</button></div>':"")+'<div class="row-flex"><button class="btn btn-primary sm" id="dBack">🎭 السيناريوهات</button></div></div>';
    if(sug)$("dGame").addEventListener("click",()=>showPage(sug.go));
    $("dBack").addEventListener("click",renderDlife);
    box.scrollIntoView({behavior:"smooth"});
  }
  step();box.scrollIntoView({behavior:"smooth"});
}
function renderDlife(){
  ensureDl();
  let h='<div class="panel glass"><h3>🎭 DEUTSCH LIFE — تدريب المواقف</h3><div class="muted">كل موقف جلسة مستقلة: استمع، رد كتابة أو صوتًا، واحصل على تقييم Grammar وVocabulary. المستوى: A1 • <span class="tag">🔒 A2/B1 قريبًا</span></div></div><div class="grid-2">';
  DL_SITS.forEach(s=>{
    const d=S.dlife.done[s.id];
    h+='<div class="panel glass"><h4>'+s.icon+" "+s.t+'</h4><div class="muted">'+s.ar+' • '+s.steps.length+' خطوات'+(d?" • ✅ "+(d.n||1)+'x':"")+'</div><button class="btn btn-primary sm" data-dl="'+s.id+'">ابدأ 🚀</button></div>';
  });
  h+='</div><div id="dlifeBox"></div>';
  $("dlifeBox").innerHTML=h;
  $("dlifeBox").querySelectorAll("[data-dl]").forEach(b=>b.addEventListener("click",()=>startScenario(b.getAttribute("data-dl"))));
}
function renderExp(){
  const box=$("expBox");if(!box)return;
  box.innerHTML='<div class="grid-2">'
  +'<div class="panel glass exp-myg"><h3>🌍 MY GERMANY</h3><div class="muted">Live a virtual life in Germany.</div><div class="muted">عِش حياة افتراضية: بيت، شغل، بنك، قرارات ومهنة.</div><button class="btn btn-primary sm" id="expMy">Enter My Germany ←</button></div>'
  +'<div class="panel glass exp-dl"><h3>🎭 DEUTSCH LIFE</h3><div class="muted">Practice German through real-life situations.</div><div class="muted">تدرّب على موقف لغوي مكثف: استمع، رد، واحصل على تقييم.</div><button class="btn btn-gold sm" id="expDl">Enter Deutsch Life ←</button></div></div>';
  $("expMy").addEventListener("click",()=>showPage("mygermany"));
  $("expDl").addEventListener("click",()=>showPage("dlife"));
}
/* dashboard widgets */
function dlProgress(){
  ensureDl();
  const total=DL_SITS.length;
  const dn=Object.keys(S.dlife.done).length;
  return {dn:dn,total:total,pct:Math.round(dn/Math.max(1,total)*100)};
}
function renderExpWidgets(){
  try{
    const el=$("dashLearn");
    if(el){
      ensureMyg();ensureDl();
      const m=S.myg, p=dlProgress();
      const d=document.createElement("div");
      d.className="panel glass reveal";
      d.innerHTML='<h3>🇩🇪 تجارب ألمانية</h3>'
      +'<div class="muted">🌍 حياتي: يوم '+m.day+' • '+euro(m.balance)+' • مهارات '+mygSkillAvg()+'%</div>'
      +'<div class="muted">🎭 مواقف: '+p.dn+'/'+p.total+' ('+p.pct+'%)</div>'
      +'<div class="row-flex"><button class="btn btn-primary sm" data-exp="mygermany">🌍 حياتي</button><button class="btn btn-gold sm" data-exp="dlife">🎭 موقف</button><button class="btn btn-ghost sm" data-exp="exp">🌍 التجارب</button></div>';
      el.appendChild(d);
      d.querySelectorAll("[data-exp]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-exp"))));
    }
  }catch(e){}
}
/* wiring */
const DLIFE_PAGES={dlife:renderDlife,exp:renderExp};
(function(){
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(DLIFE_PAGES[n])DLIFE_PAGES[n]();}catch(e){console.error(e);}};
    const _rd=renderDashboard;
    renderDashboard=function(){_rd();try{renderExpWidgets();}catch(e){}};
  }catch(e){console.error(e);}
})();
