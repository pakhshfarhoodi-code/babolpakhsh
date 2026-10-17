-- =========================================================================
-- Migration 33: دوره‌های کمپین تخفیف طرح آغازین (Founder Campaign Periods)
--
-- ۱. جدول founder_campaigns: هر «دوره» یک ردیف (شماره، درصد، ظرفیت، سقف سفارش، تاریخ شروع/پایان)
-- ۲. ستون founder_campaign_no روی supermarkets و orders تا مصرف تخفیف به تفکیک دوره شمرده شود
-- ۳. تریگر اعطای خودکار تخفیف به فروشگاه جدید (تا سقف ظرفیت دوره جاری)
-- ۴. توابع: get_founder_campaign / get_founder_campaign_history /
--           admin_set_founder_campaign / admin_set_store_founder_discount
--
-- نکته: این فایل نسخه‌های قبلی توابع get_founder_campaign و admin_set_founder_campaign
-- (که خارج از مخزن روی دیتابیس ساخته شده بودند) را با نسخه‌ی جدید جایگزین می‌کند.
-- =========================================================================

-- ۰. تابع کمکی تشخیص ادمین
CREATE OR REPLACE FUNCTION public._is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() ->> 'role')) = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id::text = auth.uid()::text AND profiles.role = 'admin'
      );
$$;

-- ۱. جدول دوره‌ها
CREATE TABLE IF NOT EXISTS public.founder_campaigns (
  campaign_no      integer PRIMARY KEY,
  percent          numeric NOT NULL DEFAULT 5,
  capacity         integer NOT NULL DEFAULT 100,
  orders_per_store integer NOT NULL DEFAULT 3,
  active           boolean NOT NULL DEFAULT true,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz
);
ALTER TABLE public.founder_campaigns ENABLE ROW LEVEL SECURITY;
-- بدون policy: دسترسی فقط از طریق توابع SECURITY DEFINER

-- ۲. ستون‌ها
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS founder_discount_enabled boolean DEFAULT false;
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS founder_discount_percent numeric DEFAULT 5;
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS founder_orders_limit integer DEFAULT 3;
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS founder_campaign_no integer;
ALTER TABLE public.orders       ADD COLUMN IF NOT EXISTS founder_campaign_no integer;

-- دوره ۱ (اگر هنوز هیچ دوره‌ای ثبت نشده). مقادیر را بعداً از پنل ادمین اصلاح کنید.
INSERT INTO public.founder_campaigns (campaign_no, percent, capacity, orders_per_store, active)
SELECT 1, 5, 100, 3, true
WHERE NOT EXISTS (SELECT 1 FROM public.founder_campaigns);

-- بک‌فیل: فروشگاه‌های مشمول فعلی و سفارش‌های دارای تخفیف، متعلق به دوره ۱ هستند
UPDATE public.supermarkets
   SET founder_campaign_no = 1
 WHERE founder_discount_enabled = true AND founder_campaign_no IS NULL;

UPDATE public.orders o
   SET founder_campaign_no = COALESCE(
         (SELECT s.founder_campaign_no FROM public.supermarkets s WHERE s.id::text = o.supermarket_id::text),
         1)
 WHERE COALESCE(o.founder_discount_percent, 0) > 0 AND o.founder_campaign_no IS NULL;

-- ۳. حذف همه نسخه‌های قدیمی توابع کمپین (هر امضایی که داشته‌اند)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('get_founder_campaign', 'admin_set_founder_campaign',
                        'get_founder_campaign_history', 'admin_set_store_founder_discount')
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

-- ۴. دوره جاری (باز) + شمارنده‌ها
CREATE OR REPLACE FUNCTION public.get_founder_campaign()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  c public.founder_campaigns%ROWTYPE;
  v_granted integer;
BEGIN
  SELECT * INTO c FROM public.founder_campaigns
   WHERE ended_at IS NULL ORDER BY campaign_no DESC LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO c FROM public.founder_campaigns ORDER BY campaign_no DESC LIMIT 1;
  END IF;

  SELECT count(*) INTO v_granted FROM public.supermarkets
   WHERE founder_campaign_no = c.campaign_no AND founder_discount_enabled = true;

  RETURN jsonb_build_object(
    'campaign_no',      c.campaign_no,
    'active',           c.active,
    'percent',          c.percent,
    'capacity',         c.capacity,
    'orders_per_store', c.orders_per_store,
    'granted',          v_granted,
    'remaining',        GREATEST(0, c.capacity - v_granted),
    'started_at',       c.started_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_founder_campaign() TO anon, authenticated;

-- ۵. تاریخچه همه دوره‌ها (ادمین)
CREATE OR REPLACE FUNCTION public.get_founder_campaign_history()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'فقط مدیر سیستم به تاریخچه کمپین دسترسی دارد.';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.campaign_no DESC)
    FROM (
      SELECT
        c.campaign_no, c.percent, c.capacity, c.orders_per_store, c.active,
        c.started_at, c.ended_at,
        (SELECT count(*) FROM public.supermarkets s
          WHERE s.founder_campaign_no = c.campaign_no AND s.founder_discount_enabled = true) AS granted,
        (SELECT count(*) FROM public.orders o
          WHERE o.founder_campaign_no = c.campaign_no
            AND COALESCE(o.founder_discount_percent, 0) > 0
            AND o.status IS DISTINCT FROM 'cancelled') AS discounted_orders
      FROM public.founder_campaigns c
    ) t
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_founder_campaign_history() TO authenticated;

-- ۶. ذخیره تنظیمات دوره جاری  /  شروع دوره جدید
CREATE OR REPLACE FUNCTION public.admin_set_founder_campaign(
  p_percent          numeric,
  p_capacity         integer,
  p_orders_per_store integer,
  p_active           boolean,
  p_restart          boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  c public.founder_campaigns%ROWTYPE;
  v_new_no integer;
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'فقط مدیر سیستم می‌تواند کمپین را تغییر دهد.';
  END IF;
  IF p_percent < 0 OR p_percent > 100 THEN RAISE EXCEPTION 'درصد تخفیف نامعتبر است.'; END IF;
  IF p_capacity < 1 THEN RAISE EXCEPTION 'ظرفیت نامعتبر است.'; END IF;
  IF p_orders_per_store < 1 THEN RAISE EXCEPTION 'سقف سفارش نامعتبر است.'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('founder_campaign'));

  SELECT * INTO c FROM public.founder_campaigns
   WHERE ended_at IS NULL ORDER BY campaign_no DESC LIMIT 1;

  IF p_restart THEN
    -- بستن دوره قبل (فروشگاه‌های آن دوره سهمیه باقی‌مانده خود را حفظ می‌کنند)
    IF FOUND THEN
      UPDATE public.founder_campaigns
         SET ended_at = now(), active = false
       WHERE campaign_no = c.campaign_no;
    END IF;

    SELECT COALESCE(max(campaign_no), 0) + 1 INTO v_new_no FROM public.founder_campaigns;

    INSERT INTO public.founder_campaigns (campaign_no, percent, capacity, orders_per_store, active)
    VALUES (v_new_no, p_percent, p_capacity, p_orders_per_store, p_active);
  ELSE
    IF NOT FOUND THEN
      SELECT COALESCE(max(campaign_no), 0) + 1 INTO v_new_no FROM public.founder_campaigns;
      INSERT INTO public.founder_campaigns (campaign_no, percent, capacity, orders_per_store, active)
      VALUES (v_new_no, p_percent, p_capacity, p_orders_per_store, p_active);
    ELSE
      v_new_no := c.campaign_no;
      UPDATE public.founder_campaigns
         SET percent = p_percent, capacity = p_capacity,
             orders_per_store = p_orders_per_store, active = p_active
       WHERE campaign_no = c.campaign_no;

      -- اعمال درصد/سقف جدید روی فروشگاه‌های همین دوره
      UPDATE public.supermarkets
         SET founder_discount_percent = p_percent,
             founder_orders_limit = p_orders_per_store
       WHERE founder_campaign_no = c.campaign_no;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'campaign_no', v_new_no, 'restarted', p_restart);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_founder_campaign(numeric, integer, integer, boolean, boolean) TO authenticated;

-- ۷. اعطا / لغو دستی تخفیف برای یک فروشگاه (ادمین)
CREATE OR REPLACE FUNCTION public.admin_set_store_founder_discount(
  p_store_id text,
  p_enabled  boolean,
  p_percent  numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  c public.founder_campaigns%ROWTYPE;
  s public.supermarkets%ROWTYPE;
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'فقط مدیر سیستم می‌تواند تخفیف فروشگاه را تغییر دهد.';
  END IF;

  SELECT * INTO s FROM public.supermarkets WHERE id::text = p_store_id::text;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'فروشگاه یافت نشد.');
  END IF;

  IF p_enabled THEN
    SELECT * INTO c FROM public.founder_campaigns
     WHERE ended_at IS NULL ORDER BY campaign_no DESC LIMIT 1;

    IF s.founder_campaign_no IS DISTINCT FROM c.campaign_no THEN
      -- فروشگاه به دوره جاری منتقل می‌شود (شمارش سفارش‌های مصرف‌شده از صفر)
      UPDATE public.supermarkets
         SET founder_discount_enabled = true,
             founder_campaign_no = c.campaign_no,
             founder_discount_percent = COALESCE(p_percent, c.percent),
             founder_orders_limit = c.orders_per_store
       WHERE id::text = p_store_id::text;
    ELSE
      UPDATE public.supermarkets
         SET founder_discount_enabled = true,
             founder_discount_percent = COALESCE(p_percent, founder_discount_percent, c.percent)
       WHERE id::text = p_store_id::text;
    END IF;

    RETURN jsonb_build_object('success', true,
      'message', 'تخفیف طرح آغازین (دوره ' || c.campaign_no || ') برای فروشگاه فعال شد.');
  ELSE
    UPDATE public.supermarkets
       SET founder_discount_enabled = false
     WHERE id::text = p_store_id::text;
    RETURN jsonb_build_object('success', true, 'message', 'تخفیف طرح آغازین فروشگاه غیرفعال شد.');
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_store_founder_discount(text, boolean, numeric) TO authenticated;

-- ۸. اعطای خودکار تخفیف به فروشگاه جدید (تا سقف ظرفیت دوره جاری)
CREATE OR REPLACE FUNCTION public._founder_auto_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  c public.founder_campaigns%ROWTYPE;
  v_granted integer;
BEGIN
  -- فروشگاه‌های وارد شده با اکسل: اعطا دستی توسط ادمین
  IF NEW.import_batch IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('founder_campaign'));

  SELECT * INTO c FROM public.founder_campaigns
   WHERE ended_at IS NULL ORDER BY campaign_no DESC LIMIT 1;

  IF NOT FOUND OR NOT c.active THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_granted FROM public.supermarkets
   WHERE founder_campaign_no = c.campaign_no AND founder_discount_enabled = true;

  IF v_granted < c.capacity THEN
    NEW.founder_discount_enabled := true;
    NEW.founder_campaign_no := c.campaign_no;
    NEW.founder_discount_percent := c.percent;
    NEW.founder_orders_limit := c.orders_per_store;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_founder_auto_grant ON public.supermarkets;
CREATE TRIGGER trg_founder_auto_grant
  BEFORE INSERT ON public.supermarkets
  FOR EACH ROW EXECUTE FUNCTION public._founder_auto_grant();

-- ۹. ثبت شماره دوره روی سفارشِ دارای تخفیف
CREATE OR REPLACE FUNCTION public._order_stamp_founder_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF COALESCE(NEW.founder_discount_percent, 0) > 0 AND NEW.founder_campaign_no IS NULL THEN
    SELECT s.founder_campaign_no INTO NEW.founder_campaign_no
      FROM public.supermarkets s
     WHERE s.id::text = NEW.supermarket_id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_stamp_founder_campaign ON public.orders;
CREATE TRIGGER trg_order_stamp_founder_campaign
  BEFORE INSERT OR UPDATE OF founder_discount_percent ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._order_stamp_founder_campaign();

NOTIFY pgrst, 'reload schema';
