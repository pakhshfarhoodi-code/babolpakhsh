-- =========================================================================
-- اسکریپت جامع فعال‌سازی و رفع محدودیت ذخیره‌سازی کالاها و موجودی انبار در Supabase
-- این اسکریپت را کپی کرده و در پنل Supabase > SQL Editor اجرا (Run) کنید.
-- =========================================================================

-- ۱. فعال‌سازی اکستنشن UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ۲. ساخت جدول دسته‌بندی‌ها (Categories) در صورت عدم وجود
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Layers',
  sort_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ۳. ساخت جدول برندها (Brands) در صورت عدم وجود
CREATE TABLE IF NOT EXISTS public.brands (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ۴. ساخت جدول کالاها (Products) با تمام فیلدهای استاندارد سامانه
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  brand TEXT DEFAULT 'متفرقه',
  price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
  visitor_price NUMERIC DEFAULT 0,
  consumer_price NUMERIC,
  stock NUMERIC NOT NULL DEFAULT 0,
  reserved_stock NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'عدد',
  items_per_package NUMERIC,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_market_test BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT stock_non_negative CHECK (stock >= 0),
  CONSTRAINT reserved_stock_non_negative CHECK (reserved_stock >= 0)
);

-- ۵. اضافه کردن ستون‌های جدید به جدول کالاها (در صورت وجود جدول از قبل)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT 'متفرقه';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS visitor_price NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS consumer_price NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS items_per_package NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_market_test BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'عدد';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ۶. ساخت جدول تاریخچه قیمت‌ها
CREATE TABLE IF NOT EXISTS public.product_price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  old_price NUMERIC,
  new_price NUMERIC,
  old_visitor_price NUMERIC,
  new_visitor_price NUMERIC,
  changed_by TEXT DEFAULT 'ویرایش اکسل',
  changed_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ۷. ساخت جدول تراکنش‌های انبار (برای ثبت ورود بار به انبار)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  transaction_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ۸. رفع محدودیت‌های RLS (Row Level Security) برای ثبت دسته‌جمعی از اکسل
-- این بخش مشکل اصلی خطای "new row violates row-level security policy" را به طور کامل برطرف می‌کند:

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_open_all" ON public.products;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;
DROP POLICY IF EXISTS "products_write_policy" ON public.products;
DROP POLICY IF EXISTS "Allow read products for authenticated" ON public.products;
DROP POLICY IF EXISTS "Admin/Warehouse manage products" ON public.products;
DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Public write products" ON public.products;
CREATE POLICY "products_open_all" ON public.products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_open_all" ON public.categories;
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_write_policy" ON public.categories;
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
DROP POLICY IF EXISTS "Public write categories" ON public.categories;
CREATE POLICY "categories_open_all" ON public.categories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brands_open_all" ON public.brands;
DROP POLICY IF EXISTS "brands_select_policy" ON public.brands;
DROP POLICY IF EXISTS "brands_write_policy" ON public.brands;
DROP POLICY IF EXISTS "Public read brands" ON public.brands;
DROP POLICY IF EXISTS "Public write brands" ON public.brands;
CREATE POLICY "brands_open_all" ON public.brands FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_price_history_open_all" ON public.product_price_history;
CREATE POLICY "product_price_history_open_all" ON public.product_price_history FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_transactions_open_all" ON public.inventory_transactions;
CREATE POLICY "inventory_transactions_open_all" ON public.inventory_transactions FOR ALL USING (true) WITH CHECK (true);

-- ۹. ساخت ایندکس‌ها برای سرعت بالای جستجو و کاتالوگ
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_prod ON public.inventory_transactions(product_id);
