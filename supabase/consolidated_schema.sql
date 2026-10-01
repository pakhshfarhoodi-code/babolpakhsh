-- ==============================================================================
-- Farhoodi Frozen Food Distribution System (صنایع برودتی فرهودی)
-- Full Consolidated Supabase Database Schema & All Migrations
-- Generated: 2026-10-01
-- ==============================================================================
-- This single script contains the full base schema and all subsequent migrations
-- (Auth fixes, Deletion cascades, Visitor Invoices, Loading Bills V2,
-- Admin Visitor Invoices Audit, and Warehouse Step App Settings).
-- It can be safely executed in the Supabase SQL Editor.
-- ==============================================================================


-- ==============================================================================
-- SECTION: 00_supabase_schema.sql
-- ==============================================================================

-- SQL Schema for بارفروش | شبکه پخش عمده فرهودی (Barforoosh - Farhoodi Distribution System)
-- Optimized for MVP: Supabase / PostgreSQL with Reserved Stock & Audited Workflows

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Profiles Table (Role-based Unified Access)
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, -- Standalone ID / linked to auth.users
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'warehouse', 'visitor', 'supermarket')),
  phone TEXT UNIQUE,
  username TEXT,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Categories Table
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Products Table (With physical stock & reserved_stock separation)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'عدد',
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Database-level check constraints to guarantee physical integrity
  CONSTRAINT stock_non_negative CHECK (stock >= 0),
  CONSTRAINT reserved_stock_non_negative CHECK (reserved_stock >= 0)
);

-- 5. Create Product Price History (Auditable historical rates)
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  changed_by TEXT DEFAULT 'admin',
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Visitors Table
CREATE TABLE visitors (
  id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  region TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create Supermarkets Table
CREATE TABLE supermarkets (
  id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  assigned_visitor_id TEXT REFERENCES visitors(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create Orders Table
-- visitor_id renamed to assigned_visitor_id. original_visitor_id completely removed.
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  supermarket_id TEXT REFERENCES supermarkets(id) ON DELETE SET NULL,
  supermarket_name TEXT NOT NULL,
  assigned_visitor_id TEXT REFERENCES visitors(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'loading', 'delegated', 'delivered', 'undelivered')),
  total_amount NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  order_source TEXT DEFAULT 'supermarket',
  order_channel TEXT DEFAULT 'store_self' CHECK (order_channel IN ('visitor_field', 'store_self', 'store_direct')),
  reassignment_id TEXT, -- References reassignment_requests if under negotiation
  loading_bill_id TEXT REFERENCES loading_bills(id) ON DELETE SET NULL,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create Order Items (Line Items with locked price_at_submission)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0), -- Saved price at moment of ordering
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create Order Visitor Delegation History
CREATE TABLE order_visitor_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  old_visitor_id TEXT REFERENCES visitors(id) ON DELETE SET NULL,
  new_visitor_id TEXT REFERENCES visitors(id) ON DELETE RESTRICT,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Create Reassignment Requests Table (Inter-visitor proposal transfers)
CREATE TABLE reassignment_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  supermarket_name TEXT NOT NULL,
  from_visitor_id TEXT REFERENCES visitors(id) ON DELETE CASCADE,
  from_visitor_name TEXT NOT NULL,
  to_visitor_id TEXT REFERENCES visitors(id) ON DELETE SET NULL, -- NULL means open broadcast
  to_visitor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Create Loading Bills (Barghiri documents for Cold-Chain dispatching)
CREATE TABLE loading_bills (
  id TEXT PRIMARY KEY,
  visitor_id TEXT REFERENCES visitors(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled')),
  orders_count INT DEFAULT 0,
  total_visitor_cost NUMERIC DEFAULT 0,
  total_store_amount NUMERIC DEFAULT 0,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  cancelled_by TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Create Loading Bill Items (Connecting physical stock to dispatch items)
CREATE TABLE loading_bill_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loading_bill_id TEXT REFERENCES loading_bills(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  visitor_price NUMERIC,
  store_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Create Inventory Transactions Table (Double-entry stock audit ledger)
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('reserve', 'release_reserve', 'load_out', 'return', 'manual_adjustment', 'manual_delivery_override')),
  quantity INTEGER NOT NULL, -- Quantity affected
  reference_id TEXT, -- Matches order_id, loading_bill_id, or manual adjustment tag
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Create Indexes for High Performance Queries
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_supermarkets_visitor ON supermarkets(assigned_visitor_id);
CREATE INDEX idx_orders_assigned_visitor ON orders(assigned_visitor_id);
CREATE INDEX idx_orders_supermarket ON orders(supermarket_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_reassignments_from ON reassignment_requests(from_visitor_id);
CREATE INDEX idx_loading_bills_visitor ON loading_bills(visitor_id);
CREATE INDEX idx_loading_bill_items_bill ON loading_bill_items(loading_bill_id);
CREATE INDEX idx_inventory_tx_product ON inventory_transactions(product_id);

-- 16. Stored Procedure: Submit Order (Atomic transaction registering reserving stock)
CREATE OR REPLACE FUNCTION create_order_transaction(
  p_order_id TEXT,
  p_supermarket_id TEXT,
  p_supermarket_name TEXT,
  p_assigned_visitor_id TEXT,
  p_visitor_name TEXT,
  p_status TEXT,
  p_total_amount NUMERIC,
  p_items JSONB
) RETURNS JSON AS $$
DECLARE
  item JSONB;
  v_assigned_vis TEXT;
  v_sm_id TEXT;
BEGIN
  -- Sanitize visitor ID: if 'direct' or not present in visitors, use NULL
  IF p_assigned_visitor_id IS NOT NULL AND p_assigned_visitor_id != 'direct' THEN
    IF EXISTS (SELECT 1 FROM public.visitors WHERE id = p_assigned_visitor_id) THEN
      v_assigned_vis := p_assigned_visitor_id;
    ELSE
      v_assigned_vis := NULL;
    END IF;
  ELSE
    v_assigned_vis := NULL;
  END IF;

  -- Sanitize supermarket ID: if not present in supermarkets, use NULL to avoid FK error
  IF p_supermarket_id IS NOT NULL AND p_supermarket_id != '' THEN
    IF EXISTS (SELECT 1 FROM public.supermarkets WHERE id = p_supermarket_id) THEN
      v_sm_id := p_supermarket_id;
    ELSE
      v_sm_id := NULL;
    END IF;
  ELSE
    v_sm_id := NULL;
  END IF;

  -- Insert or replace Order with assigned visitor
  INSERT INTO orders (id, supermarket_id, supermarket_name, assigned_visitor_id, visitor_name, status, total_amount, order_date)
  VALUES (
    p_order_id, 
    v_sm_id, 
    p_supermarket_name, 
    v_assigned_vis, 
    COALESCE(p_visitor_name, 'خرید مستقیم از پخش مرکزی'), 
    COALESCE(p_status, 'assigned'), 
    p_total_amount,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    supermarket_name = EXCLUDED.supermarket_name,
    assigned_visitor_id = EXCLUDED.assigned_visitor_id,
    visitor_name = EXCLUDED.visitor_name,
    status = EXCLUDED.status,
    total_amount = EXCLUDED.total_amount;

  -- Process line items, allocate reserved stock, audit ledger
  IF p_items IS NOT NULL THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      -- Increment reserved_stock
      UPDATE products 
      SET reserved_stock = COALESCE(reserved_stock, 0) + (item->>'quantity')::INTEGER 
      WHERE id = item->>'productId';

      -- Log transaction in ledger
      INSERT INTO inventory_transactions (id, product_id, transaction_type, quantity, reference_id, created_at)
      VALUES (
        'tx-' || extract(epoch from now())::bigint || '-' || (item->>'productId'),
        item->>'productId', 
        'reserve', 
        (item->>'quantity')::INTEGER, 
        p_order_id,
        NOW()
      );

      -- Insert Item Detail
      INSERT INTO order_items (order_id, product_id, name, price, quantity)
      VALUES (
        p_order_id,
        item->>'productId',
        item->>'name',
        (item->>'price')::NUMERIC,
        (item->>'quantity')::INTEGER
      );
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'message', 'سفارش با موفقیت ثبت شد.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. Stored Procedure: Create Loading Bill (Atomically issue loading bill with price snapshots)
CREATE OR REPLACE FUNCTION create_loading_bill_transaction(
  p_bill_id TEXT,
  p_visitor_id TEXT,
  p_order_ids TEXT[]
) RETURNS JSON AS $$
DECLARE
  v_visitor_name TEXT;
  v_orders_count INT;
  v_found_count INT;
  v_total_store NUMERIC := 0;
  v_total_visitor NUMERIC := 0;
  ord RECORD;
  it RECORD;
  v_store_p NUMERIC;
  v_vis_p NUMERIC;
BEGIN
  IF p_order_ids IS NULL OR array_length(p_order_ids, 1) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'لیست سفارش‌های انتخاب شده خالی است.');
  END IF;

  v_orders_count := array_length(p_order_ids, 1);

  -- 1. Lock orders for update and check existence
  SELECT COUNT(*) INTO v_found_count 
  FROM public.orders 
  WHERE id = ANY(p_order_ids) 
  FOR UPDATE;

  IF v_found_count != v_orders_count THEN
    RETURN json_build_object('success', false, 'message', 'تعدادی از سفارش‌های انتخابی در سیستم یافت نشدند.');
  END IF;

  -- 2. Verify all orders have status = 'assigned'
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ANY(p_order_ids) AND status != 'assigned') THEN
    RETURN json_build_object('success', false, 'message', 'تنها سفارش‌های در وضعیت «آماده ارسال» قابلیت درج در حواله بارگیری را دارند.');
  END IF;

  -- 3. Verify all orders have loading_bill_id IS NULL
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ANY(p_order_ids) AND loading_bill_id IS NOT NULL) THEN
    RETURN json_build_object('success', false, 'message', 'برخی از سفارش‌های انتخابی قبلاً به حواله بارگیری دیگری متصل شده‌اند.');
  END IF;

  -- 4. Verify all orders belong to the specified visitor
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ANY(p_order_ids) AND (assigned_visitor_id IS DISTINCT FROM p_visitor_id)) THEN
    RETURN json_build_object('success', false, 'message', 'تمامی سفارش‌های انتخابی باید متعلق به ویزیتور صادرکننده برگه باشند.');
  END IF;

  -- Find visitor name
  SELECT name INTO v_visitor_name FROM public.visitors WHERE id = p_visitor_id;
  IF v_visitor_name IS NULL THEN
    SELECT visitor_name INTO v_visitor_name FROM public.orders WHERE id = p_order_ids[1];
  END IF;
  IF v_visitor_name IS NULL THEN
    v_visitor_name := 'ویزیتور';
  END IF;

  -- Calculate totals and insert bill items with current snapshot prices
  FOR ord IN SELECT id, total_amount FROM public.orders WHERE id = ANY(p_order_ids) LOOP
    FOR it IN 
      SELECT oi.order_id, oi.product_id, oi.name, oi.quantity, oi.price AS item_price,
             p.price AS current_product_price, p.visitor_price AS current_visitor_price
      FROM public.order_items oi
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = ord.id 
    LOOP
      v_store_p := COALESCE(it.current_product_price, it.item_price, 0);
      v_vis_p := COALESCE(it.current_visitor_price, ROUND(v_store_p * 0.85), 0);

      v_total_store := v_total_store + (v_store_p * it.quantity);
      v_total_visitor := v_total_visitor + (v_vis_p * it.quantity);

      INSERT INTO public.loading_bill_items (
        loading_bill_id,
        order_id,
        product_id,
        product_name,
        quantity,
        visitor_price,
        store_price,
        created_at
      ) VALUES (
        p_bill_id,
        it.order_id,
        it.product_id,
        it.name,
        it.quantity,
        v_vis_p,
        v_store_p,
        NOW()
      );
    END LOOP;
  END LOOP;

  -- Insert loading bill record
  INSERT INTO public.loading_bills (
    id,
    visitor_id,
    visitor_name,
    status,
    created_at,
    orders_count,
    total_visitor_cost,
    total_store_amount
  ) VALUES (
    p_bill_id,
    p_visitor_id,
    v_visitor_name,
    'pending',
    NOW(),
    v_orders_count,
    v_total_visitor,
    v_total_store
  );

  -- Transition orders to 'loading' status and link to the loading bill
  UPDATE public.orders 
  SET status = 'loading', 
      loading_bill_id = p_bill_id 
  WHERE id = ANY(p_order_ids);

  RETURN json_build_object(
    'success', true, 
    'message', 'برگه بارگیری با موفقیت صادر و به انبار ارسال شد.',
    'bill_id', p_bill_id,
    'orders_count', v_orders_count,
    'total_store_amount', v_total_store,
    'total_visitor_cost', v_total_visitor
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. Stored Procedure: Cancel Loading Bill
CREATE OR REPLACE FUNCTION cancel_loading_bill_transaction(
  p_bill_id TEXT,
  p_cancelled_by TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_bill RECORD;
BEGIN
  SELECT * INTO v_bill FROM public.loading_bills WHERE id = p_bill_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'برگه بارگیری مورد نظر یافت نشد.');
  END IF;

  IF v_bill.status != 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'تنها برگه‌های در انتظار تایید (pending) امکان لغو دارند.');
  END IF;

  UPDATE public.loading_bills
  SET status = 'cancelled',
      cancelled_by = COALESCE(p_cancelled_by, 'سیستم'),
      cancelled_at = NOW(),
      cancel_reason = p_reason
  WHERE id = p_bill_id;

  UPDATE public.orders
  SET status = 'assigned',
      loading_bill_id = NULL
  WHERE loading_bill_id = p_bill_id;

  RETURN json_build_object('success', true, 'message', 'برگه بارگیری با موفقیت لغو شد و سفارش‌ها به وضعیت آماده ارسال بازگشتند.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 19. Stored Procedure: Approve Loading Bill (Commit delivery dispatch & subtract physical stocks)
CREATE OR REPLACE FUNCTION approve_loading_bill_transaction(
  p_loading_bill_id TEXT,
  p_approved_by TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_bill RECORD;
  item RECORD;
BEGIN
  SELECT * INTO v_bill FROM public.loading_bills WHERE id = p_loading_bill_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'برگه بارگیری یافت نشد.');
  END IF;

  IF v_bill.status != 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'این برگه قبلاً تایید یا لغو شده است.');
  END IF;

  -- Update Loading Bill Status
  UPDATE public.loading_bills 
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = COALESCE(p_approved_by, 'انباردار')
  WHERE id = p_loading_bill_id;

  -- Subtract physical stock & reserved stock, write audit trails
  FOR item IN 
    SELECT product_id, sum(quantity) as total_qty 
    FROM public.loading_bill_items 
    WHERE loading_bill_id = p_loading_bill_id 
    GROUP BY product_id
  LOOP
    -- Subtract physical stock and reserved stock
    UPDATE public.products 
    SET stock = GREATEST(0, stock - item.total_qty),
        reserved_stock = GREATEST(0, reserved_stock - item.total_qty)
    WHERE id = item.product_id;

    -- Add Inventory Ledger record for physical dispatch
    INSERT INTO public.inventory_transactions (id, product_id, transaction_type, quantity, reference_id, created_at)
    VALUES (
      'tx-' || extract(epoch from now())::bigint || '-out-' || item.product_id,
      item.product_id, 
      'load_out', 
      item.total_qty, 
      p_loading_bill_id,
      NOW()
    );
    
    -- Release reservation trace
    INSERT INTO public.inventory_transactions (id, product_id, transaction_type, quantity, reference_id, created_at)
    VALUES (
      'tx-' || extract(epoch from now())::bigint || '-rel-' || item.product_id,
      item.product_id, 
      'release_reserve', 
      -item.total_qty, 
      p_loading_bill_id,
      NOW()
    );
  END LOOP;

  UPDATE public.orders
  SET stock_deducted = TRUE
  WHERE loading_bill_id = p_loading_bill_id;

  RETURN json_build_object('success', true, 'message', 'برگه بارگیری با موفقیت تایید و خروج از انبار انجام شد.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. Row-Level Security (RLS) Configuration (Enterprise Grade Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermarkets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_visitor_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reassignment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loading_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE loading_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Helper SQL Function to securely retrieve authenticated user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT coalesce((SELECT role FROM public.profiles WHERE id = auth.uid()::text), '');
$$ LANGUAGE sql SECURITY DEFINER;

-- 18.1. Profiles Policies
CREATE POLICY "Allow read profiles for authenticated" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL TO authenticated USING (get_user_role() IN ('admin', 'superadmin'));
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid()::text);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()::text);

-- 18.2. Categories Policies
CREATE POLICY "Allow read categories for authenticated" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage categories" ON categories FOR ALL TO authenticated USING (get_user_role() IN ('admin', 'superadmin'));

-- 18.3. Products Policies
CREATE POLICY "Allow read products for authenticated" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Warehouse manage products" ON products FOR ALL TO authenticated USING (get_user_role() IN ('admin', 'superadmin', 'warehouse'));

-- 18.4. Product Price History Policies
CREATE POLICY "Admin/Warehouse read price history" ON product_price_history FOR SELECT TO authenticated USING (get_user_role() IN ('admin', 'superadmin', 'warehouse'));
CREATE POLICY "Admin write price history" ON product_price_history FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('admin', 'superadmin'));

-- 18.5. Visitors Policies
CREATE POLICY "Read visitors for authenticated" ON visitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage visitors" ON visitors FOR ALL TO authenticated USING (get_user_role() IN ('admin', 'superadmin'));

-- 18.6. Supermarkets Policies
CREATE POLICY "Supermarkets read policy" ON supermarkets FOR SELECT TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin', 'warehouse') OR
  (get_user_role() = 'visitor' AND assigned_visitor_id = auth.uid()::text) OR
  (get_user_role() = 'supermarket' AND id = auth.uid()::text)
);
CREATE POLICY "Admin manage supermarkets" ON supermarkets FOR ALL TO authenticated USING (get_user_role() IN ('admin', 'superadmin'));
CREATE POLICY "Supermarkets can insert own record" ON supermarkets FOR INSERT TO authenticated WITH CHECK (id = auth.uid()::text);
CREATE POLICY "Supermarkets can update own record" ON supermarkets FOR UPDATE TO authenticated USING (id = auth.uid()::text);

-- 18.7. Orders Policies
CREATE POLICY "Orders read policy" ON orders FOR SELECT TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin', 'warehouse') OR
  (get_user_role() = 'visitor' AND assigned_visitor_id = auth.uid()::text) OR
  (get_user_role() = 'supermarket' AND supermarket_id = auth.uid()::text)
);
CREATE POLICY "Orders insert policy" ON orders FOR INSERT TO authenticated WITH CHECK (
  get_user_role() IN ('admin', 'superadmin') OR
  (get_user_role() = 'visitor' AND assigned_visitor_id = auth.uid()::text) OR
  (get_user_role() = 'supermarket' AND supermarket_id = auth.uid()::text)
);
CREATE POLICY "Orders update policy" ON orders FOR UPDATE TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin', 'warehouse') OR
  (get_user_role() = 'visitor' AND assigned_visitor_id = auth.uid()::text)
);

-- 18.8. Order Items Policies
CREATE POLICY "Order items read policy" ON order_items FOR SELECT TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin', 'warehouse') OR
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id AND (
      orders.assigned_visitor_id = auth.uid()::text OR 
      orders.supermarket_id = auth.uid()::text
    )
  )
);
CREATE POLICY "Order items insert policy" ON order_items FOR INSERT TO authenticated WITH CHECK (
  get_user_role() IN ('admin', 'superadmin') OR
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id AND (
      orders.assigned_visitor_id = auth.uid()::text OR 
      orders.supermarket_id = auth.uid()::text
    )
  )
);

-- 18.9. Order Visitor History Policies
CREATE POLICY "Read order history for authenticated" ON order_visitor_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Visitor insert order history" ON order_visitor_history FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('admin', 'superadmin', 'visitor'));

-- 18.10. Reassignment Requests Policies
CREATE POLICY "Reassignments select policy" ON reassignment_requests FOR SELECT TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin') OR get_user_role() = 'visitor'
);
CREATE POLICY "Reassignments write policy" ON reassignment_requests FOR ALL TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin') OR get_user_role() = 'visitor'
);

-- 18.11. Loading Bills Policies
CREATE POLICY "Loading bills select policy" ON loading_bills FOR SELECT TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin', 'warehouse') OR
  (get_user_role() = 'visitor' AND visitor_id = auth.uid()::text)
);
CREATE POLICY "Loading bills write policy" ON loading_bills FOR ALL TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin', 'warehouse')
);

-- 18.12. Loading Bill Items Policies
CREATE POLICY "Loading bill items select policy" ON loading_bill_items FOR SELECT TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin', 'warehouse') OR
  EXISTS (
    SELECT 1 FROM public.loading_bills 
    WHERE loading_bills.id = loading_bill_items.loading_bill_id AND 
    loading_bills.visitor_id = auth.uid()::text
  )
);
CREATE POLICY "Loading bill items insert policy" ON loading_bill_items FOR INSERT TO authenticated WITH CHECK (
  get_user_role() IN ('admin', 'superadmin', 'warehouse')
);

-- 18.13. Inventory Transactions Policies
CREATE POLICY "Inventory tx select policy" ON inventory_transactions FOR SELECT TO authenticated USING (
  get_user_role() IN ('admin', 'superadmin', 'warehouse')
);
CREATE POLICY "Inventory tx insert policy" ON inventory_transactions FOR INSERT TO authenticated WITH CHECK (
  get_user_role() IN ('admin', 'superadmin', 'warehouse')
);

-- 19. Seed Default Database Values (Equivalent to INITIAL_MOCK_DATA)
INSERT INTO profiles (id, name, role, phone) VALUES
('vis-1', 'علیرضا رضایی', 'visitor', '۰۹۱۲۳۴۵۶۷۸۹'),
('vis-2', 'مریم حسینی', 'visitor', '۰۹۱۹۸۷۶۵۴۳۲'),
('vis-3', 'محمد کریمی', 'visitor', '۰۹۱۸۲۲۲۳۳۴۴'),
('shop-1', 'سوپرمارکت بهاران', 'supermarket', '۰۹۱۲۱۱۱۱۱۱۱'),
('shop-2', 'سوپرمارکت ستاره شهر', 'supermarket', '۰۹۱۲۲۲۲۲۲۲۲'),
('shop-3', 'هایپرمارکت تک', 'supermarket', '۰۹۱۲۳۳۳۳۳۳۳'),
('shop-4', 'سوپرمارکت یاس', 'supermarket', '۰۹۱۲۴۴۴۴۴۴۴'),
('shop-5', 'سوپرمارکت خلیج فارس', 'supermarket', '۰۹۱۲۵۵۵۵۵۵۵'),
('admin-1', 'مدیریت مرکزی فرهودی (بارفروش)', 'admin', '09120000000'),
('wh-1', 'انباردار مرکزی فرهودی', 'warehouse', '09121110000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, sort_order) VALUES
('cat-1', 'بستنی', 'IceCream', 1),
('cat-2', 'محصولات پروتئینی', 'Beef', 2),
('cat-3', 'لبنیات', 'Milk', 3),
('cat-4', 'نوشیدنی', 'CupSoda', 4),
('cat-5', 'کیک و تنقلات', 'Cookie', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO visitors (id, name, phone, region, is_active) VALUES
('vis-1', 'علیرضا رضایی', '۰۹۱۲۳۴۵۶۷۸۹', 'منطقه ۱ (شمال تهران)', true),
('vis-2', 'مریم حسینی', '۰۹۱۹۸۷۶۵۴۳۲', 'منطقه ۲ (غرب تهران)', true),
('vis-3', 'محمد کریمی', '۰۹۱۸۲۲۲۳۳۴۴', 'منطقه ۳ (شرق تهران)', true)
ON CONFLICT (id) DO NOTHING;


-- ==============================================================================
-- SECTION: 01_auth_fixes.sql
-- ==============================================================================

-- Migration: Supabase Auth, Catalog & Synchronization Fixes
-- Safe, clean and idempotent: NO default brands or products are inserted

-- 1. Ensure profiles table has username and password columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Enable 'loading' status and loading_bill_id on orders
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

-- ==============================================================================
-- SECTION: 02_market_test.sql
-- ==============================================================================

-- ==============================================================================
-- Migration: Add Market Test Support & Product Likes Table for Barforoosh Farhoodi
-- ==============================================================================

-- 1. Add `is_market_test` column to products table if not present
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_market_test BOOLEAN DEFAULT FALSE;

-- 2. Create product_likes table for store market testing feedback
CREATE TABLE IF NOT EXISTS product_likes (
  id TEXT PRIMARY KEY DEFAULT ('like-' || floor(random() * 1000000)::text),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supermarket_id TEXT NOT NULL,
  supermarket_name TEXT,
  supermarket_owner TEXT,
  supermarket_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_product_supermarket_like UNIQUE (product_id, supermarket_id)
);

-- 3. Create Index for fast product-specific queries
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_supermarket_id ON product_likes(supermarket_id);

-- ==============================================================================
-- SECTION: 03_deletion_cascade.sql
-- ==============================================================================

-- Migration: Permanent Deletion & Invoice Archival Support (ON DELETE SET NULL)
-- This migration ensures that deleting a product, supermarket, or visitor never fails due to foreign key constraints,
-- and preserves historical invoice line items, amounts, and audit records with unlinked keys.

-- 1. Order Items: Set product_id to NULL on product delete so invoice line items (name, price, quantity) are preserved
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 2. Loading Bill Items: Set product_id to NULL on product delete
ALTER TABLE loading_bill_items DROP CONSTRAINT IF EXISTS loading_bill_items_product_id_fkey;
ALTER TABLE loading_bill_items ADD CONSTRAINT loading_bill_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 3. Inventory Transactions: Set product_id to NULL on product delete
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_product_id_fkey;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 4. Orders: Set supermarket_id to NULL on supermarket delete so historical orders/invoices remain intact
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_supermarket_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_supermarket_id_fkey 
  FOREIGN KEY (supermarket_id) REFERENCES supermarkets(id) ON DELETE SET NULL;

-- 5. Orders: Set assigned_visitor_id to NULL on visitor delete (falls back to central distribution)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_assigned_visitor_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_assigned_visitor_id_fkey 
  FOREIGN KEY (assigned_visitor_id) REFERENCES visitors(id) ON DELETE SET NULL;

-- 6. Supermarkets: Set assigned_visitor_id to NULL on visitor delete
ALTER TABLE supermarkets DROP CONSTRAINT IF EXISTS supermarkets_assigned_visitor_id_fkey;
ALTER TABLE supermarkets ADD CONSTRAINT supermarkets_assigned_visitor_id_fkey 
  FOREIGN KEY (assigned_visitor_id) REFERENCES visitors(id) ON DELETE SET NULL;

-- 7. Loading Bills: Set visitor_id to NULL on visitor delete
ALTER TABLE loading_bills DROP CONSTRAINT IF EXISTS loading_bills_visitor_id_fkey;
ALTER TABLE loading_bills ADD CONSTRAINT loading_bills_visitor_id_fkey 
  FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE SET NULL;

-- 8. Order Visitor History: Set visitor references to NULL on delete
ALTER TABLE order_visitor_history DROP CONSTRAINT IF EXISTS order_visitor_history_new_visitor_id_fkey;
ALTER TABLE order_visitor_history ADD CONSTRAINT order_visitor_history_new_visitor_id_fkey 
  FOREIGN KEY (new_visitor_id) REFERENCES visitors(id) ON DELETE SET NULL;

ALTER TABLE order_visitor_history DROP CONSTRAINT IF EXISTS order_visitor_history_old_visitor_id_fkey;
ALTER TABLE order_visitor_history ADD CONSTRAINT order_visitor_history_old_visitor_id_fkey 
  FOREIGN KEY (old_visitor_id) REFERENCES visitors(id) ON DELETE SET NULL;

-- 9. Reassignment Requests: CASCADE or SET NULL
ALTER TABLE reassignment_requests DROP CONSTRAINT IF EXISTS reassignment_requests_from_visitor_id_fkey;
ALTER TABLE reassignment_requests ADD CONSTRAINT reassignment_requests_from_visitor_id_fkey 
  FOREIGN KEY (from_visitor_id) REFERENCES visitors(id) ON DELETE SET NULL;

ALTER TABLE reassignment_requests DROP CONSTRAINT IF EXISTS reassignment_requests_to_visitor_id_fkey;
ALTER TABLE reassignment_requests ADD CONSTRAINT reassignment_requests_to_visitor_id_fkey 
  FOREIGN KEY (to_visitor_id) REFERENCES visitors(id) ON DELETE SET NULL;

-- ==============================================================================
-- SECTION: 04_direct_orders_fix.sql
-- ==============================================================================

-- Migration: Fix direct orders registration, RLS policies, and foreign key constraints
-- File: supabase_migration_direct_orders_fix.sql

-- 1. Ensure orders table allows NULL for assigned_visitor_id (for direct orders without visitor)
ALTER TABLE public.orders ALTER COLUMN assigned_visitor_id DROP NOT NULL;

-- 2. Ensure orders table allows NULL for supermarket_id (so orders are never rejected on foreign key constraint)
ALTER TABLE public.orders ALTER COLUMN supermarket_id DROP NOT NULL;

-- 3. Add order_source column to orders table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_source'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN order_source TEXT DEFAULT 'supermarket';
    END IF;
END $$;

-- 4. Update foreign key constraints to ON DELETE SET NULL
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_assigned_visitor_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_assigned_visitor_id_fkey 
    FOREIGN KEY (assigned_visitor_id) REFERENCES public.visitors(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_supermarket_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_supermarket_id_fkey 
    FOREIGN KEY (supermarket_id) REFERENCES public.supermarkets(id) ON DELETE SET NULL;

-- 5. Open RLS permissions for orders and order_items (Public / Authenticated read and write)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public write orders" ON public.orders;
CREATE POLICY "Public write orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read order_items" ON public.order_items;
CREATE POLICY "Public read order_items" ON public.order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public write order_items" ON public.order_items;
CREATE POLICY "Public write order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Public read inventory_transactions" ON public.inventory_transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public write inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Public write inventory_transactions" ON public.inventory_transactions FOR ALL USING (true) WITH CHECK (true);

-- 6. Update create_order_transaction stored procedure with SECURITY DEFINER and robust handling
CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_order_id TEXT,
  p_supermarket_id TEXT,
  p_supermarket_name TEXT,
  p_assigned_visitor_id TEXT,
  p_visitor_name TEXT,
  p_status TEXT,
  p_total_amount NUMERIC,
  p_items JSONB
) RETURNS JSON AS $$
DECLARE
  item JSONB;
  v_assigned_vis TEXT;
  v_sm_id TEXT;
BEGIN
  -- Sanitize visitor ID: if 'direct' or not present in visitors, use NULL
  IF p_assigned_visitor_id IS NOT NULL AND p_assigned_visitor_id != 'direct' THEN
    IF EXISTS (SELECT 1 FROM public.visitors WHERE id = p_assigned_visitor_id) THEN
      v_assigned_vis := p_assigned_visitor_id;
    ELSE
      v_assigned_vis := NULL;
    END IF;
  ELSE
    v_assigned_vis := NULL;
  END IF;

  -- Sanitize supermarket ID: if not present in supermarkets, use NULL to avoid FK error
  IF p_supermarket_id IS NOT NULL AND p_supermarket_id != '' THEN
    IF EXISTS (SELECT 1 FROM public.supermarkets WHERE id = p_supermarket_id) THEN
      v_sm_id := p_supermarket_id;
    ELSE
      v_sm_id := NULL;
    END IF;
  ELSE
    v_sm_id := NULL;
  END IF;

  -- Insert or replace Order
  INSERT INTO public.orders (
    id, 
    supermarket_id, 
    supermarket_name, 
    assigned_visitor_id, 
    visitor_name, 
    status, 
    total_amount,
    order_source,
    order_date
  )
  VALUES (
    p_order_id, 
    v_sm_id, 
    p_supermarket_name, 
    v_assigned_vis, 
    COALESCE(p_visitor_name, 'خرید مستقیم از پخش مرکزی'), 
    COALESCE(p_status, 'assigned'), 
    p_total_amount,
    CASE WHEN v_assigned_vis IS NULL THEN 'supermarket' ELSE 'visitor' END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    supermarket_name = EXCLUDED.supermarket_name,
    assigned_visitor_id = EXCLUDED.assigned_visitor_id,
    visitor_name = EXCLUDED.visitor_name,
    status = EXCLUDED.status,
    total_amount = EXCLUDED.total_amount;

  -- Process line items, allocate reserved stock, audit ledger
  IF p_items IS NOT NULL THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      -- Increment reserved_stock on products
      UPDATE public.products 
      SET reserved_stock = COALESCE(reserved_stock, 0) + (item->>'quantity')::INTEGER 
      WHERE id = item->>'productId';

      -- Log transaction in ledger
      INSERT INTO public.inventory_transactions (
        id,
        product_id, 
        transaction_type, 
        quantity, 
        reference_id,
        created_at
      )
      VALUES (
        'tx-' || extract(epoch from now())::bigint || '-' || (item->>'productId'),
        item->>'productId', 
        'reserve', 
        (item->>'quantity')::INTEGER, 
        p_order_id,
        NOW()
      );

      -- Insert Item Detail
      INSERT INTO public.order_items (order_id, product_id, name, price, quantity)
      VALUES (
        p_order_id,
        item->>'productId',
        item->>'name',
        (item->>'price')::NUMERIC,
        (item->>'quantity')::INTEGER
      );
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'message', 'سفارش با موفقیت در پایگاه داده ثبت گردید.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- SECTION: 05_loading_bills_v2.sql
-- ==============================================================================

-- Migration: Loading Bills V2 and Order Channel Differentiation
-- File: supabase_migration_loading_bills_v2.sql

-- 1. Add order_channel to orders table with check constraint and backfill
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_channel'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN order_channel TEXT;
    END IF;
END $$;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_channel_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_channel_check 
    CHECK (order_channel IN ('visitor_field', 'store_self', 'store_direct'));

-- Backfill existing data according to specification:
-- assigned_visitor_id = 'direct' or NULL -> store_direct
-- order_source = 'visitor' -> visitor_field
-- otherwise -> store_self
UPDATE public.orders
SET order_channel = CASE
    WHEN assigned_visitor_id = 'direct' OR assigned_visitor_id IS NULL THEN 'store_direct'
    WHEN order_source = 'visitor' THEN 'visitor_field'
    ELSE 'store_self'
END
WHERE order_channel IS NULL;

-- 2. Add new columns to loading_bills table
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS orders_count INT DEFAULT 0;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS total_visitor_cost NUMERIC DEFAULT 0;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS total_store_amount NUMERIC DEFAULT 0;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 3. Add price snapshot columns to loading_bill_items
ALTER TABLE public.loading_bill_items ADD COLUMN IF NOT EXISTS visitor_price NUMERIC;
ALTER TABLE public.loading_bill_items ADD COLUMN IF NOT EXISTS store_price NUMERIC;

-- 4. Ensure inventory_transactions check constraint is aligned with manual_delivery_override
ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;
ALTER TABLE public.inventory_transactions ADD CONSTRAINT inventory_transactions_transaction_type_check 
    CHECK (transaction_type IN ('reserve', 'release_reserve', 'load_out', 'return', 'manual_adjustment', 'manual_delivery_override'));

-- 5. RPC: create_loading_bill_transaction
-- Atomically creates a loading bill with price snapshots and locks target orders
CREATE OR REPLACE FUNCTION public.create_loading_bill_transaction(
  p_bill_id TEXT,
  p_visitor_id TEXT,
  p_order_ids TEXT[]
) RETURNS JSON AS $$
DECLARE
  v_visitor_name TEXT;
  v_orders_count INT;
  v_found_count INT;
  v_total_store NUMERIC := 0;
  v_total_visitor NUMERIC := 0;
  ord RECORD;
  it RECORD;
  v_store_p NUMERIC;
  v_vis_p NUMERIC;
BEGIN
  IF p_order_ids IS NULL OR array_length(p_order_ids, 1) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'لیست سفارش‌های انتخاب شده خالی است.');
  END IF;

  v_orders_count := array_length(p_order_ids, 1);

  -- 1. Lock orders for update and check existence
  SELECT COUNT(*) INTO v_found_count 
  FROM public.orders 
  WHERE id = ANY(p_order_ids) 
  FOR UPDATE;

  IF v_found_count != v_orders_count THEN
    RETURN json_build_object('success', false, 'message', 'تعدادی از سفارش‌های انتخابی در سیستم یافت نشدند.');
  END IF;

  -- 2. Verify all orders have status = 'assigned'
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ANY(p_order_ids) AND status != 'assigned') THEN
    RETURN json_build_object('success', false, 'message', 'تنها سفارش‌های در وضعیت «آماده ارسال» قابلیت درج در حواله بارگیری را دارند.');
  END IF;

  -- 3. Verify all orders have loading_bill_id IS NULL
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ANY(p_order_ids) AND loading_bill_id IS NOT NULL) THEN
    RETURN json_build_object('success', false, 'message', 'برخی از سفارش‌های انتخابی قبلاً به حواله بارگیری دیگری متصل شده‌اند.');
  END IF;

  -- 4. Verify all orders belong to the specified visitor
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ANY(p_order_ids) AND (assigned_visitor_id IS DISTINCT FROM p_visitor_id)) THEN
    RETURN json_build_object('success', false, 'message', 'تمامی سفارش‌های انتخابی باید متعلق به ویزیتور صادرکننده برگه باشند.');
  END IF;

  -- Find visitor name
  SELECT name INTO v_visitor_name FROM public.visitors WHERE id = p_visitor_id;
  IF v_visitor_name IS NULL THEN
    SELECT visitor_name INTO v_visitor_name FROM public.orders WHERE id = p_order_ids[1];
  END IF;
  IF v_visitor_name IS NULL THEN
    v_visitor_name := 'ویزیتور';
  END IF;

  -- Calculate totals and insert bill items with current snapshot prices
  FOR ord IN SELECT id, total_amount FROM public.orders WHERE id = ANY(p_order_ids) LOOP
    FOR it IN 
      SELECT oi.order_id, oi.product_id, oi.name, oi.quantity, oi.price AS item_price,
             p.price AS current_product_price, p.visitor_price AS current_visitor_price
      FROM public.order_items oi
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = ord.id 
    LOOP
      v_store_p := COALESCE(it.current_product_price, it.item_price, 0);
      v_vis_p := COALESCE(it.current_visitor_price, ROUND(v_store_p * 0.85), 0);

      v_total_store := v_total_store + (v_store_p * it.quantity);
      v_total_visitor := v_total_visitor + (v_vis_p * it.quantity);

      INSERT INTO public.loading_bill_items (
        loading_bill_id,
        order_id,
        product_id,
        product_name,
        quantity,
        visitor_price,
        store_price,
        created_at
      ) VALUES (
        p_bill_id,
        it.order_id,
        it.product_id,
        it.name,
        it.quantity,
        v_vis_p,
        v_store_p,
        NOW()
      );
    END LOOP;
  END LOOP;

  -- Insert loading bill record
  INSERT INTO public.loading_bills (
    id,
    visitor_id,
    visitor_name,
    status,
    created_at,
    orders_count,
    total_visitor_cost,
    total_store_amount
  ) VALUES (
    p_bill_id,
    p_visitor_id,
    v_visitor_name,
    'pending',
    NOW(),
    v_orders_count,
    v_total_visitor,
    v_total_store
  );

  -- Transition orders to 'loading' status and link to the loading bill
  UPDATE public.orders 
  SET status = 'loading', 
      loading_bill_id = p_bill_id 
  WHERE id = ANY(p_order_ids);

  RETURN json_build_object(
    'success', true, 
    'message', 'برگه بارگیری با موفقیت صادر و به انبار ارسال شد.',
    'bill_id', p_bill_id,
    'orders_count', v_orders_count,
    'total_store_amount', v_total_store,
    'total_visitor_cost', v_total_visitor
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: cancel_loading_bill_transaction
-- Cancels a pending loading bill and reverts orders to 'assigned' without touching stock
CREATE OR REPLACE FUNCTION public.cancel_loading_bill_transaction(
  p_bill_id TEXT,
  p_cancelled_by TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_bill RECORD;
BEGIN
  -- Lock loading bill
  SELECT * INTO v_bill FROM public.loading_bills WHERE id = p_bill_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'برگه بارگیری مورد نظر یافت نشد.');
  END IF;

  IF v_bill.status != 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'تنها برگه‌های در انتظار تایید (pending) امکان لغو دارند.');
  END IF;

  -- Update loading bill status to cancelled
  UPDATE public.loading_bills
  SET status = 'cancelled',
      cancelled_by = COALESCE(p_cancelled_by, 'سیستم'),
      cancelled_at = NOW(),
      cancel_reason = p_reason
  WHERE id = p_bill_id;

  -- Revert linked orders to status='assigned' and clear loading_bill_id
  UPDATE public.orders
  SET status = 'assigned',
      loading_bill_id = NULL
  WHERE loading_bill_id = p_bill_id;

  RETURN json_build_object('success', true, 'message', 'برگه بارگیری با موفقیت لغو شد و سفارش‌ها به وضعیت آماده ارسال بازگشتند.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: approve_loading_bill_transaction (Updated)
-- Confirms dispatch, deducts physical stock, sets approved_at and approved_by
CREATE OR REPLACE FUNCTION public.approve_loading_bill_transaction(
  p_loading_bill_id TEXT,
  p_approved_by TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_bill RECORD;
  item RECORD;
BEGIN
  -- Lock loading bill
  SELECT * INTO v_bill FROM public.loading_bills WHERE id = p_loading_bill_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'برگه بارگیری یافت نشد.');
  END IF;

  IF v_bill.status != 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'این برگه قبلاً تایید یا لغو شده است و قابل تایید مجدد نیست.');
  END IF;

  -- Update Loading Bill Status to approved
  UPDATE public.loading_bills 
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = COALESCE(p_approved_by, 'انباردار')
  WHERE id = p_loading_bill_id;

  -- Subtract physical stock & reserved stock, write double-entry audit trails
  FOR item IN 
    SELECT product_id, SUM(quantity) AS total_qty 
    FROM public.loading_bill_items 
    WHERE loading_bill_id = p_loading_bill_id 
    GROUP BY product_id
  LOOP
    -- Subtract physical stock and release reserved stock
    UPDATE public.products 
    SET stock = GREATEST(0, stock - item.total_qty),
        reserved_stock = GREATEST(0, reserved_stock - item.total_qty)
    WHERE id = item.product_id;

    -- Add Inventory Ledger record for physical dispatch
    INSERT INTO public.inventory_transactions (
      id, 
      product_id, 
      transaction_type, 
      quantity, 
      reference_id, 
      created_at
    ) VALUES (
      'tx-' || extract(epoch from now())::bigint || '-out-' || item.product_id,
      item.product_id, 
      'load_out', 
      item.total_qty, 
      p_loading_bill_id,
      NOW()
    );
    
    -- Release reservation trace
    INSERT INTO public.inventory_transactions (
      id, 
      product_id, 
      transaction_type, 
      quantity, 
      reference_id, 
      created_at
    ) VALUES (
      'tx-' || extract(epoch from now())::bigint || '-rel-' || item.product_id,
      item.product_id, 
      'release_reserve', 
      -item.total_qty, 
      p_loading_bill_id,
      NOW()
    );
  END LOOP;

  -- Mark associated orders as stock_deducted = true
  UPDATE public.orders
  SET stock_deducted = TRUE
  WHERE loading_bill_id = p_loading_bill_id;

  RETURN json_build_object('success', true, 'message', 'برگه بارگیری با موفقیت تایید و خروج از انبار ثبت گردید.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- SECTION: 06_return_and_delivery_fix.sql
-- ==============================================================================

-- Migration: Support product returns and manual delivery override stock deduction
-- File: supabase_migration_return_and_delivery_fix.sql

-- 1. Add stock_deducted column to orders table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'stock_deducted'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN stock_deducted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Update existing delivered orders or approved loading bill orders to stock_deducted = true
UPDATE public.orders
SET stock_deducted = TRUE
WHERE status = 'delivered' OR loading_bill_id IN (
    SELECT id FROM public.loading_bills WHERE status = 'approved'
);

-- 3. Ensure inventory_transactions insert policy covers all transaction_types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'inventory_transactions' AND policyname = 'Allow insert for inventory_transactions'
    ) THEN
        CREATE POLICY "Allow insert for inventory_transactions" ON public.inventory_transactions FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 4. Create or replace RPC function for atomic manual delivery override
CREATE OR REPLACE FUNCTION public.override_order_delivery(
    p_order_id TEXT
)
RETURNS JSON AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
BEGIN
    -- Lock order row
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'سفارش یافت نشد.');
    END IF;

    -- If stock was already deducted or order was already delivered, just update status
    IF v_order.stock_deducted = TRUE THEN
        UPDATE public.orders 
        SET status = 'delivered'
        WHERE id = p_order_id;
        
        RETURN json_build_object('success', true, 'message', 'وضعیت سفارش به تحویل شده تغییر یافت (موجودی قبلاً کسر شده بود).');
    END IF;

    -- Deduct stock and reserved_stock for each order item, and record inventory transaction
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
        -- Deduct physical stock & reserved stock
        UPDATE public.products
        SET stock = GREATEST(0, stock - v_item.quantity),
            reserved_stock = GREATEST(0, reserved_stock - v_item.quantity)
        WHERE id = v_item.product_id;

        -- Record inventory transaction
        INSERT INTO public.inventory_transactions (
            id,
            product_id,
            transaction_type,
            quantity,
            reference_id,
            created_at
        ) VALUES (
            'tx-' || extract(epoch from now())::bigint || '-ovr-' || v_item.product_id,
            v_item.product_id,
            'manual_delivery_override',
            -v_item.quantity,
            p_order_id,
            now()
        );
    END LOOP;

    -- Update order status to delivered and stock_deducted = true
    UPDATE public.orders
    SET status = 'delivered',
        stock_deducted = TRUE
    WHERE id = p_order_id;

    RETURN json_build_object('success', true, 'message', 'سفارش تحویل داده شد و موجودی فیزیکی انبار کسر گردید.');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- SECTION: 07_visitor_invoice.sql
-- ==============================================================================

-- ==============================================================================
-- Migration: Visitor Invoice System (فاکتور ویزیتور و مدیریت اقلام توافقی)
-- File: supabase_migration_visitor_invoice.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table Alterations & New Tables
-- ------------------------------------------------------------------------------

-- 1.1 Update loading_bills status constraint and backfill approved -> loaded
ALTER TABLE public.loading_bills DROP CONSTRAINT IF EXISTS loading_bills_status_check;
ALTER TABLE public.loading_bills ADD CONSTRAINT loading_bills_status_check 
    CHECK (status IN ('draft', 'pending', 'approved', 'loaded', 'cancelled'));

UPDATE public.loading_bills 
SET status = 'loaded' 
WHERE status = 'approved';

-- 1.2 Add new columns to loading_bills
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS invoice_no TEXT UNIQUE;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS finalized_by TEXT;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS revision_count INT DEFAULT 0;
ALTER TABLE public.loading_bills ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 1.3 Partial unique index: only one active draft per visitor
CREATE UNIQUE INDEX IF NOT EXISTS idx_loading_bills_visitor_draft 
    ON public.loading_bills (visitor_id) 
    WHERE status = 'draft';

-- 1.4 Update loading_bill_items: nullable order_id and new tracking columns
ALTER TABLE public.loading_bill_items ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.loading_bill_items ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'order';
ALTER TABLE public.loading_bill_items DROP CONSTRAINT IF EXISTS loading_bill_items_source_check;
ALTER TABLE public.loading_bill_items ADD CONSTRAINT loading_bill_items_source_check 
    CHECK (source IN ('order', 'visitor_manual', 'admin_manual'));

ALTER TABLE public.loading_bill_items ADD COLUMN IF NOT EXISTS customer_label TEXT;
ALTER TABLE public.loading_bill_items ADD COLUMN IF NOT EXISTS line_note TEXT;
ALTER TABLE public.loading_bill_items ADD COLUMN IF NOT EXISTS original_quantity INT;

-- Backfill original_quantity and source for existing items
UPDATE public.loading_bill_items 
SET original_quantity = quantity 
WHERE original_quantity IS NULL;

UPDATE public.loading_bill_items 
SET source = 'order' 
WHERE source IS NULL;

-- 1.5 Update orders table: add invoice_revised_at timestamp
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_revised_at TIMESTAMPTZ;

-- 1.6 Ensure inventory_transactions.id supports TEXT default without manual ID generation
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_transactions' AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.inventory_transactions ALTER COLUMN id TYPE TEXT USING id::text;
        ALTER TABLE public.inventory_transactions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;
END $$;

-- 1.7 Create invoice_audit table
CREATE TABLE IF NOT EXISTS public.invoice_audit (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id TEXT NOT NULL REFERENCES public.loading_bills(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoice_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access for invoice_audit" ON public.invoice_audit;
CREATE POLICY "Public read access for invoice_audit" ON public.invoice_audit FOR SELECT USING (true);

-- 1.8 Create app_settings table and sequence
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access for app_settings" ON public.app_settings;
CREATE POLICY "Public read access for app_settings" ON public.app_settings FOR SELECT USING (true);

INSERT INTO public.app_settings (key, value)
VALUES ('require_warehouse_step', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START WITH 1 INCREMENT BY 1;

-- ------------------------------------------------------------------------------
-- 2. Stored Procedures (RPCs)
-- ------------------------------------------------------------------------------

-- 2.1 get_or_create_draft
DROP FUNCTION IF EXISTS public.get_or_create_draft(TEXT);

CREATE OR REPLACE FUNCTION public.get_or_create_draft(
    p_visitor_id TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_visitor_name TEXT;
    v_bill_id TEXT;
BEGIN
    IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN
        RETURN json_build_object('success', false, 'message', 'شناسه ویزیتور الزامی است.');
    END IF;

    -- 1. Check if an active draft already exists for this visitor
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE visitor_id = p_visitor_id AND status = 'draft' 
    LIMIT 1;

    IF FOUND THEN
        RETURN json_build_object(
            'success', true, 
            'message', 'پیش‌نویس فاکتور موجود بازیابی شد.',
            'bill_id', v_bill.id,
            'is_new', false,
            'bill', row_to_json(v_bill)
        );
    END IF;

    -- 2. Find visitor name
    SELECT name INTO v_visitor_name FROM public.visitors WHERE id = p_visitor_id;
    IF v_visitor_name IS NULL THEN
        v_visitor_name := 'ویزیتور';
    END IF;

    -- 3. Generate readable bill ID: BL-{visitor_prefix}-{timestamp}
    v_bill_id := 'BL-' || upper(substr(replace(p_visitor_id, '-', ''), 1, 4)) || '-' || to_char(NOW(), 'YYMMDDHH24MISS');

    -- 4. Insert parent loading_bills row first
    INSERT INTO public.loading_bills (
        id,
        visitor_id,
        visitor_name,
        status,
        orders_count,
        total_visitor_cost,
        total_store_amount,
        revision_count,
        created_at
    ) VALUES (
        v_bill_id,
        p_visitor_id,
        v_visitor_name,
        'draft',
        0,
        0,
        0,
        0,
        NOW()
    );

    -- 5. Audit record
    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        v_bill_id,
        'create_draft',
        v_visitor_name,
        json_build_object('visitor_id', p_visitor_id),
        NOW()
    );

    SELECT * INTO v_bill FROM public.loading_bills WHERE id = v_bill_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'پیش‌نویس جدید فاکتور ایجاد شد.',
        'bill_id', v_bill_id,
        'is_new', true,
        'bill', row_to_json(v_bill)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.2 draft_set_orders
DROP FUNCTION IF EXISTS public.draft_set_orders(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.draft_set_orders(
    p_invoice_id TEXT,
    p_order_ids TEXT[]
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_ord RECORD;
    v_it RECORD;
    v_invalid_count INT := 0;
    v_store_p NUMERIC;
    v_vis_p NUMERIC;
    v_total_store NUMERIC := 0;
    v_total_visitor NUMERIC := 0;
    v_orders_cnt INT := 0;
BEGIN
    -- Lock draft bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور مورد نظر یافت نشد.');
    END IF;

    IF v_bill.status != 'draft' THEN
        RETURN json_build_object('success', false, 'message', 'تنها در حالت پیش‌نویس (draft) امکان انتخاب سفارش‌ها وجود دارد.');
    END IF;

    -- Validate target orders if provided
    IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
        PERFORM id FROM public.orders WHERE id IN (SELECT unnest(p_order_ids)) FOR UPDATE;

        SELECT COUNT(*) INTO v_invalid_count
        FROM public.orders
        WHERE id = ANY(p_order_ids)
          AND (
            assigned_visitor_id IS DISTINCT FROM v_bill.visitor_id
            OR status != 'assigned'
            OR (loading_bill_id IS NOT NULL AND loading_bill_id != p_invoice_id)
          );

        IF v_invalid_count > 0 THEN
            RETURN json_build_object('success', false, 'message', 'یک یا چند سفارش انتخابی نامعتبر هستند (متعلق به ویزیتور دیگری هستند، در وضعیت آماده ارسال نیستند، یا به فاکتور دیگری متصلند).');
        END IF;
    END IF;

    -- Delete existing source='order' items for this draft (manual rows are preserved)
    DELETE FROM public.loading_bill_items
    WHERE loading_bill_id = p_invoice_id AND source = 'order';

    -- Insert fresh order items
    IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
        FOR v_ord IN SELECT id FROM public.orders WHERE id = ANY(p_order_ids) LOOP
            FOR v_it IN 
                SELECT oi.order_id, oi.product_id, oi.name, oi.quantity, oi.price AS item_price,
                       p.price AS current_product_price, p.visitor_price AS current_visitor_price
                FROM public.order_items oi
                LEFT JOIN public.products p ON p.id = oi.product_id
                WHERE oi.order_id = v_ord.id
            LOOP
                v_store_p := COALESCE(v_it.item_price, v_it.current_product_price, 0);
                v_vis_p := COALESCE(v_it.current_visitor_price, ROUND(v_store_p * 0.85), 0);

                INSERT INTO public.loading_bill_items (
                    loading_bill_id,
                    order_id,
                    product_id,
                    product_name,
                    quantity,
                    original_quantity,
                    source,
                    visitor_price,
                    store_price,
                    created_at
                ) VALUES (
                    p_invoice_id,
                    v_it.order_id,
                    v_it.product_id,
                    v_it.name,
                    v_it.quantity,
                    v_it.quantity,
                    'order',
                    v_vis_p,
                    v_store_p,
                    NOW()
                );
            END LOOP;
        END LOOP;
    END IF;

    -- Recalculate bill totals
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0),
        COUNT(DISTINCT order_id)
    INTO v_total_store, v_total_visitor, v_orders_cnt
    FROM public.loading_bill_items
    WHERE loading_bill_id = p_invoice_id;

    UPDATE public.loading_bills
    SET orders_count = v_orders_cnt,
        total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor
    WHERE id = p_invoice_id;

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        p_invoice_id,
        'draft_set_orders',
        v_bill.visitor_name,
        json_build_object('order_ids', p_order_ids, 'orders_count', v_orders_cnt),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'سفارش‌های پیش‌نویس فاکتور به‌روزرسانی شدند.',
        'orders_count', v_orders_cnt,
        'total_store_amount', v_total_store,
        'total_visitor_cost', v_total_visitor
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.3 invoice_add_manual_line
DROP FUNCTION IF EXISTS public.invoice_add_manual_line(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_add_manual_line(
    p_invoice_id TEXT,
    p_product_id TEXT,
    p_qty INT,
    p_customer_label TEXT,
    p_source TEXT,
    p_line_note TEXT,
    p_unit_price NUMERIC,
    p_actor TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_prod RECORD;
    v_store_p NUMERIC;
    v_vis_p NUMERIC;
    v_total_store NUMERIC;
    v_total_visitor NUMERIC;
    v_new_line_id UUID;
BEGIN
    IF p_source NOT IN ('visitor_manual', 'admin_manual') THEN
        RETURN json_build_object('success', false, 'message', 'منبع قلم دستی نامعتبر است.');
    END IF;

    IF p_qty IS NULL OR p_qty <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'تعداد کالا باید بزرگتر از صفر باشد.');
    END IF;

    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
    END IF;

    IF v_bill.status NOT IN ('draft', 'pending', 'approved') THEN
        RETURN json_build_object('success', false, 'message', 'افزودن قلم دستی در وضعیت فعلی فاکتور مجاز نیست.');
    END IF;

    -- Lock product
    SELECT * INTO v_prod 
    FROM public.products 
    WHERE id = p_product_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'کالای انتخابی یافت نشد.');
    END IF;

    v_store_p := COALESCE(p_unit_price, v_prod.price, 0);
    v_vis_p := COALESCE(v_prod.visitor_price, ROUND(v_store_p * 0.85), 0);

    -- Reserve stock if bill is pending or approved
    IF v_bill.status IN ('pending', 'approved') THEN
        IF (v_prod.stock - v_prod.reserved_stock) < p_qty THEN
            RETURN json_build_object('success', false, 'message', 'موجودی آزاد کالای «' || v_prod.name || '» برای رزرو کافی نیست.');
        END IF;

        UPDATE public.products 
        SET reserved_stock = reserved_stock + p_qty 
        WHERE id = p_product_id;

        INSERT INTO public.inventory_transactions (
            product_id, 
            transaction_type, 
            quantity, 
            reference_id, 
            created_at
        ) VALUES (
            p_product_id, 
            'reserve', 
            p_qty, 
            p_invoice_id, 
            NOW()
        );
    END IF;

    -- Insert manual line
    INSERT INTO public.loading_bill_items (
        loading_bill_id,
        order_id,
        product_id,
        product_name,
        quantity,
        original_quantity,
        source,
        customer_label,
        line_note,
        visitor_price,
        store_price,
        created_at
    ) VALUES (
        p_invoice_id,
        NULL,
        p_product_id,
        v_prod.name,
        p_qty,
        p_qty,
        p_source,
        p_customer_label,
        p_line_note,
        v_vis_p,
        v_store_p,
        NOW()
    ) RETURNING id INTO v_new_line_id;

    -- Recalculate bill totals
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0)
    INTO v_total_store, v_total_visitor
    FROM public.loading_bill_items
    WHERE loading_bill_id = p_invoice_id;

    UPDATE public.loading_bills
    SET total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor,
        revision_count = CASE WHEN status IN ('pending', 'approved') THEN revision_count + 1 ELSE revision_count END
    WHERE id = p_invoice_id;

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        p_invoice_id,
        'invoice_add_manual_line',
        COALESCE(p_actor, 'کاربر'),
        json_build_object(
            'product_id', p_product_id, 
            'quantity', p_qty, 
            'source', p_source, 
            'customer_label', p_customer_label,
            'line_id', v_new_line_id
        ),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'قلم دستی با موفقیت به فاکتور افزوده شد.',
        'line_id', v_new_line_id,
        'total_store_amount', v_total_store,
        'total_visitor_cost', v_total_visitor
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.4 invoice_update_line
DROP FUNCTION IF EXISTS public.invoice_update_line(TEXT, INT, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_update_line(
    p_line_id TEXT,
    p_qty INT,
    p_unit_price NUMERIC,
    p_actor TEXT,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_line RECORD;
    v_bill RECORD;
    v_prod RECORD;
    v_diff_qty INT;
    v_total_store NUMERIC;
    v_total_visitor NUMERIC;
    v_order_total NUMERIC;
BEGIN
    IF p_qty IS NULL OR p_qty <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'تعداد کالا باید بزرگتر از صفر باشد.');
    END IF;

    -- Lock line item
    SELECT * INTO v_line 
    FROM public.loading_bill_items 
    WHERE id = p_line_id::uuid 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'قلم مورد نظر یافت نشد.');
    END IF;

    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = v_line.loading_bill_id 
    FOR UPDATE;

    IF v_bill.status NOT IN ('draft', 'pending', 'approved') THEN
        RETURN json_build_object('success', false, 'message', 'ویرایش اقلام روی فاکتورهای خارج‌شده یا لغو شده امکان‌پذیر نیست.');
    END IF;

    v_diff_qty := p_qty - v_line.quantity;

    -- Lock product
    SELECT * INTO v_prod 
    FROM public.products 
    WHERE id = v_line.product_id 
    FOR UPDATE;

    -- Handle stock reservation adjustment if pending or approved
    IF v_bill.status IN ('pending', 'approved') AND v_diff_qty != 0 THEN
        IF v_diff_qty > 0 THEN
            IF (v_prod.stock - v_prod.reserved_stock) < v_diff_qty THEN
                RETURN json_build_object('success', false, 'message', 'موجودی آزاد کالا برای افزایش این مقدار کافی نیست.');
            END IF;

            UPDATE public.products 
            SET reserved_stock = reserved_stock + v_diff_qty 
            WHERE id = v_line.product_id;

            INSERT INTO public.inventory_transactions (
                product_id, transaction_type, quantity, reference_id, created_at
            ) VALUES (
                v_line.product_id, 'reserve', v_diff_qty, v_bill.id, NOW()
            );
        ELSE
            UPDATE public.products 
            SET reserved_stock = GREATEST(0, reserved_stock + v_diff_qty) 
            WHERE id = v_line.product_id;

            INSERT INTO public.inventory_transactions (
                product_id, transaction_type, quantity, reference_id, created_at
            ) VALUES (
                v_line.product_id, 'release_reserve', -v_diff_qty, v_bill.id, NOW()
            );
        END IF;
    END IF;

    -- Update linked order if this line belongs to an order
    IF v_line.order_id IS NOT NULL THEN
        UPDATE public.order_items 
        SET quantity = p_qty,
            price = COALESCE(p_unit_price, price)
        WHERE order_id = v_line.order_id AND product_id = v_line.product_id;

        SELECT COALESCE(SUM(quantity * price), 0) INTO v_order_total 
        FROM public.order_items 
        WHERE order_id = v_line.order_id;

        UPDATE public.orders 
        SET total_amount = v_order_total,
            invoice_revised_at = NOW() 
        WHERE id = v_line.order_id;
    END IF;

    -- Update loading bill item
    UPDATE public.loading_bill_items 
    SET quantity = p_qty,
        store_price = COALESCE(p_unit_price, store_price)
    WHERE id = v_line.id;

    -- Recalculate bill totals
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0)
    INTO v_total_store, v_total_visitor
    FROM public.loading_bill_items
    WHERE loading_bill_id = v_bill.id;

    UPDATE public.loading_bills 
    SET total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor,
        revision_count = revision_count + 1
    WHERE id = v_bill.id;

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        v_bill.id,
        'invoice_update_line',
        COALESCE(p_actor, 'کاربر'),
        json_build_object(
            'line_id', p_line_id, 
            'old_qty', v_line.quantity, 
            'new_qty', p_qty, 
            'unit_price', p_unit_price,
            'reason', p_reason
        ),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'ردیف فاکتور با موفقیت به‌روزرسانی شد.',
        'total_store_amount', v_total_store,
        'total_visitor_cost', v_total_visitor
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.5 invoice_remove_line
DROP FUNCTION IF EXISTS public.invoice_remove_line(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_remove_line(
    p_line_id TEXT,
    p_actor TEXT,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_line RECORD;
    v_bill RECORD;
    v_remaining_lines INT;
    v_order_total NUMERIC;
    v_total_store NUMERIC;
    v_total_visitor NUMERIC;
    v_orders_cnt INT;
BEGIN
    -- Lock line item
    SELECT * INTO v_line 
    FROM public.loading_bill_items 
    WHERE id = p_line_id::uuid 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'ردیف مورد نظر یافت نشد.');
    END IF;

    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = v_line.loading_bill_id 
    FOR UPDATE;

    IF v_bill.status IN ('loaded', 'cancelled') THEN
        RETURN json_build_object('success', false, 'message', 'حذف قلم از فاکتور خارج‌شده یا لغو شده امکان‌پذیر نیست.');
    END IF;

    -- Release reserve if pending or approved
    IF v_bill.status IN ('pending', 'approved') THEN
        UPDATE public.products 
        SET reserved_stock = GREATEST(0, reserved_stock - v_line.quantity) 
        WHERE id = v_line.product_id;

        INSERT INTO public.inventory_transactions (
            product_id, transaction_type, quantity, reference_id, created_at
        ) VALUES (
            v_line.product_id, 'release_reserve', v_line.quantity, v_bill.id, NOW()
        );
    END IF;

    -- Delete line item
    DELETE FROM public.loading_bill_items WHERE id = v_line.id;

    -- Handle order sync if linked to order
    IF v_line.order_id IS NOT NULL THEN
        DELETE FROM public.order_items 
        WHERE order_id = v_line.order_id AND product_id = v_line.product_id;

        SELECT COUNT(*) INTO v_remaining_lines 
        FROM public.loading_bill_items 
        WHERE loading_bill_id = v_bill.id AND order_id = v_line.order_id;

        IF v_remaining_lines = 0 THEN
            -- Order has no remaining lines on this bill -> revert to assigned
            UPDATE public.orders 
            SET status = 'assigned', 
                loading_bill_id = NULL, 
                invoice_revised_at = NOW() 
            WHERE id = v_line.order_id;
        ELSE
            SELECT COALESCE(SUM(quantity * price), 0) INTO v_order_total 
            FROM public.order_items 
            WHERE order_id = v_line.order_id;

            UPDATE public.orders 
            SET total_amount = v_order_total, 
                invoice_revised_at = NOW() 
            WHERE id = v_line.order_id;
        END IF;
    END IF;

    -- Recalculate bill totals
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0),
        COUNT(DISTINCT order_id)
    INTO v_total_store, v_total_visitor, v_orders_cnt
    FROM public.loading_bill_items
    WHERE loading_bill_id = v_bill.id;

    UPDATE public.loading_bills 
    SET total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor,
        orders_count = v_orders_cnt,
        revision_count = revision_count + 1
    WHERE id = v_bill.id;

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        v_bill.id,
        'invoice_remove_line',
        COALESCE(p_actor, 'کاربر'),
        json_build_object('line_id', p_line_id, 'reason', p_reason, 'product_id', v_line.product_id),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'قلم با موفقیت از فاکتور حذف شد.',
        'total_store_amount', v_total_store,
        'total_visitor_cost', v_total_visitor,
        'orders_count', v_orders_cnt
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.6 invoice_add_order
DROP FUNCTION IF EXISTS public.invoice_add_order(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_add_order(
    p_invoice_id TEXT,
    p_order_id TEXT,
    p_actor TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_ord RECORD;
    v_it RECORD;
    v_store_p NUMERIC;
    v_vis_p NUMERIC;
    v_total_store NUMERIC;
    v_total_visitor NUMERIC;
    v_orders_cnt INT;
BEGIN
    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
    END IF;

    IF v_bill.status NOT IN ('pending', 'approved') THEN
        RETURN json_build_object('success', false, 'message', 'افزودن سفارش فقط روی فاکتورهای در انتظار (pending) یا تاییدشده (approved) مجاز است.');
    END IF;

    -- Lock order
    SELECT * INTO v_ord 
    FROM public.orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'سفارش مورد نظر یافت نشد.');
    END IF;

    IF v_ord.status != 'assigned' OR (v_ord.loading_bill_id IS NOT NULL AND v_ord.loading_bill_id != p_invoice_id) THEN
        RETURN json_build_object('success', false, 'message', 'این سفارش در وضعیت آماده ارسال نیست یا قبلاً به فاکتور دیگری متصل شده است.');
    END IF;

    -- If order had no visitor or direct, assign to bill visitor
    UPDATE public.orders 
    SET assigned_visitor_id = v_bill.visitor_id,
        visitor_name = v_bill.visitor_name,
        status = 'loading',
        loading_bill_id = p_invoice_id,
        invoice_revised_at = NOW()
    WHERE id = p_order_id;

    -- Insert order items into bill
    FOR v_it IN 
        SELECT oi.order_id, oi.product_id, oi.name, oi.quantity, oi.price AS item_price,
               p.price AS current_product_price, p.visitor_price AS current_visitor_price
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = p_order_id
    LOOP
        v_store_p := COALESCE(v_it.item_price, v_it.current_product_price, 0);
        v_vis_p := COALESCE(v_it.current_visitor_price, ROUND(v_store_p * 0.85), 0);

        INSERT INTO public.loading_bill_items (
            loading_bill_id,
            order_id,
            product_id,
            product_name,
            quantity,
            original_quantity,
            source,
            visitor_price,
            store_price,
            created_at
        ) VALUES (
            p_invoice_id,
            v_it.order_id,
            v_it.product_id,
            v_it.name,
            v_it.quantity,
            v_it.quantity,
            'order',
            v_vis_p,
            v_store_p,
            NOW()
        );
    END LOOP;

    -- Recalculate bill totals
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0),
        COUNT(DISTINCT order_id)
    INTO v_total_store, v_total_visitor, v_orders_cnt
    FROM public.loading_bill_items
    WHERE loading_bill_id = p_invoice_id;

    UPDATE public.loading_bills 
    SET total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor,
        orders_count = v_orders_cnt,
        revision_count = revision_count + 1
    WHERE id = p_invoice_id;

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        p_invoice_id,
        'invoice_add_order',
        COALESCE(p_actor, 'ادمین'),
        json_build_object('order_id', p_order_id),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'سفارش با موفقیت به فاکتور افزوده شد.',
        'orders_count', v_orders_cnt,
        'total_store_amount', v_total_store,
        'total_visitor_cost', v_total_visitor
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.7 submit_invoice
DROP FUNCTION IF EXISTS public.submit_invoice(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_invoice(
    p_invoice_id TEXT,
    p_visitor_id TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_items_count INT;
    v_order_ids TEXT[];
    v_ord RECORD;
    v_it RECORD;
    v_manual RECORD;
    v_prod RECORD;
    v_store_p NUMERIC;
    v_vis_p NUMERIC;
    v_total_store NUMERIC := 0;
    v_total_visitor NUMERIC := 0;
    v_orders_cnt INT := 0;
BEGIN
    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
    END IF;

    IF v_bill.status != 'draft' THEN
        RETURN json_build_object('success', false, 'message', 'تنها فاکتورهای در حالت پیش‌نویس (draft) امکان ارسال به ادمین را دارند.');
    END IF;

    IF v_bill.visitor_id != p_visitor_id THEN
        RETURN json_build_object('success', false, 'message', 'شما دسترسی ارسال این فاکتور را ندارید.');
    END IF;

    -- Check if bill has any items at all
    SELECT COUNT(*) INTO v_items_count 
    FROM public.loading_bill_items 
    WHERE loading_bill_id = p_invoice_id;

    IF v_items_count = 0 THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور فاقد هرگونه قلم کالا است.');
    END IF;

    -- 1. Snapshot / Rebuild source='order' lines from fresh order_items
    SELECT array_agg(DISTINCT order_id) INTO v_order_ids 
    FROM public.loading_bill_items 
    WHERE loading_bill_id = p_invoice_id AND order_id IS NOT NULL;

    IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
        PERFORM id FROM public.orders WHERE id IN (SELECT unnest(v_order_ids)) FOR UPDATE;

        DELETE FROM public.loading_bill_items 
        WHERE loading_bill_id = p_invoice_id AND source = 'order';

        FOR v_ord IN SELECT id FROM public.orders WHERE id = ANY(v_order_ids) LOOP
            FOR v_it IN 
                SELECT oi.order_id, oi.product_id, oi.name, oi.quantity, oi.price AS item_price,
                       p.price AS current_product_price, p.visitor_price AS current_visitor_price
                FROM public.order_items oi
                LEFT JOIN public.products p ON p.id = oi.product_id
                WHERE oi.order_id = v_ord.id
            LOOP
                v_store_p := COALESCE(v_it.item_price, v_it.current_product_price, 0);
                v_vis_p := COALESCE(v_it.current_visitor_price, ROUND(v_store_p * 0.85), 0);

                INSERT INTO public.loading_bill_items (
                    loading_bill_id,
                    order_id,
                    product_id,
                    product_name,
                    quantity,
                    original_quantity,
                    source,
                    visitor_price,
                    store_price,
                    created_at
                ) VALUES (
                    p_invoice_id,
                    v_it.order_id,
                    v_it.product_id,
                    v_it.name,
                    v_it.quantity,
                    v_it.quantity,
                    'order',
                    v_vis_p,
                    v_store_p,
                    NOW()
                );
            END LOOP;
        END LOOP;

        -- Transition orders to 'loading' status and link
        UPDATE public.orders 
        SET status = 'loading', 
            loading_bill_id = p_invoice_id 
        WHERE id = ANY(v_order_ids);
    END IF;

    -- 2. Reserve stock for manual rows
    FOR v_manual IN 
        SELECT product_id, SUM(quantity) AS total_qty 
        FROM public.loading_bill_items 
        WHERE loading_bill_id = p_invoice_id AND source IN ('visitor_manual', 'admin_manual') 
        GROUP BY product_id 
    LOOP
        SELECT * INTO v_prod 
        FROM public.products 
        WHERE id = v_manual.product_id 
        FOR UPDATE;

        IF (v_prod.stock - v_prod.reserved_stock) < v_manual.total_qty THEN
            RETURN json_build_object('success', false, 'message', 'موجودی کالای «' || v_prod.name || '» برای رزرو اقلام دستی کافی نیست.');
        END IF;

        UPDATE public.products 
        SET reserved_stock = reserved_stock + v_manual.total_qty 
        WHERE id = v_manual.product_id;

        INSERT INTO public.inventory_transactions (
            product_id, transaction_type, quantity, reference_id, created_at
        ) VALUES (
            v_manual.product_id, 'reserve', v_manual.total_qty, p_invoice_id, NOW()
        );
    END LOOP;

    -- 3. Recalculate bill totals
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0),
        COUNT(DISTINCT order_id)
    INTO v_total_store, v_total_visitor, v_orders_cnt
    FROM public.loading_bill_items
    WHERE loading_bill_id = p_invoice_id;

    UPDATE public.loading_bills 
    SET status = 'pending',
        submitted_at = NOW(),
        orders_count = v_orders_cnt,
        total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor
    WHERE id = p_invoice_id;

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        p_invoice_id,
        'submit_invoice',
        v_bill.visitor_name,
        json_build_object('orders_count', v_orders_cnt, 'total_store_amount', v_total_store),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'فاکتور با موفقیت به انبار و ادمین ارسال شد.',
        'bill_id', p_invoice_id,
        'orders_count', v_orders_cnt,
        'total_store_amount', v_total_store,
        'total_visitor_cost', v_total_visitor
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.8 finalize_invoice
DROP FUNCTION IF EXISTS public.finalize_invoice(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.finalize_invoice(
    p_invoice_id TEXT,
    p_actor TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_seq_val BIGINT;
    v_invoice_no TEXT;
    v_require_warehouse BOOLEAN := false;
    v_item RECORD;
BEGIN
    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
    END IF;

    IF v_bill.status != 'pending' THEN
        RETURN json_build_object('success', false, 'message', 'تنها فاکتورهای در انتظار تایید (pending) قابل نهایی‌سازی هستند.');
    END IF;

    -- Generate invoice number if not already present
    IF v_bill.invoice_no IS NULL THEN
        v_seq_val := nextval('public.invoice_seq');
        v_invoice_no := 'F-' || LPAD(v_seq_val::text, 5, '0');
    ELSE
        v_invoice_no := v_bill.invoice_no;
    END IF;

    -- Check require_warehouse_step setting
    SELECT COALESCE((value)::text = 'true' OR (value)::text = '"true"', false) 
    INTO v_require_warehouse 
    FROM public.app_settings 
    WHERE key = 'require_warehouse_step';

    IF v_require_warehouse = false THEN
        -- Instant dispatch: deduct physical stock & release reserve
        FOR v_item IN 
            SELECT product_id, SUM(quantity) AS total_qty 
            FROM public.loading_bill_items 
            WHERE loading_bill_id = p_invoice_id 
            GROUP BY product_id
        LOOP
            PERFORM id FROM public.products WHERE id = v_item.product_id FOR UPDATE;

            UPDATE public.products 
            SET stock = GREATEST(0, stock - v_item.total_qty),
                reserved_stock = GREATEST(0, reserved_stock - v_item.total_qty) 
            WHERE id = v_item.product_id;

            INSERT INTO public.inventory_transactions (
                product_id, transaction_type, quantity, reference_id, created_at
            ) VALUES (
                v_item.product_id, 'load_out', v_item.total_qty, p_invoice_id, NOW()
            );

            INSERT INTO public.inventory_transactions (
                product_id, transaction_type, quantity, reference_id, created_at
            ) VALUES (
                v_item.product_id, 'release_reserve', -v_item.total_qty, p_invoice_id, NOW()
            );
        END LOOP;

        UPDATE public.orders 
        SET stock_deducted = TRUE 
        WHERE loading_bill_id = p_invoice_id;

        UPDATE public.loading_bills 
        SET status = 'loaded',
            invoice_no = v_invoice_no,
            approved_at = NOW(),
            approved_by = COALESCE(p_actor, 'ادمین'),
            finalized_at = NOW(),
            finalized_by = COALESCE(p_actor, 'ادمین')
        WHERE id = p_invoice_id;

        INSERT INTO public.invoice_audit (
            invoice_id, action, actor_name, details, created_at
        ) VALUES (
            p_invoice_id,
            'finalize_and_load',
            COALESCE(p_actor, 'ادمین'),
            json_build_object('invoice_no', v_invoice_no, 'require_warehouse_step', false),
            NOW()
        );

        RETURN json_build_object(
            'success', true, 
            'message', 'فاکتور تایید و خروج از انبار ثبت گردید.',
            'invoice_no', v_invoice_no,
            'status', 'loaded'
        );
    ELSE
        -- Warehouse step required: lock prices and set approved
        UPDATE public.loading_bills 
        SET status = 'approved',
            invoice_no = v_invoice_no,
            approved_at = NOW(),
            approved_by = COALESCE(p_actor, 'ادمین'),
            finalized_at = NOW(),
            finalized_by = COALESCE(p_actor, 'ادمین')
        WHERE id = p_invoice_id;

        INSERT INTO public.invoice_audit (
            invoice_id, action, actor_name, details, created_at
        ) VALUES (
            p_invoice_id,
            'finalize_invoice',
            COALESCE(p_actor, 'ادمین'),
            json_build_object('invoice_no', v_invoice_no, 'require_warehouse_step', true),
            NOW()
        );

        RETURN json_build_object(
            'success', true, 
            'message', 'فاکتور با موفقیت تایید و شماره‌گذاری شد. در انتظار تایید خروج فیزیکی انبار.',
            'invoice_no', v_invoice_no,
            'status', 'approved'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.9 confirm_loading_exit
DROP FUNCTION IF EXISTS public.confirm_loading_exit(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.confirm_loading_exit(
    p_invoice_id TEXT,
    p_actor TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_item RECORD;
BEGIN
    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
    END IF;

    IF v_bill.status != 'approved' THEN
        RETURN json_build_object('success', false, 'message', 'تنها فاکتورهای تاییدشده (approved) قابلیت ثبت خروج از انبار را دارند.');
    END IF;

    -- Subtract physical stock & reserved stock
    FOR v_item IN 
        SELECT product_id, SUM(quantity) AS total_qty 
        FROM public.loading_bill_items 
        WHERE loading_bill_id = p_invoice_id 
        GROUP BY product_id
    LOOP
        PERFORM id FROM public.products WHERE id = v_item.product_id FOR UPDATE;

        UPDATE public.products 
        SET stock = GREATEST(0, stock - v_item.total_qty),
            reserved_stock = GREATEST(0, reserved_stock - v_item.total_qty) 
        WHERE id = v_item.product_id;

        INSERT INTO public.inventory_transactions (
            product_id, transaction_type, quantity, reference_id, created_at
        ) VALUES (
            v_item.product_id, 'load_out', v_item.total_qty, p_invoice_id, NOW()
        );

        INSERT INTO public.inventory_transactions (
            product_id, transaction_type, quantity, reference_id, created_at
        ) VALUES (
            v_item.product_id, 'release_reserve', -v_item.total_qty, p_invoice_id, NOW()
        );
    END LOOP;

    -- Mark orders as stock deducted
    UPDATE public.orders 
    SET stock_deducted = TRUE 
    WHERE loading_bill_id = p_invoice_id;

    -- Update status to loaded
    UPDATE public.loading_bills 
    SET status = 'loaded' 
    WHERE id = p_invoice_id;

    INSERT INTO public.invoice_audit (
        invoice_id, action, actor_name, details, created_at
    ) VALUES (
        p_invoice_id,
        'confirm_loading_exit',
        COALESCE(p_actor, 'انباردار'),
        json_build_object('previous_status', 'approved'),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'خروج بار از انبار با موفقیت ثبت شد و موجودی فیزیکی کسر گردید.',
        'status', 'loaded'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2.10 cancel_invoice
DROP FUNCTION IF EXISTS public.cancel_invoice(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.cancel_invoice(
    p_invoice_id TEXT,
    p_actor TEXT,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_manual RECORD;
BEGIN
    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور مورد نظر یافت نشد.');
    END IF;

    IF v_bill.status = 'loaded' THEN
        RETURN json_build_object('success', false, 'message', 'فاکتورهایی که از انبار خارج شده‌اند (loaded) قابل لغو نیستند.');
    END IF;

    IF v_bill.status = 'cancelled' THEN
        RETURN json_build_object('success', false, 'message', 'این فاکتور قبلاً لغو شده است.');
    END IF;

    -- Release reserved stock for manual rows if bill was pending or approved
    IF v_bill.status IN ('pending', 'approved') THEN
        FOR v_manual IN 
            SELECT product_id, SUM(quantity) AS total_qty 
            FROM public.loading_bill_items 
            WHERE loading_bill_id = p_invoice_id AND source IN ('visitor_manual', 'admin_manual') 
            GROUP BY product_id 
        LOOP
            UPDATE public.products 
            SET reserved_stock = GREATEST(0, reserved_stock - v_manual.total_qty) 
            WHERE id = v_manual.product_id;

            INSERT INTO public.inventory_transactions (
                product_id, transaction_type, quantity, reference_id, created_at
            ) VALUES (
                v_manual.product_id, 'release_reserve', v_manual.total_qty, p_invoice_id, NOW()
            );
        END LOOP;
    END IF;

    -- Revert orders to assigned and clear loading_bill_id
    UPDATE public.orders 
    SET status = 'assigned', 
        loading_bill_id = NULL,
        invoice_revised_at = NOW() 
    WHERE loading_bill_id = p_invoice_id;

    -- Update bill status to cancelled
    UPDATE public.loading_bills 
    SET status = 'cancelled',
        cancelled_by = COALESCE(p_actor, 'سیستم'),
        cancelled_at = NOW(),
        cancel_reason = p_reason 
    WHERE id = p_invoice_id;

    INSERT INTO public.invoice_audit (
        invoice_id, action, actor_name, details, created_at
    ) VALUES (
        p_invoice_id,
        'cancel_invoice',
        COALESCE(p_actor, 'سیستم'),
        json_build_object('reason', p_reason, 'previous_status', v_bill.status),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'فاکتور با موفقیت لغو شد و سفارش‌ها به وضعیت آماده ارسال بازگشتند.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 3. Compatibility Wrappers for Legacy Calls
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.approve_loading_bill_transaction(TEXT);
DROP FUNCTION IF EXISTS public.approve_loading_bill_transaction(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.approve_loading_bill_transaction(
    p_loading_bill_id TEXT,
    p_approved_by TEXT DEFAULT NULL
) RETURNS JSON AS $$
BEGIN
    RETURN public.finalize_invoice(p_loading_bill_id, COALESCE(p_approved_by, 'سیستم'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.cancel_loading_bill_transaction(TEXT);
DROP FUNCTION IF EXISTS public.cancel_loading_bill_transaction(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cancel_loading_bill_transaction(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.cancel_loading_bill_transaction(
    p_bill_id TEXT,
    p_cancelled_by TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
) RETURNS JSON AS $$
BEGIN
    RETURN public.cancel_invoice(p_bill_id, COALESCE(p_cancelled_by, 'سیستم'), p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- SECTION: 08_admin_visitor_invoices.sql
-- ==============================================================================

-- ==============================================================================
-- Migration: Admin Visitor Invoice Enhancements & Audit Log View
-- File: supabase_migration_admin_visitor_invoices.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create invoice_audit_logs View (Alias for invoice_audit table)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.invoice_audit_logs AS 
SELECT 
    id,
    invoice_id,
    action,
    actor_name,
    details,
    created_at
FROM public.invoice_audit;

-- ------------------------------------------------------------------------------
-- 2. Update invoice_update_line to support visitor purchase price updates
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.invoice_update_line(TEXT, INT, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_update_line(
    p_line_id TEXT,
    p_qty INT,
    p_unit_price NUMERIC,
    p_actor TEXT,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_line RECORD;
    v_bill RECORD;
    v_prod RECORD;
    v_diff_qty INT;
    v_total_store NUMERIC;
    v_total_visitor NUMERIC;
    v_order_total NUMERIC;
    v_new_qty INT;
    v_old_qty INT;
    v_old_price NUMERIC;
BEGIN
    -- Lock line item
    SELECT * INTO v_line 
    FROM public.loading_bill_items 
    WHERE id = p_line_id::uuid 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'قلم مورد نظر یافت نشد.');
    END IF;

    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = v_line.loading_bill_id 
    FOR UPDATE;

    IF v_bill.status NOT IN ('draft', 'pending', 'approved') THEN
        RETURN json_build_object('success', false, 'message', 'ویرایش اقلام روی فاکتورهای خارج‌شده یا لغو شده امکان‌پذیر نیست.');
    END IF;

    v_old_qty := v_line.quantity;
    v_old_price := COALESCE(v_line.visitor_price, 0);
    v_new_qty := COALESCE(p_qty, v_line.quantity);

    IF v_new_qty <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'تعداد کالا باید بزرگتر از صفر باشد.');
    END IF;

    v_diff_qty := v_new_qty - v_old_qty;

    -- Lock product
    SELECT * INTO v_prod 
    FROM public.products 
    WHERE id = v_line.product_id 
    FOR UPDATE;

    -- Handle stock reservation adjustment if pending or approved
    IF v_bill.status IN ('pending', 'approved') AND v_diff_qty != 0 THEN
        IF v_diff_qty > 0 THEN
            IF (v_prod.stock - v_prod.reserved_stock) < v_diff_qty THEN
                RETURN json_build_object('success', false, 'message', 'موجودی آزاد کالا برای افزایش این مقدار کافی نیست.');
            END IF;

            UPDATE public.products 
            SET reserved_stock = reserved_stock + v_diff_qty 
            WHERE id = v_line.product_id;

            INSERT INTO public.inventory_transactions (
                product_id, transaction_type, quantity, reference_id, created_at
            ) VALUES (
                v_line.product_id, 'reserve', v_diff_qty, v_bill.id, NOW()
            );
        ELSE
            UPDATE public.products 
            SET reserved_stock = GREATEST(0, reserved_stock + v_diff_qty) 
            WHERE id = v_line.product_id;

            INSERT INTO public.inventory_transactions (
                product_id, transaction_type, quantity, reference_id, created_at
            ) VALUES (
                v_line.product_id, 'release_reserve', -v_diff_qty, v_bill.id, NOW()
            );
        END IF;
    END IF;

    -- Update linked order if this line belongs to an order
    IF v_line.order_id IS NOT NULL THEN
        UPDATE public.order_items 
        SET quantity = v_new_qty,
            price = COALESCE(p_unit_price, price)
        WHERE order_id = v_line.order_id AND product_id = v_line.product_id;

        SELECT COALESCE(SUM(quantity * price), 0) INTO v_order_total 
        FROM public.order_items 
        WHERE order_id = v_line.order_id;

        UPDATE public.orders 
        SET total_amount = v_order_total,
            invoice_revised_at = NOW() 
        WHERE id = v_line.order_id;
    END IF;

    -- Update loading bill item (update both quantity and visitor_price / store_price)
    UPDATE public.loading_bill_items 
    SET quantity = v_new_qty,
        visitor_price = COALESCE(p_unit_price, visitor_price),
        store_price = COALESCE(p_unit_price, store_price)
    WHERE id = v_line.id;

    -- Recalculate bill totals
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0)
    INTO v_total_store, v_total_visitor
    FROM public.loading_bill_items
    WHERE loading_bill_id = v_bill.id;

    UPDATE public.loading_bills 
    SET total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor,
        revision_count = COALESCE(revision_count, 0) + 1
    WHERE id = v_bill.id;

    -- Insert audit log with detailed old/new values
    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        v_bill.id,
        'invoice_update_line',
        COALESCE(p_actor, 'ادمین'),
        json_build_object(
            'line_id', p_line_id,
            'product_name', v_line.product_name,
            'old_qty', v_old_qty, 
            'new_qty', v_new_qty, 
            'old_price', v_old_price,
            'new_price', COALESCE(p_unit_price, v_old_price),
            'reason', p_reason
        ),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'ردیف فاکتور با موفقیت به‌روزرسانی شد.',
        'total_store_amount', v_total_store,
        'total_visitor_cost', v_total_visitor
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 3. Alias invoice_delete_line mapping to invoice_remove_line
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.invoice_delete_line(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_delete_line(
    p_line_id TEXT,
    p_actor TEXT,
    p_reason TEXT
) RETURNS JSON AS $$
BEGIN
    RETURN public.invoice_remove_line(p_line_id, p_actor, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 4. Update invoice_add_manual_line with accurate visitor price handling
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.invoice_add_manual_line(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_add_manual_line(
    p_invoice_id TEXT,
    p_product_id TEXT,
    p_qty INT,
    p_customer_label TEXT,
    p_source TEXT,
    p_line_note TEXT,
    p_unit_price NUMERIC,
    p_actor TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_prod RECORD;
    v_store_p NUMERIC;
    v_vis_p NUMERIC;
    v_total_store NUMERIC;
    v_total_visitor NUMERIC;
    v_new_line_id UUID;
BEGIN
    IF p_source NOT IN ('visitor_manual', 'admin_manual') THEN
        RETURN json_build_object('success', false, 'message', 'منبع قلم دستی نامعتبر است.');
    END IF;

    IF p_qty IS NULL OR p_qty <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'تعداد کالا باید بزرگتر از صفر باشد.');
    END IF;

    -- Lock bill
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
    END IF;

    IF v_bill.status NOT IN ('draft', 'pending', 'approved') THEN
        RETURN json_build_object('success', false, 'message', 'افزودن قلم دستی در وضعیت فعلی فاکتور مجاز نیست.');
    END IF;

    -- Lock product
    SELECT * INTO v_prod 
    FROM public.products 
    WHERE id = p_product_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'کالای انتخابی یافت نشد.');
    END IF;

    v_vis_p := COALESCE(p_unit_price, v_prod.visitor_price, ROUND(v_prod.price * 0.85), 0);
    v_store_p := COALESCE(p_unit_price, v_prod.price, 0);

    -- Reserve stock if bill is pending or approved
    IF v_bill.status IN ('pending', 'approved') THEN
        IF (v_prod.stock - v_prod.reserved_stock) < p_qty THEN
            RETURN json_build_object('success', false, 'message', 'موجودی آزاد کالای «' || v_prod.name || '» برای رزرو کافی نیست.');
        END IF;

        UPDATE public.products 
        SET reserved_stock = reserved_stock + p_qty 
        WHERE id = p_product_id;

        INSERT INTO public.inventory_transactions (
            product_id, 
            transaction_type, 
            quantity, 
            reference_id, 
            created_at
        ) VALUES (
            p_product_id, 
            'reserve', 
            p_qty, 
            p_invoice_id, 
            NOW()
        );
    END IF;

    -- Insert manual line
    INSERT INTO public.loading_bill_items (
        loading_bill_id,
        order_id,
        product_id,
        product_name,
        quantity,
        original_quantity,
        source,
        customer_label,
        line_note,
        visitor_price,
        store_price,
        created_at
    ) VALUES (
        p_invoice_id,
        NULL,
        p_product_id,
        v_prod.name,
        p_qty,
        p_qty,
        p_source,
        p_customer_label,
        p_line_note,
        v_vis_p,
        v_store_p,
        NOW()
    ) RETURNING id INTO v_new_line_id;

    -- Recalculate bill totals
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0)
    INTO v_total_store, v_total_visitor
    FROM public.loading_bill_items
    WHERE loading_bill_id = p_invoice_id;

    UPDATE public.loading_bills
    SET total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor,
        revision_count = CASE WHEN status IN ('pending', 'approved') THEN COALESCE(revision_count, 0) + 1 ELSE revision_count END
    WHERE id = p_invoice_id;

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        p_invoice_id,
        'invoice_add_manual_line',
        COALESCE(p_actor, 'کاربر'),
        json_build_object(
            'product_id', p_product_id,
            'product_name', v_prod.name,
            'quantity', p_qty, 
            'unit_price', v_vis_p,
            'source', p_source, 
            'customer_label', p_customer_label,
            'line_note', p_line_note,
            'line_id', v_new_line_id
        ),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'قلم دستی با موفقیت به فاکتور افزوده شد.',
        'line_id', v_new_line_id,
        'total_store_amount', v_total_store,
        'total_visitor_cost', v_total_visitor
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- SECTION: 09_warehouse_step_setting.sql
-- ==============================================================================

-- ==============================================================================
-- Migration: Warehouse Step Setting & System Audit Logging
-- File: supabase_migration_warehouse_step_setting.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure invoice_audit supports system-level settings logs (nullable invoice_id)
-- ------------------------------------------------------------------------------

ALTER TABLE public.invoice_audit ALTER COLUMN invoice_id DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. Stored Procedures for require_warehouse_step setting
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.set_warehouse_step_setting(BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.set_warehouse_step_setting(
    p_enabled BOOLEAN,
    p_actor TEXT
) RETURNS JSON AS $$
BEGIN
    INSERT INTO public.app_settings (key, value)
    VALUES ('require_warehouse_step', to_jsonb(p_enabled))
    ON CONFLICT (key) DO UPDATE
    SET value = to_jsonb(p_enabled);

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        NULL,
        'change_setting_require_warehouse_step',
        COALESCE(p_actor, 'ادمین'),
        json_build_object('require_warehouse_step', p_enabled),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'تنظیم مرحله تایید انبار با موفقیت به‌روزرسانی شد.',
        'require_warehouse_step', p_enabled
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS public.get_warehouse_step_setting();

CREATE OR REPLACE FUNCTION public.get_warehouse_step_setting() 
RETURNS JSON AS $$
DECLARE
    v_val JSONB;
    v_enabled BOOLEAN;
BEGIN
    SELECT value INTO v_val FROM public.app_settings WHERE key = 'require_warehouse_step';
    v_enabled := COALESCE((v_val)::text = 'true' OR (v_val)::text = '"true"', false);

    RETURN json_build_object(
        'success', true,
        'require_warehouse_step', v_enabled
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM, 'require_warehouse_step', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
