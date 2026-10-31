-- supabase/migrations/00000000000048_access_result_details.sql
--
-- The kiosk result card shows more than a name: the plan, how often the client
-- has come this month and when they were last here. register_access_attempt
-- therefore also returns plan_name, visits_this_month (distinct Bogota days
-- with a granted entry, including today's if this attempt was granted) and
-- last_visit (the previous granted entry, never the one just recorded).
--
-- The details are returned only for an identified client; an unrecognized face
-- gets nulls. The similarity score is still never returned (see 0044/0046).
-- The return type changes, so the function is dropped and recreated.
drop function public.register_access_attempt(extensions.vector, boolean, text, text);

create function public.register_access_attempt(
  p_embedding extensions.vector,
  p_liveness_passed boolean,
  p_device_label text,
  p_user_agent text
) returns table (
  decision text,
  reason_code text,
  client_id uuid,
  full_name text,
  alias text,
  subscription_status text,
  end_date date,
  plan_name text,
  visits_this_month integer,
  last_visit timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  v_threshold real;
  v_liveness_required boolean;
  v_client uuid;
  v_score real;
  v_model_version text;
  v_allowed boolean;
  v_reason text;
  v_decision text;
  v_event_id uuid;
  v_visits integer;
  v_last timestamptz;
begin
  if not public.is_active_staff() then
    raise exception 'staff only';
  end if;

  if p_embedding is null
     or vector_dims(p_embedding) is distinct from 512
     or coalesce(vector_norm(p_embedding), 0) = 0 then
    raise exception 'invalid embedding';
  end if;

  select s.match_threshold, s.liveness_required
  into v_threshold, v_liveness_required
  from public.access_settings s;

  -- fail closed: an unknown (NULL) liveness result counts as failed
  if v_liveness_required is not false and not coalesce(p_liveness_passed, false) then
    insert into public.access_events (
      decision, reason_code, threshold_used, liveness_passed,
      device_label, user_agent, operator_id
    ) values (
      'denied', 'liveness_failed', v_threshold, false,
      p_device_label, p_user_agent, auth.uid()
    );
    return query select 'denied'::text, 'liveness_failed'::text, null::uuid,
      null::text, null::text, null::text, null::date,
      null::text, null::integer, null::timestamptz;
    return;
  end if;

  select ft.client_id, (1 - (ft.embedding <=> p_embedding))::real, ft.model_version
  into v_client, v_score, v_model_version
  from public.face_templates ft
  order by ft.embedding <=> p_embedding
  limit 1;

  -- fail closed on every NULL (no template, no score, missing settings row)
  if v_client is null or v_score is null or v_threshold is null
     or not (v_score >= v_threshold) then
    insert into public.access_events (
      decision, reason_code, match_score, threshold_used, liveness_passed,
      device_label, user_agent, operator_id
    ) values (
      'denied', 'face_not_recognized', v_score, v_threshold, coalesce(p_liveness_passed, false),
      p_device_label, p_user_agent, auth.uid()
    );
    return query select 'denied'::text, 'face_not_recognized'::text, null::uuid,
      null::text, null::text, null::text, null::date,
      null::text, null::integer, null::timestamptz;
    return;
  end if;

  select e.allowed, e.reason_code into v_allowed, v_reason
  from public.evaluate_access(v_client) e;
  v_decision := case when v_allowed then 'granted' else 'denied' end;

  insert into public.access_events (
    client_id, decision, reason_code, match_score, threshold_used,
    liveness_passed, device_label, user_agent, operator_id, model_version
  ) values (
    v_client, v_decision, v_reason, v_score, v_threshold,
    coalesce(p_liveness_passed, false), p_device_label, p_user_agent, auth.uid(), v_model_version
  )
  returning id into v_event_id;

  select count(distinct (ev.occurred_at at time zone 'America/Bogota')::date)
  into v_visits
  from public.access_events ev
  where ev.client_id = v_client
    and ev.decision = 'granted'
    and (ev.occurred_at at time zone 'America/Bogota')::date >=
        date_trunc('month', public.today_bogota())::date;

  select max(ev.occurred_at)
  into v_last
  from public.access_events ev
  where ev.client_id = v_client
    and ev.decision = 'granted'
    and ev.id <> v_event_id;

  return query
  select v_decision, v_reason, c.id,
    c.first_name || ' ' || c.last_name, c.alias,
    o.subscription_status::text, o.end_date,
    o.plan_name::text, v_visits, v_last
  from public.clients c
  join public.client_subscription_overview o on o.id = c.id
  where c.id = v_client;
end;
$$;

revoke execute on function public.register_access_attempt(extensions.vector, boolean, text, text) from public;
grant execute on function public.register_access_attempt(extensions.vector, boolean, text, text) to authenticated;
