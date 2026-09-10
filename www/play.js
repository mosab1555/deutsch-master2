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
/* ===== Shared game economy: coins, combo, lives, difficulty, wins ===== */
var _combo=0;
function comboMult(){return _combo>=10?3:_combo>=5?2:1;}
function comboLabel(){return _combo>=10?"SUPER COMBO 🔥 x3":_combo>=5?"COMBO x2":"🔥"+_combo;}
function comboHit(){
  _combo++;
  if(!S.bestCombo||_combo>S.bestCombo){S.bestCombo=_combo;save();}
  if(_combo===3||_combo===5||_combo===10)toast("🔥 "+comboLabel()+"!","ok");
  return comboMult();
}
function comboMiss(){_combo=0;}
function earnCoins(n,src){ensurePlay();S.coins=(S.coins||0)+n;save();try{checkAch();}catch(e){}return S.coins;}
function coinStr(){return "🪙 "+(S.coins||0);}
function xpFloat(boxId,txt){
  try{
    const box=$(boxId);if(!box)return;
    const d=document.createElement("div");d.className="xp-float";d.textContent=txt;
    box.appendChild(d);setTimeout(()=>{try{d.remove();}catch(e){}},1200);
  }catch(e){}
}
function hearts(n,max){let s="";for(let i=0;i<(max||3);i++)s+=i<n?"❤️":"🖤";return s;}
var GLEVELS=["Easy","Normal","Hard","Expert"];
function gLevel(id){ensurePlay();if(!S.glevel)S.glevel={};return S.glevel[id]||1;}
function setGLevel(id,l){ensurePlay();if(!S.glevel)S.glevel={};S.glevel[id]=l;save();}
function levelLocked(l){try{return l>=3&&(levelFor(S.xp||0).lvl||1)<10;}catch(e){return false;}}
function levelCfg(l){return {rounds:l===0?5:l===1?8:l===2?10:12,secs:l===0?15:l===1?10:l===2?7:5};}
function trackWin(win){ensurePlay();if(win)S.wins=(S.wins||0)+1;else S.losses=(S.losses||0)+1;save();}
/* session tracking (wraps addXP, backward compatible) */
const _sess={xp:0,n:0,ok:0,words:0,fixed:0,t0:Date.now(),acts:{}};
if(typeof addXP==="function"&&!addXP._wrapped){
  const _ax=addXP;
  addXP=function(n,src){const r=_ax(n);try{_sess.xp+=n;_sess.n++;if(src)_sess.acts[src]=(_sess.acts[src]||0)+n;}catch(e){}return r;};
  addXP._wrapped=true;
}
function sessTick(ok,word,fixed){
  _sess.n++;if(ok)_sess.ok++;if(word)_sess.words++;if(fixed){_sess.fixed++;try{S.fixedTotal=(S.fixedTotal||0)+1;}catch(e){}}
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
{id:"rush",t:"⚡ Article Rush",d:"der/die/das بسرعة مع Combo",xp:30},
{id:"battle",t:"⚔️ Word Battle",d:"كلمة ضد الوقت",xp:30},
{id:"builder",t:"🧩 Sentence Builder",d:"رتّب الجملة",xp:35},
{id:"memory",t:"🃏 Memory Match",d:"طابق الأزواج",xp:25},
{id:"missing",t:"🕳️ Missing Word",d:"أكمل الفراغ",xp:30},
{id:"tf",t:"✅❌ True or False",d:"صح أم خطأ مع السبب",xp:30},
{id:"speed",t:"⏱️ Speed Translation",d:"60 ثانية",xp:40},
{id:"catch",t:"🎧 Listening Catch",d:"ماذا سمعت؟",xp:35},
{id:"detective",t:"🕵️ Grammar Detective",d:"اكتشف الخطأ",xp:35},
{id:"boss",t:"👹 Boss Battle",d:"اهزم الوحش",xp:50},
{id:"pic",t:"📸 Picture Words",d:"ما هذه؟",xp:30},
{id:"music",t:"🎵 Music Mode",d:"أكمل الأغنية",xp:30},
{id:"gbattle",t:"⚔️ German Battle",d:"معركة ضد خصم + Boss",xp:60,expert:true},
{id:"gbomb",t:"💣 Bomb Defusal",d:"فك القنبلة قبل الوقت",xp:60,expert:true},
{id:"gdetect",t:"🕵️ German Detective",d:"قضية تفاعلية بالقصص",xp:50},
{id:"gshop",t:"🛒 German Shop",d:"بائع في متجر ألماني",xp:50},
{id:"grunner",t:"🏃 Word Runner",d:"اجري بالكلمات الصحيحة",xp:50}];
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
  ensurePlay();const win=score/total>=0.6;gRecord(key,win,score);
  trackWin(win);
  const coins=win?Math.round(10+score*2):Math.round(score);
  earnCoins(coins,"game:"+key);
  addXP(xp,"game:"+key);markStudyDay();checkAch();
  const acc=total?Math.round(score/total*100):0;
  $(boxId).innerHTML='<div class="panel glass" style="text-align:center">🎉<h3>'+title+'</h3><div>النتيجة: '+score+'/'+total+' ('+acc+'%)</div><div>⭐+'+xp+' XP • '+coinStr()+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 العب مجددًا</button><button class="btn btn-ghost sm" data-go2="games">🎮 الألعاب</button></div></div>';
  $("gAgain").addEventListener("click",()=>startGame(key));
  $(boxId).querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-go2"))));
}
function renderGames(){
  ensurePlay();
  const mood=S.daily.mood||"🙂";
  $("gamesBox").innerHTML='<div class="panel glass"><h3>🎮 Game Center</h3><div class="muted">مزاج اليوم: '+mood+' • '+coinStr()+' • العب وتعلّم واكسب XP وCoins حقيقية.</div><div class="row-flex"><button class="btn btn-ghost sm" id="moodBtn">😴🙂🔥 مزاجي</button><button class="btn btn-gold sm" data-go2="challenge">⚡ التحدي اليومي</button><button class="btn btn-ghost sm" data-go2="me">📊 إحصائياتي</button></div></div><div class="grid-2">'+GAMES.map(g=>{
    const s=gStat(g.id),lv=gLevel(g.id);
    const locked=levelLocked(3)&&g.expert;
    return '<div class="panel glass game-card"><h4>'+g.t+'</h4><div class="muted">'+g.d+'</div><div class="muted">الصعوبة: '+GLEVELS[lv]+' • XP متوقع: ~'+g.xp+'</div><div class="muted">أفضل نتيجة: '+(s.best||0)+' • لعب: '+s.n+'</div>'+(locked?'<div class="muted">🔒 Expert يُفتح عند Level 10</div><button class="btn btn-ghost sm" disabled>مغلق 🔒</button>':'<div class="row-flex"><select data-lv="'+g.id+'" title="الصعوبة">'+GLEVELS.map((l,i)=>'<option value="'+i+'"'+(i===lv?" selected":"")+'>'+l+'</option>').join("")+'</select><button class="btn btn-primary sm" data-g="'+g.id+'">PLAY 🚀</button></div>')+'</div>';
  }).join("")+'</div><div id="gameBox"></div>';
  $("gamesBox").querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>startGame(b.getAttribute("data-g"))));
  $("gamesBox").querySelectorAll("[data-lv]").forEach(s=>s.addEventListener("change",()=>{setGLevel(s.getAttribute("data-lv"),parseInt(s.value,10));toast("الصعوبة: "+GLEVELS[parseInt(s.value,10)],"ok");}));
  $("gamesBox").querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-go2"))));
  $("moodBtn").addEventListener("click",()=>{
    const ms=["😴","🙂","🔥"];S.daily.mood=ms[(ms.indexOf(S.daily.mood||"🙂")+1)%3];save();renderGames();
    toast(S.daily.mood==="😴"?"وضع خفيف: 5 دقائق ولعبة واحدة":S.daily.mood==="🔥"?"وضع التحدي: جلسة كاملة!":"وضع عادي متوازن","ok");
  });
}
function startGame(id){
  const box=$("gameBox");if(!box){showPage("games");return;}
  box.scrollIntoView({behavior:"smooth"});
  ({rush:gRush,battle:gBattle,builder:gBuilder,memory:gMemory,missing:gMissing,tf:gTF,speed:gSpeed,catch:gCatch,detective:gDetective,boss:gBoss,pic:gPic,music:gMusic,gbattle:gbattle,gbomb:gbomb,gdetect:gdetect,gshop:gshop,grunner:grunner}[id]||gRush)(box);
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
/* Sentence Completion bank: varied blank position, answer type, structure,
   context and level. s=sentence(___ = blank), o=options(correct first in data),
   c=data index, why=short rule, lvl/pos/typ/ctx/start metadata, w=vocab link. */
const SENT_FILL=
[{id:"f1",s:"Ich ___ jeden Tag Deutsch.",o:["lerne","lernst","lernen","lernt"],c:0,why:"ich تأخذ e.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"study",start:"Ich",w:"lernen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Ich",answerType:"verb",blankPosition:"after-subj"},
{id:"f2",s:"Du ___ in Berlin.",o:["wohnst","wohne","wohnt","wohnen"],c:0,why:"du تأخذ st.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Du",w:"wohnen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Du",answerType:"verb",blankPosition:"after-subj"},
{id:"f3",s:"Er ___ gern Fußball.",o:["spielt","spiele","spielst","spielen"],c:0,why:"er يأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"sport",start:"Er",w:"spielen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Er",answerType:"verb",blankPosition:"after-subj"},
{id:"f4",s:"Wir ___ einen Film.",o:["sehen","sehe","sieht","siehst"],c:0,why:"wir تأخذ المصدر.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Wir",w:"sehen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Wir",answerType:"verb",blankPosition:"after-subj"},
{id:"f5",s:"___ du Zeit?",o:["Hast","Haben","Hat","Habe"],c:0,why:"السؤال يبدأ بالفعل.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Hast",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"verb-first",grammarTarget:"conjugation",sentenceStarter:"Hast",answerType:"verb",blankPosition:"start"},
{id:"f6",s:"Kinder ___ im Garten.",o:["spielen","spielt","spiele","spielst"],c:0,why:"الجمع يأخذ المصدر.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Kinder",w:"spielen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Kinder",answerType:"verb",blankPosition:"after-subj"},
{id:"f7",s:"Meine Mutter ___ heute zu Hause.",o:["bleibt","bleibst","bleiben","bleibe"],c:0,why:"المفرد المؤنث يأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"family",start:"Meine",w:"bleiben",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Meine",answerType:"verb",blankPosition:"after-subj"},
{id:"f8",s:"Mein Bruder ___ in Berlin.",o:["wohnt","wohne","wohnst","wohnen"],c:0,why:"er ضمنيًا يأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"family",start:"Mein",w:"wohnen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Mein",answerType:"verb",blankPosition:"after-subj"},
{id:"f9",s:"Er sieht ___ Mann.",o:["den","der","dem","die"],c:0,why:"مذكر مفعول → den.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"daily",start:"Er",w:"Mann",chapterId:"K0",chapterName:"Einführung – مقدمة",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Er",answerType:"article",blankPosition:"before-noun"},
{id:"f10",s:"Das ist ___ Bruder.",o:["mein","meine","meinen","meinem"],c:0,why:"مذكر فاعل → mein.",lvl:"A1",pos:"before-noun",typ:"poss",ctx:"family",start:"Das",w:"Bruder",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"possessives",sentenceStarter:"Das",answerType:"poss",blankPosition:"before-noun"},
{id:"f11",s:"Wir kaufen ___ neuen Computer.",o:["einen","ein","eine","einem"],c:0,why:"مذكر مفعول → einen.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"shopping",start:"Wir",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Wir",answerType:"article",blankPosition:"before-noun"},
{id:"f12",s:"Maria ist nett. Ich mag ___.",o:["sie","ihr","du","es"],c:0,why:"مفعول sie ثابت.",lvl:"A1",pos:"end",typ:"pronoun",ctx:"friends",start:"Maria",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"noun-phrase",grammarTarget:"pronouns",sentenceStarter:"Maria",answerType:"pronoun",blankPosition:"end"},
{id:"f13",s:"___ wohnst du?",o:["Wo","Wer","Wie","Wann"],c:0,why:"السؤال عن المكان = Wo.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Wo",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wo",answerType:"question",blankPosition:"start"},
{id:"f14",s:"Ich habe ___ Auto.",o:["kein","keine","nicht","ein"],c:0,why:"Auto محايد → kein.",lvl:"A1",pos:"after-verb",typ:"negation",ctx:"daily",start:"Ich",w:"Auto",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"verb_frame",subjectType:"pronoun",grammarTarget:"kein/nicht",sentenceStarter:"Ich",answerType:"negation",blankPosition:"after-verb"},
{id:"f15",s:"Das Auto ist sehr ___.",o:["schnell","langsam","schnelles","schnelle"],c:0,why:"الصفة بعد ist بدون نهاية.",lvl:"A1",pos:"end",typ:"adjective",ctx:"general",start:"Das",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"noun-phrase",grammarTarget:"adjectives",sentenceStarter:"Das",answerType:"adjective",blankPosition:"end"},
{id:"f16",s:"Ich stehe ___ auf.",o:["früh","früher","frühe","frühen"],c:0,why:"الظرف بدون نهاية.",lvl:"A1",pos:"mid",typ:"adverb",ctx:"daily",start:"Ich",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"adverbs",sentenceStarter:"Ich",answerType:"adverb",blankPosition:"mid"},
{id:"f17",s:"Wir fahren ___ Berlin.",o:["nach","in","aus","zu"],c:0,why:"الاتجاه لمدينة = nach.",lvl:"A1",pos:"after-verb",typ:"prep",ctx:"travel",start:"Wir",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"verb_frame",subjectType:"pronoun",grammarTarget:"prepositions",sentenceStarter:"Wir",answerType:"prep",blankPosition:"after-verb"},
{id:"f18",s:"Zum Telefonieren kaufe ich ein neues ___.",o:["Handy","Haus","Brot","Auto"],c:0,why:"السياق (للاتصال) يحدد الكلمة.",lvl:"A1",pos:"before-noun",typ:"vocab",ctx:"shopping",start:"Zum",w:"Handy",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"vocabulary",sentenceStarter:"Zum",answerType:"vocab",blankPosition:"before-noun"},
{id:"f19",s:"Heute ___ ich Deutsch.",o:["lerne","lernst","lernt","lernen"],c:0,why:"الفعل ثانيًا ثم الفاعل.",lvl:"A1",pos:"after-time",typ:"verb",ctx:"study",start:"Heute",w:"lernen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Heute",answerType:"verb",blankPosition:"after-time"},
{id:"f20",s:"___ Bruder wohnt in Berlin.",o:["Mein","Meine","Meinen","Ich"],c:0,why:"مذكر فاعل → Mein.",lvl:"A1",pos:"start",typ:"poss",ctx:"family",start:"Mein",w:"Bruder",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"noun-phrase",grammarTarget:"possessives",sentenceStarter:"Mein",answerType:"poss",blankPosition:"start"},
{id:"f21",s:"Ich sehe ___ alten Mann.",o:["den","der","dem","die"],c:0,why:"مذكر مفعول → den.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"daily",start:"Ich",w:"Mann",chapterId:"K0",chapterName:"Einführung – مقدمة",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Ich",answerType:"article",blankPosition:"before-noun"},
{id:"f22",s:"Morgen ___ meine Schwester nach Berlin.",o:["fährt","fahre","fährst","fahren"],c:0,why:"المفرد يأخذ t مع تغير الجذر.",lvl:"A1",pos:"after-time",typ:"verb",ctx:"family",start:"Morgen",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Morgen",answerType:"verb",blankPosition:"after-time"},
{id:"f23",s:"Am Wochenende ___ ich meine Freunde.",o:["besuche","besuchst","besuchen","besucht"],c:0,why:"ich تأخذ e.",lvl:"A1",pos:"after-time",typ:"verb",ctx:"friends",start:"Am",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Am",answerType:"verb",blankPosition:"after-time"},
{id:"f24",s:"___ gehe ich zur Universität.",o:["Heute","Ich","Gehe","Universität"],c:0,why:"الظرف أولًا ثم الفعل.",lvl:"A1",pos:"start",typ:"adverb",ctx:"study",start:"Heute",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"adverbial",grammarTarget:"adverbs",sentenceStarter:"Heute",answerType:"adverb",blankPosition:"start"},
{id:"f25",s:"Ich ___ jeden Morgen Kaffee.",o:["trinke","trinkst","trinkt","trinken"],c:0,why:"ich تأخذ e.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"food",start:"Ich",w:"trinken",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Ich",answerType:"verb",blankPosition:"after-subj"},
{id:"f26",s:"Ich warte ___ den Bus.",o:["auf","an","bei","zu"],c:0,why:"warten auf.",lvl:"A1",pos:"mid",typ:"prep",ctx:"travel",start:"Ich",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"prepositions",sentenceStarter:"Ich",answerType:"prep",blankPosition:"mid"},
{id:"f27",s:"Der Kaffee ___ heiß.",o:["ist","sind","seid","bist"],c:0,why:"المفرد يأخذ ist.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"food",start:"Der",w:"Kaffee",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Der",answerType:"verb",blankPosition:"after-subj"},
{id:"f28",s:"___ bitte die Tür!",o:["Mach","Machst","Machen","Macht"],c:0,why:"أمر du = الجذر.",lvl:"A1",pos:"start",typ:"imperative",ctx:"home",start:"Mach",chapterId:"K0",chapterName:"Einführung – مقدمة",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"verb-first",grammarTarget:"imperativ",sentenceStarter:"Mach",answerType:"imperative",blankPosition:"start"},
{id:"f29",s:"Ich ___ heute arbeiten.",o:["muss","musst","müssen","müsst"],c:0,why:"ich تأخذ muss.",lvl:"A1",pos:"after-subj",typ:"modal",ctx:"work",start:"Ich",w:"arbeiten",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"modalverben",sentenceStarter:"Ich",answerType:"modal",blankPosition:"after-subj"},
{id:"f30",s:"Ist das ___ Schwester?",o:["meine","mein","meinen","meiner"],c:0,why:"مؤنثة → meine.",lvl:"A1",pos:"mid",typ:"poss",ctx:"family",start:"Das",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"verb-first",subjectType:"noun-phrase",grammarTarget:"possessives",sentenceStarter:"Das",answerType:"poss",blankPosition:"mid"},
{id:"f31",s:"Wo ___ du gestern?",o:["warst","bist","war","wart"],c:0,why:"gestern ماضٍ: warst.",lvl:"A1",pos:"after-question",typ:"verb",ctx:"daily",start:"Wo",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"wh_frame",subjectType:"wh-word",grammarTarget:"conjugation",sentenceStarter:"Wo",answerType:"verb",blankPosition:"after-question"},
{id:"f32",s:"Er trinkt ___ Kaffee.",o:["einen","ein","eine","einem"],c:0,why:"مذكر مفعول → einen.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"food",start:"Er",w:"Kaffee",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Er",answerType:"article",blankPosition:"before-noun"},
{id:"f33",s:"Die Kinder ___ laut.",o:["sind","seid","ist","bin"],c:0,why:"الجمع يأخذ sind.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Die",chapterId:"K0",chapterName:"Einführung – مقدمة",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Die",answerType:"verb",blankPosition:"after-subj"},
{id:"f34",s:"___ kommt aus Ägypten?",o:["Wer","Was","Wo","Wie"],c:0,why:"السؤال عن العاقل = Wer.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Wer",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wer",answerType:"question",blankPosition:"start"},
{id:"f35",s:"Sie ___ jeden Tag.",o:["arbeitet","arbeiten","arbeitest","arbeite"],c:0,why:"Sie الرسمية تأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"work",start:"Sie",w:"arbeiten",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Sie",answerType:"verb",blankPosition:"after-subj"},
{id:"f36",s:"Habt ihr ___ Zeit?",o:["keine","kein","nicht","keiner"],c:0,why:"Zeit مؤنثة → keine.",lvl:"A1",pos:"start",typ:"negation",ctx:"daily",start:"Habt",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"verb-first",grammarTarget:"kein/nicht",sentenceStarter:"Habt",answerType:"negation",blankPosition:"start"},
{id:"f37",s:"Er ___ einen Hund.",o:["hat","habe","hast","haben"],c:0,why:"er تأخذ hat.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Er",w:"Hund",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Er",answerType:"verb",blankPosition:"after-subj"},
{id:"f38",s:"Gestern ___ ich Fußball gespielt.",o:["habe","hast","hat","haben"],c:0,why:"الماضي مع haben.",lvl:"A2",pos:"after-time",typ:"aux",ctx:"sport",start:"Gestern",w:"Fußball",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"noun-phrase",grammarTarget:"perfect/future",sentenceStarter:"Gestern",answerType:"aux",blankPosition:"after-time"},
{id:"f39",s:"Morgen ___ ich nach Kairo fahren.",o:["werde","wirst","wird","werden"],c:0,why:"المستقبل مع werden.",lvl:"A2",pos:"after-time",typ:"aux",ctx:"travel",start:"Morgen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"perfect/future",sentenceStarter:"Morgen",answerType:"aux",blankPosition:"after-time"},
{id:"f40",s:"Ich habe gestern einen Film ___.",o:["gesehen","sehen","sieht","gesehene"],c:0,why:"التصريف الثالث آخر الجملة.",lvl:"A2",pos:"end",typ:"participle",ctx:"home",start:"Ich",w:"Film",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"pronoun",grammarTarget:"partizip",sentenceStarter:"Ich",answerType:"participle",blankPosition:"end"},
{id:"f41",s:"Wir sind nach Berlin ___.",o:["gefahren","fahren","fährt","fahrst"],c:0,why:"fahren تأخذ sein.",lvl:"A2",pos:"end",typ:"participle",ctx:"travel",start:"Wir",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"pronoun",grammarTarget:"partizip",sentenceStarter:"Wir",answerType:"participle",blankPosition:"end"},
{id:"f42",s:"Hast du die Hausaufgaben ___?",o:["gemacht","machen","macht","machst"],c:0,why:"التصريف الثالث.",lvl:"A2",pos:"end",typ:"participle",ctx:"school",start:"Hast",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"verb-first",grammarTarget:"partizip",sentenceStarter:"Hast",answerType:"participle",blankPosition:"end"},
{id:"f43",s:"Ich muss heute früh ___.",o:["aufstehen","aufstehe","stehe auf","aufsteht"],c:0,why:"المنفصل آخر الجملة بالمصدر.",lvl:"A2",pos:"end",typ:"separable",ctx:"daily",start:"Ich",w:"aufstehen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"pronoun",grammarTarget:"trennbare",sentenceStarter:"Ich",answerType:"separable",blankPosition:"end"},
{id:"f44",s:"Ruf mich bitte ___!",o:["an","auf","aus","zu"],c:0,why:"anrufen = يتصل.",lvl:"A2",pos:"end",typ:"separable",ctx:"daily",start:"Ruf",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"verb-first",grammarTarget:"trennbare",sentenceStarter:"Ruf",answerType:"separable",blankPosition:"end"},
{id:"f45",s:"Ich helfe ___ Bruder.",o:["meinem","meinen","mein","meine"],c:0,why:"helfen + Dativ.",lvl:"A2",pos:"before-noun",typ:"dativ",ctx:"family",start:"Ich",w:"Bruder",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"dativ",sentenceStarter:"Ich",answerType:"dativ",blankPosition:"before-noun"},
{id:"f46",s:"Das Geschenk ist ___ dich.",o:["für","von","mit","zu"],c:0,why:"für + Akkusativ.",lvl:"A2",pos:"mid",typ:"prep",ctx:"friends",start:"Das",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"prepositions",sentenceStarter:"Das",answerType:"prep",blankPosition:"mid"},
{id:"f47",s:"___ regnet es heute.",o:["Es","Er","Sie","Das"],c:0,why:"الطقس = es.",lvl:"A2",pos:"start",typ:"pronoun",ctx:"weather",start:"Es",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"noun-phrase",grammarTarget:"pronouns",sentenceStarter:"Es",answerType:"pronoun",blankPosition:"start"},
{id:"f48",s:"Ich freue ___ auf den Urlaub.",o:["mich","dich","mir","michs"],c:0,why:"sich freuen auf + Akk.",lvl:"A2",pos:"mid",typ:"reflexive",ctx:"travel",start:"Ich",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"reflexivverben",sentenceStarter:"Ich",answerType:"reflexive",blankPosition:"mid"},
{id:"f49",s:"___ ihr schon gegessen?",o:["Habt","Haben","Hat","Hast"],c:0,why:"ihr تأخذ habt.",lvl:"A2",pos:"start",typ:"aux",ctx:"food",start:"Habt",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"noun-phrase",grammarTarget:"perfect/future",sentenceStarter:"Habt",answerType:"aux",blankPosition:"start"},
{id:"f50",s:"Die Tasche ___ meiner Schwester.",o:["gehört","gehören","gehöre","gehörst"],c:0,why:"المفرد يأخذ t.",lvl:"A2",pos:"after-subj",typ:"verb",ctx:"family",start:"Die",w:"Tasche",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Die",answerType:"verb",blankPosition:"after-subj"},
{id:"f51",s:"Wir treffen ___ am Bahnhof.",o:["uns","euch","sich","unsere"],c:0,why:"treffen + uns للجمع.",lvl:"A2",pos:"mid",typ:"reflexive",ctx:"travel",start:"Wir",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"reflexivverben",sentenceStarter:"Wir",answerType:"reflexive",blankPosition:"mid"},
{id:"f52",s:"Kannst du mir ___?",o:["helfen","helfe","hilfst","hilft"],c:0,why:"بعد المساعد مصدر.",lvl:"A2",pos:"end",typ:"verb",ctx:"friends",start:"Kannst",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"verb-first",grammarTarget:"conjugation",sentenceStarter:"Kannst",answerType:"verb",blankPosition:"end"},
{id:"f53",s:"Er interessiert ___ für Autos.",o:["sich","dich","mich","sie"],c:0,why:"sich interessieren für.",lvl:"A2",pos:"mid",typ:"reflexive",ctx:"general",start:"Er",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"reflexivverben",sentenceStarter:"Er",answerType:"reflexive",blankPosition:"mid"},
{id:"f54",s:"Der Zug fährt ___ 10 Uhr ab.",o:["um","am","im","von"],c:0,why:"um للساعة.",lvl:"A2",pos:"mid",typ:"prep",ctx:"travel",start:"Der",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"prepositions",sentenceStarter:"Der",answerType:"prep",blankPosition:"mid"},
{id:"f55",s:"Unsere Eltern ___ in Alexandria.",o:["wohnen","wohnt","wohne","wohnst"],c:0,why:"الجمع يأخذ المصدر.",lvl:"A2",pos:"after-subj",typ:"verb",ctx:"family",start:"Unsere",w:"wohnen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Unsere",answerType:"verb",blankPosition:"after-subj"},
{id:"f56",s:"Ich bleibe zu Hause, ___ ich krank bin.",o:["weil","denn","aber","und"],c:0,why:"weil + فعل آخر الجملة.",lvl:"B1",pos:"mid",typ:"conjunction",ctx:"home",start:"Ich",chapterId:"K0",chapterName:"Einführung – مقدمة",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"nebensatz",sentenceStarter:"Ich",answerType:"conjunction",blankPosition:"mid"},
{id:"f57",s:"___ ich müde bin, lerne ich weiter.",o:["Obwohl","Aber","Weil","Denn"],c:0,why:"obwohl = مع أن.",lvl:"B1",pos:"start",typ:"conjunction",ctx:"study",start:"Obwohl",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"adverbial",grammarTarget:"nebensatz",sentenceStarter:"Obwohl",answerType:"conjunction",blankPosition:"start"},
{id:"f58",s:"Ich denke, ___ du recht hast.",o:["dass","was","wer","wie"],c:0,why:"dass للاعتقاد.",lvl:"B1",pos:"mid",typ:"conjunction",ctx:"general",start:"Ich",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"nebensatz",sentenceStarter:"Ich",answerType:"conjunction",blankPosition:"mid"},
{id:"f59",s:"Wenn es ___, bleiben wir zu Hause.",o:["regnet","regnen","regne","regnst"],c:0,why:"es regnet.",lvl:"B1",pos:"mid",typ:"verb",ctx:"weather",start:"Wenn",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Wenn",answerType:"verb",blankPosition:"mid"},
{id:"f60",s:"Das Buch, ___ ich lese, ist spannend.",o:["das","was","der","die"],c:0,why:"ضمير الوصل = das.",lvl:"B1",pos:"mid",typ:"relative",ctx:"general",start:"Das",w:"Buch",chapterId:"K0",chapterName:"Einführung – مقدمة",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"relativsatz",sentenceStarter:"Das",answerType:"relative",blankPosition:"mid"},
{id:"f61",s:"Er fragt, ___ der Zug kommt.",o:["wann","was","wer","wo"],c:0,why:"السؤال عن الوقت = wann.",lvl:"B1",pos:"mid",typ:"question",ctx:"travel",start:"Er",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"w-fragen",sentenceStarter:"Er",answerType:"question",blankPosition:"mid"},
{id:"f62",s:"Trotz ___ Wetters bleiben wir zu Hause.",o:["des","dem","der","den"],c:0,why:"trotz + Genitiv.",lvl:"B1",pos:"mid",typ:"genitive",ctx:"weather",start:"Trotz",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"adverbial",grammarTarget:"genitiv",sentenceStarter:"Trotz",answerType:"genitive",blankPosition:"mid"},
{id:"f63",s:"Je mehr ich lerne, ___ besser spreche ich.",o:["desto","als","wie","wenn"],c:0,why:"je...desto للمقارنة.",lvl:"B1",pos:"mid",typ:"conjunction",ctx:"study",start:"Je",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"adverbial",grammarTarget:"nebensatz",sentenceStarter:"Je",answerType:"conjunction",blankPosition:"mid"},
{id:"f64",s:"Ich weiß nicht, ___ ich machen soll.",o:["was","wer","wo","dass"],c:0,why:"was + soll.",lvl:"B1",pos:"mid",typ:"question",ctx:"general",start:"Ich",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"w-fragen",sentenceStarter:"Ich",answerType:"question",blankPosition:"mid"},
{id:"f65",s:"Er arbeitet, ___ Geld zu verdienen.",o:["um","zu","für","damit"],c:0,why:"um...zu للغرض.",lvl:"B1",pos:"mid",typ:"umzu",ctx:"work",start:"Er",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"um-zu",sentenceStarter:"Er",answerType:"umzu",blankPosition:"mid"},
{id:"f66",s:"Jeden Abend ___ ich Deutsch.",o:["lerne","lernst","lernt","lernen"],c:0,why:"الفعل ثانيًا ثم الفاعل.",lvl:"A2",pos:"after-time",typ:"verb",ctx:"study",start:"Jeden",w:"lernen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Jeden",answerType:"verb",blankPosition:"after-time"},
{id:"f67",s:"___ besucht meinen Bruder?",o:["Wer","Wen","Was","Wo"],c:0,why:"السؤال عن الفاعل = Wer.",lvl:"A2",pos:"start",typ:"question",ctx:"family",start:"Wer",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wer",answerType:"question",blankPosition:"start"}];
/* Sentence-completion picker: level filter + type distribution + anti-repeat.
   Never repeats pos/typ/start/ctx back-to-back (soft constraint with fallback). */
/* Similarity 0..1 across blank/answer/structure/context/starter. */
function fillSim(a,b){
  let s=0;
  if(a.pos===b.pos)s+=0.25;
  if(a.typ===b.typ)s+=0.25;
  if(a.ctx===b.ctx)s+=0.2;
  if(a.start===b.start)s+=0.15;
  if(a.structureType&&a.structureType===b.structureType)s+=0.15;
  return s;
}
function pickFillBank(lvl,count,chapterIds){
  let pool=SENT_FILL.filter(q=>(!lvl||lvl==="mix"||q.lvl===lvl)&&(!chapterIds||!chapterIds.length||chapterIds.indexOf(q.chapterId)>=0));
  if(!pool.length)pool=SENT_FILL.slice();
  pool=shuffle(pool);
  const out=[],usedCtx={},usedStart={};
  const counts={};
  const target={verb:2,article:1,prep:1,vocab:1,pronoun:1,negation:1};
  function patternKey(q){return q.pos+"|"+q.typ;}
  for(const q of pool){
    if(out.length>=count)break;
    const t=target[q.typ]!=null;
    if(t&&counts[q.typ]>=target[q.typ]&&out.length<count-2)continue;
    if(usedCtx[q.ctx]>=2)continue;
    if((usedStart[q.start]||0)>=Math.max(2,Math.ceil(count*0.3)))continue;
    const prev=out[out.length-1],prev2=out[out.length-2];
    if(prev&&fillSim(q,prev)>=0.7)continue;
    if(prev&&prev2&&patternKey(q)===patternKey(prev)&&patternKey(q)===patternKey(prev2))continue;
    out.push(q);counts[q.typ]=(counts[q.typ]||0)+1;usedCtx[q.ctx]=(usedCtx[q.ctx]||0)+1;usedStart[q.start]=(usedStart[q.start]||0)+1;
  }
  for(const q of pool){
    if(out.length>=count)break;
    if(out.indexOf(q)<0){
      const prev=out[out.length-1];
      if(prev&&fillSim(q,prev)>=0.9)continue;
      out.push(q);
    }
  }
  return out.slice(0,count);
}
/* Overall diversity score 0-100 for a sample (bank or session). */
function fillDiversityScore(sample){
  if(!sample.length)return 0;
  const du=k=>new Set(sample.map(q=>q[k])).size;
  const share=k=>{const c={};sample.forEach(q=>{c[q[k]]=(c[q[k]]||0)+1;});return Math.max.apply(null,Object.keys(c).map(x=>c[x]))/sample.length;};
  const posS=Math.min(1,du("pos")/6)*25;
  const typS=Math.min(1,du("typ")/10)*25;
  const startS=Math.min(1,du("start")/10)*20;
  const ctxS=Math.min(1,du("ctx")/10)*15;
  const evenS=(share("pos")<=0.4&&share("typ")<=0.4)?15:Math.max(0,15-(Math.max(share("pos"),share("typ"))-0.4)*100);
  return Math.round(posS+typS+startS+ctxS+evenS);
}
function fillFull(q){return q.s.replace("___",q.o[q.c]);}
function fillToQuiz(q){
  const sh=shuffleOptions(q.o,q.c);
  let w=null;
  try{if(q.w)w=findWord(q.w)||null;}catch(e){}
  return {kind:"fillbank",prompt:"أكمل الجملة: "+q.s,opts:sh.opts,correct:sh.correct,correctText:sh.opts[sh.correct],
    explain:"الإجابة: "+fillFull(q)+" — "+q.why,w:w,fillItem:q};
}
function fillChapters(){
  const c={};
  SENT_FILL.forEach(q=>{c[q.chapterId]=(c[q.chapterId]||0)+1;});
  return (typeof KAPITEL!=="undefined"?KAPITEL.filter(k=>k.id!=="KX"):Object.keys(c).map(id=>({id:id}))).map(k=>({id:k.id,name:k.name||k.id,icon:k.icon||"📘",n:c[k.id]||0}));
}
function gMissing(box){
  const chaps=fillChapters();
  box.innerHTML='<div class="panel glass"><h3>🕳️ إكمال الجمل</h3><div class="muted">بدون وقت — اختر Kapitel أولًا (ليس مختلطًا تلقائيًا).</div>'
  +'<h4>📚 Kapitel auswählen</h4><div class="grid-2">'+chaps.map(c=>'<label class="panel glass game-card" style="cursor:pointer"><input type="checkbox" data-chap="'+c.id+'" '+(c.n?"":"disabled")+'> <b>'+c.icon+" "+c.id+'</b><div class="muted">'+escapeHtml(c.name)+'</div><div class="muted">'+c.n+' أسئلة</div></label>').join("")+'</div>'
  +'<div class="row-flex"><label><input type="checkbox" id="fillMulti"> ☑ Mehrere Kapitel</label></div>'
  +'<div class="row-flex"><button class="btn btn-gold sm" id="fillMix">🌍 Alle Kapitel – Gemischt</button></div>'
  +'<div class="row-flex"><span>المستوى:</span><select id="fillLvl"><option value="mix">متنوع</option><option value="A1">A1</option><option value="A2">A2</option><option value="B1">B1</option></select><span>الأسئلة:</span><select id="fillCount"><option>10</option><option>20</option><option>30</option></select><button class="btn btn-primary sm" id="fillStart">Starten 🚀</button></div></div><div id="gQ2"></div>';
  box.querySelectorAll("[data-chap]").forEach(cb=>cb.addEventListener("change",()=>{
    if(!box.querySelector("#fillMulti").checked)box.querySelectorAll("[data-chap]").forEach(o=>{if(o!==cb)o.checked=false;});
  }));
  $("fillMix").addEventListener("click",()=>runFill(box,{chapters:[],lvl:$("fillLvl").value,count:parseInt($("fillCount").value,10)||10}));
  $("fillStart").addEventListener("click",()=>{
    const sel=Array.from(box.querySelectorAll("[data-chap]:checked")).map(o=>o.getAttribute("data-chap"));
    if(!sel.length){toast("اختر Kapitel أولًا 📚","err");return;}
    runFill(box,{chapters:sel,lvl:$("fillLvl").value,count:parseInt($("fillCount").value,10)||10});
  });
}
function fillBlankHtml(s){
  return escapeHtml(s).replace("___",'<span class="fill-blank" id="fillBlank">______</span>');
}
function runFill(box,opt){
  const chapters=(opt&&opt.chapters)||[];
  const lvl=(opt&&opt.lvl)||"mix";
  const mixed=!chapters.length;
  const pool=pickFillBank(lvl,(opt&&opt.count)||10,mixed?null:chapters);
  if(!pool.length){toast("لا توجد أسئلة كافية لهذا الاختيار ⚠️","err");return;}
  const title=mixed?"Alle Kapitel – Gemischt":chapters.map(id=>{const k=(typeof KAPITEL!=="undefined"?KAPITEL.find(x=>x.id===id):null);return k?k.id+" "+k.name:id;}).join(" + ");
  let i=0,score=0;const perChap={};
  function q(){
    if(i>=pool.length){return finish();}
    const m=pool[i];
    const sh=shuffleOptions(m.o,m.c);
    const letters=["A","B","C","D"];
    let w=null;
    try{if(m.w)w=findWord(m.w)||null;}catch(e){}
    box.innerHTML='<div class="muted">'+escapeHtml(title)+'</div><div class="muted">'+m.chapterId+' • '+m.lvl+' • Satztest</div><div class="muted">Frage '+(i+1)+' von '+pool.length+'</div><div class="progress" style="margin:10px 0"><div class="progress-fill" style="width:'+(i/pool.length*100)+'%"></div></div><h3 class="fill-sent" style="direction:ltr">'+fillBlankHtml(m.s)+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div><div class="row-flex"><button class="btn btn-primary hidden" id="gNextQ">التالي ⏭</button></div>';
    gameOpts($("gQ"),sh.opts.map((o,j)=>letters[j]+" ) "+o),j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      const blank=$("fillBlank");
      const ok=j===sh.correct;
      if(blank){blank.textContent=sh.opts[j];blank.classList.add(ok?"filled-ok":"filled-no");}
      perChap[m.chapterId]=perChap[m.chapterId]||{ok:0,n:0};perChap[m.chapterId].n++;
      if(ok){fb.className="quiz-feedback ok";fb.textContent="✅ Richtig! "+m.s.replace("___",sh.opts[sh.correct])+" — "+m.why;score++;S.totalCorrect++;perChap[m.chapterId].ok++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ Falsch. إجابتك: "+sh.opts[j]+" — الصحيحة: "+sh.opts[sh.correct]+" — "+m.why;if(w)recordMistake(w,sh.opts[j],"fillbank");}
      S.totalAnswered++;sessTick(ok,w?w.id:undefined);save();
      $("gNextQ").classList.remove("hidden");
    });
    $("gNextQ").addEventListener("click",()=>{i++;q();});
  }
  function finish(){
    const total=pool.length,pct=total?Math.round(score/total*100):0;
    gameEnd("gameBox","🕳️ "+title,score,total,score*5+10,"missing");
    const rows=Object.keys(perChap).map(id=>'<div class="muted">'+id+': '+perChap[id].ok+' / '+perChap[id].n+'</div>').join("");
    const box2=$("gameBox");
    box2.innerHTML+='<div class="panel glass"><h3>🎯 Prüfung Ergebnis</h3><div>Gesamt: '+score+' / '+total+' ('+pct+'%)</div>'+rows+'</div>';
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
/* ===== NEW GAMES: Battle / Bomb / Detective-story / Shop / Runner ===== */
function battleQs(n){
  const ws=shuffle(allWords()).slice(0,n),out=[];
  ws.forEach((w,i)=>{
    if(w.art!=="-"&&i%2===0)out.push({t:"اختر الأداة: ___ "+w.de,opts:["der","die","das"],correct:w.art==="der"?0:w.art==="die"?1:2,w:w,why:w.art+" "+w.de});
    else{const os=shuffle([w.ar].concat(shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)));out.push({t:"ما معنى "+fullDe(w)+"؟",opts:os,correct:os.indexOf(w.ar),w:w,why:fullDe(w)+" = "+w.ar});}
  });
  return out;
}
function gbattle(box){
  const lv=gLevel("gbattle"),cfg=levelCfg(lv);
  const pool=battleQs(cfg.rounds);
  let i=0,php=100,ehp=100,score=0,xp=0,t0=Date.now();
  function q(){
    if(i>=pool.length||ehp<=0||php<=0)return end();
    const Q=pool[i],boss=(i+1)%5===0&&i>0;
    if(boss)Q.t="👹 BOSS: "+Q.t;
    let left=cfg.secs;
    box.innerHTML='<div class="boss-arena">🧑⚔️👹</div><div class="muted">⚔️ جولة '+(i+1)+'/'+pool.length+(boss?" • 👹 BOSS":"")+'</div><div class="stat-bar-row"><span class="lbl">🧑 أنت</span><div class="bar"><div class="fill" style="width:'+php+'%;background:linear-gradient(90deg,#16a34a,#4ade80)"></div></div><b>'+php+'</b></div><div class="stat-bar-row"><span class="lbl">👹 خصم</span><div class="bar"><div class="fill" style="width:'+ehp+'%;background:linear-gradient(90deg,#991b1b,#ef4444)"></div></div><b>'+ehp+'</b></div><div class="muted">⏱️ <b id="gT">'+left+'</b> • '+comboLabel()+' • '+coinStr()+'</div><h3>'+escapeHtml(Q.t)+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    const sh=shuffleOptions(Q.opts,Q.correct);
    const timer=setInterval(()=>{left--;const e=$("gT");if(e)e.textContent=left;if(left<=0){clearInterval(timer);answer(-1,true);}},1000);
    gameOpts($("gQ"),sh.opts,j=>{clearInterval(timer);answer(j,false);});
    function answer(j,timeout){
      const fb=$("gFb");fb.classList.remove("hidden");
      const fast=!timeout&&((Date.now()-t0)<cfg.secs*500);
      const ok=j===sh.correct;
      if(ok){
        const mult=comboHit(),dmg=(boss?24:12)+(fast?6:0);
        ehp=Math.max(0,ehp-dmg);score++;
        const gain=10*mult+(fast?5:0);
        xp+=gain;earnCoins(2+mult,"gbattle");xpFloat("gameBox","+"+gain+" XP");
        fb.className="quiz-feedback ok";fb.textContent="💥 أصبت الخصم -"+dmg+"! "+Q.why+" • "+comboLabel();
        S.totalCorrect++;
      }else{
        comboMiss();php=Math.max(0,php-15);
        fb.className="quiz-feedback no";fb.textContent="💔 الخصم يهاجم! الصحيح: "+sh.opts[sh.correct]+" — "+Q.why;
        if(Q.w)recordMistake(Q.w,timeout?"—":sh.opts[j],"gbattle");
      }
      S.totalAnswered++;sessTick(ok,Q.w&&Q.w.id);save();i++;t0=Date.now();setTimeout(q,1600);
    }
  }
  function end(){
    const win=ehp<=0||(php>0&&score>=Math.ceil(pool.length*0.6));
    trackWin(win);
    if(win){addXP(xp+30,"gbattle");earnCoins(20,"gbattle-win");}
    else addXP(Math.round(xp/2),"gbattle");
    markStudyDay();checkAch();save();
    box.innerHTML='<div class="panel glass" style="text-align:center">'+(win?"🏆<h3>Victory!</h3>":"💀<h3>Game Over</h3>")+'<div>النقاط: '+score+'/'+pool.length+' • ⭐+'+(win?xp+30:Math.round(xp/2))+' XP • '+coinStr()+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 معركة جديدة</button><button class="btn btn-ghost sm" data-go2="games">🎮</button></div></div>';
    $("gAgain").addEventListener("click",()=>gbattle(box));
    box.querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage("games")));
  }
  q();
}
/* Bomb Defusal */
function gbomb(box){
  const lv=gLevel("gbomb");
  const total=lv===0?75:lv===1?90:lv===2?105:120;
  const stages=["🔌 Wire","🔢 Code","🔒 Lock","⚡ Final switch"];
  const pool=battleQs(8);
  let i=0,left=total,lives=3,score=0,xp=0,timer=null;
  function tick(){
    left--;
    const e=$("gT");if(e)e.textContent=left;
    const f=$("gTime");if(f)f.style.width=Math.max(0,left/total*100)+"%";
    if(left<=0){clearInterval(timer);boom();}
  }
  function q(){
    if(i>=pool.length)return defused();
    if(lives<=0)return boom();
    const Q=pool[i],st=stages[Math.min(stages.length-1,Math.floor(i/2))];
    box.innerHTML='<div class="muted">💣 '+st+' • مرحلة '+(i+1)+'/'+pool.length+' • '+hearts(lives,3)+' • '+comboLabel()+'</div><div class="progress sm"><div class="progress-fill red" id="gTime" style="width:'+(left/total*100)+'%"></div></div><div class="muted">⏱️ <b id="gT">'+left+'</b> • '+coinStr()+'</div><h3>💣 '+escapeHtml(Q.t)+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    if(!timer)timer=setInterval(tick,1000);
    const sh=shuffleOptions(Q.opts,Q.correct);
    gameOpts($("gQ"),sh.opts,j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){
        const mult=comboHit();
        score++;xp+=10*mult;earnCoins(2,"gbomb");xpFloat("gameBox","+"+(10*mult)+" XP");
        fb.className="quiz-feedback ok";fb.textContent="✅ تم فك جزء! "+Q.why+" • "+comboLabel();S.totalCorrect++;
      }else{
        comboMiss();lives--;left=Math.max(0,left-10);
        fb.className="quiz-feedback no";fb.textContent="🔴 خطأ! -10 ثوانٍ وخسارة حياة. الصحيح: "+sh.opts[sh.correct]+" — "+Q.why;
        if(Q.w)recordMistake(Q.w,sh.opts[j],"gbomb");
      }
      S.totalAnswered++;sessTick(j===sh.correct,Q.w&&Q.w.id);save();i++;setTimeout(q,1500);
    });
  }
  function boom(){
    clearInterval(timer);timer=null;comboMiss();trackWin(false);
    addXP(10,"gbomb");markStudyDay();checkAch();save();
    box.innerHTML='<div class="panel glass" style="text-align:center">💥<h3>BOOM — Game Over</h3><div>نقاط: '+score+'/'+pool.length+' • ⭐+10 XP</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 حاول مجددًا</button><button class="btn btn-ghost sm" data-go2="games">🎮</button></div></div>';
    $("gAgain").addEventListener("click",()=>gbomb(box));
    box.querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage("games")));
  }
  function defused(){
    clearInterval(timer);timer=null;trackWin(true);
    addXP(xp+30,"gbomb");earnCoins(20,"gbomb-win");markStudyDay();checkAch();save();
    box.innerHTML='<div class="panel glass" style="text-align:center">🎉<h3>Bomb Defused!</h3><div>نقاط: '+score+'/'+pool.length+' • وقت متبق: '+left+'ث • ⭐+'+(xp+30)+' XP • '+coinStr()+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 قنبلة جديدة</button><button class="btn btn-ghost sm" data-go2="games">🎮</button></div></div>';
    $("gAgain").addEventListener("click",()=>gbomb(box));
    box.querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage("games")));
  }
  q();
}
/* Detective story */
const GDET_CASE={title:"🕵️ اختفاء في الفندق",scenes:[
{q:"الموظف: Haben Sie reserviert؟ (هل حجزت؟) ماذا ترد؟",opts:["Ja, auf den Namen Omar.","Ich bin 20.","Tschüs!"],correct:0,why:"تأكيد الحجز بالاسم.",clue:"🧾 clue: الحجز باسم Omar."},
{q:"النزيل السابق غادر مسرعًا. ماذا تسأل؟",opts:["Wo ist der Bahnhof?","Wann ist er gegangen?","Wie spät ist es?"],correct:1,why:"السؤال عن الوقت يكشف مسار الأحداث.",clue:"🕰️ clue: غادر الساعة 8."},
{q:"الكاميرا أظهرت حقيبة حمراء. ما لون الحقيبة؟",opts:["Rot","Blau","Schwarz"],correct:0,why:"rote Tasche مذكورة.",clue:"👜 clue: حقيبة حمراء."},
{q:"من رأى النزيل آخر مرة؟",opts:["Der Kellner um 8 Uhr.","Niemand.","Der Hund."],correct:0,why:"الجرسون شاهده الثامنة.",clue:"🧑‍🍳 clue: الجرسون شاهده."},
{q:"أين ذهب على الأرجح؟",opts:["Zum Bahnhof.","Ins Bett.","In den See."],correct:0,why:"الحقيبة + الثامنة = قطار.",clue:"🚆 clue: تذكرة قطار ملغاة."}],
suspects:["الرجل ذو الحقيبة الحمراء","الجرسون","موظف الاستقبال","لا أحد — سافر بنفسه"],answer:0,
verdict:"المشتبه به: الرجل ذو الحقيبة الحمراء — غادر الثامنة بحقيبة حمراء نحو المحطة."};
function gdetect(box){
  let i=0,score=0,clues=[];
  function scene(){
    if(i>=GDET_CASE.scenes.length)return suspect();
    const s=GDET_CASE.scenes[i];
    const sh=shuffleOptions(s.opts,s.correct);
    box.innerHTML='<div class="muted">'+GDET_CASE.title+' • مشهد '+(i+1)+'/'+GDET_CASE.scenes.length+' • أدلة: '+clues.length+'</div><h3>'+escapeHtml(s.q)+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),sh.opts,j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+s.why+"<br>"+s.clue;score++;clues.push(s.clue);S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ "+s.why;}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(scene,2200);
    });
  }
  function suspect(){
    const sh=shuffleOptions(GDET_CASE.suspects,GDET_CASE.answer);
    box.innerHTML='<div class="muted">🔎 الأدلة المجمعة: '+clues.length+'</div><div class="muted">'+clues.map(escapeHtml).join("<br>")+'</div><h3>Who is the suspect? من المشتبه به؟</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),sh.opts,j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      const ok=j===sh.correct;
      if(ok){score++;S.totalCorrect++;}
      fb.className=ok?"quiz-feedback ok":"quiz-feedback no";
      fb.textContent=(ok?"🎉 قضية محلولة! ":"❌ ")+GDET_CASE.verdict;
      S.totalAnswered++;save();
      setTimeout(()=>gameEnd("gameBox","🕵️ German Detective",score,GDET_CASE.scenes.length+1,score*8+20,"gdetect"),2400);
    });
  }
  scene();
}
/* Shop simulator */
const SHOP_CASES=[
{say:"Guten Tag! Ich möchte einen Apfel.",ar:"نهارك سعيد! أريد تفاحة.",need:"Apfel",items:["Apfel","Brot","Milch","Käse"],price:2},
{say:"Ich brauche Milch. Was kostet sie?",ar:"أحتاج حليبًا. كم سعره؟",need:"Milch",items:["Milch","Tee","Reis","Fisch"],price:3},
{say:"Haben Sie ein rotes Kleid?",ar:"هل لديك فستان أحمر؟",need:"Kleid",items:["Kleid","Hose","Hemd","Schuhe"],price:25},
{say:"Ich möchte Brot. Sonst nichts.",ar:"أريد خبزًا. لا شيء آخر.",need:"Brot",items:["Brot","Kuchen","Apfel","Wurst"],price:4},
{say:"Was kostet der Käse?",ar:"كم سعر الجبن؟",need:"Käse",items:["Käse","Butter","Eier","Milch"],price:5},
{say:"Zahlen, bitte! Das ist alles.",ar:"الحساب من فضلك! هذا كل شيء.",need:"Kasse",items:["Kasse","Tür","Fenster","Tisch"],price:0}];
function gshop(box){
  const pool=shuffle(SHOP_CASES).slice(0,5);
  let i=0,score=0,xp=0;
  function q(){
    if(i>=pool.length){trackWin(score>=3);if(score>=3)earnCoins(20,"gshop-win");addXP(xp+20,"gshop");markStudyDay();checkAch();save();
      box.innerHTML='<div class="panel glass" style="text-align:center">🛒<h3>انتهت الوردية!</h3><div>زبائن سعداء: '+score+'/'+pool.length+' • ⭐+'+(xp+20)+' XP • '+coinStr()+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 وردية جديدة</button><button class="btn btn-ghost sm" data-go2="games">🎮</button></div></div>';
      $("gAgain").addEventListener("click",()=>gshop(box));
      box.querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage("games")));return;}
    const c=pool[i];
    const w=findWord(c.need);
    const itemNames=c.items.map(n=>{const f=findWord(n);return f?fullDe(f):"der "+n;});
    const needName=w?fullDe(w):"der "+c.need;
    const sh=placeCorrect(itemNames,needName,"gshop");
    box.innerHTML='<div class="muted">🛒 زبون '+(i+1)+'/'+pool.length+' • '+comboLabel()+'</div><div class="talk-bot">🧑 '+escapeHtml(c.say)+' <button class="mini-btn" id="gHear">🔊</button><div class="muted">'+escapeHtml(c.ar)+'</div></div><div class="muted">اختر المنتج الصحيح:</div><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    $("gHear").addEventListener("click",()=>speakGerman(c.say));
    setTimeout(()=>speakGerman(c.say),300);
    gameOpts($("gQ"),sh.opts,j=>{
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){
        const mult=comboHit();score++;xp+=10*mult;earnCoins(3,"gshop");xpFloat("gameBox","+"+(10*mult)+" XP");
        fb.className="quiz-feedback ok";fb.textContent="✅ أحسنت! "+(c.price?("السعر: "+c.price+" يورو. ") :"")+"Danke! • "+comboLabel();S.totalCorrect++;
      }else{
        comboMiss();
        fb.className="quiz-feedback no";fb.textContent="❌ العميل أراد: "+needName;
        if(w)recordMistake(w,sh.opts[j],"gshop");
      }
      S.totalAnswered++;sessTick(j===sh.correct,w&&w.id);save();i++;setTimeout(q,2200);
    });
  }
  q();
}
/* Word Runner */
function grunner(box){
  const lv=gLevel("grunner");
  const total=lv===0?8:lv===1?10:12;
  const pool=shuffle(allWords()).slice(0,total);
  let i=0,score=0,lives=3,speed=1;
  function q(){
    if(i>=pool.length||lives<=0)return end();
    const w=pool[i];
    const secs=Math.max(3,Math.round(10-speed));
    let left=secs;
    const os=shuffle([w.ar].concat(shuffle(allWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)));
    box.innerHTML='<div class="muted">🏃 مسافة '+(i+1)+'/'+pool.length+' • سرعة x'+speed.toFixed(1)+' • '+hearts(lives,3)+' • '+comboLabel()+'</div><div class="progress sm"><div class="progress-fill" style="width:'+(i/pool.length*100)+'%"></div></div><div style="font-size:40px;text-align:center">🏃💨</div><h3 style="direction:ltr;text-align:center;font-size:30px">'+escapeHtml(fullDe(w))+'</h3><div class="muted" style="text-align:center">⏱️ <b id="gT">'+left+'</b></div><div id="gQ"></div>';
    const timer=setInterval(()=>{left--;const e=$("gT");if(e)e.textContent=left;if(left<=0){clearInterval(timer);answer(-1);}},1000);
    gameOpts($("gQ"),os,j=>{clearInterval(timer);answer(j);});
    function answer(j){
      if(os[j]===w.ar){
        const mult=comboHit();score++;speed=Math.min(3,speed+0.15);
        const gain=Math.round(8*mult);
        addXP(gain,"grunner");earnCoins(2,"grunner");xpFloat("gameBox","+"+gain+" XP");
        toast("⚡ أسرع! "+comboLabel(),"ok");S.totalCorrect++;
      }else{
        comboMiss();lives--;speed=Math.max(1,speed-0.3);
        recordMistake(w,os[j],"grunner");toast("❌ "+fullDe(w)+" = "+w.ar,"err");
      }
      S.totalAnswered++;sessTick(os[j]===w.ar,w.id);save();i++;setTimeout(q,900);
    }
  }
  function end(){
    const win=lives>0&&score>=Math.ceil(pool.length*0.6);
    trackWin(win);
    const xp=Math.round(score*4+(win?25:5));
    if(win)earnCoins(15,"grunner-win");
    addXP(xp,"grunner");markStudyDay();checkAch();save();
    box.innerHTML='<div class="panel glass" style="text-align:center">'+(win?"🏁<h3>وصلت النهاية!</h3>":"😮‍💨<h3>تعبت!</h3>")+'<div>نقاط: '+score+'/'+pool.length+' • ⭐+'+xp+' XP • '+coinStr()+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 اجري مجددًا</button><button class="btn btn-ghost sm" data-go2="games">🎮</button></div></div>';
    $("gAgain").addEventListener("click",()=>grunner(box));
    box.querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage("games")));
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
  if(allDone&&!d.celebrated){d.celebrated=1;addXP(30,"daily");earnCoins(15,"daily");save();h+='<div class="quiz-feedback ok">🏆 Daily Challenge Complete! ⭐+30 • 🪙+15</div>';}
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
  // game stats
  let gp=0;Object.keys(S.gstats||{}).forEach(k=>{gp+=S.gstats[k].n||0;});
  let fav="—",favN=0;Object.keys(S.gstats||{}).forEach(k=>{if((S.gstats[k].n||0)>favN){favN=S.gstats[k].n;const g=GAMES.find(x=>x.id===k);fav=g?g.t:k;}});
  const wins=S.wins||0,losses=S.losses||0;
  const wr=(wins+losses)?Math.round(wins/(wins+losses)*100):0;
  h+='<div class="panel glass"><h3>📊 My Game Stats</h3><div class="muted">🎮 ألعاب: '+gp+' • ✅ فوز: '+wins+' • ❌ خسارة: '+losses+' • 🏆 فوز: '+wr+'%</div><div class="progress"><div class="progress-fill" style="width:'+wr+'%"></div></div><div class="muted">⭐ XP الكلي: '+(S.xp||0)+' • '+coinStr()+' • 🔥 أفضل كومبو: '+(S.bestCombo||0)+' • ❤️ اللعبة المفضلة: '+fav+'</div></div>';
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



