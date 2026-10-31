-- supabase/tests/database/046_access_events_score_privacy.test.sql
--
-- Covers migration 0046: match_score in access_events is a calibration/audit
-- value for admins only. If any staff member could read it through the API
-- they could submit probe embeddings and read back the similarity to hill-
-- climb a template, which is exactly what register_access_attempt avoids by
-- not returning the score. Staff keep reading every other event column;
-- admins get the scores through list_access_event_scores().
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(7);

select has_function('public', 'list_access_event_scores', 'list_access_event_scores() exists');

select tests.create_supabase_user('score-staff@example.test', 'score-staff@example.test');
select tests.create_supabase_user('score-admin@example.test', 'score-admin@example.test');
update public.profiles set role = 'admin'
  where id = tests.get_supabase_uid('score-admin@example.test');

insert into public.access_events (decision, reason_code, match_score, device_label)
values ('denied', 'face_not_recognized', 0.42, 'scoretest');

select tests.authenticate_as('score-staff@example.test');

select lives_ok(
  $$ select id, occurred_at, decision, reason_code, device_label from public.access_events $$,
  'staff can still read the audit columns of access_events'
);

select throws_ok(
  $$ select match_score from public.access_events $$,
  '42501', null,
  'staff cannot read match_score directly'
);

select throws_ok(
  $$ select * from public.access_events $$,
  '42501', null,
  'select * is refused too, so a client cannot fish for the score'
);

select throws_ok(
  $$ select * from public.list_access_event_scores(10) $$,
  'P0001', 'admin only',
  'an employee cannot call list_access_event_scores'
);

reset role;
select tests.authenticate_as('score-admin@example.test');

select is(
  (select match_score from public.list_access_event_scores(10)
   where id = (select id from public.access_events where device_label = 'scoretest')),
  0.42::real,
  'an admin gets the score through the RPC'
);

select is(
  (select count(*) from public.list_access_event_scores(0)),
  0::bigint,
  'the limit is honored'
);

select * from finish();
rollback;
