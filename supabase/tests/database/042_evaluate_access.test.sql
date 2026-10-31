-- supabase/tests/database/042_evaluate_access.test.sql
--
-- Covers migration 0042: evaluate_access(p_client_id) decides whether a
-- client may enter, independent of HOW they were identified. Each case gets
-- its own client because only one 'active' subscription per client is
-- allowed (one_active_subscription_per_client).
--
-- The stale-'active' case matters most: expire_subscriptions() only runs
-- once a day, so for up to 24h a lapsed membership still reads
-- status = 'active' (see migration 0025). Access must not trust status
-- alone.
--
-- Each assertion compares "allowed:reason_code" as one string. Every
-- assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(11);

select has_function('public', 'evaluate_access', 'evaluate_access() exists');

select tests.create_supabase_user('eval-staff@example.test', 'eval-staff@example.test');
select tests.create_plan('Eval Plan', 100000, 'month', 1);

insert into public.clients (dni_type, dni_number, first_name, last_name, is_active)
values
  ('CC', 'EVAL-OK', 'Ok', 'Client', true),
  ('CC', 'EVAL-LASTDAY', 'Last', 'Day', true),
  ('CC', 'EVAL-STALE', 'Stale', 'Active', true),
  ('CC', 'EVAL-FUTURE', 'Future', 'Active', true),
  ('CC', 'EVAL-PENDING', 'Pending', 'Payment', true),
  ('CC', 'EVAL-CANCELED', 'Canceled', 'Client', true),
  ('CC', 'EVAL-EXPIRED', 'Expired', 'Status', true),
  ('CC', 'EVAL-NONE', 'No', 'Subscription', true),
  ('CC', 'EVAL-INACTIVE', 'Inactive', 'Client', false);

-- helper-free fixture: (dni, status, start offset, end offset) in days from today_bogota()
insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select c.id, p.id, public.today_bogota() + f.start_off, public.today_bogota() + f.end_off, f.status, 100000
from (values
  ('EVAL-OK',       'active',          -5,  25),
  ('EVAL-LASTDAY',  'active',         -30,   0),
  ('EVAL-STALE',    'active',         -31,  -1),
  ('EVAL-FUTURE',   'active',           1,  31),
  ('EVAL-PENDING',  'pending_payment', -2,  28),
  ('EVAL-CANCELED', 'canceled',        -5,  25),
  ('EVAL-EXPIRED',  'expired',         -40, -10),
  ('EVAL-INACTIVE', 'active',          -5,  25)
) as f(dni, status, start_off, end_off)
join public.clients c on c.dni_number = f.dni
cross join (select id from public.plans where name = 'Eval Plan') p;

select tests.authenticate_as('eval-staff@example.test');

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-OK'))),
  'true:ok',
  'an active, in-range subscription is allowed'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-LASTDAY'))),
  'true:ok',
  'a subscription ending today is still allowed'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-STALE'))),
  'false:subscription_expired',
  'a stale active subscription (end_date yesterday, cron not yet run) is denied as expired'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-FUTURE'))),
  'false:subscription_scheduled',
  'an active subscription that has not started yet is denied as scheduled'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-PENDING'))),
  'false:subscription_pending_payment',
  'a pending_payment subscription is denied'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-CANCELED'))),
  'false:subscription_canceled',
  'a canceled subscription is denied'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-EXPIRED'))),
  'false:subscription_expired',
  'an expired subscription is denied'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-NONE'))),
  'false:no_subscription',
  'a client with no subscription is denied'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access((select id from public.clients where dni_number = 'EVAL-INACTIVE'))),
  'false:client_inactive',
  'an inactive client is denied even with a valid active subscription'
);

select is(
  (select allowed::text || ':' || reason_code from public.evaluate_access('00000000-0000-0000-0000-000000000000')),
  'false:client_not_found',
  'an unknown client id is denied as not found'
);

select * from finish();
rollback;
