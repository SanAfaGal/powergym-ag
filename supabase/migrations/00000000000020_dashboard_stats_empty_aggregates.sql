-- supabase/migrations/00000000000020_dashboard_stats_empty_aggregates.sql
--
-- get_dashboard_stats (00000000000012) returns `null` for
-- subscription_stats/revenue_by_method when the underlying jsonb_object_agg
-- has zero rows to aggregate (e.g. no subscriptions yet, or a date range
-- with no payments) -- jsonb_object_agg's result over an empty set is SQL
-- NULL, not '{}'. The dashboard UI wasn't written to expect that:
-- RevenueByMethodBreakdown does `Object.entries(stats.financial_stats.
-- revenue_by_method)`, which throws "Cannot convert undefined or null to
-- object" and crashes the page whenever a selected range has zero
-- payments -- caught while e2e-testing the dashboard's date-range filter
-- (tests/e2e/dashboard.spec.ts) with an empty range. Coalesce both
-- aggregates to '{}'::jsonb so an empty result renders as an empty object
-- instead of null.
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
      select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb) from (
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
        select coalesce(jsonb_object_agg(payment_method, total), '{}'::jsonb) from (
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
