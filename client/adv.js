/* Deutsch Master - Advanced systems (ADDITIVE ONLY, no duplicates).
   Builds on existing features instead of recreating them:
   - My Mistakes v2: enriches S.mistakes (question/correct/kap/rule/date), tabs
     (all/recent/frequent/mastered), practice + similar questions. Extends the
     existing page-mistakes + recordMistake (keeps old entries working).
   - Weekly Report + Skill Mastery map + Learning Path: appended to dashboard,
     100% real data (studyDays/timeLog/quizHistory/lstats/lessons), honest
     empty-states, never invented numbers.
   - Smart Review: upgraded via wordWeight (recency + SRS-due + difficulty) in
     script.js; no second system created.
   - Listening Lab (page-lislab): 5 types (choose/type/complete/arrange/spot)
     + speeds 0.75/1/1.25. Reuses speakGerman/SENTENCES/allWords.
   - Sentence Fix (page-fixsent) + Error Spot (page-finderr): curated banks,
     write/click interactions, explanations, similar follow-ups.
   - Challenge Generator (page-chall): shuffled skill order per session,
     level-aware via quizLevel filter.
   - AI Tutor coach: data-driven advice (top mistake category, weak skills,
     kapitel) + one-click targeted training. Extends existing tutorBox.
   - German Journey phases: 6 gated phases with real % requirements,
     informational (never blocks existing buttons).
   - Real-life: 6 new DL_SITS scenarios pushed (train/uni/jobiv/ausbildung/
     wohnung/directions); dlife renders them automatically. Second-chance
     retry added in dlife.js (not duplicated here).
   Reuses: showPage-wrap pattern, escapeHtml, shuffle, buildQuestions/makeQ,
   speakGerman, addXP, markStudyDay, checkAch, save, todayStr, kapName. */
"use strict";
/* ---------- i18n (merged additively; checked by tools/check-translations.js) ---------- */
try{
  Object.assign(I18N.ar,{nav_lislab:"مختبر الاستماع",nav_fixsent:"صحح الجملة",nav_finderr:"اكتشف الخطأ",nav_chall:"تحدي جديد",title_lislab:"🎧 مختبر الاستماع",title_fixsent:"🩺 صحح الجملة",title_finderr:"🔍 اكتشف الخطأ",title_chall:"🎯 تحدي جديد",adv_weekly:"📊 التقرير الأسبوعي",adv_skills:"🧭 خريطة المهارات",adv_path:"🧭 ماذا تدرس الآن؟",adv_mist_all:"الكل",adv_mist_recent:"الأخيرة",adv_mist_freq:"الأكثر تكرارًا",adv_mist_done:"تم إتقانها",adv_practice:"🎯 تدرب عليه",adv_similar:"🔁 سؤال مشابه",adv_mastered:"تم إتقانه ✅",adv_today:"اقتراح اليوم",adv_coach:"🤖 نصيحة المدرّب",adv_start_training:"ابدأ التدريب 🚀",adv_new_challenge:"تحدي جديد 🎯",adv_listen_again:"🔊 إعادة",adv_check:"تحقق ✅",adv_next:"التالي ←",adv_retry:"🔄 حاول مرة أخرى",adv_empty_week:"لا توجد بيانات كافية هذا الأسبوع بعد. حل اختبارًا أو العب لعبة وستظهر إحصائياتك هنا.",adv_empty_mist:"لا توجد أخطاء — استمر! 🎉"});
  Object.assign(I18N.en,{nav_lislab:"Listening Lab",nav_fixsent:"Fix the Sentence",nav_finderr:"Spot the Error",nav_chall:"New Challenge",title_lislab:"🎧 Listening Lab",title_fixsent:"🩺 Fix the Sentence",title_finderr:"🔍 Spot the Error",title_chall:"🎯 New Challenge",adv_weekly:"📊 Weekly Report",adv_skills:"🧭 Skill Map",adv_path:"🧭 What to study now?",adv_mist_all:"All",adv_mist_recent:"Recent",adv_mist_freq:"Frequent",adv_mist_done:"Mastered",adv_practice:"🎯 Practice",adv_similar:"🔁 Similar",adv_mastered:"Mastered ✅",adv_today:"Today's pick",adv_coach:"🤖 Tutor advice",adv_start_training:"Start training 🚀",adv_new_challenge:"New challenge 🎯",adv_listen_again:"🔊 Replay",adv_check:"Check ✅",adv_next:"Next ←",adv_retry:"🔄 Try again",adv_empty_week:"Not enough data yet this week. Take a quiz or play a game and your stats will appear here.",adv_empty_mist:"No mistakes — keep going! 🎉"});
  Object.assign(I18N.de,{nav_lislab:"Hörlabor",nav_fixsent:"Satz korrigieren",nav_finderr:"Fehler finden",nav_chall:"Neue Challenge",title_lislab:"🎧 Hörlabor",title_fixsent:"🩺 Satz korrigieren",title_finderr:"🔍 Fehler finden",title_chall:"🎯 Neue Challenge",adv_weekly:"📊 Wochenbericht",adv_skills:"🧭 Skill-Karte",adv_path:"🧭 Was jetzt lernen?",adv_mist_all:"Alle",adv_mist_recent:"Neueste",adv_mist_freq:"Häufigste",adv_mist_done:"Beherrscht",adv_practice:"🎯 Üben",adv_similar:"🔁 Ähnlich",adv_mastered:"Beherrscht ✅",adv_today:"Heute",adv_coach:"🤖 Tutor-Tipp",adv_start_training:"Training starten 🚀",adv_new_challenge:"Neue Challenge 🎯",adv_listen_again:"🔊 Nochmal",adv_check:"Prüfen ✅",adv_next:"Weiter ←",adv_retry:"🔄 Nochmal",adv_empty_week:"Noch nicht genug Daten diese Woche. Mach ein Quiz und deine Statistik erscheint hier.",adv_empty_mist:"Keine Fehler — weiter so! 🎉"});
}catch(e){}
/* ---------- storage ---------- */
function ensureAdv(){
  if(!S.askill)S.askill={vocab:{n:0,ok:0},grammar:{n:0,ok:0},reading:{n:0,ok:0},listening:{n:0,ok:0},speaking:{n:0,ok:0},sentence:{n:0,ok:0}};
  ["vocab","grammar","reading","listening","speaking","sentence"].forEach(k=>{if(!S.askill[k])S.askill[k]={n:0,ok:0};});
  if(!S.advChal)S.advChal={n:0,best:0,last:null};
  if(S.fixedTotal==null)S.fixedTotal=0;
  if(!S.mistTab)S.mistTab="all";
  return S.askill;
}
function advTrack(skill,ok){
  try{
    ensureAdv();
    if(S.askill[skill]){S.askill[skill].n++;if(ok)S.askill[skill].ok++;}
    save();
  }catch(e){}
}
/* Daily-goals auto progress (wired from showFeedback via advPlanTick hook).
   Quiz answers advance word goals; sentence/order advance sentence goals. */
function advPlanTick(q){
  try{
    ensureAdv();
    const t=todayStr();
    if(S.planner.day!==t){S.planner.day=t;S.planner.dw=0;S.planner.ds=0;S.planner.dm=0;}
    const kind=q&&q.kind;
    if(kind==="sentence"||kind==="order")S.planner.ds++;
    else S.planner.dw++;
    const map={"de-ar":"vocab","ar-de":"vocab",article:"grammar",plural:"grammar",write:"grammar",listening:"listening",sentence:"reading",order:"sentence"};
    // ok-ness is recorded by the caller right after; here count attempts only
    save();
    void map;
  }catch(e){}
}
function advNoteAnswer(q,ok){
  try{
    ensureAdv();
    const map={"de-ar":"vocab","ar-de":"vocab",article:"grammar",plural:"grammar",write:"grammar",listening:"listening",sentence:"reading",order:"sentence"};
    const sk=map[q&&q.kind];
    if(sk&&S.askill[sk]){S.askill[sk].n++;if(ok)S.askill[sk].ok++;}
    save();
  }catch(e){}
}
/* ---------- skill mastery (real data only) ---------- */
function advSkillLevel(p){return p>=80?"Mastered":p>=60?"Strong":p>=40?"Good":p>=20?"Developing":"Beginner";}
function advSkillLevelAr(p){return p>=80?"متقنة":p>=60?"قوية":p>=40?"جيدة":p>=20?"نامية":"مبتدئة";}
function advSkills(){
  ensureAdv();
  const out={};
  function fromAskill(k,fb){
    const s=S.askill[k]||{n:0,ok:0};
    if(s.n>=3)return{acc:Math.round(s.ok/s.n*100),n:s.n,src:"sessions"};
    return fb();
  }
  try{
    const words=allWords();
    const known=words.filter(w=>{try{return getStatus(w.id)==="known";}catch(e){return false;}}).length;
    out.vocab=fromAskill("vocab",()=>({acc:words.length?Math.round(known/words.length*100):0,n:known,src:"words"}));
    const gl=Object.keys((S.journey&&S.journey.lessons)||{}).length;
    const gT=(typeof EXPLAIN_ORDER!=="undefined"?EXPLAIN_ORDER.length:(typeof GRAMMAR!=="undefined"?GRAMMAR.length:1))||1;
    out.grammar=fromAskill("grammar",()=>({acc:Math.round(gl/gT*100),n:gl,src:"lessons"}));
    const L=S.lstats||{ln:0,lok:0,sn:0,sok:0};
    out.listening=fromAskill("listening",()=>({acc:L.ln?Math.round(L.lok/L.ln*100):0,n:L.ln,src:"exercises"}));
    out.speaking=fromAskill("speaking",()=>({acc:L.sn?Math.round(L.sok/L.sn*100):0,n:L.sn,src:"exercises"}));
    out.reading=fromAskill("reading",()=>({acc:0,n:0,src:"none"}));
    out.sentence=fromAskill("sentence",()=>({acc:0,n:0,src:"none"}));
  }catch(e){}
  return out;
}
/* ================= 1. MY MISTAKES v2 (extends existing page) ================= */
const ADV_KIND_AR={article:"الأداة",plural:"الجمع",write:"كتابة",listening:"استماع",sentence:"إكمال جملة",order:"ترتيب", "de-ar":"معنى", "ar-de":"ترجمة",battle:"معركة كلمات",rush:"أدوات سريع",speed:"سرعة",spell:"إملاء",tf:"صح/خطأ",mistakes:"مراجعة",dlife:"مواقف",myg:"My Germany",placement:"تحديد مستوى",final:"نهائي"};
function advMistakes(){
  try{if(!S.mistakes)S.mistakes={};}catch(e){return[];}
  return Object.keys(S.mistakes).map(id=>({id:id,m:S.mistakes[id]}));
}
function advMistKap(m,id){
  if(m.kap)return m.kap;
  if(m.chapterId)return m.chapterId;
  try{const w=wordById(id);if(w&&w.kap)return w.kap;}catch(e){}
  return "";
}
var renderMistakesBase=typeof renderMistakes==="function"?renderMistakes:null;
function renderMistakes(){
  try{ensureAdv();}catch(e){}
  try{
    const kf=$("mistKapitel")?$("mistKapitel").value:"";
    if($("mistKapitel")&&$("mistKapitel").options.length<=1){
      try{$("mistKapitel").innerHTML='<option value="">كل الكبيتلات</option>'+KAPITEL.filter(k=>k.id!=="KX").map(k=>'<option value="'+k.id+'">'+k.icon+" "+k.id+" • "+k.name+"</option>").join("");$("mistKapitel").value=kf;}catch(e){}
    }
    let list=advMistakes();
    if(kf)list=list.filter(x=>advMistKap(x.m,x.id)===kf);
    /* Skill filter (progress.js DMProgress): same grouping as the base
       renderer — stable kind/question ids, never display text alone. */
    try{
      const sk=$("mistSkill")?$("mistSkill").value:"";
      if(sk&&window.DMProgress)list=list.filter(x=>DMProgress.skillOfMistake(x.m,wordById(x.id))===sk);
    }catch(e){}
    const tab=S.mistTab||"all";
    const active=list.filter(x=>!x.m.done), done=list.filter(x=>x.m.done);
    let shown=active;
    if(tab==="recent")shown=active.slice().sort((a,b)=>String(b.m.date||"").localeCompare(String(a.m.date||""))).slice(0,20);
    else if(tab==="freq")shown=active.slice().sort((a,b)=>(b.m.n||0)-(a.m.n||0)).slice(0,20);
    else if(tab==="done")shown=done;
    else shown=active.slice().sort((a,b)=>(b.m.n||0)-(a.m.n||0));
    const cnt=$("mistCount");if(cnt)cnt.textContent=list.length+" • نشطة: "+active.length+" • متقنة: "+done.length;
    const badge=$("navMistBadge");if(badge)badge.textContent=active.length;
    // Tabs bar (insert once above grid)
    let tabs=$("mistTabs");
    if(!tabs){
      tabs=document.createElement("div");tabs.id="mistTabs";tabs.className="row-flex";
      const g=$("mistGrid");if(g&&g.parentNode)g.parentNode.insertBefore(tabs,g);
    }
    const tabsDef=[["all",t("adv_mist_all")+" ("+active.length+")"],["recent",t("adv_mist_recent")],["freq",t("adv_mist_freq")],["done",t("adv_mist_done")+" ("+done.length+")"]];
    tabs.innerHTML=tabsDef.map(x=>'<button class="btn sm '+(tab===x[0]?"btn-primary":"btn-ghost")+'" data-mt="'+x[0]+'">'+escapeHtml(x[1])+'</button>').join("");
    tabs.querySelectorAll("[data-mt]").forEach(b=>b.addEventListener("click",()=>{S.mistTab=b.getAttribute("data-mt");save();renderMistakes();}));
    const g=$("mistGrid");g.innerHTML="";
    if(!shown.length){g.innerHTML='<div class="panel glass">'+escapeHtml(t("adv_empty_mist"))+'<br><span class="muted">الكلمات التي تخطئ فيها أثناء الاختبارات ستظهر هنا.</span></div>';return;}
    shown.slice(0,60).forEach(x=>{
      const m=x.m;let w=null;try{w=wordById(x.id);}catch(e){}
      const kap=advMistKap(m,x.id);
      const kindAr=ADV_KIND_AR[m.kind]||m.kind||"—";
      /* Skill badge + Arabic "why" + attempt history (progress.js). Guarded:
         renders only when DMProgress is present; otherwise v2 card as before. */
      let skillHtml="",histHtml="";
      try{
        if(window.DMProgress){
          const sk=DMProgress.skillOfMistake(m,w);
          const info=DMProgress.SKILLS[sk];
          if(info)skillHtml='<div class="muted">🏷️ '+escapeHtml(info.ar)+'</div>'
            +'<div class="mist-why">💡 '+escapeHtml(info.why)
            +(info.ex&&info.ex[0]?'<br>🇩🇪 '+escapeHtml(info.ex[0])+(info.ex[1]?" — "+escapeHtml(info.ex[1]):""):"")+'</div>';
        }
      }catch(e){}
      try{
        if(Array.isArray(m.hist)&&m.hist.length){
          histHtml='<div class="muted">🕘 المحاولات: '+m.hist.map(h=>(h.ok?"✅":"❌")).join(" ")+'</div>';
        }
      }catch(e){}
      const d=document.createElement("div");d.className="mist-card glass";
      d.innerHTML='<div class="de-line" dir="ltr"><b>'+escapeHtml(m.de||(w?fullDe(w):x.id))+'</b></div>'
        +(m.q?'<div class="muted">❓ '+escapeHtml(m.q)+'</div>':"")
        +'<div class="word-ar">'+escapeHtml(m.ar||(w?w.ar:""))+'</div>'
        +skillHtml
        +'<div class="mist-err">❌ إجابتك: <b>'+escapeHtml(m.last||"—")+'</b> • ✅ الصحيحة: <b style="color:var(--green)">'+escapeHtml(m.ok||(w?w.ar:"—"))+'</b></div>'
        +histHtml
        +'<div class="muted">📝 '+(kindAr)+' • 📚 '+(kap?escapeHtml(kapName(kap)):escapeHtml(kap||"—"))+' • 🔁 تكرر <b>'+(m.n||1)+'</b> • 📅 '+escapeHtml(m.date||"—")
        +(m.done?' • <b style="color:var(--green)">'+escapeHtml(t("adv_mastered"))+'</b>':"")+'</div>'
        +'<div class="card-actions"><button class="mini-btn" data-a="speak">🔊</button><button class="mini-btn" data-a="test">'+escapeHtml(t("adv_practice"))+'</button><button class="mini-btn" data-a="sim">'+escapeHtml(t("adv_similar"))+'</button><button class="mini-btn" data-a="del">🗑️</button></div>';
      d.querySelector('[data-a="speak"]').addEventListener("click",()=>{try{if(w)speak(fullDe(w));else if(m.de)speak(m.de);}catch(e){}});
      d.querySelector('[data-a="test"]').addEventListener("click",()=>{advMistPractice(x.id,false);});
      d.querySelector('[data-a="sim"]').addEventListener("click",()=>{advMistPractice(x.id,true);});
      d.querySelector('[data-a="del"]').addEventListener("click",()=>{removeMistake(x.id);renderMistakes();});
      g.appendChild(d);
    });
  }catch(e){try{if(renderMistakesBase)renderMistakesBase();}catch(_){}}
}
/* Targeted practice: same-kind question for the word + similar ones (same kind,
   same kapitel preferred). Never endless: 6 questions max per run. */
function advMistPractice(id,similar){
  try{
    ensureAdv();
    const m=(S.mistakes||{})[id];
    let w=null;try{w=wordById(id);}catch(e){}
    /* Career-path mistakes reference module quizzes, not dictionary words:
       route back to the career page for retry instead of erroring. */
    if(!w&&/^m-(ausb|pfl)-/.test(id)){showPage("career");toast("راجع الوحدة وأعد اختبارها 🎯","ok");return;}
    if(!w&&m&&m.de){toast("الكلمة غير موجودة في القاموس","err");return;}
    if(!w){toast("الكلمة غير موجودة","err");return;}
    const words=allWords();
    const kind=(m&&m.kind&&typeof makeQ==="function")?m.kind:"mixed";
    const sim=words.filter(x=>x.id!==w.id&&(!w.kap||x.kap===w.kap)).slice(0,30);
    const pool=shuffle((sim.length>=3?sim:words.filter(x=>x.id!==w.id)).slice(0,20));
    const qs=[];
    try{
      if(kind!=="mixed"&&typeof kindFits==="function"&&kindFits(kind,w))qs.push(makeQ(kind,w,words));
      else qs.push(makeQ("de-ar",w,words));
    }catch(e){qs.push(makeQ("de-ar",w,words));}
    pool.slice(0,5).forEach(x=>{
      try{
        if(kind!=="mixed"&&typeof kindFits==="function"&&kindFits(kind,x))qs.push(makeQ(kind,x,words));
        else qs.push(makeQ("de-ar",x,words));
      }catch(e){}
    });
    showPage("quiz");
    startQuizRun("mistakes",qs.slice(0,6));
  }catch(e){}
}
/* ================= 2+3+17. DASHBOARD: weekly + skills + learning path ================= */
function advWeekRange(off){
  const out=[];
  for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i-off*7);out.push(todayStr(d));}
  return out;
}
function advWeeklyData(){
  const cur=advWeekRange(0),prev=advWeekRange(1);
  const inSet=(ds,key)=>ds.indexOf(key)>=0;
  const daysCur=cur.filter(k=>S.studyDays&&S.studyDays[k]).length;
  const daysPrev=prev.filter(k=>S.studyDays&&S.studyDays[k]).length;
  let minCur=0,minPrev=0;
  try{cur.forEach(k=>minCur+=((S.timeLog||{})[k]||0));prev.forEach(k=>minPrev+=((S.timeLog||{})[k]||0));}catch(e){}
  let qCur=0,okCur=0,qPrev=0,okPrev=0,tCur=0,tPrev=0;
  try{
    (S.quizHistory||[]).forEach(h=>{
      const dk=String(h.date||"").slice(0,10);
      if(inSet(cur,dk)){qCur+=h.total||0;okCur+=h.score||0;tCur++;}
      else if(inSet(prev,dk)){qPrev+=h.total||0;okPrev+=h.score||0;tPrev++;}
    });
  }catch(e){}
  const accCur=qCur?Math.round(okCur/qCur*100):null, accPrev=qPrev?Math.round(okPrev/qPrev*100):null;
  const L=S.lstats||{ln:0,lok:0,sn:0,sok:0};
  // best / weakest kapitel from real data
  let bestKap=null,weakKap=null;
  try{
    const words=allWords();
    const byKap={};
    words.forEach(w=>{const k=w.kap||"KX";byKap[k]=byKap[k]||{tot:0,kn:0};byKap[k].tot++;try{if(getStatus(w.id)==="known")byKap[k].kn++;}catch(e){}});
    Object.keys(byKap).forEach(k=>{byKap[k].p=byKap[k].tot?byKap[k].kn/byKap[k].tot:0;});
    const ids=Object.keys(byKap).filter(k=>byKap[k].tot>=5);
    if(ids.length){bestKap=ids.slice().sort((a,b)=>byKap[b].p-byKap[a].p)[0];weakKap=ids.slice().sort((a,b)=>byKap[a].p-byKap[b].p)[0];}
    var kapPct=byKap;
  }catch(e){}
  // top error category from mistakes kinds
  let topErr=null;
  try{
    const c={};
    Object.keys(S.mistakes||{}).forEach(id=>{const k=S.mistakes[id].kind||"?";c[k]=(c[k]||0)+S.mistakes[id].n;});
    const ks=Object.keys(c);
    if(ks.length)topErr=ks.sort((a,b)=>c[b]-c[a])[0];
  }catch(e){}
  return{daysCur:daysCur,daysPrev:daysPrev,minCur:minCur,minPrev:minPrev,qCur:qCur,okCur:okCur,qPrev:qPrev,okPrev:okPrev,tCur:tCur,tPrev:tPrev,accCur:accCur,accPrev:accPrev,L:L,bestKap:bestKap,weakKap:weakKap,kapPct:typeof kapPct!=="undefined"?kapPct:{},topErr:topErr,
    gamesTot:(function(){let n=0;try{Object.keys(S.gstats||{}).forEach(k=>n+=S.gstats[k].n||0);}catch(e){}return n;})()};
}
function advDelta(c,p,suf){
  if(p==null||c==null)return "";
  const d=c-p;
  if(d===0)return '<span class="muted"> = ثابت</span>';
  return '<span style="color:'+(d>0?"var(--green)":"var(--red)")+'">'+(d>0?"▲ +":"▼ ")+d+(suf||"")+'</span>';
}
function advDash(){
  try{
    ensureAdv();
    const dash=$("dashLearn");if(!dash)return;
    if($("advWeek"))$("advWeek").remove();
    if($("advSkills"))$("advSkills").remove();
    if($("advPath"))$("advPath").remove();
    const wrap=document.createElement("div");wrap.id="advWeek";
    const W=advWeeklyData();
    const hasData=(W.tCur+W.tPrev)>0||W.daysCur>0||W.daysPrev>0;
    let h='<div class="panel glass"><h3>'+escapeHtml(t("adv_weekly"))+'</h3>';
    if(!hasData){h+='<div class="muted">'+escapeHtml(t("adv_empty_week"))+'</div>';}
    else{
      const row=(l,c,p,suf)=>'<div class="row-flex" style="justify-content:space-between"><span>'+l+'</span><b>'+c+' '+advDelta(c,p,suf)+'</b></div>';
      h+=row("📅 أيام الدراسة",W.daysCur,W.daysPrev,"")
        +row("⏱️ دقائق التعلم",W.minCur,W.minPrev,"")
        +row("📝 أسئلة (اختبارات)",W.qCur,W.qPrev,"")
        +row("🎯 الدقة",W.accCur==null?"—":W.accCur+"%",W.accPrev,(W.accCur==null||W.accPrev==null)?"":"%")
        +row("🎮 اختبارات محلولة (أسبوع)",W.tCur,W.tPrev,"");
      h+='<div class="muted">🎧 استماع: '+(W.L.ln?Math.round(W.L.lok/W.L.ln*100)+"% ("+W.L.lok+"/"+W.L.ln+")":"—")
        +' • 🎤 تحدث: '+(W.L.sn?Math.round(W.L.sok/W.L.sn*100)+"% ("+W.L.sok+"/"+W.L.sn+")":"—")
        +' • 🎮 إجمالي ألعاب: '+W.gamesTot+'</div>';
      if(W.bestKap)h+='<div class="muted">🏆 أفضل Kapitel: <b>'+escapeHtml(kapName(W.bestKap))+'</b> ('+Math.round((W.kapPct[W.bestKap]||{}).p*100||0)+'%)</div>';
      if(W.weakKap&&W.weakKap!==W.bestKap)h+='<div class="muted">⚠️ يحتاج مراجعة: <b>'+escapeHtml(kapName(W.weakKap))+'</b> ('+Math.round((W.kapPct[W.weakKap]||{}).p*100||0)+'%)</div>';
      if(W.topErr)h+='<div class="muted">🧠 أكثر نوع يسبب أخطاء: <b>'+escapeHtml(ADV_KIND_AR[W.topErr]||W.topErr)+'</b></div>';
      h+='<div class="muted">مقارنة بالأسبوع السابق (▲▼).</div>';
    }
    h+='</div>';
    wrap.innerHTML=h;
    dash.appendChild(wrap);
    // Skills map
    const sk=document.createElement("div");sk.id="advSkills";
    const S6=advSkills();
    const names={vocab:"📚 Vocabulary",grammar:"📐 Grammar",reading:"📖 Reading",listening:"🎧 Listening",speaking:"🎤 Speaking",sentence:"🧩 Sentence Building"};
    let sh='<div class="panel glass"><h3>'+escapeHtml(t("adv_skills"))+'</h3>';
    Object.keys(names).forEach(k=>{
      const s=S6[k]||{acc:0,n:0,src:"none"};
      const low=s.n<3;
      sh+='<div style="margin:8px 0"><div class="row-flex" style="justify-content:space-between"><b>'+names[k]+'</b><span class="muted">'+(low?"— بيانات قليلة":s.acc+"% • "+escapeHtml(advSkillLevelAr(s.acc)))+'</span></div><div class="progress"><div class="progress-fill" style="width:'+(low?0:s.acc)+'%"></div></div></div>';
    });
    sh+='<div class="muted">تُحسب من نتائجك الفعلية (جلسات + تمارين + دروس).</div></div>';
    sk.innerHTML=sh;
    dash.appendChild(sk);
    // Learning path
    const ph=document.createElement("div");ph.id="advPath";
    let sug=advSuggestions();
    let phh='<div class="panel glass"><h3>'+escapeHtml(t("adv_path"))+'</h3><div class="muted">'+escapeHtml(t("adv_today"))+'</div>';
    if(!sug.length)phh+='<div class="muted">ابدأ باختبار تحديد المستوى 🎯</div>';
    else sug.slice(0,4).forEach((s,i)=>{phh+='<div class="row-flex" style="justify-content:space-between"><span>'+(i+1)+'. '+escapeHtml(s.t)+'</span><button class="btn btn-primary sm" data-path="'+s.go+'">ابدأ ←</button></div>';});
    phh+='</div>';
    ph.innerHTML=phh;
    ph.querySelectorAll("[data-path]").forEach(b=>b.addEventListener("click",()=>{try{showPage(b.getAttribute("data-path"));}catch(e){}}));
    dash.appendChild(ph);
  }catch(e){}
}
function advSuggestions(){
  const out=[];
  try{
    ensureAdv();
    const S6=advSkills();
    const weak=Object.keys(S6).filter(k=>S6[k].n>=2).sort((a,b)=>S6[a].acc-S6[b].acc)[0];
    const goMap={vocab:"vocab",grammar:"grammar",reading:"sentences",listening:"listen",speaking:"speak",sentence:"sentex"};
    const arMap={vocab:"المفردات",grammar:"القواعد",reading:"القراءة",listening:"الاستماع",speaking:"التحدث",sentence:"بناء الجمل"};
    if(weak&&S6[weak].acc<70)out.push({t:"تقوية "+arMap[weak]+" ("+S6[weak].acc+"%) — 5 دقائق",go:goMap[weak]});
    // weakest kapitel from mistakes
    const perKap={};
    Object.keys(S.mistakes||{}).forEach(id=>{const k=advMistKap(S.mistakes[id],id)||"?";perKap[k]=(perKap[k]||0)+S.mistakes[id].n;});
    const ks=Object.keys(perKap).filter(k=>k&&k!=="?").sort((a,b)=>perKap[b]-perKap[a]);
    if(ks[0])out.push({t:"مراجعة أخطاء "+kapName(ks[0])+" ("+perKap[ks[0]]+" أخطاء)",go:"mistakes"});
    const due=tryDue();
    if(due>0)out.push({t:"مراجعة اليوم: "+due+" كلمات مستحقة",go:"review"});
    const t=todayStr();
    const dw=S.planner&&S.planner.day===t?S.planner.dw:0;
    const need=Math.max(0,(S.planner?S.planner.words:20)-dw);
    if(need>0)out.push({t:"باقي لك "+need+" كلمات لإكمال هدف اليوم",go:"quiz"});
    else out.push({t:"هدف اليوم مكتمل 🎉 — جرّب تحديًا جديدًا",go:"chall"});
    out.push({t:"تحدي جديد متنوع 🎯",go:"chall"});
  }catch(e){}
  return out;
}
function tryDue(){try{if(typeof dueWords==="function")return dueWords().length;}catch(e){}return 0;}
/* ================= 9. AI TUTOR COACH (data-driven, extends tutorBox) ================= */
function advCoach(){
  try{
    ensureAdv();
    const box=$("tutorBox");if(!box||$("advCoach"))return;
    const c={};
    Object.keys(S.mistakes||{}).forEach(id=>{const k=S.mistakes[id].kind||"?";c[k]=(c[k]||0)+S.mistakes[id].n;});
    const top=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];
    const S6=advSkills();
    const weak=Object.keys(S6).filter(k=>S6[k].n>=2).sort((a,b)=>S6[a].acc-S6[b].acc)[0];
    let msg="أهلًا! ذاكر بانتظام وستتقدم بسرعة 🚀";
    if(top&&c[top]>=2)msg="لاحظت إنك بتغلط كثير في "+(ADV_KIND_AR[top]||top)+" ("+c[top]+" مرات). خلينا نراجعهم مع بعض 💪";
    else if(weak&&S6[weak].acc<60)msg="مهارة "+({vocab:"المفردات",grammar:"القواعد",reading:"القراءة",listening:"الاستماع",speaking:"التحدث",sentence:"بناء الجمل"}[weak])+" تحتاج تقوية ("+S6[weak].acc+"%). ركّز عليها اليوم 🎯";
    else if(tryDue()>0)msg="عندك "+tryDue()+" كلمات مستحقة للمراجعة. ابدأ بها اليوم 🧠";
    const d=document.createElement("div");d.id="advCoach";d.className="panel glass";
    d.innerHTML='<h3>'+escapeHtml(t("adv_coach"))+'</h3><div>'+escapeHtml(msg)+'</div><div class="row-flex"><button class="btn btn-primary sm" id="advCoachGo">'+escapeHtml(t("adv_start_training"))+'</button></div>';
    box.insertBefore(d,box.firstChild);
    $("advCoachGo").addEventListener("click",()=>{
      try{
        let words=[];
        try{if(typeof weakWords==="function"&&top)words=weakWords(8);}catch(e){}
        if(!words.length)words=shuffle(allWords()).slice(0,8);
        showPage("quiz");
        startQuizRun("mixed",buildQuestions("mixed",8,words));
      }catch(e){}
    });
  }catch(e){}
}
/* ================= 11. JOURNEY PHASES (gated, informational) ================= */
function advJourneyPhases(){
  try{
    const words=allWords();
    const known=words.filter(w=>{try{return getStatus(w.id)==="known";}catch(e){return false;}}).length;
    const vP=words.length?known/words.length:0;
    const gl=Object.keys((S.journey&&S.journey.lessons)||{}).length;
    const gT=(typeof EXPLAIN_ORDER!=="undefined"?EXPLAIN_ORDER.length:(typeof GRAMMAR!=="undefined"?GRAMMAR.length:1))||1;
    const gP=gl/gT;
    const L=S.lstats||{ln:0,lok:0,sn:0,sok:0};
    const liP=Math.min(1,(L.lok||0)/20), spP=Math.min(1,(L.sok||0)/10);
    const tN=S.testsTaken||0;
    const a1=!!(S.journey&&S.journey.final&&S.journey.final.A1);
    const st=S.streak||{count:0};
    const ph=[
      {t:"A1 Foundation",req:[["المفردات ≥ 20%",vP>=0.2,vP],["القواعد: درسان",gl>=2,gl/10]],go:"vocab"},
      {t:"Alltag — الحياة اليومية",req:[["المفردات ≥ 40%",vP>=0.4,vP],["استماع: 5 تمارين",L.lok>=5,liP]],go:"dlife"},
      {t:"Reisen — السفر",req:[["المفردات ≥ 55%",vP>=0.55,vP],["القواعد ≥ 40%",gP>=0.4,gP],["تحدث: 3",L.sok>=3,spP]],go:"real"},
      {t:"Arbeit — العمل",req:[["المفردات ≥ 70%",vP>=0.7,vP],["القواعد ≥ 65%",gP>=0.65,gP],["استماع ≥ 60%",liP>=0.6,liP]],go:"job"},
      {t:"Ausbildung",req:[["المفردات ≥ 80%",vP>=0.8,vP],["10 اختبارات",tN>=10,Math.min(1,tN/10)],["تحدي واحد",S.advChal.n>=1,Math.min(1,S.advChal.n)]],go:"chall"},
      {t:"Deutschland 🇩🇪",req:[["النهائي A1",a1,a1?1:0],["Streak 7 أيام",st.count>=7,Math.min(1,st.count/7)]],go:"journey"}
    ];
    const box=$("journeyBox");if(!box||$("advPhases"))return;
    const d=document.createElement("div");d.id="advPhases";d.className="panel glass";
    let h='<h3>🗺️ مراحل الرحلة — فتح بالمتطلبات</h3>';
    ph.forEach((p,i)=>{
      const open=p.req.every(r=>r[1]);
      const pct=Math.round(p.req.reduce((a,r)=>a+Math.min(1,r[2]||0),0)/p.req.length*100);
      h+='<div style="margin:8px 0"><div class="row-flex" style="justify-content:space-between"><b>'+(open?"✅":(i===0||ph[i-1].req.every(r=>r[1])?"🟡":"🔒"))+' '+escapeHtml(p.t)+'</b><button class="btn btn-ghost sm" data-ph="'+p.go+'">فتح ←</button></div>'
        +'<div class="progress sm"><div class="progress-fill" style="width:'+pct+'%"></div></div><div class="muted">'+p.req.map(r=>(r[1]?"✅ ":"⬜ ")+escapeHtml(r[0])).join(" • ")+'</div></div>';
    });
    d.innerHTML=h;
    box.appendChild(d);
    d.querySelectorAll("[data-ph]").forEach(b=>b.addEventListener("click",()=>{try{showPage(b.getAttribute("data-ph"));}catch(e){}}));
  }catch(e){}
}
/* ================= 5. LISTENING LAB (5 types + speeds) ================= */
function advLisRate(){try{return (S.settings&&S.settings.speed)||1;}catch(e){return 1;}}
function advSpeak(text,rate){
  const old=advLisRate();
  try{if(S&&S.settings)S.settings.speed=rate||old;}catch(e){}
  try{speakGerman(text);}catch(e){}
  try{if(S&&S.settings)S.settings.speed=old;}catch(e){}
}
function advLisItems(){
  const items=[];
  try{
    const ss=(typeof SENTENCES!=="undefined"?SENTENCES:[]).filter(s=>s.de.split(" ").length>=4&&s.de.split(" ").length<=10).slice(0,40);
    const ws=shuffle(allWords().filter(w=>w.de&&w.ar)).slice(0,30);
    // type 1: listen & choose (words)
    ws.slice(0,2).forEach(w=>{
      const opts=shuffle([w.ar].concat(shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)));
      items.push({type:"choose",de:fullDe(w),ar:w.ar,opts:opts,correct:opts.indexOf(w.ar),w:w});
    });
    // type 2: listen & type (sentences)
    ss.slice(0,2).forEach(s=>items.push({type:"type",de:s.de,ar:s.ar}));
    // type 3: listen & complete (blank middle word)
    ss.slice(2,4).forEach(s=>{
      const parts=s.de.replace(/[.?!,]/g,"").split(" ").filter(Boolean);
      if(parts.length<4)return;
      const bi=1+Math.floor(Math.random()*(parts.length-2));
      items.push({type:"complete",de:s.de,ar:s.ar,parts:parts,blank:bi,answer:parts[bi]});
    });
    // type 4: listen & arrange
    ss.slice(4,6).forEach(s=>{
      const parts=s.de.replace(/[.?!,]/g,"").split(" ").filter(Boolean);
      items.push({type:"arrange",de:s.de,ar:s.ar,parts:parts});
    });
    // type 5: detect the difference (heard vs shown variant)
    ss.slice(6,8).forEach(s=>{
      const parts=s.de.split(" ");
      const alt=parts.slice();const j=1+Math.floor(Math.random()*(alt.length-1));
      alt[j]=alt[j]==="nicht"?"sehr":(alt[j]==="der"?"die":"nicht");
      items.push({type:"spot",de:s.de,ar:s.ar,alt:alt.join(" ")});
    });
  }catch(e){}
  return shuffle(items);
}
let advLisRateSel=1;
function renderLislab(){
  ensureAdv();
  const box=$("lislabBox");if(!box)return;
  box.innerHTML='<div class="panel glass"><h3>'+escapeHtml(t("title_lislab"))+'</h3><div class="muted">5 أنواع • 10 أسئلة • سرعات متعددة</div>'
    +'<div class="row-flex"><span class="muted">السرعة:</span>'
    +[0.75,1,1.25].map(r=>'<button class="btn sm '+(advLisRateSel===r?"btn-primary":"btn-ghost")+'" data-spd="'+r+'">'+r+'x</button>').join("")
    +'</div><div class="row-flex"><button class="btn btn-primary" id="lisStart">ابدأ 🚀</button></div><div id="lisBody"></div></div>';
  box.querySelectorAll("[data-spd]").forEach(b=>b.addEventListener("click",()=>{advLisRateSel=parseFloat(b.getAttribute("data-spd"));renderLislab();}));
  $("lisStart").addEventListener("click",advLisRun);
}
function advLisRun(){
  const items=advLisItems();
  if(!items.length){toast("لا توجد جمل مناسبة","err");return;}
  let i=0,score=0;const body=$("lisBody");
  markStudyDay();
  function hear(txt){advSpeak(txt,advLisRateSel);}
  function next(){if(i>=items.length)return fin();render();}
  function fin(){
    try{
      ensureAdv();
      const L=S.lstats;const before=L.ln||0;
      L.ln=before+items.length;L.lok=(L.lok||0)+score;
      addXP(score*5+10,"lislab");markStudyDay();checkAch();save();
      advTrack("listening",score>=Math.ceil(items.length*0.6));
    }catch(e){}
    body.innerHTML='<div class="quiz-feedback ok">النتيجة: '+score+'/'+items.length+' ⭐+'+(score*5+10)+'</div><div class="row-flex"><button class="btn btn-primary sm" id="lisAgain">'+escapeHtml(t("adv_retry"))+'</button></div>';
    $("lisAgain").addEventListener("click",advLisRun);
    body.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function fb(ok,html){
    const f=$("lisFb");if(!f)return;f.classList.remove("hidden");f.className=ok?"quiz-feedback ok":"quiz-feedback no";f.innerHTML=html;
  }
  function render(){
    const it=items[i];
    let h='<div class="muted">سؤال '+(i+1)+'/'+items.length+' • '+({choose:"استمع واختر",type:"استمع واكتب",complete:"استمع وأكمل",arrange:"استمع ورتّب",spot:"اكتشف الفرق"}[it.type])+'</div>'
      +'<div class="row-flex"><button class="btn btn-primary sm" id="lisHear">🔊 استمع</button><button class="btn btn-ghost sm" id="lisAgain2">'+escapeHtml(t("adv_listen_again"))+'</button><span class="muted">'+advLisRateSel+'x</span></div><div id="lisQ"></div><div class="quiz-feedback hidden" id="lisFb"></div>';
    body.innerHTML=h;
    $("lisHear").addEventListener("click",()=>hear(it.de));
    $("lisAgain2").addEventListener("click",()=>hear(it.de));
    setTimeout(()=>hear(it.de),350);
    const q=$("lisQ");
    if(it.type==="choose"){
      const sh=shuffle(it.opts.map((_,ix)=>ix));
      q.innerHTML='<div class="quiz-opts">'+sh.map(oi=>'<button class="quiz-opt" data-j="'+oi+'">'+escapeHtml(it.opts[oi])+'</button>').join("")+'</div>';
      q.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        q.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        const ok=j===it.correct;
        if(ok){b.classList.add("correct");score++;}else{b.classList.add("wrong");const cb=q.querySelector('[data-j="'+it.correct+'"]');if(cb)cb.classList.add("correct");}
        fb(ok,(ok?"صحيح ✅ ":"❌ الصحيح: "+escapeHtml(it.ar)+"<br>")+escapeHtml(it.de));
        try{advNoteAnswer({kind:"listening"},ok);}catch(e){}
        S.totalAnswered++;if(ok)S.totalCorrect++;save();i++;setTimeout(next,1900);
      }));
    }else if(it.type==="type"){
      q.innerHTML='<div class="quiz-write"><input type="text" id="lisIn" dir="ltr" autocomplete="off" placeholder="…"><button class="btn btn-gold sm" id="lisOk">'+escapeHtml(t("adv_check"))+'</button></div>';
      const check=()=>{
        const v=$("lisIn").value.trim();
        if(!v){fb(false,"اكتب ما سمعت أولًا.");return;}
        const norm=s=>s.replace(/[.?!,]/g,"").trim().replace(/\s+/g," ").toLowerCase();
        const ok=norm(v)===norm(it.de);
        let extra="";
        if(!ok){
          const a=norm(v).split(" "),b=norm(it.de).split(" ");
          const wrong=b.filter((w,ix)=>a[ix]!==w).slice(0,3);
          extra="<br>كلمات أخطأت فيها: <b>"+escapeHtml(wrong.join("، "))+"</b><br>الصحيح: <b dir='ltr'>"+escapeHtml(it.de)+"</b> = "+escapeHtml(it.ar);
        }
        if(ok)score++;
        fb(ok,(ok?"صحيح ✅ "+escapeHtml(it.de):"❌"+extra));
        try{advNoteAnswer({kind:"listening"},ok);}catch(e){}
        S.totalAnswered++;if(ok)S.totalCorrect++;save();i++;setTimeout(next,2600);
      };
      $("lisOk").addEventListener("click",check);
      $("lisIn").addEventListener("keydown",e=>{if(e.key==="Enter")check();});
    }else if(it.type==="complete"){
      const shown=it.parts.map((p,ix)=>ix===it.blank?"_____":escapeHtml(p)).join(" ");
      q.innerHTML='<div class="muted" dir="ltr" style="font-size:19px">'+shown+'</div><div class="quiz-write"><input type="text" id="lisIn" dir="ltr" autocomplete="off" placeholder="…"><button class="btn btn-gold sm" id="lisOk">'+escapeHtml(t("adv_check"))+'</button></div>';
      const check=()=>{
        const v=$("lisIn").value.trim().replace(/[.?!,]/g,"").toLowerCase();
        const ok=v===it.answer.toLowerCase();
        if(ok)score++;
        fb(ok,ok?"صحيح ✅ "+escapeHtml(it.de):"❌ الكلمة الناقصة: <b>"+escapeHtml(it.answer)+"</b><br>"+escapeHtml(it.de)+" = "+escapeHtml(it.ar));
        try{advNoteAnswer({kind:"listening"},ok);}catch(e){}
        S.totalAnswered++;if(ok)S.totalCorrect++;save();i++;setTimeout(next,2200);
      };
      $("lisOk").addEventListener("click",check);
      $("lisIn").addEventListener("keydown",e=>{if(e.key==="Enter")check();});
    }else if(it.type==="arrange"){
      const order=shuffle(it.parts.map((_,ix)=>ix));
      let picked=[];
      q.innerHTML='<div class="order-answer" id="lisAns" dir="ltr"></div><div class="quiz-opts" dir="ltr">'+order.map(oi=>'<button class="quiz-opt" data-k="'+oi+'">'+escapeHtml(it.parts[oi])+'</button>').join("")+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="lisClear">مسح</button><button class="btn btn-primary sm" id="lisOk">'+escapeHtml(t("adv_check"))+'</button></div>';
      const ans=$("lisAns");
      q.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        if(b.disabled)return;b.disabled=true;
        const k=parseInt(b.getAttribute("data-k"),10);picked.push(k);
        const s=document.createElement("span");s.className="order-chip";s.textContent=it.parts[k];ans.appendChild(s);
      }));
      $("lisClear").addEventListener("click",()=>{picked=[];ans.innerHTML="";q.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=false);});
      $("lisOk").addEventListener("click",()=>{
        const norm=s=>s.replace(/[.?!,]/g,"").trim().replace(/\s+/g," ").toLowerCase();
        const ok=norm(picked.map(k=>it.parts[k]).join(" "))===norm(it.de);
        if(ok)score++;
        fb(ok,ok?"صحيح ✅":"❌ الصحيح: <b dir='ltr'>"+escapeHtml(it.de)+"</b>");
        try{advNoteAnswer({kind:"listening"},ok);}catch(e){}
        S.totalAnswered++;if(ok)S.totalCorrect++;save();i++;setTimeout(next,2200);
      });
    }else{
      // spot the difference: which text matches what you heard?
      const opts=shuffle([{x:it.de,c:true},{x:it.alt,c:false}]);
      q.innerHTML='<div class="muted">أي نص يطابق ما سمعت؟</div><div class="quiz-opts">'+opts.map((o,ix)=>'<button class="quiz-opt" data-j="'+ix+'" dir="ltr" style="text-align:left">'+escapeHtml(o.x)+'</button>').join("")+'</div>';
      q.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const o=opts[parseInt(b.getAttribute("data-j"),10)];
        q.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(o.c){b.classList.add("correct");score++;fb(true,"صحيح ✅ أذن قوية! 🎧");}
        else{b.classList.add("wrong");fb(false,"❌ الصحيح: <b dir='ltr'>"+escapeHtml(it.de)+"</b>");}
        try{advNoteAnswer({kind:"listening"},o.c);}catch(e){}
        S.totalAnswered++;if(o.c)S.totalCorrect++;save();i++;setTimeout(next,2200);
      }));
    }
  }
  render();
}
/* ================= 6+7. SENTENCE FIX + ERROR SPOT ================= */
/* Curated banks across 10 error categories. err=wrong token index.
   Every finderr-eligible item (err>=0) contains EXACTLY ONE intentional error.
   fix = the correct replacement for the wrong token (typed by the learner in
   step 2). lvl = A1/A2/B1 difficulty. rule = grammar rule shown AFTER solving.
   ex/exAr = one extra correct example shown AFTER solving.
   NOTE: cat is INTERNAL ONLY — the finderr UI must never render it (no hints). */
const ADV_FIX=[
 {bad:"Ich gehen zur Schule.",good:"Ich gehe zur Schule.",err:1,fix:"gehe",lvl:"A1",cat:"Verb",why:"مع ich يأتي الفعل gehe (تصريف gehen).",rule:"مع الضمير ich يُصرَّف الفعل بإضافة e: gehen ← gehe.",ex:"Ich lerne Deutsch.",exAr:"أنا أتعلم الألمانية.",kap:"K1"},
 {bad:"Er haben ein Auto.",good:"Er hat ein Auto.",err:1,fix:"hat",lvl:"A1",cat:"Verb",why:"مع er يأتي hat وليس haben.",rule:"مع المفرد الغائب (er/es/sie): haben ← hat.",ex:"Er spielt Fußball.",exAr:"هو يلعب كرة القدم.",kap:"K1"},
 {bad:"Die kind spielt.",good:"Das Kind spielt.",err:0,fix:"Das",lvl:"A1",cat:"Artikel",why:"Kind محايد: das Kind (ويُكتب بحرف كبير).",rule:"كلمة Kind محايدة دائمًا: das Kind.",ex:"Das Kind lacht.",exAr:"الطفل يضحك.",kap:"K1"},
 {bad:"Ich kaufe einen auto.",good:"Ich kaufe ein Auto.",err:2,fix:"ein",lvl:"A1",cat:"Artikel",why:"Auto محايد: ein Auto.",rule:"الاسم المحايد (das) نكرته ein وليس einen.",ex:"Ich sehe ein Auto.",exAr:"أنا أرى سيارة.",kap:"K2"},
 {bad:"Morgen ich besuche meine Oma.",good:"Morgen besuche ich meine Oma.",err:1,fix:"besuche",lvl:"A1",cat:"Word Order",why:"عند بدء الجملة بظرف زمني يأتي الفعل ثانيًا ثم الفاعل.",rule:"الظرف أولًا ← الفعل ثانيًا ← الفاعل ثالثًا (V2).",ex:"Heute lerne ich Deutsch.",exAr:"اليوم أتعلم الألمانية.",kap:"K3"},
 {bad:"Heute ich lerne Deutsch.",good:"Heute lerne ich Deutsch.",err:1,fix:"lerne",lvl:"A1",cat:"Word Order",why:"عند بدء الجملة بظرف (Heute) يأتي الفعل ثانيًا ثم الفاعل.",rule:"الظرف أولًا ← الفعل ثانيًا ← الفاعل ثالثًا (V2).",ex:"Morgen spiele ich Fußball.",exAr:"غدًا ألعب كرة القدم.",kap:"K3"},
 {bad:"Ich sehe der Mann.",good:"Ich sehe den Mann.",err:2,fix:"den",lvl:"A1",cat:"Akkusativ",why:"sehen يأخذ مفعولًا (Akkusativ): der ← den.",rule:"الفعل sehen يأخذ Akkusativ، والمذكر der ← den.",ex:"Ich sehe den Hund.",exAr:"أنا أرى الكلب.",kap:"K4"},
 {bad:"Sie hat ein Tasche.",good:"Sie hat eine Tasche.",err:1,fix:"eine",lvl:"A1",cat:"Akkusativ",why:"Tasche مؤنثة في حالة المفعول: eine Tasche.",rule:"الاسم المؤنث (die) نكرته eine.",ex:"Sie kauft eine Lampe.",exAr:"هي تشتري مصباحًا.",kap:"K4"},
 {bad:"Ich helfe den Mann.",good:"Ich helfe dem Mann.",err:2,fix:"dem",lvl:"A2",cat:"Dativ",why:"helfen يأخذ Dativ: dem Mann.",rule:"الفعل helfen يأخذ Dativ دائمًا (وليس Akkusativ).",ex:"Ich helfe dem Kind.",exAr:"أنا أساعد الطفل.",kap:"K5"},
 {bad:"Das Buch gehört mir Vater.",good:"Das Buch gehört meinem Vater.",err:3,fix:"meinem",lvl:"A2",cat:"Dativ",why:"gehören + Dativ: meinem Vater.",rule:"الفعل gehören يأخذ Dativ: meinem Vater.",ex:"Das gehört meiner Mutter.",exAr:"هذا يخص أمي.",kap:"K5"},
 {bad:"Die kindern spielen.",good:"Die Kinder spielen.",err:1,fix:"Kinder",lvl:"A1",cat:"Plural",why:"جمع Kind هو Kinder.",rule:"جمع Kind الشاذ: die Kinder.",ex:"Die Kinder lachen.",exAr:"الأطفال يضحكون.",kap:"K2"},
 {bad:"Zwei Apfels bitte.",good:"Zwei Äpfel bitte.",err:1,fix:"Äpfel",accepts:["Aepfel"],lvl:"A1",cat:"Plural",why:"جمع Apfel هو Äpfel.",rule:"جمع Apfel: die Äpfel (مع Umlaut وبدون s).",ex:"Drei Äpfel, bitte.",exAr:"ثلاث تفاحات من فضلك.",kap:"K2"},
 {bad:"Ich habe kein Auto.",good:"Ich habe kein Auto.",err:-1,fix:"",lvl:"A1",cat:"Negation",why:"الجملة صحيحة! kein مع الأسماء النكرة.",rule:"نفي الأسماء النكرة بـ kein.",ex:"Ich habe kein Geld.",exAr:"ليس معي نقود.",kap:"K3"},
 {bad:"Ich bin nicht habe Zeit.",good:"Ich habe keine Zeit.",err:2,fix:"keine",lvl:"A1",cat:"Negation",why:"النفي الصحيح للأسماء بـ kein وليس nicht + فعل.",rule:"الأسماء تُنفى بـ kein (وليس nicht).",ex:"Ich habe kein Geld.",exAr:"ليس معي نقود.",kap:"K3"},
 {bad:"Ich fahre mit das Auto.",good:"Ich fahre mit dem Auto.",err:3,fix:"dem",lvl:"A1",cat:"Prepositions",why:"mit تأخذ Dativ دائمًا: mit dem Auto.",rule:"حرف الجر mit يأخذ Dativ دائمًا.",ex:"Ich komme mit dem Bus.",exAr:"آتي بالحافلة.",kap:"K5"},
 {bad:"Er wartet auf dem Bus.",good:"Er wartet auf den Bus.",err:3,fix:"den",lvl:"A2",cat:"Prepositions",why:"warten auf تأخذ Akkusativ: auf den Bus.",rule:"التركيب warten auf يأخذ Akkusativ.",ex:"Ich warte auf den Zug.",exAr:"أنتظر القطار.",kap:"K4"},
 {bad:"Mich heiße Ali.",good:"Ich heiße Ali.",err:0,fix:"Ich",lvl:"A1",cat:"Pronouns",why:"ضمير الفاعل: Ich وليس Mich (مفعول).",rule:"ضمير الفاعل «أنا» هو Ich؛ أما Mich ف للمفعول.",ex:"Ich komme aus Kairo.",exAr:"أنا من القاهرة.",kap:"K1"},
 {bad:"Er gibt mir das Buch.",good:"Er gibt mir das Buch.",err:-1,fix:"",lvl:"A1",cat:"Pronouns",why:"الجملة صحيحة! mir ضمير Dativ صحيح مع geben.",rule:"الفعل geben يأخذ Dativ للشخص: mir.",ex:"Er gibt mir einen Stift.",exAr:"يعطيني قلمًا.",kap:"K5"},
 {bad:"ich lerne Deutsch.",good:"Ich lerne Deutsch.",err:0,fix:"Ich",lvl:"A1",cat:"Capitalization",why:"بداية الجملة تُكتب بحرف كبير: Ich.",rule:"بداية الجملة الألمانية دائمًا بحرف كبير.",ex:"Ich wohne in Berlin.",exAr:"أسكن في برلين.",kap:"K1"},
 {bad:"Mein bruder wohnt in Kairo.",good:"Mein Bruder wohnt in Kairo.",err:1,fix:"Bruder",lvl:"A1",cat:"Capitalization",why:"الأسماء الألمانية دائمًا بحرف كبير.",rule:"كل الأسماء الألمانية تُكتب بحرف كبير.",ex:"Meine Schwester kocht gut.",exAr:"أختي تطبخ جيدًا.",kap:"K1"},
 {bad:"Wir geht ins Kino.",good:"Wir gehen ins Kino.",err:1,fix:"gehen",lvl:"A1",cat:"Verb",why:"مع wir يأتي gehen.",rule:"مع wir يبقى الفعل بصيغة المصدر: gehen.",ex:"Wir lernen Deutsch.",exAr:"نحن نتعلم الألمانية.",kap:"K1"},
 {bad:"Du hast kein Hunger?",good:"Du hast keinen Hunger?",err:2,fix:"keinen",lvl:"A1",cat:"Akkusativ",why:"Hunger مذكر في المفعول: keinen Hunger.",rule:"نفي المفعول المذكر النكرة: keinen.",ex:"Er trinkt einen Kaffee.",exAr:"هو يشرب قهوة.",kap:"K4"},
 {bad:"Sie wohnt bei ihre Eltern.",good:"Sie wohnt bei ihren Eltern.",err:3,fix:"ihren",lvl:"A2",cat:"Dativ",why:"bei + Dativ جمع: ihren Eltern.",rule:"حرف الجر bei يأخذ Dativ: bei ihren Eltern.",ex:"Er wohnt bei seinen Eltern.",exAr:"هو يسكن عند والديه.",kap:"K5"},
 {bad:"Er spielt gut fußball.",good:"Er spielt gut Fußball.",err:3,fix:"Fußball",lvl:"A1",cat:"Capitalization",why:"Fußball اسم ويُكتب بحرف كبير.",rule:"كل الأسماء الألمانية تُكتب بحرف كبير.",ex:"Ich spiele gern Fußball.",exAr:"أحب لعب كرة القدم.",kap:"K1"},
 {bad:"Ich habe einen Auto.",good:"Ich habe ein Auto.",err:2,fix:"ein",lvl:"A1",cat:"Artikel",why:"Auto محايد: ein Auto.",rule:"الاسم المحايد (das) نكرته ein.",ex:"Das ist ein Buch.",exAr:"هذا كتاب.",kap:"K2"},
 {bad:"Ich gehe mit den Freund.",good:"Ich gehe mit dem Freund.",err:3,fix:"dem",lvl:"A2",cat:"Dativ",why:"mit تأخذ Dativ: mit dem Freund.",rule:"حرف الجر mit يأخذ Dativ دائمًا.",ex:"Ich spiele mit dem Hund.",exAr:"ألعب مع الكلب.",kap:"K5"},
 {bad:"Heute ich gehe zur Schule.",good:"Heute gehe ich zur Schule.",err:1,fix:"gehe",lvl:"A1",cat:"Word Order",why:"عند بدء الجملة بظرف (Heute) يأتي الفعل ثانيًا ثم الفاعل.",rule:"الظرف أولًا ← الفعل ثانيًا ← الفاعل ثالثًا (V2).",ex:"Heute kaufe ich Brot.",exAr:"اليوم أشتري خبزًا.",kap:"K3"},
 {bad:"Ich bin gestern ins Kino gehen.",good:"Ich bin gestern ins Kino gegangen.",err:5,fix:"gegangen",lvl:"A2",cat:"Verb",why:"الماضي التام: bin + التصريف الثالث gegangen آخر الجملة.",rule:"الماضي التام (Perfekt): مساعد + Partizip II في آخر الجملة.",ex:"Ich bin nach Berlin gefahren.",exAr:"سافرتُ إلى برلين.",kap:"K2"},
 {bad:"Er kann schwimmt.",good:"Er kann schwimmen.",err:2,fix:"schwimmen",lvl:"A1",cat:"Verb",why:"بعد الفعل المساعد (kann) يأتي المصدر آخر الجملة.",rule:"الفعل المساعد + المصدر في آخر الجملة.",ex:"Sie will tanzen.",exAr:"هي تريد أن ترقص.",kap:"K5"},
 {bad:"Ich habe gestern ein Buch lesen.",good:"Ich habe gestern ein Buch gelesen.",err:5,fix:"gelesen",lvl:"A2",cat:"Verb",why:"الماضي التام مع haben: gelesen.",rule:"الماضي التام (Perfekt): haben + Partizip II.",ex:"Er hat einen Film gesehen.",exAr:"شاهد فيلمًا.",kap:"K3"},
 {bad:"Ich sehe ein große Haus.",good:"Ich sehe ein großes Haus.",err:3,fix:"großes",accepts:["grosses"],lvl:"B1",cat:"Akkusativ",why:"الصفة بعد ein المحايد في المفعول تأخذ es: großes.",rule:"الصفة بعد ein المحايد (Akkusativ): نهاية es.",ex:"Das ist ein kleines Kind.",exAr:"هذا طفل صغير.",kap:"K4"},
 {bad:"Ich bleibe zu Hause, weil ich bin krank.",good:"Ich bleibe zu Hause, weil ich krank bin.",err:7,fix:"krank",lvl:"B1",cat:"Word Order",why:"بعد weil يذهب الفعل المُصرَّف إلى آخر الجملة.",rule:"الجملة الفرعية مع weil: الفعل في الآخر.",ex:"Ich lerne, weil ich Zeit habe.",exAr:"أتعلم لأن عندي وقت.",kap:"K3"},
 {bad:"Wenn ich Zeit habe, ich besuche dich.",good:"Wenn ich Zeit habe, besuche ich dich.",err:5,fix:"besuche",lvl:"B1",cat:"Word Order",why:"بعد الجملة الفرعية تبدأ الرئيسية بالفعل.",rule:"بعد الجملة الشرطية: الفعل أولًا ثم الفاعل (V2).",ex:"Wenn es regnet, bleibe ich zu Hause.",exAr:"عندما تمطر أبقى في البيت.",kap:"K5"}
];
function advFixPool(cat){const p=ADV_FIX.filter(x=>!cat||x.cat===cat);return shuffle(p.length?p:ADV_FIX.slice());}
/* Finderr pool: exactly-one-error items (err>=0), optional level filter. */
var ferrLevel="mix";
function advFerrPool(lvl){
  const L=lvl||ferrLevel||"mix";
  let p=ADV_FIX.filter(x=>x.err>=0&&(L==="mix"||x.lvl===L));
  if(!p.length)p=ADV_FIX.filter(x=>x.err>=0);
  return shuffle(p.slice());
}
function renderFixsent(){
  ensureAdv();
  const box=$("fixsentBox");if(!box)return;
  box.innerHTML='<div class="panel glass"><h3>'+escapeHtml(t("title_fixsent"))+'</h3><div class="muted">اكتب الجملة مصححة — الأخطاء متنوعة ومناسبة لمستواك.</div><div id="fixBody"></div></div>';
  advFixRun(0,0,advFixPool());
}
function advFixRun(i,score,pool){
  const body=$("fixBody");if(!body)return;
  if(i>=Math.min(8,pool.length)){
    addXP(score*5+10,"fixsent");markStudyDay();checkAch();save();advTrack("grammar",score>=5);
    body.innerHTML='<div class="quiz-feedback ok">النتيجة: '+score+'/'+Math.min(8,pool.length)+' ⭐+'+(score*5+10)+'</div><div class="row-flex"><button class="btn btn-primary sm" id="fixAgain">'+escapeHtml(t("adv_retry"))+'</button></div>';
    $("fixAgain").addEventListener("click",()=>advFixRun(0,0,advFixPool()));
    return;
  }
  const it=pool[i];
  const norm=s=>s.replace(/[.?!,]/g,"").trim().replace(/\s+/g," ").toLowerCase();
  body.innerHTML='<div class="muted">جملة '+(i+1)+'/'+Math.min(8,pool.length)+' • النوع: '+escapeHtml(it.cat)+'</div>'
    +'<h4 dir="ltr" style="text-align:left;font-size:20px">'+escapeHtml(it.bad)+'</h4>'
    +'<div class="quiz-write"><input type="text" id="fixIn" dir="ltr" autocomplete="off" placeholder="…"><button class="btn btn-gold sm" id="fixOk">'+escapeHtml(t("adv_check"))+'</button></div><div class="quiz-feedback hidden" id="fixFb"></div>';
  const check=()=>{
    const v=$("fixIn").value.trim();
    if(!v){const f=$("fixFb");f.classList.remove("hidden");f.className="quiz-feedback no";f.textContent="اكتب التصحيح أولًا.";return;}
    const ok=norm(v)===norm(it.good);
    const f=$("fixFb");f.classList.remove("hidden");
    if(ok){score++;f.className="quiz-feedback ok";f.textContent="صحيح ✅ "+it.good;}
    else{
      f.className="quiz-feedback no";
      f.innerHTML="❌ الصحيح: <b dir='ltr'>"+escapeHtml(it.good)+"</b><br>🔍 الخطأ في: <b dir='ltr'>"+escapeHtml(it.bad.split(" ")[Math.max(0,it.err)]||"")+"</b><br>💡 "+escapeHtml(it.why);
      try{recordMistake({id:"fix:"+it.cat+":"+i,de:it.bad,ar:it.why,art:"-",type:"قواعد",cat:"Grammar",kap:it.kap},v,"sentence",{q:it.bad,ok:it.good,kap:it.kap,rule:it.cat});}catch(e){}
    }
    S.totalAnswered++;if(ok)S.totalCorrect++;save();
    try{advNoteAnswer({kind:"sentence"},ok);}catch(e){}
    const sim=ADV_FIX.filter(x=>x!==it&&x.cat===it.cat)[0];
    setTimeout(()=>{
      f.innerHTML+=(sim?"<br><span class='muted'>🔁 جملة مشابهة للتدرب: <b dir='ltr'>"+escapeHtml(sim.good)+"</b></span>":"")
        +"<br><div class='row-flex'><button class='btn btn-primary sm' id='fixNext'>"+escapeHtml(t("adv_next"))+"</button></div>";
      $("fixNext").addEventListener("click",()=>advFixRun(i+1,score,pool));
    },400);
  };
  $("fixOk").addEventListener("click",check);
  $("fixIn").addEventListener("keydown",e=>{if(e.key==="Enter")check();});
}
function renderFinderr(){
  ensureAdv();
  const box=$("finderrBox");if(!box)return;
  const lv=ferrLevel||"mix";
  const lvBtn=(id,label)=>'<button type="button" class="btn sm '+((lv===id)?"btn-primary":"btn-ghost")+'" data-ferrlvl="'+id+'">'+label+'</button>';
  box.innerHTML='<div class="panel glass"><h3>'+escapeHtml(t("title_finderr"))+'</h3>'
    +'<div class="muted">أمامك جملة ألمانية فيها خطأ واحد فقط — اكتشفه بنفسك 🔍<br>اضغط على الكلمة التي تعتقد أنها خطأ.</div>'
    +'<div class="row-flex" id="ferrLevels" role="group" aria-label="المستوى">'
    +lvBtn("mix","🌍 الكل")+lvBtn("A1","🟢 A1")+lvBtn("A2","🟡 A2")+lvBtn("B1","🔴 B1")
    +'</div><div id="ferrBody"></div></div>';
  box.querySelectorAll("[data-ferrlvl]").forEach(b=>b.addEventListener("click",()=>{
    ferrLevel=b.getAttribute("data-ferrlvl")||"mix";
    renderFinderr();
  }));
  advFerrRun(0,0,advFerrPool());
}
/* Genuine error-DETECTION exercise (NOT multiple choice):
   Phase A (find): tap a word → selected state → confirm bar
   ("هل هذا هو الجزء الذي تعتقد أنه خطأ؟" + تأكيد/تغيير). Nothing is revealed
   before confirmation; a wrong pick only says "ليس هذا الجزء".
   Phase B (correct): type the fix for the found part, then rich feedback
   (corrected sentence + why + rule + extra example). Finding and correcting
   are tracked as TWO separate skills. Never renders it.cat (no hints). */
function advFerrRun(i,score,pool){
  const body=$("ferrBody");if(!body)return;
  const items=(pool||[]).filter(x=>x&&x.err>=0&&x.fix);
  const total=Math.min(8,items.length);
  if(!items.length){
    body.innerHTML='<div class="quiz-feedback no">لا توجد جمل لهذا المستوى بعد — جرّب مستوى آخر 🔄</div>';
    return;
  }
  if(i>=total){
    addXP(score*5+10,"finderr");markStudyDay();checkAch();save();advTrack("grammar",score>=Math.ceil(total/2));
    body.innerHTML='<div class="quiz-feedback ok">النتيجة: '+score+'/'+total+' (حل نظيف من أول مرة ⭐) — ⭐+'+(score*5+10)+'</div><div class="row-flex"><button class="btn btn-primary sm" id="ferrAgain">'+escapeHtml(t("adv_retry"))+'</button></div>';
    $("ferrAgain").addEventListener("click",()=>advFerrRun(0,0,advFerrPool()));
    return;
  }
  const it=items[i];
  const toks=it.bad.replace(/([.?!,])/g," $1").split(" ").filter(Boolean);
  const errTok=toks[it.err]!==undefined?it.err:0;
  const isPunct=x=>/^[.?!,]$/.test(x);
  let step=1,selected=-1,wrongFind=0,wrongCorr=0;
  const lvlBadge={A1:"🟢 A1",A2:"🟡 A2",B1:"🔴 B1"}[it.lvl]||"";
  body.innerHTML='<div class="muted">جملة '+(i+1)+'/'+total+(lvlBadge?' • '+lvlBadge:'')+' • الخطوة 1 من 2: جد الخطأ 🕵️</div>'
    +'<div class="ferr-sent" dir="ltr" lang="de">'
    +toks.map((x,ix)=>isPunct(x)
      ?'<span class="ferr-punct" aria-hidden="true">'+escapeHtml(x)+'</span>'
      :'<button type="button" class="quiz-opt ferr-tok" data-k="'+ix+'" aria-pressed="false">'+escapeHtml(x)+'</button>').join("")
    +'</div><div class="quiz-feedback hidden" id="ferrFb"></div>'
    +'<div id="ferrConfirm"></div><div id="ferrStep2"></div>'
    +'<div class="row-flex"><button type="button" class="btn btn-ghost sm" id="ferrSkip">تخطي ⏭</button></div>';
  const fb=$("ferrFb"),cfm=$("ferrConfirm");
  function clearSel(){
    selected=-1;
    try{body.querySelectorAll(".ferr-tok").forEach(x=>{x.classList.remove("selected");x.setAttribute("aria-pressed","false");});}catch(e){}
    try{cfm.innerHTML="";}catch(e){}
  }
  body.querySelectorAll(".ferr-tok").forEach(b=>b.addEventListener("click",()=>{
    if(step!==1||b.disabled)return;
    clearSel();
    selected=parseInt(b.getAttribute("data-k"),10);
    b.classList.add("selected");b.setAttribute("aria-pressed","true");
    try{fb.classList.add("hidden");}catch(e){}
    cfm.innerHTML='<div class="ferr-confirm"><div>هل هذا هو الجزء الذي تعتقد أنه خطأ؟ «<b dir="ltr" lang="de">'+escapeHtml(toks[selected])+'</b>»</div>'
      +'<div class="row-flex"><button type="button" class="btn btn-primary sm" id="ferrOk">تأكيد ✅</button>'
      +'<button type="button" class="btn btn-ghost sm" id="ferrChange">غيّر اختيارك 🔄</button></div></div>';
    $("ferrChange").addEventListener("click",clearSel);
    $("ferrOk").addEventListener("click",()=>{
      if(step!==1||selected<0)return;
      const k=selected;
      const bb=body.querySelector('[data-k="'+k+'"]');
      if(k===errTok){
        // Found it themselves: GREEN (correct), never pre-revealed. Freeze the
        // token row so the state can't leak, then move to the correction step.
        step=2;if(bb)bb.classList.add("correct");step2();
      }
      else{
        wrongFind++;
        if(bb){bb.classList.add("wrong");setTimeout(()=>{try{bb.classList.remove("wrong");}catch(e){}},700);}
        fb.classList.remove("hidden");fb.className="quiz-feedback no";fb.textContent="❌ ليس هذا الجزء. حاول مرة أخرى 🔍";
        clearSel();
      }
    });
  }));
  $("ferrSkip").addEventListener("click",()=>{try{S.totalAnswered++;save();}catch(e){}advFerrRun(i+1,score,pool);});
  function step2(){
    step=2;
    try{body.querySelectorAll(".ferr-tok").forEach(x=>{x.disabled=true;});}catch(e){}
    try{cfm.innerHTML="";}catch(e){}
    fb.classList.remove("hidden");fb.className="quiz-feedback ok";fb.textContent="✅ Correct! أحسنت — وجدت الخطأ بنفسك! 🎉";
    const s2=$("ferrStep2");
    s2.innerHTML='<div class="muted">الخطوة 2 من 2: صحح الجزء الخطأ ✍️</div>'
      +'<div class="muted">الجزء الخطأ: «<b dir="ltr" lang="de">'+escapeHtml(toks[errTok])+'</b>» — اكتب الصواب مكانه:</div>'
      +'<div class="quiz-write"><input type="text" id="ferrIn" dir="ltr" lang="de" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="...">'
      +'<button type="button" class="btn btn-gold sm" id="ferrCheck">'+escapeHtml(t("adv_check"))+'</button></div>'
      +'<div class="quiz-feedback hidden" id="ferrFb2"></div>';
    const strip=s=>String(s==null?"":s).replace(/[.?!,;:\u061B\u061F]/g,"").replace(/\s+/g," ").trim();
    const cands=[it.fix].concat(it.accepts||[]);
    /* Capitalization errors differ from the fix by case ONLY — require exact
       case there; all other fixes match case-insensitively (Den/den both ok). */
    const needCase=strip(toks[errTok]).toLowerCase()===strip(it.fix).toLowerCase()&&strip(toks[errTok])!==strip(it.fix);
    const isFix=v=>needCase
      ?cands.some(c=>strip(v)===strip(c))
      :cands.some(c=>strip(v).toLowerCase()===strip(c).toLowerCase());
    const go=()=>{
      const inp=$("ferrIn"),f2=$("ferrFb2");
      const v=inp?inp.value:"";
      if(!v||!v.trim()){f2.classList.remove("hidden");f2.className="quiz-feedback no";f2.textContent="اكتب التصحيح أولًا ✍️";return;}
      if(isFix(v)){solved();}
      else{
        wrongCorr++;
        f2.classList.remove("hidden");f2.className="quiz-feedback no";f2.textContent="❌ ليس صحيحًا — حاول مرة أخرى 💪";
        try{if(inp.select)inp.select();}catch(e){}
      }
    };
    $("ferrCheck").addEventListener("click",go);
    $("ferrIn").addEventListener("keydown",e=>{if(e.key==="Enter")go();});
    try{$("ferrIn").focus();}catch(e){}
  }
  function solved(){
    const clean=(wrongFind===0&&wrongCorr===0);
    if(clean)score++;
    try{S.totalAnswered++;if(clean)S.totalCorrect++;save();}catch(e){}
    try{advNoteAnswer({kind:"sentence"},clean);}catch(e){}
    if(!clean){try{recordMistake({id:"ferr:"+(it.kap||"KX")+":"+it.bad,de:it.bad,ar:it.why,art:"-",type:"قواعد",cat:"Grammar",kap:it.kap},toks[errTok]+"→"+it.fix,"sentence",{q:it.bad,ok:it.good,kap:it.kap,rule:it.cat});}catch(e){}}
    let goodH=escapeHtml(it.good);
    try{
      const gi=it.good.toLowerCase().indexOf(String(it.fix).toLowerCase());
      if(gi>=0)goodH=escapeHtml(it.good.slice(0,gi))+'<span class="ferr-hl">'+escapeHtml(it.good.slice(gi,gi+it.fix.length))+'</span>'+escapeHtml(it.good.slice(gi+it.fix.length));
    }catch(e){}
    const s2=$("ferrStep2");
    s2.innerHTML='<div class="quiz-feedback ok">✅ <b dir="ltr" lang="de">'+goodH+'</b></div>'
      +(clean?'<div class="muted">حل نظيف من أول مرة ⭐ — وجدت الخطأ وصححته بنفسك!</div>':'<div class="muted">أحسنت الإصرار حتى الحل الكامل 💪</div>')
      +'<div class="ferr-why">💡 '+escapeHtml(it.why)+'</div>'
      +(it.rule?'<div class="ferr-rule">📐 القاعدة: '+escapeHtml(it.rule)+'</div>':"")
      +(it.ex?'<div class="muted">🔁 مثال إضافي: <b dir="ltr" lang="de">'+escapeHtml(it.ex)+'</b>'+(it.exAr?' — '+escapeHtml(it.exAr):"")+'</div>':"")
      +'<div class="row-flex"><button type="button" class="btn btn-primary sm" id="ferrNext">'+escapeHtml(t("adv_next"))+'</button></div>';
    $("ferrNext").addEventListener("click",()=>advFerrRun(i+1,score,pool));
  }
}
/* ================= 10. CHALLENGE GENERATOR ================= */
function advChalBuild(){
  const order=shuffle(["vocab","grammar","listening","sentence","speaking"]);
  const words=allWords();
  let lvl="";try{lvl=$("quizLevel")?$("quizLevel").value:"";}catch(e){}
  const pool=lvl?words.filter(w=>(w.level||"A1")===lvl):words;
  const src=pool.length>=5?pool:words;
  if(!src.length)return [];
  const picks=shuffle(src).slice(0,10);
  const items=[];
  order.forEach(sk=>{
    const w=picks[Math.floor(Math.random()*picks.length)];
    if(sk==="vocab")items.push({sk:sk,q:makeQ(Math.random()<0.5?"de-ar":"ar-de",w,words)});
    else if(sk==="grammar"){
      const g=GRAMMAR[Math.floor(Math.random()*GRAMMAR.length)];
      const so=shuffle(g.quiz.opts.map((_,ix)=>ix));
      items.push({sk:sk,q:{kind:"grammar",w:w,prompt:"📐 ["+g.title+"] "+g.quiz.q,opts:so.map(ix=>g.quiz.opts[ix]),correctText:g.quiz.opts[g.quiz.correct],explain:g.quiz.explain}});
    }
    else if(sk==="listening"){const f=fullDe(w);items.push({sk:sk,q:{kind:"listening",w:w,prompt:"🎧 استمع واختر",opts:randOpts(words,w,x=>fullDe(x)),correctText:f,listen:f,explain:"سمعت: "+f}});}
    else if(sk==="sentence")items.push({sk:sk,q:makeQ("sentence",w,words)});
    else items.push({sk:sk,q:{kind:"speak",w:w,prompt:"🎤 قل أو اكتب جملة عن: "+fullDe(w)+" ("+w.ar+")",explain:"أحسنت المحاولة! "+fullDe(w)+" = "+w.ar}});
  });
  return shuffle(items).slice(0,8);
}
function renderChall(){
  ensureAdv();
  const box=$("challBox");if(!box)return;
  box.innerHTML='<div class="panel glass"><h3>'+escapeHtml(t("title_chall"))+'</h3><div class="muted">كل مرة ترتيب وأنواع مختلفة • حسب مستواك</div><div class="row-flex"><button class="btn btn-primary" id="chalStart">'+escapeHtml(t("adv_new_challenge"))+'</button></div><div id="chalBody"></div></div>';
  $("chalStart").addEventListener("click",advChalRun);
}
function advChalRun(){
  const items=advChalBuild();
  if(!items.length){toast("لا توجد أسئلة","err");return;}
  let i=0,score=0;const body=$("chalBody");
  if(!body){toast("تعذر فتح التحدي","err");return;}
  markStudyDay();
  const skAr={vocab:"📚 مفردات",grammar:"📐 قواعد",listening:"🎧 استماع",sentence:"🧩 جملة",speaking:"🎤 تحدث"};
  function next(){if(i>=items.length)return fin();render();}
  function fin(){
    try{
      S.advChal.n++;if(score>S.advChal.best)S.advChal.best=score;S.advChal.last=todayStr();
      addXP(score*6+12,"chall");markStudyDay();checkAch();
      S.testsTaken=(S.testsTaken||0)+1;
      S.quizHistory.unshift({type:"🎯 تحدي جديد",score:score,total:items.length,pct:Math.round(score/items.length*100),xp:score*6+12,date:todayStr()});
      S.quizHistory=S.quizHistory.slice(0,20);
      save();
    }catch(e){}
    body.innerHTML='<div class="quiz-feedback ok">🏆 التحدي مكتمل: '+score+'/'+items.length+' ⭐+'+(score*6+12)+'</div><div class="row-flex"><button class="btn btn-primary sm" id="chalAgain">'+escapeHtml(t("adv_new_challenge"))+'</button></div>';
    $("chalAgain").addEventListener("click",advChalRun);
  }
  function render(){
    const it=items[i],q=it.q;
    let h='<div class="muted">محطة '+(i+1)+'/'+items.length+' • '+skAr[it.sk]+'</div>';
    if(q.kind==="speak"){
      h+='<h4>'+escapeHtml(q.prompt)+'</h4><div class="quiz-write"><input type="text" id="chIn" placeholder="Antwort auf Deutsch..."><button class="btn btn-primary sm" id="chMic">🎤</button><button class="btn btn-gold sm" id="chOk">'+escapeHtml(t("adv_check"))+'</button></div><div class="quiz-feedback hidden" id="chFb"></div>';
      body.innerHTML=h;
      try{startMic($("chMic"),$("chIn"),$("chFb"),function(){});}catch(e){}
      $("chOk").addEventListener("click",()=>{
        const v=$("chIn").value.trim(),f=$("chFb");f.classList.remove("hidden");
        if(v.length<2){f.className="quiz-feedback no";f.textContent="اكتب أو تحدث أولًا.";return;}
        f.className="quiz-feedback ok";f.textContent="✅ "+q.explain;
        score++;S.totalCorrect++;S.totalAnswered++;
        try{const L=S.lstats;L.sn++;L.sok++;}catch(e){}
        advTrack("speaking",true);save();i++;setTimeout(next,1800);
      });
      return;
    }
    if(q.listen){
      h+='<div class="row-flex"><button class="btn btn-gold sm" id="chHear">🔊 استمع</button></div><h4>'+escapeHtml(q.prompt)+'</h4><div id="chQ"></div><div class="quiz-feedback hidden" id="chFb"></div>';
      body.innerHTML=h;
      const play=()=>speakGerman(q.listen);
      $("chHear").addEventListener("click",play);setTimeout(play,350);
    }else{
      h+='<h4>'+escapeHtml(q.prompt)+'</h4><div id="chQ"></div><div class="quiz-feedback hidden" id="chFb"></div>';
      body.innerHTML=h;
    }
    const qb=$("chQ");
    const order=shuffle((q.opts||[]).map((_,ix)=>ix));
    qb.innerHTML='<div class="quiz-opts">'+order.map(oi=>'<button class="quiz-opt" data-j="'+oi+'">'+escapeHtml(q.opts[oi])+'</button>').join("")+'</div>';
    qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const oi=parseInt(b.getAttribute("data-j"),10);
      qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      const right=q.correctText!==undefined?q.correctText:(q.opts[q.correct]);
      const ok=q.opts[oi]===right;
      const f=$("chFb");f.classList.remove("hidden");
      if(ok){b.classList.add("correct");f.className="quiz-feedback ok";f.textContent="صحيح ✅ "+(q.explain||"");score++;S.totalCorrect++;}
      else{b.classList.add("wrong");f.className="quiz-feedback no";f.textContent="❌ "+(q.explain||"");
        try{if(q.w)recordMistake(q.w,q.opts[oi],q.kind||"chall",{q:q.prompt,ok:right,kap:q.w.kap});}catch(e){}}
      S.totalAnswered++;save();
      try{advNoteAnswer({kind:q.kind},ok);}catch(e){}
      i++;setTimeout(next,1800);
    }));
  }
  render();
}
/* ================= 8b. NEW REAL-LIFE SCENARIOS (pushed, not duplicated) ================= */
try{
  if(typeof DL_SITS!=="undefined"&&DL_SITS.length===10){
    DL_SITS.push(
      {id:"train",icon:"🚆",t:"Train Station",ar:"محطة القطار",steps:[
        {k:"listen",say:"Der Zug nach Berlin fährt um zehn Uhr ab.",sayAr:"قطار برلين يتحرك العاشرة."},
        {k:"say",say:"Wohin möchten Sie fahren?",sayAr:"إلى أين تريد السفر؟",expect:["berlin"],sample:"Ich möchte nach Berlin.",hint:"مثال: Nach Berlin."},
        {k:"vocab",de:"der Bahnsteig",ar:"الرصيف"},
        {k:"say",say:"Einfach oder hin und zurück?",sayAr:"ذهاب فقط أم ذهاب وعودة؟",expect:["hin und zurück","zurück","einfach"],sample:"Hin und zurück, bitte.",hint:"مثال: Hin und zurück."}]},
      {id:"uni",icon:"🏫",t:"University",ar:"الجامعة",steps:[
        {k:"listen",say:"Die Vorlesung beginnt um acht Uhr.",sayAr:"المحاضرة تبدأ الثامنة."},
        {k:"say",say:"Was studieren Sie?",sayAr:"ماذا تدرس؟",expect:["medizin","informatik","studiere"],sample:"Ich studiere Medizin.",hint:"مثال: Ich studiere ..."},
        {k:"vocab",de:"die Prüfung",ar:"الامتحان"},
        {k:"say",say:"Wann ist die Prüfung?",sayAr:"متى الامتحان؟",expect:["montag","juni","morgen"],sample:"Am Montag.",hint:"مثال: Am Montag."}]},
      {id:"jobiv",icon:"💼",t:"Job Interview",ar:"مقابلة العمل",steps:[
        {k:"listen",say:"Erzählen Sie etwas über sich.",sayAr:"حدثنا عن نفسك."},
        {k:"say",say:"Warum möchten Sie hier arbeiten?",sayAr:"لماذا تريد العمل هنا؟",expect:["lernen","arbeiten","erfahrung"],sample:"Ich möchte Erfahrung sammeln.",hint:"مثال: Ich möchte lernen."},
        {k:"vocab",de:"der Lebenslauf",ar:"السيرة الذاتية"},
        {k:"say",say:"Was sind Ihre Stärken?",sayAr:"ما نقاط قوتك؟",expect:["pünktlich","fleißig","team"],sample:"Ich bin pünktlich.",hint:"مثال: Pünktlich."}]},
      {id:"ausb",icon:"🇩🇪",t:"Ausbildung",ar:"التدريب المهني",steps:[
        {k:"listen",say:"Die Ausbildung dauert drei Jahre.",sayAr:"التدريب يستغرق 3 سنوات."},
        {k:"say",say:"Welchen Beruf lernen Sie?",sayAr:"أي مهنة تتعلم؟",expect:["koch","pfleger","mechaniker"],sample:"Ich lerne Koch.",hint:"مثال: Koch."},
        {k:"vocab",de:"der Betrieb",ar:"الشركة"},
        {k:"say",say:"Wo ist die Berufsschule?",sayAr:"أين مدرسة المهنة؟",expect:["berlin","hier","zentrum"],sample:"In Berlin.",hint:"مثال: In Berlin."}]},
      {id:"wohn",icon:"🏠",t:"Wohnung + Anmeldung",ar:"السكن والتسجيل",steps:[
        {k:"listen",say:"Ist die Wohnung noch frei?",sayAr:"هل الشقة ما زالت متاحة؟"},
        {k:"say",say:"Wie hoch ist die Miete?",sayAr:"كم الإيجار؟",expect:["500","euro"],sample:"500 Euro warm.",hint:"مثال: 500 Euro."},
        {k:"vocab",de:"die Anmeldung",ar:"التسجيل"},
        {k:"say",say:"Wo ist das Bürgeramt?",sayAr:"أين مكتب المواطنين؟",expect:["hier","neben","zentrum"],sample:"Neben dem Bahnhof.",hint:"مثال: Neben dem Bahnhof."}]},
      {id:"dir",icon:"🧭",t:"Asking for Directions",ar:"السؤال عن الطريق",steps:[
        {k:"listen",say:"Entschuldigung! Wo ist der Bahnhof?",sayAr:"عذرًا! أين المحطة؟"},
        {k:"say",say:"Wie komme ich zum Zentrum?",sayAr:"كيف أصل للمركز؟",expect:["geradeaus","links","rechts","bus"],sample:"Geradeaus, dann links.",hint:"مثال: Geradeaus."},
        {k:"vocab",de:"die Kreuzung",ar:"التقاطع"},
        {k:"say",say:"Ist es weit von hier?",sayAr:"هل هو بعيد من هنا؟",expect:["nein","nah","fünf minuten"],sample:"Nein, fünf Minuten.",hint:"مثال: Nein, nah."}]}
    );
  }
}catch(e){}
/* ================= WIRING (wrap pattern, like other modules) ================= */
const ADV_PAGES={lislab:renderLislab,fixsent:renderFixsent,finderr:renderFinderr,chall:renderChall};
try{
  const _sp=showPage;
  /* Page-state preservation: keep active lab/challenge state as-left on return visits. */
  showPage=function(n){_sp(n);try{if(ADV_PAGES[n]&&!(window.DMPageState&&DMPageState.skipRender&&DMPageState.skipRender(n)))ADV_PAGES[n]();}catch(e){if(window.console)console.error(e);}};
  const _rd=renderDashboard;
  renderDashboard=function(){_rd();try{advDash();}catch(e){}};
  const _rj=typeof renderJourney==="function"?renderJourney:null;
  if(_rj)renderJourney=function(){_rj();try{advJourneyPhases();}catch(e){}};
  const _rt=typeof renderTutor==="function"?renderTutor:null;
  if(_rt)renderTutor=function(){_rt();try{advCoach();}catch(e){}};
}catch(e){if(window.console)console.error(e);}
