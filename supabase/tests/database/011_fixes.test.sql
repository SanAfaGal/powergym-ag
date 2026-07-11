begin;
select plan(5);

select ok(public.today_bogota() is not null, 'today_bogota() returns a value');

-- Problem 1: a fully prepaid scheduled renewal must activate directly,
-- not get stuck in pending_payment forever.
insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'FIX-CLIENT-1', 'Fix', 'Client');
select tests.create_plan('Fix Plan', 100000, 'month', 1);

select public.create_subscription(
  (select id from public.clients where dni_number = 'FIX-CLIENT-1'),
  (select id from public.plans where name = 'Fix Plan'),
  current_date, 0
);
select public.record_payment(
  (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'FIX-CLIENT-1')),
  100000, 'cash', 'activate original'
);
select public.renew_subscription(
  (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'FIX-CLIENT-1') and status = 'active')
);
select public.record_payment(
  (select id from public.subscriptions where client_id = (select id from public.clients where dni_number = 'FIX-CLIENT-1') and status = 'scheduled'),
  100000, 'cash', 'prepay renewal'
);

update public.subscriptions
set start_date = current_date - 1
where client_id = (select id from public.clients where dni_number = 'FIX-CLIENT-1') and status = 'scheduled';

update public.subscriptions
set status = 'expired'
where client_id = (select id from public.clients where dni_number = 'FIX-CLIENT-1') and status = 'active';

select public.activate_scheduled_subscriptions();

select is(
  (select status from public.subscriptions where client_id = (select id from public.clients where dni_number = 'FIX-CLIENT-1') and status <> 'expired'),
  'active',
  'a fully prepaid scheduled renewal is activated directly instead of stuck in pending_payment'
);

-- Problem 3 (part A): a role in raw_user_meta_data (client-controlled) must be ignored.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, aud, role)
values (
  gen_random_uuid(), 'escalation-test@example.test',
  jsonb_build_object('full_name', 'Escalation Test', 'role', 'admin'),
  '{}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
);
select is(
  (select role from public.profiles where id = (select id from auth.users where email = 'escalation-test@example.test')),
  'employee'::app_role,
  'a role set only in raw_user_meta_data (client-controlled) is ignored; defaults to employee'
);

-- Problem 3 (part B): a role in raw_app_meta_data (server-controlled) is honored.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, aud, role)
values (
  gen_random_uuid(), 'legit-admin-invite@example.test',
  jsonb_build_object('full_name', 'Legit Admin'),
  jsonb_build_object('role', 'admin'),
  now(), now(), 'authenticated', 'authenticated'
);
select is(
  (select role from public.profiles where id = (select id from auth.users where email = 'legit-admin-invite@example.test')),
  'admin'::app_role,
  'a role set in raw_app_meta_data (server-controlled, e.g. admin invite) is honored'
);

-- Decision (confirmed by the real user, not a bug fix): get_dashboard_stats
-- is intentionally readable by ANY active staff, not admin-only, since
-- employees already have direct RLS read access to clients/subscriptions/
-- payments and the dashboard is just an aggregate of that same data.
select tests.create_supabase_user('dashboard-employee@example.test', 'dashboard-employee@example.test');
select tests.authenticate_as('dashboard-employee@example.test');
select lives_ok(
  $$ select public.get_dashboard_stats(current_date - 30, current_date + 30) $$,
  'employee (non-admin) can call get_dashboard_stats -- intentional, not a gap'
);

select * from finish();
rollback;
