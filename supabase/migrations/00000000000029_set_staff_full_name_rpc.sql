-- supabase/migrations/00000000000029_set_staff_full_name_rpc.sql
create or replace function public.set_staff_full_name(
  p_target uuid,
  p_full_name text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'only an admin can change staff full name';
  end if;

  update public.profiles set full_name = p_full_name where id = p_target;
end;
$$;

-- Same reasoning as set_staff_role/set_staff_active (migration 0010): profiles
-- has no UPDATE grant to authenticated, this SECURITY DEFINER function is the
-- gated path to it, and EXECUTE is re-granted to authenticated (not
-- service_role) since an admin calls this while authenticated as themselves.
revoke execute on function public.set_staff_full_name(uuid, text) from public;
grant execute on function public.set_staff_full_name(uuid, text) to authenticated;
