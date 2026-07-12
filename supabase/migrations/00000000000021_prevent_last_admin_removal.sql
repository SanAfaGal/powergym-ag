-- supabase/migrations/00000000000021_prevent_last_admin_removal.sql
--
-- Whole-branch review of feature/dashboard-redesign flagged that the new
-- Staff screen renders the role-change Select and the activate/deactivate
-- control for EVERY row, including the currently-authenticated admin's own
-- row, and that neither set_staff_role nor set_staff_active (migration 0010)
-- guards against demoting/deactivating the LAST remaining active admin. An
-- admin could demote or deactivate themselves (or the last OTHER admin) in
-- two clicks, and recovery would require going directly into Supabase --
-- exactly the manual step this feature was built to eliminate.
--
-- The UI now disables both controls on the caller's own row (see
-- src/modules/staff/components/StaffActions.tsx), but that's advisory only
-- -- it doesn't stop a second admin tab, a replayed request, or a future
-- caller of these RPCs that forgets the check. This migration adds the
-- authoritative guard at the data layer: before applying either mutation,
-- if the target is CURRENTLY an active admin and the requested change would
-- flip them to non-admin-or-inactive, count the remaining active admins
-- excluding the target -- if that would be zero, refuse with a clear
-- message instead of applying the update. This covers self-lockout AND an
-- admin removing the last OTHER admin; it does not care who's calling, only
-- what the resulting admin count would be.
create or replace function public.set_staff_role(
  p_target uuid,
  p_role app_role
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'only an admin can change staff roles';
  end if;

  if p_role <> 'admin' and exists (
    select 1 from public.profiles
    where id = p_target and role = 'admin' and is_active
  ) and not exists (
    select 1 from public.profiles
    where role = 'admin' and is_active and id <> p_target
  ) then
    raise exception 'No puedes remover al último administrador activo';
  end if;

  update public.profiles set role = p_role where id = p_target;
end;
$$;

create or replace function public.set_staff_active(
  p_target uuid,
  p_active boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'only an admin can activate/deactivate staff';
  end if;

  if not p_active and exists (
    select 1 from public.profiles
    where id = p_target and role = 'admin' and is_active
  ) and not exists (
    select 1 from public.profiles
    where role = 'admin' and is_active and id <> p_target
  ) then
    raise exception 'No puedes remover al último administrador activo';
  end if;

  update public.profiles set is_active = p_active where id = p_target;
end;
$$;
