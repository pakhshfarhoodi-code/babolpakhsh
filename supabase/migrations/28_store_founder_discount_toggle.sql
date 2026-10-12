-- =========================================================================
-- Migration: Store Founder Discount Toggle
-- فعال/غیرفعال‌سازی تخفیف ۵٪ ویژه ۱۰۰ فروشگاه اول توسط خود کاربر فروشگاه
-- =========================================================================

-- ۱. اطمینان از وجود ستون founder_discount_enabled با مقدار پیش‌فرض true
ALTER TABLE public.supermarkets 
ADD COLUMN IF NOT EXISTS founder_discount_enabled BOOLEAN DEFAULT true;

-- بروزرسانی رکوردهایی که مقدار ستون آن‌ها ممکن است NULL باشد
UPDATE public.supermarkets 
SET founder_discount_enabled = true 
WHERE founder_discount_enabled IS NULL;

-- ۲. ایجاد تابع امن برای تغییر وضعیت تخفیف توسط فروشگاه در هر زمان
CREATE OR REPLACE FUNCTION public.toggle_store_founder_discount(
  p_store_id text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  UPDATE public.supermarkets
  SET founder_discount_enabled = p_enabled
  WHERE id::text = p_store_id::text;

  RETURN jsonb_build_object(
    'success', true, 
    'store_id', p_store_id, 
    'founder_discount_enabled', p_enabled,
    'message', CASE 
      WHEN p_enabled THEN 'تخفیف ۵٪ ۱۰۰ فروشگاه اول فعال شد.' 
      ELSE 'تخفیف ۵٪ برای این سفارش غیرفعال شد و سهمیه آن برای سفارش‌های آینده حفظ می‌گردد.' 
    END
  );
END;
$$;

-- ۳. اعطای دسترسی اجرای تابع
GRANT EXECUTE ON FUNCTION public.toggle_store_founder_discount(text, boolean) TO authenticated, anon;
