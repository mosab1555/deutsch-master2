"use strict";
const jwt = require("jsonwebtoken");
const cfg = require("../config");
const { bad, asyncH } = require("../utils");
const signAccess = u => jwt.sign({ sub: u.id, role: u.role }, cfg.jwtSecret, { expiresIn: cfg.accessTtl });
const signRefresh = u => jwt.sign({ sub: u.id, jti: require("crypto").randomUUID() }, cfg.jwtRefreshSecret, { expiresIn: cfg.refreshTtlDays + "d" });
// Optional auth (public endpoints that personalize when logged in)
const optionalAuth = asyncH(async (req, _res, next) => {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (tok) { try { const p = jwt.verify(tok, cfg.jwtSecret); req.user = { id: p.sub, role: p.role }; } catch (_) {} }
  next();
});
const requireAuth = (req, _res, next) => {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tok) return next(bad(401, "UNAUTHENTICATED", "Login required"));
  try { const p = jwt.verify(tok, cfg.jwtSecret); req.user = { id: p.sub, role: p.role }; next(); }
  catch (_) { next(bad(401, "INVALID_TOKEN", "Invalid or expired token")); }
};
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(bad(401, "UNAUTHENTICATED", "Login required"));
  if (!roles.includes(req.user.role)) return next(bad(403, "FORBIDDEN", "Forbidden"));
  next();
};
module.exports = { signAccess, signRefresh, optionalAuth, requireAuth, requireRole };
