-- Migration: Supabase Auth & Synchronization Fixes
-- Run in Supabase Dashboard SQL Editor

-- 1. Enable 'loading' status and loading_bill_id on orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('assigned', 'loading', 'delegated', 'delivered', 'undelivered'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS loading_bill_id TEXT REFERENCES loading_bills(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_loading_bill ON orders(loading_bill_id);

-- 2. Add brand and visitor_price support
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS visitor_price NUMERIC;

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read brands for authenticated" ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage brands" ON brands FOR ALL TO authenticated USING (get_user_role() IN ('admin', 'superadmin'));

-- Seed initial brands if not present
INSERT INTO brands (id, name) VALUES
('b-1', 'میهن'),
('b-2', 'دومینو'),
('b-3', 'کاله'),
('b-4', 'سن‌ایچ'),
('b-5', 'پاک'),
('b-6', 'دمس'),
('b-7', 'سولیکو'),
('b-8', 'ب آ'),
('b-9', 'پامچال'),
('b-10', 'دامداران'),
('b-11', 'عالیس'),
('b-12', 'آناتا'),
('b-13', 'شیرین عسل')
ON CONFLICT (id) DO NOTHING;

-- 3. RLS Fixes: Allow self-registration for new users/supermarkets
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

-- 4. Stored Procedure: Release Reserved Stock on Undelivered Order
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
