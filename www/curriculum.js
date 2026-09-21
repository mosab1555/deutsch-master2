/* Deutsch Master - Curriculum engine: A1→A2→B1→B2 progression (ADDITIVE ONLY).
   - Merges CURR_A2/B1/B2 data into VOCAB/GRAMMAR/SENTENCES/KAPITEL/EXPLAIN.
   - A2 loads eagerly; B1/B2 lazy-load on idle + on demand (perf-safe).
   - Level tabs for sentences, quiz level filter, dashboard level path,
     listening/speaking/talk/real/journey level sections, content audit.
   Uses the same showPage-wrap pattern as learn.js / study.js / play.js. */
"use strict";
(function(){
if(typeof window==="undefined")return;
window.Curriculum={loaded:{A1:true,A2:false,B1:false,B2:false},loading:{},ds:{}};
/* dataset key -> file; base datasets keep FIXED grammar ids, extras use dynamic ids */
var DS_FILE={A2:"curr-a2.js",B1:"curr-b1.js",B2:"curr-b2.js",A1X:"curr-a1x.js",A2B:"curr-a2b.js",B1B:"curr-b1b.js",B2B:"curr-b2b.js"};
var DS_LEVEL={A2:"A2",B1:"B1",B2:"B2",A1X:"A1",A2B:"A2",B1B:"B1",B2B:"B2"};
var GRAM_FIXED={A2:42,B1:54,B2:66};
var LVL_DS={A1:["A1X"],A2:["A2","A2B"],B1:["B1","B1B"],B2:["B2","B2B"]};
var POS_OF={"اسم":"Nomen","فعل":"Verb","صفة":"Adjektiv","ضمير":"Pronomen","أداة":"Funktionswort","مفردات":"Adverb"};
window.CURR_READING=window.CURR_READING||[];
var currFillsDone={},fillSeq=1;
function shuffle4(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
/* Generate SENT_FILL gap questions from curriculum words+rules (article/verb/meaning).
   Runs once per dataset; dedups against existing bank. */
function currBuildFills(dsKey){
  try{
    if(currFillsDone[dsKey])return;currFillsDone[dsKey]=1;
    if(typeof SENT_FILL==="undefined"||!SENT_FILL)return;
    var D=window["CURR_"+dsKey];if(!D)return;
    var L=D.level||DS_LEVEL[dsKey]||"A1";
    var seenS={};
    SENT_FILL.forEach(function(f){seenS[f.s]=1;});
    function kapN(k){try{return kapName(k);}catch(e){return k;}}
    function push(chap,s,o,c,why,typ,gram){
      if(!s||!o||o.length<3||seenS[s])return;
      seenS[s]=1;
      SENT_FILL.push({id:"cf"+(fillSeq++),s:s,o:o.slice(0,4),c:Math.max(0,Math.min(3,c)),why:why||"",lvl:L,pos:"mid",typ:typ||"meaning",ctx:"curr",start:s.split(" ")[0],w:"",chapterId:chap,chapterName:kapN(chap),chapterSrc:"curr",lessonId:null,lessonName:"Curriculum "+L,structureType:"gap",subjectType:"-",grammarTarget:gram||typ||"vocab",sentenceStarter:s.split(" ")[0],answerType:typ||"meaning",blankPosition:"mid"});
    }
    function artGap(ex,art,de,ar,chap,gram){
      var needle=art+" "+de;
      var at=ex.indexOf(needle);if(at<0)return false;
      var opts=shuffle4(["der","die","das"]);
      push(chap,ex.slice(0,at)+"___ "+de+ex.slice(at+needle.length),opts,opts.indexOf(art),ar+" — اختر الأداة","article",gram||"article");
      return true;
    }
    function verbGap(ex,inf,ar,chap,gram){
      var conj=null;
      try{if(typeof conjugateVerb==="function")conj=conjugateVerb(inf);}catch(e){}
      if(!conj)return false;
      var subs=[["Ich","ich"],["Du","du"],["Er","er"],["Sie","er"],["Wir","wir"],["Ihr","ihr"]];
      for(var i=0;i<subs.length;i++){
        var sub=subs[i][0],key=subs[i][1],form=conj[key];
        if(!form)continue;
        var head=sub+" ";
        if(ex.indexOf(head)===0){
          var rest=ex.slice(head.length);
          var frest=form.split(" ");var fverb=frest[frest.length-1];
          if(rest.indexOf(fverb)!==0)continue;
          var tail=rest.slice(fverb.length);
          var pool=[conj.ich,conj.du,conj.er,conj.wir].map(function(f){return f.split(" ").pop();});
          var uniq=[];pool.forEach(function(p){if(uniq.indexOf(p)<0)uniq.push(p);});
          while(uniq.length<4)uniq.push(inf);
          var opts=shuffle4(uniq.slice(0,4));
          push(chap,sub+" ___"+tail,opts,opts.indexOf(fverb),ar+" — صرف الفعل","verb",gram||"conjugation");
          return true;
        }
      }
      return false;
    }
    var sameType={};
    try{
      VOCAB.forEach(function(w){if((w.level||"A1")!==L)return;var k=w.type||"مفردات";(sameType[k]=sameType[k]||[]).push(w);});
    }catch(e){}
    function meanGap(ex,targetW,ar,chap,gram){
      var words=ex.replace(/[.?!,]/g,"").split(" ").filter(Boolean);
      if(words.length<4)return false;
      var cand=words.filter(function(t){return t.length>3&&t!==targetW;});
      if(!cand.length)return false;
      var pick=cand[Math.floor(cand.length/2)];
      var pool=(sameType[targetW.type]||[]).filter(function(w){return w.de!==pick&&w.de.length>3;});
      if(pool.length<3)return false;
      var opts=shuffle4([pick,pool[0].de,pool[1].de,pool[2].de]);
      push(chap,ex.split(pick).join("___"),opts,opts.indexOf(pick),ar+" — الكلمة في السياق","meaning",gram||"vocab");
      return true;
    }
    (D.words||[]).forEach(function(r){
      var de=r[0],art=r[1],ar=r[2],type=r[5],chap=r[7],ex=r[9]||"";
      if(!ex||ex.split(" ").length<3)return;
      if(type==="اسم"&&art!=="-"){if(artGap(ex,art,de,ar,chap))return;}
      if(type==="فعل"){if(verbGap(ex,de,ar,chap))return;}
      meanGap(ex,{de:de,type:type},ar,chap);
    });
    (D.grammar||[]).forEach(function(g){
      var n=g.length,chap=g[1],done=0;
      g.slice(3,n-4).forEach(function(e){
        if(done>=2)return;
        var p=String(e).split("|"),dex=p[0]||"",arx=p[1]||"";
        if(!dex||dex.split(" ").length<3)return;
        var m=dex.match(/^(der|die|das) (\S+)/);
        if(m&&artGap(dex,m[1],m[2],arx,chap,g[0])){done++;return;}
        var v=dex.match(/^(Ich|Du|Er|Sie|Wir|Ihr) (\S+)/);
        if(v){
          var cand=null;
          try{VOCAB.forEach(function(w){if(w.type==="فعل"&&dex.indexOf(" ")>=0)cand=cand;});}catch(e2){}
          var inf=(v[2].replace(/(e|st|t|en)$/,"")||"").toLowerCase();
          var hit=null;
          try{
            VOCAB.forEach(function(w){
              if(w.type!=="فعل"||hit)return;
              var stem=w.de.replace(/en$/,"").toLowerCase();
              if(stem&&inf.indexOf(stem)===0)hit=w.de;
            });
          }catch(e3){}
          if(hit&&verbGap(dex,hit,arx,chap,g[0])){done++;return;}
        }
        if(meanGap(dex,{de:"",type:"مفردات"},arx,chap,g[0]))done++;
      });
    });
  }catch(e){if(window.console)console.error("fills",e);}
}
window.currBuildFills=currBuildFills;

function esc(s){try{return escapeHtml(String(s==null?"":s));}catch(e){return String(s==null?"":s);}}
function speakOf(t){try{speak(t);}catch(e){try{speakGerman(t);}catch(x){}}}
function nextGramId(){
  var mx=0;
  try{GRAMMAR.forEach(function(g){var n=parseInt(String(g.id||"").replace("g",""),10);if(n>mx)mx=n;});}catch(e){}
  return mx+1;
}

function mergeDataset(key){
  var D=window["CURR_"+key];if(!D)return 0;
  if(Curriculum.ds[key])return 0;
  var L=D.level||DS_LEVEL[key]||"A1";
  var added=0;
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
      var kk=r[0]+"|"+r[1];
      if(seen[kk])return;seen[kk]=1;added++;
      VOCAB.push({id:"c"+key.toLowerCase()+"w"+(i+1),de:r[0],art:r[1],ar:r[2],en:r[3]||"",pron:r[4]||"",type:r[5],pos:POS_OF[r[5]]||"",cat:r[6],kap:r[7],level:L,plural:r[8]||"",ex:r[9]||"",exAr:r[10]||"",exEn:r[11]||"",img:""});
    });
    var assigned=[];
    (D.grammar||[]).forEach(function(g,i){
      var id,base=GRAM_FIXED[key];
      if(base!=null){id="g"+(base+i);}
      else{id="g"+nextGramId();}
      if(GRAMMAR.some(function(x){return x.id===id;}))return;
      var n=g.length;
      var exes=g.slice(3,n-4).map(function(e){var p=String(e).split("|");return[p[0]||"",p[1]||""];});
      GRAMMAR.push({id:id,title:g[0],kap:g[1],body:g[2],ex:exes,level:L,
        quiz:{q:g[n-4],opts:String(g[n-3]).split("|"),correct:parseInt(g[n-2],10),explain:g[n-1]}});
      try{EXPLAIN_ORDER.push(id);}catch(e){}
      assigned.push(id);
    });
    try{
      if(D.explain)Object.keys(D.explain).forEach(function(k){
        if(/^gx\d+$/.test(k)){
          var idx=parseInt(k.slice(2),10);
          if(assigned[idx])EXPLAIN[assigned[idx]]=D.explain[k];
        }else{EXPLAIN[k]=D.explain[k];}
      });
    }catch(e){}
    (D.sentences||[]).forEach(function(s,i){
      SENTENCES.push({id:"cs"+key.toLowerCase()+(i+1),de:s[0],ar:s[1],pron:s[2]||"",kap:s[3],level:L});
    });
    (D.reading||[]).forEach(function(r,i){
      try{CURR_READING.push({id:"cr"+key.toLowerCase()+(i+1),level:L,kap:r.kap||"",title:r.title,de:r.de,ar:r.ar,qs:r.qs||[]});}catch(e){}
    });
    try{currBuildFills(key);}catch(e){}
  }catch(e){if(window.console)console.error("curr merge",key,e);}
  Curriculum.ds[key]=true;
  if(key==="A2"||key==="B1"||key==="B2")Curriculum.loaded[DS_LEVEL[key]]=true;
  try{
    var fc=$("filterCategory");var fcv=fc?fc.value:"";
    if(typeof fillCategories==="function")fillCategories();
    if(fc)fc.value=fcv;
    if(typeof fillKapitels==="function")fillKapitels();
  }catch(e){}
  return added;
}
function mergeLevelData(L){return mergeDataset(L);}
window.currMerge=mergeLevelData;
window.currMergeDs=mergeDataset;

function loadScript(src,cb){
  var el=document.createElement("script");
  el.src=src;el.async=true;
  el.onload=function(){try{cb&&cb(null);}catch(e){}};
  el.onerror=function(){try{cb&&cb(new Error("load "+src));}catch(e){}};
  document.body.appendChild(el);
}
function afterMergeRefresh(){
  try{if(typeof renderAll==="function")renderAll();}catch(e){}
  try{currRefreshHooks();}catch(e){}
}
/* ensure a whole LEVEL (base + extras, in file order) */
Curriculum.ensure=function(L,cb){
  if(L==="A1"){Curriculum.ensureDs("A1X",cb);return;}
  var chain=(LVL_DS[L]||[]).slice(),total=0;
  function step(){
    if(!chain.length){
      try{if(total)toast("✅ تم تحميل "+L+" ("+total+" كلمة جديدة)","ok");}catch(e){}
      afterMergeRefresh();cb&&cb();return;
    }
    Curriculum.ensureDs(chain.shift(),function(n){total+=n||0;step();});
  }
  var need=chain.some(function(k){return !Curriculum.ds[k];});
  if(!need){cb&&cb();return;}
  try{toast("⏳ جاري تحميل محتوى "+L+" ...","ok");}catch(e){}
  step();
};
var DS_DYNAMIC={A1X:1,A2B:1,B1B:1,B2B:1};
/* dynamic datasets must merge AFTER all fixed-id bases (A2/B1/B2) */
Curriculum.ensureDs=function(key,cb){
  if(Curriculum.ds[key]){cb&&cb(0);return;}
  if(DS_DYNAMIC[key]){
    var bases=["A2","B1","B2"].filter(function(b){return !Curriculum.ds[b];});
    if(bases.length){
      var b0=bases.shift();
      Curriculum.ensureDs(b0,function(){Curriculum.ensureDs(key,cb);});
      return;
    }
  }
  if(Curriculum.loading[key]){var iv=setInterval(function(){if(Curriculum.ds[key]){clearInterval(iv);cb&&cb(0);}},300);return;}
  Curriculum.loading[key]=1;
  loadScript(DS_FILE[key],function(){
    var n=mergeDataset(key);
    Curriculum.loading[key]=0;
    afterMergeRefresh();
    cb&&cb(n);
  });
};
function idlePreload(){
  var seq=["B1","B2","B1B","B2B","A1X","A2B"],i=0;
  function next(){
    if(i>=seq.length){afterMergeRefresh();return;}
    var k=seq[i++];
    if(Curriculum.ds[k]){next();return;}
    Curriculum.loading[k]=1;
    loadScript(DS_FILE[k],function(){
      mergeDataset(k);Curriculum.loading[k]=0;
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
          if(!L||L==="mixed")L="mixed";
          if((type==="grammar"||type==="reading")&&!(forced&&forced.length)){
            var lvls=L==="mixed"?["A1","A2","B1","B2"]:[L];
            var out=[];
            lvls.forEach(function(lv){
              var n=Math.ceil((count||10)/lvls.length);
              var part=(type==="grammar")?currGrammarQuizQs(lv,n):currReadingQuizQs(lv,n);
              part.forEach(function(q){out.push(q);});
            });
            if(out.length)return out.slice(0,count||10);
            var fb=allWords().filter(function(w){return L==="mixed"||(w.level||"A1")===L;});
            if(fb.length)forced=pickWeighted(fb,count||10);
          }
          else if(L&&L!=="mixed"&&!(forced&&forced.length)){
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
/* ================= PART 4: universal level selectors + rule/reading engines ================= */
"use strict";
(function(){
if(typeof window==="undefined")return;
function esc(s){try{return escapeHtml(String(s==null?"":s));}catch(e){return String(s==null?"":s);}}
window.currGameLevel="mixed";
window.currReviewLevel="all";
window.currMistLevel="all";
window.currGramLevel="all";
window.currTutorLevel="mixed";
window.currStoryLevel="all";
/* Reusable level bar: A1 A2 B1 B2 mixed — compact, wraps on mobile, existing classes only */
window.currLevelBar=function(cur,onpick,extra){
  var lvls=[["A1","A1"],["A2","A2"],["B1","B1"],["B2","B2"],["mixed","🎲 مختلط"]];
  if(extra&&extra.allFirst)lvls=[["all","الكل"]].concat(lvls.filter(function(l){return l[0]!=="mixed";}));
  var d=document.createElement("div");
  d.className="row-flex";d.style.cssText="flex-wrap:wrap;gap:6px;margin:8px 0";
  d.innerHTML='<span class="muted">المستوى:</span>'+lvls.map(function(l){
    return '<button class="btn btn-ghost sm" data-clvl="'+l[0]+'" style="'+(cur===l[0]?"border-color:var(--gold);font-weight:800":"")+'">'+l[1]+'</button>';
  }).join("");
  d.querySelectorAll("[data-clvl]").forEach(function(b){
    b.addEventListener("click",function(){onpick(b.getAttribute("data-clvl"));});
  });
  return d;
};
function needLevel(L,cb){
  if(L==="A1"||L==="all"||L==="mixed"||Curriculum.loaded[L]){cb&&cb();return;}
  Curriculum.ensure(L,function(){cb&&cb();});
}
function kapInLevel(kid,L){
  if(L==="all"||L==="mixed")return true;
  return window.kapLevel(kid)===L;
}
/* ---- GRAMMAR page: level bar + DOM-hide filter + kapitel cascade ---- */
function currGrammarFilter(){
  try{
    var list=document.querySelectorAll("#grammarList .grammar-card");
    var L=window.currGramLevel||"all";
    var shown=0;
    list.forEach(function(card){
      var tag=card.querySelector(".kap-tag");
      var kap=tag?tag.textContent.trim():"";
      var m=kap.match(/K\d+|KX/);
      var kid=m?m[0]:"";
      var ok=!kid||kapInLevel(kid,L==="mixed"?"all":L);
      card.style.display=ok?"":"none";
      if(ok)shown++;
    });
    var box=$("grammarList");
    var empty=$("currGramEmpty");
    if(!shown){
      if(!empty){empty=document.createElement("div");empty.id="currGramEmpty";empty.className="panel glass";empty.textContent="لا توجد قواعد هنا بعد — اختر مستوى آخر.";box.appendChild(empty);}
      empty.style.display="";
    }else if(empty){empty.style.display="none";}
    try{if(window.currGrantDrills)window.currGrantDrills();}catch(e2){}
  }catch(e){}
}
window.currGrammarFilter=currGrammarFilter;
function currCascadeKapitel(selId,L){
  try{
    var sel=$(selId);if(!sel)return;
    var cur=sel.value;
    Array.from(sel.options).forEach(function(o){
      if(!o.value){o.style.display="";return;}
      o.style.display=kapInLevel(o.value,L)?"":"none";
    });
    if(cur&&sel.querySelector('option[value="'+cur+'"]')&&sel.querySelector('option[value="'+cur+'"]').style.display==="none")sel.value="";
  }catch(e){}
}
function currGramPick(L){
  window.currGramLevel=L;
  needLevel(L,function(){
    currCascadeKapitel("grammarKapitel",L==="mixed"?"all":L);
    currGrammarFilter();
    var nb=$("currGramBar");
    if(nb){nb.innerHTML="";nb.appendChild(currLevelBar(L,currGramPick));}
  });
}
function currHookGrammar(){
  try{
    var head=document.querySelector("#page-grammar .page-head");
    if(head&&!$("currGramBar")){
      var bar=document.createElement("div");bar.id="currGramBar";
      bar.appendChild(currLevelBar(window.currGramLevel||"all",currGramPick,{allFirst:true}));
      head.appendChild(bar);
    }
    var gk=$("grammarKapitel");
    if(gk&&!gk.dataset.currLv){gk.dataset.currLv="1";
      gk.addEventListener("change",function(){setTimeout(currGrammarFilter,60);});
    }
    currGrammarFilter();
  }catch(e){}
}
/* ---- VOCAB: add مختلط option + kapitel cascade on level change ---- */
function currHookVocab(){
  try{
    var fl=$("filterLevel");
    if(fl&&!fl.querySelector('option[value="mixed"]')){
      var o=document.createElement("option");o.value="mixed";o.textContent="🎲 مختلط (الكل)";
      fl.appendChild(o);
    }
    if(fl&&!fl.dataset.currMx){fl.dataset.currMx="1";
      fl.addEventListener("change",function(){
        var L=fl.value;
        if(L==="mixed"){fl.value="";}
        if(L&&L!=="mixed"&&!Curriculum.loaded[L])Curriculum.ensure(L);
        setTimeout(function(){currCascadeKapitel("filterKapitel",(!L||L==="mixed")?"all":L);},60);
      });
    }
  }catch(e){}
}
/* ---- GAMES: level bar + pool filter via kapWords/kapSents wrap ---- */
function currLevelPool(list){
  var L=window.currGameLevel||"mixed";
  if(L==="mixed")return list;
  if(!Curriculum.loaded[L])return list;
  var f=list.filter(function(w){return((w.level||w.lvl||"A1")===L)||((w.kap||w.chapterId)&&window.kapLevel(w.kap||w.chapterId)===L);});
  return f.length>=3?f:list;
}
function currHookGames(){
  try{
    if(typeof kapWords==="function"&&!window._currKW){
      window._currKW=kapWords;
      kapWords=function(){return currLevelPool(window._currKW());};
    }
    if(typeof kapSents==="function"&&!window._currKS){
      window._currKS=kapSents;
      kapSents=function(){return currLevelPool(window._currKS());};
    }
    var box=$("gamesBox");if(!box||$("currGameBar"))return;
    var bar=document.createElement("div");bar.id="currGameBar";bar.className="panel glass";
    bar.innerHTML='<h3 style="margin:0 0 4px">🎮 اختر المستوى أولًا</h3>';
    bar.appendChild(currLevelBar(window.currGameLevel,function(L){
      window.currGameLevel=L;
      needLevel(L==="mixed"?"A1":L,function(){
        try{if(typeof renderGames==="function")renderGames();}catch(e){}
        currHookGames();
        try{toast(L==="mixed"?"🎲 كل المستويات":"🎮 مستوى "+L,"ok");}catch(e2){}
      });
    }));
    box.insertBefore(bar,box.firstChild);
  }catch(e){}
}
/* ---- REVIEW + SRS + MISTAKES: level-respecting wraps ---- */
function currHookReview(){
  try{
    if(typeof dueWords==="function"&&!window._currDW){
      window._currDW=dueWords;
      dueWords=function(){
        var list=window._currDW();
        var L=window.currReviewLevel||"all";
        if(L==="all")return list;
        var f=list.filter(function(w){return(w.level||"A1")===L;});
        return f.length?f:list;
      };
    }
    if(typeof srsDue==="function"&&!window._currSD){
      window._currSD=srsDue;
      srsDue=function(){
        var list=window._currSD();
        var L=window.currReviewLevel||"all";
        if(L==="all")return list;
        var f=list.filter(function(w){return(w.level||"A1")===L;});
        return f.length?f:list;
      };
    }
    var head=document.querySelector("#page-review .page-head");
    if(head&&!$("currRevBar")){
      var bar=document.createElement("div");bar.id="currRevBar";
      bar.appendChild(currLevelBar("all",function(L){
        window.currReviewLevel=L;
        needLevel(L,function(){
          try{if(typeof renderAll==="function")renderAll();}catch(e){}
          try{var rs=$("reviewSession");if(rs)rs.classList.add("hidden");}catch(e2){}
        });
      }, {allFirst:true}));
      head.appendChild(bar);
    }
  }catch(e){}
}
function currHookMistakes(){
  try{
    var row=document.querySelector("#page-mistakes .row-flex");
    if(row&&!$("mistLevel")){
      var sel=document.createElement("select");sel.id="mistLevel";
      sel.innerHTML='<option value="all">كل المستويات</option><option value="A1">A1</option><option value="A2">A2</option><option value="B1">B1</option><option value="B2">B2</option>';
      sel.addEventListener("change",function(){
        window.currMistLevel=sel.value;
        needLevel(sel.value,function(){
          try{if(typeof renderMistakes==="function")renderMistakes();}catch(e){}
          currMistFilter();
        });
      });
      row.insertBefore(sel,row.firstChild);
    }
    currMistFilter();
  }catch(e){}
}
function currMistFilter(){
  try{
    var L=window.currMistLevel||"all";
    if(L==="all")return;
    var kf=$("mistKapitel")?$("mistKapitel").value:"";
    var ids=Object.keys(S.mistakes||{}).sort(function(a,b){return S.mistakes[b].n-S.mistakes[a].n;});
    if(kf)ids=ids.filter(function(id){var w=wordById(id);return w&&w.kap===kf;});
    ids=ids.slice(0,60);
    var cards=document.querySelectorAll("#mistGrid .mist-card");
    cards.forEach(function(card,i){
      var w=wordById(ids[i]);
      card.style.display=(w&&(w.level||"A1")===L)?"":"none";
    });
  }catch(e){}
}
/* ---- STORIES/READING: graded texts with level bar ---- */
function currHookStories(){
  try{
    var host=$("storiesBox");if(!host||$("currRead"))return;
    var items=window.CURR_READING||[];
    if(!items.length)return;
    var d=document.createElement("div");d.id="currRead";d.className="panel glass";
    function render(){
      var L=window.currStoryLevel||"all";
      var list=items.filter(function(r){return L==="all"||L==="mixed"?true:r.level===L;});
      d.innerHTML='<h3>📖 نصوص القراءة المتدرجة</h3><div class="muted">اقرأ النص ثم أجب — الترجمة مخفية حتى تحاول.</div><div id="currReadBar"></div>'
        +list.map(function(r,i){
          return '<div class="panel glass" style="margin:8px 0"><b>'+esc(r.title)+'</b> <span class="tag">'+esc(r.level)+'</span>'
          +'<div class="sent-de" dir="ltr" style="text-align:left;white-space:pre-line">'+esc(r.de)+'</div>'
          +'<div class="row-flex"><button class="btn btn-gold sm" data-rs="'+i+'">🔊 استمع</button><button class="btn btn-ghost sm" data-ra="'+i+'">🌐 الترجمة</button></div>'
          +'<div class="hidden" data-rx="'+i+'"><div class="sent-ar" style="white-space:pre-line">'+esc(r.ar)+'</div></div>'
          +'<div>'+r.qs.map(function(q,qi){return '<div style="margin-top:6px"><b>'+esc(q.q)+'</b><div class="quiz-opts">'+q.opts.map(function(o,oi){return '<button class="quiz-opt" data-r="'+i+'" data-rq="'+qi+'" data-ro="'+oi+'">'+esc(o)+'</button>';}).join("")+'</div></div>';}).join("")+'</div></div>';
        }).join("");
      d.querySelector("#currReadBar").appendChild(currLevelBar(L,function(NL){
        window.currStoryLevel=NL;
        needLevel(NL,function(){render();});
      }, {allFirst:true}));
      d.querySelectorAll("[data-rs]").forEach(function(b){b.addEventListener("click",function(){var r=list[+b.getAttribute("data-rs")];try{speak(r.de);}catch(e){try{speakGerman(r.de);}catch(x){}}});});
      d.querySelectorAll("[data-ra]").forEach(function(b){b.addEventListener("click",function(){var x=d.querySelector('[data-rx="'+b.getAttribute("data-ra")+'"]');if(x)x.classList.toggle("hidden");});});
      d.querySelectorAll(".quiz-opt[data-r]").forEach(function(b){b.addEventListener("click",function(){
        var r=list[+b.getAttribute("data-r")],q=r.qs[+b.getAttribute("data-rq")],oi=+b.getAttribute("data-ro");
        var sib=d.querySelectorAll('.quiz-opt[data-r="'+b.getAttribute("data-r")+'"][data-rq="'+b.getAttribute("data-rq")+'"]');
        sib.forEach(function(x){x.disabled=true;});
        if(oi===q.correct){b.classList.add("correct");toast("صحيح ✅","ok");}
        else{b.classList.add("wrong");sib[q.correct].classList.add("correct");toast("خطأ ❌","err");}
        try{markStudyDay();}catch(e){}
      });});
    }
    host.appendChild(d);
    render();
  }catch(e){}
}
/* ---- TUTOR: level-aware training launcher ---- */
function currHookTutor(){
  try{
    var host=$("tutorBox");if(!host||$("currTutorBar"))return;
    var d=document.createElement("div");d.id="currTutorBar";d.className="panel glass";
    d.innerHTML='<h3 style="margin:0 0 4px">🤖 تدريب حسب المستوى</h3><div class="muted">اختر مستواك ثم ابدأ تدريبًا فوريًا بمحتواه.</div>';
    d.appendChild(currLevelBar(window.currTutorLevel,function(L){
      window.currTutorLevel=L;
      try{if(S)S.tutorLevel=L;if(typeof save==="function")save();}catch(e){}
      needLevel(L==="mixed"?"A1":L,function(){
        try{
          var ql=$("quizLevel");if(ql)ql.value=L;
          var qs=buildQuestions("mixed",10);
          startQuizRun("mixed",qs);
          showPage("quiz");
        }catch(e){try{showPage("quiz");}catch(x){}}
      });
    }));
    host.insertBefore(d,host.firstChild);
    try{if(S&&S.tutorLevel)window.currTutorLevel=S.tutorLevel;}catch(e){}
  }catch(e){}
}
/* register section hooks on page show (runs after other modules' wraps) */
try{
  var _currSP2=showPage;
  var CURR_HOOKS2={
    vocab:function(){currHookVocab();},
    grammar:function(){currHookGrammar();},
    sentences:function(){currCascadeKapitel("sentenceKapitel",(window.currSentLevel||"all")==="mixed"?"all":(window.currSentLevel||"all"));},
    games:function(){currHookGames();},
    review:function(){currHookReview();},
    mistakes:function(){currHookMistakes();},
    stories:function(){currHookStories();},
    tutor:function(){currHookTutor();}
  };
  showPage=function(n){_currSP2(n);try{if(CURR_HOOKS2[n])CURR_HOOKS2[n]();}catch(e){if(window.console)console.error(e);}};
}catch(e){}
window.currHookGrammar=currHookGrammar;
window.currHookVocab=currHookVocab;
window.currHookGames=currHookGames;
window.currHookReview=currHookReview;
window.currHookMistakes=currHookMistakes;
window.currHookStories=currHookStories;
window.currHookTutor=currHookTutor;
})();
/* ================= PART 5: rule-specific + reading quiz engines ================= */
"use strict";
(function(){
if(typeof window==="undefined")return;
function esc(s){try{return escapeHtml(String(s==null?"":s));}catch(e){return String(s==null?"":s);}}
function shuf(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function rulesOf(L){
  try{return GRAMMAR.filter(function(g){return(g.level||"A1")===L;});}catch(e){return[];}
}
function kapWord(kap){
  try{
    var pool=allWords().filter(function(w){return w.kap===kap;});
    if(pool.length)return pool[Math.floor(Math.random()*pool.length)];
    var all=allWords();
    return all[Math.floor(Math.random()*all.length)];
  }catch(e){return null;}
}
/* corrupt a correct sentence into a plausible WRONG variant (tests the rule, not vocab) */
function corrupt(de){
  var c=de.replace(/\bder\b/, "das");
  if(c!==de)return c;
  c=de.replace(/\bdie\b/, "der");
  if(c!==de)return c;
  c=de.replace(/\bdas\b/, "die");
  if(c!==de)return c;
  c=de.replace(/\bden\b/, "dem");
  if(c!==de)return c;
  c=de.replace(/\bdem\b/, "den");
  if(c!==de)return c;
  var w=de.split(" ");
  if(w.length>=4){var t=w[1];w[1]=w[2];w[2]=t;return w.join(" ");}
  return null;
}
/* Build rule-testing questions from a GRAMMAR rule's own examples+quiz */
function currRuleQs(rule,count){
  var out=[],w=kapWord(rule.kap);
  function Q(prompt,opts,correctText,explain){out.push({prompt:prompt,opts:opts,correctText:correctText,explain:explain||("القاعدة: "+rule.title),w:w});}
  try{
    if(rule.quiz){
      Q("📐 ["+rule.title+"] "+rule.quiz.q,rule.quiz.opts.slice(),rule.quiz.opts[rule.quiz.correct],rule.quiz.explain);
    }
    (rule.ex||[]).forEach(function(e){
      if(out.length>=(count||4))return;
      var dex=e[0]||"",arx=e[1]||"";
      var m=dex.match(/(der|die|das|den|dem) (\S+)/);
      if(m&&out.length<(count||4)){
        var art=m[1],rest=dex.replace(m[1]+" "+m[2],"___ "+m[2]);
        Q("📐 أكمل ("+rule.title+"): "+rest+" — "+arx,["der","die","das"],art,"الصحيح: "+art+" "+m[2]+" — "+rule.title);
      }
    });
    (rule.ex||[]).forEach(function(e){
      if(out.length<(count||4)+2){
        var dex=e[0]||"",arx=e[1]||"";
        if(!dex||dex.split(" ").length<4)return;
        var bad=corrupt(dex);
        if(!bad||bad===dex)return;
        var opts=shuf([dex,bad]);
        if(out.some(function(q){return q.correctText===dex&&q.prompt.indexOf("الصحيحة")>=0;}))return;
        Q("📐 اختر الجملة الصحيحة ("+rule.title+") — "+arx,opts,dex,"الصحيح: "+dex);
      }
    });
  }catch(e){}
  return out;
}
window.currRuleQs=currRuleQs;
/* Per-rule drill launcher: 5 questions testing THIS rule */
window.currRuleDrill=function(gid){
  try{
    var g=null;
    try{g=GRAMMAR.find(function(x){return x.id===gid;});}catch(e){}
    if(!g){toast("القاعدة غير موجودة","err");return;}
    var qs=currRuleQs(g,5);
    if(!qs.length){toast("لا توجد أسئلة","err");return;}
    startQuizRun("mixed",qs);
    showPage("quiz");
  }catch(e){}
};
/* Add "📐 تدريب القاعدة" button on every grammar card (delegated, survives re-render) */
try{
  document.addEventListener("click",function(e){
    var b=e.target&&e.target.closest?e.target.closest("[data-crule]"):null;
    if(!b)return;
    window.currRuleDrill(b.getAttribute("data-crule"));
  });
  var _cRG=typeof renderGrammar==="function"?renderGrammar:null;
}catch(e){}
/* Mixed quiz set from rules of a level */
function currGrammarQuizQs(L,count){
  var rules=shuf(rulesOf(L));
  var out=[];
  rules.forEach(function(r){
    if(out.length>=(count||10))return;
    currRuleQs(r,2).forEach(function(q){if(out.length<(count||10))out.push(q);});
  });
  return out;
}
/* Reading comprehension quiz from CURR_READING */
function currReadingQuizQs(L,count){
  var items=(window.CURR_READING||[]).filter(function(r){return r.level===L;});
  items=shuf(items);
  var out=[];
  items.forEach(function(r){
    (r.qs||[]).forEach(function(q,qi){
      if(out.length>=(count||10))return;
      out.push({prompt:"📖 ["+r.title+"] "+q.q,opts:q.opts.slice(),correctText:q.opts[q.correct],
        explain:"من النص: "+r.title,w:kapWord(r.kap)});
    });
  });
  return out;
}
window.currGrammarQuizQs=currGrammarQuizQs;
window.currReadingQuizQs=currReadingQuizQs;
/* Inject Grammar/Reading quiz-type buttons + extend buildQuestions wrapper */
function currWireQuizTypes(){
  try{
    var box=document.querySelector(".quiz-types");
    if(box&&!box.querySelector('[data-type="grammar"]')){
      [["grammar","📐 القواعد"],["reading","📖 القراءة"]].forEach(function(t){
        var b=document.createElement("button");
        b.className="quiz-type";b.setAttribute("data-type",t[0]);b.textContent=t[1];
        b.addEventListener("click",function(){
          try{quizType=t[0];}catch(e){}
          box.querySelectorAll(".quiz-type").forEach(function(x){x.classList.toggle("active",x===b);});
        });
        box.appendChild(b);
      });
    }
  }catch(e){}
}
try{currWireQuizTypes();}catch(e){}
document.addEventListener("DOMContentLoaded",function(){try{currWireQuizTypes();}catch(e){}});
setTimeout(function(){try{currWireQuizTypes();}catch(e){}},1500);
/* quiz result labels for the new types */
try{
  if(typeof quizTypeName==="function"&&!window._currQTN){
    window._currQTN=quizTypeName;
    quizTypeName=function(t){
      if(t==="grammar")return "📐 القواعد";
      if(t==="reading")return "📖 القراءة";
      return window._currQTN(t);
    };
  }
}catch(e){}
/* inject per-rule drill buttons into grammar cards (runs after each render) */
window.currGrantDrills=window.currGrantDrills||function(){
  try{
    document.querySelectorAll("#grammarList .grammar-card").forEach(function(card){
      if(card.querySelector("[data-crule]"))return;
      var ex=card.querySelector("[data-explain]");
      if(!ex)return;
      var gid=ex.getAttribute("data-explain");
      var b=document.createElement("button");
      b.className="btn btn-gold sm";b.textContent="📐 تدريب القاعدة";
      b.setAttribute("data-crule",gid);
      ex.parentNode.insertBefore(b,ex.nextSibling);
    });
  }catch(e){}
};
})();



