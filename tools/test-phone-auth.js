/* Deutsch Master - Phone OTP authentication regression tests.
 * Verifies the phone/SMS OTP repair WITHOUT any network or real SMS
 * (fully stubbed Supabase client, stdlib only):
 *  1-2.  Egyptian normalization (valid forms -> E.164, invalid -> null)
 *  3-4.  signInWithOtp / verifyOtp invocation shapes (SMS, never OAuth)
 *  5-8.  OTP error translations (invalid / expired / rate-limit / attempts)
 *  9-11. UX guards present (loading reset, double-click, resend cooldown)
 *  12.    successful session handling continues the shared flow
 *  13.    phone errors never classified as OAuth/external-account
 *  14-16. Google / Facebook / Email+password paths untouched
 * Usage: node tools/test-phone-auth.js  (exit 0 = PASS, 1 = FAIL)
 */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const RD = (p) => fs.readFileSync(path.join(root, p), "utf8");
let pass = 0, fail = 0;
function check(n, c, x) {
  if (c) { pass++; console.log("PASS " + n); }
  else { fail++; console.log("FAIL " + n + (x ? "  [" + String(x).slice(0, 220) + "]" : "")); }
}

/* ---------- sandbox with stubbed browser + Supabase ---------- */
function bootAuth(impl) {
  impl = impl || {};
  const calls = { otp: [], verify: [], oauth: [], pw: [], inserts: [] };
  const store = {};
  const fakeClient = {
    auth: {
      signInWithOAuth: function (args) {
        calls.oauth.push(JSON.parse(JSON.stringify(args)));
        return Promise.resolve((impl.oauth || (() => ({ data: {}, error: null }))(args)));
      },
      signInWithPassword: function (args) {
        calls.pw.push(JSON.parse(JSON.stringify(args)));
        return Promise.resolve((impl.pw || (() => ({ data: { user: { id: "u1" } }, error: null }))(args)));
      },
      signUp: () => Promise.resolve({ data: {}, error: null }),
      signInWithOtp: function (args) {
        calls.otp.push(JSON.parse(JSON.stringify(args)));
        const fn = impl.otp || (() => ({ data: {}, error: null }));
        return Promise.resolve(fn(args));
      },
      verifyOtp: function (args) {
        calls.verify.push(JSON.parse(JSON.stringify(args)));
        const fn = impl.verify || (() => ({ data: { user: { id: "u-phone" }, session: { user: { id: "u-phone" } } }, error: null }));
        return Promise.resolve(fn(args));
      },
      resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
      updateUser: () => Promise.resolve({ data: {}, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => {}
    },
    from: function () {
      return {
        insert: function (row) { calls.inserts.push(JSON.parse(JSON.stringify(row))); return Promise.resolve({}); },
        select: function () { return this; }, eq: function () { return this; },
        single: function () { return Promise.resolve({ data: null, error: null }); },
        update: function () { return this; }, upsert: function () { return this; }
      };
    }
  };
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    navigator: { userAgent: "node-test" },
    location: { hostname: "x", origin: "https://x", pathname: "/", search: "", href: "https://x/" },
    window: null, SUPABASE_CONFIG: null
  };
  sandbox.window = sandbox;
  sandbox.window.matchMedia = () => ({ matches: false });
  sandbox.window.supabase = { createClient: () => fakeClient };
  sandbox.window.SUPABASE_CONFIG = { url: "https://example.supabase.co", anonKey: "sb_publishable_test" };
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(RD("client/auth.js"), sandbox, { filename: "auth.js" });
  const Auth = vm.runInContext("window.AuthModule", sandbox);
  Auth.init(sandbox.window.SUPABASE_CONFIG);
  return { Auth, calls };
}

(async () => {
  /* ---------- 1-2: normalization ---------- */
  {
    const { Auth } = bootAuth();
    const N = Auth.normalizeEgyptianPhone;
    check("PH1: normalize exported", typeof N === "function");
    const valid = [
      ["01095202373", "+201095202373"],
      ["01112345678", "+201112345678"],
      ["01212345678", "+201212345678"],
      ["01512345678", "+201512345678"],
      ["+201095202373", "+201095202373"],
      ["201095202373", "+201095202373"],
      ["00201095202373", "+201095202373"],
      ["010 9520 2373", "+201095202373"],
      ["010-9520-2373", "+201095202373"],
      ["(010) 9520-2373", "+201095202373"],
      ["1095202373", "+201095202373"],
      ["\u0660\u0661\u0660\u0669\u0665\u0662\u0660\u0662\u0663\u0667\u0663", "+201095202373"],
    ];
    let okAll = true, bad = "";
    for (const [inp, exp] of valid) {
      const got = N(inp);
      if (got !== exp) { okAll = false; bad = JSON.stringify(inp) + "->" + JSON.stringify(got) + " want " + exp; break; }
    }
    check("PH1: valid Egyptian forms normalize to E.164", okAll, bad);
    // Already-normalized numbers are never transformed twice.
    check("PH1: idempotent E.164", N("+201095202373") === "+201095202373" && N(N("+201095202373")) === "+201095202373");
    const invalid = ["", "123", "010123", "01912345678", "02-1234567", "abcdef", "+201912345678", "+20", "++201095202373", null, undefined];
    let rejAll = true, rejBad = "";
    for (const inp of invalid) {
      const got = N(inp);
      if (got !== null) { rejAll = false; rejBad = JSON.stringify(inp) + "->" + JSON.stringify(got); break; }
    }
    check("PH2: invalid numbers rejected (null, never coerced)", rejAll, rejBad);
    check("PH2: OTP sanitizer strips spaces", Auth.sanitizeOtpCode(" 12 34 56 ") === "123456");
  }

  /* ---------- 3: sendPhoneOTP invocation ---------- */
  {
    const { Auth, calls } = bootAuth();
    const r = await Auth.sendPhoneOTP("01095202373");
    check("PH3: send uses signInWithOtp (not OAuth)", calls.otp.length === 1 && calls.oauth.length === 0, JSON.stringify(calls.otp));
    check("PH3: phone normalized to E.164", calls.otp[0] && calls.otp[0].phone === "+201095202373", JSON.stringify(calls.otp[0]));
    check("PH3: SMS channel requested", calls.otp[0] && calls.otp[0].options && calls.otp[0].options.channel === "sms", JSON.stringify(calls.otp[0] && calls.otp[0].options));
    check("PH3: success carries normalized phone", !r.error && r.phone === "+201095202373", JSON.stringify(r).slice(0, 120));
    // Invalid number: pre-validated locally, Supabase never called.
    const before = calls.otp.length;
    const bad = await Auth.sendPhoneOTP("not-a-number");
    check("PH3: invalid number rejected before network", !!bad.error && /مصريًا صحيحًا/.test(String(bad.error)) && calls.otp.length === before, JSON.stringify(bad).slice(0, 120));
  }

  /* ---------- 4: verifyPhoneOTP invocation ---------- */
  {
    const { Auth, calls } = bootAuth();
    const r = await Auth.verifyPhoneOTP("01095202373", " 123456 ");
    check("PH4: verify uses verifyOtp type sms", calls.verify.length === 1 && calls.verify[0].type === "sms", JSON.stringify(calls.verify[0]));
    check("PH4: verify phone normalized + token trimmed", calls.verify[0].phone === "+201095202373" && calls.verify[0].token === "123456", JSON.stringify(calls.verify[0]));
    check("PH4: success surfaces user/session", !r.error && !!(r.data && (r.data.user || r.data.session)), JSON.stringify(r).slice(0, 120));
    const short = await Auth.verifyPhoneOTP("01095202373", "123");
    check("PH4: short OTP rejected locally", !!short.error && calls.verify.length === 1, JSON.stringify(short).slice(0, 100));
  }

  /* ---------- 5-8: error translations ---------- */
  {
    const { Auth } = bootAuth();
    const T = (e) => Auth.translateError(e, "phone");
    check("PH5: invalid OTP -> precise Arabic", T({ message: "Invalid OTP token" }) === "رمز التحقق غير صحيح.", T({ message: "Invalid OTP token" }));
    check("PH7: expired OTP -> expired Arabic", T({ message: "Token has expired or is invalid: otp_expired" }) === "انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.", T({ message: "otp_expired" }));
    check("PH6: rate limit -> wait Arabic", T({ message: "over_sms_send_rate_limit" }) === "لقد طلبت رموز تحقق كثيرة. انتظر قليلًا ثم حاول مرة أخرى.", T({ message: "over_sms_send_rate_limit" }));
    check("PH8: too many attempts -> attempts Arabic", T({ message: "Too many verification attempts" }) === "تم تجاوز عدد محاولات التحقق. حاول مرة أخرى لاحقًا.", T({ message: "Too many attempts" }));
    check("PH5b: invalid phone -> invalid-number Arabic", T({ message: "Invalid phone number: must be in E.164 format" }) === "رقم الهاتف غير صحيح. أدخل رقمًا مصريًا صحيحًا.", T({ message: "Invalid phone" }));
    check("PH9: SMS not configured -> explicit unavailable Arabic",
      T({ message: "SMS provider not configured" }) === "تسجيل الدخول برقم الهاتف غير متاح حاليًا لأن خدمة SMS غير مفعلة." &&
      T({ code: 400, error_code: "validation_failed", msg: "Unsupported provider: provider is not enabled" }) === "تسجيل الدخول برقم الهاتف غير متاح حاليًا لأن خدمة SMS غير مفعلة.",
      T({ message: "SMS provider not configured" }));
    check("PH9b: network -> connectivity Arabic", /الإنترنت/.test(T({ message: "fetch failed" })), T({ message: "fetch failed" }));
  }

  /* ---------- 13: phone never classified as OAuth/external ---------- */
  {
    const { Auth } = bootAuth();
    const phoneErrors = [
      { message: "SMS provider not configured" },
      { message: "Phone provider is not enabled" },
      { message: "Invalid phone number" },
      { message: "Invalid OTP token" },
      { message: "otp_expired" },
      { message: "over_sms_send_rate_limit" },
      { message: "Too many verification attempts" },
      { message: "fetch failed" },
      { message: "some totally unknown phone failure" },
      { code: 400, error_code: "validation_failed", msg: "Unsupported provider: provider is not enabled" },
    ];
    let leaked = "";
    for (const e of phoneErrors) {
      const ar = Auth.translateError(e, "phone");
      if (/الخارجي/.test(ar) || /OAuth/.test(ar)) { leaked = ar; break; }
    }
    check("PH13: no phone error mentions external/OAuth", !leaked, leaked);
    // Even without a hint, SMS-provider-shaped errors must not use OAuth wording.
    const noHint = Auth.translateError({ message: "SMS provider not configured" });
    check("PH13b: provider-shaped SMS error without hint still not OAuth", !/الحساب الخارجي/.test(noHint), noHint);
  }

  /* ---------- 9-11: UX guards (static: real handler source) ---------- */
  {
    const appInit = RD("client/app-init.js");
    const idx = RD("client/index.html");
    check("PH9: send/verify restore button on failure", /setButtonLoading\(activeBtn, false/.test(appInit) && /setButtonLoading\(btn, false/.test(appInit), "restore paths");
    check("PH9b: promise-unavailable never leaves loading", (appInit.match(/typeof promise\.then !== "function"/g) || []).length >= 2, "undefined-promise guards");
    check("PH10: double-submit guarded", (appInit.match(/isBusy\(btn\)/g) || []).length >= 2 && /isBusy\(resendBtn\)/.test(appInit), "isBusy guards");
    check("PH10b: verify pending disables button", /setButtonLoading\(btn, true\)/.test(appInit), "verify loading");
    check("PH11: resend cooldown wiring", /OTP_RESEND_SECONDS = 60/.test(appInit) && /startResendCooldown/.test(appInit) && /btnResendOTP/.test(appInit), "cooldown");
    check("PH11b: resend button exists in UI", /id="btnResendOTP"/.test(idx), "btnResendOTP");
    check("PH12: OTP input focused after send", /authOTP["']?\)?\.?focus|otpInput[\s\S]{0,120}focus/.test(appInit), "focus");
    check("PH12b: OTP form shown only after success", /showOtpForm\(\);/.test(appInit) && /lastPhoneE164 = \(result/.test(appInit), "gated OTP form");
  }

  /* ---------- 12: session continues the shared flow ---------- */
  {
    const appInit = RD("client/app-init.js");
    check("PH12c: single shared auth listener kept", /onAuthStateChange/.test(appInit) && /handleSession\(session/.test(appInit), "listener->handleSession");
    check("PH12d: verify success relies on session event (no parallel auth)", !/verifyPhoneOTP[\s\S]{0,400}setActiveUser|verifyPhoneOTP[\s\S]{0,400}fullSync/.test(appInit), "no bypass");
  }

  /* ---------- 14-16: other providers untouched ---------- */
  {
    const { Auth, calls } = bootAuth();
    await Auth.signInWithGoogle();
    check("PH14: Google still OAuth google+offline consent",
      calls.oauth.length === 1 && calls.oauth[0].provider === "google" && calls.oauth[0].options.queryParams.access_type === "offline",
      JSON.stringify(calls.oauth[0]));
    await Auth.signInWithFacebook();
    check("PH15: Facebook still OAuth facebook", calls.oauth[1].provider === "facebook", JSON.stringify(calls.oauth[1]));
    const gAr = Auth.translateError({ message: "x provider is not enabled" }, "google");
    check("PH15b: Google provider-disabled wording intact", /Google/.test(gAr) && !/الهاتف/.test(gAr), gAr);
    await Auth.signInWithEmail("Test@Example.COM", "secret123");
    check("PH16: email/password path intact (trim+lowercase)", calls.pw.length === 1 && calls.pw[0].email === "test@example.com", JSON.stringify(calls.pw[0]));
    const creds = Auth.translateError({ message: "Invalid login credentials" });
    check("PH16b: email error wording untouched", /غير صحيحة/.test(creds), creds);
  }

  /* ---------- hygiene: no secrets, single client, www sync ---------- */
  {
    const src = RD("client/auth.js");
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    check("PH-H: no second createClient", (stripped.match(/createClient\(/g) || []).length === 1);
    check("PH-H: no hardcoded secrets", !/sb_secret|service_role|BEGIN PRIVATE|AIza/i.test(src));
    check("PH-H: phone never routes via signInWithOAuth", !/sendPhoneOTP[\s\S]{0,600}signInWithOAuth|verifyPhoneOTP[\s\S]{0,600}signInWithOAuth/.test(src));
    check("PH-H: www/auth.js in sync", RD("www/auth.js") === src, "run npm run www after edit");
    check("PH-H: www/app-init.js in sync", RD("www/app-init.js") === RD("client/app-init.js"), "run npm run www after edit");
    check("PH-H: www/index.html in sync", RD("www/index.html") === RD("client/index.html"), "run npm run www after edit");
  }

  console.log("----");
  if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
  console.log("RESULT: PASS (" + pass + ")");
})().catch((e) => { console.log("FAIL harness threw: " + ((e && e.message) || e)); process.exit(1); });
