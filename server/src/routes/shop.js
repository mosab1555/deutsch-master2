"use strict";
// Cart (server-backed, merged on login), wishlist, addresses.
const { z } = require("zod");
const db = require("../db");
const { bad, asyncH } = require("../utils");
const { requireAuth } = require("../middleware/auth");
const { prodOut } = require("./catalog");
const router = require("express").Router();
const N = db.num;
async function cartId(uid, create) {
  let c = (await db.query("SELECT id FROM carts WHERE user_id=$1", [uid])).rows[0];
  if (!c && create) c = (await db.query("INSERT INTO carts(user_id) VALUES($1) RETURNING id", [uid])).rows[0];
  return c && c.id;
}
async function cartDetail(cid) {
  if (!cid) return { items: [], groups: {} };
  const r = await db.query(`SELECT ci.product_id AS pid,ci.variant,ci.qty,p.name,p.price,p.images,p.stock,p.seller_id,s.store_name AS seller
    FROM cart_items ci JOIN products p ON p.id=ci.product_id LEFT JOIN sellers s ON s.id=p.seller_id
    WHERE ci.cart_id=$1 AND p.status='published' AND p.deleted_at IS NULL`, [cid]);
  const items = r.rows.map(x => ({ pid: x.pid, name: x.name, price: N(x.price), img: (x.images || [])[0] || null, qty: x.qty, variant: x.variant, sellerId: x.seller_id, seller: x.seller || "", stock: x.stock }));
  const groups = {}; items.forEach(x => { (groups[x.sellerId] = groups[x.sellerId] || []).push(x); });
  return { items, groups };
}
router.get("/cart", requireAuth, asyncH(async (req, res) => {
  res.json({ success: true, data: await cartDetail(await cartId(req.user.id)) });
}));
router.post("/cart/add", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ pid: z.string().uuid(), qty: z.coerce.number().int().min(1).max(99).default(1), variant: z.string().max(200).optional().default("") }).parse(req.body);
  const p = (await db.query("SELECT * FROM products WHERE id=$1 AND deleted_at IS NULL", [s.pid])).rows[0];
  if (!p || p.status !== "published") throw bad(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (p.stock < s.qty) throw bad(400, "INSUFFICIENT_STOCK", "Not enough stock");
  const cid = await cartId(req.user.id, true);
  await db.query(`INSERT INTO cart_items(cart_id,product_id,variant,qty) VALUES($1,$2,$3,$4)
    ON CONFLICT(cart_id,product_id,variant) DO UPDATE SET qty=LEAST(99,cart_items.qty+EXCLUDED.qty)`, [cid, s.pid, s.variant, s.qty]);
  const d = await cartDetail(cid);
  res.json({ success: true, data: { count: d.items.reduce((a, x) => a + x.qty, 0) } });
}));
router.patch("/cart/qty", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ pid: z.string().uuid(), variant: z.string().optional().default(""), qty: z.coerce.number().int().min(1).max(99) }).parse(req.body);
  const cid = await cartId(req.user.id); if (!cid) throw bad(404, "NOT_IN_CART", "Not in cart");
  const p = (await db.query("SELECT stock FROM products WHERE id=$1", [s.pid])).rows[0];
  if (p && p.stock < s.qty) throw bad(400, "INSUFFICIENT_STOCK", "Not enough stock");
  const r = await db.query("UPDATE cart_items SET qty=$1 WHERE cart_id=$2 AND product_id=$3 AND variant=$4", [s.qty, cid, s.pid, s.variant]);
  if (!r.rowCount) throw bad(404, "NOT_IN_CART", "Not in cart");
  res.json({ success: true, data: { ok: true } });
}));
router.delete("/cart/item", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ pid: z.string().uuid(), variant: z.string().optional().default("") }).parse(req.body);
  const cid = await cartId(req.user.id);
  if (cid) await db.query("DELETE FROM cart_items WHERE cart_id=$1 AND product_id=$2 AND variant=$3", [cid, s.pid, s.variant]);
  res.json({ success: true, data: { ok: true } });
}));
router.post("/cart/merge", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ items: z.array(z.object({ pid: z.string().uuid(), qty: z.coerce.number().int().min(1).max(99), variant: z.string().max(200).optional().default("") })).max(100) }).parse(req.body);
  const cid = await cartId(req.user.id, true);
  for (const it of s.items) {
    const p = (await db.query("SELECT stock,status FROM products WHERE id=$1 AND deleted_at IS NULL", [it.pid])).rows[0];
    if (!p || p.status !== "published") continue;
    await db.query(`INSERT INTO cart_items(cart_id,product_id,variant,qty) VALUES($1,$2,$3,$4)
      ON CONFLICT(cart_id,product_id,variant) DO UPDATE SET qty=LEAST(99,cart_items.qty+EXCLUDED.qty)`, [cid, it.pid, it.variant || "", Math.min(it.qty, p.stock || 1)]);
  }
  res.json({ success: true, data: await cartDetail(cid) });
}));
router.delete("/cart", requireAuth, asyncH(async (req, res) => {
  const cid = await cartId(req.user.id);
  if (cid) await db.query("DELETE FROM cart_items WHERE cart_id=$1", [cid]);
  res.json({ success: true, data: { ok: true } });
}));
/* wishlist */
router.get("/wishlist", requireAuth, asyncH(async (req, res) => {
  const r = await db.query("SELECT p.* FROM wishlists w JOIN products p ON p.id=w.product_id WHERE w.user_id=$1 AND p.status='published' AND p.deleted_at IS NULL", [req.user.id]);
  res.json({ success: true, data: r.rows.map(prodOut) });
}));
router.post("/wishlist/toggle", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ pid: z.string().uuid() }).parse(req.body);
  const ex = (await db.query("SELECT 1 FROM wishlists WHERE user_id=$1 AND product_id=$2", [req.user.id, s.pid])).rows[0];
  if (ex) { await db.query("DELETE FROM wishlists WHERE user_id=$1 AND product_id=$2", [req.user.id, s.pid]); return res.json({ success: true, data: { on: false } }); }
  await db.query("INSERT INTO wishlists(user_id,product_id) VALUES($1,$2)", [req.user.id, s.pid]);
  res.json({ success: true, data: { on: true } });
}));
/* addresses */
router.get("/addresses", requireAuth, asyncH(async (req, res) => {
  const r = await db.query("SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC,created_at", [req.user.id]);
  res.json({ success: true, data: r.rows });
}));
router.post("/addresses", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ id: z.string().uuid().optional(), label: z.string().min(1).max(60), city: z.string().min(1).max(80), street: z.string().min(1).max(200), zip: z.string().max(20).optional().default(""), phone: z.string().max(24).optional().default(""), isDefault: z.boolean().optional().default(false) }).parse(req.body);
  if (s.id) {
    const o = (await db.query("SELECT * FROM addresses WHERE id=$1", [s.id])).rows[0];
    if (!o || o.user_id !== req.user.id) throw bad(404, "NOT_FOUND", "Address not found");
    if (s.isDefault) await db.query("UPDATE addresses SET is_default=false WHERE user_id=$1", [req.user.id]);
    const r = (await db.query("UPDATE addresses SET label=$1,city=$2,street=$3,zip=$4,phone=$5,is_default=$6 WHERE id=$7 RETURNING *", [s.label, s.city, s.street, s.zip, s.phone, s.isDefault, s.id])).rows[0];
    return res.json({ success: true, data: r });
  }
  if (s.isDefault) await db.query("UPDATE addresses SET is_default=false WHERE user_id=$1", [req.user.id]);
  const r = (await db.query("INSERT INTO addresses(user_id,label,city,street,zip,phone,is_default) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *", [req.user.id, s.label, s.city, s.street, s.zip, s.phone, s.isDefault])).rows[0];
  res.status(201).json({ success: true, data: r });
}));
router.delete("/addresses/:id", requireAuth, asyncH(async (req, res) => {
  const o = (await db.query("SELECT * FROM addresses WHERE id=$1", [req.params.id])).rows[0];
  if (!o || o.user_id !== req.user.id) throw bad(404, "NOT_FOUND", "Address not found");
  await db.query("DELETE FROM addresses WHERE id=$1", [req.params.id]);
  res.json({ success: true, data: { ok: true } });
}));
module.exports = router;
module.exports.cartDetail = cartDetail;
module.exports.cartId = cartId;
