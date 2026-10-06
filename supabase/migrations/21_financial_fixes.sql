-- =========================================================================
-- Migration: 21_financial_fixes.sql
-- Description: اصلاحات نهایی حساب دفتری:
-- ۱. محدودسازی قطعی RLS صرفاً به ادمین (حذف SELECT برای کاربران عادی)
-- ۲. ثبت بدهی فاکتورهای قبلی در زمان فعال‌سازی حساب توسط ادمین
-- ۳. یکسان‌سازی مرجع فاکتور (reference_invoice_id) و جلوگیری از ثبت تکراری
-- ۴. اصلاح جهت بدهکار/بستانکار در تراکنش‌های دستی و تعدیل حساب (account_adjustment)
-- =========================================================================

-- =========================================================================
-- بخش ۱: ارتقای سیاست‌های RLS (فقط خواندن SELECT برای ادمین / حذف کامل نوشتن مستقیم)
-- دسترسی مستقیم INSERT / UPDATE / DELETE از سمت فرانت‌اند به طور کامل مسدود است؛
-- حتی برای ادمین. تمام ثبت‌ها و تغییرات منحصراً از طریق RPCهای امن انجام می‌شود.
-- هیچ ویزیتور یا کاربر عادی نیز حق خواندن یا تغییر مستقیم اطلاعات مالی را ندارد.
-- =========================================================================

-- ۱.۱ جدول حساب‌ها (financial_accounts)
DROP POLICY IF EXISTS "financial_accounts_admin_manage" ON public.financial_accounts;
DROP POLICY IF EXISTS "financial_accounts_insert_policy" ON public.financial_accounts;
DROP POLICY IF EXISTS "financial_accounts_update_policy" ON public.financial_accounts;
DROP POLICY IF EXISTS "financial_accounts_delete_policy" ON public.financial_accounts;

DROP POLICY IF EXISTS "financial_accounts_select_policy" ON public.financial_accounts;
CREATE POLICY "financial_accounts_select_policy" ON public.financial_accounts
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));

-- ۱.۲ جدول گردش‌های مالی (account_transactions)
DROP POLICY IF EXISTS "account_transactions_admin_write" ON public.account_transactions;
DROP POLICY IF EXISTS "account_transactions_insert_policy" ON public.account_transactions;
DROP POLICY IF EXISTS "account_transactions_update_policy" ON public.account_transactions;
DROP POLICY IF EXISTS "account_transactions_delete_policy" ON public.account_transactions;

DROP POLICY IF EXISTS "account_transactions_select_policy" ON public.account_transactions;
CREATE POLICY "account_transactions_select_policy" ON public.account_transactions
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));

-- ۱.۳ جدول چک‌ها (cheques)
DROP POLICY IF EXISTS "cheques_admin_manage" ON public.cheques;
DROP POLICY IF EXISTS "cheques_insert_policy" ON public.cheques;
DROP POLICY IF EXISTS "cheques_update_policy" ON public.cheques;
DROP POLICY IF EXISTS "cheques_delete_policy" ON public.cheques;

DROP POLICY IF EXISTS "cheques_select_policy" ON public.cheques;
CREATE POLICY "cheques_select_policy" ON public.cheques
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));

-- ۱.۴ جدول تخصیص پرداخت‌ها (payment_allocations)
DROP POLICY IF EXISTS "allocations_admin_manage" ON public.payment_allocations;
DROP POLICY IF EXISTS "allocations_insert_policy" ON public.payment_allocations;
DROP POLICY IF EXISTS "allocations_update_policy" ON public.payment_allocations;
DROP POLICY IF EXISTS "allocations_delete_policy" ON public.payment_allocations;

DROP POLICY IF EXISTS "allocations_select_policy" ON public.payment_allocations;
CREATE POLICY "allocations_select_policy" ON public.payment_allocations
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));

-- ۱.۵ جدول لاگ‌های حسابرسی مالی (financial_audit_logs)
DROP POLICY IF EXISTS "financial_audit_admin_only" ON public.financial_audit_logs;
DROP POLICY IF EXISTS "financial_audit_insert_policy" ON public.financial_audit_logs;
DROP POLICY IF EXISTS "financial_audit_update_policy" ON public.financial_audit_logs;
DROP POLICY IF EXISTS "financial_audit_delete_policy" ON public.financial_audit_logs;

DROP POLICY IF EXISTS "financial_audit_select_policy" ON public.financial_audit_logs;
CREATE POLICY "financial_audit_select_policy" ON public.financial_audit_logs
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));


-- =========================================================================
-- بخش ۲: یکسان‌سازی مرجع فاکتور (reference_invoice_id) و اصلاح ایندکس یکتا
-- =========================================================================

-- همگام‌سازی رکوردهای قبلی که شناسه فاکتور را در reference_id داشتند
UPDATE public.account_transactions
SET reference_invoice_id = reference_id
WHERE reference_invoice_id IS NULL
  AND reference_id IS NOT NULL
  AND reference_id IN (SELECT id FROM public.loading_bills);

-- اطمینان از وجود ایندکس یکتا بر اساس reference_invoice_id جهت جلوگیری از duplicate debt
DROP INDEX IF EXISTS public.idx_unique_invoice_debt;
CREATE UNIQUE INDEX idx_unique_invoice_debt 
    ON public.account_transactions (account_id, reference_invoice_id) 
    WHERE (transaction_type = 'invoice_debt' AND reference_invoice_id IS NOT NULL);


-- =========================================================================
-- بخش ۳: بازنویسی تریگر همگام‌سازی فاکتور بارگیری با استفاده از reference_invoice_id
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_sync_loading_bill_debt()
RETURNS TRIGGER AS $$
DECLARE
    v_acc RECORD;
    v_net_recorded NUMERIC := 0;
    v_tx_count INT := 0;
    v_bill_cost NUMERIC := 0;
BEGIN
    -- در صورت عدم انتساب به ویزیتور، انصراف
    IF NEW.visitor_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- بررسی وجود و فعال بودن حساب دفتری ویزیتور
    SELECT * INTO v_acc 
    FROM public.financial_accounts 
    WHERE profile_id = NEW.visitor_id;

    -- اگر حساب ندارد یا غیرفعال است، هیچ اثری ثبت نمی‌شود
    IF NOT FOUND OR v_acc.is_active IS FALSE THEN
        RETURN NEW;
    END IF;

    v_bill_cost := COALESCE(NEW.total_visitor_cost, 0);

    -- محاسبه بدهی خالص قبلی با استفاده از ستون استاندارد reference_invoice_id
    SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE -amount END), 0),
        COUNT(*)
    INTO v_net_recorded, v_tx_count
    FROM public.account_transactions
    WHERE account_id = v_acc.id
      AND (reference_invoice_id = NEW.id OR (reference_invoice_id IS NULL AND reference_id = NEW.id))
      AND transaction_type IN ('invoice_debt', 'account_adjustment', 'refund');

    -- حالت الف: فاکتور نهایی شده است ('approved' یا 'loaded')
    IF NEW.status IN ('approved', 'loaded') THEN
        IF v_tx_count = 0 THEN
            -- ثبت اولیه بدهی فاکتور با reference_invoice_id
            IF v_bill_cost > 0 THEN
                INSERT INTO public.account_transactions (
                    account_id,
                    profile_id,
                    transaction_type,
                    entry_type,
                    amount,
                    reference_invoice_id,
                    reference_id,
                    description,
                    created_by_name
                ) VALUES (
                    v_acc.id,
                    NEW.visitor_id,
                    'invoice_debt',
                    'debit',
                    v_bill_cost,
                    NEW.id,
                    NEW.id,
                    'بدهی فاکتور ' || COALESCE(NEW.invoice_no, NEW.id),
                    COALESCE(NEW.finalized_by, NEW.approved_by, 'سیستم فاکتور')
                );
            END IF;

        ELSIF v_net_recorded != v_bill_cost THEN
            -- در صورت تغییر مبلغ فاکتور نهایی‌شده، ثبت تعدیل
            IF v_bill_cost > v_net_recorded THEN
                INSERT INTO public.account_transactions (
                    account_id,
                    profile_id,
                    transaction_type,
                    entry_type,
                    amount,
                    reference_invoice_id,
                    reference_id,
                    description,
                    created_by_name
                ) VALUES (
                    v_acc.id,
                    NEW.visitor_id,
                    'account_adjustment',
                    'debit',
                    v_bill_cost - v_net_recorded,
                    NEW.id,
                    NEW.id,
                    'تعدیل افزایش مبلغ فاکتور ' || COALESCE(NEW.invoice_no, NEW.id),
                    COALESCE(NEW.finalized_by, NEW.approved_by, 'سیستم فاکتور')
                );
            ELSE
                INSERT INTO public.account_transactions (
                    account_id,
                    profile_id,
                    transaction_type,
                    entry_type,
                    amount,
                    reference_invoice_id,
                    reference_id,
                    description,
                    created_by_name
                ) VALUES (
                    v_acc.id,
                    NEW.visitor_id,
                    'account_adjustment',
                    'credit',
                    v_net_recorded - v_bill_cost,
                    NEW.id,
                    NEW.id,
                    'تعدیل کاهش مبلغ فاکتور ' || COALESCE(NEW.invoice_no, NEW.id),
                    COALESCE(NEW.finalized_by, NEW.approved_by, 'سیستم فاکتور')
                );
            END IF;
        END IF;

    -- حالت ب: فاکتور لغو شده است ('cancelled')
    ELSIF NEW.status = 'cancelled' THEN
        IF v_net_recorded > 0 THEN
            INSERT INTO public.account_transactions (
                account_id,
                profile_id,
                transaction_type,
                entry_type,
                amount,
                reference_invoice_id,
                reference_id,
                description,
                created_by_name
            ) VALUES (
                v_acc.id,
                NEW.visitor_id,
                'account_adjustment',
                'credit',
                v_net_recorded,
                NEW.id,
                NEW.id,
                'برگشت اثر مالی ناشی از لغو فاکتور ' || COALESCE(NEW.invoice_no, NEW.id),
                COALESCE(NEW.cancelled_by, 'سیستم فاکتور')
            );
        END IF;

    -- حالت ج: پیش‌نویس (draft) یا در انتظار (pending) فاقد اثر مالی است
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_loading_bill_debt ON public.loading_bills;
CREATE TRIGGER trg_sync_loading_bill_debt
    AFTER INSERT OR UPDATE OF status, total_visitor_cost, visitor_id
    ON public.loading_bills
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_sync_loading_bill_debt();


-- =========================================================================
-- بخش ۴: بازنویسی admin_activate_financial_account و ثبت بدهی فاکتورهای قبلی
-- =========================================================================
DROP FUNCTION IF EXISTS public.admin_activate_financial_account(TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.admin_activate_financial_account(
    p_profile_id TEXT,
    p_credit_limit NUMERIC DEFAULT 0,
    p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_actor_role TEXT;
    v_actor_id TEXT;
    v_actor_name TEXT;
    v_acc_id TEXT;
    v_acc_no TEXT;
    v_profile RECORD;
    v_bill RECORD;
    v_backfill_count INT := 0;
BEGIN
    v_actor_role := public.app_role();
    v_actor_id := public.app_uid();

    IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RETURN json_build_object('success', false, 'message', 'دسترسی غیرمجاز: تنها ادمین سامانه می‌تواند حساب دفتری را فعال کند.');
    END IF;

    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    IF v_actor_name IS NULL THEN v_actor_name := 'مدیر سامانه'; END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'پروفایل مورد نظر یافت نشد.');
    END IF;

    v_acc_no := 'ACC-' || UPPER(SUBSTR(v_profile.role, 1, 3)) || '-' || LPAD(COALESCE(NULLIF(regexp_replace(p_profile_id, '\D', '', 'g'), ''), floor(random()*9000 + 1000)::text), 4, '0');

    INSERT INTO public.financial_accounts (
        profile_id,
        account_number,
        is_active,
        credit_limit,
        notes,
        activated_at,
        activated_by,
        updated_at
    ) VALUES (
        p_profile_id,
        v_acc_no,
        true,
        COALESCE(p_credit_limit, 0),
        p_notes,
        NOW(),
        v_actor_name,
        NOW()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
        is_active = true,
        credit_limit = COALESCE(p_credit_limit, public.financial_accounts.credit_limit),
        notes = COALESCE(p_notes, public.financial_accounts.notes),
        activated_at = NOW(),
        activated_by = v_actor_name,
        updated_at = NOW()
    RETURNING id INTO v_acc_id;

    -- ثبت یک‌باره تمام فاکتورهای قبلی کاربر که نهایی شده‌اند ('approved' یا 'loaded')
    -- فاکتورهای draft و pending هرگز ثبت نمی‌شوند و ثبت تکراری به طور کامل فیلتر می‌شود
    FOR v_bill IN
        SELECT lb.*
        FROM public.loading_bills lb
        WHERE lb.visitor_id = p_profile_id
          AND lb.status IN ('approved', 'loaded')
          AND COALESCE(lb.total_visitor_cost, 0) > 0
          AND NOT EXISTS (
              SELECT 1 FROM public.account_transactions at
              WHERE at.account_id = v_acc_id
                AND (at.reference_invoice_id = lb.id OR (at.reference_invoice_id IS NULL AND at.reference_id = lb.id))
                AND at.transaction_type = 'invoice_debt'
          )
        ORDER BY COALESCE(lb.finalized_at, lb.approved_at, lb.created_at) ASC
    LOOP
        INSERT INTO public.account_transactions (
            account_id,
            profile_id,
            transaction_type,
            entry_type,
            amount,
            reference_invoice_id,
            reference_id,
            transaction_date,
            description,
            created_by,
            created_by_name
        ) VALUES (
            v_acc_id,
            p_profile_id,
            'invoice_debt',
            'debit',
            v_bill.total_visitor_cost,
            v_bill.id,
            v_bill.id,
            COALESCE(v_bill.finalized_at, v_bill.approved_at, NOW()),
            'بدهی فاکتور ' || COALESCE(v_bill.invoice_no, v_bill.id),
            v_actor_id,
            v_actor_name
        );
        v_backfill_count := v_backfill_count + 1;
    END LOOP;

    INSERT INTO public.financial_audit_logs (account_id, action, actor_id, actor_name, details)
    VALUES (v_acc_id, 'activate_account', v_actor_id, v_actor_name, json_build_object(
        'profile_id', p_profile_id,
        'profile_name', v_profile.name,
        'credit_limit', p_credit_limit,
        'backfilled_invoices_count', v_backfill_count
    ));

    RETURN json_build_object(
        'success', true, 
        'message', 'حساب دفتری با موفقیت فعال شد.' || 
                   CASE WHEN v_backfill_count > 0 THEN ' (' || v_backfill_count || ' فاکتور قبلی به عنوان بدهی ثبت شد)' ELSE '' END,
        'account_id', v_acc_id, 
        'account_number', v_acc_no,
        'backfilled_invoices', v_backfill_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- بخش ۵: بازنویسی admin_manual_financial_entry با امکان تعیین جهت (debit / credit)
-- =========================================================================

-- حذف امضاهای قبلی جهت جلوگیری قطعی از خطای ۴۲P13 (تغییر مقادیر پیش‌فرض پارامترها)
DROP FUNCTION IF EXISTS public.admin_manual_financial_entry(TEXT, TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_manual_financial_entry(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_manual_financial_entry(
    p_profile_id TEXT,
    p_type TEXT,
    p_amount NUMERIC,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_entry_type TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_actor_role TEXT;
    v_actor_id TEXT;
    v_actor_name TEXT;
    v_acc RECORD;
    v_entry_type TEXT;
    v_tx_id TEXT;
BEGIN
    v_actor_role := public.app_role();
    v_actor_id := public.app_uid();

    IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RETURN json_build_object('success', false, 'message', 'تنها ادمین مجاز به ثبت گردش‌های دستی است.');
    END IF;

    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'مبلغ باید بزرگتر از صفر باشد.');
    END IF;

    SELECT * INTO v_acc FROM public.financial_accounts WHERE profile_id = p_profile_id;
    IF NOT FOUND OR v_acc.is_active = false THEN
        RETURN json_build_object('success', false, 'message', 'حساب دفتری فعال برای این کاربر یافت نشد.');
    END IF;

    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    -- اعتبارسنجی دقیق نوع تراکنش و جهت بدهکار/بستانکار
    IF p_type = 'manual_debit' THEN
        v_entry_type := 'debit';
    ELSIF p_type = 'manual_credit' THEN
        v_entry_type := 'credit';
    ELSIF p_type = 'refund' THEN
        v_entry_type := 'debit';
    ELSIF p_type = 'account_adjustment' THEN
        -- برای اصلاح حساب، جهت می‌تواند بدهکار (افزایش بدهی) یا بستانکار (کاهش بدهی) باشد
        v_entry_type := COALESCE(p_entry_type, 'credit');
        IF v_entry_type NOT IN ('debit', 'credit') THEN
            v_entry_type := 'credit';
        END IF;
    ELSIF p_type = 'opening_balance' THEN
        v_entry_type := COALESCE(p_entry_type, 'debit');
        IF v_entry_type NOT IN ('debit', 'credit') THEN
            v_entry_type := 'debit';
        END IF;
    ELSE
        RETURN json_build_object('success', false, 'message', 'نوع تراکنش نامعتبر است.');
    END IF;

    INSERT INTO public.account_transactions (
        account_id,
        profile_id,
        transaction_type,
        entry_type,
        amount,
        reference_id,
        description,
        created_by,
        created_by_name
    ) VALUES (
        v_acc.id,
        p_profile_id,
        p_type,
        v_entry_type,
        p_amount,
        p_reference_id,
        p_description,
        v_actor_id,
        COALESCE(v_actor_name, 'مدیر سامانه')
    ) RETURNING id INTO v_tx_id;

    INSERT INTO public.financial_audit_logs (account_id, action, actor_id, actor_name, details)
    VALUES (v_acc.id, 'manual_entry', v_actor_id, COALESCE(v_actor_name, 'مدیر سامانه'), json_build_object(
        'type', p_type,
        'amount', p_amount,
        'entry_type', v_entry_type,
        'description', p_description
    ));

    RETURN json_build_object(
        'success', true, 
        'message', 'تراکنش با موفقیت در دفتر حساب ثبت شد.', 
        'transaction_id', v_tx_id,
        'entry_type', v_entry_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- مجوزهای دسترسی
REVOKE EXECUTE ON FUNCTION public.admin_manual_financial_entry(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manual_financial_entry(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
