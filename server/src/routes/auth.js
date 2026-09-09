"use strict";
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const db = require("../db");
const { bad, asyncH, clean } = require("../utils");
const { signAccess, signRefresh, requireAuth } = require("../middleware/auth");
const { sendMail } = require("../mail");
const router = require("express").Router();
const audit = (uid, action, target, ip) => db.query("INSERT INTO audit_logs(user_id,action,target,ip) VALUES($1,$2,$3,$4)", [uid || null, action, target || "", ip || ""]);
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar_url || "", phone: u.phone || "", themePref: u.theme_pref || null });
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
async function issueTokens(u, res) {
  const access = signAccess(u), refresh = signRefresh(u);
  const h = crypto.createHash("sha256").update(refresh).digest("hex");
  await db.query("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+($3||' days')::interval)", [u.id, h, String(require("../config").refreshTtlDays)]);
  res.cookie("dmm_rt", refresh, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 864e5, path: "/api/auth" });
  return { accessToken: access, refreshToken: refresh, user: pub(u) };
}
router.post("/register", asyncH(async (req, res) => {
  const s = z.object({ name: z.string().min(2).max(120), email: z.string().regex(emailRe), password: z.string().min(6).max(200), phone: z.string().max(24).optional().default(""), role: z.enum(["customer", "seller"]).optional().default("customer") }).parse(req.body);
  const ex = await db.query("SELECT id FROM users WHERE lower(email)=lower($1)", [s.email]);
  if (ex.rows.length) throw bad(409, "EMAIL_EXISTS", "Email already registered");
  const hash = await bcrypt.hash(s.password, 12);
  const u = (await db.query("INSERT INTO users(name,email,phone,pass_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *", [clean(s.name), s.email.toLowerCase(), clean(s.phone || ""), hash, s.role])).rows[0];
  if (s.role === "seller") {
    const slug = "store-" + u.id.slice(0, 8);
    await db.query("INSERT INTO sellers(user_id,store_name,slug,logo,banner) VALUES($1,$2,$3,$4,$5)", [u.id, u.name + "'s Store", slug, { t: "g", g: 0, em: "🏪" }, { t: "g", g: 3, em: "🏪" }]);
  }
  await audit(u.id, "register", s.role, req.ip);
  await sendMail(u.email, "welcome", "Welcome", u.name);
  res.status(201).json({ success: true, data: await issueTokens(u, res) });
}));
router.post("/login", asyncH(async (req, res) => {
  const s = z.object({ email: z.string(), password: z.string() }).parse(req.body);
  const u = (await db.query("SELECT * FROM users WHERE lower(email)=lower($1)", [String(s.email).toLowerCase()])).rows[0];
  if (!u) throw bad(401, "INVALID_CREDENTIALS", "Invalid credentials");
  if (u.status !== "active") throw bad(403, "ACCOUNT_DISABLED", "Account disabled");
  if (!(await bcrypt.compare(String(s.password), u.pass_hash))) throw bad(401, "INVALID_CREDENTIALS", "Invalid credentials");
  await audit(u.id, "login", "", req.ip);
  res.json({ success: true, data: await issueTokens(u, res) });
}));
router.post("/refresh", asyncH(async (req, res) => {
  const tok = req.body.refreshToken || req.cookies.dmm_rt;
  if (!tok) throw bad(401, "INVALID_TOKEN", "Refresh token required");
  let p; try { p = require("jsonwebtoken").verify(tok, require("../config").jwtRefreshSecret); } catch (_) { throw bad(401, "INVALID_TOKEN", "Invalid refresh token"); }
  const h = crypto.createHash("sha256").update(tok).digest("hex");
  const row = (await db.query("SELECT * FROM refresh_tokens WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()", [h])).rows[0];
  if (!row || row.user_id !== p.sub) throw bad(401, "INVALID_TOKEN", "Refresh token revoked");
  await db.query("UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1", [row.id]); // rotation
  const u = (await db.query("SELECT * FROM users WHERE id=$1 AND status='active'", [p.sub])).rows[0];
  if (!u) throw bad(401, "INVALID_TOKEN", "Account unavailable");
  res.json({ success: true, data: await issueTokens(u, res) });
}));
router.post("/logout", asyncH(async (req, res) => {
  const tok = req.body.refreshToken || req.cookies.dmm_rt;
  if (tok) { const h = crypto.createHash("sha256").update(tok).digest("hex"); await db.query("UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1", [h]); }
  res.clearCookie("dmm_rt", { path: "/api/auth" });
  res.json({ success: true, data: { ok: true } });
}));
router.post("/forgot", asyncH(async (req, res) => {
  const s = z.object({ email: z.string() }).parse(req.body);
  const u = (await db.query("SELECT id FROM users WHERE lower(email)=lower($1)", [String(s.email).toLowerCase()])).rows[0];
  let token = null;
  if (u) {
    token = crypto.randomBytes(32).toString("hex");
    const h = crypto.createHash("sha256").update(token).digest("hex");
    await db.query("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')", [u.id, h]);
    const usr = (await db.query("SELECT email FROM users WHERE id=$1", [u.id])).rows[0];
    const sent = await sendMail(usr.email, "reset", "Password reset", { token });
    if (sent.mode !== "logger") token = null; // real SMTP: token only via email
  }
  res.json({ success: true, data: { ok: true, token } }); // token exposed only without SMTP (dev); null-safe in prod
}));
router.post("/reset", asyncH(async (req, res) => {
  const s = z.object({ token: z.string().min(10), password: z.string().min(6).max(200) }).parse(req.body);
  const h = crypto.createHash("sha256").update(s.token).digest("hex");
  const r = (await db.query("SELECT * FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()", [h])).rows[0];
  if (!r) throw bad(400, "INVALID_TOKEN", "Invalid or expired token");
  await db.query("UPDATE users SET pass_hash=$1,updated_at=now() WHERE id=$2", [await bcrypt.hash(s.password, 12), r.user_id]);
  await db.query("UPDATE password_resets SET used_at=now() WHERE id=$1", [r.id]);
  await db.query("UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1", [r.user_id]);
  await audit(r.user_id, "password reset", "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
router.get("/me", requireAuth, asyncH(async (req, res) => {
  const u = (await db.query("SELECT * FROM users WHERE id=$1", [req.user.id])).rows[0];
  if (!u) throw bad(401, "INVALID_TOKEN", "Account unavailable");
  res.json({ success: true, data: pub(u) });
}));
router.patch("/me", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ name: z.string().min(2).max(120).optional(), phone: z.string().max(24).optional(), avatar: z.string().max(500).optional(), themePref: z.any().optional() }).parse(req.body);
  const sets = [], vals = []; let i = 1;
  if (s.name !== undefined) { sets.push(`name=$${i++}`); vals.push(clean(s.name)); }
  if (s.phone !== undefined) { sets.push(`phone=$${i++}`); vals.push(clean(s.phone || "")); }
  if (s.avatar !== undefined) { sets.push(`avatar_url=$${i++}`); vals.push(clean(s.avatar || "")); }
  if (s.themePref !== undefined) { sets.push(`theme_pref=$${i++}`); vals.push(JSON.stringify(s.themePref)); await db.query("INSERT INTO theme_preferences(user_id,theme_name,custom) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET theme_name=$2,custom=$3", [req.user.id, (s.themePref && s.themePref.id) || "midnight", JSON.stringify((s.themePref && s.themePref.tokens) || null)]); }
  if (sets.length) { vals.push(req.user.id); await db.query(`UPDATE users SET ${sets.join(",")},updated_at=now() WHERE id=$${i}`, vals); }
  const u = (await db.query("SELECT * FROM users WHERE id=$1", [req.user.id])).rows[0];
  res.json({ success: true, data: pub(u) });
}));
router.post("/password", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ oldPassword: z.string(), newPassword: z.string().min(6).max(200) }).parse(req.body);
  const u = (await db.query("SELECT * FROM users WHERE id=$1", [req.user.id])).rows[0];
  if (!(await bcrypt.compare(s.oldPassword, u.pass_hash))) throw bad(401, "WRONG_PASSWORD", "Wrong password");
  await db.query("UPDATE users SET pass_hash=$1,updated_at=now() WHERE id=$2", [await bcrypt.hash(s.newPassword, 12), u.id]);
  await db.query("UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1", [u.id]);
  await audit(u.id, "change password", "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
module.exports = router;
module.exports.audit = audit;
module.exports.pub = pub;
