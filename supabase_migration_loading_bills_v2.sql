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
