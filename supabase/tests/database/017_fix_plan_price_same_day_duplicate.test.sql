-- supabase/tests/database/017_fix_plan_price_same_day_duplicate.test.sql
--
-- Covers migration 0017: scheduling a plan_prices row with the same
-- valid_from as the existing open row must CLOSE it (keeping it in
-- history), not leave two open "vigente" rows -- and not delete it either,
-- since it's real history (however briefly it was in effect).
begin;
select plan(6);

select tests.create_plan('Same Day Plan', 100000, 'month', 1);

-- scheduling a price for the SAME day as the existing open row (e.g. a
-- same-day correction) must close it, leaving exactly one open row, while
-- keeping both rows in the table
insert into public.plan_prices (plan_id, price)
values (
  (select id from public.plans where name = 'Same Day Plan'),
  120000
);

select is(
  (select count(*)::int from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Same Day Plan')),
  2,
  'the original row is kept (closed), not deleted -- two rows total'
);
select is(
  (select count(*)::int from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Same Day Plan')
     and valid_until is null),
  1,
  'exactly one open row remains, not two'
);
select is(
  (select valid_until from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Same Day Plan')
     and price = 100000),
  public.today_bogota(),
  'the original row is closed on the same day the correction takes over (a one-day boundary overlap)'
);
select is(
  public.plan_price_at((select id from public.plans where name = 'Same Day Plan')),
  120000.00::numeric(10,2),
  'plan_price_at breaks the same-day tie in favor of the more recently created row (the correction)'
);

-- a genuinely future price still closes the previous row the day before
-- (no overlap) -- the fix must not have broken migration 0013's behavior
insert into public.plan_prices (plan_id, price, valid_from)
values (
  (select id from public.plans where name = 'Same Day Plan'),
  130000,
  current_date + 5
);

select is(
  (select count(*)::int from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Same Day Plan')
     and valid_until is null),
  1,
  'scheduling a genuinely future price still leaves exactly one open row'
);
select is(
  public.plan_price_at((select id from public.plans where name = 'Same Day Plan')),
  120000.00::numeric(10,2),
  'the current price is unaffected until the future date arrives'
);

select * from finish();
rollback;
