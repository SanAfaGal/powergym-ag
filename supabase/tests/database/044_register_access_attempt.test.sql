-- supabase/tests/database/044_register_access_attempt.test.sql
--
-- Covers migration 0044: register_access_attempt() is the single entry point
-- the kiosk calls. It identifies the nearest enrolled face, applies the
-- configurable threshold, asks evaluate_access() for the membership verdict
-- and ALWAYS writes an access_events row (denials included) -- except for an
-- invalid embedding, which is rejected before anything is recorded.
--
-- Embeddings are tiny hand-built vectors: unit axes (orthogonal, so cosine
-- similarity 0) and mixes of two axes (similarity = the mix weights).
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(21);

create function pg_temp.mix(a1 real, a2 real default 0) returns extensions.vector
language sql as $$
  select ('[' || string_agg(
    case g when 1 then a1::text when 2 then a2::text else '0' end, ',') || ']')::extensions.vector
  from generate_series(1, 512) g
$$;

create function pg_temp.axis(p integer) returns extensions.vector
language sql as $$
  select ('[' || string_agg(case when g = p then '1' else '0' end, ',') || ']')::extensions.vector
  from generate_series(1, 512) g
$$;

select has_function('public', 'register_access_attempt', 'register_access_attempt() exists');
select has_function('public', 'update_access_settings', 'update_access_settings() exists');

select tests.create_supabase_user('att-staff@example.test', 'att-staff@example.test');
select tests.create_supabase_user('att-admin@example.test', 'att-admin@example.test');
select tests.create_supabase_user('att-off@example.test', 'att-off@example.test');
update public.profiles set role = 'admin' where id = tests.get_supabase_uid('att-admin@example.test');
update public.profiles set is_active = false where id = tests.get_supabase_uid('att-off@example.test');

select tests.create_plan('Attempt Plan', 100000, 'month', 1);

insert into public.clients (dni_type, dni_number, first_name, last_name, alias)
values
  ('CC', 'ATT-A', 'Ana', 'Activa', 'anita'),
  ('CC', 'ATT-B', 'Beto', 'Vencido', null),
  ('CC', 'ATT-C', 'Carla', 'Desactivada', null);

insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select c.id, p.id, public.today_bogota() + f.s, public.today_bogota() + f.e, f.status, 100000
from (values
  ('ATT-A', 'active',  -5,  25),
  ('ATT-B', 'expired', -40, -10),
  ('ATT-C', 'active',  -5,  25)
) as f(dni, status, s, e)
join public.clients c on c.dni_number = f.dni
cross join (select id from public.plans where name = 'Attempt Plan') p;

-- Enroll directly as the owning role (the enrollment RPCs are covered in 043).
insert into public.biometric_consents (client_id, consent_text_version)
select id, 'test' from public.clients where dni_number in ('ATT-A', 'ATT-B', 'ATT-C');
insert into public.face_templates (client_id, embedding, model_id, model_version, consent_id)
select c.id, f.emb, 'auraface', 'v1', bc.id
from (values ('ATT-A', pg_temp.axis(1)), ('ATT-B', pg_temp.axis(2)), ('ATT-C', pg_temp.axis(3))) as f(dni, emb)
join public.clients c on c.dni_number = f.dni
join public.biometric_consents bc on bc.client_id = c.id;
-- Carla is deactivated AFTER enrolling: her face still matches.
update public.clients set is_active = false where dni_number = 'ATT-C';

select tests.authenticate_as('att-staff@example.test');

select is(
  (select decision || ':' || reason_code || ':' || (client_id = (select id from public.clients where dni_number = 'ATT-A'))::text
   from public.register_access_attempt(pg_temp.axis(1), true, 'recepcion', 'test-agent')),
  'granted:ok:true',
  'an enrolled face with a valid membership is granted and identified'
);

select is(
  (select full_name || '|' || alias || '|' || subscription_status
   from public.register_access_attempt(pg_temp.axis(1), true, 'recepcion', 'test-agent')),
  'Ana Activa|anita|active',
  'the result carries the identified client summary'
);

select is(
  (select decision || ':' || reason_code || ':' || coalesce(client_id::text, 'null')
   from public.register_access_attempt(pg_temp.axis(9), true, 'recepcion', 'test-agent')),
  'denied:face_not_recognized:null',
  'an unknown face is denied and no client is revealed'
);

select is(
  (select decision || ':' || reason_code || ':' || (client_id = (select id from public.clients where dni_number = 'ATT-B'))::text
   from public.register_access_attempt(pg_temp.axis(2), true, 'recepcion', 'test-agent')),
  'denied:subscription_expired:true',
  'an identified client with an expired membership is denied with the reason'
);

select is(
  (select decision || ':' || reason_code from public.register_access_attempt(pg_temp.axis(3), true, 'recepcion', 'test-agent')),
  'denied:client_inactive',
  'a client deactivated after enrolling is still recognized but denied'
);

select is(
  (select decision || ':' || reason_code || ':' || coalesce(client_id::text, 'null')
   from public.register_access_attempt(pg_temp.axis(1), false, 'recepcion', 'test-agent')),
  'denied:liveness_failed:null',
  'a failed liveness check is denied without identifying anyone'
);

select throws_ok(
  $$ select * from public.register_access_attempt(pg_temp.mix(0, 0), true, 'recepcion', 'test-agent') $$,
  'P0001', 'invalid embedding',
  'a zero vector is rejected'
);

select is(
  (select count(*) from public.access_events
   where operator_id = tests.get_supabase_uid('att-staff@example.test')),
  6::bigint,
  'every attempt wrote an event (denials included) and the rejected zero vector wrote none'
);

select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'access_events' and udt_name = 'vector'),
  0::bigint,
  'access_events has no embedding column'
);

-- Ana was already let in earlier in this test, so the 2-minute cooldown (0050)
-- denies her now; what matters here is that she is the one identified.
select is(
  (select (client_id = (select id from public.clients where dni_number = 'ATT-A'))::text
   from public.register_access_attempt(pg_temp.mix(0.8, 0.6), true, 'recepcion', 'test-agent')),
  'true',
  'the nearest enrolled face wins (similarity 0.8 to Ana vs 0.6 to Beto)'
);

select is(
  (select count(*) from public.access_events
   where operator_id = tests.get_supabase_uid('att-staff@example.test')
     and device_label = 'recepcion' and threshold_used = 0.5),
  7::bigint,
  'events record operator, device label and the threshold used'
);

select throws_ok(
  $$ select public.update_access_settings(0.9, true) $$,
  'P0001', 'admin only',
  'an employee cannot change the settings'
);

reset role;
select tests.authenticate_as('att-admin@example.test');

select throws_ok(
  $$ select public.update_access_settings(1.5, true) $$,
  'P0001', 'invalid threshold',
  'a threshold outside 0..1 is rejected'
);

select lives_ok(
  $$ select public.update_access_settings(0.9, true) $$,
  'an admin can raise the threshold'
);

select is(
  (select reason_code from public.register_access_attempt(pg_temp.mix(0.8, 0.6), true, 'recepcion', 'test-agent')),
  'face_not_recognized',
  'with the threshold at 0.9 the same 0.8-similarity face is no longer recognized'
);

select throws_ok(
  $$ select * from public.register_access_attempt(null::extensions.vector, true, 'recepcion', 'test-agent') $$,
  'P0001', 'invalid embedding',
  'a NULL embedding is rejected (never falls through to a match)'
);

select is(
  (select decision || ':' || reason_code || ':' || coalesce(client_id::text, 'null')
   from public.register_access_attempt(pg_temp.axis(1), null, 'recepcion', 'test-agent')),
  'denied:liveness_failed:null',
  'an unknown (NULL) liveness result counts as failed'
);

select is(
  (select to_jsonb(r) ? 'match_score' from public.register_access_attempt(pg_temp.axis(9), true, 'recepcion', 'test-agent') r),
  false,
  'the result never exposes the similarity score (it would be a hill-climbing oracle); it stays in access_events'
);

reset role;
select tests.authenticate_as('att-off@example.test');
select throws_ok(
  $$ select * from public.register_access_attempt(pg_temp.axis(1), true, 'recepcion', 'test-agent') $$,
  'P0001', 'staff only',
  'an inactive staff member cannot register attempts'
);

select * from finish();
rollback;
