-- =========================================================================
-- Migration: 26_enforce_vs_invoice_numbers.sql
-- Description: Unconditionally rewrite any lingering legacy F- or BL- invoice_no
--              in loading_bills to the unified standard format VS{code}-{seq}-{subseq}.
-- =========================================================================

DO $$
DECLARE
    r RECORD;
    v_new_no TEXT;
BEGIN
    FOR r IN 
        SELECT id, visitor_id, invoice_no 
        FROM public.loading_bills 
        WHERE invoice_no IS NULL 
           OR invoice_no LIKE 'F-%' 
           OR invoice_no LIKE 'BL-%'
           OR id LIKE 'BL-%'
    LOOP
        IF r.id LIKE 'VS%' THEN
            v_new_no := r.id;
        ELSE
            v_new_no := public.next_loading_bill_number(r.visitor_id);
        END IF;

        UPDATE public.loading_bills 
        SET invoice_no = v_new_no
        WHERE id = r.id;
    END LOOP;
END;
$$;
