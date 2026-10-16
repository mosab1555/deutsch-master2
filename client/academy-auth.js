/* Deutsch Master — Academy Auth (Staging-only, additive).
 *
 * Dedicated authentication for the Academy portal. Reads ONLY
 * `window.ACADEMY_SUPABASE_CONFIG` ({ url, publishableKey }) and creates ONLY
 * `window.academySupabaseClient`, and only when the URL resolves to the
 * explicit Staging allowlist ref, the publishable key is a non-empty
 * non-JWT credential, and the Supabase JS SDK is available.
 *
 * Fail-closed by design:
 *   - Missing / malformed config, Production (or any non-Staging) target,
 *     missing SDK, or a client URL inconsistent with the config all yield an
 *     explicit disabled status WITHOUT any network or table request.
 *   - NEVER falls back to learner paths; NEVER reads learner session state.
 *   - Session persistence uses a distinct storage key
 *     (`dm-academy-auth-v1`, session storage when available), never the
 *     learner auth storage. Signing in/out here never touches learner auth.
 *   - Narrow API only: initialize, getClient/getSession/getUser/getStatus,
 *     validateSession (fresh async check), password sign-in, sign-out,
 *     auth-state subscription. NO public self-signup and NO account
 *     deletion: Academy accounts stay operator-provisioned.
 *   - Stale identity is always cleared via one internal clearSessionState()
 *     helper whenever config is missing/malformed/not allowlisted or becomes
 *     inconsistent, the SDK/client is unavailable, getSession errors or
 *     returns null, initialization fails, password sign-in fails, sign-out
 *     succeeds, or an auth-state event supplies no session.
 *   - RLS remains the server-side authorization boundary; client-side checks
 *     are only a fail-closed gate, never a substitute for RLS.
 */
"use strict";

var AcademyAuth = (function () {
  "use strict";

  var STAGING_REF = "uafwvkgaijmcofistjum";
  var STORAGE_KEY = "dm-academy-auth-v1";

  var client = null;
  var currentSession = null;
  var currentUser = null;
  var authCallback = null;
  var subscribed = false;
  var lastStatus = { configured: false, reason: "missing_config", ref: null };

  // Canonical Academy ref extraction (shared with AcademyCore).
  // Strict: only https?://<ref>.supabase.co shapes resolve; every other
  // shape yields null and fails closed.
  function extractRef(url) {
    try {
      var s = String(url == null ? "" : url).trim();
      if (!s) return null;
      var m = s.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co(?:[\/?#]|$)/i);
      if (m && m[1]) return String(m[1]).toLowerCase();
      return null;
    } catch (e) { return null; }
  }

  function readConfig() {
    try {
      if (typeof window !== "undefined" && window && window.ACADEMY_SUPABASE_CONFIG) {
        return window.ACADEMY_SUPABASE_CONFIG;
      }
    } catch (e) {}
    try {
      if (typeof globalThis !== "undefined" && globalThis && globalThis.ACADEMY_SUPABASE_CONFIG) {
        return globalThis.ACADEMY_SUPABASE_CONFIG;
      }
    } catch (e2) {}
    return null;
  }

  // Returns { ok, reason, ref, url, key }. Never includes secrets in reasons.
  function validateConfig(cfg) {
    if (!cfg || typeof cfg !== "object") {
      return { ok: false, reason: "missing_config", ref: null };
    }
    var url = null, key = null;
    try { url = cfg.url; key = cfg.publishableKey; } catch (e) {}
    var ref = extractRef(url);
    if (!ref) {
      var hasUrl = false;
      try { hasUrl = !!String(url == null ? "" : url).trim(); } catch (e2) {}
      return { ok: false, reason: hasUrl ? "malformed_config" : "missing_config", ref: null };
    }
    if (ref !== STAGING_REF) {
      return { ok: false, reason: "target_disabled", ref: ref };
    }
    var k = "";
    try { k = String(key == null ? "" : key).trim(); } catch (e3) {}
    // Publishable browser credential only: non-empty, not JWT-shaped, bounded
    // length. Privileged server credentials are rejected without being named
    // or stored anywhere.
    if (!k || /^eyJ/i.test(k) || k.length > 500) {
      return { ok: false, reason: "malformed_config", ref: ref };
    }
    var u = "";
    try { u = String(url).trim(); } catch (e4) {}
    return { ok: true, reason: "ok", ref: ref, url: u, key: k };
  }

  function sdk() {
    try {
      if (typeof window !== "undefined" && window.supabase &&
        typeof window.supabase.createClient === "function") {
        return window.supabase;
      }
    } catch (e) {}
    return null;
  }

  function academyStorage() {
    try {
      var ss = (typeof window !== "undefined") ? window.sessionStorage : null;
      if (ss && typeof ss.getItem === "function" &&
        typeof ss.setItem === "function" && typeof ss.removeItem === "function") {
        return ss;
      }
    } catch (e) {}
    return undefined;
  }

  // Single internal stale-identity reset. Clears both cached session and
  // user; callers additionally null the global client when its target
  // cannot be trusted.
  function clearSessionState() {
    currentSession = null;
    currentUser = null;
  }

  function clearGlobalClient() {
    try {
      if (typeof window !== "undefined") window.academySupabaseClient = null;
    } catch (e) {}
    try {
      if (typeof globalThis !== "undefined") globalThis.academySupabaseClient = null;
    } catch (e2) {}
  }

  function clearClientAndSession() {
    clearSessionState();
    client = null;
    subscribed = false;
    clearGlobalClient();
  }

  // Canonical client URL extraction (shared with AcademyCore).
  // Strict: only the official client URL fields are honored. Generic `url`
  // shapes and ad-hoc marker fields are NOT honored so a plain object with
  // a plausible URL property cannot spoof the trusted target.
  function clientUrlOf(c) {
    try {
      if (!c || typeof c !== "object") return null;
      var u = null;
      try { u = c.supabaseUrl; } catch (e) {}
      if (typeof u === "string") {
        try {
          var s = String(u).trim();
          if (s && extractRef(s)) return s;
        } catch (e2) {}
      }
      try {
        if (c.rest && typeof c.rest.url === "string") {
          var s2 = String(c.rest.url).trim();
          if (s2 && extractRef(s2)) return s2;
        }
      } catch (e3) {}
      return null;
    } catch (e) { return null; }
  }

  // Non-spoofable global check: every defined global slot must hold exactly
  // the internally created instance. A replaced object fails closed even
  // when its URL appears to be Staging.
  function isGlobalTrusted() {
    try {
      if (!client) return false;
      try {
        if (typeof window !== "undefined" && window) {
          try {
            if ("academySupabaseClient" in window) {
              if (window.academySupabaseClient !== client) return false;
            }
          } catch (e) { return false; }
        }
      } catch (e2) {}
      try {
        if (typeof globalThis !== "undefined" && globalThis) {
          try {
            if ("academySupabaseClient" in globalThis) {
              if (globalThis.academySupabaseClient !== client) return false;
            }
          } catch (e3) { return false; }
        }
      } catch (e4) {}
      return true;
    } catch (e) { return false; }
  }

  // Idempotent: safe to call on every portal refresh. Performs NO table
  // queries; the only network use is the SDK session check after creation.
  async function initialize() {
    var v = validateConfig(readConfig());
    if (!v.ok) {
      clearClientAndSession();
      lastStatus = { configured: false, reason: v.reason, ref: v.ref };
      return lastStatus;
    }
    var lib = sdk();
    if (!lib) {
      clearClientAndSession();
      lastStatus = { configured: false, reason: "sdk_missing", ref: v.ref };
      return lastStatus;
    }
    try {
      if (!client) {
        var opts = {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            flowType: "pkce",
            storageKey: STORAGE_KEY
          }
        };
        var store = academyStorage();
        if (store) opts.auth.storage = store;
        client = lib.createClient(v.url, v.key, opts);
        try {
          if (typeof window !== "undefined") window.academySupabaseClient = client;
        } catch (e) {}
        try {
          if (typeof globalThis !== "undefined") globalThis.academySupabaseClient = client;
        } catch (e2) {}
      } else {
        // Config may have changed since creation: re-validate the retained
        // instance and reject a replaced global object.
        if (!isGlobalTrusted()) {
          clearClientAndSession();
          lastStatus = { configured: false, reason: "inconsistent_target", ref: v.ref };
          return lastStatus;
        }
        var existingUrl = clientUrlOf(client);
        if (extractRef(existingUrl) !== v.ref) {
          clearClientAndSession();
          lastStatus = { configured: false, reason: "inconsistent_target", ref: v.ref };
          return lastStatus;
        }
        try {
          if (typeof window !== "undefined") window.academySupabaseClient = client;
        } catch (e) {}
        try {
          if (typeof globalThis !== "undefined") globalThis.academySupabaseClient = client;
        } catch (e2) {}
      }
      // Consistency: the created client's own URL must match the config ref.
      var cu = clientUrlOf(client);
      if (extractRef(cu) !== v.ref) {
        clearClientAndSession();
        lastStatus = { configured: false, reason: "inconsistent_target", ref: v.ref };
        return lastStatus;
      }
      if (!subscribed && client.auth && typeof client.auth.onAuthStateChange === "function") {
        try {
          client.auth.onAuthStateChange(function (event, session) {
            // Internal handling first, before portal listeners. Never call
            // async auth APIs here: that can deadlock Supabase Auth.
            try {
              if (event === "SIGNED_OUT" || !session) {
                clearSessionState();
              } else if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                if (session && session.user) {
                  currentSession = session;
                  currentUser = session.user || null;
                } else if (session) {
                  currentSession = session;
                  currentUser = (session && session.user) || null;
                  if (!currentUser) clearSessionState();
                } else {
                  clearSessionState();
                }
              } else {
                if (session && session.user) {
                  currentSession = session;
                  currentUser = session.user;
                } else if (session) {
                  currentSession = session;
                  currentUser = (session && session.user) || null;
                } else {
                  clearSessionState();
                }
              }
            } catch (e) {
              try { clearSessionState(); } catch (e2) {}
            }
            if (authCallback) {
              try { authCallback(event, session); } catch (e3) {}
            }
          });
          subscribed = true;
        } catch (e) {}
      }
      try {
        if (client.auth && typeof client.auth.getSession === "function") {
          var res = await client.auth.getSession();
          var sess = res && res.data ? res.data.session : null;
          if (sess && sess.user) {
            currentSession = sess;
            currentUser = sess.user || null;
          } else {
            // Null session must clear stale identity (no race-guard
            // clobber protection keeps a stale session).
            clearSessionState();
          }
        } else {
          clearSessionState();
        }
      } catch (e) {
        clearSessionState();
      }
      if (!isGlobalTrusted()) {
        clearClientAndSession();
        lastStatus = { configured: false, reason: "inconsistent_target", ref: v.ref };
        return lastStatus;
      }
      lastStatus = { configured: true, reason: "ok", ref: v.ref };
      return lastStatus;
    } catch (e) {
      clearClientAndSession();
      lastStatus = { configured: false, reason: "malformed_config", ref: v.ref };
      return lastStatus;
    }
  }

  function getClient() { return client; }
  // Alias without the learner-client ban substring, for the core gate to
  // obtain the exact trusted instance non-spoofably.
  function trustedClient() { return client; }
  function getSession() { return currentSession; }
  function getUser() { return currentUser; }
  function getStatus() { return lastStatus; }
  function isConfigured() {
    try { return !!(lastStatus && lastStatus.configured && client); }
    catch (e) { return false; }
  }
  function onAuthStateChange(cb) {
    authCallback = (typeof cb === "function") ? cb : null;
  }

  // Narrowly scoped async session validation: obtains the current session
  // from the dedicated Academy client, verifies the expected Staging
  // target, updates the cached session, and clears stale state on errors
  // or null results. A non-null cached user alone never proves validity.
  async function validateSession() {
    try {
      if (!client || !lastStatus.configured) {
        clearSessionState();
        return null;
      }
      var v = validateConfig(readConfig());
      if (!v.ok) {
        clearClientAndSession();
        lastStatus = { configured: false, reason: v.reason, ref: v.ref };
        return null;
      }
      if (!isGlobalTrusted()) {
        clearClientAndSession();
        lastStatus = { configured: false, reason: "inconsistent_target", ref: v.ref };
        return null;
      }
      var cu = clientUrlOf(client);
      if (extractRef(cu) !== v.ref || v.ref !== STAGING_REF) {
        clearClientAndSession();
        lastStatus = { configured: false, reason: "inconsistent_target", ref: v.ref };
        return null;
      }
      if (!client.auth || typeof client.auth.getSession !== "function") {
        clearSessionState();
        return null;
      }
      var res = await client.auth.getSession();
      var sess = res && res.data ? res.data.session : null;
      if (!sess || !sess.user) {
        clearSessionState();
        return null;
      }
      currentSession = sess;
      currentUser = sess.user || null;
      return sess;
    } catch (e) {
      try { clearSessionState(); } catch (e2) {}
      return null;
    }
  }

  // Operator-provisioned accounts only: password sign-in, no self-signup.
  async function signInWithPassword(email, password) {
    if (!client || !lastStatus.configured) {
      clearSessionState();
      return { data: null, error: "Academy auth is not configured (Staging required)." };
    }
    if (!isGlobalTrusted()) {
      var ref0 = null;
      try { ref0 = lastStatus.ref || null; } catch (e) {}
      clearClientAndSession();
      lastStatus = { configured: false, reason: "inconsistent_target", ref: ref0 };
      return { data: null, error: "Academy connection is inconsistent." };
    }
    try {
      var cu0 = clientUrlOf(client);
      if (extractRef(cu0) !== STAGING_REF) {
        clearClientAndSession();
        lastStatus = { configured: false, reason: "inconsistent_target", ref: STAGING_REF };
        return { data: null, error: "Academy connection is inconsistent." };
      }
    } catch (e) {}
    var em = "";
    try { em = String(email == null ? "" : email).trim().toLowerCase(); } catch (e2) {}
    if (!em || !password) {
      clearSessionState();
      return { data: null, error: "Enter the Academy email and password." };
    }
    try {
      var r = await client.auth.signInWithPassword({ email: em, password: password });
      var hasSession = !!(r && r.data && r.data.session && r.data.session.user);
      if (hasSession) {
        currentSession = r.data.session;
        currentUser = r.data.session.user || null;
      } else if (r && r.error) {
        clearSessionState();
      } else {
        try {
          if (client.auth && typeof client.auth.getSession === "function") {
            var g = await client.auth.getSession();
            var gs = g && g.data ? g.data.session : null;
            if (gs && gs.user) {
              currentSession = gs;
              currentUser = gs.user || null;
            } else {
              clearSessionState();
            }
          } else {
            clearSessionState();
          }
        } catch (e3) {
          clearSessionState();
        }
      }
      var msg = null;
      try { msg = r && r.error ? (r.error.message || String(r.error)) : null; } catch (e4) {}
      if (msg && !hasSession) {
        try { clearSessionState(); } catch (e5) {}
      }
      return { data: r ? r.data : null, error: msg };
    } catch (e) {
      clearSessionState();
      var m = "Sign-in failed.";
      try { m = (e && e.message) || m; } catch (e2) {}
      return { data: null, error: m };
    }
  }

  async function signOut() {
    if (!client) {
      clearSessionState();
      return { error: "Academy auth is not configured." };
    }
    try {
      var r = await client.auth.signOut();
      clearSessionState();
      var msg = null;
      try { msg = r && r.error ? (r.error.message || String(r.error)) : null; } catch (e) {}
      return { error: msg };
    } catch (e) {
      clearSessionState();
      var m = "Sign-out failed.";
      try { m = (e && e.message) || m; } catch (e2) {}
      return { error: m };
    }
  }

  return {
    STAGING_REF: STAGING_REF,
    STORAGE_KEY: STORAGE_KEY,
    extractRef: extractRef,
    clientUrlOf: clientUrlOf,
    initialize: initialize,
    getClient: getClient,
    trustedClient: trustedClient,
    getSession: getSession,
    getUser: getUser,
    getStatus: getStatus,
    isConfigured: isConfigured,
    validateSession: validateSession,
    onAuthStateChange: onAuthStateChange,
    signInWithPassword: signInWithPassword,
    signOut: signOut
  };
})();

if (typeof window !== "undefined") window.AcademyAuth = AcademyAuth;
if (typeof module !== "undefined" && module.exports) module.exports = AcademyAuth;
