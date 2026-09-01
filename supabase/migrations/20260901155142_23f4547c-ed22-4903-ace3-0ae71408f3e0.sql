-- 1. Slow down the auto-sync so the database is not hammered every minute
select cron.alter_job(1, schedule => '*/10 * * * *');

-- 2. Replace the per-row analytics trigger (which re-aggregated a full day
--    for EVERY inserted row) with a per-statement trigger.
drop trigger if exists ledger_tx_analytics_refresh on public.ledger_transactions;

create or replace function public.trg_refresh_analytics_daily_stmt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare d date;
begin
  for d in select distinct (ts at time zone 'utc')::date from new_rows loop
    perform public.refresh_analytics_daily(d);
  end loop;
  return null;
end;
$$;

create trigger ledger_tx_analytics_refresh_stmt
after insert on public.ledger_transactions
referencing new table as new_rows
for each statement execute function public.trg_refresh_analytics_daily_stmt();
