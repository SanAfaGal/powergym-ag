-- supabase/migrations/00000000000036_daily_activity.sql
--
-- Backs the dashboard's "Actividad diaria" section: the payments received
-- on one calendar day, each carrying its client, amount, payment method,
-- and the plan the payment is for -- a payment already implies whatever
-- came before it (new enrollment or renewal), so that distinction doesn't
-- need to be surfaced separately.
--
-- Same discipline as get_dashboard_stats (migration 0010, empty-aggregate
-- fix in 0020): jsonb_agg over zero rows is SQL NULL, not '[]' -- coalesce
-- so a day with no payments returns an empty array, not null, avoiding the
-- exact bug documented in migration 0020 (array/object methods crashing
-- client-side on null).
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
  where (pmt.payment_date at time zone 'America/Bogota')::date = p_date
$$;
