-- Migration: Supabase Auth, Catalog & Synchronization Fixes
-- Safe, clean and idempotent: NO default brands or products are inserted

-- 1. Enable 'loading' status and loading_bill_id on orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('assigned', 'loading', 'delegated', 'delivered', 'undelivered'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS loading_bill_id TEXT REFERENCES loading_bills(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_loading_bill ON orders(loading_bill_id);

-- 2. Add brand, consumer_price, visitor_price columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT 'متفرقه';
ALTER TABLE products ADD COLUMN IF NOT EXISTS visitor_price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS consumer_price NUMERIC;
ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;

-- 3. Create Brands Table if it doesn't exist (NO DEFAULT BRANDS INSERTED)
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Adjust foreign keys on order_items, loading_bill_items, inventory_transactions to ON DELETE CASCADE
-- This guarantees deleting a product cleanly cleans up its audit ledger without foreign key violation errors
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE loading_bill_items DROP CONSTRAINT IF EXISTS loading_bill_items_product_id_fkey;
ALTER TABLE loading_bill_items ADD CONSTRAINT loading_bill_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_product_id_fkey;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- 5. Clean up any previous mock/demo records completely
DELETE FROM inventory_transactions WHERE product_id LIKE 'prod-%' OR product_id IN (
  SELECT id FROM products WHERE name IN (
    'بستنی مگنوم شکلاتی میهن',
    'بستنی عروسکی دومینو',
    'بستنی سالار شاهتوت کاله',
    'بستنی لیتری وانیلی پاک',
    'سوسیس کوکتل ۸۰٪ دمس (۱ کیلوگرم)',
    'سوسیس کوکتل ۸۰٪ دمس',
    'کالباس ژامبون مرغ ۹۰٪ سولیکو',
    'همبرگر ۹۰٪ ممتاز کاله (بسته ۴ عددی)',
    'همبرگر ۹۰٪ ممتاز کاله',
    'ناگت مرغ ۷۰٪ ب آ (۹۰۰ گرمی)',
    'ناگت مرغ ۷۰٪ ب آ',
    'فیله مرغ سوخاری پامچال'
  )
);

DELETE FROM loading_bill_items WHERE product_id LIKE 'prod-%' OR product_id IN (
  SELECT id FROM products WHERE name IN (
    'بستنی مگنوم شکلاتی میهن',
    'بستنی عروسکی دومینو',
    'بستنی سالار شاهتوت کاله',
    'بستنی لیتری وانیلی پاک',
    'سوسیس کوکتل ۸۰٪ دمس (۱ کیلوگرم)',
    'سوسیس کوکتل ۸۰٪ دمس',
    'کالباس ژامبون مرغ ۹۰٪ سولیکو',
    'همبرگر ۹۰٪ ممتاز کاله (بسته ۴ عددی)',
    'همبرگر ۹۰٪ ممتاز کاله',
    'ناگت مرغ ۷۰٪ ب آ (۹۰۰ گرمی)',
    'ناگت مرغ ۷۰٪ ب آ',
    'فیله مرغ سوخاری پامچال'
  )
);

DELETE FROM order_items WHERE product_id LIKE 'prod-%' OR product_id IN (
  SELECT id FROM products WHERE name IN (
    'بستنی مگنوم شکلاتی میهن',
    'بستنی عروسکی دومینو',
    'بستنی سالار شاهتوت کاله',
    'بستنی لیتری وانیلی پاک',
    'سوسیس کوکتل ۸۰٪ دمس (۱ کیلوگرم)',
    'سوسیس کوکتل ۸۰٪ دمس',
    'کالباس ژامبون مرغ ۹۰٪ سولیکو',
    'همبرگر ۹۰٪ ممتاز کاله (بسته ۴ عددی)',
    'همبرگر ۹۰٪ ممتاز کاله',
    'ناگت مرغ ۷۰٪ ب آ (۹۰۰ گرمی)',
    'ناگت مرغ ۷۰٪ ب آ',
    'فیله مرغ سوخاری پامچال'
  )
);

-- Delete mock products
DELETE FROM products WHERE id LIKE 'prod-%' OR name IN (
  'بستنی مگنوم شکلاتی میهن',
  'بستنی عروسکی دومینو',
  'بستنی سالار شاهتوت کاله',
  'بستنی لیتری وانیلی پاک',
  'سوسیس کوکتل ۸۰٪ دمس (۱ کیلوگرم)',
  'سوسیس کوکتل ۸۰٪ دمس',
  'کالباس ژامبون مرغ ۹۰٪ سولیکو',
  'همبرگر ۹۰٪ ممتاز کاله (بسته ۴ عددی)',
  'همبرگر ۹۰٪ ممتاز کاله',
  'ناگت مرغ ۷۰٪ ب آ (۹۰۰ گرمی)',
  'ناگت مرغ ۷۰٪ ب آ',
  'فیله مرغ سوخاری پامچال'
);

-- Clean mock orders
DELETE FROM orders WHERE id LIKE 'ord-%';

-- Clean mock brands
DELETE FROM brands WHERE id LIKE 'b-%';

-- 6. RLS Fixes: Allow self-registration for new users/supermarkets
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "Supermarkets can insert own record" ON supermarkets;
CREATE POLICY "Supermarkets can insert own record" ON supermarkets
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "Supermarkets can update own record" ON supermarkets;
CREATE POLICY "Supermarkets can update own record" ON supermarkets
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text);

-- 7. Stored Procedure: Release Reserved Stock on Undelivered Order
CREATE OR REPLACE FUNCTION release_order_reserved_stock(p_order_id TEXT)
RETURNS VOID AS $$
DECLARE
  item RECORD;
BEGIN
  -- Release reserved stock for items in this order
  FOR item IN 
    SELECT product_id, quantity 
    FROM order_items 
    WHERE order_id = p_order_id
  LOOP
    UPDATE products 
    SET reserved_stock = GREATEST(0, reserved_stock - item.quantity)
    WHERE id = item.product_id;

    -- Add Inventory Ledger record
    INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id)
    VALUES (item.product_id, 'release_reserve', -item.quantity, p_order_id);
  END LOOP;

  -- Update order status to undelivered
  UPDATE orders SET status = 'undelivered' WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Open Read/Write RLS Permissions on Catalog (Products, Categories, Brands)
-- 8.1 Products Table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read products for authenticated" ON products;
DROP POLICY IF EXISTS "Admin/Warehouse manage products" ON products;
DROP POLICY IF EXISTS "Public read products" ON products;
DROP POLICY IF EXISTS "Public write products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public write products" ON products FOR ALL USING (true) WITH CHECK (true);

-- 8.2 Categories Table
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read categories for authenticated" ON categories;
DROP POLICY IF EXISTS "Admin manage categories" ON categories;
DROP POLICY IF EXISTS "Public read categories" ON categories;
DROP POLICY IF EXISTS "Public write categories" ON categories;
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public write categories" ON categories FOR ALL USING (true) WITH CHECK (true);

-- 8.3 Brands Table
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read brands for authenticated" ON brands;
DROP POLICY IF EXISTS "Admin manage brands" ON brands;
DROP POLICY IF EXISTS "Public read brands" ON brands;
DROP POLICY IF EXISTS "Public write brands" ON brands;
CREATE POLICY "Public read brands" ON brands FOR SELECT USING (true);
CREATE POLICY "Public write brands" ON brands FOR ALL USING (true) WITH CHECK (true);
