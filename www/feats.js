/* Deutsch Master - NEW features module (no duplicates with existing pages).
   demo (Academy Demo) | studio (Content Studio) | wbuild (Word Builder) |
   pron (Pronunciation Lab) | recall (Recall Challenge) | shadow (Shadowing) |
   readflow (Reading Flow) | trans (Sentence Transformer) |
   certs (Skill Certificates) | port (Learning Portfolio).
   Reuses only existing primitives: showPage/Store/addXP/toast/escapeHtml/$/
   speakGerman/startMic/evaluateSpoken/normDe/findWord/wordById/allWords/
   buildQuestions/startQuizRun/markStudyDay/checkAch/applyLang/t. */
"use strict";
function ensureFeat(){
  if(!S.feat)S.feat={writing:[],speaking:[],certs:{},read:{},shadow:{},recall:{n:0,ok:0},trans:{n:0,ok:0},gram:{n:0,ok:0},pron:{},studio:{chapters:[]}};
  const f=S.feat;
  ["writing","speaking"].forEach(k=>{if(!f[k])f[k]=[];});
  ["certs","read","shadow","recall","trans","gram","pron","studio"].forEach(k=>{if(!f[k])f[k]=k==="studio"?{chapters:[]}:{};});
  if(!f.studio.chapters)f.studio.chapters=[];
  ["n","ok"].forEach(k=>{["recall","trans","gram"].forEach(t=>{if(f[t][k]==null)f[t][k]=0;});});
  return f;
}
function featSave(){try{Store.save();}catch(e){try{save();}catch(_){}}}
function featSpeak(text,rate){
  try{
    const r=(typeof currentRate==="function")?currentRate():1;
    try{if(S&&S.settings)S.settings.speed=rate||r;}catch(e){}
    speakGerman(text);
    try{if(S&&S.settings)S.settings.speed=r;}catch(e){}
  }catch(e){try{speakGerman(text);}catch(_){}}
}
/* audio record+playback (pronunciation/shadowing). Graceful when unsupported. */
function featRecorder(){
  const R={mr:null,chunks:[],url:null,ok:false};
  try{
    const Ctor=(typeof window!=="undefined")&&(window.MediaRecorder||window.webkitMediaRecorder);
    const mic=(navigator&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)?true:false;
    R.ok=!!(Ctor&&mic);
  }catch(e){R.ok=false;}
  return R;
}
function featRecStart(R,onstop){
  try{
    const Ctor=window.MediaRecorder||window.webkitMediaRecorder;
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      try{
        R.chunks=[];R.mr=new Ctor(stream);
        R.mr.ondataavailable=function(e){if(e.data&&e.data.size)R.chunks.push(e.data);};
        R.mr.onstop=function(){try{stream.getTracks().forEach(function(t){t.stop();});}catch(e){}
          try{if(R.url)URL.revokeObjectURL(R.url);}catch(e){}
          R.url=URL.createObjectURL(new Blob(R.chunks,{type:(R.mr&&R.mr.mimeType)||"audio/webm"}));
          if(onstop)onstop(R.url);};
        R.mr.start();if(onstop)onstop(null);
      }catch(e){toast(t("f_nomic"),"err");if(onstop)onstop(false);}
    }).catch(function(){toast(t("f_nomic"),"err");if(onstop)onstop(false);});
  }catch(e){toast(t("f_nomic"),"err");if(onstop)onstop(false);}
}
function featRecStop(R){try{if(R.mr&&R.mr.state!=="inactive")R.mr.stop();}catch(e){}}
/* ---------- 1. Academy Demo ---------- */
const DEMO_STAGES=[
 {id:"start",go:"dashboard"},{id:"place",go:"journey"},{id:"learn",go:"vocab"},
 {id:"practice",go:"practice"},{id:"assess",go:"quiz"},{id:"personal",go:"mistakes"},
 {id:"progress",go:"analytics"}];
function renderDemo(){
  ensureFeat();
  const box=$("demoBox");if(!box)return;
  let h='<div class="panel glass"><h3>'+t("f_demo_h")+'</h3><div class="muted">'+t("f_demo_sub")+'</div></div>';
  h+='<div class="grid-2">'+DEMO_STAGES.map(function(s,i){
    return '<div class="panel glass"><h4>'+(i+1)+'. '+t("f_demo_"+s.id)+'</h4><div class="muted">'+t("f_demo_"+s.id+"_d")+'</div>'
      +'<div class="row-flex"><button class="btn btn-primary sm" data-demo-go="'+s.go+'">'+t("f_demo_try")+'</button></div></div>';
  }).join("")+'</div>';
  try{
    const words=allWords(),known=words.filter(function(w){return getStatus(w.id)==="known";}).length;
    h+='<div class="panel glass"><h4>'+t("f_demo_live")+'</h4><div class="muted">📚 '+known+'/'+words.length+' • ⭐ '+(S.xp||0)+' • 🔥 '+(S.streak.count||0)+'</div></div>';
  }catch(e){}
  box.innerHTML=h;
  box.querySelectorAll("[data-demo-go]").forEach(function(b){
    b.addEventListener("click",function(){try{showPage(b.getAttribute("data-demo-go"));}catch(e){}});
  });
}
/* ---------- 2. Content Studio ---------- */
function studioChapters(){ensureFeat();return S.feat.studio.chapters;}
function studioApplyChapters(){
  try{
    if(typeof KAPITEL==="undefined")return;
    studioChapters().forEach(function(c){
      if(!KAPITEL.find(function(k){return k.id===c.id;}))KAPITEL.push({id:c.id,name:c.name,icon:c.icon||"📦"});
    });
  }catch(e){}
}
function studioWords(kap){try{return allWords().filter(function(w){return w.kap===kap;});}catch(e){return [];} }
function renderStudio(){
  ensureFeat();studioApplyChapters();
  const box=$("studioBox");if(!box)return;
  const chs=studioChapters();
  let h='<div class="panel glass"><h3>'+t("f_studio_h")+'</h3><div class="muted">'+t("f_studio_sub")+'</div>'
    +'<div class="form-grid"><label><span>'+t("f_studio_name")+'</span><input type="text" id="stName" placeholder="Kapitel 6"></label>'
    +'<label><span>'+t("f_studio_title")+'</span><input type="text" id="stTitle" placeholder="Essen und Trinken"></label></div>'
    +'<div class="row-flex"><button class="btn btn-primary sm" id="stCreate">'+t("f_studio_create")+'</button></div></div>';
  h+='<div class="grid-2">'+chs.map(function(c){
    const n=studioWords(c.id).length;
    return '<div class="panel glass"><h4>📦 '+escapeHtml(c.id)+' • '+escapeHtml(c.name)+'</h4><div class="muted">📚 '+n+' '+t("f_words")+'</div>'
      +'<div class="row-flex"><button class="btn btn-ghost sm" data-st-open="'+c.id+'">'+t("f_open")+'</button>'
      +'<button class="btn btn-ghost sm" data-st-quiz="'+c.id+'">📝 '+t("f_studio_test")+'</button>'
      +'<button class="btn btn-red sm" data-st-del="'+c.id+'">'+t("f_del")+'</button></div>'
      +'<div id="st-'+c.id+'"></div></div>';
  }).join("")+'</div><div class="panel glass"><h4>'+t("f_studio_exp")+'</h4><div class="row-flex"><button class="btn btn-ghost sm" id="stExport">'+t("f_export")+'</button><button class="btn btn-ghost sm" id="stImportBtn">'+t("f_import")+'</button><input type="file" id="stImportFile" accept=".json" class="hidden"></div></div>';
  box.innerHTML=h;
  $("stCreate").addEventListener("click",function(){
    const name=$("stName").value.trim(),title=$("stTitle").value.trim()||name;
    if(!name){toast(t("f_studio_need"),"err");return;}
    const id="K"+(6+chs.length+(Math.floor(Math.random()*80)+10));
    let uid=id;while(chs.find(function(c){return c.id===uid;})||(typeof KAPITEL!=="undefined"&&KAPITEL.find(function(k){return k.id===uid;})))uid="K"+(Math.floor(Math.random()*800)+100);
    chs.push({id:uid,name:title||uid,icon:"📦"});
    studioApplyChapters();featSave();
    try{if(typeof fillKapitels==="function")fillKapitels();}catch(e){}
    toast("📦 "+uid+" ✅","ok");renderStudio();
  });
  box.querySelectorAll("[data-st-open]").forEach(function(b){
    b.addEventListener("click",function(){studioOpen(b.getAttribute("data-st-open"));});
  });
  box.querySelectorAll("[data-st-quiz]").forEach(function(b){
    b.addEventListener("click",function(){
      const kap=b.getAttribute("data-st-quiz"),list=studioWords(kap);
      if(!list.length){toast(t("f_studio_empty"),"err");return;}
      try{const qs=buildQuestions("mixed",Math.min(10,list.length),list);startQuizRun("mixed",qs);}catch(e){toast(t("f_err"),"err");}
    });
  });
  box.querySelectorAll("[data-st-del]").forEach(function(b){
    b.addEventListener("click",function(){
      const kap=b.getAttribute("data-st-del");
      try{S.customWords=(S.customWords||[]).filter(function(w){return w.kap!==kap;});}catch(e){}
      const ix=chs.findIndex(function(c){return c.id===kap;});if(ix>=0)chs.splice(ix,1);
      featSave();try{if(typeof renderAll==="function")renderAll();}catch(e){}
      toast(t("f_del_ok"),"ok");renderStudio();
    });
  });
  $("stExport").addEventListener("click",function(){
    try{
      const data={chapters:chs,words:(S.customWords||[]).filter(function(w){return chs.find(function(c){return c.id===w.kap;});})};
      const blob=new Blob([JSON.stringify(data)],{type:"application/json"});
      const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="studio.json";a.click();
      setTimeout(function(){try{URL.revokeObjectURL(a.href);}catch(e){}},2000);
    }catch(e){toast(t("f_err"),"err");}
  });
  $("stImportBtn").addEventListener("click",function(){try{$("stImportFile").click();}catch(e){}});
  $("stImportFile").addEventListener("change",function(){
    try{
      const f=this.files[0];if(!f)return;
      const r=new FileReader();
      r.onload=function(){
        try{
          const d=JSON.parse(r.result);
          (d.chapters||[]).forEach(function(c){if(c&&c.id&&!chs.find(function(x){return x.id===c.id;}))chs.push({id:String(c.id),name:String(c.name||c.id),icon:"📦"});});
          (d.words||[]).forEach(function(w){
            if(!w||!w.de||!w.ar)return;
            const id="c"+Date.now()+Math.floor(Math.random()*9999);
            S.customWords.push({id:id,de:String(w.de),art:w.art||"-",ar:String(w.ar),pron:w.pron||String(w.de),ex:w.ex||String(w.de)+".",exAr:w.exAr||String(w.ar),cat:w.cat||"General",type:w.type||"اسم",level:"A1",kap:w.kap||"KX"});
          });
          studioApplyChapters();featSave();
          try{if(typeof renderAll==="function")renderAll();}catch(e){}
          toast(t("f_import_ok"),"ok");renderStudio();
        }catch(e){toast(t("f_err"),"err");}
      };
      r.readAsText(f);
    }catch(e){}
  });
}
function studioOpen(kap){
  const host=$("st-"+kap);if(!host)return;
  const list=studioWords(kap);
  host.innerHTML='<div class="form-grid">'
    +'<label><span>DE</span><input type="text" id="stwDe" placeholder="Apfel"></label>'
    +'<label><span>'+t("f_art")+'</span><select id="stwArt"><option value="der">der</option><option value="die">die</option><option value="das">das</option><option value="-">-</option></select></label>'
    +'<label><span>AR</span><input type="text" id="stwAr" placeholder="تفاحة"></label>'
    +'<label><span>'+t("f_ex")+'</span><input type="text" id="stwEx" placeholder="Der Apfel ist rot."></label></div>'
    +'<div class="row-flex"><button class="btn btn-primary sm" id="stwAdd">➕ '+t("f_add")+'</button></div>'
    +'<div class="muted">'+list.map(function(w){return escapeHtml(w.de);}).join(" • ")+'</div>';
  $("stwAdd").addEventListener("click",function(){
    const de=$("stwDe").value.trim(),ar=$("stwAr").value.trim();
    if(!de||!ar){toast(t("f_studio_need2"),"err");return;}
    S.customWords.push({id:"c"+Date.now(),de:de,art:$("stwArt").value,ar:ar,pron:de,ex:$("stwEx").value.trim()||de+".",exAr:ar,cat:"General",type:"اسم",level:"A1",kap:kap});
    featSave();try{if(typeof renderAll==="function")renderAll();}catch(e){}
    toast(t("f_add_ok"),"ok");studioOpen(kap);
  });
  host.scrollIntoView({behavior:"smooth"});
}
/* ---------- 3. Word Builder ---------- */
const WBUILD=[
 {w:"Schlafzimmer",parts:[["Schlaf","sleep / النوم"],["Zimmer","room / الغرفة"]],ar:"غرفة النوم",more:[["Wohnzimmer","غرفة المعيشة"],["Kinderzimmer","غرفة الأطفال"]],kind:"compound"},
 {w:"Haustür",parts:[["Haus","house / البيت"],["Tür","door / الباب"]],ar:"باب البيت",more:[["Autotür","باب السيارة"],["Zimmertür","باب الغرفة"]],kind:"compound"},
 {w:"Bahnhof",parts:[["Bahn","rail / السكة"],["Hof","yard / الساحة"]],ar:"محطة القطار",more:[["Flughafen","المطار"],["Busbahnhof","محطة الأتوبيس"]],kind:"compound"},
 {w:"Kühlschrank",parts:[["kühl","cool / بارد"],["Schrank","cupboard / الدولاب"]],ar:"الثلاجة",more:[["Schrank","الدولاب"],["kalt","بارد"]],kind:"compound"},
 {w:"Handschuh",parts:[["Hand","hand / اليد"],["Schuh","shoe / الحذاء"]],ar:"القفاز",more:[["Handy","الموبايل"],["Schuhe","الأحذية"]],kind:"compound"},
 {w:"Fernseher",parts:[["fern","far / بعيد"],["Seher","viewer / المشاهد"]],ar:"التليفزيون",more:[["fernsehen","يشاهد التليفزيون"],["weit","بعيد"]],kind:"compound"},
 {w:"lernen",parts:[],ar:"يتعلم",fam:[["lernt","هو يتعلم"],["gelernt","مُتعَلَّم"],["der Lerner","المتعلم"],["das Lernen","التعلُّم"]],more:[["studieren","يدرس"],["üben","يتدرب"]],kind:"family"},
 {w:"sprechen",parts:[],ar:"يتحدث",fam:[["spricht","هو يتحدث"],["gesprochen","مُتحدَّث"],["die Sprache","اللغة"],["das Gespräch","المحادثة"]],more:[["sagen","يقول"],["reden","يتكلم"]],kind:"family"},
 {w:"fahren",parts:[],ar:"يسافر / يقود",fam:[["fährt","هو يسافر"],["gefahren","مُسافَر"],["der Fahrer","السائق"],["die Fahrt","الرحلة"]],more:[["reisen","يسافر"],["fliegen","يطير"]],kind:"family"},
 {w:"verstehen",parts:[["ver-","prefix: يغيّر المعنى"],["stehen","to stand / يقف"]],ar:"يفهم",more:[["verkaufen","يبيع"],["versuchen","يحاول"]],kind:"prefix"},
 {w:"bekommen",parts:[["be-","prefix: يجعله متعديًا"],["kommen","to come / يأتي"]],ar:"يحصل على",more:[["besuchen","يزور"],["bezahlen","يدفع"]],kind:"prefix"},
 {w:"freundlich",parts:[["Freund","friend / الصديق"],["-lich","suffix: صفة (ودود)"]],ar:"ودود",more:[["glücklich","سعيد"],["traurig","حزين"]],kind:"suffix"},
 {w:"Lehrerin",parts:[["Lehrer","teacher (m) / المعلم"],["-in","suffix: المؤنث"]],ar:"المعلمة",more:[["Studentin","طالبة"],["Ärztin","طبيبة"]],kind:"suffix"},
 {w:"unglücklich",parts:[["un-","prefix: النفي"],["glücklich","happy / سعيد"]],ar:"تعيس",more:[["unmöglich","مستحيل"],["unhöflich","غير مؤدب"]],kind:"prefix"}];
function renderWbuild(){
  ensureFeat();
  const box=$("wbuildBox");if(!box)return;
  let h='<div class="panel glass"><h3>'+t("f_wb_h")+'</h3><div class="muted">'+t("f_wb_sub")+'</div><div class="row-flex">'
    +["compound","family","prefix","suffix"].map(function(k){return '<button class="btn btn-ghost sm" data-wbk="'+k+'">'+t("f_wb_"+k)+'</button>';}).join("")
    +'</div></div><div id="wbList"></div>';
  box.innerHTML=h;
  function show(kind){
    const items=WBUILD.filter(function(x){return !kind||x.kind===kind;});
    $("wbList").innerHTML='<div class="grid-2">'+items.map(function(x,ix){
      return '<div class="panel glass"><h4 dir="ltr" style="text-align:left">'+escapeHtml(x.w)+'</h4><div class="muted">'+escapeHtml(x.ar)+' • '+t("f_wb_"+x.kind)+'</div>'
        +'<div class="row-flex"><button class="btn btn-primary sm" data-wb-open="'+ix+'">'+t("f_wb_open")+'</button></div><div id="wb-'+ix+'"></div></div>';
    }).join("")+'</div>';
    $("wbList").querySelectorAll("[data-wb-open]").forEach(function(b){
      b.addEventListener("click",function(){
        const x=items[parseInt(b.getAttribute("data-wb-open"),10)];
        const host=$("wb-"+b.getAttribute("data-wb-open"));
        let d="";
        if(x.parts&&x.parts.length)d+='<div class="quiz-opts">'+x.parts.map(function(p){return '<div class="quiz-opt" dir="ltr">'+escapeHtml(p[0])+' = '+escapeHtml(p[1])+'</div>';}).join("")+'</div>';
        if(x.fam&&x.fam.length)d+='<div class="muted">'+t("f_wb_fam")+'</div><div class="quiz-opts">'+x.fam.map(function(p){return '<div class="quiz-opt" dir="ltr">'+escapeHtml(p[0])+' = '+escapeHtml(p[1])+'</div>';}).join("")+'</div>';
        d+='<div class="muted">'+t("f_wb_more")+'</div><div class="muted">'+x.more.map(function(p){return '🔹 <b dir="ltr">'+escapeHtml(p[0])+'</b> = '+escapeHtml(p[1]);}).join("<br>")+'</div>';
        d+='<div class="row-flex"><button class="btn btn-ghost sm" data-wb-hear>'+t("f_listen")+'</button></div>';
        host.innerHTML=d;
        host.querySelector("[data-wb-hear]").addEventListener("click",function(){featSpeak(x.w,1);});
        host.scrollIntoView({behavior:"smooth"});
      });
    });
  }
  box.querySelectorAll("[data-wbk]").forEach(function(b){b.addEventListener("click",function(){show(b.getAttribute("data-wbk"));});});
  show("compound");
}
/* ---------- 4. Pronunciation Lab ---------- */
const PRON_SOUNDS=[
 {s:"ch",ar:"صوت الـ ch (خ/ش)",words:[["ich","أنا"],["Buch","كتاب"],["Milch","لبن"]],tip:"بعد i/e مرقق، وبعد a/o/u مفخم."},
 {s:"sch",ar:"صوت sch = ش",words:[["Schule","مدرسة"],["Tisch","طاولة"],["Fisch","سمك"]],tip:"دائمًا ش مثل: Schule."},
 {s:"z",ar:"صوت z = تس",words:[["Zeit","وقت"],["Zug","قطار"],["Pizza","بيتزا"]],tip:"z تُنطق تس وليست ز."},
 {s:"r",ar:"صوت r الألماني",words:[["rot","أحمر"],["Brot","خبز"],["Lehrer","معلم"]],tip:"من الحلق بخفة، وتخفف آخر الكلمة."},
 {s:"w",ar:"صوت w = v",words:[["Wasser","ماء"],["wohnen","يسكن"],["Wetter","طقس"]],tip:"w تُنطق v وليست واوًا."},
 {s:"v",ar:"صوت v = ف",words:[["Vater","أب"],["viel","كثير"],["von","من"]],tip:"v تُنطق ف."},
 {s:"ei",ar:"صوت ei = آي",words:[["mein","لي"],["klein","صغير"],["nein","لا"]],tip:"ei تُنطق آي."},
 {s:"ie",ar:"صوت ie = إي طويلة",words:[["Liebe","حب"],["Tier","حيوان"],["Brief","خطاب"]],tip:"ie تُنطق إي طويلة."},
 {s:"eu",ar:"صوت eu = أوي",words:[["heute","اليوم"],["Deutsch","ألماني"],["neu","جديد"]],tip:"eu تُنطق أوي."},
 {s:"ä",ar:"صوت ä",words:[["Mädchen","فتاة"],["Bäcker","خباز"],["spät","متأخر"]],tip:"بين الفتحة والكسرة."},
 {s:"ö",ar:"صوت ö",words:[["schön","جميل"],["Hören","سمع"],["zwölf","اثنا عشر"]],tip:"شفتان مضمومتان مع نطق e."},
 {s:"ü",ar:"صوت ü",words:[["Tür","باب"],["grün","أخضر"],["fühlen","يشعر"]],tip:"شفتان مضمومتان مع نطق i."}];
function renderPron(){
  ensureFeat();
  const box=$("pronBox");if(!box)return;
  const done=S.feat.pron;
  let h='<div class="panel glass"><h3>'+t("f_pron_h")+'</h3><div class="muted">'+t("f_pron_sub")+'</div></div><div class="grid-2">';
  h+=PRON_SOUNDS.map(function(p,ix){
    return '<div class="panel glass"><h4 dir="ltr" style="text-align:left">🔊 '+escapeHtml(p.s)+'</h4><div class="muted">'+escapeHtml(p.ar)+(done[p.s]?' • ✅':"")+'</div>'
      +'<div class="row-flex"><button class="btn btn-primary sm" data-pr-open="'+ix+'">'+t("f_open")+'</button></div><div id="pr-'+ix+'"></div></div>';
  }).join("")+'</div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-pr-open]").forEach(function(b){
    b.addEventListener("click",function(){pronOpen(parseInt(b.getAttribute("data-pr-open"),10));});
  });
}
function pronOpen(ix){
  const p=PRON_SOUNDS[ix];if(!p)return;
  const host=$("pr-"+ix);if(!host)return;
  const R=featRecorder();
  host.innerHTML='<div class="muted">💡 '+escapeHtml(p.tip)+'</div>'
    +p.words.map(function(w,i){return '<div class="row-flex"><b dir="ltr">'+escapeHtml(w[0])+'</b><span class="muted">'+escapeHtml(w[1])+'</span><button class="btn btn-ghost sm" data-pr-hear="'+i+'">🔊</button><button class="btn btn-ghost sm" data-pr-slow="'+i+'">🐢</button></div>';}).join("")
    +'<div class="row-flex"><input type="text" id="prIn" placeholder="…” autocomplete="off"><button class="btn btn-primary sm" id="prMic">🎤 '+t("f_record")+'</button><button class="btn btn-ghost sm" id="prPlay">▶️ '+t("f_playback")+'</button></div>'
    +'<audio id="prAudio" controls class="hidden" style="width:100%"></audio><div class="quiz-feedback hidden" id="prFb"></div>'
    +'<div class="muted">'+t("f_pron_target")+': <b dir="ltr">'+escapeHtml(p.s)+'</b></div>';
  host.querySelectorAll("[data-pr-hear]").forEach(function(b){b.addEventListener("click",function(){featSpeak(p.words[parseInt(b.getAttribute("data-pr-hear"),10)][0],1);});});
  host.querySelectorAll("[data-pr-slow]").forEach(function(b){b.addEventListener("click",function(){featSpeak(p.words[parseInt(b.getAttribute("data-pr-slow"),10)][0],0.5);});});
  let recUrl=null,recording=false;
  function fb(msg,ok){const f=$("prFb");f.classList.remove("hidden");f.className="quiz-feedback "+(ok?"ok":"no");f.innerHTML=msg;}
  $("prMic").addEventListener("click",function(){
    if(!R.ok){try{startMic($("prMic"),$("prIn"),$("prFb"),function(){pronEval(p);} );}catch(e){toast(t("f_nomic"),"err");}return;}
    if(!recording){recording=true;$("prMic").textContent="⏹ "+t("f_stop");
      featRecStart(R,function(u){if(u===false){recording=false;$("prMic").textContent="🎤 "+t("f_record");}else if(u){recUrl=u;recording=false;$("prMic").textContent="🎤 "+t("f_record");const a=$("prAudio");a.src=u;a.classList.remove("hidden");pronEval(p);}});
      try{startMic($("prMic"),$("prIn"),$("prFb"),function(){/* transcript ready */});}catch(e){}
    }else{featRecStop(R);}
  });
  $("prPlay").addEventListener("click",function(){
    const a=$("prAudio");
    if(recUrl){a.classList.remove("hidden");try{a.play();}catch(e){}}
    else toast(t("f_norecord"),"err");
  });
  host.scrollIntoView({behavior:"smooth"});
}
function pronEval(p){
  try{
    const v=$("prIn").value.trim();
    if(v.length<2)return;
    const has=v.toLowerCase().indexOf(p.s.toLowerCase())>=0;
    const f=$("prFb");f.classList.remove("hidden");
    f.className="quiz-feedback "+(has?"ok":"no");
    f.innerHTML=(has?"✅ ":"🔁 ")+escapeHtml(v)+"<br><span class='muted'>"+escapeHtml(p.tip)+"</span>";
    if(has){S.feat.pron[p.s]=1;featSave();try{addXP(5,"pron");markStudyDay();}catch(e){}}
  }catch(e){}
}
/* ---------- 5. Recall Challenge ---------- */
const RECALL=[
 {k:"word",sit:"Du bist in der Schule. Du brauchst etwas zum Schreiben.",ar:"أنت في المدرسة وتحتاج شيئًا للكتابة.",model:"einen Stift",hint:"St…"},
 {k:"word",sit:"Du hast Durst. Du möchtest etwas Kaltes.",ar:"أنت عطشان وتريد شيئًا باردًا.",model:"Wasser",hint:"W…"},
 {k:"sentence",sit:"Du bist im Restaurant. Du möchtest Wasser. Was sagst du?",ar:"أنت في مطعم وتريد ماءً. ماذا تقول؟",model:"Ich möchte Wasser",hint:"Ich möchte…"},
 {k:"sentence",sit:"Du triffst einen Freund morgens. Was sagst du?",ar:"تقابل صديقًا صباحًا. ماذا تقول؟",model:"Guten Morgen",hint:"Guten…"},
 {k:"sentence",sit:"Du verlässt einen Freund abends. Was sagst du?",ar:"تودع صديقًا مساءً. ماذا تقول؟",model:"Tschüs",hint:"Tsch…"},
 {k:"grammar",sit:"Sag: أنا آكل تفاحة (maskulin, Akkusativ).",ar:"طبق Akkusativ على المذكر.",model:"Ich esse einen Apfel",hint:"einen…"},
 {k:"grammar",sit:"Verneine: Ich habe ein Auto.",ar:"انفِ الجملة.",model:"Ich habe kein Auto",hint:"kein…"},
 {k:"grammar",sit:"Frag einen Freund: هل تأتي غدًا؟",ar:"اصنع سؤال Ja/Nein.",model:"Kommst du morgen",hint:"Kommst…"},
 {k:"response",sit:"Jemand sagt: Es tut mir leid. Was antwortest du?",ar:"شخص يعتذر لك. ماذا ترد؟",model:"Kein Problem",hint:"Kein…"},
 {k:"response",sit:"Jemand fragt: Wie geht es dir? Du bist gut. Was sagst du?",ar:"سُئلت عن حالك وأنت بخير.",model:"Mir geht es gut",hint:"Mir geht…"},
 {k:"response",sit:"Der Kellner fragt: Sonst noch etwas? Du willst nichts. Was sagst du?",ar:"الجرسون يسأل وأنت لا تريد شيئًا.",model:"Nein, danke",hint:"Nein…"},
 {k:"word",sit:"Du bist müde. Du gehst ins … (مكان النوم).",ar:"أنت متعب وتذهب لمكان النوم.",model:"Bett",hint:"B…"},
 {k:"sentence",sit:"Stell dich vor: اسمك Ali وعمرك 20.",ar:"عرّف بنفسك.",model:"Ich heiße Ali",hint:"Ich heiße…"},
 {k:"grammar",sit:"Sag: هذا ليس كتابي (Buch, neutral).",ar:"انفِ الملكية.",model:"Das ist nicht mein Buch",hint:"nicht…"},
 {k:"sentence",sit:"Frag nach dem Preis vom Brot.",ar:"اسأل عن سعر الخبز.",model:"Was kostet das Brot",hint:"Was kostet…"},
 {k:"word",sit:"Du schreibst eine E-Mail. Du brauchst den … (الحاسوب).",ar:"تحتاج الحاسوب.",model:"Computer",hint:"C…"},
 {k:"grammar",sit:"Befiehl einem Freund: تعال هنا!",ar:"اصنع أمر du.",model:"Komm her",hint:"Komm…"},
 {k:"sentence",sit:"Sag, wo du wohnst (Kairo).",ar:"قل أين تسكن.",model:"Ich wohne in Kairo",hint:"Ich wohne…"},
 {k:"response",sit:"Jemand sagt: Danke! Was antwortest du?",ar:"شخص يشكرك.",model:"Bitte schön",hint:"Bitte…"},
 {k:"word",sit:"Zum Frühstück isst du … mit Käse (الخبز).",ar:"تفطر خبزًا بالجبن.",model:"Brot",hint:"Br…"},
 {k:"grammar",sit:"Sag: نحن نتعلم الألمانية.",ar:"اصرف lernen مع wir.",model:"Wir lernen Deutsch",hint:"Wir lernen…"},
 {k:"sentence",sit:"Sag, dass du morgen keine Zeit hast.",ar:"قل إنك مشغول غدًا.",model:"Ich habe morgen keine Zeit",hint:"keine…"},
 {k:"image",sit:"Erinnere dich an das Bild: ماذا يوجد للكتابة؟",ar:"تذكر من صور الكلمات.",model:"Stift",hint:"St…",img:"img/words/11.jpeg"},
 {k:"image",sit:"Erinnere dich an das Bild: ماذا تشرب ساخنًا صباحًا؟",ar:"تذكر من صور الكلمات.",model:"Kaffee",hint:"K…",img:"img/words/15.jpeg"}];
function renderRecall(){
  ensureFeat();
  const box=$("recallBox");if(!box)return;
  const F=S.feat;
  let h='<div class="panel glass"><h3>'+t("f_recall_h")+'</h3><div class="muted">'+t("f_recall_sub")+'</div>'
    +'<div class="muted">✅ '+F.recall.ok+'/'+F.recall.n+'</div>'
    +'<div class="row-flex"><button class="btn btn-primary sm" id="rcStart">'+t("f_start")+'</button></div><div id="rcBody"></div></div>';
  box.innerHTML=h;
  $("rcStart").addEventListener("click",function(){rcNext(0,0,[]);});
}
function rcNext(ix,score,results){
  const box=$("rcBody");if(!box)return;
  if(ix>=RECALL.length){rcFinish(score,results);return;}
  const it=RECALL[ix];
  box.innerHTML='<div class="muted">'+t("f_challenge")+' '+(ix+1)+'/'+RECALL.length+' • '+t("f_recall_"+it.k)+'</div>'
    +'<div class="panel glass"><div class="ex-de-l" dir="ltr" style="text-align:left">'+escapeHtml(it.sit)+'</div>'
    +(it.img?'<img class="word-img" src="'+escapeHtml(it.img)+'" alt="recall">':"")
    +'<div class="ex-ar">'+escapeHtml(it.ar)+'</div>'
    +'<div class="muted">'+t("f_recall_think")+'</div>'
    +'<div class="quiz-write"><input type="text" id="rcIn" autocomplete="off" placeholder="…"><button class="btn btn-primary sm" id="rcOk">'+t("gl_check")+'</button></div>'
    +'<div class="quiz-feedback hidden" id="rcFb"></div></div>';
  $("rcOk").addEventListener("click",function(){
    const v=$("rcIn").value.trim(),fb=$("rcFb");fb.classList.remove("hidden");
    if(v.length<1){fb.className="quiz-feedback no";fb.textContent=t("f_write_first");return;}
    let ev={vocab:0};try{if(typeof evaluateSpoken==="function")ev=evaluateSpoken(v,it.model);}catch(e){}
    const exact=(function(){try{return normDe(v)===normDe(it.model);}catch(e){return false;}})();
    const ok=exact||ev.vocab>=60;
    fb.className="quiz-feedback "+(ok?"ok":"no");
    fb.innerHTML=(ok?"✅ ":"🔁 ")+escapeHtml(t("f_model")+": ")+"<b dir='ltr'>"+escapeHtml(it.model)+"</b><br><span class='muted'>"+escapeHtml(v)+"</span>";
    results.push({ok:ok,sit:it.sit,model:it.model,yours:v});
    const F=S.feat;F.recall.n++;if(ok){F.recall.ok++;try{addXP(5,"recall");}catch(e){}}
    featSave();
    const nx=document.createElement("button");nx.className="btn btn-primary sm";nx.textContent=t("gl_next");
    fb.appendChild(document.createElement("br"));fb.appendChild(nx);
    const keep=document.createElement("button");keep.className="btn btn-ghost sm";keep.textContent="💾 "+t("f_keep");
    fb.appendChild(keep);
    keep.addEventListener("click",function(){S.feat.writing.unshift({text:v,where:"recall",date:Date.now()});S.feat.writing=S.feat.writing.slice(0,50);featSave();toast("💾 ✅","ok");});
    nx.addEventListener("click",function(){rcNext(ix+1,score+(ok?1:0),results);});
  });
  box.scrollIntoView({behavior:"smooth"});
}
function rcFinish(score,results){
  const box=$("rcBody");
  const pct=results.length?Math.round(score/results.length*100):0;
  try{markStudyDay();checkAch();}catch(e){}
  box.innerHTML='<div class="panel glass" style="text-align:center"><h3>'+t("f_result")+': '+score+'/'+results.length+'</h3>'
    +'<div class="stat-num">'+pct+'%</div>'
    +'<div class="progress"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
    +(results.filter(function(r){return !r.ok;}).map(function(r){return '<div class="mist-err">❌ '+escapeHtml(r.sit)+'<br>✅ <b dir="ltr">'+escapeHtml(r.model)+'</b></div>';}).join("")||'<div class="muted">'+t("sx_noerr")+'</div>')
    +'<div class="row-flex" style="justify-content:center"><button class="btn btn-primary sm" id="rcAgain">'+t("gl_again")+'</button></div></div>';
  $("rcAgain").addEventListener("click",function(){rcNext(0,0,[]);});
}
/* ---------- 6. German Shadowing ---------- */
const SHADOW={
 Vorstellung:[["Guten Morgen, wie geht es dir?","صباح الخير، كيف حالك؟"],["Ich heiße Ali, und du?","اسمي علي، وأنت؟"],["Ich wohne in Kairo.","أسكن في القاهرة."],["Ich bin zwanzig Jahre alt.","عمري عشرون سنة."],["Ich lerne Deutsch.","أتعلم الألمانية."],["Freut mich!","سعيد بلقائك!"],["Bis morgen!","إلى الغد!"],["Tschüs, mach's gut!","مع السلامة!"],["Sprichst du Deutsch?","هل تتحدث الألمانية؟"],["Ja, ein bisschen.","نعم، قليلًا."]],
 Familie:[["Das ist meine Mutter.","هذه أمي."],["Mein Vater arbeitet viel.","أبي يعمل كثيرًا."],["Ich habe zwei Brüder.","لدي أخوان."],["Meine Schwester ist klein.","أختي صغيرة."],["Wir essen zusammen.","نأكل معًا."],["Die Familie ist groß.","العائلة كبيرة."],["Mein Opa ist nett.","جدي لطيف."],["Wo wohnt ihr?","أين تسكنون؟"],["Wir wohnen in Berlin.","نسكن في برلين."],["Kommst du mit?","هل تأتي معنا؟"]],
 Einkaufen:[["Was kostet das Brot?","كم سعر الخبز؟"],["Das kostet zwei Euro.","سعره يوروان."],["Sonst noch etwas?","شيء آخر؟"],["Nein, danke, das ist alles.","لا شكرًا، هذا كل شيء."],["Ich möchte einen Apfel.","أريد تفاحة."],["Die Äpfel sind frisch.","التفاح طازج."],["Wo ist die Kasse?","أين الكاشير؟"],["Hier, bitte.","تفضل."],["Danke, tschüs!","شكرًا، مع السلامة!"],["Bis bald!","إلى اللقاء قريبًا!"]],
 Restaurant:[["Einen Tisch für zwei, bitte.","طاولة لشخصين من فضلك."],["Die Speisekarte, bitte.","القائمة من فضلك."],["Ich nehme den Fisch.","سآخذ السمك."],["Was trinkst du?","ماذا تشرب؟"],["Ein Wasser, bitte.","ماء من فضلك."],["Schmeckt es dir?","هل يعجبك الطعم؟"],["Ja, sehr lecker!","نعم، لذيذ جدًا!"],["Die Rechnung, bitte.","الحساب من فضلك."],["Stimmt so.","احتفظ بالباقي."],["Guten Appetit!","بالهناء!"]],
 Arbeit:[["Ich arbeite in Kairo.","أعمل في القاهرة."],["Wann beginnt die Arbeit?","متى يبدأ العمل؟"],["Um acht Uhr morgens.","الثامنة صباحًا."],["Ich habe viel zu tun.","لدي عمل كثير."],["Wo ist mein Büro?","أين مكتبي؟"],["Der Chef ist nett.","المدير لطيف."],["Wir haben ein Meeting.","لدينا اجتماع."],["Bis später!","إلى اللقاء لاحقًا!"],["Schönes Wochenende!","عطلة سعيدة!"],["Danke für die Hilfe!","شكرًا على المساعدة!"]],
 Schule:[["Heute haben wir Deutsch.","اليوم لدينا ألماني."],["Wo ist mein Buch?","أين كتابي؟"],["Der Lehrer erklärt gut.","المعلم يشرح جيدًا."],["Schreib bitte deinen Namen.","اكتب اسمك من فضلك."],["Ich verstehe nicht.","لا أفهم."],["Kannst du das wiederholen?","هل يمكنك التكرار؟"],["Die Hausaufgabe ist leicht.","الواجب سهل."],["Wann ist die Pause?","متى الفسحة؟"],["Um zehn Uhr.","العاشرة."],["Bis morgen!","إلى الغد!"]],
 Freizeit:[["Was machst du gern?","ماذا تحب أن تفعل؟"],["Ich spiele gern Fußball.","أحب لعب الكرة."],["Am Freitag sehe ich Freunde.","الجمعة أقابل أصدقائي."],["Wir gehen ins Kino.","نذهب للسينما."],["Der Film ist spannend.","الفيلم ممتع."],["Hörst du gern Musik?","هل تحب الموسيقى؟"],["Ja, ich liebe Musik.","نعم، أحبها."],["Am Sonntag schlafe ich lang.","الأحد أنام طويلًا."],["Kommst du mit?","هل تأتي معي؟"],["Na klar!","بالطبع!"]],
 Reise:[["Ich fahre nach Berlin.","أسافر إلى برلين."],["Der Zug fährt um sechs.","القطار يتحرك السادسة."],["Wo ist der Bahnhof?","أين المحطة؟"],["Eine Fahrkarte, bitte.","تذكرة من فضلك."],["Wohin fährst du?","إلى أين تسافر؟"],["Ich bleibe drei Tage.","سأبقى 3 أيام."],["Das Hotel ist schön.","الفندق جميل."],["Viel Spaß!","استمتع!"],["Gute Reise!","رحلة سعيدة!"],["Bis bald in Kairo!","إلى اللقاء في القاهرة!"]]};
function renderFeatShadow(){
  ensureFeat();
  const box=$("shadowBox");if(!box)return;
  const topics=Object.keys(SHADOW);
  let h='<div class="panel glass"><h3>'+t("f_shadow_h")+'</h3><div class="muted">'+t("f_shadow_sub")+'</div></div><div class="grid-2">';
  h+=topics.map(function(k){
    const dn=(S.feat.shadow[k]||0);
    return '<div class="panel glass"><h4>🗣️ '+t("f_sh_"+k.toLowerCase())+'</h4><div class="muted">10 '+t("f_sentences")+(dn?' • ✅':"")+'</div>'
      +'<div class="row-flex"><button class="btn btn-primary sm" data-sh="'+k+'">'+t("f_start")+'</button></div></div>';
  }).join("")+'</div><div id="shBody"></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-sh]").forEach(function(b){b.addEventListener("click",function(){featShRun(b.getAttribute("data-sh"),0,0);});});
}
function featShRun(topic,ix,reps){
  const box=$("shBody");if(!box)return;
  const list=SHADOW[topic];
  if(ix>=list.length){
    S.feat.shadow[topic]=(S.feat.shadow[topic]||0)+1;featSave();
    try{addXP(20,"shadow");markStudyDay();checkAch();}catch(e){}
    box.innerHTML='<div class="quiz-feedback ok">'+t("f_session_done")+' ⭐+20</div>';return;
  }
  const s=list[ix];
  box.innerHTML='<div class="muted">'+t("f_sentence")+' '+(ix+1)+'/'+list.length+' • '+t("f_reps")+': '+reps+'/3</div>'
    +'<div class="panel glass"><h4 dir="ltr" style="text-align:left">'+escapeHtml(s[0])+'</h4><div class="ex-ar">'+escapeHtml(s[1])+'</div>'
    +'<div class="row-flex"><button class="btn btn-primary sm" id="shHear">🔊</button><button class="btn btn-ghost sm" id="shSlow">🐢</button>'
    +'<button class="btn btn-gold sm" id="shMic">🎤</button><button class="btn btn-ghost sm" id="shNext">'+t("gl_next")+'</button></div>'
    +'<div class="quiz-write"><input type="text" id="shIn" autocomplete="off" placeholder="…"></div>'
    +'<audio id="shAudio" controls class="hidden" style="width:100%"></audio><div class="quiz-feedback hidden" id="shFb"></div></div>';
  $("shHear").addEventListener("click",function(){featSpeak(s[0],1);});
  $("shSlow").addEventListener("click",function(){featSpeak(s[0],0.5);});
  const R=featRecorder();let url=null,rec=false;
  $("shMic").addEventListener("click",function(){
    if(!R.ok){try{startMic($("shMic"),$("shIn"),$("shFb"),function(){});}catch(e){toast(t("f_nomic"),"err");}return;}
    if(!rec){rec=true;featRecStart(R,function(u){if(u===false){rec=false;}else if(u){url=u;rec=false;const a=$("shAudio");a.src=u;a.classList.remove("hidden");try{a.play();}catch(e){}}});}
    else featRecStop(R);
  });
  $("shNext").addEventListener("click",function(){
    const nr=reps+1;
    try{
      const v=$("shIn").value.trim();
      if(v){S.feat.speaking.unshift({text:v,where:"shadow:"+topic,score:"",date:Date.now()});S.feat.speaking=S.feat.speaking.slice(0,30);featSave();}
    }catch(e){}
    if(nr>=3)featShRun(topic,ix+1,0);else featShRun(topic,ix,nr);
  });
  box.scrollIntoView({behavior:"smooth"});
}
/* ---------- 7. Reading Flow ---------- */
const READS=[
 {title:"Anna stellt sich vor",ar:"آنا تعرف بنفسها",text:"Hallo! Ich heiße Anna. Ich bin zwanzig Jahre alt. Ich wohne in Berlin. Ich lerne Deutsch. Deutsch ist interessant. Mein Lehrer ist nett. Am Montag lerne ich Wörter. Am Freitag spreche ich viel.",
  qs:[{q:"Wo wohnt Anna?",opts:["In Berlin","In Kairo","In Paris"],correct:0,why:"Ich wohne in Berlin"},{q:"Wie alt ist Anna?",opts:["Zwanzig","Dreißig","Zehn"],correct:0,why:"zwanzig Jahre alt"},{q:"Was lernt Anna am Montag?",opts:["Wörter","Grammatik","Nichts"],correct:0,why:"Am Montag lerne ich Wörter"}]},
 {title:"Ein Tag mit Omar",ar:"يوم مع عمر",text:"Guten Morgen! Ich bin Omar. Ich frühstücke um sechs Uhr. Dann gehe ich zur Arbeit. Ich arbeite in Kairo. Am Abend sehe ich Freunde. Wir trinken Tee zusammen. Der Tag ist schön.",
  qs:[{q:"Wann frühstückt Omar?",opts:["Um sechs Uhr","Um acht Uhr","Um zehn Uhr"],correct:0,why:"um sechs Uhr"},{q:"Wo arbeitet Omar?",opts:["In Kairo","In Berlin","Zu Hause"],correct:0,why:"in Kairo"},{q:"Was trinken sie?",opts:["Tee","Kaffee","Wasser"],correct:0,why:"Wir trinken Tee"}]},
 {title:"Im Supermarkt",ar:"في السوبر ماركت",text:"Heute kaufe ich ein. Ich brauche Brot, Milch und Äpfel. Das Brot kostet zwei Euro. Die Äpfel sind frisch. An der Kasse zahle ich fünf Euro. Die Verkäuferin ist freundlich. Auf Wiedersehen!",
  qs:[{q:"Was kauft er?",opts:["Brot, Milch und Äpfel","Nur Brot","Nur Milch"],correct:0,why:"Brot, Milch und Äpfel"},{q:"Was kostet das Brot?",opts:["Zwei Euro","Fünf Euro","Zehn Euro"],correct:0,why:"zwei Euro"},{q:"Wie ist die Verkäuferin?",opts:["Freundlich","Müde","Böse"],correct:0,why:"freundlich"}]},
 {title:"Meine Familie",ar:"عائلتي",text:"Meine Familie ist groß. Mein Vater heißt Hassan. Meine Mutter heißt Mona. Ich habe einen Bruder und eine Schwester. Mein Bruder ist klein. Wir wohnen zusammen. Am Sonntag essen wir zusammen.",
  qs:[{q:"Wie heißt der Vater?",opts:["Hassan","Ali","Omar"],correct:0,why:"Mein Vater heißt Hassan"},{q:"Hat er eine Schwester?",opts:["Ja","Nein","Vielleicht"],correct:0,why:"eine Schwester"},{q:"Wann essen sie zusammen?",opts:["Am Sonntag","Am Montag","Am Freitag"],correct:0,why:"Am Sonntag"}]},
 {title:"Das Wetter",ar:"الطقس",text:"Im Sommer ist es heiß. Im Winter ist es kalt. Heute regnet es. Morgen scheint die Sonne. Ich bleibe zu Hause. Ich trinke heißen Tee. Das Wetter im Frühling ist schön.",
  qs:[{q:"Wie ist es im Sommer?",opts:["Heiß","Kalt","Kühl"],correct:0,why:"heiß"},{q:"Was macht er heute?",opts:["Er bleibt zu Hause","Er geht raus","Er arbeitet"],correct:0,why:"zu Hause"},{q:"Was trinkt er?",opts:["Heißen Tee","Kalten Kaffee","Wasser"],correct:0,why:"heißen Tee"}]},
 {title:"In der Schule",ar:"في المدرسة",text:"Ich gehe gern zur Schule. Mein Lehrer heißt Herr Sami. Wir lernen Deutsch und Mathe. Die Bücher sind neu. Meine Freundin sitzt neben mir. Um zwölf Uhr essen wir zusammen. Die Schule ist schön.",
  qs:[{q:"Wie heißt der Lehrer?",opts:["Herr Sami","Herr Ali","Herr Omar"],correct:0,why:"Herr Sami"},{q:"Was lernen sie?",opts:["Deutsch und Mathe","Nur Deutsch","Nur Mathe"],correct:0,why:"Deutsch und Mathe"},{q:"Wann essen sie?",opts:["Um zwölf Uhr","Um sechs Uhr","Um acht Uhr"],correct:0,why:"zwölf Uhr"}]}];
function renderReadflow(){
  ensureFeat();
  const box=$("readflowBox");if(!box)return;
  let h='<div class="panel glass"><h3>'+t("f_read_h")+'</h3><div class="muted">'+t("f_read_sub")+'</div></div><div class="grid-2">';
  h+=READS.map(function(r,ix){
    const dn=S.feat.read[ix];
    return '<div class="panel glass"><h4>📖 '+escapeHtml(r.title)+'</h4><div class="muted">'+escapeHtml(r.ar)+(dn?' • ✅ '+dn+'%':"")+'</div>'
      +'<div class="row-flex"><button class="btn btn-primary sm" data-rd="'+ix+'">'+t("f_open")+'</button></div></div>';
  }).join("")+'</div><div id="rdBody"></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-rd]").forEach(function(b){b.addEventListener("click",function(){rdOpen(parseInt(b.getAttribute("data-rd"),10));});});
}
function rdLookup(tok){
  try{
    const clean=tok.replace(/^[.,!?;:…"“»«']+|[.,!?;:…"“»«']+$/g,"");
    if(!clean)return null;
    let w=null;
    try{w=findWord(clean)||findWord(clean.toLowerCase());}catch(e){}
    if(!w){try{const cap=clean[0].toUpperCase()+clean.slice(1);w=findWord(cap);}catch(e){}}
    return w;
  }catch(e){return null;}
}
function rdOpen(ix){
  const R=READS[ix];if(!R)return;
  const box=$("rdBody");if(!box)return;
  const toks=R.text.split(/(\s+)/);
  box.innerHTML='<div class="panel glass"><h4>📖 '+escapeHtml(R.title)+'</h4><div class="muted">'+escapeHtml(R.ar)+'</div>'
    +'<p class="rd-text" style="line-height:2.2;font-size:17px">'+toks.map(function(x,i){
      return /^\s+$/.test(x)?escapeHtml(x):'<span class="rd-w" data-rdw="'+i+'" style="cursor:pointer;border-bottom:1px dotted var(--cyan)">'+escapeHtml(x)+'</span>';
    }).join("")+'</p><div id="rdInfo"></div>'
    +'<div class="row-flex"><button class="btn btn-ghost sm" data-rd-hear>'+t("f_listen")+'</button><button class="btn btn-primary sm" id="rdQuiz">'+t("f_read_q")+'</button></div><div id="rdQ"></div></div>';
  box.querySelector("[data-rd-hear]").addEventListener("click",function(){featSpeak(R.text,0.85);});
  box.querySelectorAll(".rd-w").forEach(function(sp){
    sp.addEventListener("click",function(){
      const w=rdLookup(sp.textContent);
      const info=$("rdInfo");
      if(!w){info.innerHTML='<div class="muted">'+escapeHtml(sp.textContent)+' — ?</div>';return;}
      let extra="";
      try{
        if(w.art&&w.art!=="-")extra+='<div class="muted">Artikel: <b>'+escapeHtml(w.art)+'</b></div>';
        if(w.plural)extra+='<div class="muted">Plural: <b>'+escapeHtml(w.plural)+'</b></div>';
        if(w.type)extra+='<div class="muted">'+t("f_type")+': <b>'+escapeHtml(w.type)+'</b></div>';
        if(w.type==="فعل")extra+='<div class="muted">Infinitiv: <b dir="ltr">'+escapeHtml(w.de)+'</b></div>';
        if(w.ex&&w.ex!==w.de+".")extra+='<div class="muted">📌 <b dir="ltr">'+escapeHtml(w.ex)+'</b> = '+escapeHtml(w.exAr||"")+'</div>';
      }catch(e){}
      info.innerHTML='<div class="panel glass"><h4 dir="ltr" style="text-align:left">'+escapeHtml((w.art&&w.art!=="-"?w.art+" ":"")+w.de)+'</h4><div class="ex-ar">'+escapeHtml(w.ar)+'</div>'+extra+'</div>';
      info.scrollIntoView({behavior:"smooth",block:"nearest"});
    });
  });
  $("rdQuiz").addEventListener("click",function(){rdQuiz(ix,0,0);});
  box.scrollIntoView({behavior:"smooth"});
}
function rdQuiz(ix,qi,score){
  const R=READS[ix],box=$("rdQ");if(!box)return;
  if(qi>=R.qs.length){
    const pct=Math.round(score/R.qs.length*100);
    S.feat.read[ix]=pct;featSave();
    try{addXP(10,"read");markStudyDay();checkAch();}catch(e){}
    box.innerHTML='<div class="quiz-feedback ok">'+t("f_result")+': '+score+'/'+R.qs.length+' ('+pct+'%)</div>';
    return;
  }
  const q=R.qs[qi];
  // Fair shuffle per render: correct answer must not stay at index 0
  const order=q.opts.map(function(_,ix){return ix;});
  for(let k=order.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));const tmp=order[k];order[k]=order[j];order[j]=tmp;}
  box.innerHTML='<div class="muted">'+t("f_question")+' '+(qi+1)+'/'+R.qs.length+'</div><h4>'+escapeHtml(q.q)+'</h4>'
    +'<div class="quiz-opts">'+order.map(function(oi){return '<button class="quiz-opt" data-j="'+oi+'">'+escapeHtml(q.opts[oi])+'</button>';}).join("")+'</div><div class="quiz-feedback hidden" id="rdFb"></div>';
  box.querySelectorAll(".quiz-opt").forEach(function(b){
    b.addEventListener("click",function(){
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("rdFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(function(x){x.disabled=true;});
      if(j===q.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent=t("sx_correct")+" "+q.why;score++;}
      else{b.classList.add("wrong");const cb=box.querySelector('.quiz-opt[data-j="'+q.correct+'"]');if(cb)cb.classList.add("correct");fb.className="quiz-feedback no";fb.textContent=t("sx_wrong")+" "+q.why;}
      setTimeout(function(){rdQuiz(ix,qi+1,score);},1600);
    });
  });
}
/* ---------- 8. Sentence Transformer ---------- */
const TRANS=[
 {base:"Ich kaufe einen Kaffee.",ar:"أشتري قهوة.",task:"neg",ask:"انفِ الجملة:",model:"Ich kaufe keinen Kaffee."},
 {base:"Ich habe ein Auto.",ar:"لدي سيارة.",task:"neg",ask:"انفِ الجملة:",model:"Ich habe kein Auto."},
 {base:"Das ist eine Lampe.",ar:"هذا مصباح.",task:"neg",ask:"انفِ الجملة:",model:"Das ist keine Lampe."},
 {base:"Ich kaufe einen Kaffee.",ar:"أشتري قهوة.",task:"q",ask:"حوّل إلى سؤال Ja/Nein:",model:"Kaufe ich einen Kaffee?"},
 {base:"Du lernst Deutsch.",ar:"أنت تتعلم الألمانية.",task:"q",ask:"حوّل إلى سؤال:",model:"Lernst du Deutsch?"},
 {base:"Er kommt morgen.",ar:"هو يأتي غدًا.",task:"q",ask:"حوّل إلى سؤال:",model:"Kommt er morgen?"},
 {base:"Der Mann schläft.",ar:"الرجل نائم.",task:"pl",ask:"حوّل الفاعل إلى الجمع (Die…):",model:"Die Männer schlafen."},
 {base:"Das Kind spielt.",ar:"الطفل يلعب.",task:"pl",ask:"حوّل الفاعل إلى الجمع:",model:"Die Kinder spielen."},
 {base:"Die Frau kocht.",ar:"المرأة تطبخ.",task:"pl",ask:"حوّل الفاعل إلى الجمع:",model:"Die Frauen kochen."},
 {base:"Ich sehe den Mann.",ar:"أرى الرجل.",task:"nom",ask:"اجعل المفعول فاعلًا (Der Mann…):",model:"Der Mann sieht mich."},
 {base:"Ich bin der Lehrer.",ar:"أنا المعلم.",task:"du",ask:"خاطب صديقًا (Du…):",model:"Du bist der Lehrer."},
 {base:"Kommen Sie bitte!",ar:"تعال حضرتك!",task:"du",ask:"خاطب صديقًا:",model:"Komm bitte!"},
 {base:"Ich muss lernen.",ar:"يجب أن أتعلم.",task:"past_plan",ask:"أعد الصياغة بـ möchte (رغبة مهذبة):",model:"Ich möchte lernen."},
 {base:"Heute lerne ich.",ar:"اليوم أتعلم.",task:"reorder",ask:"ابدأ بالفاعل:",model:"Ich lerne heute."},
 {base:"Ich lerne heute.",ar:"أتعلم اليوم.",task:"reorder",ask:"ابدأ بالزمن:",model:"Heute lerne ich."},
 {base:"Er isst einen Apfel.",ar:"هو يأكل تفاحة.",task:"neg",ask:"انفِ الجملة:",model:"Er isst keinen Apfel."},
 {base:"Wir wohnen in Kairo.",ar:"نسكن في القاهرة.",task:"q",ask:"حوّل إلى سؤال:",model:"Wohnen wir in Kairo?"},
 {base:"Das Buch ist neu.",ar:"الكتاب جديد.",task:"pl",ask:"حوّل إلى الجمع:",model:"Die Bücher sind neu."},
 {base:"Die Tür ist offen.",ar:"الباب مفتوح.",task:"pl",ask:"حوّل إلى الجمع:",model:"Die Türen sind offen."},
 {base:"Ich habe keine Zeit.",ar:"ليس لدي وقت.",task:"pos",ask:"اجعلها مثبتة:",model:"Ich habe Zeit."},
 {base:"Er spricht gut Deutsch.",ar:"هو يتحدث الألمانية جيدًا.",task:"q",ask:"حوّل إلى سؤال:",model:"Spricht er gut Deutsch?"},
 {base:"Sie kauft eine Lampe.",ar:"هي تشتري مصباحًا.",task:"neg",ask:"انفِ الجملة:",model:"Sie kauft keine Lampe."},
 {base:"Ich trinke Wasser.",ar:"أشرب ماءً.",task:"q",ask:"حوّل إلى سؤال:",model:"Trinke ich Wasser?"},
 {base:"Am Montag lerne ich.",ar:"الاثنين أتعلم.",task:"reorder",ask:"ابدأ بالفاعل:",model:"Ich lerne am Montag."},
 {base:"Du bist müde.",ar:"أنت متعب.",task:"q",ask:"حوّل إلى سؤال:",model:"Bist du müde?"},
 {base:"Ich kann schwimmen.",ar:"أستطيع السباحة.",task:"neg",ask:"انفِ القدرة:",model:"Ich kann nicht schwimmen."},
 {base:"Der Tisch ist groß.",ar:"الطاولة كبيرة.",task:"pl",ask:"حوّل إلى الجمع:",model:"Die Tische sind groß."},
 {base:"Wir bleiben Freunde.",ar:"سنبقى أصدقاء.",task:"q",ask:"حوّل إلى سؤال:",model:"Bleiben wir Freunde?"},
 {base:"Fragen Sie bitte!",ar:"اسأل حضرتك!",task:"du",ask:"خاطب صديقًا:",model:"Frag bitte!"},
 {base:"Ich sehe dich.",ar:"أراك.",task:"swap",ask:"اعكس الأدوار (أنت تراني):",model:"Du siehst mich."}];
function renderTrans(){
  ensureFeat();
  const box=$("transBox");if(!box)return;
  const F=S.feat;
  let h='<div class="panel glass"><h3>'+t("f_trans_h")+'</h3><div class="muted">'+t("f_trans_sub")+'</div>'
    +'<div class="muted">✅ '+F.trans.ok+'/'+F.trans.n+'</div>'
    +'<div class="row-flex"><button class="btn btn-primary sm" id="trStart">'+t("f_start")+'</button></div><div id="trBody"></div></div>';
  box.innerHTML=h;
  $("trStart").addEventListener("click",function(){trNext(0,0);});
}
function trNext(ix,score){
  const box=$("trBody");if(!box)return;
  if(ix>=TRANS.length){
    const pct=Math.round(score/TRANS.length*100);
    try{addXP(15,"trans");markStudyDay();checkAch();}catch(e){}
    box.innerHTML='<div class="quiz-feedback ok">'+t("f_result")+': '+score+'/'+TRANS.length+' ('+pct+'%)</div>';
    return;
  }
  const it=TRANS[ix];
  box.innerHTML='<div class="muted">'+t("f_transform")+' '+(ix+1)+'/'+TRANS.length+'</div>'
    +'<div class="panel glass"><div class="ex-de-l" dir="ltr" style="text-align:left">'+escapeHtml(it.base)+'</div><div class="ex-ar">'+escapeHtml(it.ar)+'</div>'
    +'<div class="muted"><b>'+escapeHtml(it.ask)+'</b></div>'
    +'<div class="quiz-write"><input type="text" id="trIn" autocomplete="off" dir="ltr" placeholder="…"><button class="btn btn-primary sm" id="trOk">'+t("gl_check")+'</button></div>'
    +'<div class="quiz-feedback hidden" id="trFb"></div></div>';
  $("trOk").addEventListener("click",function(){
    const v=$("trIn").value.trim(),fb=$("trFb");fb.classList.remove("hidden");
    if(v.length<2){fb.className="quiz-feedback no";fb.textContent=t("f_write_first");return;}
    let exact=false,ov=0;
    try{exact=normDe(v)===normDe(it.model);}catch(e){}
    try{if(typeof evaluateSpoken==="function")ov=evaluateSpoken(v,it.model).vocab;}catch(e){}
    const ok=exact||ov>=70;
    fb.className="quiz-feedback "+(ok?"ok":"no");
    fb.innerHTML=(ok?"✅ ":"🔁 ")+t("f_model")+": <b dir='ltr'>"+escapeHtml(it.model)+"</b><br><span class='muted'>"+escapeHtml(v)+"</span>";
    S.feat.trans.n++;if(ok){S.feat.trans.ok++;try{addXP(4,"trans");}catch(e){}}
    try{S.feat.gram.n++;if(ok)S.feat.gram.ok++;}catch(e){}
    featSave();
    const row=document.createElement("div");row.className="row-flex";
    const nx=document.createElement("button");nx.className="btn btn-primary sm";nx.textContent=t("gl_next");
    const keep=document.createElement("button");keep.className="btn btn-ghost sm";keep.textContent="💾 "+t("f_keep");
    row.appendChild(nx);row.appendChild(keep);fb.appendChild(row);
    keep.addEventListener("click",function(){S.feat.writing.unshift({text:v,where:"trans",date:Date.now()});S.feat.writing=S.feat.writing.slice(0,50);featSave();toast("💾 ✅","ok");});
    nx.addEventListener("click",function(){trNext(ix+1,score+(ok?1:0));});
  });
  box.scrollIntoView({behavior:"smooth"});
}
/*__MORED__*/
