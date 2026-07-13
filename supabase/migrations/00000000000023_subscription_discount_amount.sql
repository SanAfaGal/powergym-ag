-- supabase/migrations/00000000000023_subscription_discount_amount.sql
--
-- Subscription discounts move from a percentage to a flat currency amount,
-- entered by staff the same way a plan price is (see MoneyInput.tsx). A
-- generated column can't have its expression altered in place, so the old
-- final_price is dropped and recreated alongside the new discount_amount
-- column. Existing rows are pre-launch/seed data only, so discount_percentage
-- is dropped without carrying its value forward -- every existing
-- subscription simply loses its discount rather than converting it.
alter table public.subscriptions drop column final_price;
alter table public.subscriptions drop column discount_percentage;

alter table public.subscriptions add column discount_amount numeric(10,2)
  check (discount_amount is null or (discount_amount >= 0 and discount_amount <= base_price));

alter table public.subscriptions add column final_price numeric(10,2) generated always as (
  round(base_price - coalesce(discount_amount, 0), 2)
) stored;

-- Postgres refuses CREATE OR REPLACE when an input parameter's name
-- changes, even with matching types/positions -- must drop first.
drop function public.create_subscription(uuid, uuid, date, numeric);
drop function public.renew_subscription(uuid, uuid, numeric);

create function public.create_subscription(
  p_client_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_discount_amount numeric default 0
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
    base_price, discount_amount, created_by
  ) values (
    p_client_id, p_plan_id, p_start_date, v_end_date, v_status,
    v_price, p_discount_amount, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create function public.renew_subscription(
  p_subscription_id uuid,
  p_plan_id uuid default null,
  p_discount_amount numeric default 0
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
    base_price, discount_amount, created_by
  ) values (
    v_old.client_id,
    coalesce(p_plan_id, v_old.plan_id),
    v_new_start,
    v_new_end,
    v_status,
    v_price,
    p_discount_amount,
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;
