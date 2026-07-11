-- supabase/tests/database/016_plan_create_rpc.test.sql
--
-- Covers migration 0016: public.create_plan() atomically inserts a plan and
-- its initial plan_prices row. Every assertion passes an explicit
-- description (see 003_clients.test.sql for why that matters with pgtap
-- 1.3.3 installed in this project).
begin;
select plan(4);

select tests.create_supabase_user('plan-admin@example.test', 'plan-admin@example.test');
select tests.create_supabase_user('plan-employee@example.test', 'plan-employee@example.test');
update public.profiles set role = 'admin' where id = tests.get_supabase_uid('plan-admin@example.test');

select tests.authenticate_as('plan-admin@example.test');

select public.create_plan('RPC-created plan', 75000, 'month', 1);

select is(
  (select count(*)::int from public.plans where name = 'RPC-created plan'),
  1,
  'create_plan inserts the plan row'
);
select is(
  public.plan_price_at((select id from public.plans where name = 'RPC-created plan')),
  75000.00::numeric(10,2),
  'create_plan inserts a matching plan_prices row -- plan_price_at resolves it immediately'
);

select tests.authenticate_as('plan-employee@example.test');
select throws_ok(
  $$ select public.create_plan('Employee plan', 10000, 'month', 1) $$,
  '42501',
  null,
  'a non-admin cannot create a plan -- rejected by plans_insert RLS'
);

-- the rejected attempt must not have left a partial row (no price) behind
select is(
  (select count(*)::int from public.plans where name = 'Employee plan'),
  0,
  'the rejected create_plan call left no partial plan row'
);

select * from finish();
rollback;
