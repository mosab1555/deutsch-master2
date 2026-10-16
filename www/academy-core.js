/* Deutsch Master — Academy Core (Phase 1, additive).
 *
 * Pure authorization + validation + progress-aggregation logic shared by the
 * academy portal UI (client/academy-portal.js) and the Node test harness
 * (tools/test-academy-core.js). No learner state is touched: this module
 * never reads/writes S, DMProgress internals, localStorage keys, or cloud
 * sync queues. Academy database access is fail-closed by separate Academy
 * deployment target (`window.ACADEMY_SUPABASE_CONFIG` +
 * `window.academySupabaseClient`, ACADEMY_STAGING_REF allowlist) PLUS an
 * authenticated Staging session owned by AcademyAuth: missing, disallowed,
 * or inconsistent Academy targets return TARGET_DISABLED /
 * INCONSISTENT_TARGET, and a missing Academy session returns
 * SIGNIN_REQUIRED, all WITHOUT any `.from(...)` request. The learner
 * `SUPABASE_CONFIG` / `supabaseClient` / `AuthModule` (client AND session)
 * are NEVER used for Academy queries or identity by design. Learner auth /
 * progress / cloud-sync paths are untouched. RLS remains the enforcement
 * point when a Staging Academy target is explicitly configured; client-side
 * checks are only a fail-closed gate, never a substitute for RLS.
 *
 * Roles (per-academy in academy_members, plus global platform owner):
 *   platform_owner | academy_owner | academy_admin | teacher | student
 * Public users must never grant themselves a privileged role: student is the
 * only non-privileged role, and Phase 1 self-enrollment is DISABLED (manager
 * or assigned-teacher enrollment of existing authenticated users only).
 */
"use strict";

var AcademyCore = (function () {
  "use strict";

  var ROLES = ["platform_owner", "academy_owner", "academy_admin", "teacher", "student"];
  var PRIVILEGED = ["platform_owner", "academy_owner", "academy_admin", "teacher"];
  var OWNER_TIER = ["platform_owner", "academy_owner"];
  var MANAGER_ROLES = ["academy_owner", "academy_admin"];
  var LEVELS = ["A1", "A2", "B1", "B2"];
  var PAGE_SIZE = 20;
  var MAX_PAGE_SIZE = 50;

  /* ---------- Fail-closed Academy deployment target gate (hardened) ----------
   * Academy NEVER derives authorization from the learner app's shared
   * `window.SUPABASE_CONFIG.url`, `window.supabaseClient`, or
   * `AuthModule.getClient()`. Those learner paths stay on Production and are
   * NEVER fallback clients for Academy requests.
   *
   * Academy database operations use ONLY the distinct
   * `window.academySupabaseClient`, associated with an explicit
   * `window.ACADEMY_SUPABASE_CONFIG` (own URL + publishable key). That
   * separate client is NOT created here because no intentionally configured
   * Staging URL/key pair has been supplied: missing Academy config/client
   * is default-deny.
   *
   * The gate passes ONLY when ALL hold:
   *   (a) Academy config URL resolves to the explicit Staging allowlist ref,
   *   (b) an Academy client object exists,
   *   (c) the client's own associated URL resolves to the SAME Staging ref
   *       (consistency check; unverifiable client target => deny).
   * Changing only the learner URL to Staging therefore NEVER enables
   * Academy. Every other state returns TARGET_DISABLED / target_disabled
   * WITHOUT any `.from(...)` table request.
   */
  var ACADEMY_STAGING_REF = "uafwvkgaijmcofistjum";
  var ACADEMY_ALLOWED_REFS = [ACADEMY_STAGING_REF];

  function extractProjectRef(url) {
    // Canonical Academy ref extraction, shared with AcademyAuth at runtime
    // when the dedicated auth module is present (single source of truth).
    try {
      try {
        var A0 = null;
        if (typeof window !== "undefined" && window && window.AcademyAuth &&
          typeof window.AcademyAuth.extractRef === "function") A0 = window.AcademyAuth;
        else if (typeof globalThis !== "undefined" && globalThis && globalThis.AcademyAuth &&
          typeof globalThis.AcademyAuth.extractRef === "function") A0 = globalThis.AcademyAuth;
        if (A0) {
          try { return A0.extractRef(url); } catch (e0) {}
        }
      } catch (e) {}
      var s = String(url == null ? "" : url).trim();
      if (!s) return null;
      var m = s.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co(?:[\/?#]|$)/i);
      if (m && m[1]) return String(m[1]).toLowerCase();
      return null;
    } catch (e) { return null; }
  }

  function resolveAcademyTarget(configUrl) {
    var ref = extractProjectRef(configUrl);
    if (!ref) {
      var hasUrl = false;
      try { hasUrl = !!String(configUrl == null ? "" : configUrl).trim(); } catch (e) {}
      return { ref: ref, allowed: false, reason: hasUrl ? "unrecognized_target" : "missing_config" };
    }
    if (ACADEMY_ALLOWED_REFS.indexOf(ref) >= 0) {
      return { ref: ref, allowed: true, reason: "staging_allowed" };
    }
    return { ref: ref, allowed: false, reason: "target_disabled" };
  }

  function configuredAcademyUrl() {
    // Intentionally reads ONLY the separate Academy config. The learner
    // `SUPABASE_CONFIG.url` is NEVER consulted here by design.
    try {
      if (typeof window !== "undefined" && window && window.ACADEMY_SUPABASE_CONFIG && window.ACADEMY_SUPABASE_CONFIG.url) {
        return window.ACADEMY_SUPABASE_CONFIG.url;
      }
    } catch (e) {}
    try {
      if (typeof globalThis !== "undefined" && globalThis && globalThis.ACADEMY_SUPABASE_CONFIG && globalThis.ACADEMY_SUPABASE_CONFIG.url) {
        return globalThis.ACADEMY_SUPABASE_CONFIG.url;
      }
    } catch (e2) {}
    return null;
  }

  function getAcademyClient() {
    // Distinct Academy client ONLY. Learner `window.supabaseClient` and
    // `AuthModule.getClient()` are NEVER fallbacks (fail-closed).
    try {
      if (typeof window !== "undefined" && window && window.academySupabaseClient) {
        return window.academySupabaseClient;
      }
    } catch (e) {}
    try {
      if (typeof globalThis !== "undefined" && globalThis && globalThis.academySupabaseClient) {
        return globalThis.academySupabaseClient;
      }
    } catch (e2) {}
    return null;
  }

  function getAcademyClientUrl(client) {
    // Canonical client URL extraction, shared with AcademyAuth.clientUrlOf.
    // Strict: only the official client URL fields are honored. Permissive
    // generic shapes are rejected so unknown URL shapes fail closed
    // consistently in both modules.
    try {
      try {
        var A1 = null;
        if (typeof window !== "undefined" && window && window.AcademyAuth &&
          typeof window.AcademyAuth.clientUrlOf === "function") A1 = window.AcademyAuth;
        else if (typeof globalThis !== "undefined" && globalThis && globalThis.AcademyAuth &&
          typeof globalThis.AcademyAuth.clientUrlOf === "function") A1 = globalThis.AcademyAuth;
        if (A1) {
          try { return A1.clientUrlOf(client); } catch (e0) {}
        }
      } catch (e) {}
      if (!client || typeof client !== "object") return null;
      var u = null;
      try { u = client.supabaseUrl; } catch (e2) {}
      if (typeof u === "string") {
        try {
          var s = String(u).trim();
          if (s && extractProjectRef(s)) return s;
        } catch (e3) {}
      }
      try {
        if (client.rest && typeof client.rest.url === "string") {
          var s2 = String(client.rest.url).trim();
          if (s2 && extractProjectRef(s2)) return s2;
        }
      } catch (e4) {}
      return null;
    } catch (e) { return null; }
  }

  function resolveAcademyDeployment(configUrl, clientOrUrl) {
    var cfgRef = extractProjectRef(configUrl);
    if (!cfgRef) {
      var hasUrl = false;
      try { hasUrl = !!String(configUrl == null ? "" : configUrl).trim(); } catch (e) {}
      return { ref: cfgRef, configRef: cfgRef, clientRef: null, allowed: false,
        reason: hasUrl ? "unrecognized_target" : "missing_config", client: null };
    }
    var client = (clientOrUrl && typeof clientOrUrl === "object") ? clientOrUrl : null;
    var clientUrlStr = (clientOrUrl && typeof clientOrUrl === "object") ? getAcademyClientUrl(clientOrUrl) : clientOrUrl;
    if (!client) {
      return { ref: cfgRef, configRef: cfgRef, clientRef: null, allowed: false, reason: "missing_client", client: null };
    }
    var cliRef = extractProjectRef(clientUrlStr);
    if (!cliRef) {
      return { ref: cfgRef, configRef: cfgRef, clientRef: null, allowed: false, reason: "inconsistent_target", client: null };
    }
    if (cliRef !== cfgRef) {
      return { ref: cfgRef, configRef: cfgRef, clientRef: cliRef, allowed: false, reason: "inconsistent_target", client: null };
    }
    if (ACADEMY_ALLOWED_REFS.indexOf(cfgRef) < 0) {
      return { ref: cfgRef, configRef: cfgRef, clientRef: cliRef, allowed: false, reason: "target_disabled", client: null };
    }
    return { ref: cfgRef, configRef: cfgRef, clientRef: cliRef, allowed: true, reason: "staging_allowed", client: client };
  }

  function getAcademyAuth() {
    try {
      if (typeof window !== "undefined" && window && window.AcademyAuth) return window.AcademyAuth;
    } catch (e) {}
    try {
      if (typeof globalThis !== "undefined" && globalThis && globalThis.AcademyAuth) return globalThis.AcademyAuth;
    } catch (e2) {}
    return null;
  }

  function getTrustedAcademyClient() {
    try {
      var A = getAcademyAuth();
      if (!A) return null;
      if (A && typeof A.trustedClient === "function") {
        try { return A.trustedClient() || null; } catch (e) { return null; }
      }
      return null;
    } catch (e) { return null; }
  }

  function getAcademyTargetStatus(overrideConfigUrl, overrideClient) {
    var hasOverride = (overrideConfigUrl !== undefined) || (overrideClient !== undefined);
    var cfgUrl = (overrideConfigUrl !== undefined) ? overrideConfigUrl : configuredAcademyUrl();
    var cli = (overrideClient !== undefined) ? overrideClient : getAcademyClient();
    // Backward-compatible single-string override: treat it as the Academy
    // config URL with the live Academy client (used by older harnesses).
    if (overrideConfigUrl !== undefined && overrideClient === undefined && typeof overrideConfigUrl === "string" && hasOverride) {
      // If only one string was supplied positionally, keep legacy behavior of
      // resolving that URL alone ONLY when no live Academy client exists?
      // Hardened rule: a URL alone NEVER enables queries without a client.
      // Delegate to the deployment resolver so missing/inconsistent client
      // still denies.
      return resolveAcademyDeployment(cfgUrl, cli);
    }
    if (!hasOverride) {
      // Live path: when the dedicated auth module holds a trusted instance,
      // the global client must be exactly that instance. A replaced object
      // is rejected even when its URL appears to be Staging.
      try {
        var trusted = getTrustedAcademyClient();
        if (trusted) {
          if (cli !== trusted) {
            var cfgR = null;
            try { cfgR = extractProjectRef(cfgUrl); } catch (e) {}
            return { ref: cfgR, configRef: cfgR, clientRef: null, allowed: false,
              reason: "inconsistent_target", client: null };
          }
        }
      } catch (e) {}
    }
    return resolveAcademyDeployment(cfgUrl, cli);
  }

  function isAcademyTargetAllowed(overrideConfigUrl, overrideClient) {
    try { return getAcademyTargetStatus(overrideConfigUrl, overrideClient).allowed === true; }
    catch (e) { return false; }
  }

  function academyTargetDisabledMessage() {
    return "Academy portal is disabled on this deployment. Academy tables are never queried via the learner Production client; a separate Staging Academy connection is required.";
  }

  function requireAcademyTarget(overrideConfigUrl, overrideClient) {
    return getAcademyTargetStatus(overrideConfigUrl, overrideClient);
  }

  function normRole(r) { return ROLES.indexOf(r) >= 0 ? r : null; }
  function isPrivileged(role) { return PRIVILEGED.indexOf(role) >= 0; }
  function isManagerRole(role) { return MANAGER_ROLES.indexOf(role) >= 0; }

  function slugify(name) {
    return String(name || "").trim().toLowerCase()
      .replace(/[\u0600-\u06FF\u0750-\u077F]+/g, "") // drop Arabic for URL slugs
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "academy";
  }

  function isUuid(v) {
    return typeof v === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
  }

  function validateAcademyInput(o) {
    o = o || {};
    var errors = [];
    var name = String(o.name || "").trim();
    if (name.length < 2 || name.length > 120) errors.push("name: 2..120 chars required");
    var slug = String(o.slug || slugify(name)).trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) errors.push("slug: lowercase a-z/0-9/- required");
    if (o.level !== undefined && o.level !== null && o.level !== "" && LEVELS.indexOf(o.level) < 0) {
      errors.push("level: must be A1/A2/B1/B2 or empty");
    }
    if (o.primary_color !== undefined && o.primary_color !== null && o.primary_color !== "" &&
        !/^#[0-9a-fA-F]{6}$/.test(String(o.primary_color).trim())) {
      errors.push("primary_color: must be #RRGGBB");
    }
    return { errors: errors, value: { name: name, slug: slug } };
  }

  function validateClassInput(o) {
    o = o || {};
    var errors = [];
    var name = String(o.name || "").trim();
    if (name.length < 2 || name.length > 120) errors.push("name: 2..120 chars required");
    var level = o.level == null || o.level === "" ? null : String(o.level).trim().toUpperCase();
    if (level !== null && LEVELS.indexOf(level) < 0) errors.push("level: must be A1/A2/B1/B2 or empty");
    return { errors: errors, value: { name: name, level: level } };
  }

  /* ---------- Pure authorization (testable without Supabase) ----------
   * ctx: { userId, isPlatformOwner:boolean, memberships:[{academy_id,role,status}],
   *        teacherOf:[classId...], enrolledIn:[classId...],
   *        classAcademy:{classId:academyId} }
   */
  function membershipOf(ctx, academyId) {
    if (!ctx || !academyId) return null;
    var list = ctx.memberships || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m && m.academy_id === academyId && m.status === "active") return m.role;
    }
    return null;
  }

  function canManageAcademy(ctx, academyId) {
    if (!ctx || !ctx.userId || !academyId) return false;
    if (ctx.isPlatformOwner) return true;
    var r = membershipOf(ctx, academyId);
    return r === "academy_owner" || r === "academy_admin";
  }

  function canGrantRole(ctx, academyId, targetRole) {
    targetRole = normRole(targetRole);
    if (!targetRole || !ctx || !ctx.userId) return false;
    if (ctx.isPlatformOwner) return true;
    var caller = membershipOf(ctx, academyId);
    if (!caller) return false;
    if (targetRole === "academy_owner") return caller === "academy_owner";
    if (targetRole === "academy_admin") return caller === "academy_owner";
    if (targetRole === "teacher" || targetRole === "student") {
      return caller === "academy_owner" || caller === "academy_admin";
    }
    return false; // platform_owner grantable only by platform tier (SQL)
  }

  function canManageClass(ctx, classId) {
    if (!ctx || !ctx.userId || !classId) return false;
    if (ctx.isPlatformOwner) return true;
    if ((ctx.teacherOf || []).indexOf(classId) >= 0) return true;
    var academyId = ctx.classAcademy ? ctx.classAcademy[classId] : null;
    if (academyId && canManageAcademy(ctx, academyId)) return true;
    return false;
  }

  // Strict class visibility (mirrors classes_select_member): managers see all
  // academy classes; teachers see assigned; students see enrolled. Plain
  // same-academy membership alone grants NO class visibility.
  function canViewClass(ctx, classId) {
    if (!ctx || !ctx.userId || !classId) return false;
    if (ctx.isPlatformOwner) return true;
    if ((ctx.teacherOf || []).indexOf(classId) >= 0) return true;
    if ((ctx.enrolledIn || []).indexOf(classId) >= 0) return true;
    var academyId = ctx.classAcademy ? ctx.classAcademy[classId] : null;
    if (academyId && canManageAcademy(ctx, academyId)) return true;
    return false;
  }

  function canViewStudent(ctx, teacherClassIds, studentId, enrollmentByClass) {
    // Teacher sees a student only via a shared assigned class; managers via
    // same-academy membership (checked server-side by RLS); students only self.
    if (!ctx || !ctx.userId || !studentId) return false;
    if (ctx.userId === studentId) return true;
    if (ctx.isPlatformOwner) return true;
    teacherClassIds = teacherClassIds || ctx.teacherOf || [];
    enrollmentByClass = enrollmentByClass || {};
    for (var i = 0; i < teacherClassIds.length; i++) {
      var cid = teacherClassIds[i];
      var students = enrollmentByClass[cid] || [];
      if (students.indexOf(studentId) >= 0) return true;
    }
    return false;
  }

  function canEnroll(ctx, classId) {
    // Mirrors guard_class_enrollment_write: manager of academy OR assigned teacher.
    return canManageClass(ctx, classId);
  }

  function denySelfPrivilegedGrant(callerId, targetUserId, targetRole) {
    // Public users must never assign themselves a privileged role.
    if (callerId && targetUserId && callerId === targetUserId && isPrivileged(targetRole)) return true;
    return false;
  }

  /* ---------- Progress aggregation (real data only, explicit empties) ----------
   * Accepts a user_progress.state object (or null) shaped by DMProgress /
   * cloud-sync (events[], totalAnswered/totalCorrect, mistakes{}, srs{}).
   * Returns ONLY derived numbers + hasData flags; never invents grades,
   * attendance, or engagement. Missing data => hasData:false + zeros.
   */
  function aggregateProgress(state) {
    if (!state || typeof state !== "object") {
      return { hasData: false, totalAnswered: 0, totalCorrect: 0, accuracy: 0,
        events: 0, mistakesOpen: 0, dueReview: 0, lastActivity: null, weekly: null };
    }
    var events = Array.isArray(state.events) ? state.events : [];
    var totalAnswered = typeof state.totalAnswered === "number" ? state.totalAnswered : events.length;
    var totalCorrect = typeof state.totalCorrect === "number" ? state.totalCorrect : events.filter(function (e) { return e && e.ok === true; }).length;
    var accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    var mistakes = state.mistakes && typeof state.mistakes === "object" ? state.mistakes : {};
    var mistakesOpen = Object.keys(mistakes).filter(function (k) {
      try { return mistakes[k] && !mistakes[k].done; } catch (e) { return false; }
    }).length;
    var srs = state.srs && typeof state.srs === "object" ? state.srs : {};
    var today = null;
    try {
      var d = new Date(); today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    } catch (e) {}
    var dueReview = 0;
    try {
      Object.keys(srs).forEach(function (k) {
        var c = srs[k] || {};
        if (!c.due || (today && c.due <= today)) dueReview++;
      });
    } catch (e) {}
    var lastActivity = null;
    try {
      if (events.length) {
        var last = events[events.length - 1];
        lastActivity = (last && (last.ts || last.day)) || state.lastActivity || null;
        if (state.lastActivity && state.lastActivity.ts) lastActivity = state.lastActivity.ts;
      } else if (state.lastActivity) {
        lastActivity = state.lastActivity.ts || state.lastActivity || null;
      }
    } catch (e) {}
    var weekly = null;
    try {
      var now = Date.now(), cur = 0, curOk = 0, prev = 0;
      events.forEach(function (e) {
        try {
          var t = new Date(e.ts).getTime();
          if (!isFinite(t)) return;
          var diff = Math.round((now - t) / 86400000);
          if (diff < 0 || diff >= 14) return;
          if (diff < 7) { cur++; if (e.ok) curOk++; } else { prev++; }
        } catch (x) {}
      });
      weekly = { hasData: cur > 0 || prev > 0, curAns: cur,
        curPct: cur ? Math.round((curOk / cur) * 100) : 0, prevAns: prev };
    } catch (e) { weekly = { hasData: false, curAns: 0, curPct: 0, prevAns: 0 }; }
    return { hasData: events.length > 0 || totalAnswered > 0, totalAnswered: totalAnswered,
      totalCorrect: totalCorrect, accuracy: accuracy, events: events.length,
      mistakesOpen: mistakesOpen, dueReview: dueReview, lastActivity: lastActivity, weekly: weekly };
  }

  /* ---------- Supabase data layer (bounded, RLS-honoring, Academy-only) ---------- */
  function db() {
    // Hardened: Academy client ONLY. NEVER falls back to the learner
    // `window.supabaseClient` / `AuthModule.getClient()`. Returns the client
    // only when the Academy deployment gate passes; otherwise null.
    try {
      var st = getAcademyTargetStatus();
      if (st && st.allowed && st.client) return st.client;
      return null;
    } catch (e) { return null; }
  }
  // Academy identity ONLY: the dedicated Staging session owned by
  // AcademyAuth. Production AuthModule state is NEVER consulted here, so a
  // learner sign-in can neither grant nor leak Academy access.
  function academySessionUser() {
    try {
      if (typeof window !== "undefined" && window.AcademyAuth &&
        typeof window.AcademyAuth.getUser === "function") {
        return window.AcademyAuth.getUser() || null;
      }
    } catch (e) {}
    try {
      if (typeof globalThis !== "undefined" && globalThis.AcademyAuth &&
        typeof globalThis.AcademyAuth.getUser === "function") {
        return globalThis.AcademyAuth.getUser() || null;
      }
    } catch (e2) {}
    return null;
  }
  function authed() { return academySessionUser(); }
  function academySigninRequiredMessage() {
    return "Academy sign-in required: sign in with an operator-provisioned Academy account on the Staging connection.";
  }
  function academyInconsistentMessage() {
    return "Academy connection is inconsistent: the Academy client target does not match the configured Staging target. Academy tables are not queried.";
  }
  // Maps a failed deployment-target status to its public denial code.
  function gateDenial(t) {
    try {
      if (t && t.reason === "inconsistent_target") {
        return { code: "INCONSISTENT_TARGET", reason: "inconsistent_target" };
      }
    } catch (e) {}
    return { code: "TARGET_DISABLED", reason: (t && t.reason) || "target_disabled" };
  }
  // Centralized async preflight for EVERY Academy table request. Validates
  // in order: (1) distinct Academy config + allowed Staging target,
  // (2) trusted Academy-client identity + matching URL/ref, (3) a current
  // authenticated session obtained through the dedicated Academy client.
  // Returns { ok:true, client, user, session, target } or
  // { ok:false, code, reason, target, error }. Callers must return the
  // documented status WITHOUT any `.from()` call when ok===false.
  // Client-side checks are only a fail-closed gate; RLS remains the
  // required server-side authorization boundary for every allowed query.
  async function academyPreflight(overrideConfigUrl, overrideClient) {
    var hasOverride = (overrideConfigUrl !== undefined) || (overrideClient !== undefined);
    var target = null;
    try {
      target = hasOverride
        ? getAcademyTargetStatus(overrideConfigUrl, overrideClient)
        : getAcademyTargetStatus();
    } catch (e) {
      target = { allowed: false, reason: "target_disabled", ref: null, client: null };
    }
    if (!target || !target.allowed || !target.client) {
      var d0 = gateDenial(target);
      var m0 = d0.code === "INCONSISTENT_TARGET" ? academyInconsistentMessage() : academyTargetDisabledMessage();
      return { ok: false, code: d0.code, reason: (target && target.reason) || "target_disabled",
        target: target, client: null, user: null, session: null, error: m0 };
    }
    var A = getAcademyAuth();
    var session = null, user = null;
    try {
      if (A && typeof A.validateSession === "function") {
        try { session = await A.validateSession(); } catch (e) { session = null; }
        try { user = (session && session.user) ? session.user : null; } catch (e2) { user = null; }
        if (!session || !user) {
          return { ok: false, code: "SIGNIN_REQUIRED", reason: "signin_required",
            target: target, client: null, user: null, session: null, error: academySigninRequiredMessage() };
        }
      } else if (A && typeof A.getSession === "function") {
        var s = null;
        try {
          s = A.getSession();
          if (s && typeof s.then === "function") s = await s;
        } catch (e) { s = null; }
        var u = null;
        try {
          if (s && s.user) u = s.user;
          else if (A && typeof A.getUser === "function") {
            var gu = A.getUser();
            if (gu && typeof gu.then === "function") gu = await gu;
            // A cached user alone never proves validity: require a live
            // session object as well, otherwise treat as stale.
            if (s && gu) u = gu;
            else { u = null; s = null; }
          }
        } catch (e2) { u = null; s = null; }
        if (!s || !u) {
          return { ok: false, code: "SIGNIN_REQUIRED", reason: "signin_required",
            target: target, client: null, user: null, session: null, error: academySigninRequiredMessage() };
        }
        session = s; user = u;
      } else {
        var cli = target.client;
        try {
          if (cli && cli.auth && typeof cli.auth.getSession === "function") {
            var r = await cli.auth.getSession();
            var sess = r && r.data ? r.data.session : null;
            if (!sess || !sess.user) {
              return { ok: false, code: "SIGNIN_REQUIRED", reason: "signin_required",
                target: target, client: null, user: null, session: null, error: academySigninRequiredMessage() };
            }
            session = sess; user = sess.user;
          } else {
            return { ok: false, code: "SIGNIN_REQUIRED", reason: "signin_required",
              target: target, client: null, user: null, session: null, error: academySigninRequiredMessage() };
          }
        } catch (e) {
          return { ok: false, code: "SIGNIN_REQUIRED", reason: "signin_required",
            target: target, client: null, user: null, session: null, error: academySigninRequiredMessage() };
        }
      }
    } catch (e) {
      return { ok: false, code: "SIGNIN_REQUIRED", reason: "signin_required",
        target: target, client: null, user: null, session: null, error: academySigninRequiredMessage() };
    }
    return { ok: true, code: "ok", reason: "ok", target: target,
      client: target.client, user: user, session: session, error: null };
  }
  function preflightDenial(p, emptyData) {
    try {
      if (p.code === "SIGNIN_REQUIRED") {
        return { data: emptyData, error: academySigninRequiredMessage(), code: "SIGNIN_REQUIRED", academyTarget: p.target };
      }
      if (p.code === "INCONSISTENT_TARGET") {
        return { data: emptyData, error: academyInconsistentMessage(), code: "INCONSISTENT_TARGET", academyTarget: p.target };
      }
    } catch (e) {}
    return { data: emptyData, error: academyTargetDisabledMessage(), code: "TARGET_DISABLED", academyTarget: p.target };
  }
  function errOf(e, fallback) {
    var msg = "";
    try { msg = (e && (e.message || e.msg || e.error_description)) || String(e) || ""; } catch (x) {}
    msg = String(msg).slice(0, 300);
    return { error: msg || fallback || "request failed" };
  }
  function isMissingTable(e) {
    var s = "";
    try { s = JSON.stringify(e) + " " + (e && (e.message || e.code || "")); } catch (x) { s = String(e); }
    return /42P01|PGRST205|Could not find the table|relation .* does not exist|schema cache/i.test(s);
  }

  async function checkSetup(overrideConfigUrl, overrideClient) {
    // Hardened fail-closed gate: Academy tables are probed ONLY via the
    // distinct Academy client whose config + client targets both resolve to
    // the explicit Staging ref AND a fresh authenticated Staging session
    // obtained through the dedicated Academy client exists.
    // All other states return an explicit status WITHOUT any `.from(...)`
    // call. RLS remains the enforcement point when configured.
    var hasOverride = (overrideConfigUrl !== undefined) || (overrideClient !== undefined);
    var pre = await academyPreflight(overrideConfigUrl, overrideClient);
    if (!pre.ok) {
      if (!hasOverride && (pre.reason === "missing_config" || pre.reason === "unrecognized_target" || pre.reason === "missing_client")) {
        // Offline posture when no Academy connection exists at all (no table
        // probe happens on any path here).
        return { configured: false, reason: "supabase_not_configured", user: null, academyTarget: pre.target };
      }
      var msg0 = pre.code === "INCONSISTENT_TARGET" ? academyInconsistentMessage() : (pre.code === "SIGNIN_REQUIRED" ? academySigninRequiredMessage() : academyTargetDisabledMessage());
      var rs0 = pre.code === "SIGNIN_REQUIRED" ? "signin_required" : pre.reason;
      return { configured: false, reason: rs0, ref: pre.target ? pre.target.ref : null, academyTarget: pre.target,
        user: null, detail: msg0, error: msg0, code: pre.code };
    }
    var user = pre.user;
    var client = pre.client;
    if (!client) return { configured: false, reason: "supabase_not_configured", user: null };
    // Probe academy tables with zero-row reads; missing-table errors mean the
    // Phase 1 migration has not been applied (honest setup status, no fake data).
    try {
      var r = await client.from("academies").select("id", { count: "exact", head: true });
      if (r && r.error && isMissingTable(r.error)) {
        return { configured: false, reason: "migration_not_applied", user: user, detail: "academies table missing" };
      }
      // Distinguish RLS-denial (configured, just no access) from real errors.
      return { configured: true, reason: "ok", user: user };
    } catch (e) {
      if (isMissingTable(e)) return { configured: false, reason: "migration_not_applied", user: user };
      return { configured: false, reason: "probe_failed", user: user, detail: errOf(e).error };
    }
  }

  function pageRange(page, size) {
    page = Math.max(1, parseInt(page, 10) || 1);
    size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(size, 10) || PAGE_SIZE));
    return { from: (page - 1) * size, to: (page - 1) * size + size - 1, page: page, size: size };
  }

  async function listAcademies(opts) {
    opts = opts || {};
    var _p0 = await academyPreflight();
    if (!_p0.ok) return preflightDenial(_p0, []);
    var client = _p0.client;
    var pg = pageRange(opts.page, opts.size);
    try {
      var q = client.from("academies").select("id,name,slug,description,logo_url,primary_color,archived_at,created_at", { count: "exact" })
        .order("created_at", { ascending: false }).range(pg.from, pg.to);
      if (opts.search) q = q.ilike("name", "%" + String(opts.search).slice(0, 60) + "%");
      if (!opts.includeArchived) q = q.is("archived_at", null);
      var r = await q;
      if (r.error) {
        if (isMissingTable(r.error)) return { data: [], error: "Academy database is not configured yet (migration not applied).", code: "SETUP_REQUIRED" };
        return { data: [], error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data || [], count: r.count || 0, page: pg.page, size: pg.size, error: null };
    } catch (e) {
      if (isMissingTable(e)) return { data: [], error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
      return { data: [], error: errOf(e).error, code: "DENIED" };
    }
  }

  async function myMemberships() {
    var _p1 = await academyPreflight();
    if (!_p1.ok) return preflightDenial(_p1, []);
    var client = _p1.client, user = _p1.user;
    try {
      var r = await client.from("academy_members").select("academy_id,role,status,created_at").eq("user_id", user.id).eq("status", "active");
      if (r.error) {
        if (isMissingTable(r.error)) return { data: [], error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: [], error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data || [], error: null };
    } catch (e) {
      return { data: [], error: errOf(e).error, code: "DENIED" };
    }
  }

  async function createAcademy(input) {
    var _p2 = await academyPreflight();
    if (!_p2.ok) { var _e2 = preflightDenial(_p2, null); _e2.data = null; return _e2; }
    var v = validateAcademyInput(input);
    if (v.errors.length) return { data: null, error: v.errors.join("; "), code: "VALIDATION" };
    var client = _p2.client, user = _p2.user;
    try {
      var r = await client.from("academies").insert({
        name: v.value.name, slug: v.value.slug,
        description: String((input && input.description) || "").slice(0, 2000),
        logo_url: (input && input.logo_url) || null,
        primary_color: (input && input.primary_color) || "#0B1020",
        settings: (input && input.settings) || {},
        created_by: user.id
      }).select("id,name,slug").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error, "Only platform owners can create academies.").error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function updateAcademy(academyId, patch) {
    var _p3 = await academyPreflight();
    if (!_p3.ok) { var _e3 = preflightDenial(_p3, null); _e3.data = null; return _e3; }
    if (!isUuid(academyId)) return { data: null, error: "Invalid academy id", code: "VALIDATION" };
    var client = _p3.client;
    var next = {};
    if (patch.name !== undefined) {
      var nm = String(patch.name).trim();
      if (nm.length < 2 || nm.length > 120) return { data: null, error: "name: 2..120 chars required", code: "VALIDATION" };
      next.name = nm;
    }
    if (patch.description !== undefined) next.description = String(patch.description).slice(0, 2000);
    if (patch.logo_url !== undefined) next.logo_url = patch.logo_url || null;
    if (patch.primary_color !== undefined) {
      if (patch.primary_color && !/^#[0-9a-fA-F]{6}$/.test(String(patch.primary_color))) {
        return { data: null, error: "primary_color: must be #RRGGBB", code: "VALIDATION" };
      }
      next.primary_color = patch.primary_color || "#0B1020";
    }
    if (patch.settings !== undefined) next.settings = patch.settings || {};
    if (patch.archived !== undefined) next.archived_at = patch.archived ? new Date().toISOString() : null;
    try {
      var r = await client.from("academies").update(next).eq("id", academyId).select("id,name,slug,archived_at").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function listMembers(academyId, opts) {
    opts = opts || {};
    var _p4 = await academyPreflight();
    if (!_p4.ok) return preflightDenial(_p4, []);
    var client = _p4.client;
    if (!isUuid(academyId)) return { data: [], error: "Invalid academy id", code: "VALIDATION" };
    var pg = pageRange(opts.page, opts.size);
    try {
      var q = client.from("academy_members").select("academy_id,user_id,role,status,created_at", { count: "exact" })
        .eq("academy_id", academyId).order("created_at", { ascending: false }).range(pg.from, pg.to);
      if (opts.role) q = q.eq("role", opts.role);
      if (opts.status) q = q.eq("status", opts.status);
      else q = q.eq("status", "active");
      var r = await q;
      if (r.error) {
        if (isMissingTable(r.error)) return { data: [], error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: [], error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data || [], count: r.count || 0, page: pg.page, size: pg.size, error: null };
    } catch (e) { return { data: [], error: errOf(e).error, code: "DENIED" }; }
  }

  async function addMember(academyId, targetUserId, role) {
    var _p5 = await academyPreflight();
    if (!_p5.ok) { var _e5 = preflightDenial(_p5, null); _e5.data = null; return _e5; }
    role = normRole(role);
    if (!isUuid(academyId)) return { data: null, error: "Invalid academy id", code: "VALIDATION" };
    if (!isUuid(targetUserId)) return { data: null, error: "Enter the member's User ID (UUID of an existing signed-up user).", code: "VALIDATION" };
    if (!role || role === "platform_owner") return { data: null, error: "Invalid role for academy membership.", code: "VALIDATION" };
    var me = _p5.user;
    if (me && me.id === targetUserId && isPrivileged(role)) {
      return { data: null, error: "You cannot grant yourself a privileged role.", code: "DENIED" };
    }
    var client = _p5.client;
    try {
      var r = await client.from("academy_members").insert({
        academy_id: academyId, user_id: targetUserId, role: role, status: "active", invited_by: me.id
      }).select("academy_id,user_id,role,status").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error, "Only academy managers may add members.").error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function updateMemberRole(academyId, targetUserId, role, status) {
    var _p6 = await academyPreflight();
    if (!_p6.ok) { var _e6 = preflightDenial(_p6, null); _e6.data = null; return _e6; }
    if (!isUuid(academyId) || !isUuid(targetUserId)) return { data: null, error: "Invalid ids", code: "VALIDATION" };
    var me = _p6.user;
    if (me && me.id === targetUserId) return { data: null, error: "Members cannot change their own role.", code: "DENIED" };
    var client = _p6.client;
    var patch = {};
    if (role !== undefined) {
      role = normRole(role);
      if (!role || role === "platform_owner") return { data: null, error: "Invalid role.", code: "VALIDATION" };
      patch.role = role;
    }
    if (status !== undefined) {
      if (status !== "active" && status !== "removed") return { data: null, error: "Invalid status.", code: "VALIDATION" };
      patch.status = status;
    }
    try {
      var r = await client.from("academy_members").update(patch)
        .eq("academy_id", academyId).eq("user_id", targetUserId)
        .select("academy_id,user_id,role,status").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function removeMember(academyId, targetUserId) {
    // Safe removal: status='removed' revokes access, preserves account + history.
    return updateMemberRole(academyId, targetUserId, undefined, "removed");
  }

  async function listClasses(academyId, opts) {
    opts = opts || {};
    var _p7 = await academyPreflight();
    if (!_p7.ok) return preflightDenial(_p7, []);
    var client = _p7.client;
    if (!isUuid(academyId)) return { data: [], error: "Invalid academy id", code: "VALIDATION" };
    var pg = pageRange(opts.page, opts.size);
    try {
      var q = client.from("classes").select("id,academy_id,name,level,description,archived_at,created_at", { count: "exact" })
        .eq("academy_id", academyId).order("created_at", { ascending: false }).range(pg.from, pg.to);
      if (opts.search) q = q.ilike("name", "%" + String(opts.search).slice(0, 60) + "%");
      if (opts.level) q = q.eq("level", opts.level);
      if (!opts.includeArchived) q = q.is("archived_at", null);
      var r = await q;
      if (r.error) {
        if (isMissingTable(r.error)) return { data: [], error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: [], error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data || [], count: r.count || 0, page: pg.page, size: pg.size, error: null };
    } catch (e) { return { data: [], error: errOf(e).error, code: "DENIED" }; }
  }

  async function createClass(academyId, input) {
    var _p8 = await academyPreflight();
    if (!_p8.ok) { var _e8 = preflightDenial(_p8, null); _e8.data = null; return _e8; }
    var v = validateClassInput(input);
    if (v.errors.length) return { data: null, error: v.errors.join("; "), code: "VALIDATION" };
    if (!isUuid(academyId)) return { data: null, error: "Invalid academy id", code: "VALIDATION" };
    var client = _p8.client, user = _p8.user;
    try {
      var r = await client.from("classes").insert({
        academy_id: academyId, name: v.value.name, level: v.value.level,
        description: String((input && input.description) || "").slice(0, 2000),
        settings: (input && input.settings) || {}, created_by: user.id
      }).select("id,academy_id,name,level,archived_at").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error, "Only academy managers may create classes.").error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function updateClass(classId, patch) {
    var _p9 = await academyPreflight();
    if (!_p9.ok) { var _e9 = preflightDenial(_p9, null); _e9.data = null; return _e9; }
    if (!isUuid(classId)) return { data: null, error: "Invalid class id", code: "VALIDATION" };
    var client = _p9.client;
    var next = {};
    if (patch.name !== undefined) {
      var nm = String(patch.name).trim();
      if (nm.length < 2 || nm.length > 120) return { data: null, error: "name: 2..120 chars required", code: "VALIDATION" };
      next.name = nm;
    }
    if (patch.level !== undefined) {
      var lv = patch.level === null || patch.level === "" ? null : String(patch.level).toUpperCase();
      if (lv !== null && LEVELS.indexOf(lv) < 0) return { data: null, error: "level: A1/A2/B1/B2 or empty", code: "VALIDATION" };
      next.level = lv;
    }
    if (patch.description !== undefined) next.description = String(patch.description).slice(0, 2000);
    if (patch.archived !== undefined) next.archived_at = patch.archived ? new Date().toISOString() : null;
    try {
      var r = await client.from("classes").update(next).eq("id", classId).select("id,academy_id,name,level,archived_at").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function listClassTeachers(classId) {
    var _p10 = await academyPreflight();
    if (!_p10.ok) return preflightDenial(_p10, []);
    var client = _p10.client;
    if (!isUuid(classId)) return { data: [], error: "Invalid class id", code: "VALIDATION" };
    try {
      var r = await client.from("class_teachers").select("class_id,teacher_id,assigned_at").eq("class_id", classId).order("assigned_at", { ascending: true });
      if (r.error) {
        if (isMissingTable(r.error)) return { data: [], error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: [], error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data || [], error: null };
    } catch (e) { return { data: [], error: errOf(e).error, code: "DENIED" }; }
  }

  async function assignTeacher(classId, teacherUserId) {
    var _p11 = await academyPreflight();
    if (!_p11.ok) { var _e11 = preflightDenial(_p11, null); _e11.data = null; return _e11; }
    if (!isUuid(classId)) return { data: null, error: "Invalid class id", code: "VALIDATION" };
    if (!isUuid(teacherUserId)) return { data: null, error: "Enter the teacher's User ID (UUID).", code: "VALIDATION" };
    var client = _p11.client, me = _p11.user;
    if (me.id === teacherUserId) {
      // Self-assignment as teacher is a privileged grant: blocked here so the
      // server guard stays the second line of defense, not the only one.
      return { data: null, error: "You cannot assign yourself as teacher; ask an academy manager.", code: "DENIED" };
    }
    try {
      var r = await client.from("class_teachers").insert({ class_id: classId, teacher_id: teacherUserId, assigned_by: me.id })
        .select("class_id,teacher_id").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error, "Only academy managers may assign teachers.").error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function unassignTeacher(classId, teacherUserId) {
    var _p12 = await academyPreflight();
    if (!_p12.ok) { var _e12 = preflightDenial(_p12, null); _e12.data = null; return _e12; }
    if (!isUuid(classId) || !isUuid(teacherUserId)) return { data: null, error: "Invalid ids", code: "VALIDATION" };
    var client = _p12.client;
    try {
      var r = await client.from("class_teachers").delete().eq("class_id", classId).eq("teacher_id", teacherUserId);
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: { removed: true }, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function myTeachingClasses(opts) {
    opts = opts || {};
    var _p13 = await academyPreflight();
    if (!_p13.ok) return preflightDenial(_p13, []);
    var client = _p13.client, user = _p13.user;
    var pg = pageRange(opts.page, opts.size);
    try {
      var r = await client.from("class_teachers").select("class_id,assigned_at", { count: "exact" })
        .eq("teacher_id", user.id).order("assigned_at", { ascending: false }).range(pg.from, pg.to);
      if (r.error) {
        if (isMissingTable(r.error)) return { data: [], error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: [], error: errOf(r.error).error, code: "DENIED" };
      }
      var ids = (r.data || []).map(function (x) { return x.class_id; });
      if (!ids.length) return { data: [], count: 0, page: pg.page, size: pg.size, error: null };
      var c = await client.from("classes").select("id,academy_id,name,level,description,archived_at").in("id", ids.slice(0, MAX_PAGE_SIZE));
      if (c.error) return { data: [], error: errOf(c.error).error, code: "DENIED" };
      return { data: c.data || [], count: r.count || 0, page: pg.page, size: pg.size, error: null };
    } catch (e) { return { data: [], error: errOf(e).error, code: "DENIED" }; }
  }

  async function listEnrollments(classId, opts) {
    opts = opts || {};
    var _p14 = await academyPreflight();
    if (!_p14.ok) return preflightDenial(_p14, []);
    var client = _p14.client;
    if (!isUuid(classId)) return { data: [], error: "Invalid class id", code: "VALIDATION" };
    var pg = pageRange(opts.page, opts.size);
    try {
      var q = client.from("class_enrollments").select("class_id,student_id,enrolled_at", { count: "exact" })
        .eq("class_id", classId).order("enrolled_at", { ascending: false }).range(pg.from, pg.to);
      if (opts.search) q = q.ilike("student_id", "%" + String(opts.search).slice(0, 36) + "%");
      var r = await q;
      if (r.error) {
        if (isMissingTable(r.error)) return { data: [], error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: [], error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data || [], count: r.count || 0, page: pg.page, size: pg.size, error: null };
    } catch (e) { return { data: [], error: errOf(e).error, code: "DENIED" }; }
  }

  async function enrollStudent(classId, studentUserId) {
    var _p15 = await academyPreflight();
    if (!_p15.ok) { var _e15 = preflightDenial(_p15, null); _e15.data = null; return _e15; }
    if (!isUuid(classId)) return { data: null, error: "Invalid class id", code: "VALIDATION" };
    if (!isUuid(studentUserId)) return { data: null, error: "Enter the student's User ID (UUID of an existing signed-up user).", code: "VALIDATION" };
    var me = _p15.user;
    if (me && me.id === studentUserId) return { data: null, error: "Self-enrollment is disabled; ask a manager or teacher.", code: "DENIED" };
    var client = _p15.client;
    try {
      var r = await client.from("class_enrollments").insert({ class_id: classId, student_id: studentUserId, enrolled_by: me.id })
        .select("class_id,student_id").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error, "Only managers or assigned teachers may enroll students.").error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function removeEnrollment(classId, studentUserId) {
    // Revokes class access only; the student's account + learning history stay intact.
    var _p16 = await academyPreflight();
    if (!_p16.ok) { var _e16 = preflightDenial(_p16, null); _e16.data = null; return _e16; }
    if (!isUuid(classId) || !isUuid(studentUserId)) return { data: null, error: "Invalid ids", code: "VALIDATION" };
    var client = _p16.client;
    try {
      var r = await client.from("class_enrollments").delete().eq("class_id", classId).eq("student_id", studentUserId);
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: { removed: true }, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function getStudentProgress(studentUserId) {
    // RLS decides: own rows always; teachers/managers only when authorized.
    // Fail-closed first: Academy progress reads never go through Production.
    // Client gate is never a substitute for RLS; RLS stays the boundary.
    var _p17 = await academyPreflight();
    if (!_p17.ok) { var _e17 = preflightDenial(_p17, null); _e17.data = null; return _e17; }
    if (!isUuid(studentUserId)) return { data: null, error: "Invalid student id", code: "VALIDATION" };
    var client = _p17.client;
    try {
      var q17 = client.from("user_progress").select("user_id,state,version,updated_at").eq("user_id", studentUserId);
      var r;
      // Zero-or-one-row read: a student with no progress row yet is an empty
      // state, not an authorization failure. Prefer maybeSingle() (v2 query
      // builder); fall back to single() + PGRST116, the same no-row signal
      // used for user_progress reads in cloud-sync.js. Only the precise
      // no-row signal maps to empty; every other error (incl. RLS 42501)
      // keeps the existing DENIED path so real denials are never masked.
      if (q17 && typeof q17.maybeSingle === "function") {
        r = await q17.maybeSingle();
        if (!r.error && !r.data) {
          return { data: null, summary: aggregateProgress(null), error: null };
        }
        if (r.error && r.error.code === "PGRST116" && !r.data) {
          return { data: null, summary: aggregateProgress(null), error: null };
        }
      } else {
        r = await q17.single();
        if (r.error && r.error.code === "PGRST116") {
          return { data: null, summary: aggregateProgress(null), error: null };
        }
      }
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error, "Not authorized to view this student's progress.").error, code: "DENIED" };
      }
      return { data: r.data, summary: aggregateProgress(r.data && r.data.state), error: null };
    } catch (e) {
      if (e && e.code === "PGRST116") return { data: null, summary: aggregateProgress(null), error: null };
      return { data: null, error: errOf(e).error, code: "DENIED" };
    }
  }

  async function getProfiles(userIds) {
    var _p18 = await academyPreflight();
    if (!_p18.ok) return preflightDenial(_p18, []);
    var client = _p18.client;
    var ids = (userIds || []).filter(isUuid).slice(0, MAX_PAGE_SIZE);
    if (!ids.length) return { data: [], error: null };
    try {
      var r = await client.from("profiles").select("id,display_name,avatar_url,created_at").in("id", ids);
      if (r.error) return { data: [], error: errOf(r.error).error, code: "DENIED" };
      return { data: r.data || [], error: null };
    } catch (e) { return { data: [], error: errOf(e).error, code: "DENIED" }; }
  }

  async function logAudit(academyId, action, entityType, entityId, metadata) {
    var _p19 = await academyPreflight();
    if (!_p19.ok) { var _e19 = preflightDenial(_p19, null); _e19.data = null; return _e19; }
    if (!isUuid(academyId)) return { data: null, error: "Invalid academy id", code: "VALIDATION" };
    var client = _p19.client, me = _p19.user;
    try {
      var r = await client.from("academy_audit_events").insert({
        academy_id: academyId, actor_id: me.id, action: String(action).slice(0, 80),
        entity_type: entityType, entity_id: entityId ? String(entityId).slice(0, 120) : null,
        metadata: metadata || {}
      }).select("id").single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error).error, code: "DENIED" };
      }
      return { data: r.data, error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  return {
    ROLES: ROLES, LEVELS: LEVELS, PAGE_SIZE: PAGE_SIZE, MAX_PAGE_SIZE: MAX_PAGE_SIZE,
    ACADEMY_STAGING_REF: ACADEMY_STAGING_REF, ACADEMY_ALLOWED_REFS: ACADEMY_ALLOWED_REFS,
    extractProjectRef: extractProjectRef, resolveAcademyTarget: resolveAcademyTarget,
    resolveAcademyDeployment: resolveAcademyDeployment,
    configuredAcademyUrl: configuredAcademyUrl, getAcademyClient: getAcademyClient,
    getAcademyClientUrl: getAcademyClientUrl,
    getAcademyTargetStatus: getAcademyTargetStatus, isAcademyTargetAllowed: isAcademyTargetAllowed,
    requireAcademyTarget: requireAcademyTarget, academySessionUser: academySessionUser,
    gateDenial: gateDenial, academyPreflight: academyPreflight,
    getAcademyAuth: getAcademyAuth, getTrustedAcademyClient: getTrustedAcademyClient,
    normRole: normRole, isPrivileged: isPrivileged, isManagerRole: isManagerRole,
    slugify: slugify, isUuid: isUuid,
    validateAcademyInput: validateAcademyInput, validateClassInput: validateClassInput,
    membershipOf: membershipOf, canManageAcademy: canManageAcademy,
    canGrantRole: canGrantRole, canManageClass: canManageClass, canViewClass: canViewClass,
    canViewStudent: canViewStudent, canEnroll: canEnroll,
    denySelfPrivilegedGrant: denySelfPrivilegedGrant,
    aggregateProgress: aggregateProgress,
    checkSetup: checkSetup, pageRange: pageRange,
    listAcademies: listAcademies, myMemberships: myMemberships,
    createAcademy: createAcademy, updateAcademy: updateAcademy,
    listMembers: listMembers, addMember: addMember,
    updateMemberRole: updateMemberRole, removeMember: removeMember,
    listClasses: listClasses, createClass: createClass, updateClass: updateClass,
    listClassTeachers: listClassTeachers, assignTeacher: assignTeacher,
    unassignTeacher: unassignTeacher, myTeachingClasses: myTeachingClasses,
    listEnrollments: listEnrollments, enrollStudent: enrollStudent,
    removeEnrollment: removeEnrollment, getStudentProgress: getStudentProgress,
    getProfiles: getProfiles, logAudit: logAudit
  };
})();

if (typeof window !== "undefined") window.AcademyCore = AcademyCore;
if (typeof module !== "undefined" && module.exports) module.exports = AcademyCore;
