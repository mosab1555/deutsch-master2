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
  bank=bank.filter(function(f){return !f.kind||f.kind==="fill";}); /* quiz builder: fill-blank only */
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
    explain:t("sx_correctans")+correct+" — "+(f.why||"")};
}

/* ---------- host abstraction: two pages, one engine ---------- */
var SX={mode:"single",chapters:[],qs:[],idx:0,score:0,results:[]}; /* ✏️ تدريبات الجمل */
var PX={mode:"single",chapters:[],qs:[],idx:0,score:0,results:[]}; /* 🧠 تدريب ذكي */
function sxHost(name){
  if(name==="practice")return {name:"practice",boxId:"practiceBox",title:"🧠 تدريب ذكي",titleKey:"title_practice",
    src:"smart-training",get st(){return PX;},set st(v){PX=v;}};
  return {name:"sentex",boxId:"sentexBox",title:"✏️ تدريبات الجمل",titleKey:"title_sentex",
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

/* ---------- internal training-view navigation (Sentence Training tabs) ----------
   Discovered exercise types from the SAME SENT_FILL bank (never assumed):
     fill      = Fill in the Blank (___ items, no kind)
     order     = Sentence Ordering (kind:"order", words[])
     qa        = Q&A / Multiple Choice response (kind:"qa")
     correct   = Choose the Correct Sentence (kind:"correct")
     error     = Spot the Error / Fix (kind:"error")
     transform = Sentence Transformation (kind:"transform")
     sit       = Situational Response (kind:"sit")
     all       = Mixed (every type)
   Single active-training container per page (sxRun / pxRun) is replaced via
   innerHTML only. Clicking a type switches state instead of scrolling. */
var activeSentenceTraining="all";
var activePracticeTraining="all";
function sentexTypeOf(f){
  try{
    if(f&&f.kind==="order")return "order";
    if(f&&f.kind==="qa")return "qa";
    if(f&&f.kind==="correct")return "correct";
    if(f&&f.kind==="error")return "error";
    if(f&&f.kind==="transform")return "transform";
    if(f&&f.kind==="sit")return "sit";
    return "fill";
  }catch(e){return "fill";}
}
function sentexTypeMeta(){
  return [
    {id:"all",icon:"🌍"},
    {id:"fill",icon:"✏️"},
    {id:"order",icon:"🔀"},
    {id:"qa",icon:"💬"},
    {id:"correct",icon:"✅"},
    {id:"error",icon:"🔍"},
    {id:"transform",icon:"🔄"},
    {id:"sit",icon:"🎭"}
  ];
}
function sentexTypeLabel(id){
  var map={all:"الكل",fill:"إكمال الفراغ",order:"ترتيب الجملة",qa:"سؤال وجواب",
    correct:"اختر الصحيحة",error:"اكتشف الخطأ",transform:"تحويل الجملة",sit:"المواقف"};
  try{
    var k="sx_type_"+id;
    var v=t(k);
    if(v&&v!==k)return v;
  }catch(e){}
  return map[id]||id;
}
function sxActiveType(H){
  try{
    if(H.name==="practice")return activePracticeTraining||"all";
    return activeSentenceTraining||"all";
  }catch(e){return "all";}
}
function sxSetActiveType(H,id){
  try{
    if(H.name==="practice")activePracticeTraining=id||"all";
    else activeSentenceTraining=id||"all";
  }catch(e){}
}
function sentexTypeCounts(){
  var counts={all:0,fill:0,order:0,qa:0,correct:0,error:0,transform:0,sit:0};
  try{
    sentexBank().forEach(function(f){
      var k=sentexTypeOf(f);
      if(counts[k]===undefined)counts[k]=0;
      counts[k]++;counts.all++;
    });
  }catch(e){}
  return counts;
}
/* Dedicated Sentence Training UI state (per page; never touches other sections).
   activeSentenceTraining / activePracticeTraining hold the selected TYPE id.
   SXUI / PXUI hold the chapter scope: {chapters:null|[...], mode:"single"|"multi"|"mixed"}.
   chapters===null means "all chapters". */
var SXUI={chapters:null,mode:"mixed"};
var PXUI={chapters:null,mode:"mixed"};
function sxUI(H){
  try{if(H.name==="practice")return PXUI;}catch(e){}
  return SXUI;
}
function sxScopeChapters(H){
  try{
    var u=sxUI(H);
    if(u.chapters&&u.chapters.length)return u.chapters.slice();
  }catch(e){}
  try{return sentexChapters().map(function(c){return c.id;});}catch(e){return [];}
}
/* Render the placeholder / hint inside the single active container. */
function renderSxPlaceholder(H){
  var runId=(H.name==="practice")?"pxRun":"sxRun";
  var box=$(runId);if(!box)return;
  var type=sxActiveType(H);
  box.innerHTML='<div class="panel glass sx-active-hint"><h3>'+escapeHtml(sentexTypeLabel(type))
    +' — '+escapeHtml(t(H.titleKey))+'</h3>'
    +'<div class="muted">اختر نوع التدريب أو Kapitel من الأعلى — سيفتح هنا مباشرة.</div>'
    +'<div class="row-flex" style="justify-content:center"><button class="btn btn-primary sm" id="'+(H.name==="practice"?"px":"sx")+'Begin">ابدأ ▶</button></div></div>';
  var bg=$(H.name==="practice"?"pxBegin":"sxBegin");
  if(bg)bg.addEventListener("click",function(){
    startSxRun(H,sxScopeChapters(H),sxUI(H).mode||"mixed",sxActiveType(H));
  });
}
/* Sync tab/chip visual state without rebuilding the shell (no duplicate listeners). */
function sxSyncSelector(H,box){
  try{
    var p=H.name, type=sxActiveType(H), u=sxUI(H);
    var scope=sxScopeChapters(H);
    box.querySelectorAll("[data-"+p+"-type]").forEach(function(x){
      var on=x.getAttribute("data-"+p+"-type")===type;
      x.classList.toggle("active",on);
      x.setAttribute("aria-selected",on?"true":"false");
    });
    box.querySelectorAll("[data-"+p+"-chap]").forEach(function(x){
      var id=x.getAttribute("data-"+p+"-chap");
      var on=scope.indexOf(id)>=0&&(u.mode==="single"?scope.length===1:true);
      x.classList.toggle("active",on);
      x.setAttribute("aria-pressed",on?"true":"false");
    });
  }catch(e){}
}
/* Central switch: update state -> clear ONLY the active container -> render. */
function handleSentenceTrainingTypeChange(H,type){
  var box=$(H.boxId);if(!box)return;
  sxSetActiveType(H,type||"all");
  sxSyncSelector(H,box);
  startSxRun(H,sxScopeChapters(H),sxUI(H).mode||"mixed",sxActiveType(H));
}
function handleSentenceTrainingChapterChange(H,chapters,mode){
  var box=$(H.boxId);if(!box)return;
  try{sxUI(H).chapters=(chapters&&chapters.length)?chapters.slice():null;}catch(e){}
  try{sxUI(H).mode=mode||"single";}catch(e){}
  sxSyncSelector(H,box);
  startSxRun(H,sxScopeChapters(H),sxUI(H).mode||"single",sxActiveType(H));
}
/* One listen button per question render (fresh DOM each time -> no duplicates). */
function sxHear(text){
  try{
    if(typeof speakGerman==="function"){speakGerman(text);return;}
    if(typeof lxSay==="function"){lxSay(text);return;}
  }catch(e){}
  try{toast("🔊","ok");}catch(_){}
}

/* ---------- home: compact selector (top) + ONE active view (below) ----------
   Layout order inside #sentexBox / #practiceBox:
     1. header panel
     2. .sx-types      (training-type tabs, horizontal scroll)
     3. .sx-chapters   (Kapitel chips: click = open single-Kapitel training now)
     4. .sx-modes      (multi select + mixed, compact)
     5. #sxRun/.sx-active-view (the ONLY exercise container, directly below)
   Clicking any tab/chip/button re-renders ONLY #sxRun in place. No scrolling. */
function renderSxHome(H){
  sentexEnsure();
  const box=$(H.boxId);if(!box)return;
  const chs=sentexChapters();
  const bank=sentexBank();
  if(!bank.length){box.innerHTML='<div class="panel glass">'+t("sx_empty")+'</div>';return;}
  const p=H.name; /* id prefix for data-attrs/buttons: sentex | practice */
  const runId=(H.name==="practice")?"pxRun":"sxRun"; /* single active-training container */
  const active=sxActiveType(H);
  const counts=sentexTypeCounts();
  const scope=sxScopeChapters(H);
  const uiMode=sxUI(H).mode||"mixed";
  let h='<div class="panel glass"><h3>'+t(H.titleKey)+'</h3>'
    +'<div class="muted">'+t("sx_sub")+" ("+bank.length+" "+t("sx_questions")+"))</div></div>";
  /* 1) training-type selector */
  h+='<div class="sx-types" role="tablist" aria-label="'+escapeHtml(t(H.titleKey))+'">'
    +sentexTypeMeta().map(function(m){
      var on=(m.id===active);
      return '<button type="button" class="sx-type'+(on?" active":"")+'" role="tab" aria-selected="'+(on?"true":"false")+'"'
        +' data-'+p+'-type="'+m.id+'">'
        +'<span class="sx-type-ico">'+m.icon+'</span> '
        +'<span>'+escapeHtml(sentexTypeLabel(m.id))+'</span> '
        +'<span class="sx-type-n">'+(counts[m.id]||0)+'</span></button>';
    }).join("")+'</div>';
  /* 2) Kapitel chips (compact; every chapter keeps count + progress, click opens now) */
  h+='<div class="panel glass sx-sel"><div class="sx-sel-h">Kapitel</div><div class="sx-chapters" role="group" aria-label="Kapitel">'
    +chs.map(function(c){
      var pct=null;
      try{
        const pr=S.sentex&&S.sentex[c.id];
        if(pr&&pr.n)pct=Math.round(pr.ok/Math.max(1,pr.n)*100);
      }catch(e){}
      var on=scope.indexOf(c.id)>=0&&(uiMode==="single"?scope.length===1:true);
      return '<button type="button" class="sx-chip'+(on?" active":"")+'" aria-pressed="'+(on?"true":"false")+'"'
        +' data-'+p+'-chap="'+c.id+'" title="'+escapeHtml(sentexChapterName(c.id))+' • '+c.n+" "+escapeHtml(t("sx_questions"))+(pct===null?"":' • '+pct+'%')+'">'
        +'<b>'+escapeHtml(c.id)+'</b><span class="sx-chip-n">'+c.n+'</span>'
        +(pct===null?"":'<span class="sx-chip-p">'+pct+'%</span>')+'</button>';
    }).join("")+'</div>';
  /* 3) modes: multi (checkboxes + start) + mixed (all), compact */
  h+='<div class="row-flex sx-modes"><button class="btn btn-gold sm" id="'+p+'MixedStart">'+t("sx_mixed_btn")+'</button>'
    +'<button class="btn btn-ghost sm" id="'+p+'MultiToggle">'+t("sx_multi_btn")+'</button></div>'
    +'<div class="sx-multi hidden" id="'+p+'MultiWrap"><div class="row-flex" style="flex-wrap:wrap">'
    +chs.map(function(c){return '<label style="display:flex;gap:6px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px 12px"><input type="checkbox" data-'+p+'-multi="'+c.id+'"> '+escapeHtml(c.id)+' ('+c.n+')</label>';}).join("")
    +'</div><div class="row-flex"><button class="btn btn-gold sm" id="'+p+'MultiStart">'+t("sx_multi_btn")+'</button></div></div></div>';
  /* 4) ONE active-training container directly below the selectors */
  h+='<div id="'+runId+'" class="sx-active-view" aria-live="polite"></div>';
  box.innerHTML=h;
  /* wire type tabs: state -> clear active container -> render selected training */
  box.querySelectorAll("[data-"+p+"-type]").forEach(function(b){
    b.addEventListener("click",function(){
      handleSentenceTrainingTypeChange(H,b.getAttribute("data-"+p+"-type")||"all");
    });
  });
  /* wire Kapitel chips: open that Kapitel immediately with the current type */
  box.querySelectorAll("[data-"+p+"-chap]").forEach(function(b){
    b.addEventListener("click",function(){
      handleSentenceTrainingChapterChange(H,[b.getAttribute("data-"+p+"-chap")],"single");
    });
  });
  const mt=$(p+"MultiToggle");
  if(mt)mt.addEventListener("click",function(){
    var w=$(p+"MultiWrap");if(w)w.classList.toggle("hidden");
  });
  const ms=$(p+"MultiStart");
  if(ms)ms.addEventListener("click",function(){
    const sel=Array.from(box.querySelectorAll("[data-"+p+"-multi]:checked")).map(function(x){return x.getAttribute("data-"+p+"-multi");});
    if(!sel.length){toast(t("sx_nochoice"),"err");return;}
    handleSentenceTrainingChapterChange(H,sel,"multi");
  });
  const mx=$(p+"MixedStart");
  if(mx)mx.addEventListener("click",function(){
    handleSentenceTrainingChapterChange(H,chs.map(function(c){return c.id;}),"mixed");
  });
  renderSxPlaceholder(H);
}
/* backward-compatible wrappers for page-sentex */
function renderSentex(){renderSxHome(sxHost("sentex"));}
/* renderer for page-practice (🧠 تدريب ذكي) — wired to SENT_FILL, not vocab */
function renderSmartPractice(){renderSxHome(sxHost("practice"));}

/* ---------- run (single active container, no scrolling navigation) ---------- */
function startSxRun(H,chapters,mode,typeId){
  const bank=sentexBank();
  const set={};(chapters||[]).forEach(function(k){set[k]=1;});
  /* strict isolation: chapterId must be in the selected set */
  let pool=bank.filter(function(f){return set[f.chapterId];});
  /* training-type filter: active tab wins unless an explicit type is passed */
  var type=typeId||sxActiveType(H)||"all";
  if(type&&type!=="all")pool=pool.filter(function(f){return sentexTypeOf(f)===type;});
  if(!pool.length){toast(t("sx_noqs"),"err");return;}
  pool=sentexShuffle(pool);
  if(mode==="mixed")pool=pool.slice(0,Math.min(20,pool.length));
  H.st={mode:mode,chapters:(chapters||[]).slice(),qs:pool,idx:0,score:0,results:[],type:type};
  try{markStudyDay();}catch(e){}
  renderSxQ(H);
  /* NOTE: no scrollIntoView / window.scrollTo here by design.
     The single active container (sxRun/pxRun) sits directly below the
     selectors, so switching trainings replaces content in place. */
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
  if(f.kind==="order"){renderSxOrder(H,f);return;}
  const letters=["A","B","C","D","E","F"];
  const order=sentexShuffle((f.o||[]).map(function(_,i){return i;}));
  const opts=order.map(function(i){return f.o[i];});
  const correctPos=order.indexOf(f.c);
  const prompt=f.q?'<div class="muted" style="font-weight:800;margin-bottom:6px">'+escapeHtml(f.q)+'</div>':"";
  const hasBlank=String(f.s||"").indexOf("___")>=0;
  const disp=f.disp?'<h3 class="fill-sent" dir="ltr" style="text-align:left">'+escapeHtml(f.disp)+'</h3>'
    :(hasBlank?'<h3 class="fill-sent" dir="ltr" style="text-align:left" id="'+p+'Sent">'+sentexBlankHtml(f,null,false)+'</h3>'
    :'<h3 class="fill-sent" dir="ltr" style="text-align:left">'+escapeHtml(f.s||"")+'</h3>');
  var hearTxt=(f.disp||"")+" "+(String(f.s||"").replace("___",(f.o&&f.o[f.c])||""));
  box.innerHTML='<div class="panel glass"><div class="row-flex sx-run-top"><button class="btn btn-ghost sm" id="'+p+'Back">←</button>'
    +'<span class="muted">'+escapeHtml(sentexTypeLabel((ST.type||sxActiveType(H))))+'</span>'
    +'<button class="btn btn-ghost sm" id="'+p+'Hear">🔊</button></div>'
    +'<div class="quiz-top"><span>'+(ST.idx+1)+' / '+ST.qs.length+'</span>'
    +'<div class="progress"><div class="progress-fill" style="width:'+(ST.idx/ST.qs.length*100)+'%"></div></div>'
    +'<span>✅ '+ST.score+'</span></div>'
    +'<div class="muted">'+escapeHtml(t(H.titleKey))+' •📚 '+escapeHtml(f.chapterName||f.chapterId||"")+' • '+escapeHtml(f.lvl||"")+'</div>'
    +prompt+disp
    +'<div class="quiz-opts" id="'+p+'Opts">'
    +opts.map(function(o,j){return '<button class="quiz-opt" data-j="'+j+'" dir="ltr">'+letters[j]+') '+escapeHtml(o)+'</button>';}).join("")
    +'</div><div class="quiz-feedback hidden" id="'+p+'Fb"></div>'
    +'<div class="row-flex"><button class="btn btn-primary" id="'+p+'Next" disabled>التالي ⏭</button>'
    +'<button class="btn btn-ghost" id="'+p+'Quit">إنهاء ✖</button></div></div>';
  $(p+"Back").addEventListener("click",function(){renderSxPlaceholder(H);});
  $(p+"Hear").addEventListener("click",function(){sxHear(hearTxt);});
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
  /* fill the real blank with the user's pick (fill-blank items only) */
  const sent=$(p+"Sent");
  if(sent&&String(f.s||"").indexOf("___")>=0)sent.innerHTML=sentexBlankHtml(f,opts[j],ok);
  const fb=$(p+"Fb");fb.classList.remove("hidden","ok","no");fb.classList.add(ok?"ok":"no");
  const correct=(f.o&&f.o[f.c])||"";
  fb.innerHTML=(ok?t("sx_correct"):t("sx_wrong"))
    +(ok?escapeHtml(f.s.replace("___",correct))+"<br>":t("sx_yourans")+"<b>"+escapeHtml(opts[j])+"</b> • "+t("sx_correctans")+"<b style='color:var(--green)'>"+escapeHtml(correct)+"</b><br>")
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
function renderSxOrder(H,f){
  const p=H.name==="practice"?"px":"sx";
  const ST=H.st;
  const box=$(p+"Run");if(!box)return;
  const sh=sentexShuffle(f.words.map(function(_,k){return k;}));
  box.innerHTML='<div class="panel glass"><div class="row-flex sx-run-top"><button class="btn btn-ghost sm" id="'+p+'Back">←</button>'
    +'<span class="muted">'+escapeHtml(sentexTypeLabel("order"))+'</span>'
    +'<button class="btn btn-ghost sm" id="'+p+'Hear">🔊</button></div>'
    +'<div class="quiz-top"><span>'+(ST.idx+1)+' / '+ST.qs.length+'</span>'
    +'<div class="progress"><div class="progress-fill" style="width:'+(ST.idx/ST.qs.length*100)+'%"></div></div>'
    +'<span>✅ '+ST.score+'</span></div>'
    +'<div class="muted">'+escapeHtml(t(H.titleKey))+' •📚 '+escapeHtml(f.chapterName||f.chapterId||"")+' • '+escapeHtml(f.lvl||"")+'</div>'
    +'<div class="muted" style="font-weight:800;margin-bottom:6px">'+escapeHtml(f.q||"")+'</div>'
    +'<div class="muted">'+escapeHtml(t("sx_order_hint"))+'</div>'
    +'<div class="quiz-opts" id="'+p+'Chips" dir="ltr">'
    +sh.map(function(k){return '<button class="quiz-opt" data-k="'+k+'" dir="ltr">'+escapeHtml(f.words[k])+'</button>';}).join("")
    +'</div>'
    +'<div class="quiz-opts" id="'+p+'Ans" style="min-height:52px;border:1px dashed var(--border);border-radius:12px" dir="ltr"></div>'
    +'<div class="quiz-feedback hidden" id="'+p+'Fb"></div>'
    +'<div class="row-flex"><button class="btn btn-gold sm" id="'+p+'Go">'+escapeHtml(t("gl_check"))+'</button>'
    +'<button class="btn btn-ghost sm" id="'+p+'Clr">'+escapeHtml(t("gl_clear"))+'</button></div>'
    +'<div class="row-flex"><button class="btn btn-primary" id="'+p+'Next" disabled>التالي ⏭</button>'
    +'<button class="btn btn-ghost" id="'+p+'Quit">إنهاء ✖</button></div></div>';
  $(p+"Back").addEventListener("click",function(){renderSxPlaceholder(H);});
  $(p+"Hear").addEventListener("click",function(){sxHear((f.words||[]).join(" "));});
  $(p+"Quit").addEventListener("click",function(){finishSx(H);});
  const picked=[];
  box.querySelectorAll("#"+p+"Chips .quiz-opt").forEach(function(b){
    b.addEventListener("click",function(){
      if(b.disabled)return;b.disabled=true;
      const k=parseInt(b.getAttribute("data-k"),10);
      picked.push(k);
      const a=$(p+"Ans");const s=document.createElement("button");s.className="quiz-opt";s.textContent=b.textContent;s.setAttribute("dir","ltr");
      s.addEventListener("click",function(){
        try{a.removeChild(s);}catch(e){}
        const ix=picked.indexOf(k);if(ix>=0)picked.splice(ix,1);
        b.disabled=false;
      });
      a.appendChild(s);
    });
  });
  $(p+"Clr").addEventListener("click",function(){
    picked.length=0;$(p+"Ans").innerHTML="";
    box.querySelectorAll("#"+p+"Chips .quiz-opt").forEach(function(x){x.disabled=false;});
  });
  $(p+"Go").addEventListener("click",function(){
    const ok=picked.length===f.words.length&&picked.every(function(v,ix){return v===ix;});
    answerSxOrder(H,ok,picked.map(function(k){return f.words[k];}).join(" "),f.words.join(" "),f);
  });
}
function answerSxOrder(H,ok,pickedStr,correctStr,f){
  const p=H.name==="practice"?"px":"sx";
  const ST=H.st;
  const box=$(p+"Chips");if(!box)return;
  Array.from(box.children).forEach(function(b){b.disabled=true;});
  const go=$(p+"Go");if(go)go.disabled=true;
  const clr=$(p+"Clr");if(clr)clr.disabled=true;
  const fb=$(p+"Fb");fb.classList.remove("hidden","ok","no");fb.classList.add(ok?"ok":"no");
  fb.innerHTML=(ok?t("sx_correct"):t("sx_wrong"))
    +(ok?escapeHtml(correctStr)+"<br>":t("sx_yourans")+"<b>"+escapeHtml(pickedStr)+"</b> • "+t("sx_correctans")+"<b style='color:var(--green)'>"+escapeHtml(correctStr)+"</b><br>")
    +"<span class='muted'>"+escapeHtml(f.why||"")+"</span>";
  if(ok){ST.score++;try{S.totalCorrect++;}catch(e){}}
  try{S.totalAnswered++;}catch(e){}
  sentexRecordProgress(f,ok);
  try{
    if(!ok){
      recordMistake(sentexPseudoWord(f),pickedStr,H.src,
        {qid:f.id,chapterId:f.chapterId,lessonId:(f.lessonId===undefined?null:f.lessonId),source:H.src});
    }
    save();
  }catch(e){}
  ST.results.push({ok:ok,picked:pickedStr,correct:correctStr,f:f});
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
    return '<div class="stat-bar-row"><span class="lbl">'+escapeHtml(k)+'</span><div class="bar"><div class="fill" style="width:'+Math.round(q.ok/Math.max(1,q.n)*100)+'%;background:linear-gradient(90deg,#1E7A55,#2FA97C)"></div></div><b>'+q.ok+'/'+q.n+'</b></div>'
      +'<div class="muted">'+escapeHtml(q.name)+'</div>';
  }).join("");
  const wrongs=ST.results.filter(function(r){return !r.ok;});
  const wrongRows=wrongs.length?wrongs.map(function(r){
    return '<div class="mist-err">❌ <b dir="ltr">'+escapeHtml(r.f.s.replace("___","______"))+'</b><br>'+t("sx_yourans")+"<b>"+escapeHtml(r.picked)+"</b> | "+t("sx_correctans")+'<b style="color:var(--green)">'+escapeHtml(r.correct)+"</b><br><span class='muted'>"+escapeHtml(r.f.why||"")+' • '+escapeHtml(r.f.chapterId||"")+'</span></div>';
  }).join(""):'<div class="muted">'+t("sx_noerr")+'</div>';
  const title=ST.mode==="single"?("Kapitel "+(ST.chapters[0]||"")):(ST.mode==="mixed"?"🌍 مختلط — جميع Kapitel":"📚 "+ST.chapters.join(" + "));
  run.innerHTML='<div class="panel glass" style="text-align:center"><h3>'+t("sx_result")+escapeHtml(title)+'</h3>'
    +'<div class="stat-num" style="font-size:44px">'+score+' / '+total+'</div>'
    +'<div class="stat-num" style="font-size:28px">'+pct+'%</div>'
    +'<div class="progress" style="margin:10px 0"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
    +perRows
    +'<h4 style="margin-top:12px">'+t("sx_errors")+wrongs.length+')</h4>'+wrongRows
    +'<div class="row-flex" style="justify-content:center;margin-top:12px"><button class="btn btn-primary sm" id="'+p+'Again">'+t("sx_again")+'</button>'
    +'<button class="btn btn-gold sm" id="'+p+'GoMist">'+t("sx_gomist")+'</button>'
    +'<button class="btn btn-ghost sm" id="'+p+'Back">'+t("sx_home")+' ←</button>'
    +'<button class="btn btn-ghost sm" id="'+p+'Home">🏠</button></div></div>';
  const HH=H;
  $(p+"Back").addEventListener("click",function(){renderSxPlaceholder(HH);});
  $(p+"Again").addEventListener("click",function(){
    /* Restart the same training in the same container (no page scroll). */
    try{
      var st=HH.st||{chapters:[],mode:"mixed"};
      startSxRun(HH,st.chapters&&st.chapters.length?st.chapters.slice():sentexChapters().map(function(c){return c.id;}),st.mode||"mixed",st.type||sxActiveType(HH));
    }catch(e){try{renderSxHome(HH);}catch(_){}}
  });
  $(p+"GoMist").addEventListener("click",function(){showPage("mistakes");});
  $(p+"Home").addEventListener("click",function(){showPage("dashboard");});
  try{if(typeof renderAll==="function")renderAll();}catch(e){}
  /* NOTE: no scrollIntoView here by design (internal view, no page jump). */
}
function finishSentex(){finishSx(sxHost("sentex"));}

/* ---------- page wiring (I18N dict lives in study.js) ---------- */
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
      /* Page-state preservation: keep active training (type/chapter/question) as-left. */
      var _skip=!!(typeof DMPageState!=="undefined"&&DMPageState&&DMPageState.skipRender&&(DMPageState.skipRender("sentex")||DMPageState.skipRender("practice")));
      if(n==="sentex"&&!_skip)renderSentex();
      if(n==="practice"&&!_skip)renderSmartPractice();
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
