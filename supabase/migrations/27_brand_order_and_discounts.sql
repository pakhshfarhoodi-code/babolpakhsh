-- =========================================================================
-- Migration: 27_brand_order_and_discounts.sql
-- Description:
-- 1. پشتیبانی از ذخیره ترتیب اولویت برندها در کاتالوگ فروشگاه (catalog_brand_order)
-- 2. تابع‌های امنیتی (RPC) برای تنظیمات فاکتور و تخفیف‌ها
-- 3. اطمینان از وجود ستون‌های تخفیف ۵٪ ۱۰۰ نفر اول (founder discount) و تخفیف درب انبار (pickup discount)
-- =========================================================================

-- ۱. اطمینان از وجود جدول app_settings و دسترسی خواندن برای همه
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- دسترسی خواندن عمومی/احراز هویت شده برای کاتالوگ فروشگاه و فاکتور
DROP POLICY IF EXISTS "Public and authenticated read app_settings" ON public.app_settings;
CREATE POLICY "Public and authenticated read app_settings"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- دسترسی نوشتن ادمین در app_settings (با کست صریح ::text برای رفع خطای text = uuid)
DROP POLICY IF EXISTS "Admin write app_settings" ON public.app_settings;
CREATE POLICY "Admin write app_settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() ->> 'role')) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id::text = auth.uid()::text AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() ->> 'role')) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id::text = auth.uid()::text AND profiles.role = 'admin'
    )
  );

-- ۲. افزودن ستون‌های تخفیف به جدول supermarkets (در صورت عدم وجود)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supermarkets' AND column_name = 'founder_discount_enabled'
  ) THEN
    ALTER TABLE public.supermarkets ADD COLUMN founder_discount_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supermarkets' AND column_name = 'founder_discount_percent'
  ) THEN
    ALTER TABLE public.supermarkets ADD COLUMN founder_discount_percent numeric DEFAULT 5;
  END IF;
END $$;

-- ۳. افزودن ستون‌های تخفیف به جدول orders (در صورت عدم وجود)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'pickup_discount_percent'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN pickup_discount_percent numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'founder_discount_percent'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN founder_discount_percent numeric DEFAULT 0;
  END IF;
END $$;

-- ۴. تابع RPC برای ذخیره ترتیب برندهای کاتالوگ فروشگاه توسط ادمین
CREATE OR REPLACE FUNCTION public.set_catalog_brand_order(p_brands jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('catalog_brand_order', p_brands, now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

  RETURN jsonb_build_object('success', true, 'message', 'ترتیب برندها با موفقیت در سیستم ذخیره شد.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_catalog_brand_order(jsonb) TO authenticated, anon;

-- ۵. تابع RPC برای خواندن ترتیب برندهای کاتالوگ
CREATE OR REPLACE FUNCTION public.get_catalog_brand_order()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val jsonb;
BEGIN
  SELECT value INTO v_val FROM public.app_settings WHERE key = 'catalog_brand_order';
  RETURN COALESCE(v_val, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_catalog_brand_order() TO authenticated, anon;

-- ۶. تابع RPC برای ذخیره مشخصات و پروفایل عمومی مدیریت و مرکز پخش
CREATE OR REPLACE FUNCTION public.set_admin_profile(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('admin_profile', p_value, now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

  RETURN jsonb_build_object('success', true, 'message', 'مشخصات مدیریت و مرکز پخش با موفقیت در سیستم ذخیره شد.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_profile(jsonb) TO authenticated, anon;

-- ۷. تابع RPC برای خواندن مشخصات مدیریت و مرکز پخش
CREATE OR REPLACE FUNCTION public.get_admin_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_val jsonb;
BEGIN
  SELECT value INTO v_val FROM public.app_settings WHERE key = 'admin_profile';
  RETURN COALESCE(v_val, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_profile() TO authenticated, anon;

-- ۸. تابع RPC برای ذخیره تنظیمات فاکتور و تخفیف‌ها توسط ادمین
CREATE OR REPLACE FUNCTION public.set_invoice_settings(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('invoice_settings', p_value, now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

  RETURN jsonb_build_object('success', true, 'message', 'تنظیمات فاکتور و تخفیف‌ها با موفقیت ذخیره شد.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_invoice_settings(jsonb) TO authenticated, anon;

-- ۹. تابع RPC برای تنظیم تخفیف ۵ درصدی ۱۰۰ فروشگاه اول توسط ادمین (کست ایمن text برای id فروشگاه جهت رفع خطای text = uuid)
DROP FUNCTION IF EXISTS public.admin_set_store_founder_discount(uuid, boolean, numeric);
DROP FUNCTION IF EXISTS public.admin_set_store_founder_discount(text, boolean, numeric);

CREATE OR REPLACE FUNCTION public.admin_set_store_founder_discount(
  p_store_id text,
  p_enabled boolean,
  p_percent numeric DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  UPDATE public.supermarkets
  SET founder_discount_enabled = p_enabled,
      founder_discount_percent = COALESCE(p_percent, 5)
  WHERE id::text = p_store_id::text;

  RETURN jsonb_build_object('success', true, 'message', 'وضعیت تخفیف فروشگاه با موفقیت به‌روزرسانی شد.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_store_founder_discount(text, boolean, numeric) TO authenticated, anon;
