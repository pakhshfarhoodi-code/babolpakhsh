-- =========================================================================
-- Migration: 25_unify_invoice_and_loading_bill_numbers.sql
-- Description: Unify Visitor Loading Bills and Invoices to VS{code}-{seq}-{subseq}
--              Eliminate redundant F-0000 renumbering and random BL- hash prefixes.
-- =========================================================================

-- ۱. اطمینان از وجود سیکوئنس مرکزی شماره‌گذاری
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1001 INCREMENT BY 1;

-- ۲. تابع اختصاصی صدور شماره یکپارچه بارگیری و فاکتور ویزیتور: VS{visitorCode}-{overallSeq}-{visitorSeq}
CREATE OR REPLACE FUNCTION public.next_loading_bill_number(
    p_visitor_id TEXT
) RETURNS TEXT AS $$
DECLARE
    v_seq_val BIGINT;
    v_vis_code TEXT := '01';
    v_vis_sub_count INT := 0;
BEGIN
    v_seq_val := nextval('public.order_number_seq');

    IF p_visitor_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(regexp_replace(id, '\D', '', 'g'), ''), '01') 
        INTO v_vis_code 
        FROM public.visitors 
        WHERE id = p_visitor_id;

        IF v_vis_code IS NULL OR length(v_vis_code) = 0 THEN
            v_vis_code := '01';
        END IF;

        SELECT COUNT(*) INTO v_vis_sub_count 
        FROM public.loading_bills 
        WHERE visitor_id = p_visitor_id;
    END IF;

    RETURN 'VS' || LPAD(COALESCE(v_vis_code, '01'), 2, '0') || '-' || (1000 + v_seq_val)::text || '-' || (v_vis_sub_count + 1)::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ۳. اصلاح تابع get_or_create_draft_invoice جهت استفاده از شناسه ساختاریافته VS
CREATE OR REPLACE FUNCTION public.get_or_create_draft_invoice(
    p_visitor_id TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
    v_bill_id TEXT;
    v_visitor_name TEXT;
    v_draft_order_ids TEXT[];
    v_ord RECORD;
    v_it RECORD;
    v_prod RECORD;
    v_vis_price NUMERIC;
    v_str_price NUMERIC;
    v_items_count INT := 0;
    v_total_vis NUMERIC := 0;
    v_total_str NUMERIC := 0;
BEGIN
    -- 1. Check if an active draft already exists
    SELECT * INTO v_bill 
    FROM public.loading_bills 
    WHERE visitor_id = p_visitor_id AND status = 'draft'
    ORDER BY created_at DESC 
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

    -- 3. Generate structured unified bill ID: VS{visitorCode}-{overallSeq}-{visitorSeq}
    v_bill_id := public.next_loading_bill_number(p_visitor_id);

    -- 4. Insert parent loading_bills row with invoice_no identical to id
    INSERT INTO public.loading_bills (
        id,
        invoice_no,
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

    -- 5. Auto-include any eligible orders (status = 'assigned' and loading_bill_id is null)
    SELECT array_agg(id) INTO v_draft_order_ids
    FROM public.orders
    WHERE assigned_visitor_id = p_visitor_id 
      AND status = 'assigned' 
      AND loading_bill_id IS NULL;

    IF v_draft_order_ids IS NOT NULL AND array_length(v_draft_order_ids, 1) > 0 THEN
        FOR v_ord IN SELECT * FROM public.orders WHERE id = ANY(v_draft_order_ids) LOOP
            FOR v_it IN SELECT * FROM public.order_items WHERE order_id = v_ord.id LOOP
                SELECT * INTO v_prod FROM public.products WHERE id = v_it.product_id;
                
                v_vis_price := COALESCE(v_prod.visitor_price, v_it.price);
                v_str_price := v_it.price;

                INSERT INTO public.loading_bill_items (
                    id,
                    loading_bill_id,
                    order_id,
                    product_id,
                    product_name,
                    quantity,
                    original_quantity,
                    visitor_price,
                    store_price,
                    source,
                    customer_label,
                    created_at
                ) VALUES (
                    'lbi-' || to_char(NOW(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 6),
                    v_bill_id,
                    v_ord.id,
                    v_it.product_id,
                    v_it.name,
                    v_it.quantity,
                    v_it.quantity,
                    v_vis_price,
                    v_str_price,
                    'order',
                    v_ord.supermarket_name,
                    NOW()
                );

                v_total_vis := v_total_vis + (v_vis_price * v_it.quantity);
                v_total_str := v_total_str + (v_str_price * v_it.quantity);
                v_items_count := v_items_count + 1;
            END LOOP;
        END LOOP;

        UPDATE public.orders 
        SET loading_bill_id = v_bill_id,
            status = 'loading'
        WHERE id = ANY(v_draft_order_ids);

        UPDATE public.loading_bills
        SET orders_count = array_length(v_draft_order_ids, 1),
            total_visitor_cost = v_total_vis,
            total_store_amount = v_total_str
        WHERE id = v_bill_id;
    END IF;

    SELECT * INTO v_bill FROM public.loading_bills WHERE id = v_bill_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'پیش‌نویس فاکتور جدید ایجاد شد.',
        'bill_id', v_bill_id,
        'is_new', true,
        'bill', row_to_json(v_bill)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ۴. اصلاح finalize_invoice جهت جلوگیری از صدور شماره مجدد F- و تثبیت شناسه VS
CREATE OR REPLACE FUNCTION public.finalize_invoice(
    p_invoice_id TEXT,
    p_actor TEXT
) RETURNS JSON AS $$
DECLARE
    v_bill RECORD;
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

    -- تثبیت شماره یکپارچه (بدون تولید فرمت اضافی F-)
    IF v_bill.invoice_no IS NULL OR v_bill.invoice_no LIKE 'F-%' THEN
        v_invoice_no := v_bill.id;
    ELSE
        v_invoice_no := v_bill.invoice_no;
    END IF;

    -- بررسی تنظیم مرحله تایید انبار
    SELECT COALESCE((value)::text = 'true' OR (value)::text = '"true"', false) 
    INTO v_require_warehouse 
    FROM public.app_settings 
    WHERE key = 'require_warehouse_step';

    IF v_require_warehouse = false THEN
        -- Instant dispatch: کسر موجودی فیزیکی و آزادسازی رزرو
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
        -- Warehouse step required: تثبیت قیمت‌ها و وضعیت approved
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
            'finalize_prices',
            COALESCE(p_actor, 'ادمین'),
            json_build_object('invoice_no', v_invoice_no, 'require_warehouse_step', true),
            NOW()
        );

        RETURN json_build_object(
            'success', true, 
            'message', 'قیمت‌ها قفل شدند و فاکتور تایید گردید. منتظر تایید خروج از انبار.',
            'invoice_no', v_invoice_no,
            'status', 'approved'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ۵. اصلاح admin_create_visitor_invoice جهت صدور با پیشوند VS و یکسان‌سازی invoice_no با id
CREATE OR REPLACE FUNCTION public.admin_create_visitor_invoice(
    p_visitor_id TEXT,
    p_lines JSONB,
    p_order_ids TEXT[] DEFAULT '{}',
    p_note TEXT DEFAULT NULL,
    p_issue BOOLEAN DEFAULT false
) RETURNS JSON AS $$
DECLARE
    v_visitor_name TEXT;
    v_invoice_id TEXT;
    v_invoice_no TEXT;
    v_total_visitor NUMERIC := 0;
    v_total_store NUMERIC := 0;
    v_orders_cnt INT := 0;
    v_item RECORD;
    v_prod RECORD;
    v_ord RECORD;
    v_qty NUMERIC;
    v_vprice NUMERIC;
    v_sprice NUMERIC;
    v_success_msg TEXT;
    v_require_warehouse BOOLEAN := false;
BEGIN
    -- ۱. اعتبارسنجی ویزیتور
    SELECT name INTO v_visitor_name FROM public.visitors WHERE id = p_visitor_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'ویزیتور انتخاب شده معتبر نیست.');
    END IF;

    -- ۲. اعتبارسنجی اقلام
    IF (p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL OR array_length(p_order_ids, 1) = 0)
       AND (p_lines IS NULL OR jsonb_array_length(p_lines) = 0) THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور باید حداقل شامل یک سفارش یا یک قلم کالای مازاد/مستقیم باشد.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_visitor_id));

    -- تولید شناسه یکتای سروری با پیشوند ساختاریافته VS
    v_invoice_id := public.next_loading_bill_number(p_visitor_id);
    v_invoice_no := v_invoice_id;

    -- درج رکورد اصلی فاکتور
    INSERT INTO public.loading_bills (
        id,
        invoice_no,
        visitor_id,
        visitor_name,
        status,
        orders_count,
        total_visitor_cost,
        total_store_amount,
        revision_count,
        admin_note,
        created_at,
        submitted_at
    ) VALUES (
        v_invoice_id,
        v_invoice_no,
        p_visitor_id,
        v_visitor_name,
        'pending',
        0,
        0,
        0,
        0,
        p_note,
        NOW(),
        NOW()
    );

    -- درج سفارش‌های سیستمی
    IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
        v_orders_cnt := array_length(p_order_ids, 1);
        FOR v_ord IN 
            SELECT id, supermarket_name FROM public.orders 
            WHERE id = ANY(p_order_ids) AND (assigned_visitor_id = p_visitor_id OR assigned_visitor_id IS NULL)
        LOOP
            FOR v_item IN SELECT * FROM public.order_items WHERE order_id = v_ord.id LOOP
                SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id;
                v_vprice := COALESCE(v_prod.visitor_price, v_item.price);
                v_sprice := v_item.price;

                INSERT INTO public.loading_bill_items (
                    id, loading_bill_id, order_id, product_id, product_name,
                    quantity, original_quantity, visitor_price, store_price,
                    source, customer_label, created_at
                ) VALUES (
                    'bi-' || v_ord.id || '-' || v_item.id,
                    v_invoice_id, v_ord.id, v_item.product_id, v_item.name,
                    v_item.quantity, v_item.quantity, v_vprice, v_sprice,
                    'order', v_ord.supermarket_name, NOW()
                );

                v_total_visitor := v_total_visitor + (v_vprice * v_item.quantity);
                v_total_store := v_total_store + (v_sprice * v_item.quantity);
            END LOOP;

            UPDATE public.orders 
            SET loading_bill_id = v_invoice_id, status = 'loading'
            WHERE id = v_ord.id;
        END LOOP;
    END IF;

    -- درج اقلام دستی/مازاد
    IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
            product_id TEXT, quantity NUMERIC, visitor_price NUMERIC,
            customer_label TEXT, line_note TEXT
        ) LOOP
            SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'کالای % یافت نشد.', v_item.product_id;
            END IF;

            v_qty := v_item.quantity;
            v_vprice := v_item.visitor_price;
            v_sprice := v_prod.price;

            INSERT INTO public.loading_bill_items (
                id, loading_bill_id, order_id, product_id, product_name,
                quantity, original_quantity, visitor_price, store_price,
                source, customer_label, line_note, created_at
            ) VALUES (
                'mli-' || to_char(NOW(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 6),
                v_invoice_id, NULL, v_item.product_id, v_prod.name,
                v_qty, v_qty, v_vprice, v_sprice,
                'admin_manual', COALESCE(v_item.customer_label, 'مازاد / مستقیم'),
                v_item.line_note, NOW()
            );

            v_total_visitor := v_total_visitor + (v_vprice * v_qty);
            v_total_store := v_total_store + (v_sprice * v_qty);
        END LOOP;
    END IF;

    -- به‌روزرسانی مبالغ
    UPDATE public.loading_bills 
    SET orders_count = v_orders_cnt,
        total_visitor_cost = v_total_visitor,
        total_store_amount = v_total_store
    WHERE id = v_invoice_id;

    -- صدور نهایی در صورت p_issue = true
    IF p_issue IS TRUE THEN
        SELECT COALESCE((value)::text = 'true' OR (value)::text = '"true"', false) 
        INTO v_require_warehouse 
        FROM public.app_settings 
        WHERE key = 'require_warehouse_step';

        IF v_require_warehouse IS FALSE THEN
            FOR v_item IN 
                SELECT product_id, SUM(quantity) AS total_qty 
                FROM public.loading_bill_items 
                WHERE loading_bill_id = v_invoice_id 
                GROUP BY product_id
            LOOP
                PERFORM id FROM public.products WHERE id = v_item.product_id FOR UPDATE;

                UPDATE public.products 
                SET stock = GREATEST(0, stock - v_item.total_qty),
                    reserved_stock = GREATEST(0, reserved_stock - v_item.total_qty) 
                WHERE id = v_item.product_id;

                INSERT INTO public.inventory_transactions (
                    id, product_id, transaction_type, quantity, reference_id, created_at
                ) VALUES (
                    gen_random_uuid()::text, v_item.product_id, 'load_out', v_item.total_qty, v_invoice_id, NOW()
                );
            END LOOP;

            UPDATE public.orders 
            SET stock_deducted = TRUE 
            WHERE loading_bill_id = v_invoice_id;

            UPDATE public.loading_bills 
            SET status = 'loaded',
                invoice_no = v_invoice_no,
                approved_at = NOW(),
                approved_by = 'مدیریت',
                finalized_at = NOW(),
                finalized_by = 'مدیریت'
            WHERE id = v_invoice_id;

            v_success_msg := 'فاکتور مستقیم با شماره ' || v_invoice_no || ' صادر و بارگیری ثبت شد.';
        ELSE
            UPDATE public.loading_bills 
            SET status = 'approved',
                invoice_no = v_invoice_no,
                approved_at = NOW(),
                approved_by = 'مدیریت',
                finalized_at = NOW(),
                finalized_by = 'مدیریت'
            WHERE id = v_invoice_id;

            v_success_msg := 'فاکتور مستقیم با شماره ' || v_invoice_no || ' صادر شد و در انتظار تایید خروج انبار قرار گرفت.';
        END IF;
    ELSE
        v_success_msg := 'پیش‌نویس فاکتور مستقیم با شناسه ' || v_invoice_id || ' با موفقیت ثبت شد.';
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', v_success_msg,
        'invoice_id', v_invoice_id,
        'invoice_no', v_invoice_no,
        'status', (SELECT status FROM public.loading_bills WHERE id = v_invoice_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ۶. پاکسازی و تبدیل فاکتورهای قدیمی با پیشوند F- به شناسه همان فاکتور
UPDATE public.loading_bills 
SET invoice_no = id 
WHERE invoice_no LIKE 'F-%';
