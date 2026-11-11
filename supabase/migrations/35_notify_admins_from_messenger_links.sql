-- Migration: 35_notify_admins_from_messenger_links.sql
-- اصلاح سیستم گیرندگان اعلان‌های ادمین و فروشگاه‌ها:
-- ۱. خواندن لیست گیرندگان ادمین از جداول telegram_links و eitaa_links بر اساس نقش admin/superadmin در profiles
-- ۲. در نظر گرفتن مقادیر تنظیمات قدیمی (app_settings) به عنوان پشتیبان (Fallback) و حذف مقادیر تکراری
-- ۳. اطمینان از وجود جداول telegram_links و eitaa_links و اعمال دسترسی‌ها

-- ۱. اطمینان از وجود جداول اتصال پیام‌رسان‌ها
CREATE TABLE IF NOT EXISTS public.telegram_links (
  profile_id TEXT NOT NULL PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.eitaa_links (
  profile_id TEXT NOT NULL PRIMARY KEY,
  eitaa_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_links_profile_id ON public.telegram_links(profile_id);
CREATE INDEX IF NOT EXISTS idx_eitaa_links_profile_id ON public.eitaa_links(profile_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_user_id ON public.telegram_links(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_eitaa_links_user_id ON public.eitaa_links(eitaa_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_links TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eitaa_links TO authenticated, service_role;

-- ۲. بازنویسی تابع تریگر اطلاع‌رسانی ثبت‌نام فروشگاه جدید به ادمین‌ها
CREATE OR REPLACE FUNCTION public.fn_notify_admin_on_store_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tg_token TEXT;
  v_tg_fallback_chat_id TEXT;
  v_eitaa_token TEXT;
  v_eitaa_fallback_chat_id TEXT;
  v_tg_text TEXT;
  v_eitaa_text TEXT;
  v_source_label TEXT;
  v_settings JSONB;
  v_tg_chat_ids TEXT[];
  v_eitaa_chat_ids TEXT[];
  v_chat_id TEXT;
BEGIN
  -- ۱. استخراج توکن‌های ربات‌ها از تنظیمات جدول app_settings
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'bot_notifications';
  
  IF v_settings IS NOT NULL THEN
    v_tg_token := v_settings->>'telegram_bot_token';
    v_tg_fallback_chat_id := v_settings->>'telegram_admin_chat_id';
    v_eitaa_token := COALESCE(v_settings->>'eitaa_bot_token', v_settings->>'eitaayar_token');
    v_eitaa_fallback_chat_id := v_settings->>'eitaa_admin_chat_id';
  END IF;

  -- بررسی مقادیر کلیدهای تکی به عنوان پشتیبان
  IF v_tg_token IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_tg_token FROM public.app_settings WHERE key = 'telegram_bot_token';
  END IF;
  IF v_tg_fallback_chat_id IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_tg_fallback_chat_id FROM public.app_settings WHERE key = 'telegram_admin_chat_id';
  END IF;
  IF v_eitaa_token IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_eitaa_token FROM public.app_settings WHERE key IN ('eitaa_bot_token', 'eitaayar_token') LIMIT 1;
  END IF;
  IF v_eitaa_fallback_chat_id IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_eitaa_fallback_chat_id FROM public.app_settings WHERE key = 'eitaa_admin_chat_id';
  END IF;

  -- ۲. استخراج لیست گیرندگان ادمین از telegram_links بر اساس نقش admin و superadmin
  SELECT ARRAY(
    SELECT DISTINCT chat_id FROM (
      SELECT tl.telegram_user_id::text AS chat_id
      FROM public.telegram_links tl
      JOIN public.profiles p ON p.id::text = tl.profile_id::text
      WHERE p.role IN ('admin', 'superadmin')
        AND tl.telegram_user_id IS NOT NULL
        AND tl.telegram_user_id::text <> ''
      UNION
      SELECT v_tg_fallback_chat_id AS chat_id
      WHERE v_tg_fallback_chat_id IS NOT NULL AND v_tg_fallback_chat_id <> ''
    ) t
    WHERE chat_id IS NOT NULL AND chat_id <> ''
  ) INTO v_tg_chat_ids;

  -- ۳. استخراج لیست گیرندگان ادمین از eitaa_links بر اساس نقش admin و superadmin
  SELECT ARRAY(
    SELECT DISTINCT chat_id FROM (
      SELECT el.eitaa_user_id::text AS chat_id
      FROM public.eitaa_links el
      JOIN public.profiles p ON p.id::text = el.profile_id::text
      WHERE p.role IN ('admin', 'superadmin')
        AND el.eitaa_user_id IS NOT NULL
        AND el.eitaa_user_id::text <> ''
      UNION
      SELECT v_eitaa_fallback_chat_id AS chat_id
      WHERE v_eitaa_fallback_chat_id IS NOT NULL AND v_eitaa_fallback_chat_id <> ''
    ) t
    WHERE chat_id IS NOT NULL AND chat_id <> ''
  ) INTO v_eitaa_chat_ids;

  -- تعیین برچسب مبدأ ثبت‌نام
  v_source_label := CASE 
    WHEN NEW.registration_source = 'telegram' THEN 'ربات تلگرام'
    WHEN NEW.registration_source = 'eitaa' THEN 'پیام‌رسان ایتا'
    ELSE 'مستقیم از وب‌سایت'
  END;

  -- متن پیام فرمت‌شده برای تلگرام
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

  -- ارسال به تمام ادمین‌های متصل به تلگرام
  IF v_tg_token IS NOT NULL AND v_tg_token <> '' AND array_length(v_tg_chat_ids, 1) > 0 THEN
    FOREACH v_chat_id IN ARRAY v_tg_chat_ids
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := 'https://api.telegram.org/bot' || v_tg_token || '/sendMessage',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'chat_id', v_chat_id,
            'text', v_tg_text,
            'parse_mode', 'HTML'
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'خطا در ارسال نوتیفیکیشن ثبت‌نام به تلگرام برای چت %: %', v_chat_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  -- ارسال به تمام ادمین‌های متصل به ایتا
  IF v_eitaa_token IS NOT NULL AND v_eitaa_token <> '' AND array_length(v_eitaa_chat_ids, 1) > 0 THEN
    FOREACH v_chat_id IN ARRAY v_eitaa_chat_ids
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := 'https://eitaayar.ir/api/' || v_eitaa_token || '/sendMessage',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'chat_id', v_chat_id,
            'text', v_eitaa_text
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'خطا در ارسال نوتیفیکیشن ثبت‌نام به ایتا برای چت %: %', v_chat_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- اتصال مجدد تریگر به جدول supermarkets
DROP TRIGGER IF EXISTS trg_notify_admin_on_store_insert ON public.supermarkets;
CREATE TRIGGER trg_notify_admin_on_store_insert
  AFTER INSERT ON public.supermarkets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_admin_on_store_insert();

-- ۳. به‌روزرسانی تابع تست ارسال نوتیفیکیشن ادمین‌ها
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
  v_tg_fallback_chat_id TEXT;
  v_eitaa_token TEXT;
  v_eitaa_fallback_chat_id TEXT;
  v_settings JSONB;
  v_tg_chat_ids TEXT[];
  v_eitaa_chat_ids TEXT[];
  v_chat_id TEXT;
BEGIN
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'bot_notifications';
  
  IF v_settings IS NOT NULL THEN
    v_tg_token := v_settings->>'telegram_bot_token';
    v_tg_fallback_chat_id := v_settings->>'telegram_admin_chat_id';
    v_eitaa_token := COALESCE(v_settings->>'eitaa_bot_token', v_settings->>'eitaayar_token');
    v_eitaa_fallback_chat_id := v_settings->>'eitaa_admin_chat_id';
  END IF;

  IF v_tg_token IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_tg_token FROM public.app_settings WHERE key = 'telegram_bot_token';
  END IF;
  IF v_tg_fallback_chat_id IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_tg_fallback_chat_id FROM public.app_settings WHERE key = 'telegram_admin_chat_id';
  END IF;
  IF v_eitaa_token IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_eitaa_token FROM public.app_settings WHERE key IN ('eitaa_bot_token', 'eitaayar_token') LIMIT 1;
  END IF;
  IF v_eitaa_fallback_chat_id IS NULL THEN
    SELECT trim(both '"' from value::text) INTO v_eitaa_fallback_chat_id FROM public.app_settings WHERE key = 'eitaa_admin_chat_id';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT chat_id FROM (
      SELECT tl.telegram_user_id::text AS chat_id
      FROM public.telegram_links tl
      JOIN public.profiles p ON p.id::text = tl.profile_id::text
      WHERE p.role IN ('admin', 'superadmin')
        AND tl.telegram_user_id IS NOT NULL
        AND tl.telegram_user_id::text <> ''
      UNION
      SELECT v_tg_fallback_chat_id AS chat_id
      WHERE v_tg_fallback_chat_id IS NOT NULL AND v_tg_fallback_chat_id <> ''
    ) t
    WHERE chat_id IS NOT NULL AND chat_id <> ''
  ) INTO v_tg_chat_ids;

  SELECT ARRAY(
    SELECT DISTINCT chat_id FROM (
      SELECT el.eitaa_user_id::text AS chat_id
      FROM public.eitaa_links el
      JOIN public.profiles p ON p.id::text = el.profile_id::text
      WHERE p.role IN ('admin', 'superadmin')
        AND el.eitaa_user_id IS NOT NULL
        AND el.eitaa_user_id::text <> ''
      UNION
      SELECT v_eitaa_fallback_chat_id AS chat_id
      WHERE v_eitaa_fallback_chat_id IS NOT NULL AND v_eitaa_fallback_chat_id <> ''
    ) t
    WHERE chat_id IS NOT NULL AND chat_id <> ''
  ) INTO v_eitaa_chat_ids;

  IF v_tg_token IS NOT NULL AND array_length(v_tg_chat_ids, 1) > 0 THEN
    FOREACH v_chat_id IN ARRAY v_tg_chat_ids
    LOOP
      PERFORM net.http_post(
        url := 'https://api.telegram.org/bot' || v_tg_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', v_chat_id,
          'text', '🔔 <b>پیام آزمایشی تلگرام:</b> ' || p_custom_message,
          'parse_mode', 'HTML'
        )
      );
    END LOOP;
  END IF;

  IF v_eitaa_token IS NOT NULL AND array_length(v_eitaa_chat_ids, 1) > 0 THEN
    FOREACH v_chat_id IN ARRAY v_eitaa_chat_ids
    LOOP
      PERFORM net.http_post(
        url := 'https://eitaayar.ir/api/' || v_eitaa_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', v_chat_id,
          'text', '🔔 پیام آزمایشی ایتا: ' || p_custom_message
        )
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'درخواست تست به پیام‌رسان‌ها ارسال شد.',
    'telegram_recipients_count', COALESCE(array_length(v_tg_chat_ids, 1), 0),
    'eitaa_recipients_count', COALESCE(array_length(v_eitaa_chat_ids, 1), 0),
    'telegram_configured', (v_tg_token IS NOT NULL AND array_length(v_tg_chat_ids, 1) > 0),
    'eitaa_configured', (v_eitaa_token IS NOT NULL AND array_length(v_eitaa_chat_ids, 1) > 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_admin_notifications(TEXT) TO authenticated, anon;
