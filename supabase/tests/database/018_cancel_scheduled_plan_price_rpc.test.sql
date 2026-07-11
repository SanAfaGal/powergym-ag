-- supabase/tests/database/018_cancel_scheduled_plan_price_rpc.test.sql
--
-- Covers migration 0018: cancel_scheduled_plan_price() must delete the
-- future row AND reopen the row it had closed, atomically -- not leave a
-- coverage gap.
begin;
select plan(5);

select tests.create_plan('Cancel Price Plan', 100000, 'month', 1);

insert into public.plan_prices (plan_id, price, valid_from)
values (
  (select id from public.plans where name = 'Cancel Price Plan'),
  150000,
  current_date + 10
);

-- sanity check: scheduling closed the original row
select is(
  (select valid_until from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Cancel Price Plan')
     and price = 100000),
  current_date + 9,
  'scheduling the future price closed the original row the day before'
);

select public.cancel_scheduled_plan_price(
  (select id from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Cancel Price Plan')
     and price = 150000)
);

select is(
  (select count(*)::int from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Cancel Price Plan')
     and price = 150000),
  0,
  'the cancelled future row is deleted'
);
select is(
  (select valid_until from public.plan_prices
     where plan_id = (select id from public.plans where name = 'Cancel Price Plan')
     and price = 100000),
  null,
  'cancelling reopens the row that was closed -- no coverage gap'
);
select is(
  public.plan_price_at(
    (select id from public.plans where name = 'Cancel Price Plan'),
    current_date + 30
  ),
  100000.00::numeric(10,2),
  'plan_price_at resolves correctly for a date past the cancelled schedule (no gap)'
);

-- cancelling an already-effective (non-future) price must be rejected
select throws_ok(
  $$ select public.cancel_scheduled_plan_price(
       (select id from public.plan_prices
          where plan_id = (select id from public.plans where name = 'Cancel Price Plan')
          and price = 100000)
     ) $$,
  'P0001',
  null,
  'cancelling a price that is already in effect is rejected'
);

select * from finish();
rollback;
