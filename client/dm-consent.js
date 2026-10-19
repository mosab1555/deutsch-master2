/* Deutsch Master — Student consent groundwork (DISABLED BY DEFAULT).
 *
 * This module is deliberately inert. It exists so that, once the owner and
 * legal counsel approve the policy text/version and the recording mechanism,
 * recording a student's own acknowledgement is a configuration step rather
 * than a new subsystem. Until then it MUST NOT change any behaviour:
 *
 *   - Default OFF: everything requires `window.DM_CONSENT_CONFIG` with
 *     `{ enabled: true, policyVersion: "<approved version>" }`. Missing or
 *     partial config keeps every operation disabled (`consent_disabled`).
 *   - No enforcement, ever, from here: this module cannot block sign-in,
 *     sign-up, synchronization, or any learning feature, and no learner
 *     module imports it. Enforcement needs an owner/legal decision first.
 *   - No UI and no wording: this file contains no consent text and renders
 *     nothing; approved wording must come from legal review.
 *   - Existing identity only: it uses the learner session/client published
 *     by window.AuthModule (window.supabaseClient fallback) exactly like
 *     profile.js. No second auth state manager, no localStorage trust.
 *   - Own rows only: records are inserted with the CURRENT user's id read
 *     at call time (never from arguments) into public.consent_records, whose
 *     RLS policies allow SELECT/INSERT of own rows only and whose guard
 *     trigger forces user_id = auth.uid() and a server timestamp.
 *   - No verified guardian consent is possible through this path: the table
 *     rejects 'guardian' types and this module never sends a verification
 *     flag. Guardian consent stays an academy-side written process until
 *     legally approved (see docs/academy/DATA_PROCESSING_NOTICE_EGYPT.md).
 *   - Never logs consent payloads, identifiers, or credentials.
 *
 * Consent types here are SELF-acknowledgements (privacy notice / terms) and
 * match the CHECK constraint in
 * supabase/migrations/20261018000000_consent_records.sql (staging-first,
 * additive). If that migration is not applied, recording fails honestly with
 * an error and changes nothing.
 */
"use strict";

var DMConsent = (function () {
  "use strict";

  var ALLOWED_TYPES = ["privacy_notice", "terms_of_service"];
  var ALLOWED_AGE_BANDS = ["under_15", "age_15_17", "age_18_plus", "undisclosed"];
  var MAX_VERSION_LEN = 64;

  function readConfig() {
    try {
      if (typeof window !== "undefined" && window && window.DM_CONSENT_CONFIG) {
        return window.DM_CONSENT_CONFIG;
      }
    } catch (e) {}
    return null;
  }

  // Returns { enabled, configured, reason }. Never throws.
  function getStatus() {
    try {
      var cfg = readConfig();
      if (!cfg || typeof cfg !== "object") {
        return { enabled: false, configured: false, reason: "missing_config" };
      }
      var enabled = false;
      try { enabled = cfg.enabled === true; } catch (e0) {}
      if (!enabled) {
        return { enabled: false, configured: false, reason: "disabled" };
      }
      var ver = "";
      try { ver = String(cfg.policyVersion == null ? "" : cfg.policyVersion).trim(); } catch (e1) {}
      if (!ver || ver.length > MAX_VERSION_LEN) {
        return { enabled: false, configured: false, reason: "missing_policy_version" };
      }
      return { enabled: true, configured: true, reason: "ok" };
    } catch (e) {
      return { enabled: false, configured: false, reason: "missing_config" };
    }
  }

  function isEnabled() {
    return getStatus().enabled === true;
  }

  function currentUser() {
    try {
      return (typeof window !== "undefined" && window.AuthModule &&
        typeof window.AuthModule.getUser === "function") ? window.AuthModule.getUser() : null;
    } catch (e) { return null; }
  }

  function currentClient() {
    try {
      if (typeof window !== "undefined" && window && window.supabaseClient) {
        return window.supabaseClient;
      }
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.AuthModule &&
        typeof window.AuthModule.getClient === "function") {
        return window.AuthModule.getClient();
      }
    } catch (e2) {}
    return null;
  }

  function policyVersion() {
    try {
      var cfg = readConfig();
      var ver = cfg && typeof cfg === "object"
        ? String(cfg.policyVersion == null ? "" : cfg.policyVersion).trim() : "";
      return ver;
    } catch (e) { return ""; }
  }

  function normalizeAgeBand(ageBand) {
    if (ageBand === undefined || ageBand === null || ageBand === "") return undefined;
    var v = "";
    try { v = String(ageBand).trim(); } catch (e) { return null; }
    return ALLOWED_AGE_BANDS.indexOf(v) >= 0 ? v : null;
  }

  // Insert one append-only acknowledgement row for the CURRENT user.
  // options: { ageBand? } — a single optional coarse band; no free text,
  // never a user id (the id is read from the live session at call time).
  async function writeDecision(type, decision, options) {
    var status = getStatus();
    if (!status.enabled) {
      return { ok: false, error: "consent_disabled", reason: status.reason };
    }
    if (ALLOWED_TYPES.indexOf(type) < 0) {
      return { ok: false, error: "invalid_type" };
    }
    var user = currentUser();
    if (!user || !user.id) {
      return { ok: false, error: "not_authenticated" };
    }
    var ageBand;
    if (options && typeof options === "object") {
      ageBand = normalizeAgeBand(options.ageBand);
      if (ageBand === null) {
        return { ok: false, error: "invalid_age_band" };
      }
    }
    var client = currentClient();
    if (!client || typeof client.from !== "function") {
      return { ok: false, error: "sync_unavailable" };
    }
    var row = {
      user_id: user.id,
      consent_type: type,
      policy_version: policyVersion(),
      decision: decision
    };
    if (ageBand !== undefined) row.age_band = ageBand;
    try {
      var res = await client.from("consent_records").insert(row);
      if (res && res.error) {
        return { ok: false, error: "write_failed" };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "write_failed" };
    }
  }

  function record(type, options) {
    return writeDecision(type, "granted", options);
  }

  function withdraw(type) {
    return writeDecision(type, "withdrawn", undefined);
  }

  // Read the CURRENT user's own records (RLS is the server boundary; the
  // explicit user filter is belt-and-braces). Returns sanitized fields only.
  async function listMine(type) {
    var status = getStatus();
    if (!status.enabled) {
      return { ok: false, error: "consent_disabled", reason: status.reason, records: null };
    }
    if (type !== undefined && type !== null && ALLOWED_TYPES.indexOf(type) < 0) {
      return { ok: false, error: "invalid_type", records: null };
    }
    var user = currentUser();
    if (!user || !user.id) {
      return { ok: false, error: "not_authenticated", records: null };
    }
    var client = currentClient();
    if (!client || typeof client.from !== "function") {
      return { ok: false, error: "sync_unavailable", records: null };
    }
    try {
      var q = client.from("consent_records")
        .select("consent_type,policy_version,decision,age_band,created_at")
        .eq("user_id", user.id);
      if (type) q = q.eq("consent_type", type);
      var res = await q;
      if (res && res.error) {
        return { ok: false, error: "read_failed", records: null };
      }
      var rows = res && Array.isArray(res.data) ? res.data : [];
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i] || {};
        out.push({
          consent_type: ALLOWED_TYPES.indexOf(r.consent_type) >= 0 ? r.consent_type : null,
          policy_version: typeof r.policy_version === "string" ? r.policy_version : null,
          decision: r.decision === "granted" || r.decision === "withdrawn" ? r.decision : null,
          age_band: ALLOWED_AGE_BANDS.indexOf(r.age_band) >= 0 ? r.age_band : null,
          created_at: typeof r.created_at === "string" ? r.created_at : null
        });
      }
      return { ok: true, records: out };
    } catch (e2) {
      return { ok: false, error: "read_failed", records: null };
    }
  }

  return {
    ALLOWED_TYPES: ALLOWED_TYPES,
    ALLOWED_AGE_BANDS: ALLOWED_AGE_BANDS,
    getStatus: getStatus,
    isEnabled: isEnabled,
    record: record,
    withdraw: withdraw,
    listMine: listMine
  };
})();

if (typeof window !== "undefined") window.DMConsent = DMConsent;
if (typeof module !== "undefined" && module.exports) module.exports = DMConsent;
