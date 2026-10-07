/* Deutsch Master - Facebook OAuth code-side regression tests.
 * Verifies the in-repository Facebook Login repair WITHOUT any network,
 * dashboard, or provider credentials (fully stubbed Supabase client):
 *  - exact provider identifier "facebook" (never a custom id)
 *  - no Google config leaks into the Facebook call (and vice versa)
 *  - single shared Supabase client reused
 *  - redirect targets: localhost / production / missing-config fallback /
 *    Capacitor native shell (never the desktop dev URL there)
 *  - the reported HTTP-400 shape {code,error_code,msg} maps to a clean
 *    Arabic unavailable message (never "[object Object]")
 *  - cancellation maps to a cancel message; other providers untouched
 *  - OAuth attempts are logged with metadata only (no tokens/secrets)
 * Usage: node tools/test-facebook-auth.js  (exit 0 = PASS, 1 = FAIL)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const RD = p => fs.readFileSync(path.join(root, p), "utf8");
let pass = 0, fail = 0;
function check(n, c, x) { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (x ? "  [" + x + "]" : "")); } }

/* ---------- sandbox with stubbed browser + Supabase ---------- */
function bootAuth(oauthImpl, location) {
  const calls = { oauth: [], inserts: [] };
  const store = {};
  const loc = location || { hostname: "mosab1555.github.io", origin: "https://mosab1555.github.io", pathname: "/deutsch-master2/", search: "", href: "https://mosab1555.github.io/deutsch-master2/" };
  const fakeClient = {
    auth: {
      signInWithOAuth: function (args) {
        calls.oauth.push(JSON.parse(JSON.stringify(args)));
        return Promise.resolve(oauthImpl(args));
      },
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
      signUp: () => Promise.resolve({ data: {}, error: null }),
      signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
      verifyOtp: () => Promise.resolve({ data: {}, error: null }),
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
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { userAgent: "node-test" },
    location: loc,
    window: null, SUPABASE_CONFIG: null
  };
  sandbox.window = sandbox;
  sandbox.window.matchMedia = () => ({ matches: false });
  sandbox.window.supabase = { createClient: () => fakeClient };
  sandbox.window.SUPABASE_CONFIG = {
    url: "https://example.supabase.co", anonKey: "sb_publishable_test",
    redirectUrls: { local: "http://127.0.0.1:5500/", production: "https://mosab1555.github.io/deutsch-master2/" }
  };
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(RD("client/auth.js"), sandbox, { filename: "auth.js" });
  const Auth = vm.runInContext("window.AuthModule", sandbox);
  Auth.init(sandbox.window.SUPABASE_CONFIG);
  return { Auth, calls, sandbox };
}
const okOAuth = () => ({ data: { url: "https://example.supabase.co/auth/v1/authorize?x" }, error: null });
const disabledOAuth = () => ({ data: {}, error: { code: 400, error_code: "validation_failed", msg: "Unsupported provider: provider is not enabled" } });

/* ---------- FB1: exact provider id, no cross-config ---------- */
(function () {
  const { Auth, calls } = bootAuth(okOAuth);
  return Auth.signInWithFacebook().then(r => {
    check("FB1: facebook uses provider 'facebook'", calls.oauth.length === 1 && calls.oauth[0].provider === "facebook", JSON.stringify(calls.oauth));
    check("FB1: no invented provider id", !/fb|meta/i.test(calls.oauth[0].provider.replace("facebook", "")));
    check("FB1: facebook carries no Google queryParams", !calls.oauth[0].options.queryParams, JSON.stringify(calls.oauth[0].options));
    check("FB1: success returns data without error", !r.error && !!r.data);
    return Auth.signInWithGoogle().then(rg => {
      check("FB1: google still uses provider 'google' + offline consent", calls.oauth[1].provider === "google" &&
        calls.oauth[1].options.queryParams.access_type === "offline", JSON.stringify(calls.oauth[1]));
      check("FB1: google carries no facebook fields", JSON.stringify(calls.oauth[1]).indexOf("facebook") < 0);
      check("FB1: single shared client", Auth.getClient() === Auth.getClient() && !!Auth.getClient());
      void rg;
    });
  });
})().then(() => {
/* ---------- FB2: redirect targets ---------- */
(function () {
  const prod = bootAuth(okOAuth);
  prod.Auth.signInWithFacebook();
  check("FB2: production uses configured production URL",
    prod.calls.oauth[0].options.redirectTo === "https://mosab1555.github.io/deutsch-master2/",
    prod.calls.oauth[0].options.redirectTo);
  const local = bootAuth(okOAuth, { hostname: "127.0.0.1", origin: "http://127.0.0.1:5500", pathname: "/", search: "", href: "http://127.0.0.1:5500/" });
  local.Auth.signInWithFacebook();
  check("FB2: localhost uses local URL", local.calls.oauth[0].options.redirectTo === "http://127.0.0.1:5500/", local.calls.oauth[0].options.redirectTo);
  const nocfg = bootAuth(okOAuth, { hostname: "example.com", origin: "https://example.com", pathname: "/app/", search: "", href: "https://example.com/app/" });
  delete nocfg.sandbox.window.SUPABASE_CONFIG.redirectUrls;
  nocfg.Auth.signInWithFacebook();
  check("FB2: missing config falls back to current doc URL (never undefined)",
    nocfg.calls.oauth[0].options.redirectTo === "https://example.com/app/", String(nocfg.calls.oauth[0].options.redirectTo));
  const cap = bootAuth(okOAuth, { hostname: "localhost", origin: "https://localhost", pathname: "/", search: "", href: "https://localhost/" });
  cap.sandbox.window.Capacitor = { isNative: true };
  cap.Auth.signInWithFacebook();
  const capTo = cap.calls.oauth[0].options.redirectTo;
  check("FB2: Capacitor never gets the desktop dev URL", capTo !== "http://127.0.0.1:5500/", capTo);
  check("FB2: Capacitor echoes WebView origin", capTo === "https://localhost/", capTo);
})();

/* ---------- FB3: disabled-provider error mapping ---------- */
(function () {
  const { Auth } = bootAuth(disabledOAuth);
  return Auth.signInWithFacebook().then(r => {
    check("FB3: disabled provider surfaces error object", !!r.error, JSON.stringify(r).slice(0, 80));
    const ar = Auth.translateError(r.error, "facebook");
    check("FB3: facebook-disabled maps to Arabic unavailable message",
      /غير متاح/.test(ar) && /فيسبوك/.test(ar) && !/object Object/.test(ar), ar);
    const generic = Auth.translateError(r.error);
    check("FB3: no hint stays generic but clean", /غير متاح/.test(generic) && !/object Object/.test(generic), generic);
    const cancel = Auth.translateError({ message: "OAuth access_denied" }, "facebook");
    check("FB3: cancellation maps to cancel message", /إلغاء|ألغ/.test(cancel), cancel);
    const net = Auth.translateError({ message: "fetch failed" }, "facebook");
    check("FB3: network still maps to connectivity message", /الإنترنت/.test(net), net);
    const creds = Auth.translateError({ message: "Invalid login credentials" });
    check("FB3: email errors untouched", /غير صحيحة/.test(creds), creds);
  });
})().then(() => {
/* ---------- FB4: logging is metadata-only ---------- */
(function () {
  const { Auth, calls } = bootAuth(disabledOAuth);
  return Auth.signInWithFacebook().then(() => {
    const log = calls.inserts.find(i => i.event_type === "sign_in" && i.provider === "facebook");
    check("FB4: facebook attempt logged with provider tag", !!log, JSON.stringify(calls.inserts).slice(0, 120));
    const blob = JSON.stringify(calls.inserts);
    check("FB4: no tokens/secrets/keys logged", !/token|secret|key|password|sb_publishable|sb_secret/i.test(blob), blob.slice(0, 120));
    check("FB4: failure flagged", log && log.success === false);
  });
})().then(() => {
/* ---------- FB5: no dashboard-coupled code, no duplicates ---------- */
(function () {
  const src = RD("client/auth.js");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  check("FB5: exactly one facebook OAuth call site", (stripped.match(/provider:\s*["']facebook["']/g) || []).length === 1);
  check("FB5: exactly one google OAuth call site", (stripped.match(/provider:\s*["']google["']/g) || []).length === 1);
  check("FB5: no second createClient", (stripped.match(/createClient\(/g) || []).length === 1);
  check("FB5: no hardcoded secrets", !/sb_secret|service_role|apps\.googleusercontent|BEGIN PRIVATE|AIza/i.test(src));
  check("FB5: www copy in sync", RD("www/auth.js") === src);
})();
console.log("----");
if (fail) { console.log("RESULT: FAIL (" + fail + ")"); process.exit(1); }
console.log("RESULT: PASS (" + pass + ")");
}).catch(function (e) { console.log("FAIL harness threw: " + (e && e.message)); process.exit(1); });
}).catch(function (e) { console.log("FAIL harness threw: " + (e && e.message)); process.exit(1); });
}).catch(function (e) { console.log("FAIL harness threw: " + (e && e.message)); process.exit(1); });
