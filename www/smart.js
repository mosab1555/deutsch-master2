/* Deutsch Master - Smart Training Question Engine (ADDITIVE ONLY).
   Rebuilds ONLY page-practice (التدريب الذكي). Everything else untouched.
   20 distinct question types, smart distribution, difficulty engine, adaptive
   skills, history anti-repeat, per-skill feedback, distinct UI per type.
   Structure:
     PURE ENGINE (no DOM/S; node-testable) ... marker RENDERERS below.
   Question object: {id,type,skill,level,kap,difficulty,ui,prompt,promptAr,
     opts,correct,accepts,explain,audio,image,emoji,tags,tpl,hint,blank,extra} */
"use strict";

/* ================= PURE ENGINE (node-testable; no DOM, no S) ================= */
function smNorm(s){
  let x=String(s==null?"":s).toLowerCase();
  x=x.replace(/[.?!,;:¿¡]/g,"");
  x=x.split('"').join("").split("'").join("");
  x=x.replace(/\s+/g," ").trim();
  x=x.replace(/ß/g,"ss").replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u");
  return x;
}
function smTok(s){return smNorm(s).split(" ").filter(Boolean);}
function smShuffle(a,rnd){
  const x=a.slice();const r=rnd||Math.random;
  for(let i=x.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=x[i];x[i]=x[j];x[j]=t;}
  return x;
}
function smFullDe(w){return (w.art&&w.art!=="-"?w.art+" ":"")+w.de;}
/* data pools (globals, stubbed in tests) */
function smAllWords(kaps,level){
  try{
    return allWords().filter(w=>(!kaps||!kaps.length||kaps.indexOf(w.kap||"KX")>=0)&&(!level||(w.level||"A1")===level));
  }catch(e){return [];}
}
function smFills(kaps){
  try{
    if(typeof SENT_FILL==="undefined")return [];
    return SENT_FILL.filter(f=>(!kaps||!kaps.length||kaps.indexOf(f.chapterId)>=0)&&(!f.kind||f.kind==="fill")&&String(f.s||"").indexOf("___")>=0);
  }catch(e){return [];}
}
function smOrders(kaps){
  try{
    if(typeof SENT_FILL==="undefined")return [];
    return SENT_FILL.filter(f=>f.kind==="order"&&(!kaps||!kaps.length||kaps.indexOf(f.chapterId)>=0));
  }catch(e){return [];}
}
function smSents(level){
  try{
    if(typeof SENTENCES==="undefined")return [];
    return SENTENCES.filter(s=>!level||(s.level||s.lvl||"A1")===level);
  }catch(e){return [];}
}
function smNouns(kaps){
  return smAllWords(kaps,"A1").filter(w=>w.type==="اسم"&&w.art&&w.art!=="-"&&/^[A-ZÄÖÜ]/.test(w.de||""));
}
function smImgFor(w){
  try{
    if(typeof WORD_IMG!=="undefined"){
      const k=(w.de+"|"+(w.art||"-"));
      if(WORD_IMG[k])return WORD_IMG[k];
    }
  }catch(e){}
  return null;
}
/* curated emoji scenes (big visuals without external assets) */
const SM_EMOJI={"Haus":"🏠","Apfel":"🍎","Buch":"📖","Schule":"🏫","Wasser":"💧","Brot":"🍞","Taxi":"🚕","Zug":"🚆","Katze":"🐱","Hund":"🐶","Tür":"🚪","Tisch":"🪑","Kaffee":"☕","Tee":"🍵","Milch":"🥛","Auto":"🚗","Mann":"👨","Frau":"👩","Kind":"🧒","Mutter":"👩‍🍳","Vater":"👨‍💼","Tag":"☀️","Nacht":"🌙","Morgen":"🌅","Abend":"🌆","Stadt":"🏙️","Schule2":"🎒","Arzt":"🩺","Bäcker":"🥨","Fisch":"🐟","Vogel":"🐦","Baum":"🌳","Blume":"🌸","Sonne":"☀️","Mond":"🌙","Straße":"🛣️","Brücke":"🌉","Kino":"🎬","Pizza":"🍕","Käse":"🧀","Ei":"🥚","Suppe":"🍲","Kuchen":"🍰","Tasse":"☕","Geld":"💶","Uhr":"🕙","Handy":"📱","Schlüssel":"🔑","Brille":"👓","Stift":"🖊️","Tasche":"👜","Schuh":"👟","Hemd":"👔","Hose":"👖","Jacke":"🧥","Rock":"👗","Hut":"🎩","Regen":"🌧️","Schnee":"❄️","Wind":"💨","Sommer":"☀️","Winter":"⛄","Frühling":"🌷","Herbst":"🍂"};
function smEmoji(w){
  if(SM_EMOJI[w.de])return SM_EMOJI[w.de];
  if(w.type==="فعل")return "🏃";if(w.type==="صفة")return "✨";
  return "🔤";
}
/* skills + type registry */
const SM_SKILLS=["vocab","article","plural","verb","grammar","order","listening","translation","context"];
const SM_TYPES=["mcq","chips","order","write","match","article","plural","error","tf","translate","reverse","listen_choice","listen_write","dialogue","reply","context","img_word","word_img","odd","build"];
const SM_TYPE_SKILL={mcq:"grammar",chips:"verb",order:"order",write:"verb",match:"vocab",article:"article",plural:"plural",error:"grammar",tf:"vocab",translate:"translation",reverse:"vocab",listen_choice:"listening",listen_write:"listening",dialogue:"context",reply:"context",context:"context",img_word:"vocab",word_img:"vocab",odd:"vocab",build:"order"};
/* curated dialogue / reply / context / tf / odd banks (real A1, kapitel-tagged) */
const SM_DLG=[
{kap:"K0",a:"Guten Morgen!",aAr:"صباح الخير!",opts:[["Guten Morgen!","صباح الخير!",1],["Gute Nacht!","مساء الخير!",0],["Tschüs!","سلام!",0]],why:"الرد الطبيعي على تحية الصباح."},
{kap:"K0",a:"Wie heißt du?",aAr:"ما اسمك؟",opts:[["Ich heiße Ali.","اسمي علي.",1],["Mir geht es gut.","أنا بخير.",0],["Ich bin zwanzig.","عمري عشرون.",0]],why:"السؤال عن الاسم → الاسم."},
{kap:"K1",a:"Woher kommst du?",aAr:"من أين أنت؟",opts:[["Ich komme aus Ägypten.","أنا من مصر.",1],["Ich wohne in Berlin.","أسكن في برلين.",0],["Ich lerne Deutsch.","أتعلم الألمانية.",0]],why:"Woher تسأل عن الأصل (kommen aus)."},
{kap:"K2",a:"Wie geht es dir?",aAr:"كيف حالك؟",opts:[["Danke, gut! Und dir?","شكرًا بخير! وأنت؟",1],["Ich bin zwanzig Jahre alt.","عمري عشرون.",0],["Die Tür ist groß.","الباب كبير.",0]],why:"الرد الطبيعي: بخير + سؤال مماثل."},
{kap:"K3",a:"Was kostet das Brot?",aAr:"كم سعر الخبز؟",opts:[["Zwei Euro.","يوروان.",1],["Ich heiße Ali.","اسمي علي.",0],["Guten Tag.","نهارك سعيد.",0]],why:"السؤال عن السعر → السعر."},
{kap:"K4",a:"Was möchten Sie trinken?",aAr:"ماذا تريد أن تشرب؟",opts:[["Ich möchte einen Kaffee.","أريد قهوة.",1],["Ich wohne hier.","أسكن هنا.",0],["Heute ist Montag.","اليوم الاثنين.",0]],why:"الطلب بـ Ich möchte + Akkusativ."},
{kap:"K5",a:"Wann stehst du auf?",aAr:"متى تستيقظ؟",opts:[["Um sechs Uhr.","السادسة.",1],["Ich bin müde.","أنا متعب.",0],["Im Bett.","في السرير.",0]],why:"السؤال عن الوقت → الوقت."},
{kap:"K0",a:"Wie geht es dir?",aAr:"كيف حالك؟ (ردود دقيقة نحويًا لكن...)",
 opts:[["Mir geht es gut.","أنا بخير.",1],["Ich befinde mich in einem guten Zustand.","أنا في حالة جيدة.",0]],why:"الثانية صحيحة لغويًا لكنها غير طبيعية يوميًا — الأولى هي الرد الطبيعي.",natural:true},
{kap:"K4",a:"Schmeckt es dir?",aAr:"هل يعجبك الطعام؟",
 opts:[["Ja, sehr lecker!","نعم لذيذ جدًا!",1],["Das Essen besitzt einen guten Geschmack für mich.","الطعام يملك مذاقًا جيدًا لي.",0]],why:"الثانية مفهومة لكن مصطنعة — الطبيعي: lecker!",natural:true},
{kap:"K1",a:"Wo wohnst du?",aAr:"أين تسكن؟",
 opts:[["Ich wohne in Berlin.","أسكن في برلين.",1],["Mein Wohnort befindet sich in Berlin.","محل سكني يقع في برلين.",0]],why:"الثانية رسمية زائدة — الطبيعي: Ich wohne in ...",natural:true}
];
const SM_CTX=[
{kap:"K4",scene:"🥖 أنت في المخبز وتريد شراء خبز.",opts:[["Ich möchte ein Brot, bitte.","أريد خبزًا من فضلك.",1],["Wo ist die Schule?","أين المدرسة؟",0],["Ich bin zwanzig.","عمري عشرون.",0]],why:"في المخبز: طلب مهذب بـ möchte."},
{kap:"K5",scene:"🚆 أنت في المحطة وتريد تذكرة لبرلين.",opts:[["Eine Fahrkarte nach Berlin, bitte.","تذكرة لبرلين من فضلك.",1],["Ich habe Hunger.","أنا جائع.",0],["Wie spät ist es?","كم الساعة؟",0]],why:"طلب التذكرة: Fahrkarte + nach + مدينة."},
{kap:"K0",scene:"👋 تقابل صديقًا جديدًا صباحًا.",opts:[["Guten Morgen! Ich heiße Ali.","صباح الخير! اسمي علي.",1],["Gute Nacht!","مساء الخير!",0],["Tschüs!","سلام!",0]],why:"صباحًا: Guten Morgen + تعريف."},
{kap:"K3",scene:"🏙️ تسأل عن الطريق للمتحف.",opts:[["Wo ist das Museum?","أين المتحف؟",1],["Was kostet das?","كم سعره؟",0],["Ich wohne hier.","أسكن هنا.",0]],why:"السؤال عن المكان بـ Wo."},
{kap:"K1",scene:"☕ صديقك يسألك: Kaffee oder Tee?",opts:[["Einen Kaffee, bitte.","قهوة من فضلك.",1],["Ich bin Lehrer.","أنا مدرس.",0],["Nein.","لا.",0]],why:"أجب على السؤال مباشرة مع bitte."},
{kap:"K2",scene:"📞 تتصل بصديقك وهو نائم.",opts:[["Entschuldigung! Ich rufe später an.","عذرًا! سأتصل لاحقًا.",1],["Guten Appetit!","بالهناء!",0],["Tschüs!","سلام!",0]],why:"اعتذار + حل (later)."},
{kap:"K5",scene:"👨‍👩‍👧 تعرّف بعائلتك لجار جديد.",opts:[["Das ist meine Familie.","هذه عائلتي.",1],["Ich habe Hunger.","أنا جائع.",0],["Wo wohnst du?","أين تسكن؟",0]],why:"التعريف: Das ist meine Familie."},
{kap:"K4",scene:"🍽️ انتهيت من الأكل وتريد الحساب.",opts:[["Zahlen, bitte.","الحساب من فضلك.",1],["Es schmeckt gut.","طعمه جيد.",0],["Noch eins!","واحد آخر!",0]],why:"طلب الحساب: Zahlen, bitte."}
];
const SM_TF=[
{w:"Haus",art:"das",ar:"البيت",ok:true},{w:"Tisch",art:"der",ar:"الطاولة",ok:true},
{w:"Schule",art:"die",ar:"المدرسة",ok:true},{w:"Apfel",art:"der",ar:"التفاحة",ok:true},
{w:"Haus",art:"der",ar:"البيت",ok:false,why:"Haus محايد: das Haus."},
{w:"Tisch",art:"die",ar:"الطاولة",ok:false,why:"Tisch مذكر: der Tisch."},
{w:"Kind",art:"das",ar:"الطفل",ok:true},{w:"Kinder",art:"die",ar:"الأطفال",ok:true},
{w:"Milch",art:"die",ar:"اللبن",ok:true},{w:"Milch",art:"das",ar:"اللبن",ok:false,why:"Milch مؤنثة: die Milch."}
];
const SM_ODD=[
{words:["Apfel","Banane","Brot","laufen"],odd:3,why:"laufen فعل — الباقي طعام."},
{words:["Haus","Schule","Taxi","Buch"],odd:2,why:"Taxi وسيلة مواصلات — الباقي أماكن/أشياء ثابتة."},
{words:["der","die","das","und"],odd:3,why:"und حرف عطف — الباقي أدوات."},
{words:["Montag","Dienstag","Apfel","Freitag"],odd:2,why:"Apfel فاكهة — الباقي أيام."},
{words:["lernen","spielen","lesen","Tisch"],odd:3,why:"Tisch اسم — الباقي أفعال."},
{words:["Wasser","Milch","Kaffee","Stuhl"],odd:3,why:"Stuhl أثاث — الباقي مشروبات."},
{words:["groß","klein","schnell","Haus"],odd:3,why:"Haus اسم — الباقي صفات."},
{words:["ich","du","er","Tisch"],odd:3,why:"Tisch اسم — الباقي ضمائر."}
];
const SM_BUILD=[
{ar:"أنا أتعلم الألمانية.",words:["Ich","lerne","Deutsch"],extra:["spielt"]},
{ar:"الكتاب على الطاولة.",words:["Das","Buch","liegt","auf","dem","Tisch"],extra:["isst"]},
{ar:"هل تتكلم العربية؟",words:["Sprichst","du","Arabisch"],extra:["Haus"]},
{ar:"أنا من مصر.",words:["Ich","komme","aus","Ägypten"],extra:["wohne"]},
{ar:"أمي تطبخ جيدًا.",words:["Meine","Mutter","kocht","gut"],extra:["schnell"]},
{ar:"أين تسكن؟",words:["Wo","wohnst","du"],extra:["bist"]}
];
/* ---------- generators (pure; pools passed in) ---------- */
function smMkId(type,rid){return type+":"+rid;}
function smOptsRight(arr,correctPos){
  const order=arr.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=order[i];order[i]=order[j];order[j]=t;}
  return {opts:order.map(i=>arr[i]),correct:order.indexOf(correctPos)};
}
function gMcq(P){
  const pool=P.fills.filter(f=>f.o&&f.o.length>=3&&f.c>=0&&f.c<f.o.length);
  if(!pool.length)return null;
  const f=pool[Math.floor(Math.random()*pool.length)];
  const r=smOptsRight(f.o,f.c);
  const gt=f.grammarTarget||"general";
  const skill=/conjugation|modal|verb/.test(gt)?"verb":(/akkusativ|dativ|negation|preposition|article|possessiv/.test(gt)?"grammar":"grammar");
  return {id:smMkId("mcq",f.id),type:"mcq",skill:skill,level:f.lvl||"A1",kap:f.chapterId||"K0",difficulty:"medium",ui:"choice",
    prompt:String(f.s).replace("___","…"),promptAr:f.q||"",opts:r.opts,correct:r.correct,
    explain:"الصحيح: "+f.o[f.c]+" — "+(f.why||""),tags:["gap",gt],tpl:"mcq:"+gt,rid:f.id,
    blank:String(f.s||"")};
}
function gChips(P){
  const pool=P.fills.filter(f=>f.o&&f.o.length>=3&&f.c>=0&&f.c<f.o.length);
  if(!pool.length)return null;
  const f=pool[Math.floor(Math.random()*pool.length)];
  const r=smOptsRight(f.o,f.c);
  return {id:smMkId("chips",f.id),type:"chips",skill:"verb",level:f.lvl||"A1",kap:f.chapterId||"K0",difficulty:"medium",ui:"chips",
    prompt:String(f.s||""),promptAr:f.q||"",opts:r.opts,correct:r.opts[r.correct],
    explain:"الصحيح: "+f.o[f.c]+" — "+(f.why||""),tags:["gap","chips"],tpl:"chips:gap",rid:f.id,blank:String(f.s||"")};
}
function gOrder(P){
  if(!P.orders.length)return null;
  const f=P.orders[Math.floor(Math.random()*P.orders.length)];
  let words=(f.words||[]).slice();
  if(!words.length)return null;
  return {id:smMkId("order",f.id),type:"order",skill:"order",level:f.lvl||"A1",kap:f.chapterId||"K0",difficulty:"medium",ui:"order",
    prompt:f.q||"رتّب الجملة:",promptAr:"",words:words,correct:words.join(" "),
    explain:(f.s||words.join(" "))+" — "+(f.why||""),tags:["order",f.structureType||"gen"],tpl:"order:"+(f.structureType||"gen"),rid:f.id};
}
function gWrite(P){
  const pool=P.fills.filter(f=>f.o&&f.o.length>=2&&f.c>=0);
  if(!pool.length)return null;
  const f=pool[Math.floor(Math.random()*pool.length)];
  return {id:smMkId("write",f.id),type:"write",skill:"verb",level:f.lvl||"A1",kap:f.chapterId||"K0",difficulty:"hard",ui:"write",
    prompt:String(f.s||""),promptAr:f.q||"",accepts:[String(f.o[f.c]||"")],
    explain:"الصحيح: "+f.o[f.c]+" — "+(f.why||""),tags:["gap","write"],tpl:"write:gap",rid:f.id,blank:String(f.s||"")};
}
function gMatch(P){
  const pool=P.words.filter(w=>w.de&&w.ar&&/^[A-ZÄÖÜ]/.test(w.de));
  if(pool.length<3)return null;
  const picked=[];
  const cp=pool.slice();
  while(picked.length<3&&cp.length)picked.push(cp.splice(Math.floor(Math.random()*cp.length),1)[0]);
  if(picked.length<3)return null;
  return {id:smMkId("match",picked.map(w=>w.id).join("+")),type:"match",skill:"vocab",level:"A1",kap:picked[0].kap||"K0",difficulty:"medium",ui:"match",
    prompt:"وصّل كل كلمة بمعناها 🔗",promptAr:"",pairs:picked.map(w=>({de:smFullDe(w),ar:w.ar,id:w.id})),
    explain:picked.map(w=>smFullDe(w)+" = "+w.ar).join(" • "),tags:["match"],tpl:"match:vocab",rid:picked.map(w=>w.id).join("+")};
}
function gArticle(P){
  const pool=P.nouns;
  if(!pool.length)return null;
  const w=pool[Math.floor(Math.random()*pool.length)];
  const r=smOptsRight(["der","die","das"],["der","die","das"].indexOf(w.art));
  return {id:smMkId("article",w.id),type:"article",skill:"article",level:"A1",kap:w.kap||"K0",difficulty:"medium",ui:"choice",
    prompt:w.de,promptAr:w.ar+" — ما الأداة؟",opts:r.opts,correct:r.correct,
    explain:"الصحيح: "+w.art+" "+w.de+" = "+w.ar,tags:["article"],tpl:"article:noun",rid:w.id,word:w};
}
function gPlural(P){
  const pool=P.words.filter(w=>w.type==="اسم"&&w.plural&&/^[A-ZÄÖÜ]/.test(w.de));
  if(pool.length<2)return null;
  const w=pool[Math.floor(Math.random()*pool.length)];
  const rev=Math.random()<0.35;
  if(rev){
    const others=pool.filter(x=>x.id!==w.id).slice(0,3).map(x=>smFullDe(x));
    const arr=[smFullDe(w)].concat(others.slice(0,2));
    const r=smOptsRight(arr,0);
    return {id:smMkId("plural",w.id+"r"),type:"plural",skill:"plural",level:"A1",kap:w.kap||"K0",difficulty:"medium",ui:"choice",
      prompt:"«"+w.plural+"» — ما المفرد؟",promptAr:"",opts:r.opts,correct:r.correct,
      explain:"المفرد: "+smFullDe(w)+" • الجمع: "+w.plural,tags:["plural","rev"],tpl:"plural:rev",rid:w.id+"r",word:w};
  }
  const others=[];
  const cp=pool.filter(x=>x.id!==w.id&&x.plural!==w.plural);
  while(others.length<2&&cp.length)others.push(cp.splice(Math.floor(Math.random()*cp.length),1)[0].plural);
  while(others.length<2)others.push("die "+w.de+"e");
  const arr=[w.plural].concat(others);
  const r=smOptsRight(arr,0);
  return {id:smMkId("plural",w.id),type:"plural",skill:"plural",level:"A1",kap:w.kap||"K0",difficulty:"medium",ui:"choice",
    prompt:"ما جمع «"+smFullDe(w)+"»؟",promptAr:w.ar,opts:r.opts,correct:r.correct,
    explain:"الجمع: "+w.plural+" ("+w.ar+")",tags:["plural"],tpl:"plural:de",rid:w.id,word:w};
}
function gError(P){
  const items=(P.fills0||[]).filter(f=>f.kind==="error"&&f.o&&f.o.length>=2&&f.s);
  const fb=items.length?items[Math.floor(Math.random()*items.length)]:null;
  let wrong,sent,opts,why;
  if(fb){
    sent=fb.s;why=fb.why||"";
    wrong=fb.o.find(o=>smNorm(o)!==smNorm(sent))||fb.o[0];
    opts=fb.o.slice();
  }else{
    const pool=P.nouns.filter(w=>w.art==="das"||w.art==="die");
    if(!pool.length)return null;
    const w=pool[Math.floor(Math.random()*pool.length)];
    const badArt=w.art==="das"?"eine":"ein";
    wrong="Ich habe "+badArt+" "+w.de+".";sent="Ich habe "+(w.art==="das"?"ein":"eine")+" "+w.de+".";
    opts=[sent,wrong,"Ich habe "+w.de+"."];why="النكرة: das→ein / die→eine.";
  }
  const wt=smTok(wrong),st=smTok(sent);
  let badIx=-1;
  for(let i=0;i<wt.length;i++){if(wt[i]!==st[i]){badIx=i;break;}}
  if(badIx<0)return null;
  const r=smOptsRight(opts,opts.findIndex(o=>smNorm(o)===smNorm(sent)));
  return {id:smMkId("error",smNorm(wrong)),type:"error",skill:"grammar",level:"A1",kap:(fb&&fb.chapterId)||"K0",difficulty:"medium",ui:"error",
    prompt:"اكتشف الخطأ وصحّحه 🔍",promptAr:"اضغط على الكلمة الخاطئة أولًا.",wrongTokens:wt,badIx:badIx,opts:r.opts,correct:r.correct,
    explain:"الصحيح: "+sent+(why?" — "+why:""),tags:["error"],tpl:"error:fix",rid:smNorm(wrong)};
}
function gTf(P){
  const bank=(P.tf||[]).filter(t=>!P.kaps||!P.kaps.length||!t.kap||P.kaps.indexOf(t.kap)>=0);
  const src=bank.length?bank:SM_TF;
  if(!src.length)return null;
  const t=src[Math.floor(Math.random()*src.length)];
  return {id:smMkId("tf",t.w+t.art+(t.ok?"T":"F")),type:"tf",skill:"vocab",level:"A1",kap:t.kap||"K0",difficulty:"easy",ui:"choice",
    prompt:'"'+t.art+" "+t.w+'" = '+t.ar,promptAr:"صح أم خطأ؟",opts:["✅ صحيح","❌ خطأ"],correct:t.ok?0:1,
    explain:t.ok?"صحيح ✅ "+t.art+" "+t.w+" = "+t.ar:("❌ "+(t.why||"غير صحيح.")),tags:["tf"],tpl:"tf:vocab",rid:t.w+t.art};
}
function gTranslate(P){
  const pool=P.words.filter(w=>w.de&&w.ar&&w.de.split(" ").length<=3);
  if(!pool.length)return null;
  const w=pool[Math.floor(Math.random()*pool.length)];
  const acc=[smFullDe(w),w.de];
  return {id:smMkId("translate",w.id),type:"translate",skill:"translation",level:"A1",kap:w.kap||"K0",difficulty:"hard",ui:"write",
    prompt:w.ar,promptAr:"اكتب الترجمة الألمانية ✍️",accepts:acc,
    explain:"الترجمة: "+smFullDe(w)+" = "+w.ar,tags:["translate","ar-de"],tpl:"translate:ar-de",rid:w.id,word:w};
}
function gReverse(P){
  const pool=P.words.filter(w=>w.de&&w.ar);
  if(pool.length<4)return null;
  const w=pool[Math.floor(Math.random()*pool.length)];
  const de2ar=Math.random()<0.5;
  if(de2ar){
    const others=[];
    const cp=pool.filter(x=>x.id!==w.id&&x.ar!==w.ar);
    while(others.length<3&&cp.length)others.push(cp.splice(Math.floor(Math.random()*cp.length),1)[0].ar);
    if(others.length<3)return null;
    const r=smOptsRight([w.ar].concat(others),0);
    return {id:smMkId("reverse",w.id+"d"),type:"reverse",skill:"vocab",level:"A1",kap:w.kap||"K0",difficulty:"easy",ui:"choice",
      prompt:smFullDe(w),promptAr:"ما معناها؟",opts:r.opts,correct:r.correct,
      explain:smFullDe(w)+" = "+w.ar,tags:["reverse","de-ar"],tpl:"reverse:de-ar",rid:w.id+"d",word:w};
  }
  const others=[];
  const cp=pool.filter(x=>x.id!==w.id&&x.de!==w.de);
  while(others.length<3&&cp.length)others.push(cp.splice(Math.floor(Math.random()*cp.length),1)[0]);
  if(others.length<3)return null;
  const arr=[w].concat(others);
  const r=smOptsRight(arr.map(smFullDe),0);
  return {id:smMkId("reverse",w.id+"r"),type:"reverse",skill:"vocab",level:"A1",kap:w.kap||"K0",difficulty:"medium",ui:"choice",
    prompt:w.ar,promptAr:"اختر الكلمة الألمانية",opts:r.opts,correct:r.correct,
    explain:smFullDe(w)+" = "+w.ar,tags:["reverse","ar-de"],tpl:"reverse:ar-de",rid:w.id+"r",word:w};
}
function gListenChoice(P){
  const pool=P.words.filter(w=>w.de&&/^[A-Za-zÄÖÜäöüß]/.test(w.de));
  if(pool.length<3)return null;
  const w=pool[Math.floor(Math.random()*pool.length)];
  const others=[];
  const cp=pool.filter(x=>x.id!==w.id&&x.de!==w.de);
  while(others.length<2&&cp.length)others.push(cp.splice(Math.floor(Math.random()*cp.length),1)[0]);
  if(others.length<2)return null;
  const arr=[w].concat(others);
  const r=smOptsRight(arr.map(smFullDe),0);
  return {id:smMkId("listen_choice",w.id),type:"listen_choice",skill:"listening",level:"A1",kap:w.kap||"K0",difficulty:"medium",ui:"listen",
    prompt:"ماذا سمعت؟ 🎧",promptAr:"",opts:r.opts,correct:r.correct,audio:smFullDe(w),
    explain:"سمعت: "+smFullDe(w)+" = "+w.ar,tags:["listen","choice"],tpl:"listen:word",rid:w.id,word:w};
}
function gListenWrite(P){
  const pool=P.sents.filter(s=>s.de&&s.de.split(" ").length<=7);
  const src=pool.length?pool:(P.words.filter(w=>w.de&&w.de.split(" ").length===1).map(w=>({de:smFullDe(w),ar:w.ar,kap:w.kap})));
  if(!src.length)return null;
  const s=src[Math.floor(Math.random()*src.length)];
  return {id:smMkId("listen_write",smNorm(s.de)),type:"listen_write",skill:"listening",level:"A1",kap:s.kap||"K0",difficulty:"hard",ui:"listenwrite",
    prompt:"اكتب ما سمعته ✍️🎧",promptAr:"",accepts:[s.de],
    explain:"الصحيح: "+s.de+(s.ar?" = "+s.ar:""),tags:["listen","write"],tpl:"listen:write",rid:smNorm(s.de)};
}
function dlgPool(kaps){
  return SM_DLG.filter(d=>!kaps||!kaps.length||kaps.indexOf(d.kap)>=0);
}
function gDialogue(P){
  const pool=dlgPool(P.kaps).filter(d=>!d.natural);
  if(!pool.length)return null;
  const d=pool[Math.floor(Math.random()*pool.length)];
  const r=smOptsRight(d.opts.map(o=>o[0]),d.opts.findIndex(o=>o[2]));
  const subs=r.opts.map(txt=>{const f=d.opts.find(o=>o[0]===txt);return f?f[1]:"";});
  return {id:smMkId("dialogue",smNorm(d.a)),type:"dialogue",skill:"context",level:"A1",kap:d.kap,difficulty:"medium",ui:"choice",
    prompt:"A: "+d.a,promptAr:d.aAr+" — اختر رد B المناسب.",opts:r.opts,correct:r.correct,subs:subs,
    explain:"الرد: "+d.opts[d.opts.findIndex(o=>o[2])][0]+" — "+d.why,tags:["dialogue"],tpl:"dialogue:conv",
    rid:smNorm(d.a),why:d.why};
}
function gReply(P){
  const pool=dlgPool(P.kaps).filter(d=>d.natural);
  const src=pool.length?pool:dlgPool([]);
  if(!src.length)return null;
  const d=src[Math.floor(Math.random()*src.length)];
  const r=smOptsRight(d.opts.map(o=>o[0]),d.opts.findIndex(o=>o[2]));
  const subs=r.opts.map(txt=>{const f=d.opts.find(o=>o[0]===txt);return f?f[1]:"";});
  return {id:smMkId("reply",smNorm(d.a)),type:"reply",skill:"context",level:"A1",kap:d.kap,difficulty:"medium",ui:"choice",
    prompt:"A: "+d.a,promptAr:d.aAr+" — اختر الرد الطبيعي 🌿",opts:r.opts,correct:r.correct,subs:subs,
    explain:"الطبيعي: "+d.opts[d.opts.findIndex(o=>o[2])][0]+" — "+d.why,tags:["reply","natural"],tpl:"reply:natural",
    rid:smNorm(d.a),why:d.why,natural:true};
}
function ctxPool(kaps){
  return SM_CTX.filter(c=>!kaps||!kaps.length||kaps.indexOf(c.kap)>=0);
}
function gContext(P){
  const pool=ctxPool(P.kaps);
  if(!pool.length)return null;
  const c=pool[Math.floor(Math.random()*pool.length)];
  const r=smOptsRight(c.opts.map(o=>o[0]),c.opts.findIndex(o=>o[2]));
  const subs=r.opts.map(txt=>{const f=c.opts.find(o=>o[0]===txt);return f?f[1]:"";});
  return {id:smMkId("context",smNorm(c.scene)),type:"context",skill:"context",level:"A1",kap:c.kap,difficulty:"medium",ui:"choice",
    prompt:c.scene,promptAr:"ما الجملة المناسبة؟",opts:r.opts,correct:r.correct,subs:subs,
    explain:"المناسب: "+c.opts[c.opts.findIndex(o=>o[2])][0]+" — "+c.why,tags:["context","scene"],tpl:"context:sit",rid:smNorm(c.scene),why:c.why,scene:true};
}
function gImgWord(P){
  const pool=P.words.filter(w=>w.de&&w.ar&&/^[A-ZÄÖÜ]/.test(w.de));
  if(pool.length<3)return null;
  const w=pool[Math.floor(Math.random()*pool.length)];
  const others=[];
  const cp=pool.filter(x=>x.id!==w.id);
  while(others.length<2&&cp.length)others.push(cp.splice(Math.floor(Math.random()*cp.length),1)[0]);
  if(others.length<2)return null;
  const arr=[w].concat(others);
  const r=smOptsRight(arr.map(smFullDe),0);
  return {id:smMkId("img_word",w.id),type:"img_word",skill:"vocab",level:"A1",kap:w.kap||"K0",difficulty:"easy",ui:"choice",
    prompt:"ما هذه الصورة؟ 🖼️",promptAr:"",opts:r.opts,correct:r.correct,image:smImgFor(w),emoji:smEmoji(w),
    explain:smFullDe(w)+" = "+w.ar,tags:["image"],tpl:"img:word",rid:w.id,word:w};
}
function gWordImg(P){
  const pool=P.words.filter(w=>w.de&&w.ar&&/^[A-ZÄÖÜ]/.test(w.de));
  if(pool.length<3)return null;
  const w=pool[Math.floor(Math.random()*pool.length)];
  const others=[];
  const cp=pool.filter(x=>x.id!==w.id);
  while(others.length<2&&cp.length)others.push(cp.splice(Math.floor(Math.random()*cp.length),1)[0]);
  if(others.length<2)return null;
  const arr=[w].concat(others);
  const r=smOptsRight(arr,0);
  return {id:smMkId("word_img",w.id),type:"word_img",skill:"vocab",level:"A1",kap:w.kap||"K0",difficulty:"easy",ui:"choice",
    prompt:smFullDe(w),promptAr:"اختر الصورة الصحيحة 🖼️",
    opts:r.opts.map(x=>({de:smFullDe(x),image:smImgFor(x),emoji:smEmoji(x),ar:x.ar})),correct:r.correct,
    explain:smFullDe(w)+" = "+w.ar,tags:["image","rev"],tpl:"img:rev",rid:w.id,word:w,imgOpts:true};
}
function gOdd(P){
  const bank=(P.odd||[]).length?P.odd:SM_ODD;
  if(!bank.length)return null;
  const s=bank[Math.floor(Math.random()*bank.length)];
  const r=smOptsRight(s.words,s.odd);
  return {id:smMkId("odd",s.words.join("|")),type:"odd",skill:"vocab",level:"A1",kap:"K0",difficulty:"medium",ui:"choice",
    prompt:"اختر الكلمة المختلفة 🧐",promptAr:"",opts:r.opts,correct:r.correct,
    explain:"المختلفة: "+s.words[s.odd]+" — "+s.why,tags:["odd"],tpl:"odd:cat",rid:s.words.join("|"),why:s.why};
}
function gBuild(P){
  const bank=(P.build||[]).length?P.build:SM_BUILD;
  if(!bank.length)return null;
  const b=bank[Math.floor(Math.random()*bank.length)];
  let words=b.words.slice();
  if(b.extra&&b.extra.length)words=words.concat([b.extra[Math.floor(Math.random()*b.extra.length)]]);
  return {id:smMkId("build",smNorm(b.ar)),type:"build",skill:"order",level:"A1",kap:"K0",difficulty:"medium",ui:"order",
    prompt:"ابنِ الجملة الألمانية 🧩",promptAr:b.ar,words:words,correct:b.words.join(" "),
    explain:b.words.join(" ")+" = "+b.ar,tags:["build","meaning"],tpl:"build:meaning",rid:smNorm(b.ar)};
}
const SM_GEN={mcq:gMcq,chips:gChips,order:gOrder,write:gWrite,match:gMatch,article:gArticle,plural:gPlural,error:gError,tf:gTf,translate:gTranslate,reverse:gReverse,listen_choice:gListenChoice,listen_write:gListenWrite,dialogue:gDialogue,reply:gReply,context:gContext,img_word:gImgWord,word_img:gWordImg,odd:gOdd,build:gBuild};
/* difficulty: hard converts choice UI to writing (no options/hints) */
const SM_HARD_WRITABLE={mcq:1,chips:1,article:1,plural:1,reverse:1,dialogue:1,reply:1,context:1,listen_choice:1,img_word:1};
function smApplyDifficulty(q,level){
  if(!q)return null;
  q.difficulty=level;
  if(level==="easy"){
    if(q.ui==="choice"&&q.opts.length>3){const keep=[q.opts[q.correct]];const rest=q.opts.filter((_,i)=>i!==q.correct);q.opts=[keep[0]].concat(rest.slice(0,2));q.correct=0;const r=smOptsRight(q.opts,0);q.opts=r.opts;q.correct=r.correct;}
    if(q.type==="order"||q.type==="build")q.hint="أول كلمة: "+q.words[0];
    if(q.ui==="write"&&q.accepts)q.hint="تبدأ بـ: "+q.accepts[0].split(" ")[0]+" ...";
    return q;
  }
  if(level==="hard"){
    if(SM_HARD_WRITABLE[q.type]){
      const ansText=q.imgOpts?q.opts[q.correct].de:q.opts[q.correct];
      return {id:q.id+"h",type:"write",skill:q.skill,level:q.level,kap:q.kap,difficulty:"hard",ui:"write",
        prompt:q.promptAr&&q.type!=="reverse"?q.promptAr:q.prompt,promptAr:q.type!=="reverse"?q.prompt:"",
        accepts:[String(ansText)],explain:q.explain,tags:q.tags.concat(["hard-write"]),tpl:q.tpl+":hard",rid:q.rid+"h",
        blank:q.blank||"",fromType:q.type};
    }
    if(q.type==="order"||q.type==="build"){
      const extra=q.type==="order"?"und":"der";
      if(q.words.indexOf(extra)<0)q.words=q.words.concat([extra]);
    }
    return q;
  }
  return q;
}
/* ---------- checking (pure) ---------- */
function smCheck(q,ans){
  if(!q)return {ok:false,fb:"سؤال غير صالح."};
  const normA=typeof ans==="string"?smNorm(ans):ans;
  switch(q.type){
    case "mcq":case "article":case "plural":case "tf":case "reverse":
    case "dialogue":case "reply":case "context":case "img_word":case "odd":
    case "listen_choice":case "word_img":
      return {ok:ans===q.correct,fb:""};
    case "chips":
      return {ok:smNorm(ans)===smNorm(q.correct),fb:""};
    case "write":case "translate":case "listen_write":
      return {ok:(q.accepts||[]).some(a=>smNorm(a)===normA),fb:""};
    case "order":case "build":{
      const exp=q.words.map((_,k)=>k);
      const ok=Array.isArray(ans)&&ans.length===exp.length&&ans.every((v,ix)=>v===ix);
      return {ok:ok,fb:""};
    }
    case "error":
      if(ans&&typeof ans==="object"&&ans.step===1)return {ok:ans.ix===q.badIx,fb:""};
      return {ok:ans===q.correct,fb:""};
    case "match":{
      if(!ans||typeof ans!=="object")return {ok:false,fb:""};
      const pairs=q.pairs;
      let okN=0;
      pairs.forEach((p,li)=>{
        const want=pairs.findIndex(x=>x.id===p.id);
        if(ans[li]===want)okN++;
      });
      return {ok:okN===pairs.length,fb:"",partial:okN/pairs.length};
    }
    default:return {ok:false,fb:""};
  }
}
/* per-skill feedback (pure) */
function smFeedback(skill,q,ok,ansText){
  if(ok)return "✅ صحيح! "+(q.explain||"");
  const picked=typeof ansText==="string"?ansText:"";
  switch(skill){
    case "article":
      return "❌ الصحيح: "+(q.explain||"");
    case "plural":
      return "❌ "+(q.explain||"راجع الجمع.");
    case "order":
      return "❌ الترتيب الصحيح: "+(q.correct||"")+" — تذكّر: الفعل في المركز الثاني.";
    case "verb":
      return "❌ "+(q.explain||"راجع تصريف الفعل.");
    case "translation":
      return "❌ انتبه لترتيب الكلمات. الصحيح: "+(q.explain||"");
    case "context":
      return q.natural?"⚠️ إجابتك صحيحة لغويًا، لكنها ليست الرد الطبيعي في هذا الموقف. "+(q.explain||""):"❌ "+(q.explain||"");
    case "listening":
      return "❌ "+(q.explain||"استمع مجددًا وحاول.");
    default:
      return "❌ "+(q.explain||"إجابة غير صحيحة.");
  }
}
/* ---------- adaptive weights + session builder (pure) ---------- */
function smSkillWeight(skill,acc,mistN){
  const a=(acc&&acc[skill])||{n:0,ok:0};
  const err=a.n>0?1-a.ok/a.n:0.35;
  return 0.6+err*3+(mistN||0)*0.8;
}
function smPickWeighted(weights,rnd){
  const r=rnd||Math.random;
  let tot=0;weights.forEach(w=>{tot+=w.w;});
  let x=r()*tot;
  for(let i=0;i<weights.length;i++){x-=weights[i].w;if(x<=0)return weights[i].k;}
  return weights[weights.length-1].k;
}
function smValidateQ(q){
  if(!q||!q.id||!q.type||!q.skill||!q.ui)return false;
  if(SM_TYPES.indexOf(q.type)<0||SM_SKILLS.indexOf(q.skill)<0)return false;
  if(q.ui==="choice"||q.type==="listen_choice"){
    if(!q.opts||q.opts.length<2||q.correct<0||q.correct>=q.opts.length)return false;
  }
  if(q.ui==="write"||q.type==="translate"||q.type==="listen_write"){
    if(!q.accepts||!q.accepts.length)return false;
  }
  if(q.ui==="order"||q.type==="build"){
    if(!q.words||q.words.length<2||!q.correct)return false;
  }
  if(q.type==="match"){
    if(!q.pairs||q.pairs.length<2)return false;
  }
  if(q.type==="error"){
    if(!q.wrongTokens||q.badIx<0||!q.opts||q.opts.length<2)return false;
  }
  return true;
}
/* pools: {words,fills,fills0,orders,nouns,sents,tf,odd,build,kaps}
   adapt: {acc, mistSkills, recent:[{qid,tpl,word}], difficulty, level} */
function smBuildSession(n,pools,adapt){
  const out=[];const usedQids={};const usedTplPair={};
  (adapt.recent||[]).forEach(r=>{if(r.qid)usedQids[r.qid]=1;});
  const lastTypes=[];let guard=0;
  const allT=SM_TYPES.slice();
  while(out.length<n&&guard++<n*40){
    /* skill by adaptive weight */
    const skW=SM_SKILLS.map(s=>({k:s,w:smSkillWeight(s,(adapt.acc||{})[s],(adapt.mistSkills||{})[s]||0)}));
    const skill=smPickWeighted(skW);
    /* type rotation: exclude last two types */
    const banned={};lastTypes.slice(-2).forEach(t=>{banned[t]=1;});
    let cands=allT.filter(t=>!banned[t]&&SM_TYPE_SKILL[t]===skill);
    if(!cands.length)cands=allT.filter(t=>!banned[t]);
    if(!cands.length)cands=allT.slice();
    const type=cands[Math.floor(Math.random()*cands.length)];
    const gen=SM_GEN[type];
    if(!gen)continue;
    let q=null;
    try{q=gen(pools);}catch(e){q=null;}
    if(!q||!smValidateQ(q))continue;
    if(usedQids[q.id])continue;
    if(usedTplPair[q.tpl])continue;
    /* difficulty */
    let diff=adapt.difficulty||"adaptive";
    if(diff==="adaptive"){
      const a=((adapt.acc||{})[q.skill])||{n:0,ok:0};
      const rate=a.n>0?a.ok/a.n:0.6;
      diff=rate<0.5?"easy":(rate<0.8?"medium":"hard");
    }
    try{q=smApplyDifficulty(q,diff);}catch(e){continue;}
    if(!q||!smValidateQ(q))continue;
    if(usedQids[q.id])continue;
    usedQids[q.id]=1;usedTplPair[q.tpl]=1;
    lastTypes.push(q.type);
    out.push(q);
  }
  return {qs:out,lastTypes:lastTypes};
}

/* ================= RENDERERS (browser) ================= */
var SM={kaps:[],difficulty:"adaptive",qs:[],idx:0,score:0,results:[],runAcc:{},active:false,forceSkill:null};
function smEnsure(){
  if(!S.smart)S.smart={acc:{},recent:[],runs:0,last:null};
  if(!S.smart.acc)S.smart.acc={};
  if(!S.smart.recent)S.smart.recent=[];
  return S.smart;
}
function smKapName(id){
  try{
    if(typeof KAPITEL!=="undefined"){
      const k=KAPITEL.find(x=>x.id===id);
      if(k)return (k.icon||"")+" "+k.name;
    }
  }catch(e){}
  return id;
}
function smSkillAr(s){
  return {vocab:"📚 مفردات",article:"🎯 أدوات",plural:"👥 جمع",verb:"⚡ أفعال",grammar:"📐 قواعد",order:"🧩 ترتيب",listening:"🎧 استماع",translation:"🔄 ترجمة",context:"💬 تواصل"}[s]||s;
}
function smTypeAr(t){
  return {mcq:"اختيار",chips:"كلمات",order:"ترتيب",write:"كتابة",match:"توصيل",article:"أداة",plural:"جمع",error:"خطأ",tf:"صح/خطأ",translate:"ترجمة",reverse:"عكس",listen_choice:"استماع",listen_write:"إملاء",dialogue:"حوار",reply:"رد طبيعي",context:"موقف",img_word:"صورة",word_img:"عكس-صورة",odd:"مختلف",build:"بناء"}[t]||t;
}
/* ---------- home ---------- */
function renderSmartNew(){
  if(SM.active&&SM.idx<SM.qs.length){smQ();return;}
  SM.active=false;
  const box=$("practiceBox");if(!box)return;
  smEnsure();
  const acc=S.smart.acc;
  const weak=SM_SKILLS.map(s=>({s:s,n:(acc[s]||{n:0}).n,ok:(acc[s]||{ok:0}).ok}))
    .filter(x=>x.n>0).sort((a,b)=>(1-b.ok/Math.max(1,b.n))-(1-a.ok/Math.max(1,a.n)));
  const last=S.smart.last;
  let h='<div class="panel glass"><h3>🎯 تدريب ذكي — محرك متنوع</h3>'
    +'<div class="muted">20 نوع سؤال • صعوبة تدريجية • يتكيف مع أخطائك • الجلسة 10 أسئلة</div>'
    +'<div class="row-flex"><label><span>الصعوبة:</span> <select id="smDiff"><option value="adaptive">🧠 تكيفية (موصى بها)</option><option value="easy">🟢 سهلة</option><option value="medium">🟡 متوسطة</option><option value="hard">🔴 صعبة</option></select></label></div>'
    +'<div class="muted">الكبيتلات:</div><div class="row-flex" style="flex-wrap:wrap">'
    +["K0","K1","K2","K3","K4","K5"].map(k=>'<label style="display:flex;gap:6px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px 12px"><input type="checkbox" data-smkap="'+k+'" checked> '+k+'</label>').join("")
    +'</div><div class="row-flex"><button class="btn btn-primary sm" id="smStart">ابدأ الجلسة 🚀</button></div>'
    +(weak.length?'<div class="muted">⚠️ نقاط ضعفك: '+weak.slice(0,3).map(w=>smSkillAr(w.s)+" ("+Math.round(100*w.ok/Math.max(1,w.n))+"%)").join(" • ")+'</div>':"")
    +(last?'<div class="muted">آخر جلسة: '+last.score+'/'+last.total+' ('+last.pct+'%) • '+last.date+'</div>':"")
    +'</div><div id="smRun"></div>';
  box.innerHTML=h;
  $("smDiff").value=SM.difficulty;
  $("smDiff").addEventListener("change",()=>{SM.difficulty=$("smDiff").value;});
  $("smStart").addEventListener("click",()=>{
    const sel=Array.from(box.querySelectorAll("[data-smkap]:checked")).map(x=>x.getAttribute("data-smkap"));
    if(!sel.length){toast("اختر كابيتيل واحدًا على الأقل ⚠️","err");return;}
    smStart(sel,SM.difficulty,null);
  });
}
/* ---------- session ---------- */
function smPools(kaps){
  return {
    words:smAllWords(kaps,"A1"),
    fills:smFills(kaps),
    fills0:(function(){try{if(typeof SENT_FILL==="undefined")return [];return SENT_FILL.filter(f=>!kaps||!kaps.length||kaps.indexOf(f.chapterId)>=0);}catch(e){return [];}})(),
    orders:smOrders(kaps),
    nouns:smNouns(kaps),
    sents:smSents("A1"),
    tf:SM_TF.slice(),odd:SM_ODD.slice(),build:SM_BUILD.slice(),
    kaps:kaps||[]
  };
}
function smMistSkills(){
  const m={};
  try{
    Object.keys(S.mistakes||{}).forEach(id=>{
      const k=String((S.mistakes[id]||{}).kind||"");
      if(k.indexOf("sm-")===0){const s=k.slice(3);m[s]=(m[s]||0)+S.mistakes[id].n;}
    });
    Object.keys(S.gweak||{}).forEach(g=>{m.grammar=(m.grammar||0)+S.gweak[g];m.order=(m.order||0)+Math.floor(S.gweak[g]/2);});
  }catch(e){}
  return m;
}
function smStart(kaps,difficulty,forceSkill){
  smEnsure();
  const pools=smPools(kaps);
  const adapt={acc:S.smart.acc,mistSkills:smMistSkills(),recent:S.smart.recent,difficulty:difficulty||"adaptive"};
  let built=smBuildSession(10,pools,adapt);
  if(forceSkill){
    /* drill weakest: rebuild forcing one skill, keep variety of types */
    const keep=built.qs.filter(q=>q.skill===forceSkill);
    built={qs:keep.length>=4?keep.slice(0,10):built.qs,lastTypes:built.lastTypes};
  }
  if(!built.qs.length){
    const run=$("smRun")||$("practiceBox");
    if(run)run.innerHTML='<div class="panel glass">تعذّر بناء الجلسة — غيّر الكبيتلات وحاول 🔁<div class="row-flex"><button class="btn btn-primary sm" id="smBack">رجوع ←</button></div></div>';
    const b=$("smBack");if(b)b.addEventListener("click",()=>{SM.active=false;renderSmartNew();});
    return;
  }
  SM.kaps=kaps;SM.qs=built.qs;SM.idx=0;SM.score=0;SM.results=[];SM.runAcc={};SM.active=true;SM.forceSkill=forceSkill||null;
  /* register shown qids immediately (anti-repeat across runs) */
  try{
    built.qs.forEach(q=>{S.smart.recent.push({qid:q.id,tpl:q.tpl});});
    S.smart.recent=S.smart.recent.slice(-40);save();
  }catch(e){}
  smQ();
  const run=$("smRun");if(run)run.scrollIntoView({behavior:"smooth"});
}
function smShell(q){
  return '<div class="panel glass"><div class="quiz-top"><span>'+(SM.idx+1)+' / '+SM.qs.length+'</span>'
    +'<div class="progress"><div class="progress-fill" style="width:'+(SM.idx/SM.qs.length*100)+'%"></div></div>'
    +'<span>✅ '+SM.score+'</span></div>'
    +'<div class="muted">'+smSkillAr(q.skill)+' • '+smTypeAr(q.type)+' • '+(q.difficulty==="easy"?"🟢":q.difficulty==="hard"?"🔴":"🟡")+(q.kap?" • "+q.kap:"")+'</div>'
    +'<div id="smBody"></div><div class="quiz-feedback hidden" id="smFb"></div>'
    +'<div class="row-flex"><button class="btn btn-primary" id="smNext" disabled>التالي ⏭</button>'
    +'<button class="btn btn-ghost" id="smQuit">إنهاء ✖</button></div></div>';
}
function smQ(){
  const host=$("smRun")||$("practiceBox");if(!host)return;
  const q=SM.qs[SM.idx];
  if(!q){smFinish();return;}
  host.innerHTML=smShell(q);
  $("smQuit").addEventListener("click",()=>{smFinish(true);});
  const body=$("smBody");
  try{
    if(q.ui==="choice"||q.ui==="listen")smUiChoice(body,q);
    else if(q.ui==="chips")smUiChips(body,q);
    else if(q.ui==="order")smUiOrder(body,q);
    else if(q.ui==="write"||q.ui==="listenwrite")smUiWrite(body,q);
    else if(q.ui==="match")smUiMatch(body,q);
    else if(q.ui==="error")smUiError(body,q);
    else smUiChoice(body,q);
  }catch(e){console.error(e);body.innerHTML='<div class="muted">تعذّر عرض السؤال — تخطَّ للتالي ⏭</div>';$("smNext").disabled=false;$("smNext").addEventListener("click",()=>{SM.idx++;smQ();},{once:true});}
}
function smPromptHtml(q){
  let h="";
  if(q.scene)h+='<div class="sm-scene">'+escapeHtml(q.prompt)+'</div>';
  else if(q.type==="article")h+='<h3 dir="ltr" style="text-align:center;font-size:34px">'+escapeHtml(q.prompt)+'</h3>';
  else if(q.type==="img_word")h+='<div class="muted" style="text-align:center">'+escapeHtml(q.prompt)+'</div><div class="sm-img-big">'+(q.image?'<img src="'+q.image+'" alt="" class="word-img">':'<div style="font-size:64px">'+escapeHtml(q.emoji||"🖼️")+'</div>')+'</div>';
  else if(q.type==="reverse"&&q.word)h+='<h3 dir="ltr" style="text-align:center;font-size:30px">'+escapeHtml(q.prompt)+'</h3>';
  else if(q.blank&&q.blank.indexOf("___")>=0)h+='<h3 class="fill-sent" dir="ltr" style="text-align:left">'+escapeHtml(q.blank).replace("___","______")+'</h3>';
  else if(/[\u0600-\u06FF]/.test(q.prompt))h+='<h3>'+escapeHtml(q.prompt)+'</h3>';
  else h+='<h3 dir="ltr" style="text-align:left">'+escapeHtml(q.prompt)+'</h3>';
  if(q.promptAr)h+='<div class="muted">'+escapeHtml(q.promptAr)+'</div>';
  if(q.hint)h+='<div class="muted">💡 '+escapeHtml(q.hint)+'</div>';
  return h;
}
/* --- UI: choice family (mcq/reverse/dialogue/reply/context/tf/article/plural/odd/img/listen-choice) --- */
function smUiChoice(body,q){
  let h=smPromptHtml(q);
  if(q.ui==="listen"){
    h+='<div class="row-flex" style="justify-content:center"><button class="btn btn-primary" id="smHear" style="font-size:28px;padding:16px 28px">🔊</button>'
      +'<button class="btn btn-ghost sm" id="smHear2">إعادة 🔊</button></div>';
  }
  h+='<div class="quiz-opts" dir="ltr" id="smOpts">'
    +q.opts.map((o,j)=>{
      if(q.imgOpts)return '<button class="quiz-opt" data-j="'+j+'"><div style="font-size:44px">'+(o.image?'<img src="'+o.image+'" alt="" style="max-height:64px;border-radius:8px">':escapeHtml(o.emoji||"🖼️"))+'</div><div class="muted">'+escapeHtml(o.ar||"")+'</div></button>';
      const sub=(q.subs&&q.subs[j])?'<br><span class="muted">'+escapeHtml(q.subs[j])+'</span>':"";
      return '<button class="quiz-opt" data-j="'+j+'" dir="auto">'+escapeHtml(String(o))+sub+'</button>';
    }).join("")+'</div>';
  body.innerHTML=h;
  if(q.ui==="listen"){
    const play=()=>{try{speakGerman(q.audio);}catch(e){}};
    $("smHear").addEventListener("click",play);
    $("smHear2").addEventListener("click",play);
    setTimeout(play,350);
  }
  body.querySelectorAll("#smOpts .quiz-opt").forEach(b=>b.addEventListener("click",()=>{
    const j=parseInt(b.getAttribute("data-j"),10);
    body.querySelectorAll("#smOpts .quiz-opt").forEach(x=>{x.disabled=true;});
    const r=smCheck(q,j);
    if(r.ok)b.classList.add("correct");
    else{b.classList.add("wrong");const all=body.querySelectorAll("#smOpts .quiz-opt");if(all[q.correct])all[q.correct].classList.add("correct");}
    smGrade(q,r.ok,String(q.imgOpts?(q.opts[j]&&q.opts[j].de):q.opts[j]));
  }));
}
/* --- UI: chips fill --- */
function smUiChips(body,q){
  body.innerHTML=smPromptHtml(q)
    +'<div class="sm-answer" id="smSlot" dir="ltr">… ؟</div>'
    +'<div class="sm-chip-row" dir="ltr" id="smChips">'
    +q.opts.map((o,j)=>'<button class="order-chip" data-j="'+j+'">'+escapeHtml(o)+'</button>').join("")+'</div>'
    +'<div class="row-flex"><button class="btn btn-gold sm" id="smOk">تحقق ✅</button><button class="btn btn-ghost sm" id="smClr">مسح</button></div>';
  let picked=null;
  body.querySelectorAll("#smChips .order-chip").forEach(b=>b.addEventListener("click",()=>{
    body.querySelectorAll("#smChips .order-chip").forEach(x=>{x.disabled=false;});
    b.disabled=true;picked=b.textContent;
    $("smSlot").textContent=String(q.blank||"").replace("___",picked);
  }));
  $("smClr").addEventListener("click",()=>{picked=null;$("smSlot").textContent="… ؟";body.querySelectorAll("#smChips .order-chip").forEach(x=>{x.disabled=false;});});
  $("smOk").addEventListener("click",()=>{
    if(picked==null){toast("اختر كلمة أولًا 👆","err");return;}
    const r=smCheck(q,picked);
    smGrade(q,r.ok,picked);
  });
}
/* --- UI: order / build --- */
function smUiOrder(body,q){
  const sh=q.words.map((_,k)=>k);
  for(let i=sh.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=sh[i];sh[i]=sh[j];sh[j]=t;}
  body.innerHTML=smPromptHtml(q)
    +'<div class="quiz-opts" dir="ltr">'+sh.map(k=>'<button class="quiz-opt" data-k="'+k+'">'+escapeHtml(q.words[k])+'</button>').join("")+'</div>'
    +'<div class="quiz-opts" dir="ltr" id="smAns" style="min-height:52px;border:1px dashed var(--border);border-radius:12px"></div>'
    +'<div class="row-flex"><button class="btn btn-gold sm" id="smOk">تحقق ✅</button><button class="btn btn-ghost sm" id="smClr">مسح</button></div>';
  const picked=[];
  body.querySelectorAll(".quiz-opt[data-k]").forEach(b=>b.addEventListener("click",()=>{
    if(b.disabled)return;b.disabled=true;
    const k=parseInt(b.getAttribute("data-k"),10);picked.push(k);
    const a=$("smAns");const s=document.createElement("span");s.className="order-chip";s.textContent=q.words[k];a.appendChild(s);
  }));
  $("smClr").addEventListener("click",()=>{picked.length=0;$("smAns").innerHTML="";body.querySelectorAll(".quiz-opt[data-k]").forEach(x=>{x.disabled=false;});});
  $("smOk").addEventListener("click",()=>{
    const r=smCheck(q,picked);
    smGrade(q,r.ok,picked.map(k=>q.words[k]).join(" "));
  });
}
/* --- UI: write family --- */
function smUiWrite(body,q){
  const listen=q.ui==="listenwrite";
  let h=smPromptHtml(q);
  if(listen)h+='<div class="row-flex" style="justify-content:center"><button class="btn btn-primary" id="smHear" style="font-size:28px;padding:16px 28px">🔊</button><button class="btn btn-ghost sm" id="smHear2">إعادة 🔊</button></div>';
  h+='<div class="quiz-write"><input type="text" id="smIn" dir="ltr" autocomplete="off" placeholder="..."><button class="btn btn-primary sm" id="smOk">تحقق ✅</button></div>';
  body.innerHTML=h;
  if(listen){
    const play=()=>{try{speakGerman(q.accepts[0]);}catch(e){}};
    $("smHear").addEventListener("click",play);
    $("smHear2").addEventListener("click",play);
    setTimeout(play,350);
  }
  const go=()=>{
    const v=$("smIn").value;
    if(!v.trim()){toast("اكتب إجابتك أولًا ✍️","err");return;}
    const r=smCheck(q,v);
    smGrade(q,r.ok,v.trim());
  };
  $("smOk").addEventListener("click",go);
  $("smIn").addEventListener("keydown",e=>{if(e.key==="Enter")go();});
}
/* --- UI: match (two columns) --- */
function smUiMatch(body,q){
  const left=q.pairs.map((p,i)=>({p:p,i:i}));
  const right=smShuffle(q.pairs.map((p,i)=>i));
  body.innerHTML=smPromptHtml(q)
    +'<div class="sm-match-cols" dir="ltr"><div id="smL">'
    +left.map(o=>'<button class="quiz-opt" data-li="'+o.i+'">'+escapeHtml(o.p.de)+'</button>').join("")
    +'</div><div id="smR">'
    +right.map(ri=>'<button class="quiz-opt" data-ri="'+ri+'">'+escapeHtml(q.pairs[ri].ar)+'</button>').join("")
    +'</div></div><div class="muted" id="smPairs">0 / '+q.pairs.length+'</div>';
  let selL=null;const done={};let mistakes=0;
  const refresh=()=>{$("smPairs").textContent=Object.keys(done).length+" / "+q.pairs.length;};
  body.querySelectorAll("#smL .quiz-opt").forEach(b=>b.addEventListener("click",()=>{
    const li=parseInt(b.getAttribute("data-li"),10);
    if(done[li])return;
    body.querySelectorAll("#smL .quiz-opt").forEach(x=>{x.classList.remove("correct");});
    b.classList.add("correct");selL=li;
  }));
  body.querySelectorAll("#smR .quiz-opt").forEach(b=>b.addEventListener("click",()=>{
    if(selL==null){toast("اختر كلمة من العمود الأيمن أولًا 👆","err");return;}
    const ri=parseInt(b.getAttribute("data-ri"),10);
    if(q.pairs[selL].id===q.pairs[ri].id){
      done[selL]=ri;b.disabled=true;
      const lb=body.querySelectorAll("#smL .quiz-opt")[selL];if(lb){lb.disabled=true;}
      b.classList.add("correct");selL=null;refresh();
      if(Object.keys(done).length===q.pairs.length){
        const map={};Object.keys(done).forEach(k=>{map[k]=done[k];});
        const r=smCheck(q,map);
        smGrade(q,r.ok&&mistakes===0,q.pairs.map(p=>p.de+"="+p.ar).join(" "));
      }
    }else{
      mistakes++;b.classList.add("wrong");
      setTimeout(()=>{try{b.classList.remove("wrong");}catch(e){}},700);
      toast("ليست مطابقة — حاول مجددًا 🔗","err");
    }
  }));
}
/* --- UI: error detect (2 steps) --- */
function smUiError(body,q){
  body.innerHTML=smPromptHtml(q)
    +'<div class="muted">1️⃣ اضغط الكلمة الخاطئة:</div>'
    +'<div class="sm-chip-row" dir="ltr" id="smToks">'
    +q.wrongTokens.map((t,i)=>'<button class="order-chip" data-i="'+i+'">'+escapeHtml(t)+'</button>').join("")+'</div>'
    +'<div id="smStep2"></div>';
  body.querySelectorAll("#smToks .order-chip").forEach(b=>b.addEventListener("click",()=>{
    const ix=parseInt(b.getAttribute("data-i"),10);
    const r=smCheck(q,{step:1,ix:ix});
    if(!r.ok){b.classList.add("wrong");toast("ليست هذه الكلمة — انظر بتمعّن 🔍","err");return;}
    b.classList.add("correct");
    body.querySelectorAll("#smToks .order-chip").forEach(x=>{x.disabled=true;});
    const s2=$("smStep2");
    s2.innerHTML='<div class="muted">2️⃣ اختر التصحيح:</div><div class="quiz-opts" dir="ltr">'
      +q.opts.map((o,j)=>'<button class="quiz-opt" data-j="'+j+'" dir="ltr">'+escapeHtml(o)+'</button>').join("")+'</div>';
    s2.querySelectorAll(".quiz-opt").forEach(x=>x.addEventListener("click",()=>{
      const j=parseInt(x.getAttribute("data-j"),10);
      s2.querySelectorAll(".quiz-opt").forEach(y=>{y.disabled=true;});
      const r2=smCheck(q,j);
      if(r2.ok)x.classList.add("correct");
      else{x.classList.add("wrong");const all=s2.querySelectorAll(".quiz-opt");if(all[q.correct])all[q.correct].classList.add("correct");}
      smGrade(q,r2.ok,q.opts[j]);
    }));
  }));
}
/* ---------- grading ---------- */
function smGrade(q,ok,pickedStr){
  const fb=$("smFb");if(!fb)return;
  SM.score+=ok?1:0;
  try{S.totalCorrect+=ok?1:0;S.totalAnswered++;}catch(e){}
  try{
    smEnsure();
    const a=S.smart.acc[q.skill]||(S.smart.acc[q.skill]={n:0,ok:0});
    a.n++;if(ok)a.ok++;
    if(!ok&&q.word)recordMistake(q.word,String(pickedStr==null?"":pickedStr),"sm-"+q.skill);
    save();
  }catch(e){}
  SM.results.push({ok:ok,skill:q.skill,type:q.type,q:q});
  fb.classList.remove("hidden");
  fb.className="quiz-feedback "+(ok?"ok":"no");
  fb.innerHTML=smFeedback(q.skill,q,ok,pickedStr);
  try{
    const shell=fb.parentNode;
    if(shell)shell.querySelectorAll(".quiz-opt,.order-chip").forEach(x=>{try{x.disabled=true;}catch(e){}});
  }catch(e){}
  const nx=$("smNext");nx.disabled=false;
  nx.addEventListener("click",()=>{SM.idx++;smQ();},{once:true});
}
/* ---------- results ---------- */
function smFinish(quit){
  SM.active=false;
  const host=$("smRun")||$("practiceBox");if(!host)return;
  const total=SM.qs.length||1,score=SM.score;
  const pct=Math.round(score/total*100);
  smEnsure();
  const per={};
  SM.results.forEach(r=>{
    if(!per[r.skill])per[r.skill]={n:0,ok:0};
    per[r.skill].n++;if(r.ok)per[r.skill].ok++;
  });
  const weak=Object.keys(per).map(k=>({s:k,rate:per[k].ok/per[k].n})).sort((a,b)=>a.rate-b.rate)[0];
  try{
    S.smart.runs=(S.smart.runs||0)+1;
    S.smart.last={score:score,total:total,pct:pct,date:todayStr()};
    S.testsTaken=(S.testsTaken||0)+1;
    addXP(score*2+5,"smart");markStudyDay();save();
  }catch(e){}
  const perRows=Object.keys(per).map(k=>'<div class="stat-bar-row"><span class="lbl">'+smSkillAr(k)+'</span><div class="bar"><div class="fill" style="width:'+Math.round(per[k].ok/per[k].n*100)+'%;background:linear-gradient(90deg,#22c55e,#4ade80)"></div></div><b>'+per[k].ok+'/'+per[k].n+'</b></div>').join("");
  const wrongs=SM.results.filter(r=>!r.ok).slice(0,5);
  host.innerHTML='<div class="panel glass" style="text-align:center"><h3>🎯 نتيجة التدريب الذكي</h3>'
    +'<div class="stat-num" style="font-size:44px">'+score+' / '+total+'</div>'
    +'<div class="stat-num" style="font-size:28px">'+pct+'%</div>'
    +'<div class="progress" style="margin:10px 0"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
    +perRows
    +((weak&&weak.rate<0.7)?'<div class="muted">⚠️ «'+smSkillAr(weak.s)+'» يحتاج مراجعة ('+Math.round(weak.rate*100)+'%)</div>':"")
    +(wrongs.length?'<h4>راجع أخطاءك:</h4>'+wrongs.map(r=>'<div class="mist-err">❌ <b dir="ltr">'+escapeHtml(String(r.q.prompt).slice(0,60))+'</b><br><span class="muted">'+escapeHtml(r.q.explain||"")+'</span></div>').join(""):"")
    +'<div class="row-flex" style="justify-content:center;margin-top:12px">'
    +((weak&&weak.rate<0.7)?'<button class="btn btn-gold sm" id="smDrill">🎯 درّب '+smSkillAr(weak.s)+'</button>':"")
    +'<button class="btn btn-primary sm" id="smAgain">🔁 جلسة جديدة</button>'
    +'<button class="btn btn-ghost sm" id="smHome">الرئيسية ←</button></div></div>';
  const ag=$("smAgain"),hm=$("smHome"),dr=$("smDrill");
  if(ag)ag.addEventListener("click",()=>smStart(SM.kaps.length?SM.kaps:["K0","K1","K2","K3","K4","K5"],SM.difficulty,null));
  if(hm)hm.addEventListener("click",()=>{SM.qs=[];SM.idx=0;renderSmartNew();});
  if(dr)dr.addEventListener("click",()=>smStart(SM.kaps.length?SM.kaps:["K0","K1","K2","K3","K4","K5"],SM.difficulty,weak.s));
  try{if(typeof renderAll==="function")renderAll();}catch(e){}
  host.scrollIntoView({behavior:"smooth"});
}
/* ---------- wiring (repoint practice page to the new engine) ---------- */
function renderSmartPracticeNew(){renderSmartNew();}
(function(){
  try{
    renderPractice=renderSmartPracticeNew;
    if(typeof PLAY_PAGES!=="undefined")PLAY_PAGES.practice=renderSmartPracticeNew;
  }catch(e){console.error(e);}
  try{
    const _sp=showPage;
    showPage=function(n){_sp(n);try{if(n==="practice")renderSmartNew();}catch(e){console.error(e);}};
  }catch(e){console.error(e);}
})();

