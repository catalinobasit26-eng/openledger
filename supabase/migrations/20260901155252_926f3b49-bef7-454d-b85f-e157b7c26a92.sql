revoke execute on function public.trg_refresh_analytics_daily_stmt() from anon, authenticated, public;
drop function if exists public.trg_refresh_analytics_daily() cascade;