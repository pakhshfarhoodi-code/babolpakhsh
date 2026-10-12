-- =========================================================================
-- Migration: Admin Update Customer RPC & Relaxed RLS Policies
-- Execute this SQL script in your Supabase SQL Editor to fix admin user/supermarket profile editing.
-- =========================================================================

-- 1. Create secure SECURITY DEFINER function for admin updates
CREATE OR REPLACE FUNCTION public.admin_update_customer(
  p_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_owner TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_assigned_visitor_id TEXT DEFAULT NULL,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update supermarkets table if record exists
  IF EXISTS (SELECT 1 FROM public.supermarkets WHERE id = p_id) THEN
    UPDATE public.supermarkets
    SET 
      name = COALESCE(p_name, name),
      owner = COALESCE(p_owner, owner),
      phone = COALESCE(p_phone, phone),
      address = COALESCE(p_address, address),
      is_active = COALESCE(p_is_active, is_active),
      assigned_visitor_id = CASE WHEN p_assigned_visitor_id = 'direct' THEN NULL ELSE COALESCE(p_assigned_visitor_id, assigned_visitor_id) END,
      admin_note = COALESCE(p_admin_note, admin_note),
      updated_at = NOW()
    WHERE id = p_id;
  END IF;

  -- Update profiles table if record exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_id) THEN
    UPDATE public.profiles
    SET 
      name = COALESCE(p_name, name),
      phone = COALESCE(p_phone, phone),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = NOW()
    WHERE id = p_id;
  END IF;

  -- Update visitors table if record exists
  IF EXISTS (SELECT 1 FROM public.visitors WHERE id = p_id) THEN
    UPDATE public.visitors
    SET 
      name = COALESCE(p_name, name),
      phone = COALESCE(p_phone, phone),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = NOW()
    WHERE id = p_id;
  END IF;

  RETURN json_build_object('success', true, 'message', 'ویرایش اطلاعات با موفقیت در پایگاه داده ثبت شد.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_customer TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_customer TO anon;

-- 2. Ensure RLS policies on supermarkets, profiles, and visitors allow authenticated updates
DROP POLICY IF EXISTS "supermarkets_write_policy" ON public.supermarkets;
CREATE POLICY "supermarkets_write_policy" ON public.supermarkets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;
CREATE POLICY "Admin full access profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Visitors write policy" ON public.visitors;
CREATE POLICY "Visitors write policy" ON public.visitors
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
