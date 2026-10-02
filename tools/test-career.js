/* Tests for the career pathway (client/career.js, data + wiring):
   - 2 tracks (ausbildung + pflege) with prerequisites, no false promises
   - every module: vocab w/ article+plural, phrases, dialogue, follow-up, quiz
   - quiz validity: 4 options, correct index in range, Arabic why
   - unique module/quiz ids, stable relationship ids (grammar g-ids)
   - nursing honesty labels, interview practice-example labels
   - browser wiring: nav + section + scripts in both HTML shells
   Run: node tools/test-career.js (from project root) */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(root, "client", "career.js"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
/* data section = before RENDERERS banner */
const _pe = SRC.indexOf("/* ====================== RENDERERS (browser)");
const DATA = SRC.slice(0, _pe);
const TRACKS = new Function(DATA + "\nreturn CAREER_TRACKS;")();

check("U1 two tracks", TRACKS.length === 2, String(TRACKS.length));
check("U2 track ids", TRACKS[0].id === "ausbildung" && TRACKS[1].id === "pflege");
TRACKS.forEach(t => {
  check("U3 " + t.id + " has intro+prereq", !!(t.intro && t.prereq), t.id);
  check("U4 " + t.id + " has 4 modules", t.modules.length === 4, t.id + ":" + t.modules.length);
});
/* honesty: disclaimers present, and no positive promise phrasing */
const LOW = SRC.toLowerCase();
check("U5 no-certificate claim", SRC.indexOf("لا يعني شهادة رسمية") >= 0);
check("U5 no-job-guarantee claim", SRC.indexOf("لا يضمن قبول") >= 0);
check("U5 interview practice-only label", SRC.indexOf("وليست أسئلة رسمية مضمونة") >= 0);
check("U5 nursing not-medical-advice label", SRC.indexOf("ليس تعليمات طبية") >= 0);
["نضمن لك", "guaranteed job", "guaranteed admission", "official exam"].forEach(w => {
  check("U5 no promise: " + w.slice(0, 20), LOW.indexOf(w.toLowerCase()) < 0, w);
});
check("U6 interview labeled practice-only", SRC.indexOf("للتدريب فقط") >= 0);
check("U7 nursing language-only label", SRC.indexOf("لغوي فقط") >= 0);

const modIds = new Set();
let quizN = 0, vocabN = 0, badQ = "", badV = "";
TRACKS.forEach(t => t.modules.forEach(m => {
  if (modIds.has(m.id)) badQ += "dupmod:" + m.id;
  modIds.add(m.id);
  if (!m.followup || !m.followup.q || !m.followup.a || !m.followup.aAr) badQ += "followup:" + m.id + " ";
  (m.vocab || []).forEach(v => {
    vocabN++;
    /* [de, art, ar, plural, exDe, exAr] complete + article/plural sane */
    if (!(v[0] && v[1] && v[2] && v[3] && v[4] && v[5])) badV += "fields:" + v[0] + " ";
    if (["der", "die", "das", "-"].indexOf(v[1]) < 0) badV += "art:" + v[0] + " ";
    if (/^(der|die|das)\b/.test(v[0])) {
      const art = v[0].split(" ")[0];
      if (art !== v[1]) badV += "artclash:" + v[0] + " ";
    }
  });
  if (!(m.phrases && m.phrases.length >= 3)) badQ += "phrases:" + m.id + " ";
  if (!(m.dialogue && m.dialogue.length >= 4)) badQ += "dialogue:" + m.id + " ";
  if (!(m.grammar && m.grammar.length)) badQ += "grammar:" + m.id + " ";
  (m.quiz || []).forEach((q, i) => {
    quizN++;
    if (!(q.opts && q.opts.length === 4)) badQ += "opts:" + m.id + i + " ";
    if (!(q.c >= 0 && q.c < 4)) badQ += "correct:" + m.id + i + " ";
    if (!q.why) badQ += "why:" + m.id + i + " ";
    if (new Set(q.opts).size !== 4) badQ += "dupopts:" + m.id + i + " ";
    const qid = m.id + "-q" + i;
    if (modIds.has(qid)) badQ += "dupqid:" + qid;
    modIds.add(qid);
  });
}));
check("U8 all modules have vocab/phrases/dialogue/grammar/followup", badQ === "" && badV === "", (badQ + " " + badV).slice(0, 200));
check("U9 vocab entries complete with article+plural+example", vocabN >= 40, "n=" + vocabN);
check("U10 quiz count (8 modules x 5)", quizN === 40, "n=" + quizN);

/* wiring */
["index.html", "academy.html"].forEach(f => {
  const h = fs.readFileSync(path.join(root, "client", f), "utf8");
  check("U11 " + f + " career nav (1 icon)", (h.match(/data-page="career"/g) || []).length === 1);
  check("U12 " + f + " career section+box", h.indexOf('id="page-career"') >= 0 && h.indexOf('id="careerBox"') >= 0);
  check("U13 " + f + " career.js after script.js", h.indexOf("career.js") > h.indexOf("script.js"));
});
const sw = fs.readFileSync(path.join(root, "client", "sw.js"), "utf8");
check("U14 sw precaches career.js", sw.indexOf("career.js") >= 0);
check("U15 sw version bumped (v32+)", /german-academy-v(3[2-9]|[4-9]\d)/.test(sw));
const script = fs.readFileSync(path.join(root, "client", "script.js"), "utf8");
check("U16 career retry route in mistakes", script.indexOf('m-(ausb|pfl)-') >= 0);
check("U17 career uses fair option shuffle", SRC.indexOf("dmQuizOrder") >= 0);
check("U18 career logs DMProgress events", SRC.indexOf("DMProgress.logAttempt") >= 0);

console.log("----");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail === 0 ? "PASS" : "FAIL"));
process.exit(fail === 0 ? 0 : 1);
