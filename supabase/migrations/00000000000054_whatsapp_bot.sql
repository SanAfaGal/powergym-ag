-- supabase/migrations/00000000000054_whatsapp_bot.sql
--
-- Lo que necesita el bot de WhatsApp (Power Gym AI) sobre el esquema del panel.
--
-- Principio: se usa lo que ya existe (clients, plans, subscriptions, payments) y solo
-- se agrega lo que el panel no tiene:
--   1. payments: número corto compartido (P45), quién lo reportó, origen y mensaje original.
--   2. Anulación de pagos SIN tocar las funciones y consultas que ya suman payments:
--      el pago anulado se MUEVE a voided_payments (queda guardado con motivo y autor) y
--      deja de existir en payments; así todos los totales, saldos y reportes existentes lo
--      excluyen solos. Es la única función que puede quitar filas de payments.
--   3. Tablas nuevas: products, product_sales, debts, events, whatsapp_messages,
--      pending_actions, clarifications.
--   4. Métodos de pago: solo Efectivo y Transferencia (Nequi, Daviplata y QR cuentan como
--      transferencia; el bot lo traduce al guardar).
--
-- El bot escribe con la service key (bypassa RLS). El panel solo LEE las tablas del bot.

-- ============================================================
-- 0. Métodos de pago: la etiqueta de 'bank' pasa a ser "Transferencia"
-- ============================================================
update public.payment_types set name = 'Transferencia' where code = 'bank';

-- ============================================================
-- 1. Un solo contador para todo lo que se puede anular desde el chat ("anular P45"):
--    pagos de membresía y ventas de productos comparten número, así P45 es único.
-- ============================================================
create sequence public.entry_number_seq;

alter table public.payments
  add column number bigint not null default nextval('public.entry_number_seq'),
  add column reported_by text,
  add column source text not null default 'panel' check (source in ('panel', 'whatsapp')),
  add column original_message text;

alter table public.payments add constraint payments_number_key unique (number);

comment on column public.payments.number is 'Número corto (P45) que se dice en el chat. Compartido con product_sales.';
comment on column public.payments.reported_by is 'Nombre de quien lo reportó por WhatsApp (Guillén, Betty...). null si vino del panel.';

-- ============================================================
-- 2. Pagos anulados (archivo). Nada se pierde: solo sale de payments.
-- ============================================================
create table public.voided_payments (
  id uuid primary key,                       -- el mismo id que tenía en payments
  number bigint not null unique,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount numeric(10,2) not null,
  payment_method text not null references public.payment_types(code),
  payment_date timestamptz not null,
  received_by uuid references public.profiles(id),
  reported_by text,
  source text not null,
  original_message text,
  notes text,
  bank_account_id uuid references public.bank_accounts(id),
  voided_at timestamptz not null default now(),
  voided_by text not null,                   -- nombre de quien anuló (equipo o 'Panel')
  void_reason text,
  subscription_canceled boolean not null default false
);
create index voided_payments_voided_at_idx on public.voided_payments (voided_at);
alter table public.voided_payments enable row level security;
grant select on public.voided_payments to authenticated;
create policy voided_payments_select on public.voided_payments
  for select to authenticated using (public.is_active_staff());

-- ============================================================
-- 3. record_payment: mismos 6 parámetros de antes + 3 del bot.
--    Se elimina la firma anterior para no dejar dos sobrecargas ambiguas
--    (el mismo problema de las migraciones 0012 y 0038).
-- ============================================================
drop function if exists public.record_payment(uuid, numeric, text, text, uuid, date);

create or replace function public.record_payment(
  p_subscription_id uuid,
  p_amount numeric,
  p_method text,
  p_notes text default null,
  p_bank_account_id uuid default null,
  p_payment_date date default null,
  p_reported_by text default null,
  p_source text default 'panel',
  p_original_message text default null
) returns public.payments
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions;
  v_already_paid numeric(10,2);
  v_payment public.payments;
  v_payment_timestamp timestamptz;
begin
  if p_payment_date is not null and p_payment_date > public.today_bogota() then
    raise exception 'La fecha del pago no puede ser posterior a hoy';
  end if;

  select * into v_subscription from public.subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'subscription % not found', p_subscription_id; end if;

  if v_subscription.status not in ('pending_payment', 'scheduled') then
    raise exception 'Esta suscripción no puede recibir pagos en su estado actual';
  end if;

  select coalesce(sum(amount), 0) into v_already_paid from public.payments where subscription_id = p_subscription_id;
  if v_already_paid + p_amount > v_subscription.final_price then
    raise exception 'El monto supera el saldo pendiente de la suscripción';
  end if;

  v_payment_timestamp := coalesce(
    (p_payment_date::timestamp + (now() at time zone 'America/Bogota')::time)
      at time zone 'America/Bogota',
    now()
  );

  insert into public.payments (
    subscription_id, amount, payment_method, received_by, notes, bank_account_id, payment_date,
    reported_by, source, original_message
  )
  values (
    p_subscription_id, p_amount, p_method, auth.uid(), p_notes, p_bank_account_id, v_payment_timestamp,
    p_reported_by, p_source, p_original_message
  )
  returning * into v_payment;

  if v_subscription.status = 'pending_payment' and v_already_paid + p_amount >= v_subscription.final_price then
    update public.subscriptions set status = 'active' where id = p_subscription_id;
  end if;

  return v_payment;
end;
$$;

-- ============================================================
-- 4. Productos (agua, gatorade, speed...) y sus ventas
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  reference_price numeric(10,2) not null check (reference_price >= 0),
  kind text not null default 'product' check (kind in ('product', 'service')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.product_sales (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.entry_number_seq'),
  client_id uuid references public.clients(id),           -- puede ser null: "vendí un agua"
  product_id uuid references public.products(id),
  description text,                                        -- si no está en el catálogo
  amount numeric(10,2) not null check (amount > 0),
  payment_method text not null references public.payment_types(code),
  sold_at timestamptz not null default now(),
  reported_by text,
  source text not null default 'whatsapp' check (source in ('panel', 'whatsapp')),
  original_message text,
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  created_at timestamptz not null default now()
);
create index product_sales_sold_at_idx on public.product_sales (sold_at);
create index product_sales_client_idx on public.product_sales (client_id);

-- ============================================================
-- 5. Deudas sueltas ("debe 15 mil de la rutina"). El saldo de un pago parcial
--    NO va aquí: ya lo da la suscripción (final_price - pagado).
-- ============================================================
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  amount numeric(10,2) not null check (amount > 0),
  concept text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'voided')),
  reported_by text,
  original_message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index debts_client_idx on public.debts (client_id) where status = 'pending';

-- ============================================================
-- 6. Registro de lo que pasa (anulaciones, etc.)
-- ============================================================
create table public.events (
  id bigint generated always as identity primary key,
  type text not null,
  client_id uuid references public.clients(id),
  reported_by text,
  original_message text,
  payment_number bigint,
  status text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index events_type_created_idx on public.events (type, created_at);

-- ============================================================
-- 7. Mensajes de WhatsApp, acciones por confirmar y dudas
-- ============================================================
create table public.whatsapp_messages (
  id bigint generated always as identity primary key,
  phone text not null,
  kind text not null,
  message text not null,
  message_timestamp timestamp,
  raw_payload text not null,
  -- el id que WhatsApp le da al mensaje: la base impide guardarlo dos veces
  external_id text unique,
  created_at timestamptz not null default now()
);

create type public.pending_action_status as enum ('waiting', 'confirmed', 'rejected', 'expired');

create table public.pending_actions (
  id bigint generated always as identity primary key,
  phone text not null,
  tool text not null,
  arguments jsonb not null,
  original_message text not null,
  reported_by text not null,
  status public.pending_action_status not null default 'waiting',
  created_at timestamptz not null default now()
);
create index pending_actions_phone_idx on public.pending_actions (phone, status);

create type public.clarification_status as enum ('pending', 'resolved');

-- el id es el número D12 que se dice en el chat
create table public.clarifications (
  id bigint generated always as identity primary key,
  phone text not null,
  original_message text not null,
  question text not null,
  reported_by text not null,
  status public.clarification_status not null default 'pending',
  answer text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index clarifications_status_idx on public.clarifications (status);

-- ============================================================
-- 8. RLS: el panel solo lee; el bot escribe con la service key
-- ============================================================
alter table public.products enable row level security;
alter table public.product_sales enable row level security;
alter table public.debts enable row level security;
alter table public.events enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.pending_actions enable row level security;
alter table public.clarifications enable row level security;

grant select on public.products, public.product_sales, public.debts, public.events,
  public.pending_actions, public.clarifications to authenticated;

create policy products_select on public.products for select to authenticated using (public.is_active_staff());
create policy product_sales_select on public.product_sales for select to authenticated using (public.is_active_staff());
create policy debts_select on public.debts for select to authenticated using (public.is_active_staff());
create policy events_select on public.events for select to authenticated using (public.is_active_staff());
create policy pending_actions_select on public.pending_actions for select to authenticated using (public.is_active_staff());
create policy clarifications_select on public.clarifications for select to authenticated using (public.is_active_staff());
-- whatsapp_messages: sin policy para authenticated (contiene el payload crudo): solo la service key.

-- ============================================================
-- 9. Anular un pago por su número (P45)
-- ============================================================
-- Puede hacerlo: la service key (el bot ya verificó quién es), un admin, o quien recibió el pago.
-- El pago pasa a voided_payments y sale de payments. Después:
--   - si la suscripción se queda sin ningún pago -> se cancela (y, si estaba activa, la
--     siguiente programada pasa a pendiente de pago, igual que cancel_subscription);
--   - si queda con pagos pero ya no cubre el precio y estaba activa -> vuelve a pendiente de pago.
-- Las suscripciones posteriores del cliente NO se recalculan: se avisa en 'later_subscriptions'.
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
    'later_subscriptions', v_later
  );
end;
$$;

-- Anular una venta de producto (también por su número).
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

  return jsonb_build_object('payment_number', p_number, 'client_id', v_sale.client_id, 'amount', v_sale.amount);
end;
$$;

-- Se anula "lo que sea P45": busca primero en pagos, luego en ventas de productos.
create or replace function public.void_entry(
  p_number bigint,
  p_voided_by text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.payments where number = p_number) then
    return public.void_payment(p_number, p_voided_by, p_reason);
  elsif exists (select 1 from public.product_sales where number = p_number) then
    return public.void_product_sale(p_number, p_voided_by, p_reason);
  elsif exists (select 1 from public.voided_payments where number = p_number)
     or exists (select 1 from public.product_sales where number = p_number and voided_at is not null) then
    raise exception 'P% ya estaba anulado', p_number;
  end if;
  raise exception 'No encuentro el pago P%', p_number;
end;
$$;

revoke execute on function public.void_payment(bigint, text, text) from public, anon;
revoke execute on function public.void_product_sale(bigint, text, text) from public, anon;
revoke execute on function public.void_entry(bigint, text, text) from public, anon;
grant execute on function public.void_payment(bigint, text, text) to authenticated, service_role;
grant execute on function public.void_product_sale(bigint, text, text) to authenticated, service_role;
grant execute on function public.void_entry(bigint, text, text) to authenticated, service_role;
