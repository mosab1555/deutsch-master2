# Deutsch Master Marketplace — Production Edition

Multi-vendor marketplace: `client/` (PWA storefront, zero-build) + `server/` (Node/Express API + PostgreSQL) + `shared/` (domain constants).

> Legacy prototype notes: the German-learning app is preserved as `client/academy.html`.
> `client/js/db.js` (old IndexedDB data layer) is retired and no longer loaded — kept
> in-repo only as reference for a future offline-cache. `tools/smoke-test.js` was removed
> because it tested the retired IndexedDB stack; it is superseded by
> `server/tests/api.test.js` (**25/25 passing**).

## Layout

```
client/            Storefront (index.html, css/, js/, icons/, manifest, sw.js)
  js/api.js        DMM_API — HTTP adapter, same frontend contract as before
  js/local.js      Guest cart/wishlist, recently viewed, search history (local only)
server/            Express API (see server/README section below)
  src/routes|controllers|services|middleware, schema.sql, tests/
shared/constants.js Roles, order/payment statuses, error codes (required by server)
tools/make-www.js  client/ -> www/ for Capacitor
electron/main.js   Windows shell (loads client/index.html)
```

## Run everything locally

```bash
# 1) Backend + embedded PostgreSQL (no install needed) + seed:
cd server && node src/seed.js && node src/index.js
# API on http://localhost:4000  (serves client/ statically too)

# 2) Frontend: open http://localhost:4000  (same-origin /api)
#    Demo: admin@demo.com/admin123 · seller@demo.com/seller123 · customer@demo.com/customer123

# 3) Tests: cd server && node --test tests/api.test.js   (25/25)

# 4) Windows app: npm run start-win / npm run dist-win   (loads client/)
# 5) Mobile: node tools/make-www.js && npx cap sync
#    Point the app at your API: localStorage "dmm-api-url" (default http://localhost:4000/api outside http)
```

## Production deployment

| Part     | Target | Notes |
|----------|--------|-------|
| Database | Managed PostgreSQL | set `DATABASE_URL`; schema in `server/src/schema.sql` (`node server/src/migrate.js`) |
| Backend  | Any Node hosting | `cd server && npm install --omit=dev && node src/index.js`; env from `.env.example` → `server/.env` |
| Frontend | Static hosting / CDN | upload `client/`; set `window.DMM_API_URL="https://api.example.com/api"` or `dmm-api-url` in localStorage |
| Storage  | Local disk or Cloudinary | `CLOUDINARY_CLOUD` + `CLOUDINARY_PRESET` for cloud; else `./uploads` |
| Desktop  | `npm run dist-win` | Electron loads bundled `client/`; set API URL to production |
| Mobile   | Capacitor `www/` | same API URL mechanism |

## Honest integration status

- **Database**: real PostgreSQL (embedded PGlite locally, `DATABASE_URL` in prod). No IndexedDB reads/writes in app flow.
- **Auth**: bcrypt (12 rounds) + short-lived JWT access + rotating refresh tokens. No SHA-256 passwords.
- **Payments**: COD live; **Stripe integration implemented but requires API credentials** (`STRIPE_SECRET_KEY` + webhook secret). Without keys, online methods return `503 PAYMENTS_NOT_CONFIGURED` (never fake-paid).
- **Shipping**: methods/fees/tracking-events in DB + admin UI; **carrier API integration implemented but requires credentials** (`SHIPPING_API_KEY`).
- **Email**: real SMTP when configured, else dev logger (`mail_log` table + admin view).
- **Media**: local disk live; Cloudinary live when keys set; S3 seam documented in `server/src/storage.js`.
