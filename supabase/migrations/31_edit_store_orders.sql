-- =========================================================================
-- Migration 31: Edit Store Orders (Admin & Visitor)
-- امکان ویرایش سفارشات ثبت‌شده توسط فروشگاه‌ها در پنل ادمین و پنل ویزیتور
-- =========================================================================

-- ۱. ایجاد تابع امن (RPC) برای ویرایش سفارشات و اقلام آن توسط ادمین و ویزیتور
CREATE OR REPLACE FUNCTION public.edit_store_order(
  p_order_id TEXT,
  p_items JSONB,
  p_total_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_order RECORD;
  v_item JSONB;
BEGIN
  -- بررسی وجود سفارش
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'سفارش مورد نظر یافت نشد.');
  END IF;

  -- سفارش‌های تحویل شده نهایی شده‌اند و قابل ویرایش نیستند
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'message', 'این سفارش قبلاً تحویل داده شده و امکان ویرایش آن وجود ندارد.');
  END IF;

  -- بررسی اختیاری سطح دسترسی براساس توکن احراز هویت (در صورت وجود)
  v_uid := public.app_uid();
  v_role := public.app_role();

  IF v_role IS NOT NULL AND v_role <> 'admin' THEN
    -- در صورتی که کاربر ویزیتور باشد، فقط سفارش‌های مربوط به خودش را می‌تواند ویرایش کند
    IF v_role = 'visitor' AND v_order.assigned_visitor_id IS DISTINCT FROM v_uid THEN
      RETURN jsonb_build_object('success', false, 'message', 'شما فقط مجاز به ویرایش سفارش‌های تخصیص‌داده‌شده به خود هستید.');
    END IF;
    -- در صورتی که کاربر فروشگاه باشد، فقط سفارش خود را می‌تواند ویرایش کند
    IF v_role = 'supermarket' AND v_order.supermarket_id IS DISTINCT FROM v_uid THEN
      RETURN jsonb_build_object('success', false, 'message', 'شما فقط مجاز به ویرایش سفارش‌های فروشگاه خود هستید.');
    END IF;
  END IF;

  -- حذف اقلام قبلی سفارش
  DELETE FROM public.order_items WHERE order_id = p_order_id;

  -- درج اقلام جدید سفارش
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      name,
      price,
      quantity,
      items_per_package,
      unit
    ) VALUES (
      p_order_id,
      (v_item->>'product_id')::TEXT,
      COALESCE((v_item->>'name')::TEXT, 'کالا'),
      COALESCE((v_item->>'price')::NUMERIC, 0),
      COALESCE((v_item->>'quantity')::NUMERIC, 1),
      COALESCE((v_item->>'items_per_package')::NUMERIC, 1),
      (v_item->>'unit')::TEXT
    );
  END LOOP;

  -- به‌روزرسانی مبلغ کل سفارش و تاریخ ویرایش
  UPDATE public.orders
  SET
    total_amount = p_total_amount,
    invoice_revised_at = NOW()
  WHERE id = p_order_id;

  -- در صورت وجود حواله بارگیری مرتبط، اقلام حواله نیز به‌روزرسانی شوند
  IF v_order.loading_bill_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.loading_bill_items WHERE order_id = p_order_id) THEN
    DELETE FROM public.loading_bill_items WHERE order_id = p_order_id;

    INSERT INTO public.loading_bill_items (
      loading_bill_id,
      order_id,
      product_id,
      product_name,
      quantity,
      original_quantity,
      store_price,
      visitor_price,
      source,
      customer_label
    )
    SELECT
      v_order.loading_bill_id,
      p_order_id,
      oi.product_id,
      oi.name,
      oi.quantity,
      oi.quantity,
      oi.price,
      COALESCE(p.visitor_price, oi.price),
      'order',
      v_order.supermarket_name
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'سفارش با موفقیت ویرایش و ذخیره شد.',
    'order_id', p_order_id,
    'total_amount', p_total_amount
  );
END;
$$;

-- اعطای مجوز فراخوانی تابع RPC
GRANT EXECUTE ON FUNCTION public.edit_store_order(TEXT, JSONB, NUMERIC) TO authenticated, anon;

-- ۲. به‌روزرسانی سیاست‌های دسترسی مستقیم (RLS) جدول orders و order_items
DROP POLICY IF EXISTS "orders_visitor_update_policy" ON public.orders;
CREATE POLICY "orders_visitor_update_policy" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.app_role() = 'admin' 
    OR (public.app_role() = 'visitor' AND assigned_visitor_id = public.app_uid())
  )
  WITH CHECK (
    public.app_role() = 'admin' 
    OR (public.app_role() = 'visitor' AND assigned_visitor_id = public.app_uid())
  );

DROP POLICY IF EXISTS "order_items_visitor_write_policy" ON public.order_items;
CREATE POLICY "order_items_visitor_write_policy" ON public.order_items
  FOR ALL TO authenticated
  USING (
    public.app_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.assigned_visitor_id = public.app_uid()
    )
  )
  WITH CHECK (
    public.app_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.assigned_visitor_id = public.app_uid()
    )
  );
