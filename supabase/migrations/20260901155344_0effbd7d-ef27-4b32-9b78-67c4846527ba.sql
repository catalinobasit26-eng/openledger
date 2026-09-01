-- Cheap "mark day dirty" instead of a full-day re-aggregation on every insert.
create table if not exists public.analytics_dirty_days (day date primary key);
grant all on public.analytics_dirty_days to service_role;
alter table public.analytics_dirty_days enable row level security;

create or replace function public.trg_mark_analytics_dirty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_dirty_days(day)
  select distinct (ts at time zone 'utc')::date from new_rows
  on conflict (day) do nothing;
  return null;
end;
$$;
revoke execute on function public.trg_mark_analytics_dirty() from anon, authenticated, public;

drop trigger if exists ledger_tx_analytics_refresh_stmt on public.ledger_transactions;
create trigger ledger_tx_analytics_dirty
after insert on public.ledger_transactions
referencing new table as new_rows
for each statement execute function public.trg_mark_analytics_dirty();

create or replace function public.flush_analytics_dirty_days()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare d date; n int := 0;
begin
  for d in select day from public.analytics_dirty_days order by day limit 40 loop
    perform public.refresh_analytics_daily(d);
    delete from public.analytics_dirty_days where day = d;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.flush_analytics_dirty_days() from anon, authenticated, public;

select cron.schedule('openledger-analytics-flush', '*/2 * * * *', $$select public.flush_analytics_dirty_days();$$);