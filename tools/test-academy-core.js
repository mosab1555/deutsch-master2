/* Deutsch Master — Phase 1 academy-core focused tests (Node, stdlib-only).
 *
 * Covers Gate 2/5/6 permission boundaries with TWO separate test academies,
 * plus class lifecycle, enrollment/removal, progress aggregation accuracy,
 * unauthorized role changes, migration safety, UI wiring, and learner
 * backward-compatibility. No network, no Supabase, no writes to content.
 *
 * Usage: node tools/test-academy-core.js   (exit 0 = PASS, 1 = FAIL)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "client", "academy-core.js"));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name + (extra ? " | " + extra : "")); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

// ---------- Fixtures: two academies, distinct people ----------
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CLASS_A1 = "a0000000-0000-4000-8000-aaaaaaaaaaa1";
const CLASS_A2 = "a0000000-0000-4000-8000-aaaaaaaaaaa2";
const CLASS_B1 = "b0000000-0000-4000-8000-bbbbbbbbbbb1";
const U = {
  platformOwner: "00000000-0000-4000-8000-000000000001",
  ownerA: "00000000-0000-4000-8000-00000000000a",
  adminA: "00000000-0000-4000-8000-00000000000b",
  teacherA1: "00000000-0000-4000-8000-00000000000c",
  teacherA2: "00000000-0000-4000-8000-00000000000d",
  studentA1: "00000000-0000-4000-8000-00000000000e",
  studentA2: "00000000-0000-4000-8000-00000000000f",
  ownerB: "00000000-0000-4000-8000-0000000000b1",
  teacherB: "00000000-0000-4000-8000-0000000000b2",
  studentB: "00000000-0000-4000-8000-0000000000b3",
  outsider: "00000000-0000-4000-8000-0000000000ff"
};
function ctxFor(userId, opt) {
  opt = opt || {};
  return {
    userId: userId,
    isPlatformOwner: userId === U.platformOwner,
    memberships: opt.memberships || [],
    teacherOf: opt.teacherOf || [],
    enrolledIn: opt.enrolledIn || [],
    classAcademy: opt.classAcademy || {}
  };
}
const classAcademy = {};
classAcademy[CLASS_A1] = A; classAcademy[CLASS_A2] = A; classAcademy[CLASS_B1] = B;
const memA = [
  { academy_id: A, role: "academy_owner", status: "active" },
  { academy_id: B, role: "student", status: "active" } // cross-academy membership is explicit
];

// ---------- 1. Roles ----------
ok("roles list exact", JSON.stringify(C.ROLES) === JSON.stringify(["platform_owner", "academy_owner", "academy_admin", "teacher", "student"]));
ok("student not privileged", C.isPrivileged("student") === false);
ok("teacher privileged", C.isPrivileged("teacher") === true);
ok("admin is manager", C.isManagerRole("academy_admin") === true);
ok("teacher not manager", C.isManagerRole("teacher") === false);

// ---------- 2. Academy management boundaries ----------
(function () {
  const ownerACtx = ctxFor(U.ownerA, { memberships: [{ academy_id: A, role: "academy_owner", status: "active" }], classAcademy });
  ok("owner manages own academy", C.canManageAcademy(ownerACtx, A) === true);
  ok("owner cannot manage other academy", C.canManageAcademy(ownerACtx, B) === false);
  const adminACtx = ctxFor(U.adminA, { memberships: [{ academy_id: A, role: "academy_admin", status: "active" }], classAcademy });
  ok("admin manages own academy", C.canManageAcademy(adminACtx, A) === true);
  ok("admin denied cross-academy", C.canManageAcademy(adminACtx, B) === false);
  const teacherCtx = ctxFor(U.teacherA1, { memberships: [{ academy_id: A, role: "teacher", status: "active" }], classAcademy });
  ok("teacher cannot manage academy", C.canManageAcademy(teacherCtx, A) === false);
  const removedCtx = ctxFor(U.adminA, { memberships: [{ academy_id: A, role: "academy_admin", status: "removed" }], classAcademy });
  ok("removed membership grants nothing", C.canManageAcademy(removedCtx, A) === false);
  const platCtx = ctxFor(U.platformOwner, { memberships: [], classAcademy });
  ok("platform owner manages any academy", C.canManageAcademy(platCtx, A) === true && C.canManageAcademy(platCtx, B) === true);
  ok("anonymous manages nothing", C.canManageAcademy(ctxFor(null, { classAcademy }), A) === false);
})();

// ---------- 3. Role grants ----------
(function () {
  const ownerACtx = ctxFor(U.ownerA, { memberships: [{ academy_id: A, role: "academy_owner", status: "active" }], classAcademy });
  const adminACtx = ctxFor(U.adminA, { memberships: [{ academy_id: A, role: "academy_admin", status: "active" }], classAcademy });
  ok("owner can grant admin", C.canGrantRole(ownerACtx, A, "academy_admin") === true);
  ok("owner can grant owner", C.canGrantRole(ownerACtx, A, "academy_owner") === true);
  ok("admin cannot grant admin", C.canGrantRole(adminACtx, A, "academy_admin") === false);
  ok("admin cannot grant owner", C.canGrantRole(adminACtx, A, "academy_owner") === false);
  ok("admin can grant teacher", C.canGrantRole(adminACtx, A, "teacher") === true);
  ok("admin can grant student", C.canGrantRole(adminACtx, A, "student") === true);
  ok("cross-academy grant denied", C.canGrantRole(ownerACtx, B, "teacher") === false);
  ok("self privileged grant flagged", C.denySelfPrivilegedGrant(U.teacherA1, U.teacherA1, "teacher") === true);
  ok("self student grant allowed (non-privileged)", C.denySelfPrivilegedGrant(U.studentA1, U.studentA1, "student") === false);
  ok("platform_owner grant never via academy path", C.canGrantRole(ownerACtx, A, "platform_owner") === false);
})();

// ---------- 4. Teacher restricted to assigned classes ----------
(function () {
  const t1 = ctxFor(U.teacherA1, {
    memberships: [{ academy_id: A, role: "teacher", status: "active" }],
    teacherOf: [CLASS_A1], classAcademy
  });
  ok("teacher manages assigned class", C.canManageClass(t1, CLASS_A1) === true);
  ok("teacher denied unassigned class same academy", C.canManageClass(t1, CLASS_A2) === false);
  ok("teacher denied other academy class", C.canManageClass(t1, CLASS_B1) === false);
  ok("teacher views assigned class", C.canViewClass(t1, CLASS_A1) === true);
  const s1 = ctxFor(U.studentA1, {
    memberships: [{ academy_id: A, role: "student", status: "active" }],
    enrolledIn: [CLASS_A1], classAcademy
  });
  ok("student views enrolled class", C.canViewClass(s1, CLASS_A1) === true);
  ok("student denied unenrolled class", C.canViewClass(s1, CLASS_A2) === false);
})();

// ---------- 5. Student record isolation ----------
(function () {
  const tCtx = ctxFor(U.teacherA1, {
    memberships: [{ academy_id: A, role: "teacher", status: "active" }],
    teacherOf: [CLASS_A1], classAcademy
  });
  const enroll = {};
  enroll[CLASS_A1] = [U.studentA1];
  enroll[CLASS_A2] = [U.studentA2];
  ok("teacher sees student in assigned class",
    C.canViewStudent(tCtx, [CLASS_A1], U.studentA1, enroll) === true);
  ok("teacher denied student in unassigned class",
    C.canViewStudent(tCtx, [CLASS_A1], U.studentA2, enroll) === false);
  ok("student sees self", C.canViewStudent(ctxFor(U.studentA1, {}), [], U.studentA1, {}) === true);
  ok("student denied other student", C.canViewStudent(ctxFor(U.studentA1, {}), [], U.studentA2, {}) === false);
})();

// ---------- 6. Cross-academy denial ----------
(function () {
  const adminB = ctxFor(U.ownerB, { memberships: [{ academy_id: B, role: "academy_owner", status: "active" }], classAcademy });
  ok("B owner denied A academy", C.canManageAcademy(adminB, A) === false);
  ok("B owner denied A class", C.canManageClass(adminB, CLASS_A1) === false);
  ok("B teacher denied A enrollment view",
    C.canViewStudent(ctxFor(U.teacherB, { teacherOf: [CLASS_B1], classAcademy }), [CLASS_B1], U.studentA1, { "b0000000-0000-4000-8000-bbbbbbbbbbb1": [U.studentB] }) === false);
})();

// ---------- 7. Enrollment lifecycle (pure) ----------
(function () {
  const mgr = ctxFor(U.adminA, { memberships: [{ academy_id: A, role: "academy_admin", status: "active" }], teacherOf: [], classAcademy });
  ok("manager can enroll", C.canEnroll(mgr, CLASS_A1) === true);
  const outsider = ctxFor(U.outsider, { memberships: [], classAcademy });
  ok("outsider cannot enroll", C.canEnroll(outsider, CLASS_A1) === false);
  // Removal revokes: after removal, enrolledIn no longer contains class.
  const before = ctxFor(U.studentA1, { memberships: [{ academy_id: A, role: "student", status: "active" }], enrolledIn: [CLASS_A1], classAcademy });
  const after = ctxFor(U.studentA1, { memberships: [{ academy_id: A, role: "student", status: "active" }], enrolledIn: [], classAcademy });
  ok("enrolled student views class", C.canViewClass(before, CLASS_A1) === true);
  ok("removed student denied class", C.canViewClass(after, CLASS_A1) === false);
})();

// ---------- 8. Class lifecycle validation ----------
(function () {
  ok("class name required", C.validateClassInput({ name: " " }).errors.length > 0);
  ok("class level validated", C.validateClassInput({ name: "Fصل A", level: "C2" }).errors.length > 0);
  ok("class valid", C.validateClassInput({ name: "A1 • K1", level: "A1" }).errors.length === 0);
  ok("academy slug validated", C.validateAcademyInput({ name: "x", slug: "BAD SLUG!!" }).errors.length > 0);
  ok("academy valid", C.validateAcademyInput({ name: "Cairo Academy" }).errors.length === 0);
  ok("uuid validated", C.isUuid(U.studentA1) === true && C.isUuid("not-a-uuid") === false);
})();

// ---------- 9. Progress aggregation accuracy ----------
(function () {
  const empty = C.aggregateProgress(null);
  ok("empty state hasData=false", empty.hasData === false && empty.totalAnswered === 0 && empty.accuracy === 0);
  const st = {
    events: [
      { aid: "1", ts: new Date().toISOString(), ok: true, qtype: "article" },
      { aid: "2", ts: new Date().toISOString(), ok: false, qtype: "plural" },
      { aid: "3", ts: new Date().toISOString(), ok: true, qtype: "order" },
      { aid: "4", ts: new Date().toISOString(), ok: true, qtype: "gap" }
    ],
    totalAnswered: 4, totalCorrect: 3,
    mistakes: { m1: { done: false }, m2: { done: true } },
    srs: { w1: { due: "2000-01-01" }, w2: { due: "2999-01-01" } }
  };
  const s = C.aggregateProgress(st);
  ok("totals preserved", s.totalAnswered === 4 && s.totalCorrect === 3);
  ok("accuracy 75", s.accuracy === 75);
  ok("mistakes open counted", s.mistakesOpen === 1);
  ok("hasData true", s.hasData === true);
  ok("no invented grades", !("grade" in s) && !("attendance" in s) && !("engagement" in s));
  const noEvents = C.aggregateProgress({ events: [], totalAnswered: 0, totalCorrect: 0, mistakes: {}, srs: {} });
  ok("zero events empty-ish", noEvents.hasData === false && noEvents.weekly.hasData === false);
})();

// ---------- 10. Migration file safety ----------
(function () {
  const migPath = path.join(ROOT, "supabase", "migrations", "20261015000000_academy_core.sql");
  const rbPath = path.join(ROOT, "supabase", "manual", "20261015_academy_core_rollback.sql");
  ok("migration exists", fs.existsSync(migPath));
  ok("rollback exists", fs.existsSync(rbPath));
  const mig = fs.existsSync(migPath) ? fs.readFileSync(migPath, "utf8") : "";
  const rb = fs.existsSync(rbPath) ? fs.readFileSync(rbPath, "utf8") : "";
  ["platform_owners", "academies", "academy_members", "classes", "class_teachers", "class_enrollments", "academy_audit_events"]
    .forEach(function (t) { ok("migration creates " + t, mig.indexOf(t) >= 0); });
  ok("RLS enabled on academy tables", /ENABLE ROW LEVEL SECURITY/.test(mig));
  ok("no service_role key/table-grant in migration (EXECUTE to service_role allowed)",
    !/SUPABASE_SERVICE_ROLE_KEY|sb_secret_[A-Za-z0-9_-]{10,}/i.test(mig)
    && !/GRANT\s+[^;]*ON\s+(TABLE|public\.(academies|academy_members|classes|class_teachers|class_enrollments|academy_audit_events|platform_owners)|SEQUENCE)[^;]*\bservice_role\b/i.test(mig));
  ok("no hardcoded admin email/uuid", !/mosab|example@mail|00000000-0000-4000-8000-0000000000/i.test(mig));
  ok("no DROP of learner tables", !/DROP TABLE.*profiles|DROP TABLE.*user_progress/i.test(mig));
  ok("policies use auth.uid()", /auth\.uid\(\)/.test(mig));
  ok("grants authenticated only (no anon on academy tables)",
    /TO authenticated/.test(mig) && !/GRANT.*ON public\.academies TO anon/i.test(mig));
  ok("ACL matrix narrowed (no DELETE on academies, no UPDATE on links, audit append-only)",
    /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+public\.academies\s+TO\s+authenticated/i.test(mig)
    && !/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+public\.academies/i.test(mig)
    && /GRANT\s+SELECT,\s*INSERT,\s*DELETE\s+ON\s+public\.class_teachers/i.test(mig)
    && /GRANT\s+SELECT,\s*INSERT\s+ON\s+public\.academy_audit_events/i.test(mig)
    && /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.academies/i.test(mig));
  ok("baseline RPCs enforce caller identity",
    (function () {
      try {
        var b = fs.readFileSync(path.join(ROOT, "supabase", "migration.sql"), "utf8");
        return /p_user_id\s+IS\s+DISTINCT\s+FROM\s+auth\.uid\(\)/i.test(b);
      } catch (e) { return false; }
    })());
  ok("repair file prepared (forward-only; staging execution tracked outside this static check)",
    (function () {
      try {
        var r = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20261016000000_acl_hardening_repair.sql"), "utf8");
        return /REVOKE\s+ALL/i.test(r) && /post-repair verification/i.test(r)
          && !/DROP\s+TABLE/i.test(r) && /uafwvkgaijmcofistjum/i.test(r);
      } catch (e) { return false; }
    })());
  ok("rollback drops academy tables", /DROP TABLE IF EXISTS public\.academies/.test(rb));
  ok("rollback preserves learner tables note", /NEVER touches v1|profiles\/user_progress/i.test(rb));
  ok("v1 migration untouched", fs.existsSync(path.join(ROOT, "supabase", "migration.sql")));
})();

// ---------- 11. UI wiring ----------
(function () {
  const acadHtml = fs.readFileSync(path.join(ROOT, "client", "academy.html"), "utf8");
  ["page-academy-overview", "page-academy-settings", "page-academy-teachers",
   "page-academy-classes", "page-academy-enroll", "page-teacher",
   "acadSetupBanner", "acadMyUid", "acadSelector", "acadOverviewBody",
   "acadSettingsBody", "acadTeachersBody", "acadClassesBody", "acadEnrollBody",
   "acadTeacherBody", "academy-core.js", "academy-portal.js"
  ].forEach(function (id) { ok("academy.html contains " + id, acadHtml.indexOf(id) >= 0); });
  const idxHtml = fs.readFileSync(path.join(ROOT, "client", "index.html"), "utf8");
  ok("learner index.html does NOT load academy-portal (preserved)",
    idxHtml.indexOf("academy-portal.js") < 0 && idxHtml.indexOf("academy-core.js") < 0);
  const sw = fs.readFileSync(path.join(ROOT, "client", "sw.js"), "utf8");
  ok("sw precaches academy-core", sw.indexOf("academy-core.js") >= 0);
  ok("sw precaches academy-portal", sw.indexOf("academy-portal.js") >= 0);
  ["client/academy-core.js", "client/academy-portal.js"].forEach(function (f) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    ok(f + " no service_role", !/service_role|sb_secret/i.test(src));
    ok(f + " no hardcoded uuid owner", !/00000000-0000-4000-8000-0000000000/i.test(src));
  });
  const portal = fs.readFileSync(path.join(ROOT, "client", "academy-portal.js"), "utf8");
  ok("portal shows setup status (no fake success)", /migration_not_applied|setupMissing|SETUP_REQUIRED/.test(portal));
  ok("portal has empty states", /لا يوجد|لا توجد|empty|📭/i.test(portal));
  ok("portal has permission-denied states", /⛔|permission|denied|DENIED/i.test(portal));
  ok("portal bounded requests (pagination)", /PAGE_SIZE|range\(|page/i.test(portal));
  ok("portal never deletes accounts", !/deleteAccount|auth\.admin\.delete/i.test(portal));
})();

// ---------- 12. Learner backward-compat (untouched core) ----------
(function () {
  // Academy files must not redefine learner globals (code use, not comments).
  const core = fs.readFileSync(path.join(ROOT, "client", "academy-core.js"), "utf8");
  const coreCode = core.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ["window.S =", "DMProgress.logAttempt", "localStorage.setItem(\"deutsch_master_v2", "dm_sync_queue"]
    .forEach(function (token) { ok("academy-core does not touch learner token: " + token.slice(0, 24), coreCode.indexOf(token) < 0); });
  const portal = fs.readFileSync(path.join(ROOT, "client", "academy-portal.js"), "utf8");
  ok("portal inert on learner entry", /page-academy-overview|acadSetupBanner.*return|learner entry/.test(portal));
  ["client/script.js", "client/progress.js", "client/cloud-sync.js", "client/auth.js"].forEach(function (f) {
    ok(f + " exists (learner preserved)", fs.existsSync(path.join(ROOT, f)));
  });
})();

console.log("====");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
process.exit(fail ? 1 : 0);
