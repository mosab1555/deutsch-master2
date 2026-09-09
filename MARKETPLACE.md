# Deutsch Master Marketplace — Documentation

Global multi-vendor marketplace (Web PWA + Android/iOS via Capacitor + Windows via Electron).
Stack: **zero-build vanilla HTML/CSS/JS** (keeps Capacitor + Electron + PWA working with no bundler).

> Legacy German-learning app is preserved untouched as **`academy.html`**
> (old `style.css` / `script.js` / `explain.js` / `launch.js` still shipped, linked from footer).

## Project structure

```
index.html          Marketplace SPA shell (SEO/OG/JSON-LD, no-flash theme init)
academy.html        Legacy learning app (preserved)
css/tokens.css      Design tokens + 20 preset themes + light/dark/system (CSS vars only)
css/app.css         All component styles (uses vars only, no hard-coded colors)
js/utils.js         Pure helpers (money, cart math, validation, hashing) — Node-testable
js/db.js            IndexedDB database + schema + seed data (DMM_DB / DMM_SEED)
js/i18n.js          ar/en/de strings + RTL (DMM_I18N)
js/api.js           Service/API layer: auth, RBAC, validation, audit, payments,
                    shipping, email (DMM_API). UI never touches DB directly.
js/app.js           Layout, theme engine, router, cart drawer, product cards (DMM_APP)
js/pages-shop.js    Home/CMS, listing, PDP, cart, checkout, tracking, auth (DMM_PAGES)
js/dashboards.js    Customer / Seller / Admin dashboards (DMM_DASH)
sw.js / manifest.json   PWA (installable, offline fallback)
tools/make-www.js   Copies web files → www/ for Capacitor
electron/main.js    Windows shell (loads index.html)
.env.example        External service keys
```

## Database (IndexedDB `dmm_db`)

Stores: `users(role,status,passHash+salt)`, `sellers(status)`, `categories(parentId)`,
`brands`, `products(status,sellerId,stock,variants,images)`, `addresses`, `carts`,
`wishlists`, `orders(code,groups per-seller,status,timeline)`, `coupons(scope)`,
`promos`, `reviews`, `messages(thread)`, `notifications`, `media(blobs)`,
`themes(custom)`, `kv(settings,heroes,banners,sections,secrets,maillog)`,
`audit`, `searchlog`.

Orders are **parent + per-seller groups**: `order.groups[sellerId] = {status,tracking}`.
Sellers update only their group; admin sees/updates everything.

## API (js/api.js)

Every mutation validates input, checks role server-side-style (`need(u,roles)`),
and audit-logs important actions (`audit` store → Admin → Audit log).
Swap to a REST backend later by re-implementing `DMM_API` methods — UI code stays.

## Run

```bash
# Web (dev) — any static server:
npx serve .            # or: python -m http.server 8080
# open http://localhost:8080  (http:// required for IndexedDB on some browsers)

# Windows (Electron):
npm install
npm run start-win      # dev window
npm run dist-win       # installer + portable

# Android / iOS (Capacitor):
npm run www            # build www/
npx cap sync
npm run android        # open Android Studio
```

## Demo accounts (seeded)

| Role     | Email             | Password    |
|----------|-------------------|-------------|
| Admin    | admin@demo.com    | admin123    |
| Seller   | seller@demo.com   | seller123   |
| Seller 2 | seller2@demo.com  | seller123   |
| Customer | customer@demo.com | customer123 |

Passwords are salted SHA-256 hashes — never plain text.

## First steps (no code needed)

1. Login as **admin** → `#/admin` → Homepage CMS: edit heroes, banners, reorder sections.
2. Admin → Themes: set default theme; header 🎨 opens the theme studio (20 presets,
   light/dark/system, custom color builder, save/rename/delete).
3. Admin → Sellers: approve pending sellers. Admin → Products: approve `pending` items.
4. As **seller**: `#/seller/apply` → create store → add products (Basic→Pricing→
   Inventory→Images→Variants→SEO→Publish + preview) → receive orders → ship → analytics.
5. As **customer**: browse → search (suggestions/recent/popular) → wishlist → cart
   (grouped per seller) → checkout (address→shipping→payment→review) → track (`#/track`).
6. Coupons: `WELCOME10` (10%), `FLASH20` (20%). Test card: `4242 4242 4242 4242`.

## External services (integration architecture, TEST/MOCK default)

| Need            | Status | How to go live |
|-----------------|--------|----------------|
| Cards/Wallets   | `PAY.charge()` mock in `js/api.js` | Admin → Shipping&Pay → Secrets → `STRIPE_KEY=sk_live…` (see `.env.example`), then wire provider HTTPS call in `PAY.charge` |
| Shipping API    | `A.shipTrack()` mock carrier | Set `SHIP_API_KEY` + carrier in `A.shipTrack` |
| Email/SMS       | `A.sendMail()` test log (Admin → Shipping&Pay → Mail log) | Set `SMTP_*` and POST to your provider in `A.sendMail` |
| Cloud storage   | Media Library stores blobs in IndexedDB | Sync `media` store to S3/Cloudinary via URL refs (`{t:"url"}`) |
| Maps            | Not wired | Set `MAPS_KEY`, address autocomplete hook in checkout address form |
| Currency        | Admin → Shipping&Pay → currency code/symbol/position (rates = 1×; plug FX API for live rates) | — |

## Production checklist (remaining)

- [ ] Replace `DMM_API` internals with real REST endpoints + JWT sessions (UI untouched).
- [ ] Move secrets to server env; enable live payment + SMTP + carrier keys.
- [ ] Product images: migrate demo gradient placeholders to real CDN uploads via Media Library.
- [ ] Rate limiting / CSRF / WAF at the server/CDN layer (architecture hooks documented in code).
- [ ] `npm run dist-win` signing cert for Windows SmartScreen.
