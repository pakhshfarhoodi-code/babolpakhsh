-- =========================================================================
-- Migration: 18_financial_accounts.sql
-- Description: سیستم جامع حساب دفتری، گردش‌های مالی، مدیریت چک و تخصیص پرداخت‌ها
-- =========================================================================

-- =========================================================================
-- بلوک ۱: جدول حساب‌های دفتری (financial_accounts)
-- متصل به profiles و بدون محدودیت روی نقش خاص (ویزیتور، سوپرمارکت و...)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_number TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    credit_limit NUMERIC NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    currency TEXT NOT NULL DEFAULT 'تومان',
    notes TEXT,
    activated_at TIMESTAMPTZ,
    activated_by TEXT,
    deactivated_at TIMESTAMPTZ,
    deactivated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_profile_financial_account UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_profile ON public.financial_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_active ON public.financial_accounts(is_active);

-- =========================================================================
-- بلوک ۲: جدول گردش‌های مالی (account_transactions)
-- دفتر روزنامه / ژورنال مالی - منبع اصلی حقیقت (Source of Truth)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    account_id TEXT NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK (
        transaction_type IN (
            'invoice_debt',       -- بدهی ناشی از فاکتور
            'cash_payment',       -- پرداخت نقدی
            'bank_transfer',      -- پرداخت غیرنقدی / کارت‌به‌کارت / حواله
            'cheque_payment',     -- پرداخت با چک
            'manual_debit',       -- افزایش دستی بدهی
            'manual_credit',      -- افزایش دستی بستانکاری
            'refund',             -- برگشت وجه
            'cheque_return',      -- برگشت چک
            'account_adjustment', -- اصلاح حساب
            'opening_balance'     -- مانده اولیه
        )
    ),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    -- debit: افزایش بدهی کاربر به شرکت (بدهکار)
    -- credit: کاهش بدهی کاربر / پرداخت (بستانکار)
    amount NUMERIC NOT NULL CHECK (amount > 0),
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reference_id TEXT, -- شماره پیگیری فیش بانکی، شماره سند و...
    reference_invoice_id TEXT REFERENCES public.loading_bills(id) ON DELETE SET NULL,
    reference_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by TEXT, -- شناسه کاربر ثبت‌کننده
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_tx_account ON public.account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_tx_profile ON public.account_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_account_tx_date ON public.account_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_account_tx_invoice ON public.account_transactions(reference_invoice_id);
CREATE INDEX IF NOT EXISTS idx_account_tx_type ON public.account_transactions(transaction_type);

-- جلوگیری از ثبت بدهی تکراری برای یک فاکتور
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_invoice_debt 
    ON public.account_transactions (account_id, reference_invoice_id) 
    WHERE (transaction_type = 'invoice_debt' AND reference_invoice_id IS NOT NULL);

-- =========================================================================
-- بلوک ۳: جدول چک‌های دریافتی / واگذارشده (cheques)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cheques (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    account_id TEXT NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    transaction_id TEXT REFERENCES public.account_transactions(id) ON DELETE SET NULL,
    invoice_id TEXT REFERENCES public.loading_bills(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    cheque_number TEXT NOT NULL,
    sayad_number TEXT, -- شناسه صیادی ۱۶ رقمی
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    account_owner TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'cleared', 'returned', 'cancelled')
    ),
    description TEXT,
    cleared_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    return_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cheques_account ON public.cheques(account_id);
CREATE INDEX IF NOT EXISTS idx_cheques_due_date ON public.cheques(due_date);
CREATE INDEX IF NOT EXISTS idx_cheques_status ON public.cheques(status);
CREATE INDEX IF NOT EXISTS idx_cheques_number ON public.cheques(cheque_number);

-- =========================================================================
-- بلوک ۴: جدول تخصیص پرداخت‌ها به فاکتورها (payment_allocations)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transaction_id TEXT NOT NULL REFERENCES public.account_transactions(id) ON DELETE CASCADE,
    invoice_type TEXT NOT NULL DEFAULT 'loading_bill' CHECK (invoice_type IN ('loading_bill', 'order')),
    invoice_id TEXT NOT NULL,
    allocated_amount NUMERIC NOT NULL CHECK (allocated_amount > 0),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_tx ON public.payment_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON public.payment_allocations(invoice_id);

-- =========================================================================
-- بلوک ۵: جدول تاریخچه حسابرسی عملیات مالی (financial_audit_logs)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    account_id TEXT REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_account ON public.financial_audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_created ON public.financial_audit_logs(created_at DESC);

-- =========================================================================
-- بلوک ۶: ویوهای محاسباتی (Views)
-- =========================================================================

-- ۶.۱ خلاصه مانده کل حساب‌ها بر اساس گردش‌های واقعی
CREATE OR REPLACE VIEW public.v_financial_account_summaries AS
SELECT 
    fa.id AS account_id,
    fa.profile_id,
    p.name AS profile_name,
    p.role AS profile_role,
    p.phone AS profile_phone,
    fa.account_number,
    fa.is_active,
    fa.credit_limit,
    COALESCE(SUM(CASE WHEN tx.entry_type = 'debit' THEN tx.amount ELSE 0 END), 0) AS total_debit,
    COALESCE(SUM(CASE WHEN tx.entry_type = 'credit' THEN tx.amount ELSE 0 END), 0) AS total_credit,
    -- مانده کل: مثبت یعنی شخص بدهکار است؛ منفی یعنی طلبکار است
    COALESCE(SUM(CASE WHEN tx.entry_type = 'debit' THEN tx.amount ELSE -tx.amount END), 0) AS current_balance,
    COUNT(tx.id) AS transactions_count,
    MAX(tx.transaction_date) AS last_transaction_at
FROM public.financial_accounts fa
JOIN public.profiles p ON p.id = fa.profile_id
LEFT JOIN public.account_transactions tx ON tx.account_id = fa.id
GROUP BY fa.id, fa.profile_id, p.name, p.role, p.phone, fa.account_number, fa.is_active, fa.credit_limit;

-- ۶.۲ خلاصه تسویه و معوق هر فاکتور به تفکیک
CREATE OR REPLACE VIEW public.v_invoice_payment_summaries AS
SELECT 
    lb.id AS invoice_id,
    lb.invoice_no,
    lb.visitor_id,
    lb.visitor_name,
    lb.status AS invoice_status,
    lb.total_visitor_cost AS invoice_total,
    COALESCE(SUM(pa.allocated_amount), 0) AS total_allocated_paid,
    -- معوق همان فاکتور
    GREATEST(0, COALESCE(lb.total_visitor_cost, 0) - COALESCE(SUM(pa.allocated_amount), 0)) AS remaining_due,
    CASE 
        WHEN COALESCE(SUM(pa.allocated_amount), 0) >= COALESCE(lb.total_visitor_cost, 0) AND COALESCE(lb.total_visitor_cost, 0) > 0 THEN 'settled'
        WHEN COALESCE(SUM(pa.allocated_amount), 0) > 0 THEN 'partially_paid'
        ELSE 'unpaid'
    END AS settlement_status
FROM public.loading_bills lb
LEFT JOIN public.payment_allocations pa ON pa.invoice_id = lb.id AND pa.invoice_type = 'loading_bill'
GROUP BY lb.id, lb.invoice_no, lb.visitor_id, lb.visitor_name, lb.status, lb.total_visitor_cost;

-- =========================================================================
-- بلوک ۷: رویه‌های امن ذخیره‌شده (SECURITY DEFINER RPCs)
-- =========================================================================

-- ۷.۱ فعال‌سازی / ایجاد حساب دفتری توسط ادمین
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

    INSERT INTO public.financial_audit_logs (account_id, action, actor_id, actor_name, details)
    VALUES (v_acc_id, 'activate_account', v_actor_id, v_actor_name, json_build_object(
        'profile_id', p_profile_id,
        'profile_name', v_profile.name,
        'credit_limit', p_credit_limit
    ));

    RETURN json_build_object('success', true, 'message', 'حساب دفتری کاربر با موفقیت فعال شد.', 'account_id', v_acc_id, 'account_number', v_acc_no);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ۷.۲ غیرفعال‌سازی حساب دفتری (بدون حذف هیچ سابقه‌ای)
CREATE OR REPLACE FUNCTION public.admin_deactivate_financial_account(
    p_account_id TEXT,
    p_reason TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_actor_role TEXT;
    v_actor_id TEXT;
    v_actor_name TEXT;
BEGIN
    v_actor_role := public.app_role();
    v_actor_id := public.app_uid();

    IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RETURN json_build_object('success', false, 'message', 'تنها ادمین مجاز به تغییر وضعیت حساب دفتری است.');
    END IF;

    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    UPDATE public.financial_accounts
    SET is_active = false,
        deactivated_at = NOW(),
        deactivated_by = COALESCE(v_actor_name, 'مدیر سامانه'),
        notes = CASE WHEN p_reason IS NOT NULL THEN COALESCE(notes || E'\n', '') || 'دلیل غیرفعال‌سازی: ' || p_reason ELSE notes END,
        updated_at = NOW()
    WHERE id = p_account_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'حساب دفتری مورد نظر یافت نشد.');
    END IF;

    INSERT INTO public.financial_audit_logs (account_id, action, actor_id, actor_name, details)
    VALUES (p_account_id, 'deactivate_account', v_actor_id, COALESCE(v_actor_name, 'مدیر سامانه'), json_build_object('reason', p_reason));

    RETURN json_build_object('success', true, 'message', 'حساب دفتری با حفظ کلیه سوابق قبلی با موفقیت غیرفعال شد.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ۷.۳ ثبت پرداخت نقدی، بانکی، چک و تخصیص به فاکتورها
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
    v_total_alloc NUMERIC := 0;
BEGIN
    v_actor_role := public.app_role();
    v_actor_id := public.app_uid();

    IF v_actor_role IS DISTINCT FROM 'admin' THEN
        RETURN json_build_object('success', false, 'message', 'تنها ادمین سامانه مجاز به ثبت دریافت و پرداخت است.');
    END IF;

    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'مبلغ پرداخت باید بزرگتر از صفر باشد.');
    END IF;

    IF p_payment_type NOT IN ('cash_payment', 'bank_transfer', 'cheque_payment') THEN
        RETURN json_build_object('success', false, 'message', 'نوع روش پرداخت نامعتبر است.');
    END IF;

    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    SELECT * INTO v_acc FROM public.financial_accounts WHERE profile_id = p_profile_id;
    IF NOT FOUND OR v_acc.is_active = false THEN
        RETURN json_build_object('success', false, 'message', 'این کاربر حساب دفتری فعال ندارد. ثبت تراکنش برای حساب غیرفعال امکان‌پذیر نیست.');
    END IF;

    -- ۱. ثبت تراکنش اصلی در دفتر مالی (بستانکار / credit)
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

    -- ۲. اگر پرداخت از نوع چک است، درج در جدول cheques
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

    -- ۳. پردازش تخصیص پرداخت به فاکتورها (Payment Allocations)
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(invoice_id TEXT, amount NUMERIC) LOOP
            IF v_alloc.amount > 0 AND v_alloc.invoice_id IS NOT NULL THEN
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
                v_total_alloc := v_total_alloc + v_alloc.amount;
            END IF;
        END LOOP;
    END IF;

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
        'message', 'پرداخت با موفقیت ثبت و در دفتر حساب منظور شد.',
        'transaction_id', v_tx_id,
        'cheque_id', v_cheque_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ۷.۴ تغییر وضعیت چک (وصول / برگشت / ابطال)
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

    SELECT * INTO v_chk FROM public.cheques WHERE id = p_cheque_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'چک مورد نظر یافت نشد.');
    END IF;

    IF v_chk.status = p_status THEN
        RETURN json_build_object('success', false, 'message', 'چک در حال حاضر در همین وضعیت قرار دارد.');
    END IF;

    SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    IF p_status = 'cleared' THEN
        UPDATE public.cheques
        SET status = 'cleared',
            cleared_at = NOW(),
            updated_at = NOW()
        WHERE id = p_cheque_id;

    ELSIF p_status = 'returned' THEN
        -- چک برگشت خورده: بدهی مجدداً به حساب شخص بازگردانده می‌شود (debit)
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
        RETURN json_build_object('success', false, 'message', 'وضعیت چک نامعتبر است.');
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

-- ۷.۵ عملیات افزایش دستی بدهی، ثبت بستانکاری، مانده اولیه و اصلاح حساب
CREATE OR REPLACE FUNCTION public.admin_manual_financial_entry(
    p_profile_id TEXT,
    p_type TEXT,
    p_amount NUMERIC,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL
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

    IF p_type IN ('manual_debit', 'refund') THEN
        v_entry_type := 'debit';
    ELSIF p_type IN ('manual_credit') THEN
        v_entry_type := 'credit';
    ELSIF p_type = 'opening_balance' THEN
        v_entry_type := 'debit';
    ELSIF p_type = 'account_adjustment' THEN
        v_entry_type := 'debit';
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

    RETURN json_build_object('success', true, 'message', 'تراکنش با موفقیت در دفتر حساب ثبت شد.', 'transaction_id', v_tx_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- بلوک ۸: تنظیمات امنیتی RLS (Row Level Security) و دسترسی‌ها
-- =========================================================================

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- ۸.۱ جدول حساب‌ها (financial_accounts)
DROP POLICY IF EXISTS "financial_accounts_select_policy" ON public.financial_accounts;
CREATE POLICY "financial_accounts_select_policy" ON public.financial_accounts
    FOR SELECT TO authenticated
    USING (
        public.app_role() IN ('admin', 'superadmin') OR 
        profile_id = public.app_uid()
    );

DROP POLICY IF EXISTS "financial_accounts_admin_manage" ON public.financial_accounts;
CREATE POLICY "financial_accounts_admin_manage" ON public.financial_accounts
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- ۸.۲ جدول گردش‌های مالی (account_transactions)
DROP POLICY IF EXISTS "account_transactions_select_policy" ON public.account_transactions;
CREATE POLICY "account_transactions_select_policy" ON public.account_transactions
    FOR SELECT TO authenticated
    USING (
        public.app_role() IN ('admin', 'superadmin') OR 
        profile_id = public.app_uid()
    );

DROP POLICY IF EXISTS "account_transactions_admin_write" ON public.account_transactions;
CREATE POLICY "account_transactions_admin_write" ON public.account_transactions
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- ۸.۳ جدول چک‌ها (cheques)
DROP POLICY IF EXISTS "cheques_select_policy" ON public.cheques;
CREATE POLICY "cheques_select_policy" ON public.cheques
    FOR SELECT TO authenticated
    USING (
        public.app_role() IN ('admin', 'superadmin') OR 
        profile_id = public.app_uid()
    );

DROP POLICY IF EXISTS "cheques_admin_manage" ON public.cheques;
CREATE POLICY "cheques_admin_manage" ON public.cheques
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- ۸.۴ جدول تخصیص پرداخت‌ها (payment_allocations)
DROP POLICY IF EXISTS "allocations_select_policy" ON public.payment_allocations;
CREATE POLICY "allocations_select_policy" ON public.payment_allocations
    FOR SELECT TO authenticated
    USING (
        public.app_role() IN ('admin', 'superadmin') OR
        EXISTS (
            SELECT 1 FROM public.account_transactions tx
            WHERE tx.id = payment_allocations.transaction_id AND tx.profile_id = public.app_uid()
        )
    );

DROP POLICY IF EXISTS "allocations_admin_manage" ON public.payment_allocations;
CREATE POLICY "allocations_admin_manage" ON public.payment_allocations
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- ۸.۵ لاگ‌های حسابرسی مالی (financial_audit_logs)
DROP POLICY IF EXISTS "financial_audit_admin_only" ON public.financial_audit_logs;
CREATE POLICY "financial_audit_admin_only" ON public.financial_audit_logs
    FOR ALL TO authenticated
    USING (public.app_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.app_role() IN ('admin', 'superadmin'));

-- مجوزهای RPC
REVOKE EXECUTE ON FUNCTION public.admin_activate_financial_account(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activate_financial_account(TEXT, NUMERIC, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_deactivate_financial_account(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_financial_account(TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_record_payment(TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_payment(TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_cheque_status(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_cheque_status(TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_manual_financial_entry(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manual_financial_entry(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
