-- supabase/tests/database/048_access_result_details.test.sql
--
-- Covers migration 0048: register_access_attempt also returns what the staff
-- needs to read the result at a glance -- the plan name, how many distinct days
-- the client has been granted entry this month (Bogota time), and the time of
-- their previous granted entry. Nothing identifying is returned for an
-- unrecognized face.
--
-- Every assertion passes an explicit description (see 003_clients.test.sql).
begin;
select plan(6);

create function pg_temp.axis(p integer) returns extensions.vector
language sql as $$
  select ('[' || string_agg(case when g = p then '1' else '0' end, ',') || ']')::extensions.vector
  from generate_series(1, 512) g
$$;

select tests.create_supabase_user('det-staff@example.test', 'det-staff@example.test');
select tests.create_plan('Detalle Plan', 100000, 'month', 1);

insert into public.clients (dni_type, dni_number, first_name, last_name)
values ('CC', 'DET-A', 'Dora', 'Detalle'), ('CC', 'DET-B', 'Bruno', 'Vencido');

insert into public.subscriptions (client_id, plan_id, start_date, end_date, status, base_price)
select c.id, p.id, public.today_bogota() + f.s, public.today_bogota() + f.e, f.status, 100000
from (values ('DET-A', 'active', -5, 25), ('DET-B', 'expired', -40, -10)) as f(dni, status, s, e)
join public.clients c on c.dni_number = f.dni
cross join (select id from public.plans where name = 'Detalle Plan') p;

insert into public.biometric_consents (client_id, consent_text_version)
select id, 'test' from public.clients where dni_number in ('DET-A', 'DET-B');
insert into public.face_templates (client_id, embedding, model_id, model_version, consent_id)
select c.id, f.emb, 'auraface', 'v1', bc.id
from (values ('DET-A', pg_temp.axis(1)), ('DET-B', pg_temp.axis(2))) as f(dni, emb)
join public.clients c on c.dni_number = f.dni
join public.biometric_consents bc on bc.client_id = c.id;

-- two earlier granted entries for Dora; the most recent one is "3 hours ago"
insert into public.access_events (occurred_at, client_id, decision, reason_code)
select t.ts, c.id, 'granted', 'ok'
from public.clients c,
     (values (now() - interval '5 hours'), (now() - interval '3 hours')) as t(ts)
where c.dni_number = 'DET-A';

-- distinct Bogota days already counted this month, and whether today is one
create temp table before_stats on commit drop as
select
  count(distinct (e.occurred_at at time zone 'America/Bogota')::date) as days,
  coalesce(bool_or((e.occurred_at at time zone 'America/Bogota')::date = public.today_bogota()), false) as has_today
from public.access_events e
join public.clients c on c.id = e.client_id
where c.dni_number = 'DET-A'
  and e.decision = 'granted'
  and (e.occurred_at at time zone 'America/Bogota')::date >=
      date_trunc('month', public.today_bogota())::date;
grant select on before_stats to authenticated;

select tests.authenticate_as('det-staff@example.test');

create temp table granted_result on commit drop as
select * from public.register_access_attempt(pg_temp.axis(1), true, 'recepcion', 'test-agent');
grant select on granted_result to authenticated;

select is(
  (select plan_name from granted_result),
  'Detalle Plan',
  'a granted result carries the plan name'
);

select is(
  (select decision || ':' || reason_code from granted_result),
  'granted:ok',
  'the attempt itself was granted'
);

select is(
  (select last_visit from granted_result),
  (select max(occurred_at) from public.access_events e
   join public.clients c on c.id = e.client_id
   where c.dni_number = 'DET-A' and e.decision = 'granted'
     and e.occurred_at < now() - interval '1 hour'),
  'last_visit is the previous granted entry, not the one just recorded'
);

select is(
  (select visits_this_month from granted_result),
  (select days + case when has_today then 0 else 1 end from before_stats)::integer,
  'visits_this_month counts distinct Bogota days, today included once'
);

select is(
  (select plan_name from public.register_access_attempt(pg_temp.axis(2), true, 'recepcion', 'test-agent')),
  'Detalle Plan',
  'a denied but identified client also carries the plan name'
);

select is(
  (select plan_name || visits_this_month::text || last_visit::text
   from public.register_access_attempt(pg_temp.axis(9), true, 'recepcion', 'test-agent')),
  null,
  'an unrecognized face returns no details'
);

select * from finish();
rollback;
