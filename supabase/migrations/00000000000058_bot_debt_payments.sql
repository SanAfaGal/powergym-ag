-- Migración 0058: pagar deudas sueltas desde WhatsApp ("Galindo pagó 6.900" cuando debía 6.900) y ver las
-- deudas pendientes de un cliente.
--
--  * debts.paid_amount: lo abonado a cada deuda. Saldo = amount - paid_amount. La deuda queda 'paid' al
--    llegar a cero. `amount` no se toca, así el historial de lo que se debió se conserva.
--  * El dinero recibido se registra como una venta (product_sales, "Pago de deuda"): así entra al cierre de
--    caja, al reporte del día, se ve con "pago P85" y se anula con "anular P85".
--  * debt_payments: a qué deuda(s) se aplicó cada pago, para reabrir la deuda si el pago se anula.

alter table public.debts add column paid_amount numeric(10,2) not null default 0;
alter table public.debts add constraint debts_paid_amount_check check (paid_amount >= 0 and paid_amount <= amount);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.product_sales(id) on delete cascade,
  debt_id uuid not null references public.debts(id),
  amount numeric(10,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index debt_payments_sale_idx on public.debt_payments (sale_id);
create index debt_payments_debt_idx on public.debt_payments (debt_id);

alter table public.debt_payments enable row level security;
grant select on public.debt_payments to authenticated;
create policy debt_payments_select on public.debt_payments for select to authenticated using (public.is_active_staff());

-- El saldo de las deudas descuenta lo ya abonado.
create or replace function public.bot_client_balance(p_client_number bigint) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  with c as (select public.bot_client_id(p_client_number) as id)
  select coalesce((select sum(d.amount - d.paid_amount) from public.debts d, c
                   where d.client_id = c.id and d.status = 'pending'), 0)
       + coalesce((select sum(b.balance) from public.bot_sub_balances() b, c where b.client_id = c.id), 0)
$$;

create or replace function public.bot_debtors() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with items as (
    select d.client_id, d.concept as concepto, d.amount - d.paid_amount as monto, d.created_at as fecha
    from public.debts d where d.status = 'pending'
    union all
    select b.client_id, 'Saldo de ' || initcap(pl.name), b.balance, b.since
    from public.bot_sub_balances() b join public.plans pl on pl.id = b.plan_id
  )
  select coalesce(jsonb_agg(x order by x->>'cliente_nombre'), '[]'::jsonb) from (
    select jsonb_build_object(
      'cliente_id', c.number, 'cliente_nombre', public.bot_full_name(c),
      'total_debe', sum(i.monto),
      'detalle', jsonb_agg(jsonb_build_object('concepto', i.concepto, 'monto', i.monto, 'fecha', i.fecha) order by i.fecha)
    ) as x
    from items i join public.clients c on c.id = i.client_id
    group by c.id
  ) t
$$;

-- Deudas sueltas pendientes de un cliente (de la más vieja a la más nueva), con su saldo.
create or replace function public.bot_client_debts(p_client_number bigint) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'number', d.number, 'concepto', d.concept, 'monto', d.amount, 'pagado', d.paid_amount,
    'saldo', d.amount - d.paid_amount, 'fecha', d.created_at) order by d.created_at, d.number), '[]'::jsonb)
  from public.debts d
  where d.client_id = public.bot_client_id(p_client_number) and d.status = 'pending'
$$;

-- Paga deudas sueltas: el dinero se aplica a las más viejas primero. No acepta más de lo que debe.
create or replace function public.bot_pay_debt(
  p_client_number bigint, p_amount numeric, p_method text, p_reported_by text, p_original_message text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_client uuid := public.bot_client_id(p_client_number);
  v_method text := public.bot_method(p_method);
  v_total numeric;
  v_left numeric := p_amount;
  v_apply numeric;
  v_debt public.debts;
  v_sale public.product_sales;
begin
  if v_client is null then raise exception 'No encuentro al cliente'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El monto del pago debe ser mayor a cero'; end if;

  select coalesce(sum(amount - paid_amount), 0) into v_total
  from public.debts where client_id = v_client and status = 'pending';
  if v_total = 0 then raise exception 'Este cliente no tiene deudas pendientes'; end if;
  if p_amount > v_total then
    raise exception 'El pago de $% supera lo que debe ($%)', p_amount, v_total;
  end if;

  insert into public.product_sales (client_id, description, amount, payment_method, reported_by, original_message)
  values (v_client, 'Pago de deuda', p_amount, v_method, p_reported_by, p_original_message)
  returning * into v_sale;

  for v_debt in
    select * from public.debts where client_id = v_client and status = 'pending'
    order by created_at, number for update
  loop
    exit when v_left <= 0;
    v_apply := least(v_left, v_debt.amount - v_debt.paid_amount);
    update public.debts
    set paid_amount = paid_amount + v_apply,
        status = case when paid_amount + v_apply >= amount then 'paid' else status end,
        resolved_at = case when paid_amount + v_apply >= amount then now() else resolved_at end
    where id = v_debt.id;
    insert into public.debt_payments (sale_id, debt_id, amount) values (v_sale.id, v_debt.id, v_apply);
    v_left := v_left - v_apply;
  end loop;

  insert into public.events (type, client_id, reported_by, original_message, payment_number, status, data)
  values ('DEUDA_PAGADA', v_client, p_reported_by, p_original_message, v_sale.number, 'CONFIRMADO',
          jsonb_build_object('monto', p_amount, 'saldo_restante', v_total - p_amount));

  return jsonb_build_object('number', v_sale.number, 'saldo_restante', v_total - p_amount);
end;
$$;

-- Anular el pago de una deuda la reabre: se devuelve lo abonado a cada deuda.
create or replace function public.void_product_sale(
  p_number bigint,
  p_voided_by text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.product_sales;
  v_applied record;
begin
  select * into v_sale from public.product_sales where number = p_number for update;
  if not found then
    raise exception 'No encuentro la venta P%', p_number;
  end if;
  if v_sale.voided_at is not null then
    raise exception 'P% ya estaba anulado', p_number;
  end if;
  if not (coalesce(auth.role(), '') = 'service_role' or public.is_active_admin()) then
    raise exception 'Solo un administrador puede anular esta venta';
  end if;

  update public.product_sales
  set voided_at = now(), voided_by = p_voided_by, void_reason = p_reason
  where id = v_sale.id;

  for v_applied in select * from public.debt_payments where sale_id = v_sale.id loop
    update public.debts
    set paid_amount = paid_amount - v_applied.amount,
        status = case when status = 'paid' then 'pending' else status end,
        resolved_at = case when status = 'paid' then null else resolved_at end
    where id = v_applied.debt_id and status <> 'voided';
  end loop;

  return jsonb_build_object('payment_number', p_number, 'client_id', v_sale.client_id, 'amount', v_sale.amount);
end;
$$;

-- Solo la service key (el bot) llama estas funciones
revoke execute on function public.bot_client_debts(bigint) from public, anon, authenticated;
revoke execute on function public.bot_pay_debt(bigint, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.bot_client_debts(bigint) to service_role;
grant execute on function public.bot_pay_debt(bigint, numeric, text, text, text) to service_role;
