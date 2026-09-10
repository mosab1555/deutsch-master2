/* Deutsch Master - World, Stories, Survival+, Ausbildung sim.
   Additive: reuses journey/words/TTS/XP systems. */
"use strict";
/* ---------- World Map ---------- */
const WORLD_AREAS=[
{id:"home",t:"🏠 Zuhause",gid:"g1",cat:"Home",game:"rush"},
{id:"uni",t:"🎓 Universität",gid:"g13",cat:"School",game:"battle"},
{id:"shop",t:"🛒 Einkaufen",gid:"g24",cat:"Shopping",game:"missing"},
{id:"rest",t:"🍔 Restaurant",gid:"g7",cat:"Food",game:"tf"},
{id:"station",t:"🚆 Bahnhof",gid:"g17",cat:"Travel",game:"catch"},
{id:"doc",t:"🏥 Arzt",gid:"g19",cat:"Body",game:"detective"},
{id:"friends",t:"👥 Freunde",gid:"g4",cat:"Family",game:"memory"},
{id:"work",t:"💼 Arbeit",gid:"g25",cat:"Work",game:"builder"},
{id:"travel",t:"✈️ Reisen",gid:"g11",cat:"Travel",game:"speed"},
{id:"de",t:"🇩🇪 Deutschland",gid:"g20",cat:"General",game:"boss"},
{id:"ausb",t:"🎓 Ausbildung",gid:"g40",cat:"Work",game:"boss"}];
function areaProgress(a){
  const words=allWords().filter(w=>w.cat===a.cat);
  const known=words.filter(w=>getStatus(w.id)==="known").length;
  const lesson=S.journey&&S.journey.lessons&&S.journey.lessons[a.gid]?1:0;
  const played=(S.gstats&&S.gstats[a.game]&&S.gstats[a.game].n>0)?1:0;
  const parts=[known>0?1:0,lesson,played];
  return {p:parts.reduce((x,y)=>x+y,0)/3,known:known,total:words.length,lesson:!!lesson,played:!!played};
}
function renderWorld(){
  ensureLearn();ensurePlay();
  let h='<div class="panel glass"><h3>🗺️ خريطة ألمانيا التفاعلية</h3><div class="muted">أكمل منطقة لتفتح التالية. كل منطقة: درس + كلمات + لعبة + زعيم.</div></div><div class="grid-2">';
  WORLD_AREAS.forEach((a,i)=>{
    const pr=areaProgress(a);
    const prevOk=i===0||areaProgress(WORLD_AREAS[i-1]).p>=0.6;
    const st=pr.p>=1?"✓":pr.p>0?"🟡":(prevOk?"🔓":"🔒");
    h+='<div class="panel glass"><h4>'+a.t+' '+st+'</h4><div class="muted">📚 '+(pr.lesson?"درس ✓":"درس")+ ' • 📖 '+pr.known+'/'+pr.total+' • 🎮 '+(pr.played?"✓":"—")+'</div><div class="progress sm"><div class="progress-fill" style="width:'+Math.round(pr.p*100)+'%"></div></div><div class="row-flex"><button class="btn btn-ghost sm" data-wl="'+a.gid+'">📚 الدرس</button><button class="btn btn-ghost sm" data-wg="'+a.game+'">🎮 اللعبة</button><button class="btn btn-gold sm" data-wb="'+i+'">👹 الزعيم</button></div></div>';
  });
  h+='</div><div id="worldBox"></div>';
  $("worldBox").innerHTML=h;
  $("worldBox").querySelectorAll("[data-wl]").forEach(b=>b.addEventListener("click",()=>openExplain(b.getAttribute("data-wl"))));
  $("worldBox").querySelectorAll("[data-wg]").forEach(b=>b.addEventListener("click",()=>{showPage("games");setTimeout(()=>startGame(b.getAttribute("data-wg")),200);}));
  $("worldBox").querySelectorAll("[data-wb]").forEach(b=>b.addEventListener("click",()=>startAreaBoss(parseInt(b.getAttribute("data-wb"),10))));
}
function startAreaBoss(i){
  const a=WORLD_AREAS[i];
  const box=$("worldBox");
  const pool=shuffle(allWords().filter(w=>w.cat===a.cat&&w.art!=="-").concat(shuffle(allWords().filter(w=>w.art!=="-")))).slice(0,8);
  let j=0,hp=16,hearts=3;
  function q(){
    if(hp<=0){
      S.best["boss_"+a.id]=1;addXP(40,"boss:"+a.id);markStudyDay();checkAch();save();
      box.innerHTML='<div class="panel glass" style="text-align:center">🎉<h3>Chapter Complete: '+a.t+'!</h3><div>XP gained: +40 • Accuracy area progress updated</div><div class="row-flex"><button class="btn btn-primary sm" id="wBack">🗺️ الخريطة</button></div></div>';
      $("wBack").addEventListener("click",renderWorld);return;
    }
    if(hearts<=0||j>=pool.length){box.innerHTML='<div class="quiz-feedback no">خسرت أمام زعيم '+a.t+' 😞 درّب كلمات '+a.cat+' وحاول مجددًا!</div><div class="row-flex"><button class="btn btn-primary sm" id="wBack">🗺️ الخريطة</button></div>';$("wBack").addEventListener("click",renderWorld);return;}
    const w=pool[j];
    box.innerHTML='<div class="muted">👹 زعيم '+a.t+' • HP: '+hp+' • ❤️ x'+hearts+'</div><div class="progress sm"><div class="progress-fill red" style="width:'+(hp/16*100)+'%"></div></div><h3 style="direction:ltr;text-align:center">'+escapeHtml(w.de)+'</h3><div class="muted" style="text-align:center">'+escapeHtml(w.ar)+'</div><div id="wQ"></div>';
    gameOpts($("wQ"),["der","die","das"],k=>{
      const ok=k===(w.art==="der"?0:w.art==="die"?1:2);
      if(ok){hp-=2;S.totalCorrect++;toast("💥 -2 HP!","ok");}
      else{hearts--;recordMistake(w,"article","boss:"+a.id);toast("💔 "+w.art+" "+w.de,"err");}
      S.totalAnswered++;save();j++;setTimeout(q,800);
    });
  }
  q();box.scrollIntoView({behavior:"smooth"});
}
/* ---------- Mini Stories ---------- */
const STORIES=[
{id:"tag",t:"📖 Ein Tag in Berlin",parts:[
 {de:"Am Morgen trinke ich Kaffee. Dann fahre ich mit dem Bus in die Stadt.",ar:"في الصباح أشرب قهوة. ثم أذهب بالأتوبيس إلى المدينة.",voc:[["der Morgen","الصباح"],["der Bus","الأتوبيس"],["die Stadt","المدينة"]],q:{t:"Womit fährt er in die Stadt?",opts:["Mit dem Bus","Mit dem Auto","Zu Fuß"],correct:0,why:"mit dem Bus = بالأوتوبيس."}},
 {de:"Am Nachmittag besuche ich ein Museum. Das Museum ist groß und interessant.",ar:"بعد الظهر أزور متحفًا. المتحف كبير وشيق.",voc:[["der Nachmittag","بعد الظهر"],["das Museum","المتحف"],["interessant","شيق"]],q:{t:"Wie ist das Museum?",opts:["Groß und interessant","Klein und laut","Teuer"],correct:0,why:"groß und interessant مذكوران بالنص."}},
 {de:"Am Abend esse ich mit Freunden Pizza. Wir trinken Wasser.",ar:"في المساء آكل بيتزا مع الأصدقاء. نشرب ماء.",voc:[["der Abend","المساء"],["die Pizza","البيتزا"],["das Wasser","الماء"]],q:{t:"Was essen sie?",opts:["Pizza","Fisch","Brot"],correct:0,why:"Pizza مذكورة بالنص."}},
 {de:"In der Nacht schlafe ich. Gute Nacht!",ar:"في الليل أنام. ليلة سعيدة!",voc:[["die Nacht","الليل"],["schlafen","ينام"]],q:{t:"Was macht er in der Nacht?",opts:["Er schläft","Er lernt","Er arbeitet"],correct:0,why:"schlafen = ينام."}}]},
{id:"nachbar",t:"📖 Der neue Nachbar",parts:[
 {de:"Hallo! Ich heiße Jonas. Ich wohne jetzt hier.",ar:"أهلًا! اسمي يوناس. أسكن هنا الآن.",voc:[["der Nachbar","الجار"],["jetzt","الآن"]],q:{t:"Wer spricht?",opts:["Jonas","Ali","Sara"],correct:0,why:"Ich heiße Jonas."}},
 {de:"Woher kommst du, Jonas?",ar:"من أين أنت يا يوناس؟",voc:[["woher","من أين"]],q:{t:"Worum geht es?",opts:["Herkunft","Essen","Wetter"],correct:0,why:"Woher = عن الأصل."}},
 {de:"Ich komme aus Hamburg. Und du?",ar:"أنا من هامبورج. وأنت؟",voc:[["Hamburg","هامبورج"]],q:{t:"Woher kommt Jonas?",opts:["Aus Hamburg","Aus Berlin","Aus München"],correct:0,why:"aus Hamburg مذكورة."}},
 {de:"Willkommen! Kommst du morgen zum Tee?",ar:"أهلًا بك! هل تأتي غدًا للشاي؟",voc:[["willkommen","أهلًا بك"],["der Tee","الشاي"]],q:{t:"Wozu lädt er ihn ein?",opts:["Zum Tee","Zum Essen","Zum Film"],correct:0,why:"zum Tee = للشاي."}}]},
{id:"markt",t:"📖 Einkaufen am Samstag",parts:[
 {de:"Am Samstag gehe ich auf den Markt. Ich brauche Obst und Brot.",ar:"يوم السبت أذهب إلى السوق. أحتاج فاكهة وخبزًا.",voc:[["der Markt","السوق"],["das Obst","الفاكهة"],["das Brot","الخبز"]],q:{t:"Was braucht er?",opts:["Obst und Brot","Fisch","Milch"],correct:0,why:"Obst und Brot بالنص."}},
 {de:"Die Äpfel kosten zwei Euro. Das ist billig!",ar:"التفاح بسعر 2 يورو. هذا رخيص!",voc:[["der Apfel","التفاحة"],["billig","رخيص"]],q:{t:"Wie viel kosten die Äpfel?",opts:["Zwei Euro","Fünf Euro","Zehn Euro"],correct:0,why:"zwei Euro بالنص."}},
 {de:"An der Kasse zahle ich. Vielen Dank!",ar:"عند الكاشير أدفع. شكرًا جزيلًا!",voc:[["die Kasse","الكاشير"],["zahlen","يدفع"]],q:{t:"Wo zahlt er?",opts:["An der Kasse","Zu Hause","Im Bus"],correct:0,why:"An der Kasse بالنص."}},
 {de:"Zu Hause esse ich einen Apfel. Lecker!",ar:"في البيت آكل تفاحة. لذيذ!",voc:[["lecker","لذيذ"],["zu Hause","في البيت"]],q:{t:"Was isst er?",opts:["Einen Apfel","Ein Brot","Eine Banane"],correct:0,why:"einen Apfel بالنص."}}]}];
function renderStories(){
  let h='<div class="panel glass"><h3>📖 قصص A1 قصيرة</h3><div class="muted">اقرأ واستمع وأجب — كل قصة 4 أجزاء.</div></div><div class="grid-2">'+STORIES.map(s=>'<div class="panel glass"><h4>'+s.t+'</h4><div class="muted">'+s.parts.length+' أجزاء</div><button class="btn btn-primary sm" data-st="'+s.id+'">اقرأ 📖</button></div>').join("")+'</div><div id="storyBox"></div>';
  h+='<div class="panel glass"><h3>🎧 محقق الاستماع</h3><div class="muted">استمع للحوار وأجب: من؟ أين؟ ماذا؟ متى؟</div><div class="row-flex"><button class="btn btn-primary sm" id="detGo">ابدأ التحقيق 🕵️</button></div><div id="detBox"></div></div>';
  $("storiesBox").innerHTML=h;
  $("storiesBox").querySelectorAll("[data-st]").forEach(b=>b.addEventListener("click",()=>openStory(b.getAttribute("data-st"))));
  $("detGo").addEventListener("click",startDetective);
}
function openStory(id){
  const s=STORIES.find(x=>x.id===id);if(!s)return;
  const box=$("storyBox");let i=0,score=0;
  function part(){
    if(i>=s.parts.length){
      addXP(20,"story");save();checkAch();
      box.innerHTML='<div class="quiz-feedback ok">أنهيت قصة '+s.t+' — إجابات صحيحة: '+score+'/'+s.parts.length+' ⭐+20</div>';return;
    }
    const p=s.parts[i];
    box.innerHTML='<div class="muted">جزء '+(i+1)+'/'+s.parts.length+'</div><div class="panel glass"><div class="ex-de-l" style="font-size:18px">'+escapeHtml(p.de)+' <button class="mini-btn" id="stHear">🔊</button></div><div class="ex-ar">'+escapeHtml(p.ar)+'</div><div class="muted">📚 '+p.voc.map(v=>escapeHtml(v[0])+" = "+escapeHtml(v[1])).join(" • ")+'</div></div><h4>'+escapeHtml(p.q.t)+'</h4><div class="quiz-opts">'+p.q.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="stFb"></div>';
    $("stHear").addEventListener("click",()=>speakGerman(p.de));
    setTimeout(()=>speakGerman(p.de),300);
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("stFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===p.q.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+p.q.why;score++;}
      else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[p.q.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ "+p.q.why;}
      setTimeout(()=>{i++;part();},2000);
    }));
  }
  part();box.scrollIntoView({behavior:"smooth"});
}
/* Listening Detective */
const DETS=[
{dlg:[["Entschuldigung, wo ist der Bahnhof?","عذرًا، أين محطة القطار؟"],["Geradeaus, dann links.","للأمام ثم يسارًا."]],voc:[["der Bahnhof","محطة القطار"],["links","يسارًا"]],qs:[{t:"Wo will er hin?",opts:["Zum Bahnhof","Nach Hause","Zur Schule"],correct:0},{t:"Wie geht es weiter?",opts:["Geradeaus, dann links","Zurück","Mit dem Bus"],correct:0}]},
{dlg:[["Guten Tag! Einen Kaffee, bitte.","نهارك سعيد! قهوة من فضلك."],["Gern. Sonst noch etwas?","بكل سرور. شيء آخر؟"]],voc:[["der Kaffee","القهوة"],["sonst","وإلا/آخر"]],qs:[{t:"Was möchte er?",opts:["Einen Kaffee","Einen Tee","Ein Brot"],correct:0},{t:"Wer spricht zuerst?",opts:["Der Gast","Der Kellner","Niemand"],correct:0}]},
{dlg:[["Wann fährt der Zug nach Berlin?","متى يتحرك قطار برلين؟"],["Um halb acht, von Bahnsteig drei.","السابعة والنصف، من رصيف 3."]],voc:[["der Zug","القطار"],["der Bahnsteig","الرصيف"]],qs:[{t:"Wohin fährt der Zug?",opts:["Nach Berlin","Nach München","Nach Hamburg"],correct:0},{t:"Wann fährt er?",opts:["Um halb acht","Um acht","Um sieben"],correct:0}]}];
function startDetective(){
  const box=$("detBox");
  const d=DETS[Math.floor(Math.random()*DETS.length)];
  let qi=0,score=0;
  box.innerHTML='<div class="row-flex"><button class="btn btn-primary sm" id="detHear">🔊 اسمع الحوار</button></div><div class="panel glass">'+d.dlg.map(l=>'<div class="ex-de-l">'+escapeHtml(l[0])+'</div><div class="ex-ar">'+escapeHtml(l[1])+'</div>').join("")+'<div class="muted">📚 '+d.voc.map(v=>escapeHtml(v[0])+" = "+escapeHtml(v[1])).join(" • ")+'</div></div><div id="detQ"></div>';
  const playAll=()=>{let k=0;const next=()=>{if(k<d.dlg.length){speakGerman(d.dlg[k][0]);k++;setTimeout(next,2500);}};next();};
  $("detHear").addEventListener("click",playAll);
  setTimeout(playAll,300);
  function q(){
    if(qi>=d.qs.length){addXP(15,"detective");save();box.innerHTML+='<div class="quiz-feedback ok">تحقيق مكتمل: '+score+'/'+d.qs.length+' ⭐+15</div>';return;}
    const it=d.qs[qi];
    $("detQ").innerHTML='<h4>'+escapeHtml(it.t)+'</h4><div class="quiz-opts">'+it.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
    $("detQ").querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      $("detQ").querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===it.correct){b.classList.add("correct");score++;}
      else{b.classList.add("wrong");$("detQ").querySelectorAll(".quiz-opt")[it.correct].classList.add("correct");}
      qi++;setTimeout(q,1200);
    }));
  }
  q();
}
/* ---------- Survival+ (extends RealLife) & Ausbildung sim ---------- */
const SURV_EXTRA=[
{id:"anmeldung",t:"📝 Anmeldung",voc:[["die Anmeldung","التسجيل"],["das Bürgeramt","مكتب المواطنين"],["der Termin","الموعد"],["der Ausweis","الهوية"]],phr:[["Ich brauche einen Termin.","أحتاج موعدًا."],["Hier ist mein Pass.","هذا جواز سفري."],["Wo ist das Bürgeramt?","أين مكتب المواطنين؟"]],dlg:[["Guten Tag! Ich brauche eine Anmeldung.","نهارك سعيد! أحتاج تسجيلًا."],["Haben Sie einen Termin?","هل لديك موعد؟"],["Ja, hier bitte.","نعم، تفضل."],["Danke!","شكرًا!"]]},
{id:"apotheke",t:"💊 الصيدلية",voc:[["die Apotheke","الصيدلية"],["das Rezept","الروشتة"],["die Tablette","القرص"],["die Schmerzen","الآلام"]],phr:[["Ich habe ein Rezept.","لدي روشتة."],["Ich habe Kopfschmerzen.","لدي صداع."],["Zweimal täglich.","مرتين يوميًا."]],dlg:[["Guten Tag! Ich habe ein Rezept.","نهارك سعيد! لدي روشتة."],["Bitte sehr. Zweimal täglich.","تفضل. مرتين يوميًا."],["Danke! Tschüs!","شكرًا! سلام!"],["Gute Besserung!","بالشفاء!"]]},
{id:"bus",t:"🚌 الأتوبيس",voc:[["die Haltestelle","المحطة"],["die Fahrkarte","التذكرة"],["der Fahrer","السائق"],["umsteigen","يغيّر المواصلة"]],phr:[["Wo ist die Haltestelle?","أين المحطة؟"],["Eine Fahrkarte, bitte.","تذكرة من فضلك."],["Muss ich umsteigen?","هل يجب أن أغيّر؟"]],dlg:[["Entschuldigung, fährt dieser Bus zum Bahnhof?","عذرًا، هل يذهب هذا الأتوبيس للمحطة؟"],["Ja, steigen Sie ein.","نعم، اركب."],["Danke!","شكرًا!"],["Bitte!","عفوًا!"]]},
{id:"hotel",t:"🏨 الفندق",voc:[["die Rezeption","الاستقبال"],["das Zimmer","الغرفة"],["der Schlüssel","المفتاح"],["das Frühstück","الإفطار"]],phr:[["Ich habe reserviert.","لدي حجز."],["Wo ist mein Zimmer?","أين غرفتي؟"],["Ist Frühstück dabei?","هل الإفطار مشمول؟"]],dlg:[["Guten Abend! Ich habe reserviert.","مساء الخير! لدي حجز."],["Ihr Name, bitte?","اسمك من فضلك؟"],["Ahmed. Hier ist der Schlüssel.","أحمد. هذا المفتاح."],["Danke!","شكرًا!"]]},
{id:"bewerbung",t:"📄 التقديم",voc:[["die Bewerbung","طلب التوظيف"],["die Unterlagen","الأوراق"],["die Stelle","الوظيفة"],["die Antwort","الرد"]],phr:[["Ich schicke meine Bewerbung.","أرسل طلب توظيفي."],["Hier sind meine Unterlagen.","هذه أوراقي."],["Wann bekomme ich Antwort?","متى يصلني الرد؟"]],dlg:[["Guten Tag! Ist die Stelle frei?","نهارك سعيد! هل الوظيفة متاحة؟"],["Ja. Schicken Sie Ihre Bewerbung.","نعم. أرسل طلبك."],["Danke! Tschüs!","شكرًا! سلام!"],["Viel Glück!","بالتوفيق!"]]},
{id:"supermarkt",t:"🛒 Supermarkt+",voc:[["der Einkaufszettel","قائمة المشتريات"],["die Kasse","الكاشير"],["das Pfand","التأمين/العربون"],["billig","رخيص"]],phr:[["Wo finde ich Milch?","أين أجد الحليب؟"],["Das ist billig.","هذا رخيص."],["Bar oder Karte?","نقدًا أم بطاقة؟"]],dlg:[["Hallo! Wo ist das Brot?","أهلًا! أين الخبز؟"],["Rechts, neben der Milch.","يمينًا، بجانب الحليب."],["Danke!","شكرًا!"],["Bitte!","عفوًا!"]]}];
try{if(typeof REAL_SITS!=="undefined")SURV_EXTRA.forEach(s=>{if(!REAL_SITS.find(x=>x.id===s.id))REAL_SITS.push(s);});}catch(e){}
/* Ausbildung interview simulator */
const JOB_SIM=[
{q:"Erzählen Sie etwas über sich.",ar:"حدثنا عن نفسك.",opts:["Ich heiße Omar. Ich bin zwanzig Jahre alt.", "Tschüs!", "Keine Ahnung."],correct:0,why:"التعريف الكامل: الاسم + العمر."},
{q:"Warum möchten Sie diese Ausbildung machen?",ar:"لماذا تريد هذا التدريب؟",opts:["Ich möchte lernen und arbeiten.", "Weiß nicht.", "Geld!"],correct:0,why:"إجابة جادة: التعلم والعمل."},
{q:"Was sind Ihre Stärken?",ar:"ما نقاط قوتك؟",opts:["Ich bin pünktlich und fleißig.", "Ich schlafe gern.", "Nichts."],correct:0,why:"صفتان إيجابيتان: دقيق ومجتهد."},
{q:"Haben Sie schon gearbeitet?",ar:"هل عملت من قبل؟",opts:["Ja, ein Jahr als Kellner.", "Nein, nie nichts.", "Vielleicht."],correct:0,why:"إجابة واضحة مع مهنة ومدة."},
{q:"Haben Sie Fragen an uns?",ar:"هل لديك أسئلة لنا؟",opts:["Wie sind die Arbeitszeiten?", "Nein.", "Wie viel Geld?"],correct:0,why:"سؤال مهني عن المواعيد أفضل من السؤال عن الراتب أولًا."}];
function renderSurvive(){
  let h='<div class="panel glass"><h3>🇩🇪 Germany Survival</h3><div class="muted">لو سافرت ألمانيا: تصرف في كل موقف. المواقف الجديدة مدمجة أيضًا في صفحة المواقف 🌍.</div><div class="grid-2">'+SURV_EXTRA.map(s=>'<button class="quick-btn" data-sv="'+s.id+'">'+s.t+'</button>').join("")+'</div></div><div id="survBox"></div>';
  h+='<div class="panel glass"><h3>🧑‍💼 محاكي مقابلة Ausbildung</h3><div class="muted">5 أسئلة مقابلة حقيقية — اختر أفضل رد.</div><div class="row-flex"><button class="btn btn-primary sm" id="jobSimGo">ابدأ المقابلة 🎤</button></div><div id="jobSimBox"></div></div>';
  $("surviveBox").innerHTML=h;
  $("surviveBox").querySelectorAll("[data-sv]").forEach(b=>b.addEventListener("click",()=>{showPage("real");setTimeout(()=>{try{openReal(b.getAttribute("data-sv"));}catch(e){}},200);}));
  $("jobSimGo").addEventListener("click",startJobSim);
}
function startJobSim(){
  const box=$("jobSimBox");let i=0,score=0;const usedVoc=["Bewerbung","Erfahrung","pünktlich","Arbeitszeiten"];
  function q(){
    if(i>=JOB_SIM.length){
      addXP(25,"jobsim");save();checkAch();
      box.innerHTML='<div class="quiz-feedback ok">📋 تقرير المقابلة: '+score+'/'+JOB_SIM.length+'<br>📚 كلمات استخدمتها: '+usedVoc.join("، ")+'<br>'+(score>=4?"ممتاز! جاهز للمقابلة الحقيقية 🎉":"درّب إجاباتك وحاول مجددًا 💪")+' ⭐+25</div>';return;
    }
    const it=JOB_SIM[i];
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+JOB_SIM.length+'</div><h4>'+escapeHtml(it.q)+'</h4><div class="muted">'+escapeHtml(it.ar)+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="jsHear">🔊 اسمع</button></div><div class="quiz-opts">'+it.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="jsFb"></div>';
    $("jsHear").addEventListener("click",()=>speakGerman(it.q));
    setTimeout(()=>speakGerman(it.q),300);
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("jsFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===it.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="إجابة مهنية ✅ "+it.why;score++;}
      else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[it.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="الأفضل: "+it.opts[it.correct]+" — لماذا؟ "+it.why;}
      setTimeout(()=>{i++;q();},2000);
    }));
  }
  q();box.scrollIntoView({behavior:"smooth"});
}
/* ---------- wiring ---------- */
const WORLD_PAGES={world:renderWorld,stories:renderStories,survive:renderSurvive};
(function(){
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(WORLD_PAGES[n])WORLD_PAGES[n]();}catch(e){console.error(e);}};
  }catch(e){console.error(e);}
})();

