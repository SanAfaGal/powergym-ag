-- supabase/migrations/00000000000046_access_events_score_privacy.sql
--
-- match_score is calibration/audit data for admins. If any staff member could
-- read it through the Data API, they could submit probe embeddings and read
-- back the similarity to hill-climb a template -- the very oracle that
-- register_access_attempt avoids by not returning the score (migration 0044).
--
-- Staff keep reading every other audit column (column-level grant: a plain
-- `select *` is refused, so the score cannot be fished for). Admins get the
-- scores through list_access_event_scores().
revoke select on public.access_events from authenticated;
grant select (
  id, occurred_at, client_id, decision, reason_code, method,
  threshold_used, liveness_passed, device_label, user_agent,
  operator_id, model_version
) on public.access_events to authenticated;

create function public.list_access_event_scores(p_limit integer)
returns table (id uuid, match_score real)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin only';
  end if;

  return query
  select e.id, e.match_score
  from public.access_events e
  order by e.occurred_at desc
  limit greatest(p_limit, 0);
end;
$$;

revoke execute on function public.list_access_event_scores(integer) from public;
grant execute on function public.list_access_event_scores(integer) to authenticated;
