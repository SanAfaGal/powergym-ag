-- Migración 0061: lista de deudores para el panel.
-- Junta lo mismo que ve el bot (bot_client_debts): deudas sueltas pendientes + saldo de membresías
-- activas o pendientes de pago. El panel no puede leer bot_sub_balances (solo service key),
-- por eso pasa por esta función, que exige staff activo.

create or replace function public.panel_debtors()
returns table (
  client_id uuid,
  first_name text,
  last_name text,
  phone text,
  total numeric,
  since timestamptz,
  detail jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_staff() then
    raise exception 'Solo el staff activo puede ver los deudores';
  end if;

  return query
  with lineas as (
    select d.client_id as cid, coalesce(d.concept, 'Deuda') as concepto,
           d.amount - d.paid_amount as saldo, d.created_at as fecha
    from public.debts d
    where d.status = 'pending'
    union all
    select b.client_id, 'Saldo de ' || initcap(pl.name), b.balance, b.since
    from public.bot_sub_balances() b
    join public.plans pl on pl.id = b.plan_id
  )
  select c.id, c.first_name::text, c.last_name::text, c.phone::text,
         sum(l.saldo), min(l.fecha),
         jsonb_agg(jsonb_build_object('concepto', l.concepto, 'saldo', l.saldo, 'fecha', l.fecha)
                   order by l.fecha)
  from lineas l
  join public.clients c on c.id = l.cid
  group by c.id, c.first_name, c.last_name, c.phone
  order by min(l.fecha);
end;
$$;

revoke execute on function public.panel_debtors() from public, anon;
grant execute on function public.panel_debtors() to authenticated;
