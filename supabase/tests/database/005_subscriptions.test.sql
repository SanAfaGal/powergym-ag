-- supabase/tests/database/005_subscriptions.test.sql
--
-- NOTE: every pgTAP assertion below passes an explicit description as the
-- final argument (see 003_clients.test.sql for the full explanation of why
-- this is required with pgtap 1.3.3 installed in this project).
--
-- NOTE: the brief's literal SQL declared `plan(5)` but only listed 4 real
-- assertions (has_table, ok placeholder, is, throws_ok). To make the plan
-- count match reality, a `has_index` check for the
-- `one_active_subscription_per_client` unique partial index was added --
-- this is the table's most critical invariant per the task brief, so it
-- deserves a direct existence check in addition to the throws_ok behavioral
-- test below.
--
-- NOTE: the brief's literal SQL for the final_price assertion used a bare
-- `insert into ... returning id` as a subquery inside `where id = (...)`.
-- Postgres only allows data-modifying statements as subqueries inside a
-- WITH clause (data-modifying CTE), not as arbitrary scalar subqueries, so
-- that produced a syntax error. Postgres also requires a data-modifying
-- WITH clause to sit at the top level of the query (not nested inside a
-- scalar subquery passed as a function argument), so the CTE is hoisted to
-- the top of the `select is(...)` statement below, which inserts and
-- returns `final_price` directly.
--
-- NOTE: the brief's throws_ok block, as literally written, inserts the
-- FIRST 'active' subscription for TEST-SUB-1 (the earlier `is()` insert
-- above omits `status`, so that row defaults to 'pending_payment' and
-- never conflicts). A first 'active' insert cannot violate the unique
-- partial index, so a plain (non-assertion) insert of one 'active'
-- subscription was added immediately before throws_ok; the throws_ok
-- insert is then genuinely the second 'active' row for the same client
-- and correctly raises 23505. This extra insert is not a TAP assertion,
-- so it does not affect the plan(5) count.
begin;
select plan(5);

select has_table('public', 'subscriptions', 'subscriptions table exists');
select has_index('public', 'subscriptions', 'one_active_subscription_per_client', 'one_active_subscription_per_client index exists');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'TEST-SUB-1', 'Sub', 'Test');
select tests.create_plan('Monthly Test Plan', 100000, 'month', 1);

select ok(
  (select true), -- placeholder anchor for readability, real assertions follow
  'fixtures inserted'
);

with new_sub as (
  insert into public.subscriptions (client_id, plan_id, start_date, end_date, base_price, discount_percentage)
  select c.id, p.id, current_date, current_date + 30, 100000, 20
  from public.clients c, public.plans p
  where c.dni_number = 'TEST-SUB-1' and p.name = 'Monthly Test Plan'
  returning final_price
)
select is(
  (select final_price from new_sub),
  80000.00::numeric(10,2),
  'final_price is generated as base_price minus discount'
);

-- first active subscription for the client (plain insert, not a TAP assertion)
insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select c.id, p.id, current_date, current_date + 30, 'active', 100000
from public.clients c, public.plans p
where c.dni_number = 'TEST-SUB-1' and p.name = 'Monthly Test Plan';

-- second active subscription for the same client must be rejected
select throws_ok(
  $$ insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
     select c.id, p.id, current_date, current_date + 30, 'active', 100000
     from public.clients c, public.plans p
     where c.dni_number = 'TEST-SUB-1' and p.name = 'Monthly Test Plan' $$,
  '23505',
  null,
  'a second active subscription for the same client violates the unique partial index'
);

select * from finish();
rollback;
