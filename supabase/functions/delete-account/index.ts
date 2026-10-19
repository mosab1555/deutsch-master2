// Account deletion (PREPARED LOCALLY — NOT DEPLOYED, NOT OPERATIONAL YET).
//
// Status: this file is the local implementation of the design recorded in
// docs/academy/ACCOUNT_DELETION_BLOCKER.md §3. It must NOT be deployed, and
// the client placeholder toast (client/profile.js) must NOT be wired to it,
// until ALL of the following are done by the owner:
//   1. Provide a staging Supabase project and authorize a staging deploy.
//   2. Set SUPABASE_SERVICE_ROLE_KEY as a function secret (dashboard/CLI,
//      never committed, never in client/ or www/).
//   3. Approve the explicit-confirmation strength (see OPEN DECISION below)
//      and the cross-project link question (see docs/academy/
//      ACCOUNT_DELETION_BLOCKER.md §Update 2026-10-18).
//   4. Run the two-account staging E2E (delete A -> A auth/user data gone,
//      B byte-identical, guest snapshot intact, auth_events anonymized,
//      double-delete clean not-found, invalid JWT rejected) and record the
//      evidence. Only then may account deletion be described as available.
//
// Design (verified against supabase/migrations/20261014000000_baseline.sql):
//   - Identity is derived ONLY from the caller's verified JWT
//     (supabase.auth.getUser on the Authorization header). The body never
//     carries a user id: a raw id parameter is rejected by construction.
//   - Typed confirmation ("DELETE") is required; this is the documented
//     "explicit typed confirmation" of the blocker design.
//   - Rate-limited per caller (in-memory, best effort per isolate; a durable
//     limiter is a possible follow-up, not a correctness dependency).
//   - Deletion calls Auth admin deleteUser for the caller's own id ONLY;
//     database CASCADEs then remove profiles / user_progress / sync_queue /
//     devices rows, while auth_events rows are retained with user_id = NULL
//     (anonymized). The response states exactly that.
//   - A per-table receipt (counts BEFORE deletion) is returned. On ANY
//     failure the function returns an error and deletes nothing.
//   - Secrets come from function environment only. Nothing sensitive
//     (token, email, key, user id) is ever logged.
//   - CORS: explicit preflight (OPTIONS) handling + wildcard-origin headers,
//     because Supabase Edge Functions do NOT add CORS automatically for
//     user-written functions, and the documented client wiring uses
//     functions.invoke from the browser (Supabase docs: Functions > CORS).
//     Wildcard origin is safe here: authentication is a bearer token (no
//     cookies) and the only account affected is the caller's own. The
//     preflight response carries no data. Still to be verified end-to-end in
//     staging before any client wiring (see blocker §3.4).
//
// OPEN DECISION (owner/legal): stronger re-authentication (password
// re-entry or confirmation token) is NOT implemented because it changes
// which account types can self-delete (e.g. magic-link-only accounts have
// no password). Typed confirmation is the minimum documented here; the
// final requirement needs an owner decision before production use.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 1024;
const CONFIRM_WORD = "DELETE";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

// In-memory, per-isolate best effort: blocks accidental hammering; not a
// durable global limiter.
const recentAttempts = new Map<string, number[]>();

// CORS headers for browser invocation. Supabase Edge Functions do not add
// these automatically (Supabase docs: Functions > CORS, "Manual CORS
// handling"). The allow-list matches the headers sent by supabase-js
// functions.invoke (authorization/apikey/x-client-info/content-type).
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const list = (recentAttempts.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (list.length >= RATE_LIMIT_MAX) {
    recentAttempts.set(userId, list);
    return true;
  }
  list.push(now);
  recentAttempts.set(userId, list);
  // Opportunistic cleanup so the map cannot grow unbounded per isolate.
  if (recentAttempts.size > 1000) {
    for (const [k, v] of recentAttempts) {
      if (!v.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) recentAttempts.delete(k);
    }
  }
  return false;
}

async function countRows(
  db: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string
): Promise<number | null> {
  try {
    const { count, error } = await db
      .from(table)
      .select(column, { count: "exact", head: true })
      .eq(column, value);
    if (error) return null;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

serve(async (req: Request): Promise<Response> => {
  // CORS preflight must succeed before any method/auth checks (browsers send
  // OPTIONS without credentials; the response carries no data).
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
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
  if (body["confirm"] !== CONFIRM_WORD) return json({ error: "confirmation required" }, 400);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) return json({ error: "unavailable" }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthenticated" }, 401);
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, "")
  );
  const callerId = userErr ? null : userData?.user?.id ?? null;
  if (!callerId || !UUID_RE.test(callerId)) return json({ error: "unauthenticated" }, 401);

  if (rateLimited(callerId)) return json({ error: "rate_limited" }, 429);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Receipt counts BEFORE deletion (the CASCADE deletes the first four;
  // auth_events keeps rows with user_id set to NULL).
  const receipt = {
    profiles: await countRows(db, "profiles", "id", callerId),
    user_progress: await countRows(db, "user_progress", "user_id", callerId),
    sync_queue: await countRows(db, "sync_queue", "user_id", callerId),
    devices: await countRows(db, "devices", "user_id", callerId),
    auth_events_anonymized: await countRows(db, "auth_events", "user_id", callerId),
  };

  const { error: delErr } = await db.auth.admin.deleteUser(callerId);
  if (delErr) return json({ error: "deletion_failed" }, 503);

  return json({
    deleted: true,
    receipt,
    retained_note: "auth_events rows are retained without any user linkage (user_id set to NULL).",
  }, 200);
});
