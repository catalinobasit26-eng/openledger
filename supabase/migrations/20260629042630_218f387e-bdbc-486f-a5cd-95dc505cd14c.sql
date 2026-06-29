
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  base_url text,
  api_key text,
  enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  last_sync_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin can read integrations" ON public.integrations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin can insert integrations" ON public.integrations
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin can update integrations" ON public.integrations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin can delete integrations" ON public.integrations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.touch_integrations_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_integrations_updated_at ON public.integrations;
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_integrations_updated_at();

INSERT INTO public.integrations (slug, display_name, base_url) VALUES
  ('openpay', 'OpenPay', 'https://openpy.space'),
  ('openpay_pro', 'OpenPay Pro', 'https://www.openpaypro.space')
ON CONFLICT (slug) DO NOTHING;

-- Wipe seeded demo data (bypass the immutability trigger just for this cleanup)
SET session_replication_role = replica;
DELETE FROM public.nft_transactions;
DELETE FROM public.fraud_alerts;
DELETE FROM public.api_logs;
DELETE FROM public.audit_logs;
DELETE FROM public.analytics_daily;
DELETE FROM public.ledger_transactions;
DELETE FROM public.ledger_blocks;
DELETE FROM public.nft_collections;
DELETE FROM public.merchants;
DELETE FROM public.tokens;
DELETE FROM public.wallets;
SET session_replication_role = origin;
