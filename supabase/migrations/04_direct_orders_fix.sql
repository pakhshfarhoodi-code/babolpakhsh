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
