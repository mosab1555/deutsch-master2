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
/* ---------- i18n: interface chrome AR/EN (learning content stays German/Arabic) ---------- */
const I18N={
ar:{dashboard:"الرئيسية",vocab:"الكلمات",flashcards:"Flashcards",sentences:"الجمل",verbs:"الأفعال",grammar:"القواعد",explain:"الشرح",quiz:"الاختبارات",journey:"الرحلة",listen:"استماع",speak:"تحدث",talk:"محادثة",real:"مواقف",job:"الشغل",ach:"إنجازاتي",games:"الألعاب",world:"العالم",stories:"قصص",survive:"البقاء",challenge:"التحدي",me:"شخصيتي",practice:"تدريب ذكي",review:"المراجعة",mistakes:"أخطائي",stats:"الإحصائيات",planner:"خطة المذاكرة",favorites:"المفضلة",settings:"الإعدادات",tutor:"المدرّب",roadmap:"الخريطة",labs:"المختبر",profile:"حسابي",analytics:"تقدمي"},
en:{dashboard:"Home",vocab:"Words",flashcards:"Flashcards",sentences:"Sentences",verbs:"Verbs",grammar:"Grammar",explain:"Lessons",quiz:"Quizzes",journey:"Journey",listen:"Listening",speak:"Speaking",talk:"Chat",real:"Situations",job:"Work",ach:"My awards",games:"Games",world:"World",stories:"Stories",survive:"Survival",challenge:"Challenge",me:"Profile",practice:"Smart training",review:"Review",mistakes:"Mistakes",stats:"Stats",planner:"Planner",favorites:"Favorites",settings:"Settings",tutor:"Tutor",roadmap:"Roadmap",labs:"Labs",profile:"Account",analytics:"Progress"}};
function t(k){try{const L=S.uiLang||"ar";return (I18N[L]&&I18N[L][k])||I18N.ar[k]||k;}catch(e){return k;}}
function applyLang(){
  try{
    document.querySelectorAll(".nav-item").forEach(b=>{
      const p=b.dataset.page;if(!p||!I18N[S.uiLang||"ar"][p])return;
      const ic=b.querySelector(".nav-ico");
      b.childNodes.forEach(n=>{if(n.nodeType===3)n.remove();});
      b.appendChild(document.createTextNode(" "+t(p)));
      if(ic)b.insertBefore(ic,b.firstChild);
    });
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
function openGLab(id){
  const g=GRAMMAR.find(x=>x.id===id);if(!g)return;
  const box=$("glabBody");
  const nouns=shuffle(allWords().filter(w=>w.type==="اسم"&&w.art!=="-"&&w.kap===g.kap)).slice(0,2);
  const qs=nouns.map(w=>({t:"اختر الأداة: ___ "+w.de,opts:["der","die","das"],correct:w.art==="der"?0:w.art==="die"?1:2,w:w,why:w.art+" "+w.de+" = "+w.ar}));
  qs.unshift({t:g.quiz.q,opts:g.quiz.opts.slice(),correct:g.quiz.correct,why:g.quiz.explain});
  let i=0,score=0;
  box.innerHTML='<div class="panel glass"><h4>📐 '+escapeHtml(g.title)+'</h4><div class="muted">'+escapeHtml(g.body)+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="glFull">الشرح الكامل 📖</button></div><div id="glQ"></div></div>';
  $("glFull").addEventListener("click",()=>openExplain(id));
  const qb=$("glQ");
  function q(){
    if(i>=qs.length){
      if(score>=2){try{if(typeof completeLesson==="function")completeLesson(id);}catch(e){}}
      addXP(10,"glab");Store.save();
      qb.innerHTML='<div class="quiz-feedback ok">انتهى التدريب: '+score+'/'+qs.length+' ⭐+10</div>';return;
    }
    const it=qs[i];
    qb.innerHTML='<div class="muted">تدريب '+(i+1)+'/'+qs.length+'</div><h4>'+escapeHtml(it.t)+'</h4><div class="quiz-opts">'+it.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="glFb"></div>';
    qb.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("glFb");fb.classList.remove("hidden");
      qb.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===it.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+it.why;score++;S.totalCorrect++;if(it.w)srsBump(it.w.id,true);}
      else{b.classList.add("wrong");qb.querySelectorAll(".quiz-opt")[it.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ الصحيح: "+it.opts[it.correct]+" — لماذا؟ "+it.why;if(it.w)recordMistake(it.w,it.opts[j],"glab");else{S.gweak=S.gweak||{};S.gweak[id]=(S.gweak[id]||0)+1;}}
      S.totalAnswered++;Store.save();setTimeout(()=>{i++;q();},1800);
    }));
  }
  q();box.scrollIntoView({behavior:"smooth"});
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
      if(ls){ls.value=S.uiLang||"ar";ls.addEventListener("change",()=>{S.uiLang=ls.value;Store.save();applyLang();toast(ls.value==="ar"?"العربية 🇪🇬":"English 🇬🇧","ok");});}
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
    d.innerHTML='<h3>🧪 مختبر القواعد</h3><div class="muted">تدريب سريع على أي موضوع.</div><div id="glabBox"></div>';
    list.parentNode.insertBefore(d,list);
    renderGLab();
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
