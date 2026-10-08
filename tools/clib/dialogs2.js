/* Extra dialogue situations (5) to reach 125 total. Same format as dialogs.js */
"use strict";
const EXTRA=[
["pharmacy","A1","Rezept einlösen","صرف وصفة",[["K","Guten Tag! Hier ist mein Rezept.","مرحبًا! هذه وصفتي."],["A","Danke. Einen Moment...","شكرًا. لحظة..."],["K","Muss ich zuzahlen?","هل أدفع فرقًا؟"],["A","Nein, die Kasse zahlt.","لا، التأمين يدفع."],["K","Wunderbar!","رائع!"],["A","Gute Besserung!","شفاك الله!"]]],
["emergency","A2","Notruf 112","الاتصال بالطوارئ",[["L","Notruf, was ist passiert?","الطوارئ، ماذا حدث؟"],["A","Ein Fahrradunfall bei {P}.","حادث دراجة عند {P}."],["L","Ist jemand verletzt?","هل أحد مصاب؟"],["A","Ja, {N} blutet.","نعم، {N} ينزف."],["L","Bleiben Sie da. Hilfe kommt.","ابقَ هناك. المساعدة قادمة."],["A","Danke! Ich warte.","شكرًا! سأنتظر."]]],
["interviews","A2","Gehaltsfrage","سؤال الراتب",[["C","Was stellen Sie sich vor?","ما توقعاتك؟"],["B","{N2} Euro im Monat.","{N2} يورو شهريًا."],["C","Das ist verhandelbar.","هذا قابل للتفاوض."],["B","Ab wann kann ich anfangen?","من متى أبدأ؟"],["C","Ab {T}, passt das?","من {T}، هل يناسب؟"],["B","Perfekt, danke!","ممتاز، شكرًا!"]]],
["supermarket","A2","Pfandflaschen","زجاجات الإيداع",[["C","Wo ist der Pfandautomat?","أين جهاز الزجاجات؟"],["M","Hinten bei {P}, links.","في الخلف عند {P} يسارًا."],["C","Danke! Geht auch {I}?","شكرًا! هل يقبل {I}؟"],["M","Nur mit Pfandzeichen.","فقط بعلامة الإيداع."],["C","Verstanden.","مفهوم."],["M","Bon an der Kasse abgeben.","سلّم الإيصال عند الصندوق."]]],
["documents","A1","Kopie beglaubigen","تصديق نسخة",[["K","Ich brauche eine beglaubigte Kopie.","أحتاج نسخة مصدقة."],["B","Original dabei?","هل الأصل معك؟"],["K","Ja, hier.","نعم، تفضل."],["B","Das macht {N2} Euro.","{N2} يورو."],["K","Bitte sehr.","تفضل."],["B","Einen Moment... Fertig!","لحظة... انتهى!"]]]
];
if(typeof module!=="undefined")module.exports={EXTRA};
