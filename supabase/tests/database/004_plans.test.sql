-- supabase/tests/database/004_plans.test.sql
--
-- NOTE: every pgTAP assertion below passes an explicit description as the
-- final argument (see 003_clients.test.sql for the full explanation of why
-- this is required with pgtap 1.3.3 installed in this project).
begin;
select plan(5);

select has_table('public', 'plans', 'plans table exists');
select col_type_is('public', 'plans', 'price', 'numeric(10,2)', 'price is numeric(10,2)');
select col_default_is('public', 'plans', 'currency', 'COP', 'currency defaults to COP');
select col_not_null('public', 'plans', 'duration_unit', 'duration_unit is not null');
select throws_ok(
  $$ insert into public.plans (name, price, duration_unit, duration_count)
     values ('Bad plan', -10, 'month', 1) $$,
  '23514',
  null,
  'negative price is rejected by check constraint'
);

select * from finish();
rollback;
