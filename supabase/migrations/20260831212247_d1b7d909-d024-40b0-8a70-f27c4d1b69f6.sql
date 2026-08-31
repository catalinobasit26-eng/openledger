CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_tx', COALESCE((SELECT SUM(transactions) FROM public.analytics_daily), 0),
    'total_volume', COALESCE((SELECT SUM(volume) FROM public.analytics_daily), 0),
    'total_wallets', COALESCE((SELECT COUNT(*) FROM public.wallets), 0),
    'nft_sales', COALESCE((SELECT SUM(nft_sales) FROM public.analytics_daily), 0),
    'swaps', COALESCE((SELECT SUM(swaps) FROM public.analytics_daily), 0),
    'openpay', COALESCE((SELECT SUM(openpay_tx) FROM public.analytics_daily), 0),
    'openpay_pro', COALESCE((SELECT SUM(openpaypro_tx) FROM public.analytics_daily), 0),
    'stakes', COALESCE((SELECT COUNT(*) FROM public.ledger_transactions WHERE type = 'stake'), 0),
    'type_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', t.type, 'value', t.c) ORDER BY t.c DESC)
      FROM (SELECT type::text AS type, COUNT(*) AS c FROM public.ledger_transactions GROUP BY type) t
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO anon, authenticated, service_role;