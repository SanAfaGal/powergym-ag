-- supabase/tests/database/045_access_events_retention.test.sql
--
-- Covers migration 0045: access events older than 12 months are purged by a
-- nightly pg_cron job. The purge function is SECURITY DEFINER and, like
-- expire_subscriptions() (migration 0009), must not be callable by
-- authenticated users -- only by pg_cron / service_role.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(6);

select has_function('public', 'purge_old_access_events', 'purge_old_access_events() exists');

select is(
  (select count(*) from cron.job where jobname = 'purge-access-events'),
  1::bigint,
  'the purge-access-events cron job is scheduled'
);

insert into public.access_events (occurred_at, decision, reason_code, device_label)
values
  (now() - interval '13 months', 'denied', 'face_not_recognized', 'old'),
  (now() - interval '11 months', 'denied', 'face_not_recognized', 'recent');

select is(
  public.purge_old_access_events(),
  1,
  'purge returns the number of events removed'
);

select is(
  (select count(*) from public.access_events where device_label = 'old'),
  0::bigint,
  'the 13-month-old event is gone'
);

select is(
  (select count(*) from public.access_events where device_label = 'recent'),
  1::bigint,
  'the 11-month-old event is kept'
);

select tests.create_supabase_user('purge-staff@example.test', 'purge-staff@example.test');
select tests.authenticate_as('purge-staff@example.test');

select throws_ok(
  $$ select public.purge_old_access_events() $$,
  '42501',
  null,
  'an authenticated user cannot run the purge'
);

select * from finish();
rollback;
