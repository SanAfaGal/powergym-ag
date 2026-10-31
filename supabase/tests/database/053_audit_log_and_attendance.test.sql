-- supabase/tests/database/053_audit_log_and_attendance.test.sql
--
-- Covers migration 0053: audit_log records who changed staff access (admin
-- only can read it, nobody can write it through the API) and
-- get_client_attendance() groups granted entries by Bogota day.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(8);

select tests.create_supabase_user('au-admin@example.test', 'au-admin@example.test');
select tests.create_supabase_user('au-target@example.test', 'au-target@example.test');
select tests.create_supabase_user('au-viewer@example.test', 'au-viewer@example.test');
update public.profiles set role = 'admin'
  where id = tests.get_supabase_uid('au-admin@example.test');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'AU-A', 'Ana', 'Asistencia');

-- 22:00 and 07:00 Bogota are the same UTC date but different Bogota days; the
-- 10:00 Bogota entry shares a day with the 07:00 one; the denied one is ignored.
insert into public.access_events (occurred_at, client_id, decision, reason_code)
select t, (select id from public.clients where dni_number = 'AU-A'), d, 'test'
from (values
  ('2026-10-30 03:00+00'::timestamptz, 'granted'),
  ('2026-10-30 12:00+00'::timestamptz, 'granted'),
  ('2026-10-30 15:00+00'::timestamptz, 'granted'),
  ('2026-10-31 15:00+00'::timestamptz, 'denied')
) as v(t, d);

select tests.authenticate_as('au-admin@example.test');

select public.set_staff_role(tests.get_supabase_uid('au-target@example.test'), 'admin');

select is(
  (select count(*) from public.audit_log
   where table_name = 'profiles' and action = 'UPDATE'
     and record_id = tests.get_supabase_uid('au-target@example.test')::text
     and actor_id = tests.get_supabase_uid('au-admin@example.test')
     and old_data ->> 'role' = 'employee' and new_data ->> 'role' = 'admin'),
  1::bigint,
  'a role change is logged with the acting admin and the before/after role'
);

select cmp_ok(
  (select count(*) from public.audit_log),
  '>=', 1::bigint,
  'an admin can read the audit log'
);

select is(
  (select count(*) from public.get_client_attendance(
    (select id from public.clients where dni_number = 'AU-A'))),
  2::bigint,
  'attendance has one row per Bogota day with a granted entry'
);

select is(
  (select max(last_at) from public.get_client_attendance(
    (select id from public.clients where dni_number = 'AU-A'))),
  '2026-10-30 15:00+00'::timestamptz,
  'the latest entry of the day is reported'
);

select throws_ok(
  $$ insert into public.audit_log (table_name, action) values ('x', 'INSERT') $$,
  '42501', null,
  'the audit log cannot be written through the API'
);

select tests.authenticate_as('au-viewer@example.test');

select is(
  (select count(*) from public.audit_log),
  0::bigint,
  'an employee cannot read the audit log'
);

select throws_ok(
  $$ delete from public.audit_log $$,
  '42501', null,
  'the audit log cannot be deleted through the API'
);

reset role;

select is(
  (select count(*) from pg_trigger
   where tgname in ('audit_payments', 'audit_subscriptions', 'audit_plan_prices',
                    'audit_bank_accounts', 'audit_profiles')),
  5::bigint,
  'the audited tables each have their trigger'
);

select * from finish();
rollback;
