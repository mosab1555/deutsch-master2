"use strict";
// Seed demo data (ported from the prototype) into PostgreSQL. Idempotent.
const bcrypt = require("bcryptjs");
const db = require("./db");
const GRADS = 8;
const G = (i, em) => ({ t: "g", g: i % GRADS, em });
async function seed() {
  await db.init();
  const flag = (await db.query("SELECT v FROM site_settings WHERE k='seeded_v1'")).rows[0];
  if (flag) { console.log("seed: already seeded"); return false; }
  const mkUser = async (name, email, pw, role, phone) => (await db.query(
    "INSERT INTO users(name,email,phone,pass_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [name, email.toLowerCase(), phone || "", await bcrypt.hash(pw, 12), role])).rows[0];
  await mkUser("Store Admin", "admin@demo.com", "admin123", "admin");
  const s1 = await mkUser("Tech Store", "seller@demo.com", "seller123", "seller", "+49170000001");
  const s2 = await mkUser("Fashion House", "seller2@demo.com", "seller123", "seller");
  await mkUser("Demo Customer", "customer@demo.com", "customer123", "customer", "+49170000002");
  const mkSeller = async (uid, name, slug, em, gi, desc) => (await db.query(
    "INSERT INTO sellers(user_id,store_name,slug,logo,banner,description,status,rating) VALUES($1,$2,$3,$4,$5,$6,'approved',4.6) RETURNING *",
    [uid, name, slug, JSON.stringify(G(gi, em)), JSON.stringify(G((gi + 3) % 8, em)), desc])).rows[0];
  const tech = await mkSeller(s1.id, "TechNova", "technova", "⚡", 0, "Latest electronics & gadgets with warranty.");
  const fash = await mkSeller(s2.id, "Moda House", "moda-house", "👗", 1, "Modern fashion for everyone.");
  const cats = [
    ["c_elec", "إلكترونيات", "Electronics", "Elektronik", "electronics", null, "📱", 0, 1],
    ["c_fash", "أزياء", "Fashion", "Mode", "fashion", null, "👗", 1, 2],
    ["c_home", "المنزل", "Home", "Zuhause", "home", null, "🏠", 2, 3],
    ["c_beau", "الجمال", "Beauty", "Schönheit", "beauty", null, "💄", 5, 4],
    ["c_sport", "رياضة", "Sports", "Sport", "sports", null, "⚽", 6, 5],
  ];
  const catIds = {};
  for (const [key, ar, en, de, slug, par, em, gi, ord] of cats) {
    const r = (await db.query("INSERT INTO categories(parent_id,name_ar,name_en,name_de,slug,image,sort_order) VALUES(NULL,$1,$2,$3,$4,$5,$6) RETURNING id", [ar, en, de, slug, JSON.stringify(G(gi, em)), ord])).rows[0];
    catIds[key] = r.id;
  }
  for (const [key, ar, en, de, slug, par, em, gi, ord] of [["c_phones", "هواتف", "Phones", "Handys", "phones", "c_elec", "📱", 0, 1], ["c_lap", "لابتوب", "Laptops", "Laptops", "laptops", "c_elec", "💻", 3, 2], ["c_men", "رجالي", "Men", "Herren", "men", "c_fash", "👔", 4, 1], ["c_women", "نسائي", "Women", "Damen", "women", "c_fash", "👚", 1, 2]]) {
    const r = (await db.query("INSERT INTO categories(parent_id,name_ar,name_en,name_de,slug,image,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [catIds[par], ar, en, de, slug, JSON.stringify(G(gi, em)), ord])).rows[0];
    catIds[key] = r.id;
  }
  const brandIds = {};
  for (const [n, em, gi] of [["NovaTech", "⚡", 0], ["Pulse", "🎧", 3], ["UrbanWear", "🧥", 1], ["Velvet", "💄", 5], ["FitPro", "🏋️", 6], ["LumaHome", "🛋️", 2], ["Aero", "⌚", 4], ["Orbit", "🚀", 7]]) {
    const r = (await db.query("INSERT INTO brands(name,slug,logo) VALUES($1,$2,$3) RETURNING id", [n, n.toLowerCase(), JSON.stringify(G(gi, em))])).rows[0];
    brandIds[n] = r.id;
  }
  const list = [
    ["Nova X5 Smartphone 256GB", tech.id, "c_phones", "NovaTech", 699, 849, 42, "📱", 0, 1],
    ["Pulse Wireless Headphones Pro", tech.id, "c_elec", "Pulse", 149, 199, 120, "🎧", 3, 1],
    ["Aero Smart Watch Series 7", tech.id, "c_elec", "Aero", 249, 329, 65, "⌚", 4, 1],
    ["UltraBook Pro 14 Laptop", tech.id, "c_lap", "NovaTech", 1299, 1499, 18, "💻", 3, 0],
    ["Orbit Drone 4K Camera", tech.id, "c_elec", "Orbit", 499, 649, 25, "🚁", 7, 0],
    ["Volt Power Bank 20000mAh", tech.id, "c_elec", "NovaTech", 39, 59, 300, "🔋", 2, 0],
    ["Urban Denim Jacket", fash.id, "c_men", "UrbanWear", 89, 129, 80, "🧥", 1, 1],
    ["Velvet Matte Lipstick Set", fash.id, "c_beau", "Velvet", 29, 45, 200, "💄", 5, 0],
    ["Summer Linen Dress", fash.id, "c_women", "UrbanWear", 59, 85, 95, "👗", 1, 1],
    ["Classic Leather Sneakers", fash.id, "c_men", "UrbanWear", 119, 159, 60, "👟", 4, 0],
    ["Luma Smart Lamp", tech.id, "c_home", "LumaHome", 49, 69, 140, "💡", 2, 0],
    ["Ergo Office Chair", tech.id, "c_home", "LumaHome", 199, 279, 30, "🪑", 6, 0],
    ["FitPro Yoga Mat Premium", fash.id, "c_sport", "FitPro", 35, 50, 180, "🧘", 6, 1],
    ["Hydro Steel Bottle 1L", fash.id, "c_sport", "FitPro", 25, 35, 250, "🍶", 2, 0],
    ["Mech Keyboard RGB", tech.id, "c_elec", "Pulse", 99, 139, 75, "⌨️", 0, 0],
    ["Silk Scarf Collection", fash.id, "c_women", "Velvet", 45, 65, 110, "🧣", 5, 0],
    ["Thunder Gaming Mouse", tech.id, "c_elec", "Pulse", 59, 79, 160, "🖱️", 7, 0],
    ["Runner Pro Shoes", fash.id, "c_sport", "FitPro", 139, 189, 55, "👟", 4, 0],
    ["Echo Smart Speaker", tech.id, "c_elec", "NovaTech", 79, 109, 130, "🔊", 3, 0],
    ["Gold Hoop Earrings", fash.id, "c_women", "Velvet", 39, 55, 90, "💍", 5, 0],
    ["Vision 27 4K Monitor", tech.id, "c_lap", "NovaTech", 349, 449, 22, "🖥️", 3, 0],
    ["Wool Winter Coat", fash.id, "c_women", "UrbanWear", 159, 219, 40, "🧥", 1, 0],
    ["Charge Cable 100W 2m", tech.id, "c_elec", "NovaTech", 15, 25, 500, "🔌", 2, 0],
    ["Canvas Travel Backpack", fash.id, "c_men", "UrbanWear", 69, 95, 85, "🎒", 6, 0],
  ];
  const prodIds = [];
  let k = 0;
  for (const [name, sid, cat, brand, price, old, stock, em, gi, feat] of list) {
    const r = (await db.query(`INSERT INTO products(seller_id,category_id,brand_id,name,description,price,old_price,stock,sku,images,status,featured,rating,reviews_count,sales)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published',$11,$12,$13,$14) RETURNING id`,
      [sid, catIds[cat], brandIds[brand], name, "High quality product with warranty and fast delivery.", price, old, stock,
       "SKU-P" + (++k), JSON.stringify([G(gi, em)]), !!feat, 4 + Math.random(), 5 + Math.floor(Math.random() * 180), 20 + Math.floor(Math.random() * 900)])).rows[0];
    prodIds.push(r.id);
  }
  await db.query("INSERT INTO coupons(code,type,value,max_disc,min_order,usage_limit,scope) VALUES('WELCOME10','percent',10,50,30,1000,'all'),('FLASH20','percent',20,100,100,200,'all')");
  await db.query("INSERT INTO promotions(title,type,discount,product_ids,status) VALUES('⚡ Flash Deals','flash',25,$1,'active')", [JSON.stringify(prodIds.slice(0, 5))]);
  const secs = [["s_flash", "flash", "Flash Deals", 1], ["s_cats", "categories", "Shop by Category", 2], ["s_trend", "trending", "Trending Now", 3], ["s_feat", "featured", "Featured Products", 4], ["s_banner", "banners", "", 5], ["s_brands", "brands", "Top Brands", 6], ["s_new", "new", "New Arrivals", 7], ["s_best", "bestsellers", "Best Sellers", 8], ["s_rec", "recommended", "Recommended For You", 9]];
  for (const [id, type, title, ord] of secs) await db.query("INSERT INTO homepage_sections(id,type,title,is_on,sort_order) VALUES($1,$2,$3,TRUE,$4) ON CONFLICT(id) DO NOTHING", [id, type, title, ord]);
  const heroes = [["Next-Gen Tech, Unbeatable Prices", "Top brands, flash deals daily, delivered to your door.", "Shop Electronics", "#/c/" + catIds.c_elec, "🚀", 1], ["New Season Fashion Drop", "Up to 40% off on trending styles.", "Explore Fashion", "#/c/" + catIds.c_fash, "👗", 2], ["Sell to Millions", "Open your store today. Zero setup fees.", "Become a Seller", "#/seller/apply", "🏪", 3]];
  for (const [t, s, c, l, a, o] of heroes) await db.query("INSERT INTO homepage_heroes(title,sub,cta,link,art,is_on,sort_order) VALUES($1,$2,$3,$4,$5,TRUE,$6)", [t, s, c, l, a, o]);
  await db.query("INSERT INTO homepage_banners(title,sub,cta,link,grad,is_on,sort_order) VALUES('Gadget Week','Up to 30% off tech','Shop now',$1,0,TRUE,0),('Beauty Essentials','New arrivals','Discover',$2,5,TRUE,1)", ["#/c/" + catIds.c_elec, "#/c/" + catIds.c_beau]);
  const settings = { storeName: "Deutsch Master Marketplace", logoText: "DM", currency: { code: "USD", symbol: "$", decimals: 2, pos: "before" }, taxRate: 0,
    shipMethods: [{ id: "std", name: "Standard", fee: 5, eta: "3-5 days" }, { id: "exp", name: "Express", fee: 12, eta: "1-2 days" }, { id: "free", name: "Free (orders $50+)", fee: 0, eta: "5-7 days", minFree: 50 }],
    langs: ["ar", "en", "de"], defaultLang: "ar", seo: { title: "Deutsch Master Marketplace", desc: "Global multi-vendor marketplace" },
    social: { x: "", instagram: "", facebook: "", youtube: "" }, footerAbout: "Global multi-vendor marketplace. Quality, speed and trust.",
    announcements: "🎉 Free shipping on orders over $50 — use code WELCOME10 for 10% off", defaultTheme: { id: "midnight" } };
  await db.query("INSERT INTO site_settings(k,v) VALUES('settings',$1) ON CONFLICT(k) DO UPDATE SET v=$1", [JSON.stringify(settings)]);
  for (const [idx, m] of settings.shipMethods.entries()) await db.query("INSERT INTO shipping_methods(id,name,fee,eta,min_free,active,sort_order) VALUES($1,$2,$3,$4,$5,TRUE,$6) ON CONFLICT(id) DO NOTHING", [m.id, m.name, m.fee, m.eta, m.minFree || null, idx]);
  await db.query("INSERT INTO site_settings(k,v) VALUES('seeded_v1', 'true') ON CONFLICT(k) DO NOTHING");
  console.log("seed: ok");
  return true;
}
if (require.main === module) {
  const { migrate } = require("./migrate");
  migrate().then(seed).then(() => process.exit(0)).catch(e => { console.error("seed failed:", e.message); process.exit(1); });
}
module.exports = { seed };
