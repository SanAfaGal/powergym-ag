-- supabase/migrations/00000000000049_event_scores_by_id.sql
--
-- The admin audit view is now filtered and paged, so "the N most recent scores"
-- (migration 0046) no longer matches the rows on screen. The scores are asked
-- for by event id instead. Same rule as before: match_score stays unreadable
-- for staff, only an admin gets it, and only for the ids they pass.
drop function public.list_access_event_scores(integer);

create function public.list_access_event_scores(p_ids uuid[])
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
  where e.id = any (p_ids);
end;
$$;

revoke execute on function public.list_access_event_scores(uuid[]) from public;
grant execute on function public.list_access_event_scores(uuid[]) to authenticated;
