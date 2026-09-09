"use strict";
// Catalog: categories, brands, products (public read; seller/admin write with approval flow).
const { z } = require("zod");
const db = require("../db");
const { bad, asyncH, clean, page } = require("../utils");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const { audit } = require("./auth");
const router = require("express").Router();
const N = db.num;
const prodOut = p => ({ ...p, price: N(p.price), oldPrice: p.old_price == null ? null : N(p.old_price), old_price: undefined,
  images: p.images || [], variants: p.variants || [], stock: Number(p.stock), sales: Number(p.sales), reviewsCount: Number(p.reviews_count), reviews_count: undefined });
/* ---------- public ---------- */
router.get("/categories", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM categories WHERE active ORDER BY sort_order");
  res.json({ success: true, data: r.rows });
}));
router.get("/brands", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM brands WHERE active ORDER BY name");
  res.json({ success: true, data: r.rows });
}));
router.get("/sellers", asyncH(async (_req, res) => {
  const r = await db.query("SELECT id,store_name,slug,logo,banner,description,rating FROM sellers WHERE status='approved' ORDER BY rating DESC");
  res.json({ success: true, data: r.rows });
}));
router.get("/sellers/:id", asyncH(async (req, res) => {
  const s = (await db.query("SELECT id,store_name,slug,logo,banner,description,rating FROM sellers WHERE id=$1 AND status='approved'", [req.params.id])).rows[0];
  if (!s) throw bad(404, "NOT_FOUND", "Store not found");
  res.json({ success: true, data: s });
}));
router.get("/products", optionalAuth, asyncH(async (req, res) => {
  const q = req.query, { page: pg, per } = page(q);
  const w = ["p.status='published'", "p.deleted_at IS NULL"], v = []; let i = 1;
  if (q.sellerId) { w.push(`p.seller_id=$${i++}`); v.push(q.sellerId); }
  if (q.categoryId) { w.push(`(p.category_id=$${i} OR p.category_id IN (SELECT id FROM categories WHERE parent_id=$${i}))`); i++; v.push(q.categoryId); }
  if (q.brandId) { w.push(`p.brand_id=$${i++}`); v.push(q.brandId); }
  if (q.min) { w.push(`p.price>=$${i++}`); v.push(Number(q.min)); }
  if (q.max) { w.push(`p.price<=$${i++}`); v.push(Number(q.max)); }
  if (q.minRating) { w.push(`p.rating>=$${i++}`); v.push(Number(q.minRating)); }
  if (q.onSale) w.push("p.old_price>p.price");
  if (q.inStock) w.push("p.stock>0");
  if (q.ids) { const ids = String(q.ids).split(",").filter(Boolean); w.push(`p.id = ANY($${i++})`); v.push(ids); }
  if (q.search) { w.push(`(p.name ILIKE $${i} OR p.description ILIKE $${i} OR p.sku ILIKE $${i})`); i++; v.push(`%${q.search}%`); }
  const sort = { priceAsc: "p.price ASC", priceDesc: "p.price DESC", rating: "p.rating DESC", new: "p.created_at DESC" }[q.sort] || "p.sales DESC";
  const total = (await db.query(`SELECT count(*) c FROM products p WHERE ${w.join(" AND ")}`, v)).rows[0].c;
  const r = await db.query(`SELECT p.*,s.store_name AS seller_name FROM products p LEFT JOIN sellers s ON s.id=p.seller_id WHERE ${w.join(" AND ")} ORDER BY ${sort} LIMIT $${i++} OFFSET $${i++}`, [...v, per, (pg - 1) * per]);
  res.json({ success: true, data: { items: r.rows.map(prodOut), total: Number(total), page: pg, pages: Math.max(1, Math.ceil(total / per)), per } });
}));
router.get("/products/:id", asyncH(async (req, res) => {
  const p = (await db.query("SELECT p.*,s.store_name AS seller_name,s.rating AS seller_rating FROM products p LEFT JOIN sellers s ON s.id=p.seller_id WHERE p.id=$1 AND p.deleted_at IS NULL", [req.params.id])).rows[0];
  if (!p || p.status !== "published") throw bad(404, "PRODUCT_NOT_FOUND", "Product not found");
  res.json({ success: true, data: prodOut(p) });
}));
router.get("/search", asyncH(async (req, res) => {
  const s = `%${String(req.query.q || "").slice(0, 80)}%`;
  if (!req.query.q) return res.json({ success: true, data: { products: [], cats: [], brands: [], sellers: [] } });
  const [ps, cs, bs, ss] = await Promise.all([
    db.query("SELECT id,name,price,images FROM products WHERE status='published' AND deleted_at IS NULL AND (name ILIKE $1 OR sku ILIKE $1) LIMIT 6", [s]),
    db.query("SELECT * FROM categories WHERE (name_ar ILIKE $1 OR name_en ILIKE $1 OR name_de ILIKE $1) AND active LIMIT 4", [s]),
    db.query("SELECT * FROM brands WHERE name ILIKE $1 AND active LIMIT 4", [s]),
    db.query("SELECT id,store_name FROM sellers WHERE store_name ILIKE $1 AND status='approved' LIMIT 4", [s]),
  ]);
  res.json({ success: true, data: { products: ps.rows.map(prodOut), cats: cs.rows, brands: bs.rows, sellers: ss.rows } });
}));
router.get("/flash", asyncH(async (_req, res) => {
  const f = (await db.query("SELECT * FROM promotions WHERE type='flash' AND status='active' AND end_at>now() ORDER BY created_at DESC LIMIT 1")).rows[0];
  if (!f) return res.json({ success: true, data: null });
  const ids = f.product_ids || [];
  const ps = ids.length ? (await db.query("SELECT * FROM products WHERE id = ANY($1) AND status='published' AND deleted_at IS NULL", [ids])).rows : [];
  res.json({ success: true, data: { ...f, _products: ps.map(prodOut) } });
}));
/* ---------- seller/admin mutations ---------- */
const ownSeller = async uid => (await db.query("SELECT * FROM sellers WHERE user_id=$1", [uid])).rows[0];
const pSchema = z.object({ name: z.string().min(1).max(160), desc: z.string().max(5000).optional().default(""), price: z.coerce.number().positive().max(1e9),
  oldPrice: z.coerce.number().positive().max(1e9).nullable().optional(), stock: z.coerce.number().int().min(0).max(1e9),
  sku: z.string().max(40).optional().default(""), categoryId: z.string().uuid().nullable().optional(), brandId: z.string().uuid().nullable().optional(),
  images: z.array(z.any()).max(8).optional().default([]), video: z.string().max(500).optional().default(""), variants: z.array(z.any()).optional().default([]), sellerId: z.string().uuid().optional() });
router.get("/mine/products/:id", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const p = (await db.query("SELECT * FROM products WHERE id=$1 AND deleted_at IS NULL", [req.params.id])).rows[0];
  if (!p) throw bad(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (req.user.role === "seller") { const s = await ownSeller(req.user.id); if (!s || p.seller_id !== s.id) throw bad(403, "FORBIDDEN", "Forbidden"); }
  res.json({ success: true, data: prodOut(p) });
}));
router.get("/promos/active", asyncH(async (_req, res) => {
  const r = await db.query("SELECT id,title,discount,end_at FROM promotions WHERE status='active' AND end_at>now() ORDER BY created_at DESC LIMIT 10");
  res.json({ success: true, data: r.rows });
}));
router.get("/mine/products", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  if (req.user.role === "admin") { const r = await db.query("SELECT * FROM products WHERE deleted_at IS NULL ORDER BY created_at DESC"); return res.json({ success: true, data: r.rows.map(prodOut) }); }
  const s = await ownSeller(req.user.id); if (!s) throw bad(400, "NO_STORE", "No store");
  const r = await db.query("SELECT * FROM products WHERE seller_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC", [s.id]);
  res.json({ success: true, data: r.rows.map(prodOut) });
}));
router.post("/products", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const s = pSchema.parse(req.body);
  let sellerId = s.sellerId;
  if (req.user.role === "seller") { const st = await ownSeller(req.user.id); if (!st) throw bad(400, "NO_STORE", "No store");
    if (st.status !== "approved") throw bad(403, "STORE_NOT_APPROVED", "Store not approved"); sellerId = st.id; }
  if (!sellerId) throw bad(400, "SELLER_REQUIRED", "Seller required");
  const p = (await db.query(`INSERT INTO products(seller_id,category_id,brand_id,name,description,price,old_price,stock,sku,images,video_url,variants,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [sellerId, s.categoryId || null, s.brandId || null, clean(s.name), clean(s.desc), s.price, s.oldPrice || null, s.stock,
     clean(s.sku) || ("SKU-" + Date.now().toString(36).toUpperCase()), JSON.stringify(s.images), clean(s.video || ""), JSON.stringify(s.variants),
     req.user.role === "admin" ? "published" : "pending"])).rows[0];
  await audit(req.user.id, "add product " + p.name, p.id, req.ip);
  res.status(201).json({ success: true, data: prodOut(p) });
}));
router.patch("/products/:id", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const old = (await db.query("SELECT * FROM products WHERE id=$1 AND deleted_at IS NULL", [req.params.id])).rows[0];
  if (!old) throw bad(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (req.user.role === "seller") { const st = await ownSeller(req.user.id); if (!st || old.seller_id !== st.id) throw bad(403, "FORBIDDEN", "Forbidden"); }
  const s = pSchema.partial().parse(req.body);
  const sets = [], v = []; let i = 1;
  const put = (col, val) => { sets.push(`${col}=$${i++}`); v.push(val); };
  if (s.name !== undefined) put("name", clean(s.name));
  if (s.desc !== undefined) put("description", clean(s.desc));
  if (s.price !== undefined) put("price", s.price);
  if (s.oldPrice !== undefined) put("old_price", s.oldPrice);
  if (s.stock !== undefined) put("stock", s.stock);
  if (s.sku !== undefined) put("sku", clean(s.sku));
  if (s.categoryId !== undefined) put("category_id", s.categoryId);
  if (s.brandId !== undefined) put("brand_id", s.brandId);
  if (s.images !== undefined) put("images", JSON.stringify(s.images));
  if (s.video !== undefined) put("video_url", clean(s.video || ""));
  if (s.variants !== undefined) put("variants", JSON.stringify(s.variants));
  if (req.user.role === "seller" && old.status === "published") put("status", "published");
  if (!sets.length) throw bad(400, "EMPTY", "Nothing to update");
  v.push(req.params.id);
  const p = (await db.query(`UPDATE products SET ${sets.join(",")},updated_at=now() WHERE id=$${i} RETURNING *`, v)).rows[0];
  await audit(req.user.id, "edit product " + p.name, p.id, req.ip);
  res.json({ success: true, data: prodOut(p) });
}));
router.delete("/products/:id", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const old = (await db.query("SELECT * FROM products WHERE id=$1 AND deleted_at IS NULL", [req.params.id])).rows[0];
  if (!old) throw bad(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (req.user.role === "seller") { const st = await ownSeller(req.user.id); if (!st || old.seller_id !== st.id) throw bad(403, "FORBIDDEN", "Forbidden"); }
  await db.query("UPDATE products SET deleted_at=now() WHERE id=$1", [req.params.id]);
  await audit(req.user.id, "delete product " + old.name, old.id, req.ip);
  res.json({ success: true, data: { ok: true } });
}));
router.post("/products/:id/status", requireAuth, requireRole("admin"), asyncH(async (req, res) => {
  const s = z.object({ status: z.enum(["published", "hidden", "pending"]), featured: z.boolean().optional() }).parse(req.body);
  const p = (await db.query("SELECT * FROM products WHERE id=$1 AND deleted_at IS NULL", [req.params.id])).rows[0];
  if (!p) throw bad(404, "PRODUCT_NOT_FOUND", "Product not found");
  await db.query("UPDATE products SET status=$1,featured=COALESCE($2,featured),updated_at=now() WHERE id=$3", [s.status, s.featured ?? null, req.params.id]);
  await audit(req.user.id, `product ${p.name} -> ${s.status}`, p.id, req.ip);
  res.json({ success: true, data: { ok: true } });
}));
module.exports = router;
module.exports.ownSeller = ownSeller;
module.exports.prodOut = prodOut;
