-- =========================================================================
-- Migration: 10_auth_hardening.sql
-- Description: Real Supabase Auth hardening, is_active column, and
--              SECURITY DEFINER RPC for public store self-registration.
-- =========================================================================

-- 1. Ensure profiles.is_active column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. register_my_store RPC function
-- Creates profile with fixed 'supermarket' role and supermarkets row using auth.uid()
CREATE OR REPLACE FUNCTION register_my_store(
  p_name TEXT,
  p_owner TEXT DEFAULT '',
  p_address TEXT DEFAULT '',
  p_visitor_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_phone TEXT;
  v_existing_profile_id TEXT;
  v_dup_phone_profile_id TEXT;
  v_valid_visitor_id TEXT := NULL;
  v_clean_name TEXT;
  v_clean_owner TEXT;
  v_clean_address TEXT;
  v_result JSONB;
BEGIN
  -- 1. Ensure caller is authenticated via Supabase Auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'احراز هویت انجام نشده است. دسترسی غیرمجاز.';
  END IF;

  -- 2. Verify no profile exists yet for this auth.uid()
  SELECT id INTO v_existing_profile_id
  FROM profiles
  WHERE id = v_user_id::text;

  IF v_existing_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'پروفایل این کاربر قبلاً ثبت شده است.';
  END IF;

  -- 3. Read email from auth.users (phone is synthesized into email: {phone}@babolpakhsh.internal)
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'ایمیل کاربر در سیستم احراز هویت یافت نشد.';
  END IF;

  v_phone := split_part(v_email, '@', 1);
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RAISE EXCEPTION 'شماره همراه در اطلاعات حساب کاربری نامعتبر است.';
  END IF;

  -- 4. Check uniqueness of phone in profiles table
  SELECT id INTO v_dup_phone_profile_id
  FROM profiles
  WHERE phone = v_phone
  LIMIT 1;

  IF v_dup_phone_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'این شماره قبلاً ثبت شده است.';
  END IF;

  -- 5. Validate p_visitor_id if provided
  IF p_visitor_id IS NOT NULL AND p_visitor_id <> '' AND p_visitor_id <> 'direct' THEN
    SELECT id INTO v_valid_visitor_id
    FROM visitors
    WHERE id = p_visitor_id AND (is_active IS NULL OR is_active = TRUE)
    LIMIT 1;
  END IF;

  v_clean_name := trim(p_name);
  v_clean_owner := COALESCE(trim(p_owner), '');
  v_clean_address := COALESCE(trim(p_address), '');

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'نام فروشگاه الزامی است.';
  END IF;

  -- 6. Insert profile with fixed role 'supermarket' (never user_metadata)
  INSERT INTO profiles (
    id,
    name,
    role,
    phone,
    username,
    is_active
  ) VALUES (
    v_user_id::text,
    v_clean_name,
    'supermarket',
    v_phone,
    v_phone,
    TRUE
  );

  -- 7. Insert into supermarkets
  INSERT INTO supermarkets (
    id,
    name,
    owner,
    phone,
    address,
    assigned_visitor_id,
    is_active,
    username
  ) VALUES (
    v_user_id::text,
    v_clean_name,
    v_clean_owner,
    v_phone,
    v_clean_address,
    v_valid_visitor_id,
    TRUE,
    v_phone
  );

  v_result := jsonb_build_object(
    'success', true,
    'id', v_user_id::text,
    'name', v_clean_name,
    'owner', v_clean_owner,
    'phone', v_phone,
    'address', v_clean_address,
    'assigned_visitor_id', COALESCE(v_valid_visitor_id, 'direct'),
    'username', v_phone,
    'is_active', true
  );

  RETURN v_result;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION register_my_store(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =========================================================================
-- بخش (ج) - آخر از همه، بعد از تست و اطمینان کامل از انتقال به Supabase Auth:
-- =========================================================================
-- UPDATE profiles SET password = NULL;
-- UPDATE visitors SET password = NULL;
-- UPDATE supermarkets SET password = NULL;
-- 
-- ALTER TABLE profiles DROP COLUMN IF EXISTS password;
-- ALTER TABLE visitors DROP COLUMN IF EXISTS password;
-- ALTER TABLE supermarkets DROP COLUMN IF EXISTS password;
