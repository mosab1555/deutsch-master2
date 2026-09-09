/* DMM — API adapter: SAME contract as before, now over HTTP → Backend → PostgreSQL.
   Base URL: localStorage "dmm-api-url" || (http(s) ? "/api" : "http://localhost:4000/api").
   IndexedDB is not used. Guest cart/wishlist/viewed live in DMM_LOCAL (localStorage). */
(function (g) {
  "use strict";
  const U = g.DMM_UTILS, L = g.DMM_LOCAL;
  class ApiError extends Error { constructor(code, msg) { super(msg || ("E" + code)); this.code = code; } }
  const base = () => {
    try {
      if (g.DMM_API_URL) return String(g.DMM_API_URL).replace(/\/$/, "");
      const c = localStorage.getItem("dmm-api-url"); if (c) return c.replace(/\/$/, "");
    } catch (e) {}
    return location.protocol.indexOf("http") === 0 ? "/api" : "http://localhost:4000/api";
  };
  const abs = u => (/^https?:/.test(u) ? u : base().replace(/\/api$/, "") + u);
  const tok = {
    get() { try { return JSON.parse(localStorage.getItem("dmm-tokens") || "null"); } catch (e) { return null; } },
    set(t) { try { t ? localStorage.setItem("dmm-tokens", JSON.stringify(t)) : localStorage.removeItem("dmm-tokens"); } catch (e) {} },
  };
  async function req(method, path, body, retry) {
    const t = tok.get();
    const r = await fetch(base() + path, { method, headers: { "Content-Type": "application/json", ...(t && t.access ? { Authorization: "Bearer " + t.access } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && t && t.refresh && !retry) {
      try {
        const rr = await fetch(base() + "/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: t.refresh }) });
        const jj = await rr.json();
        if (jj.success) { tok.set({ access: jj.data.accessToken, refresh: jj.data.refreshToken }); return req(method, path, body, true); }
      } catch (e) {}
      tok.set(null);
    }
    if (!r.ok || (j && j.success === false)) {
      const code = (j && j.error && j.error.code) || ("HTTP_" + r.status);
      throw new ApiError(r.status, (j && j.error && (j.error.message || j.error.code)) || ("Request failed (" + r.status + ")"));
    }
    return j.data;
  }
  const GET = p => req("GET", p), POST = (p, b) => req("POST", p, b), PATCH = (p, b) => req("PATCH", p, b), DEL = p => req("DELETE", p);
  /* ---- field mapping (server snake_case -> frontend camelCase) ---- */
  const M = {
    cat: c => ({ ...c, name: { ar: c.name_ar, en: c.name_en, de: c.name_de }, parentId: c.parent_id, order: c.sort_order, img: c.image || { t: "g", g: 0, em: "📦" } }),
    brand: b => ({ ...b, logo: b.logo || { t: "g", g: 1, em: "™" }, desc: b.description || "" }),
    seller: s => ({ ...s, storeName: s.store_name, desc: s.description || "", logo: s.logo || {}, banner: s.banner || {}, rating: Number(s.rating || 0) }),
    prod: p => ({ ...p, desc: p.description || "", categoryId: p.category_id, brandId: p.brand_id, sellerId: p.seller_id, oldPrice: p.oldPrice != null ? Number(p.oldPrice) : (p.old_price != null ? Number(p.old_price) : null), price: Number(p.price), images: p.images || [], variants: p.variants || [], reviewsCount: p.reviewsCount != null ? p.reviewsCount : p.reviews_count, createdAt: p.created_at || p.createdAt }),
    order: o => ({ ...o, customerId: o.customer_id, payMethod: o.pay_method, payStatus: o.pay_status, addressId: (o.address && o.address.id) || o.addressId, createdAt: o.created_at || o.createdAt, subtotal: Number(o.subtotal), discount: Number(o.discount), shipping: Number(o.shipping), tax: Number(o.tax), total: Number(o.total), items: (o.items || []).map(i => ({ ...i, sellerId: i.seller_id || i.sellerId, price: Number(i.price) })) }),
    coupon: c => ({ ...c, value: Number(c.value), minOrder: Number(c.min_order != null ? c.min_order : c.minOrder), maxDisc: c.max_disc != null ? Number(c.max_disc) : c.maxDisc }),
  };
  const A = { Error: ApiError };
  A.apiBase = base;
  /* ---------- AUTH ---------- */
  A.me = async () => { const t = tok.get(); if (!t) return null; try { return await GET("/auth/me"); } catch (e) { if (e.code === 401) tok.set(null); return null; } };
  async function afterAuth(d) {
    tok.set({ access: d.accessToken, refresh: d.refreshToken });
    const gc = L.guestCart();
    if (gc.length) { try { await POST("/cart/merge", { items: gc }); } catch (e) {} L.clearGuestCart(); }
    const gw = L.guestWish();
    if (gw.length) { try { for (const pid of gw) await POST("/wishlist/toggle", { pid }); } catch (e) {} L.setGuestWish([]); }
    return d.user;
  }
  A.register = d => POST("/auth/register", d).then(afterAuth);
  A.login = (email, password) => POST("/auth/login", { email, password }).then(afterAuth);
  A.logout = async () => { const t = tok.get(); try { if (t) await POST("/auth/logout", { refreshToken: t.refresh }); } catch (e) {} tok.set(null); L.clearGuestCart(); };
  A.forgot = email => POST("/auth/forgot", { email });
  A.reset = (token, pw) => POST("/auth/reset", { token, password: pw });
  A.updateProfile = patch => PATCH("/auth/me", patch);
  A.changePass = (oldPw, newPw) => POST("/auth/password", { oldPassword: oldPw, newPassword: newPw });
  /* ---------- ADDRESSES ---------- */
  A.addresses = () => GET("/addresses");
  A.saveAddress = a => a.id ? POST("/addresses", a) : POST("/addresses", a);
  A.delAddress = id => DEL("/addresses/" + id);
  /* ---------- CATALOG ---------- */
  A.cats = () => GET("/catalog/categories").then(r => r.map(M.cat));
  A.category = async id => (await A.cats()).find(c => c.id === id);
  A.brands = () => GET("/catalog/brands").then(r => r.map(M.brand));
  A.sellers = () => GET("/catalog/sellers").then(r => r.map(M.seller));
  A.getSeller = id => GET("/catalog/sellers/" + id).then(M.seller);
  A.products = async q => {
    q = q || {};
    const p = new URLSearchParams();
    ["sellerId", "categoryId", "brandId", "search", "sort"].forEach(k => { if (q[k]) p.set(k === "categoryId" ? "categoryId" : k, q[k]); });
    if (q.min != null) p.set("min", q.min); if (q.max != null) p.set("max", q.max);
    if (q.minRating) p.set("minRating", q.minRating);
    if (q.onSale) p.set("onSale", 1); if (q.inStock) p.set("inStock", 1);
    if (q.ids) p.set("ids", q.ids.join(","));
    p.set("page", q.page || 1); p.set("per", q.per || 12);
    const r = await GET("/catalog/products?" + p.toString());
    r.items = r.items.map(M.prod); return r;
  };
  A.product = async id => { const p = M.prod(await GET("/catalog/products/" + id)); try { p._seller = await A.getSeller(p.sellerId); } catch (e) { p._seller = {}; } return p; };
  A.search = async (q, uid) => {
    L.searchAdd(q);
    const r = await GET("/search?q=" + encodeURIComponent(q || ""));
    return { products: (r.products || []).map(M.prod), cats: (r.cats || []).map(M.cat), brands: (r.brands || []).map(M.brand), sellers: r.sellers || [] };
  };
  A.popularSearches = async () => L.popularSearches();
  A.recentSearches = async () => L.recentSearches();
  A.recommend = async (id, uid) => {
    const r = await A.products({ per: 60 });
    const cur = r.items.find(p => p.id === id);
    let pool = cur ? r.items.filter(p => p.id !== id && (p.categoryId === cur.categoryId || p.brandId === cur.brandId)) : r.items.filter(p => p.id !== id);
    if (!pool.length) pool = r.items.filter(p => p.id !== id);
    return U.sortBy(pool, "sales", "desc").slice(0, 8);
  };
  A.markViewed = pid => L.viewedAdd(pid);
  A.viewed = async () => {
    const ids = L.viewedIds(); if (!ids.length) return [];
    try { const r = await A.products({ ids, per: 20 }); return ids.map(i => r.items.find(p => p.id === i)).filter(Boolean); }
    catch (e) { return []; }
  };
  /* ---------- CART (server for members, local for guests) ---------- */
  const guestDetail = async () => {
    const items = L.guestCart(); if (!items.length) return { items: [], groups: {} };
    const r = await A.products({ ids: items.map(i => i.pid), per: 100 });
    const det = items.map(i => {
      const p = r.items.find(x => x.id === i.pid); if (!p) return null;
      return { pid: p.id, name: p.name, price: p.price, img: p.images[0], qty: i.qty, variant: i.variant || "", sellerId: p.sellerId, seller: p.seller_name || "", stock: p.stock };
    }).filter(Boolean);
    return { items: det, groups: U.groupBy(det, "sellerId") };
  };
  A.cart = async () => (tok.get() ? GET("/cart") : guestDetail());
  A.cartCount = async () => {
    if (tok.get()) { try { const c = await GET("/cart"); return c.items.reduce((a, i) => a + i.qty, 0); } catch (e) { return 0; } }
    return L.guestCart().reduce((a, i) => a + i.qty, 0);
  };
  A.cartAdd = async (pid, qty, variant) => {
    qty = Math.max(1, Math.min(99, qty | 0 || 1)); variant = variant || "";
    if (!tok.get()) {
      const items = L.guestCart(); const f = items.find(x => x.pid === pid && (x.variant || "") === variant);
      f ? f.qty = Math.min(99, f.qty + qty) : items.push({ pid, qty, variant });
      L.setGuestCart(items);
      return { count: items.reduce((a, i) => a + i.qty, 0) };
    }
    return POST("/cart/add", { pid, qty, variant });
  };
  A.cartQty = async (pid, variant, qty) => {
    if (!tok.get()) {
      const items = L.guestCart(); const f = items.find(x => x.pid === pid && (x.variant || "") === (variant || ""));
      if (!f) throw new ApiError(404, "Not in cart");
      f.qty = Math.max(1, Math.min(99, qty | 0 || 1)); L.setGuestCart(items); return { ok: true };
    }
    return PATCH("/cart/qty", { pid, variant: variant || "", qty });
  };
  A.cartRemove = async (pid, variant) => {
    if (!tok.get()) { L.setGuestCart(L.guestCart().filter(x => !(x.pid === pid && (x.variant || "") === (variant || "")))); return { ok: true }; }
    return req("DELETE", "/cart/item", { pid, variant: variant || "" });
  };
  A.cartClear = async () => { if (!tok.get()) { L.clearGuestCart(); return { ok: true }; } return req("DELETE", "/cart"); };
  A.wishlist = async () => {
    if (!tok.get()) { const ids = L.guestWish(); if (!ids.length) return []; return (await A.products({ ids, per: 60 })).items; }
    return (await GET("/wishlist")).map(M.prod);
  };
  A.wishToggle = async pid => {
    if (!tok.get()) { const w = L.guestWish(); const i = w.indexOf(pid); i >= 0 ? w.splice(i, 1) : w.push(pid); L.setGuestWish(w); return { on: i < 0 }; }
    return POST("/wishlist/toggle", { pid });
  };
  A.wishHas = async pid => {
    if (!tok.get()) return L.guestWish().includes(pid);
    try { const w = await GET("/wishlist"); return w.some(p => p.id === pid); } catch (e) { return false; }
  };
  /* ---------- COUPONS / PROMOS ---------- */
  A.coupon = async code => {
    code = String(code || "").trim().toUpperCase(); if (!code || !tok.get()) return null;
    try { const t = await GET("/orders/checkout/preview?coupon=" + encodeURIComponent(code) + "&ship=std"); return t.coupon; }
    catch (e) { return null; }
  };
  A.coupons = async () => {
    try { const r = await GET("/cms/coupons/mine"); return r.map(M.coupon); }
    catch (e) { const r = await GET("/admin/coupons"); return r.map(M.coupon); }
  };
  A.promos = async () => { try { return await GET("/admin/promos"); } catch (e) { return []; } };
  A.flash = () => GET("/catalog/flash").then(f => (f ? { ...f, title: f.title, discount: Number(f.discount), end: f.end_at || f.end, _products: (f._products || []).map(M.prod) } : null));
  A.getProductAny = id => GET("/catalog/mine/products/" + id).then(M.prod);
  A.activePromos = () => GET("/catalog/promos/active").catch(() => []);
  A.sendMsgToSeller = (sellerId, text, orderId) => POST("/messages/to-seller", { sellerId, text, orderId: orderId || null });
  /* ---------- CHECKOUT & ORDERS ---------- */
  A.checkoutTotals = (couponCode, shipId) => GET("/orders/checkout/preview?coupon=" + encodeURIComponent(couponCode || "") + "&ship=" + encodeURIComponent(shipId || "std"));
  A.placeOrder = o => POST("/orders/checkout/place", o);
  A.orders = () => GET("/orders").then(r => r.map(M.order));
  A.order = id => GET("/orders/" + id).then(M.order);
  A.sellerOrders = () => GET("/orders/seller").then(r => r.map(M.order));
  A.allOrders = () => GET("/orders/all").then(r => r.map(M.order));
  A.setOrderStatus = (id, st, extra) => POST("/orders/" + id + "/status", { status: st, tracking: (extra && extra.tracking) || "" });
  /* ---------- REVIEWS ---------- */
  A.reviews = pid => GET("/reviews/" + pid);
  A.addReview = (pid, rating, text, images) => POST("/reviews", { pid, rating: Number(rating), text, images: images || [] });
  A.replyReview = (id, text) => POST("/reviews/" + id + "/reply", { text });
  A.moderateReview = (id, st) => POST("/admin/reviews/" + id + "/moderate", { status: st });
  A.allReviews = () => GET("/admin/reviews");
  /* ---------- SELLER ---------- */
  A.mySeller = () => GET("/cms/store/mine").then(s => (s ? M.seller(s) : null));
  A.applyStore = async d => { const r = await POST("/cms/store/apply", d); return { store: M.seller(r.store), role: r.role }; };
  A.saveStore = patch => {
    const b = {};
    if (patch.storeName !== undefined) b.storeName = patch.storeName;
    if (patch.desc !== undefined) b.desc = patch.desc;
    if (patch.contact !== undefined) b.contact = patch.contact;
    if (patch.logo !== undefined) b.logo = patch.logo;
    if (patch.banner !== undefined) b.banner = patch.banner;
    return PATCH("/cms/store/mine", b).then(M.seller);
  };
  A.sellerStats = () => GET("/cms/store/stats");
  A.sellerProducts = () => GET("/catalog/mine/products").then(r => r.map(M.prod));
  A.allProducts = () => A.sellerProducts();
  A.saveProduct = p => {
    const b = { name: p.name, desc: p.desc, price: p.price, oldPrice: p.oldPrice, stock: p.stock, sku: p.sku, categoryId: p.categoryId || null, brandId: p.brandId || null, images: p.images || [], video: p.video || "", variants: p.variants || [] };
    if (p.sellerId) b.sellerId = p.sellerId;
    return (p.id ? PATCH("/catalog/products/" + p.id, b) : POST("/catalog/products", b)).then(M.prod);
  };
  A.delProduct = id => DEL("/catalog/products/" + id);
  A.approveProduct = (id, st) => POST("/catalog/products/" + id + "/status", { status: st });
  A.setFeatured = (id, status, on) => POST("/catalog/products/" + id + "/status", { status, featured: on });
  /* ---------- ADMIN ---------- */
  A.adminStats = () => GET("/admin/stats");
  A.users = () => GET("/admin/users");
  A.setUser = (id, patch) => PATCH("/admin/users/" + id, patch);
  A.allSellers = () => GET("/admin/sellers").then(r => r.map(s => ({ ...M.seller(s), userId: s.user_id })));
  A.setSellerStatus = (id, st) => POST("/admin/sellers/" + id + "/status", { status: st });
  A.saveCategory = c => POST("/admin/categories", c);
  A.delCategory = id => DEL("/admin/categories/" + id);
  A.saveBrand = b => POST("/admin/brands", b);
  A.delBrand = id => DEL("/admin/brands/" + id);
  A.saveCoupon = c => POST("/admin/coupons", c);
  A.delCoupon = id => DEL("/admin/coupons/" + id);
  A.saveSellerCoupon = c => POST("/cms/coupons/mine", c);
  A.savePromo = p => POST("/admin/promos", p);
  A.delPromo = id => DEL("/admin/promos/" + id);
  /* homepage CMS */
  const mapHome = h => ({
    sections: (h.sections || []).map(s => ({ id: s.id, type: s.type, title: s.title, on: s.is_on != null ? s.is_on : s.on, order: s.sort_order != null ? s.sort_order : s.order })),
    heroes: (h.heroes || []).map(x => ({ id: x.id, title: x.title, sub: x.sub, cta: x.cta, link: x.link, art: x.art, image_url: x.image_url, on: x.is_on != null ? x.is_on : x.on, order: x.sort_order != null ? x.sort_order : x.order })),
    banners: (h.banners || []).map(x => ({ id: x.id, title: x.title, sub: x.sub, cta: x.cta, link: x.link, image_url: x.image_url, g: x.grad != null ? x.grad : x.g, on: x.is_on != null ? x.is_on : x.on })),
  });
  A.home = async () => {
    const isAdmin = g.DMM_APP && g.DMM_APP.user && g.DMM_APP.user.role === "admin";
    return mapHome(await GET(isAdmin ? "/cms/home/all" : "/cms/home"));
  };
  const isUuid = s => /^[0-9a-f-]{36}$/i.test(s || "");
  A.saveHome = async h => {
    if (h.sections) await POST("/cms/home/sections", { sections: h.sections });
    if (h.heroes) await POST("/cms/home/heroes", { heroes: h.heroes.map(x => { const o = { ...x }; if (!isUuid(o.id)) delete o.id; return o; }) });
    if (h.banners) await POST("/cms/home/banners", { banners: h.banners.map(x => { const o = { ...x }; if (!isUuid(o.id)) delete o.id; return o; }) });
    return { ok: true };
  };
  A.customThemes = async () => {
    const [mine, glob] = await Promise.all([GET("/cms/themes/mine").catch(() => []), GET("/cms/themes").catch(() => [])]);
    return [...glob, ...mine];
  };
  A.saveTheme = t => POST("/cms/themes", t);
  A.delTheme = id => DEL("/cms/themes/" + id);
  A.settings = () => GET("/cms/settings");
  A.saveSettings = s => POST("/cms/settings", s);
  A.setSecret = (k, v) => POST("/cms/secrets", { key: k, value: v });
  A.auditLog = () => GET("/admin/audit");
  A.report = ({ from, to }) => GET("/admin/report?" + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString());
  A.mailLog = () => GET("/admin/mail");
  A.adminNotifs = () => GET("/admin/notifications").then(r => r.map(n => ({ id: n.id, kind: n.kind, data: n.data, at: n.created_at })));
  /* ---------- NOTIFICATIONS ---------- */
  A.notify = () => Promise.resolve({ ok: true }); // server creates notifications on events
  A.contact = c => POST("/contact", c);
  A.myNotifs = () => GET("/notifications");
  A.readNotif = id => POST("/notifications/" + id + "/read", {});
  A.broadcast = (kind, text) => POST("/notifications/broadcast", { kind: kind || "broadcast", text });
  /* ---------- MESSAGING ---------- */
  A.threads = () => GET("/messages").then(r => r.map(t => ({ ...t, last: { ...t.last, fromName: t.last.from_name || t.last.fromName, at: t.last.created_at || t.last.at } })));
  A.thread = id => GET("/messages/" + id).then(r => r.map(m => ({ ...m, fromName: m.from_name, at: m.created_at })));
  A.sendMsg = (thread, to, text, orderId) => POST("/messages", { thread: isUuid(thread) ? thread : undefined, to, text, orderId: isUuid(orderId) ? orderId : null });
  /* ---------- MEDIA ---------- */
  A.media = () => GET("/media");
  A.mediaAdd = async file => {
    const fd = new FormData(); fd.append("file", file);
    const t = tok.get();
    const r = await fetch(base() + "/media", { method: "POST", headers: { ...(t && t.access ? { Authorization: "Bearer " + t.access } : {}) }, body: fd });
    const j = await r.json();
    if (!r.ok || j.success === false) throw new ApiError(r.status, (j.error && j.error.message) || "Upload failed");
    return j.data;
  };
  A.mediaUrl = async id => {
    try { const m = await GET("/media/" + id); return m && m.url ? abs(m.url) : ""; }
    catch (e) { return ""; }
  };
  A.mediaDel = id => DEL("/media/" + id);
  /* ---------- SHIPPING / PAYMENTS INFO ---------- */
  A.shipTrack = code => GET("/orders/track?code=" + encodeURIComponent(code));
  A.sendMail = async () => ({ ok: true, mode: "server" });
  g.DMM_API = A;
})(typeof self !== "undefined" ? self : this);
