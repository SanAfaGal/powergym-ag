-- supabase/tests/database/019_plan_price_bogota_defaults.test.sql
--
-- Covers migration 0019: plan_prices.valid_from and plan_price_at's date
-- parameter must default to today_bogota(), not the DB session's UTC
-- current_date, or a plan created (or priced) during the UTC/Bogota
-- calendar-day mismatch window (~19:00-23:59 Bogota) lands with a
-- valid_from one day ahead of Bogota "now", making plan_price_at resolve
-- to no price at all.
begin;
select plan(2);

select tests.create_plan('Bogota Default Plan', 100000, 'month', 1);

select is(
  (select valid_from from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Bogota Default Plan')),
  public.today_bogota(),
  'plan_prices.valid_from defaults to today_bogota(), not UTC current_date'
);

select is(
  public.plan_price_at((select id from public.plans where name = 'Bogota Default Plan')),
  100000.00::numeric(10,2),
  'plan_price_at with no explicit date resolves using today_bogota(), not UTC current_date'
);

select * from finish();
rollback;
