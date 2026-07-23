-- Count currency-conversion notes (Paid X CUR1 → Y CUR2) as swaps in daily analytics.
-- OpenPay often labels these category=other while the note carries the conversion.

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
    COUNT(*) FILTER (
      WHERE type = 'swap'
         OR (
           COALESCE(metadata->>'note', '') ~ 'Paid[[:space:]]+[0-9,.]+[[:space:]]+[A-Za-z]+[[:space:]]*(→|->)[[:space:]]*[0-9,.]+[[:space:]]+[A-Za-z]+'
           AND upper((regexp_match(COALESCE(metadata->>'note', ''), 'Paid[[:space:]]+[0-9,.]+[[:space:]]+([A-Za-z]+)[[:space:]]*(?:→|->)[[:space:]]*[0-9,.]+[[:space:]]+([A-Za-z]+)'))[1])
            <> upper((regexp_match(COALESCE(metadata->>'note', ''), 'Paid[[:space:]]+[0-9,.]+[[:space:]]+([A-Za-z]+)[[:space:]]*(?:→|->)[[:space:]]*[0-9,.]+[[:space:]]+([A-Za-z]+)'))[2])
         )
    )::int,
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

-- Backfill analytics so dashboard/analytics reflect existing conversion notes
DO $$
DECLARE d date;
BEGIN
  FOR d IN SELECT DISTINCT (ts AT TIME ZONE 'UTC')::date FROM public.ledger_transactions LOOP
    PERFORM public.refresh_analytics_daily(d);
  END LOOP;
END $$;
