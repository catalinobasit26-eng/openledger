
CREATE OR REPLACE FUNCTION public.refresh_analytics_daily(_day date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.analytics_daily AS a (day, transactions, volume, nft_sales, swaps, openpay_tx, openpaypro_tx)
  SELECT
    _day,
    COUNT(*)::int,
    COALESCE(SUM(amount), 0),
    COUNT(*) FILTER (WHERE type = 'nft_sale')::int,
    COUNT(*) FILTER (WHERE type = 'swap')::int,
    COUNT(*) FILTER (WHERE source = 'openpay')::int,
    COUNT(*) FILTER (WHERE source = 'openpay_pro')::int
  FROM public.ledger_transactions
  WHERE (ts AT TIME ZONE 'UTC')::date = _day
  ON CONFLICT (day) DO UPDATE SET
    transactions = EXCLUDED.transactions,
    volume = EXCLUDED.volume,
    nft_sales = EXCLUDED.nft_sales,
    swaps = EXCLUDED.swaps,
    openpay_tx = EXCLUDED.openpay_tx,
    openpaypro_tx = EXCLUDED.openpaypro_tx;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_analytics_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_analytics_daily(((COALESCE(NEW.ts, OLD.ts)) AT TIME ZONE 'UTC')::date);
  IF TG_OP = 'UPDATE' AND (OLD.ts AT TIME ZONE 'UTC')::date <> (NEW.ts AT TIME ZONE 'UTC')::date THEN
    PERFORM public.refresh_analytics_daily((OLD.ts AT TIME ZONE 'UTC')::date);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ledger_tx_analytics_refresh ON public.ledger_transactions;
CREATE TRIGGER ledger_tx_analytics_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.ledger_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_analytics_daily();

-- Backfill all existing days
DO $$
DECLARE d date;
BEGIN
  FOR d IN SELECT DISTINCT (ts AT TIME ZONE 'UTC')::date FROM public.ledger_transactions LOOP
    PERFORM public.refresh_analytics_daily(d);
  END LOOP;
END $$;
