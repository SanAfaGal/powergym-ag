-- supabase/migrations/00000000000027_actionable_subscription_errors.sql
--
-- create_subscription/renew_subscription raised dev-facing, English,
-- '%'-templated exceptions (e.g. 'plan % has no price effective on %').
-- actions.ts's createSubscription/renewSubscription swallow EVERY RPC
-- error into one generic "No se pudo crear la suscripción" -- unlike
-- record_payment (migration 0022), which raises staff-facing Spanish text
-- that actions.ts matches verbatim and surfaces as-is. create_subscription
-- never got that treatment, so a real, specific, actionable failure (most
-- commonly: backdating a start_date to before the plan's price history
-- begins -- plan_prices.valid_from defaults to the day the plan/price was
-- created, so yesterday has no price row yet) landed on staff as a dead
-- end with no indication of what to fix.
--
-- Rewriting these exceptions as Spanish, staff-facing text (still
-- interpolating the actual date, which is genuinely useful here) so
-- actions.ts can match and surface them the same way it already does for
-- record_payment's guards. Same signatures as before, so a plain
-- CREATE OR REPLACE is enough (no DROP needed).
create or replace function public.create_subscription(
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
    raise exception 'El plan seleccionado no existe o está inactivo';
  end if;

  v_price := public.plan_price_at(p_plan_id, p_start_date);
  if v_price is null then
    raise exception 'El plan no tiene un precio vigente para la fecha de inicio elegida (%). Elegí otra fecha o revisá el historial de precios del plan.', p_start_date;
  end if;

  if exists (
    select 1 from public.subscriptions
    where client_id = p_client_id and status = 'active'
  ) then
    raise exception 'El cliente ya tiene una suscripción activa';
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

create or replace function public.renew_subscription(
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
    raise exception 'La suscripción no existe';
  end if;

  select * into v_plan from public.plans where id = coalesce(p_plan_id, v_old.plan_id);
  v_new_start := v_old.end_date + 1;

  v_price := public.plan_price_at(coalesce(p_plan_id, v_old.plan_id), v_new_start);
  if v_price is null then
    raise exception 'El plan no tiene un precio vigente para la fecha de renovación (%). Revisá el historial de precios del plan.', v_new_start;
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
