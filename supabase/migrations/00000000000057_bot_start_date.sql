-- 0057: el bot puede indicar desde cuándo empieza una membresía (pago tardío).
-- Una línea de membresía acepta "start_date" (YYYY-MM-DD). La fecha del pago sigue siendo hoy.
-- Sin start_date todo funciona igual que antes (encadena o empieza hoy).
create or replace function public.bot_register_payment(
  p_client_number bigint,
  p_client_name text,
  p_method text,
  p_lines jsonb,
  p_reported_by text,
  p_original_message text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_client uuid;
  v_line jsonb;
  v_plan public.plans;
  v_product public.products;
  v_latest public.subscriptions;
  v_sub public.subscriptions;
  v_pay public.payments;
  v_sale public.product_sales;
  v_amount numeric;
  v_expected numeric;
  v_start date;
  v_explicit date;
  v_price numeric;
  v_entries jsonb := '[]'::jsonb;
  v_method text := public.bot_method(p_method);
begin
  v_client := public.bot_ensure_client(p_client_number, p_client_name);
  perform public.expire_subscriptions();

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_amount := (v_line->>'amount')::numeric;
    v_expected := coalesce((v_line->>'expected')::numeric, v_amount);

    if v_line->>'kind' = 'membership' then
      if v_client is null then
        raise exception 'Un pago de membresía necesita un cliente';
      end if;
      select * into v_plan from public.plans where number = (v_line->>'plan_number')::bigint and is_active;
      if not found then raise exception 'El plan % no existe o está inactivo', v_line->>'plan_number'; end if;

      select * into v_latest from public.subscriptions
      where client_id = v_client and status in ('active', 'pending_payment', 'scheduled', 'expired')
      order by end_date desc limit 1;

      v_explicit := (v_line->>'start_date')::date;
      if v_explicit is not null then
        -- pago tardío: la membresía empezó antes; la fecha del pago sigue siendo hoy
        if v_explicit > public.today_bogota() then
          raise exception 'La fecha de inicio no puede ser futura';
        end if;
        if v_latest.id is not null and v_latest.end_date >= v_explicit then
          raise exception 'Se solapa con la membresía anterior, que termina el %: una renovación empieza el día siguiente', v_latest.end_date;
        end if;
        if public.calculate_end_date(v_explicit, v_plan.duration_unit, v_plan.duration_count) < public.today_bogota() then
          raise exception 'Con esa fecha de inicio la membresía ya estaría vencida; revísalo a mano';
        end if;
        v_start := v_explicit;
      elsif v_latest.id is null or v_latest.end_date < public.today_bogota() then
        v_start := public.today_bogota();
      else
        v_start := v_latest.end_date + 1;
      end if;

      v_price := public.plan_price_at(v_plan.id, v_start);
      if v_price is null then
        raise exception 'El plan no tiene un precio vigente para la fecha %', v_start;
      end if;

      if v_explicit is not null or v_latest.id is null or v_latest.end_date < public.today_bogota() then
        v_sub := public.create_subscription(v_client, v_plan.id, v_start, greatest(v_price - v_expected, 0));
      else
        v_sub := public.renew_subscription(v_latest.id, v_plan.id, greatest(v_price - v_expected, 0));
      end if;

      v_pay := public.record_payment(
        v_sub.id, v_amount, v_method, null, null, null, p_reported_by, 'whatsapp', p_original_message
      );
      v_entries := v_entries || jsonb_build_object(
        'kind', 'payment', 'number', v_pay.number, 'subscription_id', v_sub.id,
        'start_date', v_sub.start_date, 'end_date', v_sub.end_date, 'partial', v_amount < v_expected
      );

    elsif v_line->>'kind' = 'product' then
      select * into v_product from public.products where number = (v_line->>'product_number')::bigint and is_active;
      if not found then raise exception 'El producto % no existe o está inactivo', v_line->>'product_number'; end if;
      insert into public.product_sales (client_id, product_id, amount, payment_method, reported_by, original_message)
      values (v_client, v_product.id, v_amount, v_method, p_reported_by, p_original_message)
      returning * into v_sale;
      v_entries := v_entries || jsonb_build_object('kind', 'product_sale', 'number', v_sale.number);

    else
      raise exception 'Tipo de línea desconocido: %', v_line->>'kind';
    end if;
  end loop;

  insert into public.events (type, client_id, reported_by, original_message, payment_number, status, data)
  values ('PAYMENT_RECEIVED', v_client, p_reported_by, p_original_message,
          (v_entries->0->>'number')::bigint, 'CONFIRMADO', jsonb_build_object('entries', v_entries));

  return jsonb_build_object(
    'client_number', (select number from public.clients where id = v_client),
    'entries', v_entries
  );
end;
$$;
