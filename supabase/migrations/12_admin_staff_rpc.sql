-- =========================================================================
-- Migration: 12_admin_staff_rpc.sql
-- Description: توابع مستقیم دیتابیسی (RPC) برای مدیریت پرسنل بدون نیاز اجباری به Edge Functions
-- با این دستورات، مدیر می‌تواند بدون درگیر شدن با خط فرمان و داکر، مستقیماً
-- ویزیتور و انباردار جدید تعریف کند یا رمز آنها را تغییر دهد.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ۱. تابع ساخت پرسنل جدید (ویزیتور / انباردار)
CREATE OR REPLACE FUNCTION public.admin_create_staff(
  p_name TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_region TEXT DEFAULT 'مرکز استان',
  p_password TEXT DEFAULT '123456'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_clean_phone TEXT;
  v_clean_name TEXT;
  v_clean_region TEXT;
  v_new_id UUID;
  v_email TEXT;
  v_encrypted_pw TEXT;
BEGIN
  -- بررسی نقش کاربر فراخواننده (فقط ادمین)
  v_caller_role := public.app_role();
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'دسترسی غیرمجاز: تنها مدیر سیستم مجاز به ایجاد حساب پرسنل است.');
  END IF;

  v_clean_name := trim(COALESCE(p_name, ''));
  v_clean_phone := trim(COALESCE(p_phone, ''));
  v_clean_region := trim(COALESCE(p_region, 'مرکز استان'));

  IF v_clean_name = '' OR v_clean_phone = '' OR p_password = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'تکمیل تمامی فیلدهای نام، شماره همراه و رمز عبور الزامی است.');
  END IF;

  -- بررسی تکراری نبودن شماره در جدول profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = v_clean_phone) THEN
    RETURN jsonb_build_object('success', false, 'error', 'این شماره تماس قبلاً در سیستم ثبت شده است.');
  END IF;

  v_new_id := gen_random_uuid();
  v_email := v_clean_phone || '@babolpakhsh.internal';
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- ۱. درج یا بروزرسانی در auth.users جهت فعال‌سازی لاگین واقعی سوپابیس
  BEGIN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_new_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', v_clean_name, 'phone', v_clean_phone),
      NOW(),
      NOW()
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_new_id FROM auth.users WHERE email = v_email LIMIT 1;
    UPDATE auth.users 
    SET encrypted_password = v_encrypted_pw, updated_at = NOW() 
    WHERE id = v_new_id;
  END;

  -- ۲. درج در جدول profiles
  INSERT INTO public.profiles (
    id,
    name,
    role,
    phone,
    username,
    is_active
  ) VALUES (
    v_new_id::text,
    v_clean_name,
    p_role,
    v_clean_phone,
    v_clean_phone,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    username = EXCLUDED.username,
    is_active = TRUE;

  -- ۳. اگر نقش ویزیتور است، درج در جدول visitors
  IF p_role = 'visitor' THEN
    INSERT INTO public.visitors (
      id,
      name,
      phone,
      region,
      username,
      is_active
    ) VALUES (
      v_new_id::text,
      v_clean_name,
      v_clean_phone,
      v_clean_region,
      v_clean_phone,
      TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      region = EXCLUDED.region,
      username = EXCLUDED.username,
      is_active = TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'userId', v_new_id::text,
    'username', v_clean_phone,
    'role', p_role,
    'message', 'حساب کاربری پرسنل با موفقیت ایجاد شد.'
  );
END;
$$;

-- اعطای مجوز اجرا به کاربران احراز هویت شده
REVOKE EXECUTE ON FUNCTION public.admin_create_staff(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_staff(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
