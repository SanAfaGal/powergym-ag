-- Migración 0059: "Fulanita pagó 10.000" cuando le quedaban 10.000 de una mensualidad abonada.
-- El pago de deuda (bot_pay_debt) ahora cubre dos cosas, de lo más viejo a lo más nuevo:
--   * deudas sueltas  -> se registran como "Pago de deuda" (venta, como en la 0058)
--   * saldo de una membresía abonada -> es un pago más de esa membresía (record_payment): se ve como
--     pago P de la persona, completa la membresía y se anula como cualquier pago de membresía.
-- bot_client_debts también lista esos saldos, para que el bot sepa que la persona debe.

create or replace function public.bot_client_debts(p_client_number bigint) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with c as (select public.bot_client_id(p_client_number) as id),
  items as (
    select d.number as tie, d.concept as concepto, d.amount as monto, d.paid_amount as pagado,
           d.amount - d.paid_amount as saldo, d.created_at as fecha
    from public.debts d, c where d.client_id = c.id and d.status = 'pending'
    union all
    select 0::bigint, 'Saldo de ' || initcap(pl.name), b.balance, 0::numeric, b.balance, b.since
    from public.bot_sub_balances() b join public.plans pl on pl.id = b.plan_id, c
    where b.client_id = c.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'concepto', concepto, 'monto', monto, 'pagado', pagado, 'saldo', saldo, 'fecha', fecha) order by fecha, tie), '[]'::jsonb)
  from items
$$;

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
  v_item record;
  v_alloc jsonb := '[]'::jsonb;     -- reparto: [{kind, id, amount}]
  v_loose numeric;
  v_sale public.product_sales;
  v_pay public.payments;
  v_entries jsonb := '[]'::jsonb;
begin
  if v_client is null then raise exception 'No encuentro al cliente'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El monto del pago debe ser mayor a cero'; end if;

  v_total := public.bot_client_balance(p_client_number);
  if v_total = 0 then raise exception 'Este cliente no tiene deudas pendientes'; end if;
  if p_amount > v_total then
    raise exception 'El pago de $% supera lo que debe ($%)', p_amount, v_total;
  end if;

  -- 1. reparto: primero lo más viejo (deudas sueltas y saldos de membresías que aceptan pagos)
  for v_item in
    select * from (
      select 'debt'::text as kind, d.id, d.amount - d.paid_amount as balance, d.created_at as since, d.number as tie
      from public.debts d where d.client_id = v_client and d.status = 'pending'
      union all
      select 'subscription', b.subscription_id, b.balance, b.since, 0::bigint
      from public.bot_sub_balances() b join public.subscriptions s on s.id = b.subscription_id
      where b.client_id = v_client and s.status = 'pending_payment'
    ) x order by since, tie
  loop
    exit when v_left <= 0;
    v_apply := least(v_left, v_item.balance);
    v_alloc := v_alloc || jsonb_build_object('kind', v_item.kind, 'id', v_item.id, 'amount', v_apply);
    v_left := v_left - v_apply;
  end loop;
  if v_left > 0 then
    raise exception 'No pude aplicar todo el pago ($% sin aplicar): revisa la membresía en el panel', v_left;
  end if;

  -- 2. lo que va a deudas sueltas es UNA venta "Pago de deuda"
  select coalesce(sum((a->>'amount')::numeric), 0) into v_loose
  from jsonb_array_elements(v_alloc) a where a->>'kind' = 'debt';
  if v_loose > 0 then
    insert into public.product_sales (client_id, description, amount, payment_method, reported_by, original_message)
    values (v_client, 'Pago de deuda', v_loose, v_method, p_reported_by, p_original_message)
    returning * into v_sale;
    v_entries := v_entries || jsonb_build_object('kind', 'debt_payment', 'number', v_sale.number);
  end if;

  -- 3. aplicar cada parte
  for v_item in
    select a->>'kind' as kind, (a->>'id')::uuid as id, (a->>'amount')::numeric as amount
    from jsonb_array_elements(v_alloc) a
  loop
    if v_item.kind = 'debt' then
      update public.debts
      set paid_amount = paid_amount + v_item.amount,
          status = case when paid_amount + v_item.amount >= amount then 'paid' else status end,
          resolved_at = case when paid_amount + v_item.amount >= amount then now() else resolved_at end
      where id = v_item.id;
      insert into public.debt_payments (sale_id, debt_id, amount) values (v_sale.id, v_item.id, v_item.amount);
    else
      v_pay := public.record_payment(
        v_item.id, v_item.amount, v_method, null, null, null, p_reported_by, 'whatsapp', p_original_message
      );
      v_entries := v_entries || jsonb_build_object('kind', 'payment', 'number', v_pay.number);
    end if;
  end loop;

  insert into public.events (type, client_id, reported_by, original_message, payment_number, status, data)
  values ('DEUDA_PAGADA', v_client, p_reported_by, p_original_message, (v_entries->0->>'number')::bigint, 'CONFIRMADO',
          jsonb_build_object('monto', p_amount, 'saldo_restante', v_total - p_amount, 'entries', v_entries));

  return jsonb_build_object('number', (v_entries->0->>'number')::bigint, 'entries', v_entries,
                            'saldo_restante', v_total - p_amount);
end;
$$;

-- Anular el pago de una deuda suelta: además de reabrirla, avisa cuánto se reabrió (debt_reopened).
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
  v_reopened numeric := 0;
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
    if found then v_reopened := v_reopened + v_applied.amount; end if;
  end loop;

  return jsonb_build_object('payment_number', p_number, 'client_id', v_sale.client_id,
                            'amount', v_sale.amount, 'debt_reopened', v_reopened);
end;
$$;

-- Anular el pago que activó una membresía la cancela. Si la persona tenía membresías encadenadas
-- después (renovaciones que empezaban al terminar esa), sus fechas se corren hacia atrás para que no
-- queden huecos: cada una pasa a empezar donde terminaba la anterior. Se devuelve cuántas se corrieron.
create or replace function public.void_payment(
  p_number bigint,
  p_voided_by text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pay public.payments;
  v_sub public.subscriptions;
  v_paid numeric(10,2);
  v_canceled boolean := false;
  v_later boolean;
  v_shifted int := 0;
  v_next record;
  v_exp date;
  v_new_start date;
  v_span int;
begin
  select * into v_pay from public.payments where number = p_number for update;
  if not found then
    raise exception 'No encuentro el pago P%', p_number;
  end if;

  if not (
    coalesce(auth.role(), '') = 'service_role'
    or public.is_active_admin()
    or (public.is_active_staff() and v_pay.received_by = auth.uid())
  ) then
    raise exception 'Solo un administrador o quien registró el pago puede anularlo';
  end if;

  select * into v_sub from public.subscriptions where id = v_pay.subscription_id for update;

  insert into public.voided_payments (
    id, number, subscription_id, amount, payment_method, payment_date, received_by,
    reported_by, source, original_message, notes, bank_account_id, voided_by, void_reason
  ) values (
    v_pay.id, v_pay.number, v_pay.subscription_id, v_pay.amount, v_pay.payment_method, v_pay.payment_date,
    v_pay.received_by, v_pay.reported_by, v_pay.source, v_pay.original_message, v_pay.notes,
    v_pay.bank_account_id, p_voided_by, p_reason
  );
  delete from public.payments where id = v_pay.id;

  select coalesce(sum(amount), 0) into v_paid from public.payments where subscription_id = v_sub.id;

  if v_paid = 0 and v_sub.status in ('active', 'pending_payment', 'scheduled') then
    update public.subscriptions
    set status = 'canceled',
        cancellation_date = public.today_bogota(),
        cancellation_reason = 'Pago P' || p_number || ' anulado'
    where id = v_sub.id;
    v_canceled := true;

    -- correr hacia atrás las membresías encadenadas que aún no se pagaron del todo
    v_exp := v_sub.end_date + 1;          -- cuándo empezaría la siguiente si está pegada a esta
    v_new_start := v_sub.start_date;      -- y dónde pasa a empezar
    for v_next in
      select * from public.subscriptions
      where client_id = v_sub.client_id and id <> v_sub.id
        and start_date > v_sub.start_date
        and status in ('pending_payment', 'scheduled')
      order by start_date
      for update
    loop
      -- solo las pegadas a la cadena: empiezan justo cuando terminaba la anterior de la cadena
      exit when v_next.start_date <> v_exp;
      v_span := v_next.end_date - v_next.start_date;
      update public.subscriptions
      set start_date = v_new_start,
          end_date = v_new_start + v_span,
          status = case when status = 'scheduled' and v_new_start <= public.today_bogota()
                        then 'pending_payment' else status end
      where id = v_next.id;
      v_exp := v_next.end_date + 1;
      v_new_start := v_new_start + v_span + 1;
      v_shifted := v_shifted + 1;
    end loop;

    if v_sub.status = 'active' then
      update public.subscriptions
      set status = 'pending_payment'
      where client_id = v_sub.client_id
        and status = 'scheduled'
        and start_date <= public.today_bogota();
    end if;
  elsif v_sub.status = 'active' and v_paid < v_sub.final_price then
    update public.subscriptions set status = 'pending_payment' where id = v_sub.id;
  end if;

  update public.voided_payments set subscription_canceled = v_canceled where id = v_pay.id;

  select exists (
    select 1 from public.subscriptions
    where client_id = v_sub.client_id
      and id <> v_sub.id
      and start_date > v_sub.start_date
      and status in ('active', 'pending_payment', 'scheduled')
  ) into v_later;

  return jsonb_build_object(
    'payment_number', p_number,
    'client_id', v_sub.client_id,
    'amount', v_pay.amount,
    'subscription_id', v_sub.id,
    'subscription_canceled', v_canceled,
    'later_subscriptions', v_later and v_shifted = 0,
    'dates_recalculated', v_shifted
  );
end;
$$;
