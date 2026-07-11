-- supabase/tests/database/006_payments.test.sql
--
-- NOTE: every pgTAP assertion below passes an explicit description as the
-- final argument (see 003_clients.test.sql for the full explanation of why
-- this is required with pgtap 1.3.3 installed in this project: without a
-- description, `has_table('public', 'payments')` etc. resolve to the wrong
-- same-arity overload and silently check for a table literally named
-- "public"). The brief's literal SQL omitted descriptions on has_table,
-- col_not_null, and has_index; they were added here. plan(4) already
-- matched the real assertion count (has_table, col_not_null, throws_ok,
-- has_index), so no other changes were needed.
begin;
select plan(4);

select has_table('public', 'payments', 'payments table exists');
select col_not_null('public', 'payments', 'amount', 'amount is not null');
select throws_ok(
  $$ insert into public.payments (subscription_id, amount, payment_method)
     values (gen_random_uuid(), -5, 'cash') $$,
  '23514',
  null,
  'non-positive amount is rejected'
);
select has_index('public', 'payments', 'payments_subscription_idx', 'payments_subscription_idx exists');

select * from finish();
rollback;
