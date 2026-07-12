-- supabase/migrations/00000000000019_plan_price_bogota_defaults.sql
--
-- plan_prices.valid_from defaulted to current_date (the DB session's UTC
-- calendar date, migration 0013) instead of today_bogota() (migration
-- 0011, added specifically so app-visible "today" logic doesn't drift from
-- Bogota wall-clock time). From roughly 19:00 Bogota onward, UTC's
-- calendar date has already rolled to tomorrow: a brand-new plan's initial
-- price (create_plan RPC, migration 0016, relies on this default -- it
-- never sets valid_from itself) would land with valid_from one day in the
-- future relative to Bogota "now", so plan_price_at(plan_id) -- called
-- with no explicit date, itself defaulting to current_date, migration
-- 0013 -- would find no row with valid_from <= today and return null: a
-- freshly created plan would show no price until after UTC midnight.
--
-- Same fix as the app-layer today_bogota() adoption elsewhere (migrations
-- 0011, 0013's create_subscription/renew_subscription): both defaults
-- move from current_date to today_bogota().

alter table public.plan_prices
  alter column valid_from set default public.today_bogota();

create or replace function public.plan_price_at(
  p_plan_id uuid,
  p_date date default public.today_bogota()
) returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select price from public.plan_prices
  where plan_id = p_plan_id
    and valid_from <= p_date
    and (valid_until is null or valid_until >= p_date)
  order by valid_from desc, created_at desc
  limit 1
$$;
