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
