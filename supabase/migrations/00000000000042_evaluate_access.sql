-- supabase/migrations/00000000000042_evaluate_access.sql
--
-- Membership rules for gym entry, deliberately independent of HOW the person
-- was identified (face, card, QR...) and of WHAT opens the door. Callers
-- pass a client id; this returns allowed + a reason code.
--
-- Does not trust subscriptions.status alone: expire_subscriptions() only
-- runs once a day (migration 0009), so for up to 24h a lapsed membership
-- still reads 'active'. An 'active' row only grants access while
-- start_date <= today_bogota() <= end_date.
--
-- SECURITY INVOKER: runs as the calling staff member, gated by the existing
-- clients/subscriptions select policies (migration 0007), so it is safe at
-- the default PUBLIC execute grant (same reasoning as create_subscription).
create function public.evaluate_access(p_client_id uuid)
returns table (allowed boolean, reason_code text)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_client public.clients;
  v_today date := public.today_bogota();
  v_sub public.subscriptions;
begin
  select * into v_client from public.clients where id = p_client_id;
  if not found then
    return query select false, 'client_not_found'::text;
    return;
  end if;

  if not v_client.is_active then
    return query select false, 'client_inactive'::text;
    return;
  end if;

  if exists (
    select 1 from public.subscriptions
    where client_id = p_client_id
      and status = 'active'
      and start_date <= v_today
      and end_date >= v_today
  ) then
    return query select true, 'ok'::text;
    return;
  end if;

  -- Not currently valid: explain why using the same priority order as
  -- client_subscription_overview (migration 0033).
  select * into v_sub
  from public.subscriptions
  where client_id = p_client_id
  order by
    case status
      when 'active' then 1
      when 'pending_payment' then 2
      when 'scheduled' then 3
      when 'expired' then 4
      when 'canceled' then 5
    end,
    start_date desc,
    created_at desc
  limit 1;

  if not found then
    return query select false, 'no_subscription'::text;
    return;
  end if;

  return query select false, (
    case
      -- 'active' but outside its date range (we only get here when it is)
      when v_sub.status = 'active' and v_sub.end_date < v_today then 'subscription_expired'
      when v_sub.status = 'active' then 'subscription_scheduled'
      else 'subscription_' || v_sub.status
    end
  )::text;
end;
$$;
