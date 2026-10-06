-- =========================================================================
-- Migration: 20_visitor_invoice_ledger_link.sql
-- Description: اتصال خودکار فاکتورهای نهایی‌شده ویزیتور به حساب دفتری (ثبت بدهی، تعدیل و برگشت لغو)
-- =========================================================================

-- =========================================================================
-- بخش ۱: تابع تریگر اتصال خودکار بدهی فاکتور به حساب دفتری
-- ۱. بدهی فقط وقتی ایجاد شود که فاکتور نهایی شده باشد (approved یا loaded)
-- ۲. جلوگیری قطعی از ثبت بدهی تکراری
-- ۳. در صورت تغییر مبلغ فاکتور نهایی‌شده، ثبت اختلاف به عنوان تعدیل (account_adjustment)
-- ۴. در صورت لغو فاکتور (cancelled)، برگشت کامل اثر مالی فاکتور
-- ۵. فاکتورهای draft و pending فاقد هرگونه اثر مالی در دفتر حساب هستند
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_sync_loading_bill_debt()
RETURNS TRIGGER AS $$
DECLARE
    v_acc RECORD;
    v_net_recorded NUMERIC := 0;
    v_tx_count INT := 0;
    v_bill_cost NUMERIC := 0;
BEGIN
    -- ۱. در صورت مشخص نبودن ویزیتور، انصراف
    IF NEW.visitor_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- ۲. بررسی وجود و فعال بودن حساب دفتری کاربر
    SELECT * INTO v_acc 
    FROM public.financial_accounts 
    WHERE profile_id = NEW.visitor_id;

    -- اگر حساب دفتری ندارد یا غیرفعال است، هیچ اثری ثبت نمی‌شود
    IF NOT FOUND OR v_acc.is_active IS FALSE THEN
        RETURN NEW;
    END IF;

    v_bill_cost := COALESCE(NEW.total_visitor_cost, 0);

    -- محاسبه بدهی خالص قبلاً ثبت شده برای این فاکتور در گردش‌های مالی
    SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE -amount END), 0),
        COUNT(*)
    INTO v_net_recorded, v_tx_count
    FROM public.account_transactions
    WHERE reference_id = NEW.id 
      AND transaction_type IN ('invoice_debt', 'account_adjustment', 'refund');

    -- حالت الف: فاکتور نهایی شده است ('approved' یا 'loaded')
    IF NEW.status IN ('approved', 'loaded') THEN
        -- اگر هنوز هیچ ردیفی برای این فاکتور ثبت نشده است
        IF v_tx_count = 0 THEN
            IF v_bill_cost > 0 THEN
                INSERT INTO public.account_transactions (
                    account_id,
                    profile_id,
                    transaction_type,
                    entry_type,
                    amount,
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
                    'بدهی فاکتور ' || COALESCE(NEW.invoice_no, NEW.id),
                    COALESCE(NEW.finalized_by, NEW.approved_by, 'سیستم فاکتور')
                );
            END IF;

        -- اگر قبلاً سندی ثبت شده بود ولی مبلغ فاکتور تغییر کرده است
        ELSIF v_net_recorded != v_bill_cost THEN
            IF v_bill_cost > v_net_recorded THEN
                -- افزایش مبلغ فاکتور نهایی‌شده: بدهکاری تعدیلی
                INSERT INTO public.account_transactions (
                    account_id,
                    profile_id,
                    transaction_type,
                    entry_type,
                    amount,
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
                    'تعدیل افزایش مبلغ فاکتور ' || COALESCE(NEW.invoice_no, NEW.id),
                    COALESCE(NEW.finalized_by, NEW.approved_by, 'سیستم فاکتور')
                );
            ELSE
                -- کاهش مبلغ فاکتور نهایی‌شده: بستانکاری تعدیلی
                INSERT INTO public.account_transactions (
                    account_id,
                    profile_id,
                    transaction_type,
                    entry_type,
                    amount,
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
                    'تعدیل کاهش مبلغ فاکتور ' || COALESCE(NEW.invoice_no, NEW.id),
                    COALESCE(NEW.finalized_by, NEW.approved_by, 'سیستم فاکتور')
                );
            END IF;
        END IF;

    -- حالت ب: فاکتور لغو شده است ('cancelled')
    ELSIF NEW.status = 'cancelled' THEN
        -- اگر قبلاً برای این فاکتور بدهی ثبت شده بود، اثر مالی آن را به طور کامل با بستانکاری برمی‌گردانیم
        IF v_net_recorded > 0 THEN
            INSERT INTO public.account_transactions (
                account_id,
                profile_id,
                transaction_type,
                entry_type,
                amount,
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
                'برگشت اثر مالی ناشی از لغو فاکتور ' || COALESCE(NEW.invoice_no, NEW.id),
                COALESCE(NEW.cancelled_by, 'سیستم فاکتور')
            );
        END IF;

    -- حالت ج: پیش‌نویس (draft) یا در انتظار (pending) -> هیچ اثر مالی ثبت نمی‌شود
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ۲. ساخت تریگر روی جدول loading_bills
DROP TRIGGER IF EXISTS trg_sync_loading_bill_debt ON public.loading_bills;
CREATE TRIGGER trg_sync_loading_bill_debt
    AFTER INSERT OR UPDATE OF status, total_visitor_cost, visitor_id
    ON public.loading_bills
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_sync_loading_bill_debt();

-- =========================================================================
-- بخش ۲: همگام‌سازی و Backfill یک‌باره برای فاکتورهای نهایی قبلی کاربران فعال
-- =========================================================================
DO $$
DECLARE
    r RECORD;
    v_acc RECORD;
    v_net NUMERIC := 0;
BEGIN
    FOR r IN 
        SELECT lb.id, lb.visitor_id, lb.invoice_no, lb.total_visitor_cost, lb.finalized_by, lb.approved_by
        FROM public.loading_bills lb
        JOIN public.financial_accounts fa ON fa.profile_id = lb.visitor_id
        WHERE lb.status IN ('approved', 'loaded') AND fa.is_active = true
    LOOP
        SELECT * INTO v_acc FROM public.financial_accounts WHERE profile_id = r.visitor_id;
        
        SELECT COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE -amount END), 0)
        INTO v_net
        FROM public.account_transactions
        WHERE reference_id = r.id AND transaction_type IN ('invoice_debt', 'account_adjustment', 'refund');

        IF v_net = 0 AND COALESCE(r.total_visitor_cost, 0) > 0 THEN
            INSERT INTO public.account_transactions (
                account_id,
                profile_id,
                transaction_type,
                entry_type,
                amount,
                reference_id,
                description,
                created_by_name
            ) VALUES (
                v_acc.id,
                r.visitor_id,
                'invoice_debt',
                'debit',
                r.total_visitor_cost,
                r.id,
                'بدهی فاکتور ' || COALESCE(r.invoice_no, r.id),
                COALESCE(r.finalized_by, r.approved_by, 'سیستم فاکتور')
            );
        END IF;
    END LOOP;
END $$;

-- =========================================================================
-- بخش ۳: به‌روزرسانی دسترسی RLS (مجوز SELECT خواندن اطلاعات مالی خودِ کاربر برای ویزیتور)
-- کاربران عادی حق نوشتن/ویرایش ندارند و فقط اطلاعات مالی خود را می‌بینند
-- =========================================================================
DROP POLICY IF EXISTS "financial_accounts_select_policy" ON public.financial_accounts;
CREATE POLICY "financial_accounts_select_policy" ON public.financial_accounts
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin') OR profile_id = public.app_uid());

DROP POLICY IF EXISTS "account_transactions_select_policy" ON public.account_transactions;
CREATE POLICY "account_transactions_select_policy" ON public.account_transactions
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin') OR profile_id = public.app_uid());

DROP POLICY IF EXISTS "cheques_select_policy" ON public.cheques;
CREATE POLICY "cheques_select_policy" ON public.cheques
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin') OR profile_id = public.app_uid());

DROP POLICY IF EXISTS "allocations_select_policy" ON public.payment_allocations;
CREATE POLICY "allocations_select_policy" ON public.payment_allocations
    FOR SELECT TO authenticated
    USING (
        public.app_role() IN ('admin', 'superadmin') OR 
        EXISTS (
            SELECT 1 FROM public.loading_bills lb 
            WHERE lb.id = payment_allocations.invoice_id AND lb.visitor_id = public.app_uid()
        )
    );
