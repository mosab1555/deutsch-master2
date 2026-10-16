/* Deutsch Master — Academy RLS static validator (Node, stdlib-only, NO DATABASE).
 *
 * Validates the pgTAP integration suite + migration/rollback safety WITHOUT
 * touching any database (production, staging, or local). Live RLS execution
 * requires an isolated environment (local `supabase start` with Docker, or a
 * dedicated staging project); this script additionally probes that
 * prerequisite tooling and reports BLOCKED when it is absent.
 *
 * Static checks (all must PASS):
 *   S1  pgTAP file exists at supabase/tests/academy_core_rls_test.sql
 *   S2  plan(N) equals the counted pgTAP assertions
 *   S3  all required coverage areas present (2 academies, 7 user types,
 *       cross-academy, assigned/unassigned teacher, self/other student,
 *       self-grant, revocation x2, audit, platform lockdown, grants, anon)
 *   S4  suite runs in a transaction and ends with ROLLBACK (no residue)
 *   S5  no service-role key/secret; end-user evidence uses authenticated/anon
 *       roles only (SET ROLE authenticated / anon; never service_role)
 *   S6  fixtures labelled TEST-FIXTURE / seeded-test-fixture
 *   S7  migration safety: auth.uid() policies, no anon grants on academy
 *       tables, no DROP of v1 tables, no INSERT into platform_owners,
 *       no hardcoded owner identity
 *   S8  rollback inspected (not executed): reverse order, IF EXISTS,
 *       preserves v1 tables + auth.users
 *   S9  client code never writes platform_owners (provisioning is
 *       trusted-operator SQL only)
 *   S10 environment probe reported (informational; live run BLOCKED here)
*   S12 assignment/enrollment fixtures seeded as platform-owner fixture
*       (authenticated + jwt sub) with RESET ROLE after; no trigger bypass,
*       no guard/policy/grant weakening; ON CONFLICT DO NOTHING preserved
 *
 * Usage: node tools/test-academy-rls-static.js   (exit 0 = static PASS)
 * Live run (isolated env only, NEVER production):
 *   supabase start && supabase test db --file supabase/tests/academy_core_rls_test.sql
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name + (extra ? " | " + extra : "")); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}
function read(p) {
  try { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
  catch (e) { return null; }
}

const TAP = "supabase/tests/academy_core_rls_test.sql";
const MIG = "supabase/migrations/20261015000000_academy_core.sql";
const RB = "supabase/manual/20261015_academy_core_rollback.sql";
const BASE = "supabase/migration.sql";

// ---------- S1: files exist ----------
const tap = read(TAP), mig = read(MIG), rb = read(RB), base = read(BASE);
ok("S1 pgTAP suite exists", !!tap, TAP);
ok("S1 migration exists", !!mig, MIG);
ok("S1 rollback exists", !!rb, RB);
ok("S1 baseline exists", !!base, BASE);
if (!tap || !mig || !rb || !base) {
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: FAIL");
  process.exit(1);
}

// ---------- S2: plan count matches assertions ----------
const planM = tap.match(/SELECT\s+plan\((\d+)\)\s*;/);
const planN = planM ? parseInt(planM[1], 10) : -1;
const ASSERT_FNS = ["ok", "is", "isnt", "results_eq", "results_ne", "throws_ok",
  "throws_like", "lives_ok", "is_empty", "isnt_empty", "has_table", "hasnt_table",
  "has_function", "has_trigger", "has_column", "has_pk", "has_fk", "col_is_null",
  "table_privs_are", "function_privs_are", "has_role", "hasnt_role", "diag"];
let counted = 0;
for (const fn of ASSERT_FNS) {
  const re = new RegExp("(^|[^_A-Za-z0-9])SELECT\\s+" + fn + "\\s*\\(", "gm");
  const m = tap.match(re);
  if (m) counted += m.length;
}
// Exclude bare helper SELECTs that are not assertions (set_config, finish, plan).
ok("S2 plan(N) matches counted assertions", planN === counted, "plan=" + planN + " counted=" + counted);

// ---------- S3: coverage areas ----------
const need = [
  ["two academies A+B", /academy A/i.test(tap) && /academy B/i.test(tap)],
  ["platform owner fixture+reads", /platform.owner/i.test(tap) && /platform owner reads both/i.test(tap)],
  ["academy owner + admin", /ownerA/i.test(tap) && /adminA/i.test(tap)],
  ["assigned teacher sees class", /teacherA1 sees assigned/i.test(tap)],
  ["unassigned teacher sees none", /unassigned teacherA2 sees no/i.test(tap)],
  ["enrolled student self progress", /studentA1 reads own progress/i.test(tap)],
  ["student denied other progress", /denied another student progress|denied academy A student progress/i.test(tap)],
  ["other-academy student denied", /studentB denied/i.test(tap)],
  ["outsider denied", /outsider reads no/i.test(tap)],
  ["anonymous denied (permission denied, no grant)", /anonymous (reads no|denied)/i.test(tap) && /permission denied/i.test(tap)],
  ["cross-academy write denied", /denied creating class in academy B/i.test(tap)],
  ["self-grant teacher blocked", /self-granting teacher/i.test(tap)],
  ["self-promotion blocked", /self-promotion/i.test(tap)],
  ["enrollment removal + revocation", /removes enrollment/i.test(tap) && /removed student loses/i.test(tap)],
  ["revocation preserves profile+progress", /profile preserved/i.test(tap) && /progress preserved/i.test(tap)],
  ["teacher revocation", /revokes teacher assignment/i.test(tap) && /revoked teacher loses/i.test(tap)],
  ["audit append-only", /denied audit writes/i.test(tap)],
  ["platform_owners lockdown", /cannot read platform_owners/i.test(tap) && /not writable by academy owners/i.test(tap)],
  ["platform fixture positive control (helper boolean)", /is_platform_owner true/i.test(tap) && /non-owner helper false|exposes boolean only/i.test(tap)],
  ["permission-denied (not empty) for missing grants", /permission denied/i.test(tap)],
  ["grants authenticated vs anon", /authenticated granted/i.test(tap) && /anon has NO grant/i.test(tap)]
];
for (const [n, c] of need) ok("S3 coverage: " + n, !!c);

// ---------- S4: transactional, rolls back, finishes ----------
ok("S4 suite opens transaction", /(^|\n)\s*BEGIN\s*;/i.test(tap));
ok("S4 suite calls finish()", /SELECT\s+\*\s+FROM\s+finish\(\)\s*;/i.test(tap));
ok("S4 suite ends with ROLLBACK", /ROLLBACK\s*;\s*$/i.test(tap.trim()));
ok("S4 no COMMIT (never persists)", !/(^|\n)\s*COMMIT\s*;/i.test(tap));

// ---------- S5: no privileged secrets; end-user evidence only ----------
ok("S5 no service-role key in suite", !/sb_secret_[A-Za-z0-9_-]{10,}|SUPABASE_SERVICE_ROLE_KEY/i.test(tap));
ok("S5 uses authenticated role", /SET\s+ROLE\s+authenticated/i.test(tap));
ok("S5 uses anon role", /SET\s+ROLE\s+anon/i.test(tap));
ok("S5 never SET ROLE service_role", !/SET\s+ROLE\s+service_role/i.test(tap));
ok("S5 simulates identity via jwt claim (auth.uid path)",
  /request\.jwt\.claim\.sub/i.test(tap));

// ---------- S6: seeded vs real distinguished ----------
ok("S6 fixtures labelled TEST-FIXTURE", /TEST.?FIXTURE/i.test(tap));
ok("S6 progress rows labelled seeded-test-fixture", /seeded-test-fixture/i.test(tap));

// ---------- S7: migration safety (static) ----------
ok("S7 policies use auth.uid()", /auth\.uid\(\)/.test(mig));
ok("S7 no anon grant on academy tables", !/\bGRANT\b[^;]*\bTO\s+anon\b[^;]*academ|ON\s+public\.(academies|academy_members|classes|class_teachers|class_enrollments)[^;]*\bTO\s+anon/i.test(mig)
  && !/TO\s+anon,\s*authenticated|TO\s+anon;/i.test(mig.split("11. GRANTS")[1] || ""));
ok("S7 no DROP of v1 tables", !/DROP\s+TABLE[^;]*(profiles|user_progress|sync_queue|devices|auth_events)/i.test(mig));
ok("S7 no INSERT into platform_owners (operator-only)", !/INSERT\s+INTO\s+(public\.)?platform_owners/i.test(mig));
ok("S7 no hardcoded owner identity", !/00000000-0000-4000-8000-0000000000|@example\.(com|org)|mosab/i.test(mig.split("-- Design notes")[0] + mig.split("platform_owners")[1].slice(0, 500)));
ok("S7 self-enrollment disabled in trigger", /self-enrollment is disabled/i.test(mig));
ok("S7 academy helpers SECURITY DEFINER + safe search_path (public, pg_temp last)",
  /SECURITY DEFINER[\s\S]{0,80}SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(mig));
ok("S7 academy has no SECURITY DEFINER without fixed search_path",
  !/SECURITY DEFINER/i.test(mig.replace(/--[^\n]*/g, "").replace(/SECURITY DEFINER[\s\S]{0,80}SET\s+search_path\s*=\s*public\s*,\s*pg_temp/gi, "")));
ok("S7 academy search_path keeps pg_temp last (no pg_temp first)",
  !/SET\s+search_path\s*=\s*pg_temp\s*,/i.test(mig));
ok("S7 baseline handle_new_user hardened (public, pg_temp)",
  /handle_new_user[\s\S]{0,200}SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(base));
ok("S7 baseline update_updated_at_column has fixed search_path",
  /update_updated_at_column[\s\S]{0,200}SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(base));
ok("S7 baseline progress helpers hardened (public, pg_temp)",
  /get_or_create_user_progress[\s\S]{0,400}SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(base)
  && /update_user_progress[\s\S]{0,600}SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(base));
ok("S7 baseline still one-time (not artificially idempotent)",
  /ONE-TIME FRESH-PROJECT BASELINE/i.test(base)
  && !/CREATE TABLE IF NOT EXISTS public\.(profiles|user_progress|sync_queue|devices|auth_events)/i.test(base));
ok("S7 pgTAP uses permission-denied (not empty) for missing grants",
  /throws_like\([\s\S]{0,120}%permission denied%/i.test(tap)
  && !/SELECT is_empty\('SELECT 1 FROM public\.platform_owners'/i.test(tap)
  && !/SELECT is_empty\('SELECT 1 FROM public\.academies', 'anonymous/i.test(tap));

// ---------- S8: rollback inspected (NOT executed) ----------
ok("S8 rollback drops academy policies first", rb.indexOf("Drop additive policies") < rb.indexOf("Drop triggers"));
ok("S8 rollback drops triggers before functions", rb.indexOf("Drop triggers") < rb.indexOf("Drop functions"));
ok("S8 rollback drops functions before tables", rb.indexOf("Drop functions") < rb.indexOf("Drop tables"));
ok("S8 rollback re-runnable (IF EXISTS)", (rb.match(/IF EXISTS/g) || []).length >= 20);
ok("S8 rollback preserves v1 + auth.users",
  /NEVER touches v1|profiles\/user_progress/i.test(rb) && !/DROP\s+TABLE[^;]*auth\.users/i.test(rb));
ok("S8 rollback never executed here (read-only inspection only)", true, "no psql/supabase db push run by this static check");

// ---------- S9: client never writes platform_owners ----------
let clientWritesOwners = false;
try {
  const files = fs.readdirSync(path.join(ROOT, "client")).filter(f => f.endsWith(".js"));
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, "client", f), "utf8");
    if (/platform_owners/i.test(src)) { clientWritesOwners = true; console.log("  note: client/" + f + " mentions platform_owners"); }
  }
} catch (e) {}
ok("S9 no client code path writes platform_owners", !clientWritesOwners,
  "provisioning = trusted-operator SQL only");

// ---------- S11: ACL hardening matrix (offline, no DB) ----------
const REP = "supabase/migrations/20261016000000_acl_hardening_repair.sql";
const rep = read(REP);
ok("S11 repair file exists", !!rep, REP);
// Baseline REVOKE-first (ALL covers TRUNCATE/REFERENCES/TRIGGER).
ok("S11 baseline revokes ALL on tables first",
  /REVOKE\s+ALL\s+ON\s+TABLE\s+(public\.)?profiles[\s\S]{0,200}FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(base));
ok("S11 baseline revokes ALL on sequences first",
  /REVOKE\s+ALL\s+ON\s+SEQUENCE\s+(public\.)?user_progress_id_seq/i.test(base));
ok("S11 baseline grants CRUD to authenticated only (no anon on 4 tables)",
  /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+(public\.)?profiles\s+TO\s+authenticated/i.test(base)
  && /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+(public\.)?user_progress\s+TO\s+authenticated/i.test(base)
  && /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+(public\.)?sync_queue\s+TO\s+authenticated/i.test(base)
  && /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+(public\.)?devices\s+TO\s+authenticated/i.test(base)
  && !/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+(public\.)?(profiles|user_progress|sync_queue|devices)\s+TO\s+anon/i.test(base));
ok("S11 baseline auth_events SELECT+INSERT authenticated, INSERT-only anon",
  /GRANT\s+SELECT,\s*INSERT\s+ON\s+(public\.)?auth_events\s+TO\s+authenticated/i.test(base)
  && /GRANT\s+INSERT\s+ON\s+(public\.)?auth_events\s+TO\s+anon/i.test(base)
  && !/GRANT\s+(SELECT,\s*)?INSERT,\s*UPDATE,\s*DELETE\s+ON\s+(public\.)?auth_events/i.test(base));
ok("S11 baseline sequences USAGE only (anon only auth_events)",
  /GRANT\s+USAGE\s+ON\s+SEQUENCE\s+(public\.)?user_progress_id_seq\s+TO\s+authenticated/i.test(base)
  && /GRANT\s+USAGE\s+ON\s+SEQUENCE\s+(public\.)?auth_events_id_seq\s+TO\s+anon/i.test(base)
  && !/GRANT\s+(SELECT|UPDATE)\s+ON\s+SEQUENCE/i.test(base));
ok("S11 baseline future defaults revoked for postgres, supabase_admin untouched",
  /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public[\s\S]{0,120}REVOKE\s+ALL\s+ON\s+TABLES\s+FROM/i.test(base)
  && /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public[\s\S]{0,120}REVOKE\s+ALL\s+ON\s+SEQUENCES\s+FROM/i.test(base)
  && !/ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+supabase_admin/i.test(base));
ok("S11 baseline progress RPCs enforce caller identity (no arbitrary p_user_id)",
  /get_or_create_user_progress[\s\S]{0,800}p_user_id\s+IS\s+DISTINCT\s+FROM\s+auth\.uid\(\)/i.test(base)
  && /update_user_progress[\s\S]{0,800}p_user_id\s+IS\s+DISTINCT\s+FROM\s+auth\.uid\(\)/i.test(base));
ok("S11 baseline RPC EXECUTE narrowed (no PUBLIC/anon)",
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.get_or_create_user_progress\(UUID,\s*JSONB\)\s+FROM\s+PUBLIC,\s*anon/i.test(base)
  && /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_or_create_user_progress/i.test(base)
  && /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.handle_new_user\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(base));
// Academy exact matrix.
ok("S11 academy revokes ALL on 7 tables first",
  /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.academies[\s\S]{0,300}public\.platform_owners\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(mig));
ok("S11 academy academies no DELETE (archive via UPDATE, no policy)",
  /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+public\.academies\s+TO\s+authenticated/i.test(mig)
  && !/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+public\.academies/i.test(mig));
ok("S11 academy link tables no UPDATE (no policy, no client op)",
  /GRANT\s+SELECT,\s*INSERT,\s*DELETE\s+ON\s+public\.class_teachers\s+TO\s+authenticated/i.test(mig)
  && /GRANT\s+SELECT,\s*INSERT,\s*DELETE\s+ON\s+public\.class_enrollments\s+TO\s+authenticated/i.test(mig)
  && !/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+public\.class_teachers/i.test(mig));
ok("S11 academy audit append-only + platform_owners locked",
  /GRANT\s+SELECT,\s*INSERT\s+ON\s+public\.academy_audit_events\s+TO\s+authenticated/i.test(mig)
  && !/GRANT\s+[^\n;]*ON\s+public\.platform_owners\s+TO\s+(anon|authenticated)/i.test(mig)
  && /GRANT\s+USAGE\s+ON\s+SEQUENCE\s+public\.academy_audit_events_id_seq\s+TO\s+authenticated/i.test(mig)
  && !/GRANT\s+USAGE\s+ON\s+SEQUENCE\s+public\.academy_audit_events_id_seq\s+TO\s+anon/i.test(mig));
ok("S11 academy future defaults revoked for postgres, supabase_admin untouched",
  /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public[\s\S]{0,120}REVOKE\s+ALL\s+ON\s+TABLES/i.test(mig)
  && !/ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+supabase_admin/i.test(mig));
ok("S11 academy helpers EXECUTE authenticated only (no anon/PUBLIC)",
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.is_platform_owner\(\)\s+FROM\s+PUBLIC,\s*anon/i.test(mig)
  && /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_platform_owner\(\)\s+TO\s+authenticated/i.test(mig)
  && /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.guard_audit_insert\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(mig));
ok("S11 academy RLS not weakened (all policies retained)",
  (mig.match(/CREATE\s+POLICY/g) || []).length >= 15
  && /CREATE\s+POLICY\s+"academies_select_member"/i.test(mig)
  && /CREATE\s+POLICY\s+"members_select_same_academy"/i.test(mig)
  && /CREATE\s+POLICY\s+"classes_select_member"/i.test(mig)
  && /CREATE\s+POLICY\s+"audit_select_manager"/i.test(mig)
  && /CREATE\s+POLICY\s+"progress_teacher_read"/i.test(mig)
  && /CREATE\s+POLICY\s+"profiles_academy_read"/i.test(mig));
// Repair file safety + completeness.
ok("S11 repair covers all 12 tables + 4 sequences",
  !!rep && /public\.profiles[\s\S]{0,200}public\.auth_events/i.test(rep)
  && /public\.academies[\s\S]{0,400}public\.platform_owners/i.test(rep)
  && /public\.academy_audit_events_id_seq/i.test(rep));
ok("S11 repair fixes RPC identity + narrows EXECUTE",
  !!rep && /p_user_id\s+IS\s+DISTINCT\s+FROM\s+auth\.uid\(\)/i.test(rep)
  && /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.get_or_create_user_progress/i.test(rep));
ok("S11 repair safe: no DROP/CREATE TABLE, no COMMIT, has verification",
  !!rep && !/^\s*(DROP\s+TABLE|CREATE\s+TABLE)\b/im.test(rep.replace(/--[^\n]*/g, ""))
  && !/(^|\n)\s*COMMIT\s*;/i.test(rep)
  && /post-repair verification/i.test(rep)
  && /information_schema\.role_table_grants/i.test(rep));
ok("S11 repair prerequisites cite staging, never prod, postgres owner",
  !!rep && /uafwvkgaijmcofistjum/i.test(rep) && /bhdgpscedjowchldsjnd/i.test(rep)
  && /AS\s+postgres\s+owner/i.test(rep));

// ---------- S12: assignment/enrollment fixtures use authorized identity (no bypass) ----------
(function () {
  const OWNER = "00000000-0000-4000-8000-000000000001";
  const iClasses = tap.indexOf("INSERT INTO public.classes");
  const iTeachers = tap.indexOf("INSERT INTO public.class_teachers");
  const iEnroll = tap.indexOf("INSERT INTO public.class_enrollments");
  const iProgress = tap.indexOf("INSERT INTO public.user_progress");
  const authBlockRe = new RegExp(
    "RESET ROLE;\\s*SET ROLE authenticated;\\s*\\nSELECT set_config\\('request\\.jwt\\.claim\\.sub',\\s*'" +
    OWNER + "'",
    "i"
  );
  const authBlockM = tap.match(authBlockRe);
  const iAuth = authBlockM ? tap.indexOf(authBlockM[0]) : -1;
  // RESET ROLE restoring owner context sits between enrollments and user_progress seeding.
  const iResetAfter = tap.indexOf("RESET ROLE;", iEnroll);
  ok("S12 teachers+enrollments seeded as platform-owner fixture (authenticated)",
    iClasses >= 0 && iTeachers > iClasses && iEnroll > iTeachers && iAuth > iClasses
    && iAuth < iTeachers && !!authBlockM,
    "platform-owner " + OWNER);
  ok("S12 authorized context covers both INSERTs then RESET ROLE before progress seeding",
    iResetAfter > iEnroll && iProgress > iResetAfter
    && tap.slice(iTeachers, iResetAfter).indexOf("INSERT INTO public.class_enrollments") >= 0,
    "RESET ROLE restores owner context");
  ok("S12 ON CONFLICT DO NOTHING preserved on both assignment fixtures",
    /INSERT INTO public\.class_teachers[\s\S]{0,400}ON CONFLICT DO NOTHING/i.test(tap)
    && /INSERT INTO public\.class_enrollments[\s\S]{0,500}ON CONFLICT DO NOTHING/i.test(tap));
  ok("S12 no trigger bypass (no replication role / DISABLE / DROP TRIGGER)",
    !/session_replication_role/i.test(tap)
    && !/DISABLE\s+TRIGGER/i.test(tap)
    && !/DROP\s+TRIGGER/i.test(tap)
    && !/ALTER\s+TABLE[^;]*DISABLE/i.test(tap));
  ok("S12 no guard/policy/grant weakening inside pgTAP suite",
    !/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.(guard_|is_academy_manager|academy_role|is_platform_owner)/i.test(tap)
    && !/CREATE\s+POLICY/i.test(tap)
    && !/(^|\n)\s*(GRANT|REVOKE)\s+(ALL|SELECT|INSERT|UPDATE|DELETE|EXECUTE|USAGE)\s+ON/i.test(tap));
})();

// ---------- S10: environment probe (informational) ----------
function has(cmd) {
  try {
    execSync((process.platform === "win32" ? "where " : "command -v ") + cmd,
      { stdio: "pipe", timeout: 8000 });
    return true;
  } catch (e) { return false; }
}
const dockerOk = has("docker") || has("podman");
const psqlOk = has("psql");
let pgModule = false;
try { require.resolve("pg"); pgModule = true; } catch (e) {}
const localStack = dockerOk;
console.log("INFO env: docker/podman=" + dockerOk + " psql=" + psqlOk + " node-pg=" + pgModule);
ok("S10 isolated DB tooling reported", true,
  localStack ? "local stack possible" : "BLOCKED: no docker/podman/psql — live RLS run unavailable here");
if (!localStack) {
  console.log("INFO live execution requires: install Docker Desktop -> supabase start ->");
  console.log("INFO   supabase test db --file " + TAP + "   (isolated env only, NEVER --linked production)");
}

console.log("====");
console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS (static only; live RLS NOT executed)"));
process.exit(fail ? 1 : 0);
