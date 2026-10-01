-- ==============================================================================
-- Migration: Warehouse Step Setting & System Audit Logging
-- File: supabase_migration_warehouse_step_setting.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure invoice_audit supports system-level settings logs (nullable invoice_id)
-- ------------------------------------------------------------------------------

ALTER TABLE public.invoice_audit ALTER COLUMN invoice_id DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. Stored Procedures for require_warehouse_step setting
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.set_warehouse_step_setting(BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.set_warehouse_step_setting(
    p_enabled BOOLEAN,
    p_actor TEXT
) RETURNS JSON AS $$
BEGIN
    INSERT INTO public.app_settings (key, value)
    VALUES ('require_warehouse_step', to_jsonb(p_enabled))
    ON CONFLICT (key) DO UPDATE
    SET value = to_jsonb(p_enabled);

    INSERT INTO public.invoice_audit (
        invoice_id,
        action,
        actor_name,
        details,
        created_at
    ) VALUES (
        NULL,
        'change_setting_require_warehouse_step',
        COALESCE(p_actor, 'ادمین'),
        json_build_object('require_warehouse_step', p_enabled),
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'تنظیم مرحله تایید انبار با موفقیت به‌روزرسانی شد.',
        'require_warehouse_step', p_enabled
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS public.get_warehouse_step_setting();

CREATE OR REPLACE FUNCTION public.get_warehouse_step_setting() 
RETURNS JSON AS $$
DECLARE
    v_val JSONB;
    v_enabled BOOLEAN;
BEGIN
    SELECT value INTO v_val FROM public.app_settings WHERE key = 'require_warehouse_step';
    v_enabled := COALESCE((v_val)::text = 'true' OR (v_val)::text = '"true"', false);

    RETURN json_build_object(
        'success', true,
        'require_warehouse_step', v_enabled
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM, 'require_warehouse_step', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
