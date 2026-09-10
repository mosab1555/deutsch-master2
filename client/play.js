/* Deutsch Master - Play systems: gamification core, SRS, adaptive, session,
   daily challenge, avatar/rewards, weekly report, recommendations.
   Additive only: wraps existing functions, migrates state safely. */
"use strict";
function ensurePlay(){
  if(!S.gstats)S.gstats={};
  if(!S.srs)S.srs={};
  if(!S.avatar)S.avatar={face:"🦊",frame:"none",title:""};
  if(!S.rewards)S.rewards={themes:[],frames:[],titles:[]};
  if(!S.freeze)S.freeze={n:0,used:0};
  if(!S.timeLog)S.timeLog={};
  if(!S.daily)S.daily={};
  if(!S.best)S.best={};
  if(!S.gweak)S.gweak={};
}
function todayPlus(d){const t=new Date();t.setDate(t.getDate()+d);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");}
/* session tracking (wraps addXP, backward compatible) */
const _sess={xp:0,n:0,ok:0,words:0,fixed:0,t0:Date.now(),acts:{}};
if(typeof addXP==="function"&&!addXP._wrapped){
  const _ax=addXP;
  addXP=function(n,src){const r=_ax(n);try{_sess.xp+=n;_sess.n++;if(src)_sess.acts[src]=(_sess.acts[src]||0)+n;}catch(e){}return r;};
  addXP._wrapped=true;
}
function sessTick(ok,word,fixed){
  _sess.n++;if(ok)_sess.ok++;if(word)_sess.words++;if(fixed)_sess.fixed++;
  try{const t=todayStr();S.timeLog[t]=(S.timeLog[t]||0)+0;save();}catch(e){}
}
setInterval(function(){
  try{const t=todayStr();S.timeLog[t]=(S.timeLog[t]||0)+1;save();}catch(e){}
},60000);
/* streak freeze: consume automatically when a day was missed */
(function(){
  try{
    ensurePlay();
    const t=todayStr(),y=todayPlus(-1);
    if(S.streak.last&&S.streak.last!==t&&S.streak.last!==y&&S.freeze.n>0){
      S.freeze.n--;S.freeze.used++;S.streak.last=y;save();
      setTimeout(()=>toast("🧊 Streak Freeze أنقذ سلسلتك!","ok"),2000);
    }
    const c=S.streak.count||0;
    if(c>=14&&!S.rewards.f14){S.rewards.f14=1;S.freeze.n++;save();}
  }catch(e){}
})();
/* SRS lite (SM-2 style): {e:ease, due:date, laps} — additive, old {c,w} kept */
function srsGet(id){ensurePlay();if(!S.srs[id])S.srs[id]={e:2.5,due:todayStr(),laps:0};return S.srs[id];}
function srsBump(id,ok){
  try{
    const s=srsGet(id);
    if(ok){s.laps++;s.e=Math.min(3,s.e+0.15);const gap=s.laps===1?1:s.laps===2?3:Math.round((s.laps-1)*s.e*2);const d=new Date();d.setDate(d.getDate()+gap);s.due=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
    else{s.laps=0;s.e=Math.max(1.3,s.e-0.3);s.due=todayStr();}
    save();
  }catch(e){}
}
if(typeof recordMistake==="function"&&!recordMistake._wrapped){
  const _rm=recordMistake;
  recordMistake=function(w,picked,kind){const r=_rm(w,picked,kind);try{if(w&&w.id)srsBump(w.id,false);}catch(e){}return r;};
  recordMistake._wrapped=true;
}
/* adaptive difficulty 0(easy)..2(hard) from rolling accuracy */
function gStat(key){ensurePlay();if(!S.gstats[key])S.gstats[key]={n:0,ok:0,best:0};return S.gstats[key];}
function gDiff(key){
  const s=gStat(key);
  if(s.n<6)return 0;
  const a=s.ok/s.n;
  if(a>=0.85)return 2;
  if(a>=0.6)return 1;
  return 0;
}
function gRecord(key,ok,score){
  const s=gStat(key);s.n++;if(ok)s.ok++;
  if(score!=null&&score>s.best)s.best=score;
  save();
}
/* personalized practice picker: SRS-due + mistakes + weak cats */
function weakWords(n){
  const words=allWords();
  const scored=words.map(w=>{
    let s=0;
    const m=S.mistakes&&S.mistakes[w.id];
    if(m)s+=Math.min(m.n,5)*3;
    const st=getStatus(w.id);
    if(st==="hard")s+=4;else if(st==="review")s+=2;else if(st==="new")s+=1;else if(st==="known")s-=2;
    const sr=S.srs&&S.srs[w.id];
    if(sr&&sr.due<=todayStr())s+=3;
    return {w:w,s:s};
  }).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  return scored.slice(0,n||8).map(x=>x.w);
}
function weakGrammar(n){
  const g=S.gweak||{};
  const ids=Object.keys(g).sort((a,b)=>g[b]-g[a]);
  const order=(typeof EXPLAIN_ORDER!=="undefined"?EXPLAIN_ORDER:GRAMMAR.map(x=>x.id));
  const rest=order.filter(id=>ids.indexOf(id)<0);
  return ids.concat(rest).slice(0,n||4).map(id=>GRAMMAR.find(x=>x.id===id)).filter(Boolean);
}
/* recommendations */
function recommend(){
  ensurePlay();
  const out=[];
  const due=weakWords(99).length;
  if(due>=8)out.push("🎯 راجع "+Math.min(due,12)+" كلمات ضعيفة من التدريب الذكي.");
  const order=(typeof EXPLAIN_ORDER!=="undefined"?EXPLAIN_ORDER:GRAMMAR.map(x=>x.id));
  const gl=Object.keys(S.journey&&S.journey.lessons||{}).length;
  if(gl<order.length){const nx=GRAMMAR.find(g=>g.id===order[gl]);if(nx)out.push("📚 أكمل درس: "+nx.title+".");}
  if((S.lstats.lok||0)<10)out.push("🎧 لديك استماع يحتاج تدريبًا.");
  if((S.testsTaken||0)<3)out.push("🎮 جرب Article Rush — سريع وممتع.");
  const cats={};
  Object.keys(S.mistakes||{}).forEach(id=>{const w=wordById(id);if(w&&w.cat)cats[w.cat]=(cats[w.cat]||0)+S.mistakes[id].n;});
  const top=Object.keys(cats).sort((a,b)=>cats[b]-cats[a])[0];
  if(top)out.push("🧠 أكثر أخطائك في: "+top+" — ركز عليها اليوم.");
  if(!out.length)out.push("🚀 ممتاز! جرّب Boss Battle أو التحدي اليومي.");
  return out.slice(0,3);
}
/* ---------- Games Hub ---------- */
const GAMES=[
{id:"rush",t:"⚡ Article Rush",d:"der/die/das بسرعة مع Combo"},
{id:"battle",t:"⚔️ Word Battle",d:"كلمة ضد الوقت"},
{id:"builder",t:"🧩 Sentence Builder",d:"رتّب الجملة"},
{id:"memory",t:"🃏 Memory Match",d:"طابق الأزواج"},
{id:"missing",t:"🕳️ Missing Word",d:"أكمل الفراغ"},
{id:"tf",t:"✅❌ True or False",d:"صح أم خطأ مع السبب"},
{id:"speed",t:"⏱️ Speed Translation",d:"60 ثانية"},
{id:"catch",t:"🎧 Listening Catch",d:"ماذا سمعت؟"},
{id:"detective",t:"🕵️ Grammar Detective",d:"اكتشف الخطأ"},
{id:"boss",t:"👹 Boss Battle",d:"اهزم الوحش"},
{id:"pic",t:"📸 Picture Words",d:"ما هذه؟"},
{id:"music",t:"🎵 Music Mode",d:"أكمل الأغنية"}];
function trickNouns(){return allWords().filter(w=>w.type==="اسم"&&w.art!=="-"&&/^[A-ZÄÖÜ]/.test(w.de));}
/* Safe option shuffling: Fisher-Yates over indices, correct answer remapped.
   Scoring/feedback/XP/mistakes must always use the returned .correct. */
function shuffleOptions(opts,correctIdx){
  const order=shuffle(opts.map((_,i)=>i));
  return {opts:order.map(i=>opts[i]),correct:order.indexOf(correctIdx)};
}
/* Balanced placement: never repeat the previous correct position for a key. */
var _lastPos={};
function balancedPos(n,key){
  const last=_lastPos[key];
  const choices=[];for(let i=0;i<n;i++)if(i!==last)choices.push(i);
  const p=choices[Math.floor(Math.random()*choices.length)];
  _lastPos[key]=p;return p;
}
function placeCorrect(allOpts,correctText,key){
  const others=allOpts.filter(o=>o!==correctText);
  const pos=balancedPos(allOpts.length,key);
  const out=[];let oi=0;
  for(let i=0;i<allOpts.length;i++){if(i===pos)out.push(correctText);else out.push(others[oi++]);}
  return {opts:out,correct:pos};
}
function gameOpts(box,opts,cb){
  box.innerHTML='<div class="quiz-opts">'+opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>';
  box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);cb(parseInt(b.getAttribute("data-j"),10),b);}));
}
function gameEnd(boxId,title,score,total,xp,key,extra){
  ensurePlay();gRecord(key,score/total>=0.6,score);
  addXP(xp,"game:"+key);markStudyDay();checkAch();
  const acc=total?Math.round(score/total*100):0;
  $(boxId).innerHTML='<div class="panel glass" style="text-align:center">🎉<h3>'+title+'</h3><div>النتيجة: '+score+'/'+total+' ('+acc+'%)</div><div>⭐+'+xp+' XP'+(extra||"")+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 العب مجددًا</button><button class="btn btn-ghost sm" data-go2="games">🎮 الألعاب</button></div></div>';
  $("gAgain").addEventListener("click",()=>startGame(key));
  $(boxId).querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-go2"))));
}
function renderGames(){
  ensurePlay();
  const mood=S.daily.mood||"🙂";
  $("gamesBox").innerHTML='<div class="panel glass"><h3>🎮 German Games</h3><div class="muted">مزاج اليوم: '+mood+' • العب وتعلّم واكسب XP حقيقيًا.</div><div class="row-flex"><button class="btn btn-ghost sm" id="moodBtn">😴🙂🔥 مزاجي</button><button class="btn btn-gold sm" data-go2="challenge">⚡ التحدي اليومي</button></div></div><div class="grid-2">'+GAMES.map(g=>{
    const s=gStat(g.id);
    return '<div class="panel glass"><h4>'+g.t+'</h4><div class="muted">'+g.d+'</div><div class="muted">أفضل نتيجة: '+(s.best||0)+' • لعب: '+s.n+'</div><button class="btn btn-primary sm" data-g="'+g.id+'">العب 🚀</button></div>';
  }).join("")+'</div><div id="gameBox"></div>';
  $("gamesBox").querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>startGame(b.getAttribute("data-g"))));
  $("gamesBox").querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-go2"))));
  $("moodBtn").addEventListener("click",()=>{
    const ms=["😴","🙂","🔥"];S.daily.mood=ms[(ms.indexOf(S.daily.mood||"🙂")+1)%3];save();renderGames();
    toast(S.daily.mood==="😴"?"وضع خفيف: 5 دقائق ولعبة واحدة":S.daily.mood==="🔥"?"وضع التحدي: جلسة كاملة!":"وضع عادي متوازن","ok");
  });
}
function startGame(id){
  const box=$("gameBox");if(!box){showPage("games");return;}
  box.scrollIntoView({behavior:"smooth"});
  ({rush:gRush,battle:gBattle,builder:gBuilder,memory:gMemory,missing:gMissing,tf:gTF,speed:gSpeed,catch:gCatch,detective:gDetective,boss:gBoss,pic:gPic,music:gMusic}[id]||gRush)(box);
}
/* Game 1: Article Rush */
function gRush(box){
  const diff=gDiff("rush");
  let pool=shuffle(trickNouns());
  if(diff===2)pool=pool.filter(w=>/^(die|das)/.test(fullDe(w))||w.de.length>8);
  pool=pool.slice(0,10);
  let i=0,score=0,combo=0,xp=0;
  const T=diff===2?6:diff===1?8:12;
  function q(){
    if(i>=pool.length){const bonus=combo>=10?20:combo>=5?10:0;gameEnd("gameBox","⚡ Article Rush",score,pool.length,xp+bonus+pool.length*2,"rush",(bonus?" • Combo 🔥":""));return;}
    const w=pool[i];let left=T;
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+' • ⏱️ <b id="gT">'+left+'</b> • 🔥'+combo+'</div><h3 style="direction:ltr;text-align:center;font-size:30px">'+escapeHtml(w.de)+'</h3><div class="muted" style="text-align:center">'+escapeHtml(w.ar)+'</div><div id="gQ"></div>';
    const timer=setInterval(()=>{left--;const e=$("gT");if(e)e.textContent=left;if(left<=0){clearInterval(timer);answer(-1);}},1000);
    gameOpts($("gQ"),["der","die","das"],j=>{clearInterval(timer);answer(j);});
    function answer(j){
      const ok=j===(w.art==="der"?0:w.art==="die"?1:2);
      if(ok){score++;combo++;const mult=combo>=10?3:combo>=5?2:1;xp+=5*mult;if(combo===5||combo===10)toast("🔥 Combo x"+mult+"!","ok");S.totalCorrect++;}
      else{combo=0;recordMistake(w,"article","rush");toast("❌ "+w.art+" "+w.de+" — احفظ الأداة مع الكلمة","err");}
      S.totalAnswered++;sessTick(ok,w.id,!ok&&false);save();i++;setTimeout(q,900);
    }
  }
  q();
}
/* Game 2: Word Battle */
function gBattle(box){
  const pool=shuffle(allWords()).slice(0,8);
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","⚔️ Word Battle",score,pool.length,score*5+10,"battle");return;}
    const w=pool[i],opts=shuffle([w.ar].concat(shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)));
    let left=10;
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+' • ⏱️ <b id="gT">'+left+'</b></div><h3 style="direction:ltr;text-align:center;font-size:28px">'+escapeHtml(fullDe(w))+'</h3><div id="gQ"></div>';
    const timer=setInterval(()=>{left--;const e=$("gT");if(e)e.textContent=left;if(left<=0){clearInterval(timer);answer(-1);}},1000);
    gameOpts($("gQ"),opts,j=>{clearInterval(timer);answer(j);});
    function answer(j){
      const ok=opts[j]===w.ar;
      if(ok){score++;S.totalCorrect++;}else{recordMistake(w,opts[j],"battle");toast("❌ "+fullDe(w)+" = "+w.ar,"err");}
      S.totalAnswered++;sessTick(ok,w.id);save();i++;setTimeout(q,900);
    }
  }
  q();
}
/* Game 3: Sentence Builder */
const BUILD_SENTS=[
["Ich","kaufe","heute","einen","Kaffee.","أشتري قهوة اليوم."],
["Wir","sehen","einen","Film.","نحن نشاهد فيلمًا."],
["Er","braucht","einen","Stift.","هو يحتاج قلمًا."],
["Meine","Schwester","wohnt","in","Berlin.","أختي تسكن في برلين."],
["Ich","lerne","jeden","Tag","Deutsch.","أتعلم الألمانية كل يوم."],
["Der","Bus","kommt","morgen.","الأتوبيس يأتي غدًا."],
["Hast","du","Zeit?","هل لديك وقت؟"],
["Ich","esse","einen","Apfel.","آكل تفاحة."],
["Am","Montag","gehe","ich","zur","Schule.","أذهب للمدرسة يوم الاثنين."],
["Meine","Mutter","kocht","heute.","أمي تطبخ اليوم."],
["Wir","trinken","keinen","Kaffee.","نحن لا نشرب قهوة."],
["Der","Hund","spielt","im","Garten.","الكلب يلعب في الحديقة."],
["Kommst","du","morgen?","هل تأتي غدًا؟"],
["Ich","habe","zwei","Brüder.","لدي أخوان."],
["Die","Katze","schläft.","القطة نائمة."],
["Er","liest","ein","Buch.","هو يقرأ كتابًا."]];
function shuffledChips(words){
  let opts=shuffle(words.map((w,k)=>({w:w,k:k})));
  for(let t=0;t<8&&opts.map(x=>x.w).join(" ")===words.join(" ");t++)opts=shuffle(words.map((w,k)=>({w:w,k:k})));
  return opts;
}
function gBuilder(box){
  const pool=shuffle(BUILD_SENTS).slice(0,6);
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","🧩 Sentence Builder",score,pool.length,score*4+12,"builder");return;}
    const s=pool[i],words=s.slice(0,-1),ar=s[s.length-1];
    let cur=[];
    const opts=shuffledChips(words);
    box.innerHTML='<div class="muted">جملة '+(i+1)+'/'+pool.length+' • '+escapeHtml(ar)+'</div><div class="order-answer" id="gAns"></div><div class="quiz-opts">'+opts.map(o=>'<button class="quiz-opt" data-k="'+o.k+'">'+escapeHtml(o.w)+'</button>').join("")+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="gClear">مسح</button><button class="btn btn-primary sm" id="gCheck">تحقق ✅</button></div><div class="quiz-feedback hidden" id="gFb"></div>';
    const ans=$("gAns");
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{const o=opts.find(x=>x.k==b.getAttribute("data-k"));cur.push(o);b.disabled=true;b.classList.add("used");const c=document.createElement("span");c.className="order-chip";c.textContent=o.w;ans.appendChild(c);}));
    $("gClear").addEventListener("click",()=>{cur=[];ans.innerHTML="";ans.classList.remove("good","bad");box.querySelectorAll(".quiz-opt").forEach(x=>{x.disabled=false;x.classList.remove("used");});});
    $("gCheck").addEventListener("click",()=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      const ok=cur.map(x=>x.w).join(" ")===words.join(" ");
      ans.classList.remove("good","bad");void ans.offsetWidth;ans.classList.add(ok?"good":"bad");
      if(ok){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ الفعل ثانيًا دائمًا!";score++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ الصحيح: "+words.join(" ")+" — لماذا؟ الفعل المُصرّف في المرتبة الثانية.";S.totalAnswered++;}
      S.totalAnswered+=ok?1:0;sessTick(ok);save();i++;setTimeout(q,2200);
    });
  }
  q();
}
/* Game 4: Memory Match */
function gMemory(box){
  const pool=shuffle(allWords().filter(w=>w.ar.length<25)).slice(0,6);
  let cards=[];
  pool.forEach((w,i)=>{cards.push({k:i,t:fullDe(w),ar:w.ar});cards.push({k:i,t:w.ar,ar:w.ar});});
  cards=shuffle(cards);
  let open=[],done=0,moves=0;
  box.innerHTML='<div class="muted">طابق الألماني مع العربي • حركات: <b id="gM">0</b></div><div class="quiz-opts" id="gMem" style="grid-template-columns:repeat(3,1fr)">'+cards.map((c,i)=>'<button class="quiz-opt" data-i="'+i+'">?</button>').join("")+'</div>';
  box.querySelectorAll("#gMem .quiz-opt").forEach(b=>b.addEventListener("click",()=>{
    const i=parseInt(b.getAttribute("data-i"),10);
    if(b.disabled||open.indexOf(i)>=0)return;
    b.textContent=cards[i].t;open.push(i);
    if(open.length===2){
      moves++;$("gM").textContent=moves;
      const[a,c]=open;
      if(cards[a].k===cards[c].k){
        box.querySelectorAll("#gMem .quiz-opt").forEach(x=>{if(open.indexOf(parseInt(x.getAttribute("data-i"),10))>=0){x.disabled=true;x.classList.add("correct");}});
        done++;open=[];
        if(done===pool.length){const xp=Math.max(10,30-moves);gameEnd("gameBox","🃏 Memory Match",pool.length,pool.length,xp,"memory"," • "+moves+" حركة");}
      }else{
        const o1=open;open=[];
        setTimeout(()=>{box.querySelectorAll("#gMem .quiz-opt").forEach(x=>{const ii=parseInt(x.getAttribute("data-i"),10);if(o1.indexOf(ii)>=0&&!x.disabled)x.textContent="?";});},800);
      }
    }
  }));
}
/* Game 5: Missing Word */
const MISS_ITEMS=[
["Ich ___ aus Ägypten.",["komme","komme ich","kommen","kommt"],0,"الفاعل ich يأخذ komme في الآخر؟ لا — الفعل ثانيًا: Ich komme."],
["Wir ___ einen Film.",["sehen","sehe","sieht","siehst"],0,"الفاعل wir يأخذ المصدر: sehen."],
["Er ___ einen Stift.",["braucht","brauche","brauchen","brauchst"],0,"er المفرد يأخذ t: braucht."],
["___ du Zeit?",["Hast","Haben","Hat","Habe"],0,"السؤال يبدأ بالفعل: Hast du؟"],
["Ich ___ heute zu Hause.",["bleibe","bleibst","bleibt","bleiben"],0,"ich تأخذ e: bleibe."],
["Er ___ gut Deutsch.",["spricht","spreche","sprichst","sprechen"],0,"er المفرد يأخذ t (مع تغير الجذر): spricht."],
["Kinder ___ im Garten.",["spielen","spielt","spiele","spielst"],0,"الجمع يأخذ المصدر: spielen."],
["___ kostet das?",["Was","Wer","Wo","Wann"],0,"السؤال عن الشيء = Was."]];
function gMissing(box){
  const pool=shuffle(MISS_ITEMS).slice(0,6);
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","🕳️ Missing Word",score,pool.length,score*5+10,"missing");return;}
    const m=pool[i];
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+'</div><h3 style="direction:ltr">'+escapeHtml(m[0])+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),m[1],j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===m[2]){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+m[3];score++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ "+m[3];}
      S.totalAnswered++;sessTick(j===m[2]);save();i++;setTimeout(q,2000);
    });
  }
  q();
}
/* Game 6: True or False */
const TF_ITEMS=[
["Berlin ist die Hauptstadt von Deutschland.",1,"برلين عاصمة ألمانيا فعلًا."],
["\"die Tisch\" ist korrekt.",0,"Tisch مذكر: der Tisch وليست die."],
["\"Ich habe einen Apfel\" ist korrekt.",1,"Apfel مذكر مفعول → einen."],
["Sieben Tage sind eine Woche.",1,"الأسبوع 7 أيام فعلًا."],
["\"halb vier\" bedeutet 4:30.",0,"halb تُحسب للقادمة: halb vier = 3:30."],
["\"Ich bin ein Student\" ist immer falsch.",0,"مع المهن تُقبل بدون أداة غالبًا لكن ein ليست خطأ دائمًا — الأفضل: Ich bin Student."],
["\"Danke\" antwortet man: \"Bitte\".",1,"الرد على الشكر: Bitte/Kein Problem."],
["\"Guten Nacht\" ist korrekt.",0,"الصحيح: Gute Nacht (مؤنثة بدون n)."]];
function gTF(box){
  const pool=shuffle(TF_ITEMS).slice(0,6);
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","✅❌ True or False",score,pool.length,score*5+10,"tf");return;}
    const m=pool[i];
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+'</div><h3 style="direction:ltr">'+escapeHtml(m[0])+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),["✅ صحيح","❌ خطأ"],j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===m[1]){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+m[2];score++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ "+m[2];}
      S.totalAnswered++;sessTick(j===m[1]);save();i++;setTimeout(q,2200);
    });
  }
  q();
}
/* Game 7: Speed Translation (60s) */
function gSpeed(box){
  const pool=shuffle(allWords());
  let i=0,score=0,total=0,left=60,timer=null;
  box.innerHTML='<div class="muted">⏱️ <b id="gT">60</b> ثانية • النقاط: <b id="gS">0</b></div><h3 id="gW" style="direction:ltr;text-align:center;font-size:28px"></h3><div id="gQ"></div>';
  timer=setInterval(()=>{left--;const e=$("gT");if(e)e.textContent=left;if(left<=0){clearInterval(timer);end();}},1000);
  function q(){
    const w=pool[i%pool.length];i++;
    $("gW").textContent=fullDe(w);
    const opts=shuffle([w.ar].concat(shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)));
    gameOpts($("gQ"),opts,j=>{
      total++;
      if(opts[j]===w.ar){score++;S.totalCorrect++;}else{recordMistake(w,opts[j],"speed");}
      S.totalAnswered++;save();$("gS").textContent=score;q();
    });
  }
  function end(){
    const acc=total?Math.round(score/total*100):0;
    const xp=score*2+acc;
    gameEnd("gameBox","⏱️ Speed Translation",score,total,xp,"speed"," • دقة "+acc+"%");
  }
  q();
}
/* Game 8: Listening Catch */
function gCatch(box){
  const diff=gDiff("catch");
  let pool;
  if(diff===2)pool=shuffle(SENTENCES).slice(0,6).map(s=>({de:s.de,ar:s.ar,id:null}));
  else pool=shuffle(allWords().filter(w=>w.de.length<12)).slice(0,8).map(w=>({de:fullDe(w),ar:w.ar,id:w.id}));
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","🎧 Listening Catch",score,pool.length,score*5+12,"catch");return;}
    const it=pool[i];
    const others=shuffle(allWords().filter(x=>x.ar!==it.ar)).slice(0,3).map(x=>x.ar);
    const opts=shuffle([it.ar].concat(others));
    box.innerHTML='<div class="muted">استمع '+(i+1)+'/'+pool.length+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gHear">🔊 استمع</button></div><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    $("gHear").addEventListener("click",()=>speakGerman(it.de));
    setTimeout(()=>speakGerman(it.de),400);
    gameOpts($("gQ"),opts,j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(opts[j]===it.ar){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+it.de;score++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ سمعت: "+it.de+" = "+it.ar;const w=it.id?wordById(it.id):null;if(w)recordMistake(w,opts[j],"catch");}
      S.totalAnswered++;sessTick(opts[j]===it.ar);save();i++;setTimeout(q,2000);
    });
  }
  q();
}
/* Game 9: Grammar Detective */
const DET_ITEMS=[
{id:"g20",s:"Ich habe einen Auto.",bad:"einen Auto",fix:"Ich habe ein Auto.",why:"Auto محايد (das) → ein وليست einen."},
{id:"g20",s:"Ich sehe die Mann.",bad:"die Mann",fix:"Ich sehe den Mann.",why:"Mann مذكر مفعول → den."},
{id:"g5",s:"Du lernt Deutsch.",bad:"lernt",fix:"Du lernst Deutsch.",why:"du تأخذ st دائمًا."},
{id:"g16",s:"Heute ich lerne.",bad:"ich lerne",fix:"Heute lerne ich.",why:"الفعل ثانيًا ثم الفاعل."},
{id:"g28",s:"halb vier = 4:30.",bad:"4:30",fix:"halb vier = 3:30.",why:"النصف يُحسب للساعة القادمة."},
{id:"g3",s:"ich habe ein buch.",bad:"حرف صغير",fix:"Ich habe ein Buch.",why:"بداية الجملة كبيرة + الاسم كبير."},
{id:"g14",s:"Ich habe kein Tasche.",bad:"kein Tasche",fix:"Ich habe keine Tasche.",why:"Tasche مؤنثة → keine."},
{id:"g34",s:"Ich aufstehe früh.",bad:"aufstehe",fix:"Ich stehe früh auf.",why:"القطعة تنفصل لآخر الجملة."}];
function gDetective(box){
  const pool=shuffle(DET_ITEMS).slice(0,6);
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","🕵️ Grammar Detective",score,pool.length,score*6+12,"detective");return;}
    const m=pool[i];
    const parts=m.s.split(m.bad);
    const opts=shuffle([m.bad,"جزء آخر سليم","لا يوجد خطأ"]);
    box.innerHTML='<div class="muted">جريمة '+(i+1)+'/'+pool.length+'</div><h3 style="direction:ltr">'+escapeHtml(parts[0])+'<u>'+escapeHtml(m.bad)+'</u>'+escapeHtml(parts[1]||"")+'</h3><div class="muted">أين الخطأ؟</div><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),opts,j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(opts[j]===m.bad){fb.className="quiz-feedback ok";fb.textContent="ممتاز 🕵️ الصحيح: "+m.fix+" — لماذا؟ "+m.why;score++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ الخطأ في: "+m.bad+" — الصحيح: "+m.fix+" — لماذا؟ "+m.why;S.gweak[m.id]=(S.gweak[m.id]||0)+1;save();}
      S.totalAnswered++;sessTick(opts[j]===m.bad);save();i++;setTimeout(q,2600);
    });
  }
  q();
}
/* Game 10: Boss Battle */
function gBoss(box){
  const pool=shuffle(allWords().filter(w=>w.art!=="-")).slice(0,10);
  let i=0,hp=20,hearts=3;
  function q(){
    if(hp<=0){S.best.boss=(S.best.boss||0)+1;addXP(40,"boss");markStudyDay();checkAch();save();
      box.innerHTML='<div class="panel glass" style="text-align:center">🏆<h3>Chapter Complete!</h3><div>هزمت الوحش 👹</div><div>⭐+40 XP • قلوب متبقية: '+hearts+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 وحش جديد</button><button class="btn btn-ghost sm" data-go2="games">🎮</button></div></div>';
      $("gAgain").addEventListener("click",()=>gBoss(box));
      box.querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage("games")));return;}
    if(hearts<=0||i>=pool.length){box.innerHTML='<div class="quiz-feedback no">خسرت المعركة 😞 الوحش بقي '+hp+' HP — درّب Articles وحاول مجددًا!</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 حاول مجددًا</button></div>';$("gAgain").addEventListener("click",()=>gBoss(box));return;}
    const w=pool[i];
    box.innerHTML='<div class="muted">👹 HP: '+hp+' • ❤️ x'+hearts+' • سؤال '+(i+1)+'/'+pool.length+'</div><div class="progress sm"><div class="progress-fill red" style="width:'+(hp*5)+'%"></div></div><h3 style="direction:ltr;text-align:center;font-size:30px">'+escapeHtml(w.de)+'</h3><div id="gQ"></div>';
    gameOpts($("gQ"),["der","die","das"],j=>{
      const ok=j===(w.art==="der"?0:w.art==="die"?1:2);
      if(ok){hp-=2;S.totalCorrect++;toast("💥 -2 HP!","ok");}
      else{hearts--;recordMistake(w,"article","boss");toast("💔 "+w.art+" "+w.de,"err");}
      S.totalAnswered++;save();i++;setTimeout(q,800);
    });
  }
  q();
}
/* Game 11: Picture Words */
const PIC_MAP=[["Apfel","🍎"],["Hund","🐕"],["Katze","🐈"],["Haus","🏠"],["Auto","🚗"],["Brot","🍞"],["Milch","🥛"],["Kaffee","☕"],["Buch","📖"],["Tisch","🪑"],["Vogel","🐦"],["Fisch","🐟"],["Banane","🍌"],["Ei","🥚"],["Käse","🧀"],["Schule","🏫"],["Arzt","👨‍⚕️"],["Blume","🌸"],["Baum","🌳"],["Sonne","☀️"],["Mond","🌙"],["Stern","⭐"],["Wasser","💧"],["Feuer","🔥"]];
function gPic(box){
  const items=PIC_MAP.map(p=>({de:p[0],em:p[1],w:findWord(p[0])})).filter(x=>x.w);
  const pool=shuffle(items).slice(0,8);
  if(!pool.length){box.innerHTML='<div class="muted">لا توجد كلمات مناسبة.</div>';return;}
  let i=0,score=0;
  function q(){
    if(i>=pool.length){
      gameEnd("gameBox","📸 Picture Words",score,pool.length,score*5+10,"pic");return;
    }
    const it=pool[i];
    const sh=placeCorrect([fullDe(it.w)].concat(shuffle(items.filter(x=>x!==it)).slice(0,3).map(x=>fullDe(x.w))),fullDe(it.w),"pic");
    const opts=sh.opts,corr=sh.correct;
    box.innerHTML='<div class="muted">ما هذا؟ '+(i+1)+'/'+pool.length+'</div><div style="font-size:64px;text-align:center">'+it.em+'</div><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),opts,j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===corr){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+fullDe(it.w)+" = "+it.w.ar+" • جمع: "+(it.w.plural||"—");score++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ هذا: "+fullDe(it.w)+" = "+it.w.ar;recordMistake(it.w,opts[j],"pic");}
      S.totalAnswered++;sessTick(j===corr,it.w.id);save();i++;setTimeout(q,2000);
    });
  }
  q();
}
/* Game 12: Music Mode (original site lines) */
const MUSIC_LINES=[
["Guten Morgen, die ___ scheint.",["Sonne","Milch","Tasche"],0,"أغنية الصباح الأصلية للموقع."],
["Ich trinke meinen ___ am Morgen.",["Kaffee","Tisch","Hund"],0,"أغنية القهوة الأصلية."],
["Wir ___ jeden Tag Deutsch.",["lernen","spielt","gehe"],0,"أغنية التعلم الأصلية."],
["Mein ___ ist mein bester Freund.",["Hund","Tisch","Apfel"],0,"أغنية الصداقة الأصلية."],
["Die ___ blüht im Frühling.",["Blume","Schule","Straße"],0,"أغنية الربيع الأصلية."],
["Ich fahre mit dem ___ nach Berlin.",["Zug","Apfel","Buch"],0,"أغنية السفر الأصلية."]];
function gMusic(box){
  const pool=shuffle(MUSIC_LINES).slice(0,5);
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","🎵 Music Mode",score,pool.length,score*5+10,"music");return;}
    const m=pool[i];
    const sh=shuffleOptions(m[1],m[2]);
    box.innerHTML='<div class="muted">🎵 '+(i+1)+'/'+pool.length+' • '+escapeHtml(m[3])+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gHear">🔊 اسمع</button></div><h3 style="direction:ltr">'+escapeHtml(m[0])+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    $("gHear").addEventListener("click",()=>speakGerman(m[0].replace("___",m[1][m[2]])));
    gameOpts($("gQ"),sh.opts,j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+m[0].replace("___",m[1][m[2]]);score++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ الصحيح: "+m[1][m[2]];}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,2000);
    });
  }
  q();
}
/* ---------- Daily Challenge / Leaderboard / Session ---------- */
function dailySeed(){const t=todayStr();let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;return h<0?-h:h;}
function dailyPlan(){
  const sd=dailySeed();
  const words=allWords();
  const w1=words[sd%words.length],w2=words[(sd>>3)%words.length];
  const g=GRAMMAR[sd%GRAMMAR.length];
  const li=LISTEN_ITEMS[sd%LISTEN_ITEMS.length];
  const sp=SPEAK_ITEMS[sd%SPEAK_ITEMS.length];
  const mood=S.daily.mood||"🙂";
  const size=mood==="😴"?3:mood==="🔥"?7:5;
  return {w1:w1,w2:w2,g:g,li:li,sp:sp,size:size,mood:mood};
}
function renderChallenge(){
  ensurePlay();
  const t=todayStr();
  if(S.daily.day!==t)S.daily={day:t,done:{},mood:S.daily.mood||"🙂"};
  const p=dailyPlan();
  const d=S.daily.done;
  const items=[
    {id:"w1",t:"📚 كلمة: "+fullDe(p.w1),go:"vocab"},
    {id:"w2",t:"📚 كلمة: "+fullDe(p.w2),go:"vocab"},
    {id:"g",t:"📐 قاعدة: "+p.g.title,go:"grammar"},
    {id:"li",t:"🎧 استماع: "+p.li.de,go:"listen"},
    {id:"sp",t:"🎤 تحدث: "+p.sp.q,go:"speak"},
    {id:"game",t:"🎮 لعبة: Article Rush",go:"games"}].slice(0,p.size);
  const doneN=items.filter(x=>d[x.id]).length;
  const allDone=doneN>=items.length;
  let h='<div class="panel glass"><h3>⚡ التحدي اليومي ('+t+')</h3><div class="muted">مزاجك: '+p.mood+' • '+doneN+'/'+items.length+'</div><div class="progress"><div class="progress-fill" style="width:'+Math.round(doneN/Math.max(1,items.length)*100)+'%"></div></div>';
  items.forEach(x=>{h+='<div class="j-stage"><div><b>'+(d[x.id]?"✅ ":"")+escapeHtml(x.t)+'</b></div>'+(d[x.id]?"":'<button class="btn btn-ghost sm" data-cgo="'+x.go+'" data-cid="'+x.id+'">ابدأ</button>')+'</div>';});
  if(allDone&&!d.celebrated){d.celebrated=1;addXP(30,"daily");save();h+='<div class="quiz-feedback ok">🏆 Daily Challenge Complete! ⭐+30</div>';}
  h+='</div>';
  h+='<div class="panel glass"><h3>👥 المتصدرون (تجريبي محلي — بدون إنترنت)</h3><div class="muted">نظام قابل للربط بسيرفر لاحقًا.</div><div id="lbBox"></div></div>';
  h+='<div class="panel glass"><h3>🎉 نتائج الجلسة</h3><div class="muted">منذ فتح الموقع.</div><div class="row-flex"><button class="btn btn-gold sm" id="sessEnd">إنهاء الجلسة وعرض النتيجة</button></div><div id="sessBox"></div></div>';
  $("chBox").innerHTML=h;
  $("chBox").querySelectorAll("[data-cgo]").forEach(b=>b.addEventListener("click",()=>{S.daily.done[b.getAttribute("data-cid")]=1;save();showPage(b.getAttribute("data-cgo"));}));
  renderLB();
  $("sessEnd").addEventListener("click",()=>{
    const mins=Math.max(1,Math.round((Date.now()-_sess.t0)/60000));
    const acc=_sess.n?Math.round(_sess.ok/_sess.n*100):0;
    $("sessBox").innerHTML='<div class="quiz-feedback ok">🎉 Session Complete<br>⏱️ الوقت: '+mins+' دقيقة<br>⭐ XP: +'+_sess.xp+'<br>🎯 الدقة: '+acc+'%<br>📚 كلمات: '+_sess.words+' • ✅ أخطاء صُححت: '+_sess.fixed+'<br>🔥 Streak: '+(S.streak.count||0)+'<br><b>التالي المقترح: '+escapeHtml((recommend()[0]||"استمر!"))+'</b></div>';
  });
}
/* Leaderboard: local mock with backend-ready architecture */
const LB={provider:"local",
  rows:function(){
    const me=S.xp||0;
    const bots=[{n:"Ahmed 🧑",f:1.35,o:120},{n:"Sara 👩",f:1.1,o:40},{n:"Omar 🧔",f:0.8,o:10},{n:"Lina 👧",f:0.55,o:0}];
    const all=[{n:"أنت ⭐",me:true,xp:me}].concat(bots.map(b=>({n:b.n,xp:Math.round(me*b.f+b.o)})));
    return all.sort((a,b)=>b.xp-a.xp);
  }};
function renderLB(){
  const el=$("lbBox");if(!el)return;
  el.innerHTML=LB.rows().map((r,i)=>'<div class="j-stage"><div><b>'+(i+1)+'. '+escapeHtml(r.n)+'</b></div><b>'+r.xp+' XP</b></div>').join("");
}
/* ---------- Avatar / Rewards / Weekly / Me ---------- */
const AV_FACES=["🦊","🐼","🦁","🐸","🐵","🦄","🐝","🦉","🐢","🐙","🤖","👽"];
const AV_FRAMES=[{id:"none",t:"بدون إطار",lvl:0},{id:"silver",t:"فضي 🥈",lvl:5},{id:"gold",t:"ذهبي 🥇",lvl:10},{id:"neon",t:"نيون ✨",lvl:20}];
function avTitle(lvl){if(lvl>=30)return "A1 Master";if(lvl>=20)return "A1 Explorer";if(lvl>=10)return "Deutsch Starter";return "Anfänger";}
function renderMe(){
  ensurePlay();
  const L=levelFor(S.xp||0);
  const title=avTitle(L.lvl);
  let h='<div class="panel glass" style="text-align:center"><div style="font-size:64px">'+S.avatar.face+'</div><h3>'+title+'</h3><div class="muted">مستوى '+L.lvl+' • إطار: '+(AV_FRAMES.find(f=>f.id===S.avatar.frame)||{}).t+'</div><h4>اختر صورتك:</h4><div class="row-flex" style="justify-content:center">'+AV_FACES.map(f=>'<button class="icon-btn" data-av="'+f+'" style="'+(S.avatar.face===f?"border-color:var(--cyan);box-shadow:0 0 12px rgba(var(--v2),.5)":"")+'">'+f+'</button>').join("")+'</div><h4>الإطار:</h4><div class="row-flex" style="justify-content:center">'+AV_FRAMES.map(f=>{
    const un=L.lvl>=f.lvl;
    return '<button class="btn btn-ghost sm" data-fr="'+f.id+'" '+(un?"":"disabled")+'>'+f.t+(un?"":" 🔒")+'</button>';
  }).join("")+'</div></div>';
  // weekly report
  const days=[];for(let k=6;k>=0;k--)days.push(todayPlus(-k));
  const active=days.filter(d=>S.studyDays[d]).length;
  let mins=0;days.forEach(d=>{mins+=S.timeLog[d]||0;});
  let games=0;Object.keys(S.gstats||{}).forEach(k=>{games+=S.gstats[k].n||0;});
  const acc=(S.totalAnswered||0)?Math.round((S.totalCorrect||0)/S.totalAnswered*100):0;
  const cats={};Object.keys(S.mistakes||{}).forEach(id=>{const w=wordById(id);if(w&&w.cat)cats[w.cat]=(cats[w.cat]||0)+S.mistakes[id].n;});
  const weak=Object.keys(cats).sort((a,b)=>cats[b]-cats[a])[0]||"—";
  h+='<div class="panel glass"><h3>📊 أسبوعك الألماني</h3><div class="muted">أيام نشطة: '+active+'/7 • دقائق: '+mins+' • ألعاب وتمارين: '+games+' • الدقة التراكمية: '+acc+'% • Streak: '+(S.streak.count||0)+'</div><div class="muted">أضعف نقطة: '+weak+'</div><div class="muted">🎯 هدف الأسبوع القادم: ركز على '+weak+'.</div></div>';
  // rewards
  const ds=achDefs(),got=ds.filter(a=>S.ach[a.id]).length;
  h+='<div class="panel glass"><h3>🎁 مكافآتي</h3><div class="muted">🏆 '+got+'/'+ds.length+' • 🧊 Freeze: '+(S.freeze.n||0)+' • 👹 Boss wins: '+(S.best.boss||0)+' • ⏱️ أفضل 60 ثانية: '+(gStat("speed").best||0)+'</div></div>';
  $("meBox").innerHTML=h;
  $("meBox").querySelectorAll("[data-av]").forEach(b=>b.addEventListener("click",()=>{S.avatar.face=b.getAttribute("data-av");save();renderMe();toast("تم تغيير الصورة "+S.avatar.face,"ok");}));
  $("meBox").querySelectorAll("[data-fr]").forEach(b=>b.addEventListener("click",()=>{S.avatar.frame=b.getAttribute("data-fr");save();renderMe();toast("تم تغيير الإطار 🎉","ok");}));
}
/* ---------- Smart Practice (mistake hunter + personalized) ---------- */
function renderPractice(){
  ensurePlay();
  const ids=Object.keys(S.mistakes||{}).sort((a,b)=>S.mistakes[b].n-S.mistakes[a].n);
  const groups={Articles:0,Grammar:0,Vocabulary:0,Listening:0,Speaking:0};
  ids.forEach(id=>{
    const m=S.mistakes[id],w=wordById(id);
    if(!w||!m)return;
    if(m.kind==="article"||m.kind==="rush"||m.kind==="boss")groups.Articles+=m.n;
    else if(m.kind==="listening"||m.kind==="catch")groups.Listening+=m.n;
    else if(w.cat)groups.Vocabulary+=m.n;
  });
  Object.keys(S.gweak||{}).forEach(g=>{groups.Grammar+=S.gweak[g];});
  let h='<div class="panel glass"><h3>🕵️ صائد الأخطاء</h3>';
  h+=Object.keys(groups).map(k=>'<div class="stat-bar-row"><span class="lbl">'+k+'</span><div class="bar"><div class="fill" style="width:'+Math.min(100,groups[k]*10)+'%;background:linear-gradient(90deg,#ef4444,#f59e0b)"></div></div><b>'+groups[k]+'</b></div>').join("");
  h+='<div class="row-flex"><button class="btn btn-red sm" id="huntStart">🎯 ابدأ تدريب أخطائي ('+Math.min(ids.length,8)+')</button></div><div id="huntBox"></div></div>';
  h+='<div class="panel glass"><h3>🎯 تدريب مخصص لك</h3><div class="muted">مبني على أخطائك ومراجعاتك.</div><div class="row-flex"><button class="btn btn-primary sm" id="perStart">ابدأ التدريب المخصص 🚀</button></div><div id="perBox"></div></div>';
  $("practiceBox").innerHTML=h;
  $("huntStart").addEventListener("click",startHunt);
  $("perStart").addEventListener("click",startPersonal);
}
function startHunt(){
  const ids=Object.keys(S.mistakes||{}).sort((a,b)=>S.mistakes[b].n-S.mistakes[a].n).slice(0,8).map(id=>wordById(id)).filter(Boolean);
  const box=$("huntBox");
  if(!ids.length){box.innerHTML='<div class="quiz-feedback ok">لا أخطاء! سجل نظيف 🎉</div>';return;}
  let i=0,score=0;
  function q(){
    if(i>=ids.length){box.innerHTML='<div class="quiz-feedback ok">أنهيت تدريب الأخطاء: '+score+'/'+ids.length+'</div>';return;}
    const w=ids[i];
    let t,opts,correct,why;
    if(w.art!=="-"){t="اختر الأداة: ___ "+w.de;opts=["der","die","das"];correct=w.art==="der"?0:w.art==="die"?1:2;why=w.art+" "+w.de+" = "+w.ar;}
    else{opts=shuffle([w.ar].concat(shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)));t="ما معنى "+w.de+"؟";correct=opts.indexOf(w.ar);why=w.de+" = "+w.ar;}
    box.innerHTML='<div class="muted">خطأ '+(i+1)+'/'+ids.length+' (تكرر '+S.mistakes[w.id].n+'x)</div><h4>'+escapeHtml(t)+'</h4><div class="quiz-opts">'+opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="hFb"></div>';
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("hFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+why+" — تم إصلاح الخطأ!";score++;sessTick(true,w.id,true);
        if(S.mistakes[w.id]){S.mistakes[w.id].n--;if(S.mistakes[w.id].n<=0)delete S.mistakes[w.id];}
        srsBump(w.id,true);save();}
      else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ الصحيح: "+opts[correct]+" — لماذا؟ "+why;sessTick(false,w.id);save();}
      setTimeout(()=>{i++;q();},1800);
    }));
  }
  q();
}
function startPersonal(){
  const ws=weakWords(5),gs=weakGrammar(2);
  const box=$("perBox");
  const items=ws.map(w=>({w:w,t:w.art!=="-"?"اختر الأداة: ___ "+w.de:"ما معنى "+w.de+"؟"}));
  gs.forEach(g=>items.push({g:g,t:"قاعدة: "+g.quiz.q,opts:g.quiz.opts.slice(),correct:g.quiz.correct,why:g.quiz.explain,gid:g.id}));
  let i=0,score=0;
  function q(){
    if(i>=items.length){box.innerHTML='<div class="quiz-feedback ok">أنهيت تدريبك المخصص: '+score+'/'+items.length+' 🎯</div>';addXP(15,"personal");save();return;}
    const it=items[i];
    let opts,correct,why;
    if(it.g){opts=it.opts;correct=it.correct;why=it.why;}
    else if(it.w.art!=="-"){opts=["der","die","das"];correct=it.w.art==="der"?0:it.w.art==="die"?1:2;why=it.w.art+" "+it.w.de+" = "+it.w.ar;}
    else{opts=shuffle([it.w.ar].concat(shuffle(allWords().filter(x=>x.id!==it.w.id)).slice(0,3).map(x=>x.ar)));correct=opts.indexOf(it.w.ar);why=it.w.de+" = "+it.w.ar;}
    box.innerHTML='<div class="muted">تدريب '+(i+1)+'/'+items.length+'</div><h4>'+escapeHtml(it.t)+'</h4><div class="quiz-opts">'+opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div><div class="quiz-feedback hidden" id="pFb"></div>';
    box.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{
      const j=parseInt(b.getAttribute("data-j"),10);
      const fb=$("pFb");fb.classList.remove("hidden");
      box.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=true);
      if(j===correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+why;score++;S.totalCorrect++;if(it.w){srsBump(it.w.id,true);}sessTick(true);}
      else{b.classList.add("wrong");box.querySelectorAll(".quiz-opt")[correct].classList.add("correct");fb.className="quiz-feedback no";fb.textContent="❌ "+why;if(it.w&&it.w.id){recordMistake(it.w,opts[j],"personal");}if(it.gid){S.gweak[it.gid]=(S.gweak[it.gid]||0)+1;}sessTick(false);save();}
      S.totalAnswered++;save();setTimeout(()=>{i++;q();},1800);
    }));
  }
  q();
}
/* ---------- widgets + wiring ---------- */
function renderPlayWidgets(){
  try{
    ensureLearn();
    const el=$("dashLearn");
    if(el){
      const rec=recommend();
      const d=document.createElement("div");
      d.className="panel glass reveal";
      d.innerHTML='<h3>🎯 افعل الآن</h3>'+rec.map(r=>'<div class="muted">• '+escapeHtml(r)+'</div>').join("")+'<div class="row-flex"><button class="btn btn-primary sm" data-go3="games">🎮 العب</button><button class="btn btn-gold sm" data-go3="practice">🎯 تدريب ذكي</button><button class="btn btn-ghost sm" data-go3="challenge">⚡ التحدي</button></div>';
      el.appendChild(d);
      d.querySelectorAll("[data-go3]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-go3"))));
    }
  }catch(e){}
}
const LEARN2_PAGES={games:renderGames,challenge:renderChallenge,me:renderMe,practice:renderPractice};
(function(){
  try{
    const _rd=renderDashboard;
    renderDashboard=function(){_rd();try{renderPlayWidgets();}catch(e){}};
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(LEARN2_PAGES[n])LEARN2_PAGES[n]();}catch(e){console.error(e);}};
    ensurePlay();
  }catch(e){console.error(e);}
})();



