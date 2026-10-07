-- Migration 22: Visitor Self Orders & Order Total Recalculation
-- توضیحات:
-- ۱. به‌روزرسانی تابع create_order_transaction جهت پشتیبانی از خرید شخصی ویزیتور (بدون ویزیتور تخصیص‌یافته / NULL)
-- ۲. اصلاح و همگام‌سازی جمع کل فاکتورها (total_amount) برای سفارش‌های موجود با اعمال ضریب تعداد در کارتن

-- الف) اصلاح تابع ثبت سفارش در پایگاه‌داده
CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_order_id TEXT,
  p_supermarket_id TEXT,
  p_supermarket_name TEXT,
  p_assigned_visitor_id TEXT,
  p_visitor_name TEXT,
  p_status TEXT,
  p_total_amount NUMERIC,
  p_items JSONB,
  p_order_channel TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_actual_sm_id TEXT;
  v_actual_vis_id TEXT;
  v_final_visitor_name TEXT;
  v_caller_name TEXT;
  item JSONB;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  -- اگر فراخوانی با توکن احراز هویت صورت نگرفته باشد
  IF v_uid IS NULL THEN
    v_uid := 'anon';
    v_role := 'admin';
  END IF;

  -- بررسی نقش و تخصیص ویزیتور
  IF v_role = 'supermarket' THEN
    v_actual_sm_id := v_uid;
    SELECT assigned_visitor_id INTO v_actual_vis_id FROM public.supermarkets WHERE id = v_uid;
    v_final_visitor_name := COALESCE(p_visitor_name, 'واحد پخش و توزیع');
  ELSIF v_role = 'visitor' THEN
    -- در صورت خرید شخصی ویزیتور (خودم)، ویزیتور تخصیص‌یافته باید خالی / NULL باشد
    IF p_assigned_visitor_id IS NULL OR p_assigned_visitor_id = '' OR p_assigned_visitor_id = 'direct' OR p_supermarket_id LIKE 'self-%' THEN
      v_actual_vis_id := NULL;
      v_final_visitor_name := '';
    ELSE
      v_actual_vis_id := v_uid;
      v_final_visitor_name := COALESCE(p_visitor_name, '');
    END IF;
    v_actual_sm_id := p_supermarket_id;
  ELSIF v_role = 'admin' OR v_role = 'warehouse' THEN
    v_actual_sm_id := p_supermarket_id;
    IF p_assigned_visitor_id IS NULL OR p_assigned_visitor_id = '' OR p_assigned_visitor_id = 'direct' THEN
      v_actual_vis_id := NULL;
      v_final_visitor_name := '';
    ELSE
      v_actual_vis_id := p_assigned_visitor_id;
      v_final_visitor_name := COALESCE(p_visitor_name, '');
    END IF;
  ELSE
    RAISE EXCEPTION 'نقش کاربر مجاز به ثبت سفارش نیست.';
  END IF;

  -- بررسی کلید خارجی سوپرمارکت برای جلوگیری از خطای Foreign Key
  IF v_actual_sm_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.supermarkets WHERE id = v_actual_sm_id) THEN
    v_actual_sm_id := NULL;
  END IF;

  -- درج یا به‌روزرسانی سفارش
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
    order_date
  ) VALUES (
    p_order_id,
    v_actual_sm_id,
    COALESCE(p_supermarket_name, 'خریدار'),
    v_actual_vis_id,
    v_final_visitor_name,
    COALESCE(p_status, 'assigned'),
    p_total_amount,
    'visitor',
    COALESCE(p_order_channel, CASE WHEN v_actual_vis_id IS NULL THEN 'store_self' ELSE 'visitor_field' END),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    supermarket_name = EXCLUDED.supermarket_name,
    assigned_visitor_id = EXCLUDED.assigned_visitor_id,
    visitor_name = EXCLUDED.visitor_name,
    status = EXCLUDED.status,
    total_amount = EXCLUDED.total_amount,
    order_channel = EXCLUDED.order_channel;

  -- ثبت اقلام و رزرو موجودی
  IF p_items IS NOT NULL THEN
    -- حذف اقلام قبلی در صورت وجود
    DELETE FROM public.order_items WHERE order_id = p_order_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      UPDATE public.products
      SET reserved_stock = COALESCE(reserved_stock, 0) + (item->>'quantity')::INTEGER
      WHERE id = item->>'productId';

      INSERT INTO public.order_items (
        id,
        order_id,
        product_id,
        name,
        price,
        quantity,
        items_per_package,
        unit
      ) VALUES (
        gen_random_uuid()::text,
        p_order_id,
        item->>'productId',
        item->>'name',
        (item->>'price')::NUMERIC,
        (item->>'quantity')::NUMERIC,
        (item->>'items_per_package')::INTEGER,
        COALESCE(item->>'unit', 'عدد')
      );
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- اعطای دسترسی اجرای تابع به کاربران احراز هویت‌شده
GRANT EXECUTE ON FUNCTION public.create_order_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB, TEXT) TO authenticated, anon;


-- ب) کوئری اصلاح و به‌روزرسانی جمع کل فاکتورهای قبلی در دیتابیس (با احتساب ضریب کارتن)
UPDATE public.orders o
SET total_amount = sub.calculated_total
FROM (
  SELECT 
    oi.order_id,
    ROUND(SUM(
      oi.quantity * 
      COALESCE(NULLIF(oi.items_per_package, 0), NULLIF(p.items_per_package, 0), 1) * 
      CASE 
        WHEN (o2.order_channel = 'visitor_field' OR o2.order_source = 'visitor' OR (o2.assigned_visitor_id IS NOT NULL AND o2.assigned_visitor_id != 'direct'))
             AND p.visitor_price IS NOT NULL AND p.visitor_price > 0 
        THEN p.visitor_price
        ELSE oi.price
      END
    )) AS calculated_total
  FROM public.order_items oi
  JOIN public.orders o2 ON o2.id = oi.order_id
  LEFT JOIN public.products p ON p.id = oi.product_id
  GROUP BY oi.order_id, o2.order_channel, o2.order_source, o2.assigned_visitor_id
) sub
WHERE o.id = sub.order_id
  AND (o.total_amount IS NULL OR o.total_amount != sub.calculated_total);
