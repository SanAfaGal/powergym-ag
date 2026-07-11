-- supabase/migrations/00000000000013_plan_price_history.sql
--
-- Moves plan pricing out of plans.price (a single mutable value) into
-- plan_prices, an append-only history with a validity window
-- (valid_from/valid_until). This is what the Excel's "membership_prices"
-- sheet modeled and today's schema didn't have: you can see what a plan
-- used to cost, and you can schedule a price change effective a future
-- date -- a subscription that starts on or after that date picks up the
-- new price automatically (create_subscription/renew_subscription price
-- against the subscription's own start_date, not "today").
--
-- subscriptions.base_price is untouched: it already snapshots the price at
-- creation time, so past subscriptions stay correct no matter how
-- plan_prices changes later.

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);

create index plan_prices_plan_id_idx on public.plan_prices (plan_id);

-- Backfill one open-ended price row per existing plan from its current
-- `price` column, effective since the plan was created, before dropping
-- that column. A no-op on a fresh database (no plans exist yet), but
-- correct if this ever runs against an environment with real plans.
insert into public.plan_prices (plan_id, price, valid_from)
select id, price, created_at::date from public.plans;

alter table public.plans drop column price;

-- Append-only versioning: inserting a new price for a plan automatically
-- closes whatever open-ended (valid_until is null) row that plan had, the
-- day before the new row's valid_from. This is what lets an admin "just
-- insert a row" (via REST/SQL, no bespoke RPC) to schedule a price change,
-- rather than requiring a hand-computed valid_until on the old row first.
create or replace function public.close_previous_plan_price()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.plan_prices
  set valid_until = new.valid_from - 1
  where plan_id = new.plan_id
    and valid_until is null
    and valid_from < new.valid_from
    and id <> new.id;

  return new;
end;
$$;

create trigger plan_prices_close_previous
  after insert on public.plan_prices
  for each row execute function public.close_previous_plan_price();

create or replace function public.plan_price_at(
  p_plan_id uuid,
  p_date date default current_date
) returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select price from public.plan_prices
  where plan_id = p_plan_id
    and valid_from <= p_date
    and (valid_until is null or valid_until >= p_date)
  order by valid_from desc
  limit 1
$$;

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
  v_price numeric(10,2);
  v_end_date date;
  v_status text;
  v_row public.subscriptions;
begin
  select * into v_plan from public.plans where id = p_plan_id and is_active;
  if not found then
    raise exception 'plan % not found or inactive', p_plan_id;
  end if;

  v_price := public.plan_price_at(p_plan_id, p_start_date);
  if v_price is null then
    raise exception 'plan % has no price effective on %', p_plan_id, p_start_date;
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
    v_price, p_discount_percentage, auth.uid()
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
  v_price numeric(10,2);
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

  v_price := public.plan_price_at(coalesce(p_plan_id, v_old.plan_id), v_new_start);
  if v_price is null then
    raise exception 'plan % has no price effective on %', coalesce(p_plan_id, v_old.plan_id), v_new_start;
  end if;

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
    v_price,
    coalesce(p_discount_percentage, v_old.discount_percentage, 0),
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

alter table public.plan_prices enable row level security;

grant select, insert, update on public.plan_prices to authenticated;

create policy plan_prices_select on public.plan_prices
  for select to authenticated using (public.is_active_staff());
create policy plan_prices_write on public.plan_prices
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
