-- supabase/migrations/00000000000050_access_cooldown.sql
--
-- Anti-passback. A client who was granted entry within the cooldown (admin
-- setting access_settings.readmit_cooldown_minutes, default 2, 0 = off) is
-- denied with reason 'recently_admitted' instead of being granted again: the
-- barrier must not be reopened by repeating the same face, which would let a
-- second person walk in behind. The attempt is still recorded (as denied), no
-- extra granted entry is created, so attendance counts are unchanged.
--
-- register_access_attempt keeps its signature and return type, so it is
-- replaced in place; everything else is as in 0048. update_access_settings
-- gains a fourth argument (NULL keeps the current value); the three-argument
-- version is dropped so calls are not ambiguous.
alter table public.access_settings
  add column readmit_cooldown_minutes integer not null default 2
    check (readmit_cooldown_minutes between 0 and 60);

drop function public.update_access_settings(real, boolean, text[]);

create function public.update_access_settings(
  p_match_threshold real,
  p_liveness_required boolean,
  p_liveness_challenges text[] default null,
  p_readmit_cooldown_minutes integer default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_effective text[];
  v_cooldown integer;
begin
  if not public.is_active_admin() then
    raise exception 'admin only';
  end if;

  if p_match_threshold is null or p_match_threshold < 0 or p_match_threshold > 1 then
    raise exception 'invalid threshold';
  end if;

  select coalesce(p_liveness_challenges, s.liveness_challenges),
         coalesce(p_readmit_cooldown_minutes, s.readmit_cooldown_minutes)
  into v_effective, v_cooldown
  from public.access_settings s;

  if not (v_effective <@ array['blink', 'open_mouth', 'smile', 'turn_any'])
     or (p_liveness_required and cardinality(v_effective) = 0) then
    raise exception 'invalid challenges';
  end if;

  if v_cooldown not between 0 and 60 then
    raise exception 'invalid cooldown';
  end if;

  update public.access_settings
  set match_threshold = p_match_threshold,
      liveness_required = p_liveness_required,
      liveness_challenges = v_effective,
      readmit_cooldown_minutes = v_cooldown,
      updated_at = now()
  where id;
end;
$$;

revoke execute on function public.update_access_settings(real, boolean, text[], integer) from public;
grant execute on function public.update_access_settings(real, boolean, text[], integer) to authenticated;

create or replace function public.register_access_attempt(
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
  v_cooldown integer;
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

  select s.match_threshold, s.liveness_required, s.readmit_cooldown_minutes
  into v_threshold, v_liveness_required, v_cooldown
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

  -- anti-passback: someone who was just let in is not let in again until the
  -- cooldown passes (0 turns it off). Otherwise a person standing at the kiosk could keep the barrier
  -- open for whoever walks in behind them. Only a real entry starts the window
  -- (a blocked attempt is denied, so it never extends it).
  if v_allowed and coalesce(v_cooldown, 0) > 0 and exists (
    select 1
    from public.access_events ev
    where ev.client_id = v_client
      and ev.decision = 'granted'
      and ev.occurred_at > now() - make_interval(mins => v_cooldown)
  ) then
    v_allowed := false;
    v_reason := 'recently_admitted';
  end if;

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
