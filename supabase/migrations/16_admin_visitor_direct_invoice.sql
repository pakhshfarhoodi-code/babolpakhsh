-- =========================================================================
-- Migration: 16_admin_visitor_direct_invoice.sql
-- Description: Direct Visitor Invoice Issuance by Admin (RPC: admin_create_visitor_invoice)
-- =========================================================================

-- =========================================================================
-- بلوک ۱: اطمینان از نوع داده عددی اعشاری (NUMERIC) برای مقادیر اقلام و وجود شمارنده فاکتور
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.loading_bill_items ALTER COLUMN quantity TYPE NUMERIC;
ALTER TABLE public.loading_bill_items ALTER COLUMN original_quantity TYPE NUMERIC;
ALTER TABLE public.inventory_transactions ALTER COLUMN quantity TYPE NUMERIC;
ALTER TABLE public.products ALTER COLUMN stock TYPE NUMERIC;
ALTER TABLE public.products ALTER COLUMN reserved_stock TYPE NUMERIC;

-- بررسی بلوک ۱:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'loading_bill_items' AND column_name IN ('quantity', 'original_quantity');
-- SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'invoice_seq';

-- =========================================================================
-- بلوک ۲: تابع جامع صدور مستقیم فاکتور ویزیتور توسط ادمین
-- =========================================================================
DROP FUNCTION IF EXISTS public.admin_create_visitor_invoice(TEXT, JSONB, TEXT[], TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.admin_create_visitor_invoice(
    p_visitor_id TEXT,
    p_lines JSONB,
    p_order_ids TEXT[],
    p_note TEXT,
    p_issue BOOLEAN
) RETURNS JSON AS $$
DECLARE
    v_actor_id TEXT;
    v_actor_role TEXT;
    v_actor_name TEXT;
    v_visitor_name TEXT;
    v_invoice_id TEXT;
    v_invoice_no TEXT := NULL;
    v_seq_val BIGINT;
    v_require_warehouse BOOLEAN := false;
    v_line RECORD;
    v_ord RECORD;
    v_ord_item RECORD;
    v_prod RECORD;
    v_prod_id TEXT;
    v_line_qty NUMERIC;
    v_unit_price NUMERIC;
    v_cust_label TEXT;
    v_line_note TEXT;
    v_free_stock NUMERIC;
    v_total_store NUMERIC := 0;
    v_total_visitor NUMERIC := 0;
    v_orders_cnt INT := 0;
    v_final_status TEXT := 'pending';
    v_success_msg TEXT;
    v_item RECORD;
BEGIN
    -- ۱. احراز هویت و بررسی سطح دسترسی: فقط ادمین مجاز است
    v_actor_role := public.app_role();
    v_actor_id := public.app_uid();

    IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'دسترسی غیرمجاز: تنها مدیر ارشد سامانه مجاز به صدور مستقیم فاکتور است.'
        );
    END IF;

    -- دریافت نام فاعل از جدول profiles
    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    IF v_actor_name IS NULL THEN
        v_actor_name := 'مدیر ارشد';
    END IF;

    -- ۲. اعتبارسنجی ویزیتور
    IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN
        RETURN json_build_object('success', false, 'message', 'انتخاب ویزیتور الزامی است.');
    END IF;

    SELECT name INTO v_visitor_name FROM public.visitors WHERE id = p_visitor_id;
    IF v_visitor_name IS NULL THEN
        SELECT name INTO v_visitor_name FROM public.profiles WHERE id = p_visitor_id;
    END IF;
    IF v_visitor_name IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'ویزیتور مورد نظر یافت نشد.');
    END IF;

    -- بررسی وجود حداقل یک قلم یا یک سفارش
    IF (p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL OR array_length(p_order_ids, 1) = 0)
       AND (p_lines IS NULL OR jsonb_array_length(p_lines) = 0) THEN
        RETURN json_build_object('success', false, 'message', 'فاکتور باید حداقل شامل یک سفارش یا یک قلم کالای مازاد/مستقیم باشد.');
    END IF;

    -- ۳. قفل تراکنشی روی ویزیتور برای جلوگیری از تداخل
    PERFORM pg_advisory_xact_lock(hashtext(p_visitor_id));

    -- ۴. تولید شناسه یکتای سروری فاکتور: BL-{prefix}-{YYMMDDHH24MI}-{random4}
    v_invoice_id := 'BL-' || upper(substr(replace(p_visitor_id, '-', ''), 1, 4)) || '-' || to_char(NOW(), 'YYMMDDHH24MI') || '-' || substr(md5(random()::text), 1, 4);

    -- ۵. درج رکورد اصلی فاکتور با وضعیت اولیه pending
    INSERT INTO public.loading_bills (
        id,
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

    -- ۶. پردازش سفارش‌های سامانه‌ای انتخابی (در صورت وجود)
    IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
        FOR v_ord IN 
            SELECT * FROM public.orders 
            WHERE id = ANY(p_order_ids) 
            FOR UPDATE
        LOOP
            IF v_ord.assigned_visitor_id IS DISTINCT FROM p_visitor_id THEN
                RAISE EXCEPTION 'سفارش % متعلق به این ویزیتور نیست.', v_ord.id;
            END IF;

            IF v_ord.status IS DISTINCT FROM 'assigned' THEN
                RAISE EXCEPTION 'سفارش % در وضعیت آماده بارگیری نیست (وضعیت فعلی: %).', v_ord.id, v_ord.status;
            END IF;

            IF v_ord.loading_bill_id IS NOT NULL THEN
                RAISE EXCEPTION 'سفارش % قبلاً به برگه بارگیری دیگری تخصیص یافته است.', v_ord.id;
            END IF;

            -- تخصیص سفارش به فاکتور و تغییر وضعیت به loading
            UPDATE public.orders 
            SET loading_bill_id = v_invoice_id,
                status = 'loading'
            WHERE id = v_ord.id;

            -- کپی اقلام سفارش در اقلام فاکتور با اسنپ‌شات قیمت
            FOR v_ord_item IN 
                SELECT oi.*, p.visitor_price AS current_vis_price, p.price AS current_store_price, p.name AS current_prod_name
                FROM public.order_items oi
                LEFT JOIN public.products p ON p.id = oi.product_id
                WHERE oi.order_id = v_ord.id
            LOOP
                INSERT INTO public.loading_bill_items (
                    id,
                    loading_bill_id,
                    order_id,
                    product_id,
                    product_name,
                    quantity,
                    original_quantity,
                    store_price,
                    visitor_price,
                    source,
                    customer_label,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    v_invoice_id,
                    v_ord.id,
                    v_ord_item.product_id,
                    COALESCE(v_ord_item.current_prod_name, v_ord_item.name),
                    v_ord_item.quantity,
                    v_ord_item.quantity,
                    COALESCE(v_ord_item.price, v_ord_item.current_store_price, 0),
                    COALESCE(v_ord_item.current_vis_price, v_ord_item.price * 0.85, 0),
                    'order',
                    COALESCE(v_ord.supermarket_name, 'سفارش سوپرمارکت'),
                    NOW()
                );
            END LOOP;
        END LOOP;
    END IF;

    -- ۷. پردازش ردیف‌های مستقیم/مازاد ادمین (source = 'admin_manual')
    IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
            product_id TEXT,
            quantity NUMERIC,
            visitor_price NUMERIC,
            customer_label TEXT,
            line_note TEXT
        )
        LOOP
            v_prod_id := v_line.product_id;
            v_line_qty := ROUND(COALESCE(v_line.quantity, 0), 3);
            v_cust_label := COALESCE(v_line.customer_label, 'مازاد / مستقیم');
            v_line_note := v_line.line_note;

            IF v_line_qty <= 0 THEN
                RETURN json_build_object('success', false, 'message', 'تعداد کالای انتخابی باید بزرگتر از صفر باشد.');
            END IF;

            -- قفل محصول و بررسی موجودی آزاد
            SELECT * INTO v_prod 
            FROM public.products 
            WHERE id = v_prod_id 
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN json_build_object('success', false, 'message', 'کالای انتخابی در سامانه یافت نشد: ' || COALESCE(v_prod_id, ''));
            END IF;

            IF v_prod.is_active IS FALSE THEN
                RETURN json_build_object('success', false, 'message', 'کالای «' || v_prod.name || '» غیرفعال است و امکان صدور فاکتور ندارد.');
            END IF;

            v_free_stock := v_prod.stock - v_prod.reserved_stock;
            IF v_free_stock < v_line_qty THEN
                RETURN json_build_object(
                    'success', false, 
                    'message', 'موجودی آزاد کالای «' || v_prod.name || '» کافی نیست. موجودی آزاد: ' || v_free_stock || '، مقدار درخواستی: ' || v_line_qty || ' (کسری: ' || (v_line_qty - v_free_stock) || ')'
                );
            END IF;

            -- تعیین قیمت واحد ویزیتور
            v_unit_price := COALESCE(v_line.visitor_price, v_prod.visitor_price, ROUND(v_prod.price * 0.85));

            -- رزرو موجودی کالا
            UPDATE public.products 
            SET reserved_stock = reserved_stock + v_line_qty 
            WHERE id = v_prod_id;

            -- ثبت تراکنش رزرو در لاگ انبار
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
                v_invoice_id,
                NOW()
            );

            -- درج قلم کالا
            INSERT INTO public.loading_bill_items (
                id,
                loading_bill_id,
                order_id,
                product_id,
                product_name,
                quantity,
                original_quantity,
                store_price,
                visitor_price,
                source,
                customer_label,
                line_note,
                created_at
            ) VALUES (
                gen_random_uuid(),
                v_invoice_id,
                NULL,
                v_prod_id,
                v_prod.name,
                v_line_qty,
                v_line_qty,
                v_prod.price,
                v_unit_price,
                'admin_manual',
                v_cust_label,
                v_line_note,
                NOW()
            );
        END LOOP;
    END IF;

    -- ۸. محاسبه جمع مبالغ و تعداد سفارش‌ها
    SELECT 
        COALESCE(SUM(quantity * COALESCE(store_price, 0)), 0),
        COALESCE(SUM(quantity * COALESCE(visitor_price, 0)), 0),
        COUNT(DISTINCT order_id)
    INTO v_total_store, v_total_visitor, v_orders_cnt
    FROM public.loading_bill_items
    WHERE loading_bill_id = v_invoice_id;

    UPDATE public.loading_bills 
    SET total_store_amount = v_total_store,
        total_visitor_cost = v_total_visitor,
        orders_count = v_orders_cnt
    WHERE id = v_invoice_id;

    -- ۹. ثبت لاگ حسابرسی (Audit Log)
    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        v_invoice_id,
        'admin_direct_create',
        v_actor_name,
        json_build_object(
            'visitor_id', p_visitor_id,
            'visitor_name', v_visitor_name,
            'orders_count', v_orders_cnt,
            'total_visitor_cost', v_total_visitor,
            'issue_immediate', p_issue,
            'admin_note', p_note
        ),
        NOW()
    );

    -- ۱۰. فرآیند صدور نهایی (p_issue = true)
    IF p_issue IS TRUE THEN
        v_seq_val := nextval('public.invoice_seq');
        v_invoice_no := 'F-' || LPAD(v_seq_val::text, 5, '0');

        -- بررسی وضعیت تنظیم مرحله تایید انبار
        SELECT COALESCE((value)::text = 'true' OR (value)::text = '"true"', false) 
        INTO v_require_warehouse 
        FROM public.app_settings 
        WHERE key = 'require_warehouse_step';

        IF v_require_warehouse IS FALSE THEN
            -- صدور آنی بدون نیاز به مرحله تایید انبار: کسر موجودی فیزیکی و آزادسازی رزرو
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

                INSERT INTO public.inventory_transactions (
                    id, product_id, transaction_type, quantity, reference_id, created_at
                ) VALUES (
                    gen_random_uuid()::text, v_item.product_id, 'release_reserve', -v_item.total_qty, v_invoice_id, NOW()
                );
            END LOOP;

            v_final_status := 'loaded';
            UPDATE public.loading_bills 
            SET status = 'loaded',
                invoice_no = v_invoice_no,
                approved_by = v_actor_name,
                approved_at = NOW(),
                finalized_by = v_actor_name,
                finalized_at = NOW()
            WHERE id = v_invoice_id;

            v_success_msg := 'فاکتور مستقیم با شماره ' || v_invoice_no || ' با موفقیت صادر و بارگیری ثبت شد.';
        ELSE
            -- مرحله انبار فعال است: وضعیت approved
            v_final_status := 'approved';
            UPDATE public.loading_bills 
            SET status = 'approved',
                invoice_no = v_invoice_no,
                approved_by = v_actor_name,
                approved_at = NOW()
            WHERE id = v_invoice_id;

            v_success_msg := 'فاکتور مستقیم با شماره ' || v_invoice_no || ' با موفقیت صادر شد و در انتظار تایید خروج انبار قرار گرفت.';
        END IF;

        INSERT INTO public.invoice_audit (
            invoice_id,
            action,
            actor_name,
            details,
            created_at
        ) VALUES (
            v_invoice_id,
            'finalize_invoice',
            v_actor_name,
            json_build_object('invoice_no', v_invoice_no, 'require_warehouse_step', v_require_warehouse, 'direct_admin_issue', true),
            NOW()
        );
    ELSE
        -- ذخیره در حالت پیش‌نویس ارسالی (در انتظار تایید ادمین)
        v_final_status := 'pending';
        v_success_msg := 'فاکتور مستقیم با موفقیت ذخیره و در وضعیت در انتظار تایید قرار گرفت.';
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', v_success_msg,
        'invoice_id', v_invoice_id,
        'invoice_no', v_invoice_no,
        'status', v_final_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- بررسی بلوک ۲:
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'admin_create_visitor_invoice';

-- =========================================================================
-- بلوک ۳: تنظیم مجوزهای دسترسی امن (Permissions & Hardening)
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.admin_create_visitor_invoice(TEXT, JSONB, TEXT[], TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_visitor_invoice(TEXT, JSONB, TEXT[], TEXT, BOOLEAN) TO authenticated;

-- بررسی بلوک ۳:
-- SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name = 'admin_create_visitor_invoice';
