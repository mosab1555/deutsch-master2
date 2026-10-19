/* Deutsch Master — C4 privacy/consent/deletion static+unit regression suite.
 *
 * Stdlib-only Node script: no network, no database, no credentials, no
 * writes outside memory. It protects the C4 deliverables:
 *   P1 legal pages integrity (UTF-8 Arabic, RTL, links, no overclaims)
 *   P2 consent module default-off behaviour and own-row-only writes
 *   P3 consent_records migration/rollback static safety (additive, RLS)
 *   P4 delete-account Edge Function static safety (JWT-bound, self-only,
 *      typed confirmation, secrets from env, placeholder untouched)
 *   P5 integration surface (index/sw precache, no enforcement wiring)
 *   P6 consent pgTAP suite static safety (isolated-only, single transaction
 *      ending in ROLLBACK, plan(N) == counted assertions, required live
 *      scenarios present, no destructive SQL/secrets/project refs)
 *
 * Usage: node tools/test-c4-privacy-consent.js   (exit 0 = PASS)
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "client");
const WWW = path.join(ROOT, "www");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name + (extra ? " | " + extra : "")); }
  else { fail++; console.log("FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

function readBytes(p) { return fs.readFileSync(p); }
function readText(p) { return fs.readFileSync(p, "utf8"); }
function stripComments(src) {
  try { return String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""); }
  catch (e) { return String(src); }
}
function decodeUtf8Strict(bytes) {
  const dec = new TextDecoder("utf-8", { fatal: true });
  return dec.decode(bytes);
}
function countArabic(s) {
  return (s.match(/[\u0600-\u06FF]/g) || []).length;
}
function walkFiles(dir, rel, out) {
  rel = rel || ""; out = out || [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const r = rel ? rel + "/" + n : n;
    if (fs.statSync(p).isDirectory()) walkFiles(p, r, out);
    else out.push(r);
  }
  return out;
}

// ---------- P1: legal pages integrity ----------
(function () {
  const pages = ["privacy.html", "terms.html"];
  for (const f of pages) {
    const cp = path.join(CLIENT, f);
    const wp = path.join(WWW, f);
    ok("P1 " + f + " exists in client+www", fs.existsSync(cp) && fs.existsSync(wp));
    if (!fs.existsSync(cp) || !fs.existsSync(wp)) continue;
    const cb = readBytes(cp);
    const wb = readBytes(wp);
    ok("P1 " + f + " client==www byte-identical", cb.equals(wb));
    let text = null;
    try { text = decodeUtf8Strict(cb); } catch (e) { text = null; }
    ok("P1 " + f + " decodes as strict UTF-8", text !== null);
    if (text === null) continue;
    ok("P1 " + f + " no replacement chars", text.indexOf("\uFFFD") < 0);
    ok("P1 " + f + " no ??? runs", !/\?\?\?/.test(text));
    ok("P1 " + f + " readable Arabic present", countArabic(text) > 800, "arabic=" + countArabic(text));
    ok("P1 " + f + " lang=ar dir=rtl", /<html lang="ar" dir="rtl"/.test(text));
    ok("P1 " + f + " utf-8 meta + viewport", /charset="UTF-8"/i.test(text) && /name="viewport"/.test(text));
    ok("P1 " + f + " non-empty title", /<title>[^<]{3,}<\/title>/.test(text));
    ok("P1 " + f + " no secrets in markup", !/service_role|sb_secret|eyJ[A-Za-z0-9_-]{20,}/.test(text));
    ok("P1 " + f + " no invented contact email", !/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text));
    ok("P1 " + f + " no hosting-in-Egypt claim", !/مستضاف[^.<]{0,40}مصر/.test(text) && !/خوادم[^.<]{0,40}مصر/.test(text));
    ok("P1 " + f + " no certification claim", !/ISO\s?\d/.test(text));
    const hrefs = Array.from(text.matchAll(/href="([^"]+)"/g)).map((m) => m[1]);
    const internal = hrefs.filter((h) => /\.html($|\?)/.test(h));
    const missing = internal.filter((h) => !fs.existsSync(path.join(CLIENT, h.split("?")[0])));
    ok("P1 " + f + " internal html links resolve", internal.length > 0 && missing.length === 0, missing.join(","));
  }

  const privacy = readText(path.join(CLIENT, "privacy.html"));
  ok("P1 privacy cross-links terms", privacy.indexOf('href="terms.html"') >= 0);
  ok("P1 privacy links learner app", privacy.indexOf('href="index.html"') >= 0);
  ok("P1 privacy states deletion NOT available in-app",
    privacy.indexOf("غير متوفر داخل التطبيق حاليًا") >= 0);
  ok("P1 privacy no overclaim: old anonymous+pilot-consent phrase removed",
    privacy.indexOf("تعمل بمعرفات مجهولة") < 0);
  ok("P1 privacy states no in-app age check/consent",
    privacy.indexOf("لا يتحقق التطبيق حاليًا من عمر") >= 0);
  ok("P1 privacy lists consent mechanism as open item",
    privacy.indexOf("موافقة الطلاب والتحقق من العمر داخل التطبيق: [غير مطبقة") >= 0);
  ok("P1 privacy keeps local-vs-cloud distinction",
    privacy.indexOf("البيانات على جهازك") >= 0 && privacy.indexOf("بيانات المزامنة") >= 0);
  ok("P1 privacy keeps no-ads/no-analytics statement",
    privacy.indexOf("لا توجد إعلانات") >= 0);

  const terms = readText(path.join(CLIENT, "terms.html"));
  ok("P1 terms cross-links privacy", terms.indexOf('href="privacy.html"') >= 0);
  ok("P1 terms links learner app", terms.indexOf('href="index.html"') >= 0);
  ok("P1 terms describes academy as isolated preview",
    terms.indexOf("معاينة تجريبية على بيئة اختبار منفصلة") >= 0);
  ok("P1 terms keeps internal-exam disclaimer",
    terms.indexOf("ليست Goethe") >= 0 && terms.indexOf("داخلية") >= 0);
  ok("P1 terms keeps account-deletion limitation",
    terms.indexOf("حذف الحساب السحابي من داخل التطبيق غير متوفر حاليًا") >= 0);
  ok("P1 terms lists consent/age as open item",
    terms.indexOf("موافقة الطلاب والتحقق من العمر") >= 0);
  ok("P1 terms keeps unapproved-content statements",
    terms.indexOf("غير معتمد من معلم بعد") >= 0);
  ok("P1 terms no completed-teacher-review overclaim",
    terms.indexOf("\u0627\u0644\u0645\u064F\u0631\u0627\u062C\u064E\u0639\u0629") < 0 &&
    terms.indexOf("المخصصة للمراجعة من معلم مؤهل") >= 0 &&
    terms.indexOf("ولم تكتمل هذه المراجعة بعد") >= 0);

  // Navigation from the app exposes the pages (learner + academy entries).
  const idx = readText(path.join(CLIENT, "index.html"));
  const acad = readText(path.join(CLIENT, "academy.html"));
  ok("P1 index.html links privacy page", idx.indexOf('href="privacy.html"') >= 0);
  ok("P1 academy.html links privacy page", acad.indexOf('href="privacy.html"') >= 0);
})();

// ---------- P2: consent module (disabled by default, own-row only) ----------
var P2_PROMISE = null;
(function () {
  async function run() {
    const modPath = path.join(CLIENT, "dm-consent.js");
    ok("P2 dm-consent.js exists", fs.existsSync(modPath));
    if (!fs.existsSync(modPath)) return;
    ok("P2 www copy byte-identical",
      fs.existsSync(path.join(WWW, "dm-consent.js")) &&
      readBytes(modPath).equals(readBytes(path.join(WWW, "dm-consent.js"))));

    function fresh() {
      delete require.cache[require.resolve(modPath)];
      return require(modPath);
    }
    function setWin(cfg, user, client) {
      global.window = {};
      if (cfg !== undefined) global.window.DM_CONSENT_CONFIG = cfg;
      if (user !== undefined) global.window.AuthModule = { getUser: function () { return user; } };
      if (client !== undefined) global.window.supabaseClient = client;
    }
    function explodingClient() {
      return { from: function (t) { throw new Error("client used while disabled: " + t); } };
    }
    function makeClient(opts) {
      opts = opts || {};
      const calls = [];
      const selectData = opts.selectData || [];
      return {
        calls,
        from: function (table) {
          calls.push({ op: "from", table });
          return {
            insert: function (row) {
              calls.push({ op: "insert", table, row });
              return Promise.resolve(opts.failInsert ? { error: { message: "boom" } } : { error: null });
            },
            select: function (cols) {
              calls.push({ op: "select", table, cols });
              const result = Promise.resolve(opts.failSelect
                ? { error: { message: "boom" } }
                : { error: null, data: selectData });
              const node = {
                eq: function (col, val) { calls.push({ op: "eq", col, val }); return node; },
                then: function (res, rej) { return result.then(res, rej); },
                catch: function (rej) { return result.catch(rej); }
              };
              return node;
            }
          };
        }
      };
    }
    const USER_A = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    const USER_B = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    const GOOD_CFG = { enabled: true, policyVersion: "test-policy-v1" };

    // Default-off matrix — zero client calls, zero throws.
    const offCases = [
      ["missing config", undefined, "missing_config"],
      ["null config", null, "missing_config"],
      ["empty config", {}, "disabled"],
      ["explicitly disabled", { enabled: false, policyVersion: "x" }, "disabled"],
      ["enabled without policyVersion", { enabled: true }, "missing_policy_version"],
      ["blank policyVersion", { enabled: true, policyVersion: "   " }, "missing_policy_version"],
      ["overlong policyVersion", { enabled: true, policyVersion: "x".repeat(65) }, "missing_policy_version"]
    ];
    for (const [name, cfg, reason] of offCases) {
      const M = fresh();
      setWin(cfg, USER_A, explodingClient());
      const st = M.getStatus();
      ok("P2 disabled: " + name, st.enabled === false && st.reason === reason, st.reason);
      ok("P2 isEnabled false: " + name, M.isEnabled() === false);
      const rec = await M.record("privacy_notice");
      ok("P2 record refused: " + name, rec.ok === false && rec.error === "consent_disabled");
      const wd = await M.withdraw("terms_of_service");
      ok("P2 withdraw refused: " + name, wd.ok === false && wd.error === "consent_disabled");
      const lm = await M.listMine();
      ok("P2 listMine refused: " + name, lm.ok === false && lm.records === null);
    }

    // Enabled: validation and own-row writes.
    let M = fresh();
    let client = makeClient();
    setWin(GOOD_CFG, USER_A, client);
    ok("P2 enabled status ok", M.getStatus().enabled === true && M.getStatus().reason === "ok");
    let r = await M.record("privacy_notice");
    ok("P2 record granted", r.ok === true);
    let ins = client.calls.find((c) => c.op === "insert");
    ok("P2 insert uses current user id",
      !!ins && ins.row.user_id === USER_A.id && ins.table === "consent_records");
    ok("P2 insert carries policy version + type + decision",
      !!ins && ins.row.policy_version === "test-policy-v1" &&
      ins.row.consent_type === "privacy_notice" && ins.row.decision === "granted");
    ok("P2 insert never carries email/name/verified fields",
      !!ins && !("email" in ins.row) && !("name" in ins.row) && !("verified" in ins.row) &&
      !("guardian_verified" in ins.row));
    ok("P2 no age_band unless supplied", !!ins && !("age_band" in ins.row));

    // Unknown types / bad bands refused before any write.
    client = makeClient();
    setWin(GOOD_CFG, USER_A, client);
    r = await M.record("guardian_consent");
    ok("P2 guardian type refused", r.ok === false && r.error === "invalid_type" && client.calls.length === 0);
    r = await M.record("privacy_notice", { ageBand: "adult" });
    ok("P2 non-allowlisted age band refused", r.ok === false && r.error === "invalid_age_band" && client.calls.length === 0);
    r = await M.record("privacy_notice", { ageBand: "under_15" });
    ins = client.calls.find((c) => c.op === "insert");
    ok("P2 allowlisted age band stored", r.ok === true && !!ins && ins.row.age_band === "under_15");
    r = await M.record("privacy_notice", { ageBand: "undisclosed" });
    ins = client.calls.filter((c) => c.op === "insert").pop();
    ok("P2 undisclosed band stored", r.ok === true && !!ins && ins.row.age_band === "undisclosed");

    // A caller-supplied user id can never override the session identity.
    client = makeClient();
    setWin(GOOD_CFG, USER_A, client);
    r = await M.record("privacy_notice", { userId: USER_B.id, user_id: USER_B.id, ageBand: "age_18_plus" });
    ins = client.calls.find((c) => c.op === "insert");
    ok("P2 caller cannot override user id", r.ok === true && !!ins && ins.row.user_id === USER_A.id);

    // Account switch: the live session id is read per call.
    setWin(GOOD_CFG, USER_B, client);
    r = await M.record("terms_of_service");
    ins = client.calls.filter((c) => c.op === "insert").pop();
    ok("P2 account switch uses new session id", r.ok === true && !!ins && ins.row.user_id === USER_B.id);

    // Withdraw writes an append-only withdrawn row.
    r = await M.withdraw("terms_of_service");
    ins = client.calls.filter((c) => c.op === "insert").pop();
    ok("P2 withdraw is append-only withdrawn row",
      r.ok === true && !!ins && ins.row.decision === "withdrawn" && ins.row.user_id === USER_B.id);

    // Not authenticated / unavailable.
    client = makeClient();
    setWin(GOOD_CFG, null, client);
    r = await M.record("privacy_notice");
    ok("P2 no session refused", r.ok === false && r.error === "not_authenticated" && client.calls.length === 0);
    client = makeClient();
    setWin(GOOD_CFG, USER_A, null);
    r = await M.record("privacy_notice");
    ok("P2 missing client refused", r.ok === false && r.error === "sync_unavailable" && client.calls.length === 0);

    // Failing writes/reads surface a generic error, never throw.
    client = makeClient({ failInsert: true });
    setWin(GOOD_CFG, USER_A, client);
    r = await M.record("privacy_notice");
    ok("P2 insert failure handled", r.ok === false && r.error === "write_failed");

    // A user object without an id is refused before any client call.
    client = makeClient();
    setWin(GOOD_CFG, {}, client);
    r = await M.record("privacy_notice");
    ok("P2 user without id refused",
      r.ok === false && r.error === "not_authenticated" && client.calls.length === 0);
    const wNo = await M.withdraw("terms_of_service");
    ok("P2 withdraw without session refused",
      wNo.ok === false && wNo.error === "not_authenticated" && client.calls.length === 0);
    const lNo = await M.listMine();
    ok("P2 listMine without session refused",
      lNo.ok === false && lNo.error === "not_authenticated" && lNo.records === null);

    // A truthy non-object config can never enable the feature.
    {
      const MW = fresh();
      setWin("enabled", USER_A, explodingClient());
      const stW = MW.getStatus();
      ok("P2 non-object config stays disabled",
        stW.enabled === false && stW.reason === "missing_config" && MW.isEnabled() === false);
    }

    // Identity is captured once, at call time: a delayed write that resolves
    // after an account switch must not be rewritten for the new session.
    {
      let resolveInsert = null;
      const deferred = {
        calls: [],
        from: function (table) {
          const self = this;
          return {
            insert: function (row) {
              self.calls.push({ op: "insert", table, row });
              return new Promise(function (res) { resolveInsert = res; });
            }
          };
        }
      };
      setWin(GOOD_CFG, USER_A, deferred);
      const pending = M.record("privacy_notice");
      setWin(GOOD_CFG, USER_B, deferred);
      const dIns = deferred.calls.find((c) => c.op === "insert");
      ok("P2 delayed write keeps the captured session id",
        !!dIns && dIns.row.user_id === USER_A.id);
      resolveInsert({ error: null });
      const dRes = await pending;
      ok("P2 delayed write resolves without rewriting identity",
        dRes.ok === true && deferred.calls.filter((c) => c.op === "insert").length === 1);
    }

    // listMine: own-row filter + sanitized output.
    client = makeClient({
      selectData: [
        { consent_type: "privacy_notice", policy_version: "v1", decision: "granted", age_band: null, created_at: "2026-01-01T00:00:00Z", user_id: USER_B.id },
        { consent_type: "unknown_type", policy_version: "v1", decision: "hacked", age_band: "age_99", created_at: 5, user_id: USER_B.id }
      ]
    });
    setWin(GOOD_CFG, USER_A, client);
    const lm = await M.listMine("privacy_notice");
    const eqCall = client.calls.find((c) => c.op === "eq" && c.col === "user_id");
    ok("P2 listMine filters by own user id", !!eqCall && eqCall.val === USER_A.id);
    ok("P2 listMine sanitizes records",
      lm.ok === true && lm.records.length === 2 &&
      lm.records[0].consent_type === "privacy_notice" && lm.records[0].decision === "granted" &&
      lm.records[1].consent_type === null && lm.records[1].decision === null &&
      lm.records[1].age_band === null && lm.records[1].created_at === null);
    ok("P2 listMine output carries no user ids",
      lm.records.every((x) => !("user_id" in x)));

    client = makeClient({ failSelect: true });
    setWin(GOOD_CFG, USER_A, client);
    const lm2 = await M.listMine();
    ok("P2 read failure handled", lm2.ok === false && lm2.error === "read_failed" && lm2.records === null);

    // No caching across account switches: every call re-queries with the live
    // session and never serves the previous account's records.
    client = makeClient({
      selectData: [{ consent_type: "privacy_notice", policy_version: "v1", decision: "granted", created_at: "2026-01-01T00:00:00Z" }]
    });
    setWin(GOOD_CFG, USER_A, client);
    const lmA = await M.listMine();
    client = makeClient({ selectData: [] });
    setWin(GOOD_CFG, USER_B, client);
    const lmB = await M.listMine();
    const eqB = client.calls.find((c) => c.op === "eq" && c.col === "user_id");
    ok("P2 listMine re-queries per session, no cached records",
      lmA.ok === true && lmA.records.length === 1 && lmB.ok === true && lmB.records.length === 0 &&
      !!eqB && eqB.val === USER_B.id);

    // listMine rejects an unknown consent type even when enabled.
    client = makeClient();
    setWin(GOOD_CFG, USER_A, client);
    const lmBad = await M.listMine("guardian_consent");
    ok("P2 listMine unknown type refused",
      lmBad.ok === false && lmBad.error === "invalid_type" && lmBad.records === null &&
      client.calls.length === 0);

    // Source hygiene (comments stripped).
    const code = stripComments(readText(modPath));
    ok("P2 module never logs", !/console\./.test(code));
    ok("P2 module never uses localStorage", !/localStorage/.test(code));
    ok("P2 module never touches DOM", !/document\.|innerHTML/.test(code));
    ok("P2 module no privileged credentials", !/service_role|sb_secret/i.test(code));
    ok("P2 module no catalog/content access", !/content\/|dm-vocab|dm-sent/.test(code));
    ok("P2 module does not reference academy modules", !/academy-|AcademyAuth|academySupabaseClient/i.test(code));

    delete global.window;
  }
  // Run asynchronously; awaited by the main harness at the bottom.
  P2_PROMISE = run();
})();

// ---------- P3: consent_records migration + rollback static safety ----------
(function () {
  const migPath = path.join(ROOT, "supabase", "migrations", "20261018000000_consent_records.sql");
  const rbPath = path.join(ROOT, "supabase", "manual", "20261018_consent_records_rollback.sql");
  ok("P3 migration exists", fs.existsSync(migPath));
  ok("P3 rollback exists", fs.existsSync(rbPath));
  if (!fs.existsSync(migPath)) return;
  const raw = readText(migPath);
  // SQL uses -- comments; strip them too before source scans.
  const code = stripComments(raw).replace(/--[^\n]*/g, "");
  ok("P3 creates public.consent_records additively",
    /CREATE TABLE IF NOT EXISTS public\.consent_records/.test(code));
  ok("P3 RLS enabled", /ENABLE ROW LEVEL SECURITY/.test(code));
  ok("P3 own-row select+insert policies only",
    /consent_select_own/.test(code) && /consent_insert_own/.test(code) &&
    !/FOR UPDATE|FOR DELETE/.test(code) && !/consent_update_|consent_delete_/.test(code));
  ok("P3 policies gate on auth.uid()",
    /user_id = auth\.uid\(\)/.test(code));
  ok("P3 REVOKE before grant from anon/public",
    /REVOKE ALL ON TABLE public\.consent_records FROM PUBLIC, anon, authenticated;/.test(code));
  ok("P3 table granted SELECT, INSERT to authenticated only",
    /GRANT SELECT, INSERT ON public\.consent_records TO authenticated;/.test(code) &&
    !/GRANT[^;]*ON TABLE public\.consent_records[^;]*TO[^;]*anon/i.test(code));
  ok("P3 no existing table is dropped or altered destructively",
    !/DROP TABLE/i.test(code) && !/ALTER TABLE public\.(profiles|user_progress|sync_queue|devices|auth_events)/i.test(code));
  ok("P3 guard trigger: append-only, self-only, server timestamp",
    /guard_consent_record_write/.test(code) &&
    /TG_OP <> 'INSERT'/.test(code) &&
    /auth\.jwt\(\)->>'role' = 'authenticated'/.test(code) &&
    /NEW\.user_id IS DISTINCT FROM auth\.uid\(\)/.test(code) &&
    /NEW\.created_at := NOW\(\)/.test(code));
  ok("P3 client types exclude guardian/parental consent",
    /consent_type IN \('privacy_notice','terms_of_service'\)/.test(code) &&
    !/guardian|parental/i.test(code));
  ok("P3 no verified flag/client column", !/verified/i.test(code));
  ok("P3 age band allowlist matches module",
    /age_band IN \('under_15','age_15_17','age_18_plus','undisclosed'\)/.test(code));
  ok("P3 no secrets, keys, or connection strings",
    !/sb_secret|SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{20,}/i.test(raw) &&
    !/postgres(ql)?:\/\//i.test(code) &&
    !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(code));
  ok("P3 staging-first and not-applied notice in header",
    /STAGING FIRST, NOT APPLIED/i.test(raw) && /Rollback:/.test(raw));

  if (fs.existsSync(rbPath)) {
    const rb = readText(rbPath);
    const rbCode = rb.replace(/--[^\n]*/g, "");
    ok("P3 rollback drops trigger before function/table",
      rbCode.indexOf("DROP TRIGGER") >= 0 &&
      rbCode.indexOf("DROP TRIGGER") < rbCode.indexOf("DROP FUNCTION") &&
      rbCode.indexOf("DROP FUNCTION") < rbCode.indexOf("DROP TABLE"));
    ok("P3 rollback is a safe no-op when the table never existed",
      (rbCode.match(/to_regclass\('public\.consent_records'\)/g) || []).length >= 2 &&
      rbCode.indexOf("to_regclass('public.consent_records')") < rbCode.indexOf("DROP TRIGGER") &&
      rbCode.lastIndexOf("to_regclass('public.consent_records')") < rbCode.indexOf("DROP TABLE") &&
      rbCode.indexOf("IF to_regclass('public.consent_records') IS NOT NULL THEN") >= 0);
    ok("P3 rollback never touches v1/auth objects",
      !/DROP TABLE (IF EXISTS )?public\.(profiles|user_progress|sync_queue|devices|auth_events)/i.test(rb) &&
      !/auth\.users/i.test(rb.replace(/--[^\n]*/g, "")) &&
      /NEVER touches/.test(rb));
    ok("P3 rollback documents that it destroys consent records",
      /DATA-LOSS WARNING/i.test(rb) &&
      /DESTROYS ALL CONSENT RECORDS/i.test(rb) &&
      /COPY public\.consent_records TO STDOUT/i.test(rb));
  }

  ok("P3 no UPDATE/DELETE grant on consent table",
    !/GRANT[^;]*\bUPDATE\b/i.test(code) && !/GRANT[^;]*\bDELETE\b/i.test(code));
  ok("P3 consent table never granted to anon or service_role",
    !/GRANT[^;]*ON TABLE public\.consent_records[^;]*TO[^;]*(anon|service_role)/i.test(code));
  ok("P3 trigger function EXECUTE revoked from clients",
    /REVOKE ALL ON FUNCTION public\.guard_consent_record_write\(\) FROM PUBLIC, anon, authenticated;/.test(code));
})();

// ---------- P4: delete-account Edge Function static safety ----------
(function () {
  const fnPath = path.join(ROOT, "supabase", "functions", "delete-account", "index.ts");
  ok("P4 delete-account function exists (local, undeployed)", fs.existsSync(fnPath));
  if (!fs.existsSync(fnPath)) return;
  const raw = readText(fnPath);
  const code = stripComments(raw);
  ok("P4 documents NOT DEPLOYED status", /NOT DEPLOYED, NOT OPERATIONAL YET/.test(raw));
  ok("P4 verifies caller JWT server-side", /auth\.getUser/.test(code) && /Authorization/.test(code));
  ok("P4 identity derived from JWT user only", /userData\?\.user\?\.id/.test(code));
  ok("P4 never trusts a user id from the body",
    !/body\["(user|userId|id)"/i.test(code) && !/body\.userId/i.test(code) && !/p_user_id/.test(code));
  ok("P4 requires typed confirmation",
    /CONFIRM_WORD = "DELETE"/.test(code) && /body\["confirm"\] !== CONFIRM_WORD/.test(code));
  ok("P4 service role key from env only, no literals",
    /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/.test(code) &&
    !/sb_secret_|eyJ[A-Za-z0-9_-]{20,}/.test(raw));
  ok("P4 admin deletion is self-only",
    /admin\.deleteUser\(callerId\)/.test(code));
  ok("P4 rate limited", /RATE_LIMIT/.test(code) && /429/.test(code));
  ok("P4 per-table receipt with anonymized auth_events",
    /profiles:/.test(code) && /user_progress:/.test(code) && /sync_queue:/.test(code) &&
    /devices:/.test(code) && /auth_events_anonymized:/.test(code) &&
    /user_id set to NULL/.test(raw));
  ok("P4 never logs", !/console\./.test(code));
  ok("P4 no false success on failure",
    /if \(delErr\) return json\(\{ error: "deletion_failed" \}, 503\);/.test(code));

  // Hardening checks added by the independent C4 audit.
  ok("P4 rejects non-POST methods with 405",
    /req\.method !== "POST"/.test(code) && /method not allowed/.test(code) && /405/.test(code));
  ok("P4 handles CORS preflight explicitly (OPTIONS before auth)",
    /req\.method === "OPTIONS"/.test(code) && /204/.test(code) &&
    /Access-Control-Allow-Origin/.test(code) &&
    /Access-Control-Allow-Headers/.test(code) &&
    /Access-Control-Allow-Methods/.test(code) &&
    code.indexOf('req.method === "OPTIONS"') < code.indexOf('req.method !== "POST"'));
  {
    const bodyReads = Array.from(code.matchAll(/body\["([^"]+)"\]|body\.([A-Za-z_$][\w$]*)/g))
      .map((m) => m[1] || m[2]);
    ok("P4 body reads limited to the typed confirmation field",
      bodyReads.length === 1 && bodyReads[0] === "confirm", bodyReads.join(","));
  }
  ok("P4 missing/invalid token never reaches deletion",
    (code.match(/error: "unauthenticated" \}, 401/g) || []).length >= 2 &&
    code.indexOf('error: "unauthenticated"') < code.indexOf("db.auth.admin.deleteUser"));
  ok("P4 missing function secrets fail closed",
    /if \(!url \|\| !anonKey \|\| !serviceKey\) return json\(\{ error: "unavailable" \}, 503\);/.test(code));
  ok("P4 service key never echoed into any response",
    !/json\([^)]*serviceKey/.test(code) && !/body[^;\n]*serviceKey/.test(code));
  ok("P4 raw error objects/messages never echoed", !/\.message/.test(code));

  // Client tree must not reference the function at all yet.
  let referenced = [];
  for (const tree of [CLIENT, WWW]) {
    for (const rel of walkFiles(tree, "", [])) {
      if (!/\.(js|html)$/.test(rel)) continue;
      let s = null;
      try {
        const b = readBytes(path.join(tree, rel));
        if (b.length > 2 * 1024 * 1024) continue;
        s = b.toString("utf8");
      } catch (e) { continue; }
      if (/delete-account/.test(s)) referenced.push(path.relative(ROOT, path.join(tree, rel)));
    }
  }
  ok("P4 no client tree references delete-account yet", referenced.length === 0, referenced.slice(0, 3).join(","));

  // Placeholder toast must remain (honest, deletes nothing).
  const profile = readText(path.join(CLIENT, "profile.js"));
  ok("P4 profile placeholder toast preserved",
    profile.indexOf("deleteAccountBtn") >= 0 &&
    profile.indexOf("Supabase Dashboard") >= 0 &&
    profile.indexOf('"err"') >= 0);
  ok("P4 profile never invokes functions/edge deletion",
    profile.indexOf("functions.invoke") < 0 && profile.indexOf("delete-account") < 0);
})();

// ---------- P5: integration surface (loaded, inert, no enforcement) ----------
(function () {
  const idx = readText(path.join(CLIENT, "index.html"));
  const idxW = readText(path.join(WWW, "index.html"));
  ok("P5 learner index loads dm-consent.js", idx.indexOf('<script src="dm-consent.js"></script>') >= 0);
  ok("P5 www index loads dm-consent.js", idxW.indexOf('<script src="dm-consent.js"></script>') >= 0);
  ok("P5 dm-consent loads after profile.js and before app-init.js",
    idx.indexOf("profile.js") < idx.indexOf("dm-consent.js") &&
    idx.indexOf("dm-consent.js") < idx.indexOf("app-init.js"));

  const sw = readText(path.join(CLIENT, "sw.js"));
  const swW = readText(path.join(WWW, "sw.js"));
  ok("P5 sw precaches dm-consent.js (client+www)",
    sw.indexOf('"./dm-consent.js"') >= 0 && swW.indexOf('"./dm-consent.js"') >= 0);
  ok("P5 sw cache versioned", /var DM_CACHE = "german-academy-v\d+";/.test(sw));

  // No enforcement wiring in any learner runtime file.
  ["app-init.js", "auth.js", "cloud-sync.js", "profile.js", "script.js"].forEach(function (f) {
    const s = readText(path.join(CLIENT, f));
    ok("P5 no consent enforcement wiring in " + f,
      s.indexOf("DMConsent") < 0 && s.indexOf("dm-consent") < 0);
  });

  // dm-consent is referenced ONLY by the learner index entry (never academy
  // or legal pages), so it cannot be accidentally activated elsewhere.
  for (const rel of walkFiles(CLIENT, "", [])) {
    if (!/\.html$/.test(rel)) continue;
    const s = readText(path.join(CLIENT, rel));
    if (rel === "index.html") {
      ok("P5 dm-consent referenced exactly by " + rel, s.indexOf("dm-consent") >= 0);
    } else {
      ok("P5 dm-consent absent from " + rel, s.indexOf("dm-consent") < 0);
    }
  }
})();

// ---------- P6: consent pgTAP suite static safety ----------
(function () {
  const tapPath = path.join(ROOT, "supabase", "tests", "consent_records_rls_test.sql");
  ok("P6 consent pgTAP suite exists", fs.existsSync(tapPath));
  if (!fs.existsSync(tapPath)) return;
  const raw = readText(tapPath);
  const code = stripComments(raw).replace(/--[^\n]*/g, "");

  ok("P6 suite is isolated-only (staging-only note, never production)",
    /ISOLATED ENVIRONMENTS ONLY/.test(raw) && /NEVER run against production/.test(raw));

  ok("P6 runs in a single transaction ending in ROLLBACK",
    code.indexOf("BEGIN;") >= 0 && code.indexOf("BEGIN;") < code.indexOf("SELECT plan(") &&
    !/\bCOMMIT\b/.test(code) &&
    code.indexOf("SELECT * FROM finish();") > 0 &&
    code.indexOf("SELECT * FROM finish();") < code.lastIndexOf("ROLLBACK;") &&
    /\nROLLBACK;\s*$/.test(code));

  const planned = (code.match(/SELECT plan\((\d+)\)/) || [])[1];
  const counted = (code.match(/\bSELECT\s+(ok|has_table|throws_like|throws_ok|lives_ok|results_eq|is_empty)\s*\(/g) || []).length;
  ok("P6 plan(N) equals actual assertion count",
    !!planned && Number(planned) === counted && counted >= 26,
    "plan=" + planned + " counted=" + counted);

  ok("P6 uses exactly 2 disposable fake identities",
    (raw.match(/consent-student-[ab]@fixture\.invalid/g) || []).length === 2 &&
    /TEST FIXTURES? ONLY/.test(raw) && /discarded/i.test(raw));
  ok("P6 no real-looking personal emails", !/@(gmail|outlook|hotmail|yahoo|icloud)\./i.test(raw));

  const roleSwitches = (code.match(/SET ROLE authenticated/g) || []).length;
  const subSets = (code.match(/set_config\('request\.jwt\.claim\.sub'/g) || []).length;
  const claimsSets = (code.match(/set_config\('request\.jwt\.claims'/g) || []).length;
  ok("P6 every authenticated block sets both JWT claim channels",
    roleSwitches >= 6 && subSets >= roleSwitches && claimsSets >= roleSwitches,
    "roleSwitches=" + roleSwitches + " sub=" + subSets + " claims=" + claimsSets);
  ok("P6 includes session switch + empty-subject fail-closed cases",
    raw.indexOf("c0000000-0000-4000-8000-0000000000a1") >= 0 &&
    raw.indexOf("c0000000-0000-4000-8000-0000000000b2") >= 0 &&
    /set_config\('request\.jwt\.claim\.sub', '', false\)/.test(code));

  const denied = (code.match(/%permission denied%/g) || []).length;
  ok("P6 anonymous + UPDATE + DELETE denial asserted", denied >= 4, "denied=" + denied);
  ok("P6 cross-user read isolation asserted",
    code.indexOf("SELECT is_empty(") >= 0 &&
    code.indexOf("WHERE user_id = 'c0000000-0000-4000-8000-0000000000b2'") >= 0);
  ok("P6 own-row writes and visibility asserted",
    (code.match(/SELECT lives_ok\(/g) || []).length >= 3 &&
    (code.match(/SELECT results_eq\(/g) || []).length >= 3);
  ok("P6 forged user_id denied by guard trigger",
    code.indexOf("VALUES ('c0000000-0000-4000-8000-0000000000b2', 'privacy_notice'") >= 0 &&
    (code.match(/%consent records may only be created for the authenticated user%/g) || []).length >= 2);
  ok("P6 server-forced created_at asserted against backdating",
    code.indexOf("'2000-01-01T00:00:00Z'") >= 0 &&
    code.indexOf("created_at > now() - interval '5 minutes'") >= 0);
  ok("P6 constraint validation (types/versions/decision/band) asserted",
    (code.match(/%violates check constraint%/g) || []).length >= 5 &&
    code.indexOf("'guardian_consent'") >= 0 &&
    code.indexOf("repeat('x', 65)") >= 0 &&
    code.indexOf("'maybe'") >= 0 &&
    code.indexOf("'adult'") >= 0);
  ok("P6 append-only withdrawal history asserted",
    code.indexOf("'withdrawn'") >= 0 && /history intact/.test(code) && /append-only/.test(code));

  ok("P6 no schema-mutating statements in suite",
    !/\b(GRANT|REVOKE|ALTER|TRUNCATE|DROP)\b/.test(code));
  ok("P6 UPDATE/DELETE appear only as denial-test payloads",
    (code.match(/\$\$UPDATE\b/g) || []).length === 1 &&
    (code.match(/\$\$DELETE FROM\b/g) || []).length === 1 &&
    !/(^|\n)\s*(UPDATE|DELETE)\b/m.test(code));

  ok("P6 no service_role, secrets, or project refs in suite",
    !/service_role|sb_secret|eyJ[A-Za-z0-9_-]{20,}/i.test(raw) &&
    !/bhdgpscedjowchldsjnd|uafwvkgaijmcofistjum/.test(raw));
  ok("P6 pgtap ensured and schema expectations pinned",
    /CREATE EXTENSION IF NOT EXISTS pgtap;/.test(code) &&
    code.indexOf("has_table('public', 'consent_records'") >= 0 &&
    code.indexOf("relrowsecurity") >= 0 &&
    code.indexOf("REFERENCES auth.users(id) ON DELETE CASCADE") >= 0);
})();

// ---------- Async completion ----------
(async function () {
  if (P2_PROMISE) { await P2_PROMISE; }
  console.log("====");
  console.log("TOTAL pass=" + pass + " fail=" + fail + " RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.log("FAIL harness threw: " + (e && e.message ? e.message : e));
  console.log("TOTAL pass=" + pass + " fail=" + (fail + 1) + " RESULT: FAIL");
  process.exit(1);
});
