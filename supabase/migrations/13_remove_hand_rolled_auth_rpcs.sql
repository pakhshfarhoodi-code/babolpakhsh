-- =========================================================================
-- Migration: 13_remove_hand_rolled_auth_rpcs.sql
-- Description: حذف توابع RPC دستی احراز هویت به نفع Edge Function استاندارد
-- =========================================================================

-- بلوک ۱: حذف توابع دستی ساخت پرسنل و بازنشانی رمز عبور
DROP FUNCTION IF EXISTS public.admin_create_staff(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_create_staff(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_create_staff(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_reset_user_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_reset_user_password(TEXT);

-- کوئری بررسی موفقیت پس از اجرای بلوک ۱
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('admin_create_staff', 'admin_reset_user_password');
