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
  supermarket_id TEXT REFERENCES supermarkets(id) ON DELETE RESTRICT,
  supermarket_name TEXT NOT NULL,
  assigned_visitor_id TEXT REFERENCES visitors(id) ON DELETE RESTRICT,
  visitor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'loading', 'delegated', 'delivered', 'undelivered')),
  total_amount NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
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
  visitor_id TEXT REFERENCES visitors(id) ON DELETE RESTRICT,
  visitor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled')),
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Create Inventory Transactions Table (Double-entry stock audit ledger)
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('reserve', 'release_reserve', 'load_out', 'return', 'manual_adjustment')),
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
) RETURNS VOID AS $$
DECLARE
  item JSONB;
BEGIN
  -- Insert Main Order with assigned visitor
  INSERT INTO orders (id, supermarket_id, supermarket_name, assigned_visitor_id, visitor_name, status, total_amount)
  VALUES (p_order_id, p_supermarket_id, p_supermarket_name, p_assigned_visitor_id, p_visitor_name, p_status, p_total_amount);

  -- Process line items, allocate reserved stock, audit ledger
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Increment reserved_stock
    UPDATE products 
    SET reserved_stock = reserved_stock + (item->>'quantity')::INTEGER 
    WHERE id = item->>'productId';

    -- Log transaction in ledger
    INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id)
    VALUES (item->>'productId', 'reserve', (item->>'quantity')::INTEGER, p_order_id);

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
END;
$$ LANGUAGE plpgsql;

-- 17. Stored Procedure: Approve Loading Bill (Commit delivery dispatch & subtract physical stocks)
CREATE OR REPLACE FUNCTION approve_loading_bill_transaction(
  p_loading_bill_id TEXT
) RETURNS VOID AS $$
DECLARE
  item RECORD;
BEGIN
  -- Update Loading Bill Status
  UPDATE loading_bills SET status = 'approved' WHERE id = p_loading_bill_id;

  -- Subtract physical stock & reserved stock, write audit trails
  FOR item IN 
    SELECT product_id, sum(quantity) as total_qty 
    FROM loading_bill_items 
    WHERE loading_bill_id = p_loading_bill_id 
    GROUP BY product_id
  LOOP
    -- Subtract physical stock and reserved stock
    UPDATE products 
    SET stock = stock - item.total_qty,
        reserved_stock = GREATEST(0, reserved_stock - item.total_qty)
    WHERE id = item.product_id;

    -- Add Inventory Ledger record for physical dispatch
    INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id)
    VALUES (item.product_id, 'load_out', item.total_qty, p_loading_bill_id);
    
    -- Release reservation trace
    INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id)
    VALUES (item.product_id, 'release_reserve', -item.total_qty, p_loading_bill_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

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

