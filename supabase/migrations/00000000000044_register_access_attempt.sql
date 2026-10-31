-- supabase/migrations/00000000000044_register_access_attempt.sql
--
-- Single entry point for an access attempt. Identification (nearest enrolled
-- face above the configurable threshold) is kept apart from authorization
-- (evaluate_access, migration 0042), so another identification method can
-- reuse the same verdict later.
--
-- Every attempt writes an access_events row, denials included. The one
-- exception is an invalid embedding, which is rejected before anything is
-- recorded. Events hold the outcome only: never an embedding or an image.
--
-- The result reveals client details only when the face was identified; an
-- unrecognized face returns no client. It never returns the similarity score
-- (a score the caller can read is an oracle for hill-climbing a template);
-- the score is kept in access_events for audit only. Exception messages are an exact-match
-- contract with the server actions: 'staff only', 'admin only',
-- 'invalid embedding', 'invalid threshold'.

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
  end_date date
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
      null::text, null::text, null::text, null::date;
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
      null::text, null::text, null::text, null::date;
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
  );

  return query
  select v_decision, v_reason, c.id,
    c.first_name || ' ' || c.last_name, c.alias,
    o.subscription_status::text, o.end_date
  from public.clients c
  join public.client_subscription_overview o on o.id = c.id
  where c.id = v_client;
end;
$$;

create function public.update_access_settings(
  p_match_threshold real,
  p_liveness_required boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin only';
  end if;

  if p_match_threshold is null or p_match_threshold < 0 or p_match_threshold > 1 then
    raise exception 'invalid threshold';
  end if;

  update public.access_settings
  set match_threshold = p_match_threshold,
      liveness_required = p_liveness_required,
      updated_at = now()
  where id;
end;
$$;

revoke execute on function public.register_access_attempt(extensions.vector, boolean, text, text) from public;
revoke execute on function public.update_access_settings(real, boolean) from public;
grant execute on function public.register_access_attempt(extensions.vector, boolean, text, text) to authenticated;
grant execute on function public.update_access_settings(real, boolean) to authenticated;
