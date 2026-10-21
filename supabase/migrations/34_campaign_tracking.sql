-- =========================================================================
-- Migration: 34_campaign_tracking.sql
-- Description: Traffic & Registration Tracking (campaign_clicks & supermarket source)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.campaign_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'direct',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.campaign_clicks ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon and authenticated) to insert click logs
DROP POLICY IF EXISTS "campaign_clicks_insert_policy" ON public.campaign_clicks;
CREATE POLICY "campaign_clicks_insert_policy" ON public.campaign_clicks
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow authenticated users to view click logs
DROP POLICY IF EXISTS "campaign_clicks_select_policy" ON public.campaign_clicks;
CREATE POLICY "campaign_clicks_select_policy" ON public.campaign_clicks
  FOR SELECT TO authenticated
  USING (true);

GRANT ALL ON TABLE public.campaign_clicks TO anon, authenticated, service_role;

-- Ensure supermarkets table has registration_source column
ALTER TABLE public.supermarkets ADD COLUMN IF NOT EXISTS registration_source text DEFAULT 'direct';

-- Ensure authenticated supermarket users can update their own registration_source
DROP POLICY IF EXISTS "supermarkets_update_policy" ON public.supermarkets;
CREATE POLICY "supermarkets_update_policy" ON public.supermarkets
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
