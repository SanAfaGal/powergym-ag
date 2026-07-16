-- supabase/tests/database/027_client_subscription_overview.test.sql
--
-- Covers migration 0033. Every assertion passes an explicit description
-- (see 003_clients.test.sql for why that's required with pgtap 1.3.3).
begin;
select plan(7);

select has_view('public', 'client_subscription_overview', 'client_subscription_overview view exists');

select tests.create_supabase_user('overview-employee@example.test', 'overview-employee@example.test');
select tests.create_plan('Overview Test Plan A', 100000, 'month', 1);
select tests.create_plan('Overview Test Plan B', 200000, 'month', 1);

insert into public.clients (id, dni_type, dni_number, first_name, last_name)
values ('90000000-0000-0000-0000-000000000001', 'CC', 'OVERVIEW-1', 'Overview', 'ClientNoSub');

-- client with no subscription: subscription-side columns are all null
select tests.authenticate_as('overview-employee@example.test');
select is(
  (select subscription_id from public.client_subscription_overview
   where id = '90000000-0000-0000-0000-000000000001'),
  null,
  'client with no subscription has a null subscription_id in the view'
);
select is(
  (select days_remaining from public.client_subscription_overview
   where id = '90000000-0000-0000-0000-000000000001'),
  null,
  'client with no subscription has a null days_remaining in the view'
);

-- client with an expired AND a pending_payment subscription: pending_payment
-- outranks expired in the priority order, so it's the one the view surfaces
reset role;
insert into public.clients (id, dni_type, dni_number, first_name, last_name)
values ('90000000-0000-0000-0000-000000000002', 'CC', 'OVERVIEW-2', 'Overview', 'ClientTwoSubs');

insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select '90000000-0000-0000-0000-000000000002', id, public.today_bogota() - 60, public.today_bogota() - 30, 'expired', 100000
from public.plans where name = 'Overview Test Plan A';

insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select '90000000-0000-0000-0000-000000000002', id, public.today_bogota(), public.today_bogota() + 30, 'pending_payment', 200000
from public.plans where name = 'Overview Test Plan B';

select tests.authenticate_as('overview-employee@example.test');
select is(
  (select subscription_status from public.client_subscription_overview
   where id = '90000000-0000-0000-0000-000000000002'),
  'pending_payment',
  'pending_payment outranks expired when a client has both'
);
select is(
  (select plan_name from public.client_subscription_overview
   where id = '90000000-0000-0000-0000-000000000002'),
  'Overview Test Plan B',
  'the surfaced subscription brings its own plan name, not the other one'
);

-- paid/remaining/days_remaining computed correctly for an active subscription
reset role;
insert into public.clients (id, dni_type, dni_number, first_name, last_name)
values ('90000000-0000-0000-0000-000000000003', 'CC', 'OVERVIEW-3', 'Overview', 'ClientPaid');

with new_sub as (
  insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
  select '90000000-0000-0000-0000-000000000003', id, public.today_bogota() - 5, public.today_bogota() + 10, 'active', 100000
  from public.plans where name = 'Overview Test Plan A'
  returning id
)
insert into public.payments (subscription_id, amount, payment_method)
select id, 40000, 'cash' from new_sub;

select tests.authenticate_as('overview-employee@example.test');
select is(
  (select remaining from public.client_subscription_overview
   where id = '90000000-0000-0000-0000-000000000003'),
  60000.00::numeric,
  'remaining is final_price minus paid'
);
select is(
  (select days_remaining from public.client_subscription_overview
   where id = '90000000-0000-0000-0000-000000000003'),
  10,
  'days_remaining is end_date minus today'
);

select * from finish();
rollback;
