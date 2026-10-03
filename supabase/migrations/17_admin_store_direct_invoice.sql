-- =========================================================================
-- Migration: 17_admin_store_direct_invoice.sql
-- Description: Direct Store Invoice Issuance by Admin (RPC: admin_create_store_invoice)
-- =========================================================================

-- =========================================================================
-- بلوک ۱: شمارنده و تابع شماره‌گذاری رسمی سفارش‌های فروشگاه
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_order_number(
    p_source TEXT DEFAULT 'supermarket',
    p_supermarket_id TEXT DEFAULT NULL,
    p_visitor_id TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_seq_val BIGINT;
    v_code TEXT := '01';
    v_sub_count INT := 0;
BEGIN
    v_seq_val := nextval('public.order_number_seq');
    
    IF p_source = 'visitor' AND p_visitor_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(regexp_replace(id, '\D', '', 'g'), ''), '01') INTO v_code FROM public.visitors WHERE id = p_visitor_id;
        SELECT COUNT(*) INTO v_sub_count FROM public.orders WHERE assigned_visitor_id = p_visitor_id;
        RETURN 'VS' || LPAD(COALESCE(v_code, '01'), 2, '0') || '-' || (1000 + v_seq_val)::text || '-' || (v_sub_count + 1)::text;
    ELSIF p_supermarket_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(regexp_replace(id, '\D', '', 'g'), ''), '01') INTO v_code FROM public.supermarkets WHERE id = p_supermarket_id;
        SELECT COUNT(*) INTO v_sub_count FROM public.orders WHERE supermarket_id = p_supermarket_id;
        RETURN 'SP' || LPAD(COALESCE(v_code, '01'), 2, '0') || '-' || (1000 + v_seq_val)::text || '-' || (v_sub_count + 1)::text;
    ELSE
        RETURN 'ORD-' || to_char(NOW(), 'YYMMDD') || '-' || LPAD(v_seq_val::text, 4, '0');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- بررسی بلوک ۱:
-- SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'order_number_seq';
-- SELECT proname FROM pg_proc WHERE proname = 'next_order_number';

-- =========================================================================
-- بلوک ۲: تابع صدور مستقیم فاکتور فروشگاه توسط ادمین (admin_create_store_invoice)
-- =========================================================================
DROP FUNCTION IF EXISTS public.admin_create_store_invoice(TEXT, JSONB, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.admin_create_store_invoice(
    p_supermarket_id TEXT,
    p_lines JSONB,
    p_visitor_id TEXT,
    p_deliver_now BOOLEAN,
    p_note TEXT
) RETURNS JSON AS $$
DECLARE
    v_actor_id TEXT;
    v_actor_role TEXT;
    v_actor_name TEXT;
    v_sm RECORD;
    v_vis RECORD;
    v_visitor_name TEXT := 'پخش مرکزی';
    v_final_visitor_id TEXT := NULL;
    v_order_id TEXT;
    v_order_channel TEXT;
    v_line RECORD;
    v_prod RECORD;
    v_prod_id TEXT;
    v_line_qty NUMERIC;
    v_unit_price NUMERIC;
    v_line_note TEXT;
    v_free_stock NUMERIC;
    v_total_amount NUMERIC := 0;
    v_status TEXT;
    v_stock_deducted BOOLEAN := false;
    v_success_msg TEXT;
BEGIN
    -- ۱. احراز هویت و بررسی سطح دسترسی: فقط ادمین مجاز است
    v_actor_role := public.app_role();
    v_actor_id := public.app_uid();

    IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'دسترسی غیرمجاز: تنها مدیر ارشد سامانه مجاز به صدور مستقیم فاکتور فروشگاه است.'
        );
    END IF;

    -- دریافت نام فاعل از جدول profiles
    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    IF v_actor_name IS NULL THEN
        v_actor_name := 'مدیر ارشد';
    END IF;

    -- ۲. اعتبارسنجی فروشگاه
    IF p_supermarket_id IS NULL OR trim(p_supermarket_id) = '' THEN
        RETURN json_build_object('success', false, 'message', 'انتخاب فروشگاه الزامی است.');
    END IF;

    SELECT * INTO v_sm FROM public.supermarkets WHERE id = p_supermarket_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'فروشگاه مورد نظر در سامانه یافت نشد.');
    END IF;

    -- بررسی اقلام فاکتور
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور باید حداقل شامل یک قلم کالا باشد.');
    END IF;

    -- ۳. تعیین ویزیتور و کانال سفارش
    IF p_visitor_id IS NOT NULL AND trim(p_visitor_id) <> '' AND p_visitor_id IS DISTINCT FROM 'direct' THEN
        SELECT * INTO v_vis FROM public.visitors WHERE id = p_visitor_id;
        IF FOUND THEN
            v_final_visitor_id := v_vis.id;
            v_visitor_name := v_vis.name;
            v_order_channel := 'store_self';
        ELSE
            v_final_visitor_id := NULL;
            v_visitor_name := 'پخش مرکزی';
            v_order_channel := 'store_direct';
        END IF;
    ELSE
        v_final_visitor_id := NULL;
        v_visitor_name := 'پخش مرکزی';
        v_order_channel := 'store_direct';
    END IF;

    -- ۴. قفل تراکنشی روی فروشگاه برای جلوگیری از تداخل
    PERFORM pg_advisory_xact_lock(hashtext(p_supermarket_id));

    -- ۵. تولید شماره سفارش سروری با next_order_number
    v_order_id := public.next_order_number('supermarket', p_supermarket_id, v_final_visitor_id);

    -- تعیین وضعیت اولیه سفارش بر اساس تحویل فوری
    IF p_deliver_now IS TRUE THEN
        v_status := 'delivered';
        v_stock_deducted := true;
    ELSE
        v_status := 'assigned';
        v_stock_deducted := false;
    END IF;

    -- ۶. درج رکورد اصلی سفارش
    INSERT INTO public.orders (
        id,
        supermarket_id,
        supermarket_name,
        assigned_visitor_id,
        visitor_name,
        status,
        total_amount,
        order_source,
        order_channel,
        stock_deducted,
        order_date
    ) VALUES (
        v_order_id,
        v_sm.id,
        v_sm.name,
        v_final_visitor_id,
        v_visitor_name,
        v_status,
        0,
        'supermarket',
        v_order_channel,
        v_stock_deducted,
        NOW()
    );

    -- ۷. پردازش اقلام و بررسی موجودی
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        product_id TEXT,
        quantity NUMERIC,
        unit_price NUMERIC,
        line_note TEXT
    )
    LOOP
        v_prod_id := v_line.product_id;
        v_line_qty := ROUND(COALESCE(v_line.quantity, 0), 3);
        v_line_note := v_line.line_note;

        IF v_line_qty <= 0 THEN
            RETURN json_build_object('success', false, 'message', 'تعداد کالای انتخابی باید بزرگتر از صفر باشد.');
        END IF;

        -- قفل ردیف کالا
        SELECT * INTO v_prod FROM public.products WHERE id = v_prod_id FOR UPDATE;
        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'کالای انتخابی در سامانه یافت نشد: ' || COALESCE(v_prod_id, ''));
        END IF;

        IF v_prod.is_active IS FALSE THEN
            RETURN json_build_object('success', false, 'message', 'کالای «' || v_prod.name || '» غیرفعال است و امکان صدور فاکتور ندارد.');
        END IF;

        -- بررسی موجودی آزاد
        v_free_stock := v_prod.stock - v_prod.reserved_stock;
        IF v_free_stock < v_line_qty THEN
            RETURN json_build_object(
                'success', false, 
                'message', 'موجودی آزاد کالای «' || v_prod.name || '» کافی نیست. موجودی آزاد: ' || v_free_stock || '، مقدار درخواستی: ' || v_line_qty || ' (کسری: ' || (v_line_qty - v_free_stock) || ')'
            );
        END IF;

        v_unit_price := COALESCE(v_line.unit_price, v_prod.price, 0);
        v_total_amount := v_total_amount + (v_line_qty * v_unit_price);

        -- درج در order_items
        INSERT INTO public.order_items (
            id,
            order_id,
            product_id,
            name,
            price,
            quantity,
            created_at
        ) VALUES (
            gen_random_uuid()::text,
            v_order_id,
            v_prod_id,
            v_prod.name,
            v_unit_price,
            v_line_qty,
            NOW()
        );

        -- مدیریت موجودی و لاگ‌های انبار
        IF p_deliver_now IS TRUE THEN
            -- تحویل فوری: کسر فیزیکی بدون افزایش رزرو (یک‌باره)
            UPDATE public.products 
            SET stock = GREATEST(0, stock - v_line_qty)
            WHERE id = v_prod_id;

            INSERT INTO public.inventory_transactions (
                id,
                product_id,
                product_name,
                transaction_type,
                quantity,
                reference_id,
                created_at
            ) VALUES (
                gen_random_uuid()::text,
                v_prod_id,
                v_prod.name,
                'delivered',
                -v_line_qty,
                v_order_id,
                NOW()
            );
        ELSE
            -- تحویل در روال عادی: رزرو موجودی
            UPDATE public.products 
            SET reserved_stock = reserved_stock + v_line_qty
            WHERE id = v_prod_id;

            INSERT INTO public.inventory_transactions (
                id,
                product_id,
                product_name,
                transaction_type,
                quantity,
                reference_id,
                created_at
            ) VALUES (
                gen_random_uuid()::text,
                v_prod_id,
                v_prod.name,
                'reserve',
                v_line_qty,
                v_order_id,
                NOW()
            );
        END IF;
    END LOOP;

    -- به‌روزرسانی مبلغ کل سفارش
    UPDATE public.orders 
    SET total_amount = v_total_amount
    WHERE id = v_order_id;

    -- پیام بازگشتی
    IF p_deliver_now IS TRUE THEN
        v_success_msg := 'فاکتور مستقیم فروشگاه «' || v_sm.name || '» به شماره ' || v_order_id || ' با موفقیت ثبت و تحویل فوری ثبت شد.';
    ELSE
        IF v_final_visitor_id IS NOT NULL THEN
            v_success_msg := 'فاکتور مستقیم فروشگاه «' || v_sm.name || '» به شماره ' || v_order_id || ' ثبت و در لیست قابل بارگیری ' || v_visitor_name || ' قرار گرفت.';
        ELSE
            v_success_msg := 'فاکتور مستقیم فروشگاه «' || v_sm.name || '» به شماره ' || v_order_id || ' ثبت و در بخش سفارش‌های مستقیم قرار گرفت.';
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', v_success_msg,
        'order_id', v_order_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- بررسی بلوک ۲:
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'admin_create_store_invoice';

-- =========================================================================
-- بلوک ۳: تنظیم مجوزهای امنیتی (Permissions & Hardening)
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.admin_create_store_invoice(TEXT, JSONB, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_store_invoice(TEXT, JSONB, TEXT, BOOLEAN, TEXT) TO authenticated;

-- بررسی بلوک ۳:
-- SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name = 'admin_create_store_invoice';
