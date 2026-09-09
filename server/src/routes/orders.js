"use strict";
// Orders: server-computed totals (never trust frontend prices), transactional stock
// decrement with row locks (prevents overselling), parent order + per-seller orders.
const { z } = require("zod");
const db = require("../db");
const { bad, asyncH } = require("../utils");
const { requireAuth, requireRole } = require("../middleware/auth");
const { audit } = require("./auth");
const { cartDetail, cartId } = require("./shop");
const { createIntent } = require("../payments");
const { sendMail } = require("../mail");
const router = require("express").Router();
const N = db.num;
const { ORDER_STATUS: OST } = require("../../../shared/constants");
async function settings() {
  const r = await db.query("SELECT k,v FROM site_settings WHERE k IN ('settings')");
  try { return (r.rows[0] && r.rows[0].v) || {}; } catch (_) { return {}; }
}
async function coupon(code) {
  if (!code) return null;
  const c = (await db.query("SELECT * FROM coupons WHERE code=$1 AND active AND end_at>now() AND start_at<=now()", [String(code).toUpperCase().trim()])).rows[0];
  return c || null;
}
async function totals(items, couponCode, shipId, userId) {
  const st = await settings();
  const cp = await coupon(couponCode);
  let method = (st.shipMethods || []).find(m => m.id === shipId) || (st.shipMethods || [])[0] || { id: "std", fee: 5 };
  const sub = items.reduce((a, x) => a + N(x.price) * x.qty, 0);
  let fee = N(method.fee || 0);
  if (method.minFree && sub >= method.minFree) fee = 0;
  let eligible = items, cpEff = cp;
  if (cp && cp.scope && cp.scope !== "all") {
    eligible = items.filter(x => x.sellerId === cp.scope);
    if (!eligible.length) throw bad(400, "COUPON_NOT_APPLICABLE", "Coupon not applicable");
    const uses = userId ? (await db.query("SELECT 1 FROM coupon_uses WHERE coupon_id=$1 AND user_id=$2", [cp.id, userId])).rows[0] : null;
    if (uses && (cp.per_user || 1) <= 1) throw bad(400, "COUPON_USED", "Coupon already used");
    cpEff = { ...cp, min_order: 0 };
  }
  const esub = eligible.reduce((a, x) => a + N(x.price) * x.qty, 0);
  let disc = 0;
  if (cpEff && esub >= N(cpEff.min_order || 0)) {
    disc = cpEff.type === "percent" ? Math.min(esub * (N(cpEff.value) / 100), cpEff.max_disc == null ? Infinity : N(cpEff.max_disc)) : Math.min(N(cpEff.value), esub);
    if (cpEff.usage_limit && N(cpEff.used) >= cpEff.usage_limit) throw bad(400, "COUPON_EXPIRED", "Coupon exhausted");
  }
  const tax = sub * (N(st.taxRate || 0) / 100);
  return { sub, disc, ship: fee, tax, total: Math.max(0, sub - disc + fee + tax), coupon: cp, method };
}
router.get("/checkout/preview", requireAuth, asyncH(async (req, res) => {
  const d = await cartDetail(await cartId(req.user.id));
  if (!d.items.length) throw bad(400, "CART_EMPTY", "Cart is empty");
  const t = await totals(d.items, req.query.coupon, req.query.ship, req.user.id);
  res.json({ success: true, data: { items: d.items, groups: d.groups, coupon: t.coupon ? { code: t.coupon.code, type: t.coupon.type, value: N(t.coupon.value) } : null, sub: t.sub, disc: t.disc, ship: t.ship, tax: t.tax, total: t.total, method: t.method } });
}));
router.post("/checkout/place", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ addressId: z.string().uuid(), shipId: z.string().max(40), payMethod: z.enum(["cod", "card", "wallet"]), couponCode: z.string().max(40).optional().default(""), note: z.string().max(500).optional().default("") }).parse(req.body);
  const addr = (await db.query("SELECT * FROM addresses WHERE id=$1", [s.addressId])).rows[0];
  if (!addr || addr.user_id !== req.user.id) throw bad(400, "ADDRESS_REQUIRED", "Valid address required");
  const order = await db.tx(async c => {
    const cid = (await c.query("SELECT id FROM carts WHERE user_id=$1", [req.user.id])).rows[0];
    if (!cid) throw bad(400, "CART_EMPTY", "Cart is empty");
    const items = (await c.query(`SELECT ci.product_id AS pid,ci.variant,ci.qty,p.name,p.price,p.stock,p.status,p.seller_id
      FROM cart_items ci JOIN products p ON p.id=ci.product_id
      WHERE ci.cart_id=$1 AND p.deleted_at IS NULL FOR UPDATE OF p`, [cid.id])).rows;
    if (!items.length) throw bad(400, "CART_EMPTY", "Cart is empty");
    for (const it of items) {
      if (it.status !== "published") throw bad(400, "UNAVAILABLE", `Unavailable: ${it.name}`);
      if (it.stock < it.qty) throw bad(400, "INSUFFICIENT_STOCK", `Not enough stock: ${it.name}`);
    }
    const det = items.map(x => ({ pid: x.pid, name: x.name, price: N(x.price), qty: x.qty, variant: x.variant, sellerId: x.seller_id }));
    const t = await totals(det, s.couponCode, s.shipId, req.user.id);
    const code = "DM-" + Date.now().toString(36).toUpperCase();
    const o = (await c.query(`INSERT INTO orders(code,customer_id,subtotal,discount,shipping,tax,total,address,ship_method,pay_method,pay_status,status,note,timeline)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13) RETURNING *`,
      [code, req.user.id, t.sub, t.disc, t.ship, t.tax, t.total, JSON.stringify(addr), JSON.stringify(t.method), s.payMethod, s.payMethod === "cod" ? "pending" : "paid", s.note,
       JSON.stringify([{ s: "pending", at: new Date().toISOString(), by: req.user.id }])])).rows[0];
    const bySeller = {};
    det.forEach(x => { (bySeller[x.sellerId] = bySeller[x.sellerId] || []).push(x); });
    for (const [sid, list] of Object.entries(bySeller)) {
      const sub2 = list.reduce((a, x) => a + x.price * x.qty, 0);
      const so = (await c.query("INSERT INTO seller_orders(order_id,seller_id,status,subtotal) VALUES($1,$2,'pending',$3) RETURNING *", [o.id, sid, sub2])).rows[0];
      for (const x of list) await c.query("INSERT INTO order_items(order_id,seller_order_id,product_id,name,price,qty,variant) VALUES($1,$2,$3,$4,$5,$6,$7)", [o.id, so.id, x.pid, x.name, x.price, x.qty, x.variant]);
      for (const x of list) await c.query("UPDATE products SET stock=stock-$1,sales=sales+$1 WHERE id=$2", [x.qty, x.pid]);
    }
    if (t.coupon) {
      await c.query("UPDATE coupons SET used=used+1 WHERE id=$1", [t.coupon.id]);
      await c.query("INSERT INTO coupon_uses(coupon_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [t.coupon.id, req.user.id]);
    }
    const pay = await createIntent({ method: s.payMethod, amount: t.total, orderCode: code, orderId: o.id }).catch(e => { if (e.status === 503) return { provider: "mock-disabled", ref: "", mode: "off" }; throw e; });
    await c.query("INSERT INTO payments(order_id,method,status,amount,provider,provider_ref) VALUES($1,$2,$3,$4,$5,$6)",
      [o.id, s.payMethod, s.payMethod === "cod" ? "pending" : "paid", t.total, pay.provider, pay.ref || ""]);
    await c.query("DELETE FROM cart_items WHERE cart_id=$1", [cid.id]);
    await c.query("INSERT INTO tracking_events(order_id,status,message) VALUES($1,'pending','Order placed')", [o.id]);
    return { order: o, groups: Object.keys(bySeller), pay };
  });
  await audit(req.user.id, "place order " + order.order.code, order.order.id, req.ip);
  const me = (await db.query("SELECT email FROM users WHERE id=$1", [req.user.id])).rows[0];
  await db.query("INSERT INTO notifications(user_id,kind,data) VALUES($1,'order',$2)", [req.user.id, JSON.stringify({ code: order.order.code, total: N(order.order.total) })]);
  for (const sid of order.groups) {
    const sl = (await db.query("SELECT user_id,store_name FROM sellers WHERE id=$1", [sid])).rows[0];
    if (sl) await db.query("INSERT INTO notifications(user_id,kind,data) VALUES($1,'seller_order',$2)", [sl.user_id, JSON.stringify({ code: order.order.code, store: sl.store_name })]);
  }
  await sendMail(me && me.email, "order", order.order.code, { code: order.order.code, total: N(order.order.total) });
  res.status(201).json({ success: true, data: { id: order.order.id, code: order.order.code, total: N(order.order.total) } });
}));
const orderScope = async (uid, role, oid) => {
  const o = (await db.query("SELECT * FROM orders WHERE id=$1", [oid])).rows[0];
  if (!o) throw bad(404, "ORDER_NOT_FOUND", "Order not found");
  if (role === "admin") return { o, scope: "all" };
  if (role === "customer") { if (o.customer_id !== uid) throw bad(403, "FORBIDDEN", "Forbidden"); return { o, scope: "all" }; }
  const s = (await db.query("SELECT id FROM sellers WHERE user_id=$1", [uid])).rows[0];
  const link = s ? (await db.query("SELECT 1 FROM seller_orders WHERE order_id=$1 AND seller_id=$2", [oid, s.id])).rows[0] : null;
  if (!s || !link) throw bad(403, "FORBIDDEN", "Forbidden");
  return { o, scope: s.id };
};
router.get("/orders", requireAuth, asyncH(async (req, res) => {
  const r = await db.query("SELECT * FROM orders WHERE customer_id=$1 ORDER BY created_at DESC", [req.user.id]);
  res.json({ success: true, data: r.rows.map(o => ({ ...o, subtotal: N(o.subtotal), discount: N(o.discount), shipping: N(o.shipping), tax: N(o.tax), total: N(o.total) })) });
}));
router.get("/orders/all", requireAuth, requireRole("admin"), asyncH(async (_req, res) => {
  const r = await db.query("SELECT o.*,(SELECT COALESCE(sum(qty),0) FROM order_items WHERE order_id=o.id) AS qty_sum FROM orders o ORDER BY created_at DESC LIMIT 500");
  res.json({ success: true, data: r.rows.map(o => ({ ...o, qty_sum: Number(o.qty_sum) })) });
}));
router.get("/orders/seller", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  if (req.user.role === "admin") { const r = await db.query("SELECT o.*,(SELECT COALESCE(sum(qty),0) FROM order_items WHERE order_id=o.id) AS qty_sum FROM orders o ORDER BY created_at DESC LIMIT 500"); return res.json({ success: true, data: r.rows.map(o => ({ ...o, qty_sum: Number(o.qty_sum) })) }); }
  const s = (await db.query("SELECT id FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
  if (!s) return res.json({ success: true, data: [] });
  const r = await db.query(`SELECT o.*,(SELECT COALESCE(sum(qty),0) FROM order_items oi JOIN seller_orders so ON so.id=oi.seller_order_id WHERE oi.order_id=o.id AND so.seller_id=$1) AS qty_sum FROM orders o JOIN seller_orders so ON so.order_id=o.id WHERE so.seller_id=$1 ORDER BY o.created_at DESC`, [s.id]);
  const out = [];
  for (const o of r.rows) {
    const items = (await db.query("SELECT oi.*,so.seller_id FROM order_items oi JOIN seller_orders so ON so.id=oi.seller_order_id WHERE oi.order_id=$1 AND so.seller_id=$2", [o.id, s.id])).rows;
    out.push({ ...o, items });
  }
  res.json({ success: true, data: out });
}));
router.get("/orders/:id", requireAuth, asyncH(async (req, res) => {
  const { o, scope } = await orderScope(req.user.id, req.user.role, req.params.id);
  let items = (await db.query("SELECT oi.*,so.seller_id FROM order_items oi JOIN seller_orders so ON so.id=oi.seller_order_id WHERE oi.order_id=$1", [o.id])).rows;
  if (scope !== "all") items = items.filter(x => x.seller_id === scope);
  const groups = (await db.query("SELECT * FROM seller_orders WHERE order_id=$1", [o.id])).rows;
  const addr = (await db.query("SELECT * FROM addresses WHERE id=$1", [(o.address && o.address.id) || null])).rows[0] || o.address;
  res.json({ success: true, data: { ...o, items, groups: Object.fromEntries(groups.map(g2 => [g2.seller_id, g2])), _addr: addr } });
}));
router.post("/orders/:id/status", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ status: z.enum(OST), tracking: z.string().max(80).optional().default("") }).parse(req.body);
  const o = (await db.query("SELECT * FROM orders WHERE id=$1", [req.params.id])).rows[0];
  if (!o) throw bad(404, "ORDER_NOT_FOUND", "Order not found");
  if (req.user.role !== "seller" && req.user.role !== "admin" && req.user.role !== "customer") throw bad(403, "FORBIDDEN", "Forbidden");
  if (req.user.role === "customer") { // customers may only cancel their own pending orders (stock restored)
    if (o.customer_id !== req.user.id) throw bad(403, "FORBIDDEN", "Forbidden");
    if (s.status !== "cancelled" || o.status !== "pending") throw bad(403, "FORBIDDEN", "Only pending orders can be cancelled");
    await db.tx(async c => {
      const items = (await c.query("SELECT product_id,qty FROM order_items WHERE order_id=$1", [o.id])).rows;
      for (const it of items) if (it.product_id) await c.query("UPDATE products SET stock=stock+$1,sales=sales-$1 WHERE id=$2", [it.qty, it.product_id]);
      const tl = [...(o.timeline || []), { s: "cancelled", at: new Date().toISOString(), by: req.user.id, scope: "customer" }];
      await c.query("UPDATE orders SET status='cancelled',timeline=$1,updated_at=now() WHERE id=$2", [JSON.stringify(tl), o.id]);
      await c.query("UPDATE seller_orders SET status='cancelled' WHERE order_id=$1", [o.id]);
    });
    await audit(req.user.id, `order ${o.code} cancelled by customer`, o.id, req.ip);
    return res.json({ success: true, data: { ok: true, status: "cancelled" } });
  }
  if (req.user.role === "seller") {
    const sl = (await db.query("SELECT id FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
    const link = sl ? (await db.query("SELECT * FROM seller_orders WHERE order_id=$1 AND seller_id=$2", [o.id, sl.id])).rows[0] : null;
    if (!sl || !link) throw bad(403, "FORBIDDEN", "Forbidden");
    await db.query("UPDATE seller_orders SET status=$1,tracking=$2,updated_at=now() WHERE id=$3", [s.status, s.tracking, link.id]);
    const gs = (await db.query("SELECT status FROM seller_orders WHERE order_id=$1", [o.id])).rows.map(x => x.status);
    const agg = gs.every(x => x === "delivered") ? "delivered" : gs.every(x => x === "cancelled") ? "cancelled" : (gs.includes("shipped") || gs.includes("out_for_delivery")) ? "shipped" : s.status;
    const tl = [...(o.timeline || []), { s: agg, at: new Date().toISOString(), by: req.user.id, scope: sl.id }];
    await db.query("UPDATE orders SET status=$1,timeline=$2,updated_at=now() WHERE id=$3", [agg, JSON.stringify(tl), o.id]);
    await db.query("INSERT INTO tracking_events(order_id,seller_id,status,message) VALUES($1,$2,$3,$4)", [o.id, sl.id, s.status, s.tracking || ""]);
    await audit(req.user.id, `order ${o.code} -> ${s.status}`, sl.id, req.ip);
    await db.query("INSERT INTO notifications(user_id,kind,data) VALUES($1,'shipping',$2)", [o.customer_id, JSON.stringify({ code: o.code, status: agg })]);
    return res.json({ success: true, data: { ok: true, status: agg } });
  }
  const tl = [...(o.timeline || []), { s: s.status, at: new Date().toISOString(), by: req.user.id, scope: "all" }];
  await db.query("UPDATE orders SET status=$1,timeline=$2,updated_at=now() WHERE id=$3", [s.status, JSON.stringify(tl), o.id]);
  await db.query("UPDATE seller_orders SET status=$1,updated_at=now() WHERE order_id=$2", [s.status, o.id]);
  await audit(req.user.id, `order ${o.code} -> ${s.status}`, "all", req.ip);
  await db.query("INSERT INTO notifications(user_id,kind,data) VALUES($1,'shipping',$2)", [o.customer_id, JSON.stringify({ code: o.code, status: s.status })]);
  res.json({ success: true, data: { ok: true, status: s.status } });
}));
router.get("/track", requireAuth, asyncH(async (req, res) => {
  const code = String(req.query.code || "").trim();
  if (!code) throw bad(400, "CODE_REQUIRED", "Order code required");
  let o;
  if (req.user.role === "admin") o = (await db.query("SELECT * FROM orders WHERE lower(code)=lower($1)", [code])).rows[0];
  else o = (await db.query("SELECT * FROM orders WHERE lower(code)=lower($1) AND customer_id=$2", [code, req.user.id])).rows[0];
  if (!o) throw bad(404, "ORDER_NOT_FOUND", "Order not found");
  res.json({ success: true, data: o });
}));
module.exports = router;
module.exports.totals = totals;
