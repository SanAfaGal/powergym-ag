-- Migración 0060: cerrar una duda del bot desde el panel (pantalla "Hoy").
-- Equivale a escribir "D26 resuelta" en el grupo: la duda queda resuelta y no se registra nada.
-- El panel solo lee las tablas del bot, por eso el cierre pasa por esta función (cualquier staff activo).

create or replace function public.close_clarification(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.clarifications;
  v_name text;
begin
  if not public.is_active_staff() then
    raise exception 'Solo el staff activo puede cerrar una duda';
  end if;

  select * into v_row from public.clarifications where id = p_id for update;
  if not found then
    raise exception 'No encuentro la duda D%', p_id;
  end if;
  if v_row.status = 'resolved' then
    raise exception 'D% ya estaba resuelta', p_id;
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  update public.clarifications
  set status = 'resolved',
      answer = '(cerrada desde el panel por ' || coalesce(v_name, 'staff') || ')',
      resolved_at = now()
  where id = p_id;
end;
$$;

revoke execute on function public.close_clarification(bigint) from public, anon;
grant execute on function public.close_clarification(bigint) to authenticated;
