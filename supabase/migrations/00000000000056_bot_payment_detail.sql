-- Migración 0056: detalle de un pago o venta por su número (comando "pago P85" del bot).
-- Devuelve null si el número no existe. Incluye los anulados (con quién, cuándo y por qué).

create or replace function public.bot_payment_detail(p_number bigint) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    -- pago de membresía vigente
    (select jsonb_build_object(
        'number', p.number, 'cliente', public.bot_full_name(c), 'concepto', public.bot_plan_name(pl),
        'monto', p.amount, 'metodo', public.bot_method_name(p.payment_method),
        'fecha', to_char(p.payment_date at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI'),
        'reportado_por', p.reported_by, 'origen', p.source, 'anulado', false)
     from public.payments p
     join public.subscriptions s on s.id = p.subscription_id
     join public.clients c on c.id = s.client_id
     join public.plans pl on pl.id = s.plan_id
     where p.number = p_number),
    -- venta de producto o servicio (vigente o anulada)
    (select jsonb_build_object(
        'number', ps.number,
        'cliente', coalesce((select public.bot_full_name(c) from public.clients c where c.id = ps.client_id), 'Sin cliente'),
        'concepto', coalesce(pr.name, ps.description), 'monto', ps.amount,
        'metodo', public.bot_method_name(ps.payment_method),
        'fecha', to_char(ps.sold_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI'),
        'reportado_por', ps.reported_by, 'origen', ps.source,
        'anulado', ps.voided_at is not null, 'anulado_por', ps.voided_by, 'motivo', ps.void_reason)
     from public.product_sales ps left join public.products pr on pr.id = ps.product_id
     where ps.number = p_number),
    -- pago de membresía anulado (archivado en voided_payments)
    (select jsonb_build_object(
        'number', v.number, 'cliente', public.bot_full_name(c), 'concepto', public.bot_plan_name(pl),
        'monto', v.amount, 'metodo', public.bot_method_name(v.payment_method),
        'fecha', to_char(v.payment_date at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI'),
        'reportado_por', v.reported_by, 'origen', v.source,
        'anulado', true, 'anulado_por', v.voided_by, 'motivo', v.void_reason)
     from public.voided_payments v
     join public.subscriptions s on s.id = v.subscription_id
     join public.clients c on c.id = s.client_id
     join public.plans pl on pl.id = s.plan_id
     where v.number = p_number)
  )
$$;

revoke execute on function public.bot_payment_detail(bigint) from public, anon, authenticated;
grant execute on function public.bot_payment_detail(bigint) to service_role;
