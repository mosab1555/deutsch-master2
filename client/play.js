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
{id:"grunner",t:"🏃 Word Runner",d:"اجري بالكلمات الصحيحة",xp:50},
{id:"tower",tk:"gt_tower",tdk:"gt_tower_d",d:"تسلق البرج",xp:45,skill:"📐 قواعد"},
{id:"escape",tk:"gt_escape",tdk:"gt_escape_d",d:"اهرب بحل الأقفال",xp:55,skill:"🗝️ مختلط"},
{id:"random",tk:"gt_random",tdk:"gt_random_d",d:"تحدٍ مختلف كل جولة",xp:40,skill:"🎲 مختلط"},
{id:"conv",tk:"gt_conv",tdk:"gt_conv_d",d:"حوارات بمهام متنوعة",xp:40,skill:"💬 محادثة"},
{id:"spell",tk:"gt_spell",tdk:"gt_spell_d",d:"اكتب الكلمة صح",xp:35,skill:"🔤 كتابة"},
{id:"traffic",tk:"gt_traffic",tdk:"gt_traffic_d",d:"قرارات سريعة",xp:40,skill:"🚦 مواقف"},
{id:"adventure",tk:"gt_adventure",tdk:"gt_adventure_d",d:"مغامرة بين الأماكن",xp:50,skill:"🗺️ مغامرة"}];
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
/* Kapitel content filter (dynamic from KAPITEL + mixed). Falls back to full
   content when the chapter pool is too small. Persisted in S.gkap. */
function GKap(){try{ensurePlay();return S.gkap||"";}catch(e){return "";}}
function setGKap(k){try{ensurePlay();S.gkap=k||"";save();}catch(e){}}
function kapWords(){
  try{
    const k=GKap(),w=allWords();
    if(!k)return w;
    const f=w.filter(x=>(x.kap||"KX")===k);
    return f.length>=4?f:w;
  }catch(e){return allWords();}
}
function kapSents(){
  try{
    const k=GKap();
    if(!k)return SENT_FILL.slice();
    const f=SENT_FILL.filter(x=>x.chapterId===k);
    return f.length>=4?f:SENT_FILL.slice();
  }catch(e){return SENT_FILL.slice();}
}
function kapNouns(){
  const n=kapWords().filter(w=>w.type==="اسم"&&w.art!=="-"&&/^[A-ZÄÖÜ]/.test(w.de));
  return n.length>=4?n:trickNouns();
}
function gpool(full,fn,min){
  try{
    const k=GKap();
    if(k){const f=full.filter(w=>((w.kap||w.chapterId||"KX")===k)&&(!fn||fn(w)));if(f.length>=(min||4))return shuffle(f);}
    const p=full.filter(w=>!fn||fn(w));return shuffle(p);
  }catch(e){return shuffle(full.filter(w=>!fn||fn(w)));}
}
/* Medals by accuracy (shared result system). */
function gMedal(acc){
  if(acc>=100)return {e:"💎",k:"perfect"};
  if(acc>=80)return {e:"🥇",k:"gold"};
  if(acc>=60)return {e:"🥈",k:"silver"};
  if(acc>=40)return {e:"🥉",k:"bronze"};
  return {e:"",k:"none"};
}
function gMedalRank(k){return {none:0,bronze:1,silver:2,gold:3,perfect:4}[k]||0;}
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
  const medal=gMedal(acc),st=gStat(key);
  if(gMedalRank(medal.k)>gMedalRank(st.medal||"none")){st.medal=medal.k;save();}
  $(boxId).innerHTML='<div class="panel glass" style="text-align:center">🎉<h3>'+title+'</h3><div>النتيجة: '+score+'/'+total+' ('+acc+'%)</div><div style="font-size:34px">'+medal.e+'</div><div class="muted">'+t("g_acc")+': '+acc+'% • '+t("g_best")+': '+(st.best||0)+'</div><div>⭐+'+xp+' XP • '+coinStr()+'</div><div class="row-flex"><button class="btn btn-primary sm" id="gAgain">🔄 العب مجددًا</button><button class="btn btn-ghost sm" data-go2="games">🎮 الألعاب</button></div></div>';
  $("gAgain").addEventListener("click",()=>startGame(key));
  $(boxId).querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>showPage(b.getAttribute("data-go2"))));
}
const GSKILL={rush:"⚡ سرعة",battle:"📚 مفردات",builder:"🧩 جمل",memory:"🧠 ذاكرة",missing:"📝 مفردات",tf:"📚 مفردات",speed:"⚡ سرعة",catch:"🎧 استماع",detective:"📐 قواعد",boss:"👹 مختلط",pic:"📚 مفردات",music:"🎧 استماع",gbattle:"📚 مفردات",gbomb:"📚 مفردات",gdetect:"📖 قراءة",gshop:"💬 محادثة",grunner:"📚 مفردات",tower:"📐 قواعد",escape:"🗝️ مختلط",random:"🎲 مختلط",conv:"💬 محادثة",spell:"🔤 كتابة",traffic:"🚦 مواقف",adventure:"🗺️ مغامرة"};
function gMedalEmoji(k){return {perfect:"💎",gold:"🥇",silver:"🥈",bronze:"🥉"}[k]||"—";}
function renderGames(){
  ensurePlay();
  const mood=S.daily.mood||"🙂";
  const gk=GKap();
  const kapBtns=['<button class="btn btn-ghost sm" data-gkap="" style="'+(!gk?"border-color:var(--cyan)":"")+'">🔀 '+t("g_mixed")+'</button>'].concat(KAPITEL.map(k=>'<button class="btn btn-ghost sm" data-gkap="'+k.id+'" style="'+(gk===k.id?"border-color:var(--cyan)":"")+'">'+k.icon+" "+k.id+'</button>')).join("");
  $("gamesBox").innerHTML='<div class="panel glass"><h3>🎮 Game Center</h3><div class="muted">مزاج اليوم: '+mood+' • '+coinStr()+' • العب وتعلّم واكسب XP وCoins حقيقية.</div><div class="muted" style="font-weight:800;margin-top:8px">'+t("g_kap")+'</div><div class="row-flex" style="flex-wrap:wrap">'+kapBtns+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="moodBtn">😴🙂🔥 مزاجي</button><button class="btn btn-gold sm" data-go2="challenge">⚡ التحدي اليومي</button><button class="btn btn-ghost sm" data-go2="me">📊 إحصائياتي</button></div></div><div class="grid-2">'+GAMES.map(g=>{
    const s=gStat(g.id),lv=gLevel(g.id);
    const locked=levelLocked(3)&&g.expert;
    return '<div class="panel glass game-card"><h4>'+(g.tk?t(g.tk):g.t)+'</h4><div class="muted">'+(g.tdk?t(g.tdk):g.d)+'</div><div class="muted">'+(GSKILL[g.id]||"🎮")+' • '+t("g_dlevel")+': '+GLEVELS[lv]+' • XP ~'+g.xp+'</div><div class="muted">'+t("g_best")+': '+(s.best||0)+' • '+(gMedalEmoji(s.medal)||"—")+' • '+t("g_played")+': '+s.n+'</div>'+(locked?'<div class="muted">🔒 Expert يُفتح عند Level 10</div><button class="btn btn-ghost sm" disabled>مغلق 🔒</button>':'<div class="row-flex"><select data-lv="'+g.id+'" title="الصعوبة">'+GLEVELS.map((l,i)=>'<option value="'+i+'"'+(i===lv?" selected":"")+'>'+l+'</option>').join("")+'</select><button class="btn btn-primary sm" data-g="'+g.id+'">▶ '+t("g_start")+'</button></div>')+'</div>';
  }).join("")+'</div><div id="gameBox"></div>';
  $("gamesBox").querySelectorAll("[data-gkap]").forEach(b=>b.addEventListener("click",()=>{setGKap(b.getAttribute("data-gkap"));renderGames();}));
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
  ({rush:gRush,battle:gBattle,builder:gBuilder,memory:gMemory,missing:gMissing,tf:gTF,speed:gSpeed,catch:gCatch,detective:gDetective,boss:gBoss,pic:gPic,music:gMusic,gbattle:gbattle,gbomb:gbomb,gdetect:gdetect,gshop:gshop,grunner:grunner,tower:gTower,escape:gEscape,random:gRandom,conv:gConv,spell:gSpell,traffic:gTraffic,adventure:gAdventure}[id]||gRush)(box);
}
/* Game 1: Article Rush */
function gRush(box){
  const diff=gDiff("rush");
  let pool=shuffle(kapNouns());
  if(diff===2)pool=pool.filter(w=>/^(die|das)/.test(fullDe(w))||w.de.length>8);
  pool=pool.slice(0,10);
  let i=0,score=0,combo=0,xp=0;
  const T=diff===2?6:diff===1?8:12;
  function q(){
    if(i>=pool.length){const bonus=combo>=10?20:combo>=5?10:0;gameEnd("gameBox","⚡ Article Rush",score,pool.length,xp+bonus+pool.length*2,"rush",(bonus?" • Combo 🔥":""));return;}
    const w=pool[i];let left=T;
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+' • ⏱️ <b id="gT">'+left+'</b> • 🔥'+combo+'</div><h3 style="direction:ltr;text-align:center;font-size:30px">'+escapeHtml(w.de)+'</h3><div class="muted" style="text-align:center">'+escapeHtml(w.ar)+'</div><div id="gQ"></div>';
    const timer=setInterval(()=>{left--;const e=$("gT");if(e)e.textContent=left;if(!box.isConnected){clearInterval(timer);return;}if(left<=0){clearInterval(timer);answer(-1);}},1000);
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
  const pool=shuffle(kapWords()).slice(0,8);
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","⚔️ Word Battle",score,pool.length,score*5+10,"battle");return;}
    const w=pool[i],opts=shuffle([w.ar].concat(shuffle(kapWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)));
    let left=10;
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+' • ⏱️ <b id="gT">'+left+'</b></div><h3 style="direction:ltr;text-align:center;font-size:28px">'+escapeHtml(fullDe(w))+'</h3><div id="gQ"></div>';
    const timer=setInterval(()=>{left--;const e=$("gT");if(e)e.textContent=left;if(!box.isConnected){clearInterval(timer);return;}if(left<=0){clearInterval(timer);answer(-1);}},1000);
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
  let pool=shuffle(BUILD_SENTS).slice(0,6).map(s=>({words:s.slice(0,-1),ar:s[s.length-1]}));
  const ko=shuffle(kapSents().filter(f=>f.kind==="order"));
  if(ko.length>=3)pool=ko.slice(0,6).map(f=>({words:f.words,ar:f.chapterName}));
  let i=0,score=0;
  function q(){
    if(i>=pool.length){gameEnd("gameBox","🧩 Sentence Builder",score,pool.length,score*4+12,"builder");return;}
    const s=pool[i],words=s.words,ar=s.ar;
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
  const pool=shuffle(kapWords().filter(w=>w.ar.length<25)).slice(0,6);
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
[{id:"f1",s:"Ich ___ jeden Tag Deutsch.",o:["lerne","lernst","lernen","lernt"],c:0,why:"ich تأخذ e.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"study",start:"Ich",w:"lernen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Ich",answerType:"verb",blankPosition:"after-subj"},
{id:"f2",s:"Du ___ in Berlin.",o:["wohnst","wohne","wohnt","wohnen"],c:0,why:"du تأخذ st.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Du",w:"wohnen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Du",answerType:"verb",blankPosition:"after-subj"},
{id:"f3",s:"Er ___ gern Fußball.",o:["spielt","spiele","spielst","spielen"],c:0,why:"er يأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"sport",start:"Er",w:"spielen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Er",answerType:"verb",blankPosition:"after-subj"},
{id:"f4",s:"Wir ___ einen Film.",o:["sehen","sehe","sieht","siehst"],c:0,why:"wir تأخذ المصدر.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Wir",w:"sehen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Wir",answerType:"verb",blankPosition:"after-subj"},
{id:"f5",s:"___ du Zeit?",o:["Hast","Haben","Hat","Habe"],c:0,why:"السؤال يبدأ بالفعل.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Hast",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"verb-first",grammarTarget:"conjugation",sentenceStarter:"Hast",answerType:"verb",blankPosition:"start"},
{id:"f6",s:"Kinder ___ im Garten.",o:["spielen","spielt","spiele","spielst"],c:0,why:"الجمع يأخذ المصدر.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Kinder",w:"spielen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Kinder",answerType:"verb",blankPosition:"after-subj"},
{id:"f7",s:"Meine Mutter ___ heute zu Hause.",o:["bleibt","bleibst","bleiben","bleibe"],c:0,why:"المفرد المؤنث يأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"family",start:"Meine",w:"bleiben",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Meine",answerType:"verb",blankPosition:"after-subj"},
{id:"f8",s:"Mein Bruder ___ in Berlin.",o:["wohnt","wohne","wohnst","wohnen"],c:0,why:"er ضمنيًا يأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"family",start:"Mein",w:"wohnen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Mein",answerType:"verb",blankPosition:"after-subj"},
{id:"f9",s:"Er sieht ___ Mann.",o:["den","der","dem","die"],c:0,why:"مذكر مفعول → den.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"daily",start:"Er",w:"Mann",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Er",answerType:"article",blankPosition:"before-noun"},
{id:"f10",s:"Das ist ___ Bruder.",o:["mein","meine","meinen","meinem"],c:0,why:"مذكر فاعل → mein.",lvl:"A1",pos:"before-noun",typ:"poss",ctx:"family",start:"Das",w:"Bruder",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"possessives",sentenceStarter:"Das",answerType:"poss",blankPosition:"before-noun"},
{id:"f11",s:"Wir kaufen ___ neuen Computer.",o:["einen","ein","eine","einem"],c:0,why:"مذكر مفعول → einen.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"shopping",start:"Wir",w:undefined,chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Wir",answerType:"article",blankPosition:"before-noun"},
{id:"f12",s:"Maria ist nett. Ich mag ___.",o:["sie","ihr","du","es"],c:0,why:"مفعول sie ثابت.",lvl:"A1",pos:"end",typ:"pronoun",ctx:"friends",start:"Maria",w:undefined,chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"noun-phrase",grammarTarget:"pronouns",sentenceStarter:"Maria",answerType:"pronoun",blankPosition:"end"},
{id:"f13",s:"___ wohnst du?",o:["Wo","Wer","Wie","Wann"],c:0,why:"السؤال عن المكان = Wo.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Wo",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wo",answerType:"question",blankPosition:"start"},
{id:"f14",s:"Ich habe ___ Auto.",o:["kein","keine","nicht","ein"],c:0,why:"Auto محايد → kein.",lvl:"A1",pos:"after-verb",typ:"negation",ctx:"daily",start:"Ich",w:"Auto",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"verb_frame",subjectType:"pronoun",grammarTarget:"kein/nicht",sentenceStarter:"Ich",answerType:"negation",blankPosition:"after-verb"},
{id:"f15",s:"Das Auto ist sehr ___.",o:["schnell","langsam","schnelles","schnelle"],c:0,why:"الصفة بعد ist بدون نهاية.",lvl:"A1",pos:"end",typ:"adjective",ctx:"general",start:"Das",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"noun-phrase",grammarTarget:"adjectives",sentenceStarter:"Das",answerType:"adjective",blankPosition:"end"},
{id:"f16",s:"Ich stehe ___ auf.",o:["früh","früher","frühe","frühen"],c:0,why:"الظرف بدون نهاية.",lvl:"A1",pos:"mid",typ:"adverb",ctx:"daily",start:"Ich",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"adverbs",sentenceStarter:"Ich",answerType:"adverb",blankPosition:"mid"},
{id:"f17",s:"Wir fahren ___ Berlin.",o:["nach","in","aus","zu"],c:0,why:"الاتجاه لمدينة = nach.",lvl:"A1",pos:"after-verb",typ:"prep",ctx:"travel",start:"Wir",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"verb_frame",subjectType:"pronoun",grammarTarget:"prepositions",sentenceStarter:"Wir",answerType:"prep",blankPosition:"after-verb"},
{id:"f18",s:"Zum Telefonieren kaufe ich ein neues ___.",o:["Handy","Haus","Brot","Auto"],c:0,why:"السياق (للاتصال) يحدد الكلمة.",lvl:"A1",pos:"before-noun",typ:"vocab",ctx:"shopping",start:"Zum",w:"Handy",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"vocabulary",sentenceStarter:"Zum",answerType:"vocab",blankPosition:"before-noun"},
{id:"f19",s:"Heute ___ ich Deutsch.",o:["lerne","lernst","lernt","lernen"],c:0,why:"الفعل ثانيًا ثم الفاعل.",lvl:"A1",pos:"after-time",typ:"verb",ctx:"study",start:"Heute",w:"lernen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Heute",answerType:"verb",blankPosition:"after-time"},
{id:"f20",s:"___ Bruder wohnt in Berlin.",o:["Mein","Meine","Meinen","Ich"],c:0,why:"مذكر فاعل → Mein.",lvl:"A1",pos:"start",typ:"poss",ctx:"family",start:"Mein",w:"Bruder",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"noun-phrase",grammarTarget:"possessives",sentenceStarter:"Mein",answerType:"poss",blankPosition:"start"},
{id:"f21",s:"Ich sehe ___ alten Mann.",o:["den","der","dem","die"],c:0,why:"مذكر مفعول → den.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"daily",start:"Ich",w:"Mann",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Ich",answerType:"article",blankPosition:"before-noun"},
{id:"f22",s:"Morgen ___ meine Schwester nach Berlin.",o:["fährt","fahre","fährst","fahren"],c:0,why:"المفرد يأخذ t مع تغير الجذر.",lvl:"A1",pos:"after-time",typ:"verb",ctx:"family",start:"Morgen",w:undefined,chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Morgen",answerType:"verb",blankPosition:"after-time"},
{id:"f23",s:"Am Wochenende ___ ich meine Freunde.",o:["besuche","besuchst","besuchen","besucht"],c:0,why:"ich تأخذ e.",lvl:"A1",pos:"after-time",typ:"verb",ctx:"friends",start:"Am",w:undefined,chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Am",answerType:"verb",blankPosition:"after-time"},
{id:"f24",s:"___ gehe ich zur Universität.",o:["Heute","Ich","Gehe","Universität"],c:0,why:"الظرف أولًا ثم الفعل.",lvl:"A1",pos:"start",typ:"adverb",ctx:"study",start:"Heute",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"adverbial",grammarTarget:"adverbs",sentenceStarter:"Heute",answerType:"adverb",blankPosition:"start"},
{id:"f25",s:"Ich ___ jeden Morgen Kaffee.",o:["trinke","trinkst","trinkt","trinken"],c:0,why:"ich تأخذ e.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"food",start:"Ich",w:"trinken",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Ich",answerType:"verb",blankPosition:"after-subj"},
{id:"f26",s:"Ich warte ___ den Bus.",o:["auf","an","bei","zu"],c:0,why:"warten auf.",lvl:"A1",pos:"mid",typ:"prep",ctx:"travel",start:"Ich",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"prepositions",sentenceStarter:"Ich",answerType:"prep",blankPosition:"mid"},
{id:"f27",s:"Der Kaffee ___ heiß.",o:["ist","sind","seid","bist"],c:0,why:"المفرد يأخذ ist.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"food",start:"Der",w:"Kaffee",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Der",answerType:"verb",blankPosition:"after-subj"},
{id:"f28",s:"___ bitte die Tür!",o:["Mach","Machst","Machen","Macht"],c:0,why:"أمر du = الجذر.",lvl:"A1",pos:"start",typ:"imperative",ctx:"home",start:"Mach",w:undefined,chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"verb-first",grammarTarget:"imperativ",sentenceStarter:"Mach",answerType:"imperative",blankPosition:"start"},
{id:"f29",s:"Ich ___ heute arbeiten.",o:["muss","musst","müssen","müsst"],c:0,why:"ich تأخذ muss.",lvl:"A1",pos:"after-subj",typ:"modal",ctx:"work",start:"Ich",w:"arbeiten",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"modalverben",sentenceStarter:"Ich",answerType:"modal",blankPosition:"after-subj"},
{id:"f30",s:"Ist das ___ Schwester?",o:["meine","mein","meinen","meiner"],c:0,why:"مؤنثة → meine.",lvl:"A1",pos:"mid",typ:"poss",ctx:"family",start:"Das",w:undefined,chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"verb-first",subjectType:"noun-phrase",grammarTarget:"possessives",sentenceStarter:"Das",answerType:"poss",blankPosition:"mid"},
{id:"f31",s:"Wo ___ du gestern?",o:["warst","bist","war","wart"],c:0,why:"gestern ماضٍ: warst.",lvl:"A1",pos:"after-question",typ:"verb",ctx:"daily",start:"Wo",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"wh_frame",subjectType:"wh-word",grammarTarget:"conjugation",sentenceStarter:"Wo",answerType:"verb",blankPosition:"after-question"},
{id:"f32",s:"Er trinkt ___ Kaffee.",o:["einen","ein","eine","einem"],c:0,why:"مذكر مفعول → einen.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"food",start:"Er",w:"Kaffee",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Er",answerType:"article",blankPosition:"before-noun"},
{id:"f33",s:"Die Kinder ___ laut.",o:["sind","seid","ist","bin"],c:0,why:"الجمع يأخذ sind.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Die",w:undefined,chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Die",answerType:"verb",blankPosition:"after-subj"},
{id:"f34",s:"___ kommt aus Ägypten?",o:["Wer","Was","Wo","Wie"],c:0,why:"السؤال عن العاقل = Wer.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Wer",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wer",answerType:"question",blankPosition:"start"},
{id:"f35",s:"Sie ___ jeden Tag.",o:["arbeitet","arbeiten","arbeitest","arbeite"],c:0,why:"Sie الرسمية تأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"work",start:"Sie",w:"arbeiten",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Sie",answerType:"verb",blankPosition:"after-subj"},
{id:"f36",s:"Habt ihr ___ Zeit?",o:["keine","kein","nicht","keiner"],c:0,why:"Zeit مؤنثة → keine.",lvl:"A1",pos:"start",typ:"negation",ctx:"daily",start:"Habt",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"verb-first",grammarTarget:"kein/nicht",sentenceStarter:"Habt",answerType:"negation",blankPosition:"start"},
{id:"f37",s:"Er ___ einen Hund.",o:["hat","habe","hast","haben"],c:0,why:"er تأخذ hat.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"home",start:"Er",w:"Hund",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Er",answerType:"verb",blankPosition:"after-subj"},
{id:"f38",s:"Gestern ___ ich Fußball gespielt.",o:["habe","hast","hat","haben"],c:0,why:"الماضي مع haben.",lvl:"A2",pos:"after-time",typ:"aux",ctx:"sport",start:"Gestern",w:"Fußball",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"noun-phrase",grammarTarget:"perfect/future",sentenceStarter:"Gestern",answerType:"aux",blankPosition:"after-time"},
{id:"f39",s:"Morgen ___ ich nach Kairo fahren.",o:["werde","wirst","wird","werden"],c:0,why:"المستقبل مع werden.",lvl:"A2",pos:"after-time",typ:"aux",ctx:"travel",start:"Morgen",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"perfect/future",sentenceStarter:"Morgen",answerType:"aux",blankPosition:"after-time"},
{id:"f40",s:"Ich habe gestern einen Film ___.",o:["gesehen","sehen","sieht","gesehene"],c:0,why:"التصريف الثالث آخر الجملة.",lvl:"A2",pos:"end",typ:"participle",ctx:"home",start:"Ich",w:"Film",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"pronoun",grammarTarget:"partizip",sentenceStarter:"Ich",answerType:"participle",blankPosition:"end"},
{id:"f41",s:"Wir sind nach Berlin ___.",o:["gefahren","fahren","fährt","fahrst"],c:0,why:"fahren تأخذ sein.",lvl:"A2",pos:"end",typ:"participle",ctx:"travel",start:"Wir",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"pronoun",grammarTarget:"partizip",sentenceStarter:"Wir",answerType:"participle",blankPosition:"end"},
{id:"f42",s:"Hast du die Hausaufgaben ___?",o:["gemacht","machen","macht","machst"],c:0,why:"التصريف الثالث.",lvl:"A2",pos:"end",typ:"participle",ctx:"school",start:"Hast",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"verb-first",grammarTarget:"partizip",sentenceStarter:"Hast",answerType:"participle",blankPosition:"end"},
{id:"f43",s:"Ich muss heute früh ___.",o:["aufstehen","aufstehe","stehe auf","aufsteht"],c:0,why:"المنفصل آخر الجملة بالمصدر.",lvl:"A2",pos:"end",typ:"separable",ctx:"daily",start:"Ich",w:"aufstehen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"pronoun",grammarTarget:"trennbare",sentenceStarter:"Ich",answerType:"separable",blankPosition:"end"},
{id:"f44",s:"Ruf mich bitte ___!",o:["an","auf","aus","zu"],c:0,why:"anrufen = يتصل.",lvl:"A2",pos:"end",typ:"separable",ctx:"daily",start:"Ruf",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"verb-first",grammarTarget:"trennbare",sentenceStarter:"Ruf",answerType:"separable",blankPosition:"end"},
{id:"f45",s:"Ich helfe ___ Bruder.",o:["meinem","meinen","mein","meine"],c:0,why:"helfen + Dativ.",lvl:"A2",pos:"before-noun",typ:"dativ",ctx:"family",start:"Ich",w:"Bruder",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"dativ",sentenceStarter:"Ich",answerType:"dativ",blankPosition:"before-noun"},
{id:"f46",s:"Das Geschenk ist ___ dich.",o:["für","von","mit","zu"],c:0,why:"für + Akkusativ.",lvl:"A2",pos:"mid",typ:"prep",ctx:"friends",start:"Das",w:undefined,chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"prepositions",sentenceStarter:"Das",answerType:"prep",blankPosition:"mid"},
{id:"f47",s:"___ regnet es heute.",o:["Es","Er","Sie","Das"],c:0,why:"الطقس = es.",lvl:"A2",pos:"start",typ:"pronoun",ctx:"weather",start:"Es",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"noun-phrase",grammarTarget:"pronouns",sentenceStarter:"Es",answerType:"pronoun",blankPosition:"start"},
{id:"f48",s:"Ich freue ___ auf den Urlaub.",o:["mich","dich","mir","michs"],c:0,why:"sich freuen auf + Akk.",lvl:"A2",pos:"mid",typ:"reflexive",ctx:"travel",start:"Ich",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"reflexivverben",sentenceStarter:"Ich",answerType:"reflexive",blankPosition:"mid"},
{id:"f49",s:"___ ihr schon gegessen?",o:["Habt","Haben","Hat","Hast"],c:0,why:"ihr تأخذ habt.",lvl:"A2",pos:"start",typ:"aux",ctx:"food",start:"Habt",w:undefined,chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"noun-phrase",grammarTarget:"perfect/future",sentenceStarter:"Habt",answerType:"aux",blankPosition:"start"},
{id:"f50",s:"Die Tasche ___ meiner Schwester.",o:["gehört","gehören","gehöre","gehörst"],c:0,why:"المفرد يأخذ t.",lvl:"A2",pos:"after-subj",typ:"verb",ctx:"family",start:"Die",w:"Tasche",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Die",answerType:"verb",blankPosition:"after-subj"},
{id:"f51",s:"Wir treffen ___ am Bahnhof.",o:["uns","euch","sich","unsere"],c:0,why:"treffen + uns للجمع.",lvl:"A2",pos:"mid",typ:"reflexive",ctx:"travel",start:"Wir",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"reflexivverben",sentenceStarter:"Wir",answerType:"reflexive",blankPosition:"mid"},
{id:"f52",s:"Kannst du mir ___?",o:["helfen","helfe","hilfst","hilft"],c:0,why:"بعد المساعد مصدر.",lvl:"A2",pos:"end",typ:"verb",ctx:"friends",start:"Kannst",w:undefined,chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"verb-first",grammarTarget:"conjugation",sentenceStarter:"Kannst",answerType:"verb",blankPosition:"end"},
{id:"f53",s:"Er interessiert ___ für Autos.",o:["sich","dich","mich","sie"],c:0,why:"sich interessieren für.",lvl:"A2",pos:"mid",typ:"reflexive",ctx:"general",start:"Er",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"reflexivverben",sentenceStarter:"Er",answerType:"reflexive",blankPosition:"mid"},
{id:"f54",s:"Der Zug fährt ___ 10 Uhr ab.",o:["um","am","im","von"],c:0,why:"um للساعة.",lvl:"A2",pos:"mid",typ:"prep",ctx:"travel",start:"Der",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"prepositions",sentenceStarter:"Der",answerType:"prep",blankPosition:"mid"},
{id:"f55",s:"Unsere Eltern ___ in Alexandria.",o:["wohnen","wohnt","wohne","wohnst"],c:0,why:"الجمع يأخذ المصدر.",lvl:"A2",pos:"after-subj",typ:"verb",ctx:"family",start:"Unsere",w:"wohnen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Unsere",answerType:"verb",blankPosition:"after-subj"},
{id:"f56",s:"Ich bleibe zu Hause, ___ ich krank bin.",o:["weil","denn","aber","und"],c:0,why:"weil + فعل آخر الجملة.",lvl:"B1",pos:"mid",typ:"conjunction",ctx:"home",start:"Ich",w:undefined,chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"nebensatz",sentenceStarter:"Ich",answerType:"conjunction",blankPosition:"mid"},
{id:"f57",s:"___ ich müde bin, lerne ich weiter.",o:["Obwohl","Aber","Weil","Denn"],c:0,why:"obwohl = مع أن.",lvl:"B1",pos:"start",typ:"conjunction",ctx:"study",start:"Obwohl",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"adverbial",grammarTarget:"nebensatz",sentenceStarter:"Obwohl",answerType:"conjunction",blankPosition:"start"},
{id:"f58",s:"Ich denke, ___ du recht hast.",o:["dass","was","wer","wie"],c:0,why:"dass للاعتقاد.",lvl:"B1",pos:"mid",typ:"conjunction",ctx:"general",start:"Ich",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"nebensatz",sentenceStarter:"Ich",answerType:"conjunction",blankPosition:"mid"},
{id:"f59",s:"Wenn es ___, bleiben wir zu Hause.",o:["regnet","regnen","regne","regnst"],c:0,why:"es regnet.",lvl:"B1",pos:"mid",typ:"verb",ctx:"weather",start:"Wenn",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Wenn",answerType:"verb",blankPosition:"mid"},
{id:"f60",s:"Das Buch, ___ ich lese, ist spannend.",o:["das","was","der","die"],c:0,why:"ضمير الوصل = das.",lvl:"B1",pos:"mid",typ:"relative",ctx:"general",start:"Das",w:"Buch",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"relativsatz",sentenceStarter:"Das",answerType:"relative",blankPosition:"mid"},
{id:"f61",s:"Er fragt, ___ der Zug kommt.",o:["wann","was","wer","wo"],c:0,why:"السؤال عن الوقت = wann.",lvl:"B1",pos:"mid",typ:"question",ctx:"travel",start:"Er",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"w-fragen",sentenceStarter:"Er",answerType:"question",blankPosition:"mid"},
{id:"f62",s:"Trotz ___ Wetters bleiben wir zu Hause.",o:["des","dem","der","den"],c:0,why:"trotz + Genitiv.",lvl:"B1",pos:"mid",typ:"genitive",ctx:"weather",start:"Trotz",w:undefined,chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"adverbial",grammarTarget:"genitiv",sentenceStarter:"Trotz",answerType:"genitive",blankPosition:"mid"},
{id:"f63",s:"Je mehr ich lerne, ___ besser spreche ich.",o:["desto","als","wie","wenn"],c:0,why:"je...desto للمقارنة.",lvl:"B1",pos:"mid",typ:"conjunction",ctx:"study",start:"Je",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"adverbial",grammarTarget:"nebensatz",sentenceStarter:"Je",answerType:"conjunction",blankPosition:"mid"},
{id:"f64",s:"Ich weiß nicht, ___ ich machen soll.",o:["was","wer","wo","dass"],c:0,why:"was + soll.",lvl:"B1",pos:"mid",typ:"question",ctx:"general",start:"Ich",w:undefined,chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"w-fragen",sentenceStarter:"Ich",answerType:"question",blankPosition:"mid"},
{id:"f65",s:"Er arbeitet, ___ Geld zu verdienen.",o:["um","zu","für","damit"],c:0,why:"um...zu للغرض.",lvl:"B1",pos:"mid",typ:"umzu",ctx:"work",start:"Er",w:undefined,chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"um-zu",sentenceStarter:"Er",answerType:"umzu",blankPosition:"mid"},
{id:"f66",s:"Jeden Abend ___ ich Deutsch.",o:["lerne","lernst","lernt","lernen"],c:0,why:"الفعل ثانيًا ثم الفاعل.",lvl:"A2",pos:"after-time",typ:"verb",ctx:"study",start:"Jeden",w:"lernen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Jeden",answerType:"verb",blankPosition:"after-time"},
{id:"f67",s:"___ besucht meinen Bruder?",o:["Wer","Wen","Was","Wo"],c:0,why:"السؤال عن الفاعل = Wer.",lvl:"A2",pos:"start",typ:"question",ctx:"family",start:"Wer",w:undefined,chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wer",answerType:"question",blankPosition:"start"},
{id:"f68",s:"Oma ___ gern Kuchen.",o:["backt","backe","backst","backen"],c:0,why:"Oma مفرد → backt.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"family",start:"Oma",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Oma",answerType:"verb",blankPosition:"after-subj"},
{id:"f69",s:"Die Eltern ___ gern Musik.",o:["hören","hört","höre","hörst"],c:0,why:"الجمع يأخذ المصدر.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"family",start:"Die",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Die",answerType:"verb",blankPosition:"after-subj"},
{id:"f70",s:"___ besucht uns Oma?",o:["Wann","Wer","Was","Wo"],c:0,why:"السؤال عن الوقت = Wann.",lvl:"A1",pos:"start",typ:"question",ctx:"family",start:"Wann",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wann",answerType:"question",blankPosition:"start"},
{id:"f71",s:"Wir helfen ___ Großeltern.",o:["unseren","unser","unsere","unserem"],c:0,why:"helfen + Dativ جمع → unseren.",lvl:"A2",pos:"before-noun",typ:"dativ",ctx:"family",start:"Wir",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"pronoun",grammarTarget:"dativ",sentenceStarter:"Wir",answerType:"dativ",blankPosition:"before-noun"},
{id:"f72",s:"Das Baby ___.",o:["schläft","schlafe","schläfst","schlafen"],c:0,why:"المفرد يأخذ t.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"family",start:"Das",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Das",answerType:"verb",blankPosition:"after-subj"},
{id:"f73",s:"Oma wohnt ___ München.",o:["in","nach","aus","bei"],c:0,why:"السكن = in.",lvl:"A1",pos:"mid",typ:"prep",ctx:"family",start:"Oma",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"prepositions",sentenceStarter:"Oma",answerType:"prep",blankPosition:"mid"},
{id:"f74",s:"Oma backt einen ___ Kuchen.",o:["großen","großer","große","großem"],c:0,why:"مذكر مفعول → großen.",lvl:"A2",pos:"before-noun",typ:"adjective",ctx:"family",start:"Oma",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"adjectives",sentenceStarter:"Oma",answerType:"adjective",blankPosition:"before-noun"},
{id:"f75",s:"Wir essen ___ Restaurant.",o:["im","in","am","zu"],c:0,why:"essen in + Dativ = im.",lvl:"A2",pos:"mid",typ:"prep",ctx:"food",start:"Wir",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"pronoun",grammarTarget:"prepositions",sentenceStarter:"Wir",answerType:"prep",blankPosition:"mid"},
{id:"f76",s:"Der Kuchen schmeckt ___.",o:["süß","süße","süßen","süßes"],c:0,why:"الصفة بعد الفعل بدون نهاية.",lvl:"A1",pos:"end",typ:"adjective",ctx:"food",start:"Der",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"predicate_close",subjectType:"noun-phrase",grammarTarget:"adjectives",sentenceStarter:"Der",answerType:"adjective",blankPosition:"end"},
{id:"f77",s:"Ich bestelle ___ Pizza.",o:["eine","ein","einen","einem"],c:0,why:"مؤنثة مفعول → eine.",lvl:"A1",pos:"after-verb",typ:"article",ctx:"food",start:"Ich",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"verb_frame",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Ich",answerType:"article",blankPosition:"after-verb"},
{id:"f78",s:"Isst du ___ Fleisch?",o:["kein","keine","nicht","keinen"],c:0,why:"Fleisch محايد → kein.",lvl:"A1",pos:"mid",typ:"negation",ctx:"food",start:"Isst",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"verb-first",grammarTarget:"kein/nicht",sentenceStarter:"Isst",answerType:"negation",blankPosition:"mid"},
{id:"f79",s:"___ schmeckt der Kuchen?",o:["Wie","Was","Wer","Wo"],c:0,why:"السؤال عن الكيفية = Wie.",lvl:"A1",pos:"start",typ:"question",ctx:"food",start:"Wie",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wie",answerType:"question",blankPosition:"start"},
{id:"f80",s:"Morgen ___ wir ins Restaurant.",o:["gehen","geht","gehe","gehst"],c:0,why:"wir تأخذ المصدر.",lvl:"A1",pos:"after-time",typ:"verb",ctx:"food",start:"Morgen",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"time_opener",subjectType:"adverbial",grammarTarget:"conjugation",sentenceStarter:"Morgen",answerType:"verb",blankPosition:"after-time"},
{id:"f81",s:"___ geht es dir?",o:["Wie","Was","Wer","Wo"],c:0,why:"السؤال عن الحال = Wie.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Wie",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Wie",answerType:"question",blankPosition:"start"},
{id:"f82",s:"Ich ___ Ali.",o:["heiße","heißt","heißen","heisst"],c:0,why:"ich تأخذ heiße (ß واحدة).",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"daily",start:"Ich",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Ich",answerType:"verb",blankPosition:"after-subj"},
{id:"f83",s:"Guten ___, Herr Schmidt!",o:["Morgen","Morgens","Morgenes","Morgenst"],c:0,why:"التحية الثابتة: Guten Morgen.",lvl:"A1",pos:"mid",typ:"vocab",ctx:"daily",start:"Guten",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"vocabulary",sentenceStarter:"Guten",answerType:"vocab",blankPosition:"mid"},
{id:"f84",s:"Das ___ ein Buch.",o:["ist","sind","bist","seid"],c:0,why:"المفرد يأخذ ist.",lvl:"A1",pos:"mid",typ:"verb",ctx:"general",start:"Das",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"midfield",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Das",answerType:"verb",blankPosition:"mid"},
{id:"f85",s:"___ lernst du?",o:["Was","Wie","Wer","Wo"],c:0,why:"السؤال عن الشيء = Was.",lvl:"A1",pos:"start",typ:"question",ctx:"study",start:"Was",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"fronted_opener",subjectType:"wh-word",grammarTarget:"w-fragen",sentenceStarter:"Was",answerType:"question",blankPosition:"start"},
{id:"f86",s:"Das ist ___ Buch.",o:["kein","keine","nicht","ein"],c:0,why:"نفي النكرة المحايدة.",lvl:"A1",pos:"before-noun",typ:"negation",ctx:"general",start:"Das",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"ctx-reviewed",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"kein/nicht",sentenceStarter:"Das",answerType:"negation",blankPosition:"before-noun"},{id:"f87",s:"___ heiße Ali.",o:["Ich","Du","Er","Wir"],c:0,why:"المتكلم عن نفسه: Ich.",lvl:"A1",pos:"start",typ:"pronoun",ctx:"intro",start:"Ich",w:"heißen",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"pronouns",sentenceStarter:"Ich",answerType:"pronoun",blankPosition:"start"},
{id:"f88",kind:"order",q:"رتّب التحية الرسمية:",words:["Guten","Morgen","Herr","Ali"],s:"Guten Morgen Herr Ali.",o:[],c:0,why:"التحية الرسمية: Guten Morgen + الاسم.",lvl:"A1",pos:"start",typ:"greeting",ctx:"intro",start:"Guten",w:"Morgen",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"greeting",subjectType:"none",grammarTarget:"greetings",sentenceStarter:"Guten",answerType:"order",blankPosition:"none"},
{id:"f89",kind:"qa",q:"Wie heißt du?",disp:"صديق يسألك عن اسمك. اختر الرد المناسب:",s:"Ich heiße Ali.",o:["Ich heiße Ali.","Ich bin zwanzig.","Tschüs!"],c:0,why:"السؤال عن الاسم → Ich heiße…",lvl:"A1",pos:"start",typ:"question",ctx:"intro",start:"Ich",w:"heißen",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"pronoun",grammarTarget:"questions",sentenceStarter:"Ich",answerType:"response",blankPosition:"none"},
{id:"f90",kind:"correct",q:"اختر الجملة الصحيحة:",s:"Ich bin Ali.",o:["Ich bin Ali.","Ich bist Ali.","Ich ist Ali."],c:0,why:"sein مع ich → bin.",lvl:"A1",pos:"start",typ:"verb",ctx:"intro",start:"Ich",w:"sein",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Ich",answerType:"verb",blankPosition:"none"},
{id:"f91",kind:"error",q:"❌ Ich bist Ali. اختر التصحيح:",s:"Ich bin Ali.",o:["Ich bin Ali.","Ich bist Ali.","Ich Ali bin."],c:0,why:"ich تأخذ bin وليس bist.",lvl:"A1",pos:"start",typ:"verb",ctx:"intro",start:"Ich",w:"sein",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Ich",answerType:"verb",blankPosition:"none"},
{id:"f92",kind:"transform",q:"حوّل إلى سؤال:",disp:"Du lernst Deutsch.",s:"Lernst du Deutsch?",o:["Lernst du Deutsch?","Du lernst Deutsch?","Lernen du Deutsch?"],c:0,why:"السؤال يبدأ بالفعل المُصرّف.",lvl:"A1",pos:"start",typ:"question",ctx:"intro",start:"Lernst",w:"lernen",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"question",subjectType:"pronoun",grammarTarget:"questions",sentenceStarter:"Lernst",answerType:"transform",blankPosition:"none"},
{id:"f93",kind:"sit",q:"🏪 Du bist im Supermarkt. تريد أن تسأل عن السعر.",s:"Was kostet das?",o:["Was kostet das?","Wo wohnst du?","Wie heißt du?"],c:0,why:"السؤال عن السعر: Was kostet das؟",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Was",w:"kosten",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"none",grammarTarget:"questions",sentenceStarter:"Was",answerType:"response",blankPosition:"none"},
{id:"f94",s:"Das ist ___ Frau.",o:["eine","ein","einer","einen"],c:0,why:"مؤنثة نكرة: eine.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"intro",start:"Das",w:"Frau",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"articles",sentenceStarter:"Das",answerType:"article",blankPosition:"before-noun"},
{id:"f95",s:"Du ___ Deutsch.",o:["sprichst","spreche","sprecht","sprechen"],c:0,why:"sprechen مع du → sprichst (شاذ).",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"study",start:"Du",w:"sprechen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Du",answerType:"verb",blankPosition:"after-subj"},
{id:"f96",kind:"order",q:"رتّب الجملة:",words:["Ich","komme","aus","Ägypten"],s:"Ich komme aus Ägypten.",o:[],c:0,why:"الفاعل + الفعل ثانيًا + aus للموطن.",lvl:"A1",pos:"start",typ:"prep",ctx:"intro",start:"Ich",w:"kommen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"wordorder",sentenceStarter:"Ich",answerType:"order",blankPosition:"none"},
{id:"f97",kind:"qa",q:"Woher kommst du?",disp:"اختر الرد المناسب:",s:"Ich komme aus Ägypten.",o:["Ich komme aus Ägypten.","Ich heiße Ali.","Mir geht es gut."],c:0,why:"السؤال عن الموطن → aus + البلد.",lvl:"A1",pos:"start",typ:"question",ctx:"intro",start:"Ich",w:"kommen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"pronoun",grammarTarget:"questions",sentenceStarter:"Ich",answerType:"response",blankPosition:"none"},
{id:"f98",kind:"correct",q:"اختر الجملة الصحيحة:",s:"Er kommt morgen.",o:["Er kommt morgen.","Er kommen morgen.","Er kommens morgen."],c:0,why:"er + جذر + t: kommt.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Er",w:"kommen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Er",answerType:"verb",blankPosition:"none"},
{id:"f99",kind:"error",q:"❌ Er kommen morgen. اختر التصحيح:",s:"Er kommt morgen.",o:["Er kommt morgen.","Er kommen morgen.","Er kommst morgen."],c:0,why:"مع er نضيف t فقط: kommt.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Er",w:"kommen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Er",answerType:"verb",blankPosition:"none"},
{id:"f100",kind:"transform",q:"انفِ الجملة:",disp:"Ich habe ein Auto.",s:"Ich habe kein Auto.",o:["Ich habe kein Auto.","Ich habe nicht Auto.","Ich kein habe Auto."],c:0,why:"نفي النكرة بـ kein.",lvl:"A1",pos:"start",typ:"negation",ctx:"daily",start:"Ich",w:"haben",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"negation",subjectType:"pronoun",grammarTarget:"negation",sentenceStarter:"Ich",answerType:"transform",blankPosition:"none"},
{id:"f101",kind:"sit",q:"🙋 تقابل صديقًا صباحًا. ماذا تقول؟",s:"Guten Morgen!",o:["Guten Morgen!","Gute Nacht!","Auf Wiedersehen!"],c:0,why:"تحية الصباح: Guten Morgen.",lvl:"A1",pos:"start",typ:"greeting",ctx:"daily",start:"Guten",w:"Morgen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"greeting",subjectType:"none",grammarTarget:"greetings",sentenceStarter:"Guten",answerType:"response",blankPosition:"none"},
{id:"f102",s:"___ geht es dir?",o:["Wie","Wo","Wer","Wann"],c:0,why:"السؤال عن الحال بـ Wie.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Wie",w:"gehen",chapterId:"K1",chapterName:"Kapitel 1 – Guten Tag",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"question",subjectType:"none",grammarTarget:"questions",sentenceStarter:"Wie",answerType:"question",blankPosition:"start"},
{id:"f103",s:"Wir ___ in Berlin.",o:["wohnen","wohnt","wohnst","wohne"],c:0,why:"wir تأخذ المصدر: wohnen.",lvl:"A1",pos:"after-subj",typ:"verb",ctx:"daily",start:"Wir",w:"wohnen",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Wir",answerType:"verb",blankPosition:"after-subj"},
{id:"f104",kind:"order",q:"رتّب الجملة:",words:["Am","Montag","lerne","ich"],s:"Am Montag lerne ich.",o:[],c:0,why:"حتى مع بداية الزمن، الفعل ثانيًا.",lvl:"A1",pos:"start",typ:"adverb",ctx:"study",start:"Am",w:"lernen",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"wordorder",sentenceStarter:"Am",answerType:"order",blankPosition:"none"},
{id:"f105",kind:"qa",q:"Was machst du am Freitag?",disp:"اختر الرد المناسب:",s:"Ich besuche Freunde.",o:["Ich besuche Freunde.","Ich bin Ali.","Guten Tag."],c:0,why:"السؤال عن النشاط → فعل + مفعول.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Ich",w:"besuchen",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"pronoun",grammarTarget:"questions",sentenceStarter:"Ich",answerType:"response",blankPosition:"none"},
{id:"f106",kind:"correct",q:"اختر الجملة الصحيحة:",s:"Die Kinder spielen.",o:["Die Kinder spielen.","Die Kinder spielt.","Die Kind spielen."],c:0,why:"الجمع يأخذ المصدر: spielen.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Die",w:"spielen",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Die",answerType:"verb",blankPosition:"none"},
{id:"f107",kind:"error",q:"❌ Wir wohnt in Berlin. اختر التصحيح:",s:"Wir wohnen in Berlin.",o:["Wir wohnen in Berlin.","Wir wohnt in Berlin.","Wir wohne in Berlin."],c:0,why:"wir تأخذ المصدر بدون إضافات.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Wir",w:"wohnen",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Wir",answerType:"verb",blankPosition:"none"},
{id:"f108",kind:"transform",q:"حوّل الضمير إلى الجمع (Wir):",disp:"Ich lerne Deutsch.",s:"Wir lernen Deutsch.",o:["Wir lernen Deutsch.","Wir lernt Deutsch.","Wir lerne Deutsch."],c:0,why:"تحويل ich→wir يعيد الفعل للمصدر.",lvl:"A1",pos:"start",typ:"verb",ctx:"study",start:"Wir",w:"lernen",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Wir",answerType:"transform",blankPosition:"none"},
{id:"f109",kind:"order",q:"رتّب هذا الحوار القصير:",words:["Hallo!","Hallo! Wie geht es dir?","Gut, danke!"],s:"Hallo! Hallo! Wie geht es dir? Gut, danke!",o:[],c:0,why:"تحية → سؤال → رد.",lvl:"A1",pos:"start",typ:"dialogue",ctx:"daily",start:"Hallo",w:"gehen",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"dialogue",subjectType:"none",grammarTarget:"conversation",sentenceStarter:"Hallo",answerType:"order",blankPosition:"none"},
{id:"f110",s:"Ich komme ___ Spanien.",o:["aus","in","nach","bei"],c:0,why:"الموطن والأصل مع aus.",lvl:"A1",pos:"after-subj",typ:"prep",ctx:"daily",start:"Ich",w:"kommen",chapterId:"K2",chapterName:"Kapitel 2 – Freunde und Kollegen",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"prepositions",sentenceStarter:"Ich",answerType:"prep",blankPosition:"after-subj"},
{id:"f111",s:"Ich sehe ___ Mann.",o:["den","der","dem","die"],c:0,why:"مذكر مفعول → den.",lvl:"A1",pos:"before-noun",typ:"article",ctx:"daily",start:"Ich",w:"Mann",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"akkusativ",sentenceStarter:"Ich",answerType:"article",blankPosition:"before-noun"},
{id:"f112",kind:"order",q:"رتّب الجملة:",words:["Ich","esse","einen","Apfel"],s:"Ich esse einen Apfel.",o:[],c:0,why:"المفعول المذكر: einen Apfel.",lvl:"A1",pos:"start",typ:"article",ctx:"daily",start:"Ich",w:"essen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Ich",answerType:"order",blankPosition:"none"},
{id:"f113",kind:"qa",q:"Wen siehst du?",disp:"اختر الرد المناسب:",s:"Ich sehe meinen Freund.",o:["Ich sehe meinen Freund.","Ich heiße Ali.","Mir geht es gut."],c:0,why:"السؤال عن عاقل مفعول → جملة بها مفعول.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Ich",w:"sehen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"pronoun",grammarTarget:"questions",sentenceStarter:"Ich",answerType:"response",blankPosition:"none"},
{id:"f114",kind:"correct",q:"اختر الجملة الصحيحة:",s:"Sie kauft eine Lampe.",o:["Sie kauft eine Lampe.","Sie kauft einen Lampe.","Sie kaufen eine Lampe."],c:0,why:"Lampe مؤنثة تبقى eine، والفعل kauft.",lvl:"A1",pos:"start",typ:"article",ctx:"daily",start:"Sie",w:"kaufen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"akkusativ",sentenceStarter:"Sie",answerType:"article",blankPosition:"none"},
{id:"f115",kind:"error",q:"❌ Ich sehe der Mann. اختر التصحيح:",s:"Ich sehe den Mann.",o:["Ich sehe den Mann.","Ich sehe der Mann.","Ich sehe dem Mann."],c:0,why:"مفعول مذكر: der → den.",lvl:"A1",pos:"start",typ:"article",ctx:"daily",start:"Ich",w:"Mann",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"akkusativ",sentenceStarter:"Ich",answerType:"article",blankPosition:"none"},
{id:"f116",kind:"transform",q:"اجعلها نكرة:",disp:"Das ist der Hafen.",s:"Das ist ein Hafen.",o:["Das ist ein Hafen.","Das ist der Hafen?","Das ist einen Hafen."],c:0,why:"النكرة للمذكر: ein.",lvl:"A1",pos:"start",typ:"article",ctx:"daily",start:"Das",w:"Hafen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"articles",sentenceStarter:"Das",answerType:"transform",blankPosition:"none"},
{id:"f117",kind:"sit",q:"🍽️ في المطعم. تريد الحساب.",s:"Zahlen, bitte.",o:["Zahlen, bitte.","Guten Morgen!","Wie heißt du?"],c:0,why:"طلب الحساب: Zahlen, bitte.",lvl:"A1",pos:"start",typ:"phrase",ctx:"daily",start:"Zahlen",w:"zahlen",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"none",grammarTarget:"phrases",sentenceStarter:"Zahlen",answerType:"response",blankPosition:"none"},
{id:"f118",s:"___ Sommer ist es heiß.",o:["Im","Am","Um","An"],c:0,why:"الفصول مع im.",lvl:"A1",pos:"start",typ:"prep",ctx:"daily",start:"Im",w:"Sommer",chapterId:"K3",chapterName:"Kapitel 3 – In Hamburg",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"pp",subjectType:"none",grammarTarget:"prepositions",sentenceStarter:"Im",answerType:"prep",blankPosition:"start"},
{id:"f119",s:"Ich ___ einen Kaffee.",o:["möchte","möchten","möchtest","möchtet"],c:0,why:"ich + möchte (مهذب).",lvl:"A1",pos:"after-subj",typ:"modal",ctx:"daily",start:"Ich",w:"mögen",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"modals",sentenceStarter:"Ich",answerType:"verb",blankPosition:"after-subj"},
{id:"f120",kind:"order",q:"رتّب الجملة:",words:["Ich","trinke","gern","Tee"],s:"Ich trinke gern Tee.",o:[],c:0,why:"gern بعد الفعل المُصرّف.",lvl:"A1",pos:"start",typ:"adverb",ctx:"daily",start:"Ich",w:"trinken",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"wordorder",sentenceStarter:"Ich",answerType:"order",blankPosition:"none"},
{id:"f121",kind:"qa",q:"Was kostet das Brot?",disp:"اختر الرد المناسب:",s:"Zwei Euro.",o:["Zwei Euro.","Ich heiße Ali.","Guten Tag."],c:0,why:"السؤال عن السعر → السعر.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Zwei",w:"kosten",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"none",grammarTarget:"questions",sentenceStarter:"Zwei",answerType:"response",blankPosition:"none"},
{id:"f122",kind:"correct",q:"اختر الجملة الصحيحة:",s:"Er isst einen Apfel.",o:["Er isst einen Apfel.","Er esst einen Apfel.","Er essen einen Apfel."],c:0,why:"essen شاذة: er isst.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Er",w:"essen",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Er",answerType:"verb",blankPosition:"none"},
{id:"f123",kind:"error",q:"❌ Du möchtet Tee. اختر التصحيح:",s:"Du möchtest Tee.",o:["Du möchtest Tee.","Du möchtet Tee.","Du möchten Tee."],c:0,why:"du + möchtest (st).",lvl:"A1",pos:"start",typ:"modal",ctx:"daily",start:"Du",w:"mögen",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"modals",sentenceStarter:"Du",answerType:"verb",blankPosition:"none"},
{id:"f124",kind:"transform",q:"انفِ الجملة:",disp:"Ich habe Hunger.",s:"Ich habe keinen Hunger.",o:["Ich habe keinen Hunger.","Ich habe kein Hunger.","Ich habe nicht Hunger."],c:0,why:"Hunger مذكر مفعول منفي: keinen.",lvl:"A1",pos:"start",typ:"negation",ctx:"daily",start:"Ich",w:"haben",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"negation",subjectType:"pronoun",grammarTarget:"negation",sentenceStarter:"Ich",answerType:"transform",blankPosition:"none"},
{id:"f125",kind:"sit",q:"🎉 عيد ميلاد صديقك. ماذا تقول؟",s:"Alles Gute!",o:["Alles Gute!","Gute Nacht!","Bis bald!"],c:0,why:"التهنئة: Alles Gute.",lvl:"A1",pos:"start",typ:"phrase",ctx:"daily",start:"Alles",w:"gut",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"greeting",subjectType:"none",grammarTarget:"phrases",sentenceStarter:"Alles",answerType:"response",blankPosition:"none"},
{id:"f126",s:"___ isst du gern?",o:["Was","Wer","Wo","Wann"],c:0,why:"السؤال عن الشيء بـ Was.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Was",w:"essen",chapterId:"K4",chapterName:"Kapitel 4 – Guten Appetit",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"question",subjectType:"none",grammarTarget:"questions",sentenceStarter:"Was",answerType:"question",blankPosition:"start"},
{id:"f127",s:"Ich komme ___ dir.",o:["mit","für","durch","gegen"],c:0,why:"mit تأخذ Dativ: mit dir.",lvl:"A1",pos:"after-subj",typ:"prep",ctx:"daily",start:"Ich",w:"kommen",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"dativ",sentenceStarter:"Ich",answerType:"prep",blankPosition:"after-subj"},
{id:"f128",kind:"order",q:"رتّب الجملة:",words:["Ich","muss","morgen","arbeiten"],s:"Ich muss morgen arbeiten.",o:[],c:0,why:"المساعد ثانيًا + المصدر آخرًا.",lvl:"A1",pos:"start",typ:"modal",ctx:"daily",start:"Ich",w:"müssen",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"modals",sentenceStarter:"Ich",answerType:"order",blankPosition:"none"},
{id:"f129",kind:"qa",q:"Wann stehst du auf?",disp:"اختر الرد المناسب:",s:"Um sechs Uhr.",o:["Um sechs Uhr.","Ich heiße Ali.","Guten Tag."],c:0,why:"السؤال عن الوقت → الوقت.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Um",w:"aufstehen",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"none",grammarTarget:"questions",sentenceStarter:"Um",answerType:"response",blankPosition:"none"},
{id:"f130",kind:"correct",q:"اختر الجملة الصحيحة:",s:"Meine Mutter kocht gut.",o:["Meine Mutter kocht gut.","Meine Mutter kochen gut.","Mein Mutter kocht gut."],c:0,why:"مؤنثة مفردة: Meine + kocht.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Meine",w:"kochen",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"noun-phrase",grammarTarget:"conjugation",sentenceStarter:"Meine",answerType:"verb",blankPosition:"none"},
{id:"f131",kind:"error",q:"❌ Er kann schwimmt. اختر التصحيح:",s:"Er kann schwimmen.",o:["Er kann schwimmen.","Er kann schwimmt.","Er kann schwammen."],c:0,why:"بعد المساعد يأتي المصدر: schwimmen.",lvl:"A1",pos:"start",typ:"modal",ctx:"daily",start:"Er",w:"können",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"modals",sentenceStarter:"Er",answerType:"verb",blankPosition:"none"},
{id:"f132",kind:"transform",q:"حوّل الضمير إلى الجمع (Wir):",disp:"Ich wohne in Kairo.",s:"Wir wohnen in Kairo.",o:["Wir wohnen in Kairo.","Wir wohnt in Kairo.","Wir wohne in Kairo."],c:0,why:"تحويل ich→wir يعيد الفعل للمصدر.",lvl:"A1",pos:"start",typ:"verb",ctx:"daily",start:"Wir",w:"wohnen",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Wir",answerType:"transform",blankPosition:"none"},
{id:"f133",kind:"order",q:"رتّب هذا الحوار القصير:",words:["Guten Morgen!","Guten Morgen! Wie geht es dir?","Danke, gut!"],s:"Guten Morgen! Guten Morgen! Wie geht es dir? Danke, gut!",o:[],c:0,why:"تحية → سؤال → رد.",lvl:"A1",pos:"start",typ:"dialogue",ctx:"daily",start:"Guten",w:"gehen",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"dialogue",subjectType:"none",grammarTarget:"conversation",sentenceStarter:"Guten",answerType:"order",blankPosition:"none"},
{id:"f134",s:"___ Vater arbeitet viel.",o:["Mein","Meinen","Meinem","Meine"],c:0,why:"Vater مذكر فاعل: Mein.",lvl:"A1",pos:"before-noun",typ:"poss",ctx:"daily",start:"Mein",w:"Vater",chapterId:"K5",chapterName:"Kapitel 5 – Alltag und Familie",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"np_internal",subjectType:"noun-phrase",grammarTarget:"possessiv",sentenceStarter:"Mein",answerType:"poss",blankPosition:"before-noun"}
,{id:"f135",kind:"order",q:"رتّب التعريف:",words:["Ich","bin","Ali"],s:"Ich bin Ali.",o:[],c:0,why:"Ich + bin للتعريف.",lvl:"A1",pos:"start",typ:"verb",ctx:"intro",start:"Ich",w:"sein",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"svo_core",subjectType:"pronoun",grammarTarget:"conjugation",sentenceStarter:"Ich",answerType:"order",blankPosition:"none"},{id:"f136",kind:"qa",q:"Wie geht es dir?",disp:"صديق يسألك عن حالك وأنت بخير. اختر الرد:",s:"Mir geht es gut.",o:["Mir geht es gut.","Ich heiße Ali.","Guten Morgen."],c:0,why:"الرد عن الحال: Mir geht es gut.",lvl:"A1",pos:"start",typ:"question",ctx:"daily",start:"Mir",w:"gehen",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"qa",subjectType:"pronoun",grammarTarget:"questions",sentenceStarter:"Mir",answerType:"response",blankPosition:"none"},{id:"f137",kind:"correct",q:"اختر تحية الصباح الصحيحة:",s:"Guten Morgen!",o:["Guten Morgen!","Gute Nacht!","Tschüs!"],c:0,why:"صباحًا: Guten Morgen.",lvl:"A1",pos:"start",typ:"greeting",ctx:"daily",start:"Guten",w:"Morgen",chapterId:"K0",chapterName:"Einführung – مقدمة",chapterSrc:"word",lessonId:null,lessonName:"Alle Lektionen",structureType:"greeting",subjectType:"none",grammarTarget:"greetings",sentenceStarter:"Guten",answerType:"response",blankPosition:"none"}];

/* ---------- challenge / me / practice pages ---------- */
function dailySeed(str){let h=0;for(let i=0;i<str.length;i++){h=((h*31)+str.charCodeAt(i))|0;}return h<0?-h:h;}
function renderChallenge(){
  ensurePlay();
  const box=$("chBox");if(!box)return;
  const t=todayStr(),done=S.daily[t];
  let h='<div class="panel glass"><h3>⚡ التحدي اليومي — '+t+'</h3>';
  if(done){h+='<div class="muted">✅ مكتمل اليوم! النتيجة: '+done.score+'/'+done.total+' • ⭐+'+done.xp+'</div>';}
  else{h+='<div class="muted">10 أسئلة مختارة لك اليوم من نقاط ضعفك والمراجعة.</div><div class="row-flex"><button class="btn btn-primary sm" id="chStart">ابدأ التحدي 🚀</button></div>';}
  const days=Object.keys(S.daily).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  if(days.length)h+='<div class="muted">أيام مكتملة مؤخرًا: '+days.slice(-7).join(" • ")+'</div>';
  h+='</div>';
  box.innerHTML=h;
  const st=$("chStart");
  if(st)st.addEventListener("click",()=>{
    const seed=dailySeed(t);
    const weak=weakWords(6);
    let due=[];
    try{due=srsDue().filter(w=>weak.indexOf(w)<0);}catch(e){}
    const fresh=kapWords().filter(w=>getStatus(w.id)==="new"&&weak.indexOf(w)<0);
    const pool=weak.concat(due.filter(w=>weak.indexOf(w)<0)).concat(fresh).slice(0,10);
    const list=pool.length?pool:shuffle(kapWords()).slice(0,10);
    void seed;
    const qs=buildQuestions("mixed",10,list);
    startQuizRun("mixed",qs);
    const _fin=finishQuiz,_orig=finishQuiz;
    finishQuiz=function(){
      _fin();
      finishQuiz=_orig;
      try{
        const last=(S.quizHistory&&S.quizHistory[0])||{score:0,total:10};
        S.daily[t]={score:last.score,total:last.total,xp:last.xp||0};
        save();renderChallenge();toast("🏆 تحدي اليوم مكتمل!","ok");
      }catch(e){}
    };
  });
}
const AV_FACES=["🦊","🐼","🦁","🐸","🐵","🦄","🐝","🦉","🐢","🐙","🤖","👽"];
const AV_TITLES=[[0,"مبتدئ"],[200,"متعلم نشيط"],[500,"نجم صاعد"],[1000,"بطل ألماني"],[2500,"أسطورة الدويتش"]];
function renderMe(){
  ensurePlay();
  const box=$("meBox");if(!box)return;
  const xp=S.xp||0;
  const title=AV_TITLES.filter(x=>xp>=x[0]).pop()[1];
  const known=kapWords().filter(w=>getStatus(w.id)==="known").length;
  let h='<div class="panel glass" style="text-align:center"><div style="font-size:64px">'+S.avatar.face+'</div><h3>'+title+'</h3><div class="muted">⭐ '+(S.xp||0)+' XP • '+coinStr()+' • 🔥 '+(S.streak.count||0)+' يوم</div><div class="muted">كلمات محفوظة: '+known+' / '+kapWords().length+'</div>';
  h+='<h4>اختر صورتك:</h4><div class="row-flex" style="justify-content:center">'+AV_FACES.map(f=>'<button class="icon-btn" data-av="'+f+'" style="'+(S.avatar.face===f?"border-color:var(--cyan);box-shadow:0 0 12px rgba(var(--v2),.5)":"")+'">'+f+'</button>').join("")+'</div>';
  h+='<h4>الألقاب ('+AV_TITLES.filter(x=>xp>=x[0]).length+'/'+AV_TITLES.length+'):</h4><div class="muted">'+AV_TITLES.map(x=>(xp>=x[0]?"✅ ":"🔒 ")+x[1]+" ("+x[0]+" XP)").join(" • ")+'</div>';
  const rw=S.rewards||{themes:[],frames:[],titles:[]};
  h+='<h4>مكافآتي:</h4><div class="muted">ثيمات: '+(rw.themes.length||"—")+' • إطارات: '+(rw.frames.length||"—")+' • ألقاب: '+(rw.titles.length||"—")+'</div></div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-av]").forEach(b=>b.addEventListener("click",()=>{S.avatar.face=b.getAttribute("data-av");save();renderMe();toast("تم تغيير الصورة "+S.avatar.face,"ok");}));
}
function renderPractice(){
  ensurePlay();
  const box=$("practiceBox");if(!box)return;
  const weak=weakWords(8);
  let due=[];
  try{due=srsDue().filter(w=>weak.indexOf(w)<0).slice(0,6);}catch(e){}
  const list=weak.concat(due).slice(0,12);
  let h='<div class="panel glass"><h3>🎯 تدريب ذكي</h3><div class="muted">مبني على أخطائك ومراجعاتك ('+list.length+' كلمة).</div>';
  if(!list.length)h+='<div class="muted">لا توجد كلمات ضعيفة حاليًا — ممتاز! 🎉</div>';
  else h+='<div class="row-flex"><button class="btn btn-primary sm" id="prStart">ابدأ التدريب 🚀</button></div>';
  h+='</div>';
  box.innerHTML=h;
  const st=$("prStart");
  if(st)st.addEventListener("click",()=>{
    const qs=buildQuestions("mixed",Math.min(10,list.length),list);
    startQuizRun("mixed",qs);
  });
}
/* wiring */
/* Missing game engines (same primitives: gameOpts/shuffleOptions/placeCorrect/
   gameEnd/speakGerman/addXP/recordMistake/sessTick). Correct position is always
   remapped by the shuffle helper — never fixed first. */
function gMissing(box){
  const pool=shuffle(kapSents().filter(f=>(!f.kind||f.kind==="fill")&&String(f.s||"").includes("___"))).slice(0,8);
  let i=0,score=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length){gameEnd("gameBox","🕳️ Missing Word",score,pool.length,score*5+10,"missing");return;}
    const f=pool[i],sh=shuffleOptions(f.o,f.c);
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+'</div><h3 style="direction:ltr;text-align:center;font-size:26px">'+escapeHtml(f.s.replace("___","…"))+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),sh.opts,function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+f.why;score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ الصحيح: "+f.o[f.c]+" — "+f.why;recordMistake(sentexPseudoWord(f),sh.opts[j],"missing");}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,1800);
    });
  }
  q();
}
function gTF(box){
  const pool=shuffle(kapWords()).slice(0,8);
  const items=pool.map(function(w,ix){
    const truth=ix%2===0;
    const other=kapWords()[Math.floor(Math.random()*kapWords().length)];
    const claim=truth?w.ar:(other&&other.id!==w.id?other.ar:w.ar+"؟");
    return {w:w,claim:claim,truth:truth};
  });
  let i=0,score=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length){gameEnd("gameBox","✅❌ True or False",score,pool.length,score*5+10,"tf");return;}
    const it=items[i];
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+'</div><h3 style="direction:ltr;text-align:center;font-size:26px">'+escapeHtml(fullDe(it.w))+" = "+escapeHtml(it.claim)+'</h3><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),["✅ صح","❌ خطأ"],function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      const ok=(j===0)===it.truth;
      if(ok){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+fullDe(it.w)+" = "+it.w.ar;score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ الحقيقة: "+fullDe(it.w)+" = "+it.w.ar+ " — السبب: احفظ المعنى مع الكلمة!";}
      S.totalAnswered++;sessTick(ok);save();i++;setTimeout(q,1800);
    });
  }
  q();
}
function gSpeed(box){
  const pool=shuffle(kapWords()).slice(0,30);
  let i=0,score=0,left=60,over=false;
  const timer=setInterval(function(){left--;const e=$("gT");if(e)e.textContent=left;if(!box.isConnected){clearInterval(timer);over=true;return;}if(left<=0){clearInterval(timer);over=true;gameEnd("gameBox","⏱️ Speed Translation",score,i,score*4+10,"speed");}},1000);
  function q(){
    if(!box.isConnected)return;
    if(over)return;
    if(i>=pool.length){clearInterval(timer);gameEnd("gameBox","⏱️ Speed Translation",score,pool.length,score*4+10,"speed");return;}
    const w=pool[i],sh=shuffleOptions([w.ar].concat(shuffle(kapWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)),0);
    box.innerHTML='<div class="muted">⏱️ <b id="gT">'+left+'</b> • نقاط: '+score+'</div><h3 style="direction:ltr;text-align:center;font-size:30px">'+escapeHtml(fullDe(w))+'</h3><div id="gQ"></div>';
    gameOpts($("gQ"),sh.opts,function(j,b){
      if(over)return;
      if(j===sh.correct){b.classList.add("correct");score++;S.totalCorrect++;}
      else{b.classList.add("wrong");recordMistake(w,sh.opts[j],"speed");}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,600);
    });
  }
  q();
}
function gCatch(box){
  const pool=shuffle(kapWords().filter(w=>w.de.length<=12)).slice(0,8);
  let i=0,score=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length){gameEnd("gameBox","🎧 Listening Catch",score,pool.length,score*5+10,"catch");return;}
    const w=pool[i],sh=shuffleOptions([fullDe(w)].concat(shuffle(kapWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>fullDe(x))),0);
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+'</div><div class="row-flex" style="justify-content:center"><button class="btn btn-primary" id="gHear">🔊 استمع</button></div><div class="muted" style="text-align:center">ماذا سمعت؟</div><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    const play=function(){speakGerman(w.de);};
    $("gHear").addEventListener("click",play);setTimeout(play,400);
    gameOpts($("gQ"),sh.opts,function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+fullDe(w)+" = "+w.ar;score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ سمعت: "+fullDe(w)+" = "+w.ar;}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,1800);
    });
  }
  q();
}
function gDetective(box){
  const pool=shuffle(kapSents().filter(f=>["error","correct","transform"].indexOf(f.kind)>=0)).slice(0,8);
  let i=0,score=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length){gameEnd("gameBox","🕵️ Grammar Detective",score,pool.length,score*5+10,"detective");return;}
    const f=pool[i],sh=shuffleOptions(f.o,f.c);
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+' • اكتشف الصحيح 🕵️</div><h4>'+escapeHtml(f.q||"اختر الجملة الصحيحة:")+'</h4>'+(f.disp?'<div class="muted">'+escapeHtml(f.disp)+'</div>':"")+'<div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),sh.opts,function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+f.why;score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ الصحيح: "+f.o[f.c]+" — "+f.why;recordMistake(sentexPseudoWord(f),sh.opts[j],"detective");}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,2000);
    });
  }
  q();
}
function gBoss(box){
  const pool=shuffle(kapWords()).slice(0,10);
  let i=0,boss=10,you=3;
  function q(){
    if(!box.isConnected)return;
    if(boss<=0||you<=0||i>=pool.length){
      const win=boss<=0;
      gameEnd("gameBox","👹 Boss Battle",win?10-you:0,10,win?50:10,"boss",win?" • الوحش سقط!":" • حاول مجددًا");
      return;
    }
    const w=pool[i],sh=shuffleOptions([w.ar].concat(shuffle(kapWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)),0);
    box.innerHTML='<div class="muted">👹 الوحش: '+boss+' ❤️ • أنت: '+you+' ❤️</div><h3 style="direction:ltr;text-align:center;font-size:30px">'+escapeHtml(fullDe(w))+'</h3><div id="gQ"></div>';
    gameOpts($("gQ"),sh.opts,function(j,b){
      if(j===sh.correct){b.classList.add("correct");boss--;S.totalCorrect++;toast("💥 ضربة!","ok");}
      else{b.classList.add("wrong");you--;recordMistake(w,sh.opts[j],"boss");toast("💔 "+fullDe(w)+" = "+w.ar,"err");}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,1000);
    });
  }
  q();
}
function gPic(box){
  const pool=shuffle(kapWords().filter(w=>w.img)).slice(0,8);
  if(!pool.length){box.innerHTML='<div class="muted">لا صور متاحة بعد.</div>';return;}
  let i=0,score=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length){gameEnd("gameBox","📸 Picture Words",score,pool.length,score*5+10,"pic");return;}
    const w=pool[i],sh=shuffleOptions([fullDe(w)].concat(shuffle(kapWords().filter(x=>x.id!==w.id&&!x.img)).slice(0,3).map(x=>fullDe(x))),0);
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+' • ما هذه؟</div><img class="word-img" src="'+w.img+'" alt="؟" style="max-height:220px"><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),sh.opts,function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+fullDe(w)+" = "+w.ar;score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ "+fullDe(w)+" = "+w.ar;}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,1800);
    });
  }
  q();
}
function gMusic(box){
  const lines=[];
  try{REAL_SITS.forEach(s=>(s.phr||[]).concat(s.dlg||[]).forEach(p=>{if(p[0].split(" ").length>=3&&p[0].split(" ").length<=7)lines.push(p);}));}catch(e){}
  const pool=shuffle(lines).slice(0,8);
  let i=0,score=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length){gameEnd("gameBox","🎵 Music Mode",score,pool.length,score*5+10,"music");return;}
    const words=pool[i][0].split(" "),last=words[words.length-1];
    const sh=shuffleOptions([last,"Haus","Wasser","Tisch"].filter((v,ix,a)=>a.indexOf(v)===ix),0);
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+' • أكمل 🎵</div><h3 style="direction:ltr;text-align:center">'+escapeHtml(words.slice(0,-1).join(" ")+" …")+'</h3><div class="row-flex" style="justify-content:center"><button class="btn btn-ghost sm" id="gHear">🔊 اسمع اللحن</button></div><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    const play=function(){speakGerman(pool[i][0]);};
    $("gHear").addEventListener("click",play);setTimeout(play,400);
    gameOpts($("gQ"),sh.opts,function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+pool[i][0]+" = "+pool[i][1];score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ "+pool[i][0]+" = "+pool[i][1];}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,1800);
    });
  }
  q();
}
function gbattle(box){
  const pool=shuffle(kapWords()).slice(0,6);
  let i=0,you=0,cpu=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length||you>=4||cpu>=4){
      const win=you>cpu;
      gameEnd("gameBox","⚔️ German Battle",you,pool.length,you*8+10,"gbattle",win?" • فزت على الخصم!":" • الخصم فاز");
      return;
    }
    const w=pool[i],sh=shuffleOptions([w.ar].concat(shuffle(kapWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)),0);
    box.innerHTML='<div class="muted">جولة '+(i+1)+' • أنت '+you+' ⚔️ الخصم '+cpu+'</div><div class="progress" style="margin-bottom:8px"><div class="progress-fill" style="width:'+(you/4*100)+'%"></div></div><h3 style="direction:ltr;text-align:center;font-size:28px">'+escapeHtml(fullDe(w))+'</h3><div id="gQ"></div>';
    gameOpts($("gQ"),sh.opts,function(j,b){
      if(j===sh.correct){b.classList.add("correct");you++;S.totalCorrect++;}
      else{b.classList.add("wrong");recordMistake(w,sh.opts[j],"gbattle");}
      if(Math.random()<0.55)cpu++;
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,1200);
    });
  }
  q();
}
function gbomb(box){
  const pool=shuffle(kapWords()).slice(0,8);
  let i=0,score=0,lives=3,timer=null;
  function q(){
    if(!box.isConnected)return;
    if(lives<=0){clearInterval(timer);gameEnd("gameBox","💣 Bomb Defusal",score,pool.length,score*5,"gbomb"," • 💥 انفجرت!");return;}
    if(i>=pool.length){clearInterval(timer);gameEnd("gameBox","💣 Bomb Defusal",score,pool.length,score*5+20,"gbomb"," • ✅ فككتها!");return;}
    const w=pool[i];
    const sh=shuffleOptions([fullDe(w)].concat(shuffle(kapWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>fullDe(x))),0);
    let left=12, done=false;
    box.innerHTML='<div class="muted">💣 سؤال '+(i+1)+'/'+pool.length+' • ⏱️ <b id="gT">'+left+'</b> • ❤️ '+lives+'</div><h3 style="direction:ltr;text-align:center;font-size:28px">ما معنى: '+escapeHtml(w.ar)+'؟</h3><div id="gQ"></div>';
    timer=setInterval(function(){left--;const e=$("gT");if(e)e.textContent=left;if(!box.isConnected){clearInterval(timer);return;}if(left<=0){clearInterval(timer);answer(-1);}},1000);
    gameOpts($("gQ"),sh.opts,function(j){clearInterval(timer);answer(j);});
    function answer(j){
      if(done)return;done=true;
      if(j===sh.correct){score++;S.totalCorrect++;toast("✅ سلك مقطوع!","ok");}
      else{lives--;if(j>=0)recordMistake(w,fullDe(w),"gbomb");toast("❌ "+fullDe(w),"err");}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,900);
    }
  }
  q();
}
function gdetect(box){
  const lines=[];
  try{REAL_SITS.forEach(s=>(s.dlg||[]).forEach(p=>lines.push({de:p[0],ar:p[1],sit:s.t})));}catch(e){}
  const pool=shuffle(lines).slice(0,8);
  let i=0,score=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length){gameEnd("gameBox","🕵️ German Detective",score,pool.length,score*5+10,"gdetect");return;}
    const it=pool[i];
    const others=shuffle(lines.filter(x=>x.de!==it.de)).slice(0,3).map(x=>x.de);
    const sh=shuffleOptions([it.de].concat(others),0);
    box.innerHTML='<div class="muted">سؤال '+(i+1)+'/'+pool.length+' • 🕵️ سمعت بالعربي: <b>'+escapeHtml(it.ar)+'</b> ('+escapeHtml(it.sit)+')</div><div class="muted">ماذا قيل بالألمانية؟</div><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),sh.opts,function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+it.de;score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ قيل: "+it.de;}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,1800);
    });
  }
  q();
}
function gshop(box){
  const stock=shuffle(kapWords().filter(w=>w.cat==="Food"||/Brot|Milch|Kaffee|Tee|Apfel|Wasser|Käse|Zucker/i.test(w.de))).slice(0,6);
  const pit=["Guten Tag!","Hallo!","Guten Morgen!"][Math.floor(Math.random()*3)];
  let i=0,score=0,kasse=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=stock.length){gameEnd("gameBox","🛒 German Shop",score,stock.length,score*5+10,"gshop"," • الكاشير: €"+kasse.toFixed(2));return;}
    const w=stock[i],price=(1+Math.floor(Math.random()*9))+[0.3,0.5,0.8,0.99][Math.floor(Math.random()*4)];
    const right=["Gerne! Das kostet €"+price.toFixed(2)+".","Sonst noch etwas?","Danke, tschüs!"][i%3];
    const sh=shuffleOptions([right,"Wie heißen Sie?","Wo wohnen Sie?"].filter((v,ix,a)=>a.indexOf(v)===ix),0);
    box.innerHTML='<div class="muted">زبون '+(i+1)+'/'+stock.length+' • الكاشير: €'+kasse.toFixed(2)+'</div><div class="panel glass"><div class="ex-de-l">🧑 "'+escapeHtml(pit+" Ich möchte "+fullDe(w)+", bitte.")+'"</div><div class="ex-ar">يريد: '+escapeHtml(w.ar)+' (السعر €'+price.toFixed(2)+')</div></div><div class="muted">رد البائع المناسب:</div><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),sh.opts,function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===sh.correct){b.classList.add("correct");kasse=Math.round((kasse+price)*100)/100;fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ بيع موفق!";score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ الأفضل: "+right;}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,1800);
    });
  }
  q();
}
function grunner(box){
  let lives=3,score=0,lvl=1,timer=null;
  function gate(){
    if(!box.isConnected)return;
    if(lives<=0){clearInterval(timer);gameEnd("gameBox","🏃 Word Runner",score,score,score*3+10,"grunner"," • مسافة: "+score);return;}
    const pool=kapWords().filter(w=>w.type==="اسم"&&w.art!=="-");
    const w=shuffle(pool)[0];
    const sh=shuffleOptions([w.art,w.art==="der"?"die":"der",w.art==="das"?"die":"das"],0);
    const secs=Math.max(4,9-lvl);
    let left=secs;
    box.innerHTML='<div class="muted">🏃 مسافة: '+score+' • ❤️ '+lives+' • مستوى '+lvl+' • ⏱️ <b id="gT">'+left+'</b></div><h3 style="direction:ltr;text-align:center;font-size:34px">… '+escapeHtml(w.de)+'</h3><div class="muted" style="text-align:center">اختر البوابة الصحيحة (الأداة)!</div><div id="gQ"></div>';
    timer=setInterval(function(){left--;const e=$("gT");if(e)e.textContent=left;if(!box.isConnected){clearInterval(timer);return;}if(left<=0){clearInterval(timer);miss();}},1000);
    gameOpts($("gQ"),sh.opts,function(j,b){
      clearInterval(timer);
      if(j===sh.correct){b.classList.add("correct");score++;if(score%5===0)lvl++;S.totalCorrect++;}
      else{b.classList.add("wrong");miss();return;}
      S.totalAnswered++;sessTick(true);save();setTimeout(gate,700);
    });
    function miss(){lives--;recordMistake(w,w.art,"grunner");S.totalAnswered++;sessTick(false);save();toast("❌ "+w.art+" "+w.de,"err");setTimeout(gate,900);}
  }
  gate();
}

/* Arcade wave 2: distinct gameplays reusing project data + shared systems.
   All pools kap-aware (gpool/kapWords/kapSents) with full-content fallback. */
function gTower(box){
  const nouns=gpool(allWords(),w=>w.type==="اسم"&&w.art!=="-"&&/^[A-ZÄÖÜ]/.test(w.de),6).slice(0,12);
  const stages=[
    {t:"🏰 الطابق 1: الأداة",mk:function(w){return {q:"ما أداة "+w.de+"؟",o:placeCorrect(["der","die","das"],w.art,"tower"),exp:w.art+" "+w.de};}},
    {t:"🏰 الطابق 2: Akkusativ",mk:function(w){if(w.art!=="der")return null;return {q:"Ich sehe ___ "+w.de+".",o:placeCorrect(["den","der","dem","die"], "den","tower"),exp:"مذكر مفعول → den"};}},
    {t:"🏰 الطابق 3: الجمع",mk:function(w){if(!w.plural)return null;const others=shuffle(kapWords().filter(x=>x.plural&&x.id!==w.id)).slice(0,3).map(x=>x.plural);if(others.length<3)return null;return {q:"ما جمع "+w.de+"؟",o:placeCorrect([w.plural].concat(others),w.plural,"tower"),exp:"الجمع: "+w.plural};}}
  ];
  let si=0,qi=0,score=0,total=0;
  function stage(){
    if(!box.isConnected)return;
    if(si>=stages.length||qi>=4){gameEnd("gameBox","🗼 Artikel Tower",score,total,score*4+15,"tower");return;}
    const w=nouns[(si*4+qi)%nouns.length];
    const it=stages[si].mk(w);
    if(!it){qi++;if(qi>=4){qi=0;si++;}stage();return;}
    total++;
    box.innerHTML='<div class="muted">'+stages[si].t+' • سؤال '+(qi+1)+'/4 • نقاط: '+score+'</div><div class="progress" style="margin-bottom:8px"><div class="progress-fill" style="width:'+(si/stages.length*100)+'%"></div></div><h4>'+escapeHtml(it.q)+'</h4><div id="gQ"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    gameOpts($("gQ"),it.o.opts,function(j,b){
      const fb=$("gFb");fb.classList.remove("hidden");
      if(j===it.o.correct){b.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+it.exp+" 🏰";score++;S.totalCorrect++;}
      else{b.classList.add("wrong");fb.className="quiz-feedback no";fb.textContent="❌ "+it.exp;}
      S.totalAnswered++;sessTick(j===it.o.correct);save();
      qi++;if(qi>=4){qi=0;si++;}
      setTimeout(stage,1600);
    });
  }
  stage();
}
function gEscape(box){
  const fillP=kapSents().filter(f=>(!f.kind||f.kind==="fill")&&String(f.s||"").includes("___"));
  const ordP=kapSents().filter(f=>f.kind==="order");
  const w0=kapWords()[0]||allWords()[0];
  const sits=(function(){try{return REAL_SITS.slice(0,4);}catch(e){return [];}})();
  const locks=[
    {t:"🔐 القفل 1: قواعد",kind:"q",f:fillP[0]},
    {t:"🔐 القفل 2: رتّب الجملة",kind:"order",f:ordP[0]},
    {t:"🔐 القفل 3: استمع",kind:"listen",w:w0},
    {t:"🔐 القفل 4: الموقف",kind:"sit",s:sits[0]},
    {t:"🔐 القفل النهائي: مختلط",kind:"q",f:fillP[1]||fillP[0]},
  ].filter(x=>x.f||x.w||x.s);
  let i=0,score=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=locks.length){gameEnd("gameBox","🗝️ German Escape",score,locks.length,score*6+15,"escape"," • 🎉 خرجت من الغرفة!");return;}
    const L=locks[i];
    box.innerHTML='<div class="muted">'+L.t+' ('+(i+1)+'/'+locks.length+') • نقاط: '+score+'</div><div id="gL"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    const host=$("gL");
    function done(ok,msg){
      const fb=$("gFb");fb.classList.remove("hidden");
      fb.className="quiz-feedback "+(ok?"ok":"no");fb.textContent=msg;
      if(ok){score++;S.totalCorrect++;}
      S.totalAnswered++;sessTick(ok);save();i++;setTimeout(q,1800);
    }
    if(L.kind==="q"&&L.f){
      const sh=shuffleOptions(L.f.o,L.f.c);
      host.innerHTML='<h4>'+escapeHtml(L.f.s.replace("___","…"))+'</h4><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅ "+L.f.why);}
        else{b.classList.add("wrong");done(false,"❌ "+L.f.why);}
      });
    }else if(L.kind==="order"&&L.f){
      const sh=shuffle(L.f.words.map((w,k)=>k));
      let cur=[];
      host.innerHTML='<div class="muted">'+escapeHtml(L.f.q||"رتّب:")+'</div><div class="order-answer" id="gAns"></div><div class="quiz-opts">'+sh.map(k=>'<button class="quiz-opt" data-k="'+k+'">'+escapeHtml(L.f.words[k])+'</button>').join("")+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="gClear">مسح</button><button class="btn btn-primary sm" id="gCheck">تحقق ✅</button></div>';
      const ans=$("gAns");
      host.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{const k=parseInt(b.getAttribute("data-k"),10);cur.push(k);b.disabled=true;const c=document.createElement("span");c.className="order-chip";c.textContent=L.f.words[k];ans.appendChild(c);}));
      $("gClear").addEventListener("click",()=>{cur=[];ans.innerHTML="";host.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=false);});
      $("gCheck").addEventListener("click",()=>{done(cur.join()===L.f.words.map((_,k)=>k).join(),cur.map(k=>L.f.words[k]).join(" ")+" — "+L.f.why);});
    }else if(L.kind==="listen"&&L.w){
      const w=L.w,sh=shuffleOptions([fullDe(w)].concat(shuffle(kapWords().filter(x=>x.id!==w.id)).slice(0,3).map(x=>fullDe(x))),0);
      host.innerHTML='<div class="row-flex" style="justify-content:center"><button class="btn btn-primary" id="gHear">🔊 استمع</button></div><div id="gQ"></div>';
      const play=function(){speakGerman(w.de);};
      $("gHear").addEventListener("click",play);setTimeout(play,400);
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅ "+fullDe(w));}
        else{b.classList.add("wrong");done(false,"❌ "+fullDe(w));}
      });
    }else if(L.kind==="sit"&&L.s){
      const line=L.s.dlg[1]||L.s.phr[0];
      const others=shuffle(L.s.dlg.filter(p=>p[0]!==line[0])).slice(0,2).map(p=>p[0]);
      const sh=shuffleOptions([line[0]].concat(others.length?others:["Guten Tag!","Danke!"]),0);
      host.innerHTML='<div class="muted">'+escapeHtml(L.s.t)+'</div><h4>'+escapeHtml(L.s.dlg[0][0])+'</h4><div class="muted">اختر الرد المناسب:</div><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅ "+line[1]);}
        else{b.classList.add("wrong");done(false,"❌ الأفضل: "+line[0]);}
      });
    }else{i++;q();}
  }
  q();
}
function gRandom(box){
  const gens=["vocab","grammar","listen","order","sit"];
  let i=0,score=0;const N=8;
  const badges={vocab:"📚 مفردات",grammar:"📐 قواعد",listen:"🎧 استماع",order:"🧩 ترتيب",sit:"🚦 موقف"};
  function q(){
    if(!box.isConnected)return;
    if(i>=N){gameEnd("gameBox","🎲 Random Challenge",score,N,score*5+10,"random");return;}
    const t=gens[Math.floor(Math.random()*gens.length)];
    box.innerHTML='<div class="muted">جولة '+(i+1)+'/'+N+' • '+badges[t]+' • نقاط: '+score+'</div><div id="gL"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    const host=$("gL");
    function done(ok,msg){
      const fb=$("gFb");fb.classList.remove("hidden");
      fb.className="quiz-feedback "+(ok?"ok":"no");fb.textContent=msg;
      if(ok){score++;S.totalCorrect++;}
      S.totalAnswered++;sessTick(ok);save();i++;setTimeout(q,1700);
    }
    if(t==="vocab"){
      const pool=kapWords(),w=shuffle(pool)[0];
      const sh=shuffleOptions([w.ar].concat(shuffle(pool.filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ar)),0);
      host.innerHTML='<h3 dir="ltr" style="text-align:center">'+escapeHtml(fullDe(w))+'</h3><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅");}
        else{b.classList.add("wrong");done(false,"❌ "+fullDe(w)+" = "+w.ar);}
      });
    }else if(t==="grammar"){
      const pool=kapSents().filter(f=>!f.kind||f.kind==="fill");
      const f=shuffle(pool)[0];
      const sh=shuffleOptions(f.o,f.c);
      host.innerHTML='<h3 dir="ltr" style="text-align:center">'+escapeHtml(f.s.replace("___","…"))+'</h3><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅ "+f.why);}
        else{b.classList.add("wrong");done(false,"❌ "+f.why);}
      });
    }else if(t==="listen"){
      const pool=kapWords().filter(w=>w.de.length<=12),w=shuffle(pool)[0];
      const sh=shuffleOptions([fullDe(w)].concat(shuffle(pool.filter(x=>x.id!==w.id)).slice(0,3).map(x=>fullDe(x))),0);
      host.innerHTML='<div class="row-flex" style="justify-content:center"><button class="btn btn-primary" id="gHear">🔊</button></div><div id="gQ"></div>';
      const play=function(){speakGerman(w.de);};
      $("gHear").addEventListener("click",play);setTimeout(play,400);
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅");}
        else{b.classList.add("wrong");done(false,"❌ "+fullDe(w));}
      });
    }else if(t==="order"){
      const pool=kapSents().filter(f=>f.kind==="order"),f=shuffle(pool.length?pool:kapSents())[0];
      const words=f.words||f.s.replace("___","").split(" ").filter(Boolean);
      const sh=shuffle(words.map((w,k)=>k));
      let cur=[];
      host.innerHTML='<div id="gQ" class="quiz-opts">'+sh.map(k=>'<button class="quiz-opt" data-k="'+k+'">'+escapeHtml(words[k])+'</button>').join("")+'</div><div class="order-answer" id="gAns"></div><div class="row-flex"><button class="btn btn-ghost sm" id="gClear">مسح</button><button class="btn btn-primary sm" id="gCheck">تحقق ✅</button></div>';
      const ans=$("gAns");
      host.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{const k=parseInt(b.getAttribute("data-k"),10);cur.push(k);b.disabled=true;const c=document.createElement("span");c.className="order-chip";c.textContent=words[k];ans.appendChild(c);}));
      $("gClear").addEventListener("click",()=>{cur=[];ans.innerHTML="";host.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=false);});
      const target=(f.words||[]).join(" ")||f.s.replace("___","").replace(/\s+/g," ").trim();
      $("gCheck").addEventListener("click",()=>{done(cur.map(k=>words[k]).join(" ")===target,"الصحيح: "+target);});
    }else{
      let sits=[];try{sits=REAL_SITS;}catch(e){}
      const s=sits[Math.floor(Math.random()*sits.length)];
      const line=s.dlg[1]||s.phr[0];
      const sh=shuffleOptions([line[0],"Guten Tag!","Wie heißt du?"].filter((v,ix,a)=>a.indexOf(v)===ix),0);
      host.innerHTML='<div class="muted">'+escapeHtml(s.t)+'</div><h4>'+escapeHtml(s.dlg[0][0])+'</h4><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅ "+line[1]);}
        else{b.classList.add("wrong");done(false,"❌ "+line[0]);}
      });
    }
  }
  q();
}
function gConv(box){
  let sits=[];try{sits=REAL_SITS.slice(0,6);}catch(e){}
  if(!sits.length){box.innerHTML='<div class="muted">لا حوارات متاحة.</div>';return;}
  let si=0,score=0,total=0;
  function turn(){
    if(!box.isConnected)return;
    if(si>=sits.length){gameEnd("gameBox","💬 Conversation Quest",score,total,score*4+12,"conv");return;}
    const s=sits[si],mode=si%3;
    box.innerHTML='<div class="muted">حوار '+(si+1)+'/'+sits.length+' • '+escapeHtml(s.t)+'</div><div id="gL"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    const host=$("gL");
    function done(ok,msg){
      const fb=$("gFb");fb.classList.remove("hidden");
      fb.className="quiz-feedback "+(ok?"ok":"no");fb.textContent=msg;
      if(ok){score++;S.totalCorrect++;}
      total++;S.totalAnswered++;sessTick(ok);save();si++;setTimeout(turn,1900);
    }
    if(mode===0){
      const others=shuffle(sits.filter(x=>x.id!==s.id)).slice(0,2).map(x=>x.dlg[1][0]);
      const sh=shuffleOptions([s.dlg[1][0]].concat(others),0);
      host.innerHTML='<div class="ex-de-l">🧑 "'+escapeHtml(s.dlg[0][0])+'"</div><div class="ex-ar">'+escapeHtml(s.dlg[0][1])+'</div><div class="muted">اختر ردك:</div><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"رد مناسب ✅");}
        else{b.classList.add("wrong");done(false,"❌ الأفضل: "+s.dlg[1][0]);}
      });
    }else if(mode===1){
      const words=s.dlg[2][0].split(" "),sh=shuffle(words.map((w,k)=>k));
      let cur=[];
      host.innerHTML='<div class="ex-de-l">🧑 "'+escapeHtml(s.dlg[2][0])+'"</div><div class="muted">رتّب الرد: '+escapeHtml(s.dlg[2][1])+'</div><div class="order-answer" id="gAns"></div><div class="quiz-opts">'+sh.map(k=>'<button class="quiz-opt" data-k="'+k+'">'+escapeHtml(words[k])+'</button>').join("")+'</div><div class="row-flex"><button class="btn btn-ghost sm" id="gClear">مسح</button><button class="btn btn-primary sm" id="gCheck">تحقق ✅</button></div>';
      const ans=$("gAns");
      host.querySelectorAll(".quiz-opt").forEach(b=>b.addEventListener("click",()=>{const k=parseInt(b.getAttribute("data-k"),10);cur.push(k);b.disabled=true;const c=document.createElement("span");c.className="order-chip";c.textContent=words[k];ans.appendChild(c);}));
      $("gClear").addEventListener("click",()=>{cur=[];ans.innerHTML="";host.querySelectorAll(".quiz-opt").forEach(x=>x.disabled=false);});
      $("gCheck").addEventListener("click",()=>{done(cur.map(k=>words[k]).join(" ")===s.dlg[2][0],"الصحيح: "+s.dlg[2][0]);});
    }else{
      const parts=s.dlg[3][0].split(" "),last=parts[parts.length-1];
      const sh=shuffleOptions([last,"Haus","Tag","Nein"].filter((v,ix,a)=>a.indexOf(v)===ix),0);
      host.innerHTML='<div class="muted">أكمل الحوار:</div><h4 dir="ltr">'+escapeHtml(parts.slice(0,-1).join(" ")+" …")+'</h4><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅ "+s.dlg[3][0]);}
        else{b.classList.add("wrong");done(false,"❌ "+s.dlg[3][0]);}
      });
    }
  }
  turn();
}
function gSpell(box){
  const pool=shuffle(kapWords()).sort((a,b)=>a.de.length-b.de.length);
  const qs=pool.slice(0,10);
  let i=0,score=0,streak=0;
  function q(){
    if(!box.isConnected)return;
    if(i>=qs.length){gameEnd("gameBox","🔤 Spelling Challenge",score,qs.length,score*4+10,"spell");return;}
    const w=qs[i];
    box.innerHTML='<div class="muted">كلمة '+(i+1)+'/'+qs.length+' • 🔥'+streak+' • ('+w.de.length+' حروف)</div><div class="muted" style="font-size:22px">المعنى: <b>'+escapeHtml(w.ar)+'</b></div><div class="row-flex" style="justify-content:center"><button class="btn btn-ghost sm" id="gHear">🔊 اسمع</button></div><div class="quiz-write"><input type="text" id="gIn" dir="ltr" autocomplete="off" placeholder="…"><button class="btn btn-primary sm" id="gOk">تحقق ✅</button></div><div class="quiz-feedback hidden" id="gFb"></div>';
    $("gHear").addEventListener("click",function(){speakGerman(w.de);});
    function check(){
      const v=$("gIn").value.trim(),fb=$("gFb");fb.classList.remove("hidden");
      if(!v){fb.className="quiz-feedback no";fb.textContent="اكتب الكلمة أولًا.";return;}
      const ok=v.toLowerCase()===w.de.toLowerCase();
      if(ok){fb.className="quiz-feedback ok";fb.textContent="صحيح ✅ "+fullDe(w);score++;streak++;S.totalCorrect++;}
      else{fb.className="quiz-feedback no";fb.textContent="❌ الصحيح: "+fullDe(w)+" = "+w.ar;streak=0;recordMistake(w,v,"spell");}
      S.totalAnswered++;sessTick(ok,w.id);save();i++;setTimeout(q,1900);
    }
    $("gOk").addEventListener("click",check);
    $("gIn").addEventListener("keydown",function(e){if(e.key==="Enter")check();});
  }
  q();
}
function gTraffic(box){
  let sits=[];try{sits=REAL_SITS;}catch(e){}
  const pool=shuffle(sits).slice(0,8);
  let i=0,score=0,timer=null;
  function q(){
    if(!box.isConnected)return;
    if(i>=pool.length){clearInterval(timer);gameEnd("gameBox","🚦 Deutsch Traffic",score,pool.length,score*5+10,"traffic");return;}
    const s=pool[i];
    const others=shuffle(sits.filter(x=>x.id!==s.id)).slice(0,2).map(x=>x.phr[0][0]);
    const sh=shuffleOptions([s.phr[0][0]].concat(others),0);
    let left=10;
    box.innerHTML='<div class="muted">🚦 موقف '+(i+1)+'/'+pool.length+' • ⏱️ <b id="gT">'+left+'</b> • نقاط: '+score+'</div><div class="panel glass"><div class="ex-de-l">📍 '+escapeHtml(s.t)+'</div><div class="muted">'+escapeHtml(s.phr[0][1])+'</div><div class="muted">القرار الصحيح:</div></div><div id="gQ"></div>';
    timer=setInterval(function(){left--;const e=$("gT");if(e)e.textContent=left;if(left<=0){clearInterval(timer);answer(-1);}},1000);
    gameOpts($("gQ"),sh.opts,function(j){clearInterval(timer);answer(j);});
    function answer(j){
      if(j===sh.correct){score++;S.totalCorrect++;toast("✅ قرار صحيح!","ok");}
      else{toast("❌ الأفضل: "+s.phr[0][0],"err");}
      S.totalAnswered++;sessTick(j===sh.correct);save();i++;setTimeout(q,900);
    }
  }
  q();
}
function gAdventure(box){
  let sits=[];try{sits=REAL_SITS.slice(0,8);}catch(e){}
  if(!sits.length){box.innerHTML='<div class="muted">لا أماكن متاحة.</div>';return;}
  let i=0,score=0,path=[];
  function q(){
    if(!box.isConnected)return;
    if(i>=sits.length){gameEnd("gameBox","🗺️ German Adventure",score,sits.length,score*5+12,"adventure"," • "+path.join(" ← "));return;}
    const s=sits[i],mode=i%2;
    box.innerHTML='<div class="muted">🗺️ '+path.join(" ← ")+'</div><div class="muted">موقع '+(i+1)+'/'+sits.length+': <b>'+escapeHtml(s.t)+'</b> • نقاط: '+score+'</div><div id="gL"></div><div class="quiz-feedback hidden" id="gFb"></div>';
    const host=$("gL");
    function done(ok,msg,place){
      const fb=$("gFb");fb.classList.remove("hidden");
      fb.className="quiz-feedback "+(ok?"ok":"no");fb.textContent=msg;
      if(ok){score++;S.totalCorrect++;path.unshift(s.t.split(" ")[0]);}
      else{path.unshift("🌀 "+s.t.split(" ")[0]);}
      S.totalAnswered++;sessTick(ok);save();i++;setTimeout(q,1900);
    }
    if(mode===0){
      const v=s.voc[Math.floor(Math.random()*s.voc.length)];
      const others=shuffle(kapWords().filter(x=>x.ar!==v[1])).slice(0,3).map(x=>x.ar);
      const sh=shuffleOptions([v[1]].concat(others),0);
      host.innerHTML='<div class="muted">مهمة: افهم كلمة المكان — <b dir="ltr">'+escapeHtml(v[0])+'</b></div><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅ "+v[0]+" = "+v[1]);}
        else{b.classList.add("wrong");done(false,"❌ "+v[0]+" = "+v[1]);}
      });
    }else{
      const line=s.phr[Math.floor(Math.random()*s.phr.length)];
      const others=shuffle(sits.filter(x=>x.id!==s.id)).slice(0,2).map(x=>x.phr[0][0]);
      const sh=shuffleOptions([line[0]].concat(others),0);
      host.innerHTML='<div class="muted">مهمة: ماذا تقول هنا؟ ('+escapeHtml(line[1])+')</div><div id="gQ"></div>';
      gameOpts($("gQ"),sh.opts,function(j,b){
        if(j===sh.correct){b.classList.add("correct");done(true,"صحيح ✅");}
        else{b.classList.add("wrong");done(false,"❌ الأفضل: "+line[0]);}
      });
    }
  }
  q();
}

const PLAY_PAGES={games:renderGames,challenge:renderChallenge,me:renderMe,practice:renderPractice};
(function(){
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(PLAY_PAGES[n])PLAY_PAGES[n]();}catch(e){console.error(e);}};
  }catch(e){console.error(e);}
})();