// Academy link redeem (Staging): server-to-server code redemption and unlink.
//
// Auth: gateway JWT DISABLED (verify_jwt = false) because the caller is the
// Production edge function, not a Staging user. A disabled gateway check
// never means unauthenticated here: every request must carry the shared
// server secret in x-academy-link-secret, compared in constant time, and the
// function refuses to run (503) when the secret is unconfigured.
// Secrets: ACADEMY_LINK_SHARED_SECRET (this project's copy) plus platform
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Raw codes are never stored or
// logged — lookups use SHA-256 code_hash only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const MAX_BODY_BYTES = 4096;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const expected = Deno.env.get("ACADEMY_LINK_SHARED_SECRET") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (expected.length < 32 || !url || !serviceKey) return json({ error: "unavailable" }, 503);
  const provided = req.headers.get("x-academy-link-secret") ?? "";
  const providedHash = await sha256Hex(provided);
  const expectedHash = await sha256Hex(expected);
  if (!provided || !safeEqual(providedHash, expectedHash)) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "request too large" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid request" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "invalid request" }, 400);
  const action = body["action"];
  if (action !== "redeem" && action !== "revoke") return json({ error: "invalid request" }, 400);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (action === "revoke") {
    // Revoke by Production identity: idempotent, always ok after auth.
    const prodUserId = body["prodUserId"];
    if (typeof prodUserId !== "string" || !UUID_RE.test(prodUserId)) return json({ error: "invalid request" }, 400);
    const academyId = body["academyId"];
    let q = db.from("academy_prod_links").update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("prod_user_id", prodUserId).eq("status", "active");
    if (typeof academyId === "string" && UUID_RE.test(academyId)) q = q.eq("academy_id", academyId);
    await q;
    return json({ ok: true }, 200);
  }

  // action === "redeem": bind the Production account to the code's student.
  const rawCode = body["code"];
  const prodUserId = body["prodUserId"];
  if (typeof rawCode !== "string" || typeof prodUserId !== "string" || !UUID_RE.test(prodUserId)) {
    return json({ error: "invalid request" }, 400);
  }
  const code = rawCode.trim().toUpperCase();
  if (!CODE_RE.test(code)) return json({ code: "LINK_INVALID" }, 404);
  // Optional binding claim: when present it must match the code's own row,
  // so a code can never link the wrong Academy membership.
  const claimAcademy = typeof body["academyId"] === "string" ? (body["academyId"] as string) : null;
  const claimStudent = typeof body["stagingUserId"] === "string" ? (body["stagingUserId"] as string) : null;
  if (claimAcademy !== null && !UUID_RE.test(claimAcademy)) return json({ error: "invalid request" }, 400);
  if (claimStudent !== null && !UUID_RE.test(claimStudent)) return json({ error: "invalid request" }, 400);

  const { data: rows } = await db.from("academy_link_codes")
    .select("id,academy_id,student_user_id,expires_at,redeemed_at,revoked_at")
    .eq("code_hash", await sha256Hex(code)).limit(1);
  const row = (Array.isArray(rows) && rows[0] ? rows[0] : null) as {
    id: string; academy_id: string; student_user_id: string;
    expires_at: string; redeemed_at: string | null; revoked_at: string | null;
  } | null;
  if (!row) return json({ code: "LINK_INVALID" }, 404);
  if (claimAcademy !== null && claimAcademy.toLowerCase() !== String(row.academy_id).toLowerCase()) {
    return json({ code: "LINK_INVALID" }, 404);
  }
  if (claimStudent !== null && claimStudent.toLowerCase() !== String(row.student_user_id).toLowerCase()) {
    return json({ code: "LINK_INVALID" }, 404);
  }
  if (row.revoked_at) return json({ code: "LINK_INVALID" }, 404);
  if (row.redeemed_at) return json({ code: "LINK_USED" }, 409);
  if (Date.parse(row.expires_at) <= Date.now()) return json({ code: "LINK_EXPIRED" }, 410);
  // Student membership must still be active at redemption time.
  const { data: mem } = await db.from("academy_members").select("user_id")
    .eq("academy_id", row.academy_id).eq("user_id", row.student_user_id).eq("status", "active").limit(1);
  if (!Array.isArray(mem) || mem.length === 0) return json({ code: "LINK_INVALID" }, 404);

  // Atomic single-use claim: exactly one concurrent redeemer can win.
  const { data: claimed } = await db.from("academy_link_codes")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("id", row.id).is("redeemed_at", null).is("revoked_at", null)
    .gt("expires_at", new Date().toISOString()).select("id");
  if (!Array.isArray(claimed) || claimed.length === 0) return json({ code: "LINK_USED" }, 409);

  // Record the explicit mapping. Partial unique indexes are the backstop
  // against duplicate active mappings; a conflict here is reported, never
  // silently merged.
  const { error: linkErr } = await db.from("academy_prod_links").insert({
    academy_id: row.academy_id,
    staging_user_id: row.student_user_id,
    prod_user_id: prodUserId,
    status: "active",
    created_by: null,
  });
  if (linkErr) return json({ code: "LINK_DUPLICATE" }, 409);
  return json({ ok: true, academyId: row.academy_id, stagingUserId: row.student_user_id }, 200);
});
