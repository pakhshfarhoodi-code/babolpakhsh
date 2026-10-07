-- ==============================================================================
-- Migration 23: Visitor Loading Bill & Surplus Items (اقلام مازاد و انتخاب سفارش‌ها)
-- ==============================================================================

-- ۱. اطمینان از پشتیبانی مقادیر اعشاری برای تعداد اقلام فاکتور بارگیری
ALTER TABLE public.loading_bill_items 
    ALTER COLUMN quantity TYPE NUMERIC(12, 3),
    ALTER COLUMN original_quantity TYPE NUMERIC(12, 3);

-- ۲. به‌روزرسانی تابع افزودن قلم مازاد ویزیتور / ادمین با پشتیبانی از مقادیر اعشاری و قیمت خرید همکار
DROP FUNCTION IF EXISTS public.invoice_add_manual_line(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.invoice_add_manual_line(TEXT, TEXT, INT, TEXT, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_add_manual_line(
    p_invoice_id TEXT,
    p_product_id TEXT,
    p_qty NUMERIC,
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

    -- قفل و بررسی فاکتور
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور بارگیری یافت نشد.');
    END IF;

    IF v_bill.status NOT IN ('draft', 'pending', 'approved') THEN
        RETURN json_build_object('success', false, 'message', 'افزودن قلم مازاد در وضعیت فعلی فاکتور مجاز نیست.');
    END IF;

    -- دریافت مشخصات و قیمت‌های کالا
    SELECT * INTO v_prod 
    FROM public.products 
    WHERE id = p_product_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'کالای انتخابی یافت نشد.');
    END IF;

    -- محاسبه قیمت‌ها: اولویت با قیمت همکار / خرید ویزیتور
    v_store_p := COALESCE(p_unit_price, v_prod.price, 0);
    v_vis_p := COALESCE(v_prod.visitor_price, p_unit_price, ROUND(v_store_p * 0.85), 0);

    -- درج قلم مازاد در اقلام فاکتور بار
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
        COALESCE(p_customer_label, 'مازاد خودرو / مستقیم'),
        p_line_note,
        v_vis_p,
        v_store_p,
        NOW()
    ) RETURNING id INTO v_new_line_id;

    -- به‌روزرسانی تجمیع کل فاکتور بار
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

    -- ثبت لاگ رویداد
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
        'message', 'قلم مازاد با موفقیت به فاکتور بار افزوده شد.',
        'line_id', v_new_line_id,
        'total_visitor_cost', v_total_visitor,
        'total_store_amount', v_total_store
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ۳. به‌روزرسانی تابع ویرایش تعداد قلم در فاکتور بارگیری
DROP FUNCTION IF EXISTS public.invoice_update_line(UUID, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.invoice_update_line(UUID, INT, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invoice_update_line(
    p_line_id UUID,
    p_qty NUMERIC,
    p_unit_price NUMERIC,
    p_actor TEXT,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_line RECORD;
    v_bill RECORD;
    v_old_qty NUMERIC;
    v_old_price NUMERIC;
    v_total_store NUMERIC;
    v_total_visitor NUMERIC;
BEGIN
    SELECT * INTO v_line 
    FROM public.loading_bill_items 
    WHERE id = p_line_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'ردیف مورد نظر یافت نشد.');
    END IF;

    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE id = v_line.loading_bill_id 
    FOR UPDATE;

    IF v_bill.status NOT IN ('draft', 'pending', 'approved') THEN
        RETURN json_build_object('success', false, 'message', 'امکان ویرایش فاکتور در وضعیت فعلی وجود ندارد.');
    END IF;

    v_old_qty := v_line.quantity;
    v_old_price := v_line.visitor_price;

    UPDATE public.loading_bill_items
    SET quantity = p_qty,
        visitor_price = COALESCE(p_unit_price, visitor_price)
    WHERE id = p_line_id;

    -- محاسبه مجدد جمع فاکتور بار
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0)
    INTO v_total_store, v_total_visitor
    FROM public.loading_bill_items
    WHERE loading_bill_id = v_line.loading_bill_id;

    UPDATE public.loading_bills
    SET total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor,
        revision_count = CASE WHEN status IN ('pending', 'approved') THEN revision_count + 1 ELSE revision_count END
    WHERE id = v_line.loading_bill_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'ردیف با موفقیت به‌روزرسانی شد.',
        'total_visitor_cost', v_total_visitor
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
