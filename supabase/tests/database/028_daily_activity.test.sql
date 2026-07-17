-- supabase/tests/database/028_daily_activity.test.sql
--
-- Covers migration 0036 (get_daily_activity). Every assertion passes an
-- explicit description (see 003_clients.test.sql for why that's required
-- with the pgtap version installed in this project).
begin;
select plan(3);

select has_function('public', 'get_daily_activity', 'get_daily_activity() exists');

select tests.create_supabase_user('daily-activity@example.test', 'daily-activity@example.test');
select tests.create_plan('Daily Activity Plan', 100000, 'month', 1);

insert into public.clients (id, dni_type, dni_number, first_name, last_name)
values ('91000000-0000-0000-0000-000000000001', 'CC', 'DAILY-1', 'Nueva', 'Alta');

select tests.authenticate_as('daily-activity@example.test');

-- A day with zero payments returns an empty array, not null.
select is(
  public.get_daily_activity(current_date - 999),
  '[]'::jsonb,
  'empty day returns [], not null'
);

reset role;
with new_sub as (
  insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
  select '91000000-0000-0000-0000-000000000001', id, current_date, current_date + 30, 'active', 100000
  from public.plans where name = 'Daily Activity Plan'
  returning id
)
insert into public.payments (id, subscription_id, amount, payment_method)
select '91000000-0000-0000-0000-000000000020', id, 100000, 'cash' from new_sub;

select tests.authenticate_as('daily-activity@example.test');
select ok(
  exists (
    select 1 from jsonb_array_elements(public.get_daily_activity(public.today_bogota())) e
    where e ->> 'payment_id' = '91000000-0000-0000-0000-000000000020'
      and e ->> 'client_id' = '91000000-0000-0000-0000-000000000001'
      and e ->> 'client_name' = 'Nueva Alta'
      and (e ->> 'amount')::numeric = 100000
      and e ->> 'plan_name' = 'Daily Activity Plan'
      and e ->> 'payment_method_name' = 'Efectivo'
  ),
  'a payment made today carries its client, amount, plan, and payment method label'
);

select * from finish();
rollback;
