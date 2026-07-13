-- supabase/tests/database/025_expire_stale_active_subscription.test.sql
--
-- Covers migration 0025: expire_stale_active_subscription(p_client_id)
-- expires an 'active' subscription whose end_date already passed (the gap
-- left by expire_subscriptions() only running once a day via pg_cron), but
-- must NOT touch a still-current 'active' row, and must be callable by a
-- plain (non-admin) staff member since it's SECURITY INVOKER, gated by the
-- existing subscriptions_update RLS policy rather than a service-role grant.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql
-- for why that matters with pgtap 1.3.3 installed in this project).
begin;
select plan(4);

select has_function(
  'public', 'expire_stale_active_subscription',
  'expire_stale_active_subscription() exists'
);

select tests.create_supabase_user('expire-staff@example.test', 'expire-staff@example.test');

insert into public.clients (dni_type, dni_number, first_name, last_name)
values
  ('CC', 'EXPIRE-STALE', 'Stale', 'Client'),
  ('CC', 'EXPIRE-CURRENT', 'Current', 'Client');
select tests.create_plan('Expire Test Plan', 100000, 'month', 1);

-- lapsed membership: end_date already in the past, still marked 'active'
-- (exactly the gap left by the once-a-day cron)
insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select c.id, p.id, current_date - 40, current_date - 10, 'active', 100000
from public.clients c, public.plans p
where c.dni_number = 'EXPIRE-STALE' and p.name = 'Expire Test Plan';

-- still-current membership: end_date in the future, must be left alone
insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select c.id, p.id, current_date - 5, current_date + 25, 'active', 100000
from public.clients c, public.plans p
where c.dni_number = 'EXPIRE-CURRENT' and p.name = 'Expire Test Plan';

select tests.authenticate_as('expire-staff@example.test');

select lives_ok(
  $$ select public.expire_stale_active_subscription(
       (select id from public.clients where dni_number = 'EXPIRE-STALE')
     ) $$,
  'a plain staff member (not admin) can call expire_stale_active_subscription'
);

select is(
  (select status from public.subscriptions s join public.clients c on c.id = s.client_id where c.dni_number = 'EXPIRE-STALE'),
  'expired',
  'the lapsed active subscription is expired'
);

select public.expire_stale_active_subscription(
  (select id from public.clients where dni_number = 'EXPIRE-CURRENT')
);
select is(
  (select status from public.subscriptions s join public.clients c on c.id = s.client_id where c.dni_number = 'EXPIRE-CURRENT'),
  'active',
  'a still-current active subscription is left untouched'
);

select * from finish();
rollback;
