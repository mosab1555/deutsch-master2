/* Deutsch Master — 📚 المرجع الألماني الشامل v3 (encyclopedia engine, ADDITIVE ONLY).
 * Knowledge-base architecture: 16 paths (A..P) -> topics -> unified template.
 * Data lives in client/reference-data-*.js (pure data, no DOM); deep
 * encyclopedia overlays live in client/reference-ency.js (pure data).
 * This file = engine only. Reuses: showPage-wrap, escapeHtml, speakGerman,
 * t()/applyLang, .quiz-opt, .ex-table, openExplain, markStudyDay, DMProgress.
 * Quiz gate: a question renders ONLY if refValidQuiz() passes.
 *
 * Navigation model (independent views, no stacked detail):
 *   home -> path -> topic -> related-topic (chain). Every view replaces
 *   #refBox exclusively and gets a stable state {view,path,topic}.
 *   refHistory = stack of previous states; UI back buttons jump deterministically
 *   (topic->path->home) while Android back pops one step. Scroll of every view
 *   is cached and restored (Reference home restores its position on return).
 * Progress + bookmarks live in guarded localStorage (deutsch_master_ref_v1)
 * and never compete with DMProgress (quiz attempts are also logged there).
 */
"use strict";

/* ---------- i18n chrome (one Object.assign per lang; merged by check-translations.js) ---------- */
try{
  Object.assign(I18N.ar,{reference:"المرجع الألماني الشامل",title_reference:"📚 المرجع الألماني الشامل",ref_search_ph:"ابحث في المرجع: mit / Dativ / ماضي / gestern / ضمائر...",ref_search_label:"🔍 بحث المرجع",ref_paths:"المسارات المعرفية",ref_topics:"مواضيع المسار",ref_back_paths:"← كل المسارات",ref_back_path:"← مواضيع المسار",ref_what:"ما هو؟",ref_rule:"القاعدة",ref_examples:"أمثلة",ref_notes:"ملاحظات مهمة",ref_mistakes:"أخطاء شائعة",ref_related:"🔗 موضوعات مرتبطة",ref_quiz:"📝 تدريب سريع",ref_no_results:"لا توجد نتائج مطابقة — جرّب كلمة أخرى",ref_grammar_hub:"📐 فتح القواعد المرتبطة",ref_open_lesson:"📖 فتح الشرح المفصل",ref_prev:"→ السابق",ref_next:"التالي ←",ref_topic_of:"الموضوع",ref_of:"من",ref_level_a1:"🟢 A1 أساسي",ref_level_a2:"🟡 A2 بعده",ref_level_b1:"🔵 B1 متقدم",ref_b1_closed:"🔵 محتوى متقدم — اضغط للفتح",ref_correct:"صحيح ✅",ref_wrong:"خطأ ❌",ref_home:"المرجع",ref_saved:"⭐ المحفوظة",ref_recent:"🕘 الأخيرة",ref_featured:"🌟 ابدأ من هنا",ref_next_up:"🎯 اقتراح لك",ref_filter_all:"الكل",ref_quick:"💡 الخلاصة",ref_why:"❓ لماذا؟",ref_when:"🕒 متى أستخدمه؟",ref_how:"🪜 كيف؟ خطوة بخطوة",ref_breakdown:"🧩 تفكيك مثال",ref_trick:"🧠 احفظها بهذه الطريقة",ref_reallife:"🏠 من الحياة",ref_practice:"📝 اختبر نفسك",ref_diff_easy:"🟢 سهل",ref_diff_mid:"🟡 متوسط",ref_diff_hard:"🔴 تحدي",ref_your_pick:"اختيارك",ref_mastery:"إتقان",ref_read:"📖 تمت القراءة",ref_save:"⭐ حفظ",ref_unsave:"⭐ محفوظ",ref_notfound:"الموضوع غير موجود",ref_notfound_back:"عودة إلى المرجع",ref_clear_filter:"✖ إظهار الكل",ref_correct_is:"الإجابة الصحيحة",ref_what_is:"ما هو المرجع الألماني الشامل؟",ref_what_is_d:"هذا هو المكان الذي ترجع إليه لفهم أي قاعدة أو كلمة أو تركيب ألماني بطريقة منظمة — من الصفر حتى B1.",ref_start_path:"🗺️ طريق المبتدئ: ابدأ من هنا بالترتيب",ref_start_path_d:"لو أن لغتك صفر، اتبع هذه الخطوات بالترتيب. يمكنك تصفح كل شيء بحرية، لكن هذا هو الترتيب الموصى به.",ref_you_here:"أنت هنا",ref_in_section:"في هذا القسم ستتعلم",ref_why_matters:"لماذا يهمك هذا القسم؟",ref_after_done:"بعد إنهاء هذا القسم ستستطيع",ref_start_with:"🚀 ابدأ من",ref_next_section:"الخطوة التالية",ref_roadmap:"🗺️ خارطة القسم",ref_outcomes:"🎯 ماذا ستخرج به؟",ref_compare:"❗ لا تخلط بين",ref_lesson_plan:"ستتعلم في هذا الدرس",ref_continue:"📖 أكمل من حيث توقفت",ref_table_note:"كيف تقرأ هذا الجدول",ref_rule_is:"📏 القاعدة",ref_another_ex:"📌 مثال آخر",ref_done:"تم ✓",ref_fresh:"لم يبدأ",ref_opened:"قُرئ",ref_lessons:"درس",ref_why_care:"💡 لماذا يهمك؟"});
  Object.assign(I18N.en,{reference:"Complete German Reference",title_reference:"📚 Complete German Reference",ref_search_ph:"Search the reference: mit / Dativ / past / gestern / pronouns...",ref_search_label:"🔍 Reference search",ref_paths:"Knowledge paths",ref_topics:"Path topics",ref_back_paths:"← All paths",ref_back_path:"← Path topics",ref_what:"What is it?",ref_rule:"The rule",ref_examples:"Examples",ref_notes:"Important notes",ref_mistakes:"Common mistakes",ref_related:"🔗 Related topics",ref_quiz:"📝 Quick practice",ref_no_results:"No matches — try another word",ref_grammar_hub:"📐 Open related grammar",ref_open_lesson:"📖 Open full lesson",ref_prev:"→ Previous",ref_next:"Next ←",ref_topic_of:"Topic",ref_of:"of",ref_level_a1:"🟢 A1 basic",ref_level_a2:"🟡 A2 next",ref_level_b1:"🔵 B1 advanced",ref_b1_closed:"🔵 Advanced — tap to open",ref_correct:"Correct ✅",ref_wrong:"Wrong ❌",ref_home:"Reference",ref_saved:"⭐ Saved",ref_recent:"🕘 Recent",ref_featured:"🌟 Start here",ref_next_up:"🎯 Suggested for you",ref_filter_all:"All",ref_quick:"💡 Takeaway",ref_why:"❓ Why?",ref_when:"🕒 When to use it?",ref_how:"🪜 How? Step by step",ref_breakdown:"🧩 Example breakdown",ref_trick:"🧠 Remember it like this",ref_reallife:"🏠 Real life",ref_practice:"📝 Test yourself",ref_diff_easy:"🟢 Easy",ref_diff_mid:"🟡 Medium",ref_diff_hard:"🔴 Challenge",ref_your_pick:"Your pick",ref_mastery:"Mastery",ref_read:"📖 Read",ref_save:"⭐ Save",ref_unsave:"⭐ Saved",ref_notfound:"Topic not found",ref_notfound_back:"Back to Reference",ref_clear_filter:"✖ Show all",ref_correct_is:"Correct answer",ref_what_is:"What is the Complete German Reference?",ref_what_is_d:"The place to return to for any German rule, word or pattern — organized from zero to B1.",ref_start_path:"🗺️ Beginner path: start here in order",ref_start_path_d:"If you start from zero, follow these steps in order. Browse freely, but this order is recommended.",ref_you_here:"You are here",ref_in_section:"In this section you will learn",ref_why_matters:"Why does this section matter?",ref_after_done:"After finishing you will be able to",ref_start_with:"🚀 Start with",ref_next_section:"Next step",ref_roadmap:"🗺️ Section roadmap",ref_outcomes:"🎯 What you will gain?",ref_compare:"❗ Do not confuse",ref_lesson_plan:"In this lesson you will learn",ref_continue:"📖 Continue where you left off",ref_table_note:"How to read this table",ref_rule_is:"📏 The rule",ref_another_ex:"📌 Another example",ref_done:"Done ✓",ref_fresh:"Not started",ref_opened:"Read",ref_lessons:"lessons",ref_why_care:"💡 Why it matters for you?"});
  Object.assign(I18N.de,{reference:"Deutsche Komplettreferenz",title_reference:"📚 Deutsche Komplettreferenz",ref_search_ph:"Referenz durchsuchen: mit / Dativ / Vergangenheit / gestern / Pronomen...",ref_search_label:"🔍 Referenzsuche",ref_paths:"Wissenspfade",ref_topics:"Pfadthemen",ref_back_paths:"← Alle Pfade",ref_back_path:"← Pfadthemen",ref_what:"Was ist das?",ref_rule:"Die Regel",ref_examples:"Beispiele",ref_notes:"Wichtige Hinweise",ref_mistakes:"Häufige Fehler",ref_related:"🔗 Verwandte Themen",ref_quiz:"📝 Kurztraining",ref_no_results:"Keine Treffer — versuch ein anderes Wort",ref_grammar_hub:"📐 Verwandte Grammatik öffnen",ref_open_lesson:"📖 Lektion öffnen",ref_prev:"→ Zurück",ref_next:"Weiter ←",ref_topic_of:"Thema",ref_of:"von",ref_level_a1:"🟢 A1 Basis",ref_level_a2:"🟡 A2 danach",ref_level_b1:"🔵 B1 fortgeschritten",ref_b1_closed:"🔵 Fortgeschritten — tippen zum Öffnen",ref_correct:"Richtig ✅",ref_wrong:"Falsch ❌",ref_home:"Referenz",ref_saved:"⭐ Gespeichert",ref_recent:"🕘 Zuletzt",ref_featured:"🌟 Starte hier",ref_next_up:"🎯 Vorschlag für dich",ref_filter_all:"Alle",ref_quick:"💡 Kurzfassung",ref_why:"❓ Warum?",ref_when:"🕒 Wann?",ref_how:"🪜 Wie? Schritt für Schritt",ref_breakdown:"🧩 Beispielanalyse",ref_trick:"🧠 So merkst du es dir",ref_reallife:"🏠 Aus dem Leben",ref_practice:"📝 Teste dich",ref_diff_easy:"🟢 Leicht",ref_diff_mid:"🟡 Mittel",ref_diff_hard:"🔴 Schwer",ref_your_pick:"Deine Wahl",ref_mastery:"Beherrschung",ref_read:"📖 Gelesen",ref_save:"⭐ Speichern",ref_unsave:"⭐ Gespeichert",ref_notfound:"Thema nicht gefunden",ref_notfound_back:"Zurück zur Referenz",ref_clear_filter:"✖ Alle zeigen",ref_correct_is:"Richtige Antwort",ref_what_is:"Was ist die Komplettreferenz?",ref_what_is_d:"Der Ort für jede deutsche Regel, jedes Wort, jede Struktur — von Null bis B1.",ref_start_path:"🗺️ Anfängerpfad: hier in Reihenfolge starten",ref_start_path_d:"Bei Null anfangen? Folge diesen Schritten. Freies Stöbern ok, diese Reihenfolge ist empfohlen.",ref_you_here:"Du bist hier",ref_in_section:"In diesem Abschnitt lernst du",ref_why_matters:"Warum ist das wichtig?",ref_after_done:"Danach kannst du",ref_start_with:"🚀 Starte mit",ref_next_section:"Nächster Schritt",ref_roadmap:"🗺️ Abschnittsplan",ref_outcomes:"🎯 Dein Ergebnis?",ref_compare:"❗ Nicht verwechseln",ref_lesson_plan:"In dieser Lektion lernst du",ref_continue:"📖 Weiterlernen",ref_table_note:"So liest du die Tabelle",ref_rule_is:"📏 Die Regel",ref_another_ex:"📌 Weiteres Beispiel",ref_done:"Fertig ✓",ref_fresh:"Nicht begonnen",ref_opened:"Gelesen",ref_lessons:"Lektionen",ref_why_care:"💡 Warum wichtig für dich?"});
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
function refFirstSentence(s){const x=String(s||"").trim();const m=x.match(/^(.+?[.!؟?])/);return (m?m[1]:x.slice(0,140));}

/* ---------- encyclopedia overlay access (reference-ency.js, guarded) ---------- */
function refEncy(){try{if(typeof window!=="undefined"&&window.DMRefEncy&&typeof window.DMRefEncy==="object")return window.DMRefEncy;}catch(e){}return null;}
function refOverlay(id){try{const E=refEncy();if(E&&E.overlays&&E.overlays[id])return E.overlays[id];}catch(e){}return null;}
function refAliasHay(id){try{const E=refEncy();if(E&&E.aliases&&E.aliases[id]&&E.aliases[id].length)return " "+E.aliases[id].join(" ");}catch(e){}return "";}
function refFeatured(){try{const E=refEncy();if(E&&Array.isArray(E.featured))return E.featured.filter(id=>!!refTopicById(id));}catch(e){}return ["d-akkusativ","d-dativ","b-artikel-bestimmt","c-personal"];}
function refJourney(){try{const E=refEncy();if(E&&Array.isArray(E.journey))return E.journey.filter(id=>!!refTopicById(id));}catch(e){}return ["c-personal","b-artikel-bestimmt","b-artikel-unbestimmt","d-nominativ","d-akkusativ","d-dativ","f-grundlagen","m-verbstellung","i-negation","i-fragen","h-dativ","g-perfekt"];}
function refPathMeta(pid){try{const E=refEncy();if(E&&E.pathMeta&&E.pathMeta[pid])return E.pathMeta[pid];}catch(e){}return null;}
function refNextPath(pid){try{const m=refPathMeta(pid);if(m&&m.next&&refPathById(m.next))return refPathById(m.next);}catch(e){}const i=REF_PATHS.findIndex(p=>p.id===pid);if(i>=0&&i<REF_PATHS.length-1)return REF_PATHS[i+1];return null;}
function refPathLevel(pid){try{const m=refPathMeta(pid);if(m&&m.level)return m.level;}catch(e){}const ts=refPathTopics(pid);const lv=ts.length&&ts[0].level;return (lv==="A1"||lv==="A2"||lv==="B1")?lv:"A1";}
/* Fallback depth: topics without a hand-written overlay still get a full
   encyclopedia experience synthesized from their own validated data
   (what/rule/notes/mistakes/examples/related) — never filler, always
   derived from the topic itself. Hand overlays (refOverlay) win when present. */
function refRichOverlay(tid){
  const ov=refOverlay(tid)||{};
  if(ov.quick||ov.why||(ov.when&&ov.when.length)||(ov.how&&ov.how.length))return ov;
  const f=refTopicById(tid);if(!f)return ov;
  const tp=f.topic;const out=Object.assign({},ov);
  if(!out.quick)out.quick=refFirstSentence(tp.what);
  if(!out.why&&tp.rule)out.why=tp.rule;
  if(!out.when||!out.when.length){
    const w=[];
    (tp.notes||[]).slice(0,3).forEach(n=>w.push(n));
    if(!w.length&&(tp.keywords||[]).length)w.push(tp.what||"");
    if(w.length)out.when=w.slice(0,4);
  }
  if(!out.how||!out.how.length){
    const h=[];
    if(tp.rule)h.push(tp.rule);
    (tp.notes||[]).slice(0,2).forEach(n=>{if(h.indexOf(n)<0)h.push(n);});
    if(h.length)out.how=h.slice(0,4);
  }
  if(!out.trick&&(tp.mistakes||[]).length){
    const m=tp.mistakes[0];
    out.trick="انتبه للخطأ الأشهر: "+m.w+" ← الصحيح: "+m.r+" — "+m.why;
  }
  if(!out.reallife||!out.reallife.length)out.reallife=(tp.examples||[]).slice(0,2);
  if(!out.breaks||!out.breaks.length){
    const e=(tp.examples||[])[0];
    if(e&&e[0]){
      const toks=String(e[0]).split(" ").filter(Boolean).slice(0,5);
      if(toks.length>=2)out.breaks=[{de:e[0],ar:e[1]||"",parts:toks.map((tk,i)=>[tk,"","كلمة "+(i+1)+" من الجملة"])}];
    }
  }
  return out;
}
function refTopicState(tid){
  try{
    const P=refProg();const m=refMastery(tid);
    if(m>=80)return "done";
    if(m>=0||P.opened[tid])return "opened";
  }catch(e){}
  return "fresh";
}
function refStateChip(st){
  if(st==="done")return '<span class="ref-st done">'+refEsc(refT("ref_done"))+'</span>';
  if(st==="opened")return '<span class="ref-st opened">'+refEsc(refT("ref_opened"))+'</span>';
  return '<span class="ref-st fresh">'+refEsc(refT("ref_fresh"))+'</span>';
}

/* ---------- progress + bookmarks (guarded localStorage, own namespace) ---------- */
var REF_PROG_KEY="deutsch_master_ref_v1";
var refProgCache=null;
function refProg(){
  if(refProgCache)return refProgCache;
  const dflt={v:1,opened:{},best:{},saved:[],recent:[]};
  try{
    const raw=(typeof localStorage!=="undefined")?localStorage.getItem(REF_PROG_KEY):null;
    if(raw){const o=JSON.parse(raw);if(o&&typeof o==="object"){dflt.opened=(o.opened&&typeof o.opened==="object")?o.opened:{};dflt.best=(o.best&&typeof o.best==="object")?o.best:{};dflt.saved=Array.isArray(o.saved)?o.saved.filter(x=>typeof x==="string").slice(0,200):[];dflt.recent=Array.isArray(o.recent)?o.recent.filter(x=>typeof x==="string").slice(0,12):[];}}
  }catch(e){/* corrupted state: recover with defaults, never crash */}
  refProgCache=dflt;return dflt;
}
function refProgSave(){try{if(typeof localStorage!=="undefined")localStorage.setItem(REF_PROG_KEY,JSON.stringify(refProgCache));}catch(e){}}
function refRecordOpen(tid){
  try{
    const P=refProg();P.opened[tid]=Date.now();
    P.recent=[tid].concat(P.recent.filter(x=>x!==tid)).slice(0,8);
    refProgSave();
  }catch(e){}
}
function refRecordQuiz(tid,ok,n){
  try{
    const P=refProg();const prev=P.best[tid];
    if(!prev||ok>prev.ok)P.best[tid]={ok:ok,n:n,ts:Date.now()};
    refProgSave();
  }catch(e){}
}
/* Per-view quiz session: mastery = correct answers across this topic's questions. */
var refQuizSession=null;
function refQuizSessionReset(tid,n){try{refQuizSession={tid:String(tid),ok:0,answered:0,n:n};}catch(e){refQuizSession=null;}}
function refMastery(tid){try{const b=refProg().best[tid];if(!b||!b.n)return -1;return Math.round((b.ok/b.n)*100);}catch(e){return -1;}}
function refIsSaved(tid){try{return refProg().saved.indexOf(tid)>=0;}catch(e){return false;}}
function refToggleSave(tid){try{const P=refProg();const i=P.saved.indexOf(tid);if(i>=0)P.saved.splice(i,1);else P.saved.push(tid);refProgSave();return i<0;}catch(e){return false;}}
function refMasteryChip(tid){
  const m=refMastery(tid);
  if(m>=0)return '<span class="ref-master '+(m>=80?"m-hi":(m>=50?"m-mid":"m-lo"))+'">'+refEsc(refT("ref_mastery"))+' '+m+'%</span>';
  try{if(refProg().opened[tid])return '<span class="ref-master m-read">'+refEsc(refT("ref_read"))+'</span>';}catch(e){}
  return "";
}

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
function refQuizDiff(qi,n){return n<=1?1:(qi===0?1:(qi===n-1?3:2));}
function refDiffLabel(d){return refT(d===1?"ref_diff_easy":(d===3?"ref_diff_hard":"ref_diff_mid"));}

/* ---------- independent-view navigation state ---------- */
var refState={view:"home",path:null,topic:null};
var refHistory=[];
var refScrollCache={};
var refLevel="";
function refKey(s){try{if(s.view==="topic"&&s.topic)return "t:"+s.topic;if(s.view==="path"&&s.path)return "p:"+s.path;}catch(e){}return "home";}
function refCurScroll(){try{return window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0;}catch(e){return 0;}}
function refSaveScroll(){try{refScrollCache[refKey(refState)]=refCurScroll();}catch(e){}}
function refScrollTop(){try{if(typeof window!=="undefined"&&window.scrollTo)window.scrollTo(0,0);}catch(e){}}
function refRestoreScroll(key){
  let y=0;try{y=refScrollCache[key]||0;}catch(e){y=0;}
  if(!y||y<=0)return;
  try{
    const apply=function(){try{const mx=Math.max((document.body?document.body.scrollHeight:0),(document.documentElement?document.documentElement.scrollHeight:0))-(window.innerHeight||0);const tgt=Math.max(0,Math.min(y,Math.max(0,mx)));if(tgt>0)window.scrollTo(0,tgt);}catch(e){}};
    if(typeof requestAnimationFrame==="function")requestAnimationFrame(function(){requestAnimationFrame(apply);});
    else setTimeout(apply,60);
  }catch(e){}
}
function refGo(next,push){
  refSaveScroll();
  if(push!==false){refHistory.push({view:refState.view,path:refState.path,topic:refState.topic});if(refHistory.length>40)refHistory.shift();}
  refState={view:next.view,path:next.path||null,topic:next.topic||null};
  paintRefView(false);
  refScrollTop();
}
/* Deterministic jumps for breadcrumb / UI back buttons (no history loops). */
function refJumpHome(){refSaveScroll();refHistory=[];refState={view:"home",path:null,topic:null};paintRefView(true);}
function refJumpPath(pid){if(!refPathById(pid))return;refSaveScroll();refHistory=[{view:"home",path:null,topic:null}];refState={view:"path",path:pid,topic:null};paintRefView(true);}
/* Android / browser back: one step. Returns true when handled. */
function refGoBack(){
  if(!refHistory.length)return false;
  refSaveScroll();
  const prev=refHistory.pop();
  refState={view:prev.view||"home",path:prev.path||null,topic:prev.topic||null};
  paintRefView(true);
  return true;
}
function paintRefView(restore){
  const st=refState;
  try{
    if(st.view==="topic"&&st.topic){paintRefTopic(st.topic,!!restore);return;}
    if(st.view==="path"&&st.path&&refPathById(st.path)){paintRefPath(st.path,!!restore);return;}
  }catch(e){}
  refState={view:"home",path:null,topic:null};
  paintRefHome(!!restore);
}
try{
  if(typeof window!=="undefined")window.DMRef={back:refGoBack,canBack:function(){try{return refHistory.length>0;}catch(e){return false;}},state:function(){return refState;},openTopic:function(id){openRefTopic(id);},openPath:function(id){openRefPath(id);}};
}catch(e){}

function renderReference(){
  /* Page-state preservation: on a return visit keep the user's view as-left
     instead of resetting to the paths home. First visits and explicit home
     navigation (breadcrumb) render normally. */
  try{if(window.DMPageState&&DMPageState.skipRender("reference"))return;}catch(e){}
  refHistory=[];refState={view:"home",path:null,topic:null};
  paintRefHome(false);
}

function refCrumb(items){
  return '<nav class="ref-crumb" aria-label="breadcrumb"><button type="button" class="mini-btn" data-crumb="home">'+refEsc(refT("ref_home"))+'</button>'+items.map(it=>' <span aria-hidden="true">‹</span> '+(it.id?'<button type="button" class="mini-btn" data-crumb="'+it.id+'">'+refEsc(it.label)+'</button>':'<b aria-current="page">'+refEsc(it.label)+'</b>')).join("")+'</nav>';
}
function wireCrumb(root){
  if(!root||!root.querySelectorAll)return;
  root.querySelectorAll("[data-crumb]").forEach(b=>b.addEventListener("click",()=>{
    const v=b.getAttribute("data-crumb");
    if(v==="home")refJumpHome();
    else refJumpPath(v);
  }));
}
function refBoxEl(){try{return document.getElementById("refBox");}catch(e){return null;}}
function refLevelChips(){
  const lv=[["","ref_filter_all"],["A1","ref_level_a1"],["A2","ref_level_a2"],["B1","ref_level_b1"]];
  return '<div class="ref-levels" role="group">'+lv.map(x=>'<button type="button" class="mini-btn'+(refLevel===x[0]?" on":"")+'" data-level="'+x[0]+'">'+refEsc(refT(x[1]))+'</button>').join("")+'</div>';
}
function wireLevelChips(root,after){
  if(!root||!root.querySelectorAll)return;
  root.querySelectorAll("[data-level]").forEach(b=>b.addEventListener("click",()=>{
    refLevel=b.getAttribute("data-level")||"";
    try{if(typeof DMPageState!=="undefined"&&DMPageState.capture)DMPageState.capture("reference");}catch(e){}
    after();
  }));
}
function refLevelMatch(tp){return !refLevel||(tp&&tp.level===refLevel);}
function refTopicBtn(tp,showPath){
  const f=refTopicById(tp.id);const p=showPath&&f?f.path:null;
  return '<button type="button" class="ref-topic-open" data-topic="'+refEsc(tp.id)+'"><span class="'+refLvlClass(tp.level||"A1")+'">'+refEsc(refLvlLabel(tp.level||"A1"))+'</span> <b>'+refEsc(refTopicTitle(tp))+'</b> <span class="muted">'+refEsc(tp.de||"")+'</span>'+(p?' <span class="muted">• '+refEsc(refPathTitle(p))+'</span>':"")+' '+refMasteryChip(tp.id)+(refIsSaved(tp.id)?' <span aria-label="saved">⭐</span>':"")+'<span aria-hidden="true">←</span></button>';
}
function wireTopicBtns(root){
  if(!root||!root.querySelectorAll)return;
  root.querySelectorAll("[data-topic]").forEach(b=>b.addEventListener("click",()=>openRefTopic(b.getAttribute("data-topic"))));
  root.querySelectorAll("[data-topic-open]").forEach(b=>b.addEventListener("click",()=>openRefTopic(b.getAttribute("data-topic-open"))));
}

/* ---------- HOME: independent reference homepage ---------- */
function paintRefHome(restore){
  const box=refBoxEl();if(!box)return;
  try{refProg();}catch(e){}
  let h='<section class="panel glass ref-whatis" aria-label="about"><h3>'+refEsc(refT("ref_what_is"))+'</h3><p class="muted">'+refEsc(refT("ref_what_is_d"))+'</p></section>';
  h+='<div class="panel glass ref-search-panel"><label class="ref-search-label" for="refSearch">'+refEsc(refT("ref_search_label"))+'</label>';
  h+='<input type="text" id="refSearch" class="full-input" data-i18n-ph="ref_search_ph" placeholder="'+refEsc(refT("ref_search_ph"))+'" autocomplete="off">';
  h+='<div id="refResults" class="ref-results" role="listbox"></div></div>';
  /* guided beginner journey: numbered Start-Here path (free browsing stays open) */
  try{
    const jn=refJourney();
    if(jn.length){
      h+='<section class="panel glass ref-journey" aria-label="start"><h3>'+refEsc(refT("ref_start_path"))+'</h3><p class="muted">'+refEsc(refT("ref_start_path_d"))+'</p><ol class="ref-journey-list">';
      jn.forEach((id,i)=>{
        const f=refTopicById(id);if(!f)return;
        h+='<li><button type="button" class="ref-jstep" data-topic="'+refEsc(id)+'"><span class="ref-jnum" aria-hidden="true">'+(i+1)+'</span><span class="ref-jtxt"><b>'+refEsc(refTopicTitle(f.topic))+'</b><span class="muted"> '+refEsc(f.topic.de||"")+' • '+refEsc(f.path.id+" • "+refPathTitle(f.path))+'</span></span> '+refStateChip(refTopicState(id))+'</button></li>';
      });
      h+='</ol></section>';
    }
  }catch(e){}
  /* featured */
  const feat=refFeatured();
  if(feat.length){
    h+='<h3 class="ref-sec-title">'+refEsc(refT("ref_featured"))+'</h3><div class="ref-strip">';
    feat.forEach(id=>{const f=refTopicById(id);if(!f)return;h+='<button type="button" class="mini-btn ref-feat" data-topic="'+refEsc(id)+'">'+refEsc(f.topic.de||id)+'</button>';});
    h+='</div>';
  }
  /* suggested next */
  try{
    const all=refAllTopicsFlat().filter(tp=>tp&&tp.level==="A1");
    const P=refProg();let sug=null;
    for(const tp of all){if(!P.opened[tp.id]){sug=tp;break;}}
    if(!sug)for(const tp of all){const b=P.best[tp.id];if(!b){sug=tp;break;}}
    if(sug){h+='<div class="panel glass ref-suggest"><span>'+refEsc(refT("ref_next_up"))+'</span> <button type="button" class="mini-btn" data-topic="'+refEsc(sug.id)+'">'+refEsc(refTopicTitle(sug))+' • '+refEsc(sug.de||"")+'</button></div>';}
  }catch(e){}
  /* recent + saved */
  try{
    const P=refProg();
    const rec=(P.recent||[]).map(id=>refTopicById(id)).filter(Boolean).slice(0,8);
    if(rec.length){h+='<h3 class="ref-sec-title">'+refEsc(refT("ref_recent"))+'</h3><div class="ref-strip">'+rec.map(f=>'<button type="button" class="mini-btn" data-topic="'+refEsc(f.topic.id)+'">'+refEsc(refTopicTitle(f.topic))+'</button>').join("")+'</div>';}
    const sav=(P.saved||[]).map(id=>refTopicById(id)).filter(Boolean);
    if(sav.length){h+='<h3 class="ref-sec-title">'+refEsc(refT("ref_saved"))+' ('+sav.length+')</h3><div class="ref-strip">'+sav.map(f=>'<button type="button" class="mini-btn" data-topic="'+refEsc(f.topic.id)+'">⭐ '+refEsc(refTopicTitle(f.topic))+'</button>').join("")+'</div>';}
  }catch(e){}
  h+='<h3 class="ref-sec-title">'+refEsc(refT("ref_paths"))+'</h3>'+refLevelChips()+'<div class="ref-grid">';
  REF_PATHS.forEach(p=>{
    const topics=refPathTopics(p.id);
    const shown=topics.filter(refLevelMatch);
    const dim=refLevel&&!shown.length;
    let done=0;try{const P=refProg();topics.forEach(tp=>{if(P.opened[tp.id])done++;});}catch(e){}
    h+='<button type="button" class="ref-card glass'+(dim?" dim":"")+'" data-path="'+p.id+'" style="border-top:4px solid '+p.color+'"><span class="ref-ico" aria-hidden="true">'+p.icon+'</span><span class="ref-name">'+refEsc(refPathTitle(p))+'</span><span class="ref-de">'+refEsc(p.de)+'</span><span class="ref-count">'+shown.length+' / '+topics.length+'</span>'+(done?'<span class="ref-progress"><span style="width:'+Math.round(done/topics.length*100)+'%"></span></span>':"")+'</button>';
  });
  h+='</div>';
  box.innerHTML=h;
  box.querySelectorAll("[data-path]").forEach(b=>b.addEventListener("click",()=>openRefPath(b.getAttribute("data-path"))));
  wireTopicBtns(box);wireLevelChips(box,function(){paintRefHome(false);refScrollTop();});
  const si=document.getElementById("refSearch");
  if(si){let tm=null;si.addEventListener("input",()=>{try{clearTimeout(tm);}catch(e){}tm=setTimeout(runRefSearch,120);});}
  if(restore)refRestoreScroll("home");
}

/* ---------- PATH: independent path view (topic list only, no inline detail) ---------- */
function openRefPath(pid,opts){
  const p=refPathById(pid);if(!p)return;
  if(refKey(refState)==="p:"+pid&&!(opts&&opts.force)){paintRefPath(pid,false);refScrollTop();return;}
  refGo({view:"path",path:pid},!(opts&&opts.replace));
}
function paintRefPath(pid,restore){
  const p=refPathById(pid);const box=refBoxEl();if(!p||!box){paintRefHome(false);return;}
  const topics=refPathTopics(pid);
  const meta=refPathMeta(pid);
  const nx=refNextPath(pid);
  let doneN=0;try{const P0=refProg();topics.forEach(tp=>{if(P0.opened[tp.id])doneN++;});}catch(e){}
  let h=refCrumb([{label:refPathTitle(p)}]);
  h+='<p class="ref-youhere muted">'+refEsc(refT("ref_you_here"))+': '+refEsc(refT("ref_home"))+' → '+refEsc(refPathTitle(p))+'</p>';
  h+='<header class="panel glass ref-path-hero" style="border-top:4px solid '+p.color+'"><div class="ref-path-hero-top"><span class="ref-ico" aria-hidden="true">'+p.icon+'</span><div><h2>'+refEsc(refPathTitle(p))+'</h2><div class="ref-de-line" dir="ltr">'+refEsc(p.de)+' • '+refEsc(p.en||"")+'</div></div></div>';
  if(meta&&meta.intro)h+='<p class="ref-path-intro">'+refEsc(meta.intro)+'</p>';
  h+='<div class="ref-meta-row"><span class="'+refLvlClass(refPathLevel(pid))+'">'+refEsc(refLvlLabel(refPathLevel(pid)))+'</span><span class="muted">'+topics.length+' '+refEsc(refT("ref_lessons"))+'</span>'+(doneN?'<span class="muted">'+refEsc(refT("ref_done"))+': '+doneN+'/'+topics.length+'</span><span class="ref-progress"><span style="width:'+Math.round(doneN/Math.max(1,topics.length)*100)+'%"></span></span>':"")+'</div>';
  if(meta&&meta.startWith&&refTopicById(meta.startWith)){
    const sw=refTopicById(meta.startWith).topic;
    h+='<div class="row-flex"><button type="button" class="btn btn-primary sm" data-topic="'+refEsc(meta.startWith)+'">'+refEsc(refT("ref_start_with"))+': '+refTopicTitle(sw)+'</button>'+(nx?'<button type="button" class="btn btn-ghost sm" data-jump="'+nx.id+'">'+refEsc(refT("ref_next_section"))+': '+nx.icon+' '+refEsc(refPathTitle(nx))+'</button>':"")+'</div>';
  }
  h+='</header>';
  if(meta&&(meta.willLearn||meta.why||meta.outcomes)){
    if(meta.willLearn&&meta.willLearn.length){
      h+='<section class="panel glass" aria-label="roadmap"><h4>'+refEsc(refT("ref_roadmap"))+' — '+refEsc(refT("ref_in_section"))+'…</h4><ol class="ref-roadmap">';
      topics.forEach((tp,i)=>{
        const st=refTopicState(tp.id);
        h+='<li><button type="button" class="ref-jstep sm" data-topic="'+refEsc(tp.id)+'"><span class="ref-jnum" aria-hidden="true">'+(i+1)+'</span><span class="ref-jtxt"><b>'+refEsc(refTopicTitle(tp))+'</b></span> '+refStateChip(st)+'</button></li>';
      });
      h+='</ol></section>';
    }
    if(meta.why)h+='<section class="panel glass"><h4>'+refEsc(refT("ref_why_matters"))+'</h4><p>'+refEsc(meta.why)+'</p></section>';
    if(meta.outcomes&&meta.outcomes.length)h+='<section class="panel glass ref-outcomes"><h4>'+refEsc(refT("ref_after_done"))+':</h4><ul class="ex-ul">'+meta.outcomes.map(o=>'<li>✓ '+refEsc(o)+'</li>').join("")+'</ul></section>';
  }
  h+='<div class="ref-path-head" style="border-top:4px solid '+p.color+'"><span class="ref-ico" aria-hidden="true">'+p.icon+'</span><h3>'+refEsc(refPathTitle(p))+' <span class="muted">'+refEsc(p.de)+'</span></h3>';
  h+='<div class="row-flex"><button type="button" class="btn btn-ghost sm" id="refBackPaths">'+refEsc(refT("ref_back_paths"))+'</button><button type="button" class="btn btn-ghost sm" id="refGrammarHub">'+refEsc(refT("ref_grammar_hub"))+'</button></div></div>';
  h+='<div class="ref-chips" role="navigation">'+REF_PATHS.map(x=>'<button type="button" class="mini-btn'+(x.id===pid?" on":"")+'" data-jump="'+x.id+'" aria-label="'+refEsc(refPathTitle(x))+'">'+x.icon+' '+x.id+'</button>').join("")+'</div>';
  if(refLevel){
    h+='<div class="panel glass ref-suggest"><span>'+refEsc(refLvlLabel(refLevel))+'</span> <button type="button" class="mini-btn" id="refClearFilter">'+refEsc(refT("ref_clear_filter"))+'</button></div>';
  }
  const shown=topics.filter(refLevelMatch);
  if(shown.length){
    h+='<h4>'+refEsc(refT("ref_topics"))+' ('+shown.length+')</h4><div class="ref-topic-list">';
    shown.forEach(tp=>{h+='<div class="ref-topic glass">'+refTopicBtn(tp,false)+'</div>';});
    h+='</div>';
  }else{
    h+='<div class="panel glass"><p class="muted">'+refEsc(refT("ref_no_results"))+'</p></div>';
  }
  box.innerHTML=h;
  wireCrumb(box);wireTopicBtns(box);
  const bb=document.getElementById("refBackPaths");if(bb)bb.addEventListener("click",refJumpHome);
  const gh=document.getElementById("refGrammarHub");if(gh)gh.addEventListener("click",()=>{try{showPage("grammar");}catch(e){}});
  const cf=document.getElementById("refClearFilter");if(cf)cf.addEventListener("click",()=>{refLevel="";paintRefPath(pid,false);refScrollTop();});
  box.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>{const id=b.getAttribute("data-jump");refSaveScroll();refHistory=[{view:"home",path:null,topic:null}];refState={view:"path",path:id,topic:null};paintRefPath(id,false);refScrollTop();}));
  if(restore)refRestoreScroll("p:"+pid);
}

function refTopicPreview(tp){
  return '<button type="button" class="btn btn-primary sm" data-topic-open="'+refEsc(tp.id)+'">'+refEsc(refT("ref_topic_of"))+' ←</button>';
}

/* ---------- TOPIC: independent encyclopedia page ---------- */
function openRefTopic(tid,opts){
  if(!tid||!refTopicById(tid)){refGo({view:"topic",topic:String(tid||"")},!(opts&&opts.replace));return;}
  if(refState.view==="topic"&&refState.topic===tid&&!(opts&&opts.force)){paintRefTopic(tid,false);refScrollTop();return;}
  refGo({view:"topic",topic:tid},!(opts&&opts.replace));
}
function paintRefTopic(tid,restore){
  const box=refBoxEl();if(!box)return;
  const found=tid?refTopicById(tid):null;
  if(!found){
    /* Safe fallback: never crash on an invalid topic id. */
    let h=refCrumb([{label:refT("ref_notfound")}]);
    h+='<div class="panel glass"><h2>⚠️ '+refEsc(refT("ref_notfound"))+'</h2><div class="row-flex"><button type="button" class="btn btn-primary sm" id="refNfBack">'+refEsc(refT("ref_notfound_back"))+'</button></div></div>';
    box.innerHTML=h;wireCrumb(box);
    const b=document.getElementById("refNfBack");if(b)b.addEventListener("click",refJumpHome);
    return;
  }
  const {path:p,topic:tp}=found;
  const ov=refRichOverlay(tp.id);
  const topics=refPathTopics(p.id);
  const idx=topics.findIndex(x=>x.id===tid);
  const prev=idx>0?topics[idx-1]:null, next=(idx>=0&&idx<topics.length-1)?topics[idx+1]:null;
  try{refRecordOpen(tid);}catch(e){}
  const saved=refIsSaved(tid);
  const mastery=refMastery(tid);
  let h=refCrumb([{id:p.id,label:p.id+" • "+refPathTitle(p)},{label:refTopicTitle(tp)}]);
  h+='<p class="ref-youhere muted">'+refEsc(refT("ref_you_here"))+': '+refEsc(refT("ref_home"))+' → '+refEsc(refPathTitle(p))+' → '+refEsc(refTopicTitle(tp))+'</p>';
  h+='<article class="panel glass ref-hero"><div class="ref-hero-top"><span class="'+refLvlClass(tp.level||"A1")+'">'+refEsc(refLvlLabel(tp.level||"A1"))+'</span>';
  h+='<button type="button" class="mini-btn ref-savebtn" id="refSaveBtn" aria-pressed="'+(saved?"true":"false")+'">'+refEsc(refT(saved?"ref_unsave":"ref_save"))+'</button></div>';
  h+='<h2 dir="ltr">'+refEsc(tp.de||"")+'</h2><div class="ref-hero-ar">'+refEsc(tp.ar||"")+(tp.en?' <span class="muted">• '+refEsc(tp.en)+'</span>':"")+'</div>';
  h+='<div class="muted">'+refEsc(refT("ref_topic_of"))+' '+(idx+1)+' '+refEsc(refT("ref_of"))+' '+topics.length+' • '+refEsc(p.id+" • "+refPathTitle(p))+(mastery>=0?' • '+refEsc(refT("ref_mastery"))+' '+mastery+'%':"")+'</div></article>';
  const quick=ov.quick||refFirstSentence(tp.what);
  if(quick)h+='<div class="panel glass ref-quick"><h4>'+refEsc(refT("ref_quick"))+'</h4><p><b>'+refEsc(quick)+'</b></p></div>';
  if(ov.why)h+='<section class="panel glass ref-whycare"><h4>'+refEsc(refT("ref_why_care"))+'</h4><p>'+refEsc(ov.why)+'</p></section>';
  h+='<section class="panel glass ref-plan"><h4>'+refEsc(refT("ref_lesson_plan"))+':</h4><ul class="ex-ul"><li>✓ '+refEsc(refT("ref_when"))+'</li><li>✓ '+refEsc(refT("ref_how"))+'</li><li>✓ '+refEsc(refT("ref_examples"))+'</li><li>✓ '+refEsc(refT("ref_breakdown"))+'</li><li>✓ '+refEsc(refT("ref_mistakes"))+'</li><li>✓ '+refEsc(refT("ref_practice"))+'</li></ul></section>';
  if(tp.what)h+='<section class="panel glass" aria-label="what"><h4>1️⃣ '+refEsc(refT("ref_what"))+'</h4><p>'+refEsc(tp.what)+'</p></section>';
  if(ov.when&&ov.when.length)h+='<section class="panel glass"><h4>'+refEsc(refT("ref_when"))+'</h4><ul class="ex-ul">'+ov.when.map(x=>'<li>'+refEsc(x)+'</li>').join("")+'</ul></section>';
  if(ov.how&&ov.how.length)h+='<section class="panel glass"><h4>'+refEsc(refT("ref_how"))+'</h4><ol class="ex-ol">'+ov.how.map(x=>'<li>'+refEsc(x)+'</li>').join("")+'</ol></section>';
  if(tp.rule)h+='<section class="panel glass ref-rulebox"><h4>2️⃣ '+refEsc(refT("ref_rule"))+'</h4><p><b>'+refEsc(tp.rule)+'</b></p></section>';
  if(ov.vs&&ov.vs.title){
    h+='<section class="panel glass ref-vsbox"><h4>'+refEsc(refT("ref_compare"))+': '+refEsc(ov.vs.title)+'</h4><div class="ref-vs-a">🅰️ '+refEsc(ov.vs.a)+'</div><div class="ref-vs-b">🅱️ '+refEsc(ov.vs.b)+'</div>'+(ov.vs.tip?'<div class="muted">💡 '+refEsc(ov.vs.tip)+'</div>':"")+'</section>';
  }
  (tp.tables||[]).forEach(tb=>{
    h+='<section class="panel glass"><h4>📊 '+refEsc(tb.cap)+'</h4><p class="muted ref-table-hint">'+refEsc(refT("ref_table_note"))+': اقرأ الصف من اليمين (المعنى) ثم طابق العمود (الحالة/الجنس) — والأمثلة تحت الجدول تثبّت كل خلية.</p><div class="tbl-wrap"><table class="ex-table"><tr>'+tb.head.map(x=>'<th>'+refEsc(x)+'</th>').join("")+'</tr>';
    tb.rows.forEach(r=>{h+='<tr>'+r.map(c=>'<td>'+refLinkCell(c,tp.id)+'</td>').join("")+'</tr>';});
    h+='</table></div></section>';
  });
  if(tp.examples&&tp.examples.length){
    h+='<section class="panel glass"><h4>🇩🇪 '+refEsc(refT("ref_examples"))+'</h4>';
    tp.examples.forEach(e=>{
      h+='<div class="ref-ex"><div class="ref-ex-de" dir="ltr">'+refEsc(e[0])+' <button type="button" class="mini-btn ref-say" data-spk="'+refEsc(e[0])+'" title="🔊" aria-label="🔊">🔊</button></div><div class="ref-ex-ar">'+refEsc(e[1]||"")+'</div></div>';
    });
    h+='</section>';
  }
  (ov.breaks||[]).forEach(br=>{
    if(!br||!br.de||!br.parts||!br.parts.length)return;
    h+='<section class="panel glass"><h4>'+refEsc(refT("ref_breakdown"))+'</h4><div class="ref-ex"><div class="ref-ex-de" dir="ltr">'+refEsc(br.de)+' <button type="button" class="mini-btn ref-say" data-spk="'+refEsc(br.de)+'" title="🔊" aria-label="🔊">🔊</button></div>'+(br.ar?'<div class="ref-ex-ar">'+refEsc(br.ar)+'</div>':"")+'</div><div class="tbl-wrap"><table class="ex-table"><tr><th>🇩🇪</th><th>🇪🇬</th><th>📌</th></tr>';
    br.parts.forEach(pt=>{h+='<tr><td dir="ltr">'+refEsc(pt[0]||"")+'</td><td>'+refEsc(pt[1]||"")+'</td><td>'+refEsc(pt[2]||"")+'</td></tr>';});
    h+='</table></div></section>';
  });
  if(tp.notes&&tp.notes.length)h+='<section class="panel glass"><h4>⭐ '+refEsc(refT("ref_notes"))+'</h4><ul class="ex-ul">'+tp.notes.map(n=>'<li>'+refEsc(n)+'</li>').join("")+'</ul></section>';
  if(tp.mistakes&&tp.mistakes.length){
    h+='<section class="panel glass"><h4>⚠️ '+refEsc(refT("ref_mistakes"))+'</h4>'+tp.mistakes.map(m=>{
      let relBtn="";
      try{const f=m.rel?refTopicById(m.rel):null;if(f)relBtn='<div><button type="button" class="mini-btn" data-rel="'+refEsc(m.rel)+'">🧠 '+refEsc(refTopicTitle(f.topic))+'</button></div>';}catch(e){}
      return '<div class="ex-mist"><div class="ex-wrong">❌ '+refEsc(m.w)+'</div><div class="ex-right">✅ '+refEsc(m.r)+'</div><div class="muted">💡 '+refEsc(m.why)+'</div>'+relBtn+'</div>';
    }).join("")+'</section>';
  }
  if(ov.trick)h+='<section class="panel glass ref-trickbox"><h4>'+refEsc(refT("ref_trick"))+'</h4><p><b>'+refEsc(ov.trick)+'</b></p></section>';
  if(ov.reallife&&ov.reallife.length){
    h+='<section class="panel glass"><h4>'+refEsc(refT("ref_reallife"))+'</h4>';
    ov.reallife.forEach(e=>{
      h+='<div class="ref-ex"><div class="ref-ex-de" dir="ltr">'+refEsc(e[0])+' <button type="button" class="mini-btn ref-say" data-spk="'+refEsc(e[0])+'" title="🔊" aria-label="🔊">🔊</button></div><div class="ref-ex-ar">'+refEsc(e[1]||"")+'</div></div>';
    });
    h+='</section>';
  }
  if(tp.related&&tp.related.length){
    const links=tp.related.map(rid=>{const f=refTopicById(rid);if(!f)return null;return '<button type="button" class="mini-btn" data-rel="'+refEsc(rid)+'">'+f.path.id+' • '+refEsc(refTopicTitle(f.topic))+'</button>';}).filter(Boolean);
    if(links.length)h+='<section class="panel glass"><h4>'+refEsc(refT("ref_related"))+'</h4><div class="row-flex">'+links.join("")+'</div></section>';
  }
  if(tp.explain){
    h+='<div class="row-flex"><button type="button" class="btn btn-ghost sm" id="refExplainBtn">'+refEsc(refT("ref_open_lesson"))+' ('+refEsc(tp.explain)+')</button></div>';
  }
  const validQ=(tp.quiz||[]).filter(refValidQuiz);
  try{refQuizSessionReset(tid,validQ.length);}catch(e){}
  if(validQ.length){
    h+='<section class="panel glass" aria-label="quiz"><h4>'+refEsc(refT("ref_practice"))+' ('+validQ.length+')</h4><div class="ref-quiz-body">';
    validQ.forEach((q,qi)=>{
      const d=refQuizDiff(qi,validQ.length);
      if(q.type==="order"){
        h+='<div class="ref-q" data-qi="'+qi+'" data-qtype="order"><b>🔀 '+refEsc(q.q)+'</b> <span class="ref-diff d'+d+'">'+refEsc(refDiffLabel(d))+'</span><div class="ref-order-line" dir="ltr"></div><div class="quiz-opts ref-order-bank">'+refShuffleIdx(q.words.length).map(wi=>'<button type="button" class="quiz-opt ref-order-word">'+refEsc(q.words[wi])+'</button>').join("")+'</div><div class="row-flex"><button type="button" class="btn btn-ghost sm ref-order-reset">↺</button><button type="button" class="btn btn-primary sm ref-order-check">✓</button></div><div class="quiz-feedback hidden"></div></div>';
      }else{
        h+='<div class="ref-q" data-qi="'+qi+'" data-qtype="choice"><b>'+refEsc(q.q)+'</b> <span class="ref-diff d'+d+'">'+refEsc(refDiffLabel(d))+'</span><div class="quiz-opts">'+refShuffleIdx(q.opts.length).map(oi=>'<button type="button" class="quiz-opt" data-qi="'+qi+'" data-oi="'+oi+'">'+refEsc(q.opts[oi])+'</button>').join("")+'</div><div class="quiz-feedback hidden"></div></div>';
      }
    });
    h+='</div></section>';
  }
  h+='<div class="ex-nav bottom"><button type="button" class="btn btn-ghost sm" id="refPrevBtn" '+(prev?"":"disabled")+'>'+refEsc(refT("ref_prev"))+(prev?' '+refEsc(refTopicTitle(prev)):"")+'</button><button type="button" class="btn btn-gold sm" id="refIdxBtn">'+refEsc(refT("ref_back_path"))+'</button><button type="button" class="btn btn-ghost sm" id="refNextBtn" '+(next?"":"disabled")+'>'+(next?refEsc(refTopicTitle(next))+" ":"")+refEsc(refT("ref_next"))+'</button></div>';
  box.innerHTML=h;
  wireCrumb(box);
  const sv=document.getElementById("refSaveBtn");
  if(sv)sv.addEventListener("click",()=>{const now=refToggleSave(tid);sv.textContent=refT(now?"ref_unsave":"ref_save");sv.setAttribute("aria-pressed",now?"true":"false");});
  box.querySelectorAll("[data-spk]").forEach(b=>b.addEventListener("click",ev=>{ev.stopPropagation();try{if(typeof speakGerman==="function")speakGerman(b.getAttribute("data-spk"));}catch(e){}}));
  box.querySelectorAll("[data-rel]").forEach(b=>b.addEventListener("click",()=>openRefTopic(b.getAttribute("data-rel"))));
  const exB=document.getElementById("refExplainBtn");
  if(exB&&tp.explain)exB.addEventListener("click",()=>{try{if(typeof openExplain==="function")openExplain(tp.explain);}catch(e){}});
  box.querySelectorAll(".ref-q").forEach(wrap=>{
    let qi=NaN;
    try{qi=parseInt(wrap.getAttribute("data-qi"),10);}catch(e){}
    const q=validQ[qi];
    if(!q||typeof wrap.querySelector!=="function")return;
    if(q.type==="order"){wireRefOrder(wrap,q,tid,validQ.length);return;}
    wrap.querySelectorAll(".quiz-opt").forEach(btn=>btn.addEventListener("click",()=>{
      const oi=parseInt(btn.getAttribute("data-oi"),10);
      wrap.querySelectorAll(".quiz-opt").forEach(x=>{x.disabled=true;});
      const fb=wrap.querySelector(".quiz-feedback");fb.classList.remove("hidden");
      const ok=oi===q.correct;
      const extra=refQuizExtra(tid);
      if(ok){btn.classList.add("correct");fb.className="quiz-feedback ok";fb.textContent=refT("ref_correct")+" "+(q.why||"")+extra;}
      else{btn.classList.add("wrong");const cb=Array.from(wrap.querySelectorAll(".quiz-opt")).find(x=>parseInt(x.getAttribute("data-oi"),10)===q.correct);if(cb)cb.classList.add("correct");fb.className="quiz-feedback no";fb.textContent=refT("ref_wrong")+" "+refT("ref_correct_is")+": "+q.opts[q.correct]+" — "+(q.why||"")+extra+" ("+refT("ref_your_pick")+": "+(q.opts[oi]||"")+")";}
      try{refRecordQuizAnswer(wrap,tid,validQ.length,ok);}catch(e){}
      try{if(typeof markStudyDay==="function")markStudyDay(false);}catch(e){}
    }));
  });
  const ib=document.getElementById("refIdxBtn");if(ib)ib.addEventListener("click",()=>refJumpPath(p.id));
  if(prev){const pb=document.getElementById("refPrevBtn");if(pb)pb.addEventListener("click",()=>openRefTopic(prev.id));}
  if(next){const nb=document.getElementById("refNextBtn");if(nb)nb.addEventListener("click",()=>openRefTopic(next.id));}
  if(restore)refRestoreScroll("t:"+tid);
}
/* Enriched post-attempt feedback: why + rule + another example (revealed only after attempt). */
function refQuizExtra(tid){
  try{
    const f=refTopicById(tid);if(!f||!f.topic)return "";
    const tp=f.topic;let s="";
    if(tp.rule)s+=" — "+refT("ref_rule_is")+": "+tp.rule;
    const ex=(tp.examples||[])[0];
    if(ex&&ex[0])s+=" — "+refT("ref_another_ex")+": "+ex[0]+(ex[1]?" ("+ex[1]+")":"");
    return s;
  }catch(e){return "";}
}
/* Per-question mastery: recompute topic score from answered questions in this view. */
function refRecordQuizAnswer(wrap,tid,total,justOk){
  try{
    if(!refQuizSession||refQuizSession.tid!==tid)refQuizSession={tid:tid,ok:0,answered:0,n:total};
    refQuizSession.answered++;if(justOk)refQuizSession.ok++;
    refRecordQuiz(tid,refQuizSession.ok,total);
  }catch(e){}
  try{
    if(typeof DMProgress!=="undefined"&&DMProgress&&typeof DMProgress.logAttempt==="function"){
      let qi=-1;try{qi=parseInt(wrap.getAttribute("data-qi"),10);}catch(e2){}
      DMProgress.logAttempt({sec:"reference",session:"ref-"+tid,qid:tid+"#"+qi,ok:!!justOk,qtype:"ref-quiz",ref:tid});
    }
  }catch(e){}
}

/* ---------- order-type quiz wiring (tap words in order, then check) ---------- */
function wireRefOrder(wrap,q,tid,total){
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
    const ok=got===q.answer;
    const extra2=refQuizExtra(tid);
    if(ok){fb.className="quiz-feedback ok";fb.textContent=refT("ref_correct")+" "+(q.why||"")+extra2;bank.forEach(b=>{b.disabled=true;});}
    else{fb.className="quiz-feedback no";fb.textContent=refT("ref_wrong")+" "+refT("ref_correct_is")+": "+q.answer+" — "+(q.why||"")+extra2;}
    try{if(tid)refRecordQuizAnswer(wrap,tid,total,ok);}catch(e){}
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
        return refEsc(before)+'<button type="button" class="mini-btn ref-cell-link" data-rel="'+e.id+'">'+refEsc(m[2])+'</button>'+refEsc(after);
      }
    }
  }catch(err){}
  return refEsc(txt);
}

/* ---------- professional search: de/ar/en/title/examples/keywords/aliases/related ---------- */
var refIndex=null;
function refBuildIndex(){
  const entries=[];
  REF_PATHS.forEach(p=>{
    entries.push({kind:"path",path:p,topic:null,title:refPathTitle(p)+" "+p.de+" "+p.en,hay:refNorm(p.ar+" "+p.de+" "+p.en)});
    refPathTopics(p.id).forEach(tp=>{
      const hay=refNorm([tp.de,tp.ar,tp.en,tp.what,tp.rule,(tp.keywords||[]).join(" "),(tp.tables||[]).map(x=>x.cap+" "+x.head.join(" ")+x.rows.map(r=>r.join(" ")).join(" ")).join(" "),(tp.examples||[]).map(e=>e.join(" ")).join(" "),(tp.notes||[]).join(" ")].join(" ")+refAliasHay(tp.id));
      entries.push({kind:"topic",path:p,topic:tp,title:refTopicTitle(tp)+" — "+(tp.de||""),hay:hay,alias:refNorm(refAliasHay(tp.id))});
    });
  });
  refIndex=entries;return entries;
}
function runRefSearch(){
  const inp=document.getElementById("refSearch"),out=document.getElementById("refResults");
  if(!inp||!out)return;
  const rawQ=String(inp.value||"").trim();
  const q=refNorm(rawQ);
  if(!q||q.length<2){out.innerHTML="";out.classList.remove("show");return;}
  if(!refIndex)refBuildIndex();
  const scored=[];
  refIndex.forEach(e=>{
    let s=0,kb=0;
    const ti=refNorm(e.kind==="path"?refPathTitle(e.path)+" "+e.path.de+" "+e.path.en:refTopicTitle(e.topic)+" "+(e.topic.de||"")+" "+(e.topic.en||""));
    const kws=e.kind==="topic"?((e.topic.keywords||[]).map(refNorm)):[""];
    if(e.kind==="topic"&&(e.alias===" "+q||e.alias.split(" ").some(a=>a===q)))kb=2;
    else if(kws.some(k=>k===q))kb=1;
    var REF_STOP=new Set(["der","die","das","den","dem","des","ein","eine","einen","einem","einer","mit","von","zu","bei","nach","aus","vor","für","um","ohne","gegen","durch","seit","und","oder","aber","als","in","an","auf","the","and","with","with","of","to","on","for","a","an"]);
    if(ti===q)s=10;
    else{
      const wordMatch=ti.split(" ").some(w=>refStripAl(w)===refStripAl(q));
      let st=0;
      if(wordMatch)st=REF_STOP.has(q)?6:8;
      else if(ti.indexOf(q)>=0)st=6;
      let sk=0;
      if(kb===2)sk=9;
      else if(kb)sk=7;
      else if(kws.some(k=>k&&k.indexOf(q)===0))sk=5;
      else if(e.kind==="topic"&&e.alias&&e.alias.indexOf(q)>=0&&q.length>=4)sk=5;
      s=Math.max(st,sk);
      if(s===0&&e.hay.indexOf(q)>=0)s=4;
    }
    if(s>0)scored.push({e:e,s:s,kb:kb,tb:ti.indexOf(q)===0?1:0});
  });
  scored.sort((a,b)=>(b.s-a.s)||(b.kb-a.kb)||(b.tb-a.tb));
  const top=scored.slice(0,12);
  if(!top.length){out.innerHTML='<div class="search-hit">'+refEsc(refT("ref_no_results"))+'</div>';out.classList.add("show");return;}
  out.innerHTML=top.map((r,i)=>{
    let why="";
    try{
      if(r.e.kind==="topic"&&r.kb===2)why=" <span class='muted'>≡ "+refEsc(rawQ)+"</span>";
      else if(r.e.kind==="topic"&&r.e.topic.de)why=" <span class='muted'>"+refEsc(r.e.topic.de)+"</span>";
      else if(r.e.kind==="path")why=" <span class='muted'>"+refEsc(r.e.path.de)+"</span>";
    }catch(e){}
    const label=r.e.kind==="path"?("🗂️ "+refEsc(refPathTitle(r.e.path))+why):("📄 "+refEsc(refTopicTitle(r.e.topic))+why+" <span class='muted'>("+r.e.path.id+" • "+refEsc(refPathTitle(r.e.path))+")</span> <span class='"+refLvlClass(r.e.topic.level||"A1")+"'>"+refEsc(r.e.topic.level||"A1")+"</span>");
    return '<div class="search-hit" role="option" data-h="'+i+'">'+label+'</div>';
  }).join("");
  out.classList.add("show");
  out.querySelectorAll("[data-h]").forEach(el=>el.addEventListener("click",()=>{
    const r=top[parseInt(el.getAttribute("data-h"),10)];if(!r)return;
    out.classList.remove("show");try{inp.value="";}catch(e){}
    if(r.e.kind==="path")openRefPath(r.e.path.id);
    else{openRefPath(r.e.path.id,{replace:true});openRefTopic(r.e.topic.id);}
  }));
}

/* ---------- showPage wrap (single render per visit, no DM_LAZY double-call) ---------- */
(function(){
  try{
    if(typeof showPage==="function"&&!showPage._refWrapped){
      const _sp=showPage;
      const REF_PAGES={reference:renderReference};
      showPage=function(n){_sp(n);try{if(REF_PAGES[n])REF_PAGES[n]();}catch(e){if(window.console)console.error(e);}};
      try{showPage._refWrapped=true;}catch(e){}
    }
  }catch(e){}
})();
