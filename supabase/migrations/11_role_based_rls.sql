-- =========================================================================
-- Migration: 11_role_based_rls.sql
-- Description: Role-Based Row Level Security (RLS) & RPC Security Hardening
-- =========================================================================

-- =========================================================================
-- بلوک ۱: توابع کمکی امنیتی (SECURITY DEFINER STABLE برای جلوگیری از حلقه بازگشتی)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.app_uid()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid()::text;
$$;

REVOKE EXECUTE ON FUNCTION public.app_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_uid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_uid() TO authenticated;

-- =========================================================================
-- بلوک ۲: جدول‌های پایه کاتالوگ (categories, brands, units, products) - کم‌ریسک
-- خواندن: تمام کاربران لاگین‌شده | نوشتن: فقط admin
-- =========================================================================

-- 2.1 categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_open_all" ON public.categories;
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_write_policy" ON public.categories;

CREATE POLICY "categories_select_policy" ON public.categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "categories_write_policy" ON public.categories
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'categories';

-- 2.2 brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brands_open_all" ON public.brands;
DROP POLICY IF EXISTS "brands_select_policy" ON public.brands;
DROP POLICY IF EXISTS "brands_write_policy" ON public.brands;

CREATE POLICY "brands_select_policy" ON public.brands
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "brands_write_policy" ON public.brands
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'brands';

-- 2.3 units
CREATE TABLE IF NOT EXISTS public.units (
  name TEXT PRIMARY KEY
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "units_open_all" ON public.units;
DROP POLICY IF EXISTS "units_select_policy" ON public.units;
DROP POLICY IF EXISTS "units_write_policy" ON public.units;

CREATE POLICY "units_select_policy" ON public.units
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "units_write_policy" ON public.units
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'units';

-- 2.4 products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_open_all" ON public.products;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_write_policy" ON public.products;

CREATE POLICY "products_select_policy" ON public.products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "products_write_policy" ON public.products
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'products';


-- =========================================================================
-- بلوک ۳: تاریخچه قیمت و تنظیمات سامانه (product_price_history, app_settings)
-- =========================================================================

-- 3.1 product_price_history
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_price_history_open_all" ON public.product_price_history;
DROP POLICY IF EXISTS "product_price_history_select_policy" ON public.product_price_history;
DROP POLICY IF EXISTS "product_price_history_write_policy" ON public.product_price_history;

CREATE POLICY "product_price_history_select_policy" ON public.product_price_history
  FOR SELECT TO authenticated
  USING (public.app_role() IN ('admin', 'warehouse'));

CREATE POLICY "product_price_history_write_policy" ON public.product_price_history
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'product_price_history';

-- 3.2 app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_open_all" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_select_policy" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_write_policy" ON public.app_settings;

CREATE POLICY "app_settings_select_policy" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "app_settings_write_policy" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'app_settings';


-- =========================================================================
-- بلوک ۴: علاقه‌مندی‌های فروشگاه (product_likes)
-- خواندن: خود فروشگاه یا admin | نوشتن: خود فروشگاه
-- =========================================================================
ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_likes_open_all" ON public.product_likes;
DROP POLICY IF EXISTS "product_likes_select_policy" ON public.product_likes;
DROP POLICY IF EXISTS "product_likes_write_policy" ON public.product_likes;

CREATE POLICY "product_likes_select_policy" ON public.product_likes
  FOR SELECT TO authenticated
  USING (
    supermarket_id = public.app_uid() 
    OR public.app_role() = 'admin'
  );

CREATE POLICY "product_likes_write_policy" ON public.product_likes
  FOR ALL TO authenticated
  USING (
    (supermarket_id = public.app_uid() AND public.app_role() = 'supermarket')
    OR public.app_role() = 'admin'
  )
  WITH CHECK (
    (supermarket_id = public.app_uid() AND public.app_role() = 'supermarket')
    OR public.app_role() = 'admin'
  );

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'product_likes';


-- =========================================================================
-- بلوک ۵: پروفایل‌ها (profiles)
-- خواندن: خود کاربر یا admin/warehouse | نوشتن مستقیم کلاینت: مجاز نیست (فقط Edge Function و RPC)
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_open_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = public.app_uid()
    OR public.app_role() IN ('admin', 'warehouse')
  );

-- کلاینت مستقیماً روی profiles دسترسی INSERT/UPDATE/DELETE ندارد؛ فقط از طریق RPC/Edge Function انجام می‌شود.
CREATE POLICY "profiles_write_policy" ON public.profiles
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'profiles';


-- =========================================================================
-- بلوک ۶: ویزیتورها (visitors)
-- خواندن: admin/warehouse همه، ویزیتور خودش، فروشگاه ویزیتور تخصیص‌یافته‌اش | نوشتن: فقط admin
-- =========================================================================
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visitors_open_all" ON public.visitors;
DROP POLICY IF EXISTS "visitors_select_policy" ON public.visitors;
DROP POLICY IF EXISTS "visitors_write_policy" ON public.visitors;

CREATE POLICY "visitors_select_policy" ON public.visitors
  FOR SELECT TO authenticated
  USING (
    public.app_role() IN ('admin', 'warehouse')
    OR id = public.app_uid()
    OR EXISTS (
      SELECT 1 FROM public.supermarkets s
      WHERE s.id = public.app_uid() AND s.assigned_visitor_id = visitors.id
    )
  );

CREATE POLICY "visitors_write_policy" ON public.visitors
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'visitors';


-- =========================================================================
-- بلوک ۷: فروشگاه‌ها (supermarkets)
-- خواندن: admin/warehouse همه، ویزیتور فروشگاه‌های خودش، فروشگاه خودش | نوشتن مستقیم: admin
-- ویرایش توسط خود فروشگاه از طریق RPC امن update_my_store انجام می‌شود.
-- =========================================================================
ALTER TABLE public.supermarkets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supermarkets_open_all" ON public.supermarkets;
DROP POLICY IF EXISTS "supermarkets_select_policy" ON public.supermarkets;
DROP POLICY IF EXISTS "supermarkets_write_policy" ON public.supermarkets;

CREATE POLICY "supermarkets_select_policy" ON public.supermarkets
  FOR SELECT TO authenticated
  USING (
    public.app_role() IN ('admin', 'warehouse')
    OR id = public.app_uid()
    OR assigned_visitor_id = public.app_uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.supermarket_id = supermarkets.id AND o.assigned_visitor_id = public.app_uid()
    )
  );

CREATE POLICY "supermarkets_write_policy" ON public.supermarkets
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'supermarkets';

-- RPC امن ویرایش اطلاعات توسط خود فروشگاه
CREATE OR REPLACE FUNCTION public.update_my_store(
  p_name TEXT,
  p_owner TEXT,
  p_address TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_clean_name TEXT;
  v_clean_owner TEXT;
  v_clean_address TEXT;
  v_clean_phone TEXT;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'احراز هویت انجام نشده است.';
  END IF;

  IF v_role <> 'supermarket' AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای ویرایش فروشگاه.';
  END IF;

  v_clean_name := trim(COALESCE(p_name, ''));
  v_clean_owner := trim(COALESCE(p_owner, ''));
  v_clean_address := trim(COALESCE(p_address, ''));
  v_clean_phone := trim(COALESCE(p_phone, ''));

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'نام فروشگاه الزامی است.';
  END IF;

  -- فقط فیلدهای مجاز بروزرسانی می‌شوند (assigned_visitor_id و is_active تغییر نمی‌کنند)
  UPDATE public.supermarkets
  SET 
    name = v_clean_name,
    owner = v_clean_owner,
    address = v_clean_address,
    phone = CASE WHEN v_clean_phone <> '' THEN v_clean_phone ELSE phone END
  WHERE id = v_uid;

  UPDATE public.profiles
  SET
    name = v_clean_name,
    phone = CASE WHEN v_clean_phone <> '' THEN v_clean_phone ELSE phone END
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'اطلاعات فروشگاه با موفقیت به‌روزرسانی شد.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_store(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_store(TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- =========================================================================
-- بلوک ۸: تراکنش‌های انبار (inventory_transactions)
-- خواندن: admin/warehouse | نوشتن مستقیم: admin (سایر از طریق RPC)
-- =========================================================================
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_transactions_open_all" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_select_policy" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_write_policy" ON public.inventory_transactions;

CREATE POLICY "inventory_transactions_select_policy" ON public.inventory_transactions
  FOR SELECT TO authenticated
  USING (public.app_role() IN ('admin', 'warehouse'));

CREATE POLICY "inventory_transactions_write_policy" ON public.inventory_transactions
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'inventory_transactions';

-- RPC امن تعدیل موجودی و ثبت مرجوعی توسط انباردار یا ادمین
CREATE OR REPLACE FUNCTION public.adjust_product_stock_transaction(
  p_product_id TEXT,
  p_quantity INT,
  p_tx_type TEXT,
  p_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prod_name TEXT;
  v_curr_stock INT;
  v_new_stock INT;
  v_tx_id TEXT;
BEGIN
  v_role := public.app_role();
  IF v_role NOT IN ('admin', 'warehouse') THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای تغییر موجودی انبار.';
  END IF;

  SELECT name, COALESCE(stock, 0) INTO v_prod_name, v_curr_stock
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'کالای مورد نظر یافت نشد.';
  END IF;

  IF p_tx_type = 'return' THEN
    v_new_stock := v_curr_stock + abs(p_quantity);
  ELSIF p_tx_type = 'manual_adjustment' THEN
    v_new_stock := GREATEST(0, v_curr_stock + p_quantity);
  ELSE
    v_new_stock := GREATEST(0, v_curr_stock + p_quantity);
  END IF;

  UPDATE public.products
  SET stock = v_new_stock
  WHERE id = p_product_id;

  v_tx_id := 'tx-' || extract(epoch from now())::bigint || '-' || p_product_id;

  INSERT INTO public.inventory_transactions (
    id,
    product_id,
    transaction_type,
    quantity,
    reference_id,
    created_at
  ) VALUES (
    v_tx_id,
    p_product_id,
    p_tx_type,
    p_quantity,
    p_reference,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_stock', v_new_stock,
    'tx_id', v_tx_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_product_stock_transaction(TEXT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock_transaction(TEXT, INT, TEXT, TEXT) TO authenticated;


-- =========================================================================
-- بلوک ۹: تاریخچه انتقال و درخواست‌های واگذاری (order_visitor_history, reassignment_requests)
-- =========================================================================

-- 9.1 order_visitor_history
ALTER TABLE public.order_visitor_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_visitor_history_open_all" ON public.order_visitor_history;
DROP POLICY IF EXISTS "order_visitor_history_select_policy" ON public.order_visitor_history;
DROP POLICY IF EXISTS "order_visitor_history_write_policy" ON public.order_visitor_history;

CREATE POLICY "order_visitor_history_select_policy" ON public.order_visitor_history
  FOR SELECT TO authenticated
  USING (
    public.app_role() = 'admin'
    OR old_visitor_id = public.app_uid()
    OR new_visitor_id = public.app_uid()
  );

CREATE POLICY "order_visitor_history_write_policy" ON public.order_visitor_history
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'order_visitor_history';

-- 9.2 reassignment_requests
ALTER TABLE public.reassignment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reassignment_requests_open_all" ON public.reassignment_requests;
DROP POLICY IF EXISTS "reassignment_requests_select_policy" ON public.reassignment_requests;
DROP POLICY IF EXISTS "reassignment_requests_write_policy" ON public.reassignment_requests;

CREATE POLICY "reassignment_requests_select_policy" ON public.reassignment_requests
  FOR SELECT TO authenticated
  USING (
    public.app_role() = 'admin'
    OR from_visitor_id = public.app_uid()
    OR to_visitor_id = public.app_uid()
    OR to_visitor_id IS NULL
  );

CREATE POLICY "reassignment_requests_write_policy" ON public.reassignment_requests
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'reassignment_requests';

-- RPC امن درخواست واگذاری سفارش توسط ویزیتور
CREATE OR REPLACE FUNCTION public.request_order_reassignment(
  p_order_id TEXT,
  p_to_visitor_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_order RECORD;
  v_from_vis RECORD;
  v_to_vis RECORD;
  v_req_id TEXT;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'سفارش یافت نشد.';
  END IF;

  IF v_role <> 'admin' AND v_order.assigned_visitor_id <> v_uid THEN
    RAISE EXCEPTION 'فقط ویزیتور مسئول یا ادمین می‌تواند درخواست واگذاری دهد.';
  END IF;

  SELECT * INTO v_from_vis FROM public.visitors WHERE id = v_order.assigned_visitor_id;
  IF p_to_visitor_id IS NOT NULL AND p_to_visitor_id <> '' THEN
    SELECT * INTO v_to_vis FROM public.visitors WHERE id = p_to_visitor_id;
  END IF;

  v_req_id := 'req-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4);

  INSERT INTO public.reassignment_requests (
    id,
    order_id,
    supermarket_name,
    from_visitor_id,
    from_visitor_name,
    to_visitor_id,
    to_visitor_name,
    status,
    created_at
  ) VALUES (
    v_req_id,
    p_order_id,
    v_order.supermarket_name,
    v_order.assigned_visitor_id,
    COALESCE(v_from_vis.name, v_order.visitor_name),
    p_to_visitor_id,
    COALESCE(v_to_vis.name, 'عمومی (هر ویزیتوری)'),
    'pending',
    NOW()
  );

  UPDATE public.orders
  SET status = 'delegated', reassignment_id = v_req_id
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_req_id,
    'message', 'درخواست واگذاری با موفقیت ثبت شد.'
  );
END;
$$;

-- RPC امن پاسخ به واگذاری سفارش (قبول یا رد)
CREATE OR REPLACE FUNCTION public.respond_order_reassignment(
  p_request_id TEXT,
  p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_req RECORD;
  v_vis RECORD;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  SELECT * INTO v_req FROM public.reassignment_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'درخواست واگذاری یافت نشد.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'این درخواست قبلاً تعیین وضعیت شده است.';
  END IF;

  IF v_role <> 'admin' AND v_role <> 'visitor' THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز برای پاسخ به واگذاری.';
  END IF;

  -- اگر به ویزیتور خاصی اختصاص داشته و کاربر ویزیتور دیگری است
  IF v_role = 'visitor' AND v_req.to_visitor_id IS NOT NULL AND v_req.to_visitor_id <> v_uid THEN
    RAISE EXCEPTION 'این درخواست برای ویزیتور دیگری ارسال شده است.';
  END IF;

  IF p_accept THEN
    SELECT * INTO v_vis FROM public.visitors WHERE id = v_uid;
    
    UPDATE public.reassignment_requests
    SET status = 'accepted'
    WHERE id = p_request_id;

    UPDATE public.orders
    SET 
      assigned_visitor_id = v_uid,
      visitor_name = COALESCE(v_vis.name, 'ویزیتور'),
      status = 'assigned',
      reassignment_id = NULL
    WHERE id = v_req.order_id;

    INSERT INTO public.order_visitor_history (
      order_id,
      old_visitor_id,
      new_visitor_id,
      changed_by,
      created_at
    ) VALUES (
      v_req.order_id,
      v_req.from_visitor_id,
      v_uid,
      COALESCE(v_vis.name, 'ویزیتور'),
      NOW()
    );
  ELSE
    UPDATE public.reassignment_requests
    SET status = 'rejected'
    WHERE id = p_request_id;

    UPDATE public.orders
    SET status = 'assigned', reassignment_id = NULL
    WHERE id = v_req.order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN p_accept THEN 'سفارش با موفقیت به شما واگذار شد.' ELSE 'درخواست واگذاری رد شد.' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_order_reassignment(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_order_reassignment(TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.respond_order_reassignment(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_order_reassignment(TEXT, BOOLEAN) TO authenticated;


-- =========================================================================
-- بلوک ۱۰: سفارش‌ها و اقلام سفارش (orders, order_items)
-- خواندن: admin/warehouse همه، ویزیتور سفارش‌های خودش، فروشگاه سفارش‌های خودش
-- نوشتن: admin مستقیم | سایر نقش‌ها از طریق RPC های SECURITY DEFINER
-- =========================================================================

-- 10.1 orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_open_all" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_write_policy" ON public.orders;

CREATE POLICY "orders_select_policy" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.app_role() IN ('admin', 'warehouse')
    OR assigned_visitor_id = public.app_uid()
    OR supermarket_id = public.app_uid()
  );

CREATE POLICY "orders_write_policy" ON public.orders
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'orders';

-- 10.2 order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_open_all" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;
DROP POLICY IF EXISTS "order_items_write_policy" ON public.order_items;

CREATE POLICY "order_items_select_policy" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          public.app_role() IN ('admin', 'warehouse')
          OR o.assigned_visitor_id = public.app_uid()
          OR o.supermarket_id = public.app_uid()
        )
    )
  );

CREATE POLICY "order_items_write_policy" ON public.order_items
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'order_items';


-- =========================================================================
-- بلوک ۱۱: حواله‌های بارگیری، اقلام و لاگ فاکتور (loading_bills, loading_bill_items, invoice_audit)
-- خواندن: admin/warehouse همه، ویزیتور فقط مال خودش، فروشگاه هیچ
-- نوشتن مستقیم: admin | ویزیتور و سایر از طریق RPC های فاکتور
-- =========================================================================

-- 11.1 loading_bills
ALTER TABLE public.loading_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loading_bills_open_all" ON public.loading_bills;
DROP POLICY IF EXISTS "loading_bills_select_policy" ON public.loading_bills;
DROP POLICY IF EXISTS "loading_bills_write_policy" ON public.loading_bills;

CREATE POLICY "loading_bills_select_policy" ON public.loading_bills
  FOR SELECT TO authenticated
  USING (
    public.app_role() IN ('admin', 'warehouse')
    OR visitor_id = public.app_uid()
  );

CREATE POLICY "loading_bills_write_policy" ON public.loading_bills
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'loading_bills';

-- 11.2 loading_bill_items
ALTER TABLE public.loading_bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loading_bill_items_open_all" ON public.loading_bill_items;
DROP POLICY IF EXISTS "loading_bill_items_select_policy" ON public.loading_bill_items;
DROP POLICY IF EXISTS "loading_bill_items_write_policy" ON public.loading_bill_items;

CREATE POLICY "loading_bill_items_select_policy" ON public.loading_bill_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loading_bills lb
      WHERE lb.id = loading_bill_items.loading_bill_id
        AND (
          public.app_role() IN ('admin', 'warehouse')
          OR lb.visitor_id = public.app_uid()
        )
    )
  );

CREATE POLICY "loading_bill_items_write_policy" ON public.loading_bill_items
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'loading_bill_items';

-- 11.3 invoice_audit
ALTER TABLE public.invoice_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_audit_open_all" ON public.invoice_audit;
DROP POLICY IF EXISTS "invoice_audit_select_policy" ON public.invoice_audit;
DROP POLICY IF EXISTS "invoice_audit_write_policy" ON public.invoice_audit;

CREATE POLICY "invoice_audit_select_policy" ON public.invoice_audit
  FOR SELECT TO authenticated
  USING (
    public.app_role() IN ('admin', 'warehouse')
    OR EXISTS (
      SELECT 1 FROM public.loading_bills lb
      WHERE lb.id = invoice_audit.invoice_id
        AND lb.visitor_id = public.app_uid()
    )
  );

CREATE POLICY "invoice_audit_write_policy" ON public.invoice_audit
  FOR ALL TO authenticated
  USING (public.app_role() = 'admin')
  WITH CHECK (public.app_role() = 'admin');

-- بررسی: SELECT * FROM pg_policies WHERE tablename = 'invoice_audit';


-- =========================================================================
-- بلوک ۱۲: مقاوم‌سازی امنیتی توابع RPC (اعتبارسنجی نقش و مالکیت بر اساس auth.uid())
-- =========================================================================

-- 12.1 create_order_transaction
CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_order_id TEXT,
  p_supermarket_id TEXT,
  p_supermarket_name TEXT,
  p_assigned_visitor_id TEXT,
  p_visitor_name TEXT,
  p_status TEXT,
  p_total_amount NUMERIC,
  p_items JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_actual_sm_id TEXT;
  v_actual_vis_id TEXT;
  v_caller_name TEXT;
  item JSONB;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'احراز هویت الزامی است.';
  END IF;

  -- بررسی دسترسی ثبت سفارش
  IF v_role = 'supermarket' THEN
    v_actual_sm_id := v_uid; -- فروشگاه فقط می‌تواند برای خودش سفارش ثبت کند
    SELECT name INTO v_caller_name FROM public.supermarkets WHERE id = v_uid;
    -- ویزیتور اختصاصی فروشگاه را چک کن
    SELECT assigned_visitor_id INTO v_actual_vis_id FROM public.supermarkets WHERE id = v_uid;
  ELSIF v_role = 'visitor' THEN
    v_actual_vis_id := v_uid;
    v_actual_sm_id := p_supermarket_id;
  ELSIF v_role = 'admin' THEN
    v_actual_sm_id := p_supermarket_id;
    v_actual_vis_id := CASE WHEN p_assigned_visitor_id = 'direct' THEN NULL ELSE p_assigned_visitor_id END;
  ELSE
    RAISE EXCEPTION 'نقش فعلی مجاز به ثبت سفارش نیست.';
  END IF;

  -- بررسی وجود فروشگاه
  IF v_actual_sm_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.supermarkets WHERE id = v_actual_sm_id) THEN
    v_actual_sm_id := NULL;
  END IF;

  -- درج سفارش
  INSERT INTO public.orders (
    id,
    supermarket_id,
    supermarket_name,
    assigned_visitor_id,
    visitor_name,
    status,
    total_amount,
    order_source,
    order_date
  ) VALUES (
    p_order_id,
    v_actual_sm_id,
    p_supermarket_name,
    v_actual_vis_id,
    COALESCE(p_visitor_name, 'پخش مرکزی'),
    COALESCE(p_status, 'assigned'),
    p_total_amount,
    CASE WHEN v_actual_vis_id IS NULL THEN 'supermarket' ELSE 'visitor' END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    supermarket_name = EXCLUDED.supermarket_name,
    assigned_visitor_id = EXCLUDED.assigned_visitor_id,
    visitor_name = EXCLUDED.visitor_name,
    status = EXCLUDED.status,
    total_amount = EXCLUDED.total_amount;

  -- پردازش اقلام و رزرو موجودی
  IF p_items IS NOT NULL THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      UPDATE public.products
      SET reserved_stock = COALESCE(reserved_stock, 0) + (item->>'quantity')::INTEGER
      WHERE id = item->>'productId';

      INSERT INTO public.inventory_transactions (
        id,
        product_id,
        transaction_type,
        quantity,
        reference_id,
        created_at
      ) VALUES (
        'tx-' || extract(epoch from now())::bigint || '-' || (item->>'productId'),
        item->>'productId',
        'reserve',
        (item->>'quantity')::INTEGER,
        p_order_id,
        NOW()
      );

      INSERT INTO public.order_items (
        id,
        order_id,
        product_id,
        name,
        price,
        quantity
      ) VALUES (
        'item-' || extract(epoch from now())::bigint || '-' || (item->>'productId'),
        p_order_id,
        item->>'productId',
        item->>'name',
        (item->>'price')::NUMERIC,
        (item->>'quantity')::INTEGER
      );
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- 12.2 get_or_create_draft
CREATE OR REPLACE FUNCTION public.get_or_create_draft(
  p_visitor_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_bill RECORD;
  v_vis_name TEXT;
  v_target_vis_id TEXT;
  v_bill_id TEXT;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'احراز هویت الزامی است.');
  END IF;

  -- ویزیتور فقط می‌تواند برای خودش پیش‌نویس بسازد
  IF v_role = 'visitor' THEN
    v_target_vis_id := v_uid;
  ELSIF v_role = 'admin' THEN
    v_target_vis_id := COALESCE(p_visitor_id, v_uid);
  ELSE
    RETURN json_build_object('success', false, 'message', 'دسترسی غیرمجاز.');
  END IF;

  -- بررسی پیش‌نویس موجود
  SELECT * INTO v_bill
  FROM public.loading_bills
  WHERE visitor_id = v_target_vis_id AND status = 'draft'
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'message', 'پیش‌نویس فاکتور موجود بازیابی شد.',
      'bill_id', v_bill.id,
      'is_new', false,
      'bill', row_to_json(v_bill)
    );
  END IF;

  SELECT name INTO v_vis_name FROM public.visitors WHERE id = v_target_vis_id;
  IF v_vis_name IS NULL THEN
    SELECT name INTO v_vis_name FROM public.profiles WHERE id = v_target_vis_id;
  END IF;
  v_vis_name := COALESCE(v_vis_name, 'ویزیتور');

  v_bill_id := 'BL-' || upper(substr(replace(v_target_vis_id, '-', ''), 1, 4)) || '-' || to_char(NOW(), 'YYMMDDHH24MISS');

  INSERT INTO public.loading_bills (
    id,
    visitor_id,
    visitor_name,
    status,
    orders_count,
    total_visitor_cost,
    total_store_amount,
    revision_count,
    created_at
  ) VALUES (
    v_bill_id,
    v_target_vis_id,
    v_vis_name,
    'draft',
    0,
    0,
    0,
    0,
    NOW()
  );

  INSERT INTO public.invoice_audit (
    invoice_id,
    action,
    actor_name,
    details,
    created_at
  ) VALUES (
    v_bill_id,
    'create_draft',
    v_vis_name,
    json_build_object('visitor_id', v_target_vis_id),
    NOW()
  );

  SELECT * INTO v_bill FROM public.loading_bills WHERE id = v_bill_id;

  RETURN json_build_object(
    'success', true,
    'message', 'پیش‌نویس فاکتور جدید ایجاد شد.',
    'bill_id', v_bill_id,
    'is_new', true,
    'bill', row_to_json(v_bill)
  );
END;
$$;

-- 12.3 submit_invoice (ارسال به انبار - فقط خود ویزیتور صاحب فاکتور یا admin)
CREATE OR REPLACE FUNCTION public.submit_invoice(
  p_bill_id TEXT,
  p_actor TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_bill RECORD;
  v_actor_name TEXT;
  v_items_count INT;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  SELECT * INTO v_bill FROM public.loading_bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
  END IF;

  IF v_role <> 'admin' AND v_bill.visitor_id <> v_uid THEN
    RETURN json_build_object('success', false, 'message', 'شما فقط مجاز به ارسال فاکتورهای خود هستید.');
  END IF;

  IF v_bill.status <> 'draft' THEN
    RETURN json_build_object('success', false, 'message', 'تنها فاکتورهای پیش‌نویس قابل ارسال به انبار هستند.');
  END IF;

  SELECT count(*) INTO v_items_count FROM public.loading_bill_items WHERE loading_bill_id = p_bill_id;
  IF v_items_count = 0 THEN
    RETURN json_build_object('success', false, 'message', 'فاکتور بدون اقلام کالا نمی‌تواند به انبار ارسال شود.');
  END IF;

  -- نام فاعل معتبر از profiles
  SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_uid;
  v_actor_name := COALESCE(v_actor_name, v_bill.visitor_name, 'ویزیتور');

  UPDATE public.loading_bills
  SET 
    status = 'pending_warehouse',
    submitted_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.invoice_audit (
    invoice_id,
    action,
    actor_name,
    details,
    created_at
  ) VALUES (
    p_bill_id,
    'submit_to_warehouse',
    v_actor_name,
    json_build_object('items_count', v_items_count),
    NOW()
  );

  RETURN json_build_object('success', true, 'message', 'فاکتور با موفقیت به انبار ارسال شد.');
END;
$$;

-- 12.4 finalize_invoice (تایید بارگیری و کسر نهایی موجودی - فقط admin و warehouse)
CREATE OR REPLACE FUNCTION public.finalize_invoice(
  p_bill_id TEXT,
  p_actor TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_bill RECORD;
  v_actor_name TEXT;
  r_item RECORD;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  IF v_role NOT IN ('admin', 'warehouse') THEN
    RETURN json_build_object('success', false, 'message', 'فقط انباردار یا مدیر می‌توانند فاکتور را تایید و نهایی کنند.');
  END IF;

  SELECT * INTO v_bill FROM public.loading_bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
  END IF;

  IF v_bill.status NOT IN ('pending_warehouse', 'warehouse_approved') THEN
    RETURN json_build_object('success', false, 'message', 'وضعیت فاکتور برای نهایی‌سازی معتبر نیست.');
  END IF;

  SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_uid;
  v_actor_name := COALESCE(v_actor_name, 'مسئول انبار');

  -- کسر قطعی موجودی فیزیکی و رزرو از جدول products
  FOR r_item IN 
    SELECT product_id, total_quantity 
    FROM public.loading_bill_items 
    WHERE loading_bill_id = p_bill_id AND product_id IS NOT NULL 
  LOOP
    UPDATE public.products
    SET 
      stock = GREATEST(0, stock - r_item.total_quantity),
      reserved_stock = GREATEST(0, reserved_stock - r_item.total_quantity)
    WHERE id = r_item.product_id;

    INSERT INTO public.inventory_transactions (
      id,
      product_id,
      transaction_type,
      quantity,
      reference_id,
      created_at
    ) VALUES (
      'tx-' || extract(epoch from now())::bigint || '-' || r_item.product_id,
      r_item.product_id,
      'loading_exit',
      -r_item.total_quantity,
      p_bill_id,
      NOW()
    );
  END LOOP;

  UPDATE public.loading_bills
  SET 
    status = 'completed',
    approved_at = NOW(),
    exit_confirmed_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.invoice_audit (
    invoice_id,
    action,
    actor_name,
    details,
    created_at
  ) VALUES (
    p_bill_id,
    'finalize_loading',
    v_actor_name,
    json_build_object('status', 'completed'),
    NOW()
  );

  RETURN json_build_object('success', true, 'message', 'بارگیری تایید و موجودی کالاها با موفقیت کسر شد.');
END;
$$;

-- 12.5 cancel_invoice (ابطال فاکتور)
CREATE OR REPLACE FUNCTION public.cancel_invoice(
  p_bill_id TEXT,
  p_actor TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_role TEXT;
  v_bill RECORD;
  v_actor_name TEXT;
BEGIN
  v_uid := public.app_uid();
  v_role := public.app_role();

  SELECT * INTO v_bill FROM public.loading_bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'فاکتور یافت نشد.');
  END IF;

  IF v_role = 'visitor' THEN
    IF v_bill.visitor_id <> v_uid THEN
      RETURN json_build_object('success', false, 'message', 'دسترسی غیرمجاز.');
    END IF;
    IF v_bill.status <> 'draft' THEN
      RETURN json_build_object('success', false, 'message', 'ویزیتور تنها می‌تواند پیش‌نویس را لغو کند.');
    END IF;
  ELSIF v_role NOT IN ('admin', 'warehouse') THEN
    RETURN json_build_object('success', false, 'message', 'دسترسی غیرمجاز برای لغو فاکتور.');
  END IF;

  SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_uid;
  v_actor_name := COALESCE(v_actor_name, 'کاربر');

  UPDATE public.loading_bills
  SET status = 'cancelled'
  WHERE id = p_bill_id;

  INSERT INTO public.invoice_audit (
    invoice_id,
    action,
    actor_name,
    details,
    created_at
  ) VALUES (
    p_bill_id,
    'cancel_invoice',
    v_actor_name,
    json_build_object('status', 'cancelled'),
    NOW()
  );

  RETURN json_build_object('success', true, 'message', 'فاکتور بارگیری با موفقیت لغو شد.');
END;
$$;

-- 12.6 اعطای دسترسی و محدودسازی RPC ها
REVOKE EXECUTE ON FUNCTION public.create_order_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_or_create_draft(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_draft(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_invoice(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_invoice(TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.finalize_invoice(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_invoice(TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_invoice(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_invoice(TEXT, TEXT) TO authenticated;

-- =========================================================================
-- پایان مایگریشن ۱۱
-- =========================================================================
