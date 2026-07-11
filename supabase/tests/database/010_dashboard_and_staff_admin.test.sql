-- supabase/tests/database/010_dashboard_and_staff_admin.test.sql
--
-- NOTE: every pgTAP assertion below passes an explicit description as the
-- final argument (see 003_clients.test.sql for the full explanation of why
-- this is required with pgtap 1.3.3 installed in this project).
--
-- NOTE: the brief's literal SQL (plan(5)) only checked 3 of the 4 top-level
-- keys the brief's own Interfaces section promises
-- ("client_stats, subscription_stats, financial_stats, alerts") and the
-- dashboard module depends on all four. Added a 4th `ok` for the 'alerts'
-- key. It also only ever called set_staff_active via `lives_ok`, which just
-- proves the call didn't raise -- it never checks that the target profile's
-- `is_active` actually flipped, so a no-op body would still pass. Same gap
-- existed for set_staff_role, which the brief's literal SQL didn't exercise
-- at all despite it being one of the two RPCs this migration produces.
-- Added readback assertions for both (each its own top-level statement,
-- per the snapshot/ordering pitfall documented in Task 13 and reused in
-- 008/009: a statement that both calls a mutating function and reads the
-- result back in the same command runs on one fixed snapshot and would not
-- see the write).
--
-- NOTE: set_staff_role(employee2, 'admin') is deliberately run AFTER the
-- throws_ok negative-path check below, not before. If it ran first,
-- employee2 would become an admin and the "non-admin cannot call
-- set_staff_active" assertion would silently stop testing what it claims to
-- test (it would succeed for the wrong reason: because the caller became
-- an admin, not because the guard was bypassed). Ordering here is load-
-- bearing.
--
-- plan(5) -> plan(11): +1 for the missing 'alerts' key check, +2 readback
-- assertions (is_active, role), +2 regression assertions for the EXECUTE
-- grant hardening applied in migration 0010 (see its NOTE for the
-- reasoning, consistent with the service_role-only pattern from migration
-- 0009 / Task 14's defense-in-depth note).
begin;
select plan(11);

select tests.create_supabase_user('admin2@example.test', 'admin2@example.test');
select tests.create_supabase_user('employee2@example.test', 'employee2@example.test');
update public.profiles set role = 'admin' where id = tests.get_supabase_uid('admin2@example.test');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'DASH-CLIENT-1', 'Dash', 'Client');
select tests.create_plan('Dash Plan', 100000, 'month', 1);
insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
values (
  (select id from public.clients where dni_number = 'DASH-CLIENT-1'),
  (select id from public.plans where name = 'Dash Plan'),
  current_date, current_date + 30, 'active', 100000
);

select tests.authenticate_as('admin2@example.test');

select ok(
  (public.get_dashboard_stats(current_date - 30, current_date + 30) ? 'client_stats'),
  'get_dashboard_stats returns client_stats key'
);
select ok(
  (public.get_dashboard_stats(current_date - 30, current_date + 30) ? 'subscription_stats'),
  'get_dashboard_stats returns subscription_stats key'
);
select ok(
  (public.get_dashboard_stats(current_date - 30, current_date + 30) ? 'financial_stats'),
  'get_dashboard_stats returns financial_stats key'
);
select ok(
  (public.get_dashboard_stats(current_date - 30, current_date + 30) ? 'alerts'),
  'get_dashboard_stats returns alerts key'
);

select lives_ok(
  $$ select public.set_staff_active(tests.get_supabase_uid('employee2@example.test'), false) $$,
  'admin can deactivate a staff member via set_staff_active'
);
select is(
  (select is_active from public.profiles where id = tests.get_supabase_uid('employee2@example.test')),
  false,
  'set_staff_active actually persisted is_active = false'
);

select tests.authenticate_as('employee2@example.test');
select throws_ok(
  $$ select public.set_staff_active(tests.get_supabase_uid('employee2@example.test'), true) $$,
  'P0001',
  null,
  'non-admin cannot call set_staff_active'
);

select tests.authenticate_as('admin2@example.test');
select lives_ok(
  $$ select public.set_staff_role(tests.get_supabase_uid('employee2@example.test'), 'admin') $$,
  'admin can change a staff member''s role via set_staff_role'
);
select is(
  (select role from public.profiles where id = tests.get_supabase_uid('employee2@example.test')),
  'admin'::app_role,
  'set_staff_role actually persisted role = admin'
);

select is(
  has_function_privilege('anon', 'public.set_staff_role(uuid, app_role)', 'execute'),
  false,
  'anon has no EXECUTE privilege on set_staff_role (defense-in-depth on top of the internal admin check)'
);
select is(
  has_function_privilege('anon', 'public.set_staff_active(uuid, boolean)', 'execute'),
  false,
  'anon has no EXECUTE privilege on set_staff_active (defense-in-depth on top of the internal admin check)'
);

select * from finish();
rollback;
