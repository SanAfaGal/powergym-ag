-- supabase/migrations/00000000000008_subscription_rpcs.sql
create or replace function public.calculate_end_date(
  p_start date,
  p_unit duration_type_enum,
  p_count integer
) returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_unit
    when 'day' then p_start + (p_count || ' days')::interval
    when 'week' then p_start + (p_count || ' weeks')::interval
    when 'month' then p_start + (p_count || ' months')::interval
    when 'year' then p_start + (p_count || ' years')::interval
  end::date
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
  v_end_date date;
  v_status subscription_status_enum;
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
  v_status := case when p_start_date <= current_date then 'pending_payment' else 'scheduled' end;

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
  v_status subscription_status_enum;
  v_row public.subscriptions;
begin
  select * into v_old from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription % not found', p_subscription_id;
  end if;

  select * into v_plan from public.plans where id = coalesce(p_plan_id, v_old.plan_id);
  v_new_start := v_old.end_date + 1;
  v_new_end := public.calculate_end_date(v_new_start, v_plan.duration_unit, v_plan.duration_count);
  v_status := case when v_new_start <= current_date then 'pending_payment' else 'scheduled' end;

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

create or replace function public.record_payment(
  p_subscription_id uuid,
  p_amount numeric,
  p_method payment_method_enum,
  p_notes text default null
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

  insert into public.payments (subscription_id, amount, payment_method, received_by, notes)
  values (p_subscription_id, p_amount, p_method, auth.uid(), p_notes)
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

create or replace function public.cancel_subscription(
  p_subscription_id uuid,
  p_reason text
) returns public.subscriptions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions;
  v_row public.subscriptions;
begin
  select * into v_subscription
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    raise exception 'subscription % not found', p_subscription_id;
  end if;

  if v_subscription.status not in ('active', 'pending_payment', 'scheduled') then
    raise exception 'subscription % cannot be canceled from status %', p_subscription_id, v_subscription.status;
  end if;

  update public.subscriptions
  set status = 'canceled',
      cancellation_date = current_date,
      cancellation_reason = p_reason
  where id = p_subscription_id
  returning * into v_row;

  if v_subscription.status = 'active' then
    update public.subscriptions
    set status = 'pending_payment'
    where client_id = v_subscription.client_id
      and status = 'scheduled'
      and start_date <= current_date;
  end if;

  return v_row;
end;
$$;
