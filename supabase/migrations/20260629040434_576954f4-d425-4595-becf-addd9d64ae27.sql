
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'auditor', 'support');
CREATE TYPE public.tx_status AS ENUM ('pending', 'confirmed', 'failed', 'reversed');
CREATE TYPE public.tx_type AS ENUM ('payment', 'transfer', 'swap', 'nft_mint', 'nft_sale', 'merchant_payment', 'withdrawal', 'deposit', 'refund');
CREATE TYPE public.source_platform AS ENUM ('openpay', 'openpay_pro');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================================================
-- USER ROLES (separate table — never on profiles)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- AUTO PROFILE + SUPER ADMIN BOOTSTRAP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'mrwainorganization@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.grant_super_admin_on_verify()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'mrwainorganization@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_verified
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_super_admin_on_verify();

-- =========================================================
-- LEDGER BLOCKS
-- =========================================================
CREATE TABLE public.ledger_blocks (
  block_number BIGSERIAL PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  previous_hash TEXT NOT NULL,
  tx_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ledger_blocks TO anon, authenticated;
GRANT ALL ON public.ledger_blocks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ledger_blocks_block_number_seq TO service_role;
ALTER TABLE public.ledger_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_blocks_public_read" ON public.ledger_blocks FOR SELECT TO anon, authenticated USING (true);

-- =========================================================
-- LEDGER TRANSACTIONS
-- =========================================================
CREATE TABLE public.ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash TEXT NOT NULL UNIQUE,
  previous_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL REFERENCES public.ledger_blocks(block_number),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  source public.source_platform NOT NULL,
  type public.tx_type NOT NULL,
  from_address TEXT,
  to_address TEXT,
  amount NUMERIC(38, 18) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'OUSD',
  network_fee NUMERIC(38, 18) NOT NULL DEFAULT 0,
  status public.tx_status NOT NULL DEFAULT 'confirmed',
  merchant_id TEXT,
  external_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ledger_transactions TO anon, authenticated;
GRANT ALL ON public.ledger_transactions TO service_role;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_tx_public_read" ON public.ledger_transactions FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX idx_ledger_tx_hash ON public.ledger_transactions(hash);
CREATE INDEX idx_ledger_tx_from ON public.ledger_transactions(from_address);
CREATE INDEX idx_ledger_tx_to ON public.ledger_transactions(to_address);
CREATE INDEX idx_ledger_tx_merchant ON public.ledger_transactions(merchant_id);
CREATE INDEX idx_ledger_tx_ts ON public.ledger_transactions(ts DESC);
CREATE INDEX idx_ledger_tx_source ON public.ledger_transactions(source);
CREATE INDEX idx_ledger_tx_type ON public.ledger_transactions(type);
CREATE INDEX idx_ledger_tx_currency ON public.ledger_transactions(currency);

-- Immutability: block direct UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable';
END;
$$;
CREATE TRIGGER ledger_tx_no_update BEFORE UPDATE ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();
CREATE TRIGGER ledger_tx_no_delete BEFORE DELETE ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();
CREATE TRIGGER ledger_blocks_no_update BEFORE UPDATE ON public.ledger_blocks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();
CREATE TRIGGER ledger_blocks_no_delete BEFORE DELETE ON public.ledger_blocks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

-- =========================================================
-- HASH CHAIN INGEST FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.record_transaction(
  p_source public.source_platform,
  p_type public.tx_type,
  p_from TEXT,
  p_to TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_fee NUMERIC DEFAULT 0,
  p_status public.tx_status DEFAULT 'confirmed',
  p_merchant_id TEXT DEFAULT NULL,
  p_external_ref TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ts TIMESTAMPTZ DEFAULT now()
)
RETURNS public.ledger_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prev_hash TEXT;
  v_block BIGINT;
  v_hash TEXT;
  v_payload TEXT;
  v_tx public.ledger_transactions;
BEGIN
  SELECT hash INTO v_prev_hash FROM public.ledger_blocks ORDER BY block_number DESC LIMIT 1;
  IF v_prev_hash IS NULL THEN
    v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
  END IF;

  v_payload := COALESCE(p_source::text,'') || '|' || COALESCE(p_type::text,'') || '|'
            || COALESCE(p_from,'') || '|' || COALESCE(p_to,'') || '|'
            || COALESCE(p_amount::text,'0') || '|' || COALESCE(p_currency,'') || '|'
            || COALESCE(p_fee::text,'0') || '|' || COALESCE(p_status::text,'') || '|'
            || COALESCE(p_merchant_id,'') || '|' || COALESCE(p_external_ref,'') || '|'
            || COALESCE(p_metadata::text,'{}') || '|' || p_ts::text || '|' || v_prev_hash;
  v_hash := encode(digest(v_payload, 'sha256'), 'hex');

  INSERT INTO public.ledger_blocks (hash, previous_hash, tx_count)
  VALUES (v_hash, v_prev_hash, 1)
  RETURNING block_number INTO v_block;

  INSERT INTO public.ledger_transactions (
    hash, previous_hash, block_number, ts, source, type,
    from_address, to_address, amount, currency, network_fee,
    status, merchant_id, external_ref, metadata, verified
  ) VALUES (
    v_hash, v_prev_hash, v_block, p_ts, p_source, p_type,
    p_from, p_to, p_amount, p_currency, COALESCE(p_fee,0),
    p_status, p_merchant_id, p_external_ref, COALESCE(p_metadata,'{}'::jsonb), true
  ) RETURNING * INTO v_tx;

  -- Touch wallet stats
  IF p_from IS NOT NULL THEN
    INSERT INTO public.wallets (address, tx_count, last_seen, first_seen)
    VALUES (p_from, 1, p_ts, p_ts)
    ON CONFLICT (address) DO UPDATE SET tx_count = public.wallets.tx_count + 1, last_seen = GREATEST(public.wallets.last_seen, p_ts);
  END IF;
  IF p_to IS NOT NULL AND p_to <> COALESCE(p_from,'') THEN
    INSERT INTO public.wallets (address, tx_count, last_seen, first_seen)
    VALUES (p_to, 1, p_ts, p_ts)
    ON CONFLICT (address) DO UPDATE SET tx_count = public.wallets.tx_count + 1, last_seen = GREATEST(public.wallets.last_seen, p_ts);
  END IF;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.record_transaction(public.source_platform, public.tx_type, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, public.tx_status, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_transaction(public.source_platform, public.tx_type, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, public.tx_status, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;

-- =========================================================
-- WALLETS
-- =========================================================
CREATE TABLE public.wallets (
  address TEXT PRIMARY KEY,
  label TEXT,
  balance NUMERIC(38,18) NOT NULL DEFAULT 0,
  tx_count INT NOT NULL DEFAULT 0,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO anon, authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_public_read" ON public.wallets FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX idx_wallets_last_seen ON public.wallets(last_seen DESC);

-- =========================================================
-- MERCHANTS
-- =========================================================
CREATE TABLE public.merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  total_sales INT NOT NULL DEFAULT 0,
  total_volume NUMERIC(38,18) NOT NULL DEFAULT 0,
  tx_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.merchants TO anon, authenticated;
GRANT ALL ON public.merchants TO service_role;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchants_public_read" ON public.merchants FOR SELECT TO anon, authenticated USING (true);

-- =========================================================
-- TOKENS
-- =========================================================
CREATE TABLE public.tokens (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  decimals INT NOT NULL DEFAULT 18,
  price_usd NUMERIC(38,8) NOT NULL DEFAULT 0,
  change_24h NUMERIC(10,4) NOT NULL DEFAULT 0,
  supply NUMERIC(38,18) NOT NULL DEFAULT 0,
  holders INT NOT NULL DEFAULT 0,
  volume_24h NUMERIC(38,18) NOT NULL DEFAULT 0,
  transfers_count BIGINT NOT NULL DEFAULT 0,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tokens TO anon, authenticated;
GRANT ALL ON public.tokens TO service_role;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_public_read" ON public.tokens FOR SELECT TO anon, authenticated USING (true);

-- =========================================================
-- NFT COLLECTIONS + TRANSACTIONS
-- =========================================================
CREATE TABLE public.nft_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  creator_address TEXT,
  total_supply INT NOT NULL DEFAULT 0,
  owners INT NOT NULL DEFAULT 0,
  floor_price NUMERIC(38,18) NOT NULL DEFAULT 0,
  volume NUMERIC(38,18) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nft_collections TO anon, authenticated;
GRANT ALL ON public.nft_collections TO service_role;
ALTER TABLE public.nft_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_collections_public_read" ON public.nft_collections FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.nft_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES public.nft_collections(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  price NUMERIC(38,18) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'OUSD',
  tx_hash TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nft_transactions TO anon, authenticated;
GRANT ALL ON public.nft_transactions TO service_role;
ALTER TABLE public.nft_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_tx_public_read" ON public.nft_transactions FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX idx_nft_tx_collection ON public.nft_transactions(collection_id);
CREATE INDEX idx_nft_tx_token ON public.nft_transactions(token_id);
CREATE INDEX idx_nft_tx_ts ON public.nft_transactions(ts DESC);

-- =========================================================
-- ANALYTICS DAILY
-- =========================================================
CREATE TABLE public.analytics_daily (
  day DATE PRIMARY KEY,
  transactions INT NOT NULL DEFAULT 0,
  volume NUMERIC(38,18) NOT NULL DEFAULT 0,
  new_users INT NOT NULL DEFAULT 0,
  new_merchants INT NOT NULL DEFAULT 0,
  nft_sales INT NOT NULL DEFAULT 0,
  swaps INT NOT NULL DEFAULT 0,
  openpay_tx INT NOT NULL DEFAULT 0,
  openpaypro_tx INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.analytics_daily TO anon, authenticated;
GRANT ALL ON public.analytics_daily TO service_role;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_public_read" ON public.analytics_daily FOR SELECT TO anon, authenticated USING (true);

-- =========================================================
-- ADMIN-ONLY: AUDIT LOGS, API LOGS, FRAUD ALERTS, API KEYS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_staff_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TABLE public.api_logs (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status INT NOT NULL,
  ip TEXT,
  latency_ms INT,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_logs TO authenticated;
GRANT ALL ON public.api_logs TO service_role;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_logs_staff_read" ON public.api_logs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE INDEX idx_api_logs_created ON public.api_logs(created_at DESC);

CREATE TABLE public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_hash TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.fraud_alerts TO authenticated;
GRANT ALL ON public.fraud_alerts TO service_role;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraud_alerts_staff_read" ON public.fraud_alerts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "fraud_alerts_staff_update" ON public.fraud_alerts FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_admin_read" ON public.api_keys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "api_keys_admin_insert" ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "api_keys_admin_update" ON public.api_keys FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_alerts;
