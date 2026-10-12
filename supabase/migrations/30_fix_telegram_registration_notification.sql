-- =========================================================================
-- Migration: 30_fix_telegram_registration_notification.sql
-- شرح جامع:
-- ۱. اصلاح تابع ثبت‌نام مستقیم از وب‌سایت (register_my_store) جهت درج خودکار registration_source = 'website_direct'
-- ۲. ایجاد یا اصلاح تریگر ارسال خودکار پیام به ادمین در تلگرام و ایتا (با رفع خطای parse_mode تلگرام)
-- ۳. جلوگیری از خطای کاراکترهای خاص Markdown در تلگرام با استفاده از parse_mode: 'HTML'
-- ۴. ایجاد تابع تست ارتباط با ربات‌ها (test_admin_notifications) جهت اعتبارسنجی آنی
-- =========================================================================

-- ۱. اطمینان از وجود اکستنشن pg_net جهت ارسال درخواست‌های HTTP پس‌زمینه در سوپابیس
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ۲. اطمینان از وجود ستون‌های وضعیت و مبدأ ثبت‌نام در جدول supermarkets
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'website_direct';
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

-- ۳. ارتقای تابع ثبت‌نام مستقیم فروشگاه (register_my_store) با درج دقیق registration_source
CREATE OR REPLACE FUNCTION public.register_my_store(
  p_name TEXT,
  p_owner TEXT DEFAULT '',
  p_address TEXT DEFAULT '',
  p_visitor_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
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
  -- ۱. بررسی احراز هویت
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'احراز هویت انجام نشده است. دسترسی غیرمجاز.';
  END IF;

  -- ۲. بررسی عدم وجود پروفایل قبلی
  SELECT id INTO v_existing_profile_id
  FROM public.profiles
  WHERE id = v_user_id::text;

  IF v_existing_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'پروفایل این کاربر قبلاً ثبت شده است.';
  END IF;

  -- ۳. استخراج شماره همراه از ایمیل
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

  -- ۴. بررسی یکتایی شماره همراه
  SELECT id INTO v_dup_phone_profile_id
  FROM public.profiles
  WHERE phone = v_phone
  LIMIT 1;

  IF v_dup_phone_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'این شماره قبلاً ثبت شده است.';
  END IF;

  -- ۵. اعتبارسنجی ویزیتور در صورت ارسال
  IF p_visitor_id IS NOT NULL AND p_visitor_id <> '' AND p_visitor_id <> 'direct' THEN
    SELECT id INTO v_valid_visitor_id
    FROM public.visitors
    WHERE id = p_visitor_id AND (is_active IS NULL OR is_active = TRUE)
    LIMIT 1;
  END IF;

  v_clean_name := trim(p_name);
  v_clean_owner := COALESCE(trim(p_owner), '');
  v_clean_address := COALESCE(trim(p_address), '');

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'نام فروشگاه الزامی است.';
  END IF;

  -- ۶. درج پروفایل کاربر
  INSERT INTO public.profiles (
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

  -- ۷. درج فروشگاه با تعیین صریح مبدأ ثبت‌نام و وضعیت اولیه
  INSERT INTO public.supermarkets (
    id,
    name,
    owner,
    phone,
    address,
    assigned_visitor_id,
    is_active,
    username,
    registration_source,
    approval_status
  ) VALUES (
    v_user_id::text,
    v_clean_name,
    v_clean_owner,
    v_phone,
    v_clean_address,
    v_valid_visitor_id,
    TRUE,
    v_phone,
    'website_direct',
    'pending'
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
    'is_active', true,
    'registration_source', 'website_direct'
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_my_store(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;

-- ۴. تابع تریگر هوشمند و بدون نقص برای ارسال پیام ثبت‌نام به تلگرام و ایتا
-- علت اصلی نرسیدن پیام تلگرام در ثبت‌نام مستقیم:
-- الف) استفاده از parse_mode='Markdown' یا 'MarkdownV2' در تلگرام، که کاراکترهای '-' یا '.' در تلفن و آدرس پیام را رد می‌کند.
-- ب) وجود شرط اشتباه (مثلاً بررسی telegram_id که فقط هنگام ثبت‌نام از داخل مینی‌اپ وجود دارد).
CREATE OR REPLACE FUNCTION public.fn_notify_admin_on_store_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tg_token TEXT;
  v_tg_chat_id TEXT;
  v_eitaa_token TEXT;
  v_eitaa_chat_id TEXT;
  v_tg_text TEXT;
  v_eitaa_text TEXT;
  v_source_label TEXT;
  v_settings JSONB;
BEGIN
  -- ۱. استخراج اطلاعات ربات‌ها از تنظیمات جدول app_settings
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'bot_notifications';
  
  IF v_settings IS NOT NULL THEN
    v_tg_token := v_settings->>'telegram_bot_token';
    v_tg_chat_id := v_settings->>'telegram_admin_chat_id';
    v_eitaa_token := COALESCE(v_settings->>'eitaa_bot_token', v_settings->>'eitaayar_token');
    v_eitaa_chat_id := v_settings->>'eitaa_admin_chat_id';
  END IF;

  -- بررسی مقادیر کلیدهای تکی به عنوان پشتیبان
  IF v_tg_token IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_tg_token FROM public.app_settings WHERE key = 'telegram_bot_token';
  END IF;
  IF v_tg_chat_id IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_tg_chat_id FROM public.app_settings WHERE key = 'telegram_admin_chat_id';
  END IF;
  IF v_eitaa_token IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_eitaa_token FROM public.app_settings WHERE key IN ('eitaa_bot_token', 'eitaayar_token') LIMIT 1;
  END IF;
  IF v_eitaa_chat_id IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_eitaa_chat_id FROM public.app_settings WHERE key = 'eitaa_admin_chat_id';
  END IF;

  -- تعیین برچسب مبدأ ثبت‌نام
  v_source_label := CASE 
    WHEN NEW.registration_source = 'telegram' THEN 'ربات تلگرام'
    WHEN NEW.registration_source = 'eitaa' THEN 'پیام‌رسان ایتا'
    ELSE 'مستقیم از وب‌سایت'
  END;

  -- متن پیام فرمت‌شده برای تلگرام (با HTML جهت جلوگیری از خطای کاراکترهای رزرو شده)
  v_tg_text := '🛒 <b>ثبت‌نام فروشگاه جدید در سامانه پخش فرهودی</b>' || chr(10) || chr(10) ||
               '🏪 <b>نام فروشگاه:</b> ' || COALESCE(NEW.name, 'بدون نام') || chr(10) ||
               '👤 <b>مدیر / صاحب فروشگاه:</b> ' || COALESCE(NEW.owner, 'ثبت نشده') || chr(10) ||
               '📞 <b>شماره همراه:</b> <code>' || COALESCE(NEW.phone, 'بدون شماره') || '</code>' || chr(10) ||
               '📍 <b>آدرس:</b> ' || COALESCE(NEW.address, 'ثبت نشده') || chr(10) ||
               '🌐 <b>مبدأ ثبت‌نام:</b> ' || v_source_label || chr(10) ||
               '⏰ <b>زمان ثبت:</b> ' || to_char(NOW() AT TIME ZONE 'Asia/Tehran', 'YYYY/MM/DD - HH24:MI');

  -- متن پیام برای ایتا
  v_eitaa_text := '🛒 ثبت‌نام فروشگاه جدید در سامانه پخش فرهودی' || chr(10) || chr(10) ||
                 '🏪 نام فروشگاه: ' || COALESCE(NEW.name, 'بدون نام') || chr(10) ||
                 '👤 مدیر / صاحب فروشگاه: ' || COALESCE(NEW.owner, 'ثبت نشده') || chr(10) ||
                 '📞 شماره همراه: ' || COALESCE(NEW.phone, 'بدون شماره') || chr(10) ||
                 '📍 آدرس: ' || COALESCE(NEW.address, 'ثبت نشده') || chr(10) ||
                 '🌐 مبدأ ثبت‌نام: ' || v_source_label || chr(10) ||
                 '⏰ زمان: ' || to_char(NOW() AT TIME ZONE 'Asia/Tehran', 'YYYY/MM/DD - HH24:MI');

  -- الف) ارسال به تلگرام ادمین (بدون هیچ شرطی روی تلگرام بودن کاربر!)
  IF v_tg_token IS NOT NULL AND v_tg_token <> '' AND v_tg_chat_id IS NOT NULL AND v_tg_chat_id <> '' THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://api.telegram.org/bot' || v_tg_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', v_tg_chat_id,
          'text', v_tg_text,
          'parse_mode', 'HTML'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'خطا در ارسال نوتیفیکیشن ثبت‌نام به تلگرام: %', SQLERRM;
    END;
  END IF;

  -- ب) ارسال به ایتا ادمین
  IF v_eitaa_token IS NOT NULL AND v_eitaa_token <> '' AND v_eitaa_chat_id IS NOT NULL AND v_eitaa_chat_id <> '' THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://eitaayar.ir/api/' || v_eitaa_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', v_eitaa_chat_id,
          'text', v_eitaa_text
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'خطا در ارسال نوتیفیکیشن ثبت‌نام به ایتا: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ۵. اتصال تریگر به جدول supermarkets
DROP TRIGGER IF EXISTS trg_notify_admin_on_store_insert ON public.supermarkets;
CREATE TRIGGER trg_notify_admin_on_store_insert
  AFTER INSERT ON public.supermarkets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_admin_on_store_insert();

-- ۶. تابع تست ارسال نوتیفیکیشن جهت اطمینان از سلامت اتصال به تلگرام و ایتا
CREATE OR REPLACE FUNCTION public.test_admin_notifications(
  p_custom_message TEXT DEFAULT 'تست اتصال سیستم اطلاع‌رسانی ربات‌های پخش فرهودی'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tg_token TEXT;
  v_tg_chat_id TEXT;
  v_eitaa_token TEXT;
  v_eitaa_chat_id TEXT;
  v_settings JSONB;
BEGIN
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'bot_notifications';
  
  IF v_settings IS NOT NULL THEN
    v_tg_token := v_settings->>'telegram_bot_token';
    v_tg_chat_id := v_settings->>'telegram_admin_chat_id';
    v_eitaa_token := COALESCE(v_settings->>'eitaa_bot_token', v_settings->>'eitaayar_token');
    v_eitaa_chat_id := v_settings->>'eitaa_admin_chat_id';
  END IF;

  IF v_tg_token IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_tg_token FROM public.app_settings WHERE key = 'telegram_bot_token';
  END IF;
  IF v_tg_chat_id IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_tg_chat_id FROM public.app_settings WHERE key = 'telegram_admin_chat_id';
  END IF;
  IF v_eitaa_token IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_eitaa_token FROM public.app_settings WHERE key IN ('eitaa_bot_token', 'eitaayar_token') LIMIT 1;
  END IF;
  IF v_eitaa_chat_id IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_eitaa_chat_id FROM public.app_settings WHERE key = 'eitaa_admin_chat_id';
  END IF;

  IF v_tg_token IS NOT NULL AND v_tg_chat_id IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://api.telegram.org/bot' || v_tg_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', v_tg_chat_id,
        'text', '🔔 <b>پیام آزمایشی تلگرام:</b> ' || p_custom_message,
        'parse_mode', 'HTML'
      )
    );
  END IF;

  IF v_eitaa_token IS NOT NULL AND v_eitaa_chat_id IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://eitaayar.ir/api/' || v_eitaa_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', v_eitaa_chat_id,
        'text', '🔔 پیام آزمایشی ایتا: ' || p_custom_message
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'درخواست تست به هر دو پیام‌رسان ارسال شد.',
    'telegram_configured', (v_tg_token IS NOT NULL AND v_tg_chat_id IS NOT NULL),
    'eitaa_configured', (v_eitaa_token IS NOT NULL AND v_eitaa_chat_id IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_admin_notifications(TEXT) TO authenticated, anon;
