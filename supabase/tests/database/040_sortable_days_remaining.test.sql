-- supabase/tests/database/040_sortable_days_remaining.test.sql
--
-- Covers migration 0040: sort_days_remaining nulls out negative
-- days_remaining so expired subscriptions don't outrank active ones when
-- sorting "soonest to expire first". Every assertion passes an explicit
-- description (see 003_clients.test.sql for why that's required with
-- pgtap 1.3.3 installed in this project).
begin;
select plan(2);

select tests.create_supabase_user('sort-days-employee@example.test', 'sort-days-employee@example.test');
select tests.create_plan('Sort Days Test Plan', 100000, 'month', 1);

insert into public.clients (id, dni_type, dni_number, first_name, last_name)
values ('91000000-0000-0000-0000-000000000001', 'CC', 'SORTDAYS-1', 'SortDays', 'Expired');

insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select '91000000-0000-0000-0000-000000000001', id, public.today_bogota() - 60, public.today_bogota() - 5, 'expired', 100000
from public.plans where name = 'Sort Days Test Plan';

insert into public.clients (id, dni_type, dni_number, first_name, last_name)
values ('91000000-0000-0000-0000-000000000002', 'CC', 'SORTDAYS-2', 'SortDays', 'Active');

insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select '91000000-0000-0000-0000-000000000002', id, public.today_bogota(), public.today_bogota() + 10, 'active', 100000
from public.plans where name = 'Sort Days Test Plan';

select tests.authenticate_as('sort-days-employee@example.test');

select is(
  (select sort_days_remaining from public.client_subscription_overview
   where id = '91000000-0000-0000-0000-000000000001'),
  null,
  'expired subscription (negative days_remaining) has a null sort_days_remaining'
);
select is(
  (select sort_days_remaining from public.client_subscription_overview
   where id = '91000000-0000-0000-0000-000000000002'),
  10,
  'active subscription with days left keeps its value in sort_days_remaining'
);

select * from finish();
rollback;
