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
--
-- plan(11) -> plan(21): +10 for the last-active-admin guard added to
-- set_staff_role/set_staff_active in migration 0021 (whole-branch review
-- finding: nothing stopped an admin from demoting/deactivating themselves,
-- or the last OTHER admin, with no recovery path short of going directly
-- into Supabase). Five new scenarios, each a throws_ok/lives_ok pair plus a
-- readback proving the row was (or wasn't) actually mutated -- same
-- "don't just prove it didn't raise" discipline as the rest of this file:
--   A. sole active admin (admin2) tries to demote themselves via
--      set_staff_role while the only other admin row (employee2) is
--      currently INACTIVE -- refused, and an inactive admin does not count
--      towards the "another admin remains" check.
--   B. employee2 reactivated (set_staff_active ... true) -- allowed, since
--      the guard only ever fires on the *removing* direction (p_active =
--      false / p_role <> 'admin'), never on granting/reactivating.
--   C. with two active admins now, admin2 demotes themselves via
--      set_staff_role -- allowed, because employee2 remains as an active
--      admin after the change.
--   D. employee2 (now the sole active admin) tries to deactivate
--      themselves via set_staff_active -- refused.
--   E. employee2 tries to demote themselves via set_staff_role -- refused.
-- D and E together confirm the guard applies to self-lockout via EITHER
-- RPC, not just one of the two code paths the UI exposes.
--
-- plan(21) -> plan(23): +2 for a timezone-boundary regression check on
-- get_dashboard_stats' revenue_in_range (migration 0037 fixed the same
-- class of bug already fixed for get_daily_activity in 0036: filtering a
-- timestamptz payment_date by casting to ::date resolves against the
-- session's timezone, not Bogota). A payment at 23:30 Bogota on Jan 1 is
-- 04:30 UTC on Jan 2 -- with the old ::date cast it would be attributed to
-- Jan 2, not Jan 1. Assert it lands in the Jan 1 range and not the Jan 2
-- range.
begin;
select plan(23);

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

-- Timezone-boundary regression: 23:30 on Jan 1 in Bogota (UTC-5) is 04:30 on
-- Jan 2 in UTC. Stored via an explicit `at time zone` conversion so this
-- doesn't depend on the test session's own timezone setting.
insert into public.payments (id, subscription_id, amount, payment_method, payment_date)
select
  '91000000-0000-0000-0000-000000000030',
  (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'DASH-CLIENT-1')),
  55000,
  'cash',
  '2024-01-01 23:30:00'::timestamp at time zone 'America/Bogota';

select is(
  (public.get_dashboard_stats('2024-01-01', '2024-01-01') -> 'financial_stats' ->> 'revenue_in_range')::numeric,
  55000::numeric,
  'a payment at 23:30 Bogota on Jan 1 counts toward Jan 1''s revenue_in_range, not Jan 2''s UTC date'
);
select is(
  (public.get_dashboard_stats('2024-01-02', '2024-01-02') -> 'financial_stats' ->> 'revenue_in_range')::numeric,
  0::numeric,
  'that same payment is excluded from Jan 2''s revenue_in_range'
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

-- At this point: admin2 is 'admin'/active, employee2 is 'admin'/INACTIVE
-- (deactivated earlier in this file, then promoted to admin while still
-- inactive). Still authenticated as admin2 from the set_staff_role call
-- above.
--
-- supabase/seed.sql always seeds an active admin row
-- (00000000-0000-0000-0000-000000000001, "Admin Seed"). Left in place, that
-- row would always count as "another active admin" and none of the
-- scenarios below could ever reach zero remaining active admins -- so the
-- guard would trivially never fire, regardless of whether it works. Take it
-- out of consideration with a direct UPDATE (setup, not the RPC under test
-- -- same pattern as the role/is_active setup earlier in this file). That
-- setup UPDATE runs as `postgres` (the `authenticated` role that
-- tests.authenticate_as() switches to has no UPDATE grant on
-- public.profiles -- only the SECURITY DEFINER RPCs can write to it), so
-- drop back to the connection's own role first, then re-authenticate as
-- admin2 to resume exercising the RPCs.
reset role;
update public.profiles set is_active = false
  where id = '00000000-0000-0000-0000-000000000001';
select tests.authenticate_as('admin2@example.test');

-- A. admin2 is the only ACTIVE admin -- employee2 holds the admin role but
-- is inactive, so does not count as "another admin remains". Self-demotion
-- must be refused.
select throws_ok(
  $$ select public.set_staff_role(tests.get_supabase_uid('admin2@example.test'), 'employee') $$,
  'P0001',
  null,
  'sole active admin cannot demote themselves via set_staff_role when the only other admin row is inactive'
);
select is(
  (select role from public.profiles where id = tests.get_supabase_uid('admin2@example.test')),
  'admin'::app_role,
  'refused set_staff_role did not change admin2''s role'
);

-- B. Reactivating employee2 is allowed -- the guard only fires on the
-- removing direction (p_active = false), never on granting/reactivating.
select lives_ok(
  $$ select public.set_staff_active(tests.get_supabase_uid('employee2@example.test'), true) $$,
  'reactivating an admin via set_staff_active is never blocked by the last-admin guard'
);
select is(
  (select is_active from public.profiles where id = tests.get_supabase_uid('employee2@example.test')),
  true,
  'set_staff_active actually persisted is_active = true for employee2'
);

-- C. With two active admins now (admin2, employee2), admin2 demoting
-- themselves is allowed because employee2 remains as an active admin.
select lives_ok(
  $$ select public.set_staff_role(tests.get_supabase_uid('admin2@example.test'), 'employee') $$,
  'admin can demote themselves via set_staff_role when another active admin remains'
);
select is(
  (select role from public.profiles where id = tests.get_supabase_uid('admin2@example.test')),
  'employee'::app_role,
  'set_staff_role actually persisted role = employee for admin2'
);

-- D/E. employee2 is now the sole active admin (admin2 was just demoted).
-- Switch the session to employee2 -- admin2 is no longer admin, so calling
-- as admin2 here would hit the "only an admin can..." guard instead of the
-- last-admin guard this is meant to exercise.
select tests.authenticate_as('employee2@example.test');

-- D. Self-deactivation via set_staff_active, as the last active admin.
select throws_ok(
  $$ select public.set_staff_active(tests.get_supabase_uid('employee2@example.test'), false) $$,
  'P0001',
  null,
  'sole remaining active admin cannot deactivate themselves via set_staff_active'
);
select is(
  (select is_active from public.profiles where id = tests.get_supabase_uid('employee2@example.test')),
  true,
  'refused set_staff_active did not change employee2''s is_active'
);

-- E. Self-demotion via set_staff_role, as the last active admin.
select throws_ok(
  $$ select public.set_staff_role(tests.get_supabase_uid('employee2@example.test'), 'employee') $$,
  'P0001',
  null,
  'sole remaining active admin cannot demote themselves via set_staff_role'
);
select is(
  (select role from public.profiles where id = tests.get_supabase_uid('employee2@example.test')),
  'admin'::app_role,
  'refused set_staff_role did not change employee2''s role'
);

select * from finish();
rollback;
