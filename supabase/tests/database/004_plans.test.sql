-- supabase/tests/database/004_plans.test.sql
--
-- NOTE: every pgTAP assertion below passes an explicit description as the
-- final argument (see 003_clients.test.sql for the full explanation of why
-- this is required with pgtap 1.3.3 installed in this project).
--
-- NOTE: plans no longer has a `price` column as of migration 0013 -- it
-- moved to plan_prices (an append-only history), see
-- 013_plan_price_history.test.sql for its coverage.
begin;
select plan(3);

select has_table('public', 'plans', 'plans table exists');
select col_default_is('public', 'plans', 'currency', 'COP', 'currency defaults to COP');
select col_not_null('public', 'plans', 'duration_unit', 'duration_unit is not null');

select * from finish();
rollback;
