-- supabase/migrations/00000000000047_liveness_challenges_setting.sql
--
-- Which liveness challenges the kiosk may ask for becomes an admin setting.
-- The default pool is the three expression challenges: a still photo cannot
-- blink, open its mouth or smile on demand. `turn_any` (head turn to either
-- side) stays OFF by default because a rigid photo tilted in front of the
-- camera also changes the estimated head pose.
--
-- update_access_settings gains a third argument; the old two-argument version
-- is dropped (two overloads would make 2-argument calls ambiguous). A NULL
-- challenges argument keeps the current pool.
alter table public.access_settings
  add column liveness_challenges text[] not null
    default array['blink', 'open_mouth', 'smile'];

alter table public.access_settings
  add constraint access_settings_challenges_valid
  check (liveness_challenges <@ array['blink', 'open_mouth', 'smile', 'turn_any']);

drop function public.update_access_settings(real, boolean);

create function public.update_access_settings(
  p_match_threshold real,
  p_liveness_required boolean,
  p_liveness_challenges text[] default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_effective text[];
begin
  if not public.is_active_admin() then
    raise exception 'admin only';
  end if;

  if p_match_threshold is null or p_match_threshold < 0 or p_match_threshold > 1 then
    raise exception 'invalid threshold';
  end if;

  select coalesce(p_liveness_challenges, s.liveness_challenges)
  into v_effective
  from public.access_settings s;

  if not (v_effective <@ array['blink', 'open_mouth', 'smile', 'turn_any'])
     or (p_liveness_required and cardinality(v_effective) = 0) then
    raise exception 'invalid challenges';
  end if;

  update public.access_settings
  set match_threshold = p_match_threshold,
      liveness_required = p_liveness_required,
      liveness_challenges = v_effective,
      updated_at = now()
  where id;
end;
$$;

revoke execute on function public.update_access_settings(real, boolean, text[]) from public;
grant execute on function public.update_access_settings(real, boolean, text[]) to authenticated;
