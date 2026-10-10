-- =========================================================================
-- Migration: 28_registered_stores_count.sql
-- Description:
-- ایجاد تابع امن (RPC) جهت شمارش دقیق و بدون واسطه تعداد کل فروشگاه‌های ثبت‌نام شده
-- قابل فراخوانی برای کاربران مهمان (anon) در صفحه لاگین و کاربران لاگین شده
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_registered_stores_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::integer FROM public.supermarkets;
$$;

-- اعطای مجوز اجرای تابع به کاربران ناشناس (صفحه ورود) و کاربران احراز هویت شده
GRANT EXECUTE ON FUNCTION public.get_registered_stores_count() TO anon, authenticated;
COMMENT ON FUNCTION public.get_registered_stores_count() IS 'شمارش تعداد کل فروشگاه‌های ثبت‌نام شده برای بنر تخفیف ۱۰۰ نفر اول';
