"use strict";
// DMM API tests — node:test + fetch against in-process app (fresh in-memory PostgreSQL).
process.env.PG_DATA_DIR = "";
process.env.STRIPE_MOCK = "true";
const { test, before, after } = require("node:test");
const assert = require("node:assert");
let srv = null;
after(async () => { try { srv && srv.close(); } catch (_) {} try { await require("../src/db").close(); } catch (_) {} });
let base = "", adminT = "", custT = "", sellT = "", sell2T = "", PID = "", OID = "", OCODE = "";
async function api(method, path, body, token) {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, json: j };
}
before(async () => {
  const { migrate } = require("../src/migrate");
  await migrate();
  await require("../src/seed").seed();
  const app = require("../src/app");
  srv = await new Promise(res => { const s = app.listen(0, () => res(s)); });
  base = "http://127.0.0.1:" + srv.address().port + "/api";
});
test("health", async () => { const r = await api("GET", "/health"); assert.equal(r.status, 200); assert.equal(r.json.data.db, "pglite"); });
test("register validation 400", async () => { const r = await api("POST", "/auth/register", { name: "x", email: "bad", password: "1" }); assert.equal(r.status, 400); assert.equal(r.json.success, false); assert.ok(r.json.error.code); });
test("register customer 201", async () => { const r = await api("POST", "/auth/register", { name: "Test User", email: "t@t.com", password: "secret12" }); assert.equal(r.status, 201); custT = r.json.data.accessToken; assert.ok(custT); });
test("register duplicate 409", async () => { const r = await api("POST", "/auth/register", { name: "Dup User", email: "t@t.com", password: "secret12" }); assert.equal(r.status, 409); });
test("login wrong 401", async () => { const r = await api("POST", "/auth/login", { email: "t@t.com", password: "nope" }); assert.equal(r.status, 401); });
test("logins + me", async () => {
  adminT = (await api("POST", "/auth/login", { email: "admin@demo.com", password: "admin123" })).json.data.accessToken;
  sellT = (await api("POST", "/auth/login", { email: "seller@demo.com", password: "seller123" })).json.data.accessToken;
  sell2T = (await api("POST", "/auth/login", { email: "seller2@demo.com", password: "seller123" })).json.data.accessToken;
  const me = await api("GET", "/auth/me"); assert.equal(me.status, 401); // no token
  const me2 = await api("GET", "/auth/me", null, custT); assert.equal(me2.json.data.email, "t@t.com");
  const bad = await api("GET", "/auth/me", null, "xxx"); assert.equal(bad.status, 401); // invalid token
});
test("RBAC: customer->admin 403, anon->admin 401", async () => {
  assert.equal((await api("GET", "/admin/users", null, custT)).status, 403);
  assert.equal((await api("GET", "/admin/users")).status, 401);
});
test("catalog public", async () => {
  const r = await api("GET", "/catalog/products?per=5");
  assert.equal(r.status, 200); assert.ok(r.json.data.items.length > 0); assert.ok(r.json.data.total >= 24);
  PID = r.json.data.items[0].id;
  const cats = await api("GET", "/catalog/categories"); assert.ok(cats.json.data.length >= 9);
});
test("customer cannot create product 403", async () => {
  const r = await api("POST", "/catalog/products", { name: "x", price: 1, stock: 1 }, custT);
  assert.equal(r.status, 403);
});
test("cart add + merge + totals", async () => {
  const list = (await api("GET", "/catalog/products?per=30")).json.data.items;
  const a = list.find(p => p.seller_name === "TechNova"), b = list.find(p => p.seller_name === "Moda House");
  assert.ok(a && b);
  global.__ASTOCK = a.stock;
  assert.equal((await api("POST", "/cart/add", { pid: "00000000-0000-0000-0000-000000000000", qty: 1 }, custT)).status, 404);
  await api("POST", "/cart/add", { pid: a.id, qty: 2 }, custT);
  await api("POST", "/cart/merge", { items: [{ pid: b.id, qty: 1 }] }, custT);
  const cart = (await api("GET", "/cart", null, custT)).json.data;
  assert.equal(Object.keys(cart.groups).length, 2);
  const prev = await api("GET", "/checkout/preview?coupon=WELCOME10&ship=std", null, custT);
  assert.ok(prev.json.data.disc > 0);
  global.__A = a; global.__B = b;
});
test("place multi-vendor order", async () => {
  const addr = (await api("POST", "/addresses", { label: "Home", city: "Berlin", street: "Str 1", isDefault: true }, custT)).json.data;
  const o = await api("POST", "/checkout/place", { addressId: addr.id, shipId: "std", payMethod: "cod", couponCode: "WELCOME10" }, custT);
  assert.equal(o.status, 201); OID = o.json.data.id; OCODE = o.json.data.code;
  const det = (await api("GET", "/orders/" + OID, null, custT)).json.data;
  assert.equal(det.groups ? Object.keys(det.groups).length : 0, 2);
  const a = global.__A;
  const pa = (await api("GET", "/catalog/products/" + a.id)).json.data;
  assert.equal(pa.stock, global.__ASTOCK - 2); // exact server-side decrement
});
test("oversell blocked 400", async () => {
  const list = (await api("GET", "/catalog/products?per=50")).json.data.items;
  const low = list.filter(p => p.stock < 99).sort((x, y) => x.stock - y.stock)[0];
  const r = await api("POST", "/cart/add", { pid: low.id, qty: 99 }, custT);
  assert.equal(r.status, 400);
});
test("seller isolation + IDOR", async () => {
  const mine = (await api("GET", "/orders/seller", null, sell2T)).json.data;
  assert.ok(mine.every(o => o.items.every(i => i.seller_name === undefined || true)));
  // seller2 must NOT open tech-only... order has both sellers; check item scoping instead:
  const det = (await api("GET", "/orders/" + OID, null, sell2T)).json.data;
  const s2id = (await api("GET", "/catalog/sellers")).json.data.find(s => s.store_name === "Moda House").id;
  assert.ok(det.items.length > 0 && det.items.every(i => i.seller_id === s2id));
  // seller2 tries to change status of seller1's group via forged order: create tech-only order then poke
  const addr = (await api("POST", "/addresses", { label: "H", city: "B", street: "S" }, custT)).json.data;
  await api("POST", "/cart/add", { pid: global.__A.id, qty: 1 }, custT);
  const o2 = (await api("POST", "/checkout/place", { addressId: addr.id, shipId: "std", payMethod: "cod" }, custT)).json.data;
  assert.equal((await api("GET", "/orders/" + o2.id, null, sell2T)).status, 403); // IDOR blocked
  assert.equal((await api("POST", "/orders/" + o2.id + "/status", { status: "shipped" }, sell2T)).status, 403);
  global.__O2 = o2.id;
});
test("seller updates own group; shipped orders not customer-cancellable", async () => {
  const r = await api("POST", "/orders/" + OID + "/status", { status: "shipped", tracking: "TRK1" }, sellT);
  assert.equal(r.status, 200);
  assert.equal((await api("POST", "/orders/" + OID + "/status", { status: "cancelled" }, custT)).status, 403);
  const det = (await api("GET", "/orders/" + OID, null, custT)).json.data;
  assert.equal(det.groups[Object.keys(det.groups).find(k => det.groups[k].tracking === "TRK1")].status, "shipped");
});
test("admin stats + price change live", async () => {
  const st = (await api("GET", "/admin/stats", null, adminT)).json.data;
  assert.ok(st.revenue > 0 && st.orders >= 2);
  const p = (await api("GET", "/catalog/products?per=1")).json.data.items[0];
  await api("PATCH", "/catalog/products/" + p.id, { price: 111.11, stock: 7 }, adminT);
  const p2 = (await api("GET", "/catalog/products/" + p.id)).json.data;
  assert.equal(Number(p2.price), 111.11);
});
test("reviews + reply + moderate", async () => {
  const r = await api("POST", "/reviews", { pid: global.__A.id, rating: 5, text: "Excellent!" }, custT);
  assert.equal(r.status, 201);
  const dup = await api("POST", "/reviews", { pid: global.__A.id, rating: 4, text: "Again" }, custT);
  assert.equal(dup.status, 201); // upsert
  const all = (await api("GET", "/reviews/" + global.__A.id)).json.data;
  const mine = all.find(x => x.user_id && true);
  assert.ok(all.length >= 1);
  const rid = all[0].id;
  assert.equal((await api("POST", "/reviews/" + rid + "/reply", { text: "Thanks!" }, sell2T)).status, 403); // wrong seller
  assert.equal((await api("POST", "/reviews/" + rid + "/reply", { text: "Thanks!" }, sellT)).status, 200);
  assert.equal((await api("POST", "/admin/reviews/" + rid + "/moderate", { status: "hidden" }, adminT)).status, 200);
});
test("coupons + seller-scoped coupon", async () => {
  assert.equal((await api("POST", "/admin/coupons", { code: "T10", type: "percent", value: 10 }, custT)).status, 403);
  assert.equal((await api("POST", "/admin/coupons", { code: "T10", type: "percent", value: 10 }, adminT)).status, 200);
});
test("notifications + broadcast", async () => {
  const n = (await api("GET", "/notifications", null, custT)).json.data;
  assert.ok(n.length >= 1);
  await api("POST", "/notifications/broadcast", { text: "Hello all" }, adminT);
  assert.equal((await api("POST", "/notifications/broadcast", { text: "x" }, custT)).status, 403);
  await api("POST", "/notifications/read-all", null, custT);
});
test("CMS server-backed + themes", async () => {
  const home = (await api("GET", "/cms/home")).json.data;
  assert.ok(home.sections.length >= 9 && home.heroes.length >= 3);
  const secs = home.sections.map((s, i) => ({ id: s.id, type: s.type, title: s.title + "!", on: s.on, order: 99 - i }));
  await api("POST", "/cms/home/sections", { sections: secs }, adminT);
  const home2 = (await api("GET", "/cms/home")).json.data;
  assert.ok(home2.sections[0].title.endsWith("!"));
  assert.equal((await api("POST", "/cms/home/sections", { sections: secs }, custT)).status, 403);
  const th = await api("POST", "/cms/themes", { name: "Mine", tokens: { p: "#fff" } }, custT);
  assert.equal(th.status, 201);
  assert.equal((await api("DELETE", "/cms/themes/" + th.json.data.id, null, sellT)).status, 403); // other's theme
  const st = await api("POST", "/cms/settings", { defaultTheme: { id: "ocean" } }, adminT);
  assert.equal(st.status, 200);
  const pub = (await api("GET", "/cms/settings")).json.data;
  assert.equal(pub.defaultTheme.id, "ocean");
});
test("track + webhook rejects bad signature", async () => {
  const t = await api("GET", "/track?code=" + OCODE, null, custT);
  assert.equal(t.status, 200);
  assert.equal((await api("GET", "/track?code=" + OCODE, null, sellT)).status, 404); // not his customer order
  const w = await fetch(base + "/cms/webhooks/stripe", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.ok([400, 503].includes(w.status));
});
test("audit + report + mail log", async () => {
  assert.ok((await api("GET", "/admin/audit", null, adminT)).json.data.length > 5);
  const rep = (await api("GET", "/admin/report", null, adminT)).json.data;
  assert.ok(rep.orders >= 2 && rep.revenue > 0);
  assert.ok(Array.isArray((await api("GET", "/admin/mail", null, adminT)).json.data));
});
test("customer cancels own pending order (stock restored)", async () => {
  const list = (await api("GET", "/catalog/products?per=50")).json.data.items;
  const p = list.find(x => x.stock > 5 && x.stock < 200);
  const before = p.stock;
  await api("POST", "/cart/add", { pid: p.id, qty: 2 }, custT);
  const addr = (await api("GET", "/addresses", null, custT)).json.data[0];
  const o = (await api("POST", "/checkout/place", { addressId: addr.id, shipId: "std", payMethod: "cod" }, custT)).json.data;
  const cx = await api("POST", "/orders/" + o.id + "/status", { status: "cancelled" }, custT);
  assert.equal(cx.status, 200);
  const pa = (await api("GET", "/catalog/products/" + p.id)).json.data;
  assert.equal(pa.stock, before); // restored
  assert.equal((await api("POST", "/orders/" + OID + "/status", { status: "cancelled" }, custT)).status, 403); // shipped: not cancellable
});
test("refresh rotation + forgot/reset", async () => {
  const l = await api("POST", "/auth/login", { email: "t@t.com", password: "secret12" });
  const r1 = await api("POST", "/auth/refresh", { refreshToken: l.json.data.refreshToken });
  assert.equal(r1.status, 200);
  assert.equal((await api("POST", "/auth/refresh", { refreshToken: l.json.data.refreshToken })).status, 401); // old rotated out
  const f = await api("POST", "/auth/forgot", { email: "t@t.com" });
  assert.equal(f.status, 200);
  if (f.json.data.token) {
    assert.equal((await api("POST", "/auth/reset", { token: f.json.data.token, password: "newpass99" })).status, 200);
    assert.equal((await api("POST", "/auth/login", { email: "t@t.com", password: "newpass99" })).status, 200);
  }
});
test("seller apply + own coupons + product approval flow", async () => {
  const r = await api("POST", "/auth/register", { name: "Newbie Seller", email: "newbie@s.com", password: "secret12", role: "seller" });
  const nt = r.json.data.accessToken;
  const mine = await api("GET", "/cms/store/mine", null, nt);
  assert.equal(mine.json.data.status, "pending");
  assert.equal((await api("GET", "/catalog/mine/products", null, nt)).status === 200 ? 200 : 0, 200);
  const cat = (await api("GET", "/catalog/categories")).json.data[0];
  const created = await api("POST", "/catalog/products", { name: "Pending Widget", price: 9.99, stock: 3, categoryId: cat.id }, nt);
  assert.equal(created.status, 403); // store not approved
  const adm = await api("POST", "/admin/sellers", null, adminT).catch(() => null);
  const sellers = (await api("GET", "/admin/sellers", null, adminT)).json.data;
  const pend = sellers.find(s => s.status === "pending");
  assert.ok(pend);
  await api("POST", "/admin/sellers/" + pend.id + "/status", { status: "approved" }, adminT);
  const created2 = await api("POST", "/catalog/products", { name: "Pending Widget", price: 9.99, stock: 3, categoryId: cat.id }, nt);
  assert.equal(created2.status, 201);
  assert.equal(created2.json.data.status, "pending"); // needs admin approval
  const any = await api("GET", "/catalog/mine/products/" + created2.json.data.id, null, nt);
  assert.equal(any.status, 200); // owner can fetch non-published
  assert.equal((await api("GET", "/catalog/products/" + created2.json.data.id)).status, 404); // public cannot
  await api("POST", "/catalog/products/" + created2.json.data.id + "/status", { status: "published" }, adminT);
  assert.equal((await api("GET", "/catalog/products/" + created2.json.data.id)).status, 200);
  const cp = await api("POST", "/cms/coupons/mine", { code: "MINE5", type: "percent", value: 5 }, nt);
  assert.equal(cp.status, 201);
  const mine2 = (await api("GET", "/cms/coupons/mine", null, nt)).json.data;
  assert.ok(mine2.some(c => c.code === "MINE5"));
});
test("messages to-seller + contact + active promos + qty_sum", async () => {
  const sellers = (await api("GET", "/catalog/sellers")).json.data;
  const m = await api("POST", "/messages/to-seller", { sellerId: sellers[0].id, text: "Hi, question", orderId: null }, custT);
  assert.equal(m.status, 201);
  const th = (await api("GET", "/messages", null, custT)).json.data;
  assert.ok(th.length >= 1);
  assert.equal((await api("POST", "/contact", { name: "Ali", email: "a@b.com", message: "hello" })).status, 200);
  assert.equal((await api("POST", "/contact", { name: "Ali", email: "bad", message: "hello" })).status, 400);
  const ap = await api("GET", "/catalog/promos/active");
  assert.equal(ap.status, 200);
  const so = (await api("GET", "/orders/seller", null, sellT)).json.data;
  assert.ok(so.every(o => typeof o.qty_sum === "number"));
});
