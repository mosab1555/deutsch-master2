"use strict";
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const E = process.env;
module.exports = {
  env: E.NODE_ENV || "development",
  port: Number(E.PORT || 4000),
  dbUrl: E.DATABASE_URL || "",
  pgDataDir: E.PG_DATA_DIR || "",
  jwtSecret: E.JWT_SECRET || "dev-secret-change-me",
  jwtRefreshSecret: E.JWT_REFRESH_SECRET || "dev-refresh-change-me",
  accessTtl: E.JWT_ACCESS_TTL || "15m",
  refreshTtlDays: Number(E.JWT_REFRESH_TTL_DAYS || 7),
  corsOrigins: (E.CORS_ORIGINS || "*").split(",").map(s => s.trim()),
  stripeKey: E.STRIPE_SECRET_KEY || "",
  stripeWebhook: E.STRIPE_WEBHOOK_SECRET || "",
  stripeMock: E.STRIPE_MOCK === "true",
  smtp: { host: E.SMTP_HOST || "", port: Number(E.SMTP_PORT || 587), user: E.SMTP_USER || "", pass: E.SMTP_PASSWORD || "", from: E.SMTP_FROM || "no-reply@localhost" },
  shipKey: E.SHIPPING_API_KEY || "",
  cloudinary: { cloud: E.CLOUDINARY_CLOUD || "", preset: E.CLOUDINARY_PRESET || "", key: E.CLOUDINARY_KEY || "", secret: E.CLOUDINARY_SECRET || "" },
  storageDir: E.STORAGE_DIR || require("path").join(__dirname, "..", "uploads"),
  appUrl: E.APP_URL || "http://localhost:4000",
};
