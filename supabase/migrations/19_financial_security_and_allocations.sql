-- =========================================================================
-- Migration: 19_financial_security_and_allocations.sql
-- Description: ارتقای امنیت RLS، محدودسازی دسترسی صرفاً به ادمین، و اعتبارسنجی دقیق تخصیص پرداخت‌ها
-- =========================================================================

-- =========================================================================
-- بخش ۱: ارتقای سیاست‌های RLS (فقط ادمین مجاز به خواندن و نوشتن است)
-- کاربران عادی فعلاً به اطلاعات مالی هیچ دسترسی مستقیم (SELECT) ندارند
-- =========================================================================

-- ۱.۱ جدول حساب‌ها (financial_accounts)
DROP POLICY IF EXISTS "financial_accounts_select_policy" ON public.financial_accounts;
CREATE POLICY "financial_accounts_select_policy" ON public.financial_accounts
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "financial_accounts_admin_manage" ON public.financial_accounts;
CREATE POLICY "financial_accounts_admin_manage" ON public.financial_accounts
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- ۱.۲ جدول گردش‌های مالی (account_transactions)
DROP POLICY IF EXISTS "account_transactions_select_policy" ON public.account_transactions;
CREATE POLICY "account_transactions_select_policy" ON public.account_transactions
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "account_transactions_admin_write" ON public.account_transactions;
CREATE POLICY "account_transactions_admin_write" ON public.account_transactions
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- ۱.۳ جدول چک‌ها (cheques)
DROP POLICY IF EXISTS "cheques_select_policy" ON public.cheques;
CREATE POLICY "cheques_select_policy" ON public.cheques
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "cheques_admin_manage" ON public.cheques;
CREATE POLICY "cheques_admin_manage" ON public.cheques
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- ۱.۴ جدول تخصیص پرداخت‌ها (payment_allocations)
DROP POLICY IF EXISTS "allocations_select_policy" ON public.payment_allocations;
CREATE POLICY "allocations_select_policy" ON public.payment_allocations
    FOR SELECT TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "allocations_admin_manage" ON public.payment_allocations;
CREATE POLICY "allocations_admin_manage" ON public.payment_allocations
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- ۱.۵ لاگ حسابرسی مالی (financial_audit_logs)
DROP POLICY IF EXISTS "financial_audit_admin_only" ON public.financial_audit_logs;
CREATE POLICY "financial_audit_admin_only" ON public.financial_audit_logs
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));


-- =========================================================================
-- بخش ۲: بازنویسی تابع admin_record_payment با اعتبارسنجی‌های سه‌گانه
-- ۱. مجموع تخصیص‌ها <= مبلغ پرداخت
-- ۲. تخصیص هر فاکتور <= معوق همان فاکتور
-- ۳. فاکتور حتماً متعلق به همان شخص (پروفایل) باشد
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_record_payment(
    p_profile_id TEXT,
    p_payment_type TEXT,
    p_amount NUMERIC,
    p_reference_id TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_cheque_details JSONB DEFAULT NULL,
    p_allocations JSONB DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_actor_role TEXT;
    v_actor_id TEXT;
    v_actor_name TEXT;
    v_acc RECORD;
    v_tx_id TEXT;
    v_cheque_id TEXT;
    v_alloc RECORD;
    v_bill RECORD;
    v_total_alloc NUMERIC := 0;
    v_existing_alloc NUMERIC := 0;
    v_remaining_due NUMERIC := 0;
BEGIN
    -- الف) احراز دسترسی: صرفاً ادمین
    v_actor_role := public.app_role();
    v_actor_id := public.app_uid();

    IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RETURN json_build_object('success', false, 'message', 'دسترسی غیرمجاز: تنها ادمین سامانه مجاز به ثبت دریافت و پرداخت است.');
    END IF;

    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'مبلغ پرداخت باید بزرگتر از صفر باشد.');
    END IF;

    IF p_payment_type NOT IN ('cash_payment', 'bank_transfer', 'cheque_payment') THEN
        RETURN json_build_object('success', false, 'message', 'نوع روش پرداخت نامعتبر است.');
    END IF;

    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    -- ب) بررسی فعال بودن حساب دفتری
    SELECT * INTO v_acc FROM public.financial_accounts WHERE profile_id = p_profile_id;
    IF NOT FOUND OR v_acc.is_active = false THEN
        RETURN json_build_object('success', false, 'message', 'این کاربر حساب دفتری فعال ندارد. ثبت تراکنش برای حساب غیرفعال امکان‌پذیر نیست.');
    END IF;

    -- ج) اعتبارسنجی‌های تخصیص فاکتورها (Allocations Validation)
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(invoice_id TEXT, amount NUMERIC) LOOP
            IF v_alloc.amount IS NOT NULL AND v_alloc.amount > 0 THEN
                -- ۱. بررسی وجود فاکتور و قفل رکورد
                SELECT * INTO v_bill FROM public.loading_bills WHERE id = v_alloc.invoice_id FOR UPDATE;
                IF NOT FOUND THEN
                    RETURN json_build_object('success', false, 'message', 'فاکتور مورد نظر یافت نشد: ' || COALESCE(v_alloc.invoice_id, ''));
                END IF;

                -- شرط ۳: فاکتور حتماً متعلق به همین پروفایل باشد
                IF v_bill.visitor_id IS DISTINCT FROM p_profile_id THEN
                    RETURN json_build_object(
                        'success', false, 
                        'message', 'فاکتور شماره ' || COALESCE(v_bill.invoice_no, v_bill.id) || ' متعلق به این کاربر نیست.'
                    );
                END IF;

                -- شرط ۲: بررسی مانده معوق فاکتور
                SELECT COALESCE(SUM(allocated_amount), 0) INTO v_existing_alloc
                FROM public.payment_allocations
                WHERE invoice_id = v_alloc.invoice_id AND invoice_type = 'loading_bill';

                v_remaining_due := GREATEST(0, COALESCE(v_bill.total_visitor_cost, 0) - v_existing_alloc);

                IF v_alloc.amount > v_remaining_due THEN
                    RETURN json_build_object(
                        'success', false, 
                        'message', 'مبلغ تخصیص داده شده به فاکتور ' || COALESCE(v_bill.invoice_no, v_bill.id) || 
                                   ' (' || v_alloc.amount || ' تومان) بیشتر از معوق آن (' || v_remaining_due || ' تومان) است.'
                    );
                END IF;

                v_total_alloc := v_total_alloc + v_alloc.amount;
            END IF;
        END LOOP;

        -- شرط ۱: مجموع تخصیص‌ها نباید بیشتر از مبلغ پرداخت باشد
        IF v_total_alloc > p_amount THEN
            RETURN json_build_object(
                'success', false, 
                'message', 'مجموع مبالغ تخصیص داده شده به فاکتورها (' || v_total_alloc || ' تومان) نمی‌تواند از کل مبلغ پرداختی (' || p_amount || ' تومان) بیشتر باشد.'
            );
        END IF;
    END IF;

    -- د) ثبت سند در دفتر مالی (بستانکار / credit)
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
        p_payment_type,
        'credit',
        p_amount,
        p_reference_id,
        COALESCE(p_description, 'ثبت پرداخت مالی'),
        v_actor_id,
        COALESCE(v_actor_name, 'مدیر سامانه')
    ) RETURNING id INTO v_tx_id;

    -- ه) در صورت پرداخت با چک، ثبت در جدول cheques
    IF p_payment_type = 'cheque_payment' AND p_cheque_details IS NOT NULL THEN
        INSERT INTO public.cheques (
            account_id,
            profile_id,
            transaction_id,
            amount,
            cheque_number,
            sayad_number,
            bank_name,
            branch_name,
            account_owner,
            issue_date,
            due_date,
            status,
            description,
            created_by
        ) VALUES (
            v_acc.id,
            p_profile_id,
            v_tx_id,
            p_amount,
            p_cheque_details->>'cheque_number',
            p_cheque_details->>'sayad_number',
            COALESCE(p_cheque_details->>'bank_name', 'نامشخص'),
            p_cheque_details->>'branch_name',
            COALESCE(p_cheque_details->>'account_owner', 'نامشخص'),
            COALESCE((p_cheque_details->>'issue_date')::date, CURRENT_DATE),
            (p_cheque_details->>'due_date')::date,
            'pending',
            p_cheque_details->>'description',
            v_actor_id
        ) RETURNING id INTO v_cheque_id;
    END IF;

    -- و) درج قطعی ردیف‌های تخصیص
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(invoice_id TEXT, amount NUMERIC) LOOP
            IF v_alloc.amount IS NOT NULL AND v_alloc.amount > 0 THEN
                INSERT INTO public.payment_allocations (
                    transaction_id,
                    invoice_type,
                    invoice_id,
                    allocated_amount,
                    created_by
                ) VALUES (
                    v_tx_id,
                    'loading_bill',
                    v_alloc.invoice_id,
                    v_alloc.amount,
                    v_actor_id
                );
            END IF;
        END LOOP;
    END IF;

    -- ز) لاگ حسابرسی
    INSERT INTO public.financial_audit_logs (account_id, action, actor_id, actor_name, details)
    VALUES (v_acc.id, 'record_payment', v_actor_id, COALESCE(v_actor_name, 'مدیر سامانه'), json_build_object(
        'payment_type', p_payment_type,
        'amount', p_amount,
        'transaction_id', v_tx_id,
        'cheque_id', v_cheque_id,
        'allocated_amount', v_total_alloc
    ));

    RETURN json_build_object(
        'success', true, 
        'message', 'پرداخت با موفقیت ثبت و تخصیص فاکتورها انجام شد.',
        'transaction_id', v_tx_id,
        'cheque_id', v_cheque_id,
        'total_allocated', v_total_alloc
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- بخش ۳: بازنویسی تابع admin_update_cheque_status جهت جلوگیری از Duplicate Effect
-- قفل رکورد و اجازه تغییر وضعیت صرفاً از حالت pending
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_update_cheque_status(
    p_cheque_id TEXT,
    p_status TEXT,
    p_reason TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_actor_role TEXT;
    v_actor_id TEXT;
    v_actor_name TEXT;
    v_chk RECORD;
BEGIN
    v_actor_role := public.app_role();
    v_actor_id := public.app_uid();

    IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RETURN json_build_object('success', false, 'message', 'تنها ادمین مجاز به تغییر وضعیت چک است.');
    END IF;

    -- قفل رکورد برای جلوگیری از Race Condition
    SELECT * INTO v_chk FROM public.cheques WHERE id = p_cheque_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'چک مورد نظر یافت نشد.');
    END IF;

    -- جلوگیری قطعی از اثر تکراری: تغییر وضعیت فقط و فقط از pending مجاز است
    IF v_chk.status != 'pending' THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'این چک قبلاً تعیین وضعیت شده است (وضعیت فعلی: ' || v_chk.status || ') و امکان تغییر وضعیت مجدد وجود ندارد.'
        );
    END IF;

    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    IF p_status = 'cleared' THEN
        UPDATE public.cheques
        SET status = 'cleared',
            cleared_at = NOW(),
            updated_at = NOW()
        WHERE id = p_cheque_id;

    ELSIF p_status = 'returned' THEN
        -- برگشت چک: ثبت دقیق بدهکاری معکوس یکباره
        UPDATE public.cheques
        SET status = 'returned',
            returned_at = NOW(),
            return_reason = p_reason,
            updated_at = NOW()
        WHERE id = p_cheque_id;

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
            v_chk.account_id,
            v_chk.profile_id,
            'cheque_return',
            'debit',
            v_chk.amount,
            v_chk.cheque_number,
            'برگشت چک شماره ' || v_chk.cheque_number || COALESCE(' - دلیل: ' || p_reason, ''),
            COALESCE(v_actor_name, 'مدیر سامانه')
        );

    ELSIF p_status = 'cancelled' THEN
        UPDATE public.cheques
        SET status = 'cancelled',
            description = COALESCE(description || ' - ', '') || 'ابطال: ' || COALESCE(p_reason, ''),
            updated_at = NOW()
        WHERE id = p_cheque_id;

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
            v_chk.account_id,
            v_chk.profile_id,
            'account_adjustment',
            'debit',
            v_chk.amount,
            v_chk.cheque_number,
            'ابطال چک شماره ' || v_chk.cheque_number,
            COALESCE(v_actor_name, 'مدیر سامانه')
        );
    ELSE
        RETURN json_build_object('success', false, 'message', 'وضعیت انتخابی نامعتبر است.');
    END IF;

    INSERT INTO public.financial_audit_logs (account_id, action, actor_id, actor_name, details)
    VALUES (v_chk.account_id, 'update_cheque_status', v_actor_id, COALESCE(v_actor_name, 'مدیر سامانه'), json_build_object(
        'cheque_id', p_cheque_id,
        'old_status', v_chk.status,
        'new_status', p_status,
        'reason', p_reason
    ));

    RETURN json_build_object('success', true, 'message', 'وضعیت چک با موفقیت به‌روزرسانی شد.', 'status', p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
