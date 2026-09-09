"use strict";
// Structured errors -> {success:false,error:{code,message}} ; never leak stacks in production.
class ApiError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status || 500; this.code = code || "INTERNAL"; }
}
const bad = (status, code, message) => new ApiError(status, code, message);
const asyncH = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Minimal XSS hardening for stored strings (output escaping stays in frontend esc()).
const clean = v => (typeof v === "string" ? v.replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/ on\w+="[^"]*"/gi, "").slice(0, 20000) : v);
const cleanObj = o => { if (Array.isArray(o)) return o.map(cleanObj); if (o && typeof o === "object") { const r = {}; for (const k of Object.keys(o)) r[k] = cleanObj(o[k]); return r; } return clean(o); };
const page = q => ({ page: Math.max(1, parseInt(q.page || "1", 10) || 1), per: Math.min(60, Math.max(1, parseInt(q.per || "12", 10) || 12)) });
module.exports = { ApiError, bad, asyncH, clean, cleanObj, page };
