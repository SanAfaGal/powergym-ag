-- supabase/migrations/00000000000010_dashboard_and_staff_admin.sql
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
        where status = 'active' and end_date between current_date and current_date + 7
      )
    )
  )
$$;

create or replace function public.set_staff_role(
  p_target uuid,
  p_role app_role
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'only an admin can change staff roles';
  end if;

  update public.profiles set role = p_role where id = p_target;
end;
$$;

create or replace function public.set_staff_active(
  p_target uuid,
  p_active boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'only an admin can activate/deactivate staff';
  end if;

  update public.profiles set is_active = p_active where id = p_target;
end;
$$;

-- NOTE: get_dashboard_stats is SECURITY INVOKER, so left at the Postgres
-- default PUBLIC EXECUTE grant it's harmless -- same reasoning as
-- create_subscription/calculate_end_date in migration 0008 (see 0009's
-- NOTE for the general principle). The function body only ever reads
-- public.clients/subscriptions/payments through the CALLER's own
-- privileges and RLS policies (migration 0007 grants SELECT on those
-- tables to `authenticated` only, gated by is_active_staff()), so an
-- unauthenticated `anon` caller hitting this RPC would fail with
-- "permission denied for table clients" the moment the function body ran
-- a query, not leak data. No REVOKE/GRANT needed here.
--
-- set_staff_role and set_staff_active are different: both are SECURITY
-- DEFINER (they run as the function owner and write to public.profiles,
-- which has no UPDATE grant to `authenticated` at all -- SECURITY DEFINER
-- is exactly what lets an authorized caller reach that write). Each
-- already has an internal `if not public.is_active_admin() then raise
-- exception` guard, so a non-admin caller -- staff or anon -- is refused
-- regardless of the EXECUTE grant; unlike the cron RPCs in migration 0009,
-- there is no scenario where an unauthenticated/unchecked caller can
-- mutate data through these. Still, applying the same defense-in-depth
-- hardening as 0009 costs nothing and removes a layer an attacker would
-- otherwise get to probe (a leaked/guessed-at internal check is one thing;
-- not even being able to call the RPC at all is stronger). Unlike the cron
-- RPCs, these must stay reachable from the Data API by ordinary
-- `authenticated` staff sessions (an admin managing other staff calls
-- these via `POST /rest/v1/rpc/set_staff_role` while authenticated as
-- themselves, not via the service key) -- so, unlike 0009, EXECUTE is
-- re-granted to `authenticated`, not `service_role`.
revoke execute on function public.set_staff_role(uuid, app_role) from public;
revoke execute on function public.set_staff_active(uuid, boolean) from public;
grant execute on function public.set_staff_role(uuid, app_role) to authenticated;
grant execute on function public.set_staff_active(uuid, boolean) to authenticated;
