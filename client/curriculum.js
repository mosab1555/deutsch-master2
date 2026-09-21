/* Deutsch Master - Curriculum engine: A1→A2→B1→B2 progression (ADDITIVE ONLY).
   - Merges CURR_A2/B1/B2 data into VOCAB/GRAMMAR/SENTENCES/KAPITEL/EXPLAIN.
   - A2 loads eagerly; B1/B2 lazy-load on idle + on demand (perf-safe).
   - Level tabs for sentences, quiz level filter, dashboard level path,
     listening/speaking/talk/real/journey level sections, content audit.
   Uses the same showPage-wrap pattern as learn.js / study.js / play.js. */
"use strict";
(function(){
if(typeof window==="undefined")return;
window.Curriculum={loaded:{A1:true,A2:false,B1:false,B2:false},loading:{}};

var GRAM_ID={A2:42,B1:54,B2:66};
var POS_OF={"اسم":"Nomen","فعل":"Verb","صفة":"Adjektiv","ضمير":"Pronomen","أداة":"Funktionswort","مفردات":"Adverb"};

function esc(s){try{return escapeHtml(String(s==null?"":s));}catch(e){return String(s==null?"":s);}}
function speakOf(t){try{speak(t);}catch(e){try{speakGerman(t);}catch(x){}}}

function mergeLevelData(L){
  var D=window["CURR_"+L];if(!D||Curriculum.loaded[L])return 0;
  var added=0,skipped=0;
  try{
    (D.kapitel||[]).forEach(function(k){
      if(!KAPITEL.some(function(x){return x.id===k[0];}))KAPITEL.push({id:k[0],name:k[1],icon:k[2]});
    });
    (D.categories||[]).forEach(function(c){
      if(CATEGORIES.indexOf(c[0])<0)CATEGORIES.push(c[0]);
      try{if(!CAT_AR[c[0]])CAT_AR[c[0]]=c[1];}catch(e){}
    });
    var seen={};
    try{VOCAB.forEach(function(w){seen[w.de+"|"+w.art]=1;});}catch(e){}
    (D.words||[]).forEach(function(r,i){
      var key=r[0]+"|"+r[1];
      if(seen[key]){skipped++;return;}seen[key]=1;added++;
      VOCAB.push({id:"c"+L.toLowerCase()+"w"+(i+1),de:r[0],art:r[1],ar:r[2],en:r[3]||"",pron:r[4]||"",type:r[5],pos:POS_OF[r[5]]||"",cat:r[6],kap:r[7],level:L,plural:r[8]||"",ex:r[9]||"",exAr:r[10]||"",exEn:r[11]||"",img:""});
    });
    var g0=GRAM_ID[L]||100;
    (D.grammar||[]).forEach(function(g,i){
      var id="g"+(g0+i);
      if(GRAMMAR.some(function(x){return x.id===id;}))return;
      var n=g.length;
      var exes=g.slice(3,n-4).map(function(e){var p=String(e).split("|");return[p[0]||"",p[1]||""];});
      GRAMMAR.push({id:id,title:g[0],kap:g[1],body:g[2],ex:exes,level:L,
        quiz:{q:g[n-4],opts:String(g[n-3]).split("|"),correct:parseInt(g[n-2],10),explain:g[n-1]}});
      try{EXPLAIN_ORDER.push(id);}catch(e){}
    });
    try{if(D.explain)Object.keys(D.explain).forEach(function(k){EXPLAIN[k]=D.explain[k];});}catch(e){}
    (D.sentences||[]).forEach(function(s,i){
      SENTENCES.push({id:"cs"+L.toLowerCase()+(i+1),de:s[0],ar:s[1],pron:s[2]||"",kap:s[3],level:L});
    });
  }catch(e){if(window.console)console.error("curr merge",L,e);}
  Curriculum.loaded[L]=true;
  try{
    var fc=$("filterCategory");var fcv=fc?fc.value:"";
    if(typeof fillCategories==="function")fillCategories();
    if(fc)fc.value=fcv;
    if(typeof fillKapitels==="function")fillKapitels();
  }catch(e){}
  return added;
}
window.currMerge=mergeLevelData;

function loadScript(src,cb){
  var el=document.createElement("script");
  el.src=src;el.async=true;
  el.onload=function(){try{cb&&cb(null);}catch(e){}};
  el.onerror=function(){try{cb&&cb(new Error("load "+src));}catch(e){}};
  document.body.appendChild(el);
}
Curriculum.ensure=function(L,cb){
  if(L==="A1"||Curriculum.loaded[L]){cb&&cb();return;}
  if(Curriculum.loading[L]){var iv=setInterval(function(){if(Curriculum.loaded[L]){clearInterval(iv);cb&&cb();}},300);return;}
  Curriculum.loading[L]=1;
  try{toast("⏳ جاري تحميل محتوى "+L+" ...","ok");}catch(e){}
  loadScript("curr-"+L.toLowerCase()+".js",function(){
    var n=mergeLevelData(L);
    Curriculum.loading[L]=0;
    try{toast("✅ تم تحميل "+L+" ("+n+" كلمة جديدة)","ok");}catch(e){}
    try{if(typeof renderAll==="function")renderAll();}catch(e){}
    try{currRefreshHooks();}catch(e){}
    cb&&cb();
  });
};
function idlePreload(){
  var seq=["B1","B2"],i=0;
  function next(){
    if(i>=seq.length)return;
    var L=seq[i++];
    if(Curriculum.loaded[L]){next();return;}
    Curriculum.loading[L]=1;
    loadScript("curr-"+L.toLowerCase()+".js",function(){
      mergeLevelData(L);Curriculum.loading[L]=0;
      try{if(typeof renderAll==="function")renderAll();}catch(e){}
      try{currRefreshHooks();}catch(e){}
      setTimeout(next,800);
    });
  }
  try{
    if("requestIdleCallback" in window)requestIdleCallback(function(){setTimeout(next,500);},{timeout:8000});
    else setTimeout(next,2500);
  }catch(e){setTimeout(next,2500);}
}
function currRefreshHooks(){
  try{if(document.querySelector("#page-dashboard.active"))currRenderPath();}catch(e){}
  try{currApplySentFilter(false);}catch(e){}
}
window.currRefreshHooks=currRefreshHooks;

/* ---------- boot: merge A2 now, lazy B1/B2 ---------- */
try{mergeLevelData("A2");}catch(e){if(window.console)console.error(e);}
try{idlePreload();}catch(e){}

/* ================= SENTENCE LEVEL TABS ================= */
window.currSentLevel="all";
function currApplySentFilter(announce){
  try{
    var box=$("sentList");if(!box)return;
    var q=($("sentenceSearch").value||"").toLowerCase();
    var k=$("sentenceKapitel")?$("sentenceKapitel").value:"";
    var lv=window.currSentLevel||"all";
    if(lv!=="all"&&!Curriculum.loaded[lv]){Curriculum.ensure(lv,function(){currApplySentFilter(false);});return;}
    var list=SENTENCES.filter(function(s){
      if(lv!=="all"&&(s.level||"A1")!==lv)return false;
      if(k&&s.kap!==k)return false;
      if(q&&(s.de+" "+s.ar).toLowerCase().indexOf(q)<0)return false;
      return true;
    });
    box.innerHTML="";
    if(!list.length){box.innerHTML='<div class="panel glass">لا توجد جمل هنا بعد.</div>';return;}
    list.forEach(function(s,i){
      var d=document.createElement("div");d.className="sent-card glass";
      var pron=s.pron?'<div class="sent-pron">🔊 '+esc(s.pron)+'</div>':'';
      d.innerHTML='<div class="sent-num">'+(i+1)+'</div><div style="flex:1"><div class="sent-de">'+esc(s.de)+'</div><div class="sent-ar">'+esc(s.ar)+'</div>'+pron+'<div><span class="tag kap-tag">'+esc(kapName(s.kap))+'</span> <span class="tag">'+esc(s.level||"A1")+'</span></div></div><button class="icon-btn" title="استماع">🔊</button>';
      d.querySelector("button").addEventListener("click",function(){speakOf(s.de);try{markStudyDay();}catch(e){}});
      box.appendChild(d);
    });
  }catch(e){if(window.console)console.error(e);}
}
window.currApplySentFilter=currApplySentFilter;
function currWireSentTabs(){
  try{
    document.querySelectorAll(".level-tab").forEach(function(b){
      if(b.dataset.currWired)return;b.dataset.currWired="1";
      b.addEventListener("click",function(){
        var lv=b.getAttribute("data-level")||"all";
        document.querySelectorAll(".level-tab").forEach(function(x){x.classList.toggle("active",x===b);});
        window.currSentLevel=lv;
        if(lv!=="all"&&!Curriculum.loaded[lv]){Curriculum.ensure(lv,function(){currApplySentFilter(false);});return;}
        currApplySentFilter(false);
      });
    });
    ["sentenceSearch","sentenceKapitel"].forEach(function(id){
      var el=$(id);if(!el||el.dataset.currWired)return;el.dataset.currWired="1";
      el.addEventListener("input",function(){setTimeout(function(){currApplySentFilter(false);},60);});
      el.addEventListener("change",function(){setTimeout(function(){currApplySentFilter(false);},60);});
    });
  }catch(e){}
}

/* ================= QUIZ LEVEL FILTER ================= */
function currWireQuiz(){
  try{
    if(typeof buildQuestions==="function"&&!window._currBQ){
      window._currBQ=buildQuestions;
      buildQuestions=function(type,count,forced){
        try{
          var sel=$("quizLevel");var L=sel?sel.value:"";
          if(L&&L!=="mixed"&&!(forced&&forced.length)){
            var pool=allWords().filter(function(w){return(w.level||"A1")===L;});
            if(!pool.length&&!Curriculum.loaded[L]){Curriculum.ensure(L);throw 0;}
            if(pool.length){forced=pickWeighted(pool,Math.min(count||10,pool.length));}
          }
        }catch(e){}
        return window._currBQ(type,count,forced);
      };
    }
    var ql=$("quizLevel");
    if(ql&&!ql.dataset.currWired){ql.dataset.currWired="1";
      ql.addEventListener("change",function(){
        var L=ql.value;
        if(L&&L!=="mixed"&&!Curriculum.loaded[L])Curriculum.ensure(L);
      });
    }
    var fl=$("filterLevel");
    if(fl&&!fl.dataset.currWired){fl.dataset.currWired="1";
      fl.addEventListener("change",function(){
        var L=fl.value;
        if(L&&L!=="A1"&&!Curriculum.loaded[L])Curriculum.ensure(L);
      });
    }
  }catch(e){}
}
window.currWireSentTabs=currWireSentTabs;
window.currWireQuiz=currWireQuiz;
try{currWireSentTabs();}catch(e){}
try{currWireQuiz();}catch(e){}
})();
/* ================= PART 3: level path, page hooks, audit (ADDITIVE) ================= */
"use strict";
(function(){
if(typeof window==="undefined")return;
function esc(s){try{return escapeHtml(String(s==null?"":s));}catch(e){return String(s==null?"":s);}}
function lvlWords(L){try{return allWords().filter(function(w){return(w.level||"A1")===L;});}catch(e){return[];}}
function lvlKnown(L){try{return lvlWords(L).filter(function(w){return getStatus(w.id)==="known";}).length;}catch(e){return 0;}}
function lvlKap(L){try{return KAPITEL.filter(function(k){return(kapLevel(k.id)===L);});}catch(e){return[];}}
function kapLevel(kid){
  if(!kid||kid==="KX")return "A1";
  if(["K0","K1","K2","K3","K4","K5"].indexOf(kid)>=0)return "A1";
  if(["K6","K7","K8"].indexOf(kid)>=0)return "A2";
  if(["K9","K10","K11"].indexOf(kid)>=0)return "B1";
  return "B2";
}
window.kapLevel=kapLevel;
var LVL_META={A1:{ar:"الأساسيات",de:"Grundlagen"},A2:{ar:"الحياة اليومية",de:"Alltag"},B1:{ar:"الاستقلال",de:"Selbständigkeit"},B2:{ar:"الاحتراف",de:"Fortgeschritten"}};

function currRenderPath(){
  try{
    var host=$("dashLearn");if(!host)return;
    var old=$("dashLevels");if(old)old.remove();
    var d=document.createElement("div");d.id="dashLevels";d.className="panel glass";
    var order=["A1","A2","B1","B2"],prevDone=true;
    var h='<h3>🗺️ مسار المستويات A1 → B2</h3><div class="muted">تعلّم بالترتيب: أتقن مستوى ثم انتقل للتالي.</div><div class="grid-2">';
    order.forEach(function(L){
      var tot=lvlWords(L).length,kn=lvlKnown(L);
      var pct=tot?Math.round(kn/tot*100):0;
      var rec=prevDone&&pct<100;
      var badge=!Curriculum.loaded[L]?"⏳":"";
      h+='<div class="panel glass" style="margin:0"><div class="row-flex"><b>'+L+' '+(LVL_META[L]?LVL_META[L].ar:"")+'</b>'+(rec?'<span class="tag">⭐ تابع هنا</span>':'<span class="tag">'+pct+'%</span>')+'</div>'
        +'<div class="muted">'+kn+' / '+tot+' كلمة '+badge+'</div>'
        +'<div class="progress"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
        +'<div class="row-flex"><button class="btn btn-ghost sm" data-cgo="vocab" data-clvl="'+L+'">📚 كلمات '+L+'</button>'
        +'<button class="btn btn-ghost sm" data-cgo="quiz" data-clvl="'+L+'">📝 اختبار '+L+'</button></div></div>';
      if(pct<100)prevDone=false;
    });
    h+='</div>';
    d.innerHTML=h;
    host.insertBefore(d,host.firstChild);
    d.querySelectorAll("[data-cgo]").forEach(function(b){
      b.addEventListener("click",function(){
        var L=b.getAttribute("data-clvl"),go=b.getAttribute("data-cgo");
        function nav(){
          if(go==="vocab"){try{var fl=$("filterLevel");if(fl)fl.value=L;}catch(e){}}
          if(go==="quiz"){try{var ql=$("quizLevel");if(ql)ql.value=L;}catch(e){}}
          showPage(go);
          try{if(typeof renderAll==="function")renderAll();}catch(e){}
        }
        if(!Curriculum.loaded[L]&&L!=="A1")Curriculum.ensure(L,nav);else nav();
      });
    });
  }catch(e){if(window.console)console.error(e);}
}
window.currRenderPath=currRenderPath;

function listenBank(){var out=[];["A2","B1","B2"].forEach(function(L){var D=window["CURR_"+L];if(D&&D.listen)out=out.concat(D.listen);});return out;}
function speakBank(){var out=[];["A2","B1","B2"].forEach(function(L){var D=window["CURR_"+L];if(D&&D.speak)out=out.concat(D.speak);});return out;}
function realBank(){var out=[];["A2","B1","B2"].forEach(function(L){var D=window["CURR_"+L];if(D&&D.real)out=out.concat(D.real);});return out;}
function currSpeak(t){try{speak(t);}catch(e){try{speakGerman(t);}catch(x){}}}
function currRealSits(hostId,boxId,title,viewId){
  var items=realBank();if(!items.length)return;
  var host=$(hostId);if(!host||$(boxId))return;
  var d=document.createElement("div");d.id=boxId;d.className="panel glass";
  d.innerHTML='<h3>'+title+'</h3><div class="muted">عبارات + حوار لكل موقف — تزداد صعوبة مع المستوى.</div><div class="grid-2">'
    +items.map(function(s,i){return '<button class="quick-btn" data-ct="'+i+'">'+esc(s.title)+' <span class="tag">'+esc(s.level)+'</span></button>';}).join("")+'</div><div id="'+viewId+'"></div>';
  host.appendChild(d);
  d.querySelectorAll("[data-ct]").forEach(function(b){b.addEventListener("click",function(){
    var s=items[+b.getAttribute("data-ct")],v=document.getElementById(viewId);
    v.innerHTML='<div class="panel glass"><h4>'+esc(s.title)+' <span class="tag">'+esc(s.level)+'</span></h4>'
      +'<div class="muted">📌 عبارات مفيدة:</div>'+s.phrases.map(function(p){return '<div class="sent-de" dir="ltr" style="text-align:left">'+esc(p[0])+'</div><div class="sent-ar">'+esc(p[1])+'</div>';}).join("")
      +'<div class="muted">💬 الحوار:</div>'+s.dialogue.map(function(l){return '<div class="sent-de" dir="ltr" style="text-align:left">'+esc(l[0])+' <button class="mini-btn" data-spk1="'+esc(l[0])+'">🔊</button></div><div class="sent-ar">'+esc(l[1])+'</div>';}).join("")+'</div>';
    v.querySelectorAll("[data-spk1]").forEach(function(x){x.addEventListener("click",function(){currSpeak(x.getAttribute("data-spk1"));});});
    v.scrollIntoView({behavior:"smooth",block:"nearest"});
    try{markStudyDay();}catch(e){}
  });});
}

var CURR_HOOKS={
dashboard:function(){currRenderPath();},
listen:function(){
  var items=listenBank();if(!items.length)return;
  var host=$("liBox")||$("listenBox");if(!host||$("currListen"))return;
  var d=document.createElement("div");d.id="currListen";d.className="panel glass";
  d.innerHTML='<h3>🎧 استماع حسب المستوى (A2–B2)</h3><div class="muted">استمع 🔊 ثم أجب — النص يظهر بعد المحاولة.</div>'
    +items.map(function(it,i){
      return '<div class="panel glass" style="margin:8px 0"><b>'+esc(it.title)+'</b> <span class="tag">'+esc(it.level)+'</span> <span class="tag kap-tag">'+esc(it.kap||"")+'</span>'
      +'<div class="row-flex"><button class="btn btn-gold sm" data-li="'+i+'">🔊 استمع</button><button class="btn btn-ghost sm" data-lt="'+i+'">📄 النص</button></div>'
      +'<div class="hidden" data-lx="'+i+'">'+it.lines.map(function(l){return '<div class="sent-de" dir="ltr" style="text-align:left">'+esc(l[0])+'</div><div class="sent-ar">'+esc(l[1])+'</div>';}).join("")+'</div>'
      +'<div data-lq="'+i+'">'+it.qs.map(function(q,qi){return '<div style="margin-top:6px"><b>'+esc(q.q)+'</b><div class="quiz-opts">'+q.opts.map(function(o,oi){return '<button class="quiz-opt" data-q="'+i+'" data-qi="'+qi+'" data-oi="'+oi+'">'+esc(o)+'</button>';}).join("")+'</div></div>';}).join("")+'</div></div>';
    }).join("");
  host.appendChild(d);
  d.querySelectorAll("[data-li]").forEach(function(b){b.addEventListener("click",function(){var it=items[+b.getAttribute("data-li")];currSpeak(it.lines.map(function(l){return l[0];}).join(" "));});});
  d.querySelectorAll("[data-lt]").forEach(function(b){b.addEventListener("click",function(){var x=d.querySelector('[data-lx="'+b.getAttribute("data-lt")+'"]');if(x)x.classList.toggle("hidden");});});
  d.querySelectorAll(".quiz-opt[data-q]").forEach(function(b){b.addEventListener("click",function(){
    var it=items[+b.getAttribute("data-q")],q=it.qs[+b.getAttribute("data-qi")],oi=+b.getAttribute("data-oi");
    var sib=d.querySelectorAll('.quiz-opt[data-q="'+b.getAttribute("data-q")+'"][data-qi="'+b.getAttribute("data-qi")+'"]');
    sib.forEach(function(x){x.disabled=true;});
    if(oi===q.correct){b.classList.add("correct");toast("صحيح ✅","ok");}
    else{b.classList.add("wrong");sib[q.correct].classList.add("correct");toast("خطأ ❌","err");}
    try{markStudyDay();}catch(e){}
  });});
},
speak:function(){
  var items=speakBank();if(!items.length)return;
  var host=$("spBox")||$("speakBox");if(!host||$("currSpeak"))return;
  var d=document.createElement("div");d.id="currSpeak";d.className="panel glass";
  d.innerHTML='<h3>🎤 تحدّث حسب المستوى (A2–B2)</h3><div class="muted">حاول بنفسك أولًا — النموذج مخفي حتى تطلب عرضه.</div>'
    +items.map(function(it,i){
      return '<div class="panel glass" style="margin:8px 0"><b>'+esc(it.topic)+'</b> <span class="tag">'+esc(it.level)+'</span>'
      +'<div class="sent-ar">'+esc(it.ar)+'</div><div class="muted">ابدأ بـ: '+it.hints.map(esc).join(" • ")+'</div>'
      +'<div class="row-flex"><button class="btn btn-gold sm" data-sh="'+i+'">👁 عرض النموذج</button><button class="btn btn-ghost sm" data-ss="'+i+'">🔊 اسمع النموذج</button></div>'
      +'<div class="hidden" data-sa="'+i+'"><div class="sent-de" dir="ltr" style="text-align:left">'+esc(it.de)+'</div></div></div>';
    }).join("");
  host.appendChild(d);
  d.querySelectorAll("[data-sh]").forEach(function(b){b.addEventListener("click",function(){var x=d.querySelector('[data-sa="'+b.getAttribute("data-sh")+'"]');if(x)x.classList.toggle("hidden");});});
  d.querySelectorAll("[data-ss]").forEach(function(b){b.addEventListener("click",function(){currSpeak(items[+b.getAttribute("data-ss")].de);});});
},
talk:function(){currRealSits("talkBox","currTalk","💬 مواقف إضافية (A2–B2)","currTalkView");},
real:function(){currRealSits("realBox","currReal","🌍 مواقف حقيقية (A2–B2)","currRealView");},
journey:function(){
  var host=$("journeyBox");if(!host||$("currJourney"))return;
  var order=["A1","A2","B1","B2"];
  var d=document.createElement("div");d.id="currJourney";d.className="panel glass";
  var h='<h3>🗺️ رحلة المستويات A1 → B2</h3>';
  order.forEach(function(L){
    var tot=lvlWords(L).length,kn=lvlKnown(L);
    var pct=tot?Math.round(kn/tot*100):0;
    var gram=0;try{gram=GRAMMAR.filter(function(g){return(g.level||"A1")===L;}).length;}catch(e){}
    h+='<div style="margin:8px 0"><div class="row-flex"><b>'+L+'</b><span class="muted">'+kn+'/'+tot+' كلمة • '+gram+' قاعدة</span><b>'+pct+'%</b></div><div class="progress"><div class="progress-fill" style="width:'+pct+'%"></div></div></div>';
  });
  d.innerHTML=h;host.appendChild(d);
},
roadmap:function(){
  var host=$("roadmapBox");if(!host||$("currRoad"))return;
  var d=document.createElement("div");d.id="currRoad";d.className="panel glass";
  var h='<h3>🗺️ خارطة A2–B2</h3><div class="muted">كل مستوى: كلمات + قواعد + استماع + تحدّث + اختبار.</div>';
  ["A2","B1","B2"].forEach(function(L){
    var tot=lvlWords(L).length,kn=lvlKnown(L);
    var gram=0;try{gram=GRAMMAR.filter(function(g){return(g.level||"A1")===L;}).length;}catch(e){}
    var sent=0;try{sent=SENTENCES.filter(function(s){return(s.level||"A1")===L;}).length;}catch(e){}
    var ok=tot>0&&kn>=Math.min(tot,20);
    h+='<div class="panel glass" style="margin:8px 0"><b>'+(ok?"✅":"🔒")+' مستوى '+L+'</b><div class="muted">'+kn+'/'+tot+' كلمة • '+gram+' قاعدة • '+sent+' جملة • استماع وتحدّث ومواقف</div></div>';
  });
  d.innerHTML=h;host.appendChild(d);
}
};

/* ---------- showPage wrap (same pattern as other modules) ---------- */
try{
  var _currSP=showPage;
  showPage=function(n){_currSP(n);try{if(CURR_HOOKS[n])CURR_HOOKS[n]();}catch(e){if(window.console)console.error(e);}};
}catch(e){}

/* ================= CONTENT AUDIT ================= */
window.CurrAudit=function(){
  var rep={dupWords:[],dupExamples:[],missingEn:0,missingEx:0,missingPlural:0,missingPron:0,badLevel:[],badKap:[],gramIssues:[],empty:0,words:0,grammar:0,sentences:0};
  try{
    var seen={},exSeen={};
    allWords().forEach(function(w){
      rep.words++;
      var k=(w.de+"|"+w.art).toLowerCase();
      if(seen[k])rep.dupWords.push(w.de+" ["+(w.level||"?")+"]");else seen[k]=1;
      if(!w.ar||!w.de)rep.empty++;
      var isCurr=(w.level||"A1")!=="A1";
      if(isCurr&&!w.en)rep.missingEn++;
      if(isCurr&&!w.ex)rep.missingEx++;
      if(isCurr&&!w.pron)rep.missingPron++;
      if(isCurr&&w.type==="اسم"&&w.art!=="-"&&!w.plural)rep.missingPlural++;
      if(["A1","A2","B1","B2"].indexOf(w.level||"A1")<0)rep.badLevel.push(w.de);
      if(w.kap&&!KAPITEL.some(function(x){return x.id===w.kap;}))rep.badKap.push(w.de+"@"+w.kap);
      if(w.ex){var ek=w.ex.toLowerCase();if(exSeen[ek])rep.dupExamples.push(w.ex.slice(0,40));else exSeen[ek]=1;}
    });
    GRAMMAR.forEach(function(g){
      rep.grammar++;
      if(!g.body||!g.ex||!g.ex.length||!g.quiz)rep.gramIssues.push(g.id+": incomplete");
      if(g.quiz&&(g.quiz.correct<0||g.quiz.correct>=g.quiz.opts.length))rep.gramIssues.push(g.id+": bad quiz index");
    });
    rep.sentences=SENTENCES.length;
  }catch(e){rep.error=String(e);}
  return rep;
};
})();

