-- supabase/tests/database/050_access_cooldown.test.sql
--
-- Covers migration 0050: a client who was just let in is not let in again for
-- the admin-set cooldown (default two minutes, 0 = off; anti-passback). The second attempt is denied with
-- 'recently_admitted', recorded as a denied event, and adds no granted entry
-- (so attendance is not inflated). An entry older than the window does not block.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(12);

create function pg_temp.axis(p integer) returns extensions.vector
language sql as $$
  select ('[' || string_agg(case when g = p then '1' else '0' end, ',') || ']')::extensions.vector
  from generate_series(1, 512) g
$$;

select tests.create_supabase_user('cd-staff@example.test', 'cd-staff@example.test');
select tests.create_supabase_user('cd-admin@example.test', 'cd-admin@example.test');
update public.profiles set role = 'admin'
  where id = tests.get_supabase_uid('cd-admin@example.test');
select tests.create_plan('Cooldown Plan', 100000, 'month', 1);

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'CD-A', 'Ana', 'Reciente'), ('CC', 'CD-B', 'Beto', 'Antiguo'),
       ('CC', 'CD-C', 'Cata', 'Tres');

insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select c.id, p.id, public.today_bogota() - 5, public.today_bogota() + 25, 'active', 100000
from public.clients c
cross join (select id from public.plans where name = 'Cooldown Plan') p
where c.dni_number in ('CD-A', 'CD-B', 'CD-C');

insert into public.biometric_consents (client_id, consent_text_version)
select id, 'test' from public.clients where dni_number in ('CD-A', 'CD-B', 'CD-C');
insert into public.face_templates (client_id, embedding, model_id, model_version, consent_id)
select c.id, f.emb, 'auraface', 'v1', bc.id
from (values ('CD-A', pg_temp.axis(1)), ('CD-B', pg_temp.axis(2)), ('CD-C', pg_temp.axis(3))) as f(dni, emb)
join public.clients c on c.dni_number = f.dni
join public.biometric_consents bc on bc.client_id = c.id;

-- Beto and Cata came in 3 minutes ago: outside the default 2-minute window
-- (Cata is kept for the 5-minute check, untouched by the other assertions)
insert into public.access_events (occurred_at, client_id, decision, reason_code)
select now() - interval '3 minutes', c.id, 'granted', 'ok'
from public.clients c where c.dni_number in ('CD-B', 'CD-C');

select tests.authenticate_as('cd-staff@example.test');

create temp table first_try on commit drop as
select * from public.register_access_attempt(pg_temp.axis(1), true, 'recepcion', 'test-agent');
grant select on first_try to authenticated;

create temp table second_try on commit drop as
select * from public.register_access_attempt(pg_temp.axis(1), true, 'recepcion', 'test-agent');
grant select on second_try to authenticated;

select is(
  (select decision || ':' || reason_code from first_try),
  'granted:ok',
  'the first attempt of a client is granted'
);

select is(
  (select decision || ':' || reason_code from second_try),
  'denied:recently_admitted',
  'an immediate second attempt by the same client is denied as recently_admitted'
);

select is(
  (select full_name from second_try),
  'Ana Reciente',
  'the recently_admitted result still identifies the client'
);

select is(
  (select count(*) from public.access_events e
   join public.clients c on c.id = e.client_id
   where c.dni_number = 'CD-A' and e.decision = 'granted'),
  1::bigint,
  'the blocked attempt adds no granted entry, so attendance is not inflated'
);

select is(
  (select count(*) from public.access_events e
   join public.clients c on c.id = e.client_id
   where c.dni_number = 'CD-A' and e.reason_code = 'recently_admitted'),
  1::bigint,
  'the blocked attempt is recorded as one denied event'
);

select is(
  (select decision || ':' || reason_code
   from public.register_access_attempt(pg_temp.axis(2), true, 'recepcion', 'test-agent')),
  'granted:ok',
  'a client whose last entry is older than the window is granted again'
);

-- the window is a setting
select is(
  (select readmit_cooldown_minutes from public.access_settings),
  2,
  'the default cooldown is two minutes'
);

select throws_ok(
  $$ select public.update_access_settings(0.5, true, null, 10) $$,
  'P0001', 'admin only',
  'an employee cannot change the cooldown'
);

reset role;
select tests.authenticate_as('cd-admin@example.test');

select throws_ok(
  $$ select public.update_access_settings(0.5, true, null, 61) $$,
  'P0001', 'invalid cooldown',
  'a cooldown above 60 minutes is rejected'
);

select public.update_access_settings(0.5, true, null, 5);

select is(
  (select decision || ':' || reason_code
   from public.register_access_attempt(pg_temp.axis(3), true, 'recepcion', 'test-agent')),
  'denied:recently_admitted',
  'with a 5-minute cooldown, an entry 3 minutes ago still blocks'
);

select public.update_access_settings(0.5, true, null, 0);

select is(
  (select decision || ':' || reason_code
   from public.register_access_attempt(pg_temp.axis(1), true, 'recepcion', 'test-agent')),
  'granted:ok',
  'with the cooldown at 0 the same face is granted again'
);

select public.update_access_settings(0.5, true);

select is(
  (select readmit_cooldown_minutes from public.access_settings),
  0,
  'a call without the cooldown argument keeps the current value'
);

select * from finish();
rollback;
