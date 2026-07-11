-- supabase/tests/database/009_cron_jobs.test.sql
--
-- NOTE: every pgTAP assertion below passes an explicit description as the
-- final argument (see 003_clients.test.sql for the full explanation of why
-- this is required with pgtap 1.3.3 installed in this project).
--
-- NOTE: reviewed the brief's literal SQL for the snapshot/ordering pitfall
-- found in Task 13 (calling a function that UPDATEs and then reading the
-- result back within the SAME top-level statement, which cannot see the
-- write because the statement runs on one fixed snapshot). That does not
-- apply here: each `select is(...)` below is its own top-level command, so
-- the status re-check after `expire_subscriptions()` runs in a fresh
-- statement/snapshot that does see the committed update. No changes needed.
begin;
select plan(3);

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'CRON-CLIENT-1', 'Cron', 'Client'), ('CC', 'CRON-CLIENT-2', 'Cron', 'Client2');
insert into public.plans (name, price, duration_unit, duration_count)
values ('Cron Plan', 50000, 'month', 1);

insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
values (
  (select id from public.clients where dni_number = 'CRON-CLIENT-1'),
  (select id from public.plans where name = 'Cron Plan'),
  current_date - 60, current_date - 1, 'active', 50000
);
insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
values (
  (select id from public.clients where dni_number = 'CRON-CLIENT-2'),
  (select id from public.plans where name = 'Cron Plan'),
  current_date, current_date + 30, 'scheduled', 50000
);

select is(public.expire_subscriptions(), 1, 'expire_subscriptions expires exactly the one overdue active subscription');
select is(
  (select status from public.subscriptions where client_id = (select id from public.clients where dni_number = 'CRON-CLIENT-1')),
  'expired'::subscription_status_enum,
  'the overdue subscription is now expired'
);
select is(public.activate_scheduled_subscriptions(), 1, 'activate_scheduled_subscriptions activates the one due scheduled subscription');

select * from finish();
rollback;
