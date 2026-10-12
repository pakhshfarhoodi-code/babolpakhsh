-- =========================================================================
-- Migration: User Profile Edit Access & update_my_store RPC Enhancement
-- این اسکریپت دسترسی کاربر فروشگاه را برای ویرایش تمامی مشخصات پروفایل خود باز می‌کند
-- =========================================================================

-- ۱. تابع امن برای بروزرسانی تمام مشخصات فروشگاه توسط خود کاربر یا سیستم
CREATE OR REPLACE FUNCTION public.update_my_store(
  p_name TEXT,
  p_owner TEXT,
  p_address TEXT,
  p_phone TEXT,
  p_store_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_target_id TEXT;
  v_clean_name TEXT;
  v_clean_owner TEXT;
  v_clean_address TEXT;
  v_clean_phone TEXT;
BEGIN
  -- تعیین شناسه فروشگاه مورد ویرایش
  v_target_id := COALESCE(p_store_id, public.app_uid(), auth.uid()::text);
  
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'شناسه فروشگاه نامشخص است.';
  END IF;

  v_clean_name := trim(COALESCE(p_name, ''));
  v_clean_owner := trim(COALESCE(p_owner, ''));
  v_clean_address := trim(COALESCE(p_address, ''));
  v_clean_phone := trim(COALESCE(p_phone, ''));

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'نام فروشگاه الزامی است.';
  END IF;

  -- بروزرسانی جدول فروشگاه‌ها
  UPDATE public.supermarkets
  SET name = v_clean_name,
      owner = CASE WHEN v_clean_owner <> '' THEN v_clean_owner ELSE owner END,
      address = CASE WHEN v_clean_address <> '' THEN v_clean_address ELSE address END,
      phone = CASE WHEN v_clean_phone <> '' THEN v_clean_phone ELSE phone END,
      updated_at = NOW()
  WHERE id = v_target_id;

  -- بروزرسانی جدول پروفایل‌ها جهت همگام‌سازی نام و شماره تماس
  UPDATE public.profiles
  SET name = v_clean_name,
      phone = CASE WHEN v_clean_phone <> '' THEN v_clean_phone ELSE phone END,
      updated_at = NOW()
  WHERE id = v_target_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'مشخصات فروشگاه با موفقیت بروزرسانی شد.'
  );
END;
$$;

-- ۲. اعطای دسترسی به کاربران احراز هویت شده
GRANT EXECUTE ON FUNCTION public.update_my_store(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;

-- ۳. تنظیم دسترسی RLS برای امکان ویرایش رکورد فروشگاه
DROP POLICY IF EXISTS "supermarkets_update_policy" ON public.supermarkets;
CREATE POLICY "supermarkets_update_policy" ON public.supermarkets
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
