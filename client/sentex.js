/* Deutsch Master - Standalone Sentence Exercises (ADDITIVE ONLY).
   Independent learning feature, NOT a game. Uses existing SENT_FILL bank
   (play.js) without deleting or rewriting it. No timer. Real blank UX:
   answer hidden until user picks, then fill blank + feedback + Next. */
"use strict";

/* ---------- bank access (reuse, never rewrite) ---------- */
function sentexBank(){
  try{ if(typeof SENT_FILL!=="undefined"&&SENT_FILL&&SENT_FILL.length)return SENT_FILL; }catch(e){}
  return [];
}
/* Chapters derived from the REAL bank (counts are truth, not hardcoded) */
function sentexChapters(){
  const bank=sentexBank();
  const map={};
  bank.forEach(function(f){
    const id=f.chapterId||"?";
    if(!map[id])map[id]={id:id,name:f.chapterName||id,n:0};
    map[id].n++;
  });
  const order=["K0","K1","K2","K3","K4","K5"];
  const out=Object.keys(map).map(function(k){return map[k];});
  out.sort(function(a,b){
    const ia=order.indexOf(a.id),ib=order.indexOf(b.id);
    if(ia<0&&ib<0)return a.id<b.id?-1:1;
    if(ia<0)return 1; if(ib<0)return -1;
    return ia-ib;
  });
  return out;
}
function sentexChapterName(id){
  try{
    if(typeof KAPITEL!=="undefined"){
      const k=KAPITEL.find(function(x){return x.id===id;});
      if(k)return k.icon+" "+k.name;
    }
  }catch(e){}
  const b=sentexBank().find(function(f){return f.chapterId===id;});
  return (b&&b.chapterName)||id;
}
function sentexShuffle(a){
  const x=a.slice();
  for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=x[i];x[i]=x[j];x[j]=t;}
  return x;
}

/* ---------- missing helpers required by script.js quiz (real impl) ----------
   script.js buildQuestions("sentence") calls pickFillBank("mix",n).map(fillToQuiz).
   These were referenced but never defined -> quiz fell back to vocab generation.
   Defining them fixes that path AND powers the standalone feature. */
function pickFillBank(filter,count){
  let bank=sentexBank().slice();
  if(typeof filter==="string"&&filter!=="mix"&&filter){
    bank=bank.filter(function(f){return f.chapterId===filter;});
  }else if(Object.prototype.toString.call(filter)==="[object Array]"&&filter.length){
    const set={};filter.forEach(function(k){set[k]=1;});
    bank=bank.filter(function(f){return set[f.chapterId];});
  }
  bank=sentexShuffle(bank);
  const n=parseInt(count,10)||bank.length;
  return bank.slice(0,Math.max(1,Math.min(n,bank.length)));
}
function sentexPseudoWord(f){
  const correct=(f.o&&f.o[f.c])||"";
  try{
    if(typeof allWords==="function"){
      const hit=allWords().find(function(w){
        return (w.de&&correct&&w.de===correct)||(f.w&&w.inf===f.w)||(f.w&&w.de===f.w);
      });
      if(hit)return hit;
    }
  }catch(e){}
  return {id:"sentex-"+f.id,de:f.s.replace("___",correct),ar:(f.why||"")+" ["+(f.chapterId||"")+"]",
    art:"-",type:"مفردات",cat:"Sentences",kap:f.chapterId||"K0",pron:"",ex:f.s,exAr:f.why||""};
}
function fillToQuiz(f){
  const correct=(f.o&&f.o[f.c])||"";
  const order=sentexShuffle((f.o||[]).map(function(_,i){return i;}));
  const opts=order.map(function(i){return f.o[i];});
  return {kind:"sentence-fill",fillItem:f,w:sentexPseudoWord(f),
    prompt:String(f.s||"").replace("___","______"),
    opts:opts,correctText:correct,
    explain:"الإجابة: "+correct+" — "+(f.why||"")};
}

/* ---------- standalone run state ---------- */
var SX={mode:"single",chapters:[],qs:[],idx:0,score:0,results:[]};
function sentexEnsure(){
  try{ if(!S.sentex)S.sentex={}; }catch(e){}
}
function sentexRecordProgress(f,ok){
  try{
    sentexEnsure();
    const id=f.chapterId||"?";
    if(!S.sentex[id])S.sentex[id]={n:0,ok:0};
    S.sentex[id].n++; if(ok)S.sentex[id].ok++;
    save();
  }catch(e){}
}

/* ---------- home ---------- */
function renderSentex(){
  sentexEnsure();
  const box=$("sentexBox");if(!box)return;
  constchs=sentexChapters();
  const bank=sentexBank();
  if(!bank.length){box.innerHTML='<div class="panel glass">لا توجد أسئلة بعد.</div>';return;}
  let h='<div class="panel glass"><h3>✏️ تدريبات الجمل</h3>'
    +'<div class="muted">تدرّب على تكوين وفهم الجمل الألمانية — اختر Kapitel للتدريب. ('+bank.length+' سؤالًا حقيقيًا، بدون مؤقّت ⏱️❌)</div></div>';
  h+='<div class="grid-2">';
  constchs.forEach(function(c){
    let pct=null;
    try{
      const p=S.sentex&&S.sentex[c.id];
      if(p&&p.n)pct=Math.round(p.ok/Math.max(1,p.n)*100);
    }catch(e){}
    h+='<div class="panel glass"><h4>'+escapeHtml(sentexChapterName(c.id))+'</h4>'
      +'<div class="muted">'+c.n+' سؤال</div>'
      +(pct===null?'<div class="muted">لم تتدرب بعد</div>'
        :'<div class="stat-bar-row"><span class="lbl">تقدمك</span><div class="bar"><div class="fill" style="width:'+pct+'%;background:linear-gradient(90deg,#7c3aed,#00d4ff)"></div></div><b>'+pct+'%</b></div>')
      +'<div class="row-flex"><button class="btn btn-primary sm" data-sx-single="'+c.id+'">ابدأ التدريب 🚀</button></div></div>';
  });
  h+='</div>';
  /* multi */
  h+='<div class="panel glass"><h3>☑️ اختيار أكثر من Kapitel</h3><div class="muted">علّم على الفصول ثم ابدأ — الأسئلة من المختار فقط.</div><div class="row-flex" style="flex-wrap:wrap">'
    +constchs.map(function(c){return '<label style="display:flex;gap:6px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px 12px"><input type="checkbox" data-sx-multi="'+c.id+'"> '+escapeHtml(c.id)+' ('+c.n+')</label>';}).join("")
    +'</div><div class="row-flex"><button class="btn btn-gold sm" id="sxMultiStart">ابدأ التدريب المحدد 🚀</button></div></div>';
  /* mixed */
  h+='<div class="panel glass"><h3>🔀 جميع Kapitel — مختلط</h3><div class="muted">تدريب مختلط من كل الفصول ('+bank.length+' سؤالًا، نختار 20 بخلط حقيقي).</div><div class="row-flex"><button class="btn btn-green sm" id="sxMixedStart">ابدأ المختلط 🌍</button></div></div>';
  h+='<div id="sentexRun"></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-sx-single]").forEach(function(b){
    b.addEventListener("click",function(){startSentexRun([b.getAttribute("data-sx-single")],"single");});
  });
  const ms=$("sxMultiStart");
  if(ms)ms.addEventListener("click",function(){
    const sel=Array.from(box.querySelectorAll("[data-sx-multi]:checked")).map(function(x){return x.getAttribute("data-sx-multi");});
    if(!sel.length){toast("اختر Kapitel واحدًا على الأقل ☑️","err");return;}
    startSentexRun(sel,"multi");
  });
  const mx=$("sxMixedStart");
  if(mx)mx.addEventListener("click",function(){
    startSentexRun(constchs.map(function(c){return c.id;}),"mixed");
  });
}

/* ---------- run ---------- */
function startSentexRun(chapters,mode){
  const bank=sentexBank();
  const set={};chapters.forEach(function(k){set[k]=1;});
  /* strict isolation: chapterId must be in the selected set */
  let pool=bank.filter(function(f){return set[f.chapterId];});
  if(!pool.length){toast("لا توجد أسئلة لهذا الاختيار ⚠️","err");return;}
  pool=sentexShuffle(pool);
  if(mode==="mixed")pool=pool.slice(0,Math.min(20,pool.length));
  SX={mode:mode,chapters:chapters.slice(),qs:pool,idx:0,score:0,results:[]};
  try{markStudyDay();}catch(e){}
  renderSentexQ();
  const r=$("sentexRun");if(r)r.scrollIntoView({behavior:"smooth"});
}
function sentexBlankHtml(f,filled,ok){
  const txt=filled||"______";
  const cls=filled?(ok?"fill-blank filled-ok":"fill-blank filled-no"):"fill-blank";
  return escapeHtml(String(f.s||"").split("___")[0]||"")
    +'<span class="'+cls+'" dir="ltr">'+escapeHtml(txt)+'</span>'
    +escapeHtml(String(f.s||"").split("___")[1]||"");
}
function renderSentexQ(){
  const box=$("sentexRun");if(!box)return;
  const f=SX.qs[SX.idx];
  if(!f){finishSentex();return;}
  const letters=["A","B","C","D","E","F"];
  const order=sentexShuffle((f.o||[]).map(function(_,i){return i;}));
  const opts=order.map(function(i){return f.o[i];});
  const correctPos=order.indexOf(f.c);
  box.innerHTML='<div class="panel glass"><div class="quiz-top"><span>'+(SX.idx+1)+' / '+SX.qs.length+'</span>'
    +'<div class="progress"><div class="progress-fill" style="width:'+(SX.idx/SX.qs.length*100)+'%"></div></div>'
    +'<span>✅ '+SX.score+'</span></div>'
    +'<div class="muted">📚 '+escapeHtml(f.chapterName||f.chapterId||"")+' • '+escapeHtml(f.lvl||"")+'</div>'
    +'<h3 class="fill-sent" dir="ltr" style="text-align:left" id="sxSent">'+sentexBlankHtml(f,null,false)+'</h3>'
    +'<div class="quiz-opts" id="sxOpts">'
    +opts.map(function(o,j){return '<button class="quiz-opt" data-j="'+j+'" dir="ltr">'+letters[j]+') '+escapeHtml(o)+'</button>';}).join("")
    +'</div><div class="quiz-feedback hidden" id="sxFb"></div>'
    +'<div class="row-flex"><button class="btn btn-primary" id="sxNext" disabled>التالي ⏭</button>'
    +'<button class="btn btn-ghost" id="sxQuit">إنهاء ✖</button></div></div>';
  $("sxQuit").addEventListener("click",finishSentex);
  box.querySelectorAll("#sxOpts .quiz-opt").forEach(function(b){
    b.addEventListener("click",function(){answerSentex(parseInt(b.getAttribute("data-j"),10),correctPos,opts,f);});
  });
}
function answerSentex(j,correctPos,opts,f){
  const box=$("sxOpts");if(!box)return;
  const ok=j===correctPos;
  Array.from(box.children).forEach(function(b,bi){
    b.disabled=true;
    if(bi===correctPos)b.classList.add("correct");
  });
  if(!ok&&box.children[j])box.children[j].classList.add("wrong");
  /* fill the real blank with the user's pick */
  const sent=$("sxSent");
  if(sent)sent.innerHTML=sentexBlankHtml(f,opts[j],ok);
  const fb=$("sxFb");fb.classList.remove("hidden","ok","no");fb.classList.add(ok?"ok":"no");
  const correct=(f.o&&f.o[f.c])||"";
  fb.innerHTML=(ok?"صحيح ✅ ":"خطأ ❌ ")
    +(ok?escapeHtml(f.s.replace("___",correct))+"<br>":"إجابتك: <b>"+escapeHtml(opts[j])+"</b> • الصحيحة: <b style='color:var(--green)'>"+escapeHtml(correct)+"</b><br>")
    +"<span class='muted'>"+escapeHtml(f.why||"")+"</span>";
  /* progress + totals (reuse store) */
  if(ok){SX.score++;try{S.totalCorrect++;}catch(e){}}
  try{S.totalAnswered++;}catch(e){}
  sentexRecordProgress(f,ok);
  try{
    if(ok){
      if(typeof bumpSilent==="function"&&sentexPseudoWord(f).id)void 0;
    }else{
      recordMistake(sentexPseudoWord(f),opts[j],"sentence-exercises",
        {qid:f.id,chapterId:f.chapterId,lessonId:(f.lessonId===undefined?null:f.lessonId),source:"sentence-exercises"});
    }
    save();
  }catch(e){}
  SX.results.push({ok:ok,picked:opts[j],correct:correct,f:f});
  $("sxNext").disabled=false;
  $("sxNext").addEventListener("click",function(){SX.idx++;renderSentexQ();},{once:true});
}
function finishSentex(){
  const run=$("sentexRun");if(!run)return;
  const total=SX.qs.length,score=SX.score;
  const pct=total?Math.round(score/total*100):0;
  try{
    S.testsTaken=(S.testsTaken||0)+1;
    if(pct>(S.bestPct||0))S.bestPct=pct;
    addXP(score*2+5,"sentence-exercises");markStudyDay();save();
  }catch(e){}
  const per={};
  SX.results.forEach(function(r){
    const id=r.f.chapterId||"?";
    if(!per[id])per[id]={n:0,ok:0,name:r.f.chapterName||id};
    per[id].n++;if(r.ok)per[id].ok++;
  });
  const perRows=Object.keys(per).sort().map(function(k){
    const p=per[k];
    return '<div class="stat-bar-row"><span class="lbl">'+escapeHtml(k)+'</span><div class="bar"><div class="fill" style="width:'+Math.round(p.ok/Math.max(1,p.n)*100)+'%;background:linear-gradient(90deg,#22c55e,#4ade80)"></div></div><b>'+p.ok+'/'+p.n+'</b></div>'
      +'<div class="muted">'+escapeHtml(p.name)+'</div>';
  }).join("");
  const wrongs=SX.results.filter(function(r){return !r.ok;});
  const wrongRows=wrongs.length?wrongs.map(function(r){
    return '<div class="mist-err">❌ <b dir="ltr">'+escapeHtml(r.f.s.replace("___","______"))+'</b><br>إجابتك: <b>'+escapeHtml(r.picked)+'</b> | الصحيحة: <b style="color:var(--green)">'+escapeHtml(r.correct)+'</b><br><span class="muted">'+escapeHtml(r.f.why||"")+' • '+escapeHtml(r.f.chapterId||"")+'</span></div>';
  }).join(""):'<div class="muted">ممتاز — بلا أخطاء! 🎉</div>';
  const title=SX.mode==="single"?("Kapitel "+(SX.chapters[0]||"")):(SX.mode==="mixed"?"🌍 مختلط — جميع Kapitel":"☑️ "+SX.chapters.join(" + "));
  run.innerHTML='<div class="panel glass" style="text-align:center"><h3>🎯 النتيجة — '+escapeHtml(title)+'</h3>'
    +'<div class="stat-num" style="font-size:44px">'+score+' / '+total+'</div>'
    +'<div class="stat-num" style="font-size:28px">'+pct+'%</div>'
    +'<div class="progress" style="margin:10px 0"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
    +perRows
    +'<h4 style="margin-top:12px">أخطاؤك ('+wrongs.length+')</h4>'+wrongRows
    +'<div class="row-flex" style="justify-content:center;margin-top:12px"><button class="btn btn-primary sm" id="sxAgain">🔄 تدريب جديد</button>'
    +'<button class="btn btn-gold sm" id="sxGoMist">❌ مراجعة أخطائي</button>'
    +'<button class="btn btn-ghost sm" id="sxHome">🏠 الرئيسية</button></div></div>';
  $("sxAgain").addEventListener("click",function(){renderSentex();const b=$("sentexBox");if(b)b.scrollIntoView({behavior:"smooth"});});
  $("sxGoMist").addEventListener("click",function(){showPage("mistakes");});
  $("sxHome").addEventListener("click",function(){showPage("dashboard");});
  try{if(typeof renderAll==="function")renderAll();}catch(e){}
  run.scrollIntoView({behavior:"smooth"});
}

/* ---------- i18n + page wiring (additive, never override) ---------- */
try{
  if(typeof I18N!=="undefined"){
    if(I18N.ar)I18N.ar.sentex="تدريبات الجمل";
    if(I18N.en)I18N.en.sentex="Sentence Exercises";
  }
}catch(e){}
(function(){
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(n==="sentex")renderSentex();}catch(e){console.error(e);}};
  }catch(e){console.error(e);}
  try{
    document.querySelectorAll("[data-goto='sentex']").forEach(function(b){
      b.addEventListener("click",function(){showPage("sentex");});
    });
  }catch(e){}
})();
