"use strict";
// Engagement: reviews, media, notifications, messages (+SSE stream, polling-ready).
const multer = require("multer");
const { z } = require("zod");
const db = require("../db");
const { bad, asyncH, clean } = require("../utils");
const { requireAuth, requireRole } = require("../middleware/auth");
const { audit } = require("./auth");
const storage = require("../storage");
const { sendMail } = require("../mail");
const router = require("express").Router();
const N = db.num;
const contactLimiter = require("express-rate-limit")({ windowMs: 15 * 60 * 1000, max: 20 });
router.post("/contact", contactLimiter, asyncH(async (req, res) => {
  const s = z.object({ name: z.string().min(2).max(120), email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/), message: z.string().min(2).max(2000) }).parse(req.body);
  await db.query("INSERT INTO notifications(user_id,kind,data) VALUES(NULL,'contact',$1)", [JSON.stringify({ from: clean(s.name) + " <" + s.email + ">", text: clean(s.message) })]);
  await sendMail(s.email, "contact", "Contact: " + s.name, { text: s.message });
  res.json({ success: true, data: { ok: true } });
}));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
/* reviews */
router.get("/reviews/:pid", asyncH(async (req, res) => {
  const r = await db.query("SELECT * FROM reviews WHERE product_id=$1 AND status='visible' ORDER BY created_at DESC", [req.params.pid]);
  res.json({ success: true, data: r.rows });
}));
router.post("/reviews", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ pid: z.string().uuid(), rating: z.coerce.number().int().min(1).max(5), text: z.string().min(1).max(1000), images: z.array(z.string().max(500)).max(4).optional().default([]) }).parse(req.body);
  const p = (await db.query("SELECT id FROM products WHERE id=$1 AND deleted_at IS NULL", [s.pid])).rows[0];
  if (!p) throw bad(404, "PRODUCT_NOT_FOUND", "Product not found");
  const bought = (await db.query(`SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id=o.id
    WHERE o.customer_id=$1 AND oi.product_id=$2 AND o.status='delivered' LIMIT 1`, [req.user.id, s.pid])).rows[0];
  const u = (await db.query("SELECT name FROM users WHERE id=$1", [req.user.id])).rows[0];
  const r = (await db.query(`INSERT INTO reviews(product_id,user_id,user_name,rating,text,images,verified)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(product_id,user_id) DO UPDATE SET rating=$4,text=$5,images=$6 RETURNING *`,
    [s.pid, req.user.id, u.name, s.rating, clean(s.text), JSON.stringify(s.images), !!bought])).rows[0];
  const agg = (await db.query("SELECT avg(rating) a,count(*) c FROM reviews WHERE product_id=$1 AND status='visible'", [s.pid])).rows[0];
  await db.query("UPDATE products SET rating=$1,reviews_count=$2 WHERE id=$3", [N(agg.a), +agg.c, s.pid]);
  await audit(req.user.id, "review " + s.pid, s.rating, req.ip);
  res.status(201).json({ success: true, data: r });
}));
router.post("/reviews/:id/reply", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const s = z.object({ text: z.string().min(1).max(500) }).parse(req.body);
  const r = (await db.query("SELECT * FROM reviews WHERE id=$1", [req.params.id])).rows[0];
  if (!r) throw bad(404, "NOT_FOUND", "Review not found");
  if (req.user.role === "seller") {
    const p = (await db.query("SELECT seller_id FROM products WHERE id=$1", [r.product_id])).rows[0];
    const st = (await db.query("SELECT id FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
    if (!st || !p || p.seller_id !== st.id) throw bad(403, "FORBIDDEN", "Forbidden");
  }
  await db.query("UPDATE reviews SET reply=$1 WHERE id=$2", [JSON.stringify({ text: clean(s.text), at: new Date().toISOString() }), r.id]);
  res.json({ success: true, data: { ok: true } });
}));
/* media */
router.get("/media/:id", asyncH(async (req, res) => {
  const m = (await db.query("SELECT id,url,provider FROM media WHERE id=$1", [req.params.id])).rows[0];
  if (!m) throw bad(404, "NOT_FOUND", "Media not found");
  res.json({ success: true, data: { id: m.id, url: m.url } });
}));
router.get("/media", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const r = req.user.role === "admin" ? await db.query("SELECT * FROM media ORDER BY created_at DESC LIMIT 200")
    : await db.query("SELECT * FROM media WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200", [req.user.id]);
  res.json({ success: true, data: r.rows });
}));
router.post("/media", requireAuth, requireRole("seller", "admin"), upload.single("file"), asyncH(async (req, res) => {
  if (!req.file || !req.file.mimetype.startsWith("image/")) throw bad(400, "INVALID_FILE", "Images only, < 4MB");
  const saved = await storage.save(req.file);
  const m = (await db.query("INSERT INTO media(user_id,name,mime,size_bytes,url,provider) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [req.user.id, req.file.originalname.slice(0, 120), req.file.mimetype, req.file.size, saved.url, saved.provider])).rows[0];
  await audit(req.user.id, "upload media " + m.name, m.id, req.ip);
  res.status(201).json({ success: true, data: { id: m.id, name: m.name, url: m.url } });
}));
router.delete("/media/:id", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const m = (await db.query("SELECT * FROM media WHERE id=$1", [req.params.id])).rows[0];
  if (!m) throw bad(404, "NOT_FOUND", "Media not found");
  if (req.user.role !== "admin" && m.user_id !== req.user.id) throw bad(403, "FORBIDDEN", "Forbidden");
  storage.remove(m.url, m.provider);
  await db.query("DELETE FROM media WHERE id=$1", [m.id]);
  res.json({ success: true, data: { ok: true } });
}));
/* notifications */
router.get("/notifications", requireAuth, asyncH(async (req, res) => {
  const r = await db.query("SELECT * FROM notifications WHERE user_id IS NULL OR user_id=$1 ORDER BY created_at DESC LIMIT 50", [req.user.id]);
  res.json({ success: true, data: r.rows.map(n => ({ id: n.id, kind: n.kind, data: n.data, read: !!n.read_at, at: n.created_at })) });
}));
router.post("/notifications/:id/read", requireAuth, asyncH(async (req, res) => {
  await db.query("INSERT INTO notifications(id,user_id,kind,data,read_at) SELECT $1,$2,kind,data,now() FROM notifications WHERE id=$1 ON CONFLICT(id) DO UPDATE SET user_id=$2,read_at=now()", [req.params.id, req.user.id]).catch(() => {});
  await db.query("UPDATE notifications SET read_at=now(),user_id=COALESCE(user_id,$2) WHERE id=$1 AND (user_id IS NULL OR user_id=$2)", [req.params.id, req.user.id]);
  res.json({ success: true, data: { ok: true } });
}));
router.post("/notifications/read-all", requireAuth, asyncH(async (req, res) => {
  await db.query("UPDATE notifications SET read_at=now() WHERE (user_id IS NULL OR user_id=$1) AND read_at IS NULL", [req.user.id]);
  const mine = (await db.query("SELECT id FROM notifications WHERE user_id IS NULL AND read_at IS NULL")).rows;
  for (const m of mine) await db.query("INSERT INTO notifications(id,user_id,kind,data,read_at) SELECT $1,$2,kind,data,now() FROM notifications WHERE id=$1 ON CONFLICT(id) DO NOTHING", [m.id, req.user.id]).catch(() => {});
  res.json({ success: true, data: { ok: true } });
}));
router.post("/notifications/broadcast", requireAuth, requireRole("admin"), asyncH(async (req, res) => {
  const s = z.object({ kind: z.string().max(40).default("broadcast"), text: z.string().min(1).max(500) }).parse(req.body);
  await db.query("INSERT INTO notifications(user_id,kind,data) VALUES(NULL,$1,$2)", [s.kind, JSON.stringify({ text: clean(s.text) })]);
  await audit(req.user.id, "broadcast " + s.kind, s.text.slice(0, 80), req.ip);
  res.json({ success: true, data: { ok: true } });
}));
/* messages (REST polling + SSE stream for realtime upgrade) */
const sseClients = new Set();
router.get("/messages", requireAuth, asyncH(async (req, res) => {
  const r = await db.query("SELECT thread,max(created_at) last,count(*) count FROM messages WHERE from_id=$1 OR to_id=$1 GROUP BY thread ORDER BY last DESC", [req.user.id]);
  const out = [];
  for (const t of r.rows) {
    const last = (await db.query("SELECT m.*,u.name AS from_name2 FROM messages m LEFT JOIN users u ON u.id=m.from_id WHERE thread=$1 ORDER BY created_at DESC LIMIT 1", [t.thread])).rows[0];
    out.push({ thread: t.thread, last: { ...last, fromName: last.from_name }, count: +t.count });
  }
  res.json({ success: true, data: out });
}));
router.get("/messages/:thread", requireAuth, asyncH(async (req, res) => {
  const r = await db.query("SELECT * FROM messages WHERE thread=$1 AND (from_id=$2 OR to_id=$2) ORDER BY created_at", [req.params.thread, req.user.id]);
  res.json({ success: true, data: r.rows });
}));
router.post("/messages", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ thread: z.string().uuid().optional(), to: z.string().uuid(), text: z.string().min(1).max(2000), orderId: z.string().uuid().nullable().optional() }).parse(req.body);
  if (s.to === req.user.id) throw bad(400, "SELF_MESSAGE", "Cannot message yourself");
  const me = (await db.query("SELECT name FROM users WHERE id=$1", [req.user.id])).rows[0];
  const th = s.thread || require("crypto").randomUUID();
  const m = (await db.query("INSERT INTO messages(thread,from_id,from_name,to_id,order_id,text) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [th, req.user.id, me.name, s.to, s.orderId || null, clean(s.text)])).rows[0];
  await db.query("INSERT INTO notifications(user_id,kind,data) VALUES($1,'message',$2)", [s.to, JSON.stringify({ from: me.name, thread: th })]);
  const payload = `data: ${JSON.stringify({ thread: th, id: m.id })}\n\n`;
  sseClients.forEach(c => { try { if (c.user === s.to) c.res.write(payload); } catch (_) {} });
  res.status(201).json({ success: true, data: m });
}));
router.post("/messages/to-seller", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ sellerId: z.string().uuid(), text: z.string().min(1).max(2000), orderId: z.string().uuid().nullable().optional() }).parse(req.body);
  const sl = (await db.query("SELECT user_id,store_name FROM sellers WHERE id=$1", [s.sellerId])).rows[0];
  if (!sl) throw bad(404, "NOT_FOUND", "Store not found");
  if (s.orderId) {
    const o = (await db.query("SELECT customer_id FROM orders WHERE id=$1", [s.orderId])).rows[0];
    if (!o || (o.customer_id !== req.user.id && req.user.role === "customer")) throw bad(403, "FORBIDDEN", "Forbidden");
  }
  const me = (await db.query("SELECT name FROM users WHERE id=$1", [req.user.id])).rows[0];
  const th = require("crypto").randomUUID();
  const m = (await db.query("INSERT INTO messages(thread,from_id,from_name,to_id,order_id,text) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [th, req.user.id, me.name, sl.user_id, s.orderId || null, clean(s.text)])).rows[0];
  await db.query("INSERT INTO notifications(user_id,kind,data) VALUES($1,'message',$2)", [sl.user_id, JSON.stringify({ from: me.name, thread: th })]);
  res.status(201).json({ success: true, data: m });
}));
router.get("/messages-stream", requireAuth, asyncH(async (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const client = { user: req.user.id, res };
  sseClients.add(client);
  res.write(": connected\n\n");
  const beat = setInterval(() => { try { res.write(": ping\n\n"); } catch (_) { clearInterval(beat); } }, 25000);
  req.on("close", () => { sseClients.delete(client); clearInterval(beat); });
}));
module.exports = router;
