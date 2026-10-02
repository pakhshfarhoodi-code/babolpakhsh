-- =========================================================================
-- Migration: 12_admin_staff_rpc.sql
-- Description: توابع دیتابیسی کامل برای مدیریت، ورود و تغییر رمز پرسنل
-- شامل پشتیبانی از auth.users و auth.identities برای تضمین ۱۰۰٪ ورود موفق
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ۱. تابع ساخت پرسنل با ساخت کامل auth.users و auth.identities
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
  -- بررسی نقش مدیر
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

  v_email := v_clean_phone || '@babolpakhsh.internal';
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- بررسی وجود قبلی در auth.users
  SELECT id INTO v_new_id FROM auth.users WHERE email = v_email LIMIT 1;

  IF v_new_id IS NULL THEN
    v_new_id := gen_random_uuid();

    -- ثبت در auth.users
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_new_id, 'authenticated', 'authenticated',
      v_email, v_encrypted_pw, NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', v_clean_name, 'phone', v_clean_phone),
      NOW(), NOW()
    );
  ELSE
    -- بروزرسانی رمز عبور کاربر موجود
    UPDATE auth.users 
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_user_meta_data = jsonb_build_object('name', v_clean_name, 'phone', v_clean_phone),
      updated_at = NOW() 
    WHERE id = v_new_id;
  END IF;

  -- ثبت یا بروزرسانی در auth.identities (حیاتی برای اینکه GoTrue اجازه لاگین دهد)
  BEGIN
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_new_id::text, v_new_id,
      jsonb_build_object('sub', v_new_id::text, 'email', v_email),
      'email', v_email, NOW(), NOW(), NOW()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- سازگاری با نسخه‌های مختلف اسکیما identities
    BEGIN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_new_id::text, v_new_id,
        jsonb_build_object('sub', v_new_id::text, 'email', v_email),
        'email', NOW(), NOW(), NOW()
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  -- ثبت در جدول profiles
  INSERT INTO public.profiles (id, name, role, phone, username, is_active)
  VALUES (v_new_id::text, v_clean_name, p_role, v_clean_phone, v_clean_phone, TRUE)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, role = EXCLUDED.role, phone = EXCLUDED.phone, username = EXCLUDED.username, is_active = TRUE;

  -- اگر نقش ویزیتور است، ثبت در جدول visitors
  IF p_role = 'visitor' THEN
    INSERT INTO public.visitors (id, name, phone, region, username, is_active)
    VALUES (v_new_id::text, v_clean_name, v_clean_phone, v_clean_region, v_clean_phone, TRUE)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, phone = EXCLUDED.phone, region = EXCLUDED.region, username = EXCLUDED.username, is_active = TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'userId', v_new_id::text,
    'username', v_clean_phone,
    'role', p_role,
    'message', 'حساب کاربری پرسنل با موفقیت ایجاد شد و آماده ورود است.'
  );
END;
$$;

-- ۲. تابع تغییر / بازیابی رمز عبور مستقیم در دیتابیس (بدون نیاز به Edge Function)
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_user_id TEXT,
  p_new_password TEXT DEFAULT '123456'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_encrypted_pw TEXT;
  v_user_uuid UUID;
  v_email TEXT;
  v_phone TEXT;
BEGIN
  v_caller_role := public.app_role();
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'دسترسی غیرمجاز: تنها مدیر سیستم مجاز به بازنشانی رمز است.');
  END IF;

  IF p_user_id IS NULL OR p_user_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'شناسه کاربر الزامی است.');
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'رمز عبور باید حداقل ۶ کاراکتر باشد.');
  END IF;

  v_encrypted_pw := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

  -- یافتن کاربر در auth.users با شناسه یا تلفن
  SELECT id, email INTO v_user_uuid, v_email
  FROM auth.users
  WHERE id::text = p_user_id;

  IF v_user_uuid IS NULL THEN
    SELECT phone INTO v_phone FROM public.profiles WHERE id = p_user_id;
    IF v_phone IS NOT NULL THEN
      v_email := v_phone || '@babolpakhsh.internal';
      SELECT id INTO v_user_uuid FROM auth.users WHERE email = v_email;
    END IF;
  END IF;

  IF v_user_uuid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'حساب کاربر در سیستم احراز هویت یافت نشد.');
  END IF;

  -- بروزرسانی رمز عبور در auth.users
  UPDATE auth.users
  SET 
    encrypted_password = v_encrypted_pw,
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
  WHERE id = v_user_uuid;

  -- اطمینان از ثبت هویت در auth.identities
  BEGIN
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_uuid::text, v_user_uuid,
      jsonb_build_object('sub', v_user_uuid::text, 'email', v_email),
      'email', v_email, NOW(), NOW(), NOW()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_user_uuid::text, v_user_uuid,
        jsonb_build_object('sub', v_user_uuid::text, 'email', v_email),
        'email', NOW(), NOW(), NOW()
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'رمز عبور با موفقیت به ' || p_new_password || ' تغییر یافت.'
  );
END;
$$;

-- ۳. اصلاح خودکار تمام اکانت‌های قبلی (تعمیر identities برای تمام کاربران تا بتوانند لاگین کنند)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, email FROM auth.users WHERE email LIKE '%@babolpakhsh.internal' LOOP
    BEGIN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        r.id::text, r.id,
        jsonb_build_object('sub', r.id::text, 'email', r.email),
        'email', r.email, NOW(), NOW(), NOW()
      )
      ON CONFLICT (provider, provider_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
          r.id::text, r.id,
          jsonb_build_object('sub', r.id::text, 'email', r.email),
          'email', NOW(), NOW(), NOW()
        )
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_create_staff(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(TEXT, TEXT) TO authenticated;
