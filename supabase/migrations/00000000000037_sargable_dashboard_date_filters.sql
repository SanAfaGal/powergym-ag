-- supabase/migrations/00000000000037_sargable_dashboard_date_filters.sql
--
-- get_dashboard_stats (0010, empty-aggregate fix in 0020) and
-- get_daily_activity (0036) both filter timestamptz columns by casting to
-- ::date, which (a) resolves against the session's timezone rather than
-- Bogota -- the same class of bug already fixed for get_daily_activity's
-- equality check in 0036, but never applied to get_dashboard_stats' ranges
-- -- and (b) is non-sargable: an expression on payment_date/created_at
-- can't use payments_date_idx (0006) or an index on created_at, forcing a
-- full scan of both tables on every dashboard/daily-activity load.
--
-- Both are replaced with range comparisons against the raw timestamptz
-- column, converting the incoming p_start/p_end/p_date (calendar dates in
-- Bogota) to their Bogota-local day boundaries. This is both correct (a
-- payment at 8pm Bogota time no longer lands on the wrong UTC day) and
-- sargable (index range scan instead of seq scan).

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
        where created_at >= (p_start::timestamp at time zone 'America/Bogota')
          and created_at < ((p_end + 1)::timestamp at time zone 'America/Bogota')
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
        where payment_date >= (p_start::timestamp at time zone 'America/Bogota')
          and payment_date < ((p_end + 1)::timestamp at time zone 'America/Bogota')
      ),
      'revenue_by_method', (
        select coalesce(jsonb_object_agg(payment_method, total), '{}'::jsonb) from (
          select payment_method, sum(amount) as total
          from public.payments
          where payment_date >= (p_start::timestamp at time zone 'America/Bogota')
            and payment_date < ((p_end + 1)::timestamp at time zone 'America/Bogota')
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

create or replace function public.get_daily_activity(
  p_date date
) returns jsonb
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_id', pmt.id,
    'client_id', c.id,
    'client_name', c.first_name || ' ' || c.last_name,
    'amount', pmt.amount,
    'payment_method', pmt.payment_method,
    'payment_method_name', pt.name,
    'plan_name', p.name
  ) order by pmt.payment_date), '[]'::jsonb)
  from public.payments pmt
  join public.subscriptions s on s.id = pmt.subscription_id
  join public.clients c on c.id = s.client_id
  join public.plans p on p.id = s.plan_id
  join public.payment_types pt on pt.code = pmt.payment_method
  where pmt.payment_date >= (p_date::timestamp at time zone 'America/Bogota')
    and pmt.payment_date < ((p_date + 1)::timestamp at time zone 'America/Bogota')
$$;

-- Backs new_clients_in_range above -- didn't exist before, so that filter
-- was always a full scan of clients regardless.
create index clients_created_at_idx on public.clients (created_at);
