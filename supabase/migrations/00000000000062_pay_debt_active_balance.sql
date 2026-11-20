-- Migración 0062: pagar el saldo de una membresía que figura "activa" pero no está completa.
-- Pasaba con datos de ejemplo (Javier Nunez: activa, abonó 150.000 de 270.000): bot_client_balance los contaba
-- como deuda, pero bot_pay_debt solo repartía a membresías pendientes de pago y fallaba con
-- "No pude aplicar todo el pago". Ahora esa membresía vuelve a pendiente de pago antes de recibir el pago
-- (la misma regla que ya usa void_payment) y queda activa al completarse.

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
      where b.client_id = v_client and s.status in ('pending_payment', 'active')
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
      -- una membresía "activa" con saldo (p. ej. datos de ejemplo o importados) vuelve a pendiente de pago:
      -- record_payment solo recibe pagos en ese estado y la deja activa otra vez al completar el precio
      update public.subscriptions set status = 'pending_payment' where id = v_item.id and status = 'active';
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
