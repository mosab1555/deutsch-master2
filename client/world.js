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
{id:"tag",t:"📖 Ein Tag in Berlin",lvl:"A1 Easy",parts:[
 {de:"Am Morgen trinke ich Kaffee. Dann fahre ich mit dem Bus in die Stadt.",ar:"في الصباح أشرب قهوة. ثم أذهب بالأتوبيس إلى المدينة.",voc:[["der Morgen","الصباح"],["der Bus","الأتوبيس"],["die Stadt","المدينة"]],q:{t:"Womit fährt er in die Stadt?",opts:["Mit dem Bus","Mit dem Auto","Zu Fuß"],correct:0,why:"mit dem Bus = بالأوتوبيس."}},
 {de:"Am Nachmittag besuche ich ein Museum. Das Museum ist groß und interessant.",ar:"بعد الظهر أزور متحفًا. المتحف كبير وشيق.",voc:[["der Nachmittag","بعد الظهر"],["das Museum","المتحف"],["interessant","شيق"]],q:{t:"Wie ist das Museum?",opts:["Klein und laut","Groß und interessant","Teuer"],correct:1,why:"groß und interessant مذكوران بالنص."}},
 {de:"Am Abend esse ich mit Freunden Pizza. Wir trinken Wasser.",ar:"في المساء آكل بيتزا مع الأصدقاء. نشرب ماء.",voc:[["der Abend","المساء"],["die Pizza","البيتزا"],["das Wasser","الماء"]],q:{t:"Was essen sie?",opts:["Fisch","Pizza","Brot"],correct:1,why:"Pizza مذكورة بالنص."}},
 {de:"In der Nacht schlafe ich. Gute Nacht!",ar:"في الليل أنام. ليلة سعيدة!",voc:[["die Nacht","الليل"],["schlafen","ينام"]],q:{t:"Was macht er in der Nacht?",opts:["Er arbeitet","Er schläft","Er lernt"],correct:1,why:"schlafen = ينام."}},
 {de:"Ich kaufe eine Fahrkarte. Sie kostet drei Euro.",ar:"أشتري تذكرة. سعرها 3 يورو.",voc:[["die Fahrkarte","التذكرة"],["kosten","يتكلف"]],q:{t:"Wie viel kostet die Fahrkarte?",opts:["Drei Euro","Fünf Euro","Zehn Euro"],correct:0,why:"drei Euro بالنص."}},
 {de:"Im Museum sehe ich alte Bilder. Sie sind sehr schön.",ar:"في المتحف أرى صورًا قديمة. هي جميلة جدًا.",voc:[["das Bild","الصورة"],["alt","قديم"],["schön","جميل"]],q:{t:"Was sieht er im Museum?",opts:["Alte Bilder","Neue Autos","Alte Bücher"],correct:0,why:"alte Bilder بالنص."}},
 {de:"Am Abend treffe ich Jonas. Wir essen zusammen.",ar:"في المساء أقابل يوناس. نأكل معًا.",voc:[["treffen","يقابل"],["zusammen","معًا"]],q:{t:"Wen trifft er?",opts:["Jonas","Ali","Niemanden"],correct:0,why:"Jonas بالنص."}},
 {de:"Ich fahre nach Hause. Es war ein schöner Tag!",ar:"أعود للبيت. كان يومًا جميلًا!",voc:[["nach Hause","إلى البيت"],["der Tag","اليوم"]],q:{t:"Wie war der Tag?",opts:["Schön","Schlecht","Langweilig"],correct:0,why:"ein schöner Tag بالنص."}}]},
{id:"nachbar",t:"📖 Der neue Nachbar",lvl:"A1 Easy",parts:[
 {de:"Hallo! Ich heiße Jonas. Ich wohne jetzt hier.",ar:"أهلًا! اسمي يوناس. أسكن هنا الآن.",voc:[["der Nachbar","الجار"],["jetzt","الآن"]],q:{t:"Wer spricht?",opts:["Ali","Jonas","Sara"],correct:1,why:"Ich heiße Jonas."}},
 {de:"Woher kommst du, Jonas?",ar:"من أين أنت يا يوناس؟",voc:[["woher","من أين"]],q:{t:"Worum geht es?",opts:["Herkunft","Essen","Wetter"],correct:0,why:"Woher = عن الأصل."}},
 {de:"Ich komme aus Hamburg. Und du?",ar:"أنا من هامبورج. وأنت؟",voc:[["Hamburg","هامبورج"]],q:{t:"Woher kommt Jonas?",opts:["Aus Berlin","Aus Hamburg","Aus München"],correct:1,why:"aus Hamburg مذكورة."}},
 {de:"Willkommen! Kommst du morgen zum Tee?",ar:"أهلًا بك! هل تأتي غدًا للشاي؟",voc:[["willkommen","أهلًا بك"],["der Tee","الشاي"]],q:{t:"Wozu lädt er ihn ein?",opts:["Zum Film","Zum Tee","Zum Essen"],correct:1,why:"zum Tee = للشاي."}},
 {de:"Jonas trinkt gern Tee. Ich koche Wasser.",ar:"يوناس يحب الشاي. أغلي ماء.",voc:[["gern","بسرور"],["kochen","يغلي/يطبخ"],["das Wasser","الماء"]],q:{t:"Was trinkt Jonas gern?",opts:["Tee","Kaffee","Milch"],correct:0,why:"trinkt gern Tee بالنص."}},
 {de:"Wir sitzen zusammen. Wir sprechen über Hamburg.",ar:"نجلس معًا. نتحدث عن هامبورج.",voc:[["sitzen","يجلس"],["sprechen über","يتحدث عن"]],q:{t:"Worüber sprechen sie?",opts:["Über Hamburg","Über Berlin","Über Arbeit"],correct:0,why:"über Hamburg بالنص."}},
 {de:"Am Samstag kommt Jonas zu mir. Wir sehen einen Film.",ar:"يوم السبت يأتي يوناس إليّ. نشاهد فيلمًا.",voc:[["der Samstag","السبت"],["der Film","الفيلم"]],q:{t:"Was machen sie am Samstag?",opts:["Sie sehen einen Film","Sie arbeiten","Sie schlafen"],correct:0,why:"sehen einen Film بالنص."}},
 {de:"Jetzt sind wir Freunde. Tschüs, bis morgen!",ar:"الآن نحن أصدقاء. سلام، إلى الغد!",voc:[["der Freund","الصديق"],["morgen","غدًا"]],q:{t:"Sind sie Freunde?",opts:["Nein","Ja","Vielleicht"],correct:1,why:"Jetzt sind wir Freunde."}}]},
{id:"markt",t:"📖 Einkaufen am Samstag",lvl:"A1 Easy",parts:[
 {de:"Am Samstag gehe ich auf den Markt. Ich brauche Obst und Brot.",ar:"يوم السبت أذهب إلى السوق. أحتاج فاكهة وخبزًا.",voc:[["der Markt","السوق"],["das Obst","الفاكهة"],["das Brot","الخبز"]],q:{t:"Was braucht er?",opts:["Fisch","Obst und Brot","Milch"],correct:1,why:"Obst und Brot بالنص."}},
 {de:"Die Äpfel kosten zwei Euro. Das ist billig!",ar:"التفاح بسعر 2 يورو. هذا رخيص!",voc:[["der Apfel","التفاحة"],["billig","رخيص"]],q:{t:"Wie viel kosten die Äpfel?",opts:["Zwei Euro","Fünf Euro","Zehn Euro"],correct:0,why:"zwei Euro بالنص."}},
 {de:"An der Kasse zahle ich. Vielen Dank!",ar:"عند الكاشير أدفع. شكرًا جزيلًا!",voc:[["die Kasse","الكاشير"],["zahlen","يدفع"]],q:{t:"Wo zahlt er?",opts:["Zu Hause","An der Kasse","Im Bus"],correct:1,why:"An der Kasse بالنص."}},
 {de:"Zu Hause esse ich einen Apfel. Lecker!",ar:"في البيت آكل تفاحة. لذيذ!",voc:[["lecker","لذيذ"],["zu Hause","في البيت"]],q:{t:"Was isst er?",opts:["Ein Brot","Einen Apfel","Eine Banane"],correct:1,why:"einen Apfel بالنص."}},
 {de:"Ich brauche auch Milch. Wo ist die Milch?",ar:"أحتاج حليبًا أيضًا. أين الحليب؟",voc:[["die Milch","الحليب"],["auch","أيضًا"]],q:{t:"Was braucht er noch?",opts:["Milch","Fisch","Käse"],correct:0,why:"Milch بالنص."}},
 {de:"Der Käse kostet vier Euro. Das ist teuer!",ar:"الجبن بسعر 4 يورو. هذا غالٍ!",voc:[["der Käse","الجبن"],["teuer","غالٍ"]],q:{t:"Wie ist der Käse?",opts:["Billig","Teuer","Lecker"],correct:1,why:"teuer بالنص."}},
 {de:"Ich zahle an der Kasse. Ich habe kein Kleingeld.",ar:"أدفع عند الكاشير. ليس معي فكة.",voc:[["das Kleingeld","الفكة"],["kein","لا/ليس"]],q:{t:"Was hat er nicht?",opts:["Kleingeld","Zeit","Milch"],correct:0,why:"kein Kleingeld بالنص."}},
 {de:"Zu Hause koche ich Suppe. Guten Appetit!",ar:"في البيت أطبخ شوربة. بالهناء!",voc:[["kochen","يطبخ"],["die Suppe","الشوربة"]],q:{t:"Was kocht er?",opts:["Suppe","Fisch","Reis"],correct:0,why:"Suppe بالنص."}}]},
{id:"flug",t:"🚆 Der falsche Zug",lvl:"A1 Challenge",parts:[
 {de:"Paul fährt nach Hamburg. Er wartet am Bahnhof.",ar:"باول يسافر إلى هامبورج. ينتظر في المحطة.",voc:[["fahren","يسافر"],["der Bahnhof","المحطة"],["warten","ينتظر"]],q:{t:"Wohin fährt Paul?",opts:["Nach Berlin","Nach Hamburg","Nach München"],correct:1,why:"nach Hamburg بالنص."}},
 {de:"Der Zug kommt. Paul steigt schnell ein.",ar:"يأتي القطار. يركب باول بسرعة.",voc:[["der Zug","القطار"],["einsteigen","يركب"],["schnell","بسرعة"]],q:{t:"Was macht Paul?",opts:["Er wartet","Er steigt ein","Er schläft"],correct:1,why:"steigt ein بالنص."}},
 {de:"Oh nein! Das ist der falsche Zug!",ar:"أوه لا! هذا القطار الخطأ!",voc:[["falsch","خطأ/خاطئ"],["oh nein","أوه لا"]],q:{t:"Was ist das Problem?",opts:["Der falsche Zug","Kein Ticket","Kein Geld"],correct:0,why:"der falsche Zug بالنص."}},
 {de:"Paul fragt einen Mann: Fährt dieser Zug nach Hamburg?",ar:"يسأل باول رجلًا: هل يذهب هذا القطار إلى هامبورج؟",voc:[["fragen","يسأل"],["dieser","هذا"]],q:{t:"Wen fragt Paul?",opts:["Einen Mann","Eine Frau","Niemanden"],correct:0,why:"einen Mann بالنص."}},
 {de:"Nein! Dieser Zug fährt nach München.",ar:"لا! هذا القطار يذهب إلى ميونخ.",voc:[["München","ميونخ"],["nein","لا"]],q:{t:"Wohin fährt der Zug?",opts:["Nach Hamburg","Nach München","Nach Berlin"],correct:1,why:"nach München بالنص."}},
 {de:"Paul steigt in Hannover aus. Er wartet eine Stunde.",ar:"ينزل باول في هانوفر. ينتظر ساعة.",voc:[["aussteigen","ينزل"],["die Stunde","الساعة (زمن)"]],q:{t:"Wo steigt Paul aus?",opts:["In Hannover","In Berlin","In Hamburg"],correct:0,why:"in Hannover بالنص."}},
 {de:"Endlich kommt der richtige Zug. Paul lacht.",ar:"أخيرًا يأتي القطار الصحيح. يضحك باول.",voc:[["endlich","أخيرًا"],["richtig","صحيح"],["lachen","يضحك"]],q:{t:"Wie ist der Zug?",opts:["Falsch","Richtig","Teuer"],correct:1,why:"der richtige Zug بالنص."}},
 {de:"Am Abend ist Paul in Hamburg. Ende gut, alles gut!",ar:"في المساء باول في هامبورج. نهاية سعيدة!",voc:[["der Abend","المساء"],["das Ende","النهاية"]],q:{t:"Wo ist Paul am Ende?",opts:["In Hamburg","In München","Zu Hause"],correct:0,why:"in Hamburg بالنص."}}]},
{id:"arzt",t:"🏥 Beim Arzt",lvl:"A1 Normal",parts:[
 {de:"Anna hat Kopfschmerzen. Sie ruft den Arzt an.",ar:"آنا لديها صداع. تتصل بالطبيب.",voc:[["die Kopfschmerzen","الصداع"],["anrufen","يتصل"]],q:{t:"Was hat Anna?",opts:["Kopfschmerzen","Husten","Fieber"],correct:0,why:"Kopfschmerzen بالنص."}},
 {de:"Guten Tag! Ich brauche einen Termin.",ar:"نهارك سعيد! أحتاج موعدًا.",voc:[["der Termin","الموعد"],["brauchen","يحتاج"]],q:{t:"Was braucht Anna?",opts:["Einen Termin","Ein Brot","Ein Taxi"],correct:0,why:"einen Termin بالنص."}},
 {de:"Im Wartezimmer sitzen viele Leute. Anna wartet.",ar:"في غرفة الانتظار يجلس ناس كثيرون. تنتظر آنا.",voc:[["das Wartezimmer","غرفة الانتظار"],["die Leute","الناس"]],q:{t:"Wo wartet Anna?",opts:["Im Wartezimmer","Zu Hause","Im Bus"],correct:0,why:"Im Wartezimmer بالنص."}},
 {de:"Der Arzt fragt: Was fehlt Ihnen?",ar:"يسأل الطبيب: ما مشكلتك؟",voc:[["der Arzt","الطبيب"],["fehlen","ينقص/يوجع"]],q:{t:"Wer fragt?",opts:["Der Arzt","Die Schwester","Niemand"],correct:0,why:"Der Arzt fragt بالنص."}},
 {de:"Mein Kopf tut weh. Und mir ist kalt.",ar:"رأسي يؤلمني. وأشعر بالبرد.",voc:[["wehtun","يؤلم"],["kalt","بارد"]],q:{t:"Wie fühlt sich Anna?",opts:["Gut","Krank und kalt","Müde"],correct:1,why:"tut weh + kalt بالنص."}},
 {de:"Der Arzt gibt ihr ein Rezept. Zweimal täglich!",ar:"يعطيها الطبيب روشتة. مرتين يوميًا!",voc:[["das Rezept","الروشتة"],["täglich","يوميًا"]],q:{t:"Was bekommt Anna?",opts:["Ein Rezept","Ein Buch","Ein Brot"],correct:0,why:"ein Rezept بالنص."}},
 {de:"In der Apotheke kauft sie Tabletten.",ar:"في الصيدلية تشتري أقراصًا.",voc:[["die Apotheke","الصيدلية"],["die Tablette","القرص"]],q:{t:"Wo kauft sie Tabletten?",opts:["In der Apotheke","Im Supermarkt","Im Kino"],correct:0,why:"In der Apotheke بالنص."}},
 {de:"Zu Hause bleibt Anna im Bett. Gute Besserung!",ar:"في البيت تبقى آنا في السرير. بالشفاء!",voc:[["das Bett","السرير"],["die Besserung","الشفاء"]],q:{t:"Wo bleibt Anna?",opts:["Im Bett","Im Büro","Im Park"],correct:0,why:"im Bett بالنص."}}]},
{id:"wohnung",t:"🏠 Neue Wohnung",lvl:"A1 Normal",parts:[
 {de:"Sara sucht eine Wohnung. Berlin ist teuer!",ar:"تبحث سارة عن شقة. برلين غالية!",voc:[["suchen","يبحث"],["die Wohnung","الشقة"]],q:{t:"Was sucht Sara?",opts:["Eine Wohnung","Arbeit","Ein Auto"],correct:0,why:"eine Wohnung بالنص."}},
 {de:"Sie liest eine Anzeige: Zwei Zimmer, 600 Euro.",ar:"تقرأ إعلانًا: غرفتان بـ 600 يورو.",voc:[["die Anzeige","الإعلان"],["das Zimmer","الغرفة"]],q:{t:"Wie viele Zimmer?",opts:["Zwei","Drei","Eins"],correct:0,why:"Zwei Zimmer بالنص."}},
 {de:"Sara ruft den Vermieter an. Er ist nett.",ar:"تتصل سارة بالمالك. هو لطيف.",voc:[["der Vermieter","المالك"],["nett","لطيف"]],q:{t:"Wen ruft Sara an?",opts:["Den Vermieter","Den Arzt","Die Mutter"],correct:0,why:"den Vermieter بالنص."}},
 {de:"Am Samstag sieht sie die Wohnung. Sie ist hell und schön.",ar:"يوم السبت ترى الشقة. هي مضيئة وجميلة.",voc:[["hell","مضيء"],["schön","جميل"]],q:{t:"Wie ist die Wohnung?",opts:["Hell und schön","Klein und dunkel","Teuer"],correct:0,why:"hell und schön بالنص."}},
 {de:"Die Miete ist 600 Euro. Die Kaution ist 1200 Euro.",ar:"الإيجار 600 يورو. التأمين 1200 يورو.",voc:[["die Miete","الإيجار"],["die Kaution","التأمين"]],q:{t:"Wie hoch ist die Miete?",opts:["600 Euro","1200 Euro","6000 Euro"],correct:0,why:"600 Euro بالنص."}},
 {de:"Sara unterschreibt den Vertrag. Sie ist glücklich!",ar:"توقع سارة العقد. هي سعيدة!",voc:[["unterschreiben","يوقع"],["der Vertrag","العقد"],["glücklich","سعيد"]],q:{t:"Was unterschreibt Sara?",opts:["Den Vertrag","Ein Buch","Nichts"],correct:0,why:"den Vertrag بالنص."}},
 {de:"Am Sonntag zieht sie um. Freunde helfen ihr.",ar:"يوم الأحد تنتقل. يساعدها الأصدقاء.",voc:[["umziehen","ينتقل"],["helfen","يساعد"]],q:{t:"Wer hilft ihr?",opts:["Freunde","Niemand","Der Chef"],correct:0,why:"Freunde helfen بالنص."}},
 {de:"Jetzt wohnt Sara in Berlin. Willkommen zu Hause!",ar:"الآن تسكن سارة في برلين. أهلًا بك في بيتك!",voc:[["wohnen","يسكن"],["zu Hause","في البيت"]],q:{t:"Wo wohnt Sara jetzt?",opts:["In Berlin","In Hamburg","In München"],correct:0,why:"in Berlin بالنص."}}]},
{id:"fussball",t:"⚽ Fußball!",lvl:"A1 Easy",parts:[
 {de:"Ali spielt gern Fußball. Er spielt jeden Samstag.",ar:"يحب علي كرة القدم. يلعب كل سبت.",voc:[["der Fußball","كرة القدم"],["jeden Samstag","كل سبت"]],q:{t:"Wann spielt Ali?",opts:["Jeden Samstag","Jeden Tag","Nie"],correct:0,why:"jeden Samstag بالنص."}},
 {de:"Heute spielt seine Mannschaft. Das Wetter ist gut.",ar:"اليوم يلعب فريقه. الطقس جيد.",voc:[["die Mannschaft","الفريق"],["das Wetter","الطقس"]],q:{t:"Wie ist das Wetter?",opts:["Gut","Schlecht","Kalt"],correct:0,why:"gut بالنص."}},
 {de:"Ali schießt ein Tor! Alle rufen: Tor! Tor!",ar:"يسجل علي هدفًا! الجميع يصرخ: هدف!",voc:[["das Tor","الهدف"],["rufen","يصرخ"]],q:{t:"Was schießt Ali?",opts:["Ein Tor","Einen Ball","Nichts"],correct:0,why:"ein Tor بالنص."}},
 {de:"Zur Halbzeit steht es 1:0. Ali trinkt Wasser.",ar:"في الشوط الأول النتيجة 1:0. يشرب علي ماء.",voc:[["die Halbzeit","الشوط الأول"],["das Wasser","الماء"]],q:{t:"Wie steht es?",opts:["1:0","0:0","2:0"],correct:0,why:"1:0 بالنص."}},
 {de:"Nach dem Spiel essen alle Pizza.",ar:"بعد المباراة يأكل الجميع بيتزا.",voc:[["nach","بعد"],["das Spiel","المباراة"]],q:{t:"Was essen sie?",opts:["Pizza","Fisch","Brot"],correct:0,why:"Pizza بالنص."}},
 {de:"Ali ist müde, aber glücklich.",ar:"علي متعب لكن سعيد.",voc:[["müde","متعب"],["aber","لكن"]],q:{t:"Wie ist Ali?",opts:["Müde, aber glücklich","Traurig","Krank"],correct:0,why:"müde, aber glücklich بالنص."}},
 {de:"Am Abend sieht Ali Fotos. Schön!",ar:"في المساء يشاهد علي الصور. جميل!",voc:[["das Foto","الصورة"]],q:{t:"Was sieht Ali?",opts:["Fotos","Filme","Bücher"],correct:0,why:"Fotos بالنص."}},
 {de:"Fußball ist super! Bis nächsten Samstag!",ar:"كرة القدم رائعة! إلى السبت القادم!",voc:[["super","رائع"],["nächsten","القادم"]],q:{t:"Wann spielen sie wieder?",opts:["Nächsten Samstag","Morgen","Nie"],correct:0,why:"nächsten Samstag بالنص."}}]},
{id:"geburtstag",t:"🎉 Geburtstag",lvl:"A1 Easy",parts:[
 {de:"Sara hat morgen Geburtstag. Sie wird zwanzig.",ar:"عيد ميلاد سارة غدًا. ستتم العشرين.",voc:[["der Geburtstag","عيد الميلاد"],["morgen","غدًا"]],q:{t:"Wann hat Sara Geburtstag?",opts:["Morgen","Heute","Gestern"],correct:0,why:"morgen بالنص."}},
 {de:"Sie backt einen Kuchen. Schokolade!",ar:"تخبز كعكة. شيكولاتة!",voc:[["backen","يخبز"],["der Kuchen","الكعك"]],q:{t:"Was backt Sara?",opts:["Einen Kuchen","Brot","Pizza"],correct:0,why:"einen Kuchen بالنص."}},
 {de:"Sie lädt Freunde ein. Alle kommen gern.",ar:"تدعو أصدقاء. يأتي الجميع بسرور.",voc:[["einladen","يدعو"],["der Freund","الصديق"]],q:{t:"Wen lädt Sara ein?",opts:["Freunde","Niemanden","Lehrer"],correct:0,why:"Freunde بالنص."}},
 {de:"Die Gäste bringen Geschenke. Sara lacht.",ar:"يحضر الضيوف هدايا. تضحك سارة.",voc:[["der Gast","الضيف"],["das Geschenk","الهدية"],["lachen","يضحك"]],q:{t:"Was bringen die Gäste?",opts:["Geschenke","Blumen","Nichts"],correct:0,why:"Geschenke بالنص."}},
 {de:"Alle singen: Zum Geburtstag viel Glück!",ar:"يغني الجميع: عيد ميلاد سعيد!",voc:[["singen","يغني"],["das Glück","الحظ/السعادة"]],q:{t:"Was singen alle?",opts:["Ein Geburtstagslied","Ein Schlaflied","Nichts"],correct:0,why:"Zum Geburtstag viel Glück بالنص."}},
 {de:"Sara tanzt mit Jonas. Die Musik ist laut.",ar:"ترقص سارة مع يوناس. الموسيقى عالية.",voc:[["tanzen","يرقص"],["die Musik","الموسيقى"]],q:{t:"Mit wem tanzt Sara?",opts:["Mit Jonas","Allein","Mit Ali"],correct:0,why:"mit Jonas بالنص."}},
 {de:"Alle machen Fotos. Schön!",ar:"يلتقط الجميع صورًا. جميل!",voc:[["das Foto","الصورة"]],q:{t:"Was machen alle?",opts:["Fotos","Hausaufgaben","Nichts"],correct:0,why:"Fotos بالنص."}},
 {de:"Danke für alles! Es war ein schöner Tag.",ar:"شكرًا على كل شيء! كان يومًا جميلًا.",voc:[["danke","شكرًا"],["schön","جميل"]],q:{t:"Wie war der Tag?",opts:["Schön","Schlecht","Langweilig"],correct:0,why:"ein schöner Tag بالنص."}}]}];
function renderStories(){
  let h='<div class="panel glass"><h3>📖 قصص A1 (Easy → Normal → Challenge)</h3><div class="muted">اقرأ واستمع وأجب — كل قصة 8 أجزاء + اختبار نهائي.</div></div><div class="grid-2">'+STORIES.map(s=>{
    const done=S.journey&&S.journey.stories&&S.journey.stories[s.id];
    return '<div class="panel glass"><h4>'+s.t+'</h4><div class="muted">'+s.lvl+' • '+s.parts.length+' أجزاء '+(done?"✓":"")+'</div><button class="btn btn-primary sm" data-st="'+s.id+'">اقرأ 📖</button></div>';
  }).join("")+'</div><div id="storyBox"></div>';
  h+='<div class="panel glass"><h3>🎧 محقق الاستماع</h3><div class="muted">استمع للحوار وأجب: من؟ أين؟ ماذا؟ متى؟</div><div class="row-flex"><button class="btn btn-primary sm" id="detGo">ابدأ التحقيق 🕵️</button></div><div id="detBox"></div></div>';
  $("storiesBox").innerHTML=h;
  $("storiesBox").querySelectorAll("[data-st]").forEach(b=>b.addEventListener("click",()=>openStory(b.getAttribute("data-st"))));
  $("detGo").addEventListener("click",startDetective);
}
function storyVocHtml(voc){
  return voc.map(v=>{
    const w=(typeof findWord==="function")?findWord(v[0]):null;
    if(w)return '<button class="mini-btn" data-wid="'+w.id+'">'+escapeHtml(v[0])+' = '+escapeHtml(v[1])+'</button>';
    return '<span>'+escapeHtml(v[0])+" = "+escapeHtml(v[1])+'</span>';
  }).join(" • ");
}
function slowSpeak(t){try{const r=currentRate();S.settings.speed=0.5;save();speakGerman(t);S.settings.speed=r;save();}catch(e){speakGerman(t);}}
function openStory(id){
  const s=STORIES.find(x=>x.id===id);if(!s)return;
  const box=$("storyBox");let i=0,score=0;
  function bindVoc(scope){scope.querySelectorAll("[data-wid]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();try{openWordDetail(b.getAttribute("data-wid"));}catch(ex){}}));}
  function part(){
    if(i>=s.parts.length){finalQuiz();return;}
    const p=s.parts[i];
    const sh=shuffleOptions(p.q.opts,p.q.correct);
    box.innerHTML='<div class="muted">'+s.t+' • جزء '+(i+1)+'/'+s.parts.length+' • مستوى '+s.lvl+'</div><div class="panel glass"><div class="ex-de-l" style="font-size:18px">'+escapeHtml(p.de)+' <button class="mini-btn" id="stHear">🔊</button> <button class="mini-btn" id="stSlow">🐢</button></div><div class="ex-ar">'+escapeHtml(p.ar)+'</div><div class="muted">📚 '+storyVocHtml(p.voc)+'</div></div><h4>'+escapeHtml(p.q.t)+'</h4><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="stFb"></div>';
    $("stHear").addEventListener("click",()=>speakGerman(p.de));
    $("stSlow").addEventListener("click",()=>slowSpeak(p.de));
    bindVoc(box);
    setTimeout(()=>speakGerman(p.de),300);
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("stFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+p.q.why;score++;S.totalCorrect++;}
      else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ "+p.q.why;}
      S.totalAnswered++;save();setTimeout(()=>{i++;part();},2000);
    }));
  }
  function finalQuiz(){
    const sample=shuffle(s.parts.map((p,k)=>k)).slice(0,Math.min(5,s.parts.length));
    let fi=0,fscore=0;
    function fq(){
      if(fi>=sample.length){
        const acc=Math.round(score/s.parts.length*100);
        addXP(20,"story");if(S.journey){S.journey.stories=S.journey.stories||{};S.journey.stories[id]=1;}
        save();checkAch();
        box.innerHTML='<div class="panel glass" style="text-align:center">📖<h3>Story Quiz: '+s.t+'</h3><div>القصة: '+score+'/'+s.parts.length+' • المراجعة: '+fscore+'/'+sample.length+'</div><div>الدقة: '+acc+'% ⭐+20 XP</div><div class="row-flex"><button class="btn btn-primary sm" id="stBack">📖 القصص</button></div></div>';
        $("stBack").addEventListener("click",renderStories);return;
      }
      const p=s.parts[sample[fi]];
      const sh=shuffleOptions(p.q.opts,p.q.correct);
      box.innerHTML='<div class="muted">📖 تحدي القصة '+(fi+1)+'/'+sample.length+'</div><h4>'+escapeHtml(p.q.t)+'</h4><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="stFb2"></div>';
      box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
        const j=parseInt(b.getAttribute("data-j"),10);
        const fb=$("stFb2");fb.classList.remove("hidden");
        box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
        if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅";fscore++;}
        else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ "+p.q.why;}
        setTimeout(()=>{fi++;fq();},1600);
      }));
    }
    fq();
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
    const sh=shuffleOptions(it.opts,it.correct);
    $("detQ").innerHTML='<h4>'+escapeHtml(it.t)+'</h4><div class="quiz-opts">'+sh.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
    $("detQ").querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      $("detQ").querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===sh.correct){b.classList.add("correct");score++;}
      else{b.classList.add("wrong");$("detQ").querySelectorAll(".quiz-opt")[sh.correct].classList.add("correct");}
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

