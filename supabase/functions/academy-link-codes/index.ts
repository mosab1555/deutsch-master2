// Academy link codes (Staging): manager-issued single-use student link codes.
//
// Auth: gateway JWT REQUIRED (verify_jwt = true). The handler validates the
// caller session via Supabase Auth and enforces owner/admin role itself;
// client-supplied role claims are never trusted.
// Secrets: none custom. Uses platform SUPABASE_URL / SUPABASE_ANON_KEY (JWT
// validation) and SUPABASE_SERVICE_ROLE_KEY (dashboard reads/writes).
// Raw codes are never stored or logged — only SHA-256 code_hash rows.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LINK_TTL_MINUTES = 30;
const MAX_BODY_BYTES = 4096;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function deny(): Response {
  return json({ error: "denied" }, 403);
}
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let core = "";
  for (let i = 0; i < 12; i++) core += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return core.slice(0, 6) + "-" + core.slice(6);
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
  const action = body["action"];
  const academyId = body["academyId"];
  const studentUserId = body["studentUserId"];
  if (action !== "create" && action !== "revoke" && action !== "status") {
    return json({ error: "invalid request" }, 400);
  }
  if (typeof academyId !== "string" || !UUID_RE.test(academyId)) return json({ error: "invalid request" }, 400);
  if (typeof studentUserId !== "string" || !UUID_RE.test(studentUserId)) {
    return json({ error: "invalid request" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) return json({ error: "unavailable" }, 503);
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthenticated" }, 401);
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  const callerId = userErr ? null : userData?.user?.id ?? null;
  if (!callerId) return json({ error: "unauthenticated" }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Authorize: platform owner, or active owner/admin of this academy.
  const { data: plat } = await db.from("platform_owners").select("user_id").eq("user_id", callerId).limit(1);
  let manager = Array.isArray(plat) && plat.length > 0;
  if (!manager) {
    const { data: mem } = await db.from("academy_members")
      .select("role").eq("academy_id", academyId).eq("user_id", callerId).eq("status", "active").limit(1);
    const role = Array.isArray(mem) && mem[0] ? (mem[0] as { role: string }).role : null;
    manager = role === "academy_owner" || role === "academy_admin";
  }
  if (!manager) return deny();
  // The student must hold an active membership in this academy.
  const { data: stu } = await db.from("academy_members")
    .select("user_id").eq("academy_id", academyId).eq("user_id", studentUserId).eq("status", "active").limit(1);
  if (!Array.isArray(stu) || stu.length === 0) return deny();

  if (action === "status") {
    const { data: link } = await db.from("academy_prod_links")
      .select("id,created_at").eq("academy_id", academyId).eq("staging_user_id", studentUserId)
      .eq("status", "active").limit(1);
    const { data: pend } = await db.from("academy_link_codes")
      .select("expires_at").eq("academy_id", academyId).eq("student_user_id", studentUserId)
      .is("redeemed_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1);
    return json({
      linked: Array.isArray(link) && link.length > 0,
      pendingCode: Array.isArray(pend) && pend.length > 0,
      pendingExpiresAt: Array.isArray(pend) && pend[0] ? (pend[0] as { expires_at: string }).expires_at : null,
    }, 200);
  }

  if (action === "revoke") {
    await db.from("academy_prod_links").update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("academy_id", academyId).eq("staging_user_id", studentUserId).eq("status", "active");
    await db.from("academy_link_codes").update({ revoked_at: new Date().toISOString() })
      .eq("academy_id", academyId).eq("student_user_id", studentUserId)
      .is("redeemed_at", null).is("revoked_at", null);
    return json({ ok: true }, 200);
  }

  // action === "create": retire pending codes, then issue one fresh code.
  await db.from("academy_link_codes").update({ revoked_at: new Date().toISOString() })
    .eq("academy_id", academyId).eq("student_user_id", studentUserId)
    .is("redeemed_at", null).is("revoked_at", null);
  const code = newCode();
  const { data: inserted, error: insErr } = await db.from("academy_link_codes").insert({
    academy_id: academyId,
    student_user_id: studentUserId,
    code_hash: await sha256Hex(code),
    expires_at: new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000).toISOString(),
    created_by: callerId,
  }).select("id,expires_at").single();
  if (insErr || !inserted) return json({ error: "unavailable" }, 503);
  const row = inserted as { id: string; expires_at: string };
  return json({ code, codeId: row.id, expiresAt: row.expires_at }, 200);
});
