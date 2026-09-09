"use strict";
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");
const cfg = require("./config");
const { ApiError } = require("./utils");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: cfg.corsOrigins.includes("*") ? true : cfg.corsOrigins, credentials: true }));
app.use(cookieParser());
app.use("/api/cms/webhooks/stripe", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use("/api/", globalLimiter);
app.use("/api/auth/", authLimiter);
app.use("/uploads", express.static(cfg.storageDir, { maxAge: "7d" }));
// client (when served by same backend in dev / Electron)
const clientDir = path.join(__dirname, "..", "..", "client");
try { if (require("fs").existsSync(path.join(clientDir, "index.html"))) app.use(express.static(clientDir, { maxAge: "1h" })); } catch (_) {}
app.get("/api/health", (_req, res) => res.json({ success: true, data: { ok: true, db: require("./db").getMode(), env: cfg.env } }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/catalog", require("./routes/catalog"));
app.use("/api", require("./routes/shop"));
app.use("/api", require("./routes/orders"));
app.use("/api", require("./routes/engage"));
app.use("/api/cms", require("./routes/cms"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api", (_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "API route not found")));
app.use((err, _req, res, _next) => {
  if (err && err.name === "ZodError") return res.status(400).json({ success: false, error: { code: "INVALID_INPUT", message: "Invalid input", details: err.issues.slice(0, 5) } });
  if (err && err.code === "23505") return res.status(409).json({ success: false, error: { code: "DUPLICATE", message: "Resource already exists" } });
  if (err && err.code === "23503") return res.status(400).json({ success: false, error: { code: "REFERENCE", message: "Related resource missing" } });
  if (err && err.code === "22P02") return res.status(400).json({ success: false, error: { code: "INVALID_INPUT", message: "Invalid value" } });
  const status = (err && err.status) || 500;
  const code = (err && err.code) || "INTERNAL";
  if (status >= 500) { console.error("[api-error]", err && err.message); if (cfg.env !== "production") console.error(err && err.stack); }
  res.status(status).json({ success: false, error: { code, message: status >= 500 && cfg.env === "production" ? "Internal error" : (err && err.message) || "Error" } });
});
module.exports = app;
