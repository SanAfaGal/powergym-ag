-- Fixes from the whole-branch review after Task 17 (bootstrap+schema plan):
-- 1. Shared "business today" helper to eliminate the timezone split between
--    cron functions (America/Bogota) and everything else (session TZ/UTC).
-- 2. activate_scheduled_subscriptions now activates directly (not just to
--    pending_payment) when a promoted row is already fully paid.
-- 3. handle_new_user now reads role from raw_app_meta_data (server-only,
--    set via the Supabase Admin API) instead of raw_user_meta_data (which a
--    user's own signUp()/updateUser() call can write), closing a latent
--    privilege-escalation path. full_name still reads from raw_user_meta_data
--    (not security-sensitive).

create or replace function public.today_bogota()
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'America/Bogota')::date
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
      cancellation_date = public.today_bogota(),
      cancellation_reason = p_reason
  where id = p_subscription_id
  returning * into v_row;

  if v_subscription.status = 'active' then
    update public.subscriptions
    set status = 'pending_payment'
    where client_id = v_subscription.client_id
      and status = 'scheduled'
      and start_date <= public.today_bogota();
  end if;

  return v_row;
end;
$$;

create or replace function public.expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.subscriptions
  set status = 'expired'
  where status = 'active'
    and end_date < public.today_bogota();

  get diagnostics v_count = row_count;
  return v_count;
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
    ) >= s.final_price then 'active'::subscription_status_enum
    else 'pending_payment'::subscription_status_enum
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
        select status::text, count(*) as cnt
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
          select payment_method::text, sum(amount) as total
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_app_meta_data ->> 'role')::app_role, 'employee')
  );
  return new;
end;
$$;
