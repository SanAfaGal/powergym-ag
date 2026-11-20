-- Migración 0063: trazabilidad de cómo se creó cada cliente y cada membresía.
-- Se apoya en la tabla events: cada cliente o membresía nueva deja un evento con quién lo creó, por qué
-- canal (WhatsApp, panel o sistema), cuándo y, si vino del bot, el mensaje original. Los cambios al cliente
-- (editar nombre, teléfono, etc.) también quedan en events.
--
-- Cómo sabe el evento de dónde vino: las funciones del bot llaman set_origin() al empezar (dura solo esa
-- transacción) y unos triggers en clients y subscriptions lo leen. Sin set_origin, si hay un usuario del
-- panel con sesión se anota como "panel" con su nombre; si no hay nadie, "sistema" (importaciones, seeds).
-- Lo que se creó antes de esta migración no tiene evento: el panel lo muestra como "sin registro de origen".

alter table public.events
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists source text check (source in ('whatsapp', 'panel', 'sistema'));
create index if not exists events_client_idx on public.events (client_id, created_at);
create index if not exists events_subscription_idx on public.events (subscription_id) where subscription_id is not null;

-- ============================================================
-- Origen de la transacción
-- ============================================================
create or replace function public.set_origin(p_source text, p_reported_by text, p_message text) returns void
language plpgsql as $$
begin
  perform set_config('app.origin',
    jsonb_build_object('source', p_source, 'reported_by', p_reported_by, 'message', p_message)::text, true);
end;
$$;
revoke execute on function public.set_origin(text, text, text) from public, anon, authenticated;
grant execute on function public.set_origin(text, text, text) to service_role;

-- quién y por dónde: el origen que dejó el bot, o el usuario del panel, o "sistema"
create or replace function public.current_origin() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_raw text := nullif(current_setting('app.origin', true), '');
  v_name text;
begin
  if v_raw is not null then
    return v_raw::jsonb;
  end if;
  if auth.uid() is not null then
    select full_name into v_name from public.profiles where id = auth.uid();
    return jsonb_build_object('source', 'panel', 'reported_by', coalesce(v_name, 'staff'), 'message', null);
  end if;
  return jsonb_build_object('source', 'sistema', 'reported_by', null, 'message', null);
end;
$$;
revoke execute on function public.current_origin() from public, anon, authenticated;

-- ============================================================
-- Triggers
-- ============================================================
create or replace function public.log_client_created() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o jsonb := public.current_origin();
begin
  insert into public.events (type, client_id, reported_by, original_message, source, status, data)
  values ('CLIENT_CREATED', new.id, o->>'reported_by', o->>'message', o->>'source', 'CONFIRMADO',
          jsonb_build_object('nombre', trim(new.first_name || ' ' || new.last_name)));
  return new;
end;
$$;
drop trigger if exists clients_log_created on public.clients;
create trigger clients_log_created after insert on public.clients
  for each row execute function public.log_client_created();

create or replace function public.log_subscription_created() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o jsonb := public.current_origin();
  v_plan text;
begin
  select name into v_plan from public.plans where id = new.plan_id;
  insert into public.events (type, client_id, subscription_id, reported_by, original_message, source, status, data)
  values ('SUBSCRIPTION_CREATED', new.client_id, new.id, o->>'reported_by', o->>'message', o->>'source', 'CONFIRMADO',
          jsonb_build_object('plan', v_plan, 'inicio', new.start_date, 'fin', new.end_date,
                             'precio', new.final_price, 'estado', new.status));
  return new;
end;
$$;
drop trigger if exists subscriptions_log_created on public.subscriptions;
create trigger subscriptions_log_created after insert on public.subscriptions
  for each row execute function public.log_subscription_created();

-- editar un cliente: queda qué campo cambió, de qué a qué, y quién
create or replace function public.log_client_updated() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o jsonb := public.current_origin();
  v_old jsonb := to_jsonb(old) - 'updated_at' - 'search_text';
  v_new jsonb := to_jsonb(new) - 'updated_at' - 'search_text';
  v_changes jsonb;
begin
  select coalesce(jsonb_object_agg(n.key, jsonb_build_array(v_old->n.key, n.value)), '{}'::jsonb)
  into v_changes
  from jsonb_each(v_new) n
  where v_old->n.key is distinct from n.value;

  if v_changes <> '{}'::jsonb then
    insert into public.events (type, client_id, reported_by, original_message, source, status, data)
    values ('CLIENT_UPDATED', new.id, o->>'reported_by', o->>'message', o->>'source', 'CONFIRMADO',
            jsonb_build_object('cambios', v_changes));
  end if;
  return new;
end;
$$;
drop trigger if exists clients_log_updated on public.clients;
create trigger clients_log_updated after update on public.clients
  for each row execute function public.log_client_updated();

-- ============================================================
-- Funciones del bot: dejan su origen (quién lo reportó y el mensaje)
-- ============================================================
-- bot_create_client ahora recibe quién y el mensaje (opcionales: sin ellos queda como WhatsApp sin autor)
drop function if exists public.bot_create_client(text, text);
create or replace function public.bot_create_client(
  p_name text, p_phone text default null, p_reported_by text default null, p_original_message text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.clients;
begin
  perform public.set_origin('whatsapp', p_reported_by, p_original_message);
  v_row := public.bot_insert_client(p_name, p_phone);
  return jsonb_build_object('number', v_row.number, 'name', public.bot_full_name(v_row));
end;
$$;
revoke execute on function public.bot_create_client(text, text, text, text) from public, anon, authenticated;
grant execute on function public.bot_create_client(text, text, text, text) to service_role;

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
  perform public.set_origin('whatsapp', p_reported_by, p_original_message);
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

create or replace function public.bot_register_debt(
  p_client_number bigint, p_client_name text, p_amount numeric, p_concept text,
  p_reported_by text, p_original_message text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_client uuid;
  v_debt public.debts;
begin
  perform public.set_origin('whatsapp', p_reported_by, p_original_message);
  v_client := public.bot_ensure_client(p_client_number, p_client_name);
  if v_client is null then raise exception 'Una deuda necesita un cliente'; end if;
  insert into public.debts (client_id, amount, concept, reported_by, original_message)
  values (v_client, p_amount, p_concept, p_reported_by, p_original_message)
  returning * into v_debt;
  insert into public.events (type, client_id, reported_by, original_message, status)
  values ('DEBT_REGISTERED', v_client, p_reported_by, p_original_message, 'CONFIRMADO');
  return jsonb_build_object('debt_number', v_debt.number);
end;
$$;
