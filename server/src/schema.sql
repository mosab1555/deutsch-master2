-- Deutsch Master Marketplace — PostgreSQL schema (production + PGlite-compatible)
-- Extensions: none required (gen_random_uuid() is core since PG13).
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','seller','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  avatar_url TEXT DEFAULT '',
  theme_pref JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (lower(email));

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rt_user_idx ON refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo JSONB DEFAULT '{}',
  banner JSONB DEFAULT '{}',
  description TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  name_ar TEXT NOT NULL, name_en TEXT NOT NULL, name_de TEXT DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  image JSONB DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cat_parent_idx ON categories (parent_id);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo JSONB DEFAULT '{}',
  description TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description TEXT DEFAULT '',
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  old_price NUMERIC(12,2),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku TEXT NOT NULL,
  images JSONB NOT NULL DEFAULT '[]',
  video_url TEXT DEFAULT '',
  variants JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','hidden')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  reviews_count INT NOT NULL DEFAULT 0,
  sales INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS prod_seller_idx ON products (seller_id);
CREATE INDEX IF NOT EXISTS prod_cat_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS prod_brand_idx ON products (brand_id);
CREATE INDEX IF NOT EXISTS prod_status_idx ON products (status);
CREATE INDEX IF NOT EXISTS prod_sales_idx ON products (sales DESC);

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant TEXT NOT NULL DEFAULT '',
  qty INT NOT NULL CHECK (qty BETWEEN 1 AND 99),
  UNIQUE (cart_id, product_id, variant)
);
CREATE INDEX IF NOT EXISTS ci_cart_idx ON cart_items (cart_id);

CREATE TABLE IF NOT EXISTS wishlists (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL, city TEXT NOT NULL, street TEXT NOT NULL,
  zip TEXT DEFAULT '', phone TEXT DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS addr_user_idx ON addresses (user_id);

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_disc NUMERIC(12,2),
  min_order NUMERIC(12,2) NOT NULL DEFAULT 0,
  usage_limit INT NOT NULL DEFAULT 1000,
  used INT NOT NULL DEFAULT 0,
  per_user INT NOT NULL DEFAULT 1,
  scope TEXT NOT NULL DEFAULT 'all',
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 years'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS coupon_uses (
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (coupon_id, user_id)
);

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'flash' CHECK (type IN ('flash','category','seller','homepage')),
  discount NUMERIC(5,2) NOT NULL DEFAULT 0,
  product_ids JSONB NOT NULL DEFAULT '[]',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subtotal NUMERIC(12,2) NOT NULL, discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0, tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  address JSONB NOT NULL, ship_method JSONB NOT NULL,
  pay_method TEXT NOT NULL CHECK (pay_method IN ('cod','card','wallet')),
  pay_status TEXT NOT NULL DEFAULT 'pending' CHECK (pay_status IN ('pending','paid','failed','cancelled','refunded')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','returned','refunded')),
  note TEXT DEFAULT '',
  timeline JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ord_cust_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS ord_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS ord_created_idx ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS seller_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking TEXT DEFAULT '',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, seller_id)
);
CREATE INDEX IF NOT EXISTS so_seller_idx ON seller_orders (seller_id);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_order_id UUID NOT NULL REFERENCES seller_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  qty INT NOT NULL,
  variant TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS oi_order_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','refunded')),
  amount NUMERIC(12,2) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'cod',
  provider_ref TEXT DEFAULT '',
  raw JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL,
  raw JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipping_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  eta TEXT DEFAULT '',
  min_free NUMERIC(12,2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  message TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tr_order_idx ON tracking_events (order_id);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  images JSONB NOT NULL DEFAULT '[]',
  reply JSONB,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS rev_prod_idx ON reviews (product_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread UUID NOT NULL,
  from_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL DEFAULT '',
  to_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS msg_thread_idx ON messages (thread, created_at);
CREATE INDEX IF NOT EXISTS msg_part_idx ON messages (from_id, to_id);

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  url TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tokens JSONB NOT NULL,
  mode TEXT NOT NULL DEFAULT 'dark',
  is_global BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS theme_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme_name TEXT DEFAULT 'midnight',
  custom JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS homepage_sections (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT DEFAULT '',
  is_on BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS homepage_heroes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, sub TEXT DEFAULT '', cta TEXT DEFAULT '',
  link TEXT DEFAULT '', art TEXT DEFAULT '', image_url TEXT DEFAULT '',
  is_on BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS homepage_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, sub TEXT DEFAULT '', cta TEXT DEFAULT '',
  link TEXT DEFAULT '', image_url TEXT DEFAULT '', grad INT NOT NULL DEFAULT 0,
  is_on BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_settings (
  k TEXT PRIMARY KEY,
  v JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS mail_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_addr TEXT DEFAULT '',
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
