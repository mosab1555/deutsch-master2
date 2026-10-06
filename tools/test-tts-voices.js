/* Focused German TTS test (17 points). Mocks browser globals, extracts the real
   functions from client/script.js — no production modifications for tests. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'client', 'script.js'), 'utf8');

function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  const j = src.indexOf('{', i);
  let depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    if (src[k] === '}') { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

// ---- minimal browser harness ----
let __voices = [];
const __elements = {};
function mkSelect() {
  return {
    tag: 'select', innerHTML: '', disabled: false, value: '',
    options: [], children: [],
    appendChild(o) { this.children.push(o); this.options.push(o); if (o.selected) this.value = o.value; },
  };
}
function mkOption() { return { tag: 'option', value: '', textContent: '', disabled: false, selected: false }; }
function mkDiv() { return { tag: 'div', textContent: '', children: [], appendChild(o) { this.children.push(o); } }; }
const toasts = [];
global.window = {};
global.document = {
  createElement(tag) {
    if (tag === 'option') return mkOption();
    if (tag === 'select') return mkSelect();
    return mkDiv();
  },
  getElementById(id) { return __elements[id] || null; },
};
global.SpeechSynthesisUtterance = function (t) { this.text = t; this.lang = ''; this.rate = 1; this.voice = null; this.onerror = null; };
function resetDom() {
  for (const k of Object.keys(__elements)) delete __elements[k];
  __elements.germanVoiceSelect = mkSelect();
  __elements.voiceStatus = mkDiv();
  __elements.voiceHint = mkDiv();
  __elements.toasts = mkDiv();
  toasts.length = 0;
}
resetDom();
global.$ = (id) => document.getElementById(id);
global.t = (k) => k; // identity: proves keys flow through t()
global.toast = (m) => toasts.push(String(m));
let savedSettings = null;
global.save = () => { savedSettings = JSON.parse(JSON.stringify(global.S.settings)); };
global.S = { settings: { germanVoiceURI: '' } };
// voice-module state (mirrors production defaults; direct eval shares scope)
var _deVoice = null;
var _voiceLoadingState = 'idle';
var _voiceLoadRetryCount = 0;
var _voiceLoadMaxRetries = 5;
var _voiceLoadRetryDelay = 1;

function setVoices(list, supported = true) {
  __voices = list;
  if (supported) {
    global.window.speechSynthesis = {
      getVoices: () => __voices,
      cancel() {}, speak() {},
    };
  } else {
    delete global.window.speechSynthesis;
  }
}

// load the real functions under test
const fns = ['isGermanLang', 'getGermanVoices', 'loadGermanVoice', 'getPreferredGermanVoice',
  'setGermanVoiceURI', 'setVoiceLoadingState', 'scheduleVoiceLoadRetry',
  'populateGermanVoiceSelect', 'refreshGermanVoices',
  'updateVoiceStatus', 'hasWebSpeech', 'speakWithWeb', 'getVoiceDiagnostics'].map(extract).join('\n');
eval(fns);

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' [' + extra + ']' : '')); }
}
const V = (name, lang, uri, local = false) => ({ name, lang, voiceURI: uri, localService: local });

// 1-6: language detection
check('T1 de', isGermanLang('de') === true);
check('T2 de-DE', isGermanLang('de-DE') === true);
check('T3 de-AT/de-CH/de-LU/de-LI', isGermanLang('de-AT') && isGermanLang('de-CH') && isGermanLang('de-LU') && isGermanLang('de-LI'));
check('T4 de_DE underscore', isGermanLang('de_DE') === true);
check('T5 uppercase DE-de', isGermanLang('DE-de') === true);
check('T6 non-German rejected', !isGermanLang('en-US') && !isGermanLang('') && !isGermanLang(null) && !isGermanLang('deu'));

// 7: dedup by voiceURI
setVoices([V('A', 'de-DE', 'u1', true), V('A copy', 'de-DE', 'u1', true), V('B', 'de-AT', 'u2'), V('EN', 'en-US', 'u9')]);
check('T7 dedup by voiceURI + filter', getGermanVoices().length === 2);

// 8: ranking de-DE > de > de-AT > de-CH > other, localService tiebreak
setVoices([V('ch', 'de-CH', 'c'), V('at', 'de-AT', 'a'), V('plain', 'de', 'p', false), V('plainLocal', 'de', 'pl', true), V('std', 'de-DE', 's'), V('lux', 'de-LU', 'l')]);
const order = getGermanVoices().map((v) => v.voiceURI).join(',');
check('T8 ranking', order === 's,pl,p,a,c,l', order);

// 9: saved voice restoration
global.S.settings.germanVoiceURI = 'a';
const got9 = getPreferredGermanVoice();
check('T9 saved URI restored', got9 && got9.voiceURI === 'a');

// 10: disappeared saved voice -> best German
global.S.settings.germanVoiceURI = 'gone';
const got10 = getPreferredGermanVoice();
check('T10 missing saved URI falls back', got10 && got10.voiceURI === 's', got10 && got10.voiceURI);

// 11: zero voices -> null + empty state
setVoices([]);
global.S.settings.germanVoiceURI = '';
_voiceLoadingState = 'idle'; _voiceLoadRetryCount = 99; // retries exhausted
const got11 = getPreferredGermanVoice();
const sel11 = __elements.germanVoiceSelect;
sel11.innerHTML = ''; sel11.children = []; sel11.options = [];
// simulate exhausted retries by bumping counter via repeated refresh-free calls is internal;
// instead assert resolver null + populate shows loading-or-empty without throwing
check('T11a zero voices resolver null', got11 === null);
let threw = false;
try { populateGermanVoiceSelect(); } catch (e) { threw = true; }
check('T11b zero voices populate safe', !threw && sel11.children.length === 1 && sel11.children[0].disabled === true);

// 12: Web Speech unavailable
setVoices([], false);
delete global.SpeechSynthesisUtterance;
check('T12a hasWebSpeech false', hasWebSpeech() === false);
threw = false;
try { populateGermanVoiceSelect(); } catch (e) { threw = true; }
check('T12b unavailable state shown', !threw && __elements.voiceStatus.textContent.includes('set_voice_unavailable'));
global.SpeechSynthesisUtterance = function (t) { this.text = t; this.lang = ''; this.rate = 1; this.voice = null; this.onerror = null; };

// 13: fallback — speakWithWeb returns false with no German voice
setVoices([]);
const w13 = speakWithWeb('Guten Tag', 1);
check('T13 speakWithWeb false, fallback chain preserved', w13 === false && src.includes('speakWithAudioUrl(t,rate)'));

// 14: single onvoiceschanged registration
const handlers = (src.match(/\.onvoiceschanged\s*=/g) || []).length;
check('T14 exactly one onvoiceschanged', handlers === 1, 'found ' + handlers);

// 15: selector population with voices
setVoices([V('Anna', 'de-DE', 'u1', true), V('Hans', 'de-AT', 'u2')]);
global.S.settings.germanVoiceURI = 'u2';
resetDom();
populateGermanVoiceSelect();
const sel = __elements.germanVoiceSelect;
check('T15a default + voices listed', sel.children.length === 3 && sel.children[0].value === '', sel.children.length + ' options');
check('T15b saved voice selected', sel.children.some((o) => o.value === 'u2' && o.selected));
check('T15c status ok, no invented providers', __elements.voiceStatus.textContent.includes('set_voice_ok') && sel.children[1].textContent.includes('Anna'));

// 16: refresh resets and repopulates
resetDom();
refreshGermanVoices();
check('T16 refresh repopulates + toast', __elements.germanVoiceSelect.children.length === 3 && toasts.length === 1);

// 17: both pages carry selector + refresh + status/hint
for (const p of ['client/index.html', 'client/academy.html']) {
  const h = fs.readFileSync(path.join(ROOT, p), 'utf8');
  check('T17 ' + p, h.includes('id="germanVoiceSelect"') && h.includes('id="refreshVoices"') && h.includes('id="voiceStatus"') && h.includes('id="voiceHint"'));
}

// no-duplication guards
for (const n of ['getPreferredGermanVoice', 'populateGermanVoiceSelect', 'speakGerman', 'speak(']) {
  const c = (src.match(new RegExp('function ' + n.replace('(', '\\('), 'g')) || []).length;
  check('NODUP ' + n, n === 'speak(' ? c === 1 : c === 1, 'found ' + c);
}
check('NODUP single speech chain', (src.match(/function speakGerman\(/g) || []).length === 1 && (src.match(/function speakWithWeb\(/g) || []).length === 1);
check('NODUP no second TTS system', !/voiceManager|ttsManager|newTTS|newVoiceSystem/i.test(src));

console.log('----');
console.log(`TOTAL pass=${pass} fail=${fail} RESULT: ${fail ? 'FAIL' : 'PASS'}`);
process.exit(fail ? 1 : 0);
