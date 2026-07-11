-- supabase/tests/database/013_plan_price_history.test.sql
--
-- Covers migration 0013: plan_prices replaces plans.price with an
-- append-only, validity-windowed price history. Every assertion passes an
-- explicit description (see 003_clients.test.sql for why that matters with
-- pgtap 1.3.3 installed in this project).
begin;
select plan(9);

select has_table('public', 'plan_prices', 'plan_prices table exists');
select col_type_is('public', 'plan_prices', 'price', 'numeric(10,2)', 'price is numeric(10,2)');
select hasnt_column('public', 'plans', 'price', 'plans no longer has a price column');

select throws_ok(
  $$ insert into public.plan_prices (plan_id, price) values (gen_random_uuid(), -10) $$,
  '23514',
  null,
  'negative price is rejected by check constraint'
);

-- ------------------------------------------------------------
-- plan_price_at(): current price, and a scheduled future price
-- ------------------------------------------------------------
select tests.create_plan('History Plan', 100000, 'month', 1);

select is(
  public.plan_price_at((select id from public.plans where name = 'History Plan')),
  100000.00::numeric(10,2),
  'plan_price_at returns the initial price for today'
);

-- schedule a price increase effective in 10 days; the auto-close trigger
-- must close the initial row the day before, not delete or edit it
insert into public.plan_prices (plan_id, price, valid_from)
values (
  (select id from public.plans where name = 'History Plan'),
  120000,
  current_date + 10
);

select is(
  public.plan_price_at((select id from public.plans where name = 'History Plan')),
  100000.00::numeric(10,2),
  'plan_price_at still returns the original price today (the increase is not yet effective)'
);
select is(
  public.plan_price_at((select id from public.plans where name = 'History Plan'), current_date + 10),
  120000.00::numeric(10,2),
  'plan_price_at returns the new price on its effective date'
);
select is(
  (select valid_until from public.plan_prices
     where plan_id = (select id from public.plans where name = 'History Plan')
     and price = 100000),
  current_date + 9,
  'inserting the future price auto-closed the original row the day before'
);

-- a subscription created to start on the future date must pick up the new
-- price, not today's -- this is the whole point of pricing off start_date
insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'PRICE-CLIENT-1', 'Price', 'Client');

select is(
  (select base_price from public.create_subscription(
    (select id from public.clients where dni_number = 'PRICE-CLIENT-1'),
    (select id from public.plans where name = 'History Plan'),
    current_date + 10,
    0
  )),
  120000.00::numeric(10,2),
  'create_subscription prices a future-dated subscription at the price effective on its start_date'
);

select * from finish();
rollback;
