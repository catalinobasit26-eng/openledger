
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_daily(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_refresh_analytics_daily() FROM PUBLIC, anon, authenticated;
