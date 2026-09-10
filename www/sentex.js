/* Deutsch Master - Standalone sentence training engine (ADDITIVE ONLY).
   Powers TWO independent learning pages (NOT games) from the SAME existing
   SENT_FILL bank (play.js) without deleting or rewriting it:
     - page-sentex   (✏️ تدريبات الجمل)  -> state SX
     - page-practice (🧠 تدريب ذكي)      -> state PX
   Real blank UX, no timer: answer hidden until user picks, then fill blank
   + green/red feedback + Next. Strict chapter isolation via chapterId. */
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
   Defining them fixes that path AND powers the standalone features. */
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

/* ---------- host abstraction: two pages, one engine ---------- */
var SX={mode:"single",chapters:[],qs:[],idx:0,score:0,results:[]}; /* ✏️ تدريبات الجمل */
var PX={mode:"single",chapters:[],qs:[],idx:0,score:0,results:[]}; /* 🧠 تدريب ذكي */
function sxHost(name){
  if(name==="practice")return {name:"practice",boxId:"practiceBox",title:"🧠 تدريب ذكي",
    src:"smart-training",get st(){return PX;},set st(v){PX=v;}};
  return {name:"sentex",boxId:"sentexBox",title:"✏️ تدريبات الجمل",
    src:"sentence-exercises",get st(){return SX;},set st(v){SX=v;}};
}
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

/* ---------- home (Kapitel cards + multi + mixed) ---------- */
function renderSxHome(H){
  sentexEnsure();
  const box=$(H.boxId);if(!box)return;
  const chs=sentexChapters();
  const bank=sentexBank();
  if(!bank.length){box.innerHTML='<div class="panel glass">لا توجد أسئلة بعد.</div>';return;}
  const p=H.name; /* id prefix: sx | px */
  let h='<div class="panel glass"><h3>'+H.title+'</h3>'
    +'<div class="muted">اختر Kapitel للتدريب — أسئلة إكمال الجمل الحقيقية. ('+bank.length+' سؤالًا، بدون مؤقّت ⏱️❌)</div></div>';
  h+='<div class="grid-2">';
  chs.forEach(function(c){
    let pct=null;
    try{
      const pr=S.sentex&&S.sentex[c.id];
      if(pr&&pr.n)pct=Math.round(pr.ok/Math.max(1,pr.n)*100);
    }catch(e){}
    h+='<div class="panel glass"><h4>'+escapeHtml(sentexChapterName(c.id))+'</h4>'
      +'<div class="muted">'+c.n+' سؤال</div>'
      +(pct===null?'<div class="muted">لم تتدرب بعد</div>'
        :'<div class="stat-bar-row"><span class="lbl">تقدمك</span><div class="bar"><div class="fill" style="width:'+pct+'%;background:linear-gradient(90deg,#7c3aed,#00d4ff)"></div></div><b>'+pct+'%</b></div>')
      +'<div class="row-flex"><button class="btn btn-primary sm" data-'+p+'-single="'+c.id+'">ابدأ التدريب 🚀</button></div></div>';
  });
  h+='</div>';
  /* multi */
  h+='<div class="panel glass"><h3>📚 اختيار عدة Kapitel</h3><div class="muted">علّم على الفصول ثم ابدأ — الأسئلة من المختارة فقط.</div><div class="row-flex" style="flex-wrap:wrap">'
    +chs.map(function(c){return '<label style="display:flex;gap:6px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px 12px"><input type="checkbox" data-'+p+'-multi="'+c.id+'"> '+escapeHtml(c.id)+' ('+c.n+')</label>';}).join("")
    +'</div><div class="row-flex"><button class="btn btn-gold sm" id="'+p+'MultiStart">ابدأ التدريب المحدد 🚀</button></div></div>';
  /* mixed */
  h+='<div class="panel glass"><h3>🌍 جميع Kapitel — مختلط</h3><div class="muted">تدريب مختلط من كل الفصول ('+bank.length+' سؤالًا، نختار 20 بخلط حقيقي).</div><div class="row-flex"><button class="btn btn-green sm" id="'+p+'MixedStart">ابدأ المختلط 🌍</button></div></div>';
  h+='<div id="'+p+'Run"></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-"+p+"-single]").forEach(function(b){
    b.addEventListener("click",function(){startSxRun(H,[b.getAttribute("data-"+p+"-single")],"single");});
  });
  const ms=$(p+"MultiStart");
  if(ms)ms.addEventListener("click",function(){
    const sel=Array.from(box.querySelectorAll("[data-"+p+"-multi]:checked")).map(function(x){return x.getAttribute("data-"+p+"-multi");});
    if(!sel.length){toast("اختر Kapitel واحدًا على الأقل ☑️","err");return;}
    startSxRun(H,sel,"multi");
  });
  const mx=$(p+"MixedStart");
  if(mx)mx.addEventListener("click",function(){
    startSxRun(H,chs.map(function(c){return c.id;}),"mixed");
  });
}
/* backward-compatible wrappers for page-sentex */
function renderSentex(){renderSxHome(sxHost("sentex"));}
/* renderer for page-practice (🧠 تدريب ذكي) — wired to SENT_FILL, not vocab */
function renderSmartPractice(){renderSxHome(sxHost("practice"));}

/* ---------- run ---------- */
function startSxRun(H,chapters,mode){
  const bank=sentexBank();
  const set={};chapters.forEach(function(k){set[k]=1;});
  /* strict isolation: chapterId must be in the selected set */
  let pool=bank.filter(function(f){return set[f.chapterId];});
  if(!pool.length){toast("لا توجد أسئلة لهذا الاختيار ⚠️","err");return;}
  pool=sentexShuffle(pool);
  if(mode==="mixed")pool=pool.slice(0,Math.min(20,pool.length));
  H.st={mode:mode,chapters:chapters.slice(),qs:pool,idx:0,score:0,results:[]};
  try{markStudyDay();}catch(e){}
  renderSxQ(H);
  const r=$(H.name==="practice"?"pxRun":"sxRun");if(r)r.scrollIntoView({behavior:"smooth"});
}
function startSentexRun(chapters,mode){startSxRun(sxHost("sentex"),chapters,mode);}
function startPracticeRun(chapters,mode){startSxRun(sxHost("practice"),chapters,mode);}
function sentexBlankHtml(f,filled,ok){
  const txt=filled||"______";
  const cls=filled?(ok?"fill-blank filled-ok":"fill-blank filled-no"):"fill-blank";
  return escapeHtml(String(f.s||"").split("___")[0]||"")
    +'<span class="'+cls+'" dir="ltr">'+escapeHtml(txt)+'</span>'
    +escapeHtml(String(f.s||"").split("___")[1]||"");
}
function renderSxQ(H){
  const p=H.name==="practice"?"px":"sx";
  const ST=H.st;
  const box=$(p+"Run");if(!box)return;
  const f=ST.qs[ST.idx];
  if(!f){finishSx(H);return;}
  const letters=["A","B","C","D","E","F"];
  const order=sentexShuffle((f.o||[]).map(function(_,i){return i;}));
  const opts=order.map(function(i){return f.o[i];});
  const correctPos=order.indexOf(f.c);
  box.innerHTML='<div class="panel glass"><div class="quiz-top"><span>'+(ST.idx+1)+' / '+ST.qs.length+'</span>'
    +'<div class="progress"><div class="progress-fill" style="width:'+(ST.idx/ST.qs.length*100)+'%"></div></div>'
    +'<span>✅ '+ST.score+'</span></div>'
    +'<div class="muted">'+escapeHtml(H.title)+' • 📚 '+escapeHtml(f.chapterName||f.chapterId||"")+' • '+escapeHtml(f.lvl||"")+'</div>'
    +'<h3 class="fill-sent" dir="ltr" style="text-align:left" id="'+p+'Sent">'+sentexBlankHtml(f,null,false)+'</h3>'
    +'<div class="quiz-opts" id="'+p+'Opts">'
    +opts.map(function(o,j){return '<button class="quiz-opt" data-j="'+j+'" dir="ltr">'+letters[j]+') '+escapeHtml(o)+'</button>';}).join("")
    +'</div><div class="quiz-feedback hidden" id="'+p+'Fb"></div>'
    +'<div class="row-flex"><button class="btn btn-primary" id="'+p+'Next" disabled>التالي ⏭</button>'
    +'<button class="btn btn-ghost" id="'+p+'Quit">إنهاء ✖</button></div></div>';
  $(p+"Quit").addEventListener("click",function(){finishSx(H);});
  box.querySelectorAll("#"+p+"Opts .quiz-opt").forEach(function(b){
    b.addEventListener("click",function(){answerSx(H,parseInt(b.getAttribute("data-j"),10),correctPos,opts,f);});
  });
}
function renderSentexQ(){renderSxQ(sxHost("sentex"));}
function answerSx(H,j,correctPos,opts,f){
  const p=H.name==="practice"?"px":"sx";
  const ST=H.st;
  const box=$(p+"Opts");if(!box)return;
  const ok=j===correctPos;
  Array.from(box.children).forEach(function(b,bi){
    b.disabled=true;
    if(bi===correctPos)b.classList.add("correct");
  });
  if(!ok&&box.children[j])box.children[j].classList.add("wrong");
  /* fill the real blank with the user's pick */
  const sent=$(p+"Sent");
  if(sent)sent.innerHTML=sentexBlankHtml(f,opts[j],ok);
  const fb=$(p+"Fb");fb.classList.remove("hidden","ok","no");fb.classList.add(ok?"ok":"no");
  const correct=(f.o&&f.o[f.c])||"";
  fb.innerHTML=(ok?"صحيح ✅ ":"خطأ ❌ ")
    +(ok?escapeHtml(f.s.replace("___",correct))+"<br>":"إجابتك: <b>"+escapeHtml(opts[j])+"</b> • الصحيحة: <b style='color:var(--green)'>"+escapeHtml(correct)+"</b><br>")
    +"<span class='muted'>"+escapeHtml(f.why||"")+"</span>";
  /* progress + totals (reuse store) */
  if(ok){ST.score++;try{S.totalCorrect++;}catch(e){}}
  try{S.totalAnswered++;}catch(e){}
  sentexRecordProgress(f,ok);
  try{
    if(!ok){
      recordMistake(sentexPseudoWord(f),opts[j],H.src,
        {qid:f.id,chapterId:f.chapterId,lessonId:(f.lessonId===undefined?null:f.lessonId),source:H.src});
    }
    save();
  }catch(e){}
  ST.results.push({ok:ok,picked:opts[j],correct:correct,f:f});
  H.st=ST;
  $(p+"Next").disabled=false;
  const HH=H;
  $(p+"Next").addEventListener("click",function(){const s=HH.st;s.idx++;HH.st=s;renderSxQ(HH);},{once:true});
}
function answerSentex(j,correctPos,opts,f){answerSx(sxHost("sentex"),j,correctPos,opts,f);}
function finishSx(H){
  const p=H.name==="practice"?"px":"sx";
  const ST=H.st;
  const run=$(p+"Run");if(!run)return;
  const total=ST.qs.length,score=ST.score;
  const pct=total?Math.round(score/total*100):0;
  try{
    S.testsTaken=(S.testsTaken||0)+1;
    if(pct>(S.bestPct||0))S.bestPct=pct;
    addXP(score*2+5,H.src);markStudyDay();save();
  }catch(e){}
  const per={};
  ST.results.forEach(function(r){
    const id=r.f.chapterId||"?";
    if(!per[id])per[id]={n:0,ok:0,name:r.f.chapterName||id};
    per[id].n++;if(r.ok)per[id].ok++;
  });
  const perRows=Object.keys(per).sort().map(function(k){
    const q=per[k];
    return '<div class="stat-bar-row"><span class="lbl">'+escapeHtml(k)+'</span><div class="bar"><div class="fill" style="width:'+Math.round(q.ok/Math.max(1,q.n)*100)+'%;background:linear-gradient(90deg,#22c55e,#4ade80)"></div></div><b>'+q.ok+'/'+q.n+'</b></div>'
      +'<div class="muted">'+escapeHtml(q.name)+'</div>';
  }).join("");
  const wrongs=ST.results.filter(function(r){return !r.ok;});
  const wrongRows=wrongs.length?wrongs.map(function(r){
    return '<div class="mist-err">❌ <b dir="ltr">'+escapeHtml(r.f.s.replace("___","______"))+'</b><br>إجابتك: <b>'+escapeHtml(r.picked)+'</b> | الصحيحة: <b style="color:var(--green)">'+escapeHtml(r.correct)+'</b><br><span class="muted">'+escapeHtml(r.f.why||"")+' • '+escapeHtml(r.f.chapterId||"")+'</span></div>';
  }).join(""):'<div class="muted">ممتاز — بلا أخطاء! 🎉</div>';
  const title=ST.mode==="single"?("Kapitel "+(ST.chapters[0]||"")):(ST.mode==="mixed"?"🌍 مختلط — جميع Kapitel":"📚 "+ST.chapters.join(" + "));
  run.innerHTML='<div class="panel glass" style="text-align:center"><h3>🎯 النتيجة — '+escapeHtml(title)+'</h3>'
    +'<div class="stat-num" style="font-size:44px">'+score+' / '+total+'</div>'
    +'<div class="stat-num" style="font-size:28px">'+pct+'%</div>'
    +'<div class="progress" style="margin:10px 0"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
    +perRows
    +'<h4 style="margin-top:12px">أخطاؤك ('+wrongs.length+')</h4>'+wrongRows
    +'<div class="row-flex" style="justify-content:center;margin-top:12px"><button class="btn btn-primary sm" id="'+p+'Again">🔄 تدريب جديد</button>'
    +'<button class="btn btn-gold sm" id="'+p+'GoMist">❌ مراجعة أخطائي</button>'
    +'<button class="btn btn-ghost sm" id="'+p+'Home">🏠 الرئيسية</button></div></div>';
  const HH=H;
  $(p+"Again").addEventListener("click",function(){renderSxHome(HH);const b=$(HH.boxId);if(b)b.scrollIntoView({behavior:"smooth"});});
  $(p+"GoMist").addEventListener("click",function(){showPage("mistakes");});
  $(p+"Home").addEventListener("click",function(){showPage("dashboard");});
  try{if(typeof renderAll==="function")renderAll();}catch(e){}
  run.scrollIntoView({behavior:"smooth"});
}
function finishSentex(){finishSx(sxHost("sentex"));}

/* ---------- i18n + page wiring (additive, never override pages) ---------- */
try{
  if(typeof I18N!=="undefined"){
    if(I18N.ar)I18N.ar.sentex="تدريبات الجمل";
    if(I18N.en)I18N.en.sentex="Sentence Exercises";
  }
}catch(e){}
(function(){
  /* Route 🧠 تدريب ذكي to the SENT_FILL engine (override vocab-based version).
     play.js captured the old renderPractice inside PLAY_PAGES, so repoint it too. */
  try{
    renderPractice=renderSmartPractice;
    if(typeof PLAY_PAGES!=="undefined")PLAY_PAGES.practice=renderSmartPractice;
  }catch(e){console.error(e);}
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{
      if(n==="sentex")renderSentex();
      if(n==="practice")renderSmartPractice();
    }catch(e){console.error(e);}};
  }catch(e){console.error(e);}
  try{
    document.querySelectorAll("[data-goto='sentex']").forEach(function(b){
      b.addEventListener("click",function(){showPage("sentex");});
    });
    document.querySelectorAll("[data-goto='practice']").forEach(function(b){
      b.addEventListener("click",function(){showPage("practice");});
    });
  }catch(e){}
})();
