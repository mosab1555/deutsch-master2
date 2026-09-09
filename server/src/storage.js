"use strict";
// Media storage: local disk provider (runnable now) + Cloudinary unsigned upload when
// CLOUDINARY_CLOUD + CLOUDINARY_PRESET are set. DB stores URL + metadata (never base64).
// S3-compatible: set STORAGE_* and replace local provider — interface is (save/load/delete).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cfg = require("./config");
try { fs.mkdirSync(cfg.storageDir, { recursive: true }); } catch (_) {}
async function saveLocal(file) {
  const ext = path.extname(file.originalname || "").slice(0, 8) || ".bin";
  const name = crypto.randomBytes(12).toString("hex") + ext;
  fs.writeFileSync(path.join(cfg.storageDir, name), file.buffer);
  return { url: "/uploads/" + name, provider: "local" };
}
async function saveCloudinary(file) {
  const fd = new FormData();
  fd.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "upload");
  fd.append("upload_preset", cfg.cloudinary.preset);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudinary.cloud}/image/upload`, { method: "POST", body: fd });
  const j = await r.json();
  if (!j.secure_url) throw new Error("cloudinary: " + (j.error && j.error.message || "upload failed"));
  return { url: j.secure_url, provider: "cloudinary" };
}
async function save(file) {
  if (cfg.cloudinary.cloud && cfg.cloudinary.preset) return saveCloudinary(file);
  return saveLocal(file);
}
function remove(url, provider) {
  if (provider === "local" && url && url.startsWith("/uploads/")) {
    try { fs.unlinkSync(path.join(cfg.storageDir, path.basename(url))); } catch (_) {}
  }
}
module.exports = { save, remove };
