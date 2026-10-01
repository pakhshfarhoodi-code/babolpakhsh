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
