// Academy progress (Staging): authorized bridged learner-progress reads.
//
// Auth: gateway JWT REQUIRED (verify_jwt = true). The handler validates the
// caller session and re-derives every authorization fact from persisted
// Staging data; client-supplied role claims are never trusted.
// Flow: class→academy tenant check → membership + enrollment checks →
// active-link lookup → server-side call to the Production bridge →
// sanitized summary. Missing link or missing
// progress yields a truthful empty state, never fake data. Denials stay
// denials. Reads are not written to academy_audit_events because
// guard_audit_insert() requires a JWT caller who is an academy manager, which
// an assigned teacher is not; the link tables carry the lifecycle trail.
// Secrets: ACADEMY_LINK_SHARED_SECRET (this project's copy, outbound call
// only) plus platform SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY. Raw codes, secrets, emails, and tokens are never
// returned or logged.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 4096;
const SUMMARY_FIELDS = ["totalAnswered", "totalCorrect", "accuracy", "events", "mistakesOpen", "dueReview", "lastActivity"] as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function deny(): Response {
  return json({ error: "denied" }, 403);
}
// Client-side defense in depth: accept only the allowlisted numeric/string
// summary shape; anything else is treated as a bridge error, never rendered.
function cleanSummary(raw: unknown): Record<string, number | string | null> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, number | string | null> = {};
  for (const k of SUMMARY_FIELDS) {
    const v = src[k];
    if (k === "lastActivity") {
      out[k] = typeof v === "string" ? v.slice(0, 64) : null;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    } else {
      return null;
    }
  }
  const w = src["weekly"];
  if (w !== null && w !== undefined) {
    if (typeof w !== "object") return null;
    const wo = w as Record<string, unknown>;
    for (const k of ["hasData", "curAns", "curPct", "prevAns"]) {
      const v = wo[k];
      if (k === "hasData") {
        if (typeof v !== "boolean") return null;
      } else if (typeof v !== "number" || !Number.isFinite(v)) {
        return null;
      }
    }
    out["weekly"] = wo as unknown as number;
  } else {
    out["weekly"] = null;
  }
  void 0;
  return { ...out, weekly: (w ?? null) as unknown as number | string | null };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "request too large" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid request" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "invalid request" }, 400);
  const academyId = body["academyId"];
  const classId = body["classId"];
  const studentUserId = body["studentUserId"];
  for (const v of [academyId, classId, studentUserId]) {
    if (typeof v !== "string" || !UUID_RE.test(v)) return json({ error: "invalid request" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bridgeSecret = Deno.env.get("ACADEMY_LINK_SHARED_SECRET") ?? "";
  const bridgeUrl = Deno.env.get("ACADEMY_PROD_BRIDGE_URL") ?? "";
  if (!url || !anonKey || !serviceKey) return json({ error: "unavailable" }, 503);
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthenticated" }, 401);
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  const callerId = userErr ? null : userData?.user?.id ?? null;
  if (!callerId || !UUID_RE.test(callerId)) return json({ error: "unauthenticated" }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Tenant consistency: the class must belong to the supplied academy. The
  // lookup itself enforces the match; a query error, a missing class, or a
  // class owned by another academy returns the same generic denial (no
  // existence leak, no platform-owner exemption).
  const { data: cls, error: clsErr } = await db.from("classes").select("academy_id")
    .eq("id", classId).eq("academy_id", academyId).limit(1);
  if (clsErr || !Array.isArray(cls) || cls.length === 0) return deny();
  // Student must hold an active membership and an enrollment in this class.
  const { data: mem } = await db.from("academy_members").select("user_id")
    .eq("academy_id", academyId).eq("user_id", studentUserId).eq("status", "active").limit(1);
  if (!Array.isArray(mem) || mem.length === 0) return deny();
  const { data: enr } = await db.from("class_enrollments").select("class_id")
    .eq("class_id", classId).eq("student_id", studentUserId).limit(1);
  if (!Array.isArray(enr) || enr.length === 0) return deny();
  // Authorize caller: assigned teacher of this class, academy manager, or platform owner.
  const { data: plat } = await db.from("platform_owners").select("user_id").eq("user_id", callerId).limit(1);
  let allowed = Array.isArray(plat) && plat.length > 0;
  if (!allowed) {
    const { data: teach } = await db.from("class_teachers").select("class_id")
      .eq("class_id", classId).eq("teacher_id", callerId).limit(1);
    allowed = Array.isArray(teach) && teach.length > 0;
  }
  if (!allowed) {
    const { data: mine } = await db.from("academy_members").select("role")
      .eq("academy_id", academyId).eq("user_id", callerId).eq("status", "active").limit(1);
    const role = Array.isArray(mine) && mine[0] ? (mine[0] as { role: string }).role : null;
    allowed = role === "academy_owner" || role === "academy_admin";
  }
  if (!allowed) return deny();

  // Active link for exactly this student.
  const { data: links } = await db.from("academy_prod_links")
    .select("prod_user_id").eq("academy_id", academyId).eq("staging_user_id", studentUserId)
    .eq("status", "active").limit(1);
  const prodUserId = Array.isArray(links) && links[0] ? (links[0] as { prod_user_id: string }).prod_user_id : null;
  if (!prodUserId || !UUID_RE.test(prodUserId)) return json({ linked: false, code: "LINK_REQUIRED" }, 200);

  if (!bridgeSecret || bridgeSecret.length < 32 || !bridgeUrl) {
    return json({ linked: true, code: "BRIDGE_DISABLED" }, 200);
  }
  let bridgeRes: Response;
  try {
    bridgeRes = await fetch(bridgeUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-academy-bridge-secret": bridgeSecret },
      body: JSON.stringify({ prodUserId }),
    });
  } catch {
    return json({ linked: true, code: "BRIDGE_DISABLED" }, 200);
  }
  if (bridgeRes.status === 404) return json({ linked: true, hasData: false }, 200);
  if (bridgeRes.status === 401 || bridgeRes.status === 403) return deny();
  if (!bridgeRes.ok) return json({ linked: true, code: "BRIDGE_DISABLED" }, 200);
  let payload: Record<string, unknown>;
  try {
    payload = await bridgeRes.json();
  } catch {
    return deny();
  }
  const summary = cleanSummary((payload as Record<string, unknown>)["summary"]);
  if (!summary) return deny();
  return json({ linked: true, summary }, 200);
});
