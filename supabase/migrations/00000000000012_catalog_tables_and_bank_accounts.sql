-- supabase/migrations/00000000000012_catalog_tables_and_bank_accounts.sql
--
-- Converts four fixed Postgres enums (document_type_enum, gender_type_enum,
-- subscription_status_enum, payment_method_enum) into catalog tables, and
-- adds bank/bank_account tracking so a payment records which bank account
-- received the money. Codes keep their existing English values -- no
-- frontend exists yet to depend on them, this only changes how they're
-- stored (table + FK instead of a fixed enum type), not what they mean.
--
-- duration_type_enum and app_role are intentionally NOT converted: the
-- former is stable (day/week/month/year will not grow) and the latter is
-- security-sensitive (used directly in RLS policies via is_active_admin()).

-- ============================================================
-- 1. Catalog tables
-- ============================================================

create table public.document_types (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.gender_types (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscription_statuses (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.payment_types (
  code text primary key,
  name text not null,
  description text,
  requires_bank_account boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.banks (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.bank_account_types (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.document_types (code, name) values
  ('CC', 'Cédula de ciudadanía'),
  ('TI', 'Tarjeta de identidad'),
  ('CE', 'Cédula de extranjería'),
  ('PP', 'Pasaporte');

insert into public.gender_types (code, name) values
  ('male', 'Masculino'),
  ('female', 'Femenino'),
  ('other', 'Otro');

insert into public.subscription_statuses (code, name, description) values
  ('active', 'Activa', 'La suscripción está vigente y el cliente puede acceder al gimnasio.'),
  ('expired', 'Vencida', 'La suscripción superó su fecha de finalización y ya no es válida.'),
  ('pending_payment', 'Pendiente de pago', 'La suscripción fue creada pero aún no ha sido pagada o activada.'),
  ('scheduled', 'Programada', 'La suscripción está programada para iniciar en una fecha futura.'),
  ('canceled', 'Cancelada', 'La suscripción fue cancelada antes de su vencimiento y no se continuará usando.');

insert into public.payment_types (code, name, requires_bank_account) values
  ('cash', 'Efectivo', false),
  ('qr', 'Pago QR', true),
  ('transfer', 'Transferencia bancaria', true);

insert into public.banks (code, name) values
  ('BANCOLOMBIA', 'Bancolombia');

insert into public.bank_account_types (code, name) values
  ('savings', 'Ahorros'),
  ('checking', 'Corriente');

-- ============================================================
-- 2. bank_accounts (operational data, not a pure catalog -- not seeded
--    here; the gym's real account gets added manually, same as clients).
-- ============================================================

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_code text not null references public.banks(code),
  account_type_code text not null references public.bank_account_types(code),
  account_number text not null,
  account_holder_name text not null,
  transfer_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (bank_code, account_number)
);

-- ============================================================
-- 3. Convert enum columns to text + FK.
--    Indexes whose predicate/columns touch the retyped column are dropped
--    first and recreated after, to avoid ALTER COLUMN TYPE errors.
-- ============================================================

drop index public.one_active_subscription_per_client;
drop index public.subscriptions_status_end_date_idx;

alter table public.clients
  alter column dni_type type text using dni_type::text,
  add constraint clients_dni_type_fkey foreign key (dni_type) references public.document_types(code);

alter table public.clients
  alter column gender type text using gender::text,
  add constraint clients_gender_fkey foreign key (gender) references public.gender_types(code);

alter table public.subscriptions
  alter column status drop default,
  alter column status type text using status::text,
  alter column status set default 'pending_payment',
  add constraint subscriptions_status_fkey foreign key (status) references public.subscription_statuses(code);

create unique index one_active_subscription_per_client
  on public.subscriptions (client_id)
  where (status = 'active');

create index subscriptions_status_end_date_idx
  on public.subscriptions (status, end_date);

alter table public.payments
  alter column payment_method type text using payment_method::text,
  add constraint payments_payment_method_fkey foreign key (payment_method) references public.payment_types(code);

-- ============================================================
-- 4. payments destination tracking
-- ============================================================

alter table public.payments
  add column bank_account_id uuid references public.bank_accounts(id);

create or replace function public.enforce_payment_bank_account()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_requires boolean;
begin
  select requires_bank_account into v_requires
  from public.payment_types
  where code = new.payment_method;

  if v_requires and new.bank_account_id is null then
    raise exception 'payment_method % requires a bank_account_id', new.payment_method;
  elsif not v_requires and new.bank_account_id is not null then
    raise exception 'payment_method % must not have a bank_account_id', new.payment_method;
  end if;

  return new;
end;
$$;

create trigger payments_enforce_bank_account
  before insert or update on public.payments
  for each row execute function public.enforce_payment_bank_account();

-- ============================================================
-- 5. Recreate functions that referenced the enum types below, retyped to
--    text, BEFORE dropping those types -- record_payment's old signature
--    (p_method payment_method_enum) is a real pg_depend dependency that
--    would block the DROP TYPE otherwise. Logic is unchanged throughout.
-- ============================================================

create or replace function public.create_subscription(
  p_client_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_discount_percentage numeric default 0
) returns public.subscriptions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_plan public.plans;
  v_end_date date;
  v_status text;
  v_row public.subscriptions;
begin
  select * into v_plan from public.plans where id = p_plan_id and is_active;
  if not found then
    raise exception 'plan % not found or inactive', p_plan_id;
  end if;

  if exists (
    select 1 from public.subscriptions
    where client_id = p_client_id and status = 'active'
  ) then
    raise exception 'client % already has an active subscription', p_client_id;
  end if;

  v_end_date := public.calculate_end_date(p_start_date, v_plan.duration_unit, v_plan.duration_count);
  v_status := case when p_start_date <= public.today_bogota() then 'pending_payment' else 'scheduled' end;

  insert into public.subscriptions (
    client_id, plan_id, start_date, end_date, status,
    base_price, discount_percentage, created_by
  ) values (
    p_client_id, p_plan_id, p_start_date, v_end_date, v_status,
    v_plan.price, p_discount_percentage, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.renew_subscription(
  p_subscription_id uuid,
  p_plan_id uuid default null,
  p_discount_percentage numeric default null
) returns public.subscriptions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_old public.subscriptions;
  v_plan public.plans;
  v_new_start date;
  v_new_end date;
  v_status text;
  v_row public.subscriptions;
begin
  select * into v_old from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription % not found', p_subscription_id;
  end if;

  select * into v_plan from public.plans where id = coalesce(p_plan_id, v_old.plan_id);
  v_new_start := v_old.end_date + 1;
  v_new_end := public.calculate_end_date(v_new_start, v_plan.duration_unit, v_plan.duration_count);
  v_status := case when v_new_start <= public.today_bogota() then 'pending_payment' else 'scheduled' end;

  insert into public.subscriptions (
    client_id, plan_id, start_date, end_date, status,
    base_price, discount_percentage, created_by
  ) values (
    v_old.client_id,
    coalesce(p_plan_id, v_old.plan_id),
    v_new_start,
    v_new_end,
    v_status,
    v_plan.price,
    coalesce(p_discount_percentage, v_old.discount_percentage, 0),
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.activate_scheduled_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.subscriptions s
  set status = case
    when (
      select coalesce(sum(p.amount), 0)
      from public.payments p
      where p.subscription_id = s.id
    ) >= s.final_price then 'active'
    else 'pending_payment'
  end
  where s.status = 'scheduled'
    and s.start_date <= public.today_bogota()
    and not exists (
      select 1 from public.subscriptions s2
      where s2.client_id = s.client_id and s2.status = 'active'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- CREATE OR REPLACE cannot retype an existing parameter (p_method here,
-- payment_method_enum -> text): Postgres identifies a function by name +
-- argument types, so that would silently create a second overload instead
-- of replacing the original, leaving the old payment_method_enum-typed
-- signature around to block the DROP TYPE below. Drop it explicitly first.
drop function if exists public.record_payment(uuid, numeric, payment_method_enum, text);

create or replace function public.record_payment(
  p_subscription_id uuid,
  p_amount numeric,
  p_method text,
  p_notes text default null,
  p_bank_account_id uuid default null
) returns public.payments
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions;
  v_total_paid numeric(10,2);
  v_payment public.payments;
begin
  select * into v_subscription
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    raise exception 'subscription % not found', p_subscription_id;
  end if;

  insert into public.payments (subscription_id, amount, payment_method, received_by, notes, bank_account_id)
  values (p_subscription_id, p_amount, p_method, auth.uid(), p_notes, p_bank_account_id)
  returning * into v_payment;

  select coalesce(sum(amount), 0) into v_total_paid
  from public.payments
  where subscription_id = p_subscription_id;

  if v_subscription.status = 'pending_payment' and v_total_paid >= v_subscription.final_price then
    update public.subscriptions
    set status = 'active'
    where id = p_subscription_id;
  end if;

  return v_payment;
end;
$$;

create or replace function public.get_dashboard_stats(
  p_start date,
  p_end date
) returns jsonb
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'client_stats', jsonb_build_object(
      'total_active_clients', (select count(*) from public.clients where is_active),
      'new_clients_in_range', (
        select count(*) from public.clients
        where created_at::date between p_start and p_end
      )
    ),
    'subscription_stats', (
      select jsonb_object_agg(status, cnt) from (
        select status, count(*) as cnt
        from public.subscriptions
        group by status
      ) s
    ),
    'financial_stats', jsonb_build_object(
      'revenue_in_range', (
        select coalesce(sum(amount), 0) from public.payments
        where payment_date::date between p_start and p_end
      ),
      'revenue_by_method', (
        select jsonb_object_agg(payment_method, total) from (
          select payment_method, sum(amount) as total
          from public.payments
          where payment_date::date between p_start and p_end
          group by payment_method
        ) m
      ),
      'pending_debt', (
        select coalesce(sum(s.final_price - coalesce(p.paid, 0)), 0)
        from public.subscriptions s
        left join (
          select subscription_id, sum(amount) as paid
          from public.payments
          group by subscription_id
        ) p on p.subscription_id = s.id
        where s.status in ('active', 'pending_payment')
      )
    ),
    'alerts', jsonb_build_object(
      'expiring_within_7_days', (
        select count(*) from public.subscriptions
        where status = 'active' and end_date between public.today_bogota() and public.today_bogota() + 7
      )
    )
  )
$$;

-- ============================================================
-- 6. Old enum types no longer referenced by any column or function
--    signature -- drop them. duration_type_enum and app_role untouched.
-- ============================================================

drop type public.document_type_enum;
drop type public.gender_type_enum;
drop type public.subscription_status_enum;
drop type public.payment_method_enum;

-- ============================================================
-- 7. RLS + grants for the new tables, same pattern as migration 0007:
--    staff can read (dropdowns), only admins manage catalogs/accounts.
-- ============================================================

alter table public.document_types enable row level security;
alter table public.gender_types enable row level security;
alter table public.subscription_statuses enable row level security;
alter table public.payment_types enable row level security;
alter table public.banks enable row level security;
alter table public.bank_account_types enable row level security;
alter table public.bank_accounts enable row level security;

grant select, insert, update on public.document_types to authenticated;
grant select, insert, update on public.gender_types to authenticated;
grant select, insert, update on public.subscription_statuses to authenticated;
grant select, insert, update on public.payment_types to authenticated;
grant select, insert, update on public.banks to authenticated;
grant select, insert, update on public.bank_account_types to authenticated;
grant select, insert, update on public.bank_accounts to authenticated;

create policy document_types_select on public.document_types
  for select to authenticated using (public.is_active_staff());
create policy document_types_write on public.document_types
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy gender_types_select on public.gender_types
  for select to authenticated using (public.is_active_staff());
create policy gender_types_write on public.gender_types
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy subscription_statuses_select on public.subscription_statuses
  for select to authenticated using (public.is_active_staff());
create policy subscription_statuses_write on public.subscription_statuses
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy payment_types_select on public.payment_types
  for select to authenticated using (public.is_active_staff());
create policy payment_types_write on public.payment_types
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy banks_select on public.banks
  for select to authenticated using (public.is_active_staff());
create policy banks_write on public.banks
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy bank_account_types_select on public.bank_account_types
  for select to authenticated using (public.is_active_staff());
create policy bank_account_types_write on public.bank_account_types
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy bank_accounts_select on public.bank_accounts
  for select to authenticated using (public.is_active_staff());
create policy bank_accounts_write on public.bank_accounts
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
