-- =========================================================================
-- Migration: 24_fix_store_approval_and_order_status.sql
-- شرح:
-- ۱. رفع خطای operator does not exist: text = uuid در تایید یا رد حساب کاربری فروشگاه‌ها
-- ۲. اصلاح تابع admin_set_store_approval با تبدیل صریح auth.uid()::text و p_store_id::text
-- ۳. اطمینان از وجود ستون‌های وضعیت تایید و احراز در جدول supermarkets
-- ۴. مقاوم‌سازی ثبت تحویل سفارش‌ها توسط ویزیتور و اعمال فوری در سراسر سامانه
-- =========================================================================

-- ۱. اطمینان از وجود ستون‌های موردنیاز در جدول supermarkets
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS registration_source TEXT;
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS approval_note TEXT;
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS founder_discount_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS founder_discount_percent NUMERIC DEFAULT 3;

-- ایجاد ایندکس روی approval_status جهت جستجو و فیلتر سریع
CREATE INDEX IF NOT EXISTS idx_supermarkets_approval_status ON public.supermarkets(approval_status);

-- ۲. حذف تابع قبلی در صورت وجود برای جلوگیری از خطای تغییر نوع بازگشتی (42P13)
DROP FUNCTION IF EXISTS public.admin_set_store_approval(TEXT, TEXT, TEXT);

-- تابع امن و استاندارد تایید / رد حساب کاربری فروشگاه توسط ادمین
-- حل ریشه‌ای خطای operator does not exist: text = uuid با کست کردن صریح ::text
CREATE OR REPLACE FUNCTION public.admin_set_store_approval(
  p_store_id TEXT,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_store_name TEXT;
BEGIN
  -- احراز نقش کاربر جاری با تبدیل نوع ایمن auth.uid()::text به text
  SELECT role, name INTO v_caller_role, v_caller_name
  FROM public.profiles
  WHERE id = auth.uid()::text;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'تنها مدیران سیستم مجاز به تایید یا رد حساب‌های کاربری هستند.'
    );
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'وضعیت تایید ارسالی نامعتبر است (باید approved یا rejected باشد).'
    );
  END IF;

  -- بررسی وجود فروشگاه با مقایسه رشته‌ای
  SELECT name INTO v_store_name
  FROM public.supermarkets
  WHERE id = p_store_id::text;

  IF v_store_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'فروشگاه مورد نظر در پایگاه داده یافت نشد.'
    );
  END IF;

  -- به‌روزرسانی جدول supermarkets
  UPDATE public.supermarkets
  SET 
    approval_status = p_status,
    is_active = (p_status = 'approved'),
    approved_at = CASE WHEN p_status = 'approved' THEN NOW() ELSE approved_at END,
    approved_by = CASE WHEN p_status = 'approved' THEN COALESCE(v_caller_name, 'مدیر سیستم') ELSE approved_by END,
    approval_note = CASE WHEN p_status = 'rejected' THEN p_note ELSE NULL END
  WHERE id = p_store_id::text;

  -- به‌روزرسانی وضعیت فعال بودن در جدول profiles جهت امکان ورود
  UPDATE public.profiles
  SET is_active = (p_status = 'approved')
  WHERE id = p_store_id::text;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_status = 'approved' THEN 'حساب کاربری فروشگاه «' || v_store_name || '» با موفقیت تایید و فعال شد.'
      ELSE 'درخواست احراز فروشگاه «' || v_store_name || '» رد شد.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_store_approval(TEXT, TEXT, TEXT) TO authenticated;

-- ۳. حذف تابع override_order_delivery قبلی برای رفع قطعی خطای 42P13: cannot change return type of existing function
DROP FUNCTION IF EXISTS public.override_order_delivery(TEXT);

-- ارتقای تابع ثبت و تایید تحویل سفارش توسط ویزیتور به SECURITY DEFINER
-- تا هنگام کلیک «تحویل شد» توسط ویزیتور، وضعیت در دیتابیس بلافاصله به delivered تبدیل شود
CREATE OR REPLACE FUNCTION public.override_order_delivery(
  p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  -- قفل کردن ردیف سفارش جهت جلوگیری از رقابت همزمانی
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id::text FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'سفارش یافت نشد.');
  END IF;

  -- اگر موجودی قبلاً کسر شده باشد، فقط وضعیت سفارش را به‌روزرسانی می‌کنیم
  IF v_order.stock_deducted = TRUE THEN
    UPDATE public.orders 
    SET status = 'delivered'
    WHERE id = p_order_id::text;
    
    RETURN jsonb_build_object('success', true, 'message', 'سفارش تحویل شد.');
  END IF;

  -- کسر فیزیکی و رزرو کالاها و ثبت تراکنش انبار
  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id::text LOOP
    UPDATE public.products
    SET stock = GREATEST(0, stock - v_item.quantity),
        reserved_stock = GREATEST(0, reserved_stock - v_item.quantity)
    WHERE id = v_item.product_id;

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
      p_order_id::text,
      NOW()
    );
  END LOOP;

  -- به‌روزرسانی نهایی سفارش
  UPDATE public.orders
  SET status = 'delivered',
      stock_deducted = TRUE
  WHERE id = p_order_id::text;

  RETURN jsonb_build_object('success', true, 'message', 'سفارش با موفقیت تحویل داده شد و موجودی انبار به‌روزرسانی گردید.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.override_order_delivery(TEXT) TO authenticated;

-- ۴. به‌روزرسانی پالیسی امنیتی جدول orders برای دسترسی تغییر وضعیت توسط ویزیتور اختصاصی
DROP POLICY IF EXISTS "orders_visitor_update_status" ON public.orders;
CREATE POLICY "orders_visitor_update_status" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.app_role() = 'admin'
    OR (public.app_role() = 'visitor' AND assigned_visitor_id = public.app_uid())
  )
  WITH CHECK (
    public.app_role() = 'admin'
    OR (public.app_role() = 'visitor' AND assigned_visitor_id = public.app_uid())
  );
