-- =========================================================================
-- Rollback Script: supabase_rls_rollback.sql
-- Description: Restores open permissive RLS policies (USING true) on all tables.
-- Use this script ONLY if you need to roll back role-based RLS.
-- =========================================================================

-- 1. profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_open_all" ON profiles;
CREATE POLICY "profiles_open_all" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. visitors
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visitors_select_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_insert_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_update_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_delete_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_open_all" ON visitors;
CREATE POLICY "visitors_open_all" ON visitors FOR ALL USING (true) WITH CHECK (true);

-- 3. supermarkets
ALTER TABLE supermarkets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supermarkets_select_policy" ON supermarkets;
DROP POLICY IF EXISTS "supermarkets_insert_policy" ON supermarkets;
DROP POLICY IF EXISTS "supermarkets_update_policy" ON supermarkets;
DROP POLICY IF EXISTS "supermarkets_delete_policy" ON supermarkets;
DROP POLICY IF EXISTS "supermarkets_open_all" ON supermarkets;
CREATE POLICY "supermarkets_open_all" ON supermarkets FOR ALL USING (true) WITH CHECK (true);

-- 4. products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "products_delete_policy" ON products;
DROP POLICY IF EXISTS "products_open_all" ON products;
CREATE POLICY "products_open_all" ON products FOR ALL USING (true) WITH CHECK (true);

-- 5. categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_select_policy" ON categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON categories;
DROP POLICY IF EXISTS "categories_update_policy" ON categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON categories;
DROP POLICY IF EXISTS "categories_open_all" ON categories;
CREATE POLICY "categories_open_all" ON categories FOR ALL USING (true) WITH CHECK (true);

-- 6. brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brands_select_policy" ON brands;
DROP POLICY IF EXISTS "brands_insert_policy" ON brands;
DROP POLICY IF EXISTS "brands_update_policy" ON brands;
DROP POLICY IF EXISTS "brands_delete_policy" ON brands;
DROP POLICY IF EXISTS "brands_open_all" ON brands;
CREATE POLICY "brands_open_all" ON brands FOR ALL USING (true) WITH CHECK (true);

-- 7. units
CREATE TABLE IF NOT EXISTS public.units (
  name TEXT PRIMARY KEY
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "units_select_policy" ON units;
DROP POLICY IF EXISTS "units_insert_policy" ON units;
DROP POLICY IF EXISTS "units_update_policy" ON units;
DROP POLICY IF EXISTS "units_delete_policy" ON units;
DROP POLICY IF EXISTS "units_open_all" ON units;
CREATE POLICY "units_open_all" ON units FOR ALL USING (true) WITH CHECK (true);

-- 8. product_price_history
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_price_history_select_policy" ON product_price_history;
DROP POLICY IF EXISTS "product_price_history_insert_policy" ON product_price_history;
DROP POLICY IF EXISTS "product_price_history_update_policy" ON product_price_history;
DROP POLICY IF EXISTS "product_price_history_delete_policy" ON product_price_history;
DROP POLICY IF EXISTS "product_price_history_open_all" ON product_price_history;
CREATE POLICY "product_price_history_open_all" ON product_price_history FOR ALL USING (true) WITH CHECK (true);

-- 9. product_likes
ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_likes_select_policy" ON product_likes;
DROP POLICY IF EXISTS "product_likes_insert_policy" ON product_likes;
DROP POLICY IF EXISTS "product_likes_update_policy" ON product_likes;
DROP POLICY IF EXISTS "product_likes_delete_policy" ON product_likes;
DROP POLICY IF EXISTS "product_likes_open_all" ON product_likes;
CREATE POLICY "product_likes_open_all" ON product_likes FOR ALL USING (true) WITH CHECK (true);

-- 10. orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_select_policy" ON orders;
DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
DROP POLICY IF EXISTS "orders_update_policy" ON orders;
DROP POLICY IF EXISTS "orders_delete_policy" ON orders;
DROP POLICY IF EXISTS "orders_open_all" ON orders;
CREATE POLICY "orders_open_all" ON orders FOR ALL USING (true) WITH CHECK (true);

-- 11. order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_select_policy" ON order_items;
DROP POLICY IF EXISTS "order_items_insert_policy" ON order_items;
DROP POLICY IF EXISTS "order_items_update_policy" ON order_items;
DROP POLICY IF EXISTS "order_items_delete_policy" ON order_items;
DROP POLICY IF EXISTS "order_items_open_all" ON order_items;
CREATE POLICY "order_items_open_all" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- 12. order_visitor_history
ALTER TABLE order_visitor_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_visitor_history_select_policy" ON order_visitor_history;
DROP POLICY IF EXISTS "order_visitor_history_insert_policy" ON order_visitor_history;
DROP POLICY IF EXISTS "order_visitor_history_update_policy" ON order_visitor_history;
DROP POLICY IF EXISTS "order_visitor_history_delete_policy" ON order_visitor_history;
DROP POLICY IF EXISTS "order_visitor_history_open_all" ON order_visitor_history;
CREATE POLICY "order_visitor_history_open_all" ON order_visitor_history FOR ALL USING (true) WITH CHECK (true);

-- 13. reassignment_requests
ALTER TABLE reassignment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reassignment_requests_select_policy" ON reassignment_requests;
DROP POLICY IF EXISTS "reassignment_requests_insert_policy" ON reassignment_requests;
DROP POLICY IF EXISTS "reassignment_requests_update_policy" ON reassignment_requests;
DROP POLICY IF EXISTS "reassignment_requests_delete_policy" ON reassignment_requests;
DROP POLICY IF EXISTS "reassignment_requests_open_all" ON reassignment_requests;
CREATE POLICY "reassignment_requests_open_all" ON reassignment_requests FOR ALL USING (true) WITH CHECK (true);

-- 14. loading_bills
ALTER TABLE loading_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loading_bills_select_policy" ON loading_bills;
DROP POLICY IF EXISTS "loading_bills_insert_policy" ON loading_bills;
DROP POLICY IF EXISTS "loading_bills_update_policy" ON loading_bills;
DROP POLICY IF EXISTS "loading_bills_delete_policy" ON loading_bills;
DROP POLICY IF EXISTS "loading_bills_open_all" ON loading_bills;
CREATE POLICY "loading_bills_open_all" ON loading_bills FOR ALL USING (true) WITH CHECK (true);

-- 15. loading_bill_items
ALTER TABLE loading_bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loading_bill_items_select_policy" ON loading_bill_items;
DROP POLICY IF EXISTS "loading_bill_items_insert_policy" ON loading_bill_items;
DROP POLICY IF EXISTS "loading_bill_items_update_policy" ON loading_bill_items;
DROP POLICY IF EXISTS "loading_bill_items_delete_policy" ON loading_bill_items;
DROP POLICY IF EXISTS "loading_bill_items_open_all" ON loading_bill_items;
CREATE POLICY "loading_bill_items_open_all" ON loading_bill_items FOR ALL USING (true) WITH CHECK (true);

-- 16. invoice_audit
ALTER TABLE invoice_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_audit_select_policy" ON invoice_audit;
DROP POLICY IF EXISTS "invoice_audit_insert_policy" ON invoice_audit;
DROP POLICY IF EXISTS "invoice_audit_update_policy" ON invoice_audit;
DROP POLICY IF EXISTS "invoice_audit_delete_policy" ON invoice_audit;
DROP POLICY IF EXISTS "invoice_audit_open_all" ON invoice_audit;
CREATE POLICY "invoice_audit_open_all" ON invoice_audit FOR ALL USING (true) WITH CHECK (true);

-- 17. inventory_transactions
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_transactions_select_policy" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_insert_policy" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_update_policy" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_delete_policy" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_open_all" ON inventory_transactions;
CREATE POLICY "inventory_transactions_open_all" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);

-- 18. app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_select_policy" ON app_settings;
DROP POLICY IF EXISTS "app_settings_insert_policy" ON app_settings;
DROP POLICY IF EXISTS "app_settings_update_policy" ON app_settings;
DROP POLICY IF EXISTS "app_settings_delete_policy" ON app_settings;
DROP POLICY IF EXISTS "app_settings_open_all" ON app_settings;
CREATE POLICY "app_settings_open_all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
