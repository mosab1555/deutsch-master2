"use strict";
// CMS (homepage sections/heroes/banners), themes, shipping methods, site settings,
// seller store profile, Stripe webhook (verified), seller analytics.
const { z } = require("zod");
const db = require("../db");
const { bad, asyncH, clean } = require("../utils");
const { requireAuth, requireRole } = require("../middleware/auth");
const { audit } = require("./auth");
const { verifyWebhook } = require("../payments");
const { sendMail } = require("../mail");
const router = require("express").Router();
const N = db.num;
/* ---------- public CMS ---------- */
router.get("/home", asyncH(async (_req, res) => {
  const [sec, heroes, banners] = await Promise.all([
    db.query("SELECT * FROM homepage_sections ORDER BY sort_order"),
    db.query("SELECT * FROM homepage_heroes WHERE is_on ORDER BY sort_order"),
    db.query("SELECT * FROM homepage_banners WHERE is_on ORDER BY sort_order"),
  ]);
  res.json({ success: true, data: {
    sections: sec.rows.map(s => ({ id: s.id, type: s.type, title: s.title, on: s.is_on, order: s.sort_order })),
    heroes: heroes.rows.map(h => ({ id: h.id, title: h.title, sub: h.sub, cta: h.cta, link: h.link, art: h.art, on: h.is_on, order: h.sort_order })),
    banners: banners.rows.map(b => ({ id: b.id, title: b.title, sub: b.sub, cta: b.cta, link: b.link, g: b.grad, on: b.is_on })),
  } });
}));
router.get("/settings", asyncH(async (_req, res) => {
  const r = await db.query("SELECT v FROM site_settings WHERE k='settings'");
  const st = (r.rows[0] && r.rows[0].v) || {};
  const pub = { storeName: st.storeName, logoText: st.logoText, currency: st.currency, taxRate: st.taxRate, shipMethods: st.shipMethods,
    langs: st.langs, defaultLang: st.defaultLang, seo: st.seo, social: st.social, footerAbout: st.footerAbout,
    announcements: st.announcements, defaultTheme: st.defaultTheme };
  res.json({ success: true, data: pub });
}));
router.get("/shipping/methods", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM shipping_methods WHERE active ORDER BY sort_order");
  res.json({ success: true, data: r.rows.map(m => ({ id: m.id, name: m.name, fee: N(m.fee), eta: m.eta, minFree: m.min_free == null ? null : N(m.min_free) })) });
}));
/* ---------- admin CMS ---------- */
router.get("/home/all", requireAuth, requireRole("admin"), asyncH(async (_req, res) => {
  const [sec, heroes, banners] = await Promise.all([
    db.query("SELECT * FROM homepage_sections ORDER BY sort_order"),
    db.query("SELECT * FROM homepage_heroes ORDER BY sort_order"),
    db.query("SELECT * FROM homepage_banners ORDER BY sort_order"),
  ]);
  res.json({ success: true, data: { sections: sec.rows, heroes: heroes.rows, banners: banners.rows } });
}));
router.post("/home/sections", requireAuth, requireRole("admin"), asyncH(async (req, res) => {
  const s = z.object({ sections: z.array(z.object({ id: z.string(), type: z.string().max(30), title: z.string().max(120).default(""), on: z.boolean().default(true), order: z.number().int().default(0) })) }).parse(req.body);
  for (const x of s.sections) await db.query("INSERT INTO homepage_sections(id,type,title,is_on,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET title=$3,is_on=$4,sort_order=$5", [x.id, x.type, clean(x.title || ""), x.on, x.order]);
  await audit(req.user.id, "update homepage sections", "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
router.post("/home/heroes", requireAuth, requireRole("admin"), asyncH(async (req, res) => {
  const s = z.object({ heroes: z.array(z.object({ id: z.string().uuid().optional(), title: z.string().min(1).max(160), sub: z.string().max(300).default(""), cta: z.string().max(60).default(""), link: z.string().max(300).default(""), art: z.string().max(8).default(""), image_url: z.string().max(500).default(""), on: z.boolean().default(true), order: z.number().int().default(0) })) }).parse(req.body);
  const keep = [];
  for (const h of s.heroes) {
    if (h.id) { await db.query("UPDATE homepage_heroes SET title=$1,sub=$2,cta=$3,link=$4,art=$5,image_url=$6,is_on=$7,sort_order=$8 WHERE id=$9", [clean(h.title), clean(h.sub), clean(h.cta), h.link, h.art, h.image_url || "", h.on, h.order, h.id]); keep.push(h.id); }
    else { const r = (await db.query("INSERT INTO homepage_heroes(title,sub,cta,link,art,image_url,is_on,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [clean(h.title), clean(h.sub), clean(h.cta), h.link, h.art, h.image_url || "", h.on, h.order])).rows[0]; keep.push(r.id); }
  }
  if (keep.length) await db.query("DELETE FROM homepage_heroes WHERE id <> ALL($1)", [keep]);
  await audit(req.user.id, "update heroes", "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
router.post("/home/banners", requireAuth, requireRole("admin"), asyncH(async (req, res) => {
  const s = z.object({ banners: z.array(z.object({ id: z.string().uuid().optional(), title: z.string().min(1).max(160), sub: z.string().max(300).default(""), cta: z.string().max(60).default(""), link: z.string().max(300).default(""), image_url: z.string().max(500).default(""), g: z.number().int().min(0).max(20).default(0), on: z.boolean().default(true) })) }).parse(req.body);
  const keep = [];
  for (const [idx, b] of s.banners.entries()) {
    if (b.id) { await db.query("UPDATE homepage_banners SET title=$1,sub=$2,cta=$3,link=$4,image_url=$5,grad=$6,is_on=$7,sort_order=$8 WHERE id=$9", [clean(b.title), clean(b.sub), clean(b.cta), b.link, b.image_url || "", b.g, b.on, idx, b.id]); keep.push(b.id); }
    else { const r = (await db.query("INSERT INTO homepage_banners(title,sub,cta,link,image_url,grad,is_on,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [clean(b.title), clean(b.sub), clean(b.cta), b.link, b.image_url || "", b.g, b.on, idx])).rows[0]; keep.push(r.id); }
  }
  if (keep.length) await db.query("DELETE FROM homepage_banners WHERE id <> ALL($1)", [keep]);
  await audit(req.user.id, "update banners", "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
/* themes */
router.get("/themes", asyncH(async (_req, res) => {
  const r = await db.query("SELECT * FROM themes WHERE is_global ORDER BY created_at");
  res.json({ success: true, data: r.rows });
}));
router.get("/themes/mine", requireAuth, asyncH(async (req, res) => {
  const r = await db.query("SELECT * FROM themes WHERE user_id=$1 ORDER BY created_at", [req.user.id]);
  res.json({ success: true, data: r.rows });
}));
router.post("/themes", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ id: z.string().uuid().optional(), name: z.string().min(1).max(40), tokens: z.any(), mode: z.enum(["light", "dark", "system"]).default("dark") }).parse(req.body);
  if (s.id) {
    const o = (await db.query("SELECT * FROM themes WHERE id=$1", [s.id])).rows[0];
    if (!o) throw bad(404, "NOT_FOUND", "Theme not found");
    if (req.user.role !== "admin" && o.user_id !== req.user.id) throw bad(403, "FORBIDDEN", "Forbidden");
    await db.query("UPDATE themes SET name=$1,tokens=$2,mode=$3 WHERE id=$4", [clean(s.name), JSON.stringify(s.tokens), s.mode, s.id]);
    return res.json({ success: true, data: { id: s.id } });
  }
  const r = (await db.query("INSERT INTO themes(user_id,name,tokens,mode,is_global) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [req.user.role === "admin" ? null : req.user.id, clean(s.name), JSON.stringify(s.tokens), s.mode, req.user.role === "admin"])).rows[0];
  await audit(req.user.id, "save theme " + s.name, r.id, req.ip);
  res.status(201).json({ success: true, data: r });
}));
router.delete("/themes/:id", requireAuth, asyncH(async (req, res) => {
  const o = (await db.query("SELECT * FROM themes WHERE id=$1", [req.params.id])).rows[0];
  if (!o) throw bad(404, "NOT_FOUND", "Theme not found");
  if (req.user.role !== "admin" && o.user_id !== req.user.id) throw bad(403, "FORBIDDEN", "Forbidden");
  await db.query("DELETE FROM themes WHERE id=$1", [o.id]);
  res.json({ success: true, data: { ok: true } });
}));
/* admin settings + shipping methods + secrets */
router.get("/settings/all", requireAuth, requireRole("admin"), asyncH(async (_req, res) => {
  const r = await db.query("SELECT v FROM site_settings WHERE k='settings'");
  res.json({ success: true, data: (r.rows[0] && r.rows[0].v) || {} });
}));
router.post("/settings", requireAuth, requireRole("admin"), asyncH(async (req, res) => {
  const cur = (await db.query("SELECT v FROM site_settings WHERE k='settings'")).rows[0];
  const merged = { ...((cur && cur.v) || {}), ...req.body };
  await db.query("INSERT INTO site_settings(k,v) VALUES('settings',$1) ON CONFLICT(k) DO UPDATE SET v=$1,updated_at=now()", [JSON.stringify(merged)]);
  await db.query("DELETE FROM shipping_methods");
  for (const [idx, m] of ((merged.shipMethods || [])).entries()) {
    if (!m || !m.id) continue;
    await db.query("INSERT INTO shipping_methods(id,name,fee,eta,min_free,active,sort_order) VALUES($1,$2,$3,$4,$5,TRUE,$6) ON CONFLICT(id) DO UPDATE SET name=$2,fee=$3,eta=$4,min_free=$5,sort_order=$6",
      [String(m.id), String(m.name || m.id), Number(m.fee || 0), String(m.eta || ""), m.minFree == null ? null : Number(m.minFree), idx]);
  }
  await audit(req.user.id, "update settings", "", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
router.post("/secrets", requireAuth, requireRole("admin"), asyncH(async (req, res) => {
  const s = z.object({ key: z.string().regex(/^[A-Z_]{3,40}$/), value: z.string().max(500) }).parse(req.body);
  const cur = (await db.query("SELECT v FROM site_settings WHERE k='secrets'")).rows[0];
  const v = { ...((cur && cur.v) || {}), [s.key]: s.value };
  await db.query("INSERT INTO site_settings(k,v) VALUES('secrets',$1) ON CONFLICT(k) DO UPDATE SET v=$1", [JSON.stringify(v)]);
  await audit(req.user.id, "set secret " + s.key, "***", req.ip);
  res.json({ success: true, data: { ok: true } });
}));
/* ---------- seller store ---------- */
router.get("/store/mine", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const s = (await db.query("SELECT * FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
  res.json({ success: true, data: s || null });
}));
router.patch("/store/mine", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const s = z.object({ storeName: z.string().min(2).max(120).optional(), desc: z.string().max(1000).optional(), contact: z.string().max(200).optional(), logo: z.any().optional(), banner: z.any().optional() }).parse(req.body);
  const st = (await db.query("SELECT * FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
  if (!st) throw bad(404, "NO_STORE", "No store");
  const sets = [], v = []; let i = 1;
  if (s.storeName !== undefined) { sets.push(`store_name=$${i++}`); v.push(clean(s.storeName)); }
  if (s.desc !== undefined) { sets.push(`description=$${i++}`); v.push(clean(s.desc)); }
  if (s.contact !== undefined) { sets.push(`contact=$${i++}`); v.push(clean(s.contact)); }
  if (s.logo !== undefined) { sets.push(`logo=$${i++}`); v.push(JSON.stringify(s.logo)); }
  if (s.banner !== undefined) { sets.push(`banner=$${i++}`); v.push(JSON.stringify(s.banner)); }
  if (sets.length) { v.push(st.id); await db.query(`UPDATE sellers SET ${sets.join(",")},updated_at=now() WHERE id=$${i}`, v); }
  await audit(req.user.id, "update store", st.id, req.ip);
  res.json({ success: true, data: (await db.query("SELECT * FROM sellers WHERE id=$1", [st.id])).rows[0] });
}));
router.get("/store/stats", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  const st = req.user.role === "admin" ? null : (await db.query("SELECT id FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
  const sid = st && st.id;
  const orders = sid ? (await db.query("SELECT o.* FROM orders o JOIN seller_orders so ON so.order_id=o.id WHERE so.seller_id=$1", [sid])).rows
    : (await db.query("SELECT * FROM orders")).rows;
  let revenue = 0, units = 0;
  for (const o of orders) {
    const items = sid ? (await db.query("SELECT oi.price,oi.qty FROM order_items oi JOIN seller_orders so ON so.id=oi.seller_order_id WHERE oi.order_id=$1 AND so.seller_id=$2", [o.id, sid])).rows
      : (await db.query("SELECT price,qty FROM order_items WHERE order_id=$1", [o.id])).rows;
    items.forEach(x => { revenue += N(x.price) * x.qty; units += x.qty; });
  }
  const prods = sid ? (await db.query("SELECT * FROM products WHERE seller_id=$1 AND deleted_at IS NULL", [sid])).rows
    : (await db.query("SELECT * FROM products WHERE deleted_at IS NULL")).rows;
  const day = {};
  for (const o of orders) {
    const k = new Date(o.created_at).toISOString().slice(0, 10);
    const items = sid ? (await db.query("SELECT oi.price,oi.qty FROM order_items oi JOIN seller_orders so ON so.id=oi.seller_order_id WHERE oi.order_id=$1 AND so.seller_id=$2", [o.id, sid])).rows
      : (await db.query("SELECT price,qty FROM order_items WHERE order_id=$1", [o.id])).rows;
    items.forEach(x => { day[k] = (day[k] || 0) + N(x.price) * x.qty; });
  }
  const byDay = [...Array(7)].map((_, i2) => { const d = new Date(); d.setDate(d.getDate() - (6 - i2)); const k = d.toISOString().slice(0, 10); return { k: k.slice(5), v: day[k] || 0 }; });
  res.json({ success: true, data: { revenue, units, orders: orders.length,
    pending: sid ? (await db.query("SELECT count(*) c FROM seller_orders WHERE seller_id=$1 AND status='pending'", [sid])).rows[0].c - 0 : 0,
    products: prods.length, lowStock: prods.filter(p => p.stock < 10).length,
    top: prods.sort((a, b) => b.sales - a.sales).slice(0, 5), byDay, byMonth: [] } });
}));
/* ---------- seller apply: customer -> seller + pending store ---------- */
router.post("/store/apply", requireAuth, asyncH(async (req, res) => {
  const s = z.object({ storeName: z.string().min(2).max(120).optional(), desc: z.string().max(1000).optional().default("") }).parse(req.body);
  if (req.user.role === "admin") throw bad(400, "IS_ADMIN", "Admins don't need stores");
  if (req.user.role === "customer") await db.query("UPDATE users SET role='seller' WHERE id=$1", [req.user.id]);
  let st = (await db.query("SELECT * FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
  if (!st) {
    const me = (await db.query("SELECT name FROM users WHERE id=$1", [req.user.id])).rows[0];
    const name = s.storeName || (me.name + "'s Store");
    st = (await db.query("INSERT INTO sellers(user_id,store_name,slug,logo,banner,description,status) VALUES($1,$2,$3,$4,$5,$6,'pending') RETURNING *",
      [req.user.id, clean(name), "store-" + req.user.id.slice(0, 8), JSON.stringify({ t: "g", g: 0, em: "🏪" }), JSON.stringify({ t: "g", g: 3, em: "🏪" }), clean(s.desc || "")])).rows[0];
  } else {
    await db.query("UPDATE sellers SET store_name=COALESCE($1,store_name),description=$2,updated_at=now() WHERE id=$3", [s.storeName ? clean(s.storeName) : null, clean(s.desc || st.description || ""), st.id]);
    st = (await db.query("SELECT * FROM sellers WHERE id=$1", [st.id])).rows[0];
  }
  await audit(req.user.id, "seller apply", st.id, req.ip);
  res.json({ success: true, data: { store: st, role: "seller" } });
}));
/* ---------- seller's own coupons ---------- */
router.get("/coupons/mine", requireAuth, requireRole("seller", "admin"), asyncH(async (req, res) => {
  if (req.user.role === "admin") { const r = await db.query("SELECT * FROM coupons ORDER BY created_at DESC"); return res.json({ success: true, data: r.rows }); }
  const st = (await db.query("SELECT id FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
  if (!st) return res.json({ success: true, data: [] });
  const r = await db.query("SELECT * FROM coupons WHERE scope=$1 ORDER BY created_at DESC", [st.id]);
  res.json({ success: true, data: r.rows });
}));
router.post("/coupons/mine", requireAuth, requireRole("seller"), asyncH(async (req, res) => {
  const s = z.object({ code: z.string().min(2).max(30), type: z.enum(["percent", "fixed"]).default("percent"), value: z.coerce.number().min(0).max(100000), minOrder: z.coerce.number().min(0).optional().default(0) }).parse(req.body);
  const st = (await db.query("SELECT id FROM sellers WHERE user_id=$1", [req.user.id])).rows[0];
  if (!st) throw bad(400, "NO_STORE", "No store");
  await db.query("INSERT INTO coupons(code,type,value,min_order,scope) VALUES($1,$2,$3,$4,$5)", [s.code.toUpperCase().trim(), s.type, s.value, s.minOrder, st.id]);
  await audit(req.user.id, "seller coupon " + s.code, st.id, req.ip);
  res.status(201).json({ success: true, data: { ok: true } });
}));
/* ---------- Stripe webhook (signature-verified) ---------- */
router.post("/webhooks/stripe", asyncH(async (req, res) => {
  const event = verifyWebhook(req.body, req.headers["stripe-signature"]);
  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    const pay = (await db.query("SELECT * FROM payments WHERE provider_ref=$1", [pi.id])).rows[0];
    if (pay) {
      const ok = event.type === "payment_intent.succeeded";
      await db.query("UPDATE payments SET status=$1,raw=$2,updated_at=now() WHERE id=$3", [ok ? "paid" : "failed", JSON.stringify(pi), pay.id]);
      await db.query("INSERT INTO payment_transactions(payment_id,type,amount,status,raw) VALUES($1,$2,$3,$4,$5)", [pay.id, "webhook", N(pi.amount) / 100, ok ? "paid" : "failed", JSON.stringify({ type: event.type })]);
      await db.query("UPDATE orders SET pay_status=$1,updated_at=now() WHERE id=$2", [ok ? "paid" : "failed", pay.order_id]);
    }
  }
  res.json({ received: true });
}));
router.post("/payments/:orderId/confirm-mock", requireAuth, asyncH(async (req, res) => {
  // Development helper ONLY ( STRIPE_MOCK=true ): simulates provider callback server-side.
  if (!require("../config").stripeMock) throw bad(403, "FORBIDDEN", "Mock disabled");
  const pay = (await db.query("SELECT * FROM payments WHERE order_id=$1", [req.params.orderId])).rows[0];
  if (!pay) throw bad(404, "NOT_FOUND", "Payment not found");
  await db.query("UPDATE payments SET status='paid',provider='mock',updated_at=now() WHERE id=$1", [pay.id]);
  await db.query("UPDATE orders SET pay_status='paid' WHERE id=$1", [pay.order_id]);
  res.json({ success: true, data: { ok: true } });
}));
module.exports = router;
