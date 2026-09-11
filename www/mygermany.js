/* MY GERMANY — long-term life simulation (NOT missions, NOT scenario drills).
   Own state S.myg. Reuses only primitives: addXP/earnCoins/speakGerman/startMic/
   evaluateSpoken/recordMistake/openExplain/Store.save, vocab data, TutorAPI(none). */
"use strict";
function ensureMyg(){
  if(!S.myg)S.myg={goal:null,level:"A1",day:1,balance:820,home:"WG-Zimmer",
    career:{track:null,stage:0},skills:{comm:0,trans:0,shop:0,work:0,hous:0,admin:0,money:0,social:0},
    schedIdx:0,log:[],income:0,expenses:0,seenEvents:{}};
  const m=S.myg;
  if(m.balance==null)m.balance=820;
  ["comm","trans","shop","work","hous","admin","money","social"].forEach(k=>{if(m.skills[k]==null)m.skills[k]=0;});
  if(!m.career)m.career={track:null,stage:0};
  if(!m.log)m.log=[];
  if(!m.seenEvents)m.seenEvents={};
  return m;
}
const MYG_GOALS=[
{id:"studium",t:"🎓 Studium",path:["Ankunft","Deutschkurs","Bewerbung Uni","Erste Vorlesung","Prüfungen","Studentenjob"]},
{id:"arbeit",t:"💼 Arbeit",path:["Ankunft","Deutschkurs","Bewerbung","Interview","Erster Arbeitstag","Festanstellung"]},
{id:"ausbildung",t:"🏫 Ausbildung",path:["Ankunft","Deutschkurs","Ausbildungsplatz","Berufsschule","Praxis","Gesellenprüfung"]},
{id:"newlife",t:"🧳 New Life",path:["Ankunft","Anmeldung","Deutschkurs","Alltag","Arbeit","Zuhause"]}] ;
const MYG_CHARS=[
{id:"boss",t:"👨‍💼 Herr Schmidt (Employer)",lines:["Pünktlichkeit ist wichtig!","Gute Arbeit heute."]},
{id:"teacher",t:"👩‍🏫 Frau Weber (Teacher)",lines:["Bitte wiederholen!","Sehr gut gemacht!"]},
{id:"kollege",t:"👨‍🔧 Ali (Kollege)",lines:["Kommst du mit zum Mittagessen?","Wir helfen uns."]},
{id:"amt",t:"👩‍💼 Frau Becker (Amt)",lines:["Haben Sie einen Termin?","Bitte das Formular."]},
{id:"vermieter",t:"🏠 Herr Yilmaz (Vermieter)",lines:["Die Miete bitte pünktlich.","Kein Problem."]},
{id:"kellner",t:"👨‍🍳 Kellner",lines:["Was möchten Sie bestellen?","Guten Appetit!"]}];
function mygChar(id){return MYG_CHARS.find(c=>c.id===id)||MYG_CHARS[0];}
/* schedule templates per goal (A1 German only) */
function mygSchedule(){
  const m=ensureMyg();
  const work=m.career.track==="studium"?"Universität":(m.career.track==="newlife"?"Stadt":"Arbeit");
  return [
    {slot:"08:00",t:"Frühstück",de:"Ich frühstücke zu Hause.",ar:"أفطر في البيت.",skill:"shop",kind:"vocab",cat:"Food"},
    {slot:"09:00",t:"Deutschkurs",de:"Ich lerne Deutsch.",ar:"أتعلم الألمانية.",skill:"comm",kind:"listen"},
    {slot:"11:00",t:work,de:work==="Universität"?"Ich höre eine Vorlesung.":"Ich arbeite.",ar:work==="Universität"?"أحضر محاضرة.":"أعمل.",skill:"work",kind:"reply"},
    {slot:"14:00",t:"Mittagessen",de:"Ich esse zu Mittag.",ar:"أتغدى.",skill:"shop",kind:"vocab",cat:"Food"},
    {slot:"18:00",t:"Einkaufen",de:"Ich kaufe Brot und Milch.",ar:"أشتري خبزًا وحليبًا.",skill:"money",kind:"shopbuy"},
    {slot:"19:00",t:"Freunde treffen",de:"Ich treffe meine Freunde.",ar:"أقابل أصدقائي.",skill:"social",kind:"speak"}];
}
/* Free-answer questions for the "speak" slot (A1, full German sentences).
   q = question shown (German, full sentence) | qAr = question translation (muted).
   a = INTERNAL model answer: used only for post-submit evaluation, NEVER rendered before submit. */
const MYG_SPEAK_Q=[
 {q:"Wen triffst du am Abend?",qAr:"من تقابل في المساء؟",a:"Ich treffe meine Freunde."},
 {q:"Was möchtest du in Deutschland machen?",qAr:"ماذا تريد أن تفعل في ألمانيا؟",a:"Ich möchte eine Ausbildung machen."},
 {q:"Wo möchtest du in Deutschland wohnen?",qAr:"أين تريد أن تعيش في ألمانيا؟",a:"Ich möchte in Berlin wohnen."},
 {q:"Warum möchtest du nach Deutschland gehen?",qAr:"لماذا تريد الذهاب إلى ألمانيا؟",a:"Ich möchte dort arbeiten und lernen."},
 {q:"Was möchtest du in Deutschland lernen?",qAr:"ماذا تريد أن تتعلم في ألمانيا؟",a:"Ich möchte Deutsch lernen."},
 {q:"Was isst du gern zum Frühstück?",qAr:"ماذا تحب أن تأكل على الفطور؟",a:"Ich esse gern Brot und Käse."}];
function mygSpeakQ(){
  try{const m=ensureMyg();return MYG_SPEAK_Q[(Math.max(1,m.day)-1)%MYG_SPEAK_Q.length];}
  catch(e){return MYG_SPEAK_Q[0];}
}
/* dynamic events pool */
const MYG_EVENTS=[
{id:"ev-train",t:"🚆 Dein Zug hat Verspätung.",q:"Was machst du?",opts:[{t:"Ich warte.",fx:{xp:10},r:"Geduldig. +10 XP."},{t:"Ich nehme einen anderen Zug.",fx:{xp:15,skill:["trans",4]},r:"Flexibel! Transport +4."},{t:"Ich rufe meinen Arbeitgeber an.",fx:{xp:20,skill:["work",3],coin:0},r:"Professionell! Arbeit +3."}]},
{id:"ev-shop",t:"🏪 Der Supermarkt schließt früh.",q:"Was machst du?",opts:[{t:"Ich kaufe schnell ein.",fx:{xp:10},r:"Schnell eingekauft."},{t:"Ich komme morgen wieder.",fx:{xp:10,skill:["shop",2]},r:"Gute Planung."},{t:"Ich frage: Bis wann offen?",fx:{xp:15,skill:["comm",3]},r:"Gut gefragt!"}]},
{id:"ev-boss",t:"📞 Dein Arbeitgeber ruft an.",q:"Er fragt: Kommst du morgen früh?",opts:[{t:"Ja, gern. Um acht Uhr.",fx:{xp:20,skill:["work",4]},r:"Sehr professionell!"},{t:"Nein.",fx:{xp:5},r:"Kurz, aber ok."},{t:"Ich verstehe nicht.",fx:{xp:5,skill:["comm",1]},r:"Ehrlich. Übe weiter!"}]},
{id:"ev-termin",t:"📅 Dein Termin hat sich geändert.",q:"Neuer Termin: morgen 10 Uhr. Antwort?",opts:[{t:"Danke, bis morgen!",fx:{xp:15,skill:["admin",3]},r:"Höflich bestätigt."},{t:"Das geht nicht.",fx:{xp:10},r:"Ok, frag nach neuem Termin."},{t:"Ok.",fx:{xp:8},r:"Kurz und gut."}]},
{id:"ev-money",t:"💶 Unerwartete Rechnung: €25.",q:"Was machst du?",opts:[{t:"Ich zahle sofort.",fx:{euro:-25,xp:10},r:"Bezahlt. -€25."},{t:"Ich frage nach Raten.",fx:{xp:15,skill:["money",3]},r:"Klug verhandelt!"}]},
{id:"ev-home",t:"🏠 Problem: Wasser tropft.",q:"Was machst du?",opts:[{t:"Ich rufe den Vermieter an.",fx:{xp:15,skill:["hous",4]},r:"Richtig! Vermieter +4."},{t:"Ich warte.",fx:{xp:5},r:"Ok, aber langsam."},{t:"Ich repariere selbst.",fx:{xp:10,skill:["hous",2]},r:"Mutig!"}]},
{id:"ev-msg",t:"📩 Wichtige Nachricht vom Amt.",q:"Du musst antworten.",opts:[{t:"Ich komme morgen mit Pass.",fx:{xp:15,skill:["admin",3]},r:"Perfekt vorbereitet."},{t:"Was? Ich verstehe nicht.",fx:{xp:8,skill:["comm",2]},r:"Frag nach!"}]},
{id:"ev-chef",t:"👨‍💼 Chef fragt: Bist du fertig?",q:"Antwort?",opts:[{t:"Ja, fast fertig.",fx:{xp:15,skill:["work",3]},r:"Gute Antwort."},{t:"Nein, morgen.",fx:{xp:10},r:"Ehrlich."},{t:"Keine Ahnung.",fx:{xp:5},r:"Übe Arbeitsdeutsch."}]}];
/* ---------- onboarding ---------- */
function renderMyg(){
  ensureMyg();
  const m=S.myg;
  if(!m.goal){renderMygOnboard();return;}
  renderMygHome();
}
function renderMygOnboard(){
  const box=$("mygermanyBox");
  box.innerHTML='<div class="panel glass" style="text-align:center"><h3>🇩🇪 Create Your Germany Life</h3><div class="muted">اختر هدفك. لا نطلب بيانات شخصية حقيقية.</div><div class="grid-2">'+MYG_GOALS.map(g=>'<button class="btn btn-ghost sm" data-mgoal="'+g.id+'">'+g.t+'</button>').join("")+'</div><div class="muted">مستواك الحالي: A1 • لغتك: العربية</div></div>';
  box.querySelectorAll("[data-mgoal]").forEach(b=>b.addEventListener("click",()=>{
    const m=ensureMyg();m.goal=b.getAttribute("data-mgoal");m.level="A1";m.day=1;
    m.career={track:m.goal,stage:0};m.schedIdx=0;
    m.log.push({d:1,t:"Ankunft in Deutschland ✈️"});
    save();addXP(20,"myg-start");checkAch();
    toast("Willkommen in Deutschland! 🇩🇪 +20 XP","ok");
    renderMygHome();
  }));
}
/* ---------- home dashboard ---------- */
function mygSkillAvg(){const m=ensureMyg();const k=Object.keys(m.skills);return Math.round(k.reduce((a,x)=>a+Math.min(100,m.skills[x]),0)/k.length);}
function renderMygHome(){
  ensureMyg();
  const m=S.myg,box=$("mygermanyBox");
  const g=MYG_GOALS.find(x=>x.id===m.goal);
  const sk=Object.keys(m.skills).map(k=>({k:k,v:Math.min(100,m.skills[k])}));
  box.innerHTML='<div class="panel glass myg-hero"><h3>Good Morning! 🇩🇪 اليوم '+m.day+'</h3>'
  +'<div class="grid-2">'
  +'<div><b>👤 أنت</b><div class="muted">الهدف: '+(g?g.t:"—")+' • الألمانية: '+m.level+'</div>'
  +'<div><b>🏠 السكن:</b> '+escapeHtml(m.home)+'</div>'
  +'<div><b>💼 المهنة:</b> '+escapeHtml(mygCareerStage())+'</div></div>'
  +'<div><b>💰 البنك:</b> '+euro(m.balance)+'<div class="muted">دخل: €'+m.income+' • مصروف: €'+m.expenses+'</div>'
  +'<div><b>🇩🇪 تقدم ألمانيا:</b> '+mygSkillAvg()+'%</div><div class="progress"><div class="progress-fill" style="width:'+mygSkillAvg()+'%"></div></div></div>'
  +'</div>'
  +'<div class="row-flex"><button class="btn btn-primary sm" id="mygDay">▶️ ابدأ اليوم</button><button class="btn btn-ghost sm" id="mygChars">🎭 الشخصيات</button><button class="btn btn-ghost sm" id="mygBank">🏦 كشف الحساب</button><button class="btn btn-ghost sm" id="mygLog">📜 يومياتي</button></div>'
  +'<h4>❤️ مهارات الحياة</h4>'+sk.map(s=>'<div class="stat-bar-row"><span class="lbl">'+mygSkillName(s.k)+'</span><div class="bar"><div class="fill" style="width:'+s.v+'%;background:linear-gradient(90deg,#7c3aed,#00d4ff)"></div></div><b>'+s.v+'%</b></div>').join("")
  +'<div id="mygSub"></div>';
  $("mygDay").addEventListener("click",mygRunDay);
  $("mygChars").addEventListener("click",renderMygChars);
  $("mygBank").addEventListener("click",renderMygBank);
  $("mygLog").addEventListener("click",renderMygLog);
}
function mygSkillName(k){return {comm:"التواصل",trans:"المواصلات",shop:"التسوق",work:"العمل",hous:"السكن",admin:"الإدارة",money:"المال",social:"الحياة الاجتماعية"}[k]||k;}
function mygCareerStage(){
  const m=ensureMyg();
  const g=MYG_GOALS.find(x=>x.id===m.career.track);
  if(!g)return "—";
  return g.path[Math.min(m.career.stage,g.path.length-1)];
}
function mygAddSkill(k,n){const m=ensureMyg();m.skills[k]=Math.min(100,(m.skills[k]||0)+n);save();}
function mygMoney(delta,why){
  const m=ensureMyg();
  m.balance=Math.round((m.balance+delta)*100)/100;
  if(delta>=0)m.income=Math.round((m.income+delta)*100)/100;
  else m.expenses=Math.round((m.expenses-delta)*100)/100;
  m.log.push({d:m.day,t:(delta>=0?"+":"")+ "€"+delta+" — "+why});
  save();
}
function mygCharsHTML(){
  return MYG_CHARS.map(c=>'<div class="ex-de"><div class="ex-de-l">'+c.t+'</div><div class="ex-ar">يقول: '+c.lines.map(escapeHtml).join(" / ")+'</div></div>').join("");
}
function renderMygChars(){
  const box=$("mygSub");if(!box)return;
  box.innerHTML='<div class="panel glass"><h4>🎭 شخصيات حياتك</h4>'+mygCharsHTML()+'</div>';
  box.scrollIntoView({behavior:"smooth"});
}
function renderMygBank(){
  const m=ensureMyg();const box=$("mygSub");if(!box)return;
  const rows=m.log.filter(l=>/€/.test(l.t)).slice(-10).reverse();
  box.innerHTML='<div class="panel glass"><h4>🏦 كشف الحساب: '+euro(m.balance)+'</h4>'+(rows.length?rows.map(l=>'<div class="muted">يوم '+l.d+": "+escapeHtml(l.t)+"</div>").join(""):'<div class="muted">لا حركات بعد.</div>')+'</div>';
  box.scrollIntoView({behavior:"smooth"});
}
function renderMygLog(){
  const m=ensureMyg();const box=$("mygSub");if(!box)return;
  box.innerHTML='<div class="panel glass"><h4>📜 يومياتك</h4>'+(m.log.length?m.log.slice(-12).reverse().map(l=>'<div class="muted">يوم '+l.d+": "+escapeHtml(l.t)+"</div>").join(""):'<div class="muted">ابدأ أول يوم!</div>')+'</div>';
  box.scrollIntoView({behavior:"smooth"});
}
/* ---------- day engine ---------- */
function mygCatWords(cat,n){
  try{
    const pool=shuffle(allWords().filter(w=>w.cat===cat));
    return pool.slice(0,n||1);
  }catch(e){return [];}
}
function mygRunDay(){
  const m=ensureMyg();
  const box=$("mygermanyBox");
  const sched=mygSchedule();
  let i=0,earned=0,curSq=null;
  const dayLog=[];
  function act(){
    if(i>=sched.length)return events();
    const a=sched[i];
    if(a.kind==="speak"){
      /* Q&A flow: full German question + muted Arabic translation only.
         The model answer stays internal until the user submits. */
      curSq=mygSpeakQ();
      box.innerHTML='<div class="muted">📅 اليوم '+m.day+' • '+a.slot+' • '+escapeHtml(a.t)+'</div><div class="panel glass"><div class="muted">Frage</div><div class="ex-de-l" id="mygQDe">'+escapeHtml(curSq.q)+' <button class="mini-btn" id="mygHear">🔊</button></div><div class="muted" id="mygQAr">'+escapeHtml(curSq.qAr)+'</div><div id="mygQ"></div></div>';
      $("mygHear").addEventListener("click",()=>speakGerman(curSq.q));
    }else{
      box.innerHTML='<div class="muted">📅 اليوم '+m.day+' • '+a.slot+' • '+escapeHtml(a.t)+'</div><div class="panel glass"><div class="ex-de-l">'+escapeHtml(a.de)+' <button class="mini-btn" id="mygHear">🔊</button></div><div class="ex-ar">'+escapeHtml(a.ar)+'</div><div id="mygQ"></div></div>';
      $("mygHear").addEventListener("click",()=>speakGerman(a.de));
    }
    const qb=$("mygQ");
    if(a.kind==="vocab"){
      const ws=mygCatWords(a.cat,1),w=ws[0];
      if(!w){i++;act();return;}
      const others=shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar);
      const sh=shuffleOptions([w.ar].concat(others),0);
      qb.innerHTML='<div class="muted">ما معنى: '+escapeHtml(fullDe(w))+'؟</div><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="mygFb"></div>';
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        const fb=$("mygFb");fb.classList.remove("hidden");
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅";earned+=10;addXP(10,"myg");mygAddSkill(a.skill,3);dayLog.push(a.t+" ✅");}
        else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ "+fullDe(w)+" = "+w.ar;recordMistake(w,sh.opts[j],"myg");dayLog.push(a.t+" ❌");}
        S.totalAnswered++;save();i++;setTimeout(act,1800);
      }));
    }else if(a.kind==="listen"){
      qb.innerHTML='<div class="row-flex"><button class="btn btn-primary sm" id="mygHear2">🔊 استمع</button></div><div class="quiz-write"><input type="text" id="mygIn" placeholder="اكتب ما سمعت..."><button class="btn btn-gold sm" id="mygOk">تحقق ✅</button></div><div class="quiz-feedback hidden" id="mygFb"></div>';
      const play=()=>speakGerman(a.de);
      $("mygHear2").addEventListener("click",play);
      setTimeout(play,300);
      $("mygOk").addEventListener("click",()=>{
        const v=$("mygIn").value.trim(),fb=$("mygFb");fb.classList.remove("hidden");
        if(!v){fb.className="quiz-feedback no";fb.textContent="اكتب ما سمعت أولًا.";return;}
        fb.className="quiz-feedback ok";fb.textContent="✅ النص: "+a.de+" = "+a.ar;
        earned+=10;addXP(10,"myg");mygAddSkill(a.skill,3);dayLog.push(a.t+" ✅");S.totalAnswered++;S.totalCorrect++;
        try{S.lstats.ln++;S.lstats.lok++;}catch(e){}
        save();i++;setTimeout(act,2000);
      });
    }else if(a.kind==="reply"){
      const opts=shuffleOptions(["Natürlich, gern!","Ich bin 20 Jahre alt.","Tschüs!"],0);
      qb.innerHTML='<div class="muted">رد مناسب على: '+escapeHtml(a.de)+'</div><div class="quiz-opts">'+opts.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="mygFb"></div>';
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        const fb=$("mygFb");fb.classList.remove("hidden");
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===opts.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="رد طبيعي ✅";earned+=10;addXP(10,"myg");mygAddSkill(a.skill,3);dayLog.push(a.t+" ✅");S.totalCorrect++;}
        else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[opts.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ الأفضل: Natürlich, gern!";dayLog.push(a.t+" ❌");}
        S.totalAnswered++;save();i++;setTimeout(act,1800);
      }));
    }else if(a.kind==="shopbuy"){
      qb.innerHTML='<div class="muted">اشترِ: Brot (€2.50) + Milch (€1.80)</div><div class="quiz-opts">'+["€4.30","€3.30","€5.30"].map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+o+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="mygFb"></div><div class="muted">رصيدك: '+euro(m.balance)+'</div>';
      qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        const fb=$("mygFb");fb.classList.remove("hidden");
        qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===0){
          if(m.balance<4.3){fb.className="quiz-feedback no";fb.textContent="❌ رصيدك لا يكفي!";}
          else{mygMoney(-4.3,"فطور");b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="✅ اشتريت! المتبقي "+euro(m.balance);earned+=10;addXP(10,"myg");mygAddSkill(a.skill,3);mygAddSkill("money",2);dayLog.push(a.t+" ✅");S.totalCorrect++;}
        }else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ احسب مجددًا: 2.50+1.80=4.30";dayLog.push(a.t+" ❌");}
        S.totalAnswered++;save();i++;setTimeout(act,2000);
      }));
    }else if(a.kind==="speak"){
      qb.innerHTML='<div class="muted">Deine Antwort — فكّر بنفسك واكتب إجابتك بالألمانية:</div><div class="quiz-write"><input type="text" id="mygSpk" placeholder="Antwort auf Deutsch..."><button class="btn btn-primary sm" id="mygMic">🎤</button><button class="btn btn-gold sm" id="mygSpkOk">تحقق ✅</button></div><div class="quiz-feedback hidden" id="mygFb"></div>';
      try{
        startMic($("mygMic"),$("mygSpk"),$("mygFb"),function(t){toast("سمعتك ✅","ok");});
      }catch(e){}
      $("mygSpkOk").addEventListener("click",()=>{
        const v=$("mygSpk").value.trim(),fb=$("mygFb");fb.classList.remove("hidden");
        if(v.length<2){fb.className="quiz-feedback no";fb.textContent="تحدث أو اكتب إجابة أولًا.";return;}
        let ev={vocab:50,missing:[]};
        try{if(typeof evaluateSpoken==="function")ev=evaluateSpoken(v,(curSq&&curSq.a)||a.de);}catch(e){}
        fb.className="quiz-feedback ok";
        fb.textContent="إجابتك: "+v+" — تطابق الكلمات: "+ev.vocab+"%"+(ev.missing.length?" • ناقصك: "+ev.missing.join("، "):"")+" ✅";
        earned+=15;addXP(15,"myg-speak");mygAddSkill(a.skill,4);mygAddSkill("comm",2);dayLog.push(a.t+" ✅");
        S.totalAnswered++;S.totalCorrect++;
        try{S.lstats.sn++;S.lstats.sok++;}catch(e){}
        save();i++;setTimeout(act,2200);
      });
    }else{i++;act();}
  }
  function events(){
    const pool=MYG_EVENTS.filter(e=>!m.seenEvents[e.id]||Math.random()<0.3);
    const evs=shuffle(pool).slice(0,2);
    let k=0;
    function next(){
      if(k>=evs.length)return endDay();
      const ev=evs[k];
      m.seenEvents[ev.id]=(m.seenEvents[ev.id]||0)+1;save();
      const sh=shuffle(ev.opts.map((o,oi)=>oi));
      box.innerHTML='<div class="muted">⚡ حدث اليوم '+(k+1)+'/'+evs.length+'</div><div class="panel glass"><h4>'+ev.t+'</h4><div class="muted">'+ev.q+'</div><div class="quiz-opts">'+sh.map(oi=>'<button class="quiz-opt" data-oi="'+oi+'">'+escapeHtml(ev.opts[oi].t)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="mygFb2"></div></div>';
      box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const oi=parseInt(b.getAttribute("data-oi"),10);
        const o=ev.opts[oi],fx=o.fx||{};
        const fb=$("mygFb2");fb.classList.remove("hidden");
        box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        b.classList.add("correct");
        if(fx.euro)mygMoney(fx.euro,"حدث");
        if(fx.skill)mygAddSkill(fx.skill[0],fx.skill[1]);
        if(fx.coin)earnCoins(fx.coin,"myg");
        earned+=fx.xp||10;addXP(fx.xp||10,"myg");
        fb.className="quiz-feedback ok";fb.textContent="✅ "+o.r;
        dayLog.push("حدث: "+o.t);
        save();k++;setTimeout(next,2000);
      }));
    }
    next();
  }
  function endDay(){
    if(m.day%7===0){mygMoney(-120,"إيجار أسبوعي");}
    if(m.day%2===1){mygMoney(45,"راتب/مصروف");}
    const g=MYG_GOALS.find(x=>x.id===m.career.track);
    if(g&&m.day%3===0&&m.career.stage<g.path.length-1){m.career.stage++;toast("🎓 تقدم مهني: "+g.path[m.career.stage],"ok");}
    m.log.push({d:m.day,t:"يوم مكتمل: "+dayLog.join("، ").slice(0,120)});
    m.day++;m.schedIdx=0;save();markStudyDay();checkAch();
    box.innerHTML='<div class="panel glass" style="text-align:center">🌙<h3>انتهى اليوم '+(m.day-1)+'!</h3><div>⭐+'+earned+' XP • رصيدك: '+euro(m.balance)+'</div><div class="muted">'+dayLog.map(escapeHtml).join("<br>")+'</div><div class="row-flex"><button class="btn btn-primary sm" id="mygHome">🏠 الرئيسية</button></div></div>';
    $("mygHome").addEventListener("click",renderMygHome);
    box.scrollIntoView({behavior:"smooth"});
  }
  act();
}
/* wiring */
const MYG_PAGES={mygermany:renderMyg};
(function(){
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(MYG_PAGES[n])MYG_PAGES[n]();}catch(e){console.error(e);}};
  }catch(e){console.error(e);}
})();
