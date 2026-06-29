
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
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
  v_hash := encode(extensions.digest(v_payload::bytea, 'sha256'), 'hex');

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

REVOKE ALL ON FUNCTION public.record_transaction(public.source_platform, public.tx_type, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, public.tx_status, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_transaction(public.source_platform, public.tx_type, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, public.tx_status, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;
