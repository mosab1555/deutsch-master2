/* Deutsch Master - New Training Labs (ADDITIVE ONLY).
   5 fully-functional systems, real A1 content, no placeholders:
     - page-shadowing (🎙️ Shadowing Lab)  -> SH state
     - page-writing   (✍️ Writing Lab)     -> WR state
     - page-dictation (👂 Dictation Lab)   -> DC state
     - page-situations(🎬 German Situations)-> GS state (branching)
     - page-erreplay  (🧠 Error Replay + ⚠️ Confusion Trainer tabs) -> ER/CF state
   Reuses (never rewrites): speakGerman, SpeechRecognition pattern, TutorLocal,
   recordMistake, allWords, conjugateVerb, dmLev, addXP, markStudyDay, save,
   showPage-wrap pattern, theme classes. Storage: S.labsx namespace only. */
"use strict";

/* ---------- i18n (merged additively; page keys match data-page names) ---------- */
try{
  Object.assign(I18N.ar,{shadowing:"🎙️ تقليد النطق",writing:"✍️ مختبر الكتابة",dictation:"👂 الإملاء السمعي",situations:"🎬 مواقف ألمانية",erreplay:"🧠 أخطائي",labsx_new:"🚀 معامل التدريب الجديدة"});
  Object.assign(I18N.en,{shadowing:"🎙️ Shadowing",writing:"✍️ Writing Lab",dictation:"👂 Dictation",situations:"🎬 Situations",erreplay:"🧠 Error Replay",labsx_new:"🚀 New Training Labs"});
  Object.assign(I18N.de,{shadowing:"🎙️ Shadowing",writing:"✍️ Schreiblabor",dictation:"👂 Diktat",situations:"🎬 Situationen",erreplay:"🧠 Fehler-Replay",labsx_new:"🚀 Neue Trainingslabore"});
}catch(e){}

/* ---------- storage (own namespace, safe migration, never wipes) ---------- */
function ensureLabsx(){
  if(!S.labsx)S.labsx={};
  const L=S.labsx;
  if(!L.shadow)L.shadow={att:0,best:0,mastered:0,last:null};
  if(!L.write)L.write={done:0,best:0,last:null,drafts:{}};
  if(!L.dict)L.dict={att:0,best:0,mastered:0,last:null};
  if(!L.sit)L.sit={done:{},last:null};
  if(!L.er)L.er={done:0,best:0,last:null,recent:[],signals:{}};
  if(!L.conf)L.conf={done:0,last:null,pair:{}};
  return L;
}
function lxSave(){try{save();}catch(e){}}
function lxTouch(lab,patch){
  try{
    ensureLabsx();
    const o=S.labsx[lab]||(S.labsx[lab]={});
    if(patch)Object.keys(patch).forEach(k=>{o[k]=patch[k];});
    o.last=todayStr();lxSave();
  }catch(e){}
}
function lxSignal(skill,n){
  try{
    ensureLabsx();
    const s=S.labsx.er.signals;
    s[skill]=(s[skill]||0)+(n||1);lxSave();
  }catch(e){}
}

/* ---------- shared text utils (pure, tested) ---------- */
function lxNorm(s){
  let x=String(s==null?"":s).toLowerCase();
  x=x.replace(/[.?!,;:¿¡]/g,"");
  x=x.split('"').join("").split("'").join("");
  x=x.split("„").join("").split("“").join("").split("”").join("").split("‚").join("");
  x=x.replace(/\s+/g," ").trim();
  x=x.replace(/ß/g,"ss").replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u");
  return x;
}
function lxTok(s){return lxNorm(s).split(" ").filter(Boolean);}
/* LCS length table for token alignment */
function lxLcs(a,b){
  const n=a.length,m=b.length;
  if(!n||!m)return 0;
  let prev=new Array(m+1).fill(0),cur=new Array(m+1).fill(0);
  for(let i=1;i<=n;i++){
    for(let j=1;j<=m;j++)cur[j]=a[i-1]===b[j-1]?prev[j-1]+1:Math.max(prev[j],cur[j-1]);
    const t=prev;prev=cur;cur=t;
  }
  return prev[m];
}
/* Align target vs said via LCS backtrack-free greedy mark:
   returns score 0-100 + per-target marks (ok|miss) + extra words. */
function lxDiff(target,said){
  const t=lxTok(target),s=lxTok(said);
  if(!t.length)return {score:0,marks:[],missing:[],extra:s.slice(),correct:[]};
  if(!s.length)return {score:0,marks:t.map(w=>({w:w,cls:"miss"})),missing:t.slice(),extra:[],correct:[]};
  const common=lxLcs(t,s);
  const score=Math.round(200*common/(t.length+s.length));
  const sCount={};s.forEach(w=>{sCount[w]=(sCount[w]||0)+1;});
  const marks=t.map(w=>{
    if(sCount[w]>0){sCount[w]--;return {w:w,cls:"ok"};}
    return {w:w,cls:"miss"};
  });
  const tCount={};t.forEach(w=>{tCount[w]=(tCount[w]||0)+1;});
  const extra=[];s.forEach(w=>{if(tCount[w]>0)tCount[w]--;else extra.push(w);});
  return {
    score:score,marks:marks,
    missing:marks.filter(m=>m.cls==="miss").map(m=>m.w),
    extra:extra,
    correct:marks.filter(m=>m.cls==="ok").map(m=>m.w)
  };
}
function lxHasSR(){
  try{return !!(window.SpeechRecognition||window.webkitSpeechRecognition);}catch(e){return false;}
}
/* One-shot de-DE listener. onText(transcript) | onErr(reason). */
function lxListen(onText,onErr){
  try{
    const Ctor=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Ctor){if(onErr)onErr("nosr");return null;}
    const r=new Ctor();r.lang="de-DE";r.interimResults=false;r.maxAlternatives=1;
    r.onresult=function(e){
      try{
        const tx=e.results[0][0].transcript;
        if(onText)onText(tx);
      }catch(ex){if(onErr)onErr("parse");}
    };
    r.onerror=function(){if(onErr)onErr("hear");};
    r.onend=function(){};
    r.start();
    toast("🎤 استمع للنطق... تحدث الآن","ok");
    return r;
  }catch(e){if(onErr)onErr("start");return null;}
}
function lxSay(text,slow){
  try{
    if(slow){
      const r=currentRate();S.settings.speed=0.55;speakGerman(text);S.settings.speed=r;
    }else speakGerman(text);
  }catch(e){try{speakGerman(text);}catch(_){}}
}

/* ================= 1. SHADOWING BANK (real A1 content) ================= */
const LX_SHADOW=[
{id:"sh-e1",lvl:"easy",kind:"word",de:"Haus",ar:"بيت"},{id:"sh-e2",lvl:"easy",kind:"word",de:"Wasser",ar:"ماء"},
{id:"sh-e3",lvl:"easy",kind:"word",de:"Schule",ar:"مدرسة"},{id:"sh-e4",lvl:"easy",kind:"word",de:"Apfel",ar:"تفاحة"},
{id:"sh-e5",lvl:"easy",kind:"word",de:"Buch",ar:"كتاب"},{id:"sh-e6",lvl:"easy",kind:"word",de:"Zug",ar:"قطار"},
{id:"sh-m1",lvl:"medium",kind:"short",de:"Guten Morgen!",ar:"صباح الخير!"},
{id:"sh-m2",lvl:"medium",kind:"short",de:"Wie geht es dir?",ar:"كيف حالك؟"},
{id:"sh-m3",lvl:"medium",kind:"short",de:"Ich heiße Ali.",ar:"اسمي علي."},
{id:"sh-m4",lvl:"medium",kind:"short",de:"Wo wohnst du?",ar:"أين تسكن؟"},
{id:"sh-m5",lvl:"medium",kind:"short",de:"Ich lerne Deutsch.",ar:"أنا أتعلم الألمانية."},
{id:"sh-m6",lvl:"medium",kind:"short",de:"Danke schön!",ar:"شكرًا جزيلًا!"},
{id:"sh-h1",lvl:"hard",kind:"long",de:"Ich komme aus Ägypten.",ar:"أنا من مصر."},
{id:"sh-h2",lvl:"hard",kind:"long",de:"Am Montag gehe ich zur Schule.",ar:"يوم الاثنين أذهب إلى المدرسة."},
{id:"sh-h3",lvl:"hard",kind:"long",de:"Meine Mutter kocht heute.",ar:"أمي تطبخ اليوم."},
{id:"sh-h4",lvl:"hard",kind:"long",de:"Der Zug fährt um halb acht.",ar:"القطار يتحرك السابعة والنصف."},
{id:"sh-d1",lvl:"medium",kind:"daily",de:"Einen Tisch für zwei, bitte.",ar:"طاولة لشخصين من فضلك."},
{id:"sh-d2",lvl:"medium",kind:"daily",de:"Was kostet das Brot?",ar:"كم سعر الخبز؟"},
{id:"sh-d3",lvl:"medium",kind:"daily",de:"Wo ist die Toilette, bitte?",ar:"أين الحمام من فضلك؟"},
{id:"sh-d4",lvl:"hard",kind:"daily",de:"Ich möchte einen Kaffee.",ar:"أريد قهوة."}
];
const LX_SH_LVLS=[["easy","🟢 سهل"],["medium","🟡 متوسط"],["hard","🔴 صعب"]];
const LX_SH_KINDS=[["word","كلمة"],["short","جملة قصيرة"],["long","جملة أطول"],["daily","الحياة اليومية"]];
var SH={lvl:"easy",kind:"word",idx:0,list:[],cur:null,listening:false};
function shPool(){
  let p=LX_SHADOW.filter(x=>x.lvl===SH.lvl&&x.kind===SH.kind);
  if(!p.length)p=LX_SHADOW.filter(x=>x.lvl===SH.lvl);
  if(!p.length)p=LX_SHADOW.slice();
  return p;
}
function renderShadow(){
  ensureLabsx();
  const box=$("shadowBox");if(!box)return;
  SH.list=shPool();SH.idx=0;
  const st=S.labsx.shadow;
  let h='<div class="panel glass"><h3>🎙️ Shadowing Lab — تقليد النطق</h3>'
    +'<div class="muted">اسمع 🔄 قلّد 🎤 قارن النتيجة — '+st.att+' محاولة • أفضل '+st.best+'% • متقن '+st.mastered+'</div>'
    +'<div class="row-flex"><select id="shLvl">'+LX_SH_LVLS.map(l=>'<option value="'+l[0]+'">'+l[1]+'</option>').join("")+'</select>'
    +'<select id="shKind">'+LX_SH_KINDS.map(k=>'<option value="'+k[0]+'">'+k[1]+'</option>').join("")+'</select></div>'
    +'<div id="shBody"></div></div>';
  box.innerHTML=h;
  $("shLvl").value=SH.lvl;$("shKind").value=SH.kind;
  $("shLvl").addEventListener("change",()=>{SH.lvl=$("shLvl").value;SH.list=shPool();SH.idx=0;shShow();});
  $("shKind").addEventListener("change",()=>{SH.kind=$("shKind").value;SH.list=shPool();SH.idx=0;shShow();});
  shShow();
}
function shShow(){
  const host=$("shBody");if(!host)return;
  if(!SH.list.length){host.innerHTML='<div class="muted">لا عناصر هنا — غيّر المستوى وحاول مجددًا 🔁</div>';return;}
  SH.cur=SH.list[SH.idx%SH.list.length];
  const c=SH.cur,noSR=!lxHasSR();
  host.innerHTML='<div class="muted">عنصر '+(SH.idx%SH.list.length+1)+' / '+SH.list.length+'</div>'
    +'<h3 dir="ltr" style="text-align:center">'+escapeHtml(c.de)+'</h3>'
    +'<div class="muted" style="text-align:center">'+escapeHtml(c.ar)+'</div>'
    +'<div class="row-flex" style="justify-content:center"><button class="btn btn-ghost sm" id="shHear">🔊 اسمع الجملة</button>'
    +'<button class="btn btn-primary sm" id="shGo">🎤 ابدأ التقليد</button></div>'
    +(noSR?'<div class="muted">⚠️ التعرف الصوتي غير مدعوم في متصفحك — وضع بديل: اكتب ما نطقتَ وسنقارنه لك ⌨️</div>'
      +'<div class="quiz-write"><input type="text" id="shTyped" dir="ltr" placeholder="اكتب ما نطقته..." autocomplete="off"><button class="btn btn-gold sm" id="shTypedGo">قارن ✅</button></div>'
      :'<div class="muted">اضغط "ابدأ التقليد" ثم انطق الجملة بصوت واضح.</div>')
    +'<div class="quiz-feedback hidden" id="shFb"></div><div id="shDiff"></div>'
    +'<div class="row-flex"><button class="btn btn-ghost sm" id="shRetry">🔁 إعادة</button><button class="btn btn-gold sm" id="shNext">التالي ⏭</button></div>';
  $("shHear").addEventListener("click",()=>lxSay(c.de));
  setTimeout(()=>lxSay(c.de),350);
  $("shRetry").addEventListener("click",shShow);
  $("shNext").addEventListener("click",()=>{SH.idx++;shShow();});
  if(noSR){
    $("shTypedGo").addEventListener("click",()=>{
      const v=$("shTyped").value.trim();
      if(!v){toast("اكتب ما نطقته أولًا ⌨️","err");return;}
      shGrade(v,true);
    });
    $("shGo").addEventListener("click",()=>toast("المايك غير مدعوم هنا — استخدم الكتابة بالأسفل ⌨️","err"));
  }else{
    $("shGo").addEventListener("click",()=>{
      if(SH.listening)return;
      SH.listening=true;
      $("shGo").disabled=true;$("shGo").textContent="🎤 أستمع...";
      lxListen(
        tx=>{SH.listening=false;shGrade(tx,false);},
        ()=>{SH.listening=false;const g=$("shGo");if(g){g.disabled=false;g.textContent="🎤 ابدأ التقليد";}toast("تعذر السماع — حاول مجددًا 🎤","err");}
      );
    });
  }
}
function shGrade(said,typed){
  const c=SH.cur;if(!c)return;
  const d=lxDiff(c.de,said);
  ensureLabsx();const st=S.labsx.shadow;
  st.att++;if(d.score>st.best)st.best=d.score;
  let mastered=false;
  if(d.score>=90){st.mastered++;mastered=true;try{addXP(10,"lx-shadow");}catch(e){}}
  else if(d.score>=70){try{addXP(5,"lx-shadow");}catch(e){}}
  try{S.totalCorrect+=d.score>=70?1:0;S.totalAnswered++;}catch(e){}
  try{markStudyDay();}catch(e){}
  lxTouch("shadow",{});
  if(d.score<70&&c.kind==="word"){
    try{const w=allWords().find(x=>x.de.toLowerCase()===lxNorm(c.de));if(w){recordMistake(w,said,"lx-shadow");lxSignal("pron",1);}}catch(e){}
  }
  lxSave();
  try{if(typeof renderAll==="function")renderAll();}catch(e){}
  const fb=$("shFb"),dw=$("shDiff");if(!fb||!dw)return;
  fb.classList.remove("hidden");fb.className="quiz-feedback "+(d.score>=70?"ok":"no");
  fb.textContent=(d.score>=90?"🌟 ممتاز! نطق متقن.":d.score>=70?"✅ جيد جدًا!":"🔁 حاول مجددًا — قارن الكلمات بالأسفل.")
   +" النتيجة: "+d.score+"%"+(typed?" (وضع الكتابة)":"");
  dw.innerHTML='<div class="muted">سمعتك تقول: <b dir="ltr">'+escapeHtml(said)+'</b></div>'
    +'<div class="quiz-opts" dir="ltr">'+d.marks.map(m=>'<span class="order-chip" style="'+(m.cls==="ok"?"border-color:var(--green)":"border-color:var(--red)")+'">'+escapeHtml(m.w)+'</span>').join("")+'</div>'
    +'<div class="muted">✅ صحيحة: '+(d.correct.join(", ")||"—")+'</div>'
    +'<div class="muted">⚠️ ناقصة/مختلفة: '+(d.missing.join(", ")||"لا يوجد — رائع!")+'</div>'
    +(d.extra.length?'<div class="muted">➕ زائدة عندك: '+escapeHtml(d.extra.join(", "))+'</div>':"")
    +(mastered?'<div class="muted">🏆 أُتقنت! ⭐+10</div>':"");
  const nx=$("shNext");if(nx)nx.scrollIntoView({behavior:"smooth",block:"nearest"});
}

/* ================= 2. WRITING BANK + ANALYZER ================= */
const LX_WRITE=[
{id:"wr-s1",type:"situation",t:"📝 كتابة من موقف",de:"Du möchtest einen Termin beim Arzt machen.",ar:"تريد حجز موعد عند الطبيب. اكتب جملتين بالألمانية.",keywords:["Termin","Arzt"],accepts:["Ich möchte einen Termin beim Arzt machen"],model:"Ich möchte einen Termin beim Arzt machen.",focus:"Modal"},
{id:"wr-s2",type:"situation",t:"📝 كتابة من موقف",de:"Lade deinen Freund zum Essen ein.",ar:"ادعُ صديقك للطعام. اكتب جملتين.",keywords:["komm","Essen"],accepts:["Kommst du zum Essen","Komm zum Essen"],model:"Kommst du zum Essen?",focus:"Imperativ"},
{id:"wr-s3",type:"situation",t:"📝 كتابة من موقف",de:"Du hast dein Buch in der Schule vergessen.",ar:"نسيت كتابك في المدرسة. أخبر مدرسك بجملتين.",keywords:["Buch","vergessen"],accepts:["Ich habe mein Buch vergessen"],model:"Entschuldigung, ich habe mein Buch vergessen.",focus:"Perfekt"},
{id:"wr-m1",type:"message",t:"💌 رسالة قصيرة",de:"Entschuldige dich: du kommst zu spät.",ar:"اعتذر: ستتأخر. اكتب رسالة قصيرة.",keywords:["Entschuldigung","spät"],accepts:["Entschuldigung, ich komme zu spät"],model:"Entschuldigung, ich komme zu spät.",focus:"Höflich"},
{id:"wr-m2",type:"message",t:"💌 رسالة قصيرة",de:"Bitte um einen Termin beim Lehrer.",ar:"اطلب موعدًا من المدرس.",keywords:["Termin","bitte"],accepts:["Ich hätte gern einen Termin"],model:"Guten Tag, ich hätte gern einen Termin, bitte.",focus:"Höflich"},
{id:"wr-m3",type:"message",t:"💌 رسالة قصيرة",de:"Danke für das Geschenk.",ar:"اشكر صديقك على الهدية.",keywords:["danke","Geschenk"],accepts:["Danke für das Geschenk"],model:"Vielen Dank für das Geschenk!",focus:"Dank"},
{id:"wr-p1",type:"describe",t:"🖼️ وصف مشهد",de:"🍎 🥖 ☕ Auf dem Tisch.",ar:"صف ما على الطاولة بجملتين.",keywords:["Tisch","Apfel"],accepts:["Auf dem Tisch sind ein Apfel, Brot und Kaffee","Der Apfel liegt auf dem Tisch"],model:"Auf dem Tisch liegen ein Apfel, Brot und Kaffee.",focus:"Platz"},
{id:"wr-p2",type:"describe",t:"🖼️ وصف مشهد",de:"👨‍👩‍👧 Familie.",ar:"صف صورة عائلية بجملتين.",keywords:["Familie","Mutter"],accepts:["Das ist meine Familie","Meine Mutter kocht gut"],model:"Das ist meine Familie. Meine Mutter kocht gut.",focus:"Familie"},
{id:"wr-p3",type:"describe",t:"🖼️ وصف مشهد",de:"🌅 Dein Morgen.",ar:"صف صباحك بجملتين.",keywords:["morgens","Kaffee"],accepts:["Morgens trinke ich Kaffee","Ich stehe um sechs Uhr auf"],model:"Ich stehe um sechs Uhr auf. Morgens trinke ich Kaffee.",focus:"Routine"},
{id:"wr-r1",type:"rebuild",t:"🧩 إعادة بناء",de:"«أنا أتعلم الألمانية.»",ar:"استخدم: Ich / lerne / Deutsch",keywords:["Ich","lerne","Deutsch"],accepts:["Ich lerne Deutsch"],model:"Ich lerne Deutsch.",focus:"Satzbau"},
{id:"wr-r2",type:"rebuild",t:"🧩 إعادة بناء",de:"«الكتاب على الطاولة.»",ar:"استخدم: Buch / liegt / auf / Tisch",keywords:["Buch","liegt","Tisch"],accepts:["Das Buch liegt auf dem Tisch"],model:"Das Buch liegt auf dem Tisch.",focus:"Präposition"},
{id:"wr-r3",type:"rebuild",t:"🧩 إعادة بناء",de:"«هل تتكلم العربية؟»",ar:"استخدم: Sprichst / du / Arabisch",keywords:["Sprichst","du","Arabisch"],accepts:["Sprichst du Arabisch"],model:"Sprichst du Arabisch?",focus:"Frage"}
];
var WR={idx:0};
function wrAnalyze(task,text){
  const norm=lxNorm(text),toks=lxTok(text);
  const res={ok:false,score:0,issues:[],why:[],alt:task.model,corrected:"",missing:[],hit:[]};
  if(task.accepts.some(a=>lxNorm(a)===norm)){
    res.ok=true;res.score=100;res.why.push("✅ صياغة صحيحة تمامًا.");
    res.hit=task.keywords.slice();return res;
  }
  const hit=task.keywords.filter(k=>toks.indexOf(lxNorm(k))>=0);
  const missing=task.keywords.filter(k=>toks.indexOf(lxNorm(k))<0);
  res.hit=hit;res.missing=missing;
  const cov=task.keywords.length?hit.length/task.keywords.length:1;
  /* spelling: unknown tokens close to model tokens */
  try{
    if(typeof dmLev==="function"){
      const mt=lxTok(task.model);
      toks.forEach(tk=>{
        if(mt.indexOf(tk)>=0||tk.length<3)return;
        const near=mt.find(m=>{try{return dmLev(tk,m)>0&&dmLev(tk,m)<=2;}catch(e){return false;}});
        if(near)res.issues.push({cat:"Spelling",t:"تهجئة: كتبت «"+tk+"» — هل تقصد «"+near+"»؟"});
      });
    }
  }catch(e){}
  /* word order: same multiset, different sequence */
  try{
    const sm=toks.slice().sort().join("|"),mm=lxTok(task.model).slice().sort().join("|");
    if(toks.length>=3&&sm===mm&&norm!==lxNorm(task.model))
      res.issues.push({cat:"Word Order",t:"الكلمات صحيحة لكن الترتيب يحتاج مراجعة (الفعل ثانيًا غالبًا)."});
  }catch(e){}
  /* tutor rules -> categorized */
  let iss=[];
  try{
    if(typeof TutorLocal!=="undefined"){
      const r=TutorLocal.correct(text);
      iss=(r&&r.issues)||[];
      res.corrected=(r&&r.corrected)||"";
      if(r&&r.fixes)res._fixes=r.fixes;
    }
  }catch(e){}
  iss.forEach(m=>{
    let cat="Grammar";
    if(/الأداة|der|die|das|eine?r?s?m?|kein/.test(m))cat="Artikel";
    else if(/فعل|صرّف|sein|مصدر/.test(m))cat="Verb";
    else if(/حرف كبير|كبيرة/.test(m))cat="Spelling";
    else if(/جمع|Plural/.test(m))cat="Plural";
    else if(/حرف جر|nach|aus|mit|in |an |auf /.test(m))cat="Preposition";
    res.issues.push({cat:cat,t:m});
  });
  if(missing.length)res.issues.push({cat:"Grammar",t:"كلمات ناقصة ومهمة: "+missing.join("، ")});
  if(!toks.length)res.issues.push({cat:"Grammar",t:"لم تكتب شيئًا بعد."});
  if(toks.length>0&&toks.length<3)res.issues.push({cat:"Grammar",t:"الإجابة قصيرة جدًا — اكتب جملة كاملة."});
  let sc=Math.round(cov*70+(iss.length?Math.max(0,30-iss.length*10):30));
  if(toks.length>0&&toks.length<3)sc=Math.min(sc,40);
  if(!toks.length)sc=0;
  res.score=sc;res.ok=sc>=80;
  if(res.ok)res.why.push("✅ صياغة سليمة ومقبولة لغويًا.");
  else res.why.push("💡 قارن إجابتك بالصياغة الطبيعية بالأسفل.");
  return res;
}
function renderWrite(){
  ensureLabsx();
  const box=$("writeBox");if(!box)return;
  WR.idx=0;
  const st=S.labsx.write;
  box.innerHTML='<div class="panel glass"><h3>✍️ Writing Lab — مختبر الكتابة</h3>'
    +'<div class="muted">اكتب بالألمانية 📝 صحّح 🧠 حسّن — مكتمل '+st.done+' • أفضل '+st.best+'%</div>'
    +'<div class="row-flex">'
    +[["situation","📝 موقف"],["message","💌 رسالة"],["describe","🖼️ وصف"],["rebuild","🧩 بناء"]].map(x=>'<button class="btn btn-ghost sm" data-wt="'+x[0]+'">'+x[1]+'</button>').join("")
    +'</div><div id="wrBody"></div></div>';
  box.querySelectorAll("[data-wt]").forEach(b=>b.addEventListener("click",()=>{
    const pool=LX_WRITE.filter(t=>t.type===b.getAttribute("data-wt"));
    wrShow(pool.length?pool[0]:LX_WRITE[0]);
  }));
  wrShow(LX_WRITE[0]);
}
function wrShow(task){
  const host=$("wrBody");if(!host)return;
  ensureLabsx();
  const draft=(S.labsx.write.drafts||{})[task.id]||"";
  host.innerHTML='<div class="muted">'+escapeHtml(task.t)+'</div>'
    +'<h4 dir="ltr" style="text-align:left">'+escapeHtml(task.de)+'</h4>'
    +'<div class="muted">'+escapeHtml(task.ar)+'</div>'
    +'<div class="quiz-write" style="flex-direction:column;align-items:stretch"><textarea id="wrIn" rows="3" dir="ltr" style="text-align:left" placeholder="Schreib hier auf Deutsch...">'+escapeHtml(draft)+'</textarea>'
    +'<div class="row-flex"><button class="btn btn-gold sm" id="wrSave">💾 حفظ مسودة</button><button class="btn btn-primary sm" id="wrGo">تحقق ✅</button></div></div>'
    +'<div class="quiz-feedback hidden" id="wrFb"></div><div id="wrOut"></div>'
    +'<div class="row-flex"><button class="btn btn-ghost sm" id="wrRetry">🔁 حاول مجددًا</button><button class="btn btn-gold sm" id="wrNext">المهمة التالية ⏭</button></div>';
  $("wrIn").addEventListener("input",()=>{
    try{ensureLabsx();S.labsx.write.drafts[task.id]=$("wrIn").value;lxSave();}catch(e){}
  });
  $("wrSave").addEventListener("click",()=>{
    try{ensureLabsx();S.labsx.write.drafts[task.id]=$("wrIn").value;lxSave();toast("حُفظت المسودة 💾","ok");}catch(e){}
  });
  $("wrGo").addEventListener("click",()=>wrGrade(task));
  $("wrRetry").addEventListener("click",()=>wrShow(task));
  $("wrNext").addEventListener("click",()=>{
    const i=LX_WRITE.indexOf(task);
    wrShow(LX_WRITE[(i+1)%LX_WRITE.length]);
  });
}
function wrGrade(task){
  const v=$("wrIn").value;
  const r=wrAnalyze(task,v);
  ensureLabsx();const st=S.labsx.write;
  st.done++;if(r.score>st.best)st.best=r.score;
  try{if(r.score>=60)addXP(8,"lx-write");else addXP(2,"lx-write");}catch(e){}
  try{S.totalCorrect+=r.ok?1:0;S.totalAnswered++;}catch(e){}
  try{markStudyDay();}catch(e){}
  lxTouch("write",{});
  try{
    if(!r.ok){
      const w=allWords().find(x=>task.keywords.some(k=>x.de.toLowerCase()===k.toLowerCase()));
      if(w){recordMistake(w,v,"lx-write");lxSignal("write",1);}
    }
  }catch(e){}
  lxSave();try{if(typeof renderAll==="function")renderAll();}catch(e){}
  const fb=$("wrFb"),out=$("wrOut");if(!fb||!out)return;
  fb.classList.remove("hidden");fb.className="quiz-feedback "+(r.ok?"ok":"no");
  fb.textContent=(r.ok?"✅ أحسنت! ":"📝 تحتاج تحسين. ")+"النتيجة: "+r.score+"%";
  const catN={};
  r.issues.forEach(x=>{catN[x.cat]=(catN[x.cat]||0)+1;});
  out.innerHTML='<div class="ex-de"><div class="muted">📝 إجابتك:</div><div class="ex-de-l" dir="ltr" style="text-align:left">'+escapeHtml(v||"—")+'</div></div>'
    +'<div class="ex-de"><div class="muted">✅ التصحيح:</div><div class="ex-de-l" dir="ltr" style="text-align:left">'+escapeHtml(r.corrected||task.model)+'</div></div>'
    +'<div class="ex-de"><div class="muted">❌ الأخطاء ('+r.issues.length+")"
    +(Object.keys(catN).length?" — "+Object.keys(catN).map(c=>"⚠️ "+c+" ×"+catN[c]).join(" • "):" — لا أخطاء 🎉")+'</div>'
    +(r.issues.length?'<ul class="ex-ul">'+r.issues.map(x=>'<li><b>'+escapeHtml(x.cat)+":</b> "+escapeHtml(x.t)+"</li>").join("")+"</ul>":"")
    +'</div>'
    +'<div class="ex-de"><div class="muted">💡 لماذا؟</div><div>'+r.why.map(escapeHtml).join("<br>")+'</div></div>'
    +'<div class="ex-sum">🌿 صياغة طبيعية بديلة: <b dir="ltr">'+escapeHtml(task.model)+'</b></div>';
}

/* ================= 3. DICTATION BANK ================= */
const LX_DICT=[
{id:"dc01",lvl:"A1",de:"Ich wohne in Berlin.",ar:"أنا أسكن في برلين."},
{id:"dc02",lvl:"A1",de:"Das Haus ist groß.",ar:"البيت كبير."},
{id:"dc03",lvl:"A1",de:"Ich lerne Deutsch.",ar:"أنا أتعلم الألمانية."},
{id:"dc04",lvl:"A1",de:"Wo wohnst du?",ar:"أين تسكن؟"},
{id:"dc05",lvl:"A1",de:"Ich komme aus Ägypten.",ar:"أنا من مصر."},
{id:"dc06",lvl:"A1",de:"Der Kaffee ist heiß.",ar:"القهوة ساخنة."},
{id:"dc07",lvl:"A1",de:"Meine Mutter kocht gut.",ar:"أمي تطبخ جيدًا."},
{id:"dc08",lvl:"A1",de:"Wir trinken gern Tee.",ar:"نحب شرب الشاي."},
{id:"dc09",lvl:"A1",de:"Der Zug fährt um acht Uhr.",ar:"القطار يتحرك الثامنة."},
{id:"dc10",lvl:"A1",de:"Hast du Zeit?",ar:"هل لديك وقت؟"},
{id:"dc11",lvl:"A1",de:"Ich habe einen Bruder.",ar:"لدي أخ."},
{id:"dc12",lvl:"A1",de:"Die Schule beginnt um acht.",ar:"المدرسة تبدأ الثامنة."},
{id:"dc13",lvl:"A1",de:"Er spielt gern Fußball.",ar:"هو يحب لعب الكرة."},
{id:"dc14",lvl:"A1",de:"Was kostet das Brot?",ar:"كم سعر الخبز؟"},
{id:"dc15",lvl:"A1",de:"Ich bin zwanzig Jahre alt.",ar:"عمري عشرون سنة."},
{id:"dc16",lvl:"A1",de:"Danke für deine Hilfe.",ar:"شكرًا لمساعدتك."},
{id:"dc17",lvl:"A2",de:"Gestern habe ich lange gearbeitet.",ar:"أمس عملت طويلًا."},
{id:"dc18",lvl:"A2",de:"Weil ich krank bin, bleibe ich zu Hause.",ar:"لأنني مريض أبقى في البيت."},
{id:"dc19",lvl:"A2",de:"Kannst du mir bitte helfen?",ar:"هل يمكنك مساعدتي من فضلك؟"},
{id:"dc20",lvl:"A2",de:"Am Wochenende besuche ich meine Familie.",ar:"في العطلة أزور عائلتي."},
{id:"dc21",lvl:"A2",de:"Ich freue mich auf den Urlaub.",ar:"متحمس للعطلة."},
{id:"dc22",lvl:"A2",de:"Das Wetter ist heute sehr schön.",ar:"الطقس جميل اليوم."},
{id:"dc23",lvl:"B1",de:"Obwohl es regnet, gehen wir spazieren.",ar:"رغم المطر نتمشى."},
{id:"dc24",lvl:"B1",de:"Ich bin der Meinung, dass das wichtig ist.",ar:"أرى أن هذا مهم."},
{id:"dc25",lvl:"B1",de:"Je mehr du übst, desto besser sprichst du.",ar:"كلما تدربت أكثر تحدثت أفضل."},
{id:"dc26",lvl:"B1",de:"Könnten Sie mir das bitte erklären?",ar:"هل يمكنك شرح هذا من فضلك؟"}
];
var DC={lvl:"A1",idx:0,list:[],cur:null,plays:0};
function dcPool(){
  let p=LX_DICT.filter(x=>x.lvl===DC.lvl);
  if(!p.length)p=LX_DICT.slice();
  return p;
}
function renderDict(){
  ensureLabsx();
  const box=$("dictBox");if(!box)return;
  DC.list=dcPool();DC.idx=0;
  const st=S.labsx.dict;
  box.innerHTML='<div class="panel glass"><h3>👂 Dictation — الإملاء السمعي</h3>'
    +'<div class="muted">اسمع 🔊 اكتب ما سمعت ✍️ — '+st.att+' محاولة • أفضل '+st.best+'% • متقن '+st.mastered+'</div>'
    +'<div class="row-flex"><select id="dcLvl"><option value="A1">A1</option><option value="A2">A2</option><option value="B1">B1</option></select></div>'
    +'<div id="dcBody"></div></div>';
  $("dcLvl").value=DC.lvl;
  $("dcLvl").addEventListener("change",()=>{DC.lvl=$("dcLvl").value;DC.list=dcPool();DC.idx=0;dcShow();});
  dcShow();
}
function dcShow(){
  const host=$("dcBody");if(!host)return;
  if(!DC.list.length){host.innerHTML='<div class="muted">لا جمل هنا — غيّر المستوى 🔁</div>';return;}
  DC.cur=DC.list[DC.idx%DC.list.length];DC.plays=0;
  host.innerHTML='<div class="muted">جملة '+(DC.idx%DC.list.length+1)+' / '+DC.list.length+' • المستوى '+DC.cur.lvl+'</div>'
    +'<div class="muted">🔊 استمع جيدًا — الجملة مخفية حتى تجيب.</div>'
    +'<div class="row-flex" style="justify-content:center"><button class="btn btn-primary sm" id="dcPlay">🔊 تشغيل</button>'
    +'<button class="btn btn-ghost sm" id="dcSlow">🐢 أبطأ</button>'
    +'<button class="btn btn-ghost sm" id="dcAgain">🔁 إعادة التشغيل</button></div>'
    +'<div class="quiz-write"><input type="text" id="dcIn" dir="ltr" placeholder="اكتب ما سمعته..." autocomplete="off"><button class="btn btn-gold sm" id="dcGo">تحقق ✅</button></div>'
    +'<div class="row-flex"><button class="btn btn-ghost sm" id="dcHint">💡 تلميح: أول كلمة</button></div><div class="muted hidden" id="dcHintOut"></div>'
    +'<div class="quiz-feedback hidden" id="dcFb"></div><div id="dcDiff"></div>'
    +'<div class="row-flex"><button class="btn btn-ghost sm" id="dcRetry">🔁 محاولة جديدة</button><button class="btn btn-gold sm" id="dcNext">التالي ⏭</button></div>';
  const play=(slow)=>{DC.plays++;lxSay(DC.cur.de,slow);};
  $("dcPlay").addEventListener("click",()=>play(false));
  $("dcSlow").addEventListener("click",()=>play(true));
  $("dcAgain").addEventListener("click",()=>play(false));
  setTimeout(()=>play(false),350);
  $("dcHint").addEventListener("click",()=>{
    const o=$("dcHintOut");o.classList.remove("hidden");
    o.textContent="أول كلمة: "+DC.cur.de.split(" ")[0]+" ...";
  });
  $("dcGo").addEventListener("click",dcGrade);
  $("dcIn").addEventListener("keydown",e=>{if(e.key==="Enter")dcGrade();});
  $("dcRetry").addEventListener("click",dcShow);
  $("dcNext").addEventListener("click",()=>{DC.idx++;dcShow();});
}
function dcGrade(){
  const c=DC.cur;if(!c)return;
  const v=$("dcIn").value;
  if(!v.trim()){toast("اكتب ما سمعته أولًا ✍️","err");return;}
  const d=lxDiff(c.de,v);
  ensureLabsx();const st=S.labsx.dict;
  st.att++;if(d.score>st.best)st.best=d.score;
  if(d.score>=90){st.mastered++;try{addXP(10,"lx-dict");}catch(e){}}
  else if(d.score>=70){try{addXP(5,"lx-dict");}catch(e){}}
  try{S.totalCorrect+=d.score>=70?1:0;S.totalAnswered++;}catch(e){}
  try{markStudyDay();}catch(e){}
  lxTouch("dict",{});lxSave();
  try{if(typeof renderAll==="function")renderAll();}catch(e){}
  const fb=$("dcFb"),dw=$("dcDiff");if(!fb||!dw)return;
  fb.classList.remove("hidden");fb.className="quiz-feedback "+(d.score>=70?"ok":"no");
  fb.textContent=(d.score>=90?"🌟 إملاء متقن!":d.score>=70?"✅ جيد جدًا!":"🔁 استمع مجددًا وحاول.")+" النتيجة: "+d.score+"%";
  dw.innerHTML='<div class="ex-de"><div class="muted">✅ الجملة الصحيحة:</div><div class="ex-de-l" dir="ltr" style="text-align:left">'+escapeHtml(c.de)+'</div><div class="ex-ar">'+escapeHtml(c.ar)+'</div></div>'
    +'<div class="ex-de"><div class="muted">📝 إجابتك:</div><div class="ex-de-l" dir="ltr" style="text-align:left">'+escapeHtml(v)+'</div></div>'
    +'<div class="muted">✅ كلمات صحيحة: '+(d.correct.join(", ")||"—")+'</div>'
    +'<div class="muted">⚠️ ناقصة: '+(d.missing.join(", ")||"لا يوجد")+'</div>'
    +(d.extra.length?'<div class="muted">❌ خاطئة/زائدة: '+escapeHtml(d.extra.join(", "))+'</div>':"");
}

/* ================= 4. SITUATIONS (branching, real A1 scenarios) ================= */
const LX_SIT=[
{id:"rest",icon:"🍽️",t:"Im Restaurant",ar:"في المطعم",lvl:"A1",start:"s",
 nodes:{
  s:{say:"Guten Tag! Haben Sie reserviert?",ar:"نهارك سعيد! هل حجزت؟",choices:[
    {t:"Ja, einen Tisch für zwei.",ar:"نعم، طاولة لشخصين.",next:"m"},
    {t:"Nein. Ich bin Ali.",ar:"لا. أنا علي.",next:"r1",bad:"الإجابة لا تناسب السؤال — الأفضل طلب طاولة.",vocab:[["der Tisch","الطاولة"]]}]},
  r1:{say:"Wie bitte? Möchten Sie einen Tisch?",ar:"عفوًا؟ هل تريد طاولة؟",choices:[
    {t:"Ja, einen Tisch für zwei, bitte.",ar:"نعم، طاولة لشخصين من فضلك.",next:"m"},
    {t:"Tschüs!",ar:"سلام!",next:"e-bad",bad:"أنهيت الموقف مبكرًا.",vocab:[]}]},
  m:{say:"Sehr gern! Was möchten Sie essen?",ar:"بكل سرور! ماذا تريد أن تأكل؟",choices:[
    {t:"Ich möchte eine Pizza.",ar:"أريد بيتزا.",next:"e-good"},
    {t:"Ich wohne in Berlin.",ar:"أسكن في برلين.",next:"r2",bad:"إجابة خارج السياق.",vocab:[["bestellen","يطلب"]]}]},
  r2:{say:"Wie bitte? Pizza oder Pasta?",ar:"عفوًا؟ بيتزا أم مكرونة؟",choices:[
    {t:"Eine Pizza, bitte.",ar:"بيتزا من فضلك.",next:"e-good"},
    {t:"Nein, danke.",ar:"لا شكرًا.",next:"e-bad",bad:"رفضت دون طلب.",vocab:[]}]},
  "e-good":{end:true,score:100,text:"🎉 رائع! طلبت بنجاح. الحساب: 12 Euro.",vocab:[["die Pizza","البيتزا"],["zahlen","يدفع"]],phrases:["Einen Tisch für zwei, bitte.","Ich möchte eine Pizza.","Zahlen, bitte."]},
  "e-bad":{end:true,score:30,text:"انتهى الموقف. حاول أن تطلب بوضوح المرة القادمة 💪",vocab:[["bitte","من فضلك"]],phrases:["Einen Tisch für zwei, bitte."]}}},
{id:"train",icon:"🚆",t:"Am Bahnhof",ar:"في محطة القطار",lvl:"A1",start:"s",
 nodes:{
  s:{say:"Guten Tag! Wohin möchten Sie fahren?",ar:"نهارك سعيد! إلى أين تريد السفر؟",choices:[
    {t:"Ich möchte nach Berlin.",ar:"أريد إلى برلين.",next:"m"},
    {t:"Ich bin zwanzig.",ar:"عمري عشرون.",next:"r1",bad:"العمر لا يجيب عن الوجهة.",vocab:[["fahren","يسافر"]]}]},
  r1:{say:"Wie bitte? Nach Berlin oder Hamburg?",ar:"عفوًا؟ إلى برلين أم هامبورج؟",choices:[
    {t:"Nach Berlin, bitte.",ar:"إلى برلين من فضلك.",next:"m"},
    {t:"Keine Ahnung.",ar:"لا أعرف.",next:"e-bad",bad:"تجنبت الإجابة.",vocab:[]}]},
  m:{say:"Eine Fahrkarte kostet 40 Euro. Möchten Sie sie?",ar:"التذكرة 40 يورو. هل تريدها؟",choices:[
    {t:"Ja, gern.",ar:"نعم بكل سرور.",next:"e-good"},
    {t:"Zu teuer!",ar:"غالية جدًا!",next:"r2",bad:"رد غير مهذب قليلًا.",vocab:[["die Fahrkarte","التذكرة"]]}]},
  r2:{say:"Es gibt auch eine Tageskarte für 25 Euro.",ar:"توجد تذكرة يومية بـ 25 يورو.",choices:[
    {t:"Gut, ich nehme sie.",ar:"حسنًا، آخذها.",next:"e-good"},
    {t:"Nein.",ar:"لا.",next:"e-bad",bad:"رفضت البديل أيضًا.",vocab:[]}]},
  "e-good":{end:true,score:100,text:"🎉 ممتاز! معك تذكرة إلى برلين. Gute Reise!",vocab:[["die Fahrkarte","التذكرة"],["der Bahnsteig","الرصيف"]],phrases:["Ich möchte nach Berlin.","Eine Fahrkarte, bitte."]},
  "e-bad":{end:true,score:30,text:"انتهى الموقف بدون تذكرة. جرّب الرد المباشر المرة القادمة 💪",vocab:[["bitte","من فضلك"]],phrases:["Nach Berlin, bitte."]}}},
{id:"doc",icon:"🏥",t:"Beim Arzt",ar:"عند الطبيب",lvl:"A1",start:"s",
 nodes:{
  s:{say:"Guten Tag! Was fehlt Ihnen?",ar:"نهارك سعيد! ما مشكلتك؟",choices:[
    {t:"Ich habe Kopfschmerzen.",ar:"لدي صداع.",next:"m"},
    {t:"Mir geht es gut.",ar:"أنا بخير.",next:"r1",bad:"إن كنت بخير فلماذا أتيت؟ 😄",vocab:[["der Schmerz","الألم"]]}]},
  r1:{say:"Schön! Aber warum sind Sie hier?",ar:"جميل! لكن لماذا أنت هنا؟",choices:[
    {t:"Ich habe Fieber.",ar:"لدي حرارة.",next:"m"},
    {t:"Tschüs!",ar:"سلام!",next:"e-bad",bad:"غادرت دون علاج.",vocab:[]}]},
  m:{say:"Seit wann?",ar:"منذ متى؟",choices:[
    {t:"Seit gestern.",ar:"منذ أمس.",next:"e-good"},
    {t:"Ich bin Lehrer.",ar:"أنا مدرس.",next:"r2",bad:"المهنة ليست إجابة.",vocab:[["seit","منذ"]]}]},
  r2:{say:"Verstehe. Und seit wann sind Sie krank?",ar:"فهمت. ومنذ متى وأنت مريض؟",choices:[
    {t:"Seit zwei Tagen.",ar:"منذ يومين.",next:"e-good"},
    {t:"Weiß nicht.",ar:"لا أعرف.",next:"e-bad",bad:"إجابة غامضة.",vocab:[]}]},
  "e-good":{end:true,score:100,text:"🎉 شُخّصت بنجاح! Gute Besserung! (بالشفاء)",vocab:[["die Kopfschmerzen","الصداع"],["das Fieber","الحرارة"]],phrases:["Ich habe Kopfschmerzen.","Seit gestern."]},
  "e-bad":{end:true,score:30,text:"انتهى الموقف. صف أعراضك بوضوح المرة القادمة 💪",vocab:[["krank","مريض"]],phrases:["Was fehlt Ihnen? — Ich habe ..."]}}},
{id:"shop",icon:"🛒",t:"Im Supermarkt",ar:"في السوبرماركت",lvl:"A1",start:"s",
 nodes:{
  s:{say:"Guten Tag! Kann ich helfen?",ar:"نهارك سعيد! هل أساعدك؟",choices:[
    {t:"Ja. Wo ist die Milch?",ar:"نعم. أين اللبن؟",next:"m"},
    {t:"Ich bin müde.",ar:"أنا متعب.",next:"r1",bad:"التعب ليس سؤالًا.",vocab:[["die Milch","اللبن"]]}]},
  r1:{say:"Oh! Suchen Sie etwas Bestimmtes?",ar:"أوه! هل تبحث عن شيء معين؟",choices:[
    {t:"Ja, das Brot.",ar:"نعم، الخبز.",next:"m"},
    {t:"Nein.",ar:"لا.",next:"e-bad",bad:"رفضت المساعدة.",vocab:[]}]},
  m:{say:"Die Milch ist dort hinten. Sonst noch etwas?",ar:"اللبن هناك في الخلف. شيء آخر؟",choices:[
    {t:"Nein, danke. Das ist alles.",ar:"لا شكرًا. هذا كل شيء.",next:"e-good"},
    {t:"Wo ist Berlin?",ar:"أين برلين؟",next:"r2",bad:"سؤال خارج المتجر 😄",vocab:[["das Brot","الخبز"]]}]},
  r2:{say:"Berlin ist weit! Hier nur Lebensmittel 😄 Noch etwas?",ar:"برلين بعيدة! هنا فقط أطعمة. شيء آخر؟",choices:[
    {t:"Nein, danke.",ar:"لا شكرًا.",next:"e-good"},
    {t:"Tschüs!",ar:"سلام!",next:"e-bad",bad:"غادرت فجأة.",vocab:[]}]},
  "e-good":{end:true,score:100,text:"🎉 تسوّقت بنجاح! Viel Spaß!",vocab:[["die Milch","اللبن"],["das Brot","الخبز"]],phrases:["Wo ist die Milch?","Das ist alles."]},
  "e-bad":{end:true,score:30,text:"انتهى الموقف. اسأل عن المنتجات بوضوح 💪",vocab:[["suchen","يبحث"]],phrases:["Wo ist ...?"]}}},
{id:"bank",icon:"🏦",t:"In der Bank",ar:"في البنك",lvl:"A1",start:"s",
 nodes:{
  s:{say:"Guten Tag! Was kann ich für Sie tun?",ar:"نهارك سعيد! كيف أساعدك؟",choices:[
    {t:"Ich möchte ein Konto eröffnen.",ar:"أريد فتح حساب.",next:"m"},
    {t:"Ich habe Hunger.",ar:"أنا جائع.",next:"r1",bad:"الجوع مكانه المطعم 😄",vocab:[["das Konto","الحساب"]]}]},
  r1:{say:"Hier gibt es leider kein Essen. Worum geht es?",ar:"للأسف لا طعام هنا. ما الموضوع؟",choices:[
    {t:"Ein Konto, bitte.",ar:"حساب من فضلك.",next:"m"},
    {t:"Tschüs!",ar:"سلام!",next:"e-bad",bad:"غادرت دون إنجاز.",vocab:[]}]},
  m:{say:"Gern! Haben Sie einen Pass?",ar:"بكل سرور! هل لديك جواز؟",choices:[
    {t:"Ja, hier ist mein Pass.",ar:"نعم، هذا جوازي.",next:"e-good"},
    {t:"Nein, zu Hause.",ar:"لا، في البيت.",next:"r2",bad:"بدون هوية لا حساب.",vocab:[["der Pass","الجواز"]]}]},
  r2:{say:"Dann kommen Sie bitte morgen mit Pass.",ar:"إذن تعال غدًا بالجواز.",choices:[
    {t:"Gut, bis morgen!",ar:"حسنًا، إلى الغد!",next:"e-good"},
    {t:"Schade!",ar:"للأسف!",next:"e-bad",bad:"استسلمت بسرعة.",vocab:[]}]},
  "e-good":{end:true,score:100,text:"🎉 تم! حسابك جاهز. Herzlichen Glückwunsch!",vocab:[["das Konto","الحساب"],["der Pass","الجواز"]],phrases:["Ich möchte ein Konto eröffnen.","Hier ist mein Pass."]},
  "e-bad":{end:true,score:30,text:"انتهى الموقف. جهّز أوراقك وحاول مجددًا 💪",vocab:[["morgen","غدًا"]],phrases:["Ich möchte ..."]}}},
{id:"job",icon:"👔",t:"Bewerbungsgespräch",ar:"مقابلة عمل",lvl:"A1",start:"s",
 nodes:{
  s:{say:"Guten Tag! Erzählen Sie etwas über sich.",ar:"نهارك سعيد! حدثنا عن نفسك.",choices:[
    {t:"Ich heiße Omar. Ich bin zwanzig.",ar:"اسمي عمر. عمري عشرون.",next:"m"},
    {t:"Keine Ahnung.",ar:"لا أعرف.",next:"r1",bad:"إجابة تضعف موقفك.",vocab:[["sich vorstellen","يعرّف بنفسه"]]}]},
  r1:{say:"Zum Beispiel: Name und Alter?",ar:"مثلًا: الاسم والعمر؟",choices:[
    {t:"Ich heiße Omar.",ar:"اسمي عمر.",next:"m"},
    {t:"Tschüs!",ar:"سلام!",next:"e-bad",bad:"انسحبت فورًا.",vocab:[]}]},
  m:{say:"Was sind Ihre Stärken?",ar:"ما نقاط قوتك؟",choices:[
    {t:"Ich bin pünktlich und fleißig.",ar:"دقيق ومجتهد.",next:"e-good"},
    {t:"Ich schlafe gern.",ar:"أحب النوم.",next:"r2",bad:"ليست نقطة قوة 😄",vocab:[["pünktlich","دقيق"]]}]},
  r2:{say:"Hmm. Etwas Positives für die Arbeit?",ar:"همم. شيء إيجابي للعمل؟",choices:[
    {t:"Ich lerne schnell.",ar:"أتعلم بسرعة.",next:"e-good"},
    {t:"Nichts.",ar:"لا شيء.",next:"e-bad",bad:"إجابة سلبية.",vocab:[]}]},
  "e-good":{end:true,score:100,text:"🎉 مقابلة ناجحة! Wir melden uns. (سنتصل بك)",vocab:[["die Stärke","نقطة القوة"],["pünktlich","دقيق"]],phrases:["Ich heiße ...","Ich bin pünktlich."]},
  "e-bad":{end:true,score:30,text:"انتهى الموقف. حضّر تعريفك ونقاط قوتك 💪",vocab:[["die Arbeit","العمل"]],phrases:["Ich heiße ..."]}}},
{id:"apart",icon:"🏠",t:"Wohnung suchen",ar:"البحث عن شقة",lvl:"A1",start:"s",
 nodes:{
  s:{say:"Guten Tag! Suchen Sie eine Wohnung?",ar:"نهارك سعيد! هل تبحث عن شقة؟",choices:[
    {t:"Ja. Zwei Zimmer, bitte.",ar:"نعم. غرفتين من فضلك.",next:"m"},
    {t:"Ich suche Arbeit.",ar:"أبحث عن عمل.",next:"r1",bad:"العمل ليس هنا.",vocab:[["die Wohnung","الشقة"]]}]},
  r1:{say:"Arbeit? Hier gibt es Wohnungen 😄 Wie viele Zimmer?",ar:"عمل؟ هنا شقق. كم غرفة؟",choices:[
    {t:"Zwei Zimmer.",ar:"غرفتان.",next:"m"},
    {t:"Egal.",ar:"لا يهم.",next:"e-bad",bad:"إجابة غامضة.",vocab:[]}]},
  m:{say:"Es gibt eine schöne Wohnung. Wann möchten Sie sie sehen?",ar:"توجد شقة جميلة. متى تريد رؤيتها؟",choices:[
    {t:"Am Montag um zehn.",ar:"الاثنين العاشرة.",next:"e-good"},
    {t:"Nie.",ar:"أبدًا.",next:"e-bad",bad:"رفضت المعاينة.",vocab:[["das Zimmer","الغرفة"]]}]},
  "e-good":{end:true,score:100,text:"🎉 موعد المعاينة تم! Bis Montag!",vocab:[["die Wohnung","الشقة"],["der Termin","الموعد"]],phrases:["Zwei Zimmer, bitte.","Am Montag um zehn."]},
  "e-bad":{end:true,score:30,text:"انتهى الموقف. حدّد طلبك بوضوح 💪",vocab:[["suchen","يبحث"]],phrases:["Ich suche ..."]}}},
{id:"phone",icon:"📞",t:"Telefonat",ar:"مكالمة هاتفية",lvl:"A1",start:"s",
 nodes:{
  s:{say:"Hallo! Hier ist Sara. Ist Ali da?",ar:"ألو! معك سارة. هل علي موجود؟",choices:[
    {t:"Ja, einen Moment, bitte.",ar:"نعم، لحظة من فضلك.",next:"m"},
    {t:"Wer bist du?",ar:"من أنتِ؟",next:"r1",bad:"رد غير مهذب.",vocab:[["der Moment","لحظة"]]}]},
  r1:{say:"Ich bin Sara, seine Freundin.",ar:"أنا سارة، صديقته.",choices:[
    {t:"Ah! Einen Moment, bitte.",ar:"آه! لحظة من فضلك.",next:"m"},
    {t:"Falsch verbunden.",ar:"رقم خاطئ.",next:"e-bad",bad:"أغلقت دون تأكد.",vocab:[]}]},
  m:{say:"Danke! Kann er mich zurückrufen?",ar:"شكرًا! هل يمكنه معاودة الاتصال؟",choices:[
    {t:"Ja, gern. Wie ist deine Nummer?",ar:"نعم. ما رقمك؟",next:"e-good"},
    {t:"Nein.",ar:"لا.",next:"e-bad",bad:"رفضت المساعدة.",vocab:[]}]},
  "e-good":{end:true,score:100,text:"🎉 مكالمة ناجحة! Tschüs!",vocab:[["anrufen","يتصل"],["die Nummer","الرقم"]],phrases:["Einen Moment, bitte.","Wie ist deine Nummer?"]},
  "e-bad":{end:true,score:30,text:"انتهى الموقف. كن مهذبًا في المكالمات 💪",vocab:[["bitte","من فضلك"]],phrases:["Einen Moment, bitte."]}}}
];
var GS={sid:null,node:null,score:0,steps:0,words:[],errs:[],seen:[]};
function renderSit(){
  ensureLabsx();
  const box=$("gsitBox");if(!box)return;
  const done=S.labsx.sit.done;
  let h='<div class="panel glass"><h3>🎬 German Situations — مواقف ألمانية</h3>'
    +'<div class="muted">ادخل موقفًا حقيقيًا 🗣️ اختياراتك تغيّر الأحداث — مكتمل '+Object.keys(done).length+'/'+LX_SIT.length+'</div></div>'
    +'<div class="grid-2">'+LX_SIT.map(s=>{
      const d=done[s.id];
      return '<div class="panel glass"><h4>'+s.icon+" "+escapeHtml(s.t)+'</h4><div class="muted">'+escapeHtml(s.ar)+' • '+s.lvl+(d?" • ✅ "+d.score+"%":"")+'</div>'
        +'<div class="row-flex"><button class="btn btn-primary sm" data-gsit="'+s.id+'">'+(d?"إعادة 🔁":"ابدأ ▶️")+'</button></div></div>';
    }).join("")+'</div><div id="gsitPlay"></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-gsit]").forEach(b=>b.addEventListener("click",()=>gsitPlay(b.getAttribute("data-gsit"))));
}
function gsitPlay(sid){
  const s=LX_SIT.find(x=>x.id===sid);if(!s)return;
  GS={sid:sid,node:s.start,score:0,steps:0,words:[],errs:[],seen:[]};
  gsitNode(s);
  const p=$("gsitPlay");if(p)p.scrollIntoView({behavior:"smooth"});
}
function gsitNode(s){
  const host=$("gsitPlay");if(!host)return;
  const n=s.nodes[GS.node];
  if(!n){gsitEnd(s,{end:true,score:50,text:"انتهى الموقف.",vocab:[],phrases:[]});return;}
  if(n.end){gsitEnd(s,n);return;}
  GS.seen.push(GS.node);
  host.innerHTML='<div class="panel glass"><div class="muted">🎬 '+escapeHtml(s.t)+' • خطوة '+(GS.steps+1)+'</div>'
    +'<div class="talk-bot">🧑‍✈️ '+escapeHtml(n.say)+' <button class="mini-btn" id="gsitHear">🔊</button><div class="ex-ar">'+escapeHtml(n.ar)+'</div></div>'
    +'<div class="muted">اختر ردك:</div><div class="quiz-opts">'
    +n.choices.map((c,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(c.t)+'<br><span class="muted">'+escapeHtml(c.ar)+'</span></button>').join("")
    +'</div></div>';
  $("gsitHear").addEventListener("click",e=>{try{e.stopPropagation();}catch(_){}lxSay(n.say);});
  setTimeout(()=>lxSay(n.say),350);
  host.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
    const c=n.choices[parseInt(b.getAttribute("data-j"),10)];
    GS.steps++;
    if(c.bad){GS.errs.push({t:c.t,why:c.bad});try{lxSignal("sit",1);}catch(e){}}
    else{GS.score+=10;try{S.totalCorrect++;}catch(e){}}
    try{S.totalAnswered++;}catch(e){}
    (c.vocab||[]).forEach(v=>{if(!GS.words.some(x=>x[0]===v[0]))GS.words.push(v);});
    GS.node=c.next;
    gsitNode(s);
  }));
}
function gsitEnd(s,n){
  ensureLabsx();
  const pct=n.score;
  const prev=S.labsx.sit.done[s.id];
  S.labsx.sit.done[s.id]={score:pct,date:todayStr()};
  lxTouch("sit",{});
  try{if(pct>=70)addXP(20,"lx-sit");else addXP(5,"lx-sit");}catch(e){}
  try{markStudyDay();}catch(e){}
  lxSave();
  try{if(typeof renderAll==="function")renderAll();}catch(e){}
  const host=$("gsitPlay");if(!host)return;
  host.innerHTML='<div class="panel glass" style="text-align:center"><div class="stamp-pop">🎉</div><h3>'+escapeHtml(s.icon+" "+s.t)+'</h3>'
    +'<div class="stat-num">'+pct+'%</div><div class="muted">'+escapeHtml(n.text)+'</div>'
    +(GS.words.length?'<h4>📚 كلمات جديدة</h4>'+GS.words.map(v=>'<div class="muted"><b dir="ltr">'+escapeHtml(v[0])+'</b> = '+escapeHtml(v[1])+'</div>').join(""):'<div class="muted">لا كلمات جديدة هذه المرة.</div>')
    +(GS.errs.length?'<h4>⚠️ أخطاؤك ('+GS.errs.length+')</h4>'+GS.errs.map(e=>'<div class="mist-err">❌ '+escapeHtml(e.t)+'<br><span class="muted">'+escapeHtml(e.why)+'</span></div>').join(""):'<div class="muted">✅ بلا أخطاء — ممتاز!</div>')
    +'<h4>💬 جمل مفيدة من الموقف</h4>'+((n.phrases||[]).map(p=>'<div class="muted">• <b dir="ltr">'+escapeHtml(p)+'</b></div>').join("")||'<div class="muted">—</div>')
    +'<div class="row-flex" style="justify-content:center"><button class="btn btn-primary sm" id="gsitAgain">🔁 إعادة الموقف</button><button class="btn btn-ghost sm" id="gsitBack">المواقف ←</button></div></div>';
  $("gsitAgain").addEventListener("click",()=>gsitPlay(s.id));
  $("gsitBack").addEventListener("click",()=>{renderSit();});
  host.scrollIntoView({behavior:"smooth"});
}

/* ================= 5. ERROR REPLAY ================= */
const LX_ER_SKILLS={
article:{t:"der / die / das",ar:"الأدوات"},
ein:{t:"ein / eine / einen",ar:"النكرة في المفعول"},
plural:{t:"Plural",ar:"الجمع"},
verb:{t:"Verb konjugieren",ar:"تصريف الفعل"},
nichtkein:{t:"nicht / kein",ar:"النفي"},
prep:{t:"Präpositionen",ar:"حروف الجر"},
wordorder:{t:"Word Order",ar:"ترتيب الجملة"}
};
/* deterministic-ish pick avoiding recent repeats */
function erPick(arr,n,recent){
  const pool=arr.filter((_,i)=>recent.indexOf("g"+i)<0);
  const src=pool.length>=n?pool:arr.slice();
  const sh=src.slice();
  for(let i=sh.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=sh[i];sh[i]=sh[j];sh[j]=t;}
  return sh.slice(0,Math.max(1,Math.min(n,sh.length)));
}
function erNouns(n,recent){
  try{
    const pool=allWords().filter(w=>w.type==="اسم"&&w.art&&w.art!=="-");
    return erPick(pool,n,recent||[]);
  }catch(e){return [];}
}
/* Generate a FRESH question for a skill (never verbatim repeats). */
function erGen(skill,recent){
  recent=recent||[];
  const R=(arr)=>arr[Math.floor(Math.random()*arr.length)];
  if(skill==="article"){
    const list=erNouns(4,recent);
    if(list.length<2)return null;
    const w=list[0];
    const opts=["der","die","das"].sort(()=>Math.random()-0.5);
    return {skill:skill,q:"ما أداة «"+w.de+"»؟ ("+w.ar+")",opts:opts,correct:opts.indexOf(w.art),
      explain:w.art+" "+w.de+" = "+w.ar,word:w,rid:w.id};
  }
  if(skill==="ein"){
    const list=erNouns(4,recent).filter(w=>/^[A-ZÄÖÜ]/.test(w.de));
    if(!list.length)return null;
    const w=list[0];
    const need=w.art==="der"?"einen":(w.art==="die"?"eine":"ein");
    const opts=["ein","eine","einen"].sort(()=>Math.random()-0.5);
    return {skill:skill,q:"Ich habe ___ "+w.de+". ("+w.ar+")",opts:opts,correct:opts.indexOf(need),
      explain:"مفعول: der→einen / die→eine / das→ein. الصحيح: "+need+" "+w.de,word:w,rid:w.id};
  }
  if(skill==="plural"){
    let pool=[];
    try{pool=allWords().filter(w=>w.type==="اسم"&&w.plural&&w.de&&/^[A-ZÄÖÜ]/.test(w.de));}catch(e){}
    const list=erPick(pool,4,recent);
    if(list.length<2)return null;
    const w=list[0];
    const others=erPick(pool.filter(x=>x.id!==w.id&&x.plural!==w.plural),2,[]).map(x=>x.plural);
    const opts=[w.plural].concat(others).sort(()=>Math.random()-0.5);
    return {skill:skill,q:"ما جمع «"+w.de+"»؟",opts:opts,correct:opts.indexOf(w.plural),
      explain:"الجمع: "+w.plural+" ("+w.ar+")",word:w,rid:w.id};
  }
  if(skill==="verb"){
    let pool=[];
    try{pool=allWords().filter(w=>w.type==="فعل"&&/en$/.test(w.de)&&typeof conjugateVerb==="function"&&conjugateVerb(w.de));}catch(e){}
    const list=erPick(pool,3,recent);
    if(!list.length)return null;
    const w=list[0];
    const c=conjugateVerb(w.de);
    const forms=[["ich",c.ich],["du",c.du],["er",c.er]];
    const f=forms[Math.floor(Math.random()*forms.length)];
    const opts=[c.ich,c.du,c.er].filter((v,i,a)=>a.indexOf(v)===i).sort(()=>Math.random()-0.5);
    return {skill:skill,q:f[0]+" ___ ("+w.de+" = "+w.ar+")",opts:opts,correct:opts.indexOf(f[1]),
      explain:f[0]+" "+f[1]+" — "+w.ar,word:w,rid:w.id};
  }
  if(skill==="nichtkein"){
    const bank=[
      {s:"Ich habe ___ Auto.",o:["nicht","kein","keine"],c:1,why:"Auto محايد مفعول → kein.",de:"Auto"},
      {s:"Sie hat ___ Tasche.",o:["nicht","kein","keine"],c:2,why:"Tasche مؤنثة → keine.",de:"Tasche"},
      {s:"Ich bin ___ müde.",o:["nicht","kein","keine"],c:0,why:"صفة (müde) تُنفى بـ nicht.",de:"müde"},
      {s:"Er hat ___ Zeit.",o:["nicht","kein","keine"],c:1,why:"Zeit مؤنثة → keine.",de:"Zeit",fix:2},
      {s:"Wir haben ___ Hunger.",o:["nicht","kein","keine"],c:1,why:"Hunger مذكر مفعول → keinen/kein.",de:"Hunger"}
    ];
    const it=R(bank);
    const c=(it.fix!==undefined)?it.fix:it.c;
    return {skill:skill,q:it.s+" (اختر النفي)",opts:it.o.slice(),correct:c,explain:it.why,word:null,rid:it.de};
  }
  if(skill==="prep"){
    const bank=[
      {s:"Ich komme ___ Ägypten.",o:["aus","nach","in"],c:0,why:"الموطن والأصل مع aus."},
      {s:"Ich fahre ___ Berlin.",o:["aus","nach","in"],c:1,why:"الاتجاه لمدينة مع nach."},
      {s:"Ich wohne ___ Kairo.",o:["aus","in","nach"],c:1,why:"السكن في مدينة مع in."},
      {s:"Ich komme ___ dir.",o:["mit","für","bei"],c:0,why:"الصحبة مع mit."},
      {s:"Das Buch liegt ___ dem Tisch.",o:["auf","an","in"],c:0,why:"على سطح مع auf."}
    ];
    const it=R(bank);
    return {skill:skill,q:it.s,opts:it.o.slice(),correct:it.c,explain:it.why,word:null,rid:it.s};
  }
  if(skill==="wordorder"){
    let pool=[];
    try{pool=SENTENCES.filter(s=>s.de.replace(/[.?!,]/g,"").split(" ").filter(Boolean).length>=4).slice(0,60);}catch(e){}
    if(!pool.length){
      const words=["Ich","lerne","heute","Deutsch"];
      return {skill:skill,q:"رتّب الجملة:",words:words,correct:words.join(" "),explain:"Ich lerne heute Deutsch.",word:null,rid:"fb"};
    }
    const s=R(pool);
    const words=s.de.replace(/[.?!,]/g,"").split(" ").filter(Boolean);
    return {skill:skill,q:"رتّب: ("+s.ar+")",words:words,correct:words.join(" "),explain:s.de+" — "+s.ar,word:null,rid:s.id||s.de};
  }
  return null;
}
var ER={skill:null,cur:null,score:0,total:0};
/* Detect weak skills from mistake store + local signals + grammar weak map. */
function erDetect(){
  const agg={};
  try{
    Object.keys(S.mistakes||{}).forEach(id=>{
      const m=S.mistakes[id];if(!m||!m.n)return;
      const k=String(m.kind||"");
      let sk=null;
      if(k.indexOf("lx-")===0){
        if(k==="lx-art")sk="article";else if(k==="lx-write")sk="wordorder";
        else if(k==="lx-shadow")sk="verb";
      }
      if(!sk){
        const pk=String(m.last||"");
        if(/^(der|die|das)$/.test(pk))sk="article";
        else if(/^(ein|eine|einen)$/.test(pk))sk="ein";
        else if(/^(nicht|kein|keine)$/.test(pk))sk="nichtkein";
      }
      if(sk)agg[sk]=(agg[sk]||0)+m.n;
    });
  }catch(e){}
  try{
    const sig=(ensureLabsx(),S.labsx.er.signals)||{};
    Object.keys(sig).forEach(k=>{if(LX_ER_SKILLS[k])agg[k]=(agg[k]||0)+sig[k];});
  }catch(e){}
  try{
    Object.keys(S.gweak||{}).forEach(g=>{agg.wordorder=(agg.wordorder||0)+(S.gweak[g]||0);});
  }catch(e){}
  return Object.keys(agg).filter(k=>LX_ER_SKILLS[k]).map(k=>({skill:k,n:agg[k]}))
    .sort((a,b)=>b.n-a.n).slice(0,3);
}
function renderEr(){
  ensureLabsx();
  const box=$("erBox");if(!box)return;
  const st=S.labsx.er;
  const weak=erDetect();
  let h='<div class="panel glass"><h3>🧠 Error Replay — أخطائي</h3>'
    +'<div class="muted">نحوّل أخطاءك لتدريب جديد (سؤال مختلف بنفس المهارة) — مكتمل '+st.done+' • أفضل '+st.best+'%</div>'
    +(weak.length?'<div class="muted">⚠️ يحتاج مراجعة: '+weak.map(w=>"«"+LX_ER_SKILLS[w.skill].ar+"» ("+w.n+")").join(" • ")+'</div>'
      :'<div class="muted">🟢 لا نقاط ضعف مسجلة — واصل التدريب!</div>')
    +'<div class="row-flex"><button class="btn btn-primary sm" id="erAuto">🎯 درّبني على أضعف نقطة</button></div>'
    +'<h4>اختر مهارة:</h4><div class="row-flex">'
    +Object.keys(LX_ER_SKILLS).map(k=>'<button class="btn btn-ghost sm" data-ersk="'+k+'">'+LX_ER_SKILLS[k].t+'</button>').join("")
    +'</div><div id="erBody"></div></div>'
    +'<div class="panel glass"><h3>⚠️ Confusion Trainer — التباسات شائعة</h3>'
    +'<div class="muted">تدريب مركّز على زوج واحد فقط — بدون أسئلة دخيلة.</div>'
    +'<div class="row-flex">'+LX_CONF.map(p=>'<button class="btn btn-gold sm" data-cfp="'+p.id+'">'+p.t+'</button>').join("")+'</div>'
    +'<div id="cfBody"></div></div>';
  box.innerHTML=h;
  $("erAuto").addEventListener("click",()=>{
    const w=erDetect()[0];
    erDrill(w?w.skill:"article");
  });
  box.querySelectorAll("[data-ersk]").forEach(b=>b.addEventListener("click",()=>erDrill(b.getAttribute("data-ersk"))));
  box.querySelectorAll("[data-cfp]").forEach(b=>b.addEventListener("click",()=>cfTrain(b.getAttribute("data-cfp"))));
}
function erDrill(skill){
  ER={skill:skill,cur:null,score:0,total:0};
  erNext();
}
function erNext(){
  const host=$("erBody");if(!host)return;
  ensureLabsx();
  const recent=S.labsx.er.recent||[];
  const q=erGen(ER.skill,recent);
  if(!q){host.innerHTML='<div class="muted">تعذّر إنشاء سؤال — حاول مهارة أخرى 🔁</div>';return;}
  ER.cur=q;
  S.labsx.er.recent=(recent.concat([q.rid])).slice(-12);
  lxSave();
  if(q.words){erShowOrder(host,q);return;}
  host.innerHTML='<div class="muted">تدريب: <b>'+escapeHtml(LX_ER_SKILLS[ER.skill].ar)+'</b> • '+ER.score+'/'+ER.total+'</div>'
    +'<h4 dir="ltr" style="text-align:left">'+escapeHtml(q.q)+'</h4>'
    +'<div class="quiz-opts" dir="ltr">'+q.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>'
    +'<div class="quiz-feedback hidden" id="erFb"></div>';
  host.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
    const j=parseInt(b.getAttribute("data-j"),10);
    host.querySelectorAll(".quiz-opt").forEach(x=>{x.disabled=true;});
    const ok=j===q.correct;
    if(ok)b.classList.add("correct");
    else{b.classList.add("wrong");host.querySelectorAll(".quiz-opt")[q.correct].classList.add("correct");}
    erGrade(ok,q.opts[j],q.opts[q.correct],q);
  }));
}
function erShowOrder(host,q){
  const sh=q.words.map((_,k)=>k);
  for(let i=sh.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=sh[i];sh[i]=sh[j];sh[j]=t;}
  host.innerHTML='<div class="muted">رتّب الجملة 🧩 • '+ER.score+'/'+ER.total+'</div>'
    +'<div class="muted">'+escapeHtml(q.q)+'</div>'
    +'<div class="quiz-opts" dir="ltr">'+sh.map(k=>'<button class="quiz-opt" data-k="'+k+'">'+escapeHtml(q.words[k])+'</button>').join("")+'</div>'
    +'<div class="quiz-opts" dir="ltr" id="erAns" style="min-height:52px;border:1px dashed var(--border);border-radius:12px"></div>'
    +'<div class="row-flex"><button class="btn btn-gold sm" id="erGo">تحقق ✅</button><button class="btn btn-ghost sm" id="erClr">مسح</button></div>'
    +'<div class="quiz-feedback hidden" id="erFb"></div>';
  const picked=[];
  host.querySelectorAll(".quiz-opt[data-k]").forEach(b=>b.addEventListener("click",()=>{
    if(b.disabled)return;b.disabled=true;
    const k=parseInt(b.getAttribute("data-k"),10);picked.push(k);
    const a=$("erAns");const s=document.createElement("span");s.className="order-chip";s.textContent=q.words[k];a.appendChild(s);
  }));
  $("erClr").addEventListener("click",()=>{picked.length=0;$("erAns").innerHTML="";host.querySelectorAll(".quiz-opt[data-k]").forEach(x=>{x.disabled=false;});});
  $("erGo").addEventListener("click",()=>{
    const ok=picked.length===q.words.length&&picked.every((v,ix)=>v===ix);
    erGrade(ok,picked.map(k=>q.words[k]).join(" "),q.correct,q);
  });
}
function erGrade(ok,pickedStr,correctStr,q){
  ER.total++;
  const fb=$("erFb");if(!fb)return;
  fb.classList.remove("hidden");fb.className="quiz-feedback "+(ok?"ok":"no");
  ensureLabsx();
  if(ok){
    ER.score++;try{S.totalCorrect++;}catch(e){}
    fb.innerHTML="✅ صحيح! "+escapeHtml(q.explain);
  }else{
    try{S.totalAnswered++;}catch(e){}
    fb.innerHTML="❌ إجابتك: <b>"+escapeHtml(pickedStr)+"</b><br>✅ الصحيح: <b style='color:var(--green)'>"+escapeHtml(correctStr)+"</b><br><span class='muted'>"+escapeHtml(q.explain)+"</span>";
    try{if(q.word)recordMistake(q.word,pickedStr,"lx-er");lxSignal(q.skill,1);}catch(e){}
    try{S.totalAnswered++;}catch(e){}
  }
  try{S.totalAnswered+=ok?1:0;}catch(e){}
  try{markStudyDay();}catch(e){}
  const nx=document.createElement("button");nx.className="btn btn-primary sm";nx.textContent="التالي ⏭";
  const more=document.createElement("button");more.className="btn btn-ghost sm";more.textContent="إنهاء ✖";
  const row=document.createElement("div");row.className="row-flex";row.appendChild(nx);row.appendChild(more);
  fb.appendChild(document.createElement("br"));fb.appendChild(row);
  nx.addEventListener("click",erNext);
  more.addEventListener("click",()=>{
    const st=S.labsx.er;
    st.done++;const pct=ER.total?Math.round(ER.score/ER.total*100):0;
    if(pct>st.best)st.best=pct;
    try{addXP(ER.score*2+5,"lx-er");}catch(e){}
    lxTouch("er",{});lxSave();
    try{if(typeof renderAll==="function")renderAll();}catch(e){}
    toast("انتهى التدريب: "+ER.score+"/"+ER.total+" ⭐","ok");
    renderEr();
  });
}

/* ================= 6. CONFUSION TRAINER ================= */
const LX_CONF=[
{id:"cf-art",t:"der / die / das",ar:"الأدوات",skill:"article"},
{id:"cf-ein",t:"ein / eine / kein / keine",ar:"النكرة والنفي",skill:"ein"},
{id:"cf-nk",t:"nicht / kein",ar:"النفي",skill:"nichtkein"},
{id:"cf-hs",t:"haben / sein",ar:"الفعلان",items:[
  {s:"Ich ___ Hunger.",o:["habe","bin"],c:0,why:"الجوع مع haben."},
  {s:"Ich ___ müde.",o:["habe","bin"],c:1,why:"التعب مع sein."},
  {s:"Du ___ krank.",o:["hast","bist"],c:1,why:"المرض مع sein."},
  {s:"Wir ___ Zeit.",o:["haben","sind"],c:0,why:"الوقت مع haben."},
  {s:"Er ___ zwanzig.",o:["hat","ist"],c:1,why:"العمر مع sein."},
  {s:"Sie ___ ein Auto.",o:["hat","ist"],c:0,why:"الملكية مع haben."}]},
{id:"cf-ich",t:"ich / mich / mir",ar:"الضمائر",items:[
  {s:"___ gehe nach Hause.",o:["Ich","Mich","Mir"],c:0,why:"الفاعل ich."},
  {s:"Ich freue ___.",o:["ich","mich","mir"],c:1,why:"freuen + mich."},
  {s:"Gib ___ das Buch.",o:["ich","mich","mir"],c:2,why:"geben + Dativ → mir."},
  {s:"___ lerne Deutsch.",o:["Ich","Mich","Mir"],c:0,why:"الفاعل ich."},
  {s:"Er hilft ___.",o:["ich","mich","mir"],c:2,why:"helfen + Dativ → mir."}]},
{id:"cf-iau",t:"in / an / auf",ar:"حروف المكان",items:[
  {s:"___ der Schule",o:["in","an","auf"],c:0,why:"داخل المدرسة مع in."},
  {s:"___ der Wand",o:["in","an","auf"],c:1,why:"على الحائط مع an."},
  {s:"___ dem Tisch",o:["in","an","auf"],c:2,why:"على الطاولة مع auf."},
  {s:"___ dem Bett",o:["in","an","auf"],c:0,why:"في السرير مع in."},
  {s:"___ der Tür",o:["in","an","auf"],c:1,why:"عند الباب مع an."}]},
{id:"cf-ad",t:"Akkusativ / Dativ",ar:"الحالتان",items:[
  {s:"mit ___ (der Freund)",o:["dem","den","der"],c:0,why:"mit + Dativ → dem."},
  {s:"für ___ (die Schwester)",o:["die","der","den"],c:0,why:"für + Akkusativ → die."},
  {s:"ohne ___ (das Geld)",o:["das","dem","der"],c:0,why:"ohne + Akkusativ → das."},
  {s:"Ich sehe ___ (der Mann).",o:["den","dem","der"],c:0,why:"مفعول → den."},
  {s:"Ich helfe ___ (die Frau).",o:["der","die","den"],c:0,why:"helfen + Dativ → der."}]},
{id:"cf-pl",t:"Pluralformen",ar:"الجموع",skill:"plural"}
];
var CF={pair:null,cur:null,score:0,total:0,idx:0};
function cfTrain(pid){
  const p=LX_CONF.find(x=>x.id===pid);if(!p)return;
  CF={pair:p,cur:null,score:0,total:0,idx:0};
  cfNext();
}
function cfNext(){
  const host=$("cfBody");if(!host||!CF.pair)return;
  const p=CF.pair;
  let q=null;
  if(p.items){
    const it=p.items[CF.idx%p.items.length];CF.idx++;
    q={q:it.s,opts:it.o.slice(),correct:it.c,explain:it.why,rid:it.s};
  }else{
    ensureLabsx();
    q=erGen(p.skill,(S.labsx.er.recent||[]));
    if(!q||q.words){q=erGen(p.skill,[]);}
    if(!q||q.words){host.innerHTML='<div class="muted">تعذّر إنشاء سؤال — حاول لاحقًا 🔁</div>';return;}
  }
  CF.cur=q;
  host.innerHTML='<div class="muted">تدريب مركّز: <b>'+escapeHtml(p.t)+'</b> ('+escapeHtml(p.ar)+') • '+CF.score+'/'+CF.total+'</div>'
    +'<h4 dir="ltr" style="text-align:left">'+escapeHtml(q.q)+'</h4>'
    +'<div class="quiz-opts" dir="ltr">'+q.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>'
    +'<div class="quiz-feedback hidden" id="cfFb"></div>';
  host.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
    const j=parseInt(b.getAttribute("data-j"),10);
    host.querySelectorAll(".quiz-opt").forEach(x=>{x.disabled=true;});
    const ok=j===q.correct;
    if(ok)b.classList.add("correct");
    else{b.classList.add("wrong");host.querySelectorAll(".quiz-opt")[q.correct].classList.add("correct");}
    cfGrade(ok,q);
  }));
}
function cfGrade(ok,q){
  CF.total++;
  const fb=$("cfFb");if(!fb)return;
  fb.classList.remove("hidden");fb.className="quiz-feedback "+(ok?"ok":"no");
  ensureLabsx();
  if(ok){CF.score++;try{S.totalCorrect++;}catch(e){}fb.innerHTML="✅ صحيح! "+escapeHtml(q.explain);}
  else{
    fb.innerHTML="❌ الصحيح: <b style='color:var(--green)'>"+escapeHtml(q.opts[q.correct])+"</b><br><span class='muted'>"+escapeHtml(q.explain)+"</span>";
    try{if(q.word)recordMistake(q.word,q.opts[q.correct],"lx-conf");lxSignal(q.skill||"conf",1);}catch(e){}
  }
  try{S.totalAnswered++;}catch(e){}
  try{markStudyDay();}catch(e){}
  const nx=document.createElement("button");nx.className="btn btn-primary sm";nx.textContent="التالي ⏭";
  const more=document.createElement("button");more.className="btn btn-ghost sm";more.textContent="إنهاء ✖";
  const row=document.createElement("div");row.className="row-flex";row.appendChild(nx);row.appendChild(more);
  fb.appendChild(document.createElement("br"));fb.appendChild(row);
  nx.addEventListener("click",cfNext);
  more.addEventListener("click",()=>{
    ensureLabsx();
    const cp=S.labsx.conf.pair;cp[CF.pair.id]=(cp[CF.pair.id]||0)+CF.score;
    S.labsx.conf.done++;
    try{addXP(CF.score*2+5,"lx-conf");}catch(e){}
    lxTouch("conf",{});lxSave();
    try{if(typeof renderAll==="function")renderAll();}catch(e){}
    toast("انتهى التدريب: "+CF.score+"/"+CF.total+" ⭐","ok");
    renderEr();
  });
}

/* ================= 7. DASHBOARD ================= */
function lxLabRow(icon,name,page,st,extra){
  return '<div class="j-stage"><div><b>'+icon+" "+name+'</b><div class="muted">'+extra+'</div></div>'
    +'<button class="btn btn-ghost sm" data-lxgo="'+page+'">فتح ←</button></div>';
}
function renderLabsxDash(){
  try{
    ensureLabsx();
    let host=$("dashLabsx");
    if(!host){
      const anchor=$("dashLife")||$("dashLearn")||$("gamerStrip");
      if(!anchor)return;
      host=document.createElement("div");host.id="dashLabsx";
      anchor.parentNode.insertBefore(host,anchor.nextSibling);
    }
    const L=S.labsx;
    const sitN=Object.keys(L.sit.done||{}).length;
    host.innerHTML='<div class="panel glass reveal"><h3>🚀 '+t("labsx_new")+'</h3>'
      +lxLabRow("🎙️",t("shadowing"),"shadowing",0,"محاولات "+L.shadow.att+" • أفضل "+L.shadow.best+"% • متقن "+L.shadow.mastered)
      +lxLabRow("✍️",t("writing"),"writing",0,"مكتمل "+L.write.done+" • أفضل "+L.write.best+"%")
      +lxLabRow("👂",t("dictation"),"dictation",0,"محاولات "+L.dict.att+" • أفضل "+L.dict.best+"% • متقن "+L.dict.mastered)
      +lxLabRow("🎬",t("situations"),"situations",0,"مكتمل "+sitN+"/"+LX_SIT.length)
      +lxLabRow("🧠",t("erreplay"),"erreplay",0,"تدريبات "+L.er.done+" • أفضل "+L.er.best+"%")
      +'</div>';
    host.querySelectorAll("[data-lxgo]").forEach(b=>b.addEventListener("click",()=>{try{showPage(b.getAttribute("data-lxgo"));}catch(e){}}));
  }catch(e){}
}

/* ================= 8. WIRING ================= */
const LABSX_PAGES={shadowing:renderShadow,writing:renderWrite,dictation:renderDict,situations:renderSit,erreplay:renderEr};
(function(){
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(LABSX_PAGES[n])LABSX_PAGES[n]();}catch(e){console.error(e);}};
    const _rd=renderDashboard;
    renderDashboard=function(){_rd();try{renderLabsxDash();}catch(e){}};
    ensureLabsx();
    try{
      document.querySelectorAll("[data-goto='shadowing'],[data-goto='writing'],[data-goto='dictation'],[data-goto='situations'],[data-goto='erreplay']").forEach(function(b){
        b.addEventListener("click",function(){showPage(b.getAttribute("data-goto"));});
      });
    }catch(e){}
  }catch(e){console.error(e);}
})();
