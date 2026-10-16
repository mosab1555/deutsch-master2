/* Deutsch Master — Academy Core (Phase 1, additive).
 *
 * Pure authorization + validation + progress-aggregation logic shared by the
 * academy portal UI (client/academy-portal.js) and the Node test harness
 * (tools/test-academy-core.js). No learner state is touched: this module
 * never reads/writes S, DMProgress internals, localStorage keys, or cloud
 * sync queues. It talks to Supabase only through the single AuthModule-owned
 * client and honors RLS (policy violations surface as DENIED errors).
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

  /* ---------- Supabase data layer (bounded, RLS-honoring) ---------- */
  function db() {
    try { return window.supabaseClient || (window.AuthModule && window.AuthModule.getClient && window.AuthModule.getClient()) || null; }
    catch (e) { return null; }
  }
  function authed() {
    try { return (window.AuthModule && window.AuthModule.getUser && window.AuthModule.getUser()) || null; }
    catch (e) { return null; }
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

  async function checkSetup() {
    var user = authed(), client = db();
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
    var client = db();
    if (!client) return { data: [], error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    var client = db(), user = authed();
    if (!client || !user) return { data: [], error: !user ? "Not signed in" : "Sync not initialized", code: !user ? "NOT_AUTH" : "SETUP_REQUIRED" };
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
    var v = validateAcademyInput(input);
    if (v.errors.length) return { data: null, error: v.errors.join("; "), code: "VALIDATION" };
    var client = db(), user = authed();
    if (!client || !user) return { data: null, error: "Sign in required", code: "NOT_AUTH" };
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
    if (!isUuid(academyId)) return { data: null, error: "Invalid academy id", code: "VALIDATION" };
    var client = db();
    if (!client) return { data: null, error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    var client = db();
    if (!isUuid(academyId)) return { data: [], error: "Invalid academy id", code: "VALIDATION" };
    if (!client) return { data: [], error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    role = normRole(role);
    if (!isUuid(academyId)) return { data: null, error: "Invalid academy id", code: "VALIDATION" };
    if (!isUuid(targetUserId)) return { data: null, error: "Enter the member's User ID (UUID of an existing signed-up user).", code: "VALIDATION" };
    if (!role || role === "platform_owner") return { data: null, error: "Invalid role for academy membership.", code: "VALIDATION" };
    var me = authed();
    if (me && me.id === targetUserId && isPrivileged(role)) {
      return { data: null, error: "You cannot grant yourself a privileged role.", code: "DENIED" };
    }
    var client = db();
    if (!client || !me) return { data: null, error: "Sign in required", code: "NOT_AUTH" };
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
    if (!isUuid(academyId) || !isUuid(targetUserId)) return { data: null, error: "Invalid ids", code: "VALIDATION" };
    var me = authed();
    if (me && me.id === targetUserId) return { data: null, error: "Members cannot change their own role.", code: "DENIED" };
    var client = db();
    if (!client || !me) return { data: null, error: "Sign in required", code: "NOT_AUTH" };
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
    var client = db();
    if (!isUuid(academyId)) return { data: [], error: "Invalid academy id", code: "VALIDATION" };
    if (!client) return { data: [], error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    var v = validateClassInput(input);
    if (v.errors.length) return { data: null, error: v.errors.join("; "), code: "VALIDATION" };
    if (!isUuid(academyId)) return { data: null, error: "Invalid academy id", code: "VALIDATION" };
    var client = db(), user = authed();
    if (!client || !user) return { data: null, error: "Sign in required", code: "NOT_AUTH" };
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
    if (!isUuid(classId)) return { data: null, error: "Invalid class id", code: "VALIDATION" };
    var client = db();
    if (!client) return { data: null, error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    var client = db();
    if (!isUuid(classId)) return { data: [], error: "Invalid class id", code: "VALIDATION" };
    if (!client) return { data: [], error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    if (!isUuid(classId)) return { data: null, error: "Invalid class id", code: "VALIDATION" };
    if (!isUuid(teacherUserId)) return { data: null, error: "Enter the teacher's User ID (UUID).", code: "VALIDATION" };
    var client = db(), me = authed();
    if (!client || !me) return { data: null, error: "Sign in required", code: "NOT_AUTH" };
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
    if (!isUuid(classId) || !isUuid(teacherUserId)) return { data: null, error: "Invalid ids", code: "VALIDATION" };
    var client = db();
    if (!client) return { data: null, error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    var client = db(), user = authed();
    if (!client || !user) return { data: [], error: !user ? "Not signed in" : "Sync not initialized", code: !user ? "NOT_AUTH" : "SETUP_REQUIRED" };
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
    var client = db();
    if (!isUuid(classId)) return { data: [], error: "Invalid class id", code: "VALIDATION" };
    if (!client) return { data: [], error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    if (!isUuid(classId)) return { data: null, error: "Invalid class id", code: "VALIDATION" };
    if (!isUuid(studentUserId)) return { data: null, error: "Enter the student's User ID (UUID of an existing signed-up user).", code: "VALIDATION" };
    var me = authed();
    if (me && me.id === studentUserId) return { data: null, error: "Self-enrollment is disabled; ask a manager or teacher.", code: "DENIED" };
    var client = db();
    if (!client || !me) return { data: null, error: "Sign in required", code: "NOT_AUTH" };
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
    if (!isUuid(classId) || !isUuid(studentUserId)) return { data: null, error: "Invalid ids", code: "VALIDATION" };
    var client = db();
    if (!client) return { data: null, error: "Sync not initialized", code: "SETUP_REQUIRED" };
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
    if (!isUuid(studentUserId)) return { data: null, error: "Invalid student id", code: "VALIDATION" };
    var client = db();
    if (!client) return { data: null, error: "Sync not initialized", code: "SETUP_REQUIRED" };
    try {
      var r = await client.from("user_progress").select("user_id,state,version,updated_at").eq("user_id", studentUserId).single();
      if (r.error) {
        if (isMissingTable(r.error)) return { data: null, error: "Academy database is not configured yet.", code: "SETUP_REQUIRED" };
        return { data: null, error: errOf(r.error, "Not authorized to view this student's progress.").error, code: "DENIED" };
      }
      return { data: r.data, summary: aggregateProgress(r.data && r.data.state), error: null };
    } catch (e) { return { data: null, error: errOf(e).error, code: "DENIED" }; }
  }

  async function getProfiles(userIds) {
    var client = db();
    var ids = (userIds || []).filter(isUuid).slice(0, MAX_PAGE_SIZE);
    if (!client) return { data: [], error: "Sync not initialized", code: "SETUP_REQUIRED" };
    if (!ids.length) return { data: [], error: null };
    try {
      var r = await client.from("profiles").select("id,display_name,avatar_url,created_at").in("id", ids);
      if (r.error) return { data: [], error: errOf(r.error).error, code: "DENIED" };
      return { data: r.data || [], error: null };
    } catch (e) { return { data: [], error: errOf(e).error, code: "DENIED" }; }
  }

  async function logAudit(academyId, action, entityType, entityId, metadata) {
    if (!isUuid(academyId)) return { data: null, error: "Invalid academy id", code: "VALIDATION" };
    var client = db(), me = authed();
    if (!client || !me) return { data: null, error: "Sign in required", code: "NOT_AUTH" };
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
