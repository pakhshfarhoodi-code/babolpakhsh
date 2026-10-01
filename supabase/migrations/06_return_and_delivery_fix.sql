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
