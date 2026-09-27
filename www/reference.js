/* Deutsch Master — 📚 المرجع الألماني الشامل v2 (ADDITIVE ONLY).
   Knowledge-base architecture: 16 paths (A..P) -> topics -> unified template.
   Data lives in client/reference-data-*.js (pure data, no DOM).
   This file = engine only. Reuses: showPage-wrap, escapeHtml, speakGerman,
   t()/applyLang, .quiz-opt, .ex-table, openExplain, markStudyDay.
   Quiz gate: a question renders ONLY if refValidQuiz() passes. */
"use strict";

/* ---------- i18n chrome (one Object.assign per lang; merged by check-translations.js) ---------- */
try{
  Object.assign(I18N.ar,{reference:"المرجع الألماني الشامل",title_reference:"📚 المرجع الألماني الشامل",ref_search_ph:"ابحث في المرجع: mit / Dativ / ماضي / gestern / ضمائر...",ref_search_label:"🔍 بحث المرجع",ref_paths:"المسارات المعرفية",ref_topics:"مواضيع المسار",ref_back_paths:"← كل المسارات",ref_back_path:"← مواضيع المسار",ref_what:"ما هو؟",ref_rule:"القاعدة",ref_examples:"أمثلة",ref_notes:"ملاحظات مهمة",ref_mistakes:"أخطاء شائعة",ref_related:"🔗 موضوعات مرتبطة",ref_quiz:"📝 تدريب سريع",ref_no_results:"لا توجد نتائج مطابقة — جرّب كلمة أخرى",ref_grammar_hub:"📐 فتح القواعد المرتبطة",ref_open_lesson:"📖 فتح الشرح المفصل",ref_prev:"→ السابق",ref_next:"التالي ←",ref_topic_of:"الموضوع",ref_of:"من",ref_level_a1:"🟢 A1 أساسي",ref_level_a2:"🟡 A2 بعده",ref_level_b1:"🔵 B1 متقدم",ref_b1_closed:"🔵 محتوى متقدم — اضغط للفتح",ref_correct:"صحيح ✅",ref_wrong:"خطأ ❌",ref_home:"المرجع"});
  Object.assign(I18N.en,{reference:"Complete German Reference",title_reference:"📚 Complete German Reference",ref_search_ph:"Search the reference: mit / Dativ / past / gestern / pronouns...",ref_search_label:"🔍 Reference search",ref_paths:"Knowledge paths",ref_topics:"Path topics",ref_back_paths:"← All paths",ref_back_path:"← Path topics",ref_what:"What is it?",ref_rule:"The rule",ref_examples:"Examples",ref_notes:"Important notes",ref_mistakes:"Common mistakes",ref_related:"🔗 Related topics",ref_quiz:"📝 Quick practice",ref_no_results:"No matches — try another word",ref_grammar_hub:"📐 Open related grammar",ref_open_lesson:"📖 Open full lesson",ref_prev:"→ Previous",ref_next:"Next ←",ref_topic_of:"Topic",ref_of:"of",ref_level_a1:"🟢 A1 basic",ref_level_a2:"🟡 A2 next",ref_level_b1:"🔵 B1 advanced",ref_b1_closed:"🔵 Advanced — tap to open",ref_correct:"Correct ✅",ref_wrong:"Wrong ❌",ref_home:"Reference"});
  Object.assign(I18N.de,{reference:"Deutsche Komplettreferenz",title_reference:"📚 Deutsche Komplettreferenz",ref_search_ph:"Referenz durchsuchen: mit / Dativ / Vergangenheit / gestern / Pronomen...",ref_search_label:"🔍 Referenzsuche",ref_paths:"Wissenspfade",ref_topics:"Pfadthemen",ref_back_paths:"← Alle Pfade",ref_back_path:"← Pfadthemen",ref_what:"Was ist das?",ref_rule:"Die Regel",ref_examples:"Beispiele",ref_notes:"Wichtige Hinweise",ref_mistakes:"Häufige Fehler",ref_related:"🔗 Verwandte Themen",ref_quiz:"📝 Kurztraining",ref_no_results:"Keine Treffer — versuch ein anderes Wort",ref_grammar_hub:"📐 Verwandte Grammatik öffnen",ref_open_lesson:"📖 Lektion öffnen",ref_prev:"→ Zurück",ref_next:"Weiter ←",ref_topic_of:"Thema",ref_of:"von",ref_level_a1:"🟢 A1 Basis",ref_level_a2:"🟡 A2 danach",ref_level_b1:"🔵 B1 fortgeschritten",ref_b1_closed:"🔵 Fortgeschritten — tippen zum Öffnen",ref_correct:"Richtig ✅",ref_wrong:"Falsch ❌",ref_home:"Referenz"});
}catch(e){}

/* ---------- 16 knowledge paths ---------- */
const REF_PATHS=[
 {id:"A",icon:"📖",ar:"أساسيات اللغة",de:"Grundlagen",en:"Basics",color:"#38bdf8"},
 {id:"B",icon:"📦",ar:"الأسماء والأدوات",de:"Nomen & Artikel",en:"Nouns & articles",color:"#22c55e"},
 {id:"C",icon:"👤",ar:"الضمائر",de:"Pronomen",en:"Pronouns",color:"#eab308"},
 {id:"D",icon:"📊",ar:"الحالات الأربع",de:"Die vier Kasus",en:"The four cases",color:"#ef4444"},
 {id:"E",icon:"🎨",ar:"الصفات",de:"Adjektive",en:"Adjectives",color:"#a78bfa"},
 {id:"F",icon:"⚡",ar:"الأفعال",de:"Verben",en:"Verbs",color:"#38bdf8"},
 {id:"G",icon:"⏳",ar:"الأزمنة",de:"Zeiten",en:"Tenses",color:"#fb923c"},
 {id:"H",icon:"📍",ar:"حروف الجر",de:"Präpositionen",en:"Prepositions",color:"#eab308"},
 {id:"I",icon:"❓",ar:"السؤال والنفي والربط",de:"Fragen, Negation & Konjunktionen",en:"Questions, negation & conjunctions",color:"#22c55e"},
 {id:"J",icon:"🕐",ar:"الوقت والتاريخ",de:"Zeit & Datum",en:"Time & date",color:"#38bdf8"},
 {id:"K",icon:"🔢",ar:"الأرقام والكمية",de:"Zahlen & Menge",en:"Numbers & quantity",color:"#a78bfa"},
 {id:"L",icon:"🗺️",ar:"المكان والاتجاه",de:"Ort & Richtung",en:"Place & direction",color:"#ef4444"},
 {id:"M",icon:"🧩",ar:"بناء الجملة",de:"Satzbau",en:"Sentence structure",color:"#fb923c"},
 {id:"N",icon:"✒️",ar:"الترقيم والكتابة",de:"Zeichensetzung",en:"Punctuation",color:"#eab308"},
 {id:"O",icon:"💬",ar:"التعبيرات العملية",de:"Alltagssprache",en:"Everyday phrases",color:"#22c55e"},
 {id:"P",icon:"⚖️",ar:"المقارنات والأخطاء",de:"Vergleiche & Fehler",en:"Comparisons & errors",color:"#38bdf8"}
];

/* ---------- helpers ---------- */
function refT(k){try{if(typeof t==="function"){const v=t(k);if(v&&v!==k)return v;}}catch(e){}return k;}
function refEsc(s){try{if(typeof escapeHtml==="function")return escapeHtml(s);}catch(e){}return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function refNorm(s){let x=String(s==null?"":s).toLowerCase();x=x.replace(/ß/g,"ss").replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u");return x.trim();}
function refStripAl(w){return String(w||"").replace(/^(ال|لل|بال|كال|فال|وال)/,"");}
function refLang(){try{return (typeof S!=="undefined"&&S.uiLang)||"ar";}catch(e){return "ar";}}
function refPathTitle(p){const L=refLang();if(L==="de")return p.de;if(L==="en")return p.en;return p.ar;}
function refTopicTitle(tp){const L=refLang();if(L==="de")return tp.de||tp.ar;if(L==="en")return tp.en||tp.ar;return tp.ar;}
function refLvlClass(l){return l==="A2"?"lvl-a2":(l==="B1"?"lvl-b1":"lvl-a1");}
function refLvlLabel(l){return refT(l==="A2"?"ref_level_a2":(l==="B1"?"ref_level_b1":"ref_level_a1"));}

/* ---------- data access: every REF_* array; path from topic id prefix (b-*=B …) ---------- */
function refAllTopicsFlat(){
  const out=[];
  try{
    Object.keys(window).forEach(k=>{
      if(/^REF_[A-Z][A-Z0-9]*$/.test(k)){const a=window[k];if(Array.isArray(a))a.forEach(tp=>{if(tp)out.push(tp);});}
    });
  }catch(e){}
  return out;
}
function refPathTopics(pid){
  const pre=String(pid||"").toLowerCase()+"-";
  return refAllTopicsFlat().filter(tp=>tp&&typeof tp.id==="string"&&tp.id.indexOf(pre)===0);
}
function refTopicById(id){
  for(const p of REF_PATHS){const arr=refPathTopics(p.id);for(const tp of arr){if(tp&&tp.id===id)return {path:p,topic:tp};}
  }return null;
}
function refPathById(pid){return REF_PATHS.find(p=>p.id===pid)||null;}

/* ---------- STRICT quiz gate: invalid questions never render ---------- */
/* Self-contained Fisher-Yates index permutation (no shared deps, no position-0 assumption).
   Render buttons in the returned order with data-oi = ORIGINAL index. */
function refShuffleIdx(n){const idx=[];for(let i=0;i<n;i++)idx.push(i);for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=idx[i];idx[i]=idx[j];idx[j]=t;}return idx;}
/* ---------- shared order-question check (words must rebuild the answer exactly) ---------- */
function refOrderValid(words,answer){
  if(!Array.isArray(words)||words.length<2)return false;
  const w=words.map(o=>String(o==null?"":o).trim());
  if(w.some(x=>!x))return false;
  if(new Set(w).size!==w.length)return false;
  if(typeof answer!=="string"||!answer.trim())return false;
  let tmp=" "+answer.trim()+" ";
  const sorted=w.slice().sort((a,b)=>b.length-a.length);
  for(const c of sorted){const i=tmp.indexOf(c);if(i<0)return false;tmp=tmp.slice(0,i)+" "+tmp.slice(i+c.length);}
  if(tmp.replace(/\s+/g,"")!=="")return false;
  return true;
}
function refValidQuiz(q){
  if(!q||typeof q.q!=="string"||!q.q.trim())return false;
  if(q.type==="order"){
    if(!refOrderValid(q.words,q.answer))return false;
    if(!q.why||!String(q.why).trim())return false;
    return true;
  }
  if(!Array.isArray(q.opts)||q.opts.length<2)return false;
  if(q.opts.some(o=>typeof o!=="string"||!o.trim()))return false;
  if(typeof q.correct!=="number"||q.correct<0||q.correct>=q.opts.length)return false;
  const norm=q.opts.map(o=>o.trim());
  if(new Set(norm).size!==norm.length)return false; /* duplicate options = ambiguous */
  return true;
}

/* ---------- state + views ---------- */
var refState={path:null,topic:null};

function renderReference(){
  const box=document.getElementById("refBox");if(!box)return;
  refState={path:null,topic:null};
  let h='<div class="panel glass ref-search-panel"><label class="ref-search-label">'+refEsc(refT("ref_search_label"))+'</label>';
  h+='<input type="text" id="refSearch" class="full-input" data-i18n-ph="ref_search_ph" placeholder="'+refEsc(refT("ref_search_ph"))+'">';
  h+='<div id="refResults" class="ref-results"></div></div>';
  h+='<h3 class="ref-sec-title">'+refEsc(refT("ref_paths"))+'</h3><div class="ref-grid">';
  REF_PATHS.forEach(p=>{
    const n=refPathTopics(p.id).length;
    h+='<button class="ref-card glass" data-path="'+p.id+'" style="border-top:4px solid '+p.color+'"><span class="ref-ico">'+p.icon+'</span><span class="ref-name">'+refEsc(refPathTitle(p))+'</span><span class="ref-de">'+refEsc(p.de)+'</span><span class="ref-count">'+n+'</span></button>';
  });
  h+='</div><div id="refDetail"></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-path]").forEach(b=>b.addEventListener("click",()=>openRefPath(b.getAttribute("data-path"))));
  const si=document.getElementById("refSearch");
  let tm=null;
  si.addEventListener("input",()=>{try{clearTimeout(tm);}catch(e){}tm=setTimeout(runRefSearch,120);});
  try{if(typeof applyLang==="function")applyLang();}catch(e){}
}

function refCrumb(items){
  return '<div class="ref-crumb"><button class="mini-btn" data-crumb="home">'+refEsc(refT("ref_home"))+'</button>'+items.map(it=>' <span>‹</span> '+(it.id?'<button class="mini-btn" data-crumb="'+it.id+'">'+refEsc(it.label)+'</button>':'<b>'+refEsc(it.label)+'</b>')).join("")+'</div>';
}
function wireCrumb(root){
  root.querySelectorAll("[data-crumb]").forEach(b=>b.addEventListener("click",()=>{
    const v=b.getAttribute("data-crumb");
    if(v==="home")renderReference();
    else openRefPath(v);
  }));
}

function openRefPath(pid){
  const p=refPathById(pid);if(!p)return;
  refState={path:pid,topic:null};
  const box=document.getElementById("refBox");if(!box)return;
  const topics=refPathTopics(pid);
  let h=refCrumb([{label:refPathTitle(p)}]);
  h+='<div class="ref-path-head" style="border-top:4px solid '+p.color+'"><span class="ref-ico">'+p.icon+'</span><h3>'+refEsc(refPathTitle(p))+' <span class="muted">'+refEsc(p.de)+'</span></h3>';
  h+='<div class="row-flex"><button class="btn btn-ghost sm" id="refBackPaths">'+refEsc(refT("ref_back_paths"))+'</button><button class="btn btn-ghost sm" id="refGrammarHub">'+refEsc(refT("ref_grammar_hub"))+'</button></div></div>';
  h+='<div class="ref-chips">'+REF_PATHS.map(x=>'<button class="mini-btn'+(x.id===pid?" on":"")+'" data-jump="'+x.id+'">'+x.icon+' '+x.id+'</button>').join("")+'</div>';
  if(topics.length){
    h+='<h4>'+refEsc(refT("ref_topics"))+' ('+topics.length+')</h4><div class="ref-topic-list">';
    topics.forEach(tp=>{
      const body=refTopicPreview(tp);
      if(tp.level==="B1"){
        h+='<details class="ref-topic glass"><summary><span class="'+refLvlClass("B1")+'">'+refEsc(refLvlLabel("B1"))+'</span> '+refEsc(refTopicTitle(tp))+' <span class="muted">'+refEsc(tp.de||"")+'</span></summary><div class="ref-topic-body">'+body+'</div></details>';
      }else{
        h+='<div class="ref-topic glass"><button class="ref-topic-open" data-topic="'+refEsc(tp.id)+'"><span class="'+refLvlClass(tp.level||"A1")+'">'+refEsc(refLvlLabel(tp.level||"A1"))+'</span> <b>'+refEsc(refTopicTitle(tp))+'</b> <span class="muted">'+refEsc(tp.de||"")+'</span><span>←</span></button></div>';
      }
    });
    h+='</div>';
  }
  h+='<div id="refTopicView"></div>';
  box.innerHTML=h;
  wireCrumb(box);
  document.getElementById("refBackPaths").addEventListener("click",renderReference);
  document.getElementById("refGrammarHub").addEventListener("click",()=>{try{showPage("grammar");}catch(e){}});
  box.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>openRefPath(b.getAttribute("data-jump"))));
  box.querySelectorAll("[data-topic]").forEach(b=>b.addEventListener("click",()=>openRefTopic(b.getAttribute("data-topic"))));
  box.querySelectorAll("[data-topic-open]").forEach(b=>b.addEventListener("click",()=>openRefTopic(b.getAttribute("data-topic-open"))));
  try{window.scrollTo({top:0,behavior:"smooth"});}catch(e){}
}

function refTopicPreview(tp){
  return '<button class="btn btn-primary sm" data-topic-open="'+refEsc(tp.id)+'">'+refEsc(refT("ref_topic_of"))+' ←</button>';
}

function openRefTopic(tid){
  const found=refTopicById(tid);if(!found)return;
  const {path:p,topic:tp}=found;
  refState={path:p.id,topic:tid};
  const topics=refPathTopics(p.id);
  const idx=topics.findIndex(x=>x.id===tid);
  const prev=idx>0?topics[idx-1]:null, next=(idx>=0&&idx<topics.length-1)?topics[idx+1]:null;
  let h=refCrumb([{id:p.id,label:p.id+" • "+refPathTitle(p)},{label:refTopicTitle(tp)}]);
  h+='<div class="panel glass ref-hero"><span class="'+refLvlClass(tp.level||"A1")+'">'+refEsc(refLvlLabel(tp.level||"A1"))+'</span>';
  h+='<h2>'+refEsc(tp.de||"")+'</h2><div class="ref-hero-ar">'+refEsc(tp.ar||"")+(tp.en?' <span class="muted">• '+refEsc(tp.en)+'</span>':"")+'</div>';
  h+='<div class="muted">'+refEsc(refT("ref_topic_of"))+' '+(idx+1)+' '+refEsc(refT("ref_of"))+' '+topics.length+' • '+p.id+'</div></div>';
  if(tp.what)h+='<div class="panel glass"><h4>1️⃣ '+refEsc(refT("ref_what"))+'</h4><p>'+refEsc(tp.what)+'</p></div>';
  if(tp.rule)h+='<div class="panel glass"><h4>2️⃣ '+refEsc(refT("ref_rule"))+'</h4><p>'+refEsc(tp.rule)+'</p></div>';
  (tp.tables||[]).forEach(tb=>{
    h+='<div class="panel glass"><h4>📊 '+refEsc(tb.cap)+'</h4><div class="tbl-wrap"><table class="ex-table"><tr>'+tb.head.map(x=>'<th>'+refEsc(x)+'</th>').join("")+'</tr>';
    tb.rows.forEach(r=>{h+='<tr>'+r.map(c=>'<td>'+refLinkCell(c,tp.id)+'</td>').join("")+'</tr>';});
    h+='</table></div></div>';
  });
  if(tp.examples&&tp.examples.length){
    h+='<div class="panel glass"><h4>🇩🇪 '+refEsc(refT("ref_examples"))+'</h4>';
    tp.examples.forEach(e=>{
      h+='<div class="ref-ex"><div class="ref-ex-de" dir="ltr">'+refEsc(e[0])+' <button class="mini-btn ref-say" data-spk="'+refEsc(e[0])+'" title="🔊">🔊</button></div><div class="ref-ex-ar">'+refEsc(e[1]||"")+'</div></div>';
    });
    h+='</div>';
  }
  if(tp.notes&&tp.notes.length)h+='<div class="panel glass"><h4>⭐ '+refEsc(refT("ref_notes"))+'</h4><ul class="ex-ul">'+tp.notes.map(n=>'<li>'+refEsc(n)+'</li>').join("")+'</ul></div>';
  if(tp.mistakes&&tp.mistakes.length){
    h+='<div class="panel glass"><h4>⚠️ '+refEsc(refT("ref_mistakes"))+'</h4>'+tp.mistakes.map(m=>{
      let relBtn="";
      try{const f=m.rel?refTopicById(m.rel):null;if(f)relBtn='<div><button class="mini-btn" data-rel="'+refEsc(m.rel)+'">🧠 '+refEsc(refTopicTitle(f.topic))+'</button></div>';}catch(e){}
      return '<div class="ex-mist"><div class="ex-wrong">❌ '+refEsc(m.w)+'</div><div class="ex-right">✅ '+refEsc(m.r)+'</div><div class="muted">💡 '+refEsc(m.why)+'</div>'+relBtn+'</div>';
    }).join("")+'</div>';
  }
  if(tp.related&&tp.related.length){
    const links=tp.related.map(rid=>{const f=refTopicById(rid);if(!f)return null;return '<button class="mini-btn" data-rel="'+refEsc(rid)+'">'+f.path.id+' • '+refEsc(refTopicTitle(f.topic))+'</button>';}).filter(Boolean);
    if(links.length)h+='<div class="panel glass"><h4>'+refEsc(refT("ref_related"))+'</h4><div class="row-flex">'+links.join("")+'</div></div>';
  }
  if(tp.explain){
    h+='<div class="row-flex"><button class="btn btn-ghost sm" id="refExplainBtn">'+refEsc(refT("ref_open_lesson"))+' ('+refEsc(tp.explain)+')</button></div>';
  }
  const validQ=(tp.quiz||[]).filter(refValidQuiz);
  if(validQ.length){
    h+='<details class="panel glass" open><summary><b>'+refEsc(refT("ref_quiz"))+' ('+validQ.length+')</b></summary><div class="ref-quiz-body">';
    validQ.forEach((q,qi)=>{
      if(q.type==="order"){
        h+='<div class="ref-q" data-qi="'+qi+'" data-qtype="order"><b>🔀 '+refEsc(q.q)+'</b><div class="ref-order-line" dir="ltr"></div><div class="quiz-opts ref-order-bank">'+refShuffleIdx(q.words.length).map(wi=>'<button class="quiz-opt ref-order-word">'+refEsc(q.words[wi])+'</button>').join("")+'</div><div class="row-flex"><button class="btn btn-ghost sm ref-order-reset">↺</button><button class="btn btn-primary sm ref-order-check">✓</button></div><div class="quiz-feedback hidden"></div></div>';
      }else{
        h+='<div class="ref-q" data-qi="'+qi+'" data-qtype="choice"><b>'+refEsc(q.q)+'</b><div class="quiz-opts">'+refShuffleIdx(q.opts.length).map(oi=>'<button class="quiz-opt" data-qi="'+qi+'" data-oi="'+oi+'">'+refEsc(q.opts[oi])+'</button>').join("")+'</div><div class="quiz-feedback hidden"></div></div>';
      }
    });
    h+='</div></details>';
  }
  h+='<div class="ex-nav bottom"><button class="btn btn-ghost sm" id="refPrevBtn" '+(prev?"":"disabled")+'>'+refEsc(refT("ref_prev"))+(prev?' '+refEsc(refTopicTitle(prev)):"")+'</button><button class="btn btn-gold sm" id="refIdxBtn">'+refEsc(refT("ref_back_path"))+'</button><button class="btn btn-ghost sm" id="refNextBtn" '+(next?"":"disabled")+'>'+(next?refEsc(refTopicTitle(next))+" ":"")+refEsc(refT("ref_next"))+'</button></div>';
  const box=document.getElementById("refBox");if(!box)return;
  /* keep search+paths grid on top: render topic into detail area if present, else full */
  let det=document.getElementById("refDetail");
  if(!det){renderReference();det=document.getElementById("refDetail");}
  det.innerHTML=h;
  wireCrumb(det);
  det.querySelectorAll("[data-spk]").forEach(b=>b.addEventListener("click",ev=>{ev.stopPropagation();try{if(typeof speakGerman==="function")speakGerman(b.getAttribute("data-spk"));}catch(e){}}));
  det.querySelectorAll("[data-rel]").forEach(b=>b.addEventListener("click",()=>openRefTopic(b.getAttribute("data-rel"))));
  const exB=document.getElementById("refExplainBtn");
  if(exB&&tp.explain)exB.addEventListener("click",()=>{try{if(typeof openExplain==="function")openExplain(tp.explain);}catch(e){}});
  det.querySelectorAll(".ref-q").forEach(wrap=>{
    let qi=NaN;
    try{qi=parseInt(wrap.getAttribute("data-qi"),10);}catch(e){}
    const q=validQ[qi];
    if(!q||typeof wrap.querySelector!=="function")return;
    if(q.type==="order"){wireRefOrder(wrap,q);return;}
    const firstOpt=wrap.querySelector(".quiz-opt");
    if(!firstOpt)return;
    wrap.querySelectorAll(".quiz-opt").forEach(btn=>btn.addEventListener("click",()=>{
      const oi=parseInt(btn.getAttribute("data-oi"),10);
      wrap.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      const fb=wrap.querySelector(".quiz-feedback");fb.classList.remove("hidden");
      if(oi===q.correct){btn.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent=refT("ref_correct")+" "+(q.why||"");}
      else{btn.classList.add("wrong");const cb=Array.from(wrap.querySelectorAll(".quiz-opt")).find(x=>parseInt(x.getAttribute("data-oi"),10)===q.correct);if(cb)cb.classList.add("correct");fb.className="quiz-feedback no";fb.textContent=refT("ref_wrong")+" ✅ "+q.opts[q.correct]+" — "+(q.why||"");}
      try{if(typeof markStudyDay==="function")markStudyDay(false);}catch(e){}
    }));
  });
  document.getElementById("refIdxBtn").addEventListener("click",()=>openRefPath(p.id));
  if(prev)document.getElementById("refPrevBtn").addEventListener("click",()=>openRefTopic(prev.id));
  if(next)document.getElementById("refNextBtn").addEventListener("click",()=>openRefTopic(next.id));
  det.scrollIntoView({behavior:"smooth",block:"start"});
}

/* ---------- order-type quiz wiring (tap words in order, then check) ---------- */
function wireRefOrder(wrap,q){
  let line=null,bank=[],fb=null,resetBtn=null,checkBtn=null;
  try{
    line=wrap.querySelector(".ref-order-line");
    bank=Array.from(wrap.querySelectorAll(".ref-order-word"));
    fb=wrap.querySelector(".quiz-feedback");
    resetBtn=wrap.querySelector(".ref-order-reset");
    checkBtn=wrap.querySelector(".ref-order-check");
  }catch(e){return;}
  if(!line||!bank.length||!fb||!resetBtn||!checkBtn)return;
  function picks(){try{return Array.from(line.querySelectorAll(".ref-order-pick")).map(s=>s.getAttribute("data-w")||"");}catch(e){return [];}}
  bank.forEach(b=>b.addEventListener("click",()=>{
    if(b.disabled)return;b.disabled=true;
    try{
      const s=document.createElement("span");s.className="ref-order-pick";s.setAttribute("data-w",b.textContent);s.textContent=b.textContent;
      line.appendChild(s);
    }catch(e){}
  }));
  resetBtn.addEventListener("click",()=>{try{line.innerHTML="";}catch(e){}bank.forEach(b=>{b.disabled=false;});fb.classList.add("hidden");});
  checkBtn.addEventListener("click",()=>{
    const got=picks().join(" ");
    fb.classList.remove("hidden");
    if(got===q.answer){fb.className="quiz-feedback ok";fb.textContent=refT("ref_correct")+" "+(q.why||"");bank.forEach(b=>{b.disabled=true;});}
    else{fb.className="quiz-feedback no";fb.textContent=refT("ref_wrong")+" ✅ "+q.answer+" — "+(q.why||"");}
    try{if(typeof markStudyDay==="function")markStudyDay(false);}catch(e){}
  });
}

/* ---------- interactive cells: German headwords open their word card ---------- */
var REF_LINK_INDEX=null;
const REF_LINK_SPECIAL={wer:["wer","wen","wem"],welcher:["welcher","welche","welches","welchen"],der:["der","den","dem","des"],ich:["ich","mich","mir"],wieviel:["wie viel","wie viele"]};
function refLinkWords(tp){
  const parts=String(tp.id||"").split("-w-");
  const suf=parts.length>1?parts[1]:"";
  if(!suf)return [];
  if(REF_LINK_SPECIAL[suf])return REF_LINK_SPECIAL[suf];
  return [suf.replace(/ae/g,"ä").replace(/oe/g,"ö").replace(/ue/g,"ü")];
}
function refBuildLinkIndex(){
  const idx=[];
  refAllTopicsFlat().forEach(tp=>{
    if(!tp||typeof tp.id!=="string"||tp.id.indexOf("-w-")<0)return;
    refLinkWords(tp).forEach(w=>{if(w&&w.length>=2)idx.push({w:w,id:tp.id});});
  });
  idx.sort((a,b)=>b.w.length-a.w.length);
  REF_LINK_INDEX=idx;
}
function refEscRe(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function refLinkCell(raw,curId){
  const txt=String(raw==null?"":raw);
  try{
    if(!REF_LINK_INDEX)refBuildLinkIndex();
    for(const e of REF_LINK_INDEX){
      if(e.id===curId)continue;
      const re=new RegExp("(^|[^\\p{L}])("+refEscRe(e.w)+")(?![\\p{L}])","iu");
      const m=txt.match(re);
      if(m){
        const start=m.index+(m[1]?m[1].length:0);
        const before=txt.slice(0,start),after=txt.slice(start+m[2].length);
        return refEsc(before)+'<button class="mini-btn ref-cell-link" data-rel="'+e.id+'">'+refEsc(m[2])+'</button>'+refEsc(after);
      }
    }
  }catch(err){}
  return refEsc(txt);
}

/* ---------- professional search: de/ar/en/title/examples/keywords/related ---------- */
var refIndex=null;
function refBuildIndex(){
  const entries=[];
  REF_PATHS.forEach(p=>{
    entries.push({kind:"path",path:p,topic:null,title:refPathTitle(p)+" "+p.de+" "+p.en,hay:refNorm(p.ar+" "+p.de+" "+p.en)});
    refPathTopics(p.id).forEach(tp=>{
      const hay=refNorm([tp.de,tp.ar,tp.en,tp.what,tp.rule,(tp.keywords||[]).join(" "),(tp.tables||[]).map(x=>x.cap+" "+x.head.join(" ")+x.rows.map(r=>r.join(" ")).join(" ")).join(" "),(tp.examples||[]).map(e=>e.join(" ")).join(" "),(tp.notes||[]).join(" ")].join(" "));
      entries.push({kind:"topic",path:p,topic:tp,title:refTopicTitle(tp)+" — "+(tp.de||""),hay:hay});
    });
  });
  refIndex=entries;return entries;
}
function runRefSearch(){
  const inp=document.getElementById("refSearch"),out=document.getElementById("refResults");
  if(!inp||!out)return;
  const q=refNorm(inp.value);
  if(!q||q.length<2){out.innerHTML="";out.classList.remove("show");return;}
  if(!refIndex)refBuildIndex();
  const scored=[];
  refIndex.forEach(e=>{
    let s=0,kb=0;
    const ti=refNorm(e.kind==="path"?refPathTitle(e.path)+" "+e.path.de+" "+e.path.en:refTopicTitle(e.topic)+" "+(e.topic.de||"")+" "+(e.topic.en||""));
    const kws=e.kind==="topic"?((e.topic.keywords||[]).map(refNorm)):[""];
    if(kws.some(k=>k===q))kb=1;
    var REF_STOP=new Set(["der","die","das","den","dem","des","ein","eine","einen","einem","einer","mit","von","zu","bei","nach","aus","vor","für","um","ohne","gegen","durch","seit","und","oder","aber","als","in","an","auf","the","and","with","with","of","to","on","for","a","an"]);
    if(ti===q)s=10;
    else{
      const wordMatch=ti.split(" ").some(w=>refStripAl(w)===refStripAl(q));
      let st=0;
      if(wordMatch)st=REF_STOP.has(q)?6:8;
      else if(ti.indexOf(q)>=0)st=6;
      let sk=0;
      if(kb)sk=7;
      else if(kws.some(k=>k&&k.indexOf(q)===0))sk=5;
      s=Math.max(st,sk);
      if(s===0&&e.hay.indexOf(q)>=0)s=4;
    }
    if(s>0)scored.push({e:e,s:s,kb:kb,tb:ti.indexOf(q)===0?1:0});
  });
  scored.sort((a,b)=>(b.s-a.s)||(b.kb-a.kb)||(b.tb-a.tb));
  const top=scored.slice(0,12);
  if(!top.length){out.innerHTML='<div class="search-hit">'+refEsc(refT("ref_no_results"))+'</div>';out.classList.add("show");return;}
  out.innerHTML=top.map((r,i)=>{
    const label=r.e.kind==="path"?("🗂️ "+refEsc(refPathTitle(r.e.path))):("📄 "+refEsc(refTopicTitle(r.e.topic))+" <span class='muted'>("+r.e.path.id+" • "+refEsc(refPathTitle(r.e.path))+")</span>");
    return '<div class="search-hit" data-h="'+i+'">'+label+'</div>';
  }).join("");
  out.classList.add("show");
  out.querySelectorAll("[data-h]").forEach(el=>el.addEventListener("click",()=>{
    const r=top[parseInt(el.getAttribute("data-h"),10)];if(!r)return;
    out.classList.remove("show");try{inp.value="";}catch(e){}
    if(r.e.kind==="path")openRefPath(r.e.path.id);
    else{openRefPath(r.e.path.id);setTimeout(()=>openRefTopic(r.e.topic.id),60);}
  }));
}

/* ---------- showPage wrap + lazy registration ---------- */
(function(){
  try{if(typeof DM_LAZY!=="undefined"&&DM_LAZY)DM_LAZY.reference=renderReference;}catch(e){}
  try{
    if(typeof showPage==="function"){
      const _sp=showPage;
      const REF_PAGES={reference:renderReference};
      showPage=function(n){_sp(n);try{if(REF_PAGES[n])REF_PAGES[n]();}catch(e){if(window.console)console.error(e);}};
    }
  }catch(e){}
})();
