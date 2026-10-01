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
