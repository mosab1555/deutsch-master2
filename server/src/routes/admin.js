"use strict";
// Admin control center + seller store management.
const { z } = require("zod");
const db = require("../db");
const { bad, asyncH, clean } = require("../utils");
const { requireAuth, requireRole } = require("../middleware/auth");
const { audit } = require("./auth");
const { sendMail } = require("../mail");
const router = require("express").Router();
const N = db.num;
router.use(requireAuth, requireRole("admin"));
/* stats */
router.get("/stats", asyncH(async (_req, res) => {
  const [u, s, p, o, r] = await Promise.all([
    db.query("SELECT count(*) c FROM users"), db.query("SELECT count(*) c FROM sellers"),
    db.query("SELECT count(*) c FROM products WHERE deleted_at IS NULL"), db.query("SELECT * FROM orders"),
    db.query("SELECT count(*) c FROM reviews"),
  ]);
  const valid = o.rows.filter(x => !["cancelled", "refunded"].includes(x.status));
  const byDay = {};
  valid.forEach(x => { const k = new Date(x.created_at).toISOString().slice(0, 10); byDay[k] = (byDay[k] || 0) + N(x.total); });
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); const k = d.toISOString().slice(0, 10); return { k: k.slice(5), v: byDay[k] || 0 }; });
  const top = (await db.query("SELECT id,name,sales FROM products WHERE deleted_at IS NULL ORDER BY sales DESC LIMIT 5")).rows;
  res.json({ success: true, data: { users: +u.rows[0].c, sellers: +s.rows[0].c, prods: +p.rows[0].c, orders: o.rows.length,
    revenue: valid.reduce((a, x) => a + N(x.total), 0),
    pendingOrders: o.rows.filter(x => x.status === "pending").length,
    pendingSellers: (await db.query("SELECT count(*) c FROM sellers WHERE status='pending'")).rows[0].c - 0,
    pendingProducts: (await db.query("SELECT count(*) c FROM products WHERE status='pending' AND deleted_at IS NULL")).rows[0].c - 0,
    recentOrders: o.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6),
    recentUsers: (await db.query("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 5")).rows,
    byDay: days, byMonth: [], topProducts: top, reviews: +r.rows[0].c } });
}));
/* users */
router.get("/users", asyncH(async (_req, res) => {
  const r = await db.query("SELECT id,name,email,phone,role,status,created_at FROM users ORDER BY created_at DESC");
  res.json({ success: true, data: r.rows });
}));
router.patch("/users/:id", asyncH(async (req, res) => {
  const s = z.object({ role: z.enum(["customer", "seller", "admin"]).optional(), status: z.enum(["active", "disabled"]).optional(), name: z.string().min(2).max(120).optional(), phone: z.string().max(24).optional() }).parse(req.body);
  if (req.params.id === req.user.id) throw bad(400, "SELF_EDIT", "Cannot edit self");
  const u = (await db.query("SELECT * FROM users WHERE id=$1", [req.params.id])).rows[0];
  if (!u) throw bad(404, "NOT_FOUND", "User not found");
  const sets = [], v = []; let i = 1;
  if (s.role) { sets.push(`role=$${i++}`); v.push(s.role); }
  if (s.status) { sets.push(`status=$${i++}`); v.push(s.status); }
  if (s.name) { sets.push(`name=$${i++}`); v.push(clean(s.name)); }
  if (s.phone !== undefined) { sets.push(`phone=$${i++}`); v.push(clean(s.phone)); }
  if (sets.length) { v.push(req.params.id); await db.query(`UPDATE users SET ${sets.join(",")},updated_at=now() WHERE id=$${i}`, v); }
  await audit(req.user.id, `user ${u.email} -> ${JSON.stringify(s)}`, u.id, req.ip);
  res.json({ success: true, data: { ok: true } });
}));
/* sellers */
router.get("/sellers", asyncH(async (_req, res) => {
  const r = await db.query("SELECT s.*,u.email AS owner_email FROM sellers s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC");
  res.json({ success: true, data: r.rows });
}));
router.post("/sellers/:id/status", asyncH(async (req, res) => {
  const s = z.object({ status: z.enum(["pending", "approved", "suspended"]) }).parse(req.body);
  const sl = (await db.query("SELECT * FROM sellers WHERE id=$1", [req.params.id])).rows[0];
  if (!sl) throw bad(404, "NOT_FOUND", "Seller not found");
  await db.query("UPDATE sellers SET status=$1,updated_at=now() WHERE id=$2", [s.status, sl.id]);
  await audit(req.user.id, `seller ${sl.store_name} -> ${s.status}`, sl.id, req.ip);
  await db.query("INSERT INTO notifications(user_id,kind,data) VALUES($1,'seller_status',$2)", [sl.user_id, JSON.stringify({ store: sl.store_name, status: s.status })]);
  const em = (await db.query("SELECT email FROM users WHERE id=$1", [sl.user_id])).rows[0];
  await sendMail(em && em.email, "seller_status", "Store " + s.status, { store: sl.store_name, status: s.status });
  res.json({ success: true, data: { ok: true } });
}));
/* categories */
router.post("/categories", asyncH(async (req, res) => {
  const s = z.object({ id: z.string().uuid().optional(), name: z.object({ ar: z.string().min(1).max(80), en: z.string().min(1).max(80), de: z.string().max(80).optional().default("") }),
    slug: z.string().max(80).optional(), parentId: z.string().uuid().nullable().optional(), img: z.any().optional(), order: z.coerce.number().int().optional().default(0), active: z.boolean().optional().default(true) }).parse(req.body);
  const slug = s.slug || s.name.en.toLowerCase().replace(/[^\w]+/g, "-");
  if (s.id) {
    await db.query("UPDATE categories SET name_ar=$1,name_en=$2,name_de=$3,slug=$4,parent_id=$5,image=$6,sort_order=$7,active=$8 WHERE id=$9",
      [s.name.ar, s.name.en, s.name.de, slug, s.parentId || null, JSON.stringify(s.img || {}), s.order, s.active, s.id]);
    await audit(req.user.id, "save category " + slug, s.id, req.ip);
    return res.json({ success: true, data: { id: s.id } });
  }
  const r = (await db.query("INSERT INTO categories(parent_id,name_ar,name_en,name_de,slug,image,sort_order,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    [s.parentId || null, s.name.ar, s.name.en, s.name.de, slug, JSON.stringify(s.img || {}), s.order, s.active])).rows[0];
  await audit(req.user.id, "save category " + slug, r.id, req.ip);
  res.status(201).json({ success: true, data: r });
}));
router.delete("/categories/:id", asyncH(async (req, res) => {
  const kids = (await db.query("SELECT 1 FROM categories WHERE parent_id=$1", [req.params.id])).rows[0];
  if (kids) throw bad(400, "HAS_CHILDREN", "Category has subcategories");
  await db.query("DELETE FROM categories WHERE id=$1", [req.params.id]);
  await audit(req.user.id, "delete category", req.params.id, req.ip);
  res.json({ success: true, data: { ok: true } });
}));
/* brands */
router.post("/brands", asyncH(async (req, res) => {
  const s = z.object({ id: z.string().uuid().optional(), name: z.string().min(1).max(80), slug: z.string().max(80).optional(), logo: z.any().optional(), desc: z.string().max(500).optional().default(""), active: z.boolean().optional().default(true) }).parse(req.body);
  const slug = s.slug || s.name.toLowerCase().replace(/[^\w]+/g, "-");
  if (s.id) { await db.query("UPDATE brands SET name=$1,slug=$2,logo=$3,description=$4,active=$5 WHERE id=$6", [clean(s.name), slug, JSON.stringify(s.logo || {}), clean(s.desc), s.active, s.id]); }
  else await db.query("INSERT INTO brands(name,slug,logo,description,active) VALUES($1,$2,$3,$4,$5)", [clean(s.name), slug, JSON.stringify(s.logo || {}), clean(s.desc), s.active]);
  await audit(req.user.id, "save brand " + s.name, s.id || "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
router.delete("/brands/:id", asyncH(async (req, res) => {
  await db.query("DELETE FROM brands WHERE id=$1", [req.params.id]);
  await audit(req.user.id, "delete brand", req.params.id, req.ip);
  res.json({ success: true, data: { ok: true } });
}));
/* coupons */
router.get("/coupons", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM coupons ORDER BY created_at DESC");
  res.json({ success: true, data: r.rows.map(c => ({ ...c, value: N(c.value), minOrder: N(c.min_order), min_order: undefined, maxDisc: c.max_disc == null ? null : N(c.max_disc), max_disc: undefined })) });
}));
router.post("/coupons", asyncH(async (req, res) => {
  const s = z.object({ id: z.string().uuid().optional(), code: z.string().min(2).max(30), type: z.enum(["percent", "fixed"]).default("percent"), value: z.coerce.number().min(0), maxDisc: z.coerce.number().nullable().optional(), minOrder: z.coerce.number().min(0).optional().default(0), usageLimit: z.coerce.number().int().min(1).optional().default(1000), perUser: z.coerce.number().int().min(1).optional().default(1), end: z.string().optional().default("2030-01-01"), active: z.boolean().optional().default(true), scope: z.string().optional().default("all") }).parse(req.body);
  const code = s.code.toUpperCase().trim();
  if (s.id) await db.query("UPDATE coupons SET code=$1,type=$2,value=$3,max_disc=$4,min_order=$5,usage_limit=$6,per_user=$7,end_at=$8,active=$9,scope=$10 WHERE id=$11", [code, s.type, s.value, s.maxDisc || null, s.minOrder, s.usageLimit, s.perUser, s.end, s.active, s.scope, s.id]);
  else await db.query("INSERT INTO coupons(code,type,value,max_disc,min_order,usage_limit,per_user,end_at,active,scope) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [code, s.type, s.value, s.maxDisc || null, s.minOrder, s.usageLimit, s.perUser, s.end, s.active, s.scope]);
  await audit(req.user.id, "save coupon " + code, s.id || "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
router.delete("/coupons/:id", asyncH(async (req, res) => {
  await db.query("DELETE FROM coupons WHERE id=$1", [req.params.id]);
  await audit(req.user.id, "delete coupon", req.params.id, req.ip);
  res.json({ success: true, data: { ok: true } });
}));
/* promos */
router.get("/promos", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM promotions ORDER BY created_at DESC");
  res.json({ success: true, data: r.rows });
}));
router.post("/promos", asyncH(async (req, res) => {
  const s = z.object({ id: z.string().uuid().optional(), title: z.string().min(1).max(120), type: z.enum(["flash", "category", "seller", "homepage"]).default("flash"), discount: z.coerce.number().min(0).max(95), productIds: z.array(z.string()).optional().default([]), end: z.string().optional().default("2030-01-01"), status: z.enum(["active", "paused", "expired"]).default("active") }).parse(req.body);
  if (s.id) await db.query("UPDATE promotions SET title=$1,type=$2,discount=$3,product_ids=$4,end_at=$5,status=$6 WHERE id=$7", [clean(s.title), s.type, s.discount, JSON.stringify(s.productIds), s.end, s.status, s.id]);
  else await db.query("INSERT INTO promotions(title,type,discount,product_ids,end_at,status) VALUES($1,$2,$3,$4,$5,$6)", [clean(s.title), s.type, s.discount, JSON.stringify(s.productIds), s.end, s.status]);
  await audit(req.user.id, "save promo " + s.title, s.id || "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
router.delete("/promos/:id", asyncH(async (req, res) => {
  await db.query("DELETE FROM promotions WHERE id=$1", [req.params.id]);
  res.json({ success: true, data: { ok: true } });
}));
/* reviews moderation */
router.get("/reviews", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 200");
  res.json({ success: true, data: r.rows });
}));
router.post("/reviews/:id/moderate", asyncH(async (req, res) => {
  const s = z.object({ status: z.enum(["visible", "hidden"]) }).parse(req.body);
  await db.query("UPDATE reviews SET status=$1 WHERE id=$2", [s.status, req.params.id]);
  await audit(req.user.id, "moderate review " + req.params.id + " " + s.status, "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
/* audit + reports + mail */
router.get("/audit", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200");
  res.json({ success: true, data: r.rows.map(x => ({ id: x.id, userId: x.user_id, action: x.action, target: x.target, at: x.created_at })) });
}));
router.get("/report", asyncH(async (req, res) => {
  let w = "1=1"; const v = []; let i = 1;
  if (req.query.from) { w += ` AND created_at>=$${i++}`; v.push(req.query.from); }
  if (req.query.to) { w += ` AND created_at<=$${i++}`; v.push(req.query.to + "T23:59:59"); }
  const o = (await db.query(`SELECT * FROM orders WHERE ${w}`, v)).rows;
  const valid = o.filter(x => !["cancelled", "refunded"].includes(x.status));
  const rev = valid.reduce((a, x) => a + N(x.total), 0);
  const byPay = {}; valid.forEach(x => { byPay[x.pay_method] = (byPay[x.pay_method] || 0) + 1; });
  const byStatus = {}; o.forEach(x => { byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
  res.json({ success: true, data: { orders: o.length, revenue: rev, avg: o.length ? rev / o.length : 0, byPay, byStatus: Object.entries(byStatus).map(([k, n]) => ({ k, n })) } });
}));
router.get("/mail", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM mail_log ORDER BY created_at DESC LIMIT 50");
  res.json({ success: true, data: r.rows.map(m => ({ to: m.to_addr, tpl: m.template, subject: m.subject, at: m.created_at })) });
}));
router.get("/notifications", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100");
  res.json({ success: true, data: r.rows });
}));
module.exports = router;
